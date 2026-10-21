import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { planManagedRestore, managedRestoreRequirements, authorizeManagedRestore } from "../../scripts/operations/restore-managed-plan.mjs";
import { runManagedRestore } from "../../scripts/operations/restore-managed-stream.mjs";
import { mintManagedSnapshot } from "../../scripts/operations/restore-managed-snapshot-capability.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";
import { createManagedRestoreAdapters, checkManagedBeforeCommit, validateManagedValidation, PRIVATE_TOC_ACL_HELPER, PRIVATE_TOC_ACL_HELPER_SHA256, MANAGED_ADAPTER_DEADLINE_MS } from "../../scripts/operations/restore-managed-native-adapters.mjs";
import { MANAGED_VALIDATION_SQL } from "../../scripts/operations/restore-managed-validation-sql.mjs";

test("complete managed-stream integration keeps one native consumer, checks its original result before COMMIT, and cleans only its five lists",async()=>{
 const data=Buffer.from("PGDMP_FAKE_PROTOCOL_ONLY"),binding={archiveSha256:"a".repeat(64),databaseSha256:hash(data),databaseBytes:data.length};
 const rows=[[1,"SCHEMA","-","auth","auth_owner",[]],[2,"SCHEMA","-","storage","storage_owner",[]],[3,"SCHEMA","-","app_private","postgres",[]],[4,"TABLE","auth","users","auth_owner",[1]],[5,"TABLE","storage","objects","storage_owner",[2]],[6,"TABLE","storage","buckets","storage_owner",[2]],[7,"TABLE DATA","auth","users","auth_owner",[4]],[8,"TABLE","public","profiles","postgres",[4]],[9,"TABLE DATA","public","profiles","postgres",[8]],[10,"TRIGGER","auth","users second_brain_identity_created","postgres",[4]],[11,"TRIGGER","auth","users second_brain_admin_creation_final","postgres",[4]],[12,"POLICY","storage","objects second_brain_private_objects","storage_owner",[5]],[13,"POLICY","storage","buckets second_brain_private_buckets","storage_owner",[6]]];
 const toc=";     TOC Entries: 13\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n"+rows.map(([id,type,schema,tag,owner,deps])=>id+"; 0 0 "+type+" "+schema+" "+tag+" "+owner+"\n"+(deps.length?";\tdepends on: "+deps.join(" ")+"\n":"")).join("");
 const scope={identityTrigger:["auth","users","CREATE TRIGGER"],adminTrigger:["auth","users","CREATE CONSTRAINT TRIGGER"],objectsPolicy:["storage","objects","CREATE POLICY"],bucketsPolicy:["storage","buckets","CREATE POLICY"]};
 const history=()=>({auth:[{version:"fixture"}],storage:[{id:0,name:"fixture",hash:"a".repeat(40),executed_at:null}]});
 const ref="abcdefghijklmnopqrst",env={SC_RESTORE_PROJECT_REF:ref,SC_RESTORE_CONFIRM_PROJECT:ref,SC_RESTORE_ISOLATED:"YES",SC_RESTORE_SUPABASE_URL:"https://"+ref+".supabase.co",SC_RESTORE_SUPABASE_KEY:"sb_secret_"+canary,SC_RESTORE_PG_RESTORE:resolve("/fake-pg_restore"),SC_RESTORE_PSQL:resolve("/fake-psql"),SC_RESTORE_PGHOST:"db."+ref+".supabase.co",SC_RESTORE_PGUSER:"postgres",SC_RESTORE_PGDATABASE:"postgres",SC_RESTORE_PGPASSWORD:canary,SC_RESTORE_PGSSLMODE:"require"};
 // Supplied authority facts and native children below are deliberately FAKE RAM.
 // No hosted schema, original archive or Windows ACL proof is certified here.
 for(const scenario of ["success","producerFail","missingAck"]){
  const plan=planManagedRestore(toc,binding),authorization=authorizeManagedRestore(plan,{...binding,tocSha256:managedRestoreRequirements(plan).tocSha256,nativeSqlControlQualified:true,actor:"postgres",sameActor:true,allTargetsEmpty:true,baselineMatchesArchive:true,baselineOwnerAclMatchesArchive:true,appOwnerAclCanBeRestored:true,dataCopyCanUseOperator:true,replicaCanUseOperator:{actor:"postgres",setLocalObserved:true,readback:"replica",rollbackObserved:true},referencesCanBeVerified:true,managedMigrationHistories:{archive:history(),target:history()},customRoles:Object.fromEntries(Object.entries(scope).map(([key,[schema,table,operation]])=>[key,{mode:"currentActor",actor:"postgres",schema,table,operation,canCreate:true}]))});
  const snapshot=mintManagedSnapshot(plan,{database:data,sourceProjectRef:PERSONAL_REF,keyId:"fixture-v1",createdAt:"2026-10-16T00:00:00Z",lifetimeMs:60000});
  const ram=ramFs(),writes=[],native=[],order=[];let producerIndex=0;
  ram.ports.spawn=(exe,args,settings)=>{
   const value=child();native.push({exe,args,settings});
   if(exe===env.SC_RESTORE_PSQL){
    value.stdin.on("data",bytes=>{
     const text=bytes.toString();writes.push(text);
     if(text.startsWith("\\echo SC_MANAGED_BEGIN:")){
      order.push("validation");
      const lines=text.trimEnd().split("\n"),first=lines[0].slice("\\echo ".length),last=lines.at(-1).slice("\\echo ".length);
      value.stdout.write(first+"\nSET\nDO\n"+JSON.stringify(report())+"\n"+last+"\n");
     }
     if(text==="COMMIT;\n"){order.push("commit");if(scenario!=="missingAck")value.stdout.write("COMMIT\n");}
    });
    value.stdin.once("finish",()=>{value.stdout.end();queueMicrotask(()=>value.emit("close",0));});
   }else{
    const index=producerIndex++;value.stdin.on("data",bytes=>assert.equal(hash(bytes),binding.databaseSha256));
    queueMicrotask(()=>{value.stderr.end(canary);value.stdout.end("-- FAKE_NATIVE_SQL_ONLY_"+index+"\n");order.push("producer"+index);value.emit("close",scenario==="producerFail"&&index===0?1:0);});
   }
   return value;
  };
  const adapters=await createManagedRestoreAdapters(options(),ram.ports);
  const outcome=await runManagedRestore({plan,authorization,env,snapshot},adapters);
  assert.equal(outcome.ok,scenario==="success");assert.equal(outcome.restoreAccepted,false);assert.equal(JSON.stringify(outcome).includes(canary),false);
  assert.equal(native.filter(call=>call.exe===env.SC_RESTORE_PSQL).length,1);assert.deepEqual([...ram.entries.keys()],[RAM_PARENT,RAM_ROOT]);
  if(scenario==="producerFail"){assert.equal(order.includes("validation"),false);assert.equal(order.includes("commit"),false);assert.equal(outcome.error,"RESTORE_MANAGED_PRODUCER_FAILED");}
  else{assert.equal(order.indexOf("validation")>order.indexOf("producer4"),true);assert.equal(order.indexOf("commit")>order.indexOf("validation"),true);}
  assert.equal(writes.some(text=>text.includes("SET LOCAL ROLE")),false);
  for(const call of native.filter(call=>call.exe===env.SC_RESTORE_PG_RESTORE))for(const forbidden of ["--clean","--no-owner","--no-acl"])assert.equal(call.args.includes(forbidden),false);
 }
});


