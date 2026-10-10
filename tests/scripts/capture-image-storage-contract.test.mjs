import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CAPTURE_IMAGE_STAGES, CAPTURE_IMAGE_CHECKS, CAPTURE_IMAGE_CLEANUP_STAGES, CAPTURE_IMAGE_FAILURE_CODES, CAPTURE_IMAGE_PASS_COUNTS, CAPTURE_IMAGE_CLEANUP_PASS_COUNTS } from "../e2e-auth-local/capture-image-storage-support.mjs";
import { CAPTURE_IMAGE_CONTRACT_STAGES, CAPTURE_IMAGE_CONTRACT_CHECKS, CAPTURE_IMAGE_CONTRACT_CLEANUP_STAGES, CAPTURE_IMAGE_CONTRACT_FAILURE_CODES, CAPTURE_IMAGE_CONTRACT_PASS_COUNTS, CAPTURE_IMAGE_CONTRACT_CLEANUP_COUNTS, CAPTURE_IMAGE_PACKET_KEYS, validateCaptureImageStorageReport, validateCaptureImageCleanupReport, assembleCaptureImageStoragePacket, validateCaptureImageStoragePacket } from "../e2e-auth-local/capture-image-storage-contract.mjs";
const passed = () => ({ schemaVersion: 1, scenario: "capture-image-storage", status: "passed", code: "PASSED", failurePoint: null, stages: CAPTURE_IMAGE_STAGES.map(name => ({ name, passed: true })), counts: { ...CAPTURE_IMAGE_PASS_COUNTS }, checks: Object.fromEntries(CAPTURE_IMAGE_CHECKS.map(key => [key, true])), measurements: { sourceBytes: 1021, finalBytes: 287, sourceWidth: 60, sourceHeight: 40, finalWidth: 40, finalHeight: 60 }, writeOutcomeUncertain: false });
const cleaned = () => ({ schemaVersion: 1, scenario: "capture-image-storage-cleanup", status: "passed", code: "PASSED", failurePoint: null, stages: CAPTURE_IMAGE_CLEANUP_STAGES.map(name => ({ name, passed: true })), counts: { ...CAPTURE_IMAGE_CLEANUP_PASS_COUNTS }, exactInventory: true, objectsAbsent: true, authDeletionAllowed: true, writeOutcomeUncertain: false });
const failedReserve = () => ({ schemaVersion: 1, scenario: "capture-image-storage", status: "failed", code: "SQL_REFUSED", failurePoint: "RESERVE", stages: [{ name: "BASELINE", passed: true }, { name: "RESERVE", passed: false }], counts: { requests: 6, rpcRequests: 2, publicRequests: 2, storageRequests: 2, signedPuts: 0, coreCommands: 0, commitAttempts: 0, sqlInspections: 0, events: 0, receipts: 0 }, checks: Object.fromEntries(CAPTURE_IMAGE_CHECKS.map((key, index) => [key, index === 0])), measurements: { sourceBytes: 0, finalBytes: 0, sourceWidth: 0, sourceHeight: 0, finalWidth: 0, finalHeight: 0 }, writeOutcomeUncertain: false });
const refused = operation => assert.throws(operation, error => error instanceof Error && error.message === "CAPTURE_IMAGE_PACKET_REFUSED");

