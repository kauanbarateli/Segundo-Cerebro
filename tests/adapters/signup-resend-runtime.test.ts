import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";

const mocks = vi.hoisted(() => ({ resend: vi.fn(), recovery: vi.fn(), client: vi.fn(), limit: vi.fn(), enabled: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
vi.mock("@/lib/auth/signup-runtime", () => ({ createSignupRequestPorts: () => ({ limit: mocks.limit }) }));
vi.mock("@/lib/auth/signup-http", () => ({ signupEnabled: mocks.enabled, signupUnavailable: () => { throw new Error("unavailable"); } }));
import { createSignupResendPorts } from "../../src/lib/auth/signup-resend-runtime";
import { resendSignupConfirmation } from "../../src/lib/auth/signup-resend-service";

const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://app.example.invalid", supabaseUrl: "https://db.example.invalid", publishableKey: "sb_publishable_test", secretKey: "sb_secret_private", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
describe("adaptador de reenvio", () => {
  beforeEach(() => { mocks.enabled.mockReturnValue(true); mocks.limit.mockResolvedValue({ allowed: true }); mocks.resend.mockResolvedValue({ error: null }); mocks.recovery.mockResolvedValue({ error: null }); mocks.client.mockReturnValue({ auth: { resend: mocks.resend, resetPasswordForEmail: mocks.recovery } }); });
  afterEach(() => vi.clearAllMocks());
  it("limita por HMAC e usa o destino fixo para cadastro", async () => {
    expect(await resendSignupConfirmation(createSignupResendPorts(config), "a@example.com", "signup")).toEqual({ status: "accepted" });
    expect(mocks.limit).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(mocks.resend).toHaveBeenCalledWith({ type: "signup", email: "a@example.com", options: { emailRedirectTo: "https://app.example.invalid/auth/confirmar-cadastro" } });
  });
  it("usa destino separado quando a confirmação já aconteceu", async () => {
    expect(await resendSignupConfirmation(createSignupResendPorts(config), "a@example.com", "continuation")).toEqual({ status: "accepted" });
    expect(mocks.recovery).toHaveBeenCalledWith("a@example.com", { redirectTo: "https://app.example.invalid/auth/continuar-cadastro" });
    expect(mocks.resend).not.toHaveBeenCalled();
  });
});
