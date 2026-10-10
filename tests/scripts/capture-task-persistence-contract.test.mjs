import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  CAPTURE_TASK_PACKET_FILE, CAPTURE_TASK_PACKET_KEYS, CAPTURE_TASK_PACKET_CODES, CAPTURE_TASK_REPORT_KEYS,
  CAPTURE_TASK_STAGES, CAPTURE_TASK_CHECKS, CAPTURE_TASK_COUNT_LIMITS, CAPTURE_TASK_PASS_COUNTS,
  CAPTURE_TASK_FAILURE_CODES, CAPTURE_TASK_FAILURE_POINTS,
  validateCaptureTaskPersistenceReport, assembleCaptureTaskPacket, validateCaptureTaskPacket,
} from "../e2e-auth-local/capture-task-persistence-contract.mjs";
import {
  CAPTURE_NATIVE_STAGES, CAPTURE_NATIVE_CHECKS, CAPTURE_NATIVE_COUNT_LIMITS, CAPTURE_NATIVE_PASS_COUNTS, CAPTURE_NATIVE_FAILURE_CODES,
} from "../e2e-auth-local/capture-task-persistence-support.mjs";

const clone = value => structuredClone(value);
const checkStages = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10];
const rows = [
  [3, 1, 2, 0, 0, 0, 0], [7, 4, 3, 1, 1, 1, 0], [11, 7, 4, 2, 2, 2, 0],
  [18, 10, 8, 3, 3, 3, 0], [21, 13, 8, 4, 4, 3, 1], [24, 16, 8, 4, 5, 3, 2],
  [28, 19, 9, 5, 6, 4, 2], [32, 22, 10, 6, 7, 5, 2], [36, 25, 11, 7, 8, 6, 2],
  [40, 28, 12, 8, 9, 7, 2], [45, 29, 16, 8, 9, 7, 2],
];
const numericKeys = ["requests", "rpcRequests", "publicRequests", "coreCommands", "commitAttempts", "committedReplies", "replayedReplies"];
const passed = () => ({ schemaVersion: 1, scenario: "capture-task-persistence", status: "passed", code: "PASSED", failurePoint: null,
  stages: CAPTURE_TASK_STAGES.map(name => ({ name, passed: true })), counts: { ...CAPTURE_TASK_PASS_COUNTS },
  checks: Object.fromEntries(CAPTURE_TASK_CHECKS.map(name => [name, true])), writeOutcomeUncertain: false });
const failedAt = index => ({ schemaVersion: 1, scenario: "capture-task-persistence", status: "failed", code: "DOMAIN_REFUSED", failurePoint: CAPTURE_TASK_STAGES[index],
  stages: CAPTURE_TASK_STAGES.slice(0, index + 1).map((name, stage) => ({ name, passed: stage < index })),
  counts: { ...Object.fromEntries(numericKeys.map((key, ordinal) => [key, index ? rows[index - 1][ordinal] : 0])), events: 0, receipts: 0 },
  checks: Object.fromEntries(CAPTURE_TASK_CHECKS.map((name, check) => [name, checkStages[check] < index])), writeOutcomeUncertain: false });
const refusal = value => assert.throws(() => validateCaptureTaskPersistenceReport(value), { message: "CAPTURE_TASK_PACKET_REFUSED" });

test("closed persistence constants match the actual producer without importing a factory or starting IO", () => {
  assert.equal(CAPTURE_TASK_PACKET_FILE, "auth-local-ci-capture-task-report.json");
  assert.deepEqual(CAPTURE_TASK_STAGES, CAPTURE_NATIVE_STAGES); assert.deepEqual(CAPTURE_TASK_CHECKS, CAPTURE_NATIVE_CHECKS);
  assert.deepEqual(CAPTURE_TASK_COUNT_LIMITS, CAPTURE_NATIVE_COUNT_LIMITS); assert.deepEqual(CAPTURE_TASK_PASS_COUNTS, CAPTURE_NATIVE_PASS_COUNTS);
  assert.deepEqual(CAPTURE_TASK_FAILURE_CODES, CAPTURE_NATIVE_FAILURE_CODES);
  assert.deepEqual(CAPTURE_TASK_FAILURE_POINTS, [...CAPTURE_TASK_STAGES, "PREREQUISITE"]);
  assert.equal(CAPTURE_TASK_REPORT_KEYS.length, 9); assert.equal(CAPTURE_TASK_PACKET_KEYS.length, 6);
  assert.deepEqual(CAPTURE_TASK_PACKET_CODES, ["PASSED", "CAPTURE_TASK_FAILED", "DEPENDENCY_NOT_RUN", "WRITE_OUTCOME_UNCERTAIN"]);
});

