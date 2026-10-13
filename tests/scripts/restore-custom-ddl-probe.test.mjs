import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { BackupError } from '../../scripts/operations/backup-format.mjs';
import { PERSONAL_REF } from '../../scripts/operations/backup-config.mjs';
import { CUSTOM_DDL_PROBE_SQL,validateCustomDdlProbe,runCustomDdlProbe } from '../../scripts/operations/restore-custom-ddl-probe.mjs';

const ref='abcdefghijklmnopqrst',canary='PRIVATE_NOT_OUTPUT';
const env={SC_RESTORE_PROJECT_REF:ref,SC_RESTORE_CONFIRM_PROJECT:ref,SC_RESTORE_ISOLATED:'YES',SC_RESTORE_SUPABASE_URL:'https://'+ref+'.supabase.co',SC_RESTORE_SUPABASE_KEY:'sb_secret_'+canary,SC_RESTORE_PG_RESTORE:resolve('fake-restore'),SC_RESTORE_PSQL:resolve('fake-psql'),SC_RESTORE_PGHOST:'db.'+ref+'.supabase.co',SC_RESTORE_PGUSER:'postgres',SC_RESTORE_PGDATABASE:'postgres',SC_RESTORE_PGPASSWORD:canary,SC_RESTORE_PGSSLMODE:'require'};
const facts=overrides=>({version:1,sameActor:true,targetEmpty:true,probesInitiallyAbsent:true,functionCreated:true,identityTriggerCreated:true,adminConstraintTriggerCreated:true,objectsPolicyCreated:true,bucketsPolicyCreated:true,...overrides});
const run=async(query,selectedEnv=env,args=['check'])=>{const output=[];const exit=await runCustomDdlProbe(args,selectedEnv,value=>output.push(value),{query});return {exit,output};};
async function db(){const value=new PGlite();await value.exec('create schema auth;create schema storage;create table auth.users(id integer);create table storage.objects(id integer);create table storage.buckets(id integer)');return value;}

