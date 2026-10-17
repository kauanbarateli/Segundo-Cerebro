import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { resolve, win32 } from "node:path";
import { inspect } from "node:util";
import { planManagedRestore, planManagedTargetBaseline, planManagedTargetInspection } from "../../scripts/operations/restore-managed-plan.mjs";
import { extractCustomArchiveToc, extractCustomTargetToc, extractCustomTargetInspectionToc, customTargetInspectionTocFacts, discardCustomArchiveToc, discardCustomTargetInspectionToc } from "../../scripts/operations/restore-custom-toc.mjs";
import { migrationHistoryCopySelection, extractMigrationHistory, migrationHistoryFacts, discardMigrationHistory, inspectionMigrationHistoryCopySelection, extractInspectionMigrationHistory, inspectionMigrationHistoryFacts, discardInspectionMigrationHistory, migrationHistoryDiagnostic, MIGRATION_HISTORY_ERROR_CODES, MIGRATION_HISTORY_DIAGNOSTIC_RULES } from "../../scripts/operations/restore-migration-history.mjs";
import { readNativeMigrationHistory, nativeMigrationHistoryFacts, discardNativeMigrationHistory, readNativeInspectionMigrationHistory, nativeInspectionMigrationHistoryFacts, discardNativeInspectionMigrationHistory, nativeMigrationHistoryDiagnostic, NATIVE_HISTORY_ERROR_CODES } from "../../scripts/operations/restore-migration-history-native.mjs";
import { NATIVE_BINARY_OUTPUT_HELPER_SHA256 } from "../../scripts/operations/restore-native-binary-output.mjs";

