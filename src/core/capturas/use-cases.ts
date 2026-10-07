import { exigir, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../contracts/base";
import { conferirOrganizacao, emitirEvento, executarComando } from "../contracts/operations";
import type { UnitOfWork } from "../contracts/unit-of-work";
import type { Tarefa } from "../tarefas/types";
import type { Captura, CamposCaptura, EdicaoCaptura, NovaCaptura } from "./types";

const keys: readonly (keyof CamposCaptura)[] = ["type", "title", "content", "category_id", "project_id"];
function camposCaptura(input: CamposCaptura): CamposCaptura {
  const fields = Object.fromEntries(keys.map((key) => [key, input[key]])) as unknown as CamposCaptura;
  exigir(["idea", "task", "note", "reminder"].includes(fields.type), "Tipo de captura inválido.");
  exigir(fields.title === null || typeof fields.title === "string" && fields.title.length <= 200, "Título inválido.");
  exigir(fields.content === null || typeof fields.content === "string" && fields.content.length <= 10_000, "Conteúdo inválido.");
  exigir(fields.title?.trim() || fields.content?.trim(), "Escreva algo para capturar.");
  for (const id of [fields.category_id, fields.project_id]) exigir(id === null || typeof id === "string" && id.length > 0, "Referência inválida.");
  return { ...fields, title: fields.title?.trim() || null, content: fields.content?.trim() || null };
}

export function criarCaptura(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: NovaCaptura): Promise<Captura> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "capture.create", input.client_id, input, async (tx) => {
    const fields = camposCaptura(input);
    exigir(input.status === undefined || ["draft", "inbox"].includes(input.status), "Estado inicial inválido.");
    await conferirOrganizacao(tx, fields.category_id, fields.project_id);
    const now = deps.clock.now();
    const capture: Captura = { ...fields, id: deps.ids.next(), user_id: context.user_id, client_id: input.client_id,
      status: input.status ?? "inbox", converted_task_id: null, captured_at: now, organized_at: null,
      archived_at: null, deleted_at: null, created_at: now, updated_at: now };
    await tx.capturas.insert(capture);
    await emitirEvento(tx, deps, context, "capture", null, capture, "created");
    return capture;
  });
}

export function editarCaptura(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string; patch: EdicaoCaptura }): Promise<Captura> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "capture.update", input.client_id, input, async (tx) => {
    const before = await tx.capturas.get(input.id);
    if (!before || before.deleted_at) naoEncontrado();
    const changes = Object.fromEntries(keys.filter((key) => input.patch[key] !== undefined).map((key) => [key, input.patch[key]]));
    const fields = camposCaptura({ ...before, ...changes });
    await conferirOrganizacao(tx, fields.category_id === before.category_id ? null : fields.category_id, fields.project_id === before.project_id ? null : fields.project_id);
    const after = { ...before, ...fields, updated_at: deps.clock.now() };
    await tx.capturas.replace(after);
    await emitirEvento(tx, deps, context, "capture", before, after, "updated");
    return after;
  });
}

function cicloCaptura(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }, mode: "archive" | "delete" | "restore"): Promise<Captura> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, `capture.${mode}`, input.client_id, input, async (tx) => {
    const before = await tx.capturas.get(input.id);
    if (!before || mode === "archive" && before.deleted_at) naoEncontrado();
    if (mode === "delete" && before.deleted_at || mode === "restore" && !before.deleted_at || mode === "archive" && before.status === "archived") return before;
    const now = deps.clock.now();
    const after: Captura = { ...before, updated_at: now };
    if (mode === "archive") { after.status = "archived"; after.archived_at = now; }
    else after.deleted_at = mode === "restore" ? null : now;
    await tx.capturas.replace(after);
    await emitirEvento(tx, deps, context, "capture", before, after, mode === "archive" ? "status_changed" : mode === "delete" ? "deleted" : "restored");
    return after;
  });
}
export const arquivarCaptura = (store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => cicloCaptura(store, deps, context, input, "archive");
export const excluirCaptura = (store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => cicloCaptura(store, deps, context, input, "delete");
export const restaurarCaptura = (store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => cicloCaptura(store, deps, context, input, "restore");

export interface ConversaoCaptura { captura: Captura; tarefa: Tarefa }
export function converterCapturaEmTarefa(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { capture_id: string; client_id: string }): Promise<ConversaoCaptura> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "capture.convert", input.client_id, input, async (tx) => {
    const capture = await tx.capturas.get(input.capture_id);
    if (!capture || capture.deleted_at) naoEncontrado();
    if (capture.converted_task_id) {
      const task = await tx.tarefas.get(capture.converted_task_id);
      if (!task) naoEncontrado();
      return { captura: capture, tarefa: task };
    }
    const now = deps.clock.now();
    const project = capture.project_id ? await tx.projetos.get(capture.project_id) : null;
    const task: Tarefa = { id: deps.ids.next(), user_id: context.user_id, client_id: input.client_id,
      title: capture.title || capture.content?.slice(0, 120) || "Nova tarefa",
      description: capture.content && (capture.title || capture.content.length > 120) ? capture.content : null,
      category_id: capture.category_id, project_id: project && !project.deleted_at ? project.id : null,
      source: "manual", origin_capture_id: capture.id, status: "todo", priority: "medium", due_at: null,
      scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null,
      board_position: null, completed_at: null, archived_at: null, deleted_at: null, created_at: now, updated_at: now };
    const organized: Captura = { ...capture, converted_task_id: task.id, status: "organized", organized_at: now, archived_at: null, updated_at: now };
    await tx.tarefas.insert(task);
    await tx.capturas.replace(organized);
    await emitirEvento(tx, deps, context, "task", null, task, "created");
    await emitirEvento(tx, deps, context, "capture", capture, organized, "status_changed");
    return { captura: organized, tarefa: task };
  });
}
