/** Candidate I1-I8 material oracles. Importing opens no process or connection.
 * The separate runner binds source/catalogue proof before accepting a native report. */
import { isDeepStrictEqual } from "node:util";
import { nativeData, nativeRecord, nativeRefuse } from "./finance-goals-terminal-native-contract.mjs";
import { GOAL_IMAGES_NATIVE_CASES, GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS, GOAL_IMAGES_NATIVE_CANDIDATE_WINDOWS } from "./finance-goals-images-terminal-native-contract.mjs";
export { GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS, GOAL_IMAGES_NATIVE_CANDIDATE_WINDOWS } from "./finance-goals-images-terminal-native-contract.mjs";
const requireThat = value => { if (!value) nativeRefuse("MATERIAL_REFUSED"); };
const equal = (left,right) => requireThat(isDeepStrictEqual(left,right));
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const uuid = value => { requireThat(typeof value === "string" && UUID.test(value)); return value; };
const date = value => { requireThat(typeof value === "string" && Number.isFinite(Date.parse(value))); return Date.parse(value); };
const financeKeys = Object.freeze(["goals","reservations","releases","highlights","ledger","accounts","events","receipts","dispositions","limits","revisions","accountTotals","goalTotals","releaseTotals"]);
const ownerKeys = Object.freeze(["finance","files","uploads","profiles","preferences","projects","captures","captureLinks","habits","notebooks","pages","links","pageRefs","roles","moderation","entitlements"]);
const constantFinance = Object.freeze(["reservations","releases","highlights","ledger","accounts","dispositions"]);
const constantHolderKeys = Object.freeze(ownerKeys.filter(key=>!["finance","files","uploads"].includes(key)));
export function assertGoalImagesCandidateWindows(kind, windows, counts) {
  requireThat(typeof kind === "string" && GOAL_IMAGES_NATIVE_CASES.includes(kind));
  equal(nativeData(windows),GOAL_IMAGES_NATIVE_CANDIDATE_WINDOWS[kind]);
  equal(nativeRecord(nativeData(counts),Object.keys(GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS[kind])),GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS[kind]);
  return Object.freeze({kind,implemented:false}); // no native proof or report acceptance
}
function rows(value) { requireThat(Array.isArray(value) && value.length<=128); for(const row of value)requireThat(row && Object.getPrototypeOf(row)===Object.prototype); return value; }
function unique(value, key="id") { const ids=value.map(row=>row[key]); requireThat(new Set(ids).size===ids.length); }
function financeSums(value) {
  const released=id=>value.releases.filter(row=>row.reservation_id===id).reduce((sum,row)=>sum+BigInt(row.amount_cents),0n);
  const reserved=(account,goal)=>value.reservations.filter(row=>(account===null||row.account_id===account)&&(goal===null||row.goal_id===goal)).reduce((sum,row)=>sum+BigInt(row.amount_cents)-released(row.id),0n);
  for(const account of value.accounts){
    let balance=BigInt(account.opening_balance_cents);
    for(const row of value.ledger)if(row.account_id===account.id&&row.deleted_at===null&&["confirmed","reconciled"].includes(row.status))balance+=(row.kind==="income"?1n:-1n)*BigInt(account.kind==="credit_card"?row.amount_cents:row.paid_cents);
    const total=value.accountTotals.find(row=>row.account_id===account.id);requireThat(total&&total.user_id===account.user_id&&BigInt(total.real_balance_cents)===balance&&BigInt(total.reserved_cents)===reserved(account.id,null));
  }
  for(const goal of value.goals)requireThat(BigInt(value.goalTotals.find(row=>row.goal_id===goal.id)?.saved_cents)===reserved(null,goal.id));
  for(const row of value.reservations)requireThat(BigInt(value.releaseTotals.find(total=>total.reservation_id===row.id)?.released_cents)===released(row.id));
  const revision=value.revisions[0]?.revision??"0";
  for(const key of ["accountTotals","goalTotals","releaseTotals"])for(const total of value[key])requireThat(total.finance_revision===revision);
}
export function readGoalImagesMaterial(input) {
  const value=nativeRecord(nativeData(input),["ack","a","b"]);requireThat(value.ack==="material");
  const owners=[];
  for(const key of ["a","b"]){
    const owner=nativeRecord(value[key],ownerKeys),finance=nativeRecord(owner.finance,financeKeys);
    for(const list of Object.values(finance))rows(list);
    requireThat(finance.revisions.length<=1);for(const table of ["goals","reservations","releases","ledger","accounts","events","dispositions"])unique(finance[table]);
    for(const table of ownerKeys.filter(key=>key!=="finance"))rows(owner[table]);
    unique(owner.files);unique(owner.uploads);financeSums(finance);owners.push(owner);
  }
  return Object.freeze({a:owners[0],b:owners[1]});
}
function materialPair(before,after) {
  const a=readGoalImagesMaterial(before),b=readGoalImagesMaterial(after);equal(a.b,b.b);
  for(const key of constantHolderKeys)equal(a.a[key],b.a[key]);
  return{before:a.a,after:b.a};
}
function revisions(before,after,delta,newGoal=null) {
  requireThat(typeof delta==="number"&&Number.isSafeInteger(delta)&&delta>=0&&delta<=128);
  const a=BigInt(before.revisions[0]?.revision??"0"),b=BigInt(after.revisions[0]?.revision??"0");requireThat(b-a===BigInt(delta));
  if(delta>0)requireThat(after.revisions.length===1);
  for(const key of ["accountTotals","goalTotals","releaseTotals"]){
    const next=key==="goalTotals"&&newGoal!==null?after[key].filter(row=>row.goal_id!==newGoal):after[key];
    equal(before[key].map(row=>({...row,finance_revision:"0"})),next.map(row=>({...row,finance_revision:"0"})));
    if(key==="goalTotals"&&newGoal!==null){const added=after[key].filter(row=>row.goal_id===newGoal);requireThat(added.length===1&&added[0].saved_cents===0);}
  }
}
/** PostgreSQL timestamptz observations retain microseconds; identity comparisons
 * below remain exact strings from the same material projection. */
