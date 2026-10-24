import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOnboardingHttpPort, OnboardingSessionChanged, saveOnboardingTheme, selectOnboardingCalendar, startOnboardingGoogle } from '../src/components/features/onboarding/http-port';
import type { OnboardingSnapshot } from '../src/core/onboarding/types';

const ownerId = '10000000-0000-4000-8000-000000000001';
const clientId = '20000000-0000-4000-8000-000000000001';
const roundId = '30000000-0000-4000-8000-000000000001';
const value: OnboardingSnapshot = {
  schemaVersion: 1, ownerId, today: '2026-10-23', timeZone: 'America/Sao_Paulo',
  eligibility: { kind: 'existing_opt_in', canStart: true, offerPending: false, reason: null },
  capabilities: { configuracoes: true, calendario: true, habitos: true, projetos: true, tarefas: true, conhecimento: true, financeiro: true, cofre: true },
  profile: { displayName: null, focus: null, revision: 'opaque' }, round: null,
  calendar: { status: 'not_configured', canConnect: false, accounts: [], sources: [] }, recovery: [],
};
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); }
afterEach(() => vi.unstubAllGlobals());

describe('canal HTTP de onboarding sem SDK no navegador', () => {
  it('usa cookies somente do mesmo origin e dono esperado em leituras e escritas', async () => {
    const fetcher = vi.fn(async () => json({ ok: true, result: value })); vi.stubGlobal('fetch', fetcher);
    const port = createOnboardingHttpPort(ownerId); await port.load(); await port.start({ clientId });
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0]?.[0]).toBe('/api/onboarding');
    expect(calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { 'X-Expected-User-ID': ownerId } });
    expect(calls[1]?.[1]).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Expected-User-ID': ownerId }, body: JSON.stringify({ command: 'onboarding.start', input: { clientId } }) });
  });
  it('não repete uma escrita cuja resposta foi perdida', async () => {
    const fetcher = vi.fn(async () => { throw new TypeError('PRIVATE_CANARY'); }); vi.stubGlobal('fetch', fetcher);
    await expect(createOnboardingHttpPort(ownerId).confirm({ roundId, expectedRevision: '1', clientId })).rejects.toMatchObject({ code: 'COMMIT_UNKNOWN' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('transporta emenda com identidade/CAS sem adicionar versão interna ou avançar intenções', async () => {
    const fetcher = vi.fn(async () => json({ok:true,result:value})); vi.stubGlobal('fetch', fetcher);
    const input = {roundId,expectedRevision:'9007199254740993',clientId,intentId:ownerId,change:{kind:'omit' as const,dependents:'deny' as const,dependentIntentIds:[]}};
    await createOnboardingHttpPort(ownerId).amend(input);
    const call = fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(JSON.parse(call[1].body as string)).toEqual({command:'onboarding.amend',input}); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('não aceita HTML, corpo excessivo, outro dono ou sucesso com campos privados', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); const port = createOnboardingHttpPort(ownerId);
    for (const response of [new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }), json({ ok: true, result: { ...value, ownerId: clientId } }), json({ ok: true, result: { ...value, secret: 'PRIVATE_CANARY' } }), new Response(' '.repeat(1_048_577), { headers: { 'content-type': 'application/json' } })]) {
      fetcher.mockResolvedValueOnce(response); await expect(port.load()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    }
  });
  it('sinaliza troca de sessão e conflito sem expor a mensagem do servidor', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); const port = createOnboardingHttpPort(ownerId);
    fetcher.mockResolvedValueOnce(json({ ok: false, code: 'SESSION_CHANGED', message: 'PRIVATE_CANARY' }, 409));
    await expect(port.load()).rejects.toBeInstanceOf(OnboardingSessionChanged);
    fetcher.mockResolvedValueOnce(json({ ok: false, code: 'CONFLICT', message: 'PRIVATE_CANARY' }, 409));
    await expect(port.pause({ roundId, expectedRevision: '1', clientId })).rejects.toMatchObject({ code: 'CONFLICT', message: 'CONFLICT' });
  });
  it('codifica buscas sem transformar o cursor em rota', async () => {
    const fetcher = vi.fn(async () => json({ ok: true, result: { kind: 'projects', items: [], nextCursor: null } })); vi.stubGlobal('fetch', fetcher);
    await createOnboardingHttpPort(ownerId).choices({ kind: 'projects', query: 'Plano & estudo', cursor: 'opaque/?&' });
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    const url = new URL(calls[0]![0], 'https://example.test');
    expect(url.pathname).toBe('/api/onboarding'); expect(url.searchParams.get('q')).toBe('Plano & estudo'); expect(url.searchParams.get('cursor')).toBe('opaque/?&');
  });
  it('vincula Google à rodada por enum, sem URL de retorno livre', async () => {
    const fetcher = vi.fn(async () => json({ ok: true, authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic' })); vi.stubGlobal('fetch', fetcher);
    expect(await startOnboardingGoogle(ownerId, roundId, clientId)).toContain('https://accounts.google.com/');
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('/api/calendar/oauth/start'); expect(JSON.parse(call[1].body as string)).toEqual({ client_id: clientId, continuation: { kind: 'onboarding', round_id: roundId } });
  });
  it.each(['https://example.test/o/oauth2/v2/auth', 'https://accounts.google.com/other', 'javascript:alert(1)'])('recusa autorização fora do destino permitido: %s', async authorization_url => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true, authorization_url })));
    await expect(startOnboardingGoogle(ownerId, roundId, clientId)).rejects.toMatchObject({ code: 'COMMIT_UNKNOWN' });
  });
  it('seleção de calendário usa o comando existente sem tokens ou eventos no draft', async () => {
    const fetcher = vi.fn(async () => json({ ok: true, result: {} })); vi.stubGlobal('fetch', fetcher);
    await selectOnboardingCalendar(ownerId, roundId, true, clientId);
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('/api/calendar'); expect(JSON.parse(call[1].body as string)).toEqual({ command: 'calendar.select', input: { client_id: clientId, calendar_id: roundId, selected: true } });
  });
  it('o tema é salvo na API existente sem depender do WorkspaceShell', async () => {
    const fetcher = vi.fn(async () => json({ ok: true, result: {} })); vi.stubGlobal('fetch', fetcher);
    await saveOnboardingTheme(ownerId, 'dark', clientId);
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('/api/settings'); expect(JSON.parse(call[1].body as string)).toEqual({ command: 'settings.preferences.update', input: { client_id: clientId, patch: { theme: 'dark' } } });
  });
});
