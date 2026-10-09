import "server-only";
import { ErroDeDominio, instanteValido } from "../../core/contracts/base";
import type { Captura } from "../../core/capturas";
import { validCaptureAttachments } from "../../core/capturas";
import type { Tarefa } from "../../core/tarefas";
import type { Categoria, EventoDominio, Projeto, ReciboIdempotente } from "../../core/contracts";
import { AuthGuardError } from "../../lib/auth/types";
import { CommitOutcomeUnknown, type CaptureTaskCommit, type CaptureTaskGateway, type CaptureTaskSnapshot } from "./capture-task-store";

export const CAPTURE_TASK_COMMANDS = ["capture.create", "capture.update", "capture.archive", "capture.unarchive", "capture.delete", "capture.restore", "capture.organize", "capture.convert", "task.create", "task.update", "task.status", "task.delete", "task.restore"] as const;
export type CaptureTaskCommand = typeof CAPTURE_TASK_COMMANDS[number];
export type CaptureTaskOperation = CaptureTaskCommand | "read.captures" | "read.tasks";
type RpcName = "capture_task_snapshot" | "capture_task_revision" | "capture_task_receipt" | "capture_task_commit";
export interface CaptureTaskRpcArguments {
  p_user: string; p_session: string; p_operation: CaptureTaskOperation;
  p_command?: string; p_client_id?: string; p_request?: CaptureTaskCommit;
}
export type CaptureTaskRpc = (name: RpcName, args: CaptureTaskRpcArguments) => Promise<{ data: unknown; error: { code?: string } | null }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const uuid = (value: unknown) => text(value) && UUID.test(value);
const nullableId = (value: unknown) => value === null || uuid(value);
const date = (value: unknown) => text(value) && instanteValido(value);
const nullableDate = (value: unknown) => value === null || date(value);
const nullableText = (value: unknown) => value === null || text(value);
const unavailable = (): never => { throw new AuthGuardError("unavailable"); };
function ensure(value: unknown): asserts value { if (!value) unavailable(); }
function keys(value: Record<string, unknown>, allowed: string[]) { ensure(Object.keys(value).every(key => allowed.includes(key))); }
function base(value: unknown, actor: string): asserts value is Record<string, unknown> {
  ensure(record(value) && uuid(value.id) && value.user_id === actor);
}
function timestamps(row: Record<string, unknown>) { ensure(date(row.created_at) && date(row.updated_at)); }
function capture(value: unknown, actor: string): asserts value is Captura {
  base(value, actor); timestamps(value);
  keys(value, ["id", "user_id", "client_id", "project_id", "type", "title", "content", "status", "category_id", "converted_task_id", "captured_at", "organized_at", "archived_at", "deleted_at", "created_at", "updated_at", "linked_capture_ids", "attachments"]);
  ensure(text(value.client_id) && value.client_id.length > 0 && value.client_id.length <= 200);
  ensure(["idea", "task", "note", "reminder"].includes(String(value.type)) && ["draft", "inbox", "organized", "archived"].includes(String(value.status)));
  ensure(nullableText(value.title) && nullableText(value.content) && nullableId(value.category_id) && nullableId(value.project_id) && nullableId(value.converted_task_id));
  ensure(date(value.captured_at) && [value.organized_at, value.archived_at, value.deleted_at].every(nullableDate));
  ensure(value.linked_capture_ids === undefined || Array.isArray(value.linked_capture_ids) && value.linked_capture_ids.every(uuid));
  ensure(value.attachments === undefined || validCaptureAttachments(value.attachments));
}
function task(value: unknown, actor: string): asserts value is Tarefa {
  base(value, actor); timestamps(value);
  keys(value, ["id", "user_id", "client_id", "title", "description", "category_id", "project_id", "status", "priority", "due_at", "scheduled_start_at", "scheduled_end_at", "all_day", "estimated_minutes", "board_position", "source", "origin_capture_id", "completed_at", "archived_at", "deleted_at", "created_at", "updated_at"]);
  ensure(text(value.client_id) && value.client_id.length > 0 && value.client_id.length <= 200 && text(value.title) && nullableText(value.description));
  ensure(["todo", "in_progress", "done", "archived"].includes(String(value.status)) && ["low", "medium", "high", "urgent"].includes(String(value.priority)));
  ensure(nullableId(value.category_id) && nullableId(value.project_id) && nullableId(value.origin_capture_id) && value.source === "manual");
  ensure([value.due_at, value.scheduled_start_at, value.scheduled_end_at, value.completed_at, value.archived_at, value.deleted_at].every(nullableDate));
  ensure(typeof value.all_day === "boolean" && (value.estimated_minutes === null || Number.isSafeInteger(value.estimated_minutes) && Number(value.estimated_minutes) > 0));
  ensure(value.board_position === null || typeof value.board_position === "number" && Number.isFinite(value.board_position));
}
function category(value: unknown, actor: string): asserts value is Categoria {
  base(value, actor); timestamps(value);
  keys(value, ["id", "user_id", "name", "normalized_name", "color_key", "is_system", "created_at", "updated_at"]);
  ensure(text(value.name) && text(value.normalized_name) && text(value.color_key) && typeof value.is_system === "boolean");
}
function project(value: unknown, actor: string): asserts value is Projeto {
  base(value, actor); timestamps(value);
  keys(value, ["id", "user_id", "name", "description", "color_key", "deleted_at", "position", "created_at", "updated_at"]);
  ensure(text(value.name) && nullableText(value.description) && text(value.color_key) && nullableDate(value.deleted_at) && typeof value.position === "number" && Number.isFinite(value.position));
}
function event(value: unknown, actor: string): asserts value is EventoDominio {
  base(value, actor);
  keys(value, ["id", "user_id", "entity_type", "entity_id", "action", "canal", "occurred_at", "before", "after"]);
  ensure(uuid(value.entity_id) && ["capture", "task"].includes(String(value.entity_type)) && ["created", "updated", "deleted", "restored", "status_changed"].includes(String(value.action)));
  ensure(["web", "api", "cron"].includes(String(value.canal)) && date(value.occurred_at));
  for (const state of [value.before, value.after]) {
    if (state === null) continue;
    if (value.entity_type === "capture") capture(state, actor); else task(state, actor);
    ensure(state.id === value.entity_id);
  }
  ensure(value.before !== null || value.after !== null);
}
function receipt(value: unknown, actor: string): asserts value is ReciboIdempotente {
  ensure(record(value) && value.user_id === actor && CAPTURE_TASK_COMMANDS.includes(value.command as CaptureTaskCommand) && text(value.client_id) && value.client_id.length > 0 && text(value.fingerprint) && value.fingerprint.length > 0 && Object.hasOwn(value, "result"));
  keys(value, ["user_id", "command", "client_id", "fingerprint", "result"]);
  result(value.result, actor, value.command as CaptureTaskCommand);
}
function result(value: unknown, actor: string, command: CaptureTaskCommand) {
  if (command === "capture.convert") {
    ensure(record(value)); keys(value, ["captura", "tarefa"]); capture(value.captura, actor); task(value.tarefa, actor);
    ensure(value.captura.converted_task_id === value.tarefa.id && value.tarefa.origin_capture_id === value.captura.id);
  } else if (command.startsWith("capture.")) capture(value, actor);
  else task(value, actor);
}
export class CaptureTaskRateLimitError extends Error {
  constructor() { super("Aguarde um pouco antes de salvar outra alteração."); this.name = "CaptureTaskRateLimitError"; }
}
export function parseCaptureTaskSnapshot(value: unknown, actor: string): { snapshot: CaptureTaskSnapshot; projectsVisible: boolean } {
  ensure(record(value) && text(value.revision) && /^(0|[1-9][0-9]*)$/.test(value.revision) && typeof value.projects_visible === "boolean");
  const validators = { captures: capture, tasks: task, categories: category, projects: project, events: event, receipts: receipt };
  let rows = 0;
  for (const [key, validate] of Object.entries(validators)) {
    const list = value[key]; ensure(Array.isArray(list)); rows += list.length;
    for (const row of list) validate(row, actor);
  }
  ensure(rows <= 10000 && Buffer.byteLength(JSON.stringify(value), "utf8") <= 8 * 1024 * 1024);
  ensure(value.readonlyCaptureIds === undefined || Array.isArray(value.readonlyCaptureIds) && value.readonlyCaptureIds.every(id => uuid(id) && (value.captures as Captura[]).some(row => row.id === id)));
  // Whitelist top-level fields. Privileged transport data never crosses to UI.
  return { snapshot: structuredClone({ revision: value.revision, captures: value.captures, tasks: value.tasks, categories: value.categories, projects: value.projects, events: value.events, receipts: value.receipts, ...(value.readonlyCaptureIds !== undefined ? { readonlyCaptureIds: value.readonlyCaptureIds } : {}) }) as CaptureTaskSnapshot, projectsVisible: value.projects_visible };
}
/** Per-request transport with a bound actor/session/operation; no browser client. */
export function createCaptureTaskGateway(actor: string, session: string, operation: CaptureTaskOperation, rpc: CaptureTaskRpc): CaptureTaskGateway & { presentation(): Promise<{ snapshot: CaptureTaskSnapshot; projectsVisible: boolean }> } {
  ensure(uuid(actor) && uuid(session) && (CAPTURE_TASK_COMMANDS.includes(operation as CaptureTaskCommand) || ["read.captures", "read.tasks"].includes(operation)));
  const bound = { p_user: actor, p_session: session, p_operation: operation };
  async function call(name: RpcName, extra: Partial<CaptureTaskRpcArguments> = {}, writing = false) {
    let response: Awaited<ReturnType<CaptureTaskRpc>>;
    try { response = await rpc(name, { ...extra, ...bound }); }
    catch { if (writing) throw new CommitOutcomeUnknown(); return unavailable(); }
    if (response.error) {
      if (response.error.code === "PT429") throw new CaptureTaskRateLimitError();
      if (response.error.code === "42501") throw new AuthGuardError("forbidden");
      if (["23505", "40001", "40P01"].includes(response.error.code ?? "")) throw new ErroDeDominio("CONFLICT", "Os dados mudaram. Tente novamente com o mesmo identificador.");
      if (["22023", "23514", "23503", "22P02"].includes(response.error.code ?? "")) throw new ErroDeDominio("VALIDATION", "Confira os dados da operação.");
      // A structured SQL error proves rollback. A transport error does not.
      if (writing && !response.error.code) throw new CommitOutcomeUnknown();
      return unavailable();
    }
    return response.data;
  }
  const presentation = async () => parseCaptureTaskSnapshot(await call("capture_task_snapshot"), actor);
  return {
    actorId: actor, presentation,
    async snapshot() { return (await presentation()).snapshot; },
    async currentRevision() { const value = await call("capture_task_revision"); ensure(text(value) && /^(0|[1-9][0-9]*)$/.test(value)); return value; },
    async receipt(command, clientId) {
      const value = await call("capture_task_receipt", { p_command: command, p_client_id: clientId });
      if (value === null) return null;
      receipt(value, actor); ensure(value.command === command && value.client_id === clientId);
      return structuredClone(value);
    },
    async commit(request) {
      ensure(request.context.user_id === actor && request.receipt.command === operation);
      const value = await call("capture_task_commit", { p_request: request }, true);
      // Malformed successful responses can hide a committed transaction.
      if (!record(value) || !["stale", "committed", "replayed"].includes(String(value.status))) throw new CommitOutcomeUnknown();
      if (value.status === "stale") return { status: "stale" };
      if (!Object.hasOwn(value, "result")) throw new CommitOutcomeUnknown();
      try { result(value.result, actor, operation as CaptureTaskCommand); } catch { throw new CommitOutcomeUnknown(); }
      return { status: value.status as "committed" | "replayed", result: structuredClone(value.result) };
    },
  };
}
