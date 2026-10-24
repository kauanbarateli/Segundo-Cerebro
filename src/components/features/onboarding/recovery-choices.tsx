'use client';

import { useState } from 'react';
import type { OnboardingProjectContext, OnboardingRecoveryEntry } from '@/core/onboarding/types';
import { decodeOnboardingReplacement, OnboardingValidationError } from '@/core/onboarding/validation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Icons } from '@/components/ui/icons';
import { FOCUS_LABELS } from './draft-steps';
import { RecordPicker } from './record-picker';
import type { OnboardingController } from './use-onboarding';

export const RECEIPT_LABELS = { profile: 'Perfil', habit: 'Hábito', project: 'Projeto', task: 'Tarefa', notebook: 'Caderno', page: 'Nota', link: 'Vínculo' } as const;

/** Só o servidor prova ausência do recibo e revoga a tentativa antiga. */
export function RecoveryChoices({ state }: { state: OnboardingController }) {
  const snapshot = state.snapshot!;
  if (!snapshot.recovery.length) return null;
  return <section className="ob-recovery" aria-label="Revisar escolhas pendentes">
    <h2>Uma escolha de cada vez.</h2>
    <p className="ob-meta">Você pode revisar ou deixar de criar o que ainda não foi confirmado. Os registros já criados são preservados. Um resultado incerto será conferido pelo servidor antes de qualquer substituição.</p>
    {snapshot.recovery.map(entry => <RecoveryChoice key={entry.intentId} entry={entry} state={state} />)}
  </section>;
}

