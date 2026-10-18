"use client";

import { Icons } from "@/components/ui/icons";
import type { AgendaEvent } from "@/lib/demo/types";
import { diaCivilDe } from "@/core/tempo";
import { eventsOnDay, hourOf, longDay, populatedDays, shortWeekday } from "./calendar-projections";
import { eventAccessibleName, type EventPresentation } from "./calendar-timeline";

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
