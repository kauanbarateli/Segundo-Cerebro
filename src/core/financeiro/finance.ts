/** Pure calculation port from segundo_cerebro@ffdf064; see t007-financeiro.md. */
import type {
  FinanceAccount,
  FinanceAccountBalance,
  FinanceTransaction,
  FinanceCategory,
  FinanceTag,
  FinanceBudget,
} from "./types";
import { patrimonioEDivida, somaMeses } from "./credit";

export type ContaParaCompetencia = Pick<FinanceAccount, "id" | "kind">;

export function cartoesDe(contas: ContaParaCompetencia[]): ReadonlySet<string> {
  return new Set(contas.filter((c) => c.kind === "credit_card").map((c) => c.id));
}

function mesCanonicoDe(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** The stored statement month is the single competence rule for card aggregates. */
export function mesDeCompetencia(
  tx: Pick<FinanceTransaction, "account_id" | "occurred_on" | "statement_month">,
  cartoes: ReadonlySet<string>,
): string | null {
  if (!cartoes.has(tx.account_id)) return mesCanonicoDe(tx.occurred_on);
  return tx.statement_month === null ? null : mesCanonicoDe(tx.statement_month);
}

export interface ForaDeCompetencia {
  quantidade: number;

  totalCents: number;
}

export function foraDeCompetencia(
  txs: FinanceTransaction[],
  cartoes: ReadonlySet<string>,
): ForaDeCompetencia {
  let quantidade = 0;
  let totalCents = 0;
  for (const tx of txs) {
    if (!cartoes.has(tx.account_id)) continue;
    if (tx.statement_month !== null) continue;
    if (isTransfer(tx)) continue;
    quantidade++;
    totalCents += tx.kind === "expense" ? tx.amount_cents : -tx.amount_cents;
  }
  return { quantidade, totalCents };
}

export function isTransfer(tx: Pick<FinanceTransaction, "transfer_group_id" | "kind">): boolean {
  return tx.transfer_group_id !== null || tx.kind === "transfer";
}

function noPeriodo(
  tx: FinanceTransaction,
  meses: ReadonlySet<string>,
  cartoes: ReadonlySet<string>,
): boolean {
  const mes = mesDeCompetencia(tx, cartoes);
  return mes !== null && meses.has(mes);
}

function conjuntoDeMeses(meses: string[]): ReadonlySet<string> {
  return new Set(meses.map(mesCanonicoDe));
}

export type Recorte = "mes" | "trimestre" | "ano";

export const ROTULO_DO_RECORTE: Record<Recorte, string> = {
  mes: "Mês",
  trimestre: "Trimestre",
  ano: "Ano",
};

export const RECORTES: Recorte[] = ["mes", "trimestre", "ano"];

export function lerRecorte(valor: string | null | undefined): Recorte {
  return RECORTES.includes(valor as Recorte) ? (valor as Recorte) : "mes";
}

export function mesesDoRecorte(mesIso: string, recorte: Recorte): string[] {
  const canonico = mesCanonicoDe(mesIso);
  if (recorte === "mes") return [canonico];

  const ano = canonico.slice(0, 4);
  if (recorte === "ano") {
    return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}-01`);
  }

  const mes = Number(canonico.slice(5, 7));
  const primeiro = Math.floor((mes - 1) / 3) * 3 + 1;
  return Array.from(
    { length: 3 },
    (_, i) => `${ano}-${String(primeiro + i).padStart(2, "0")}-01`,
  );
}

export function periodoAnterior(meses: string[]): string[] {
  return meses.map((m) => somaMeses(m, -meses.length));
}

export function rotuloDoPeriodo(meses: string[], recorte: Recorte): string {
  const primeiro = meses[0];
  if (!primeiro) return "—";
  if (recorte === "ano") return primeiro.slice(0, 4);
  if (recorte === "trimestre") {
    const trimestre = Math.floor(Number(primeiro.slice(5, 7)) / 3) + 1;
    return `${trimestre}º trimestre de ${primeiro.slice(0, 4)}`;
  }
  return primeiro;
}

export interface MonthTotals {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  transactionCount: number;
}

export function totaisDoPeriodo(
  txs: FinanceTransaction[],
  meses: string[],
  contas: ContaParaCompetencia[],
): MonthTotals {
  const alvo = conjuntoDeMeses(meses);
  const cartoes = cartoesDe(contas);

  let incomeCents = 0;
  let expenseCents = 0;
  let transactionCount = 0;

  for (const tx of txs) {
    if (isTransfer(tx)) continue;
    if (!noPeriodo(tx, alvo, cartoes)) continue;
    transactionCount++;
    if (tx.kind === "income") incomeCents += tx.amount_cents;
    else if (tx.kind === "expense") expenseCents += tx.amount_cents;
  }

  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    transactionCount,
  };
}

export function monthTotals(
  txs: FinanceTransaction[],
  monthIso: string,
  contas: ContaParaCompetencia[],
): MonthTotals {
  return totaisDoPeriodo(txs, [monthIso], contas);
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  totalCents: number;
  share: number;

  colorKey: string | null;
}

export function expensesByCategory(
  txs: FinanceTransaction[],
  categories: FinanceCategory[],
  meses: string[],
  contas: ContaParaCompetencia[],
): CategoryTotal[] {
  const porId = new Map(categories.map((c) => [c.id, c]));
  const alvo = conjuntoDeMeses(meses);
  const cartoes = cartoesDe(contas);
  const totais = new Map<string | null, number>();

  for (const tx of txs) {
    if (isTransfer(tx)) continue;
    if (tx.kind !== "expense") continue;
    if (!noPeriodo(tx, alvo, cartoes)) continue;
    totais.set(tx.category_id, (totais.get(tx.category_id) ?? 0) + tx.amount_cents);
  }

  const soma = [...totais.values()].reduce((a, b) => a + b, 0);

  return [...totais.entries()]
    .map(([categoryId, totalCents]) => {
      const categoria = categoryId ? porId.get(categoryId) : undefined;
      return {
        categoryId,
        name: categoryId ? (categoria?.name ?? "Categoria removida") : "Sem categoria",
        totalCents,
        share: soma === 0 ? 0 : totalCents / soma,
        colorKey: categoria?.color_key ?? null,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents);
}

export interface TagTotal {
  tagId: string;
  name: string;
  totalCents: number;
  share: number;
  colorKey: string;
}

export function despesasPorEtiqueta(
  txs: FinanceTransaction[],
  tags: FinanceTag[],
  vinculos: { transaction_id: string; tag_id: string }[],
  meses: string[],
  contas: ContaParaCompetencia[],
): TagTotal[] {
  const alvo = conjuntoDeMeses(meses);
  const cartoes = cartoesDe(contas);
  const porTx = new Map<string, string[]>();
  for (const v of vinculos) {
    const lista = porTx.get(v.transaction_id) ?? [];
    lista.push(v.tag_id);
    porTx.set(v.transaction_id, lista);
  }

  const totais = new Map<string, number>();
  for (const tx of txs) {
    if (isTransfer(tx)) continue;
    if (tx.kind !== "expense") continue;
    if (!noPeriodo(tx, alvo, cartoes)) continue;
    for (const tagId of porTx.get(tx.id) ?? []) {
      totais.set(tagId, (totais.get(tagId) ?? 0) + tx.amount_cents);
    }
  }

  const porId = new Map(tags.map((t) => [t.id, t]));
  const soma = [...totais.values()].reduce((a, b) => a + b, 0);

  return [...totais.entries()]
    .map(([tagId, totalCents]) => ({
      tagId,
      name: porId.get(tagId)?.name ?? "Etiqueta removida",
      totalCents,
      share: soma === 0 ? 0 : totalCents / soma,
      colorKey: porId.get(tagId)?.color_key ?? "stone",
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export interface BeneficiarioTotal {
  nome: string;
  totalCents: number;
  quantidade: number;
}

export function topBeneficiarios(
  txs: FinanceTransaction[],
  meses: string[],
  contas: ContaParaCompetencia[],
  limite = 5,
): BeneficiarioTotal[] {
  const alvo = conjuntoDeMeses(meses);
  const cartoes = cartoesDe(contas);
  const totais = new Map<string, BeneficiarioTotal>();

  for (const tx of txs) {
    if (isTransfer(tx)) continue;
    if (tx.kind !== "expense") continue;
    if (!noPeriodo(tx, alvo, cartoes)) continue;
    const bruto = tx.payee?.trim();
    if (!bruto) continue;
    const chave = bruto.toLowerCase();
    const atual = totais.get(chave) ?? { nome: bruto, totalCents: 0, quantidade: 0 };
    atual.totalCents += tx.amount_cents;
    atual.quantidade++;
    totais.set(chave, atual);
  }

  return [...totais.values()].sort((a, b) => b.totalCents - a.totalCents).slice(0, limite);
}

export interface MesDoHistorico {
  mes: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}

export function historicoMensal(
  txs: FinanceTransaction[],
  contas: ContaParaCompetencia[],
  mesFinal: string,
  quantidade: number,
): MesDoHistorico[] {
  const meses = Array.from({ length: quantidade }, (_, i) =>
    somaMeses(mesCanonicoDe(mesFinal), i - (quantidade - 1)),
  );
  const indice = new Map(
    meses.map((mes) => [mes, { mes, incomeCents: 0, expenseCents: 0, balanceCents: 0 }]),
  );
  const cartoes = cartoesDe(contas);

  for (const tx of txs) {
    if (isTransfer(tx)) continue;
    const mes = mesDeCompetencia(tx, cartoes);
    if (mes === null) continue;
    const alvo = indice.get(mes);
    if (!alvo) continue;
    if (tx.kind === "income") alvo.incomeCents += tx.amount_cents;
    else if (tx.kind === "expense") alvo.expenseCents += tx.amount_cents;
  }

  return meses.map((mes) => {
    const t = indice.get(mes)!;
    return { ...t, balanceCents: t.incomeCents - t.expenseCents };
  });
}

export function variation(currentCents: number, previousCents: number): number | null {
  if (previousCents === 0) return null;
  return (currentCents - previousCents) / previousCents;
}

export function previousMonthIso(monthIso: string): string {
  return somaMeses(mesCanonicoDe(monthIso), -1);
}

export function nextMonthIso(monthIso: string): string {
  return somaMeses(mesCanonicoDe(monthIso), 1);
}

export type LancamentoPendente = Pick<
  FinanceTransaction,
  | "id"
  | "account_id"
  | "kind"
  | "amount_cents"
  | "paid_cents"
  | "occurred_on"
  | "transfer_group_id"
  | "serie_tipo"
  | "description"
>;

export interface Horizontes {

  patrimonioCents: number;

  dividaCents: number;

  compromissosCents: number;

  totalPrevistoCents: number;

  liquidoCents: number;

  ate: string | null;
}

function restanteDe(tx: Pick<LancamentoPendente, "amount_cents" | "paid_cents">): number {
  return Math.max(0, tx.amount_cents - tx.paid_cents);
}

export function horizontesDoDinheiro({
  balances,
  accounts,
  pendentes,
  lancamentosDeCartao,
  hoje,
}: {
  balances: Pick<FinanceAccountBalance, "account_id" | "balance_cents">[];
  accounts: ContaParaCompetencia[];

  pendentes: LancamentoPendente[];

  lancamentosDeCartao: Pick<
    FinanceTransaction,
    "account_id" | "kind" | "transfer_group_id" | "statement_month" | "occurred_on"
  >[];

  hoje: string;
}): Horizontes {
  const { patrimonioCents, dividaCents: dividaDeCartaoCents } = patrimonioEDivida(
    balances,
    accounts,
  );
  const cartoes = cartoesDe(accounts);

  let dividaPendenteCents = 0;
  let compromissosCents = 0;
  let ate: string | null = null;

  function esticar(mes: string | null) {
    if (mes !== null && (ate === null || mes > ate)) ate = mes;
  }

  for (const tx of pendentes) {
    if (cartoes.has(tx.account_id)) continue;
    if (isTransfer(tx)) continue;
    if (tx.kind !== "expense") continue;

    const restante = restanteDe(tx);
    if (restante === 0) continue;

    if (tx.occurred_on <= hoje) {
      dividaPendenteCents += restante;
    } else if (tx.serie_tipo === "parcelamento") {
      dividaPendenteCents += restante;
    } else {
      compromissosCents += restante;
    }
    esticar(mesCanonicoDe(tx.occurred_on));
  }
  for (const tx of lancamentosDeCartao) {
    if (!cartoes.has(tx.account_id)) continue;
    if (isTransfer(tx)) continue;
    esticar(mesDeCompetencia(tx, cartoes));
  }

  const dividaCents = dividaDeCartaoCents + dividaPendenteCents;

  return {
    patrimonioCents,
    dividaCents,
    compromissosCents,
    totalPrevistoCents: dividaCents + compromissosCents,
    liquidoCents: patrimonioCents - dividaCents,
    ate,
  };
}

export function previstoPorConta(pendentes: LancamentoPendente[]): Map<string, number> {
  const porConta = new Map<string, number>();
  for (const tx of pendentes) {
    if (isTransfer(tx)) continue;
    const restante = restanteDe(tx);
    if (restante === 0) continue;
    const delta = tx.kind === "expense" ? -restante : restante;
    porConta.set(tx.account_id, (porConta.get(tx.account_id) ?? 0) + delta);
  }
  return porConta;
}

export function pendentesDoPeriodo(
  pendentes: LancamentoPendente[],
  meses: string[],
  contas: ContaParaCompetencia[],
): { totalCents: number; quantidade: number } {
  const alvo = conjuntoDeMeses(meses);
  const cartoes = cartoesDe(contas);

  let totalCents = 0;
  let quantidade = 0;
  for (const tx of pendentes) {
    if (cartoes.has(tx.account_id)) continue;
    if (isTransfer(tx)) continue;
    if (tx.kind !== "expense") continue;
    const restante = restanteDe(tx);
    if (restante === 0) continue;
    if (!alvo.has(mesCanonicoDe(tx.occurred_on))) continue;
    totalCents += restante;
    quantidade++;
  }
  return { totalCents, quantidade };
}

export interface FinanceAnalytics {
  meses: string[];
  mesesAnteriores: string[];
  atual: MonthTotals;
  anterior: MonthTotals;
  porCategoria: CategoryTotal[];
  porEtiqueta: TagTotal[];
  beneficiarios: BeneficiarioTotal[];
  historico: MesDoHistorico[];

  orfaos: ForaDeCompetencia;
}

export interface BudgetProgress {
  budget: FinanceBudget;
  categoryName: string;
  spentCents: number;
  ratio: number;
  over: boolean;
}

export function budgetProgress(
  budgets: FinanceBudget[],
  txs: FinanceTransaction[],
  categories: FinanceCategory[],
  monthIso: string,
  contas: ContaParaCompetencia[],
): BudgetProgress[] {
  const porId = new Map(categories.map((c) => [c.id, c.name]));
  const alvo = conjuntoDeMeses([monthIso]);
  const cartoes = cartoesDe(contas);

  const gastoPorCategoria = new Map<string, number>();
  for (const tx of txs) {
    if (isTransfer(tx)) continue;
    if (tx.kind !== "expense") continue;
    if (tx.category_id === null) continue;
    if (!noPeriodo(tx, alvo, cartoes)) continue;
    gastoPorCategoria.set(
      tx.category_id,
      (gastoPorCategoria.get(tx.category_id) ?? 0) + tx.amount_cents,
    );
  }

  return budgets.filter((budget): budget is FinanceBudget & { category_id: string } => budget.category_id !== null).map((budget) => {
    const spentCents = gastoPorCategoria.get(budget.category_id) ?? 0;
    const ratio = budget.limit_cents === 0 ? 0 : spentCents / budget.limit_cents;
    return {
      budget,
      categoryName: porId.get(budget.category_id) ?? "—",
      spentCents,
      ratio,
      over: spentCents > budget.limit_cents,
    };
  });
}
