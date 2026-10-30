import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const allowed = vi.hoisted(() => ({ origin: true, deployment: true }));
vi.mock("../../src/lib/auth/database-origin-server", () => ({ isTrustedHostedDatabaseOrigin: () => allowed.origin }));
vi.mock("../../src/lib/environment/application-destination", () => ({ authDeploymentAllowed: () => allowed.deployment }));
import { financeGoalsTerminalForRequest } from "../../src/adapters/db/finance-goals-terminal-runtime";
import { captureGoalTerminalAttempt, goalTerminalRpcRequest, type CapturedGoalTerminalAttempt } from "../../src/adapters/db/finance-goals-terminal-canonical";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import { FinanceRateLimitError } from "../../src/adapters/db/finance-gateway";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import { channelGoalCreate, GOAL_SESSION } from "../fixtures/finance-goals-channel";
import { financialGoal, goalId, GOAL_OTHER, GOAL_OWNER } from "../fixtures/finance-goals";

const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://app.example.test", supabaseUrl: "https://db.example.test", publishableKey: "synthetic-public", secretKey: "synthetic-server", rateLimitSecret: "synthetic-rate", stateSecret: "synthetic-state", secureCookies: true };
const actor = { userId: GOAL_OWNER, sessionId: GOAL_SESSION, role: "user" as const, mustChangePassword: false, entitlements: { financeiro: true } };
const token = () => captureGoalTerminalAttempt(GOAL_OWNER, channelGoalCreate());
const closed = (captured: CapturedGoalTerminalAttempt) => ({ version: 2, kind: "closed", binding: { ...captured.binding }, disposition: { ...captured.binding, id: goalId(888), closed_at: "2026-10-23T12:00:00.000Z" } });
const encoded = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const jsonStream = (body: ReadableStream<Uint8Array>) => new Response(body, { headers: { "Content-Type": "application/json" } });
beforeEach(() => { allowed.origin = true; allowed.deployment = true; vi.useFakeTimers(); vi.stubEnv("FINANCE_GOALS_V1_ENABLED", "false"); });
afterEach(() => { expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("terminal M2-S — exactly two server-only RPCs", () => {
  it("fixes actor/session/origin, disables redirects/cache and keeps status separate from settle with flag off", async () => {
    const captured = token(), response = closed(captured), fetcher = vi.fn<typeof fetch>(async () => Response.json(response));
    const terminal = financeGoalsTerminalForRequest(config, actor, fetcher);
    expect(await terminal.status(captured)).toEqual(response); expect(await terminal.settle(captured)).toEqual(response);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [index, operation] of ["status", "settle"].entries()) {
      const [url, init] = fetcher.mock.calls[index]!;
      expect(String(url)).toBe(`https://db.example.test/rest/v1/rpc/finance_goal_attempt_${operation}`);
      expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store" });
      expect(new Headers(init?.headers).get("User-Agent")).toBe("SegundoCerebro-FinanceGoalTerminal/2");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(JSON.parse(String(init?.body))).toEqual({ p_user: GOAL_OWNER, p_session: GOAL_SESSION, p_request: goalTerminalRpcRequest(captured) });
    }
  });
  it("refuses destination, deployment, mandatory password, feature, foreign or forged captures before transport", async () => {
    const fetcher = vi.fn<typeof fetch>(); allowed.origin = false;
    expect(() => financeGoalsTerminalForRequest(config, actor, fetcher)).toThrow(); allowed.origin = true; allowed.deployment = false;
    expect(() => financeGoalsTerminalForRequest(config, actor, fetcher)).toThrow(); allowed.deployment = true;
    expect(() => financeGoalsTerminalForRequest(config, { ...actor, mustChangePassword: true }, fetcher)).toThrow();
    expect(() => financeGoalsTerminalForRequest(config, { ...actor, entitlements: { financeiro: false } }, fetcher)).toThrow();
    const terminal = financeGoalsTerminalForRequest(config, actor, fetcher), captured = token();
    await expect(terminal.status({ binding: { ...captured.binding } })).rejects.toThrow();
    await expect(terminal.settle(captureGoalTerminalAttempt(GOAL_OTHER, channelGoalCreate()))).rejects.toMatchObject({ code: "forbidden" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves the nominal original across caller mutation and decodes financial result1 before accepting confirmed", async () => {
    const request = channelGoalCreate(), captured = captureGoalTerminalAttempt(GOAL_OWNER, request), original = structuredClone(request);
    request.input.client_id = goalId(555); request.input.target_cents = 1;
    const result = { version: 1, goal: financialGoal({ name: original.input.name, target_cents: original.input.target_cents, revision: "0" }) };
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ version: 2, kind: "confirmed", binding: captured.binding, result }));
    expect((await financeGoalsTerminalForRequest(config, actor, fetcher).status(captured)).kind).toBe("confirmed");
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).p_request.client_id).toBe(original.input.client_id);
  });
  it.each(["version", "owner", "digest", "client", "disposition", "result", "extra", "duplicate", "escaped_duplicate", "json", "utf8", "bom", "overflow", "mime", "redirect", "foreign_url", "204", "rpc_missing"] as const)
    ("refuses upstream %s as unavailable/read or uncertain/write, never caller validation or fallback", async scenario => {
      const captured = token();
      const fetcher = vi.fn<typeof fetch>(async () => {
        const value = closed(captured);
        if (scenario === "version") return Response.json({ ...value, version: 1 });
        if (scenario === "owner") return Response.json({ ...value, binding: { ...value.binding, user_id: GOAL_OTHER } });
        if (scenario === "digest") return Response.json({ ...value, binding: { ...value.binding, input_digest: "0".repeat(64) } });
        if (scenario === "client") return Response.json({ ...value, binding: { ...value.binding, client_id: goalId(333) } });
        if (scenario === "disposition") return Response.json({ ...value, disposition: { ...value.disposition, client_id: goalId(333) } });
        if (scenario === "result") return Response.json({ version: 2, kind: "confirmed", binding: value.binding, result: { version: 2 } });
        if (scenario === "extra") return Response.json({ ...value, private: "PRIVATE_TERMINAL_CANARY" });
        if (scenario === "rpc_missing") return Response.json({ code: "PGRST202", message: "PRIVATE_TERMINAL_SQL", details: null, hint: null }, { status: 404 });
        if (scenario === "204") return new Response(null, { status: 204 });
        if (scenario === "redirect") return Response.json(value, { status: 302, headers: { Location: "https://other.invalid" } });
        if (scenario === "foreign_url") { const response = Response.json(value); Object.defineProperty(response, "url", { value: "https://other.invalid" }); return response; }
        const text = JSON.stringify(value), body = scenario === "json" ? "PRIVATE_TERMINAL_CANARY" : scenario === "overflow" ? '"' + "x".repeat(512 * 1024) + '"' : scenario === "duplicate" ? '{"version":1,' + text.slice(1) : scenario === "escaped_duplicate" ? text.replace('"binding":{', '"binding":{"\\u0076ersion":1,') : text;
        return new Response(scenario === "utf8" ? new Uint8Array([0xff]) : scenario === "bom" ? new Uint8Array([0xef, 0xbb, 0xbf, ...encoded(value)]) : body, { headers: { "Content-Type": scenario === "mime" ? "text/plain" : "application/json" } });
      });
      const terminal = financeGoalsTerminalForRequest(config, actor, fetcher);
      await expect(terminal.status(captured)).rejects.toMatchObject({ code: "unavailable" });
      await expect(terminal.settle(captured)).rejects.toBeInstanceOf(CommitOutcomeUnknown);
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  it("maps only closed server codes; upstream validation/corruption never becomes an HTTP400 caller error", async () => {
    for (const [code, expected] of [["42501", "forbidden"], ["23505", "CONFLICT"], ["40001", "CONFLICT"], ["40P01", "CONFLICT"]] as const) {
      const fetcher = vi.fn<typeof fetch>(async () => Response.json({ code, message: "PRIVATE_SQL", details: null, hint: null }, { status: 500 }));
      await expect(financeGoalsTerminalForRequest(config, actor, fetcher).settle(token())).rejects.toMatchObject({ code: expected }); expect(fetcher).toHaveBeenCalledTimes(1);
    }
    const limited = vi.fn<typeof fetch>(async () => Response.json({ code: "PT429", message: "PRIVATE_SQL" }, { status: 429 }));
    await expect(financeGoalsTerminalForRequest(config, actor, limited).settle(token())).rejects.toBeInstanceOf(FinanceRateLimitError);
    for (const code of ["22023", "23514", "22P02", "22P05", "unknown"]) {
      const fetcher = vi.fn<typeof fetch>(async () => Response.json({ code, message: "PRIVATE_SQL" }, { status: 400 }));
      await expect(financeGoalsTerminalForRequest(config, actor, fetcher).status(token())).rejects.toMatchObject({ code: "unavailable" });
      await expect(financeGoalsTerminalForRequest(config, actor, fetcher).settle(token())).rejects.toBeInstanceOf(CommitOutcomeUnknown);
    }
  });
  it("requires natural EOF and one fixed deadline covering fetch plus body, cancelling without awaiting hostile cancel", async () => {
    for (const writing of [false, true]) {
      const captured = token(), cancel = vi.fn(() => new Promise<void>(() => undefined));
      const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoded(closed(captured))); }, cancel });
      const fetcher = vi.fn<typeof fetch>(async () => jsonStream(body)), terminal = financeGoalsTerminalForRequest(config, actor, fetcher);
      const pending = writing ? terminal.settle(captured) : terminal.status(captured), outcome = writing ? expect(pending).rejects.toBeInstanceOf(CommitOutcomeUnknown) : expect(pending).rejects.toMatchObject({ code: "unavailable" });
      await vi.advanceTimersByTimeAsync(14_999); expect(cancel).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1); await outcome; expect(cancel).toHaveBeenCalledTimes(1); expect(body.locked).toBe(false); expect(fetcher).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    }
  });
  it("times out a fetch that ignores abort, then cancels its late body without another request", async () => {
    let resolve!: (response: Response) => void; const captured = token(), fetcher = vi.fn<typeof fetch>(() => new Promise<Response>(done => { resolve = done; }));
    const pending = financeGoalsTerminalForRequest(config, actor, fetcher).settle(captured), rejected = expect(pending).rejects.toBeInstanceOf(CommitOutcomeUnknown);
    await vi.advanceTimersByTimeAsync(15_000); await rejected;
    const cancel = vi.fn(); resolve(jsonStream(new ReadableStream<Uint8Array>({ cancel }))); await vi.advanceTimersByTimeAsync(0);
    expect(cancel).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(true);
  });
  it("does not restart its fifteen-second budget when fetch resolves after ten seconds", async () => {
    let resolve!: (response: Response) => void; const captured = token(), cancel = vi.fn();
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>(done => { resolve = done; }));
    const pending = financeGoalsTerminalForRequest(config, actor, fetcher).status(captured), rejected = expect(pending).rejects.toMatchObject({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(10_000); resolve(jsonStream(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoded(closed(captured))); }, cancel })));
    await vi.advanceTimersByTimeAsync(4_999); expect(cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await rejected; expect(cancel).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("aborts before fetch or during read, never accepts chunks after cancellation", async () => {
    const pre = new AbortController(); pre.abort(); const untouched = vi.fn<typeof fetch>();
    await expect(financeGoalsTerminalForRequest(config, actor, untouched, pre.signal).status(token())).rejects.toMatchObject({ code: "unavailable" }); expect(untouched).not.toHaveBeenCalled();
    const abort = new AbortController(), cancel = vi.fn(), captured = token(); let stream!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; controller.enqueue(encoded(closed(captured))); }, cancel });
    const fetcher = vi.fn<typeof fetch>(async () => jsonStream(body)), pending = financeGoalsTerminalForRequest(config, actor, fetcher, abort.signal).settle(captured), rejected = expect(pending).rejects.toBeInstanceOf(CommitOutcomeUnknown);
    await vi.advanceTimersByTimeAsync(0); abort.abort(); await rejected; expect(cancel).toHaveBeenCalledTimes(1); expect(body.locked).toBe(false); expect(() => stream.enqueue(encoded(closed(captured)))).toThrow();
  });
  it("cancels and releases overflow/MIME bodies and sanitized read errors without waiting for cleanup", async () => {
    const captured = token();
    for (const mime of ["application/json", "text/plain"]) {
      const cancel = vi.fn(() => { throw new Error("PRIVATE_CANCEL"); });
      const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(512 * 1024 + 1)); }, cancel });
      const fetcher = vi.fn<typeof fetch>(async () => new Response(body, { headers: { "Content-Type": mime } }));
      await expect(financeGoalsTerminalForRequest(config, actor, fetcher).status(captured)).rejects.toMatchObject({ code: "unavailable" }); expect(cancel).toHaveBeenCalledTimes(1); expect(body.locked).toBe(false);
    }
    const fetcher = vi.fn<typeof fetch>(async () => { throw new Error("PRIVATE_NETWORK"); });
    await expect(financeGoalsTerminalForRequest(config, actor, fetcher).settle(captured)).rejects.toBeInstanceOf(CommitOutcomeUnknown); expect(fetcher).toHaveBeenCalledTimes(1);
    const errored = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error("PRIVATE_READ")); } });
    const readFailure = vi.fn<typeof fetch>(async () => jsonStream(errored));
    await expect(financeGoalsTerminalForRequest(config, actor, readFailure).settle(captured)).rejects.toBeInstanceOf(CommitOutcomeUnknown); expect(errored.locked).toBe(false); expect(readFailure).toHaveBeenCalledTimes(1);
  });
});
