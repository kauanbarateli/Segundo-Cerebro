import type { CamposTarefa, EdicaoTarefa, PrioridadeTarefa, StatusTarefa, Tarefa } from "../../../core/tarefas";
import { instanteDe, paraCampoLocal } from "../../../core/tempo";

export interface TaskDateDraft { day: string; time: string }
export interface TaskDraft {
  title: string; description: string; category: string; project: string;
  status: StatusTarefa; priority: PrioridadeTarefa; allDay: boolean;
  due: TaskDateDraft; start: TaskDateDraft; end: TaskDateDraft;
  estimate: string; position: string;
}
export type TaskFieldErrors = Partial<Record<keyof TaskDraft, string>>;
export class TaskFormError extends Error {
  constructor(public readonly fields: TaskFieldErrors) { super("Confira os campos indicados."); this.name = "TaskFormError"; }
}

function dateDraft(value: string | null | undefined): TaskDateDraft {
  const [day = "", time = ""] = paraCampoLocal(value, "datetime").split("T");
  return { day, time };
}

export function taskDraft(task?: Tarefa): TaskDraft {
  return {
    title: task?.title ?? "", description: task?.description ?? "",
    category: task?.category_id ?? "", project: task?.project_id ?? "",
    status: task?.status ?? "todo", priority: task?.priority ?? "medium", allDay: task?.all_day ?? false,
    due: dateDraft(task?.due_at), start: dateDraft(task?.scheduled_start_at), end: dateDraft(task?.scheduled_end_at),
    estimate: task?.estimated_minutes?.toString() ?? "", position: task?.board_position?.toString() ?? "",
  };
}

export function taskDateValue(value: TaskDateDraft, allDay: boolean): string {
  return value.day ? allDay ? value.day : `${value.day}T${value.time || "00:00"}` : "";
}

/** Keep remembered time when a date-only field changes, clears, or toggles. */
export function editTaskDate(value: string, previous: TaskDateDraft): TaskDateDraft {
  const [day = "", time = previous.time] = value.split("T");
  return { day, time };
}

function sameDate(a: TaskDateDraft, b: TaskDateDraft): boolean { return a.day === b.day && a.time === b.time; }

export function taskFields(draft: TaskDraft, original?: Tarefa): CamposTarefa {
  const errors: TaskFieldErrors = {};
  const before = taskDraft(original);
  const title = draft.title.trim();
  if (!title || title.length > 200) errors.title = "Informe um título de até 200 caracteres.";
  if (draft.description.length > 5000 && (!original || draft.description !== before.description)) errors.description = "Use até 5.000 caracteres na descrição alterada.";
  const estimate = draft.estimate.trim() ? Number(draft.estimate) : null;
  const position = draft.position.trim() ? Number(draft.position) : null;
  if (estimate !== null && (!Number.isSafeInteger(estimate) || estimate <= 0)) errors.estimate = "Informe minutos inteiros maiores que zero.";
  if (position !== null && !Number.isFinite(position)) errors.position = "Informe uma posição numérica válida ou deixe em branco.";
  const date = (key: "due" | "start" | "end", originalValue: string | null | undefined) => {
    // An untouched instant keeps its seconds, offset and historical DST occurrence.
    if (original && sameDate(draft[key], before[key]) && draft.allDay === before.allDay) return originalValue ?? null;
    const value = taskDateValue(draft[key], draft.allDay);
    if (!value) return null;
    const instant = instanteDe(value);
    if (instant === null) errors[key] = "Informe uma data e um horário válidos.";
    return instant;
  };
  const due_at = date("due", original?.due_at);
  const scheduled_start_at = date("start", original?.scheduled_start_at);
  const scheduled_end_at = date("end", original?.scheduled_end_at);
  if (scheduled_start_at && scheduled_end_at && Date.parse(scheduled_end_at) < Date.parse(scheduled_start_at)) errors.end = "O término não pode ser anterior ao início.";
  if (Object.keys(errors).length) throw new TaskFormError(errors);
  return { title, description: draft.description || null, category_id: draft.category || null, project_id: draft.project || null,
    status: draft.status, priority: draft.priority, all_day: draft.allDay, due_at, scheduled_start_at, scheduled_end_at,
    estimated_minutes: estimate, board_position: position };
}

/** Omitted fields remain untouched by the domain, including inherited long text. */
export function taskPatch(draft: TaskDraft, original: Tarefa): EdicaoTarefa {
  const fields = taskFields(draft, original);
  return Object.fromEntries(Object.entries(fields).filter(([key, value]) => value !== original[key as keyof CamposTarefa])) as EdicaoTarefa;
}

export type TaskListState = "active" | "done" | "archived" | "trash";
export type TaskPeriod = "all" | "today" | "overdue";
export function taskListState(task: Tarefa): TaskListState {
  return task.deleted_at ? "trash" : task.status === "archived" ? "archived" : task.status === "done" ? "done" : "active";
}
export function filterTasks(tasks: readonly Tarefa[], state: TaskListState, category: string, period: TaskPeriod, today: string): Tarefa[] {
  return tasks.filter((task) => {
    if (taskListState(task) !== state || category && (category === "none" ? task.category_id !== null : task.category_id !== category)) return false;
    if (period === "all") return true;
    const day = paraCampoLocal(task.due_at, "date");
    return period === "today" ? day === today : Boolean(day && day < today && state === "active");
  });
}
