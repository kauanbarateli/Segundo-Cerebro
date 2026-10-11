import { afterEach, describe, expect, it, vi } from "vitest";
import { createOwnSessionsReader } from "../../src/components/features/configuracoes/own-sessions-reader";
const owner = "10000000-0000-4000-8000-000000000001", other = "10000000-0000-4000-8000-000000000002";
const view = { sessions: [{ isCurrent: true, createdAt: null, refreshedAt: "2026-10-11T00:00:00Z" }], hasMore: false };
const unavailable = { ok: false, reason: "unavailable" }, changed = { ok: false, reason: "session-changed" };
const signal = () => new AbortController();
const json = (value: unknown = view, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json", ...headers } });
const fetchResponse = (response: Response) => vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => response);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
afterEach(() => vi.useRealTimers());
describe("bounded owner-scoped browser session read", () => {
  it("reads one fixed private GET and does not send session IDs", async () => {
    const fetcher = fetchResponse(json()), controller = signal(); const result = await createOwnSessionsReader(owner, fetcher)(controller.signal);
    expect(result).toEqual({ ok: true, snapshot: view }); expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("/api/settings/sessions", expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "X-Expected-User-ID": owner }, signal: expect.any(AbortSignal) }));
    expect(fetcher.mock.calls[0]?.[1].signal?.aborted).toBe(true); expect(controller.signal.aborted).toBe(false);
  });
  it("does not start transport for an aborted or malformed owner", async () => {
    const fetcher = vi.fn(async () => json()), controller = signal(); controller.abort();
    expect(await createOwnSessionsReader(owner, fetcher)(controller.signal)).toEqual(unavailable);
    expect(await createOwnSessionsReader("not-an-owner", fetcher)(signal().signal)).toEqual(unavailable); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([[401, changed], [409, changed], [201, unavailable], [204, unavailable], [400, unavailable], [403, unavailable], [503, unavailable]])("maps HTTP %s without opening its body", async (status, expected) => {
    let opened = 0; const response = new Response(null, { status }); Object.defineProperty(response, "body", { get() { opened++; throw new Error("PRIVATE_BODY"); } });
    const fetcher = fetchResponse(response), controller = signal();
    expect(await createOwnSessionsReader(owner, fetcher)(controller.signal)).toEqual(expected); expect(opened).toBe(0); expect(fetcher.mock.calls[0]?.[1].signal?.aborted).toBe(true); expect(controller.signal.aborted).toBe(false);
  });
  it.each(["text/html", "application/json; charset=latin1", "application/json; other=1", ""])("refuses MIME %s without opening the body", async contentType => {
    let opened = 0; const response = json(view, { "content-type": contentType }); Object.defineProperty(response, "body", { get() { opened++; throw new Error("PRIVATE_BODY"); } });
    const fetcher = fetchResponse(response), controller = signal();
    expect(await createOwnSessionsReader(owner, fetcher)(controller.signal)).toEqual(unavailable); expect(opened).toBe(0); expect(fetcher.mock.calls[0]?.[1].signal?.aborted).toBe(true); expect(controller.signal.aborted).toBe(false);
  });
  it.each(["65537", "-1", "foreign", "9007199254740992"])("refuses invalid announced length %s before reading", async length => {
    let opened = 0; const response = json(view, { "content-length": length }); Object.defineProperty(response, "body", { get() { opened++; throw new Error("PRIVATE_BODY"); } });
    const fetcher = fetchResponse(response), controller = signal();
    expect(await createOwnSessionsReader(owner, fetcher)(controller.signal)).toEqual(unavailable); expect(opened).toBe(0); expect(fetcher.mock.calls[0]?.[1].signal?.aborted).toBe(true); expect(controller.signal.aborted).toBe(false);
  });
  it("accepts exactly 64 KiB of JSON UTF-8 and rejects a larger unannounced stream", async () => {
    const body = JSON.stringify(view).padEnd(65536, " ");
    expect(await createOwnSessionsReader(owner, async () => new Response(body, { headers: { "content-type": "application/json; charset=UTF-8", "content-length": "65536" } }))(signal().signal)).toEqual({ ok: true, snapshot: view });
    let canceled = 0; const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(65537)); }, cancel() { canceled++; } });
    expect(await createOwnSessionsReader(owner, async () => new Response(stream, { headers: { "content-type": "application/json" } }))(signal().signal)).toEqual(unavailable); expect(canceled).toBe(1); expect(stream.locked).toBe(false);
  });
  it.each([new Uint8Array([255]), new TextEncoder().encode("{invalid")])("refuses invalid UTF-8 or JSON without exposing diagnostics", async bytes => {
    expect(await createOwnSessionsReader(owner, async () => new Response(bytes, { headers: { "content-type": "application/json" } }))(signal().signal)).toEqual(unavailable);
  });
  it.each([{ ...view, sessionId: "PRIVATE_SESSION" }, { sessions: [{ ...view.sessions[0], id: "PRIVATE_SESSION" }], hasMore: false }, { sessions: [], hasMore: false }, { ...view, hasMore: true }, { sessions: [{ isCurrent: true, createdAt: "invalid", refreshedAt: null }], hasMore: false }])("refuses a non-projected snapshot %j", async value => {
    expect(await createOwnSessionsReader(owner, async () => json(value))(signal().signal)).toEqual(unavailable);
  });
  it("keeps account reads independent and ignores a late aborted transport", async () => {
    const a = deferred<Response>(), requests: RequestInit[] = [], controller = signal();
    const first = createOwnSessionsReader(owner, async (_url, init) => { requests.push(init); return a.promise; })(controller.signal);
    controller.abort(); expect(await first).toEqual(unavailable); expect(requests[0]?.signal?.aborted).toBe(true);
    const secondFetch = vi.fn(async () => json({ sessions: [{ isCurrent: true, createdAt: null, refreshedAt: null }], hasMore: false }));
    expect((await createOwnSessionsReader(other, secondFetch)(signal().signal)).ok).toBe(true); expect(secondFetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ headers: { "X-Expected-User-ID": other } }));
    a.resolve(json()); await Promise.resolve(); expect(requests).toHaveLength(1);
  });
  it("bounds even a transport that ignores its abort signal to 20 seconds", async () => {
    vi.useFakeTimers(); const pending = deferred<Response>(), fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => pending.promise), controller = signal();
    const read = createOwnSessionsReader(owner, fetcher)(controller.signal); expect(fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(20_000); expect(await read).toEqual(unavailable); expect(vi.getTimerCount()).toBe(0);
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true); pending.resolve(json()); await Promise.resolve();
  });
  it("aborts and cancels a body already waiting for its next chunk at the deadline", async () => {
    vi.useFakeTimers(); const entered = deferred<void>(); let canceled = 0;
    const stream = new ReadableStream<Uint8Array>({ pull() { entered.resolve(); }, cancel() { canceled++; } });
    const read = createOwnSessionsReader(owner, async () => new Response(stream, { headers: { "content-type": "application/json" } }))(signal().signal);
    await entered.promise; await vi.advanceTimersByTimeAsync(20_000); expect(await read).toEqual(unavailable); await Promise.resolve();
    expect(canceled).toBe(1); expect(stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it("removes the owner's abort listener and timer after a completed read", async () => {
    vi.useFakeTimers(); const controller = signal(), add = vi.spyOn(controller.signal, "addEventListener"), remove = vi.spyOn(controller.signal, "removeEventListener");
    expect((await createOwnSessionsReader(owner, async () => json())(controller.signal)).ok).toBe(true);
    const listener = add.mock.calls.find(call => call[0] === "abort")?.[1]; expect(listener).toBeTypeOf("function"); expect(remove).toHaveBeenCalledWith("abort", listener); expect(vi.getTimerCount()).toBe(0);
  });
});