// All byte vectors, children, lists and binary pipe methods below are RAM
// fixtures. No fs/process/browser, original profile/archive, PG or IO service.
const CANARY="PRIVATE_INSPECTION_HISTORY_CANARY", digest=value=>createHash("sha256").update(value).digest("hex");
const AUTH="COPY auth.schema_migrations (version) FROM stdin;\n", STORAGE="COPY storage.migrations (id, name, hash, executed_at) FROM stdin;\n";
const HEADER=Buffer.from("5047444d5001100004080101"+"0017000000002a000000000f00000000100000000009000000007e0000000000000000"+"0008000000706f737467726573000400000031372e36000400000031382e34","hex");
const integer=value=>{const bytes=Buffer.alloc(5);bytes[0]=value<0?1:0;bytes.writeUInt32LE(Math.abs(value),1);return bytes;};
const text=value=>value===null?integer(-1):Buffer.concat([integer(Buffer.byteLength(value)),Buffer.from(value)]);
const ROWS=[
  [1,"ENCODING","-","ENCODING","",[]],[2,"STDSTRINGS","-","STDSTRINGS","",[]],[3,"SEARCHPATH","-","SEARCHPATH","",[]],
  [4,"SCHEMA","-","auth","supabase_auth_admin",[]],[5,"SCHEMA","-","storage","supabase_storage_admin",[]],[6,"SCHEMA","-","app_private","postgres",[]],
  [7,"TABLE","auth","users","supabase_auth_admin",[4]],[8,"TABLE","storage","objects","supabase_storage_admin",[5]],[9,"TABLE","storage","buckets","supabase_storage_admin",[5]],
  [10,"TABLE","auth","schema_migrations","supabase_auth_admin",[4]],[11,"TABLE","storage","migrations","supabase_storage_admin",[5]],
  [12,"TABLE DATA","auth","users","supabase_auth_admin",[7]],[13,"TABLE DATA","auth","schema_migrations","supabase_auth_admin",[10]],[14,"TABLE DATA","storage","migrations","supabase_storage_admin",[11]],
  [15,"TRIGGER","auth","users second_brain_identity_created","postgres",[7]],[16,"TRIGGER","auth","users second_brain_admin_creation_final","postgres",[7]],
  [17,"POLICY","storage","objects second_brain_private_objects","supabase_storage_admin",[8]],[18,"POLICY","storage","buckets second_brain_private_buckets","supabase_storage_admin",[9]],
];
function context(options={}) {
  const side=options.side??"inspection",entries=(side==="archive"?ROWS:ROWS.filter(([id])=>id!==6&&id<15)).map(([id,kind,schema,tag,owner,dependencies])=>({id,kind,schema,tag,owner,dependencies}));
  if(side==="inspection")entries.push({id:20,kind:"SCHEMA",schema:"-",tag:"public",owner:"postgres",dependencies:[]},{id:21,kind:"FUNCTION",schema:"public",tag:"inspection_canary(integer, text)",owner:"postgres",dependencies:[20]},{id:22,kind:"ACL",schema:"public",tag:"FUNCTION inspection_canary(integer, text)",owner:"postgres",dependencies:[21]},{id:23,kind:"DEFAULT ACL",schema:"public",tag:"DEFAULT PRIVILEGES FOR FUNCTIONS",owner:"postgres",dependencies:[20]});
  if(options.missing)entries.splice(entries.findIndex(row=>row.id===13),1);
  if(options.duplicate)entries.push({id:30,kind:"TABLE DATA",schema:"auth",tag:"schema_migrations",owner:"supabase_auth_admin",dependencies:[10]});
  if(options.reverse){const a=entries.findIndex(row=>row.id===13),b=entries.findIndex(row=>row.id===14);[entries[a],entries[b]]=[entries[b],entries[a]];}
  for(const row of entries)Object.assign(row,options.rows?.[row.id]);
  const toc=`;     TOC Entries: ${entries.length}\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n`+entries.map(row=>`${row.id}; 0 0 ${row.kind} ${row.schema} ${row.tag} ${row.owner}\n`+(row.dependencies.length?";\tdepends on: "+row.dependencies.join(" ")+"\n":"")).join("");
  const parts=[HEADER,integer(entries.length)];
  for(const row of entries){
    const data=row.kind==="TABLE DATA",definition=row.id===1?"SET client_encoding = 'UTF8';\n":row.id===2?"SET standard_conforming_strings = 'on';\n":row.id===3?"SELECT pg_catalog.set_config('search_path', '', false);\n":data?null:"-- "+CANARY+"\n";
    const fields={definition,copyStatement:row.id===13||row.id===30?AUTH:row.id===14?STORAGE:data?"PRIVATE_OPAQUE_COPY_NOT_SQL":null,tablespace:null,tableAccessMethod:row.kind==="TABLE"?"heap":null,...options.wire?.[row.id]};
    parts.push(integer(row.id),integer(data?1:0),text("0"),text("0"),text(row.tag),text(row.kind),integer(data?3:["TRIGGER","POLICY","DEFAULT ACL"].includes(row.kind)?4:row.kind==="ACL"?1:2),text(fields.definition),text(null),text(fields.copyStatement),text(row.schema==="-"?null:row.schema),text(fields.tablespace),text(fields.tableAccessMethod),integer(row.kind==="TABLE"?114:0),text(row.owner),text("false"),...row.dependencies.map(value=>text(String(value))),integer(-1),Buffer.from([data?1:3]),Buffer.alloc(8));
  }
  const database=Buffer.concat([...parts,Buffer.from("UNSELECTED_ARTIFICIAL_TAIL_"+CANARY)]),binding={projectRef:"t".repeat(20),databaseName:"postgres",nativeDumpSha256:digest(database),nativeDumpBytes:database.length};
  const plan=side==="inspection"?planManagedTargetInspection(toc,binding):side==="target"?planManagedTargetBaseline(toc,binding):planManagedRestore(toc,{archiveSha256:"a".repeat(64),databaseSha256:digest(database),databaseBytes:database.length});
  const tocHandle=side==="inspection"?extractCustomTargetInspectionToc(plan,database):side==="target"?extractCustomTargetToc(plan,database):extractCustomArchiveToc(plan,database);
  const blocks={auth:"--\n-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin\n--\n\n"+AUTH+"20240101\n\\.\n\n\n",storage:"--\n-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin\n--\n\n"+STORAGE+"0\tinitial\t"+"a".repeat(40)+"\t\\N\n\\.\n\n\n"};
  const output=Buffer.from("--\n-- PostgreSQL database dump\n--\n\n\\restrict SCBaselineV1\n\n-- Dumped from database version 17.6\n-- Dumped by pg_dump version 18.4\n\nSET statement_timeout = 0;\nSET lock_timeout = 0;\nSET idle_in_transaction_session_timeout = 0;\nSET transaction_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSELECT pg_catalog.set_config('search_path', '', false);\nSET check_function_bodies = false;\nSET xmloption = content;\nSET client_min_messages = warning;\nSET row_security = off;\n\n"+(options.reverse?blocks.storage+blocks.auth:blocks.auth+blocks.storage)+"--\n-- PostgreSQL database dump complete\n--\n\n\\unrestrict SCBaselineV1\n\n");
  const nativeOptions={tocHandle,database,nativeTocText:toc,pgRestore:resolve("RAM-inspection-history/pg_restore.exe"),environment:{SystemRoot:resolve("RAM/Windows")},listOptions:{privateRoot:resolve("RAM-inspection-history/owned"),powerShellExecutable:resolve("RAM/Windows/powershell.exe"),systemRoot:resolve("RAM/Windows"),forbiddenRoots:[],syncRoots:[]}};
  return {side,tocHandle,plan,database,toc,output,options:nativeOptions,discard(){if(side==="inspection")discardCustomTargetInspectionToc(tocHandle);else discardCustomArchiveToc(tocHandle);database.fill(0);output.fill(0);}};
}
function budget(){let expired=false,closeCalls=0,rejectDeadline;const timeout=new Promise((_yes,no)=>{rejectDeadline=no;});timeout.catch(()=>{});const scope={check(){if(expired)throw Error(CANARY);},remaining(){this.check();return 45000;},race(value){return Promise.race([value,timeout]);},close(){closeCalls++;}};return {scope,expire(){expired=true;rejectDeadline(Error(CANARY));},get closeCalls(){return closeCalls;}};}
function scenario(ctx,controls={}){
  const clock=budget(),calls=[],children=[],chunks=[];let borrowed,callback,listText,removals=0;
  const ports={
    async createLists(options,remaining){calls.push("factory");assert.equal(remaining,45000);assert.equal(options.privateRoot,ctx.options.listOptions.privateRoot);if(controls.factory)return controls.factory();return {
      async materializeList(value){calls.push("list");listText=value;return {path:resolve("RAM-inspection-history/owned/list.toc"),sha256:digest(value),private:true};},
      async removeLists(){calls.push("cleanup");removals++;await controls.cleanup?.();},
    };},
    spawn(executable,args,settings){calls.push("spawn");assert.equal(executable,ctx.options.pgRestore);assert.deepEqual(args,["--data-only","--use-list="+resolve("RAM-inspection-history/owned/list.toc"),"--file="+(controls.pipePath??"-"),"--restrict-key=SCBaselineV1"]);assert.deepEqual(settings,{env:ctx.options.environment,stdio:["pipe","pipe","pipe"],shell:false,windowsHide:true});
      const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),stdin:new EventEmitter(),kill(){calls.push("kill");return true;},unref(){}});child.stdin.destroy=()=>{};
      child.stdin.end=(bytes,settle)=>{borrowed=bytes;callback=settle;queueMicrotask(()=>{
        if(!controls.noSpawn)child.emit("spawn");const output=Buffer.from(controls.output??ctx.output);chunks.push(output);if(controls.noOutEnd)child.stdout.write(output);else child.stdout.end(output);if(!controls.noErrEnd)child.stderr.end();
        const mode=controls.input??"finish";
        if(mode==="finish"){child.stdin.emit("finish");settle();}else if(mode==="epipe"){const error=Object.assign(Error(CANARY),{code:"EPIPE"});child.stdin.emit("error",error);settle(error);}else if(mode==="other"){const error=Object.assign(Error(CANARY),{code:"ECONNRESET"});child.stdin.emit("error",error);settle(error);}else if(mode==="event-only")child.stdin.emit("error",Object.assign(Error(CANARY),{code:"EPIPE"}));else if(mode==="callback-only")settle(Object.assign(Error(CANARY),{code:"EPIPE"}));
        if(controls.closeWithoutEof)child.stdout.emit("close");const code=controls.closeCode??0;if(!controls.noExit)child.emit("exit",code);if(!controls.noClose)child.emit("close",code);if(controls.expire)setImmediate(()=>clock.expire());
      });};children.push(child);return child;
    },
  };
  return {ports,clock,calls,children,chunks,get borrowed(){return borrowed;},get callback(){return callback;},get listText(){return listText;},get removals(){return removals;}};
}
function pipeScenario(ctx,controls={}){
  const pipePath="\\\\.\\pipe\\sc-binary-v1-"+"b".repeat(64),s=scenario(ctx,{...controls,pipePath,output:controls.pgOutput??Buffer.alloc(0)}),events=[],lease=Object.freeze({}),receipt=Object.freeze({});let failed=false,discarded=false,ownedCopy;
  const check=()=>{if(failed||discarded)throw Error(CANARY);};
  s.ports.binaryOutput={
    start(options,scope){events.push("start");assert.equal(scope,s.clock.scope);assert.equal(options.helperSha256,NATIVE_BINARY_OUTPUT_HELPER_SHA256);assert.deepEqual(options.environment,{SystemRoot:ctx.options.listOptions.systemRoot,PATH:win32.join(ctx.options.listOptions.systemRoot,"System32")});return lease;},
    async ready(handle){assert.equal(handle,lease);events.push("ready");if(controls.readyFails)throw Error(CANARY);},path(handle){assert.equal(handle,lease);return controls.badPath?"/unowned":pipePath;},check(handle){assert.equal(handle,lease);check();},
    async finish(handle){assert.equal(handle,lease);if(controls.helperFails)throw Error(CANARY);if(controls.helperPending)return new Promise(()=>{});return receipt;},facts(handle){assert.equal(handle,receipt);check();return Object.freeze({transportMode:"native",helperIntegrity:true});},
    copy(handle){assert.equal(handle,receipt);check();ownedCopy=new Uint8Array(ctx.output);return ownedCopy;},discard(handle){assert.equal(handle,lease);events.push("discard");discarded=true;ownedCopy?.fill(0);},
  };
  return {s,events,fail(){failed=true;},get ownedCopy(){return ownedCopy;}};
}
const pure=suffix=>"RESTORE_MIGRATION_HISTORY_"+suffix,native=suffix=>"RESTORE_MIGRATION_HISTORY_NATIVE_"+suffix;
async function refusal(operation,suffix){let failure;await assert.rejects(operation,error=>{failure=error;assert.equal(error.code,native(suffix));assert.equal(error.message,native(suffix));assert.equal(Object.hasOwn(error,"cause"),false);for(const value of[JSON.stringify(error),inspect(error),error.stack])assert.equal(value.includes(CANARY),false);return true;});return failure;}
const read=(ctx,s)=>readNativeInspectionMigrationHistory(ctx.options,s.clock.scope,s.ports);
const close=(ctx,receipt)=>{if(receipt)discardNativeInspectionMigrationHistory(receipt);ctx.discard();};

