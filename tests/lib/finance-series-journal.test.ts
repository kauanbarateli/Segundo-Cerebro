import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { FinanceSeriesJournal, SeriesJournalError, type SeriesJournalEnvironment, type SeriesJournalLease } from "../../src/lib/finance-series-journal";
import { channelCreate } from "../fixtures/finance-series-channel";
import { seriesId, SERIES_OWNER } from "../fixtures/finance-series";

function environment() {
  const values = new Map<string, string>(), reads: string[] = []; let counter = 70000, queue = Promise.resolve(), failWrite = false;
  const env: SeriesJournalEnvironment = { uuid: () => seriesId(++counter), storage: { keys: () => [...values.keys()], getItem(key) { reads.push(key); return values.get(key) ?? null; }, setItem(key, value) { if (failWrite) throw new Error("synthetic-storage-failure"); values.set(key, value); }, removeItem(key) { values.delete(key); } },
    exclusive: async (_name, work) => { let release!: () => void; const turn = queue; queue = new Promise<void>(resolve => { release = resolve; }); await turn; try { return await work(); } finally { release(); } } };
  return { values, reads, env, failWrite: () => { failWrite = true; }, restoreWrite: () => { failWrite = false; } };
}
const prefix = `segundo-cerebro:finance-series:v2:${SERIES_OWNER}:`;
const pendingKey = (h: ReturnType<typeof environment>) => { const meta = h.values.get(prefix + "epoch"); return prefix + "pending:" + (meta ? JSON.parse(meta).epoch : "missing"); };
describe("T053-B3: intenção financeira v2 durável, própria e sem dispatch", () => {
  it("persiste e reconfere antes do primeiro envio; recarga recupera sem enviar", async () => {
    const h = environment(), journal = new FinanceSeriesJournal(SERIES_OWNER, h.env), request = channelCreate(); let sends = 0;
    await journal.exclusive(async lease => { expect(lease.snapshot().pending).toBeNull(); expect(lease.stage(request).created).toBe(true); expect(JSON.parse(h.values.get(pendingKey(h))!).request).toEqual(request); sends++; lease.unknown(request); }); expect(sends).toBe(1);
    const recovered = new FinanceSeriesJournal(SERIES_OWNER, h.env); await recovered.exclusive(async lease => { expect(lease.snapshot().pending).toMatchObject({ request, status: "unknown" }); }); expect(sends).toBe(1);
  });
  it("falha no armazenamento impede chegar ao ponto de envio", async () => {
    const h = environment(), journal = new FinanceSeriesJournal(SERIES_OWNER, h.env); await journal.exclusive(async () => undefined); h.failWrite(); let sends = 0;
    await expect(journal.exclusive(async lease => { lease.stage(channelCreate()); sends++; })).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(sends).toBe(0);
  });
  it("duas intenções concorrentes do mesmo dono não sobrescrevem o registro", async () => {
    const h = environment(), a = new FinanceSeriesJournal(SERIES_OWNER, h.env), b = new FinanceSeriesJournal(SERIES_OWNER, h.env), request = channelCreate(), other = { ...request, input: { ...request.input, client_id: seriesId(902) } };
    const result = await Promise.allSettled([a.exclusive(async lease => lease.stage(request)), b.exclusive(async lease => lease.stage(other))]); expect(result.map(value => value.status)).toEqual(["fulfilled", "rejected"]); expect(JSON.parse(h.values.get(pendingKey(h))!).request).toEqual(request);
    await b.exclusive(async lease => { expect(lease.stage(request).created).toBe(false); expect(() => lease.rejected(request)).toThrow(SeriesJournalError); });
  });
  it("tentativa preparada recuperada também é incerta; não afirma que nunca houve envio", async () => {
    const h = environment(), request = channelCreate(); await new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async lease => { lease.stage(request); });
    await new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async lease => { expect(lease.stage(request).created).toBe(false); expect(() => lease.rejected(request)).toThrow(); expect(lease.snapshot().pending?.request).toEqual(request); lease.confirmed(request); }); expect(h.values.has(pendingKey(h))).toBe(false);
  });
  it("só rejeição conhecida na primeira tentativa ou confirmação exata pode limpar", async () => {
    const h = environment(), journal = new FinanceSeriesJournal(SERIES_OWNER, h.env), request = channelCreate(); await journal.exclusive(async lease => { lease.stage(request); lease.rejected(request); expect(lease.snapshot().pending).toBeNull(); });
    await journal.exclusive(async lease => { lease.stage(request); lease.unknown(request); expect(() => lease.rejected(request)).toThrow(); const different = structuredClone(request); different.input.definition.template.amount_cents++; expect(() => lease.confirmed(different)).toThrow(); expect(lease.snapshot().pending?.status).toBe("unknown"); lease.confirmed(request); }); expect(h.values.has(pendingKey(h))).toBe(false);
  });
  it("logout explícito invalida em andamento, remove corpo e exige reconferência na volta", async () => {
    const h = environment(), old = new FinanceSeriesJournal(SERIES_OWNER, h.env), request = channelCreate(); request.input.definition.template.description = "private-synthetic-description";
    let release!: () => void, entered!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { entered = resolve; });
    const oldOperation = old.exclusive(async lease => { lease.stage(request); entered(); await waiting; lease.unknown(request); }); await ready;
    const logout = new FinanceSeriesJournal(SERIES_OWNER, h.env); expect(logout.revoke()).toEqual({ hadPending: true }); expect(h.values.has(pendingKey(h))).toBe(false); expect([...h.values.values()].join()).not.toContain("private-synthetic-description"); release(); await expect(oldOperation).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    const returned = new FinanceSeriesJournal(SERIES_OWNER, h.env); await returned.exclusive(async lease => { expect(lease.snapshot()).toEqual({ pending: null, reconfirmRequired: true }); expect(() => lease.stage(request)).toThrow(); lease.acknowledgeReconfirmation(); expect(lease.snapshot().pending).toBeNull(); });
  });
  it("sessão B não lê nem herda o corpo do dono A e a revogação repetida não apaga o aviso", async () => {
    const h = environment(), request = channelCreate(), a = new FinanceSeriesJournal(SERIES_OWNER, h.env); await a.exclusive(async lease => { lease.stage(request); lease.unknown(request); }); a.revoke();
    const afterLogout = new FinanceSeriesJournal(SERIES_OWNER, h.env); afterLogout.revoke(); h.reads.length = 0; const ownerB = seriesId(9999), b = new FinanceSeriesJournal(ownerB, h.env); await b.exclusive(async lease => { expect(lease.snapshot().pending).toBeNull(); }); expect(h.reads.every(key => key.startsWith(`segundo-cerebro:finance-series:v2:${ownerB}:`))).toBe(true);
    await new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async lease => { expect(lease.snapshot().reconfirmRequired).toBe(true); });
  });
  it("revogação tardia de e1 não invalida e2 nem remove seu novo corpo", async () => {
    const h = environment(), old = new FinanceSeriesJournal(SERIES_OWNER, h.env), original = channelCreate(), next = channelCreate(); next.input.client_id = seriesId(902);
    await old.exclusive(async lease => { lease.stage(original); lease.unknown(original); }); const firstMeta = h.values.get(prefix + "epoch")!; new FinanceSeriesJournal(SERIES_OWNER, h.env).revoke();
    const current = new FinanceSeriesJournal(SERIES_OWNER, h.env); await current.exclusive(async lease => { lease.acknowledgeReconfirmation(); lease.stage(next); lease.unknown(next); });
    const currentMeta = h.values.get(prefix + "epoch"), currentBody = h.values.get(pendingKey(h)); expect(currentMeta).not.toBe(firstMeta); old.revoke();
    expect(h.values.get(prefix + "epoch")).toBe(currentMeta); expect(h.values.get(pendingKey(h))).toBe(currentBody); current.assertSession(); expect(current.snapshot().pending?.request).toEqual(next);
  });
  it("o mesmo handle de logout fresco não adota uma época futura na segunda chamada", async () => {
    const h = environment(), first = new FinanceSeriesJournal(SERIES_OWNER, h.env); await first.exclusive(async lease => { lease.stage(channelCreate()); });
    const freshLogout = new FinanceSeriesJournal(SERIES_OWNER, h.env); freshLogout.revoke(); const next = new FinanceSeriesJournal(SERIES_OWNER, h.env); await next.exclusive(async lease => { lease.acknowledgeReconfirmation(); lease.stage(channelCreate()); });
    const metadata = h.values.get(prefix + "epoch"), body = h.values.get(pendingKey(h)); freshLogout.revoke(); expect(h.values.get(prefix + "epoch")).toBe(metadata); expect(h.values.get(pendingKey(h))).toBe(body); next.assertSession();
    const empty = environment(), emptyLogout = new FinanceSeriesJournal(SERIES_OWNER, empty.env); emptyLogout.revoke(); const entered = new FinanceSeriesJournal(SERIES_OWNER, empty.env); await entered.exclusive(async lease => { lease.stage(channelCreate()); }); const initialBody = empty.values.get(pendingKey(empty)); emptyLogout.revoke(); expect(empty.values.get(pendingKey(empty))).toBe(initialBody); entered.assertSession();
  });
  it("ack antigo não ressuscita epoch revogado nem limpa reconferência da próxima sessão", async () => {
    const h = environment(), original = channelCreate(), first = new FinanceSeriesJournal(SERIES_OWNER, h.env); await first.exclusive(async lease => { lease.stage(original); }); first.revoke();
    const current = new FinanceSeriesJournal(SERIES_OWNER, h.env); await current.exclusive(async lease => { expect(lease.snapshot().reconfirmRequired).toBe(true); });
    const metadata = h.values.get(prefix + "epoch")!, write = h.env.storage.setItem; let interrupted = false;
    h.env.storage.setItem = (key, value) => { if (!interrupted && key.startsWith(prefix + "ack:")) { interrupted = true; new FinanceSeriesJournal(SERIES_OWNER, h.env).revoke(); } write(key, value); };
    await expect(current.exclusive(async lease => lease.acknowledgeReconfirmation())).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(h.values.get(prefix + "epoch")).toBe(metadata);
    const returned = new FinanceSeriesJournal(SERIES_OWNER, h.env); await returned.exclusive(async lease => { expect(lease.snapshot()).toEqual({ pending: null, reconfirmRequired: true }); }); expect(h.values.get(prefix + "epoch")).not.toBe(metadata);
  });
  it("revogação entre persistir e reconferir limpa apenas a chave da própria época", async () => {
    const h = environment(), journal = new FinanceSeriesJournal(SERIES_OWNER, h.env), write = h.env.storage.setItem; let interrupted = false;
    await journal.exclusive(async () => undefined); h.env.storage.setItem = (key, value) => { write(key, value); if (!interrupted && key.startsWith(prefix + "pending:")) { interrupted = true; new FinanceSeriesJournal(SERIES_OWNER, h.env).revoke(); } };
    let sends = 0; await expect(journal.exclusive(async lease => { lease.stage(channelCreate()); sends++; })).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(sends).toBe(0); expect([...h.values.keys()].filter(key => key.startsWith(prefix + "pending:"))).toEqual([]);
  });
  it("fence de leitura captura a época sem escrever e rejeita revogação externa", async () => {
    const h = environment(), opened = new FinanceSeriesJournal(SERIES_OWNER, h.env); await opened.exclusive(async () => undefined); const reader = new FinanceSeriesJournal(SERIES_OWNER, h.env), before = [...h.values], fence = reader.captureFence(); expect([...h.values]).toEqual(before); fence(); new FinanceSeriesJournal(SERIES_OWNER, h.env).revoke(); expect(fence).toThrow();
    const empty = environment(), absent = new FinanceSeriesJournal(SERIES_OWNER, empty.env); expect(() => absent.captureFence()).toThrow(); expect(empty.values.size).toBe(0); await absent.exclusive(async () => undefined); absent.captureFence()();
  });
  it("logout entre observar ausência e primeiro put impede primeiro dispatch e não é ressuscitado", async () => {
    const h = environment(), write = h.env.storage.setItem; let interrupted = false;
    h.env.storage.setItem = (key, value) => { if (!interrupted && key === prefix + "epoch") { interrupted = true; new FinanceSeriesJournal(SERIES_OWNER, h.env).revoke(); } write(key, value); };
    let sends = 0; await expect(new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async lease => { lease.stage(channelCreate()); sends++; })).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(sends).toBe(0);
    const returned = new FinanceSeriesJournal(SERIES_OWNER, h.env); await returned.exclusive(async lease => {
      // Logout removed the opening epoch's validity sentinel. Its stale pointer
      // cannot prove a clean session merely because no body reached storage.
      expect(lease.snapshot()).toEqual({ pending: null, reconfirmRequired: true });
      try { lease.stage(channelCreate()); expect.unreachable("Reconfirmation must precede staging."); }
      catch (error) { expect(error).toBeInstanceOf(SeriesJournalError); expect(error).toMatchObject({ code: "RECONFIRM" }); }
      expect(lease.snapshot().pending).toBeNull(); expect(sends).toBe(0);
      lease.acknowledgeReconfirmation();
      expect(lease.snapshot()).toEqual({ pending: null, reconfirmRequired: false });
      expect(lease.stage(channelCreate()).created).toBe(true); expect(sends).toBe(0);
    }); returned.assertSession();
  });
  it("órfão em chave epocada sem metadata é recusado, preservado e nunca substituído", async () => {
    const h = environment(), orphanKey = prefix + "pending:" + seriesId(70000); h.values.set(orphanKey, JSON.stringify({ version: 2, ownerId: SERIES_OWNER, epoch: seriesId(70000), request: channelCreate(), status: "unknown" })); const original = h.values.get(orphanKey);
    await expect(new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async () => undefined)).rejects.toMatchObject({ code: "CORRUPT" }); expect(h.values.get(orphanKey)).toBe(original); expect(h.values.has(prefix + "epoch")).toBe(false);
  });
  it("ports escapados fecham e corpo corrompido não é descartado automaticamente", async () => {
    const h = environment(), journal = new FinanceSeriesJournal(SERIES_OWNER, h.env); let escaped: SeriesJournalLease | null = null; await journal.exclusive(async lease => { escaped = lease; }); expect(() => (escaped as SeriesJournalLease | null)!.stage(channelCreate())).toThrow();
    h.values.set(pendingKey(h), '{"version":2,"unexpected":"synthetic"}'); await expect(journal.exclusive(async () => undefined)).rejects.toMatchObject({ code: "CORRUPT" }); expect(h.values.has(pendingKey(h))).toBe(true);
    const fresh = environment(); fresh.values.set(pendingKey(h), JSON.stringify({ version: 2, ownerId: SERIES_OWNER, epoch: seriesId(70000), request: channelCreate(), status: "unknown" })); await expect(new FinanceSeriesJournal(SERIES_OWNER, fresh.env).exclusive(async () => undefined)).rejects.toMatchObject({ code: "CORRUPT" }); expect(fresh.values.has(`segundo-cerebro:finance-series:v2:${SERIES_OWNER}:epoch`)).toBe(false); expect(fresh.values.has(pendingKey(h))).toBe(true);
  });
  it("quota durante revoke remove sentinel antes do corpo e cerca outros handles e fences", async () => {
    const h = environment(), old = new FinanceSeriesJournal(SERIES_OWNER, h.env), stale = new FinanceSeriesJournal(SERIES_OWNER, h.env), request = channelCreate();
    await old.exclusive(async lease => { lease.stage(request); lease.unknown(request); }); await stale.exclusive(async () => undefined);
    const oldEpoch = JSON.parse(h.values.get(prefix + "epoch")!).epoch, fence = stale.captureFence(); h.failWrite();
    expect(() => old.revoke()).toThrow(SeriesJournalError); expect(h.values.has(prefix + "alive:" + oldEpoch)).toBe(false); expect(h.values.has(pendingKey(h))).toBe(false);
    expect(() => stale.assertSession()).toThrow(); expect(() => stale.snapshot()).toThrow(); expect(() => stale.inspect()).toThrow(); expect(fence).toThrow(); await expect(stale.exclusive(async () => undefined)).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    h.restoreWrite(); const next = new FinanceSeriesJournal(SERIES_OWNER, h.env), another = channelCreate(); another.input.client_id = seriesId(902);
    await next.exclusive(async lease => { expect(lease.snapshot()).toEqual({ pending: null, reconfirmRequired: true }); expect(() => lease.stage(another)).toThrow(); lease.acknowledgeReconfirmation(); lease.stage(another); });
    const nextEpoch = h.values.get(prefix + "epoch"), nextBody = h.values.get(pendingKey(h)); old.revoke(); expect(h.values.get(prefix + "epoch")).toBe(nextEpoch); expect(h.values.get(pendingKey(h))).toBe(nextBody); next.assertSession();
  });
  it("sentinel é escrito e reconferido antes de pointer e corpo", async () => {
    const h = environment(), order: string[] = [], write = h.env.storage.setItem; h.env.storage.setItem = (key, value) => { order.push(key); write(key, value); };
    await new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async lease => { lease.stage(channelCreate()); });
    expect(order[0]).toMatch(/:alive:/); expect(order[1]).toBe(prefix + "epoch"); expect(order[2]).toMatch(/:pending:/);
  });
  it.each(["alive", "epoch"])("falha de persistência de %s impede callback, envio e publicação inválida", async field => {
    const h = environment(), write = h.env.storage.setItem; let sends = 0;
    h.env.storage.setItem = (key, value) => { if (field === "alive" ? key.startsWith(prefix + "alive:") : key === prefix + "epoch") return; write(key, value); };
    await expect(new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async lease => { lease.stage(channelCreate()); sends++; })).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(sends).toBe(0); expect(h.values.has(prefix + "epoch")).toBe(false); expect([...h.values.keys()].some(key => key.startsWith(prefix + "pending:"))).toBe(false);
    h.env.storage.setItem = write; await new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async lease => { expect(lease.snapshot()).toEqual({ pending: null, reconfirmRequired: false }); });
  });
  it("sentinel ausente exige rotação e reconferência; corrompido bloqueia sem apagar corpo", async () => {
    for (const corrupt of [false, true]) {
      const h = environment(), old = new FinanceSeriesJournal(SERIES_OWNER, h.env); await old.exclusive(async lease => { lease.stage(channelCreate()); }); const previous = h.values.get(prefix + "epoch")!, epoch = JSON.parse(previous).epoch, body = h.values.get(pendingKey(h)), fence = old.captureFence();
      if (corrupt) h.values.set(prefix + "alive:" + epoch, "unexpected"); else h.values.delete(prefix + "alive:" + epoch);
      expect(fence).toThrow(); expect(() => old.assertSession()).toThrow(); expect(() => old.inspect()).toThrow();
      const next = new FinanceSeriesJournal(SERIES_OWNER, h.env);
      if (corrupt) { await expect(next.exclusive(async () => undefined)).rejects.toMatchObject({ code: "CORRUPT" }); expect(h.values.get(prefix + "epoch")).toBe(previous); expect(h.values.get(pendingKey(h))).toBe(body); }
      else { await next.exclusive(async lease => { expect(lease.snapshot()).toEqual({ pending: null, reconfirmRequired: true }); expect(() => lease.stage(channelCreate())).toThrow(); }); expect(h.values.get(prefix + "epoch")).not.toBe(previous); }
    }
  });
  it("se DELETE do sentinel falha, não remove o único corpo que impede novo UUID", async () => {
    const h = environment(), journal = new FinanceSeriesJournal(SERIES_OWNER, h.env); await journal.exclusive(async lease => { lease.stage(channelCreate()); lease.unknown(channelCreate()); }); const body = h.values.get(pendingKey(h)), remove = h.env.storage.removeItem;
    h.env.storage.removeItem = key => { if (key.startsWith(prefix + "alive:")) throw new Error("synthetic-remove-denied"); remove(key); }; h.failWrite(); expect(() => journal.revoke()).toThrow(); expect(h.values.get(pendingKey(h))).toBe(body);
    h.restoreWrite(); await new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async lease => { const other = channelCreate(); other.input.client_id = seriesId(902); expect(() => lease.stage(other)).toThrow(); expect(lease.snapshot().pending?.request).toEqual(channelCreate()); });
  });
  it("logout entre sentinel e primeiro pointer continua cercado quando SET do marcador falha", async () => {
    const h = environment(), write = h.env.storage.setItem; let interrupted = false, sends = 0;
    h.env.storage.setItem = (key, value) => { if (!interrupted && key === prefix + "epoch") { interrupted = true; h.failWrite(); expect(() => new FinanceSeriesJournal(SERIES_OWNER, h.env).revoke()).toThrow(); h.restoreWrite(); } write(key, value); };
    await expect(new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async lease => { lease.stage(channelCreate()); sends++; })).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(sends).toBe(0);
    await new FinanceSeriesJournal(SERIES_OWNER, h.env).exclusive(async lease => { expect(lease.snapshot()).toEqual({ pending: null, reconfirmRequired: true }); });
  });
});
