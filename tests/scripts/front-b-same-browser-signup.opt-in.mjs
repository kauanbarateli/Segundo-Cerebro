// Synthetic, disposable in-memory diagnostic. Not a provider or QA test.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {composeCandidate,scratch,rollout} from '../../scripts/verification/front-b-135-draft/compose-same-browser-v1.mjs';
if(process.env.FRONT_B_RUN_BROWSER_SIGNUP_PGLITE!=='1') throw Error('Explicit opt-in required');
const pg=new PGlite();
try {
 await pg.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA app_private; CREATE SCHEMA auth;
  GRANT USAGE ON SCHEMA app_private TO service_role;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb,raw_app_meta_data jsonb DEFAULT '{}');
  CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz);
  CREATE TABLE public.user_moderation(user_id uuid PRIMARY KEY,status text,must_change_password boolean);
  CREATE TABLE app_private.admin_operations(operation_id uuid PRIMARY KEY,target_user_id uuid,command text,phase text);
  CREATE TABLE app_private.signup_settings(singleton boolean PRIMARY KEY,enabled boolean);
  CREATE TABLE app_private.user_admission(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,origin text,state text,admitted_at timestamptz);
  CREATE TABLE app_private.signup_intents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),binding_hash text UNIQUE,subject_hash text,terms_version text,privacy_version text,expires_at timestamptz,state text DEFAULT 'pending',user_id uuid UNIQUE,origin jsonb,origin_consent_version text,origin_consented_at timestamptz,consumed_at timestamptz);
  CREATE TABLE app_private.signup_completion_fences_draft(user_id uuid PRIMARY KEY,intent_id uuid,origin_withdrawn boolean DEFAULT false,origin_expired boolean DEFAULT false,updated_at timestamptz DEFAULT now(),owner_session_id uuid,request_id uuid,generation uuid,phase text,terms_version text,privacy_version text,origin_accepted boolean DEFAULT false,origin_consent_version text);
  CREATE TABLE app_private.signup_password_proofs(intent_id uuid PRIMARY KEY,user_id uuid,session_id uuid,expires_at timestamptz,consumed_at timestamptz);
  CREATE TABLE app_private.signup_origins(user_id uuid PRIMARY KEY,origin jsonb,consent_version text,consented_at timestamptz,expires_at timestamptz);
  CREATE TABLE app_private.onboarding_entries(user_id uuid,source_operation uuid,source_kind text,source_intent uuid UNIQUE);
  CREATE TABLE app_private.events(user_id uuid,entity text);
  CREATE FUNCTION app_private.append_event(p uuid,e text,i uuid,a text,s text,n uuid,b jsonb) RETURNS void LANGUAGE sql AS $$ INSERT INTO app_private.events VALUES(p,e) $$;
  CREATE FUNCTION app_private.valid_signup_origin(o jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT jsonb_typeof(o)='object' $$;
  INSERT INTO app_private.signup_settings VALUES (true,false);
 `);
 const installed=await readFile(new URL('../../scripts/verification/front-b-135-draft/admission-feedback-metrics-atomic.sql.txt',import.meta.url),'utf8');
 for(const [start,end] of [['create function app_private.signup_intent_create(', '\nend $$;'],['create function app_private.signup_pending_identity(', '\n$$;'],['create function app_private.admission_new_identity()', '\nend $$;'],['create function app_private.admission_admin_completed()', '\nend $$;'],['CREATE FUNCTION app_private.draft_completion_context(', '\nEND $$;'],['CREATE FUNCTION app_private.draft_withdraw_identity(', '\n$$;'],['CREATE FUNCTION app_private.draft_withdraw_current(', '\nEND $$;'],['CREATE FUNCTION app_private.signup_prune()', '\nEND $$;'],['CREATE FUNCTION app_private.draft_confirm_complete(', '\nEND $$;'],['CREATE FUNCTION app_private.draft_finish_fenced(', '\nEND $$;'],['create function app_private.signup_recover_verified_intent(', '\nend $$;'],['create function public.signup_recover_verified_intent(', '$$;']]) {
  const from=installed.indexOf(start),to=installed.indexOf(end,from);assert.ok(from>=0 && to>=0);await pg.exec(installed.slice(from,to+end.length));
 }
 await pg.exec('REVOKE ALL ON FUNCTION app_private.signup_prune(),app_private.signup_recover_verified_intent(uuid,uuid,text,text,text),public.signup_recover_verified_intent(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION app_private.signup_prune(),app_private.signup_recover_verified_intent(uuid,uuid,text,text,text),public.signup_recover_verified_intent(uuid,uuid,text,text,text) TO service_role');
 await pg.exec('REVOKE ALL ON FUNCTION app_private.admission_new_identity() FROM PUBLIC,anon,authenticated,service_role');
 await pg.exec('CREATE TRIGGER second_brain_admission_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION app_private.admission_new_identity(); CREATE TRIGGER test_admin AFTER UPDATE OF phase ON app_private.admin_operations FOR EACH ROW EXECUTE FUNCTION app_private.admission_admin_completed()');
 // A pre-cutover account is not reclassified by the new default.
 await pg.query("INSERT INTO auth.users(id,email_confirmed_at,is_anonymous,raw_user_meta_data) VALUES('10000000-0000-4000-8000-000000000002',now(),false,'{}')");
 await pg.query("INSERT INTO auth.sessions VALUES('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',null)");
 await pg.query("INSERT INTO public.user_moderation VALUES('10000000-0000-4000-8000-000000000002','active',false)");
 const composition=await readFile(new URL('../../scripts/verification/front-b-135-draft/same-browser-composed-v1.guarded.sql.txt',import.meta.url),'utf8');
 assert.equal(composition,await composeCandidate());
 await assert.rejects(()=>pg.exec(composition),/UNREVIEWED SCRATCH SQL/);await pg.exec('ROLLBACK');
 assert.equal((await pg.query("SELECT to_regclass('app_private.signup_browser_attempts') AS name")).rows[0].name,null);
 await assert.rejects(()=>pg.exec(composition.replace(scratch,'')),/CLEANUP_WRITERS_NOT_PROVEN_PAUSED_AND_DRAINED/);await pg.exec('ROLLBACK');
 assert.equal((await pg.query("SELECT to_regclass('app_private.signup_browser_attempts') AS name")).rows[0].name,null);
 // A mismatched installed foundation must roll back the entire composed transaction.
 await pg.exec("CREATE OR REPLACE FUNCTION app_private.signup_prune() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN '{}'::jsonb; END $$;");
 await assert.rejects(()=>pg.exec(composition.replace(scratch,'').replace(rollout,'')),/RETENTION_FOUNDATION_REFUSED/);await pg.exec('ROLLBACK');
 assert.equal((await pg.query("SELECT to_regclass('app_private.signup_browser_attempts') AS name")).rows[0].name,null);
 const pruneStart=installed.indexOf('CREATE FUNCTION app_private.signup_prune()'),pruneEnd=installed.indexOf('\nEND $$;',pruneStart);assert.ok(pruneStart>=0&&pruneEnd>=0);
 await pg.exec(installed.slice(pruneStart,pruneEnd+'\nEND $$;'.length).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
 // Enabled signup and a changed public wrapper each refuse the whole candidate.
 await pg.exec("UPDATE app_private.signup_settings SET enabled=true WHERE singleton");
 await assert.rejects(()=>pg.exec(composition.replace(scratch,'').replace(rollout,'')),/RETENTION_FOUNDATION_REFUSED/);await pg.exec('ROLLBACK');
 assert.equal((await pg.query("SELECT to_regclass('app_private.signup_browser_attempts') AS name")).rows[0].name,null);
 await pg.exec("UPDATE app_private.signup_settings SET enabled=false WHERE singleton");
 await pg.exec("CREATE OR REPLACE FUNCTION public.signup_recover_verified_intent(p_user uuid,p_session uuid,p_subject_hash text,p_terms text,p_privacy text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT '{}'::jsonb $$;");
 await assert.rejects(()=>pg.exec(composition.replace(scratch,'').replace(rollout,'')),/RETENTION_FOUNDATION_REFUSED/);await pg.exec('ROLLBACK');
 assert.equal((await pg.query("SELECT to_regclass('app_private.signup_browser_attempts') AS name")).rows[0].name,null);
 const wrapperStart=installed.indexOf('create function public.signup_recover_verified_intent('),wrapperEnd=installed.indexOf('$$;',wrapperStart);assert.ok(wrapperStart>=0&&wrapperEnd>=0);
 await pg.exec(installed.slice(wrapperStart,wrapperEnd+3).replace('create function','CREATE OR REPLACE FUNCTION'));
 // These in-memory substitutions exist exclusively in this disposable diagnostic.
 await pg.exec(composition.replace(scratch,'').replace(rollout,''));
 await pg.exec("UPDATE app_private.signup_settings SET enabled=true WHERE singleton");
 // The existing verified Admin saga still admits its own accounts without public provenance.
 const adminUser='10000000-0000-4000-8000-000000000098',adminOp='30000000-0000-4000-8000-000000000098';
 await pg.query("INSERT INTO auth.users(id,email_confirmed_at,is_anonymous,raw_user_meta_data,raw_app_meta_data) VALUES($1,now(),false,'{}',$2)",[adminUser,JSON.stringify({sc_admin_operation:adminOp})]);
 await pg.query("INSERT INTO app_private.admin_operations VALUES($1,$2,'admin.user.create','started')",[adminOp,adminUser]);
 await pg.query("UPDATE app_private.admin_operations SET phase='complete' WHERE operation_id=$1",[adminOp]);
 assert.deepEqual((await pg.query('SELECT origin,state,signup_created_after_cutover FROM app_private.user_admission WHERE user_id=$1',[adminUser])).rows[0],{origin:'admin',state:'admitted',signup_created_after_cutover:true});
 await pg.query('DELETE FROM auth.users WHERE id=$1',[adminUser]);
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.user_admission WHERE user_id=$1',[adminUser])).rows[0].n,0);
 // Auth INSERT, admission, pointer binding and provenance commit or roll back together.
 await pg.exec('BEGIN');
 await pg.query("INSERT INTO auth.users VALUES('10000000-0000-4000-8000-000000000099',now(),false,null,null,'{}')");
 await pg.exec('ROLLBACK');
 assert.equal((await pg.query("SELECT count(*)::int n FROM app_private.user_admission WHERE user_id='10000000-0000-4000-8000-000000000099'")).rows[0].n,0);
 const user='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000001',pointer='p'.repeat(43),binding=createHash('sha256').update(pointer).digest('hex'),browser='a'.repeat(64),subject='b'.repeat(64);
 const prepare=async(b,br,origin)=> (await pg.query("SELECT app_private.signup_browser_prepare($1,$2,$3,'terms-v1','privacy-v1',now()+interval '30 minutes',$4,$5) AS id",[b,br,subject,origin,origin?'utm-v1':null])).rows[0].id;
 await assert.rejects(()=>prepare(binding,browser,null),{code:'42501'}); // Missing authoritative versions closes signup.
 await pg.exec("INSERT INTO app_private.signup_browser_legal_versions VALUES(true,'terms-v1','privacy-v1','utm-v1')");
 const intent=await prepare(binding,browser,JSON.stringify({utm_source:'synthetic'}));
 await pg.exec('BEGIN');
 await pg.query('INSERT INTO auth.users(id,email_confirmed_at,is_anonymous,raw_user_meta_data) VALUES($1,now(),false,$2)',['10000000-0000-4000-8000-000000000097',JSON.stringify({sc_signup_pointer:pointer})]);
 assert.equal((await pg.query("SELECT signup_created_after_cutover FROM app_private.user_admission WHERE user_id='10000000-0000-4000-8000-000000000097'")).rows[0].signup_created_after_cutover,true);
 await pg.exec('ROLLBACK');
 assert.deepEqual((await pg.query('SELECT state,user_id FROM app_private.signup_intents WHERE id=$1',[intent])).rows[0],{state:'pending',user_id:null});
 assert.equal((await pg.query("SELECT count(*)::int n FROM app_private.user_admission WHERE user_id='10000000-0000-4000-8000-000000000097'")).rows[0].n,0);
 await assert.rejects(()=>prepare('f'.repeat(64),browser,null),{code:'23505'}); // A new attempt needs a new secret.
 const find=async(br)=> (await pg.query('SELECT app_private.signup_browser_find($1) AS id',[br])).rows[0].id;
 assert.equal(await find(browser),null); // no provider INSERT yet; existing account cannot bind.
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[user,JSON.stringify({sc_signup_pointer:pointer})]);
 await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[session,user]);
 await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[user]);
 assert.deepEqual(await find(browser),{intentId:intent,userId:user,originPending:true});
 const recover=(u=user,s=session,t='terms-v1')=>pg.query("SELECT app_private.signup_browser_recover_bound($1,$2,$3,$4,'privacy-v1') AS result",[u,s,subject,t]);
 assert.deepEqual((await recover()).rows[0].result,{intentId:intent,termsVersion:'terms-v1',privacyVersion:'privacy-v1',state:'bound',originPending:true});
 await assert.rejects(()=>recover(user,session,'changed'),{code:'42501'});
 await pg.query("UPDATE app_private.signup_intents SET expires_at=now()-interval '1 second' WHERE id=$1",[intent]);await assert.rejects(()=>recover(),{code:'42501'});
 assert.deepEqual((await pg.query('SELECT origin FROM app_private.signup_intents WHERE id=$1',[intent])).rows[0].origin,{utm_source:'synthetic'});
 await pg.query("UPDATE app_private.signup_intents SET expires_at=now()+interval '30 minutes' WHERE id=$1",[intent]);
 const admit=(u=user,s=session,br=browser,terms='terms-v1',accept=true)=>pg.query("SELECT app_private.signup_browser_admit($1,$2,$3,$4,$5,$6,'privacy-v1',$7,'utm-v1') AS result",[u,s,intent,subject,br,terms,accept]);
 await assert.rejects(()=>admit(user,session,'d'.repeat(64)),{code:'42501'});
 await assert.rejects(()=>admit(user,session,browser,'old'),{code:'42501'});
 await pg.query("UPDATE public.user_moderation SET status='blocked' WHERE user_id=$1",[user]);await assert.rejects(()=>admit(),{code:'42501'});
 await pg.query("UPDATE public.user_moderation SET status='active' WHERE user_id=$1",[user]);
 const otherUser='10000000-0000-4000-8000-000000000002',otherSession='20000000-0000-4000-8000-000000000002';

 await assert.rejects(()=>admit(otherUser,otherSession),{code:'42501'});
 await pg.query('INSERT INTO app_private.signup_completion_fences_draft(user_id) VALUES($1)',[user]);await assert.rejects(()=>admit(),{code:'42501'});await assert.rejects(()=>recover(),{code:'42501'});await pg.query('DELETE FROM app_private.signup_completion_fences_draft WHERE user_id=$1',[user]);
 await pg.exec("UPDATE app_private.signup_browser_legal_versions SET terms_version='terms-v2'");await assert.rejects(()=>admit(),{code:'42501'});await pg.exec("UPDATE app_private.signup_browser_legal_versions SET terms_version='terms-v1'");
 assert.equal((await admit()).rows[0].result,true);assert.equal((await admit()).rows[0].result,true);
 assert.equal((await admit(user,session,browser,'terms-v1',false)).rows[0].result,false);
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.onboarding_entries')).rows[0].n,1);
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_origins')).rows[0].n,1);
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.events')).rows[0].n,3);
 assert.deepEqual((await pg.query('SELECT app_private.draft_withdraw_current($1,$2) result',[user,session])).rows[0].result,{status:'withdrawn'});
 assert.equal((await admit()).rows[0].result,true); // A retry cannot restore withdrawn origin.
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_origins WHERE user_id=$1',[user])).rows[0].n,0);
 const user3='10000000-0000-4000-8000-000000000003',session3='20000000-0000-4000-8000-000000000003',pointer3='q'.repeat(43),browser3='e'.repeat(64),binding3=createHash('sha256').update(pointer3).digest('hex');
 const intent3=await prepare(binding3,browser3,JSON.stringify({utm_source:'discard-me'}));
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[user3,JSON.stringify({sc_signup_pointer:pointer3})]);
 await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[session3,user3]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[user3]);
 assert.equal((await pg.query("SELECT app_private.signup_browser_admit($1,$2,$3,$4,$5,'terms-v1','privacy-v1',false,'utm-v1') AS result",[user3,session3,intent3,subject,browser3])).rows[0].result,true);
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_origins WHERE user_id=$1',[user3])).rows[0].n,0);
 assert.equal((await pg.query('SELECT origin FROM app_private.signup_intents WHERE id=$1',[intent3])).rows[0].origin,null);
 const user4='10000000-0000-4000-8000-000000000004',session4='20000000-0000-4000-8000-000000000004',pointer4='r'.repeat(43),browser4='9'.repeat(64),binding4=createHash('sha256').update(pointer4).digest('hex');
 const intent4=await prepare(binding4,browser4,JSON.stringify({utm_source:'withdraw-before'}));
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[user4,JSON.stringify({sc_signup_pointer:pointer4})]);
 await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[session4,user4]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[user4]);
 assert.deepEqual((await pg.query('SELECT app_private.draft_withdraw_current($1,$2) result',[user4,session4])).rows[0].result,{status:'withdrawn'});
 assert.equal((await pg.query("SELECT app_private.signup_browser_admit($1,$2,$3,$4,$5,'terms-v1','privacy-v1',true,'utm-v1') AS result",[user4,session4,intent4,subject,browser4])).rows[0].result,true);
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_origins WHERE user_id=$1',[user4])).rows[0].n,0);
 assert.deepEqual(await find(browser4),{intentId:intent4,userId:user4,originPending:false});
 // Synthetic duplicate model only: GoTrue is not running in this diagnostic.
 const user5='10000000-0000-4000-8000-000000000005',pointer5='s'.repeat(43),browser5='7'.repeat(64),binding5=createHash('sha256').update(pointer5).digest('hex'),pointer6='t'.repeat(43),browser6='8'.repeat(64),binding6=createHash('sha256').update(pointer6).digest('hex');
 const intent5=await prepare(binding5,browser5,JSON.stringify({utm_source:'first'}));const intent6=await prepare(binding6,browser6,JSON.stringify({utm_source:'duplicate'}));
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[user5,JSON.stringify({sc_signup_pointer:pointer5})]);
 assert.deepEqual(await find(browser5),{intentId:intent5,userId:user5,originPending:true});
 assert.equal(await find(browser6),null); // No second INSERT, so the duplicate intent cannot bind.
 const duplicate=(await pg.query('SELECT state,user_id,origin FROM app_private.signup_intents WHERE id=$1',[intent6])).rows[0];assert.equal(duplicate.state,'pending');assert.equal(duplicate.user_id,null);
 assert.deepEqual((await pg.query('SELECT origin FROM app_private.signup_intents WHERE id=$1',[intent5])).rows[0].origin,{utm_source:'first'});
 // Missing public-attempt provenance must not allow renewal of an older account.
 const session5='20000000-0000-4000-8000-000000000005';await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[session5,user5]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[user5]);
 await pg.query("UPDATE app_private.signup_intents SET expires_at=now()-interval '1 second' WHERE id=$1",[intent5]);await pg.query('DELETE FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent5]);
 assert.equal((await pg.query("SELECT app_private.signup_browser_reconsent_probe($1,$2,$3,'terms-v1','privacy-v1') result",[user5,session5,subject])).rows[0].result,null);
 await assert.rejects(()=>pg.query("SELECT app_private.signup_browser_renew($1,$2,$3,$4,'terms-v1','privacy-v1',false,'utm-v1',clock_timestamp()+interval '10 minutes')",[user5,session5,intent5,subject]),{code:'42501'});
 assert.deepEqual((await pg.query('SELECT origin FROM app_private.signup_intents WHERE id=$1',[intent5])).rows[0].origin,{utm_source:'first'});
 const user6='10000000-0000-4000-8000-000000000006',session6='20000000-0000-4000-8000-000000000006',pointer7='u'.repeat(43),browser7='6'.repeat(64),binding7=createHash('sha256').update(pointer7).digest('hex');
 const intent7=await prepare(binding7,browser7,JSON.stringify({utm_source:'explicit'}));
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[user6,JSON.stringify({sc_signup_pointer:pointer7})]);await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[session6,user6]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[user6]);
 await pg.query("UPDATE app_private.signup_intents SET expires_at=now()-interval '1 second' WHERE id=$1",[intent7]);
 const probe=()=>pg.query("SELECT app_private.signup_browser_reconsent_probe($1,$2,$3,'terms-v1','privacy-v1') result",[user6,session6,subject]);
 const renew=(keep=false,terms='terms-v1')=>pg.query("SELECT app_private.signup_browser_renew($1,$2,$3,$4,$5,'privacy-v1',$6,'utm-v1',clock_timestamp()+interval '10 minutes') result",[user6,session6,intent7,subject,terms,keep]);
 assert.deepEqual((await probe()).rows[0].result,{intentId:intent7,originPending:false});
 // A server-authenticated checkpoint deadline is checked by SQL after its locks.
 for(const deadline of [null,'2000-01-01T00:00:00.000Z','infinity']) {
  await assert.rejects(()=>pg.query("SELECT app_private.signup_browser_renew($1,$2,$3,$4,'terms-v1','privacy-v1',false,'utm-v1',$5::timestamptz)",[user6,session6,intent7,subject,deadline]),{code:'42501'});
 }
 assert.equal((await pg.query('SELECT requires_password FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent7])).rows[0].requires_password,false);
 // Force expiry after the first check but before renewal completes; all writes must roll back.
 await pg.exec("CREATE FUNCTION app_private.test_slow_renew_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.25); RETURN NEW; END $$; CREATE TRIGGER test_slow_renew_event BEFORE INSERT ON app_private.events FOR EACH ROW EXECUTE FUNCTION app_private.test_slow_renew_event()");
 const oldIntent=(await pg.query('SELECT expires_at,origin,terms_version FROM app_private.signup_intents WHERE id=$1',[intent7])).rows[0];
 const oldEvents=(await pg.query('SELECT count(*)::int n FROM app_private.events WHERE user_id=$1',[user6])).rows[0].n;
 await assert.rejects(()=>pg.query("SELECT app_private.signup_browser_renew($1,$2,$3,$4,'terms-v1','privacy-v1',false,'utm-v1',clock_timestamp()+interval '100 milliseconds')",[user6,session6,intent7,subject]),{code:'42501'});
 assert.deepEqual((await pg.query('SELECT expires_at,origin,terms_version FROM app_private.signup_intents WHERE id=$1',[intent7])).rows[0],oldIntent);
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.events WHERE user_id=$1',[user6])).rows[0].n,oldEvents);
 assert.equal((await pg.query('SELECT requires_password FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent7])).rows[0].requires_password,false);
 await pg.exec('DROP TRIGGER test_slow_renew_event ON app_private.events; DROP FUNCTION app_private.test_slow_renew_event()');

 await assert.rejects(()=>renew(false,'old'),{code:'42501'});assert.deepEqual((await pg.query('SELECT origin FROM app_private.signup_intents WHERE id=$1',[intent7])).rows[0].origin,{utm_source:'explicit'});
 await pg.query('INSERT INTO app_private.signup_completion_fences_draft(user_id) VALUES($1)',[user6]);await assert.rejects(()=>renew(),{code:'42501'});await pg.query('DELETE FROM app_private.signup_completion_fences_draft WHERE user_id=$1',[user6]);
 assert.deepEqual((await renew(true)).rows[0].result,{status:'renewed',originPending:false}); // Expired origin cannot be revived.
 assert.equal((await pg.query('SELECT origin FROM app_private.signup_intents WHERE id=$1',[intent7])).rows[0].origin,null);
 assert.deepEqual((await pg.query("SELECT app_private.signup_browser_recover_bound($1,$2,$3,'terms-v1','privacy-v1') result",[user6,session6,subject])).rows[0].result,{intentId:intent7,termsVersion:'terms-v1',privacyVersion:'privacy-v1',state:'bound',originPending:false});
 assert.equal((await pg.query('SELECT requires_password FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent7])).rows[0].requires_password,true);
 await assert.rejects(()=>pg.query("SELECT app_private.signup_browser_admit($1,$2,$3,$4,$5,'terms-v1','privacy-v1',false,'utm-v1')",[user6,session6,intent7,subject,browser7]),{code:'42501'});
 await assert.rejects(()=>renew(),{code:'42501'}); // no silent replay or second modification
 // A renewal just before the 24h boundary retains provenance beyond that boundary.
 await pg.query("UPDATE app_private.signup_browser_attempts SET expires_at=now()-interval '25 hours' WHERE intent_id=$1",[intent7]);
 assert.equal((await pg.query('SELECT app_private.signup_browser_prune(1000) result')).rows[0].result,1);
 assert.deepEqual((await pg.query('SELECT browser_hash,requires_password FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent7])).rows[0],{browser_hash:null,requires_password:true});
 assert.deepEqual((await pg.query("SELECT app_private.signup_browser_recover_bound($1,$2,$3,'terms-v1','privacy-v1') result",[user6,session6,subject])).rows[0].result,{intentId:intent7,termsVersion:'terms-v1',privacyVersion:'privacy-v1',state:'bound',originPending:false});
 await assert.rejects(()=>pg.query("SELECT app_private.signup_recover_verified_intent($1,$2,$3,'terms-v1','privacy-v1')",[user6,session6,subject]),{code:'42501'});
 const user7='10000000-0000-4000-8000-000000000007',session7='20000000-0000-4000-8000-000000000007',pointer8='v'.repeat(43),browser8='5'.repeat(64),binding8=createHash('sha256').update(pointer8).digest('hex');
 const intent8=await prepare(binding8,browser8,JSON.stringify({utm_source:'keep-explicit'}));
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[user7,JSON.stringify({sc_signup_pointer:pointer8})]);await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[session7,user7]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[user7]);
 await pg.exec("UPDATE app_private.signup_browser_legal_versions SET terms_version='terms-v2',origin_version='utm-v2'");
 assert.deepEqual((await pg.query("SELECT app_private.signup_browser_reconsent_probe($1,$2,$3,'terms-v2','privacy-v1') result",[user7,session7,subject])).rows[0].result,{intentId:intent8,originPending:true});
 assert.deepEqual((await pg.query("SELECT app_private.signup_browser_renew($1,$2,$3,$4,'terms-v2','privacy-v1',true,'utm-v2',clock_timestamp()+interval '10 minutes') result",[user7,session7,intent8,subject])).rows[0].result,{status:'renewed',originPending:true});
 assert.deepEqual((await pg.query('SELECT terms_version,origin,origin_consent_version FROM app_private.signup_intents WHERE id=$1',[intent8])).rows[0],{terms_version:'terms-v2',origin:{utm_source:'keep-explicit'},origin_consent_version:'utm-v2'});
 await pg.query("UPDATE app_private.signup_browser_attempts SET expires_at=now()-interval '1 second' WHERE intent_id=$1",[intent3]);
 assert.equal(await find(browser3),null);
 assert.equal((await pg.query('SELECT app_private.signup_browser_prune(1) result')).rows[0].result,0);
 await pg.query("UPDATE app_private.signup_browser_attempts SET expires_at=now()-interval '25 hours' WHERE intent_id=$1",[intent3]);
 assert.equal((await pg.query('SELECT app_private.signup_browser_prune(1) result')).rows[0].result,1);
 assert.deepEqual((await pg.query('SELECT browser_hash,consumed_at IS NOT NULL AS consumed FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent3])).rows[0],{browser_hash:null,consumed:true}); // Marker remains, while the expired hash is scrubbed.
 await assert.rejects(()=>pg.query('SELECT app_private.signup_browser_prune(0)'),{code:'22023'});
 // Recovery retention is independently guarded and never extends expired UTM retention.
 const user8='10000000-0000-4000-8000-000000000008',session8='20000000-0000-4000-8000-000000000008',pointer9='w'.repeat(43),browser9='4'.repeat(64),binding9=createHash('sha256').update(pointer9).digest('hex');
 await pg.exec("UPDATE app_private.signup_browser_legal_versions SET terms_version='terms-v1',origin_version='utm-v1'");
 const intent9=await prepare(binding9,browser9,JSON.stringify({utm_source:'expires-on-time'}));
 await pg.exec("UPDATE app_private.signup_browser_legal_versions SET terms_version='terms-v2',origin_version='utm-v2'");
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[user8,JSON.stringify({sc_signup_pointer:pointer9})]);await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[session8,user8]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[user8]);
 await pg.query("UPDATE app_private.signup_intents SET expires_at=now()-interval '1 second' WHERE id=$1",[intent9]);
 await assert.rejects(()=>pg.query("SELECT app_private.signup_recover_verified_intent($1,$2,$3,'terms-v2','privacy-v1')",[user8,session8,subject]),{code:'42501'});
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_intents WHERE id=$1',[intent9])).rows[0].n,1);
 // A true new-flow flag survives marker loss, while a legacy pending account remains eligible.
 assert.equal((await pg.query('SELECT signup_created_after_cutover FROM app_private.user_admission WHERE user_id=$1',[user5])).rows[0].signup_created_after_cutover,true);
 await assert.rejects(()=>pg.query("SELECT app_private.signup_recover_verified_intent($1,$2,$3,'terms-v2','privacy-v1')",[user5,session5,subject]),{code:'42501'});
 assert.equal((await pg.query('SELECT signup_created_after_cutover FROM app_private.user_admission WHERE user_id=$1',[otherUser])).rows[0].signup_created_after_cutover,false);
 assert.equal((await pg.query("SELECT (app_private.signup_recover_verified_intent($1,$2,$3,'terms-v2','privacy-v1')->>'state') state",[otherUser,otherSession,subject])).rows[0].state,'bound');
 await pg.query('SELECT app_private.signup_prune()');
 assert.deepEqual((await pg.query('SELECT state,origin,origin_consent_version,origin_consented_at FROM app_private.signup_intents WHERE id=$1',[intent9])).rows[0],{state:'bound',origin:null,origin_consent_version:null,origin_consented_at:null});
 assert.deepEqual((await pg.query("SELECT app_private.signup_browser_reconsent_probe($1,$2,$3,'terms-v2','privacy-v1') result",[user8,session8,subject])).rows[0].result,{intentId:intent9,originPending:false});
 // Repeated cleanup should not let protected rows monopolize the bounded batch.
 await pg.query('SELECT app_private.signup_prune()');
 await pg.query("UPDATE app_private.signup_browser_attempts SET expires_at=now()-interval '25 hours' WHERE intent_id=$1",[intent9]);
 assert.equal((await pg.query('SELECT app_private.signup_browser_prune(1000) result')).rows[0].result,1);
 assert.equal((await pg.query('SELECT browser_hash FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent9])).rows[0].browser_hash,null);
 await assert.rejects(()=>pg.query("SELECT app_private.signup_recover_verified_intent($1,$2,$3,'terms-v2','privacy-v1')",[user8,session8,subject]),{code:'42501'});
 await pg.query('SELECT app_private.signup_prune()');
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_intents WHERE id=$1',[intent9])).rows[0].n,0);
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent9])).rows[0].n,0);
 assert.equal((await pg.query('SELECT signup_created_after_cutover FROM app_private.user_admission WHERE user_id=$1',[user8])).rows[0].signup_created_after_cutover,true);
 await assert.rejects(()=>pg.query("SELECT public.signup_recover_verified_intent($1,$2,$3,'terms-v2','privacy-v1')",[user8,session8,subject]),{code:'42501'});
 // A preexisting uncertainty fence survives even beyond the recovery window.
 const user9='10000000-0000-4000-8000-000000000009',pointer10='x'.repeat(43),browser10='3'.repeat(64),binding10=createHash('sha256').update(pointer10).digest('hex');
 await pg.exec("UPDATE app_private.signup_browser_legal_versions SET terms_version='terms-v1',origin_version='utm-v1'");
 const intent10=await prepare(binding10,browser10,JSON.stringify({utm_source:'fenced'}));
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[user9,JSON.stringify({sc_signup_pointer:pointer10})]);
 await pg.query('INSERT INTO app_private.signup_completion_fences_draft(user_id,intent_id) VALUES($1,$2)',[user9,intent10]);
 await pg.query("UPDATE app_private.signup_intents SET expires_at=now()-interval '25 hours' WHERE id=$1",[intent10]);
 await pg.query("UPDATE app_private.signup_browser_attempts SET expires_at=now()-interval '25 hours' WHERE intent_id=$1",[intent10]);
 await pg.query('SELECT app_private.signup_prune()');
 assert.equal((await pg.query('SELECT origin FROM app_private.signup_intents WHERE id=$1',[intent10])).rows[0].origin,null);
 assert.equal((await pg.query('SELECT origin_expired FROM app_private.signup_completion_fences_draft WHERE user_id=$1',[user9])).rows[0].origin_expired,true);
 assert.equal((await pg.query('SELECT app_private.signup_browser_prune(1000) result')).rows[0].result,1);
 assert.equal((await pg.query('SELECT browser_hash FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent10])).rows[0].browser_hash,null);
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_completion_fences_draft WHERE user_id=$1 AND intent_id=$2',[user9,intent10])).rows[0].n,1);
 assert.equal((await pg.query('SELECT state FROM app_private.signup_intents WHERE id=$1',[intent10])).rows[0].state,'bound');
 assert.equal((await pg.query('SELECT signup_created_after_cutover FROM app_private.user_admission WHERE user_id=$1',[user9])).rows[0].signup_created_after_cutover,true);
 // Delayed Auth INSERT after intent and provenance have expired and been pruned.
 const late='10000000-0000-4000-8000-000000000011',lateSession='20000000-0000-4000-8000-000000000011',latePointer='y'.repeat(43),lateHash=createHash('sha256').update(latePointer).digest('hex');
 const lateIntent=await prepare(lateHash,'2'.repeat(64),null);
 await pg.query("UPDATE app_private.signup_intents SET expires_at=now()-interval '1 second' WHERE id=$1",[lateIntent]);
 await pg.query('SELECT app_private.signup_prune()');
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_intents WHERE id=$1',[lateIntent])).rows[0].n,0);
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[late,JSON.stringify({sc_signup_pointer:latePointer})]);
 await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[lateSession,late]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[late]);
 assert.equal((await pg.query('SELECT signup_created_after_cutover FROM app_private.user_admission WHERE user_id=$1',[late])).rows[0].signup_created_after_cutover,true);
 await assert.rejects(()=>pg.query("SELECT public.signup_recover_verified_intent($1,$2,$3,'terms-v1','privacy-v1')",[late,lateSession,subject]),{code:'42501'});
 // A new unclassified INSERT with no pointer is also protected against the legacy writer.
 const direct='10000000-0000-4000-8000-000000000012',directSession='20000000-0000-4000-8000-000000000012';
 await pg.query("INSERT INTO auth.users VALUES($1,now(),false,null,null,'{}')",[direct]);await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[directSession,direct]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[direct]);
 assert.equal((await pg.query('SELECT signup_created_after_cutover FROM app_private.user_admission WHERE user_id=$1',[direct])).rows[0].signup_created_after_cutover,true);
 await assert.rejects(()=>pg.query("SELECT public.signup_recover_verified_intent($1,$2,$3,'terms-v1','privacy-v1')",[direct,directSession,subject]),{code:'42501'});
 // Exercise the installed 028 fenced-password finish: it consumes the intent but not the attempt.
 const pw='10000000-0000-4000-8000-000000000013',pwSession='20000000-0000-4000-8000-000000000013',pwPointer='z'.repeat(43),pwHash=createHash('sha256').update(pwPointer).digest('hex'),req='30000000-0000-4000-8000-000000000013',gen='40000000-0000-4000-8000-000000000013';
 const pwIntent=await prepare(pwHash,'1'.repeat(64),null);
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[pw,JSON.stringify({sc_signup_pointer:pwPointer})]);await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[pwSession,pw]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[pw]);
 await pg.query("INSERT INTO app_private.signup_completion_fences_draft(user_id,intent_id,owner_session_id,request_id,generation,phase,terms_version,privacy_version,origin_accepted) VALUES($1,$2,$3,$4,$5,'password_acknowledged','terms-v1','privacy-v1',false)",[pw,pwIntent,pwSession,req,gen]);
 await pg.query("INSERT INTO app_private.signup_password_proofs VALUES($1,$2,$3,now()+interval '10 minutes',null)",[pwIntent,pw,pwSession]);
 assert.equal((await pg.query("SELECT app_private.draft_finish_fenced($1,$2,$3,$4,$5,$6,'terms-v1','privacy-v1','utm-v1') result",[pw,pwSession,pwIntent,subject,req,gen])).rows[0].result,true);
 assert.equal((await pg.query('SELECT consumed_at FROM app_private.signup_browser_attempts WHERE intent_id=$1',[pwIntent])).rows[0].consumed_at,null);
 await pg.query("UPDATE app_private.signup_browser_attempts SET expires_at=now()-interval '25 hours' WHERE intent_id=$1",[pwIntent]);
 assert.equal((await pg.query('SELECT app_private.signup_browser_prune(1000) result')).rows[0].result,1);
 assert.deepEqual((await pg.query('SELECT browser_hash,consumed_at FROM app_private.signup_browser_attempts WHERE intent_id=$1',[pwIntent])).rows[0],{browser_hash:null,consumed_at:null});
 const privileges=(await pg.query("SELECT has_function_privilege('anon','public.signup_browser_admit(uuid,uuid,uuid,text,text,text,text,boolean,text)','EXECUTE') AS anon,has_function_privilege('authenticated','public.signup_browser_admit(uuid,uuid,uuid,text,text,text,text,boolean,text)','EXECUTE') AS auth,has_function_privilege('service_role','public.signup_browser_admit(uuid,uuid,uuid,text,text,text,text,boolean,text)','EXECUTE') AS service")).rows[0];assert.deepEqual(privileges,{anon:false,auth:false,service:true});
 console.log('Synthetic same-browser signup diagnostic passed.');
} finally {await pg.close();}
