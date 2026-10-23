import type { BrowserContext, Page, Route } from "@playwright/test";
import { assinatura, ErroDeDominio } from "../../../src/core/contracts/base";
import type { ContaFinanceira } from "../../../src/core/financeiro/fused";
import { definitionOfSeries } from "../../../src/core/financeiro/series/series-planning";
import type { FinanceSeriesPreview, FinanceSeriesPreviewData } from "../../../src/core/financeiro/series/series-preview-types";
import { decodeSeriesAvailability, decodeSeriesDetail, decodeSeriesPage, decodeSeriesPreview, decodeSeriesResult } from "../../../src/core/financeiro/series/series-public-validation";
import type { FinanceSeriesCommand, FinanceSeriesResult, ManagedFinanceSeries, SeriesTemplate } from "../../../src/core/financeiro/series/series-types";
import { executeFinanceSeriesCommand } from "../../../src/core/financeiro/series/series-use-cases";
import { decodeFinanceSeriesCommand } from "../../../src/core/financeiro/series/series-validation";
import type { DemoQueries } from "../../../src/lib/demo/types";
import { SeriesMemoryFixture } from "../../fixtures/finance-series-store";
import { managedSeries, SERIES_NOW, SERIES_OWNER, seriesAccount, seriesCategory, seriesId } from "../../fixtures/finance-series";

export const financeSeriesOrigin = "https://finance-series.synthetic.invalid";
export const financeSeriesOwner = SERIES_OWNER;
export const financeSeriesOtherOwner = seriesId(9999);
const endpoint = "/api/finance/series", cookieName = "__Host-finance-series-synthetic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const copy = <T>(value: T): T => structuredClone(value);
export type FinanceSeriesSyntheticFailure = "FORBIDDEN" | "SESSION_CHANGED" | "UNAVAILABLE" | "COMMIT_UNKNOWN" | "CONFLICT" | "NOT_FOUND" | "VALIDATION" | "UNAUTHENTICATED";
type ApiKind = "availability" | "page" | "detail" | "preview" | "write";
export interface FinanceSeriesHttpRequest {
  method: string; url: string; path: string; body: string | null;
  expectedOwner: string | null; authenticatedOwner: string | null; kind: ApiKind | "navigation" | "blocked"; status: number | "aborted" | null;
}
export interface FinanceSeriesHttpCommand { body: string; command: FinanceSeriesCommand; clientId: string; ownerId: string; result: FinanceSeriesResult | null; effects: string[] }
export interface FinanceSeriesReplyGate {
  /** Resolves only after the original write has committed (or failed). */
  reached: Promise<void>;
  /** Wait after releasing: the route has fulfilled/aborted or recorded its error. */
  settled: Promise<void>; releaseSuccess(): void; releaseError(code?: FinanceSeriesSyntheticFailure): void;
}
interface ReplyGate { reached(): void; settled(): void; terminal: Promise<FinanceSeriesSyntheticFailure | null> }
const statuses: Record<FinanceSeriesSyntheticFailure, number> = { FORBIDDEN: 403, SESSION_CHANGED: 409, UNAVAILABLE: 503, COMMIT_UNKNOWN: 503, CONFLICT: 409, NOT_FOUND: 404, VALIDATION: 400, UNAUTHENTICATED: 401 };

/** Closed, disposable HTTP/Core seam. The cookie is deliberately synthetic;
 * this exercises browser cookies and expected-owner binding, never Auth/SQL/RLS. */
