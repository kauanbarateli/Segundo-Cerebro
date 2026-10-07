import { dayRangeInTimeZone, instanteDe, paraCampoLocal } from "../../../core/tempo";
import { segundaDaSemana, somarDias } from "../../../core/habitos/habits";
import type { AgendaEvent } from "../../../lib/demo/types";

export type CalendarView = "day" | "week" | "month";
export function calendarDay(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && instanteDe(value) ? value : fallback;
}
export function calendarView(value: string | null): CalendarView {
  return value === "day" || value === "week" ? value : "month";
}
export function monthStart(day: string) { return day.slice(0, 7) + "-01"; }
export function shiftPeriod(day: string, view: CalendarView, direction: number) {
  if (view !== "month") return somarDias(day, direction * (view === "week" ? 7 : 1));
  return direction > 0 ? monthStart(somarDias(monthStart(day), 32)) : monthStart(somarDias(monthStart(day), -1));
}
export function calendarDays(day: string, view: CalendarView): string[] {
  const start = view === "day" ? day : view === "week" ? segundaDaSemana(day) : segundaDaSemana(monthStart(day));
  return Array.from({ length: view === "day" ? 1 : view === "week" ? 7 : 42 }, (_, index) => somarDias(start, index));
}
export function eventsOnDay(events: readonly AgendaEvent[], day: string) {
  const range = dayRangeInTimeZone(new Date(instanteDe(day)!));
  const start = Date.parse(range.startIso), end = Date.parse(range.endIso);
  return events.filter((event) => Date.parse(event.starts_at) < end && Date.parse(event.ends_at) > start)
    .sort((a, b) => Number(!!b.all_day) - Number(!!a.all_day) || Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id));
}
export interface CalendarSegment { event: AgendaEvent; start: number; end: number; lane: number; lanes: number }
export function timedSegments(events: readonly AgendaEvent[], day: string): CalendarSegment[] {
  const range = dayRangeInTimeZone(new Date(instanteDe(day)!));
  const start = Date.parse(range.startIso), end = Date.parse(range.endIso);
  const minutes = (iso: string) => { const local = paraCampoLocal(iso, "datetime"); return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16)); };
  const result = eventsOnDay(events, day).filter((event) => !event.all_day).map((event) => ({
    event, start: Date.parse(event.starts_at) <= start ? 0 : minutes(event.starts_at),
    end: Date.parse(event.ends_at) >= end ? 1440 : minutes(event.ends_at), lane: 0, lanes: 1,
  }));
  let group: CalendarSegment[] = [], active: CalendarSegment[] = [], lanes = 1;
  const close = () => { for (const item of group) item.lanes = lanes; group = []; lanes = 1; };
  for (const item of result) {
    // Reserve the button's minimum visual height as well as its actual duration.
    active = active.filter((other) => Math.max(other.end, other.start + 64) > item.start);
    if (!active.length) close();
    const used = new Set(active.map((other) => other.lane));
    while (used.has(item.lane)) item.lane++;
    lanes = Math.max(lanes, item.lane + 1);
    group.push(item); active.push(item);
  }
  close();
  return result;
}
