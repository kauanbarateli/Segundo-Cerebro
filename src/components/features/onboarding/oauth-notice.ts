/** Callback notices explain the return; only the snapshot proves a connection. */
export const ONBOARDING_OAUTH_NOTICES = {
  connected: 'O retorno do Google foi recebido. Confira abaixo o estado das suas contas.',
  'consent-denied': 'A autorização foi cancelada. Suas escolhas foram preservadas; você pode seguir sem conectar.',
  'connection-failed': 'A conexão não foi confirmada. Confira as contas abaixo; você pode tentar novamente ou seguir sem conectar.',
} as const;

export type OnboardingOAuthNotice = keyof typeof ONBOARDING_OAUTH_NOTICES;

export function parseOnboardingOAuthNotice(value: unknown): OnboardingOAuthNotice | null {
  return typeof value === 'string' && Object.hasOwn(ONBOARDING_OAUTH_NOTICES, value) ? value as OnboardingOAuthNotice : null;
}
