// INERT plan. The existing runner must qualify the offline PG17 container,
// source bytes and session adapter before providing the ports and composition.
const fail=()=>{throw Error('LEGACY_PRUNE_RACE_REFUSED');};
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(n=>Object.hasOwn(x,n));
const pid=x=>Number.isSafeInteger(x)&&x>1;
export function legacyPruneRacePlan(ctx,composition){
 if(!exact(ctx,['nonce','systemIdentifier'])||!/^[a-f0-9]{32}$/.test(ctx.nonce)||!/^\d{16,20}$/.test(ctx.systemIdentifier)||typeof composition!=='string'||!composition.startsWith('BEGIN;\n')||!composition.trimEnd().endsWith('COMMIT;'))fail();
 const guard=`do $sc_guard$ begin if current_user<>'postgres' or current_database()<>'postgres' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::integer<170000 or current_setting('server_version_num')::integer>=180000 or (select system_identifier::text from pg_control_system())<>'${ctx.systemIdentifier}' or (select count(*) from sc_front_b_observation.marker where nonce='${ctx.nonce}' and system_identifier='${ctx.systemIdentifier}')<>1 then raise exception 'OFFLINE_INSTANCE_REFUSED';end if;end $sc_guard$;`;
 const body=composition.slice('BEGIN;\n'.length,composition.lastIndexOf('COMMIT;'));
 const prefix=`sc.fb.legacy.${ctx.nonce}`;
 return Object.freeze({
  preflight:`begin read only;${guard} select json_build_object('kind','preflight','empty',not exists(select 1 from app_private.signup_intents) and not exists(select 1 from app_private.signup_completion_fences_draft));rollback;`,
  first:`begin;set local statement_timeout='20s';set local lock_timeout='15s';set local application_name='${prefix}.a';${guard} lock table app_private.signup_intents in share row exclusive mode;select json_build_object('kind','first','pid',pg_backend_pid());`,
  second:`begin;set local statement_timeout='20s';set local lock_timeout='15s';set local application_name='${prefix}.b';${guard} select json_build_object('kind','second-start','pid',pg_backend_pid());select json_build_object('kind','old-return','result',app_private.signup_prune());commit;`,
  waiting:(a,b)=>{if(!pid(a)||!pid(b)||a===b)fail();return `begin read only;${guard} select json_build_object('kind','waiting','blocked',${a}=any(pg_blocking_pids(${b})) and exists(select 1 from pg_catalog.pg_locks where pid=${b} and relation='app_private.signup_intents'::regclass and mode='RowExclusiveLock' and not granted) and exists(select 1 from pg_stat_activity where pid=${b} and application_name='${prefix}.b' and state='active'));rollback;`;},
  cutover:`${body}\ncreate or replace function app_private.signup_prune() returns jsonb language sql security definer set search_path='' as $sentinel$ select '{"testOnlyNewBody":true}'::jsonb $sentinel$;commit;select json_build_object('kind','cutover-committed');`,
  fresh:`begin read only;${guard} select json_build_object('kind','fresh','result',app_private.signup_prune());rollback;`
 });
}
export async function observeLegacyPruneRace(ports,ctx,composition){
 const plan=legacyPruneRacePlan(ctx,composition);if(!ports||['open','query','pause'].some(k=>typeof ports[k]!=='function'))fail();let a,b,closedA=false,closedB=false,error,phase='preflight';
 try{
  const pre=await ports.query(plan.preflight);if(!exact(pre,['kind','empty'])||pre.kind!=='preflight'||pre.empty!==true)fail();
  phase='open';a=await ports.open('a');b=await ports.open('b');if(!a||!b||a===b||[a,b].some(x=>['send','read','close'].some(k=>typeof x[k]!=='function')))fail();
  phase='first';await a.send(plan.first);const first=await a.read();if(!exact(first,['kind','pid'])||first.kind!=='first'||!pid(first.pid))fail();
  phase='second';await b.send(plan.second);const second=await b.read();if(!exact(second,['kind','pid'])||second.kind!=='second-start'||!pid(second.pid)||second.pid===first.pid)fail();
  phase='waiting';let observed=false;for(let i=0;i<30;i++){const w=await ports.query(plan.waiting(first.pid,second.pid));if(!exact(w,['kind','blocked'])||w.kind!=='waiting'||typeof w.blocked!=='boolean')fail();if(w.blocked){observed=true;break;}await ports.pause();}if(!observed)fail();
  phase='cutover';await a.send(plan.cutover);const done=await a.read();if(!exact(done,['kind'])||done.kind!=='cutover-committed')fail();
  phase='old-return';const old=await b.read();if(!exact(old,['kind','result'])||old.kind!=='old-return'||!exact(old.result,['expiredRemoved','consumedScrubbed','originsRemoved','fencedExamined','expiredOriginsCleared']))fail();
  phase='fresh';const fresh=await ports.query(plan.fresh);if(!exact(fresh,['kind','result'])||fresh.kind!=='fresh'||!exact(fresh.result,['testOnlyNewBody'])||fresh.result.testOnlyNewBody!==true)fail();
 }catch(e){error=e;}finally{try{if(a)closedA=await a.close()===true;}catch{}try{if(b)closedB=await b.close()===true;}catch{}}
 if(error||!closedA||!closedB){process.stderr.write(JSON.stringify({code:'LEGACY_PRUNE_RACE_REFUSED',phase,closedA,closedB})+'\n');fail();}return Object.freeze({scenario:'legacy-prune-resumes-after-replacement-pg17',status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
