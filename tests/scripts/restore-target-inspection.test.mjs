import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inspect } from "node:util";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { planManagedTargetBaseline, managedTargetBaselineRequirements, planManagedRestore, managedRestoreRequirements, authorizeManagedRestore, claimManagedRestore, planManagedTargetInspection, managedTargetInspectionRequirements } from "../../scripts/operations/restore-managed-plan.mjs";
import { extractCustomTargetToc, extractCustomArchiveToc, customArchiveTocFacts, discardCustomArchiveToc, CUSTOM_TOC_ERROR_CODES, extractCustomTargetInspectionToc, customTargetInspectionTocFacts, discardCustomTargetInspectionToc } from "../../scripts/operations/restore-custom-toc.mjs";
import { migrationHistoryCopySelection, extractMigrationHistory } from "../../scripts/operations/restore-migration-history.mjs";

// Artificial RAM only. No connection, profile/archive, child, filesystem port,
// PostgreSQL executable, native receipt, restore or baseline comparator. The fixture encoding is copied
// from the authored B4 QA; it does not import/run another test file.
const canary = "PRIVATE_TARGET_BASELINE_CANARY", hash = bytes => createHash("sha256").update(bytes).digest("hex");
const read = bytes => bytes === null ? null : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
const refuse = (fn, code) => assert.throws(fn, error => {
  assert.equal(error instanceof BackupError, true); assert.equal(error.code, code); assert.equal(error.message, code);
  assert.equal(Object.hasOwn(error, "cause"), false);
  for (const value of [error.stack, inspect(error), JSON.stringify(error)]) assert.equal(value.includes(canary), false);
  return true;
});
const HEADER = Buffer.from("5047444d5001100004080101" +
  "0017000000002a000000000f00000000100000000009000000007e0000000000000000" +
  "0008000000706f737467726573000400000031372e36000400000031382e34", "hex");
