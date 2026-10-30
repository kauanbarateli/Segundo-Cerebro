/** Own Linux CURRENT27 job. Help/import never starts an SDK, bundle or service. */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "node:net";
import { performance } from "node:perf_hooks";
import { CLI_VERSION, requireCiRunner, assertTempDescendant, assertNoEnvironmentFiles, renderLocalConfig, decodeLocalStatus, localPsqlEnvironment, runBoundedProcess, DATABASE_PREFLIGHT, assertDatabasePreflight, LOCAL_INFRASTRUCTURE_FIXTURE } from "./auth-local-ci.mjs";
import { acceptAdminContainer, verifyAdminTslibScope } from "./admin-native-backend-local-ci.mjs";
import { acceptsAdminNativeDeleteAcknowledgement } from "../../tests/e2e-auth-local/admin-native-backend-case.mjs";
import { CURRENT27_CANONICAL_REVIEW, readCurrent27CanonicalMigrations } from "../../tests/helpers/canonical-release-source.mjs";
import { goalNativeBootstrapSql } from "../../tests/e2e-auth-local/finance-goals-terminal-native-sql.mjs";
import { GoalNativeError, nativeRefuse, validateGoalNativeNodeVersion } from "../../tests/e2e-auth-local/finance-goals-terminal-native-contract.mjs";
import { CURRENT27_MIGRATION_SHA256, CURRENT27_CATALOGUE_SHA256, newCurrent27InsufficiencyReport, validateCurrent27InsufficiencyReport } from "../../tests/e2e-auth-local/finance-goals-current27-insufficiency-contract.mjs";
import { runCurrent27InsufficiencyCase } from "../../tests/e2e-auth-local/finance-goals-current27-insufficiency-case.mjs";
import { CURRENT27_ENTRY, CURRENT27_MAIN_MS, CURRENT27_PRODUCT_NAMES, CURRENT27_SDK_MODULES, admitCurrent27Invocation, current27Budget, current27StrictProcess, current27EnableMigrations, current27Canonical, current27SourceClosure, assertCurrent27SourceSet, assertCurrent27BundleModule, assertCurrent27BundleComplete, current27LedgerSql, assertCurrent27Ledger, assertCurrent27SecondApply, current27OneJson, current27BlobId } from "../../tests/e2e-auth-local/finance-goals-current27-insufficiency-preparation.mjs";
const ROOT=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const need=(value,code="SOURCE_REFUSED")=>{if(!value)nativeRefuse(code);};
const hash=bytes=>createHash("sha256").update(bytes).digest("hex"),normal=path=>path.replaceAll("\\","/");
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const PG_ARGS=["--no-psqlrc","--no-password","--quiet","--tuples-only","--no-align","--set","ON_ERROR_STOP=1","--set","VERBOSITY=verbose","--file=-"];
const CONTAINER_FORMAT='{"id":{{json .Id}},"name":{{json .Name}},"label":{{json (index .Config.Labels "com.supabase.cli.project")}},"running":{{json .State.Running}},"imageId":{{json .Image}},"ports":{{json .NetworkSettings.Ports}}}';
async function canonical(path,dependency=false){return current27Canonical(ROOT,path,dependency);}
async function collectSources(run,sha) {
  need((await run("git",["rev-parse","HEAD"],15000)).stdout.trim()===sha&&/^[a-f0-9]{40}$/.test(sha));
  const tree=(await run("git",["rev-parse","HEAD^{tree}"],15000)).stdout.trim();need(/^[a-f0-9]{40}$/.test(tree));
  need(!(await run("git",["status","--porcelain","--untracked-files=all"],15000)).stdout.trim());
  const paths=await current27SourceClosure(ROOT);assertCurrent27SourceSet(paths);
  const input=paths.map(path=>sha+":"+path).join("\n")+"\n";
  const raw=(await run("git",["cat-file","--batch-check=%(objectname) %(objecttype) %(objectsize)"],30000,{input})).stdout.trim().split(/\r?\n/);need(raw.length===paths.length);
  const sources=[];
  for(let i=0;i<paths.length;i++){
    const bytes=await canonical(paths[i]),fields=raw[i].split(" ");
    need(fields.length===3&&fields[0]===current27BlobId(bytes)&&fields[1]==="blob"&&fields[2]===String(bytes.length));
    sources.push({path:paths[i],sha256:hash(bytes),bytes:bytes.length});
  }
  const lock=JSON.parse((await canonical("package-lock.json")).toString("utf8")),dependencies=[];
  for(const path of CURRENT27_SDK_MODULES){
    const bytes=await canonical(path,true);let folder=dirname(resolve(ROOT,path)),verified=false;
    while(folder.startsWith(resolve(ROOT,"node_modules")+"/")){
      const key=normal(relative(ROOT,folder));let pkgBytes;
      try{pkgBytes=await canonical(key+"/package.json",true);}catch(error){if(error.code!=="ENOENT")throw error;folder=dirname(folder);continue;}
      const pkg=JSON.parse(pkgBytes.toString("utf8"));
      if(key==="node_modules/tslib/modules"){verifyAdminTslibScope(key+"/package.json",pkgBytes,JSON.parse((await canonical("node_modules/tslib/package.json",true)).toString("utf8")),lock.packages["node_modules/tslib"]);folder=dirname(folder);continue;}
      const pin=lock.packages[key];
      need(pin&&pkg.version===pin.version&&pkg.name===key.slice(13)&&/^https:\/\/registry\.npmjs\.org\//.test(pin.resolved)&&/^sha512-/.test(pin.integrity));verified=true;break;
    }
    need(verified);dependencies.push({path,sha256:hash(bytes),bytes:bytes.length});
  }
  need(JSON.parse((await canonical("node_modules/@supabase/supabase-js/package.json",true)).toString("utf8")).version==="2.117.2");
  need(hash(await canonical("node_modules/server-only/empty.js",true))==="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  const order=(a,b)=>a.path<b.path?-1:a.path>b.path?1:0;
  return{sourceSha:sha,sourceTree:tree,sources:sources.sort(order),dependencies:dependencies.sort(order)};
}
async function loadProduct(runRoot,manifest,budget) {
  need(budget.mainRemaining()>0,"SESSION_TIMEOUT");
  const output=join(runRoot,"current27-product.mjs"),entryClosure=await current27SourceClosure(ROOT,[CURRENT27_ENTRY]);let build,handle,bundleHash;
  try{
    const modules=new Set(),{rolldown}=await import("rolldown");
    build=await rolldown({input:resolve(ROOT,CURRENT27_ENTRY),platform:"node",tsconfig:false,logLevel:"silent",resolve:{conditionNames:["react-server","node","import","default"]},plugins:[{name:"closed-current27-product-graph",async moduleParsed(info){
      need(budget.mainRemaining()>0,"SESSION_TIMEOUT");const path=normal(relative(ROOT,info.id));
      assertCurrent27BundleModule(path,info.dynamicallyImportedIds,entryClosure,manifest);
      need(await realpath(info.id)===info.id,"GRAPH_REFUSED");
      const prior=[...manifest.sources,...manifest.dependencies].find(row=>row.path===path),bytes=await canonical(path,path.startsWith("node_modules/"));
      need(bytes.length===prior.bytes&&hash(bytes)===prior.sha256,"GRAPH_REFUSED");modules.add(path);
    }}]});
    const{output:chunks}=await build.generate({format:"es",codeSplitting:false,sourcemap:false}),chunk=chunks[0];
    need(budget.mainRemaining()>0&&chunks.length===1&&chunk.type==="chunk"&&chunk.dynamicImports.length===0&&chunk.imports.every(path=>["node:crypto","node:module","node:fs/promises","node:path","node:url"].includes(path))&&Buffer.byteLength(chunk.code)<2097152,"GRAPH_REFUSED");
    assertCurrent27BundleComplete([...modules],entryClosure);
    handle=await open(output,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);await handle.writeFile(chunk.code,"utf8");await handle.sync();await handle.close();handle=null;
    need(await realpath(output)===output&&!(await lstat(output)).isSymbolicLink(),"GRAPH_REFUSED");
    bundleHash=hash(await readFile(output));need(bundleHash===hash(Buffer.from(chunk.code)),"GRAPH_REFUSED");
    const product=await import(pathToFileURL(output).href);need(budget.mainRemaining()>0&&same(Object.keys(product).sort(),CURRENT27_PRODUCT_NAMES),"GRAPH_REFUSED");
    return{product,output,async remove(){need(await realpath(output)===output&&!(await lstat(output)).isSymbolicLink()&&hash(await readFile(output))===bundleHash,"CLEANUP_UNCONFIRMED");await rm(output,{force:false});try{await lstat(output);nativeRefuse("CLEANUP_UNCONFIRMED");}catch(error){if(error.code!=="ENOENT")throw error;}}};
  }finally{if(handle)await handle.close();if(build)await build.close();}
}
function localActors(product,local,namespace,remaining,signal){
  let slot=null,pending=0,unknown=false,closed=false,requests=0;
  const transport=async(input,init={})=>{need(slot&&!closed&&requests++<24&&remaining()>0&&!signal.aborted,"AUTH_REFUSED");const expected=slot;slot=null;const url=new URL(typeof input==="string"?input:input.url),headers=new Headers(init.headers),method=(init.method??"GET").toUpperCase();need(url.origin==="http://127.0.0.1:54321"&&!url.hash&&!url.username&&!url.password&&url.pathname+url.search===expected.path&&method===expected.method,"AUTH_REFUSED");const key=["login","access"].includes(expected.kind)?local.publishable:local.secret,bearer=["identity","access","logout"].includes(expected.kind)?expected.actor.token:key;need(headers.get("apikey")===key&&headers.get("authorization")==="Bearer "+bearer,"AUTH_REFUSED");let body;if(init.body!==undefined){need(typeof init.body==="string"&&Buffer.byteLength(init.body)<=65536,"AUTH_REFUSED");try{body=JSON.parse(init.body);}catch{nativeRefuse("AUTH_REFUSED");}}const actor=expected.actor;if(expected.kind==="create")need(same(body,{id:actor.id,email:actor.email,password:actor.password,email_confirm:true,app_metadata:{sc_goal_native_fixture:namespace}}),"AUTH_REFUSED");else if(expected.kind==="login")need(body?.email===actor.email&&body.password===actor.password&&Object.keys(body).every(k=>["email","password","gotrue_meta_security"].includes(k)),"AUTH_REFUSED");else if(expected.kind==="access")need(same(body,{}),"AUTH_REFUSED");else if(expected.kind==="delete")need(same(body,{should_soft_delete:false}),"AUTH_REFUSED");else need(body===undefined,"AUTH_REFUSED");const abort=new AbortController();const forwardAbort=()=>abort.abort();signal.addEventListener("abort",forwardAbort,{once:true});if(signal.aborted)abort.abort();let timer,reader;pending++;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{unknown=true;abort.abort();void reader?.cancel().catch(()=>{});reject(new GoalNativeError("AUTH_REFUSED"));},Math.max(1,Math.min(15000,Math.floor(remaining()))));});const owned=(async()=>{const response=await fetch(url,{...init,signal:abort.signal,redirect:"error",cache:"no-store",credentials:"omit"});need(!response.redirected,"AUTH_REFUSED");const parts=[];let size=0;try{if(response.body){reader=response.body.getReader();for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;need(size<=1048576&&!abort.signal.aborted,"AUTH_REFUSED");parts.push(part.value);}}const bytes=Buffer.concat(parts);return new Response(response.body?bytes:null,{status:response.status,headers:response.headers});}finally{for(const part of parts)part.fill(0);}})().finally(()=>{pending--;});try{return await Promise.race([owned,timeout]);}catch{unknown=true;nativeRefuse("AUTH_REFUSED");}finally{clearTimeout(timer);signal.removeEventListener("abort",forwardAbort);}};
  const client=(key,token)=>product.createClient("http://127.0.0.1:54321",key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport,...(token?{headers:{Authorization:"Bearer "+token}}:{})}}),admin=client(local.secret);
  const a={id:randomUUID(),email:`goal-native-${randomBytes(16).toString("hex")}@example.invalid`,password:randomBytes(24).toString("base64url")+"-Aa1!"},b={id:randomUUID(),email:`goal-native-${randomBytes(16).toString("hex")}@example.invalid`,password:randomBytes(24).toString("base64url")+"-Aa1!"};
  const permit=(kind,actor,path,method)=>{need(!slot&&!pending,"AUTH_REFUSED");slot={kind,actor,path,method};};const matches=(u,f)=>u?.id===f.id&&u.email===f.email&&u.role==="authenticated"&&u.is_anonymous===false&&u.app_metadata?.sc_goal_native_fixture===namespace;
  const a2={...a};
  async function prepare(){
    for(const actor of[a,b]){permit("create",actor,"/auth/v1/admin/users","POST");const result=await admin.auth.admin.createUser({id:actor.id,email:actor.email,password:actor.password,email_confirm:true,app_metadata:{sc_goal_native_fixture:namespace}});if(!result.error&&!matches(result.data.user,actor))unknown=true;need(!result.error&&matches(result.data.user,actor),"AUTH_REFUSED");}
    for(const actor of[a,a2,b]){permit("login",actor,"/auth/v1/token?grant_type=password","POST");const login=await client(local.publishable).auth.signInWithPassword({email:actor.email,password:actor.password});need(!login.error&&matches(login.data.user,actor)&&login.data.session,"AUTH_REFUSED");actor.token=login.data.session.access_token;const claims=JSON.parse(Buffer.from(actor.token.split(".")[1],"base64url").toString("utf8"));need(claims.sub===actor.id&&claims.role==="authenticated"&&typeof claims.session_id==="string"&&/^[a-f0-9-]{36}$/.test(claims.session_id)&&claims.exp*1000>Date.now()+120000,"AUTH_REFUSED");actor.sessionId=claims.session_id;permit("identity",actor,"/auth/v1/user","GET");const verified=await admin.auth.getUser(actor.token);need(!verified.error&&matches(verified.data.user,actor),"AUTH_REFUSED");permit("access",actor,"/rest/v1/rpc/my_access_state","POST");const access=await client(local.publishable,actor.token).rpc("my_access_state");need(!access.error&&access.data?.user_id===actor.id&&access.data.role==="user"&&access.data.must_change_password===false&&same(Object.keys(access.data.entitlements).sort(),[]),"AUTH_REFUSED");}
    need(new Set([a.sessionId,a2.sessionId,b.sessionId]).size===3,"AUTH_REFUSED");
  }
  return{actors:{a,a2,b},prepare,metadata:()=>({pending,unknown}),async cleanup(){need(!pending&&!slot&&!unknown,"CLEANUP_UNCONFIRMED");for(const actor of[a,b]){permit("logout",actor,"/auth/v1/logout?scope=global","POST");const signed=await admin.auth.admin.signOut(actor.token,"global");need(!signed.error,"CLEANUP_UNCONFIRMED");permit("delete",actor,"/auth/v1/admin/users/"+actor.id,"DELETE");const deleted=await admin.auth.admin.deleteUser(actor.id);need(acceptsAdminNativeDeleteAcknowledgement(deleted,user=>matches(user,actor)),"CLEANUP_UNCONFIRMED");}need(!pending&&!slot&&!unknown,"CLEANUP_UNCONFIRMED");closed=true;}};
}
export async function runCurrent27InsufficiencyCi(environment=process.env) {
  const report=newCurrent27InsufficiencyReport(),budget=current27Budget(()=>performance.now()),abort=new AbortController();
  let timer,runnerTemp,runRoot,home,project,projectId,toolEnv,bundle,activeHttp,started=false,quiet=true,groups=true,stackGone=false,tempGone=false,caseObserved=false;
  const run=async(command,args,cap,options={})=>{
    need(!abort.signal.aborted,"SESSION_TIMEOUT");report.pending.commands++;
    try{return await current27StrictProcess(runBoundedProcess,command,args,{cwd:ROOT,env:toolEnv,maxBytes:2097152,timeoutMs:budget.mainTimeout(cap),...options});}
    catch(error){if(Object.getOwnPropertyDescriptor(error??{},"groupConfirmed")?.value!==true){groups=false;quiet=false;}throw error;}
    finally{report.pending.commands--;}
  };
  const cli=args=>["--workdir",project,...args];
  const inventory=async execute=>{
    const filter="label=com.supabase.cli.project="+projectId;
    for(const args of[["ps","--all","--quiet"],["volume","ls","--quiet"],["network","ls","--quiet"]])if((await execute("docker",[...args,"--filter",filter],15000)).stdout.trim())return false;
    return true;
  };
  try {
    const env=admitCurrent27Invocation(["--execute-current27-insufficiency-v1"],environment,process.platform);
    ({runnerTemp}=requireCiRunner(env));need(await realpath(ROOT)===ROOT&&process.cwd()===ROOT&&await realpath(runnerTemp)===runnerTemp,"ENVIRONMENT_REFUSED");
    timer=setTimeout(()=>abort.abort(),CURRENT27_MAIN_MS);await assertNoEnvironmentFiles(ROOT);
    report.phase="sources";report.nodeVersion=validateGoalNativeNodeVersion((await canonical(".nvmrc")).toString("utf8"),process.versions.node);
    toolEnv={PATH:env.PATH,LANG:env.LANG,LC_ALL:env.LC_ALL,TZ:"UTC",CI:"true",GITHUB_ACTIONS:"true",RUNNER_TEMP:runnerTemp,NO_COLOR:"1",SC_AUTH_LOCAL_CI_RUN:"1",SC_FINANCE_GOALS_TERMINAL_NATIVE_CI_RUN:"1"};
    Object.assign(report,await collectSources(run,env.GITHUB_SHA));
    const migrations=await readCurrent27CanonicalMigrations(ROOT);
    need(migrations.length===27&&CURRENT27_CANONICAL_REVIEW.length===27&&hash(migrations[26].source)===CURRENT27_MIGRATION_SHA256);
    runRoot=await mkdtemp(join(runnerTemp,"sc-current27-goals-"));await chmod(runRoot,0o700);
    home=join(runRoot,"home");project=join(runRoot,"project");projectId="sc-auth-ci-"+randomBytes(12).toString("hex");
    await mkdir(home,{mode:0o700});await mkdir(join(project,"supabase/migrations"),{recursive:true,mode:0o700});
    Object.assign(toolEnv,{HOME:home,XDG_CONFIG_HOME:home+"/.config",XDG_CACHE_HOME:home+"/.cache"});
    const namespace="sc-goals-terminal-native-"+randomBytes(16).toString("hex");
    bundle=await loadProduct(runRoot,report,budget);
    for(const port of[54320,54321,54322])await new Promise((yes,no)=>{const server=createServer();server.once("error",()=>no(new GoalNativeError("PORT_REFUSED")));server.listen({host:"127.0.0.1",port,exclusive:true},()=>server.close(error=>error?no(error):yes()));});
    const config=current27EnableMigrations(renderLocalConfig((await canonical("tests/fixtures/supabase-auth-local/config.toml")).toString("utf8"),projectId));
    await writeFile(join(project,"supabase/config.toml"),config,{flag:"wx",mode:0o600});
    need((await run("supabase",["--version"],15000)).stdout.trim()===CLI_VERSION,"ENVIRONMENT_REFUSED");
    need(/^psql \(PostgreSQL\) 17\.\d+[^\r\n]*$/.test((await run("psql",["--version"],15000)).stdout.trim()),"ENVIRONMENT_REFUSED");
    for(const[command,flags]of[["start",[]],["status",["--output"]],["stop",["--project-id","--no-backup"]],["migration",[]]]){
      const help=(await run("supabase",[command,"--help"],15000)).stdout;need(flags.every(flag=>help.includes(flag)),"ENVIRONMENT_REFUSED");
    }
    need(await inventory(run),"ENVIRONMENT_REFUSED");report.phase="stack";started=true;await run("supabase",cli(["start"]),600000);
    const local=decodeLocalStatus((await run("supabase",cli(["status","-o","json"]),30000)).stdout);
    const pg=localPsqlEnvironment(env,home,local);delete pg.NEXT_TELEMETRY_DISABLED;pg.SC_FINANCE_GOALS_TERMINAL_NATIVE_CI_RUN="1";pg.PGAPPNAME="sc.goals.native."+namespace.slice(-32)+".control";
    const query=async text=>current27OneJson((await run("psql",PG_ARGS,60000,{env:pg,input:text})).stdout);
    const write=async text=>{try{await run("psql",PG_ARGS,60000,{env:pg,input:text});}catch(error){report.writeOutcomeUncertain=true;throw error;}};
    for(const kind of["db","kong","auth","rest","storage"]){const value=current27OneJson((await run("docker",["inspect","--format",CONTAINER_FORMAT,"supabase_"+kind+"_"+projectId],15000)).stdout);acceptAdminContainer(value,projectId,kind);}
    assertDatabasePreflight(await query(DATABASE_PREFLIGHT),false);await write(LOCAL_INFRASTRUCTURE_FIXTURE);assertDatabasePreflight(await query(DATABASE_PREFLIGHT));
    const identity=await query(goalNativeBootstrapSql(namespace,report.sourceSha));
    need(identity.namespace===namespace&&identity.sourceSha===report.sourceSha&&identity.database==="postgres"&&identity.owner==="postgres"&&Number.isInteger(identity.version)&&identity.version>=170000&&identity.version<180000&&/^[0-9]{16,20}$/.test(identity.systemIdentifier),"INSTANCE_REFUSED");
    const context={namespace,sourceSha:report.sourceSha,systemIdentifier:identity.systemIdentifier};report.serverVersion=identity.version;report.phase="canonical";
    for(let i=0;i<27;i++)await writeFile(join(project,"supabase/migrations",CURRENT27_CANONICAL_REVIEW[i].file),migrations[i].source,{flag:"wx",mode:0o600});
    const verifyCopies=async()=>{
      const dir=join(project,"supabase/migrations");need(await realpath(dir)===dir&&!(await lstat(dir)).isSymbolicLink());
      need(same((await readdir(dir)).sort(),CURRENT27_CANONICAL_REVIEW.map(row=>row.file).sort()));
      for(let i=0;i<27;i++){const file=join(dir,CURRENT27_CANONICAL_REVIEW[i].file);need(await realpath(file)===file&&(await lstat(file)).isFile()&&hash(await readFile(file))===CURRENT27_CANONICAL_REVIEW[i].sha256);}
    };
    await verifyCopies();
    try{await run("supabase",cli(["migration","up","--local"]),180000);}catch(error){report.writeOutcomeUncertain=true;throw error;}
    const first=assertCurrent27Ledger(await query(current27LedgerSql(context)),context);
    await verifyCopies();
    try{await run("supabase",cli(["migration","up","--local"]),60000);}catch(error){report.writeOutcomeUncertain=true;throw error;}
    const second=assertCurrent27Ledger(await query(current27LedgerSql(context)),context);
    const pendingOnSecondApply=assertCurrent27SecondApply(first,second);
    const catalogue=await canonical("supabase/tests/release-catalog.sql");need(catalogue.length===207834&&hash(catalogue)===CURRENT27_CATALOGUE_SHA256,"CATALOGUE_REFUSED");
    const release=await query(catalogue.toString("utf8"));
    need(release.version===1&&release.ok===true&&release.checks===2512&&Array.isArray(release.deviations)&&release.deviations.length===0,"CATALOGUE_REFUSED");
    report.installation={...context,sourceTree:report.sourceTree,migrationsApplied:27,pendingOnSecondApply,catalogueChecks:2512,migration27Sha256:CURRENT27_MIGRATION_SHA256,catalogueSha256:CURRENT27_CATALOGUE_SHA256,companionsApplied:false,sourceClosureExact:true,ledgerExact:true};
    await write("notify pgrst, 'reload schema';");
    // Do not create ordinary actors without enough remaining main-phase reserve.
    need(budget.mainRemaining()>300000&&!abort.signal.aborted,"SESSION_TIMEOUT");
    report.phase="auth";activeHttp=localActors(bundle.product,local,namespace,()=>budget.mainRemaining(),abort.signal);await activeHttp.prepare();
    report.phase="baseline";caseObserved=true;
    const result=await runCurrent27InsufficiencyCase({product:bundle.product,context,sessionOptions:{cwd:ROOT,environment:pg},actors:activeHttp.actors,cleanupActors:()=>activeHttp.cleanup(),installation:report.installation,signal:abort.signal});
    report.checks=result.checks;report.counts=result.counts;report.sqlProof=result.sqlProof;report.writeOutcomeUncertain ||= result.unknown||activeHttp.metadata().unknown;
    quiet&&=result.quiet;groups&&=result.quiet;report.pending.http=activeHttp.metadata().pending;report.pending.backends=result.quiet?0:1;
    need(result.completed&&!report.writeOutcomeUncertain&&!report.pending.http,result.code==="NOT_RUN"?"MATERIAL_REFUSED":result.code);
    report.cleanup.backends=true;report.phase="oracle";
    for(const row of[...report.sources,...report.dependencies]){need(budget.mainRemaining()>0,"SESSION_TIMEOUT");const bytes=await canonical(row.path,row.path.startsWith("node_modules/"));need(bytes.length===row.bytes&&hash(bytes)===row.sha256);}
    need((await run("git",["rev-parse","HEAD"],15000)).stdout.trim()===report.sourceSha&&!(await run("git",["status","--porcelain","--untracked-files=all"],15000)).stdout.trim());
    await assertNoEnvironmentFiles(ROOT);need(budget.mainRemaining()>0&&!abort.signal.aborted,"SESSION_TIMEOUT");
    report.code="PASSED";
  }catch(error){
    report.code=error instanceof GoalNativeError?error.code:"SQL_REFUSED";
    if(activeHttp){report.pending.http=activeHttp.metadata().pending;report.writeOutcomeUncertain ||= activeHttp.metadata().unknown;}
  }finally{
    clearTimeout(timer);abort.abort();budget.beginCleanup();
    if(caseObserved&&!report.checks.quiescent){quiet=false;report.pending.backends=1;}
    const clean=async(command,args,cap)=>{report.pending.commands++;try{return await current27StrictProcess(runBoundedProcess,command,args,{cwd:ROOT,env:toolEnv,timeoutMs:budget.cleanupTimeout(cap),maxBytes:2097152});}catch(error){if(Object.getOwnPropertyDescriptor(error??{},"groupConfirmed")?.value!==true){groups=false;quiet=false;}throw error;}finally{report.pending.commands--;}};
    if(started&&quiet&&groups&&!report.pending.http){
      try{await clean("supabase",cli(["stop","--project-id",projectId,"--no-backup"]),120000);stackGone=await inventory(clean);}catch{stackGone=false;}
    }else if(!started)stackGone=true;
    report.cleanup.groups=quiet&&groups;report.cleanup.stack=stackGone;
    if(quiet&&groups&&!report.pending.http&&stackGone){
      try{
        if(bundle)await budget.cleanupIo(()=>bundle.remove());
        if(runRoot)await budget.cleanupIo(async()=>{assertTempDescendant(runnerTemp,runRoot);need(await realpath(runRoot)===runRoot&&!(await lstat(runRoot)).isSymbolicLink(),"CLEANUP_UNCONFIRMED");await rm(runRoot,{recursive:true,force:false});try{await lstat(runRoot);}catch(error){if(error.code==="ENOENT")tempGone=true;else throw error;}});
        else tempGone=true;
      }catch{tempGone=false;}
    }
    report.cleanup.temp=tempGone;
    if(Object.values(report.pending).some(Boolean))for(const key of Object.keys(report.cleanup))report.cleanup[key]=false;
    if(report.code==="PASSED"&&Object.values(report.checks).every(Boolean)&&Object.values(report.cleanup).every(Boolean)&&!Object.values(report.pending).some(Boolean)&&!report.writeOutcomeUncertain){
      try{budget.assertCleanupAdmission();report.status="passed";report.phase="complete";}
      catch{report.status="failed";report.code="CLEANUP_UNCONFIRMED";report.phase="cleanup";}
    }
    else{report.status="failed";if(report.code==="PASSED")report.code="CLEANUP_UNCONFIRMED";if(report.phase==="complete")report.phase="cleanup";}
  }
  return validateCurrent27InsufficiencyReport(report);
}
export async function current27Main(argv=process.argv.slice(2),environment=process.env,write=line=>process.stdout.write(line)) {
  if(!argv.length||argv.length===1&&argv[0]==="--help"){write(JSON.stringify({version:1,scenario:"finance-goals-current27-insufficiency-native-ci",code:"NO_SERVICE_STARTED",hostedAccess:false})+"\n");return 0;}
  try{admitCurrent27Invocation(argv,environment,process.platform);const report=await runCurrent27InsufficiencyCi(environment);write(JSON.stringify(report)+"\n");return report.status==="passed"?0:1;}
  catch{const report=newCurrent27InsufficiencyReport();report.code="ENVIRONMENT_REFUSED";write(JSON.stringify(validateCurrent27InsufficiencyReport(report))+"\n");return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await current27Main();
