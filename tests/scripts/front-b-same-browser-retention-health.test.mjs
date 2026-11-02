import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('draft retention health distinguishes browser grace, fences and actionable work in memory',{timeout:60000},async()=>{
 const sql=await readFile(new URL('../../scripts/verification/front-b-origin-retention-draft/same-browser-health-draft.sql.txt',import.meta.url),'utf8');
 assert.match(sql,/begin transaction read only;/i);assert.match(sql,/rollback;\s*$/i);
 const db=new PGlite('memory://');
 try{
  await db.waitReady;assert.equal(db.dataDir,'memory://');
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
   create schema app_private;create schema cron;
   create table app_private.signup_intents(id integer,user_id integer,state text,expires_at timestamptz,origin jsonb,subject_hash text,consumed_at timestamptz);
   create table app_private.signup_completion_fences_draft(intent_id integer,user_id integer);
   create table app_private.signup_browser_attempts(intent_id integer,expires_at timestamptz,browser_hash text,consumed_at timestamptz);
   create table app_private.signup_origins(expires_at timestamptz);
   create table cron.job(jobid integer,jobname text,username text,database text,schedule text,command text,active boolean);
   create table cron.job_run_details(jobid integer,command text,username text,database text,end_time timestamptz,status text);
   insert into app_private.signup_intents values
    (1,11,'bound',now()-interval '1 hour',null,null,null),
    (2,12,'bound',now()-interval '1 hour',null,null,null),
    (3,13,'bound',now()-interval '1 hour','{"utm_source":"synthetic"}',null,null),
    (4,14,'bound',now()-interval '1 hour',null,null,null),
    (5,null,'pending',now()-interval '1 hour',null,null,null),
    (6,16,'consumed',now()-interval '26 hours',null,'synthetic',now()-interval '25 hours');
   insert into app_private.signup_completion_fences_draft values (2,12),(3,13);
   insert into app_private.signup_browser_attempts values
    (1,now()-interval '1 hour','synthetic',null),
    (2,now()-interval '26 hours','synthetic',null),
    (6,now()-interval '26 hours','synthetic',null),
    (7,now()-interval '26 hours','synthetic',now()-interval '25 hours');
   insert into app_private.signup_origins values (now()-interval '1 day'),(now()+interval '1 day');`);
  const rows=(await db.exec(sql)).flatMap(part=>part.rows??[]);
  const result=rows.find(row=>Object.hasOwn(row,'retention_health'))?.retention_health;
  assert(result);assert.equal(result.function_fingerprints_approved,false);
  assert.equal(result.signup_prune_qualified,null);assert.equal(result.browser_prune_qualified,null);
  assert.equal(result.expired_intents,5);assert.equal(result.actionable_expired_intents,3);
  assert.equal(result.browser_grace_intents,1);assert.equal(result.fenced_without_origin,1);
  assert.equal(result.expired_origins,1);assert.equal(result.pending_subject_scrubs,1);
  assert.equal(result.browser_hashes_after_grace,3);assert.equal(result.browser_hashes_after_grace_unconsumed,2);
  // Both a fenced bound intent and a password-finished intent qualify for hash
  // scrubbing. The unmatched synthetic attempt is excluded by the join.
  assert.equal(result.browser_hash_cleanup_candidates,2);
  assert.equal(result.job_count,0);assert.equal(result.browser_prune_named_command_jobs,0);
  assert.equal((await db.query('select count(*)::int as n from app_private.signup_intents')).rows[0].n,6);
  assert.equal((await db.query('select count(*)::int as n from app_private.signup_completion_fences_draft')).rows[0].n,2);
 }finally{await db.close();}
});
