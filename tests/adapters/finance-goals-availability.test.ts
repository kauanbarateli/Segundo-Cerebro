import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), gateway: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/finance-goals-runtime", () => ({ financeGoalsGatewayForRequest: seams.gateway }));
import { financeGoalsAvailable } from "../../src/adapters/db/finance-goals-availability";
import { GET as available } from "../../src/app/api/finance/goals/availability/route";
import { GET as views, POST as execute } from "../../src/app/api/finance/goals/route";
import { POST as preview } from "../../src/app/api/finance/goals/preview/route";
import { AuthGuardError } from "../../src/lib/auth/types";
import { GOAL_OWNER, GOAL_OTHER } from "../fixtures/finance-goals";
import { channelGoalCreate, GOAL_SESSION } from "../fixtures/finance-goals-channel";
const origin = "https://app.example.test", actor = { userId: GOAL_OWNER, sessionId: GOAL_SESSION, mustChangePassword: false, role: "user", entitlements: { financeiro: true } };
const request = (query = "", owner = GOAL_OWNER) => new Request(origin + "/api/finance/goals/availability" + query, { headers: { "X-Expected-User-ID": owner } });
const write = () => new Request(origin + "/api/finance/goals", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": GOAL_OWNER }, body: JSON.stringify(channelGoalCreate()) });
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("UNEXPECTED_HTTP"); })); vi.stubEnv("FINANCE_GOALS_V1_ENABLED", "false"); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.services.mockResolvedValue({ gateway: { readIdentity: async () => structuredClone(actor) } }); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("is off by default and only the exact true string enables new operations", () => { expect(financeGoalsAvailable({})).toBe(false); for (const value of ["", "false", "TRUE", "1", "true "]) expect(financeGoalsAvailable({ FINANCE_GOALS_V1_ENABLED: value })).toBe(false); expect(financeGoalsAvailable({ FINANCE_GOALS_V1_ENABLED: "true" })).toBe(true); });
it("reports off without any Goals RPC; new views, prepare and execute are gated", async () => {
  const response = await available(request()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true, result: { available: false } });
  expect((await views(new Request(origin + "/api/finance/goals?view=page", { headers: { "X-Expected-User-ID": GOAL_OWNER } }))).status).toBe(503);
  expect((await preview(write())).status).toBe(503); expect((await execute(write())).status).toBe(503); expect(seams.gateway).not.toHaveBeenCalled();
});
it("checks identity, feature, mandatory password and expected owner before availability", async () => {
  seams.services.mockResolvedValue({ gateway: { readIdentity: async () => null } }); expect((await available(request())).status).toBe(401);
  for (const denied of [{ ...actor, entitlements: { financeiro: false } }, { ...actor, mustChangePassword: true }]) { seams.services.mockResolvedValue({ gateway: { readIdentity: async () => denied } }); expect((await available(request())).status).toBe(403); }
  seams.services.mockResolvedValue({ gateway: { readIdentity: async () => actor } }); expect((await available(request("", GOAL_OTHER))).status).toBe(409); expect((await available(new Request(origin))).status).toBe(400); expect(seams.gateway).not.toHaveBeenCalled();
});
it("does not bypass deployment/configuration, demo or query guards", async () => {
  expect((await available(request("?x=1"))).status).toBe(400); seams.config.mockReturnValue({ mode: "demo" }); expect((await available(request())).status).toBe(503);
  seams.config.mockImplementation(() => { throw new AuthGuardError("unavailable"); }); expect((await available(request())).status).toBe(503); expect(seams.gateway).not.toHaveBeenCalled();
});
