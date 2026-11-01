// DIAGNOSTIC ONLY. Opt in explicitly; never part of the repository test glob.
// Uses only new PGlite() in memory and synthetic fixture data. Not PG17 proof.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {qualifyDraftSql,requireDiagnosticOptIn} from '../../scripts/verification/front-b-reservation-draft/guard.mjs';

export async function runReservationDiagnostic() {
 requireDiagnosticOptIn(process.env.FRONT_B_RUN_RESERVATION_PGLITE,process.versions.node);
 const bytes=await readFile(new URL('../../scripts/verification/front-b-signup-reservation-draft/candidate-reservation.sql.txt',import.meta.url));
 const sql=qualifyDraftSql(bytes);
 const lock=JSON.parse(await readFile(new URL('../../package-lock.json',import.meta.url),'utf8'));
 const pin=lock.packages?.['node_modules/@electric-sql/pglite'];
 assert.equal(pin?.version,'0.5.8');assert.match(pin?.integrity??'',/^sha512-/);
 const require=createRequire(new URL('../../package.json',import.meta.url));
 const manifest=JSON.parse(await readFile(new URL('../../node_modules/@electric-sql/pglite/package.json',import.meta.url),'utf8'));
 assert.equal(manifest.name,'@electric-sql/pglite');assert.equal(manifest.version,'0.5.8');
 const {PGlite} = require('@electric-sql/pglite');
 const pg = new PGlite();
 try {
  await pg.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE SCHEMA app_private; CREATE SCHEMA auth;
   GRANT USAGE ON SCHEMA app_private TO anon,authenticated,service_role;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz);
   CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);
   CREATE TABLE public.user_moderation(user_id uuid PRIMARY KEY,status text,must_change_password boolean);
   CREATE TABLE app_private.signup_settings(singleton boolean PRIMARY KEY,enabled boolean);
   CREATE TABLE app_private.user_admission(user_id uuid PRIMARY KEY,origin text,state text);
   CREATE TABLE app_private.signup_intents(id uuid PRIMARY KEY,user_id uuid,subject_hash text,state text,expires_at timestamptz,terms_version text,privacy_version text,origin jsonb,origin_consent_version text,origin_consented_at timestamptz);
   CREATE FUNCTION app_private.signup_pending_identity(p_user uuid,p_session uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT p_user IS NOT NULL AND p_session IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id JOIN public.user_moderation m ON m.user_id=u.id WHERE u.id=p_user AND s.id=p_session AND u.email_confirmed_at IS NOT NULL AND NOT u.is_anonymous AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()) AND (s.not_after IS NULL OR s.not_after>now()) AND m.status='active' AND NOT m.must_change_password)
   $$;
   INSERT INTO app_private.signup_settings VALUES (true,true);
  `);
  await pg.exec(sql);

  const user='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000001',intent='30000000-0000-4000-8000-000000000001',request='40000000-0000-4000-8000-000000000001';
  const user2='10000000-0000-4000-8000-000000000002',session2='20000000-0000-4000-8000-000000000002',intent2='30000000-0000-4000-8000-000000000002',request2='40000000-0000-4000-8000-000000000002';
  const hash='a'.repeat(64);
  for(const [u,s,i] of [[user,session,intent],[user2,session2,intent2]]) {
   await pg.query('INSERT INTO auth.users VALUES ($1,now(),false,null,null)',[u]);
   await pg.query('INSERT INTO auth.sessions VALUES ($1,$2,null)',[s,u]);
   await pg.query("INSERT INTO public.user_moderation VALUES ($1,'active',false)",[u]);
   await pg.query("INSERT INTO app_private.user_admission VALUES ($1,'unclassified','pending')",[u]);
   await pg.query("INSERT INTO app_private.signup_intents VALUES ($1,$2,$3,'bound',now()+interval '1 hour','terms-v1','privacy-v1', '{\"utm_source\":\"synthetic\"}'::jsonb,'origin-v1',now())",[i,u,hash]);
  }
  const query=async (sql,params=[]) => (await pg.query(sql,params)).rows[0];
  const snapshot=async()=>await query(`SELECT jsonb_build_object(
   'users',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) FROM auth.users t),
   'sessions',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) FROM auth.sessions t),
   'moderation',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.user_id),'[]'::jsonb) FROM public.user_moderation t),
   'admissions',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.user_id),'[]'::jsonb) FROM app_private.user_admission t),
   'settings',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.singleton),'[]'::jsonb) FROM app_private.signup_settings t),
   'intents',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) FROM app_private.signup_intents t),
   'fences',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.user_id),'[]'::jsonb) FROM app_private.signup_completion_fences_draft t)) AS state`);
  const denied=async(fn)=>{const before=await snapshot();await assert.rejects(fn,{code:'42501'});assert.deepEqual(await snapshot(),before);};
  const unchanged=async(fn,expected)=>{const before=await snapshot();assert.deepEqual(await fn(),expected);assert.deepEqual(await snapshot(),before);};
  const asRole=async(role,fn)=>{await pg.exec('SET ROLE '+role);try{return await fn();}finally{await pg.exec('RESET ROLE');}};
  const reserve='SELECT app_private.draft_reserve_completion($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result';
  const step=name=>`SELECT app_private.${name}($1,$2,$3,$4,$5,$6) AS result`;
  const args=[user,session,intent,hash,request,'terms-v1','privacy-v1',false,null];
  await denied(()=>query(reserve,[user,session2,intent,hash,request,'terms-v1','privacy-v1',false,null]));
  await denied(()=>query(reserve,[...args.slice(0,5),'bad-terms',...args.slice(6)]));
  for(const role of ['anon','authenticated']) {
   await denied(()=>asRole(role,()=>query(reserve,args)));
   await denied(()=>asRole(role,()=>query('SELECT * FROM app_private.signup_completion_fences_draft')));
  }
  await denied(()=>asRole('service_role',()=>query('SELECT * FROM app_private.signup_completion_fences_draft')));
  assert.deepEqual(await query('SELECT (SELECT count(*)::int FROM app_private.signup_completion_fences_draft) AS fences,(SELECT count(*)::int FROM app_private.signup_intents WHERE origin IS NOT NULL) AS origins'),{fences:0,origins:2});
  const acquired=(await asRole('service_role',()=>query(reserve,args))).result;
  assert.equal(acquired.status,'acquired');
  assert.equal(acquired.requestId,request);
  assert.equal((await query('SELECT origin IS NULL AS discarded FROM app_private.signup_intents WHERE id=$1',[intent])).discarded,true);
  await unchanged(async()=> (await query(reserve,args)).result,{status:'pending'});
  const fence=[user,session,intent,hash,request,acquired.generation];
  assert.equal((await query(step('draft_start_completion'),fence)).result,true);
  await unchanged(async()=> (await query(step('draft_start_completion'),fence)).result,false);
  assert.equal((await query(step('draft_mark_uncertain'),fence)).result,true);
  await unchanged(async()=> (await query(step('draft_ack_completion'),fence)).result,false);
  await unchanged(async()=> (await query(step('draft_start_completion'),fence)).result,false);
  await pg.query("UPDATE app_private.signup_intents SET expires_at=now()-interval '1 hour' WHERE id=$1",[intent]);
  await denied(()=>query(reserve,args));
  assert.equal((await query('SELECT phase FROM app_private.signup_completion_fences_draft WHERE user_id=$1',[user])).phase,'uncertain');

  const args2=[user2,session2,intent2,hash,request2,'terms-v1','privacy-v1',true,'origin-v1'];
  const acquired2=(await query(reserve,args2)).result;
  const fence2=[user2,session2,intent2,hash,request2,acquired2.generation];
  assert.equal((await query(step('draft_start_completion'),fence2)).result,true);
  await pg.query("UPDATE public.user_moderation SET status='blocked' WHERE user_id=$1",[user2]);
  await denied(()=>query(step('draft_ack_completion'),fence2));
  assert.equal((await query('SELECT phase FROM app_private.signup_completion_fences_draft WHERE user_id=$1',[user2])).phase,'auth_in_flight');
  await pg.query("UPDATE public.user_moderation SET status='active' WHERE user_id=$1",[user2]);
  assert.equal((await query(step('draft_ack_completion'),fence2)).result,true);
  assert.equal((await query('SELECT app_private.draft_withdraw_pending_origin($1,$2,$3,$4) AS result',[user2,session2,intent2,hash])).result,true);
  const consentSnapshot=await query('SELECT origin_accepted,origin_withdrawn,origin_consent_version FROM app_private.signup_completion_fences_draft WHERE user_id=$1',[user2]);
  assert.deepEqual(consentSnapshot,{origin_accepted:true,origin_withdrawn:true,origin_consent_version:'origin-v1'});
  assert.equal((await query('SELECT origin IS NULL AS discarded FROM app_private.signup_intents WHERE id=$1',[intent2])).discarded,true);
  const privileges=await query(`SELECT
    has_table_privilege('anon','app_private.signup_completion_fences_draft','SELECT') AS anon_read,
    has_table_privilege('authenticated','app_private.signup_completion_fences_draft','SELECT') AS auth_read,
    has_table_privilege('service_role','app_private.signup_completion_fences_draft','SELECT') AS service_read,
    has_function_privilege('anon','app_private.draft_start_completion(uuid,uuid,uuid,text,uuid,uuid)','EXECUTE') AS anon_execute,
    has_function_privilege('service_role','app_private.draft_start_completion(uuid,uuid,uuid,text,uuid,uuid)','EXECUTE') AS service_execute`);
  assert.deepEqual(privileges,{anon_read:false,auth_read:false,service_read:false,anon_execute:false,service_execute:true});
 } finally {await pg.close();}
}