test("exact complete proof projects immutable metadata without native provenance claims", () => {
  const original = passed(), snapshot = clone(original), report = validateCaptureTaskPersistenceReport(original);
  assert.deepEqual(report, original); assert.deepEqual(original, snapshot);
  assert.equal(Object.isFrozen(report), true); assert.equal(Object.isFrozen(report.counts), true);
  assert.equal(Object.isFrozen(report.stages[0]), true); assert.equal(Object.isFrozen(report.checks), true);
  assert.equal(Object.hasOwn(report, "nativeVerified"), false);
  original.counts.events = 0; assert.equal(report.counts.events, 8);
  assert.throws(() => { report.checks.coreReplayUnchanged = false; }, TypeError);
});

test("each failed stage preserves only its own ordered preceding proof and completed request budgets", () => {
  for (let index = 0; index < CAPTURE_TASK_STAGES.length; index++) {
    const report = failedAt(index); assert.deepEqual(validateCaptureTaskPersistenceReport(report), report);
    const packet = assembleCaptureTaskPacket({ report, writeOutcomeUncertain: false });
    assert.equal(packet.status, "failed"); assert.equal(packet.code, "CAPTURE_TASK_FAILED");
    assert.equal(packet.report.failurePoint, CAPTURE_TASK_STAGES[index]); assert.equal(packet.report.stages.at(-1).passed, false);
  }
});

test("unexecuted dependencies stay explicit and caller uncertainty is independently sticky", () => {
  const missing = assembleCaptureTaskPacket({ report: null, writeOutcomeUncertain: false });
  assert.deepEqual(missing, { schemaVersion: 1, scenario: "identity-data-api", status: "not-run", code: "DEPENDENCY_NOT_RUN", report: null, writeOutcomeUncertain: false });
  for (const report of [null, passed()]) {
    const packet = assembleCaptureTaskPacket({ report, writeOutcomeUncertain: true });
    assert.equal(packet.status, "failed"); assert.equal(packet.code, "WRITE_OUTCOME_UNCERTAIN"); assert.equal(packet.writeOutcomeUncertain, true);
    assert.deepEqual(validateCaptureTaskPacket(packet), packet);
  }
  const lost = failedAt(1); lost.code = "COMMIT_UNCONFIRMED"; lost.writeOutcomeUncertain = true;
  lost.counts = { requests: 6, rpcRequests: 4, publicRequests: 2, coreCommands: 1, commitAttempts: 1, committedReplies: 0, replayedReplies: 0, events: 0, receipts: 0 };
  const packet = assembleCaptureTaskPacket({ report: lost, writeOutcomeUncertain: false });
  assert.equal(packet.code, "CAPTURE_TASK_FAILED"); assert.equal(packet.writeOutcomeUncertain, true);
  assert.throws(() => validateCaptureTaskPacket({ ...packet, writeOutcomeUncertain: false }), { message: "CAPTURE_TASK_PACKET_REFUSED" });
});

test("a closed prerequisite refusal carries no staged proof or invented completion", () => {
  const value = failedAt(0); value.code = "STATE_REFUSED"; value.failurePoint = "PREREQUISITE"; value.stages = [];
  assert.deepEqual(validateCaptureTaskPersistenceReport(value), value);
  for (const mutate of [v => v.code = "SETUP_REFUSED", v => v.stages.push({ name: "BASELINE", passed: false }), v => v.checks.freshOwnBaseline = true, v => v.counts.events = 8]) {
    const invalid = clone(value); mutate(invalid); refusal(invalid);
  }
});

test("raw fields, foreign scenarios, native booleans and unknown enums never survive projection", () => {
  for (const mutate of [v => v.raw = "synthetic-private", v => v.user_id = "synthetic-owner", v => v.nativeVerified = true,
    v => v.nativeVerified = false, v => v.scenario = "capture-task-native-prototype", v => v.scenario = "password-change",
    v => v.schemaVersion = 3, v => v.status = "unknown", v => v.code = "SYNTHETIC_PROVIDER_ERROR", v => v.failurePoint = "PRIVATE_PATH",
    v => v.counts.secret = "synthetic-private", v => v.checks.unknown = true, v => v.stages[0].raw = "synthetic-private"]) {
    const value = passed(); mutate(value); refusal(value);
  }
});