const integer = value => { const bytes = Buffer.alloc(5); bytes[0] = value < 0 ? 1 : 0; bytes.writeUInt32LE(Math.abs(value), 1); return bytes; };
const string = value => { if (value === null) return integer(-1); const bytes = typeof value === "string" ? Buffer.from(value) : value; return Buffer.concat([integer(bytes.length), bytes]); };
const AUTH_COPY = "COPY auth.schema_migrations (version) FROM stdin;\n", STORAGE_COPY = "COPY storage.migrations (id, name, hash, executed_at) FROM stdin;\n";
const section = kind => ["ACL", "COMMENT"].includes(kind) ? 1 : ["TABLE DATA", "SEQUENCE SET"].includes(kind) ? 3 : ["CONSTRAINT", "DEFAULT ACL", "FK CONSTRAINT", "INDEX", "POLICY", "ROW SECURITY", "TRIGGER"].includes(kind) ? 4 : 2;
const nativeRows = () => [
  [1,"ENCODING","-","ENCODING","",[]], [2,"STDSTRINGS","-","STDSTRINGS","",[]], [3,"SEARCHPATH","-","SEARCHPATH","",[]],
  [4,"SCHEMA","-","auth","supabase_auth_admin",[]], [5,"SCHEMA","-","storage","supabase_storage_admin",[]], [6,"SCHEMA","-","public","pg_database_owner",[]],
  [7,"TABLE","auth","users","supabase_auth_admin",[4]], [8,"TABLE","auth","schema_migrations","supabase_auth_admin",[4]],
  [9,"TABLE","storage","objects","supabase_storage_admin",[5]], [10,"TABLE","storage","buckets","supabase_storage_admin",[5]], [11,"TABLE","storage","migrations","supabase_storage_admin",[5]],
  [12,"TABLE DATA","auth","users","supabase_auth_admin",[7]], [13,"TABLE DATA","auth","schema_migrations","supabase_auth_admin",[8]],
  [14,"TABLE DATA","storage","objects","supabase_storage_admin",[9]], [15,"TABLE DATA","storage","buckets","supabase_storage_admin",[10]], [16,"TABLE DATA","storage","migrations","supabase_storage_admin",[11]],
  [17,"SEQUENCE","auth","refresh_tokens_id_seq","supabase_auth_admin",[4]], [18,"SEQUENCE SET","auth","refresh_tokens_id_seq","supabase_auth_admin",[17]],
  [19,"DATABASE","-","postgres","postgres",[]], [20,"DATABASE PROPERTIES","-","postgres","postgres",[]], [21,"ACL","-","DATABASE postgres","postgres",[19]],
  [22,"COMMENT","-","SCHEMA public","pg_database_owner",[6]], [23,"DEFAULT ACL","auth","DEFAULT PRIVILEGES FOR TABLES","supabase_auth_admin",[4]],
  [24,"FUNCTION","auth","service_function()","supabase_auth_admin",[4,7,4]], [25,"POLICY","storage","objects platform_policy","supabase_storage_admin",[9]],
  [26,"TRIGGER","auth","users platform_trigger","supabase_auth_admin",[7,24]], [27,"ACL","-","SCHEMA auth","supabase_auth_admin",[4]], [28,"COMMENT","-","DATABASE postgres","postgres",[19]],
  [29,"VIEW","auth","service_view","supabase_auth_admin",[7]], [30,"CONSTRAINT","auth","users users_pkey","supabase_auth_admin",[7]], [31,"INDEX","auth","users_extra_idx","supabase_auth_admin",[7]],
  [32,"TYPE","auth","service_type","supabase_auth_admin",[4]], [33,"ROW SECURITY","auth","users","supabase_auth_admin",[7]], [34,"DEFAULT","auth","users role","supabase_auth_admin",[7]],
  [35,"FK CONSTRAINT","storage","objects objects_bucket_fkey","supabase_storage_admin",[9,10]], [36,"COMMENT","auth","TABLE users","supabase_auth_admin",[7]],
  [37,"ACL","storage","TABLE objects","supabase_storage_admin",[9]], [38,"SEQUENCE OWNED BY","auth","refresh_tokens_id_seq","supabase_auth_admin",[17,7]],
].map(([id,kind,schema,tag,owner,dependencies]) => ({ id,kind,schema,tag,owner,dependencies,catalogClassOid:kind==="TABLE"?1259:kind==="FUNCTION"?1255:0,catalogObjectOid:id===8?4294967295:id*7 }));
const tocFor = rows => `;     TOC Entries: ${rows.length}\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n` + rows.map(row => `${row.id}; ${row.catalogClassOid} ${row.catalogObjectOid} ${row.kind} ${row.schema} ${row.tag} ${row.owner}\n` + (row.dependencies.length ? ";\tdepends on: " + row.dependencies.join(" ") + "\n" : "")).join("");
function fixture({ rows = nativeRows(), wire = {}, tail = Buffer.from([255,254,0,128]) } = {}) {
  const parts = [HEADER,integer(rows.length)], marks = new Map(); let position = HEADER.length + 5;
  const push = bytes => { parts.push(bytes); position += bytes.length; };
  for (const row of rows) {
    const fields = { dumpId:row.id,hadDumper:row.kind==="TABLE DATA"?1:0,catalogClassOid:String(row.catalogClassOid),catalogObjectOid:String(row.catalogObjectOid),tag:row.tag,kind:row.kind,sectionCode:section(row.kind),
      definition:row.kind==="ENCODING"?"SET client_encoding = 'UTF8';\n":row.kind==="STDSTRINGS"?"SET standard_conforming_strings = 'on';\n":row.kind==="SEARCHPATH"?"SELECT pg_catalog.set_config('search_path', '', false);\n":row.kind==="TABLE DATA"?null:"-- artificial "+canary+"\n",
      dropStatement:null,copyStatement:row.kind==="TABLE DATA"?row.id===13?AUTH_COPY:row.id===16?STORAGE_COPY:"COPY synthetic (value) FROM stdin;\n":null,namespace:row.schema==="-"?null:row.schema,tablespace:null,tableAccessMethod:row.kind==="TABLE"?"heap":null,
      relationKind:row.kind==="TABLE"?114:row.kind==="VIEW"?118:0,owner:row.kind==="ENCODING"?null:row.owner,withOids:"false",dependencies:row.dependencies,customDataState:row.kind==="TABLE DATA"?1:3,customDataOffset:0n,...wire[row.id] };
    const mark = {}; marks.set(row.id,mark);
    const number = key => { mark[key]=position;push(integer(fields[key])); }, text = key => { mark[key]=position;push(string(fields[key])); };
    number("dumpId");number("hadDumper");text("catalogClassOid");text("catalogObjectOid");text("tag");text("kind");number("sectionCode");
    for (const key of ["definition","dropStatement","copyStatement","namespace","tablespace","tableAccessMethod"]) text(key);
    number("relationKind");text("owner");text("withOids");
    for (const id of fields.dependencies) push(string(String(id)));push(integer(-1));push(Buffer.from([fields.customDataState]));
    const offset=Buffer.alloc(8);offset.writeBigUInt64LE(fields.customDataOffset);push(offset);
  }
  const tocEndOffset=position;push(tail);return { rows,toc:tocFor(rows),database:Buffer.concat(parts),marks,tocEndOffset };
}
const bindingFor = (context, extra = {}) => ({projectRef:"t".repeat(20),databaseName:"postgres",nativeDumpSha256:hash(context.database),nativeDumpBytes:context.database.length,...extra});
const planFor = (context, extra = {}, text = context.toc) => planManagedTargetBaseline(text,bindingFor(context,extra));
const targetFor = context => { const plan=planFor(context),handle=extractCustomTargetToc(plan,context.database);return {plan,handle,facts:customArchiveTocFacts(handle)}; };
const sourceRows = () => nativeRows().concat([
  [100,"SCHEMA","-","app_private","postgres",[]], [101,"FUNCTION","app_private","on_auth_user_created()","postgres",[100]], [102,"FUNCTION","app_private","check_admin_auth_creation_final()","postgres",[100,7]],
  [103,"TABLE","public","profiles","postgres",[6,7]], [104,"TRIGGER","auth","users second_brain_identity_created","postgres",[7,101]], [105,"TRIGGER","auth","users second_brain_admin_creation_final","postgres",[7,102]],
  [106,"POLICY","storage","objects second_brain_private_objects","supabase_storage_admin",[9]], [107,"POLICY","storage","buckets second_brain_private_buckets","supabase_storage_admin",[10]],
].map(([id,kind,schema,tag,owner,dependencies])=>({id,kind,schema,tag,owner,dependencies,catalogClassOid:kind==="TABLE"?1259:0,catalogObjectOid:id*7})));
const sourcePlan = context => planManagedRestore(context.toc,{archiveSha256:"a".repeat(64),databaseSha256:hash(context.database),databaseBytes:context.database.length});


