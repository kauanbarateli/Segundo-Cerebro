import "server-only";
import { authDeploymentAllowed } from "../../lib/environment/application-destination";
import { isTrustedHostedDatabaseOrigin } from "../../lib/auth/database-origin-server";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import type { AuthenticatedIdentity } from "../../lib/auth/types";
import { FEEDBACK_CATEGORIES, type FeedbackSubmission } from "../../core/feedback/submission";

export class FeedbackGatewayError extends Error {
  constructor(readonly code: "FORBIDDEN" | "CONFLICT" | "UNAVAILABLE" | "COMMIT_UNKNOWN") { super(code); }
}

function validItem(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).sort().join(",") === "category,createdAt,id,status,text"
    && typeof item.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
    && typeof item.category === "string" && FEEDBACK_CATEGORIES.some((category) => category === item.category)
    && typeof item.text === "string" && item.text.length <= 10000 && item.status === "received"
    && typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt));
}

export interface FeedbackCursor { before: string; id: string }
export async function feedbackRpc(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, input?: FeedbackSubmission, cursor?: FeedbackCursor): Promise<unknown> {
  if (!isTrustedHostedDatabaseOrigin(config) || !authDeploymentAllowed(process.env, config)) throw new FeedbackGatewayError("UNAVAILABLE");
  const writing = input !== undefined;
  const payload = writing
    ? { p_user: actor.userId, p_session: actor.sessionId, p_client: input.clientId, p_category: input.category, p_message: input.text }
    : { p_user: actor.userId, p_session: actor.sessionId, p_before: cursor?.before ?? null, p_before_id: cursor?.id ?? null };
  let response: Response;
  try {
    response = await fetch(new URL(`/rest/v1/rpc/${writing ? "feedback_submit" : "feedback_list"}`, config.supabaseUrl), {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(30_000),
      headers: { apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch { throw new FeedbackGatewayError(writing ? "COMMIT_UNKNOWN" : "UNAVAILABLE"); }
  const reader = response.body?.getReader();
  if (!reader) throw new FeedbackGatewayError(writing ? "COMMIT_UNKNOWN" : "UNAVAILABLE");
  try {
    let bytes = 0; const chunks: Uint8Array[] = [];
    for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > 1024 * 1024) { await reader.cancel(); throw new Error("limit"); } chunks.push(next.value); }
    const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!response.ok) {
      const code = data && typeof data === "object" && "code" in data ? data.code : null;
      if (code === "42501") throw new FeedbackGatewayError("FORBIDDEN");
      if (code === "23505" || code === "22023" || code === "23514") throw new FeedbackGatewayError("CONFLICT");
      throw new FeedbackGatewayError(writing ? "COMMIT_UNKNOWN" : "UNAVAILABLE");
    }
    if (writing) { if (!validItem(data)) throw new Error("invalid response"); return data; }
    if (!Array.isArray(data) || data.length > 51 || !data.every(validItem)) throw new Error("invalid response");
    const items = data.slice(0, 50); const last = items.at(-1) as { id: string; createdAt: string } | undefined;
    return { items, next: data.length > 50 && last ? { id: last.id, before: last.createdAt } : null };
  } catch (error) {
    if (error instanceof FeedbackGatewayError) throw error;
    throw new FeedbackGatewayError(writing ? "COMMIT_UNKNOWN" : "UNAVAILABLE");
  } finally { reader.releaseLock(); }
}
