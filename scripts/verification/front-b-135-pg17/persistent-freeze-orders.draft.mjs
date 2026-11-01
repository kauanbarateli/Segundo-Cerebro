// Offline PG17-only experiment, called exclusively by the qualified runner.
import {qualifyFreeze} from './persistent-freeze-race.draft.mjs';
const fail=()=>{throw Error('FREEZE_ORDER_REFUSED');};
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(n=>Object.hasOwn(x,n));
const pid=x=>Number.isSafeInteger(x)&&x>1;
export function freezeOrderPlan(ctx,composition,guarded,mode){
 if(!exact(ctx,['nonce','systemIdentifier'])||!/^[a-f0-9]{32}$/.test(ctx.nonce)||!/^\d{16,20}$/.test(ctx.systemIdentifier)||!['reverse','rollback'].includes(mode)||typeof composition!=='string'||composition.split('BEGIN;\n').length!==2||!composition.trimEnd().endsWith('COMMIT;'))fail();
 const freeze=qualifyFreeze(guarded),body=composition.slice(composition.indexOf('BEGIN;\n')+7,composition.lastIndexOf('COMMIT;'));
 const g=`do $sc_guard$ begin if current_user<>'postgres' or current_database()<>'postgres' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::integer<170000 or current_setting('server_version_num')::integer>=180000 or (select system_identifier::text from pg_control_system())<>'${ctx.systemIdentifier}' or (select count(*) from sc_front_b_observation.marker where nonce='${ctx.nonce}' and system_identifier='${ctx.systemIdentifier}')<>1 then raise exception 'OFFLINE_INSTANCE_REFUSED';end if;end $sc_guard$;`;
 const base="set local statement_timeout='20s';set local lock_timeout='15s';",p=`sc.fb.freezeorder.${ctx.nonce}`,oldKeys=['expiredRemoved','consumedScrubbed','originsRemoved','fencedExamined','expiredOriginsCleared'];
 return Object.freeze({oldKeys,
  preflight:`begin read only;${g} select json_build_object('kind','preflight','empty',not exists(select 1 from app_private.signup_intents) and not exists(select 1 from app_private.signup_origins) and not exists(select 1 from app_private.signup_completion_fences_draft));rollback;`,
  writer:`begin;${base}set local application_name='${p}.writer';${g} select json_build_object('kind','writer-start','pid',pg_backend_pid());select json_build_object('kind','writer-result','result',app_private.signup_prune());`,
  cutter:`begin;${base}set local application_name='${p}.cutter';${g} select json_build_object('kind','cutter-start','pid',pg_backend_pid());lock table app_private.signup_intents,app_private.signup_origins in share row exclusive mode;select json_build_object('kind','locked');`,
  waiting:(blocker,waiter,relation,waitmode)=>{if(!pid(blocker)||!pid(waiter)||blocker===waiter||!['intent','origin'].includes(relation)||!['ShareRowExclusiveLock','RowExclusiveLock'].includes(waitmode))fail();const table=relation==='intent'?'signup_intents':'signup_origins';return `begin read only;${g} select json_build_object('kind','waiting','blocked',${blocker}=any(pg_blocking_pids(${waiter})) and exists(select 1 from pg_catalog.pg_locks where pid=${waiter} and relation='app_private.${table}'::regclass and mode='${waitmode}' and not granted));rollback;`;},
  install:`${freeze}\nselect json_build_object('kind','installed');`,
  commit:`${body}\ncommit;select json_build_object('kind','cutover-committed');`,
  rollback:`rollback;select json_build_object('kind','rolled-back');`,
  verifyReverse:`begin;${g} do $verify$ begin begin update app_private.signup_intents set state=state;raise exception 'UNEXPECTED_SUCCESS';exception when sqlstate '55000' then if SQLERRM<>'QA_CUTOVER_PERSISTENT_WRITE_FREEZE' then raise;end if;end;end $verify$;select json_build_object('kind','verified','blocked',true);rollback;`,
  verifyRollback:`begin;${g} update app_private.signup_intents set state=state;select json_build_object('kind','verified','absent',pg_catalog.to_regprocedure('app_private.sc_cutover_freeze_038f()') is null and not exists(select 1 from pg_catalog.pg_trigger where tgname='sc_cutover_freeze_038f'));rollback;`
 });
}
export async function observeFreezeOrder(ports,ctx,composition,guarded,mode){
 const p=freezeOrderPlan(ctx,composition,guarded,mode);if(!ports||['open','query','pause'].some(k=>typeof ports[k]!=='function'))fail();let w,c,closedW=false,closedC=false,error,phase='preflight';
 const kind=(x,k)=>exact(x,['kind'])&&x.kind===k;
 const wait=async(a,b,m)=>{for(let i=0;i<30;i++){const v=await ports.query(p.waiting(a,b,'intent',m));if(!exact(v,['kind','blocked'])||v.kind!=='waiting'||typeof v.blocked!=='boolean')fail();if(v.blocked)return;await ports.pause();}fail();};
 try{
  const pre=await ports.query(p.preflight);if(!exact(pre,['kind','empty'])||pre.kind!=='preflight'||pre.empty!==true)fail();w=await ports.open('writer');c=await ports.open('cutter');if(!w||!c||w===c||[w,c].some(x=>['send','read','close'].some(k=>typeof x[k]!=='function')))fail();
  let writer,cutter;
  if(mode==='reverse'){
   phase='writer-first';await w.send(p.writer);writer=await w.read();const result=await w.read();if(!exact(writer,['kind','pid'])||writer.kind!=='writer-start'||!pid(writer.pid)||!exact(result,['kind','result'])||result.kind!=='writer-result'||!exact(result.result,p.oldKeys))fail();
   phase='cutter-waits';await c.send(p.cutter);cutter=await c.read();if(!exact(cutter,['kind','pid'])||cutter.kind!=='cutter-start'||!pid(cutter.pid))fail();await wait(writer.pid,cutter.pid,'ShareRowExclusiveLock');
   await w.send("commit;select json_build_object('kind','writer-committed');");if(!kind(await w.read(),'writer-committed')||!kind(await c.read(),'locked'))fail();
   phase='install';await c.send(p.install);if(!kind(await c.read(),'installed'))fail();await c.send(p.commit);if(!kind(await c.read(),'cutover-committed'))fail();
  }else{
   phase='cutter-first';await c.send(p.cutter);cutter=await c.read();if(!exact(cutter,['kind','pid'])||cutter.kind!=='cutter-start'||!pid(cutter.pid)||!kind(await c.read(),'locked'))fail();await c.send(p.install);if(!kind(await c.read(),'installed'))fail();
   phase='writer-waits';await w.send(p.writer);writer=await w.read();if(!exact(writer,['kind','pid'])||writer.kind!=='writer-start'||!pid(writer.pid))fail();await wait(cutter.pid,writer.pid,'RowExclusiveLock');
   await c.send(p.rollback);if(!kind(await c.read(),'rolled-back'))fail();const result=await w.read();if(!exact(result,['kind','result'])||result.kind!=='writer-result'||!exact(result.result,p.oldKeys))fail();await w.send("commit;select json_build_object('kind','writer-committed');");if(!kind(await w.read(),'writer-committed'))fail();
  }
  phase='verify';const v=await ports.query(mode==='reverse'?p.verifyReverse:p.verifyRollback);if(mode==='reverse'?(!exact(v,['kind','blocked'])||v.kind!=='verified'||v.blocked!==true):(!exact(v,['kind','absent'])||v.kind!=='verified'||v.absent!==true))fail();
 }catch(e){error=e;}finally{try{if(w)closedW=await w.close()===true;}catch{}try{if(c)closedC=await c.close()===true;}catch{}}
 if(error||!closedW||!closedC){process.stderr.write(JSON.stringify({code:'FREEZE_ORDER_REFUSED',mode,phase,closedW,closedC})+'\n');fail();}
 return Object.freeze({scenario:`persistent-freeze-${mode}-pg17`,status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
