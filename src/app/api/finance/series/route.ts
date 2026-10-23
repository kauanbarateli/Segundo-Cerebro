import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ErroDeDominio } from "@/core/contracts/base";
import { decodeFinanceSeriesCommand } from "@/core/financeiro/series/series-validation";
import { executeFinanceSeriesCommand } from "@/core/financeiro/series/series-use-cases";
import { createFinanceSeriesStore } from "@/adapters/db/finance-series-store";
import { financeSeriesGatewayForRequest } from "@/adapters/db/finance-series-runtime";
import { requireFinanceSeriesAvailable } from "@/adapters/db/finance-series-availability";
import { seriesUuid } from "@/adapters/db/finance-series-protocol";
import { CommitOutcomeUnknown } from "@/adapters/db/capture-task-store";
import { FinanceRateLimitError } from "@/adapters/db/finance-gateway";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { AuthGuardError, type AuthenticatedIdentity } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = () => new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
class SessionChanged extends Error {}
function expectedOwner(request: Request, actor: AuthenticatedIdentity) {
  const expected = request.headers.get("x-expected-user-id");
  if (!seriesUuid(expected)) throw new ErroDeDominio("VALIDATION", "Recarregue a página para confirmar sua conta.");
  if (expected !== actor.userId) throw new SessionChanged();
}
async function identity(responseHeaders: Headers) {
  const actor = await (await requestAuthServices(true, responseHeaders)).gateway.readIdentity();
  if (!actor) throw new AuthGuardError("unauthenticated"); if (actor.mustChangePassword) throw new AuthGuardError("forbidden"); assertFeature(actor, "financeiro"); return actor;
}
function failure(error: unknown, responseHeaders: Headers) {
  let status = 503, code = "UNAVAILABLE", message = "Não foi possível concluir a operação. Tente novamente.";
  if (error instanceof SessionChanged) { status = 409; code = "SESSION_CHANGED"; message = "A conta mudou em outra aba. Recarregue a página."; }
  else if (error instanceof AuthGuardError) { status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503; code = status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "UNAVAILABLE"; message = status === 401 ? "Entre novamente para continuar." : status === 403 ? "Esta operação não está disponível para sua conta." : message; }
  else if (error instanceof CommitOutcomeUnknown) { code = "COMMIT_UNKNOWN"; message = "A confirmação ainda não está disponível. Preserve esta tentativa para consultar ou reenviar o mesmo conteúdo."; }
  else if (error instanceof FinanceRateLimitError) { status = 429; code = "RATE_LIMITED"; message = "Aguarde um pouco antes de tentar novamente."; responseHeaders.set("Retry-After", "60"); }
  else if (error instanceof ErroDeDominio) { const known = ["VALIDATION", "CONFLICT", "NOT_FOUND"].includes(error.code); if (known) { code = error.code; message = error.message; status = code === "CONFLICT" ? 409 : code === "NOT_FOUND" ? 404 : 400; } }
  else if (error instanceof RangeError) { status = 400; code = "VALIDATION"; message = "Revise os valores e as datas da operação."; }
  return NextResponse.json({ ok: false, code, message }, { status, headers: responseHeaders });
}
async function body(request: Request): Promise<unknown> {
  const reader = request.body?.getReader(); if (!reader) throw new ErroDeDominio("VALIDATION", "Informe a operação.");
  const parts: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > 64 * 1024) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "A operação excede o tamanho permitido."); } parts.push(next.value); }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts))); } catch { throw new ErroDeDominio("VALIDATION", "Operação inválida."); }
  } finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
  const responseHeaders = headers();
  try {
    const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo"); const actor = await identity(responseHeaders); expectedOwner(request, actor); requireFinanceSeriesAvailable();
    const params = new URL(request.url).searchParams, keys = [...params.keys()];
    if (new Set(keys).size !== keys.length || keys.some(key => !["series_id", "cursor", "limit"].includes(key))) throw new ErroDeDominio("VALIDATION", "Consulta de séries inválida.");
    if (params.has("series_id")) {
      const id = params.get("series_id"); if (!seriesUuid(id) || keys.length !== 1) throw new ErroDeDominio("VALIDATION", "Consulta de série inválida.");
      const gateway = financeSeriesGatewayForRequest(config, actor, "read.finance.series");
      const result = await gateway.detail(id); if (result === null) throw new ErroDeDominio("NOT_FOUND", "Esta série não está disponível.");
      return NextResponse.json({ ok: true, result }, { headers: responseHeaders });
    }
    const cursor = params.get("cursor"), rawLimit = params.get("limit"), limit = rawLimit === null ? 20 : Number(rawLimit);
    if ((cursor !== null && !seriesUuid(cursor)) || (rawLimit !== null && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(rawLimit))) throw new ErroDeDominio("VALIDATION", "Paginação de séries inválida.");
    const gateway = financeSeriesGatewayForRequest(config, actor, "read.finance.series");
    return NextResponse.json({ ok: true, result: await gateway.page({ cursor, limit }) }, { headers: responseHeaders });
  } catch (error) { return failure(error, responseHeaders); }
}
export async function POST(request: Request) {
  const responseHeaders = headers();
  try {
    const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden");
    if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ErroDeDominio("VALIDATION", "Envie uma operação JSON.");
    const actor = await identity(responseHeaders); expectedOwner(request, actor); requireFinanceSeriesAvailable(); const command = decodeFinanceSeriesCommand(await body(request));
    const gateway = financeSeriesGatewayForRequest(config, actor, command.command), result = await executeFinanceSeriesCommand(createFinanceSeriesStore(gateway, command), { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: actor.userId, canal: "web" }, command);
    return NextResponse.json({ ok: true, result }, { headers: responseHeaders });
  } catch (error) { return failure(error, responseHeaders); }
}
