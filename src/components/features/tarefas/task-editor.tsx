"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type RefObject } from "react";
import type { Categoria, Projeto } from "@/core/contracts";
import type { CamposTarefa, EdicaoTarefa, PrioridadeTarefa, StatusTarefa, Tarefa } from "@/core/tarefas";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ConnectedApplicationError, isCommandOutcomeUnknown } from "@/lib/demo/connected-application";
import { editTaskDate, taskDateValue, taskDraft, taskFields, TaskFormError, taskPatch, type TaskDraft, type TaskFieldErrors } from "./task-form";

export const TASK_STATUS: Record<StatusTarefa, string> = { todo: "A fazer", in_progress: "Em andamento", done: "Concluída", archived: "Arquivada" };
export const TASK_PRIORITY: Record<PrioridadeTarefa, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };

interface TaskEditorProps {
  task?: Tarefa;
  categories: readonly Categoria[];
  projects: readonly Projeto[];
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose(): void;
  onSave(fields: CamposTarefa, patch: EdicaoTarefa | null, clientId: string): Promise<void>;
}

export function TaskEditor({ task, categories, projects, returnFocusRef, onClose, onSave }: TaskEditorProps) {
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const submitting = useRef(false);
  const [draft, setDraft] = useState(() => taskDraft(task));
  const [errors, setErrors] = useState<TaskFieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const activeProjects = projects.filter((project) => project.deleted_at === null || project.id === task?.project_id);

  function change<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setFailure(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFailure(null); setErrors({});
    try {
      const fields = taskFields(draft, task);
      const patch = task ? taskPatch(draft, task) : null;
      if (patch && Object.keys(patch).length === 0) { onClose(); return; }
      const fingerprint = JSON.stringify(patch ?? fields);
      if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      submitting.current = true; setPending(true);
      await onSave(fields, patch, request.current.id);
      onClose();
    } catch (error) {
      if (isCommandOutcomeUnknown(error)) setUncertain(true);
      else if (error instanceof ConnectedApplicationError && error.code === "VALIDATION") { setUncertain(false); request.current = null; }
      if (error instanceof TaskFormError) {
        setErrors(error.fields);
        setFailure(error.message);
        requestAnimationFrame(() => document.getElementById(formId)?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      } else setFailure(error instanceof Error ? error.message : "Não foi possível salvar. Seus campos foram preservados; tente novamente.");
    } finally { submitting.current = false; setPending(false); }
  }

  return <Drawer open title={task ? "Editar tarefa" : "Nova tarefa"} onClose={onClose} dismissible={!pending && !uncertain} closeOnBackdrop={false}
    initialFocusRef={titleRef} returnFocusRef={returnFocusRef}
    footer={<><Button onClick={onClose} disabled={pending || uncertain}>Cancelar</Button><Button variant="primary" type="submit" form={formId} loading={pending}>{uncertain ? "Confirmar o mesmo envio" : task ? "Salvar alterações" : "Criar tarefa"}</Button></>}>
    <form id={formId} className="tasks-form" onSubmit={submit} noValidate>
      {failure && <p className="tasks-error" role="alert">{failure}</p>}
      <Field ref={titleRef} label="Título" required maxLength={200} value={draft.title} disabled={pending || uncertain} error={errors.title} onChange={(event) => change("title", event.target.value)} />
      <Field as="textarea" label="Descrição" rows={4} value={draft.description} disabled={pending || uncertain} error={errors.description}
        hint={task?.description && task.description.length > 5000 ? "Texto herdado da captura. Se alterar a descrição, use até 5.000 caracteres." : "Opcional, até 5.000 caracteres."}
        onChange={(event) => change("description", event.target.value)} />
      <div className="tasks-form-grid">
        <Field as="select" label="Categoria" value={draft.category} disabled={pending || uncertain} onChange={(event) => change("category", event.target.value)}>
          <option value="">Sem categoria</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          {draft.category && !categories.some((category) => category.id === draft.category) && <option value={draft.category}>Categoria indisponível</option>}
        </Field>
        <Field as="select" label="Projeto" value={draft.project} disabled={pending || uncertain} onChange={(event) => change("project", event.target.value)}>
          <option value="">Sem projeto</option>
          {activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}{project.deleted_at ? " (excluído)" : ""}</option>)}
          {draft.project && !activeProjects.some((project) => project.id === draft.project) && <option value={draft.project}>Projeto indisponível</option>}
        </Field>
        <Field as="select" label="Estado" value={draft.status} disabled={pending || uncertain} onChange={(event) => change("status", event.target.value as StatusTarefa)}>
          {Object.entries(TASK_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Field>
        <Field as="select" label="Prioridade" value={draft.priority} disabled={pending || uncertain} onChange={(event) => change("priority", event.target.value as PrioridadeTarefa)}>
          {Object.entries(TASK_PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Field>
      </div>
      <fieldset className="tasks-planning"><legend>Planejamento</legend>
        <p className="tasks-note">Datas e horários no fuso de São Paulo.</p>
        <Switch label="Dia inteiro" checked={draft.allDay} disabled={pending || uncertain} onCheckedChange={(checked) => change("allDay", checked)} />
        <div className="tasks-form-grid">
          {([['due', 'Prazo'], ['start', 'Início planejado'], ['end', 'Término planejado']] as const).map(([key, label]) => <Field key={key} label={label} type={draft.allDay ? "date" : "datetime-local"}
            value={taskDateValue(draft[key], draft.allDay)} disabled={pending || uncertain} error={errors[key]} onChange={(event) => change(key, editTaskDate(event.target.value, draft[key]))} />)}
          <Field label="Estimativa em minutos" type="number" min={1} step={1} value={draft.estimate} disabled={pending || uncertain} error={errors.estimate} onChange={(event) => change("estimate", event.target.value)} />
        </div>
      </fieldset>
      <details className="tasks-details"><summary>Organização e origem</summary>
        <Field label="Ordem no quadro" type="number" step="any" value={draft.position} disabled={pending || uncertain} error={errors.position} hint="Opcional. Conservada ao editar os outros campos." onChange={(event) => change("position", event.target.value)} />
        <p className="tasks-note">Origem: entrada manual.</p>
        {task?.origin_capture_id && <Link className="tasks-origin" href={`/capturar?capture=${encodeURIComponent(task.origin_capture_id)}`}>Abrir captura de origem</Link>}
      </details>
    </form>
  </Drawer>;
}
