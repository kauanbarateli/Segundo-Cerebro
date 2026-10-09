import type { CamposContaFinanceira, CamposCategoriaFinanceira, CamposLancamentoFinanceiro, ContaFinanceira, CategoriaFinanceira, LancamentoFinanceiro, OrcamentoFinanceiro, StatusLancamento } from "../../../core/financeiro";
import { formatCentsPlain, parseBRLToCents } from "../../../core/dinheiro";
import { instanteDe, SO_DATA } from "../../../core/tempo";

export type FinanceErrors = Record<string, string | undefined>;
export class FinanceFormError extends Error {
  constructor(public readonly fields: FinanceErrors) { super("Confira os campos indicados."); this.name = "FinanceFormError"; }
}
export const TRANSACTION_STATUS: Record<StatusLancamento, string> = { planned: "Planejado", pending: "Pendente", confirmed: "Confirmado", reconciled: "Conciliado", cancelled: "Cancelado" };
export const ACCOUNT_KINDS: Record<ContaFinanceira["kind"], string> = { checking: "Conta corrente", savings: "Poupança", credit_card: "Cartão de crédito", cash: "Dinheiro", investment: "Investimento", other: "Outra conta" };
export const FINANCE_COLORS = ["fin-1", "fin-2", "fin-3", "fin-4", "fin-5", "fin-6"] as const;
export const FINANCE_COLOR_LABELS = ["Verde", "Índigo", "Ciano", "Violeta", "Terracota", "Cinza"] as const;
const nullable = (value: string) => value.trim() || null;
function money(value: string, key: string, errors: FinanceErrors, min = 0): number {
  const parsed = parseBRLToCents(value);
  if (parsed === null || parsed < min) { errors[key] = min === 1 ? "Informe um valor maior que zero." : min === 0 ? "Informe um valor igual ou maior que zero." : "Informe um valor monetário válido."; return 0; }
  return parsed;
}
function text(value: string, key: string, max: number, errors: FinanceErrors, required = false): string {
  const result = value.trim();
  if (result.length > max || required && !result) errors[key] = `Informe ${required ? "um texto de " : "até "}${required ? "até " : ""}${max} caracteres.`;
  return result;
}
function day(value: string, key: string, errors: FinanceErrors, required = false): string | null {
  if (!value && !required) return null;
  if (!SO_DATA.test(value) || instanteDe(value) === null) errors[key] = "Informe uma data válida.";
  return value || null;
}
function throwErrors(errors: FinanceErrors) { if (Object.keys(errors).length) throw new FinanceFormError(errors); }
export function sparseFinancePatch<T extends object>(fields: T, original: object): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([key, value]) => value !== (original as Record<string, unknown>)[key])) as Partial<T>;
}

