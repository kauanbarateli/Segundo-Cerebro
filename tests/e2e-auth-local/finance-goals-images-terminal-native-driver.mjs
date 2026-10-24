/** Candidate native race driver. No import-time side effects, CLI or workflow.
 * All eight group sequences are candidates awaiting independent review.
 * The source-bound runner alone completes source/catalogue checks after this
 * module returns a fully cleaned group; no caller-provided SQL is accepted. */
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { GoalNativeError, GOAL_NATIVE_LIMITS, nativeRefuse } from "./finance-goals-terminal-native-contract.mjs";
import { GOAL_IMAGES_NATIVE_CASES, GOAL_IMAGES_NATIVE_CHECKS } from "./finance-goals-images-terminal-native-contract.mjs";
import { createGoalNativeSession } from "./finance-goals-terminal-native-session.mjs";
import { goalNativeStatement, goalImagesNativeStatement } from "./finance-goals-terminal-native-sql.mjs";
import { GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS, assertGoalImagesCandidateWindows, assertGoalImagesCommit, assertGoalImagesUnchanged, assertGoalImagesCleanup, assertGoalImagesAck, assertGoalImagesClosed, assertGoalImagesHolders } from "./finance-goals-images-terminal-native-case.mjs";
const requireThat=(value,code="MATERIAL_REFUSED")=>{if(!value)nativeRefuse(code);};
const equal=(a,b)=>requireThat(isDeepStrictEqual(a,b));
const copy=value=>structuredClone(value);
export const GOAL_IMAGES_NATIVE_RACE_CASES=GOAL_IMAGES_NATIVE_CASES;
/** At most four actual psql backends. The session factory is not injectable.
 * product/sessionOptions/actors come only from the future source-bound runner;
 * no accepted report or native origin can be constructed by calling this API. */
