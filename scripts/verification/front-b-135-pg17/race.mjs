// Scratch extension contract: no Docker/PG imports, no auto-execution.
// Ports MUST come exclusively from a separately reviewed offline runner.
const hex=/^[a-f0-9]{32}$/, sys=/^\d{16,20}$/,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad=()=>{throw Error('RACE_REFUSED');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function context(v){if(!exact(v,['nonce','systemIdentifier','user','session','intent','requestA','requestB'])||!hex.test(v.nonce)||!sys.test(v.systemIdentifier)||['user','session','intent','requestA','requestB'].some(k=>!uuid.test(v[k]))||v.requestA===v.requestB)bad();return v;}
const guard=c=>`do $sc_guard$ begin if current_user<>'postgres' or current_database()<>'postgres' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::integer<170000 or current_setting('server_version_num')::integer>=180000 or (select system_identifier::text from pg_control_system())<>'${c.systemIdentifier}' or (select count(*) from sc_front_b_observation.marker where nonce='${c.nonce}' and system_identifier='${c.systemIdentifier}')<>1 then raise exception 'OFFLINE_INSTANCE_REFUSED';end if;end $sc_guard$;`;
const reserve=(c,r)=>`app_private.draft_reserve_completion('${c.user}'::uuid,'${c.session}'::uuid,'${c.intent}'::uuid,'${'a'.repeat(64)}','${r}'::uuid,'terms-v1','privacy-v1',true,'origin-v1')`;
/** Fresh fixture per case; seed generation is returned only to the local runner. */
export function seedStartSql(input){const c=context(input);return `begin;${guard(c)} select json_build_object('kind','seed','result',${reserve(c,c.requestA)});commit;`;}
/** Each nullable-control mutation and refused call rolls back in the same session. */
export function nullCaseSql(input,name){const c=context(input);const mutations={
 intent_state:`update app_private.signup_intents set state=null where id='${c.intent}'::uuid;`,
 intent_expiry:`update app_private.signup_intents set expires_at=null where id='${c.intent}'::uuid;`,
 admission_origin:`update app_private.user_admission set origin=null where user_id='${c.user}'::uuid;`,
 admission_state:`update app_private.user_admission set state=null where user_id='${c.user}'::uuid;`,
 identity_null:"create or replace function app_private.signup_pending_identity(p_user uuid,p_session uuid) returns boolean language sql stable as $identity$ select null::boolean $identity$;"
 };if(!Object.hasOwn(mutations,name))bad();return `begin;${guard(c)} ${mutations[name]} do $nullcase$ begin begin perform ${reserve(c,c.requestA)};raise exception 'unexpected admission' using errcode='P0001';exception when sqlstate '42501' then null;end;if exists(select 1 from app_private.signup_completion_fences_draft where user_id='${c.user}'::uuid) then raise exception 'unexpected fence';end if;end $nullcase$;select json_build_object('kind','null-refused','case','${name}');rollback;`;}
export function nullBaselineSql(input){const c=context(input);return `begin read only;${guard(c)} select json_build_object('kind','baseline','intact',exists(select 1 from app_private.signup_intents where id='${c.intent}'::uuid and state='bound' and expires_at>now() and origin is not null) and exists(select 1 from app_private.user_admission where user_id='${c.user}'::uuid and origin='unclassified' and state='pending') and app_private.signup_pending_identity('${c.user}'::uuid,'${c.session}'::uuid) is true and not exists(select 1 from app_private.signup_completion_fences_draft where user_id='${c.user}'::uuid));rollback;`;}
/** SQL contains only validated synthetic fixture IDs and fixed literals. */
export function racePlan(input,generation=null){const c=context(input),prefix=`sc.fb.race.${c.nonce}`;if(generation!==null&&!uuid.test(generation))bad();
 const start=`app_private.draft_start_completion('${c.user}'::uuid,'${c.session}'::uuid,'${c.intent}'::uuid,'${'a'.repeat(64)}','${c.requestA}'::uuid,'${generation}'::uuid)`;
 const firstCall=generation===null?reserve(c,c.requestA):start,secondCall=generation===null?reserve(c,c.requestB):start,phase=generation===null?'reserved':'auth_in_flight';return Object.freeze({
 first:`begin;set local statement_timeout='20s';set local lock_timeout='15s';set local application_name='${prefix}.a';${guard(c)} select json_build_object('kind','first','pid',pg_backend_pid(),'result',${firstCall});`,
 second:`begin;set local statement_timeout='20s';set local lock_timeout='15s';set local application_name='${prefix}.b';${guard(c)} select json_build_object('kind','registered','pid',pg_backend_pid());select json_build_object('kind','second','pid',pg_backend_pid(),'result',${secondCall});`,
 observer:(a,b)=>{if(!Number.isSafeInteger(a)||a<1||!Number.isSafeInteger(b)||b<1||a===b)bad();return `begin read only;${guard(c)} select pg_stat_clear_snapshot();select json_build_object('kind','wait','blocked',${a}=any(pg_blocking_pids(${b})),'distinct',${a}<>${b},'firstBound',exists(select 1 from pg_stat_activity where pid=${a} and application_name='${prefix}.a'),'secondBound',exists(select 1 from pg_stat_activity where pid=${b} and application_name='${prefix}.b'));rollback;`;},
 final:`begin read only;${guard(c)} select json_build_object('kind','final','count',(select count(*) from app_private.signup_completion_fences_draft where user_id='${c.user}'::uuid),'bound',(select count(*)=1 from app_private.signup_completion_fences_draft where user_id='${c.user}'::uuid and intent_id='${c.intent}'::uuid and request_id='${c.requestA}'::uuid and phase='${phase}'${generation===null?'':` and generation='${generation}'::uuid`}));rollback;`
 });}
/** Explicit wait-edge; sleeps/polling alone never establish concurrency. */
export async function observeReservationRace(ports,input,generation=null){
 const plan=racePlan(input,generation);if(!ports||['open','query','pause'].some(k=>typeof ports[k]!=='function'))bad();let a,b,closedA=false,closedB=false,primary;
 try{
  a=await ports.open('a');b=await ports.open('b');if(!a||!b||a===b||[a,b].some(x=>['send','read','close'].some(k=>typeof x[k]!=='function')))bad();
  await a.send(plan.first);const first=await a.read();if(!exact(first,['kind','pid','result'])||first.kind!=='first'||!Number.isSafeInteger(first.pid))bad();if(generation===null?(!exact(first.result,['status','requestId','generation'])||first.result.status!=='acquired'||first.result.requestId!==input.requestA||!uuid.test(first.result.generation)):first.result!==true)bad();
  await b.send(plan.second);const registered=await b.read();if(!exact(registered,['kind','pid'])||registered.kind!=='registered'||!Number.isSafeInteger(registered.pid)||registered.pid===first.pid)bad();
  let seen=false;for(let n=0;n<50;n++){const w=await ports.query(plan.observer(first.pid,registered.pid));if(!exact(w,['kind','blocked','distinct','firstBound','secondBound'])||w.kind!=='wait'||['blocked','distinct','firstBound','secondBound'].some(k=>typeof w[k]!=='boolean'))bad();if(w.blocked&&w.distinct&&w.firstBound&&w.secondBound){seen=true;break;}await ports.pause();}if(!seen)bad();
  await a.send("commit;select json_build_object('kind','committed','pid',pg_backend_pid());");const committedA=await a.read();if(!exact(committedA,['kind','pid'])||committedA.kind!=='committed'||committedA.pid!==first.pid)bad();
  const second=await b.read();if(!exact(second,['kind','pid','result'])||second.kind!=='second'||second.pid!==registered.pid)bad();if(generation===null?(!exact(second.result,['status'])||second.result.status!=='pending'):second.result!==false)bad();
  await b.send("commit;select json_build_object('kind','committed','pid',pg_backend_pid());");const committedB=await b.read();if(!exact(committedB,['kind','pid'])||committedB.kind!=='committed'||committedB.pid!==registered.pid)bad();
  const final=await ports.query(plan.final);if(!exact(final,['kind','count','bound'])||final.kind!=='final'||final.count!==1||final.bound!==true)bad();
 }catch(error){primary=error;}
 finally{try{if(a)closedA=await a.close()===true;}catch{}try{if(b)closedB=await b.close()===true;}catch{}}
 if(primary||!closedA||!closedB)bad();return Object.freeze({scenario:generation===null?'reservation-exclusive-pg17':'start-exclusive-pg17',status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
