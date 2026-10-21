import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ContaFinanceira, LancamentoFinanceiro } from "../../src/core/financeiro";
import { FinanceCompetenceChart } from "../../src/components/features/financeiro/finance-competence-chart";
import { accounts, transactions } from "../fixtures/finance-regression";

const base = transactions.find(row => row.id === "food-cash")!;
const row = (patch: Partial<LancamentoFinanceiro>): LancamentoFinanceiro => ({ ...base, ...patch });
const actions = { retry() {}, revealValues() {}, openTransactions() {} };
const render = (rows: readonly LancamentoFinanceiro[] = transactions, hidden = false, scopedAccounts: readonly ContaFinanceira[] = accounts) => renderToStaticMarkup(<FinanceCompetenceChart transactions={rows} accounts={scopedAccounts} month="2026-07-01" hidden={hidden} {...actions} />).replace(/\u00a0/g, " ");

describe("SPEC-08: apresentação da análise mensal, sem navegador ou transporte", () => {
  it("apresenta os totais do recorte, todos os dias e a regra da competência", () => {
    const html = render();
    expect(html).toContain("Entradas e despesas do mês");
    expect(html).toContain("por competência, com os filtros atuais");
    expect(html).toContain('<dt>Entradas</dt><dd class="finance-income"><span class="finance-money">R$ 1.040,00</span>');
    expect(html).toContain('<dt>Saídas</dt><dd><span class="finance-money">R$ 380,00</span>');
    expect(html).toContain('<dt>Resultado</dt><dd><span class="finance-money">R$ 660,00</span>');
    expect(html).toContain('<th scope="row">31/07/2026</th><td>R$ 1.040,00</td><td>R$ 380,00</td><td>R$ 660,00</td>');
    expect(html).toContain("inclusive pagamentos parciais");
    expect(html).toContain("Esta análise não é o saldo das contas");
    expect(html).toContain('aria-label="Tabela de valores acumulados" tabindex="0"');
    expect(html).toContain("<summary>Ver dados e cálculo</summary>");
    for (const id of ["planned", "pending", "cancelled", "deleted", "future-installment", "transfer-out", "pay-in"]) expect(html).not.toContain(`<th scope="row">${id}</th>`);
  });

  it("conserva datas antes e depois do mês no ponto inicial, sem atribuir caixa", () => {
    const html = render([
      row({ id: "before", description: "Compra anterior", account_id: "card", occurred_on: "2026-06-30", statement_month: "2026-07-01", amount_cents: 12345, paid_cents: 0 }),
      row({ id: "after", description: "Data posterior", account_id: "card", occurred_on: "2026-08-02", statement_month: "2026-07-01", amount_cents: 54321, paid_cents: 0 }),
    ]);
    expect(html).toContain('<th scope="row">Anteriores desta competência</th><td>R$ 0,00</td><td>R$ 666,66</td><td>-R$ 666,66</td>');
    expect(html).toContain('<th scope="row">31/07/2026</th><td>R$ 0,00</td><td>R$ 666,66</td><td>-R$ 666,66</td>');
    expect(html).toContain('<th scope="row">Compra anterior</th><td>30/06/2026</td><td>julho de 2026</td>');
    expect(html).toContain('<th scope="row">Data posterior</th><td>02/08/2026</td><td>julho de 2026</td>');
  });

  it("a máscara remove geometria, tabelas, sinal e cores dependentes de valores", () => {
    const positive = [row({ id: "income", kind: "income", amount_cents: 123456, paid_cents: 123456 }), row({ id: "expense", amount_cents: 100, paid_cents: 100 })];
    const negative = [row({ id: "income", kind: "income", amount_cents: 100, paid_cents: 100 }), row({ id: "expense", amount_cents: 987654, paid_cents: 987654 })];
    const html = render(positive, true);
    expect(html).toBe(render(negative, true));
    expect(html.match(/R\$ ••••/g)).toHaveLength(3);
    for (const forbidden of ["polyline", "<circle", "<table", "<details", "aria-valuenow", "aria-valuetext", "finance-income", "finance-competence-legend", "1.234,56", "9.876,54"]) expect(html).not.toContain(forbidden);
    expect(html).toContain("Exibir valores da análise");
    expect(html).not.toContain("<dd>-R$");
  });

  it("também oculta a distinção entre recorte vazio e não vazio", () => {
    expect(render([], true)).toBe(render([row({})], true));
  });

  it.each([
    { reason: "outro owner", rows: [row({ user_id: "other-owner" })] },
    { reason: "data inválida", rows: [row({ occurred_on: "2026-07-32" })] },
    { reason: "ID duplicado", rows: [row({}), row({})] },
  ])("$reason falha sem virar vazio ou total inventado", ({ rows }) => {
    const html = render(rows);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Recarregar análise");
    expect(html).not.toContain("Nenhuma entrada");
    expect(html).not.toContain("<dl");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("other-owner");
  });

  it("distingue ausência de movimentos, resultado zero e órfão sem competência", () => {
    const empty = render([]);
    expect(empty).toContain("Nenhuma entrada ou despesa realizada");
    expect(empty).not.toContain('role="alert"');
    const balanced = render([row({ id: "in", kind: "income" }), row({ id: "out" })]);
    expect(balanced).not.toContain("Nenhuma entrada ou despesa realizada");
    expect(balanced).toContain("<polyline");
    const orphan = render(transactions.filter(item => item.id === "orphan"));
    expect(orphan).toContain("Há lançamentos sem competência neste recorte");
    expect(orphan).not.toContain('<th scope="row">orphan</th>');
    expect(orphan).not.toContain("R$ 40,00");
  });

  it("pagamento da fatura e transferência não duplicam os dados apresentados", () => {
    const purchase = transactions.filter(item => item.id === "purchase-card");
    const pairs = transactions.filter(item => ["pay-out", "pay-in", "transfer-out", "transfer-in"].includes(item.id));
    expect(render([...purchase, ...pairs])).toBe(render(purchase));
  });
});
