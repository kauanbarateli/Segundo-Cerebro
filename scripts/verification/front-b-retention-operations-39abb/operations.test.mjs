// Synthetic PGlite fixture only. No network, credentials, hosted database or cron.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const source=async path=>readFile(new URL(path,import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
test('both job operations are guarded, isolated and fail closed on drift',{timeout:60000},async()=>{
 const [proposal,originProposal,health,composition]=await Promise.all([source('./browser-job.guarded.sql.txt'),source('./origin-job.guarded.sql.txt'),source('./health.readonly.sql.txt'),source('../front-b-135-draft/same-browser-composed-v1.guarded.sql.txt')]);
 assert.equal(sha(composition),'39abb9b4af679d761f6bd05388f9d5a85b10fa7dc66cb5f91ccfd671f89d119e');
 assert.match(proposal,/begin;\s*do \$draft_only\$ begin raise exception 'DRAFT_ONLY:/i);
 assert.match(proposal,/operation text:=null/);assert.match(proposal,/rollback;\s*$/i);
 assert.match(originProposal,/begin;\s*do \$draft_only\$ begin raise exception 'DRAFT_ONLY:/i);assert.match(originProposal,/operation text:=null/);assert.match(originProposal,/rollback;\s*$/i);
 assert.match(health,/begin transaction read only;/i);assert.match(health,/rollback;\s*$/i);
 const def=name=>{
  const matches=[...composition.matchAll(new RegExp(`CREATE OR REPLACE FUNCTION app_private\\.${name}\\([^)]*\\)[\\s\\S]*?AS \\$\\$[\\s\\S]*?\\$\\$;`,'gi'))];
  assert.equal(matches.length,1);return matches[0][0];
 };
 const manage=proposal.match(/do \$manage\$[\s\S]*?end \$manage\$;/i)?.[0];assert(manage);
 const manageOrigin=originProposal.match(/do \$manage\$[\s\S]*?end \$manage\$;/i)?.[0];assert(manageOrigin);
 const command="SET statement_timeout = '20s'; SET lock_timeout = '250ms'; SELECT app_private.signup_browser_prune(500);";
 const prior="SET statement_timeout = '20s'; SET lock_timeout = '250ms'; SELECT app_private.signup_prune();";
 const db=new PGlite('memory://');
 try{
  await db.waitReady;assert.equal(db.dataDir,'memory://');
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema app_private;create schema cron;
   create table app_private.signup_intents(id uuid,user_id uuid,state text,expires_at timestamptz,origin jsonb,origin_consent_version text,origin_consented_at timestamptz,subject_hash text,consumed_at timestamptz);
   create table app_private.signup_completion_fences_draft(user_id uuid,intent_id uuid,origin_expired boolean,updated_at timestamptz);
   create table app_private.signup_browser_attempts(intent_id uuid,expires_at timestamptz,browser_hash text,consumed_at timestamptz);
   create table app_private.signup_origins(user_id uuid,expires_at timestamptz);
   create table cron.job(jobid bigint generated always as identity,jobname text,username text,database text,schedule text,command text,active boolean);
   create table cron.job_run_details(jobid bigint,command text,username text,database text,end_time timestamptz,status text);
   create function cron.schedule(job_name text,job_schedule text,job_command text) returns bigint language sql as $$ insert into cron.job(jobname,username,database,schedule,command,active) values($1,current_user,current_database(),$2,$3,true) returning jobid $$;
   create function cron.alter_job(job_id bigint,schedule text default null,command text default null,database text default null,username text default null,active boolean default null) returns void language plpgsql as $$ begin update cron.job j set active=coalesce($6,j.active) where j.jobid=$1;end $$;`);
  await db.exec(def('signup_prune'));await db.exec(def('signup_browser_prune'));
  await db.exec('revoke all on function app_private.signup_prune(),app_private.signup_browser_prune(integer) from public,anon,authenticated,service_role;grant execute on function app_private.signup_prune(),app_private.signup_browser_prune(integer) to service_role');
  const observe=async()=>{const rows=(await db.exec(health)).flatMap(r=>r.rows??[]);return rows.find(r=>Object.hasOwn(r,'retention_health')).retention_health;};
  const invoke=async (target,op)=>db.exec((target==='browser'?manage:manageOrigin).replace('operation text:=null',`operation text:='${op}'`));
  let state=await observe();assert.equal(state.signup_prune_qualified,true);assert.equal(state.browser_prune_qualified,true);assert.equal(state.browser_job_count,0);
  await invoke('origin','register');await invoke('browser','register');state=await observe();assert.equal(state.job_count,1);assert.equal(state.qualified_active_count,0);assert.equal(state.browser_job_count,1);assert.equal(state.qualified_browser_active_count,0);
  await invoke('origin','activate');await invoke('browser','activate');state=await observe();assert.equal(state.qualified_active_count,1);assert.equal(state.qualified_browser_active_count,1);assert.equal(state.browser_prune_last_success_at,null);
  const id=(await db.query("select jobid from cron.job where jobname='sc-signup-browser-retention-v1'")).rows[0].jobid;
  await db.query("insert into cron.job_run_details values ($1,$2,'postgres',current_database(),now(),'succeeded')",[id,prior]);
  assert.equal((await observe()).browser_prune_last_success_at,null);
  await db.query("insert into cron.job_run_details values ($1,$2,'postgres',current_database(),now(),'succeeded')",[id,command]);
  assert.equal(typeof (await observe()).browser_prune_last_success_at,'string');
  // A stale origin and browser hash can be removed without deleting the
  // uncertain fence, intent or attempt that protect the in-flight operation.
  await db.exec(`insert into app_private.signup_intents(id,user_id,state,expires_at,origin,origin_consent_version,origin_consented_at)
    values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','bound',now()-interval '26 hours','{"utm_source":"synthetic"}','v1',now());
   insert into app_private.signup_completion_fences_draft values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',false,now());
   insert into app_private.signup_browser_attempts values('10000000-0000-4000-8000-000000000001',now()-interval '26 hours','synthetic',null);`);
  state=await observe();assert.equal(state.actionable_expired_intents,1);assert.equal(state.browser_hash_cleanup_candidates,1);
  await db.exec('select app_private.signup_prune();select app_private.signup_browser_prune(500);');
  state=await observe();assert.equal(state.actionable_expired_intents,0);assert.equal(state.fenced_without_origin,1);assert.equal(state.browser_hash_cleanup_candidates,0);
  assert.equal((await db.query('select origin_expired from app_private.signup_completion_fences_draft')).rows[0].origin_expired,true);
  assert.equal((await db.query('select browser_hash from app_private.signup_browser_attempts')).rows[0].browser_hash,null);
  assert.equal((await db.query('select count(*)::int n from app_private.signup_intents')).rows[0].n,1);
  await db.exec("create or replace function app_private.signup_browser_prune(p_limit integer) returns integer language plpgsql security definer set search_path='' as $$ begin return 0;end $$");
  assert.equal((await observe()).browser_prune_qualified,false);
  await invoke('browser','pause');assert.equal((await observe()).qualified_browser_active_count,0);
  await assert.rejects(invoke('browser','activate'),/Retention function differs/);
  assert.equal((await db.query("select active from cron.job where jobname='sc-signup-origin-retention-v1'")).rows[0].active,true);
  await invoke('origin','pause');assert.equal((await observe()).qualified_active_count,0);
  await db.query("update cron.job set command='unexpected' where jobname='sc-signup-browser-retention-v1'");
  await assert.rejects(invoke('browser','pause'),/Job collision/);
 }finally{await db.close();}
});
