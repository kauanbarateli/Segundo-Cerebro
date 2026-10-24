import "server-only";
import { NextResponse } from "next/server";
import { ErroDeDominio } from "../../core/contracts/base";
import type { GoalCommand } from "../../core/financeiro/goals/goal-types";
import { decodeGoalCommand, goalTimestamp, goalUuid } from "../../core/financeiro/goals/goal-validation";
import type { GoalHistoryQuery, GoalPageQuery } from "./finance-goals-protocol";
import { CommitOutcomeUnknown } from "./capture-task-store";
import { FinanceRateLimitError } from "./finance-gateway";
import { readAuthConfiguration } from "../../lib/auth/config";
import { requestAuthServices } from "../../lib/auth/runtime";
import { assertFeature, sameOrigin } from "../../lib/auth/policy";
import { AuthGuardError } from "../../lib/auth/types";
import { GOAL_HTTP_EXPECTED_OWNER_HEADER, GOAL_HTTP_LIMITS, GOAL_HTTP_QUERY_KEYS, type GoalHttpFailureCode } from "../../lib/finance-goals-http-contract";

class SessionChanged extends Error {}
export class GoalReceiptPending extends Error {}
function invalid(): never { throw new ErroDeDominio("VALIDATION", "Operação de Metas inválida."); }
export function goalHttpHeaders(): Headers {
  return new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie", "X-Content-Type-Options": "nosniff" });
}
export async function authorizeGoalHttp(request: Request, headers: Headers, post = false) {
  const config = readAuthConfiguration();
  if (config.mode !== "supabase") throw new AuthGuardError("demo");
  if (post) {
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden");
    if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(request.headers.get("content-type")?.trim() ?? "")) invalid();
    const encoding = request.headers.get("content-encoding");
    if (encoding !== null && encoding.trim().toLowerCase() !== "identity") invalid();
  }
  const actor = await (await requestAuthServices(true, headers)).gateway.readIdentity();
  if (!actor) throw new AuthGuardError("unauthenticated");
  if (actor.mustChangePassword) throw new AuthGuardError("forbidden");
  assertFeature(actor, "financeiro");
  const expected = request.headers.get(GOAL_HTTP_EXPECTED_OWNER_HEADER);
  goalUuid(expected);
  if (expected !== actor.userId) throw new SessionChanged();
  return { config, actor };
}
export function goalHttpNoQuery(request: Request): void {
  if (new URL(request.url).search) invalid();
}
export type GoalHttpQuery = { view: "page"; query: GoalPageQuery } | { view: "detail"; id: string } | { view: "reservations" | "releases"; query: GoalHistoryQuery };
export function goalHttpQuery(request: Request): GoalHttpQuery {
  const url = new URL(request.url);
  if (Buffer.byteLength(url.search, "utf8") > GOAL_HTTP_LIMITS.requestBytes) invalid();
  const params = url.searchParams, keys = [...params.keys()], view = params.get("view");
  if (new Set(keys).size !== keys.length || !["page", "detail", "reservations", "releases"].includes(view ?? "")) invalid();
  const allowed: readonly string[] = GOAL_HTTP_QUERY_KEYS[view as keyof typeof GOAL_HTTP_QUERY_KEYS];
  if (keys.some(key => !allowed.includes(key))) invalid();
  if (view === "detail") { const id = params.get("id"); goalUuid(id); return { view, id }; }
  const rawLimit = params.get("limit");
  if (rawLimit !== null && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(rawLimit)) invalid();
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  if (view === "page") {
    const cursor = params.get("cursor"), archived = params.get("archived") ?? "active";
    if (cursor !== null) goalUuid(cursor);
    if (archived !== "active" && archived !== "archived" && archived !== "all") invalid();
    return { view, query: { cursor, limit, archived } };
  }
  const id = params.get("id"), at = params.get("cursor_at"), cursorId = params.get("cursor_id");
  goalUuid(id);
  if ((at === null) !== (cursorId === null)) invalid();
  if (at !== null) { goalTimestamp(at); goalUuid(cursorId); }
  return { view: view as "reservations" | "releases", query: { id, limit, cursor: at === null ? null : { created_at: at, id: cursorId! } } };
}
/** Native JSON.parse owns syntax/values. This bounded walk only checks duplicate
 * decoded keys and container/property limits in the already valid JSON text. */
