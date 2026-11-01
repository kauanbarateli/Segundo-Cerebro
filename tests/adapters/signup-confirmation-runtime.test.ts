import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthCookieJar } from "../../src/lib/auth/clients";
import type { CookieOptions } from "@supabase/ssr";

const mocks = vi.hoisted(() => ({ verifyOtp: vi.fn(), getUser: vi.fn(), getClaims: vi.fn(), signOut: vi.fn(), rpc: vi.fn(), signupRpc: vi.fn(), enabled: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/clients", () => ({ createRequestClient: () => ({ auth: { verifyOtp: mocks.verifyOtp, getUser: mocks.getUser, getClaims: mocks.getClaims, signOut: mocks.signOut } }), createPrivilegedClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/auth/signup-http", () => ({ signupEnabled: mocks.enabled, signupRpc: mocks.signupRpc, signupUnavailable: () => { throw new Error("unavailable"); } }));
import { createSignupConfirmationPorts, SIGNUP_CHECKPOINT_COOKIE } from "../../src/lib/auth/signup-confirmation-runtime";
import { verifySignupConfirmation } from "../../src/lib/auth/signup-confirmation-service";
import { verifySignupCheckpoint } from "../../src/lib/auth/signup-checkpoint";

const userId = "10000000-0000-4000-8000-000000000001", sessionId = "20000000-0000-4000-8000-000000000001", intentId = "30000000-0000-4000-8000-000000000001";
const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://app.example.invalid", supabaseUrl: "https://db.example.invalid", publishableKey: "sb_publishable_test", secretKey: "sb_secret_private", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
const token = "a".repeat(64), legal = { terms: "v1", privacy: "v2" };
function cookies(initial: { name: string; value: string }[] = []) {
  const values = new Map(initial.map(item => [item.name, item.value]));
  const set = vi.fn((name: string, value: string, options: CookieOptions) => { void options; values.set(name, value); });
  return { jar: { getAll: () => [...values].map(([name, value]) => ({ name, value })), set } as AuthCookieJar, set };
}

describe("adaptador de confirmação de cadastro", () => {
  beforeEach(() => {
    mocks.enabled.mockReturnValue(true); mocks.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    mocks.verifyOtp.mockResolvedValue({ error: null }); mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email: "a@example.invalid", email_confirmed_at: "2026-10-31T12:00:00Z", is_anonymous: false } }, error: null });
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: userId, session_id: sessionId } }, error: null });
    mocks.signupRpc.mockImplementation(async (_config, name) => name === "signup_rebind_verified_ack" ? null : { intentId, termsVersion: "v1", privacyVersion: "v2", state: "bound", originPending: false }); mocks.signOut.mockResolvedValue({ error: null });
  });
  afterEach(() => { vi.clearAllMocks(); });
  it("verifica somente OTP de cadastro e escreve checkpoint protegido", async () => {
    const { jar, set } = cookies(); const start = Date.now();
    expect(await verifySignupConfirmation(createSignupConfirmationPorts(config, jar), token, legal)).toEqual({ status: "ready" });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: token });
    const entry = set.mock.calls.find(call => call[0] === SIGNUP_CHECKPOINT_COOKIE)!;
    expect(entry[2]).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(verifySignupCheckpoint(entry[1], config.stateSecret, start + 10)).toMatchObject({ userId, sessionId, intentId });
    expect(entry[1]).not.toContain(token);
  });
  it("não sobrescreve a sessão de quem já estava conectado", async () => {
    const { jar, set } = cookies([{ name: "sc-auth.0", value: "session" }]);
    expect(await verifySignupConfirmation(createSignupConfirmationPorts(config, jar), token, legal)).toEqual({ status: "unavailable" });
    expect(mocks.verifyOtp).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled();
  });
  it("pede recuperação privada de intenção após OTP válido quando o vínculo expirou", async () => {
    mocks.signupRpc.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ intentId, termsVersion: "v1", privacyVersion: "v2", state: "bound", originPending: false });
    const { jar } = cookies();
    expect(await verifySignupConfirmation(createSignupConfirmationPorts(config, jar), token, legal)).toEqual({ status: "ready" });
    expect(mocks.signupRpc).toHaveBeenNthCalledWith(2, config, "signup_rebind_verified_ack", expect.objectContaining({ p_user: userId, p_session: sessionId, p_terms: "v1", p_privacy: "v2" }));
    expect(mocks.signupRpc).toHaveBeenNthCalledWith(3, config, "signup_recover_verified_intent", expect.objectContaining({ p_user: userId, p_session: sessionId, p_terms: "v1", p_privacy: "v2" }));
  });
  it("retoma prova reconhecida somente depois da verificação OTP, sem recuperar outra intenção", async () => {
    const intent = { intentId, termsVersion: "v1", privacyVersion: "v2", state: "bound", originPending: true };
    mocks.signupRpc.mockResolvedValue(intent);
    const { jar, set } = cookies();
    expect(await verifySignupConfirmation(createSignupConfirmationPorts(config, jar), token, legal)).toEqual({ status: "ready" });
    expect(mocks.signupRpc.mock.calls.map(call => call[1])).toEqual(["signup_find_bound_intent", "signup_rebind_verified_ack"]);
    expect(mocks.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(mocks.signupRpc.mock.invocationCallOrder[1]);
    const entry = set.mock.calls.find(call => call[0] === SIGNUP_CHECKPOINT_COOKIE)!;
    expect(verifySignupCheckpoint(entry[1], config.stateSecret, Date.now())).toMatchObject({ userId, sessionId, intentId, originPending: true });
  });
  it("não contorna uma recusa da cerca e limpa a sessão provisória", async () => {
    mocks.signupRpc.mockImplementation(async (_config, name) => { if (name === "signup_rebind_verified_ack") throw Error("fence refused"); return { intentId, termsVersion: "v1", privacyVersion: "v2", state: "bound", originPending: false }; });
    const { jar, set } = cookies();
    expect(await verifySignupConfirmation(createSignupConfirmationPorts(config, jar), token, legal)).toEqual({ status: "unavailable" });
    expect(mocks.signupRpc.mock.calls.map(call => call[1])).toEqual(["signup_find_bound_intent", "signup_rebind_verified_ack"]);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(set).not.toHaveBeenCalledWith(SIGNUP_CHECKPOINT_COOKIE, expect.anything(), expect.not.objectContaining({ maxAge: 0 }));
  });
  it("usa OTP de recuperação apenas no canal fixo de continuação", async () => {
    const { jar } = cookies();
    expect(await verifySignupConfirmation(createSignupConfirmationPorts(config, jar, undefined, "continuation"), token, legal)).toEqual({ status: "ready" });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: token });
  });
  it("limpa cookies provisórios se identidade e claims divergem", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "other", session_id: sessionId } }, error: null });
    const { jar, set } = cookies();
    expect(await verifySignupConfirmation(createSignupConfirmationPorts(config, jar), token, legal)).toEqual({ status: "invalid" });
    expect(mocks.signupRpc).not.toHaveBeenCalled(); expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(set).toHaveBeenCalledWith("sc-auth", "", expect.objectContaining({ maxAge: 0, httpOnly: true }));
  });
});