const canary="PRIVATE_ADAPTER_CANARY", nonce="a".repeat(32), hash=value=>createHash("sha256").update(value).digest("hex");
const report=change=>({version:1,sameActor:true,replicationOrigin:true,catalogueOk:true,catalogueChecks:1350,catalogueDeviations:0,foreignKeysChecked:80,foreignKeyViolations:0,...change});
const error=code=>Object.assign(new Error(canary),{code});
const originalFetch=globalThis.fetch;
let network=0;
globalThis.fetch=()=>{network++;throw Error("NETWORK_FORBIDDEN");};
after(()=>{globalThis.fetch=originalFetch;assert.equal(network,0);});
const RAM_PARENT=resolve("/"),RAM_ROOT=resolve("/SecondBrainAdapterRAM");
const options=()=>({privateRoot:RAM_ROOT,powerShellExecutable:resolve("/RAM-tools/pwsh.exe"),systemRoot:resolve("/Windows"),forbiddenRoots:[],syncRoots:[]});
function ramFs(){
 let inode=2;const entries=new Map([[RAM_PARENT,{type:"dir",ino:1}],[RAM_ROOT,{type:"dir",ino:inode++}]]),calls=[];
 const stat=entry=>({dev:1,ino:entry.ino,isSymbolicLink:()=>entry.type==="symlink",isDirectory:()=>entry.type==="dir",isFile:()=>entry.type==="file"});
 const get=path=>{if(!entries.has(path))throw error("ENOENT");return entries.get(path);};
 const fs={
  async lstat(path){calls.push(["lstat",path]);return stat(get(path));},
  async mkdir(path,settings){calls.push(["mkdir",path,settings]);if(entries.has(path))throw error("EEXIST");get(dirname(path));entries.set(path,{type:"dir",ino:inode++});},
  async open(path,flags,mode){calls.push(["open",path,flags,mode]);assert.equal(flags,"wx");assert.equal(mode,0o600);if(entries.has(path))throw error("EEXIST");get(dirname(path));const entry={type:"file",ino:inode++,text:""};entries.set(path,entry);return{async stat(){return stat(entry);},async writeFile(text){calls.push(["write",path,text]);entry.text=text;},async sync(){calls.push(["sync",path]);},async close(){calls.push(["close",path]);}};},
  async readFile(path){calls.push(["read",path]);return Buffer.from(get(path).text);},
  async unlink(path){calls.push(["unlink",path]);get(path);entries.delete(path);},
  async rmdir(path){calls.push(["rmdir",path]);get(path);if([...entries.keys()].some(key=>key!==path&&dirname(key)===path))throw error("ENOTEMPTY");entries.delete(path);}
 };
 let random=0;
 const ports={fs,safeDirectory:async value=>value,randomBytes:()=>Buffer.alloc(16,++random),proveAcl:async(path,mode)=>{calls.push(["acl",path,mode]);}};
 return{entries,calls,ports};
}
const child=()=>Object.assign(new EventEmitter(),{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),kill(){this.killed=true;},unref(){}});
const frame=(value=report())=>"SC_MANAGED_BEGIN:"+nonce+"\nSET\nDO\n"+JSON.stringify(value)+"\nSC_MANAGED_END:"+nonce+"\n";
async function probe(text=frame(),overrides={}){
 const consumer=child();consumer.stdout.on("error",()=>{});const original=()=>{};consumer.stdout.on("data",original);
 const before=consumer.stdout.listenerCount("data");
 const value=await checkManagedBeforeCommit({consumer,write:async sql=>{assert.equal(sql.startsWith("\\echo SC_MANAGED_BEGIN:"+nonce+"\n"),true);assert.equal(sql.includes(MANAGED_VALIDATION_SQL),true);assert.equal(sql.endsWith("\\echo SC_MANAGED_END:"+nonce+"\n"),true);for(const byte of Buffer.from(text))consumer.stdout.write(Buffer.from([byte]));}}, {nonce,timeoutMs:100,...overrides});
 assert.equal(consumer.stdout.listenerCount("data"),before);return value;
}

