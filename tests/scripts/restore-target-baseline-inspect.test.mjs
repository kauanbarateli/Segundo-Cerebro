import test, { after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { mkdtemp, lstat, readdir, rmdir, unlink, writeFile, readFile } from "node:fs/promises";
import { join, resolve, dirname, relative } from "node:path";
import { defaultInspectionTemporaryRoot, inspectManagedTargetBaseline, runManagedInspect, PRIVATE_PATH_ACL_SCRIPT, INSPECTION_LIMITS } from "../../scripts/operations/restore-managed-inspect.mjs";
import { TARGET_SNAPSHOT_NATIVE_PROJECT } from "../../scripts/operations/restore-target-snapshot-native.mjs";

// New exclusive artificial filesystem fixtures; ACL, psql, pg_dump and both
// pg_restore commands are EventEmitter/stream RAM ports. No SQL engine,
// native executable, original archive/profile, credential or service is used.
const CANARY="PRIVATE_TARGET_INTEGRATION_CANARY", hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const AUTH_COPY="COPY auth.schema_migrations (version) FROM stdin;\n", STORAGE_COPY="COPY storage.migrations (id, name, hash, executed_at) FROM stdin;\n";
const ROWS=[
  [1,"ENCODING","-","ENCODING","",[]],[2,"STDSTRINGS","-","STDSTRINGS","",[]],[3,"SEARCHPATH","-","SEARCHPATH","",[]],
  [4,"SCHEMA","-","auth","supabase_auth_admin",[]],[5,"SCHEMA","-","storage","supabase_storage_admin",[]],[6,"SCHEMA","-","public","pg_database_owner",[]],
  [7,"TABLE","auth","users","supabase_auth_admin",[4]],[8,"TABLE","storage","objects","supabase_storage_admin",[5]],[9,"TABLE","storage","buckets","supabase_storage_admin",[5]],
  [10,"TABLE","auth","schema_migrations","supabase_auth_admin",[4]],[11,"TABLE","storage","migrations","supabase_storage_admin",[5]],
  [12,"TABLE DATA","auth","schema_migrations","supabase_auth_admin",[10]],[13,"TABLE DATA","storage","migrations","supabase_storage_admin",[11]],
];
function binaryFixture(overrides={}){
  const int=value=>{const out=Buffer.alloc(5);out[0]=value<0?1:0;out.writeUInt32LE(Math.abs(value),1);return out;},string=value=>value===null?int(-1):Buffer.concat([int(Buffer.byteLength(value)),Buffer.from(value)]);
  const parts=[Buffer.from([80,71,68,77,80,1,16,0,4,8,1,1]),...[0,0,0,16,9,126,0].map(int),string("postgres"),string("17.6"),string("18.4"),int(ROWS.length)];
  for(const[id,kind,schema,tag,owner,dependencies]of ROWS){
    const selected={tag,namespace:schema==="-"?null:schema,owner,...overrides[id]},definition=kind==="ENCODING"?"SET client_encoding = 'UTF8';\n":kind==="STDSTRINGS"?"SET standard_conforming_strings = 'on';\n":kind==="SEARCHPATH"?"SELECT pg_catalog.set_config('search_path', '', false);\n":kind==="TABLE DATA"?null:"-- "+CANARY+"\n";
    parts.push(int(id),int(kind==="TABLE DATA"?1:0),string("0"),string("0"),string(selected.tag),string(kind),int(kind==="TABLE DATA"?3:2),string(definition),string(null),string(id===12?AUTH_COPY:id===13?STORAGE_COPY:null),string(selected.namespace),string(null),string(null),int(kind==="TABLE"?114:0),string(selected.owner),string("false"),...dependencies.map(value=>string(String(value))),string(null),Buffer.from([kind==="TABLE DATA"?1:3]),Buffer.alloc(8));
  }
  const tocBytes=parts.reduce((sum,part)=>sum+part.length,0),database=Buffer.concat([...parts,Buffer.from("ARTIFICIAL_UNPARSED_DATA_"+CANARY)]);
  const toc=";     TOC Entries: "+ROWS.length+"\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n"+ROWS.map(([id,kind,schema,tag,owner,deps])=>`${id}; 0 0 ${kind} ${schema} ${tag} ${owner}\n`+(deps.length?";\tdepends on: "+deps.join(" ")+"\n":"")).join("");
  return{database,toc,tocBytes};
}
const HISTORY=Buffer.from("--\n-- PostgreSQL database dump\n--\n\n\\restrict SCBaselineV1\n\n-- Dumped from database version 17.6\n-- Dumped by pg_dump version 18.4\n\nSET statement_timeout = 0;\nSET lock_timeout = 0;\nSET idle_in_transaction_session_timeout = 0;\nSET transaction_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSELECT pg_catalog.set_config('search_path', '', false);\nSET check_function_bodies = false;\nSET xmloption = content;\nSET client_min_messages = warning;\nSET row_security = off;\n\n"+
  "--\n-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin\n--\n\n"+AUTH_COPY+"20240101\n\\.\n\n\n"+
  "--\n-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin\n--\n\n"+STORAGE_COPY+"0\tinitial\t"+"a".repeat(40)+"\t\\N\n\\.\n\n\n--\n-- PostgreSQL database dump complete\n--\n\n\\unrestrict SCBaselineV1\n\n");
const baseEnv=()=>({SystemRoot:process.env.SystemRoot??resolve("RAM/system-root"),PATH:process.env.PATH,
  SC_RESTORE_PROJECT_REF:TARGET_SNAPSHOT_NATIVE_PROJECT,SC_RESTORE_CONFIRM_PROJECT:TARGET_SNAPSHOT_NATIVE_PROJECT,SC_RESTORE_ISOLATED:"YES",SC_RESTORE_SUPABASE_URL:"https://"+TARGET_SNAPSHOT_NATIVE_PROJECT+".supabase.co",SC_RESTORE_SUPABASE_KEY:"sb_secret_"+CANARY,
  SC_RESTORE_PG_RESTORE:resolve("RAM-not-installed/pg_restore.exe"),SC_RESTORE_PSQL:resolve("RAM-not-installed/psql.exe"),SC_RESTORE_PGHOST:"db."+TARGET_SNAPSHOT_NATIVE_PROJECT+".supabase.co",SC_RESTORE_PGPORT:"5432",SC_RESTORE_PGUSER:"postgres",SC_RESTORE_PGDATABASE:"postgres",SC_RESTORE_PGPASSWORD:CANARY,SC_RESTORE_PGSSLMODE:"require"});
const originalFetch=globalThis.fetch;let networkCalls=0;
globalThis.fetch=()=>{networkCalls++;throw Error("NETWORK_FORBIDDEN");};
after(()=>{globalThis.fetch=originalFetch;assert.equal(networkCalls,0);});
async function fixture(action){
  const temporary=await defaultInspectionTemporaryRoot(),directory=await mkdtemp(join(temporary,"sc-target-integration-fixture-")),lease=await lstat(directory);
  try{return await action({directory,env:baseEnv()});}
  finally{
    const current=await lstat(directory);assert.equal(current.dev,lease.dev);assert.equal(current.ino,lease.ino);assert.equal(current.birthtimeMs,lease.birthtimeMs);assert.equal(directory.startsWith(join(temporary,"sc-target-integration-fixture-")),true);
    for(const name of await readdir(directory)){const owned=join(directory,name);assert.equal(dirname(owned),directory);assert.equal(relative(directory,owned),name);assert.equal(name.startsWith("sc-inspect-target-"),true);const stat=await lstat(owned);assert.equal(stat.isDirectory()&&!stat.isSymbolicLink(),true);for(const child of await readdir(owned)){assert.equal(child,"unexpected-owned.txt");await unlink(join(owned,child));}await rmdir(owned);}
    await rmdir(directory);
  }
}
function startFrame(nonce,control){
  const relation=(oid,schema,name,rows)=>({oid,schemaOid:schema==="auth"?10:20,schema,name,kind:"r",extensionMember:false,extensionConfig:false,isPartition:false,hasInheritance:false,rowSecurityActive:false,rows});
  const frame={version:1,kind:"target-snapshot-start",nonce,snapshotId:"00000001-00000001-1",databaseName:"postgres",actor:"postgres",sessionActor:"postgres",readOnly:true,isolation:"repeatable read",rowSecurityOff:true,rlsBypass:true,catalogueComplete:true,catalogueCount:5,schemas:[{name:"auth",oid:10},{name:"storage",oid:20},{name:"public",oid:30},{name:"app_private",oid:null}],relations:[relation(100,"auth","schema_migrations",1),relation(101,"auth","users",0),relation(102,"storage","migrations",1),relation(103,"storage","objects",0),relation(104,"storage","buckets",0)]};
  control.start?.(frame);return frame;
}
function harness(context,control={}){
  const binary=binaryFixture(control.wire),calls=[],originalBuffers=[],inputBuffers=[],children={};let nonce,root,session,dumped=false;
  const streamChild=()=>Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),stdin:new EventEmitter(),kill(){calls.push("kill");return true;},unref(){}});
  const original=bytes=>{const value=Buffer.from(bytes);originalBuffers.push(value);return value;};
  function terminal(child,code=0){child.stdout.end();child.stderr.end();setImmediate(()=>{child.exited=true;child.emit("exit",code,null);child.emit("close",code,null);});}
  const targetSnapshotPorts={spawn(executable,argv,settings){
    const isSession=executable===context.env.SC_RESTORE_PSQL;calls.push(isSession?"session":"dump");assert.equal(settings.shell,false);assert.equal(settings.windowsHide,true);assert.equal(settings.env.PGPASSWORD,CANARY);assert.equal(JSON.stringify(argv).includes(CANARY),false);
    const child=streamChild();child.stdin.destroy=()=>{};
    if(isSession){assert.deepEqual(argv,["--no-psqlrc","--no-password","--quiet","--tuples-only","--no-align","--set=ON_ERROR_STOP=1","--file=-"]);session=child;children.session=child;}
    else{assert.equal(executable,join(dirname(context.env.SC_RESTORE_PG_RESTORE),"pg_dump.exe"));assert.deepEqual(argv,["--no-password","--format=custom","--compress=gzip","--schema=auth","--schema=public","--schema=app_private","--schema=storage","--snapshot=00000001-00000001-1"]);assert.equal(session.exited??false,false);children.dump=child;}
    child.stdin.write=(sql,callback)=>{calls.push("begin");nonce=/'nonce','([a-f0-9]{32})'/.exec(sql)?.[1];assert.equal(nonce?.length,32);assert.match(sql,/CASE WHEN e.permitted AND c.kind = 'r'/);queueMicrotask(()=>{child.emit("spawn");callback();child.stdout.write(original(JSON.stringify(startFrame(nonce,control))+"\n"));});return true;};
    child.stdin.end=(sql,callback)=>{calls.push("commit");assert.equal(dumped,true);assert.match(sql,/COMMIT;/);queueMicrotask(()=>{child.stdin.emit("finish");callback();const end={version:1,kind:"target-snapshot-end",nonce,committed:true,databaseName:"postgres",actor:"postgres",sessionActor:"postgres"};control.end?.(end);child.stdout.write(original(JSON.stringify(end)+"\n"));terminal(child);});};
    if(!isSession)queueMicrotask(()=>{child.emit("spawn");child.stdout.write(original(control.dump??binary.database));dumped=true;terminal(child,control.dumpExit??0);});return child;
  }};
  const dependencies={temporaryRoot:context.directory,timeoutMs:2000,targetSnapshotPorts,
    spawnAcl(executable,args,settings){calls.push("acl");assert.equal(Object.keys(settings.env).some(key=>/PG|PASSWORD|SUPABASE|KEY/.test(key)),false);assert.equal(Buffer.from(args[3],"base64").toString("utf16le"),PRIVATE_PATH_ACL_SCRIPT);const child=streamChild();queueMicrotask(()=>{child.stdout.end('{"private":true}');child.stderr.end();setImmediate(()=>child.emit("close",0));});return child;},
    spawnList(executable,args,settings){calls.push("toc");assert.equal(executable,context.env.SC_RESTORE_PG_RESTORE);assert.deepEqual(args,["--list","--verbose"]);assert.equal(Object.keys(settings.env).some(key=>/PG|PASSWORD|SUPABASE|KEY/.test(key)),false);const child=streamChild();children.list=child;child.stdin.destroy=()=>{};child.stdin.end=(database,callback)=>{inputBuffers.push(database);queueMicrotask(()=>{child.emit("spawn");if(control.listInputError)child.stdin.emit("error",Object.assign(Error(CANARY),{code:control.listInputError}));callback();child.stdout.end(original(control.toc??binary.toc));child.stderr.end();setImmediate(()=>child.emit("close",control.listExit??0));});};return child;},
    nativeHistoryPorts:{
      async createLists(options,remaining){calls.push("history-factory");root=options.privateRoot;assert.equal(dirname(root),context.directory);assert.equal(root.startsWith(join(context.directory,"sc-inspect-target-")),true);assert.ok(remaining>0&&remaining<=INSPECTION_LIMITS.timeoutMs);assert.equal(options.powerShellExecutable,join(context.env.SystemRoot,"System32","WindowsPowerShell","v1.0","powershell.exe"));await control.factory?.({children,root});return{
        async materializeList(text){calls.push("history-list");assert.deepEqual(text.split("\n").filter(Boolean).map(line=>Number(line.split(";")[0])),[12,13]);return{path:join(root,"RAM-history-list.toc"),sha256:hash(text),private:true};},
        async removeLists(){calls.push("history-cleanup");await control.cleanup?.({children,root});if(control.cleanupFile)await writeFile(join(root,"unexpected-owned.txt"),CANARY,{flag:"wx"});if(control.cleanupError)throw Error(CANARY);},
      };},
      spawn(executable,args,settings){calls.push("history");assert.equal(executable,context.env.SC_RESTORE_PG_RESTORE);assert.deepEqual(args,["--data-only","--use-list="+join(root,"RAM-history-list.toc"),"--file=-","--restrict-key=SCBaselineV1"]);assert.equal(Object.keys(settings.env).some(key=>/PG|PASSWORD|SUPABASE|KEY/.test(key)),false);const child=streamChild();children.history=child;child.stdin.destroy=()=>{};child.stdin.end=(database,callback)=>{inputBuffers.push(database);queueMicrotask(()=>{child.emit("spawn");child.stdout.end(original(control.history??HISTORY));child.stderr.end();if(control.historyInputError){const error=Object.assign(Error(CANARY),{code:control.historyInputError});child.stdin.emit("error",error);callback(error);}else{child.stdin.emit("finish");callback();}setImmediate(()=>{child.emit("exit",control.historyExit??0);child.emit("close",control.historyExit??0);});});};return child;},
    },
  };
  return{binary,calls,children,originalBuffers,inputBuffers,dependencies,root:()=>root};
}
function hidden(output,context){const text=JSON.stringify(output);for(const token of[CANARY,context.directory,TARGET_SNAPSHOT_NATIVE_PROJECT,"supabase_auth_admin","supabase_storage_admin","00000001-00000001-1","20240101","PGDMP","COPY auth","COPY storage",'"relations"','"dumpIds"','"projectRef"'])assert.equal(text.includes(token),false);}
async function execute(context,control={},env=context.env){const fake=harness(context,control),output=[];if(control.timeoutMs!==undefined)fake.dependencies.timeoutMs=control.timeoutMs;const exit=await runManagedInspect(["inspect-target"],env,value=>output.push(value),fake.dependencies);hidden(output,context);return{fake,output,exit};}
const refused=(result,code,stage)=>{assert.equal(result.exit,1);assert.equal(result.output.length,1);const row=result.output[0];assert.equal(row.ok,false);assert.equal(row.operation,"managed_restore_target_baseline_inspect");assert.equal(row.error,code);assert.equal(row.stage,stage);assert.equal(row.remoteMutation,false);assert.equal(row.baselineCompared,false);assert.equal(row.restoreAccepted,false);assert.equal(Object.hasOwn(row,"format"),false);};

