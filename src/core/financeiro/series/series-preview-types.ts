import type { ContaFinanceira, CategoriaFinanceira, EtiquetaFinanceira, LancamentoFinanceiro } from "../fused";
import type { FinanceSeriesCommand, FinanceSeriesResult, ManagedFinanceSeries, ManagedSeriesOccurrence } from "./series-types";

/** A read review is not a reservation or authorization to commit. */
export interface FinanceSeriesPreviewData {
  series: ManagedFinanceSeries | null; occurrences: ManagedSeriesOccurrence[]; transactions: LancamentoFinanceiro[];
  accounts: ContaFinanceira[]; categories: CategoriaFinanceira[]; tags: EtiquetaFinanceira[];
}
interface PreviewBinding { version: 2; command: FinanceSeriesCommand["command"]; client_id: string }
export type FinanceSeriesPreview =
  | (PreviewBinding & {
    kind: "review"; today: string; consistency: "same" | "changed";
    revisions: { requested_finance: string; observed_finance: string; requested_series: string | null; observed_series: string | null };
    data: FinanceSeriesPreviewData;
  })
  | (PreviewBinding & { kind: "confirmed"; result: FinanceSeriesResult });
export interface FinanceSeriesAvailability { version: 2; available: boolean }
