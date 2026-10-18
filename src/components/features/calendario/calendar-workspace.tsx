"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess } from "@/core/access/resolve-access";
import { diaCivilDe } from "@/core/tempo";
import { somarDias } from "@/core/habitos/habits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/dialog";
import { Icons } from "@/components/ui/icons";
import type { AgendaEvent, DemoCalendar } from "@/lib/demo/types";
import {
  agendaDays, CALENDAR_VIEW_LABELS, CALENDAR_VIEWS, calendarDay, calendarDays, calendarPreferenceView, calendarView, eventsOnDay, meetingNoteFields,
  periodHeading, shiftPeriod, sourceTones, type CalendarView,
} from "./calendar-projections";
import { CalendarTimeline, type EventPresentation } from "./calendar-timeline";
import { CalendarMonth } from "./calendar-month";
import { CalendarAgenda } from "./calendar-agenda";
import { CalendarAside, type CalendarConnectionSummary } from "./calendar-aside";
import { CalendarAccounts, syncedText } from "./calendar-accounts";
import { CalendarEventDetail } from "./calendar-event-detail";
import { useCalendarCommands } from "./use-calendar-commands";
import "./calendar.css";

const NOTICES: Record<string, string> = {
  connected: "Conta conectada. Os compromissos serão buscados para este período.",
  "sync-pending": "Conta conectada. Sincronize o período para buscar os compromissos.",
  "consent-denied": "A autorização foi cancelada. Você pode iniciar uma nova conexão.",
  "connection-failed": "A conexão não foi confirmada. Inicie novamente; confira a configuração se o problema persistir.",
};
const MOBILE_LABELS: Record<CalendarView, [string, string]> = { day: ["Agenda do dia", "Agenda do dia em lista"], week: ["Agenda da semana", "Agenda da semana em lista"], month: ["Agenda do mês", "Mês em lista"], list: ["Agenda do mês", "Mês em lista"] };

export function CalendarSkeleton({ view = "week" }: { view?: CalendarView }) {
  return <div className="calendar-skeleton" role="status" aria-label="Carregando calendário">
    <div className="calendar-skeleton-heading" />
    <div className="calendar-skeleton-layout" aria-hidden="true">
      <div className="calendar-skeleton-aside"><i /><i /></div>
      {view === "month" ? <div className="calendar-skeleton-grid">{Array.from({ length: 42 }, (_, index) => <i key={index} />)}</div>
        : view === "list" ? <div className="calendar-skeleton-list">{[0, 1, 2].map(index => <i key={index} />)}</div>
          : <div className={"calendar-skeleton-time calendar-skeleton-" + view}>{Array.from({ length: view === "day" ? 2 : 8 }, (_, index) => <i key={index} />)}</div>}
    </div>
    <div className="calendar-skeleton-mobile" aria-hidden="true">{[0, 1, 2].map(index => <i key={index} />)}</div>
  </div>;
}

