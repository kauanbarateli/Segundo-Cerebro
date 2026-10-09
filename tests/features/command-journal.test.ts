import { afterEach, describe, expect, it, vi } from "vitest";
import { createConnectedApplication } from "../../src/lib/demo/connected-application";
import { CommandJournal, journalBody, journalInput } from "../../src/lib/demo/command-journal";
import { createDemoFixture } from "../../src/lib/demo/fixtures";
import { journalBrowser } from "./helpers/journal-browser";

const owner = "10000000-0000-4000-8000-000000000001", other = "10000000-0000-4000-8000-000000000002";
const capture = createDemoFixture(undefined, owner).initial.capture![0]!;
const input = { client_id: "request-original", type: "note" as const, title: "Conteúdo privado", content: "Preservar exatamente 👋", category_id: null, project_id: null };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const success = () => json({ ok: true, result: capture });
const dto = () => json({ items: [capture], categories: [], projects: [] });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
afterEach(() => vi.useRealTimers());

describe("journal durável dos comandos conectados", () => {
  it("SSR começa idle e sem storage; produção não recorre à memória se o navegador não está disponível", async () => {
    const factory = vi.fn(), fetcher = vi.fn<typeof fetch>();
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: factory });
    expect(app.getCommandSnapshot()).toEqual({ status: "idle" });
    expect(factory).not.toHaveBeenCalled(); app.dispose();
    const server = createConnectedApplication(owner, { fetch: fetcher });
    await expect(server.commands.captures.create(input)).rejects.toMatchObject({ code: "JOURNAL_UNAVAILABLE", outcomeUnknown: false });
    expect(fetcher).not.toHaveBeenCalled(); server.dispose();
  });

  it("grava antes do POST e restaura após fechar/reabrir sem reenviar automaticamente", async () => {
    const browser = journalBrowser(), bodies: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, request) => {
      if (request?.method !== "POST") return dto();
      const stored = JSON.parse(browser.entries()[0]![1]) as { body: string };
      expect(stored.body).toBe(request.body); bodies.push(String(request.body));
      if (bodies.length === 1) throw new Error("confirmation-lost");
      return success();
    });
    const first = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    await expect(first.commands.captures.create(input)).rejects.toMatchObject({ outcomeUnknown: true });
    first.dispose(); // Unmount/reload is deliberately not logout.
    expect(browser.entries()).toHaveLength(1);
    const reopened = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    expect(reopened.getCommandSnapshot()).toEqual({ status: "idle" });
    await reopened.initializeJournal();
    expect(reopened.getCommandSnapshot()).toMatchObject({ status: "pending", retrying: false });
    await reopened.load("captures");
    expect(bodies).toHaveLength(1);
    await expect(reopened.commands.captures.create({ ...input, client_id: "another", title: "Substituir" })).rejects.toMatchObject({ code: "PENDING_COMMAND" });
    expect(bodies).toHaveLength(1);
    await reopened.retryPendingCommand();
    expect(bodies).toEqual([bodies[0], bodies[0]]);
    expect(browser.entries()).toHaveLength(0);
    expect([...browser.data.values()].join()).not.toContain("Conteúdo privado");
    reopened.dispose();
  });

  it("o fechamento durante POST mantém registro mesmo se fetch ignora AbortSignal", async () => {
    const browser = journalBrowser(), delayed = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(delayed.promise);
    const first = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    const sending = first.commands.captures.create(input).catch(error => error);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1)); first.dispose();
    expect(await sending).toMatchObject({ code: "CLOSED" });
    expect(browser.entries()).toHaveLength(1);
    delayed.resolve(success());
    const next = createConnectedApplication(owner, { fetch: vi.fn<typeof fetch>().mockResolvedValue(success()), journal: browser.tab().journal });
    await next.initializeJournal(); expect(next.getCommandSnapshot()).toMatchObject({ status: "pending" });
    await next.retryPendingCommand(); expect(browser.entries()).toHaveLength(0); next.dispose();
  });

  it("duas abas preservam uma única pendência e propagam confirmação pelo client_id", async () => {
    const browser = journalBrowser();
    const lost = vi.fn<typeof fetch>().mockRejectedValue(new Error("lost"));
    const retry = vi.fn<typeof fetch>().mockResolvedValue(success());
    const a = createConnectedApplication(owner, { fetch: lost, journal: browser.tab().journal });
    const b = createConnectedApplication(owner, { fetch: retry, journal: browser.tab().journal });
    await Promise.all([a.initializeJournal(), b.initializeJournal()]);
    await expect(a.commands.captures.create(input)).rejects.toMatchObject({ outcomeUnknown: true });
    await vi.waitFor(() => expect(b.getCommandSnapshot()).toMatchObject({ status: "pending" }));
    await expect(b.commands.captures.create({ ...input, client_id: "tab-b-other" })).rejects.toMatchObject({ code: "PENDING_COMMAND" });
    expect(retry).not.toHaveBeenCalled(); expect(browser.entries()).toHaveLength(1);
    await b.retryPendingCommand();
    expect(retry.mock.calls[0]![1]!.body).toBe(lost.mock.calls[0]![1]!.body);
    await vi.waitFor(() => expect(a.getCommandSnapshot()).toMatchObject({ status: "confirmed", clientId: input.client_id }));
    await a.retryPendingCommand(); expect(lost).toHaveBeenCalledTimes(1);
    expect(browser.entries()).toHaveLength(0); a.dispose(); b.dispose();
  });

  it("a admissão simultânea entre abas não sobrescreve o comando cujo resultado é desconhecido", async () => {
    const browser = journalBrowser(), reply = deferred<Response>();
    const one = vi.fn<typeof fetch>().mockReturnValue(reply.promise), two = vi.fn<typeof fetch>();
    const a = createConnectedApplication(owner, { fetch: one, journal: browser.tab().journal });
    const b = createConnectedApplication(owner, { fetch: two, journal: browser.tab().journal });
    await Promise.all([a.initializeJournal(), b.initializeJournal()]);
    const first = a.commands.captures.create(input).catch(error => error);
    await vi.waitFor(() => expect(one).toHaveBeenCalledTimes(1));
    const second = b.commands.captures.create({ ...input, client_id: "different" }).catch(error => error);
    reply.resolve(json({ code: "COMMIT_UNKNOWN" }, 503));
    expect(await first).toMatchObject({ outcomeUnknown: true });
    expect(await second).toMatchObject({ code: "PENDING_COMMAND" });
    expect(two).not.toHaveBeenCalled();
    expect(JSON.parse(browser.entries()[0]![1])).toMatchObject({ clientId: input.client_id }); a.dispose(); b.dispose();
  });

  it.each(["confirmed", "unknown"])("drena storage durante GET pós-escrita e vê a escrita %s da outra aba", async outcome => {
    const browser = journalBrowser(), oldRead = deferred<Response>();
    let reads = 0;
    const newest = { ...capture, id: "second-capture", title: "Estado posterior de B" };
    const aFetch = vi.fn<typeof fetch>().mockImplementation(async (_url, request) => {
      if (request?.method === "POST") return success();
      return ++reads === 1 ? oldRead.promise : json({ items: [capture, newest], categories: [], projects: [] });
    });
    const bFetch = vi.fn<typeof fetch>().mockResolvedValue(outcome === "confirmed" ? json({ ok: true, result: newest }) : json({ code: "COMMIT_UNKNOWN" }, 503));
    const a = createConnectedApplication(owner, { fetch: aFetch, journal: browser.tab().journal });
    const b = createConnectedApplication(owner, { fetch: bFetch, journal: browser.tab().journal });
    await Promise.all([a.initializeJournal(), b.initializeJournal()]);
    a.subscribe("captures", () => undefined);
    const first = a.commands.captures.create(input);
    await vi.waitFor(() => expect(reads).toBe(1));
    await b.commands.captures.create({ ...input, client_id: "b-later" }).catch(() => undefined);
    oldRead.resolve(dto()); await first;
    await vi.waitFor(() => {
      expect(a.getCommandSnapshot()).toMatchObject(outcome === "confirmed" ? { status: "confirmed", clientId: "b-later" } : { status: "pending" });
      expect(a.getSnapshot("captures").data?.items).toHaveLength(2);
    });
    expect(aFetch.mock.calls.filter(([, request]) => request?.method === "POST")).toHaveLength(1);
    a.dispose(); b.dispose();
  });

  it("drena eventos que chegam durante o próprio GET de sincronização", async () => {
    const browser = journalBrowser(), outdated = deferred<Response>(); let reads = 0;
    const latest = { ...capture, title: "Confirmação da outra aba" };
    const a = createConnectedApplication(owner, { journal: browser.tab().journal,
      fetch: vi.fn<typeof fetch>().mockImplementation(async () => ++reads === 1 ? outdated.promise : json({ items: [latest], categories: [], projects: [] })) });
    const b = createConnectedApplication(owner, { journal: browser.tab().journal,
      fetch: vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("lost")).mockResolvedValueOnce(json({ ok: true, result: latest })) });
    await Promise.all([a.initializeJournal(), b.initializeJournal()]);
    a.subscribe("captures", () => undefined);
    await b.commands.captures.create(input).catch(() => undefined);
    await vi.waitFor(() => expect(reads).toBe(1));
    await b.retryPendingCommand(); outdated.resolve(dto());
    await vi.waitFor(() => {
      expect(a.getCommandSnapshot()).toMatchObject({ status: "confirmed", clientId: input.client_id });
      expect(a.getSnapshot("captures").data?.items[0]?.title).toBe(latest.title);
    }); a.dispose(); b.dispose();
  });

  it("logout invalida outras abas do mesmo usuário e preserva o journal da outra conta", async () => {
    const browser = journalBrowser(), failure = () => vi.fn<typeof fetch>().mockRejectedValue(new Error("lost"));
    const a = createConnectedApplication(owner, { fetch: failure(), journal: browser.tab().journal });
    const same = createConnectedApplication(owner, { fetch: failure(), journal: browser.tab().journal });
    const b = createConnectedApplication(other, { fetch: failure(), journal: browser.tab().journal });
    await same.initializeJournal();
    await a.commands.captures.create(input).catch(() => undefined);
    await b.commands.captures.create({ ...input, client_id: "other-user" }).catch(() => undefined);
    await a.clearSessionJournal();
    await vi.waitFor(() => expect(same.getCommandSnapshot()).toMatchObject({ status: "session-changed" }));
    expect(browser.entries()).toHaveLength(1);
    expect(JSON.parse(browser.entries()[0]![1])).toMatchObject({ userId: other, clientId: "other-user" });
    await expect(same.retryPendingCommand()).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    const reentry = createConnectedApplication(owner, { fetch: failure(), journal: browser.tab().journal });
    await reentry.initializeJournal(); expect(reentry.getCommandSnapshot()).toEqual({ status: "idle" });
    same.dispose(); b.dispose(); reentry.dispose();
  });

  it("logout aborta envio em voo e resposta tardia não recria o journal", async () => {
    const browser = journalBrowser(), delayed = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(delayed.promise);
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    const sending = app.commands.captures.create(input).catch(error => error);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await app.clearSessionJournal(); expect(await sending).toMatchObject({ code: "CLOSED" });
    delayed.resolve(success()); await Promise.resolve();
    expect(browser.entries()).toHaveLength(0);
    await expect(app.retryPendingCommand()).rejects.toMatchObject({ code: "CLOSED" });
  });

  it.each(["read", "write", "dropWrite", "locks"] as const)("%s indisponível impede POST e mantém leitura utilizável, sem revelar erro de storage", async failure => {
    const browser = journalBrowser(); browser.failures[failure] = true;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, request) => request?.method === "POST" ? success() : dto());
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    await expect(app.commands.captures.create(input)).rejects.toMatchObject({ code: "JOURNAL_UNAVAILABLE", outcomeUnknown: false });
    expect(app.getCommandSnapshot()).toMatchObject({ status: "journal-error" });
    expect(JSON.stringify(app.getCommandSnapshot())).not.toContain("private-storage-canary");
    expect(fetcher).not.toHaveBeenCalled();
    await app.load("captures"); expect(app.getSnapshot("captures").status).toBe("ready");
    browser.failures[failure] = false;
    await app.initializeJournal(); await app.commands.captures.create(input);
    expect(fetcher.mock.calls.filter(([, request]) => request?.method === "POST")).toHaveLength(1); app.dispose();
  });

  it.each(["version", "owner", "payload", "body-limit", "missing-epoch"])("corrupção de %s bloqueia restauração e nova escrita", async corruption => {
    const browser = journalBrowser();
    const first = createConnectedApplication(owner, { fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error("lost")), journal: browser.tab().journal });
    await first.commands.captures.create(input).catch(() => undefined); first.dispose();
    const [key, raw] = browser.entries()[0]!; const entry = JSON.parse(raw);
    if (corruption === "version") entry.version = 2;
    if (corruption === "owner") entry.userId = other;
    if (corruption === "payload") entry.body = JSON.stringify({ command: entry.command, input: { ...input, access_token: "secret-canary" } });
    if (corruption === "body-limit") entry.body = "x".repeat(600_000);
    if (corruption === "missing-epoch") { for (const stored of browser.data.keys()) if (stored.endsWith(":epoch")) browser.data.delete(stored); }
    browser.data.set(key, JSON.stringify(entry));
    const fetcher = vi.fn<typeof fetch>();
    const next = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    await expect(next.initializeJournal()).rejects.toMatchObject({ code: "JOURNAL_UNAVAILABLE" });
    await expect(next.commands.captures.create({ ...input, client_id: "new" })).rejects.toMatchObject({ code: "JOURNAL_UNAVAILABLE" });
    expect(fetcher).not.toHaveBeenCalled(); expect(browser.entries()).toHaveLength(1);
    expect(JSON.stringify(next.getCommandSnapshot())).not.toContain("secret-canary"); next.dispose();
  });

  it("falha ao apagar após sucesso conserva conteúdo original para replay seguro", async () => {
    const browser = journalBrowser();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { browser.failures.remove = true; return success(); });
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    await expect(app.commands.captures.create(input)).rejects.toMatchObject({ code: "JOURNAL_UNAVAILABLE", outcomeUnknown: true });
    expect(browser.entries()).toHaveLength(1);
    browser.failures.remove = false; fetcher.mockImplementation(async () => success());
    await app.initializeJournal(); await app.retryPendingCommand();
    expect(fetcher.mock.calls[0]![1]!.body).toBe(fetcher.mock.calls[1]![1]!.body);
    expect(browser.entries()).toHaveLength(0); app.dispose();
  });

  it.each([[401, "UNAUTHENTICATED"], [403, "FORBIDDEN"], [404, "NOT_FOUND"], [409, "CONFLICT"], [429, "RATE_LIMITED"]] as const)("primeira recusa HTTP %i libera o journal para outro payload e client_id", async (status, code) => {
    const browser = journalBrowser();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ code }, status)).mockResolvedValueOnce(success());
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    await expect(app.commands.captures.update({ id: "missing-record", client_id: "known-refusal", patch: { title: "Antes" } })).rejects.toMatchObject({ code, outcomeUnknown: false });
    expect(browser.entries()).toHaveLength(0);
    expect(app.getCommandSnapshot()).toEqual({ status: "idle" });
    await app.commands.captures.create({ ...input, client_id: "corrected-operation", title: "Novo conteúdo" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]!.body))).toMatchObject({ input: { client_id: "corrected-operation", title: "Novo conteúdo" } });
    expect(browser.entries()).toHaveLength(0); app.dispose();
  });

  it("UNKNOWN seguido de 429 conserva o diário e recusa alteração de payload", async () => {
    const browser = journalBrowser();
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("lost")).mockResolvedValueOnce(json({ code: "RATE_LIMITED" }, 429));
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    await expect(app.commands.captures.create(input)).rejects.toMatchObject({ outcomeUnknown: true });
    const before = browser.entries()[0]![1];
    await expect(app.retryPendingCommand()).rejects.toMatchObject({ code: "RATE_LIMITED", outcomeUnknown: false });
    expect(browser.entries()[0]![1]).toBe(before);
    expect(app.getCommandSnapshot()).toMatchObject({ status: "pending" });
    await expect(app.commands.captures.create({ ...input, client_id: "new", title: "Alterado" })).rejects.toMatchObject({ code: "PENDING_COMMAND" });
    expect(fetcher).toHaveBeenCalledTimes(2); app.dispose();
  });

  it("remoção atrasada de um client_id não apaga outro envio e metadados não crescem", async () => {
    const browser = journalBrowser(), journal = browser.tab().journal(owner);
    await journal.open();
    const original = await journal.exclusive(async () => journal.stage("capture.create", input).entry);
    await journal.exclusive(async () => journal.finish(original, "confirmed", capture.id));
    const next = await journal.exclusive(async () => journal.stage("capture.create", { ...input, client_id: "next" }).entry);
    await expect(journal.exclusive(async () => journal.finish(original, "confirmed", capture.id))).rejects.toMatchObject({ code: "CORRUPT" });
    expect(journalInput(journal.snapshot().entries[0]!)).toMatchObject({ client_id: "next" });
    await journal.exclusive(async () => journal.finish(next, "rejected", null));
    expect(browser.entries()).toHaveLength(0);
    expect([...browser.data.keys()].filter(key => key.endsWith(":settled"))).toHaveLength(1);
  });

  it("uma aba sem eventos recupera a resolução própria após várias confirmações", async () => {
    const browser = journalBrowser(), tab = browser.tab();
    const sleeping = createConnectedApplication(owner, { fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error("lost")),
      journal: user => new CommandJournal(user, { ...tab.environment, subscribe: () => () => undefined }) });
    await sleeping.commands.captures.create(input).catch(() => undefined);
    const journal = browser.tab().journal(owner); await journal.open();
    await journal.exclusive(async () => journal.finish(journal.snapshot().entries[0]!, "confirmed", capture.id));
    for (let index = 0; index < 4; index++) await journal.exclusive(async () => {
      const entry = journal.stage("capture.create", { ...input, client_id: `later-${index}` }).entry;
      journal.finish(entry, "confirmed", `capture-${index}`);
    });
    await sleeping.initializeJournal();
    expect(sleeping.getCommandSnapshot()).toMatchObject({ status: "confirmed", clientId: input.client_id });
    sleeping.dispose();
    for (let index = 4; index < 40; index++) await journal.exclusive(async () => {
      const entry = journal.stage("capture.create", { ...input, client_id: `later-${index}` }).entry;
      journal.finish(entry, "confirmed", `capture-${index}`);
    });
    expect(journal.snapshot().settlements).toHaveLength(32);
  });

  it("logout repetido de aba revogada não apaga comando de um login novo do mesmo usuário", async () => {
    const browser = journalBrowser(), previous = browser.tab().journal(owner);
    await previous.open(); await previous.revoke();
    const current = browser.tab().journal(owner); await current.open();
    await current.exclusive(async () => current.stage("capture.create", input));
    await previous.revoke();
    expect(current.snapshot().entries[0]?.clientId).toBe(input.client_id);
  });

  it("cleanup E1→E2 suspenso não apaga o envio E3 ao retomar depois de outro logout/login", async () => {
    const browser = journalBrowser(), tab = browser.tab(), resume = deferred<void>();
    let suspended = false;
    const previous = new CommandJournal(owner, { ...tab.environment,
      async lock<T>(name: string, signal: AbortSignal, operation: () => Promise<T>) {
        if (suspended) await resume.promise;
        return tab.environment.lock(name, signal, operation);
      },
    });
    await previous.open();
    await previous.exclusive(async () => previous.stage("capture.create", input));
    suspended = true;
    const oldCleanup = previous.revoke(); // Rotates E1→E2; cleanup has not acquired its lock.
    const middle = browser.tab().journal(owner); await middle.open();
    await middle.revoke(); // E2→E3 while the old cleanup is suspended.
    const current = browser.tab().journal(owner); await current.open();
    const live = await current.exclusive(async () => current.stage("capture.create", { ...input, title: "Envio do login E3" }).entry);
    const before = browser.entries()[0]![1];
    resume.resolve(undefined); await oldCleanup;
    expect(browser.entries()[0]![1]).toBe(before);
    expect(current.snapshot().entries).toEqual([live]);
  });

  it("ACK fora do histórico exige retry explícito e novo write-ahead do mesmo envio", async () => {
    const browser = journalBrowser(), tab = browser.tab();
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("lost")).mockImplementation(async (_url, request) => {
      expect(JSON.parse(browser.entries()[0]![1]).body).toBe(request?.body);
      return success();
    });
    const sleeping = createConnectedApplication(owner, { fetch: fetcher,
      journal: user => new CommandJournal(user, { ...tab.environment, subscribe: () => () => undefined }) });
    await sleeping.commands.captures.create(input).catch(() => undefined);
    const journal = browser.tab().journal(owner); await journal.open();
    await journal.exclusive(async () => journal.finish(journal.snapshot().entries[0]!, "confirmed", capture.id));
    for (let index = 0; index < 40; index++) await journal.exclusive(async () => {
      journal.finish(journal.stage("capture.create", { ...input, client_id: `later-${index}` }).entry, "confirmed", `capture-${index}`);
    });
    await sleeping.initializeJournal();
    expect(sleeping.getCommandSnapshot()).toMatchObject({ status: "pending" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(sleeping.commands.captures.create({ ...input, client_id: "must-not-replace-original" })).rejects.toMatchObject({ code: "PENDING_COMMAND" });
    await sleeping.retryPendingCommand();
    expect(fetcher.mock.calls[1]![1]!.body).toBe(fetcher.mock.calls[0]![1]!.body);
    expect(sleeping.getCommandSnapshot()).toMatchObject({ status: "confirmed", clientId: input.client_id });
    expect(browser.entries()).toHaveLength(0); sleeping.dispose();
  });

  it("timeout de Web Lock falha fechado e logout não espera indefinidamente", async () => {
    vi.useFakeTimers();
    const browser = journalBrowser(), tab = browser.tab();
    const environment = { ...tab.environment, lock: <T>(_name: string, signal: AbortSignal): Promise<T> => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })) };
    const journal = new CommandJournal(owner, environment);
    const app = createConnectedApplication(owner, { fetch: vi.fn<typeof fetch>(), journal: () => journal });
    const opening = app.initializeJournal().catch(error => error);
    await vi.advanceTimersByTimeAsync(25_001); expect(await opening).toMatchObject({ code: "JOURNAL_UNAVAILABLE" });
    const ending = app.clearSessionJournal().catch(error => error);
    await vi.advanceTimersByTimeAsync(1501); expect(await ending).toMatchObject({ code: "UNAVAILABLE" });
  });

  it("timeout de fetch que ignora AbortSignal libera Web Lock e conserva o envio", async () => {
    vi.useFakeTimers();
    const browser = journalBrowser(), fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => undefined));
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    await app.initializeJournal();
    const sending = app.commands.captures.create(input).catch(error => error);
    await vi.advanceTimersByTimeAsync(0); expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_001);
    expect(await sending).toMatchObject({ outcomeUnknown: true });
    const next = browser.tab().journal(owner);
    await next.open(); expect(next.snapshot().entries[0]?.clientId).toBe(input.client_id); app.dispose();
  });

  it("não serializa tokens, anexos ou valores não JSON; limite conta bytes UTF-8", () => {
    for (const value of [{ ...input, token: "private" }, { ...input, attachments: [{ url: "signed" }] }, { ...input, content: undefined }]) expect(() => journalBody("capture.create", value)).toThrow();
    expect(() => journalBody("capture.create", { ...input, title: "👋".repeat(15000), content: "👋".repeat(15000), linked_capture_ids: Array.from({ length: 1000 }, () => "a".repeat(200)) })).toThrow();
  });
});