const inspectionRows = () => nativeRows().concat([
  { id:100,kind:"FUNCTION",schema:"public",tag:"inspection_candidate()",owner:"postgres",dependencies:[6],catalogClassOid:1255,catalogObjectOid:700 },
  { id:101,kind:"ACL",schema:"public",tag:"FUNCTION inspection_candidate()",owner:"postgres",dependencies:[100,6],catalogClassOid:0,catalogObjectOid:0 },
  { id:102,kind:"COMMENT",schema:"public",tag:"FUNCTION inspection_candidate()",owner:"postgres",dependencies:[100],catalogClassOid:0,catalogObjectOid:0 },
  { id:103,kind:"DEFAULT ACL",schema:"public",tag:"DEFAULT PRIVILEGES FOR FUNCTIONS",owner:"postgres",dependencies:[6],catalogClassOid:826,catalogObjectOid:701 },
  { id:104,kind:"VIEW",schema:"public",tag:"candidate_view",owner:"postgres",dependencies:[100,7,100],catalogClassOid:1259,catalogObjectOid:702 },
  { id:105,kind:"SCHEMA",schema:"-",tag:"app_private",owner:"postgres",dependencies:[],catalogClassOid:2615,catalogObjectOid:703 },
  { id:106,kind:"TYPE",schema:"app_private",tag:"candidate_type",owner:"postgres",dependencies:[105],catalogClassOid:1247,catalogObjectOid:704 },
]);
const inventoryFor = context => planManagedTargetInspection(context.toc, bindingFor(context));
const inspectedFor = context => { const plan=inventoryFor(context),handle=extractCustomTargetInspectionToc(plan,context.database);return {plan,handle,facts:customTargetInspectionTocFacts(handle)}; };

