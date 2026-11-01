import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('transactional PT409 and ledger preflight accepts exact state and refuses drift',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema app_private;create schema supabase_migrations;
   create table supabase_migrations.schema_migrations(version text,name text,statements text[]);
   create function app_private.onboarding_call(uuid,uuid,text,jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
   create function public.onboarding_call(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.onboarding_call(p_user,p_session,p_operation,p_request)$$;
   revoke all on function public.onboarding_call(uuid,uuid,text,jsonb) from public;
   grant execute on function public.onboarding_call(uuid,uuid,text,jsonb) to service_role;`);
  await db.exec(await readFile(new URL('../../../supabase/operations/onboarding-conflict-code.sql',import.meta.url),'utf8'));
  const src=await readFile(new URL('../front-b-135-draft/admission-feedback-metrics-atomic.sql.txt',import.meta.url),'utf8');
  const historical=src.replace("DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;",'');
  await db.query('insert into supabase_migrations.schema_migrations values ($1,$2,array[$3])',['20261101172256','m028_front_b_signup_feedback_metrics_qa',historical]);
  const proposal=await readFile(new URL('./quarantine.guarded.sql.txt',import.meta.url),'utf8');
  const proof=proposal.match(/do \$integrity_028_pt409\$[\s\S]*?end \$integrity_028_pt409\$;/)?.[0];
  assert.ok(proof);await db.exec(proof);
  await db.exec("update supabase_migrations.schema_migrations set name='wrong'");
  await assert.rejects(db.exec(proof),/LEDGER_028_OR_PT409_REFUSED/);
  await db.exec("update supabase_migrations.schema_migrations set name='m028_front_b_signup_feedback_metrics_qa';grant execute on function public.onboarding_call(uuid,uuid,text,jsonb) to authenticated");
  await assert.rejects(db.exec(proof),/LEDGER_028_OR_PT409_REFUSED/);
 }finally{await db.close();}
});