function RecoveryChoice({ entry, state }: { entry: OnboardingRecoveryEntry; state: OnboardingController }) {
  const [editing, setEditing] = useState(false);
  const [replacement, setReplacement] = useState(entry.choice);
  const [omitDependents, setOmitDependents] = useState(false);
  const [error, setError] = useState('');
  const snapshot = state.snapshot!, round = snapshot.round!;
  const disabled = state.busy || !!state.hold || state.amendPending;
  const projects = round.receipts.filter(item => item.kind === 'project' && item.status !== 'omitted').map((item, index) => {
    const selected = snapshot.recovery.find(entry => entry.intentId === item.intentId)?.choice;
    return { key: item.itemKey, name: selected?.kind === 'project' ? selected.name : `Projeto preparado ${index + 1}` };
  });
  const notebooks = round.receipts.filter(item => item.kind === 'notebook' && item.status !== 'omitted');
  const dependents = entry.dependentIntentIds.map(id => round.receipts.find(item => item.intentId === id)!);
  return <article className="ob-recovery-item">
    <h3>{RECEIPT_LABELS[entry.kind]}</h3>
    <div className="ob-recovery-actions">
      {entry.canReplace && replacement && <Button variant="secondary" disabled={disabled} aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? 'Fechar revisão' : 'Revisar esta escolha'}</Button>}
      {entry.canOmit && <Button variant="ghost" disabled={disabled || (dependents.length > 0 && !omitDependents)} onClick={() => { void state.amend(entry.intentId, { kind: 'omit', dependents: dependents.length ? 'omit_selected' : 'deny', dependentIntentIds: [...entry.dependentIntentIds] }); }}>Deixar de criar {entry.kind === 'link' ? 'este vínculo' : 'este item'}</Button>}
    </div>
    {entry.canOmit && dependents.length > 0 && <Button className="ob-omit-consent" variant="ghost" role="checkbox" aria-checked={omitDependents} disabled={disabled} onClick={() => setOmitDependents(!omitDependents)}><span className="ob-source-check" aria-hidden="true">{omitDependents && <Icons.Check />}</span><span>Também deixar de criar {dependents.length} {dependents.length === 1 ? 'escolha dependente' : 'escolhas dependentes'}: {dependents.map(item => RECEIPT_LABELS[item.kind]).join(', ')}.</span></Button>}
    {!entry.canReplace && !entry.canOmit && <p className="ob-meta">Esta escolha precisa ser conferida antes de poder ser alterada.</p>}
    {editing && replacement && <form className="ob-form ob-recovery-form" onSubmit={event => {
      event.preventDefault(); setError('');
      try { const value = decodeOnboardingReplacement(replacement); void state.amend(entry.intentId, { kind: 'replace', value }); }
      catch (error) { setError(error instanceof OnboardingValidationError ? 'Complete os campos desta revisão antes de enviar.' : 'Não foi possível preparar a revisão.'); }
    }}>
      {replacement.kind === 'profile' && <>
        <Field label="Nome proposto" value={replacement.patch.displayName ?? ''} maxLength={120} disabled={disabled} onChange={event => setReplacement({ ...replacement, patch: { ...replacement.patch, displayName: event.target.value } })} />
        {replacement.patch.displayName !== undefined && <Button variant="ghost" disabled={disabled} onClick={() => setReplacement({ ...replacement, patch: { ...replacement.patch, displayName: undefined } })}>Não alterar o nome</Button>}
        <Field as="select" label="Foco proposto" value={replacement.patch.focus ?? ''} disabled={disabled} onChange={event => setReplacement({ ...replacement, patch: { ...replacement.patch, focus: (event.target.value || undefined) as typeof replacement.patch.focus } })}>
          <option value="">Não alterar o foco</option>{Object.entries(FOCUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Field>
        <p className="ob-meta">Dados consultados da conta: {snapshot.profile.displayName ?? 'sem nome'}; foco {snapshot.profile.focus ? FOCUS_LABELS[snapshot.profile.focus] : 'não definido'}. A revisão não sobrescreve uma versão mais nova sem sua confirmação.</p>
        <div className="ob-recovery-actions"><Button variant="ghost" disabled={disabled} onClick={() => { void state.reload(); }}>Consultar dados atuais</Button><Button variant="secondary" disabled={disabled || replacement.expectedProfileRevision === snapshot.profile.revision} onClick={() => setReplacement({ ...replacement, expectedProfileRevision: snapshot.profile.revision })}>Usar a versão consultada como base</Button></div>
      </>}
      {(replacement.kind === 'habit' || replacement.kind === 'project' || replacement.kind === 'notebook') && <Field label="Nome proposto" value={replacement.name} maxLength={120} disabled={disabled} onChange={event => setReplacement({ ...replacement, name: event.target.value })} />}
      {replacement.kind === 'habit' && <><Field as="select" label="Frequência" value={replacement.cadence} disabled={disabled} onChange={event => setReplacement({ ...replacement, cadence: event.target.value as 'daily' | 'three_per_week' })}><option value="daily">Todos os dias</option><option value="three_per_week">Três vezes por semana</option></Field><Field label="Data de início" type="date" value={replacement.startedOn} disabled={disabled} onChange={event => setReplacement({ ...replacement, startedOn: event.target.value })} /></>}
      {replacement.kind === 'project' && <Field as="select" label="Contexto" value={replacement.context ?? ''} disabled={disabled} onChange={event => setReplacement({ ...replacement, context: (event.target.value || null) as OnboardingProjectContext | null })}><option value="">Sem contexto</option><option value="personal">Pessoal</option><option value="work">Trabalho</option><option value="study">Estudos</option></Field>}
      {(replacement.kind === 'task' || replacement.kind === 'page') && <Field label="Título proposto" value={replacement.title} maxLength={200} disabled={disabled} onChange={event => setReplacement({ ...replacement, title: event.target.value })} />}
      {replacement.kind === 'task' && <><RecordPicker kind="projects" ownerId={snapshot.ownerId} service={state.service} projects={projects} value={replacement.project ?? undefined} disabled={disabled} onChange={project => setReplacement({ ...replacement, project: project ?? null })} /><Field label="Prazo (opcional)" type="date" value={replacement.due.kind === 'day' ? replacement.due.day : ''} disabled={disabled} onChange={event => setReplacement({ ...replacement, due: event.target.value ? { kind: 'day', day: event.target.value } : { kind: 'none' } })} /></>}
      {replacement.kind === 'page' && <>
        <Field as="textarea" label="Texto da nota" value={replacement.text} maxLength={2000} disabled={disabled} onChange={event => setReplacement({ ...replacement, text: event.target.value })} />
        {notebooks.length > 0 && <Field as="select" label="Caderno preparado" value={replacement.notebook.kind === 'prepared' ? replacement.notebook.key : ''} disabled={disabled} onChange={event => { if (event.target.value) setReplacement({ ...replacement, notebook: { kind: 'prepared', key: event.target.value } }); }}><option value="">Escolher entre os preparados</option>{notebooks.map((item, index) => <option key={item.itemKey} value={item.itemKey}>Caderno preparado {index + 1}</option>)}</Field>}
        <RecordPicker kind="notebooks" ownerId={snapshot.ownerId} service={state.service} value={replacement.notebook.kind === 'existing' ? replacement.notebook : undefined} disabled={disabled} onChange={notebook => { if (notebook?.kind === 'existing') setReplacement({ ...replacement, notebook }); }} />
        <p className="ob-meta">Mudar o destino desta nota preserva qualquer caderno já criado. Vínculos com projetos são revisados separadamente.</p>
      </>}
      {replacement.kind === 'link' && <RecordPicker kind="projects" ownerId={snapshot.ownerId} service={state.service} projects={projects} value={replacement.project} disabled={disabled} onChange={project => { if (project) setReplacement({ ...replacement, project }); }} />}
      {error && <p className="ob-error" role="alert">{error}</p>}
      <Button type="submit" variant="primary" disabled={disabled}>Conferir e substituir esta escolha</Button>
      <p className="ob-meta">Esta revisão não cria novos tipos de item nem altera registros que já foram confirmados.</p>
    </form>}
  </article>;
}
