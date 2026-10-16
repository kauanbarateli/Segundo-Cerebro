import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { inspect } from "node:util";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { planManagedRestore, planManagedTargetBaseline } from "../../scripts/operations/restore-managed-plan.mjs";
import { extractCustomArchiveToc, extractCustomTargetToc, customArchiveTocFacts, discardCustomArchiveToc } from "../../scripts/operations/restore-custom-toc.mjs";
import { migrationHistoryFacts, discardMigrationHistory } from "../../scripts/operations/restore-migration-history.mjs";
import { readNativeMigrationHistory, nativeMigrationHistoryFacts, nativeMigrationHistoryDiagnostic, discardNativeMigrationHistory, NATIVE_HISTORY_LIMITS, NATIVE_HISTORY_ERROR_CODES, main } from "../../scripts/operations/restore-migration-history-native.mjs";

// Every byte and child below is artificial RAM. No real spawn/fs/ACL/network,
// profile, archive, database, comparison, mint, import or private path is used.
const CANARY = "PRIVATE_NATIVE_HISTORY_CANARY", digest = value => createHash("sha256").update(value).digest("hex");
const AUTH = "COPY auth.schema_migrations (version) FROM stdin;\n", STORAGE = "COPY storage.migrations (id, name, hash, executed_at) FROM stdin;\n";
const HEADER = Buffer.from("5047444d5001100004080101" + "0017000000002a000000000f00000000100000000009000000007e0000000000000000" + "0008000000706f737467726573000400000031372e36000400000031382e34", "hex");
const integer = value => { const bytes = Buffer.alloc(5); bytes[0] = value < 0 ? 1 : 0; bytes.writeUInt32LE(Math.abs(value), 1); return bytes; };
const text = value => value === null ? integer(-1) : Buffer.concat([integer(Buffer.byteLength(value)), Buffer.from(value)]);
const rows = [
  [1,"ENCODING","-","ENCODING","",[]], [2,"STDSTRINGS","-","STDSTRINGS","",[]], [3,"SEARCHPATH","-","SEARCHPATH","",[]],
  [4,"SCHEMA","-","auth","supabase_auth_admin",[]], [5,"SCHEMA","-","storage","supabase_storage_admin",[]], [6,"SCHEMA","-","app_private","postgres",[]],
  [7,"TABLE","auth","users","supabase_auth_admin",[4]], [8,"TABLE","storage","objects","supabase_storage_admin",[5]], [9,"TABLE","storage","buckets","supabase_storage_admin",[5]],
  [10,"TABLE","auth","schema_migrations","supabase_auth_admin",[4]], [11,"TABLE","storage","migrations","supabase_storage_admin",[5]],
  [12,"TABLE DATA","auth","users","supabase_auth_admin",[7]], [13,"TABLE DATA","auth","schema_migrations","supabase_auth_admin",[10]], [14,"TABLE DATA","storage","migrations","supabase_storage_admin",[11]],
  [15,"TRIGGER","auth","users second_brain_identity_created","postgres",[7]], [16,"TRIGGER","auth","users second_brain_admin_creation_final","postgres",[7]],
  [17,"POLICY","storage","objects second_brain_private_objects","supabase_storage_admin",[8]], [18,"POLICY","storage","buckets second_brain_private_buckets","supabase_storage_admin",[9]],
];
function context({ side="archive", authCopy=AUTH } = {}) {
  const entries = side === "target" ? rows.filter(([id])=>id!==6&&id<15) : rows;
  const toc = `;     TOC Entries: ${entries.length}\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n` + entries.map(([id,kind,schema,tag,owner,dependencies]) => `${id}; 0 0 ${kind} ${schema} ${tag} ${owner}\n` + (dependencies.length ? ";\tdepends on: " + dependencies.join(" ") + "\n" : "")).join("");
  const parts = [HEADER, integer(entries.length)];
  for (const [id,kind,schema,tag,owner,dependencies] of entries) {
    const data = kind === "TABLE DATA", definition = id === 1 ? "SET client_encoding = 'UTF8';\n" : id === 2 ? "SET standard_conforming_strings = 'on';\n" : id === 3 ? "SELECT pg_catalog.set_config('search_path', '', false);\n" : data ? null : "-- artificial\n";
    parts.push(integer(id),integer(data?1:0),text("0"),text("0"),text(tag),text(kind),integer(data?3:["TRIGGER","POLICY"].includes(kind)?4:2),text(definition),text(null),text(id===13?authCopy:id===14?STORAGE:null),text(schema==="-"?null:schema),text(null),text(kind==="TABLE"?"heap":null),integer(kind==="TABLE"?114:0),text(owner),text("false"));
    for (const dependency of dependencies) parts.push(text(String(dependency)));
    parts.push(integer(-1),Buffer.from([data?1:3]),Buffer.alloc(8));
  }
  parts.push(Buffer.from("UNSELECTED_ARTIFICIAL_TAIL_" + CANARY)); const database = Buffer.concat(parts);
  const plan = side === "target" ? planManagedTargetBaseline(toc,{projectRef:"t".repeat(20),databaseName:"postgres",nativeDumpSha256:digest(database),nativeDumpBytes:database.length}) : planManagedRestore(toc,{archiveSha256:"a".repeat(64),databaseSha256:digest(database),databaseBytes:database.length});
  const tocHandle = side === "target" ? extractCustomTargetToc(plan,database) : extractCustomArchiveToc(plan,database);
  const output = Buffer.from("--\n-- PostgreSQL database dump\n--\n\n\\restrict SCBaselineV1\n\n-- Dumped from database version 17.6\n-- Dumped by pg_dump version 18.4\n\nSET statement_timeout = 0;\nSET lock_timeout = 0;\nSET idle_in_transaction_session_timeout = 0;\nSET transaction_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSELECT pg_catalog.set_config('search_path', '', false);\nSET check_function_bodies = false;\nSET xmloption = content;\nSET client_min_messages = warning;\nSET row_security = off;\n\n" +
    "--\n-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin\n--\n\n" + AUTH + "20240101\n\\.\n\n\n" +
    "--\n-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin\n--\n\n" + STORAGE + "0\tinitial\t" + "a".repeat(40) + "\t\\N\n\\.\n\n\n" +
    "--\n-- PostgreSQL database dump complete\n--\n\n\\unrestrict SCBaselineV1\n\n");
  const options = { tocHandle, database, nativeTocText:toc, pgRestore:resolve("/RAM-native-history/pg_restore.exe"), environment:{SystemRoot:resolve("/Windows")}, listOptions:{privateRoot:resolve("/RAM-native-history/inspector-exclusive"),powerShellExecutable:resolve("/Windows/powershell.exe"),systemRoot:resolve("/Windows"),forbiddenRoots:[],syncRoots:[]} };
  return { options, database, toc, tocHandle, output };
}
function budget() {
  let expired = false, closeCalls = 0, rejectDeadline;
  const timeout = new Promise((_yes,no) => { rejectDeadline=no; }); timeout.catch(()=>{});
  const scope = { check(){if(expired)throw Error(CANARY);}, remaining(){this.check();return 45000;},race(value){return Promise.race([value,timeout]);},close(){closeCalls++;} };
  return { scope, expire(){expired=true;rejectDeadline(Error(CANARY));}, get closeCalls(){return closeCalls;} };
}
function scenario(ctx, controls = {}) {
  const clock=budget(), calls=[], children=[], dataChunks=[];let listText, borrowed, callback, removals=0;
  const ports = {
    async createLists(options,timeoutMs){calls.push("factory");assert.equal(timeoutMs,45000);assert.equal(options.privateRoot,ctx.options.listOptions.privateRoot);if(controls.factory)return controls.factory(options);return {
      async materializeList(value){calls.push("list");listText=value;if(controls.materialize)await controls.materialize(value);return {path:resolve("/RAM-native-history/inspector-exclusive/managed-toc-own/list.toc"),sha256:digest(value),private:true};},
      async removeLists(){calls.push("cleanup");removals++;if(controls.cleanup)await controls.cleanup();},
    };},
    spawn(executable,args,settings){calls.push("spawn");assert.equal(executable,ctx.options.pgRestore);assert.deepEqual(args,["--data-only","--use-list="+resolve("/RAM-native-history/inspector-exclusive/managed-toc-own/list.toc"),"--file=-","--restrict-key=SCBaselineV1"]);assert.deepEqual(settings,{env:ctx.options.environment,stdio:["pipe","pipe","pipe"],shell:false,windowsHide:true});
      const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new EventEmitter();child.stdin.destroy=()=>{calls.push("stdin-destroy");};child.kill=()=>{calls.push("kill");return true;};child.unref=()=>{calls.push("unref");};
      child.stdin.end=(bytes,settle)=>{borrowed=bytes;callback=settle;calls.push("write");queueMicrotask(()=>{
        if(controls.onStart)controls.onStart({child,clock,settle,bytes});
        if(!controls.noSpawn)child.emit("spawn");
        const data=Buffer.from(controls.output??ctx.output);dataChunks.push(data);if(controls.noOutEnd)child.stdout.write(data);else child.stdout.end(data);
        if(controls.stderr){const chunk=Buffer.from(controls.stderr);dataChunks.push(chunk);child.stderr.write(chunk);}
        if(!controls.noErrEnd)child.stderr.end();
        const mode=controls.input??"finish";
        if(mode==="finish"){child.stdin.emit("finish");settle();}
        else if(mode==="epipe"){const error=Object.assign(Error(CANARY),{code:"EPIPE"});child.stdin.emit("error",error);settle(error);}
        else if(mode==="event-only"){child.stdin.emit("error",Object.assign(Error(CANARY),{code:"EPIPE"}));}
        else if(mode==="callback-only"){settle(Object.assign(Error(CANARY),{code:"EPIPE"}));}
        else if(mode==="finish-only")child.stdin.emit("finish");
        else if(mode==="other"){const error=Object.assign(Error(CANARY),{code:"ECONNRESET"});child.stdin.emit("error",error);settle(error);}
        if(controls.closeWithoutEnd)child.stdout.emit("close");
        const code=controls.closeCode??0;child.emit("exit",code);if(!controls.noClose)child.emit("close",code);
        if(controls.expire)setImmediate(()=>clock.expire());
      });};children.push(child);return child;
    },
  };
  return {ports,clock,calls,children,dataChunks,get listText(){return listText;},get borrowed(){return borrowed;},get callback(){return callback;},get removals(){return removals;}};
}
function errorCode(suffix){return "RESTORE_MIGRATION_HISTORY_NATIVE_"+suffix;}
async function refusal(operation,suffix){let captured;await assert.rejects(operation,error=>{captured=error;assert.equal(error.code,errorCode(suffix));assert.equal(error.message,errorCode(suffix));assert.equal(Object.hasOwn(error,"cause"),false);for(const value of [error.stack,inspect(error),JSON.stringify(error)])assert.equal(value.includes(CANARY),false);return true;});return captured;}
const turn = () => new Promise(yes=>setImmediate(yes));

