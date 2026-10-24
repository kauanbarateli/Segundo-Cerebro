import { afterEach, describe, expect, it, vi } from "vitest";
import { createSeriesClassificationClient } from "../../src/lib/finance-series-classification-client";
import { seriesId, SERIES_OWNER } from "../fixtures/finance-series";
const group = seriesId(4), json = (result: unknown) => Response.json({ ok: true, result });
const legacy = () => ({ version: 2, group_id: group, kind: "legacy" });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
afterEach(() => vi.useRealTimers());
describe("#78 — consulta de grupo GET fechada, sem fallback nem dispatch", () => {
  it("construção não busca; classificação positiva é vinculada ao grupo e dono esperado", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(legacy())), client = createSeriesClassificationClient(SERIES_OWNER, { fetcher, isCurrent: () => true }); expect(fetcher).not.toHaveBeenCalled(); expect(await client.read(group)).toEqual({ ok: true, result: legacy() });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/finance/series/classification?group_id=" + group, expect.objectContaining({ method: "GET", credentials: "same-origin", redirect: "error", cache: "no-store", headers: { "X-Expected-User-ID": SERIES_OWNER } })); expect(fetcher.mock.calls[0]![1]).not.toHaveProperty("body");
  });
  it("managed com flag falsa é managed, não legado", async () => { const result = { version: 2, group_id: group, kind: "managed", available: false }, client = createSeriesClassificationClient(SERIES_OWNER, { isCurrent: () => true, fetcher: vi.fn<typeof fetch>().mockResolvedValue(json(result)) }); expect(await client.read(group)).toEqual({ ok: true, result }); });
  it.each([[401, "UNAUTHENTICATED"], [403, "FORBIDDEN"], [404, "NOT_FOUND"], [503, "UNAVAILABLE"]] as const)("HTTP %s nunca confirma legado nem repete automaticamente", async (status, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: false, code, message: "synthetic-private-server-message" }, { status })), client = createSeriesClassificationClient(SERIES_OWNER, { fetcher, isCurrent: () => true }); const result = await client.read(group); expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("synthetic-private"); expect(fetcher).toHaveBeenCalledOnce();
  });
  for (const outcome of ["success", "error", "timeout"] as const) it(`owner/serviço antigo não publica ${outcome} tardio`, async () => {
    vi.useFakeTimers(); const waiting = deferred<Response>(), entered = deferred<void>(); let current = true;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { entered.resolve(); return waiting.promise; }), client = createSeriesClassificationClient(SERIES_OWNER, { fetcher, isCurrent: () => current, timeoutMs: 1000 });
    const reading = client.read(group); await entered.promise; current = false; client.dispose(); if (outcome === "success") waiting.resolve(json(legacy())); else if (outcome === "error") waiting.reject(new Error("synthetic-private-error")); else await vi.advanceTimersByTimeAsync(1100);
    expect(await reading).toMatchObject({ ok: false, code: "session-changed" }); expect(fetcher).toHaveBeenCalledOnce(); if (outcome === "timeout") waiting.resolve(json(legacy()));
  });
  it("dados extras, outro grupo, HTML, quota e redirect recusam a classificação", async () => {
    const redirect = json(legacy()); Object.defineProperty(redirect, "redirected", { value: true });
    const replies = [json({ ...legacy(), group_id: seriesId(9999) }), json({ ...legacy(), extra: true }), new Response("private-html", { headers: { "Content-Type": "text/html" } }), new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "4097" } }), redirect];
    for (const response of replies) { const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response), client = createSeriesClassificationClient(SERIES_OWNER, { fetcher, isCurrent: () => true }); expect(await client.read(group)).toMatchObject({ ok: false, code: "unavailable" }); expect(fetcher).toHaveBeenCalledOnce(); }
  });
});
