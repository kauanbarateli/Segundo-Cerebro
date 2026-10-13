import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { Readable, PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { PGlite } from "@electric-sql/pglite";
import { writeBackup, BackupError } from "../../scripts/operations/backup-format.mjs";
import { DATABASE_METADATA } from "../../scripts/operations/backup-sources.mjs";
import { PERSONAL_REF } from "../../scripts/operations/backup-config.mjs";
import { restoreConfiguration, isolatedRestoreSinks, EMPTY_TARGET_SQL, MANAGED_OWNER_PREFLIGHT_SQL, assertManagedOwnerPreflight } from "../../scripts/operations/restore-target.mjs";
import { runBackupCli } from "../../scripts/operations/backup.mjs";
import { runReleaseCli,assertReleaseReport } from "../../scripts/operations/release-checks.mjs";
import { queryPostgres } from "../../scripts/operations/postgres-process.mjs";
const ref="abcdefghijklmnopqrst",canary="PRIVATE_CANARY_NEVER_PRINT",user="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
async function fixture(action){const directory=await mkdtemp(join(tmpdir(),"sc-ops-test-"));try{return await action(directory);}finally{await rm(directory,{recursive:true,force:true});}}
function environment(directory,key){return{SC_BACKUP_ENCRYPTION_KEY:key,SC_BACKUP_KEY_ID:"fixture",SC_RESTORE_PROJECT_REF:ref,SC_RESTORE_CONFIRM_PROJECT:ref,SC_RESTORE_ISOLATED:"YES",SC_RESTORE_PG_RESTORE:resolve(directory,"fake-pg_restore"),SC_RESTORE_PSQL:resolve(directory,"fake-psql"),SC_RESTORE_SUPABASE_URL:"https://"+ref+".supabase.co",SC_RESTORE_SUPABASE_KEY:"sb_secret_"+canary,SC_RESTORE_PGHOST:"db."+ref+".supabase.co",SC_RESTORE_PGUSER:"postgres",SC_RESTORE_PGDATABASE:"postgres",SC_RESTORE_PGPASSWORD:canary,SC_RESTORE_PGSSLMODE:"require"};}
async function archive(directory,key){const database=Buffer.from("PGDMP auth UUID="+user+" OWNER managed_auth ACL service_role EXECUTE "+canary),bytes=randomBytes(140000),metadata={kind:"storage",bucket:"second-brain-files",path:user+"/private.bin",object_id:user,source_updated_at:"2026-10-09T12:00:00Z",mime:"application/octet-stream",expected_bytes:bytes.length},path=join(directory,"archive.scbackup");await writeBackup(path,key,{project_ref:PERSONAL_REF,key_id:"fixture",created_at:"2026-10-09T12:00:00Z"},(async function*(){yield{metadata:DATABASE_METADATA,stream:Readable.from([database])};yield{metadata,stream:Readable.from([bytes])};})());return{path,database,bytes,metadata};}
function fakeRestore(received,code=0,stderr=""){return(executable,args,options)=>{const child=Object.assign(new EventEmitter(),{stdin:new PassThrough(),stderr:new PassThrough(),kill(){this.stdin.destroy();this.emit("close",1);}}),chunks=[];child.stdin.on("data",bytes=>chunks.push(Buffer.from(bytes)));child.stdin.on("end",()=>{received.push({executable,args,options,bytes:Buffer.concat(chunks)});child.stderr.end(stderr);queueMicrotask(()=>child.emit("close",code));});return child;};}
function managedOwners(overrides={}){return{version:1,serverVersionNum:170011,sameActor:true,isSuperuser:false,schemas:2,schemaOwnerAvailable:2,schemaOwnerUnavailable:0,tables:35,tableOwnerAvailable:35,tableOwnerUnavailable:0,tableDropOwnerOrSchemaAvailable:35,tableDropOwnerOrSchemaUnavailable:0,...overrides};}
function targetReply(request,catalogue={version:1,ok:true,checks:100,deviations:[]}){if(request.sql===EMPTY_TARGET_SQL)return{empty:true};if(request.sql===MANAGED_OWNER_PREFLIGHT_SQL)return managedOwners();if(request.file?.endsWith("release-catalog.sql"))return catalogue;throw new Error("unexpected operator query");}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};}
test("restore CLI streams native dump with original UUIDs/ACLs, uploads exact chunks and verifies catalogue before metadata-only success",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key),received=[],output=[],stored=new Map(),queries=[];
 const fetcher=async(url,options)=>{const chunks=[];for await(const bytes of options.body)chunks.push(Buffer.from(bytes));stored.set(url,Buffer.concat(chunks));return{ok:true};};
 const storage={async download(metadata){return Readable.from([stored.get("https://"+ref+".supabase.co/storage/v1/object/"+metadata.bucket+"/"+metadata.path)]);}};
 const query=async(request,options)=>{queries.push({request,options});return targetReply(request);};
 assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),{spawn:fakeRestore(received),fetch:fetcher,storage,query}),0);
 assert.deepEqual(received[0].bytes,source.database);assert.deepEqual([...stored.values()][0],source.bytes);assert.deepEqual(received[0].args,["--exit-on-error","--single-transaction","--clean","--if-exists","--dbname=postgres"]);for(const forbidden of ["--no-privileges","--no-acl","--no-owner","-O"])assert.equal(received[0].args.includes(forbidden),false);assert.equal(JSON.stringify(received[0].args).includes(canary),false);assert.equal(received[0].options.env.PGPASSWORD,canary);assert.equal(queries.length,3);assert.equal(queries[0].request.sql,EMPTY_TARGET_SQL);assert.equal(queries[1].request.sql,MANAGED_OWNER_PREFLIGHT_SQL);assert.deepEqual(queries[1].options,{timeoutMs:15000});assert.ok(queries[2].request.file.endsWith("release-catalog.sql"));assert.equal(output[0].app_catalogue_verified,true);assert.equal(Object.hasOwn(output[0],"permissions_verified"),false);assert.equal(Object.hasOwn(output[0],"serverVersionNum"),false);assert.equal(output[0].owner_restore_strategy,"original_archive_owners_or_transaction_failure");assert.equal(output[0].managed_owners_verification,"pending_manual_source_catalog_comparison");assert.equal(output[0].release_required,"manual_managed_owners_auth_login_and_vault_unlock");assert.equal(output[0].vault_unlock,"pending_manual_in_isolated_app");assert.equal(JSON.stringify(output).includes(canary),false);assert.equal(JSON.stringify(output).includes(user),false);
}));
test("missing managed owner or forbidden ownership change aborts before Storage without an ownerless retry",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key);for(const diagnostic of ['role "managed_auth" does not exist','must be member of role "managed_auth"']){const output=[],received=[];let requests=0;assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),{spawn:fakeRestore(received,1,diagnostic+canary),query:async request=>targetReply(request),fetch(){requests++;throw new Error(canary);}}),1);assert.equal(received.length,1);assert.equal(received[0].args.includes("--no-owner"),false);assert.equal(received[0].args.includes("--single-transaction"),true);assert.equal(requests,0);assert.deepEqual(output,[{ok:false,operation:"backup",error:"PG_RESTORE_FAILED"}]);assert.equal(JSON.stringify(output).includes(diagnostic),false);assert.equal(JSON.stringify(output).includes(canary),false);}
}));
test("restore refuses production target, unconfirmed or nonempty isolated target and tampering before processes/Storage",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key),env=environment(directory,key);assert.throws(()=>restoreConfiguration({...env,SC_RESTORE_PROJECT_REF:PERSONAL_REF,SC_RESTORE_CONFIRM_PROJECT:PERSONAL_REF}),/ISOLATED/);assert.throws(()=>restoreConfiguration({...env,SC_RESTORE_CONFIRM_PROJECT:"different"}),/ISOLATED/);
 let spawned=0,remote=0;const deps={spawn(){spawned++;},query:async()=>{remote++;return{empty:false};}};const output=[];assert.equal(await runBackupCli(["restore",source.path],env,value=>output.push(value),deps),1);assert.equal(spawned,0);assert.equal(remote,1);assert.equal(output[0].error,"RESTORE_TARGET_NOT_EMPTY");
 const bytes=await readFile(source.path);bytes[bytes.length-1]^=1;await writeFile(source.path,bytes);remote=0;assert.equal(await runBackupCli(["restore",source.path],env,()=>undefined,deps),1);assert.equal(remote,0);assert.equal(spawned,0);
}));
test("native restore failure prevents object writes and returns only closed failure codes",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key),output=[],received=[];let requests=0;assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),{spawn:fakeRestore(received,1),query:async request=>targetReply(request),fetch(){requests++;throw new Error(canary);}}),1);assert.equal(requests,0);assert.deepEqual(output,[{ok:false,operation:"backup",error:"PG_RESTORE_FAILED"}]);
}));
test("restore rejects object hash mismatch and permission drift without declaring success",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key),output=[];const deps={spawn:fakeRestore([]),query:async request=>targetReply(request,{ok:false,deviations:[{check:"grant",object:"safe_metadata"}]}),fetch:async(_,options)=>{for await(const bytes of options.body)assert.ok(bytes.length);return{ok:true};},storage:{download:async()=>Readable.from([Buffer.from("wrong")])}};assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),deps),1);assert.equal(output[0].error,"RESTORED_OBJECT_BYTES_MISMATCH");
 output.length=0;deps.storage.download=async()=>Readable.from([source.bytes]);assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),deps),1);assert.equal(output[0].error,"RESTORED_CATALOGUE_DEVIATIONS");
}));
test("restore upload errors release backpressure and return a closed failure before downloading or catalogue checks",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key);
 for(const failure of ["http","synchronous","asynchronous","during_stream"]){
  const output=[];let requests=0,downloads=0,catalogues=0,body,signal;
  const fetcher=(_,options)=>{requests++;body=options.body;signal=options.signal;if(failure==="synchronous")throw new Error(canary);if(failure==="asynchronous")return Promise.reject(new Error(canary));if(failure==="http")return Promise.resolve({ok:false,status:403});return(async()=>{for await(const bytes of body){assert.ok(bytes.length);throw new Error(canary);}})();};
  const restoring=runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),{spawn:fakeRestore([]),query:async request=>{if(request.file)catalogues++;return targetReply(request);},fetch:fetcher,storage:{download(){downloads++;throw new Error(canary);}}});
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
test("managed owner preflight is a fixed readonly catalogue projection with no hardcoded server major or table cap",()=>{
 assert.match(MANAGED_OWNER_PREFLIGHT_SQL,/^begin transaction isolation level repeatable read read only;/);
 assert.match(MANAGED_OWNER_PREFLIGHT_SQL,/set local statement_timeout = '10s';/);assert.match(MANAGED_OWNER_PREFLIGHT_SQL,/set local lock_timeout = '3s';/);assert.match(MANAGED_OWNER_PREFLIGHT_SQL,/set local search_path = pg_catalog;/);assert.match(MANAGED_OWNER_PREFLIGHT_SQL,/rollback;$/);
 assert.equal(MANAGED_OWNER_PREFLIGHT_SQL.includes("auth.users"),false);assert.equal(MANAGED_OWNER_PREFLIGHT_SQL.includes("storage.objects"),false);assert.equal(MANAGED_OWNER_PREFLIGHT_SQL.includes(canary),false);
 for(const serverVersionNum of [1,150000,170011,180004,Number.MAX_SAFE_INTEGER])assert.doesNotThrow(()=>assertManagedOwnerPreflight(managedOwners({serverVersionNum,tables:600,tableOwnerAvailable:600,tableDropOwnerOrSchemaAvailable:600})));
 assert.doesNotThrow(()=>assertManagedOwnerPreflight(managedOwners({isSuperuser:true})));
});
test("managed owner preflight rejects nonclosed shapes and never reads report getters",()=>{
 for(const report of [null,undefined,[],"metadata",{}, {...managedOwners(),extra:canary}])assert.throws(()=>assertManagedOwnerPreflight(report),/RESTORE_MANAGED_OWNER_REPORT_INVALID/);
 for(const field of Object.keys(managedOwners())){
  let reads=0;const getter=managedOwners();Object.defineProperty(getter,field,{enumerable:true,get(){reads++;throw new Error(canary);}});assert.throws(()=>assertManagedOwnerPreflight(getter),/RESTORE_MANAGED_OWNER_REPORT_INVALID/);assert.equal(reads,0);
  const hidden=managedOwners();Object.defineProperty(hidden,field,{value:hidden[field],enumerable:false});assert.throws(()=>assertManagedOwnerPreflight(hidden),/RESTORE_MANAGED_OWNER_REPORT_INVALID/);
  const inherited=managedOwners();delete inherited[field];Object.setPrototypeOf(inherited,{[field]:managedOwners()[field]});assert.throws(()=>assertManagedOwnerPreflight(inherited),/RESTORE_MANAGED_OWNER_REPORT_INVALID/);
 }
 let extraReads=0;const extra=managedOwners();Object.defineProperty(extra,"extra",{get(){extraReads++;throw new Error(canary);}});assert.throws(()=>assertManagedOwnerPreflight(extra),/RESTORE_MANAGED_OWNER_REPORT_INVALID/);assert.equal(extraReads,0);
 const symbol=managedOwners();symbol[Symbol("extra")]=canary;assert.throws(()=>assertManagedOwnerPreflight(symbol),/RESTORE_MANAGED_OWNER_REPORT_INVALID/);
});
test("managed owner preflight rejects coercion, nonfinite metadata and contradictory ownership counts",()=>{
 for(const field of ["serverVersionNum","schemas","schemaOwnerAvailable","schemaOwnerUnavailable","tables","tableOwnerAvailable","tableOwnerUnavailable","tableDropOwnerOrSchemaAvailable","tableDropOwnerOrSchemaUnavailable"]){for(const value of ["2",null,true,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>assertManagedOwnerPreflight(managedOwners({[field]:value})),/RESTORE_MANAGED_OWNER_REPORT_INVALID/);}
 for(const overrides of [{version:"1"},{version:2},{serverVersionNum:0},{sameActor:"true"},{isSuperuser:1},{schemas:1,schemaOwnerAvailable:1},{tables:0,tableOwnerAvailable:0,tableDropOwnerOrSchemaAvailable:0},{schemaOwnerAvailable:3},{tableOwnerAvailable:34},{tableDropOwnerOrSchemaAvailable:34},{schemaOwnerAvailable:0,schemaOwnerUnavailable:2,tableOwnerAvailable:34,tableOwnerUnavailable:1},{isSuperuser:true,tableOwnerAvailable:34,tableOwnerUnavailable:1}])assert.throws(()=>assertManagedOwnerPreflight(managedOwners(overrides)),/RESTORE_MANAGED_OWNER_REPORT_INVALID/);
});
test("managed preflight requires table ownership for ALTER even when the schema owner could DROP",()=>{
 for(const overrides of [{sameActor:false},{schemaOwnerAvailable:1,schemaOwnerUnavailable:1},{tableOwnerAvailable:34,tableOwnerUnavailable:1},{schemaOwnerAvailable:0,schemaOwnerUnavailable:2,tableOwnerAvailable:0,tableOwnerUnavailable:35,tableDropOwnerOrSchemaAvailable:0,tableDropOwnerOrSchemaUnavailable:35}])assert.throws(()=>assertManagedOwnerPreflight(managedOwners(overrides)),/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/);
});
test("unqualified or failed owner preflight prevents native restore and Storage without leaking its report",async()=>fixture(async directory=>{
 const key=randomBytes(32).toString("base64"),source=await archive(directory,key);
 for(const [reply,error] of [[managedOwners({schemaOwnerAvailable:1,schemaOwnerUnavailable:1}),"RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED"],[managedOwners({tableOwnerAvailable:34,tableOwnerUnavailable:1}),"RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED"],[{...managedOwners(),extra:canary},"RESTORE_MANAGED_OWNER_REPORT_INVALID"],[new BackupError("PSQL_FAILED"),"PSQL_FAILED"]]){
  const output=[],queries=[];let spawned=0,requests=0;
  assert.equal(await runBackupCli(["restore",source.path],environment(directory,key),value=>output.push(value),{query:async(request,options)=>{queries.push({request,options});if(request.sql===EMPTY_TARGET_SQL)return{empty:true};assert.equal(request.sql,MANAGED_OWNER_PREFLIGHT_SQL);if(reply instanceof Error)throw reply;return reply;},spawn(){spawned++;throw new Error(canary);},fetch(){requests++;throw new Error(canary);}}),1);
  assert.equal(queries.length,2);assert.deepEqual(queries[1].options,{timeoutMs:15000});assert.equal(spawned,0);assert.equal(requests,0);assert.deepEqual(output,[{ok:false,operation:"backup",error}]);assert.equal(JSON.stringify(output).includes(canary),false);assert.equal(JSON.stringify(output).includes(user),false);
 }
}));
test("native database sink refuses open before qualification and while the owned query is pending",async()=>fixture(async directory=>{
 const waiting=deferred(),entered=deferred();let spawned=0,requests=0;
 const sinks=isolatedRestoreSinks(restoreConfiguration(environment(directory,randomBytes(32).toString("base64"))),{query:async request=>{if(request.sql===EMPTY_TARGET_SQL)return{empty:true};assert.equal(request.sql,MANAGED_OWNER_PREFLIGHT_SQL);entered.resolve();return waiting.promise;},spawn(){spawned++;throw new Error(canary);},fetch(){requests++;throw new Error(canary);}});
 await assert.rejects(sinks.open(DATABASE_METADATA),/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/);
 const qualifying=sinks.header();await entered.promise;await assert.rejects(sinks.open(DATABASE_METADATA),/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/);waiting.resolve(managedOwners());await qualifying;
 const sink=await sinks.open(DATABASE_METADATA);await sink.abort();assert.equal(spawned,0);assert.equal(requests,0);
}));
test("a retained database sink cannot borrow a later owner qualification after failed or successful reentry",async()=>fixture(async directory=>{
 const received=[],native=fakeRestore(received);let failure=null,spawned=0,requests=0;
 const sinks=isolatedRestoreSinks(restoreConfiguration(environment(directory,randomBytes(32).toString("base64"))),{query:async request=>{if(request.sql===EMPTY_TARGET_SQL)return{empty:failure!=="empty"};if(failure==="query")throw new BackupError("PSQL_FAILED");return failure==="ownership"?managedOwners({tableOwnerAvailable:34,tableOwnerUnavailable:1}):managedOwners();},spawn(...args){spawned++;return native(...args);},fetch(){requests++;throw new Error(canary);}});
 await sinks.header();const old=await sinks.open(DATABASE_METADATA);
 for(const [kind,error] of [["ownership",/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/],["empty",/RESTORE_TARGET_NOT_EMPTY/],["query",/PSQL_FAILED/]]){failure=kind;await assert.rejects(sinks.header(),error);await assert.rejects(old.write(Buffer.from("PGDMP old")),/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/);assert.equal(spawned,0);}
 failure=null;await sinks.header();await assert.rejects(old.write(Buffer.from("PGDMP stale")),/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/);await old.abort();assert.equal(spawned,0);
 const current=await sinks.open(DATABASE_METADATA);await current.write(Buffer.from("PGDMP current"));await current.close();assert.equal(spawned,1);assert.equal(received.length,1);assert.equal(received[0].bytes.toString(),"PGDMP current");assert.equal(requests,0);
}));
test("a late successful header cannot heal the newer failed qualification before native start",async()=>fixture(async directory=>{
 const firstReply=deferred(),entered=deferred();let ownerQueries=0,spawned=0,requests=0;
 const sinks=isolatedRestoreSinks(restoreConfiguration(environment(directory,randomBytes(32).toString("base64"))),{query:async request=>{if(request.sql===EMPTY_TARGET_SQL)return{empty:true};assert.equal(request.sql,MANAGED_OWNER_PREFLIGHT_SQL);if(++ownerQueries===1){entered.resolve();return firstReply.promise;}return managedOwners({tableOwnerAvailable:34,tableOwnerUnavailable:1});},spawn(){spawned++;throw new Error(canary);},fetch(){requests++;throw new Error(canary);}});
 const first=sinks.header();first.catch(()=>undefined);await entered.promise;await assert.rejects(sinks.header(),/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/);firstReply.resolve(managedOwners());await assert.rejects(first,/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/);await assert.rejects(sinks.open(DATABASE_METADATA),/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/);assert.equal(ownerQueries,2);assert.equal(spawned,0);assert.equal(requests,0);
}));
test("original managed owner SQL measures session identity, role USAGE and DROP versus ALTER in disposable PGlite RAM",async()=>{
 // Semantic SQL proof only: no Supabase service, native executable, credential
 // or archive. This does not qualify hosted DDL or archive compatibility.
 // Separate owned instances avoid relying on RESET SESSION AUTHORIZATION,
 // which did not restore the initial superuser in this embedded runtime.
 for(const mode of ["no-inherit","schema-only","all-owners"]){
  const db=new PGlite();
  try{
   await db.exec(`create role sc_restore_auth_owner nologin;
create role sc_restore_storage_owner nologin;
create role sc_restore_table_owner nologin;
create role sc_restore_operator login nosuperuser noinherit;
create schema auth authorization sc_restore_auth_owner;
create schema storage authorization sc_restore_storage_owner;
create table auth.owner_probe(marker integer);
create table storage.owner_probe(marker integer);
create table storage.restricted_probe(marker integer);
alter table auth.owner_probe owner to sc_restore_auth_owner;
alter table storage.owner_probe owner to sc_restore_storage_owner;
alter table storage.restricted_probe owner to sc_restore_table_owner;
insert into auth.owner_probe values(11);
insert into storage.owner_probe values(22);
insert into storage.restricted_probe values(33);
grant usage on schema auth,storage to sc_restore_operator;
grant select on auth.owner_probe,storage.owner_probe,storage.restricted_probe to sc_restore_operator;
grant sc_restore_auth_owner,sc_restore_storage_owner to sc_restore_operator with inherit false;`);
   if(mode!=="no-inherit")await db.exec("grant sc_restore_auth_owner,sc_restore_storage_owner to sc_restore_operator with inherit true;");
   if(mode==="all-owners")await db.exec("grant sc_restore_table_owner to sc_restore_operator with inherit true;");
   const before=await db.query("select marker from auth.owner_probe union all select marker from storage.owner_probe union all select marker from storage.restricted_probe order by marker");
   const original=async()=>{
    const result=await db.exec(MANAGED_OWNER_PREFLIGHT_SQL),rows=result.flatMap(reply=>reply.rows);
    assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]),["jsonb_build_object"]);
    const report=rows[0].jsonb_build_object;assert.deepEqual(Object.keys(report).sort(),Object.keys(managedOwners()).sort());assert.ok(Number.isSafeInteger(report.serverVersionNum)&&report.serverVersionNum>0);
    assert.equal((await db.query("select current_setting('transaction_read_only') as readonly")).rows[0].readonly,"off");
    return report;
   };
   const superuser=await original();assert.deepEqual(superuser,managedOwners({serverVersionNum:superuser.serverVersionNum,isSuperuser:true,tables:3,tableOwnerAvailable:3,tableDropOwnerOrSchemaAvailable:3}));assert.doesNotThrow(()=>assertManagedOwnerPreflight(superuser));
   await db.exec("set session authorization sc_restore_operator;");
   const report=await original();
   if(mode==="no-inherit"){
    assert.deepEqual(report,managedOwners({serverVersionNum:report.serverVersionNum,schemaOwnerAvailable:0,schemaOwnerUnavailable:2,tables:3,tableOwnerAvailable:0,tableOwnerUnavailable:3,tableDropOwnerOrSchemaAvailable:0,tableDropOwnerOrSchemaUnavailable:3}));assert.throws(()=>assertManagedOwnerPreflight(report),/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/);
   }else if(mode==="schema-only"){
    assert.deepEqual(report,managedOwners({serverVersionNum:report.serverVersionNum,tables:3,tableOwnerAvailable:2,tableOwnerUnavailable:1,tableDropOwnerOrSchemaAvailable:3}));assert.throws(()=>assertManagedOwnerPreflight(report),/RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED/);
    // Exercise real privileges on synthetic objects, then roll back the DROP.
    await db.exec("begin; drop table storage.restricted_probe; rollback;");
    await assert.rejects(db.exec("alter table storage.restricted_probe add column denied integer;"),/must be owner/);
   }else{
    assert.deepEqual(report,managedOwners({serverVersionNum:report.serverVersionNum,tables:3,tableOwnerAvailable:3,tableDropOwnerOrSchemaAvailable:3}));assert.doesNotThrow(()=>assertManagedOwnerPreflight(report));
   }
   assert.deepEqual(await db.query("select marker from auth.owner_probe union all select marker from storage.owner_probe union all select marker from storage.restricted_probe order by marker"),before);
   assert.equal((await db.query("select count(*)::integer as denied_columns from pg_attribute where attrelid='storage.restricted_probe'::regclass and attname='denied' and not attisdropped")).rows[0].denied_columns,0);
  }finally{await db.close();}
 }
});
