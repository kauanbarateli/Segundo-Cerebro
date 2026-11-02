import { NextResponse } from "next/server";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { sameOrigin } from "@/lib/auth/policy";
import { requestAuthServices } from "@/lib/auth/runtime";
import { signupOriginRpc } from "@/lib/auth/signup-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class OriginFault extends Error { constructor(readonly status: 400 | 401 | 403 | 409) { super("Origin request refused."); } }
async function emptyJson(request: Request): Promise<boolean> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return false;
  const reader = request.body?.getReader(); if (!reader) return false;
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > 1024) { await reader.cancel(); return false; } chunks.push(part.value); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
  } catch { return false; } finally { reader.releaseLock(); }
}
async function handler(request: Request, write: boolean) {
  const headers = new Headers(noStoreHeaders()); headers.set("X-Content-Type-Options", "nosniff");
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase") throw new OriginFault(401);
    const actor = await (await requestAuthServices(true, headers)).gateway.readIdentity();
    if (!actor) throw new OriginFault(401);
    if (actor.mustChangePassword) throw new OriginFault(403);
    if (request.headers.get("x-expected-user-id") !== actor.userId) throw new OriginFault(409);
    if (write && (!sameOrigin(request.headers.get("origin"), config.appOrigin) || !await emptyJson(request))) throw new OriginFault(403);
    if (!write && new URL(request.url).search) throw new OriginFault(400);
    const data = await signupOriginRpc(config, write ? "signup_origin_withdraw" : "signup_origin_status", { p_user: actor.userId, p_session: actor.sessionId });
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Unavailable.");
    const value = data as Record<string, unknown>;
    if (write) {
      if (Object.keys(value).join(",") !== "status" || (value.status !== "withdrawn" && value.status !== "absent")) throw new Error("Unavailable.");
    } else {
      if (Object.keys(value).sort().join(",") !== "expiresAt,status" || (value.status !== "active" && value.status !== "absent") || (value.status === "absent" ? value.expiresAt !== null : typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)))) throw new Error("Unavailable.");
    }
    return NextResponse.json({ ok: true, result: value }, { headers });
  } catch (error) {
    const status = error instanceof OriginFault ? error.status : 503;
    return NextResponse.json({ ok: false, message: status === 409 ? "A conta mudou. Atualize a página." : "Não foi possível confirmar a operação. Tente novamente." }, { status, headers });
  }
}
export const GET = (request: Request) => handler(request, false);
export const POST = (request: Request) => handler(request, true);
