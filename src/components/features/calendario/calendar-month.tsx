"use client";

import type { AgendaEvent } from "@/lib/demo/types";
import { calendarDays, eventsOnDay, eventTimeLabel, hourOf, longDay } from "./calendar-projections";
import { eventAccessibleName, type EventPresentation } from "./calendar-timeline";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
/** OBSERVADO: two appointments per cell, then "+N compromissos" opens the full day. */
const VISIBLE_PER_DAY = 2;

export function CalendarMonth({ events, day, today, onSelect, onOpenDay, describe }: {
  events: readonly AgendaEvent[]; day: string; today: string; onSelect(event: AgendaEvent): void; onOpenDay(day: string): void; describe(event: AgendaEvent): EventPresentation;
}) {
  return <div className="calendar-month" role="region" aria-label="Mês em grade">
    <div className="calendar-month-weekdays" aria-hidden="true">{WEEKDAYS.map(label => <span key={label}>{label}</span>)}</div>
    <div className="calendar-month-grid">{calendarDays(day, "month").map(value => {
      const items = eventsOnDay(events, value), rest = items.length - VISIBLE_PER_DAY;
      return <section className="calendar-month-day" key={value} data-outside={value.slice(0, 7) !== day.slice(0, 7) || undefined} data-today={value === today || undefined}>
        <h3><button type="button" className="calendar-month-date" aria-label={longDay(value)} aria-current={value === today ? "date" : undefined} onClick={() => onOpenDay(value)}>{Number(value.slice(8))}</button></h3>
        {items.slice(0, VISIBLE_PER_DAY).map(event => {
          const presentation = describe(event);
          return <button type="button" key={event.id} className="calendar-event calendar-month-event" data-tone={presentation.tone}
            aria-label={eventAccessibleName(event, eventTimeLabel(event, value), presentation)} onClick={() => onSelect(event)}>
            <span className="calendar-event-dot" aria-hidden="true" />
            {!event.all_day && <span className="calendar-event-time">{eventTimeLabel(event, value).startsWith("Continua") ? "até " + hourOf(event.ends_at) : hourOf(event.starts_at)}</span>}
            <strong>{event.title}</strong>
          </button>;
        })}
        {rest > 0 && <button type="button" className="calendar-more" aria-label={`Ver mais ${rest} ${rest === 1 ? "compromisso" : "compromissos"} de ${longDay(value)}`} onClick={() => onOpenDay(value)}>+{rest} {rest === 1 ? "compromisso" : "compromissos"}</button>}
      </section>;
    })}</div>
  </div>;
}
