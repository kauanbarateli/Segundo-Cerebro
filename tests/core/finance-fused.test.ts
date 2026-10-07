import { describe, expect, it } from "vitest";
import {
  normalizarPagamento, totaisFinanceiros, faturaFinanceira, foraDeCompetenciaFinanceira,
  progressoOrcamentosFinanceiros, saldosFinanceiros, patrimonioFinanceiro, statusDaFatura,
  type ContaFinanceira, type LancamentoFinanceiro, type CategoriaFinanceira, type OrcamentoFinanceiro,
  type StatusLancamento,
} from "../../src/core/financeiro";

const conta = (overrides: Partial<ContaFinanceira> = {}): ContaFinanceira => ({
  id: "conta", user_id: "usuario", name: "Conta de exemplo", kind: "checking", institution: null,
  currency: "BRL", opening_balance_cents: 0, color_key: "stone", archived_at: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  credit_limit_cents: null, statement_closing_day: null, payment_due_day: null, ...overrides,
});
const cartao = conta({ id: "cartao", kind: "credit_card", statement_closing_day: 15, payment_due_day: 25, credit_limit_cents: 100_000 });
const tx = (overrides: Partial<LancamentoFinanceiro> = {}): LancamentoFinanceiro => ({
  id: "lancamento", user_id: "usuario", account_id: "conta", category_id: "despesa", kind: "expense",
  amount_cents: 1000, paid_cents: 1000, description: "Exemplo", payee: null, occurred_on: "2026-07-10",
  transfer_group_id: null, notes: null, created_at: "2026-07-10T00:00:00Z", updated_at: "2026-07-10T00:00:00Z",
  installment_group_id: null, installment_no: null, installment_total: null, statement_month: null,
  serie_tipo: null, status: "confirmed", source: "manual", due_date: null, deleted_at: null, ...overrides,
});
const categoria: CategoriaFinanceira = {
  id: "despesa", user_id: "usuario", name: "Alimentação", normalized_name: "alimentacao", kind: "expense",
  parent_id: null, color_key: "stone", created_at: "", updated_at: "",
};
const orcamento: OrcamentoFinanceiro = {
  id: "orcamento", user_id: "usuario", category_id: "despesa", month: "2026-07-01", limit_cents: 1000,
  created_at: "", updated_at: "",
};

describe("D-006: massa controlada de ciclo de vida e pagamento", () => {
  it.each<StatusLancamento>(["planned", "pending", "confirmed", "reconciled", "cancelled"])("status %s participa somente quando realizado", (status) => {
    const count = status === "confirmed" || status === "reconciled" ? 1 : 0;
    const lancamentos = [tx({ status })];
    expect(totaisFinanceiros(lancamentos, [conta()], ["2026-07-01"])).toMatchObject({ expenseCents: count * 1000, transactionCount: count });
    expect(saldosFinanceiros(lancamentos, [conta()])[0]?.balance_cents).toBe(count ? -1000 : 0);
  });

  it("excluir tira de todos os reais; restaurar devolve sem alterar pagamento", () => {
    const original = tx({ deleted_at: "2026-07-11T00:00:00Z", paid_cents: 400 });
    expect(totaisFinanceiros([original], [conta()], ["2026-07-01"]).expenseCents).toBe(0);
    expect(progressoOrcamentosFinanceiros([orcamento], [original], [categoria], "2026-07-01", [conta()])[0]?.spentCents).toBe(0);
    const restored = { ...original, deleted_at: null };
    expect(totaisFinanceiros([restored], [conta()], ["2026-07-01"]).expenseCents).toBe(1000);
    expect(saldosFinanceiros([restored], [conta()])[0]?.balance_cents).toBe(-400);
    expect(original.deleted_at).not.toBeNull();
  });

  it("normaliza uma compra de cartão em um único ponto sem mudar status ou entrada", () => {
    const original = Object.freeze(tx({ account_id: "cartao", paid_cents: 0, status: "planned", statement_month: "2026-07-01" }));
    expect(normalizarPagamento(original, cartao)).toMatchObject({ paid_cents: 1000, is_paid: true, status: "planned" });
    expect(original.paid_cents).toBe(0);
    expect(normalizarPagamento(tx({ paid_cents: 400 }), conta())).toMatchObject({ paid_cents: 400, is_paid: false });
    expect(normalizarPagamento(tx(), conta()).is_paid).toBe(true);
  });

  it("mantém a competência histórica ao mudar o fechamento do cartão", () => {
    const compra = tx({ account_id: "cartao", occurred_on: "2026-06-20", statement_month: "2026-07-01", paid_cents: 0 });
    expect(totaisFinanceiros([compra], [cartao], ["2026-06-01"]).expenseCents).toBe(0);
    expect(totaisFinanceiros([compra], [cartao], ["2026-07-01"]).expenseCents).toBe(1000);
    expect(faturaFinanceira([compra], { ...cartao, statement_closing_day: 28 }, "2026-07-01").totalCents).toBe(1000);
    expect(foraDeCompetenciaFinanceira([{ ...compra, statement_month: null }], [cartao])).toEqual({ quantidade: 1, totalCents: 1000 });
  });

  it("recusa centavos inválidos e relações de conta de outro usuário", () => {
    expect(() => normalizarPagamento(tx({ amount_cents: 0, paid_cents: 0 }), conta())).toThrow(RangeError);
    expect(() => normalizarPagamento(tx({ paid_cents: 1001 }), conta())).toThrow(RangeError);
    expect(() => normalizarPagamento(tx({ paid_cents: 0.5 }), conta())).toThrow(RangeError);
    expect(() => totaisFinanceiros([tx()], [], ["2026-07-01"])).toThrow(/conta/);
    expect(() => totaisFinanceiros([tx({ user_id: "outro" })], [conta()], ["2026-07-01"])).toThrow(/usuário/);
    expect(() => saldosFinanceiros([tx({ kind: "income" })], [conta({ opening_balance_cents: Number.MAX_SAFE_INTEGER })])).toThrow(RangeError);
  });
});

