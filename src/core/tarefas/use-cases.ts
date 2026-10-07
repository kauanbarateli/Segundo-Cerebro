import { naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../contracts/base";
import { conferirOrganizacao, emitirEvento, executarComando } from "../contracts/operations";
import type { UnitOfWork } from "../contracts/unit-of-work";
import { camposTarefa, editarModeloTarefa } from "./model";
import type { EdicaoTarefa, NovaTarefa, StatusTarefa, Tarefa } from "./types";

export function criarTarefa(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: NovaTarefa): Promise<Tarefa> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "task.create", input.client_id, input, async (tx) => {
    const fields = camposTarefa(input);
    await conferirOrganizacao(tx, fields.category_id, fields.project_id);
    const now = deps.clock.now();
    const task: Tarefa = { ...fields, id: deps.ids.next(), user_id: context.user_id, client_id: input.client_id,
      source: "manual", origin_capture_id: null, completed_at: fields.status === "done" ? now : null,
      archived_at: fields.status === "archived" ? now : null, deleted_at: null, created_at: now, updated_at: now };
    await tx.tarefas.insert(task);
    await emitirEvento(tx, deps, context, "task", null, task, "created");
    return task;
  });
}

export function editarTarefa(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string; patch: EdicaoTarefa }): Promise<Tarefa> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "task.update", input.client_id, input, async (tx) => {
    const before = await tx.tarefas.get(input.id);
    if (!before || before.deleted_at) naoEncontrado();
    const after = editarModeloTarefa(before, input.patch, deps.clock.now());
    await conferirOrganizacao(tx, after.category_id === before.category_id ? null : after.category_id, after.project_id === before.project_id ? null : after.project_id);
    await tx.tarefas.replace(after);
    await emitirEvento(tx, deps, context, "task", before, after, before.status === after.status ? "updated" : "status_changed");
    return after;
  });
}

export function alterarStatusTarefa(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string; status: StatusTarefa }): Promise<Tarefa> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "task.status", input.client_id, input, async (tx) => {
    const before = await tx.tarefas.get(input.id);
    if (!before || before.deleted_at) naoEncontrado();
    const after = editarModeloTarefa(before, { status: input.status }, deps.clock.now());
    await tx.tarefas.replace(after);
    await emitirEvento(tx, deps, context, "task", before, after, "status_changed");
    return after;
  });
}

function lixeira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }, restore: boolean): Promise<Tarefa> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, restore ? "task.restore" : "task.delete", input.client_id, input, async (tx) => {
    const before = await tx.tarefas.get(input.id);
    if (!before) naoEncontrado();
    if (restore ? before.deleted_at === null : before.deleted_at !== null) return before;
    const now = deps.clock.now();
    const after = { ...before, deleted_at: restore ? null : now, updated_at: now };
    await tx.tarefas.replace(after);
    await emitirEvento(tx, deps, context, "task", before, after, restore ? "restored" : "deleted");
    return after;
  });
}
export const excluirTarefa = (store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => lixeira(store, deps, context, input, false);
export const restaurarTarefa = (store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => lixeira(store, deps, context, input, true);
