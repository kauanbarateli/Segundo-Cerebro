"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess } from "@/core/access/resolve-access";
import { diaCivilDe, FUSO_DO_APP, instanteDe, paraCampoLocal } from "@/core/tempo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Drawer } from "@/components/ui/dialog";
import { calendarDay, calendarDays, calendarView, eventsOnDay, monthStart, shiftPeriod, timedSegments, type CalendarView } from "./calendar-projections";
import type { AgendaEvent } from "@/lib/demo/types";
import "./calendar.css";

const hour = (iso: string) => paraCampoLocal(iso, "datetime").slice(11);
const dateText = (day: string, long = false) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short" }).format(new Date(instanteDe(day)!));
export function CalendarSkeleton({ view = "month" }: { view?: CalendarView }) {
  return <div className="calendar-skeleton" role="status" aria-label="Carregando calendário"><div className="calendar-skeleton-heading" />{view === "month" ? <><div className="calendar-skeleton-grid" aria-hidden="true">{Array.from({ length: 42 }, (_, index) => <i key={index} />)}</div><div className="calendar-skeleton-mobile" aria-hidden="true">{[0, 1, 2, 3].map((index) => <i key={index} />)}</div></> : <div className={"calendar-skeleton-time calendar-skeleton-" + view} aria-hidden="true">{Array.from({ length: view === "day" ? 2 : 8 }, (_, index) => <i key={index} />)}</div>}</div>;
}
export function CalendarWorkspace() {
  const app = useDemoApplication(), query = useDemoQuery("agenda");
  const { policy } = useDemoAccess();
  const router = useRouter(), params = useSearchParams();
  const eventDay = query.data?.items.find((event) => event.id === params.get("event"))?.starts_at;
  const day = calendarDay(params.get("date"), eventDay ? diaCivilDe(eventDay) : app.today()), view = calendarView(params.get("view"));
  const events = query.data?.items ?? [], days = calendarDays(day, view);
  const selected = events.find((event) => event.id === params.get("event"));
  const timeline = useRef<HTMLDivElement>(null);
  const layoutReady = query.data !== null;
  useEffect(() => { if (view !== "month" && timeline.current) timeline.current.scrollTop = 8 * 60; }, [view, day, layoutReady]);
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
    <p className="calendar-note">Agenda de exemplo · horários de São Paulo. Nenhuma conta externa conectada.</p>
    {params.has("event") && !selected && <Card className="calendar-empty"><h2>Compromisso não encontrado</h2><p>Este evento não está disponível na agenda atual.</p><Button onClick={() => navigate({ event: null })}>Voltar à agenda</Button></Card>}
    {visibleEvents.size === 0 && <Card className="calendar-empty"><h2>Nenhum compromisso neste período</h2><p>Volte ao dia de exemplo para retomar a agenda.</p><Button onClick={() => navigate({ date: app.today() })}>Voltar para hoje</Button></Card>}
    {view === "month" ? <>
      <div className="calendar-month" aria-label="Mês em grade">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => <div className="calendar-weekday" key={label} aria-hidden="true">{label}</div>)}{days.map((value) => <section className="calendar-month-day" key={value} data-outside={value.slice(0, 7) !== day.slice(0, 7) || undefined} data-today={value === app.today() || undefined}><h3><button onClick={() => navigate({ date: value, view: "day" })} aria-label={dateText(value, true)}>{value.slice(8)}{value === app.today() && <span> hoje</span>}</button></h3>{eventsOnDay(events, value).map((event) => eventButton(event, true))}</section>)}</div>
      <div className="calendar-month-list" aria-label="Mês em lista">{days.filter((value) => value.slice(0, 7) === day.slice(0, 7) && eventsOnDay(events, value).length > 0).map((value) => <Card key={value} className="calendar-list-day"><h3>{dateText(value, true)}{value === app.today() ? " · hoje" : ""}</h3>{eventsOnDay(events, value).map((event) => eventButton(event))}</Card>)}</div>
    </> : <div className="calendar-time-scroll" ref={timeline} tabIndex={0} role="region" aria-label={view === "week" ? "Grade semanal com rolagem interna" : "Grade do dia com rolagem interna"}>
      <div className={view === "week" ? "calendar-time-grid calendar-time-week" : "calendar-time-grid"}>
        <div className="calendar-hours" aria-hidden="true"><div className="calendar-day-label" /><div className="calendar-all-day">Dia inteiro</div>{Array.from({ length: 24 }, (_, index) => <span key={index}>{String(index).padStart(2, "0")}:00</span>)}</div>
        {days.map((value) => <section className="calendar-time-day" key={value}><h3 className="calendar-day-label">{dateText(value)}{value === app.today() && <small> hoje</small>}</h3><div className="calendar-all-day">{eventsOnDay(events, value).filter((event) => event.all_day).map((event) => eventButton(event, true))}</div><div className="calendar-timeline">{timedSegments(events, value).map((segment) => <div className="calendar-position" key={segment.event.id} style={{ top: segment.start, height: Math.max(64, segment.end - segment.start), left: (segment.lane / segment.lanes * 100) + "%", width: (100 / segment.lanes) + "%" }}>{eventButton(segment.event, true)}</div>)}</div></section>)}
      </div>
    </div>}
    <Drawer open={!!selected} onClose={() => navigate({ event: null })} title={selected?.title ?? "Compromisso"} description="Evento da agenda de exemplo">
      {selected && <div className="calendar-detail"><p><strong>Início</strong><br />{paraCampoLocal(selected.starts_at, "datetime").replace("T", " às ")}</p><p><strong>Término</strong><br />{paraCampoLocal(selected.ends_at, "datetime").replace("T", " às ")}</p><p>{selected.all_day ? "Dia inteiro" : selected.location ?? "Sem local informado"}</p>{selected.linked_capture_id && (resolveAccess("conhecimento", policy).allowed ? <Link href={"/conhecimento?note=" + encodeURIComponent(selected.linked_capture_id)}>Abrir nota vinculada</Link> : resolveAccess("capturar", policy).allowed ? <Link href={"/capturar?capture=" + encodeURIComponent(selected.linked_capture_id)}>Abrir nota vinculada</Link> : null)}{selected.habit_id && resolveAccess("habitos", policy).allowed && <Link href="/habitos">Abrir hábitos</Link>}</div>}
    </Drawer>
  </div>;
}
