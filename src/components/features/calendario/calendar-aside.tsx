"use client";

import Link from "next/link";
import { useId, useState, type Ref } from "react";
import { segundaDaSemana, somarDias } from "@/core/habitos/habits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import type { AgendaEvent, DemoCalendar } from "@/lib/demo/types";
import { calendarDay, calendarDays, dayAndMonth, eventsOnDay, monthLabel, monthStart, nextMonthStart, type SourceTone } from "./calendar-projections";
import { CalendarSourceToggle } from "./calendar-accounts";
import { CalendarPeopleStack } from "./calendar-people";
import { eventTimeLabel } from "./calendar-projections";
import { diaCivilDe } from "@/core/tempo";

const WEEKDAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"];

/** RECOMENDADO (spec §4): seven 44px columns do not fit the 190–228px aside, so the
 * mini calendar selects whole weeks (full-width 44px rows) and the date field keeps
 * exact day selection. Day headers of the week grid also open a single day. */
function MiniCalendar({ day, today, events, onWeek, onDate, daySelection }: { day: string; today: string; events: readonly AgendaEvent[]; onWeek(day: string): void; onDate(day: string): void; daySelection: boolean }) {
  const [shown, setShown] = useState(() => monthStart(day));
  const [anchor, setAnchor] = useState(day);
  if (anchor !== day) { setAnchor(day); setShown(monthStart(day)); }
  const headingId = useId();
  const cells = calendarDays(shown, "month"), weeks = Array.from({ length: 6 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
  const selectedWeek = segundaDaSemana(day), offset = calendarDays(day, "week").indexOf(day);
  return <section className="calendar-mini" aria-labelledby={headingId}>
    <div className="calendar-mini-heading">
      <h2 id={headingId}>{monthLabel(shown)}</h2>
      <div>
        <Button variant="ghost" className="calendar-icon-button" aria-label="Mês anterior no seletor" onClick={() => setShown(monthStart(somarDias(shown, -1)))}><Icons.ChevronLeft width={16} height={16} /></Button>
        <Button variant="ghost" className="calendar-icon-button" aria-label="Próximo mês no seletor" onClick={() => setShown(nextMonthStart(shown))}><Icons.ChevronRight width={16} height={16} /></Button>
      </div>
    </div>
    <div className="calendar-mini-weekdays" aria-hidden="true">{WEEKDAY_INITIALS.map((letter, index) => <span key={index}>{letter}</span>)}</div>
    {daySelection ? <div className="calendar-mini-date-grid">{cells.map(value => <button type="button" key={value} className="calendar-mini-date" aria-label={"Selecionar " + dayAndMonth(value)} aria-pressed={value === day} aria-current={value === today ? "date" : undefined} data-outside={value.slice(0, 7) !== shown.slice(0, 7) || undefined} onClick={() => onDate(value)}>{Number(value.slice(8))}{eventsOnDay(events, value).length > 0 && <i aria-hidden="true" />}</button>)}</div> : <div className="calendar-mini-weeks">{weeks.map(week => {
      const current = week[0] === selectedWeek;
      return <button type="button" key={week[0]} className="calendar-mini-week" aria-current={current || undefined}
        aria-label={"Ver semana de " + dayAndMonth(week[0]!) + " a " + dayAndMonth(week[6]!)} onClick={() => onWeek(somarDias(week[0]!, offset))}>
        {week.map(value => <span key={value} aria-hidden="true" className="calendar-mini-day" data-outside={value.slice(0, 7) !== shown.slice(0, 7) || undefined}
          data-today={value === today || undefined} data-selected={value === day || undefined}>
          {Number(value.slice(8))}{eventsOnDay(events, value).length > 0 && <i />}
        </span>)}
      </button>;
    })}</div>}
  </section>;
}

export interface CalendarConnectionSummary { title: string; detail: string; href: string | null }

export function CalendarAside({ id, open, day, today, events, sources, tones, counts, hidden, toggleDisabled, connected, connection, onDate, onWeek, onToggle, sourcesRef, daySelection = false, recent, onEvent }: {
  id: string; open: boolean; day: string; today: string; events: readonly AgendaEvent[];
  sources: readonly DemoCalendar[]; tones: ReadonlyMap<string, SourceTone>; counts: ReadonlyMap<string, number>;
  hidden(source: DemoCalendar): boolean; toggleDisabled(source: DemoCalendar): boolean; connected: boolean;
  connection: CalendarConnectionSummary; onDate(day: string): void; onWeek(day: string): void; onToggle(source: DemoCalendar): void;
  sourcesRef: Ref<HTMLHeadingElement>;
  daySelection?: boolean; recent?: readonly AgendaEvent[]; onEvent?(event: AgendaEvent): void;
}) {
  const sourcesTitle = useId(), caption = useId();
  return <aside id={id} className="calendar-aside" data-open={open || undefined} aria-label="Data e calendários">
    <div className="calendar-aside-group">
    <MiniCalendar day={day} today={today} events={events} onWeek={onWeek} onDate={onDate} daySelection={daySelection} />
    {!daySelection && <Field type="date" label="Data do calendário" wrapperClassName="calendar-date-field" value={day}
      onChange={(event) => { const value = calendarDay(event.target.value, ""); if (value) onDate(value); }} />}
    </div>
    <div className="calendar-aside-group">
    {recent !== undefined && <section className="calendar-recent" aria-label="Eventos anteriores"><h2>Eventos anteriores</h2>
      {recent.length ? recent.map(event => <button type="button" key={event.id} onClick={() => onEvent?.(event)}><span>{dayAndMonth(event.all_day ? event.starts_at.slice(0, 10) : diaCivilDe(event.starts_at))} · {eventTimeLabel(event)}</span><strong>{event.title}</strong><CalendarPeopleStack event={event} /></button>) : <p className="calendar-caption">Sem eventos anteriores no cache selecionado.</p>}
    </section>}
    <section className="calendar-sources" aria-labelledby={sourcesTitle}>
      <div className="calendar-aside-title"><h2 id={sourcesTitle} ref={sourcesRef} tabIndex={-1}>Meus calendários</h2><span aria-hidden="true">{sources.length}</span></div>
      {sources.length ? <div role="group" aria-labelledby={sourcesTitle}>{sources.map(source => <CalendarSourceToggle key={source.id} source={source} tone={tones.get(source.id)}
        checked={!hidden(source)} disabled={toggleDisabled(source)} count={hidden(source) ? undefined : counts.get(source.id) ?? 0} onToggle={() => onToggle(source)} describedBy={caption} />)}</div>
        : <p className="calendar-caption">Nenhum calendário disponível. Conecte uma conta Google para escolher as fontes.</p>}
      {sources.length > 0 && <p className="calendar-caption" id={caption}>{connected ? "A seleção também atualiza sua agenda no Início e os lembretes." : "Na demonstração, a escolha vale somente nesta tela e não é salva."}</p>}
    </section>
    {connection.href ? <Link className="calendar-connection" href={connection.href}>
      <span className="calendar-connection-mark" aria-hidden="true"><Icons.Calendar /></span>
      <span className="calendar-connection-copy"><strong>{connection.title}</strong><span>{connection.detail}</span></span>
      <Icons.ChevronRight width={16} height={16} />
    </Link> : <div className="calendar-connection">
      <span className="calendar-connection-mark" aria-hidden="true"><Icons.Calendar /></span>
      <span className="calendar-connection-copy"><strong>{connection.title}</strong><span>{connection.detail}</span></span>
    </div>}
    <p className="calendar-readonly"><Icons.Link width={15} height={15} /><span>Compromissos somente leitura. Notas de reunião ficam ao alcance do evento.</span></p>
    </div>
  </aside>;
}
