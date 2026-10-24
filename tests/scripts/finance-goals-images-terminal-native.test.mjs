/** Finite SQL text/tickets only. No psql, SQL, Auth, browser or Storage calls. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GOAL_IMAGES_NATIVE_ACTIONS, goalImagesNativeStatement, goalNativeStatement, inspectGoalNativeStatement, frameGoalNativeStatement } from "../e2e-auth-local/finance-goals-terminal-native-sql.mjs";
import { GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS, GOAL_IMAGES_NATIVE_CANDIDATE_WINDOWS, assertGoalImagesCandidateWindows, assertGoalImagesCommit, assertGoalImagesUnchanged, assertGoalImagesCleanup, assertGoalImagesAck, assertGoalImagesClosed, assertGoalImagesHolders } from "../e2e-auth-local/finance-goals-images-terminal-native-case.mjs";
const id = n => `79f10000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const context = { namespace: "sc-goals-terminal-native-" + "a".repeat(32), sourceSha: "b".repeat(40), systemIdentifier: "7250000000000000001" };
const actor = () => ({ owner: id(1), session: id(2), uploadId: id(3), clientId: id(4) });
const reserve = () => ({ ...actor(), kind: "finance_goal_image", expires: "2026-10-25T12:00:00.000Z" });
const complete = () => ({ ...actor(), leaseId: id(5), kind: "finance_goal_image", createdAt: "2026-10-23T12:00:00.000Z", updatedAt: "2026-10-24T12:00:00.000Z" });
const inspect = (action, data) => inspectGoalNativeStatement(goalImagesNativeStatement(context, action, data), context);
test("the whole original N SQL module remains a literal byte prefix", async () => {
  const bytes = await readFile(new URL("../e2e-auth-local/finance-goals-terminal-native-sql.mjs", import.meta.url));
  assert.equal(createHash("sha256").update(bytes.subarray(0, 12140)).digest("hex"), "8a2a77b6b486dc34a75afce5da255c9b89f846dc06929b33c68cff487674eefa");
  assert.equal(inspectGoalNativeStatement(goalNativeStatement(context, "BEGIN", { role: "service_role" }), context).transition, "open");
});
test("the eighteen image actions use only existing ACK kinds and the same nominal registry", () => {
  assert.equal(GOAL_IMAGES_NATIVE_ACTIONS.length, 18);
  const cases = [["IMAGE_RESERVE", reserve(), "file_upload_reserve"], ["IMAGE_CLAIM", { ...actor(), leaseId: id(5) }, "file_upload_claim"], ["IMAGE_COMPLETE", complete(), "file_upload_complete"], ["IMAGE_CLEANUP_CANDIDATES", {}, "file_cleanup_candidates"], ["IMAGE_CLEANUP_ACK", { uploadId: id(3) }, "file_cleanup_ack"]];
  for (const [action, data, rpc] of cases) { const value = inspect(action, data); assert.equal(value.expected, "rpc"); assert.equal(value.expectation.rpc, rpc); assert.equal(value.writing, true); assert.equal(value.transition, null); assert.match(value.sql, new RegExp("public\\." + rpc + "\\(")); }
  for (const [action, expected] of [["IMAGE_MATERIAL", "material"], ["IMAGE_ABSENCE", "absence"]]) { const value = inspect(action, { a: id(1), b: id(2) }); assert.equal(value.expected, expected); assert.equal(value.writing, false); }
});
test("a public ticket shape, clone and foreign context never authorize SQL", () => {
  const ticket = goalImagesNativeStatement(context, "IMAGE_RESERVE", reserve());
  const framed = frameGoalNativeStatement(ticket, context, "c".repeat(32), 1); assert.match(framed.input, /^select 'SC_GOALS_NATIVE:/);
  for (const fake of [{ ...ticket }, structuredClone(ticket)]) assert.throws(() => inspectGoalNativeStatement(fake, context));
  assert.throws(() => inspectGoalNativeStatement(ticket, { ...context, sourceSha: "d".repeat(40) }));
});
test("the finalized fixture is bound, fixed metadata and a captured immutable SQL value, not an observation", () => {
  const data = complete(), ticket = goalImagesNativeStatement(context, "IMAGE_COMPLETE", data), before = inspectGoalNativeStatement(ticket, context).sql;
  data.owner = id(90); data.updatedAt = "2027-01-01T00:00:00.000Z";
  assert.equal(inspectGoalNativeStatement(ticket, context).sql, before);
  const match = before.match(/decode\('([a-f0-9]+)','hex'\)/); assert.ok(match);
  const value = JSON.parse(Buffer.from(match[1], "hex").toString("utf8"));
  assert.equal(value.id, id(3)); assert.equal(value.user_id, id(1)); assert.equal(value.kind, "finance_goal_image"); assert.equal(value.name, "synthetic.png");
  assert.equal(value.bytes, 100); assert.equal(value.width, 40); assert.equal(value.height, 20); assert.equal(value.sha256, "a".repeat(64));
  assert.equal(value.created_at, "2026-10-23T12:00:00.000Z"); assert.equal(value.updated_at, "2026-10-24T12:00:00.000Z");
});
test("caller-selected RPC, SQL, quota, file body, path and unsupported purpose are refused", () => {
  for (const data of [{ ...reserve(), rpc: "pg_sleep" }, { ...reserve(), sql: "select 1" }, { ...reserve(), quota: 999 }, { ...reserve(), name: "other.png" }, { ...reserve(), kind: "foreign_purpose" }]) assert.throws(() => inspect("IMAGE_RESERVE", data));
  assert.throws(() => inspect("IMAGE_COMPLETE", { ...complete(), file: { body: "SYNTHETIC" } }));
  for (const action of ["RPC", "IMAGE_FIXTURE", "select 1", "IMAGE_CLEANUP_LOG", "IMAGE_CLEAR"]) assert.throws(() => inspect(action, {}));
  for (const data of [{ uploadId: id(3), owner: id(1) }, { uploadId: id(3), path: "owner/file" }]) assert.throws(() => inspect("IMAGE_CLEANUP_ACK", data));
});
test("invalid UUIDs, dates, duplicate owners and reversed metadata chronology refuse before issuance", () => {
  for (const data of [{ ...reserve(), owner: id(1).toUpperCase() }, { ...reserve(), clientId: "free-client" }, { ...reserve(), expires: "2026-02-30T00:00:00.000Z" }, { ...reserve(), expires: "2026-10-25T12:00:00Z" }]) assert.throws(() => inspect("IMAGE_RESERVE", data));
  assert.throws(() => inspect("IMAGE_COMPLETE", { ...complete(), createdAt: "2027-01-01T00:00:00.000Z" }));
  assert.throws(() => inspect("IMAGE_MATERIAL", { a: id(1), b: id(1) }));
});
test("getter, Proxy and string coercion never run for image tickets or context", () => {
  let hooks = 0; const value = reserve(); Object.defineProperty(value, "owner", { enumerable: true, get() { hooks++; return id(1); } });
  assert.throws(() => inspect("IMAGE_RESERVE", value));
  const coercion = { toString() { hooks++; return id(1); }, [Symbol.toPrimitive]() { hooks++; return id(1); } };
  assert.throws(() => inspect("IMAGE_RESERVE", { ...reserve(), owner: coercion }));
  assert.throws(() => goalImagesNativeStatement({ ...context, namespace: coercion }, "IMAGE_RESERVE", reserve()));
  assert.throws(() => inspect("IMAGE_RESERVE", new Proxy({}, { ownKeys() { hooks++; return []; } })));
  assert.equal(hooks, 0);
});

test("aging never finalizes a file and grants oracle is a closed native assertion", () => {
  const aged=inspect("IMAGE_FIXTURE_AGE",{owner:id(1),uploadId:id(3)});
  assert.equal(aged.expected,"fixture");assert.equal(aged.writing,true);assert.match(aged.sql,/current_user<>'postgres'/);assert.match(aged.sql,/r.status='finalized'/);assert.match(aged.sql,/raw_app_meta_data/);assert.match(aged.sql,/update app_private.upload_reservations set expires_at=/);assert.doesNotMatch(aged.sql,/insert into|update public.drive_files|set status=/);
  const gate=inspect("IMAGE_ASSERT_GRANTS",{});assert.equal(gate.expected,"fixture");assert.equal(gate.writing,false);assert.match(gate.sql,/tgtype=31/);assert.match(gate.sql,/tgtype=23/);assert.match(gate.sql,/has_function_privilege/);assert.match(gate.sql,/relrowsecurity/);
  for(const data of [{owner:id(1),uploadId:id(3),status:"finalized"},{owner:id(1),uploadId:id(3),sql:"select 1"}])assert.throws(()=>inspect("IMAGE_FIXTURE_AGE",data));
  assert.throws(()=>inspect("IMAGE_ASSERT_GRANTS",{role:"anon"}));
  const full=inspect("IMAGE_MATERIAL",{a:id(1),b:id(2)}).sql;for(const table of ["public.capture_file_links","public.habits","public.knowledge_pages","public.links","public.profiles","public.user_preferences"])assert.ok(full.includes(table));
});
const at="2026-10-24T12:00:00.000Z",old="2026-10-21T12:00:00.000Z";
function ownerMaterial(owner,image) {
  const payload={id:image,user_id:owner,kind:"finance_goal_image",created_at:old,updated_at:at,modified_at:at,deleted_at:null,deletion_batch_id:null};
  const finance=Object.fromEntries(["goals","reservations","releases","highlights","ledger","accounts","events","receipts","dispositions","limits","revisions","accountTotals","goalTotals","releaseTotals"].map(key=>[key,[]]));finance.revisions=[{user_id:owner,revision:"0"}];
  const value={finance,files:[{id:image,user_id:owner,payload,kind:"finance_goal_image",created_at:old,updated_at:at,deleted_at:null,deletion_batch_id:null,purged_at:null}],uploads:[{id:image,user_id:owner,file_id:image,status:"finalized",kind:"finance_goal_image",expires_at:old,cleaned_at:old}],...Object.fromEntries(["profiles","preferences","projects","captures","captureLinks","habits","notebooks","pages","links","pageRefs","roles","moderation","entitlements"].map(key=>[key,[]]))};return value;
}
const baseline=()=>({ack:"material",a:ownerMaterial(id(1),id(3)),b:ownerMaterial(id(2),id(4))});
function committed(before,update=false) {
  const after=structuredClone(before),owner=id(1),goalId=id(10),target=update?id(30):id(3);
  const goal={version:1,id:goalId,user_id:owner,name:"Meta nativa",target_cents:10000,deadline:null,image_file_id:target,archived_at:null,revision:update?"1":"0",created_at:old,updated_at:at};
  const change={type:"finance_goal",before:update?structuredClone(before.a.finance.goals[0].payload):null,after:goal};
  const command=update?{command:"finance.goal.update",input:{client_id:id(12),goal_id:goalId,expected_revision:"0",expected_finance_revision:"2",patch:{image_file_id:target}}}:{command:"finance.goal.create",input:{client_id:id(11),expected_finance_revision:"0",name:goal.name,target_cents:10000,deadline:null,image_file_id:target}};
  const event={id:update?id(21):id(20),user_id:owner,entity_type:"finance_goal",entity_id:goalId,action:update?"updated":"created",canal:"web",before:change.before,after:goal,occurred_at:at};
  const result={version:1,goal},fingerprint={SYNTHETIC:command};const batch={context:{user_id:owner},changes:[change],events:[event],receipt:{fingerprint,result}};
  const row={id:goalId,user_id:owner,payload:goal,archived_at:null,image_file_id:target};after.a.finance.goals=[row];after.a.finance.events.push(event);after.a.finance.receipts.push({user_id:owner,command:command.command,client_id:command.input.client_id,request:fingerprint,result});
  after.a.finance.revisions[0].revision=update?"4":"2";after.a.finance.goalTotals=[{user_id:owner,goal_id:goalId,saved_cents:0,finance_revision:update?"4":"2"}];
  after.a.finance.limits=[{user_id:owner,scope:"capture_task_write",subject_hash:"synthetic",hits:update?[at,at]:[at]}];return{after,input:{owner,command,batch,result,weights:{goal:1,event:1,receipt:0}}};
}
test("closed eight-window matrix distinguishes I5/I8 without fictitious barriers and two I6 writes", () => {
  assert.equal(Object.keys(GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS).length,8);
  for(const kind of Object.keys(GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS))assert.equal(assertGoalImagesCandidateWindows(kind,GOAL_IMAGES_NATIVE_CANDIDATE_WINDOWS[kind],GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS[kind]).implemented,false);
  assert.equal(GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS.I6_IMAGE_COMMIT_FIRST.receipts,2);
  assert.equal(GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS.I5_HOLDERS.holders,8);
  assert.throws(()=>assertGoalImagesCandidateWindows("I6_IMAGE_COMMIT_FIRST",GOAL_IMAGES_NATIVE_CANDIDATE_WINDOWS.I6_IMAGE_COMMIT_FIRST,{...GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS.I6_IMAGE_COMMIT_FIRST,receipts:1}));
  assert.throws(()=>assertGoalImagesCandidateWindows("I8_NEGATIVES_ROLLBACK",[...GOAL_IMAGES_NATIVE_CANDIDATE_WINDOWS.I8_NEGATIVES_ROLLBACK,"barrier"],GOAL_IMAGES_NATIVE_CANDIDATE_COUNTS.I8_NEGATIVES_ROLLBACK));
});
test("commit oracle checks full row/event/receipt/quota/revision and the actual image owner", () => {
  const before=baseline(),value=committed(before);assert.deepEqual(assertGoalImagesCommit(before,value.after,value.input),{receipts:1,financialEffects:1,financialEvents:1,quotaDelta:1,imageReferences:1});
  const attacks=[after=>{after.b.files[0].purged_at=at;},after=>{after.a.finance.goals[0].image_file_id=id(90);},after=>{after.a.finance.events[0].entity_id=id(90);},after=>{after.a.finance.receipts[0].result={version:1};},after=>{after.a.finance.limits[0].hits.push(at);},after=>{after.a.finance.revisions[0].revision="4";},after=>{after.a.uploads[0].status="reserved";},after=>{after.a.profiles.push({user_id:id(1),avatar_file_id:id(3)});},after=>{after.a.finance.events.push({...after.a.finance.events[0],id:id(55)});}];
  for(const mutate of attacks){const after=structuredClone(value.after);mutate(after);assert.throws(()=>assertGoalImagesCommit(before,after,value.input));}
  const foreign=structuredClone(before);foreign.a.files[0].user_id=id(2);assert.throws(()=>assertGoalImagesCommit(foreign,value.after,value.input));
});
test("update window preserves old payload/financial material and uses the composite receipt key", () => {
  const first=committed(baseline()).after;first.a.files.push({...structuredClone(first.a.files[0]),id:id(30),payload:{...first.a.files[0].payload,id:id(30)}});first.a.uploads.push({...first.a.uploads[0],id:id(30),file_id:id(30)});
  const value=committed(first,true);assert.equal(assertGoalImagesCommit(first,value.after,value.input).receipts,1);
  for(const mutate of [after=>{after.a.finance.goals[0].payload.name="Changed unexpectedly";},after=>{after.a.finance.receipts.splice(0,1);},after=>{after.a.finance.goalTotals[0].saved_cents=1;}]){const after=structuredClone(value.after);mutate(after);assert.throws(()=>assertGoalImagesCommit(first,after,value.input));}
});
function cleanup(before) {
  const after=structuredClone(before),file=after.a.files[0];file.payload={...file.payload,deleted_at:at,deletion_batch_id:id(40),updated_at:at,modified_at:at};file.deleted_at=at;file.deletion_batch_id=id(40);file.updated_at=at;
  after.a.finance.events.push({id:id(41),user_id:id(1),entity_type:"drive_file",entity_id:id(3),action:"deleted",canal:"cron",before:before.a.files[0].payload,after:file.payload,occurred_at:at});
  const candidates=[{id:id(3),staging_path:id(1)+"/"+id(3),final_path:id(1)+"/"+id(3),remove_final:true}];return{after,input:{owner:id(1),uploadId:id(3),candidates,protected:false}};
}
test("cleanup oracle requires the exact deletion event, unchanged money and complete other owner", () => {
  const before=baseline(),value=cleanup(before);assert.deepEqual(assertGoalImagesCleanup(before,value.after,value.input),{deleted:1});
  for(const mutate of [after=>{after.a.finance.revisions[0].revision="1";},after=>{after.a.finance.events[0].canal="web";},after=>{after.a.files[0].purged_at=at;},after=>{after.b.uploads[0].cleaned_at=at;},after=>{after.a.finance.events.push({...after.a.finance.events[0],id:id(99)});}]){const after=structuredClone(value.after);mutate(after);assert.throws(()=>assertGoalImagesCleanup(before,after,value.input));}
  assert.deepEqual(assertGoalImagesCleanup(before,before,{...value.input,protected:true,candidates:[{...value.input.candidates[0],remove_final:false}]}),{deleted:0});
  assert.throws(()=>assertGoalImagesCleanup(before,value.after,{...value.input,protected:true}));
  assert.throws(()=>assertGoalImagesCleanup(before,value.after,{...value.input,candidates:[]}));
});
test("ACK oracle accepts only cleaned_at plus allowed purge and never metadata/proof substitution", () => {
  const clean=cleanup(baseline()).after,after=structuredClone(clean);after.a.uploads[0].cleaned_at=at;after.a.files[0].purged_at=at;
  assert.deepEqual(assertGoalImagesAck(clean,after,{owner:id(1),uploadId:id(3),protected:false}),{cleanupAcks:1});
  const held=baseline(),next=structuredClone(held);next.a.uploads[0].cleaned_at=at;assert.equal(assertGoalImagesAck(held,next,{owner:id(1),uploadId:id(3),protected:true}).cleanupAcks,1);
  assert.throws(()=>assertGoalImagesAck(held,held,{owner:id(1),uploadId:id(3),protected:true}));assert.throws(()=>assertGoalImagesAck(clean,clean,{owner:id(1),uploadId:id(3),protected:false}));
  for(const mutate of [value=>{value.a.files[0].payload.name="changed";},value=>{value.a.uploads[0].file_id=id(90);},value=>{value.a.finance.events.push({id:id(90)});},value=>{value.a.files[0].purged_at=null;}]){const value=structuredClone(after);mutate(value);assert.throws(()=>assertGoalImagesAck(clean,value,{owner:id(1),uploadId:id(3),protected:false}));}
});
test("ACK oracle accepts a first cleaned_at from null for protected and unprotected files", () => {
  for(const protectedFile of [false,true]){
    const before=protectedFile?baseline():cleanup(baseline()).after;before.a.uploads[0].cleaned_at=null;
    const after=structuredClone(before);after.a.uploads[0].cleaned_at=at;if(!protectedFile)after.a.files[0].purged_at=at;
    assert.deepEqual(assertGoalImagesAck(before,after,{owner:id(1),uploadId:id(3),protected:protectedFile}),{cleanupAcks:1});
  }
});
test("ACK oracle refuses null or invalid after timestamps and non-increasing or invalid prior timestamps", () => {
  for(const protectedFile of [false,true])for(const cleanedAt of [null,"invalid",old,"2026-10-20T12:00:00.000Z"]){
    const before=protectedFile?baseline():cleanup(baseline()).after,after=structuredClone(before);after.a.uploads[0].cleaned_at=cleanedAt;if(!protectedFile)after.a.files[0].purged_at=cleanedAt;
    assert.throws(()=>assertGoalImagesAck(before,after,{owner:id(1),uploadId:id(3),protected:protectedFile}));
  }
  for(const protectedFile of [false,true])for(const cleanedAt of [null,"invalid"]){
    const before=protectedFile?baseline():cleanup(baseline()).after;before.a.uploads[0].cleaned_at=null;
    const after=structuredClone(before);after.a.uploads[0].cleaned_at=cleanedAt;if(!protectedFile)after.a.files[0].purged_at=cleanedAt;
    assert.throws(()=>assertGoalImagesAck(before,after,{owner:id(1),uploadId:id(3),protected:protectedFile}));
  }
  for(const protectedFile of [false,true]){
    const before=protectedFile?baseline():cleanup(baseline()).after;before.a.uploads[0].cleaned_at="invalid";
    const after=structuredClone(before);after.a.uploads[0].cleaned_at=at;if(!protectedFile)after.a.files[0].purged_at=at;
    assert.throws(()=>assertGoalImagesAck(before,after,{owner:id(1),uploadId:id(3),protected:protectedFile}));
  }
});
test("a first ACK from null still refuses collateral material, owner, holder or purge changes", () => {
  for(const protectedFile of [false,true]){
    const before=protectedFile?baseline():cleanup(baseline()).after;before.a.uploads[0].cleaned_at=null;
    const after=structuredClone(before);after.a.uploads[0].cleaned_at=at;if(!protectedFile)after.a.files[0].purged_at=at;
    const mutations=[value=>{value.a.files[0].payload.name="changed";},value=>{value.a.uploads[0].user_id=id(2);},value=>{value.a.uploads[0].file_id=id(90);},value=>{value.a.finance.events.push({id:id(90)});},value=>{value.a.projects.push({id:id(91),user_id:id(1),cover_file_id:id(3)});},value=>{value.b.uploads[0].cleaned_at=at;},value=>{value.a.files[0].purged_at=protectedFile?at:null;}];
    for(const mutate of mutations){const value=structuredClone(after);mutate(value);assert.throws(()=>assertGoalImagesAck(before,value,{owner:id(1),uploadId:id(3),protected:protectedFile}));}
  }
});
test("no-change oracle catches in-place edits with unchanged table counts", () => {
  const before=baseline();assert.equal(assertGoalImagesUnchanged(before,structuredClone(before)),true);
  for(const mutate of [value=>{value.a.files[0].payload.name="inplace";},value=>{value.a.finance.revisions[0].revision="1";},value=>{value.b.uploads[0].expires_at=at;}]){const value=structuredClone(before);mutate(value);assert.throws(()=>assertGoalImagesUnchanged(before,value));}
});
test("settlement oracle requires one exact tombstone/event/quota and no financial/image effect", () => {
  const before=baseline(),after=structuredClone(before),command={command:"finance.goal.create",input:{client_id:id(11)}},disposition={id:id(50),user_id:id(1),command:command.command,client_id:id(11),version:2,canonicalization_version:1,input_digest:"a".repeat(64),closed_at:at};
  after.a.finance.dispositions=[{...disposition,input_digest:"\\x"+disposition.input_digest}];after.a.finance.events=[{id:id(51),user_id:id(1),entity_type:"finance_goal_disposition",entity_id:id(50),action:"created",canal:"web",before:null,after:disposition,occurred_at:at}];after.a.finance.limits=[{user_id:id(1),scope:"capture_task_write",subject_hash:"synthetic",hits:[at]}];after.a.finance.revisions[0].revision="1";
  const input={owner:id(1),command,reply:{kind:"closed",disposition},weights:{disposition:0,event:1}};assert.equal(assertGoalImagesClosed(before,after,input).imageReferences,0);
  for(const weights of [{disposition:1,event:1},{disposition:0,event:0}])assert.throws(()=>assertGoalImagesClosed(before,after,{...input,weights}));
  for(const mutate of [value=>{value.a.finance.events[0].after={};},value=>{value.a.finance.dispositions[0].input_digest="a";},value=>{value.a.files[0].deleted_at=at;},value=>{value.a.finance.receipts.push({client_id:id(11)});}]){const value=structuredClone(after);mutate(value);assert.throws(()=>assertGoalImagesClosed(before,value,input));}
});
test("all eight actual holders including archived/trashed rows are required, not eight truthy flags", () => {
  const value=baseline(),owner=id(1),names=["avatar","capture","project","home","habit","page","goal","archivedGoal"],kinds=["avatar","capture_image","project_cover","home_focus_image","habit_image","capture_image","finance_goal_image","finance_goal_image"],ids=Object.fromEntries(names.map((key,n)=>[key,id(n+60)]));
  value.a.files=names.map((key,n)=>({id:ids[key],user_id:owner,kind:kinds[n],deleted_at:null,purged_at:null}));value.a.uploads=names.map(key=>({id:ids[key],user_id:owner,file_id:ids[key],status:"finalized"}));
  value.a.profiles=[{user_id:owner,avatar_file_id:ids.avatar}];value.a.preferences=[{user_id:owner,home_focus_file_id:ids.home}];value.a.projects=[{id:id(80),user_id:owner,cover_file_id:ids.project}];value.a.habits=[{id:id(81),user_id:owner,image_file_id:ids.habit,archived_at:at}];value.a.captures=[{id:id(82),user_id:owner},{id:id(83),user_id:owner}];value.a.captureLinks=[{user_id:owner,capture_id:id(82),file_id:ids.capture}];value.a.notebooks=[{id:id(84),user_id:owner}];value.a.pages=[{id:id(85),user_id:owner,notebook_id:id(84),origin_capture_id:id(83),deleted_at:at}];value.a.links=[{id:id(86),user_id:owner,from_type:"page",from_id:id(85),to_type:"file",to_id:ids.page,deleted_at:null}];value.a.finance.goals=[{id:id(87),user_id:owner,image_file_id:ids.goal,archived_at:null},{id:id(88),user_id:owner,image_file_id:ids.archivedGoal,archived_at:at}];value.a.finance.goalTotals=value.a.finance.goals.map(goal=>({user_id:owner,goal_id:goal.id,saved_cents:0,finance_revision:"0"}));
  assert.deepEqual(assertGoalImagesHolders(value,owner,ids),{holders:8});
  for(const key of ["profiles","preferences","projects","habits","captureLinks","pages","links","notebooks"]){const attack=structuredClone(value);attack.a[key]=[];assert.throws(()=>assertGoalImagesHolders(attack,owner,ids));}
  const attack=structuredClone(value);attack.a.finance.goals[1].archived_at=null;assert.throws(()=>assertGoalImagesHolders(attack,owner,ids));
  const foreign=structuredClone(value);foreign.a.pages[0].user_id=id(2);assert.throws(()=>assertGoalImagesHolders(foreign,owner,ids));
});
test("holder/fault templates are closed to original IDs and preserve all projection guards", () => {
  const files=Object.fromEntries(["avatar","capture","project","home","habit","page"].map((key,n)=>[key,id(n+100)])),ids=Object.fromEntries(["project","habit","capture","pageCapture","notebook","page","link","deletionBatch"].map((key,n)=>[key,id(n+200)])),data={owner:id(1),files,ids,at};
  const holder=inspect("IMAGE_FIXTURE_HOLDERS",data);assert.equal(holder.expected,"fixture");assert.equal(holder.writing,true);
  for(const needle of ["public.profiles","public.user_preferences","public.projects(payload)","public.habits(payload)","public.captures(payload)","public.knowledge_notebooks","public.knowledge_pages","public.links"])assert.ok(holder.sql.includes(needle));
  assert.match(holder.sql,/r.status='finalized'/);assert.match(holder.sql,/Page must hold independently/);assert.doesNotMatch(holder.sql,/disable trigger|drop constraint|session_replication_role/i);
  for(const changed of [{...data,files:{...files,extra:id(900)}},{...data,ids:{...ids,project:ids.habit}},{...data,files:{...files,avatar:ids.project}},{...data,at:"invalid"},{...data,sql:"select 1"}])assert.throws(()=>inspect("IMAGE_FIXTURE_HOLDERS",changed));
  const all={...files,goal:id(300),archivedGoal:id(301)},oracle=inspect("IMAGE_ASSERT_HOLDERS",{owner:id(1),files:all});assert.equal(oracle.writing,false);assert.match(oracle.sql,/fgi_previous_image_referenced/);assert.match(oracle.sql,/entity_image_referenced/);
  for(const action of ["IMAGE_FIXTURE_FIRST_PASS","IMAGE_FIXTURE_TOMBSTONE"]){const value=inspect(action,{owner:id(1),uploadId:id(3),...(action==="IMAGE_FIXTURE_TOMBSTONE"?{batchId:id(40)}:{})});assert.match(value.sql,/for share;perform app_private.capture_task_lock/);assert.match(value.sql,/for update/);assert.match(value.sql,/r.file_id is distinct from f.id/);assert.match(value.sql,/get diagnostics n=row_count/);assert.equal(value.writing,true);}
});
test("I8 uses real literal wrappers and exact subtransaction errors, never caller SQL or missing error success", () => {
  const value=committed(baseline()),request={...value.input.batch,request:value.input.command,expected_finance_revision:"0"};
  for(const mode of ["foreign-owner","foreign-session","purpose"]){const action=inspect("IMAGE_ASSERT_DENIED",{owner:id(1),session:id(2),request,mode});assert.equal(action.expected,"fixture");assert.equal(action.writing,true);assert.match(action.sql,/perform public\.finance_goals_commit\(/);assert.match(action.sql,/if not caught then raise exception/);assert.match(action.sql,/sqlstate is distinct from/);if(mode==="purpose")assert.match(action.sql,/New goal image is not finalized for this purpose/);}
  const fault=inspect("IMAGE_ASSERT_FAULT",{owner:id(1),session:id(2),request});assert.match(fault.sql,/sqlerrm is distinct from 'Synthetic image native post-projection failure\.'/);
  assert.throws(()=>inspect("IMAGE_ASSERT_DENIED",{owner:id(1),session:id(2),request,mode:"fault"}));assert.throws(()=>inspect("IMAGE_ASSERT_DENIED",{owner:id(1),session:id(2),request,mode:"foreign-owner",expected:true}));
  for(const action of ["IMAGE_FAULT_INSTALL","IMAGE_FAULT_REMOVE"]){const source=inspect(action,{owner:id(1),goalId:id(10)}).sql;assert.match(source,/sc_goal_native_fixture/);assert.match(source,/test_fgi_native_event_refusal/);if(action==="IMAGE_FAULT_REMOVE")assert.match(source,/obj_description/);else{assert.match(source,/new\.entity_type='finance_goal'/);assert.match(source,/new\.entity_id=/);assert.match(source,/comment on function/);}}
  const closed=inspect("IMAGE_ASSERT_PRIVATE_DENIED",{owner:id(1),uploadId:id(3)});assert.equal(closed.writing,false);assert.match(closed.sql,/array\['anon','authenticated','service_role'\]/);assert.match(closed.sql,/exception when insufficient_privilege/);assert.match(closed.sql,/set local role postgres/);
});
test("native catalogue weights are exactly goal1/event1/receipt0 and reject trigger drift", () => {
  const before=baseline(),value=committed(before);assert.equal(assertGoalImagesCommit(before,value.after,value.input).receipts,1);
  for(const weights of [{goal:1,event:1,receipt:1},{goal:0,event:1,receipt:0},{goal:2,event:1,receipt:0},{goal:1,event:0,receipt:0},{goal:1,event:1,receipt:-1}])assert.throws(()=>assertGoalImagesCommit(before,value.after,{...value.input,weights}));
});