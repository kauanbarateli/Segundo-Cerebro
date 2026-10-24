import { createHash, randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { assinatura } from "../../src/core/contracts/base";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
vi.mock("server-only", () => ({}));
import { captureGoalTerminalAttempt, decodeGoalTerminalReply, goalTerminalRpcRequest } from "../../src/adapters/db/finance-goals-terminal-canonical";

const owner = "79f00000-0000-4000-8000-000000000001", goalId = "79f00000-0000-4000-8000-000000000002", at = "2026-10-23T12:00:00.000Z";
function create(name = "Meta") : Extract<GoalCommand, { command: "finance.goal.create" }> {
  return { command: "finance.goal.create", input: { client_id: randomUUID(), expected_finance_revision: "9223372036854775807", name, target_cents: 9007199254740991, deadline: null, image_file_id: null } };
}
const common = () => ({ client_id: randomUUID(), expected_finance_revision: "0" });
const existing = () => ({ ...common(), goal_id: goalId, expected_revision: "0" });
function golden(): GoalCommand[] { return [create(),
  { command: "finance.goal.update", input: { ...existing(), patch: { name: " Outra " } } },
  { command: "finance.goal.archive", input: existing() }, { command: "finance.goal.restore", input: existing() },
  { command: "finance.goal.highlight", input: { ...common(), goal_id: null, expected_highlight_revision: "0" } },
  { command: "finance.goal.contribute", input: { ...existing(), account_id: randomUUID(), amount_cents: 1, occurred_on: "2026-10-23" } },
  { command: "finance.goal.release", input: { ...common(), reservation_id: randomUUID(), amount_cents: 1, occurred_on: "2026-10-23" } },
]; }
it("captures all seven commands using the exact existing assinatura and UTF-8 SHA256, not JSONB/JCS", () => {
  for (const request of golden()) {
    const token = captureGoalTerminalAttempt(owner, request), envelope = goalTerminalRpcRequest(token), text = assinatura(request.input);
    expect(envelope).toEqual({ version: 2, canonicalization_version: 1, command: request.command, client_id: request.input.client_id, canonical_input: text });
    expect(token.binding.input_digest).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
    expect(JSON.parse(text)).toEqual(request.input);
    const reverse = { command: request.command, input: Object.fromEntries(Object.entries(request.input).reverse()) };
    expect(goalTerminalRpcRequest(captureGoalTerminalAttempt(owner, reverse))).toEqual(envelope);
  }
});
it("preserves all fifteen nonempty patch subsets, null versus omission and Unicode without normalization", () => {
  const fields = { name: " e\u0301 / é / 😀 ", target_cents: 2, deadline: null, image_file_id: null };
  for (let mask = 1; mask < 16; mask++) {
    const patch = Object.fromEntries(Object.entries(fields).filter((_, index) => (mask & 2 ** index) !== 0));
    const request = { command: "finance.goal.update", input: { ...existing(), patch } };
    expect(JSON.parse(goalTerminalRpcRequest(captureGoalTerminalAttempt(owner, request)).canonical_input)).toEqual(request.input);
  }
  const sameId = common();
  const first = { command: "finance.goal.update", input: { ...sameId, goal_id: goalId, expected_revision: "0", patch: { name: "é" } } };
  const second = { ...first, input: { ...first.input, patch: { name: "e\u0301" } } };
  expect(captureGoalTerminalAttempt(owner, first).binding.input_digest).not.toBe(captureGoalTerminalAttempt(owner, second).binding.input_digest);
});
it.each(["N\u0000UL", "high\ud800", "low\udfff", "quotes\"\\\n\t", "line\u2028paragraph\u2029", "astral😀", "\u0001control", "NUL\u0000\ud800😀"])("keeps arbitrary Core-permitted string escaped transiently: %j", name => {
  const request = create(name), token = captureGoalTerminalAttempt(owner, request), wire = JSON.stringify(goalTerminalRpcRequest(token));
  const envelope = JSON.parse(wire); expect(envelope.canonical_input).toBe(assinatura(request.input)); expect(JSON.parse(envelope.canonical_input).name).toBe(name);
  expect(wire.includes("\u0000")).toBe(false); // No actual NUL in the outer transport.
});
it("does not expose aliases or accept a forged capture/digest/getter or non-Goal command", () => {
  const request = create(), token = captureGoalTerminalAttempt(owner, request), original = goalTerminalRpcRequest(token);
  request.input.name = "Changed after capture"; request.input.client_id = randomUUID(); const copy = goalTerminalRpcRequest(token); copy.canonical_input = "{}"; copy.client_id = randomUUID();
  expect(goalTerminalRpcRequest(token)).toEqual(original); expect(Object.isFrozen(token)).toBe(true); expect(Object.isFrozen(token.binding)).toBe(true);
  expect(() => goalTerminalRpcRequest({ binding: { ...token.binding } })).toThrow();
  let called = 0; const getter = { command: "finance.goal.create", get input() { called++; return original; } };
  expect(() => captureGoalTerminalAttempt(owner, getter)).toThrow(); expect(called).toBe(0);
  expect(() => captureGoalTerminalAttempt(owner, { command: "finance.goal.settle", input: {} })).toThrow();
  expect(() => captureGoalTerminalAttempt(owner, { ...create(), canonical_input: "{}", input_digest: "0".repeat(64) })).toThrow();
  expect(() => captureGoalTerminalAttempt(owner, create("x".repeat(161)))).toThrow();
  expect(() => captureGoalTerminalAttempt(owner, { ...create(), input: { ...create().input, target_cents: -0 } })).toThrow();
  expect(() => captureGoalTerminalAttempt(owner, { ...create(), input: { ...create().input, expected_finance_revision: "00" } })).toThrow();
});
it("decodes only bound closed/uncertain/confirmed states with the original result codec", () => {
  const request = create(), token = captureGoalTerminalAttempt(owner, request), binding = { ...token.binding };
  const disposition = { ...binding, id: randomUUID(), closed_at: at }, closed = { version: 2, kind: "closed", binding, disposition };
  expect(decodeGoalTerminalReply(token, closed)).toEqual(closed);
  expect(decodeGoalTerminalReply(token, { version: 2, kind: "uncertain", binding })).toEqual({ version: 2, kind: "uncertain", binding });
  const result = { version: 1, goal: { version: 1, id: goalId, user_id: owner, name: request.input.name, target_cents: request.input.target_cents, deadline: null, image_file_id: null, archived_at: null, revision: "0", created_at: at, updated_at: at } };
  expect(decodeGoalTerminalReply(token, { version: 2, kind: "confirmed", binding, result })).toEqual({ version: 2, kind: "confirmed", binding, result });
  for (const field of ["user_id", "command", "client_id", "input_digest", "canonicalization_version", "version"]) expect(() => decodeGoalTerminalReply(token, { ...closed, binding: { ...binding, [field]: "wrong" } })).toThrow();
  expect(() => decodeGoalTerminalReply(token, { ...closed, disposition: { ...disposition, input_digest: "0".repeat(64) } })).toThrow();
  expect(() => decodeGoalTerminalReply(token, { ...closed, disposition: { ...disposition, extra: true } })).toThrow();
  expect(() => decodeGoalTerminalReply(token, { version: 2, kind: "uncertain", binding, result })).toThrow();
  expect(() => decodeGoalTerminalReply(token, { version: 2, kind: "confirmed", binding, result: { ...result, goal: { ...result.goal, revision: "1" } } })).toThrow();
  // Terminal protocol2 and financial result1 are distinct; never downgrade or
  // promote a financial result just because the terminal wire version changed.
  expect(() => decodeGoalTerminalReply(token, { ...closed, version: 1 })).toThrow();
  expect(() => decodeGoalTerminalReply(token, { ...closed, binding: { ...binding, version: 1 } })).toThrow();
  expect(() => decodeGoalTerminalReply(token, { ...closed, disposition: { ...disposition, version: 1 } })).toThrow();
  expect(() => decodeGoalTerminalReply(token, { version: 2, kind: "confirmed", binding, result: { ...result, version: 2 } })).toThrow();
});
it("never accepts an opaque envelope or raw input string in place of a Core GoalCommand", () => {
  const honest = captureGoalTerminalAttempt(owner, create()), envelope = goalTerminalRpcRequest(honest);
  for (const text of ["{", "[1]", '{"client_id":"x","client_id":"y"}', '{"patch":{"name":"x","name":"y"}}']) {
    expect(() => captureGoalTerminalAttempt(owner, { ...envelope, canonical_input: text })).toThrow();
    expect(() => captureGoalTerminalAttempt(owner, { command: envelope.command, input: text })).toThrow();
  }
  const foreign = captureGoalTerminalAttempt(owner, create("Other body"));
  expect(() => decodeGoalTerminalReply(honest, { version: 2, kind: "closed", binding: { ...honest.binding, input_digest: foreign.binding.input_digest }, disposition: { ...honest.binding, input_digest: foreign.binding.input_digest, id: randomUUID(), closed_at: at } })).toThrow();
});
