import { assinatura } from "../core/contracts/base";
import type { GoalCommand, GoalCommandResult, GoalHighlight, GoalReleaseTotals, GoalTotals } from "../core/financeiro/goals/goal-types";
import { decodeFinancialGoal, decodeGoalCommand, decodeGoalHighlight, decodeGoalRelease, decodeGoalReservation, goalCents, goalRecord, goalRevision, goalTimestamp, goalUuid } from "../core/financeiro/goals/goal-validation";
import { decodeGoalCommandResult } from "../core/financeiro/goals/goal-use-cases";
import type { FinanceGoalsClient as GoalsClientPort, GoalDetailView, GoalFailure, GoalFailureCode, GoalHistoryCursor, GoalHistoryQuery, GoalJournalView, GoalPageQuery, GoalPageView, GoalPrepared, GoalReleasesView, GoalReply, GoalReservationsView } from "./finance-goals-client-contract";
import { GOAL_HTTP_EXPECTED_OWNER_HEADER, GOAL_HTTP_FAILURE_CODES, GOAL_HTTP_LIMITS, GOAL_HTTP_PATHS } from "./finance-goals-http-contract";
import { browserFinanceGoalsJournal, FinanceGoalsJournal, GoalsJournalError } from "./finance-goals-journal";

type Fetcher = (path: string, init: RequestInit) => Promise<Response>;
export interface GoalsClientOptions { fetcher?: Fetcher; isCurrent?: () => boolean; origin?: string; timeoutMs?: number }
class ClientFault extends Error { constructor(readonly code: GoalFailureCode) { super(code); } }
const messages: Record<GoalFailureCode, string> = {
  validation: "Confira os campos e as datas antes de continuar.", conflict: "Os dados mudaram. Recarregue e confira a operação antes de preparar outro envio.",
  forbidden: "Entre novamente ou confira se esta operação está disponível para sua conta.", unavailable: "Não foi possível carregar as metas agora.",
  uncertain: "O resultado ainda não foi confirmado. Consulte a tentativa original antes de preparar outra.",
  "session-changed": "A sessão mudou. Reabra suas metas na conta atual; uma remoção local não desfaz operações enviadas.",
  "journal-unavailable": "Este navegador não conseguiu registrar a tentativa com segurança. Nenhum novo envio deve ser iniciado.", busy: "Aguarde a operação atual terminar antes de continuar.",
};
const failure = (code: GoalFailureCode): GoalFailure => ({ ok: false, code, message: messages[code] });
const same = (a: unknown, b: unknown) => assinatura(a) === assinatura(b);
const size = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
function ensure(value: unknown): asserts value { if (!value) throw new ClientFault("unavailable"); }
function local<T>(work: () => T): T { try { return work(); } catch (error) { if (error instanceof ClientFault) throw error; throw new ClientFault("validation"); } }
function own<T extends { user_id: string }>(value: T, owner: string): T { ensure(value.user_id === owner); return structuredClone(value); }
function base(value: unknown, fields: string[]) { const row = goalRecord(value, ["version", "finance_revision", ...fields]); ensure(row.version === 1 && size(row) <= GOAL_HTTP_LIMITS.innerDtoBytes); goalRevision(row.finance_revision); return row; }
function totals(value: unknown, owner: string, revision: string, kind: "goal" | "release") {
  const key = kind === "goal" ? "goal_id" : "reservation_id", field = kind === "goal" ? "saved_cents" : "released_cents";
  const row = goalRecord(value, ["user_id", key, "finance_revision", field]); goalUuid(row[key]); goalCents(row[field], true); ensure(row.user_id === owner && row.finance_revision === revision);
  return row;
}
function highlight(value: unknown, owner: string): GoalHighlight | null { return value === null ? null : own(decodeGoalHighlight(value), owner); }
function pageQuery(value: GoalPageQuery): GoalPageQuery {
  const row = goalRecord(value, ["cursor", "limit", "archived"]); if (row.cursor !== null) goalUuid(row.cursor);
  if (typeof row.limit !== "number" || !Number.isInteger(row.limit) || row.limit < 1 || row.limit > GOAL_HTTP_LIMITS.pageLimit || typeof row.archived !== "string" || !["active", "archived", "all"].includes(row.archived)) throw new ClientFault("validation");
  return { cursor: row.cursor, limit: row.limit, archived: row.archived as GoalPageQuery["archived"] };
}
function historyQuery(value: GoalHistoryQuery): GoalHistoryQuery {
  const row = goalRecord(value, ["id", "cursor", "limit"]); goalUuid(row.id);
  if (typeof row.limit !== "number" || !Number.isInteger(row.limit) || row.limit < 1 || row.limit > GOAL_HTTP_LIMITS.pageLimit) throw new ClientFault("validation");
  let cursor: GoalHistoryCursor | null = null;
  if (row.cursor !== null) { const item = goalRecord(row.cursor, ["created_at", "id"]); goalTimestamp(item.created_at); goalUuid(item.id); ensure(size(item) <= 512); cursor = { created_at: item.created_at, id: item.id }; }
  return { id: row.id, limit: row.limit, cursor };
}
function decodePage(value: unknown, owner: string, query: GoalPageQuery): GoalPageView {
  const row = base(value, ["items", "highlight", "next_cursor"]); ensure(Array.isArray(row.items) && row.items.length <= query.limit); let previous = query.cursor;
  const items = row.items.map(value => { const item = goalRecord(value, ["goal", "totals"]), goal = own(decodeFinancialGoal(item.goal), owner), total = totals(item.totals, owner, String(row.finance_revision), "goal");
    ensure((previous === null || goal.id > previous) && total.goal_id === goal.id && (query.archived === "all" || query.archived === (goal.archived_at === null ? "active" : "archived"))); previous = goal.id;
    return { goal, totals: { user_id: owner, goal_id: goal.id, finance_revision: String(row.finance_revision), saved_cents: total.saved_cents as number } satisfies GoalTotals }; });
  ensure(row.next_cursor === null || items.length === query.limit && row.next_cursor === previous);
  return { version: 1, finance_revision: String(row.finance_revision), items, highlight: highlight(row.highlight, owner), next_cursor: row.next_cursor as string | null };
}
function decodeDetail(value: unknown, owner: string, id: string): GoalDetailView | null {
  if (value === null) return null; const row = base(value, ["goal", "totals", "highlight"]), goal = own(decodeFinancialGoal(row.goal), owner), total = totals(row.totals, owner, String(row.finance_revision), "goal"); ensure(goal.id === id && total.goal_id === id);
  return { version: 1, finance_revision: String(row.finance_revision), goal, totals: { user_id: owner, goal_id: id, finance_revision: String(row.finance_revision), saved_cents: total.saved_cents as number }, highlight: highlight(row.highlight, owner) };
}
function pgInstant(value: string): bigint {
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? "", millis = Number(fraction.slice(0, 3).padEnd(3, "0"));
  return BigInt(Date.parse(value) - millis) * 1000n + BigInt(fraction.slice(0, 6).padEnd(6, "0")) + (Number(fraction[6] ?? "0") >= 5 ? 1n : 0n);
}
function after(next: GoalHistoryCursor, previous: GoalHistoryCursor | null) { return previous === null || pgInstant(next.created_at) > pgInstant(previous.created_at) || pgInstant(next.created_at) === pgInstant(previous.created_at) && next.id > previous.id; }
function nextCursor(value: unknown, length: number, query: GoalHistoryQuery, last: GoalHistoryCursor | null): GoalHistoryCursor | null {
  if (value === null) return null; const row = goalRecord(value, ["created_at", "id"]); goalTimestamp(row.created_at); goalUuid(row.id); ensure(length === query.limit && same(row, last)); return { created_at: row.created_at, id: row.id };
}
function decodeReservations(value: unknown, owner: string, query: GoalHistoryQuery): GoalReservationsView {
  const row = base(value, ["items", "next_cursor"]); ensure(Array.isArray(row.items) && row.items.length <= query.limit); let previous = query.cursor;
  const items = row.items.map(value => { const item = goalRecord(value, ["reservation", "totals"]), reservation = own(decodeGoalReservation(item.reservation), owner), total = totals(item.totals, owner, String(row.finance_revision), "release"), cursor = { created_at: reservation.created_at, id: reservation.id };
    ensure(reservation.goal_id === query.id && total.reservation_id === reservation.id && (total.released_cents as number) <= reservation.amount_cents && after(cursor, previous)); previous = cursor;
    return { reservation, totals: { user_id: owner, reservation_id: reservation.id, finance_revision: String(row.finance_revision), released_cents: total.released_cents as number } satisfies GoalReleaseTotals }; });
  return { version: 1, finance_revision: String(row.finance_revision), items, next_cursor: nextCursor(row.next_cursor, items.length, query, previous) };
}
function decodeReleases(value: unknown, owner: string, query: GoalHistoryQuery): GoalReleasesView {
  const row = base(value, ["items", "next_cursor"]); ensure(Array.isArray(row.items) && row.items.length <= query.limit); let previous = query.cursor;
  const items = row.items.map(value => { const release = own(decodeGoalRelease(value), owner), cursor = { created_at: release.created_at, id: release.id }; ensure(release.reservation_id === query.id && after(cursor, previous)); previous = cursor; return release; });
  return { version: 1, finance_revision: String(row.finance_revision), items, next_cursor: nextCursor(row.next_cursor, items.length, query, previous) };
}
function decodePrepared(value: unknown, owner: string, intent: GoalCommand): GoalPrepared {
  const tag = goalRecord(value, ["kind", "intent"], ["result", "financeRevision", "goalRevision", "highlightRevision", "account"]); ensure(same(decodeGoalCommand(tag.intent), intent));
  if (tag.kind === "confirmed") { const row = goalRecord(value, ["kind", "intent", "result"]); return { kind: "confirmed", intent: structuredClone(intent), result: decodeGoalCommandResult(row.result, intent, owner) }; }
  const row = goalRecord(value, ["kind", "intent", "financeRevision", "goalRevision", "highlightRevision", "account"]); ensure(row.kind === "review"); goalRevision(row.financeRevision);
  if (row.goalRevision !== null) goalRevision(row.goalRevision); if (row.highlightRevision !== null) goalRevision(row.highlightRevision);
  if (row.financeRevision !== intent.input.expected_finance_revision || "expected_revision" in intent.input && row.goalRevision !== intent.input.expected_revision || "expected_highlight_revision" in intent.input && row.highlightRevision !== intent.input.expected_highlight_revision) throw new ClientFault("conflict");
  let account: Extract<GoalPrepared, { kind: "review" }>["account"] = null;
  if (row.account !== null) { const item = goalRecord(row.account, ["id", "realBalance", "reserved", "available"]); goalUuid(item.id); goalCents(item.realBalance, true, true); goalCents(item.reserved, true); goalCents(item.available, true, true); ensure(intent.command === "finance.goal.contribute" && item.id === intent.input.account_id && BigInt(item.realBalance) - BigInt(item.reserved) === BigInt(item.available)); account = { id: item.id, realBalance: item.realBalance, reserved: item.reserved, available: item.available }; }
  ensure(intent.command !== "finance.goal.contribute" || account !== null);
  return { kind: "review", intent: structuredClone(intent), financeRevision: row.financeRevision, goalRevision: row.goalRevision, highlightRevision: row.highlightRevision, account };
}
function closedFailure(status: number, value: unknown): ClientFault {
  try {
    const row = goalRecord(value, ["ok", "code", "message"]); ensure(row.ok === false && typeof row.message === "string" && row.message.length <= 600 && GOAL_HTTP_FAILURE_CODES.some(code => code === row.code));
    if (status === 400 && row.code === "validation") return new ClientFault("validation");
    if ((status === 401 || status === 403) && row.code === "forbidden") return new ClientFault("forbidden");
    if (status === 409 && (row.code === "conflict" || row.code === "session-changed")) return new ClientFault(row.code);
    if (status === 503 && (row.code === "unavailable" || row.code === "uncertain") || status === 429 && row.code === "unavailable") return new ClientFault(row.code as "unavailable" | "uncertain");
  } catch { /* Untrusted body is never copied into an error message. */ }
  return new ClientFault("unavailable");
}

