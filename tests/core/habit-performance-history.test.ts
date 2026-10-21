import { describe, expect, it } from "vitest";
import type { HabitoDoUsuario } from "../../src/core/contracts";
import { alterarFrequencia, desempenhoDoHabito, desempenhoDosHabitos, resumirHabito, resumirHabitos, resumoDaSequencia, sequenciaAtual, melhorSequencia, type PausaHabito } from "../../src/core/habitos";

const habit: HabitoDoUsuario = { id: "habit", user_id: "alice", name: "Ler", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: "2026-10-19", archived_at: null, color_key: "personal", icon_key: null, position: 0, created_at: "2026-10-19T12:00:00Z", updated_at: "2026-10-19T12:00:00Z" };
const weekly = { schedule_kind: "weekly_target" as const, weekdays: [], weekly_target: 3 };
function changed(before: HabitoDoUsuario, fields: Partial<HabitoDoUsuario>, day: string): HabitoDoUsuario {
  const next = { ...before, ...fields };
  const history = alterarFrequencia(before, next, day);
  return history ? { ...next, frequency_history: history } : next;
}
const marks = (...days: number[]) => new Set(days.map(day => `2026-10-${String(day).padStart(2, "0")}`));
const read = (h: HabitoDoUsuario, done: Set<string>, today: string, pauses: PausaHabito[] = [], from = "2026-10-19", through = today) => desempenhoDoHabito(h, done, from, through, today, pauses);
describe("SPEC08 practices grouped by civil week and frequency", () => {
  it.each([
    { label: "specific days open", h: { ...habit, schedule_kind: "weekdays" as const, weekdays: [1, 3, 5] }, day: "2026-10-21", done: marks(19), expected: 2, actual: 1, real: 1, rate: 50 },
    { label: "weekly open", h: { ...habit, ...weekly }, day: "2026-10-20", done: marks(19), expected: 2, actual: 1, real: 1, rate: 50 },
    { label: "weekly excess", h: { ...habit, ...weekly }, day: "2026-10-25", done: marks(19, 20, 21, 22, 23), expected: 3, actual: 3, real: 5, rate: 100 },
    { label: "future start", h: { ...habit, started_on: "2026-10-26" }, day: "2026-10-25", done: marks(), expected: 0, actual: 0, real: 0, rate: null },
    { label: "partial start", h: { ...habit, ...weekly, started_on: "2026-10-23" }, day: "2026-10-25", done: marks(23, 24), expected: 3, actual: 2, real: 2, rate: 67 },
  ])("$label", ({ h, day, done, expected, actual, real, rate }) => {
    expect(read(h, done, day)).toMatchObject({ esperados: expected, cumpridos: actual, registros: real, taxa: rate });
  });
  it("does not average percentages across habits", () => {
    const a = { ...habit, id: "a", schedule_kind: "weekdays" as const, weekdays: [1] }, b = { ...habit, id: "b" };
    expect(desempenhoDosHabitos([a, b], new Map([["a", marks(19)], ["b", marks(20)]]), "2026-10-19", "2026-10-22", "2026-10-22")).toMatchObject({ registros: 2, cumpridos: 2, esperados: 5, taxa: 40 });
  });
  it("unions overlapping individual/general pauses", () => {
    const pauses = [{ habit_id: null, starts_on: "2026-10-20", ends_on: "2026-10-21" }, { habit_id: habit.id, starts_on: "2026-10-21", ends_on: "2026-10-22" }];
    expect(read(habit, marks(19, 23), "2026-10-23", pauses)).toMatchObject({ registros: 2, esperados: 2, cumpridos: 2, taxa: 100 });
  });
  it("weekly→daily and daily→weekly retain separate expectations", () => {
    const toDay = changed({ ...habit, ...weekly }, habit, "2026-10-22");
    expect(read(toDay, marks(19, 20, 22), "2026-10-22")).toMatchObject({ registros: 3, esperados: 4, cumpridos: 3, taxa: 75 });
    const toWeek = changed(habit, weekly, "2026-10-22");
    expect(read(toWeek, marks(19, 20, 21, 23), "2026-10-23")).toMatchObject({ registros: 4, esperados: 5, cumpridos: 4, taxa: 80 });
  });
  it("excess in one group cannot compensate the other group", () => {
    const h = changed({ ...habit, ...weekly }, { ...weekly, weekly_target: 1 }, "2026-10-22");
    const result = read(h, marks(19, 20, 22, 23), "2026-10-25");
    expect(result).toMatchObject({ registros: 4, esperados: 4, cumpridos: 3, taxa: 75 });
    expect(result.grupos.map(row => [row.registros, row.cumpridos, row.esperados])).toEqual([[2, 2, 3], [2, 1, 1]]);
  });
  it("month/partial week only contains marks and opportunities inside the selection", () => {
    const h = { ...habit, ...weekly, started_on: "2026-09-01" };
    expect(read(h, new Set(["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]), "2026-10-04", [], "2026-10-01")).toMatchObject({ registros: 4, esperados: 3, cumpridos: 3 });
    expect(read(h, marks(20, 21), "2026-10-22", [], "2026-10-21")).toMatchObject({ registros: 1, esperados: 2, cumpridos: 1, taxa: 50 });
  });
  it("future bars are zero and future practices are excluded", () => {
    const result = read(habit, marks(19, 25), "2026-10-20", [], "2026-10-19", "2026-10-25");
    expect(result).toMatchObject({ registros: 1, esperados: 2 });
    expect(result.dias.at(-1)).toEqual({ day: "2026-10-25", registros: 0, futuro: true });
  });
  it("preserved mark belongs once to its group, even with zero expectation", () => {
    const h = changed(habit, { schedule_kind: "weekdays", weekdays: [1] }, "2026-10-21");
    expect(read(h, marks(21), "2026-10-21", [], "2026-10-21")).toMatchObject({ registros: 1, esperados: 0, cumpridos: 0, taxa: null });
    const paused = [{ habit_id: habit.id, starts_on: "2026-10-21", ends_on: "2026-10-21" }];
    expect(read(habit, marks(21), "2026-10-21", paused, "2026-10-21")).toMatchObject({ registros: 1, esperados: 0, cumpridos: 0, taxa: null });
  });
  it("Root freeze: preserved mark can fill a positive expectation in its own group", () => {
    const h = changed(habit, { schedule_kind: "weekdays", weekdays: [3] }, "2026-10-20");
    expect(read(h, marks(20), "2026-10-21", [], "2026-10-20")).toMatchObject({ registros: 1, esperados: 1, cumpridos: 1, taxa: 100 });
    const paused = [{ habit_id: habit.id, starts_on: "2026-10-20", ends_on: "2026-10-20" }];
    expect(read(habit, marks(20), "2026-10-21", paused, "2026-10-20")).toMatchObject({ registros: 1, esperados: 1, cumpridos: 1, taxa: 100 });
  });
  it("archive changes current aggregate selection, without inventing archive intervals", () => {
    const h = { ...habit, archived_at: "2026-10-22T12:00:00Z" };
    expect(read(h, marks(19, 21), "2026-10-25")).toMatchObject({ registros: 2, esperados: 7 });
    expect(desempenhoDosHabitos([h], new Map([[h.id, marks(19, 21)]]), "2026-10-19", "2026-10-25", "2026-10-25")).toMatchObject({ registros: 0, esperados: 0, taxa: null });
  });
});
describe("SPEC08 sequence units and practice metrics are distinct", () => {
  it("public wrappers preserve the period and use practices for both row and total", () => {
    const h = { ...habit, ...weekly }, done = marks(19);
    expect(resumirHabito({ ...h, weekly_target: 1 }, done, "2026-10-21", "2026-10-21", "2026-10-25")).toMatchObject({ esperados: 1, cumpridos: 0, taxa: 0 });
    const summary = resumirHabitos([h], new Map([[h.id, done]]), "2026-10-19", "2026-10-20", "2026-10-20");
    expect(summary).toMatchObject({ esperados: 2, cumpridos: 1, taxa: 50, porHabito: [expect.objectContaining({ esperados: 2, cumpridos: 1, taxa: 50 })] });
  });
  it("public best keeps an earlier day record after days→weeks→days", () => {
    const week = changed(habit, { ...weekly, weekly_target: 1 }, "2026-10-22"), h = changed(week, habit, "2026-10-26"), done = marks(19, 20, 21, 22, 26);
    expect(sequenciaAtual(h, done, "2026-10-26")).toBe(1);
    expect(melhorSequencia(h, done, "2026-10-26")).toBe(3);
    expect(resumirHabito(h, done, "2026-10-19", "2026-10-26", "2026-10-26")).toMatchObject({ sequenciaAtual: 1, melhorSequencia: 3 });
  });
  it("inverted selection is empty; invalid civil dates reject even an empty/archived selection", () => {
    expect(resumirHabito(habit, marks(19), "2026-10-22", "2026-10-21", "2026-10-25")).toMatchObject({ esperados: 0, cumpridos: 0, falhas: 0, taxa: null });
    for (const items of [[], [{ ...habit, archived_at: "2026-10-22T12:00:00Z" }]]) {
      expect(() => resumirHabitos(items, new Map(), "2026-02-30", "2026-10-21", "2026-10-21")).toThrow();
      expect(() => desempenhoDosHabitos(items, new Map(), "2026-02-30", "2026-10-21", "2026-10-21")).toThrow();
    }
  });
  it("closed upper bound 9999-12-31 terminates without advancing into year 10000", () => {
    const h = { ...habit, started_on: "9999-12-30" }, done = new Set(["9999-12-30"]);
    expect(resumirHabito(h, done, "9999-12-30", "9999-12-31", "9999-12-31")).toMatchObject({ esperados: 2, cumpridos: 1, taxa: 50, falhas: 0, sequenciaAtual: 1, melhorSequencia: 1 });
    expect(resumirHabito({ ...h, ...weekly, weekly_target: 1 }, new Set(), "9999-12-30", "9999-12-31", "9999-12-31")).toMatchObject({ esperados: 1, cumpridos: 0, taxa: 0, falhas: 0, sequenciaAtual: 0 });
  });
  it("weekly→daily starts a day segment; historical week best remains separately identified", () => {
    const h = changed({ ...habit, ...weekly }, habit, "2026-10-22");
    const result = resumoDaSequencia(h, marks(19, 20, 21, 22), "2026-10-22");
    expect(result).toMatchObject({ unidade: "dias", atual: 1, melhor: 1, melhores: { dias: 1, semanas: 1 } });
  });
  it("daily→weekly does not turn prior days into weeks, or penalize the open week", () => {
    const h = changed(habit, weekly, "2026-10-22");
    expect(resumoDaSequencia(h, marks(19, 20, 21, 23), "2026-10-23")).toMatchObject({ unidade: "semanas", atual: 0, melhores: { dias: 3, semanas: 0 } });
    expect(resumoDaSequencia(h, marks(19, 20, 21, 22, 23, 24), "2026-10-24")).toMatchObject({ unidade: "semanas", atual: 1, melhores: { dias: 3, semanas: 1 } });
  });
  it("weekday changes keep day unit, without turning a preserved off-day mark into an eligible day", () => {
    const h = changed(habit, { schedule_kind: "weekdays", weekdays: [3] }, "2026-10-20");
    expect(resumoDaSequencia(h, marks(19, 20), "2026-10-21")).toMatchObject({ unidade: "dias", atual: 1, melhor: 1 });
  });
  it("weekly group excess does not buy a completed week", () => {
    const h = changed({ ...habit, ...weekly }, { ...weekly, weekly_target: 1 }, "2026-10-22");
    expect(resumoDaSequencia(h, marks(19, 20, 22, 23), "2026-10-26")).toMatchObject({ unidade: "semanas", atual: 0, melhor: 0 });
  });
});
