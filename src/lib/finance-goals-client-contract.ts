import type { FinancialGoal, GoalCommand, GoalCommandResult, GoalHighlight, GoalRelease, GoalReservation, GoalTotals } from "@/core/financeiro/goals/goal-types";
import type { GoalTerminalClientOutcome } from "./finance-goals-terminal-browser";

/** Browser-only port. No transport, SDK, database authority or durable implementation is supplied here. */
export type GoalFailureCode = "validation" | "conflict" | "forbidden" | "unavailable" | "uncertain" | "session-changed" | "journal-unavailable" | "busy";
export interface GoalFailure { ok: false; code: GoalFailureCode; message: string }
export type GoalReply<T> = { ok: true; result: T } | GoalFailure;
export interface GoalPageQuery { cursor: string | null; limit: number; archived: "active" | "archived" | "all" }
export interface GoalListItem { goal: FinancialGoal; totals: GoalTotals }
export interface GoalPageView { version: 1; finance_revision: string; items: GoalListItem[]; highlight: GoalHighlight | null; next_cursor: string | null }
export interface GoalDetailView extends GoalListItem { version: 1; finance_revision: string; highlight: GoalHighlight | null }
export interface GoalHistoryCursor { created_at: string; id: string }
export interface GoalHistoryQuery { id: string; cursor: GoalHistoryCursor | null; limit: number }
export interface GoalReservationsView { version: 1; finance_revision: string; items: { reservation: GoalReservation; totals: { user_id: string; reservation_id: string; finance_revision: string; released_cents: number } }[]; next_cursor: GoalHistoryCursor | null }
export interface GoalReleasesView { version: 1; finance_revision: string; items: GoalRelease[]; next_cursor: GoalHistoryCursor | null }
export interface GoalAccountChoice { id: string; name: string; kind: string; currency: string; archived: boolean }
export interface GoalReview {
  kind: "review"; intent: GoalCommand; financeRevision: string;
  goalRevision: string | null; highlightRevision: string | null;
  account: { id: string; realBalance: number; reserved: number; available: number } | null;
}
export type GoalPrepared = GoalReview | { kind: "confirmed"; intent: GoalCommand; result: GoalCommandResult };
export interface GoalPending { intent: GoalCommand; phase: "staged" | "uncertain" }
export interface GoalJournalView { ownerId: string; epoch: string; reconfirmRequired: boolean; pending: GoalPending | null }
export interface FinanceGoalsClient {
  readonly ownerId: string;
  readonly epoch: string;
  /** Absent on V1 ports. Both terminal actions are explicit; neither falls back to execute/reconcile. */
  readonly terminal?: {
    status(original: GoalCommand): Promise<GoalReply<GoalTerminalClientOutcome>>;
    settle(original: GoalCommand): Promise<GoalReply<GoalTerminalClientOutcome>>;
  };
  /** Must include the host identity and durable epoch fence, not just component liveness.
   * Before publishing logout/another owner, the host revokes that fence and redacts
   * that owner's local body. A 403/503 alone never performs this identity transition. */
  isCurrent(): boolean;
  /** Opens/readbacks the durable journal fence BEFORE any public read. Not a memory journal. */
  loadPending(): Promise<GoalReply<GoalJournalView>>;
  availability(): Promise<GoalReply<{ available: boolean }>>;
  page(query: GoalPageQuery): Promise<GoalReply<GoalPageView>>;
  detail(id: string): Promise<GoalReply<GoalDetailView | null>>;
  reservations(query: GoalHistoryQuery): Promise<GoalReply<GoalReservationsView>>;
  releases(query: GoalHistoryQuery): Promise<GoalReply<GoalReleasesView>>;
  /** Read-only projection of the exact intent; never creates a receipt or accepts a new body for an uncertain UUID. */
  prepare(intent: GoalCommand): Promise<GoalReply<GoalPrepared>>;
  /** Owner-scoped atomic lock + durable write/readback, no dispatch; refuses a different unresolved intent. */
  stage(intent: GoalCommand): Promise<GoalReply<GoalJournalView>>;
  /** Exactly one human-authorized attempt, with durable uncertain state before transport. No automatic retry. */
  execute(intent: GoalCommand): Promise<GoalReply<GoalCommandResult>>;
  /** Same intent/UUID only. No receipt is UNCERTAIN, never proof of absence. */
  reconcile(intent: GoalCommand): Promise<GoalReply<GoalCommandResult>>;
  /** Human reconfirmation after current-data review; does not clear an unresolved intent. */
  acknowledgeReview(): Promise<GoalReply<GoalJournalView>>;
}
