import "server-only";
import { NextResponse } from "next/server";
import { CalendarProviderError } from "../../core/calendario";
import { ErroDeDominio } from "../../core/contracts";
import { requestAuthServices } from "../../lib/auth/runtime";
import { assertFeature, sameOrigin } from "../../lib/auth/policy";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
export const calendarHeaders = () => new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
export async function calendarIdentity(headers: Headers, master = false) {
 const actor = await (await requestAuthServices(true, headers)).gateway.readIdentity();
 if (!actor) throw new AuthGuardError("unauthenticated");
 if (actor.mustChangePassword || (master && actor.role !== "master")) throw new AuthGuardError("forbidden");
 assertFeature(actor, master ? "admin" : "calendario"); return actor;
}
class CalendarSessionChanged extends Error {}
export function calendarExpected(request: Request, actor: AuthenticatedIdentity) { if (request.headers.get("x-expected-user-id") !== actor.userId) throw new CalendarSessionChanged(); }
export function calendarOrigin(request: Request, origin: string) { if (!sameOrigin(request.headers.get("origin"), origin)) throw new AuthGuardError("forbidden"); if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ErroDeDominio("VALIDATION", "Envie uma operação JSON."); }
export async function calendarBody(request: Request) {
 const reader = request.body?.getReader(); if (!reader) throw new ErroDeDominio("VALIDATION", "Informe a operação."); let size = 0; const chunks: Uint8Array[] = [];
 try { while (true) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength; if (size > 64 * 1024) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "Operação muito grande."); } chunks.push(item.value); } try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; } catch { throw new ErroDeDominio("VALIDATION", "Operação inválida."); } } finally { reader.releaseLock(); }
}
export function calendarFailure(error: unknown, headers: Headers) {
 let status = 503, code = "UNAVAILABLE", message = "Não foi possível confirmar a agenda. Tente novamente; a configuração da integração pode precisar de revisão.";
 if (error instanceof CalendarSessionChanged) { status = 409; code = "SESSION_CHANGED"; message = "A conta mudou. Recarregue a página antes de continuar."; }
 else if (error instanceof AuthGuardError) { status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503; code = status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : code; message = status === 401 ? "Entre novamente para continuar." : status === 403 ? "Esta operação não está disponível para sua conta." : message; }
 else if (error instanceof ErroDeDominio) { status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400; code = error.code; message = error.message; }
 else if (error instanceof CalendarProviderError) { status = error.kind === "quota" ? 429 : error.kind === "reauthorize" ? 409 : 503; code = error.kind === "quota" ? "RATE_LIMITED" : error.kind === "reauthorize" ? "REAUTHORIZE" : code; message = error.kind === "quota" ? "Aguarde antes de sincronizar novamente." : error.kind === "reauthorize" ? "Reconecte a conta Google para renovar o acesso de leitura." : message; if (status === 429) headers.set("Retry-After", "60"); }
 return NextResponse.json({ ok: false, code, message }, { status, headers });
}
