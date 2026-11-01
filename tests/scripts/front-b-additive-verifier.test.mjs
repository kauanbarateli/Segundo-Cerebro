import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCatalogueFixture} from './helpers/catalogue-fixture.mjs';
import {CURRENT27_CANONICAL_REVIEW} from '../helpers/canonical-release-source.mjs';

const operation = name => readFile(new URL(`../../supabase/operations/${name}`, import.meta.url), 'utf8');
const candidates = [
  '20261101020254_public_admission_gate.sql',
  '20261101030000_signup_metrics.sql',
  '20261101013633_feedback_requests.sql',
];

test('verificador aditivo reconhece composição e rejeita alterações de segurança', {timeout: 60000}, async () => {
  const db = await createCatalogueFixture();
  try {
    for (const migration of CURRENT27_CANONICAL_REVIEW) {
      const sql = await readFile(new URL(`../../supabase/migrations/${migration.file}`, import.meta.url));
      assert.equal(createHash('sha256').update(sql).digest('hex'), migration.sha256);
      await db.exec(sql.toString('utf8'));
    }
    const sql = await operation('verify-front-b-additive.sql');
    const verify = async () => (await db.query(sql)).rows[0].result;
    assert.equal((await verify()).ok, false, 'catálogo sem as candidatas não é aceito');
    await db.exec(await operation('onboarding-conflict-code.sql'));
    for (const candidate of candidates) await db.exec(await operation(`candidates/${candidate}`));
    await db.exec('begin read only');
    assert.deepEqual(await verify(), {check: 'front_b_additive_catalogue', ok: true, failures: []});
    await db.exec('rollback');

    const cases = [
      ['function', 'public.signup_metrics', `grant execute on function public.signup_metrics(uuid,uuid,date,date,text,text) to authenticated`],
      ['function', 'public.signup_metrics', `create or replace function public.signup_metrics(p_actor uuid,p_session uuid,p_start date,p_end date,p_zone text,p_bucket text) returns jsonb language sql security definer set search_path='' as $$ select '{}'::jsonb $$`],
      ['table', 'app_private.feedback_requests', 'alter table app_private.feedback_requests disable row level security'],
      ['table', 'app_private.feedback_requests', 'grant select on app_private.feedback_requests to authenticated'],
      ['table', 'app_private.feedback_requests', 'create policy bad_policy on app_private.feedback_requests for select to public using (true)'],
      ['trigger', 'auth.users.second_brain_admission_created', 'alter table auth.users disable trigger second_brain_admission_created'],
      ['constraint', 'public.domain_events.domain_events_entity_type_check', 'alter table public.domain_events drop constraint domain_events_entity_type_check; alter table public.domain_events add constraint domain_events_entity_type_check check (true)'],
      ['column', 'app_private.onboarding_entries.source_kind', `alter table app_private.onboarding_entries alter column source_kind set default 'public'`],
      ['index', 'app_private.signup_intents_expiry', 'drop index app_private.signup_intents_expiry'],
    ];
    for (const [kind, object, mutation] of cases) {
      await db.exec('begin');
      try {
        await db.exec(mutation);
        const result = await verify();
        assert.equal(result.ok, false, mutation);
        assert.ok(result.failures.some(f => f.kind === kind && f.object.startsWith(object)), `${mutation}: ${JSON.stringify(result.failures)}`);
      } finally {
        await db.exec('rollback');
      }
      assert.equal((await verify()).ok, true, `rollback da mutação: ${mutation}`);
    }
  } finally {
    await db.close();
  }
});