test("inspection selection scans all records and selects only the two exact original identities",()=>{
  const ctx=context({rows:{12:{tag:"x".repeat(1500)}}});let handle;
  try{assert.equal(Object.hasOwn(customTargetInspectionTocFacts(ctx.tocHandle),"preserved"),false);assert.deepEqual(inspectionMigrationHistoryCopySelection(ctx.tocHandle),[13,14]);handle=extractInspectionMigrationHistory(ctx.tocHandle,ctx.output);const facts=inspectionMigrationHistoryFacts(handle);assert.deepEqual(handle,{inspectionOnly:true,baselineQualified:false});assert.equal(facts.binding.side,"target-inspection");assert.equal(facts.inspectionOnly,true);assert.equal(facts.baselineQualified,false);assert.deepEqual(facts.history.auth,[{version:"20240101"}]);assert.equal(facts.history.storage[0].id,0);assert.deepEqual(facts.blocks.map(row=>row.dumpId),[13,14]);assert.equal(facts.blocks.every(row=>customTargetInspectionTocFacts(ctx.tocHandle).records[row.ordinal]===row.sourceRecord),true);assert.equal(MIGRATION_HISTORY_ERROR_CODES.length,9);assert.equal(Object.keys(MIGRATION_HISTORY_DIAGNOSTIC_RULES).length,9);assert.equal(Object.values(MIGRATION_HISTORY_DIAGNOSTIC_RULES).flat().length,52);}
  finally{if(handle)discardInspectionMigrationHistory(handle);ctx.discard();}
});
test("physical history ordinal order is retained without sorting by ID or caller selection",()=>{
  const ctx=context({reverse:true});let handle;try{assert.deepEqual(inspectionMigrationHistoryCopySelection(ctx.tocHandle),[14,13]);handle=extractInspectionMigrationHistory(ctx.tocHandle,ctx.output);assert.deepEqual(inspectionMigrationHistoryFacts(handle).blocks.map(row=>row.dumpId),[14,13]);}finally{close(ctx);if(handle)discardInspectionMigrationHistory(handle);}
});
test("inspection keeps an extra legitimate storage migration row instead of normalizing the history",()=>{
  const ctx=context();let handle;
  try{const output=Buffer.from(ctx.output.toString().replace("0\tinitial\t"+"a".repeat(40)+"\t\\N\n","0\tinitial\t"+"a".repeat(40)+"\t\\N\n1\tsecond\t"+"b".repeat(40)+"\t\\N\n"));handle=extractInspectionMigrationHistory(ctx.tocHandle,output);const history=inspectionMigrationHistoryFacts(handle).history;assert.equal(history.auth.length,1);assert.equal(history.storage.length,2);assert.deepEqual(history.storage.map(row=>row.id),[0,1]);assert.equal(history.storage[1].hash,"b".repeat(40));}
  finally{if(handle)discardInspectionMigrationHistory(handle);ctx.discard();}
});
test("missing and duplicate exact history identities refuse even while unrelated DATA remains opaque",()=>{
  for(const options of[{missing:true},{duplicate:true},{rows:{13:{schema:"storage",tag:"migrations",owner:"supabase_storage_admin"}}}]){const ctx=context(options);try{assert.throws(()=>inspectionMigrationHistoryCopySelection(ctx.tocHandle),{code:pure("FORMAT_UNSUPPORTED")});assert.throws(()=>extractInspectionMigrationHistory(ctx.tocHandle,ctx.output),{code:pure("FORMAT_UNSUPPORTED")});}finally{ctx.discard();}}
});
test("original COPY profile/columns and selected data attributes are still mandatory",()=>{
  for(const wire of[{13:{copyStatement:"COPY auth.schema_migrations (foreign_column) FROM stdin;\n"}},{13:{copyStatement:"COPY auth.users (version) FROM stdin;\n"}},{13:{definition:"PRIVATE_NONEMPTY_DEFINITION"}},{14:{tablespace:"PRIVATE_TABLESPACE"}},{14:{tableAccessMethod:"heap"}},{2:{definition:"SET standard_conforming_strings = 'maybe';\n"}}]){const ctx=context({wire});try{assert.throws(()=>inspectionMigrationHistoryCopySelection(ctx.tocHandle),{code:pure("FORMAT_UNSUPPORTED")});}finally{ctx.discard();}}
});
test("old Source/B4/pure/native APIs cannot accept any inspection plan, TOC, history or receipt",async()=>{
  const ctx=context(),source=context({side:"archive"}),target=context({side:"target"});let ih,sh,receipt;
  try{ih=extractInspectionMigrationHistory(ctx.tocHandle,ctx.output);sh=extractMigrationHistory(source.tocHandle,source.output);assert.throws(()=>migrationHistoryCopySelection(ctx.tocHandle),{code:pure("TOC_REQUIRED")});assert.throws(()=>extractMigrationHistory(ctx.tocHandle,ctx.output),{code:pure("TOC_REQUIRED")});assert.throws(()=>migrationHistoryFacts(ih),{code:pure("REQUIRED")});assert.throws(()=>inspectionMigrationHistoryFacts(sh),{code:pure("REQUIRED")});assert.equal(discardMigrationHistory(ih),false);assert.equal(discardInspectionMigrationHistory(sh),false);assert.equal(inspectionMigrationHistoryFacts(ih).binding.side,"target-inspection");
    for(const old of[source,target]){assert.throws(()=>inspectionMigrationHistoryCopySelection(old.tocHandle),{code:pure("TOC_REQUIRED")});const s=scenario(old);await refusal(()=>read(old,s),"TOC_REFUSED");assert.deepEqual(s.calls,[]);}
    const oldScenario=scenario(ctx);await refusal(()=>readNativeMigrationHistory(ctx.options,oldScenario.clock.scope,oldScenario.ports),"TOC_REFUSED");assert.deepEqual(oldScenario.calls,[]);
    const s=scenario(ctx);receipt=await read(ctx,s);const value=nativeInspectionMigrationHistoryFacts(receipt);assert.throws(()=>nativeMigrationHistoryFacts(receipt),{code:native("REQUIRED")});assert.equal(discardNativeMigrationHistory(receipt),false);assert.throws(()=>migrationHistoryFacts(value.historyHandle),{code:pure("REQUIRED")});assert.equal(inspectionMigrationHistoryFacts(value.historyHandle).binding.side,"target-inspection");
  }finally{if(ih)discardInspectionMigrationHistory(ih);if(sh)discardMigrationHistory(sh);close(ctx,receipt);source.discard();target.discard();}
});
test("pure inspection stores are isolated, hash guarded and wiped without changing caller stdout",()=>{
  const ctx=context(),before=Buffer.from(ctx.output);let handle;try{handle=extractInspectionMigrationHistory(ctx.tocHandle,ctx.output);const facts=inspectionMigrationHistoryFacts(handle);assert.equal(facts.binding,customTargetInspectionTocFacts(ctx.tocHandle).binding);assert.notEqual(facts.sourceBytes.buffer,ctx.output.buffer);facts.sourceBytes[0]^=1;assert.throws(()=>inspectionMigrationHistoryFacts(handle),{code:pure("BINDING_INVALID")});assert.equal(facts.sourceBytes.every(value=>value===0),true);assert.deepEqual(ctx.output,before);assert.equal(discardInspectionMigrationHistory(handle),false);}finally{close(ctx);}
});
test("inspection native getter/discard cannot consume a standard receipt",async()=>{
  const ctx=context({side:"archive"}),s=scenario(ctx);let receipt;
  try{receipt=await readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports);assert.throws(()=>nativeInspectionMigrationHistoryFacts(receipt),{code:native("REQUIRED")});assert.equal(discardNativeInspectionMigrationHistory(receipt),false);assert.equal(nativeMigrationHistoryFacts(receipt).nativeFacts.binding.side,"archive");}
  finally{if(receipt)discardNativeMigrationHistory(receipt);ctx.discard();}
});
test("TOC tamper/discard revokes its retained inspection history and zeros owned stdout",()=>{
  for(const action of["tamper","discard"]){const ctx=context();let handle;try{handle=extractInspectionMigrationHistory(ctx.tocHandle,ctx.output);const bytes=inspectionMigrationHistoryFacts(handle).sourceBytes;if(action==="tamper")customTargetInspectionTocFacts(ctx.tocHandle).records[0].definition[0]^=1;else discardCustomTargetInspectionToc(ctx.tocHandle);assert.throws(()=>inspectionMigrationHistoryFacts(handle),{code:pure("BINDING_INVALID")});assert.equal(bytes.every(value=>value===0),true);}finally{if(handle)discardInspectionMigrationHistory(handle);ctx.discard();}}
});
test("inspection parser remains LF/exact COPY/footer and returns only nominal closed diagnostics",()=>{
  const ctx=context();try{for(const output of[Buffer.from(ctx.output.toString().replaceAll("\n","\r\n")),Buffer.from(ctx.output.toString().replace("COPY auth.schema_migrations","COPY auth.users")),ctx.output.subarray(0,ctx.output.length-5),Buffer.concat([ctx.output,Buffer.from(CANARY)])]){let error;try{extractInspectionMigrationHistory(ctx.tocHandle,output);}catch(value){error=value;}assert.ok(error);assert.equal(MIGRATION_HISTORY_ERROR_CODES.includes(error.code),true);const diagnostic=migrationHistoryDiagnostic(error);assert.deepEqual(Object.keys(diagnostic),["version","phase","rule"]);assert.equal(MIGRATION_HISTORY_DIAGNOSTIC_RULES[diagnostic.phase].includes(diagnostic.rule),true);assert.equal(JSON.stringify(diagnostic).includes(CANARY),false);assert.equal(Object.isFrozen(diagnostic),true);}}finally{ctx.discard();}
});
test("inspection wrappers reject clone/proxy/getter/SAB/detached inputs without promoting authority",()=>{
  const ctx=context();let touches=0;try{for(const handle of[{},ctx.plan,JSON.parse(JSON.stringify(ctx.tocHandle)),new Proxy({},{get(){touches++;throw Error(CANARY);}})]){assert.throws(()=>inspectionMigrationHistoryCopySelection(handle),{code:pure("TOC_REQUIRED")});assert.throws(()=>inspectionMigrationHistoryFacts(handle),{code:pure("REQUIRED")});assert.equal(discardInspectionMigrationHistory(handle),false);}for(const value of[new Proxy(ctx.output,{get(){touches++;throw Error(CANARY);}}),new Uint8Array(new SharedArrayBuffer(ctx.output.length))])assert.throws(()=>extractInspectionMigrationHistory(ctx.tocHandle,value),{code:pure("INPUT_INVALID")});const detached=new Uint8Array(ctx.output);structuredClone(detached,{transfer:[detached.buffer]});assert.throws(()=>extractInspectionMigrationHistory(ctx.tocHandle,detached),{code:pure("INPUT_INVALID")});assert.equal(touches,0);}finally{ctx.discard();}
});
test("native inspection retains side/flags/IDs and owned dedicated copies under synthetic ports",async()=>{
  const ctx=context(),before=Buffer.from(ctx.database),s=scenario(ctx);let receipt;try{receipt=await read(ctx,s);const value=nativeInspectionMigrationHistoryFacts(receipt),facts=inspectionMigrationHistoryFacts(value.historyHandle);assert.deepEqual(receipt,{inspectionOnly:true,baselineQualified:false});assert.equal(value.nativeFacts.inspectionOnly,true);assert.equal(value.nativeFacts.baselineQualified,false);assert.equal(value.nativeFacts.mode,"synthetic");assert.equal(value.nativeFacts.binding.side,"target-inspection");assert.equal(value.nativeFacts.binding,facts.binding);assert.equal(value.nativeFacts.binding.nativeDumpSha256,digest(ctx.database));assert.equal(Object.hasOwn(value.nativeFacts.binding,"archiveSha256"),false);assert.deepEqual(value.nativeFacts.dumpIds,[13,14]);assert.equal(value.nativeFacts.inputTerminal,"finish");assert.equal(s.removals,1);assert.equal(s.clock.closeCalls,0);assert.notEqual(s.borrowed.buffer,ctx.database.buffer);assert.equal(s.borrowed.buffer.byteLength,ctx.database.length);assert.equal(s.borrowed.every(value=>value===0),true);assert.equal(s.chunks.every(bytes=>bytes.every(value=>value===0)),true);assert.deepEqual(ctx.database,before);assert.equal(s.listText,ctx.toc.split("\n").filter(line=>/^(?:13|14);/.test(line)).map(line=>line+"\n").join(""));assert.equal(NATIVE_HISTORY_ERROR_CODES.length,14);}finally{close(ctx,receipt);}
});
test("native inspection rejects swapped dump/list/TOC or extra reader authority before any IO port",async()=>{
  const ctx=context(),foreign=context({rows:{21:{tag:"other_function()"}}});try{for(const change of[{database:foreign.database},{nativeTocText:foreign.toc},{tocHandle:foreign.tocHandle},{mode:"native"},{getFacts(){throw Error(CANARY);}}]){const s=scenario(ctx);await assert.rejects(()=>readNativeInspectionMigrationHistory({...ctx.options,...change},s.clock.scope,s.ports));assert.deepEqual(s.calls,[]);}let touched=0;const options={...ctx.options};Object.defineProperty(options,"tocHandle",{enumerable:true,get(){touched++;throw Error(CANARY);}});const s=scenario(ctx);await refusal(()=>readNativeInspectionMigrationHistory(options,s.clock.scope,s.ports),"INPUT_INVALID");assert.equal(touched,0);}finally{ctx.discard();foreign.discard();}
});
test("pre-IO inspection selection failure retains the trusted closed parser diagnostic",async()=>{
  const ctx=context({wire:{13:{copyStatement:"COPY auth.schema_migrations (unexpected) FROM stdin;\n"}}}),s=scenario(ctx);try{const error=await refusal(()=>read(ctx,s),"TOC_REFUSED"),d=nativeMigrationHistoryDiagnostic(error);assert.equal(d.parserError,pure("FORMAT_UNSUPPORTED"));assert.deepEqual(d.parserDiagnostic,{version:1,phase:"profile",rule:"copy_columns"});assert.deepEqual(s.calls,[]);}finally{ctx.discard();}
});
test("conditional EPIPE still requires original paired input and a complete two-history parse",async()=>{
  const ctx=context();let receipt;try{const s=scenario(ctx,{input:"epipe"});receipt=await read(ctx,s);const f=nativeInspectionMigrationHistoryFacts(receipt).nativeFacts;assert.equal(f.inputTerminal,"selected_tail_unconsumed");assert.equal(f.tailUnconsumed,true);assert.equal(f.stdinFinishObserved,false);assert.equal(Object.hasOwn(f,"fullSourceConsumed"),false);discardNativeInspectionMigrationHistory(receipt);for(const output of[ctx.output.subarray(0,ctx.output.length-5),Buffer.from(ctx.output.toString().replace("COPY auth.schema_migrations","COPY auth.users"))]){const s=scenario(ctx,{input:"epipe",output});await refusal(()=>read(ctx,s),"PARSER_REFUSED");assert.equal(s.borrowed.every(v=>v===0),true);}}finally{close(ctx,receipt);}
});
test("missing paired terminal/EOF never becomes a native inspection receipt",async()=>{
  for(const [control,suffix]of[[{input:"event-only",expire:true},"TIMEOUT"],[{input:"callback-only",expire:true},"TIMEOUT"],[{noOutEnd:true,closeWithoutEof:true},"PRODUCER_FAILED"],[{noErrEnd:true,expire:true},"TIMEOUT"],[{noExit:true},"PRODUCER_FAILED"],[{closeCode:1},"PRODUCER_FAILED"],[{input:"other"},"INPUT_FAILED"]]){const ctx=context(),s=scenario(ctx,control);try{await refusal(()=>read(ctx,s),suffix);assert.equal(s.clock.closeCalls,0);assert.equal(s.removals,1);}finally{if(s.callback&&!(control.input==="event-only"))s.callback();ctx.discard();}}
});
test("late original errors during owned cleanup retain first refusal and invalidate completion",async()=>{
  for(const terminal of["child","stdin","stdout","callback"]){const ctx=context();let s;s=scenario(ctx,{cleanup(){if(terminal==="child")s.children[0].emit("error",Error(CANARY));else if(terminal==="stdin")s.children[0].stdin.emit("error",Object.assign(Error(CANARY),{code:"ECONNRESET"}));else if(terminal==="stdout")s.children[0].stdout.emit("error",Error(CANARY));else s.callback();}});try{await refusal(()=>read(ctx,s),terminal==="child"?"SPAWN_FAILED":terminal==="stdout"?"PRODUCER_FAILED":"INPUT_FAILED");assert.equal(s.borrowed.every(v=>v===0),true);}finally{ctx.discard();}}
});
test("post-receipt original faults revoke the inspection history, not an unrelated standard store",async()=>{
  const ctx=context(),source=context({side:"archive"}),standard=extractMigrationHistory(source.tocHandle,source.output),s=scenario(ctx);let receipt;try{receipt=await read(ctx,s);const bytes=inspectionMigrationHistoryFacts(nativeInspectionMigrationHistoryFacts(receipt).historyHandle).sourceBytes;s.children[0].stdin.emit("error",Object.assign(Error(CANARY),{code:"ECONNRESET"}));assert.equal(bytes.every(v=>v===0),true);assert.throws(()=>nativeInspectionMigrationHistoryFacts(receipt),{code:native("INPUT_FAILED")});assert.equal(migrationHistoryFacts(standard).binding.side,"archive");}finally{close(ctx,receipt);discardMigrationHistory(standard);source.discard();}
});
test("parser refusal remains first when cleanup or later provider errors follow",async()=>{
  const ctx=context(),s=scenario(ctx,{output:ctx.output.subarray(0,ctx.output.length-5),cleanup(){throw Error(CANARY);}});try{const error=await refusal(()=>read(ctx,s),"PARSER_REFUSED"),first=nativeMigrationHistoryDiagnostic(error);assert.equal(first.parserError,pure("TRUNCATED"));assert.equal(first.phase,"parse");s.children[0].emit("error",Error(CANARY));assert.equal(nativeMigrationHistoryDiagnostic(error),first);assert.equal(first.cleanup,"not_started");assert.equal(Object.isFrozen(first),true);}finally{ctx.discard();}
});
test("inspection cleanup refusal and external TOC/history discard stay closed and independent",async()=>{
  const ctx=context();try{const s=scenario(ctx,{cleanup(){throw Error(CANARY);}});await refusal(()=>read(ctx,s),"CLEANUP_FAILED");}finally{ctx.discard();}
  for(const action of["toc","history"]){const ctx=context(),s=scenario(ctx);let receipt;try{receipt=await read(ctx,s);const value=nativeInspectionMigrationHistoryFacts(receipt);if(action==="toc")discardCustomTargetInspectionToc(ctx.tocHandle);else discardInspectionMigrationHistory(value.historyHandle);assert.throws(()=>nativeInspectionMigrationHistoryFacts(receipt),{code:native("BINDING_INVALID")});assert.equal(discardNativeInspectionMigrationHistory(receipt),false);assert.throws(()=>nativeInspectionMigrationHistoryFacts(JSON.parse(JSON.stringify(receipt))),{code:native("REQUIRED")});}finally{close(ctx,receipt);}}
});
test("Windows binary branch shares the original helper and cannot upgrade injected origin",async()=>{
  const ctx=context(),p=pipeScenario(ctx),s=p.s;let receipt;try{receipt=await read(ctx,s);const value=nativeInspectionMigrationHistoryFacts(receipt);assert.equal(value.nativeFacts.mode,"synthetic");assert.equal(value.nativeFacts.outputTransport,"windows_binary_pipe");assert.equal(value.nativeFacts.binaryHelper.transportMode,"native");assert.equal(value.nativeFacts.binding.side,"target-inspection");assert.equal(inspectionMigrationHistoryFacts(value.historyHandle).history.storage.length,1);assert.equal(p.ownedCopy.every(v=>v===0),true);assert.equal(p.events.includes("discard"),false);discardNativeInspectionMigrationHistory(receipt);assert.equal(p.events.at(-1),"discard");assert.equal(s.clock.closeCalls,0);}finally{close(ctx,receipt);}
});
test("binary helper proof and original PG terminals cannot substitute for one another",async()=>{
  for(const controls of[{readyFails:true},{badPath:true},{helperFails:true},{pgOutput:Buffer.from("PUBLIC_UNEXPECTED_PG_STDOUT")},{closeCode:1},{noExit:true}]){const ctx=context(),p=pipeScenario(ctx,controls);try{await refusal(()=>read(ctx,p.s),"PRODUCER_FAILED");assert.equal(p.events.includes("discard"),true);assert.equal(p.s.removals,1);}finally{ctx.discard();}}
});
test("binary helper pending preserves inherited deadline and late helper fault revokes receipt",async()=>{
  const pending=context(),p=pipeScenario(pending,{helperPending:true,expire:true});try{await refusal(()=>read(pending,p.s),"TIMEOUT");assert.equal(p.events.includes("discard"),true);assert.equal(p.s.clock.closeCalls,0);}finally{pending.discard();}
  const ctx=context(),late=pipeScenario(ctx);let receipt;try{receipt=await read(ctx,late.s);const bytes=inspectionMigrationHistoryFacts(nativeInspectionMigrationHistoryFacts(receipt).historyHandle).sourceBytes;late.fail();assert.throws(()=>nativeInspectionMigrationHistoryFacts(receipt),{code:native("PRODUCER_FAILED")});assert.equal(bytes.every(v=>v===0),true);assert.equal(late.events.at(-1),"discard");}finally{close(ctx,receipt);}
});
