import "server-only";
import { alterarStatusTarefa, criarTarefa, editarTarefa, excluirTarefa, restaurarTarefa } from "../../core/tarefas";
import { arquivarCaptura, converterCapturaEmTarefa, criarCaptura, desarquivarCaptura, editarCaptura, excluirCaptura, organizarCaptura, restaurarCaptura } from "../../core/capturas";
import { exigir, type CaptureTaskUnitOfWork, type ContextoDeEscrita, type DependenciasDeDominio } from "../../core/contracts";
import type { CaptureTaskCommand } from "./capture-task-gateway";

const executors = {
  "capture.create": criarCaptura, "capture.update": editarCaptura, "capture.archive": arquivarCaptura,
  "capture.unarchive": desarquivarCaptura, "capture.delete": excluirCaptura, "capture.restore": restaurarCaptura,
  "capture.convert": converterCapturaEmTarefa, "capture.organize": organizarCaptura,
  "task.create": criarTarefa, "task.update": editarTarefa, "task.status": alterarStatusTarefa,
  "task.delete": excluirTarefa, "task.restore": restaurarTarefa,
};
export type CaptureTaskRequest = { [K in keyof typeof executors]: { command: K; input: Parameters<(typeof executors)[K]>[3] } }[keyof typeof executors];
const taskFields = ["title", "description", "category_id", "project_id", "status", "priority", "due_at", "scheduled_start_at", "scheduled_end_at", "all_day", "estimated_minutes", "board_position"];
const captureFields = ["type", "title", "content", "category_id", "project_id", "linked_capture_ids", "attachments"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function object(value: unknown): asserts value is Record<string, unknown> { exigir(!!value && typeof value === "object" && !Array.isArray(value), "Operação inválida."); }
function fields(value: Record<string, unknown>, allowed: string[]) { exigir(Object.keys(value).every(key => allowed.includes(key)), "A operação contém campos não permitidos."); }
function references(value: Record<string, unknown>) {
  for (const key of ["id", "capture_id", "category_id", "project_id"]) {
    if (value[key] !== undefined && value[key] !== null) exigir(typeof value[key] === "string" && UUID.test(value[key]), "Identificador inválido.");
  }
  if (value.linked_capture_ids !== undefined) exigir(Array.isArray(value.linked_capture_ids) && value.linked_capture_ids.every(id => typeof id === "string" && UUID.test(id)), "Vínculo inválido.");
  if (value.attachments !== undefined) exigir(Array.isArray(value.attachments) && value.attachments.length === 0, "O envio de imagens ainda não está disponível nesta versão.");
}
/** Decode a public command, never a batch/context/owner from the browser. */
export function decodeCaptureTaskRequest(value: unknown): CaptureTaskRequest {
  object(value); fields(value, ["command", "input"]);
  exigir(typeof value.command === "string" && Object.hasOwn(executors, value.command), "Comando inválido.");
  object(value.input);
  const command = value.command as CaptureTaskCommand, input = value.input;
  exigir(typeof input.client_id === "string" && input.client_id.trim().length > 0 && input.client_id.length <= 200, "Informe o identificador da operação.");
  if (command.endsWith(".create")) fields(input, ["client_id", ...(command.startsWith("capture.") ? [...captureFields, "status"] : taskFields)]);
  else if (command.endsWith(".update")) {
    fields(input, ["id", "client_id", "patch"]); object(input.patch);
    fields(input.patch, command.startsWith("capture.") ? captureFields : taskFields);
    references(input.patch);
  } else if (command === "capture.convert") fields(input, ["capture_id", "client_id"]);
  else if (command === "capture.organize") {
    fields(input, ["id", "client_id", "destination"]);
    exigir(input.destination === "inbox", "A organização em Conhecimento estará disponível com a integração de páginas e cadernos.");
  } else if (command === "task.status") {
    fields(input, ["id", "client_id", "status"]);
    exigir(typeof input.status === "string" && ["todo", "in_progress", "done", "archived"].includes(input.status), "Informe um status válido para a tarefa.");
  }
  else fields(input, ["id", "client_id"]);
  if (!command.endsWith(".create")) {
    const id = command === "capture.convert" ? input.capture_id : input.id;
    exigir(typeof id === "string" && UUID.test(id), "Informe o registro da operação.");
  }
  references(input);
  return structuredClone(value) as CaptureTaskRequest;
}
export function executeCaptureTaskCommand(store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, request: CaptureTaskRequest): Promise<unknown> {
  switch (request.command) {
    case "capture.create": return criarCaptura(store, deps, context, request.input);
    case "capture.update": return editarCaptura(store, deps, context, request.input);
    case "capture.archive": return arquivarCaptura(store, deps, context, request.input);
    case "capture.unarchive": return desarquivarCaptura(store, deps, context, request.input);
    case "capture.delete": return excluirCaptura(store, deps, context, request.input);
    case "capture.restore": return restaurarCaptura(store, deps, context, request.input);
    case "capture.convert": return converterCapturaEmTarefa(store, deps, context, request.input);
    case "capture.organize": return organizarCaptura(store, deps, context, request.input);
    case "task.create": return criarTarefa(store, deps, context, request.input);
    case "task.update": return editarTarefa(store, deps, context, request.input);
    case "task.status": return alterarStatusTarefa(store, deps, context, request.input);
    case "task.delete": return excluirTarefa(store, deps, context, request.input);
    case "task.restore": return restaurarTarefa(store, deps, context, request.input);
  }
}
