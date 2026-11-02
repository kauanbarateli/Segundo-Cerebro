import { expect, it, vi } from "vitest";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/database-origin-server", () => ({ isTrustedHostedDatabaseOrigin: () => true }));
import { signupEnabled, signupSameBrowserEnabled, signupFenceDeployed, signupFenceRpc, signupRpc } from "../../src/lib/auth/signup-http";

it("mantém o gate e os dois transportes reais fechados mesmo com flag pública ativa", async () => {
  const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://app.example.invalid", supabaseUrl: "https://db.example.invalid", publishableKey: "sb_publishable_test", secretKey: "sb_secret_private", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); vi.stubEnv("PUBLIC_SIGNUP_ENABLED", "true");
  try {
    expect(signupFenceDeployed(config)).toBe(false); expect(signupEnabled(config)).toBe(false); expect(signupSameBrowserEnabled(config)).toBe(false);
    await expect(signupRpc(config, "signup_intent_create", { p_binding_hash: "a", p_subject_hash: "b", p_terms: "v1", p_privacy: "v2", p_expires: "2027-01-01", p_origin: null, p_origin_version: null })).rejects.toThrow("Signup unavailable.");
    await expect(signupFenceRpc(config, "signup_fence_withdraw", { p_user: "u", p_session: "s" })).rejects.toThrow("Signup unavailable.");
    expect(fetch).not.toHaveBeenCalled();
  } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
});
