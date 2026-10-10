import type { CategoriaFinanceira, ContaFinanceira, LancamentoFinanceiro, OrcamentoFinanceiro } from "../../src/core/financeiro";
import type { FinanceAccountBalance } from "../../src/core/financeiro/types";

/** Literal 18-row mass from the pinned reference; old code is never imported. */
export const LEGACY_V2_SOURCE = {
  commit: "a9422bcb90dc8965de4695570c9d338881e78975",
  origin: "https://github.com/kauanbarateli/segundo_cerebro/blob/a9422bcb90dc8965de4695570c9d338881e78975/src/lib/regressao-financeira.test.ts",
  sha256: "a188e2b48b315bcb59e3e69c5556452c585c8f5df008d765f6b08502b8e1f868",
  bytes: 29460,
} as const;
export const LEGACY_V2_MONTH = "2026-07-01";
export const LEGACY_V2_OWNER = "f1810000-0000-4000-8000-000000000001";
export const LEGACY_V2_CASH = "conta-corrente", LEGACY_V2_SAVINGS = "conta-poupanca", LEGACY_V2_CARD = "cartao-nubank";
export const LEGACY_V2_FOOD = "cat-alimentacao", LEGACY_V2_TRANSPORT = "cat-transporte", LEGACY_V2_SALARY = "cat-salario";
/** Only group IDs are remapped; account/category/transaction aliases stay literal. */
export const LEGACY_V2_GROUPS = {
  g1: "f1810000-0000-4000-8000-000000000401",
  tg1: "f1810000-0000-4000-8000-000000000402",
  tg2: "f1810000-0000-4000-8000-000000000403",
} as const;
const base = { user_id: LEGACY_V2_OWNER, created_at: "2026-07-01T12:00:00.000Z", updated_at: "2026-07-31T12:00:00.000Z" };
const account = (id: string, name: string, kind: ContaFinanceira["kind"]): ContaFinanceira => ({
  ...base, id, name, kind, institution: null, currency: "BRL", opening_balance_cents: 0, color_key: "fin-1", archived_at: null,
  credit_limit_cents: null, statement_closing_day: null, payment_due_day: null,
});
export const legacyV2Accounts: ContaFinanceira[] = [
  account(LEGACY_V2_CASH, "Conta corrente", "checking"),
  account(LEGACY_V2_SAVINGS, "Poupança", "savings"),
  { ...account(LEGACY_V2_CARD, "Nubank", "credit_card"), statement_closing_day: 22, payment_due_day: 5, credit_limit_cents: 500_000 },
];
const category = (id: string, name: string, kind: CategoriaFinanceira["kind"]): CategoriaFinanceira => ({ ...base, id, name, kind, normalized_name: name.toLowerCase(), color_key: "fin-1", parent_id: null });
export const legacyV2Categories: CategoriaFinanceira[] = [
  category(LEGACY_V2_FOOD, "Alimentação", "expense"), category(LEGACY_V2_TRANSPORT, "Transporte", "expense"), category(LEGACY_V2_SALARY, "Salário", "income"),
];
const row = (id: string, amount_cents: number, patch: Partial<LancamentoFinanceiro> = {}, oldIsPaid = true): LancamentoFinanceiro => ({
  ...base, id, account_id: LEGACY_V2_CASH, category_id: null, kind: "expense", amount_cents, paid_cents: oldIsPaid ? amount_cents : 0,
  description: "", payee: null, occurred_on: "2026-07-01", transfer_group_id: null, notes: null,
  installment_group_id: null, installment_no: null, installment_total: null, statement_month: null, serie_tipo: null,
  status: oldIsPaid ? "confirmed" : "pending", source: "manual", due_date: null, deleted_at: null, tag_ids: [], ...patch,
});
const cardRow = (id: string, amount: number, patch: Partial<LancamentoFinanceiro>): LancamentoFinanceiro => row(id, amount, { account_id: LEGACY_V2_CARD, ...patch });
export const legacyV2Transactions: LancamentoFinanceiro[] = [
  row("r1", 800_000, { kind: "income", category_id: LEGACY_V2_SALARY, occurred_on: "2026-07-05", description: "Salário" }),
  row("r2", 50_000, { kind: "income", occurred_on: "2026-07-20", description: "Freela" }),
  row("d1", 120_000, { category_id: LEGACY_V2_FOOD, occurred_on: "2026-07-03", description: "Mercado" }),
  row("d2", 30_000, { category_id: LEGACY_V2_TRANSPORT, occurred_on: "2026-07-08", description: "Combustível" }),
  row("d3", 45_000, { occurred_on: "2026-07-15", description: "Sem categoria" }),
  row("e1", 20_000, { kind: "income", category_id: LEGACY_V2_FOOD, occurred_on: "2026-07-12", description: "Estorno do mercado" }),
  cardRow("c1", 8_490, { category_id: LEGACY_V2_FOOD, occurred_on: "2026-06-25", statement_month: LEGACY_V2_MONTH, description: "Padaria" }),
  cardRow("c2", 15_000, { category_id: LEGACY_V2_TRANSPORT, occurred_on: "2026-07-10", statement_month: LEGACY_V2_MONTH, description: "Uber" }),
  cardRow("c3", 30_000, { category_id: LEGACY_V2_FOOD, occurred_on: "2026-07-25", statement_month: "2026-08-01", description: "Restaurante" }),
  cardRow("p1", 33_333, { occurred_on: "2026-07-02", statement_month: LEGACY_V2_MONTH, description: "Geladeira (1/3)", installment_group_id: LEGACY_V2_GROUPS.g1, installment_no: 1, installment_total: 3, serie_tipo: "parcelamento" }),
  cardRow("p2", 33_333, { occurred_on: "2026-07-02", statement_month: "2026-08-01", description: "Geladeira (2/3)", installment_group_id: LEGACY_V2_GROUPS.g1, installment_no: 2, installment_total: 3, serie_tipo: "parcelamento" }),
  cardRow("p3", 33_334, { occurred_on: "2026-07-02", statement_month: "2026-09-01", description: "Geladeira (3/3)", installment_group_id: LEGACY_V2_GROUPS.g1, installment_no: 3, installment_total: 3, serie_tipo: "parcelamento" }),
  row("t1", 200_000, { kind: "expense", account_id: LEGACY_V2_CASH, occurred_on: "2026-07-18", description: "Para poupança", transfer_group_id: LEGACY_V2_GROUPS.tg1 }),
  row("t2", 200_000, { kind: "income", account_id: LEGACY_V2_SAVINGS, occurred_on: "2026-07-18", description: "Da corrente", transfer_group_id: LEGACY_V2_GROUPS.tg1 }),
  row("f1", 40_000, { kind: "expense", account_id: LEGACY_V2_CASH, occurred_on: "2026-07-05", description: "Pagamento da fatura", transfer_group_id: LEGACY_V2_GROUPS.tg2 }),
  cardRow("f2", 40_000, { kind: "income", occurred_on: "2026-07-05", statement_month: LEGACY_V2_MONTH, description: "Pagamento da fatura", transfer_group_id: LEGACY_V2_GROUPS.tg2 }),
  row("x1", 99_900, { category_id: LEGACY_V2_FOOD, occurred_on: "2026-07-11", description: "Excluído por engano", deleted_at: "2026-07-11T12:00:00Z" }),
  row("pl1", 70_000, { category_id: LEGACY_V2_TRANSPORT, occurred_on: "2026-07-28", description: "Revisão do carro", status: "planned" }, false),
];
const budget = (id: string, category_id: string | null, limit_cents: number): OrcamentoFinanceiro => ({ ...base, id, category_id, month: LEGACY_V2_MONTH, limit_cents });
export const legacyV2Budgets: OrcamentoFinanceiro[] = [budget("b1", LEGACY_V2_FOOD, 200_000), budget("b2", LEGACY_V2_TRANSPORT, 50_000)];
export const legacyV2TotalPlan: OrcamentoFinanceiro = budget("plano", null, 400_000);

/** These are independent original view-like fixtures, NOT balances of the18rows. */
export const legacyV2IndependentBalances: FinanceAccountBalance[] = legacyV2Accounts.map((entry, index) => ({
  account_id: entry.id, user_id: LEGACY_V2_OWNER, name: entry.name, kind: entry.kind, currency: "BRL", opening_balance_cents: 0,
  balance_cents: [1_000_000, 500_000, -120_157][index]!, is_credit: entry.kind === "credit_card",
  debt_cents: entry.kind === "credit_card" ? 120_157 : 0, available_cents: entry.kind === "credit_card" ? 379_843 : null,
}));
