import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ErroDeDominio } from "@/core/contracts";
import { CommitOutcomeUnknown } from "@/adapters/db/capture-task-store";
import { createFinanceStore } from "@/adapters/db/finance-store";
import { decodeFinanceRequest, executeFinanceCommand } from "@/adapters/db/finance-commands";
import { financeGatewayForRequest } from "@/adapters/db/finance-runtime";
import { FinanceRateLimitError } from "@/adapters/db/finance-gateway";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { AuthGuardError, type AuthenticatedIdentity } from "@/lib/auth/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = () => new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
class SessionChanged extends Error {}
function requireSameAccount(request: Request, actor: AuthenticatedIdentity) {
  const expected = request.headers.get("x-expected-user-id");
  if (!expected || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expected)) throw new ErroDeDominio("VALIDATION", "Recarregue a página para confirmar sua conta.");
  if (expected !== actor.userId) throw new SessionChanged();
}
async function identity(responseHeaders: Headers) {
  const current = await (await requestAuthServices(true, responseHeaders)).gateway.readIdentity();
  if (!current) throw new AuthGuardError("unauthenticated"); if (current.mustChangePassword) throw new AuthGuardError("forbidden"); assertFeature(current, "financeiro"); return current;
}
function failure(error: unknown, responseHeaders: Headers) {
  let status = 503, code = "UNAVAILABLE", message = "Não foi possível concluir a operação. Tente novamente.";
  if (error instanceof SessionChanged) { status = 409; code = "SESSION_CHANGED"; message = "A conta mudou em outra aba. Recarregue a página."; }
  else if (error instanceof FinanceRateLimitError) { status = 429; code = "RATE_LIMITED"; message = error.message; responseHeaders.set("Retry-After", "60"); }
  else if (error instanceof AuthGuardError) { status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503; code = error.code.toUpperCase(); message = status === 401 ? "Entre novamente para continuar." : status === 403 ? "Esta operação não está disponível para sua conta." : message; }
  else if (error instanceof CommitOutcomeUnknown) { code = "COMMIT_UNKNOWN"; message = error.message; }
  else if (error instanceof ErroDeDominio) { code = error.code; message = error.message; status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400; }
  else if (error instanceof RangeError) { status = 400; code = "VALIDATION"; message = "Revise os valores e as datas da operação."; }
  return NextResponse.json({ ok: false, code, message }, { status, headers: responseHeaders });
}
async function body(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new ErroDeDominio("VALIDATION", "Informe a operação.");
  let size = 0; const parts: Uint8Array[] = [];
  try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 256 * 1024) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "A operação excede o tamanho permitido."); } parts.push(next.value); } try { return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown; } catch { throw new ErroDeDominio("VALIDATION", "Operação inválida."); } }
  finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
  const responseHeaders = headers();
  try { const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo"); const actor = await identity(responseHeaders); requireSameAccount(request, actor);
    return NextResponse.json(await financeGatewayForRequest(config, actor, "read.finance").presentation(), { headers: responseHeaders });
  } catch (error) { return failure(error, responseHeaders); }
}
export async function POST(request: Request) {
  const responseHeaders = headers();
  try {
    const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden");
    if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ErroDeDominio("VALIDATION", "Envie uma operação JSON.");
    const actor = await identity(responseHeaders); requireSameAccount(request, actor); const command = decodeFinanceRequest(await body(request));
    const result = await executeFinanceCommand(createFinanceStore(financeGatewayForRequest(config, actor, command.command)), { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: actor.userId, canal: "web" }, command);
    return NextResponse.json({ ok: true, result }, { headers: responseHeaders });
  } catch (error) { return failure(error, responseHeaders); }
}
