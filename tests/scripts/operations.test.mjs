import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { Readable, PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { writeBackup } from "../../scripts/operations/backup-format.mjs";
import { DATABASE_METADATA } from "../../scripts/operations/backup-sources.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";
import { restoreConfiguration } from "../../scripts/operations/restore-target.mjs";
import { runBackupCli } from "../../scripts/operations/backup.mjs";
import { runReleaseCli,assertReleaseReport } from "../../scripts/operations/release-checks.mjs";
import { queryPostgres } from "../../scripts/operations/postgres-process.mjs";
const ref="abcdefghijklmnopqrst",canary="PRIVATE_CANARY_NEVER_PRINT",user="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
async function fixture(action){const directory=await mkdtemp(join(tmpdir(),"sc-ops-test-"));try{return await action(directory);}finally{await rm(directory,{recursive:true,force:true});}}
function environment(directory,key){return{SC_BACKUP_ENCRYPTION_KEY:key,SC_BACKUP_KEY_ID:"fixture",SC_RESTORE_PROJECT_REF:ref,SC_RESTORE_CONFIRM_PROJECT:ref,SC_RESTORE_ISOLATED:"YES",SC_RESTORE_PG_RESTORE:resolve(directory,"fake-pg_restore"),SC_RESTORE_PSQL:resolve(directory,"fake-psql"),SC_RESTORE_SUPABASE_URL:"https://"+ref+".supabase.co",SC_RESTORE_SUPABASE_KEY:"sb_secret_"+canary,SC_RESTORE_PGHOST:"db."+ref+".supabase.co",SC_RESTORE_PGUSER:"postgres",SC_RESTORE_PGDATABASE:"postgres",SC_RESTORE_PGPASSWORD:canary,SC_RESTORE_PGSSLMODE:"require"};}
async function archive(directory,key){const database=Buffer.from("PGDMP auth UUID="+user+" OWNER managed_auth ACL service_role EXECUTE "+canary),bytes=randomBytes(140000),metadata={kind:"storage",bucket:"second-brain-files",path:user+"/private.bin",object_id:user,source_updated_at:"2026-10-09T12:00:00Z",mime:"application/octet-stream",expected_bytes:bytes.length},path=join(directory,"archive.scbackup");await writeBackup(path,key,{project_ref:PERSONAL_REF,key_id:"fixture",created_at:"2026-10-09T12:00:00Z"},(async function*(){yield{metadata:DATABASE_METADATA,stream:Readable.from([database])};yield{metadata,stream:Readable.from([bytes])};})());return{path,database,bytes,metadata};}
function fakeRestore(received,code=0,stderr=""){return(executable,args,options)=>{const child=Object.assign(new EventEmitter(),{stdin:new PassThrough(),stderr:new PassThrough(),kill(){this.stdin.destroy();this.emit("close",1);}}),chunks=[];child.stdin.on("data",bytes=>chunks.push(Buffer.from(bytes)));child.stdin.on("end",()=>{received.push({executable,args,options,bytes:Buffer.concat(chunks)});child.stderr.end(stderr);queueMicrotask(()=>child.emit("close",code));});return child;};}
test("restore CLI streams native dump with original UUIDs/ACLs, uploads exact chunks and verifies catalogue before metadata-only success",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key),received=[],output=[],stored=new Map(),queries=[];
 const fetcher=async(url,options)=>{const chunks=[];for await(const bytes of options.body)chunks.push(Buffer.from(bytes));stored.set(url,Buffer.concat(chunks));return{ok:true};};
 const storage={async download(metadata){return Readable.from([stored.get("https://"+ref+".supabase.co/storage/v1/object/"+metadata.bucket+"/"+metadata.path)]);}};
 const query=async request=>{queries.push(request);return request.sql?{empty:true}:{version:1,ok:true,checks:100,deviations:[]};};
 assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),{spawn:fakeRestore(received),fetch:fetcher,storage,query}),0);
 assert.deepEqual(received[0].bytes,source.database);assert.deepEqual([...stored.values()][0],source.bytes);assert.equal(received[0].args.includes("--single-transaction"),true);assert.equal(received[0].args.includes("--exit-on-error"),true);for(const forbidden of ["--no-privileges","--no-acl","--no-owner","-O"])assert.equal(received[0].args.includes(forbidden),false);assert.equal(JSON.stringify(received[0].args).includes(canary),false);assert.equal(received[0].options.env.PGPASSWORD,canary);assert.equal(queries.length,2);assert.equal(output[0].app_catalogue_verified,true);assert.equal(Object.hasOwn(output[0],"permissions_verified"),false);assert.equal(output[0].owner_restore_strategy,"original_archive_owners_or_transaction_failure");assert.equal(output[0].managed_owners_verification,"pending_manual_source_catalog_comparison");assert.equal(output[0].release_required,"manual_managed_owners_auth_login_and_vault_unlock");assert.equal(output[0].vault_unlock,"pending_manual_in_isolated_app");assert.equal(JSON.stringify(output).includes(canary),false);assert.equal(JSON.stringify(output).includes(user),false);
}));
test("missing managed owner or forbidden ownership change aborts before Storage without an ownerless retry",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key);for(const diagnostic of ['role "managed_auth" does not exist','must be member of role "managed_auth"']){const output=[],received=[];let requests=0;assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),{spawn:fakeRestore(received,1,diagnostic+canary),query:async()=>({empty:true}),fetch(){requests++;throw new Error(canary);}}),1);assert.equal(received.length,1);assert.equal(received[0].args.includes("--no-owner"),false);assert.equal(received[0].args.includes("--single-transaction"),true);assert.equal(requests,0);assert.deepEqual(output,[{ok:false,operation:"backup",error:"PG_RESTORE_FAILED"}]);assert.equal(JSON.stringify(output).includes(diagnostic),false);assert.equal(JSON.stringify(output).includes(canary),false);}
}));
test("restore refuses production target, unconfirmed or nonempty isolated target and tampering before processes/Storage",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key),env=environment(directory,key);assert.throws(()=>restoreConfiguration({...env,SC_RESTORE_PROJECT_REF:PERSONAL_REF,SC_RESTORE_CONFIRM_PROJECT:PERSONAL_REF}),/ISOLATED/);assert.throws(()=>restoreConfiguration({...env,SC_RESTORE_CONFIRM_PROJECT:"different"}),/ISOLATED/);
 let spawned=0,remote=0;const deps={spawn(){spawned++;},query:async()=>{remote++;return{empty:false};}};const output=[];assert.equal(await runBackupCli(["restore",source.path],env,value=>output.push(value),deps),1);assert.equal(spawned,0);assert.equal(output[0].error,"RESTORE_TARGET_NOT_EMPTY");
 const bytes=await readFile(source.path);bytes[bytes.length-1]^=1;await writeFile(source.path,bytes);remote=0;assert.equal(await runBackupCli(["restore",source.path],env,()=>undefined,deps),1);assert.equal(remote,0);assert.equal(spawned,0);
}));
test("native restore failure prevents object writes and returns only closed failure codes",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key),output=[],received=[];let requests=0;assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),{spawn:fakeRestore(received,1),query:async()=>({empty:true}),fetch(){requests++;throw new Error(canary);}}),1);assert.equal(requests,0);assert.deepEqual(output,[{ok:false,operation:"backup",error:"PG_RESTORE_FAILED"}]);
}));
test("restore rejects object hash mismatch and permission drift without declaring success",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key),output=[];const deps={spawn:fakeRestore([]),query:async request=>request.sql?{empty:true}:{ok:false,deviations:[{check:"grant",object:"safe_metadata"}]},fetch:async(_,options)=>{for await(const bytes of options.body)assert.ok(bytes.length);return{ok:true};},storage:{download:async()=>Readable.from([Buffer.from("wrong")])}};assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),deps),1);assert.equal(output[0].error,"RESTORED_OBJECT_BYTES_MISMATCH");
 output.length=0;deps.storage.download=async()=>Readable.from([source.bytes]);assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),deps),1);assert.equal(output[0].error,"RESTORED_CATALOGUE_DEVIATIONS");
}));
test("restore upload errors release backpressure and return a closed failure before downloading or catalogue checks",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key);
 for(const failure of ["http","synchronous","asynchronous","during_stream"]){
  const output=[];let requests=0,downloads=0,catalogues=0,body,signal;
  const fetcher=(_,options)=>{requests++;body=options.body;signal=options.signal;if(failure==="synchronous")throw new Error(canary);if(failure==="asynchronous")return Promise.reject(new Error(canary));if(failure==="http")return Promise.resolve({ok:false,status:403});return(async()=>{for await(const bytes of body){assert.ok(bytes.length);throw new Error(canary);}})();};
  const restoring=runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),{spawn:fakeRestore([]),query:async request=>{if(request.file)catalogues++;return{empty:true};},fetch:fetcher,storage:{download(){downloads++;throw new Error(canary);}}});
  let deadline;try{assert.equal(await Promise.race([restoring,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error("restore upload remained blocked")),1000);})]),1);}finally{clearTimeout(deadline);}
  assert.equal(requests,1);assert.equal(downloads,0);assert.equal(catalogues,0);assert.equal(body.destroyed,true);assert.equal(signal.aborted,true);assert.deepEqual(output,[{ok:false,operation:"backup",error:"RESTORE_STORAGE_UPLOAD_FAILED"}]);assert.equal(JSON.stringify(output).includes(canary),false);
 }
}));
test("production operator checks emit only metadata reports and do not accept arbitrary SQL or malformed content DTOs",async()=>fixture(async directory=>{
 const env={SC_RELEASE_PSQL:resolve(directory,"fake-psql"),SC_RELEASE_REPORT_DIRECTORY:join(directory,"reports"),PGHOST:"db."+PERSONAL_REF+".supabase.co",PGUSER:"postgres",PGDATABASE:"postgres",PGPASSWORD:canary,PGSSLMODE:"require"},output=[];let requests=0;
 assert.equal(await runReleaseCli(["check"],env,value=>output.push(value),{query:async request=>{requests++;assert.ok(request.file.endsWith("release-catalog.sql"));return{version:1,ok:false,checks:100,deviations:[{check:"rls",object:"public.tasks"}]};}}),1);assert.equal(requests,1);assert.equal(output[0].deviation_count,1);const report=JSON.parse(await readFile(join(env.SC_RELEASE_REPORT_DIRECTORY,output[0].report_name),"utf8"));assert.equal(report.deviations[0].object,"public.tasks");assert.equal(JSON.stringify(output).includes(canary),false);
 assert.throws(()=>assertReleaseReport({version:1,ok:true,checks:1,deviations:[],plaintext:canary}),/INVALID/);assert.equal(await runReleaseCli(["check","arbitrary.sql"],env,()=>undefined,{query(){requests++;}}),1);assert.equal(requests,1);
}));
test("psql process reads credentials only from env, sanitizes stderr and caps JSON output",async()=>{
 const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),kill(){}});let seen;const result=queryPostgres("fake-psql",{PGPASSWORD:canary},{file:"fixed-catalog.sql"},(_,args,options)=>{seen={args,options};return child;});child.stderr.end(canary);child.stdout.end('{"ok":true}');child.emit("close",0);assert.deepEqual(await result,{ok:true});assert.equal(JSON.stringify(seen.args).includes(canary),false);assert.equal(seen.options.env.PGPASSWORD,canary);assert.equal(seen.options.shell,false);
});
