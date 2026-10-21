import { exigir, instanteValido } from "../contracts/base";
import { SO_DATA } from "../tempo/tempo";
import type { CadenciaHabito } from "./habits";

interface FrequenciaHistorica {
  readonly schedule_kind: CadenciaHabito;
  readonly weekdays: readonly number[];
  readonly weekly_target: number | null;
}
/** A structural projection of the existing habit, never a new persisted entity. */
export interface HabitoParaHistorico extends FrequenciaHistorica {
  readonly id: string;
  readonly user_id: string;
  readonly started_on: string;
}
export interface VigenciaDeFrequenciaV1 extends FrequenciaHistorica {
  readonly version: 1;
  readonly habit_id: string;
  readonly user_id: string;
  readonly effective_from: string;
}
export interface PeriodoDeFrequenciaV1 extends VigenciaDeFrequenciaV1 {
  /** Exclusive; null means no later supplied frequency change. */
  readonly effective_until: string | null;
}
export type ProvenienciaDoBaseline = "legacy_known_frequency" | "supplied_history";
export interface HistoricoDeFrequenciaV1 {
  readonly version: 1;
  readonly habit_id: string;
  readonly user_id: string;
  readonly started_on: string;
  readonly baseline_provenance: ProvenienciaDoBaseline;
  readonly periods: readonly PeriodoDeFrequenciaV1[];
}
interface EntradaDoHistorico {
  readonly habito: HabitoParaHistorico;
  /** Only absence/undefined denotes legacy. Present empty or null is invalid. */
  readonly historico?: readonly VigenciaDeFrequenciaV1[];
}
interface DiaDaFrequencia {
  readonly version: 1;
  readonly habit_id: string;
  readonly user_id: string;
  readonly day: string;
  readonly started_on: string;
  readonly baseline_provenance: ProvenienciaDoBaseline;
}
export type FrequenciaNoDiaV1 = DiaDaFrequencia & (
  | { readonly status: "not_started"; readonly period: null }
  | { readonly status: "resolved"; readonly period: PeriodoDeFrequenciaV1 }
);

const HABIT_FIELDS = ["id", "user_id", "started_on", "schedule_kind", "weekdays", "weekly_target"];
const HISTORY_FIELDS = ["version", "habit_id", "user_id", "effective_from", "schedule_kind", "weekdays", "weekly_target"];
function objeto(value: unknown, allowed?: readonly string[], required: readonly string[] = allowed ?? []): asserts value is Record<string, unknown> {
  exigir(value !== null && typeof value === "object" && !Array.isArray(value), "Informe os dados da vigência.");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  exigir(Reflect.ownKeys(descriptors).every(key => typeof key === "string" && (!allowed || allowed.includes(key)) && Object.hasOwn(descriptors[key]!, "value")) && required.every(key => Object.hasOwn(descriptors, key)), "Campos de vigência inválidos.");
}
function identidade(value: unknown): asserts value is string {
  exigir(typeof value === "string" && value.trim().length > 0 && value === value.trim(), "Identidade de vigência inválida.");
}
function diaCivil(value: unknown): asserts value is string {
  exigir(typeof value === "string" && SO_DATA.test(value) && instanteValido(`${value}T00:00:00Z`), "Informe um dia civil válido.");
}
function lista(value: unknown): unknown[] {
  exigir(Array.isArray(value), "Informe uma lista de dados de vigência.");
  const fields = Object.getOwnPropertyDescriptors(value), copy: unknown[] = [];
  exigir(Reflect.ownKeys(fields).length === value.length + 1, "Lista de vigência inválida.");
  for (let index = 0; index < value.length; index++) {
    const field = fields[String(index)];
    exigir(field && Object.hasOwn(field, "value"), "Lista de vigência incompleta.");
    copy.push(field.value);
  }
  return copy;
}
function frequencia(value: Record<string, unknown>): FrequenciaHistorica {
  exigir(value.schedule_kind === "daily" || value.schedule_kind === "weekdays" || value.schedule_kind === "weekly_target", "Cadência de vigência inválida.");
  const days = lista(value.weekdays);
  exigir(days.every(day => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6) && new Set(days).size === days.length, "Dias da vigência inválidos.");
  exigir(value.schedule_kind === "weekdays" ? days.length > 0 : days.length === 0, "Dias incompatíveis com a cadência.");
  exigir(value.schedule_kind === "weekly_target" ? Number.isInteger(value.weekly_target) && Number(value.weekly_target) >= 1 && Number(value.weekly_target) <= 7 : value.weekly_target === null, "Meta incompatível com a cadência.");
  return { schedule_kind: value.schedule_kind, weekdays: (days as number[]).sort((a, b) => a - b), weekly_target: value.weekly_target as number | null };
}