test("contract constants match producer without inheriting execution provenance or changing schema4", async () => {
  for (const [actual, expected] of [[CAPTURE_IMAGE_CONTRACT_STAGES, CAPTURE_IMAGE_STAGES], [CAPTURE_IMAGE_CONTRACT_CHECKS, CAPTURE_IMAGE_CHECKS], [CAPTURE_IMAGE_CONTRACT_CLEANUP_STAGES, CAPTURE_IMAGE_CLEANUP_STAGES], [CAPTURE_IMAGE_CONTRACT_FAILURE_CODES, CAPTURE_IMAGE_FAILURE_CODES], [CAPTURE_IMAGE_CONTRACT_PASS_COUNTS, CAPTURE_IMAGE_PASS_COUNTS], [CAPTURE_IMAGE_CONTRACT_CLEANUP_COUNTS, CAPTURE_IMAGE_CLEANUP_PASS_COUNTS]]) { assert.deepEqual(actual, expected); assert.equal(Object.isFrozen(actual), true); }
  const source = await readFile(new URL("../e2e-auth-local/capture-image-storage-contract.mjs", import.meta.url), "utf8"); assert.equal(/\bimport\b|\bfetch\s*\(|process\s*\.\s*env|console\s*\./.test(source), false);
});
test("closed pipeline, cleanup and packet projections are recursively immutable", () => {
  const report = validateCaptureImageStorageReport(passed()), cleanup = validateCaptureImageCleanupReport(cleaned()), packet = assembleCaptureImageStoragePacket({ pipeline: report, cleanup, writeOutcomeUncertain: false });
  assert.deepEqual(Object.keys(packet), CAPTURE_IMAGE_PACKET_KEYS); assert.equal(packet.status, "passed"); assert.equal(packet.writeOutcomeUncertain, false); assert.equal(packet.authDeletionAllowed, true); assert.equal(Object.hasOwn(packet, "nativeVerified"), false); assert.equal(Object.isFrozen(packet.pipeline.measurements), true); assert.equal(Object.isFrozen(packet.cleanup.stages), true); assert.deepEqual(validateCaptureImageStoragePacket(packet), packet);
});
test("SQL_FINAL completion and both ledger counts are mandatory for pipeline PASS", () => {
  for (const mutate of [value => { value.stages.pop(); }, value => { value.checks.sqlAtomicLedger = false; }, value => { value.counts.sqlInspections = 0; }, value => { value.counts.events = 1; }, value => { value.counts.receipts = 1; }]) { const report = passed(); mutate(report); refused(() => validateCaptureImageStorageReport(report)); }
});
test("PASS refuses uncertain writes, inconsistent counters and changed measured dimensions", () => {
  for (const mutate of [value => { value.writeOutcomeUncertain = true; }, value => { value.counts.requests++; }, value => { value.counts.rpcRequests++; value.counts.requests++; }, value => { value.measurements.finalWidth = 60; }, value => { value.measurements.sourceBytes = Infinity; }, value => { value.measurements.finalBytes = -1; }]) { const report = passed(); mutate(report); refused(() => validateCaptureImageStorageReport(report)); }
});
test("failure prefix cannot claim later checks, ledger counts or metadata from uncompleted processing", () => {
  assert.equal(validateCaptureImageStorageReport(failedReserve()).status, "failed");
  for (const mutate of [value => { value.checks.finalBytesExifFree = true; }, value => { value.counts.events = 2; }, value => { value.counts.sqlInspections = 1; }, value => { value.measurements.finalBytes = 287; }, value => { value.stages[1].name = "CLAIM"; }, value => { value.stages.push({ name: "SIGNED_PUT", passed: true }); }]) { const report = failedReserve(); mutate(report); refused(() => validateCaptureImageStorageReport(report)); }
});
test("missing cleanup stays dependency-not-run and caller uncertainty always removes Auth deletion permission", () => {
  const pending = assembleCaptureImageStoragePacket({ pipeline: passed(), cleanup: null, writeOutcomeUncertain: false }); assert.equal(pending.status, "not-run"); assert.equal(pending.authDeletionAllowed, false);
  const uncertain = assembleCaptureImageStoragePacket({ pipeline: passed(), cleanup: cleaned(), writeOutcomeUncertain: true }); assert.equal(uncertain.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(uncertain.writeOutcomeUncertain, true); assert.equal(uncertain.authDeletionAllowed, false);
  refused(() => validateCaptureImageStoragePacket({ ...uncertain, status: "passed", code: "PASSED", authDeletionAllowed: true }));
});
test("cleanup PASS requires both ACK/absence stages but allows an exactly absent partial pipeline", () => {
  const absent = cleaned(); absent.counts.removedObjects = 0; assert.equal(validateCaptureImageCleanupReport(absent).status, "passed");
  const failed = assembleCaptureImageStoragePacket({ pipeline: failedReserve(), cleanup: absent, writeOutcomeUncertain: false }); assert.equal(failed.status, "failed"); assert.equal(failed.code, "PIPELINE_FAILED"); assert.equal(failed.authDeletionAllowed, true);
  refused(() => assembleCaptureImageStoragePacket({ pipeline: passed(), cleanup: absent, writeOutcomeUncertain: false }));
  for (const mutate of [value => { value.stages.pop(); }, value => { value.counts.absenceReads = 1; value.counts.requests = 3; }, value => { value.objectsAbsent = false; }, value => { value.authDeletionAllowed = false; }, value => { value.writeOutcomeUncertain = true; }]) { const report = cleaned(); mutate(report); refused(() => validateCaptureImageCleanupReport(report)); }
});
test("unknown pipeline cannot be paired with cleanup success or a missing pipeline", () => {
  const pipeline = failedReserve(); pipeline.writeOutcomeUncertain = true; pipeline.code = "TRANSPORT_FAILED"; refused(() => assembleCaptureImageStoragePacket({ pipeline, cleanup: cleaned(), writeOutcomeUncertain: false })); refused(() => assembleCaptureImageStoragePacket({ pipeline: null, cleanup: cleaned(), writeOutcomeUncertain: false }));
  const empty = assembleCaptureImageStoragePacket({ pipeline: null, cleanup: null, writeOutcomeUncertain: false }); assert.equal(empty.code, "DEPENDENCY_NOT_RUN"); assert.equal(empty.authDeletionAllowed, false);
});
test("pipeline codes denoting an unknown write refuse a false uncertainty latch", () => {
  for (const code of ["WRITE_OUTCOME_UNCERTAIN", "COMMIT_UNCONFIRMED"]) {
    const pipeline = failedReserve(); pipeline.code = code;
    refused(() => validateCaptureImageStorageReport(pipeline));
  }
});
test("cleanup codes denoting an unknown write refuse a false uncertainty latch", () => {
  for (const code of ["WRITE_OUTCOME_UNCERTAIN", "COMMIT_UNCONFIRMED"]) {
    const cleanup = { ...cleaned(), status: "failed", code, failurePoint: "STAGING_REMOVE", stages: [{ name: "STAGING_REMOVE", passed: false }], counts: { requests: 1, removeRequests: 1, absenceReads: 0, removedObjects: 0 }, exactInventory: false, objectsAbsent: false, authDeletionAllowed: false };
    refused(() => validateCaptureImageCleanupReport(cleanup));
  }
});
test("unknown-write codes cannot authorize Auth deletion through known partial cleanup", () => {
  const absent = cleaned(); absent.counts.removedObjects = 0;
  for (const code of ["WRITE_OUTCOME_UNCERTAIN", "COMMIT_UNCONFIRMED"]) {
    const pipeline = failedReserve(); pipeline.code = code;
    refused(() => assembleCaptureImageStoragePacket({ pipeline, cleanup: absent, writeOutcomeUncertain: false }));
  }
});
test("true uncertainty remains sticky for both unknown-write codes and denies Auth deletion", () => {
  const cleanup = { schemaVersion: 1, scenario: "capture-image-storage-cleanup", status: "failed", code: "WRITE_OUTCOME_UNCERTAIN", failurePoint: "PREREQUISITE", stages: [], counts: { requests: 0, removeRequests: 0, absenceReads: 0, removedObjects: 0 }, exactInventory: false, objectsAbsent: false, authDeletionAllowed: false, writeOutcomeUncertain: true };
  for (const code of ["WRITE_OUTCOME_UNCERTAIN", "COMMIT_UNCONFIRMED"]) {
    const pipeline = failedReserve(); pipeline.code = code; pipeline.writeOutcomeUncertain = true;
    assert.equal(validateCaptureImageStorageReport(pipeline).writeOutcomeUncertain, true);
    assert.equal(validateCaptureImageCleanupReport(cleanup).writeOutcomeUncertain, true);
    const packet = assembleCaptureImageStoragePacket({ pipeline, cleanup, writeOutcomeUncertain: false });
    assert.equal(packet.status, "failed"); assert.equal(packet.writeOutcomeUncertain, true); assert.equal(packet.authDeletionAllowed, false);
    assert.deepEqual(validateCaptureImageStoragePacket(packet), packet);
  }
});
test("extra keys, symbols, accessors, sparse stages and custom prototypes are refused without evaluating data getters", () => {
  const secret = "synthetic-private-message"; let calls = 0;
  for (const mutate of [value => { value.nativeVerified = true; }, value => { value[Symbol("private")] = secret; }, value => { Object.defineProperty(value, "counts", { enumerable: true, get() { calls++; throw new Error(secret); } }); }, value => { delete value.stages[0]; }, value => { Object.setPrototypeOf(value, { private: secret }); }]) { const report = passed(); mutate(report); refused(() => validateCaptureImageStorageReport(report)); }
  assert.equal(calls, 0); const trap = new Proxy({}, { getPrototypeOf() { throw new Error(secret); } }); refused(() => validateCaptureImageStoragePacket(trap)); refused(() => validateCaptureImageCleanupReport(trap));
});
test("packet cannot smuggle URL, token, SQL, arbitrary status or promoted cleanup authority", () => {
  const packet = assembleCaptureImageStoragePacket({ pipeline: passed(), cleanup: null, writeOutcomeUncertain: false });
  for (const mutate of [value => { value.url = "http://127.0.0.1:54321/private"; }, value => { value.token = "synthetic-capability"; }, value => { value.sql = "select *"; }, value => { value.status = "passed"; value.code = "PASSED"; }, value => { value.authDeletionAllowed = true; }]) { const report = structuredClone(packet); mutate(report); refused(() => validateCaptureImageStoragePacket(report)); }
});
