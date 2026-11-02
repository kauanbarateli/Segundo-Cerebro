// In-memory derivations only. The caller must qualify a fresh network:none PG17
// container and pin all sources before this synthetic ledger experiment.
import {createHash} from 'node:crypto';
const H={foundation:'aca4ef373aec1ad3c2ddce859d412a5454e1cb06f457e395fdab5fbada6cacff',quarantine:'d31c75970f93d9e04064a0369955e464b199b460cc25c71538fd7188d8455f25',cutover:'68d6bb8677bae3f75ea5955d9a4dbf6688720cd4ec9500f808d527503a528f0f',preflight:'21f4757e4be28ac872703724051512dd7ae149c5efcebd24128022af4bd2a141'};
const hash=b=>createHash('sha256').update(b).digest('hex'),fail=()=>{throw Error('FULL_CUTOVER_TX_REFUSED');};
const guard=(name,msg)=>`do $${name}$ begin raise exception '${msg}'; end $${name}$;`;
const once=(s,a,b)=>{if(s.split(a).length!==2)fail();return s.replace(a,b);};
const guards={quarantine:[guard('quarantine_guard','REVIEW_AND_QA_AUTHORIZATION_REQUIRED'),guard('app_barrier_guard','APPLICATION_BARRIER_AND_DRAIN_NOT_PROVEN'),guard('freeze_guard','FREEZE_DRAIN_AND_QA_AUTHORIZATION_NOT_PROVEN')],cutover:[guard('cutover_guard','REVIEW_AND_QA_AUTHORIZATION_REQUIRED'),guard('app_barrier_guard','APPLICATION_BARRIER_AND_DRAIN_NOT_PROVEN'),guard('drain_guard','EXTERNAL_DRAIN_NOT_PROVEN'),guard('freeze_guard','FREEZE_DRAIN_AND_QA_AUTHORIZATION_NOT_PROVEN'),"DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;","DO $rollout_block$ BEGIN RAISE EXCEPTION 'CLEANUP_WRITERS_NOT_PROVEN_PAUSED_AND_DRAINED'; END $rollout_block$;"]};
function derive(bytes,kind){let s=bytes.toString('utf8');for(const g of guards[kind])s=once(s,g,'');if(!s.trimEnd().endsWith('rollback;'))fail();return s;}
function writeLedger(sql,version,ending){return once(sql,'rollback;',`insert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','synthetic_only',array['synthetic']);${ending}`);}
export function fullCutoverPlan(inputs){
 if(!inputs||Object.keys(H).some(k=>!Buffer.isBuffer(inputs[k])||hash(inputs[k])!==H[k]))fail();
 const src=inputs.foundation.toString('utf8'),scratch=guards.cutover[4],historical=once(src,scratch,'');if(hash(Buffer.from(historical))!=='bbb652684f1c526f4601c33b575c8d1cf6338feba34ab9a2d58166646faba4d7'||historical.includes('$ledger_028_exact$'))fail();
 const wrapper=src.split('\n').find(x=>x.startsWith('create function public.signup_prune()'));if(!wrapper||src.split(wrapper).length!==2)fail();
 const q=derive(inputs.quarantine,'quarantine'),c=derive(inputs.cutover,'cutover');
 const setup=`begin;create schema cron;create table cron.job(jobname text,command text);create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);insert into supabase_migrations.schema_migrations values ('20261101172256','m028_front_b_signup_feedback_metrics_qa',array[$ledger_028_exact$${historical}$ledger_028_exact$]);${wrapper}\nrevoke all on function public.signup_prune() from public,anon,authenticated,service_role;grant execute on function public.signup_prune() to service_role;commit;`;
 const check=`select json_build_object('kind','state','q',exists(select 1 from supabase_migrations.schema_migrations where version='99000000000001'),'c_rollback',exists(select 1 from supabase_migrations.schema_migrations where version='99000000000002'),'c_commit',exists(select 1 from supabase_migrations.schema_migrations where version='99000000000003'),'freeze',to_regprocedure('app_private.sc_cutover_freeze_038f()') is not null,'attempts',to_regclass('app_private.signup_browser_attempts') is not null,'service',has_function_privilege('service_role','app_private.signup_prune()','EXECUTE'),'baseline',(select count(*)=1 from supabase_migrations.schema_migrations where version='20261101172256'));`;
 return Object.freeze({setup,preflight:inputs.preflight.toString('utf8'),quarantine:writeLedger(q,'99000000000001','commit;'),cutoverRollback:writeLedger(c,'99000000000002','rollback;'),cutoverCommit:writeLedger(c,'99000000000003','commit;'),check});
}
export async function observeFullCutover(ports,inputs){
 const p=fullCutoverPlan(inputs);if(!ports||typeof ports.exec!=='function'||typeof ports.query!=='function')fail();let phase='setup';
 try{
  await ports.exec(p.setup);phase='preflight';const before=await ports.query(p.preflight);if(before?.ledger_028_count!==1||before?.ledger_028_matches_authorized_statement!==true)fail();
  phase='quarantine';await ports.exec(p.quarantine);let x=await ports.query(p.check);if(x?.kind!=='state'||!x.q||x.c_rollback||x.c_commit||!x.freeze||x.attempts||x.service||!x.baseline)fail();
  phase='rollback';await ports.exec(p.cutoverRollback);x=await ports.query(p.check);if(x?.kind!=='state'||!x.q||x.c_rollback||x.c_commit||!x.freeze||x.attempts||x.service||!x.baseline)fail();
  phase='commit';await ports.exec(p.cutoverCommit);x=await ports.query(p.check);if(x?.kind!=='state'||!x.q||x.c_rollback||!x.c_commit||!x.freeze||!x.attempts||!x.service||!x.baseline)fail();
  phase='preflight-after';const after=await ports.query(p.preflight);if(after?.ledger_028_count!==1||after?.ledger_028_matches_authorized_statement!==true)fail();
 }catch{process.stderr.write(JSON.stringify({code:'FULL_CUTOVER_TX_REFUSED',phase})+'\n');fail();}
 return Object.freeze({scenario:'full-cutover-ledger-transaction-pg17',status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
