import test, { after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { mkdtemp, lstat, readdir, rmdir, unlink, writeFile, readFile } from "node:fs/promises";
import { join, resolve, dirname, relative } from "node:path";
import { defaultInspectionTemporaryRoot, inspectManagedTargetInventory, runManagedInspect, PRIVATE_PATH_ACL_SCRIPT } from "../../scripts/operations/restore-managed-inspect.mjs";
import { TARGET_SNAPSHOT_NATIVE_PROJECT } from "../../scripts/operations/restore-target-snapshot-native.mjs";
import { planManagedTargetBaseline, planManagedTargetInspection, managedTargetBaselineRequirements, managedTargetInspectionRequirements } from "../../scripts/operations/restore-managed-plan.mjs";
import { extractCustomTargetToc, extractCustomTargetInspectionToc, customArchiveTocFacts, customTargetInspectionTocFacts, discardCustomArchiveToc, discardCustomTargetInspectionToc } from "../../scripts/operations/restore-custom-toc.mjs";
import { migrationHistoryCopySelection } from "../../scripts/operations/restore-migration-history.mjs";

// Artificial exclusive temporary directories plus RAM EventEmitter/stream
// transports only. No original archive/profile, SQL engine, PS/PG process,
// network, private credentials, native list or native target is accessed.
const CANARY = "PRIVATE_TARGET_INVENTORY_CANARY", hash = bytes => createHash("sha256").update(bytes).digest("hex");
const ROWS = [
  [1,"ENCODING","-","ENCODING","",[]],[2,"STDSTRINGS","-","STDSTRINGS","",[]],[3,"SEARCHPATH","-","SEARCHPATH","",[]],
  [4,"SCHEMA","-","auth","supabase_auth_admin",[]],[5,"SCHEMA","-","storage","supabase_storage_admin",[]],[6,"SCHEMA","-","public","pg_database_owner",[]],
  [7,"TABLE","auth","users","supabase_auth_admin",[4]],[8,"TABLE","storage","objects","supabase_storage_admin",[5]],[9,"TABLE","storage","buckets","supabase_storage_admin",[5]],
  [10,"TABLE","auth","schema_migrations","supabase_auth_admin",[4]],[11,"TABLE","storage","migrations","supabase_storage_admin",[5]],
  [12,"TABLE DATA","auth","schema_migrations","supabase_auth_admin",[10]],[13,"TABLE DATA","storage","migrations","supabase_storage_admin",[11]],
  [14,"FUNCTION","public","inventory_canary(integer, text)","postgres",[6]],
  [15,"ACL","public","FUNCTION inventory_canary(integer, text)","postgres",[14]],
  [16,"DEFAULT ACL","public","DEFAULT PRIVILEGES FOR FUNCTIONS","postgres",[6]],
];
function binaryFixture(options = {}) {
  const rows = options.baseline ? ROWS.slice(0, 13) : ROWS;
  const int = value => { const out=Buffer.alloc(5);out[0]=value<0?1:0;out.writeUInt32LE(Math.abs(value),1);return out; };
  const string = value => value===null?int(-1):Buffer.concat([int(Buffer.byteLength(value)),Buffer.from(value)]);
  const parts = [Buffer.from([80,71,68,77,80,1,16,0,4,8,1,1]),...[0,0,0,16,9,126,0].map(int),string("postgres"),string("17.6"),string("18.4"),int(rows.length)];
  for (const [id,kind,schema,tag,owner,dependencies] of rows) {
    const selected={tag,namespace:schema==="-"?null:schema,owner,...options.wire?.[id]};
    const definition=kind==="ENCODING"?"SET client_encoding = 'UTF8';\n":kind==="STDSTRINGS"?"SET standard_conforming_strings = 'on';\n":kind==="SEARCHPATH"?"SELECT pg_catalog.set_config('search_path', '', false);\n":kind==="TABLE DATA"?null:"-- "+CANARY+"\n";
    const section=kind==="TABLE DATA"?3:kind==="ACL"?1:kind==="DEFAULT ACL"?4:2;
    parts.push(int(id),int(kind==="TABLE DATA"?1:0),string("0"),string("0"),string(selected.tag),string(kind),int(section),string(definition),string(null),string(id===12?"COPY auth.schema_migrations (version) FROM stdin;\n":id===13?"COPY storage.migrations (id, name, hash, executed_at) FROM stdin;\n":null),string(selected.namespace),string(null),string(null),int(kind==="TABLE"?114:0),string(selected.owner),string("false"),...dependencies.map(value=>string(String(value))),string(null),Buffer.from([kind==="TABLE DATA"?1:3]),Buffer.alloc(8));
  }
  const tocBytes=parts.reduce((sum,part)=>sum+part.length,0),database=Buffer.concat([...parts,Buffer.from("ARTIFICIAL_UNPARSED_DATA_"+CANARY)]);
  const toc=";     TOC Entries: "+rows.length+"\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n"+rows.map(([id,kind,schema,tag,owner,deps])=>`${id}; 0 0 ${kind} ${schema} ${tag} ${owner}\n`+(deps.length?";\tdepends on: "+deps.join(" ")+"\n":"")).join("");
  return {database,toc,tocBytes};
}
const binding = binary => ({projectRef:TARGET_SNAPSHOT_NATIVE_PROJECT,databaseName:"postgres",nativeDumpSha256:hash(binary.database),nativeDumpBytes:binary.database.length});
const baseEnv = () => ({SystemRoot:process.env.SystemRoot??resolve("RAM/system-root"),PATH:process.env.PATH,
  SC_RESTORE_PROJECT_REF:TARGET_SNAPSHOT_NATIVE_PROJECT,SC_RESTORE_CONFIRM_PROJECT:TARGET_SNAPSHOT_NATIVE_PROJECT,SC_RESTORE_ISOLATED:"YES",SC_RESTORE_SUPABASE_URL:"https://"+TARGET_SNAPSHOT_NATIVE_PROJECT+".supabase.co",SC_RESTORE_SUPABASE_KEY:"sb_secret_"+CANARY,
  SC_RESTORE_PG_RESTORE:resolve("RAM-not-installed/pg_restore.exe"),SC_RESTORE_PSQL:resolve("RAM-not-installed/psql.exe"),SC_RESTORE_PGHOST:"db."+TARGET_SNAPSHOT_NATIVE_PROJECT+".supabase.co",SC_RESTORE_PGPORT:"5432",SC_RESTORE_PGUSER:"postgres",SC_RESTORE_PGDATABASE:"postgres",SC_RESTORE_PGPASSWORD:CANARY,SC_RESTORE_PGSSLMODE:"require"});
const originalFetch=globalThis.fetch;let networkCalls=0;
globalThis.fetch=()=>{networkCalls++;throw Error("NETWORK_FORBIDDEN");};
after(()=>{globalThis.fetch=originalFetch;assert.equal(networkCalls,0);});
async function fixture(action) {
  const temporary=await defaultInspectionTemporaryRoot(),directory=await mkdtemp(join(temporary,"sc-target-inventory-fixture-")),lease=await lstat(directory);
  try { return await action({directory,env:baseEnv()}); }
  finally {
    const current=await lstat(directory);assert.equal(current.dev,lease.dev);assert.equal(current.ino,lease.ino);assert.equal(current.birthtimeMs,lease.birthtimeMs);assert.equal(directory.startsWith(join(temporary,"sc-target-inventory-fixture-")),true);
    for(const name of await readdir(directory)){const owned=join(directory,name);assert.equal(dirname(owned),directory);assert.equal(relative(directory,owned),name);assert.equal(name.startsWith("sc-inspect-target-"),true);const stat=await lstat(owned);assert.equal(stat.isDirectory()&&!stat.isSymbolicLink(),true);for(const child of await readdir(owned)){assert.equal(child,"unexpected-owned.txt");await unlink(join(owned,child));}await rmdir(owned);}
    await rmdir(directory);
  }
}
function startFrame(nonce, control) {
  const relation=(oid,schema,name,rows)=>({oid,schemaOid:schema==="auth"?10:20,schema,name,kind:"r",extensionMember:false,extensionConfig:false,isPartition:false,hasInheritance:false,rowSecurityActive:false,rows});
  const frame={version:1,kind:"target-snapshot-start",nonce,snapshotId:"00000001-00000001-1",databaseName:"postgres",actor:"postgres",sessionActor:"postgres",readOnly:true,isolation:"repeatable read",rowSecurityOff:true,rlsBypass:true,catalogueComplete:true,catalogueCount:5,schemas:[{name:"auth",oid:10},{name:"storage",oid:20},{name:"public",oid:30},{name:"app_private",oid:null}],relations:[relation(100,"auth","schema_migrations",1),relation(101,"auth","users",0),relation(102,"storage","migrations",1),relation(103,"storage","objects",0),relation(104,"storage","buckets",0)]};
  control.start?.(frame);return frame;
}
function harness(context,control={}) {
  const binary=binaryFixture(control),calls=[],originalBuffers=[],inputBuffers=[],children={};let nonce,session,dumped=false;
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
    spawnList(executable,args,settings){calls.push("toc");assert.equal(executable,context.env.SC_RESTORE_PG_RESTORE);assert.deepEqual(args,["--list","--verbose"]);assert.equal(Object.keys(settings.env).some(key=>/PG|PASSWORD|SUPABASE|KEY/.test(key)),false);const child=streamChild();children.list=child;child.stdin.destroy=()=>{};
      child.stdin.end=(database,callback)=>{inputBuffers.push(database);queueMicrotask(async()=>{child.emit("spawn");if(control.listInputError)child.stdin.emit("error",Object.assign(Error(CANARY),{code:control.listInputError}));callback();if(control.cleanupFile){const current=(await readdir(context.directory)).filter(name=>!control.priorDirectories.has(name));assert.equal(current.length,1);await writeFile(join(context.directory,current[0],"unexpected-owned.txt"),CANARY,{flag:"wx"});}if(control.listDelayMs)await new Promise(resolve=>setTimeout(resolve,control.listDelayMs));child.stdout.end(original(control.toc??binary.toc));child.stderr.end();setImmediate(()=>{child.emit("close",control.listExit??0);if(control.lateFault)queueMicrotask(()=>{const target=control.lateFault==="snapshot"?children.session:child;target.emit("error",Error(CANARY));});});});};return child;},
    nativeHistoryPorts:{createLists(){calls.push("FORBIDDEN_HISTORY");throw Error(CANARY);},spawn(){calls.push("FORBIDDEN_HISTORY");throw Error(CANARY);}},
    inspectionOnly:false,
  };
  return {binary,calls,children,originalBuffers,inputBuffers,dependencies};
}
function hidden(output,context){const text=JSON.stringify(output);for(const token of[CANARY,context.directory,TARGET_SNAPSHOT_NATIVE_PROJECT,"supabase_auth_admin","supabase_storage_admin","inventory_canary","DEFAULT PRIVILEGES","00000001-00000001-1","PGDMP","COPY auth","COPY storage",'"relations"','"dumpIds"','"projectRef"','"owner"','"definition"'])assert.equal(text.includes(token),false);}
async function execute(context,control={},argv=["inspect-target-inventory"],env=context.env){const priorDirectories=new Set(await readdir(context.directory)),fake=harness(context,{...control,priorDirectories}),output=[];if(control.timeoutMs!==undefined)fake.dependencies.timeoutMs=control.timeoutMs;const exit=await runManagedInspect(argv,env,value=>output.push(value),fake.dependencies);hidden(output,context);return {fake,output,exit};}
function refused(result,code,stage){assert.equal(result.exit,1);assert.equal(result.output.length,1);const row=result.output[0];assert.equal(row.ok,false);assert.equal(row.operation,"managed_restore_target_inventory_inspect");assert.equal(row.error,code);assert.equal(row.stage,stage);assert.equal(row.inspectionOnly,true);assert.equal(row.baselineQualified,false);assert.equal(row.baselineCompared,false);assert.equal(row.restoreAccepted,false);assert.equal(row.remoteMutation,false);assert.equal(Object.hasOwn(row,"format"),false);}

