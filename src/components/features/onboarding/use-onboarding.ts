'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOnboardingService } from '@/core/onboarding/use-cases';
import { OnboardingPortError, type OnboardingAmendInput, type OnboardingDraft, type OnboardingSnapshot, type OnboardingStep } from '@/core/onboarding/types';
import { decodeOnboardingDraft, OnboardingValidationError, validateOnboardingCompletion } from '@/core/onboarding/validation';
import { createOnboardingHttpPort, OnboardingSessionChanged, selectOnboardingCalendar, startOnboardingGoogle } from './http-port';
import { awaitOnboardingOperation, OnboardingLifetime, StaleOnboardingOperation, type OnboardingOperation } from './lifetime';
import { OnboardingAmendAttempt } from './amendment-attempt';

type Hold = 'conflict' | 'unknown' | 'session' | 'error' | null;
export function useOnboarding(ownerId: string) {
  const router = useRouter();
  const service = useMemo(() => createOnboardingService(createOnboardingHttpPort(ownerId), ownerId), [ownerId]);
  const lifetime = useRef(new OnboardingLifetime()).current;
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locking, setLocking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [hold, setHold] = useState<Hold>(null);
  const [message, setMessage] = useState('');
  const [validationIssue, setValidationIssue] = useState<OnboardingValidationError['issues'][number] | null>(null);
  const validationStep = validationIssue?.step ?? null;
  const amendment = useRef<OnboardingAmendAttempt | null>(null);
  const [amendPending, setAmendPending] = useState(false);
  const refs = useRef({ snapshot, draft, step, dirty, hold, busy: false, locking: false, allowLeave: false, edit: 0, blockedEdit: -1 });
  if (lifetime.bind(ownerId, service)) {
    amendment.current = null;
    refs.current = { snapshot: null, draft: null, step: 'welcome', dirty: false, hold: null, busy: false, locking: false, allowLeave: false, edit: 0, blockedEdit: -1 };
  }
  // React may render a new owner before its effect runs. Never expose old data.
  const ownerMatches = snapshot?.ownerId === ownerId;
  if (ownerMatches) {
    refs.current.snapshot = snapshot; refs.current.draft = draft; refs.current.step = step;
    refs.current.dirty = dirty; refs.current.hold = hold;
  }

  const failure = useCallback((operation: OnboardingOperation, error: unknown) => {
    lifetime.commit(operation, () => {
      if (error instanceof StaleOnboardingOperation) return;
      if (error instanceof OnboardingValidationError) {
        refs.current.blockedEdit = refs.current.edit;
        setValidationIssue(error.issues[0] ?? null);
        setMessage('Complete os campos indicados antes de confirmar. O rascunho foi preservado.');
      } else if (error instanceof OnboardingSessionChanged) {
        refs.current.snapshot = null; refs.current.draft = null; refs.current.dirty = false; refs.current.hold = 'session';
        setSnapshot(null); setDraft(null); setDirty(false); setHold('session');
        setMessage('Sua sessão mudou. Entre novamente antes de continuar.');
      } else if (error instanceof OnboardingPortError && error.code === 'CONFLICT') {
        refs.current.hold = 'conflict'; setHold('conflict');
        setMessage('As escolhas mudaram em outra aba ou aparelho. Sua edição continua nesta tela; escolha quando carregar a versão salva.');
      } else if (error instanceof OnboardingPortError && error.code === 'COMMIT_UNKNOWN') {
        refs.current.hold = 'unknown'; setHold('unknown');
        setMessage('Não conseguimos confirmar o resultado. Confira o estado salvo antes de enviar outra ação.');
      } else {
        refs.current.hold = 'error'; setHold('error');
        setMessage('Este percurso está indisponível agora. Suas escolhas nesta tela foram preservadas.');
      }
    });
  }, [lifetime]);

  const apply = useCallback((operation: OnboardingOperation, value: OnboardingSnapshot, replaceDraft: boolean) => {
    lifetime.assert(operation);
    if (value.ownerId !== operation.ownerId) throw new StaleOnboardingOperation();
    refs.current.snapshot = value; setSnapshot(value);
    if (replaceDraft) {
      refs.current.draft = value.round?.draft ?? null; refs.current.dirty = false;
      setDraft(value.round?.draft ?? null); setDirty(false);
    }
  }, [lifetime]);

  useEffect(() => {
    const operation = lifetime.open(ownerId, service);
    setSnapshot(null); setDraft(null); setStep('welcome'); setDirty(false);
    setHold(null); setMessage(''); setValidationIssue(null); setBusy(false); setLocking(false); setLoading(true); setAmendPending(false);
    void awaitOnboardingOperation(lifetime, operation, () => service.load()).then(value => {
      apply(operation, value, true); setStep(value.round?.step ?? 'welcome');
    }).catch(error => failure(operation, error)).finally(() => {
      lifetime.commit(operation, () => setLoading(false));
    });
    return () => lifetime.close(operation);
  }, [ownerId, service, lifetime, apply, failure]);

  useEffect(() => {
    if (!ownerMatches || (!dirty && !busy && !amendPending)) return;
    const operation = lifetime.capture();
    if (!operation) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (lifetime.current(operation) && !refs.current.allowLeave) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [ownerMatches, dirty, busy, amendPending, lifetime]);

  const change = useCallback((update: (current: OnboardingDraft) => OnboardingDraft) => {
    const operation = lifetime.captureFor(ownerId, service), current = refs.current;
    if (!operation || operation.ownerId !== ownerId || !current.draft || !['active', 'paused'].includes(current.snapshot?.round?.status ?? '') || current.hold || current.locking) return;
    const next = update(current.draft);
    lifetime.commit(operation, () => {
      refs.current.draft = next; refs.current.dirty = true; refs.current.edit++;
      setDraft(next); setDirty(true); setValidationIssue(null); setMessage('');
    });
  }, [lifetime, ownerId, service]);

  const save = useCallback(async (operation: OnboardingOperation, targetStep: OnboardingStep, force = false) => {
    lifetime.assert(operation);
    const state = refs.current, round = state.snapshot?.round;
    if (!round || !state.draft || !['active', 'paused'].includes(round.status)) return state.snapshot;
    if (!state.dirty && !force) return state.snapshot;
    const canonical = decodeOnboardingDraft(state.draft), version = state.edit;
    const value = await awaitOnboardingOperation(lifetime, operation, () => service.save({ roundId: round.id, expectedRevision: round.revision, clientId: crypto.randomUUID(), draft: canonical, step: targetStep }));
    apply(operation, value, refs.current.edit === version);
    if (refs.current.edit === version) setMessage('Rascunho salvo. Você pode completar as escolhas depois.');
    return value;
  }, [service, lifetime, apply]);

  const act = useCallback(async (action: (operation: OnboardingOperation) => Promise<void>, lockEditing = true) => {
    const operation = lifetime.captureFor(ownerId, service);
    if (!operation || operation.ownerId !== ownerId || refs.current.busy || refs.current.hold) return;
    refs.current.busy = true; refs.current.locking = lockEditing;
    setBusy(true); setLocking(lockEditing); setValidationIssue(null);
    try { await action(operation); }
    catch (error) { failure(operation, error); }
    finally {
      lifetime.commit(operation, () => {
        refs.current.busy = false; refs.current.locking = false; setBusy(false); setLocking(false);
      });
    }
  }, [failure, lifetime, ownerId, service]);

  useEffect(() => {
    if (!ownerMatches || !dirty || busy || hold || refs.current.blockedEdit === refs.current.edit) return;
    const operation = lifetime.capture();
    if (!operation) return;
    const timeout = setTimeout(() => {
      if (lifetime.current(operation)) void act(async current => { await save(current, refs.current.step); }, false);
    }, 800);
    return () => clearTimeout(timeout);
  }, [ownerMatches, draft, dirty, busy, hold, act, save, lifetime]);

  const navigate = (target: OnboardingStep) => act(async operation => {
    await save(operation, target, true); lifetime.assert(operation);
    setStep(target); refs.current.step = target; setValidationIssue(null);
  });
  const review = (target: OnboardingStep) => {
    const operation = lifetime.captureFor(ownerId, service);
    if (operation?.ownerId === ownerId && !refs.current.busy) lifetime.commit(operation, () => { setStep(target); refs.current.step = target; });
  };
  const start = () => act(async operation => {
    const value = await awaitOnboardingOperation(lifetime, operation, () => service.start({ clientId: crypto.randomUUID() }));
    apply(operation, value, true); setStep(value.round?.step === 'welcome' ? 'profile' : value.round?.step ?? 'welcome'); setMessage('');
  });
  const exit = () => act(async operation => {
    // The explicit deferral also acknowledges the offer before a round exists.
    // Without this empty round, Home would offer it again immediately. Starting
    // and pausing only save the draft; no module choice is confirmed here.
    if (!refs.current.snapshot?.round && refs.current.snapshot?.eligibility.canStart) {
      const value = await awaitOnboardingOperation(lifetime, operation, () => service.start({ clientId: crypto.randomUUID() }));
      apply(operation, value, true);
    }
    await save(operation, refs.current.step); lifetime.assert(operation);
    const round = refs.current.snapshot?.round;
    if (round && ['active', 'paused'].includes(round.status)) {
      const value = await awaitOnboardingOperation(lifetime, operation, () => service.pause({ roundId: round.id, expectedRevision: round.revision, clientId: crypto.randomUUID() }));
      apply(operation, value, true);
    }
    lifetime.commit(operation, () => router.push('/'));
  });
  const advance = async (operation: OnboardingOperation, initial: OnboardingSnapshot) => {
    let current = initial;
    for (let index = 0; index < 24 && current.round?.status === 'executing'; index++) {
      const roundId = current.round.id;
      current = await awaitOnboardingOperation(lifetime, operation, () => service.advance({ roundId, clientId: crypto.randomUUID() }));
      apply(operation, current, true);
    }
    lifetime.commit(operation, () => setMessage(current.round?.status === 'complete' ? 'Seu espaço está pronto.' : 'Algumas escolhas ainda precisam de confirmação. Veja o resultado antes de continuar.'));
  };
  const finish = () => act(async operation => {
    await save(operation, 'summary'); lifetime.assert(operation);
    const round = refs.current.snapshot?.round;
    if (!round || !round.draft || !['active', 'paused'].includes(round.status)) return;
    validateOnboardingCompletion(round.draft);
    const value = await awaitOnboardingOperation(lifetime, operation, () => service.confirm({ roundId: round.id, expectedRevision: round.revision, clientId: crypto.randomUUID() }));
    apply(operation, value, true); setStep('summary'); await advance(operation, value);
  });
  const reload = async () => {
    const operation = lifetime.captureFor(ownerId, service);
    if (!operation || operation.ownerId !== ownerId || refs.current.busy) return;
    refs.current.busy = true; refs.current.locking = true; setBusy(true); setLocking(true);
    try {
      const value = await awaitOnboardingOperation(lifetime, operation, () => service.load());
      apply(operation, value, true); setStep(value.round?.step ?? 'welcome');
      const unresolvedAmendment = amendment.current !== null;
      refs.current.hold = unresolvedAmendment ? 'unknown' : null;
      setHold(unresolvedAmendment ? 'unknown' : null); setMessage(unresolvedAmendment ? 'O estado salvo foi consultado. A resposta da alteração anterior ainda precisa ser confirmada com a mesma tentativa.' : 'Versão salva carregada.'); setValidationIssue(null);
    } catch (error) { failure(operation, error); }
    finally { lifetime.commit(operation, () => { refs.current.busy = false; refs.current.locking = false; setBusy(false); setLocking(false); setLoading(false); }); }
  };
  const resume = () => act(async operation => {
    const value = await awaitOnboardingOperation(lifetime, operation, () => service.load()); apply(operation, value, true);
    if (value.round?.status === 'partial' || value.round?.status === 'executing') {
      const roundId = value.round.id;
      const next = await awaitOnboardingOperation(lifetime, operation, () => service.advance({ roundId, clientId: crypto.randomUUID() }));
      apply(operation, next, true); await advance(operation, next);
    }
  });
  const sendAmendment = async (operation: OnboardingOperation, attempt: OnboardingAmendAttempt) => {
    try {
      const value = await awaitOnboardingOperation(lifetime, operation, () => attempt.submit(input => {
        lifetime.assert(operation); return service.amend(input);
      }));
      apply(operation, value, true);
      lifetime.commit(operation, () => {
        amendment.current = null; setAmendPending(false); refs.current.hold = null; setHold(null);
        setMessage('A alteração foi conferida. Revise os resultados antes de continuar.');
      });
    } catch (error) {
      lifetime.commit(operation, () => {
        if (!attempt.uncertain || error instanceof OnboardingSessionChanged) { amendment.current = null; setAmendPending(false); }
      });
      throw error;
    }
  };
  const amend = (intentId: string, change: OnboardingAmendInput['change']) => act(async operation => {
    const round = refs.current.snapshot?.round;
    if (!round || !['executing', 'partial'].includes(round.status) || amendment.current) return;
    const attempt = new OnboardingAmendAttempt({ roundId: round.id, expectedRevision: round.revision, clientId: crypto.randomUUID(), intentId, change });
    amendment.current = attempt; setAmendPending(true);
    await sendAmendment(operation, attempt);
  });
  const retryAmend = async () => {
    const operation = lifetime.captureFor(ownerId, service), attempt = amendment.current;
    if (!operation || !attempt || refs.current.busy || refs.current.hold === 'session') return;
    refs.current.busy = true; refs.current.locking = true; setBusy(true); setLocking(true);
    try { await sendAmendment(operation, attempt); }
    catch (error) { failure(operation, error); }
    finally { lifetime.commit(operation, () => { refs.current.busy = false; refs.current.locking = false; setBusy(false); setLocking(false); }); }
  };
  const connectGoogle = (accountId?: string) => act(async operation => {
    await save(operation, 'calendar', true); lifetime.assert(operation);
    const round = refs.current.snapshot?.round;
    if (!round || !['active', 'paused'].includes(round.status)) return;
    const url = await awaitOnboardingOperation(lifetime, operation, () => startOnboardingGoogle(ownerId, round.id, crypto.randomUUID(), accountId));
    lifetime.commit(operation, () => {
      refs.current.allowLeave = true;
      try { window.location.assign(url); } catch (error) { refs.current.allowLeave = false; throw error; }
    });
  });
  const selectSource = (sourceId: string, selected: boolean) => act(async operation => {
    await save(operation, refs.current.step); lifetime.assert(operation);
    await awaitOnboardingOperation(lifetime, operation, () => selectOnboardingCalendar(ownerId, sourceId, selected, crypto.randomUUID()));
    const value = await awaitOnboardingOperation(lifetime, operation, () => service.load());
    apply(operation, value, true); setMessage('Seleção de calendário atualizada.');
  });
  const sessionChanged = () => {
    const operation = lifetime.captureFor(ownerId, service);
    if (operation?.ownerId === ownerId) failure(operation, new OnboardingSessionChanged());
  };
  const safeOwner = !snapshot || ownerMatches;
  return {
    snapshot: ownerMatches ? snapshot : null, draft: ownerMatches ? draft : null,
    step: ownerMatches ? step : 'welcome' as OnboardingStep,
    loading: safeOwner ? loading : true, busy: safeOwner ? busy : false, locking: safeOwner ? locking : true,
    dirty: ownerMatches && dirty, hold: safeOwner ? hold : null, message: safeOwner ? message : '', validationStep: safeOwner ? validationStep : null, validationIssue: ownerMatches ? validationIssue : null,
    amendPending: ownerMatches && amendPending,
    service, change, navigate, review, start, exit, finish, reload, resume, amend, retryAmend, connectGoogle, selectSource, sessionChanged,
  };
}

export type OnboardingController = ReturnType<typeof useOnboarding>;
