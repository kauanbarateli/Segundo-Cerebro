/** Actual native case, dormant until a reviewed future CURRENT27 runner calls it. */
import { randomUUID } from "node:crypto";
import { GoalNativeError, nativeRefuse } from "./finance-goals-terminal-native-contract.mjs";
import { createGoalNativeSession } from "./finance-goals-terminal-native-session.mjs";
import { goalNativeStatement, goalDistinctNativeStatement, goalCurrent27NativeStatement } from "./finance-goals-terminal-native-sql.mjs";
import { CURRENT27_CASE_CHECKS, CURRENT27_CASE_COUNTS, CURRENT27_PRODUCT_EXPORTS, assertCurrent27Installation, assertCurrent27SqlProof, assertCurrent27Negative, assertCurrent27Positive, makeCurrent27InsufficientBody } from "./finance-goals-current27-insufficiency-contract.mjs";
const need=(condition,code="MATERIAL_REFUSED")=>{if(!condition)nativeRefuse(code);};
const clone=value=>structuredClone(value);
/** No injectable native factory: tests of the pure oracles do not start this case. */
export async function runCurrent27InsufficiencyCase({product,context,sessionOptions,actors,cleanupActors,installation,signal}) {
  const result={checks:Object.fromEntries(CURRENT27_CASE_CHECKS.map(key=>[key,false])),counts:Object.fromEntries(CURRENT27_CASE_COUNTS.map(key=>[key,0])),sqlProof:null,serverVersion:null,code:"NOT_RUN",phase:"canonical",unknown:false};
  const sessions=new Map();let clockAt=null;
  const sql=(session,action,data={})=>session.request(goalNativeStatement(context,action,data));
  const special=(session,action,data={})=>session.request(goalCurrent27NativeStatement(context,action,data));
  const read=()=>sessions.get("control").request(goalDistinctNativeStatement(context,"DISTINCT_MATERIAL",{a:actors.a.id,b:actors.b.id}));
  const state=async()=>{const v=await sql(sessions.get("control"),"STATE",{owner:actors.a.id});need(Number.isFinite(Date.parse(v.at)));clockAt=new Date(v.at).toISOString();return v;};
  const transaction=async(session,work,role="service_role")=>{
    await sql(session,"BEGIN",{role});
    try{const value=await work();await sql(session,"COMMIT");return value;}
    catch(error){if(!session.metadata().failed&&session.metadata().transaction==="open")await sql(session,"ROLLBACK");throw error;}
  };
  const rpc=async(session,actor,intent,request,name="finance_goals_commit")=>(await sql(session,"RPC",{rpc:name,owner:actor.id,session:actor.sessionId,operation:intent.command,request:clone(request)})).value;
  async function plan(session,intent) {
    let body=null;
    const gateway=product.createFinanceGoalsGateway(actors.a.id,actors.a.sessionId,intent.command,async(name,args)=>{need(name==="finance_goals_snapshot");return rpc(session,actors.a,intent,args.p_request,name);});
    const planner={...gateway,async commit(value){need(body===null);body=clone(value);return{status:"stale"};}};
    let conflict=false;
    try{await product.executeGoalCommand(product.createFinanceGoalsStore(planner,intent),{ids:{next:()=>randomUUID()},clock:{now:()=>clockAt}},{user_id:actors.a.id,canal:"web"},intent);}
    catch(error){conflict=error?.code==="CONFLICT";}
    need(conflict&&body&&body.changes.length===1&&body.events.length===1);return body;
  }
  try {
    assertCurrent27Installation(installation,context);result.checks.installationBound=true;
    for(const name of CURRENT27_PRODUCT_EXPORTS)need(typeof product[name]==="function","GRAPH_REFUSED");
    need(typeof cleanupActors==="function"&&actors.a.id!==actors.b.id,"AUTH_REFUSED");
    for(const role of ["control","winner"]){
      const applicationName=sessionOptions.environment.PGAPPNAME.replace(/control$/,role);
      const session=createGoalNativeSession({...sessionOptions,context,signal,applicationName,environment:{...sessionOptions.environment,PGAPPNAME:applicationName}});
      sessions.set(role,session);const identity=await sql(session,"IDENTITY");
      if(result.serverVersion!==null)need(result.serverVersion===identity.serverVersion,"INSTANCE_REFUSED");
      result.serverVersion=identity.serverVersion;
    }
    need(new Set([...sessions.values()].map(s=>s.metadata().backendPid)).size===2,"INSTANCE_REFUSED");
    result.counts.sessions=2;result.checks.instanceBound=true;
    const control=sessions.get("control"),worker=sessions.get("winner");
    await sql(control,"BEGIN",{role:"postgres"});
    try{result.sqlProof=assertCurrent27SqlProof((await special(control,"INSTALL_PROOF")).value,result.serverVersion);}
    finally{if(!control.metadata().failed&&control.metadata().transaction==="open")await sql(control,"ROLLBACK");}
    result.checks.sqlProofBound=true;
    const first=await state(),day=first.day,accountA=randomUUID(),accountB=randomUUID();
    await transaction(control,()=>sql(control,"FIXTURE",{a:actors.a.id,b:actors.b.id,a1:actors.a.sessionId,a2:actors.a2.sessionId,b1:actors.b.sessionId,accountA,accountB,at:clockAt}),"postgres");
    result.checks.actorsBound=true;let current=await state();
    const create=product.decodeGoalCommand({command:"finance.goal.create",input:{client_id:randomUUID(),expected_finance_revision:current.revision,name:"Meta CURRENT27 sintética",target_cents:100000,deadline:null,image_file_id:null}});
    const created=await transaction(worker,async()=>{const body=await plan(worker,create),reply=await rpc(worker,actors.a,create,body);need(reply.status==="committed");return product.decodeGoalCommandResult(reply.result,create,actors.a.id);});
    need("goal" in created);current=await state();need(current.day===day,"MATERIAL_REFUSED");
    const intent=product.decodeGoalCommand({command:"finance.goal.contribute",input:{client_id:randomUUID(),expected_finance_revision:current.revision,goal_id:created.goal.id,expected_revision:created.goal.revision,account_id:accountA,amount_cents:20000,occurred_on:day}});
    result.phase="planning";let planned;
    await sql(worker,"BEGIN",{role:"service_role"});
    try{planned=await plan(worker,intent);}
    finally{if(!worker.metadata().failed&&worker.metadata().transaction==="open")await sql(worker,"ROLLBACK");}
    const input={...planned.request.input,amount_cents:200000},negative=makeCurrent27InsufficientBody(planned,product.assinatura(input)),beforeNegative=await read();
    need(negative.expected_finance_revision===current.revision);result.checks.currentCas=true;
    let negativeReply;await sql(worker,"BEGIN",{role:"service_role"});
    try{negativeReply=(await special(worker,"ASSERT_INSUFFICIENT",{owner:actors.a.id,session:actors.a.sessionId,request:negative})).value;}
    finally{if(!worker.metadata().failed&&worker.metadata().transaction==="open")await sql(worker,"ROLLBACK");}
    result.counts.negativeAttempts=1;
    assertCurrent27Negative(beforeNegative,await read(),negative,negativeReply);
    result.checks.negativeBranchExact=result.checks.negativeMaterialUnchanged=result.checks.otherOwnerUnchanged=true;
    current=await state();need(current.day===day&&current.revision===negative.expected_finance_revision);
    const positive=product.decodeGoalCommand({...clone(intent),input:{...clone(intent.input),client_id:randomUUID(),expected_finance_revision:current.revision}});
    need(positive.input.client_id!==intent.input.client_id);
    const beforePositive=await read();let positiveBody;
    const positiveReply=await transaction(worker,async()=>{positiveBody=await plan(worker,positive);return rpc(worker,actors.a,positive,positiveBody);});
    assertCurrent27Positive(beforePositive,await read(),positiveBody,positiveReply);
    result.checks.positiveCorePlanned=result.checks.positiveCommitted=result.checks.positiveMaterialExact=true;
    Object.assign(result.counts,{positiveControls:1,positiveEffects:1,positiveEvents:1,positiveReceipts:1,positiveQuotaDelta:1});
    result.phase="cleanup";
    const workerTerminal=await worker.finish();
    need(workerTerminal.code==="PASSED"&&!workerTerminal.unknown&&workerTerminal.groupAbsent&&workerTerminal.stdoutEof&&workerTerminal.stderrEof&&Object.values(worker.metadata().terminalCounts).every(n=>n===1),"CLEANUP_UNCONFIRMED");
    need((await sql(control,"BACKENDS")).other===0,"CLEANUP_UNCONFIRMED");
    result.checks.quiescent=true;await cleanupActors();
    need((await control.request(goalDistinctNativeStatement(context,"DISTINCT_ABSENCE",{a:actors.a.id,b:actors.b.id}))).absent,"CLEANUP_UNCONFIRMED");
    result.checks.fixturesAbsent=true;
    const controlTerminal=await control.finish();
    need(controlTerminal.code==="PASSED"&&!controlTerminal.unknown&&controlTerminal.groupAbsent&&controlTerminal.stdoutEof&&controlTerminal.stderrEof&&Object.values(control.metadata().terminalCounts).every(n=>n===1),"CLEANUP_UNCONFIRMED");
  }catch(error){result.code=error instanceof GoalNativeError?error.code:"MATERIAL_REFUSED";for(const s of sessions.values())s.abort();}
  finally{
    for(const session of sessions.values()){
      const terminal=await session.terminal();result.unknown ||= terminal.unknown||session.metadata().unknown;
      if(session.metadata().pending||session.metadata().processPending||!terminal.groupAbsent)result.code="CLEANUP_UNCONFIRMED";
    }
    if(result.unknown)result.code="WRITE_OUTCOME_UNCERTAIN";
  }
  const quiet=sessions.size===2&&[...sessions.values()].every(s=>!s.metadata().pending&&!s.metadata().processPending&&s.metadata().groupAbsent);
  const completed=quiet&&!result.unknown&&result.code==="NOT_RUN"&&Object.values(result.checks).every(Boolean);
  // Stack/temp/global Source admission belong to the future runner, not this case.
  return{...result,quiet,completed};
}
