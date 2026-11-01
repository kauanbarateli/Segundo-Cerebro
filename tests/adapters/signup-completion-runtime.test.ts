import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthCookieJar } from "../../src/lib/auth/clients";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getClaims: vi.fn(), updateUser: vi.fn(), rpc: vi.fn(), signupRpc: vi.fn(), enabled: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/clients", () => ({ createRequestClient: () => ({ auth: { getUser: mocks.getUser, getClaims: mocks.getClaims, updateUser: mocks.updateUser } }), createPrivilegedClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/auth/signup-http", () => ({ signupEnabled: mocks.enabled, signupRpc: mocks.signupRpc, signupUnavailable: () => { throw new Error("unavailable"); } }));
import { createSignupCompletionPorts } from "../../src/lib/auth/signup-completion-runtime";
import { completePublicSignup } from "../../src/lib/auth/signup-completion-service";
import { signSignupCheckpoint, verifySignupCheckpoint } from "../../src/lib/auth/signup-checkpoint";
import { SIGNUP_CHECKPOINT_COOKIE } from "../../src/lib/auth/signup-confirmation-runtime";

const userId = "10000000-0000-4000-8000-000000000001", sessionId = "20000000-0000-4000-8000-000000000001", intentId = "30000000-0000-4000-8000-000000000001";
const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://app.example.invalid", supabaseUrl: "https://db.example.invalid", publishableKey: "sb_publishable_test", secretKey: "sb_secret_private", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
const input = { password: "uma senha longa", acceptedLegal: true, termsVersion: "v1", privacyVersion: "v2" }, legal = { terms: "v1", privacy: "v2" };
function cookies() {
  const now = Date.now(), value = signSignupCheckpoint({ userId, sessionId, intentId, issuedAt: now, expiresAt: now + 600_000, passwordConfirmed: false }, config.stateSecret, now);
  const values = new Map([[SIGNUP_CHECKPOINT_COOKIE, value]]);
  const set = vi.fn((name: string, entry: string, options: CookieOptions) => { void options; values.set(name, entry); });
  return { jar: { getAll: () => [...values].map(([name, entry]) => ({ name, value: entry })), set } as AuthCookieJar, set, values };
}
describe("adaptador de conclusão de cadastro", () => {
  beforeEach(() => {
    mocks.enabled.mockReturnValue(true); mocks.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email: "pessoa@example.com", email_confirmed_at: "2026-10-31T12:00:00Z", is_anonymous: false } }, error: null });
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: userId, session_id: sessionId } }, error: null }); mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signupRpc.mockImplementation(async (_config, name) => name === "signup_find_bound_intent" ? { intentId, termsVersion: "v1", privacyVersion: "v2", state: "bound" } : name === "signup_complete" ? { status: "admitted" } : null);
  });
  afterEach(() => vi.clearAllMocks());
  it("conclui somente com checkpoint e usa RPCs restritas sem enviar senha ao banco", async () => {
    const { jar, set } = cookies();
    expect(await completePublicSignup(createSignupCompletionPorts(config, jar), input, legal)).toEqual({ status: "completed" });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: input.password });
    const calls = mocks.signupRpc.mock.calls;
    expect(calls.map(call => call[1])).toEqual(["signup_find_bound_intent", "signup_attest_password_reset", "signup_complete"]);
    expect(JSON.stringify(calls)).not.toContain(input.password);
    expect(set).toHaveBeenLastCalledWith(SIGNUP_CHECKPOINT_COOKIE, "", expect.objectContaining({ maxAge: 0, httpOnly: true }));
  });
  it("mantém o passo de senha confirmado para retomar falha do banco", async () => {
    const { jar, values } = cookies(); let fail = true;
    mocks.signupRpc.mockImplementation(async (_config, name) => {
      if (name === "signup_find_bound_intent") return { intentId, termsVersion: "v1", privacyVersion: "v2", state: "bound" };
      if (name === "signup_attest_password_reset" && fail) { fail = false; throw new Error("privado"); }
      return name === "signup_complete" ? { status: "admitted" } : null;
    });
    expect(await completePublicSignup(createSignupCompletionPorts(config, jar), input, legal)).toEqual({ status: "unavailable" });
    expect(verifySignupCheckpoint(values.get(SIGNUP_CHECKPOINT_COOKIE), config.stateSecret, Date.now())?.passwordConfirmed).toBe(true);
    expect(await completePublicSignup(createSignupCompletionPorts(config, jar), input, legal)).toEqual({ status: "completed" });
    expect(mocks.updateUser).toHaveBeenCalledOnce();
  });
  it("recusa identidade diferente e erro incerto de senha sem atestar", async () => {
    const { jar } = cookies(); mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "outra", session_id: sessionId } }, error: null });
    expect(await completePublicSignup(createSignupCompletionPorts(config, jar), input, legal)).toEqual({ status: "needs-verification" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: userId, session_id: sessionId } }, error: null }); mocks.updateUser.mockResolvedValue({ error: { status: 503 } });
    expect(await completePublicSignup(createSignupCompletionPorts(config, jar), input, legal)).toEqual({ status: "needs-verification" });
    expect(mocks.signupRpc.mock.calls.some(call => call[1] === "signup_attest_password_reset")).toBe(false);
  });
});
