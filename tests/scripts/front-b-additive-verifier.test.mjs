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
      ['function', 'app_private.signup_intent_create', 'alter function app_private.signup_intent_create(text,text,text,text,timestamptz,jsonb,text) strict'],
      ['table', 'app_private.feedback_requests', 'alter table app_private.feedback_requests disable row level security'],
      ['table', 'app_private.feedback_requests', 'grant select on app_private.feedback_requests to authenticated'],
      ['table', 'app_private.feedback_requests', 'create policy bad_policy on app_private.feedback_requests for select to public using (true)'],
      ['trigger', 'auth.users.second_brain_admission_created', 'alter table auth.users disable trigger second_brain_admission_created'],
      ['trigger_set', 'app_private.feedback_requests.injected_availability', 'create trigger injected_availability before insert on app_private.feedback_requests for each row execute function app_private.admission_new_identity()'],
      ['fk_trigger', 'app_private.signup_intents.signup_intents_user_id_fkey', 'alter table app_private.signup_intents disable trigger all'],
      ['internal_trigger_set', 'app_private.feedback_requests', 'alter table app_private.admin_operations add column fixture_fk uuid references app_private.feedback_requests(id)'],
      ['constraint', 'public.domain_events.domain_events_entity_type_check', 'alter table public.domain_events drop constraint domain_events_entity_type_check; alter table public.domain_events add constraint domain_events_entity_type_check check (true)'],
      ['constraint_set', 'app_private.feedback_requests', 'alter table app_private.feedback_requests add constraint injected_deny check (false) not valid'],
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
    const referencedTrigger=(await db.query(`select t.tgname from pg_trigger t join pg_constraint c on c.oid=t.tgconstraint
      where c.conrelid='app_private.signup_origins'::regclass and c.conname='signup_origins_user_id_fkey'
      and t.tgrelid='auth.users'::regclass and t.tgtype=9`)).rows;
    assert.equal(referencedTrigger.length,1);
    assert.match(referencedTrigger[0].tgname,/^RI_ConstraintTrigger_a_\d+$/);
    await db.exec('begin');
    try{
      await db.exec(`alter table auth.users disable trigger "${referencedTrigger[0].tgname}"`);
      const changed=await verify();
      assert.ok(changed.failures.some(f=>f.kind==='fk_trigger'&&f.object==='app_private.signup_origins.signup_origins_user_id_fkey'));
    }finally{await db.exec('rollback');}
    assert.equal((await verify()).ok,true);
    // A data switch is not a catalogue property. A separate read-only gate
    // checks this one database flag; Auth/provider and application flags remain
    // independent and require their own preflight.
    const gateSql=await operation('verify-front-b-signup-disabled.sql');
    const gate=async()=>(await db.query(gateSql)).rows[0].result;
    assert.deepEqual(await gate(),{check:'front_b_signup_database_gate_disabled',ok:true});
    await db.exec('begin');
    try{
      await db.exec('insert into app_private.signup_settings(singleton,enabled) values(true,true)');
      assert.equal((await verify()).ok,true,'catálogo não atesta estado operacional');
      assert.deepEqual(await gate(),{check:'front_b_signup_database_gate_disabled',ok:false});
    }finally{await db.exec('rollback');}
    assert.equal((await gate()).ok,true);
  } finally {
    await db.close();
  }
});
