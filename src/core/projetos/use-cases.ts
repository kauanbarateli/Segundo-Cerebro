import { exigir, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../contracts/base";
import { emitirEvento, executarComando } from "../contracts/operations";
import type { Projeto } from "../contracts/modules";
import type { ProjectContainer, ProjectUnitOfWork } from "./ports";

export type CamposProjeto = Pick<Projeto, "name" | "description" | "color_key" | "position">;
function fields(input: CamposProjeto): CamposProjeto {
  exigir(typeof input.name === "string" && input.name.trim().length > 0 && input.name.trim().length <= 120, "Informe um nome de até 120 caracteres.");
  exigir(input.description === null || typeof input.description === "string" && input.description.length <= 2000, "A descrição deve ter até 2.000 caracteres.");
  exigir(typeof input.color_key === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(input.color_key), "Escolha uma cor válida.");
  exigir(Number.isSafeInteger(input.position) && input.position >= 0, "Posição inválida.");
  return { name: input.name.trim(), description: input.description?.trim() || null, color_key: input.color_key, position: input.position };
}
export function criarProjeto(store: ProjectUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: CamposProjeto & { client_id: string }): Promise<Projeto> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "project.create", input.client_id, input, async tx => {
    const now = deps.clock.now(), row = { ...fields(input), id: deps.ids.next(), user_id: context.user_id, deleted_at: null, created_at: now, updated_at: now };
    await tx.projetos.insert(row); await emitirEvento(tx, deps, context, "project", null, row, "created"); return row;
  });
}
export function editarProjeto(store: ProjectUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string; patch: Partial<CamposProjeto> }): Promise<Projeto> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "project.update", input.client_id, input, async tx => {
    const before = await tx.projetos.get(input.id); if (!before || before.deleted_at !== null) naoEncontrado();
    exigir(input.patch && typeof input.patch === "object" && !Array.isArray(input.patch), "Informe os campos do projeto.");
    const after = { ...before, ...fields({ ...before, ...input.patch }), updated_at: deps.clock.now() };
    await tx.projetos.replace(after); await emitirEvento(tx, deps, context, "project", before, after, "updated"); return after;
  });
}
function trash(store: ProjectUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }, restore: boolean): Promise<Projeto> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, restore ? "project.restore" : "project.delete", input.client_id, input, async tx => {
    const before = await tx.projetos.get(input.id); if (!before) naoEncontrado(); if (restore ? before.deleted_at === null : before.deleted_at !== null) return before;
    const now = deps.clock.now(), after = { ...before, deleted_at: restore ? null : now, updated_at: now };
    await tx.projetos.replace(after); await emitirEvento(tx, deps, context, "project", before, after, restore ? "restored" : "deleted"); return after;
  });
}
export const excluirProjeto = (store: ProjectUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => trash(store, deps, context, input, false);
export const restaurarProjeto = (store: ProjectUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => trash(store, deps, context, input, true);

export function vincularContainerProjeto(store: ProjectUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; project_id: string; client_id: string }): Promise<ProjectContainer> {
  return containerLink(store, deps, context, input, false);
}
export function desvincularContainerProjeto(store: ProjectUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }): Promise<ProjectContainer> {
  return containerLink(store, deps, context, { ...input, project_id: null }, true);
}
function containerLink(store: ProjectUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; project_id: string | null; client_id: string }, unlink: boolean): Promise<ProjectContainer> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, unlink ? "project.container.unlink" : "project.container.link", input.client_id, input, async tx => {
    exigir(tx.containers, "Os contêineres não estão disponíveis neste adaptador."); const before = await tx.containers.get(input.id); if (!before || before.deleted_at !== null || before.user_id !== context.user_id) naoEncontrado();
    if (input.project_id !== null) { const project = await tx.projetos.get(input.project_id); if (!project || project.deleted_at !== null || project.user_id !== context.user_id) naoEncontrado(); }
    if (before.project_id === input.project_id) return before;
    const after = { ...before, project_id: input.project_id, updated_at: deps.clock.now() };
    await tx.containers.replace(after); await emitirEvento(tx, deps, context, "project_container", before, after, "updated"); return after;
  });
}
export function criarContainerProjeto(store: ProjectUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { kind: ProjectContainer["kind"]; name: string; project_id: string; parent_id?: string | null; client_id: string }): Promise<ProjectContainer> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "project.container.create", input.client_id, input, async tx => {
    exigir(tx.containers, "Os contêineres não estão disponíveis neste adaptador.");
    exigir(["capture", "notebook", "folder"].includes(input.kind), "Escolha captura, caderno ou pasta.");
    exigir(typeof input.name === "string" && input.name.trim().length > 0 && input.name.trim().length <= 120, "Informe um nome de até 120 caracteres.");
    const project = await tx.projetos.get(input.project_id); if (!project || project.deleted_at !== null || project.user_id !== context.user_id) naoEncontrado();
    const parent_id = input.parent_id ?? null; exigir(input.kind === "folder" || parent_id === null, "Este contêiner não aceita uma pasta superior.");
    if (parent_id !== null) { const parent = await tx.containers.get(parent_id); if (!parent || parent.kind !== "folder" || parent.deleted_at !== null || parent.user_id !== context.user_id) naoEncontrado(); }
    const now = deps.clock.now(), row: ProjectContainer = { id: deps.ids.next(), user_id: context.user_id, kind: input.kind, name: input.name.trim(), project_id: project.id, parent_id, deleted_at: null, created_at: now, updated_at: now };
    await tx.containers.insert(row); await emitirEvento(tx, deps, context, "project_container", null, row, "created"); return row;
  });
}
