import { exigir } from "../../contracts/base";
import { totalExato } from "../arithmetic";
import { decodeFinancialGoal, decodeGoalReservation, goalCents, goalRecord, goalUuid } from "./goal-validation";
import type { FinancialGoal, GoalAccountAvailability, GoalProgress, GoalReservation } from "./goal-types";

export function activeReservationAmount(value: GoalReservation, releasedCents: number): number {
  const reservation = decodeGoalReservation(value); goalCents(releasedCents, true);
  exigir(releasedCents <= reservation.amount_cents, "A liberação ultrapassa o aporte original."); return totalExato(BigInt(reservation.amount_cents) - BigInt(releasedCents), "Reserva ativa");
}
export function projectGoalProgress(value: FinancialGoal, savedCents: number): GoalProgress {
  const goal = decodeFinancialGoal(value); goalCents(savedCents, true); const saved = BigInt(savedCents), target = BigInt(goal.target_cents);
  return { goal_id: goal.id, saved_cents: savedCents, target_cents: goal.target_cents,
    remaining_cents: totalExato(saved < target ? target - saved : 0n, "Restante da meta"), excess_cents: totalExato(saved > target ? saved - target : 0n, "Valor além da meta"), reached: saved >= target,
    bar_basis_points: Number(saved >= target ? 10000n : saved * 10000n / target) };
}
/** Does not subtract invoices, change cash/wealth or invent real transactions. */
export function projectAccountAvailability(value: { user_id: string; account_id: string; real_balance_cents: number; reserved_cents: number }): GoalAccountAvailability {
  const row = goalRecord(value, ["user_id", "account_id", "real_balance_cents", "reserved_cents"]);
  goalUuid(row.user_id); goalUuid(row.account_id); goalCents(row.real_balance_cents, true, true); goalCents(row.reserved_cents, true);
  return { user_id: row.user_id, account_id: row.account_id, real_balance_cents: row.real_balance_cents, reserved_cents: row.reserved_cents,
    available_cents: totalExato(BigInt(row.real_balance_cents) - BigInt(row.reserved_cents), "Disponível após reservas") };
}
/** The adapter/SQL must enforce this in the actual account-close transaction. */
export function mayCloseAccount(reservedCents: number): boolean { goalCents(reservedCents, true); return reservedCents === 0; }
