'use client';

import { useEffect, useRef, useState } from 'react';
import { Field } from '@/components/ui/field';
import { Icons } from '@/components/ui/icons';
import { useTheme } from '@/components/theme/theme-provider';
import { parseThemePreference } from '@/lib/theme';
import { OnboardingSessionChanged, saveOnboardingTheme } from './http-port';
import { awaitOnboardingOperation, OnboardingLifetime } from './lifetime';
import '@/components/theme/theme-toggle.css';

/** Mesma apresentação do Tema, sem depender do contexto do WorkspaceShell. */
export function OnboardingTheme({ ownerId, onSessionChanged }: { ownerId: string; onSessionChanged: () => void }) {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sending = useRef(false);
  const identity = useRef({}).current;
  const lifetime = useRef(new OnboardingLifetime()).current;
  if (lifetime.bind(ownerId, identity)) sending.current = false;
  useEffect(() => {
    const operation = lifetime.open(ownerId, identity);
    setBusy(false); setMessage(''); sending.current = false;
    return () => lifetime.close(operation);
  }, [ownerId, identity, lifetime]);
  const Icon = preference === 'system' ? Icons.Monitor : resolvedTheme === 'dark' ? Icons.Moon : Icons.Sun;
  const labels = { light: 'Claro', dark: 'Escuro', system: 'Sistema' };
  return <div className="ob-theme">
    <span className="theme-toggle" title={`Tema: ${labels[preference]}`}><Icon className="theme-toggle__icon" aria-hidden="true" />
      <Field as="select" label="Tema" visuallyHiddenLabel wrapperClassName="theme-toggle__field" className="theme-toggle__control" value={preference} disabled={busy}
        onChange={event => {
          const operation = lifetime.captureFor(ownerId, identity);
          if (!operation || operation.ownerId !== ownerId || sending.current) return;
          const next = parseThemePreference(event.target.value); setPreference(next);
          sending.current = true; setBusy(true); setMessage('');
          void awaitOnboardingOperation(lifetime, operation, () => saveOnboardingTheme(ownerId, next, crypto.randomUUID())).catch(error => {
            lifetime.commit(operation, () => {
              if (error instanceof OnboardingSessionChanged) onSessionChanged();
              setMessage('O tema mudou neste aparelho. Confira em Configurações se ele foi salvo na conta.');
            });
          }).finally(() => { lifetime.commit(operation, () => { sending.current = false; setBusy(false); }); });
        }}><option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Sistema</option></Field>
    </span>
    {message && <span role="status" className="ob-theme-message">{message}</span>}
  </div>;
}
