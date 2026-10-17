import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inspect } from "node:util";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { planManagedTargetBaseline, managedTargetBaselineRequirements, planManagedRestore, managedRestoreRequirements, authorizeManagedRestore, claimManagedRestore, managedTocUnsupportedDiagnostic } from "../../scripts/operations/restore-managed-plan.mjs";
import { extractCustomTargetToc, extractCustomArchiveToc, customArchiveTocFacts, discardCustomArchiveToc, CUSTOM_TOC_ERROR_CODES } from "../../scripts/operations/restore-custom-toc.mjs";
import { migrationHistoryCopySelection, extractMigrationHistory, migrationHistoryFacts, discardMigrationHistory } from "../../scripts/operations/restore-migration-history.mjs";

// Artificial RAM only. No connection, profile/archive, child, filesystem port,
// PostgreSQL executable, native receipt, restore or baseline comparator.
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

test("nominal target preparation enumerates every row exactly once and retains all24 classes and extra managed definitions", () => {
  const context=fixture(),plan=planFor(context),requirements=managedTargetBaselineRequirements(plan);
  assert.deepEqual(plan,{});assert.equal(JSON.stringify(plan),"{}");assert.equal(Object.isFrozen(plan),true);
  assert.equal(Object.isFrozen(requirements),true);assert.equal(Object.isFrozen(requirements.binding),true);
  assert.deepEqual(requirements.binding,{side:"target",...bindingFor(context),tocSha256:hash(context.toc)});
  assert.deepEqual(requirements.other.map(row=>row.id),[1,2,3,12,14,15,18]);
  assert.deepEqual(requirements.preserved.map(row=>row.id),context.rows.map(row=>row.id).filter(id=>![1,2,3,12,14,15,18].includes(id)));
  const all=[...requirements.preserved,...requirements.other];assert.equal(new Set(all.map(row=>row.id)).size,context.rows.length);
  for(const row of all){assert.equal(Object.isFrozen(row),true);assert.equal(Object.isFrozen(row.dependencies),true);}
  assert.equal(requirements.preserved.find(row=>row.id===8).catalogObjectOid,4294967295);assert.deepEqual(requirements.preserved.find(row=>row.id===24).dependencies,[4,7,4]);
  assert.throws(()=>{requirements.preserved[0].owner=canary;},TypeError);
  assert.deepEqual(Object.keys(requirements),["binding","preserved","other"]);assert.equal(Object.hasOwn(requirements,"selected"),false);
  const {handle,facts}=targetFor(context);try{assert.equal(new Set(facts.records.map(row=>row.kind)).size,24);assert.equal(facts.binding.side,"target");assert.equal(facts.records.length,38);assert.equal(read(facts.records.find(row=>row.dumpId===24).definition),"-- artificial "+canary+"\n");}finally{discardCustomArchiveToc(handle);}
});

test("target binding is closed and rejects getters, Proxy, clones of authority and origin booleans without invoking traps", () => {
  const context=fixture(),good=bindingFor(context);let traps=0;
  const proxy=new Proxy(good,{ownKeys(){traps++;throw Error(canary);},get(){traps++;throw Error(canary);}}),revoked=Proxy.revocable({},{});revoked.revoke();
  const getter={...good};Object.defineProperty(getter,"projectRef",{enumerable:true,get(){traps++;throw Error(canary);}});
  const symbol={...good,[Symbol("extra")]:true},hidden={...good};Object.defineProperty(hidden,"extra",{value:true});
  for(const value of [null,undefined,[],{},proxy,revoked.proxy,getter,symbol,hidden,{...good,nativeOrigin:true},{...good,allTargetsEmpty:true},{...good,archiveSha256:"a".repeat(64)}])refuse(()=>planManagedTargetBaseline(context.toc,value),"RESTORE_MANAGED_TARGET_BINDING_INVALID");
  for(const [key,value] of [["projectRef","T".repeat(20)],["projectRef","t".repeat(19)],["projectRef","t".repeat(21)],["projectRef","t".repeat(19)+"-"],["projectRef",{}],["databaseName","template1"],["nativeDumpSha256","A".repeat(64)],["nativeDumpSha256","f".repeat(63)],["nativeDumpBytes",0],["nativeDumpBytes",-1],["nativeDumpBytes",1.1],["nativeDumpBytes",Infinity],["nativeDumpBytes","1"],["nativeDumpBytes",64*1024*1024+1]])refuse(()=>planManagedTargetBaseline(context.toc,{...good,[key]:value}),"RESTORE_MANAGED_TARGET_BINDING_INVALID");
  assert.equal(traps,0);
  // Form-valid refs do not select a connection or certify an authorized project.
  for(const projectRef of ["x".repeat(20),"0".repeat(20)])assert.equal(managedTargetBaselineRequirements(planFor(context,{projectRef})).binding.projectRef,projectRef);
});

