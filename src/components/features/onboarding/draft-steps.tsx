'use client';

import { useState, type ReactNode } from 'react';
import type { OnboardingDraft, OnboardingFocus, OnboardingProjectContext } from '@/core/onboarding/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Icons } from '@/components/ui/icons';
import { RecordPicker } from './record-picker';
import type { OnboardingController } from './use-onboarding';

export const FOCUS_LABELS: Record<OnboardingFocus, string> = { work: 'Trabalho', study: 'Estudos', personal: 'Vida pessoal', mixed: 'Um pouco de tudo' };
const CONTEXT_LABELS: Record<OnboardingProjectContext, string> = { personal: 'Pessoal', work: 'Trabalho', study: 'Estudos' };
export function Options({ title, children }: { title: string; children: ReactNode }) {
  return <details className="ob-options"><summary>{title}<Icons.ChevronDown aria-hidden="true" /></summary><div className="ob-options-body">{children}</div></details>;
}

export function ProfileStep({ state, disabled }: { state: OnboardingController; disabled: boolean }) {
  const profile = state.draft!.profile;
  return <div className="ob-form">
    <Field label="Seu nome" autoComplete="given-name" value={profile.displayName ?? ''} placeholder={state.snapshot?.profile.displayName ?? 'Como prefere ser chamado?'} maxLength={120} disabled={disabled}
      onChange={event => state.change(draft => ({ ...draft, profile: { ...draft.profile, displayName: event.target.value } }))} />
    {profile.displayName !== undefined && <Button variant="ghost" disabled={disabled} onClick={() => state.change(draft => ({ ...draft, profile: { ...draft.profile, displayName: undefined } }))}>Não alterar meu nome agora</Button>}
    <Options title="Definir meu foco"><fieldset disabled={disabled}><legend>O que você quer organizar primeiro?</legend><div className="ob-choice-grid">
      {Object.entries(FOCUS_LABELS).map(([value, label]) => <button className="ob-choice" key={value} type="button" aria-pressed={profile.focus === value}
        onClick={() => state.change(draft => ({ ...draft, profile: { ...draft.profile, focus: profile.focus === value ? undefined : value as OnboardingFocus } }))}>{label}</button>)}
    </div><p className="ob-meta">Essa escolha não altera suas permissões e pode ser editada depois.</p></fieldset></Options>
  </div>;
}

type CollectionKind = 'habits' | 'projects' | 'tasks';
const COLLECTION_LABELS = {
  habits: { singular: 'hábito', label: 'Seu primeiro hábito', placeholder: 'Ex.: ler por 15 minutos', icon: Icons.Repeat, discard: 'Descartar este hábito', addAnother: 'Adicionar outro hábito', prepared: 'Preparado neste percurso' },
  projects: { singular: 'projeto', label: 'Nome do projeto', placeholder: 'Ex.: aprender fotografia', icon: Icons.Folder, discard: 'Descartar este projeto', addAnother: 'Adicionar outro projeto', prepared: 'Preparado neste percurso' },
  tasks: { singular: 'tarefa', label: 'Sua próxima tarefa', placeholder: 'Ex.: separar o material de estudo', icon: Icons.Tasks, discard: 'Descartar esta tarefa', addAnother: 'Adicionar outra tarefa', prepared: 'Preparada neste percurso' },
};

