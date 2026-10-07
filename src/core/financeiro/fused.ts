import { faturaDoCartao, faturasQueVencemEm, somaMeses, type FaturaDoCartao, type PatrimonioEDivida } from "./credit";
import { cartoesDe, expensesByCategory, isTransfer, mesDeCompetencia, totaisDoPeriodo, type BudgetProgress, type ForaDeCompetencia, type MonthTotals } from "./finance";
import type { FinanceAccount, FinanceAccountBalance, FinanceBudget, FinanceCategory, FinanceTransaction } from "./types";
import { centavosSeguros, totalExato } from "./arithmetic";

/** Public domain contract from D-006 / doc 06 §2. No database or framework types. */
export type StatusLancamento = "planned" | "pending" | "confirmed" | "reconciled" | "cancelled";
export type OrigemLancamento = "manual" | "recurring" | "import";
export type ContaFinanceira = FinanceAccount;
export type CategoriaFinanceira = FinanceCategory;
export type OrcamentoFinanceiro = FinanceBudget;

/** is_paid is derived; transfer is represented by two income/expense legs. */
export interface LancamentoFinanceiro extends Omit<FinanceTransaction, "kind" | "is_paid"> {
  kind: "income" | "expense";
  status: StatusLancamento;
  source: OrigemLancamento;
  due_date: string | null;
  deleted_at: string | null;
}

export type LancamentoFinanceiroCalculado = LancamentoFinanceiro & { readonly is_paid: boolean };
export type FaixaOrcamento = "normal" | "atencao" | "limite";
export interface ProgressoOrcamentoFinanceiro extends BudgetProgress {
  /** Below 80%, from 80% to below 100%, and at/above the limit. */
  faixa: FaixaOrcamento;
}

/** One lifecycle rule for every real aggregate, including statement payments. */
export function participaDoReal(lancamento: Pick<LancamentoFinanceiro, "status" | "deleted_at">): boolean {
  return lancamento.deleted_at === null && (lancamento.status === "confirmed" || lancamento.status === "reconciled");
}

/**
 * The single card-purchase exception: debt exists when the purchase is recorded.
 * Applying it does not change lifecycle status or the original object.
 */
export function normalizarPagamento<T extends Pick<LancamentoFinanceiro, "account_id" | "kind" | "amount_cents" | "paid_cents">>(
  lancamento: T,
  conta: Pick<ContaFinanceira, "id" | "kind">,
): T & { readonly is_paid: boolean } {
  if (conta.id !== lancamento.account_id) throw new Error("A conta não corresponde ao lançamento.");
  const amount = centavosSeguros(lancamento.amount_cents, "Valor");
  const suppliedPaid = centavosSeguros(lancamento.paid_cents, "Pagamento");
  if (amount <= 0 || suppliedPaid < 0) throw new RangeError("O valor deve ser positivo e o pagamento não pode ser negativo.");
  const paid = conta.kind === "credit_card" && lancamento.kind === "expense" ? amount : suppliedPaid;
  if (paid > amount) throw new RangeError("O pagamento não pode ultrapassar o valor.");
  return { ...lancamento, paid_cents: paid, is_paid: paid >= amount };
}

function lancamentosReais(lancamentos: readonly LancamentoFinanceiro[], contas: readonly ContaFinanceira[]): LancamentoFinanceiroCalculado[] {
  const porId = new Map(contas.map((conta) => [conta.id, conta]));
  return lancamentos.filter(participaDoReal).map((lancamento) => {
    const conta = porId.get(lancamento.account_id);
    if (!conta || conta.user_id !== lancamento.user_id) throw new Error("Lançamento sem conta correspondente do mesmo usuário.");
    return normalizarPagamento(lancamento, conta);
  });
}

/** Category chart and statement due dates share the fused lifecycle/payment rule. */
export function despesasPorCategoriaFinanceiras(lancamentos: readonly LancamentoFinanceiro[], categorias: readonly CategoriaFinanceira[], meses: readonly string[], contas: readonly ContaFinanceira[]) {
  const result = expensesByCategory(lancamentosReais(lancamentos, contas), [...categorias], [...meses], [...contas]);
  for (const row of result) centavosSeguros(row.totalCents, "Despesa da categoria");
  totalExato(result.reduce((sum, row) => sum + BigInt(row.totalCents), 0n), "Total das categorias");
  return result;
}
export function faturasFinanceirasQueVencemEm(lancamentos: readonly LancamentoFinanceiro[], contas: readonly ContaFinanceira[], mes: string) {
  return faturasQueVencemEm(lancamentosReais(lancamentos, contas), contas.filter((conta) => conta.kind === "credit_card" && conta.archived_at === null), mes);
}

/** Competence totals; every supplied account must belong to the caller's scoped data. */
export function totaisFinanceiros(lancamentos: readonly LancamentoFinanceiro[], contas: readonly ContaFinanceira[], meses: readonly string[]): MonthTotals {
  const result = totaisDoPeriodo(lancamentosReais(lancamentos, contas), [...meses], [...contas]);
  centavosSeguros(result.incomeCents, "Receita total");
  centavosSeguros(result.expenseCents, "Despesa total");
  centavosSeguros(result.balanceCents, "Saldo total");
  return result;
}

/** Missing statement assignments are surfaced rather than silently using purchase month. */
export function foraDeCompetenciaFinanceira(lancamentos: readonly LancamentoFinanceiro[], contas: readonly ContaFinanceira[]): ForaDeCompetencia {
  const cartoes = cartoesDe([...contas]);
  const orfaos = lancamentosReais(lancamentos, contas).filter((lancamento) => !isTransfer(lancamento) && mesDeCompetencia(lancamento, cartoes) === null);
  const total = orfaos.reduce((sum, lancamento) => sum + BigInt(lancamento.amount_cents) * (lancamento.kind === "expense" ? 1n : -1n), 0n);
  return { quantidade: orfaos.length, totalCents: totalExato(total, "Total fora de competência") };
}