test("target-only CLI needs no archive or backup key and composes genuine B4/B2/B3 stores from synthetic transports",async()=>fixture(async context=>{
  assert.equal(Object.hasOwn(context.env,"SC_BACKUP_ENCRYPTION_KEY"),false);const result=await execute(context);assert.equal(result.exit,0);const out=result.output[0];assert.equal(out.ok,true);assert.equal(out.operation,"managed_restore_target_baseline_inspect");assert.equal(out.transportMode,"synthetic");assert.equal(out.targetQueried,false);assert.equal(out.baselineCompared,false);assert.equal(out.restoreAccepted,false);assert.equal(out.remoteMutation,false);
  assert.deepEqual(out.customToc,{entries:13,preservedEntries:10,encoding:"UTF8",tocBytes:result.fake.binary.tocBytes});assert.deepEqual(out.migrationHistory,{authRows:1,storageRows:1,stdoutBytes:HISTORY.length,inputTerminal:"finish",transportMode:"synthetic"});assert.equal(out.snapshot.authHistoryRows,1);assert.equal(out.snapshot.storageHistoryRows,1);assert.equal(out.snapshot.nativeOrigin,false);
  assert.deepEqual(result.fake.calls.filter(call=>call!=="acl"),["session","begin","dump","commit","toc","history-factory","history-list","history","history-cleanup"]);assert.deepEqual(await readdir(context.directory),[]);
  for(const view of[...result.fake.inputBuffers,...result.fake.originalBuffers])assert.equal(view.every(value=>value===0),true);
}));
test("direct target inspection returns only frozen aggregates and discards all nominal private stores",async()=>fixture(async context=>{
  const fake=harness(context),result=await inspectManagedTargetBaseline(context.env,fake.dependencies);assert.deepEqual(Object.keys(result).sort(),["customToc","format","migrationHistory","snapshot","transportMode"]);for(const part of[result,result.format,result.customToc,result.migrationHistory,result.snapshot])assert.equal(Object.isFrozen(part),true);hidden(result,context);assert.deepEqual(await readdir(context.directory),[]);for(const view of fake.inputBuffers)assert.equal(view.every(value=>value===0),true);
}));
test("target configuration and invalid deadline refuse before temporary paths or injected children",async()=>fixture(async context=>{
  for(const change of[env=>env.SC_RESTORE_ISOLATED="NO",env=>env.SC_RESTORE_CONFIRM_PROJECT="x".repeat(20),env=>delete env.SC_RESTORE_SUPABASE_KEY,env=>env.SC_RESTORE_PGHOST="db.foreign.supabase.co"]){const env={...context.env};change(env);const result=await execute(context,{},env);assert.equal(result.exit,1);assert.equal(result.output[0].stage,"configuration");assert.equal(result.output[0].targetConnectionRequested,false);assert.deepEqual(result.fake.calls,[]);assert.deepEqual(await readdir(context.directory),[]);}
  const deadline=await execute(context,{timeoutMs:0});refused(deadline,"INVALID_ARGUMENTS","configuration");assert.deepEqual(deadline.fake.calls,[]);
}));
test("CLI target mode refuses an archive argument before opening any file or backup environment",async()=>{
  const output=[],exit=await runManagedInspect(["inspect-target",resolve("DO_NOT_OPEN_"+CANARY)],{},value=>output.push(value));assert.equal(exit,1);assert.equal(output[0].error,"INVALID_ARGUMENTS");assert.equal(JSON.stringify(output).includes(CANARY),false);
});
test("target start role, RLS and nonempty-data refusals cannot reach pg_dump, TOC or B3",async()=>fixture(async context=>{
  for(const start of[f=>f.actor="anon",f=>f.rlsBypass=false,f=>f.relations[1].rows=1]){const result=await execute(context,{start});refused(result,"RESTORE_TARGET_SNAPSHOT_NATIVE_PROTOCOL_REFUSED","target_snapshot");assert.equal(result.output[0].targetConnectionRequested,true);for(const call of["dump","commit","toc","history-factory"])assert.equal(result.fake.calls.includes(call),false);assert.deepEqual(await readdir(context.directory),[]);}
}));
test("target dump and COMMIT producer failures stop before TOC and retain closed diagnostics",async()=>fixture(async context=>{
  for(const control of[{dumpExit:1},{end:f=>f.committed=false}]){const result=await execute(context,control);assert.equal(result.exit,1);assert.equal(result.output[0].stage,"target_snapshot");assert.equal(result.output[0].nativeTargetDiagnostic!==null,true);assert.equal(result.fake.calls.includes("toc"),false);assert.deepEqual(await readdir(context.directory),[]);}
}));
test("original native list failure refuses before planning/history and wipes the snapshot copy",async()=>fixture(async context=>{
  for(const [control,code]of[[{listExit:1},"INSPECTION_NATIVE_FAILED"],[{listInputError:"ECONNRESET"},"INSPECTION_INPUT_FAILED"]]){const result=await execute(context,control);refused(result,code,"native_toc");assert.equal(result.fake.calls.includes("history-factory"),false);for(const view of result.fake.inputBuffers)assert.equal(view.every(value=>value===0),true);assert.deepEqual(await readdir(context.directory),[]);}
}));
test("B4 scope and complete binary cross-check refuse before native history",async()=>fixture(async context=>{
  const extra=";     TOC Entries: 14\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n"+binaryFixture().toc.split("; Selected TOC Entries:\n")[1]+"50; 0 0 TABLE public unexpected_app postgres\n";
  const badScope=await execute(context,{toc:extra});refused(badScope,"RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED","plan");assert.equal(badScope.fake.calls.includes("history-factory"),false);
  const mismatch=await execute(context,{wire:{7:{tag:"different_users"}}});refused(mismatch,"RESTORE_CUSTOM_TOC_PLAN_MISMATCH","custom_toc");assert.equal(mismatch.fake.calls.includes("history-factory"),false);assert.deepEqual(await readdir(context.directory),[]);
}));
test("both B3 histories must agree with the held snapshot row counts",async()=>fixture(async context=>{
  for(const index of[0,2]){const result=await execute(context,{start:f=>f.relations[index].rows=2});refused(result,"INSPECTION_SNAPSHOT_CHANGED","native_history");assert.equal(result.fake.calls.includes("history-cleanup"),true);assert.deepEqual(await readdir(context.directory),[]);}
}));
test("B3 parser and cleanup failures stay closed and do not publish partial aggregates",async()=>fixture(async context=>{
  const parser=await execute(context,{history:Buffer.from("PRIVATE_BAD_BANNER_"+CANARY)});refused(parser,"RESTORE_MIGRATION_HISTORY_NATIVE_PARSER_REFUSED","native_history");assert.equal(parser.output[0].nativeHistoryDiagnostic.phase,"parse");assert.equal(parser.output[0].nativeHistoryDiagnostic.parserError,"RESTORE_MIGRATION_HISTORY_FORMAT_UNSUPPORTED");assert.deepEqual(await readdir(context.directory),[]);
  const cleaning=await execute(context,{cleanupError:true});refused(cleaning,"RESTORE_MIGRATION_HISTORY_NATIVE_CLEANUP_FAILED","native_history");assert.equal(cleaning.output[0].nativeHistoryDiagnostic.cleanup,"failed");assert.deepEqual(await readdir(context.directory),[]);
}));
test("late original list errors during history retain priority over wrapper timeout and cleanup",async()=>fixture(async context=>{
  for(const [phase,code]of[["factory","INSPECTION_NATIVE_FAILED"],["cleanup","INSPECTION_INPUT_FAILED"]]){const fault=({children})=>{if(phase==="factory")children.list.stderr.emit("error",Error(CANARY));else children.list.stdin.emit("error",Object.assign(Error(CANARY),{code:"ECONNRESET"}));};const result=await execute(context,{[phase]:fault});refused(result,code,"native_history");assert.deepEqual(await readdir(context.directory),[]);}
}));
test("late original snapshot/history failures still veto a nominally completed pipeline",async()=>fixture(async context=>{
  for(const which of["snapshot","history"]){const result=await execute(context,{cleanup:({children})=>queueMicrotask(()=>{if(which==="snapshot")children.session.emit("error",Error(CANARY));else children.history.stdin.emit("error",Object.assign(Error(CANARY),{code:"ECONNRESET"}));})});assert.equal(result.exit,1);assert.equal(result.output[0].restoreAccepted,false);assert.equal(Object.hasOwn(result.output[0],"format"),false);assert.deepEqual(await readdir(context.directory),[]);for(const view of result.fake.inputBuffers)assert.equal(view.every(value=>value===0),true);}
}));
test("unexpected owned file blocks outer cleanup; a prior parser failure keeps first refusal",async()=>fixture(async context=>{
  const result=await execute(context,{cleanupFile:true});refused(result,"INSPECTION_CLEANUP_FAILED","cleanup");assert.equal((await readdir(context.directory)).length,1);
  const prior=await execute(context,{cleanupFile:true,history:Buffer.from("INVALID_"+CANARY)});refused(prior,"RESTORE_MIGRATION_HISTORY_NATIVE_PARSER_REFUSED","native_history");assert.equal((await readdir(context.directory)).length,2);
}));
test("one inherited absolute timeout covers the target extraction and does not permit a resumed late success",async()=>fixture(async context=>{
  const result=await execute(context,{timeoutMs:200,factory:async()=>{await new Promise(resolve=>setTimeout(resolve,240));}});assert.equal(result.exit,1);assert.equal(result.output[0].stage,"native_history");assert.equal(result.output[0].restoreAccepted,false);assert.equal(result.fake.calls.includes("history-factory"),true);assert.equal(result.fake.calls.includes("history"),false);await new Promise(resolve=>setTimeout(resolve,80));assert.equal(result.output.length,1);assert.equal(result.output[0].ok,false);assert.deepEqual(await readdir(context.directory),[]);
}));
test("dispatcher source has target-only operation without archive requirement or encryption settings",async()=>{
  const source=await readFile(new URL("../../scripts/operations/run-operator.ps1",import.meta.url),"utf8");assert.match(source,/elseif\(\$Operation -eq 'restore-inspect-target'\)\{'inspect-target'\}/);assert.match(source,/elseif\(\$Archive\)\{throw 'UNEXPECTED_ARCHIVE'\}/);const requiring=/if\(\$Operation -in @\(([^)]*)\)\)\{if\(-not \$Archive\)/.exec(source);assert.ok(requiring);assert.equal(requiring[1].includes("restore-inspect-target"),false);
});