test("complete nominal inspection retains all24 classes and every app record without a baseline selection", () => {
  const context=fixture({rows:inspectionRows()}),plan=inventoryFor(context),requirements=managedTargetInspectionRequirements(plan);
  assert.deepEqual(plan,{version:1,inspectionOnly:true,baselineQualified:false});assert.equal(Object.isFrozen(plan),true);
  assert.equal(JSON.stringify(plan).includes(canary),false);assert.deepEqual(Object.keys(requirements),["binding","records","inspectionOnly","baselineQualified"]);
  assert.equal(requirements.binding.side,"target-inspection");assert.deepEqual(requirements.binding,{side:"target-inspection",...bindingFor(context),tocSha256:hash(context.toc)});
  assert.equal(requirements.records.length,context.rows.length);assert.deepEqual(requirements.records.map(row=>row.id),context.rows.map(row=>row.id));
  assert.equal(new Set(requirements.records.map(row=>row.description)).size,24);assert.equal(requirements.inspectionOnly,true);assert.equal(requirements.baselineQualified,false);
  for(const field of ["selected","preserved","segments","allTargetsEmpty","nativeOrigin","authenticated","restoreAccepted"])assert.equal(Object.hasOwn(requirements,field),false);
  for(const row of requirements.records){assert.equal(Object.isFrozen(row),true);assert.equal(Object.isFrozen(row.dependencies),true);}
  assert.equal(Object.isFrozen(requirements.records),true);assert.equal(Object.isFrozen(requirements.binding),true);assert.equal(Object.isFrozen(requirements),true);
  assert.deepEqual(requirements.records.find(row=>row.id===104).dependencies,[100,7,100]);
  assert.equal(requirements.records.find(row=>row.id===8).catalogObjectOid,4294967295);
  assert.throws(()=>{requirements.records[0].owner=canary;},TypeError);
  assert.notEqual(managedTargetInspectionRequirements(plan).records,requirements.records);
});

test("B4 remains unchanged and refuses the same app DDL while inspection cannot qualify a target", () => {
  const context=fixture({rows:inspectionRows()}),plan=inventoryFor(context);
  refuse(()=>planFor(context),"RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED");
  refuse(()=>managedTargetBaselineRequirements(plan),"RESTORE_MANAGED_TARGET_BASELINE_REQUIRED");
  refuse(()=>managedRestoreRequirements(plan),"RESTORE_MANAGED_PLAN_REQUIRED");
  refuse(()=>authorizeManagedRestore(plan,{}),"RESTORE_MANAGED_PLAN_REQUIRED");
  refuse(()=>claimManagedRestore(plan,{}),"RESTORE_MANAGED_AUTHORIZATION_REQUIRED");
  const observed=managedTargetInspectionRequirements(plan);
  assert.equal(observed.records.some(row=>row.schema==="app_private"),true);
  assert.equal(observed.records.some(row=>row.description==="DEFAULT ACL"&&row.schema==="public"),true);
  assert.equal(observed.baselineQualified,false);
});

test("inspection input binding remains exact and proxies/getters cannot supply provenance", () => {
  const context=fixture({rows:inspectionRows()}),good=bindingFor(context);let traps=0;
  const proxy=new Proxy(good,{get(){traps++;throw Error(canary);},ownKeys(){traps++;throw Error(canary);}}),revoked=Proxy.revocable({},{});revoked.revoke();
  const getter={...good};Object.defineProperty(getter,"projectRef",{enumerable:true,get(){traps++;throw Error(canary);}});
  for(const value of [null,undefined,[],{},proxy,revoked.proxy,getter,{...good,nativeOrigin:true},{...good,inspectionOnly:true},{...good,baselineQualified:true},{...good,projectRef:"T".repeat(20)},{...good,nativeDumpBytes:0},{...good,nativeDumpSha256:"A".repeat(64)}]){
    refuse(()=>planManagedTargetInspection(context.toc,value),"RESTORE_MANAGED_TARGET_BINDING_INVALID");
  }
  assert.equal(traps,0);
});

