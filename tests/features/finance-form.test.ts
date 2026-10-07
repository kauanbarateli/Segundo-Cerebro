import { describe, expect, it } from "vitest";
import { accountDraft, accountFields, budgetDraft, budgetFields, categoryFields, FinanceFormError, sparseFinancePatch, transactionDraft, transactionFields, transactionPatch } from "../../src/components/features/financeiro/finance-form";
import { financePeriodSummary, financeRows, sumFinanceValues } from "../../src/components/features/financeiro/finance-model";
import { parseFinanceRoute } from "../../src/components/features/financeiro/finance-route";
import { createDemoFixture } from "../../src/lib/demo/fixtures";
import { faturaFinanceira, statusDaFatura, totaisFinanceiros, type LancamentoFinanceiro } from "../../src/core/financeiro";
import { formatBRL } from "../../src/core/dinheiro";

const data = createDemoFixture().initial;
const accounts = data.finance_account!;
const card = accounts.find((account) => account.kind === "credit_card")!;
const cash = accounts.find((account) => account.kind === "checking")!;
const transactions = data.finance_transaction!;
const purchase = transactions.find((row) => row.account_id === card.id && row.transfer_group_id === null)!;
const today = "2026-09-23";

describe("T011: formulários financeiros", () => {
  it("alterar descrição preserva pagamento e competência histórica do cartão", () => {
    const draft = { ...transactionDraft(today, purchase), description: "Compra revisada" };
    expect(transactionPatch(draft, accounts, purchase)).toEqual({ description: "Compra revisada" });
  });
  it("reduzir compra não envia pagamento derivado antigo nem uma segunda regra de cartão", () => {
    const draft = { ...transactionDraft(today, purchase), amount: "10,05" };
    expect(transactionPatch(draft, accounts, purchase)).toEqual({ amount_cents: 1005 });
  });
  it("competência em branco numa edição conserva a atribuição histórica", () => {
    const draft = { ...transactionDraft(today, purchase), statement: "" };
    expect(transactionPatch(draft, accounts, purchase)).toEqual({});
  });
  it("troca de conta solicita derivação em vez de transportar o mês do cartão anterior", () => {
    const another = { ...card, id: "second-card", statement_closing_day: 10 };
    const draft = { ...transactionDraft(today, purchase), account: another.id };
    expect(transactionPatch(draft, [...accounts, another], purchase)).toEqual({ account_id: another.id });
  });
  it("mover compra para conta comum remove a competência", () => {
    const draft = { ...transactionDraft(today, purchase), account: cash.id, statement: "" };
    expect(transactionPatch(draft, accounts, purchase)).toEqual({ account_id: cash.id, statement_month: null });
  });
  it("datas financeiras são dias civis e não mudam com o fuso do processo", () => {
    const draft = { ...transactionDraft(today), description: "Pagamento", account: cash.id, amount: "1.234,56", paid: "34,56", occurred: "2018-11-04", due: "2026-10-05" };
    expect(transactionFields(draft, accounts)).toMatchObject({ amount_cents: 123456, paid_cents: 3456, occurred_on: "2018-11-04", due_date: "2026-10-05", statement_month: null });
  });
  it("arredondamento decimal da entrada usa o calculador monetário", () => {
    const draft = { ...transactionDraft(today), description: "Precisão", account: cash.id, amount: "1,005" };
    expect(transactionFields(draft, accounts).amount_cents).toBe(101);
  });
  it.each(["0", "-1,00", "90071992547409,92", "sem valor"])("recusa valor inválido %s", (amount) => {
    expect(() => transactionFields({ ...transactionDraft(today), description: "Inválido", account: cash.id, amount }, accounts)).toThrow(FinanceFormError);
  });
  it("pagamento parcial de conta comum não pode ultrapassar o valor", () => {
    expect(() => transactionFields({ ...transactionDraft(today), description: "Inválido", account: cash.id, amount: "10", paid: "11" }, accounts)).toThrow(FinanceFormError);
  });
  it("recusa datas normalizadas para outro mês e conta ausente", () => {
    expect(() => transactionFields({ ...transactionDraft(today), description: "Inválido", amount: "10", occurred: "2026-02-30" }, accounts)).toThrow(FinanceFormError);
  });
  it("campos de cartão e saldo inicial negativo voltam em centavos exatos", () => {
    const fields = accountFields({ ...accountDraft(), name: "Cartão", kind: "credit_card", opening: "-10,01", limit: "8.000,00", closing: "31", due: "5" });
    expect(fields).toMatchObject({ opening_balance_cents: -1001, credit_limit_cents: 800000, statement_closing_day: 31, payment_due_day: 5 });
  });
  it.each(["0", "32", "2.5", "NaN"])("recusa dia de ciclo %s", (closing) => {
    expect(() => accountFields({ ...accountDraft(card), closing })).toThrow(FinanceFormError);
  });
  it("conta comum não recebe campos de ciclo que estavam no rascunho", () => {
    expect(accountFields({ ...accountDraft(card), kind: "checking" })).toMatchObject({ credit_limit_cents: null, statement_closing_day: null, payment_due_day: null });
  });
  it("patch esparso de conta preserva o tipo e todos os valores não alterados", () => {
    expect(sparseFinancePatch(accountFields({ ...accountDraft(cash), name: "Renomeada" }), cash)).toEqual({ name: "Renomeada" });
  });
  it("categoria e orçamento exigem nome/categoria e limite positivo", () => {
    expect(() => categoryFields({ name: " ", kind: "expense", color: "fin-1" })).toThrow(FinanceFormError);
    expect(() => budgetFields({ ...budgetDraft("2026-09-01"), limit: "0" })).toThrow(FinanceFormError);
    expect(budgetFields({ category: "category", month: "2026-09", limit: "1.500,00" })).toEqual({ category_id: "category", month: "2026-09-01", limit_cents: 150000 });
  });
});

