"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { RelatedPanel } from "@/components/layout/related-panel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import type { Captura } from "@/core/capturas";
import type { AgendaEvent, QueryState } from "@/lib/demo/types";
import { eventDateRange, type SourceTone } from "./calendar-projections";

function Row({ icon, title, detail }: { icon: ReactNode; title: ReactNode; detail: ReactNode }) {
  return <div className="calendar-detail-row">{icon}<div><strong>{title}</strong><span>{detail}</span></div></div>;
}

/** Body of the shared Drawer. Appointments stay read-only: no move, edit or
 * creation in Google. Notes and Relacionado reuse the existing contracts. */
export function CalendarEventDetail({ event, connected, tone, source, account, access, captures, captureId, busy, feedback, onCaptureId, onLink, onCreateNote, onUnlink }: {
  event: AgendaEvent; connected: boolean; tone?: SourceTone; source?: string; account?: string;
  access: { captures: boolean; habits: boolean };
  captures: QueryState<{ items: Captura[] }>; captureId: string; busy: boolean; feedback: string;
  onCaptureId(id: string): void; onLink(): void; onCreateNote(): void; onUnlink(): void;
}) {
  const range = eventDateRange(event);
  return <div className="calendar-detail">
    {source && <span className="calendar-source-label" data-tone={tone}>{source}</span>}
    <Row icon={<Icons.Calendar />} title={range.span} detail={range.time} />
    {range.exclusiveEnd && <p className="calendar-detail-note">O Google registra o término em {range.exclusiveEnd}, exclusivo: o último dia incluído é o informado acima.</p>}
    {event.location && <Row icon={<Icons.MapPin />} title={event.location} detail="Local do compromisso" />}
    <Row icon={<Icons.Link />} title={connected ? "Google Calendar" + (account ? " · " + account : "") : "Agenda de exemplo" + (source ? " · " + source : "")}
      detail={connected ? "Compromisso somente leitura" : "Dados fictícios desta demonstração"} />
    <section className="calendar-detail-context" aria-labelledby="calendar-detail-context">
      <h3 id="calendar-detail-context">Leve o contexto com você</h3>
      <p>{event.linked_capture_id ? "A nota deste compromisso guarda pautas, decisões e próximos passos." : connected && access.captures ? "Reúna pautas, decisões e próximos passos em uma nota vinculada. Para criar tarefas, converta a nota em Capturar." : "Nenhuma nota vinculada a este compromisso."}</p>
      <div className="calendar-detail-links">
        {event.linked_capture_id && access.captures && <Link className="calendar-inline-link" href={"/capturar?capture=" + encodeURIComponent(event.linked_capture_id)}><Icons.File width={18} height={18} />Abrir nota vinculada</Link>}
        {event.habit_id && access.habits && <Link className="calendar-inline-link" href="/habitos"><Icons.Repeat width={18} height={18} />Abrir hábitos</Link>}
        {connected && event.html_link && <a className="calendar-inline-link" href={event.html_link} target="_blank" rel="noopener noreferrer"><Icons.ArrowUpRight width={18} height={18} />Abrir no Google Calendar</a>}
      </div>
      {connected && access.captures && <div className="calendar-note-link">
        <Button variant="primary" disabled={busy} onClick={onCreateNote}>Criar nota de reunião</Button>
        <Field as="select" label="Vincular nota existente" value={captureId} disabled={busy || captures.status !== "ready"} onChange={change => onCaptureId(change.target.value)}>
          <option value="">Selecione uma captura</option>
          {(captures.data?.items ?? []).filter(note => !note.deleted_at).map(note => <option key={note.id} value={note.id}>{note.title ?? note.content?.slice(0, 80) ?? "Sem título"}</option>)}
        </Field>
        <div className="calendar-note-actions">
          <Button disabled={busy || !captureId} onClick={onLink}>Vincular nota</Button>
          {event.linked_capture_id && <Button variant="ghost" disabled={busy} onClick={onUnlink}>Remover vínculo</Button>}
        </div>
        {captures.status === "error" && <p role="alert">{captures.error}</p>}
        {feedback && <p role="status">{feedback}</p>}
      </div>}
    </section>
    {connected && <RelatedPanel type="event" id={event.id} />}
    <p className="calendar-detail-footnote">{connected ? "Alterações no compromisso são feitas no Google Calendar." : "Compromisso de exemplo. Nenhuma conta Google é acessada."}</p>
  </div>;
}
