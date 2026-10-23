import "server-only";
import { assinatura, instanteValido, type ContextoDeEscrita } from "../../core/contracts/base";
import type { ReciboIdempotente } from "../../core/contracts/unit-of-work";
import type { ContaFinanceira, CategoriaFinanceira, EtiquetaFinanceira, LancamentoFinanceiro } from "../../core/financeiro/fused";
import type { FinanceSeriesCommand, FinanceSeriesEvent, FinanceSeriesPage, FinanceSeriesResult, ManagedFinanceSeries, ManagedSeriesOccurrence, SeriesTemplate } from "../../core/financeiro/series/series-types";
import { validateManagedOccurrence, validateManagedSeries } from "../../core/financeiro/series/series-validation";
import { assertSeriesOccurrenceBinding } from "../../core/financeiro/series/series-policy";
import { AuthGuardError } from "../../lib/auth/types";
import { validateFinanceRow } from "./finance-gateway";

export const SERIES_COMMANDS = ["finance.recurring.create", "finance.recurring.materialize", "finance.recurring.pause", "finance.recurring.resume", "finance.recurring.update_future", "finance.recurring.end", "finance.recurring.occurrence.cancel", "finance.recurring.occurrence.update"] as const;
export type FinanceSeriesOperation = FinanceSeriesCommand["command"] | "read.finance.series";
export type FinanceSeriesRow = ManagedFinanceSeries | ManagedSeriesOccurrence | LancamentoFinanceiro;
export type FinanceSeriesChange = { type: "finance_series" | "finance_series_occurrence" | "finance_transaction"; before: FinanceSeriesRow | null; after: FinanceSeriesRow };
export interface FinanceSeriesSnapshot {
  version: 2; finance_revision: string; series: ManagedFinanceSeries[]; occurrences: ManagedSeriesOccurrence[];
  transactions: LancamentoFinanceiro[]; accounts: ContaFinanceira[]; categories: CategoriaFinanceira[]; tags: EtiquetaFinanceira[]; receipt: ReciboIdempotente | null;
}
export interface FinanceSeriesDetail extends Omit<FinanceSeriesSnapshot, "series" | "receipt"> { series: ManagedFinanceSeries }
export interface FinanceSeriesCommit {
  request: FinanceSeriesCommand; expected_finance_revision: string; context: ContextoDeEscrita;
  changes: FinanceSeriesChange[]; events: FinanceSeriesEvent[]; receipt: ReciboIdempotente;
}
export type FinanceSeriesRpcName = "finance_series_snapshot" | "finance_series_page" | "finance_series_detail" | "finance_series_commit";
export interface FinanceSeriesRpcArguments { p_user: string; p_session: string; p_request?: unknown; p_operation?: FinanceSeriesOperation; p_cursor?: string | null; p_limit?: number; p_series_id?: string }
export type FinanceSeriesRpc = (name: FinanceSeriesRpcName, args: FinanceSeriesRpcArguments, writing: boolean) => Promise<unknown>;
export interface FinanceSeriesGateway {
  readonly actorId: string;
  snapshot(request: FinanceSeriesCommand): Promise<FinanceSeriesSnapshot>;
  page(query: { cursor: string | null; limit: number }): Promise<FinanceSeriesPage>;
  detail(seriesId: string): Promise<FinanceSeriesDetail | null>;
  commit(request: FinanceSeriesCommit): Promise<{ status: "stale" } | { status: "committed" | "replayed"; result: FinanceSeriesResult }>;
}
export const seriesRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export const seriesUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export function seriesEnsure(value: unknown): asserts value { if (!value) throw new AuthGuardError("unavailable"); }
export function seriesKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) {
  seriesEnsure(required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => [...required, ...optional].includes(key)));
}
export function parseSeriesRevision(value: unknown): string {
  seriesEnsure(typeof value === "string" && /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n); return value;
}
function checked<T>(run: () => T): T { try { return run(); } catch { throw new AuthGuardError("unavailable"); } }
export function parseSeriesResult(value: unknown, actor: string): FinanceSeriesResult {
  return checked(() => {
    seriesEnsure(seriesRecord(value)); seriesKeys(value, ["version", "series", "affected"]); seriesEnsure(value.version === 2);
    validateManagedSeries(value.series); seriesEnsure(value.series.user_id === actor);
    seriesEnsure(seriesRecord(value.affected)); seriesKeys(value.affected, ["created", "updated", "suppressed", "restored", "skipped"]);
    seriesEnsure(Object.values(value.affected).every(count => typeof count === "number" && Number.isInteger(count) && count >= 0 && count <= 120));
    return structuredClone(value) as unknown as FinanceSeriesResult;
  });
}
export function parseSeriesReceipt(value: unknown, actor: string, request: FinanceSeriesCommand): ReciboIdempotente {
  return checked(() => {
    seriesEnsure(seriesRecord(value)); seriesKeys(value, ["user_id", "command", "client_id", "fingerprint", "result"]);
    seriesEnsure(value.user_id === actor && value.command === request.command && value.client_id === request.input.client_id && typeof value.fingerprint === "string");
    const result = parseSeriesResult(value.result, actor);
    return { user_id: actor, command: request.command, client_id: request.input.client_id, fingerprint: value.fingerprint, result };
  });
}
const rowFields = ["id", "user_id", "created_at", "updated_at"];
function financeRow(value: unknown, kind: "finance_account" | "finance_category" | "finance_tag" | "finance_transaction", actor: string) {
  seriesEnsure(seriesRecord(value));
  const fields = {
    finance_account: ["name", "kind", "institution", "currency", "opening_balance_cents", "color_key", "archived_at", "credit_limit_cents", "statement_closing_day", "payment_due_day"],
    finance_category: ["name", "normalized_name", "kind", "parent_id", "color_key"],
    finance_tag: ["name", "normalized_name", "color_key"],
    finance_transaction: ["account_id", "category_id", "kind", "amount_cents", "paid_cents", "description", "payee", "occurred_on", "transfer_group_id", "notes", "installment_group_id", "installment_no", "installment_total", "statement_month", "serie_tipo", "status", "source", "due_date", "deleted_at", "tag_ids"],
  };
  seriesKeys(value, [...rowFields, ...fields[kind]], kind === "finance_account" ? ["last_four", "default_payment_account_id"] : []);
  validateFinanceRow(value, kind, actor);
  if (kind === "finance_transaction") seriesEnsure(Array.isArray(value.tag_ids) && new Set(value.tag_ids).size === value.tag_ids.length);
}
function templateRefs(template: SeriesTemplate, refs: { accounts: Set<string>; categories: Set<string>; tags: Set<string> }) {
  refs.accounts.add(template.account_id); if (template.category_id !== null) refs.categories.add(template.category_id); template.tag_ids.forEach(id => refs.tags.add(id));
}
function aggregate(value: unknown, actor: string, request: FinanceSeriesCommand | null, detailId: string | null): FinanceSeriesSnapshot {
  seriesEnsure(seriesRecord(value));
  seriesEnsure(Buffer.byteLength(JSON.stringify(value), "utf8") <= 4 * 1024 * 1024);
  seriesKeys(value, ["version", "finance_revision", "series", "occurrences", "transactions", "accounts", "categories", "tags", "receipt"]);
  seriesEnsure(value.version === 2); parseSeriesRevision(value.finance_revision);
  const cap = request === null ? { accounts: 121, categories: 121, tags: 3630 } : { accounts: 122, categories: 122, tags: 3660 };
  for (const [key, max] of Object.entries({ series: 1, occurrences: 120, transactions: 120, ...cap })) seriesEnsure(Array.isArray(value[key]) && value[key].length <= max);
  const snapshot = value as unknown as FinanceSeriesSnapshot;
  const allIds = new Set<string>();
  for (const series of snapshot.series) { validateManagedSeries(series); seriesEnsure(series.user_id === actor); }
  for (const occurrence of snapshot.occurrences) { validateManagedOccurrence(occurrence); seriesEnsure(occurrence.user_id === actor); }
  for (const [key, kind] of Object.entries({ transactions: "finance_transaction", accounts: "finance_account", categories: "finance_category", tags: "finance_tag" }) as ["transactions" | "accounts" | "categories" | "tags", "finance_transaction" | "finance_account" | "finance_category" | "finance_tag"][]) for (const row of snapshot[key]) financeRow(row, kind, actor);
  for (const rows of [snapshot.series, snapshot.occurrences, snapshot.transactions, snapshot.accounts, snapshot.categories, snapshot.tags]) for (const row of rows) { seriesEnsure(!allIds.has(row.id)); allIds.add(row.id); }
  const series = snapshot.series[0];
  const expectedId = detailId ?? (request && request.command !== "finance.recurring.create" ? request.input.series_id : null);
  if (series && expectedId !== null) seriesEnsure(series.id === expectedId);
  if (request?.command === "finance.recurring.create") seriesEnsure(snapshot.series.length === 0 && snapshot.occurrences.length === 0 && snapshot.transactions.length === 0);
  seriesEnsure(snapshot.occurrences.length === snapshot.transactions.length && (!snapshot.occurrences.length || !!series));
  const required = { accounts: new Set<string>(), categories: new Set<string>(), tags: new Set<string>() }, expected = { accounts: new Set<string>(), categories: new Set<string>(), tags: new Set<string>() };
  if (series) templateRefs(series.template, required);
  const mapIndices = new Set<number>(), mappedRows = new Set<string>();
  for (const occurrence of snapshot.occurrences) {
    const row = snapshot.transactions.find(item => item.id === occurrence.transaction_id), account = snapshot.accounts.find(item => item.id === row?.account_id);
    seriesEnsure(series && row && account && !mapIndices.has(occurrence.index) && !mappedRows.has(row.id));
    assertSeriesOccurrenceBinding(series, occurrence, row, account); mapIndices.add(occurrence.index); mappedRows.add(row.id);
    required.accounts.add(row.account_id); if (row.category_id !== null) required.categories.add(row.category_id); (row.tag_ids ?? []).forEach(id => required.tags.add(id));
  }
  for (const key of ["accounts", "categories", "tags"] as const) for (const id of required[key]) expected[key].add(id);
  if (request?.command === "finance.recurring.create") templateRefs(request.input.definition.template, expected);
  if (request?.command === "finance.recurring.update_future" && request.input.patch.template) templateRefs(request.input.patch.template, expected);
  for (const key of ["accounts", "categories", "tags"] as const) {
    seriesEnsure(snapshot[key].every(row => expected[key].has(row.id)));
    seriesEnsure([...required[key]].every(id => snapshot[key].some(row => row.id === id)));
  }
  if (request === null) seriesEnsure(snapshot.receipt === null); else if (snapshot.receipt !== null) parseSeriesReceipt(snapshot.receipt, actor, request);
  return structuredClone(snapshot);
}
export function parseSeriesSnapshot(value: unknown, actor: string, request: FinanceSeriesCommand): FinanceSeriesSnapshot { return checked(() => aggregate(value, actor, request, null)); }
export function parseSeriesDetail(value: unknown, actor: string, seriesId: string): FinanceSeriesDetail | null {
  if (value === null) return null;
  return checked(() => {
    seriesEnsure(seriesRecord(value)); seriesKeys(value, ["version", "finance_revision", "series", "occurrences", "transactions", "accounts", "categories", "tags"]);
    const snapshot = aggregate({ ...value, series: [value.series], receipt: null }, actor, null, seriesId); seriesEnsure(snapshot.series.length === 1);
    return { version: 2, finance_revision: snapshot.finance_revision, series: snapshot.series[0]!, occurrences: snapshot.occurrences, transactions: snapshot.transactions, accounts: snapshot.accounts, categories: snapshot.categories, tags: snapshot.tags };
  });
}
export function parseSeriesPage(value: unknown, actor: string, query: { cursor: string | null; limit: number }): FinanceSeriesPage {
  return checked(() => {
    seriesEnsure((query.cursor === null || seriesUuid(query.cursor)) && Number.isInteger(query.limit) && query.limit >= 1 && query.limit <= 50);
    seriesEnsure(seriesRecord(value)); seriesKeys(value, ["version", "finance_revision", "items", "next_cursor"]); seriesEnsure(value.version === 2); parseSeriesRevision(value.finance_revision);
    seriesEnsure(Buffer.byteLength(JSON.stringify(value), "utf8") <= 4 * 1024 * 1024);
    seriesEnsure(Array.isArray(value.items) && value.items.length <= query.limit && (value.next_cursor === null || seriesUuid(value.next_cursor)));
    let previous = query.cursor;
    for (const item of value.items) { validateManagedSeries(item); seriesEnsure(item.user_id === actor && (previous === null || item.id > previous)); previous = item.id; }
    seriesEnsure(value.next_cursor === null || value.items.length === query.limit && value.next_cursor === previous);
    return structuredClone(value) as unknown as FinanceSeriesPage;
  });
}
export function validateSeriesEvent(event: FinanceSeriesEvent, actor: string, context: ContextoDeEscrita) {
  seriesEnsure(seriesRecord(event)); seriesKeys(event, ["id", "user_id", "entity_type", "entity_id", "action", "canal", "occurred_at", "before", "after"]);
  seriesEnsure(seriesUuid(event.id) && event.user_id === actor && event.canal === context.canal && instanteValido(event.occurred_at));
  seriesEnsure(["created", "updated", "deleted", "restored", "status_changed"].includes(event.action) && (event.action === "created" ? event.before === null : event.before !== null));
  for (const state of [event.before, event.after]) if (state !== null) {
    seriesEnsure(state.user_id === actor && state.id === event.entity_id);
    if (event.entity_type === "finance_series") validateManagedSeries(state);
    else if (event.entity_type === "finance_series_occurrence") validateManagedOccurrence(state);
    else { seriesEnsure(event.entity_type === "finance_transaction"); financeRow(state, "finance_transaction", actor); }
  }
  seriesEnsure(event.after !== null && (event.entity_type === "finance_transaction" || !["deleted", "restored"].includes(event.action)));
}
export const sameSeriesValue = (a: unknown, b: unknown) => assinatura(a) === assinatura(b);
