import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createCatalogueFixture} from './helpers/catalogue-fixture.mjs';
import {CURRENT27_CANONICAL_REVIEW} from '../helpers/canonical-release-source.mjs';

test('composição candidata preserva isolamento de feedback e métricas com a barreira de admissão', {timeout:60000},async()=>{
 const db=await createCatalogueFixture();
 try {
  for(const migration of CURRENT27_CANONICAL_REVIEW){const sql=await readFile(new URL(`../../supabase/migrations/${migration.file}`,import.meta.url));assert.equal(createHash('sha256').update(sql).digest('hex'),migration.sha256);await db.exec(sql.toString('utf8'));}
  const master=randomUUID(),masterSession=randomUUID(),person=randomUUID(),session=randomUUID(),other=randomUUID(),otherSession=randomUUID();
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'master@example.invalid',now()),($2,'person@example.invalid',now()),($3,'other@example.invalid',now())",[master,person,other]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4),($5,$6)',[masterSession,master,session,person,otherSession,other]);
  for(const file of ['20261101020254_public_admission_gate.sql','20261101030000_signup_metrics.sql','20261101013633_feedback_requests.sql']) await db.exec(await readFile(new URL(`../../supabase/operations/candidates/${file}`,import.meta.url),'utf8'));
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
