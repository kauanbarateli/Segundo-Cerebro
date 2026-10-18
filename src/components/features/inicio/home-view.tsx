"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useDemoApplication, useDemoPrivacy, useDemoQuery } from "@/lib/demo/demo-provider";
import { IDLE_COMMAND } from "@/lib/demo/connected-application";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess, type FeatureKey } from "@/core/access/resolve-access";
import { diaCivilDe, FUSO_DO_APP, paraCampoLocal } from "@/core/tempo";
import { formatBRL } from "@/core/dinheiro";
import type { Tarefa } from "@/core/tarefas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/data-display";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { projectAgenda, projectCaptures, projectDayProgress, projectFinance, projectHabits, projectHabitsToday, projectRecentNotes, projectTasks, projectWeek } from "./projections";
import { HomeTaskCommand, type HomeTaskCommandState, type HomeTaskInput } from "./task-command";
import "./home.css";

interface QueryState { status: "idle" | "loading" | "ready" | "error"; data: unknown; error: string | null; retry: () => void }
/** Layout Codex panel: flat surface, section title and an "abrir" link; region named by its h2 only. */
function Block({ title, href, link = "Ver todos", area, query, count, icon, className = "", children }: {
  title: string; href?: string; link?: string; area: string; query: QueryState; count?: ReactNode; icon?: ReactNode; className?: string; children: ReactNode;
}) {
  return <Card className={`home-block home-${area} ${className}`.trim()} role="region" aria-labelledby={`home-${area}-title`} aria-busy={query.status === "loading" || undefined}>
    <div className="home-block-heading">{icon}<div className="home-block-title"><h2 id={`home-${area}-title`} tabIndex={-1}>{title}</h2>{count}</div>
      {href && <Link className="home-link" href={href}>{link}<Icons.ArrowUpRight width={16} height={16} /></Link>}</div>
    {query.status === "error" ? <div className="home-error"><p role="alert">{query.error || `Não foi possível carregar ${title.toLocaleLowerCase("pt-BR")}.`}</p><Button onClick={query.retry} aria-label={`Tentar novamente: ${title}`}>Tentar novamente</Button></div>
      : !query.data ? <div className="home-skeleton" role="status"><span className="home-sr-only">Carregando {title.toLocaleLowerCase("pt-BR")}…</span><i /><i /><i /></div> : children}
  </Card>;
}
function Empty({ children, href, action }: { children: ReactNode; href: string; action: string }) {
  return <div className="home-empty"><p>{children}</p><Link className="home-link" href={href}>{action}<Icons.ChevronRight width={16} height={16} /></Link></div>;
}
const shortDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const time = (iso: string) => paraCampoLocal(iso, "datetime").slice(11);
const WEEKDAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"];
const civilDate = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...options }).format(new Date(`${day}T12:00:00Z`));
/** INFERIDO: calendar colour keys map to the DS category inks; unknown keys stay neutral. */
const SOURCE_TONES: Record<string, string> = { work: "work", personal: "personal", study: "info", info: "info", fin: "fin" };
const HABIT_ICONS: Record<string, (props: { width?: number; height?: number }) => ReactNode> = {
  book: Icons.Book, activity: Icons.Activity, sun: Icons.Sun, moon: Icons.Moon, target: Icons.Target, star: Icons.Star, clock: Icons.Clock,
};
const CAPTURE_TYPES = { idea: "Ideia", task: "Tarefa", note: "Nota", reminder: "Lembrete" } as const;

