import { dayRangeInTimeZone, diaCivilDe, FUSO_DO_APP, instanteDe, paraCampoLocal } from "../../../core/tempo";
import { segundaDaSemana, somarDias } from "../../../core/habitos/habits";
import type { AgendaEvent, DemoCalendar } from "../../../lib/demo/types";

/** Presentation and persisted views share the additive list preference. */
export type CalendarView = "day" | "week" | "month" | "list";
export type CalendarPreferenceView = CalendarView;
export const CALENDAR_VIEWS = ["day", "week", "month", "list"] as const;
export const CALENDAR_VIEW_LABELS: Record<CalendarView, string> = { day: "Dia", week: "Semana", month: "Mês", list: "Lista" };

export function calendarDay(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && instanteDe(value) ? value : fallback;
}
/** URL view. Unknown values fall back to the month, as before. */
export function calendarView(value: string | null): CalendarView {
  return value === "day" || value === "week" || value === "list" ? value : "month";
}
/** The existing default remains week; unknown values never change that default. */
export function calendarPreferenceView(value: string | null | undefined): CalendarPreferenceView {
  return value === "day" || value === "month" || value === "list" ? value : "week";
}
export function monthStart(day: string) { return day.slice(0, 7) + "-01"; }
export function nextMonthStart(day: string) { return monthStart(somarDias(monthStart(day), 32)); }
export function meetingNoteFields(event: Pick<AgendaEvent, "title" | "starts_at">) {
  // The capture editor accepts 120 characters. Keep the complete Google title
  // in the annotation when shortening it, so the meeting context is not lost.
  const cut = event.title.slice(0, 120);
  const title = /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
  return { title, content: (event.title.length > 120 ? event.title + "\n\n" : "") + "Compromisso: " + paraCampoLocal(event.starts_at, "datetime").replace("T", " às ") + "\n\nNotas da reunião" };
}
/** Month and list move by calendar month; the 31st never skips a month. */
export function shiftPeriod(day: string, view: CalendarView, direction: number) {
  if (view === "day" || view === "week") return somarDias(day, direction * (view === "week" ? 7 : 1));
  return direction > 0 ? nextMonthStart(day) : monthStart(somarDias(monthStart(day), -1));
}
/** Days rendered by the view: one, Monday–Sunday, the 42-cell month grid or the month itself (list). */
export function calendarDays(day: string, view: CalendarView): string[] {
  if (view === "list") {
    const start = day, end = nextMonthStart(day), days: string[] = [];
    for (let value = start; value < end; value = somarDias(value, 1)) days.push(value);
    return days;
  }
  const start = view === "day" ? day : view === "week" ? segundaDaSemana(day) : segundaDaSemana(monthStart(day));
  return Array.from({ length: view === "day" ? 1 : view === "week" ? 7 : 42 }, (_, index) => somarDias(start, index));
}
/** Days of the readable agenda (desktop list and every view up to 680px). */
export function agendaDays(day: string, view: CalendarView): string[] {
  return view === "month" ? calendarDays(monthStart(day), "list") : calendarDays(day, view);
}
export function eventsOnDay(events: readonly AgendaEvent[], day: string) {
  const range = dayRangeInTimeZone(new Date(instanteDe(day)!));
  const start = Date.parse(range.startIso), end = Date.parse(range.endIso);
  return events.filter((event) => Date.parse(event.starts_at) < end && Date.parse(event.ends_at) > start)
    .sort((a, b) => Number(!!b.all_day) - Number(!!a.all_day) || Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id));
}
/** Days with at least one appointment, in order (list view shows only these). */
export function populatedDays(events: readonly AgendaEvent[], days: readonly string[]) {
  return days.filter((value) => eventsOnDay(events, value).length > 0);
}

export const CALENDAR_LIST_PAGE_SIZE = 5;
/** One row per identity, including an ongoing event once at the selected day.
 * Interval intersection preserves all-day exclusive ends across month/year edges. */
