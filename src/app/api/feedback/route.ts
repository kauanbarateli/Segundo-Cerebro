import { NextResponse } from "next/server";
import { feedbackRpc, FeedbackGatewayError } from "@/adapters/db/feedback-gateway";
import { ErroDeDominio } from "@/core/contracts/base";
import { decodeFeedbackSubmission } from "@/core/feedback/submission";
import { readAuthConfiguration } from "@/lib/auth/config";
import { sameOrigin } from "@/lib/auth/policy";
import { requestAuthServices } from "@/lib/auth/runtime";
import { AuthGuardError } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = () => new Headers({ "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" });
class SessionChanged extends Error {}

async function handler(request: Request, write: boolean) {
  const resultHeaders = headers();
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase") throw new AuthGuardError("demo");
    const actor = await (await requestAuthServices(true, resultHeaders)).gateway.readIdentity();
    if (!actor) throw new AuthGuardError("unauthenticated");
    if (actor.mustChangePassword) throw new AuthGuardError("forbidden");
    if (request.headers.get("x-expected-user-id") !== actor.userId) throw new SessionChanged();
    if (write && (!sameOrigin(request.headers.get("origin"), config.appOrigin) || request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")) throw new AuthGuardError("forbidden");
    let input;
    if (write) {
      const reader = request.body?.getReader();
      if (!reader) throw new ErroDeDominio("VALIDATION", "Envio inválido.");
      const chunks: Uint8Array[] = []; let bytes = 0;
      try {
        for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 32 * 1024) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "Envio inválido."); } chunks.push(part.value); }
        let parsed: unknown;
        try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); } catch { throw new ErroDeDominio("VALIDATION", "Envio inválido."); }
        input = decodeFeedbackSubmission(parsed);
      } finally { reader.releaseLock(); }
    }
    return NextResponse.json({ ok: true, result: await feedbackRpc(config, actor, input) }, { headers: resultHeaders });
  } catch (error) {
    const code = error instanceof SessionChanged ? "SESSION_CHANGED" : error instanceof ErroDeDominio ? "VALIDATION" : error instanceof FeedbackGatewayError ? error.code : error instanceof AuthGuardError ? error.code.toUpperCase() : "UNAVAILABLE";
    const status = code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : code === "VALIDATION" ? 400 : code === "CONFLICT" || code === "SESSION_CHANGED" ? 409 : 503;
    return NextResponse.json({ ok: false, code, message: status === 409 ? "A conta ou o envio mudou. Confira antes de tentar novamente." : status === 400 ? "Revise os campos da mensagem." : "Não foi possível confirmar esta operação." }, { status, headers: resultHeaders });
  }
}
export function GET(request: Request) { return handler(request, false); }
export function POST(request: Request) { return handler(request, true); }