export interface TransactionDraft {
  description: string; kind: "income" | "expense"; amount: string; paid: string;
  account: string; category: string; occurred: string; status: StatusLancamento;
  due: string; payee: string; notes: string; statement: string;
  tags: string[];
}
export function transactionDraft(today: string, row?: LancamentoFinanceiro): TransactionDraft {
  return { description: row?.description ?? "", kind: row?.kind ?? "expense", amount: row ? formatCentsPlain(row.amount_cents) : "", paid: row ? formatCentsPlain(row.paid_cents) : "0,00",
    account: row?.account_id ?? "", category: row?.category_id ?? "", occurred: row?.occurred_on ?? today, status: row?.status ?? "confirmed",
    due: row?.due_date ?? "", payee: row?.payee ?? "", notes: row?.notes ?? "", statement: row?.statement_month?.slice(0, 7) ?? "", tags: [...row?.tag_ids ?? []] };
}
export function transactionFields(draft: TransactionDraft, accounts: readonly ContaFinanceira[], original?: LancamentoFinanceiro): CamposLancamentoFinanceiro {
  const errors: FinanceErrors = {};
  const account = accounts.find((row) => row.id === draft.account && row.archived_at === null);
  if (!account) errors.account = "Selecione uma conta disponível.";
  const amount = money(draft.amount, "amount", errors, 1);
  const paid = money(draft.paid, "paid", errors);
  const isCardPurchase = account?.kind === "credit_card" && draft.kind === "expense";
  if (!isCardPurchase && paid > amount) errors.paid = "O pagamento não pode ultrapassar o valor.";
  const fields: CamposLancamentoFinanceiro = { description: text(draft.description, "description", 200, errors, true), kind: draft.kind,
    amount_cents: amount, paid_cents: isCardPurchase ? 0 : paid, account_id: draft.account, category_id: draft.category || null,
    occurred_on: day(draft.occurred, "occurred", errors, true) ?? "", status: draft.status, due_date: day(draft.due, "due", errors),
    payee: nullable(text(draft.payee, "payee", 120, errors)), notes: nullable(text(draft.notes, "notes", 5000, errors)), ...(draft.tags.length || original?.tag_ids?.length ? { tag_ids: [...draft.tags] } : {}) };
  if (account?.kind === "credit_card") {
    if (draft.statement) { const month = `${draft.statement}-01`; day(month, "statement", errors, true); fields.statement_month = month; }
    else if (original && original.account_id === draft.account) fields.statement_month = original.statement_month;
  } else fields.statement_month = null;
  throwErrors(errors);
  return fields;
}
export function transactionPatch(draft: TransactionDraft, accounts: readonly ContaFinanceira[], original: LancamentoFinanceiro): Partial<CamposLancamentoFinanceiro> {
  const fields = transactionFields(draft, accounts, original);
  const patch = sparseFinancePatch(fields, original);
  // The card payment is derived in the domain. Ordinary edits never overwrite it.
  const account = accounts.find((row) => row.id === draft.account);
  if (account?.kind === "credit_card" && draft.kind === "expense") delete patch.paid_cents;
  // Choosing another account with an untouched historical month requests derivation.
  if (draft.account !== original.account_id && draft.statement === (original.statement_month?.slice(0, 7) ?? "")) delete patch.statement_month;
  if ([...draft.tags].sort().join("\u0000") === [...original.tag_ids ?? []].sort().join("\u0000")) delete patch.tag_ids;
  return patch;
}

export function tagFields(draft: { name: string; color: string }) { const errors: FinanceErrors = {}; const fields = { name: text(draft.name, "name", 80, errors, true), color_key: draft.color }; throwErrors(errors); return fields; }

export interface AccountDraft { name: string; kind: ContaFinanceira["kind"]; institution: string; opening: string; color: string; limit: string; closing: string; due: string }
export function accountDraft(account?: ContaFinanceira): AccountDraft {
  return { name: account?.name ?? "", kind: account?.kind ?? "checking", institution: account?.institution ?? "", opening: formatCentsPlain(account?.opening_balance_cents ?? 0), color: account?.color_key ?? "fin-1",
    limit: account?.credit_limit_cents === null || account?.credit_limit_cents === undefined ? "" : formatCentsPlain(account.credit_limit_cents), closing: account?.statement_closing_day?.toString() ?? "", due: account?.payment_due_day?.toString() ?? "" };
}
export function accountFields(draft: AccountDraft): CamposContaFinanceira {
  const errors: FinanceErrors = {};
  const cycleDay = (key: "closing" | "due") => { const value = Number(draft[key]); if (!/^\d+$/.test(draft[key]) || !Number.isInteger(value) || value < 1 || value > 31) errors[key] = "Informe um dia entre 1 e 31."; return value; };
  const fields: CamposContaFinanceira = { name: text(draft.name, "name", 120, errors, true), kind: draft.kind, institution: nullable(text(draft.institution, "institution", 120, errors)),
    opening_balance_cents: money(draft.opening, "opening", errors, -Number.MAX_SAFE_INTEGER), color_key: draft.color,
    credit_limit_cents: draft.kind === "credit_card" ? money(draft.limit, "limit", errors) : null,
    statement_closing_day: draft.kind === "credit_card" ? cycleDay("closing") : null, payment_due_day: draft.kind === "credit_card" ? cycleDay("due") : null };
  throwErrors(errors); return fields;
}
export interface CategoryDraft { name: string; kind: CategoriaFinanceira["kind"]; color: string }
export function categoryDraft(category?: CategoriaFinanceira): CategoryDraft { return { name: category?.name ?? "", kind: category?.kind ?? "expense", color: category?.color_key ?? "fin-1" }; }
export function categoryFields(draft: CategoryDraft): CamposCategoriaFinanceira {
  const errors: FinanceErrors = {}; const fields: CamposCategoriaFinanceira = { name: text(draft.name, "name", 80, errors, true), kind: draft.kind, color_key: draft.color }; throwErrors(errors); return fields;
}
export interface BudgetDraft { category: string; month: string; limit: string }
export function budgetDraft(month: string, budget?: OrcamentoFinanceiro): BudgetDraft { return { category: budget?.category_id ?? "", month: (budget?.month ?? month).slice(0, 7), limit: budget ? formatCentsPlain(budget.limit_cents) : "" }; }
export function budgetFields(draft: BudgetDraft) {
  const errors: FinanceErrors = {}; if (!draft.category) errors.category = "Selecione uma categoria de despesa.";
  const month = day(`${draft.month}-01`, "month", errors, true) ?? ""; const limit_cents = money(draft.limit, "limit", errors, 1); throwErrors(errors);
  return { category_id: draft.category, month, limit_cents };
}

