import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceSeriesClient } from "../../src/lib/finance-series-client";
import { FinanceSeriesJournal, type SeriesJournalEnvironment } from "../../src/lib/finance-series-journal";
import { definitionOfSeries } from "../../src/core/financeiro/series/series-planning";
import type { FinanceSeriesCommand, FinanceSeriesResult } from "../../src/core/financeiro/series/series-types";
import { managedSeries, seriesAccount, seriesCategory, seriesId, SERIES_OWNER } from "../fixtures/finance-series";

type Create = Extract<FinanceSeriesCommand, { command: "finance.recurring.create" }>;
const command = (): Create => ({ command: "finance.recurring.create", input: { client_id: seriesId(901), expected_finance_revision: "0", definition: definitionOfSeries(managedSeries({ total: 2 })), horizon: { from_on: "2026-10-23", until_exclusive: "2026-12-23" }, statement_assignments: [] } });
const result = (): FinanceSeriesResult => ({ version: 2, series: managedSeries({ total: 2, next_index: 3, materialized_through: "2026-11-23" }), affected: { created: 2, updated: 0, suppressed: 0, restored: 0, skipped: 0 } });
const success = (value: unknown) => Response.json({ ok: true, result: value });
const rejection = (status: number, code: string) => Response.json({ ok: false, code, message: "synthetic-private-server-message" }, { status });
const available = () => success({ version: 2, available: true });
const reviewed = (request: Create) => ({ version: 2, kind: "review", command: request.command, client_id: request.input.client_id, today: "2026-10-23", consistency: "same", revisions: { requested_finance: "0", observed_finance: "0", requested_series: null, observed_series: null }, data: { series: null, occurrences: [], transactions: [], accounts: [seriesAccount], categories: [seriesCategory], tags: [] } });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function harness() {
  const values = new Map<string, string>(), requests: { path: string; init: RequestInit }[] = [], prefix = `segundo-cerebro:finance-series:v2:${SERIES_OWNER}:`;
  let counter = 80000, queue = Promise.resolve(), current = true;
  const env: SeriesJournalEnvironment = { uuid: () => seriesId(++counter), storage: { keys: () => [...values.keys()], getItem: key => values.get(key) ?? null, setItem: (key, text) => { values.set(key, text); }, removeItem: key => { values.delete(key); } }, exclusive: async (_name, work) => { const previous = queue; let release!: () => void; queue = new Promise<void>(resolve => { release = resolve; }); await previous; try { return await work(); } finally { release(); } } };
  let response: (path: string, init: RequestInit) => Promise<Response> = async path => path.endsWith("/availability") ? available() : success(result());
  const fetcher = async (path: string, init: RequestInit) => { requests.push({ path, init }); return response(path, init); };
  const journal = new FinanceSeriesJournal(SERIES_OWNER, env), client = new FinanceSeriesClient(SERIES_OWNER, journal, { fetcher, isCurrent: () => current, timeoutMs: 1000, origin: "https://synthetic.invalid" });
  return { client, journal, env, values, get pendingKey() { const meta = values.get(prefix + "epoch"); return prefix + "pending:" + (meta ? JSON.parse(meta).epoch : "missing"); }, requests, respond(next: typeof response) { response = next; }, stale() { current = false; } };
}
afterEach(() => vi.useRealTimers());
describe("T053-B3: canal browser v2, sem repetição automática", () => {
  it("construção e recuperação leem apenas o journal; não consultam nem enviam", async () => {
    const h = harness(); expect(h.requests).toHaveLength(0); await h.journal.exclusive(async lease => { lease.stage(command()); lease.unknown(command()); });
    expect(await h.client.loadPending()).toMatchObject({ ok: true, result: { pending: { request: command(), status: "unknown" } } }); expect(h.requests).toHaveLength(0);
  });
  it("o fetch global não recebe a instância do cliente como receptor", async () => {
    const h = harness(), requests: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = async function (this: unknown, input) {
      // Models the Window/undefined receiver boundary enforced by browser fetch.
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      requests.push(String(input)); return available();
    };
    try {
      const client = new FinanceSeriesClient(SERIES_OWNER, new FinanceSeriesJournal(SERIES_OWNER, h.env));
      expect(await client.loadPending()).toMatchObject({ ok: true });
      expect(await client.availability()).toEqual({ ok: true, result: { version: 2, available: true } });
      expect(requests).toEqual(["/api/finance/series/availability"]);
    } finally { globalThis.fetch = original; }
  });
  it("primeiro POST financeiro acontece depois da persistência e usa transporte fechado", async () => {
    const h = harness(); h.respond(async (path, init) => { if (path.endsWith("/availability")) return available(); expect(JSON.parse(h.values.get(h.pendingKey)!).request).toEqual(command()); expect(init).toMatchObject({ method: "POST", credentials: "same-origin", redirect: "error", cache: "no-store", headers: { "X-Expected-User-ID": SERIES_OWNER, "Content-Type": "application/json" } }); expect(JSON.parse(String(init.body))).toEqual(command()); return success(result()); });
    expect(await h.client.execute(command())).toEqual({ ok: true, result: result() }); expect(h.values.has(h.pendingKey)).toBe(false); expect(h.requests).toHaveLength(2);
  });
  it("armazenamento indisponível impede qualquer envio, inclusive preflight", async () => {
    const env: SeriesJournalEnvironment = { uuid: () => seriesId(60000), storage: { keys: () => [], getItem() { throw new Error("private-storage"); }, setItem() {}, removeItem() {} }, exclusive: async (_name, work) => work() }, fetcher = vi.fn();
    const client = new FinanceSeriesClient(SERIES_OWNER, new FinanceSeriesJournal(SERIES_OWNER, env), { fetcher }); expect(await client.execute(command())).toMatchObject({ ok: false, code: "journal-unavailable" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("primeira rejeição transacional conhecida pode liberar a intenção sem esconder o erro", async () => {
    const h = harness(); h.respond(async path => path.endsWith("/availability") ? available() : rejection(409, "CONFLICT")); expect(await h.client.execute(command())).toMatchObject({ ok: false, code: "conflict" }); expect(h.values.has(h.pendingKey)).toBe(false);
  });
  for (const [status, code] of [[403, "FORBIDDEN"], [400, "VALIDATION"], [409, "CONFLICT"], [503, "UNAVAILABLE"]] as const) it(`resultado incerto seguido de ${status} mantém exatamente o primeiro UUID/corpo`, async () => {
    const h = harness(); h.respond(async path => { if (path.endsWith("/availability")) return available(); throw new Error("private-network-detail"); });
    expect(await h.client.execute(command())).toMatchObject({ ok: false, code: "uncertain" }); const original = h.values.get(h.pendingKey); h.respond(async path => path.endsWith("/availability") ? available() : rejection(status, code));
    expect(await h.client.retryPending()).toMatchObject({ ok: false, code: "uncertain" }); expect(h.values.get(h.pendingKey)).toBe(original); expect(h.requests.filter(item => item.path === "/api/finance/series").map(item => item.init.body)).toEqual([JSON.stringify(command()), JSON.stringify(command())]);
    const other = command(); other.input.client_id = seriesId(902); expect(await h.client.execute(other)).toMatchObject({ ok: false, code: "pending" }); expect(h.values.get(h.pendingKey)).toBe(original);
  });
  it("flag desligada não consulta RPC de escrita nem apaga a incerteza anterior", async () => {
    const h = harness(); await h.journal.exclusive(async lease => { lease.stage(command()); lease.unknown(command()); }); const before = h.values.get(h.pendingKey);
    h.respond(async () => success({ version: 2, available: false })); expect(await h.client.retryPending()).toMatchObject({ ok: false, code: "uncertain" }); expect(h.values.get(h.pendingKey)).toBe(before); expect(h.requests.map(item => item.path)).toEqual(["/api/finance/series/availability"]);
    const fresh = harness(); fresh.respond(async () => success({ version: 2, available: false })); expect(await fresh.client.execute(command())).toMatchObject({ ok: false, code: "disabled" }); expect(fresh.values.has(fresh.pendingKey)).toBe(false);
  });
  it("consulta humana sem recibo não prova rollback; confirmação própria resolve sem novo POST", async () => {
    const h = harness(); await h.journal.exclusive(async lease => { lease.stage(command()); lease.unknown(command()); }); const before = h.values.get(h.pendingKey); h.respond(async () => success(reviewed(command())));
    expect(await h.client.reconcilePending()).toMatchObject({ ok: true, result: { kind: "review" } }); expect(h.values.get(h.pendingKey)).toBe(before);
    h.respond(async () => success({ version: 2, kind: "confirmed", command: command().command, client_id: command().input.client_id, result: result() })); expect(await h.client.reconcilePending()).toMatchObject({ ok: true, result: { kind: "confirmed", result: result() } }); expect(h.values.has(h.pendingKey)).toBe(false); expect(h.requests.every(item => item.path.endsWith("/preview"))).toBe(true);
  });
  it("prévia é somente leitura e recusa outra intenção enquanto existe pendência", async () => {
    const h = harness(); await h.client.loadPending(); const opened = [...h.values]; h.respond(async () => success(reviewed(command()))); expect(await h.client.preview(command())).toMatchObject({ ok: true }); expect([...h.values]).toEqual(opened);
    await h.journal.exclusive(async lease => { lease.stage(command()); }); const before = h.values.get(h.pendingKey), different = command(); different.input.definition.template.amount_cents++;
    expect(await h.client.preview(different)).toMatchObject({ ok: false, code: "pending" }); expect(h.values.get(h.pendingKey)).toBe(before); expect(h.requests).toHaveLength(1);
  });
  for (const resolution of ["success", "error", "timeout"] as const) it(`serviço anterior não aplica resposta ${resolution} após troca/unmount`, async () => {
    vi.useFakeTimers(); const h = harness(), waiting = deferred<Response>(), entered = deferred<void>(); h.respond(async path => { if (path.endsWith("/availability")) return available(); entered.resolve(); return waiting.promise; });
    const old = h.client.execute(command()); await entered.promise; const before = h.values.get(h.pendingKey); h.stale(); h.client.dispose();
    if (resolution === "success") waiting.resolve(success(result())); else if (resolution === "error") waiting.reject(new Error("old-private-error")); else await vi.advanceTimersByTimeAsync(1100);
    expect(await old).toMatchObject({ ok: false, code: "session-changed" }); expect(h.values.get(h.pendingKey)).toBe(before);
    const current = new FinanceSeriesClient(SERIES_OWNER, new FinanceSeriesJournal(SERIES_OWNER, h.env), { fetcher: async () => { throw new Error("must-not-dispatch"); } }); expect(await current.loadPending()).toMatchObject({ ok: true, result: { pending: { request: command() } } });
    if (resolution === "timeout") waiting.resolve(success(result()));
  });
  it("timeout de POST marca desconhecido, sem repetição; erro bruto não aparece", async () => {
    vi.useFakeTimers(); const h = harness(), entered = deferred<void>(); h.respond(async path => { if (path.endsWith("/availability")) return available(); entered.resolve(); return new Promise<Response>(() => undefined); }); const sending = h.client.execute(command()); await entered.promise; await vi.advanceTimersByTimeAsync(1100);
    expect(await sending).toMatchObject({ ok: false, code: "uncertain" }); expect(JSON.parse(h.values.get(h.pendingKey)!).status).toBe("unknown"); expect(h.requests).toHaveLength(2);
  });
  it("saída explícita remove o corpo, cerca retorno tardio e exige reconferência ao reentrar", async () => {
    const h = harness(), entered = deferred<void>(), waiting = deferred<Response>(), request = command(); request.input.definition.template.description = "private-owner-A";
    h.respond(async path => { if (path.endsWith("/availability")) return available(); entered.resolve(); return waiting.promise; }); const sending = h.client.execute(request); await entered.promise;
    expect(h.client.revokeIdentity()).toEqual({ hadPending: true }); expect(h.values.has(h.pendingKey)).toBe(false); expect([...h.values.values()].join()).not.toContain("private-owner-A"); waiting.resolve(success(result())); expect(await sending).toMatchObject({ ok: false, code: "session-changed" });
    const returned = new FinanceSeriesClient(SERIES_OWNER, new FinanceSeriesJournal(SERIES_OWNER, h.env), { fetcher: vi.fn() }); expect(await returned.loadPending()).toMatchObject({ ok: true, result: { reconfirmRequired: true, pending: null } }); expect(await returned.execute(command())).toMatchObject({ ok: false }); expect(await returned.acknowledgeReconfirmation()).toMatchObject({ ok: true, result: { reconfirmRequired: false, pending: null } });
  });
  it("quota no logout cerca resposta tardia de outro handle e exige reconferência após restaurar escrita", async () => {
    const h = harness(); await h.journal.exclusive(async lease => { lease.stage(command()); lease.unknown(command()); });
    const waiting = deferred<Response>(), entered = deferred<void>(), reader = new FinanceSeriesClient(SERIES_OWNER, new FinanceSeriesJournal(SERIES_OWNER, h.env), { fetcher: async () => { entered.resolve(); return waiting.promise; }, isCurrent: () => true });
    await reader.loadPending(); const reading = reader.availability(); await entered.promise;
    const write = h.env.storage.setItem; h.env.storage.setItem = () => { throw new Error("synthetic-quota"); };
    expect(() => new FinanceSeriesJournal(SERIES_OWNER, h.env).revoke()).toThrow(); expect(h.values.has(h.pendingKey)).toBe(false); waiting.resolve(available()); expect(await reading).toMatchObject({ ok: false, code: "session-changed" });
    h.env.storage.setItem = write; const fetcher = vi.fn<typeof fetch>().mockResolvedValue(available()), returned = new FinanceSeriesClient(SERIES_OWNER, new FinanceSeriesJournal(SERIES_OWNER, h.env), { fetcher });
    expect(await returned.loadPending()).toMatchObject({ ok: true, result: { pending: null, reconfirmRequired: true } }); const other = command(); other.input.client_id = seriesId(902);
    expect(await returned.execute(other)).toMatchObject({ ok: false, code: "reconfirm" }); expect(fetcher).toHaveBeenCalledTimes(1); expect(h.values.has(h.pendingKey)).toBe(false);
  });
  it("SESSION_CHANGED fechado remove corpo; 401/403 comuns não se passam por logout", async () => {
    const h = harness(); await h.journal.exclusive(async lease => { lease.stage(command()); lease.unknown(command()); }); h.respond(async () => rejection(409, "SESSION_CHANGED")); expect(await h.client.retryPending()).toMatchObject({ ok: false, code: "session-changed" }); expect(h.values.has(h.pendingKey)).toBe(false);
    for (const [status, code] of [[401, "UNAUTHENTICATED"], [403, "FORBIDDEN"]] as const) { const other = harness(); await other.journal.exclusive(async lease => { lease.stage(command()); lease.unknown(command()); }); const original = other.values.get(other.pendingKey); other.respond(async () => rejection(status, code)); expect(await other.client.retryPending()).toMatchObject({ ok: false, code: "uncertain" }); expect(other.values.get(other.pendingKey)).toBe(original); }
  });
  for (const method of ["availability", "page", "detail", "preview"] as const) it(`leitura ${method} aberta recusa resposta após revogação externa`, async () => {
    const h = harness(); await h.journal.exclusive(async () => undefined);
    const waiting = deferred<Response>(), entered = deferred<void>(), reader = new FinanceSeriesClient(SERIES_OWNER, new FinanceSeriesJournal(SERIES_OWNER, h.env), { fetcher: async () => { entered.resolve(); return waiting.promise; }, isCurrent: () => true });
    expect(await reader.loadPending()).toMatchObject({ ok: true });
    const read = method === "availability" ? reader.availability() : method === "page" ? reader.page({ cursor: null, limit: 20 }) : method === "detail" ? reader.detail(seriesId(4)) : reader.preview(command());
    await entered.promise; new FinanceSeriesJournal(SERIES_OWNER, h.env).revoke(); waiting.resolve(success({ version: 2, available: true })); expect(await read).toMatchObject({ ok: false, code: "session-changed" });
  });
  for (const priorLogout of [false, true]) for (const method of ["availability", "page", "detail", "preview"] as const) it(`leitura ${method} sem abertura faz zero RPC apesar de logout vazio ${priorLogout ? "repetido" : "inicial"}`, async () => {
    const h = harness(); if (priorLogout) new FinanceSeriesJournal(SERIES_OWNER, h.env).revoke();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(available()), reader = new FinanceSeriesClient(SERIES_OWNER, new FinanceSeriesJournal(SERIES_OWNER, h.env), { fetcher, isCurrent: () => true });
    const read = method === "availability" ? reader.availability() : method === "page" ? reader.page({ cursor: null, limit: 20 }) : method === "detail" ? reader.detail(seriesId(4)) : reader.preview(command());
    expect(await read).toMatchObject({ ok: false, code: "journal-unavailable" }); expect(fetcher).not.toHaveBeenCalled(); new FinanceSeriesJournal(SERIES_OWNER, h.env).revoke(); expect(h.values.has(`segundo-cerebro:finance-series:v2:${SERIES_OWNER}:epoch`)).toBe(false);
    expect(await reader.loadPending()).toMatchObject({ ok: true }); expect(await reader.availability()).toMatchObject({ ok: true }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("200 de outro dono/definição, campos extras, redirect, HTML e corpo acima da quota preservam a tentativa", async () => {
    const foreign = result(); foreign.series.user_id = seriesId(9999); const wrong = result(); wrong.series.template.amount_cents++;
    const bad = [success(foreign), success(wrong), Response.json({ ok: true, result: result(), extra: true }), new Response("private-html", { status: 200, headers: { "Content-Type": "text/html" } }), new Response("{}", { status: 200, headers: { "Content-Type": "application/json", "Content-Length": String(4 * 1024 * 1024 + 1) } })];
    for (const reply of bad) { const h = harness(); h.respond(async path => path.endsWith("/availability") ? available() : reply); const output = await h.client.execute(command()); expect(output).toMatchObject({ ok: false, code: "uncertain" }); expect(JSON.stringify(output)).not.toMatch(/private-html|synthetic-private-server-message/); expect(h.values.has(h.pendingKey)).toBe(true); }
    const redirected = harness(); redirected.respond(async path => { if (path.endsWith("/availability")) return available(); const reply = success(result()); Object.defineProperty(reply, "redirected", { value: true }); return reply; }); expect(await redirected.client.execute(command())).toMatchObject({ ok: false, code: "uncertain" });
  });
  it("dois envios concorrentes de mesmo UUID recuperam o recibo, sem limpar outra intenção", async () => {
    const h = harness(), entered = deferred<void>(), waiting = deferred<Response>(); let writes = 0; h.respond(async path => { if (path.endsWith("/availability")) return available(); writes++; if (writes === 1) { entered.resolve(); return waiting.promise; } return success(result()); });
    const first = h.client.execute(command()); await entered.promise; const other = command(); other.input.client_id = seriesId(902); const competing = h.client.execute(other); waiting.reject(new Error("synthetic-lost-response")); expect(await first).toMatchObject({ ok: false, code: "uncertain" }); expect(await competing).toMatchObject({ ok: false, code: "pending" }); expect(writes).toBe(1);
    expect(await h.client.retryPending()).toMatchObject({ ok: true, result: result() }); expect(writes).toBe(2); expect(h.values.has(h.pendingKey)).toBe(false);
  });
});
