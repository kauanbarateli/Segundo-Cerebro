import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { backupEntries, pgDumpSource, assertBackupEntriesCurrent, DATABASE_METADATA } from "../../scripts/operations/backup-sources.mjs";
import { runBackupCli } from "../../scripts/operations/backup.mjs";

const code=value=>error=>error?.code===value;
function childFixture() {
 const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),kills:0,kill(){this.kills++;return true;}});
 return child;
}
async function collect(source) {
 const copies=[];
 for await(const chunk of source.stream())copies.push(Buffer.from(chunk));
 return Buffer.concat(copies);
}
async function eof(child,bytes=Buffer.from("PGDMP public fixture")) {
 const ends=Promise.all([once(child.stdout,"end"),once(child.stderr,"end")]);
 child.stdout.end(bytes);child.stderr.end();
 await ends;
}
function terminal(child) {child.emit("exit",0,null);child.emit("close",0,null);}
function storageFixture(after) {
 let inventoryCalls=0;
 return {async inventory(){if(++inventoryCalls===2)await after?.();return [];},fingerprint:()=>"",download(){throw Error("no objects in fixture");}};
}
function entryFixture(after) {
 const child=childFixture(),storage=storageFixture(after),entries=backupEntries({pgDump:"/public/pg_dump",pg:{}},{storage,spawn:()=>child});
 const consume=(async()=>{const bytes=[];for await(const entry of entries)for await(const chunk of entry.stream)bytes.push(Buffer.from(chunk));return Buffer.concat(bytes);})();
 return {child,entries,consume};
}
async function startEntries(fixture) {
 // storage.inventory() is async; let the original factory install its listeners.
 await Promise.resolve();await Promise.resolve();
 fixture.child.emit("spawn");
}