export interface TransferDraft { description: string; from: string; to: string; amount: string; occurred: string }
export function transferDraft(today: string): TransferDraft { return { description: "Transferência entre contas", from: "", to: "", amount: "", occurred: today }; }
export function transferFields(draft: TransferDraft, accounts: readonly ContaFinanceira[]) {
  const errors: FinanceErrors = {};
  const available = (id: string) => accounts.some((row) => row.id === id && row.archived_at === null && row.kind !== "credit_card");
  if (!available(draft.from)) errors.from = "Selecione uma conta de origem disponível.";
  if (!available(draft.to)) errors.to = "Selecione uma conta de destino disponível.";
  else if (draft.from === draft.to) errors.to = "Escolha uma conta diferente da origem.";
  const fields = { description: text(draft.description, "description", 200, errors, true), from_account_id: draft.from, to_account_id: draft.to,
    amount_cents: money(draft.amount, "amount", errors, 1), occurred_on: day(draft.occurred, "occurred", errors, true) ?? "" };
  throwErrors(errors); return fields;
}

export interface StatementPaymentDraft { from: string; amount: string; occurred: string; rate: string; iof: string }
export function statementPaymentDraft(today: string, openCents: number): StatementPaymentDraft { return { from: "", amount: formatCentsPlain(Math.max(0, openCents)), occurred: today, rate: "", iof: "" }; }
export function statementPaymentFields(draft: StatementPaymentDraft, accounts: readonly ContaFinanceira[], cardId: string, month: string) {
  const errors: FinanceErrors = {};
  if (!accounts.some((row) => row.id === draft.from && row.archived_at === null && row.kind !== "credit_card")) errors.from = "Selecione uma conta para pagar a fatura.";
  if (!accounts.some((row) => row.id === cardId && row.archived_at === null && row.kind === "credit_card")) errors.card = "Este cartão não está disponível.";
  const rate = draft.rate.trim() ? Number(draft.rate.replace(",", ".")) : undefined;
  if (rate !== undefined && (!/^\d+(?:[,.]\d+)?$/.test(draft.rate.trim()) || !Number.isFinite(rate) || rate < 0)) errors.rate = "Informe uma taxa igual ou maior que zero.";
  const fields = { from_account_id: draft.from, card_account_id: cardId, statement_month: day(month, "month", errors, true) ?? "",
    amount_cents: money(draft.amount, "amount", errors, 1), occurred_on: day(draft.occurred, "occurred", errors, true) ?? "",
    ...(rate === undefined ? {} : { interest_rate_percent: rate }), ...(draft.iof.trim() ? { iof_cents: money(draft.iof, "iof", errors) } : {}) };
  throwErrors(errors); return fields;
}
export function seriesFields(fields: CamposLancamentoFinanceiro, serie_tipo: "parcelamento" | "recorrencia", countText: string) {
  const count = Number(countText), errors: FinanceErrors = {};
  if (!/^\d+$/.test(countText) || !Number.isInteger(count) || count < 2 || count > 120) errors.count = "Informe de 2 a 120 ocorrências.";
  if (serie_tipo === "parcelamento" && fields.amount_cents < count) errors.count = "O total precisa permitir ao menos um centavo por parcela.";
  throwErrors(errors); return { fields, serie_tipo, count };
}
export function requiredFinanceDay(value: string, key = "occurred", min?: string): string { const errors: FinanceErrors = {}; const result = day(value, key, errors, true) ?? ""; if (min && result < min) errors[key] = "Escolha hoje ou uma data futura."; throwErrors(errors); return result; }
