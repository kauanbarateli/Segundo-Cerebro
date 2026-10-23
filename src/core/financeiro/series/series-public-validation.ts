import { assinatura, exigir, instanteValido } from "../../contracts/base";
import { seriesDay } from "./series-calendar";
import { assertSeriesOccurrenceBinding } from "./series-policy";
import { validateManagedOccurrence, validateManagedSeries } from "./series-validation";
import type { FinanceSeriesCommand, FinanceSeriesPage, FinanceSeriesResult, ManagedFinanceSeries, SeriesTemplate } from "./series-types";
import type { FinanceSeriesAvailability, FinanceSeriesPreview, FinanceSeriesPreviewData } from "./series-preview-types";

export type FinanceSeriesDetailView = FinanceSeriesPreviewData & { version: 2; finance_revision: string; series: ManagedFinanceSeries };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function record(value: unknown): asserts value is Record<string, unknown> { exigir(object(value), "Resposta financeira inválida."); }
function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) { exigir(required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => [...required, ...optional].includes(key)), "Campos de resposta financeira inválidos."); }
function uuid(value: unknown): asserts value is string { exigir(typeof value === "string" && UUID.test(value), "Identificador financeiro inválido."); }
export function publicSeriesRevision(value: unknown): string { exigir(typeof value === "string" && /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n, "Revisão financeira inválida."); return value; }
const safe = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
function text(value: unknown, maximum: number, nullable = false) { exigir(nullable && value === null || typeof value === "string" && value.length <= maximum, "Texto financeiro inválido."); }
function nullableDay(value: unknown, month = false) { if (value === null) return; seriesDay(value); exigir(!month || String(value).endsWith("-01"), "Competência inválida."); }
function base(value: Record<string, unknown>, owner: string) { uuid(value.id); exigir(value.user_id === owner && typeof value.created_at === "string" && instanteValido(value.created_at) && typeof value.updated_at === "string" && instanteValido(value.updated_at), "Resposta fora da conta atual."); }
const fields = {
  accounts: ["name", "kind", "institution", "currency", "opening_balance_cents", "color_key", "archived_at", "credit_limit_cents", "statement_closing_day", "payment_due_day"],
  categories: ["name", "normalized_name", "kind", "parent_id", "color_key"], tags: ["name", "normalized_name", "color_key"],
  transactions: ["account_id", "category_id", "kind", "amount_cents", "paid_cents", "description", "payee", "occurred_on", "transfer_group_id", "notes", "installment_group_id", "installment_no", "installment_total", "statement_month", "serie_tipo", "status", "source", "due_date", "deleted_at", "tag_ids"],
};
function financeRow(value: unknown, kind: keyof typeof fields, owner: string) {
  record(value); keys(value, ["id", "user_id", "created_at", "updated_at", ...fields[kind]], kind === "accounts" ? ["last_four", "default_payment_account_id"] : []); base(value, owner);
  if (kind !== "transactions") exigir(typeof value.color_key === "string" && /^fin-[1-6]$/.test(value.color_key), "Cor financeira inválida.");
  if (kind === "accounts") {
    text(value.name, 200); text(value.institution, 200, true); exigir(["checking", "savings", "credit_card", "cash", "investment", "other"].includes(String(value.kind)) && value.currency === "BRL" && safe(value.opening_balance_cents), "Conta financeira inválida.");
    exigir(value.archived_at === null || typeof value.archived_at === "string" && instanteValido(value.archived_at), "Arquivo da conta inválido.");
    exigir(value.credit_limit_cents === null || safe(value.credit_limit_cents) && value.credit_limit_cents >= 0, "Limite do cartão inválido.");
    for (const field of ["statement_closing_day", "payment_due_day"] as const) exigir(value[field] === null || Number.isInteger(value[field]) && Number(value[field]) >= 1 && Number(value[field]) <= 31, "Ciclo do cartão inválido.");
    if (value.kind === "credit_card") exigir(value.credit_limit_cents !== null && value.statement_closing_day !== null && value.payment_due_day !== null, "Ciclo do cartão incompleto.");
    exigir(value.last_four === undefined || value.last_four === null || value.kind === "credit_card" && typeof value.last_four === "string" && /^[0-9]{4}$/.test(value.last_four), "Final do cartão inválido.");
    if (value.default_payment_account_id !== undefined && value.default_payment_account_id !== null) { exigir(value.kind === "credit_card", "Conta sugerida inválida."); uuid(value.default_payment_account_id); }
  } else if (kind === "categories" || kind === "tags") {
    text(value.name, 200); text(value.normalized_name, 200); if (kind === "categories") { exigir(value.kind === "income" || value.kind === "expense", "Categoria financeira inválida."); if (value.parent_id !== null) uuid(value.parent_id); }
  } else {
    uuid(value.account_id); if (value.category_id !== null) uuid(value.category_id); exigir((value.kind === "income" || value.kind === "expense") && safe(value.amount_cents) && value.amount_cents > 0 && safe(value.paid_cents) && value.paid_cents >= 0 && value.paid_cents <= value.amount_cents, "Valor financeiro inválido.");
    text(value.description, 200); text(value.payee, 200, true); text(value.notes, 4000, true); seriesDay(value.occurred_on); nullableDay(value.due_date); nullableDay(value.statement_month, true);
    exigir(["planned", "pending", "confirmed", "reconciled", "cancelled"].includes(String(value.status)) && ["manual", "recurring", "import"].includes(String(value.source)), "Estado financeiro inválido.");
    exigir(value.deleted_at === null || typeof value.deleted_at === "string" && instanteValido(value.deleted_at), "Exclusão financeira inválida."); if (value.transfer_group_id !== null) uuid(value.transfer_group_id);
    if (value.installment_group_id !== null) { uuid(value.installment_group_id); exigir(Number.isInteger(value.installment_no) && Number.isInteger(value.installment_total) && Number(value.installment_no) >= 1 && Number(value.installment_no) <= Number(value.installment_total) && Number(value.installment_total) >= 2 && Number(value.installment_total) <= 120 && (value.serie_tipo === "parcelamento" || value.serie_tipo === "recorrencia"), "Série financeira inválida."); }
    else exigir(value.installment_no === null && value.installment_total === null && value.serie_tipo === null, "Grupo financeiro incompleto.");
    exigir(Array.isArray(value.tag_ids) && value.tag_ids.length <= 30 && new Set(value.tag_ids).size === value.tag_ids.length, "Etiquetas financeiras inválidas."); value.tag_ids.forEach(uuid);
  }
}
function projection(value: unknown, owner: string, request: FinanceSeriesCommand | null): FinanceSeriesPreviewData {
  record(value); keys(value, ["series", "occurrences", "transactions", "accounts", "categories", "tags"]);
  if (value.series !== null) { validateManagedSeries(value.series); exigir(value.series.user_id === owner, "Série fora da conta atual."); }
  for (const [key, maximum] of Object.entries({ occurrences: 120, transactions: 120, accounts: request ? 122 : 121, categories: request ? 122 : 121, tags: request ? 3660 : 3630 })) exigir(Array.isArray(value[key]) && value[key].length <= maximum, "Agregado financeiro excedeu o limite.");
  const data = value as unknown as FinanceSeriesPreviewData;
  for (const row of data.occurrences) { validateManagedOccurrence(row); exigir(row.user_id === owner, "Ocorrência fora da conta atual."); }
  for (const key of ["accounts", "categories", "tags", "transactions"] as const) for (const row of data[key]) financeRow(row, key, owner);
  const ids = new Set<string>(), indices = new Set<number>(), rows = new Set<string>();
  const required = { accounts: new Set<string>(), categories: new Set<string>(), tags: new Set<string>() }, expected = { accounts: new Set<string>(), categories: new Set<string>(), tags: new Set<string>() };
  const refs = (template: SeriesTemplate, target: typeof required) => { target.accounts.add(template.account_id); if (template.category_id !== null) target.categories.add(template.category_id); template.tag_ids.forEach(id => target.tags.add(id)); };
  if (data.series) refs(data.series.template, required);
  for (const collection of [data.series ? [data.series] : [], data.occurrences, data.transactions, data.accounts, data.categories, data.tags]) for (const row of collection) { exigir(!ids.has(row.id), "Registro financeiro repetido."); ids.add(row.id); }
  exigir(data.occurrences.length === data.transactions.length, "Ocorrências incompletas.");
  for (const occurrence of data.occurrences) {
    const row = data.transactions.find(item => item.id === occurrence.transaction_id), account = data.accounts.find(item => item.id === row?.account_id);
    exigir(data.series && row && account && !indices.has(occurrence.index) && !rows.has(row.id), "Mapa financeiro incompleto."); assertSeriesOccurrenceBinding(data.series, occurrence, row, account); indices.add(occurrence.index); rows.add(row.id);
    required.accounts.add(row.account_id); if (row.category_id !== null) required.categories.add(row.category_id); (row.tag_ids ?? []).forEach(id => required.tags.add(id));
  }
  for (const key of ["accounts", "categories", "tags"] as const) for (const id of required[key]) expected[key].add(id);
  if (request?.command === "finance.recurring.create") refs(request.input.definition.template, expected);
  if (request?.command === "finance.recurring.update_future" && request.input.patch.template) refs(request.input.patch.template, expected);
  for (const key of ["accounts", "categories", "tags"] as const) {
    exigir(data[key].every(row => expected[key].has(row.id)), "Referência financeira não solicitada.");
    exigir([...required[key]].every(id => data[key].some(row => row.id === id)), "Referência financeira histórica ausente.");
  }
  if (request?.command === "finance.recurring.create") exigir(data.series === null && !data.occurrences.length, "Criação não pode converter grupo existente.");
  if (request && request.command !== "finance.recurring.create") exigir(data.series?.id === request.input.series_id, "Prévia de outra série.");
  return structuredClone(data);
}
export function decodeSeriesAvailability(value: unknown): FinanceSeriesAvailability { record(value); keys(value, ["version", "available"]); exigir(value.version === 2 && typeof value.available === "boolean", "Disponibilidade financeira inválida."); return { version: 2, available: value.available }; }
export function decodeSeriesResult(value: unknown, owner: string, request?: FinanceSeriesCommand): FinanceSeriesResult {
  record(value); keys(value, ["version", "series", "affected"]); exigir(value.version === 2, "Versão financeira inválida."); validateManagedSeries(value.series); exigir(value.series.user_id === owner, "Resultado de outra conta."); record(value.affected); keys(value.affected, ["created", "updated", "suppressed", "restored", "skipped"]); exigir(Object.values(value.affected).every(count => safe(count) && count >= 0 && count <= 120), "Contagem financeira inválida.");
  if (request?.command === "finance.recurring.create") {
    const { kind, frequency, anchor_on, first_index, total, ends_on, template } = value.series;
    const expected = structuredClone(request.input.definition); expected.template = { ...expected.template, description: expected.template.description.trim(), payee: expected.template.payee?.trim() || null, notes: expected.template.notes?.trim() || null };
    exigir(assinatura({ kind, frequency, anchor_on, first_index, total, ends_on, template }) === assinatura(expected), "Resultado de outra definição de série.");
  } else if (request) exigir(value.series.id === request.input.series_id, "Resultado de outra série.");
  return structuredClone(value) as unknown as FinanceSeriesResult;
}
export function decodeSeriesPage(value: unknown, owner: string, query: { cursor: string | null; limit: number }): FinanceSeriesPage {
  exigir(Number.isInteger(query.limit) && query.limit >= 1 && query.limit <= 50, "Limite de página inválido."); if (query.cursor !== null) uuid(query.cursor);
  record(value); keys(value, ["version", "finance_revision", "items", "next_cursor"]); exigir(value.version === 2 && Array.isArray(value.items) && value.items.length <= query.limit, "Página financeira inválida."); publicSeriesRevision(value.finance_revision); if (value.next_cursor !== null) uuid(value.next_cursor);
  let previous = query.cursor; for (const item of value.items) { validateManagedSeries(item); exigir(item.user_id === owner && (previous === null || item.id > previous), "Página de outra conta ou fora de ordem."); previous = item.id; }
  exigir(value.next_cursor === null || value.items.length === query.limit && value.next_cursor === previous, "Cursor financeiro inválido."); return structuredClone(value) as unknown as FinanceSeriesPage;
}
export function decodeSeriesDetail(value: unknown, owner: string, seriesId: string): FinanceSeriesDetailView {
  record(value); keys(value, ["version", "finance_revision", "series", "occurrences", "transactions", "accounts", "categories", "tags"]); exigir(value.version === 2, "Versão financeira inválida."); const finance_revision = publicSeriesRevision(value.finance_revision);
  const data = projection({ series: value.series, occurrences: value.occurrences, transactions: value.transactions, accounts: value.accounts, categories: value.categories, tags: value.tags }, owner, null); exigir(data.series && data.series.id === seriesId, "Detalhe de outra série."); return { ...data, version: 2, finance_revision, series: data.series };
}
export function decodeSeriesPreview(value: unknown, owner: string, request: FinanceSeriesCommand): FinanceSeriesPreview {
  record(value); exigir(value.version === 2 && value.command === request.command && value.client_id === request.input.client_id, "Prévia de outra intenção.");
  if (value.kind === "confirmed") { keys(value, ["version", "kind", "command", "client_id", "result"]); return { version: 2, kind: "confirmed", command: request.command, client_id: request.input.client_id, result: decodeSeriesResult(value.result, owner, request) }; }
  keys(value, ["version", "kind", "command", "client_id", "today", "consistency", "revisions", "data"]); exigir(value.kind === "review", "Estado da prévia inválido."); seriesDay(value.today); record(value.revisions); keys(value.revisions, ["requested_finance", "observed_finance", "requested_series", "observed_series"]);
  const expectedSeries = request.command === "finance.recurring.create" ? null : request.input.expected_revision;
  const requested_finance = publicSeriesRevision(value.revisions.requested_finance), observed_finance = publicSeriesRevision(value.revisions.observed_finance), requested_series = value.revisions.requested_series === null ? null : publicSeriesRevision(value.revisions.requested_series), observed_series = value.revisions.observed_series === null ? null : publicSeriesRevision(value.revisions.observed_series);
  exigir(requested_finance === request.input.expected_finance_revision && requested_series === expectedSeries && value.consistency === (requested_finance === observed_finance && requested_series === observed_series ? "same" : "changed"), "Revisões da prévia divergiram da intenção.");
  const data = projection(value.data, owner, request); exigir((data.series?.revision ?? null) === observed_series, "Série da prévia diverge da revisão observada."); return { version: 2, kind: "review", command: request.command, client_id: request.input.client_id, today: String(value.today), consistency: value.consistency as "same" | "changed", revisions: { requested_finance, observed_finance, requested_series, observed_series }, data };
}
