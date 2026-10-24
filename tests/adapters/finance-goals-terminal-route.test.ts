import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), terminal: vi.fn(), status: vi.fn(), settle: vi.fn(), execute: vi.fn(), gateway: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/finance-goals-terminal-runtime", () => ({ financeGoalsTerminalForRequest: seams.terminal }));
vi.mock("../../src/adapters/db/finance-goals-runtime", () => ({ financeGoalsGatewayForRequest: seams.gateway }));
vi.mock("../../src/core/financeiro/goals/goal-use-cases", async importOriginal => ({ ...await importOriginal<typeof import("../../src/core/financeiro/goals/goal-use-cases")>(), executeGoalCommand: seams.execute }));
import { POST as status } from "../../src/app/api/finance/goals/attempt/status/route";
import { POST as settle } from "../../src/app/api/finance/goals/attempt/settle/route";
import { goalTerminalRpcRequest, type CapturedGoalTerminalAttempt } from "../../src/adapters/db/finance-goals-terminal-canonical";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import { FinanceRateLimitError } from "../../src/adapters/db/finance-gateway";
import { AuthGuardError } from "../../src/lib/auth/types";
import { channelGoalCreate, GOAL_SESSION } from "../fixtures/finance-goals-channel";
import { financialGoal, goalId, GOAL_OTHER, GOAL_OWNER } from "../fixtures/finance-goals";

