import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { isAbsolute, resolve } from "node:path";
import { PERSONAL_REF, REPO_ROOT, postgresEnvironment } from "./backup-config.mjs";
import { BackupError } from "./backup-format.mjs";
import { queryPostgres } from "./postgres-process.mjs";
import { storageSource } from "./backup-sources.mjs";
const fail=code=>{throw new BackupError(code);};
export function restoreConfiguration(env) {
 const ref=env.SC_RESTORE_PROJECT_REF;
 if(typeof ref!=="string"||!/^[a-z]{20}$/.test(ref)||ref===PERSONAL_REF||env.SC_RESTORE_CONFIRM_PROJECT!==ref||env.SC_RESTORE_ISOLATED!=="YES")fail("ISOLATED_RESTORE_TARGET_REQUIRED");
 if(env.SC_RESTORE_SUPABASE_URL!=="https://"+ref+".supabase.co"||!/^sb_secret_[A-Za-z0-9_-]+$/.test(env.SC_RESTORE_SUPABASE_KEY??""))fail("ISOLATED_STORAGE_CONFIGURATION_REQUIRED");
 if(!isAbsolute(env.SC_RESTORE_PG_RESTORE??"")||!isAbsolute(env.SC_RESTORE_PSQL??""))fail("RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED");
 const selected={};for(const name of ["PATH","SystemRoot","TEMP","TMP","HOME"])if(env[name])selected[name]=env[name];for(const name of ["PGHOST","PGPORT","PGDATABASE","PGUSER","PGPASSWORD","PGSSLMODE","PGSSLROOTCERT"])if(env["SC_RESTORE_"+name])selected[name]=env["SC_RESTORE_"+name];
 return {ref,pg:postgresEnvironment(selected,ref),pgRestore:env.SC_RESTORE_PG_RESTORE,psql:env.SC_RESTORE_PSQL,url:env.SC_RESTORE_SUPABASE_URL,key:env.SC_RESTORE_SUPABASE_KEY};
}
export const EMPTY_TARGET_SQL="begin transaction read only; select jsonb_build_object('empty',not exists(select 1 from auth.users) and not exists(select 1 from storage.objects) and not exists(select 1 from storage.buckets) and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind in ('r','p') and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e'))); rollback;";
function databaseSink(config,spawnProcess) {
 let child,completed,closed=false,prefix=Buffer.alloc(0);
 function start() {
  // Preserve the archive's original owners, including managed Auth/Storage roles.
  // Missing roles or insufficient ALTER OWNER privileges must abort the transaction.
  child=spawnProcess(config.pgRestore,["--exit-on-error","--single-transaction","--clean","--if-exists","--dbname=postgres"],{env:config.pg,stdio:["pipe","ignore","pipe"],shell:false,windowsHide:true});child.stderr?.resume();child.stdin?.on("error",()=>undefined);
  completed=new Promise((resolve,reject)=>{child.on("error",()=>reject(new BackupError("PG_RESTORE_UNAVAILABLE")));child.on("close",code=>{closed=true;if(code===0)resolve();else reject(new BackupError("PG_RESTORE_FAILED"));});});completed.catch(()=>undefined);
 }
 async function send(bytes) {if(!child.stdin||child.stdin.destroyed)fail("PG_RESTORE_FAILED");await new Promise((resolve,reject)=>child.stdin.write(bytes,error=>{if(error)reject(new BackupError("PG_RESTORE_FAILED"));else resolve();}));}
 return {async write(bytes){if(!child){prefix=Buffer.concat([prefix,bytes]);if(prefix.length<5)return;if(prefix.subarray(0,5).toString()!=="PGDMP")fail("NATIVE_POSTGRES_DUMP_REQUIRED");start();await send(prefix);prefix.fill(0);prefix=Buffer.alloc(0);}else await send(bytes);},async close(){if(!child)fail("NATIVE_POSTGRES_DUMP_REQUIRED");child.stdin.end();await completed;},async abort(){prefix.fill(0);if(!closed)child?.kill();await completed?.catch(()=>undefined);}};
}
/** Target is explicitly separate and empty. Cross-service restore is not atomic. */
export function isolatedRestoreSinks(config,dependencies={}) {
 const query=dependencies.query??((request)=>queryPostgres(config.psql,config.pg,request,dependencies.spawn)),fetcher=dependencies.fetch??fetch,storage=dependencies.storage??storageSource(config.url,config.key,fetcher);let databaseDone=false,objects=0;
 return {async header(){const result=await query({sql:EMPTY_TARGET_SQL});if(result?.empty!==true)fail("RESTORE_TARGET_NOT_EMPTY");},async open(metadata){
  if(metadata.kind==="database"){if(databaseDone)fail("DUPLICATE_DATABASE");const sink=databaseSink(config,dependencies.spawn??spawn);return {write:sink.write,abort:sink.abort,async close(){await sink.close();databaseDone=true;}};}
  if(!databaseDone)fail("DATABASE_MUST_RESTORE_FIRST");const stream=new PassThrough(),abort=new AbortController();stream.on("error",()=>undefined);
  const url=config.url+"/storage/v1/object/"+metadata.bucket+"/"+metadata.path.split("/").map(encodeURIComponent).join("/");
  const uploading=Promise.resolve(fetcher(url,{method:"POST",redirect:"error",cache:"no-store",duplex:"half",signal:abort.signal,headers:{apikey:config.key,Authorization:"Bearer "+config.key,"Content-Type":metadata.mime,"x-upsert":"true"},body:stream})).then(reply=>{if(!reply.ok)fail("RESTORE_STORAGE_UPLOAD_FAILED");});uploading.catch(()=>undefined);
  return {async write(bytes){await new Promise((resolve,reject)=>stream.write(Buffer.from(bytes),error=>{if(error)reject(new BackupError("RESTORE_STORAGE_UPLOAD_FAILED"));else resolve();}));},async close(summary){stream.end();await uploading;const hash=createHash("sha256");let size=0;for await(const bytes of await storage.download(metadata)){hash.update(bytes);size+=bytes.length;}if(size!==summary.size||hash.digest("hex")!==summary.digest)fail("RESTORED_OBJECT_BYTES_MISMATCH");objects++;},async abort(){abort.abort();stream.destroy();await uploading.catch(()=>undefined);}};
 },async complete(){if(!databaseDone)fail("DATABASE_RESTORE_REQUIRED");const catalogue=await query({file:resolve(REPO_ROOT,"supabase/tests/release-catalog.sql")});if(catalogue?.ok!==true||!Array.isArray(catalogue.deviations)||catalogue.deviations.length!==0)fail("RESTORED_CATALOGUE_DEVIATIONS");return {storage_hashes_verified:objects,app_catalogue_verified:true,owner_restore_strategy:"original_archive_owners_or_transaction_failure",managed_owners_verification:"pending_manual_source_catalog_comparison",auth_uuid_strategy:"native_dump_preserves_original_ids",vault_unlock:"pending_manual_in_isolated_app"};}};
}
