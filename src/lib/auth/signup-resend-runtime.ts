import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseAuthConfig } from "./config";
import { subjectHash } from "./flow-state";
import { createSignupRequestPorts } from "./signup-runtime";
import { signupEnabled, signupUnavailable } from "./signup-http";
import type { SignupResendPorts } from "./signup-resend-service";

export function createSignupResendPorts(config: SupabaseAuthConfig): SignupResendPorts {
  return {
    subjectHash: email => subjectHash(config.rateLimitSecret, "signup-resend", email),
    limit: createSignupRequestPorts(config).limit,
    async resend(email, purpose) {
      if (!signupEnabled(config)) return signupUnavailable();
      const client = createClient(config.supabaseUrl, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) }) },
      });
      const { error } = purpose === "signup"
        ? await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: new URL("/auth/confirmar-cadastro", config.appOrigin).toString() } })
        : await client.auth.resetPasswordForEmail(email, { redirectTo: new URL("/auth/continuar-cadastro", config.appOrigin).toString() });
      if (error) return signupUnavailable();
    },
  };
}