export function HomeView() {
  const app = useDemoApplication();
  const { subscribeCommands, getCommandSnapshot } = app;
  const commandFeedback = useSyncExternalStore(subscribeCommands, getCommandSnapshot, () => IDLE_COMMAND);
  const centralPending = app.mode === "connected" && commandFeedback.status === "pending";
  const { valuesHidden } = useDemoPrivacy();
  const money = (cents: number) => formatBRL(cents, { hidden: valuesHidden });
  const { policy, ready } = useDemoAccess();
  const enabled = (feature: FeatureKey) => ready && resolveAccess("inicio", policy).allowed && resolveAccess(feature, policy).allowed && resolveAccess(feature, policy).visible;
  const tasksQuery = useDemoQuery("tasks", enabled("tarefas"));
  const capturesQuery = useDemoQuery("captures", enabled("capturar"));
  const habitsQuery = useDemoQuery("habits", enabled("habitos"));
  const financeQuery = useDemoQuery("finance", enabled("financeiro"));
  const agendaQuery = useDemoQuery("agenda", enabled("calendario"));
  const now = app.clock.now(), today = app.today();
  const tasks = tasksQuery.data ? projectTasks(tasksQuery.data.items, now) : null;
  const captures = capturesQuery.data ? projectCaptures(capturesQuery.data.items) : null;
  const habits = habitsQuery.data ? projectHabits(habitsQuery.data.items, habitsQuery.data.entries, habitsQuery.data.pauses, now) : null;
  const finance = financeQuery.data ? projectFinance(financeQuery.data.accounts, financeQuery.data.transactions, now) : null;
  const agenda = agendaQuery.data ? projectAgenda(agendaQuery.data.items, now) : null;
  const week = agendaQuery.data ? projectWeek(agendaQuery.data.items, now) : null;
  const dayProgress = tasks ? projectDayProgress(tasks.today) : null;
  const habitsToday = habits ? projectHabitsToday(habits.items) : null;
  const recent = capturesQuery.data ? projectRecentNotes(capturesQuery.data.items) : null;
  const { toast } = useToast();
  const working = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [actionError, setActionError] = useState("");
  const taskCommand = useRef(new HomeTaskCommand());
  const [taskRequest, setTaskRequest] = useState<HomeTaskCommandState | null>(null);
  const [taskError, setTaskError] = useState("");
  const retryTaskButton = useRef<HTMLButtonElement>(null);
  const [pinnedFocus, setPinnedFocus] = useState<string | null>(null);
  const focus = tasksQuery.data?.items.find((task) => task.id === pinnedFocus && task.deleted_at === null && task.archived_at === null) ?? tasks?.focus ?? null;
  const focusButton = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeCommands(() => {
    const feedback = getCommandSnapshot();
    if ((feedback.status === "confirmed" || feedback.status === "rejected") && taskCommand.current.settled(feedback.clientId)) {
      // The shared banner retains a definitive rejection message without a duplicate CTA.
      setTaskRequest(null); setTaskError("");
    }
  }), [subscribeCommands, getCommandSnapshot]);

  async function run(key: string, operation: () => Promise<unknown>, message: string, trigger?: HTMLElement) {
    if (working.current.has(key)) return;
    working.current.add(key); setPending(new Set(working.current)); setActionError("");
    try { await operation(); toast({ message }); }
    catch (error) { setActionError(error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente."); }
    finally {
      working.current.delete(key); setPending(new Set(working.current));
      // A completed row may move beyond the mobile limit; retain a useful focus.
      requestAnimationFrame(() => { if (trigger && (!trigger.isConnected || !trigger.getClientRects().length)) focusButton.current?.focus(); });
    }
  }
  async function sendTask(input: HomeTaskInput, trigger?: HTMLElement) {
    setTaskRequest(taskCommand.current.state);
    try {
      await app.commands.tasks.status(input);
      taskCommand.current.settled(input.client_id); setTaskError("");
      toast({ message: input.status === "done" ? "Tarefa concluída." : "Tarefa reaberta." });
    } catch (error) {
      taskCommand.current.failed(error);
      setTaskError(error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setTaskRequest(taskCommand.current.state);
      requestAnimationFrame(() => {
        if (taskCommand.current.state) retryTaskButton.current?.focus();
        else if (trigger && (!trigger.isConnected || !trigger.getClientRects().length)) focusButton.current?.focus();
      });
    }
  }
  function setTask(task: Tarefa, trigger?: HTMLElement) {
    if (!enabled("tarefas") || centralPending) return;
    const input = taskCommand.current.begin(task);
    if (!input) return;
    setPinnedFocus(task.id);
    setTaskError("");
    void sendTask(input, trigger);
  }
  function retryTask(trigger: HTMLElement) {
    if (!enabled("tarefas") || centralPending) return;
    const input = taskCommand.current.retry();
    if (input) void sendTask(input, trigger);
  }
  const categoryName = (task: Tarefa) => tasksQuery.data?.categories.find((category) => category.id === task.category_id)?.name ?? "Sem categoria";
  const projectName = (task: Tarefa) => enabled("projetos") ? tasksQuery.data?.projects.find((project) => project.id === task.project_id)?.name ?? null : null;
  const isLate = (task: Tarefa) => !!task.due_at && diaCivilDe(task.due_at) < today && task.status !== "done";
  const dueLabel = (task: Tarefa) => !task.due_at ? "Sem prazo" : isLate(task) ? "Atrasada" : diaCivilDe(task.due_at) === today ? task.all_day ? "Hoje" : time(task.due_at) : shortDate(diaCivilDe(task.due_at));
  const summary = [enabled("tarefas") && tasks ? `${tasks.openCount} tarefas abertas` : null, enabled("calendario") && agenda ? `${agenda.items.length} compromissos hoje` : null,
    enabled("capturar") && captures ? `${captures.inbox.length} capturas por organizar` : null].filter(Boolean).join(" · ");
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, weekday: "long", day: "numeric", month: "long" }).format(new Date(now));
  const anyEnabled = ["tarefas", "capturar", "habitos", "financeiro", "calendario"].some((feature) => enabled(feature as FeatureKey));
  const calendarName = (id?: string) => agendaQuery.data?.calendars?.find((calendar) => calendar.id === id);
  const focusProject = focus ? projectName(focus) : null;
  const openToday = tasks ? tasks.today.filter((task) => task.status !== "done").length : 0;
  const bottomCount = [enabled("habitos"), enabled("financeiro"), enabled("capturar")].filter(Boolean).length;
  const segments = dayProgress && dayProgress.total > 0 && dayProgress.total <= 12 ? Array.from({ length: dayProgress.total }, (_, index) => index < dayProgress.done) : null;

  const focusPanel = enabled("tarefas") && <Card variant="inverse" className="home-focus" role="region" aria-label="Em foco" aria-busy={tasksQuery.status === "loading" || undefined}>
    {focus ? <>
      <h2>{focus.title}</h2>
      <p className="home-focus-copy">Um passo de cada vez. Comece pelo que faz diferença agora.</p>
      <p className="home-focus-context"><Icons.Target width={17} height={17} /><span>Em foco · {categoryName(focus)} · {dueLabel(focus)}{focusProject ? ` · ${focusProject}` : ""}{focus.estimated_minutes ? ` · ${focus.estimated_minutes} min de dedicação` : ""}</span></p>
      <div className="home-focus-actions">
        <Button ref={focusButton} variant="primary" className="home-focus-button" disabled={taskRequest !== null || centralPending} loading={taskRequest?.input.id === focus.id && taskRequest.pending} aria-pressed={focus.status === "done"} onClick={(event) => setTask(focus, event.currentTarget)}>{focus.status === "done" ? <><Icons.Refresh width={18} height={18} />Reabrir tarefa</> : <><Icons.Check width={18} height={18} />Concluir tarefa</>}</Button>
        <Link className="home-focus-link" href={`/tarefas?task=${encodeURIComponent(focus.id)}`}>Abrir tarefa<Icons.ArrowUpRight width={16} height={16} /></Link>
      </div>
    </> : !tasksQuery.data && tasksQuery.status !== "error" ? <div className="home-skeleton" role="status"><span className="home-sr-only">Carregando tarefa em foco…</span><i /><i /></div>
      : <>
        <h2>{tasksQuery.status === "error" ? "Seu foco volta em instantes." : "Você abriu espaço no seu dia."}</h2>
        <p className="home-focus-copy">{tasksQuery.status === "error" ? "Seu foco volta quando a lista de tarefas carregar." : "Nenhuma tarefa pede sua atenção agora."}</p>
        <div className="home-focus-actions"><Link className="home-focus-link" href="/tarefas">Abrir tarefas<Icons.ArrowUpRight width={16} height={16} /></Link></div>
      </>}
  </Card>;

  const rhythm = <section className="home-rhythm" aria-labelledby="home-rhythm-title">
    <div className="home-rhythm-heading">
      <h2 id="home-rhythm-title">Seu ritmo hoje</h2>
      <p className="home-date"><Icons.Calendar width={16} height={16} /><span>{dateLabel}{app.mode === "demo" ? " · dia de exemplo" : ""}</span></p>
    </div>
    {enabled("tarefas") && (dayProgress ? <div className="home-day">
      <p className="home-day-number"><strong>{dayProgress.done}<span> / {dayProgress.total}</span></strong><span>tarefas concluídas</span></p>
      {segments ? <div className="home-segments" role="img" aria-label={`${dayProgress.done} de ${dayProgress.total} tarefas de hoje concluídas`}>{segments.map((filled, index) => <span key={index} className={filled ? "is-filled" : undefined} />)}</div>
        : dayProgress.total > 0 && <div className="home-segments is-continuous" role="img" aria-label={`${dayProgress.done} de ${dayProgress.total} tarefas de hoje concluídas`}><span className="is-filled" style={{ inlineSize: `${Math.round(dayProgress.done / dayProgress.total * 100)}%` }} /></div>}
    </div> : tasksQuery.status !== "error" && <div className="home-day home-day-loading" aria-hidden="true"><i /><i /></div>)}
    <div className="home-day-meta">
      <div className="home-day-lines">
        <p className="home-summary">{summary || "Seu panorama acompanha os módulos que você escolheu."}</p>
        {enabled("habitos") && habitsToday && habitsToday.total > 0 && <p className="home-day-line"><Icons.Repeat width={17} height={17} /><span>{habitsToday.done} de {habitsToday.total} hábitos feitos hoje</span></p>}
        {enabled("calendario") && agenda?.next && <p className="home-day-line home-day-next"><Icons.Clock width={17} height={17} /><span>Próximo às {time(agenda.next.starts_at)} · {agenda.next.title}</span></p>}
      </div>
      {app.mode === "connected" && <Link className="home-round-link" href="/atividade" aria-label="Ver atividade do dia"><Icons.ArrowUpRight width={18} height={18} /></Link>}
    </div>
  </section>;

  return <div className="home-view" data-access="allowed">
    {actionError && <p className="home-action-error" role="alert">{actionError}</p>}
    {taskError && !centralPending && <div className="home-action-error home-action-retry"><p role="alert">{taskRequest?.uncertain ? "Não foi possível confirmar a alteração da tarefa. Confirme o mesmo envio antes de marcar outra tarefa." : taskError}</p>
      {taskRequest && <Button ref={retryTaskButton} loading={taskRequest.pending} disabled={!enabled("tarefas")} onClick={(event) => retryTask(event.currentTarget)}>{taskRequest.uncertain ? "Confirmar envio" : "Tentar novamente"}</Button>}
    </div>}
    {!anyEnabled && ready && <Card className="home-block home-choose"><h2>Escolha o que faz parte do seu dia</h2><Empty href="/configuracoes" action="Escolher módulos">Ative a exibição de um módulo para acompanhar seu panorama por aqui.</Empty></Card>}

    {anyEnabled && <div className="home-top" data-single={!enabled("tarefas") || undefined}>{focusPanel}{rhythm}</div>}

    {(enabled("tarefas") || enabled("calendario")) && <div className="home-main" data-single={!(enabled("tarefas") && enabled("calendario")) || undefined}>
      {enabled("tarefas") && <Block title="Tarefas de hoje" href="/tarefas?view=hoje" link="Ver todas" area="tasks" query={tasksQuery}
        count={tasks && <span className="home-count">{openToday}<span className="home-sr-only"> {openToday === 1 ? "aberta" : "abertas"}</span></span>}>
        {tasks?.today.length ? <><ul className="home-list home-task-list">{tasks.today.slice(0, 5).map((task, index) => {
          const done = task.status === "done", project = projectName(task);
          return <li key={task.id} className={`home-task${index >= 3 ? " home-desktop-row" : ""}`}>
            <button type="button" className="home-check" aria-label={`${done ? "Reabrir" : "Concluir"} ${task.title}`} aria-pressed={done} disabled={taskRequest !== null || centralPending} aria-busy={taskRequest?.input.id === task.id && taskRequest.pending || undefined} onClick={(event) => setTask(task, event.currentTarget)}><span>{done && <Icons.Check width={15} height={15} />}</span></button>
            <Link className="home-row-copy" href={`/tarefas?task=${encodeURIComponent(task.id)}`}><strong className={done ? "home-completed" : ""}>{task.title}</strong><span>{project ? `${project} · ` : ""}{categoryName(task)}</span></Link>
            <span className={`home-due${isLate(task) ? " is-late" : ""}`}>{done ? <><Icons.Check width={15} height={15} /><span className="home-sr-only">Concluída hoje</span></> : dueLabel(task)}</span>
          </li>;
        })}</ul>
</> : <Empty href="/tarefas" action="Organizar tarefas">Seu dia está livre de tarefas por aqui. Escolha a próxima quando precisar.</Empty>}
        <div className="home-task-footer"><Link className="home-inline-add" href="/tarefas?new=1"><Icons.Capture width={17} height={17} />Adicionar tarefa</Link>
          {!!tasks?.today.length && <p className="home-list-count"><span className="home-mobile-count">{Math.min(3, tasks.today.length)}</span><span className="home-wide-count">{Math.min(5, tasks.today.length)}</span> de {tasks.today.length} tarefas do dia</p>}</div>
      </Block>}

      {enabled("calendario") && <Block title="Na sua agenda" href="/calendario" link="Abrir" area="agenda" query={agendaQuery}>
        {week && <nav className="home-week" aria-label="Dias desta semana"><ol>{week.map(({ day, today: current, count }, index) => <li key={day}>
          <Link href={`/calendario?date=${day}&view=day`} aria-current={current ? "date" : undefined}>
            <span aria-hidden="true">{WEEKDAY_INITIALS[index]}</span><span className="home-sr-only">{civilDate(day, { weekday: "long" })}, </span>
            <strong>{Number(day.slice(8))}</strong><span className="home-sr-only"> de {civilDate(day, { month: "long" })}: {count} {count === 1 ? "compromisso" : "compromissos"}</span>
            <i className={count ? "has-events" : undefined} aria-hidden="true" />
          </Link></li>)}</ol></nav>}
        {agenda?.items.length ? <ul className="home-list home-agenda-list">{agenda.items.slice(0, 4).map((event, index) => {
          const source = calendarName(event.calendar_id), tone = source ? SOURCE_TONES[source.color_key] : undefined;
          return <li key={event.id} className={index >= 3 ? "home-desktop-row" : undefined}><Link className="home-agenda-item" href={`/calendario?date=${diaCivilDe(event.starts_at)}&event=${encodeURIComponent(event.id)}`}>
            <time className="home-time" dateTime={event.starts_at}>{event.all_day ? "Dia todo" : time(event.starts_at)}</time>
            <span className={`home-dot${tone ? ` is-${tone}` : ""}`} aria-hidden="true" />
            <span className="home-agenda-copy"><strong>{event.title}</strong><small>{[source?.name ?? event.location, event.all_day ? null : `${time(event.starts_at)}–${time(event.ends_at)}`].filter(Boolean).join(" · ")}</small></span>
            <Icons.ChevronRight width={15} height={15} />
          </Link></li>;
        })}</ul> : <Empty href="/calendario" action="Abrir calendário">Nenhum compromisso para hoje. Veja os próximos dias no calendário.</Empty>}
      </Block>}
    </div>}

    {bottomCount > 0 && <div className="home-bottom" data-count={bottomCount}>
      {enabled("habitos") && <Block title="Pequenos hábitos" href="/habitos" link="Ver rotina" area="habits" query={habitsQuery}>
        {habits?.items.length ? <><ul className="home-list home-habit-list">{habits.items.map((row) => {
          const iconKey = habitsQuery.data?.items.find((habit) => habit.id === row.habit.id)?.icon_key, HabitIcon = (iconKey && HABIT_ICONS[iconKey]) || Icons.Repeat;
          return <li key={row.habit.id} className="home-habit">
            <span className="home-habit-symbol" aria-hidden="true"><HabitIcon width={19} height={19} /></span>
            <div className="home-row-copy"><strong className={row.done ? "home-completed" : ""}>{row.habit.name}</strong><span>{row.done === null ? "Sem marcação prevista hoje" : row.weeklyDone !== null ? `${row.weeklyDone} de ${row.habit.weekly_target} nesta semana` : `${row.summary.sequenciaAtual} ${row.summary.sequenciaAtual === 1 ? "dia" : "dias"} de sequência`}</span></div>
            <button type="button" className="home-check" aria-label={`${row.done ? "Desmarcar" : "Marcar"} ${row.habit.name}${row.done ? "" : " como feito"}`} aria-pressed={row.done === true} disabled={row.done === null || pending.has(`habit-${row.habit.id}`)} aria-busy={pending.has(`habit-${row.habit.id}`) || undefined} onClick={() => { if (enabled("habitos")) void run(`habit-${row.habit.id}`, () => app.commands.habits.mark({ habit_id: row.habit.id, done_on: today, done: !row.done, client_id: crypto.randomUUID() }), row.done ? "Marcação removida." : "Hábito marcado como feito."); }}><span>{row.done && <Icons.Check width={15} height={15} />}</span></button>
          </li>;
        })}</ul>
          {habits.summary.taxa !== null && <ProgressBar label="Semana dos hábitos" value={habits.summary.taxa} valueText={`${habits.summary.taxa}% cumprida`} />}</> : <Empty href="/habitos" action="Criar uma rotina">Uma rotina começa com um hábito. Escolha o primeiro para acompanhar.</Empty>}
      </Block>}

      {enabled("financeiro") && <Block title="Pulso financeiro" href="/financeiro" link="Ver resumo" area="finance" query={financeQuery}>
        {finance && finance.balances.length ? <><p className="home-finance-period">{new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, month: "long", year: "numeric" }).format(new Date(now))} · valores confirmados</p>
          <dl className="home-money"><div className="home-money-main"><dt>Resultado do mês</dt><dd>{!valuesHidden && finance.totals.balanceCents > 0 ? "+" : ""}{money(finance.totals.balanceCents)}</dd></div><div><dt>Entradas</dt><dd>{money(finance.totals.incomeCents)}</dd></div><div><dt>Saídas</dt><dd>{money(finance.totals.expenseCents)}</dd></div></dl>
          <ul className="home-list home-finance-list">{finance.cards.slice(0, 1).map((card) => <li key={card.account.id}><div className="home-row-copy"><strong>{card.account.name} · fatura {card.status}</strong><span>Fecha {shortDate(card.closes)} · vence {shortDate(card.due)}</span></div><span className="home-amount">{money(card.statement.openCents)}</span></li>)}{finance.balances.filter((balance) => !balance.is_credit).slice(0, 2).map((balance) => <li key={balance.account_id}><strong>{balance.name}</strong><span className="home-amount">{money(balance.balance_cents)}</span></li>)}</ul>
          <Link className="home-inline-add" href="/financeiro?tab=lancamentos"><Icons.Capture width={17} height={17} />Ir aos lançamentos</Link></>
          : <Empty href="/financeiro" action="Conhecer o Financeiro">Suas contas vão dar contexto aos números do mês. Comece por uma conta.</Empty>}
      </Block>}

      {enabled("capturar") && <Block title="Caixa de entrada" area="inbox" query={capturesQuery} className="home-inbox-block" icon={<span className="home-inbox-icon" aria-hidden="true"><Icons.Inbox width={28} height={28} /></span>}>
        {captures?.inbox.length ? <><p className="home-inbox-copy">Você tem <strong>{captures.inbox.length} {captures.inbox.length === 1 ? "captura" : "capturas"}</strong> esperando por um próximo passo.</p>
          <ul className="home-list home-inbox-list">{captures.inbox.slice(0, 3).map((capture) => <li key={capture.id}><Link className="home-row-copy" href={`/capturar?capture=${encodeURIComponent(capture.id)}`}><strong>{capture.title || capture.content?.slice(0, 100) || "Captura sem título"}</strong><span>{CAPTURE_TYPES[capture.type]}</span></Link><Icons.ChevronRight width={16} height={16} /></li>)}</ul></>
          : <Empty href="/capturar" action="Capturar uma ideia">Caixa de entrada em dia. Capture a próxima ideia quando ela chegar.</Empty>}
        {captures && captures.total > 0 && <div className="home-organization"><ProgressBar label="Notas organizadas" value={captures.organized} max={captures.total} valueText={`${captures.organized} de ${captures.total}`} />
          <div className="home-inbox-actions"><Link className="home-link home-link-strong" href="/capturar"><Icons.Capture width={17} height={17} />Capturar</Link><Link className="home-link" href="/capturar">{captures.inbox.length ? `Organizar ${captures.inbox.length} ${captures.inbox.length === 1 ? "captura" : "capturas"}` : "Abrir suas notas"}<Icons.ChevronRight width={16} height={16} /></Link></div></div>}
      </Block>}
    </div>}

    {enabled("capturar") && recent && recent.length > 0 && <section className="home-recent" aria-labelledby="home-recent-title">
      <div className="home-block-heading"><h2 id="home-recent-title">Continue de onde parou</h2><Link className="home-link" href="/capturar">Todas as notas<Icons.ArrowUpRight width={16} height={16} /></Link></div>
      <ul className="home-recent-list">{recent.map((note) => <li key={note.id}><Link className="home-note" href={`/capturar?capture=${encodeURIComponent(note.id)}`}>
        <Icons.File width={21} height={21} />
        <span><strong>{note.title || note.content?.slice(0, 100) || "Nota sem título"}</strong><small>{CAPTURE_TYPES[note.type]} · atualizada em {new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, day: "numeric", month: "short" }).format(new Date(note.updated_at))}</small></span>
        <Icons.ArrowUpRight width={17} height={17} />
      </Link></li>)}</ul>
    </section>}

    {(enabled("tarefas") && tasks || enabled("capturar") && captures || enabled("calendario") && agenda) && <dl className="home-stats" aria-label="Resumo do seu dia">
      {enabled("tarefas") && tasks && <><div><dt>Tarefas abertas</dt><dd>{tasks.openCount}</dd></div><div><dt>Concluídas na semana</dt><dd>{tasks.completedWeek}</dd></div></>}
      {enabled("capturar") && captures && <div><dt>Capturas por organizar</dt><dd>{captures.inbox.length}</dd></div>}
      {enabled("calendario") && agenda && <div><dt>Compromissos hoje</dt><dd>{agenda.items.length}</dd>{agenda.next && <p>Próximo às {time(agenda.next.starts_at)}</p>}</div>}
    </dl>}
    <p className="home-session"><Badge>{app.mode === "connected" ? "Conta conectada" : "Dados de exemplo"}</Badge> {app.mode === "connected" ? "Os blocos disponíveis usam os registros da sua conta." : "Suas alterações acompanham esta sessão."}</p>
  </div>;
}
