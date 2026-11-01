import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createPrivilegedClient } from "./clients";
import type { SupabaseAuthConfig } from "./config";
import { isTrustedHostedDatabaseOrigin } from "./database-origin-server";
import { subjectHash } from "./flow-state";
import type { SignupRequestPorts } from "./signup-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => { throw new Error("Signup unavailable."); };
async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return unavailable();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 1024) { await reader.cancel(); return unavailable(); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally { reader.releaseLock(); }
}
function enabled(config: SupabaseAuthConfig): boolean {
  return process.env.PUBLIC_SIGNUP_ENABLED === "true" && isTrustedHostedDatabaseOrigin(config);
}

/** Server-only candidate. No route uses this adapter until all signup gates pass. */
export function createSignupRequestPorts(config: SupabaseAuthConfig): SignupRequestPorts {
  return {
    now: Date.now,
    randomPointer: () => randomBytes(32).toString("base64url"),
    bindingHash: pointer => createHash("sha256").update(pointer).digest("hex"),
    subjectHash: email => subjectHash(config.rateLimitSecret, "signup-request", email),
    async limit(hash) {
      if (!enabled(config)) return unavailable();
      const { data, error } = await createPrivilegedClient(config).rpc("consume_rate_limit", { p_scope: "login", p_subject_hash: hash });
      if (error || !data || typeof data !== "object" || Array.isArray(data) || typeof data.allowed !== "boolean") return unavailable();
      return { allowed: data.allowed };
    },
    async createIntent(intent) {
      if (!enabled(config)) return unavailable();
      // The schema candidate is not in generated types until promotion. Only
      // this fixed endpoint and server-only credential are used for the draft.
      const response = await fetch(new URL("/rest/v1/rpc/signup_intent_create", config.supabaseUrl), {
        method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/json", "Accept": "application/json", apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}` },
        body: JSON.stringify({ p_binding_hash: intent.bindingHash, p_subject_hash: intent.subjectHash, p_terms: intent.termsVersion, p_privacy: intent.privacyVersion, p_expires: new Date(intent.expiresAt).toISOString() }),
      });
      if (!response.ok || response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return unavailable();
      const result = await boundedJson(response);
      if (typeof result !== "string" || !UUID.test(result)) return unavailable();
    },
    async signup(value) {
      if (!enabled(config)) return unavailable();
      const client = createClient(config.supabaseUrl, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) }) },
      });
      const { error } = await client.auth.signUp({ email: value.email, password: value.password, options: { data: { sc_signup_pointer: value.pointer }, emailRedirectTo: new URL("/auth/confirmar-cadastro", config.appOrigin).toString() } });
      if (error) return unavailable();
    },
  };
}
