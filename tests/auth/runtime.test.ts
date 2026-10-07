import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getClaims: vi.fn(), rpc: vi.fn(), privilegedRpc: vi.fn(), create: vi.fn(), privileged: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("../../src/lib/auth/clients", () => ({
  createRequestClient: mocks.create,
  createPrivilegedClient: mocks.privileged,
}));
import { createAuthServices } from "../../src/lib/auth/runtime";
const userId = "10000000-0000-4000-8000-000000000001", sessionId = "10000000-0000-4000-8000-000000000011";
const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://app.example.invalid", supabaseUrl: "https://project.example.invalid", publishableKey: "sb_publishable_example", secretKey: "sb_secret_example", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
function services() { return createAuthServices(config, { getAll: () => [], set: vi.fn() }); }
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email: "person@example.invalid", is_anonymous: false } }, error: null });
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: userId, session_id: sessionId } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { user_id: userId, role: "user", must_change_password: false, entitlements: {} }, error: null });
  mocks.create.mockImplementation(() => ({ auth: { getUser: mocks.getUser, getClaims: mocks.getClaims }, rpc: mocks.rpc }));
  mocks.privileged.mockImplementation(() => ({ rpc: mocks.privilegedRpc }));
});
describe("server SDK gateway with all SDK calls mocked", () => {
  it("calls getUser, verified claims and current DB DTO in that order, without service client", async () => {
    const result = await services().gateway.readIdentity(); expect(result).toMatchObject({ userId, sessionId });
    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.getClaims.mock.invocationCallOrder[0]!);
    expect(mocks.getClaims.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]!);
    expect(mocks.rpc).toHaveBeenCalledWith("my_access_state"); expect(mocks.privileged).not.toHaveBeenCalled();
  });
  it("does not trust an anonymous or absent Auth user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId, is_anonymous: true } }, error: null });
    expect(await services().gateway.readIdentity()).toBeNull(); expect(mocks.getClaims).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("never uses local claims to replace a failed getUser network validation", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(services().gateway.readIdentity()).rejects.toThrow(); expect(mocks.getClaims).not.toHaveBeenCalled();
  });
  it("refuses inconsistent subject/session and cross-user access DTO", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "other", session_id: sessionId } }, error: null });
    await expect(services().gateway.readIdentity()).rejects.toThrow(); expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: userId, session_id: sessionId } }, error: null });
    mocks.rpc.mockResolvedValue({ data: { user_id: "other", role: "master", must_change_password: false, entitlements: {} }, error: null });
    await expect(services().gateway.readIdentity()).rejects.toThrow();
  });
  it("blocked/revoked DB session refuses identity even with a valid Auth user", async () => { mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } }); expect(await services().gateway.readIdentity()).toBeNull(); });
  it("preserves only minimum DTO for provisional password", async () => { mocks.rpc.mockResolvedValue({ data: { user_id: userId, must_change_password: true }, error: null }); expect(await services().gateway.readIdentity()).toEqual({ userId, sessionId, email: "person@example.invalid", mustChangePassword: true }); });
  it("limiter sends HMAC only and refuses malformed or failed RPC", async () => {
    mocks.privilegedRpc.mockResolvedValue({ data: { allowed: false, retry_after_ms: 1201 }, error: null });
    expect(await services().limit("login", "person@example.invalid")).toEqual({ allowed: false, retryAfterSeconds: 2 });
    expect(JSON.stringify(mocks.privilegedRpc.mock.calls)).not.toContain("person@example.invalid");
    expect(mocks.privilegedRpc.mock.calls[0]?.[1]).toMatchObject({ p_scope: "login", p_user: null, p_session: null });
    mocks.privilegedRpc.mockResolvedValue({ data: { allowed: true }, error: null }); await expect(services().limit("login", "person@example.invalid")).rejects.toThrow();
  });
  it("creates a distinct request client for each factory invocation", () => { services(); services(); expect(mocks.create).toHaveBeenCalledTimes(2); });
});
