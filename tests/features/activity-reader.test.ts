import { afterEach, describe, expect, it, vi } from "vitest";
import { createActivityReader, readActivityPage } from "../../src/components/features/atividade/activity-reader";
const id = "10000000-0000-4000-8000-000000000001";
const row = { id, occurred_at: "2026-10-07T20:00:00.000002Z", entity_type: "capture", entity_id: id, action: "updated", canal: "web", title: "Nota", changed_fields: ["content"] };
const data = { items: [row], next_cursor: null };
const ok = () => Response.json(data);
afterEach(() => vi.useRealTimers());
describe("Activity session reader", () => {
  it("GET carries expected user and refuses redirects without credentials in URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok()); const reader = createActivityReader(id, fetcher);
    expect(fetcher).not.toHaveBeenCalled(); await reader.refresh();
    expect(fetcher).toHaveBeenCalledWith("/api/activity?limit=20", expect.objectContaining({ method: "GET", cache: "no-store", credentials: "same-origin", redirect: "error", headers: { "X-Expected-User-ID": id } }));
  });
  it("503 refresh failure preserves the visible page and retry recovers", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(new Response("SQL_SECRET", { status: 503 })).mockResolvedValueOnce(ok());
    const reader = createActivityReader(id, fetcher); await reader.refresh(); await reader.refresh();
    expect(reader.getSnapshot()).toMatchObject({ status: "error", data, closed: false });
    expect(reader.getSnapshot().error).not.toContain("SECRET");
    await reader.retry(); expect(reader.getSnapshot().status).toBe("ready");
  });
  it.each([[401, "login"], [403, "reload"], [409, "reload"]])("%s clears data and stops further reads with recovery %s", async (status, recovery) => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(new Response(null, { status: Number(status) }));
    const reader = createActivityReader(id, fetcher); await reader.refresh(); await reader.refresh();
    expect(reader.getSnapshot()).toMatchObject({ status: "error", data: null, closed: true, recovery });
    await reader.retry(); await reader.refresh(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("malformed DTO clears untrusted data but permits a clean retry", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ...data, before: "secret" })).mockResolvedValueOnce(ok());
    const reader = createActivityReader(id, fetcher); await reader.refresh();
    expect(reader.getSnapshot()).toMatchObject({ status: "error", data: null, closed: false });
    await reader.retry(); expect(reader.getSnapshot().status).toBe("ready");
  });
  it("timeout settles even when the transport ignores abort", async () => {
    vi.useFakeTimers(); const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
    const reader = createActivityReader(id, fetcher); const loading = reader.refresh();
    await vi.advanceTimersByTimeAsync(20_000); await loading;
    expect(reader.getSnapshot()).toMatchObject({ status: "error", data: null, closed: false });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("logout aborts the pending request and ignores late response data", async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    const reader = createActivityReader(id, fetcher); const loading = reader.refresh(); reader.close();
    await loading; finish(ok()); await Promise.resolve();
    expect(reader.getSnapshot()).toMatchObject({ data: null, closed: true, recovery: "login" });
  });
  it("newer refresh wins over a stale request and clears timeout resources", async () => {
    vi.useFakeTimers(); let finish!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; })).mockResolvedValueOnce(ok());
    const reader = createActivityReader(id, fetcher); const first = reader.refresh(); await reader.refresh(); await first; finish(Response.json({ items: [], next_cursor: null }));
    expect(reader.getSnapshot().data).toEqual(data); expect(vi.getTimerCount()).toBe(0);
  });
  it("pagination preserves exact microsecond cursor and returns to recent page", async () => {
    const items = Array.from({ length: 20 }, (_, index) => ({ ...row, id: `10000000-0000-4000-8000-${String(30 - index).padStart(12, "0")}` }));
    const next_cursor = { id: items[19]!.id, occurred_at: row.occurred_at };
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ items, next_cursor })).mockResolvedValueOnce(Response.json({ items: [{ ...row, occurred_at: "2026-10-07T20:00:00.000001Z" }], next_cursor: null })).mockResolvedValueOnce(Response.json({ items, next_cursor }));
    const reader = createActivityReader(id, fetcher); await reader.refresh(); await reader.next();
    expect(reader.getSnapshot()).toMatchObject({ page: 2, canGoBack: true });
    expect(fetcher.mock.calls[1]?.[0]).toContain("20%3A00%3A00.000002Z");
    await reader.previous(); expect(reader.getSnapshot()).toMatchObject({ page: 1, canGoBack: false });
  });
  it("aborted reads also bound a body reader that never resolves", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => undefined) });
    const call = readActivityPage(fetcher, id, { limit: 20, cursor: null }, new AbortController().signal);
    const assertion = expect(call).rejects.toThrow("interrompida");
    await vi.advanceTimersByTimeAsync(20_000); await assertion;
  });
});
