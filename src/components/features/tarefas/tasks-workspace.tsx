"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import type { CamposTarefa, EdicaoTarefa, PrioridadeTarefa, StatusTarefa, Tarefa } from "@/core/tarefas";
import { paraCampoLocal } from "@/core/tempo";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn, type DataTableState } from "@/components/ui/data-table";
import { buildTableView } from "@/components/ui/table-model";
import { BottomSheet, ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { taskListState, type TaskPeriod } from "./task-form";
import { TaskEditor, TASK_PRIORITY, TASK_STATUS } from "./task-editor";
import { canDragTask, filterTaskDisplay, readTaskPresentation, saveTaskPresentation, taskBoardGroups, taskPresentationKey, type TaskDisplayState, type TaskPresentation } from "./task-board";
import { TaskActionCommand, TASK_ACTION_STATUS, TASK_STATUS_ACTION, subscribeTaskActionSettlements, type TaskItemAction as ItemAction } from "./task-action-command";
import "./tasks.css";

const actionMessage: Record<ItemAction, string> = { complete: "Tarefa concluída.", start: "Tarefa em andamento.", reopen: "Tarefa reaberta.", archive: "Tarefa arquivada.", remove: "Tarefa movida para a lixeira.", restore: "Tarefa restaurada." };
const civilLabel = (day: string) => day.split("-").reverse().join("/");
const shortCivil = (day: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00Z`));

export function TasksWorkspace() {
  const query = useDemoQuery("tasks");
  const app = useDemoApplication();
  const { subscribeCommands, getCommandSnapshot, userId } = app;
  const params = useSearchParams();
  const { toast } = useToast();
  const [state, setState] = useState<TaskDisplayState>("all");
  const [category, setCategory] = useState("");
  const [project, setProject] = useState("");
  const [priority, setPriority] = useState<PrioridadeTarefa | "">("");
  const [period, setPeriod] = useState<TaskPeriod>("all");
  const [presentation, setPresentation] = useState<TaskPresentation>("list");
  const [tableState, setTableState] = useState<DataTableState>({ search: "", sort: null, page: 1 });
  const [editor, setEditor] = useState<Tarefa | "new" | null>(null);
  const [initialValues, setInitialValues] = useState<Pick<Partial<CamposTarefa>, "status"> & { project?: string; category?: string }>({});
  const [selected, setSelected] = useState<Tarefa | null>(null);
  const [removing, setRemoving] = useState<Tarefa | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<{ task: Tarefa; action: ItemAction } | null>(null);
  const actionTrigger = useRef<HTMLElement | null>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const routeFocus = useRef<HTMLElement | null>(null);
  const handledNavigation = useRef<string | null>(null);
  const command = useRef(new TaskActionCommand());
  const board = useRef<HTMLDivElement>(null);
  const statusControls = useRef(new Map<string, HTMLSelectElement>());
  const columnHeadings = useRef(new Map<string, HTMLHeadingElement>());
  const confirmation = useRef<HTMLButtonElement>(null);
  const focusAfterAction = useRef<{ id: string; status: string } | null>(null);
  const draggedId = useRef<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const data = query.data;
  const today = app.today();
  const targetId = params.get("task");
  const requestedView = params.get("view");
  const requestedNew = params.get("new") === "1";
  const navigationKey = `${targetId ?? ""}|${requestedView ?? ""}|${requestedNew}`;

  useEffect(() => {
    try { setPresentation(readTaskPresentation(localStorage, app.userId)); } catch { /* Keep the session's default if storage is unavailable. */ }
    const receive = (event: StorageEvent) => {
      if (event.key === taskPresentationKey(app.userId)) setPresentation(event.newValue === "kanban" ? "kanban" : "list");
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, [app.userId]);

  useEffect(() => subscribeTaskActionSettlements({ subscribeCommands, getCommandSnapshot, userId }, command.current, (retained, feedback) => {
    setUncertain(null);
    setFailure(feedback.status === "rejected" ? feedback.message : null);
    if (presentation === "kanban") {
      const destination = feedback.status === "confirmed" ? TASK_ACTION_STATUS[retained.action] ?? retained.task.status : retained.task.status;
      focusAfterAction.current = { id: retained.task.id, status: destination };
      actionTrigger.current = columnHeadings.current.get(destination) ?? columnHeadings.current.values().next().value ?? routeFocus.current;
    }
    setSelected(null); setRemoving(null);
  }), [subscribeCommands, getCommandSnapshot, userId, presentation]);

  useEffect(() => {
    if (pending || editor || removing || !focusAfterAction.current || presentation !== "kanban" || (uncertain && !command.current.state)) return;
    const destination = focusAfterAction.current;
    focusAfterAction.current = null;
    if ((selected || removing) && !uncertain) return;
    const target = (uncertain ? confirmation.current : statusControls.current.get(destination.id))
      ?? columnHeadings.current.get(destination.status) ?? columnHeadings.current.values().next().value ?? routeFocus.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    const viewport = board.current?.getBoundingClientRect(), bounds = target.getBoundingClientRect();
    if (viewport && board.current) {
      if (bounds.left < viewport.left + 12) board.current.scrollLeft -= viewport.left + 12 - bounds.left;
      else if (bounds.right > viewport.right - 12) board.current.scrollLeft += bounds.right - viewport.right + 12;
    }
    const top = Math.max(16, document.querySelector(".shell-topbar")?.getBoundingClientRect().bottom ?? 16);
    const bottomNav = document.querySelector(".shell-bottom")?.getBoundingClientRect();
    const bottom = bottomNav?.height ? Math.min(window.innerHeight - 16, bottomNav.top - 16) : window.innerHeight - 16;
    if (bounds.top < top || bounds.bottom > bottom) window.scrollBy({ top: (bounds.top + bounds.bottom - top - bottom) / 2, behavior: "instant" });
  }, [data, pending, presentation, uncertain, selected, removing, editor]);

  useEffect(() => {
    if (!data || handledNavigation.current === navigationKey) return;
    handledNavigation.current = navigationKey;
    if (requestedNew) { editorTrigger.current = routeFocus.current; setInitialValues({}); setEditor("new"); return; }
    if (targetId) {
      const task = data.items.find((item) => item.id === targetId);
      setEditor(null); setSelected(null); setRemoving(null);
      setCategory(""); setProject(""); setPriority(""); setPeriod("all"); setTableState({ search: "", sort: null, page: 1 });
      if (!task) { setFailure("Esta tarefa não está disponível nesta sessão."); return; }
      setFailure(null); setState(taskListState(task));
      if (task.deleted_at) { actionTrigger.current = routeFocus.current; setSelected(task); }
      else { editorTrigger.current = routeFocus.current; setEditor(task); }
    } else if (requestedView === "hoje") {
      setState("active"); setCategory(""); setProject(""); setPriority(""); setPeriod("today"); setTableState({ search: "", sort: null, page: 1 });
    }
  }, [data, navigationKey, requestedView, targetId, requestedNew]);

  function openEditor(task: Tarefa | "new", trigger: HTMLElement, status: StatusTarefa = "todo") {
    editorTrigger.current = trigger;
    setInitialValues(task === "new" ? { status, project: data?.projects.some(item => item.id === project && !item.deleted_at) ? project : "", category: category === "none" ? "" : category } : {});
    setFailure(null); setEditor(task);
  }
  function closeEditor() {
    setEditor(null);
    if (params.has("new") || params.has("task")) {
      const next = new URLSearchParams(params); next.delete("new"); next.delete("task");
      window.history.replaceState(null, "", "/tarefas" + (next.size ? "?" + next.toString() : ""));
    }
  }

  async function runAction(task: Tarefa, action: ItemAction) {
    const retained = command.current.state;
    const request = retained?.uncertain && retained.task.id === task.id && retained.action === action ? command.current.retry() : command.current.begin(task, action);
    if (!request) return;
    setPending(true); setFailure(null);
    const destination = TASK_ACTION_STATUS[action] ?? task.status;
    if (presentation === "kanban") focusAfterAction.current = { id: task.id, status: destination };
    try {
      const input = request.input;
      const result = action === "remove" ? await app.commands.tasks.remove(input)
        : action === "restore" ? await app.commands.tasks.restore(input)
          : await app.commands.tasks.status({ ...input, status: TASK_ACTION_STATUS[action]! });
      command.current.settled(input.client_id);
      setUncertain(null);
      if (presentation === "kanban") actionTrigger.current = columnHeadings.current.get(destination) ?? columnHeadings.current.values().next().value ?? routeFocus.current;
      setSelected(null); setRemoving(null);
      if (action === "restore") { setState(taskListState(result)); setCategory(""); setProject(""); setPriority(""); setPeriod("all"); setTableState(previous => ({ ...previous, page: 1 })); }
      toast({ message: actionMessage[action], ...(action === "remove" ? { action: { label: "Desfazer", onClick: () => { void runAction(task, "restore"); } } } : {}) });
    } catch (error) {
      command.current.failed(error);
      setUncertain(command.current.state?.uncertain ? { task: request.task, action: request.action } : null);
      if (presentation === "kanban") focusAfterAction.current = { id: task.id, status: task.status };
      setFailure(error instanceof Error ? error.message : "Não foi possível alterar a tarefa. Tente novamente.");
    }
    finally { setPending(false); }
  }

  async function save(fields: CamposTarefa, patch: EdicaoTarefa | null, clientId: string) {
    const result = editor && editor !== "new" && patch
      ? await app.commands.tasks.update({ id: editor.id, client_id: clientId, patch })
      : await app.commands.tasks.create({ ...fields, client_id: clientId });
    if (presentation === "kanban") focusAfterAction.current = { id: result.id, status: result.status };
    if (editor === "new") { setState(presentation === "kanban" && result.status !== "archived" ? "all" : taskListState(result)); setCategory(""); setProject(""); setPriority(""); setPeriod("all"); setTableState(previous => ({ ...previous, search: "", page: 1 })); }
    toast({ message: editor === "new" ? "Tarefa criada." : "Tarefa atualizada." });
  }

  function clearDrag() { draggedId.current = null; setDraggedTask(null); setDropTarget(null); }
  function switchPresentation(next: TaskPresentation) {
    clearDrag(); setPresentation(next);
    let saved = false;
    try { saved = saveTaskPresentation(localStorage, app.userId, next); } catch { /* Storage access itself can throw. */ }
    if (!saved) toast({ message: "A visualização foi alterada. O navegador não permitiu lembrar esta preferência." });
  }
  function dropTask(event: DragEvent<HTMLElement>, status: string) {
    const task = data?.items.find(item => item.id === draggedId.current);
    const valid = status === "todo" || status === "in_progress" || status === "done";
    if (task && canDragTask(task) && valid && !pending && !uncertain) {
      event.preventDefault();
      if (task.status !== status) void runAction(task, TASK_STATUS_ACTION[status]);
    }
    clearDrag();
  }

  if (!data) return <section className="tasks-state" data-access="allowed" aria-busy={query.status !== "error"}>
    {query.status === "error" ? <><h2>Não foi possível carregar as tarefas</h2><p role="alert">{query.error || "Tente novamente para recuperar a lista."}</p><Button onClick={query.retry}>Tentar novamente</Button></>
      : <><p role="status">Carregando tarefas…</p><div className="tasks-skeleton" aria-hidden="true" /></>}
  </section>;

  const categoryName = (task: Tarefa) => data.categories.find((item) => item.id === task.category_id)?.name ?? (task.category_id ? "Categoria indisponível" : "Sem categoria");
  const projectName = (task: Tarefa) => data.projects.find((item) => item.id === task.project_id)?.name;
  const rows = filterTaskDisplay(data.items, { state, category, project, priority, period, today }).sort((a, b) => a.id === targetId ? -1 : b.id === targetId ? 1 : 0);
  const hasFilters = Boolean(category || project || priority || tableState.search) || period !== "all";
  const isEmpty = data.items.length === 0;
  const clearFilters = () => { setCategory(""); setProject(""); setPriority(""); setPeriod("all"); setTableState(previous => ({ ...previous, search: "", page: 1 })); };
  const dayLabel = (day: string) => day === today ? "Hoje" : shortCivil(day);
  const renderDue = (task: Tarefa) => {
    const day = paraCampoLocal(task.due_at, "date");
    const late = taskListState(task) === "active" && day && day < today;
    return day ? <time dateTime={task.due_at!} className={`tasks-due${late ? " tasks-overdue" : ""}`}>{late ? "Atrasada · " : ""}{dayLabel(day)}{task.all_day ? "" : ` · ${paraCampoLocal(task.due_at, "datetime").slice(11)}`}</time> : <span className="tasks-due">Sem prazo</span>;
  };
  const itemAction = (task: Tarefa): ItemAction => task.deleted_at ? "restore" : task.status === "done" || task.status === "archived" ? "reopen" : "complete";
  const actionVerb: Record<ItemAction, string> = { complete: "Concluir", start: "Iniciar", reopen: "Reabrir", archive: "Arquivar", remove: "Excluir", restore: "Restaurar" };
  /* Layout Codex: Tarefa (check + título + contexto) · Projeto · Prioridade · Prazo · Estado · Ações. */
  const columns: DataTableColumn<Tarefa>[] = [
    { id: "title", header: "Tarefa", accessor: (task) => `${task.title} ${task.description ?? ""} ${projectName(task) ?? ""} ${categoryName(task)}`, render: (task) => <div className="tasks-title-cell">
      <button type="button" className="tasks-check" aria-label={`${actionVerb[itemAction(task)]} ${task.title}`} aria-pressed={task.deleted_at ? undefined : task.status === "done"} disabled={pending || !!uncertain}
        data-state={task.deleted_at ? "deleted" : task.status === "done" || task.status === "archived" ? "done" : "open"} onClick={() => { void runAction(task, itemAction(task)); }}>
        <span>{task.deleted_at ? <Icons.Refresh width={15} height={15} /> : (task.status === "done" || task.status === "archived") && <Icons.Check width={15} height={15} />}</span>
      </button>
      <div className="tasks-copy">
        {task.deleted_at ? <strong className="tasks-title-text">{task.title}</strong> : <Button variant="ghost" className={`tasks-title-button${task.status === "done" ? " is-done" : ""}`} onClick={(event) => openEditor(task, event.currentTarget)} disabled={pending || !!uncertain}>{task.title}</Button>}
        <span className="tasks-note">{categoryName(task)}{task.origin_capture_id && <> · <Link className="tasks-origin" href={`/capturar?capture=${encodeURIComponent(task.origin_capture_id)}`}>Abrir origem</Link></>}</span>
      </div>
    </div> },
    { id: "project", header: "Projeto", accessor: (task) => projectName(task) ?? "", render: (task) => <span className="tasks-project">{projectName(task) ?? "Sem projeto"}</span> },
    { id: "priority", header: "Prioridade", accessor: (task) => TASK_PRIORITY[task.priority], render: (task) => <Badge className={`tasks-badge${task.priority === "high" || task.priority === "urgent" ? " is-warm" : ""}`} tone={task.priority === "urgent" ? "outline" : "default"}>{TASK_PRIORITY[task.priority]}</Badge> },
    { id: "due", header: "Prazo", accessor: (task) => task.due_at ? Date.parse(task.due_at) : null, searchable: false, render: renderDue },
    { id: "status", header: "Estado", accessor: (task) => TASK_STATUS[task.status], render: (task) => <Badge className={`tasks-badge${task.deleted_at ? "" : task.status === "in_progress" ? " is-progress" : task.status === "done" ? " is-done" : ""}`}>{task.deleted_at ? `${TASK_STATUS[task.status]} · na lixeira` : TASK_STATUS[task.status]}</Badge> },
    { id: "actions", header: "Ações", accessor: () => "", sortable: false, searchable: false, render: (task) => <div className="tasks-row-actions">
      <Button variant="ghost" className="tasks-more" disabled={pending || !!uncertain} aria-label={`Ações de ${task.title}`} onClick={(event) => { actionTrigger.current = event.currentTarget; setFailure(null); setSelected(task); }}><Icons.Dots width={18} height={18} /></Button>
    </div> },
  ];
  const view = buildTableView({ rows, columns, search: tableState.search, sort: tableState.sort, pageSize: Math.max(1, rows.length) });
  const open = view.rows.filter(task => taskListState(task) === "active");
  const overdue = open.filter(task => { const day = paraCampoLocal(task.due_at, "date"); return day && day < today; });
  const done = view.rows.filter(task => taskListState(task) === "done");
  const groups = taskBoardGroups(view.rows, state);
  const special = state === "archived" || state === "trash";
  const unavailable = query.status === "loading" || query.status === "error";
  const emptyMessage = isEmpty ? "Sua lista está vazia. Crie a primeira tarefa para organizar o próximo passo." : hasFilters ? "Nenhuma tarefa corresponde aos filtros escolhidos. Limpe os filtros para ver a lista." : state === "trash" ? "A lixeira está vazia." : state === "archived" ? "Nenhuma tarefa arquivada." : state === "done" ? "Ainda não há tarefas concluídas." : "Nenhuma tarefa aberta. Crie uma tarefa ou consulte as concluídas.";

  return <section ref={routeFocus} tabIndex={-1} className="tasks-workspace" data-access="allowed" aria-label="Gestão de tarefas">
    <div className="tasks-toolbar"><div><p className="tasks-summary" role="status">{open.length} {open.length === 1 ? "aberta" : "abertas"} · {overdue.length} {overdue.length === 1 ? "atrasada" : "atrasadas"} · {done.length} {done.length === 1 ? "concluída" : "concluídas"}</p><p className="tasks-note">{app.mode === "connected" ? `Hoje: ${civilLabel(today)}. Tarefas salvas na sua conta.` : `Dia de exemplo: ${civilLabel(today)}. Alterações valem nesta sessão.`}</p></div>
      <div className="tasks-display-actions">
        <div className="task-view-switch" role="group" aria-label="Visualização de tarefas">
          <Button variant="ghost" aria-pressed={presentation === "list"} onClick={() => switchPresentation("list")}><Icons.List width={17} height={17} />Lista</Button>
          <Button variant="ghost" aria-pressed={presentation === "kanban"} onClick={() => switchPresentation("kanban")}><Icons.Board width={17} height={17} />Kanban</Button>
        </div>
        <Button variant="primary" onClick={(event) => openEditor("new", event.currentTarget)} disabled={pending || !!uncertain}><Icons.Capture />Nova tarefa</Button>
      </div></div>
    <div className="tasks-filters" role="group" aria-label="Filtros de tarefas">
      <Field as="select" label="Mostrar tarefas" visuallyHiddenLabel value={state} onChange={(event) => { clearDrag(); setState(event.target.value as TaskDisplayState); setPeriod("all"); setTableState(previous => ({ ...previous, page: 1 })); }}>
        <option value="all">Todas as tarefas</option><option value="active">Tarefas abertas</option><option value="done">Concluídas</option><option value="archived">Arquivadas</option><option value="trash">Lixeira</option>
      </Field>
      <Field as="select" label="Filtrar projeto" visuallyHiddenLabel value={project} onChange={(event) => { setProject(event.target.value); setTableState(previous => ({ ...previous, page: 1 })); }}>
        <option value="">Todos os projetos</option><option value="none">Sem projeto</option>
        {data.projects.map(item => <option key={item.id} value={item.id}>{item.name}{item.deleted_at ? " (excluído)" : ""}</option>)}
      </Field>
      <Field as="select" label="Filtrar prioridade" visuallyHiddenLabel value={priority} onChange={(event) => { setPriority(event.target.value as PrioridadeTarefa | ""); setTableState(previous => ({ ...previous, page: 1 })); }}>
        <option value="">Todas as prioridades</option>
        {Object.entries(TASK_PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Field>
      <Field as="select" label="Filtrar categoria" visuallyHiddenLabel value={category} onChange={(event) => { setCategory(event.target.value); setTableState(previous => ({ ...previous, page: 1 })); }}>
        <option value="">Todas as categorias</option><option value="none">Sem categoria</option>
        {data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </Field>
      <Field as="select" label="Prazo das tarefas" visuallyHiddenLabel value={period} onChange={(event) => { setPeriod(event.target.value as TaskPeriod); setTableState(previous => ({ ...previous, page: 1 })); }}>
        <option value="all">Qualquer prazo</option><option value="today">Hoje</option>{(state === "active" || state === "all") && <option value="overdue">Atrasadas</option>}
      </Field>
      {hasFilters && <Button variant="ghost" onClick={clearFilters}>Limpar filtros</Button>}
    </div>
    {failure && !selected && !removing && <p className="tasks-error" role="alert">{failure}</p>}
    {uncertain && !selected && !removing && <Button ref={confirmation} onClick={() => void runAction(uncertain.task, uncertain.action)} disabled={pending}>Confirmar o mesmo envio</Button>}
    {presentation === "list" ? <DataTable key={navigationKey} label="Lista de tarefas" rows={rows} columns={columns} getRowId={(task) => task.id} searchLabel="Buscar tarefas" pageSize={5} state={tableState} onStateChange={setTableState}
      loading={query.status === "loading"} error={query.status === "error" ? query.error || "Não foi possível atualizar as tarefas." : undefined} onRetry={query.retry}
      emptyMessage={emptyMessage} /> : <section className="tasks-board-view" aria-label="Tarefas em Kanban" aria-busy={query.status === "loading" || undefined}>
      <div className="tasks-board-controls">
        <Field label="Buscar tarefas" type="search" value={tableState.search} disabled={unavailable} onChange={event => setTableState(previous => ({ ...previous, search: event.target.value, page: 1 }))} />
        <div className="tasks-board-sort-controls">
          <Field as="select" label="Ordenar por" value={tableState.sort?.columnId ?? ""} disabled={unavailable} onChange={event => { const columnId = event.target.value; setTableState(previous => ({ ...previous, sort: columnId ? { columnId, direction: "asc" } : null, page: 1 })); }}>
            <option value="">Ordem original</option>
            {columns.filter(column => column.sortable !== false).map(column => <option key={column.id} value={column.id}>{column.header}</option>)}
          </Field>
          <Button disabled={unavailable || !tableState.sort} aria-label={tableState.sort?.direction === "desc" ? "Usar ordem crescente" : "Usar ordem decrescente"} onClick={() => setTableState(previous => ({ ...previous, sort: previous.sort ? { ...previous.sort, direction: previous.sort.direction === "asc" ? "desc" : "asc" } : null, page: 1 }))}>{tableState.sort?.direction === "desc" ? "Decrescente" : "Crescente"}</Button>
        </div>
        <p className="task-results" role="status">{view.total} {view.total === 1 ? "tarefa" : "tarefas"}</p>
      </div>
      {unavailable ? <div className="tasks-state">{query.status === "error" ? <><p className="tasks-error" role="alert">{query.error || "Não foi possível atualizar as tarefas."}</p><Button onClick={query.retry}>Tentar novamente</Button></> : <><p role="status">Carregando tarefas…</p><div className="tasks-skeleton" aria-hidden="true" /></>}</div> : <>
        {!special && <p className="kanban-hint"><span className="kanban-hint-desktop">Arraste pelo ícone ou altere o estado no cartão.</span><span className="kanban-hint-touch">Deslize para ver as colunas. Altere o estado no cartão.</span></p>}
        <div ref={board} className={`kanban-board${special ? " is-single-column" : ""}`} role="region" aria-label="Quadro de tarefas" tabIndex={0} onKeyDown={event => { if (event.key === "Escape") clearDrag(); }}>
          {groups.map(group => <section key={group.status} className={`kanban-column${dropTarget === group.status ? " is-drop-target" : ""}`} data-status={group.status} aria-labelledby={`kanban-heading-${group.status}`}
            onDragOver={event => { if (draggedId.current && !special && !pending && !uncertain) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(group.status); } }}
            onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropTarget(null); }} onDrop={event => dropTask(event, group.status)}>
            <div className="kanban-column-head"><h2 id={`kanban-heading-${group.status}`} tabIndex={-1} ref={element => { if (element) columnHeadings.current.set(group.status, element); else columnHeadings.current.delete(group.status); }}>{group.label}</h2><span className="kanban-count" aria-label={`${group.items.length} ${group.items.length === 1 ? "tarefa" : "tarefas"}`}>{group.items.length}</span></div>
            <div className="kanban-cards">{group.items.map(task => <article key={task.id} className={`kanban-card${task.status === "done" ? " is-complete" : ""}${draggedTask === task.id ? " is-dragging" : ""}`} data-task-id={task.id} aria-busy={pending && command.current.state?.task.id === task.id || undefined}>
              <div className="kanban-card-context"><span className="kanban-project"><Icons.Folder width={14} height={14} />{projectName(task) ?? (task.project_id ? "Projeto indisponível" : "Sem projeto")}</span>
                {canDragTask(task) && <span className="kanban-drag-handle" draggable={!pending && !uncertain} aria-hidden="true" title="Arraste para mover" onDragStart={event => {
                  if (pending || uncertain) { event.preventDefault(); return; }
                  draggedId.current = task.id; setDraggedTask(task.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", task.id);
                  const card = event.currentTarget.closest(".kanban-card"); if (card) event.dataTransfer.setDragImage(card, 24, 24);
                }} onDragEnd={clearDrag}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" focusable="false"><path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" /></svg></span>}
              </div>
              {task.deleted_at ? <strong className="kanban-card-title">{task.title}</strong> : <Button variant="ghost" className="kanban-card-title" disabled={pending || !!uncertain} onClick={event => { if (!draggedId.current) openEditor(task, event.currentTarget); }}>{task.title}</Button>}
              <p className="kanban-card-category">{categoryName(task)}{task.origin_capture_id && <> · <Link className="tasks-origin" href={`/capturar?capture=${encodeURIComponent(task.origin_capture_id)}`}>Abrir origem</Link></>}</p>
              <div className="kanban-card-meta"><Badge className={`tasks-badge${task.priority === "high" || task.priority === "urgent" ? " is-warm" : ""}`} tone={task.priority === "urgent" ? "outline" : "default"}>{TASK_PRIORITY[task.priority]}</Badge>{renderDue(task)}</div>
              <div className="kanban-card-footer">{task.deleted_at ? <Button className="kanban-restore" disabled={pending || !!uncertain} onClick={() => void runAction(task, "restore")}><Icons.Refresh width={15} height={15} />Restaurar tarefa</Button> : <Field as="select" label={`Estado de ${task.title}`} visuallyHiddenLabel className="kanban-status-select" value={task.status} disabled={pending || !!uncertain} ref={element => { if (element) statusControls.current.set(task.id, element); else statusControls.current.delete(task.id); }} onChange={event => { if (event.target.value !== task.status) void runAction(task, TASK_STATUS_ACTION[event.target.value as StatusTarefa]); }}>
                {Object.entries(TASK_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Field>}
                <Button variant="ghost" className="tasks-more" disabled={pending || !!uncertain} aria-label={`Ações de ${task.title}`} onClick={event => { actionTrigger.current = event.currentTarget; setFailure(null); setSelected(task); }}><Icons.Dots width={18} height={18} /></Button>
              </div>
            </article>)}</div>
            {group.items.length === 0 && <p className="kanban-empty">{special && !hasFilters ? state === "trash" ? "A lixeira está vazia." : "Nenhuma tarefa arquivada." : "Nenhuma tarefa nesta etapa com os filtros atuais."}</p>}
            {!special && <Button variant="ghost" className="kanban-add" disabled={pending || !!uncertain} aria-label={`Nova tarefa em ${group.label}`} onClick={event => openEditor("new", event.currentTarget, group.status as StatusTarefa)}><Icons.Capture width={16} height={16} />Nova tarefa</Button>}
          </section>)}
        </div>
      </>}
    </section>}
    {editor && <TaskEditor key={editor === "new" ? "new" : editor.id} task={editor === "new" ? undefined : editor} initialValues={initialValues} categories={data.categories} projects={data.projects} returnFocusRef={editorTrigger} onClose={closeEditor} onSave={save} />}
    {selected && <BottomSheet open title="Ações da tarefa" description={selected.title} returnFocusRef={actionTrigger} dismissible={!pending} onClose={() => setSelected(null)}>
      <div className="tasks-action-menu">{failure && <p className="tasks-error" role="alert">{failure}</p>}
        {uncertain && <Button ref={confirmation} onClick={() => void runAction(uncertain.task, uncertain.action)} disabled={pending}>Confirmar o mesmo envio</Button>}
        {selected.deleted_at ? <Button loading={pending} onClick={() => { void runAction(selected, "restore"); }}>Restaurar tarefa</Button> : <>
          <Button disabled={pending || !!uncertain} onClick={() => { const task = selected; setSelected(null); editorTrigger.current = actionTrigger.current; setEditor(task); }}>Editar tarefa</Button>
          <Button loading={pending} onClick={() => { void runAction(selected, selected.status === "done" || selected.status === "archived" ? "reopen" : "complete"); }}>{selected.status === "done" || selected.status === "archived" ? "Reabrir tarefa" : "Concluir tarefa"}</Button>
          {selected.status !== "archived" && <Button disabled={pending || !!uncertain} onClick={() => { void runAction(selected, "archive"); }}>Arquivar tarefa</Button>}
          <Button variant="danger" disabled={pending || !!uncertain} onClick={() => { setRemoving(selected); setSelected(null); setFailure(null); }}>Excluir tarefa</Button>
        </>}
        {selected.origin_capture_id && <Link className="tasks-origin" href={`/capturar?capture=${encodeURIComponent(selected.origin_capture_id)}`}>Abrir captura de origem</Link>}
      </div>
    </BottomSheet>}
    <ConfirmDialog open={Boolean(removing)} title="Mover tarefa para a lixeira?" description={removing ? `“${removing.title}” poderá ser restaurada depois.` : undefined}
      confirmLabel="Mover para a lixeira" loading={pending} error={failure ?? undefined} returnFocusRef={actionTrigger} onClose={() => setRemoving(null)} onConfirm={() => { if (removing) void runAction(removing, "remove"); }} />
  </section>;
}