test("import is inert with filesystem, HTTP and native children forbidden; fixed helper identity is source-bound",()=>{
 const url=new URL("../../scripts/operations/restore-managed-native-adapters.mjs",import.meta.url).href;
 const code="import cp from'node:child_process';import fs from'node:fs/promises';import{syncBuiltinESMExports}from'node:module';let calls=0;const refuse=()=>{calls++;throw Error('FORBIDDEN')};cp.spawn=refuse;fs.readFile=refuse;fs.mkdir=refuse;syncBuiltinESMExports();globalThis.fetch=refuse;await import("+JSON.stringify(url)+");if(calls)throw Error('ACTIVE_IMPORT');process.stdout.write('INERT');";
 const value=spawnSync(process.execPath,["--input-type=module","-e",code],{env:{SystemRoot:process.env.SystemRoot},shell:false,windowsHide:true,timeout:10000,encoding:"utf8"});
 assert.equal(value.status,0);assert.equal(value.stdout,"INERT");assert.equal(value.stderr,"");assert.equal(hash(PRIVATE_TOC_ACL_HELPER),PRIVATE_TOC_ACL_HELPER_SHA256);assert.equal(MANAGED_ADAPTER_DEADLINE_MS,45000);
 assert.match(PRIVATE_TOC_ACL_HELPER,/WindowsIdentity\]\:\:GetCurrent/);assert.match(PRIVATE_TOC_ACL_HELPER,/GetOwner\(\[Security.Principal.SecurityIdentifier\]\)/);assert.equal(PRIVATE_TOC_ACL_HELPER.includes("Remove-Item"),false);
});

test("exclusive TOC lists preserve exact bytes, sync before closed descriptor, and cleanup only owned files without recursion",async()=>{
 const ram=ramFs(),adapter=await createManagedRestoreAdapters(options(),ram.ports);
 const text="1; 0 0 TABLE DATA auth users owner\n",one=await adapter.materializeList(text),two=await adapter.materializeList(text+"2; 0 0 TABLE DATA public profiles owner\n");
 assert.notEqual(one.path,two.path);assert.deepEqual(Object.keys(one).sort(),["path","private","sha256"]);assert.equal(one.private,true);assert.equal(one.sha256,hash(text));assert.equal(ram.entries.get(one.path).text,text);
 const writeIndex=ram.calls.findIndex(call=>call[0]==="write");assert.equal(ram.calls.findIndex(call=>call[0]==="acl"&&call[2]==="SecureDirectory")<writeIndex,true);
 assert.equal(ram.calls.filter(call=>call[0]==="acl"&&call[2]==="VerifyFile").length,2);assert.equal(ram.calls.filter(call=>call[0]==="sync").length,2);
 await adapter.removeLists();assert.deepEqual([...ram.entries.keys()],[RAM_PARENT,RAM_ROOT]);assert.equal(ram.calls.some(call=>call[0]==="mkdir"&&call[2].recursive),false);assert.equal(ram.calls.filter(call=>call[0]==="unlink").length,2);
 await adapter.removeLists();await assert.rejects(adapter.materializeList(text),{code:"RESTORE_MANAGED_LIST_INVALID"});
});

