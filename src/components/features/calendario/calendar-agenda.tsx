"use client";

import { Icons } from "@/components/ui/icons";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AgendaEvent } from "@/lib/demo/types";
import { diaCivilDe } from "@/core/tempo";
import { calendarDays, eventDateRange, eventTimeLabel, eventsOnDay, hourOf, longDay, populatedDays, shortWeekday, type CalendarView } from "./calendar-projections";
import { eventAccessibleName, type EventPresentation } from "./calendar-timeline";
import { CalendarPeopleStack } from "./calendar-people";

/** Doc17: the small-screen selector changes only the civil date, never the view
 * or a Google event. Overflow/focus is confined to this strip, not the page. */
export function CalendarDateStrip({ day, today, events, view, onDate }: {
  day: string; today: string; events: readonly AgendaEvent[]; view: CalendarView; onDate(day: string): void;
}) {
  const strip = useRef<HTMLDivElement>(null), month = view === "month";
  const reveal = useCallback((button: HTMLButtonElement) => {
    const container = strip.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect(), item = button.getBoundingClientRect();
    const left = bounds.left + container.clientLeft, right = left + container.clientWidth;
    if (item.left < left) container.scrollLeft += Math.floor(item.left - left);
    else if (item.right > right) container.scrollLeft += Math.ceil(item.right - right);
  }, []);
  useEffect(() => {
    const selected = strip.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (selected) reveal(selected);
  }, [day, view, reveal]);
  return <div className={month ? "calendar-month-picker" : "calendar-week-strip"} ref={strip} role="group" aria-label={month ? "Selecionar dia do mês" : "Selecionar dia da semana"}>
    <div className={month ? "calendar-month-picker-grid" : "calendar-week-strip-grid"}>
      {month && ["S", "T", "Q", "Q", "S", "S", "D"].map((letter, index) => <span className="calendar-picker-weekday" aria-hidden="true" key={index}>{letter}</span>)}
      {calendarDays(day, month ? "month" : "week").map(value => {
        const count = eventsOnDay(events, value).length;
        return <button type="button" key={value} className={month ? "calendar-picker-date" : "calendar-strip-day"} data-day={value}
          data-outside={month && value.slice(0, 7) !== day.slice(0, 7) || undefined} data-today={value === today || undefined}
          aria-pressed={value === day} aria-current={value === today ? "date" : undefined}
          aria-label={`${longDay(value)}, ${count} ${count === 1 ? "compromisso" : "compromissos"}`} onFocus={event => reveal(event.currentTarget)} onClick={() => onDate(value)}>
          {!month && <span>{shortWeekday(value)}</span>}<strong>{Number(value.slice(8))}</strong><i data-events={count > 0 || undefined} aria-hidden="true" />
        </button>;
      })}
    </div>
  </div>;
}

/** The prototype's linear day, shared by desktop Day and the mobile date picker.
 * Expanded context reads the existing DTO only. Notes reuse the existing explicit
 * command boundary; this presentation never writes to Google. */