function quotaInstant(value) {
  requireThat(typeof value==="string");const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);requireThat(match);
  requireThat(new Date(date(match[1]+"Z")).toISOString().slice(0,19)===match[1]);
  return BigInt(date(match[1]+match[3]))*1000n+BigInt((match[2]??"").padEnd(6,"0"));
}
function quota(before,after,delta) {
  const a=before.limits.filter(row=>row.scope==="capture_task_write"),b=after.limits.filter(row=>row.scope==="capture_task_write");requireThat(a.length<=1&&b.length<2);
  equal(before.limits.filter(row=>row.scope!=="capture_task_write"),after.limits.filter(row=>row.scope!=="capture_task_write"));
  if(delta===0){equal(a,b);return;}
  requireThat(delta===1&&b.length===1&&Array.isArray(b[0].hits));const old=a[0]?.hits??[],last=b[0].hits.at(-1);requireThat(b[0].hits.length===old.length+1);equal(b[0].hits.slice(0,-1),old);
  const nextTime=quotaInstant(last);equal(b[0].updated_at,last);
  if(a.length){requireThat(old.length>0);for(const hit of old)quotaInstant(hit);equal(a[0].updated_at,old.at(-1));requireThat(nextTime>quotaInstant(a[0].updated_at));equal({...a[0],hits:[],updated_at:null},{...b[0],hits:[],updated_at:null});}
}
function added(before,after,kind="id") {
  const identity=row=>kind==="receipt"?row.user_id+":"+row.command+":"+row.client_id:row.id;
  requireThat(after.length===before.length+1);const next=after.filter(row=>!before.some(old=>identity(old)===identity(row)));requireThat(next.length===1);equal(after.filter(row=>row!==next[0]),before);return next[0];
}
function eventExact(actual,expected) {
  const keys=["id","user_id","entity_type","entity_id","action","canal","before","after"];
  for(const key of keys)equal(actual[key],expected[key]);requireThat(date(actual.occurred_at)===date(expected.occurred_at));
}
function weights(input,terminal=false) {
  const v=nativeRecord(nativeData(input),terminal?["disposition","event"]:["goal","event","receipt"]);
  equal(v,terminal?{disposition:0,event:1}:{goal:1,event:1,receipt:0});return terminal?1:2;
}
/** One real CREATE/UPDATE window. No setup/event/filter by count alone. */
export function assertGoalImagesCommit(beforeInput,afterInput,input) {
  const v=nativeRecord(nativeData(input),["owner","command","batch","result","weights"]);uuid(v.owner);
  const {before,after}=materialPair(beforeInput,afterInput),a=before.finance,b=after.finance;
  requireThat(["finance.goal.create","finance.goal.update"].includes(v.command.command));
  const body=v.batch;requireThat(body.context.user_id===v.owner&&body.changes.length===1&&body.events.length===1&&body.changes[0].type==="finance_goal");
  const change=body.changes[0],next=change.after;uuid(next.id);requireThat(next.user_id===v.owner&&next.image_file_id!==null);uuid(next.image_file_id);
  const file=before.files.find(row=>row.id===next.image_file_id&&row.user_id===v.owner),upload=before.uploads.find(row=>row.id===next.image_file_id&&row.file_id===next.image_file_id&&row.user_id===v.owner);
  requireThat(file&&upload&&file.kind==="finance_goal_image"&&file.deleted_at===null&&file.purged_at===null&&upload.status==="finalized"&&upload.kind==="finance_goal_image");
  const old=a.goals.find(row=>row.id===next.id),actual=b.goals.find(row=>row.id===next.id);requireThat(actual&&actual.user_id===v.owner&&actual.image_file_id===next.image_file_id);equal(actual.payload,next);
  if(v.command.command==="finance.goal.create"){requireThat(change.before===null&&!old&&b.goals.length===a.goals.length+1&&next.revision==="0");}
  else{requireThat(old&&b.goals.length===a.goals.length);equal(old.payload,change.before);requireThat(old.image_file_id!==next.image_file_id&&BigInt(next.revision)===BigInt(old.payload.revision)+1n);equal({...next,image_file_id:null,revision:null,updated_at:null},{...old.payload,image_file_id:null,revision:null,updated_at:null});}
  for(const key of ["id","user_id","name","target_cents","deadline","archived_at","revision","image_file_id"])if(Object.hasOwn(actual,key))equal(actual[key],next[key]);
  for(const key of ["created_at","updated_at"])if(Object.hasOwn(actual,key))requireThat(date(actual[key])===date(next[key]));
  equal(b.goals.filter(row=>row.id!==next.id),a.goals.filter(row=>row.id!==next.id));for(const key of constantFinance)equal(a[key],b[key]);
  const receipt=added(a.receipts,b.receipts,"receipt");requireThat(receipt.user_id===v.owner&&receipt.command===v.command.command&&receipt.client_id===v.command.input.client_id);equal(receipt.request,body.receipt.fingerprint);equal(receipt.result,body.receipt.result);equal(v.result,receipt.result);
  eventExact(added(a.events,b.events),body.events[0]);revisions(a,b,weights(v.weights),v.command.command==="finance.goal.create"?next.id:null);quota(a,b,1);equal(before.files,after.files);equal(before.uploads,after.uploads);
  return Object.freeze({receipts:1,financialEffects:1,financialEvents:1,quotaDelta:1,imageReferences:1});
}
/** A receipt replay, SQL-refused loser or denied operation changes no material. */
export function assertGoalImagesUnchanged(before,after) { equal(readGoalImagesMaterial(before),readGoalImagesMaterial(after));return true; }
export function assertGoalImagesClosed(beforeInput,afterInput,input) {
  const v=nativeRecord(nativeData(input),["owner","command","reply","weights"]);uuid(v.owner);requireThat(v.reply.kind==="closed");
  const {before,after}=materialPair(beforeInput,afterInput),a=before.finance,b=after.finance;
  for(const key of ["goals","reservations","releases","highlights","ledger","accounts","receipts"])equal(a[key],b[key]);
  const disposition=added(a.dispositions,b.dispositions);requireThat(disposition.user_id===v.owner&&disposition.command===v.command.command&&disposition.client_id===v.command.input.client_id);
  equal(Object.keys(disposition).sort(),["id","user_id","command","client_id","version","canonicalization_version","input_digest","closed_at"].sort());
  for(const field of ["id","user_id","command","client_id","version","canonicalization_version"])equal(disposition[field],v.reply.disposition[field]);
  requireThat(disposition.input_digest==="\\x"+v.reply.disposition.input_digest&&date(disposition.closed_at)===date(v.reply.disposition.closed_at));
  const event=added(a.events,b.events);requireThat(event.user_id===v.owner&&event.entity_type==="finance_goal_disposition"&&event.entity_id===disposition.id&&event.action==="created"&&event.canal==="web"&&event.before===null);equal(event.after,v.reply.disposition);requireThat(date(event.occurred_at)===date(disposition.closed_at));
  revisions(a,b,weights(v.weights,true));quota(a,b,1);equal(before.files,after.files);equal(before.uploads,after.uploads);return Object.freeze({dispositions:1,terminalEvents:1,quotaDelta:1,imageReferences:0});
}
/** Cleanup has a separate material window: drive_file events never count as
 * finance events and cannot be hidden by comparing only finance row counts. */