export function CalendarWorkspace() {
  const app = useDemoApplication(), query = useDemoQuery("agenda");
  const { policy } = useDemoAccess();
  const connected = app.mode === "connected", captureAccess = resolveAccess("capturar", policy).allowed;
  const habitsAccess = resolveAccess("habitos", policy).allowed, integrationsAccess = resolveAccess("integracoes", policy).allowed;
  const captures = useDemoQuery("captures", connected && captureAccess);
  const [captureId, setCaptureId] = useState("");
  const attempted = useRef(new Set<string>()), noteIds = useRef(new Map<string, string>());
  const commands = useCalendarCommands(useCallback(() => { attempted.current.clear(); noteIds.current.clear(); setCaptureId(""); }, []));
  const { busy, setBusy, feedback, setFeedback, send } = commands;
  const router = useRouter(), params = useSearchParams();
  const [hiddenDemo, setHiddenDemo] = useState<ReadonlySet<string>>(() => new Set());
  const [sourcesOpen, setSourcesOpen] = useState(false), [revealSources, setRevealSources] = useState(0);
  const [shift, setShift] = useState({ count: 0, direction: 0 }), [resetKey, setResetKey] = useState(0);
  const scrollPosition = useRef(0), sourcesHeading = useRef<HTMLHeadingElement>(null);

  const eventDay = query.data?.items.find((event) => event.id === params.get("event"))?.starts_at;
  const day = calendarDay(params.get("date"), eventDay ? diaCivilDe(eventDay) : app.today());
  const view = calendarView(params.get("view") ?? calendarPreferenceView(query.data?.preferences?.default_calendar_view));
  const calendars = useMemo(() => query.data?.calendars ?? [], [query.data?.calendars]);
  const accounts = query.data?.accounts ?? [];
  const tones = useMemo(() => sourceTones(calendars), [calendars]);
  const isHidden = useCallback((source: DemoCalendar) => connected ? source.selected === false : hiddenDemo.has(source.id), [connected, hiddenDemo]);
  const hiddenIds = useMemo(() => new Set(calendars.filter(isHidden).map(source => source.id)), [calendars, isHidden]);
  const events = useMemo(() => (query.data?.items ?? []).filter(event => !event.calendar_id || !hiddenIds.has(event.calendar_id)), [query.data?.items, hiddenIds]);
  const days = calendarDays(day, view);
  // The open detail survives a demo filter change; connected rows are already the selected sources.
  const selected = query.data?.items.find((event) => event.id === params.get("event"));
  const today = app.today();

  const startDay = days[0]!, endDay = somarDias(days.at(-1)!, 1), snapshotWindow = query.data?.window;
  const selectedSources = calendars.some(row => row.selected), connectedAccount = accounts.some(row => row.status === "connected");
  useEffect(() => {
    if (!connected || !connectedAccount || !selectedSources || query.status !== "ready" || (snapshotWindow && startDay >= snapshotWindow.start_day && endDay <= snapshotWindow.end_day)) return;
    const key = startDay + ":" + endDay + ":" + calendars.filter(row => row.selected).map(row => row.id).join(",");
    if (attempted.current.has(key)) return; attempted.current.add(key); void send("calendar.sync", { start_day: startDay, end_day: endDay });
  }, [connected, connectedAccount, selectedSources, query.status, calendars, snapshotWindow, startDay, endDay, send]);
  useEffect(() => { setCaptureId(""); }, [selected?.id]);
  useEffect(() => { if (revealSources) sourcesHeading.current?.focus(); }, [revealSources]);

  async function createNote() {
    if (!selected || !captureAccess) return; setBusy(true); setFeedback("");
    try { let clientId = noteIds.current.get(selected.id); if (!clientId) { clientId = crypto.randomUUID(); noteIds.current.set(selected.id, clientId); } const note = await app.commands.captures.create({ client_id: clientId, type: "note", ...meetingNoteFields(selected), category_id: null, project_id: null }); setCaptureId(note.id); await app.executeDomainCommand("calendar.event.link", { client_id: crypto.randomUUID(), event_id: selected.id, capture_id: note.id }); setFeedback("Nota criada e vinculada."); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Não foi possível confirmar o vínculo. Confira a nota antes de tentar novamente."); } finally { await app.refreshActive(); setBusy(false); }
  }
  function navigate(change: { date?: string; view?: CalendarView; event?: string | null }) {
    const next = new URLSearchParams(params.toString());
    next.set("date", change.date ?? day); next.set("view", change.view ?? view);
    if ("event" in change) { if (change.event) next.set("event", change.event); else next.delete("event"); }
    else next.delete("event");
    router.replace("/calendario?" + next.toString(), { scroll: false });
  }
  const goPeriod = (direction: number) => { navigate({ date: shiftPeriod(day, view, direction) }); setShift(current => ({ count: current.count + 1, direction })); };
  const goToday = () => { navigate({ date: today }); setResetKey(value => value + 1); };
  const openDay = (value: string) => navigate({ date: value, view: "day" });
  const openEvent = (event: AgendaEvent) => navigate({ event: event.id });
  const reviewSources = () => { setSourcesOpen(true); setRevealSources(value => value + 1); };
  function toggleSource(source: DemoCalendar) {
    if (connected) { void send("calendar.select", { calendar_id: source.id, selected: !source.selected }); return; }
    setHiddenDemo(current => { const next = new Set(current); if (next.has(source.id)) next.delete(source.id); else next.add(source.id); return next; });
  }
  const describe = (event: AgendaEvent): EventPresentation & { account?: string } => {
    const source = calendars.find(row => row.id === event.calendar_id);
    return { tone: source ? tones.get(source.id) : undefined, source: source?.name, note: !!event.linked_capture_id, account: connected ? accounts.find(row => row.id === source?.account_id)?.email : undefined };
  };

  if (query.status === "error") return <Card className="calendar-error" data-access="allowed"><h2>Não foi possível abrir o calendário</h2><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo</Button></Card>;
  if (!query.data) return <CalendarSkeleton view={view} />;

  const periodDays = view === "month" ? days.filter((value) => value.slice(0, 7) === day.slice(0, 7)) : days;
  const periodEvents = new Set(periodDays.flatMap((value) => eventsOnDay(events, value).map((event) => event.id)));
  const counts = new Map<string, number>();
  for (const event of events) if (event.calendar_id && periodEvents.has(event.id)) counts.set(event.calendar_id, (counts.get(event.calendar_id) ?? 0) + 1);
  const allHidden = calendars.length > 0 && calendars.every(isHidden);
  const heading = periodHeading(day, view);
  const pending = accounts.find(row => row.status === "revocation_pending"), reauthorize = accounts.find(row => row.status === "reauthorize");
  const connection: CalendarConnectionSummary = connected
    ? { title: "Google Calendar", detail: !accounts.length ? "Nenhuma conta conectada" : pending ? "Revogação pendente" : reauthorize ? "Reconexão necessária" : accounts.length === 1 ? "1 conta conectada" : accounts.length + " contas conectadas", href: "#calendar-accounts" }
    : { title: "Google Calendar", detail: "Nenhuma conta conectada na demonstração", href: integrationsAccess ? "/integracoes" : null };
  const lastSync = accounts.map(row => row.last_synced_at).filter((value): value is string => !!value).sort().at(-1);
  const [mobileLabel, mobileRegion] = MOBILE_LABELS[view];
  const emptyPeriod = !allHidden && periodEvents.size === 0;
  const sourceAccount = (source: DemoCalendar) => accounts.find(row => row.id === source.account_id);

  return <div className="calendar-workspace" data-access="allowed" aria-busy={query.status === "loading" || undefined}>
    <div className="calendar-toolbar">
      <div className="calendar-period">
        <div className="calendar-period-title"><h2>{heading.title}</h2><p>{heading.detail}</p></div>
        <div className="calendar-period-arrows">
          <Button variant="ghost" className="calendar-icon-button" aria-label="Período anterior" onClick={() => goPeriod(-1)}><Icons.ChevronLeft /></Button>
          <Button variant="ghost" className="calendar-icon-button" aria-label="Próximo período" onClick={() => goPeriod(1)}><Icons.ChevronRight /></Button>
        </div>
        <Button className="calendar-today" onClick={goToday}>Hoje</Button>
      </div>
      <div className="calendar-toolbar-actions">
        <Button className="calendar-sources-trigger" aria-expanded={sourcesOpen} aria-controls="calendar-aside" onClick={() => setSourcesOpen(open => !open)}><Icons.List width={18} height={18} /><span className="calendar-sources-label">Calendários</span></Button>
        <div className="calendar-view-tabs" role="group" aria-label="Visão do calendário">{CALENDAR_VIEWS.map(value => <button type="button" key={value} aria-pressed={value === view} onClick={() => navigate({ view: value })}>{CALENDAR_VIEW_LABELS[value]}</button>)}</div>
      </div>
    </div>
    <div className="calendar-layout" data-sources-open={sourcesOpen || undefined}>
      <CalendarAside id="calendar-aside" open={sourcesOpen} day={day} today={today} events={events} sources={calendars} tones={tones} counts={counts}
        hidden={isHidden} toggleDisabled={source => connected && (busy || sourceAccount(source)?.status !== "connected")} connected={connected} connection={connection}
        onDate={value => navigate({ date: value })} onWeek={value => navigate({ date: value, view: "week" })} onToggle={toggleSource} sourcesRef={sourcesHeading} />
      <div className="calendar-stage" data-view={view}>
        {connected && params.has("notice") && <p role="status" className="calendar-message">{NOTICES[params.get("notice")!] ?? "Confira o estado das contas conectadas."}</p>}
        {feedback && <p role="status" className="calendar-feedback">{feedback}</p>}
        {params.has("event") && !selected && <div className="calendar-message calendar-message--action"><div><h2>Compromisso não encontrado</h2><p>Este evento não está disponível na agenda atual.</p></div><Button onClick={() => navigate({ event: null })}>Voltar à agenda</Button></div>}
        {allHidden && <div className="calendar-message calendar-message--action"><div><h2>Todos os calendários estão ocultos</h2><p>Selecione ao menos uma fonte para ver seus compromissos.</p></div><Button onClick={reviewSources}>Revisar calendários</Button></div>}
        {emptyPeriod && <div className="calendar-empty" data-view={view}>
          <span className="calendar-empty-icon" aria-hidden="true"><Icons.Calendar /></span>
          <h2>Nenhum compromisso neste período</h2>
          <p>{connected ? "Confira os calendários selecionados e sincronize este período." : "Volte ao dia de exemplo para retomar a agenda."}</p>
          <div><Button onClick={goToday}>Voltar para hoje</Button>{calendars.length > 0 && <Button variant="ghost" onClick={reviewSources}>Revisar calendários</Button>}</div>
        </div>}
        <div className="calendar-motion" data-shift={shift.count ? (shift.direction > 0 ? "next" : "previous") : undefined} data-cycle={shift.count % 2}>
          <div className="calendar-large">
            {view === "month" ? <CalendarMonth events={events} day={day} today={today} onSelect={openEvent} onOpenDay={openDay} describe={describe} />
              : view === "list" ? <CalendarAgenda events={events} days={days} today={today} label="Lista do mês" onSelect={openEvent} describe={describe} />
                : <CalendarTimeline events={events} day={day} view={view} today={today} onSelect={openEvent} onOpenDay={view === "week" ? openDay : undefined} describe={describe} scroll={{ position: scrollPosition, resetKey }} />}
          </div>
          <div className="calendar-mobile">
            {!emptyPeriod && !allHidden && <p className="calendar-mobile-label">{mobileLabel}</p>}
            <CalendarAgenda events={events} days={agendaDays(day, view)} today={today} label={mobileRegion} onSelect={openEvent} describe={describe} location="mobile" />
          </div>
        </div>
        <div className="calendar-status">
          <p className="calendar-note"><i aria-hidden="true" />{connected ? "Agenda Google em modo de leitura · horários de São Paulo." : "Agenda de exemplo · horários de São Paulo. Nenhuma conta externa conectada."}</p>
          {connected && lastSync && <span className="calendar-status-sync">{syncedText(lastSync)}</span>}
          {connected && <Button variant="ghost" disabled={busy || !connectedAccount || !selectedSources} onClick={() => void send("calendar.sync", { start_day: startDay, end_day: endDay })}><Icons.Refresh width={16} height={16} />{busy ? "Confirmando…" : "Sincronizar período"}</Button>}
        </div>
      </div>
    </div>
    {connected && <CalendarAccounts agenda={query.data} commands={commands} tones={tones} layout="calendar" />}
    <Drawer open={!!selected} onClose={() => navigate({ event: null })} className="calendar-detail-drawer" title={selected?.title ?? "Compromisso"} description={connected ? "Compromisso Google · somente leitura" : "Evento da agenda de exemplo"}>
      {selected && <CalendarEventDetail event={selected} connected={connected} tone={describe(selected).tone} source={describe(selected).source} account={describe(selected).account} access={{ captures: captureAccess, habits: habitsAccess }} captures={captures}
        captureId={captureId} busy={busy} feedback={feedback} onCaptureId={setCaptureId} onCreateNote={() => void createNote()}
        onLink={() => void send("calendar.event.link", { event_id: selected.id, capture_id: captureId })} onUnlink={() => void send("calendar.event.link", { event_id: selected.id, capture_id: null })} />}
    </Drawer>
  </div>;
}