test("getters are rejected at every layer without executing credential-bearing code", () => {
  for (const path of [[], ["counts"], ["checks"], ["stages", 0]]) {
    const value = passed(); const target = path.reduce((object, key) => object[key], value);
    const key = Object.keys(target)[0]; let read = false;
    Object.defineProperty(target, key, { enumerable: true, get() { read = true; throw new Error("synthetic-private"); } });
    refusal(value); assert.equal(read, false);
  }
  const value = passed(); let read = false;
  Object.defineProperty(value.stages, 0, { enumerable: true, get() { read = true; throw new Error("synthetic-private"); } });
  refusal(value); assert.equal(read, false);
});

test("nonplain objects, symbols, sparse arrays and array custom properties are refused", () => {
  const nullPrototype = Object.assign(Object.create(null), passed()); refusal(nullPrototype);
  const inherited = Object.assign(Object.create({ private: true }), passed()); refusal(inherited);
  for (const mutate of [v => v[Symbol("private")] = true, v => v.stages[Symbol("private")] = true,
    v => v.stages.extra = true, v => delete v.stages[1], v => Object.setPrototypeOf(v.stages, null),
    v => Object.defineProperty(v.counts, "requests", { value: 45, enumerable: false })]) {
    const value = passed(); mutate(value); refusal(value);
  }
});

test("PASS needs exact budgets and every real check, never counters from another scenario", () => {
  for (const key of Object.keys(CAPTURE_TASK_PASS_COUNTS)) {
    const value = passed(); value.counts[key]--; refusal(value);
  }
  for (const key of CAPTURE_TASK_CHECKS) { const value = passed(); value.checks[key] = false; refusal(value); }
  const value = passed(); value.writeOutcomeUncertain = true; refusal(value);
  for (const amount of [0, -1, NaN, Infinity, 0.1, "45", 65]) { const v = passed(); v.counts.requests = amount; refusal(v); }
});

test("failed counts retain totals, safe integers, hard caps and acknowledged-commit relations", () => {
  for (const mutate of [v => v.counts.requests = 65, v => v.counts.publicRequests = 65,
    v => v.counts.requests = 44, v => v.counts.coreCommands = 9, v => v.counts.commitAttempts = 10,
    v => v.counts.committedReplies = 8, v => v.counts.replayedReplies = 3,
    v => v.counts.commitAttempts = 6, v => { v.counts.rpcRequests = 8; v.counts.publicRequests = 37; },
    v => v.counts.receipts = 7, v => v.counts.events = 8]) {
    const value = failedAt(10); value.counts = { ...CAPTURE_TASK_PASS_COUNTS, events: 0, receipts: 0 }; mutate(value); refusal(value);
  }
});

test("completed checkpoints cannot claim later operations, missing calls or reordered stages", () => {
  for (const mutate of [v => v.stages.splice(1, 1), v => v.stages[0].name = "CREATE", v => v.stages[1].name = "BASELINE",
    v => v.stages[0].passed = false, v => v.stages[1].passed = false, v => v.stages.at(-1).passed = true,
    v => v.failurePoint = "CREATE", v => v.checks.captureRestored = false, v => v.checks.publicOwnAndForeign = true]) {
    const value = failedAt(10); mutate(value); refusal(value);
  }
  const minimumKeys = ["requests", "rpcRequests", "publicRequests", "coreCommands", "commitAttempts", "committedReplies", "replayedReplies"];
  for (const key of minimumKeys) {
    const value = failedAt(10); value.counts[key]--; if (key === "requests") value.counts.publicRequests--;
    if (key === "rpcRequests" || key === "publicRequests") value.counts.requests--;
    refusal(value);
  }
});

