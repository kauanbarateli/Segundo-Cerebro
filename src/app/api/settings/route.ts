import { NextResponse } from "next/server";
import { settingsForRequest } from "@/adapters/db/settings-runtime";
import { applySettings, SettingsRateLimitError } from "@/core/configuracoes";
import { ErroDeDominio } from "@/core/contracts/base";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { AuthGuardError } from "@/lib/auth/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = () => new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
class SessionChanged extends Error {}
async function handle(request: Request, write: boolean) {
  const responseHeaders = headers();
  try {
    const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
    if (write && !sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden");
    const services = await requestAuthServices(true, responseHeaders), actor = await services.gateway.readIdentity();
    if (!actor) throw new AuthGuardError("unauthenticated"); if (actor.mustChangePassword) throw new AuthGuardError("forbidden"); assertFeature(actor, "configuracoes");
    if (request.headers.get("x-expected-user-id") !== actor.userId) throw new SessionChanged();
    const port = settingsForRequest(config, actor);
    if (!write) return NextResponse.json(await port.load(), { headers: responseHeaders });
    if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ErroDeDominio("VALIDATION", "Envie uma operação JSON.");
    const reader = request.body?.getReader(); if (!reader) throw new ErroDeDominio("VALIDATION", "Informe a operação.");
    const parts: Uint8Array[] = []; let size = 0;
    try { while (true) { const row = await reader.read(); if (row.done) break; size += row.value.byteLength; if (size > 16384) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "Operação muito grande."); } parts.push(row.value); } } finally { reader.releaseLock(); }
    let value: unknown; try { value = JSON.parse(Buffer.concat(parts).toString("utf8")); } catch { throw new ErroDeDominio("VALIDATION", "Operação inválida."); }
    return NextResponse.json({ ok: true, result: await applySettings(port, value) }, { headers: responseHeaders });
  } catch (error) {
    if (error instanceof SettingsRateLimitError) { responseHeaders.set("Retry-After", "60"); return NextResponse.json({ ok: false, code: "RATE_LIMITED", message: error.message }, { status: 429, headers: responseHeaders }); }
    const status = error instanceof SessionChanged ? 409 : error instanceof AuthGuardError ? error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503 : error instanceof ErroDeDominio ? error.code === "CONFLICT" ? 409 : 400 : 503;
    const code = error instanceof SessionChanged ? "SESSION_CHANGED" : error instanceof AuthGuardError ? error.code.toUpperCase() : error instanceof ErroDeDominio ? error.code : write ? "COMMIT_UNKNOWN" : "UNAVAILABLE";
    return NextResponse.json({ ok: false, code, message: status === 400 ? "Revise os campos e tente novamente." : "Não foi possível concluir. Recarregue ou confirme o mesmo envio." }, { status, headers: responseHeaders });
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
