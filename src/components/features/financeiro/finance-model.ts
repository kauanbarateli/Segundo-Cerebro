import { cartoesDe, isTransfer, mesDeCompetencia, totaisFinanceiros, type ContaFinanceira, type LancamentoFinanceiro } from "../../../core/financeiro";
import type { FinanceRouteState } from "./finance-route";

/** Presentation composition only; the domain remains the authority on economic rules. */
export function sumFinanceValues(values: readonly number[]): number {
  const total = values.reduce((sum, value) => {
    if (!Number.isSafeInteger(value)) throw new RangeError("Valor financeiro fora do limite seguro.");
    return sum + BigInt(value);
  }, 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError("Total financeiro fora do limite seguro.");
  return Number(total);
}
export function financeRows(rows: readonly LancamentoFinanceiro[], accounts: readonly ContaFinanceira[], state: FinanceRouteState): LancamentoFinanceiro[] {
  const cards = cartoesDe([...accounts]);
  return rows.filter((row) => {
    if (state.status === "trash" ? row.deleted_at === null : row.deleted_at !== null) return false;
    if (state.status !== "all" && state.status !== "trash" && row.status !== state.status) return false;
    if (mesDeCompetencia(row, cards) !== state.month) return false;
    if (state.account && row.account_id !== state.account) return false;
    if (state.category && (state.category === "none" ? row.category_id !== null : row.category_id !== state.category)) return false;
    if (state.kind !== "all" && (state.kind === "transfer" ? !isTransfer(row) : isTransfer(row) || row.kind !== state.kind)) return false;
    return true;
  });
}
export function financePeriodSummary(rows: readonly LancamentoFinanceiro[], accounts: readonly ContaFinanceira[], month: string) {
  return totaisFinanceiros(rows, accounts, [month]);
}
export const civilLabel = (day: string) => day.split("-").reverse().join("/");
export function financeMonthLabel(month: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T12:00:00Z`));
}
export function independentTransaction(row: LancamentoFinanceiro): boolean { return row.transfer_group_id === null && row.installment_group_id === null && row.serie_tipo === null; }
