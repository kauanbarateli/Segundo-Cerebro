import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, chmod, readFile, readdir, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serializeIdentityReports, isPrivateReportDirectory, writeIdentityReports } from "../e2e-auth-local/identity-data-api-report-writer.mjs";
import { AUTH_IDENTITY_CHECKS, AUTH_IDENTITY_STAGES, assembleIdentityRlsPacket, assembleEventsPacket } from "../e2e-auth-local/identity-data-api-contract.mjs";
import { assembleCaptureTaskPacket } from "../e2e-auth-local/capture-task-persistence-contract.mjs";

const reports = () => ({
  auth: { schemaVersion: 3, scenario: "identity-data-api", status: "failed", code: "LOGIN_FAILED", failurePoint: "LOGIN_DOCUMENT", cleanupFailurePoint: null,
    stages: [{ name: "fixtures-created", passed: true }, { name: "login-a1", passed: false }, { name: "fixture-cleanup", passed: true }],
    counts: { fixtureCreated: 2, fixtureDeleted: 2, browserContexts: 3 }, checks: Object.fromEntries(AUTH_IDENTITY_CHECKS.map(key => [key, key === "cleanupConfirmed"])), cleanupConfirmed: true },
  identityRls: assembleIdentityRlsPacket({ before: null, after: null, writeOutcomeUncertain: false }),
  events: assembleEventsPacket({ report: null, writeOutcomeUncertain: false }),
  captureTask: assembleCaptureTaskPacket({ report: null, writeOutcomeUncertain: false }),
});
const info = (mode = 0o40700, directory = true, alias = false) => ({ mode, isDirectory: () => directory, isSymbolicLink: () => alias });
const root = resolve(tmpdir(), "identity-writer-root"), child = join(root, "case");

test("a partial Auth failure retains explicit unexecuted components in four fixed metadata files", () => {
  const packets = serializeIdentityReports(reports());
  assert.deepEqual(packets.map(packet => packet.name), ["auth-local-ci-report.json", "auth-local-ci-identity-rls-report.json", "auth-local-ci-events-report.json", "auth-local-ci-capture-task-report.json"]);
  const values = packets.map(packet => JSON.parse(packet.bytes));
  assert.equal(values[0].failurePoint, "LOGIN_DOCUMENT");
  assert.deepEqual(values.slice(1).map(value => [value.status, value.code]), Array.from({ length: 3 }, () => ["not-run", "DEPENDENCY_NOT_RUN"]));
  assert.equal(packets.every(packet => packet.bytes.length <= 16_384), true);
});

test("complete Auth alone cannot invent an auxiliary PASS", () => {
  const value = reports();
  value.auth = { ...value.auth, status: "passed", code: "PASSED", failurePoint: null, stages: AUTH_IDENTITY_STAGES.map(name => ({ name, passed: true })), checks: Object.fromEntries(AUTH_IDENTITY_CHECKS.map(key => [key, true])) };
  const packets = serializeIdentityReports(value).map(packet => JSON.parse(packet.bytes));
  assert.equal(packets[0].status, "passed"); assert.equal(packets.slice(1).every(packet => packet.status === "not-run"), true);
});

test("unknown provider fields and inconsistent auxiliary metadata are refused before serialization", () => {
  for (const mutate of [value => { value.auth.raw = "excluded"; }, value => { value.events.status = "passed"; }, value => { value.identityRls.scenario = "password-change"; }, value => { value.captureTask.raw = "excluded"; }, value => { value.captureTask.status = "passed"; }, value => { delete value.captureTask; }]) {
    const value = JSON.parse(JSON.stringify(reports())); mutate(value);
    assert.throws(() => serializeIdentityReports(value), { message: "REPORT_WRITE_FAILED" });
  }
});

test("top-level getters are rejected without executing fixture-bearing code", () => {
  for (const key of ["auth", "identityRls", "events", "captureTask"]) {
    const value = reports(); let called = false;
    Object.defineProperty(value, key, { enumerable: true, get: () => { called = true; return reports()[key]; } });
    assert.throws(() => serializeIdentityReports(value), { message: "REPORT_WRITE_FAILED" }); assert.equal(called, false);
  }
});

test("untrusted object traps cannot publish their exception while rejecting metadata", () => {
  for (const trap of ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor"]) {
    const value = new Proxy(reports(), { [trap]() { throw new Error("synthetic-private-provider-error"); } });
    assert.throws(() => serializeIdentityReports(value), { message: "REPORT_WRITE_FAILED" });
  }
});

test("a sticky persistence outcome is serialized independently of an Auth result", () => {
  const value = reports(); value.captureTask = assembleCaptureTaskPacket({ report: null, writeOutcomeUncertain: true });
  const packets = serializeIdentityReports(value).map(packet => JSON.parse(packet.bytes));
  assert.equal(packets[0].cleanupConfirmed, true);
  assert.equal(packets[3].status, "failed"); assert.equal(packets[3].code, "WRITE_OUTCOME_UNCERTAIN");
  assert.equal(packets[3].writeOutcomeUncertain, true);
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
    const value = reports(); value.captureTask = { ...value.captureTask, raw: "excluded" };
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
    assert.equal((await readdir(own)).length, 4);
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

test("a colliding fourth file preserves all earlier packets and the exact existing component", { skip: process.platform === "win32" }, async () => {
  await temporary(async (runnerTemp, own) => {
    const auxiliary = join(own, "auth-local-ci-capture-task-report.json"); await writeFile(auxiliary, "existing", { mode: 0o600 });
    await assert.rejects(writeIdentityReports({ runnerTemp, reportPath: join(own, "auth-local-ci-report.json") }, reports()), { message: "REPORT_WRITE_FAILED" });
    assert.equal(await readFile(auxiliary, "utf8"), "existing");
    const present = await readdir(own); assert.equal(present.length, 4);
    for (const filename of ["auth-local-ci-report.json", "auth-local-ci-identity-rls-report.json", "auth-local-ci-events-report.json"]) {
      assert.equal(typeof JSON.parse(await readFile(join(own, filename), "utf8")).status, "string");
    }
  });
});