test("nominal plan maps are mutually exclusive for Source, B4, inspection and forged handles", () => {
  const context=fixture(),baseline=planFor(context),source=fixture({rows:sourceRows()}),restore=sourcePlan(source),inspection=inventoryFor(context);let traps=0;
  const proxy=new Proxy(inspection,{get(){traps++;throw Error(canary);},ownKeys(){traps++;throw Error(canary);}}),revoked=Proxy.revocable({},{});revoked.revoke();
  for(const value of [baseline,restore,{},structuredClone(inspection),Object.create(inspection),proxy,revoked.proxy,null,undefined,3]){
    refuse(()=>managedTargetInspectionRequirements(value),"RESTORE_MANAGED_TARGET_INSPECTION_REQUIRED");
    refuse(()=>extractCustomTargetInspectionToc(value,context.database),"RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED");
  }
  refuse(()=>extractCustomTargetToc(inspection,context.database),"RESTORE_CUSTOM_TOC_TARGET_REQUIRED");
  refuse(()=>extractCustomArchiveToc(inspection,context.database),"RESTORE_CUSTOM_TOC_PLAN_REQUIRED");
  const poison={get byteLength(){traps++;throw Error(canary);}};
  refuse(()=>extractCustomTargetInspectionToc({},poison),"RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED");
  assert.equal(traps,0);assert.equal(CUSTOM_TOC_ERROR_CODES.includes("RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED"),true);
});

test("inspection keeps the original24-kind grammar and dependency/size caps", () => {
  const context=fixture({rows:inspectionRows()});
  const unknown=fixture({rows:inspectionRows().concat({id:200,kind:"PRIVATE_UNKNOWN",schema:"public",tag:canary,owner:"postgres",dependencies:[6],catalogClassOid:0,catalogObjectOid:0})});
  refuse(()=>inventoryFor(unknown),"RESTORE_TOC_UNSUPPORTED");
  const knownButUnsupported=fixture({rows:inspectionRows().concat({id:200,kind:"RULE",schema:"public",tag:"candidate_view rule",owner:"postgres",dependencies:[104],catalogClassOid:0,catalogObjectOid:0})});
  refuse(()=>inventoryFor(knownButUnsupported),"RESTORE_MANAGED_TARGET_INSPECTION_UNSUPPORTED");
  for(const dependencies of [[100],[999]]){
    const changed=fixture({rows:inspectionRows().map(row=>row.id===100?{...row,dependencies}:row)});
    refuse(()=>inventoryFor(changed),"RESTORE_TOC_DEPENDENCY_INVALID");
  }
  const duplicate=fixture({rows:inspectionRows().concat({...inspectionRows()[0]})});refuse(()=>inventoryFor(duplicate),"RESTORE_TOC_INVALID");
  refuse(()=>planManagedTargetInspection(context.toc.replace("TOC Entries: 45","TOC Entries: 10001"),bindingFor(context)),"RESTORE_MANAGED_TARGET_LIMIT_EXCEEDED");
  refuse(()=>planManagedTargetInspection(context.toc.replace(";\tdepends on: 6\n",";\tdepends on:"+" 6".repeat(100001)+"\n"),bindingFor(context)),"RESTORE_MANAGED_TARGET_LIMIT_EXCEEDED");
  refuse(()=>planManagedTargetInspection(";"+" ".repeat(32*1024*1024),bindingFor(context)),"RESTORE_MANAGED_TARGET_LIMIT_EXCEEDED");
});

test("inspection does not require the qualifying histories or global set and cannot imply empty state", () => {
  const rows=inspectionRows().filter(row=>![2,3,13,16].includes(row.id)),context=fixture({rows}),{handle,facts}=inspectedFor(context);
  try {
    assert.equal(facts.records.length,rows.length);assert.equal(facts.inspectionOnly,true);assert.equal(facts.baselineQualified,false);
    refuse(()=>planFor(context),"RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED");
    refuse(()=>migrationHistoryCopySelection(handle),"RESTORE_MIGRATION_HISTORY_TOC_REQUIRED");
  } finally{discardCustomTargetInspectionToc(handle);}
});

