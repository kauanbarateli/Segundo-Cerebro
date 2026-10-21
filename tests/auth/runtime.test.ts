import { beforeEach, describe, expect, it, vi } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getClaims: vi.fn(), rpc: vi.fn(), privilegedRpc: vi.fn(), create: vi.fn(), privileged: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("../../src/lib/auth/clients", () => ({
  createRequestClient: mocks.create,
  createPrivilegedClient: mocks.privileged,
}));
import { createAuthServices } from "../../src/lib/auth/runtime";
import { FLOW_COOKIE_NAMES } from "../../src/lib/auth/cookie-policy";
import { signFlow } from "../../src/lib/auth/flow-state";
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
    expect(mocks.privilegedRpc.mock.calls[0]?.[1]).toMatchObject({ p_scope: "login" });
    expect(mocks.privilegedRpc.mock.calls[0]?.[1]).not.toHaveProperty("p_user");
    expect(mocks.privilegedRpc.mock.calls[0]?.[1]).not.toHaveProperty("p_session");
    mocks.privilegedRpc.mockResolvedValue({ data: { allowed: true }, error: null }); await expect(services().limit("login", "person@example.invalid")).rejects.toThrow();
  });
  it.each([null, [], "allowed", true, { allowed: "true", retry_after_ms: 0 }, { allowed: true, retry_after_ms: "0" }, { allowed: true, retry_after_ms: -1 }, { allowed: true, retry_after_ms: Number.NaN }, { allowed: true, retry_after_ms: Number.POSITIVE_INFINITY }])("refuses invalid JSON limiter payload %# despite generated SDK types", async (data) => {
    mocks.privilegedRpc.mockResolvedValue({ data, error: null });
    await expect(services().limit("login", "person@example.invalid")).rejects.toMatchObject({ code: "unavailable" });
  });
  it("sends the verified actor/session for authenticated password limits", async () => {
    const identity = { userId, sessionId, mustChangePassword: false };
    mocks.privilegedRpc.mockResolvedValue({ data: { allowed: true, retry_after_ms: 0 }, error: null });
    expect(await services().limit("password", userId, identity)).toEqual({ allowed: true, retryAfterSeconds: 1 });
    expect(mocks.privilegedRpc).toHaveBeenCalledWith("consume_rate_limit", expect.objectContaining({ p_scope: "identity_write", p_user: userId, p_session: sessionId }));
  });
  it("creates a distinct request client for each factory invocation", () => { services(); services(); expect(mocks.create).toHaveBeenCalledTimes(2); });
});