export function CalendarDayAgenda({ events, day, today, label, onSelect, describe, canCreateNote, canReadNote, busy, onCreateNote, onReviewSources, confirmed = true, hiddenSources = false }: {
  events: readonly AgendaEvent[]; day: string; today: string; label: string;
  onSelect(event: AgendaEvent): void; describe(event: AgendaEvent): EventPresentation & { account?: string };
  canCreateNote: boolean; canReadNote: boolean; busy: boolean; onCreateNote(event: AgendaEvent): void; onReviewSources(): void;
  confirmed?: boolean; hiddenSources?: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null), prefix = useId();
  const rows = eventsOnDay(events, day);
  return <section className="calendar-linear-agenda" role="region" aria-label={label} data-day={day}>
    <header className="calendar-linear-heading"><h3>{day === today ? "Hoje, " : ""}{longDay(day)}</h3><span>{rows.length} {rows.length === 1 ? "compromisso" : "compromissos"}{!confirmed ? " no cache parcial" : ""}</span></header>
    {rows.length ? <div className="calendar-linear-events">{rows.map((event, index) => {
      const presentation = describe(event), open = expanded === event.id, panelId = `${prefix}-${index}`;
      const continues = !event.all_day && diaCivilDe(event.starts_at) < day, time = eventTimeLabel(event, day);
      const minutes = Math.round((Date.parse(event.ends_at) - Date.parse(event.starts_at)) / 60000);
      const range = eventDateRange(event), duration = event.all_day ? range.time.split(" · ")[1] ?? "" : minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`;
      return <article className="calendar-linear-row" key={event.id} data-event={event.id} data-all-day={event.all_day || undefined}>
        <div className="calendar-linear-time" aria-hidden="true">{event.all_day ? <span>Dia<br />inteiro</span> : <><time>{continues ? "00:00" : hourOf(event.starts_at)}</time><span>{hourOf(event.ends_at)}</span>{continues && <small>continua</small>}</>}</div>
        <div className="calendar-appointment" data-expanded={open || undefined}>
          <button type="button" className="calendar-appointment-toggle calendar-event" aria-expanded={open} aria-controls={panelId}
            aria-label={eventAccessibleName(event, time, presentation)} onClick={() => setExpanded(open ? null : event.id)}>
            <strong className="calendar-appointment-title">{event.title}</strong><span className="calendar-appointment-meta">
              {presentation.source && <span className="calendar-source-text" data-tone={presentation.tone}><i aria-hidden="true" />{presentation.source}</span>}
              {duration && <span>{duration}</span>}{presentation.note && <><Icons.File width={14} height={14} /><span className="calendar-sr-only">Nota vinculada</span></>}
            </span><CalendarPeopleStack event={event} /><Icons.ChevronDown className="calendar-appointment-chevron" width={16} height={16} aria-hidden="true" />
          </button>
          <div className="calendar-appointment-context" id={panelId} hidden={!open}>
            {event.location && <p className="calendar-appointment-location"><Icons.MapPin width={14} height={14} /><span>{event.location}</span></p>}
            {event.all_day && range.span.includes(" até ") && <p className="calendar-appointment-location">{range.span}</p>}
            <div className="calendar-context-actions"><Button variant="ghost" onClick={() => onSelect(event)}>Ver detalhes<Icons.ArrowUpRight width={15} height={15} /></Button>
              {canReadNote && event.linked_capture_id ? <Link className="calendar-inline-link" href={"/capturar?capture=" + encodeURIComponent(event.linked_capture_id)}><Icons.File width={15} height={15} />Abrir nota</Link>
                : canCreateNote && <Button variant="ghost" disabled={busy} onClick={() => onCreateNote(event)}><Icons.File width={15} height={15} />Criar nota</Button>}
            </div>
          </div>
        </div>
      </article>;
    })}</div> : !hiddenSources && (confirmed ? <div className="calendar-day-empty"><h4>Nada agendado para este dia</h4><p>Escolha outro dia ou confira os calendários visíveis.</p><Button onClick={onReviewSources}>Revisar calendários</Button></div> : <p className="calendar-caption" role="status">Este dia ainda não está totalmente sincronizado. Confira o cache e sincronize o período.</p>)}
  </section>;
}

/** Readable agenda: the desktop List view and every view up to 680px.
 * Only days with appointments are listed; the caller explains an empty period. */
export function CalendarAgenda({ events, days, today, label, onSelect, describe, location }: {
  events: readonly AgendaEvent[]; days: readonly string[]; today: string; label: string;
  onSelect(event: AgendaEvent): void; describe(event: AgendaEvent): EventPresentation & { account?: string };
  location?: string;
}) {
  const populated = populatedDays(events, days);
  if (!populated.length) return null;
  return <div className="calendar-agenda" role="region" aria-label={label} data-location={location}>
    {populated.map(value => <section className="calendar-agenda-day" key={value} data-day={value}>
      <h3 className="calendar-agenda-date" data-today={value === today || undefined}>
        <strong aria-hidden="true">{Number(value.slice(8))}</strong>
        <span aria-hidden="true">{shortWeekday(value)}{value === today ? " · hoje" : ""}</span>
        <span className="calendar-sr-only">{longDay(value)}{value === today ? " (hoje)" : ""}</span>
      </h3>
      <div className="calendar-agenda-events">{eventsOnDay(events, value).map(event => {
        const presentation = describe(event), continues = !event.all_day && diaCivilDe(event.starts_at) < value;
        const time = event.all_day ? "Dia inteiro" : continues ? "Continua · até " + hourOf(event.ends_at) : hourOf(event.starts_at) + " – " + hourOf(event.ends_at);
        const detail = [event.location ?? presentation.account, presentation.note ? "Nota vinculada" : ""].filter(Boolean).join(" · ");
        return <button type="button" key={event.id} className="calendar-event calendar-agenda-event" data-tone={presentation.tone}
          aria-label={eventAccessibleName(event, time, { ...presentation, source: [event.location, presentation.source].filter(Boolean).join(", ") })} onClick={() => onSelect(event)}>
          <span className="calendar-agenda-time" aria-hidden="true">{event.all_day ? "Dia inteiro" : continues ? "Continua" : hourOf(event.starts_at)}{!event.all_day && <small>{continues ? "até " + hourOf(event.ends_at) : hourOf(event.ends_at)}</small>}</span>
          <span className="calendar-agenda-content" aria-hidden="true"><strong>{event.title}</strong>{detail && <span>{detail}</span>}</span>
          {presentation.source && <span className="calendar-source-label" data-tone={presentation.tone} aria-hidden="true">{presentation.source}</span>}
          <Icons.ChevronRight width={16} height={16} />
        </button>;
      })}</div>
    </section>)}
  </div>;
}
