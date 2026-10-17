import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { BackupError } from "./backup-format.mjs";
export const DATABASE_METADATA = { kind:"database",preserves_auth_uuids:true,preserves_grants:true,preserves_owners:true,schemas:["auth","public","app_private","storage"] };
const fail = code => { throw new BackupError(code); };
const nativeDumpChecks = new WeakMap();
const backupEntryChecks = new WeakMap();
/** Credentials are exclusively in child env; argv has no URL/password and stderr is discarded. */
export function pgDumpSource(executable,env,spawnProcess = spawn) {
 let child;
 try{child=spawnProcess(executable,["--format=custom","--schema=auth","--schema=public","--schema=app_private","--schema=storage"],{ env,stdio:["ignore","pipe","pipe"],shell:false,windowsHide:true });}catch{fail("PG_DUMP_UNAVAILABLE");}
 let first=null,spawned=false,stdoutEof=false,stderrEof=false,stdoutClosed=false,stderrClosed=false,exited=false,closed=false,consumed=false,exitCode,closeCode,exitSignal,closeSignal,resolveCompleted,rejectCompleted;
 const completed = new Promise((resolve,reject) => {resolveCompleted=resolve;rejectCompleted=reject;});
 completed.catch(() => undefined);
 const refuse=code=>{
  if(!first){
   first=new BackupError(code);
   // Wake a pending iterator on failure. Destroy/Kill are cancellation requests,
   // never replacements for any original EOF, exit or close fact.
   for(const stream of [child?.stdout,child?.stderr]){try{stream?.destroy?.(first);}catch{/* Keep first failure. */}}
   try{if(!closed)child?.kill?.();}catch{/* No termination claim. */}
  }
  rejectCompleted(first);
 };
 const check=(complete=false)=>{
  if(first)throw first;
  if(complete&&(!spawned||!stdoutEof||!stderrEof||!exited||!closed||exitCode!==0||closeCode!==0||exitSignal!==null||closeSignal!==null)) {refuse("PG_DUMP_FAILED");throw first;}
 };
 if(!child||typeof child.on!=="function"||!child.stdout||!child.stderr||typeof child.stdout.on!=="function"||typeof child.stderr.on!=="function"||typeof child.stdout[Symbol.asyncIterator]!=="function") {
  try{child?.kill?.();}catch{/* A cancellation request cannot certify completion. */}
  fail("PG_DUMP_UNAVAILABLE");
 }
 child.on("spawn",()=>{if(spawned||exited||closed)refuse("PG_DUMP_FAILED");else spawned=true;});
 child.on("error",()=>refuse("PG_DUMP_UNAVAILABLE"));
 child.on("exit",(code,signal)=>{if(exited||closed||!spawned)refuse("PG_DUMP_FAILED");exited=true;exitCode=code;exitSignal=signal;if(code!==0||signal!==null)refuse("PG_DUMP_FAILED");});
 child.on("close",(code,signal)=>{
  if(closed)refuse("PG_DUMP_FAILED");closed=true;closeCode=code;closeSignal=signal;
  try{check(true);resolveCompleted();}catch{rejectCompleted(first);}
 });
 for(const [stream,label] of [[child.stdout,"stdout"],[child.stderr,"stderr"]]) {
  stream.on("error",()=>refuse("PG_DUMP_FAILED"));
  stream.on("aborted",()=>refuse("PG_DUMP_FAILED"));
  stream.on("end",()=>{
   if(label==="stdout"){if(stdoutEof||stdoutClosed)refuse("PG_DUMP_FAILED");stdoutEof=true;}
   else{if(stderrEof||stderrClosed)refuse("PG_DUMP_FAILED");stderrEof=true;}
  });
  stream.on("close",()=>{
   if(label==="stdout"){if(stdoutClosed||!stdoutEof)refuse("PG_DUMP_FAILED");stdoutClosed=true;}
   else{if(stderrClosed||!stderrEof)refuse("PG_DUMP_FAILED");stderrClosed=true;}
  });
 }
 child.stderr.resume();
 const source={metadata:DATABASE_METADATA,async *stream(){
  if(consumed)fail("PG_DUMP_FAILED");consumed=true;
  try {
   check();
   for await(const chunk of child.stdout){
    let owned;
    try{check();if(!Buffer.isBuffer(chunk))fail("PG_DUMP_FAILED");owned=Buffer.from(chunk);yield owned;check();}
    finally{owned?.fill(0);if(Buffer.isBuffer(chunk))chunk.fill(0);}
   }
   check();await completed;check(true);
  } catch {refuse(first?.code??"PG_DUMP_FAILED");throw first;} finally {
   if(!closed){try{child.kill();}catch{/* Request only; never infer EOF/exit. */}}
  }
 }};
 nativeDumpChecks.set(source,check);
 return source;
}
function objectPath(value) { if (typeof value !== "string" || !value || value.length > 2048 || value.split("/").some(part => ["",".",".."].includes(part))) fail("INVALID_STORAGE_PATH"); return value.split("/").map(encodeURIComponent).join("/"); }
export function storageSource(baseUrl,key,fetcher = fetch,rawRequest = httpsRequest) {
 const headers = { apikey:key,Authorization:"Bearer " + key };
 async function request(path,options = {}) { let reply; try { reply = await fetcher(baseUrl + "/storage/v1/" + path,{ ...options,signal:AbortSignal.timeout(60000),redirect:"error",cache:"no-store",headers:{ ...headers,...options.headers } }); } catch { fail("STORAGE_UNAVAILABLE"); } if (!reply.ok) fail("STORAGE_REQUEST_FAILED"); return reply; }
 async function inventory() {
  const buckets = await (await request("bucket")).json(); if (!Array.isArray(buckets)) fail("INVALID_STORAGE_INVENTORY"); const wanted = ["second-brain-staging","second-brain-files"];
  if (wanted.some(id => !buckets.some(bucket => bucket.id === id && bucket.public === false))) fail("PRIVATE_BUCKETS_REQUIRED");
  const rows = [], seen = new Set(); let prefixes = 0;
  async function walk(bucket,prefix) {
   if (++prefixes > 100000) fail("INVENTORY_LIMIT"); let offset = 0;
   while (true) { const page = await (await request("object/list/" + bucket,{ method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ prefix,limit:1000,offset,sortBy:{column:"name",order:"asc"} }) })).json(); if (!Array.isArray(page) || page.length > 1000) fail("INVALID_STORAGE_INVENTORY");
    for (const item of page) { if (typeof item?.name !== "string" || item.name.includes("/") || [".","..",""].includes(item.name)) fail("INVALID_STORAGE_INVENTORY"); const path = prefix + item.name; objectPath(path); if (item.id === null) await walk(bucket,path + "/"); else { const identity = JSON.stringify([bucket,path]); if (seen.has(identity) || typeof item.id !== "string" || typeof item.updated_at !== "string" || !Number.isSafeInteger(item.metadata?.size) || item.metadata.size < 0) fail("INVALID_STORAGE_INVENTORY"); seen.add(identity); rows.push({kind:"storage",bucket,path,object_id:item.id,source_updated_at:item.updated_at,mime:item.metadata.mimetype ?? "application/octet-stream",expected_bytes:item.metadata.size}); if (rows.length > 1000000) fail("INVENTORY_LIMIT"); } }
    if (page.length < 1000) break; offset += page.length;
   }
  }
  for (const bucket of wanted) await walk(bucket,""); return rows.sort((a,b) => JSON.stringify([a.bucket,a.path]).localeCompare(JSON.stringify([b.bucket,b.path])));
 }
 const fingerprint = rows => createHash("sha256").update(JSON.stringify(rows)).digest("hex");
 // Node fetch transparently decompresses Content-Encoding. Native HTTPS preserves
 // the stored bytes even when object metadata itself declares gzip content.
 return { inventory,fingerprint,download(metadata) {return new Promise((resolve,reject)=>{const req=rawRequest(baseUrl+"/storage/v1/object/"+metadata.bucket+"/"+objectPath(metadata.path),{method:"GET",headers:{...headers,"Accept-Encoding":"identity"}},reply=>{if(reply.statusCode<200||reply.statusCode>=300){reply.resume();reject(new BackupError("STORAGE_REQUEST_FAILED"));}else resolve(reply);});req.on("error",()=>reject(new BackupError("STORAGE_UNAVAILABLE")));req.setTimeout(60000,()=>req.destroy(new BackupError("STORAGE_UNAVAILABLE")));req.end();});} };
}
export function backupEntries(config,dependencies = {}) {
 let checkNative=null,finished=false;
 const check=()=>{checkNative?.(true);if(!finished)fail("BACKUP_SOURCE_INCOMPLETE");};
 const iterator=(async function*(){
  const storage=dependencies.storage??storageSource(config.storageUrl,config.storageKey,dependencies.fetch),before=await storage.inventory(),dump=dependencies.pgDump??pgDumpSource(config.pgDump,config.pg,dependencies.spawn);
  // Only a module-owned native source contributes a persistent process guard.
  // An injected fixture without a nominal guard never attests native origin.
  checkNative=nativeDumpChecks.get(dump)??null;
  checkNative?.();
  yield{metadata:dump.metadata,stream:dump.stream()};
  checkNative?.(true);
  for(const metadata of before){checkNative?.(true);const stream=await storage.download(metadata);checkNative?.(true);yield{metadata,stream};checkNative?.(true);}
  const after=await storage.inventory();checkNative?.(true);
  if(storage.fingerprint(before)!==storage.fingerprint(after))fail("STORAGE_CHANGED_DURING_BACKUP");
  finished=true;
 })();
 backupEntryChecks.set(iterator,check);
 return iterator;
}
/** Borrow the same original-process guard through CLI publication; no receipt mint. */
export function assertBackupEntriesCurrent(iterator) {
 const check=backupEntryChecks.get(iterator);
 if(!check)fail("BACKUP_SOURCE_REQUIRED");
 check();
}
