import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), gateway: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/finance-goals-runtime", () => ({ financeGoalsGatewayForRequest: seams.gateway }));
import { GET, POST } from "../../src/app/api/finance/goals/route";
import { GoalGatewayFixture, channelGoalCreate, GOAL_SESSION } from "../fixtures/finance-goals-channel";
import { financialGoal, goalId, GOAL_NOW, GOAL_OTHER, GOAL_OWNER } from "../fixtures/finance-goals";
const origin = "https://app.example.test", actor = { userId: GOAL_OWNER, sessionId: GOAL_SESSION, mustChangePassword: false, role: "user", entitlements: { financeiro: true } };
const write = (body: unknown = channelGoalCreate(), owner = GOAL_OWNER, from = origin, type = "application/json") => new Request(origin + "/api/finance/goals", { method: "POST", headers: { Origin: from, "Content-Type": type, "X-Expected-User-ID": owner }, body: JSON.stringify(body) });
const read = (query: string) => new Request(origin + "/api/finance/goals?" + query, { headers: { "X-Expected-User-ID": GOAL_OWNER } });
let gateway: GoalGatewayFixture;
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("UNEXPECTED_HTTP"); })); vi.useFakeTimers(); vi.setSystemTime(new Date(GOAL_NOW)); vi.stubEnv("FINANCE_GOALS_V1_ENABLED", "true"); gateway = new GoalGatewayFixture(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.services.mockResolvedValue({ gateway: { readIdentity: async () => structuredClone(actor) } }); seams.gateway.mockReturnValue(gateway); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.unstubAllEnvs(); });
it("routes each explicit view to its finite gateway read without committing", async () => {
  gateway.goals.push(financialGoal()); const page = vi.spyOn(gateway, "page"), detail = vi.spyOn(gateway, "detail"), reservations = vi.spyOn(gateway, "reservations"), releases = vi.spyOn(gateway, "releases");
  for (const query of ["view=page&limit=1&archived=all", "view=detail&id=" + goalId(5), "view=reservations&id=" + goalId(5), "view=releases&id=" + goalId(6)]) expect((await GET(read(query))).status).toBe(200);
  expect(page).toHaveBeenCalledWith({ cursor: null, limit: 1, archived: "all" }); expect(detail).toHaveBeenCalledWith(goalId(5)); expect(reservations).toHaveBeenCalledWith({ id: goalId(5), cursor: null, limit: 20 }); expect(releases).toHaveBeenCalledWith({ id: goalId(6), cursor: null, limit: 20 }); expect(gateway.calls).toEqual({ snapshot: 0, commit: 0 });
  const missing = await GET(read("view=detail&id=" + goalId(400))); expect(await missing.json()).toEqual({ ok: true, result: null });
});
it("uses the real Core and Store with the SDK actor and one atomic receipt/event batch", async () => {
  const intent = channelGoalCreate(), response = await POST(write(intent)), wire = await response.json();
  expect(response.status).toBe(200); expect(wire).toMatchObject({ ok: true, binding: { version: 1, command: intent.command, client_id: intent.input.client_id }, result: { version: 1, goal: { user_id: GOAL_OWNER, name: intent.input.name, revision: "0" } } });
  expect(gateway.calls).toEqual({ snapshot: 1, commit: 1 }); expect(gateway.lastCommit?.context).toEqual({ user_id: GOAL_OWNER, canal: "web" }); expect(gateway.lastCommit?.request).toEqual(intent); expect(gateway.lastCommit?.changes).toHaveLength(1); expect(gateway.lastCommit?.events).toHaveLength(1); expect(gateway.receipts).toHaveLength(1);
  expect(response.headers.get("cache-control")).toContain("no-store"); expect(JSON.stringify(wire)).not.toMatch(/fingerprint|session_id|receipt|events/);
});
it("returns the original result on receipt-first replay, not another write", async () => {
  const request = channelGoalCreate(), first = await (await POST(write(request))).json(); gateway.goals = []; gateway.revision = "99";
  const replay = await (await POST(write(request))).json(); expect(replay).toEqual(first); expect(gateway.calls.commit).toBe(1);
});
it("keeps unknown outcome closed, without retrying the commit", async () => {
  gateway.mode = "unknown_before"; const response = await POST(write()); expect(response.status).toBe(503); expect((await response.json()).code).toBe("uncertain"); expect(gateway.calls).toEqual({ snapshot: 2, commit: 1 }); expect(gateway.receipts).toHaveLength(0);
});
it("times out or aborts an unfinished body before any Goals RPC or executor effect", async () => {
  for (const aborted of [false, true]) {
    const abort = new AbortController(), cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(channelGoalCreate()))); }, cancel });
    const request = new Request(origin + "/api/finance/goals", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": GOAL_OWNER }, signal: abort.signal, body, duplex: "half" } as RequestInit & { duplex: "half" });
    const pending = POST(request); await vi.advanceTimersByTimeAsync(0);
    if (aborted) abort.abort(); else await vi.advanceTimersByTimeAsync(15_000);
    const response = await pending; expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "unavailable", message: "Esta operação não está disponível nesta sessão." });
    expect(cancel).toHaveBeenCalledTimes(1); expect(body.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
  }
  expect(seams.gateway).not.toHaveBeenCalled(); expect(gateway.calls).toEqual({ snapshot: 0, commit: 0 }); expect(gateway.lastCommit).toBeNull(); expect(gateway.receipts).toHaveLength(0);
});
it("never accepts caller identity/context or bypasses origin/media-type/owner guards", async () => {
  for (const request of [write({ ...channelGoalCreate(), user_id: GOAL_OTHER }), write(channelGoalCreate(), GOAL_OTHER), write(channelGoalCreate(), GOAL_OWNER, "https://elsewhere.invalid"), write(channelGoalCreate(), GOAL_OWNER, origin, "text/plain"), write(channelGoalCreate(), GOAL_OWNER, origin, "application/json;charset=iso-8859-1")]) expect((await POST(request)).status).not.toBe(200);
  expect(seams.gateway).not.toHaveBeenCalled(); expect(gateway.calls).toEqual({ snapshot: 0, commit: 0 });
});
it("refuses query ambiguity before constructing a read gateway", async () => { expect((await GET(read("view=page&limit=1&limit=2"))).status).toBe(400); expect(seams.gateway).not.toHaveBeenCalled(); });