function construirHistorico(input: EntradaDoHistorico): HistoricoDeFrequenciaV1 {
  const { habito } = input;
  // Existing habits may carry their other metadata; the versioned history rows
  // and public function envelopes have closed fields of their own.
  objeto(habito, undefined, HABIT_FIELDS);
  identidade(habito.id); identidade(habito.user_id); diaCivil(habito.started_on);
  const known = frequencia(habito);
  const absent = input.historico === undefined;
  let rows: VigenciaDeFrequenciaV1[];
  if (absent) {
    rows = [{ version: 1, habit_id: habito.id, user_id: habito.user_id, effective_from: habito.started_on, ...known }];
  } else {
    const supplied = lista(input.historico);
    exigir(supplied.length > 0, "Histórico presente exige uma vigência inicial.");
    const starts = new Set<string>();
    rows = supplied.map((entry): VigenciaDeFrequenciaV1 => {
      objeto(entry, HISTORY_FIELDS);
      exigir(entry.version === 1, "Versão de vigência não suportada.");
      exigir(entry.habit_id === habito.id && entry.user_id === habito.user_id, "Vigência fora do hábito ou usuário.");
      diaCivil(entry.effective_from);
      exigir(entry.effective_from >= habito.started_on && !starts.has(entry.effective_from), "Início de vigência anterior ou repetido.");
      starts.add(entry.effective_from);
      return { version: 1, habit_id: habito.id, user_id: habito.user_id, effective_from: entry.effective_from, ...frequencia(entry) };
    }).sort((a, b) => a.effective_from.localeCompare(b.effective_from));
    exigir(rows[0]!.effective_from === habito.started_on, "Histórico sem baseline na data inicial.");
  }
  return { version: 1, habit_id: habito.id, user_id: habito.user_id, started_on: habito.started_on,
    baseline_provenance: absent ? "legacy_known_frequency" : "supplied_history",
    periods: rows.map((row, index) => ({ ...row, effective_until: rows[index + 1]?.effective_from ?? null })) };
}

/** No inference about historical edits, marks, activity or permission to write. */
export function normalizarHistoricoDeFrequencia(input: EntradaDoHistorico): HistoricoDeFrequenciaV1 {
  objeto(input, ["habito", "historico"], ["habito"]);
  return construirHistorico(input);
}

/** Resolves a supplied civil day, without a clock or a mark-eligibility decision. */
export function resolverFrequenciaNoDia(input: EntradaDoHistorico & { readonly day: string }): FrequenciaNoDiaV1 {
  objeto(input, ["habito", "historico", "day"], ["habito", "day"]);
  diaCivil(input.day);
  // Validate the complete snapshot even when this particular day predates it.
  const history = construirHistorico(input);
  const common: DiaDaFrequencia = { version: 1, habit_id: history.habit_id, user_id: history.user_id,
    day: input.day, started_on: history.started_on, baseline_provenance: history.baseline_provenance };
  if (input.day < history.started_on) return { ...common, status: "not_started", period: null };
  const period = history.periods.find(row => input.day >= row.effective_from && (row.effective_until === null || input.day < row.effective_until));
  exigir(period, "Dia sem vigência no histórico.");
  return { ...common, status: "resolved", period };
}
