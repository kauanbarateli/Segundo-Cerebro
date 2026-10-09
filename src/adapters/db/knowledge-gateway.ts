import "server-only";
import { ErroDeDominio, exigir, instanteValido } from "../../core/contracts/base";
import { TIPOS_VINCULO, validarDocumento } from "../../core/conhecimento";
import type { SnapshotConhecimento } from "../../core/conhecimento/types";
import type { ReciboIdempotente } from "../../core/contracts/unit-of-work";
import { AuthGuardError } from "../../lib/auth/types";
import { KnowledgeCommitUnknown, validateKnowledgeSnapshot, type KnowledgeCommit, type KnowledgeGateway } from "./knowledge-store";

export type KnowledgeRpcName = "knowledge_snapshot" | "knowledge_commit" | "knowledge_receipt";
export interface KnowledgeRpcArguments { p_user: string; p_session: string; p_operation: string; p_request?: KnowledgeCommit; p_command?: string; p_client_id?: string }
export type KnowledgeRpc = (name: KnowledgeRpcName, args: KnowledgeRpcArguments) => Promise<{ data: unknown; error: { code?: string } | null }>;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const optionalId = (value: unknown) => value === null || uuid(value);
const timestamp = (value: unknown) => typeof value === "string" && instanteValido(value);
const nullableTimestamp = (value: unknown) => value === null || timestamp(value);
const ensure = (value: unknown): void => { if (!value) throw new AuthGuardError("unavailable"); };
export function parseKnowledgeSnapshot(value: unknown, actor: string): SnapshotConhecimento {
  ensure(record(value)); const row = value as Record<string, unknown>;
  ensure(Object.keys(row).every(key => ["revision", "notebooks", "pages", "refs", "links", "targets", "captures", "receipts"].includes(key)));
  let count = 0;
  for (const key of ["notebooks", "pages", "refs", "links", "captures", "receipts", "targets"]) { ensure(Array.isArray(row[key])); count += (row[key] as unknown[]).length; }
  ensure(count <= 10000 && Buffer.byteLength(JSON.stringify(value), "utf8") <= 8 * 1024 * 1024);
  const common = (item: unknown): Record<string, unknown> => { ensure(record(item) && uuid(item.id) && item.user_id === actor); return item as Record<string, unknown>; };
  for (const item of row.notebooks as unknown[]) { const entry = common(item); ensure(typeof entry.name === "string" && optionalId(entry.project_id) && Number.isSafeInteger(entry.position) && nullableTimestamp(entry.deleted_at) && optionalId(entry.deletion_batch_id) && timestamp(entry.created_at) && timestamp(entry.updated_at)); }
  for (const item of row.pages as unknown[]) {
    const entry = common(item); ensure(uuid(entry.notebook_id) && optionalId(entry.parent_id) && optionalId(entry.origin_capture_id) && typeof entry.title === "string" && typeof entry.normalized_title === "string" && typeof entry.content_text === "string" && Number.isSafeInteger(entry.version) && Number(entry.version) > 0 && Number.isSafeInteger(entry.position) && nullableTimestamp(entry.archived_at) && nullableTimestamp(entry.deleted_at) && optionalId(entry.deletion_batch_id) && timestamp(entry.created_at) && timestamp(entry.updated_at));
    try { validarDocumento(entry.document); } catch { throw new AuthGuardError("unavailable"); }
  }
  for (const item of row.refs as unknown[]) { const entry = common(item); ensure(uuid(entry.page_id) && optionalId(entry.target_id) && typeof entry.alias === "string" && typeof entry.normalized_alias === "string" && timestamp(entry.created_at)); }
  for (const item of row.links as unknown[]) { const entry = common(item); ensure(TIPOS_VINCULO.includes(entry.from_type as never) && TIPOS_VINCULO.includes(entry.to_type as never) && uuid(entry.from_id) && uuid(entry.to_id) && nullableTimestamp(entry.deleted_at) && timestamp(entry.created_at) && timestamp(entry.updated_at)); }
  for (const item of row.targets as unknown[]) ensure(record(item) && TIPOS_VINCULO.includes(item.type as never) && uuid(item.id) && typeof item.title === "string" && typeof item.href === "string" && /^\/(?!\/)/.test(item.href));
  for (const item of row.captures as unknown[]) { const entry = common(item); ensure(typeof entry.client_id === "string" && (entry.title === null || typeof entry.title === "string") && (entry.content === null || typeof entry.content === "string") && nullableTimestamp(entry.deleted_at)); }
  for (const item of row.receipts as unknown[]) ensure(record(item) && item.user_id === actor && typeof item.command === "string" && item.command.startsWith("knowledge.") && typeof item.client_id === "string" && typeof item.fingerprint === "string" && Object.hasOwn(item, "result"));
  const state = structuredClone(value) as SnapshotConhecimento;
  try { validateKnowledgeSnapshot(state, actor); } catch { throw new AuthGuardError("unavailable"); } return state;
}
export class KnowledgeRateLimitError extends Error { constructor() { super("Aguarde um pouco antes de salvar outra alteração."); this.name = "KnowledgeRateLimitError"; } }
export function createKnowledgeGateway(actor: string, session: string, operation: string, rpc: KnowledgeRpc): KnowledgeGateway {
  exigir(uuid(actor) && uuid(session) && (operation === "read.knowledge" || operation.startsWith("knowledge.")), "Contexto inválido.");
  const bound = { p_user: actor, p_session: session, p_operation: operation };
  async function call(name: KnowledgeRpcName, extra: Partial<KnowledgeRpcArguments> = {}, writing = false): Promise<unknown> {
    let response: Awaited<ReturnType<KnowledgeRpc>>;
    try { response = await rpc(name, { ...extra, ...bound }); } catch { if (writing) throw new KnowledgeCommitUnknown(); throw new AuthGuardError("unavailable"); }
    if (response.error) {
      const code = response.error.code;
      if (code === "42501") throw new AuthGuardError("forbidden"); if (code === "PT429") throw new KnowledgeRateLimitError();
      if (["40001", "23505", "40P01"].includes(code ?? "")) throw new ErroDeDominio("CONFLICT", "Esta página mudou. Recarregue e escolha a versão que deseja conservar.");
      if (["22023", "23514", "23503", "22P02"].includes(code ?? "")) throw new ErroDeDominio("VALIDATION", "Revise a página, o caderno e os vínculos.");
      if (writing && !code) throw new KnowledgeCommitUnknown(); throw new AuthGuardError("unavailable");
    }
    return response.data;
  }
  return { actorId: actor,
    async snapshot() { return parseKnowledgeSnapshot(await call("knowledge_snapshot"), actor); },
    async commit(request) { ensure(request.context.user_id === actor && request.receipt.command === operation); const response = await call("knowledge_commit", { p_request: request }, true); if (!record(response) || !["stale", "committed", "replayed"].includes(String(response.status)) || response.status !== "stale" && !Object.hasOwn(response, "result")) throw new KnowledgeCommitUnknown(); return response as { status: "stale" | "committed" | "replayed"; result?: unknown }; },
    async receipt(command, clientId) { const response = await call("knowledge_receipt", { p_command: command, p_client_id: clientId }); if (response === null) return null; ensure(record(response) && response.user_id === actor && response.command === command && response.client_id === clientId && typeof response.fingerprint === "string" && Object.hasOwn(response, "result")); return structuredClone(response) as ReciboIdempotente; },
  };
}