/** Concrete browser port. Construct with an already-open durable journal; no auto dispatch. */
export class FinanceGoalsBrowserClient implements GoalsClientPort {
  readonly epoch: string;
  private active = true;
  private opened = false;
  private available: boolean | null = null;
  private readonly controllers = new Set<AbortController>();
  private readonly fetcher: Fetcher;
  constructor(readonly ownerId: string, private readonly journal: FinanceGoalsJournal, private readonly options: GoalsClientOptions = {}) {
    goalUuid(ownerId); if (journal.ownerId !== ownerId) throw new GoalsJournalError("SESSION_CHANGED"); this.epoch = journal.epoch;
    const fetcher = options.fetcher ?? fetch; this.fetcher = (path, init) => fetcher(path, init);
  }
  private guard() { if (!this.active || this.options.isCurrent?.() === false) throw new ClientFault("session-changed"); this.journal.assertSession(); if (this.journal.epoch !== this.epoch) throw new ClientFault("session-changed"); }
  isCurrent() { try { this.guard(); return true; } catch { return false; } }
  private initialized() { this.guard(); if (!this.opened) throw new ClientFault("journal-unavailable"); }
  private newOperation() { this.initialized(); if (this.available !== true) throw new ClientFault("unavailable"); }
  dispose() { this.active = false; for (const controller of this.controllers) controller.abort(); this.controllers.clear(); }
  revokeIdentity() { this.dispose(); return this.journal.revoke(); }
  subscribe(listener: () => void) { return this.journal.subscribe(listener); }
  private error(error: unknown): GoalFailure {
    if (error instanceof ClientFault) return failure(error.code);
    if (error instanceof GoalsJournalError) return failure(error.code === "SESSION_CHANGED" || error.code === "CLOSED" ? "session-changed" : error.code === "PENDING" || error.code === "RECONFIRM" ? "uncertain" : "journal-unavailable");
    return failure("unavailable");
  }
  private async read<T>(work: () => Promise<T>): Promise<GoalReply<T>> {
    let fence = () => undefined as void;
    try { this.guard(); fence = this.journal.captureFence(); const result = await work(); this.guard(); fence(); return { ok: true, result }; }
    catch (error) { try { this.guard(); fence(); } catch (changed) { return this.error(changed); } return this.error(error); }
  }
  private async readJson(response: Response, signal: AbortSignal, guard: () => void): Promise<unknown> {
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get("content-type") ?? "")) throw new ClientFault("unavailable");
    const length = response.headers.get("content-length"); if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > GOAL_HTTP_LIMITS.responseBytes)) throw new ClientFault("unavailable");
    if (!response.body) throw new ClientFault("unavailable"); const reader = response.body.getReader(), chunks: Uint8Array[] = []; let count = 0;
    const cancel = () => { try { void reader.cancel().catch(() => undefined); } catch { /* Timeout remains a refusal. */ } }; signal.addEventListener("abort", cancel, { once: true });
    try {
      while (true) { const next = await reader.read(); guard(); if (signal.aborted) throw new ClientFault("unavailable"); if (next.done) break; count += next.value.byteLength; if (count > GOAL_HTTP_LIMITS.responseBytes) { cancel(); throw new ClientFault("unavailable"); } chunks.push(next.value); }
      const bytes = new Uint8Array(count); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } guard(); return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  }
  private async request<T>(path: string, decode: (value: unknown) => T, intent?: GoalCommand): Promise<T> {
    this.initialized(); const fence = this.journal.captureFence(), guard = () => { this.guard(); fence(); }; guard();
    const text = intent === undefined ? undefined : JSON.stringify(intent); if (text !== undefined && new TextEncoder().encode(text).length > GOAL_HTTP_LIMITS.requestBytes) throw new ClientFault("validation");
    const controller = new AbortController(); this.controllers.add(controller); let abortReject = () => undefined as void;
    const aborted = new Promise<never>((_, reject) => { abortReject = () => reject(new ClientFault("unavailable")); controller.signal.addEventListener("abort", abortReject, { once: true }); });
    const timeout = this.options.timeoutMs ?? 15_000, timer = setTimeout(() => controller.abort(), Number.isInteger(timeout) && timeout >= 1 && timeout <= 15_000 ? timeout : 15_000);
    try {
      const result = await Promise.race([aborted, (async () => {
        guard(); const response = await this.fetcher(path, { method: intent === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal, headers: { [GOAL_HTTP_EXPECTED_OWNER_HEADER]: this.ownerId, ...(intent === undefined ? {} : { "Content-Type": "application/json" }) }, ...(text === undefined ? {} : { body: text }) });
        guard(); if (controller.signal.aborted || response.redirected || response.url && this.options.origin && response.url !== new URL(path, this.options.origin).href) throw new ClientFault("unavailable");
        const value = await this.readJson(response, controller.signal, guard); guard(); if (response.status !== 200) { const error = closedFailure(response.status, value); if (error.code === "session-changed") this.dispose(); throw error; }
        const row = goalRecord(value, intent === undefined ? ["ok", "result"] : ["ok", "binding", "result"]); ensure(row.ok === true);
        if (intent !== undefined) { const binding = goalRecord(row.binding, ["version", "command", "client_id"]); ensure(binding.version === 1 && binding.command === intent.command && binding.client_id === intent.input.client_id); }
        ensure(size(row.result) <= GOAL_HTTP_LIMITS.innerDtoBytes); const decoded = decode(row.result); guard(); return decoded;
      })()]); guard(); return result;
    } catch (error) { guard(); throw error; }
    finally { clearTimeout(timer); controller.signal.removeEventListener("abort", abortReject); controller.abort(); this.controllers.delete(controller); }
  }
  loadPending(): Promise<GoalReply<GoalJournalView>> { return this.read(async () => { const value = await this.journal.exclusive(async lease => { this.guard(); return lease.snapshot(); }); this.guard(); this.opened = true; return value; }); }
  availability(): Promise<GoalReply<{ available: boolean }>> { return this.read(async () => { this.initialized(); const value = await this.request(GOAL_HTTP_PATHS.availability, value => { const row = goalRecord(value, ["available"]); ensure(typeof row.available === "boolean"); return { available: row.available }; }); this.guard(); this.available = value.available; return value; }); }
  page(query: GoalPageQuery): Promise<GoalReply<GoalPageView>> { const input = structuredClone(query); return this.read(async () => { this.newOperation(); const value = local(() => pageQuery(input)), params = new URLSearchParams({ view: "page", limit: String(value.limit), archived: value.archived }); if (value.cursor !== null) params.set("cursor", value.cursor); return this.request(GOAL_HTTP_PATHS.base + "?" + params, raw => decodePage(raw, this.ownerId, value)); }); }
  detail(id: string): Promise<GoalReply<GoalDetailView | null>> { return this.read(async () => { this.newOperation(); local(() => goalUuid(id)); return this.request(GOAL_HTTP_PATHS.base + "?" + new URLSearchParams({ view: "detail", id }), raw => decodeDetail(raw, this.ownerId, id)); }); }
  private history<T>(view: "reservations" | "releases", query: GoalHistoryQuery, decode: (value: unknown, owner: string, query: GoalHistoryQuery) => T): Promise<GoalReply<T>> {
    const input = structuredClone(query); return this.read(async () => { this.newOperation(); const value = local(() => historyQuery(input)), params = new URLSearchParams({ view, id: value.id, limit: String(value.limit) }); if (value.cursor) { params.set("cursor_at", value.cursor.created_at); params.set("cursor_id", value.cursor.id); } return this.request(GOAL_HTTP_PATHS.base + "?" + params, raw => decode(raw, this.ownerId, value)); });
  }
  reservations(query: GoalHistoryQuery) { return this.history("reservations", query, decodeReservations); }
  releases(query: GoalHistoryQuery) { return this.history("releases", query, decodeReleases); }
  prepare(input: GoalCommand): Promise<GoalReply<GoalPrepared>> {
    return this.read(async () => { const intent = local(() => decodeGoalCommand(input)); this.newOperation(); if (this.journal.snapshot().pending || this.journal.snapshot().reconfirmRequired) throw new ClientFault("uncertain"); return this.request(GOAL_HTTP_PATHS.preview, value => decodePrepared(value, this.ownerId, intent), intent); });
  }
  stage(input: GoalCommand): Promise<GoalReply<GoalJournalView>> {
    return this.read(async () => { const intent = local(() => decodeGoalCommand(input)); this.newOperation(); const value = await this.journal.exclusive(async lease => { this.guard(); lease.stage(intent); return lease.snapshot(); }); this.guard(); return value; });
  }
  execute(input: GoalCommand): Promise<GoalReply<GoalCommandResult>> {
    return this.read(async () => { const intent = local(() => decodeGoalCommand(input)); this.initialized(); return this.journal.exclusive(async lease => {
      this.guard(); const view = lease.snapshot(); if (!view.pending || view.pending.phase !== "staged" || !same(view.pending.intent, intent) || view.reconfirmRequired) throw new ClientFault("uncertain"); this.newOperation();
      lease.uncertain(intent); this.guard(); // Durable uncertainty precedes the only mutable fetch.
      try { const result = await this.request(GOAL_HTTP_PATHS.base, value => decodeGoalCommandResult(value, intent, this.ownerId), intent); this.guard(); lease.confirmed(intent); this.guard(); return result; }
      catch (error) { this.guard(); if (error instanceof ClientFault && ["validation", "conflict", "forbidden", "session-changed"].includes(error.code)) throw error; throw new ClientFault("uncertain"); }
    }); });
  }
  reconcile(input: GoalCommand): Promise<GoalReply<GoalCommandResult>> {
    return this.read(async () => { const intent = local(() => decodeGoalCommand(input)); this.initialized(); return this.journal.exclusive(async lease => {
      this.guard(); const pending = lease.snapshot().pending; if (!pending || !same(pending.intent, intent)) throw new ClientFault("uncertain");
      // Deliberately bypass cached availability, never Auth/owner or the journal fence.
      try { const result = await this.request(GOAL_HTTP_PATHS.reconcile, value => decodeGoalCommandResult(value, intent, this.ownerId), intent); this.guard(); lease.confirmed(intent); this.guard(); return result; }
      catch (error) { this.guard(); if (error instanceof ClientFault && error.code === "session-changed") throw error; throw new ClientFault("uncertain"); }
    }); });
  }
  acknowledgeReview(): Promise<GoalReply<GoalJournalView>> { return this.read(async () => { this.initialized(); return this.journal.exclusive(async lease => { this.guard(); lease.acknowledgeReview(); return lease.snapshot(); }); }); }
}

