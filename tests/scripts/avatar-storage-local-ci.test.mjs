import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { requireAvatarCi, decodeAvatarSql, verifyAvatarInstance, avatarInspectionInput, validateAvatarActors, validateAvatarCiReport, collectAvatarSources, AVATAR_NEW_PATHS, AVATAR_SOURCE_PATHS, AVATAR_CI_CHECKS, main } from "../../scripts/verification/avatar-storage-local-ci.mjs";
import { loadHistorical026Migrations } from "../../scripts/verification/auth-local-ci.mjs";
import { ADMIN_LOCAL_DEPENDENCY_PATHS } from "../e2e-auth-local/admin-native-backend-local-ci-contract.mjs";
import { AVATAR_LIMITATIONS, AVATAR_STAGES, AVATAR_PASS_COUNTS } from "../e2e-auth-local/avatar-storage-contract.mjs";
import { createAvatarStackDiagnosticRecorder, emitAvatarStackDiagnostic } from "../e2e-auth-local/avatar-storage-stack-diagnostic.mjs";
const actors = () => ({ a: { id: "10000000-0000-4000-8000-000000000001", sessionId: "10000000-0000-4000-8000-000000000002", marker: "a".repeat(64) }, b: { id: "10000000-0000-4000-8000-000000000003", sessionId: "10000000-0000-4000-8000-000000000004", marker: "b".repeat(64) } });
const context = () => ({ sourceSha: "a".repeat(40), namespace: "sc-avatar-native-" + "a".repeat(32), systemIdentifier: "123456789" });
test("avatar CLI help and invalid arguments start no services", async () => { const results = []; assert.equal(await main(["--help"], {}, result => results.push(result)), 0); assert.equal(await main(["--wrong"], {}, result => results.push(result)), 2); assert.deepEqual(results.map(value => value.code), ["NO_SERVICE_STARTED", "ARGUMENTS_REFUSED"]); assert.equal(results.every(value => value.hostedAccess === false), true); });
test("avatar runner requires Linux sterile CI and its own SHA/opt-in", () => {
  for (const environment of [{}, { CI: "true", GITHUB_ACTIONS: "true", SC_AUTH_LOCAL_CI_RUN: "1" }, { SC_AVATAR_STORAGE_LOCAL_CI_RUN: "1", GITHUB_SHA: "not-a-sha" }]) assert.throws(() => requireAvatarCi(environment, "linux"));
  assert.throws(() => requireAvatarCi({ SC_AVATAR_STORAGE_LOCAL_CI_RUN: "1", GITHUB_SHA: "a".repeat(40) }, "win32"));
});
test("avatar SQL decoder accepts one bounded JSON object and PG17 exact system only", () => {
  const proof = { database: "postgres", currentUser: "postgres", serverVersion: 170011, systemIdentifier: "123456789" };
  assert.equal(verifyAvatarInstance(decodeAvatarSql(JSON.stringify(proof)), "123456789"), "123456789");
  for (const raw of ["[]", "{}\n{}", "not json", "a".repeat(1048577)]) assert.throws(() => decodeAvatarSql(raw));
  assert.throws(() => verifyAvatarInstance({ ...proof, serverVersion: 180000 })); assert.throws(() => verifyAvatarInstance(proof, "987654321"));
});
test("avatar inspection cannot target arbitrary IDs/SQL, and stays read-only", () => {
  const owned = actors(), upload = "10000000-0000-4000-8000-000000000005";
  validateAvatarActors(owned); const sql = avatarInspectionInput(context(), owned, upload);
  assert.ok(sql.includes("begin read only;")); assert.ok(sql.endsWith("rollback;")); assert.ok(sql.includes("sc_avatar_ci_marker")); assert.ok(sql.includes("pg_control_system()")); assert.equal(/\b(?:insert|update|delete|alter|create|drop|truncate)\b/i.test(sql), false);
  assert.throws(() => avatarInspectionInput(context(), owned, owned.a.id)); assert.throws(() => avatarInspectionInput(context(), owned, "';delete from auth.users;--")); assert.throws(() => validateAvatarActors({ ...owned, b: { ...owned.b, sessionId: owned.a.sessionId } }));
});
test("avatar new paths include the passive diagnostic; no processor entry or original workflow is replaced", () => {
  assert.equal(AVATAR_NEW_PATHS.length, 10); assert.equal(new Set(AVATAR_NEW_PATHS).size, 10); assert.ok(AVATAR_NEW_PATHS.includes("tests/e2e-auth-local/avatar-storage-stack-diagnostic.mjs")); assert.equal(AVATAR_NEW_PATHS.some(path => path.endsWith("entry.ts")), false); assert.equal(AVATAR_NEW_PATHS.every(path => path.includes("avatar-storage")), true);
});
test("avatar sources import original lifecycle, processor and ACK without domain factory aliases", async () => {
  const runner = await readFile(new URL("../../scripts/verification/avatar-storage-local-ci.mjs", import.meta.url), "utf8"), protocol = await readFile(new URL("../e2e-auth-local/avatar-storage-local-case.mjs", import.meta.url), "utf8");
  assert.ok(runner.includes('from "./auth-local-ci.mjs"')); assert.ok(runner.includes("createAdminOwnedTransport")); assert.ok(protocol.includes("loadCaptureImageProcessor")); assert.ok(protocol.includes("acceptsAdminNativeDeleteAcknowledgement"));
  assert.equal(protocol.includes("filesServicesForRequest"), false); assert.equal(protocol.includes("STORAGE_ORIGIN"), false); assert.equal(runner.includes("apply_migration"), false); assert.doesNotMatch(runner,/\bprepareQualifiedChromium\s*\(/);
});
test("source inventory follows actual reused import graph and refuses a mismatched revision", async () => {
  // The read-only Git port returns local bytes, so this is collector QA,
  // explicitly not evidence that these uncommitted sources exist in Git/CI.
  const root = new URL("../../", import.meta.url), sha = "a".repeat(40), migrations = await loadHistorical026Migrations(fileURLToPath(root));
  const readRevision = async (program, args) => { assert.equal(program, "git"); assert.deepEqual(args.slice(0, 1), ["show"]); assert.ok(args[1].startsWith(sha + ":")); return { stdout: await readFile(new URL(args[1].slice(sha.length + 1), root)) }; };
  const inventory = await collectAvatarSources(readRevision, sha, migrations), paths = new Set(inventory.sourceHashes.map(row => row.path));
  for (const path of [...AVATAR_NEW_PATHS, "tests/e2e-auth-local/qualified-chromium.mjs", "tests/e2e-auth-local/browser-process-environment.mjs", "tests/e2e-auth-local/admin-native-backend-case.mjs", "scripts/verification/admin-native-backend-local-ci.mjs", "tests/e2e-auth-local/capture-image-storage-support.mjs", "src/adapters/db/files-processor.ts", "supabase/tests/release-catalog.sql"]) assert.ok(paths.has(path), path);
  assert.equal(paths.size, AVATAR_SOURCE_PATHS.length); assert.deepEqual([...paths], AVATAR_SOURCE_PATHS); assert.equal(inventory.dependencyHashes.length, 45); assert.equal(paths.has(".env.local"), false); assert.equal(paths.has("src/adapters/db/files-runtime.ts"), false);
  await assert.rejects(collectAvatarSources(async () => ({ stdout: Buffer.from("wrong-revision") }), sha, migrations), /SOURCE_REFUSED/);
  const releasePaths=["tests/helpers/canonical-release-source.mjs","tests/helpers/canonical-release-source.d.mts","tests/fixtures/schema-release-026/manifest.json","tests/fixtures/schema-release-026/release-catalog.sql","supabase/migrations/20261024130000_finance_mvp_vertical.sql","supabase/sql-editor/installation/027_20261024130000_finance_mvp_vertical.sql"];
  for(const path of releasePaths){
    assert.ok(paths.has(path),path);
    await assert.rejects(collectAvatarSources(async(program,args,...rest)=>args[1]===sha+":"+path?{stdout:Buffer.from("wrong-git-byte")}:readRevision(program,args,...rest),sha,migrations),/SOURCE_REFUSED/);
  }
  assert.equal(migrations.length,26);
});
test("closed native envelope needs the full reviewed source set and preserves case uncertainty/pending", () => {
  // Synthetic consumer controls; neither this envelope nor its hashes prove CI.
  const rows = paths => paths.map(path => ({ path, bytes: path === "node_modules/server-only/empty.js" ? 0 : 1, sha256: path === "node_modules/server-only/empty.js" ? "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" : "a".repeat(64) }));
  const report = { schemaVersion: 1, scenario: "avatar-storage-local-ci", status: "passed", code: "PASSED", phase: "complete", sourceSha: "a".repeat(40), sourceHashes: rows(AVATAR_SOURCE_PATHS), dependencyHashes: rows(ADMIN_LOCAL_DEPENDENCY_PATHS), migrationsApplied: 26, catalogueChecks: 1720, checks: Object.fromEntries(AVATAR_CI_CHECKS.map(key => [key, true])), writeOutcomeUncertain: false, limitations: Object.fromEntries(AVATAR_LIMITATIONS.map(key => [key, false])), caseReport: { schemaVersion: 1, scenario: "avatar-storage-local-case", status: "passed", code: "PASSED", failurePoint: null, stages: Object.fromEntries(AVATAR_STAGES.map(key => [key, true])), counts: { ...AVATAR_PASS_COUNTS }, measurements: { sourceBytes: 20000, finalBytes: 5000, sourceWidth: 800, sourceHeight: 600, finalWidth: 512, finalHeight: 512 }, writeOutcomeUncertain: false, pendingRequests: 0, pendingInspections: 0, deadlineRefused: false, limitations: Object.fromEntries(AVATAR_LIMITATIONS.map(key => [key, false])) } };
  validateAvatarCiReport(report);
  for (const migrationsApplied of [22, 25, 27]) assert.throws(() => validateAvatarCiReport({ ...report, migrationsApplied }), /CI_REPORT_REFUSED/);
  assert.throws(() => validateAvatarCiReport({ ...report, catalogueChecks: 1428 }), /CI_REPORT_REFUSED/); assert.throws(() => validateAvatarCiReport({ ...report, catalogueChecks: 1534 }), /CI_REPORT_REFUSED/);
  for (const marker of [{ bytes: 1 }, { sha256: "a".repeat(64) }]) assert.throws(() => validateAvatarCiReport({ ...report, dependencyHashes: report.dependencyHashes.map(row => row.path === "node_modules/server-only/empty.js" ? { ...row, ...marker } : row) }), /CI_REPORT_REFUSED/);
  for (const sourceHashes of [rows(AVATAR_NEW_PATHS), report.sourceHashes.filter(row => row.path !== "tests/e2e-auth-local/admin-native-backend-case.mjs"), report.sourceHashes.filter(row => !row.path.endsWith("20261011071500_admin_auth_creation_order.sql")), report.sourceHashes.filter(row => !row.path.endsWith("20261023061901_onboarding_foundation.sql"))]) assert.throws(() => validateAvatarCiReport({ ...report, sourceHashes }), /CI_REPORT_REFUSED/);
  for(const path of ["tests/helpers/canonical-release-source.mjs","tests/helpers/canonical-release-source.d.mts","tests/fixtures/schema-release-026/manifest.json","tests/fixtures/schema-release-026/release-catalog.sql","supabase/migrations/20261024130000_finance_mvp_vertical.sql","supabase/sql-editor/installation/027_20261024130000_finance_mvp_vertical.sql"]){
    const sourceHashes=report.sourceHashes.filter(row=>row.path!==path);sourceHashes.push({path:"src/unreviewed-same-cardinality.ts",bytes:1,sha256:"a".repeat(64)});
    assert.throws(()=>validateAvatarCiReport({...report,sourceHashes}),/CI_REPORT_REFUSED/);
  }
  const failedCase = { ...report.caseReport, status: "failed", code: "WRITE_OUTCOME_UNCERTAIN", failurePoint: "OBJECT_CLEANUP", writeOutcomeUncertain: true };
  const failed = { ...report, status: "failed", code: "CASE_FAILED", phase: "case", caseReport: failedCase };
  assert.throws(() => validateAvatarCiReport(failed), /CI_REPORT_REFUSED/);
  validateAvatarCiReport({ ...failed, writeOutcomeUncertain: true });
  for (const pending of [{ pendingRequests: 1 }, { pendingInspections: 1 }]) assert.throws(() => validateAvatarCiReport({ ...failed, writeOutcomeUncertain: true, caseReport: { ...failedCase, ...pending } }), /CI_REPORT_REFUSED/);
});
test("avatar CI envelope cannot claim native success from case-only PASS or cleanup unknown", () => {
  const report = { schemaVersion: 1, scenario: "avatar-storage-local-ci", status: "failed", code: "ENVIRONMENT_REFUSED", phase: "environment", sourceSha: null, sourceHashes: [], dependencyHashes: [], migrationsApplied: 0, catalogueChecks: 0, checks: Object.fromEntries(["environment", "sources", "ownedNamespace", "pg17", "catalogue", "casePassed", "finalSql", "quiescent", "namespaceRemoved", "directoriesRemoved"].map(key => [key, false])), caseReport: null, limitations: Object.fromEntries(AVATAR_LIMITATIONS.map(key => [key, false])), writeOutcomeUncertain: false };
  validateAvatarCiReport(report);
  assert.throws(() => validateAvatarCiReport({ ...report, status: "passed", code: "PASSED" })); assert.throws(() => validateAvatarCiReport({ ...report, providerBody: "CANARY_PRIVATE" })); assert.throws(() => validateAvatarCiReport({ ...report, limitations: { ...report.limitations, hostedSupabase: true } }));
  let reads = 0; const checks = { ...report.checks }; Object.defineProperty(checks, "sources", { enumerable: true, get() { reads++; return true; } }); assert.throws(() => validateAvatarCiReport({ ...report, checks }), /CI_REPORT_REFUSED/); assert.equal(reads, 0);
  const sources = []; Object.defineProperty(sources, "0", { enumerable: true, get() { reads++; return { providerBody: "CANARY_PRIVATE" }; } }); assert.throws(() => validateAvatarCiReport({ ...report, sourceHashes: sources }), /CI_REPORT_REFUSED/); assert.equal(reads, 0);
  assert.throws(() => validateAvatarCiReport({ ...report, sourceSha: "not-a-sha" }), /CI_REPORT_REFUSED/);
});

const diagnosticReport = () => ({ scenario: "avatar-storage-local-ci", sourceSha: "a".repeat(40), phase: "stack", status: "failed" });
const takeDiagnostic = report => { const values = []; assert.equal(emitAvatarStackDiagnostic(report, value => values.push(value)), true); assert.equal(values.length, 1); return values[0]; };
const processFailure = (code, groupConfirmed) => Object.assign(Error("CANARY_PROVIDER_TEXT"), { code, groupConfirmed });
test("avatar stack diagnostic emits one closed Source-bound own-data companion", () => {
  for (const boundary of ["STACK_START", "STACK_STATUS", "STACK_DB_INSPECT", "STACK_KONG_INSPECT", "STACK_AUTH_INSPECT", "STACK_REST_INSPECT", "STACK_STORAGE_INSPECT"]) for (const groupConfirmed of [true, false]) {
    const report = diagnosticReport(), recorder = createAvatarStackDiagnosticRecorder(report), before = structuredClone(report);
    assert.equal(recorder.observe(boundary, processFailure("COMMAND_FAILED", groupConfirmed)), true);
    assert.equal(recorder.observe("STACK_START", processFailure("COMMAND_TIMEOUT", !groupConfirmed)), false);
    const value = takeDiagnostic(report);
    assert.deepEqual(value, { schemaVersion: 1, scenario: "avatar-storage-stack-process-failure", sourceSha: "a".repeat(40), boundary, code: "COMMAND_FAILED", groupConfirmed });
    assert.equal(Object.isFrozen(value), true); assert.deepEqual(report, before);
    assert.equal(JSON.stringify(value).includes("CANARY_PROVIDER_TEXT"), false);
    assert.equal(emitAvatarStackDiagnostic(report, () => assert.fail("second emission")), false);
  }
  for (const code of ["COMMAND_UNAVAILABLE", "COMMAND_TIMEOUT", "COMMAND_OUTPUT_LIMIT", "COMMAND_GROUP_UNCONFIRMED", "PROCESS_OPTIONS_REFUSED"]) {
    const report = diagnosticReport(); createAvatarStackDiagnosticRecorder(report).observe("STACK_START", processFailure(code, false)); assert.equal(takeDiagnostic(report).code, code);
  }
});
test("avatar stack diagnostic excludes inherited/accessor/provider/Proxy authority without reads", () => {
  let reads = 0, traps = 0;
  const accessor = Object.defineProperties({}, Object.fromEntries(["code", "groupConfirmed", "message", "stack"].map(key => [key, { get() { reads++; throw Error("CANARY_PROVIDER_TEXT"); } }])));
  const proxy = new Proxy({}, { get() { traps++; throw Error("CANARY_PROVIDER_TEXT"); }, getOwnPropertyDescriptor() { traps++; throw Error("CANARY_PROVIDER_TEXT"); } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  for (const error of [null, "CANARY_PROVIDER_TEXT", Object.create({ code: "COMMAND_FAILED", groupConfirmed: true }), accessor, proxy, revoked.proxy, { code: "CANARY_PROVIDER_TEXT", groupConfirmed: "true" }, { code: { toString() { reads++; throw Error("CANARY_PROVIDER_TEXT"); } }, groupConfirmed: 1 }]) {
    const report = diagnosticReport(); assert.equal(createAvatarStackDiagnosticRecorder(report).observe("STACK_START", error), true);
    assert.deepEqual(takeDiagnostic(report), { schemaVersion: 1, scenario: "avatar-storage-stack-process-failure", sourceSha: "a".repeat(40), boundary: "STACK_START", code: "UNKNOWN", groupConfirmed: null });
  }
  assert.equal(reads, 0); assert.equal(traps, 0);
});
test("avatar stack diagnostic refuses other windows/sources and unregistered report lookalikes", () => {
  let reads = 0, traps = 0;
  const getterReport = Object.defineProperty(diagnosticReport(), "sourceSha", { get() { reads++; throw Error("CANARY_PROVIDER_TEXT"); } });
  const proxyReport = new Proxy(diagnosticReport(), { getOwnPropertyDescriptor() { traps++; throw Error("CANARY_PROVIDER_TEXT"); } });
  const revoked = Proxy.revocable(diagnosticReport(), {}); revoked.revoke();
  for (const report of [null, getterReport, proxyReport, revoked.proxy, { ...diagnosticReport(), sourceSha: "not-source" }, { ...diagnosticReport(), phase: "teardown" }, { ...diagnosticReport(), scenario: "other" }]) {
    assert.equal(createAvatarStackDiagnosticRecorder(report).observe("STACK_START", processFailure("COMMAND_FAILED", true)), false);
    assert.equal(emitAvatarStackDiagnostic(report, () => assert.fail("unregistered emission")), false);
  }
  const report = diagnosticReport(), recorder = createAvatarStackDiagnosticRecorder(report);
  for (const boundary of [null, "STACK_START_OTHER", "DATABASE", "TEARDOWN", "CANARY_PROVIDER_TEXT"]) assert.equal(recorder.observe(boundary, processFailure("COMMAND_FAILED", true)), false);
  assert.equal(recorder.observe("STACK_STATUS", processFailure("COMMAND_FAILED", true)), true);
  assert.equal(emitAvatarStackDiagnostic(structuredClone(report), () => assert.fail("clone emission")), false);
  assert.equal(takeDiagnostic(report).boundary, "STACK_STATUS"); assert.equal(reads, 0); assert.equal(traps, 0);
});
test("avatar stack diagnostic consumes provenance even when the optional writer fails", () => {
  const report = diagnosticReport(), before = structuredClone(report);
  createAvatarStackDiagnosticRecorder(report).observe("STACK_START", processFailure("COMMAND_FAILED", true));
  assert.equal(emitAvatarStackDiagnostic(report, () => { throw Error("CANARY_WRITER"); }), false);
  assert.equal(emitAvatarStackDiagnostic(report, () => assert.fail("retry emission")), false); assert.deepEqual(report, before);
});

// Slice the production closure itself; no spawn, CLI, SDK, SQL or duplicated run.
async function actualAvatarRunPort(bounded) {
  const source = await readFile(new URL("../../scripts/verification/avatar-storage-local-ci.mjs", import.meta.url), "utf8");
  const start = "  const run = (program, args, timeoutMs, options = {}, diagnosticBoundary = null) => {", end = "  const cli = args =>";
  assert.equal(source.split(start).length, 2); assert.equal(source.split(end).length, 2);
  const a = source.indexOf(start), b = source.indexOf(end, a); assert.ok(b > a);
  const failLines = source.split("\n").filter(line => line.startsWith("const fail = code =>")); assert.equal(failLines.length, 1);
  const report = diagnosticReport(), recorder = createAvatarStackDiagnosticRecorder(report);
  const port = new Function("runBoundedProcess", "ROOT", "child", "stackDiagnostic", '"use strict"; const processes = new Set(); let groupsKnown = true; ' + failLines[0] + "\n" + source.slice(a, b) + "\nreturn { run, state: () => ({ groupsKnown, pending: processes.size }) };")(bounded, "FAKE_ROOT", Object.freeze({ PATH: "FAKE_PATH" }), recorder);
  return { ...port, report };
}
test("avatar actual run closure keeps success and an untagged refusal unchanged", async () => {
  const result = { stdout: "", groupConfirmed: true }, calls = [], extra = { capture: false };
  const success = await actualAvatarRunPort(async (...args) => { calls.push(args); return result; });
  assert.equal(await success.run("supabase", ["start"], 600000, extra, "STACK_START"), result);
  assert.deepEqual(calls, [["supabase", ["start"], { cwd: "FAKE_ROOT", env: { PATH: "FAKE_PATH" }, timeoutMs: 600000, maxBytes: 1048576, capture: false }]]);
  assert.deepEqual(success.state(), { groupsKnown: true, pending: 0 }); assert.equal(emitAvatarStackDiagnostic(success.report, () => assert.fail("success diagnostic")), false);
  const error = processFailure("COMMAND_FAILED", true), refusal = await actualAvatarRunPort(async () => { throw error; });
  await assert.rejects(refusal.run("git", ["show"], 15000), value => value === error);
  assert.deepEqual(refusal.state(), { groupsKnown: false, pending: 0 }); assert.equal(emitAvatarStackDiagnostic(refusal.report, () => assert.fail("untagged diagnostic")), false);
});
test("avatar actual run rejection retains the exact error and unconditional group latch", async () => {
  for (const groupConfirmed of [true, false]) {
    const error = processFailure("COMMAND_FAILED", groupConfirmed), port = await actualAvatarRunPort(async () => { throw error; });
    await assert.rejects(port.run("supabase", ["start"], 600000, { capture: false }, "STACK_START"), value => value === error);
    assert.deepEqual(port.state(), { groupsKnown: false, pending: 0 });
    assert.equal(takeDiagnostic(port.report).groupConfirmed, groupConfirmed);
  }
  const port = await actualAvatarRunPort(async () => ({ stdout: "", groupConfirmed: false }));
  await assert.rejects(port.run("supabase", ["status"], 30000, {}, "STACK_STATUS"), /CASE_FAILED/);
  assert.deepEqual(port.state(), { groupsKnown: false, pending: 0 }); assert.equal(takeDiagnostic(port.report).code, "UNKNOWN");
});
test("avatar actual run adds no accessor/Proxy reads and preserves the thrown reference", async () => {
  let reads = 0, traps = 0;
  const accessor = Object.defineProperties({}, { code: { get() { reads++; throw Error("CANARY_PROVIDER_TEXT"); } }, groupConfirmed: { get() { reads++; throw Error("CANARY_PROVIDER_TEXT"); } } });
  const proxy = new Proxy({}, { getOwnPropertyDescriptor() { traps++; throw Error("CANARY_PROVIDER_TEXT"); }, get() { traps++; throw Error("CANARY_PROVIDER_TEXT"); } });
  for (const error of [accessor, proxy]) {
    const port = await actualAvatarRunPort(async () => { throw error; });
    let caught;
    try { await port.run("docker", ["inspect"], 15000, {}, "STACK_DB_INSPECT"); } catch (value) { caught = value; }
    assert.equal(caught, error);
    assert.deepEqual(port.state(), { groupsKnown: false, pending: 0 }); const value = takeDiagnostic(port.report); assert.equal(value.code, "UNKNOWN"); assert.equal(value.groupConfirmed, null);
  }
  assert.equal(reads, 0); assert.equal(traps, 0);
});
test("avatar actual main keeps the failed report/exit when companion output throws", async () => {
  const source = await readFile(new URL("../../scripts/verification/avatar-storage-local-ci.mjs", import.meta.url), "utf8"), start = "export async function main(", end = "\nif (process.argv[1]";
  assert.equal(source.split(start).length, 2); assert.equal(source.split(end).length, 2);
  const report = diagnosticReport(), values = []; createAvatarStackDiagnosticRecorder(report).observe("STACK_START", processFailure("COMMAND_FAILED", true));
  const actualMain = new Function("runAvatarStorageCi", "emitAvatarStackDiagnostic", source.slice(source.indexOf(start), source.indexOf(end)).replace("export async function main(", "async function main(") + "\nreturn main;")(async () => report, emitAvatarStackDiagnostic);
  assert.equal(await actualMain(["--execute"], {}, value => { if (value.scenario === "avatar-storage-stack-process-failure") throw Error("CANARY_WRITER"); values.push(value); }), 1);
  assert.deepEqual(values, [report]); assert.equal(emitAvatarStackDiagnostic(report, () => assert.fail("late retry")), false);
});
