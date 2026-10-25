/** Pure synthetic contract/oracle controls. No session/case/SDK module is imported. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { CURRENT27_MIGRATION_SHA256, CURRENT27_CATALOGUE_SHA256, CURRENT27_CRITICAL_SQL, CURRENT27_MATERIAL_KEYS, assertCurrent27Installation, assertCurrent27SqlProof, assertCurrent27Negative, assertCurrent27Positive, makeCurrent27InsufficientBody, newCurrent27InsufficiencyReport, validateCurrent27InsufficiencyReport } from "../e2e-auth-local/finance-goals-current27-insufficiency-contract.mjs";
import { CURRENT27_NATIVE_SQL_PINS, goalCurrent27NativeStatement, inspectGoalNativeStatement, frameGoalNativeStatement } from "../e2e-auth-local/finance-goals-terminal-native-sql.mjs";
const clone=value=>structuredClone(value), id=n=>"79000000-0000-4000-8000-"+String(n).padStart(12,"0");
const owner=id(1),other=id(2),at="2026-10-25T12:00:00.000Z",later="2026-10-25T12:00:01.000Z";
const context={namespace:"sc-goals-terminal-native-"+"a".repeat(32),sourceSha:"b".repeat(40),systemIdentifier:"1234567890123456789"};
const proof=()=>({...context,sourceTree:"c".repeat(40),migrationsApplied:27,pendingOnSecondApply:0,catalogueChecks:2512,migration27Sha256:CURRENT27_MIGRATION_SHA256,catalogueSha256:CURRENT27_CATALOGUE_SHA256,companionsApplied:false,sourceClosureExact:true,ledgerExact:true});
const sqlProof=()=>({version:1,profile:"CURRENT27_DIRECT",role:"postgres",serverVersion:170011,ledgerExact:true,criticalBodiesExact:true,criticalAclExact:true});
const empty=()=>Object.fromEntries(CURRENT27_MATERIAL_KEYS.map(key=>[key,[]]));
function body(client=10) {
  const input={client_id:id(client),expected_finance_revision:"4",goal_id:id(3),expected_revision:"0",account_id:id(4),amount_cents:20000,occurred_on:"2026-10-25"};
  const row={version:1,id:id(client+100),user_id:owner,goal_id:id(3),account_id:id(4),amount_cents:20000,occurred_on:input.occurred_on,client_id:input.client_id,created_at:at};
  const event={id:id(client+200),user_id:owner,entity_type:"finance_goal_reservation",entity_id:row.id,action:"created",canal:"web",occurred_at:at,before:null,after:clone(row)};
  return{request:{command:"finance.goal.contribute",input},expected_finance_revision:"4",context:{user_id:owner,canal:"web"},changes:[{type:"finance_goal_reservation",before:null,after:clone(row)}],events:[event],receipt:{user_id:owner,command:"finance.goal.contribute",client_id:input.client_id,fingerprint:JSON.stringify(input),result:{version:1,reservation:clone(row)}}};
}
function material() {
  const a=empty(),b=empty(),goal={id:id(3),user_id:owner,revision:"0",archived_at:null,name:"Meta",target_cents:100000};
  a.accounts=[{id:id(4),user_id:owner,payload:{name:"Conta"},kind:"checking",currency:"BRL",archived_at:null,opening_balance_cents:100000}];
  a.goals=[{id:goal.id,user_id:owner,payload:goal,revision:"0",archived_at:null}];
  a.revisions=[{user_id:owner,revision:"4"}];
  a.limits=[{scope:"capture_task_write",subject_hash:"d".repeat(64),user_id:owner,hits:[at],updated_at:at}];
  a.accountTotals=[{user_id:owner,account_id:id(4),finance_revision:"4",real_balance_cents:100000,reserved_cents:0}];
  a.goalTotals=[{user_id:owner,goal_id:id(3),finance_revision:"4",saved_cents:0}];
  b.accounts=[{id:id(5),user_id:other,payload:{name:"Sentinela"},kind:"checking",currency:"BRL",archived_at:null,opening_balance_cents:100000}];
  b.revisions=[{user_id:other,revision:"1"}];b.accountTotals=[{user_id:other,account_id:id(5),finance_revision:"1",real_balance_cents:100000,reserved_cents:0}];
  return{ack:"material",a,b};
}
function positive() {
  const before=material(),after=clone(before),planned=body(11),row=planned.changes[0].after;
  after.a.reservations.push({id:row.id,user_id:owner,goal_id:row.goal_id,account_id:row.account_id,amount_cents:row.amount_cents,created_at:row.created_at,payload:clone(row)});
  after.a.events.push({...clone(planned.events[0]),capture_task_payload:null});
  after.a.receipts.push({user_id:owner,command:planned.request.command,client_id:planned.request.input.client_id,request:planned.receipt.fingerprint,result:clone(planned.receipt.result),created_at:at});
  after.a.revisions[0].revision="6";after.a.limits[0].hits.push(later);after.a.limits[0].updated_at=later;
  after.a.accountTotals[0].finance_revision="6";after.a.accountTotals[0].reserved_cents=20000;
  after.a.goalTotals[0].finance_revision="6";after.a.goalTotals[0].saved_cents=20000;
  after.a.releaseTotals.push({user_id:owner,reservation_id:row.id,finance_revision:"6",released_cents:0});
  return{before,after,planned,reply:{status:"committed",result:clone(planned.receipt.result)}};
}
function negative() {const planned=body(),input={...planned.request.input,amount_cents:200000};return makeCurrent27InsufficientBody(planned,JSON.stringify(input));}
function passedReport() {
  const r=newCurrent27InsufficiencyReport();Object.assign(r,{sourceSha:context.sourceSha,sourceTree:"c".repeat(40),nodeVersion:"24.19.0",serverVersion:170011,status:"passed",code:"PASSED",phase:"complete",installation:proof(),sqlProof:sqlProof()});
  for(const key of Object.keys(r.checks))r.checks[key]=true;
  Object.assign(r.counts,{sessions:2,negativeAttempts:1,positiveControls:1,positiveEffects:1,positiveEvents:1,positiveReceipts:1,positiveQuotaDelta:1});
  for(const key of Object.keys(r.cleanup))r.cleanup[key]=true;
  r.sources=[{path:"supabase/migrations/20261024130000_finance_mvp_vertical.sql",bytes:1,sha256:CURRENT27_MIGRATION_SHA256},{path:"supabase/tests/release-catalog.sql",bytes:207834,sha256:CURRENT27_CATALOGUE_SHA256}];
  r.dependencies=[{path:"node_modules/server-only/empty.js",bytes:0,sha256:"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}];return r;
}
const refuse=fn=>assert.throws(fn);
test("unstarted report is failed and cannot become accepted by a label",()=>{assert.equal(validateCurrent27InsufficiencyReport(newCurrent27InsufficiencyReport()).status,"failed");const r=newCurrent27InsufficiencyReport();r.status="passed";r.code="PASSED";r.phase="complete";refuse(()=>validateCurrent27InsufficiencyReport(r));});
test("complete synthetic report passes only the closed new shape",()=>{assert.equal(validateCurrent27InsufficiencyReport(passedReport()).scenario,"finance-goals-current27-insufficiency-native-ci");const r=passedReport();r.message="forbidden";refuse(()=>validateCurrent27InsufficiencyReport(r));});
test("installation refuses historical26, companions, wrong source/tree pins and incomplete ledger",()=>{assertCurrent27Installation(proof(),context);for(const mutate of[p=>p.migrationsApplied=26,p=>p.companionsApplied=true,p=>p.pendingOnSecondApply=1,p=>p.catalogueChecks=1720,p=>p.migration27Sha256="0".repeat(64),p=>p.catalogueSha256="0".repeat(64),p=>p.ledgerExact=false,p=>p.sourceClosureExact=false,p=>p.sourceSha="0".repeat(40),p=>p.systemIdentifier="1",p=>p.namespace="other"]){const p=proof();mutate(p);refuse(()=>assertCurrent27Installation(p,context));}});
test("SQL proof rejects another role, body, ACL, null predicate and PG18",()=>{assertCurrent27SqlProof(sqlProof(),170011);for(const patch of[{role:"service_role"},{criticalBodiesExact:false},{criticalAclExact:false},{criticalBodiesExact:null},{ledgerExact:false},{serverVersion:180001}])refuse(()=>assertCurrent27SqlProof({...sqlProof(),...patch},170011));});
test("unknown, pending, cleanup, limitations, counts and omitted checks cannot pass",()=>{for(const mutate of[r=>r.writeOutcomeUncertain=true,r=>r.pending.http=1,r=>r.cleanup.groups=false,r=>r.cleanup.stack=false,r=>r.limitations.rlsAccepted=true,r=>r.counts.negativeReceipts=1,r=>r.counts.positiveFences=1,r=>r.counts.sessions=1,r=>r.checks.currentCas=false,r=>r.code="NOT_RUN"]){const r=passedReport();mutate(r);refuse(()=>validateCurrent27InsufficiencyReport(r));}});
test("Source rows refuse omissions, duplicates, order and node_modules exceptions",()=>{for(const mutate of[r=>r.sources.pop(),r=>r.sources.push(clone(r.sources[1])),r=>r.sources.reverse(),r=>r.sources[0].path="node_modules/fixture.js",r=>r.dependencies=[],r=>r.sources[0].sha256="0".repeat(64)]){const r=passedReport();mutate(r);refuse(()=>validateCurrent27InsufficiencyReport(r));}});
test("coherent overdraw construction preserves CAS and original Core plan",()=>{const planned=body(),old=clone(planned),n=negative();assert.deepEqual(planned,old);assert.equal(n.expected_finance_revision,"4");assert.equal(n.request.input.client_id,id(10));for(const amount of[n.request.input.amount_cents,n.receipt.result.reservation.amount_cents,n.changes[0].after.amount_cents,n.events[0].after.amount_cents])assert.equal(amount,200000);});
test("overdraw construction refuses wrong fingerprint, old amount or mismatched CAS",()=>{refuse(()=>makeCurrent27InsufficientBody(body(),"{}"));const b=body();b.expected_finance_revision="3";refuse(()=>makeCurrent27InsufficientBody(b,JSON.stringify({...b.request.input,amount_cents:200000})));const wrong=body();wrong.request.input.amount_cents=100;refuse(()=>makeCurrent27InsufficientBody(wrong,"{}"));});
test("negative accepts exact branch with current CAS and full material identity",()=>{const before=material();assert.equal(assertCurrent27Negative(before,clone(before),negative(),{branch:"CONTRIBUTE_INSUFFICIENT",sqlState:"23514",cas:"CURRENT"}),true);});
test("negative refuses stale, replay, generic23514 and extra diagnostic fields",()=>{for(const value of[{status:"stale"},{status:"replayed"},{branch:"OTHER",sqlState:"23514",cas:"CURRENT"},{branch:"CONTRIBUTE_INSUFFICIENT",sqlState:"23514",cas:"STALE"},{branch:"CONTRIBUTE_INSUFFICIENT",sqlState:"23514",cas:"CURRENT",message:"x"}])refuse(()=>assertCurrent27Negative(material(),material(),negative(),value));});
test("negative refuses same-cardinality changes and foreign owner mutations",()=>{for(const mutate of[m=>m.a.accounts[0].payload.name="changed",m=>m.a.goals[0].payload.name="changed",m=>m.a.revisions[0].revision="5",m=>m.a.limits[0].hits[0]=later,m=>m.b.accounts[0].payload.name="changed",m=>m.a.events.push({id:id(99)})]){const before=material(),after=clone(before);mutate(after);refuse(()=>assertCurrent27Negative(before,after,negative(),{branch:"CONTRIBUTE_INSUFFICIENT",sqlState:"23514",cas:"CURRENT"}));}});
test("negative refuses preexisting receipt/fence and non-current revision even unchanged",()=>{for(const key of["receipts","dispositions"]){const m=material();m.a[key].push({command:"finance.goal.contribute",client_id:id(10)});refuse(()=>assertCurrent27Negative(m,clone(m),negative(),{branch:"CONTRIBUTE_INSUFFICIENT",sqlState:"23514",cas:"CURRENT"}));}const m=material();m.a.revisions[0].revision="5";refuse(()=>assertCurrent27Negative(m,clone(m),negative(),{branch:"CONTRIBUTE_INSUFFICIENT",sqlState:"23514",cas:"CURRENT"}));});
test("positive requires actual persisted row shapes, event, receipt, quota and two revision weights",()=>{const p=positive();assert.equal(assertCurrent27Positive(p.before,p.after,p.planned,p.reply),true);});
test("positive event requires explicit null capture payload and rejects missing or extra physical columns",()=>{
  const valid=positive();assert.equal(Object.hasOwn(valid.after.a.events[0],"capture_task_payload"),true);assert.equal(valid.after.a.events[0].capture_task_payload,null);
  assert.equal(assertCurrent27Positive(valid.before,valid.after,valid.planned,valid.reply),true);
  for(const mutate of[event=>{delete event.capture_task_payload;},event=>{event.capture_task_payload=undefined;},event=>{event.capture_task_payload={unexpected:true};},event=>{event.capture_task_payload="null";},event=>{event.extra="unexpected physical column";}]){
    const p=positive();mutate(p.after.a.events[0]);refuse(()=>assertCurrent27Positive(p.before,p.after,p.planned,p.reply));
  }
});
test("positive refuses extra writes, altered old rows, cardinality-preserving receipt tamper and wrong weights",()=>{for(const mutate of[p=>p.after.a.accounts[0].payload.name="changed",p=>p.after.b.accounts[0].payload.name="changed",p=>p.after.a.receipts[0].request="x",p=>p.after.a.revisions[0].revision="5",p=>p.after.a.dispositions.push({}),p=>p.after.a.events[0].after.amount_cents=1,p=>p.after.a.reservations[0].extra="not a physical column",p=>p.after.a.limits[0].subject_hash="e".repeat(64),p=>p.after.a.limits[0].hits.pop(),p=>p.reply.status="replayed"]){const p=positive();mutate(p);refuse(()=>assertCurrent27Positive(p.before,p.after,p.planned,p.reply));}});
test("data guards reject hostile accessors, proxies and cross-realm objects without evaluation",()=>{let calls=0;const x={};Object.defineProperty(x,"status",{enumerable:true,get(){calls++;throw Error("canary");}});refuse(()=>validateCurrent27InsufficiencyReport(x));refuse(()=>validateCurrent27InsufficiencyReport(new Proxy({}, {ownKeys(){throw Error("canary");}})));refuse(()=>validateCurrent27InsufficiencyReport(runInNewContext("({version:1})")));assert.equal(calls,0);});
test("complete40387-byte SQL prefix and four Source body anchors remain exact",async()=>{const source=await readFile(new URL("../e2e-auth-local/finance-goals-terminal-native-sql.mjs",import.meta.url));assert.equal(createHash("sha256").update(source.subarray(0,40387)).digest("hex"),"6239711528e8b440a9f684ec2e865ec8419465914e78529e7288eb300e91a169");assert.deepEqual(CURRENT27_NATIVE_SQL_PINS,CURRENT27_CRITICAL_SQL);});
test("new SQL tickets retain nominal/context/frame admission and reject arbitrary requests",()=>{const ticket=goalCurrent27NativeStatement(context,"INSTALL_PROOF");assert.equal(inspectGoalNativeStatement(ticket,context).action,"RPC");assert.equal(inspectGoalNativeStatement(ticket,context).writing,false);assert.match(frameGoalNativeStatement(ticket,context,"f".repeat(32),1).prefix,/^SC_GOALS_NATIVE:/);refuse(()=>inspectGoalNativeStatement({...ticket},context));refuse(()=>inspectGoalNativeStatement(ticket,{...context,sourceSha:"c".repeat(40)}));refuse(()=>goalCurrent27NativeStatement(context,"free SQL",{sql:"select 1"}));refuse(()=>goalCurrent27NativeStatement(context,"INSTALL_PROOF",{role:"postgres"}));});
test("negative issuer fixes current role/CAS/literal inside SQL and exports no raw error",()=>{const s=inspectGoalNativeStatement(goalCurrent27NativeStatement(context,"ASSERT_INSUFFICIENT",{owner,session:id(6),request:negative()}),context);assert.equal(s.writing,true);assert.match(s.sql,/current_user<>'service_role'/);assert.ok(s.sql.indexOf("public.finance_goals_snapshot")<s.sql.indexOf("begin perform public.finance_goals_commit"));assert.match(s.sql,/exception when check_violation/);assert.match(s.sql,/observed_state is distinct from '23514'/);assert.match(s.sql,/observed is distinct from 'Insufficient unreserved balance\.'/);assert.match(s.sql,/target branch not reached/);const frame=s.sql.slice(s.sql.indexOf("@FRAME@"));assert.doesNotMatch(frame,/observed|message_text|sqlerrm|stack/i);assert.doesNotMatch(s.sql,/app_private\.fg_expected\(|grant |alter |create function/i);});
