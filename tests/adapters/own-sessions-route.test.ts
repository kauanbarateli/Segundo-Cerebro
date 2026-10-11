import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnSessionsReadError } from "../../src/core/configuracoes/own-sessions";
import { AuthGuardError } from "../../src/lib/auth/types";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), cookies: vi.fn(), auth: vi.fn(), identity: vi.fn(), factory: vi.fn(), read: vi.fn(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: seams.cookies }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ createAuthServices: seams.auth }));
vi.mock("../../src/adapters/db/own-sessions-runtime", () => ({ ownSessionsForRequest: seams.factory }));
import { GET } from "../../src/app/api/settings/sessions/route";
const owner = "10000000-0000-4000-8000-000000000001", sid = "10000000-0000-4000-8000-000000000011", other = "10000000-0000-4000-8000-000000000002";
const origin = "https://app.example.invalid", url = origin + "/api/settings/sessions";
const actor = { userId: owner, sessionId: sid, mustChangePassword: false, entitlements: {} };
const view = { sessions: [{ isCurrent: true, createdAt: null, refreshedAt: null }], hasMore: false };
const canonicalHeaders: Record<string, string>[] = [{}, { Origin: origin, "Sec-Fetch-Site": "same-origin" }, { "Sec-Fetch-Site": "none" }];
const foreignHeaders: Record<string, string>[] = [{ Origin: "https://foreign.example.invalid" }, { Origin: "null" }, { "Sec-Fetch-Site": "cross-site" }, { "Sec-Fetch-Site": "same-site" }];
const request = (headers: Record<string, string> = {}, address = url) => new Request(address, { headers: { "X-Expected-User-ID": owner, ...headers } });
function privateHeaders(response: Response) {
  expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("cache-control")).toContain("private");
  expect(response.headers.get("pragma")).toBe("no-cache"); expect(response.headers.get("expires")).toBe("0");
  expect(response.headers.get("vary")).toBe("Cookie"); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}
beforeEach(() => {
  vi.resetAllMocks(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin });
  seams.cookies.mockResolvedValue({ getAll: () => [{ name: "synthetic-cookie", value: "synthetic-value" }], set: seams.set });
  seams.identity.mockResolvedValue(actor); seams.auth.mockReturnValue({ gateway: { readIdentity: seams.identity } });
  seams.read.mockResolvedValue(view); seams.factory.mockReturnValue({ read: seams.read });
});
describe("own-session HTTP boundary", () => {
  it("shares one writable cookie jar and headers across verified Auth and the reader", async () => {
    seams.auth.mockImplementation((_config, jar, writable, headers: Headers) => {
      expect(writable).toBe(true); expect(jar.getAll()).toEqual([{ name: "synthetic-cookie", value: "synthetic-value" }]);
      jar.set("synthetic-next", "synthetic-value", { httpOnly: true }); headers.set("Cache-Control", "public");
      return { gateway: { readIdentity: seams.identity } };
    });
    const response = await GET(request()); expect(response.status).toBe(200); expect(await response.json()).toEqual(view); privateHeaders(response);
    const auth = seams.auth.mock.calls[0], factory = seams.factory.mock.calls[0];
    expect(factory?.[0]).toBe(auth?.[0]); expect(factory?.[1]).toBe(actor); expect(factory?.[2]).toBe(auth?.[1]); expect(factory?.[3]).toBe(auth?.[3]);
    expect(seams.identity).toHaveBeenCalledOnce(); expect(seams.read).toHaveBeenCalledOnce(); expect(seams.set).toHaveBeenCalledWith("synthetic-next", "synthetic-value", { httpOnly: true });
  });
  it.each(canonicalHeaders)("accepts a canonical private GET %j", async headers => {
    expect((await GET(request(headers))).status).toBe(200);
  });
  it.each(["?other=1", "?", "#fragment", "/extra"])("refuses non-canonical URL %s before Auth", async suffix => {
    const response = await GET(request({}, url + suffix)); expect(response.status).toBe(400); privateHeaders(response); expect(seams.auth).not.toHaveBeenCalled();
  });
  it.each(foreignHeaders)("refuses foreign read %j before Auth", async headers => {
    const response = await GET(request(headers)); expect(response.status).toBe(403); privateHeaders(response); expect(seams.cookies).not.toHaveBeenCalled();
  });
  it("requires a valid expected owner and read-only method before Auth", async () => {
    for (const req of [new Request(url), request({ "X-Expected-User-ID": "invalid" }), new Request(url, { method: "POST", body: "synthetic", headers: { "X-Expected-User-ID": owner } })]) {
      const response = await GET(req); expect(response.status).toBe(400); privateHeaders(response);
    }
    expect(seams.cookies).not.toHaveBeenCalled(); expect(seams.factory).not.toHaveBeenCalled();
  });
  it.each(["demo", "invalid"])("does not construct Auth in mode %s", async mode => {
    seams.config.mockReturnValue({ mode, appOrigin: origin }); const response = await GET(request()); expect(response.status).toBe(503); privateHeaders(response); expect(seams.cookies).not.toHaveBeenCalled();
  });
  it.each([[null, 401], [{ ...actor, mustChangePassword: true }, 403], [{ ...actor, entitlements: { configuracoes: false } }, 403]])("denies identity %j", async (identity, status) => {
    seams.identity.mockResolvedValue(identity); const response = await GET(request()); expect(response.status).toBe(status); privateHeaders(response); expect(seams.factory).not.toHaveBeenCalled();
  });
  it("returns session-changed for a valid page owner different from verified Auth", async () => {
    const response = await GET(request({ "X-Expected-User-ID": other })); expect(response.status).toBe(409); expect((await response.json()).code).toBe("SESSION_CHANGED"); privateHeaders(response); expect(seams.factory).not.toHaveBeenCalled();
  });
  it.each([[new OwnSessionsReadError("SESSION_CHANGED"), 409, "SESSION_CHANGED"], [new AuthGuardError("forbidden"), 403, "FORBIDDEN"], [new OwnSessionsReadError("UNAVAILABLE"), 503, "UNAVAILABLE"]])("maps closed adapter outcomes", async (error, status, code) => {
    seams.read.mockRejectedValue(error); const response = await GET(request()); expect(response.status).toBe(status); expect((await response.json()).code).toBe(code); privateHeaders(response);
  });
  it("does not read or return arbitrary provider diagnostics", async () => {
    let inspected = 0; const error = Object.defineProperty({}, "message", { get() { inspected++; throw new Error("PRIVATE_DIAGNOSTIC"); } });
    seams.read.mockRejectedValue(error); const response = await GET(request()); expect(response.status).toBe(503); expect(await response.json()).toEqual({ ok: false, code: "UNAVAILABLE", message: "Não foi possível carregar suas sessões. Tente novamente." }); expect(inspected).toBe(0); privateHeaders(response);
  });
});
