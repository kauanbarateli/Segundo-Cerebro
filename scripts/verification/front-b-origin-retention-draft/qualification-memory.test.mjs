/** Fixture-only diagnostic. Never connects to a database server or accepts a
 * destination. Prune runs only against synthetic rows in memory; registration
 * SQL remains guarded and is never executed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve,sep} from 'node:path';

if(process.argv.length!==2)throw Error('No destination or other arguments are accepted.');
// Always read pinned local project files from the working tree, never a DB URL.
const repo=pathToFileURL(resolve(process.cwd())+sep),require=createRequire(new URL('package.json',repo));
const {PGlite}=await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
const read=path=>readFile(new URL(path,repo));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=[
 ['supabase/operations/candidates/20261101020254_public_admission_gate.sql','e125759742d7fa1513f7d42ad04ee13c1a6c8894b98478261d1217381f93f519'],
 ['scripts/verification/front-b-origin-retention-draft/signup-origin-retention-health.sql.txt','54d145c4c18dafa3308dd0eaa178fb4e9d958f091101d87e7db6165c1c5c484b'],
 ['scripts/verification/front-b-origin-retention-draft/signup-origin-cron-registration.sql.txt','5a630babf127ec9be31a6fad9950a4d4aa0fc2d1b349dfd38b2f7e7959452583'],
 ['scripts/verification/front-b-origin-retention-draft/signup-origin-cron-toggle.sql.txt','1edf786bd4ccbd0b1157f856fa0bff36d1b3a8840a2fa1cf309e5efef456147c'],
 ['supabase/operations/inspect-service-role-memberships-labeled-v1.sql','bddf4a770845a60c4f60e5fd4ab26b85c6be366fe19218ec37113149c23bec81'],
 ['scripts/verification/front-b-135-draft/prune.sql.txt','5c7e1c827596025b15b538d4f792deb1ae8acd6d37c16c6d7f716e10e46ac29f'],
];
const bytes=await Promise.all(sources.map(async([path,sha])=>{const source=await read(path);assert.equal(digest(source),sha,'REVIEWED_SOURCE_DRIFT');return source;}));
const [candidate,health,registration,toggle,membership,coordinated]=bytes.map(value=>value.toString('utf8'));
assert.match(registration,/begin;\s*do \$draft_only\$ begin raise exception 'DRAFT_ONLY:/i);
assert.match(registration,/rollback;\s*$/i);
assert.match(toggle,/begin;\s*do \$draft_only\$ begin raise exception 'DRAFT_ONLY:/i);
assert.match(toggle,/desired_active boolean:=null/i);assert.match(toggle,/rollback;\s*$/i);
assert.match(health,/begin transaction read only;/i);assert.match(health,/rollback;\s*$/i);
assert.match(candidate,/values\(p_user,i\.origin,i\.origin_consent_version,now\(\),now\(\)\+interval '12 months'\)/i);
assert.match(coordinated,/BEGIN;\s*DO \$scratch_guard\$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END \$scratch_guard\$;/);
const definition=coordinated.match(/CREATE OR REPLACE FUNCTION app_private\.signup_prune\(\) RETURNS jsonb[\s\S]*?AS \$\$[\s\S]*?\$\$;/);
assert(definition);assert.equal((coordinated.match(/CREATE OR REPLACE FUNCTION app_private\.signup_prune\(\)/g)??[]).length,1);

test('fixed PGlite memory fixture qualifies catalog and job drift, never a hosted destination',{timeout:60000},async()=>{
 const db=new PGlite('memory://');
 try{
  await db.waitReady;assert.equal(db.dataDir,'memory://');
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin;create role alternate_owner nologin;create role test_inherited login;
    create schema app_private;create schema cron;
    create table app_private.signup_intents(id uuid,user_id uuid,state text,expires_at timestamptz,subject_hash text,consumed_at timestamptz,origin jsonb,origin_consent_version text,origin_consented_at timestamptz);
    create unique index on app_private.signup_intents(id);
    create table app_private.signup_password_proofs(intent_id uuid references app_private.signup_intents(id) on delete cascade,session_id uuid,expires_at timestamptz);
    create table app_private.signup_completion_fences_draft(user_id uuid,intent_id uuid,origin_expired boolean,updated_at timestamptz);
    create table app_private.signup_origins(user_id uuid,expires_at timestamptz);
    create table cron.job(jobid bigint,jobname text,username text,database text,schedule text,command text,active boolean);
    create table cron.job_run_details(jobid bigint,runid bigint,status text,start_time timestamptz,end_time timestamptz,command text,username text,database text);
    create function cron.alter_job(job_id bigint,schedule text default null,command text default null,database text default null,username text default null,active boolean default null)
      returns void language plpgsql as $$ begin update cron.job j set active=coalesce($6,j.active) where j.jobid=$1;end $$;`);
  // Install only the pinned candidate function definition in this disposable
  // fixture. The guarded registration is not executed or altered.
  await db.exec(definition[0]);
  await db.exec('revoke all on function app_private.signup_prune() from public,anon,authenticated,service_role;grant execute on function app_private.signup_prune() to service_role');
  const identity=(await db.query('select current_database() as db,current_user as role')).rows[0];
  assert.deepEqual(identity,{db:'postgres',role:'postgres'}); // Same labels do not bind a project ref.
  async function observation(){const outputs=await db.exec(health);const row=outputs.flatMap(output=>output.rows??[]).find(value=>Object.hasOwn(value,'retention_health'));assert(row);return row.retention_health;}
  let result=await observation();
  assert.equal(result.function_matches_reviewed_draft,true);assert.equal(result.job_count,0);assert.equal(result.qualified_job_count,0);assert.equal(result.last_success_at,null);
  const command="SET statement_timeout = '20s'; SET lock_timeout = '250ms'; SELECT app_private.signup_prune();";
  await db.query('insert into cron.job values (1,$1,$2,current_database(),$3,$4,false)',['sc-signup-origin-retention-v1','postgres','*/5 * * * *',command]);
  result=await observation();assert.equal(result.job_count,1);assert.equal(result.qualified_job_count,1);assert.equal(result.qualified_active_count,0);
  // Only the reviewed block is exercised, with explicit desired state, in
  // memory and inside a rollback. The remote guard is never removed or run.
  const toggleBlock=toggle.match(/do \$toggle\$[\s\S]*?end \$toggle\$;/i)[0];
  await db.exec('begin');
  try {
   await db.exec(toggleBlock.replace('desired_active boolean:=null','desired_active boolean:=true'));
   assert.equal((await db.query('select active from cron.job where jobid=1')).rows[0].active,true);
   await db.exec(toggleBlock.replace('desired_active boolean:=null','desired_active boolean:=false'));
   assert.equal((await db.query('select active from cron.job where jobid=1')).rows[0].active,false);
  } finally {await db.exec('rollback');}
  await db.exec("update cron.job set command='unreviewed'");
  await assert.rejects(db.exec(toggleBlock.replace('desired_active boolean:=null','desired_active boolean:=true')),/Job identity or command mismatch/);
  assert.equal((await db.query('select active from cron.job where jobid=1')).rows[0].active,false);
  await db.query('update cron.job set command=$1',[command]);
  await db.query("insert into cron.job_run_details values (1,1,'succeeded',now()-interval '2 minutes',now()-interval '1 minute',$1,'postgres',current_database())",['other command']);
  result=await observation();assert.equal(result.last_success_at,null);
  await db.query("insert into cron.job_run_details values (1,2,'succeeded',now()-interval '50 seconds',now()-interval '40 seconds',$1,'postgres',current_database())",[command]);
  result=await observation();assert.equal(typeof result.last_success_at,'string');assert.equal(result.latest_run_status,'succeeded');
  await db.exec("update cron.job set active=true;insert into app_private.signup_origins values ('00000000-0000-4000-8000-000000000001',now()-interval '1 second')");
  result=await observation();assert.equal(result.qualified_active_count,1);assert.equal(result.expired_origins,1);
  await db.exec("insert into app_private.signup_origins select md5(g::text)::uuid,now()-interval '1 second' from generate_series(1,500) g;insert into app_private.signup_origins values ('00000000-0000-4000-8000-000000000002',now()+interval '1 hour')");
  const prune=async()=>(await db.query('select app_private.signup_prune() as result')).rows[0].result;
  assert.deepEqual(await prune(),{expiredRemoved:0,consumedScrubbed:0,originsRemoved:500,fencedExamined:0,expiredOriginsCleared:0});
  assert.equal((await observation()).expired_origins,1);
  assert.deepEqual(await prune(),{expiredRemoved:0,consumedScrubbed:0,originsRemoved:1,fencedExamined:0,expiredOriginsCleared:0});
  assert.deepEqual(await prune(),{expiredRemoved:0,consumedScrubbed:0,originsRemoved:0,fencedExamined:0,expiredOriginsCleared:0});
  assert.equal((await db.query('select count(*)::int as n from app_private.signup_origins')).rows[0].n,1);
  assert.equal((await db.query("select exists(select 1 from app_private.signup_origins where user_id='00000000-0000-4000-8000-000000000002') as preserved")).rows[0].preserved,true);
  // Expired origin can be removed without deleting an in-flight fence/intent.
  // A protected, already scrubbed fence must not produce a perpetual backlog.
  await db.exec(`insert into app_private.signup_intents(id,user_id,state,expires_at,origin,origin_consent_version,origin_consented_at) values
    ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','bound',now()-interval '1 hour',null,null,null),
    ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','bound',now()-interval '1 hour','{"utm_source":"synthetic"}','v1',now()),
    ('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','bound',now()-interval '1 hour',null,null,null);
    insert into app_private.signup_completion_fences_draft values
    ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true,now()),
    ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',false,now());
    insert into app_private.signup_password_proofs values ('10000000-0000-4000-8000-000000000002',null,now()-interval '1 hour');`);
  result=await observation();assert.equal(result.expired_intents,3);assert.equal(result.actionable_expired_intents,2);assert.equal(result.protected_fences_without_origin,1);
  assert.deepEqual(await prune(),{expiredRemoved:1,consumedScrubbed:0,originsRemoved:0,fencedExamined:1,expiredOriginsCleared:1});
  result=await observation();assert.equal(result.expired_intents,2);assert.equal(result.actionable_expired_intents,0);assert.equal(result.protected_fences_without_origin,2);
  assert.equal((await db.query('select count(*)::int as n from app_private.signup_completion_fences_draft')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int as n from app_private.signup_password_proofs where session_id is null')).rows[0].n,1);
  await db.exec("update cron.job set command='unreviewed'");
  result=await observation();assert.equal(result.job_count,1);assert.equal(result.qualified_job_count,0);assert.equal(result.last_success_at,null);
  await db.query('update cron.job set command=$1',[command]);
  await db.query('insert into cron.job values (2,$1,$2,current_database(),$3,$4,false)',['sc-signup-origin-retention-v1','postgres','*/5 * * * *',command]);
  result=await observation();assert.equal(result.job_count,2);assert.equal(result.qualified_job_count,2);
  await db.exec('grant execute on function app_private.signup_prune() to anon');
  assert.equal((await observation()).function_matches_reviewed_draft,false);
  await db.exec('revoke execute on function app_private.signup_prune() from anon');
  assert.equal((await observation()).function_matches_reviewed_draft,true);
  await db.exec('grant service_role to authenticated');
  assert.equal((await observation()).function_matches_reviewed_draft,false);
  await db.exec('revoke service_role from authenticated');
  // A separate service-role member can be dangerous while the direct ACL and
  // the health predicate remain unchanged: report this as a review blocker.
  await db.exec('grant service_role to test_inherited');
  assert.equal((await observation()).function_matches_reviewed_draft,true);
  assert.equal((await db.query("select pg_has_role('test_inherited','service_role','MEMBER') as member")).rows[0].member,true);
  const membershipReport=(await db.query(membership)).rows[0].result;
  assert.equal(membershipReport.status,'REVIEW_REQUIRED');
  assert(membershipReport.roles.some(role=>role.label==='[outro]'&&role.members===1));
  await db.exec('revoke service_role from test_inherited');
  await db.exec('alter function app_private.signup_prune() strict');
  assert.equal((await observation()).function_matches_reviewed_draft,false);
  await db.exec('alter function app_private.signup_prune() called on null input');
  await db.exec("alter function app_private.signup_prune() set search_path='public'");
  assert.equal((await observation()).function_matches_reviewed_draft,false);
  await db.exec("alter function app_private.signup_prune() set search_path=''");
  await db.exec("create or replace function app_private.signup_prune() returns jsonb language plpgsql security definer set search_path='' as $$ begin return '{}'::jsonb;end $$");
  assert.equal((await observation()).function_matches_reviewed_draft,false);
  await db.exec(definition[0].replace('create function','create or replace function'));
  assert.equal((await observation()).function_matches_reviewed_draft,true);
  await db.exec('alter function app_private.signup_prune() owner to alternate_owner');
  assert.equal((await observation()).function_matches_reviewed_draft,false);
  await db.exec('drop function app_private.signup_prune()');
  assert.equal((await observation()).function_matches_reviewed_draft,false);
 }finally{await db.close();}
});
