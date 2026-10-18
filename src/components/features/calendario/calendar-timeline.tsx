"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type MutableRefObject } from "react";
import { FUSO_DO_APP, instanteDe } from "@/core/tempo";
import { Icons } from "@/components/ui/icons";
import type { AgendaEvent } from "@/lib/demo/types";
import {
  allDaySegments, calendarDays, dayAndMonth, eventTimeLabel, HOUR_HEIGHT, longDay, segmentGeometry, shortWeekday, timedSegments, timelineRange, type SourceTone,
} from "./calendar-projections";

export interface EventPresentation { tone?: SourceTone; source?: string; note?: boolean }
const offsetLabel = (day: string) => (new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, timeZoneName: "shortOffset" }).formatToParts(new Date(instanteDe(day)!))
  .find(part => part.type === "timeZoneName")?.value ?? "").replace("-", "−");
/** INFERIDO: a lane keeps the 44px target plus 3px on each side (spec §6: left+3, width−6). */
const LANE_WIDTH = 50;
/** RECOMENDADO: 610px week minimum (OBSERVADO) divided by seven equal days. */
const WEEK_DAY_MIN = 73;

export function eventAccessibleName(event: AgendaEvent, time: string, presentation: EventPresentation) {
  return [event.title, time, presentation.source, presentation.note ? "nota vinculada" : ""].filter(Boolean).join(", ");
}

export function CalendarTimeline({ events, day, view, today, onSelect, onOpenDay, describe = () => ({}), scroll }: {
  events: readonly AgendaEvent[]; day: string; view: "day" | "week"; today: string; onSelect(event: AgendaEvent): void;
  /** Week headers open the single day; without it, headers are plain labels. */
  onOpenDay?(day: string): void;
  describe?(event: AgendaEvent): EventPresentation;
  /** The internal scroll survives view/period/filter changes; `resetKey` (Hoje) returns it to the top. */
  scroll?: { position: MutableRefObject<number>; resetKey: number };
}) {
  const timeline = useRef<HTMLDivElement>(null), resetKey = scroll?.resetKey ?? 0, applied = useRef(resetKey);
  const days = calendarDays(day, view).map(value => {
    const segments = timedSegments(events, value);
    const lanes = segments.reduce((maximum, segment) => Math.max(maximum, segment.lanes), 1);
    return { value, segments, min: Math.max(view === "week" ? WEEK_DAY_MIN : 0, lanes > 1 ? lanes * LANE_WIDTH : 0) };
  });
  const range = timelineRange(days.flatMap(({ segments }) => segments));
  const allDay = allDaySegments(events, days.map(({ value }) => value));
  const position = scroll?.position;
  useLayoutEffect(() => { if (timeline.current && position) timeline.current.scrollTop = position.current; }, [position]);
  useEffect(() => {
    if (applied.current === resetKey) return;
    applied.current = resetKey;
    if (timeline.current) timeline.current.scrollTop = 0;
    if (position) position.current = 0;
  }, [resetKey, position]);
  const style = {
    gridTemplateColumns: "var(--cal-hours-col) " + days.map(({ min }) => `minmax(${min}px, 1fr)`).join(" "),
    minWidth: `calc(var(--cal-hours-col) + ${days.reduce((sum, { min }) => sum + min, 0)}px + ${days.length} * var(--cal-col-gap))`,
    "--cal-height": range.height + "px",
    "--cal-all-day-height": allDay.lanes * 48 + 14 + "px",
  } as CSSProperties;
  return <div className="calendar-time-scroll" ref={timeline} tabIndex={0} role="region" aria-label={view === "week" ? "Grade semanal com rolagem interna" : "Grade do dia com rolagem interna"}
    onScroll={event => { if (position) position.current = event.currentTarget.scrollTop; }}>
    <div className={view === "week" ? "calendar-time-grid calendar-time-week" : "calendar-time-grid calendar-time-single"} style={style}>
      <div className="calendar-hours" aria-hidden="true">
        <div className="calendar-time-corner"><span>{offsetLabel(days[0]!.value)}</span></div>
        <div className="calendar-all-day-label">Dia<br />inteiro</div>
        <div className="calendar-hour-labels">{Array.from({ length: range.endHour - range.startHour + 1 }, (_, index) => <span key={index} style={{ top: index * HOUR_HEIGHT }}>{String(range.startHour + index).padStart(2, "0")}:00</span>)}</div>
      </div>
      {days.map(({ value, segments }, index) => {
        const label = longDay(value) + (value === today ? " (hoje)" : "");
        const heading = <><span className="calendar-day-weekday" aria-hidden="true">{shortWeekday(value)}</span><strong aria-hidden="true">{Number(value.slice(8))}</strong></>;
        return <div className="calendar-time-day" role="group" aria-label={label} key={value} data-day={value} data-today={value === today || undefined} data-selected={view === "week" && value === day || undefined} style={{ gridColumn: index + 2 }}>
          <h3 className="calendar-day-label">{onOpenDay ? <button type="button" aria-label={"Abrir " + label} onClick={() => onOpenDay(value)}>{heading}</button>
            : <span className="calendar-day-static">{heading}<span className="calendar-sr-only">{label}</span></span>}</h3>
          <div className="calendar-all-day" />
          <div className="calendar-timeline">
            {Array.from({ length: range.endHour - range.startHour }, (_, hour) => <div className="calendar-hour-rule" key={hour} style={{ top: hour * HOUR_HEIGHT }} aria-hidden="true" />)}
            {segments.map(segment => {
              const presentation = describe(segment.event), time = eventTimeLabel(segment.event, value), geometry = segmentGeometry(segment, range);
              return <button type="button" key={segment.event.id} className="calendar-event calendar-time-event" data-tone={presentation.tone} data-density={geometry.density}
                style={{ top: geometry.top, height: geometry.height, left: `calc(${segment.lane / segment.lanes * 100}% + 3px)`, width: `calc(${100 / segment.lanes}% - 6px)` }}
                aria-label={eventAccessibleName(segment.event, time, presentation)} onClick={() => onSelect(segment.event)}>
                <span className="calendar-event-time">{/^\d\d:\d\d – /.test(time) ? <>{time.slice(0, 5)}<span className="calendar-event-time-end">{time.slice(5)}</span></> : time}</span>
                <strong>{segment.event.title}</strong>
                {(presentation.source || presentation.note) && <span className="calendar-event-source">{presentation.source && <span>{presentation.source}</span>}{presentation.note && <Icons.File width={14} height={14} />}</span>}
              </button>;
            })}
          </div>
        </div>;
      })}
      {allDay.segments.map(segment => {
        const presentation = describe(segment.event), span = segment.last > segment.first ? dayAndMonth(days[segment.first]!.value) + " – " + dayAndMonth(days[segment.last]!.value) : "";
        return <button type="button" key={segment.event.id} className="calendar-event calendar-all-day-event" data-tone={presentation.tone}
          style={{ gridColumn: `${segment.first + 2} / span ${segment.last - segment.first + 1}`, marginTop: segment.lane * 48 + 8 }}
          aria-label={eventAccessibleName(segment.event, "dia inteiro" + (span ? ", " + span : ""), presentation)} onClick={() => onSelect(segment.event)}>
          <Icons.Calendar width={14} height={14} /><strong>{segment.event.title}</strong>{span && <span className="calendar-all-day-range">{span}</span>}
        </button>;
      })}
    </div>
  </div>;
}
