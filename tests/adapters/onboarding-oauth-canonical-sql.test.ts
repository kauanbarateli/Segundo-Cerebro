/** Real historical026 SQL wrappers, synthetic Auth catalogue and inert token
 * envelope only. Serial interleavings; no GoTrue/Google/network/hosted claim. */
import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createOnboardingCandidateSql } from '../helpers/onboarding-candidate-sql';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
type Round = { id: string; revision: string };
type Binding = { roundId: string; generation: string; expiresAt: string };
const a = '75000000-0000-4000-8000-000000000001', b = '75000000-0000-4000-8000-000000000002';
const sa = '75000000-0000-4000-8000-000000000011', sa2 = '75000000-0000-4000-8000-000000000012', sb = '75000000-0000-4000-8000-000000000013';

it('onboarding OAuth bind/take/connect uses real owner/round/generation/veto fences, reservations, replay and rollback', async () => {
  for (const name of ['APP_DEPLOYMENT_TARGET', 'VERCEL_GIT_COMMIT_REF', 'VERCEL_ENV', 'SUPABASE_URL']) vi.stubEnv(name, undefined);
  vi.stubGlobal('fetch', () => { throw new Error('No real transport in the disposable OAuth SQL test.'); });
  const db = await createOnboardingCandidateSql();
  const onb = async <T = unknown>(user: string, session: string, operation: string, request: object): Promise<T> =>
    (await db.query<{ value: T }>('select public.onboarding_call($1::uuid,$2::uuid,$3::text,$4::jsonb) as value', [user, session, operation, JSON.stringify(request)])).rows[0]!.value;
  const calendar = async <T = unknown>(user: string, session: string, operation: string, request: object): Promise<T> =>
    (await db.query<{ value: T }>('select public.google_calendar_call($1::uuid,$2::uuid,$3::text,$4::jsonb,false,$5::uuid) as value', [user, session, operation, JSON.stringify(request), randomUUID()])).rows[0]!.value;
  const material = async () => {
    await db.exec('reset role');
    try {
      return (await db.query<{ value: unknown }>(`select jsonb_build_object(
        'rounds',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from app_private.onboarding_rounds x),
        'continuations',(select coalesce(jsonb_agg(to_jsonb(x) order by flow_id),'[]') from app_private.onboarding_oauth x),
        'flows',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from app_private.google_oauth_flows x),
        'accounts',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.calendar_accounts x),
        'credentials',(select coalesce(jsonb_agg(to_jsonb(x) order by account_id),'[]') from app_private.google_credentials x),
        'sources',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.calendar_sources x),
        'events',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.domain_events x),
        'receipts',(select coalesce(jsonb_agg(to_jsonb(x) order by user_id,command,client_id),'[]') from app_private.command_receipts x),
        'intents',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from app_private.onboarding_intents x)
      ) as value`)).rows[0]!.value;
    } finally { await db.exec('set local role service_role'); }
  };
  const refused = async (code: string, action: () => Promise<unknown>) => {
    const before = await material();
    await db.exec('savepoint expected_oauth_refusal');
    let caught: unknown;
    try { await action(); } catch (error) { caught = error; }
    await db.exec('rollback to savepoint expected_oauth_refusal;release savepoint expected_oauth_refusal');
    expect(caught).toMatchObject({ code });
    expect(await material()).toEqual(before);
  };
  const unchangedNull = async (action: () => Promise<unknown>) => {
    const before = await material(); expect(await action()).toBeNull(); expect(await material()).toEqual(before);
  };
  const start = async (user: string, session: string): Promise<Round> => {
    await onb(user, session, 'start', { clientId: randomUUID() });
    const value = await onb<{ round: Round }>(user, session, 'snapshot', {});
    expect(value.round.id).toMatch(/^[a-f0-9-]{36}$/); return value.round;
  };
  const begin = async (user: string, session: string) => {
    const flowId = randomUUID();
    const expiresAt = (await db.query<{ expiry: string }>(`select to_char((clock_timestamp() at time zone 'UTC') + interval '9 minutes','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as expiry`)).rows[0]!.expiry;
    const result = await calendar<{ account_id: string }>(user, session, 'flow_begin', { flow_id: flowId, digest: 'a'.repeat(64), expires_at: expiresAt, reconnect_account: null });
    return { flowId, accountId: result.account_id };
  };
  const connectBody = (flow: { flowId: string; accountId: string }) => ({
    flow_id: flow.flowId, account_id: flow.accountId, google_sub: 'SYNTHETIC-' + flow.accountId, email: 'fixture@example.invalid',
    scopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.readonly'],
    tokens: { version: 1, key_id: 'test', iv: 'A'.repeat(16), tag: 'A'.repeat(22) + '==', ciphertext: 'AAAA' },
    credential_version: 1, calendars: [],
  });
  const veto = async (enabled: boolean) => {
    await db.exec('reset role');
    if (enabled) await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'calendario',false)", [a]);
    else await db.query("delete from public.user_entitlements where user_id=$1 and feature_key='calendario'", [a]);
    await db.exec('set local role service_role');
  };
  try {
    await db.exec('begin');
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','oauth-a@example.invalid'),($2,'authenticated','authenticated','oauth-b@example.invalid')", [a, b]);
    await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$2),($4,$5)', [sa, a, sa2, sb, b]);
    await db.exec('set local role service_role');
    const ra = await start(a, sa), rb = await start(b, sb), flow = await begin(a, sa);
    await refused('42501', () => onb(b, sb, 'oauth_bind', { roundId: rb.id, flowId: flow.flowId }));
    await refused('42501', () => onb(a, sa, 'oauth_bind', { roundId: rb.id, flowId: flow.flowId }));
    const bound = await onb<Binding>(a, sa, 'oauth_bind', { roundId: ra.id, flowId: flow.flowId });
    expect(Object.keys(bound).sort()).toEqual(['expiresAt', 'generation', 'roundId']);
    const take = { flowId: flow.flowId, ...bound };
    await refused('42501', () => onb(b, sa, 'oauth_take', take));
    await unchangedNull(() => onb(b, sb, 'oauth_take', take));
    await unchangedNull(() => onb(a, sa2, 'oauth_take', take));
    await unchangedNull(() => onb(a, sa, 'oauth_take', { ...take, generation: randomUUID() }));
    expect(await onb(a, sa, 'oauth_take', take)).toEqual(bound);
    await unchangedNull(() => onb(a, sa, 'oauth_take', take));
    await calendar(a, sa, 'flow_consume', { flow_id: flow.flowId, digest: 'a'.repeat(64) });
    const request = { flowId: flow.flowId, roundId: ra.id, generation: bound.generation, calendarConnect: connectBody(flow) };
    await refused('42501', () => onb(b, sb, 'oauth_connect', { ...request, roundId: rb.id }));
    await refused('42501', () => onb(a, sa2, 'oauth_connect', request));
    await refused('40001', () => onb(a, sa, 'oauth_connect', { ...request, generation: randomUUID() }));
    await veto(true); await refused('42501', () => onb(a, sa, 'oauth_connect', request)); await veto(false);
    expect(await onb(a, sa, 'oauth_connect', request)).toEqual({});
    const connected = await material();
    expect(await onb(a, sa, 'oauth_connect', request)).toEqual({}); expect(await material()).toEqual(connected);
    await refused('23505', () => onb(a, sa, 'oauth_connect', { ...request, calendarConnect: { ...request.calendarConnect, email: 'different@example.invalid' } }));
    await veto(true); await refused('42501', () => onb(a, sa, 'oauth_connect', request)); await veto(false);
    await calendar(a, sa, 'disconnect', { account_id: flow.accountId, client_id: 'g4-explicit-disconnect' });
    await db.exec('reset role');
    expect((await db.query('select status from public.calendar_accounts where id=$1', [flow.accountId])).rows).toEqual([{ status: 'revocation_pending' }]);
    await db.exec('set local role service_role');
    const pending = await begin(a, sa), pendingBinding = await onb<Binding>(a, sa, 'oauth_bind', { roundId: ra.id, flowId: pending.flowId });
    // A revocation-pending account + one reserved flow still exhaust the two slots.
    await refused('23514', () => begin(a, sa2));
    expect(await onb(a, sa, 'oauth_take', { flowId: pending.flowId, ...pendingBinding })).toEqual(pendingBinding);
    await calendar(a, sa, 'flow_consume', { flow_id: pending.flowId, digest: 'a'.repeat(64) });
    const pendingRequest = { flowId: pending.flowId, roundId: ra.id, generation: pendingBinding.generation, calendarConnect: connectBody(pending) };
    // Real empty completion changes generation between provider wait and final fence.
    const active = (await onb<{ round: Round }>(a, sa, 'snapshot', {})).round;
    await onb(a, sa, 'prepare', { roundId: active.id, expectedRevision: active.revision, clientId: randomUUID(), plan: [] });
    await onb(a, sa, 'complete', { roundId: active.id, clientId: randomUUID() });
    await refused('40001', () => onb(a, sa, 'oauth_connect', pendingRequest));
    const nextRound = await start(a, sa);
    expect(nextRound.id).not.toBe(ra.id);
    await refused('42501', () => onb(a, sa, 'oauth_connect', { ...pendingRequest, roundId: nextRound.id }));
    // A positive second owner proves the fence is not a universal refusal.
    const fb = await begin(b, sb), bb = await onb<Binding>(b, sb, 'oauth_bind', { roundId: rb.id, flowId: fb.flowId });
    await onb(b, sb, 'oauth_take', { flowId: fb.flowId, ...bb });
    await calendar(b, sb, 'flow_consume', { flow_id: fb.flowId, digest: 'a'.repeat(64) });
    expect(await onb(b, sb, 'oauth_connect', { flowId: fb.flowId, roundId: rb.id, generation: bb.generation, calendarConnect: connectBody(fb) })).toEqual({});
    await db.exec('reset role');
    expect((await db.query('select user_id::text owner,count(*)::integer n from public.calendar_accounts group by user_id order by user_id')).rows).toEqual([{ owner: a, n: 1 }, { owner: b, n: 1 }]);
    expect((await db.query('select count(*)::integer n from app_private.onboarding_oauth where connected_at is not null and permit_backend_pid is null and permit_xact_id is null')).rows).toEqual([{ n: 2 }]);
    expect((await db.query('select count(*)::integer n from public.domain_events where entity_type=\'calendar_account\' and "after"->>\'status\'=\'connected\'')).rows).toEqual([{ n: 2 }]);
    expect((await db.query('select count(*)::integer n from app_private.onboarding_write_permits')).rows).toEqual([{ n: 0 }]);
  } finally {
    try {
      await db.exec('rollback');
      expect((await db.query('select (select count(*)::integer from auth.users) users,(select count(*)::integer from public.domain_events) events,(select count(*)::integer from app_private.onboarding_rounds) rounds,(select count(*)::integer from app_private.google_oauth_flows) flows,(select count(*)::integer from public.calendar_accounts) accounts')).rows).toEqual([{ users: 0, events: 0, rounds: 0, flows: 0, accounts: 0 }]);
    } finally { await db.close(); }
  }
}, 120_000);
