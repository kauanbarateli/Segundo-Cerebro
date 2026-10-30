import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: vi.fn() }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: vi.fn() }));
import { goalHttpBound, goalHttpCommand, goalHttpFailure, goalHttpHeaders, goalHttpNoQuery, goalHttpQuery, goalHttpRead } from "../../src/adapters/db/finance-goals-http";
import { FinanceRateLimitError } from "../../src/adapters/db/finance-gateway";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import { channelGoalCreate } from "../fixtures/finance-goals-channel";
import { goalId } from "../fixtures/finance-goals";
const origin = "https://app.example.test", raw = (text: string) => new Request(origin + "/api/finance/goals", { method: "POST", body: text });
const streamRaw = (body: ReadableStream<Uint8Array>, signal?: AbortSignal) => new Request(origin + "/api/finance/goals", { method: "POST", body, signal, duplex: "half" } as RequestInit & { duplex: "half" });
beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("UNEXPECTED_HTTP"); })));
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Goals HTTP — closed public grammar and bounded JSON", () => {
  it("requires an explicit view and preserves microsecond history cursors", () => {
    expect(goalHttpQuery(new Request(origin + "/?view=page"))).toEqual({ view: "page", query: { cursor: null, limit: 20, archived: "active" } });
    expect(goalHttpQuery(new Request(origin + "/?view=page&cursor=" + goalId(1) + "&limit=50&archived=all"))).toEqual({ view: "page", query: { cursor: goalId(1), limit: 50, archived: "all" } });
    expect(goalHttpQuery(new Request(origin + "/?view=detail&id=" + goalId(2)))).toEqual({ view: "detail", id: goalId(2) });
    const stamp = "2026-10-23T12:00:00.123456Z";
    for (const view of ["reservations", "releases"]) expect(goalHttpQuery(new Request(origin + "/?view=" + view + "&id=" + goalId(2) + "&cursor_at=" + stamp + "&cursor_id=" + goalId(3)))).toEqual({ view, query: { id: goalId(2), limit: 20, cursor: { created_at: stamp, id: goalId(3) } } });
  });
  it.each(["", "?view=other", "?view=page&view=page", "?view=page&%76iew=page", "?view=page&owner=x", "?view=page&cursor=", "?view=page&archived=", "?view=page&limit=0", "?view=page&limit=51", "?view=page&limit=01", "?view=page&limit=1e1", "?view=detail", "?view=detail&id=x", "?view=detail&id=" + goalId(1) + "&limit=1", "?view=reservations&id=" + goalId(1) + "&cursor_id=" + goalId(2), "?view=releases&id=" + goalId(1) + "&cursor_at=invalid&cursor_id=" + goalId(2)])("refuses ambiguous or unexpected query %s", search => expect(() => goalHttpQuery(new Request(origin + "/" + search))).toThrow());
  it("POST query parameters are never silently ignored", () => { expect(() => goalHttpNoQuery(new Request(origin + "/?view=page"))).toThrow(); expect(() => goalHttpNoQuery(new Request(origin))).not.toThrow(); });
  it("accepts native JSON escaping without reinterpreting strings or whitespace", async () => {
    const command = channelGoalCreate(); command.input.name = 'Meta { [ \\ " ç';
    expect(await goalHttpCommand(raw(JSON.stringify(command)))).toEqual(command);
    const escaped = JSON.stringify(command).replace('"command":', '"\\u0063ommand":');
    expect(await goalHttpCommand(raw(escaped))).toEqual(command);
    const serialized = JSON.stringify(command);
    const padded = serialized + " ".repeat(64 * 1024 - new TextEncoder().encode(serialized).byteLength);
    expect(new TextEncoder().encode(padded).byteLength).toBe(64 * 1024);
    expect(await goalHttpCommand(raw(padded))).toEqual(command);
    await expect(goalHttpCommand(raw(padded + " "))).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("rejects duplicate decoded keys at the root, input and patch", async () => {
    const body = JSON.stringify(channelGoalCreate());
    for (const prefix of ['"command":"finance.goal.create",', '"\\u0063ommand":"finance.goal.create",']) await expect(goalHttpCommand(raw("{" + prefix + body.slice(1)))).rejects.toThrow();
    for (const prefix of ['"client_id":"' + goalId(7) + '",', '"\\u0063lient_id":"' + goalId(7) + '",']) await expect(goalHttpCommand(raw(body.replace('"input":{', '"input":{' + prefix)))).rejects.toThrow();
    const update = { command: "finance.goal.update", input: { client_id: goalId(9), expected_finance_revision: "0", goal_id: goalId(5), expected_revision: "0", patch: { name: "A" } } };
    await expect(goalHttpCommand(raw(JSON.stringify(update).replace('"patch":{', '"patch":{"\\u006eame":"B",')))).rejects.toThrow();
  });
  it.each(["", " ", "null", "[]", "{", '{"command":NaN}', '{"x":' + "[".repeat(5) + "0" + "]".repeat(5) + "}", JSON.stringify(Object.fromEntries(Array.from({ length: 33 }, (_, index) => ["k" + index, 0])))])("refuses malformed or non-command input", async text => { await expect(goalHttpCommand(raw(text))).rejects.toThrow(); });
  it("rejects invalid UTF8, BOM and actual bytes above the limit despite Content-Length", async () => {
    for (const body of [new Uint8Array([0xff]), new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(JSON.stringify(channelGoalCreate()))])]) await expect(goalHttpCommand(new Request(origin, { method: "POST", body }))).rejects.toThrow();
    const response = new Request(origin, { method: "POST", headers: { "Content-Length": "1" }, body: JSON.stringify(channelGoalCreate()) + " ".repeat(64 * 1024) });
    await expect(goalHttpCommand(response)).rejects.toThrow();
  });
  it("never parses a complete JSON value without natural EOF, then cancels at the fixed deadline", async () => {
    vi.useFakeTimers();
    let controller!: ReadableStreamDefaultController<Uint8Array>; const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(value) { controller = value; value.enqueue(new TextEncoder().encode(JSON.stringify(channelGoalCreate()))); }, cancel });
    let settled = false; const pending = goalHttpCommand(streamRaw(body));
    void pending.then(() => { settled = true; }, () => { settled = true; });
    const rejected = expect(pending).rejects.toMatchObject({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(14_999); expect(settled).toBe(false); expect(cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await rejected;
    expect(cancel).toHaveBeenCalledTimes(1); expect(body.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
    expect(() => controller.enqueue(new TextEncoder().encode(" "))).toThrow();
  });
  it("refuses an already aborted request before opening a reader", async () => {
    vi.useFakeTimers(); const abort = new AbortController(), cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel }); abort.abort();
    await expect(goalHttpCommand(streamRaw(body, abort.signal))).rejects.toMatchObject({ code: "unavailable" });
    expect(body.locked).toBe(false); expect(cancel).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("aborts a pending read and does not accept later chunks", async () => {
    vi.useFakeTimers(); const abort = new AbortController(), cancel = vi.fn(); let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(value) { controller = value; value.enqueue(new TextEncoder().encode('{"command":')); }, cancel });
    const pending = goalHttpCommand(streamRaw(body, abort.signal)), rejected = expect(pending).rejects.toMatchObject({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(0); abort.abort(); await rejected;
    expect(cancel).toHaveBeenCalledTimes(1); expect(body.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
    expect(() => controller.enqueue(new TextEncoder().encode(JSON.stringify(channelGoalCreate())))).toThrow();
  });
  it("does not extend the deadline to await an underlying cancel that never settles", async () => {
    vi.useFakeTimers(); const cancel = vi.fn(() => new Promise<void>(() => undefined));
    const body = new ReadableStream<Uint8Array>({ cancel });
    const pending = goalHttpCommand(streamRaw(body)), rejected = expect(pending).rejects.toMatchObject({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(15_000); await rejected;
    expect(cancel).toHaveBeenCalledTimes(1); expect(body.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans a reader on stream errors or failing cancellation without leaking error text to a response", async () => {
    vi.useFakeTimers(); let controller!: ReadableStreamDefaultController<Uint8Array>;
    const errored = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
    const failed = goalHttpCommand(streamRaw(errored)).then(
      () => { throw new Error("An errored stream must not decode a command"); },
      error => goalHttpFailure(error, goalHttpHeaders()),
    );
    controller.error(new Error("PRIVATE_STREAM_CANARY")); const response = await failed;
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("PRIVATE_STREAM_CANARY"); expect(errored.locked).toBe(false);
    const cancel = vi.fn(() => { throw new Error("PRIVATE_CANCEL_CANARY"); });
    const over = new ReadableStream<Uint8Array>({ start(value) { value.enqueue(new Uint8Array(64 * 1024 + 1)); }, cancel });
    await expect(goalHttpCommand(streamRaw(over))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(cancel).toHaveBeenCalledTimes(1); expect(over.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it("binds only the decoded command and caps inner DTOs without truncation", async () => {
    const intent = channelGoalCreate(), headers = goalHttpHeaders();
    expect(await goalHttpBound(intent, { value: 1 }, headers).json()).toEqual({ ok: true, binding: { version: 1, command: intent.command, client_id: intent.input.client_id }, result: { value: 1 } });
    expect(() => goalHttpRead("x".repeat(512 * 1024), headers)).toThrow();
    expect(headers.get("cache-control")).toContain("no-store"); expect(headers.get("vary")).toBe("Cookie"); expect(headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("keeps failure codes closed and does not echo transport or SQL text", async () => {
    const headers = goalHttpHeaders(), limited = goalHttpFailure(new FinanceRateLimitError(), headers);
    expect(limited.status).toBe(429); expect((await limited.json()).code).toBe("unavailable"); expect(limited.headers.get("retry-after")).toBe("60");
    expect((await goalHttpFailure(new CommitOutcomeUnknown(), goalHttpHeaders()).json()).code).toBe("uncertain");
    const unknown = goalHttpFailure(new Error("PRIVATE_GOAL_CANARY_SQL"), goalHttpHeaders(), true); expect(unknown.status).toBe(503); expect(await unknown.text()).not.toContain("PRIVATE_GOAL_CANARY_SQL");
  });
});
