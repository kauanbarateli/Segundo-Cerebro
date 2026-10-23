import type { ContextoDeEscrita } from "../../contracts/base";
import type { ContaFinanceira } from "../fused";

export interface FinancialGoal {
  version: 1; id: string; user_id: string; name: string; target_cents: number;
  deadline: string | null; image_file_id: string | null; archived_at: string | null;
  revision: string; created_at: string; updated_at: string;
}
/** Immutable original money allocation. Releases never replace this record. */
export interface GoalReservation {
  readonly version: 1; readonly id: string; readonly user_id: string; readonly goal_id: string; readonly account_id: string;
  readonly amount_cents: number; readonly occurred_on: string; readonly client_id: string; readonly created_at: string;
}
export interface GoalRelease {
  readonly version: 1; readonly id: string; readonly user_id: string; readonly reservation_id: string;
  readonly amount_cents: number; readonly occurred_on: string; readonly client_id: string; readonly created_at: string;
}
/** Exactly one aggregate per owner. id === user_id; no progress counter. */
export interface GoalHighlight {
  version: 1; id: string; user_id: string; goal_id: string | null;
  revision: string; created_at: string; updated_at: string;
}
export type GoalAccount = Pick<ContaFinanceira, "id" | "user_id" | "kind" | "currency" | "archived_at">;
export interface GoalImage { id: string; user_id: string; purpose: "finance_goal_image"; status: "finalized"; deleted_at: null }
export interface GoalAccountTotals { user_id: string; account_id: string; finance_revision: string; real_balance_cents: number; reserved_cents: number }
export interface GoalTotals { user_id: string; goal_id: string; finance_revision: string; saved_cents: number }
export interface GoalReleaseTotals { user_id: string; reservation_id: string; finance_revision: string; released_cents: number }
export type GoalRow = FinancialGoal | GoalReservation | GoalRelease | GoalHighlight;
export interface GoalEvent {
  id: string; user_id: string; entity_type: "finance_goal" | "finance_goal_reservation" | "finance_goal_release" | "finance_goal_highlight";
  entity_id: string; action: "created" | "updated" | "status_changed"; canal: ContextoDeEscrita["canal"];
  occurred_at: string; before: GoalRow | null; after: GoalRow;
}
export interface GoalCommonInput { client_id: string; expected_finance_revision: string }
export interface GoalFields { name: string; target_cents: number; deadline: string | null; image_file_id: string | null }
export interface GoalExistingInput extends GoalCommonInput { goal_id: string; expected_revision: string }
export type GoalCommand =
  | { command: "finance.goal.create"; input: GoalCommonInput & GoalFields }
  | { command: "finance.goal.update"; input: GoalExistingInput & { patch: Partial<GoalFields> } }
  | { command: "finance.goal.archive" | "finance.goal.restore"; input: GoalExistingInput }
  | { command: "finance.goal.highlight"; input: GoalCommonInput & { goal_id: string | null; expected_highlight_revision: string } }
  | { command: "finance.goal.contribute"; input: GoalExistingInput & { account_id: string; amount_cents: number; occurred_on: string } }
  | { command: "finance.goal.release"; input: GoalCommonInput & { reservation_id: string; amount_cents: number; occurred_on: string } };
export type GoalCommandResult =
  | { version: 1; goal: FinancialGoal }
  | { version: 1; goal: FinancialGoal; highlight: GoalHighlight | null }
  | { version: 1; highlight: GoalHighlight | null }
  | { version: 1; reservation: GoalReservation }
  | { version: 1; release: GoalRelease };
export interface GoalProgress {
  goal_id: string; saved_cents: number; target_cents: number; remaining_cents: number;
  excess_cents: number; reached: boolean; bar_basis_points: number;
}
export interface GoalAccountAvailability { user_id: string; account_id: string; real_balance_cents: number; reserved_cents: number; available_cents: number }
