'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { OnboardingDraft, OnboardingFocus, OnboardingProjectContext, OnboardingHabitFrequency } from '@/core/onboarding/types';
import { decodeOnboardingHabitFrequency, onboardingHabitFrequency } from '@/core/onboarding/validation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Icons } from '@/components/ui/icons';
import { RecordPicker } from './record-picker';
import type { OnboardingController } from './use-onboarding';

export const FOCUS_LABELS: Record<OnboardingFocus, string> = { work: 'Trabalho', study: 'Estudos', personal: 'Vida pessoal', mixed: 'Um pouco de tudo' };
const CONTEXT_LABELS: Record<OnboardingProjectContext, string> = { personal: 'Pessoal', work: 'Trabalho', study: 'Estudos' };
export function Options({ title, children, reveal = false, invalid = false }: { title: string; children: ReactNode; reveal?: boolean; invalid?: boolean }) {
  const details = useRef<HTMLDetailsElement>(null);
  // Reveal a saved choice or newly reported error, without controlling native
  // toggling: a person may still close and reopen the same mounted fields.
  useEffect(() => { if ((reveal || invalid) && details.current) details.current.open = true; }, [reveal, invalid]);
  return <details ref={details} className="ob-options"><summary>{title}<Icons.ChevronDown aria-hidden="true" /></summary><div className="ob-options-body">{children}</div></details>;
}

export function ProfileStep({ state, disabled }: { state: OnboardingController; disabled: boolean }) {
  const profile = state.draft!.profile;
  const nameInput = useRef<HTMLInputElement>(null);
  const invalidName = state.validationIssue?.step === 'profile' && state.validationIssue.field === 'displayName';
  useEffect(() => { if (invalidName) nameInput.current?.focus(); }, [invalidName]);
  return <div className="ob-form">
    <Field ref={nameInput} label="Seu nome" autoComplete="given-name" value={profile.displayName ?? ''} placeholder={state.snapshot?.profile.displayName ?? 'Como prefere ser chamado?'} maxLength={120} disabled={disabled}
      error={invalidName ? 'Informe seu nome ou escolha não alterá-lo agora.' : undefined}
      onChange={event => state.change(draft => ({ ...draft, profile: { ...draft.profile, displayName: event.target.value } }))} />
    {profile.displayName !== undefined && <Button variant="ghost" disabled={disabled} onClick={() => state.change(draft => ({ ...draft, profile: { ...draft.profile, displayName: undefined } }))}>Não alterar meu nome agora</Button>}
    <Options title="Definir meu foco"><fieldset disabled={disabled}><legend>O que você quer organizar primeiro?</legend><div className="ob-choice-grid">
      {Object.entries(FOCUS_LABELS).map(([value, label]) => <button className="ob-choice" key={value} type="button" aria-pressed={profile.focus === value}
        onClick={() => state.change(draft => ({ ...draft, profile: { ...draft.profile, focus: profile.focus === value ? undefined : value as OnboardingFocus } }))}>{label}</button>)}
    </div><p className="ob-meta">Essa escolha não altera suas permissões e pode ser editada depois.</p></fieldset></Options>
  </div>;
}

const HABIT_DAYS = [
  { day: 1, label: 'Segunda-feira' }, { day: 2, label: 'Terça-feira' }, { day: 3, label: 'Quarta-feira' },
  { day: 4, label: 'Quinta-feira' }, { day: 5, label: 'Sexta-feira' }, { day: 6, label: 'Sábado' }, { day: 0, label: 'Domingo' },
] as const;
export function habitFrequencyLabel(value: OnboardingHabitFrequency): string {
  if (value.cadence === 'daily') return 'Todos os dias';
  if (value.version === 2 && value.cadence === 'weekdays') return HABIT_DAYS.filter(({ day }) => value.weekdays.includes(day)).map(({ label }) => label).join(', ') || 'Dias a definir';
  const target = value.version === 2 && value.cadence === 'weekly_target' ? value.weeklyTarget : 3;
  return target + ' ' + (target === 1 ? 'vez' : 'vezes') + ' por semana';
}

