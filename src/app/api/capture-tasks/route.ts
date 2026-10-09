import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ErroDeDominio } from "@/core/contracts";
import { createCaptureTaskStore, CommitOutcomeUnknown } from "@/adapters/db/capture-task-store";
import { decodeCaptureTaskRequest, executeCaptureTaskCommand } from "@/adapters/db/capture-task-commands";
import { captureTaskGatewayForRequest } from "@/adapters/db/capture-task-runtime";
import { CaptureTaskRateLimitError } from "@/adapters/db/capture-task-gateway";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { AuthGuardError, type AuthenticatedIdentity } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const LIMIT = 256 * 1024;
const headers = () => new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
class SessionChanged extends Error {}
function requireSameAccount(request: Request, actor: AuthenticatedIdentity) {
  const expected = request.headers.get("x-expected-user-id");
  if (!expected || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(expected)) throw new ErroDeDominio("VALIDATION", "Recarregue a página para confirmar sua conta.");
  // This is a stale-page precondition, never authority to select a user.
  if (expected !== actor.userId) throw new SessionChanged();
}
function json(value: unknown, status: number, responseHeaders: Headers) { return NextResponse.json(value, { status, headers: responseHeaders }); }
async function identity(responseHeaders: Headers): Promise<AuthenticatedIdentity> {
  const current = await (await requestAuthServices(true, responseHeaders)).gateway.readIdentity();
  if (!current) throw new AuthGuardError("unauthenticated");
  if (current.mustChangePassword) throw new AuthGuardError("forbidden");
  return current;
}
function failure(error: unknown, responseHeaders: Headers) {
  if (error instanceof SessionChanged) return json({ ok: false, code: "SESSION_CHANGED", message: "A conta mudou em outra aba. Recarregue a página para continuar." }, 409, responseHeaders);
  if (error instanceof CaptureTaskRateLimitError) { responseHeaders.set("Retry-After", "60"); return json({ ok: false, code: "RATE_LIMITED", message: error.message }, 429, responseHeaders); }
  if (error instanceof AuthGuardError) {
    const status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503;
    return json({ ok: false, code: error.code.toUpperCase(), message: status === 401 ? "Entre novamente para continuar." : status === 403 ? "Esta operação não está disponível para sua conta." : "Não foi possível acessar os dados. Tente novamente." }, status, responseHeaders);
  }
  if (error instanceof CommitOutcomeUnknown) return json({ ok: false, code: "COMMIT_UNKNOWN", message: error.message }, 503, responseHeaders);
  if (error instanceof ErroDeDominio) return json({ ok: false, code: error.code, message: error.message }, error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400, responseHeaders);
  // Never return SDK exceptions, SQL, cookies, keys or raw request bodies.
  return json({ ok: false, code: "UNAVAILABLE", message: "Não foi possível concluir a operação. Tente novamente." }, 503, responseHeaders);
}
async function body(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ErroDeDominio("VALIDATION", "Informe a operação.");
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > LIMIT) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "A operação excede o tamanho permitido."); }
      parts.push(next.value);
    }
    try { return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown; }
    catch { throw new ErroDeDominio("VALIDATION", "Operação inválida."); }
  } finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
  const responseHeaders = headers();
  try {
    const query = new URL(request.url).searchParams.get("query");
    if (query !== "captures" && query !== "tasks") throw new ErroDeDominio("VALIDATION", "Consulta inválida.");
    const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
    const actor = await identity(responseHeaders); requireSameAccount(request, actor); assertFeature(actor, query === "captures" ? "capturar" : "tarefas");
    const { snapshot, projectsVisible } = await captureTaskGatewayForRequest(config, actor, query === "captures" ? "read.captures" : "read.tasks").presentation();
    return json({ items: query === "captures" ? snapshot.captures : snapshot.tasks, categories: snapshot.categories, projects: projectsVisible ? snapshot.projects.filter(project => !project.deleted_at) : [], ...(query === "captures" && snapshot.readonlyCaptureIds !== undefined ? { readonlyCaptureIds: snapshot.readonlyCaptureIds } : {}) }, 200, responseHeaders);
  } catch (error) { return failure(error, responseHeaders); }
}
export async function POST(request: Request) {
  const responseHeaders = headers();
  try {
    const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden");
    if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ErroDeDominio("VALIDATION", "Envie uma operação JSON.");
    const actor = await identity(responseHeaders);
    requireSameAccount(request, actor);
    const command = decodeCaptureTaskRequest(await body(request));
    assertFeature(actor, command.command.startsWith("capture.") ? "capturar" : "tarefas");
    if (command.command === "capture.convert") assertFeature(actor, "tarefas");
    const store = createCaptureTaskStore(captureTaskGatewayForRequest(config, actor, command.command));
    const result = await executeCaptureTaskCommand(store, { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: actor.userId, canal: "web" }, command);
    return json({ ok: true, result }, 200, responseHeaders);
  } catch (error) { return failure(error, responseHeaders); }
}
