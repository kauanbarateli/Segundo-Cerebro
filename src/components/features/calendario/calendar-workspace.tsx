"use client";

import Link from "next/link";
import { RelatedPanel } from "@/components/layout/related-panel";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_LOGOUT_EVENT, useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess } from "@/core/access/resolve-access";
import { diaCivilDe, FUSO_DO_APP, instanteDe, paraCampoLocal } from "@/core/tempo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Drawer } from "@/components/ui/dialog";
import { calendarDay, calendarDays, calendarView, eventsOnDay, monthStart, shiftPeriod, timedSegments, type CalendarView } from "./calendar-projections";
import type { AgendaEvent } from "@/lib/demo/types";
import { somarDias } from "@/core/habitos/habits";
import "./calendar.css";

const hour = (iso: string) => paraCampoLocal(iso, "datetime").slice(11);
const dateText = (day: string, long = false) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short" }).format(new Date(instanteDe(day)!));
export function CalendarSkeleton({ view = "month" }: { view?: CalendarView }) {
  return <div className="calendar-skeleton" role="status" aria-label="Carregando calendário"><div className="calendar-skeleton-heading" />{view === "month" ? <><div className="calendar-skeleton-grid" aria-hidden="true">{Array.from({ length: 42 }, (_, index) => <i key={index} />)}</div><div className="calendar-skeleton-mobile" aria-hidden="true">{[0, 1, 2, 3].map((index) => <i key={index} />)}</div></> : <div className={"calendar-skeleton-time calendar-skeleton-" + view} aria-hidden="true">{Array.from({ length: view === "day" ? 2 : 8 }, (_, index) => <i key={index} />)}</div>}</div>;
}
export function CalendarWorkspace() {
  const app = useDemoApplication(), query = useDemoQuery("agenda");
  const { executeDomainCommand, refreshActive } = app;
  const { policy } = useDemoAccess();
  const connected = app.mode === "connected", captureAccess = resolveAccess("capturar", policy).allowed;
  const captures = useDemoQuery("captures", connected && captureAccess);
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(""), [captureId, setCaptureId] = useState("");
  const attempted = useRef(new Set<string>()), noteIds = useRef(new Map<string, string>());
  const connection = useRef({ generation: 0, closing: false, controller: null as AbortController | null });
  useEffect(() => {
    const state = connection.current; state.closing = false; state.generation++;
    const end = () => { state.closing = true; state.generation++; state.controller?.abort(); state.controller = null; attempted.current.clear(); noteIds.current.clear(); setCaptureId(""); setFeedback(""); setBusy(false); };
    const logout = (event: Event) => { const detail: unknown = (event as CustomEvent<unknown>).detail; if (detail && typeof detail === "object" && "userId" in detail && detail.userId === app.userId) end(); };
    window.addEventListener(DEMO_LOGOUT_EVENT, logout); return () => { window.removeEventListener(DEMO_LOGOUT_EVENT, logout); end(); };
  }, [app.userId]);
  const router = useRouter(), params = useSearchParams();
  const eventDay = query.data?.items.find((event) => event.id === params.get("event"))?.starts_at;
  const day = calendarDay(params.get("date"), eventDay ? diaCivilDe(eventDay) : app.today()), view = calendarView(params.get("view") ?? query.data?.preferences?.default_calendar_view ?? "month");
  const events = query.data?.items ?? [], days = calendarDays(day, view);
  const selected = events.find((event) => event.id === params.get("event"));
  const timeline = useRef<HTMLDivElement>(null);
  const layoutReady = query.data !== null;
  useEffect(() => { if (view !== "month" && timeline.current) timeline.current.scrollTop = 8 * 60; }, [view, day, layoutReady]);
  const send = useCallback(async (command: string, input: Record<string, unknown>) => {
    setBusy(true); setFeedback("");
    try { await executeDomainCommand(command, { ...input, client_id: crypto.randomUUID() }); setFeedback("Agenda atualizada."); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Não foi possível confirmar a operação. Confira o estado e tente novamente."); }
    finally { await refreshActive(); setBusy(false); }
  }, [executeDomainCommand, refreshActive]);
  const startDay = days[0]!, endDay = somarDias(days.at(-1)!, 1), snapshotWindow = query.data?.window;
  const selectedSources = (query.data?.calendars ?? []).some(row => row.selected), connectedAccount = (query.data?.accounts ?? []).some(row => row.status === "connected");
  useEffect(() => {
    if (!connected || !connectedAccount || !selectedSources || query.status !== "ready" || (snapshotWindow && startDay >= snapshotWindow.start_day && endDay <= snapshotWindow.end_day)) return;
    const key = startDay + ":" + endDay + ":" + (query.data?.calendars ?? []).filter(row => row.selected).map(row => row.id).join(",");
    if (attempted.current.has(key)) return; attempted.current.add(key); void send("calendar.sync", { start_day: startDay, end_day: endDay });
  }, [connected, connectedAccount, selectedSources, query.status, query.data?.calendars, snapshotWindow, startDay, endDay, send]);
  useEffect(() => { setCaptureId(""); }, [selected?.id]);
  async function connect(accountId?: string) {
    const state = connection.current; if (state.closing || app.closing || state.controller) return;
    const controller = new AbortController(), generation = ++state.generation; state.controller = controller;
    const alive = () => !state.closing && !app.closing && !controller.signal.aborted && state.generation === generation;
    setBusy(true); setFeedback(""); try { const response = await fetch("/api/calendar/oauth/start", { method: "POST", credentials: "same-origin", redirect: "error", cache: "no-store", signal: controller.signal, headers: { "Content-Type": "application/json", "X-Expected-User-ID": app.userId }, body: JSON.stringify({ client_id: crypto.randomUUID(), ...(accountId ? { account_id: accountId } : {}) }) }), result: unknown = await response.json(); if (!alive()) return;
      if (response.status === 409 && result && typeof result === "object" && "code" in result && result.code === "SESSION_CHANGED") { await app.clearSessionJournal(); if (alive()) window.location.reload(); return; }
      if (!response.ok || !result || typeof result !== "object" || !("authorization_url" in result) || typeof result.authorization_url !== "string") throw new Error(result && typeof result === "object" && "message" in result && typeof result.message === "string" ? result.message : "Não foi possível iniciar a conexão. Confira a configuração da integração e tente novamente.");
      const target = new URL(result.authorization_url); if (target.origin !== "https://accounts.google.com" || target.pathname !== "/o/oauth2/v2/auth") throw new Error("O endereço de autorização não foi confirmado."); window.location.assign(target.href);
    } catch (error) { if (alive()) { setFeedback(error instanceof Error ? error.message : "Não foi possível conectar a agenda."); setBusy(false); } } finally { if (state.controller === controller) state.controller = null; }
  }
  async function createNote() {
    if (!selected || !captureAccess) return; setBusy(true); setFeedback("");
    try { let clientId = noteIds.current.get(selected.id); if (!clientId) { clientId = crypto.randomUUID(); noteIds.current.set(selected.id, clientId); } const note = await app.commands.captures.create({ client_id: clientId, type: "note", title: selected.title.slice(0, 200), content: "Compromisso: " + paraCampoLocal(selected.starts_at, "datetime").replace("T", " às ") + "\n\nNotas da reunião", category_id: null, project_id: null }); setCaptureId(note.id); await app.executeDomainCommand("calendar.event.link", { client_id: crypto.randomUUID(), event_id: selected.id, capture_id: note.id }); setFeedback("Nota criada e vinculada."); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Não foi possível confirmar o vínculo. Confira a nota antes de tentar novamente."); } finally { await app.refreshActive(); setBusy(false); }
  }
  function navigate(change: { date?: string; view?: CalendarView; event?: string | null }) {
    const next = new URLSearchParams(params.toString());
    next.set("date", change.date ?? day); next.set("view", change.view ?? view);
    if ("event" in change) { if (change.event) next.set("event", change.event); else next.delete("event"); }
    else next.delete("event");
    router.replace("/calendario?" + next.toString(), { scroll: false });
  }
  const eventButton = (event: AgendaEvent, compact = false) => <button className={compact ? "calendar-event calendar-event-compact" : "calendar-event"} key={event.id} onClick={() => navigate({ event: event.id })}>
    <span>{event.all_day ? "Dia inteiro" : hour(event.starts_at)}</span><strong>{event.title}</strong>
  </button>;
  if (query.status === "error") return <Card className="calendar-error" data-access="allowed"><h2>Não foi possível abrir o calendário</h2><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo</Button></Card>;
  if (!query.data) return <CalendarSkeleton view={view} />;
  const visibleEvents = new Set(days.filter((value) => view !== "month" || value.slice(0, 7) === day.slice(0, 7)).flatMap((value) => eventsOnDay(events, value).map((event) => event.id)));
  return <div className="calendar-workspace" data-access="allowed" aria-busy={query.status === "loading" || undefined}>
    <div className="calendar-toolbar"><div className="calendar-view-choices" role="group" aria-label="Visão do calendário">{(["day", "week", "month"] as const).map((value) => <Button key={value} variant={value === view ? "primary" : "secondary"} aria-pressed={value === view} onClick={() => navigate({ view: value })}>{{ day: "Dia", week: "Semana", month: "Mês" }[value]}</Button>)}</div><Field type="date" label="Data do calendário" value={day} onChange={(event) => { const value = calendarDay(event.target.value, ""); if (value) navigate({ date: value }); }} /></div>
    <div className="calendar-period"><Button aria-label="Período anterior" onClick={() => navigate({ date: shiftPeriod(day, view, -1) })}>Anterior</Button><h2>{view === "month" ? new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, month: "long", year: "numeric" }).format(new Date(instanteDe(monthStart(day))!)) : dateText(day, true)}</h2><Button aria-label="Próximo período" onClick={() => navigate({ date: shiftPeriod(day, view, 1) })}>Próximo</Button><Button onClick={() => navigate({ date: app.today() })}>Hoje</Button></div>
    <p className="calendar-note">{connected ? "Agenda Google em modo de leitura · horários de São Paulo." : "Agenda de exemplo · horários de São Paulo. Nenhuma conta externa conectada."}</p>
    {connected && <section className="calendar-connections" aria-labelledby="calendar-accounts-title"><div className="calendar-connections-heading"><h2 id="calendar-accounts-title">Contas e calendários</h2><Button disabled={busy || (query.data.accounts?.length ?? 0) >= 2} onClick={() => void connect()}>Conectar Google</Button><Button disabled={busy || !connectedAccount || !selectedSources} onClick={() => void send("calendar.sync", { start_day: startDay, end_day: endDay })}>{busy ? "Confirmando…" : "Sincronizar período"}</Button><Link href="/configuracoes#agenda">Preferências da agenda</Link></div><p>Conecte até duas contas. Os calendários selecionados também aparecem no Início e nos lembretes.</p>
      {(query.data.accounts ?? []).map(account => <div className="calendar-account" key={account.id}><div className="calendar-account-heading"><strong>{account.email}</strong><span>{account.status === "connected" ? "Conectada" : account.status === "reauthorize" ? "Reconexão necessária" : "Revogação pendente"}</span>{account.last_synced_at && <small>Sincronizada em {paraCampoLocal(account.last_synced_at, "datetime").replace("T", " às ")}</small>}<Button disabled={busy || account.status === "revocation_pending"} onClick={() => void connect(account.id)}>Reconectar</Button><Button disabled={busy} onClick={() => void send("calendar.disconnect", { account_id: account.id })}>{account.status === "revocation_pending" ? "Retomar desconexão" : "Desconectar"}</Button></div><div className="calendar-source-choices">{(query.data?.calendars ?? []).filter(source => source.account_id === account.id).map(source => <Switch key={source.id} label={source.name} checked={source.selected ?? false} disabled={busy || account.status !== "connected"} onCheckedChange={selected => void send("calendar.select", { calendar_id: source.id, selected })} />)}</div></div>)}
      {!query.data.accounts?.length && <p>Nenhuma conta Google conectada. Conecte uma conta para escolher os calendários.</p>}
    </section>}
    {connected && params.has("notice") && <p role="status" className="calendar-feedback">{({ connected: "Conta conectada. Os compromissos serão buscados para este período.", "sync-pending": "Conta conectada. Sincronize o período para buscar os compromissos.", "consent-denied": "A autorização foi cancelada. Você pode iniciar uma nova conexão.", "connection-failed": "A conexão não foi confirmada. Inicie novamente; confira a configuração se o problema persistir." } as Record<string, string>)[params.get("notice")!] ?? "Confira o estado das contas conectadas."}</p>}
    {feedback && <p role="status" className="calendar-feedback">{feedback}</p>}
    {params.has("event") && !selected && <Card className="calendar-empty"><h2>Compromisso não encontrado</h2><p>Este evento não está disponível na agenda atual.</p><Button onClick={() => navigate({ event: null })}>Voltar à agenda</Button></Card>}
    {visibleEvents.size === 0 && <Card className="calendar-empty"><h2>Nenhum compromisso neste período</h2><p>{connected ? "Confira os calendários selecionados e sincronize este período." : "Volte ao dia de exemplo para retomar a agenda."}</p><Button onClick={() => navigate({ date: app.today() })}>Voltar para hoje</Button></Card>}
    {view === "month" ? <>
      <div className="calendar-month" aria-label="Mês em grade">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => <div className="calendar-weekday" key={label} aria-hidden="true">{label}</div>)}{days.map((value) => <section className="calendar-month-day" key={value} data-outside={value.slice(0, 7) !== day.slice(0, 7) || undefined} data-today={value === app.today() || undefined}><h3><button onClick={() => navigate({ date: value, view: "day" })} aria-label={dateText(value, true)}>{value.slice(8)}{value === app.today() && <span> hoje</span>}</button></h3>{eventsOnDay(events, value).map((event) => eventButton(event, true))}</section>)}</div>
      <div className="calendar-month-list" aria-label="Mês em lista">{days.filter((value) => value.slice(0, 7) === day.slice(0, 7) && eventsOnDay(events, value).length > 0).map((value) => <Card key={value} className="calendar-list-day"><h3>{dateText(value, true)}{value === app.today() ? " · hoje" : ""}</h3>{eventsOnDay(events, value).map((event) => eventButton(event))}</Card>)}</div>
    </> : <div className="calendar-time-scroll" ref={timeline} tabIndex={0} role="region" aria-label={view === "week" ? "Grade semanal com rolagem interna" : "Grade do dia com rolagem interna"}>
      <div className={view === "week" ? "calendar-time-grid calendar-time-week" : "calendar-time-grid"}>
        <div className="calendar-hours" aria-hidden="true"><div className="calendar-day-label" /><div className="calendar-all-day">Dia inteiro</div>{Array.from({ length: 24 }, (_, index) => <span key={index}>{String(index).padStart(2, "0")}:00</span>)}</div>
        {days.map((value) => <section className="calendar-time-day" key={value}><h3 className="calendar-day-label">{dateText(value)}{value === app.today() && <small> hoje</small>}</h3><div className="calendar-all-day">{eventsOnDay(events, value).filter((event) => event.all_day).map((event) => eventButton(event, true))}</div><div className="calendar-timeline">{timedSegments(events, value).map((segment) => <div className="calendar-position" key={segment.event.id} style={{ top: segment.start, height: Math.max(64, segment.end - segment.start), left: (segment.lane / segment.lanes * 100) + "%", width: (100 / segment.lanes) + "%" }}>{eventButton(segment.event, true)}</div>)}</div></section>)}
      </div>
    </div>}
    <Drawer open={!!selected} onClose={() => navigate({ event: null })} title={selected?.title ?? "Compromisso"} description={connected ? "Compromisso Google · somente leitura" : "Evento da agenda de exemplo"}>
      {selected && <div className="calendar-detail"><p><strong>Início</strong><br />{paraCampoLocal(selected.starts_at, "datetime").replace("T", " às ")}</p><p><strong>Término{selected.all_day ? " (exclusivo)" : ""}</strong><br />{paraCampoLocal(selected.ends_at, "datetime").replace("T", " às ")}</p><p>{selected.all_day ? "Dia inteiro" : selected.location ?? "Sem local informado"}</p>{selected.linked_capture_id && captureAccess && <Link href={"/capturar?capture=" + encodeURIComponent(selected.linked_capture_id)}>Abrir nota vinculada</Link>}{selected.habit_id && resolveAccess("habitos", policy).allowed && <Link href="/habitos">Abrir hábitos</Link>}{connected && selected.html_link && <a href={selected.html_link} target="_blank" rel="noopener noreferrer">Abrir no Google Calendar</a>}
        {connected && captureAccess && <section className="calendar-note-link"><Field as="select" label="Vincular nota existente" value={captureId} disabled={busy || captures.status !== "ready"} onChange={event => setCaptureId(event.target.value)}><option value="">Selecione uma captura</option>{(captures.data?.items ?? []).filter(note => !note.deleted_at).map(note => <option key={note.id} value={note.id}>{note.title ?? note.content?.slice(0, 80) ?? "Sem título"}</option>)}</Field><div className="calendar-connections-heading"><Button disabled={busy || !captureId} onClick={() => void send("calendar.event.link", { event_id: selected.id, capture_id: captureId })}>Vincular nota</Button><Button disabled={busy} onClick={() => void createNote()}>Criar nota de reunião</Button>{selected.linked_capture_id && <Button disabled={busy} onClick={() => void send("calendar.event.link", { event_id: selected.id, capture_id: null })}>Remover vínculo</Button>}</div>{captures.status === "error" && <p role="alert">{captures.error}</p>}{feedback && <p role="status">{feedback}</p>}</section>}
      {connected && <RelatedPanel type="event" id={selected.id} />}</div>}
    </Drawer>
  </div>;
}
