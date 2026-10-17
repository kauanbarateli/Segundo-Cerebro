/** RAM-only controls; no network, process, browser, profile or private output. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as preparation from "./capture-active-close-preparacao-20261017.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, ".."), MAIN = resolve(ROOT, "../Segundo-Cerebro");
const SOURCE = await readFile(resolve(HERE, "capture-active-close-preparacao-20261017.mjs"), "utf8");
const SHA = preparation.SOURCE_SHA;
const BINDING = Object.freeze({ schemaVersion: 1, repository: "kauanbarateli/Segundo-Cerebro", sourceSha: SHA, runId: 1234, attempt: 1, workflowId: 387273502, workflowPath: ".github/workflows/browser-active-close-probe.yml", workflowName: "Diagnostico publico de close ativo e drain", event: "workflow_dispatch", runCreatedAt: "2026-10-16T20:00:00Z", runUpdatedAt: "2026-10-16T20:03:00Z", attemptCreatedAt: "2026-10-16T20:00:01Z", attemptUpdatedAt: "2026-10-16T20:02:59Z", jobId: 7890, jobName: "browser-active-close-probe", jobStartedAt: "2026-10-16T20:00:02Z", jobCompletedAt: "2026-10-16T20:02:58Z", stepNumber: 6, sourceStepIndex: 5, stepCount: 8, stepName: "Close ativo e drain em fixture publica", startedAt: "2026-10-16T20:01:00Z", completedAt: "2026-10-16T20:02:55Z", conclusion: "failure" });
const short = code => ({ schemaVersion: 1, scenario: "browser-active-close-probe", code, diagnosticOnly: true, applicationAccepted: false });
const line = (report = short("ENVIRONMENT_REFUSED"), at = "2026-10-16T20:01:02.1234567Z") => Buffer.from(at + " " + JSON.stringify(report) + "\n");
const clone = value => JSON.parse(JSON.stringify(value));
const COUNT_KEYS = ["requestsStarted", "targetRequests", "redirectRoots", "redirectLinks", "lineageAmbiguous", "rootRouteCallbacks", "targetRouteCallbacks", "rootRouteAcks", "targetRouteAcks", "serverReceived", "redirectReceived", "redirectResponsesFinished", "responsesFinished", "publicFinished", "publicFailed", "pendingRequests", "socketsCreated", "socketsClosed", "socketsLive", "handlersStarted", "handlersSettled", "handlersPending", "fenceReadAborts", "fenceAbortAcks", "unknownRequests", "downloads", "popups"];
const CASES = ["control", "direct-active-close"];
const absentProtocol = () => ({ identity: "unavailable", order: "unavailable", terminal: "unavailable", publicTerminal: "unavailable", managerEntry: "unavailable", sessionRegistered: "unavailable", fetchCommand: "unavailable", fetchOutcome: "unavailable" });
const observedProtocol = (terminal, removed = false) => ({ identity: "exact-server-request", order: terminal ? "pause-before-terminal" : "no-terminal-observed", terminal: terminal ?? "not-observed", publicTerminal: terminal ?? "not-observed", managerEntry: terminal ? "absent" : "same-request", sessionRegistered: removed ? "removed" : "registered", fetchCommand: terminal ? "unavailable" : "continue", fetchOutcome: terminal ? "unavailable" : "resolved" });
const blankSnapshot = () => ({ counts: Object.fromEntries(COUNT_KEYS.map(key => [key, 0])), finalProtocol: absentProtocol(), close: { requests: 0, events: 0, promise: "not-requested" }, actionsPending: 0 });
function fullReport() {
  return { schemaVersion: 1, scenario: "browser-active-close-probe", mode: "native", sourceSha: SHA, diagnosticOnly: true, applicationAccepted: false, controlQualified: false, cases: CASES.map((kind, i) => ({ kind, outcome: i === 0 ? "REFUSED" : "NOT_RUN", code: i === 0 ? "PROBE_REFUSED" : "CONTROL_REQUIRED", fenceArmed: false, sourceClosedBeforeDecision: false, sourceListenerAlive: false, beforeCloseObserved: false, beforeClose: blankSnapshot(), final: blankSnapshot(), ioZeroBeforeClose: false, ioZeroAfterClose: false, timing: { readyMs: null, fenceMs: null, sourceClosedMs: null, closeRequestedMs: null, closeObservedMs: null, decisionMs: null, cleanupMs: null }, cleanup: { server: "unconfirmed", context: "unconfirmed", browser: "unconfirmed", session: "unconfirmed", socketsClosed: false, startupSettled: false, actionsSettled: false, handlersSettled: false } })) };
}
function qualifiedReport() {
  const report = fullReport(); report.controlQualified = true;
  for (const [index, c] of report.cases.entries()) {
    Object.assign(c, { outcome: index === 0 ? "CONTROL_PASSED" : "DRAINED", code: index === 0 ? "CONTROL_PASSED" : "ORIGINAL_TERMINALS_AFTER_OWNED_CLOSE", fenceArmed: true, sourceClosedBeforeDecision: true, sourceListenerAlive: false, beforeCloseObserved: true, ioZeroBeforeClose: index === 0, ioZeroAfterClose: true });
    Object.assign(c.final.counts, { requestsStarted: 1, targetRequests: 1, targetRouteCallbacks: 1, targetRouteAcks: 1, serverReceived: 1, responsesFinished: index === 0 ? 1 : 0, socketsCreated: 1, socketsClosed: 1, publicFinished: index === 0 ? 1 : 0, publicFailed: index === 0 ? 0 : 1, handlersStarted: 2, handlersSettled: 2 });
    c.final.finalProtocol = observedProtocol(index === 0 ? "finished" : "failed", index !== 0);
    c.beforeClose = clone(c.final);
    if (index !== 0) { c.beforeClose.counts.publicFailed = 0; c.beforeClose.counts.pendingRequests = 1; c.beforeClose.finalProtocol = observedProtocol(); c.final.close = { requests: 1, events: 1, promise: "resolved" }; }
    c.timing = { readyMs: 10, fenceMs: 20, sourceClosedMs: 30, closeRequestedMs: index === 0 ? null : 35, closeObservedMs: index === 0 ? null : 36, decisionMs: 40, cleanupMs: 10 };
    c.cleanup = { server: "close_observed", context: "close_observed", browser: "close_observed", session: "close_observed", socketsClosed: true, startupSettled: true, actionsSettled: true, handlersSettled: true };
  }
  return report;
}
function metadata(binding = BINDING) {
  const b = binding, base = { id: b.runId, repository: { full_name: b.repository }, head_sha: b.sourceSha, run_attempt: b.attempt, path: b.workflowPath, name: b.workflowName, workflow_id: b.workflowId, event: b.event, status: "completed", conclusion: b.conclusion, html_url: `https://github.com/${b.repository}/actions/runs/${b.runId}` };
  const job = { id: b.jobId, run_id: b.runId, run_attempt: 1, head_sha: b.sourceSha, name: b.jobName, status: "completed", conclusion: b.conclusion, started_at: b.jobStartedAt, completed_at: b.jobCompletedAt, steps: Array.from({ length: b.stepCount }, (_v, i) => ({ number: i + 1, name: i === b.sourceStepIndex ? b.stepName : "Other public step", status: "completed", conclusion: i === b.sourceStepIndex ? b.conclusion : "success", started_at: b.startedAt, completed_at: b.completedAt })) };
  return { run: { ...base, created_at: b.runCreatedAt, updated_at: b.runUpdatedAt }, attempt: { ...base, created_at: b.attemptCreatedAt, updated_at: b.attemptUpdatedAt }, jobs: { total_count: 1, jobs: [job] } };
}
let revision = 0;
async function prepared(binding = BINDING, ready = true) {
  let source = SOURCE.replace('export const PREPARED_BINDING = null;', "export const PREPARED_BINDING = " + JSON.stringify(binding) + ";").replace('export const EXECUTE_READY = false;', "export const EXECUTE_READY = " + JSON.stringify(ready) + ";");
  source = source.replace('"../../Segundo-Cerebro/scripts/verification/browser-active-close-probe.mjs"', JSON.stringify(pathToFileURL(resolve(MAIN, "scripts/verification/browser-active-close-probe.mjs")).href));
  source = source.replace('const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), MAIN = resolve(ROOT, "../Segundo-Cerebro");', "const ROOT = " + JSON.stringify(ROOT) + ", MAIN = " + JSON.stringify(MAIN) + ";");
  assert.notEqual(source, SOURCE);
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64") + "#ram-control-" + revision++);
}
const preparedModule = await prepared();
const sourceRows = new Map();
for (const [path] of preparation.SOURCE_PINS) sourceRows.set(path, await readFile(resolve(MAIN, path)));
function fixture(report = short("ENVIRONMENT_REFUSED")) {
  const events = [], writes = [], raw = line(report); let metadataReads = 0;
  const ports = {
    async ensure(names) { events.push("ensure"); assert.equal(names.length, 5); assert.equal(new Set(names).size, 5); },
    async source(path) { events.push("source"); const bytes = sourceRows.get(path); assert.ok(bytes); return { git: bytes, local: Buffer.from(bytes) }; },
    async metadata() { events.push("metadata"); metadataReads++; return metadata(); },
    async logs(options) { events.push("logs"); assert.deepEqual(options, { jobId: 7890, timeoutMs: 45000, maxBytes: 4 * 1024 * 1024 }); return raw; },
    async write(name, text, options) { events.push("write:" + name.split("-").at(-1)); assert.deepEqual(options, { flag: "wx", mode: 0o600 }); assert.equal(typeof text, "string"); assert.equal(writes.some(row => row.name === name), false); writes.push({ name, text }); },
  };
  return { ports, events, writes, raw, get metadataReads() { return metadataReads; } };
}
const argv = ["--capture", SHA, "1234", "1"];
const refuses = (fn, code) => assert.throws(fn, error => error?.message === code);
const rejects = (fn, code) => assert.rejects(fn, error => error?.message === code);

test("preparation constants remain null/false and guard every port before access", async () => {
  assert.equal(preparation.PREPARED_BINDING, null); assert.equal(preparation.EXECUTE_READY, false);
  let touched = 0; const poison = new Proxy({}, { get() { touched++; throw new Error("PRIVATE_CANARY"); }, ownKeys() { touched++; throw new Error("PRIVATE_CANARY"); } });
  await rejects(() => preparation.runPreparedCapture(poison, poison), "BINDING_REFUSED"); assert.equal(touched, 0);
});
test("help is inert, and direct preparation capture returns closed refusal", async () => {
  const results = []; assert.equal(await preparation.main(["--help"], v => results.push(v)), 0); assert.equal(results[0].code, "NO_CAPTURE");
  assert.equal(await preparation.main(argv, v => results.push(v)), 1); assert.equal(results[1].code, "BINDING_REFUSED"); assert.equal(JSON.stringify(results).includes("PRIVATE_CANARY"), false);
});
test("binding validates original independent attempt dates without equating them to run dates", () => {
  assert.deepEqual(preparation.assertPreparedBinding(BINDING), BINDING);
  for (const change of [{ attempt: 2 }, { event: "push" }, { sourceSha: SHA.toUpperCase() }, { sourceSha: "f".repeat(40) }, { workflowId: 387273503 }, { sourceStepIndex: 8 }, { sourceStepIndex: -1 }, { sourceStepIndex: 1.5 }, { startedAt: BINDING.completedAt }, { attemptUpdatedAt: BINDING.startedAt }, { repository: "other/private" }]) refuses(() => preparation.assertPreparedBinding({ ...BINDING, ...change }), "BINDING_REFUSED");
});
test("binding and argv reject accessors, sparse arrays and proxies without executing getters", () => {
  let touches = 0; const bad = { ...BINDING }; Object.defineProperty(bad, "runId", { enumerable: true, get() { touches++; return 1234; } });
  refuses(() => preparation.assertPreparedBinding(bad), "BINDING_REFUSED"); refuses(() => preparation.assertPreparedBinding(new Proxy(BINDING, {})), "BINDING_REFUSED");
  const args = [...argv]; Object.defineProperty(args, "2", { enumerable: true, get() { touches++; return "1234"; } }); refuses(() => preparedModule.parseArguments(args), "BINDING_REFUSED"); assert.equal(touches, 0);
});
test("source SHA objects are refused without invoking conversion hooks", () => {
  let touches = 0; const sourceSha = { toString() { touches++; return SHA; }, [Symbol.toPrimitive]() { touches++; return SHA; } };
  refuses(() => preparation.assertPreparedBinding({ ...BINDING, sourceSha }), "BINDING_REFUSED"); assert.equal(touches, 0);
});
test("false execution gate still prevents a valid binding from touching ports", async () => {
  const m = await prepared(BINDING, false); await rejects(() => m.runPreparedCapture({ argv }, null), "CAPTURE_REFUSED");
});
test("arguments require exact source/run/attempt and no extra arguments", () => {
  assert.deepEqual(preparedModule.parseArguments(argv), BINDING);
  for (const args of [[], argv.slice(0, 3), [...argv, "extra"], ["--capture", "f".repeat(40), "1234", "1"], ["--capture", SHA, "1235", "1"], ["--capture", SHA, "1234", "2"]]) refuses(() => preparedModule.parseArguments(args), "ARGUMENTS_REFUSED");
});
test("metadata validates original run, attempt, unique job and ordered original step", () => {
  assert.deepEqual(preparation.validatePreparedMetadata(metadata(), BINDING), BINDING);
  for (const mutate of [m => { m.run.head_sha = "f".repeat(40); }, m => { m.attempt.run_attempt = 2; }, m => { m.attempt.updated_at = BINDING.runUpdatedAt; }, m => { m.jobs.jobs.push(m.jobs.jobs[0]); m.jobs.total_count = 2; }, m => { m.jobs.jobs[0].steps[5].name = "Other public step"; }, m => { m.jobs.jobs[0].steps[0].number = 2; }, m => { m.jobs.jobs[0].conclusion = "success"; }]) { const m = metadata(); mutate(m); refuses(() => preparation.validatePreparedMetadata(m, BINDING), "METADATA_REFUSED"); }
});
test("original sourceStepIndex survives gaps before and after the native step", async () => {
  const after = metadata(); after.jobs.jobs[0].steps[6].number = 44; after.jobs.jobs[0].steps[7].number = 47;
  assert.deepEqual(preparation.validatePreparedMetadata(after, BINDING), BINDING);
  const b = { ...BINDING, stepNumber: 30 }, before = metadata(b), numbers = [1, 2, 8, 10, 20, 30, 44, 47];
  before.jobs.jobs[0].steps.forEach((s, i) => { s.number = numbers[i]; });
  assert.deepEqual(preparation.validatePreparedMetadata(before, b), b);
  refuses(() => preparation.validatePreparedMetadata(before, { ...b, sourceStepIndex: 4 }), "METADATA_REFUSED");
  refuses(() => preparation.validatePreparedMetadata(before, { ...b, sourceStepIndex: 6 }), "METADATA_REFUSED");
  const duplicate = clone(before); duplicate.jobs.jobs[0].steps[6].number = 30; refuses(() => preparation.validatePreparedMetadata(duplicate, b), "METADATA_REFUSED");
  const backwards = clone(before); backwards.jobs.jobs[0].steps[6].number = 29; refuses(() => preparation.validatePreparedMetadata(backwards, b), "METADATA_REFUSED");
  const m = await prepared(b), f = fixture(); f.ports.metadata = async () => clone(before);
  const result = await m.runPreparedCapture({ argv }, f.ports); assert.equal(result.stepNumber, 30); assert.equal(result.sourceStepIndex, 5); assert.equal(JSON.parse(f.writes[0].text).sourceStepIndex, 5);
});
test("metadata API extras are not read and required accessor data is refused", () => {
  let touches = 0; const m = metadata(); Object.defineProperty(m.run, "private_extra", { get() { touches++; throw new Error("PRIVATE_CANARY"); } });
  assert.deepEqual(preparation.validatePreparedMetadata(m, BINDING), BINDING);
  Object.defineProperty(m.run, "id", { enumerable: true, get() { touches++; return 1234; } }); refuses(() => preparation.validatePreparedMetadata(m, BINDING), "METADATA_REFUSED"); assert.equal(touches, 0);
});
test("original scenario must be unique strictly within original step interior", () => {
  assert.equal(preparation.projectProbeStep(line(), BINDING).kind, "short-refusal");
  for (const at of ["2026-10-16T20:01:00.9999999Z", "2026-10-16T20:02:55.0000000Z"]) refuses(() => preparation.projectProbeStep(line(undefined, at), BINDING), "FRAME_MISSING");
  assert.equal(preparation.projectProbeStep(line(undefined, "2026-10-16T20:01:01.0000000Z"), BINDING).kind, "short-refusal");
  refuses(() => preparation.projectProbeStep(Buffer.concat([line(), line()]), BINDING), "FRAME_AMBIGUOUS");
  assert.equal(preparation.projectProbeStep(Buffer.concat([line(undefined, "2026-10-16T20:00:00.0000000Z"), line()]), BINDING).kind, "short-refusal");
});
test("synthesized labels, invalid UTF8, ANSI, NUL and over-limit frames cannot certify a report", () => {
  for (const raw of [Buffer.from("browser-active-close-probe\tUNKNOWN STEP\t" + line()), Buffer.from([0xff]), Buffer.concat([line(), Buffer.from([0])]), Buffer.alloc(4 * 1024 * 1024 + 1, 65), Buffer.from("\u001b[31m" + line())]) assert.throws(() => preparation.projectProbeStep(raw, BINDING));
});
test("short refusal has exact keys and fixed refusal enum, never provider text", () => {
  for (const report of [{ ...short("PROBE_REFUSED"), token: "PRIVATE_CANARY" }, short("PRIVATE_CANARY"), short("CONTROL_PASSED"), { ...short("PROBE_REFUSED"), applicationAccepted: true }]) refuses(() => preparation.projectProbeStep(line(report), BINDING), "REPORT_REFUSED");
  refuses(() => preparation.projectProbeStep(line(), { ...BINDING, conclusion: "success" }), "CONCLUSION_REFUSED");
});
test("full report is validated by native producer validator and exact SHA/mode", () => {
  const report = fullReport(); assert.equal(preparation.projectProbeStep(line(report), BINDING).kind, "full-native");
  for (const change of [{ sourceSha: "f".repeat(40) }, { mode: "synthetic", sourceSha: null }, { applicationAccepted: true }]) refuses(() => preparation.projectProbeStep(line({ ...report, ...change }), BINDING), "REPORT_REFUSED");
  const invalid = clone(report); invalid.cases[0].final.counts.pendingRequests = 1; refuses(() => preparation.projectProbeStep(line(invalid), BINDING), "REPORT_REFUSED");
  refuses(() => preparation.projectProbeStep(line(report), { ...BINDING, conclusion: "success" }), "CONCLUSION_REFUSED");
});
test("two-case active close report preserves two snapshots and qualified success without application acceptance", () => {
  const report = qualifiedReport(), projection = preparation.projectProbeStep(line(report), { ...BINDING, conclusion: "success" });
  assert.equal(projection.kind, "full-native"); assert.equal(projection.report.applicationAccepted, false);
  assert.deepEqual(projection.report.cases.map(c => c.kind), CASES);
  assert.equal(projection.report.cases.every(c => c.sourceClosedBeforeDecision && !c.sourceListenerAlive && c.cleanup.handlersSettled), true);
  assert.equal(projection.report.cases[1].ioZeroBeforeClose, false); assert.equal(projection.report.cases[1].ioZeroAfterClose, true); assert.equal(projection.report.cases[1].beforeClose.counts.pendingRequests, 1); assert.equal(projection.report.cases[1].final.counts.pendingRequests, 0); assert.equal(projection.report.cases[1].final.close.events, 1);
  refuses(() => preparation.projectProbeStep(line(report), BINDING), "CONCLUSION_REFUSED");
});
test("PENDING is never a qualified outcome in the active close schema", () => {
  const report = qualifiedReport(); report.cases[1].outcome = "PENDING"; report.cases[1].code = "ORIGINAL_READ_PENDING"; refuses(() => preparation.projectProbeStep(line(report), BINDING), "REPORT_REFUSED");
});
test("14999 timeout stays inconclusive even with complete terminal and close counters", () => {
  const report = qualifiedReport(); report.cases[1].outcome = "INCONCLUSIVE"; report.cases[1].code = "CASE_TIMEOUT"; report.cases[1].timing.decisionMs = 14999;
  assert.equal(preparation.projectProbeStep(line(report), BINDING).report.cases[1].code, "CASE_TIMEOUT"); refuses(() => preparation.projectProbeStep(line(report), { ...BINDING, conclusion: "success" }), "CONCLUSION_REFUSED");
});
test("native active close INCONCLUSIVE remains diagnostic failure and is never upgraded", () => {
  const report = qualifiedReport(); report.cases[1].outcome = "INCONCLUSIVE"; report.cases[1].code = "PROTOCOL_UNAVAILABLE"; report.cases[1].final.finalProtocol = absentProtocol(); report.cases[1].ioZeroAfterClose = false;
  const projection = preparation.projectProbeStep(line(report), BINDING); assert.equal(projection.report.cases[1].outcome, "INCONCLUSIVE"); assert.equal(projection.report.cases[1].code, "PROTOCOL_UNAVAILABLE"); assert.equal(projection.report.applicationAccepted, false);
  refuses(() => preparation.projectProbeStep(line(report), { ...BINDING, conclusion: "success" }), "CONCLUSION_REFUSED");
});
test("fence, handlers, actions, close and original before/after factors cannot be widened by JSON", () => {
  for (const mutate of [r => { r.cases[1].fenceArmed = false; }, r => { r.cases[1].sourceListenerAlive = true; }, r => { r.cases[1].sourceClosedBeforeDecision = false; }, r => { r.cases[1].final.counts.handlersPending = 1; }, r => { r.cases[1].final.actionsPending = 1; }, r => { r.cases[1].final.counts.unknownRequests = 1; }, r => { r.cases[1].final.close.events = 0; }, r => { r.cases[1].final.close.promise = "pending"; }, r => { r.cases[1].ioZeroBeforeClose = true; }, r => { r.cases[1].beforeClose.finalProtocol.managerEntry = "absent"; }, r => { r.cases[1].cleanup.extra = "PRIVATE_CANARY"; }]) {
    const report = qualifiedReport(); mutate(report);
    refuses(() => preparation.projectProbeStep(line(report), { ...BINDING, conclusion: "success" }), "REPORT_REFUSED");
  }
});
test("full-report exit matches producer cleanup handlersSettled and cannot turn an unconfirmed last cleanup into success", () => {
  const report = qualifiedReport(); report.cases.at(-1).cleanup.handlersSettled = false;
  refuses(() => preparation.projectProbeStep(line(report), { ...BINDING, conclusion: "success" }), "CONCLUSION_REFUSED");
  const projection = preparation.projectProbeStep(line(report), BINDING);
  assert.equal(projection.kind, "full-native"); assert.equal(projection.report.cases.at(-1).cleanup.handlersSettled, false); assert.equal(projection.report.applicationAccepted, false);
});
test("every one of the eight cleanup fields is required by the exact producer success rule", () => {
  for (const key of ["server", "context", "browser", "session", "socketsClosed", "startupSettled", "actionsSettled", "handlersSettled"]) { const report = qualifiedReport(); report.cases[1].cleanup[key] = typeof report.cases[1].cleanup[key] === "string" ? "unconfirmed" : false; assert.equal(preparation.projectProbeStep(line(report), BINDING).report.cases[1].cleanup[key], report.cases[1].cleanup[key]); refuses(() => preparation.projectProbeStep(line(report), { ...BINDING, conclusion: "success" }), "CONCLUSION_REFUSED"); }
});
test("capture checks sources and original metadata twice before claim, once after download", async () => {
  const f = fixture(), result = await preparedModule.runPreparedCapture({ argv }, f.ports);
  assert.equal(f.metadataReads, 3); assert.equal(result.reportKind, "short-refusal"); assert.equal(result.applicationAccepted, false); assert.equal(result.automaticIssueAcceptance, false);
  assert.equal(result.sourceStepIndex, BINDING.sourceStepIndex);
  assert.deepEqual(f.events.slice(0, preparation.SOURCE_PINS.length + 5), ["ensure", ...preparation.SOURCE_PINS.map(() => "source"), "metadata", "metadata", "ensure", "write:claim.json"]);
  assert.equal(f.writes.length, 5); assert.equal(f.raw.every(v => v === 0), true); assert.match(result.rawSha256, /^[a-f0-9]{64}$/);
});
test("a Buffer proxy returned by a hostile RAM port is refused without fill or getters", async () => {
  // Promise assimilation necessarily looks up `then` before the capture receives
  // the return value. Keep that language-level hook inert; every byte/fill hook
  // remains hostile, including after the capture's own refusal.
  const f = fixture(); let touches = 0; f.ports.logs = async () => new Proxy(Buffer.from("RAM fixture"), { get(_target, key) { if (key === "then") return undefined; touches++; throw new Error("PRIVATE_CANARY"); } });
  await rejects(() => preparedModule.runPreparedCapture({ argv }, f.ports), "FRAME_REFUSED"); assert.equal(touches, 0); assert.equal(f.writes.length, 1);
});
test("full native output is copied only through closed original validator projection", async () => {
  const f = fixture(fullReport()), result = await preparedModule.runPreparedCapture({ argv }, f.ports);
  assert.equal(result.reportKind, "full-native"); assert.equal(result.report.mode, "native"); assert.equal(result.report.sourceSha, SHA); assert.equal(f.raw.every(v => v === 0), true);
});
test("changed source or second metadata refuses before claim and download", async () => {
  for (const phase of ["source", "metadata"]) {
    const f = fixture(); let reads = 0;
    if (phase === "source") f.ports.source = async () => ({ git: Buffer.from("wrong"), local: Buffer.from("wrong") });
    else f.ports.metadata = async () => { const m = metadata(); if (++reads === 2) m.attempt.run_attempt = 2; return m; };
    await rejects(() => preparedModule.runPreparedCapture({ argv }, f.ports), phase === "source" ? "SOURCE_REFUSED" : "METADATA_REFUSED"); assert.equal(f.writes.length, 0); assert.equal(f.events.includes("logs"), false);
  }
});
test("third metadata change vetoes report after original raw preservation and erasure", async () => {
  const f = fixture(); let reads = 0; f.ports.metadata = async () => { const m = metadata(); if (++reads === 3) m.run.run_attempt = 2; return m; };
  await rejects(() => preparedModule.runPreparedCapture({ argv }, f.ports), "METADATA_REFUSED");
  assert.equal(f.writes.length, 2); assert.equal(f.writes[0].name.endsWith("claim.json"), true); assert.equal(f.writes[1].name.endsWith("raw.log"), true); assert.equal(f.raw.every(v => v === 0), true);
});
test("invalid report does not write report or summary, and raw is wiped on refusal", async () => {
  const f = fixture(short("PRIVATE_CANARY")); await rejects(() => preparedModule.runPreparedCapture({ argv }, f.ports), "REPORT_REFUSED");
  assert.equal(f.writes.length, 3); assert.equal(f.writes.some(row => row.name.endsWith("report.json")), false); assert.equal(f.raw.every(v => v === 0), true);
});
test("owned output exists and provider exceptions produce only fixed codes, never fallbacks", async () => {
  const f = fixture(); f.ports.ensure = async () => { throw new Error("OUTPUT_EXISTS"); }; await rejects(() => preparedModule.runPreparedCapture({ argv }, f.ports), "OUTPUT_EXISTS"); assert.equal(f.writes.length, 0);
  const g = fixture(); g.ports.logs = async () => { throw new Error("PRIVATE_CANARY"); }; await rejects(() => preparedModule.runPreparedCapture({ argv }, g.ports), "CAPTURE_REFUSED"); assert.equal(g.writes.length, 1);
  assert.equal(SOURCE.includes('gh", ["run", "view"'), false); assert.equal(SOURCE.includes("/attempts/1/jobs"), true); assert.equal(SOURCE.includes("fetchOriginalJobLogs(options.jobId"), true);
});
