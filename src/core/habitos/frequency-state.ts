import { assinatura, exigir, instanteValido } from "../contracts/base";
import { SO_DATA } from "../tempo/tempo";
import { normalizarHistoricoDeFrequencia, type HabitoParaHistorico, type VigenciaDeFrequenciaV1 } from "./frequency-history";

export interface EstadoDaFrequenciaV1 {
  readonly version: 1;
  readonly baseline_origin: "legacy_known_frequency" | "created_frequency";
  readonly changes: readonly VigenciaDeFrequenciaV1[];
}
export type Cadencia = Pick<HabitoParaHistorico, "schedule_kind" | "weekdays" | "weekly_target">;
export type HabitoComFrequencia = HabitoParaHistorico & { readonly frequency_history?: EstadoDaFrequenciaV1 };
export type ProjecaoDeFrequencia = Cadencia & { id: string; user_id?: string; started_on: string; frequency_history?: EstadoDaFrequenciaV1 };
const tupla = (value: Cadencia): Cadencia => ({ schedule_kind: value.schedule_kind, weekdays: [...value.weekdays].sort((a, b) => a - b), weekly_target: value.weekly_target });
export const mesmaFrequencia = (a: Cadencia, b: Cadencia): boolean => assinatura(tupla(a)) === assinatura(tupla(b));
const linha = (habit: HabitoParaHistorico, from: string, frequency: Cadencia): VigenciaDeFrequenciaV1 => ({ version: 1, habit_id: habit.id, user_id: habit.user_id, effective_from: from, ...tupla(frequency) });

/** Only a missing key is legacy. Present malformed data must never erase history. */
export function conferirEstadoDaFrequencia(habit: HabitoComFrequencia): EstadoDaFrequenciaV1 | undefined {
  if (!Object.hasOwn(habit, "frequency_history")) {
    normalizarHistoricoDeFrequencia({ habito: habit });
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(habit, "frequency_history");
  exigir(descriptor && Object.hasOwn(descriptor, "value"), "Histórico de frequência inválido.");
  const state: unknown = descriptor.value;
  exigir(state !== null && typeof state === "object" && !Array.isArray(state), "Histórico presente exige dados válidos.");
  exigir(Object.getPrototypeOf(state) === Object.prototype || Object.getPrototypeOf(state) === null, "Objeto de histórico inválido.");
  const fields = Object.getOwnPropertyDescriptors(state);
  exigir(Reflect.ownKeys(fields).length === 3 && ["version", "baseline_origin", "changes"].every(key => fields[key] && Object.hasOwn(fields[key]!, "value")), "Campos de histórico inválidos.");
  exigir(fields.version!.value === 1 && ["legacy_known_frequency", "created_frequency"].includes(fields.baseline_origin!.value), "Origem ou versão de histórico inválida.");
  const normalized = normalizarHistoricoDeFrequencia({ habito: habit, historico: fields.changes!.value });
  const rows = normalized.periods.map(row => linha(habit, row.effective_from, row));
  exigir(assinatura(rows) === assinatura(fields.changes!.value), "Histórico deve ter ordem e cadências canônicas.");
  exigir(mesmaFrequencia(habit, rows[rows.length - 1]!), "Frequência atual diverge do histórico.");
  return { version: 1, baseline_origin: fields.baseline_origin!.value, changes: rows };
}

/** Minimal legacy projections remain supported; a history always carries its real owner. */
export function estadoDaFrequenciaDe(habit: ProjecaoDeFrequencia): EstadoDaFrequenciaV1 | undefined {
  if (!Object.hasOwn(habit, "frequency_history")) return undefined;
  exigir(typeof habit.user_id === "string" && habit.user_id.trim().length > 0, "Histórico sem dono do hábito.");
  return conferirEstadoDaFrequencia(habit as HabitoComFrequencia);
}

export function frequenciaInicial(habit: HabitoParaHistorico): EstadoDaFrequenciaV1 {
  normalizarHistoricoDeFrequencia({ habito: habit });
  return { version: 1, baseline_origin: "created_frequency", changes: [linha(habit, habit.started_on, habit)] };
}

/** Produces the complete canonical history; receives a trusted civil day, never a browser override. */
export function alterarFrequencia(habit: HabitoComFrequencia, next: Cadencia, today: string): EstadoDaFrequenciaV1 | undefined {
  exigir(SO_DATA.test(today) && instanteValido(`${today}T00:00:00Z`), "Dia de alteração inválido.");
  const present = conferirEstadoDaFrequencia(habit);
  normalizarHistoricoDeFrequencia({ habito: { ...habit, ...next } });
  if (mesmaFrequencia(habit, next)) return present;
  const rows = present ? [...present.changes] : [linha(habit, habit.started_on, habit)];
  exigir(rows.every(row => row.effective_from <= today || row.effective_from === habit.started_on), "Histórico possui vigência futura incompatível.");
  if (habit.started_on >= today) rows.splice(0, rows.length, linha(habit, habit.started_on, next));
  else {
    const past = rows.filter(row => row.effective_from < today);
    if (!mesmaFrequencia(past[past.length - 1]!, next)) past.push(linha(habit, today, next));
    rows.splice(0, rows.length, ...past);
  }
  return { version: 1, baseline_origin: present?.baseline_origin ?? "legacy_known_frequency", changes: rows };
}

/** The history is validated once by the caller before iterating a projection. */
export function frequenciaDoDia(habit: Cadencia & { started_on: string }, state: EstadoDaFrequenciaV1 | undefined, day: string): Cadencia | null {
  if (day < habit.started_on) return null;
  if (!state) return habit;
  for (let i = state.changes.length - 1; i >= 0; i--) if (state.changes[i]!.effective_from <= day) return state.changes[i]!;
  return null;
}
