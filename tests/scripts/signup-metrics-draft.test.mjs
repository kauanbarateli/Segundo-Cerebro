import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createCatalogueFixture } from './helpers/catalogue-fixture.mjs';
import { CURRENT27_CANONICAL_REVIEW } from '../helpers/canonical-release-source.mjs';

test('métricas candidatas são agregadas no banco, restritas ao Master e respeitam retenção', {timeout:60000}, async () => {
 const db=await createCatalogueFixture();
 try {
  for (const migration of CURRENT27_CANONICAL_REVIEW) {
   const sql=await readFile(new URL(`../../supabase/migrations/${migration.file}`,import.meta.url));
   assert.equal(createHash('sha256').update(sql).digest('hex'),migration.sha256); await db.exec(sql.toString('utf8'));
  }
  const master=randomUUID(), masterSession=randomUUID();
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'master@example.invalid',now())",[master]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[masterSession,master]);
  await db.exec(await readFile(new URL('../../supabase/operations/candidates/20261101020254_public_admission_gate.sql',import.meta.url),'utf8'));
  await db.query("update public.user_roles set role='master' where user_id=$1",[master]);
  await db.exec(await readFile(new URL('../../supabase/operations/candidates/20261101030000_signup_metrics.sql',import.meta.url),'utf8'));
  const users=[];
  for(let i=0;i<9;i++) {
   const id=randomUUID(); users.push(id);
   await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,`user${i}@example.invalid`]);
   await db.query("update app_private.user_admission set origin='public',state='admitted',admitted_at='2026-10-17 04:30:00+00' where user_id=$1",[id]);
   if(i<8) await db.query("insert into app_private.signup_origins(user_id,origin,consent_version,consented_at,expires_at) values($1,$2::jsonb,'v1',now(),case when $3 then now()-interval '1 second' else now()+interval '1 year' end)",[id,JSON.stringify({utm_source:i<6?'busca':'raro'}),i===7]);
  }
  const otherSession=randomUUID(); await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[otherSession,users[0]]);
  const call=(actor,session,start='2026-10-17',end='2026-10-17',zone='America/Fortaleza',bucket='day')=>db.query('select public.signup_metrics($1,$2,$3,$4,$5,$6) as data',[actor,session,start,end,zone,bucket]);
  await assert.rejects(call(users[0],otherSession),e=>e.code==='42501');
  await assert.rejects(call(master,otherSession),e=>e.code==='42501');
  await assert.rejects(call(master,masterSession,'2025-01-01','2026-01-02'),e=>e.code==='22023');
  await assert.rejects(call(master,masterSession,'2026-10-17','2026-10-17','invalid'),e=>e.code==='22023');
  const result=(await call(master,masterSession)).rows[0].data;
  assert.equal(result.totalPublic,9); assert.equal(result.stock.total,10); assert.equal(result.stock.public,9);
  assert.deepEqual(result.series,[{period:'2026-10-17',count:9}]);
  assert.deepEqual(result.distributions.utm_source,[{kind:'value',value:'busca',count:6},{kind:'other',value:null,count:3}]);
  assert.equal(JSON.stringify(result).includes('raro'),false);
  assert.equal(JSON.stringify(result).includes('@example.invalid'),false);
  await db.query('delete from app_private.signup_origins where user_id=$1',[users[0]]);
  const withdrawn=(await call(master,masterSession)).rows[0].data;
  assert.equal(withdrawn.totalPublic,9); assert.deepEqual(withdrawn.distributions.utm_source,[{kind:'value',value:'busca',count:5},{kind:'other',value:null,count:4}]);
  const privilege=(await db.query("select has_function_privilege('anon','public.signup_metrics(uuid,uuid,date,date,text,text)','execute') as anon,has_function_privilege('authenticated','public.signup_metrics(uuid,uuid,date,date,text,text)','execute') as browser,has_function_privilege('service_role','public.signup_metrics(uuid,uuid,date,date,text,text)','execute') as service")).rows[0];
  assert.deepEqual(privilege,{anon:false,browser:false,service:true});
  await db.query("update public.user_moderation set status='blocked' where user_id=$1",[master]);
  await assert.rejects(call(master,masterSession),e=>e.code==='42501');
 } finally { await db.close(); }
});