describe("flow-cookie removal against the current request jar", () => {
  const kinds = ["recovery-request", "recovery-session", "password-updated"] as const;
  it("does not write expiry for absent exact names or touch similarly named foreign cookies", () => {
    const values = [{ name: "foreign", value: "kept" }, { name: "sc-flow-recovery-extra", value: "kept" }, { name: "prefix-sc-flow-password", value: "kept" }];
    const set = vi.fn(), getAll = vi.fn(() => values), auth = createAuthServices(config, { getAll, set });
    for (const kind of kinds) auth.flows.clear(kind);
    expect(getAll).toHaveBeenCalledTimes(kinds.length); expect(set).not.toHaveBeenCalled(); expect(values.every(cookie => cookie.value === "kept")).toBe(true);
  });
  it.each(kinds)("expires a present %s cookie even when its value is empty or invalid", kind => {
    for (const value of ["", "invalid-signed-flow"]) {
      const name = FLOW_COOKIE_NAMES[kind], set = vi.fn(), auth = createAuthServices(config, { getAll: () => [{ name, value }, { name: "foreign", value: "kept" }], set });
      auth.flows.clear(kind); expect(set).toHaveBeenCalledExactlyOnceWith(name, "", { maxAge: 0, domain: undefined, httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    }
  });
  it("expires an expired signed flow without requiring a valid flow payload", () => {
    const value = signFlow({ kind: "recovery-session", userId, sessionId, expiresAt: Date.now() - 1000 }, config.stateSecret), set = vi.fn();
    const auth = createAuthServices(config, { getAll: () => [{ name: FLOW_COOKIE_NAMES["recovery-session"], value }], set });
    expect(auth.flows.get("recovery-session")).toBeNull(); auth.flows.clear("recovery-session"); expect(set).toHaveBeenCalledOnce(); expect(set.mock.calls[0]?.slice(0, 2)).toEqual([FLOW_COOKIE_NAMES["recovery-session"], ""]);
  });
  it("checks only cookie names when clearing, without reading a present cookie value", () => {
    let reads = 0; const cookie = { name: FLOW_COOKIE_NAMES["recovery-session"], get value(): string { reads++; throw new Error("value must not be read"); } }, set = vi.fn();
    createAuthServices(config, { getAll: () => [cookie], set }).flows.clear("recovery-session"); expect(reads).toBe(0); expect(set).toHaveBeenCalledOnce();
  });
  it("observes a flow put into the same current jar before clearing it", () => {
    const values = new Map<string, string>(), set = vi.fn((name: string, value: string) => { values.set(name, value); });
    const auth = createAuthServices(config, { getAll: () => [...values].map(([name, value]) => ({ name, value })), set });
    auth.flows.put({ kind: "recovery-session", userId, sessionId, expiresAt: Date.now() + 60_000 }); auth.flows.clear("recovery-session");
    expect(set).toHaveBeenCalledTimes(2); expect(values.get(FLOW_COOKIE_NAMES["recovery-session"])).toBe(""); expect(set.mock.calls[1]).toEqual([FLOW_COOKIE_NAMES["recovery-session"], "", { maxAge: 0, domain: undefined, httpOnly: true, secure: true, sameSite: "lax", path: "/" }]);
  });
  it("refuses a readonly clear before even reading the request jar", () => {
    const getAll = vi.fn(() => { throw new Error("readonly must not read"); }), set = vi.fn(), auth = createAuthServices(config, { getAll, set }, false);
    for (const kind of kinds) expect(() => auth.flows.clear(kind)).toThrowError(expect.objectContaining({ code: "unavailable" }));
    expect(getAll).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled();
  });
  it("preserves a current-jar read failure without attempting an expiry write", () => {
    const failure = new Error("synthetic jar failure"), set = vi.fn(), auth = createAuthServices(config, { getAll: () => { throw failure; }, set });
    expect(() => auth.flows.clear("recovery-session")).toThrow(failure); expect(set).not.toHaveBeenCalled();
  });
  it("keeps full session-cookie cleanup for Auth chunks, verifier and flows while preserving foreign cookies", () => {
    const names = ["sc-auth", "sc-auth.0", "sc-auth-code-verifier", ...Object.values(FLOW_COOKIE_NAMES)], set = vi.fn();
    const auth = createAuthServices(config, { getAll: () => [...names, "foreign"].map(name => ({ name, value: "synthetic" })), set }); auth.flows.clearSessionCookies();
    expect(set.mock.calls.map(call => call[0])).toEqual(names); expect(set.mock.calls.every(call => call[1] === "" && call[2]?.maxAge === 0)).toBe(true);
  });
  it("avoids Next mutable-cookie revalidation for an absent flow while preserving it for an actual expiry", async () => {
    // Native Next cookie/store internals in RAM; all Supabase clients remain
    // mocked. This proves revalidation behavior, not the cause of a browser abort.
    const previous = Object.getOwnPropertyDescriptor(globalThis, "AsyncLocalStorage");
    Object.defineProperty(globalThis, "AsyncLocalStorage", { value: AsyncLocalStorage, configurable: true, writable: true });
    try {
      const [{ RequestCookies }, { MutableRequestCookiesAdapter, getModifiedCookieValues }, { workAsyncStorage }, { createWorkStore }] = await Promise.all([
        import("next/dist/server/web/spec-extension/cookies.js"),
        import("next/dist/server/web/spec-extension/adapters/request-cookies.js"),
        import("next/dist/server/app-render/work-async-storage.external.js"),
        import("next/dist/server/async-storage/work-store.js"),
      ]);
      for (const mode of ["absent", "present", "unconditional-control"] as const) {
        const store = createWorkStore({ page: "/entrar/page", buildId: "synthetic-cookie-test", previouslyRevalidatedTags: [], renderOpts: {
          supportsDynamicResponse: true, experimental: { isRoutePPREnabled: false, cacheComponents: false, authInterrupts: false }, waitUntil: undefined, onClose: () => {}, onAfterTaskError: undefined,
        } }); store.pathWasRevalidated = false;
        workAsyncStorage.run(store, () => {
          const updates = vi.fn(), mutable = MutableRequestCookiesAdapter.wrap(new RequestCookies(new Headers({ cookie: mode === "present" ? "foreign=kept; sc-flow-recovery=invalid" : "foreign=kept; sc-flow-recovery-extra=kept" })), updates);
          const auth = createAuthServices(config, { getAll: () => mutable.getAll(), set: (name, value, options) => { mutable.set(name, value, options); } });
          if (mode === "unconditional-control") mutable.set(FLOW_COOKIE_NAMES["recovery-session"], "", { maxAge: 0, path: "/" });
          else auth.flows.clear("recovery-session");
          const changed = mode !== "absent"; expect(store.pathWasRevalidated).toBe(changed); expect(getModifiedCookieValues(mutable)).toHaveLength(changed ? 1 : 0); expect(updates).toHaveBeenCalledTimes(changed ? 1 : 0); expect(mutable.get("foreign")?.value).toBe("kept");
        });
      }
    } finally {
      if (previous) Object.defineProperty(globalThis, "AsyncLocalStorage", previous); else Reflect.deleteProperty(globalThis, "AsyncLocalStorage");
    }
  });
});
