import type { ContaFinanceira, CategoriaFinanceira, LancamentoFinanceiro, OrcamentoFinanceiro } from "../../src/core/financeiro";
/** New, explicitly authored integrated mass. It does not claim to be the missing legacy v2 file. */
export const FINANCE_ACTOR = "10000000-0000-4000-8000-000000000001";
export const FINANCE_NOW = "2026-07-10T12:00:00.000Z";
const base = { user_id: FINANCE_ACTOR, created_at: FINANCE_NOW, updated_at: FINANCE_NOW };
export const accounts: ContaFinanceira[] = [
  { ...base, id: "cash", name: "Conta corrente", kind: "checking", institution: null, currency: "BRL", opening_balance_cents: 100000, color_key: "fin-1", archived_at: null, credit_limit_cents: null, statement_closing_day: null, payment_due_day: null },
  { ...base, id: "reserve", name: "Reserva", kind: "savings", institution: null, currency: "BRL", opening_balance_cents: 200000, color_key: "fin-2", archived_at: null, credit_limit_cents: null, statement_closing_day: null, payment_due_day: null },
  { ...base, id: "card", name: "Cartão", kind: "credit_card", institution: null, currency: "BRL", opening_balance_cents: 0, color_key: "fin-3", archived_at: null, credit_limit_cents: 100000, statement_closing_day: 15, payment_due_day: 25 },
];
export const categories: CategoriaFinanceira[] = [
  { ...base, id: "food", name: "Alimentação", normalized_name: "alimentacao", kind: "expense", parent_id: null, color_key: "fin-1" },
  { ...base, id: "bills", name: "Contas", normalized_name: "contas", kind: "expense", parent_id: null, color_key: "fin-2" },
  { ...base, id: "salary", name: "Receita", normalized_name: "receita", kind: "income", parent_id: null, color_key: "fin-3" },
];
const row = (id: string, amount_cents: number, patch: Partial<LancamentoFinanceiro> = {}): LancamentoFinanceiro => ({ ...base, id, account_id: "cash", category_id: "food", kind: "expense", amount_cents, paid_cents: amount_cents, description: id, payee: null, occurred_on: "2026-07-10", transfer_group_id: null, installment_group_id: null, installment_no: null, installment_total: null, serie_tipo: null, statement_month: null, source: "manual", status: "confirmed", deleted_at: null, due_date: null, notes: null, tag_ids: [], ...patch });
export const transactions: LancamentoFinanceiro[] = [
  row("salary-received", 100000, { kind: "income", category_id: "salary" }),
  row("food-cash", 10000), row("refund-cash", 2000, { kind: "income" }), row("partial-cash", 5000, { paid_cents: 2000 }),
  row("purchase-card", 20000, { account_id: "card", paid_cents: 20000, occurred_on: "2026-06-30", statement_month: "2026-07-01" }),
  row("refund-card", 2000, { account_id: "card", kind: "income", statement_month: "2026-07-01" }),
  row("transfer-out", 7000, { transfer_group_id: "transfer", category_id: null }), row("transfer-in", 7000, { account_id: "reserve", kind: "income", transfer_group_id: "transfer", category_id: null }),
  row("pay-out", 5000, { transfer_group_id: "payment", category_id: null }), row("pay-in", 5000, { account_id: "card", kind: "income", transfer_group_id: "payment", category_id: null, statement_month: "2026-07-01" }),
  row("planned", 9000, { status: "planned", paid_cents: 0 }), row("pending", 8000, { status: "pending", paid_cents: 0 }), row("cancelled", 7000, { status: "cancelled", paid_cents: 0 }),
  row("deleted", 6000, { deleted_at: FINANCE_NOW }), row("reconciled", 3000, { status: "reconciled", category_id: "bills" }),
  row("future-installment", 10001, { account_id: "card", installment_group_id: "installments", installment_no: 1, installment_total: 12, serie_tipo: "parcelamento", statement_month: "2026-08-01", occurred_on: "2026-08-10" }),
  row("future-recurring", 12000, { account_id: "card", source: "recurring", installment_group_id: "recurring", installment_no: 1, installment_total: 12, serie_tipo: "recorrencia", statement_month: "2026-09-01", occurred_on: "2026-09-10", status: "planned" }),
  row("orphan", 4000, { account_id: "card" }), row("pending-card", 1000, { account_id: "card", statement_month: "2026-07-01", status: "pending" }),
  row("deleted-card", 2000, { account_id: "card", statement_month: "2026-07-01", deleted_at: FINANCE_NOW }),
];
export const budgets: OrcamentoFinanceiro[] = [{ ...base, id: "food-budget", category_id: "food", month: "2026-07-01", limit_cents: 40000 }];
/** All values below calculated by hand, independent of implementation. */
// The historical statement fallback includes the 4000 orphan; competence totals flag/exclude it.
export const expected = { income: 104000, expense: 38000, result: 66000, count: 7, cash: 175000, reserve: 207000, debt: 27001, wealth: 382000, statement: 22000, paid: 5000, open: 17000, food: 31000, orphan: 4000 };
