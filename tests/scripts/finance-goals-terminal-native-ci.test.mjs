/** Written extraction/source controls. No bundle, database or native service. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { newGoalNativeReport, validateGoalNativeNodeVersion, nativeRecord, nativeData, nativeRefuse, GOAL_NATIVE_CASES, GOAL_NATIVE_CODES } from "../e2e-auth-local/finance-goals-terminal-native-contract.mjs";
const require = createRequire(import.meta.url), ts = require("typescript");
const source = relative => readFile(new URL("../../" + relative, import.meta.url), "utf8");
const hash = text => createHash("sha256").update(text, "utf8").digest("hex");

// Six exact reviewed observation insertions; removing them must reproduce the
// original byte-sealed N12 case. No arbitrary segment can be ignored.
const ORACLE_OBSERVATION_BLOCK_HASHES=Object.freeze({"helper":"2e39b94ce60307a9b0ed0942caccedd6a7be0824685f841cc548655ec6d21b96","state":"444e9abcfed6a1be7936eb8cd08bf97baca1d6ddd9a94a61baddb778f4c79f72","finish":"d8bcec5edc619eafccd2f0b747e4fe744f621ba6cd4d3db217e5e488b6ce0997","terminals":"6251b8b9c813b432a02b70affdcfec97fc1b20342ad21581f73e9a5a952b30c9","backends":"29314a42cffcb5c6b1b9b15841e33f149657d789d246e6bf27b05b91c708aef9","catch":"191dd1d8b8aff572390e0e6fe70769826daa8e4d65b5553e898d8fb84fbb0644"});
function restoreSealedN12Case(text){
 let value=text;
 for(const [name,pin]of Object.entries(ORACLE_OBSERVATION_BLOCK_HASHES)){
  const start="/* DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:"+name+" */",end="/* DOC18_GOAL_ORACLE_OBSERVATION_V1_END:"+name+" */",a=value.indexOf(start);
  assert.ok(a>=0);assert.equal(value.indexOf(start,a+1),-1);const b=value.indexOf(end,a+start.length);assert.ok(b>a);assert.equal(value.indexOf(end,b+end.length),-1);
  const length=b+end.length+(name==="catch"?0:1),block=value.slice(a,length);assert.equal(hash(block),pin);value=value.slice(0,a)+value.slice(length);
 }
 assert.doesNotMatch(value,/DOC18_GOAL_ORACLE_OBSERVATION_V1/);return value;
}
async function originalOracleDiagnostic(){
 const text=await source("tests/e2e-auth-local/finance-goals-terminal-native-case.mjs"),file=ast("oracle-diagnostic",text),node=file.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="goalNativeOracleDiagnostic");
 assert.ok(node);const literal=node.getText(file).replace(/^export /,"");for(const forbidden of["console.","process.","fetch(","spawn","readFile","writeFile","backendPid"])assert.equal(literal.includes(forbidden),false);
 return Function("nativeRecord","nativeData","nativeRefuse","GOAL_NATIVE_CASES","GOAL_NATIVE_CODES",literal+";return goalNativeOracleDiagnostic;")(nativeRecord,nativeData,nativeRefuse,GOAL_NATIVE_CASES,GOAL_NATIVE_CODES);
}