export function calendarListRows(events: readonly AgendaEvent[], day: string) {
  const first = Date.parse(instanteDe(day)!), end = Date.parse(instanteDe(nextMonthStart(day))!);
  const unique = new Map<string, AgendaEvent>();
  for (const event of events) if (Date.parse(event.starts_at) < end && Date.parse(event.ends_at) > first && !unique.has(event.id)) unique.set(event.id, event);
  return [...unique.values()].map(event => ({ event, day: diaCivilDe(event.starts_at) < day ? day : diaCivilDe(event.starts_at), ongoing: Date.parse(event.starts_at) < first }))
    .sort((a, b) => a.day.localeCompare(b.day) || Number(!!b.event.all_day) - Number(!!a.event.all_day) || Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at) || a.event.id.localeCompare(b.event.id));
}
export function recentCalendarEvents(events: readonly AgendaEvent[], day: string) {
  const start = Date.parse(instanteDe(day)!);
  return [...new Map(events.filter(event => Date.parse(event.ends_at) <= start).map(event => [event.id, event])).values()]
    .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at) || b.id.localeCompare(a.id)).slice(0, 2);
}

/* ------------------------------------------------------------ timeline -- */
/** OBSERVADO (calendar.js HOUR_HEIGHT): 80px per hour. */
export const HOUR_HEIGHT = 80;
/** OBSERVADO (layoutEvents): a 48-minute window separates short items visually. */
export const COLLISION_MINUTES = 48;
/** OBSERVADO: base 07h–21h, expanded for earlier/later appointments. */
export const BASE_START_HOUR = 7, BASE_END_HOUR = 21;
export interface CalendarSegment { event: AgendaEvent; start: number; end: number; lane: number; lanes: number }
function minutesOf(iso: string) { const local = paraCampoLocal(iso, "datetime"); return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16)); }
export function timedSegments(events: readonly AgendaEvent[], day: string): CalendarSegment[] {
  const range = dayRangeInTimeZone(new Date(instanteDe(day)!));
  const start = Date.parse(range.startIso), end = Date.parse(range.endIso);
  const result = eventsOnDay(events, day).filter((event) => !event.all_day).map((event) => ({
    event, start: Date.parse(event.starts_at) <= start ? 0 : minutesOf(event.starts_at),
    end: Date.parse(event.ends_at) >= end ? 1440 : minutesOf(event.ends_at), lane: 0, lanes: 1,
  }));
  let group: CalendarSegment[] = [], active: CalendarSegment[] = [], lanes = 1;
  const close = () => { for (const item of group) item.lanes = lanes; group = []; lanes = 1; };
  for (const item of result) {
    // A conflict also counts the button's minimum visual window, not only its duration.
    active = active.filter((other) => Math.max(other.end, other.start + COLLISION_MINUTES) > item.start);
    if (!active.length) close();
    const used = new Set(active.map((other) => other.lane));
    while (used.has(item.lane)) item.lane++;
    lanes = Math.max(lanes, item.lane + 1);
    group.push(item); active.push(item);
  }
  close();
  return result;
}
export interface TimelineRange { startHour: number; endHour: number; height: number }
export function timelineRange(segments: readonly CalendarSegment[]): TimelineRange {
  const startHour = Math.min(BASE_START_HOUR, ...segments.map((segment) => Math.floor(segment.start / 60)));
  const endHour = Math.max(BASE_END_HOUR, ...segments.map((segment) => Math.ceil(segment.end / 60)));
  return { startHour, endHour, height: (endHour - startHour) * HOUR_HEIGHT };
}
export type EventDensity = "regular" | "short" | "tiny";
/** OBSERVADO: top+3, height max(44, duration-6); below 105px `short`, below 70px `tiny`.
 * RECOMENDADO: the 44px target never leaves the track at the end of the range. */
export function segmentGeometry(segment: Pick<CalendarSegment, "start" | "end">, range: TimelineRange) {
  const top = Math.max(0, (segment.start - range.startHour * 60) / 60 * HOUR_HEIGHT);
  const bottom = Math.min(range.height, (segment.end - range.startHour * 60) / 60 * HOUR_HEIGHT);
  const span = bottom - top, height = Math.max(44, span - 6);
  const density: EventDensity = span < 70 ? "tiny" : span < 105 ? "short" : "regular";
  return { top: Math.min(top + 3, range.height - height), height, density };
}
export interface AllDaySegment { event: AgendaEvent; first: number; last: number; lane: number }
/** All-day bars span the visible days they cover; Google's end date stays exclusive. */
export function allDaySegments(events: readonly AgendaEvent[], days: readonly string[]) {
  const segments: AllDaySegment[] = [];
  for (const event of events) {
    if (!event.all_day) continue;
    const covered = days.flatMap((value, index) => eventsOnDay([event], value).length ? [index] : []);
    if (covered.length) segments.push({ event, first: covered[0]!, last: covered.at(-1)!, lane: 0 });
  }
  segments.sort((a, b) => a.first - b.first || b.last - a.last || Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at) || a.event.id.localeCompare(b.event.id));
  const occupied: number[] = [];
  for (const segment of segments) {
    while ((occupied[segment.lane] ?? -1) >= segment.first) segment.lane++;
    occupied[segment.lane] = segment.last;
  }
  return { segments, lanes: Math.max(1, occupied.length) };
}

