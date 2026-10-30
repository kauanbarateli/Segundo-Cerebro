import { expect, it } from "vitest";
import { activeReservationAmount, decodeGoalCommand, decodeFinancialGoal, mayCloseAccount, projectAccountAvailability, projectGoalProgress } from "../../src/core/financeiro/goals";
import { financialGoal, goalId, goalReservation, GOAL_OWNER } from "../fixtures/finance-goals";

const create = () => ({ command: "finance.goal.create", input: { client_id: goalId(100), expected_finance_revision: "0", name: "Nova meta", target_cents: 10000, deadline: null, image_file_id: null } });
it.each(["", "00", "01", "-1", "1.0", "9223372036854775808", 0, null])("rejects noncanonical/out-of-range revision %s", value => { const command = create(); expect(() => decodeGoalCommand({ ...command, input: { ...command.input, expected_finance_revision: value } })).toThrow(); });
it.each([{ name: "\u00a0\ufeff" }, { name: "a".repeat(161) }, { name: "🙂".repeat(81) }, { target_cents: 0 }, { target_cents: 1.5 }, { target_cents: Number.MAX_SAFE_INTEGER + 1 }, { deadline: "2027-02-29" }, { deadline: "0000-01-01" }, { image_file_id: "https://example.invalid/photo" }, { user_id: GOAL_OWNER }])("rejects invalid/extra goal fields %j", patch => { const command = create(); expect(() => decodeGoalCommand({ ...command, input: { ...command.input, ...patch } })).toThrow(); });
it("accepts civil boundaries and data fields without executing accessors or inherited overrides", () => {
  for (const deadline of ["0001-01-01", "2028-02-29", "9999-12-31"]) expect(decodeGoalCommand({ ...create(), input: { ...create().input, deadline } }).input).toHaveProperty("deadline", deadline);
  let read = 0; const bad = create(); Object.defineProperty(bad.input, "name", { enumerable: true, get() { read++; return "Getter"; } });
  expect(() => decodeGoalCommand(bad)).toThrow(); expect(read).toBe(0);
  const inherited = Object.create(create().input); expect(() => decodeGoalCommand({ command: "finance.goal.create", input: inherited })).toThrow();
  const proxy = new Proxy({}, { ownKeys() { throw "external arbitrary value"; } }); expect(() => decodeGoalCommand(proxy)).toThrow("Objeto de meta inválido");
});
it("keeps real values while clamping only the progress bar and preserves negative availability", () => {
  const goal = financialGoal({ target_cents: 10000 }), before = structuredClone(goal);
  expect(projectGoalProgress(goal, 20000)).toEqual({ goal_id: goal.id, saved_cents: 20000, target_cents: 10000, remaining_cents: 0, excess_cents: 10000, reached: true, bar_basis_points: 10000 });
  expect(projectGoalProgress(goal, 3333).bar_basis_points).toBe(3333); expect(goal).toEqual(before);
  expect(projectAccountAvailability({ user_id: GOAL_OWNER, account_id: goalId(3), real_balance_cents: 10000, reserved_cents: 15000 }).available_cents).toBe(-5000);
  expect(mayCloseAccount(15000)).toBe(false); expect(mayCloseAccount(0)).toBe(true);
});
it("does exact safe-cent arithmetic and never frees more than the immutable original", () => {
  const reservation = goalReservation(), before = structuredClone(reservation);
  expect(activeReservationAmount(reservation, 5000)).toBe(15000); expect(reservation).toEqual(before);
  expect(() => activeReservationAmount(reservation, 20001)).toThrow(); expect(() => activeReservationAmount(reservation, -1)).toThrow();
  expect(projectGoalProgress(financialGoal({ target_cents: 1 }), Number.MAX_SAFE_INTEGER).bar_basis_points).toBe(10000);
  expect(() => projectAccountAvailability({ user_id: GOAL_OWNER, account_id: goalId(3), real_balance_cents: -Number.MAX_SAFE_INTEGER, reserved_cents: Number.MAX_SAFE_INTEGER })).toThrow(RangeError);
  expect(() => decodeFinancialGoal({ ...financialGoal(), saved_cents: 1 })).toThrow();
});