/** Shared by the draft and recovery. Rendering never upgrades a legacy item. */
export function HabitFrequencyFields({ value, disabled, onChange, validationAttempt = 0 }: {
  value: OnboardingHabitFrequency; disabled: boolean; onChange(value: OnboardingHabitFrequency): void; validationAttempt?: number;
}) {
  const firstDay = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const cadence = value.cadence === 'three_per_week' ? 'weekly_target' : value.cadence;
  const days = value.version === 2 && value.cadence === 'weekdays' ? value.weekdays : [];
  const target = value.version === 2 && value.cadence === 'weekly_target' ? value.weeklyTarget : 3;
  const invalidDays = cadence === 'weekdays' && days.length === 0 && validationAttempt > 0;
  useEffect(() => { if (invalidDays) firstDay.current?.focus(); }, [invalidDays, validationAttempt]);
  return <div className="ob-form-grid">
    <Field as="select" label="Frequência" value={cadence} disabled={disabled} onChange={event => {
      const selected = event.target.value;
      if (selected === 'daily') onChange({ version: 2, cadence: 'daily' });
      else if (selected === 'weekdays') onChange({ version: 2, cadence: 'weekdays', weekdays: [] });
      else if (selected === 'weekly_target') onChange({ version: 2, cadence: 'weekly_target', weeklyTarget: 3 });
    }}><option value="daily">Todos os dias</option><option value="weekdays">Dias específicos</option><option value="weekly_target">Meta semanal</option></Field>
    {cadence === 'weekdays' && <fieldset disabled={disabled} aria-invalid={invalidDays || undefined} aria-describedby={invalidDays ? errorId : undefined}>
      <legend>Em quais dias?</legend>
      <div className="ob-choice-grid">{HABIT_DAYS.map(({ day, label }, index) => <button ref={index === 0 ? firstDay : undefined} key={day}
        type="button" className="ob-choice" aria-pressed={days.includes(day)} aria-describedby={invalidDays ? errorId : undefined}
        onClick={() => onChange({ version: 2, cadence: 'weekdays', weekdays: days.includes(day) ? days.filter(value => value !== day) : [...days, day].sort((a, b) => a - b) })}><span>{label}</span>{days.includes(day) && <Icons.Check aria-hidden="true" />}</button>)}</div>
      {invalidDays && <p id={errorId} className="ob-error" role="alert">Escolha pelo menos um dia da semana.</p>}
    </fieldset>}
    {cadence === 'weekly_target' && <Field as="select" label="Quantas vezes por semana?" value={target} disabled={disabled}
      onChange={event => onChange({ version: 2, cadence: 'weekly_target', weeklyTarget: Number(event.target.value) })}>
      {Array.from({ length: 7 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value} {value === 1 ? 'vez' : 'vezes'}</option>)}
    </Field>}
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
  const [frequencyValidation, setFrequencyValidation] = useState(0);
  const nameInput = useRef<HTMLInputElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const addMoreButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<{ kind: 'open'; key: string | null } | { kind: 'add'; key: string } | { kind: 'remove'; key: string; before: typeof items } | null>(null);
  const invalidItemKey = state.validationIssue?.step === kind && state.validationIssue.field === (kind === 'tasks' ? 'title' : 'name')
    ? items.find(item => !('name' in item ? item.name : item.title).trim())?.key : undefined;
  const invalidFrequencyKey = kind === 'habits' && state.validationIssue?.step === 'habits' && ['cadence', 'weekdays', 'weeklyTarget'].includes(state.validationIssue.field)
    ? draft.habits.find(value => value.version === 2 && value.cadence === 'weekdays' && value.weekdays.length === 0)?.key : undefined;
  useEffect(() => {
    const key = invalidItemKey ?? invalidFrequencyKey;
    if (key) { setAdding(true); setEditingKey(key); }
  }, [invalidItemKey, invalidFrequencyKey]);
  // The compact list must render its editor before focus can reach this choice.
  useEffect(() => {
    if (invalidItemKey && editingKey === invalidItemKey) nameInput.current?.focus();
  }, [invalidItemKey, editingKey]);
  // Consume one explicit successful action after its DOM update. Ordinary
  // renders, autosave and failed actions never request a focus move.
  useEffect(() => {
    const request = pendingFocus.current;
    if (!request) return;
    pendingFocus.current = null;
    const reflected = request.kind === 'open'
      ? adding && editingKey === request.key && nameInput.current !== null && (request.key === null || items.some(item => item.key === request.key))
      : request.kind === 'add'
      ? !adding && editingKey === null && items.some(item => item.key === request.key)
      : items !== request.before && !items.some(item => item.key === request.key);
    if (!reflected) return;
    const target = request.kind === 'open' ? nameInput.current : addMoreButton.current ?? nameInput.current ?? surface.current?.closest('main')?.querySelector<HTMLHeadingElement>('h1');
    target?.focus();
  });
  const item = items.find(item => item.key === editingKey);
  const name = item ? 'name' in item ? item.name : item.title : '';
  const setName = (value: string) => {
    const key = editingKey ?? crypto.randomUUID();
    setEditingKey(key); setError('');
    state.change(current => {
      if (kind === 'habits') {
        const previous = current.habits.find(item => item.key === key);
        const next = previous ? { ...previous, name: value } : { version: 2 as const, key, name: value, cadence: 'daily' as const, startedOn: state.snapshot!.today };
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
  const remove = (key: string): boolean => {
    if (kind === 'projects' && (draft.tasks.some(task => task.project?.kind === 'draft' && task.project.key === key) || (draft.notes?.page?.project?.kind === 'draft' && draft.notes.page.project.key === key))) {
      setError('Desvincule este projeto da tarefa ou nota antes de removê-lo.'); return false;
    }
    pendingFocus.current = { kind: 'remove', key, before: items };
    state.change(current => kind === 'habits' ? { ...current, habits: current.habits.filter(item => item.key !== key) } : kind === 'projects' ? { ...current, projects: current.projects.filter(item => item.key !== key) } : { ...current, tasks: current.tasks.filter(item => item.key !== key) });
    if (editingKey === key) setEditingKey(null);
    return true;
  };
  return <div ref={surface}>
    {items.filter(item => item.key !== editingKey).length > 0 && <ul className="ob-added-list">{items.filter(item => item.key !== editingKey).map(item => <li key={item.key}>
      <Icon aria-hidden="true" /><span><strong>{('name' in item ? item.name : item.title).trim() || `${labels.singular} sem nome`}</strong><small>{('name' in item ? item.name : item.title).trim() ? labels.prepared : 'Rascunho incompleto · complete quando quiser'}</small></span>
      <Button variant="ghost" aria-label={`Editar ${labels.singular}: ${'name' in item ? item.name : item.title}`} disabled={disabled} onClick={() => { pendingFocus.current = { kind: 'open', key: item.key }; setAdding(true); setEditingKey(item.key); }}>Editar</Button>
      <Button variant="ghost" aria-label={`Remover ${labels.singular}: ${'name' in item ? item.name : item.title}`} disabled={disabled} onClick={() => remove(item.key)}><Icons.X aria-hidden="true" /></Button>
    </li>)}</ul>}
    {adding && <form className="ob-form" onSubmit={event => {
      event.preventDefault();
      if (!name.trim()) { setError(`Dê um nome para adicionar ${kind === 'tasks' ? 'a' : 'o'} ${labels.singular}.`); nameInput.current?.focus(); return; }
      if (kind === 'habits' && editingKey) {
        const habit = draft.habits.find(value => value.key === editingKey);
        if (habit) { try { decodeOnboardingHabitFrequency(onboardingHabitFrequency(habit), true); } catch { setFrequencyValidation(value => value + 1); return; } }
      }
      if (editingKey) pendingFocus.current = { kind: 'add', key: editingKey };
      setAdding(false); setEditingKey(null); setError('');
    }}>
      <div className="ob-input-row"><Field ref={nameInput} label={labels.label} value={name} placeholder={labels.placeholder} maxLength={kind === 'tasks' ? 200 : 120} disabled={disabled} onChange={event => setName(event.target.value)} error={error || (invalidItemKey && editingKey === invalidItemKey ? `Dê um nome para ${kind === 'tasks' ? 'esta' : 'este'} ${labels.singular}.` : undefined)} />
        <Button type="submit" disabled={disabled} aria-label={`Adicionar ${labels.singular}`}><Icons.Check aria-hidden="true" /><span className="ob-add-label">Adicionar</span></Button></div>
      {kind === 'habits' && <HabitFrequencyFields value={draft.habits.find(value => value.key === editingKey) ?? { version: 2, cadence: 'daily' }} disabled={disabled || !item}
        validationAttempt={frequencyValidation + (invalidFrequencyKey === editingKey ? 1 : 0)}
        onChange={frequency => { setFrequencyValidation(0); state.change(current => ({ ...current, habits: current.habits.map(value => value.key === editingKey ? { key: value.key, name: value.name, ...frequency, startedOn: value.startedOn } : value) })); }} />}
      {kind !== 'habits' && <Options title={kind === 'projects' ? 'Definir contexto' : 'Vincular e definir prazo'}>
        {kind === 'projects' && <Field as="select" label="Contexto (opcional)" value={draft.projects.find(item => item.key === editingKey)?.context ?? ''} disabled={disabled || !item}
          onChange={event => state.change(current => ({ ...current, projects: current.projects.map(item => item.key === editingKey ? { ...item, context: (event.target.value || undefined) as OnboardingProjectContext | undefined } : item) }))}>
          <option value="">Sem contexto</option>{Object.entries(CONTEXT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Field>}
        {kind === 'tasks' && <TaskOptions state={state} itemKey={editingKey} disabled={disabled || !item} />}
      </Options>}
      {editingKey && <Button variant="ghost" disabled={disabled} onClick={() => { if (remove(editingKey)) { setEditingKey(null); setAdding(items.length <= 1); } }}>{labels.discard}</Button>}
    </form>}
    {!adding && items.length < 5 && <Button ref={addMoreButton} className="ob-add-more" variant="ghost" disabled={disabled} onClick={() => { pendingFocus.current = { kind: 'open', key: null }; setAdding(true); setEditingKey(null); }}>{items.length ? labels.addAnother : `Adicionar ${labels.singular}`}</Button>}
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
  const notebookInput = useRef<HTMLInputElement>(null), titleInput = useRef<HTMLInputElement>(null);
  const invalidField = state.validationIssue?.step === 'notes' ? state.validationIssue.field : null;
  useEffect(() => {
    if (invalidField === 'notebook') notebookInput.current?.focus();
    if (invalidField === 'title') titleInput.current?.focus();
  }, [invalidField]);
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
      <Field ref={notebookInput} label="Nome do caderno" placeholder="Ex.: meu aprendizado" value={notes?.notebook.kind === 'new' ? notes.notebook.name : ''} maxLength={120} disabled={disabled}
        error={invalidField === 'notebook' ? 'Dê um nome ao caderno ou escolha um caderno existente.' : undefined}
        onChange={event => state.change(draft => ({ ...draft, notes: { ...draft.notes, notebook: { kind: 'new', key: draft.notes?.notebook.kind === 'new' ? draft.notes.notebook.key : crypto.randomUUID(), name: event.target.value } } }))} />
      <Options title="Usar um caderno existente"><RecordPicker kind="notebooks" service={state.service} ownerId={state.snapshot!.ownerId} disabled={disabled} value={undefined}
        onChange={value => { if (value?.kind === 'existing') state.change(draft => ({ ...draft, notes: { ...draft.notes, notebook: { kind: 'existing', id: value.id } } })); }} /></Options>
    </>}
    <Options title="Escrever uma primeira nota" reveal={!!notes?.page} invalid={invalidField === 'title'}>
      <Field ref={titleInput} label="Título da nota" value={notes?.page?.title ?? ''} maxLength={200} disabled={disabled} error={invalidField === 'title' ? 'Dê um título para esta nota.' : undefined} onChange={event => patchPage({ title: event.target.value })} />
      <Field as="textarea" label="Sua ideia" value={notes?.page?.text ?? ''} maxLength={2000} rows={4} disabled={disabled} onChange={event => patchPage({ text: event.target.value })} />
      <Options title="Vincular a um projeto" reveal={!!notes?.page?.project} invalid={state.validationStep === 'notes'}>
        <RecordPicker kind="projects" service={state.service} ownerId={state.snapshot!.ownerId} value={notes?.page?.project} projects={state.draft!.projects} disabled={disabled || !notes?.page}
          onChange={project => patchPage({ project })} />
      </Options>
      {notes?.page && <Button variant="ghost" disabled={disabled} onClick={() => state.change(draft => ({ ...draft, notes: draft.notes ? { notebook: draft.notes.notebook } : null }))}>Remover esta nota</Button>}
    </Options>
    {notes && <Button variant="ghost" className="ob-add-more" disabled={disabled} onClick={() => state.change(draft => ({ ...draft, notes: null }))}>Não preparar caderno ou nota agora</Button>}
  </div>;
}