test("inventory-only CLI observes full public FUNCTION/ACL/default ACL without archive/key/B3/A2",async()=>fixture(async context=>{
  assert.equal(Object.hasOwn(context.env,"SC_BACKUP_ENCRYPTION_KEY"),false);const result=await execute(context);assert.equal(result.exit,0);const out=result.output[0];assert.equal(out.operation,"managed_restore_target_inventory_inspect");assert.equal(out.transportMode,"synthetic");assert.equal(out.targetQueried,false);assert.equal(out.inspectionOnly,true);assert.equal(out.baselineQualified,false);assert.equal(out.baselineCompared,false);assert.equal(out.restoreAccepted,false);assert.equal(out.remoteMutation,false);
  assert.deepEqual(out.customToc,{entries:16,encoding:"UTF8",tocBytes:result.fake.binary.tocBytes});assert.equal(out.inventory.headersValid,true);assert.equal(out.inventory.countObserved,16);assert.equal(out.inventory.unknownClassCount,0);assert.equal(out.inventory.malformedRowCount,0);assert.equal(out.inventory.classes.some(row=>row.kind==="FUNCTION"&&row.count===1),true);assert.equal(out.inventory.classes.some(row=>row.kind==="DEFAULT ACL"&&row.scopes[0].category==="app"),true);assert.equal(Object.hasOwn(out,"migrationHistory"),false);assert.equal(Object.hasOwn(out.customToc,"preservedEntries"),false);
  assert.deepEqual(result.fake.calls.filter(call=>call!=="acl"),["session","begin","dump","commit","toc"]);assert.deepEqual(await readdir(context.directory),[]);for(const view of[...result.fake.originalBuffers,...result.fake.inputBuffers])assert.equal(view.every(value=>value===0),true);
}));
test("public aggregate result is frozen and does not qualify migration row contents",async()=>fixture(async context=>{
  const fake=harness(context),result=await inspectManagedTargetInventory(context.env,fake.dependencies);assert.deepEqual(Object.keys(result).sort(),["baselineCompared","baselineQualified","customToc","format","inspectionOnly","inventory","restoreAccepted","snapshot","transportMode"]);for(const part of[result,result.format,result.snapshot,result.customToc,result.inventory,result.inventory.classes,...result.inventory.classes])assert.equal(Object.isFrozen(part),true);assert.equal(result.snapshot.authHistoryRows,1);assert.equal(result.snapshot.storageHistoryRows,1);assert.equal(Object.hasOwn(result,"migrationHistory"),false);hidden(result,context);assert.deepEqual(await readdir(context.directory),[]);
}));
test("baseline wrapper still refuses the identical public metadata and cannot be changed by dependency flag",async()=>fixture(async context=>{
  const result=await execute(context,{},["inspect-target"]);assert.equal(result.exit,1);assert.equal(result.output[0].operation,"managed_restore_target_baseline_inspect");assert.equal(result.output[0].error,"RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED");assert.equal(result.output[0].stage,"plan");assert.equal(result.fake.calls.includes("FORBIDDEN_HISTORY"),false);
}));
test("inspection and baseline plans/TOC handles remain nominally disjoint and independently discarded",()=>{
  const full=binaryFixture(),minimal=binaryFixture({baseline:true}),inspection=planManagedTargetInspection(full.toc,binding(full)),baseline=planManagedTargetBaseline(minimal.toc,binding(minimal));
  assert.throws(()=>managedTargetBaselineRequirements(inspection),{code:"RESTORE_MANAGED_TARGET_BASELINE_REQUIRED"});assert.throws(()=>managedTargetInspectionRequirements(baseline),{code:"RESTORE_MANAGED_TARGET_INSPECTION_REQUIRED"});assert.throws(()=>extractCustomTargetToc(inspection,full.database),{code:"RESTORE_CUSTOM_TOC_TARGET_REQUIRED"});assert.throws(()=>extractCustomTargetInspectionToc(baseline,minimal.database),{code:"RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED"});
  const ih=extractCustomTargetInspectionToc(inspection,full.database),bh=extractCustomTargetToc(baseline,minimal.database),facts=customTargetInspectionTocFacts(ih);assert.equal(facts.binding.side,"target-inspection");assert.equal(Object.hasOwn(facts,"preserved"),false);assert.equal(facts.records.length,16);assert.throws(()=>customArchiveTocFacts(ih),{code:"RESTORE_CUSTOM_TOC_REQUIRED"});assert.throws(()=>customTargetInspectionTocFacts(bh),{code:"RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED"});assert.throws(()=>migrationHistoryCopySelection(ih));assert.equal(discardCustomArchiveToc(ih),false);assert.equal(discardCustomTargetInspectionToc(bh),false);assert.equal(customTargetInspectionTocFacts(ih).records.length,16);assert.equal(discardCustomTargetInspectionToc(ih),true);assert.equal(discardCustomTargetInspectionToc(ih),false);assert.throws(()=>customTargetInspectionTocFacts(ih),{code:"RESTORE_CUSTOM_TOC_DISCARDED"});assert.equal(customArchiveTocFacts(bh).records.length,13);assert.equal(discardCustomArchiveToc(bh),true);full.database.fill(0);minimal.database.fill(0);
});
test("invalid target configuration/deadline refuses before directory, snapshot or list",async()=>fixture(async context=>{
  for(const change of[env=>env.SC_RESTORE_ISOLATED="NO",env=>delete env.SC_RESTORE_SUPABASE_KEY,env=>env.SC_RESTORE_PGHOST="db.foreign.supabase.co"]){const env={...context.env};change(env);const result=await execute(context,{},undefined,env);assert.equal(result.exit,1);assert.equal(result.output[0].stage,"configuration");assert.equal(result.output[0].targetConnectionRequested,false);assert.deepEqual(result.fake.calls,[]);}
  const invalid=await execute(context,{timeoutMs:0});refused(invalid,"INVALID_ARGUMENTS","configuration");assert.deepEqual(invalid.fake.calls,[]);assert.deepEqual(await readdir(context.directory),[]);
}));
test("snapshot role/RLS/nonempty gates still precede pg_dump even in inventory mode",async()=>fixture(async context=>{
  for(const start of[f=>f.actor="anon",f=>f.rlsBypass=false,f=>f.relations[1].rows=1]){const result=await execute(context,{start});refused(result,"RESTORE_TARGET_SNAPSHOT_NATIVE_PROTOCOL_REFUSED","target_snapshot");assert.equal(result.output[0].targetConnectionRequested,true);assert.equal(result.fake.calls.includes("dump"),false);assert.equal(result.fake.calls.includes("toc"),false);assert.deepEqual(await readdir(context.directory),[]);}
}));
test("dump/commit producer failures cannot publish partial inventory",async()=>fixture(async context=>{
  for(const control of[{dumpExit:1},{end:f=>f.committed=false}]){const result=await execute(context,control);assert.equal(result.exit,1);assert.equal(result.output[0].stage,"target_snapshot");assert.equal(result.output[0].nativeTargetDiagnostic!==null,true);assert.equal(result.fake.calls.includes("toc"),false);assert.deepEqual(await readdir(context.directory),[]);}
}));
test("original list EOF/close/input refusal does not become an inventory",async()=>fixture(async context=>{
  for(const [control,code]of[[{listExit:1},"INSPECTION_NATIVE_FAILED"],[{listInputError:"ECONNRESET"},"INSPECTION_INPUT_FAILED"]]){const result=await execute(context,control);refused(result,code,"native_toc");for(const view of result.fake.inputBuffers)assert.equal(view.every(value=>value===0),true);assert.deepEqual(await readdir(context.directory),[]);}
}));
test("all-row binary cross-check rejects a swapped full FUNCTION instead of filtering it",async()=>fixture(async context=>{
  const result=await execute(context,{wire:{14:{tag:"substituted_canary(integer, text)"}}});refused(result,"RESTORE_CUSTOM_TOC_PLAN_MISMATCH","custom_toc");assert.deepEqual(await readdir(context.directory),[]);
}));
test("unknown class, malformed tail and unsupported producer stay closed",async()=>fixture(async context=>{
  for(const toc of[binaryFixture().toc.replace("FUNCTION public inventory_canary","PRIVATE_CLASS public inventory_canary"),binaryFixture().toc.replace("DEFAULT PRIVILEGES FOR FUNCTIONS","invalid;tag"),binaryFixture().toc.replace("pg_dump version: 18.4","pg_dump version: 17.6")]){const result=await execute(context,{toc});assert.equal(result.exit,1);assert.equal(result.output[0].stage,"plan");assert.equal(Object.hasOwn(result.output[0],"inventory"),false);assert.deepEqual(await readdir(context.directory),[]);}
}));
test("late original list/snapshot faults veto completion across asynchronous cleanup",async()=>fixture(async context=>{
  for(const lateFault of["list","snapshot"]){const result=await execute(context,{lateFault});assert.equal(result.exit,1);assert.equal(result.output[0].restoreAccepted,false);assert.equal(Object.hasOwn(result.output[0],"format"),false);assert.deepEqual(await readdir(context.directory),[]);for(const view of result.fake.inputBuffers)assert.equal(view.every(value=>value===0),true);}
}));
test("unexpected owned file refuses cleanup and preserves the first list failure",async()=>fixture(async context=>{
  const clean=await execute(context,{cleanupFile:true});refused(clean,"INSPECTION_CLEANUP_FAILED","cleanup");assert.equal((await readdir(context.directory)).length,1);const first=await execute(context,{cleanupFile:true,listExit:1});refused(first,"INSPECTION_NATIVE_FAILED","native_toc");assert.equal((await readdir(context.directory)).length,2);
}));
test("inherited absolute timeout also bounds the original target list without renewed inventory budget",async()=>fixture(async context=>{
  const result=await execute(context,{timeoutMs:200,listDelayMs:240});assert.equal(result.exit,1);assert.equal(result.output[0].stage,"native_toc");assert.equal(result.output[0].restoreAccepted,false);await new Promise(resolve=>setTimeout(resolve,80));assert.equal(result.output.length,1);assert.deepEqual(await readdir(context.directory),[]);
}));
test("CLI rejects archive and malformed inventory argv without opening source/profile or target",async()=>{
  for(const argv of[["inspect-target-inventory",resolve("DO_NOT_OPEN_"+CANARY)],["inspect-target-inventory","extra","extra"],"inspect-target-inventory"]){const output=[],exit=await runManagedInspect(argv,{},value=>output.push(value));assert.equal(exit,1);assert.equal(output[0].error,"INVALID_ARGUMENTS");assert.equal(JSON.stringify(output).includes(CANARY),false);assert.equal(output[0].restoreAccepted,false);}
});
test("dispatcher gives inventory one native argv and rejects an optional archive",async()=>{
  const source=await readFile(new URL("../../scripts/operations/run-operator.ps1",import.meta.url),"utf8");assert.match(source,/elseif\(\$Operation -eq 'restore-inspect-target-inventory'\)\{'inspect-target-inventory'\}/);const requiring=/if\(\$Operation -in @\(([^)]*)\)\)\{if\(-not \$Archive\)/.exec(source);assert.ok(requiring);assert.equal(requiring[1].includes("restore-inspect-target-inventory"),false);assert.match(source,/elseif\(\$Archive\)\{throw 'UNEXPECTED_ARCHIVE'\}/);
});
