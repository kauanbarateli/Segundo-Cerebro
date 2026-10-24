/** Dedicated Linux VM lifecycle; import/help starts no process or service. */
import { spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, mkdir, mkdtemp, lstat, realpath, chmod, rm } from "node:fs/promises";
import { resolve, relative, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "node:net";
import ts from "typescript";
import { CLI_VERSION, requireCiRunner, assertTempDescendant, assertNoEnvironmentFiles, loadCanonicalMigrations, loadHistorical026Migrations, renderLocalConfig, decodeLocalStatus, localPsqlEnvironment, runBoundedProcess, DATABASE_PREFLIGHT, assertDatabasePreflight, LOCAL_INFRASTRUCTURE_FIXTURE } from "./auth-local-ci.mjs";
import { ADMIN_INSTANCE_SQL, verifyAdminInstance, acceptAdminContainer, adminMarkerInput, collectAdminSources, decodeAdminSql } from "./admin-native-backend-local-ci.mjs";
import { ADMIN_BROWSER_CASES, ADMIN_BROWSER_CODES, ADMIN_BROWSER_INFRA_KEYS, ADMIN_BROWSER_LIMITATIONS, ADMIN_BROWSER_SOURCE_COUNTS, blankAdminBrowserCase, validateAdminBrowserCase, validateAdminBrowserCiReport } from "../../tests/e2e-auth-local/admin-browser-contract.mjs";
import { ADMIN_BROWSER_PAGES, ADMIN_BROWSER_PROBES, ADMIN_BROWSER_APP, adminBrowserRefuse } from "../../tests/e2e-auth-local/admin-browser-support.mjs";
import { ADMIN_LOCAL_SOURCE_PATHS } from "../../tests/e2e-auth-local/admin-native-backend-local-ci-contract.mjs";
import { SOURCE_PINS, qualifyNextStaticRuntime, nextStopEnvironment, createRunnerNextStopRelay } from "../../tests/e2e-auth-local/next-stop-relay.mjs";
import { prepareQualifiedChromium } from "../../tests/e2e-auth-local/qualified-chromium.mjs";
const ROOT = fileURLToPath(new URL("../../",import.meta.url));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const HISTORICAL026_CATALOGUE="tests/fixtures/schema-release-026/release-catalog.sql",HISTORICAL026_CATALOGUE_BYTES=82143,HISTORICAL026_CATALOGUE_SHA256="4557741f008d48ea60ad8a3e2d5a41667630543c3bf2ab0682ec2b33ad97e297";
const fail = adminBrowserRefuse;
export const ADMIN_BROWSER_NEW_PATHS = Object.freeze([
  "tests/e2e-auth-local/auth-effect-outcome.mjs", "tests/e2e-auth-local/auth-effect-outcome.d.mts", "tests/scripts/auth-effect-outcome.test.mjs",
  "tests/e2e-auth-local/next-stop-relay.mjs", "tests/e2e-auth-local/next-stop-relay.d.mts", "tests/e2e-auth-local/next-stop-reporter.mjs", "tests/scripts/next-stop-relay.test.mjs", "scripts/verification/admin-browser-local-ci.mjs", "playwright.admin-browser-local.config.ts", "tests/e2e-auth-local/admin-browser-local.spec.ts", "tests/e2e-auth-local/admin-browser-support.mjs", "tests/e2e-auth-local/admin-browser-support.d.mts", "tests/e2e-auth-local/admin-browser-contract.mjs", "tests/e2e-auth-local/admin-browser-contract.d.mts", "tests/scripts/admin-browser-local-ci.test.mjs", "tests/scripts/admin-browser-support.test.mjs", "tests/scripts/admin-browser.types.mts", ".github/workflows/admin-browser-local-ci.yml",
]);
const routes = path => path === "/" ? "src/app/(workspace)/page.tsx" : "src/app/(workspace)" + path + "/page.tsx";
export const ADMIN_BROWSER_SOURCE_SEEDS = Object.freeze([
  // Explicit binary fixture for the collector's Git-blob negative control;
  // it is no longer an application avatar after SPEC08 private images.
  "src/components/layout/illustrative-avatar.jpg",
  "tests/e2e-auth-local/qualified-chromium.mjs", "tests/e2e-auth-local/qualified-chromium.d.mts", "tests/scripts/qualified-chromium.test.mjs", "scripts/verification/prepare-qualified-chromium.py","scripts/verification/chromium-no-store-qualification.mjs", "scripts/verification/prepare-chromium-no-store-qualification.py", "tests/scripts/prepare_qualified_chromium_test.py",
  ...ADMIN_BROWSER_NEW_PATHS, ...ADMIN_LOCAL_SOURCE_PATHS, ...ADMIN_BROWSER_PAGES.map(routes), "scripts/test-local-sql.mjs",
  ...[...new Set(ADMIN_BROWSER_PROBES.map(p => p.path.split("?")[0]))].map(p => "src/app" + p + "/route.ts"),
  "src/app/api/calendar/oauth/callback/route.ts", "src/app/api/monitoring/route.ts", "src/app/api/settings/sessions/route.ts", "src/app/(workspace)/layout.tsx", "src/app/auth/logout/route.ts", "src/app/(auth)/layout.tsx", "src/app/(auth)/entrar/page.tsx", "src/app/(auth)/trocar-senha/page.tsx", "src/app/layout.tsx", "src/middleware.ts", "src/lib/navigation/routes.ts", "tests/fixtures/supabase-auth-local/config.toml", "supabase/tests/release-catalog.sql", ".nvmrc", "next.config.ts", "tsconfig.json", "package.json", "package-lock.json",
]);
export function requireAdminBrowserCi(env, platform = process.platform) { if (env.SC_ADMIN_BROWSER_LOCAL_CI_RUN !== "1" || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA)) fail("ENVIRONMENT_REFUSED"); return requireCiRunner(env,platform); }
async function canonical(path) { const file = assertTempDescendant(ROOT,resolve(ROOT,path)), st = await lstat(file); if (!st.isFile() || st.isSymbolicLink() || await realpath(file) !== file) fail("SOURCE_REFUSED"); return readFile(file); }
/** Repository-only declared import closure; package runtime graph is separate. */
export async function deriveAdminBrowserSourcePaths() {
  const paths = new Set();
  async function visit(path) {
    path = path.replaceAll("\\","/"); if (paths.has(path)) return;
    if (!/^[A-Za-z0-9_@()./-]+$/.test(path) || path.includes("..") || path.startsWith("node_modules/") || paths.size >= 1024) fail("SOURCE_REFUSED");
    const bytes = await canonical(path); paths.add(path); /* Explicit hash-only seed: read by the preparer, never imported natively. */ if(path==="scripts/verification/chromium-no-store-qualification.mjs")return;
    if (!/\.(?:[cm]?ts|tsx|mjs)$/.test(path) || path.endsWith(".d.mts")) return;
    const parsed = ts.createSourceFile(path,bytes.toString("utf8"),ts.ScriptTarget.Latest,true,path.endsWith("tsx") ? ts.ScriptKind.TSX : path.endsWith("mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    const references = [];
    const walk = node => { if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) references.push(node.moduleSpecifier.text); if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) references.push(node.arguments[0].text); ts.forEachChild(node,walk); }; walk(parsed);
    for (const ref of references) {
      if (!ref.startsWith(".") && !ref.startsWith("@/")) continue;
      const base = ref.startsWith("@/") ? resolve(ROOT,"src",ref.slice(2)) : resolve(ROOT,dirname(path),ref), inside = relative(ROOT,base).replaceAll("\\","/"); if (inside.startsWith("../") || base === ROOT) fail("SOURCE_REFUSED");
      const variants = [inside, ...[".ts",".tsx",".mjs",".json","/index.ts","/index.tsx"].map(s => inside+s)];
      if (inside.endsWith(".js")) variants.push(inside.slice(0,-3)+".ts");
      let found;
      for (const candidate of variants) { try { const stat = await lstat(resolve(ROOT,candidate)); if (stat.isFile()) { found = candidate; break; } } catch (e) { if (e.code !== "ENOENT" && e.code !== "ENOTDIR") fail("SOURCE_REFUSED"); } }
      if (!found||found==="scripts/verification/chromium-no-store-qualification.mjs") fail("SOURCE_REFUSED"); await visit(found);
    }
  }
  for (const seed of ADMIN_BROWSER_SOURCE_SEEDS) await visit(seed);
  return Object.freeze([...paths].sort());
}
export async function collectAdminBrowserSources(run, sha) {
  const original = await collectAdminSources(run,sha), paths = new Set([...original.sourceHashes.map(r => r.path), ...await deriveAdminBrowserSourcePaths()]);
  const sourceHashes = [];
  // Git stdout is UTF-8 text. Compare its ASCII object ID so binary imports
  // retain every byte. SHA-1 identifies the Git blob; reports keep SHA-256.
  for (const path of [...paths].sort()) { if (!path || path.startsWith("node_modules/")) fail("SOURCE_REFUSED"); const bytes = await canonical(path), oid = (await run("git",["rev-parse","HEAD:"+path],15000)).stdout.trim(), expected = createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex"); if (!/^[a-f0-9]{40}$/.test(oid) || oid !== expected) fail("SOURCE_REFUSED"); sourceHashes.push({path,sha256:hash(bytes),bytes:bytes.length}); }
  const dependencyHashes = [...original.dependencyHashes], lock = JSON.parse((await canonical("package-lock.json")).toString("utf8"));
  for (const [name,version] of [["next","15.5.28"],["@supabase/ssr","0.12.7"],["playwright","1.63.0"],["playwright-core","1.63.0"],["@playwright/test","1.63.0"]]) { const path="node_modules/"+name+"/package.json", bytes=await canonical(path), p=JSON.parse(bytes.toString("utf8")), pin=lock.packages["node_modules/"+name]; if(p.name!==name||p.version!==version||pin?.version!==version||!pin.resolved?.startsWith("https://registry.npmjs.org/")||!pin.integrity?.startsWith("sha512-")) fail("SOURCE_REFUSED"); dependencyHashes.push({path,sha256:hash(bytes),bytes:bytes.length}); }
  if(!await qualifyNextStaticRuntime())fail("SOURCE_REFUSED");
  // The tombstone-equivalence control executes this exact pure SSR decoder.
  // Keep its installed bytes in the explicit dependency manifest as well.
  { const path="node_modules/@supabase/ssr/dist/main/utils/chunker.js",bytes=await canonical(path);if(dependencyHashes.some(r=>r.path===path))fail("SOURCE_REFUSED");dependencyHashes.push({path,sha256:hash(bytes),bytes:bytes.length}); }
  for(const pin of SOURCE_PINS.filter(p=>p.path.startsWith("node_modules/"))) { if(dependencyHashes.some(r=>r.path===pin.path))fail("SOURCE_REFUSED"); const bytes=await canonical(pin.path); dependencyHashes.push({path:pin.path,sha256:hash(bytes),bytes:bytes.length}); }
  if(sourceHashes.length!==ADMIN_BROWSER_SOURCE_COUNTS.git||dependencyHashes.length!==ADMIN_BROWSER_SOURCE_COUNTS.dependencies||new Set(dependencyHashes.map(r=>r.path)).size!==dependencyHashes.length)fail("SOURCE_REFUSED");
  return {sourceSha:original.sourceSha,sourceHashes,dependencyHashes};
}
export function createAdminBrowserNextProcess(env, {spawnProcess=spawn, kill=process.kill.bind(process), pause=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  let child, closed=false, failed=false, stopRequested=false, total=0, signal="NONE", stopPromise;
  const done=new Promise(resolveDone=>{ try { child=spawnProcess(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port","3117"],{cwd:ROOT,env,shell:false,detached:true,stdio:["ignore","pipe","pipe"]}); const collect=b=>{ total+=Buffer.byteLength(b); if(total>2097152) { failed=true; try{kill(-child.pid,"SIGTERM");signal="SIGTERM";}catch{signal="UNCONFIRMED";} } }; child.stdout.on("data",collect);child.stderr.on("data",collect);child.once("error",()=>{failed=true;closed=true;resolveDone();});child.once("close",()=>{failed||=!stopRequested;closed=true;resolveDone();}); }catch{failed=true;closed=true;resolveDone();} });
  const groupGone=()=>{if(!child?.pid)return closed;try{kill(-child.pid,0);return false;}catch(e){return e?.code==="ESRCH";}};
  return Object.freeze({metadata:()=>({closed,failed,groupConfirmed:closed&&groupGone(),signal}),async stop(){stopPromise??=(async()=>{stopRequested=true;try{if(!closed){kill(-child.pid,"SIGTERM");signal="SIGTERM";}for(let i=0;i<80&&!groupGone();i++)await pause(100);if(!groupGone()){kill(-child.pid,"SIGKILL");signal="SIGKILL";}await Promise.race([done,pause(5000)]);return closed&&groupGone();}catch{signal="UNCONFIRMED";return false;}})();return stopPromise;}});
}
/** A settled process/group does not erase a failure observed after readiness. */
export function vetoAdminBrowserNextFailure(report, metadata) {
  if(metadata.failed!==true)return false;
  report.status="failed";report.code="PROCESS_UNCONFIRMED";report.writeOutcomeUncertain=true;
  return true;
}
/** Anonymous /entrar readiness requires natural body EOF; cancellation only fails. */
export async function drainAdminBrowserNextReadiness(response, signal) {
  let reader, cancelPromise, aborted=false, ready=false;
  const signalValid=signal instanceof AbortSignal;
  const cancel=()=>cancelPromise??=(async()=>{try{await reader.cancel();}catch{}})();
  const abort=()=>{aborted=true;if(reader)void cancel();};
  try {
    if(!(response instanceof Response))return false;
    if(!response.body)return false;
    reader=response.body.getReader();
    if(!signalValid)return false;
    signal.addEventListener("abort",abort,{once:true});
    if(signal.aborted){abort();return false;}
    if(response.status!==200||response.url!==ADMIN_BROWSER_APP+"/entrar")return false;
    let bytes=0;
    for(;;){
      const result=await reader.read();
      if(aborted||signal.aborted)return false;
      if(result.done===true){ready=true;break;}
      if(result.done!==false||!(result.value instanceof Uint8Array))return false;
      bytes+=result.value.byteLength;if(bytes>2097152)return false;
    }
  } catch {} finally {
    if(reader){
      if(signalValid){try{signal.removeEventListener("abort",abort);}catch{ready=false;}}
      if(!ready||aborted||!signalValid||signal.aborted){ready=false;await cancel();}
      try{reader.releaseLock();}catch{ready=false;}
    }
  }
  return ready&&signalValid&&!aborted&&!signal.aborted;
}
const FORMAT='{{json .}}';
const notRun=kind=>({case:kind,report:blankAdminBrowserCase(kind),infrastructure:Object.fromEntries(ADMIN_BROWSER_INFRA_KEYS.map(k=>[k,false])),migrationsApplied:0,catalogueChecks:0,nextStopSignal:"NONE",nextStopDiagnostic:null});
async function freePort(port){await new Promise((resolvePort,reject)=>{const s=createServer();s.once("error",()=>reject(new Error("ENVIRONMENT_REFUSED")));s.listen({host:"127.0.0.1",port,exclusive:true},()=>s.close(e=>e?reject(new Error("ENVIRONMENT_REFUSED")):resolvePort()));});}
const ADMIN_PREFLIGHT_PHASES=Object.freeze(["before-free-port-3117","before-free-port-54320","before-free-port-54321","before-free-port-54322","before-temp-root","before-root-mode","before-home-directory","before-project-directory","before-config-render-and-write"]);
/** Last BEFORE marker only: not proof that an operation started or completed.
 * No error object, path, errno or provider message enters this diagnostic. */
export function adminBrowserPreflightDiagnostic(caseName,phase){
  if(typeof caseName!=="string"||!ADMIN_BROWSER_CASES.includes(caseName)||typeof phase!=="string"||!ADMIN_PREFLIGHT_PHASES.includes(phase))return null;
  return Object.freeze({schemaVersion:1,scenario:"admin-browser-preflight",case:caseName,phase,observation:"caught-original-error"});
}
export async function runAdminBrowserLocalCi(environment=process.env) {
  const report={schemaVersion:1,scenario:"admin-browser-local-ci",sourceSha:environment.GITHUB_SHA,status:"failed",code:"ENVIRONMENT_REFUSED",sourceHashes:[],dependencyHashes:[],cases:ADMIN_BROWSER_CASES.map(notRun),limitations:Object.fromEntries(ADMIN_BROWSER_LIMITATIONS.map(k=>[k,false])),writeOutcomeUncertain:false};
  try{
    const {runnerTemp}=requireAdminBrowserCi(environment);if(await realpath(runnerTemp)!==runnerTemp)fail("ENVIRONMENT_REFUSED");await assertNoEnvironmentFiles(ROOT);
    const os={PATH:environment.PATH,LANG:environment.LANG??"C.UTF-8",LC_ALL:environment.LC_ALL??"C.UTF-8",TZ:"UTC",NO_COLOR:"1"};
    const read=(cmd,args,timeout,extra={})=>runBoundedProcess(cmd,args,{cwd:ROOT,env:os,timeoutMs:timeout,maxBytes:2097152,...extra});
    const currentMigrations=await loadCanonicalMigrations(ROOT),migrations=await loadHistorical026Migrations(ROOT);if(currentMigrations.length!==27||migrations.length!==26)fail("SOURCE_REFUSED");for(let i=0;i<26;i++)if(!migrations[i].source.equals(currentMigrations[i].source))fail("SOURCE_REFUSED");
    Object.assign(report,await collectAdminBrowserSources(read,environment.GITHUB_SHA));const template=(await canonical("tests/fixtures/supabase-auth-local/config.toml")).toString("utf8");
    const chromiumRuntime=await prepareQualifiedChromium(read,os);
    process.stdout.write(JSON.stringify(chromiumRuntime)+"\n");
    for(const e of report.cases){
      let root,home,project,started=false,next,nextStop,local,systemIdentifier,unknown=false,groupKnown=true;const pending=new Set();const projectId="sc-auth-ci-"+randomBytes(12).toString("hex"),namespace="sc-admin-native-"+randomBytes(16).toString("hex");let child,preflightPhase=null;
      e.report={...blankAdminBrowserCase(e.case),status:"failed",code:"ENVIRONMENT_REFUSED"};
      const run=async(cmd,args,timeout,extra={})=>{const p=runBoundedProcess(cmd,args,{cwd:ROOT,env:child,timeoutMs:timeout,maxBytes:1048576,...extra}).finally(()=>pending.delete(p));pending.add(p);try{return await p;}catch(error){if(error?.groupConfirmed!==true)groupKnown=false;fail("PROCESS_UNCONFIRMED");}};
      const cli=args=>["--workdir",project,...args];
      const inventory=async()=>{for(const args of [["ps","--all","--quiet"],["volume","ls","--quiet"],["network","ls","--quiet"]])if((await run("docker",[...args,"--filter","label=com.supabase.cli.project="+projectId],15000)).stdout.trim())return false;return true;};
      try{
        for(const port of [3117,54320,54321,54322]){preflightPhase="before-free-port-"+port;await freePort(port);}
        preflightPhase="before-temp-root";root=await mkdtemp(join(runnerTemp,"sc-admin-browser-"));
        preflightPhase="before-root-mode";await chmod(root,0o700);home=join(root,"home");project=join(root,"project");
        preflightPhase="before-home-directory";await mkdir(home,{mode:0o700});
        preflightPhase="before-project-directory";await mkdir(join(project,"supabase"),{recursive:true,mode:0o700});
        preflightPhase="before-config-render-and-write";await writeFile(join(project,"supabase/config.toml"),renderLocalConfig(template,projectId),{flag:"wx",mode:0o600});
        preflightPhase=null;
        child={...os,HOME:home,XDG_CONFIG_HOME:join(home,".config"),XDG_CACHE_HOME:join(home,".cache"),CI:"true",GITHUB_ACTIONS:"true",RUNNER_TEMP:runnerTemp,SC_AUTH_LOCAL_CI_RUN:"1",SC_ADMIN_BROWSER_LOCAL_CI_RUN:"1"};
        if((await run("supabase",["--version"],15000)).stdout.trim()!==CLI_VERSION||!await inventory())fail("ENVIRONMENT_REFUSED");started=true;await run("supabase",cli(["start"]),600000,{capture:false});local=decodeLocalStatus((await run("supabase",cli(["status","-o","json"]),30000)).stdout);const pg=localPsqlEnvironment(environment,home,local);
        const query=async input=>decodeAdminSql((await run("psql",["--no-psqlrc","--no-password","--quiet","--tuples-only","--no-align","--set","ON_ERROR_STOP=1","--file=-"],15000,{env:pg,input})).stdout);
        const write=async input=>{try{await run("psql",["--no-psqlrc","--no-password","--quiet","--set","ON_ERROR_STOP=1","--file=-"],60000,{env:pg,input,capture:false});}catch{unknown=true;fail("WRITE_OUTCOME_UNCERTAIN");}};
        systemIdentifier=verifyAdminInstance(await query(ADMIN_INSTANCE_SQL));e.infrastructure.pg17=e.infrastructure.instanceBound=true;
        const ids=new Set();for(const kind of ["db","kong","auth","rest","storage"]){const raw=decodeAdminSql((await run("docker",["inspect","--format",FORMAT,"supabase_"+kind+"_"+projectId],15000)).stdout);const v={id:raw.Id,name:raw.Name,label:raw.Config?.Labels?.["com.supabase.cli.project"],running:raw.State?.Running,imageId:raw.Image,ports:raw.NetworkSettings?.Ports};const id=acceptAdminContainer(v,projectId,kind);if(ids.has(id))fail("ENVIRONMENT_REFUSED");ids.add(id);}e.infrastructure.containersBound=true;
        assertDatabasePreflight(await query(DATABASE_PREFLIGHT),false);await write(LOCAL_INFRASTRUCTURE_FIXTURE);assertDatabasePreflight(await query(DATABASE_PREFLIGHT));for(const m of migrations){await write(m.source);e.migrationsApplied++;}
        const historicalCatalogue=await canonical(HISTORICAL026_CATALOGUE),capturedCatalogue=report.sourceHashes.find(row=>row.path===HISTORICAL026_CATALOGUE);if(historicalCatalogue.length!==HISTORICAL026_CATALOGUE_BYTES||hash(historicalCatalogue)!==HISTORICAL026_CATALOGUE_SHA256||!capturedCatalogue||capturedCatalogue.bytes!==historicalCatalogue.length||capturedCatalogue.sha256!==HISTORICAL026_CATALOGUE_SHA256)fail("SQL_REFUSED");const catalogue=await query(historicalCatalogue.toString("utf8"));if(catalogue?.version!==1||catalogue.ok!==true||catalogue.checks!==1720||catalogue.deviations?.length!==0)fail("SQL_REFUSED");e.catalogueChecks=1720;e.infrastructure.catalogue=true;
        await write(adminMarkerInput({namespace,sourceSha:report.sourceSha,systemIdentifier,projectId},catalogue));e.infrastructure.markerBound=true;await write("notify pgrst, 'reload schema';");
        const reportPath=join(root,"admin-browser-case-report.json"),workerEnv={...child,NODE_ENV:"development",APP_MODE:"supabase",APP_URL:ADMIN_BROWSER_APP,SUPABASE_URL:"http://127.0.0.1:54321",SUPABASE_PUBLISHABLE_KEY:local.publishable,SUPABASE_SECRET_KEY:local.secret,AUTH_STATE_SECRET:randomBytes(48).toString("base64url"),AUTH_RATE_LIMIT_SECRET:randomBytes(48).toString("base64url"),ADMIN_COMMAND_SECRET:randomBytes(48).toString("base64url"),NEXT_TELEMETRY_DISABLED:"1",PLAYWRIGHT_NO_COPY_PROMPT:"1",SC_ADMIN_BROWSER_RUN:"1",SC_ADMIN_BROWSER_CASE:e.case,SC_NEXT_STOP_NONCE:randomBytes(16).toString("hex"),SC_NEXT_STOP_CASE:e.case,SC_ADMIN_BROWSER_NAMESPACE:namespace,SC_ADMIN_BROWSER_SYSTEM:systemIdentifier,SC_ADMIN_BROWSER_PROJECT:projectId,SC_ADMIN_BROWSER_PG_PASSWORD:local.password,SC_ADMIN_BROWSER_REPORT:reportPath,GITHUB_SHA:report.sourceSha};
        // Installed browser cache belongs to the CI home, not the private Auth home.
        workerEnv.PLAYWRIGHT_BROWSERS_PATH=join(environment.HOME,".cache/ms-playwright");
        next=createAdminBrowserNextProcess(workerEnv);let ready=false;for(let i=0;i<120&&!ready;i++){if(next.metadata().failed||next.metadata().closed)fail("PROCESS_UNCONFIRMED");try{const signal=AbortSignal.timeout(1000),response=await fetch(ADMIN_BROWSER_APP+"/entrar",{redirect:"error",signal});ready=await drainAdminBrowserNextReadiness(response,signal);}catch{}if(!ready)await new Promise(r=>setTimeout(r,500));}if(!ready||next.metadata().failed||next.metadata().closed)fail("PROCESS_UNCONFIRMED");
        nextStop=createRunnerNextStopRelay(nextStopEnvironment(workerEnv,e.case),next,e);
        let workerSuccess=false;try{await run(process.execPath,["node_modules/playwright/cli.js","test","--config","playwright.admin-browser-local.config.ts"],400000,{env:workerEnv,capture:false,stdoutObserver:nextStop.observer});workerSuccess=true;e.infrastructure.workerExitZero=e.infrastructure.workerGroupConfirmed=true;}catch{unknown=true;e.infrastructure.workerGroupConfirmed=groupKnown;} const stopObservation=nextStop.diagnostic();e.nextStopDiagnostic=stopObservation===null?null:Object.freeze({phase:"after-worker-run-settlement-before-finally",...stopObservation});
        const nextFailed=vetoAdminBrowserNextFailure(report,next.metadata());unknown||=nextFailed;
        const st=await lstat(reportPath);if(!st.isFile()||st.isSymbolicLink()||st.size>32768||await realpath(reportPath)!==reportPath)fail("REPORT_REFUSED");e.report=validateAdminBrowserCase(JSON.parse((await readFile(reportPath)).toString("utf8")));if(e.report.case!==e.case)fail("REPORT_REFUSED");unknown||=e.report.writeOutcomeUncertain;
        if(nextFailed)fail("PROCESS_UNCONFIRMED");
        if(!workerSuccess||e.report.status!=="passed")fail(e.report.code==="PASSED"?"PROCESS_UNCONFIRMED":e.report.code);
      }catch(error){
        // Best-effort passive evidence. Losing this line never changes the
        // original refusal, uncertainty, stage inventory or cleanup policy.
        try{const diagnostic=adminBrowserPreflightDiagnostic(e.case,preflightPhase);if(diagnostic)process.stdout.write(JSON.stringify(diagnostic)+"\n");}catch{}
        const code=ADMIN_BROWSER_CODES.includes(error?.message)?error.message:"ENVIRONMENT_REFUSED";if(e.report.status!=="passed")e.report={...e.report,status:"failed",code,writeOutcomeUncertain:e.report.writeOutcomeUncertain||unknown};report.code=code;}
      finally{
        if(next){e.infrastructure.nextGroupConfirmed=await(nextStop?nextStop.stopOnce():next.stop());const metadata=next.metadata();e.nextStopSignal=metadata.signal;const nextFailed=vetoAdminBrowserNextFailure(report,metadata);unknown||=nextFailed;if(nextStop?.snapshot().firstFailure){unknown=true;report.code="PROCESS_UNCONFIRMED";}}else e.infrastructure.nextGroupConfirmed=true;
        e.infrastructure.ioQuiet=groupKnown&&pending.size===0&&e.infrastructure.nextGroupConfirmed&&e.report.pendingRequests===0&&e.report.pendingInspections===0;
        if(started&&e.infrastructure.ioQuiet){try{await run("supabase",cli(["stop","--project-id",projectId,"--no-backup"]),120000,{capture:false});e.infrastructure.namespaceRemoved=await inventory();}catch{report.code="TEARDOWN_UNCONFIRMED";}}
        if(root&&e.infrastructure.ioQuiet&&(!started||e.infrastructure.namespaceRemoved)){try{assertTempDescendant(runnerTemp,root);if((await lstat(root)).isSymbolicLink()||await realpath(root)!==root)fail("ENVIRONMENT_REFUSED");await rm(root,{recursive:true,force:false});e.infrastructure.directoriesRemoved=true;if(!started)e.infrastructure.namespaceRemoved=true;}catch{report.code="TEARDOWN_UNCONFIRMED";}}
        report.writeOutcomeUncertain||=unknown||e.report.writeOutcomeUncertain;
      }
      if(report.writeOutcomeUncertain||e.report.status!=="passed"||Object.values(e.infrastructure).some(v=>!v)){if(e.report.status==="passed"&&!report.writeOutcomeUncertain)report.code="TEARDOWN_UNCONFIRMED";break;}
    }
    if(report.cases.every(e=>e.report.status==="passed"&&Object.values(e.infrastructure).every(Boolean))&&!report.writeOutcomeUncertain){report.status="passed";report.code="PASSED";}
  }catch(error){report.code=ADMIN_BROWSER_CODES.includes(error?.message)?error.message:"ENVIRONMENT_REFUSED";}
  return validateAdminBrowserCiReport(report);
}
export async function main(argv=process.argv.slice(2),env=process.env,output=v=>process.stdout.write(JSON.stringify(v)+"\n")){
  if(!argv.length||argv.length===1&&argv[0]==="--help"){output({schemaVersion:1,scenario:"admin-browser-local-ci",code:"NO_SERVICE_STARTED"});return 0;}
  if(argv.length!==1||argv[0]!=="--execute"){output({schemaVersion:1,scenario:"admin-browser-local-ci",status:"failed",code:"ENVIRONMENT_REFUSED"});return 1;}
  try{const report=await runAdminBrowserLocalCi(env);output(report);return report.status==="passed"?0:1;}catch{output({schemaVersion:1,scenario:"admin-browser-local-ci",status:"failed",code:"REPORT_REFUSED"});return 1;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
