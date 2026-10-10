import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, chmod, readFile, readdir, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serializeIdentityReports, isPrivateReportDirectory, writeIdentityReports } from "../e2e-auth-local/identity-data-api-report-writer.mjs";
import { AUTH_IDENTITY_CHECKS, AUTH_IDENTITY_STAGES, assembleIdentityRlsPacket, assembleEventsPacket } from "../e2e-auth-local/identity-data-api-contract.mjs";

const reports = () => ({
  auth: { schemaVersion: 3, scenario: "identity-data-api", status: "failed", code: "LOGIN_FAILED", failurePoint: "LOGIN_DOCUMENT", cleanupFailurePoint: null,
    stages: [{ name: "fixtures-created", passed: true }, { name: "login-a1", passed: false }, { name: "fixture-cleanup", passed: true }],
    counts: { fixtureCreated: 2, fixtureDeleted: 2, browserContexts: 3 }, checks: Object.fromEntries(AUTH_IDENTITY_CHECKS.map(key => [key, key === "cleanupConfirmed"])), cleanupConfirmed: true },
  identityRls: assembleIdentityRlsPacket({ before: null, after: null, writeOutcomeUncertain: false }),
  events: assembleEventsPacket({ report: null, writeOutcomeUncertain: false }),
});
const info = (mode = 0o40700, directory = true, alias = false) => ({ mode, isDirectory: () => directory, isSymbolicLink: () => alias });
const root = resolve(tmpdir(), "identity-writer-root"), child = join(root, "case");

test("a partial Auth failure retains explicit unexecuted components in three fixed metadata files", () => {
  const packets = serializeIdentityReports(reports());
  assert.deepEqual(packets.map(packet => packet.name), ["auth-local-ci-report.json", "auth-local-ci-identity-rls-report.json", "auth-local-ci-events-report.json"]);
  const values = packets.map(packet => JSON.parse(packet.bytes));
  assert.equal(values[0].failurePoint, "LOGIN_DOCUMENT");
  assert.deepEqual(values.slice(1).map(value => [value.status, value.code]), [["not-run", "DEPENDENCY_NOT_RUN"], ["not-run", "DEPENDENCY_NOT_RUN"]]);
});

test("complete Auth alone cannot invent an auxiliary PASS", () => {
  const value = reports();
  value.auth = { ...value.auth, status: "passed", code: "PASSED", failurePoint: null, stages: AUTH_IDENTITY_STAGES.map(name => ({ name, passed: true })), checks: Object.fromEntries(AUTH_IDENTITY_CHECKS.map(key => [key, true])) };
  const packets = serializeIdentityReports(value).map(packet => JSON.parse(packet.bytes));
  assert.equal(packets[0].status, "passed"); assert.equal(packets[1].status, "not-run"); assert.equal(packets[2].status, "not-run");
});

test("unknown provider fields and inconsistent auxiliary metadata are refused before serialization", () => {
  for (const mutate of [value => { value.auth.raw = "excluded"; }, value => { value.events.status = "passed"; }, value => { value.identityRls.scenario = "password-change"; }]) {
    const value = JSON.parse(JSON.stringify(reports())); mutate(value);
    assert.throws(() => serializeIdentityReports(value), { message: "REPORT_WRITE_FAILED" });
  }
});

test("top-level getters are rejected without executing fixture-bearing code", () => {
  const value = reports(); let called = false;
  Object.defineProperty(value, "auth", { enumerable: true, get: () => { called = true; return reports().auth; } });
  assert.throws(() => serializeIdentityReports(value), { message: "REPORT_WRITE_FAILED" }); assert.equal(called, false);
});

test("the writer requires a canonical private descendant, not the root, sibling or alias", () => {
  assert.equal(isPrivateReportDirectory(root, child, child, info()), true);
  for (const directory of [root, resolve(root, "..", "sibling"), resolve(root, "..", "identity-writer-root-copy", "case")]) assert.equal(isPrivateReportDirectory(root, directory, directory, info()), false);
  assert.equal(isPrivateReportDirectory(root, child, join(root, "alias"), info()), false);
  assert.equal(isPrivateReportDirectory(root, child, child, info(0o40700, true, true)), false);
});

test("group permissions and non-directories never qualify as a private report directory", () => {
  for (const mode of [0o40750, 0o40701, 0o40777]) assert.equal(isPrivateReportDirectory(root, child, child, info(mode)), false);
  assert.equal(isPrivateReportDirectory(root, child, child, info(0o100600, false)), false);
});

async function temporary(action) {
  const directory = await mkdtemp(join(tmpdir(), "identity-report-writer-"));
  try { const own = join(directory, "case"); await mkdir(own, { mode: 0o700 }); await action(directory, own); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test("all metadata is validated before filesystem output, including a bad last component", async () => {
  await temporary(async (runnerTemp, own) => {
    const value = reports(); value.events = { ...value.events, raw: "excluded" };
    await assert.rejects(writeIdentityReports({ runnerTemp, reportPath: join(own, "auth-local-ci-report.json") }, value), { message: "REPORT_WRITE_FAILED" });
    assert.deepEqual(await readdir(own), []);
  });
});

test("a caller-selected filename cannot replace the fixed Auth report", async () => {
  await temporary(async (runnerTemp, own) => {
    await assert.rejects(writeIdentityReports({ runnerTemp, reportPath: join(own, "other.json") }, reports()), { message: "REPORT_WRITE_FAILED" });
    assert.deepEqual(await readdir(own), []);
  });
});

test("exclusive private writes preserve existing reports and never overwrite them", { skip: process.platform === "win32" }, async () => {
  await temporary(async (runnerTemp, own) => {
    const environment = { runnerTemp, reportPath: join(own, "auth-local-ci-report.json") };
    await writeIdentityReports(environment, reports());
    const previous = await readFile(environment.reportPath);
    await assert.rejects(writeIdentityReports(environment, reports()), { message: "REPORT_WRITE_FAILED" });
    assert.deepEqual(await readFile(environment.reportPath), previous);
    assert.equal((await readdir(own)).length, 3);
  });
});

test("unsafe permissions and directory symlinks are refused without output", { skip: process.platform === "win32" }, async () => {
  await temporary(async (runnerTemp, own) => {
    await chmod(own, 0o750);
    await assert.rejects(writeIdentityReports({ runnerTemp, reportPath: join(own, "auth-local-ci-report.json") }, reports()), { message: "REPORT_WRITE_FAILED" });
    await chmod(own, 0o700); const alias = join(runnerTemp, "alias"); await symlink(own, alias, "dir");
    await assert.rejects(writeIdentityReports({ runnerTemp, reportPath: join(alias, "auth-local-ci-report.json") }, reports()), { message: "REPORT_WRITE_FAILED" });
    assert.deepEqual(await readdir(own), []);
  });
});

test("a colliding auxiliary is a failure, preserves the collision and exposes no successful aggregate", { skip: process.platform === "win32" }, async () => {
  await temporary(async (runnerTemp, own) => {
    const auxiliary = join(own, "auth-local-ci-identity-rls-report.json"); await writeFile(auxiliary, "existing", { mode: 0o600 });
    await assert.rejects(writeIdentityReports({ runnerTemp, reportPath: join(own, "auth-local-ci-report.json") }, reports()), { message: "REPORT_WRITE_FAILED" });
    assert.equal(await readFile(auxiliary, "utf8"), "existing");
    assert.deepEqual((await readdir(own)).sort(), ["auth-local-ci-identity-rls-report.json", "auth-local-ci-report.json"]);
  });
});
