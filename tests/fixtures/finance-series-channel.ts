import { assinatura, ErroDeDominio } from "../../src/core/contracts/base";
import type { ReciboIdempotente } from "../../src/core/contracts/unit-of-work";
import { definitionOfSeries } from "../../src/core/financeiro/series/series-planning";
import type { FinanceSeriesCommand, FinanceSeriesResult } from "../../src/core/financeiro/series/series-types";
import type { FinanceSeriesCommit, FinanceSeriesGateway, FinanceSeriesSnapshot } from "../../src/adapters/db/finance-series-protocol";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import { managedSeries, seriesAccount, seriesCategory, seriesId, SERIES_OWNER } from "./finance-series";

export const SERIES_SESSION = seriesId(900);
export const channelCreate = (): Extract<FinanceSeriesCommand, { command: "finance.recurring.create" }> => ({ command: "finance.recurring.create", input: { client_id: seriesId(901), expected_finance_revision: "0", definition: definitionOfSeries(managedSeries({ total: 2 })), horizon: { from_on: "2026-10-23", until_exclusive: "2026-12-23" }, statement_assignments: [] } });
export const emptySeriesSnapshot = (): FinanceSeriesSnapshot => ({ version: 2, finance_revision: "0", series: [], occurrences: [], transactions: [], accounts: [structuredClone(seriesAccount)], categories: [structuredClone(seriesCategory)], tags: [], receipt: null });
/** Injected atomic gateway only; does not model or certify PostgreSQL/RLS. */
export class SeriesGatewayFixture implements FinanceSeriesGateway {
  readonly actorId = SERIES_OWNER;
  state = emptySeriesSnapshot();
  receipts: ReciboIdempotente[] = [];
  calls = { snapshot: 0, commit: 0 };
  mode: "normal" | "stale" | "unknown_before" | "unknown_after" | "validation" = "normal";
  failSnapshot: (() => void) | null = null;
  lastCommit: FinanceSeriesCommit | null = null;
  async snapshot(request: FinanceSeriesCommand) {
    this.calls.snapshot++; this.failSnapshot?.();
    const current = structuredClone(this.state), receipt = this.receipts.find(item => item.command === request.command && item.client_id === request.input.client_id) ?? null;
    if (request.command === "finance.recurring.create") return { ...current, series: [], occurrences: [], transactions: [], receipt: structuredClone(receipt) };
    return { ...current, receipt: structuredClone(receipt) };
  }
  async page(query: { cursor: string | null; limit: number }) {
    const items = this.state.series.filter(item => query.cursor === null || item.id > query.cursor).sort((a, b) => a.id.localeCompare(b.id)).slice(0, query.limit);
    return { version: 2 as const, finance_revision: this.state.finance_revision, items: structuredClone(items), next_cursor: null };
  }
  async detail(id: string) { const series = this.state.series.find(item => item.id === id); if (!series) return null; const state = structuredClone(this.state); return { version: 2 as const, finance_revision: state.finance_revision, series: structuredClone(series), occurrences: state.occurrences, transactions: state.transactions, accounts: state.accounts, categories: state.categories, tags: state.tags }; }
  async commit(request: FinanceSeriesCommit) {
    this.calls.commit++; this.lastCommit = structuredClone(request);
    if (this.mode === "stale") return { status: "stale" as const };
    if (this.mode === "unknown_before") throw new CommitOutcomeUnknown();
    if (this.mode === "validation") throw new ErroDeDominio("VALIDATION", "Sintético: rejeição transacional.");
    const existing = this.receipts.find(item => item.command === request.receipt.command && item.client_id === request.receipt.client_id);
    if (existing) {
      if (existing.fingerprint !== request.receipt.fingerprint) throw new ErroDeDominio("CONFLICT", "Sintético: client_id conflitante.");
      return { status: "replayed" as const, result: structuredClone(existing.result) as FinanceSeriesResult };
    }
    if (request.expected_finance_revision !== this.state.finance_revision) return { status: "stale" as const };
    const draft = structuredClone(this.state);
    for (const change of request.changes) {
      const rows = change.type === "finance_series" ? draft.series : change.type === "finance_series_occurrence" ? draft.occurrences : draft.transactions;
      const index = rows.findIndex(row => row.id === change.after.id), before = index < 0 ? null : rows[index];
      if (assinatura(before) !== assinatura(change.before)) throw new ErroDeDominio("CONFLICT", "Sintético: BEFORE divergente.");
      if (index < 0) (rows as unknown[]).push(structuredClone(change.after)); else (rows as unknown[])[index] = structuredClone(change.after);
    }
    draft.finance_revision = String(BigInt(draft.finance_revision) + 1n); this.state = draft; this.receipts.push(structuredClone(request.receipt));
    if (this.mode === "unknown_after") throw new CommitOutcomeUnknown();
    return { status: "committed" as const, result: structuredClone(request.receipt.result) as FinanceSeriesResult };
  }
}