test("binary inspection cross-checks every native row including app ACLs and full uint32 provenance", () => {
  const context=fixture({rows:inspectionRows()}),{handle,facts}=inspectedFor(context);
  try {
    assert.deepEqual(handle,{version:1,inspectionOnly:true,baselineQualified:false});
    assert.deepEqual(Object.keys(facts),["version","binding","format","encoding","header","tocEndOffset","records","inspectionOnly","baselineQualified"]);
    assert.equal(facts.records.length,context.rows.length);assert.equal(facts.binding.side,"target-inspection");assert.equal(facts.binding.nativeDumpSha256,hash(context.database));
    assert.equal(facts.format.archiveVersion,"1.16-0");assert.equal(facts.encoding,"UTF8");assert.equal(facts.tocEndOffset,context.tocEndOffset);
    assert.equal(read(facts.records.find(row=>row.dumpId===100).tag),"inspection_candidate()");
    assert.equal(read(facts.records.find(row=>row.dumpId===101).owner),"postgres");assert.deepEqual(facts.records.find(row=>row.dumpId===104).dependencies,[100,7,100]);
    assert.equal(facts.records.find(row=>row.dumpId===8).catalogObjectOid,4294967295);
    assert.equal(Object.isFrozen(facts),true);assert.equal(Object.isFrozen(facts.records),true);assert.equal(Object.isFrozen(facts.header),true);
    for(const row of facts.records){assert.equal(Object.isFrozen(row),true);assert.equal(Object.isFrozen(row.dependencies),true);}
    for(const field of ["preserved","selected","historyHandle","nativeOrigin","authenticated","allTargetsEmpty","restoreAccepted"])assert.equal(Object.hasOwn(facts,field),false);
  } finally{discardCustomTargetInspectionToc(handle);}
});

test("no field is normalized, dropped or confused between NULL and empty ByteString", () => {
  const definition="CREATE FUNCTION public.inspection_candidate()\r\nRETURNS void LANGUAGE sql AS $$ SELECT '"+canary+"'; $$;\r\n";
  const acl="REVOKE ALL ON FUNCTION public.inspection_candidate() FROM PUBLIC;\n";
  const context=fixture({rows:inspectionRows(),wire:{100:{definition,dropStatement:"",copyStatement:null,owner:"postgres"},101:{definition:acl,dropStatement:null}}}),before=Buffer.from(context.database),{handle,facts}=inspectedFor(context);
  try{
    const fn=facts.records.find(row=>row.dumpId===100),access=facts.records.find(row=>row.dumpId===101);
    assert.equal(read(fn.definition),definition);assert.equal(fn.definition.includes(13),true);assert.equal(fn.dropStatement.byteLength,0);assert.equal(fn.copyStatement,null);
    assert.equal(read(access.definition),acl);assert.equal(access.dropStatement,null);assert.equal(read(fn.namespace),"public");assert.equal(read(fn.withOids),"false");
    assert.notEqual(fn.definition.buffer,context.database.buffer);assert.equal(fn.definition.buffer.byteLength,context.tocEndOffset);
    for(const row of facts.records)for(const field of ["tag","namespace","definition","dropStatement","copyStatement","tablespace","tableAccessMethod","owner","withOids"])if(row[field]!==null)assert.equal(row[field].buffer,fn.definition.buffer);
    assert.deepEqual(context.database,before);
  }finally{discardCustomTargetInspectionToc(handle);}
  assert.deepEqual(context.database,before);
});

test("every app/list field and dependency occurrence participates in total cross-check", () => {
  for(const wire of [
    {100:{owner:"another_owner"}},{100:{namespace:"auth"}},{100:{tag:"another_function()"}},{100:{catalogClassOid:"1254"}},{100:{catalogObjectOid:"701"}},
    {101:{dependencies:[6,100]}},{104:{dependencies:[100,7]}},{103:{kind:"COMMENT",sectionCode:1}},{3:{dumpId:200}},
  ]){
    const context=fixture({rows:inspectionRows(),wire});refuse(()=>extractCustomTargetInspectionToc(inventoryFor(context),context.database),"RESTORE_CUSTOM_TOC_PLAN_MISMATCH");
  }
  const brokenGraph=fixture({rows:inspectionRows(),wire:{100:{dumpId:200}}});
  refuse(()=>extractCustomTargetInspectionToc(inventoryFor(brokenGraph),brokenGraph.database),"RESTORE_CUSTOM_TOC_INVALID");
  const complete=fixture({rows:inspectionRows()}),incomplete=fixture({rows:nativeRows()});
  refuse(()=>extractCustomTargetInspectionToc(planManagedTargetInspection(incomplete.toc,bindingFor(complete)),complete.database),"RESTORE_CUSTOM_TOC_PLAN_MISMATCH");
});

