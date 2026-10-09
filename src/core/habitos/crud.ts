import { exigir, instanteValido, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../contracts/base";
import { emitirEvento, executarComando } from "../contracts/operations";
import type { HabitoDoUsuario } from "../contracts/modules";
import { SO_DATA } from "../tempo";
import type { HabitTransaction, HabitUnitOfWork } from "./ports";

export type CamposHabito = Pick<HabitoDoUsuario, "name" | "schedule_kind" | "weekdays" | "weekly_target" | "started_on" | "color_key" | "icon_key" | "position">;
function fields(input: CamposHabito): CamposHabito {
  exigir(typeof input.name === "string" && input.name.trim().length > 0 && input.name.trim().length <= 120, "Informe um nome de até 120 caracteres.");
  exigir(["daily", "weekdays", "weekly_target"].includes(input.schedule_kind), "Escolha uma cadência válida.");
  exigir(Array.isArray(input.weekdays) && input.weekdays.every(day => Number.isInteger(day) && day >= 0 && day <= 6) && new Set(input.weekdays).size === input.weekdays.length, "Escolha dias da semana válidos.");
  exigir(input.schedule_kind !== "weekdays" || input.weekdays.length > 0, "Escolha ao menos um dia da semana.");
  exigir(input.schedule_kind !== "weekly_target" || Number.isInteger(input.weekly_target) && Number(input.weekly_target) >= 1 && Number(input.weekly_target) <= 7, "Informe uma meta de 1 a 7 vezes por semana.");
  exigir(typeof input.started_on === "string" && SO_DATA.test(input.started_on) && instanteValido(`${input.started_on}T00:00:00Z`), "Informe um dia inicial válido.");
  exigir(typeof input.color_key === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(input.color_key), "Escolha uma cor válida.");
  exigir(input.icon_key === null || typeof input.icon_key === "string" && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(input.icon_key), "Escolha um ícone válido.");
  exigir(Number.isSafeInteger(input.position) && input.position >= 0, "Posição inválida.");
  return { name: input.name.trim(), schedule_kind: input.schedule_kind, weekdays: input.schedule_kind === "weekdays" ? [...input.weekdays].sort() : [], weekly_target: input.schedule_kind === "weekly_target" ? input.weekly_target : null, started_on: input.started_on, color_key: input.color_key, icon_key: input.icon_key, position: input.position };
}
const keys = ["name", "schedule_kind", "weekdays", "weekly_target", "started_on", "color_key", "icon_key", "position"] as const;
async function active(tx: HabitTransaction, id: string) { const row = await tx.habitos.get(id); if (!row || row.archived_at !== null) naoEncontrado(); return row; }
export function criarHabito(store: HabitUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: CamposHabito & { client_id: string }): Promise<HabitoDoUsuario> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "habit.create", input.client_id, input, async tx => {
    const now = deps.clock.now(), row = { ...fields(input), id: deps.ids.next(), user_id: context.user_id, archived_at: null, created_at: now, updated_at: now };
    await tx.habitos.insert(row); await emitirEvento(tx, deps, context, "habit", null, row, "created"); return row;
  });
}
export function editarHabito(store: HabitUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string; patch: Partial<CamposHabito> }): Promise<HabitoDoUsuario> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "habit.update", input.client_id, input, async tx => {
    const before = await active(tx, input.id); exigir(input.patch && typeof input.patch === "object" && !Array.isArray(input.patch), "Informe os campos do hábito.");
    const patch = Object.fromEntries(keys.filter(key => input.patch[key] !== undefined).map(key => [key, input.patch[key]]));
    const after = { ...before, ...fields({ ...before, ...patch }), updated_at: deps.clock.now() };
    exigir(after.started_on === before.started_on, "A data inicial preserva o histórico e não pode ser alterada.");
    await tx.habitos.replace(after); await emitirEvento(tx, deps, context, "habit", before, after, "updated"); return after;
  });
}
function archive(store: HabitUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }, restoring: boolean): Promise<HabitoDoUsuario> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, restoring ? "habit.restore" : "habit.archive", input.client_id, input, async tx => {
    const before = await tx.habitos.get(input.id); if (!before) naoEncontrado(); if (restoring ? before.archived_at === null : before.archived_at !== null) return before;
    const now = deps.clock.now(), after = { ...before, archived_at: restoring ? null : now, updated_at: now };
    await tx.habitos.replace(after); await emitirEvento(tx, deps, context, "habit", before, after, restoring ? "restored" : "deleted"); return after;
  });
}
export const arquivarHabito = (store: HabitUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => archive(store, deps, context, input, false);
export const restaurarHabito = (store: HabitUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }) => archive(store, deps, context, input, true);
export function removerPausaHabito(store: HabitUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { id: string; client_id: string }): Promise<null> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "habit.pause.delete", input.client_id, input, async tx => {
    const before = await tx.pausas.get(input.id); if (!before) naoEncontrado(); await tx.pausas.remove(before.id); await emitirEvento(tx, deps, context, "habit_pause", before, null, "deleted"); return null;
  });
}
