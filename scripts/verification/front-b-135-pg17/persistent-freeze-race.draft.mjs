// Local test plan. Only the qualified offline PG17 runner may supply ports.
import {createHash} from 'node:crypto';
const PIN='d31c75970f93d9e04064a0369955e464b199b460cc25c71538fd7188d8455f25';
const fail=()=>{throw Error('PERSISTENT_FREEZE_RACE_REFUSED');};
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(n=>Object.hasOwn(x,n));
const pid=x=>Number.isSafeInteger(x)&&x>1;
export function qualifyFreeze(bytes){
 if(!Buffer.isBuffer(bytes)||createHash('sha256').update(bytes).digest('hex')!==PIN)fail();
 const sql=bytes.toString('utf8'),start='-- Persist beyond the transaction; this deliberately blocks all DML/TRUNCATE.',end='\nrevoke execute on function app_private.signup_prune()';
 if(sql.split(start).length!==2||sql.split(end).length!==2||!sql.includes('$freeze_guard$')||!sql.includes('$quarantine_guard$')||!sql.trimEnd().endsWith('rollback;'))fail();
 const extracted=sql.slice(sql.indexOf(start),sql.indexOf(end));if(!extracted.includes('end $freeze_check$;'))fail();return extracted;
}
export function persistentFreezePlan(ctx,composition,guarded){
 if(!exact(ctx,['nonce','systemIdentifier'])||!/^[a-f0-9]{32}$/.test(ctx.nonce)||!/^\d{16,20}$/.test(ctx.systemIdentifier)||typeof composition!=='string'||composition.split('BEGIN;\n').length!==2||!composition.trimEnd().endsWith('COMMIT;'))fail();
 const freeze=qualifyFreeze(guarded),guard=`do $sc_guard$ begin if current_user<>'postgres' or current_database()<>'postgres' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::integer<170000 or current_setting('server_version_num')::integer>=180000 or (select system_identifier::text from pg_control_system())<>'${ctx.systemIdentifier}' or (select count(*) from sc_front_b_observation.marker where nonce='${ctx.nonce}' and system_identifier='${ctx.systemIdentifier}')<>1 then raise exception 'OFFLINE_INSTANCE_REFUSED';end if;end $sc_guard$;`;
 const body=composition.slice(composition.indexOf('BEGIN;\n')+'BEGIN;\n'.length,composition.lastIndexOf('COMMIT;')),prefix=`sc.fb.freeze.${ctx.nonce}`;
 const wrapper=`create function app_private.sc_test_legacy_guard() returns jsonb language plpgsql set search_path='' as $test$ begin perform app_private.signup_prune();return pg_catalog.jsonb_build_object('guarded',false);exception when sqlstate '55000' then if SQLERRM<>'QA_CUTOVER_PERSISTENT_WRITE_FREEZE' then raise;end if;return pg_catalog.jsonb_build_object('guarded',true);end $test$;`;
 const operations=["insert into app_private.signup_intents default values","update app_private.signup_intents set state=state","delete from app_private.signup_intents","insert into app_private.signup_origins default values","update app_private.signup_origins set origin=origin","delete from app_private.signup_origins"];
 const tests=operations.map(op=>`begin ${op}; raise exception 'TEST_UNEXPECTED_SUCCESS'; exception when sqlstate '55000' then if SQLERRM<>'QA_CUTOVER_PERSISTENT_WRITE_FREEZE' then raise;end if; n:=n+1; end;`).join('\n');
 return Object.freeze({
  preflight:`begin read only;${guard} select json_build_object('kind','preflight','empty',not exists(select 1 from app_private.signup_intents) and not exists(select 1 from app_private.signup_origins) and not exists(select 1 from app_private.signup_completion_fences_draft));rollback;`,
  setup:`begin;${guard} ${wrapper} commit;select json_build_object('kind','setup');`,
  first:`begin;set local statement_timeout='20s';set local lock_timeout='15s';set local application_name='${prefix}.a';${guard} lock table app_private.signup_intents,app_private.signup_origins in share row exclusive mode;select json_build_object('kind','first','pid',pg_backend_pid());`,
  second:`begin;set local statement_timeout='20s';set local lock_timeout='15s';set local application_name='${prefix}.b';${guard} select json_build_object('kind','second-start','pid',pg_backend_pid());select json_build_object('kind','old-return','result',app_private.sc_test_legacy_guard());commit;`,
  waiting:(a,b)=>{if(!pid(a)||!pid(b)||a===b)fail();return `begin read only;${guard} select json_build_object('kind','waiting','blocked',${a}=any(pg_blocking_pids(${b})) and exists(select 1 from pg_catalog.pg_locks where pid=${b} and relation='app_private.signup_intents'::regclass and mode='RowExclusiveLock' and not granted) and exists(select 1 from pg_stat_activity where pid=${b} and application_name='${prefix}.b' and state='active'));rollback;`;},
  cutover:`${freeze}\n${body}\ncommit;select json_build_object('kind','cutover-committed');`,
  verify:`begin;${guard} do $tests$ declare n integer:=0;begin ${tests} if n<>6 then raise exception 'TEST_WRONG_COUNT';end if;end $tests$;select json_build_object('kind','verified','blocked',6,'empty',not exists(select 1 from app_private.signup_intents) and not exists(select 1 from app_private.signup_origins));rollback;`
 });
}
export async function observePersistentFreeze(ports,ctx,composition,guarded){
 const p=persistentFreezePlan(ctx,composition,guarded);if(!ports||['open','query','pause'].some(k=>typeof ports[k]!=='function'))fail();let a,b,closedA=false,closedB=false,error,phase='preflight';
 try{
  const pre=await ports.query(p.preflight);if(!exact(pre,['kind','empty'])||pre.kind!=='preflight'||pre.empty!==true)fail();
  phase='setup';const setup=await ports.query(p.setup);if(!exact(setup,['kind'])||setup.kind!=='setup')fail();
  phase='open';a=await ports.open('a');b=await ports.open('b');if(!a||!b||a===b||[a,b].some(x=>['send','read','close'].some(k=>typeof x[k]!=='function')))fail();
  phase='first';await a.send(p.first);const first=await a.read();if(!exact(first,['kind','pid'])||first.kind!=='first'||!pid(first.pid))fail();
  phase='second';await b.send(p.second);const second=await b.read();if(!exact(second,['kind','pid'])||second.kind!=='second-start'||!pid(second.pid)||second.pid===first.pid)fail();
  phase='waiting';let observed=false;for(let i=0;i<30;i++){const w=await ports.query(p.waiting(first.pid,second.pid));if(!exact(w,['kind','blocked'])||w.kind!=='waiting'||typeof w.blocked!=='boolean')fail();if(w.blocked){observed=true;break;}await ports.pause();}if(!observed)fail();
  phase='cutover';await a.send(p.cutover);const done=await a.read();if(!exact(done,['kind'])||done.kind!=='cutover-committed')fail();
  phase='old-return';const old=await b.read();if(!exact(old,['kind','result'])||old.kind!=='old-return'||!exact(old.result,['guarded'])||old.result.guarded!==true)fail();
  phase='verify';const v=await ports.query(p.verify);if(!exact(v,['kind','blocked','empty'])||v.kind!=='verified'||v.blocked!==6||v.empty!==true)fail();
 }catch(e){error=e;}finally{try{if(a)closedA=await a.close()===true;}catch{}try{if(b)closedB=await b.close()===true;}catch{}}
 if(error||!closedA||!closedB){process.stderr.write(JSON.stringify({code:'PERSISTENT_FREEZE_RACE_REFUSED',phase,closedA,closedB})+'\n');fail();}
 return Object.freeze({scenario:'legacy-prune-blocked-by-persistent-freeze-pg17',status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
