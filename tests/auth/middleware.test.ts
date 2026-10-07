import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";

const mocks = vi.hoisted(() => ({ create: vi.fn(), getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
import { updateSessionMiddleware } from "../../src/lib/auth/middleware-session";

function configure() {
  for (const [name, value] of Object.entries({ APP_MODE: "supabase", APP_URL: "https://app.example.invalid", SUPABASE_URL: "https://project.example.invalid", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example", SUPABASE_SECRET_KEY: "sb_secret_example", AUTH_RATE_LIMIT_SECRET: "r".repeat(32), AUTH_STATE_SECRET: "s".repeat(32), NODE_ENV: "production" })) vi.stubEnv(name, value);
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe("middleware request boundary with mocked SDK", () => {
  it("demo never constructs an SDK client", async () => {
    vi.stubEnv("APP_MODE", "demo");
    const request = new NextRequest("https://app.example.invalid/"); const headers = new Headers({ "x-nonce": "server-value" });
    const response = await updateSessionMiddleware(request, headers);
    expect(response.status).toBe(200); expect(mocks.create).not.toHaveBeenCalled(); expect(response.headers.get("x-middleware-request-x-nonce")).toBe("server-value");
  });
  it("malformed real mode is unavailable without contacting SDK", async () => {
    vi.stubEnv("APP_MODE", "supabase"); vi.stubEnv("SUPABASE_URL", "");
    const response = await updateSessionMiddleware(new NextRequest("https://app.example.invalid/"), new Headers());
    expect(response.status).toBe(503); expect(mocks.create).not.toHaveBeenCalled(); expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("keeps nonce/CSP, all cookie chunks/removals and refresh cache headers across setAll calls", async () => {
    configure(); let cookies: CookieMethodsServer;
    mocks.create.mockImplementation((_url, _key, options) => { cookies = options.cookies; return { auth: { getUser: mocks.getUser } }; });
    mocks.getUser.mockImplementation(async () => {
      await cookies.setAll?.([{ name: "sc-auth.0", value: "new-first", options: { httpOnly: false, secure: false, sameSite: "none", path: "/other" } }, { name: "sc-auth.2", value: "", options: { maxAge: 0 } }], { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache" });
      await cookies.setAll?.([{ name: "sc-auth.1", value: "new-second", options: {} }], {});
      return { data: { user: null }, error: null };
    });
    const request = new NextRequest("https://app.example.invalid/tarefas", { headers: { cookie: "sc-auth.2=stale", "x-nonce": "spoofed" } });
    const forwarded = new Headers(request.headers); forwarded.set("x-nonce", "trusted-nonce"); forwarded.set("Content-Security-Policy", "script-src 'nonce-trusted-nonce'");
    const response = await updateSessionMiddleware(request, forwarded);
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe("trusted-nonce");
    expect(response.headers.get("x-middleware-request-content-security-policy")).toContain("trusted-nonce");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("sc-auth.0=new-first");
    expect(response.cookies.get("sc-auth.0")).toMatchObject({ value: "new-first", httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(response.cookies.get("sc-auth.1")?.value).toBe("new-second"); expect(response.cookies.get("sc-auth.2")?.maxAge).toBe(0);
    expect(response.headers.get("Cache-Control")).toContain("no-store"); expect(response.headers.get("Expires")).toBe("0");
  });
  it("a thrown refresh error refuses private rendering and preserves cookie cleanup", async () => {
    configure(); mocks.create.mockImplementation((_url, _key, options) => ({ auth: { getUser: async () => { options.cookies.setAll([{ name: "sc-auth", value: "", options: { maxAge: 0 } }], {}); throw new Error("network/provider detail"); } } }));
    const response = await updateSessionMiddleware(new NextRequest("https://app.example.invalid/"), new Headers());
    expect(response.status).toBe(503); expect(response.cookies.get("sc-auth")?.maxAge).toBe(0); expect(await response.text()).not.toContain("network/provider detail");
  });
});
