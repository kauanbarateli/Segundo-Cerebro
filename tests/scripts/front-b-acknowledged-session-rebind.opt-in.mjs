// Local diagnostic only: synthetic fixture and disposable in-memory PGlite.
// This does not validate real Supabase Auth, live PostgreSQL or deployment gates.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

if (process.env.FRONT_B_RUN_ACK_REBIND_PGLITE !== '1') throw Error('Explicit opt-in required');
const pg = new PGlite();
try {
 await pg.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA app_private; CREATE SCHEMA auth;
  GRANT USAGE ON SCHEMA app_private TO service_role;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz);
  CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz);
  CREATE TABLE public.user_moderation(user_id uuid PRIMARY KEY,status text,must_change_password boolean);
  CREATE TABLE app_private.signup_settings(singleton boolean PRIMARY KEY,enabled boolean);
  CREATE TABLE app_private.user_admission(user_id uuid PRIMARY KEY,origin text,state text);
  CREATE TABLE app_private.signup_intents(id uuid PRIMARY KEY,user_id uuid,subject_hash text,state text,expires_at timestamptz,terms_version text,privacy_version text,origin jsonb);
  CREATE TABLE app_private.signup_completion_fences_draft(user_id uuid PRIMARY KEY,intent_id uuid UNIQUE,owner_session_id uuid,phase text,terms_version text,privacy_version text,updated_at timestamptz DEFAULT now());
  CREATE TABLE app_private.signup_password_proofs(intent_id uuid PRIMARY KEY,user_id uuid,session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,expires_at timestamptz,consumed_at timestamptz);
 `);
 // Reuse the exact identity and context functions from the installed source;
 // surrounding auth tables remain a deliberately minimal synthetic fixture.
 const installed=await readFile(new URL('../../scripts/verification/front-b-135-draft/admission-feedback-metrics-atomic.sql.txt',import.meta.url),'utf8');
 for (const [start,end] of [['create function app_private.signup_pending_identity(', '\n$$;'],['CREATE FUNCTION app_private.draft_completion_context(', '\nEND $$;']]) {
  const offset=installed.indexOf(start); assert.notEqual(offset,-1);
  const limit=installed.indexOf(end,offset); assert.notEqual(limit,-1);
  await pg.exec(installed.slice(offset,limit+end.length));
 }
 const source=await readFile(new URL('../../scripts/verification/front-b-135-draft/acknowledged-session-rebind.guarded.sql.txt',import.meta.url),'utf8');
 const guard="DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;";
 assert.equal(source.split(guard).length,2);
 await pg.exec(source.replace(guard,''));
 const user='10000000-0000-4000-8000-000000000001', old='20000000-0000-4000-8000-000000000001', fresh='20000000-0000-4000-8000-000000000002', other='20000000-0000-4000-8000-000000000003', intent='30000000-0000-4000-8000-000000000001', hash='a'.repeat(64);
 await pg.query('INSERT INTO auth.users VALUES ($1,now(),false,null,null)',[user]);
 await pg.query('INSERT INTO auth.sessions VALUES ($1,$3,null),($2,$3,null)',[old,fresh,user]);
 await pg.query("INSERT INTO public.user_moderation VALUES ($1,'active',false)",[user]);
 await pg.query("INSERT INTO app_private.user_admission VALUES ($1,'unclassified','pending')",[user]);
 await pg.exec('INSERT INTO app_private.signup_settings VALUES (true,true)');
 await pg.query("INSERT INTO app_private.signup_intents VALUES ($1,$2,$3,'bound',now()+interval '1 hour','v1','v2',null)",[intent,user,hash]);
 await pg.query("INSERT INTO app_private.signup_completion_fences_draft(user_id,intent_id,owner_session_id,phase,terms_version,privacy_version) VALUES($1,$2,$3,'password_acknowledged','v1','v2')",[user,intent,old]);
 await pg.query("INSERT INTO app_private.signup_password_proofs VALUES($1,$2,$3,now()+interval '30 minutes',null)",[intent,user,old]);
 const call=(session=fresh, terms='v1')=>pg.query('SELECT public.signup_rebind_verified_ack($1,$2,$3,$4,$5) AS result',[user,session,hash,terms,'v2']);
 await assert.rejects(()=>call(),{code:'42501'}); // Old session remains live.
 const expiry=(await pg.query('SELECT expires_at FROM app_private.signup_password_proofs')).rows[0].expires_at;
 await pg.query('DELETE FROM auth.sessions WHERE id=$1',[old]);
 assert.equal((await pg.query('SELECT session_id FROM app_private.signup_password_proofs')).rows[0].session_id,null);
 await pg.query('INSERT INTO auth.sessions VALUES ($1,$2,null)',[other,user]);
 await assert.rejects(()=>call(),{code:'42501'}); // A different old session still exists.
 await pg.query('DELETE FROM auth.sessions WHERE id=$1',[other]);
 await assert.rejects(()=>call(fresh,'wrong'),{code:'42501'});
 await pg.query("UPDATE public.user_moderation SET status='blocked' WHERE user_id=$1",[user]);
 await assert.rejects(()=>call(),{code:'42501'});
 await pg.query("UPDATE public.user_moderation SET status='active' WHERE user_id=$1",[user]);
 await pg.query("UPDATE app_private.signup_completion_fences_draft SET phase='uncertain'");
 await assert.rejects(()=>call(),{code:'42501'});
 await pg.query("UPDATE app_private.signup_completion_fences_draft SET phase='password_acknowledged'");
 assert.equal((await call()).rows[0].result.intentId,intent);
 const proof=(await pg.query('SELECT session_id,expires_at FROM app_private.signup_password_proofs')).rows[0];
 assert.equal(proof.session_id,fresh); assert.deepEqual(proof.expires_at,expiry);
 assert.equal((await pg.query('SELECT owner_session_id FROM app_private.signup_completion_fences_draft')).rows[0].owner_session_id,fresh);
 assert.equal((await call()).rows[0].result.intentId,intent); // Idempotent.
 await pg.query("UPDATE app_private.signup_password_proofs SET expires_at=now()-interval '1 second'");
 await assert.rejects(()=>call(),{code:'42501'});
 const privileges=(await pg.query(`SELECT has_function_privilege('anon','public.signup_rebind_verified_ack(uuid,uuid,text,text,text)','EXECUTE') AS anon,has_function_privilege('authenticated','public.signup_rebind_verified_ack(uuid,uuid,text,text,text)','EXECUTE') AS authenticated,has_function_privilege('service_role','public.signup_rebind_verified_ack(uuid,uuid,text,text,text)','EXECUTE') AS service`)).rows[0];
 assert.deepEqual(privileges,{anon:false,authenticated:false,service:true});
 console.log('Synthetic rebind diagnostic passed.');
} finally { await pg.close(); }
