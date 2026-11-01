// Synthetic, disposable in-memory diagnostic. Not a provider or QA test.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
if(process.env.FRONT_B_RUN_BROWSER_SIGNUP_PGLITE!=='1') throw Error('Explicit opt-in required');
const pg=new PGlite();
try {
 await pg.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA app_private; CREATE SCHEMA auth;
  GRANT USAGE ON SCHEMA app_private TO service_role;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb);
  CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz);
  CREATE TABLE public.user_moderation(user_id uuid PRIMARY KEY,status text,must_change_password boolean);
  CREATE TABLE app_private.signup_settings(singleton boolean PRIMARY KEY,enabled boolean);
  CREATE TABLE app_private.user_admission(user_id uuid PRIMARY KEY,origin text,state text,admitted_at timestamptz);
  CREATE TABLE app_private.signup_intents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),binding_hash text UNIQUE,subject_hash text,terms_version text,privacy_version text,expires_at timestamptz,state text DEFAULT 'pending',user_id uuid UNIQUE,origin jsonb,origin_consent_version text,origin_consented_at timestamptz,consumed_at timestamptz);
  CREATE TABLE app_private.signup_completion_fences_draft(user_id uuid PRIMARY KEY,intent_id uuid,origin_withdrawn boolean DEFAULT false,origin_expired boolean DEFAULT false,updated_at timestamptz DEFAULT now());
  CREATE TABLE app_private.signup_origins(user_id uuid PRIMARY KEY,origin jsonb,consent_version text,consented_at timestamptz,expires_at timestamptz);
  CREATE TABLE app_private.onboarding_entries(user_id uuid,source_operation uuid,source_kind text,source_intent uuid UNIQUE);
  CREATE TABLE app_private.events(user_id uuid,entity text);
  CREATE FUNCTION app_private.append_event(p uuid,e text,i uuid,a text,s text,n uuid,b jsonb) RETURNS void LANGUAGE sql AS $$ INSERT INTO app_private.events VALUES(p,e) $$;
  CREATE FUNCTION app_private.valid_signup_origin(o jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT jsonb_typeof(o)='object' $$;
  INSERT INTO app_private.signup_settings VALUES (true,true);
 `);
 const installed=await readFile(new URL('../../scripts/verification/front-b-135-draft/admission-feedback-metrics-atomic.sql.txt',import.meta.url),'utf8');
 for(const [start,end] of [['create function app_private.signup_intent_create(', '\nend $$;'],['create function app_private.signup_pending_identity(', '\n$$;'],['create function app_private.admission_new_identity()', '\nend $$;'],['CREATE FUNCTION app_private.draft_completion_context(', '\nEND $$;'],['CREATE FUNCTION app_private.draft_withdraw_identity(', '\n$$;'],['CREATE FUNCTION app_private.draft_withdraw_current(', '\nEND $$;'],['CREATE FUNCTION app_private.signup_prune()', '\nEND $$;'],['create function app_private.signup_recover_verified_intent(', '\nend $$;']]) {
  const from=installed.indexOf(start),to=installed.indexOf(end,from);assert.ok(from>=0 && to>=0);await pg.exec(installed.slice(from,to+end.length));
 }
 await pg.exec('REVOKE ALL ON FUNCTION app_private.signup_prune(),app_private.signup_recover_verified_intent(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION app_private.signup_prune(),app_private.signup_recover_verified_intent(uuid,uuid,text,text,text) TO service_role');
 await pg.exec('CREATE TRIGGER test_admission AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION app_private.admission_new_identity()');
 const draft=await readFile(new URL('../../scripts/verification/front-b-135-draft/same-browser-signup.guarded.sql.txt',import.meta.url),'utf8');
 const guard="DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;";assert.equal(draft.split(guard).length,2);await pg.exec(draft.replace(guard,''));
 const retention=await readFile(new URL('../../scripts/verification/front-b-135-draft/same-browser-retention.guarded.sql.txt',import.meta.url),'utf8');assert.equal(retention.split(guard).length,2);const rolloutBlock="DO $rollout_block$ BEGIN RAISE EXCEPTION 'CLEANUP_WRITERS_NOT_PROVEN_PAUSED_AND_DRAINED'; END $rollout_block$;";assert.equal(retention.split(rolloutBlock).length,2);await pg.exec(retention.replace(guard,'').replace(rolloutBlock,''));
 const user='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000001',pointer='p'.repeat(43),binding=createHash('sha256').update(pointer).digest('hex'),browser='a'.repeat(64),subject='b'.repeat(64);
 const prepare=async(b,br,origin)=> (await pg.query("SELECT app_private.signup_browser_prepare($1,$2,$3,'terms-v1','privacy-v1',now()+interval '30 minutes',$4,$5) AS id",[b,br,subject,origin,origin?'utm-v1':null])).rows[0].id;
 await assert.rejects(()=>prepare(binding,browser,null),{code:'42501'}); // Missing authoritative versions closes signup.
 await pg.exec("INSERT INTO app_private.signup_browser_legal_versions VALUES(true,'terms-v1','privacy-v1','utm-v1')");
 const intent=await prepare(binding,browser,JSON.stringify({utm_source:'synthetic'}));
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
 await pg.query("INSERT INTO auth.users VALUES($1,now(),false,null,null,'{}')",[otherUser]);await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[otherSession,otherUser]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[otherUser]);
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
 await assert.rejects(()=>pg.query("SELECT app_private.signup_browser_renew($1,$2,$3,$4,'terms-v1','privacy-v1',false,'utm-v1')",[user5,session5,intent5,subject]),{code:'42501'});
 assert.deepEqual((await pg.query('SELECT origin FROM app_private.signup_intents WHERE id=$1',[intent5])).rows[0].origin,{utm_source:'first'});
 const user6='10000000-0000-4000-8000-000000000006',session6='20000000-0000-4000-8000-000000000006',pointer7='u'.repeat(43),browser7='6'.repeat(64),binding7=createHash('sha256').update(pointer7).digest('hex');
 const intent7=await prepare(binding7,browser7,JSON.stringify({utm_source:'explicit'}));
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[user6,JSON.stringify({sc_signup_pointer:pointer7})]);await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[session6,user6]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[user6]);
 await pg.query("UPDATE app_private.signup_intents SET expires_at=now()-interval '1 second' WHERE id=$1",[intent7]);
 const probe=()=>pg.query("SELECT app_private.signup_browser_reconsent_probe($1,$2,$3,'terms-v1','privacy-v1') result",[user6,session6,subject]);
 const renew=(keep=false,terms='terms-v1')=>pg.query("SELECT app_private.signup_browser_renew($1,$2,$3,$4,$5,'privacy-v1',$6,'utm-v1') result",[user6,session6,intent7,subject,terms,keep]);
 assert.deepEqual((await probe()).rows[0].result,{intentId:intent7,originPending:false});
 await assert.rejects(()=>renew(false,'old'),{code:'42501'});assert.deepEqual((await pg.query('SELECT origin FROM app_private.signup_intents WHERE id=$1',[intent7])).rows[0].origin,{utm_source:'explicit'});
 await pg.query('INSERT INTO app_private.signup_completion_fences_draft(user_id) VALUES($1)',[user6]);await assert.rejects(()=>renew(),{code:'42501'});await pg.query('DELETE FROM app_private.signup_completion_fences_draft WHERE user_id=$1',[user6]);
 assert.deepEqual((await renew(true)).rows[0].result,{status:'renewed',originPending:false}); // Expired origin cannot be revived.
 assert.equal((await pg.query('SELECT origin FROM app_private.signup_intents WHERE id=$1',[intent7])).rows[0].origin,null);
 assert.deepEqual((await pg.query("SELECT app_private.signup_browser_recover_bound($1,$2,$3,'terms-v1','privacy-v1') result",[user6,session6,subject])).rows[0].result,{intentId:intent7,termsVersion:'terms-v1',privacyVersion:'privacy-v1',state:'bound',originPending:false});
 assert.equal((await pg.query('SELECT requires_password FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent7])).rows[0].requires_password,true);
 await assert.rejects(()=>pg.query("SELECT app_private.signup_browser_admit($1,$2,$3,$4,$5,'terms-v1','privacy-v1',false,'utm-v1')",[user6,session6,intent7,subject,browser7]),{code:'42501'});
 await assert.rejects(()=>renew(),{code:'42501'}); // no silent replay or second modification
 const user7='10000000-0000-4000-8000-000000000007',session7='20000000-0000-4000-8000-000000000007',pointer8='v'.repeat(43),browser8='5'.repeat(64),binding8=createHash('sha256').update(pointer8).digest('hex');
 const intent8=await prepare(binding8,browser8,JSON.stringify({utm_source:'keep-explicit'}));
 await pg.query('INSERT INTO auth.users VALUES($1,now(),false,null,null,$2)',[user7,JSON.stringify({sc_signup_pointer:pointer8})]);await pg.query('INSERT INTO auth.sessions VALUES($1,$2,null)',[session7,user7]);await pg.query("INSERT INTO public.user_moderation VALUES($1,'active',false)",[user7]);
 await pg.exec("UPDATE app_private.signup_browser_legal_versions SET terms_version='terms-v2',origin_version='utm-v2'");
 assert.deepEqual((await pg.query("SELECT app_private.signup_browser_reconsent_probe($1,$2,$3,'terms-v2','privacy-v1') result",[user7,session7,subject])).rows[0].result,{intentId:intent8,originPending:true});
 assert.deepEqual((await pg.query("SELECT app_private.signup_browser_renew($1,$2,$3,$4,'terms-v2','privacy-v1',true,'utm-v2') result",[user7,session7,intent8,subject])).rows[0].result,{status:'renewed',originPending:true});
 assert.deepEqual((await pg.query('SELECT terms_version,origin,origin_consent_version FROM app_private.signup_intents WHERE id=$1',[intent8])).rows[0],{terms_version:'terms-v2',origin:{utm_source:'keep-explicit'},origin_consent_version:'utm-v2'});
 await pg.query("UPDATE app_private.signup_browser_attempts SET expires_at=now()-interval '1 second' WHERE intent_id=$1",[intent3]);
 assert.equal(await find(browser3),null);
 assert.equal((await pg.query('SELECT app_private.signup_browser_prune(1) result')).rows[0].result,0);
 await pg.query("UPDATE app_private.signup_browser_attempts SET expires_at=now()-interval '25 hours' WHERE intent_id=$1",[intent3]);
 assert.equal((await pg.query('SELECT app_private.signup_browser_prune(1) result')).rows[0].result,1);
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
 // A legacy pending account with no new-browser marker keeps the old continuation path.
 assert.equal((await pg.query("SELECT (app_private.signup_recover_verified_intent($1,$2,$3,'terms-v2','privacy-v1')->>'state') state",[user5,session5,subject])).rows[0].state,'bound');
 await pg.query('SELECT app_private.signup_prune()');
 assert.deepEqual((await pg.query('SELECT state,origin,origin_consent_version,origin_consented_at FROM app_private.signup_intents WHERE id=$1',[intent9])).rows[0],{state:'bound',origin:null,origin_consent_version:null,origin_consented_at:null});
 assert.deepEqual((await pg.query("SELECT app_private.signup_browser_reconsent_probe($1,$2,$3,'terms-v2','privacy-v1') result",[user8,session8,subject])).rows[0].result,{intentId:intent9,originPending:false});
 // Repeated cleanup should not let protected rows monopolize the bounded batch.
 await pg.query('SELECT app_private.signup_prune()');
 await pg.query("UPDATE app_private.signup_browser_attempts SET expires_at=now()-interval '25 hours' WHERE intent_id=$1",[intent9]);
 await pg.query('SELECT app_private.signup_prune()');
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_intents WHERE id=$1',[intent9])).rows[0].n,0);
 assert.equal((await pg.query('SELECT count(*)::int n FROM app_private.signup_browser_attempts WHERE intent_id=$1',[intent9])).rows[0].n,0);
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
 const privileges=(await pg.query("SELECT has_function_privilege('anon','public.signup_browser_admit(uuid,uuid,uuid,text,text,text,text,boolean,text)','EXECUTE') AS anon,has_function_privilege('authenticated','public.signup_browser_admit(uuid,uuid,uuid,text,text,text,text,boolean,text)','EXECUTE') AS auth,has_function_privilege('service_role','public.signup_browser_admit(uuid,uuid,uuid,text,text,text,text,boolean,text)','EXECUTE') AS service")).rows[0];assert.deepEqual(privileges,{anon:false,auth:false,service:true});
 console.log('Synthetic same-browser signup diagnostic passed.');
} finally {await pg.close();}
