import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), gateway: vi.fn(), page: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/activity-runtime", () => ({ activityGatewayForRequest: seams.gateway }));
import { GET } from "../../src/app/api/activity/route";
const id = "10000000-0000-4000-8000-000000000001", foreign = "10000000-0000-4000-8000-000000000002";
const origin = "http://127.0.0.1:3000";
const identity = { userId: id, sessionId: id, mustChangePassword: false, entitlements: {} };
const request = (query = "", headers: Record<string, string> = {}) => new Request(origin + "/api/activity" + query, { headers: { "X-Expected-User-ID": id, ...headers } });
beforeEach(() => {
  vi.resetAllMocks(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin });
  seams.services.mockResolvedValue({ gateway: { readIdentity: async () => identity } });
  seams.page.mockResolvedValue({ items: [], next_cursor: null }); seams.gateway.mockReturnValue({ page: seams.page });
});
describe("Activity HTTP read", () => {
  it("authenticates before instantiating privileged RPC and closes anonymous access", async () => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => null } });
    expect((await GET(request())).status).toBe(401); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("uses actor/session from Auth and returns private no-store projections", async () => {
    const response = await GET(request("?limit=3"));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(seams.gateway).toHaveBeenCalledWith(expect.anything(), identity);
    expect(seams.page).toHaveBeenCalledWith({ limit: 3, cursor: null });
    expect(await response.json()).toEqual({ items: [], next_cursor: null });
  });
  it.each<Record<string, string>>([{ Origin: "https://foreign.example.invalid" }, { "Sec-Fetch-Site": "cross-site" }])("rejects foreign origins before reading domain data", async headers => {
    expect((await GET(request("", headers))).status).toBe(403); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it.each(["?user_id=" + foreign, "?limit=51", "?before_id=" + id])("invalid query does not instantiate the privileged client %s", async query => {
    expect((await GET(request(query))).status).toBe(400); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("requires the expected owner and refuses a stale page from another account", async () => {
    expect((await GET(request("", { "X-Expected-User-ID": "" }))).status).toBe(400);
    expect((await GET(request("", { "X-Expected-User-ID": foreign }))).status).toBe(409);
    expect(seams.gateway).not.toHaveBeenCalled();
  });
  it.each([{ inicio: false }])("rejects Activity entitlement before privileged client creation", async entitlements => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...identity, entitlements }) } });
    expect((await GET(request())).status).toBe(403); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("does not contact Auth or domain services in demo", async () => {
    seams.config.mockReturnValue({ mode: "demo" });
    expect((await GET(request())).status).toBe(503); expect(seams.services).not.toHaveBeenCalled(); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("unexpected SQL errors never become empty data or raw diagnostics", async () => {
    seams.page.mockRejectedValue(new Error("SQL SECRET_CANARY"));
    const response = await GET(request()); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("SECRET_CANARY");
  });
});
