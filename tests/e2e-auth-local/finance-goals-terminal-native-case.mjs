/** Native CI case only. Imports create no process, account, connection or service. */
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { GoalNativeError, GOAL_NATIVE_CASES, GOAL_NATIVE_CHECKS, GOAL_NATIVE_LIMITS, nativeRefuse } from "./finance-goals-terminal-native-contract.mjs";
import { createGoalNativeSession } from "./finance-goals-terminal-native-session.mjs";
import { goalNativeStatement } from "./finance-goals-terminal-native-sql.mjs";
const equal = (a,b) => { if (!isDeepStrictEqual(a,b)) nativeRefuse("MATERIAL_REFUSED"); };
const requireThat = (value, code="MATERIAL_REFUSED") => { if (!value) nativeRefuse(code); };
const clone = value => structuredClone(value);
const plain = value => { requireThat(value && Object.getPrototypeOf(value)===Object.prototype); return value; };
const keys = ["goals","reservations","releases","highlights","ledger","accounts","events","receipts","dispositions","limits","revisions","accountTotals","goalTotals","releaseTotals"];
function material(value) { for (const owner of [value.a,value.b]) { plain(owner); equal(Object.keys(owner).sort(),keys.slice().sort()); for (const key of keys) requireThat(Array.isArray(owner[key]) && owner[key].length<=128); } return value; }
function sums(owner) {
  const released = id => owner.releases.filter(r=>r.reservation_id===id).reduce((n,r)=>n+BigInt(r.amount_cents),0n);
  const reserved = (account,goal) => owner.reservations.filter(r=>(!account||r.account_id===account)&&(!goal||r.goal_id===goal)).reduce((n,r)=>n+BigInt(r.amount_cents)-released(r.id),0n);
  for (const a of owner.accounts) {
    let real=BigInt(a.opening_balance_cents);
    for (const row of owner.ledger) if(row.account_id===a.id && row.deleted_at===null && ["confirmed","reconciled"].includes(row.status)) real+=(row.kind==="income"?1n:-1n)*BigInt(a.kind==="credit_card"?row.amount_cents:row.paid_cents);
    const total=owner.accountTotals.find(t=>t.account_id===a.id);requireThat(total&&total.user_id===a.user_id);requireThat(BigInt(total.real_balance_cents)===real&&BigInt(total.reserved_cents)===reserved(a.id,null));
  }
  for (const g of owner.goals) requireThat(BigInt(owner.goalTotals.find(t=>t.goal_id===g.id)?.saved_cents)===reserved(null,g.id));
  for (const r of owner.reservations) requireThat(BigInt(owner.releaseTotals.find(t=>t.reservation_id===r.id)?.released_cents)===released(r.id));
  const revision=owner.revisions[0]?.revision??"0";for(const key of ["accountTotals","goalTotals","releaseTotals"])for(const total of owner[key])requireThat(total.finance_revision===revision);
}
function oracle(before,after,body,reply,command,weights) {
  material(before);material(after);equal(before.b,after.b);sums(before.a);sums(after.a);sums(after.b);
  const committed=reply.kind==="confirmed", a=before.a,b=after.a;
  const changed=new Set(committed?body.changes.map(c=>({finance_goal:"goals",finance_goal_reservation:"reservations",finance_goal_release:"releases"})[c.type]):[]);
  for(const key of ["goals","reservations","releases","highlights","ledger","accounts"]){
    if(!changed.has(key)){equal(a[key],b[key]);continue;}
    const change=body.changes.find(c=>({finance_goal:"goals",finance_goal_reservation:"reservations",finance_goal_release:"releases"})[c.type]===key);
    requireThat(change.before===null&&b[key].length===a[key].length+1);equal(b[key].filter(r=>r.id!==change.after.id),a[key]);
    const added=b[key].find(r=>r.id===change.after.id);requireThat(added&&added.user_id===change.after.user_id);equal(added.payload,change.after);
    for(const field of ["id","user_id","goal_id","account_id","reservation_id","amount_cents"])if(Object.hasOwn(change.after,field))equal(added[field],change.after[field]);
    if(Object.hasOwn(added,"created_at"))requireThat(Date.parse(added.created_at)===Date.parse(change.after.created_at));
  }
  requireThat(b.receipts.length===a.receipts.length+(committed?1:0)&&b.dispositions.length===a.dispositions.length+(committed?0:1));
  const receipt=b.receipts.find(r=>r.command===command.command&&r.client_id===command.input.client_id);
  const disposition=b.dispositions.find(r=>r.command===command.command&&r.client_id===command.input.client_id);
  requireThat(Boolean(receipt)!==Boolean(disposition));equal(b.receipts.filter(r=>r!==receipt),a.receipts);equal(b.dispositions.filter(r=>r!==disposition),a.dispositions);
  const newEvents=b.events.filter(e=>!a.events.some(old=>old.id===e.id));equal(b.events.filter(e=>a.events.some(old=>old.id===e.id)),a.events);requireThat(newEvents.length===1);
  if(committed){
    equal(receipt.result,reply.result);equal(receipt.result,body.receipt.result);equal(receipt.request,body.receipt.fingerprint);
    const event=body.events[0],actual=newEvents[0];for(const field of ["id","user_id","entity_type","entity_id","action","canal","before","after"])equal(actual[field],event[field]);requireThat(Date.parse(actual.occurred_at)===Date.parse(event.occurred_at));
  }else{
    requireThat(reply.kind==="closed"&&disposition.id===reply.disposition.id);requireThat(newEvents[0].entity_type==="finance_goal_disposition"&&newEvents[0].entity_id===disposition.id&&newEvents[0].action==="created"&&newEvents[0].before===null);equal(newEvents[0].after,reply.disposition);
    equal(Object.keys(disposition).sort(),["id","user_id","command","client_id","version","canonicalization_version","input_digest","closed_at"].sort());
    requireThat(disposition.input_digest==="\\x"+reply.disposition.input_digest&&Date.parse(disposition.closed_at)===Date.parse(reply.disposition.closed_at));
    for(const field of ["id","user_id","command","client_id","version","canonicalization_version"])equal(disposition[field],reply.disposition[field]);
  }
  const oldRevision=BigInt(a.revisions[0]?.revision??"0"),nextRevision=BigInt(b.revisions[0]?.revision??"0");requireThat(b.revisions.length===1&&nextRevision-oldRevision===BigInt(committed?weights.goal+weights.event+weights.receipt:weights.disposition+weights.event));
  const oldLimits=a.limits.filter(l=>l.scope==="capture_task_write"),limits=b.limits.filter(l=>l.scope==="capture_task_write");requireThat(oldLimits.length<=1&&limits.length===1);equal(a.limits.filter(l=>l.scope!=="capture_task_write"),b.limits.filter(l=>l.scope!=="capture_task_write"));
  const prior=oldLimits[0]?.hits??[],current=limits[0].hits;requireThat(current.length===prior.length+1);equal(current.slice(0,-1),prior);requireThat(limits[0].user_id===command.input.user_id||limits[0].user_id===body.context.user_id);
}
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:helper */
import { GOAL_NATIVE_CODES, nativeRecord, nativeData } from "./finance-goals-terminal-native-contract.mjs";
/** Values-only observation. It cannot clear unknown, accept a case or run IO. */
export function goalNativeOracleDiagnostic(input) {
  const v=nativeRecord(nativeData(input),["sourceSha","case","step","firstCode","clients"],"FRAME_REFUSED");
  const roles=["winner","loser","observer","control"],steps=["finish-clients","client-terminals","backend-absence"];
  if(typeof v.sourceSha!=="string"||!/^[a-f0-9]{40}$/.test(v.sourceSha)||!GOAL_NATIVE_CASES.includes(v.case)||!steps.includes(v.step)
    ||!GOAL_NATIVE_CODES.includes(v.firstCode)||["PASSED","NOT_RUN"].includes(v.firstCode)||!Array.isArray(v.clients)||v.clients.length!==4)nativeRefuse("FRAME_REFUSED");
  const clients=v.clients.map((value,index)=>{
    const m=nativeRecord(value,["role","transaction","pending","processPending","failed","unknown","stdoutEof","stderrEof","exited","closed","groupAbsent","closing","terminalCounts"],"FRAME_REFUSED");
    const counts=nativeRecord(m.terminalCounts,["stdoutEnd","stderrEnd","exit","close"],"FRAME_REFUSED");
    if(m.role!==roles[index]||!["idle","open"].includes(m.transaction)||![0,1].includes(m.pending)
      ||m.failed!==null&&(!GOAL_NATIVE_CODES.includes(m.failed)||["PASSED","NOT_RUN"].includes(m.failed))
      ||["processPending","unknown","stdoutEof","stderrEof","exited","closed","groupAbsent","closing"].some(key=>typeof m[key]!=="boolean")
      ||Object.values(counts).some(value=>!Number.isSafeInteger(value)||value<0||value>2))nativeRefuse("FRAME_REFUSED");
    return Object.freeze({...m,terminalCounts:Object.freeze(counts)});
  });
  return Object.freeze({schemaVersion:1,scenario:"finance-goals-terminal-native-oracle-observation",sourceSha:v.sourceSha,case:v.case,step:v.step,firstCode:v.firstCode,clients:Object.freeze(clients),runtimeCertified:false});
}
function emitGoalNativeOracleDiagnostic(sourceSha,kind,step,error,sessions) {
  // Closed values only. A diagnostic failure never replaces the first refusal
  // or bypasses the original abort/finally protocol.
  try {
    const clients=[...sessions].map(([role,session])=>{const m=session.metadata();return{role,transaction:m.transaction,pending:m.pending,processPending:m.processPending,failed:m.failed,unknown:m.unknown,stdoutEof:m.stdoutEof,stderrEof:m.stderrEof,exited:m.exited,closed:m.closed,groupAbsent:m.groupAbsent,closing:m.closing,terminalCounts:m.terminalCounts};});
    console.log(JSON.stringify(goalNativeOracleDiagnostic({sourceSha,case:kind,step,firstCode:error instanceof GoalNativeError?error.code:"MATERIAL_REFUSED",clients})));
  } catch { /* Observation only; original refusal and unknown remain intact. */ }
}
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_END:helper */
/** Four actual psql backends maximum; the session factory is not injectable here. */
export async function runGoalNativeCase({kind,product,context,sessionOptions,actors,cleanupActors,weights,signal}) {
  requireThat(GOAL_NATIVE_CASES.includes(kind),"ENVIRONMENT_REFUSED");
  const row={case:kind,status:"failed",code:"MATERIAL_REFUSED",phase:"baseline",checks:Object.fromEntries(GOAL_NATIVE_CHECKS.map(k=>[k,false])),counts:{receipts:0,dispositions:0,terminalEvents:0,financialEffects:0,financialEvents:0,quotaDelta:0,sessions:0},unknown:false};
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:state */
  let oracleObservationStep=null;
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_END:state */
  const sessions=new Map(),terminals=[];let body,original,reply,before; const writeContext={user_id:actors.a.id,canal:"web"};
  const sql=(session,action,data={})=>session.request(goalNativeStatement(context,action,data));
  const begin=(s,role="service_role")=>sql(s,"BEGIN",{role});
  const rpc=async(s,name,owner,session,operation,request,old=false)=>(await sql(s,old?"OLD_EXECUTOR":"RPC",{rpc:name,owner,session,operation,request:clone(request)})).value;
  const call=async(s,name,actor,intent,request=intent,old=false)=>rpc(s,name,actor.id,actor.sessionId,intent.command,request,old);
  const transaction=async(s,work,role="service_role")=>{await begin(s,role);try{const result=await work();await sql(s,"COMMIT");return result;}catch(error){if(!s.metadata().failed&&s.metadata().transaction==="open")await sql(s,"ROLLBACK");throw error;}};
  async function plan(s,intent,actor=actors.a){
    let batch=null;const gateway=product.createFinanceGoalsGateway(actor.id,actor.sessionId,intent.command,async(name,args)=>{requireThat(name==="finance_goals_snapshot");return call(s,name,actor,intent,args.p_request);});
    const planner={...gateway,async commit(value){requireThat(batch===null);batch=clone(value);return{status:"stale"};}};
    const deps={ids:{next:()=>randomUUID()},clock:{now:()=>new Date().toISOString()}};let refused=false;
    try{await product.executeGoalCommand(product.createFinanceGoalsStore(planner,intent),deps,writeContext,intent);}catch(error){refused=error?.code==="CONFLICT";}
    requireThat(refused&&batch&&batch.changes.length===1&&batch.events.length===1);return batch;
  }
  async function executeSetup(s,intent){return transaction(s,async()=>{const batch=await plan(s,intent);const value=await call(s,"finance_goals_commit",actors.a,intent,batch);requireThat(value.status==="committed");return product.decodeGoalCommandResult(value.result,intent,actors.a.id);});}
  const read=()=>sql(sessions.get("control"),"MATERIAL",{a:actors.a.id,b:actors.b.id});
  try{
    for(const role of ["winner","loser","observer","control"]){const s=createGoalNativeSession({...sessionOptions,context,signal,applicationName:sessionOptions.environment.PGAPPNAME.replace(/control$/,role),environment:{...sessionOptions.environment,PGAPPNAME:sessionOptions.environment.PGAPPNAME.replace(/control$/,role)}});sessions.set(role,s);await sql(s,"IDENTITY");}
    row.counts.sessions=4;const pids=[...sessions.values()].map(s=>s.metadata().backendPid);requireThat(new Set(pids).size===4,"INSTANCE_REFUSED");row.checks.instanceBound=row.checks.distinctBackends=true;
    const winner=sessions.get("winner"),loser=sessions.get("loser"),observer=sessions.get("observer"),control=sessions.get("control");
    const at=new Date().toISOString(),accountA=randomUUID(),accountB=randomUUID();await transaction(control,()=>sql(control,"FIXTURE",{a:actors.a.id,b:actors.b.id,a1:actors.a.sessionId,a2:actors.a2.sessionId,b1:actors.b.sessionId,accountA,accountB,at}),"postgres");row.checks.actorsBound=true;
    const state=()=>sql(control,"STATE",{owner:actors.a.id});let current=await state();
    const create=revision=>({command:"finance.goal.create",input:{client_id:randomUUID(),expected_finance_revision:revision,name:"Meta nativa sintética",target_cents:10000,deadline:null,image_file_id:null}});
    let goal=null,reservation=null;
    if(!kind.startsWith("CREATE_")){goal=(await executeSetup(control,create(current.revision))).goal;current=await state();}
    if(kind.startsWith("RELEASE_")){reservation=(await executeSetup(control,{command:"finance.goal.contribute",input:{client_id:randomUUID(),expected_finance_revision:current.revision,goal_id:goal.id,expected_revision:goal.revision,account_id:accountA,amount_cents:1000,occurred_on:current.day}})).reservation;current=await state();}
    original=product.decodeGoalCommand(kind.startsWith("CREATE_")?create(current.revision):kind.startsWith("CONTRIBUTE_")?{command:"finance.goal.contribute",input:{client_id:randomUUID(),expected_finance_revision:current.revision,goal_id:goal.id,expected_revision:goal.revision,account_id:accountA,amount_cents:300,occurred_on:current.day}}:{command:"finance.goal.release",input:{client_id:randomUUID(),expected_finance_revision:current.revision,reservation_id:reservation.id,amount_cents:300,occurred_on:current.day}});
    await begin(control);body=await plan(control,original);await sql(control,"ROLLBACK");before=await read();
    const token=product.captureGoalTerminalAttempt(actors.a.id,original),envelope=product.goalTerminalRpcRequest(token);row.phase="winner";
    const commitFirst=kind.endsWith("_COMMIT_FIRST"),old=kind.endsWith("_OLD_EXECUTOR"),two=kind.endsWith("_TWO_SETTLES");
    await begin(winner);const winning=await call(winner,commitFirst?"finance_goals_commit":"finance_goal_attempt_settle",actors.a,original,commitFirst?body:envelope);
    if(commitFirst)requireThat(winning.status==="committed");else requireThat(product.decodeGoalTerminalReply(token,winning).kind==="closed");
    let losingBody=body;
    if(old){const gateway=product.createFinanceGoalsGateway(actors.a.id,actors.a.sessionId,original.command,async(name,args)=>call(winner,name,actors.a,original,args.p_request));const snapshot=await gateway.snapshot(clone(original));const coherent=clone(original);coherent.input.expected_finance_revision=snapshot.finance_revision;losingBody=await plan(winner,coherent);requireThat(losingBody.expected_finance_revision===snapshot.finance_revision);}
    await begin(loser,old?"postgres":"service_role");
    // Install both handlers immediately; a refusal before the barrier is not an
    // unhandled rejection and cannot masquerade as waiting on our winner.
    const pending=call(loser,commitFirst||two?"finance_goal_attempt_settle":"finance_goals_commit",actors.a2,original,commitFirst||two?envelope:losingBody,old);
    let settled=false;const outcome=pending.then(value=>{settled=true;return{value};},error=>{settled=true;return{error};});
    row.phase="blocked";const deadline=Date.now()+GOAL_NATIVE_LIMITS.barrierMs;let blocked=false;
    while(Date.now()<deadline&&!settled&&!signal.aborted){let watchdog;const limit=new Promise((_,reject)=>{watchdog=setTimeout(()=>{observer.abort();reject(new GoalNativeError("BARRIER_REFUSED"));},Math.max(1,deadline-Date.now()));});let observation;try{observation=await Promise.race([sql(observer,"BLOCKING",{waiter:loser.metadata().backendPid,winner:winner.metadata().backendPid}),limit]);}finally{clearTimeout(watchdog);}requireThat(Date.now()<deadline,"BARRIER_REFUSED");if(observation.blocked&&observation.advisory&&observation.waitType==="Lock"){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,Math.min(GOAL_NATIVE_LIMITS.pollMs,Math.max(0,deadline-Date.now()))));}
    requireThat(blocked&&!settled,"BARRIER_REFUSED");row.checks.barrierObserved=true;row.phase="release";await sql(winner,"COMMIT");row.checks.winnerCommitted=true;
    const lost=await outcome;
    if(!commitFirst&&!two){requireThat(lost.error instanceof GoalNativeError&&lost.error.code==="SQL_REFUSED"&&lost.error.detail?.sqlState==="23505"&&lost.error.detail.reason==="NAMESPACE_CLOSED");const terminal=await loser.terminal();requireThat(!terminal.unknown&&terminal.sqlRefusal?.reason==="NAMESPACE_CLOSED");terminals.push({session:loser,terminal,expected:"SQL_REFUSED"});reply=product.decodeGoalTerminalReply(token,winning);row.checks.strongReceiptGuard=old;}
    else{requireThat(!lost.error);reply=product.decodeGoalTerminalReply(token,lost.value);requireThat(reply.kind===(commitFirst?"confirmed":"closed"));if(two)equal(reply,product.decodeGoalTerminalReply(token,winning));await sql(loser,"COMMIT");}
    row.checks.loserKnown=true;row.phase="oracle";const after=await read();oracle(before,after,body,reply,original,weights);
    row.checks.receiptExclusive=row.checks.eventBijection=row.checks.fullFinancialRows=row.checks.totalsExact=row.checks.otherOwnerUnchanged=true;
    const stable=clone(after);const replay=await transaction(control,()=>call(control,"finance_goal_attempt_status",actors.a,original,envelope));equal(product.decodeGoalTerminalReply(token,replay),reply);const again=await transaction(control,()=>call(control,"finance_goal_attempt_settle",actors.a2,original,envelope));equal(product.decodeGoalTerminalReply(token,again),reply);equal(await read(),stable);row.checks.sameIntentReplay=true;
    row.counts.receipts=commitFirst?1:0;row.counts.dispositions=commitFirst?0:1;row.counts.terminalEvents=row.counts.dispositions;row.counts.financialEffects=commitFirst?1:0;row.counts.financialEvents=row.counts.financialEffects;row.counts.quotaDelta=1;
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:finish */
    oracleObservationStep="finish-clients";
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_END:finish */
    for(const role of ["winner","loser","observer"]){const s=sessions.get(role);if(!terminals.some(t=>t.session===s))terminals.push({session:s,terminal:await s.finish(),expected:"PASSED"});}
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:terminals */
    oracleObservationStep="client-terminals";
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_END:terminals */
    for(const t of terminals){requireThat(t.terminal.code===t.expected&&!t.terminal.unknown&&t.terminal.stdoutEof&&t.terminal.stderrEof&&t.terminal.groupAbsent,"PROCESS_REFUSED");const m=t.session.metadata();requireThat(!m.pending&&!m.processPending&&m.failed===(t.expected==="PASSED"?null:"SQL_REFUSED")&&Object.values(m.terminalCounts).every(n=>n===1),"PROCESS_REFUSED");}
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:backends */
    oracleObservationStep="backend-absence";
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_END:backends */
    requireThat((await sql(control,"BACKENDS")).other===0,"CLEANUP_UNCONFIRMED");row.checks.quiescent=true;row.phase="cleanup";await cleanupActors();requireThat((await sql(control,"ABSENCE",{a:actors.a.id,b:actors.b.id})).absent,"CLEANUP_UNCONFIRMED");row.checks.fixtureAbsent=true;
    const ended=await control.finish();requireThat(ended.code==="PASSED"&&ended.groupAbsent&&ended.stdoutEof&&ended.stderrEof,"CLEANUP_UNCONFIRMED");row.checks.originalGraph=row.checks.sourcePins=true;row.status="passed";row.code="PASSED";row.phase="complete";
  }catch(error){/* DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:catch */
if(row.phase==="oracle"&&oracleObservationStep!==null)emitGoalNativeOracleDiagnostic(context.sourceSha,kind,oracleObservationStep,error,sessions);
/* DOC18_GOAL_ORACLE_OBSERVATION_V1_END:catch */row.code=error instanceof GoalNativeError?error.code:"MATERIAL_REFUSED";for(const s of sessions.values())s.abort();}
  finally{for(const s of sessions.values()){const terminal=await s.terminal();row.unknown ||= terminal.unknown||s.metadata().unknown;if(s.metadata().pending||s.metadata().processPending||!terminal.groupAbsent)row.code="CLEANUP_UNCONFIRMED";}if(row.unknown){row.status="failed";row.code="WRITE_OUTCOME_UNCERTAIN";} }
  return{row,quiet:[...sessions.values()].every(s=>!s.metadata().pending&&!s.metadata().processPending&&s.metadata().groupAbsent),unknown:row.unknown};
}
