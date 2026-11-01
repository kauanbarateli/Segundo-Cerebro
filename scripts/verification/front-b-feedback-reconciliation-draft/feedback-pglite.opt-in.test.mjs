// DIAGNOSTIC ONLY: never included in the repo CI glob, never run implicitly.
// No connection string, data directory or externally supplied SQL is accepted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {removeScratchGuard} from './feedback-pglite-guard.mjs';

const pins={
 candidate:'ffb71bd2d5f7696fb16dcf643c8720056c6e1850230d190009494bbf924ff3c3',
 fixture:'5f991bfa4c3f855b80507a4413638eb35a253e34b2cc140add706e1fa581ccb2',
 lock:'0cba789ed321489f3f2fbcd03aba8c43f78822b220f283087bb2b12dd66c9f55',
 package:'65dff2c93c707e526902eebfab246bcbf2df2eba1c6984a5b5e9a44177532b1c',
 nodeMajor:'24',pglite:'0.5.8'
};
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');

test('feedback barrier: synthetic disposable PGlite diagnostic', {timeout:120000},async()=>{
 assert.equal(process.env.FRONT_B_FEEDBACK_RUN_PGLITE,'1','explicit opt-in required; no database was opened');
 assert.equal(process.versions.node.split('.')[0],pins.nodeMajor,'expected Node 24; review before execution');
 process.stdout.write(`Diagnostic Node ${process.version}; PGlite expected ${pins.pglite}\n`);
 const [candidate,fixture,lockBytes,packageBytes]=await Promise.all([
  readFile(new URL('./candidate-feedback-barrier.sql.txt',import.meta.url)),
  readFile(new URL('./feedback-pglite-fixture.sql',import.meta.url)),
  readFile(new URL('../../../package-lock.json',import.meta.url)),
  readFile(new URL('../../../node_modules/@electric-sql/pglite/package.json',import.meta.url))
 ]);
 for(const [name,bytes] of Object.entries({candidate,fixture,lock:lockBytes,package:packageBytes})) assert.equal(sha(bytes),pins[name],`${name} drift`);
 const lock=JSON.parse(lockBytes),pkg=JSON.parse(packageBytes);
 assert.equal(pkg.name,'@electric-sql/pglite');assert.equal(pkg.version,pins.pglite);
 assert.equal(lock.packages['node_modules/@electric-sql/pglite'].version,pins.pglite);
 const raw=candidate.toString('utf8'),unblocked=removeScratchGuard(raw);
 // The guard stays on disk; only the in-memory string is modified.
 const require=createRequire(new URL('../../../package.json',import.meta.url));
 const {PGlite}=require('@electric-sql/pglite');
 const pg=new PGlite();
 try{
  await pg.exec(fixture.toString('utf8'));await pg.exec(unblocked);
  const user='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000001';
  const userB='10000000-0000-4000-8000-000000000002',sessionB='20000000-0000-4000-8000-000000000002';
  const client='30000000-0000-4000-8000-000000000001',legacy='30000000-0000-4000-8000-000000000002',cancelled='30000000-0000-4000-8000-000000000003';
  for(const [u,s] of [[user,session],[userB,sessionB]]){
   await pg.query('INSERT INTO auth.users VALUES ($1)',[u]);
   await pg.query('INSERT INTO auth.sessions VALUES ($1,$2)',[s,u]);
   await pg.query("INSERT INTO public.user_moderation VALUES ($1,'active',false)",[u]);
  }
  const one=async(sql,values=[]) => (await pg.query(sql,values)).rows[0];
  const submit='SELECT app_private.draft_feedback_submit($1,$2,$3,$4,$5) AS value';
  const status='SELECT app_private.draft_feedback_status($1,$2,$3) AS value';
  const cancel='SELECT app_private.draft_feedback_cancel($1,$2,$3) AS value';
  const effects=()=>one(`SELECT
   (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.user_id,f.client_id),'[]'::jsonb) FROM app_private.feedback_requests f) AS messages,
   (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.user_id,b.client_id),'[]'::jsonb) FROM app_private.feedback_barriers_draft b) AS barriers,
   (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.user_id,e.entity_id,e.action),'[]'::jsonb) FROM public.domain_events e) AS events`);
  const payload=[user,session,client,'suggestion','mensagem sintética válida'];
  assert.deepEqual((await one(status,[user,session,client])).value,{status:'unknown',clientId:client});
  const first=(await one(submit,payload)).value;
  assert.equal(first.status,'submitted');assert.equal(first.clientId,client);
  assert.deepEqual((await one(submit,payload)).value,first);
  const afterSubmit=await effects();
  await assert.rejects(()=>one(submit,[user,session,client,'suggestion','mensagem sintética diferente']),{code:'23505'});
  assert.deepEqual(await effects(),afterSubmit);
  assert.deepEqual((await one(status,[user,session,client])).value,first);
  assert.deepEqual((await one(status,[userB,sessionB,client])).value,{status:'unknown',clientId:client});
  assert.deepEqual((await one(cancel,[userB,sessionB,client])).value,{status:'cancelled',clientId:client});
  assert.equal((await one(status,[user,session,client])).value.status,'submitted');
  assert.deepEqual((await one(cancel,[user,session,cancelled])).value,{status:'cancelled',clientId:cancelled});
  assert.deepEqual((await one(submit,[user,session,cancelled,'other','mensagem sintética tardia'])).value,{status:'cancelled',clientId:cancelled});
  await pg.query("INSERT INTO app_private.feedback_requests(user_id,client_id,category,message) VALUES ($1,$2,'other','mensagem legada sintética')",[user,legacy]);
  assert.equal((await one(status,[user,session,legacy])).value.status,'unknown');
  const beforeLegacyCancel=await effects();
  await assert.rejects(()=>one(cancel,[user,session,legacy]),{code:'42501'});
  assert.deepEqual(await effects(),beforeLegacyCancel);
  assert.equal((await one('SELECT count(*)::int AS n FROM app_private.feedback_barriers_draft WHERE user_id=$1 AND client_id=$2',[user,legacy])).n,0);
  const counts=await one('SELECT (SELECT count(*)::int FROM app_private.feedback_requests) AS messages,(SELECT count(*)::int FROM public.domain_events) AS events');
  assert.deepEqual(counts,{messages:2,events:1});
  const access=await one(`SELECT
   has_table_privilege('anon','app_private.feedback_barriers_draft','SELECT') AS anon_read,
   has_table_privilege('authenticated','app_private.feedback_barriers_draft','SELECT') AS auth_read,
   has_table_privilege('service_role','app_private.feedback_barriers_draft','SELECT') AS service_read,
   has_function_privilege('anon','app_private.draft_feedback_cancel(uuid,uuid,uuid)','EXECUTE') AS anon_execute,
   has_function_privilege('authenticated','app_private.draft_feedback_cancel(uuid,uuid,uuid)','EXECUTE') AS auth_execute,
   has_function_privilege('service_role','app_private.draft_feedback_cancel(uuid,uuid,uuid)','EXECUTE') AS service_execute`);
  assert.deepEqual(access,{anon_read:false,auth_read:false,service_read:false,anon_execute:false,auth_execute:false,service_execute:true});
  const beforeDenials=await effects();
  await pg.exec('SET ROLE authenticated');
  try{
   await assert.rejects(()=>one('SELECT * FROM app_private.feedback_barriers_draft'),{code:'42501'});
   await pg.exec('RESET ROLE');
   assert.deepEqual(await effects(),beforeDenials);
   await pg.exec('SET ROLE authenticated');
   await assert.rejects(()=>one(cancel,[user,session,client]),{code:'42501'});
  }finally{await pg.exec('RESET ROLE');}
  assert.deepEqual(await effects(),beforeDenials);
  await assert.rejects(()=>one(status,[user,sessionB,client]),{code:'42501'});
  assert.deepEqual(await effects(),beforeDenials);
 }finally{await pg.close();}
});