test("replaced file/directory, symlink ancestor and unknown child are retained rather than swept or removed recursively",async()=>{
 for(const scenario of ["file","directory","unknown"]){
  const ram=ramFs(),adapter=await createManagedRestoreAdapters(options(),ram.ports),item=await adapter.materializeList("1; 0 0 TABLE DATA auth users owner\n"),directory=dirname(item.path);
  const untouched=join(directory,"user-file.keep");
  if(scenario==="file")ram.entries.get(item.path).ino=987;
  if(scenario==="directory")ram.entries.get(directory).ino=987;
  if(scenario==="unknown")ram.entries.set(untouched,{type:"file",ino:987,text:canary});
  await assert.rejects(adapter.removeLists(),{code:"RESTORE_MANAGED_LIST_INVALID"});
  if(scenario==="unknown"){assert.equal(ram.entries.get(untouched).text,canary);assert.equal(ram.entries.has(item.path),false);}
  else assert.equal(ram.entries.has(item.path),true);
 }
 const ram=ramFs();ram.entries.get(RAM_ROOT).type="symlink";
 await assert.rejects(createManagedRestoreAdapters(options(),ram.ports),{code:"RESTORE_MANAGED_LIST_INVALID"});assert.equal(ram.calls.some(call=>call[0]==="mkdir"),false);
});

test("default ACL driver uses only fixed PowerShell/current-SID source and closed stdout; wrong identity JSON cannot certify privacy",async()=>{
 for(const accepted of [true,false]){
  const ram=ramFs();delete ram.ports.proveAcl;const calls=[];
  ram.ports.spawn=(executable,args,settings)=>{calls.push({executable,args,settings});const value=child();value.stdout.once("end",()=>queueMicrotask(()=>value.emit("close",0)));queueMicrotask(()=>{value.stderr.end(canary);value.stdout.end(JSON.stringify(accepted?{ok:true}:{ok:true,sid:canary})+"\n");});return value;};
  if(!accepted){await assert.rejects(createManagedRestoreAdapters(options(),ram.ports),{code:"RESTORE_MANAGED_LIST_INVALID"});continue;}
  const adapter=await createManagedRestoreAdapters(options(),ram.ports);await adapter.materializeList("1; 0 0 TABLE auth users owner\n");await adapter.removeLists();
  assert.equal(calls.length,2);for(const call of calls){assert.equal(call.settings.shell,false);assert.equal(call.settings.windowsHide,true);assert.equal(call.args[3],"-EncodedCommand");assert.equal(Buffer.from(call.args[4],"base64").toString("utf16le"),PRIVATE_TOC_ACL_HELPER);assert.deepEqual(Object.keys(call.settings.env).sort(),["SC_MANAGED_LIST_MODE","SC_MANAGED_LIST_TARGET","SC_MANAGED_PRIVATE_ROOT","SystemRoot"]);assert.equal(JSON.stringify(call.args).includes(canary),false);}
 }
});

test("collisions, non-ASCII TOC, unknown options/getters, unsafe default root and longer-than45s deadline fail before accepting a list",async()=>{
 let reads=0;const accessor=options();Object.defineProperty(accessor,"privateRoot",{enumerable:true,get(){reads++;throw Error(canary);}});
 await assert.rejects(createManagedRestoreAdapters(accessor),{code:"RESTORE_MANAGED_LIST_INVALID"});assert.equal(reads,0);
 await assert.rejects(createManagedRestoreAdapters({...options(),sid:canary}),{code:"RESTORE_MANAGED_LIST_INVALID"});
 for(const privateRoot of ["C:\\OneDrive\\private","relative"]){await assert.rejects(createManagedRestoreAdapters({...options(),privateRoot}),{code:"RESTORE_MANAGED_LIST_INVALID"});}
 const ram=ramFs();await assert.rejects(createManagedRestoreAdapters(options(),{...ram.ports,timeoutMs:45001}),{code:"RESTORE_MANAGED_LIST_INVALID"});
 const other=ramFs();other.ports.randomBytes=()=>Buffer.alloc(16,1);const adapter=await createManagedRestoreAdapters(options(),other.ports);await adapter.materializeList("1; 0 0 TABLE auth users owner\n");
 await assert.rejects(adapter.materializeList("2; 0 0 TABLE auth users owner\n"),{code:"RESTORE_MANAGED_LIST_INVALID"});await assert.rejects(adapter.materializeList(canary+"é"),{code:"RESTORE_MANAGED_LIST_INVALID"});await adapter.removeLists();
});

test("native spawn returns the original child and factory check binds that exact single consumer without new connection",async()=>{
 const ram=ramFs(),calls=[];ram.ports.spawn=(exe,args,settings)=>{const value=child();calls.push({value,exe,args,settings});return value;};const adapter=await createManagedRestoreAdapters(options(),ram.ports);
 const actual=adapter.spawn("C:\\synthetic-psql.exe",["--set=ON_ERROR_STOP=1"],{shell:false,windowsHide:true,env:{PGPASSWORD:canary}});assert.equal(actual,calls[0].value);
 await assert.rejects(adapter.checkBeforeCommit({consumer:child(),write:async()=>{throw Error("WRONG_CONNECTION");}}),{code:"RESTORE_MANAGED_VALIDATION_FAILED"});
 assert.throws(()=>adapter.spawn("C:\\another.exe",["--set=ON_ERROR_STOP=1"],{shell:false,windowsHide:true}),{code:"RESTORE_MANAGED_VALIDATION_FAILED"});assert.equal(calls.length,1);
 const validated=await adapter.checkBeforeCommit({consumer:actual,write:async sql=>{const begin=sql.split("\n")[0].slice("\\echo ".length),end=sql.trimEnd().split("\n").at(-1).slice("\\echo ".length);actual.stdout.write(begin+"\nSET\nDO\n"+JSON.stringify(report())+"\n"+end+"\n");}});
 assert.equal(validated,true);assert.equal(adapter.validationReport().catalogueChecks,1350);assert.equal(calls.length,1);await adapter.removeLists();
});

