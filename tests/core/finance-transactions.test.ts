import { describe, expect, it } from "vitest";
import { criarAdapterMemoria, type PontoDeFalha } from "../../src/adapters/memory";
import { arquivarContaFinanceira, criarLancamentoFinanceiro, criarSerieFinanceira, encerrarSerieFinanceira, pagarFaturaFinanceira, transferirFinanceiro, duplicarLancamentoFinanceiro, totaisFinanceiros, saldosFinanceiros, faturaFinanceira, patrimonioFinanceiro, progressoOrcamentosFinanceiros, foraDeCompetenciaFinanceira, type CamposLancamentoFinanceiro } from "../../src/core/financeiro";
import { accounts, categories, transactions, budgets, expected, FINANCE_ACTOR, FINANCE_NOW } from "../fixtures/finance-regression";
const context = { user_id: FINANCE_ACTOR, canal: "web" as const };
function setup() {
  let count = 0, writes = 0, failWrite = 0; let fail: PontoDeFalha | null = null;
  const deps = { clock: { now: () => FINANCE_NOW }, ids: { next: () => `generated-${++count}` } };
  const store = criarAdapterMemoria({ ...deps, initial: { finance_account: accounts, finance_category: categories, finance_transaction: transactions, finance_budget: budgets }, beforeOperation(point) { if (point === "write" && ++writes === failWrite || point === fail) { fail = null; throw new Error("Failure injected"); } } });
  return { store, deps, read: store.read(FINANCE_ACTOR), fail: (point: PontoDeFalha) => { fail = point; }, secondWrite: () => { failWrite = writes + 2; } };
}
const fields: CamposLancamentoFinanceiro = { account_id: "cash", category_id: "food", kind: "expense", amount_cents: 10001, paid_cents: 0, description: "Série", payee: null, occurred_on: "2026-07-10", status: "confirmed", due_date: null, notes: null };
describe("T018 integrated financial regression: 20 manually calculated entries", () => {
  it("competence, balances, debt, refunds and lifecycle agree", () => {
    expect(transactions).toHaveLength(20);
    expect(totaisFinanceiros(transactions, accounts, ["2026-07-01"])).toEqual({ incomeCents: expected.income, expenseCents: expected.expense, balanceCents: expected.result, transactionCount: expected.count });
    expect(saldosFinanceiros(transactions, accounts).map(row => row.balance_cents)).toEqual([expected.cash, expected.reserve, -expected.debt]);
    expect(patrimonioFinanceiro(transactions, accounts)).toEqual({ patrimonioCents: expected.wealth, dividaCents: expected.debt });
    expect(faturaFinanceira(transactions, accounts[2]!, "2026-07-01")).toMatchObject({ totalCents: expected.statement, paidCents: expected.paid, openCents: expected.open });
    expect(progressoOrcamentosFinanceiros(budgets, transactions, categories, "2026-07-01", accounts)[0]).toMatchObject({ spentCents: expected.food });
    expect(foraDeCompetenciaFinanceira(transactions, accounts)).toEqual({ quantidade: 1, totalCents: expected.orphan });
  });
  it("transfer commits two legs and replay does not change wealth or events", async () => {
    const h = setup(), input = { client_id: "transfer", from_account_id: "cash", to_account_id: "reserve", amount_cents: 1000, occurred_on: "2026-07-10", description: "Reserva" };
    const [first, second] = await Promise.all([transferirFinanceiro(h.store, h.deps, context, input), transferirFinanceiro(h.store, h.deps, context, input)]);
    expect(first).toEqual(second); expect(first.transactions).toHaveLength(2); expect(await h.read.eventos.list()).toHaveLength(2);
    expect(patrimonioFinanceiro(await h.read.financeiro.lancamentos.list(), accounts)).toEqual({ patrimonioCents: expected.wealth, dividaCents: expected.debt });
    await expect(transferirFinanceiro(h.store, h.deps, context, { ...input, amount_cents: 2000 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each(["event", "commit"] as const)("failure at %s rolls back legs, events and receipt", async point => {
    const h = setup(), before = await h.read.financeiro.lancamentos.list(); h.fail(point);
    const input = { client_id: "failure", from_account_id: "cash", to_account_id: "reserve", amount_cents: 1000, occurred_on: "2026-07-10", description: "Reserva" };
    await expect(transferirFinanceiro(h.store, h.deps, context, input)).rejects.toThrow("Failure"); expect(await h.read.financeiro.lancamentos.list()).toEqual(before); expect(await h.read.eventos.list()).toEqual([]);
    expect((await transferirFinanceiro(h.store, h.deps, context, input)).transactions).toHaveLength(2);
  });
  it("failure between legs does not leave an orphan", async () => {
    const h = setup(), before = await h.read.financeiro.lancamentos.list(); h.secondWrite();
    await expect(transferirFinanceiro(h.store, h.deps, context, { client_id: "mid", from_account_id: "cash", to_account_id: "reserve", amount_cents: 1000, occurred_on: "2026-07-10", description: "Reserva" })).rejects.toThrow("Failure");
    expect(await h.read.financeiro.lancamentos.list()).toEqual(before); expect(await h.read.eventos.list()).toEqual([]);
  });
  it("partial payment reads the remaining statement and posts only charges in next cycle", async () => {
    const h = setup();
    const result = await pagarFaturaFinanceira(h.store, h.deps, context, { client_id: "payment", from_account_id: "cash", card_account_id: "card", statement_month: "2026-07-01", amount_cents: 4000, occurred_on: "2026-07-10", interest_rate_percent: 10, iof_cents: 100 });
    expect(result.charges).toMatchObject({ amount_cents: 1400, transfer_group_id: null, statement_month: "2026-08-01" });
    expect(faturaFinanceira(await h.read.financeiro.lancamentos.list(), accounts[2]!, "2026-07-01").openCents).toBe(13000);
    expect(await h.read.eventos.list()).toHaveLength(3);
    const next = await pagarFaturaFinanceira(h.store, h.deps, context, { client_id: "next", from_account_id: "cash", card_account_id: "card", statement_month: "2026-07-01", amount_cents: 13000, occurred_on: "2026-07-10", interest_rate_percent: 10, iof_cents: 100 });
    expect(next.charges).toBeNull();
  });
  it("12 installments conserve total and partial payment instead of multiplying it", async () => {
    const h = setup(), result = await criarSerieFinanceira(h.store, h.deps, context, { client_id: "installments", fields: { ...fields, paid_cents: 4000 }, serie_tipo: "parcelamento", count: 12 });
    expect(result.transactions).toHaveLength(12); expect(result.transactions.map(row => row.amount_cents)).toEqual([...Array(11).fill(833), 838]);
    expect(result.transactions.reduce((n, row) => n + row.amount_cents, 0)).toBe(10001); expect(result.transactions.reduce((n, row) => n + row.paid_cents, 0)).toBe(4000);
  });
  it("recurrence ending preserves first occurrence and past, rejects past cutoff", async () => {
    const h = setup(), series = await criarSerieFinanceira(h.store, h.deps, context, { client_id: "recurrence", fields: { ...fields, paid_cents: 2000 }, serie_tipo: "recorrencia", count: 3 });
    expect(series.transactions.map(row => row.amount_cents)).toEqual([10001, 10001, 10001]); expect(series.transactions.map(row => row.status)).toEqual(["confirmed", "planned", "planned"]);
    await expect(encerrarSerieFinanceira(h.store, h.deps, context, { client_id: "past", installment_group_id: series.group_id, from_on: "2026-07-09" })).rejects.toMatchObject({ code: "VALIDATION" });
    const ended = await encerrarSerieFinanceira(h.store, h.deps, context, { client_id: "stop", installment_group_id: series.group_id, from_on: "2026-07-10" }); expect(ended.transactions).toHaveLength(2); expect((await h.read.financeiro.lancamentos.get(series.transactions[0]!.id))?.deleted_at).toBeNull();
  });
  it("close account conserves transfer counterpart and full history", async () => {
    const h = setup(), before = await h.read.financeiro.lancamentos.list({ includeDeleted: true });
    await arquivarContaFinanceira(h.store, h.deps, context, { client_id: "close", id: "cash" });
    expect(await h.read.financeiro.lancamentos.list({ includeDeleted: true })).toEqual(before); expect((await h.read.financeiro.lancamentos.get("transfer-in"))?.amount_cents).toBe(7000);
    await expect(criarLancamentoFinanceiro(h.store, h.deps, context, { ...fields, client_id: "closed" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("duplicate preserves economic fields with a new identity and derives card cycle", async () => {
    const h = setup(), row = await duplicarLancamentoFinanceiro(h.store, h.deps, context, { client_id: "duplicate", id: "purchase-card", occurred_on: "2026-07-15" });
    expect(row.id).not.toBe("purchase-card"); expect(row).toMatchObject({ amount_cents: 20000, statement_month: "2026-08-01", transfer_group_id: null, installment_group_id: null });
  });
});
