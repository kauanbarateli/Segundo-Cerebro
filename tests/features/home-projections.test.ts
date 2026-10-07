import { describe, expect, it } from "vitest";
import { createDemoFixture, DEMO_NOW, DEMO_USER_ID } from "../../src/lib/demo/fixtures";
import { projectAgenda, projectCaptures, projectFinance, projectHabits, projectTasks } from "../../src/components/features/inicio/projections";

describe("Início deriva o mesmo universo compartilhado", () => {
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

  it("mantém cadências e ordem; marcar Academia leva a semana de 67% a 83%", () => {
    const { initial } = createDemoFixture();
    const items = [...initial.habit!].reverse();
    const entries = initial.habit_entry!;
    const original = structuredClone({ items, entries });
    const before = projectHabits(items, entries, [], DEMO_NOW);
    expect(before.items.map((row) => row.habit.id)).toEqual(["habit-leitura", "habit-academia", "habit-meditacao"]);
    expect(before.items[0]).toMatchObject({ done: true, summary: { sequenciaAtual: 12 } });
    expect(before.items[1]).toMatchObject({ done: false, weeklyDone: 2, summary: { sequenciaAtual: 5 } });
    expect(before.summary).toMatchObject({ cumpridos: 4, esperados: 6, taxa: 67 });
    const after = projectHabits(items, [...entries, { id: "new-mark", user_id: DEMO_USER_ID, habit_id: "habit-academia", done_on: "2026-09-23", note: null, created_at: DEMO_NOW }], [], DEMO_NOW);
    expect(after.items[1]).toMatchObject({ done: true, weeklyDone: 3 });
    expect(after.summary.taxa).toBe(83);
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
});