function closedJson(text: string): unknown {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return invalid(); }
  let index = 0, properties = 0;
  const space = () => { while (/[ \t\r\n]/.test(text[index] ?? "") && index < text.length) index++; };
  function stringToken(): string {
    const start = index++;
    while (index < text.length) {
      if (text[index] === "\\") index += 2;
      else if (text[index++] === '"') return text.slice(start, index);
    }
    return invalid();
  }
  function walk(depth: number): void {
    space(); const token = text[index];
    if (token === "{" || token === "[") {
      if (depth > 4) invalid();
      const object = token === "{", close = object ? "}" : "]", names = new Set<string>(); index++; space();
      if (text[index] === close) { index++; return; }
      while (index < text.length) {
        if (object) {
          const name: unknown = JSON.parse(stringToken());
          if (typeof name !== "string" || names.has(name) || ++properties > 32) invalid();
          names.add(name); space(); if (text[index++] !== ":") invalid();
        }
        walk(depth + 1); space();
        if (text[index] === close) { index++; return; }
        if (text[index++] !== ",") invalid(); space();
      }
      invalid();
    } else if (token === '"') stringToken();
    else { while (index < text.length && !/[ \t\r\n,\]}]/.test(text[index]!)) index++; }
  }
  walk(1); space(); if (index !== text.length) invalid(); return value;
}
export async function goalHttpCommand(request: Request): Promise<GoalCommand> {
  if (request.signal.aborted) throw new AuthGuardError("unavailable");
  const reader = request.body?.getReader(); if (!reader) return invalid();
  const parts: Uint8Array[] = []; let length = 0, naturalEof = false, failed = false;
  const deadline = Date.now() + 15_000;
  let rejectStopped!: (error: Error) => void, cancellation: Promise<void> | null = null;
  let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;
  const stopped = new Promise<never>((_, reject) => { rejectStopped = reject; });
  const cancel = () => { if (cancellation === null) { try { cancellation = reader.cancel().catch(() => undefined); } catch { cancellation = Promise.resolve(); } } };
  const stop = () => { if (!failed) { failed = true; rejectStopped(new AuthGuardError("unavailable")); cancel(); } };
  const timer = setTimeout(stop, 15_000);
  request.signal.addEventListener("abort", stop, { once: true });
  try {
    if (request.signal.aborted) stop();
    while (true) {
      pendingRead = reader.read();
      const next = await Promise.race([pendingRead, stopped]); pendingRead = null;
      if (failed || request.signal.aborted || Date.now() >= deadline) { stop(); throw new AuthGuardError("unavailable"); }
      if (next.done) { naturalEof = true; break; }
      length += next.value.byteLength;
      if (length > GOAL_HTTP_LIMITS.requestBytes) { cancel(); return invalid(); }
      if (next.value.byteLength) parts.push(next.value);
    }
    const bytes = Buffer.concat(parts);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return invalid();
    let decoded: unknown;
    try { decoded = closedJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return invalid(); }
    const command = decodeGoalCommand(decoded);
    if (failed || request.signal.aborted || Date.now() >= deadline) throw new AuthGuardError("unavailable");
    return command;
  } finally {
    clearTimeout(timer); request.signal.removeEventListener("abort", stop);
    if (!naturalEof) cancel();
    // A hostile/failed underlying cancel may never settle. Do not await it or
    // extend the deadline; release when the outstanding read itself terminates.
    const release = () => { try { reader.releaseLock(); } catch { /* pending read owns the retry below */ } };
    release(); if (pendingRead) void pendingRead.then(release, release);
  }
}
function reply(payload: unknown, result: unknown, headers: Headers): NextResponse {
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > GOAL_HTTP_LIMITS.innerDtoBytes || Buffer.byteLength(JSON.stringify(payload), "utf8") > GOAL_HTTP_LIMITS.responseBytes) throw new Error("GOAL_HTTP_RESPONSE_REFUSED");
  return NextResponse.json(payload, { headers });
}
export function goalHttpRead<T>(result: T, headers: Headers): NextResponse {
  return reply({ ok: true, result }, result, headers);
}
export function goalHttpBound<T>(intent: GoalCommand, result: T, headers: Headers): NextResponse {
  return reply({ ok: true, binding: { version: 1, command: intent.command, client_id: intent.input.client_id }, result }, result, headers);
}
export function goalHttpFailure(error: unknown, headers: Headers, executing = false): NextResponse {
  let status = 503, code: GoalHttpFailureCode = executing ? "uncertain" : "unavailable", message = "Não foi possível conferir Metas. Preserve a tentativa para consultar depois.";
  if (error instanceof SessionChanged) { status = 409; code = "session-changed"; message = "A conta mudou. Reabra Metas para continuar."; }
  else if (error instanceof GoalReceiptPending || error instanceof CommitOutcomeUnknown) { code = "uncertain"; message = "Ainda não há confirmação desta tentativa. Consulte o mesmo conteúdo depois."; }
  else if (error instanceof AuthGuardError) {
    status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503;
    code = status === 503 ? "unavailable" : "forbidden"; message = "Esta operação não está disponível nesta sessão.";
  } else if (error instanceof FinanceRateLimitError) { status = 429; code = "unavailable"; message = "Aguarde antes de consultar Metas novamente."; headers.set("Retry-After", "60"); }
  else if (error instanceof ErroDeDominio && ["VALIDATION", "CONFLICT", "NOT_FOUND"].includes(error.code)) {
    status = error.code === "CONFLICT" ? 409 : 400;
    code = error.code === "CONFLICT" ? "conflict" : "validation"; message = code === "conflict" ? "Os dados mudaram. Confira a revisão atual antes de preparar outra operação." : "Confira os dados da operação de Metas.";
  }
  return NextResponse.json({ ok: false, code, message }, { status, headers });
}
