import { OnboardingPortError, type OnboardingCommand, type OnboardingPort } from '@/core/onboarding/types';
import { decodeOnboardingChoices, decodeOnboardingChoicesQuery, decodeOnboardingSnapshot } from '@/core/onboarding/validation';
import type { ThemePreference } from '@/lib/theme';

export class OnboardingSessionChanged extends OnboardingPortError {
  constructor() { super('FORBIDDEN'); this.name = 'OnboardingSessionChanged'; }
}

/** Cookies só para o mesmo origin. Sem retry automático de escritas. */
async function request(path: string, ownerId: string, body?: unknown): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json', 'X-Expected-User-ID': ownerId, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('RESPONSE');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('RESPONSE');
    const decoder = new TextDecoder();
    let bytes = 0, encoded = '';
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 1_048_576) { await reader.cancel(); throw new Error('RESPONSE'); }
        encoded += decoder.decode(chunk.value, { stream: true });
      }
      encoded += decoder.decode();
    } finally { reader.releaseLock(); }
    const value: unknown = JSON.parse(encoded);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('RESPONSE');
    const envelope = value as Record<string, unknown>;
    if (!response.ok || envelope.ok !== true) {
      if (envelope.code === 'SESSION_CHANGED' || response.status === 401) throw new OnboardingSessionChanged();
      if (envelope.code === 'CONFLICT' || envelope.code === 'FORBIDDEN' || envelope.code === 'UNAVAILABLE' || envelope.code === 'COMMIT_UNKNOWN') throw new OnboardingPortError(envelope.code);
      throw new OnboardingPortError(body === undefined ? 'UNAVAILABLE' : 'COMMIT_UNKNOWN');
    }
    return envelope;
  } catch (error) {
    if (error instanceof OnboardingSessionChanged || error instanceof OnboardingPortError) throw error;
    throw new OnboardingPortError(body === undefined ? 'UNAVAILABLE' : 'COMMIT_UNKNOWN');
  } finally { clearTimeout(timeout); }
}

export function createOnboardingHttpPort(ownerId: string): OnboardingPort {
  async function command(command: OnboardingCommand) {
    const value = await request('/api/onboarding', ownerId, command);
    try { return decodeOnboardingSnapshot(value.result, ownerId); }
    catch { throw new OnboardingPortError('COMMIT_UNKNOWN'); }
  }
  return {
    async load() {
      const value = await request('/api/onboarding', ownerId);
      try { return decodeOnboardingSnapshot(value.result, ownerId); }
      catch { throw new OnboardingPortError('UNAVAILABLE'); }
    },
    async choices(value) {
      const input = decodeOnboardingChoicesQuery(value);
      const params = new URLSearchParams({ choices: input.kind, q: input.query });
      if (input.cursor !== null) params.set('cursor', input.cursor);
      const response = await request(`/api/onboarding?${params}`, ownerId);
      try { return decodeOnboardingChoices(response.result, input.kind); }
      catch { throw new OnboardingPortError('UNAVAILABLE'); }
    },
    start: input => command({ command: 'onboarding.start', input }),
    save: input => command({ command: 'onboarding.save', input }),
    pause: input => command({ command: 'onboarding.pause', input }),
    confirm: input => command({ command: 'onboarding.confirm', input }),
    advance: input => command({ command: 'onboarding.advance', input }),
    amend: input => command({ command: 'onboarding.amend', input }),
  };
}

export async function startOnboardingGoogle(ownerId: string, roundId: string, clientId: string, accountId?: string): Promise<string> {
  const response = await request('/api/calendar/oauth/start', ownerId, {
    client_id: clientId, ...(accountId ? { account_id: accountId } : {}), continuation: { kind: 'onboarding', round_id: roundId },
  });
  if (typeof response.authorization_url !== 'string') throw new OnboardingPortError('COMMIT_UNKNOWN');
  let url: URL;
  try { url = new URL(response.authorization_url); } catch { throw new OnboardingPortError('COMMIT_UNKNOWN'); }
  if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth' || url.username || url.password) throw new OnboardingPortError('COMMIT_UNKNOWN');
  return url.href;
}

export async function selectOnboardingCalendar(ownerId: string, sourceId: string, selected: boolean, clientId: string): Promise<void> {
  await request('/api/calendar', ownerId, { command: 'calendar.select', input: { client_id: clientId, calendar_id: sourceId, selected } });
}

export async function saveOnboardingTheme(ownerId: string, theme: ThemePreference, clientId: string): Promise<void> {
  await request('/api/settings', ownerId, { command: 'settings.preferences.update', input: { client_id: clientId, patch: { theme } } });
}
