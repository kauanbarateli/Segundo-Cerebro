import { utcCivil } from "../tempo/civil";
export function diaDaSemana(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(utcCivil(year!, month!, day!)).getUTCDay();
}
export function somarDias(key: string, count: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(utcCivil(year!, month!, day!));
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function diferencaEmDias(from: string, through: string): number {
  const civil = (key: string) => { const [y, m, d] = key.split("-").map(Number); return utcCivil(y!, m!, d!); };
  return Math.round((civil(through) - civil(from)) / 86_400_000);
}
/** Product weeks start on Monday. */
export const segundaDaSemana = (key: string): string => somarDias(key, -((diaDaSemana(key) + 6) % 7));
/** Stop before advancing past the closed upper bound (including year 9999). */
export function* diasCivis(from: string, through: string): Generator<string> {
  let day = from;
  while (day <= through) { yield day; if (day === through) break; day = somarDias(day, 1); }
}
export function* semanasCivis(from: string, through: string): Generator<string> {
  if (from > through) return;
  const last = segundaDaSemana(through);
  for (let week = segundaDaSemana(from); week <= last; week = somarDias(week, 7)) { yield week; if (week === last) break; }
}
export const domingoDaSemana = (monday: string): string => diferencaEmDias(monday, "9999-12-31") < 6 ? "9999-12-31" : somarDias(monday, 6);
