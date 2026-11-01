// DIAGNOSTIC ONLY: never included in the repo CI glob, never run implicitly.
// No connection string, data directory or externally supplied SQL is accepted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {removeScratchGuard} from './feedback-pglite-guard.mjs';
import {compose} from './wrapper-composition.mjs';
import {withLegacyAdoption} from './legacy-adoption.mjs';

const pins={
 candidate:'ffb71bd2d5f7696fb16dcf643c8720056c6e1850230d190009494bbf924ff3c3',
 fixture:'5f991bfa4c3f855b80507a4413638eb35a253e34b2cc140add706e1fa581ccb2',
 lock:'0cba789ed321489f3f2fbcd03aba8c43f78822b220f283087bb2b12dd66c9f55',
 package:'65dff2c93c707e526902eebfab246bcbf2df2eba1c6984a5b5e9a44177532b1c',
 wrappers:'ca2ea88972af7450dc9bc31d0fe427dc6540b1a7b494050c7118279c0d69d8bd',
 legacy:'4a1a5cd135130de0d9e0beb5aef0e4688503c471d2d55440ff58f45e41d3f69d',
 combined:'77ee4ababfe9ef8259c3a6cdbb1adb59aa2bdd52f617b842fa6be46512d63d43',
 legacyCombined:'f22de2bf553485a4786aa211ba6991dd8388a1d1270e0800d0df2c972b74c234',
 nodeMajor:'24',pglite:'0.5.8'
};
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');

