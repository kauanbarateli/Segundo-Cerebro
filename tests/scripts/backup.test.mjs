import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable, PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { argon2id } from "hash-wasm";
import { gzipSync } from "node:zlib";
import { writeBackup, readBackup } from "../../scripts/operations/backup-format.mjs";
import { restoreVerifiedBackup } from "../../scripts/operations/restore-verify.mjs";
import { encryptionSettings, safeBackupDirectory, postgresEnvironment, PERSONAL_REF, REPO_ROOT } from "../../scripts/operations/backup-config.mjs";
import { backupEntries, DATABASE_METADATA, pgDumpSource, storageSource } from "../../scripts/operations/backup-sources.mjs";
import { runBackupCli } from "../../scripts/operations/backup.mjs";
const user = "11111111-1111-4111-8111-111111111111";
const header = { project_ref:PERSONAL_REF,key_id:"fixture-v1",created_at:"2026-10-09T12:00:00Z" };
const object = (bytes,index=0) => ({metadata:{kind:"storage",bucket:"second-brain-files",path:user + "/private-" + index + ".bin",object_id:"object-" + index,source_updated_at:"2026-10-09T12:00:00Z",mime:"application/octet-stream",expected_bytes:bytes.length},bytes});
async function* entries(database,objects) { yield {metadata:DATABASE_METADATA,stream:Readable.from([database])}; for (const row of objects) yield {metadata:row.metadata,stream:Readable.from([row.bytes.subarray(0,17),row.bytes.subarray(17)])}; }
async function fixture(action) { const directory = await mkdtemp(join(tmpdir(),"sc-backup-test-")); try { return await action(directory); } finally { await rm(directory,{recursive:true,force:true}); } }
test("fixture 1 preserves Auth UUIDs and exact original object bytes during verified restore", async () => fixture(async directory => {
 const key = randomBytes(32), database = Buffer.from("PGDMP fixture auth.users.id=" + user), objects = [object(Buffer.from([0,255,1,2,0,100]))], file = join(directory,"one.scbackup");
 const report = await writeBackup(file,key,header,entries(database,objects)); assert.equal(report.entries,2); const restored = [];
 await restoreVerifiedBackup(file,key,{async open(metadata) { const chunks=[]; return {async write(bytes) {chunks.push(Buffer.from(bytes));},async close(summary) {restored.push({metadata,bytes:Buffer.concat(chunks),summary});}};}});
 assert.deepEqual(restored[0].bytes,database); assert.match(restored[0].bytes.toString(),new RegExp(user)); assert.deepEqual(restored[1].bytes,objects[0].bytes);
 const persisted = await readFile(file); assert.equal(persisted.includes(Buffer.from(user)),false); assert.equal(persisted.includes(Buffer.from(objects[0].metadata.path)),false);
}));
test("fixture 2 keeps the actual Cofre password wrapper, AAD identity and ciphertext decryptable", async () => fixture(async directory => {
 const id = "22222222-2222-4222-8222-222222222222", dataKey = randomBytes(32), salt = randomBytes(16), password = "FixtureSenhaMestra2026!";
 const wrapping = Buffer.from(await argon2id({password,salt,memorySize:65536,iterations:3,parallelism:1,hashLength:32,outputType:"binary"}));
 const seal = (key,bytes,aad) => {const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(Buffer.from(aad));return {iv:iv.toString("base64"),ciphertext:Buffer.concat([cipher.update(bytes),cipher.final(),cipher.getAuthTag()]).toString("base64")};};
 const openEnvelope = (key,envelope,aad) => {const bytes=Buffer.from(envelope.ciphertext,"base64"),cipher=createDecipheriv("aes-256-gcm",key,Buffer.from(envelope.iv,"base64"));cipher.setAAD(Buffer.from(aad));cipher.setAuthTag(bytes.subarray(-16));return Buffer.concat([cipher.update(bytes.subarray(0,-16)),cipher.final()]);};
 const original = {auth_users:[{id:user}],vault_header:{user_id:user,salt:salt.toString("base64"),master:seal(wrapping,dataKey,user + ":master:1")},vault_items:[{id,user_id:user,version:1,envelope:seal(dataKey,Buffer.from("Cofre fixture privado"),user + ":" + id + ":1")}]};
 const database = Buffer.concat([Buffer.from("PGDMP"),Buffer.from(JSON.stringify(original))]), objects = [object(randomBytes(4097)),object(Buffer.alloc(0),1)], file = join(directory,"two.scbackup"), key=randomBytes(32);
 await writeBackup(file,key,header,entries(database,objects)); let restoredDatabase;
 await restoreVerifiedBackup(file,key,{async open(metadata) {const chunks=[];return {async write(bytes) {chunks.push(Buffer.from(bytes));},async close() {if(metadata.kind==="database")restoredDatabase=Buffer.concat(chunks);}};}});
 assert.deepEqual(restoredDatabase,database); const restored=JSON.parse(restoredDatabase.subarray(5)); assert.equal(restored.auth_users[0].id,user);
 const recoveredKey=openEnvelope(wrapping,restored.vault_header.master,user + ":master:1"); assert.equal(openEnvelope(recoveredKey,restored.vault_items[0].envelope,user + ":" + id + ":1").toString(),"Cofre fixture privado");
 wrapping.fill(0);recoveredKey.fill(0);dataKey.fill(0);
}));
test("wrong key, flipped bytes, truncation, appended bytes and missing final frame fail before restore sinks", async () => fixture(async directory => {
 const key=randomBytes(32),file=join(directory,"valid.scbackup");await writeBackup(file,key,header,entries(Buffer.from("PGDMP"),[]));await assert.rejects(readBackup(file,randomBytes(32)),/BACKUP_AUTHENTICATION_FAILED/);
 const bytes=await readFile(file),flipped=Buffer.from(bytes);flipped[flipped.length-1]^=1;
 for (const [name,value] of [["flipped",flipped],["truncated",bytes.subarray(0,-1)],["appended",Buffer.concat([bytes,Buffer.from([1])])],["missing",bytes.subarray(0,bytes.length-80)]]) {const corrupt=join(directory,name);await writeFile(corrupt,value);let opened=0;await assert.rejects(restoreVerifiedBackup(corrupt,key,{open(){opened++;}}));assert.equal(opened,0);}
}));
test("key rotation creates independent archives and preserves original key-id selection", async () => fixture(async directory => {
 const a=randomBytes(32),b=randomBytes(32),one=join(directory,"a"),two=join(directory,"b");await writeBackup(one,a,header,entries(Buffer.from("A"),[]));await writeBackup(two,b,{...header,key_id:"fixture-v2"},entries(Buffer.from("B"),[]));assert.equal((await readBackup(one,a)).database_entries,1);assert.equal((await readBackup(two,b)).database_entries,1);await assert.rejects(readBackup(one,b));await assert.rejects(readBackup(two,a));
}));
test("source failure, duplicate entries and size mismatch never publish a final or partial backup", async () => fixture(async directory => {
 const key=randomBytes(32),file=join(directory,"failure");async function* failed(){yield {metadata:DATABASE_METADATA,stream:(async function*(){yield Buffer.from("private");throw new Error("canary");})()};}await assert.rejects(writeBackup(file,key,header,failed()));
 async function* duplicates(){yield* entries(Buffer.from("A"),[]);yield* entries(Buffer.from("B"),[]);}await assert.rejects(writeBackup(file,key,header,duplicates()),/DUPLICATE_ENTRY/);
 const bad=object(Buffer.from("bytes"));bad.metadata.expected_bytes++;await assert.rejects(writeBackup(file,key,header,entries(Buffer.from("DB"),[bad])),/OBJECT_SIZE_CHANGED/);assert.deepEqual(await readdir(directory),[]);
}));
test("destination refuses repository/work/app-serving/OneDrive roots and independent-key guard refuses reuse", async () => fixture(async directory => {
 await assert.rejects(safeBackupDirectory(join(REPO_ROOT,"work","backups")),/UNSAFE/);await assert.rejects(safeBackupDirectory(join(directory,"OneDrive","backups")),/UNSAFE/);await assert.rejects(safeBackupDirectory(join(directory,"served"),{forbiddenRoots:[directory]}),/UNSAFE/);assert.equal(await safeBackupDirectory(join(directory,"outside")),resolve(directory,"outside"));
 const key=randomBytes(32).toString("base64");assert.throws(()=>encryptionSettings({SC_BACKUP_ENCRYPTION_KEY:key,SC_BACKUP_KEY_ID:"v1",AUTH_STATE_SECRET:key}),/INDEPENDENT/);assert.throws(()=>postgresEnvironment({PGHOST:"business.example",PGUSER:"postgres",PGPASSWORD:"private"}),/PERSONAL/);
}));
test("pg_dump receives Auth+app+Storage schemas with secrets only in env and sanitized failure", async () => {
 const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),kill(){}});let args;const source=pgDumpSource("/fake/pg_dump",{PGPASSWORD:"never-argv"},(exe,argv,options)=>{args={exe,argv,options};return child;});const collecting=(async()=>{const result=[];for await(const bytes of source.stream())result.push(bytes);return Buffer.concat(result);})();child.stdout.end(Buffer.from("PGDMP"));child.stderr.end(Buffer.from("never-argv"));child.emit("close",0);assert.equal((await collecting).toString(),"PGDMP");assert.ok(args.argv.includes("--schema=auth"));for(const forbidden of ["--no-privileges","--no-acl","--no-owner","-O"])assert.equal(args.argv.includes(forbidden),false);assert.equal(source.metadata.preserves_grants,true);assert.equal(source.metadata.preserves_owners,true);assert.equal(JSON.stringify(args.argv).includes("never-argv"),false);assert.equal(args.options.env.PGPASSWORD,"never-argv");assert.equal(args.options.shell,false);
});
test("fake dump+Storage CLI creates/verifies a backup and emits metadata without credentials, UUIDs or names", async () => fixture(async directory => {
 const key=randomBytes(32).toString("base64"),row=object(Buffer.from("source bytes")),storage={inventory:async()=>[row.metadata],fingerprint:rows=>JSON.stringify(rows),download:async()=>Readable.from([row.bytes])},pgDump={metadata:DATABASE_METADATA,stream:()=>Readable.from([Buffer.from("PGDMP " + user)])},output=[];
 const env={SC_BACKUP_ENCRYPTION_KEY:key,SC_BACKUP_KEY_ID:"fixture-v1",SC_BACKUP_DESTINATION:directory,SC_BACKUP_PG_DUMP:resolve(directory,"not-installed-pg_dump"),SC_BACKUP_QUIESCED:"YES",SC_BACKUP_SUPABASE_URL:"https://" + PERSONAL_REF + ".supabase.co",SC_BACKUP_SUPABASE_KEY:"sb_secret_fixture_canary",PGHOST:"db." + PERSONAL_REF + ".supabase.co",PGUSER:"postgres",PGDATABASE:"postgres",PGPASSWORD:"password-canary",PGSSLMODE:"require"};
 assert.equal(await runBackupCli(["create"],env,value=>output.push(value),{storage,pgDump}),0);const file=join(directory,output[0].archive_name);assert.equal(await runBackupCli(["verify",file],env,value=>output.push(value)),0);assert.equal(JSON.stringify(output).includes(key),false);assert.equal(JSON.stringify(output).includes("canary"),false);assert.equal(JSON.stringify(output).includes(user),false);assert.equal(JSON.stringify(output).includes("private-0"),false);
}));
test("archives without the original-owner strategy are refused instead of silently enabling ownerless restore",async()=>fixture(async directory=>{
 const key=randomBytes(32),file=join(directory,"ownerless");for(const metadata of [{...DATABASE_METADATA,preserves_owners:false},Object.fromEntries(Object.entries(DATABASE_METADATA).filter(([name])=>name!=="preserves_owners"))]){await assert.rejects(writeBackup(file,key,header,(async function*(){yield{metadata,stream:Readable.from([Buffer.from("PGDMP")])};})()),/INVALID_ENTRY/);}assert.deepEqual(await readdir(directory),[]);
}));
test("restore snapshots ciphertext before verification, so swapping the source before sinks cannot change restored bytes",async()=>fixture(async directory=>{
 const key=randomBytes(32),file=join(directory,"archive"),original=Buffer.from("PGDMP original");await writeBackup(file,key,header,entries(original,[]));const output=[];
 await restoreVerifiedBackup(file,key,{async header(){await writeFile(file,Buffer.from("replaced"));},async open(){return{async write(bytes){output.push(Buffer.from(bytes));},async close(){}};}});assert.deepEqual(Buffer.concat(output),original);
}));
test("existing archive is never overwritten by publication and incomplete native dump errors remain sanitized",async()=>fixture(async directory=>{
 const file=join(directory,"existing"),before=Buffer.from("existing ciphertext");await writeFile(file,before);await assert.rejects(writeBackup(file,randomBytes(32),header,entries(Buffer.from("PGDMP"),[])));assert.deepEqual(await readFile(file),before);assert.deepEqual(await readdir(directory),["existing"]);
}));
test("raw HTTPS object source preserves stored gzip bytes instead of fetch content decoding and refuses redirects",async()=>{
 const stored=gzipSync(Buffer.from("Original object bytes"));let seen;
 const source=storageSource("https://"+PERSONAL_REF+".supabase.co","sb_secret_not_printed",()=>{throw new Error("fetch must not download raw objects");},(url,options,callback)=>{seen={url,options};return Object.assign(new EventEmitter(),{setTimeout(){},end(){const reply=Readable.from([stored]);reply.statusCode=200;reply.headers={"content-encoding":"gzip"};callback(reply);}});});
 const chunks=[];for await(const bytes of await source.download(object(stored).metadata))chunks.push(bytes);assert.deepEqual(Buffer.concat(chunks),stored);assert.equal(seen.options.headers["Accept-Encoding"],"identity");
 const redirected=storageSource("https://"+PERSONAL_REF+".supabase.co","inert",undefined,(_,__,callback)=>Object.assign(new EventEmitter(),{setTimeout(){},end(){const reply=Readable.from([]);reply.statusCode=302;callback(reply);}}));await assert.rejects(redirected.download(object(stored).metadata),/STORAGE_REQUEST_FAILED/);
});
test("inventory change fails closed and unknown operator arguments never start a source", async () => fixture(async directory => {
 const key=randomBytes(32),row=object(Buffer.from("x"));let reads=0;const storage={inventory:async()=>++reads===1?[row.metadata]:[],fingerprint:rows=>JSON.stringify(rows),download:async()=>Readable.from([row.bytes])},pgDump={metadata:DATABASE_METADATA,stream:()=>Readable.from([Buffer.from("PGDMP")])};await assert.rejects(writeBackup(join(directory,"changed"),key,header,backupEntries({}, {storage,pgDump})),/STORAGE_CHANGED/);const output=[];assert.equal(await runBackupCli(["unsupported"],{},value=>output.push(value)),1);assert.deepEqual(output,[{ok:false,operation:"backup",error:"INVALID_ARGUMENTS"}]);
}));
