// Synthetic two-session PG17 observation only. Never connect to hosted databases.
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('FRESH_FEEDBACK_CASCADE_REFUSED');};
const once=(s,a,b)=>{if(s.split(a).length!==2)fail();return s.replace(a,()=>b);};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function cascadePlan(ctx,source,fixture,order){
 if(!exact(ctx,['nonce','systemIdentifier'])||!/^[a-f0-9]{32}$/.test(ctx.nonce)||!/^\d{16,20}$/.test(ctx.systemIdentifier)||!['submit-first','delete-first'].includes(order)||!Buffer.isBuffer(source)||hash(source)!=='8081d72004ac2884a34f5a93a93f051ea737cd118a9eb8d92be3340a8215f1e8'||!Buffer.isBuffer(fixture)||hash(fixture)!=='a9c9e5b19ce7758c78c6bba1f152fd8dbef3ec0fa14d9cb9baaeb875316c48b5')fail();
 let sql=source.toString('utf8');sql=once(sql,"DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;",'');sql=once(sql,"DO $event_contract_guard$ BEGIN RAISE EXCEPTION 'DOMAIN_EVENT_CONTRACT_NOT_QUALIFIED'; END $event_contract_guard$;",'');
 let seed=fixture.toString('utf8');seed=once(seed,'CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL);','CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);');
 seed=once(seed,'CREATE TABLE public.domain_events (user_id uuid,','CREATE TABLE public.domain_events (user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,');
 const user='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000001',client='30000000-0000-4000-8000-000000000001',name=`sc.fb.delete.${ctx.nonce}`;
 const guard=`do $g$ begin if current_user<>'postgres' or current_database()<>'postgres' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::integer<>170011 or (select system_identifier::text from pg_control_system())<>'${ctx.systemIdentifier}' or (select count(*) from sc_front_b_observation.marker where nonce='${ctx.nonce}' and system_identifier='${ctx.systemIdentifier}')<>1 then raise exception 'OFFLINE_INSTANCE_REFUSED';end if;end $g$;`;
 const invoke=`public.feedback_barrier_submit('${user}'::uuid,'${session}'::uuid,'${client}'::uuid,'suggestion','Mensagem sintética de teste')`;
 const submit=`set local role service_role; select json_build_object('kind','submitted','pid',pg_backend_pid(),'result',${invoke});`;
 const del=`delete from auth.users where id='${user}'::uuid; select json_build_object('kind','deleted','pid',pg_backend_pid());`;
 const blockedSubmit=`set local role service_role; do $test$ begin begin perform ${invoke}; raise exception 'UNEXPECTED_SUBMIT'; exception when insufficient_privilege then null; end;end $test$; select json_build_object('kind','denied','pid',pg_backend_pid());`;
 const prefix=`set local statement_timeout='20s';set local lock_timeout='15s';`;
 const first=order==='submit-first'?submit:del,second=order==='submit-first'?del:blockedSubmit;
 const checkUser=`'${user}'::uuid`;
 return Object.freeze({seed,sql,first:`begin;${prefix}set local application_name='${name}.a';${guard}${first}`,
 second:`begin;${prefix}set local application_name='${name}.b';${guard}select json_build_object('kind','registered','pid',pg_backend_pid());${second}`,
 wait:(a,b)=>{if(!Number.isSafeInteger(a)||a<1||!Number.isSafeInteger(b)||b<1||a===b)fail();return `begin read only;${guard}select pg_stat_clear_snapshot();select json_build_object('kind','wait','blocked',${a}=any(pg_blocking_pids(${b})),'firstBound',exists(select 1 from pg_stat_activity where pid=${a} and application_name='${name}.a'),'secondBound',exists(select 1 from pg_stat_activity where pid=${b} and application_name='${name}.b'));rollback;`;},
 final:`select json_build_object('userGone',not exists(select 1 from auth.users where id=${checkUser}),'sessionsGone',not exists(select 1 from auth.sessions where user_id=${checkUser}),'requestsGone',not exists(select 1 from app_private.feedback_requests where user_id=${checkUser}),'barriersGone',not exists(select 1 from app_private.feedback_barriers_draft where user_id=${checkUser}),'eventsGone',not exists(select 1 from public.domain_events where user_id=${checkUser}),'otherUserPresent',exists(select 1 from auth.users where id='10000000-0000-4000-8000-000000000002'));`,
 late:`begin; set local role service_role; do $late$ begin begin perform ${invoke}; raise exception 'UNEXPECTED_LATE_SUBMIT'; exception when insufficient_privilege then null; end;end $late$; rollback;`});
}
export async function observeCascade(ports,ctx,source,fixture,order){
 if(!ports||['open','query','exec','pause'].some(k=>typeof ports[k]!=='function'))fail();let phase='plan',a,b,closedA=false,closedB=false,primary;
 try{const p=cascadePlan(ctx,source,fixture,order);phase='install';await ports.exec(p.seed);await ports.exec(p.sql);a=await ports.open();b=await ports.open();if(!a||!b||a===b)fail();
  phase='first';await a.send(p.first);const first=await a.read();if(!Number.isSafeInteger(first?.pid)||first.kind!==(order==='submit-first'?'submitted':'deleted')||order==='submit-first'&&first.result?.status!=='submitted')fail();
  phase='second';await b.send(p.second);const registered=await b.read();if(registered?.kind!=='registered'||!Number.isSafeInteger(registered.pid)||registered.pid===first.pid)fail();
  phase='waiting';let observed=false;for(let i=0;i<50;i++){const w=await ports.query(p.wait(first.pid,registered.pid));if(w?.kind!=='wait'||['blocked','firstBound','secondBound'].some(k=>typeof w[k]!=='boolean'))fail();if(w.blocked&&w.firstBound&&w.secondBound){observed=true;break;}await ports.pause();}if(!observed)fail();
  phase='first-commit';await a.send("commit;select json_build_object('kind','committed','pid',pg_backend_pid());");const committed=await a.read();if(committed?.kind!=='committed'||committed.pid!==first.pid)fail();
  phase='second-result';const second=await b.read();if(second?.kind!==(order==='submit-first'?'deleted':'denied')||second.pid!==registered.pid)fail();
  await b.send("commit;select json_build_object('kind','committed','pid',pg_backend_pid());");const committedB=await b.read();if(committedB?.kind!=='committed'||committedB.pid!==registered.pid)fail();
  phase='final';const result=await ports.query(p.final);if(!result||['userGone','sessionsGone','requestsGone','barriersGone','eventsGone','otherUserPresent'].some(k=>result[k]!==true))fail();await ports.exec(p.late);
 }catch(error){primary=error;const reason=['COMMAND_FAILED','COMMAND_TIMEOUT','COMMAND_UNAVAILABLE','COMMAND_GROUP_UNCONFIRMED'].includes(error?.code)?error.code:'OTHER';process.stderr.write(JSON.stringify({code:'FRESH_FEEDBACK_CASCADE_REFUSED',order,phase,reason})+'\n');}finally{try{if(a)closedA=await a.close()===true;}catch{}try{if(b)closedB=await b.close()===true;}catch{}}
 if(primary||!closedA||!closedB)fail();return Object.freeze({scenario:`fresh-feedback-cascade-${order}-pg17`,status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