test('feedback barrier: synthetic disposable PGlite diagnostic', {timeout:120000},async()=>{
 assert.equal(process.env.FRONT_B_FEEDBACK_RUN_PGLITE,'1','explicit opt-in required; no database was opened');
 assert.equal(process.versions.node.split('.')[0],pins.nodeMajor,'expected Node 24; review before execution');
 process.stdout.write(`Diagnostic Node ${process.version}; PGlite expected ${pins.pglite}\n`);
 const [candidate,fixture,lockBytes,packageBytes,wrappers,legacyFixture,combined,legacyCombined]=await Promise.all([
  readFile(new URL('./candidate-feedback-barrier.sql.txt',import.meta.url)),
  readFile(new URL('./feedback-pglite-fixture.sql',import.meta.url)),
  readFile(new URL('../../../package-lock.json',import.meta.url)),
  readFile(new URL('../../../node_modules/@electric-sql/pglite/package.json',import.meta.url)),
  readFile(new URL('./wrappers.sql.txt',import.meta.url)),readFile(new URL('./legacy-synthetic-fixture.sql',import.meta.url)),readFile(new URL('./candidate-with-wrappers.sql.txt',import.meta.url)),readFile(new URL('./candidate-legacy.sql.txt',import.meta.url))
 ]);
 for(const [name,bytes] of Object.entries({candidate,fixture,lock:lockBytes,package:packageBytes,wrappers,legacy:legacyFixture,combined,legacyCombined})) assert.equal(sha(bytes),pins[name],`${name} drift`);
 const lock=JSON.parse(lockBytes),pkg=JSON.parse(packageBytes);
 assert.equal(pkg.name,'@electric-sql/pglite');assert.equal(pkg.version,pins.pglite);
 assert.equal(lock.packages['node_modules/@electric-sql/pglite'].version,pins.pglite);
 assert.deepEqual(compose(candidate,wrappers),combined,'reviewed composed SQL drift');
 assert.deepEqual(withLegacyAdoption(combined),legacyCombined,'reviewed legacy SQL drift');
 const unblocked=removeScratchGuard(legacyCombined.toString('utf8'));
 // The guard stays on disk; only the in-memory string is modified.
 const require=createRequire(new URL('../../../package.json',import.meta.url));
 const {PGlite}=require('@electric-sql/pglite');
 const pg=new PGlite();
 try{
  await pg.exec(fixture.toString('utf8'));
  try{await assert.rejects(()=>pg.exec(legacyFixture.toString('utf8')),/UNREVIEWED SCRATCH SQL: DO NOT APPLY/);}finally{await pg.exec('ROLLBACK');}
  assert.equal((await pg.query("SELECT to_regprocedure('public.feedback_submit(uuid,uuid,uuid,text,text)') IS NULL AS absent")).rows[0].absent,true);
  await pg.exec(removeScratchGuard(legacyFixture.toString('utf8')));
  // The fragment by itself must abort before creating wrappers or revoking the old writer.
  try{await assert.rejects(()=>pg.exec(wrappers.toString('utf8')),/UNREVIEWED FEEDBACK WRAPPERS: DO NOT APPLY/);}finally{await pg.exec('ROLLBACK');}
  const guarded=(await pg.query(`SELECT to_regprocedure('public.feedback_barrier_submit(uuid,uuid,uuid,text,text)') IS NULL AS absent,
   to_regclass('app_private.feedback_barriers_draft') IS NULL AS no_barrier,
   has_function_privilege('service_role','public.feedback_submit(uuid,uuid,uuid,text,text)','EXECUTE') AS legacy_intact`)).rows[0];
  assert.deepEqual(guarded,{absent:true,no_barrier:true,legacy_intact:true});
  await pg.exec(unblocked);
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
  const beforeLegacy=await effects(),legacyResult=(await one(status,[user,session,legacy])).value;
  assert.equal(legacyResult.status,'submitted');assert.equal(legacyResult.clientId,legacy);assert.equal(typeof legacyResult.feedbackId,'string');assert.deepEqual(Object.keys(legacyResult).sort(),['clientId','feedbackId','status']);
  const afterLegacy=await effects();assert.equal(afterLegacy.messages.length,beforeLegacy.messages.length);assert.equal(afterLegacy.events.length,beforeLegacy.events.length);assert.equal(afterLegacy.barriers.length,beforeLegacy.barriers.length+1);
  assert.deepEqual((await one(submit,[user,session,legacy,'other','mensagem legada sintética'])).value,legacyResult);
  await assert.rejects(()=>one(submit,[user,session,legacy,'other','mensagem diferente válida']),{code:'23505'});
  assert.deepEqual((await one(cancel,[user,session,legacy])).value,legacyResult);assert.deepEqual(await effects(),afterLegacy);
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
  const wrapperClient='30000000-0000-4000-8000-000000000004',wrapperCancelled='30000000-0000-4000-8000-000000000005';
  const pubSubmit='SELECT public.feedback_barrier_submit($1,$2,$3,$4,$5) AS value',pubStatus='SELECT public.feedback_barrier_status($1,$2,$3) AS value',pubCancel='SELECT public.feedback_barrier_cancel($1,$2,$3) AS value';
  const privileges=await one(`SELECT
   has_function_privilege('anon','public.feedback_barrier_submit(uuid,uuid,uuid,text,text)','EXECUTE') AS anon_exec,
   has_function_privilege('authenticated','public.feedback_barrier_submit(uuid,uuid,uuid,text,text)','EXECUTE') AS auth_exec,
   has_function_privilege('service_role','public.feedback_barrier_submit(uuid,uuid,uuid,text,text)','EXECUTE') AS service_exec,
   has_function_privilege('service_role','public.feedback_submit(uuid,uuid,uuid,text,text)','EXECUTE') AS old_public,
   has_function_privilege('service_role','app_private.feedback_submit(uuid,uuid,uuid,text,text)','EXECUTE') AS old_private`);
  assert.deepEqual(privileges,{anon_exec:false,auth_exec:false,service_exec:true,old_public:false,old_private:false});
  await pg.exec('SET ROLE service_role');
  try{
   const payload=[user,session,wrapperClient,'suggestion','mensagem válida de teste'];
   const unchanged=async(action,code)=>{
    await pg.exec('RESET ROLE');const before=await effects();await pg.exec('SET ROLE service_role');
    await assert.rejects(action,{code});await pg.exec('RESET ROLE');assert.deepEqual(await effects(),before);await pg.exec('SET ROLE service_role');
   };
   assert.deepEqual((await one(pubStatus,[user,session,legacy])).value,legacyResult);
   await unchanged(()=>one(pubSubmit,[user,session,legacy,'other','mensagem diferente válida']),'23505');
   assert.deepEqual((await one(pubCancel,[user,session,legacy])).value,legacyResult);
   const first=(await one(pubSubmit,payload)).value;
   assert.equal(first.status,'submitted');assert.equal(first.clientId,wrapperClient);assert.equal(typeof first.feedbackId,'string');
   assert.deepEqual((await one(pubSubmit,payload)).value,first);
   assert.deepEqual((await one(pubStatus,[user,session,wrapperClient])).value,first);
   assert.deepEqual((await one(pubStatus,[userB,sessionB,wrapperClient])).value,{status:'unknown',clientId:wrapperClient});
   await unchanged(()=>one(pubSubmit,[user,session,wrapperClient,'suggestion','mensagem diferente válida']),'23505');
   await unchanged(()=>one(pubStatus,[user,sessionB,wrapperClient]),'42501');
   await unchanged(()=>one(pubSubmit,[user,session,wrapperClient,null,'mensagem válida de teste']),'22023');
   assert.deepEqual((await one(pubCancel,[user,session,wrapperCancelled])).value,{status:'cancelled',clientId:wrapperCancelled});
   assert.deepEqual((await one(pubSubmit,[user,session,wrapperCancelled,'suggestion','mensagem válida de teste'])).value,{status:'cancelled',clientId:wrapperCancelled});
   await unchanged(()=>one('SELECT public.feedback_submit($1,$2,$3,$4,$5)',payload),'42501');
   await unchanged(()=>one('SELECT app_private.feedback_submit($1,$2,$3,$4,$5)',payload),'42501');
   await pg.exec('RESET ROLE');await pg.query("UPDATE public.user_moderation SET status='blocked' WHERE user_id=$1",[user]);await pg.exec('SET ROLE service_role');
   await unchanged(()=>one(pubStatus,[user,session,wrapperClient]),'42501');
   await pg.exec('RESET ROLE');await pg.query("UPDATE public.user_moderation SET status='active' WHERE user_id=$1",[user]);await pg.exec('SET ROLE service_role');
  }finally{await pg.exec('RESET ROLE');}
  const afterWrappers=await effects();
  assert.equal(afterWrappers.messages.length,beforeDenials.messages.length+1);assert.equal(afterWrappers.events.length,beforeDenials.events.length+1);assert.equal(afterWrappers.barriers.length,beforeDenials.barriers.length+2);
  for(const role of ['anon','authenticated']){
   await pg.exec(`SET ROLE ${role}`);
   try{await assert.rejects(()=>one(pubStatus,[user,session,wrapperClient]),{code:'42501'});}finally{await pg.exec('RESET ROLE');}
   assert.deepEqual(await effects(),afterWrappers);
  }
  const legacySubmit='30000000-0000-4000-8000-000000000006',legacyCancel='30000000-0000-4000-8000-000000000007';
  await pg.query("INSERT INTO app_private.feedback_requests(user_id,client_id,category,message) VALUES ($1,$2,'other','mensagem legada para envio'),($1,$3,'other','mensagem legada para cancelar')",[user,legacySubmit,legacyCancel]);
  const beforeAdopt=await effects();
  await pg.exec('SET ROLE service_role');
  try{
   assert.deepEqual((await one(pubStatus,[userB,sessionB,legacySubmit])).value,{status:'unknown',clientId:legacySubmit});
   await assert.rejects(()=>one(pubSubmit,[user,session,legacySubmit,'other','mensagem diferente válida']),{code:'23505'});
  }finally{await pg.exec('RESET ROLE');}
  assert.deepEqual(await effects(),beforeAdopt);
  await pg.exec('SET ROLE service_role');
  try{
   const viaSubmit=(await one(pubSubmit,[user,session,legacySubmit,'other','mensagem legada para envio'])).value;
   const viaCancel=(await one(pubCancel,[user,session,legacyCancel])).value;
   for(const [v,key] of [[viaSubmit,legacySubmit],[viaCancel,legacyCancel]]){assert.equal(v.status,'submitted');assert.equal(v.clientId,key);assert.equal(typeof v.feedbackId,'string');assert.deepEqual(Object.keys(v).sort(),['clientId','feedbackId','status']);}
   assert.deepEqual((await one(pubStatus,[user,session,legacySubmit])).value,viaSubmit);
   assert.deepEqual((await one(pubStatus,[user,session,legacyCancel])).value,viaCancel);
  }finally{await pg.exec('RESET ROLE');}
  const afterAdopt=await effects();assert.equal(afterAdopt.messages.length,beforeAdopt.messages.length);assert.equal(afterAdopt.events.length,beforeAdopt.events.length);assert.equal(afterAdopt.barriers.length,beforeAdopt.barriers.length+2);
  const inconsistent='30000000-0000-4000-8000-000000000008';
  await pg.exec('SET ROLE service_role');try{assert.deepEqual((await one(pubCancel,[user,session,inconsistent])).value,{status:'cancelled',clientId:inconsistent});}finally{await pg.exec('RESET ROLE');}
  // Simulate a legacy writer that bypassed the tombstone; no path may call it cancelled.
  await pg.query("INSERT INTO app_private.feedback_requests(user_id,client_id,category,message) VALUES($1,$2,'other','mensagem legada inconsistente')",[user,inconsistent]);
  const beforeInconsistent=await effects();await pg.exec('SET ROLE service_role');
  try{
   await assert.rejects(()=>one(pubStatus,[user,session,inconsistent]),{code:'55000'});
   await assert.rejects(()=>one(pubCancel,[user,session,inconsistent]),{code:'55000'});
   await assert.rejects(()=>one(pubSubmit,[user,session,inconsistent,'other','mensagem legada inconsistente']),{code:'55000'});
  }finally{await pg.exec('RESET ROLE');}
  assert.deepEqual(await effects(),beforeInconsistent);
  await assert.rejects(()=>one(status,[user,sessionB,client]),{code:'42501'});
  assert.deepEqual(await effects(),beforeInconsistent);
  // A corrupt orphaned submitted barrier is inconclusive, not an auth failure.
  const orphan='30000000-0000-4000-8000-000000000009',missing='30000000-0000-4000-8000-000000000010';
  await pg.query("INSERT INTO app_private.feedback_barriers_draft(user_id,client_id,phase,feedback_id) VALUES($1,$2,'submitted',$3)",[user,orphan,missing]);
  const beforeOrphan=await effects();await pg.exec('SET ROLE service_role');
  try {
   await assert.rejects(()=>one(pubStatus,[user,session,orphan]),{code:'55000'});
   await assert.rejects(()=>one(pubCancel,[user,session,orphan]),{code:'55000'});
   await assert.rejects(()=>one(pubSubmit,[user,session,orphan,'other','mensagem válida para teste']),{code:'55000'});
  } finally {await pg.exec('RESET ROLE');}
  assert.deepEqual(await effects(),beforeOrphan);
 }finally{await pg.close();}
});
