import { describe, expect, it } from "vitest";
import {
  cartoesDe, despesasPorCategoriaFinanceiras, faturaFinanceira, isTransfer, mesDeCompetencia,
  normalizarPagamento, participaDoReal, parcelas, patrimonioFinanceiro, planoDoMesFinanceiro,
  progressoOrcamentosFinanceiros, saldosFinanceiros, statusDaFatura, totaisFinanceiros,
} from "../../src/core/financeiro";
import { historicoMensal, monthTotals } from "../../src/core/financeiro/finance";
import { patrimonioEDivida } from "../../src/core/financeiro/credit";
import { formatBRL } from "../../src/core/dinheiro";
import {
  LEGACY_V2_CARD, LEGACY_V2_FOOD, LEGACY_V2_GROUPS, LEGACY_V2_MONTH, LEGACY_V2_TRANSPORT,
  legacyV2Accounts as accounts, legacyV2Budgets as budgets, legacyV2Categories as categories,
  legacyV2IndependentBalances as independentBalances, legacyV2TotalPlan as totalPlan,
  legacyV2Transactions as transactions,
} from "../fixtures/finance-legacy-v2-regression";

const byId = (id: string) => transactions.find(row => row.id === id)!;
const card = accounts.find(row => row.id === LEGACY_V2_CARD)!;
const totals = (month = LEGACY_V2_MONTH) => totaisFinanceiros(transactions, accounts, [month]);
const statement = () => faturaFinanceira(transactions, card, LEGACY_V2_MONTH);
const progress = () => progressoOrcamentosFinanceiros([totalPlan, ...budgets], transactions, categories, LEGACY_V2_MONTH, accounts);
const plan = (overrides = [totalPlan, ...budgets]) => planoDoMesFinanceiro(overrides, transactions, categories, LEGACY_V2_MONTH, accounts);
const normalized = () => transactions.map(row => normalizarPagamento(row, accounts.find(entry => entry.id === row.account_id)!));

