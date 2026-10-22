import type { PausaHabito } from "./model";
export function estaPausado(habitId: string, day: string, pauses: PausaHabito[]): boolean {
  return pauses.some(p => (p.habit_id === null || p.habit_id === habitId) && day >= p.starts_on && (p.ends_on === null || day <= p.ends_on));
}
