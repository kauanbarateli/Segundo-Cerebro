import { describe, expect, it } from "vitest";
import { getAppMode, readAuthConfiguration } from "../../src/lib/auth/config";
import { assertFeature, parseAccessState, safeReturnTo, sameOrigin, validNewPassword } from "../../src/lib/auth/policy";
import { isOwnedAuthCookie, secureCookieOptions } from "../../src/lib/auth/cookie-policy";
import { signFlow, subjectHash, verifyFlow } from "../../src/lib/auth/flow-state";

const env = { APP_MODE: "supabase", APP_URL: "https://app.example.invalid", SUPABASE_URL: "https://project.example.invalid", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example", SUPABASE_SECRET_KEY: "sb_secret_example", AUTH_RATE_LIMIT_SECRET: "r".repeat(32), AUTH_STATE_SECRET: "s".repeat(32), NODE_ENV: "production" };
describe("auth configuration fails closed", () => {
  it("defaults to demo without requiring or consuming credentials", () => { expect(getAppMode({})).toBe("demo"); expect(readAuthConfiguration({ SUPABASE_SECRET_KEY: "not-used" })).toEqual({ mode: "demo" }); });
  it("never treats an explicit malformed real mode as demo", () => { expect(() => getAppMode({ APP_MODE: "anything" })).toThrow(); expect(() => readAuthConfiguration({ APP_MODE: "supabase" })).toThrow(); });
  it("requires server-only new key formats and independent secrets", () => {
    expect(readAuthConfiguration(env)).toMatchObject({ mode: "supabase", secureCookies: true });
    for (const key of ["APP_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "AUTH_RATE_LIMIT_SECRET", "AUTH_STATE_SECRET"]) expect(() => readAuthConfiguration({ ...env, [key]: "" })).toThrow();
    expect(() => readAuthConfiguration({ ...env, AUTH_STATE_SECRET: env.AUTH_RATE_LIMIT_SECRET })).toThrow();
    expect(() => readAuthConfiguration({ ...env, SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_SECRET_KEY })).toThrow();
  });
  it.each(["http://app.example.invalid", "https://user:pass@app.example.invalid", "https://app.example.invalid/path", "https://app.example.invalid?token=x", "javascript:alert(1)"])("refuses unsafe origin %s", (APP_URL) => { expect(() => readAuthConfiguration({ ...env, APP_URL })).toThrow(); });
  it("permits http only for local development", () => { expect(readAuthConfiguration({ ...env, NODE_ENV: "development", APP_URL: "http://localhost:3000" })).toMatchObject({ secureCookies: false }); expect(() => readAuthConfiguration({ ...env, APP_URL: "http://localhost:3000" })).toThrow(); });
});
describe("auth boundary policy", () => {
  it.each(["//evil.test", "https://evil.test", "/\\evil.test", "/%2f%2fevil.test", "/%5cevil.test", "/auth/callback?code=secret", "/entrar", "/api/private", "/x\r\nLocation:bad", "/%xx"])("rejects return destination %s", (path) => { expect(safeReturnTo(path)).toBe("/"); });
  it("keeps a same-origin task deep link", () => { expect(safeReturnTo("/tarefas?task=a#detalhes")).toBe("/tarefas?task=a#detalhes"); });
  it("requires a matching full Origin for mutations", () => { expect(sameOrigin(null, env.APP_URL)).toBe(false); expect(sameOrigin("https://evil.test", env.APP_URL)).toBe(false); expect(sameOrigin(env.APP_URL, env.APP_URL)).toBe(true); expect(sameOrigin(`${env.APP_URL}/path`, env.APP_URL)).toBe(false); });
  it("checks the bcrypt byte ceiling without truncation or rejecting Unicode", () => { expect(validNewPassword("a".repeat(72))).toBe(true); expect(validNewPassword("a".repeat(73))).toBe(false); expect(validNewPassword("🙂".repeat(18))).toBe(true); expect(validNewPassword("🙂".repeat(19))).toBe(false); expect(validNewPassword("🙂".repeat(6))).toBe(false); expect(validNewPassword("valid-password\n")).toBe(false); });
  it("accepts only authoritative DTOs belonging to getUser identity", () => {
    expect(() => parseAccessState({ user_id: "other", must_change_password: false }, "me", "session")).toThrow();
    expect(() => parseAccessState({ user_id: "me", role: "master", must_change_password: false, entitlements: { capturar: "false" } }, "me", "session")).toThrow();
    expect(parseAccessState({ user_id: "me", must_change_password: true, role: "master", entitlements: {} }, "me", "session")).toEqual({ userId: "me", sessionId: "session", email: undefined, mustChangePassword: true });
  });
  it("rechecks entitlement for admin and ignores preferences as authorization", () => {
    const identity = parseAccessState({ user_id: "me", role: "master", must_change_password: false, entitlements: { admin: false, drive: false } }, "me", "session");
    expect(() => assertFeature(identity, "admin")).toThrow(); expect(() => assertFeature(identity, "drive")).toThrow(); expect(() => assertFeature(identity, "capturar")).not.toThrow();
  });
  it("enforces cookie flags on chunks, removals and PKCE regardless of SDK options", () => {
    expect(secureCookieOptions(true, { httpOnly: false, secure: false, path: "/other", domain: "evil.test", sameSite: "none", maxAge: 0 })).toEqual({ httpOnly: true, secure: true, path: "/", domain: undefined, sameSite: "lax", maxAge: 0 });
    expect(isOwnedAuthCookie("sc-auth.2")).toBe(true); expect(isOwnedAuthCookie("sc-auth-code-verifier-any")).toBe(true); expect(isOwnedAuthCookie("other-app-auth")).toBe(false);
  });
});
describe("short signed recovery/checkpoint state", () => {
  const secret = "s".repeat(32), now = 10_000;
  const flow = { kind: "recovery-session" as const, userId: "u", sessionId: "s", expiresAt: now + 600_000 };
  it("binds its payload and expiry", () => { const token = signFlow(flow, secret); expect(verifyFlow(token, secret, now)).toEqual(flow); expect(verifyFlow(token, "other-key", now)).toBeNull(); expect(verifyFlow(token, secret, flow.expiresAt)).toBeNull(); expect(verifyFlow(token.replace(token[0]!, "Z"), secret, now)).toBeNull(); });
  it("uses domain-separated HMAC without storing identifying subject", () => { const email = "person@example.invalid"; const login = subjectHash(secret, "login", email); expect(login).toMatch(/^[a-f0-9]{64}$/); expect(login).not.toContain(email); expect(login).not.toBe(subjectHash(secret, "recovery", email)); });
  it("rejects malformed, far-future or unsigned state", () => { expect(verifyFlow("not.a.signature", secret, now)).toBeNull(); expect(verifyFlow(signFlow({ ...flow, expiresAt: now + 3_600_001 }, secret), secret, now)).toBeNull(); });
});
