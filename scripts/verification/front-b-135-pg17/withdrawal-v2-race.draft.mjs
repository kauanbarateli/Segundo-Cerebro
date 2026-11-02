// Offline fixture only: the caller must bind the supplied ports to an inspected PG17 container.
const hex=/^[a-f0-9]{32}$/,sys=/^\d{16,20}$/,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=()=>{throw Error('WITHDRAWAL_RACE_REFUSED');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function withdrawalPlan(c,old,order){
 if(!exact(c,['nonce','systemIdentifier','user','session'])||!hex.test(c.nonce)||!sys.test(c.systemIdentifier)||!uuid.test(c.user)||!uuid.test(c.session)||!uuid.test(old)||!['renew-first','withdraw-first'].includes(order))fail();
 const guard=`do $g$ begin if current_user<>'postgres' or current_database()<>'postgres' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::integer<170000 or current_setting('server_version_num')::integer>=180000 or (select system_identifier::text from pg_control_system())<>'${c.systemIdentifier}' or (select count(*) from sc_front_b_observation.marker where nonce='${c.nonce}' and system_identifier='${c.systemIdentifier}')<>1 then raise exception 'OFFLINE_INSTANCE_REFUSED';end if;end $g$;`;
 const name=`sc.fb.withdraw.${c.nonce}`,base=`set local statement_timeout='20s';set local lock_timeout='15s';`, lock=`pg_catalog.hashtextextended('${c.user}' || ':signup',0)`;
 const withdraw=`public.signup_origin_withdraw_v2('${c.user}'::uuid,'${c.session}'::uuid,'${old}'::uuid)`;
 const renew=`do $renew$ begin perform pg_advisory_xact_lock(${lock}); insert into app_private.signup_origins(user_id,origin,consent_version,consented_at,expires_at) values('${c.user}'::uuid,'{"utm_source":"synthetic"}','v1',clock_timestamp(),clock_timestamp()+interval '1 year') on conflict(user_id) do update set origin=excluded.origin,consented_at=excluded.consented_at,expires_at=excluded.expires_at; end $renew$;`;
 const act=order==='renew-first'?`${renew} select json_build_object('kind','first','pid',pg_backend_pid());`:`select json_build_object('kind','first','pid',pg_backend_pid(),'result',${withdraw});`;
 const second=order==='renew-first'?`select json_build_object('kind','second','pid',pg_backend_pid(),'result',${withdraw});`:`${renew} select json_build_object('kind','second','pid',pg_backend_pid());`;
 return {first:`begin;${base}set local application_name='${name}.a';${guard}${act}`,second:`begin;${base}set local application_name='${name}.b';${guard}select json_build_object('kind','registered','pid',pg_backend_pid());${second}`,
 wait:(a,b)=>{if(!Number.isSafeInteger(a)||a<1||!Number.isSafeInteger(b)||b<1||a===b)fail();return `begin read only;${guard} select pg_stat_clear_snapshot();select json_build_object('kind','wait','blocked',${a}=any(pg_blocking_pids(${b})),'firstBound',exists(select 1 from pg_stat_activity where pid=${a} and application_name='${name}.a'),'secondBound',exists(select 1 from pg_stat_activity where pid=${b} and application_name='${name}.b'));rollback;`;},
 final:`begin;${guard} select json_build_object('kind','final','active',(select count(*)=1 from app_private.signup_origins where user_id='${c.user}'::uuid and origin_revision<>'${old}'::uuid),'oldResult',public.signup_origin_withdraw_v2('${c.user}'::uuid,'${c.session}'::uuid,'${old}'::uuid));rollback;`};
}
export async function observeWithdrawalRace(ports,c,old,order){
 const p=withdrawalPlan(c,old,order);if(!ports||['open','query','pause'].some(k=>typeof ports[k]!=='function'))fail();let a,b,closedA=false,closedB=false,primary;
 try{
  a=await ports.open();b=await ports.open();if(!a||!b||a===b)fail();await a.send(p.first);const first=await a.read();
  if(first?.kind!=='first'||!Number.isSafeInteger(first.pid)||order==='withdraw-first'&&first.result?.status!=='withdrawn')fail();
  await b.send(p.second);const registered=await b.read();if(registered?.kind!=='registered'||!Number.isSafeInteger(registered.pid)||registered.pid===first.pid)fail();
  let observed=false;for(let i=0;i<50;i++){const w=await ports.query(p.wait(first.pid,registered.pid));if(w?.kind!=='wait'||['blocked','firstBound','secondBound'].some(k=>typeof w[k]!=='boolean'))fail();if(w.blocked&&w.firstBound&&w.secondBound){observed=true;break;}await ports.pause();}if(!observed)fail();
  await a.send("commit;select json_build_object('kind','committed','pid',pg_backend_pid());");const committedA=await a.read();if(committedA?.kind!=='committed'||committedA.pid!==first.pid)fail();
  const second=await b.read();if(second?.kind!=='second'||second.pid!==registered.pid||order==='renew-first'&&second.result?.status!=='stale')fail();
  await b.send("commit;select json_build_object('kind','committed','pid',pg_backend_pid());");const committedB=await b.read();if(committedB?.kind!=='committed'||committedB.pid!==registered.pid)fail();
  const final=await ports.query(p.final);if(final?.kind!=='final'||final.active!==true||final.oldResult?.status!=='stale')fail();
 }catch(error){primary=error;}finally{try{if(a)closedA=await a.close()===true;}catch{}try{if(b)closedB=await b.close()===true;}catch{}}
 if(primary||!closedA||!closedB)fail();return Object.freeze({scenario:`withdrawal-${order}-pg17`,status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
