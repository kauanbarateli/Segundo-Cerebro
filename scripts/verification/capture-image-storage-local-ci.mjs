/** Standalone Linux CI stack. No Next/browser or hosted/factory integration. */
import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CLI_VERSION, requireCiRunner, assertTempDescendant, assertNoEnvironmentFiles, loadCanonicalMigrations, renderLocalConfig, decodeLocalStatus, localPsqlEnvironment, runBoundedProcess, DATABASE_PREFLIGHT, assertDatabasePreflight, LOCAL_INFRASTRUCTURE_FIXTURE } from "./auth-local-ci.mjs";
import { CAPTURE_NATIVE_MODULES } from "../../tests/e2e-auth-local/capture-task-persistence-support.mjs";
import { CAPTURE_IMAGE_MODULES } from "../../tests/e2e-auth-local/capture-image-storage-support.mjs";
import { runCaptureImageLocalCase } from "../../tests/e2e-auth-local/capture-image-storage-local-case.mjs";
import { STORAGE_LOCAL_CI_CHECKS, STORAGE_LOCAL_CI_CODES, STORAGE_LOCAL_SDK_VERSIONS, validateStorageLocalCiReport } from "../../tests/e2e-auth-local/capture-image-storage-local-ci-contract.mjs";
const ROOT = fileURLToPath(new URL("../../",import.meta.url));
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail=code=>{throw new Error(code);};
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const exact=(v,keys)=>{if(!v||typeof v!=="object"||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;const descriptors=Object.getOwnPropertyDescriptors(v),names=Reflect.ownKeys(descriptors);return names.length===keys.length&&names.every(k=>typeof k==="string"&&keys.includes(k))&&keys.every(k=>Object.hasOwn(descriptors[k]??{},"value")&&descriptors[k].enumerable);};
export function requireStorageCi(environment,platform=process.platform){
  if(environment.SC_CAPTURE_IMAGE_LOCAL_CI_RUN!=="1")fail("CI_OPT_IN_REQUIRED");
  return requireCiRunner(environment,platform);
}
export function decodeOneSqlRow(text){
  if(typeof text!=="string"||Buffer.byteLength(text)>1048576)fail("LOCAL_SQL_REFUSED");
  const lines=text.trim().split(/\r?\n/);if(lines.length!==1)fail("LOCAL_SQL_REFUSED");
  try{return JSON.parse(lines[0]);}catch{fail("LOCAL_SQL_REFUSED");}
}
export const STORAGE_INSTANCE_SQL=`begin read only;
set local statement_timeout='10s';
select jsonb_build_object('owner',current_user,'database',current_database(),'version',current_setting('server_version_num')::integer,'systemId',(select system_identifier::text from pg_control_system()));
rollback;`;
export function verifyStorageInstance(value,expected){
  if(!exact(value,["owner","database","version","systemId"])||value.owner!=="postgres"||value.database!=="postgres"||!Number.isSafeInteger(value.version)||value.version<170000||value.version>=180000||typeof value.systemId!=="string"||!/^\d{1,24}$/.test(value.systemId)||expected!==undefined&&value.systemId!==expected)fail("LOCAL_DATABASE_REFUSED");
  return value.systemId;
}
export function validateStorageActors(actors){
  if(!exact(actors,["a","b"]))fail("LOCAL_SQL_REFUSED");
  for(const actor of [actors.a,actors.b])if(!exact(actor,["id","sessionId","marker"])||!UUID.test(actor.id)||!UUID.test(actor.sessionId)||typeof actor.marker!=="string"||!/^[a-f0-9]{64}$/.test(actor.marker))fail("LOCAL_SQL_REFUSED");
  if(new Set([actors.a.id,actors.a.sessionId,actors.b.id,actors.b.sessionId]).size!==4)fail("LOCAL_SQL_REFUSED");
  return Object.freeze({a:Object.freeze({...actors.a}),b:Object.freeze({...actors.b})});
}
// No caller SQL. Every statement below is fixed; only validated RAM bindings
// precede it on psql stdin. Query rows never enter an artifact or console.
const STORAGE_INSPECTION_SQL=`begin read only;
set local statement_timeout='10s';set local lock_timeout='2s';
select jsonb_build_object(
 'provenance',jsonb_build_object('owner',current_user,'database',current_database(),'version',current_setting('server_version_num')::integer,'systemId',(select system_identifier::text from pg_control_system()),
  'actorsBound',exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id join public.user_roles r on r.user_id=u.id where u.id=:'sc_a'::uuid and s.id=:'sc_as'::uuid and u.role='authenticated' and r.role='user' and u.raw_app_meta_data->>'sc_capture_image_ci_marker'=:'sc_am')
   and exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id join public.user_roles r on r.user_id=u.id where u.id=:'sc_b'::uuid and s.id=:'sc_bs'::uuid and u.role='authenticated' and r.role='user' and u.raw_app_meta_data->>'sc_capture_image_ci_marker'=:'sc_bm')),
 'proof',jsonb_build_object(
  'file',(select jsonb_build_object('id',f.id,'user_id',f.user_id,'payload',f.payload,'storage_path',f.storage_path,'purged_at',f.purged_at) from public.drive_files f where f.user_id=:'sc_b'::uuid and f.id=:'sc_upload'::uuid),
  'capture',(select jsonb_build_object('id',c.id,'user_id',c.user_id,'payload',c.payload) from public.captures c where c.user_id=:'sc_b'::uuid and c.id=:'sc_capture'::uuid),
  'links',(select coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb) from public.capture_file_links l where l.user_id=:'sc_b'::uuid and l.file_id=:'sc_upload'::uuid and l.capture_id=:'sc_capture'::uuid),
  'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'user_id',e.user_id,'entity_type',e.entity_type,'entity_id',e.entity_id,'action',e.action,'canal',e.canal,'occurred_at',e.occurred_at,'before',e.before,'after',e.after) order by e.id),'[]'::jsonb) from public.domain_events e where e.user_id=:'sc_b'::uuid and e.entity_id in(:'sc_upload'::uuid,:'sc_capture'::uuid)),
  'receipts',(select coalesce(jsonb_agg(jsonb_build_object('user_id',r.user_id,'command',r.command,'client_id',r.client_id,'result',r.result) order by r.command),'[]'::jsonb) from app_private.command_receipts r where r.user_id=:'sc_b'::uuid and r.command in('capture.create','file.upload.finalize') and r.result->>'id' in(:'sc_upload',:'sc_capture'))));
rollback;`;
export function storageInspectionInput(ids,actors){
  const verified=validateStorageActors(actors);
  if(!exact(ids,["ownerId","uploadId","captureId"])||Object.values(ids).some(id=>typeof id!=="string"||!UUID.test(id))||ids.ownerId!==verified.b.id||new Set(Object.values(ids)).size!==3||[verified.a.id,verified.a.sessionId,verified.b.sessionId].some(id=>id===ids.uploadId||id===ids.captureId))fail("LOCAL_SQL_REFUSED");
  const variables={sc_a:verified.a.id,sc_as:verified.a.sessionId,sc_am:verified.a.marker,sc_b:verified.b.id,sc_bs:verified.b.sessionId,sc_bm:verified.b.marker,sc_upload:ids.uploadId,sc_capture:ids.captureId};
  return Object.entries(variables).map(([name,value])=>`\\set ${name} ${value}`).join("\n")+"\n"+STORAGE_INSPECTION_SQL;
}
export function acceptStorageInspection(value,systemId){
  if(!exact(value,["provenance","proof"])||!exact(value.provenance,["owner","database","version","systemId","actorsBound"])||value.provenance.actorsBound!==true)fail("LOCAL_SQL_REFUSED");
  const {actorsBound:_bound,...instance}=value.provenance;void _bound;verifyStorageInstance(instance,systemId);
  if(!exact(value.proof,["file","capture","links","events","receipts"]))fail("LOCAL_SQL_REFUSED");return value.proof;
}
/** Caller-owned local SQL only. No public SQL parameter, retry or late proof. */
export function createStorageSqlInspector(options){
  if(!exact(options,["actors","systemId","query","allowed"])||typeof options.systemId!=="string"||!/^\d{1,24}$/.test(options.systemId)||typeof options.query!=="function"||typeof options.allowed!=="function")fail("LOCAL_SQL_REFUSED");
  const actors=validateStorageActors(options.actors),systemId=options.systemId;let begun=false,running=false,completed=false,closed=false;
  return Object.freeze({
    async inspect(ids){
      if(closed||begun||options.allowed()!==true)fail("LOCAL_SQL_REFUSED");const input=storageInspectionInput(ids,actors);begun=true;running=true;
      try{const row=await options.query(input);if(closed||options.allowed()!==true)fail("LOCAL_SQL_REFUSED");const proof=acceptStorageInspection(row,systemId);completed=true;return proof;}finally{running=false;}
    },
    metadata:()=>Object.freeze({running,completed,closed}),close(){closed=true;},
  });
}
export const STORAGE_DOMAIN_ABSENCE_SQL=`begin read only;
set local statement_timeout='10s';
select jsonb_build_object('owner',current_user,'database',current_database(),'version',current_setting('server_version_num')::integer,'systemId',(select system_identifier::text from pg_control_system()),
 'authEmpty',not exists(select 1 from auth.users),
 'objectsEmpty',not exists(select 1 from storage.objects where bucket_id in('second-brain-staging','second-brain-files')),
 'domainEmpty',not exists(select 1 from public.profiles union all select 1 from public.user_preferences union all select 1 from public.user_modules union all select 1 from public.user_roles union all select 1 from public.user_moderation union all select 1 from public.user_entitlements union all select 1 from public.captures union all select 1 from public.tasks union all select 1 from public.capture_file_links union all select 1 from public.drive_files union all select 1 from public.domain_events union all select 1 from app_private.upload_reservations union all select 1 from app_private.command_receipts union all select 1 from app_private.capture_task_revisions union all select 1 from app_private.rate_limits where user_id is not null));
rollback;`;
export function acceptStorageAbsence(value,systemId){
  if(!exact(value,["owner","database","version","systemId","authEmpty","objectsEmpty","domainEmpty"])||value.authEmpty!==true||value.objectsEmpty!==true||value.domainEmpty!==true)fail("DOMAIN_ABSENCE_REFUSED");
  verifyStorageInstance({owner:value.owner,database:value.database,version:value.version,systemId:value.systemId},systemId);return true;
}
export const STORAGE_BASELINE_SQL=`begin read only;set local statement_timeout='10s';
select jsonb_build_object('buckets',count(*),'private',bool_and(not public),'objectsEmpty',not exists(select 1 from storage.objects where bucket_id in('second-brain-staging','second-brain-files'))) from storage.buckets where id in('second-brain-staging','second-brain-files');rollback;`;
const INSPECT_FORMAT='{"id":{{json .Id}},"name":{{json .Name}},"label":{{json (index .Config.Labels "com.supabase.cli.project")}},"running":{{json .State.Running}},"imageId":{{json .Image}},"ports":{{json .NetworkSettings.Ports}}}';
export function acceptStorageContainer(v,projectId,kind){
  if(!/^sc-auth-ci-[a-f0-9]{24}$/.test(projectId)||!["db","kong","auth","rest","storage"].includes(kind)||!exact(v,["id","name","label","running","imageId","ports"])||!/^[a-f0-9]{64}$/.test(v.id)||v.name!==`/supabase_${kind}_${projectId}`||v.label!==projectId||v.running!==true||!/^sha256:[a-f0-9]{64}$/.test(v.imageId)||!v.ports||typeof v.ports!=="object")fail("LOCAL_NAMESPACE_REFUSED");
  if(kind==="db"||kind==="kong"){const target=kind==="db"?"5432/tcp":"8000/tcp",port=kind==="db"?"54322":"54321",rows=v.ports[target];if(!Array.isArray(rows)||rows.length<1||rows.length>2||rows.some(row=>!exact(row,["HostIp","HostPort"])||!["127.0.0.1","0.0.0.0","::"].includes(row.HostIp)||row.HostPort!==port))fail("LOCAL_NAMESPACE_REFUSED");}
  return v.id;
}
async function freePort(port){await new Promise((done,reject)=>{const server=createServer();server.once("error",()=>reject(new Error("LOCAL_PORT_IN_USE")));server.listen({host:"127.0.0.1",port,exclusive:true},()=>server.close(error=>error?reject(new Error("LOCAL_PORT_IN_USE")):done()));});}
async function canonical(path){const file=assertTempDescendant(ROOT,resolve(ROOT,path)),info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||await realpath(file)!==file)fail("SOURCE_REFUSED");return readFile(file);}
const FILES=["package-lock.json","supabase/sql-editor/manifest.json","tests/fixtures/supabase-auth-local/config.toml","scripts/verification/auth-local-ci.mjs","scripts/verification/capture-image-storage-local-ci.mjs","tests/e2e-auth-local/capture-image-storage-local-case.mjs","tests/e2e-auth-local/capture-image-storage-local-ci-contract.mjs","tests/e2e-auth-local/capture-image-storage-support.mjs","tests/e2e-auth-local/capture-image-storage-contract.mjs","tests/e2e-auth-local/capture-image-storage.entry.ts","tests/e2e-auth-local/capture-task-persistence-support.mjs","tests/helpers/local-canonical-sql.ts",...CAPTURE_NATIVE_MODULES,...CAPTURE_IMAGE_MODULES];
export async function runCaptureImageStorageLocalCi(environment=process.env,observeResponse){
  if(observeResponse!==undefined&&typeof observeResponse!=="function")fail("SETUP_REFUSED");
  const report={schemaVersion:1,scenario:"capture-image-storage-local-ci",status:"failed",code:"STORAGE_LOCAL_CI_FAILED",phase:"environment",cleanupStage:"not-started",cliVersion:CLI_VERSION,sourceSha:null,sourceHashes:[],sdkVersions:{...STORAGE_LOCAL_SDK_VERSIONS},migrations:17,migrationsApplied:0,catalogueChecks:0,checks:Object.fromEntries(STORAGE_LOCAL_CI_CHECKS.map(k=>[k,false])),caseReport:null,writeOutcomeUncertain:false};
  let runRoot,project,home,projectId,started=false,groupsKnown=true,failed=false,local,systemId,inspector,caseActive=false;
  const retain=(code)=>{if(!failed){report.code=STORAGE_LOCAL_CI_CODES.includes(code)?code:"STORAGE_LOCAL_CI_FAILED";failed=true;}};
  let childEnv;
  const run=async(command,args,timeoutMs,options={})=>{
    try{const result=await runBoundedProcess(command,args,{cwd:ROOT,env:childEnv,timeoutMs,maxBytes:1048576,...options});if(result.groupConfirmed!==true){groupsKnown=false;fail("COMMAND_GROUP_UNCONFIRMED");}return result;}
    catch(error){if(error?.groupConfirmed!==true)groupsKnown=false;throw error;}
  };
  const inventory=async()=>{const filter="label=com.supabase.cli.project="+projectId;const rows=await Promise.all([["ps","--all","--quiet"],["volume","ls","--quiet"],["network","ls","--quiet"]].map(args=>run("docker",[...args,"--filter",filter],15000)));return rows.every(row=>row.stdout.trim()==="");};
  const cli=args=>["--workdir",project,...args];
  try{
    const {runnerTemp}=requireStorageCi(environment);if(await realpath(runnerTemp)!==runnerTemp||!(await lstat(runnerTemp)).isDirectory())fail("ENVIRONMENT_REFUSED");await assertNoEnvironmentFiles();report.checks.localEnvironment=true;
    report.phase="sources";const migrations=await loadCanonicalMigrations();const template=(await canonical("tests/fixtures/supabase-auth-local/config.toml")).toString("utf8");
    if(!/\[storage\]\r?\nenabled = true/.test(template))fail("SOURCE_REFUSED");
    childEnv=Object.fromEntries(["PATH","LANG","LC_ALL","TZ"].filter(k=>typeof environment[k]==="string").map(k=>[k,environment[k]]));
    const head=(await run("git",["rev-parse","HEAD"],15000)).stdout.trim();if(!/^[a-f0-9]{40}$/.test(head))fail("SOURCE_REFUSED");report.sourceSha=head;
    await run("git",["diff","--quiet","HEAD","--","src","supabase/migrations","package-lock.json"],15000);
    const lock=JSON.parse((await canonical("package-lock.json")).toString("utf8"));for(const [name,version]of Object.entries(STORAGE_LOCAL_SDK_VERSIONS)){const installed=JSON.parse(await readFile(resolve(ROOT,"node_modules",name,"package.json"),"utf8"));if(installed.version!==version||lock.packages["node_modules/"+name]?.version!==version)fail("SOURCE_REFUSED");}
    const migrationNames=(await readdir(resolve(ROOT,"supabase/migrations"))).filter(n=>n.endsWith(".sql")).sort();
    for(const path of [...new Set([...FILES,...migrationNames.map(n=>"supabase/migrations/"+n)])].sort()){const bytes=await canonical(path);report.sourceHashes.push({path,sha256:hash(bytes),bytes:bytes.length});}report.checks.sourcesConfirmed=true;
    report.phase="ports";for(const port of [54320,54321,54322])await freePort(port);
    report.phase="private-directories";runRoot=await mkdtemp(join(runnerTemp,"sc-capture-image-ci-"));await chmod(runRoot,0o700);project=join(runRoot,"project");home=join(runRoot,"home");projectId="sc-auth-ci-"+randomUUID().replaceAll("-","").slice(0,24);await mkdir(join(project,"supabase"),{recursive:true,mode:0o700});await mkdir(home,{mode:0o700});await writeFile(join(project,"supabase/config.toml"),renderLocalConfig(template,projectId),{flag:"wx",mode:0o600});
    childEnv={...childEnv,HOME:home,XDG_CONFIG_HOME:join(home,".config"),XDG_CACHE_HOME:join(home,".cache"),CI:"true",GITHUB_ACTIONS:"true",RUNNER_TEMP:runnerTemp,SC_AUTH_LOCAL_CI_RUN:"1",SC_CAPTURE_IMAGE_LOCAL_CI_RUN:"1",NO_COLOR:"1"};
    report.phase="cli-help";if((await run("supabase",["--version"],15000)).stdout.trim()!==CLI_VERSION)fail("CLI_VERSION_REFUSED");for(const [command,flags]of [["start",[]],["status",["--output"]],["stop",["--project-id","--no-backup"]]]){const help=(await run("supabase",[command,"--help"],15000)).stdout;if(flags.some(flag=>!help.includes(flag)))fail("CLI_HELP_REFUSED");}
    if(!await inventory())fail("PROJECT_NOT_EMPTY");report.phase="stack-start";started=true;await run("supabase",cli(["start"]),600000,{capture:false});
    report.phase="local-status";local=decodeLocalStatus((await run("supabase",cli(["status","-o","json"]),30000)).stdout);
    for(const kind of ["db","kong","auth","rest","storage"]){const inspected=decodeOneSqlRow((await run("docker",["inspect","--type","container","--format",INSPECT_FORMAT,`supabase_${kind}_${projectId}`],15000)).stdout);acceptStorageContainer(inspected,projectId,kind);}report.checks.ownedNamespace=true;
    const pg=localPsqlEnvironment(environment,home,local);
    // 12s + the bounded process kill margin stays below the producer's 15s.
    const query=async input=>decodeOneSqlRow((await run("psql",["--no-psqlrc","--no-password","--quiet","--tuples-only","--no-align","--set","ON_ERROR_STOP=1","--file=-"],12000,{env:pg,input})).stdout);
    report.phase="database-preflight";assertDatabasePreflight(await query(DATABASE_PREFLIGHT),false);systemId=verifyStorageInstance(await query(STORAGE_INSTANCE_SQL));report.checks.pg17=report.checks.instanceIdentityConfirmed=true;
    report.phase="local-infrastructure";await run("psql",["--no-psqlrc","--no-password","--quiet","--set","ON_ERROR_STOP=1","--file=-"],60000,{env:pg,input:LOCAL_INFRASTRUCTURE_FIXTURE,capture:false});assertDatabasePreflight(await query(DATABASE_PREFLIGHT));
    report.phase="migrations";for(const migration of migrations){await run("psql",["--no-psqlrc","--no-password","--quiet","--set","ON_ERROR_STOP=1","--file=-"],60000,{env:pg,input:migration.source,capture:false});report.migrationsApplied++;}
    report.phase="catalogue";const catalogue=await query((await canonical("supabase/tests/release-catalog.sql")).toString("utf8"));if(catalogue.ok!==true||catalogue.version!==1||catalogue.checks!==1246||!Array.isArray(catalogue.deviations)||catalogue.deviations.length)fail("LOCAL_CATALOGUE_FAILED");report.catalogueChecks=catalogue.checks;
    const baseline=await query(STORAGE_BASELINE_SQL);if(!exact(baseline,["buckets","private","objectsEmpty"])||baseline.buckets!==2||baseline.private!==true||baseline.objectsEmpty!==true)fail("LOCAL_DATABASE_REFUSED");report.checks.servicesNative=true;
    report.phase="schema-reload";await run("psql",["--no-psqlrc","--no-password","--quiet","--set","ON_ERROR_STOP=1","--file=-"],15000,{env:pg,input:"notify pgrst, 'reload schema';",capture:false});
    report.phase="native-case";caseActive=true;report.caseReport=await runCaptureImageLocalCase({ci:true,githubActions:true,localAuthRun:true,appUrl:"http://127.0.0.1:3117",supabaseUrl:"http://127.0.0.1:54321",publishableKey:local.publishable,serverSecretKey:local.secret},{
      transport:(url,init)=>fetch(url,init),cleanupAllowed:()=>caseActive&&groupsKnown&&inspector?.metadata().running!==true&&report.checks.ownedNamespace,registerActors:verified=>{if(!caseActive||inspector)fail("LOCAL_SQL_REFUSED");inspector=createStorageSqlInspector({actors:verified,systemId,query,allowed:()=>caseActive&&groupsKnown&&report.checks.ownedNamespace});},
      inspectSql:ids=>{if(!inspector)fail("LOCAL_SQL_REFUSED");return inspector.inspect(ids);},
      ...(observeResponse===undefined?{}:{observeResponse}),
    });report.writeOutcomeUncertain||=report.caseReport.writeOutcomeUncertain;
    if(report.caseReport.status!=="passed"||report.writeOutcomeUncertain)fail("CASE_FAILED");report.checks.fixedSqlConfirmed=inspector?.metadata().completed===true;
    report.phase="domain-absence";acceptStorageAbsence(await query(STORAGE_DOMAIN_ABSENCE_SQL),systemId);report.checks.domainAbsent=report.checks.storageMetadataAbsent=report.checks.authUsersAbsent=true;report.phase="complete";report.checks.executionNatural=groupsKnown;
  }catch(error){if(report.phase==="native-case"&&!report.caseReport)report.writeOutcomeUncertain=true;retain(error?.code??error?.message);}
  finally{
    caseActive=false;inspector?.close();
    if(started){try{report.cleanupStage="stop-own-project";await run("supabase",cli(["stop","--project-id",projectId,"--no-backup"]),120000,{capture:false});report.cleanupStage="verify-own-project";report.checks.ownedNamespaceCleanup=await inventory();report.checks.stackCleanupConfirmed=report.checks.ownedNamespaceCleanup;}catch{retain("STACK_CLEANUP_UNCONFIRMED");}}
    if(runRoot&&(!started||report.checks.stackCleanupConfirmed)&&groupsKnown&&inspector?.metadata().running!==true){try{report.cleanupStage="private-directories";assertTempDescendant(environment.RUNNER_TEMP,runRoot);if((await lstat(runRoot)).isSymbolicLink()||await realpath(runRoot)!==runRoot)fail("ENVIRONMENT_REFUSED");await rm(runRoot,{recursive:true,force:false});report.checks.privateDirectoriesRemoved=true;}catch{retain("DIRECTORY_CLEANUP_UNCONFIRMED");}}
    if(runRoot&&!report.checks.privateDirectoriesRemoved){report.cleanupStage="directories-retained";retain("DIRECTORY_CLEANUP_UNCONFIRMED");}
    if(started&&!report.checks.stackCleanupConfirmed)retain("STACK_CLEANUP_UNCONFIRMED");
    if(report.checks.stackCleanupConfirmed&&report.checks.privateDirectoriesRemoved)report.cleanupStage="complete";
    local=undefined;systemId=undefined;
  }
  report.status=failed?"failed":"passed";if(!failed)report.code="PASSED";
  return validateStorageLocalCiReport(report);
}
export async function main(argv=process.argv.slice(2),environment=process.env,output=value=>process.stdout.write(JSON.stringify(value)+"\n")){
  if(argv.length===0||argv.length===1&&argv[0]==="--help"){output({schemaVersion:1,scenario:"capture-image-storage-local-ci",code:"NO_SERVICE_STARTED",requires:"Linux GitHub Actions / sterile environment / dedicated opt-in",hostedAccess:false});return 0;}
  if(argv.length!==1||argv[0]!=="--execute"){output({schemaVersion:1,scenario:"capture-image-storage-local-ci",status:"failed",code:"ARGUMENTS_REFUSED"});return 1;}
  try{const report=await runCaptureImageStorageLocalCi(environment,observation=>{output({schemaVersion:1,scenario:"capture-image-storage-response-observation",observation});});output(report);return report.status==="passed"?0:1;}catch{output({schemaVersion:1,scenario:"capture-image-storage-local-ci",status:"failed",code:"REPORT_REFUSED"});return 1;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