test("help is inert, direct CLI cannot execute and original error diagnostic is nominal",async()=>{
  const values=[];assert.equal(await main(["--help"],v=>values.push(v)),0);assert.equal(await main(["--execute"],v=>values.push(v)),1);assert.deepEqual(values.map(v=>v.code),["NO_NATIVE_EXECUTION","ROOT_IN_PROCESS_ONLY"]);
  assert.equal(Object.isFrozen(NATIVE_HISTORY_LIMITS),true);assert.equal(Object.isFrozen(NATIVE_HISTORY_ERROR_CODES),true);
  let touched=0;const poison=new Proxy({}, {get(){touched++;throw Error(CANARY);}});assert.equal(nativeMigrationHistoryDiagnostic(poison),null);assert.equal(nativeMigrationHistoryDiagnostic({code:errorCode("INPUT_FAILED")}),null);assert.equal(touched,0);
});
test("default successful transport requires original paired terminals and returns only a synthetic nominal receipt under test ports",async()=>{
  const ctx=context(),before=Buffer.from(ctx.database),s=scenario(ctx);let receipt;
  try{receipt=await readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports);const value=nativeMigrationHistoryFacts(receipt),facts=migrationHistoryFacts(value.historyHandle);assert.deepEqual(receipt,{});assert.equal(Object.isFrozen(receipt),true);assert.equal(JSON.stringify(receipt),"{}");assert.equal(value.nativeFacts.mode,"synthetic");assert.equal(value.nativeFacts.inputTerminal,"finish");assert.equal(value.nativeFacts.tailUnconsumed,false);assert.equal(value.nativeFacts.stdinFinishObserved,true);assert.equal(value.nativeFacts.stdoutEofObserved,true);assert.equal(value.nativeFacts.stderrEofObserved,true);assert.equal(value.nativeFacts.producerCloseCode,0);assert.equal(value.nativeFacts.cleanupCompleted,true);assert.equal(Object.hasOwn(value.nativeFacts,"fullSourceConsumed"),false);assert.deepEqual(value.nativeFacts.dumpIds,[13,14]);assert.deepEqual(facts.history.auth,[{version:"20240101"}]);assert.equal(facts.history.storage[0].name,"initial");assert.equal(s.removals,1);assert.equal(s.clock.closeCalls,0);assert.deepEqual(ctx.database,before);assert.notEqual(s.borrowed.buffer,ctx.database.buffer);assert.equal(s.borrowed.buffer.byteLength,ctx.database.length);assert.equal(s.borrowed.every(v=>v===0),true);assert.equal(s.dataChunks.every(v=>v.every(b=>b===0)),true);assert.equal(s.listText,ctx.toc.split("\n").filter(line=>/^(?:13|14);/.test(line)).map(line=>line+"\n").join(""));}
  finally{if(receipt)discardNativeMigrationHistory(receipt);discardCustomArchiveToc(ctx.tocHandle);}
});
test("legitimate selected tail EPIPE requires original error AND callback plus full two-history parser and producer terminals",async()=>{
  const ctx=context(),s=scenario(ctx,{input:"epipe"});let receipt;
  try{receipt=await readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports);const facts=nativeMigrationHistoryFacts(receipt).nativeFacts;assert.equal(facts.inputTerminal,"selected_tail_unconsumed");assert.equal(facts.tailUnconsumed,true);assert.equal(facts.stdinFinishObserved,false);assert.equal(facts.stdinCallbackSettled,true);assert.equal(facts.stdinCallbackError,"EPIPE");assert.equal(facts.mode,"synthetic");assert.equal(s.calls.includes("kill"),false);assert.equal(s.borrowed.every(v=>v===0),true);}
  finally{if(receipt)discardNativeMigrationHistory(receipt);discardCustomArchiveToc(ctx.tocHandle);}
});
test("nominal B4 target transport retains target binding through B3, rejects source swaps and discards independently",async()=>{
  for(const input of ["finish","epipe"]){
    const ctx=context({side:"target"}),source=context(),before=Buffer.from(ctx.database),s=scenario(ctx,{input});let receipt;
    try{
      receipt=await readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports);const value=nativeMigrationHistoryFacts(receipt),history=migrationHistoryFacts(value.historyHandle),binding=customArchiveTocFacts(ctx.tocHandle).binding;
      assert.equal(value.nativeFacts.mode,"synthetic");assert.equal(value.nativeFacts.binding,binding);assert.equal(history.binding,binding);assert.equal(binding.side,"target");assert.equal(binding.projectRef,"t".repeat(20));assert.equal(binding.nativeDumpSha256,digest(ctx.database));assert.equal(binding.nativeDumpBytes,ctx.database.length);assert.equal(Object.hasOwn(binding,"archiveSha256"),false);assert.equal(Object.hasOwn(binding,"databaseSha256"),false);assert.equal(history.history.auth[0].version,"20240101");assert.equal(history.history.storage[0].name,"initial");assert.equal(value.nativeFacts.tailUnconsumed,input==="epipe");
      for(const change of [{database:source.database},{nativeTocText:source.toc},{tocHandle:source.tocHandle},{database:source.database,nativeTocText:source.toc}]){const swapped=scenario(ctx);await refusal(()=>readNativeMigrationHistory({...ctx.options,...change},swapped.clock.scope,swapped.ports),"BINDING_INVALID");assert.deepEqual(swapped.calls,[]);}
      const owned=history.sourceBytes;assert.equal(discardNativeMigrationHistory(receipt),true);assert.equal(owned.every(v=>v===0),true);assert.deepEqual(ctx.database,before);assert.equal(customArchiveTocFacts(ctx.tocHandle).binding.side,"target");assert.equal(discardNativeMigrationHistory(receipt),false);
      const second=scenario(ctx),next=await readNativeMigrationHistory(ctx.options,second.clock.scope,second.ports);try{discardCustomArchiveToc(ctx.tocHandle);assert.throws(()=>nativeMigrationHistoryFacts(next),{code:errorCode("BINDING_INVALID")});assert.equal(discardNativeMigrationHistory(next),false);}finally{discardNativeMigrationHistory(next);}
    }finally{if(receipt)discardNativeMigrationHistory(receipt);discardCustomArchiveToc(ctx.tocHandle);discardCustomArchiveToc(source.tocHandle);}
  }
});
test("EPIPE never qualifies truncated, extra or foreign COPY output even with EOF/close0",async()=>{
  for(const output of [Buffer.from("short"),Buffer.concat([context().output,Buffer.from("PRIVATE_EXTRA")]),Buffer.from(context().output.toString().replace("COPY auth.schema_migrations","COPY auth.users"))]){
    const ctx=context(),s=scenario(ctx,{input:"epipe",output});try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"PARSER_REFUSED");const d=nativeMigrationHistoryDiagnostic(error);assert.equal(d.phase,"parse");assert.equal(d.stdinError,"EPIPE");assert.equal(d.stdinCallbackError,"EPIPE");assert.equal(d.producerClose,"zero");assert.equal(s.removals,1);assert.equal(s.borrowed.every(v=>v===0),true);}finally{discardCustomArchiveToc(ctx.tocHandle);}
  }
});
test("direct B3 parser refusal keeps closed truncation or foreign COPY code in the first immutable diagnostic",async()=>{
  const base=context();try{
    for(const [output,parserError]of [[base.output.subarray(0,base.output.length-5),"RESTORE_MIGRATION_HISTORY_TRUNCATED"],[Buffer.from(base.output.toString().replace("COPY auth.schema_migrations","COPY auth.users")),"RESTORE_MIGRATION_HISTORY_FORMAT_UNSUPPORTED"]]){
      const ctx=context(),s=scenario(ctx,{input:"epipe",output,cleanup(){throw new BackupError("RESTORE_MIGRATION_HISTORY_INPUT_INVALID");}});
      try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"PARSER_REFUSED"),diagnostic=nativeMigrationHistoryDiagnostic(error);assert.equal(diagnostic.phase,"parse");assert.equal(diagnostic.parserError,parserError);assert.equal(Object.isFrozen(diagnostic),true);s.children[0].stdin.emit("error",Object.assign(Error(CANARY),{code:"ECONNRESET"}));assert.equal(nativeMigrationHistoryDiagnostic(error),diagnostic);assert.equal(diagnostic.parserError,parserError);assert.equal(JSON.stringify(diagnostic).includes(CANARY),false);}
      finally{discardCustomArchiveToc(ctx.tocHandle);}
    }
  }finally{discardCustomArchiveToc(base.tocHandle);}
});
test("closed original B3 phase and rule survive native wrapping without widening parser acceptance",async()=>{
  const cases=[
    [value=>value.subarray(0,value.length-5),"footer","exact_footer"],
    [value=>Buffer.from(value.toString().replace("COPY auth.schema_migrations","COPY auth.users")),"copy_header","exact_original"],
    [value=>Buffer.from(value.toString().replace("SET lock_timeout = 0;","SET lock_timeout = 1;")),"preamble","settings_head"],
  ];
  for(const [alter,phase,rule]of cases){
    const ctx=context(),s=scenario(ctx,{output:alter(ctx.output)});
    try{
      const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"PARSER_REFUSED"),d=nativeMigrationHistoryDiagnostic(error);
      assert.deepEqual(d.parserDiagnostic,{version:1,phase,rule});assert.equal(Object.isFrozen(d.parserDiagnostic),true);
      assert.deepEqual(Object.keys(d.parserDiagnostic).sort(),["phase","rule","version"]);assert.equal(JSON.stringify(d).includes(CANARY),false);
      s.children[0].stdin.emit("error",Object.assign(Error(CANARY),{code:"ECONNRESET"}));
      assert.equal(nativeMigrationHistoryDiagnostic(error),d);assert.deepEqual(d.parserDiagnostic,{version:1,phase,rule});
    }finally{discardCustomArchiveToc(ctx.tocHandle);}
  }
});

