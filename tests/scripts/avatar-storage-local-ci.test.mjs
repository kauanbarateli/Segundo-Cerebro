import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { requireAvatarCi, decodeAvatarSql, verifyAvatarInstance, avatarInspectionInput, validateAvatarActors, validateAvatarCiReport, collectAvatarSources, AVATAR_NEW_PATHS, AVATAR_SOURCE_PATHS, AVATAR_CI_CHECKS, main } from "../../scripts/verification/avatar-storage-local-ci.mjs";
import { loadCanonicalMigrations } from "../../scripts/verification/auth-local-ci.mjs";
import { ADMIN_LOCAL_DEPENDENCY_PATHS } from "../e2e-auth-local/admin-native-backend-local-ci-contract.mjs";
import { AVATAR_LIMITATIONS, AVATAR_STAGES, AVATAR_PASS_COUNTS } from "../e2e-auth-local/avatar-storage-contract.mjs";
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
test("avatar new paths are nine; no processor entry or original workflow is replaced", () => {
  assert.equal(AVATAR_NEW_PATHS.length, 9); assert.equal(new Set(AVATAR_NEW_PATHS).size, 9); assert.equal(AVATAR_NEW_PATHS.some(path => path.endsWith("entry.ts")), false); assert.equal(AVATAR_NEW_PATHS.every(path => path.includes("avatar-storage")), true);
});
test("avatar sources import original lifecycle, processor and ACK without domain factory aliases", async () => {
  const runner = await readFile(new URL("../../scripts/verification/avatar-storage-local-ci.mjs", import.meta.url), "utf8"), protocol = await readFile(new URL("../e2e-auth-local/avatar-storage-local-case.mjs", import.meta.url), "utf8");
  assert.ok(runner.includes('from "./auth-local-ci.mjs"')); assert.ok(runner.includes("createAdminOwnedTransport")); assert.ok(protocol.includes("loadCaptureImageProcessor")); assert.ok(protocol.includes("acceptsAdminNativeDeleteAcknowledgement"));
  assert.equal(protocol.includes("filesServicesForRequest"), false); assert.equal(protocol.includes("STORAGE_ORIGIN"), false); assert.equal(runner.includes("apply_migration"), false);
});
test("source inventory follows actual reused import graph and refuses a mismatched revision", async () => {
  // The read-only Git port returns local bytes, so this is collector QA,
  // explicitly not evidence that these uncommitted sources exist in Git/CI.
  const root = new URL("../../", import.meta.url), sha = "a".repeat(40), migrations = await loadCanonicalMigrations(fileURLToPath(root));
  const readRevision = async (program, args) => { assert.equal(program, "git"); assert.deepEqual(args.slice(0, 1), ["show"]); assert.ok(args[1].startsWith(sha + ":")); return { stdout: await readFile(new URL(args[1].slice(sha.length + 1), root)) }; };
  const inventory = await collectAvatarSources(readRevision, sha, migrations), paths = new Set(inventory.sourceHashes.map(row => row.path));
  for (const path of [...AVATAR_NEW_PATHS, "tests/e2e-auth-local/admin-native-backend-case.mjs", "scripts/verification/admin-native-backend-local-ci.mjs", "tests/e2e-auth-local/capture-image-storage-support.mjs", "src/adapters/db/files-processor.ts", "supabase/tests/release-catalog.sql"]) assert.ok(paths.has(path), path);
  assert.equal(paths.size, 51); assert.deepEqual([...paths], AVATAR_SOURCE_PATHS); assert.equal(inventory.dependencyHashes.length, 45); assert.equal(paths.has(".env.local"), false); assert.equal(paths.has("src/adapters/db/files-runtime.ts"), false);
  await assert.rejects(collectAvatarSources(async () => ({ stdout: Buffer.from("wrong-revision") }), sha, migrations), /SOURCE_REFUSED/);
});
test("closed native envelope needs all51 sources and preserves case uncertainty/pending", () => {
  // Synthetic consumer controls; neither this envelope nor its hashes prove CI.
  const rows = paths => paths.map(path => ({ path, bytes: path === "node_modules/server-only/empty.js" ? 0 : 1, sha256: path === "node_modules/server-only/empty.js" ? "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" : "a".repeat(64) }));
  const report = { schemaVersion: 1, scenario: "avatar-storage-local-ci", status: "passed", code: "PASSED", phase: "complete", sourceSha: "a".repeat(40), sourceHashes: rows(AVATAR_SOURCE_PATHS), dependencyHashes: rows(ADMIN_LOCAL_DEPENDENCY_PATHS), migrationsApplied: 18, catalogueChecks: 1254, checks: Object.fromEntries(AVATAR_CI_CHECKS.map(key => [key, true])), writeOutcomeUncertain: false, limitations: Object.fromEntries(AVATAR_LIMITATIONS.map(key => [key, false])), caseReport: { schemaVersion: 1, scenario: "avatar-storage-local-case", status: "passed", code: "PASSED", failurePoint: null, stages: Object.fromEntries(AVATAR_STAGES.map(key => [key, true])), counts: { ...AVATAR_PASS_COUNTS }, measurements: { sourceBytes: 20000, finalBytes: 5000, sourceWidth: 800, sourceHeight: 600, finalWidth: 512, finalHeight: 512 }, writeOutcomeUncertain: false, pendingRequests: 0, pendingInspections: 0, deadlineRefused: false, limitations: Object.fromEntries(AVATAR_LIMITATIONS.map(key => [key, false])) } };
  validateAvatarCiReport(report);
  for (const marker of [{ bytes: 1 }, { sha256: "a".repeat(64) }]) assert.throws(() => validateAvatarCiReport({ ...report, dependencyHashes: report.dependencyHashes.map(row => row.path === "node_modules/server-only/empty.js" ? { ...row, ...marker } : row) }), /CI_REPORT_REFUSED/);
  for (const sourceHashes of [rows(AVATAR_NEW_PATHS), report.sourceHashes.filter(row => row.path !== "tests/e2e-auth-local/admin-native-backend-case.mjs"), report.sourceHashes.filter(row => !row.path.endsWith("20261011071500_admin_auth_creation_order.sql"))]) assert.throws(() => validateAvatarCiReport({ ...report, sourceHashes }), /CI_REPORT_REFUSED/);
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