test("target policy refuses public or app_private DDL, every project customization, other scopes and unsupported extra classes", () => {
  const base=nativeRows(),extra=(kind,schema,tag,owner="postgres")=>({id:100,kind,schema,tag,owner,dependencies:[7],catalogClassOid:0,catalogObjectOid:700});
  for(const row of [extra("SCHEMA","-","app_private"),extra("ACL","-","SCHEMA app_private"),extra("COMMENT","-","SCHEMA app_private"),extra("TABLE","public","profiles"),extra("TABLE DATA","public","profiles"),extra("FUNCTION","app_private","fn()"),extra("DEFAULT ACL","public","DEFAULT PRIVILEGES FOR TABLES"),extra("TABLE","foreign_schema","extra"),extra("RULE","auth","users rule"),extra("SCHEMA","auth","wrong_namespace"),extra("ENCODING","auth","ENCODING"),extra("DATABASE","auth","postgres"),...sourceRows().filter(row=>[104,105,106,107].includes(row.id)).map(row=>({...row,dependencies:[7]}))]) {
    const context=fixture({rows:base.concat(row)});refuse(()=>planFor(context),"RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED");
  }
  const unknown=fixture({rows:base.concat(extra("PRIVATE_UNKNOWN","auth",canary))});refuse(()=>planFor(unknown),"RESTORE_TOC_UNSUPPORTED");
  const extraManaged=fixture({rows:base.concat(extra("FUNCTION","auth","new_platform_function()","supabase_auth_admin"))}),requirements=managedTargetBaselineRequirements(planFor(extraManaged));
  assert.equal(requirements.preserved.at(-1).tag,"new_platform_function()"); // complete target set, not filtered by source keys
});

test("target scope refusals retain only nominal enum diagnostics without changing rejected classes", () => {
  const extra = (kind, schema, tag) => ({ id: 100, kind, schema, tag, owner: canary.toLowerCase(), dependencies: [7], catalogClassOid: 0, catalogObjectOid: 700 });
  const rows = [
    [extra("DEFAULT ACL", "public", "DEFAULT PRIVILEGES FOR TABLES"), "DEFAULT ACL", "app"],
    [extra("TABLE", "public", canary), "TABLE", "app"],
    [extra("FUNCTION", "app_private", "fn_" + canary + "()"), "FUNCTION", "app"],
    [extra("SCHEMA", "-", "app_private"), "SCHEMA", "global"],
    [extra("RULE", "auth", "users " + canary), "RULE", "managed"],
    [extra("TABLE", "foreign_schema", canary), "TABLE", "other"],
    [extra("DATABASE", "auth", "postgres"), "DATABASE", "managed"],
    [extra("DATABASE", "-", canary), "DATABASE", "global"],
    [{ ...nativeRows().find(row => row.id === 26), id: 100, tag: "users second_brain_identity_created", owner: canary.toLowerCase() }, "TRIGGER", "managed"],
  ];
  for (const [row, knownKind, scopeCategory] of rows) {
    const context = fixture({ rows: nativeRows().concat(row) });
    assert.throws(() => planFor(context), error => {
      assert.equal(error instanceof BackupError, true); assert.equal(error.code, "RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED");
      const diagnostic = managedTocUnsupportedDiagnostic(error);
      assert.deepEqual(diagnostic, { reason: "scope_classification", knownKind, scopeCategory, tailShape: "valid" });
      assert.deepEqual(Object.keys(diagnostic), ["reason", "knownKind", "scopeCategory", "tailShape"]); assert.equal(Object.isFrozen(diagnostic), true);
      for (const text of [JSON.stringify(diagnostic), inspect(diagnostic), JSON.stringify(error), inspect(error)]) for (const marker of [canary, canary.toLowerCase()]) assert.equal(text.includes(marker), false);
      assert.throws(() => { diagnostic.scopeCategory = canary; }, TypeError);
      return true;
    });
  }
  // An unknown descriptor is still rejected by the original verbose parser,
  // using its original error code and fixed nominal unknown-class diagnostic.
  const unknown = fixture({ rows: nativeRows().concat(extra("PRIVATE_UNKNOWN", "auth", canary)) });
  assert.throws(() => planFor(unknown), error => {
    assert.equal(error.code, "RESTORE_TOC_UNSUPPORTED");
    assert.deepEqual(managedTocUnsupportedDiagnostic(error), { reason: "unknown_descriptor", knownKind: null, scopeCategory: "unparsed", tailShape: "not_parsed" });
    return true;
  });
});

