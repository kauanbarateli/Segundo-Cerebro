import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { BackupError } from "./backup-format.mjs";
export const DATABASE_METADATA = { kind:"database",preserves_auth_uuids:true,preserves_grants:true,preserves_owners:true,schemas:["auth","public","app_private","storage"] };
const fail = code => { throw new BackupError(code); };
/** Credentials are exclusively in child env; argv has no URL/password and stderr is discarded. */
export function pgDumpSource(executable,env,spawnProcess = spawn) {
 const child = spawnProcess(executable,["--format=custom","--schema=auth","--schema=public","--schema=app_private","--schema=storage"],{ env,stdio:["ignore","pipe","pipe"],shell:false,windowsHide:true });
 let settled = false; const completed = new Promise((resolve,reject) => { child.on("error",() => { settled = true; reject(new BackupError("PG_DUMP_UNAVAILABLE")); }); child.on("close",code => { settled = true; if (code === 0) resolve(); else reject(new BackupError("PG_DUMP_FAILED")); }); }); completed.catch(() => undefined); child.stderr?.resume();
 return { metadata:DATABASE_METADATA,async *stream() { if (!child.stdout) fail("PG_DUMP_UNAVAILABLE"); try { for await (const chunk of child.stdout) yield chunk; await completed; } finally { if (!settled) child.kill(); } } };
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
export async function* backupEntries(config,dependencies = {}) {
 const storage = dependencies.storage ?? storageSource(config.storageUrl,config.storageKey,dependencies.fetch), before = await storage.inventory(), dump = dependencies.pgDump ?? pgDumpSource(config.pgDump,config.pg,dependencies.spawn);
 yield {metadata:dump.metadata,stream:dump.stream()};
 for (const metadata of before) yield {metadata,stream:await storage.download(metadata)};
 const after = await storage.inventory(); if (storage.fingerprint(before) !== storage.fingerprint(after)) fail("STORAGE_CHANGED_DURING_BACKUP");
}
