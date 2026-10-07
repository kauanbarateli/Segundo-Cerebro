"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CamposTarefa, EdicaoTarefa, Tarefa } from "@/core/tarefas";
import { paraCampoLocal } from "@/core/tempo";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { BottomSheet, ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { filterTasks, taskListState, type TaskListState, type TaskPeriod } from "./task-form";
import { TaskEditor, TASK_PRIORITY, TASK_STATUS } from "./task-editor";
import "./tasks.css";

type ItemAction = "complete" | "reopen" | "archive" | "remove" | "restore";
const actionMessage: Record<ItemAction, string> = { complete: "Tarefa concluída.", reopen: "Tarefa reaberta.", archive: "Tarefa arquivada.", remove: "Tarefa movida para a lixeira.", restore: "Tarefa restaurada." };
const civilLabel = (day: string) => day.split("-").reverse().join("/");

export function TasksWorkspace() {
  const query = useDemoQuery("tasks");
  const app = useDemoApplication();
  const params = useSearchParams();
  const { toast } = useToast();
  const [state, setState] = useState<TaskListState>("active");
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState<TaskPeriod>("all");
  const [editor, setEditor] = useState<Tarefa | "new" | null>(null);
  const [selected, setSelected] = useState<Tarefa | null>(null);
  const [removing, setRemoving] = useState<Tarefa | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const actionTrigger = useRef<HTMLElement | null>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const routeFocus = useRef<HTMLElement | null>(null);
  const handledNavigation = useRef<string | null>(null);
  const busy = useRef(false);
  const requests = useRef(new Map<string, { action: ItemAction; id: string }>());
  const data = query.data;
  const today = app.today();
  const targetId = params.get("task");
  const requestedView = params.get("view");
  const navigationKey = `${targetId ?? ""}|${requestedView ?? ""}`;

  useEffect(() => {
    if (!data || handledNavigation.current === navigationKey) return;
    handledNavigation.current = navigationKey;
    if (targetId) {
      const task = data.items.find((item) => item.id === targetId);
      setEditor(null); setSelected(null); setRemoving(null);
      setCategory(""); setPeriod("all");
      if (!task) { setFailure("Esta tarefa não está disponível nesta sessão."); return; }
      setFailure(null); setState(taskListState(task));
      if (task.deleted_at) { actionTrigger.current = routeFocus.current; setSelected(task); }
      else { editorTrigger.current = routeFocus.current; setEditor(task); }
    } else if (requestedView === "hoje") {
      setState("active"); setCategory(""); setPeriod("today");
    }
  }, [data, navigationKey, requestedView, targetId]);

  function openEditor(task: Tarefa | "new", trigger: HTMLElement) {
    editorTrigger.current = trigger;
    setFailure(null); setEditor(task);
  }

  async function runAction(task: Tarefa, action: ItemAction) {
    if (busy.current) {
      if (action === "restore") toast({ message: "Aguarde a ação atual para restaurar.", action: { label: "Restaurar tarefa", onClick: () => { void runAction(task, action); } } });
      return;
    }
    let request = requests.current.get(task.id);
    if (request?.action !== action) { request = { action, id: crypto.randomUUID() }; requests.current.set(task.id, request); }
    busy.current = true; setPending(true); setFailure(null);
    try {
      const input = { id: task.id, client_id: request.id };
      const result = action === "remove" ? await app.commands.tasks.remove(input)
        : action === "restore" ? await app.commands.tasks.restore(input)
          : await app.commands.tasks.status({ ...input, status: action === "complete" ? "done" : action === "archive" ? "archived" : "todo" });
      requests.current.delete(task.id);
      setSelected(null); setRemoving(null);
      if (action === "restore") { setState(taskListState(result)); setCategory(""); setPeriod("all"); }
      toast({ message: actionMessage[action], ...(action === "remove" ? { action: { label: "Desfazer", onClick: () => { void runAction(task, "restore"); } } } : {}) });
    } catch (error) { setFailure(error instanceof Error ? error.message : "Não foi possível alterar a tarefa. Tente novamente."); }
    finally { busy.current = false; setPending(false); }
  }

  async function save(fields: CamposTarefa, patch: EdicaoTarefa | null, clientId: string) {
    const result = editor && editor !== "new" && patch
      ? await app.commands.tasks.update({ id: editor.id, client_id: clientId, patch })
      : await app.commands.tasks.create({ ...fields, client_id: clientId });
    requests.current.delete(result.id);
    if (editor === "new") { setState(taskListState(result)); setCategory(""); setPeriod("all"); }
    toast({ message: editor === "new" ? "Tarefa criada." : "Tarefa atualizada." });
  }

  if (!data) return <section className="tasks-state" data-access="allowed" aria-busy={query.status !== "error"}>
    {query.status === "error" ? <><h2>Não foi possível carregar as tarefas</h2><p role="alert">{query.error || "Tente novamente para recuperar a lista."}</p><Button onClick={query.retry}>Tentar novamente</Button></>
      : <><p role="status">Carregando tarefas…</p><div className="tasks-skeleton" aria-hidden="true" /></>}
  </section>;

  const categoryName = (task: Tarefa) => data.categories.find((item) => item.id === task.category_id)?.name ?? (task.category_id ? "Categoria indisponível" : "Sem categoria");
  const projectName = (task: Tarefa) => data.projects.find((item) => item.id === task.project_id)?.name;
  const rows = filterTasks(data.items, state, category, period, today).sort((a, b) => a.id === targetId ? -1 : b.id === targetId ? 1 : 0);
  const open = data.items.filter((task) => taskListState(task) === "active");
  const overdue = open.filter((task) => { const day = paraCampoLocal(task.due_at, "date"); return day && day < today; });
  const done = data.items.filter((task) => taskListState(task) === "done");
  const hasFilters = Boolean(category) || period !== "all";
  const isEmpty = data.items.length === 0;
  const clearFilters = () => { setCategory(""); setPeriod("all"); };
  const columns: DataTableColumn<Tarefa>[] = [
    { id: "title", header: "Tarefa", accessor: (task) => `${task.title} ${task.description ?? ""} ${projectName(task) ?? ""}`, render: (task) => <div className="tasks-title-cell">
      {task.deleted_at ? <strong>{task.title}</strong> : <Button variant="ghost" className="tasks-title-button" onClick={(event) => openEditor(task, event.currentTarget)} disabled={pending}>{task.title}</Button>}
      {projectName(task) && <span className="tasks-note">{projectName(task)}</span>}
      {task.origin_capture_id && <Link className="tasks-origin" href={`/capturar?capture=${encodeURIComponent(task.origin_capture_id)}`}>Abrir origem</Link>}
    </div> },
    { id: "status", header: "Estado", accessor: (task) => TASK_STATUS[task.status], render: (task) => <Badge>{TASK_STATUS[task.status]}</Badge> },
    { id: "category", header: "Categoria", accessor: categoryName },
    { id: "due", header: "Prazo", accessor: (task) => task.due_at ? Date.parse(task.due_at) : null, searchable: false, render: (task) => {
      const day = paraCampoLocal(task.due_at, "date");
      const late = taskListState(task) === "active" && day && day < today;
      return day ? <span className={late ? "tasks-overdue" : undefined}>{late ? "Atrasada · " : ""}{day === today ? "Hoje" : civilLabel(day)}{task.all_day ? " · dia inteiro" : ` · ${paraCampoLocal(task.due_at, "datetime").slice(11)}`}</span> : "Sem prazo";
    } },
    { id: "priority", header: "Prioridade", accessor: (task) => TASK_PRIORITY[task.priority], render: (task) => <Badge tone={task.priority === "urgent" ? "outline" : "default"}>{TASK_PRIORITY[task.priority]}</Badge> },
    { id: "actions", header: "Ações", accessor: () => "", sortable: false, searchable: false, render: (task) => <div className="tasks-row-actions">
      <Button variant="ghost" disabled={pending} onClick={() => { void runAction(task, task.deleted_at ? "restore" : task.status === "done" || task.status === "archived" ? "reopen" : "complete"); }}>{task.deleted_at ? "Restaurar" : task.status === "done" || task.status === "archived" ? "Reabrir" : "Concluir"}</Button>
      <Button variant="ghost" disabled={pending} aria-label={`Ações de ${task.title}`} onClick={(event) => { actionTrigger.current = event.currentTarget; setFailure(null); setSelected(task); }}>Ações</Button>
    </div> },
  ];

  return <section ref={routeFocus} tabIndex={-1} className="tasks-workspace" data-access="allowed" aria-label="Gestão de tarefas">
    <div className="tasks-toolbar"><div><p className="tasks-summary" role="status">{open.length} {open.length === 1 ? "aberta" : "abertas"} · {overdue.length} {overdue.length === 1 ? "atrasada" : "atrasadas"} · {done.length} {done.length === 1 ? "concluída" : "concluídas"}</p><p className="tasks-note">Dia de exemplo: {civilLabel(today)}. Alterações valem nesta sessão.</p></div>
      <Button variant="primary" onClick={(event) => openEditor("new", event.currentTarget)} disabled={pending}><Icons.Capture />Nova tarefa</Button></div>
    <div className="tasks-filters" role="group" aria-label="Filtros de tarefas">
      <Field as="select" label="Mostrar tarefas" value={state} onChange={(event) => { setState(event.target.value as TaskListState); setPeriod("all"); }}>
        <option value="active">Abertas</option><option value="done">Concluídas</option><option value="archived">Arquivadas</option><option value="trash">Lixeira</option>
      </Field>
      <Field as="select" label="Filtrar categoria" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Todas as categorias</option><option value="none">Sem categoria</option>
        {data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </Field>
      <Field as="select" label="Prazo das tarefas" value={period} onChange={(event) => setPeriod(event.target.value as TaskPeriod)}>
        <option value="all">Qualquer prazo</option><option value="today">Hoje</option>{state === "active" && <option value="overdue">Atrasadas</option>}
      </Field>
      {hasFilters && <Button variant="ghost" onClick={clearFilters}>Limpar filtros</Button>}
    </div>
    {failure && !selected && !removing && <p className="tasks-error" role="alert">{failure}</p>}
    <DataTable key={navigationKey} label="Lista de tarefas" rows={rows} columns={columns} getRowId={(task) => task.id} searchLabel="Buscar tarefas" pageSize={5}
      loading={query.status === "loading"} error={query.status === "error" ? query.error || "Não foi possível atualizar as tarefas." : undefined} onRetry={query.retry}
      emptyMessage={isEmpty ? "Sua lista está vazia. Crie a primeira tarefa para organizar o próximo passo." : hasFilters ? "Nenhuma tarefa corresponde aos filtros escolhidos. Limpe os filtros para ver a lista." : state === "trash" ? "A lixeira está vazia." : state === "archived" ? "Nenhuma tarefa arquivada." : state === "done" ? "Ainda não há tarefas concluídas." : "Nenhuma tarefa aberta. Crie uma tarefa ou consulte as concluídas."} />
    {editor && <TaskEditor key={editor === "new" ? "new" : editor.id} task={editor === "new" ? undefined : editor} categories={data.categories} projects={data.projects} returnFocusRef={editorTrigger} onClose={() => setEditor(null)} onSave={save} />}
    {selected && <BottomSheet open title="Ações da tarefa" description={selected.title} returnFocusRef={actionTrigger} dismissible={!pending} onClose={() => setSelected(null)}>
      <div className="tasks-action-menu">{failure && <p className="tasks-error" role="alert">{failure}</p>}
        {selected.deleted_at ? <Button loading={pending} onClick={() => { void runAction(selected, "restore"); }}>Restaurar tarefa</Button> : <>
          <Button disabled={pending} onClick={() => { const task = selected; setSelected(null); editorTrigger.current = actionTrigger.current; setEditor(task); }}>Editar tarefa</Button>
          <Button loading={pending} onClick={() => { void runAction(selected, selected.status === "done" || selected.status === "archived" ? "reopen" : "complete"); }}>{selected.status === "done" || selected.status === "archived" ? "Reabrir tarefa" : "Concluir tarefa"}</Button>
          {selected.status !== "archived" && <Button disabled={pending} onClick={() => { void runAction(selected, "archive"); }}>Arquivar tarefa</Button>}
          <Button variant="danger" disabled={pending} onClick={() => { setRemoving(selected); setSelected(null); setFailure(null); }}>Excluir tarefa</Button>
        </>}
        {selected.origin_capture_id && <Link className="tasks-origin" href={`/capturar?capture=${encodeURIComponent(selected.origin_capture_id)}`}>Abrir captura de origem</Link>}
      </div>
    </BottomSheet>}
    <ConfirmDialog open={Boolean(removing)} title="Mover tarefa para a lixeira?" description={removing ? `“${removing.title}” poderá ser restaurada depois.` : undefined}
      confirmLabel="Mover para a lixeira" loading={pending} error={failure ?? undefined} returnFocusRef={actionTrigger} onClose={() => setRemoving(null)} onConfirm={() => { if (removing) void runAction(removing, "remove"); }} />
  </section>;
}