test("dump binding authenticates no provenance but prevents swapped bytes or dimensions", () => {
  const context=fixture({rows:inspectionRows()}),plan=inventoryFor(context),changed=Buffer.from(context.database);changed[changed.length-1]^=1;
  refuse(()=>extractCustomTargetInspectionToc(plan,changed),"RESTORE_CUSTOM_TOC_BINDING_INVALID");
  const wrong=planManagedTargetInspection(context.toc,bindingFor(context,{nativeDumpBytes:context.database.length+1}));
  refuse(()=>extractCustomTargetInspectionToc(wrong,context.database),"RESTORE_CUSTOM_TOC_BINDING_INVALID");
});

test("nominal extracted maps cannot cross Source/B4/B3/selectors or grant restore/mint authority", () => {
  const context=fixture(),inspection=inspectedFor(context),baseline=targetFor(context),sourceContext=fixture({rows:sourceRows()}),sourceHandle=extractCustomArchiveToc(sourcePlan(sourceContext),sourceContext.database);let traps=0;
  try{
    const proxy=new Proxy(inspection.handle,{get(){traps++;throw Error(canary);}}),revoked=Proxy.revocable({},{});revoked.revoke();
    for(const value of [baseline.handle,sourceHandle,inspection.plan,{},structuredClone(inspection.handle),Object.create(inspection.handle),proxy,revoked.proxy,null,undefined]){
      refuse(()=>customTargetInspectionTocFacts(value),"RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED");assert.equal(discardCustomTargetInspectionToc(value),false);
    }
    refuse(()=>customArchiveTocFacts(inspection.handle),"RESTORE_CUSTOM_TOC_REQUIRED");assert.equal(discardCustomArchiveToc(inspection.handle),false);
    refuse(()=>migrationHistoryCopySelection(inspection.handle),"RESTORE_MIGRATION_HISTORY_TOC_REQUIRED");
    refuse(()=>extractMigrationHistory(inspection.handle,Buffer.from(canary)),"RESTORE_MIGRATION_HISTORY_TOC_REQUIRED");
    refuse(()=>managedRestoreRequirements(inspection.handle),"RESTORE_MANAGED_PLAN_REQUIRED");refuse(()=>managedTargetBaselineRequirements(inspection.handle),"RESTORE_MANAGED_TARGET_BASELINE_REQUIRED");
    refuse(()=>authorizeManagedRestore(inspection.handle,{}),"RESTORE_MANAGED_PLAN_REQUIRED");refuse(()=>claimManagedRestore(inspection.plan,inspection.handle),"RESTORE_MANAGED_AUTHORIZATION_REQUIRED");
    assert.equal(customTargetInspectionTocFacts(inspection.handle),inspection.facts);assert.equal(customArchiveTocFacts(baseline.handle),baseline.facts);assert.equal(traps,0);
  }finally{discardCustomTargetInspectionToc(inspection.handle);discardCustomArchiveToc(baseline.handle);discardCustomArchiveToc(sourceHandle);}
});