test("same-connection frame requires exact complete fragmented JSON and end marker, preserving existing stream listeners",async()=>{
 assert.equal(await probe(canary+"\n"+frame()),true);assert.equal(await probe(frame(report({catalogueOk:false,catalogueDeviations:1}))),false);assert.equal(await probe(frame(report({foreignKeyViolations:1}))),false);
 for(const text of [frame().replace("SC_MANAGED_END:"+nonce+"\n",""),frame().replace("SC_MANAGED_BEGIN:"+nonce,"SC_MANAGED_BEGIN:"+"b".repeat(32)),frame().replace(JSON.stringify(report()),JSON.stringify({...report(),secret:canary})),frame().replace(JSON.stringify(report()),JSON.stringify(report())+"\n"+JSON.stringify(report())),frame().replace("SC_MANAGED_END:"+nonce+"\n","SC_MANAGED_END:"+nonce)]){
  const consumer=child();const baseline=()=>{};consumer.stdout.on("data",baseline);
  await assert.rejects(checkManagedBeforeCommit({consumer,write:async()=>{consumer.stdout.write(text);}}, {nonce,timeoutMs:20}),{code:"RESTORE_MANAGED_VALIDATION_FAILED"});assert.equal(consumer.stdout.listenerCount("data"),1);assert.equal(consumer.listenerCount("close"),0);
 }
});

test("consumer error/EOF/close, callback failure and unsuccessful write after a complete frame cannot approve COMMIT",async()=>{
 for(const mode of ["error","eof","close","write","callback"]){
  const consumer=child();const write=async()=>{
   if(mode==="error")consumer.emit("error",Error(canary));
   else if(mode==="eof")consumer.stdout.end(frame().replace("SC_MANAGED_END:"+nonce+"\n",""));
   else if(mode==="close")consumer.emit("close",0);
   else {consumer.stdout.write(frame());if(mode==="write")throw Error(canary);}
  };
  await assert.rejects(checkManagedBeforeCommit({consumer,write},{nonce,timeoutMs:30,onReport:()=>{if(mode==="callback")throw Error(canary);}}),{code:"RESTORE_MANAGED_VALIDATION_FAILED"});
  assert.equal(consumer.stdout.listenerCount("data"),0);assert.equal(consumer.listenerCount("error"),0);
 }
});

for(const mode of ["deadline","consumerError","duplicateFrame"]){
 test("complete frame with original write still pending refuses "+mode+" and releases only owned listeners",async()=>{
  const consumer=child(),baseline=()=>{};consumer.stdout.on("data",baseline);consumer.on("error",baseline);
  let releaseWrite,writeSettled=false;
  const held=new Promise(resolve=>{releaseWrite=resolve;});
  const write=()=>{consumer.stdout.write(frame());
   if(mode==="consumerError")queueMicrotask(()=>consumer.emit("error",Error(canary)));
   if(mode==="duplicateFrame")queueMicrotask(()=>consumer.stdout.write(frame()));
   return held.then(()=>{writeSettled=true;});
  };
  let guard;const unexpectedDelay=new Promise((_resolve,reject)=>{guard=setTimeout(()=>reject(Error("HELPER_DID_NOT_TERMINATE")),1000);});
  try{
   await assert.rejects(Promise.race([checkManagedBeforeCommit({consumer,write},{nonce,timeoutMs:20}),unexpectedDelay]),{code:"RESTORE_MANAGED_VALIDATION_FAILED"});
   assert.equal(writeSettled,false);assert.equal(consumer.stdout.listenerCount("data"),1);assert.equal(consumer.listenerCount("error"),1);
   assert.equal(consumer.listenerCount("close"),0);assert.equal(consumer.stdout.listenerCount("end"),0);
  }finally{clearTimeout(guard);releaseWrite();await held;}
 });
}

test("closed counts/booleans refuse getters, coercion, symbols, arbitrary JSON/errors without exposing raw catalogue",()=>{
 let reads=0;
 for(const key of Object.keys(report())){
  const value=report();Object.defineProperty(value,key,{enumerable:true,get(){reads++;throw Error(canary);}});assert.throws(()=>validateManagedValidation(value),{code:"RESTORE_MANAGED_VALIDATION_FAILED"});
 }
 for(const value of [null,[],{...report(),[Symbol("private")]:canary},report({catalogueChecks:0}),report({catalogueChecks:1.5}),report({catalogueDeviations:1}),report({foreignKeyViolations:81}),report({replicationOrigin:1}),{...report(),rows:[canary]}])assert.throws(()=>validateManagedValidation(value),{code:"RESTORE_MANAGED_VALIDATION_FAILED"});
 const value=validateManagedValidation(report());assert.equal(Object.getPrototypeOf(value),null);assert.equal(Object.isFrozen(value),true);assert.equal(reads,0);assert.equal(JSON.stringify(value).includes(canary),false);
});

