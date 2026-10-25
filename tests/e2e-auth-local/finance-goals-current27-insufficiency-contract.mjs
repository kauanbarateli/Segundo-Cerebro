/** Closed CURRENT27 observations. Pure module; no SDK, process or SQL execution. */
import { isDeepStrictEqual } from "node:util";
import { GOAL_NATIVE_CODES, GOAL_NATIVE_PHASES, nativeData, nativeRecord, nativeRefuse } from "./finance-goals-terminal-native-contract.mjs";

export const CURRENT27_INSUFFICIENCY_SCENARIO = "finance-goals-current27-insufficiency-native-ci";
export const CURRENT27_MIGRATION_SHA256 = "f96d7a62b9337b9688c34ac471dd9fd326318e12d859817c263bb1ccf46d072a";
export const CURRENT27_CATALOGUE_SHA256 = "19b5f158dfd2003fa89285df99f4ab2e0287ee411b07b9a6b0bc7e6fb82f6e9e";
export const CURRENT27_CRITICAL_SQL = Object.freeze([
  ["app_private.fg_expected(uuid,text,jsonb,jsonb,text,date)","bd9b4252427eb9d6a4fd39e8abaf96ed530a940f9912409e6340b339020206e1"],
  ["app_private.fg_commit(uuid,uuid,text,jsonb)","8e2742caf00f7629d9a75467187134b9c5abd3cf968f6e994a8c9d9884909d74"],
  ["app_private.fg_terminal_previous_commit(uuid,uuid,text,jsonb)","86377bc8865a571c950eea05596531890225f19131c44f5a839c282e679c5ebf"],
  ["public.finance_goals_commit(uuid,uuid,text,jsonb)","498c676f3a28e20e597d4a8c0b62b37811b41a82844f59b32b389d6a31292c6e"],
].map(row => Object.freeze(row)));
export const CURRENT27_MATERIAL_KEYS = Object.freeze(["goals","reservations","releases","highlights","ledger","accounts","events","receipts","dispositions","limits","revisions","accountTotals","goalTotals","releaseTotals","series","occurrences","permits","categories","tags","transactionTags","budgets"]);
export const CURRENT27_CASE_CHECKS = Object.freeze(["instanceBound","actorsBound","installationBound","sqlProofBound","currentCas","negativeBranchExact","negativeMaterialUnchanged","otherOwnerUnchanged","positiveCorePlanned","positiveCommitted","positiveMaterialExact","quiescent","fixturesAbsent"]);
export const CURRENT27_CASE_COUNTS = Object.freeze(["sessions","negativeAttempts","negativeEffects","negativeEvents","negativeReceipts","negativeFences","positiveControls","positiveEffects","positiveEvents","positiveReceipts","positiveFences","positiveQuotaDelta"]);
export const CURRENT27_PRODUCT_EXPORTS = Object.freeze(["executeGoalCommand","decodeGoalCommand","decodeGoalCommandResult","createFinanceGoalsGateway","createFinanceGoalsStore","assinatura"]);
const SHA=/^[a-f0-9]{40}$/, KEY=/^[a-f0-9]{64}$/, UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const need=(condition,code="MATERIAL_REFUSED")=>{if(!condition)nativeRefuse(code);};
const equal=(a,b)=>need(isDeepStrictEqual(a,b));
const copy=value=>nativeData(value);
const object=(value,keys,code)=>nativeRecord(copy(value),keys,code);
const flags=(keys,value)=>Object.fromEntries(keys.map(key=>[key,value]));
const revision=value=>typeof value==="string"&&/^(?:0|[1-9][0-9]{0,18})$/.test(value);
export function assertCurrent27Installation(proof,context) {
  const p=object(proof,["namespace","sourceSha","sourceTree","systemIdentifier","migrationsApplied","pendingOnSecondApply","catalogueChecks","migration27Sha256","catalogueSha256","companionsApplied","sourceClosureExact","ledgerExact"],"SOURCE_REFUSED");
  need(typeof p.namespace==="string"&&/^sc-goals-terminal-native-[a-f0-9]{32}$/.test(p.namespace)&&typeof p.systemIdentifier==="string"&&/^[0-9]{16,20}$/.test(p.systemIdentifier)&&p.namespace===context.namespace&&p.sourceSha===context.sourceSha&&p.systemIdentifier===context.systemIdentifier&&SHA.test(p.sourceSha)&&SHA.test(p.sourceTree),"SOURCE_REFUSED");
  need(p.migrationsApplied===27&&p.pendingOnSecondApply===0&&p.catalogueChecks===2512&&p.migration27Sha256===CURRENT27_MIGRATION_SHA256&&p.catalogueSha256===CURRENT27_CATALOGUE_SHA256&&p.companionsApplied===false&&p.sourceClosureExact===true&&p.ledgerExact===true,"CATALOGUE_REFUSED");
  return Object.freeze(p);
}
export function assertCurrent27SqlProof(value,serverVersion) {
  const p=object(value,["version","profile","role","serverVersion","ledgerExact","criticalBodiesExact","criticalAclExact"],"CATALOGUE_REFUSED");
  need(p.version===1&&p.profile==="CURRENT27_DIRECT"&&p.role==="postgres"&&Number.isSafeInteger(p.serverVersion)&&p.serverVersion>=170000&&p.serverVersion<180000&&p.serverVersion===serverVersion&&p.ledgerExact===true&&p.criticalBodiesExact===true&&p.criticalAclExact===true,"CATALOGUE_REFUSED");
  return Object.freeze(p);
}
export function assertCurrent27Material(value) {
  const m=object(value,["ack","a","b"]);need(m.ack==="material");
  for(const side of ["a","b"]){const row=object(m[side],CURRENT27_MATERIAL_KEYS);need(Object.values(row).every(rows=>Array.isArray(rows)&&rows.length<=128));}
  return m;
}
function contribution(value,amount) {
  const b=object(value,["request","expected_finance_revision","context","changes","events","receipt"]);
  const r=object(b.request,["command","input"]),input=object(r.input,["client_id","expected_finance_revision","goal_id","expected_revision","account_id","amount_cents","occurred_on"]);
  need(r.command==="finance.goal.contribute"&&input.amount_cents===amount&&revision(input.expected_finance_revision)&&revision(input.expected_revision)&&b.expected_finance_revision===input.expected_finance_revision);
  need([input.client_id,input.goal_id,input.account_id].every(v=>typeof v==="string"&&UUID.test(v)));
  need(Array.isArray(b.changes)&&Array.isArray(b.events)&&b.changes.length===1&&b.events.length===1&&b.changes[0].type==="finance_goal_reservation"&&b.changes[0].before===null);
  const receipt=object(b.receipt,["user_id","command","client_id","fingerprint","result"]),context=object(b.context,["user_id","canal"]),result=object(receipt.result,["version","reservation"]);
  need(context.canal==="web"&&receipt.user_id===context.user_id&&receipt.command===r.command&&receipt.client_id===input.client_id&&typeof receipt.fingerprint==="string"&&result.version===1);
  let original;try{original=JSON.parse(receipt.fingerprint);}catch{nativeRefuse("MATERIAL_REFUSED");}equal(original,input);
  const row=result.reservation,event=b.events[0];
  need(row.user_id===context.user_id&&row.goal_id===input.goal_id&&row.account_id===input.account_id&&row.amount_cents===amount&&row.client_id===input.client_id&&row.occurred_on===input.occurred_on);
  equal(b.changes[0].after,row);equal(event.after,row);
  need(event.user_id===context.user_id&&event.entity_type==="finance_goal_reservation"&&event.entity_id===row.id&&event.action==="created"&&event.canal==="web"&&event.before===null);
  return b;
}
/** A coherent adversarial batch derived from an actual Core plan; not Core acceptance. */
export function makeCurrent27InsufficientBody(planned,fingerprint) {
  const body=contribution(planned,20000),before=copy(body);
  body.request.input.amount_cents=200000;body.receipt.fingerprint=fingerprint;
  body.receipt.result.reservation.amount_cents=200000;body.changes[0].after.amount_cents=200000;body.events[0].after.amount_cents=200000;
  contribution(body,200000);need(body.expected_finance_revision===before.expected_finance_revision&&body.request.input.client_id===before.request.input.client_id);
  return body;
}
export function assertCurrent27Negative(beforeValue,afterValue,bodyValue,result) {
  const before=assertCurrent27Material(beforeValue),after=assertCurrent27Material(afterValue),body=contribution(bodyValue,200000),v=object(result,["branch","sqlState","cas"],"SQL_REFUSED");
  need(v.branch==="CONTRIBUTE_INSUFFICIENT"&&v.sqlState==="23514"&&v.cas==="CURRENT","SQL_REFUSED");equal(before,after);
  const owner=body.context.user_id,input=body.request.input;
  need(before.a.accounts.some(row=>row.id===input.account_id&&row.user_id===owner&&row.kind==="checking"&&row.currency==="BRL"&&row.archived_at===null&&row.opening_balance_cents===100000));
  need(before.a.goals.some(row=>row.id===input.goal_id&&row.user_id===owner&&row.payload.revision===input.expected_revision&&row.payload.archived_at===null));
  need((before.a.revisions[0]?.revision??"0")===input.expected_finance_revision);
  const total=before.a.accountTotals.find(row=>row.account_id===input.account_id);
  need(total?.real_balance_cents===100000&&total.reserved_cents===0&&total.finance_revision===input.expected_finance_revision);
  for(const key of ["receipts","dispositions"])need(!before.a[key].some(row=>row.command===body.request.command&&row.client_id===input.client_id));
  return true;
}
export function assertCurrent27Positive(beforeValue,afterValue,bodyValue,reply) {
  const before=assertCurrent27Material(beforeValue),after=assertCurrent27Material(afterValue),body=contribution(bodyValue,20000),answer=object(reply,["status","result"]);
  need(answer.status==="committed");equal(answer.result,body.receipt.result);equal(before.b,after.b);
  need((before.a.revisions[0]?.revision??"0")===body.expected_finance_revision);
  for(const key of ["goals","releases","highlights","ledger","accounts","dispositions","series","occurrences","permits","categories","tags","transactionTags","budgets"])equal(before.a[key],after.a[key]);
  const reservation=body.changes[0].after;need(after.a.reservations.length===before.a.reservations.length+1);
  equal(after.a.reservations.filter(row=>row.id!==reservation.id),before.a.reservations);
  const stored=after.a.reservations.find(row=>row.id===reservation.id);
  need(stored&&stored.user_id===reservation.user_id&&stored.goal_id===reservation.goal_id&&stored.account_id===reservation.account_id&&stored.amount_cents===20000&&Date.parse(stored.created_at)===Date.parse(reservation.created_at));equal(stored,{id:reservation.id,user_id:reservation.user_id,goal_id:reservation.goal_id,account_id:reservation.account_id,amount_cents:20000,created_at:stored.created_at,payload:reservation});
  need(after.a.events.length===before.a.events.length+1);equal(after.a.events.filter(row=>row.id!==body.events[0].id),before.a.events);
  const event=after.a.events.find(row=>row.id===body.events[0].id);need(event&&Object.hasOwn(event,"capture_task_payload")&&event.capture_task_payload===null);
  for(const field of ["id","user_id","entity_type","entity_id","action","canal","before","after"])equal(event[field],body.events[0][field]);need(Date.parse(event.occurred_at)===Date.parse(body.events[0].occurred_at));equal(event,{...body.events[0],occurred_at:event.occurred_at,capture_task_payload:null});
  const match=row=>row.command===body.request.command&&row.client_id===body.request.input.client_id;
  need(!before.a.receipts.some(match)&&!before.a.dispositions.some(match)&&after.a.receipts.length===before.a.receipts.length+1);equal(after.a.receipts.filter(row=>!match(row)),before.a.receipts);
  const receipt=after.a.receipts.find(match);need(receipt&&receipt.user_id===body.context.user_id);equal(receipt.request,body.receipt.fingerprint);equal(receipt.result,body.receipt.result);need(Number.isFinite(Date.parse(receipt.created_at))&&Math.abs(Date.parse(receipt.created_at)-Date.parse(body.events[0].occurred_at))<300000);equal(receipt,{user_id:body.context.user_id,command:body.request.command,client_id:body.request.input.client_id,request:body.receipt.fingerprint,result:body.receipt.result,created_at:receipt.created_at});
  need(after.a.revisions.length===1&&before.a.revisions.length===1&&after.a.revisions[0].user_id===body.context.user_id&&BigInt(after.a.revisions[0].revision)-BigInt(before.a.revisions[0].revision)===2n);
  equal({...after.a.revisions[0],revision:before.a.revisions[0].revision},before.a.revisions[0]);
  const oldLimit=before.a.limits.find(row=>row.scope==="capture_task_write"),limit=after.a.limits.find(row=>row.scope==="capture_task_write");
  need(oldLimit&&limit&&oldLimit.user_id===body.context.user_id&&limit.hits.length===oldLimit.hits.length+1);equal(limit.hits.slice(0,-1),oldLimit.hits);equal({...limit,hits:oldLimit.hits,updated_at:oldLimit.updated_at},oldLimit);need(Number.isFinite(Date.parse(limit.updated_at))&&Date.parse(limit.updated_at)>=Date.parse(oldLimit.updated_at)&&Math.abs(Date.parse(limit.updated_at)-Date.parse(body.events[0].occurred_at))<300000);
  equal(after.a.limits.filter(row=>row.scope!=="capture_task_write"),before.a.limits.filter(row=>row.scope!=="capture_task_write"));need(after.a.limits.length===before.a.limits.length);
  const rev=after.a.revisions[0].revision;
  need(after.a.accountTotals.length===before.a.accountTotals.length&&after.a.goalTotals.length===before.a.goalTotals.length&&after.a.releaseTotals.length===before.a.releaseTotals.length+1);
  for(const row of after.a.accountTotals){const old=before.a.accountTotals.find(item=>item.account_id===row.account_id);need(old);equal(row,{...old,finance_revision:rev,reserved_cents:old.reserved_cents+(row.account_id===reservation.account_id?20000:0)});}
  for(const row of after.a.goalTotals){const old=before.a.goalTotals.find(item=>item.goal_id===row.goal_id);need(old);equal(row,{...old,finance_revision:rev,saved_cents:old.saved_cents+(row.goal_id===reservation.goal_id?20000:0)});}
  for(const row of before.a.releaseTotals)equal(after.a.releaseTotals.find(item=>item.reservation_id===row.reservation_id),{...row,finance_revision:rev});
  equal(after.a.releaseTotals.find(row=>row.reservation_id===reservation.id),{user_id:body.context.user_id,reservation_id:reservation.id,released_cents:0,finance_revision:rev});
  return true;
}
export function newCurrent27InsufficiencyReport() {
  return {version:1,scenario:CURRENT27_INSUFFICIENCY_SCENARIO,sourceSha:null,sourceTree:null,nodeVersion:null,cliVersion:"2.120.0",serverVersion:null,status:"failed",code:"NOT_RUN",phase:"environment",installation:null,sqlProof:null,sources:[],dependencies:[],checks:flags(CURRENT27_CASE_CHECKS,false),counts:flags(CURRENT27_CASE_COUNTS,0),writeOutcomeUncertain:false,pending:{commands:0,http:0,backends:0},cleanup:flags(["groups","backends","stack","temp"],false),limitations:flags(["hostedAccepted","appHttpAccepted","browserAccepted","rlsAccepted","restoreAccepted","productionEnabled"],false)};
}
function rows(value,dependency) {
  need(Array.isArray(value)&&value.length<=512);let previous="";
  return value.map(item=>{
    const row=object(item,["path","bytes","sha256"]);
    need(typeof row.path==="string"&&/^[A-Za-z0-9_@()./-]+$/.test(row.path)&&!row.path.includes("..")&&!row.path.startsWith("/")&&row.path>previous&&(dependency||!row.path.startsWith("node_modules/"))&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=4194304&&KEY.test(row.sha256));
    previous=row.path;return row;
  });
}
export function validateCurrent27InsufficiencyReport(value) {
  const r=object(value,Object.keys(newCurrent27InsufficiencyReport()));
  need(r.version===1&&r.scenario===CURRENT27_INSUFFICIENCY_SCENARIO&&["passed","failed"].includes(r.status)&&GOAL_NATIVE_CODES.includes(r.code)&&GOAL_NATIVE_PHASES.includes(r.phase)&&r.cliVersion==="2.120.0"&&typeof r.writeOutcomeUncertain==="boolean");
  const known=typeof r.sourceSha==="string"&&SHA.test(r.sourceSha)&&typeof r.sourceTree==="string"&&SHA.test(r.sourceTree);
  need(known||r.sourceSha===null&&r.sourceTree===null);
  need(r.nodeVersion===null||typeof r.nodeVersion==="string"&&/^24\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/.test(r.nodeVersion)&&r.nodeVersion.length<=32);
  need(r.serverVersion===null||Number.isSafeInteger(r.serverVersion)&&r.serverVersion>=170000&&r.serverVersion<180000);
  const checks=object(r.checks,CURRENT27_CASE_CHECKS),counts=object(r.counts,CURRENT27_CASE_COUNTS),pending=object(r.pending,["commands","http","backends"]),cleanup=object(r.cleanup,["groups","backends","stack","temp"]),limitations=object(r.limitations,Object.keys(newCurrent27InsufficiencyReport().limitations));
  need(Object.values(checks).every(v=>typeof v==="boolean")&&Object.values(cleanup).every(v=>typeof v==="boolean")&&Object.values(limitations).every(v=>v===false));
  need(Object.values(counts).every(v=>Number.isSafeInteger(v)&&v>=0&&v<=2)&&Object.values(pending).every(v=>Number.isSafeInteger(v)&&v>=0&&v<=128));
  const sources=rows(r.sources,false),dependencies=rows(r.dependencies,true);
  if(r.installation!==null){const p=r.installation;assertCurrent27Installation(p,{namespace:p.namespace,sourceSha:r.sourceSha,systemIdentifier:p.systemIdentifier});need(p.sourceTree===r.sourceTree);}
  if(r.sqlProof!==null)assertCurrent27SqlProof(r.sqlProof,r.serverVersion);
  if(r.status==="passed"){
    need(known&&r.nodeVersion!==null&&r.serverVersion!==null&&r.installation!==null&&r.sqlProof!==null&&r.code==="PASSED"&&r.phase==="complete"&&!r.writeOutcomeUncertain&&Object.values(checks).every(Boolean)&&Object.values(pending).every(v=>v===0)&&Object.values(cleanup).every(Boolean)&&sources.length>0&&dependencies.length>0);
    equal(counts,{sessions:2,negativeAttempts:1,negativeEffects:0,negativeEvents:0,negativeReceipts:0,negativeFences:0,positiveControls:1,positiveEffects:1,positiveEvents:1,positiveReceipts:1,positiveFences:0,positiveQuotaDelta:1});
    for(const[path,sha256]of[["supabase/migrations/20261024130000_finance_mvp_vertical.sql",CURRENT27_MIGRATION_SHA256],["supabase/tests/release-catalog.sql",CURRENT27_CATALOGUE_SHA256]])need(sources.some(row=>row.path===path&&row.sha256===sha256));
  }else need(r.code!=="PASSED"&&r.phase!=="complete");
  need(!Object.values(pending).some(Boolean)||Object.values(cleanup).every(v=>v===false));
  return Object.freeze({...r,sources,dependencies,checks,counts,pending,cleanup,limitations});
}
