// INERT contract only. No entry point, network, Docker or PostgreSQL client.
// A separately reviewed runner must provide offline-only ports and qualify the
// complete composed candidate + isolated PG17 fixture before using this plan.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=()=>{throw Error('RETENTION_RACE_REFUSED');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function context(v){
 if(!exact(v,['nonce','systemIdentifier','user','session','intent','request'])||!/^[a-f0-9]{32}$/.test(v.nonce)||!/^\d{16,20}$/.test(v.systemIdentifier)||['user','session','intent','request'].some(k=>!uuid.test(v[k])))fail();
 return v;
}
// Same destination contract as race.mjs; names alone cannot qualify an instance.
const guard=c=>`do $sc_guard$ begin if current_user<>'postgres' or current_database()<>'postgres' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::integer<170000 or current_setting('server_version_num')::integer>=180000 or (select system_identifier::text from pg_control_system())<>'${c.systemIdentifier}' or (select count(*) from sc_front_b_observation.marker where nonce='${c.nonce}' and system_identifier='${c.systemIdentifier}')<>1 then raise exception 'OFFLINE_INSTANCE_REFUSED';end if;end $sc_guard$;`;

/** Fixed SQL literals and validated synthetic IDs. No deployment destination. */
export function retentionRacePlan(input,scenario){
 const c=context(input);if(!['renewal','fence'].includes(scenario))fail();
 const prefix=`sc.fb.retention.${c.nonce}`,base=`set local statement_timeout='20s';set local lock_timeout='15s';`;
 // The runner must seed exactly one expired bound intent with origin and a
 // browser attempt still inside its 24h window, no fence and a valid session.
 const preflight=`begin read only;${guard(c)} select json_build_object('kind','preflight','eligible',
  (select count(*)=1 from app_private.signup_intents where id='${c.intent}'::uuid and user_id='${c.user}'::uuid and state='bound' and expires_at<=now() and origin is not null and subject_hash='${'a'.repeat(64)}' and terms_version='terms-v1' and privacy_version='privacy-v1' and origin_consent_version='origin-v1')
  and (select count(*)=1 from app_private.signup_intents where state in ('pending','bound') and expires_at<=now())
  and (select count(*)=1 from app_private.signup_browser_attempts where intent_id='${c.intent}'::uuid and expires_at>now()-interval '24 hours')
  and not exists(select 1 from app_private.signup_completion_fences_draft where user_id='${c.user}'::uuid or intent_id='${c.intent}'::uuid));rollback;`;
 const renew=`app_private.signup_browser_renew('${c.user}'::uuid,'${c.session}'::uuid,'${c.intent}'::uuid,'${'a'.repeat(64)}','terms-v1','privacy-v1',false,'origin-v1',clock_timestamp()+interval '5 minutes')`;
 const reserve=`app_private.draft_reserve_completion('${c.user}'::uuid,'${c.session}'::uuid,'${c.intent}'::uuid,'${'a'.repeat(64)}','${c.request}'::uuid,'terms-v1','privacy-v1',true,'origin-v1')`;
 const action=scenario==='renewal'
  ? `select json_build_object('kind','first','pid',pg_backend_pid(),'result',${renew});`
  // Restore a live expiry to call the real reservation, then synthetically
  // model an uncertain Auth outcome and expiry in the same transaction. B
  // still sees the old expired version. No real external Auth call is made.
  : `select pg_advisory_xact_lock(pg_catalog.hashtextextended('${c.user}' || ':signup',0));update app_private.signup_intents set expires_at=clock_timestamp()+interval '30 minutes' where id='${c.intent}'::uuid;do $capture$ begin perform pg_catalog.set_config('sc.retention.reservation',(${reserve})::text,true);end $capture$;update app_private.signup_completion_fences_draft set phase='uncertain' where user_id='${c.user}'::uuid and intent_id='${c.intent}'::uuid and phase='reserved';update app_private.signup_intents set expires_at=clock_timestamp()-interval '1 second' where id='${c.intent}'::uuid;select json_build_object('kind','first','pid',pg_backend_pid(),'result',current_setting('sc.retention.reservation')::json);`;
 return Object.freeze({
  preflight,
  first:`begin;${base}set local application_name='${prefix}.a';${guard(c)} ${action}`,
  second:`begin;${base}set local application_name='${prefix}.b';${guard(c)} select json_build_object('kind','second','pid',pg_backend_pid(),'result',app_private.signup_prune());commit;select json_build_object('kind','secondCommitted','pid',pg_backend_pid());`,
  held:pid=>{if(!Number.isSafeInteger(pid)||pid<1)fail();return `begin;${guard(c)} select json_build_object('kind','held','ownerActive',exists(select 1 from pg_stat_activity where pid=${pid} and application_name='${prefix}.a' and state='idle in transaction'),'lockHeld',not pg_try_advisory_xact_lock(pg_catalog.hashtextextended('${c.user}' || ':signup',0)));rollback;`;},
  sweep:`begin;${base}${guard(c)} select json_build_object('kind','sweep','result',app_private.signup_prune());commit;`,
  final:`begin read only;${guard(c)} select json_build_object('kind','final','intentPreserved',exists(select 1 from app_private.signup_intents where id='${c.intent}'::uuid and state='bound' and origin is null and origin_consent_version is null and origin_consented_at is null${scenario==='renewal'?' and expires_at>now()':''}),'fencePreserved',exists(select 1 from app_private.signup_completion_fences_draft where user_id='${c.user}'::uuid and intent_id='${c.intent}'::uuid),'fenceOriginExpired',(select origin_expired from app_private.signup_completion_fences_draft where user_id='${c.user}'::uuid and intent_id='${c.intent}'::uuid),'fencePhase',(select phase from app_private.signup_completion_fences_draft where user_id='${c.user}'::uuid and intent_id='${c.intent}'::uuid),'attemptPreserved',exists(select 1 from app_private.signup_browser_attempts where intent_id='${c.intent}'::uuid));rollback;`
 });
}

