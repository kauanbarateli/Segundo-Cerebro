import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthCookieJar } from "../../src/lib/auth/clients";

// Simulated ports only: no Supabase, SQL or provider calls.
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getClaims: vi.fn(), updateUser: vi.fn(), rpc: vi.fn(), signupRpc: vi.fn(), fence: vi.fn(), enabled: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/clients", () => ({ createRequestClient: () => ({ auth: { getUser: mocks.getUser, getClaims: mocks.getClaims, updateUser: mocks.updateUser } }), createPrivilegedClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/auth/signup-http", () => ({ signupEnabled: mocks.enabled, signupRpc: mocks.signupRpc, signupFenceRpc: mocks.fence, signupUnavailable: () => { throw new Error("unavailable"); } }));
import { createSignupCompletionPorts } from "../../src/lib/auth/signup-completion-runtime";
import { completePublicSignup } from "../../src/lib/auth/signup-completion-service";
import {signSignupContext,SIGNUP_CONTEXT_COOKIE} from "../../src/lib/auth/signup-provisional";
import { signSignupCheckpoint } from "../../src/lib/auth/signup-checkpoint";
import { SIGNUP_CHECKPOINT_COOKIE } from "../../src/lib/auth/signup-confirmation-runtime";

const userId = "10000000-0000-4000-8000-000000000001", sessionId = "20000000-0000-4000-8000-000000000001", intentId = "30000000-0000-4000-8000-000000000001", generation = "40000000-0000-4000-8000-000000000001";
const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://app.example.invalid", supabaseUrl: "https://db.example.invalid", publishableKey: "sb_publishable_test", secretKey: "sb_secret_private", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
const input = { password: "uma senha longa", acceptedLegal: true, termsVersion: "v1", privacyVersion: "v2" }, legal = { terms: "v1", privacy: "v2" };
function cookies() {
  const now = Date.now(), value = signSignupCheckpoint({ userId, sessionId, intentId, issuedAt: now, expiresAt: now + 600_000, passwordConfirmed: false, originPending: false }, config.stateSecret, now);
  const values = new Map([[SIGNUP_CHECKPOINT_COOKIE, value],[SIGNUP_CONTEXT_COOKIE,signSignupContext({scope:"q".repeat(43),userId,sessionId},config.stateSecret)]]);
  const set = vi.fn((name: string, entry: string, options: CookieOptions) => { void options; values.set(name, entry); });
  return { jar: { getAll: () => [...values].map(([name, entry]) => ({ name, value: entry })), set } as AuthCookieJar, set };
}
describe("adaptador candidato de conclusão de cadastro", () => {
  beforeEach(() => {
    mocks.enabled.mockReturnValue(true);
    mocks.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email: "pessoa@example.com", email_confirmed_at: "2026-10-31T12:00:00Z", is_anonymous: false } }, error: null });
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: userId, session_id: sessionId } }, error: null });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signupRpc.mockResolvedValue({ intentId, termsVersion: "v1", privacyVersion: "v2", state: "bound", originPending: false });
    mocks.fence.mockImplementation(async (_config, name, args) => name === "signup_fence_confirm" ? false : name === "signup_fence_reserve" ? { status: "acquired", requestId: args.p_request, generation } : true);
  });
  afterEach(() => vi.clearAllMocks());
  it("fecha antes de ler identidade, banco ou senha quando gate está desligado", async () => {
    mocks.enabled.mockReturnValue(false);
    const { jar } = cookies();
    expect(await completePublicSignup(createSignupCompletionPorts(config, jar), input, legal)).toEqual({ status: "unavailable" });
    expect(mocks.getUser).not.toHaveBeenCalled(); expect(mocks.fence).not.toHaveBeenCalled(); expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("encadeia portas reais com transporte simulado sem enviar senha ao banco", async () => {
    const { jar, set } = cookies();
    expect(await completePublicSignup(createSignupCompletionPorts(config, jar), input, legal)).toEqual({ status: "completed" });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: input.password });
    expect(mocks.fence.mock.calls.map(call => call[1])).toEqual(["signup_fence_confirm", "signup_fence_reserve", "signup_fence_start", "signup_fence_ack", "signup_fence_finish"]);
    expect(JSON.stringify(mocks.fence.mock.calls)).not.toContain(input.password);
    expect(set).toHaveBeenLastCalledWith(SIGNUP_CHECKPOINT_COOKIE, "", expect.objectContaining({ maxAge: 0, httpOnly: true }));
  });
  it("resposta perdida de start mantém resultado incerto e não chama Auth", async () => {
    mocks.fence.mockImplementation(async (_config, name, args) => {
      if (name === "signup_fence_confirm") return false;
      if (name === "signup_fence_reserve") return { status: "acquired", requestId: args.p_request, generation };
      throw new Error("resposta perdida");
    });
    const { jar } = cookies();
    expect(await completePublicSignup(createSignupCompletionPorts(config, jar), input, legal)).toEqual({ status: "pending-reconciliation" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("retoma somente uma confirmação prévia sem chamar Auth outra vez", async () => {
    const previousRequest = "50000000-0000-4000-8000-000000000001";
    mocks.fence.mockImplementation(async (_config, name) => name === "signup_fence_confirm" ? false : name === "signup_fence_reserve" ? { status: "acknowledged", requestId: previousRequest, generation } : name === "signup_fence_finish");
    const { jar } = cookies();
    expect(await completePublicSignup(createSignupCompletionPorts(config, jar), input, legal)).toEqual({ status: "completed" });
    expect(mocks.fence.mock.calls.map(call => call[1])).toEqual(["signup_fence_confirm", "signup_fence_reserve", "signup_fence_finish"]);
    expect(mocks.fence.mock.calls.at(-1)?.[2]).toMatchObject({ p_request: previousRequest, p_generation: generation, p_session: sessionId });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