/** A key é criada na primeira edição e permanece ao salvar, recarregar e concluir. */
export function CollectionStep({ kind, state, disabled }: { kind: CollectionKind; state: OnboardingController; disabled: boolean }) {
  const draft = state.draft!, items = draft[kind], labels = COLLECTION_LABELS[kind], Icon = labels.icon;
  const [adding, setAdding] = useState(items.length === 0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const item = items.find(item => item.key === editingKey);
  const name = item ? 'name' in item ? item.name : item.title : '';
  const setName = (value: string) => {
    const key = editingKey ?? crypto.randomUUID();
    setEditingKey(key); setError('');
    state.change(current => {
      if (kind === 'habits') {
        const previous = current.habits.find(item => item.key === key);
        const next = { key, name: value, cadence: previous?.cadence ?? 'daily' as const, startedOn: previous?.startedOn ?? state.snapshot!.today };
        return { ...current, habits: previous ? current.habits.map(item => item.key === key ? next : item) : [...current.habits, next] };
      }
      if (kind === 'projects') {
        const previous = current.projects.find(item => item.key === key);
        const next = { ...previous, key, name: value };
        return { ...current, projects: previous ? current.projects.map(item => item.key === key ? next : item) : [...current.projects, next] };
      }
      const previous = current.tasks.find(item => item.key === key);
      const next = { ...previous, key, title: value, due: previous?.due ?? { kind: 'none' as const } };
      return { ...current, tasks: previous ? current.tasks.map(item => item.key === key ? next : item) : [...current.tasks, next] };
    });
  };
  const remove = (key: string) => {
    if (kind === 'projects' && (draft.tasks.some(task => task.project?.kind === 'draft' && task.project.key === key) || (draft.notes?.page?.project?.kind === 'draft' && draft.notes.page.project.key === key))) {
      setError('Desvincule este projeto da tarefa ou nota antes de removê-lo.'); return;
    }
    state.change(current => kind === 'habits' ? { ...current, habits: current.habits.filter(item => item.key !== key) } : kind === 'projects' ? { ...current, projects: current.projects.filter(item => item.key !== key) } : { ...current, tasks: current.tasks.filter(item => item.key !== key) });
    if (editingKey === key) setEditingKey(null);
  };
  return <div>
    {items.filter(item => item.key !== editingKey).length > 0 && <ul className="ob-added-list">{items.filter(item => item.key !== editingKey).map(item => <li key={item.key}>
      <Icon aria-hidden="true" /><span><strong>{('name' in item ? item.name : item.title).trim() || `${labels.singular} sem nome`}</strong><small>{('name' in item ? item.name : item.title).trim() ? labels.prepared : 'Rascunho incompleto · complete quando quiser'}</small></span>
      <Button variant="ghost" aria-label={`Editar ${labels.singular}: ${'name' in item ? item.name : item.title}`} disabled={disabled} onClick={() => { setAdding(true); setEditingKey(item.key); }}>Editar</Button>
      <Button variant="ghost" aria-label={`Remover ${labels.singular}: ${'name' in item ? item.name : item.title}`} disabled={disabled} onClick={() => remove(item.key)}><Icons.X aria-hidden="true" /></Button>
    </li>)}</ul>}
    {adding && <form className="ob-form" onSubmit={event => {
      event.preventDefault();
      if (!name.trim()) { setError(`Dê um nome para adicionar ${kind === 'tasks' ? 'a' : 'o'} ${labels.singular}.`); return; }
      setAdding(false); setEditingKey(null); setError('');
    }}>
      <div className="ob-input-row"><Field label={labels.label} value={name} placeholder={labels.placeholder} maxLength={kind === 'tasks' ? 200 : 120} disabled={disabled} onChange={event => setName(event.target.value)} error={error || undefined} />
        <Button type="submit" disabled={disabled} aria-label={`Adicionar ${labels.singular}`}><Icons.Check aria-hidden="true" /><span className="ob-add-label">Adicionar</span></Button></div>
      <Options title={kind === 'habits' ? 'Ajustar frequência' : kind === 'projects' ? 'Definir contexto' : 'Vincular e definir prazo'}>
        {kind === 'habits' && <Field as="select" label="Frequência" value={draft.habits.find(item => item.key === editingKey)?.cadence ?? 'daily'} disabled={disabled || !item}
          onChange={event => state.change(current => ({ ...current, habits: current.habits.map(item => item.key === editingKey ? { ...item, cadence: event.target.value as 'daily' | 'three_per_week' } : item) }))}>
          <option value="daily">Todos os dias</option><option value="three_per_week">Três vezes por semana</option>
        </Field>}
        {kind === 'projects' && <Field as="select" label="Contexto (opcional)" value={draft.projects.find(item => item.key === editingKey)?.context ?? ''} disabled={disabled || !item}
          onChange={event => state.change(current => ({ ...current, projects: current.projects.map(item => item.key === editingKey ? { ...item, context: (event.target.value || undefined) as OnboardingProjectContext | undefined } : item) }))}>
          <option value="">Sem contexto</option>{Object.entries(CONTEXT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Field>}
        {kind === 'tasks' && <TaskOptions state={state} itemKey={editingKey} disabled={disabled || !item} />}
      </Options>
      {editingKey && <Button variant="ghost" disabled={disabled} onClick={() => { remove(editingKey); setEditingKey(null); setAdding(items.length <= 1); }}>{labels.discard}</Button>}
    </form>}
    {!adding && items.length < 5 && <Button className="ob-add-more" variant="ghost" disabled={disabled} onClick={() => { setAdding(true); setEditingKey(null); }}>{items.length ? labels.addAnother : `Adicionar ${labels.singular}`}</Button>}
    {items.length >= 5 && <p className="ob-meta">Você pode criar mais no módulo depois.</p>}
    {!adding && error && <p role="alert" className="ob-error">{error}</p>}
  </div>;
}

function TaskOptions({ state, itemKey, disabled }: { state: OnboardingController; itemKey: string | null; disabled: boolean }) {
  const item = state.draft!.tasks.find(item => item.key === itemKey);
  return <div className="ob-form-grid">
    <RecordPicker kind="projects" service={state.service} ownerId={state.snapshot!.ownerId} value={item?.project} projects={state.draft!.projects} disabled={disabled}
      onChange={project => state.change(draft => ({ ...draft, tasks: draft.tasks.map(item => item.key === itemKey ? { ...item, project } : item) }))} />
    <Field as="select" label="Quando?" value={item?.due.kind === 'day' ? 'day' : 'none'} disabled={disabled}
      onChange={event => state.change(draft => ({ ...draft, tasks: draft.tasks.map(item => item.key === itemKey ? { ...item, due: event.target.value === 'day' ? { kind: 'day', day: state.snapshot!.today } : { kind: 'none' } } : item) }))}>
      <option value="none">Sem prazo</option><option value="day">{item?.due.kind === 'day' && item.due.day !== state.snapshot!.today ? `Em ${item.due.day.split('-').reverse().join('/')}` : 'Hoje'}</option>
    </Field>
  </div>;
}

export function NotesStep({ state, disabled }: { state: OnboardingController; disabled: boolean }) {
  const notes = state.draft!.notes;
  const patchPage = (patch: Partial<Pick<NonNullable<NonNullable<OnboardingDraft['notes']>['page']>, 'title' | 'text' | 'project'>>) => state.change(draft => {
    const previous = draft.notes;
    const notebook = previous?.notebook ?? { kind: 'new' as const, key: crypto.randomUUID(), name: '' };
    return { ...draft, notes: { notebook, page: { key: previous?.page?.key ?? crypto.randomUUID(), title: previous?.page?.title ?? '', text: previous?.page?.text ?? '', ...(previous?.page?.project ? { project: previous.page.project } : {}), ...patch } } };
  });
  return <div className="ob-form">
    {notes?.notebook.kind === 'existing' ? <>
      <RecordPicker kind="notebooks" service={state.service} ownerId={state.snapshot!.ownerId} disabled={disabled} value={{ kind: 'existing', id: notes.notebook.id }}
        onChange={value => state.change(draft => ({ ...draft, notes: { ...draft.notes, notebook: value?.kind === 'existing' ? { kind: 'existing', id: value.id } : { kind: 'new', key: crypto.randomUUID(), name: '' } } }))} />
      <Button variant="ghost" disabled={disabled} onClick={() => state.change(draft => ({ ...draft, notes: { ...draft.notes, notebook: { kind: 'new', key: crypto.randomUUID(), name: '' } } }))}>Preparar um novo caderno</Button>
    </> : <>
      <Field label="Nome do caderno" placeholder="Ex.: meu aprendizado" value={notes?.notebook.kind === 'new' ? notes.notebook.name : ''} maxLength={120} disabled={disabled}
        onChange={event => state.change(draft => ({ ...draft, notes: { ...draft.notes, notebook: { kind: 'new', key: draft.notes?.notebook.kind === 'new' ? draft.notes.notebook.key : crypto.randomUUID(), name: event.target.value } } }))} />
      <Options title="Usar um caderno existente"><RecordPicker kind="notebooks" service={state.service} ownerId={state.snapshot!.ownerId} disabled={disabled} value={undefined}
        onChange={value => { if (value?.kind === 'existing') state.change(draft => ({ ...draft, notes: { ...draft.notes, notebook: { kind: 'existing', id: value.id } } })); }} /></Options>
    </>}
    <Options title="Escrever uma primeira nota">
      <Field label="Título da nota" value={notes?.page?.title ?? ''} maxLength={200} disabled={disabled} onChange={event => patchPage({ title: event.target.value })} />
      <Field as="textarea" label="Sua ideia" value={notes?.page?.text ?? ''} maxLength={2000} rows={4} disabled={disabled} onChange={event => patchPage({ text: event.target.value })} />
      <RecordPicker kind="projects" service={state.service} ownerId={state.snapshot!.ownerId} value={notes?.page?.project} projects={state.draft!.projects} disabled={disabled || !notes?.page}
        onChange={project => patchPage({ project })} />
      {notes?.page && <Button variant="ghost" disabled={disabled} onClick={() => state.change(draft => ({ ...draft, notes: draft.notes ? { notebook: draft.notes.notebook } : null }))}>Remover esta nota</Button>}
    </Options>
    {notes && <Button variant="ghost" className="ob-add-more" disabled={disabled} onClick={() => state.change(draft => ({ ...draft, notes: null }))}>Não preparar caderno ou nota agora</Button>}
  </div>;
}