test('closed projection is copied, frozen and refuses every accessor/extra/coercion without reading it',()=>{
  const source=facts(),value=validateCustomDdlProbe(source);assert.equal(Object.getPrototypeOf(value),null);assert.equal(Object.isFrozen(value),true);source.functionCreated=false;assert.equal(value.functionCreated,true);
  let reads=0;
  for(const key of Object.keys(facts())){const changed=facts();Object.defineProperty(changed,key,{enumerable:true,get(){reads++;throw Error(canary);}});assert.throws(()=>validateCustomDdlProbe(changed),{code:'RESTORE_CUSTOM_DDL_REPORT_INVALID'});}
  for(const changed of [null,[],Object.create(facts()),{...facts(),private:canary},{...facts(),[Symbol('private')]:canary},facts({version:2}),facts({functionCreated:false}),facts({sameActor:false}),facts({identityTriggerCreated:1})])assert.throws(()=>validateCustomDdlProbe(changed),{code:'RESTORE_CUSTOM_DDL_REPORT_INVALID'});
  assert.equal(reads,0);validateCustomDdlProbe(facts({functionCreated:false,identityTriggerCreated:false,adminConstraintTriggerCreated:false}));
});
test('help/invalid/personal/incomplete inputs never query or open an archive',async()=>{
  let calls=0;const query=()=>{calls++;throw Error(canary);};
  assert.equal((await run(query,{},['--help'])).exit,0);
  for(const [selected,args]of [[env,['restore']], [env,['check','extra']], [{...env,SC_RESTORE_ISOLATED:'NO'},['check']], [{...env,SC_RESTORE_PROJECT_REF:PERSONAL_REF,SC_RESTORE_CONFIRM_PROJECT:PERSONAL_REF},['check']], [{...env,SC_RESTORE_PGPASSWORD:''},['check']]])assert.equal((await run(query,selected,args)).exit,1);
  assert.equal(calls,0);
});
test('fixed SQL uses the original fifteen-second transport and only returns closed facts after it completes',async()=>{
  const selected=await run(async(request,options)=>{assert.deepEqual(request,{sql:CUSTOM_DDL_PROBE_SQL});assert.deepEqual(options,{timeoutMs:15000});return facts();});
  assert.equal(selected.exit,0);assert.equal(selected.output[0].rollbackAndProbeAbsenceAssertedInSameConnection,true);assert.equal(selected.output[0].restoreAccepted,false);assert.equal(JSON.stringify(selected).includes(canary),false);
  for(const error of [new Error(canary),new BackupError('PSQL_FAILED'),new BackupError(canary)]){const failed=await run(async()=>{throw error;});assert.equal(failed.exit,1);assert.equal(JSON.stringify(failed).includes(canary),false);}
});
test('literal native PostgreSQL DDL creates all five temporary probes and ROLLBACK removes each in the same connection',async()=>{
  const value=await db();try{const rows=(await value.exec(CUSTOM_DDL_PROBE_SQL)).flatMap(result=>result.rows).filter(row=>row.report);assert.equal(rows.length,1);assert.deepEqual(JSON.parse(JSON.stringify(validateCustomDdlProbe(rows[0].report))),facts());
    const after=(await value.query("select (select count(*) from pg_proc where proname='second_brain_restore_qualification_trigger_v1')::integer as functions,(select count(*) from pg_trigger where tgname like 'second_brain_restore_qualification_%')::integer as triggers,(select count(*) from pg_policy where polname='second_brain_restore_qualification_policy_v1')::integer as policies,(select count(*) from auth.users)::integer as users")).rows[0];assert.deepEqual(after,{functions:0,triggers:0,policies:0,users:0});
  }finally{await value.close();}
});
test('literal nonempty target and name collision refuse before replacing or deleting any existing object',async()=>{
  for(const setup of ['insert into auth.users values(1)',"create function public.second_brain_restore_qualification_trigger_v1() returns integer language sql as 'select 7'"]){const value=await db();try{await value.exec(setup);await assert.rejects(value.exec(CUSTOM_DDL_PROBE_SQL),error=>error.code==='55000');await value.exec('rollback');if(setup.startsWith('insert'))assert.equal((await value.query('select count(*)::integer as n from auth.users')).rows[0].n,1);else assert.equal((await value.query('select public.second_brain_restore_qualification_trigger_v1() as n')).rows[0].n,7);}finally{await value.close();}}
});
test('literal standard trigger privilege differs from policy ownership; independent denials roll back and preserve managed owners',async()=>{
  const value=await db();try{await value.exec('create role ddl_operator login;grant usage on schema auth,storage,public to ddl_operator;grant create on schema public to ddl_operator;grant select,trigger on auth.users to ddl_operator;grant select on storage.objects,storage.buckets to ddl_operator;set session authorization ddl_operator');
    const rows=(await value.exec(CUSTOM_DDL_PROBE_SQL)).flatMap(result=>result.rows).filter(row=>row.report);assert.equal(rows.length,1);const result=validateCustomDdlProbe(rows[0].report);assert.equal(result.identityTriggerCreated,true);assert.equal(result.adminConstraintTriggerCreated,true);assert.equal(result.objectsPolicyCreated,false);assert.equal(result.bucketsPolicyCreated,false);assert.equal(result.functionCreated,true);
    assert.equal((await value.query("select count(*)::integer as n from pg_trigger where tgname like 'second_brain_restore_qualification_%'")).rows[0].n,0);
  }finally{await value.close();}
});
test('RLS-hidden rows refuse the empty-target guard before DDL instead of being mistaken for an empty relation',async()=>{
  const value=await db();try{
    const originalActor=(await value.query('select session_user as actor')).rows[0].actor;
    await value.exec("insert into auth.users values(1);alter table auth.users enable row level security;create policy hidden on auth.users using(false);create role hidden_operator login;grant usage on schema auth,storage,public to hidden_operator;grant create on schema public to hidden_operator;grant select,trigger on auth.users to hidden_operator;grant select on storage.objects,storage.buckets to hidden_operator;set session authorization hidden_operator");
    assert.equal((await value.query('select count(*)::integer as n from auth.users')).rows[0].n,0);
    await assert.rejects(value.exec(CUSTOM_DDL_PROBE_SQL),error=>error.code==='42501');
    // PGlite has no authentication backend; RESET preserves its changed
    // session default. Restore the explicitly captured synthetic owner instead.
    await value.exec('rollback;set session authorization "'+originalActor.replaceAll('"','""')+'"');
    assert.equal((await value.query('select count(*)::integer as n from auth.users')).rows[0].n,1);
    assert.equal((await value.query("select count(*)::integer as n from pg_proc where proname='second_brain_restore_qualification_trigger_v1'")).rows[0].n,0);
  }finally{await value.close();}
});
