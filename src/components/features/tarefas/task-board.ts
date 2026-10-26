import type { PrioridadeTarefa, Tarefa } from "../../../core/tarefas";
import { filterTasks, taskListState, type TaskListState, type TaskPeriod } from "./task-form";

export type TaskPresentation = "list" | "kanban";
export type TaskDisplayState = TaskListState | "all";
export const TASK_BOARD_COLUMNS = [
  { status: "todo", label: "A fazer" },
  { status: "in_progress", label: "Em andamento" },
  { status: "done", label: "Concluídas" },
] as const;

export function taskPresentationKey(userId: string): string {
  return `segundo-cerebro:tasks:presentation:v1:${encodeURIComponent(userId)}`;
}

/** This preference changes presentation only; it never changes the task URL or access. */
export function readTaskPresentation(storage: Pick<Storage, "getItem">, userId: string): TaskPresentation {
  try { return storage.getItem(taskPresentationKey(userId)) === "kanban" ? "kanban" : "list"; }
  catch { return "list"; }
}

export function saveTaskPresentation(storage: Pick<Storage, "setItem">, userId: string, value: TaskPresentation): boolean {
  try { storage.setItem(taskPresentationKey(userId), value); return true; }
  catch { return false; }
}

export interface TaskDisplayFilters {
  state: TaskDisplayState;
  category: string;
  project: string;
  priority: PrioridadeTarefa | "";
  period: TaskPeriod;
  today: string;
}

/** One selection for both presentations, before their shared search and stable sort. */
export function filterTaskDisplay(tasks: readonly Tarefa[], filters: TaskDisplayFilters): Tarefa[] {
  const { state, category, project, priority, period, today } = filters;
  const eligible = tasks.filter(task =>
    (!project || (project === "none" ? task.project_id === null : task.project_id === project)) &&
    (!priority || task.priority === priority));
  if (state !== "all") return filterTasks(eligible, state, category, period, today);
  const active = new Set(filterTasks(eligible, "active", category, period, today));
  const done = new Set(filterTasks(eligible, "done", category, period, today));
  return eligible.filter(task => active.has(task) || done.has(task));
}

export function taskBoardGroups(tasks: readonly Tarefa[], state: TaskDisplayState) {
  if (state === "archived" || state === "trash") return [{
    status: state, label: state === "trash" ? "Lixeira" : "Arquivadas",
    items: tasks.filter(task => taskListState(task) === state),
  }];
  return TASK_BOARD_COLUMNS.map(column => ({ ...column, items: tasks.filter(task => !task.deleted_at && task.status === column.status) }));
}

export function canDragTask(task: Tarefa): boolean {
  return task.deleted_at === null && task.status !== "archived";
}

/** Severity order is independent of translated labels; both views use this accessor. */
export function taskPriorityRank(priority: PrioridadeTarefa): number { return ({ urgent: 0, high: 1, medium: 2, low: 3 } as const)[priority]; }
