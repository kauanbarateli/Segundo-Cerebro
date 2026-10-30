import { expect, it } from "vitest";
import { decodeGoalTerminalOutcome, GOAL_TERMINAL_HTTP_PATHS, GOAL_TERMINAL_REPLY_JSON_LIMITS, type GoalTerminalBinding } from "../../src/lib/finance-goals-terminal-contract";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { financialGoal, goalId, GOAL_OTHER, GOAL_OWNER } from "../fixtures/finance-goals";

const at = "2026-10-23T12:00:00.000Z";
function data() {
  const original: Extract<GoalCommand, { command: "finance.goal.create" }> = { command: "finance.goal.create", input: { client_id: goalId(991), expected_finance_revision: "0", name: "Meta da fixture", target_cents: 100000, deadline: null, image_file_id: null } };
  const binding: GoalTerminalBinding = { version: 2, user_id: GOAL_OWNER, command: original.command, client_id: original.input.client_id, canonicalization_version: 1, input_digest: "a".repeat(64) };
  const closed = { version: 2, kind: "closed", binding, disposition: { ...binding, id: goalId(100), closed_at: at } };
  const result = { version: 1, goal: financialGoal({ name: original.input.name, target_cents: original.input.target_cents, deadline: null, image_file_id: null, revision: "0" }) };
  return { original, binding, closed, result };
}
it("exports the terminal2 paths and finite browser scanner limits without a server capture", () => {
  expect(GOAL_TERMINAL_HTTP_PATHS).toEqual({ status: "/api/finance/goals/attempt/status", settle: "/api/finance/goals/attempt/settle" });
  expect(GOAL_TERMINAL_REPLY_JSON_LIMITS).toEqual({ maxDepth: 6, maxProperties: 64 });
});
it("decodes only exact bound closed/uncertain and original financial result1", () => {
  const { original, binding, closed, result } = data();
  expect(decodeGoalTerminalOutcome(binding, original, closed)).toEqual(closed);
  expect(decodeGoalTerminalOutcome(binding, original, { version: 2, kind: "uncertain", binding })).toEqual({ version: 2, kind: "uncertain", binding });
  expect(decodeGoalTerminalOutcome(binding, original, { version: 2, kind: "confirmed", binding, result })).toEqual({ version: 2, kind: "confirmed", binding, result });
  const copy = decodeGoalTerminalOutcome(binding, original, closed); copy.binding.input_digest = "b".repeat(64); expect(binding.input_digest).toBe("a".repeat(64));
});
it("refuses a substituted expectation, original, owner, namespace, version, digest or disposition", () => {
  const { original, binding, closed, result } = data();
  for (const change of [{ user_id: GOAL_OTHER }, { client_id: goalId(101) }, { command: "finance.goal.release" }, { version: 1 }, { canonicalization_version: 2 }, { input_digest: "b".repeat(64) }]) {
    expect(() => decodeGoalTerminalOutcome(binding, original, { ...closed, binding: { ...binding, ...change } })).toThrow();
    expect(() => decodeGoalTerminalOutcome(binding, original, { ...closed, disposition: { ...closed.disposition, ...change } })).toThrow();
  }
  expect(() => decodeGoalTerminalOutcome({ ...binding, input_digest: "A".repeat(64) }, original, closed)).toThrow();
  expect(() => decodeGoalTerminalOutcome(binding, { ...original, input: { ...original.input, client_id: goalId(101) } }, closed)).toThrow();
  for (const value of [{ ...closed, extra: true }, { ...closed, version: 1 }, { ...closed, disposition: { ...closed.disposition, extra: true } }, { ...closed, disposition: { ...closed.disposition, closed_at: "yesterday" } }, { version: 2, kind: "uncertain", binding, result }, { version: 2, kind: "confirmed", binding, result: { ...result, version: 2 } }, { version: 2, kind: "confirmed", binding, result: { ...result, goal: { ...result.goal, revision: "1" } } }]) expect(() => decodeGoalTerminalOutcome(binding, original, value)).toThrow();
});
it("does not invoke caller getters while checking a binding/result", () => {
  const { original, binding, closed } = data(); let calls = 0;
  const hostile = { ...binding, get input_digest() { calls++; return binding.input_digest; } };
  expect(() => decodeGoalTerminalOutcome(hostile, original, closed)).toThrow(); expect(calls).toBe(0);
});
