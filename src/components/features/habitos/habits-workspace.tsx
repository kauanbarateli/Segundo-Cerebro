"use client";
import { RelatedPanel } from "@/components/layout/related-panel";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { celulasDoPeriodo, podeMarcarDia, estaPausado, desempenhoDoHabito, estadoDaFrequenciaDe, resumoDaSequencia, segundaDaSemana, somarDias, type Habito } from "@/core/habitos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { PrivateImage } from "@/components/layout/private-image";
import { HabitPerformance } from "./habit-performance";
import { useToast } from "@/components/ui/toast";
import { Icons } from "@/components/ui/icons";
import type { HabitoDoUsuario } from "@/core/contracts";
import { HabitEditor } from "./habit-editor";
import "./habits.css";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const SHORT_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const civil = (day: string) => new Date(`${day}T12:00:00Z`);
const shortDate = (day: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(civil(day));
const longDate = (day: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(civil(day));
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
function cadenceLabel(habit: Pick<Habito, "schedule_kind" | "weekdays" | "weekly_target">) {
  if (habit.schedule_kind === "weekly_target") return plural(habit.weekly_target ?? 0, "vez por semana", "vezes por semana");
  if (habit.schedule_kind === "weekdays") return [...habit.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((day) => SHORT_DAYS[day]).join(", ") || "Sem dias escolhidos";
  return "Todos os dias";
}
function FrequencyHistory({ habit, marks, today, pauses }: { habit: Habito; marks: Set<string>; today: string; pauses: Parameters<typeof resumoDaSequencia>[3] }) {
  const state = estadoDaFrequenciaDe(habit), sequence = resumoDaSequencia(habit, marks, today, pauses);
  return <details className="habits-frequency-history"><summary>Frequências e melhores sequências</summary>
    <dl><div><dt>Melhor sequência em dias elegíveis</dt><dd>{plural(sequence.melhores.dias, "dia", "dias")}</dd></div><div><dt>Melhor sequência em semanas</dt><dd>{plural(sequence.melhores.semanas, "semana", "semanas")}</dd></div></dl>
    <p>As duas unidades são independentes. Ao mudar de dias para semanas ou de semanas para dias, começa uma nova sequência; os melhores resultados anteriores permanecem aqui.</p>
    {state ? <><ol aria-label="Frequências conhecidas">{state.changes.map((change, index) => <li key={change.effective_from}><strong>{cadenceLabel(change)}</strong><span>De {change.effective_from.split("-").reverse().join("/")}{state.changes[index + 1] ? " a " + somarDias(state.changes[index + 1]!.effective_from, -1).split("-").reverse().join("/") : " em diante"}</span></li>)}</ol>{state.baseline_origin === "legacy_known_frequency" && <p>A frequência inicial foi registrada a partir da regra conhecida na primeira alteração. Versões anteriores a esse registro não foram recuperadas.</p>}</> : <p>Este hábito ainda usa a frequência conhecida desde o início. Não há alterações de frequência registradas.</p>}
  </details>;
}
/** Authored info glyph (stroke of the shared icon set); decorative. */
function InfoGlyph() {
  return <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
}

export function HabitsSkeleton() {
  return <div className="habits-skeleton" role="status" aria-label="Carregando hábitos"><div className="habits-skeleton-intro" aria-hidden="true"><i /><i /></div><div className="habits-skeleton-week" aria-hidden="true">{[0, 1, 2].map((value) => <i key={value} />)}</div><div className="habits-skeleton-map" aria-hidden="true">{Array.from({ length: 182 }, (_, index) => <i key={index} />)}</div></div>;
}
export function HabitsWorkspace() {
  const requestedHabit = useSearchParams().get("habit");
  const app = useDemoApplication(), query = useDemoQuery("habits"), { toast } = useToast();
  const today = app.today(), cellId = useId();
  const [editing, setEditing] = useState<{ row?: HabitoDoUsuario } | null>(null), editorTrigger = useRef<HTMLElement | null>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null), dialogFirst = useRef<HTMLSelectElement | null>(null);
  const [selectedId, setSelectedId] = useState(""), [dialog, setDialog] = useState<"mark" | "pause" | null>(null);
  const [habitId, setHabitId] = useState(""), [doneOn, setDoneOn] = useState(today), [done, setDone] = useState(true);
  const [startsOn, setStartsOn] = useState(today), [endsOn, setEndsOn] = useState(""), [reason, setReason] = useState("");
  const [pending, setPending] = useState(false), [failure, setFailure] = useState("");
  const [weekOffset, setWeekOffset] = useState(0), [showArchived, setShowArchived] = useState(false);
  const working = useRef(false), receipt = useRef<{ value: string; id: string } | null>(null);
  const [filterId, setFilterId] = useState("");
  const filterRef = useRef<HTMLSelectElement>(null);
  const [appliedRequest, setAppliedRequest] = useState<string | null>(null);
  const data = query.data;
  const allItems = [...data?.items ?? []].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const activeItems = allItems.filter(habit => habit.archived_at === null), archivedItems = allItems.filter(habit => habit.archived_at !== null);
  const pool = showArchived ? archivedItems : activeItems;
  const effectiveFilter = pool.some(habit => habit.id === filterId) ? filterId : "";
  const items = activeItems.filter(habit => !effectiveFilter || habit.id === effectiveFilter);
  const archived = archivedItems.filter(habit => !effectiveFilter || habit.id === effectiveFilter);
  const marks = new Map(allItems.map(habit => [habit.id, new Set((data?.entries ?? []).filter(entry => entry.habit_id === habit.id && entry.done_on <= today).map(entry => entry.done_on))]));
  const pauses = data?.pauses ?? [];
  const selected = (showArchived ? archived : items).find(habit => habit.id === selectedId) ?? (showArchived ? archived : items)[0];
  useEffect(() => {
    if (!requestedHabit) { setAppliedRequest(null); return; }
    if (!data || appliedRequest === requestedHabit) return;
    const requested = data.items.find(habit => habit.id === requestedHabit);
    if (requested) { setSelectedId(requested.id); setFilterId(requested.id); setShowArchived(requested.archived_at !== null); }
    setAppliedRequest(requestedHabit);
  }, [requestedHabit, data, appliedRequest]);
  const cells = selected ? celulasDoPeriodo(selected, marks.get(selected.id)!, today, 182, pauses) : [];
  const paused = (habit: Habito, day: string) => estaPausado(habit.id, day, pauses);
  const canMark = (habit: Habito, day: string) => podeMarcarDia(habit, day, today, pauses);
  const currentMonday = segundaDaSemana(today), monday = somarDias(currentMonday, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => somarDias(monday, index));
  const earliest = items.reduce((first, habit) => habit.started_on < first ? habit.started_on : first, currentMonday);
  function weekProgress(habit: Habito) {
    const result = desempenhoDoHabito(habit, marks.get(habit.id)!, monday, days[6]!, days[6]!, pauses);
    return { done: result.registros, goal: result.esperados, capped: result.cumpridos, fulfilled: result.esperados > 0 && result.cumpridos === result.esperados };
  }
  function open(kind: "mark" | "pause") {
    if (document.activeElement instanceof HTMLElement) dialogTrigger.current = document.activeElement;
    setHabitId(kind === "pause" ? "" : selected?.id ?? ""); setDoneOn(today); setDone(true); setStartsOn(today); setEndsOn(""); setReason(""); setFailure(""); receipt.current = null; setDialog(kind);
  }
  async function execute(value: object, operation: (clientId: string) => Promise<unknown>, message: string, close: boolean) {
    if (working.current) return;
    working.current = true; setPending(true); setFailure("");
    const fingerprint = JSON.stringify(value);
    if (receipt.current?.value !== fingerprint) receipt.current = { value: fingerprint, id: crypto.randomUUID() };
    try {
      await operation(receipt.current.id); receipt.current = null; if (close) setDialog(null); toast({ message });
      if ("command" in value && (value.command === "habit.archive" || value.command === "habit.restore")) { setFilterId(""); setSelectedId(""); filterRef.current?.focus(); }
    }
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
  function toggle(habit: Habito, day: string, marked: boolean) {
    const input = { habit_id: habit.id, done_on: day, done: !marked };
    void execute(input, (client_id) => app.commands.habits.mark({ ...input, client_id }), marked ? "Marcação removida." : "Hábito marcado como feito.", false);
  }
  if (query.status === "error") return <Card className="habits-message" data-access="allowed"><h2>Não foi possível abrir os hábitos</h2><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo</Button></Card>;
  if (!data) return <HabitsSkeleton />;
  if (requestedHabit && !data.items.some(habit => habit.id === requestedHabit)) return <Card className="habits-message"><h2>Hábito indisponível</h2><p>O hábito deste link não está disponível para sua conta.</p><Link href="/habitos">Ver meus hábitos</Link></Card>;
  if (requestedHabit && appliedRequest !== requestedHabit) return <HabitsSkeleton />;
  return <div className="habits-workspace" data-access="allowed" aria-busy={query.status === "loading" || undefined}>
    <div className="habits-toolbar"><Field ref={filterRef} as="select" label="Filtrar hábitos" value={effectiveFilter} onChange={event => { setFilterId(event.target.value); setSelectedId(event.target.value); }}><option value="">Todos os hábitos</option>{pool.map(habit => <option key={habit.id} value={habit.id}>{habit.name}</option>)}</Field><Button variant="primary" disabled={pending} onClick={event => { editorTrigger.current = event.currentTarget; setEditing({}); }}><Icons.Capture />Novo hábito</Button></div>
    <p className="habits-caption habits-clock">Hoje em São Paulo · <time dateTime={today}>{today.split("-").reverse().join("/")}</time></p>
    {failure && !dialog && <p role="alert" className="habits-error">{failure}</p>}
    <HabitPerformance habits={showArchived ? effectiveFilter ? archived : [] : items} marks={marks} pauses={pauses} today={today} archivedIndividual={showArchived && Boolean(effectiveFilter)} />
    {showArchived && !effectiveFilter && <p className="habits-caption">Selecione um hábito arquivado para consultar seu histórico individual. O agregado atual considera hábitos ativos.</p>}
    <section className="habits-panel habits-week-panel" aria-labelledby="habits-week-title">
      <div className="habits-panel-head">
        {showArchived ? <h2 id="habits-week-title">Hábitos arquivados</h2> : <div className="habits-period"><Button aria-label="Semana anterior" disabled={monday <= earliest} onClick={() => setWeekOffset(weekOffset - 1)}><Icons.ChevronLeft /></Button><h2 id="habits-week-title"><span className="habits-sr">Semana de </span>{shortDate(days[0]!)} — {shortDate(days[6]!)}</h2><Button aria-label="Próxima semana" disabled={weekOffset >= 0} onClick={() => setWeekOffset(Math.min(0, weekOffset + 1))}><Icons.ChevronRight /></Button></div>}
        <div className="habits-actions">{weekOffset !== 0 && !showArchived && <Button onClick={() => setWeekOffset(0)}>Esta semana</Button>}<Button className="habits-archive-toggle" aria-pressed={showArchived} onClick={() => { setShowArchived(!showArchived); setFilterId(""); setSelectedId(""); }}>{showArchived ? "Ver ativos" : "Arquivados"}</Button></div>
      </div>
      {showArchived ? archived.length ? <ul className="habits-archived">{archived.map(habit => <li key={habit.id}><div><strong>{habit.name}</strong><span>{cadenceLabel(habit)} · histórico preservado</span></div><Button disabled={pending} onClick={() => { void execute({ id: habit.id, command: "habit.restore" }, client_id => app.executeDomainCommand("habit.restore", { id: habit.id, client_id }), "Hábito restaurado com seu histórico.", false); }}>Restaurar {habit.name}</Button></li>)}</ul>
        : <div className="habits-empty"><h3>Nenhum hábito arquivado</h3><p>Os hábitos arquivados ficam aqui com seu histórico.</p></div>
      : !items.length ? <div className="habits-empty"><h3>Sua rotina começa com um hábito</h3><p>Crie um hábito com a cadência que cabe na sua rotina.</p></div>
      : <>
        <div className="habits-grid-wrap" role="region" aria-label="Marcações dos hábitos na semana" tabIndex={0}><table className="habits-week">
          <thead><tr><th scope="col">Sua prática</th>{days.map((day, index) => <th scope="col" key={day} className={day === today ? "is-today" : undefined} aria-current={day === today ? "date" : undefined}><span>{WEEKDAYS[index]}</span><strong>{Number(day.slice(8))}</strong>{day === today && <span className="habits-sr">hoje</span>}</th>)}<th scope="col">Semana</th><th scope="col"><span className="habits-sr">Ações</span></th></tr></thead>
          <tbody>{items.map((habit) => {
            const set = marks.get(habit.id)!, sequence = resumoDaSequencia(habit, set, today, pauses), progress = weekProgress(habit), pausedToday = paused(habit, today);
            const streak = sequence.unidade === "semanas" ? plural(sequence.atual, "semana de sequência", "semanas de sequência") : plural(sequence.atual, "dia de sequência", "dias de sequência");
            const status = progress.fulfilled ? "Meta alcançada" : weekOffset === 0 && pausedToday ? "Em pausa" : progress.goal === 0 ? "Sem dias previstos" : weekOffset === 0 ? "em andamento" : "semana encerrada";
            return <tr key={habit.id} className={pausedToday ? "is-paused" : undefined}>
              <th scope="row"><div className="habits-practice"><PrivateImage fileId={habit.image_file_id} userId={app.userId} className="habits-photo" fallback={<Icons.Repeat width={28} height={28} />} /><div><strong>{habit.name}</strong><span>{cadenceLabel(habit)}</span><span>{pausedToday ? "Pausado hoje · " : ""}{streak}</span></div></div></th>
              {days.map((day) => {
                const marked = set.has(day), enabled = marked || canMark(habit, day);
                const kind = marked ? "done" : day > today ? "future" : paused(habit, day) ? "paused" : enabled ? "open" : "off";
                const reasonText = kind === "future" ? "Dia futuro, ainda não pode ser marcado." : kind === "paused" ? "Dia em pausa." : day < habit.started_on ? "Antes do início do hábito." : "Dia não previsto pela cadência.";
                const label = (marked ? "Desmarcar " : "Marcar ") + habit.name + (day === today ? "" : " em " + shortDate(day));
                return <td key={day} className={day === today ? "habits-day is-today" : "habits-day"}><span className="habits-mobile-date" aria-hidden="true">{SHORT_DAYS[civil(day).getUTCDay()]}<strong>{Number(day.slice(8))}</strong></span><button type="button" className="habits-check" data-kind={kind} data-today={day === today || undefined} aria-pressed={marked} aria-label={label} aria-describedby={enabled ? undefined : `${cellId}-${habit.id}-${day}`} disabled={pending || !enabled} onClick={() => toggle(habit, day, marked)}>
                  {marked ? <Icons.Check width={17} height={17} /> : <span className="habits-glyph" aria-hidden="true" />}</button>
                  {!enabled && <span className="habits-sr" id={`${cellId}-${habit.id}-${day}`}>{reasonText}</span>}</td>;
              })}
              <td className="habits-count"><span className="habits-mobile-label">Semana</span><strong>{progress.done}<span> / {progress.goal}</span></strong><progress className="habits-week-progress" max={Math.max(1, progress.goal)} value={progress.capped} aria-label={habit.name + ": " + progress.done + " registros, " + progress.goal + " práticas previstas na semana completa"} /><small>{status}</small></td>
              <td className="habits-row-actions"><details><summary aria-label={"Ações de " + habit.name}><Icons.Dots /></summary><div><Button variant="ghost" disabled={pending} aria-label={`Editar hábito ${habit.name}`} onClick={(event) => { editorTrigger.current = event.currentTarget; setEditing({ row: habit }); }}>Editar</Button><Button variant="ghost" disabled={pending} aria-label={`Arquivar hábito ${habit.name}`} onClick={() => { void execute({ id: habit.id, command: "habit.archive" }, client_id => app.executeDomainCommand("habit.archive", { id: habit.id, client_id }), "Hábito arquivado. O histórico foi preservado.", false); }}>Arquivar</Button></div></details></td>
            </tr>;
          })}</tbody>
        </table></div>
        <ul className="habits-legend" aria-label="Legenda das marcações"><li><span className="habits-check" data-kind="done" aria-hidden="true"><Icons.Check width={14} height={14} /></span>Feito</li><li><span className="habits-check" data-kind="open" aria-hidden="true"><span className="habits-glyph" /></span>Pode marcar</li><li><span className="habits-check" data-kind="paused" aria-hidden="true"><span className="habits-glyph" /></span>Pausa</li><li><span className="habits-check" data-kind="future" aria-hidden="true"><span className="habits-glyph" /></span>Futuro</li><li><span className="habits-check" data-kind="off" aria-hidden="true"><span className="habits-glyph" /></span>Não previsto</li></ul></>}
    </section>
    <details className="habits-management"><summary>Histórico e pausas</summary><div className="habits-actions"><Button onClick={() => open("pause")} disabled={showArchived || !items.length || pending}>Registrar pausa</Button><Button onClick={() => open("mark")} disabled={showArchived || !items.length || pending}>Registrar dia</Button></div><div className="habits-lower">
      {selected && <section className="habits-panel habits-history" aria-labelledby="habits-history-title"><div className="habits-history-heading"><h2 id="habits-history-title">Últimas 26 semanas</h2><Field as="select" label="Hábito do histórico" value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>{(showArchived ? archived : items).map((habit) => <option value={habit.id} key={habit.id}>{habit.name}</option>)}</Field></div>
        <div className="habits-heatmap" role="img" aria-label={selected?.name + ": " + cells.filter((cell) => cell.feito).length + " dias registrados nas últimas 26 semanas. Use Registrar dia para alterar uma marcação."}>{cells.map((cell) => <span key={cell.dia} data-kind={cell.feito ? "done" : cell.pausado ? "paused" : cell.esperado ? "open" : "off"} title={cell.dia + ": " + (cell.feito ? "feito" : cell.pausado ? "pausado" : cell.esperado ? "sem marcação" : "não previsto")} aria-hidden="true">{cell.feito ? "·" : cell.pausado ? "−" : ""}</span>)}</div>
        <p className="habits-caption">● Feito · — Pausado · célula vazia: sem marcação ou dia não previsto.</p><p>Somente os dias cumpridos geram marcações. Pausas e cadências definem o que era esperado.</p><FrequencyHistory habit={selected} marks={marks.get(selected.id)!} today={today} pauses={pauses} /><Button disabled={showArchived} onClick={() => open("mark")}>Marcar um dia passado</Button>
      </section>}
      <section className="habits-panel habits-pauses" aria-labelledby="habits-pauses-title"><h2 id="habits-pauses-title">Pausas</h2>{pauses.length ? <ul>{[...pauses].sort((a, b) => b.starts_on.localeCompare(a.starts_on) || a.id.localeCompare(b.id)).map((pause) => <li key={pause.id}><div><strong>{pause.habit_id === null ? "Todos os hábitos" : data.items.find((habit) => habit.id === pause.habit_id)?.name ?? "Hábito arquivado"}</strong><p>{pause.starts_on.split("-").reverse().join("/")} até {pause.ends_on?.split("-").reverse().join("/") ?? "sem data final"}</p>{pause.reason && <p>{pause.reason}</p>}</div><Button variant="ghost" disabled={pending} aria-label={`Remover pausa de ${pause.starts_on}`} onClick={() => { void execute({ id: pause.id, command: "habit.pause.delete" }, client_id => app.executeDomainCommand("habit.pause.delete", { id: pause.id, client_id }), "Pausa removida. O acompanhamento foi recalculado.", false); }}>Remover pausa</Button></li>)}</ul> : <p>Nenhuma pausa registrada. Uma pausa respeita o ritmo da sua rotina e preserva o histórico.</p>}</section>
    </div>
    </details><div className="habits-note"><InfoGlyph /><p>A semana começa na segunda. Metas semanais podem ser cumpridas em qualquer dia; um dia sem registro não representa uma falha. Datas futuras não podem ser marcadas.</p></div>
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