export function faturaFinanceira(lancamentos: readonly LancamentoFinanceiro[], conta: ContaFinanceira, mes: string): FaturaDoCartao {
  if (conta.kind !== "credit_card" || conta.statement_closing_day === null) throw new Error("Informe um cartão com dia de fechamento para calcular a fatura.");
  const scoped = lancamentos.filter((lancamento) => lancamento.account_id === conta.id);
  return faturaDoCartao(lancamentosReais(scoped, [conta]), { id: conta.id, statement_closing_day: conta.statement_closing_day }, mes);
}

/** Refunds in an expense category reduce its budget; transfers never consume it. */
export function progressoOrcamentosFinanceiros(
  orcamentos: readonly OrcamentoFinanceiro[],
  lancamentos: readonly LancamentoFinanceiro[],
  categorias: readonly CategoriaFinanceira[],
  mes: string,
  contas: readonly ContaFinanceira[],
): ProgressoOrcamentoFinanceiro[] {
  const alvo = somaMeses(mes, 0);
  const cartoes = cartoesDe([...contas]);
  const categoriasPorId = new Map(categorias.map((categoria) => [categoria.id, categoria]));
  const gastos = new Map<string, bigint>();
  for (const lancamento of lancamentosReais(lancamentos, contas)) {
    if (isTransfer(lancamento) || lancamento.category_id === null || mesDeCompetencia(lancamento, cartoes) !== alvo) continue;
    const categoria = categoriasPorId.get(lancamento.category_id);
    if (!categoria || categoria.kind !== "expense") continue;
    if (categoria.user_id !== lancamento.user_id) throw new Error("Categoria e lançamento devem pertencer ao mesmo usuário.");
    const valor = BigInt(lancamento.amount_cents) * (lancamento.kind === "expense" ? 1n : -1n);
    gastos.set(categoria.id, (gastos.get(categoria.id) ?? 0n) + valor);
  }
  return orcamentos.filter((orcamento) => somaMeses(orcamento.month, 0) === alvo).map((budget) => {
    centavosSeguros(budget.limit_cents, "Limite do orçamento");
    if (budget.limit_cents <= 0) throw new RangeError("O limite do orçamento deve ser positivo.");
    const categoria = categoriasPorId.get(budget.category_id);
    if (!categoria || categoria.kind !== "expense" || categoria.user_id !== budget.user_id) throw new Error("Orçamento exige uma categoria de despesa do mesmo usuário.");
    const spentCents = totalExato(gastos.get(budget.category_id) ?? 0n, "Consumo do orçamento");
    const ratio = spentCents / budget.limit_cents;
    return { budget, categoryName: categoria.name, spentCents, ratio, over: spentCents > budget.limit_cents,
      faixa: ratio >= 1 ? "limite" : ratio >= 0.8 ? "atencao" : "normal" };
  });
}

/**
 * Both transfer legs affect their own account once. Cash-to-cash then cancels
 * naturally in wealth; card repayments reduce cash and debt separately.
 */
export function saldosFinanceiros(lancamentos: readonly LancamentoFinanceiro[], contas: readonly ContaFinanceira[]): FinanceAccountBalance[] {
  const movimentos = new Map<string, bigint>();
  const contasPorId = new Map(contas.map((conta) => [conta.id, conta]));
  for (const lancamento of lancamentosReais(lancamentos, contas)) {
    const conta = contasPorId.get(lancamento.account_id)!;
    // Posted card entries affect debt by their face value, not cash payment status.
    const valor = conta.kind === "credit_card" ? lancamento.amount_cents : lancamento.paid_cents;
    const assinado = BigInt(valor) * (lancamento.kind === "income" ? 1n : -1n);
    movimentos.set(conta.id, (movimentos.get(conta.id) ?? 0n) + assinado);
  }
  return contas.map((conta) => {
    centavosSeguros(conta.opening_balance_cents, "Saldo inicial");
    const balance = totalExato(BigInt(conta.opening_balance_cents) + (movimentos.get(conta.id) ?? 0n), "Saldo da conta");
    const isCredit = conta.kind === "credit_card";
    const debt = isCredit ? -balance : 0;
    if (conta.credit_limit_cents !== null) centavosSeguros(conta.credit_limit_cents, "Limite do cartão");
    return { account_id: conta.id, user_id: conta.user_id, name: conta.name, kind: conta.kind, currency: conta.currency,
      opening_balance_cents: conta.opening_balance_cents, balance_cents: balance, is_credit: isCredit,
      debt_cents: debt, available_cents: isCredit && conta.credit_limit_cents !== null ? totalExato(BigInt(conta.credit_limit_cents) - BigInt(debt), "Limite disponível") : null };
  });
}

export function patrimonioFinanceiro(lancamentos: readonly LancamentoFinanceiro[], contas: readonly ContaFinanceira[]): PatrimonioEDivida {
  const balances = saldosFinanceiros(lancamentos, contas);
  const active = new Set(contas.filter((conta) => conta.archived_at === null).map((conta) => conta.id));
  let wealth = 0n;
  let debt = 0n;
  for (const balance of balances) {
    if (!active.has(balance.account_id)) continue;
    if (balance.is_credit) debt -= BigInt(balance.balance_cents);
    else wealth += BigInt(balance.balance_cents);
  }
  return { patrimonioCents: totalExato(wealth, "Patrimônio"), dividaCents: totalExato(debt, "Dívida") };
}