export async function runGoalImagesNativeRace({kind,product,context,sessionOptions,actors,cleanupActors,weights,signal}) {
  requireThat(GOAL_IMAGES_NATIVE_RACE_CASES.includes(kind),"ENVIRONMENT_REFUSED");
  const row={case:kind,status:"failed",code:"MATERIAL_REFUSED",phase:"baseline",checks:Object.fromEntries(GOAL_IMAGES_NATIVE_CHECKS[kind].map(key=>[key,false])),counts:Object.fromEntries(Object.keys(GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS[kind]).map(key=>[key,0])),unknown:false};
  const sessions=new Map(),terminals=[],windows=[];let completed=false;
  const sql=(session,action,data={})=>session.request(goalNativeStatement(context,action,data));
  const image=(session,action,data={})=>session.request(goalImagesNativeStatement(context,action,data));
  const begin=(session,role="service_role")=>sql(session,"BEGIN",{role});
  const transaction=async(session,work,role="service_role")=>{await begin(session,role);try{const result=await work();await sql(session,"COMMIT");return result;}catch(error){if(!session.metadata().failed&&session.metadata().transaction==="open")await sql(session,"ROLLBACK");throw error;}};
  const rpc=async(session,name,actor,intent,request=intent,old=false)=>(await sql(session,old?"OLD_EXECUTOR":"RPC",{rpc:name,owner:actor.id,session:actor.sessionId,operation:intent.command,request:copy(request)})).value;
  const read=(session=sessions.get("control"))=>image(session,"IMAGE_MATERIAL",{a:actors.a.id,b:actors.b.id});
  const state=(session,actor=actors.a)=>sql(session,"STATE",{owner:actor.id});
  async function plan(session,intent,actor=actors.a) {
    let batch=null;
    const gateway=product.createFinanceGoalsGateway(actor.id,actor.sessionId,intent.command,async(name,args)=>{requireThat(name==="finance_goals_snapshot");return rpc(session,name,actor,intent,args.p_request);});
    const planner={...gateway,async commit(value){requireThat(batch===null);batch=copy(value);return{status:"stale"};}};
    let refused=false;try{await product.executeGoalCommand(product.createFinanceGoalsStore(planner,intent),{ids:{next:randomUUID},clock:{now:()=>new Date().toISOString()}},{user_id:actor.id,canal:"web"},intent);}catch(error){refused=error?.code==="CONFLICT";}
    requireThat(refused&&batch&&batch.changes.length===1&&batch.events.length===1);return batch;
  }
  async function commit(session,intent,batch,actor=actors.a) {
    const value=await rpc(session,"finance_goals_commit",actor,intent,batch);requireThat(value.status==="committed");return product.decodeGoalCommandResult(value.result,intent,actor.id);
  }
  async function setupGoal(session,intent,actor=actors.a) {return transaction(session,async()=>{const batch=await plan(session,intent,actor);return commit(session,intent,batch,actor);});}
  const create=(revision,imageId)=>product.decodeGoalCommand({command:"finance.goal.create",input:{client_id:randomUUID(),expected_finance_revision:revision,name:"Meta nativa com imagem sintética",target_cents:10000,deadline:null,image_file_id:imageId}});
  const update=(revision,goal,imageId)=>product.decodeGoalCommand({command:"finance.goal.update",input:{client_id:randomUUID(),expected_finance_revision:revision,goal_id:goal.id,expected_revision:goal.revision,patch:{image_file_id:imageId}}});
  async function upload(session,actor,kind="finance_goal_image") {
    const uploadId=randomUUID(),clientId=randomUUID(),leaseId=randomUUID(),now=Date.now(),createdAt=new Date(now-3*86400000).toISOString(),updatedAt=new Date(now).toISOString(),expires=new Date(now+120*60000).toISOString();
    const common={owner:actor.id,session:actor.sessionId,uploadId,clientId};
    await transaction(session,async()=>{const value=(await image(session,"IMAGE_RESERVE",{...common,kind,expires})).value;requireThat(value.id===uploadId&&value.user_id===actor.id&&value.status==="reserved"&&value.file_id===null);});
    await transaction(session,async()=>{const value=(await image(session,"IMAGE_CLAIM",{...common,leaseId})).value;requireThat(value.file===null&&value.reservation.id===uploadId&&value.reservation.lease_id===leaseId&&value.reservation.status==="processing");});
    await transaction(session,async()=>{const value=(await image(session,"IMAGE_COMPLETE",{...common,leaseId,kind,createdAt,updatedAt})).value;requireThat(value.id===uploadId&&value.user_id===actor.id&&value.kind===kind&&value.bytes===100&&value.sha256==="a".repeat(64));});
    return uploadId;
  }
  async function block(observer,loser,winner,settled) {
    const deadline=Date.now()+GOAL_NATIVE_LIMITS.barrierMs;let observed=false;
    while(Date.now()<deadline&&!settled()&&!signal.aborted){
      let watchdog;const limit=new Promise((_,reject)=>{watchdog=setTimeout(()=>{observer.abort();reject(new GoalNativeError("BARRIER_REFUSED"));},Math.max(1,deadline-Date.now()));});let fact;
      try{fact=await Promise.race([sql(observer,"BLOCKING",{waiter:loser.metadata().backendPid,winner:winner.metadata().backendPid}),limit]);}finally{clearTimeout(watchdog);}
      requireThat(Date.now()<deadline,"BARRIER_REFUSED");if(fact.blocked&&fact.advisory&&fact.waitType==="Lock"){observed=true;break;}
      await new Promise(resolve=>setTimeout(resolve,Math.min(GOAL_NATIVE_LIMITS.pollMs,Math.max(0,deadline-Date.now()))));
    }
    requireThat(observed&&!settled(),"BARRIER_REFUSED");row.checks.barrierObserved=true;
  }
  function assertTerminal(session,ended,expected) {
    const metadata=session.metadata(),code=expected==="PASSED"?0:3;
    requireThat(ended.code===expected&&!ended.unknown&&ended.stdoutEof&&ended.stderrEof&&ended.groupAbsent&&ended.exitCode===code&&ended.closeCode===code&&ended.exitSignal===null&&ended.closeSignal===null&&!metadata.pending&&!metadata.processPending&&!metadata.unknown&&metadata.closed&&metadata.groupAbsent&&metadata.failed===(expected==="PASSED"?null:"SQL_REFUSED")&&Object.values(metadata.terminalCounts).every(value=>value===1),"PROCESS_REFUSED");
  }
  async function exactRefusal(session,outcome,state,reason) {
    requireThat(outcome.error instanceof GoalNativeError&&outcome.error.code==="SQL_REFUSED"&&outcome.error.detail?.sqlState===state&&outcome.error.detail.reason===reason);
    const terminal=await session.terminal();requireThat(!terminal.unknown&&terminal.sqlRefusal?.sqlState===state&&terminal.sqlRefusal.reason===reason);terminals.push({session,terminal,expected:"SQL_REFUSED"});
  }
  try{
    for(const role of ["winner","loser","observer","control"]){const applicationName=sessionOptions.environment.PGAPPNAME.replace(/control$/,role),session=createGoalNativeSession({...sessionOptions,context,signal,applicationName,environment:{...sessionOptions.environment,PGAPPNAME:applicationName}});sessions.set(role,session);await sql(session,"IDENTITY");}
    const winner=sessions.get("winner"),loser=sessions.get("loser"),observer=sessions.get("observer"),control=sessions.get("control");
    requireThat(new Set([...sessions.values()].map(session=>session.metadata().backendPid)).size===4,"INSTANCE_REFUSED");row.counts.sessions=4;row.checks.instanceBound=row.checks.distinctBackends=true;
    await transaction(control,()=>image(control,"IMAGE_ASSERT_GRANTS"),"postgres");row.checks.imagesInstalled=row.checks.terminalInstalled=true;
    const at=new Date().toISOString();await transaction(control,()=>sql(control,"FIXTURE",{a:actors.a.id,b:actors.b.id,a1:actors.a.sessionId,a2:actors.a2.sessionId,b1:actors.b.sessionId,accountA:randomUUID(),accountB:randomUUID(),at}),"postgres");row.checks.actorsBound=true;
    const target=await upload(control,actors.a),spare=await upload(control,actors.a),foreign=await upload(control,actors.b);
    await setupGoal(control,create((await state(control,actors.b)).revision,foreign),actors.b);
    if(kind==="I5_HOLDERS"){
      const files={avatar:await upload(control,actors.a,"avatar"),capture:await upload(control,actors.a,"capture_image"),project:await upload(control,actors.a,"project_cover"),home:await upload(control,actors.a,"home_focus_image"),habit:await upload(control,actors.a,"habit_image"),page:await upload(control,actors.a,"capture_image"),goal:target,archivedGoal:spare};
      const ids=Object.fromEntries(["project","habit","capture","pageCapture","notebook","page","link","deletionBatch"].map(key=>[key,randomUUID()]));
      const publicHolders=Object.fromEntries(Object.entries(files).filter(([key])=>!["goal","archivedGoal"].includes(key)));
      await transaction(control,()=>image(control,"IMAGE_FIXTURE_HOLDERS",{owner:actors.a.id,files:publicHolders,ids,at:new Date(Date.now()-3*86400000).toISOString()}),"postgres");
      await setupGoal(control,create((await state(control)).revision,target));
      const archivable=(await setupGoal(control,create((await state(control)).revision,spare))).goal;
      const archive=product.decodeGoalCommand({command:"finance.goal.archive",input:{client_id:randomUUID(),expected_finance_revision:(await state(control)).revision,goal_id:archivable.id,expected_revision:archivable.revision}});
      const archived=(await setupGoal(control,archive)).goal;requireThat(archived.image_file_id===spare&&archived.archived_at!==null);
      for(const uploadId of Object.values(files))await transaction(control,()=>image(control,"IMAGE_FIXTURE_AGE",{owner:actors.a.id,uploadId}),"postgres");
      const beforeSelection=await read();assertGoalImagesHolders(beforeSelection,actors.a.id,files);await transaction(control,()=>image(control,"IMAGE_ASSERT_HOLDERS",{owner:actors.a.id,files}),"postgres");windows.push("holders-eight");row.checks.allHolderKinds=row.checks.archivedGoalProtected=row.checks.previousHolderChainPreserved=true;
      // Repeated cleanup excludes every retained file at SELECTION.
      const selected=(await transaction(control,()=>image(control,"IMAGE_CLEANUP_CANDIDATES"))).value;equal(selected,[]);assertGoalImagesUnchanged(beforeSelection,await read());row.checks.selectionRechecked=true;
      // First-pass cleanup selects reservations independently of holder state;
      // it must recheck each holder under the real shared owner lock.
      for(const uploadId of Object.values(files))await transaction(control,()=>image(control,"IMAGE_FIXTURE_FIRST_PASS",{owner:actors.a.id,uploadId}),"postgres");
      const beforeRecheck=await read(),rechecked=(await transaction(control,()=>image(control,"IMAGE_CLEANUP_CANDIDATES"))).value;
      requireThat(Array.isArray(rechecked)&&rechecked.length===8&&new Set(rechecked.map(value=>value.id)).size===8);
      equal(rechecked.map(value=>value.id).sort(),Object.values(files).sort());
      for(const value of rechecked){equal(Object.keys(value).sort(),["id","staging_path","final_path","remove_final"].sort());requireThat(value.remove_final===false&&value.staging_path===actors.a.id+"/"+value.id&&value.final_path===value.staging_path);}
      assertGoalImagesUnchanged(beforeRecheck,await read());windows.push("cleanup-protected");
      // Adversarial, reviewed fixture setup to reach the ACK holder predicate.
      // This is NOT a legitimate product deletion or an observed file proof.
      for(const uploadId of Object.values(files))await transaction(control,()=>image(control,"IMAGE_FIXTURE_TOMBSTONE",{owner:actors.a.id,uploadId,batchId:randomUUID()}),"postgres");
      const beforeAcks=await read();for(const file of beforeAcks.a.files.filter(value=>Object.values(files).includes(value.id)))requireThat(file.deleted_at!==null&&file.purged_at===null);
      await transaction(control,()=>image(control,"IMAGE_ASSERT_HOLDERS",{owner:actors.a.id,files}),"postgres");
      for(const uploadId of Object.values(files)){const before=await read();await transaction(control,()=>image(control,"IMAGE_CLEANUP_ACK",{uploadId}));assertGoalImagesAck(before,await read(),{owner:actors.a.id,uploadId,protected:true});}
      await transaction(control,()=>image(control,"IMAGE_ASSERT_HOLDERS",{owner:actors.a.id,files}),"postgres");windows.push("acks-eight");row.checks.ackHolderRechecked=true;
    }else if(kind==="I8_NEGATIVES_ROLLBACK"){
      // Positive service_role setup is SEPARATE from the postgres winner used
      // for in-transaction observation in the six races. It exercises the same
      // public upload/goal/snapshot/terminal/cleanup wrappers for these actors.
      const positive=create((await state(control)).revision,target),beforePositive=await read();
      await begin(control);const positiveBody=await plan(control,positive),positiveResult=await commit(control,positive,positiveBody);await sql(control,"COMMIT");
      const positiveMaterial=await read();assertGoalImagesCommit(beforePositive,positiveMaterial,{owner:actors.a.id,command:positive,batch:positiveBody,result:positiveResult,weights:{goal:weights.goal,event:weights.event,receipt:weights.receipt}});
      const positiveToken=product.captureGoalTerminalAttempt(actors.a.id,positive),positiveEnvelope=product.goalTerminalRpcRequest(positiveToken);
      const positiveSnapshot=await transaction(control,()=>rpc(control,"finance_goals_snapshot",actors.a,positive));equal(positiveSnapshot.receipt.result,positiveResult);
      for(const name of ["finance_goal_attempt_status","finance_goal_attempt_settle"]){const reply=product.decodeGoalTerminalReply(positiveToken,await transaction(control,()=>rpc(control,name,actors.a,positive,positiveEnvelope)));requireThat(reply.kind==="confirmed");equal(reply.result,positiveResult);}assertGoalImagesUnchanged(positiveMaterial,await read());
      await transaction(control,()=>image(control,"IMAGE_FIXTURE_AGE",{owner:actors.a.id,uploadId:target}),"postgres");const beforePositiveCleanup=await read();
      equal((await transaction(control,()=>image(control,"IMAGE_CLEANUP_CANDIDATES"))).value,[]);assertGoalImagesUnchanged(beforePositiveCleanup,await read());
      await transaction(control,()=>image(control,"IMAGE_CLEANUP_ACK",{uploadId:target}));assertGoalImagesAck(beforePositiveCleanup,await read(),{owner:actors.a.id,uploadId:target,protected:true});row.checks.serviceRolePositive=true;
      // Setup effects above are outside the five negative-operation windows.
      const wrongPurpose=await upload(control,actors.a,"project_cover"),original=create((await state(control)).revision,target);
      await begin(control);const body=await plan(control,original);await sql(control,"ROLLBACK");
      const checkDenied=async(mode,actor,request)=>{const before=await read();await transaction(control,()=>image(control,"IMAGE_ASSERT_DENIED",{owner:actor.id,session:actor.sessionId,request,mode}));assertGoalImagesUnchanged(before,await read());};
      await checkDenied("foreign-owner",actors.b,body);windows.push("owner-refused");row.checks.ownerDenied=true;
      await checkDenied("foreign-session",{id:actors.a.id,sessionId:actors.b.sessionId},body);windows.push("session-refused");row.checks.sessionDenied=true;
      // Deliberately INVALID fixture derived from an actual valid Core batch.
      // Every image occurrence and receipt input is changed consistently, so
      // the public SQL oracle must reject PURPOSE, not malformed envelope/CAS.
      const invalid=copy(body);invalid.request.input.image_file_id=wrongPurpose;invalid.changes[0].after.image_file_id=wrongPurpose;invalid.events[0].after.image_file_id=wrongPurpose;invalid.receipt.result.goal.image_file_id=wrongPurpose;invalid.receipt.fingerprint=JSON.stringify(invalid.request.input);
      await checkDenied("purpose",actors.a,invalid);windows.push("purpose-refused");row.checks.purposeDenied=true;
      const beforeGrants=await read();await transaction(control,()=>image(control,"IMAGE_ASSERT_GRANTS"),"postgres");await transaction(control,()=>image(control,"IMAGE_ASSERT_PRIVATE_DENIED",{owner:actors.a.id,uploadId:target}),"postgres");assertGoalImagesUnchanged(beforeGrants,await read());windows.push("grants-closed");row.checks.grantsClosed=true;
      const goalId=body.changes[0].after.id;await transaction(control,()=>image(control,"IMAGE_FAULT_INSTALL",{owner:actors.a.id,goalId}),"postgres");
      const beforeFault=await read();await transaction(control,()=>image(control,"IMAGE_ASSERT_FAULT",{owner:actors.a.id,session:actors.a.sessionId,request:body}));assertGoalImagesUnchanged(beforeFault,await read());
      await transaction(control,()=>image(control,"IMAGE_FAULT_REMOVE",{owner:actors.a.id,goalId}),"postgres");assertGoalImagesUnchanged(beforeFault,await read());windows.push("post-projection-rollback");row.checks.rollbackPostProjection=true;
    }else{
    let initial=null;
    if(kind.startsWith("I3_")||kind.startsWith("I4_"))initial=(await setupGoal(control,create((await state(control)).revision,spare))).goal;
    // Only the target reservation is expired. Other owner and spare cannot be
    // accidentally selected by the global cleanup routine in this window.
    await transaction(control,()=>image(control,"IMAGE_FIXTURE_AGE",{owner:actors.a.id,uploadId:target}),"postgres");
    const revision=(await state(control)).revision,original=initial?update(revision,initial,target):create(revision,target);
    await begin(control);const body=await plan(control,original);await sql(control,"ROLLBACK");const before=await read();
    const terminalCase=kind.startsWith("I6_")||kind.startsWith("I7_"),bindFirst=kind.startsWith("I1_")||kind.startsWith("I3_")||kind.startsWith("I6_");
    const token=terminalCase?product.captureGoalTerminalAttempt(actors.a.id,original):null,envelope=terminalCase?product.goalTerminalRpcRequest(token):null;
    // New fixture/observation choice approved for I: postgres can inspect the
    // private material while holding the winner transaction. This is not a
    // service_role grant proof or inherited N12 acceptance; I8 proves that.
    row.phase="winner";await begin(winner,"postgres");let winnerValue,winnerMaterial,oldBody=null;
    if(bindFirst)winnerValue=await commit(winner,original,body);
    else if(terminalCase){winnerValue=product.decodeGoalTerminalReply(token,await rpc(winner,"finance_goal_attempt_settle",actors.a,original,envelope));requireThat(winnerValue.kind==="closed");const gateway=product.createFinanceGoalsGateway(actors.a.id,actors.a.sessionId,original.command,async(name,args)=>rpc(winner,name,actors.a,original,args.p_request));const snapshot=await gateway.snapshot(copy(original)),coherent=copy(original);coherent.input.expected_finance_revision=snapshot.finance_revision;oldBody=await plan(winner,coherent);requireThat(oldBody.expected_finance_revision===snapshot.finance_revision);}
    else winnerValue=(await image(winner,"IMAGE_CLEANUP_CANDIDATES")).value;
    winnerMaterial=await read(winner);
    await begin(loser);const pending=terminalCase&&bindFirst?rpc(loser,"finance_goal_attempt_settle",actors.a2,original,envelope):bindFirst?image(loser,"IMAGE_CLEANUP_CANDIDATES").then(value=>value.value):rpc(loser,"finance_goals_commit",actors.a2,original,body);
    let settled=false;const outcome=pending.then(value=>{settled=true;return{value};},error=>{settled=true;return{error};});row.phase="blocked";await block(observer,loser,winner,()=>settled);
    row.phase="release";await sql(winner,"COMMIT");row.checks.winnerCommitted=true;const lost=await outcome;
    if(!bindFirst){await exactRefusal(loser,lost,terminalCase?"23505":"22023",terminalCase?"NAMESPACE_CLOSED":initial?"IMAGE_PROOF_UNAVAILABLE":"IMAGE_NOT_FINALIZED");}
    else{requireThat(!lost.error);await sql(loser,"COMMIT");}
    row.phase="oracle";const after=await read();
    if(!terminalCase){
      if(bindFirst){assertGoalImagesCommit(before,winnerMaterial,{owner:actors.a.id,command:original,batch:body,result:winnerValue,weights:{goal:weights.goal,event:weights.event,receipt:weights.receipt}});windows.push(initial?"goal-update":"goal-create");assertGoalImagesCleanup(winnerMaterial,after,{owner:actors.a.id,uploadId:target,candidates:lost.value,protected:true});windows.push("cleanup-protected");if(initial)row.checks.referenceSuccessorExact=true;else row.checks.imageProtectedAfterRecheck=true;}
      else{assertGoalImagesCleanup(before,winnerMaterial,{owner:actors.a.id,uploadId:target,candidates:winnerValue,protected:false});windows.push("cleanup-delete");assertGoalImagesUnchanged(winnerMaterial,after);windows.push("goal-refused");row.checks.imageRefusalExact=row.checks.rollbackExact=true;}
      const preAck=await read();await transaction(control,()=>image(control,"IMAGE_CLEANUP_ACK",{uploadId:target}));assertGoalImagesAck(preAck,await read(),{owner:actors.a.id,uploadId:target,protected:bindFirst});windows.push(bindFirst?"ack-protected":"ack-unbound");if(bindFirst)row.checks.ackHolderRechecked=true;
    }else if(bindFirst){
      assertGoalImagesCommit(before,winnerMaterial,{owner:actors.a.id,command:original,batch:body,result:winnerValue,weights:{goal:weights.goal,event:weights.event,receipt:weights.receipt}});windows.push("goal-create");const confirmed=product.decodeGoalTerminalReply(token,lost.value);requireThat(confirmed.kind==="confirmed");equal(confirmed.result,winnerValue);assertGoalImagesUnchanged(winnerMaterial,after);windows.push("terminal-receipt");row.checks.receiptFirst=true;
      const swap=update((await state(control)).revision,winnerValue.goal,spare),beforeSwap=await read();await begin(control);const swapBody=await plan(control,swap),swapResult=await commit(control,swap,swapBody);await sql(control,"COMMIT");const afterSwap=await read();assertGoalImagesCommit(beforeSwap,afterSwap,{owner:actors.a.id,command:swap,batch:swapBody,result:swapResult,weights:{goal:weights.goal,event:weights.event,receipt:weights.receipt}});windows.push("goal-update");
      const snapshot=await transaction(control,()=>rpc(control,"finance_goals_snapshot",actors.a,original));requireThat(snapshot.images.length===0&&snapshot.goals.length===0);equal(snapshot.receipt.result,winnerValue);
      for(const name of ["finance_goal_attempt_status","finance_goal_attempt_settle"]){const reply=product.decodeGoalTerminalReply(token,await transaction(control,()=>rpc(control,name,actors.a2,original,envelope)));equal(reply,confirmed);}assertGoalImagesUnchanged(afterSwap,await read());windows.push("replay-receipt");row.checks.replayAfterRebind=row.checks.noExtraBinding=true;
    }else{
      assertGoalImagesClosed(before,winnerMaterial,{owner:actors.a.id,command:original,reply:winnerValue,weights:{disposition:weights.disposition,event:weights.event}});windows.push("terminal-closed");assertGoalImagesUnchanged(winnerMaterial,after);windows.push("commit-refused");row.checks.namespaceFence=true;
      // Historical executor receives a batch planned against the WINNER'S new
      // revision, so stale CAS cannot masquerade as the namespace fence.
      await begin(winner,"postgres");let failure;try{await rpc(winner,"finance_goals_commit",actors.a2,original,oldBody,true);}catch(error){failure=error;}await exactRefusal(winner,{error:failure},"23505","NAMESPACE_CLOSED");assertGoalImagesUnchanged(after,await read());windows.push("old-executor-refused");row.checks.historicalGuardStrong=true;
      for(const name of ["finance_goal_attempt_status","finance_goal_attempt_settle"]){const reply=product.decodeGoalTerminalReply(token,await transaction(control,()=>rpc(control,name,actors.a,original,envelope)));equal(reply,winnerValue);}assertGoalImagesUnchanged(after,await read());windows.push("terminal-replay");row.checks.noLateBinding=true;
    }
    }
    assertGoalImagesCandidateWindows(kind,windows,GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS[kind]);Object.assign(row.counts,GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS[kind]);row.checks.fullMaterial=row.checks.totalsExact=row.checks.otherOwnerUnchanged=true;
    for(const role of ["winner","loser","observer"]){const session=sessions.get(role);if(!terminals.some(item=>item.session===session))terminals.push({session,terminal:await session.finish(),expected:"PASSED"});}
    for(const item of terminals)assertTerminal(item.session,item.terminal,item.expected);
    requireThat((await sql(control,"BACKENDS")).other===0,"CLEANUP_UNCONFIRMED");row.checks.quiescent=true;row.phase="cleanup";await cleanupActors();requireThat((await image(control,"IMAGE_ABSENCE",{a:actors.a.id,b:actors.b.id})).absent,"CLEANUP_UNCONFIRMED");row.checks.fixtureAbsent=true;
    const ended=await control.finish();assertTerminal(control,ended,"PASSED");terminals.push({session:control,terminal:ended,expected:"PASSED"});
    // Source/catalogue acceptance is the source-bound runner's responsibility;
    // this unfinished driver deliberately does NOT stamp those three checks or
    // return a passed row before that reviewed integration exists.
    row.code="NOT_RUN";row.phase="baseline";completed=true;
  }catch(error){row.code=error instanceof GoalNativeError?error.code:"MATERIAL_REFUSED";for(const session of sessions.values())session.abort();}
  finally{for(const session of sessions.values()){const terminal=await session.terminal();row.unknown ||=terminal.unknown||session.metadata().unknown;if(session.metadata().pending||session.metadata().processPending||!terminal.groupAbsent)row.code="CLEANUP_UNCONFIRMED";}if(row.code==="NOT_RUN"){try{requireThat(terminals.length===4,"PROCESS_REFUSED");for(const item of terminals)assertTerminal(item.session,item.terminal,item.expected);}catch{row.code="PROCESS_REFUSED";}}if(row.unknown)row.code="WRITE_OUTCOME_UNCERTAIN";}
  completed &&=row.code==="NOT_RUN"&&!row.unknown;
  return{completed,row,quiet:[...sessions.values()].every(session=>!session.metadata().pending&&!session.metadata().processPending&&session.metadata().groupAbsent),unknown:row.unknown,windows};
}