test("SQL contains exactly the current release checks CTE and no transaction control or constraint disabling",async()=>{
 const source=(await readFile(new URL("../../supabase/tests/release-catalog.sql",import.meta.url),"utf8")).replaceAll("\r\n","\n");
 const cte=source.slice(source.indexOf("with expected_tables"),source.lastIndexOf("\nselect jsonb_build_object('version',1,'ok'"));
 assert.equal(MANAGED_VALIDATION_SQL.includes(cte),true);assert.equal(/\b(begin transaction|commit;|rollback;|disable trigger|disable constraint)\b/i.test(MANAGED_VALIDATION_SQL),false);
 assert.equal(MANAGED_VALIDATION_SQL.includes("set local row_security = off"),true);assert.equal(MANAGED_VALIDATION_SQL.includes("conpfeqop"),true);assert.equal(MANAGED_VALIDATION_SQL.includes("OPERATOR(%I.%s)"),true);
 const origin=MANAGED_VALIDATION_SQL.indexOf("set local session_replication_role = origin;");
 const documents=MANAGED_VALIDATION_SQL.indexOf("do $second_brain_capture_documents$");
 assert.equal(origin>=0 && documents>origin && documents<MANAGED_VALIDATION_SQL.indexOf("do $second_brain_references$"),true);
 const fixed=MANAGED_VALIDATION_SQL.slice(documents,MANAGED_VALIDATION_SQL.indexOf("$second_brain_capture_documents$;",documents)+"$second_brain_capture_documents$;".length);
 assert.equal(/\bexecute\b/i.test(fixed),false);assert.equal(fixed.includes("capture_document_event_pair_allowed"),true);assert.equal(fixed.includes("receipt_row.result"),true);
 assert.equal(fixed.indexOf("catalogue->'catalogueOk' is distinct from 'true'::jsonb")<fixed.indexOf("perform app_private.capture_task_validate_payload("),true);
});

async function actual(db){
 const rows=(await db.exec(MANAGED_VALIDATION_SQL)).flatMap(result=>result.rows).filter(row=>row.managed_validation);
 assert.equal(rows.length,1);return validateManagedValidation(rows[0].managed_validation);
}

test("literal PGlite full current schema catalogue+FK checks see uncommitted native data in the same transaction",async()=>{
 const db=await createLocalCanonicalSql();try{
  await db.exec("begin;set local session_replication_role=replica");
  const value=await actual(db);assert.equal(value.catalogueOk,true);assert.equal(value.catalogueChecks,1350);assert.equal(value.catalogueDeviations,0);assert.equal(value.foreignKeysChecked>0,true);assert.equal(value.foreignKeyViolations,0);assert.equal(value.replicationOrigin,true);
  assert.equal((await db.query("select current_setting('transaction_read_only') as readonly,current_setting('session_replication_role') as mode")).rows[0].mode,"origin");
  await db.exec("rollback");
  assert.equal((await db.query("select nullif(current_setting('second_brain_operator.managed_catalogue',true),'') is null as reset")).rows[0].reset,true);
 }finally{await db.close();}
});

