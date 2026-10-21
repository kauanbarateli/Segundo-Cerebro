import { exigir, instanteValido } from "../contracts/base";
import { SO_DATA } from "../tempo";
import { diaDaSemana, segundaDaSemana, diasCivis } from "./calendar";
import { estaPausado } from "./pauses";
import type { Habito, PausaHabito } from "./model";
import { estadoDaFrequenciaDe, frequenciaDoDia } from "./frequency-state";

export interface GrupoDePraticas {
  week: string; effective_from: string; from: string; through: string;
  schedule_kind: Habito["schedule_kind"]; registros: number; esperados: number; cumpridos: number;
}
export interface DesempenhoDoHabito {
  habit_id: string; registros: number; esperados: number; cumpridos: number; taxa: number | null;
  grupos: GrupoDePraticas[];
  dias: { day: string; registros: number; futuro: boolean }[];
}
function conferirDia(value: string) { exigir(SO_DATA.test(value) && instanteValido(`${value}T00:00:00Z`), "Período de hábitos inválido."); }
export function conferirPeriodoDoDesempenho(from: string, through: string, today: string) { [from, through, today].forEach(conferirDia); }
const ratio = (done: number, expected: number) => expected ? Math.round(100 * done / expected) : null;

/** Known cadence/pauses, never a reconstruction of unknown archive intervals.
 * Marks are real bars. Each belongs once to a civil week × frequency group;
 * only consistency's numerator is capped, individually for each group. */
export function desempenhoDoHabito(habit: Habito, marks: ReadonlySet<string>, from: string, through: string, today: string, pauses: PausaHabito[] = []): DesempenhoDoHabito {
  conferirPeriodoDoDesempenho(from, through, today);
  const state = estadoDaFrequenciaDe(habit), groups = new Map<string, GrupoDePraticas & { available: number; target: number | null }>();
  const days: DesempenhoDoHabito["dias"] = [];
  for (const day of diasCivis(from, through)) {
    const frequency = frequenciaDoDia(habit, state, day), future = day > today;
    const real = !future && day >= habit.started_on && marks.has(day) ? 1 : 0;
    days.push({ day, registros: real, futuro: future });
    if (future || !frequency) continue;
    const effective = state ? state.changes.filter(row => row.effective_from <= day).at(-1)!.effective_from : habit.started_on;
    const week = segundaDaSemana(day), key = `${week}:${effective}`;
    let group = groups.get(key);
    if (!group) { group = { week, effective_from: effective, from: day, through: day, schedule_kind: frequency.schedule_kind, registros: 0, esperados: 0, cumpridos: 0, available: 0, target: frequency.weekly_target }; groups.set(key, group); }
    group.through = day; group.registros += real;
    if (!estaPausado(habit.id, day, pauses)) {
      group.available++;
      if (frequency.schedule_kind === "daily" || frequency.schedule_kind === "weekdays" && frequency.weekdays.includes(diaDaSemana(day))) group.esperados++;
    }
  }
  const projected: GrupoDePraticas[] = [...groups.values()].map(group => {
    const expected = group.schedule_kind === "weekly_target" ? Math.min(group.target!, group.available) : group.esperados;
    return { week: group.week, effective_from: group.effective_from, from: group.from, through: group.through, schedule_kind: group.schedule_kind, registros: group.registros, esperados: expected, cumpridos: Math.min(group.registros, expected) };
  });
  const registros = days.reduce((n, day) => n + day.registros, 0), esperados = projected.reduce((n, group) => n + group.esperados, 0), cumpridos = projected.reduce((n, group) => n + group.cumpridos, 0);
  return { habit_id: habit.id, registros, esperados, cumpridos, taxa: ratio(cumpridos, esperados), grupos: projected, dias: days };
}

/** Current active selection; use the individual projection for an archived habit's known history. */
export function desempenhoDosHabitos(habits: Habito[], marks: ReadonlyMap<string, Set<string>>, from: string, through: string, today: string, pauses: PausaHabito[] = []) {
  conferirPeriodoDoDesempenho(from, through, today);
  const items = habits.filter(h => h.archived_at === null).map(h => desempenhoDoHabito(h, marks.get(h.id) ?? new Set(), from, through, today, pauses));
  const registros = items.reduce((n, row) => n + row.registros, 0), esperados = items.reduce((n, row) => n + row.esperados, 0), cumpridos = items.reduce((n, row) => n + row.cumpridos, 0);
  const dias: DesempenhoDoHabito["dias"] = [];
  for (const day of diasCivis(from, through)) dias.push({ day, registros: items.reduce((n, row) => n + (row.dias.find(item => item.day === day)?.registros ?? 0), 0), futuro: day > today });
  return { registros, esperados, cumpridos, taxa: ratio(cumpridos, esperados), dias, porHabito: items };
}