describe("T011: fonte única de totais e estados", () => {
  it("Painel e Lançamentos usam o mesmo recorte que fecha o protótipo", () => {
    const route = parseFinanceRoute(new URLSearchParams("month=2026-09"), today);
    const rows = financeRows(transactions, accounts, route);
    const panel = financePeriodSummary(rows, accounts, route.month);
    expect(panel).toEqual(totaisFinanceiros(transactions, accounts, [route.month]));
    expect(panel).toMatchObject({ incomeCents: 800000, expenseCents: 324760, balanceCents: 475240 });
  });
  it("transferências podem ser listadas, mas não viram receita/despesa do recorte", () => {
    const route = parseFinanceRoute(new URLSearchParams("month=2026-09&kind=transfer"), today);
    const rows = financeRows(transactions, accounts, route);
    expect(rows).toHaveLength(2);
    expect(financePeriodSummary(rows, accounts, route.month)).toMatchObject({ incomeCents: 0, expenseCents: 0, balanceCents: 0 });
  });
  it("lixeira e estados previstos não entram nos totais reais", () => {
    const rows: LancamentoFinanceiro[] = [{ ...purchase, id: "trash", deleted_at: "2026-09-23T17:00:00Z" }, { ...purchase, id: "pending", status: "pending" }];
    const route = parseFinanceRoute(new URLSearchParams("month=2026-09&status=trash"), today);
    expect(financeRows(rows, accounts, route).map((row) => row.id)).toEqual(["trash"]);
    expect(financePeriodSummary(rows, accounts, route.month).expenseCents).toBe(0);
  });
  it.each([
    ["2026-09-23", 0, "aberta"], ["2026-09-29", 0, "fechada"],
    ["2026-09-29", 100, "parcial"], ["2026-09-29", 241280, "paga"], ["2026-10-06", 0, "vencida"],
  ] as const)("fatura deriva %s/%s como %s do mesmo universo", (day, payment, expected) => {
    const rows = [...transactions];
    if (payment) rows.push({ ...purchase, id: "statement-payment", kind: "income", category_id: null, transfer_group_id: "payment-group", amount_cents: payment, paid_cents: payment });
    const summary = faturaFinanceira(rows, card, "2026-09-01");
    expect(statusDaFatura({ hoje: day, mesFatura: "2026-09-01", diaFechamento: card.statement_closing_day!, diaVencimento: card.payment_due_day!, resumo: summary })).toBe(expected);
  });
  it("composição exata não depende da ordem e falha antes de arredondar um estouro", () => {
    expect(sumFinanceValues([Number.MAX_SAFE_INTEGER, 1, -1])).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => sumFinanceValues([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });
  it("a máscara fixa não revela sinal, número de dígitos ou centavos", () => {
    expect([-Number.MAX_SAFE_INTEGER, -1, 0, 1, 999999].map((value) => formatBRL(value, { hidden: true }))).toEqual(Array(5).fill("R$ ••••"));
  });
});
