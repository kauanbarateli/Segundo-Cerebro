import { describe, expect, it } from "vitest";
import { createDemoFixture, DEMO_NOW, DEMO_USER_ID } from "../../src/lib/demo/fixtures";
import { projectAgenda, projectCaptures, projectDayProgress, projectFinance, projectHabits, projectHabitsToday, projectRecentNotes, projectRecentPages, projectTasks, projectWeek } from "../../src/components/features/inicio/projections";

describe("Início deriva o mesmo universo compartilhado", () => {
  it("mostra páginas reais por atualização, com caderno acessível e isolamento", () => {
    const page = { id: "a", user_id: DEMO_USER_ID, notebook_id: "book", title: "Página", updated_at: DEMO_NOW, archived_at: null, deleted_at: null };
    const pages = [page, { ...page, id: "b" }, { ...page, id: "z", updated_at: "2026-10-01T00:00:00Z" },
      { ...page, id: "foreign", user_id: "other" }, { ...page, id: "deleted", deleted_at: DEMO_NOW }, { ...page, id: "archived", archived_at: DEMO_NOW },
      { ...page, id: "missing-notebook", notebook_id: "missing" }, { ...page, id: "deleted-notebook", notebook_id: "deleted-book" }, { ...page, id: "foreign-notebook", notebook_id: "foreign-book" }];
    const books = [{ id: "book", name: "Caderno", user_id: DEMO_USER_ID }, { id: "deleted-book", name: "Excluído", deleted_at: DEMO_NOW }, { id: "foreign-book", name: "Outro", user_id: "other" }];
    expect(projectRecentPages(pages, books, DEMO_USER_ID).map(row => [row.id, row.notebook_name])).toEqual([["z", "Caderno"], ["a", "Caderno"], ["b", "Caderno"]]);
    expect(projectRecentPages(pages, [], DEMO_USER_ID)).toEqual([]);
    expect(projectRecentPages([], books, DEMO_USER_ID)).toEqual([]);
    expect(pages[0]).toBe(page);
  });
  it("combina foco, atrasadas e concluídas hoje sem inflar contadores", () => {
    const { initial } = createDemoFixture();
    const result = projectTasks(initial.task!, DEMO_NOW);
    expect(result.focus?.id).toBe("task-milestones");
    expect(result.openCount).toBe(5);
    expect(result.completedWeek).toBe(2);
    expect(result.today.map((item) => item.id)).toEqual(["task-proposta", "task-milestones", "task-racao", "task-rodada"]);
    expect(result.today.some((item) => item.id === "task-fatura")).toBe(false);
  });

  it("concluir atualiza as contagens a partir da entidade; reabrir restaura", () => {
    const { initial } = createDemoFixture();
    const items = initial.task!;
    const task = items.find((item) => item.id === "task-milestones")!;
    task.status = "done"; task.completed_at = DEMO_NOW;
    const completed = projectTasks(items, DEMO_NOW);
    expect(completed.openCount).toBe(4);
    expect(completed.completedWeek).toBe(3);
    expect(completed.today.find((item) => item.id === task.id)?.status).toBe("done");
    task.status = "todo"; task.completed_at = null;
    expect(projectTasks(items, DEMO_NOW)).toMatchObject({ openCount: 5, completedWeek: 2 });
  });

  it("usa o dia de São Paulo perto da virada UTC e não inclui conclusão futura", () => {
    const { initial } = createDemoFixture();
    const base = initial.task![0]!;
    const items = [
      { ...base, id: "local", due_at: "2026-09-24T02:30:00Z", all_day: false },
      { ...base, id: "future", due_at: "2026-09-24T03:00:00Z" },
      { ...base, id: "done", status: "done" as const, completed_at: "2026-09-24T02:00:00Z" },
      { ...base, id: "future-done", status: "done" as const, completed_at: "2026-09-24T03:00:00Z" },
    ];
    const result = projectTasks(items, "2026-09-24T02:45:00Z");
    expect(result.today.map((item) => item.id)).toEqual(["local", "done"]);
    expect(result.completedWeek).toBe(1);
  });

  it("exclui tarefa arquivada e excluída sem alterar a coleção de entrada", () => {
    const { initial } = createDemoFixture();
    const items = initial.task!.map((item, index) => ({ ...item, ...(index % 2 ? { deleted_at: DEMO_NOW } : { archived_at: DEMO_NOW }) }));
    const snapshot = structuredClone(items);
    expect(projectTasks(items, DEMO_NOW)).toEqual({ focus: null, today: [], openCount: 0, completedWeek: 0 });
    expect(items).toEqual(snapshot);
  });

  it("conta organização somente entre capturas vivas e publicadas", () => {
    const { initial } = createDemoFixture();
    const captures = initial.capture!;
    expect(projectCaptures(captures)).toMatchObject({ organized: 4, total: 7 });
    expect(projectCaptures(captures).inbox.map((item) => item.id)).toEqual(["watch", "accountant", "book"]);
    const base = captures[0]!;
    const more = [...captures, { ...base, id: "draft", status: "draft" as const }, { ...base, id: "deleted", deleted_at: DEMO_NOW },
      { ...base, id: "archived", archived_at: DEMO_NOW }, { ...base, id: "status-archived", status: "archived" as const }];
    expect(projectCaptures(more)).toEqual(projectCaptures(captures));
  });

  it("mantém cadências e ordem; marcar Academia leva as práticas da semana de 75% a 88%", () => {
    const { initial } = createDemoFixture();
    const items = [...initial.habit!].reverse();
    const entries = initial.habit_entry!;
    const original = structuredClone({ items, entries });
    const before = projectHabits(items, entries, [], DEMO_NOW);
    expect(before.items.map((row) => row.habit.id)).toEqual(["habit-leitura", "habit-academia", "habit-meditacao"]);
    expect(before.items[0]).toMatchObject({ done: true, summary: { sequenciaAtual: 12 } });
    expect(before.items[1]).toMatchObject({ done: false, weeklyDone: 2, summary: { sequenciaAtual: 5 } });
    // Wednesday: daily3/3, weekly target2/3, selected weekdays1/2.
    // Aggregate practices6/8; a weekly goal is not one completed week.
    expect(before.summary.porHabito.map(row => ({ id: row.habito.id, cumpridos: row.cumpridos, esperados: row.esperados }))).toEqual([
      { id: "habit-leitura", cumpridos: 3, esperados: 3 },
      { id: "habit-academia", cumpridos: 2, esperados: 3 },
      { id: "habit-meditacao", cumpridos: 1, esperados: 2 },
    ]);
    expect(before.summary).toMatchObject({ cumpridos: 6, esperados: 8, taxa: 75 });
    const after = projectHabits(items, [...entries, { id: "new-mark", user_id: DEMO_USER_ID, habit_id: "habit-academia", done_on: "2026-09-23", note: null, created_at: DEMO_NOW }], [], DEMO_NOW);
    expect(after.items[1]).toMatchObject({ done: true, weeklyDone: 3 });
    expect(after.summary).toMatchObject({ cumpridos: 7, esperados: 8, taxa: 88 });
    expect({ items, entries }).toEqual(original);
  });

  it("ignora marcações futuras e hábitos arquivados; pausa desabilita o dia", () => {
    const { initial } = createDemoFixture();
    const items = initial.habit!.map((item) => item.id === "habit-meditacao" ? { ...item, archived_at: DEMO_NOW } : item);
    const entries = [...initial.habit_entry!, { id: "future-mark", user_id: DEMO_USER_ID, habit_id: "habit-academia", done_on: "2026-09-24", note: null, created_at: DEMO_NOW }];
    const pauses = [{ id: "pause", user_id: DEMO_USER_ID, habit_id: "habit-academia", starts_on: "2026-09-23", ends_on: null, reason: null, created_at: DEMO_NOW }];
    const result = projectHabits(items, entries, pauses, DEMO_NOW);
    expect(result.items).toHaveLength(2);
    expect(result.items[1]).toMatchObject({ done: null, weeklyDone: 2 });
  });

  it("agenda usa sobreposição semiaberta do dia local e escolhe o próximo evento vivo", () => {
    const { agenda } = createDemoFixture();
    const base = agenda[0]!;
    const items = [...agenda,
      { ...base, id: "overnight", starts_at: "2026-09-23T02:30:00Z", ends_at: "2026-09-23T03:30:00Z" },
      { ...base, id: "ends-midnight", starts_at: "2026-09-23T02:00:00Z", ends_at: "2026-09-23T03:00:00Z" },
      { ...base, id: "tomorrow", starts_at: "2026-09-24T03:00:00Z", ends_at: "2026-09-24T04:00:00Z" }];
    const snapshot = structuredClone(items);
    expect(projectAgenda(items, DEMO_NOW).items.map((item) => item.id)).toEqual(["overnight", "event-daily", "event-voe", "event-academia"]);
    expect(projectAgenda(items, DEMO_NOW).next?.id).toBe("event-voe");
    expect(projectAgenda(agenda, "2026-09-24T02:00:00Z").next).toBeNull();
    expect(items).toEqual(snapshot);
  });

  it("uma marca existente continua removível depois que uma pausa é registrada", () => {
    const { initial } = createDemoFixture();
    const pauses = [{ id: "pause", user_id: DEMO_USER_ID, habit_id: "habit-leitura", starts_on: "2026-09-23", ends_on: null, reason: null, created_at: DEMO_NOW }];
    const result = projectHabits(initial.habit!, initial.habit_entry!, pauses, DEMO_NOW);
    expect(result.items[0]?.done).toBe(true);
    expect(result.items[0]?.summary.hojeFeito).toBeNull();
  });

  it("pulso financeiro deriva competência, contas, fatura e datas do Núcleo", () => {
    const { initial } = createDemoFixture();
    const result = projectFinance(initial.finance_account!, initial.finance_transaction!, DEMO_NOW);
    expect(result.totals).toMatchObject({ incomeCents: 800000, expenseCents: 324760, balanceCents: 475240 });
    expect(result.balances.find((item) => item.account_id === "account-itau")?.balance_cents).toBe(431742);
    expect(result.balances.find((item) => item.account_id === "account-cdb")?.balance_cents).toBe(1850000);
    expect(result.cards[0]).toMatchObject({ statement: { openCents: 241280 }, closes: "2026-09-28", due: "2026-10-05", status: "aberta" });
  });

  it("pulso ignora previsto/excluído e respeita statement_month diferente da compra", () => {
    const { initial } = createDemoFixture();
    const transactions = initial.finance_transaction!;
    const base = transactions.find((item) => item.id === "fin-food")!;
    const extra = [{ ...base, id: "planned", status: "planned" as const }, { ...base, id: "deleted", deleted_at: DEMO_NOW },
      { ...base, id: "next-statement", statement_month: "2026-10-01" }];
    const result = projectFinance(initial.finance_account!, [...transactions, ...extra], DEMO_NOW);
    expect(result.totals).toMatchObject({ incomeCents: 800000, expenseCents: 324760 });
    expect(result.cards[0]?.statement.openCents).toBe(241280);
  });

  it("coleções vazias produzem ausência real, sem métricas do protótipo", () => {
    expect(projectTasks([], DEMO_NOW)).toEqual({ focus: null, today: [], openCount: 0, completedWeek: 0 });
    expect(projectCaptures([])).toEqual({ inbox: [], organized: 0, total: 0 });
    expect(projectAgenda([], DEMO_NOW)).toEqual({ items: [], next: null });
    expect(projectHabits([], [], [], DEMO_NOW)).toMatchObject({ items: [], summary: { taxa: null, esperados: 0 } });
    expect(projectFinance([], [], DEMO_NOW)).toMatchObject({ balances: [], cards: [], totals: { incomeCents: 0, expenseCents: 0, balanceCents: 0 } });
  });
  it("layout Codex: ritmo, semana e notas recentes saem das mesmas coleções", () => {
    const { initial, agenda } = createDemoFixture();
    const tasks = projectTasks(initial.task!, DEMO_NOW);
    expect(projectDayProgress(tasks.today)).toEqual({ done: 2, total: 4 });
    const habits = projectHabits(initial.habit!, initial.habit_entry!, [], DEMO_NOW);
    expect(projectHabitsToday(habits.items)).toEqual({ done: 1, total: 3 });
    const pausedToday = projectHabits(initial.habit!, initial.habit_entry!, [{ id: "pause", user_id: DEMO_USER_ID, habit_id: "habit-academia", starts_on: "2026-09-23", ends_on: null, reason: null, created_at: DEMO_NOW }], DEMO_NOW);
    expect(projectHabitsToday(pausedToday.items)).toEqual({ done: 1, total: 2 });
    const week = projectWeek(agenda, DEMO_NOW);
    expect(week.map((day) => day.day)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
    expect(week.filter((day) => day.today).map((day) => day.day)).toEqual(["2026-09-23"]);
    expect(week[2]!.count).toBe(projectAgenda(agenda, DEMO_NOW).items.length);
    const captures = initial.capture!;
    const recent = projectRecentNotes([...captures, { ...captures[0]!, id: "archived-note", status: "organized" as const, archived_at: DEMO_NOW, updated_at: "2030-01-01T00:00:00Z" },
      { ...captures[0]!, id: "deleted-note", status: "organized" as const, deleted_at: DEMO_NOW, updated_at: "2030-01-01T00:00:00Z" }]);
    expect(recent).toHaveLength(3);
    expect(recent.every((item) => item.status === "organized" && item.archived_at === null && item.deleted_at === null)).toBe(true);
    expect(projectRecentNotes([])).toEqual([]);
  });
});
