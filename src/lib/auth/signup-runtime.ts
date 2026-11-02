import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createPrivilegedClient } from "./clients";
import type { SupabaseAuthConfig } from "./config";
import { subjectHash } from "./flow-state";
import { signupEnabled, signupRpc, signupUnavailable } from "./signup-http";
import type { SignupRequestPorts } from "./signup-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Server-only candidate. No route uses this adapter until all signup gates pass. */
export function createSignupRequestPorts(config: SupabaseAuthConfig): SignupRequestPorts {
  return {
    now: Date.now,
    randomPointer: () => randomBytes(32).toString("base64url"),
    bindingHash: pointer => createHash("sha256").update(pointer).digest("hex"),
    subjectHash: email => subjectHash(config.rateLimitSecret, "signup-request", email),
    async limit(hash) {
      if (!signupEnabled(config)) return signupUnavailable();
      const { data, error } = await createPrivilegedClient(config).rpc("consume_rate_limit", { p_scope: "login", p_subject_hash: hash });
      if (error || !data || typeof data !== "object" || Array.isArray(data) || typeof data.allowed !== "boolean") return signupUnavailable();
      return { allowed: data.allowed };
    },
    async createIntent(intent) {
      // The schema candidate is not in generated types until promotion. Only
      // this fixed endpoint and server-only credential are used for the draft.
      const result = await signupRpc(config, "signup_intent_create", { p_binding_hash: intent.bindingHash, p_subject_hash: intent.subjectHash, p_terms: intent.termsVersion, p_privacy: intent.privacyVersion, p_expires: new Date(intent.expiresAt).toISOString(), p_origin: intent.origin, p_origin_version: intent.originVersion });
      if (typeof result !== "string" || !UUID.test(result)) return signupUnavailable();
    },
    async signup(value) {
      if (!signupEnabled(config)) return signupUnavailable();
      const client = createClient(config.supabaseUrl, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) }) },
      });
      const { error } = await client.auth.signUp({ email: value.email, password: value.password, options: { data: { sc_signup_pointer: value.pointer }, emailRedirectTo: new URL("/auth/confirmar-cadastro", config.appOrigin).toString() } });
      if (error) return signupUnavailable();
    },
  };
}
