"use client";
import { RelatedPanel } from "@/components/layout/related-panel";
import { useSearchParams } from "next/navigation";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { celulasDoPeriodo, contarNaSemana, eraEsperado, estaPausado, resumirHabitos, segundaDaSemana, type Habito } from "@/core/habitos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/data-display";
import { useToast } from "@/components/ui/toast";
import { Icons } from "@/components/ui/icons";
import type { HabitoDoUsuario } from "@/core/contracts";
import { HabitEditor } from "./habit-editor";
import "./habits.css";

export function HabitsSkeleton() {
  return <div className="habits-skeleton" role="status" aria-label="Carregando hábitos"><div className="habits-skeleton-list" aria-hidden="true">{[0, 1, 2].map((value) => <i key={value} />)}</div><div className="habits-skeleton-map" aria-hidden="true">{Array.from({ length: 182 }, (_, index) => <i key={index} />)}</div></div>;
}
export function HabitsWorkspace() {
  const requestedHabit = useSearchParams().get("habit");
  const app = useDemoApplication(), query = useDemoQuery("habits"), { toast } = useToast();
  const today = app.today();
  const [editing, setEditing] = useState<{ row?: HabitoDoUsuario } | null>(null), editorTrigger = useRef<HTMLElement | null>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null), dialogFirst = useRef<HTMLSelectElement | null>(null);
  const [selectedId, setSelectedId] = useState(""), [dialog, setDialog] = useState<"mark" | "pause" | null>(null);
  const [habitId, setHabitId] = useState(""), [doneOn, setDoneOn] = useState(today), [done, setDone] = useState(true);
  const [startsOn, setStartsOn] = useState(today), [endsOn, setEndsOn] = useState(""), [reason, setReason] = useState("");
  const [pending, setPending] = useState(false), [failure, setFailure] = useState("");
  const working = useRef(false), receipt = useRef<{ value: string; id: string } | null>(null);
  const data = query.data, items = [...data?.items ?? []].filter((habit) => habit.archived_at === null).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const marks = new Map(items.map((habit) => [habit.id, new Set((data?.entries ?? []).filter((entry) => entry.habit_id === habit.id && entry.done_on <= today).map((entry) => entry.done_on))]));
  const pauses = data?.pauses ?? [];
  const selected = items.find((habit) => habit.id === selectedId) ?? items[0];
  useEffect(() => { if (requestedHabit) setSelectedId(requestedHabit); }, [requestedHabit]);
  const summary = resumirHabitos(items, marks, segundaDaSemana(today), today, today, pauses);
  const cells = selected ? celulasDoPeriodo(selected, marks.get(selected.id)!, today, 182, pauses) : [];
  const paused = (habit: Habito, day: string) => estaPausado(habit.id, day, pauses);
  const canMark = (habit: Habito, day: string) => day >= habit.started_on && day <= today && !paused(habit, day) && (habit.schedule_kind === "weekly_target" || eraEsperado(habit, day, pauses));
  function open(kind: "mark" | "pause") {
    if (document.activeElement instanceof HTMLElement) dialogTrigger.current = document.activeElement;
    setHabitId(kind === "pause" ? "" : selected?.id ?? ""); setDoneOn(today); setDone(true); setStartsOn(today); setEndsOn(""); setReason(""); setFailure(""); receipt.current = null; setDialog(kind);
  }
  async function execute(value: object, operation: (clientId: string) => Promise<unknown>, message: string, close: boolean) {
    if (working.current) return;
    working.current = true; setPending(true); setFailure("");
    const fingerprint = JSON.stringify(value);
    if (receipt.current?.value !== fingerprint) receipt.current = { value: fingerprint, id: crypto.randomUUID() };
    try { await operation(receipt.current.id); receipt.current = null; if (close) setDialog(null); toast({ message }); }
    catch (error) { setFailure(error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente."); }
    finally { working.current = false; setPending(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog === "mark") {
      const input = { habit_id: habitId, done_on: doneOn, done };
      void execute(input, (client_id) => app.commands.habits.mark({ ...input, client_id }), done ? "Dia marcado como feito." : "Marcação removida.", true);
    } else {
      const input = { habit_id: habitId || null, starts_on: startsOn, ends_on: endsOn || null, reason: reason.trim() || null };
      void execute(input, (client_id) => app.commands.habits.pause({ ...input, client_id }), "Pausa registrada.", true);
    }
  }
  if (query.status === "error") return <Card className="habits-message" data-access="allowed"><h2>Não foi possível abrir os hábitos</h2><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo</Button></Card>;
  if (!data) return <HabitsSkeleton />;
  return <div className="habits-workspace" data-access="allowed" aria-busy={query.status === "loading" || undefined}>
    <div className="habits-actions"><Button variant="primary" disabled={pending} onClick={(event) => { editorTrigger.current = event.currentTarget; setEditing({}); }}>Novo hábito</Button><Button onClick={() => open("mark")} disabled={!items.length || pending}>Registrar dia</Button><Button onClick={() => open("pause")} disabled={!items.length || pending}>Registrar pausa</Button></div>
    {failure && !dialog && <p role="alert" className="habits-error">{failure}</p>}
    {!items.length ? <Card className="habits-message"><h2>Sua rotina começa com um hábito</h2><p>Crie um hábito com a cadência que cabe na sua rotina.</p></Card> : <div className="habits-grid">
      <Card className="habits-today"><h2>Hoje</h2><p className="habits-caption">{app.mode === "demo" ? "Dia de exemplo" : "Hoje em São Paulo"} · {today.split("-").reverse().join("/")}</p><ul>{items.map((habit) => {
        const marked = marks.get(habit.id)!.has(today), row = summary.porHabito.find((item) => item.habito.id === habit.id)!;
        return <li key={habit.id}><button className="habits-toggle" type="button" aria-label={(marked ? "Desmarcar " : "Marcar ") + habit.name} aria-pressed={marked} disabled={pending || !marked && !canMark(habit, today)} onClick={() => {
          const input = { habit_id: habit.id, done_on: today, done: !marked };
          void execute(input, (client_id) => app.commands.habits.mark({ ...input, client_id }), marked ? "Marcação removida." : "Hábito marcado como feito.", false);
        }}><span aria-hidden="true">{marked && <Icons.Check width={16} height={16} />}</span></button><div><strong>{habit.name}</strong><p>{paused(habit, today) ? "Pausado hoje" : habit.schedule_kind === "weekly_target" ? contarNaSemana(habit, marks.get(habit.id)!, segundaDaSemana(today)) + " de " + habit.weekly_target + " nesta semana" : row.sequenciaAtual + (row.sequenciaAtual === 1 ? " dia de sequência" : " dias de sequência")}</p>{habit.schedule_kind === "weekly_target" && <p>{row.sequenciaAtual} {row.sequenciaAtual === 1 ? "semana de sequência" : "semanas de sequência"}</p>}<div className="habits-row-actions"><Button variant="ghost" disabled={pending} aria-label={`Editar hábito ${habit.name}`} onClick={(event) => { editorTrigger.current = event.currentTarget; setEditing({ row: habit }); }}>Editar</Button><Button variant="ghost" disabled={pending} aria-label={`Arquivar hábito ${habit.name}`} onClick={() => { void execute({ id: habit.id, command: "habit.archive" }, client_id => app.executeDomainCommand("habit.archive", { id: habit.id, client_id }), "Hábito arquivado. O histórico foi preservado.", false); }}>Arquivar</Button></div></div></li>;
      })}</ul>{summary.taxa !== null && <ProgressBar label="Semana dos hábitos" value={summary.taxa} valueText={summary.taxa + "% cumprida"} />}</Card>
      <Card className="habits-history"><div className="habits-history-heading"><h2>Últimas 26 semanas</h2><Field as="select" label="Hábito do histórico" value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>{items.map((habit) => <option value={habit.id} key={habit.id}>{habit.name}</option>)}</Field></div>
        <div className="habits-heatmap" role="img" aria-label={selected?.name + ": " + cells.filter((cell) => cell.feito).length + " dias registrados nas últimas 26 semanas. Use Registrar dia para alterar uma marcação."}>{cells.map((cell) => <span key={cell.dia} data-kind={cell.feito ? "done" : cell.pausado ? "paused" : cell.esperado ? "open" : "off"} title={cell.dia + ": " + (cell.feito ? "feito" : cell.pausado ? "pausado" : cell.esperado ? "sem marcação" : "não previsto")} aria-hidden="true">{cell.feito ? "·" : cell.pausado ? "−" : ""}</span>)}</div>
        <p className="habits-caption">● Feito · — Pausado · célula vazia: sem marcação ou dia não previsto.</p><p>Somente os dias cumpridos geram marcações. Pausas e cadências definem o que era esperado.</p><Button onClick={() => open("mark")}>Marcar um dia passado</Button>
      </Card>
    </div>}
    <Card className="habits-pauses"><h2>Pausas</h2>{pauses.length ? <ul>{[...pauses].sort((a, b) => b.starts_on.localeCompare(a.starts_on) || a.id.localeCompare(b.id)).map((pause) => <li key={pause.id}><strong>{pause.habit_id === null ? "Todos os hábitos" : data.items.find((habit) => habit.id === pause.habit_id)?.name ?? "Hábito arquivado"}</strong><p>{pause.starts_on.split("-").reverse().join("/")} até {pause.ends_on?.split("-").reverse().join("/") ?? "sem data final"}</p>{pause.reason && <p>{pause.reason}</p>}<Button variant="ghost" disabled={pending} aria-label={`Remover pausa de ${pause.starts_on}`} onClick={() => { void execute({ id: pause.id, command: "habit.pause.delete" }, client_id => app.executeDomainCommand("habit.pause.delete", { id: pause.id, client_id }), "Pausa removida. O acompanhamento foi recalculado.", false); }}>Remover pausa</Button></li>)}</ul> : <p>Nenhuma pausa registrada. Uma pausa respeita o ritmo da sua rotina e preserva o histórico.</p>}</Card>
    {data.items.some(habit => habit.archived_at !== null) && <details className="habits-archived"><summary>Hábitos arquivados</summary><ul>{data.items.filter(habit => habit.archived_at !== null).map(habit => <li key={habit.id}><strong>{habit.name}</strong><Button disabled={pending} onClick={() => { void execute({ id: habit.id, command: "habit.restore" }, client_id => app.executeDomainCommand("habit.restore", { id: habit.id, client_id }), "Hábito restaurado com seu histórico.", false); }}>Restaurar {habit.name}</Button></li>)}</ul></details>}
    {editing && <HabitEditor key={editing.row?.id ?? "new"} row={editing.row} returnFocusRef={editorTrigger} onClose={() => setEditing(null)} onSaved={() => toast({ message: "Hábito salvo." })} />}
    {selected && <RelatedPanel type="habit" id={selected.id} />} <Drawer open={dialog !== null} onClose={() => { if (!pending) setDialog(null); }} title={dialog === "pause" ? "Registrar pausa" : "Registrar dia"} dismissible={!pending} initialFocusRef={dialogFirst} returnFocusRef={dialogTrigger}>
      <form className="habits-form" onSubmit={submit}>
        <Field ref={dialogFirst} as="select" label="Hábito" value={habitId} disabled={pending} onChange={(event) => { setHabitId(event.target.value); setFailure(""); }} required={dialog === "mark"}>{dialog === "pause" && <option value="">Todos os hábitos</option>}{items.map((habit) => <option value={habit.id} key={habit.id}>{habit.name}</option>)}</Field>
        {dialog === "mark" ? <><Field type="date" label="Dia do hábito" disabled={pending} value={doneOn} max={today} min={items.find((habit) => habit.id === habitId)?.started_on} required onChange={(event) => { setDoneOn(event.target.value); setFailure(""); }} hint="Você pode registrar dias passados, a partir do início do hábito." /><Field as="select" label="Marcação" disabled={pending} value={done ? "done" : "clear"} onChange={(event) => setDone(event.target.value === "done")}><option value="done">Feito</option><option value="clear">Remover marcação</option></Field></> : <><Field type="date" label="Início da pausa" disabled={pending} value={startsOn} required onChange={(event) => setStartsOn(event.target.value)} /><Field type="date" label="Fim da pausa" disabled={pending} value={endsOn} min={startsOn} onChange={(event) => setEndsOn(event.target.value)} hint="Deixe em branco para uma pausa sem data final." /><Field as="textarea" label="Motivo" disabled={pending} value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} /></>}
        {failure && <p role="alert" className="habits-error">{failure}</p>}<div className="habits-actions"><Button type="submit" loading={pending}>{dialog === "pause" ? "Salvar pausa" : "Salvar marcação"}</Button><Button type="button" disabled={pending} onClick={() => setDialog(null)}>Cancelar</Button></div>
      </form>
    </Drawer>
  </div>;
}