test("original stdout/stderr EOF plus spawn/exit0/close0 qualify unchanged custom bytes",async()=>{
 const child=childFixture(),payload=Buffer.from([80,71,68,77,80,0,10,13,255,0]),source=pgDumpSource("/public/pg_dump",{},()=>child),result=collect(source);
 child.emit("spawn");await eof(child,payload);terminal(child);
 assert.deepEqual(await result,Buffer.from([80,71,68,77,80,0,10,13,255,0]));
 assert.deepEqual(payload,Buffer.alloc(payload.length));
 assert.equal(child.kills,0);
});
test("persistent nominal guard survives iterator exhaustion and late original process errors",async()=>{
 const fixture=entryFixture();await startEntries(fixture);await eof(fixture.child);terminal(fixture.child);await fixture.consume;
 assert.doesNotThrow(()=>assertBackupEntriesCurrent(fixture.entries));
 fixture.child.emit("error",Error("provider private canary"));
 assert.throws(()=>assertBackupEntriesCurrent(fixture.entries),code("PG_DUMP_UNAVAILABLE"));
});
for(const [name,emit] of [
 ["duplicate child close",child=>child.emit("close",0,null)],
 ["duplicate child exit",child=>child.emit("exit",0,null)],
 ["late nonzero exit",child=>child.emit("exit",1,null)],
 ["late stdout end",child=>child.stdout.emit("end")],
 ["late stderr end",child=>child.stderr.emit("end")],
 ["late stderr error",child=>child.stderr.emit("error",Error("private"))],
 ["late stdout aborted",child=>child.stdout.emit("aborted")],
 ["late spawn",child=>child.emit("spawn")],
])test(name+" vetoes the same retained guard",async()=>{
 const fixture=entryFixture();await startEntries(fixture);await eof(fixture.child);terminal(fixture.child);await fixture.consume;
 emit(fixture.child);
 assert.throws(()=>assertBackupEntriesCurrent(fixture.entries),code("PG_DUMP_FAILED"));
});
for(const [name,finish] of [
 ["missing original exit",child=>child.emit("close",0,null)],
 ["nonzero exit",child=>{child.emit("exit",1,null);child.emit("close",1,null);}],
 ["exit signal",child=>{child.emit("exit",0,"SIGTERM");child.emit("close",0,null);}],
 ["close signal",child=>{child.emit("exit",0,null);child.emit("close",0,"SIGTERM");}],
 ["undefined terminal signals",child=>{child.emit("exit",0);child.emit("close",0);}],
])test(name+" cannot qualify on close zero",async()=>{
 const child=childFixture(),source=pgDumpSource("/public/pg_dump",{},()=>child),result=collect(source);
 child.emit("spawn");await eof(child);finish(child);
 await assert.rejects(result,code("PG_DUMP_FAILED"));
});
test("missing spawn cannot qualify on original EOFs/exit0/close0",async()=>{
 const child=childFixture(),result=collect(pgDumpSource("/public/pg_dump",{},()=>child));await eof(child);terminal(child);
 await assert.rejects(result,code("PG_DUMP_FAILED"));
});
test("close without original stderr EOF refuses rather than treating resumed stderr as complete",async()=>{
 const child=childFixture(),result=collect(pgDumpSource("/public/pg_dump",{},()=>child));
 child.emit("spawn");const stdoutEnd=once(child.stdout,"end");child.stdout.end(Buffer.from("PGDMP"));await stdoutEnd;
 terminal(child);await assert.rejects(result,code("PG_DUMP_FAILED"));child.stderr.destroy();
});
test("premature stdout close and cancellation ACK never supply EOF",async()=>{
 const child=childFixture(),result=collect(pgDumpSource("/public/pg_dump",{},()=>child));child.emit("spawn");child.stdout.destroy();child.stderr.end();
 await assert.rejects(result,code("PG_DUMP_FAILED"));assert.ok(child.kills>=1);
});
test("spawn throws are sanitized without provider messages",()=>{
 assert.throws(()=>pgDumpSource("/public/pg_dump",{},()=>{throw Error("private canary");}),error=>error.code==="PG_DUMP_UNAVAILABLE"&&!JSON.stringify(error).includes("canary"));
});
test("a frozen lookalike iterator cannot borrow the nominal entry guard",()=>{
 assert.throws(()=>assertBackupEntriesCurrent(Object.freeze({})),code("BACKUP_SOURCE_REQUIRED"));
});
test("unfinished synthetic entries remain incomplete and do not attest native process origin",async()=>{
 const entries=backupEntries({}, {storage:storageFixture(),pgDump:{metadata:DATABASE_METADATA,stream:()=>Readable.from([Buffer.from("PGDMP synthetic")])}});
 assert.throws(()=>assertBackupEntriesCurrent(entries),code("BACKUP_SOURCE_INCOMPLETE"));
 for await(const entry of entries)for await(const chunk of entry.stream)assert.equal(chunk.toString(),"PGDMP synthetic");
 assert.doesNotThrow(()=>assertBackupEntriesCurrent(entries));
});
test("original guard is rechecked after the second Storage inventory await",async()=>{
 let child;const fixture=entryFixture(async()=>{child.emit("error",Error("private"));});child=fixture.child;
 await startEntries(fixture);await eof(child);terminal(child);
 await assert.rejects(fixture.consume,code("PG_DUMP_UNAVAILABLE"));
});
test("late original failure after dump completion cannot emit ok or delete earlier archives",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"sc-backup-native-guard-")),child=childFixture(),output=[];
 const env={SC_BACKUP_ENCRYPTION_KEY:randomBytes(32).toString("base64"),SC_BACKUP_KEY_ID:"fixture-v1",SC_BACKUP_DESTINATION:directory,SC_BACKUP_PG_DUMP:join(directory,"public-fixture"),SC_BACKUP_QUIESCED:"YES",SC_BACKUP_SUPABASE_URL:"https://rishenjoikgmfubmnfiu.supabase.co",SC_BACKUP_SUPABASE_KEY:"sb_secret_synthetic",PGHOST:"db.rishenjoikgmfubmnfiu.supabase.co",PGUSER:"postgres",PGDATABASE:"postgres",PGPASSWORD:"synthetic",PGSSLMODE:"require"};
 const storage=storageFixture(()=>{setImmediate(()=>child.emit("error",Error("private")));});
 try {
  await writeFile(join(directory,"earlier.scbackup"),Buffer.from("earlier verified archive preserved"));
  const result=runBackupCli(["create"],env,value=>output.push(value),{storage,spawn:()=>{
   queueMicrotask(async()=>{child.emit("spawn");await eof(child);terminal(child);});
   return child;
  }});
  assert.equal(await result,1);assert.equal(output.some(value=>value.ok),false);
  assert.equal(output[0].error,"PG_DUMP_UNAVAILABLE");
  const files=await readdir(directory);
  assert.equal(files.filter(name=>name.endsWith(".report.json")).length,0);
  assert.deepEqual(await readFile(join(directory,"earlier.scbackup")),Buffer.from("earlier verified archive preserved"));
  for(const name of files.filter(name=>name.endsWith(".scbackup")))assert.ok((await readFile(join(directory,name))).length>0);
 } finally {await rm(directory,{recursive:true,force:true});}
});