describe("porte literal v2:18 linhas no modelo D-006", () => {
  it("conserva todas as linhas, inclusive exclusão/plano, e deriva pagamento sem input is_paid", () => {
    expect(transactions).toHaveLength(18);
    expect(new Set(transactions.map(row => row.id)).size).toBe(18);
    expect(transactions.every(row => !Object.hasOwn(row, "is_paid"))).toBe(true);
    expect(normalized().filter(row => row.is_paid)).toHaveLength(17);
    expect(byId("pl1")).toMatchObject({ amount_cents: 70_000, paid_cents: 0, status: "planned" });
    expect(byId("x1").deleted_at).toBe("2026-07-11T12:00:00Z");
  });
  it("a exclusão é filtrada no Core fundido, sem depender da leitura externa histórica", () => {
    expect(totaisFinanceiros(transactions.filter(row => row.deleted_at === null), accounts, [LEGACY_V2_MONTH])).toEqual(totals());
    const raw = normalized(), visible = raw.filter(row => row.deleted_at === null);
    expect(monthTotals(raw, LEGACY_V2_MONTH, accounts).expenseCents - monthTotals(visible, LEGACY_V2_MONTH, accounts).expenseCents).toBe(99_900);
  });
  it("preserva receitas870000 e declara planned fora do realizado321823→251823", () => {
    const historicalProjection = monthTotals(normalized().filter(row => row.deleted_at === null), LEGACY_V2_MONTH, accounts);
    expect(historicalProjection).toMatchObject({ incomeCents: 870_000, expenseCents: 321_823, balanceCents: 548_177 });
    expect(totals()).toEqual({ incomeCents: 870_000, expenseCents: 251_823, balanceCents: 618_177, transactionCount: 9 });
    expect(historicalProjection.expenseCents - totals().expenseCents).toBe(70_000);
    expect(formatBRL(totals().incomeCents)).toBe("R$ 8.700,00");
  });
  it("a competência gravada conserva as bordas junho/julho/agosto", () => {
    const cards = cartoesDe(accounts);
    expect(mesDeCompetencia(byId("c1"), cards)).toBe(LEGACY_V2_MONTH);
    expect(mesDeCompetencia(byId("c3"), cards)).toBe("2026-08-01");
    expect(totals("2026-06-01").expenseCents).toBe(0);
    expect(totals("2026-08-01").expenseCents).toBe(63_333);
  });
  it("os SALDOS históricos são oracles independentes, não saldos calculados das18linhas", () => {
    const oracle = patrimonioEDivida(independentBalances, accounts);
    expect(oracle).toEqual({ patrimonioCents: 1_500_000, dividaCents: 120_157 });
    expect(oracle.patrimonioCents - oracle.dividaCents).toBe(1_379_843);
    expect(independentBalances.find(row => row.account_id === LEGACY_V2_CARD)?.available_cents).toBe(379_843);
    expect(saldosFinanceiros(transactions, accounts).map(row => row.balance_cents)).toEqual([435_000, 200_000, -113_490]);
    expect(patrimonioFinanceiro(transactions, accounts)).toEqual({ patrimonioCents: 635_000, dividaCents: 113_490 });
  });
  it("a fatura de julho mantém56823/40000/16823 sem compras futuras", () => {
    expect(statement()).toMatchObject({ totalCents: 56_823, paidCents: 40_000, openCents: 16_823 });
    expect(statement().itens.map(row => row.id).sort()).toEqual(["c1", "c2", "p1"]);
    expect(statement().itens.some(row => ["c3", "p2", "p3"].includes(row.id))).toBe(false);
  });
  it("status da fatura deriva do dia; vencida é compatível com o oracle histórico permitido", () => {
    const input = { mesFatura: LEGACY_V2_MONTH, diaFechamento: 22, diaVencimento: 5, resumo: statement() };
    expect(statusDaFatura({ ...input, hoje: "2026-07-15" })).toBe("aberta");
    expect(statusDaFatura({ ...input, hoje: "2026-07-23" })).toBe("parcial");
    expect(statusDaFatura({ ...input, hoje: "2026-08-10" })).toBe("vencida");
  });
  it("as três parcelas literais e o distribuidor fecham100000 com resto na última", () => {
    const rows = transactions.filter(row => row.installment_group_id === LEGACY_V2_GROUPS.g1);
    expect(rows.map(row => row.amount_cents)).toEqual([33_333, 33_333, 33_334]);
    expect(rows.reduce((sum, row) => sum + row.amount_cents, 0)).toBe(100_000);
    expect(parcelas(100_000, 3)).toEqual([33_333, 33_333, 33_334]);
    expect(rows.every(row => row.serie_tipo === "parcelamento" && row.installment_total === 3)).toBe(true);
  });
  it("estorno reduz alimentação108490 e transferências não abatem orçamento", () => {
    const rows = progress();
    expect(rows).toHaveLength(2); // The total plan is not a category allocation.
    expect(rows.find(row => row.budget.category_id === LEGACY_V2_FOOD)).toMatchObject({ spentCents: 108_490, over: false });
    expect(isTransfer(byId("t2"))).toBe(true);
    expect(isTransfer(byId("f2"))).toBe(true);
    expect(isTransfer(byId("e1"))).toBe(false);
    const labelled = transactions.map(row => isTransfer(row) ? { ...row, category_id: LEGACY_V2_FOOD } : row);
    expect(progressoOrcamentosFinanceiros(budgets, labelled, categories, LEGACY_V2_MONTH, accounts)).toEqual(progressoOrcamentosFinanceiros(budgets, transactions, categories, LEGACY_V2_MONTH, accounts));
  });
  it("transporte45000 preserva90%/atenção sem incluir a revisão planejada", () => {
    expect(progress().find(row => row.budget.category_id === LEGACY_V2_TRANSPORT)).toMatchObject({ spentCents: 45_000, ratio: 0.9, faixa: "atencao" });
  });
  it.each([[75_000, "normal"], [79_990, "normal"], [80_000, "atencao"], [95_000, "atencao"], [99_990, "atencao"], [100_000, "limite"], [150_000, "limite"]] as const)("faixa80/100 mantém o corte para%d", (amount, expected) => {
    const input = [{ ...byId("d1"), amount_cents: amount, paid_cents: amount }];
    expect(progressoOrcamentosFinanceiros([{ ...budgets[0]!, limit_cents: 100_000 }], input, categories, LEGACY_V2_MONTH, accounts)[0]?.faixa).toBe(expected);
  });
  it("o plano total real mantém usado/disponível/alocado/reserva separados", () => {
    expect(plan()).toEqual({ orcadoCents: 400_000, usadoCents: 231_823, disponivelCents: 168_177, alocadoCents: 250_000, reservaCents: 150_000, sobrealocado: false });
  });
  it("sobrealocação200000/300000 não é o mesmo que estourar o realizado", () => {
    expect(plan([{ ...totalPlan, limit_cents: 200_000 }, { ...budgets[0]!, limit_cents: 300_000 }])).toMatchObject({ usadoCents: 231_823, reservaCents: -100_000, sobrealocado: true });
  });
  it("sem plano cadastrado null nunca vira zero", () => {
    expect(plan(budgets)).toEqual({ orcadoCents: null, usadoCents: 231_823, disponivelCents: null, alocadoCents: 250_000, reservaCents: null, sobrealocado: false });
    expect(planoDoMesFinanceiro([], [], [], LEGACY_V2_MONTH, [])).toEqual({ orcadoCents: null, usadoCents: 0, disponivelCents: null, alocadoCents: 0, reservaCents: null, sobrealocado: false });
  });
  it("plano global antes da primeira conta não exige uma categoria fictícia", () => {
    expect(planoDoMesFinanceiro([totalPlan], [], [], LEGACY_V2_MONTH, [])).toEqual({ orcadoCents: 400_000, usadoCents: 0, disponivelCents: 400_000, alocadoCents: 0, reservaCents: 400_000, sobrealocado: false });
  });
  it("filtro alimentar preserva128490/20000/−108490; planned segue por revisar", () => {
    expect(totaisFinanceiros(transactions.filter(row => row.category_id === LEGACY_V2_FOOD), accounts, [LEGACY_V2_MONTH])).toMatchObject({ expenseCents: 128_490, incomeCents: 20_000, balanceCents: -108_490 });
    const cards = cartoesDe(accounts);
    expect(transactions.filter(row => row.deleted_at === null && !isTransfer(row) && mesDeCompetencia(row, cards) === LEGACY_V2_MONTH && !participaDoReal(row)).map(row => row.id)).toEqual(["pl1"]);
  });
  it("gráfico fecha com o realizado251823 e mantém sem categoria78333", () => {
    const chart = despesasPorCategoriaFinanceiras(transactions, categories, [LEGACY_V2_MONTH], accounts);
    expect(chart.reduce((sum, row) => sum + row.totalCents, 0)).toBe(251_823);
    expect(chart.find(row => row.categoryId === null)?.totalCents).toBe(78_333);
  });
  it("histórico tem12pontos com julho251823/agosto63333/setembro33334", () => {
    const history = historicoMensal(normalized().filter(participaDoReal), accounts, "2026-09-01", 12);
    expect(history).toHaveLength(12);
    expect(history.find(row => row.mes === LEGACY_V2_MONTH)).toMatchObject({ incomeCents: 870_000, expenseCents: 251_823 });
    expect(history.find(row => row.mes === "2026-08-01")?.expenseCents).toBe(63_333);
    expect(history.find(row => row.mes === "2026-09-01")?.expenseCents).toBe(33_334);
    expect(history.filter(row => ![LEGACY_V2_MONTH, "2026-08-01", "2026-09-01"].includes(row.mes)).every(row => row.expenseCents === 0 && row.incomeCents === 0)).toBe(true);
  });
});