export function createFinanceSeriesScenario() {
  const card: ContaFinanceira = { ...copy(seriesAccount), id: seriesId(20), name: "Cartão sintético", kind: "credit_card", credit_limit_cents: 200000, statement_closing_day: 15, payment_due_day: 25 };
  const store = new SeriesMemoryFixture({ accounts: [seriesAccount, card] });
  const stores: Record<string, SeriesMemoryFixture> = { [financeSeriesOwner]: store };
  const trace = { requests: [] as FinanceSeriesHttpRequest[], commands: [] as FinanceSeriesHttpCommand[], previews: [] as FinanceSeriesHttpCommand[],
    violations: [] as string[], errors: [] as string[], effects: [] as string[], receipts: [] as string[], replies: 0 };
  let context: BrowserContext | null = null, attached = false, available = true, sessionOwner = financeSeriesOwner, sequence = 1000;
  let nextWriteRejection: FinanceSeriesSyntheticFailure | null = null, nextPreviewRejection: FinanceSeriesSyntheticFailure | null = null;
  let loseReply = false, nextGate: ReplyGate | null = null;
  const originalBodies = new Map<string, string>();
  const nextId = () => seriesId(++sequence);
  const dependencies = { clock: { now: () => SERIES_NOW }, ids: { next: nextId } };
  const actor = { user_id: financeSeriesOwner, canal: "web" as const };
  const financeData = (): DemoQueries["finance"] => sessionOwner === financeSeriesOwner
    ? copy({ accounts: store.accounts, categories: [seriesCategory], tags: [], transactions: store.state.transactions, budgets: [] })
    : { accounts: [], categories: [], tags: [], transactions: [], budgets: [] };
  const fail = (code: FinanceSeriesSyntheticFailure) => ({ ok: false, code, message: code === "SESSION_CHANGED" ? "A conta mudou em outra aba. Recarregue a página." : "Resposta controlada da API sintética de séries." });
  const violation = async (route: Route, request: FinanceSeriesHttpRequest, code: string) => {
    trace.violations.push(code); request.status = "aborted"; await route.abort("blockedbyclient");
  };
  const projection = (series: ManagedFinanceSeries | null, request: FinanceSeriesCommand | null): FinanceSeriesPreviewData => {
    const occurrences = series ? store.state.occurrences.filter(row => row.user_id === financeSeriesOwner && row.series_id === series.id) : [];
    const transactionIds = new Set(occurrences.map(row => row.transaction_id));
    const transactions = store.state.transactions.filter(row => row.user_id === financeSeriesOwner && transactionIds.has(row.id));
    const references = { accounts: new Set<string>(), categories: new Set<string>(), tags: new Set<string>() };
    const template = (value: SeriesTemplate) => { references.accounts.add(value.account_id); if (value.category_id !== null) references.categories.add(value.category_id); value.tag_ids.forEach(id => references.tags.add(id)); };
    if (series) template(series.template);
    for (const row of transactions) { references.accounts.add(row.account_id); if (row.category_id !== null) references.categories.add(row.category_id); (row.tag_ids ?? []).forEach(id => references.tags.add(id)); }
    if (request?.command === "finance.recurring.create") template(request.input.definition.template);
    if (request?.command === "finance.recurring.update_future" && request.input.patch.template) template(request.input.patch.template);
    return copy({ series, occurrences, transactions, accounts: store.accounts.filter(row => references.accounts.has(row.id)), categories: [seriesCategory].filter(row => references.categories.has(row.id)), tags: [] });
  };
  const preview = (request: FinanceSeriesCommand, ownerId: string): FinanceSeriesPreview => {
    const receipt = store.state.receipts.find(row => row.user_id === ownerId && row.command === request.command && row.client_id === request.input.client_id);
    const binding = { version: 2 as const, command: request.command, client_id: request.input.client_id };
    if (receipt) {
      if (receipt.fingerprint !== assinatura(request.input)) throw new ErroDeDominio("CONFLICT", "A intenção original divergiu.");
      return decodeSeriesPreview({ ...binding, kind: "confirmed", result: receipt.result }, ownerId, request);
    }
    const targetSeriesId = request.command === "finance.recurring.create" ? null : request.input.series_id;
    const series = targetSeriesId === null ? null : store.state.series.find(row => row.user_id === ownerId && row.id === targetSeriesId) ?? null;
    if (request.command !== "finance.recurring.create" && !series) throw new ErroDeDominio("NOT_FOUND", "Série ausente.");
    const requestedSeries = request.command === "finance.recurring.create" ? null : request.input.expected_revision;
    const observedSeries = series?.revision ?? null;
    return decodeSeriesPreview({ ...binding, kind: "review", today: "2026-10-23", consistency: request.input.expected_finance_revision === store.state.revision && requestedSeries === observedSeries ? "same" : "changed",
      revisions: { requested_finance: request.input.expected_finance_revision, observed_finance: store.state.revision, requested_series: requestedSeries, observed_series: observedSeries }, data: projection(series, request) }, ownerId, request);
  };
  async function setSessionOwner(ownerId: string) {
    if (![financeSeriesOwner, financeSeriesOtherOwner].includes(ownerId)) throw new Error("UNDECLARED_SYNTHETIC_OWNER");
    sessionOwner = ownerId;
    await context?.addCookies([{ name: cookieName, value: ownerId, url: financeSeriesOrigin, secure: true, httpOnly: true, sameSite: "Strict" }]);
  }
  async function seed(kind: "common" | "card" | "paused") {
    if (store.state.series.length || trace.requests.length) throw new Error("SEED_REQUIRES_EMPTY_UNMOUNTED_SCENARIO");
    const total = kind === "paused" ? 6 : 4;
    const definition = definitionOfSeries(managedSeries({ total }));
    if (kind === "card") definition.template = { ...definition.template, account_id: card.id, statement_mode: "account_cycle" };
    let result = await executeFinanceSeriesCommand(store, dependencies, actor, { command: "finance.recurring.create", input: { client_id: nextId(), expected_finance_revision: store.state.revision, definition,
      horizon: { from_on: "2026-10-23", until_exclusive: kind === "paused" ? "2027-04-23" : "2027-02-23" }, statement_assignments: [] } });
    if (kind === "paused") {
      const first = store.state.occurrences.find(row => row.index === 1)!, second = store.state.occurrences.find(row => row.index === 2)!;
      const base = () => ({ client_id: nextId(), expected_finance_revision: store.state.revision, series_id: result.series.id, expected_revision: result.series.revision });
      result = await executeFinanceSeriesCommand(store, dependencies, actor, { command: "finance.recurring.occurrence.cancel", input: { ...base(), occurrence_id: first.id } });
      result = await executeFinanceSeriesCommand(store, dependencies, actor, { command: "finance.recurring.occurrence.update", input: { ...base(), occurrence_id: second.id, patch: { status: "confirmed", paid_cents: 5000 } } });
      result = await executeFinanceSeriesCommand(store, dependencies, actor, { command: "finance.recurring.pause", input: { ...base(), from_on: "2026-10-23" } });
    }
    return copy(result.series);
  }
  async function attach(page: Page, theme: "light" | "dark") {
    if (attached) throw new Error("SYNTHETIC_API_ALREADY_ATTACHED"); attached = true; context = page.context();
    const watch = (target: Page) => target.on("pageerror", error => trace.errors.push(error.message));
    context.pages().forEach(watch); context.on("page", watch); await setSessionOwner(sessionOwner);
    // A context route also closes requests from a second tab in logout tests.
    await context.route("**/*", async route => {
      const http = route.request(), url = new URL(http.url()), headers = await http.allHeaders();
      const cookies = (headers.cookie ?? "").split(";").map(value => value.trim()).filter(value => value.startsWith(cookieName + "="));
      const authenticatedOwner = cookies.length === 1 ? cookies[0]!.slice(cookieName.length + 1) : null;
      const kind: FinanceSeriesHttpRequest["kind"] = url.pathname === endpoint + "/availability" ? "availability" : url.pathname === endpoint + "/preview" ? "preview" : url.pathname === endpoint ? http.method() === "POST" ? "write" : url.searchParams.has("series_id") ? "detail" : "page" : "blocked";
      const captured: FinanceSeriesHttpRequest = { method: http.method(), url: url.href, path: url.pathname + url.search, body: http.postData(), expectedOwner: headers["x-expected-user-id"] ?? null, authenticatedOwner, kind, status: null };
      trace.requests.push(captured);
      const json = async (value: unknown, status = 200) => {
        const body = JSON.stringify(value);
        if (new TextEncoder().encode(body).length > 4 * 1024 * 1024) { await violation(route, captured, "RESPONSE_QUOTA"); return; }
        captured.status = status; await route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" }, body }); trace.replies++;
      };
      const reject = (code: FinanceSeriesSyntheticFailure) => json(fail(code), statuses[code]);
      if (url.origin !== financeSeriesOrigin) { await violation(route, captured, "FOREIGN_ORIGIN"); return; }
      if (http.isNavigationRequest() && http.method() === "GET" && url.pathname === "/financeiro" && !url.search && !url.hash) {
        captured.kind = "navigation"; captured.status = 200;
        await route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="pt-BR" data-theme="${theme}" data-account-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Séries financeiras sintéticas</title></head><body><div id="finance-series-root"></div></body></html>` }); return;
      }
      if (![endpoint, endpoint + "/availability", endpoint + "/preview"].includes(url.pathname)) { await violation(route, captured, "UNDECLARED_PATH"); return; }
      if (authenticatedOwner === null || ![financeSeriesOwner, financeSeriesOtherOwner].includes(authenticatedOwner)) { await violation(route, captured, "SYNTHETIC_COOKIE_MISSING_OR_INVALID"); return; }
      if (authenticatedOwner !== sessionOwner) { await reject("SESSION_CHANGED"); return; }
      if (!captured.expectedOwner || !uuid.test(captured.expectedOwner)) { await violation(route, captured, "EXPECTED_OWNER_HEADER_MISSING"); return; }
      if (captured.expectedOwner !== authenticatedOwner) { await reject("SESSION_CHANGED"); return; }
      if (http.method() === "POST" && (headers.origin !== financeSeriesOrigin || headers["content-type"] !== "application/json")) { await violation(route, captured, "POST_ORIGIN_OR_CONTENT_TYPE"); return; }
      const keys = [...url.searchParams.keys()];
      if (new Set(keys).size !== keys.length) { await violation(route, captured, "DUPLICATE_QUERY"); return; }
      if (url.pathname === endpoint + "/availability" && http.method() === "GET" && !url.search) {
        captured.kind = "availability"; await json({ ok: true, result: decodeSeriesAvailability({ version: 2, available }) }); return;
      }
      if (!available) { await reject("UNAVAILABLE"); return; }
      let consumedGate: ReplyGate | null = null;
      try {
        if (url.pathname === endpoint && http.method() === "GET") {
          if (url.searchParams.has("series_id")) {
            captured.kind = "detail"; const id = url.searchParams.get("series_id")!;
            if (keys.length !== 1 || !uuid.test(id)) { await violation(route, captured, "INVALID_DETAIL_QUERY"); return; }
            const series = authenticatedOwner === financeSeriesOwner ? store.state.series.find(row => row.id === id && row.user_id === authenticatedOwner) : null;
            if (!series) { await reject("NOT_FOUND"); return; }
            await json({ ok: true, result: decodeSeriesDetail({ ...projection(series, null), version: 2, finance_revision: store.state.revision }, authenticatedOwner, id) }); return;
          }
          captured.kind = "page"; const rawLimit = url.searchParams.get("limit"), cursor = url.searchParams.get("cursor"), limit = rawLimit === null ? 20 : Number(rawLimit);
          if (keys.some(key => !["limit", "cursor"].includes(key)) || rawLimit !== null && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(rawLimit) || cursor !== null && !uuid.test(cursor)) { await violation(route, captured, "INVALID_PAGE_QUERY"); return; }
          const rows = authenticatedOwner === financeSeriesOwner ? store.state.series.filter(row => row.user_id === authenticatedOwner && (cursor === null || row.id > cursor)).sort((a, b) => a.id.localeCompare(b.id)) : [];
          const items = rows.slice(0, limit), next_cursor = rows.length > limit ? items.at(-1)!.id : null;
          await json({ ok: true, result: decodeSeriesPage({ version: 2, finance_revision: authenticatedOwner === financeSeriesOwner ? store.state.revision : "0", items, next_cursor }, authenticatedOwner, { cursor, limit }) }); return;
        }
        if (http.method() !== "POST" || url.search || ![endpoint, endpoint + "/preview"].includes(url.pathname)) { await violation(route, captured, "UNDECLARED_METHOD_OR_QUERY"); return; }
        captured.kind = url.pathname === endpoint ? "write" : "preview";
        if (authenticatedOwner !== financeSeriesOwner) { await reject("FORBIDDEN"); return; }
        const body = http.postData(); if (body === null || new TextEncoder().encode(body).length > 64 * 1024) { await violation(route, captured, "INVALID_COMMAND_BODY"); return; }
        const command = decodeFinanceSeriesCommand(JSON.parse(body));
        const entry: FinanceSeriesHttpCommand = { body, command: copy(command), clientId: command.input.client_id, ownerId: authenticatedOwner, result: null, effects: [] };
        if (captured.kind === "preview") {
          trace.previews.push(entry); const rejection = nextPreviewRejection; nextPreviewRejection = null;
          if (rejection) await reject(rejection); else await json({ ok: true, result: preview(command, authenticatedOwner) }); return;
        }
        trace.commands.push(entry); const rejection = nextWriteRejection; nextWriteRejection = null;
        if (rejection) { await reject(rejection); return; }
        const receiptKey = authenticatedOwner + ":" + command.command + ":" + command.input.client_id;
        if (originalBodies.has(receiptKey) && originalBodies.get(receiptKey) !== body) { await violation(route, captured, "RETRY_BODY_CHANGED"); return; }
        const held = nextGate; nextGate = null; consumedGate = held; const lose = loseReply; loseReply = false;
        const eventsBefore = store.state.events.length, receiptsBefore = store.state.receipts.length;
        let result: FinanceSeriesResult | null = null, terminal: FinanceSeriesSyntheticFailure | null = null;
        try {
          result = decodeSeriesResult(await executeFinanceSeriesCommand(store, dependencies, actor, command), authenticatedOwner, command);
          entry.result = copy(result); entry.effects = store.state.events.slice(eventsBefore).map(event => event.id); trace.effects.push(...entry.effects);
          trace.receipts.push(...store.state.receipts.slice(receiptsBefore).map(receipt => receipt.client_id)); originalBodies.set(receiptKey, body);
        } catch (error) {
          if (error instanceof ErroDeDominio) terminal = error.code === "CONFLICT" || error.code === "NOT_FOUND" ? error.code : "VALIDATION";
          else { trace.errors.push(error instanceof Error ? error.message : String(error)); terminal = "UNAVAILABLE"; }
        }
        if (held) { held.reached(); const override = await held.terminal; if (override !== null) terminal = override; }
        if (lose && result !== null) { captured.status = "aborted"; await route.abort("failed"); return; }
        if (terminal) await reject(terminal); else await json({ ok: true, result });
      } catch (error) {
        if (error instanceof ErroDeDominio) await reject(error.code === "CONFLICT" || error.code === "NOT_FOUND" ? error.code : "VALIDATION");
        else { trace.errors.push(error instanceof Error ? error.message : String(error)); await reject("UNAVAILABLE"); }
      } finally { consumedGate?.settled(); }
    });
  }
  return { ownerId: financeSeriesOwner, store, stores, trace, seed, setSessionOwner, attach,
    get seriesId() { return store.state.series[0]?.id ?? null; }, get sessionOwner() { return sessionOwner; },
    get financeData() { return financeData(); }, get serializableFinanceData() { return financeData(); },
    get available() { return available; }, setAvailable(value: boolean) { available = value; },
    commands(kind?: FinanceSeriesCommand["command"]) { return trace.commands.filter(entry => kind === undefined || entry.command.command === kind); },
    rejectNextWrite(code: FinanceSeriesSyntheticFailure = "FORBIDDEN") { if (nextWriteRejection) throw new Error("WRITE_REJECTION_ALREADY_ARMED"); nextWriteRejection = code; },
    rejectNextPreview(code: FinanceSeriesSyntheticFailure = "FORBIDDEN") { if (nextPreviewRejection) throw new Error("PREVIEW_REJECTION_ALREADY_ARMED"); nextPreviewRejection = code; },
    loseNextWriteReply() { if (loseReply) throw new Error("LOST_REPLY_ALREADY_ARMED"); loseReply = true; },
    deferNextWriteReply(): FinanceSeriesReplyGate {
      if (nextGate) throw new Error("WRITE_GATE_ALREADY_ARMED");
      let reached!: () => void, settled!: () => void, release!: (code: FinanceSeriesSyntheticFailure | null) => void;
      const ready = new Promise<void>(resolve => { reached = resolve; }), done = new Promise<void>(resolve => { settled = resolve; });
      const terminal = new Promise<FinanceSeriesSyntheticFailure | null>(resolve => { release = resolve; });
      nextGate = { reached, settled, terminal }; return { reached: ready, settled: done, releaseSuccess() { release(null); }, releaseError(code = "UNAVAILABLE") { release(code); } };
    },
    advanceFinanceRevision() { store.state.revision = String(BigInt(store.state.revision) + 1n); return store.state.revision; },
    async pauseExternally() {
      const series = store.state.series[0]; if (!series) throw new Error("EXTERNAL_PAUSE_REQUIRES_SERIES");
      return executeFinanceSeriesCommand(store, dependencies, actor, { command: "finance.recurring.pause", input: {
        client_id: nextId(), expected_finance_revision: store.state.revision, series_id: series.id, expected_revision: series.revision, from_on: "2026-10-23",
      } });
    },
  };
}
export type FinanceSeriesScenario = ReturnType<typeof createFinanceSeriesScenario>;
export async function attachFinanceSeriesApi(page: Page, theme: "light" | "dark", scenario = createFinanceSeriesScenario()) { await scenario.attach(page, theme); return scenario; }
