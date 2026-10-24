import "server-only";
import { OnboardingPortError } from "../../core/onboarding/types";
import { authDeploymentAllowed } from "../../lib/environment/application-destination";
import { isTrustedHostedDatabaseOrigin } from "../../lib/auth/database-origin-server";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import type { AuthenticatedIdentity } from "../../lib/auth/types";
import { onboardingRecord, type OnboardingRpc } from "./onboarding-protocol";

/** Server-only PostgREST adapter. No handwritten replacement of generated Database types. */
export function onboardingRpcForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, transport: typeof fetch = fetch): OnboardingRpc {
  if (!isTrustedHostedDatabaseOrigin(config) || !authDeploymentAllowed(process.env, config)) throw new OnboardingPortError("UNAVAILABLE");
  const url = new URL("/rest/v1/rpc/onboarding_call", config.supabaseUrl);
  return async (operation, request, writing) => {
    let response: Response;
    try {
      response = await transport(url, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(30_000),
        headers: { apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}`, "Content-Type": "application/json", "User-Agent": "SegundoCerebro-Onboarding/1" },
        body: JSON.stringify({ p_user: actor.userId, p_session: actor.sessionId, p_operation: operation, p_request: request }) });
    } catch { throw new OnboardingPortError(writing ? "COMMIT_UNKNOWN" : "UNAVAILABLE"); }
    const reader = response.body?.getReader(); if (!reader) throw new OnboardingPortError(writing ? "COMMIT_UNKNOWN" : "UNAVAILABLE");
    const parts: Uint8Array[] = []; let length = 0;
    try {
      while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > 1024 * 1024) { await reader.cancel(); throw new Error("QUOTA"); } parts.push(next.value); }
      const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts)));
      if (!response.ok) {
        const code = onboardingRecord(data) ? data.code : null;
        if (code === "42501") throw new OnboardingPortError("FORBIDDEN");
        if (code === "40001" || code === "23505") throw new OnboardingPortError("CONFLICT");
        if (code === "22023" || code === "23514") throw new OnboardingPortError("CONFLICT");
        throw new OnboardingPortError(writing ? "COMMIT_UNKNOWN" : "UNAVAILABLE");
      }
      return data;
    } catch (error) { if (error instanceof OnboardingPortError) throw error; throw new OnboardingPortError(writing ? "COMMIT_UNKNOWN" : "UNAVAILABLE"); }
    finally { reader.releaseLock(); }
  };
}