test("post-replica fixed Capture validation preserves legacy/rich history and original receipts while refusing bypassed row/event guards",async()=>{
 const db=await createLocalCanonicalSql(),owner=randomUUID(),richId=randomUUID(),legacyId=randomUUID(),eventId=randomUUID(),createdId=randomUUID();
 const stamp="2026-10-21T12:00:00.000Z";
 const document=text=>({type:"doc",content:[{type:"paragraph",content:[{type:"text",text}]}]});
 const legacy={id:richId,user_id:owner,client_id:"restore-capture-rich",project_id:null,type:"note",title:"Historical Capture",content:"  literal  ",status:"inbox",category_id:null,converted_task_id:null,captured_at:stamp,organized_at:null,archived_at:null,deleted_at:null,created_at:stamp,updated_at:stamp};
 const rich=(version,text)=>({...legacy,document:document(text),document_version:version,content:text});
 const historicalAttachment={id:randomUUID(),name:"Historical image",mime:"image/png",width:1,height:1,bytes:1};
 const first={...rich(1,"First document"),attachments:[historicalAttachment]},second={...rich(2,"Second document"),attachments:[historicalAttachment]},latest=rich(3,"Current document");
 const legacyCurrent={...legacy,id:legacyId,client_id:"restore-capture-legacy"};
 const event=(before,after,id=eventId,action="updated")=>({id,user_id:owner,entity_type:"capture",entity_id:richId,action,canal:"web",occurred_at:stamp,before,after});
 const history=event(first,second),created=event(null,first,createdId,"created");
 const intent={id:richId,client_id:"restore-document-original",expected_content:{kind:"legacy",content:legacy.content},patch:{document:first.document}};
 const metadataIntent={id:richId,client_id:"restore-metadata-original",patch:{type:"note"}};
 const writeEvent=e=>db.query("insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after,capture_task_payload) values($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::jsonb,$9::jsonb,$10::jsonb)",[e.id,e.user_id,e.entity_type,e.entity_id,e.action,e.canal,e.occurred_at,e.before===null?null:JSON.stringify(e.before),JSON.stringify(e.after),JSON.stringify(e)]);
 const changeEvent=e=>db.query("update public.domain_events set before=$2::jsonb,after=$3::jsonb,capture_task_payload=$4::jsonb where id=$1",[eventId,e.before===null?null:JSON.stringify(e.before),JSON.stringify(e.after),JSON.stringify(e)]);
 const changeCurrent=row=>db.query("update public.captures set payload=$2::jsonb where id=$1",[richId,JSON.stringify(row)]);
 const changeResult=row=>db.query("update app_private.command_receipts set result=$2::jsonb where user_id=$1 and command='capture.update' and client_id='restore-document-original'",[owner,JSON.stringify(row)]);
 await db.exec("begin");
 try{
  await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)",[owner,owner+"@example.invalid"]);
  await db.exec("set local session_replication_role=replica");
  for(const row of [legacyCurrent,latest])await db.query("insert into public.captures(id,user_id,client_id,payload,status,created_at,updated_at) values($1,$2,$3,$4::jsonb,$5,$6::timestamptz,$7::timestamptz)",[row.id,row.user_id,row.client_id,JSON.stringify(row),row.status,row.created_at,row.updated_at]);
  await writeEvent(history);await writeEvent(created);
  for(const [input,result]of [[intent,first],[metadataIntent,second]])await db.query("insert into app_private.command_receipts(user_id,command,client_id,request,result) values($1,'capture.update',$2,to_jsonb($3::text),$4::jsonb)",[owner,input.client_id,JSON.stringify(input),JSON.stringify(result)]);
  const accepted=await actual(db);assert.equal(accepted.catalogueOk,true);assert.equal(accepted.catalogueDeviations,0);assert.equal(accepted.foreignKeyViolations,0);assert.equal(accepted.replicationOrigin,true);
  assert.equal((await db.query("select count(*)::int count from public.drive_files where id=$1",[historicalAttachment.id])).rows[0].count,0,"historical event/receipt DTOs must not require a current file row");
  assert.deepEqual((await db.query("select payload from public.captures where id=$1",[richId])).rows[0].payload,latest);
  assert.deepEqual((await db.query("select result from app_private.command_receipts where user_id=$1 and client_id=$2",[owner,intent.client_id])).rows[0].result,first,"historical replay result must not be replaced by current v3");
  async function rejected(label,mutate,code){
   await db.exec("savepoint copied_capture;set local session_replication_role=replica");
   try{await mutate();await assert.rejects(actual(db),failure=>failure.code===code,label);}
   finally{await db.exec("rollback to savepoint copied_capture;release savepoint copied_capture");}
  }
  // Without the catalogue fence, the first current-row helper would raise the
  // distinct ZX041 sentinel. Refuse its altered authority BEFORE calling it.
  await rejected("unreviewed helper must never run",()=>db.exec("create or replace function app_private.capture_task_validate_payload(p_kind text,p jsonb) returns void language plpgsql stable set search_path='' as $$begin raise exception 'Unreviewed helper reached.' using errcode='ZX041';end$$;"),"23514");
  const {document_version:omitted,...partial}=latest;assert.equal(omitted,3);
  await rejected("copied incomplete document pair",()=>changeCurrent(partial),"22023");
  await rejected("copied current cache",()=>changeCurrent({...latest,content:"forged"}),"22023");
  await rejected("copied revision zero",()=>changeCurrent({...latest,document_version:0}),"22023");
  await rejected("copied physical status differs from JSON",()=>db.query("update public.captures set status='archived' where id=$1",[richId]),"23514");
  await rejected("copied historical cache",()=>changeEvent(event(first,{...second,content:"forged"})),"22023");
  await rejected("copied historical owner differs from physical event",()=>changeEvent(event(first,{...second,user_id:randomUUID()})),"23514");
  await rejected("copied event timestamp differs from envelope",()=>changeEvent({...history,occurred_at:"2026-10-21T12:00:01.000Z"}),"23514");
  await rejected("copied rich document downgrade",()=>changeEvent(event(first,legacy)),"23514");
  await rejected("copied rich revision jump",()=>changeEvent(event(first,rich(3,"Second document"))),"23514");
  await rejected("copied changed document without new revision",()=>changeEvent(event(first,rich(1,"Changed document"))),"23514");
  await rejected("copied receipt cache",()=>changeResult({...first,content:"forged"}),"22023");
  const {document_version:receiptVersion,...partialResult}=first;assert.equal(receiptVersion,1);
  await rejected("copied incomplete result pair",()=>changeResult(partialResult),"22023");
  await rejected("copied result revision does not match original expectation",()=>changeResult({...first,document_version:2}),"23514");
  await rejected("copied result differs from original document",()=>changeResult(rich(1,"Other valid document")),"23514");
  await rejected("copied result outside receipt owner",()=>changeResult({...first,user_id:randomUUID()}),"23514");
  await rejected("copied result outside original entity",()=>changeResult({...first,id:randomUUID()}),"23514");
  const final=await actual(db);assert.equal(final.catalogueOk,true);assert.equal(final.foreignKeyViolations,0);assert.equal(final.replicationOrigin,true);
  await db.exec("rollback");
  assert.deepEqual((await db.query("select (select count(*)::int from auth.users) users,(select count(*)::int from public.captures) captures,(select count(*)::int from public.domain_events) events,(select count(*)::int from app_private.command_receipts) receipts")).rows,[{users:0,captures:0,events:0,receipts:0}]);
 }finally{await db.close();}
});

