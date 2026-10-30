'use client';

import { useEffect, useRef, useState } from 'react';
import type { OnboardingChoices, OnboardingProjectRef } from '@/core/onboarding/types';
import type { OnboardingService } from '@/core/onboarding/use-cases';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { awaitOnboardingOperation, OnboardingLifetime, type OnboardingOperation } from './lifetime';

export function RecordPicker({ kind, service, ownerId, value, onChange, disabled, projects = [] }: {
  kind: 'projects' | 'notebooks'; service: OnboardingService; ownerId: string; value: OnboardingProjectRef | undefined;
  onChange: (value: OnboardingProjectRef | undefined) => void; disabled?: boolean;
  projects?: { key: string; name: string }[];
}) {
  const [search, setSearch] = useState({ ownerId, query: '' });
  const query = search.ownerId === ownerId ? search.query : '';
  const [result, setResult] = useState<OnboardingChoices | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const lifetime = useRef(new OnboardingLifetime()).current;
  const resultOperation = useRef<OnboardingOperation | null>(null);
  lifetime.bind(ownerId, service);
  const visibleResult = result && resultOperation.current && lifetime.current(resultOperation.current) ? result : null;
  useEffect(() => {
    const operation = lifetime.open(ownerId, service);
    setLoading(true); setFailed(false); setResult(null);
    const timeout = setTimeout(() => {
      void awaitOnboardingOperation(lifetime, operation, () => service.choices({ kind, query, cursor: null })).then(value => {
        lifetime.commit(operation, () => { resultOperation.current = operation; setResult(value); });
      }).catch(() => { lifetime.commit(operation, () => { setResult(null); setFailed(true); }); })
        .finally(() => { lifetime.commit(operation, () => setLoading(false)); });
    }, 250);
    return () => { clearTimeout(timeout); lifetime.close(operation); };
  }, [kind, query, service, ownerId, lifetime]);

  const loadMore = async () => {
    const operation = lifetime.captureFor(ownerId, service);
    if (!operation || operation.ownerId !== ownerId || !visibleResult?.nextCursor || loading) return;
    const cursor = visibleResult.nextCursor;
    setLoading(true); setFailed(false);
    try {
      const next = await awaitOnboardingOperation(lifetime, operation, () => service.choices({ kind, query, cursor }));
      lifetime.commit(operation, () => { resultOperation.current = operation; setResult({ ...next, items: [...visibleResult.items, ...next.items.filter(item => !visibleResult.items.some(previous => previous.id === item.id))] }); });
    } catch { lifetime.commit(operation, () => setFailed(true)); }
    finally { lifetime.commit(operation, () => setLoading(false)); }
  };
  const currentValue = value ? value.kind === 'draft' ? `draft:${value.key}` : `existing:${value.id}` : '';
  const hasCurrent = value?.kind === 'existing' && visibleResult?.items.some(item => item.id === value.id);
  const label = kind === 'projects' ? 'Projeto' : 'Caderno existente';
  return <div className="ob-record-picker">
    <Field label={`Buscar ${kind === 'projects' ? 'projetos existentes' : 'cadernos existentes'}`} type="search" value={query} maxLength={120} disabled={disabled} onChange={event => setSearch({ ownerId, query: event.target.value })} />
    <Field as="select" label={label} value={currentValue} disabled={disabled} aria-busy={loading || undefined}
      onChange={event => {
        const selected = event.target.value;
        onChange(selected.startsWith('draft:') ? { kind: 'draft', key: selected.slice(6) } : selected.startsWith('existing:') ? { kind: 'existing', id: selected.slice(9) } : undefined);
      }}>
      <option value="">{kind === 'projects' ? 'Sem projeto' : 'Escolha um caderno'}</option>
      {projects.length > 0 && <optgroup label="Preparados neste percurso">{projects.map(project => <option key={project.key} value={`draft:${project.key}`}>{project.name || 'Projeto sem nome'}</option>)}</optgroup>}
      {value?.kind === 'existing' && !hasCurrent && <option value={currentValue}>Seleção atual</option>}
      {visibleResult && visibleResult.items.length > 0 && <optgroup label="Já existentes">{visibleResult.items.map(item => <option key={item.id} value={`existing:${item.id}`}>{item.name}</option>)}</optgroup>}
    </Field>
    <p className="ob-meta" role="status">{loading ? 'Carregando opções…' : failed ? 'Não foi possível consultar os registros existentes.' : visibleResult?.items.length === 0 ? 'Nenhum registro encontrado nesta busca.' : ''}</p>
    {visibleResult?.nextCursor && <Button variant="ghost" size="sm" disabled={disabled || loading} onClick={() => { void loadMore(); }}>Carregar mais</Button>}
  </div>;
}
