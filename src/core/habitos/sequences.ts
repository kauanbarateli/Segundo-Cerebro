import type { Habito, PausaHabito } from "./model";
import { diaDaSemana, somarDias, diasCivis, semanasCivis, domingoDaSemana } from "./calendar";
import { estaPausado } from "./pauses";
import { estadoDaFrequenciaDe, frequenciaDoDia } from "./frequency-state";
import { desempenhoDoHabito } from "./performance";

export type UnidadeDaSequencia = "dias" | "semanas";
export interface SegmentoDeSequencia {
  from: string; until: string | null; unidade: UnidadeDaSequencia;
  atual: number; melhor: number; esperados: number; cumpridos: number; falhas: number;
}
/** A unit boundary starts a new segment. Days and weeks are never added or converted. */
export function sequenciasPorUnidade(habit: Habito, marks: ReadonlySet<string>, today: string, pauses: PausaHabito[] = []): SegmentoDeSequencia[] {
  const state = estadoDaFrequenciaDe(habit);
  const periods = state?.changes ?? [{ ...habit, effective_from: habit.started_on }];
  const segments: SegmentoDeSequencia[] = [];
  for (const period of periods) {
    if (period.effective_from > today) break;
    const unit = period.schedule_kind === "weekly_target" ? "semanas" : "dias";
    const previous = segments.at(-1);
    if (previous?.unidade === unit) continue;
    if (previous) previous.until = period.effective_from;
    segments.push({ from: period.effective_from, until: null, unidade: unit, atual: 0, melhor: 0, esperados: 0, cumpridos: 0, falhas: 0 });
  }
  const realMarks = new Set([...marks].filter(day => day <= today));
  for (const segment of segments) {
    const end = segment.until ? somarDias(segment.until, -1) : today;
    if (segment.unidade === "dias") {
      for (const day of diasCivis(segment.from, end)) {
        const frequency = frequenciaDoDia(habit, state, day);
        const expected = !estaPausado(habit.id, day, pauses) && (frequency?.schedule_kind === "daily" || frequency?.schedule_kind === "weekdays" && frequency.weekdays.includes(diaDaSemana(day)));
        if (!expected) continue;
        segment.esperados++;
        if (realMarks.has(day)) { segment.cumpridos++; segment.atual++; segment.melhor = Math.max(segment.melhor, segment.atual); }
        else if (day < today) { segment.atual = 0; segment.falhas++; }
      }
    } else {
      for (const week of semanasCivis(segment.from, end)) {
        const from = week < segment.from ? segment.from : week;
        const sunday = domingoDaSemana(week), through = segment.until && segment.until <= sunday ? somarDias(segment.until, -1) : sunday;
        // Full remaining week is still open, unlike performance cut at today.
        const result = desempenhoDoHabito(habit, realMarks, from, through, through, pauses);
        if (!result.esperados) continue;
        segment.esperados++;
        if (result.cumpridos === result.esperados) { segment.cumpridos++; segment.atual++; segment.melhor = Math.max(segment.melhor, segment.atual); }
        else if (through < today) { segment.atual = 0; segment.falhas++; }
      }
    }
  }
  return segments;
}

export function resumoDaSequencia(habit: Habito, marks: ReadonlySet<string>, today: string, pauses: PausaHabito[] = []) {
  const segments = sequenciasPorUnidade(habit, marks, today, pauses), current = segments.at(-1);
  const best = { dias: 0, semanas: 0 };
  for (const segment of segments) best[segment.unidade] = Math.max(best[segment.unidade], segment.melhor);
  return { unidade: current?.unidade ?? (habit.schedule_kind === "weekly_target" ? "semanas" : "dias"), atual: current?.atual ?? 0, melhor: current?.melhor ?? 0, melhores: best, segmentos: segments };
}
