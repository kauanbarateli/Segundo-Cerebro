import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), gateway: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/finance-goals-runtime", () => ({ financeGoalsGatewayForRequest: seams.gateway }));
import { POST } from "../../src/app/api/finance/goals/preview/route";
import { assinatura } from "../../src/core/contracts/base";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { GoalGatewayFixture, channelGoalCreate, GOAL_SESSION } from "../fixtures/finance-goals-channel";
import { financialGoal, goalAccount, goalId, goalReservation, GOAL_NOW, GOAL_OTHER, GOAL_OWNER, GOAL_TODAY } from "../fixtures/finance-goals";
const origin = "https://app.example.test", actor = { userId: GOAL_OWNER, sessionId: GOAL_SESSION, mustChangePassword: false, role: "user", entitlements: { financeiro: true } };
const write = (command: GoalCommand) => new Request(origin + "/api/finance/goals/preview", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": GOAL_OWNER }, body: JSON.stringify(command) });
const contribute = (): GoalCommand => ({ command: "finance.goal.contribute", input: { client_id: goalId(995), expected_finance_revision: "0", goal_id: goalId(5), expected_revision: "0", account_id: goalAccount.id, amount_cents: 10000, occurred_on: GOAL_TODAY } });
let gateway: GoalGatewayFixture;
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("UNEXPECTED_HTTP"); })); vi.useFakeTimers(); vi.setSystemTime(new Date(GOAL_NOW)); vi.stubEnv("FINANCE_GOALS_V1_ENABLED", "true"); gateway = new GoalGatewayFixture(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.services.mockResolvedValue({ gateway: { readIdentity: async () => structuredClone(actor) } }); seams.gateway.mockReturnValue(gateway); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.unstubAllEnvs(); });
it("prepares one exact intent readonly with a bound reply and no invented entity result", async () => {
  const command = channelGoalCreate(), response = await POST(write(command)), wire = await response.json();
  expect(wire).toEqual({ ok: true, binding: { version: 1, command: command.command, client_id: command.input.client_id }, result: { kind: "review", intent: command, financeRevision: "0", goalRevision: null, highlightRevision: null, account: null } });
  expect(gateway.calls).toEqual({ snapshot: 1, commit: 0 }); expect(gateway.receipts).toHaveLength(0); expect(gateway.goals).toHaveLength(0);
});
it("uses complete own AccountTotals at the same revision, not sums of pages", async () => {
  gateway.goals.push(financialGoal()); gateway.reservationsRows.push(goalReservation()); const response = await POST(write(contribute())), wire = await response.json();
  expect(response.status).toBe(200); expect(wire.result.account).toEqual({ id: goalAccount.id, realBalance: 100000, reserved: 20000, available: 80000 }); expect(gateway.calls).toEqual({ snapshot: 1, commit: 0 });
});
it.each(["revision", "goalRevision", "insufficient", "card", "archived", "future"])("does not produce a fresh review after %s changes", async mode => {
  gateway.goals.push(financialGoal()); const intent = contribute(); if (intent.command !== "finance.goal.contribute") throw new Error("fixture");
  if (mode === "revision") gateway.revision = "1"; if (mode === "goalRevision") gateway.goals[0]!.revision = "1"; if (mode === "insufficient") intent.input.amount_cents = 100001; if (mode === "card") gateway.account.kind = "credit_card"; if (mode === "archived") gateway.account.archived_at = GOAL_NOW; if (mode === "future") intent.input.occurred_on = "2026-10-24";
  const response = await POST(write(intent)); expect(response.status).toBe(mode === "revision" || mode === "goalRevision" ? 409 : 400); expect((await response.json()).ok).toBe(false); expect(gateway.calls.commit).toBe(0);
});
it("returns a valid original receipt before missing current references and changed revision", async () => {
  const command = channelGoalCreate(), result = { version: 1 as const, goal: financialGoal({ name: command.input.name }) }; gateway.revision = "99";
  gateway.receipts.push({ user_id: GOAL_OWNER, command: command.command, client_id: command.input.client_id, fingerprint: assinatura(command.input), result });
  const response = await POST(write(command)); expect(response.status).toBe(200); expect((await response.json()).result).toEqual({ kind: "confirmed", intent: command, result }); expect(gateway.calls).toEqual({ snapshot: 1, commit: 0 });
});
it("refuses foreign totals, changed fingerprint and new image without a finalized own reference", async () => {
  gateway.goals.push(financialGoal()); const original = gateway.snapshot.bind(gateway); vi.spyOn(gateway, "snapshot").mockImplementation(async intent => { const snapshot = await original(intent); if (snapshot.account_totals[0]) snapshot.account_totals[0].user_id = GOAL_OTHER; return snapshot; });
  expect((await POST(write(contribute()))).status).toBe(503);
  const command = channelGoalCreate(); gateway.receipts.push({ user_id: GOAL_OWNER, command: command.command, client_id: command.input.client_id, fingerprint: "altered", result: { version: 1, goal: financialGoal({ name: command.input.name }) } }); expect((await POST(write(command))).status).toBe(503);
  gateway.receipts = []; command.input.image_file_id = goalId(333); expect((await POST(write(command))).status).toBe(400); expect(gateway.calls.commit).toBe(0);
});
