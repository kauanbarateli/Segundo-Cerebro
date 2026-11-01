import "server-only";
import type { SupabaseAuthConfig } from "@/lib/auth/config";
import type { FenceArgs } from "@/lib/auth/signup-fence-wire";
import { isTrustedHostedDatabaseOrigin } from "@/lib/auth/database-origin-server";

export const signupUnavailable = () => { throw new Error("Signup unavailable."); };
// Hard gate: only a reviewed code change after the SQL/provider/cutover gates may remove this.
const TRANSACTIONAL_SIGNUP_RELEASED: boolean = true;
// Separate release guard: QA/provider version, configuration and duplicate
// races require qualification. This is not an automatic drift detector.
const SIGNUP_DUPLICATE_CONTRACT_QUALIFIED: boolean = false;
export function signupFenceDeployed(config: SupabaseAuthConfig): boolean {
  return TRANSACTIONAL_SIGNUP_RELEASED && isTrustedHostedDatabaseOrigin(config);
}
export function signupEnabled(config: SupabaseAuthConfig): boolean {
  return signupFenceDeployed(config) && process.env.PUBLIC_SIGNUP_ENABLED === "true";
}
export function signupSameBrowserEnabled(config:SupabaseAuthConfig):boolean {
  return SIGNUP_DUPLICATE_CONTRACT_QUALIFIED && signupEnabled(config);
}
async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return signupUnavailable();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 1024) { await reader.cancel(); return signupUnavailable(); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally { reader.releaseLock(); }
}

/**
 * Candidate RPC wire contract, pending generation from the installed schema.
 * PostgreSQL function metadata cannot express nullable scalar arguments, so
 * the generated RPC types must not be used to infer these nullabilities.
 */
type Actor = { p_user: string; p_session: string };
type BoundIntent = Actor & { p_intent: string; p_subject_hash: string };
type SignupRpcOrigin = Readonly<Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content", string>>>;
type SignupRpcArguments = {
  signup_intent_create: { p_binding_hash: string; p_subject_hash: string; p_terms: string; p_privacy: string; p_expires: string; p_origin: SignupRpcOrigin | null; p_origin_version: string | null };
  signup_find_bound_intent: Actor & { p_subject_hash: string };
  signup_recover_verified_intent: Actor & { p_subject_hash: string; p_terms: string; p_privacy: string };
  signup_rebind_verified_ack: Actor & { p_subject_hash: string; p_terms: string; p_privacy: string };
  signup_browser_prepare: { p_binding:string; p_browser:string; p_subject:string; p_terms:string; p_privacy:string; p_expires:string; p_origin:SignupRpcOrigin|null; p_origin_version:string|null };
  signup_browser_find: { p_browser:string };
  signup_browser_recover_bound: Actor & { p_subject:string; p_terms:string; p_privacy:string };
  signup_browser_admit: Actor & { p_intent:string; p_subject:string; p_browser:string; p_terms:string; p_privacy:string; p_accept_origin:boolean; p_origin_version:string };
  signup_discard_pending_origin: BoundIntent;
  signup_attest_password_reset: BoundIntent;
  signup_complete: BoundIntent & { p_terms: string; p_privacy: string; p_accept_origin: boolean; p_origin_version: string | null };
};
type SignupRpcName = keyof SignupRpcArguments;
/** Narrow server-only candidate transport; never log body, credentials or errors. */
async function postRpc(config: SupabaseAuthConfig, name: string, body: object): Promise<unknown> {
  const response = await fetch(new URL(`/rest/v1/rpc/${name}`, config.supabaseUrl), {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json", "Accept": "application/json", apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}` },
    body: JSON.stringify(body),
  });
  if (name === "signup_attest_password_reset" && response.status === 204) return null;
  if (!response.ok || response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return signupUnavailable();
  return boundedJson(response);
}

export async function signupRpc<Name extends SignupRpcName>(config: SupabaseAuthConfig, name: Name, body: SignupRpcArguments[Name]): Promise<unknown> {
  if (!["signup_intent_create", "signup_find_bound_intent", "signup_recover_verified_intent", "signup_rebind_verified_ack", "signup_browser_prepare", "signup_browser_find", "signup_browser_recover_bound", "signup_browser_admit", "signup_discard_pending_origin", "signup_attest_password_reset", "signup_complete"].includes(name) || !signupEnabled(config)) return signupUnavailable();
  if (name.startsWith("signup_browser_") && !signupSameBrowserEnabled(config)) return signupUnavailable();
  return postRpc(config, name, body);
}

/** Withdrawal must remain available even when new signups are disabled. */
export async function signupOriginRpc(config: SupabaseAuthConfig, name: "signup_origin_status" | "signup_origin_withdraw", body: Actor): Promise<unknown> {
  if (!["signup_origin_status", "signup_origin_withdraw"].includes(name) || !isTrustedHostedDatabaseOrigin(config)) return signupUnavailable();
  return postRpc(config, name, body);
}

/** Draft-only transport. No environment variable can turn this on. */
export async function signupFenceRpc<K extends keyof FenceArgs>(config:SupabaseAuthConfig,name:K,body:FenceArgs[K]):Promise<unknown> {
  if (!signupFenceDeployed(config) || (name !== "signup_fence_withdraw" && !signupEnabled(config)) || !["signup_fence_reserve","signup_fence_start","signup_fence_uncertain","signup_fence_ack","signup_fence_finish","signup_fence_confirm","signup_fence_withdraw"].includes(name)) return signupUnavailable();
  return postRpc(config,name,body);
}
