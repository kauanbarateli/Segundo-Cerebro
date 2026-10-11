import { afterEach, describe, expect, it, vi } from "vitest";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
vi.mock("server-only", () => ({}));
import { ownSessionsForRequest } from "../../src/adapters/db/own-sessions-runtime";
const userId = "10000000-0000-4000-8000-000000000001", sid = "10000000-0000-4000-8000-000000000011";
const actor = { userId, sessionId: sid, mustChangePassword: false };
const payload = { sessions: [{ id: sid, is_current: true, created_at: null, refreshed_at: null, not_after: null }], has_more: false };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (exp: number) => encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ sub: userId, session_id: sid, exp, aud: "authenticated", role: "authenticated" }) + ".ZmFrZQ";
function fixture(exp = Math.floor(Date.now() / 1000) + 3600) {
  let secretReads = 0;
  const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://app.example.invalid", supabaseUrl: "https://project.example.invalid", publishableKey: "sb_publishable_synthetic", secretKey: "", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
  Object.defineProperty(config, "secretKey", { get() { secretReads++; throw new Error("PRIVATE_KEY_CANARY"); } });
  const access = token(exp), storage = new Map<string, string>([["sc-auth", "base64-" + encode({ access_token: access, refresh_token: "synthetic-refresh", token_type: "bearer", expires_at: exp, expires_in: 3600, user: { id: userId, aud: "authenticated" } })]]);
  const writes: { name: string; options: CookieOptions }[] = [];
  const jar = { getAll: () => [...storage].map(([name, value]) => ({ name, value })), set: (name: string, value: string, options: CookieOptions) => { storage.set(name, value); writes.push({ name, options }); } };
  return { config, access, jar, writes, secretReads: () => secretReads };
}
afterEach(() => vi.unstubAllGlobals());
describe("real installed publishable session SDK with RAM HTTP", () => {
  it("does not initialize even an expired-cookie SDK before identity and access guards", async () => {
    const f = fixture(Math.floor(Date.now() / 1000) - 3600), fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(() => ownSessionsForRequest(f.config, { ...actor, sessionId: "invalid" }, f.jar, new Headers())).toThrow();
    await expect(ownSessionsForRequest(f.config, { ...actor, mustChangePassword: true }, f.jar, new Headers()).read()).rejects.toMatchObject({ code: "forbidden" });
    await expect(ownSessionsForRequest(f.config, { ...actor, entitlements: { configuracoes: false } }, f.jar, new Headers()).read()).rejects.toMatchObject({ code: "forbidden" });
    expect(fetcher).not.toHaveBeenCalled(); expect(f.writes).toHaveLength(0); expect(f.secretReads()).toBe(0);
  });
  it("uses the cookie JWT and only the argument-free public RPC", async () => {
    const f = fixture(), calls: { url: string; headers: Headers; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => { calls.push({ url: String(input), headers: new Headers(init.headers), init }); return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } }); });
    const view = await ownSessionsForRequest(f.config, actor, f.jar, new Headers()).read();
    expect(calls).toHaveLength(1); expect(calls[0]?.url).toBe("https://project.example.invalid/rest/v1/rpc/my_sessions"); expect(calls[0]?.headers.get("apikey")).toBe(f.config.publishableKey); expect(calls[0]?.headers.get("authorization")).toBe("Bearer " + f.access); expect(calls[0]?.init.cache).toBe("no-store"); expect(JSON.parse(String(calls[0]?.init.body))).toEqual({}); expect(view.sessions[0]?.isCurrent).toBe(true); expect(f.secretReads()).toBe(0);
  });
  it("refresh updates the shared jar with secure cookies before the RPC", async () => {
    const f = fixture(Math.floor(Date.now() / 1000) - 3600), calls: string[] = [], headers = new Headers(), next = token(Math.floor(Date.now() / 1000) + 3600);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => { const url = String(input); calls.push(url); if (url.includes("/auth/v1/token")) return new Response(JSON.stringify({ access_token: next, refresh_token: "synthetic-next", token_type: "bearer", expires_in: 3600, user: { id: userId, aud: "authenticated" } }), { headers: { "content-type": "application/json" } }); return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } }); });
    await ownSessionsForRequest(f.config, actor, f.jar, headers).read();
    expect(calls.filter(url => url.includes("/auth/v1/token"))).toHaveLength(1); expect(calls.at(-1)).toContain("/rpc/my_sessions"); expect(f.writes.length).toBeGreaterThan(0);
    for (const write of f.writes) expect(write.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", domain: undefined });
    expect(headers.get("cache-control")).toContain("no-store"); expect(f.secretReads()).toBe(0);
  });
});
