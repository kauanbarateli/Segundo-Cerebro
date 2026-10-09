import { describe, expect, it, vi } from "vitest";
import { createConnectedApplication } from "../../src/lib/demo/connected-application";
import { journalBody } from "../../src/lib/demo/command-journal";
import { journalBrowser } from "./helpers/journal-browser";
const owner = "10000000-0000-4000-8000-000000000001";
const json = (value: unknown) => new Response(JSON.stringify(value));
describe("diário integrado dos novos módulos", () => {
  it("recupera uma transferência com o JSON original após reload e bloqueia uma edição de conhecimento concorrente", async () => {
    const browser = journalBrowser(), bodies: string[] = [];
    const input = { client_id: "transfer-original", from_account_id: "cash", to_account_id: "savings", amount_cents: 1937, occurred_on: "2026-10-09", description: "Reserva" };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, request) => {
      expect(url).toBe("/api/finance"); bodies.push(String(request?.body));
      expect(JSON.parse(browser.entries()[0]![1]).body).toBe(request?.body);
      if (bodies.length === 1) throw new Error("lost");
      return json({ ok: true, result: { group_id: "group", transactions: [{ id: "out", user_id: owner }, { id: "in", user_id: owner }] } });
    });
    const first = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    await expect(first.commands.finance.transfers.create(input)).rejects.toMatchObject({ outcomeUnknown: true }); first.dispose();
    const next = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal }); await next.initializeJournal();
    await expect(next.executeDomainCommand("knowledge.notebook.create", { client_id: "new", name: "Caderno" })).rejects.toMatchObject({ code: "PENDING_COMMAND" });
    expect(bodies).toHaveLength(1); await next.retryPendingCommand(); expect(bodies[1]).toBe(bodies[0]); expect(browser.entries()).toHaveLength(0); expect(next.getCommandSnapshot()).toMatchObject({ href: "/financeiro" }); next.dispose();
  });
  it("não confirma retorno composto que inclui outra conta", async () => {
    const browser = journalBrowser(), app = createConnectedApplication(owner, { journal: browser.tab().journal, fetch: vi.fn<typeof fetch>().mockResolvedValue(json({ ok: true, result: { page: { id: "page", user_id: owner }, target: { id: "target", user_id: "other" } } })) });
    await expect(app.executeDomainCommand("knowledge.page.resolve-ref", { client_id: "resolve", id: "page", alias: "Destino" })).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    app.dispose();
  });
  it("não guarda credenciais ocultas em JSONs aninhados nem operações administrativas", () => {
    expect(() => journalBody("finance.series.create", { client_id: "series", fields: { amount_cents: 10, notes: { refresh_token: "canary" } }, serie_tipo: "parcelamento", count: 12 })).toThrow();
    expect(() => journalBody("knowledge.page.update", { client_id: "edit", id: "id", expected_version: 1, title: "Nota", document: { type: "doc", attrs: { authorization: "canary" } } })).toThrow();
    expect(() => journalBody("admin.user.create", { client_id: "create", email: "user@example.invalid", temporary_password: "canary" })).toThrow();
  });
  it("aceita um documento Knowledge acima de256KiB e limita comandos dos outros módulos", () => {
    const document = { type: "doc", content: Array.from({ length: 4 }, () => ({ type: "paragraph", content: [{ type: "text", text: "x".repeat(70000) }] })) };
    const body = journalBody("knowledge.page.update", { client_id: "large", id: "id", expected_version: 1, title: "Nota", document }); expect(body.length).toBeGreaterThan(256 * 1024);
    expect(() => journalBody("finance.transaction.create", { client_id: "large", notes: "x".repeat(280000) })).toThrow();
  });
  it("usa configurações com cookie e sem plantar dados financeiros de exemplo", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ accounts: [], categories: [], transactions: [], budgets: [], tags: [] }));
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: journalBrowser().tab().journal }); await app.load("finance");
    expect(fetcher).toHaveBeenCalledWith("/api/finance", expect.objectContaining({ credentials: "same-origin", cache: "no-store", headers: expect.objectContaining({ "X-Expected-User-ID": owner }) }));
    expect(app.getSnapshot("finance").data?.accounts).toEqual([]); app.dispose();
  });
  it("atualiza preferências de lembretes na agenda ativa depois de salvar", async () => {
    const browser = journalBrowser();
    const settings = { user_id: owner, profile: { display_name: "Nome", email: null, avatar_file_id: null }, preferences: { theme: "system", default_calendar_view: "week", values_hidden: true, meeting_reminders_enabled: false, meeting_reminder_minutes: 10 }, modules: [{ module_key: "inicio", visible: true, sort_order: 0 }] };
    let enabled = true;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, options) => {
      if (url === "/api/settings" && options?.method === "POST") { enabled = false; return json({ ok: true, result: settings }); }
      if (url === "/api/calendar") return json({ items: [], calendars: [], accounts: [], sync_runs: [], window: null, preferences: { ...settings.preferences, meeting_reminders_enabled: enabled } });
      throw new Error("Unexpected fixture route");
    });
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: browser.tab().journal });
    const stop = app.subscribe("agenda", () => undefined); await app.load("agenda");
    expect(app.getSnapshot("agenda").data?.preferences?.meeting_reminders_enabled).toBe(true);
    await app.executeDomainCommand("settings.preferences.update", { client_id: "disable-reminders", patch: { meeting_reminders_enabled: false } });
    expect(app.getSnapshot("agenda").data?.preferences?.meeting_reminders_enabled).toBe(false);
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/calendar")).toHaveLength(2); stop(); app.dispose();
  });
  it("notifica leitura de relacionados sem depender de carregar o snapshot de Knowledge", async () => {
    const fileId = "10000000-0000-4000-8000-000000000003";
    const browser = journalBrowser(), listener = vi.fn(), app = createConnectedApplication(owner, { journal: browser.tab().journal, fetch: vi.fn<typeof fetch>().mockResolvedValue(json({ ok: true, result: { id: fileId, user_id: owner } })) });
    const stop = app.subscribeInvalidations!(listener); app.subscribeInvalidations!(() => { throw new Error("presentation only"); });
    await expect(app.executeDomainCommand("drive.file.update", { client_id: "rename-file", id: fileId, name: "Novo título" })).resolves.toMatchObject({ id: fileId });
    expect(listener).toHaveBeenCalledWith(expect.arrayContaining(["drive", "knowledge"]));
    expect(browser.entries()).toHaveLength(0); stop(); app.dispose();
  });
});