test("wrapper status/code and ORed uncertainty cannot be relabelled or borrow a different report", () => {
  const original = assembleCaptureTaskPacket({ report: passed(), writeOutcomeUncertain: false });
  assert.deepEqual(validateCaptureTaskPacket(original), original);
  for (const mutate of [v => v.status = "not-run", v => v.code = "CAPTURE_TASK_FAILED", v => v.report = null,
    v => v.scenario = "capture-task-persistence", v => v.schemaVersion = 2, v => v.raw = "private", v => delete v.report,
    v => v.writeOutcomeUncertain = true, v => v.report.scenario = "events-append-only"]) {
    const value = clone(original); mutate(value);
    assert.throws(() => validateCaptureTaskPacket(value), { message: "CAPTURE_TASK_PACKET_REFUSED" });
  }
  let read = false; const value = clone(original);
  Object.defineProperty(value, "report", { enumerable: true, get() { read = true; throw new Error("synthetic-private"); } });
  assert.throws(() => validateCaptureTaskPacket(value), { message: "CAPTURE_TASK_PACKET_REFUSED" }); assert.equal(read, false);
});

test("assembly requires both explicit inputs and never exposes untrusted exception text", () => {
  for (const value of [{ report: null }, { writeOutcomeUncertain: false }, { report: null, writeOutcomeUncertain: "false" },
    { report: null, writeOutcomeUncertain: false, fallback: true }]) {
    assert.throws(() => assembleCaptureTaskPacket(value), { message: "CAPTURE_TASK_PACKET_REFUSED" });
  }
});

const TYPE_SOURCE = String.raw`
import { assembleCaptureTaskPacket, validateCaptureTaskPacket, validateCaptureTaskPersistenceReport, type CaptureTaskPacket, type CaptureTaskPersistenceReport } from "../e2e-auth-local/capture-task-persistence-contract.mjs";
import type { CaptureNativeReport } from "../e2e-auth-local/capture-task-persistence-support.mjs";
import { serializeIdentityReports } from "../e2e-auth-local/identity-data-api-report-writer.mjs";
declare const produced: CaptureNativeReport;
const report: CaptureTaskPersistenceReport = produced;
const packet: CaptureTaskPacket = assembleCaptureTaskPacket({report,writeOutcomeUncertain:false});
const closed: CaptureTaskPacket = validateCaptureTaskPacket(packet);
const nativeReport: CaptureTaskPersistenceReport = validateCaptureTaskPersistenceReport(report);
serializeIdentityReports({auth:{},identityRls:{},events:{},captureTask:packet});
if (packet.status === "passed") {
 const known: false = packet.writeOutcomeUncertain;
 const point: null = packet.report.failurePoint;
 const result: "passed" = packet.report.status;
 void [known,point,result];
}
// @ts-expect-error Persistence metadata carries no transport/native provenance claims.
packet.report?.nativeVerified;
// @ts-expect-error Counts are immutable.
report.counts.events = 0;
// @ts-expect-error A caller sticky bit is mandatory.
assembleCaptureTaskPacket({report});
// @ts-expect-error A dependency must be supplied, including explicit null.
assembleCaptureTaskPacket({writeOutcomeUncertain:false});
// @ts-expect-error Reports cannot expose Auth material.
nativeReport.accessToken;
// @ts-expect-error No cross-scenario packet.
const foreign: CaptureTaskPacket = {schemaVersion:1,scenario:"password-change",status:"not-run",code:"DEPENDENCY_NOT_RUN",report:null,writeOutcomeUncertain:false};
// @ts-expect-error The fourth component is mandatory, without fallback to old writers.
serializeIdentityReports({auth:{},identityRls:{},events:{}});
void [closed,foreign];
`;
const typeFilename = fileURLToPath(new URL("./__capture-task-contract-compile-only.mts", import.meta.url)).replaceAll("\\", "/");
function diagnostics(source) {
  const options = { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, types: ["node"] };
  const host = ts.createCompilerHost(options), getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => path === typeFilename
    ? ts.createSourceFile(typeFilename, source, languageVersion, true) : getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile);
  return ts.getPreEmitDiagnostics(ts.createProgram([typeFilename], options, host)).map(value => ({ code: value.code, message: ts.flattenDiagnosticMessageText(value.messageText, " ") }));
}
test("compile-only types accept the producer and require the fourth independently typed packet", () => {
  assert.deepEqual(diagnostics(TYPE_SOURCE), []);
});
test("the compile-only gate detects an actual missing persistence component", () => {
  const result = diagnostics(TYPE_SOURCE + "\nserializeIdentityReports({auth:{},identityRls:{},events:{}});\n");
  assert.equal(result.length, 1); assert.equal(result[0].code, 2345);
});
