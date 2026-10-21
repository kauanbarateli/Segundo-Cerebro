import { describe, expect, it } from "vitest";
import type { Tarefa } from "../../src/core/tarefas";
import { buildTableView } from "../../src/components/ui/table-model";
import { canDragTask, filterTaskDisplay, readTaskPresentation, saveTaskPresentation, taskBoardGroups, taskPresentationKey, type TaskDisplayFilters } from "../../src/components/features/tarefas/task-board";

const task = (id: string, patch: Partial<Tarefa> = {}): Tarefa => ({
  id, user_id: "owner", client_id: `created-${id}`, title: id, description: "Descrição original",
  category_id: "category", project_id: "project", status: "todo", priority: "high", all_day: false,
  due_at: "2026-10-21T12:00:00Z", scheduled_start_at: null, scheduled_end_at: null,
  estimated_minutes: 45, board_position: 2.5, source: "manual", origin_capture_id: "capture",
  completed_at: null, archived_at: null, deleted_at: null,
  created_at: "2026-10-20T12:00:00Z", updated_at: "2026-10-20T12:00:00Z", ...patch,
});
const filters: TaskDisplayFilters = { state: "all", category: "", project: "", priority: "", period: "all", today: "2026-10-21" };
const rows = [
  task("Café a fazer"), task("Café em andamento", { status: "in_progress", priority: "medium" }),
  task("Café concluído", { status: "done", completed_at: "2026-10-21T13:00:00Z" }),
  task("Arquivada", { status: "archived", archived_at: "2026-10-20T13:00:00Z" }),
  task("Lixeira", { status: "in_progress", deleted_at: "2026-10-20T13:00:00Z" }),
  task("Sem contexto", { category_id: null, project_id: null, due_at: "2026-10-21T01:00:00Z" }),
];

describe("T-048: a coleção da lista e do Kanban", () => {
  it("separa os estados reais sem esconder in_progress nem misturar arquivo/lixeira", () => {
    const selected = filterTaskDisplay(rows, filters);
    const groups = taskBoardGroups(selected, "all");
    expect(groups.map(group => [group.status, group.items.map(item => item.id)])).toEqual([
      ["todo", ["Café a fazer", "Sem contexto"]], ["in_progress", ["Café em andamento"]], ["done", ["Café concluído"]],
    ]);
    expect(groups.reduce((count, group) => count + group.items.length, 0)).toBe(selected.length);
    expect(selected[0]).toBe(rows[0]);
    expect(rows[0]).toMatchObject({ board_position: 2.5, origin_capture_id: "capture", estimated_minutes: 45, description: "Descrição original" });
    expect(rows).toHaveLength(6);
  });

  it("combina projeto/categoria/prioridade/prazo com busca sem acento e ordem estável", () => {
    const selected = filterTaskDisplay(rows, { ...filters, category: "category", project: "project", priority: "high", period: "today" });
    const view = buildTableView({ rows: selected, columns: [{ id: "title", accessor: item => item.title }], search: "CAFE", sort: { columnId: "title", direction: "desc" }, pageSize: 100 });
    expect(view.rows.map(item => item.id)).toEqual(["Café concluído", "Café a fazer"]);
    expect(taskBoardGroups(view.rows, "all").reduce((count, group) => count + group.items.length, 0)).toBe(view.total);
    expect(filterTaskDisplay(rows, { ...filters, project: "none", category: "none", period: "overdue" }).map(item => item.id)).toEqual(["Sem contexto"]);
    expect(filterTaskDisplay(rows, { ...filters, project: "another-user-project" })).toEqual([]);
  });

  it("tem uma coluna para arquivo/lixeira com recuperação e sem arraste", () => {
    for (const state of ["archived", "trash"] as const) {
      const selected = filterTaskDisplay(rows, { ...filters, state });
      const groups = taskBoardGroups(selected, state);
      expect(groups).toHaveLength(1);
      expect(groups[0]?.status).toBe(state);
      expect(groups[0]?.items).toEqual(selected);
      expect(selected.every(item => !canDragTask(item))).toBe(true);
    }
    expect(canDragTask(rows[2]!)).toBe(true);
    expect(filterTaskDisplay(rows, { ...filters, state: "active" }).map(item => item.id)).toEqual(["Café a fazer", "Café em andamento", "Sem contexto"]);
  });

  it("lembra somente a apresentação do próprio usuário e tolera armazenamento indisponível", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(saveTaskPresentation(storage, "a/b", "kanban")).toBe(true);
    expect(taskPresentationKey("a/b")).not.toBe(taskPresentationKey("a%2Fb"));
    expect(readTaskPresentation(storage, "a/b")).toBe("kanban");
    expect(readTaskPresentation(storage, "other-user")).toBe("list");
    values.set(taskPresentationKey("other-user"), "hoje");
    expect(readTaskPresentation(storage, "other-user")).toBe("list");
    const unavailable = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readTaskPresentation(unavailable, "a/b")).toBe("list");
    expect(saveTaskPresentation(unavailable, "a/b", "kanban")).toBe(false);
  });
});
