import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), gateway: vi.fn(), execute: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/finance-goals-runtime", () => ({ financeGoalsGatewayForRequest: seams.gateway }));
vi.mock("../../src/core/financeiro/goals/goal-use-cases", async importOriginal => ({ ...await importOriginal<typeof import("../../src/core/financeiro/goals/goal-use-cases")>(), executeGoalCommand: seams.execute }));
import { POST } from "../../src/app/api/finance/goals/reconcile/route";
import { assinatura } from "../../src/core/contracts/base";
import { GoalGatewayFixture, channelGoalCreate, GOAL_SESSION } from "../fixtures/finance-goals-channel";
import { financialGoal, GOAL_OTHER, GOAL_OWNER } from "../fixtures/finance-goals";
const origin = "https://app.example.test", actor = { userId: GOAL_OWNER, sessionId: GOAL_SESSION, mustChangePassword: false, role: "user", entitlements: { financeiro: true } };
const write = (owner = GOAL_OWNER, from = origin) => new Request(origin + "/api/finance/goals/reconcile", { method: "POST", headers: { Origin: from, "Content-Type": "application/json", "X-Expected-User-ID": owner }, body: JSON.stringify(channelGoalCreate()) });
let gateway: GoalGatewayFixture;
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("UNEXPECTED_HTTP"); })); vi.stubEnv("FINANCE_GOALS_V1_ENABLED", "false"); gateway = new GoalGatewayFixture(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.services.mockResolvedValue({ gateway: { readIdentity: async () => structuredClone(actor) } }); seams.gateway.mockReturnValue(gateway); seams.execute.mockImplementation(() => { throw new Error("RECONCILE_MUST_NOT_EXECUTE"); }); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("queries a valid own receipt with the enabled flag off, no Core execution or commit", async () => {
  const intent = channelGoalCreate(), result = { version: 1 as const, goal: financialGoal({ name: intent.input.name }) }; gateway.revision = "99"; gateway.receipts.push({ user_id: GOAL_OWNER, command: intent.command, client_id: intent.input.client_id, fingerprint: assinatura(intent.input), result });
  const response = await POST(write()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true, binding: { version: 1, command: intent.command, client_id: intent.input.client_id }, result }); expect(gateway.calls).toEqual({ snapshot: 1, commit: 0 }); expect(seams.execute).not.toHaveBeenCalled();
});
it("no receipt is uncertain, never proof of absence or a reason to execute", async () => {
  const response = await POST(write()); expect(response.status).toBe(503); const wire = await response.json(); expect(wire).toMatchObject({ ok: false, code: "uncertain" }); expect(Object.keys(wire).sort()).toEqual(["code", "message", "ok"]); expect(gateway.calls).toEqual({ snapshot: 1, commit: 0 }); expect(seams.execute).not.toHaveBeenCalled(); expect(gateway.receipts).toHaveLength(0);
});
it.each(["owner", "fingerprint", "client", "result"])("malformed %s receipt fails closed without fallback", async mode => {
  const intent = channelGoalCreate(); gateway.receipts.push({ user_id: mode === "owner" ? GOAL_OTHER : GOAL_OWNER, command: intent.command, client_id: intent.input.client_id, fingerprint: mode === "fingerprint" ? "changed" : assinatura(intent.input), result: { version: 1, goal: financialGoal({ user_id: mode === "result" ? GOAL_OTHER : GOAL_OWNER, name: intent.input.name }) } });
  if (mode === "client") {
    const receipt = structuredClone(gateway.receipts[0]!); receipt.client_id = GOAL_OTHER;
    const original = gateway.snapshot.bind(gateway); vi.spyOn(gateway, "snapshot").mockImplementation(async request => ({ ...await original(request), receipt }));
  }
  const response = await POST(write()); expect(response.status).toBe(503); expect((await response.json()).ok).toBe(false); expect(gateway.calls.commit).toBe(0); expect(seams.execute).not.toHaveBeenCalled();
});
it("Auth, feature, mandatory password, origin and owner remain mandatory with the flag off", async () => {
  for (const denied of [null, { ...actor, entitlements: { financeiro: false } }, { ...actor, mustChangePassword: true }]) { seams.services.mockResolvedValue({ gateway: { readIdentity: async () => denied } }); expect((await POST(write())).status).toBe(denied === null ? 401 : 403); }
  seams.services.mockResolvedValue({ gateway: { readIdentity: async () => actor } }); expect((await POST(write(GOAL_OTHER))).status).toBe(409); expect((await POST(write(GOAL_OWNER, "https://other.invalid"))).status).toBe(403); expect(seams.gateway).not.toHaveBeenCalled(); expect(seams.execute).not.toHaveBeenCalled();
});
it("missing RPC or unknown transport remains unavailable and never becomes empty success", async () => {
  gateway.failSnapshot = () => { throw new Error("PRIVATE_GOALS_SQL_CANARY"); }; const response = await POST(write()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("PRIVATE_GOALS_SQL_CANARY"); expect(gateway.calls).toEqual({ snapshot: 1, commit: 0 }); expect(seams.execute).not.toHaveBeenCalled();
});