const EXTRACTIONS = Object.freeze([
  { stem: "finance-budget", marker: "export async function createFinanceBudgetCandidateSql()", factory: "f149556526e9e6e87d75d17dd6efe9aaaaed4f6119ee79c7654be8f0ddee95b9", api: ["FINANCE_BUDGET_REVIEW", "compileReviewedFinanceBudgetSql", "readReviewedFinanceBudgetSources"], type: "FinanceBudgetCandidateSql" },
  { stem: "finance-series", marker: "export async function createFinanceSeriesCandidateSql()", factory: "f6c8eefae077d3fde6db77bb4ff866c9f99b94d4e7e69e67710d5a51e9479cd5", api: ["FINANCE_SERIES_REVIEW", "compileFinanceSeriesCandidate", "readFinanceSeriesCandidateSources"] },
  { stem: "finance-goals", marker: "export async function createFinanceGoalsCandidateSql()", factory: "a3dd7a3a19386a5a32c3193770ee93839f7073b9dd5bdc46ce645b68871f212d", api: ["FINANCE_GOALS_REVIEW", "compileFinanceGoalsCandidate", "readFinanceGoalsCandidateSources"] },
  { stem: "finance-026", marker: "export async function createFinance026CandidateSql(candidate: Candidate)", factory: "760499ab6bb9427e852996b40ed44b15ef20934afff239a64b786588de5d5b04", api: ["FINANCE_026_CANONICAL_REVIEW", "assertFinance026Sources", "readFinance026Sources"] },
  { stem: "finance-goals-terminal", marker: "export async function createFinanceGoalsTerminalCandidateSql()", factory: "8dc0aa501dfb10ebf8f53d4d7eb8caca7d5210cbc24ef4ace94d484ae4b40cb5", api: ["FINANCE_GOALS_TERMINAL_REVIEW", "compileFinanceGoalsTerminalCandidate", "readFinanceGoalsTerminalCandidateSource"] },
]);
function ast(name, text) {
  const file = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  assert.equal(file.parseDiagnostics.length, 0, name); return file;
}
function pureSourceGraph(name, text, allowHistoricalReader = false) {
  const file = ast(name, text), imports = file.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text);
  assert.ok(imports.length > 0);
  assert.deepEqual(imports.filter(value => !value.startsWith("node:")), allowHistoricalReader ? ["./canonical-release-source.mjs"] : []);
  function walk(node) {
    assert.equal(ts.isImportEqualsDeclaration(node), false);
    assert.equal(ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined, false);
    if (ts.isCallExpression(node)) assert.equal(node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require", false);
    ts.forEachChild(node, walk);
  }
  walk(file);
}
test("pure source entrypoints retain every old reexport and only026 admits the closed historical reader", async () => {
  for (const item of EXTRACTIONS) {
    const path = "tests/helpers/" + item.stem, pure = await source(path + "-candidate-source.ts"), old = await source(path + "-candidate-sql.ts");
    pureSourceGraph(path + "-source", pure, item.stem === "finance-026");
    const oldAst = ast(path + "-sql", old);
    assert.doesNotMatch(pure, /from\s+["'][^"']*(?:pglite|candidate-sql|local-canonical-sql)["']/i);
    const exports = oldAst.statements.filter(ts.isExportDeclaration).filter(node => node.moduleSpecifier?.text === "./" + item.stem + "-candidate-source");
    const values = exports.filter(node => !node.isTypeOnly).flatMap(node => [...node.exportClause.elements].map(element => element.name.text));
    assert.deepEqual(values, item.api);
    if (item.type) assert.deepEqual(exports.filter(node => node.isTypeOnly).flatMap(node => [...node.exportClause.elements].map(element => element.name.text)), [item.type]);
    // Literal factory suffix is the reviewed pre-extraction implementation,
    // including every order, guard, diagnostic and db.close catch branch.
    const begin = old.indexOf(item.marker); assert.ok(begin >= 0); assert.equal(old.indexOf(item.marker, begin + 1), -1); assert.equal(hash(old.slice(begin)), item.factory);
  }
});
test("the026 exception is literal and never admits SDK, WASM, another relative module or dynamic loading", async () => {
  const builtin = 'import { readFile } from "node:fs/promises";', historical = 'import { readHistorical026CanonicalMigrations } from "./canonical-release-source.mjs";';
  pureSourceGraph("builtin", builtin);
  pureSourceGraph("historical026", builtin + historical, true);
  assert.throws(() => pureSourceGraph("historical-in-other-stem", builtin + historical));
  for (const extra of [
    'import { other } from "./unreviewed.mjs";',
    'import { PGlite } from "@electric-sql/pglite";',
    'import { createClient } from "@supabase/supabase-js";',
    'import { open } from "./local-canonical-sql";',
    'import("node:fs");',
    'require("node:fs");',
    'import fs = require("node:fs");',
    'export { open } from "./unreviewed.mjs";',
  ]) assert.throws(() => pureSourceGraph("refused", builtin + historical + extra, true));
  pureSourceGraph("historical-reader", await source("tests/helpers/canonical-release-source.mjs"));
});
test("native entry imports the Sources API and excludes every WASM constructor", async () => {
  const text = await source("tests/e2e-auth-local/finance-goals-terminal-native.entry.ts"), file = ast("native-entry", text);
  const exports = file.statements.filter(ts.isExportDeclaration), modules = exports.map(node => node.moduleSpecifier.text);
  assert.ok(modules.includes("../helpers/finance-026-candidate-source"));
  assert.doesNotMatch(text, /create(?:LocalCanonicalSql|Finance\w*CandidateSql)|pglite|candidate-sql["']/i);
  for (const item of EXTRACTIONS) assert.ok(modules.includes("../helpers/" + item.stem + "-candidate-source"));
});
test("legacy constructors retain their factory dependency rather than silently aliasing a native session", async () => {
  const budget = await source("tests/helpers/finance-budget-candidate-sql.ts"), canonical = await source("tests/helpers/finance-026-candidate-sql.ts");
  assert.match(budget, /import \{ createLocalCanonicalSql \} from "\.\/local-canonical-sql"/);
  assert.match(canonical, /import \{ createHistorical026CanonicalSql \} from "\.\/local-canonical-sql"/);
  assert.match(canonical, /await readFinance026Sources\(\)/);
  assert.match(canonical, /await db\.exec\(budgetSql\.patch\)/);
  assert.match(canonical, /await db\.exec\(seriesSql\)/);
  assert.match(canonical, /await db\.exec\(goalsSql\)/);
});
test("dedicated native runner imports/help do not invoke the service entrypoint", async () => {
  const runner=await import("../../scripts/verification/finance-goals-terminal-native-ci.mjs"),reports=[];
  assert.equal(await runner.main([],{},value=>reports.push(value)),0);assert.equal(reports[0].code,"NO_SERVICE_STARTED");
  assert.equal(await runner.main(["--execute","--target=remote"],{},value=>reports.push(value)),1);
  assert.equal(reports.length,2);assert.equal(reports[1].code,"ENVIRONMENT_REFUSED");
  assert.equal(reports.every(report=>report.version===2),true);
});
test("Node selection is major24 while its evidence retains the full stable runtime without coercion", () => {
  for (const selection of ["24", "24\n", "24\r\n", " \t24\r\n"]) {
    for (const runtime of ["24.0.0", "24.19.0", "24.99.1"]) assert.equal(validateGoalNativeNodeVersion(selection,runtime),runtime);
  }
  for (const selection of ["", "22", "25", "24.19.0", "v24", "lts/*", "node", "24\n25", "24 # comment", "24\0", 24, null]) assert.throws(()=>validateGoalNativeNodeVersion(selection,"24.19.0"),{code:"ENVIRONMENT_REFUSED"});
  for (const runtime of ["24", "v24.19.0", "024.19.0", "24.019.0", "24.19.00", "24.-1.0", "24.19.0-rc.1", "24.19.0+meta", "24.19.0.1", "24.19.0\n", "25.0.0", "22.24.0", "24."+"1".repeat(33)+".0", 24, null]) assert.throws(()=>validateGoalNativeNodeVersion("24",runtime),{code:"ENVIRONMENT_REFUSED"});
  let coercions=0;const fake={toString(){coercions++;return "24";},[Symbol.toPrimitive](){coercions++;return "24.19.0";}};
  assert.throws(()=>validateGoalNativeNodeVersion(fake,"24.19.0"));assert.throws(()=>validateGoalNativeNodeVersion("24",fake));assert.equal(coercions,0);
});
test("entry graph admits the extracted pure terminal contract and keeps runtime, dynamic, WASM and unknown modules closed", async () => {
  const {assertGoalNativeEntryModule,GOAL_NATIVE_ENTRY_SOURCES}=await import("../../scripts/verification/finance-goals-terminal-native-ci.mjs");
  const pure="src/lib/finance-goals-terminal-contract.ts";assert.equal(GOAL_NATIVE_ENTRY_SOURCES.filter(path=>path===pure).length,1);
  for(const path of [pure,"src/adapters/db/finance-goals-terminal-canonical.ts","src/core/financeiro/goals/goal-use-cases.ts","tests/helpers/finance-goals-terminal-candidate-source.ts","node_modules/server-only/empty.js"]) assert.doesNotThrow(()=>assertGoalNativeEntryModule(path,[]));
  for(const path of ["src/lib/finance-goals-client.ts","src/lib/finance-goals-json.ts","src/lib/finance-goals-terminal-browser.ts","src/adapters/db/finance-goals-terminal-runtime.ts","src/app/api/finance/goals/attempt/status/route.ts","src/components/features/financeiro/goals/goals-panel.tsx","tests/helpers/finance-goals-terminal-candidate-sql.ts","node_modules/@electric-sql/pglite/dist/index.js","node_modules/unknown-sdk/index.js","../"+pure,"file:///"+pure,"node:fs",null,42]) assert.throws(()=>assertGoalNativeEntryModule(path,[]),{code:"GRAPH_REFUSED"});
  for(const imports of [[pure],["node:fs"],null,{},"no-imports"]) assert.throws(()=>assertGoalNativeEntryModule(pure,imports),{code:"GRAPH_REFUSED"});
  let coercions=0;assert.throws(()=>assertGoalNativeEntryModule({toString(){coercions++;return pure;}},[]));assert.equal(coercions,0);
  // This pure predicate is not provenance. The live plugin must still enforce
  // original realpath and the exact bytes captured from the Git/source graph.
  const runner=await source("scripts/verification/finance-goals-terminal-native-ci.mjs");
  assert.match(runner,/assertGoalNativeEntryModule\(path,info\.dynamicallyImportedIds\);requireThat\(await realpath\(info\.id\)===info\.id,"GRAPH_REFUSED"\)/);
  assert.match(runner,/requireThat\(prior&&hash\(await canonical\(path\)\)===prior\.sha256,"GRAPH_REFUSED"\)/);
});
test("additive oldSource is the exact private executor copied by M1, never the public wrapper body", async () => {
  const original=(await source("proposals/finance-goals/04-commit.sql")).replaceAll("\r\n","\n");
  const signature="(p_user uuid,p_session uuid,p_operation text,p_request jsonb)";
  function bodyOf(name,language) {
    const header="create function "+name+signature+" returns jsonb language "+language+" security definer set search_path='' as $$";
    const first=original.indexOf(header);assert.ok(first>=0);assert.equal(original.indexOf(header,first+1),-1);
    const begin=first+header.length,end=original.indexOf("$$;",begin);assert.ok(end>begin);return original.slice(begin,end);
  }
  const privateBody=bodyOf("app_private.fg_commit","plpgsql"),wrapperBody=bodyOf("public.finance_goals_commit","sql");
  assert.equal(Buffer.byteLength(privateBody,"utf8"),8914);assert.equal(hash(privateBody),"86377bc8865a571c950eea05596531890225f19131c44f5a839c282e679c5ebf");
  assert.equal(Buffer.byteLength(wrapperBody,"utf8"),71);assert.equal(hash(wrapperBody),"498c676f3a28e20e597d4a8c0b62b37811b41a82844f59b32b389d6a31292c6e");assert.notEqual(hash(privateBody),hash(wrapperBody));
  const runner=await source("scripts/verification/finance-goals-terminal-native-ci.mjs"),expected=[...runner.matchAll(/additive\.oldSource==="([a-f0-9]{64})"/g)];
  assert.equal(expected.length,1);assert.equal(expected[0][1],hash(privateBody));assert.notEqual(expected[0][1],hash(wrapperBody));
  assert.ok(runner.includes("oid='app_private.fg_terminal_previous_commit(uuid,uuid,text,jsonb)'::regprocedure"));
  const terminal=(await source("proposals/finance-goals-terminal/01-dispositions-and-fence.sql")).replaceAll("\r\n","\n");
  assert.ok(terminal.includes("('app_private.fg_commit(uuid,uuid,text,jsonb)','"+hash(privateBody)+"')"));
  assert.ok(terminal.includes("('public.finance_goals_commit(uuid,uuid,text,jsonb)','"+hash(wrapperBody)+"')"));
  assert.ok(terminal.includes("select prosrc into strict old_body from pg_proc where oid='app_private.fg_commit(uuid,uuid,text,jsonb)'::regprocedure;"));
  assert.equal(terminal.split("execute format('create function app_private.fg_terminal_previous_commit(").length,2);
  assert.ok(terminal.includes("execute format('create function app_private.fg_terminal_previous_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='''' as %L',old_body);"));
});
function diagnostic() {
  return {version:1,scenario:"finance-goals-terminal-native-process-failure",operation:"git-head",stdoutEndCount:1,stderrEndCount:1,stdinFinishCount:0,exitCount:1,closeCount:1,badTerminal:false,exitCode:0,closeCode:0,exitSignalPresent:false,closeSignalPresent:false,needInput:false,groupConfirmed:true};
}
test("failure operation classification returns only finite enums and never reads argument hooks", async () => {
  const {goalNativeProcessOperation}=await import("../../scripts/verification/finance-goals-terminal-native-ci.mjs");
  const canary="SYNTHETIC_PRIVATE_CANARY";
  for(const [command,args,expected] of [["git",["rev-parse","HEAD"],"git-head"],["git",["rev-parse","HEAD^{tree}"],"git-tree"],["git",["status","--porcelain","--untracked-files=all"],"git-status"],["git",["rev-parse","a".repeat(40)+":src/"+canary+".ts"],"git-blob"],["supabase",[canary],"supabase"],["docker",[canary],"docker"],["psql",[canary],"psql"],["git",["show",canary],"unknown"],[canary,[],"unknown"]]){
    const result=goalNativeProcessOperation(command,args);assert.equal(result,expected);assert.ok(!result.includes(canary));
  }
  let reads=0;const getter=[];Object.defineProperty(getter,"0",{get(){reads++;throw Error(canary);},enumerable:true});
  assert.equal(goalNativeProcessOperation("git",getter),"unknown");
  assert.equal(goalNativeProcessOperation("git",new Proxy([],{get(){reads++;throw Error(canary);},ownKeys(){reads++;throw Error(canary);}})),"unknown");
  assert.equal(goalNativeProcessOperation({toString(){reads++;return "git";}},[]),"unknown");assert.equal(reads,0);
});
test("process diagnostic projection rejects raw fields, getters, proxies and out-of-bounds observations", async () => {
  const {projectGoalNativeProcessDiagnostic}=await import("../../scripts/verification/finance-goals-terminal-native-ci.mjs");
  assert.deepEqual(projectGoalNativeProcessDiagnostic(diagnostic()),diagnostic());
  for(const patch of [{version:2},{operation:"git HEAD /SYNTHETIC_PRIVATE_CANARY"},{stdoutEndCount:3},{stdinFinishCount:-1},{exitCount:0.5},{closeCode:256},{exitCode:-1},{needInput:"false"},{groupConfirmed:1},{exitSignalPresent:"SIGTERM"},{scenario:"SYNTHETIC_PRIVATE_CANARY"}])assert.throws(()=>projectGoalNativeProcessDiagnostic({...diagnostic(),...patch}));
  for(const key of ["args","command","path","stdout","stderr","input","sql","env","credentials"])assert.throws(()=>projectGoalNativeProcessDiagnostic({...diagnostic(),[key]:"SYNTHETIC_PRIVATE_CANARY"}));
  const missing=diagnostic();delete missing.operation;assert.throws(()=>projectGoalNativeProcessDiagnostic(missing));
  let reads=0;const value=diagnostic();Object.defineProperty(value,"operation",{enumerable:true,get(){reads++;throw Error("SYNTHETIC_PRIVATE_CANARY");}});assert.throws(()=>projectGoalNativeProcessDiagnostic(value));
  assert.throws(()=>projectGoalNativeProcessDiagnostic(new Proxy(diagnostic(),{get(){reads++;throw Error("SYNTHETIC_PRIVATE_CANARY");},ownKeys(){reads++;throw Error("SYNTHETIC_PRIVATE_CANARY");}})));assert.equal(reads,0);
});
test("failure-only writer emits one bounded closed record, retains reportV2 and leaves every strict terminal condition intact", async () => {
  const {emitGoalNativeProcessDiagnostic}=await import("../../scripts/verification/finance-goals-terminal-native-ci.mjs"),lines=[];
  assert.equal(emitGoalNativeProcessDiagnostic(diagnostic(),line=>lines.push(line)),true);assert.equal(lines.length,1);assert.ok(Buffer.byteLength(lines[0],"utf8")<=1024);assert.deepEqual(JSON.parse(lines[0]),diagnostic());assert.ok(lines[0].endsWith("\n"));
  const sentinel="SYNTHETIC_PRIVATE_CANARY",original=lines.length;
  for(const value of [{...diagnostic(),args:[sentinel]},{...diagnostic(),stderr:sentinel},new Error(sentinel),{...diagnostic(),operation:sentinel}])assert.equal(emitGoalNativeProcessDiagnostic(value,line=>lines.push(line)),false);
  let reads=0;const hooked=diagnostic();Object.defineProperty(hooked,"exitCode",{enumerable:true,get(){reads++;throw Error(sentinel);}});assert.equal(emitGoalNativeProcessDiagnostic(hooked,line=>lines.push(line)),false);assert.equal(reads,0);assert.equal(lines.length,original);assert.ok(lines.every(line=>!line.includes(sentinel)));
  assert.equal(emitGoalNativeProcessDiagnostic(diagnostic(),()=>{throw Error(sentinel);}),false);
  assert.equal(newGoalNativeReport().version,2);assert.equal(Object.hasOwn(newGoalNativeReport(),"processDiagnostic"),false);
  const runner=await source("scripts/verification/finance-goals-terminal-native-ci.mjs");
  assert.ok(runner.includes('if(bad||!Object.values(facts).every(n=>n===1)||exitCode!==0||closeCode!==0||exitSignal!==null||closeSignal!==null||!result.groupConfirmed){'));
  assert.ok(runner.includes('error.groupConfirmed=result.groupConfirmed===true;emitGoalNativeProcessDiagnostic(detail);throw error;'));
});
test("workflow is isolated and carries no credential/artifact or permissive skip path", async () => {
  const workflow=await source(".github/workflows/finance-goals-terminal-native-ci.yml");
  assert.match(workflow,/contents: read/);assert.match(workflow,/runs-on: ubuntu-24\.04/);assert.match(workflow,/version: "2\.120\.0"/);assert.match(workflow,/postgresql-client-17/);assert.match(workflow,/env -i/);assert.match(workflow,/--test-concurrency=1/);
  assert.doesNotMatch(workflow,/\$\{\{\s*secrets\.|upload-artifact|continue-on-error|if:\s*false|supabase (?:link|db reset|db push)/i);
});

test("image mode is a single explicit selector and missing CI cannot start services or inherit N12 reportV2",async()=>{
  const runner=await import("../../scripts/verification/finance-goals-terminal-native-ci.mjs"),reports=[];
  assert.equal(await runner.main(["--execute-images-terminal-v1"],{SYNTHETIC_PRIVATE_CANARY:"must-not-leak"},value=>reports.push(value)),1);
  assert.equal(reports.length,1);assert.equal(reports[0].version,1);assert.equal(reports[0].scenario,"finance-goals-images-terminal-native-ci");assert.equal(reports[0].code,"ENVIRONMENT_REFUSED");assert.ok(!JSON.stringify(reports).includes("must-not-leak"));
  for(const argv of [["--execute-images-terminal-v1","--execute"],["--execute-images-terminal-v2"],["--execute-images-terminal-v1","--target=remote"]]){const out=[];assert.equal(await runner.main(argv,{},value=>out.push(value)),1);assert.deepEqual(out,[{version:2,code:"ENVIRONMENT_REFUSED"}]);}
});
test("image bundle explicitly admits only its reviewed pure Source and installs E1 before M1",async()=>{
  const {assertGoalNativeEntryModule,GOAL_NATIVE_ENTRY_SOURCES}=await import("../../scripts/verification/finance-goals-terminal-native-ci.mjs"),pure="tests/helpers/finance-goals-images-candidate-source.ts";
  assert.equal(GOAL_NATIVE_ENTRY_SOURCES.filter(path=>path===pure).length,1);assert.doesNotThrow(()=>assertGoalNativeEntryModule(pure,[]));assert.throws(()=>assertGoalNativeEntryModule("tests/helpers/finance-goals-images-candidate-sql.ts",[]),{code:"GRAPH_REFUSED"});
  const entry=await source("tests/e2e-auth-local/finance-goals-terminal-native.entry.ts");assert.match(entry,/FINANCE_GOALS_IMAGES_REVIEW, compileFinanceGoalsImagesCandidate, readFinanceGoalsImagesCandidateSource/);assert.doesNotMatch(entry,/pglite|candidate-sql["']/);
  const runner=await source("scripts/verification/finance-goals-terminal-native-ci.mjs"),order=["p.compileReviewedFinanceBudgetSql(budget.patch,budget.assertions).patch","p.compileFinanceSeriesCandidate(await p.readFinanceSeriesCandidateSources())","p.compileFinanceGoalsCandidate(await p.readFinanceGoalsCandidateSources())","if(images)await apply(p.compileFinanceGoalsImagesCandidate(await p.readFinanceGoalsImagesCandidateSource()))","p.compileFinanceGoalsTerminalCandidate(await p.readFinanceGoalsTerminalCandidateSource())"];
  const indices=order.map(value=>runner.indexOf(value));assert.ok(indices.every(value=>value>=0));assert.deepEqual(indices,[...indices].sort((a,b)=>a-b));
  assert.ok(runner.includes('catalog.checks===1720'));assert.match(runner,/additive\.goal===1&&additive\.event===1&&additive\.receipt===0&&additive\.disposition===0/);assert.match(runner,/return images\?validateGoalImagesNativeReport\(report\):validateGoalNativeReport\(report\)/);
});
test("N12 oracle and physical session remain byte-preserved except approved literal image reasons and two exact D3 admissions",async()=>{
  const original=restoreSealedN12Case(await source("tests/e2e-auth-local/finance-goals-terminal-native-case.mjs"));assert.equal(hash(original),"80cf720e621a891b139656a5cc68aa59d5a95157441a6904da24f70da236ea1b");
  let session=await source("tests/e2e-auth-local/finance-goals-terminal-native-session.mjs");for(const line of ['\n  "22023:New goal image is not finalized for this purpose.": "IMAGE_NOT_FINALIZED",','\n  "22023:New goal image proof unavailable.": "IMAGE_PROOF_UNAVAILABLE",']){assert.equal(session.split(line).length,2);session=session.replace(line,"");}
  for(const line of ['import { assertDistinctNativeSessionState } from "./finance-distinct-intents-native-contract.mjs";\n','        if (["SERIES_RPC", "DISTINCT_MATERIAL", "DISTINCT_ABSENCE"].includes(statement.action)) assertDistinctNativeSessionState(statement.action, transaction, role);\n']){assert.equal(session.split(line).length,2);session=session.replace(line,"");}
  assert.equal(hash(session),"70a9a76fd6c44ce7f87ec62dcc48252a0c4a0e54d3acbed745070fcecd846759");
});
test("image workflow depends on N12 with its own checkout/stack/report and unchanged deadlines",async()=>{
  const workflow=await source(".github/workflows/finance-goals-terminal-native-ci.yml"),group=workflow.slice(workflow.indexOf("  goals-images-terminal-native:"));assert.ok(group.length>0);
  assert.match(group,/needs: goals-terminal-native/);assert.match(group,/runs-on: ubuntu-24\.04/);assert.match(group,/timeout-minutes: 35/);assert.match(group,/persist-credentials: false/);assert.match(group,/version: "2\.120\.0"/);assert.match(group,/--execute-images-terminal-v1/);assert.match(group,/env -i/);assert.doesNotMatch(group,/upload-artifact|download-artifact|secrets\.|continue-on-error|if:\s*always|--execute\s*$/m);
  const runner=await source("scripts/verification/finance-goals-terminal-native-ci.mjs");assert.match(runner,/images\?"sc-goals-images-terminal-native-":"sc-goals-terminal-native-"/);assert.match(runner,/Date\.now\(\)\+28\*60\*1000/);assert.match(runner,/deadline-Date\.now\(\)>180000/);assert.match(runner,/if\(images&&result\.completed\)/);assert.match(runner,/result\.quiet&&!result\.unknown&&!activeHttp\.metadata\(\)\.unknown/);
});


const oracleObservationInput=()=>({sourceSha:"a".repeat(40),case:"CONTRIBUTE_COMMIT_FIRST",step:"client-terminals",firstCode:"PROCESS_REFUSED",clients:["winner","loser","observer","control"].map(role=>({role,transaction:"idle",pending:0,processPending:false,failed:null,unknown:false,stdoutEof:true,stderrEof:true,exited:true,closed:true,groupAbsent:true,closing:true,terminalCounts:{stdoutEnd:1,stderrEnd:1,exit:1,close:1}}))});
test("oracle observation keeps first refusal and pre-abort client facts without granting acceptance",async()=>{
 const observe=await originalOracleDiagnostic();
 for(const step of["finish-clients","client-terminals","backend-absence"]){const input=oracleObservationInput();input.step=step;input.firstCode=step==="backend-absence"?"CLEANUP_UNCONFIRMED":"PROCESS_REFUSED";const value=observe(input);
  assert.equal(value.step,step);assert.equal(value.firstCode,input.firstCode);assert.equal(value.runtimeCertified,false);assert.equal(Object.hasOwn(value,"status"),false);assert.equal(Object.hasOwn(value,"passed"),false);
  assert.equal(value.clients.length,4);assert.equal(Object.isFrozen(value.clients[0].terminalCounts),true);assert.equal(Object.isFrozen(value.clients),true);
  input.clients[0].unknown=true;assert.equal(value.clients[0].unknown,false);
 }
 const input=oracleObservationInput();input.clients[0].unknown=true;input.clients[0].failed="ABORTED";input.clients[0].terminalCounts.exit=2;
 const value=observe(input);assert.equal(value.firstCode,"PROCESS_REFUSED");assert.equal(value.clients[0].unknown,true);assert.equal(value.clients[0].failed,"ABORTED");assert.equal(value.clients[0].terminalCounts.exit,2);
});
test("oracle observation refuses private extras, getters, foreign stages and PASS codes",async()=>{
 const observe=await originalOracleDiagnostic(),canary="PRIVATE_ORACLE_CANARY";let reads=0;
 const mutations=[v=>{v.sourceSha="foreign";},v=>{v.case="OTHER";},v=>{v.step="SQL";},v=>{v.firstCode="PASSED";},v=>{v.firstCode="NOT_RUN";},v=>{v.stderr=canary;},v=>{v.clients[0].backendPid=123;},v=>{v.clients[0].sql=canary;},v=>{v.clients[0].unknown="false";},v=>{v.clients[0].pending=2;},v=>{v.clients[0].terminalCounts.exit=3;},v=>{v.clients.reverse();}];
 for(const mutate of mutations){const input=oracleObservationInput();mutate(input);assert.throws(()=>observe(input));}
 const accessor=oracleObservationInput();Object.defineProperty(accessor.clients[0],"failed",{enumerable:true,get(){reads++;return canary;}});assert.throws(()=>observe(accessor));assert.equal(reads,0);
});
test("oracle diagnostic additions invert exactly to sealed N12 and malformed or extra blocks cannot bypass it",async()=>{
 const text=await source("tests/e2e-auth-local/finance-goals-terminal-native-case.mjs");
 assert.equal(hash(restoreSealedN12Case(text)),"80cf720e621a891b139656a5cc68aa59d5a95157441a6904da24f70da236ea1b");
 assert.throws(()=>restoreSealedN12Case(text.replace('oracleObservationStep="finish-clients"','oracleObservationStep="backend-absence"')));
 assert.throws(()=>restoreSealedN12Case(text+"\n/* DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:foreign */"));
 assert.throws(()=>restoreSealedN12Case(text.replace("DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:helper","DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:other")));
 const catchAt=text.indexOf("DOC18_GOAL_ORACLE_OBSERVATION_V1_BEGIN:catch"),publish=text.indexOf("emitGoalNativeOracleDiagnostic(context.sourceSha",catchAt),abort=text.indexOf("for(const s of sessions.values())s.abort();",catchAt);
 assert.ok(publish>catchAt&&abort>publish);assert.ok(text.includes('row.unknown ||= terminal.unknown||s.metadata().unknown'));assert.ok(text.includes('row.code="WRITE_OUTCOME_UNCERTAIN"'));
 assert.ok(text.includes('requireThat((await sql(control,"BACKENDS")).other===0,"CLEANUP_UNCONFIRMED")'));
});
