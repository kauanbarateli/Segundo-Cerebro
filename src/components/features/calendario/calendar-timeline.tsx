"use client";

import { useEffect, useRef } from "react";
import { FUSO_DO_APP, instanteDe, paraCampoLocal } from "@/core/tempo";
import type { AgendaEvent } from "@/lib/demo/types";
import { calendarDays, eventsOnDay, timedSegments } from "./calendar-projections";

export function CalendarTimeline({ events, day, view, today, onSelect }: {
  events: readonly AgendaEvent[]; day: string; view: "day" | "week"; today: string; onSelect(event: AgendaEvent): void;
}) {
  const timeline = useRef<HTMLDivElement>(null);
  const days = calendarDays(day, view).map(value => {
    const segments = timedSegments(events, value);
    const lanes = segments.reduce((maximum, segment) => Math.max(maximum, segment.lanes), 1);
    // RECOMENDADO: each lane reserves the 44px target plus its 4px gutter;
    // the day border occupies one more pixel. Headers share these grid tracks.
    const width = Math.max(view === "week" ? 140 : 216, lanes * (44 + 4) + 1);
    return { value, segments, width };
  });
  useEffect(() => { if (timeline.current) timeline.current.scrollTop = 8 * 60; }, [view, day]);
  const eventButton = (event: AgendaEvent) => <button type="button" className="calendar-event calendar-event-compact" key={event.id} onClick={() => onSelect(event)}>
    <span>{event.all_day ? "Dia inteiro" : paraCampoLocal(event.starts_at, "datetime").slice(11)}</span><strong>{event.title}</strong>
  </button>;
  return <div className="calendar-time-scroll" ref={timeline} tabIndex={0} role="region" aria-label={view === "week" ? "Grade semanal com rolagem interna" : "Grade do dia com rolagem interna"}>
    <div className={view === "week" ? "calendar-time-grid calendar-time-week" : "calendar-time-grid"} style={{
      gridTemplateColumns: "64px " + days.map(({ width }) => `minmax(${width}px, 1fr)`).join(" "),
      minWidth: 64 + days.reduce((sum, { width }) => sum + width, 0),
    }}>
      <div className="calendar-hours" aria-hidden="true"><div className="calendar-day-label" /><div className="calendar-all-day">Dia inteiro</div>{Array.from({ length: 24 }, (_, index) => <span key={index}>{String(index).padStart(2, "0")}:00</span>)}</div>
      {days.map(({ value, segments }) => <section className="calendar-time-day" key={value}>
        <h3 className="calendar-day-label">{new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, weekday: "short", day: "numeric", month: "short" }).format(new Date(instanteDe(value)!))}{value === today && <small> hoje</small>}</h3>
        <div className="calendar-all-day">{eventsOnDay(events, value).filter(event => event.all_day).map(eventButton)}</div>
        <div className="calendar-timeline">{segments.map(segment => <div className="calendar-position" key={segment.event.id} style={{ top: segment.start, height: Math.max(64, segment.end - segment.start), left: (segment.lane / segment.lanes * 100) + "%", width: (100 / segment.lanes) + "%" }}>{eventButton(segment.event)}</div>)}</div>
      </section>)}
    </div>
  </div>;
}
