import { NextResponse } from "next/server";
import { AdminAuthUncertainError, executeAdminCommand } from "@/core/admin";
import { ErroDeDominio } from "@/core/contracts";
import { adminServicesForRequest } from "@/adapters/db/admin-runtime";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { AuthGuardError, type AuthenticatedIdentity } from "@/lib/auth/types";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function headers() { return new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" }); }
async function requireMaster() {
 const actor = await (await requestAuthServices()).gateway.readIdentity();
 if (!actor) throw new AuthGuardError("unauthenticated"); if (actor.mustChangePassword || actor.role !== "master") throw new AuthGuardError("forbidden"); assertFeature(actor, "admin"); return actor;
}
function expectedUser(request: Request, actor: AuthenticatedIdentity) {
 if (request.headers.get("x-expected-user-id") !== actor.userId) throw new ErroDeDominio("CONFLICT", "A conta mudou. Recarregue antes de continuar.");
}
function failure(error: unknown) {
 const status = error instanceof AuthGuardError ? error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503 : error instanceof ErroDeDominio ? error.code === "CONFLICT" ? 409 : 400 : 503;
 const message = error instanceof AdminAuthUncertainError ? error.message : error instanceof ErroDeDominio ? error.message : status === 401 ? "Entre novamente." : status === 403 ? "Esta operação exige acesso de master." : "Não foi possível confirmar a operação. Ela permanece protegida; confira o estado e retome apenas quando a execução anterior tiver terminado.";
 return NextResponse.json({ ok: false, code: error instanceof ErroDeDominio ? error.code : status === 403 ? "FORBIDDEN" : "UNAVAILABLE", message }, { status, headers: headers() });
}
async function body(request: Request) {
 const reader = request.body?.getReader(); if (!reader) throw new ErroDeDominio("VALIDATION", "Informe a operação."); let size = 0; const chunks: Uint8Array[] = [];
 try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 64 * 1024) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "Operação muito grande."); } chunks.push(next.value); } try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; } catch { throw new ErroDeDominio("VALIDATION", "Operação inválida."); } } finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
 try {
  const actor = await requireMaster();
  expectedUser(request, actor);
  const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
  return NextResponse.json(await adminServicesForRequest(config, actor).port.snapshot(), { headers: headers() });
 } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
 try {
  const actor = await requireMaster();
  expectedUser(request, actor);
  const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
  if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden");
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ErroDeDominio("VALIDATION", "Envie JSON.");
  const services = adminServicesForRequest(config, actor), result = await executeAdminCommand(services.port, services.auth, services.commitment, await body(request));
  return NextResponse.json({ ok: true, result }, { headers: headers() });
 } catch (error) { return failure(error); }
}