describe("plano mensal: guardas do contrato novo", () => {
  it("recusa mistura de donos, categoria inválida e planos duplicados", () => {
    expect(() => plan([{ ...totalPlan, user_id: "foreign" }, ...budgets])).toThrow(/usuário/);
    expect(() => planoDoMesFinanceiro([totalPlan], [{ ...byId("r1"), user_id: "foreign" }], categories, LEGACY_V2_MONTH, accounts)).toThrow(/usuário/);
    expect(() => plan([totalPlan, { ...budgets[0]!, category_id: "missing" }])).toThrow(/categoria/);
    expect(() => plan([totalPlan, { ...budgets[0]!, category_id: categories.find(row => row.kind === "income")!.id }])).toThrow(/categoria/);
    expect(() => plan([totalPlan, { ...totalPlan, id: "duplicate-total" }])).toThrow(/Mais de um/);
    expect(() => plan([totalPlan, totalPlan])).toThrow(/duplicada/);
    expect(() => planoDoMesFinanceiro([totalPlan], [{ ...byId("e1"), category_id: "missing" }], categories, LEGACY_V2_MONTH, accounts)).toThrow(/categoria/);
  });
  it("um plano de outro mês não altera julho e o estado reconciled participa", () => {
    expect(plan([totalPlan, { ...totalPlan, id: "august-plan", month: "2026-08-01", limit_cents: 1 }, ...budgets])).toEqual(plan());
    expect(planoDoMesFinanceiro([totalPlan, ...budgets], transactions.map(row => row.id === "d1" ? { ...row, status: "reconciled" } : row), categories, LEGACY_V2_MONTH, accounts)).toEqual(plan());
  });
  it.each(["pending", "cancelled"] as const)("estado%s não vaza ao consumo real do plano", status => {
    expect(planoDoMesFinanceiro([totalPlan, ...budgets], transactions.map(row => row.id === "d1" ? { ...row, status } : row), categories, LEGACY_V2_MONTH, accounts).usadoCents).toBe(111_823);
  });
  it.each([0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])("limite inválido%d é recusado", (limit_cents) => {
    expect(() => plan([{ ...totalPlan, limit_cents }])).toThrow(RangeError);
  });
  it("somas assinadas compensam antes de validar; overflow de saída é recusado", () => {
    const maximum = Number.MAX_SAFE_INTEGER;
    const compensated = [
      { ...byId("d1"), id: "max", amount_cents: maximum, paid_cents: 0 },
      { ...byId("d1"), id: "extra", amount_cents: 2, paid_cents: 2 },
      { ...byId("e1"), id: "refund", amount_cents: 2, paid_cents: 2 },
    ];
    expect(planoDoMesFinanceiro([{ ...totalPlan, limit_cents: maximum }], compensated, categories, LEGACY_V2_MONTH, accounts)).toMatchObject({ usadoCents: maximum, disponivelCents: 0 });
    expect(() => planoDoMesFinanceiro([totalPlan], compensated.slice(0, 2), categories, LEGACY_V2_MONTH, accounts)).toThrow(RangeError);
    expect(() => plan([{ ...totalPlan, limit_cents: maximum }, { ...budgets[0]!, limit_cents: maximum }, { ...budgets[1]!, limit_cents: 1 }])).toThrow(RangeError);
    expect(() => planoDoMesFinanceiro([{ ...totalPlan, limit_cents: maximum }], [compensated[2]!], categories, LEGACY_V2_MONTH, accounts)).toThrow(RangeError);
  });
});
