import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ErroDeDominio } from "@/core/contracts/base";
import { decodeRoutineRequest, executeRoutineCommand } from "@/adapters/db/projects-habits-commands";
import { createRoutineStore } from "@/adapters/db/projects-habits-store";
import { routineGatewayForRequest } from "@/adapters/db/projects-habits-runtime";
import { RoutineRateLimitError } from "@/adapters/db/projects-habits-gateway";
import { CommitOutcomeUnknown } from "@/adapters/db/capture-task-store";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { AuthGuardError } from "@/lib/auth/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = () => new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
class SessionChanged extends Error {}
async function actor(request: Request, headers: Headers, feature: "projetos" | "habitos") {
  const identity = await (await requestAuthServices(true, headers)).gateway.readIdentity(); if (!identity) throw new AuthGuardError("unauthenticated"); if (identity.mustChangePassword) throw new AuthGuardError("forbidden");
  const expected = request.headers.get("x-expected-user-id"); if (!expected) throw new ErroDeDominio("VALIDATION", "Recarregue a página para confirmar sua conta."); if (expected !== identity.userId) throw new SessionChanged(); assertFeature(identity, feature); return identity;
}
function failure(error: unknown, headers: Headers) {
  let status = 503, code = "UNAVAILABLE", message = "Não foi possível concluir a operação. Tente novamente.";
  if (error instanceof SessionChanged) { status = 409; code = "SESSION_CHANGED"; message = "A conta mudou. Recarregue a página para continuar."; }
  else if (error instanceof AuthGuardError) { status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503; code = error.code.toUpperCase(); message = status === 401 ? "Entre novamente para continuar." : status === 403 ? "Esta operação não está disponível para sua conta." : message; }
  else if (error instanceof ErroDeDominio) { status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400; code = error.code; message = error.message; }
  else if (error instanceof CommitOutcomeUnknown) { code = "COMMIT_UNKNOWN"; message = error.message; }
  else if (error instanceof RoutineRateLimitError) { status = 429; code = "RATE_LIMITED"; message = error.message; headers.set("Retry-After", "60"); }
  return NextResponse.json({ ok: false, code, message }, { status, headers });
}
async function body(request: Request): Promise<unknown> {
  const reader = request.body?.getReader(); if (!reader) throw new ErroDeDominio("VALIDATION", "Informe a operação."); let size = 0; const parts: Uint8Array[] = [];
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 64 * 1024) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "A operação excede o limite de envio."); } parts.push(part.value); } try { return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown; } catch { throw new ErroDeDominio("VALIDATION", "Informe uma operação JSON válida."); } } finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
  const headers = privateHeaders(); try { const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo"); const domain = new URL(request.url).searchParams.get("domain"); if (domain !== "projects" && domain !== "habits") throw new ErroDeDominio("VALIDATION", "Informe projects ou habits."); const identity = await actor(request, headers, domain === "projects" ? "projetos" : "habitos"); const state = await routineGatewayForRequest(config, identity, domain === "projects" ? "read.projects" : "read.habits").snapshot();
    return NextResponse.json(domain === "projects" ? { items: state.projects, containers: state.containers } : { items: state.habits, entries: state.entries, pauses: state.pauses }, { headers });
  } catch (error) { return failure(error, headers); }
}
export async function POST(request: Request) {
  const headers = privateHeaders(); try { const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo"); if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden"); if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ErroDeDominio("VALIDATION", "Envie uma operação JSON."); const command = decodeRoutineRequest(await body(request)); const identity = await actor(request, headers, command.command.startsWith("project.") ? "projetos" : "habitos");
    const gateway = routineGatewayForRequest(config, identity, command.command);
    if (command.command === "project.container.create" || command.command === "project.container.link" || command.command === "project.container.unlink") { const kind = command.command === "project.container.create" ? command.input.kind : (await gateway.snapshot()).containers.find(row => row.id === command.input.id)?.kind; if (kind) assertFeature(identity, kind === "capture" ? "capturar" : kind === "notebook" ? "conhecimento" : "drive"); }
    const result = await executeRoutineCommand(createRoutineStore(gateway), { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: identity.userId, canal: "web" }, command); return NextResponse.json({ ok: true, result }, { headers });
  } catch (error) { return failure(error, headers); }
}
