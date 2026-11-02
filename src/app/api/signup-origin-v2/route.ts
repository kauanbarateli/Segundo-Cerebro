import { NextResponse } from "next/server";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { sameOrigin } from "@/lib/auth/policy";
import { requestAuthServices } from "@/lib/auth/runtime";
import { signupOriginV2Rpc } from "@/lib/auth/signup-http";
import { originWithdrawalV2Enabled } from "@/lib/auth/origin-withdrawal-v2-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class OriginFault extends Error { constructor(readonly status: 400 | 401 | 403 | 409) { super("Origin request refused."); } }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function revisionJson(request: Request): Promise<string | null> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return null;
  const reader = request.body?.getReader(); if (!reader) return null;
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > 1024) { await reader.cancel(); return null; } chunks.push(part.value); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).join(",") !== "revision") return null;
    const revision = (value as Record<string, unknown>).revision;
    return typeof revision === "string" && UUID.test(revision) ? revision.toLowerCase() : null;
  } catch { return null; } finally { reader.releaseLock(); }
}
async function handler(request: Request, write: boolean) {
  const headers = new Headers(noStoreHeaders()); headers.set("X-Content-Type-Options", "nosniff");
  try {
    if (!originWithdrawalV2Enabled()) return new NextResponse(null, { status: 404, headers });
    const config = readAuthConfiguration();
    if (config.mode !== "supabase") throw new OriginFault(401);
    const actor = await (await requestAuthServices(true, headers)).gateway.readIdentity();
    if (!actor) throw new OriginFault(401);
    if (actor.mustChangePassword) throw new OriginFault(403);
    if (request.headers.get("x-expected-user-id") !== actor.userId) throw new OriginFault(409);
    if (write && !sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new OriginFault(403);
    const revision = write ? await revisionJson(request) : null;
    if (write && !revision) throw new OriginFault(400);
    if (!write && new URL(request.url).search) throw new OriginFault(400);
    const data = write
      ? await signupOriginV2Rpc(config, "signup_origin_withdraw_v2", { p_user: actor.userId, p_session: actor.sessionId, p_revision: revision! })
      : await signupOriginV2Rpc(config, "signup_origin_status_v2", { p_user: actor.userId, p_session: actor.sessionId });
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Unavailable.");
    const value = data as Record<string, unknown>;
    if (write) {
      if (Object.keys(value).join(",") !== "status" || !["withdrawn", "absent", "stale"].includes(String(value.status))) throw new Error("Unavailable.");
    } else {
      if (Object.keys(value).sort().join(",") !== "revision,status" || (value.status !== "active" && value.status !== "absent") || (value.status === "absent" ? value.revision !== null : typeof value.revision !== "string" || !UUID.test(value.revision))) throw new Error("Unavailable.");
    }
    return NextResponse.json({ ok: true, result: value }, { headers });
  } catch (error) {
    const status = error instanceof OriginFault ? error.status : 503;
    return NextResponse.json({ ok: false, message: status === 409 ? "A conta mudou. Atualize a página." : "Não foi possível confirmar a operação. Tente novamente." }, { status, headers });
  }
}
export const GET = (request: Request) => handler(request, false);
export const POST = (request: Request) => handler(request, true);
