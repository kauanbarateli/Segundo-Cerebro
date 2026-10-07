import { exigir, instanteValido } from "../contracts/base";
import type { CamposTarefa, EdicaoTarefa, Tarefa } from "./types";

const keys: readonly (keyof CamposTarefa)[] = ["title", "description", "category_id", "project_id", "status", "priority", "due_at", "scheduled_start_at", "scheduled_end_at", "all_day", "estimated_minutes", "board_position"];
export function camposTarefa(input: CamposTarefa): CamposTarefa {
  const result = Object.fromEntries(keys.map((key) => [key, input[key]])) as unknown as CamposTarefa;
  exigir(typeof result.title === "string" && result.title.trim().length > 0 && result.title.trim().length <= 200, "Informe um título de até 200 caracteres.");
  exigir(result.description === null || typeof result.description === "string" && result.description.length <= 5_000, "Descrição inválida.");
  exigir(["todo", "in_progress", "done", "archived"].includes(result.status), "Estado da tarefa inválido.");
  exigir(["low", "medium", "high", "urgent"].includes(result.priority), "Prioridade inválida.");
  for (const id of [result.category_id, result.project_id]) exigir(id === null || typeof id === "string" && id.length > 0, "Referência inválida.");
  for (const date of [result.due_at, result.scheduled_start_at, result.scheduled_end_at]) exigir(instanteValido(date), "Informe uma data com fuso explícito.");
  exigir(!result.scheduled_start_at || !result.scheduled_end_at || Date.parse(result.scheduled_end_at) >= Date.parse(result.scheduled_start_at), "O término precisa ser posterior ao início.");
  exigir(typeof result.all_day === "boolean", "Informe se a tarefa ocupa o dia inteiro.");
  exigir(result.estimated_minutes === null || Number.isSafeInteger(result.estimated_minutes) && result.estimated_minutes > 0, "Estimativa inválida.");
  exigir(result.board_position === null || Number.isFinite(result.board_position), "Posição inválida.");
  return { ...result, title: result.title.trim() };
}

export function editarModeloTarefa(before: Tarefa, patch: EdicaoTarefa, now: string): Tarefa {
  const changes = Object.fromEntries(keys.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]]));
  // Conversion preserves the capture's full text (up to 10,000 characters).
  // Unrelated edits must not reject or truncate that inherited description.
  const preserveDescription = patch.description === undefined;
  const fields = camposTarefa({ ...before, ...changes, ...(preserveDescription ? { description: null } : {}) });
  if (preserveDescription) fields.description = before.description;
  return { ...before, ...fields, completed_at: fields.status === "done" ? before.completed_at ?? now : null,
    archived_at: fields.status === "archived" ? before.archived_at ?? now : null, updated_at: now };
}