test("literal FK SELECTs distinguish MATCH SIMPLE/FULL null tuples and actual orphan rows, never TRUST convalidated alone",async()=>{
 const db=await createLocalCanonicalSql();try{
  await db.exec("create table auth.fixture_parent(a integer,b integer,primary key(a,b));create table auth.fixture_simple(a integer,b integer,foreign key(a,b) references auth.fixture_parent(a,b) match simple);create table auth.fixture_full(a integer,b integer,foreign key(a,b) references auth.fixture_parent(a,b) match full)");
  await db.exec("begin;set local session_replication_role=replica;insert into auth.fixture_parent values(1,1);insert into auth.fixture_simple values(1,null),(null,null),(1,1);insert into auth.fixture_full values(null,null),(1,1)");
  const clean=await actual(db);assert.equal(clean.foreignKeyViolations,0);assert.equal(clean.catalogueOk,true);
  await db.exec("set local session_replication_role=replica;insert into auth.fixture_full values(1,null);insert into auth.fixture_simple values(9,9)");
  const orphan=await actual(db);assert.equal(orphan.foreignKeyViolations,2);assert.equal(orphan.foreignKeysChecked,clean.foreignKeysChecked);assert.equal(orphan.catalogueOk,true);
  assert.equal((await db.query("select bool_and(convalidated) as validated from pg_constraint where conrelid in('auth.fixture_simple'::regclass,'auth.fixture_full'::regclass)")).rows[0].validated,true);
  await db.exec("rollback");
 }finally{await db.close();}
});

test("literal FK casts select conpfeqop's exact overload and refuse polymorphic operator inputs",async()=>{
 const db=await createLocalCanonicalSql();try{
  await db.exec("create domain auth.fixture_uuid as uuid;create table auth.fixture_domain_parent(id auth.fixture_uuid primary key);create table auth.fixture_domain_child(id auth.fixture_uuid references auth.fixture_domain_parent(id));create function auth.fixture_domain_equal(auth.fixture_uuid,auth.fixture_uuid) returns boolean language sql immutable as 'select false';create operator pg_catalog.= (leftarg=auth.fixture_uuid,rightarg=auth.fixture_uuid,function=auth.fixture_domain_equal)");
  const identity=(await db.query("select op.oprleft='uuid'::regtype and op.oprright='uuid'::regtype as original_base from pg_constraint con join pg_operator op on op.oid=con.conpfeqop[1] where con.conrelid='auth.fixture_domain_child'::regclass and con.contype='f'")).rows;
  assert.deepEqual(identity,[{original_base:true}]);
  await db.exec("begin;set local session_replication_role=replica;insert into auth.fixture_domain_parent values('11111111-1111-4111-8111-111111111111');insert into auth.fixture_domain_child values('11111111-1111-4111-8111-111111111111')");
  assert.equal((await db.query("select parent.id OPERATOR(pg_catalog.=) child.id as inferred from auth.fixture_domain_parent parent cross join auth.fixture_domain_child child")).rows[0].inferred,false);
  const exact=await actual(db);assert.equal(exact.catalogueOk,true);assert.equal(exact.foreignKeyViolations,0);
  await db.exec("set local session_replication_role=replica;insert into auth.fixture_domain_child values('22222222-2222-4222-8222-222222222222')");
  assert.equal((await actual(db)).foreignKeyViolations,1);await db.exec("rollback");
  await db.exec("create table auth.fixture_array_parent(id integer[] primary key);create table auth.fixture_array_child(id integer[] references auth.fixture_array_parent(id));begin");
  await assert.rejects(actual(db),failure=>failure.code==="22023");await db.exec("rollback");
 }finally{await db.close();}
});

test("literal check refuses RLS invisibility and catalogue drift before application helpers, without private names",async()=>{
 const db=await createLocalCanonicalSql();try{
  await db.exec("begin;alter table auth.users disable trigger second_brain_identity_created");
  await assert.rejects(actual(db),error=>error.code==="23514"&&!error.message.includes("second_brain_identity_created"));await db.exec("rollback");
  await db.exec("create table auth.fixture_parent(id integer primary key);create table auth.fixture_child(id integer references auth.fixture_parent(id));alter table auth.fixture_child enable row level security;create role fk_actor login;grant usage on schema auth,storage,public,app_private to fk_actor;grant select on all tables in schema auth,storage,public,app_private to fk_actor;set session authorization fk_actor;begin");
  await assert.rejects(actual(db),error=>error.code==="42501");await db.exec("rollback");
 }finally{await db.close();}
});
