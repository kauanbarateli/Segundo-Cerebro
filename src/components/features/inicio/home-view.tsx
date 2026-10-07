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
import { projectAgenda, projectCaptures, projectFinance, projectHabits, projectTasks } from "./projections";
import { HomeTaskCommand, type HomeTaskCommandState, type HomeTaskInput } from "./task-command";
import "./home.css";

interface QueryState { status: "idle" | "loading" | "ready" | "error"; data: unknown; error: string | null; retry: () => void }
function Block({ title, href, link = "Ver todos", area, query, children }: {
  title: string; href: string; link?: string; area: string; query: QueryState; children: ReactNode;
}) {
  return <Card className={`home-block home-${area}`} role="region" aria-labelledby={`home-${area}-title`} aria-busy={query.status === "loading" || undefined}>
    <div className="home-block-heading"><h2 id={`home-${area}-title`} tabIndex={-1}>{title}</h2><Link className="home-link" href={href}>{link}<Icons.ChevronRight width={16} height={16} /></Link></div>
    {query.status === "error" ? <div className="home-error"><p role="alert">{query.error || `Não foi possível carregar ${title.toLocaleLowerCase("pt-BR")}.`}</p><Button onClick={query.retry} aria-label={`Tentar novamente: ${title}`}>Tentar novamente</Button></div>
      : !query.data ? <div className="home-skeleton" role="status"><span className="home-sr-only">Carregando {title.toLocaleLowerCase("pt-BR")}…</span><i /><i /><i /></div> : children}
  </Card>;
}
function Empty({ children, href, action }: { children: ReactNode; href: string; action: string }) {
  return <div className="home-empty"><p>{children}</p><Link className="home-link" href={href}>{action}<Icons.ChevronRight width={16} height={16} /></Link></div>;
}
const shortDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const time = (iso: string) => paraCampoLocal(iso, "datetime").slice(11);

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
  const projectName = focus && enabled("projetos") ? tasksQuery.data?.projects.find((project) => project.id === focus.project_id)?.name : null;
  const dueLabel = (task: Tarefa) => !task.due_at ? "Sem prazo" : diaCivilDe(task.due_at) < today && task.status !== "done" ? "Atrasada" : diaCivilDe(task.due_at) === today ? task.all_day ? "Hoje" : time(task.due_at) : shortDate(diaCivilDe(task.due_at));
  const summary = [enabled("tarefas") && tasks ? `${tasks.openCount} tarefas abertas` : null, enabled("calendario") && agenda ? `${agenda.items.length} compromissos hoje` : null,
    enabled("capturar") && captures ? `${captures.inbox.length} capturas por organizar` : null].filter(Boolean).join(" · ");
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, weekday: "long", day: "numeric", month: "long" }).format(new Date(now));
  const anyEnabled = ["tarefas", "capturar", "habitos", "financeiro", "calendario"].some((feature) => enabled(feature as FeatureKey));

  return <div className="home-view" data-access="allowed">
    <div className="home-intro"><div><p className="home-date">{dateLabel}{app.mode === "demo" ? " · dia de exemplo" : ""}</p><p className="home-summary">{summary || "Seu panorama acompanha os módulos que você escolheu."}</p></div><div className="home-actions">
      {enabled("tarefas") && <Link className="home-action" href="/tarefas?view=hoje">Ver o dia</Link>}
      {enabled("capturar") && <Link className="home-action home-action-primary" href="/capturar"><Icons.Capture />Capturar</Link>}
    </div></div>
    {actionError && <p className="home-action-error" role="alert">{actionError}</p>}
    {taskError && !centralPending && <div className="home-action-error home-actions"><p role="alert">{taskRequest?.uncertain ? "Não foi possível confirmar a alteração da tarefa. Confirme o mesmo envio antes de marcar outra tarefa." : taskError}</p>
      {taskRequest && <Button ref={retryTaskButton} loading={taskRequest.pending} disabled={!enabled("tarefas")} onClick={(event) => retryTask(event.currentTarget)}>{taskRequest.uncertain ? "Confirmar envio" : "Tentar novamente"}</Button>}
    </div>}
    {!anyEnabled && ready && <Card className="home-block"><h2>Escolha o que faz parte do seu dia</h2><Empty href="/configuracoes" action="Escolher módulos">Ative a exibição de um módulo para acompanhar seu panorama por aqui.</Empty></Card>}
    <div className="home-grid">
      {enabled("tarefas") && <Card variant="inverse" radius="xl" className="home-block home-focus" role="region" aria-labelledby="home-focus-title">
        <h2 id="home-focus-title">Em foco</h2>
        {focus ? <><h3>{focus.title}</h3><p className="home-focus-meta">{categoryName(focus)} · {dueLabel(focus)}{projectName ? ` · ${projectName}` : ""}</p>
          <div className="home-actions"><Link className="home-action home-action-inverse" href={`/tarefas?task=${encodeURIComponent(focus.id)}`}>Abrir tarefa</Link><Button ref={focusButton} variant="ghost" disabled={taskRequest !== null || centralPending} loading={taskRequest?.input.id === focus.id && taskRequest.pending} aria-pressed={focus.status === "done"} onClick={(event) => setTask(focus, event.currentTarget)}>{focus.status === "done" ? "Reabrir tarefa" : "Concluir agora"}</Button></div>
        </> : !tasksQuery.data && tasksQuery.status !== "error" ? <div className="home-skeleton" role="status"><span className="home-sr-only">Carregando tarefa em foco…</span><i /><i /></div> : <><p className="home-focus-meta">{tasksQuery.status === "error" ? "Seu foco volta quando a lista de tarefas carregar." : "Nenhuma tarefa pede sua atenção agora."}</p><Link className="home-link" href="/tarefas">Abrir tarefas<Icons.ChevronRight /></Link></>}
      </Card>}

      {enabled("tarefas") && <Block title="Tarefas de hoje" href="/tarefas?view=hoje" area="tasks" query={tasksQuery}>
        {tasks?.today.length ? <><ul className="home-list home-task-list">{tasks.today.slice(0, 5).map((task, index) => <li key={task.id} className={index >= 3 ? "home-desktop-row" : ""}>
          <button type="button" className="home-check" aria-label={`${task.status === "done" ? "Reabrir" : "Concluir"} ${task.title}`} aria-pressed={task.status === "done"} disabled={taskRequest !== null || centralPending} aria-busy={taskRequest?.input.id === task.id && taskRequest.pending || undefined} onClick={(event) => setTask(task, event.currentTarget)}><span>{task.status === "done" && <Icons.Check width={15} height={15} />}</span></button>
          <Link className="home-row-copy" href={`/tarefas?task=${encodeURIComponent(task.id)}`}><strong className={task.status === "done" ? "home-completed" : ""}>{task.title}</strong><span>{categoryName(task)} · {task.status === "done" ? "Concluída hoje" : dueLabel(task)}</span></Link>
        </li>)}</ul><p className="home-list-count"><span className="home-mobile-count">{Math.min(3, tasks.today.length)}</span><span className="home-wide-count">{Math.min(5, tasks.today.length)}</span> de {tasks.today.length} tarefas do dia</p></> : <Empty href="/tarefas" action="Organizar tarefas">Seu dia está livre de tarefas por aqui. Escolha a próxima quando precisar.</Empty>}
      </Block>}

      {enabled("calendario") && <Block title="Agenda de hoje" href="/calendario" link="Calendário" area="agenda" query={agendaQuery}>
        {agenda?.items.length ? <ul className="home-list">{agenda.items.slice(0, 3).map((event) => <li key={event.id}><time className="home-time" dateTime={event.starts_at}>{time(event.starts_at)}</time><Link className="home-row-copy" href={`/calendario?event=${encodeURIComponent(event.id)}`}><strong>{event.title}</strong><span>{event.location || `${Math.round((Date.parse(event.ends_at) - Date.parse(event.starts_at)) / 60_000)} min`}</span></Link></li>)}</ul> : <Empty href="/calendario" action="Abrir calendário">Nenhum compromisso para hoje. Veja os próximos dias no calendário.</Empty>}
      </Block>}

      {enabled("habitos") && <Block title="Hábitos de hoje" href="/habitos" link="Hábitos" area="habits" query={habitsQuery}>
        {habits?.items.length ? <><ul className="home-list">{habits.items.map((row) => <li key={row.habit.id}><button type="button" className="home-check" aria-label={`${row.done ? "Desmarcar" : "Marcar"} ${row.habit.name}${row.done ? "" : " como feito"}`} aria-pressed={row.done === true} disabled={row.done === null || pending.has(`habit-${row.habit.id}`)} aria-busy={pending.has(`habit-${row.habit.id}`) || undefined} onClick={() => { if (enabled("habitos")) void run(`habit-${row.habit.id}`, () => app.commands.habits.mark({ habit_id: row.habit.id, done_on: today, done: !row.done, client_id: crypto.randomUUID() }), row.done ? "Marcação removida." : "Hábito marcado como feito."); }}><span>{row.done && <Icons.Check width={15} height={15} />}</span></button><div className="home-row-copy"><strong className={row.done ? "home-completed" : ""}>{row.habit.name}</strong><span>{row.done === null ? "Sem marcação prevista hoje" : row.weeklyDone !== null ? `${row.weeklyDone} de ${row.habit.weekly_target} nesta semana` : `${row.summary.sequenciaAtual} ${row.summary.sequenciaAtual === 1 ? "dia" : "dias"} de sequência`}</span></div></li>)}</ul>
          {habits.summary.taxa !== null && <ProgressBar label="Semana dos hábitos" value={habits.summary.taxa} valueText={`${habits.summary.taxa}% cumprida`} />}</> : <Empty href="/habitos" action="Criar uma rotina">Uma rotina começa com um hábito. Escolha o primeiro para acompanhar.</Empty>}
      </Block>}

      {enabled("financeiro") && <Block title="Pulso financeiro" href="/financeiro" link="Financeiro" area="finance" query={financeQuery}>
        {finance && finance.balances.length ? <><p className="home-finance-period">{new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, month: "long", year: "numeric" }).format(new Date(now))} · valores confirmados</p><dl className="home-money"><div><dt>Resultado do mês</dt><dd>{!valuesHidden && finance.totals.balanceCents > 0 ? "+" : ""}{money(finance.totals.balanceCents)}</dd></div><div><dt>Entradas</dt><dd>{money(finance.totals.incomeCents)}</dd></div><div><dt>Saídas</dt><dd>{money(finance.totals.expenseCents)}</dd></div></dl>
          <ul className="home-list home-finance-list">{finance.cards.slice(0, 1).map((card) => <li key={card.account.id}><div className="home-row-copy"><strong>{card.account.name} · fatura {card.status}</strong><span>Fecha {shortDate(card.closes)} · vence {shortDate(card.due)}</span></div><span className="home-amount">{money(card.statement.openCents)}</span></li>)}{finance.balances.filter((balance) => !balance.is_credit).slice(0, 2).map((balance) => <li key={balance.account_id}><strong>{balance.name}</strong><span className="home-amount">{money(balance.balance_cents)}</span></li>)}</ul></> : <Empty href="/financeiro" action="Conhecer o Financeiro">Suas contas vão dar contexto aos números do mês. Comece por uma conta.</Empty>}
      </Block>}

      {enabled("capturar") && <Block title="Caixa de entrada" href="/capturar" link="Organizar" area="inbox" query={capturesQuery}>
        {captures?.inbox.length ? <ul className="home-list">{captures.inbox.slice(0, 3).map((capture) => <li key={capture.id}><Link className="home-row-copy" href={`/capturar?capture=${encodeURIComponent(capture.id)}`}><strong>{capture.title || capture.content?.slice(0, 100) || "Captura sem título"}</strong><span>{{ idea: "Ideia", task: "Tarefa", note: "Nota", reminder: "Lembrete" }[capture.type]}</span></Link><Icons.ChevronRight width={16} height={16} /></li>)}</ul> : <Empty href="/capturar" action="Capturar uma ideia">Caixa de entrada em dia. Capture a próxima ideia quando ela chegar.</Empty>}
        {captures && captures.total > 0 && <div className="home-organization"><ProgressBar label="Notas organizadas" value={captures.organized} max={captures.total} valueText={`${captures.organized} de ${captures.total}`} /><Link className="home-link" href="/capturar">{captures.inbox.length ? `Organizar ${captures.inbox.length} capturas` : "Abrir suas notas"}<Icons.ChevronRight width={16} height={16} /></Link></div>}
      </Block>}
    </div>
    {(enabled("tarefas") && tasks || enabled("capturar") && captures || enabled("calendario") && agenda) && <dl className="home-stats" aria-label="Resumo do seu dia">
      {enabled("tarefas") && tasks && <><div><dt>Tarefas abertas</dt><dd>{tasks.openCount}</dd></div><div><dt>Concluídas na semana</dt><dd>{tasks.completedWeek}</dd></div></>}
      {enabled("capturar") && captures && <div><dt>Capturas por organizar</dt><dd>{captures.inbox.length}</dd></div>}
      {enabled("calendario") && agenda && <div><dt>Compromissos hoje</dt><dd>{agenda.items.length}</dd>{agenda.next && <p>Próximo às {time(agenda.next.starts_at)}</p>}</div>}
    </dl>}
    <p className="home-session"><Badge>{app.mode === "connected" ? "Conta conectada" : "Dados de exemplo"}</Badge> {app.mode === "connected" ? "Capturar e Tarefas usam sua conta. Os demais blocos são exemplos desta sessão." : "Suas alterações acompanham esta sessão."}</p>
  </div>;
}