test("all input/format/producer and UTF8 invariants are inherited without a permissive mode", () => {
  const context=fixture({rows:inspectionRows()}),plan=inventoryFor(context);let traps=0;
  const proxy=new Proxy(context.database,{get(){traps++;throw Error(canary);}}),shared=new Uint8Array(new SharedArrayBuffer(context.database.length));shared.set(context.database);
  const detached=Uint8Array.from(context.database);structuredClone(detached,{transfer:[detached.buffer]});
  for(const bytes of [null,[],context.database.buffer,new DataView(context.database.buffer),proxy,shared,detached])refuse(()=>extractCustomTargetInspectionToc(plan,bytes),"RESTORE_CUSTOM_TOC_INPUT_INVALID");
  assert.equal(traps,0);
  for(const [offset,value]of [[5,2],[6,15],[7,1],[8,8],[9,4],[10,3],[11,0],[11,2]]){
    const changed=fixture({rows:inspectionRows()});changed.database[offset]=value;refuse(()=>extractCustomTargetInspectionToc(inventoryFor(changed),changed.database),"RESTORE_CUSTOM_TOC_FORMAT_UNSUPPORTED");
  }
  for(const wire of [{100:{sectionCode:3}},{100:{relationKind:114}},{100:{hadDumper:1,customDataState:1}},{100:{definition:Buffer.from([255])}},{1:{definition:"SET client_encoding = 'LATIN1';\n"}}]){
    const changed=fixture({rows:inspectionRows(),wire});refuse(()=>extractCustomTargetInspectionToc(inventoryFor(changed),changed.database),wire[1]?"RESTORE_CUSTOM_TOC_FORMAT_UNSUPPORTED":"RESTORE_CUSTOM_TOC_INVALID");
  }
});

test("inspection store is dedicated and tampering invalidates/wipes all views without touching callers or siblings", () => {
  const context=fixture({rows:inspectionRows()}),before=Buffer.from(context.database),first=inspectedFor(context),second=inspectedFor(context);
  const views=first.facts.records.flatMap(row=>[row.definition,row.tag,row.owner]).filter(value=>value!==null),store=views[0].buffer;
  assert.notEqual(store,second.facts.records[0].definition.buffer);views[0][0]^=1;
  refuse(()=>customTargetInspectionTocFacts(first.handle),"RESTORE_CUSTOM_TOC_BINDING_INVALID");
  assert.equal(new Uint8Array(store).every(byte=>byte===0),true);assert.equal(discardCustomTargetInspectionToc(first.handle),false);
  assert.equal(customTargetInspectionTocFacts(second.handle),second.facts);assert.deepEqual(context.database,before);
  assert.equal(discardCustomTargetInspectionToc(second.handle),true);assert.deepEqual(context.database,before);
});

test("discard is total/idempotent and transferred-out stores cannot be treated as live", () => {
  const context=fixture({rows:inspectionRows()}),first=inspectedFor(context),retained=first.facts.records[0].definition;
  assert.equal(discardCustomTargetInspectionToc(first.handle),true);assert.equal(new Uint8Array(retained.buffer).every(byte=>byte===0),true);assert.equal(discardCustomTargetInspectionToc(first.handle),false);
  refuse(()=>customTargetInspectionTocFacts(first.handle),"RESTORE_CUSTOM_TOC_DISCARDED");
  const second=inspectedFor(context);structuredClone(second.facts.records[0].definition.buffer,{transfer:[second.facts.records[0].definition.buffer]});
  refuse(()=>customTargetInspectionTocFacts(second.handle),"RESTORE_CUSTOM_TOC_DISCARDED");assert.equal(discardCustomTargetInspectionToc(second.handle),false);
  for(const value of [null,{},3,structuredClone(second.handle)])assert.equal(discardCustomTargetInspectionToc(value),false);
});

test("nonhistory DATA stays opaque and namespace observations cannot imply target authorization", () => {
  const context=fixture({rows:inspectionRows().concat({id:200,kind:"TABLE DATA",schema:"public",tag:"not_a_qualified_target_table",owner:"postgres",dependencies:[7],catalogClassOid:0,catalogObjectOid:0}),tail:Buffer.from("ARBITRARY_UNREAD_DATA_"+canary)}),{handle,facts}=inspectedFor(context);
  try{
    assert.equal(facts.records.filter(row=>row.hadDumper).length,6);assert.equal(facts.records.at(-1).kind,"TABLE DATA");assert.equal(facts.baselineQualified,false);
    assert.equal(facts.records[0].definition.buffer.byteLength,context.tocEndOffset);assert.equal(new TextDecoder().decode(new Uint8Array(facts.records[0].definition.buffer)).includes("ARBITRARY_UNREAD_DATA_"),false);
    refuse(()=>planFor(context),"RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED");
  }finally{discardCustomTargetInspectionToc(handle);}
});