/* ---------------------------------------------------------- formatting -- */
const instant = (day: string) => new Date(instanteDe(day)!);
const format = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, ...options }).format(instant(day));
export const hourOf = (iso: string) => paraCampoLocal(iso, "datetime").slice(11);
export const longDay = (day: string) => format(day, { weekday: "long", day: "numeric", month: "long" });
export const dateWithYear = (day: string) => format(day, { day: "numeric", month: "long", year: "numeric" });
export const dayAndMonth = (day: string) => format(day, { day: "numeric", month: "long" });
export const shortWeekday = (day: string) => format(day, { weekday: "short" }).replace(".", "");
export const monthLabel = (day: string) => format(monthStart(day), { month: "long", year: "numeric" });
/** ISO-8601 week number (weeks start on Monday). */
export function weekNumber(day: string) {
  const thursday = somarDias(segundaDaSemana(day), 3), year = thursday.slice(0, 4);
  const firstThursday = somarDias(segundaDaSemana(year + "-01-04"), 3);
  return Math.round((Date.parse(thursday + "T00:00:00Z") - Date.parse(firstThursday + "T00:00:00Z")) / 604_800_000) + 1;
}
/** OBSERVADO (periodTitle): "12–18 de outubro" plus a supporting "2026 · Semana 42". */
export function periodHeading(day: string, view: CalendarView) {
  if (view === "day") return { title: longDay(day), detail: day.slice(0, 4) + " · Semana " + weekNumber(day) };
  if (view === "month" || view === "list") return { title: format(monthStart(day), { month: "long" }), detail: day.slice(0, 4) };
  const first = segundaDaSemana(day), last = somarDias(first, 6);
  const title = first.slice(0, 7) === last.slice(0, 7) ? Number(first.slice(8)) + "–" + format(last, { day: "numeric", month: "long" })
    : format(first, { day: "numeric", month: "short" }) + " – " + format(last, { day: "numeric", month: "short" });
  const years = first.slice(0, 4) === last.slice(0, 4) ? first.slice(0, 4) : first.slice(0, 4) + "–" + last.slice(0, 4);
  return { title, detail: years + " · Semana " + weekNumber(day) };
}
/** Visible time of an appointment on a given day ("Continua" after midnight). */
export function eventTimeLabel(event: AgendaEvent, day?: string) {
  if (event.all_day) return "Dia inteiro";
  if (day && diaCivilDe(event.starts_at) < day) return "Continua · até " + hourOf(event.ends_at);
  return hourOf(event.starts_at) + " – " + hourOf(event.ends_at);
}
/** Detail dates: all-day shows the last included day; Google's end stays exclusive. */
export function eventDateRange(event: AgendaEvent) {
  const first = diaCivilDe(event.starts_at);
  const exclusive = diaCivilDe(event.ends_at);
  const last = event.all_day ? somarDias(exclusive, -1) : exclusive;
  const span = last > first ? longDay(first) + " até " + longDay(last) : longDay(first);
  if (event.all_day) {
    const count = Math.round((Date.parse(exclusive + "T00:00:00Z") - Date.parse(first + "T00:00:00Z")) / 86_400_000);
    return { span, time: "Dia inteiro" + (count > 1 ? " · " + count + " dias" : ""), exclusiveEnd: format(exclusive, { day: "numeric", month: "long" }) };
  }
  return { span, time: hourOf(event.starts_at) + " – " + hourOf(event.ends_at) + " · horário de São Paulo", exclusiveEnd: null };
}

/* ------------------------------------------------------------- sources -- */
export type SourceTone = "work" | "personal" | "info";
const TONES: readonly SourceTone[] = ["work", "personal", "info"];
/** INFERIDO: demo keys keep their meaning (study → info); Google calendars have no
 * semantic key, so their inks rotate in the server order. Name always accompanies color. */
export function sourceTones(calendars: readonly DemoCalendar[]) {
  const tones = new Map<string, SourceTone>();
  calendars.forEach((calendar, index) => {
    const key = calendar.color_key === "study" ? "info" : calendar.color_key;
    tones.set(calendar.id, TONES.includes(key as SourceTone) ? key as SourceTone : TONES[index % TONES.length]!);
  });
  return tones;
}
