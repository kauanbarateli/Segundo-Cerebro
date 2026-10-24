import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoalImageUploadTransport } from "../../src/lib/files/goal-image-upload-transport";
import type { GoalImageUploadMetadata } from "../../src/lib/files/goal-image-upload-contract";
import { LOCAL_STORAGE_ORIGIN } from "../../src/lib/files/storage-origin";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), upload = id(9), origin = "https://synthetic.invalid";
const metadata = (): GoalImageUploadMetadata => ({ version: 1, purpose: "finance_goal_image", scope: { ownerId: owner, epoch: id(2), editorKey: "synthetic", goalId: null, goalRevision: null, baselineFileId: null }, selection: { generation: 1, name: "synthetic.png", size: 1, mime: "image/png", sha256: "a".repeat(64) }, uploadClientId: id(3), uploadId: null, phase: "prepared" });
const signed = LOCAL_STORAGE_ORIGIN + `/storage/v1/object/upload/sign/second-brain-staging/${owner}/${upload}?token=synthetic-token`;
const reservation = () => ({ id: upload, upload_url: signed, token: "synthetic-token", expires_at: "2099-01-01T00:00:00Z" });
function reply(url: string, value: unknown, status = 200) { const response = Response.json(value, { status }); Object.defineProperty(response, "url", { value: url }); return response; }
afterEach(() => vi.useRealTimers());
describe("Goal-only upload transport — mocked Response/streams, no network", () => {
  it("reserves exact metadata and uses a single-use private Storage capability with omit/upsert:false", async () => {
    const calls: { url: string; init: RequestInit }[] = [], transport = createGoalImageUploadTransport(owner, LOCAL_STORAGE_ORIGIN, { origin, assertCurrent: () => undefined, fetcher: async (url, init) => { calls.push({ url, init }); return reply(url, init.method === "POST" ? reservation() : {}); } });
    const controller = new AbortController(), selected = metadata(), reserved = await transport.reserve(selected, null, controller.signal);
    expect(calls[0]).toMatchObject({ url: origin + "/api/files/uploads", init: { credentials: "same-origin", redirect: "error", headers: { "X-Expected-User-ID": owner } } });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ kind: "finance_goal_image", name: "synthetic.png", folder_id: null, client_id: id(3) });
    expect(JSON.stringify(reserved.capability)).toBe("{}"); expect(Object.values(reserved.capability)).toEqual([]);
    const retained = { ...selected, uploadId: upload, phase: "put-uncertain" as const }, file = new File([new Uint8Array([1])], "synthetic.png", { type: "image/png" });
    await transport.put(reserved.capability, retained, file, controller.signal); expect(calls[1]).toMatchObject({ url: signed, init: { method: "PUT", credentials: "omit", redirect: "error", headers: { "x-upsert": "false" } } });
    expect(calls[1]?.init.body).toBeInstanceOf(FormData); await expect(transport.put(reserved.capability, retained, file, controller.signal)).rejects.toMatchObject({ code: "INVALID" }); expect(calls).toHaveLength(2);
  });
  it.each(["redirect", "wrong-url", "mime", "duplicate", "oversize", "utf8", "extra", "known-id", "expired", "status"] as const)("refuses %s without leaking remote text/token into errors", async mode => {
    const fetcher = vi.fn(async (url: string) => {
      let response: Response;
      if (mode === "mime") response = new Response("PRIVATE_REMOTE_CANARY", { headers: { "Content-Type": "text/html" } });
      else if (mode === "duplicate") response = new Response('{"id":"' + id(99) + '",' + JSON.stringify(reservation()).slice(1), { headers: { "Content-Type": "application/json" } });
      else if (mode === "oversize") response = new Response(new Uint8Array(65537), { headers: { "Content-Type": "application/json" } });
      else if (mode === "utf8") response = new Response(new Uint8Array([0xff]), { headers: { "Content-Type": "application/json" } });
      else response = Response.json(mode === "extra" ? { ...reservation(), leaked: "PRIVATE_REMOTE_CANARY" } : mode === "expired" ? { ...reservation(), expires_at: "2000-01-01T00:00:00Z" } : reservation(), { status: mode === "status" ? 503 : 200 });
      Object.defineProperty(response, "url", { value: mode === "wrong-url" ? origin + "/foreign" : url }); if (mode === "redirect") Object.defineProperty(response, "redirected", { value: true }); return response;
    });
    const transport = createGoalImageUploadTransport(owner, LOCAL_STORAGE_ORIGIN, { origin, assertCurrent: () => undefined, fetcher });
    let error: unknown; try { await transport.reserve(metadata(), mode === "known-id" ? id(99) : null, new AbortController().signal); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error); expect(String(error)).not.toMatch(/PRIVATE_REMOTE_CANARY|synthetic-token|second-brain-staging/); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("observes only its original IDs and refuses final/DTO for another owner", async () => {
    const retained = { ...metadata(), uploadId: upload, phase: "put-uncertain" as const }, calls: string[] = [];
    const transport = createGoalImageUploadTransport(owner, LOCAL_STORAGE_ORIGIN, { origin, assertCurrent: () => undefined, fetcher: async url => { calls.push(url); return reply(url, { version: 1, user_id: id(99), upload_id: upload, purpose: "finance_goal_image", state: "missing-observed", file: null }); } });
    await expect(transport.observe(retained, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); const params = new URL(calls[0]!).searchParams;
    expect([...params.keys()]).toEqual(["version", "purpose", "upload", "client_id"]); expect(params.get("client_id")).toBe(id(3)); expect(calls[0]).not.toContain("synthetic.png");
  });
  it("a full JSON prefix without natural EOF times out and cancels, never returns reservation", async () => {
    vi.useFakeTimers(); let entered!: () => void; const started = new Promise<void>(done => { entered = done; }), cancelled = vi.fn();
    const transport = createGoalImageUploadTransport(owner, LOCAL_STORAGE_ORIGIN, { origin, assertCurrent: () => undefined, fetcher: async url => { entered(); const response = new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(reservation()))); }, cancel: cancelled }), { headers: { "Content-Type": "application/json" } }); Object.defineProperty(response, "url", { value: url }); return response; } });
    const pending = transport.reserve(metadata(), null, new AbortController().signal), refused = expect(pending).rejects.toMatchObject({ code: "UNAVAILABLE" }); await started; await vi.advanceTimersByTimeAsync(15001); await refused; expect(cancelled).toHaveBeenCalledTimes(1);
  });
  it("capabilities are bound to source/scope and cannot be fabricated or transferred to another transport", async () => {
    const fetcher = vi.fn(async (url: string) => reply(url, reservation())), options = { origin, assertCurrent: () => undefined, fetcher }, first = createGoalImageUploadTransport(owner, LOCAL_STORAGE_ORIGIN, options), second = createGoalImageUploadTransport(owner, LOCAL_STORAGE_ORIGIN, options), signal = new AbortController().signal;
    const reserved = await first.reserve(metadata(), null, signal), retained = { ...metadata(), uploadId: upload, phase: "put-uncertain" as const }, file = new File([new Uint8Array([1])], "synthetic.png", { type: "image/png" });
    await expect(second.put(reserved.capability, retained, file, signal)).rejects.toMatchObject({ code: "INVALID" });
    await expect(first.put(reserved.capability, { ...retained, selection: { ...retained.selection, sha256: "b".repeat(64) } }, file, signal)).rejects.toMatchObject({ code: "INVALID" });
    await expect(Reflect.apply(first.put, first, [{}, retained, file, signal])).rejects.toMatchObject({ code: "INVALID" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("external abort or stale identity never becomes an empty observation or another dispatch", async () => {
    const fetcher = vi.fn(async (url: string) => reply(url, reservation())), controller = new AbortController(); controller.abort();
    const transport = createGoalImageUploadTransport(owner, LOCAL_STORAGE_ORIGIN, { origin, assertCurrent: () => undefined, fetcher }); await expect(transport.reserve(metadata(), null, controller.signal)).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(fetcher).not.toHaveBeenCalled();
  });
});