export function assertGoalImagesCleanup(beforeInput,afterInput,input) {
  const v=nativeRecord(nativeData(input),["owner","uploadId","candidates","protected"]);uuid(v.owner);uuid(v.uploadId);requireThat(typeof v.protected==="boolean");
  const {before,after}=materialPair(beforeInput,afterInput),a=before.finance,b=after.finance;
  rows(v.candidates);unique(v.candidates);for(const row of v.candidates){nativeRecord(row,["id","staging_path","final_path","remove_final"]);requireThat(typeof row.remove_final==="boolean"&&row.id===v.uploadId&&row.staging_path===v.owner+"/"+v.uploadId&&row.final_path===v.owner+"/"+v.uploadId);}
  const candidate=v.candidates.find(row=>row.id===v.uploadId);if(v.protected){requireThat(!candidate||candidate.remove_final===false);equal(before,after);return Object.freeze({deleted:0});}
  requireThat(candidate&&candidate.remove_final===true&&v.candidates.length===1);
  const original=before.files.find(row=>row.id===v.uploadId&&row.user_id===v.owner),next=after.files.find(row=>row.id===v.uploadId&&row.user_id===v.owner);requireThat(original&&next&&original.deleted_at===null&&next.deleted_at!==null&&next.purged_at===null);
  const changed=["payload","deleted_at","deletion_batch_id","updated_at","modified_at"];
  equal(Object.fromEntries(Object.entries(original).filter(([key])=>!changed.includes(key))),Object.fromEntries(Object.entries(next).filter(([key])=>!changed.includes(key))));
  equal({...original.payload,deleted_at:null,deletion_batch_id:null,updated_at:null,modified_at:null},{...next.payload,deleted_at:null,deletion_batch_id:null,updated_at:null,modified_at:null});uuid(next.deletion_batch_id);
  for(const field of ["deleted_at","updated_at","modified_at"]){requireThat(date(next.payload[field])>=date(original.created_at));if(Object.hasOwn(next,field))requireThat(date(next[field])===date(next.payload[field]));}equal(next.deletion_batch_id,next.payload.deletion_batch_id);
  equal(before.files.filter(row=>row.id!==v.uploadId),after.files.filter(row=>row.id!==v.uploadId));equal(before.uploads,after.uploads);
  const event=added(a.events,b.events);requireThat(event.user_id===v.owner&&event.entity_id===v.uploadId&&event.entity_type==="drive_file"&&event.action==="deleted"&&event.canal==="cron");equal(event.before,original.payload);equal(event.after,next.payload);requireThat(date(event.occurred_at)===date(next.deleted_at));
  equal({...a,events:[]},{...b,events:[]});return Object.freeze({deleted:1});
}
export function assertGoalImagesAck(beforeInput,afterInput,input) {
  const v=nativeRecord(nativeData(input),["owner","uploadId","protected"]);uuid(v.owner);uuid(v.uploadId);requireThat(typeof v.protected==="boolean");const {before,after}=materialPair(beforeInput,afterInput);
  equal(before.finance,after.finance);
  const a=before.uploads.find(row=>row.id===v.uploadId&&row.user_id===v.owner),b=after.uploads.find(row=>row.id===v.uploadId&&row.user_id===v.owner);requireThat(a&&b);const cleanedAt=date(b.cleaned_at);requireThat(a.cleaned_at===null||cleanedAt>date(a.cleaned_at));equal({...a,cleaned_at:null},{...b,cleaned_at:null});equal(before.uploads.filter(row=>row.id!==v.uploadId),after.uploads.filter(row=>row.id!==v.uploadId));
  const file=before.files.find(row=>row.id===v.uploadId&&row.user_id===v.owner),next=after.files.find(row=>row.id===v.uploadId&&row.user_id===v.owner);requireThat(file&&next);
  if(v.protected){equal(file,next);requireThat(next.purged_at===null);}else{requireThat(file.deleted_at!==null&&file.purged_at===null&&next.purged_at!==null);requireThat(date(next.purged_at)===date(b.cleaned_at));equal({...file,purged_at:null},{...next,purged_at:null});}
  equal(before.files.filter(row=>row.id!==v.uploadId),after.files.filter(row=>row.id!==v.uploadId));return Object.freeze({cleanupAcks:1});
}
/** Exact eight holder species, including retained archived Goal/Habit and
 * trashed Page. No caller-provided boolean can stand in for a holder row. */
