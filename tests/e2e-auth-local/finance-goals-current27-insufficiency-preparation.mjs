/** Pure preparation/budget/Source gates. Imports do not start a process or service. */
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { CURRENT27_CANONICAL_REVIEW } from "../helpers/canonical-release-source.mjs";
import { ADMIN_NATIVE_MODULES } from "./admin-native-backend-case.mjs";
import { nativeData, nativeRecord, nativeRefuse } from "./finance-goals-terminal-native-contract.mjs";
import { CURRENT27_PRODUCT_EXPORTS } from "./finance-goals-current27-insufficiency-contract.mjs";
export const CURRENT27_ENTRY="tests/e2e-auth-local/finance-goals-current27-insufficiency.entry.ts";
export const CURRENT27_RUNNER="scripts/verification/finance-goals-current27-insufficiency-ci.mjs";
export const CURRENT27_WORKFLOW=".github/workflows/finance-goals-current27-insufficiency-native-ci.yml";
export const CURRENT27_SDK_MODULES=Object.freeze(ADMIN_NATIVE_MODULES.filter(path=>path.startsWith("node_modules/")));
export const CURRENT27_PRODUCT_NAMES=Object.freeze([...CURRENT27_PRODUCT_EXPORTS,"createClient"].sort());
export const CURRENT27_STEP_CAPS=Object.freeze([120,120,240,120,240,60,1140]);
export const CURRENT27_MAIN_MS=960000,CURRENT27_CLEANUP_MS=165000,CURRENT27_NATIVE_MS=1125000;
const need=(v,code="SOURCE_REFUSED")=>{if(!v)nativeRefuse(code);};
const normal=path=>path.replaceAll("\\","/");
const validPath=path=>typeof path==="string"&&/^[A-Za-z0-9_@()./-]+$/.test(path)&&!path.includes("..")&&!path.startsWith("/")&&!path.split("/").some(part=>part===".env"||part.startsWith(".env."));
export function admitCurrent27Invocation(argv,environment,platform) {
  need(Array.isArray(argv)&&argv.length===1&&argv[0]==="--execute-current27-insufficiency-v1","ENVIRONMENT_REFUSED");
  const keys=["PATH","LANG","LC_ALL","TZ","NO_COLOR","RUNNER_TEMP","GITHUB_SHA","CI","GITHUB_ACTIONS","SC_AUTH_LOCAL_CI_RUN","SC_FINANCE_GOALS_TERMINAL_NATIVE_CI_RUN","SC_FINANCE_GOALS_CURRENT27_NATIVE_CI_RUN"];
  let fields;try{fields=Object.getOwnPropertyDescriptors(environment);}catch{nativeRefuse("ENVIRONMENT_REFUSED");}
  need(platform==="linux"&&Reflect.ownKeys(fields).length===keys.length&&keys.every(key=>fields[key]?.enumerable&&Object.hasOwn(fields[key],"value")&&typeof fields[key].value==="string"&&!/[\0\r\n]/.test(fields[key].value)),"ENVIRONMENT_REFUSED");
  const v=Object.fromEntries(keys.map(key=>[key,fields[key].value]));
  need(v.CI==="true"&&v.GITHUB_ACTIONS==="true"&&v.SC_AUTH_LOCAL_CI_RUN==="1"&&v.SC_FINANCE_GOALS_TERMINAL_NATIVE_CI_RUN==="1"&&v.SC_FINANCE_GOALS_CURRENT27_NATIVE_CI_RUN==="1"&&v.TZ==="UTC"&&v.NO_COLOR==="1"&&v.LANG==="C.UTF-8"&&v.LC_ALL==="C.UTF-8"&&/^[a-f0-9]{40}$/.test(v.GITHUB_SHA)&&v.RUNNER_TEMP.startsWith("/")&&!v.RUNNER_TEMP.includes(".."),"ENVIRONMENT_REFUSED");
  return Object.freeze(v);
}
export function current27Budget(now) {
  need(typeof now==="function","ENVIRONMENT_REFUSED");const start=now();let last=start,cleanupStart=null;
  need(Number.isFinite(start)&&start>=0,"ENVIRONMENT_REFUSED");
  const clock=()=>{const value=now();need(Number.isFinite(value)&&value>=last,"SESSION_TIMEOUT");last=value;return value;};
  const remaining=()=>Math.max(0,start+CURRENT27_MAIN_MS-clock());
  const cleanupRemaining=()=>{need(cleanupStart!==null,"CLEANUP_UNCONFIRMED");const value=clock();return Math.min(start+CURRENT27_NATIVE_MS,cleanupStart+CURRENT27_CLEANUP_MS)-value;};
  const admitCleanup=()=>{need(cleanupRemaining()>0,"CLEANUP_UNCONFIRMED");return true;};
  return Object.freeze({
    mainRemaining:remaining,
    mainTimeout(cap){need(Number.isSafeInteger(cap)&&cap>=1&&cap<=600000,"ENVIRONMENT_REFUSED");const left=remaining();need(left>0,"SESSION_TIMEOUT");return Math.max(1,Math.floor(Math.min(cap,left)));},
    beginCleanup(){need(cleanupStart===null,"CLEANUP_UNCONFIRMED");cleanupStart=clock();},
    cleanupTimeout(cap){need(Number.isSafeInteger(cap)&&cap>=1&&cap<=120000,"CLEANUP_UNCONFIRMED");const left=cleanupRemaining();need(left>0,"CLEANUP_UNCONFIRMED");return Math.max(1,Math.floor(Math.min(cap,left)));},
    assertCleanupAdmission:admitCleanup,
    async cleanupIo(operation){need(typeof operation==="function","CLEANUP_UNCONFIRMED");admitCleanup();const value=await operation();admitCleanup();return value;},
  });
}
/** Base is the unchanged runBoundedProcess. Test seam never supplies native authority. */
export async function current27StrictProcess(base,command,args,options) {
  need(typeof base==="function"&&["git","docker","supabase","psql"].includes(command),"ENVIRONMENT_REFUSED");
  const facts={stdout:0,stderr:0,finish:0,exit:0,close:0},pieces=[];let size=0,bad=false,exitCode,exitSignal,closeCode,closeSignal;
  try {
    const value=await base(command,args,{...options,capture:false,stdoutObserver:{
      start(child){
        child.stdout.on("end",()=>{if(++facts.stdout!==1||facts.close)bad=true;});
        child.stderr.on("end",()=>{if(++facts.stderr!==1||facts.close)bad=true;});
        child.stdin.on("finish",()=>{if(++facts.finish!==1||facts.exit||facts.close)bad=true;});
        child.on("exit",(code,signal)=>{if(++facts.exit!==1||facts.close)bad=true;exitCode=code;exitSignal=signal;});
        child.on("close",(code,signal)=>{if(++facts.close!==1||facts.exit!==1||facts.stdout!==1||facts.stderr!==1||facts.finish!==1)bad=true;closeCode=code;closeSignal=signal;});return true;
      },
      data(chunk){if(facts.stdout||facts.close){bad=true;return false;}size+=chunk.byteLength;if(size>options.maxBytes){bad=true;return false;}pieces.push(Buffer.from(chunk));return true;},
      end(){return true;},
    }});
    need(!bad&&Object.values(facts).every(n=>n===1)&&exitCode===0&&closeCode===0&&exitSignal===null&&closeSignal===null&&value.groupConfirmed===true,"PROCESS_REFUSED");
    return Object.freeze({stdout:new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(pieces)),groupConfirmed:true});
  }finally{for(const piece of pieces)piece.fill(0);}
}
export function current27EnableMigrations(config) {
  need(typeof config==="string","ENVIRONMENT_REFUSED");const anchor="[db.migrations]\nenabled = false",text=config.replaceAll("\r\n","\n");
  need(text.split(anchor).length===2,"ENVIRONMENT_REFUSED");return text.replace(anchor,"[db.migrations]\nenabled = true");
}
export async function current27Canonical(root,path,dependency=false) {
  need(validPath(path)&&(dependency||!path.startsWith("node_modules/")));const absolute=resolve(root,path);
  need(absolute.startsWith(resolve(root)+sep));const stat=await lstat(absolute);
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=4194304&&await realpath(absolute)===absolute);
  return readFile(absolute);
}
export const CURRENT27_RESOURCE_SEEDS=Object.freeze([
  CURRENT27_ENTRY,CURRENT27_RUNNER,CURRENT27_WORKFLOW,
  "tests/e2e-auth-local/finance-goals-current27-insufficiency-contract.mjs","tests/e2e-auth-local/finance-goals-current27-insufficiency-case.mjs","tests/e2e-auth-local/finance-goals-current27-insufficiency-preparation.mjs",
  "tests/scripts/finance-goals-current27-insufficiency.test.mjs","tests/scripts/finance-goals-current27-insufficiency-ci.test.mjs",
  "docs/implementation/finance-goals-current27-insufficiency-native-20261025.md",
  ".nvmrc","package.json","package-lock.json","tsconfig.json","supabase/sql-editor/manifest.json","supabase/tests/release-catalog.sql","tests/fixtures/supabase-auth-local/config.toml","tests/helpers/canonical-release-source.d.mts",
  ...CURRENT27_CANONICAL_REVIEW.flatMap((row,index)=>["supabase/migrations/"+row.file,"supabase/sql-editor/installation/"+String(index+1).padStart(3,"0")+"_"+row.file]),
]);
/** Expected path set is frozen from public Source, then independently checked by TS AST below. */
export const CURRENT27_EXPECTED_SOURCES=Object.freeze([
  ".github/workflows/finance-goals-current27-insufficiency-native-ci.yml",
  ".nvmrc",
  "docs/implementation/finance-goals-current27-insufficiency-native-20261025.md",
  "package-lock.json",
  "package.json",
  "scripts/verification/admin-native-backend-local-ci.mjs",
  "scripts/verification/auth-local-ci.mjs",
  "scripts/verification/finance-goals-current27-insufficiency-ci.mjs",
  "src/adapters/db/capture-task-store.ts",
  "src/adapters/db/finance-commands.ts",
  "src/adapters/db/finance-gateway.ts",
  "src/adapters/db/finance-goals-gateway.ts",
  "src/adapters/db/finance-goals-protocol.ts",
  "src/adapters/db/finance-goals-read-model.ts",
  "src/adapters/db/finance-goals-store.ts",
  "src/adapters/db/finance-store.ts",
  "src/core/access/resolve-access.ts",
  "src/core/capturas/attachments.ts",
  "src/core/capturas/rich-content-write.ts",
  "src/core/capturas/rich-content.ts",
  "src/core/capturas/types.ts",
  "src/core/contracts/base.ts",
  "src/core/contracts/index.ts",
  "src/core/contracts/modules.ts",
  "src/core/contracts/operations.ts",
  "src/core/contracts/rich-document.ts",
  "src/core/contracts/unit-of-work.ts",
  "src/core/financeiro/arithmetic.ts",
  "src/core/financeiro/credit.ts",
  "src/core/financeiro/finance.ts",
  "src/core/financeiro/fused.ts",
  "src/core/financeiro/goals/goal-ports.ts",
  "src/core/financeiro/goals/goal-projections.ts",
  "src/core/financeiro/goals/goal-types.ts",
  "src/core/financeiro/goals/goal-use-cases.ts",
  "src/core/financeiro/goals/goal-validation.ts",
  "src/core/financeiro/index.ts",
  "src/core/financeiro/monthly-timeline.ts",
  "src/core/financeiro/ports.ts",
  "src/core/financeiro/types.ts",
  "src/core/financeiro/use-cases.ts",
  "src/core/habitos/cadence.ts",
  "src/core/habitos/calendar.ts",
  "src/core/habitos/frequency-history.ts",
  "src/core/habitos/frequency-state.ts",
  "src/core/habitos/habits.ts",
  "src/core/habitos/model.ts",
  "src/core/habitos/pauses.ts",
  "src/core/habitos/performance.ts",
  "src/core/habitos/sequences.ts",
  "src/core/projetos/types.ts",
  "src/core/tarefas/types.ts",
  "src/core/tempo/civil.ts",
  "src/core/tempo/day-range.ts",
  "src/core/tempo/index.ts",
  "src/core/tempo/tempo.ts",
  "src/lib/auth/types.ts",
  "supabase/migrations/20261007151834_identity_foundation.sql",
  "supabase/migrations/20261007151850_auth_password_completion.sql",
  "supabase/migrations/20261007151904_restrict_rls_event_trigger_execution.sql",
  "supabase/migrations/20261007210519_capture_task_transactions.sql",
  "supabase/migrations/20261007223710_activity_page.sql",
  "supabase/migrations/20261009144343_financial_transactions.sql",
  "supabase/migrations/20261009144350_knowledge_pages_links.sql",
  "supabase/migrations/20261009150122_identity_admin_settings.sql",
  "supabase/migrations/20261009151557_account_preferences.sql",
  "supabase/migrations/20261009152200_projects_habits.sql",
  "supabase/migrations/20261009152822_private_storage_drive.sql",
  "supabase/migrations/20261009154609_global_search_activity.sql",
  "supabase/migrations/20261009160151_encrypted_vault.sql",
  "supabase/migrations/20261009160158_google_calendar.sql",
  "supabase/migrations/20261009231338_file_cleanup_fairness.sql",
  "supabase/migrations/20261010010955_close_public_sequence_defaults.sql",
  "supabase/migrations/20261010044217_finance_monthly_plan.sql",
  "supabase/migrations/20261011071500_admin_auth_creation_order.sql",
  "supabase/migrations/20261011113751_own_sessions.sql",
  "supabase/migrations/20261021045700_spec08_private_entity_images.sql",
  "supabase/migrations/20261021144650_spec08_habit_frequency_history.sql",
  "supabase/migrations/20261021171416_spec08_capture_document_write.sql",
  "supabase/migrations/20261022042432_spec08_calendar_participants.sql",
  "supabase/migrations/20261022042500_spec08_finance_card_metadata.sql",
  "supabase/migrations/20261022042501_spec08_capture_knowledge_promotion.sql",
  "supabase/migrations/20261023061901_onboarding_foundation.sql",
  "supabase/migrations/20261024130000_finance_mvp_vertical.sql",
  "supabase/sql-editor/installation/001_20261007151834_identity_foundation.sql",
  "supabase/sql-editor/installation/002_20261007151850_auth_password_completion.sql",
  "supabase/sql-editor/installation/003_20261007151904_restrict_rls_event_trigger_execution.sql",
  "supabase/sql-editor/installation/004_20261007210519_capture_task_transactions.sql",
  "supabase/sql-editor/installation/005_20261007223710_activity_page.sql",
  "supabase/sql-editor/installation/006_20261009144343_financial_transactions.sql",
  "supabase/sql-editor/installation/007_20261009144350_knowledge_pages_links.sql",
  "supabase/sql-editor/installation/008_20261009150122_identity_admin_settings.sql",
  "supabase/sql-editor/installation/009_20261009151557_account_preferences.sql",
  "supabase/sql-editor/installation/010_20261009152200_projects_habits.sql",
  "supabase/sql-editor/installation/011_20261009152822_private_storage_drive.sql",
  "supabase/sql-editor/installation/012_20261009154609_global_search_activity.sql",
  "supabase/sql-editor/installation/013_20261009160151_encrypted_vault.sql",
  "supabase/sql-editor/installation/014_20261009160158_google_calendar.sql",
  "supabase/sql-editor/installation/015_20261009231338_file_cleanup_fairness.sql",
  "supabase/sql-editor/installation/016_20261010010955_close_public_sequence_defaults.sql",
  "supabase/sql-editor/installation/017_20261010044217_finance_monthly_plan.sql",
  "supabase/sql-editor/installation/018_20261011071500_admin_auth_creation_order.sql",
  "supabase/sql-editor/installation/019_20261011113751_own_sessions.sql",
  "supabase/sql-editor/installation/020_20261021045700_spec08_private_entity_images.sql",
  "supabase/sql-editor/installation/021_20261021144650_spec08_habit_frequency_history.sql",
  "supabase/sql-editor/installation/022_20261021171416_spec08_capture_document_write.sql",
  "supabase/sql-editor/installation/023_20261022042432_spec08_calendar_participants.sql",
  "supabase/sql-editor/installation/024_20261022042500_spec08_finance_card_metadata.sql",
  "supabase/sql-editor/installation/025_20261022042501_spec08_capture_knowledge_promotion.sql",
  "supabase/sql-editor/installation/026_20261023061901_onboarding_foundation.sql",
  "supabase/sql-editor/installation/027_20261024130000_finance_mvp_vertical.sql",
  "supabase/sql-editor/manifest.json",
  "supabase/tests/release-catalog.sql",
  "tests/e2e-auth-local/admin-native-backend-case.mjs",
  "tests/e2e-auth-local/admin-native-backend-contract.mjs",
  "tests/e2e-auth-local/admin-native-backend-local-case.mjs",
  "tests/e2e-auth-local/admin-native-backend-local-ci-contract.mjs",
  "tests/e2e-auth-local/auth-local-lifecycle-contract.mjs",
  "tests/e2e-auth-local/browser-process-environment.mjs",
  "tests/e2e-auth-local/capture-task-persistence-contract.mjs",
  "tests/e2e-auth-local/finance-distinct-intents-native-contract.mjs",
  "tests/e2e-auth-local/finance-goals-current27-insufficiency-case.mjs",
  "tests/e2e-auth-local/finance-goals-current27-insufficiency-contract.mjs",
  "tests/e2e-auth-local/finance-goals-current27-insufficiency-preparation.mjs",
  "tests/e2e-auth-local/finance-goals-current27-insufficiency.entry.ts",
  "tests/e2e-auth-local/finance-goals-terminal-native-contract.mjs",
  "tests/e2e-auth-local/finance-goals-terminal-native-session.mjs",
  "tests/e2e-auth-local/finance-goals-terminal-native-sql.mjs",
  "tests/e2e-auth-local/identity-data-api-contract.mjs",
  "tests/e2e-auth-local/qualified-chromium.mjs",
  "tests/fixtures/supabase-auth-local/config.toml",
  "tests/helpers/canonical-release-source.d.mts",
  "tests/helpers/canonical-release-source.mjs",
  "tests/scripts/finance-goals-current27-insufficiency-ci.test.mjs",
  "tests/scripts/finance-goals-current27-insufficiency.test.mjs",
  "tsconfig.json",
]);
function current27References(ts,path,text) {
    const parsed=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,path.endsWith("tsx")?ts.ScriptKind.TSX:path.endsWith("mjs")?ts.ScriptKind.JS:ts.ScriptKind.TS),refs=[];
    need(!parsed.parseDiagnostics.length,"GRAPH_REFUSED");
    const walk=node=>{
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier){need(ts.isStringLiteral(node.moduleSpecifier),"GRAPH_REFUSED");refs.push(node.moduleSpecifier.text);}
      if(ts.isImportTypeNode(node)){need(ts.isLiteralTypeNode(node.argument)&&ts.isStringLiteral(node.argument.literal),"GRAPH_REFUSED");refs.push(node.argument.literal.text);}
      if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){
        need(node.arguments.length===1,"GRAPH_REFUSED");const argument=node.arguments[0];
        if(ts.isStringLiteral(argument))refs.push(argument.text);
        else{const expression=argument.getText(parsed);need(path===CURRENT27_RUNNER&&expression==="pathToFileURL(output).href"||path==="tests/e2e-auth-local/admin-native-backend-case.mjs"&&expression==='"data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64")',"GRAPH_REFUSED");}
      }
      ts.forEachChild(node,walk);
    };walk(parsed);
  return refs;
}
export async function current27SourceClosure(root,seeds=CURRENT27_RESOURCE_SEEDS) {
  const imported=await import("typescript"),ts=imported.default??imported,seen=new Set();
  async function visit(path) {
    if(seen.has(path))return;need(validPath(path)&&!path.startsWith("node_modules/")&&seen.size<512);
    const bytes=await current27Canonical(root,path);seen.add(path);
    if(!/\.(?:[cm]?ts|tsx|mjs)$/.test(path)||path.endsWith(".d.mts"))return;
    const refs=current27References(ts,path,bytes.toString("utf8"));
    for(const ref of refs){
      if(!ref.startsWith(".")&&!ref.startsWith("@/"))continue;
      const base=ref.startsWith("@/")?resolve(root,"src",ref.slice(2)):resolve(root,dirname(path),ref),inside=normal(relative(root,base));need(validPath(inside));
      let found;for(const suffix of["",".ts",".tsx",".mjs",".json","/index.ts","/index.tsx"]){try{const stat=await lstat(resolve(root,inside+suffix));if(stat.isFile()){found=inside+suffix;break;}}catch(e){if(!["ENOENT","ENOTDIR"].includes(e.code))throw e;}}
      if(!found&&inside.endsWith(".js")){const alternative=inside.slice(0,-3)+".ts";try{await current27Canonical(root,alternative);found=alternative;}catch{/* Missing source is rejected. */}}
      need(found,"GRAPH_REFUSED");await visit(found);
    }
  }
  for(const seed of seeds)await visit(seed);return Object.freeze([...seen].sort());
}
export function assertCurrent27SourceSet(paths) {
  need(Array.isArray(paths)&&isDeepStrictEqual(paths,CURRENT27_EXPECTED_SOURCES),"SOURCE_REFUSED");return true;
}
export function assertCurrent27BundleModule(path,dynamicIds,entryClosure,manifest) {
  need(validPath(path)&&Array.isArray(dynamicIds)&&dynamicIds.length===0&&(CURRENT27_SDK_MODULES.includes(path)||entryClosure.includes(path))&&!path.includes("pglite")&&!path.endsWith("-candidate-sql.ts"),"GRAPH_REFUSED");
  need([...manifest.sources,...manifest.dependencies].some(row=>row.path===path),"GRAPH_REFUSED");return true;
}
export function assertCurrent27BundleComplete(paths,entryClosure) {
  need(Array.isArray(paths)&&new Set(paths).size===paths.length,"GRAPH_REFUSED");
  for(const path of CURRENT27_SDK_MODULES)need(paths.includes(path),"GRAPH_REFUSED");
  for(const path of[CURRENT27_ENTRY,"src/core/contracts/base.ts","src/core/financeiro/goals/goal-use-cases.ts","src/core/financeiro/goals/goal-validation.ts","src/adapters/db/finance-goals-gateway.ts","src/adapters/db/finance-goals-store.ts"])need(paths.includes(path)&&entryClosure.includes(path),"GRAPH_REFUSED");
  need(paths.every(path=>CURRENT27_SDK_MODULES.includes(path)||entryClosure.includes(path)),"GRAPH_REFUSED");return true;
}
export function current27LedgerSql(context) {
  need(/^[0-9]{16,20}$/.test(context.systemIdentifier),"SQL_REFUSED");
  return "begin read only;select jsonb_build_object('database',current_database(),'owner',current_user,'systemIdentifier',(select system_identifier::text from pg_control_system()),'noAuthFixtures',not exists(select 1 from auth.users),'ledger',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'statementCount',cardinality(statements),'statementHash',encode(sha256(convert_to(array_to_json(statements)::text,'UTF8')),'hex')) order by version),'[]') from supabase_migrations.schema_migrations));rollback;";
}
export function assertCurrent27Ledger(value,context) {
  const v=nativeRecord(nativeData(value),["database","owner","systemIdentifier","noAuthFixtures","ledger"],"CATALOGUE_REFUSED");
  need(v.database==="postgres"&&v.owner==="postgres"&&v.systemIdentifier===context.systemIdentifier&&v.noAuthFixtures===true&&Array.isArray(v.ledger)&&v.ledger.length===27,"CATALOGUE_REFUSED");
  for(let i=0;i<27;i++){const row=nativeRecord(v.ledger[i],["version","name","statementCount","statementHash"],"CATALOGUE_REFUSED"),expected=CURRENT27_CANONICAL_REVIEW[i];need(row.version===expected.file.slice(0,14)&&row.name===expected.file.slice(15,-4)&&Number.isSafeInteger(row.statementCount)&&row.statementCount>=1&&/^[a-f0-9]{64}$/.test(row.statementHash),"CATALOGUE_REFUSED");}
  return Object.freeze(v);
}
export function assertCurrent27SecondApply(before,after){need(isDeepStrictEqual(before,after),"CATALOGUE_REFUSED");return 0;}
export function current27OneJson(text) {
  need(typeof text==="string"&&Buffer.byteLength(text)<=2097152,"SQL_REFUSED");const lines=text.trim().split(/\r?\n/).filter(Boolean);need(lines.length===1,"SQL_REFUSED");
  try{return nativeData(JSON.parse(lines[0]));}catch{nativeRefuse("SQL_REFUSED");}
}
export function current27BlobId(bytes){return createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");}
