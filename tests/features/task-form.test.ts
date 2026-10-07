import { describe, expect, it } from "vitest";
import { editTaskDate, filterTasks, taskDateValue, taskDraft, taskFields, TaskFormError, taskPatch } from "../../src/components/features/tarefas/task-form";
import { editarModeloTarefa } from "../../src/core/tarefas/model";
import type { Tarefa } from "../../src/core/tarefas";

const task = (patch: Partial<Tarefa> = {}): Tarefa => ({
  id: "task", user_id: "user", client_id: "creation", title: "Revisar organização", description: "Descrição",
  category_id: "dynamic", project_id: null, status: "done", priority: "high", all_day: false,
  due_at: "2026-09-23T17:30:00.000Z", scheduled_start_at: "2026-09-23T16:00:00.000Z", scheduled_end_at: "2026-09-23T17:00:00.000Z",
  estimated_minutes: 60, board_position: 2.5, source: "manual", origin_capture_id: null,
  completed_at: "2026-09-23T18:00:00.000Z", archived_at: null, deleted_at: null,
  created_at: "2026-09-01T12:00:00.000Z", updated_at: "2026-09-23T18:00:00.000Z", ...patch,
});

describe("T-010: formulário de tarefas na borda do fuso", () => {
  it("editar uma concluída altera só título e preserva estado/timestamps no núcleo", () => {
    const original = task();
    const draft = { ...taskDraft(original), title: "Outro título" };
    const patch = taskPatch(draft, original);
    expect(patch).toEqual({ title: "Outro título" });
    expect(editarModeloTarefa(original, patch, "2026-09-24T12:00:00.000Z")).toMatchObject({ status: "done", completed_at: original.completed_at });
  });

  it("conserva os 12 campos editáveis, incluindo término, posição fracionária e null", () => {
    const original = task();
    expect(taskFields(taskDraft(original), original)).toEqual({
      title: original.title, description: original.description, category_id: original.category_id, project_id: null,
      status: "done", priority: "high", all_day: false, due_at: original.due_at,
      scheduled_start_at: original.scheduled_start_at, scheduled_end_at: original.scheduled_end_at, estimated_minutes: 60, board_position: 2.5,
    });
    expect(taskPatch(taskDraft(original), original)).toEqual({});
  });

  it.each(["2026-09-23T00:15", "2026-09-23T14:30", "2026-09-23T23:55"])("prazo %s volta idêntico independentemente do TZ do processo", (value) => {
    const draft = taskDraft(); draft.title = "Nova tarefa";
    draft.due = editTaskDate(value, draft.due);
    const fields = taskFields(draft);
    expect(taskDateValue(taskDraft(task(fields)).due, false)).toBe(value);
  });

  it("marcar/desmarcar dia inteiro e limpar a data conserva hora lembrada", () => {
    const draft = taskDraft(task());
    expect(taskDateValue(draft.due, true)).toBe("2026-09-23");
    expect(taskDateValue(draft.due, false)).toBe("2026-09-23T14:30");
    const cleared = editTaskDate("", draft.due);
    expect(editTaskDate("2026-09-24", cleared)).toEqual({ day: "2026-09-24", time: "14:30" });
    const fields = taskFields({ ...draft, allDay: true }, task());
    expect(fields.due_at).toBe("2026-09-23T03:00:00.000Z");
    expect(taskDateValue(taskDraft(task(fields)).due, true)).toBe("2026-09-23");
  });

  it("preserva segundos e offset de instantes que não foram editados", () => {
    const original = task({ due_at: "2026-09-23T14:30:27.123-03:00" });
    expect(taskPatch({ ...taskDraft(original), priority: "urgent" }, original)).toEqual({ priority: "urgent" });
  });

  it("editar categoria não reenvia nem trunca descrição herdada da captura", () => {
    const original = task({ origin_capture_id: "capture", description: "a".repeat(7000) });
    expect(taskPatch({ ...taskDraft(original), category: "other" }, original)).toEqual({ category_id: "other" });
    expect(() => taskPatch({ ...taskDraft(original), description: `${original.description}!` }, original)).toThrow(TaskFormError);
  });

  it.each(["0", "-1", "1.5", "NaN", "9007199254740992"])("recusa estimativa inválida %s", (estimate) => {
    expect(() => taskFields({ ...taskDraft(task()), estimate }, task())).toThrow(TaskFormError);
  });

  it("recusa calendário inválido, título vazio e término anterior ao início", () => {
    const draft = taskDraft(task());
    expect(() => taskFields({ ...draft, title: " " })).toThrow(TaskFormError);
    expect(() => taskFields({ ...draft, due: { day: "2026-02-30", time: "09:00" } })).toThrow(TaskFormError);
    expect(() => taskFields({ ...draft, end: { day: "2026-09-23", time: "12:00" } })).toThrow(TaskFormError);
  });
});

describe("T-010: um recorte para tabela e cartões", () => {
  const rows = [task({ id: "active", status: "todo", completed_at: null }), task({ id: "done" }), task({ id: "archived", status: "archived" }), task({ id: "trash", deleted_at: "2026-09-23T12:00:00Z" }), task({ id: "uncategorized", status: "todo", category_id: null, due_at: "2026-09-23T01:00:00Z" })];
  it("separa concluídas, arquivadas e lixeira sem alterar a coleção", () => {
    expect(filterTasks(rows, "done", "", "all", "2026-09-23").map((row) => row.id)).toEqual(["done"]);
    expect(filterTasks(rows, "archived", "", "all", "2026-09-23").map((row) => row.id)).toEqual(["archived"]);
    expect(filterTasks(rows, "trash", "", "all", "2026-09-23").map((row) => row.id)).toEqual(["trash"]);
    expect(rows).toHaveLength(5);
  });
  it("filtra categoria por ID e compara hoje/atraso no fuso do app", () => {
    expect(filterTasks(rows, "active", "dynamic", "today", "2026-09-23").map((row) => row.id)).toEqual(["active"]);
    expect(filterTasks(rows, "active", "none", "overdue", "2026-09-23").map((row) => row.id)).toEqual(["uncategorized"]);
  });
});