test("target diagnostic getter cannot infer nominal provenance from forged fields, clones or getters", () => {
  let traps = 0;
  const forged = { code: "RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED", reason: "scope_classification", knownKind: "TABLE", scopeCategory: "app", tailShape: "valid" };
  const getter = {}; Object.defineProperty(getter, "code", { get() { traps++; throw Error(canary); } });
  const proxy = new Proxy(forged, { get() { traps++; throw Error(canary); }, ownKeys() { traps++; throw Error(canary); } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  for (const value of [forged, new BackupError(forged.code), getter, proxy, revoked.proxy, null, undefined, 3]) assert.equal(managedTocUnsupportedDiagnostic(value), null);
  const context = fixture({ rows: nativeRows().concat({ id: 100, kind: "DEFAULT ACL", schema: "public", tag: "DEFAULT PRIVILEGES FOR TABLES", owner: "postgres", dependencies: [7], catalogClassOid: 0, catalogObjectOid: 700 }) });
  try { planFor(context); assert.fail("must refuse"); } catch (error) {
    const first = managedTocUnsupportedDiagnostic(error), second = managedTocUnsupportedDiagnostic(error);
    assert.deepEqual(second, first); assert.notEqual(second, first);
    assert.equal(managedTocUnsupportedDiagnostic(structuredClone(error)), null);
    assert.equal(managedTocUnsupportedDiagnostic({ ...error }), null);
  }
  assert.equal(traps, 0);
});

test("both migration histories and three fixed global entries are mandatory and cannot be duplicated or reclassified", () => {
  const base=nativeRows();
  for(const id of [1,2,3,13,16]){const context=fixture({rows:base.filter(row=>row.id!==id)});refuse(()=>planFor(context),"RESTORE_MANAGED_TARGET_BASELINE_INVALID");}
  for(const id of [1,2,3,13,16]){const original=base.find(row=>row.id===id),context=fixture({rows:base.concat({...original,id:100})});refuse(()=>planFor(context),"RESTORE_MANAGED_TARGET_BASELINE_INVALID");}
  const context=fixture({rows:base.map(row=>row.id===13?{...row,tag:"another_table"}:row)});refuse(()=>planFor(context),"RESTORE_MANAGED_TARGET_BASELINE_INVALID");
});

test("database metadata remains complete and its original owner/dependency rules do not grant replay authority", () => {
  const base=nativeRows();
  for(const rows of [base.filter(row=>row.id!==19).map(row=>[21,28].includes(row.id)?{...row,dependencies:[]}:row),base.concat({...base.find(row=>row.id===19),id:100}),base.map(row=>row.id===20?{...row,owner:"another_owner"}:row),base.map(row=>row.id===20?{...row,dependencies:[19]}:row),base.map(row=>row.id===21?{...row,dependencies:[]}:row),base.map(row=>row.id===21?{...row,dependencies:[19,19]}:row)])refuse(()=>planFor(fixture({rows})),"RESTORE_MANAGED_TARGET_BASELINE_INVALID");
  const details=managedTargetBaselineRequirements(planFor(fixture()));assert.equal(details.preserved.some(row=>row.description==="DATABASE"),true);assert.equal(Object.hasOwn(details,"segments"),false);
});

test("original verbose parser rejects missing/self dependencies and keeps duplicate order for both target sets", () => {
  for(const dependencies of [[24],[999]]){const context=fixture({rows:nativeRows().map(row=>row.id===24?{...row,dependencies}:row)});refuse(()=>planFor(context),"RESTORE_TOC_DEPENDENCY_INVALID");}
  const context=fixture({rows:nativeRows().map(row=>row.id===12?{...row,dependencies:[7,4,7]}:row)}),requirements=managedTargetBaselineRequirements(planFor(context));
  assert.deepEqual(requirements.other.find(row=>row.id===12).dependencies,[7,4,7]);
  const {handle,facts}=targetFor(context);try{assert.deepEqual(facts.records.find(row=>row.dumpId===12).dependencies,[7,4,7]);assert.deepEqual(facts.records.find(row=>row.dumpId===24).dependencies,[4,7,4]);}finally{discardCustomArchiveToc(handle);}
});

test("target preparation and binary extraction have nominal boundaries isolated from source plans, authorizations and JSON", () => {
  const context=fixture(),target=planFor(context),source=fixture({rows:sourceRows()}),sourceHandle=sourcePlan(source);let traps=0;
  const proxy=new Proxy(target,{get(){traps++;throw Error(canary);},ownKeys(){traps++;throw Error(canary);}}),revoked=Proxy.revocable({},{});revoked.revoke();
  for(const value of [null,undefined,{},structuredClone(target),Object.create(target),proxy,revoked.proxy,sourceHandle]) {
    refuse(()=>managedTargetBaselineRequirements(value),"RESTORE_MANAGED_TARGET_BASELINE_REQUIRED");refuse(()=>extractCustomTargetToc(value,context.database),"RESTORE_CUSTOM_TOC_TARGET_REQUIRED");
  }
  refuse(()=>managedRestoreRequirements(target),"RESTORE_MANAGED_PLAN_REQUIRED");refuse(()=>authorizeManagedRestore(target,{}),"RESTORE_MANAGED_PLAN_REQUIRED");
  refuse(()=>claimManagedRestore(target,{}),"RESTORE_MANAGED_AUTHORIZATION_REQUIRED");refuse(()=>claimManagedRestore(sourceHandle,target),"RESTORE_MANAGED_AUTHORIZATION_REQUIRED");
  refuse(()=>extractCustomArchiveToc(target,context.database),"RESTORE_CUSTOM_TOC_PLAN_REQUIRED");
  refuse(()=>planManagedRestore(context.toc,{archiveSha256:"a".repeat(64),databaseSha256:hash(context.database),databaseBytes:context.database.length}),"RESTORE_MANAGED_CUSTOM_INVALID");
  refuse(()=>planFor(source),"RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED");
  const original=extractCustomArchiveToc(sourceHandle,source.database);try{assert.equal(customArchiveTocFacts(original).binding.side,"archive");assert.equal(customArchiveTocFacts(original).records.length,source.rows.length);}finally{discardCustomArchiveToc(original);}
  assert.equal(traps,0);assert.equal(CUSTOM_TOC_ERROR_CODES.includes("RESTORE_CUSTOM_TOC_TARGET_REQUIRED"),true);
});

test("target binary cross-check covers ALL original metadata including non-history data and every uint32 OID", () => {
  for(const wire of [{7:{owner:"another_owner"}},{8:{catalogObjectOid:"4294967294"}},{7:{catalogClassOid:"1258"}},{24:{dependencies:[4,4,7]}},{12:{tag:"identities"}},{14:{namespace:"auth"}},{29:{kind:"TABLE",relationKind:114}},{3:{dumpId:99}}]) {
    const context=fixture({wire});refuse(()=>extractCustomTargetToc(planFor(context),context.database),"RESTORE_CUSTOM_TOC_PLAN_MISMATCH");
  }
  const context=fixture(),different=Buffer.from(context.database);different[different.length-1]^=1;
  refuse(()=>extractCustomTargetToc(planFor(context),different),"RESTORE_CUSTOM_TOC_BINDING_INVALID");
  refuse(()=>extractCustomTargetToc(planFor(context,{nativeDumpBytes:context.database.length+1}),context.database),"RESTORE_CUSTOM_TOC_BINDING_INVALID");
  const extra=fixture({rows:nativeRows().concat({id:100,kind:"FUNCTION",schema:"auth",tag:"extra()",owner:"supabase_auth_admin",dependencies:[4],catalogClassOid:1255,catalogObjectOid:700})});
  const missingPlan=planFor(extra,{},context.toc);refuse(()=>extractCustomTargetToc(missingPlan,extra.database),"RESTORE_CUSTOM_TOC_PLAN_MISMATCH");
});

test("target entry retains the same exact format, producer coherence, UTF8, byte-input and integrity refusals", () => {
  for(const [offset,value] of [[5,2],[6,15],[7,1],[8,8],[9,4],[10,3],[11,0],[11,2]]){const context=fixture();context.database[offset]=value;refuse(()=>extractCustomTargetToc(planFor(context),context.database),"RESTORE_CUSTOM_TOC_FORMAT_UNSUPPORTED");}
  for(const wire of [{7:{sectionCode:4}},{7:{relationKind:109}},{7:{hadDumper:1,customDataState:1}},{12:{hadDumper:0,customDataState:3}},{24:{definition:Buffer.from([255])}},{1:{definition:"SET client_encoding = 'LATIN1';\n"}}]){const context=fixture({wire});refuse(()=>extractCustomTargetToc(planFor(context),context.database),wire[1]?"RESTORE_CUSTOM_TOC_FORMAT_UNSUPPORTED":"RESTORE_CUSTOM_TOC_INVALID");}
  const context=fixture(),plan=planFor(context);let traps=0;const fake={get byteLength(){traps++;throw Error(canary);}},proxy=new Proxy(context.database,{get(){traps++;throw Error(canary);}}),shared=new Uint8Array(new SharedArrayBuffer(context.database.length));shared.set(context.database);
  const detached=Uint8Array.from(context.database);structuredClone(detached,{transfer:[detached.buffer]});
  for(const bytes of [null,[],context.database.buffer,new DataView(context.database.buffer),fake,proxy,shared,detached])refuse(()=>extractCustomTargetToc(plan,bytes),"RESTORE_CUSTOM_TOC_INPUT_INVALID");assert.equal(traps,0);
});

test("target getters invalidate changed or transferred owned bytes and total discard wipes only the dedicated TOC store", () => {
  const context=fixture(),before=Buffer.from(context.database),first=targetFor(context),bytes=first.facts.records[0].definition;
  assert.notEqual(bytes.buffer,context.database.buffer);assert.equal(bytes.buffer.byteLength,context.tocEndOffset);
  bytes[0]^=1;refuse(()=>customArchiveTocFacts(first.handle),"RESTORE_CUSTOM_TOC_BINDING_INVALID");assert.equal(new Uint8Array(bytes.buffer).every(byte=>byte===0),true);assert.equal(discardCustomArchiveToc(first.handle),false);
  const second=targetFor(context),retained=second.facts.records[0].definition;assert.equal(discardCustomArchiveToc(second.handle),true);assert.equal(new Uint8Array(retained.buffer).every(byte=>byte===0),true);assert.equal(discardCustomArchiveToc(second.handle),false);refuse(()=>customArchiveTocFacts(second.handle),"RESTORE_CUSTOM_TOC_DISCARDED");
  const third=targetFor(context);structuredClone(third.facts.records[0].definition.buffer,{transfer:[third.facts.records[0].definition.buffer]});refuse(()=>customArchiveTocFacts(third.handle),"RESTORE_CUSTOM_TOC_DISCARDED");
  assert.deepEqual(context.database,before);assert.equal(discardCustomArchiveToc({}),false);
});

test("non-history DATA blocks remain opaque and never imply emptiness or provide an import selection", () => {
  const context=fixture({tail:Buffer.from("ARBITRARY_UNREAD_DATA_"+canary)}),{handle,facts}=targetFor(context);
  try{assert.equal(facts.records.filter(row=>row.hadDumper).length,5);assert.deepEqual(facts.preserved.filter(row=>row.kind==="TABLE DATA").map(row=>row.dumpId),[13,16]);assert.equal(Object.hasOwn(facts,"allTargetsEmpty"),false);assert.equal(Object.hasOwn(facts,"authenticated"),false);assert.equal(Object.hasOwn(facts,"selected"),false);assert.equal(facts.binding.nativeDumpSha256,hash(context.database));assert.equal(Object.hasOwn(facts.binding,"archiveSha256"),false);}finally{discardCustomArchiveToc(handle);}
});

test("the nominal B3 COPY interface can consume the target handle without losing its target-side binding", () => {
  const context=fixture(),{handle}=targetFor(context);let history;
  try {
    assert.deepEqual(migrationHistoryCopySelection(handle),[13,16]);
    const stdout=Buffer.from("--\n-- PostgreSQL database dump\n--\n\n\\restrict SCBaselineV1\n\n-- Dumped from database version 17.6\n-- Dumped by pg_dump version 18.4\n\nSET statement_timeout = 0;\nSET lock_timeout = 0;\nSET idle_in_transaction_session_timeout = 0;\nSET transaction_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSELECT pg_catalog.set_config('search_path', '', false);\nSET check_function_bodies = false;\nSET xmloption = content;\nSET client_min_messages = warning;\nSET row_security = off;\n\n" +
      "--\n-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin\n--\n\n"+AUTH_COPY+"20240101\n\\.\n\n\n" +
      "--\n-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin\n--\n\n"+STORAGE_COPY+"0\tinitial\t"+"a".repeat(40)+"\t\\N\n\\.\n\n\n" +
      "--\n-- PostgreSQL database dump complete\n--\n\n\\unrestrict SCBaselineV1\n\n");
    history=extractMigrationHistory(handle,stdout);const facts=migrationHistoryFacts(history);
    assert.equal(facts.binding.side,"target");assert.equal(facts.binding.nativeDumpSha256,hash(context.database));assert.deepEqual(facts.history.auth,[{version:"20240101"}]);assert.deepEqual(facts.history.storage,[{id:0,name:"initial",hash:"a".repeat(40),executed_at:null}]);
    discardCustomArchiveToc(handle);refuse(()=>migrationHistoryFacts(history),"RESTORE_MIGRATION_HISTORY_BINDING_INVALID");
  } finally { if(history)discardMigrationHistory(history);discardCustomArchiveToc(handle); }
});

test("target list caps refuse entries and cumulative edges before expanding attacker-controlled vectors", () => {
  const context=fixture();refuse(()=>planFor(context,{},context.toc.replace("TOC Entries: 38","TOC Entries: 10001")),"RESTORE_MANAGED_TARGET_LIMIT_EXCEEDED");
  const text=context.toc.replace(";\tdepends on: 4\n",";\tdepends on:"+" 4".repeat(100001)+"\n");refuse(()=>planFor(context,{},text),"RESTORE_MANAGED_TARGET_LIMIT_EXCEEDED");
  const large=";"+" ".repeat(32*1024*1024);refuse(()=>planFor(context,{},large),"RESTORE_MANAGED_TARGET_LIMIT_EXCEEDED");
});