export function assertGoalImagesHolders(input,ownerInput,idsInput) {
  const owner=uuid(ownerInput),material=readGoalImagesMaterial(input).a,ids=nativeRecord(nativeData(idsInput),["avatar","capture","project","home","habit","page","goal","archivedGoal"]);
  for(const id of Object.values(ids))uuid(id);requireThat(new Set(Object.values(ids)).size===8);
  const file=(key,kind)=>{const row=material.files.find(row=>row.id===ids[key]&&row.user_id===owner);requireThat(row&&row.kind===kind&&row.deleted_at===null&&row.purged_at===null);requireThat(material.uploads.some(upload=>upload.id===row.id&&upload.file_id===row.id&&upload.user_id===owner&&upload.status==="finalized"));};
  file("avatar","avatar");requireThat(material.profiles.some(row=>row.user_id===owner&&row.avatar_file_id===ids.avatar));
  file("capture","capture_image");requireThat(material.captureLinks.some(link=>link.user_id===owner&&link.file_id===ids.capture&&material.captures.some(capture=>capture.user_id===owner&&capture.id===link.capture_id)));
  file("project","project_cover");requireThat(material.projects.some(row=>row.user_id===owner&&row.cover_file_id===ids.project));
  file("home","home_focus_image");requireThat(material.preferences.some(row=>row.user_id===owner&&row.home_focus_file_id===ids.home));
  file("habit","habit_image");requireThat(material.habits.some(row=>row.user_id===owner&&row.image_file_id===ids.habit&&row.archived_at!==null));
  file("page","capture_image");requireThat(material.links.some(link=>link.user_id===owner&&link.from_type==="page"&&link.to_type==="file"&&link.to_id===ids.page&&link.deleted_at===null&&material.pages.some(page=>page.user_id===owner&&page.id===link.from_id&&page.origin_capture_id!==null&&page.deleted_at!==null&&material.captures.some(capture=>capture.user_id===owner&&capture.id===page.origin_capture_id)&&material.notebooks.some(book=>book.user_id===owner&&book.id===page.notebook_id))));
  for(const [key,archived]of [["goal",false],["archivedGoal",true]]){file(key,"finance_goal_image");requireThat(material.finance.goals.some(row=>row.user_id===owner&&row.image_file_id===ids[key]&&(row.archived_at!==null)===archived));}
  return Object.freeze({holders:8});
}