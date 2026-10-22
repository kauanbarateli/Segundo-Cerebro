"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import type { AgendaEvent } from "@/lib/demo/types";
import { CALENDAR_LIST_PAGE_SIZE, calendarDay, calendarListRows, dayAndMonth, eventTimeLabel, longDay, monthStart, nextMonthStart } from "./calendar-projections";
import { somarDias } from "@/core/habitos/habits";
import { diaCivilDe } from "@/core/tempo";
import type { EventPresentation } from "./calendar-timeline";
import { CalendarPeopleStack } from "./calendar-people";

/** Visual pagination is independent of complete, bounded provider pagination. */
export function CalendarList({ events, day, today, confirmed, pageKey = day, onSelect, onDate, describe }: {
  events: readonly AgendaEvent[]; day: string; today: string; confirmed: boolean; onSelect(event: AgendaEvent): void; onDate(day: string): void;
  pageKey?: string;
  describe(event: AgendaEvent): EventPresentation & { account?: string };
}) {
  const rows = useMemo(() => calendarListRows(events, day), [events, day]), [pagination, setPage] = useState({ context: pageKey, index: 0 });
  // Reset only pagination when the source/date context changes. Keep the same
  // input/DOM owner so editing the date never steals keyboard focus.
  const changedContext = pagination.context !== pageKey;
  if (changedContext) setPage({ context: pageKey, index: 0 });
  const requestedPage = changedContext ? 0 : pagination.index;
  const pages = Math.max(1, Math.ceil(rows.length / CALENDAR_LIST_PAGE_SIZE)), page = Math.min(requestedPage, pages - 1);
  const start = page * CALENDAR_LIST_PAGE_SIZE, visible = rows.slice(start, start + CALENDAR_LIST_PAGE_SIZE);
  const heading = useRef<HTMLHeadingElement>(null), requestedFocus = useRef(false), headingId = useId();
  useEffect(() => { if (requestedFocus.current) { requestedFocus.current = false; heading.current?.focus(); } }, [page]);
  const changePage = (value: number) => { requestedFocus.current = true; setPage({ context: pageKey, index: value }); };
  return <section className="calendar-list-view" aria-labelledby={headingId}>
    <div className="calendar-list-heading"><div><h3 id={headingId} ref={heading} tabIndex={-1}>Próximos eventos</h3><p>{dayAndMonth(day)} – {dayAndMonth(somarDias(nextMonthStart(day), -1))} · {rows.length} {rows.length === 1 ? "compromisso" : "compromissos"}{!confirmed ? " no cache parcial" : ""}</p></div>
      <Button variant="ghost" onClick={() => onDate(monthStart(day))}>Ver mês completo</Button></div>
    <Field type="date" label="Data inicial da lista" wrapperClassName="calendar-list-date-control" value={day} onChange={event => { const next = calendarDay(event.target.value, ""); if (next) onDate(next); }} />
    <div className="calendar-list-rows">{visible.map(({ event, day: displayDay, ongoing }) => {
      const presentation = describe(event), people = event.attendees?.filter(person => !person.resource).length ?? 0;
      const label = [event.title, longDay(displayDay), eventTimeLabel(event, displayDay), presentation.source, ongoing ? "Em andamento" : "", presentation.note ? "Nota vinculada" : "", people ? `${people} participantes informados` : "", event.attendees_omitted ? "Elenco parcial" : ""].filter(Boolean).join(", ");
      return <button type="button" className="calendar-list-event" key={event.id} onClick={() => onSelect(event)} aria-label={label} data-tone={presentation.tone} data-day={displayDay}>
        <span className="calendar-list-date" aria-hidden="true"><strong>{Number(displayDay.slice(8))}</strong><span>{dayAndMonth(displayDay).replace(/^\d+ de /, "")}</span>{displayDay === today && <span>Hoje</span>}<b>{eventTimeLabel(event, displayDay)}</b></span>
        <span className="calendar-list-content"><strong>{event.title}</strong>{event.location && <span className="calendar-list-location"><Icons.MapPin width={14} height={14} />{event.location}</span>}
          {ongoing && <span>Em andamento · desde {dayAndMonth(diaCivilDe(event.starts_at))}</span>}
          <span className="calendar-list-footer">{presentation.source && <span className="calendar-source-label" data-tone={presentation.tone}>{presentation.source}</span>}{presentation.note && <span><Icons.File width={14} height={14} />Nota vinculada</span>}<CalendarPeopleStack event={event} /></span>
        </span><Icons.ChevronRight width={18} height={18} aria-hidden="true" />
      </button>;
    })}</div>
    {!!rows.length && <div className="calendar-list-pagination"><span role="status" aria-live="polite">{start + 1}–{Math.min(start + CALENDAR_LIST_PAGE_SIZE, rows.length)} de {rows.length} compromissos</span><div>
      <Button variant="ghost" aria-label="Página anterior de compromissos" disabled={page === 0} onClick={() => changePage(page - 1)}><Icons.ChevronLeft width={18} height={18} /></Button><span>Página {page + 1} de {pages}</span>
      <Button variant="ghost" aria-label="Próxima página de compromissos" disabled={page + 1 === pages} onClick={() => changePage(page + 1)}><Icons.ChevronRight width={18} height={18} /></Button>
    </div></div>}
  </section>;
}
