import "server-only";
import type { SupabaseAuthConfig } from "./config";
import { isTrustedHostedDatabaseOrigin } from "./database-origin-server";

export const signupUnavailable = () => { throw new Error("Signup unavailable."); };
export function signupEnabled(config: SupabaseAuthConfig): boolean {
  return process.env.PUBLIC_SIGNUP_ENABLED === "true" && isTrustedHostedDatabaseOrigin(config);
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

/** Narrow server-only candidate transport; never log body, credentials or errors. */
type SignupRpcName = "signup_intent_create" | "signup_find_bound_intent" | "signup_recover_verified_intent" | "signup_attest_password_reset" | "signup_complete";
export async function signupRpc(config: SupabaseAuthConfig, name: SignupRpcName, body: object): Promise<unknown> {
  if (!["signup_intent_create", "signup_find_bound_intent", "signup_recover_verified_intent", "signup_attest_password_reset", "signup_complete"].includes(name) || !signupEnabled(config)) return signupUnavailable();
  const response = await fetch(new URL(`/rest/v1/rpc/${name}`, config.supabaseUrl), {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json", "Accept": "application/json", apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}` },
    body: JSON.stringify(body),
  });
  if (name === "signup_attest_password_reset" && response.status === 204) return null;
  if (!response.ok || response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return signupUnavailable();
  return boundedJson(response);
}
