// Draft only. The qualified #204 runner must provide the isolated container ports.
import { createHash } from 'node:crypto';
import { qualifyFreeze } from './persistent-freeze-race.draft.mjs';
const fail=()=>{throw Error('ORIGIN_218_FREEZE_REFUSED');};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA='02ef5708f3d9bf74d4ecc7d1946461503eb20d6f4cbadd9b6fb98d7ac85ccdff';
const digest=b=>createHash('sha256').update(b).digest('hex');
const pid=x=>Number.isSafeInteger(x)&&x>1;

export function origin218FreezePlan(ctx,freezeBytes,candidateBytes,mode){
 if(!exact(ctx,['nonce','systemIdentifier','user','session'])||!/^[a-f0-9]{32}$/.test(ctx.nonce)||!/^\d{16,20}$/.test(ctx.systemIdentifier)||!UUID.test(ctx.user)||!UUID.test(ctx.session)||!['commit','rollback'].includes(mode))fail();
 if(!Buffer.isBuffer(candidateBytes)||digest(candidateBytes)!==SHA)fail();
 const source=candidateBytes.toString('utf8'), marker='-- Distinct, opaque revisions', end='\nCOMMIT;';
 if(source.split(marker).length!==2||source.split(end).length!==2||!source.includes('$guard$')||!source.trimEnd().endsWith('COMMIT;'))fail();
 const body=source.slice(source.indexOf(marker),source.indexOf(end));
 const freeze=qualifyFreeze(freezeBytes), prefix=`sc.fb.218.${ctx.nonce}`;
 const checkStart=freeze.indexOf('do $freeze_check$'),checkEnd=freeze.indexOf('end $freeze_check$;',checkStart);
 if(checkStart<0||checkEnd<0||freeze.indexOf('do $freeze_check$',checkStart+1)!==-1)fail();
 const freezeCheck=freeze.slice(checkStart,checkEnd+'end $freeze_check$;'.length);
 const guard=`do $sc_guard$ begin if current_user<>'postgres' or current_database()<>'postgres' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::integer<170000 or current_setting('server_version_num')::integer>=180000 or (select system_identifier::text from pg_control_system())<>'${ctx.systemIdentifier}' or (select count(*) from sc_front_b_observation.marker where nonce='${ctx.nonce}' and system_identifier='${ctx.systemIdentifier}')<>1 then raise exception 'OFFLINE_INSTANCE_REFUSED';end if;end $sc_guard$;`;
 const timeouts="set local statement_timeout='20s';set local lock_timeout='15s';";
 const wrapper=`create function public.sc_test_origin218_old(u uuid,s uuid) returns jsonb language plpgsql security invoker set search_path='' as $test$ begin perform public.signup_origin_withdraw(u,s);return pg_catalog.jsonb_build_object('blocked',false);exception when sqlstate '55000' then if SQLERRM<>'QA_CUTOVER_PERSISTENT_WRITE_FREEZE' then raise;end if;return pg_catalog.jsonb_build_object('blocked',true);end $test$;`;
 return Object.freeze({
  setup:`begin;${guard}${freeze}\n${wrapper}commit;select json_build_object('kind','setup');`,
  cutter:`begin;${timeouts}set local application_name='${prefix}.cutter';${guard}select json_build_object('kind','cutter','pid',pg_backend_pid());lock table app_private.signup_intents,app_private.signup_origins in access exclusive mode;select json_build_object('kind','locked');`,
  writer:`begin;${timeouts}set local application_name='${prefix}.writer';${guard}select json_build_object('kind','writer','pid',pg_backend_pid());set local role service_role;select json_build_object('kind','old-result','result',public.sc_test_origin218_old('${ctx.user}'::uuid,'${ctx.session}'::uuid));reset role;commit;select json_build_object('kind','writer-done');`,
  waiting:(blocker,waiter)=>{if(!pid(blocker)||!pid(waiter)||blocker===waiter)fail();return `begin read only;${guard}select json_build_object('kind','waiting','blocked',${blocker}=any(pg_blocking_pids(${waiter})) and exists(select 1 from pg_catalog.pg_locks where pid=${waiter} and relation='app_private.signup_intents'::regclass and mode='RowShareLock' and not granted) and exists(select 1 from pg_stat_activity where pid=${waiter} and application_name='${prefix}.writer' and state='active'));rollback;`;},
  cutover:`alter table app_private.signup_intents disable trigger sc_cutover_freeze_038f;alter table app_private.signup_origins disable trigger sc_cutover_freeze_038f;${body}\nalter table app_private.signup_intents enable always trigger sc_cutover_freeze_038f;alter table app_private.signup_origins enable always trigger sc_cutover_freeze_038f;${mode};select json_build_object('kind','cutover-${mode}');`,
  verify:`begin read only;${guard}${freezeCheck}select json_build_object('kind','verify','v2',to_regprocedure('public.signup_origin_withdraw_v2(uuid,uuid,uuid)') is not null,'freeze',((select count(*) from pg_trigger where tgname='sc_cutover_freeze_038f' and tgenabled='A' and not tgisinternal and tgrelid in ('app_private.signup_intents'::regclass,'app_private.signup_origins'::regclass))=2));rollback;`
 });
}

export async function observeOrigin218Freeze(ports,ctx,freezeBytes,candidateBytes,mode){
 const p=origin218FreezePlan(ctx,freezeBytes,candidateBytes,mode);if(!ports||['open','query','pause'].some(k=>typeof ports[k]!=='function'))fail();let a,b,closedA=false,closedB=false,error,phase='setup';
 const kind=(x,k)=>exact(x,['kind'])&&x.kind===k;
 try {
  if(!kind(await ports.query(p.setup),'setup'))fail();a=await ports.open('cutter');b=await ports.open('writer');
  if(!a||!b||a===b||[a,b].some(s=>['send','read','close'].some(k=>typeof s[k]!=='function')))fail();
  phase='lock';await a.send(p.cutter);const c=await a.read();if(!exact(c,['kind','pid'])||c.kind!=='cutter'||!pid(c.pid)||!kind(await a.read(),'locked'))fail();
  phase='old-in-flight';await b.send(p.writer);const w=await b.read();if(!exact(w,['kind','pid'])||w.kind!=='writer'||!pid(w.pid)||w.pid===c.pid)fail();
  let waiting=false;for(let i=0;i<30;i++){const row=await ports.query(p.waiting(c.pid,w.pid));if(!exact(row,['kind','blocked'])||row.kind!=='waiting'||typeof row.blocked!=='boolean')fail();if(row.blocked){waiting=true;break;}await ports.pause();}if(!waiting)fail();
  phase='cutover';await a.send(p.cutover);if(!kind(await a.read(),`cutover-${mode}`))fail();
  phase='old-result';const old=await b.read();if(!exact(old,['kind','result'])||old.kind!=='old-result'||!exact(old.result,['blocked'])||old.result.blocked!==true||!kind(await b.read(),'writer-done'))fail();
  phase='verify';const check=await ports.query(p.verify);if(!exact(check,['kind','v2','freeze'])||check.kind!=='verify'||check.freeze!==true||check.v2!==(mode==='commit'))fail();
 }catch(e){error=e;}finally{try{if(a)closedA=await a.close()===true;}catch{}try{if(b)closedB=await b.close()===true;}catch{}}
 if(error||!closedA||!closedB){process.stderr.write(JSON.stringify({code:'ORIGIN_218_FREEZE_REFUSED',mode,phase,closedA,closedB})+'\n');fail();}
 return Object.freeze({scenario:`origin-218-freeze-${mode}-pg17`,status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
