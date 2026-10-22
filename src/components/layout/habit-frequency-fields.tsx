"use client";
import type { CadenciaHabito } from "@/core/habitos";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import "./habit-frequency-fields.css";
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const FULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
/** Shared with onboarding #63; the Core owns validation and creation. */
export function HabitFrequencyFields({ cadence, days, target, disabled, onCadence, onDays, onTarget }: {
  cadence: CadenciaHabito; days: number[]; target: string; disabled: boolean;
  onCadence(value: CadenciaHabito): void; onDays(value: number[]): void; onTarget(value: string): void;
}) {
  return <><Field as="select" label="Frequência" value={cadence} disabled={disabled} onChange={event => onCadence(event.target.value as CadenciaHabito)}><option value="daily">Todos os dias</option><option value="weekdays">Dias específicos</option><option value="weekly_target">Meta semanal</option></Field>
    {cadence === "weekdays" && <fieldset className="habit-frequency-days"><legend>Em quais dias?</legend><div>{[1, 2, 3, 4, 5, 6, 0].map(day => <Button key={day} aria-label={FULL[day]} aria-pressed={days.includes(day)} disabled={disabled} onClick={() => onDays(days.includes(day) ? days.filter(value => value !== day) : [...days, day].sort((a, b) => a - b))}>{DAYS[day]}</Button>)}</div></fieldset>}
    {cadence === "weekly_target" && <Field label="Quantas vezes por semana?" type="number" min={1} max={7} step={1} value={target} required disabled={disabled} onChange={event => onTarget(event.target.value)} hint="Em qualquer dia, de segunda a domingo." />}
  </>;
}