describe("D-006: fatura derivada e patrimônio", () => {
  it("pagamento parcial reduz dívida e caixa sem virar nova despesa", () => {
    const corrente = conta({ opening_balance_cents: 10_000 });
    const lancamentos = [
      tx({ id: "compra", account_id: "cartao", amount_cents: 4000, paid_cents: 0, statement_month: "2026-07-01" }),
      tx({ id: "pagamento-saida", amount_cents: 2000, paid_cents: 2000, transfer_group_id: "pagamento" }),
      tx({ id: "pagamento-entrada", account_id: "cartao", kind: "income", amount_cents: 2000, paid_cents: 2000, transfer_group_id: "pagamento", statement_month: "2026-07-01" }),
    ];
    const fatura = faturaFinanceira(lancamentos, cartao, "2026-07-01");
    expect(fatura).toMatchObject({ totalCents: 4000, paidCents: 2000, openCents: 2000 });
    expect(patrimonioFinanceiro(lancamentos, [corrente, cartao])).toEqual({ patrimonioCents: 8000, dividaCents: 2000 });
    expect(totaisFinanceiros(lancamentos, [corrente, cartao], ["2026-07-01"])).toMatchObject({ expenseCents: 4000, incomeCents: 0, transactionCount: 1 });
  });

  it("duas pernas de transferência entre contas não aumentam patrimônio", () => {
    const contas = [conta({ opening_balance_cents: 10_000 }), conta({ id: "reserva", kind: "savings" })];
    const lancamentos = [tx({ id: "saida", transfer_group_id: "transferencia" }), tx({ id: "entrada", kind: "income", account_id: "reserva", transfer_group_id: "transferencia" })];
    expect(saldosFinanceiros(lancamentos, contas).map((saldo) => saldo.balance_cents)).toEqual([9000, 1000]);
    expect(patrimonioFinanceiro(lancamentos, contas)).toEqual({ patrimonioCents: 10_000, dividaCents: 0 });
    expect(progressoOrcamentosFinanceiros([orcamento], lancamentos, [categoria], "2026-07-01", contas)[0]?.spentCents).toBe(0);
  });

  it("arquivar conta preserva a perna da transferência na conta que continua ativa", () => {
    const contas = [conta({ archived_at: "2026-07-12T00:00:00Z", opening_balance_cents: 10_000 }), conta({ id: "reserva" })];
    const lancamentos = [tx({ transfer_group_id: "transferencia" }), tx({ id: "entrada", kind: "income", account_id: "reserva", transfer_group_id: "transferencia" })];
    expect(patrimonioFinanceiro(lancamentos, contas)).toEqual({ patrimonioCents: 1000, dividaCents: 0 });
  });

  it("fatura ignora previstos/excluídos e preserva crédito de pagamento a maior", () => {
    const compra = tx({ account_id: "cartao", statement_month: "2026-07-01" });
    const pagamento = tx({ id: "pagamento", account_id: "cartao", kind: "income", amount_cents: 1500, paid_cents: 1500, transfer_group_id: "p", statement_month: "2026-07-01" });
    const fatura = faturaFinanceira([compra, pagamento, tx({ ...compra, id: "previsto", status: "pending" }), tx({ ...compra, id: "excluido", deleted_at: "2026-07-12T00:00:00Z" })], cartao, "2026-07-01");
    expect(fatura).toMatchObject({ totalCents: 1000, paidCents: 1500, openCents: -500 });
    expect(statusDaFatura({ hoje: "2026-08-01", mesFatura: "2026-07-01", diaFechamento: 15, diaVencimento: 25, resumo: fatura })).toBe("paga");
    expect(() => faturaFinanceira([], conta(), "2026-07-01")).toThrow(/cartão/);
  });

  it("estorno após soma intermediária alta não perde centavo na fatura ou nos órfãos", () => {
    const max = Number.MAX_SAFE_INTEGER;
    const lancamentos = [
      tx({ id: "compra-alta", account_id: "cartao", amount_cents: max, paid_cents: max, statement_month: "2026-07-01" }),
      tx({ id: "compra", account_id: "cartao", amount_cents: 2, paid_cents: 2, statement_month: "2026-07-01" }),
      tx({ id: "estorno", account_id: "cartao", kind: "income", amount_cents: 2, paid_cents: 2, statement_month: "2026-07-01" }),
    ];
    expect(faturaFinanceira(lancamentos, cartao, "2026-07-01").totalCents).toBe(max);
    expect(foraDeCompetenciaFinanceira(lancamentos.map((lancamento) => ({ ...lancamento, statement_month: null })), [cartao]).totalCents).toBe(max);
    expect(() => faturaFinanceira(lancamentos.slice(0, 2), cartao, "2026-07-01")).toThrow(RangeError);
  });

  it("patrimônio soma saldos com sinais sem arredondamento intermediário", () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(patrimonioFinanceiro([], [conta({ opening_balance_cents: max }), conta({ id: "dois", opening_balance_cents: 2 }), conta({ id: "menos-dois", opening_balance_cents: -2 })]).patrimonioCents).toBe(max);
    expect(() => patrimonioFinanceiro([], [conta({ opening_balance_cents: max }), conta({ id: "dois", opening_balance_cents: 2 })])).toThrow(RangeError);
  });
});

