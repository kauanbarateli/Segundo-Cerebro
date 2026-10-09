import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { conhecimentoDTO, executarConhecimento, leituraPagina, leituraRelacionados, TIPOS_VINCULO, type TipoVinculo } from "@/core/conhecimento";
import type { FeatureKey } from "@/core/access/resolve-access";
import { ErroDeDominio } from "@/core/contracts/base";
import { decodeKnowledgeCommand } from "@/adapters/db/knowledge-commands";
import { knowledgeGatewayForRequest } from "@/adapters/db/knowledge-runtime";
import { createKnowledgeStore, KnowledgeCommitUnknown } from "@/adapters/db/knowledge-store";
import { KnowledgeRateLimitError } from "@/adapters/db/knowledge-gateway";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { AuthGuardError, type AuthenticatedIdentity } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = () => new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
class DifferentAccount extends Error {}
async function actor(request: Request, headers: Headers): Promise<AuthenticatedIdentity> {
  const identity = await (await requestAuthServices(true, headers)).gateway.readIdentity();
  if (!identity) throw new AuthGuardError("unauthenticated"); if (identity.mustChangePassword) throw new AuthGuardError("forbidden");
  const expected = request.headers.get("x-expected-user-id"); if (!expected) throw new ErroDeDominio("VALIDATION", "Recarregue a página para confirmar sua conta."); if (expected !== identity.userId) throw new DifferentAccount();
  assertFeature(identity, "conhecimento"); return identity;
}
function failure(error: unknown, headers: Headers) {
  let status = 503, code = "UNAVAILABLE", message = "Não foi possível concluir a operação. Tente novamente.";
  if (error instanceof DifferentAccount) { status = 409; code = "SESSION_CHANGED"; message = "A conta mudou. Recarregue a página para continuar."; }
  else if (error instanceof AuthGuardError) { status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503; code = error.code.toUpperCase(); message = status === 401 ? "Entre novamente para continuar." : status === 403 ? "Esta operação não está disponível para sua conta." : message; }
  else if (error instanceof ErroDeDominio) { status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400; code = error.code; message = error.message; }
  else if (error instanceof KnowledgeCommitUnknown) { code = "COMMIT_UNKNOWN"; message = error.message; }
  else if (error instanceof KnowledgeRateLimitError) { status = 429; code = "RATE_LIMITED"; message = error.message; headers.set("Retry-After", "60"); }
  return NextResponse.json({ ok: false, code, message }, { status, headers });
}
async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader(); if (!reader) throw new ErroDeDominio("VALIDATION", "Informe a operação.");
  let size = 0; const parts: Uint8Array[] = [];
  try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 600 * 1024) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "O documento excede o limite de envio."); } parts.push(next.value); } try { return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown; } catch { throw new ErroDeDominio("VALIDATION", "Operação inválida."); } } finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
  const headers = privateHeaders();
  try { const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo"); const identity = await actor(request, headers);
    const params = new URL(request.url).searchParams, relatedType = params.get("related_type"), relatedId = params.get("related_id");
    if (relatedType || relatedId) {
      if (!relatedId || !TIPOS_VINCULO.includes(relatedType as TipoVinculo)) throw new ErroDeDominio("VALIDATION", "Informe o tipo e o registro relacionado.");
      const sourceFeature: Record<TipoVinculo, FeatureKey> = { page: "conhecimento", notebook: "conhecimento", task: "tarefas", capture: "capturar", event: "calendario", file: "drive", project: "projetos", transaction: "financeiro", habit: "habitos" };
      assertFeature(identity, sourceFeature[relatedType as TipoVinculo]);
    }
    const store = createKnowledgeStore(knowledgeGatewayForRequest(config, identity, "read.knowledge")), state = await store.snapshot();
    const pageId = params.get("page"); return NextResponse.json(relatedType && relatedId ? leituraRelacionados(state, relatedType as TipoVinculo, relatedId) : pageId ? leituraPagina(state, pageId) : conhecimentoDTO(state), { headers });
  } catch (error) { return failure(error, headers); }
}
export async function POST(request: Request) {
  const headers = privateHeaders();
  try { const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo"); if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden"); if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ErroDeDominio("VALIDATION", "Envie uma operação JSON.");
    const identity = await actor(request, headers), command = decodeKnowledgeCommand(await readBody(request));
    if (command.command === "knowledge.page.promote-capture") assertFeature(identity, "capturar");
    const store = createKnowledgeStore(knowledgeGatewayForRequest(config, identity, command.command)); const result = await executarConhecimento(store, { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: identity.userId, canal: "web" }, command);
    return NextResponse.json({ ok: true, result }, { headers });
  } catch (error) { return failure(error, headers); }
}