// Lifecycle handles only: no duplicate financial body in this registry.
const browserJournals = new Map<string, FinanceGoalsJournal>();
let browserOwner: string | null = null, browserListener = false;
export function revokeBrowserFinanceGoalsIdentity(ownerId: string) {
  goalUuid(ownerId); const journal = browserJournals.get(ownerId) ?? browserFinanceGoalsJournal(ownerId);
  try { return journal.revoke(); } finally { browserJournals.delete(ownerId); if (browserOwner === ownerId) browserOwner = null; }
}
export async function browserFinanceGoalsClient(ownerId: string, isCurrent: () => boolean): Promise<FinanceGoalsBrowserClient> {
  goalUuid(ownerId); if (typeof window === "undefined" || !isCurrent()) throw new GoalsJournalError("SESSION_CHANGED");
  if (browserOwner !== null && browserOwner !== ownerId) revokeBrowserFinanceGoalsIdentity(browserOwner);
  browserOwner = ownerId; const journal = browserFinanceGoalsJournal(ownerId); browserJournals.set(ownerId, journal);
  if (!browserListener) { browserListener = true; window.addEventListener("segundo-cerebro:demo-logout", event => { const owner = (event as CustomEvent<{ userId?: unknown }>).detail?.userId; if (typeof owner !== "string") return; try { revokeBrowserFinanceGoalsIdentity(owner); } catch { /* Logout continues, while durable epoch refusal remains in force. */ } }); }
  await journal.open(); if (!isCurrent() || browserOwner !== ownerId) throw new GoalsJournalError("SESSION_CHANGED");
  return new FinanceGoalsBrowserClient(ownerId, journal, { isCurrent, origin: window.location.origin });
}