describe("D-006: estornos e faixas do orçamento", () => {
  it("receita em categoria de despesa abate o orçamento; outros ciclos e meses não entram", () => {
    const lancamentos = [tx(), tx({ id: "estorno", kind: "income", amount_cents: 200, paid_cents: 200 }), tx({ id: "previsto", status: "planned" }), tx({ id: "fora", occurred_on: "2026-08-01" })];
    const [result] = progressoOrcamentosFinanceiros([orcamento, { ...orcamento, id: "agosto", month: "2026-08-01" }], lancamentos, [categoria], "2026-07-01", [conta()]);
    expect(result).toMatchObject({ spentCents: 800, ratio: 0.8, over: false, faixa: "atencao" });
    expect(lancamentos[0]?.amount_cents).toBe(1000);
  });

  it.each([[799, "normal"], [800, "atencao"], [999, "atencao"], [1000, "limite"], [1001, "limite"]] as const)("%s centavos define faixa %s com limite 1000", (amount, faixa) => {
    const [result] = progressoOrcamentosFinanceiros([orcamento], [tx({ amount_cents: amount, paid_cents: amount })], [categoria], "2026-07-01", [conta()]);
    expect(result?.faixa).toBe(faixa);
    expect(result?.over).toBe(amount > 1000);
  });

  it("orçamento de cartão segue statement_month e não a data da compra", () => {
    const [result] = progressoOrcamentosFinanceiros([orcamento], [tx({ account_id: "cartao", occurred_on: "2026-06-30", statement_month: "2026-07-01" })], [categoria], "2026-07-01", [cartao]);
    expect(result?.spentCents).toBe(1000);
    expect(() => progressoOrcamentosFinanceiros([{ ...orcamento, limit_cents: 0 }], [], [categoria], "2026-07-01", [conta()])).toThrow(RangeError);
  });
});

describe("T-007: agregações exatas independem da ordem dos lançamentos", () => {
  const max = Number.MAX_SAFE_INTEGER;
  const movimentos = [
    tx({ id: "maior", amount_cents: max, paid_cents: max }),
    tx({ id: "mais", amount_cents: 2, paid_cents: 2 }),
    tx({ id: "estorno", kind: "income", amount_cents: 2, paid_cents: 2 }),
  ];
  const ordens = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

  it.each(ordens)("saldo e orçamento preservam centavos na ordem %s/%s/%s", (a, b, c) => {
    const lancamentos = [movimentos[a]!, movimentos[b]!, movimentos[c]!];
    expect(saldosFinanceiros(lancamentos, [conta()])[0]?.balance_cents).toBe(-max);
    expect(saldosFinanceiros(lancamentos.map((lancamento) => ({ ...lancamento, kind: lancamento.kind === "income" ? "expense" : "income" })), [conta()])[0]?.balance_cents).toBe(max);
    expect(progressoOrcamentosFinanceiros([orcamento], lancamentos, [categoria], "2026-07-01", [conta()])[0]?.spentCents).toBe(max);
  });

  it("saldo inicial participa da soma exata antes de validar o resultado", () => {
    expect(saldosFinanceiros(movimentos.slice(0, 2), [conta({ opening_balance_cents: 2 })])[0]?.balance_cents).toBe(-max);
    expect(() => saldosFinanceiros(movimentos.slice(0, 2), [conta()])).toThrow(RangeError);
    expect(() => progressoOrcamentosFinanceiros([orcamento], movimentos.slice(0, 2), [categoria], "2026-07-01", [conta()])).toThrow(RangeError);
  });
});