test("pre-IO direct B3 COPY selection refusal records parserError without starting a factory or producer",async()=>{
  const ctx=context({authCopy:"COPY auth.schema_migrations (unexpected_column) FROM stdin;\n"}),s=scenario(ctx);
  try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"TOC_REFUSED"),diagnostic=nativeMigrationHistoryDiagnostic(error);assert.equal(diagnostic.phase,"input");assert.equal(diagnostic.parserError,"RESTORE_MIGRATION_HISTORY_FORMAT_UNSUPPORTED");assert.equal(diagnostic.stdoutBytes,0);assert.deepEqual(s.calls,[]);}
  finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("provider errors and spoofed diagnostics cannot populate parserError or evaluate code/message/cause getters",async()=>{
  const ctx=context();let touches=0;
  try{
    const getter=Error(CANARY);for(const key of ["code","message","cause"])Object.defineProperty(getter,key,{get(){touches++;throw Error(CANARY);}});
    for(const provider of [new BackupError("RESTORE_MIGRATION_HISTORY_TRUNCATED"),getter]){const s=scenario(ctx,{factory(){throw provider;}});const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"LIST_FAILED");assert.equal(nativeMigrationHistoryDiagnostic(error).parserError,null);}
    assert.equal(nativeMigrationHistoryDiagnostic({parserError:"RESTORE_MIGRATION_HISTORY_TRUNCATED",code:errorCode("PARSER_REFUSED")}),null);assert.equal(nativeMigrationHistoryDiagnostic(new Proxy({},{get(){touches++;throw Error(CANARY);}})),null);assert.equal(touches,0);
  }finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("non-EPIPE input failure, failed producer and pipe close without EOF preserve original first refusal",async()=>{
  for(const [control,suffix]of [[{input:"other"},"INPUT_FAILED"],[{input:"epipe",closeCode:1},"PRODUCER_FAILED"],[{noOutEnd:true,closeWithoutEnd:true},"PRODUCER_FAILED"]]){
    const ctx=context(),s=scenario(ctx,control);try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),suffix);assert.equal(nativeMigrationHistoryDiagnostic(error).phase,"collect");if(control.closeCode===1)assert.equal(nativeMigrationHistoryDiagnostic(error).producerExit,"nonzero");assert.equal(s.calls.filter(x=>x==="kill").length,1);assert.equal(s.removals,1);}finally{discardCustomArchiveToc(ctx.tocHandle);}
  }
});
test("each missing original terminal refuses rather than borrowing metadata or a cancellation ACK",async()=>{
  for(const control of [{input:"event-only"},{input:"callback-only"},{input:"finish-only"},{noOutEnd:true},{noErrEnd:true},{noClose:true},{noSpawn:true}]){
    const ctx=context(),s=scenario(ctx,{...control,expire:true});try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"TIMEOUT");const diagnostic=nativeMigrationHistoryDiagnostic(error);assert.equal(diagnostic.phase,"collect");assert.equal(diagnostic.cleanup,"not_started");assert.equal(Object.isFrozen(diagnostic),true);assert.equal(s.clock.closeCalls,0);if(control.input==="event-only"||control.input==="finish-only"){assert.equal(s.borrowed.some(v=>v!==0),true);s.callback(Object.assign(Error(CANARY),{code:"EPIPE"}));assert.equal(s.borrowed.every(v=>v===0),true);assert.equal(nativeMigrationHistoryDiagnostic(error).stdinCallbackSettled,false);}}
    finally{discardCustomArchiveToc(ctx.tocHandle);}
  }
});
test("late pending stdin callback owns the deferred wipe and cannot revise the first failure snapshot",async()=>{
  const ctx=context(),s=scenario(ctx,{input:"pending",expire:true});try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"TIMEOUT");assert.equal(s.borrowed.some(v=>v!==0),true);const before=nativeMigrationHistoryDiagnostic(error);assert.equal(before.stdinCallbackSettled,false);s.callback();assert.equal(s.borrowed.every(v=>v===0),true);assert.equal(nativeMigrationHistoryDiagnostic(error),before);assert.equal(before.stdinCallbackSettled,false);}
  finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("late producer data after refusal is erased without entering a receipt or replacing first failure",async()=>{
  const ctx=context(),s=scenario(ctx,{input:"other",noOutEnd:true});try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"INPUT_FAILED");const diagnostic=nativeMigrationHistoryDiagnostic(error),late=Buffer.from(CANARY);s.children[0].stdout.emit("data",late);assert.equal(late.every(v=>v===0),true);assert.equal(nativeMigrationHistoryDiagnostic(error),diagnostic);assert.equal(diagnostic.stdinError,"other");}
  finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("stdout and stderr cumulative caps refuse before retaining oversized data",async()=>{
  for(const control of [{output:Buffer.alloc(NATIVE_HISTORY_LIMITS.stdoutBytes+1,65)},{stderr:Buffer.alloc(NATIVE_HISTORY_LIMITS.stderrBytes+1,65)}]){
    const ctx=context(),s=scenario(ctx,control);try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"OUTPUT_LIMIT");const d=nativeMigrationHistoryDiagnostic(error);assert.ok(d.stdoutBytes<=NATIVE_HISTORY_LIMITS.stdoutBytes+1);assert.ok(d.stderrBytes<=NATIVE_HISTORY_LIMITS.stderrBytes+1);assert.equal(s.dataChunks.every(v=>v.every(b=>b===0)),true);}
    finally{discardCustomArchiveToc(ctx.tocHandle);}
  }
});
test("strict own-data boundaries reject proxy/getters/extras/credentials before any factory or spawn",async()=>{
  const ctx=context();let touches=0;const cases=[{...ctx.options,native:true},{...ctx.options,environment:{...ctx.options.environment,PGPASSWORD:CANARY}},{...ctx.options,environment:{...ctx.options.environment,HOME:CANARY}},{...ctx.options,listOptions:{...ctx.options.listOptions,SID:CANARY}},new Proxy(ctx.options,{ownKeys(){touches++;throw Error(CANARY);}})];
  const accessor={...ctx.options};Object.defineProperty(accessor,"database",{enumerable:true,get(){touches++;throw Error(CANARY);}});cases.push(accessor);
  try{for(const options of cases){const s=scenario(ctx);const error=await refusal(()=>readNativeMigrationHistory(options,s.clock.scope,s.ports),"INPUT_INVALID");assert.equal(nativeMigrationHistoryDiagnostic(error).phase,"input");assert.deepEqual(s.calls,[]);}assert.equal(touches,0);}
  finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("scope and explicit test-port metadata cannot grant authority or invoke accessors",async()=>{
  const ctx=context();let touches=0;try{
    const s=scenario(ctx), accessor={...s.ports};Object.defineProperty(accessor,"spawn",{enumerable:true,get(){touches++;throw Error(CANARY);}});
    for(const ports of [{...s.ports,mode:"native"},new Proxy(s.ports,{ownKeys(){touches++;throw Error(CANARY);}}),accessor])await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,ports),"INPUT_INVALID");
    const badScope={...s.clock.scope};Object.defineProperty(badScope,"remaining",{enumerable:true,get(){touches++;throw Error(CANARY);}});await refusal(()=>readNativeMigrationHistory(ctx.options,badScope,s.ports),"INPUT_INVALID");
    await refusal(()=>readNativeMigrationHistory(ctx.options,{...s.clock.scope,remaining(){return Infinity;}},s.ports),"TIMEOUT");assert.equal(touches,0);assert.deepEqual(s.calls,[]);
  }finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("finish plus a later EPIPE is contradictory and never becomes selected-tail authority",async()=>{
  const ctx=context(),s=scenario(ctx,{input:"epipe",onStart({child}){child.stdin.emit("finish");}});try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"INPUT_FAILED");assert.equal(nativeMigrationHistoryDiagnostic(error).stdinFinishObserved,true);assert.equal(nativeMigrationHistoryDiagnostic(error).stdinError,"EPIPE");}finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("nominal TOC, complete list hash and database binding are mandatory before IO",async()=>{
  const ctx=context();try{for(const [change,suffix]of [[{tocHandle:{...ctx.tocHandle}},"TOC_REFUSED"],[{nativeTocText:ctx.toc+"; extra\n"},"BINDING_INVALID"],[{database:Buffer.from("not original")},"BINDING_INVALID"]]){const s=scenario(ctx);await refusal(()=>readNativeMigrationHistory({...ctx.options,...change},s.clock.scope,s.ports),suffix);assert.deepEqual(s.calls,[]);}const modified=Buffer.from(ctx.database);modified[modified.length-1]^=1;const s=scenario(ctx);await refusal(()=>readNativeMigrationHistory({...ctx.options,database:modified},s.clock.scope,s.ports),"BINDING_INVALID");assert.deepEqual(s.calls,[]);}
  finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("TOC integrity is rechecked after list IO and copied database remains independent",async()=>{
  const ctx=context(),s=scenario(ctx,{materialize(){customArchiveTocFacts(ctx.tocHandle).records[0].definition[0]^=1;}});try{await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"TOC_REFUSED");assert.equal(s.calls.includes("spawn"),false);assert.equal(s.removals,1);}
  finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("cleanup is part of the original scope, cannot grant a late receipt and never closes the borrowed scope",async()=>{
  const ctx=context();let s;s=scenario(ctx,{cleanup(){s.clock.expire();return Promise.resolve();}});try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),"TIMEOUT");const d=nativeMigrationHistoryDiagnostic(error);assert.equal(d.phase,"cleanup");assert.equal(d.cleanup,"failed");assert.equal(s.clock.closeCalls,0);assert.equal(s.borrowed.every(v=>v===0),true);}
  finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("cleanup rejection after parsed success discards B3, but never overwrites an earlier producer refusal",async()=>{
  for(const control of [{},{input:"other"}]){const ctx=context(),s=scenario(ctx,{...control,cleanup(){throw Error(CANARY);}});try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),control.input?"INPUT_FAILED":"CLEANUP_FAILED");assert.equal(nativeMigrationHistoryDiagnostic(error).phase,control.input?"collect":"cleanup");assert.equal(s.removals,1);}
    finally{discardCustomArchiveToc(ctx.tocHandle);}}
});
const lateFailures = [
  {kind:"stdin",suffix:"INPUT_FAILED",emit(s){s.children[0].stdin.emit("error",Object.assign(Error(CANARY),{code:"ECONNRESET"}));}},
  {kind:"child",suffix:"SPAWN_FAILED",emit(s){s.children[0].emit("error",Error(CANARY));}},
  {kind:"stdout",suffix:"PRODUCER_FAILED",emit(s){s.children[0].stdout.emit("error",Error(CANARY));}},
  {kind:"stderr",suffix:"PRODUCER_FAILED",emit(s){s.children[0].stderr.emit("error",Error(CANARY));}},
  {kind:"callback",suffix:"INPUT_FAILED",emit(s){s.callback();}},
];
test("original errors and duplicate callback during cleanup veto receipt after collect Promise settlement",async()=>{
  for(const row of lateFailures){
    const ctx=context();let s;s=scenario(ctx,{cleanup(){row.emit(s);throw Error("LATER_CLEANUP_"+CANARY);}});
    try{const error=await refusal(()=>readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports),row.suffix),d=nativeMigrationHistoryDiagnostic(error);assert.equal(d.phase,"cleanup",row.kind);assert.equal(d.cleanup,"pending",row.kind);assert.equal(d.stdoutEofObserved,true);assert.equal(d.stderrEofObserved,true);assert.equal(d.producerClose,"zero");assert.equal(s.removals,1);assert.equal(s.borrowed.every(v=>v===0),true);}
    finally{discardCustomArchiveToc(ctx.tocHandle);}
  }
});
test("original errors and duplicate callback after receipt revoke B3 and preserve original first failure",async()=>{
  for(const row of lateFailures){
    const ctx=context(),s=scenario(ctx);let receipt;
    try{receipt=await readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports);const value=nativeMigrationHistoryFacts(receipt),owned=migrationHistoryFacts(value.historyHandle).sourceBytes;row.emit(s);assert.equal(owned.every(v=>v===0),true,row.kind);let originalError;assert.throws(()=>nativeMigrationHistoryFacts(receipt),error=>{originalError=error;return error.code===errorCode(row.suffix);});const d=nativeMigrationHistoryDiagnostic(originalError);assert.equal(d.phase,"retained",row.kind);assert.equal(d.cleanup,"completed");s.children[0].stdin.emit("error",Object.assign(Error(CANARY),{code:"ECONNRESET"}));assert.equal(nativeMigrationHistoryDiagnostic(originalError),d);assert.equal(discardNativeMigrationHistory(receipt),false);assert.throws(()=>nativeMigrationHistoryFacts(receipt),{code:errorCode("DISCARDED")});assert.throws(()=>migrationHistoryFacts(value.historyHandle),{code:"RESTORE_MIGRATION_HISTORY_DISCARDED"});}
    finally{if(receipt)discardNativeMigrationHistory(receipt);discardCustomArchiveToc(ctx.tocHandle);}
  }
});
test("late factory result is cleaned once after deadline and can never spawn or certify",async()=>{
  const ctx=context();let release,removed=0;const s=scenario(ctx,{factory(){return new Promise(yes=>{release=yes;});}});try{const pending=readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports);await turn();s.clock.expire();await refusal(()=>pending,"TIMEOUT");release({materializeList(){throw Error(CANARY);},removeLists(){removed++;}});await turn();assert.equal(removed,1);assert.equal(s.calls.includes("spawn"),false);}
  finally{discardCustomArchiveToc(ctx.tocHandle);}
});
test("receipt getters are nominal, revalidate B3/TOC and total discard wipes owned history only",async()=>{
  const ctx=context(),s=scenario(ctx);let receipt;try{receipt=await readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports);const value=nativeMigrationHistoryFacts(receipt),stored=migrationHistoryFacts(value.historyHandle).sourceBytes;for(const fake of [null,{},structuredClone(receipt),Object.create(receipt),new Proxy(receipt,{})])assert.throws(()=>nativeMigrationHistoryFacts(fake),{code:errorCode("REQUIRED")});assert.equal(discardNativeMigrationHistory(receipt),true);assert.equal(stored.every(v=>v===0),true);assert.equal(discardNativeMigrationHistory(receipt),false);assert.equal(discardNativeMigrationHistory({}),false);assert.throws(()=>nativeMigrationHistoryFacts(receipt),{code:errorCode("DISCARDED")});assert.equal(customArchiveTocFacts(ctx.tocHandle).binding.side,"archive");}
  finally{if(receipt)discardNativeMigrationHistory(receipt);discardCustomArchiveToc(ctx.tocHandle);}
});
test("external B3/TOC discard invalidates a native receipt without promoting serialized facts",async()=>{
  for(const target of ["toc","history"]){const ctx=context(),s=scenario(ctx);let receipt;try{receipt=await readNativeMigrationHistory(ctx.options,s.clock.scope,s.ports);const value=nativeMigrationHistoryFacts(receipt);if(target==="toc")discardCustomArchiveToc(ctx.tocHandle);else discardMigrationHistory(value.historyHandle);assert.throws(()=>nativeMigrationHistoryFacts(receipt),{code:errorCode("BINDING_INVALID")});assert.equal(discardNativeMigrationHistory(receipt),false);assert.throws(()=>nativeMigrationHistoryFacts(JSON.parse(JSON.stringify(value.nativeFacts))),{code:errorCode("REQUIRED")});}
    finally{if(receipt)discardNativeMigrationHistory(receipt);discardCustomArchiveToc(ctx.tocHandle);}}
});