const origin = "https://app.example.test", actor = { userId: GOAL_OWNER, sessionId: GOAL_SESSION, mustChangePassword: false, role: "user", entitlements: { financeiro: true } };
const routes = [{ path: "status", post: status }, { path: "settle", post: settle }] as const;
function write(path: string, body = JSON.stringify(channelGoalCreate()), owner = GOAL_OWNER, from = origin, type = "application/json", extraHeaders: Record<string, string> = {}) {
  return new Request(`${origin}/api/finance/goals/attempt/${path}`, { method: "POST", headers: { Origin: from, "Content-Type": type, "X-Expected-User-ID": owner, ...extraHeaders }, body });
}
function closed(token: CapturedGoalTerminalAttempt) { return { version: 2, kind: "closed", binding: { ...token.binding }, disposition: { ...token.binding, id: goalId(808), closed_at: "2026-10-23T12:00:00.000Z" } }; }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("UNEXPECTED_HTTP"); })); vi.stubEnv("FINANCE_GOALS_V1_ENABLED", "false");
  seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.services.mockResolvedValue({ gateway: { readIdentity: async () => structuredClone(actor) } });
  seams.status.mockImplementation(async token => closed(token)); seams.settle.mockImplementation(async token => closed(token)); seams.terminal.mockReturnValue({ status: seams.status, settle: seams.settle });
  seams.execute.mockImplementation(() => { throw new Error("TERMINAL_MUST_NOT_EXECUTE"); }); seams.gateway.mockImplementation(() => { throw new Error("TERMINAL_MUST_NOT_READ_GOAL_SNAPSHOT"); });
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); expect(seams.execute).not.toHaveBeenCalled(); expect(seams.gateway).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("terminal routes — original command, dedicated version2 wire", () => {
  it.each(routes)("$path keeps flag-off recovery, nominal capture and exactly its own RPC operation", async ({ path, post }) => {
    const intent = channelGoalCreate(), response = await post(write(path, JSON.stringify(intent))), wire = await response.json();
    expect(response.status).toBe(200); expect(Object.keys(wire).sort()).toEqual(["ok", "result"]); expect(wire).toMatchObject({ ok: true, result: { version: 2, kind: "closed", binding: { version: 2, user_id: GOAL_OWNER, command: intent.command, client_id: intent.input.client_id, canonicalization_version: 1 } } });
    expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("vary")).toBe("Cookie"); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(seams.terminal).toHaveBeenCalledTimes(1); const token = (path === "status" ? seams.status : seams.settle).mock.calls[0]![0];
    expect(goalTerminalRpcRequest(token)).toMatchObject({ version: 2, command: intent.command, client_id: intent.input.client_id });
    expect(JSON.parse(goalTerminalRpcRequest(token).canonical_input)).toEqual(intent.input);
    expect(seams.status).toHaveBeenCalledTimes(path === "status" ? 1 : 0); expect(seams.settle).toHaveBeenCalledTimes(path === "settle" ? 1 : 0);
    expect(JSON.stringify(wire)).not.toMatch(/canonical_input|secret|session_id|events|receipts/);
  });
  it.each(routes)("$path returns uncertain as an inconclusive200 and financial confirmed with original result1", async ({ path, post }) => {
    const method = path === "status" ? seams.status : seams.settle;
    method.mockImplementationOnce(async token => ({ version: 2, kind: "uncertain", binding: { ...token.binding } }));
    expect(await (await post(write(path))).json()).toMatchObject({ ok: true, result: { version: 2, kind: "uncertain" } });
    method.mockImplementationOnce(async token => ({ version: 2, kind: "confirmed", binding: { ...token.binding }, result: { version: 1, goal: financialGoal() } }));
    expect(await (await post(write(path))).json()).toMatchObject({ ok: true, result: { version: 2, kind: "confirmed", result: { version: 1 } } });
  });
  it.each(routes)("$path retains session, feature, mandatory password, origin and expected owner guards", async ({ path, post }) => {
    for (const denied of [null, { ...actor, mustChangePassword: true }, { ...actor, entitlements: { financeiro: false } }]) {
      seams.services.mockResolvedValue({ gateway: { readIdentity: async () => denied } }); expect((await post(write(path))).status).toBe(denied === null ? 401 : 403);
    }
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => structuredClone(actor) } });
    expect((await post(write(path, undefined, GOAL_OTHER))).status).toBe(409);
    expect((await post(write(path, undefined, GOAL_OWNER, "https://foreign.invalid"))).status).toBe(403);
    seams.config.mockReturnValue({ mode: "demo" }); expect((await post(write(path))).status).toBe(503);
    expect(seams.terminal).not.toHaveBeenCalled();
  });
  it.each(routes)("$path refuses external envelopes, identity/digest fields, duplicates, queries, MIME and encoding before RPC", async ({ path, post }) => {
    const intent = channelGoalCreate(), body = JSON.stringify(intent);
    for (const text of [JSON.stringify({ ...intent, user_id: GOAL_OTHER }), JSON.stringify({ ...intent, input_digest: "0".repeat(64) }), JSON.stringify({ version: 2, command: intent.command, client_id: intent.input.client_id, canonical_input: "{}" }), '{"\\u0063ommand":"finance.goal.create",' + body.slice(1), body.replace('"input":{', '"input":{"\\u0063lient_id":"' + goalId(3) + '",'), body + " ".repeat(64 * 1024)]) expect((await post(write(path, text))).status).toBe(400);
    for (const type of ["text/plain", "application/json;charset=iso-8859-1"]) expect((await post(write(path, body, GOAL_OWNER, origin, type))).status).toBe(400);
    expect((await post(write(path, body, GOAL_OWNER, origin, "application/json", { "Content-Encoding": "gzip" }))).status).toBe(400);
    const query = new Request(origin + `/api/finance/goals/attempt/${path}?client_id=x`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": GOAL_OWNER }, body });
    expect((await post(query)).status).toBe(400); expect(seams.terminal).not.toHaveBeenCalled();
  });
  it.each(routes)("$path requires natural request EOF and never dispatches on timeout/abort", async ({ path, post }) => {
    vi.useFakeTimers();
    for (const interrupted of ["timeout", "abort"] as const) {
      const abort = new AbortController(), cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(channelGoalCreate()))); }, cancel });
      const request = new Request(origin + `/api/finance/goals/attempt/${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": GOAL_OWNER }, body, signal: abort.signal, duplex: "half" } as RequestInit & { duplex: "half" });
      const pending = post(request); await vi.advanceTimersByTimeAsync(0); if (interrupted === "abort") abort.abort(); else await vi.advanceTimersByTimeAsync(15_000);
      const response = await pending; expect(response.status).toBe(503); expect((await response.json()).code).toBe("unavailable"); expect(cancel).toHaveBeenCalledTimes(1); expect(body.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
    }
    expect(seams.terminal).not.toHaveBeenCalled();
  });
  it("preserves closed error vocabulary and never discloses private diagnostics or falls back after errors", async () => {
    for (const { path, post } of routes) {
      const method = path === "status" ? seams.status : seams.settle;
      method.mockRejectedValueOnce(new Error("PRIVATE_TERMINAL_SQL")); const unknown = await post(write(path));
      expect(unknown.status).toBe(503); const text = await unknown.text(); expect(text).not.toContain("PRIVATE_TERMINAL_SQL"); expect(JSON.parse(text).code).toBe(path === "settle" ? "uncertain" : "unavailable");
      method.mockRejectedValueOnce(new AuthGuardError("forbidden")); expect((await post(write(path))).status).toBe(403);
      method.mockRejectedValueOnce(new FinanceRateLimitError()); const limited = await post(write(path)); expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("60"); expect((await limited.json()).code).toBe("unavailable");
      method.mockRejectedValueOnce(new CommitOutcomeUnknown()); expect((await (await post(write(path))).json()).code).toBe("uncertain");
    }
    expect(seams.status).toHaveBeenCalledTimes(4); expect(seams.settle).toHaveBeenCalledTimes(4);
  });
});
