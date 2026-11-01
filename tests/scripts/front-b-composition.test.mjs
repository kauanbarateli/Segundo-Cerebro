import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createCatalogueFixture} from './helpers/catalogue-fixture.mjs';
import {CURRENT27_CANONICAL_REVIEW} from '../helpers/canonical-release-source.mjs';

const operation = name => readFile(new URL(`../../supabase/operations/${name}`,import.meta.url),'utf8');
async function patchClassification(db,verifier) {
 const rows=(await db.exec(verifier)).flatMap(result=>result.rows);
 const result=rows.find(row=>row.jsonb_build_object)?.jsonb_build_object;
 assert.equal(result?.check,'onboarding_conflict_patch_pt409');
 return result.ok;
}
async function onboardingSnapshot(db) {
 const result=await db.query(`select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition,
   p.prosrc as body,pg_get_userbyid(p.proowner) as owner,p.proconfig as config,
   coalesce((select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
     'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
     order by a.grantee,a.grantor,a.privilege_type) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),'[]'::jsonb) as grants
  from pg_proc p where p.oid=to_regprocedure('public.onboarding_call(uuid,uuid,text,jsonb)')`);
 assert.equal(result.rows.length,1);return result.rows[0];
}
async function assertConflictTranslation(db) {
 // Replace the private callee only within a disposable transaction, then roll
 // it back even after the synthetic error. No hosted function is touched.
 const readPrivate=async()=> (await db.query("select pg_get_functiondef('app_private.onboarding_call(uuid,uuid,text,jsonb)'::regprocedure) as definition,proacl::text as acl from pg_proc where oid='app_private.onboarding_call(uuid,uuid,text,jsonb)'::regprocedure")).rows;
 const before=await readPrivate();assert.equal(before.length,1);
 await db.exec('begin');
 try {
  await db.exec(`create or replace function app_private.onboarding_call(p_user uuid,p_session uuid,p_operation text,p_request jsonb)
   returns jsonb language plpgsql as $$ begin raise exception 'private fixture conflict' using errcode='40001'; end $$`);
  await assert.rejects(db.query("select public.onboarding_call(null,null,'fixture','{}'::jsonb)"),error=>error.code==='PT409'&&!error.message.includes('private fixture conflict'));
 } finally {await db.exec('rollback');}
 assert.deepEqual(await readPrivate(),before,'callee privado restaurado após o conflito sintético');
}

test('composição candidata preserva isolamento de feedback e métricas com a barreira de admissão', {timeout:60000},async()=>{
 const db=await createCatalogueFixture();
 try {
  for(const migration of CURRENT27_CANONICAL_REVIEW){const sql=await readFile(new URL(`../../supabase/migrations/${migration.file}`,import.meta.url));assert.equal(createHash('sha256').update(sql).digest('hex'),migration.sha256);await db.exec(sql.toString('utf8'));}
  const verifier=await operation('verify-onboarding-conflict-code.sql');
  assert.equal(await patchClassification(db,verifier),false,'wrapper canônico não é o patch operacional');
  await db.exec(await operation('onboarding-conflict-code.sql'));
  assert.equal(await patchClassification(db,verifier),true,'fixture descartável possui PT409 e grants exatos');
  const originalWrapper=await onboardingSnapshot(db);
  await assertConflictTranslation(db);
  assert.deepEqual(await onboardingSnapshot(db),originalWrapper);
  const master=randomUUID(),masterSession=randomUUID(),person=randomUUID(),session=randomUUID(),other=randomUUID(),otherSession=randomUUID();
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'master@example.invalid',now()),($2,'person@example.invalid',now()),($3,'other@example.invalid',now())",[master,person,other]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4),($5,$6)',[masterSession,master,session,person,otherSession,other]);
  for(const file of ['20261101020254_public_admission_gate.sql','20261101030000_signup_metrics.sql','20261101013633_feedback_requests.sql']) await db.exec(await readFile(new URL(`../../supabase/operations/candidates/${file}`,import.meta.url),'utf8'));
  assert.equal(await patchClassification(db,verifier),true,'candidatas preservam o fingerprint e grants PT409');
  assert.deepEqual(await onboardingSnapshot(db),originalWrapper,'corpo, assinatura, proprietário, configuração e ACL permaneceram idênticos');
  await assertConflictTranslation(db);
  assert.deepEqual(await onboardingSnapshot(db),originalWrapper);
  // An added authenticated grant must be rejected, then removed again in this
  // disposable fixture so the subsequent isolation assertions run unchanged.
  await db.exec('grant execute on function public.onboarding_call(uuid,uuid,text,jsonb) to authenticated');
  assert.equal(await patchClassification(db,verifier),false,'grant adicional não é aceito como patch preservado');
  await db.exec('revoke execute on function public.onboarding_call(uuid,uuid,text,jsonb) from authenticated');
  assert.equal(await patchClassification(db,verifier),true);
  assert.deepEqual(await onboardingSnapshot(db),originalWrapper);
  await db.query("update public.user_roles set role='master' where user_id=$1",[master]);
  await db.query("update app_private.user_admission set origin='public',admitted_at='2026-10-17 04:30:00+00' where user_id=$1",[person]);
  const message='Mensagem privada de integração';
  await db.query("select public.feedback_submit($1,$2,$3,'suggestion',$4)",[person,session,randomUUID(),message]);
  const list=(await db.query('select public.feedback_list($1,$2,null,null) as value',[other,otherSession])).rows[0].value;
  assert.deepEqual(list,[]);
  const report=(await db.query("select public.signup_metrics($1,$2,'2026-10-17','2026-10-17','America/Fortaleza','day') as value",[master,masterSession])).rows[0].value;
  assert.equal(report.totalPublic,1);assert.equal(JSON.stringify(report).includes(message),false);
  await db.query("update public.user_moderation set status='blocked' where user_id=$1",[person]);
  await assert.rejects(db.query('select public.feedback_list($1,$2,null,null)',[person,session]),error=>error.code==='42501');
 } finally {await db.close();}
});