/** Requires fresh isolated fixture and two independent, tracked SQL sessions. */
export async function observeRetentionRace(ports,input,scenario){
 const plan=retentionRacePlan(input,scenario);if(!ports||['open','query'].some(k=>typeof ports[k]!=='function'))fail();
 let a,b,closedA=false,closedB=false,primary;
 try{
  const initial=await ports.query(plan.preflight);if(!exact(initial,['kind','eligible'])||initial.kind!=='preflight'||initial.eligible!==true)fail();
  a=await ports.open('a');b=await ports.open('b');if(!a||!b||a===b||[a,b].some(x=>['send','read','close'].some(k=>typeof x[k]!=='function')))fail();
  await a.send(plan.first);const first=await a.read();
  if(!exact(first,['kind','pid','result'])||first.kind!=='first'||!Number.isSafeInteger(first.pid)||first.pid<1)fail();
  if(scenario==='renewal'?(first.result?.status!=='renewed'||first.result?.originPending!==false):(first.result?.status!=='acquired'||first.result?.requestId!==input.request||!uuid.test(first.result?.generation??'')))fail();
  // No waiting edge is expected: prune uses pg_try_advisory_xact_lock.
  const held=await ports.query(plan.held(first.pid));if(!exact(held,['kind','ownerActive','lockHeld'])||held.kind!=='held'||held.ownerActive!==true||held.lockHeld!==true)fail();
  await b.send(plan.second);const second=await b.read();
  if(!exact(second,['kind','pid','result'])||second.kind!=='second'||!Number.isSafeInteger(second.pid)||second.pid<1||second.pid===first.pid||second.result?.expiredRemoved!==0||second.result?.fencedExamined!==0||second.result?.expiredOriginsCleared!==0)fail();
  const committedB=await b.read();if(!exact(committedB,['kind','pid'])||committedB.kind!=='secondCommitted'||committedB.pid!==second.pid)fail();
  // B has completed while A still holds the same user lock; now commit A.
  const stillHeld=await ports.query(plan.held(first.pid));if(!exact(stillHeld,['kind','ownerActive','lockHeld'])||stillHeld.kind!=='held'||stillHeld.ownerActive!==true||stillHeld.lockHeld!==true)fail();
  await a.send("commit;select json_build_object('kind','committed','pid',pg_backend_pid());");const committed=await a.read();
  if(!exact(committed,['kind','pid'])||committed.kind!=='committed'||committed.pid!==first.pid)fail();
  const sweep=await ports.query(plan.sweep);
  if(!exact(sweep,['kind','result'])||sweep.kind!=='sweep'||sweep.result?.expiredRemoved!==0||sweep.result?.fencedExamined!==(scenario==='fence'?1:0)||sweep.result?.expiredOriginsCleared!==(scenario==='fence'?1:0))fail();
  const final=await ports.query(plan.final);
  if(!exact(final,['kind','intentPreserved','fencePreserved','fenceOriginExpired','fencePhase','attemptPreserved'])||final.kind!=='final'||final.intentPreserved!==true||final.fencePreserved!==(scenario==='fence')||final.fenceOriginExpired!==(scenario==='fence'?true:null)||final.fencePhase!==(scenario==='fence'?'uncertain':null)||final.attemptPreserved!==true)fail();
 }catch(error){primary=error;}
 finally{try{if(a)closedA=await a.close()===true;}catch{}try{if(b)closedB=await b.close()===true;}catch{}}
 if(primary||!closedA||!closedB)fail();
 return Object.freeze({scenario:`same-browser-${scenario}-prune-pg17`,status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}
