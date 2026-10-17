/** Active-close source-only reader. Null binding/false gate prohibit every capture port. */
import { createHash } from "node:crypto";
import { isUtf8 } from "node:buffer";
import { types } from "node:util";
import { execFileSync } from "node:child_process";
import { readFile, lstat, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateActiveCloseReport } from "../../Segundo-Cerebro/scripts/verification/browser-active-close-probe.mjs";

export const PREPARED_BINDING = null;
export const EXECUTE_READY = false;
export const REPOSITORY = "kauanbarateli/Segundo-Cerebro";
export const MAX_BYTES = 4 * 1024 * 1024;
export const SOURCE_SHA = "8084c3988b34f8973c72178aab446bdaecffa014";
export const SOURCE_PINS = Object.freeze([
  [".github/workflows/browser-active-close-probe.yml", 1440, "62680fd584a939b4451b3b8641fea65fdea6c79ad68c5cbc635cc4269dd602dc"],
  ["scripts/verification/browser-active-close-probe.mjs", 31380, "f573f1fb4efbcdbce75361c5adebf818a28e463bf32c08c532b65cae86e4fc6f"],
  ["scripts/verification/browser-quiescence-fence-probe.mjs", 36475, "580720c195ae79e09ec2ee39f19990d82998d48889ee15ed54464d69713130da"],
  ["scripts/verification/browser-redirect-drain-probe.mjs", 30674, "925cea876490f0977c91a85e8dca01042a100ec662b72c3684b8618e5529d5b7"],
  ["tests/e2e-auth-local/admin-browser-support.mjs", 68394, "794d5c5fe5e16e431a3506b36c0893cad82dd8bf0f03d5876da0a9947884e436"],
  ["tests/e2e-auth-local/admin-browser-contract.mjs", 16995, "adfa26f4e214187abde22b615caf44a0d925c411a7bbc83109e4421b5a9f2841"],
  ["package-lock.json", 325125, "f35dd10194b2b7c3ead7f79b811638f9f36b4c92ea4ce041c4b0e8e94468c38a"],
].map(Object.freeze));
const HELPER_PINS = Object.freeze([
  ["../../Segundo-Cerebro/work/fetch-original-ci-job-20261016.mjs", 7330, "189d72ba04c15f7e6f2c6f513ef63b8f7fafd0114d8ff8162bc50514f670ce7c"],
  ["../../Segundo-Cerebro-review-pr39/work/capture-private-output-20261013.mjs", 12318, "e7a3492f00c7cdcea0c41e0134dce9f42871c0bcf09bd4d2bce51766c8f18431"],
].map(Object.freeze));
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), MAIN = resolve(ROOT, "../Segundo-Cerebro");
const PRIVATE_PARENT = "C:\\Users\\Kauan Sousa Barateli\\SegundoCerebro-Operations";
const SYNC_ROOT = "C:\\Users\\Kauan Sousa Barateli\\OneDrive", SYSTEM_ROOT = "C:\\Windows";
const CODES = new Set(["ARGUMENTS_REFUSED", "BINDING_REFUSED", "METADATA_REFUSED", "SOURCE_REFUSED", "FRAME_REFUSED", "FRAME_MISSING", "FRAME_AMBIGUOUS", "REPORT_REFUSED", "CONCLUSION_REFUSED", "OUTPUT_EXISTS", "PRIVATE_PATH_REFUSED", "PRIVATE_WRITE_REFUSED", "GH_READ_REFUSED", "GIT_READ_REFUSED", "CAPTURE_REFUSED"]);
const SHORT_CODES = new Set(["CASE_TIMEOUT", "CLOCK_REFUSED", "REQUEST_REFUSED", "LIMIT_REFUSED", "SOURCE_REFUSED", "TRANSPORT_REFUSED", "CLEANUP_UNCONFIRMED", "ENVIRONMENT_REFUSED", "ARGUMENTS_REFUSED", "PROBE_REFUSED", "PROTOCOL_UNAVAILABLE", "OWNED_CLOSE_UNCONFIRMED", "ORIGINAL_READ_PENDING", "ORIGINAL_TERMINALS_BEFORE_CLOSE"]);
const FIELDS = Object.freeze(["schemaVersion", "repository", "sourceSha", "runId", "attempt", "workflowId", "workflowPath", "workflowName", "event", "runCreatedAt", "runUpdatedAt", "attemptCreatedAt", "attemptUpdatedAt", "jobId", "jobName", "jobStartedAt", "jobCompletedAt", "stepNumber", "sourceStepIndex", "stepCount", "stepName", "startedAt", "completedAt", "conclusion"]);
const WRITE = Object.freeze({ flag: "wx", mode: 0o600 });
const digest = value => createHash("sha256").update(value).digest("hex");
const refuse = code => { throw new Error(CODES.has(code) ? code : "CAPTURE_REFUSED"); };
function own(value, key, code = "BINDING_REFUSED") {
  try { if (!value || types.isProxy(value)) refuse(code); const d = Object.getOwnPropertyDescriptor(value, key); if (!d?.enumerable || !Object.hasOwn(d, "value")) refuse(code); return d.value; } catch { refuse(code); }
}
function record(value, keys, code = "BINDING_REFUSED") {
  try { if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) refuse(code); return Object.fromEntries(keys.map(key => [key, own(value, key, code)])); } catch { refuse(code); }
}
function array(value, limit = 64) {
  try { if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) refuse("BINDING_REFUSED"); const d = Object.getOwnPropertyDescriptors(value), n = d.length?.value; if (!Number.isSafeInteger(n) || n < 0 || n > limit || Reflect.ownKeys(d).length !== n + 1) refuse("BINDING_REFUSED"); return Array.from({ length: n }, (_v, i) => own(value, String(i))); } catch { refuse("BINDING_REFUSED"); }
}
function safeCode(error) { try { const d = error && !types.isProxy(error) && Object.getOwnPropertyDescriptor(error, "message"); return d && Object.hasOwn(d, "value") && CODES.has(d.value) ? d.value : "CAPTURE_REFUSED"; } catch { return "CAPTURE_REFUSED"; } }
function bytes(value, limit = MAX_BYTES) {
  if (types.isProxy(value) || !Buffer.isBuffer(value) || value.length === 0 || value.length > limit || !isUtf8(value)) refuse("FRAME_REFUSED");
  return value;
}

/** Explicit argument is a pure review seam; capture always gates the constant. */
export function assertPreparedBinding(input = PREPARED_BINDING) {
  const b = record(input, FIELDS);
  if (b.schemaVersion !== 1 || b.repository !== REPOSITORY || b.sourceSha !== SOURCE_SHA || b.attempt !== 1 || b.workflowId !== 387273502 || b.workflowPath !== ".github/workflows/browser-active-close-probe.yml" || b.workflowName !== "Diagnostico publico de close ativo e drain" || b.event !== "workflow_dispatch" || b.jobName !== "browser-active-close-probe" || b.stepName !== "Close ativo e drain em fixture publica" || !["success", "failure"].includes(b.conclusion) || ![b.runId, b.workflowId, b.jobId, b.stepNumber, b.stepCount].every(n => Number.isSafeInteger(n) && n > 0) || b.stepCount > 64 || !Number.isSafeInteger(b.sourceStepIndex) || b.sourceStepIndex < 0 || b.sourceStepIndex >= b.stepCount) refuse("BINDING_REFUSED");
  const times = [b.runCreatedAt, b.jobStartedAt, b.startedAt, b.completedAt, b.jobCompletedAt, b.runUpdatedAt];
  if ([...times, b.attemptCreatedAt, b.attemptUpdatedAt].some(v => typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v) || !Number.isFinite(Date.parse(v))) || times.some((v, i) => i > 0 && Date.parse(v) < Date.parse(times[i - 1])) || Date.parse(b.attemptCreatedAt) > Date.parse(b.jobStartedAt) || Date.parse(b.attemptUpdatedAt) < Date.parse(b.jobCompletedAt) || Date.parse(b.startedAt) + 1000 >= Date.parse(b.completedAt)) refuse("BINDING_REFUSED");
  return Object.freeze(b);
}
function gate() { const b = assertPreparedBinding(); if (EXECUTE_READY !== true) refuse("CAPTURE_REFUSED"); return b; }
export function parseArguments(argv) {
  const b = gate(), args = array(argv, 64);
  if (args.length !== 4 || args[0] !== "--capture" || args[1] !== b.sourceSha || args[2] !== String(b.runId) || args[3] !== "1") refuse("ARGUMENTS_REFUSED");
  return b;
}

/** Original REST run/attempt/job only. API extras are never evaluated. */
export function validatePreparedMetadata(input, binding = PREPARED_BINDING) {
  const b = assertPreparedBinding(binding), m = record(input, ["run", "attempt", "jobs"], "METADATA_REFUSED");
  const expected = { id: b.runId, head_sha: b.sourceSha, run_attempt: 1, path: b.workflowPath, name: b.workflowName, workflow_id: b.workflowId, event: b.event, status: "completed", conclusion: b.conclusion, html_url: `https://github.com/${REPOSITORY}/actions/runs/${b.runId}` };
  try {
    for (const [r, created, updated] of [[m.run, b.runCreatedAt, b.runUpdatedAt], [m.attempt, b.attemptCreatedAt, b.attemptUpdatedAt]]) {
      if (own(own(r, "repository"), "full_name") !== REPOSITORY || own(r, "created_at") !== created || own(r, "updated_at") !== updated) refuse("METADATA_REFUSED");
      for (const [key, value] of Object.entries(expected)) if (own(r, key) !== value) refuse("METADATA_REFUSED");
    }
    const jobs = array(own(m.jobs, "jobs"), 100);
    if (own(m.jobs, "total_count") !== jobs.length) refuse("METADATA_REFUSED");
    const matches = jobs.filter(j => own(j, "id") === b.jobId && own(j, "name") === b.jobName);
    if (matches.length !== 1) refuse("METADATA_REFUSED"); const j = matches[0];
    for (const [key, value] of Object.entries({ id: b.jobId, run_id: b.runId, run_attempt: 1, head_sha: b.sourceSha, name: b.jobName, status: "completed", conclusion: b.conclusion, started_at: b.jobStartedAt, completed_at: b.jobCompletedAt })) if (own(j, key) !== value) refuse("METADATA_REFUSED");
    const steps = array(own(j, "steps")), numbers = steps.map(s => own(s, "number"));
    if (steps.length !== b.stepCount || numbers.some((n, i) => !Number.isSafeInteger(n) || n < 1 || i > 0 && n <= numbers[i - 1])) refuse("METADATA_REFUSED"); const s = steps[b.sourceStepIndex];
    for (const [key, value] of Object.entries({ number: b.stepNumber, name: b.stepName, status: "completed", conclusion: b.conclusion, started_at: b.startedAt, completed_at: b.completedAt })) if (own(s, key) !== value) refuse("METADATA_REFUSED");
    return b;
  } catch { refuse("METADATA_REFUSED"); }
}
function fullReportExit(report) {
  const clean = c => ["server", "context", "browser", "session"].every(k => ["absent", "close_observed"].includes(c[k])) && c.socketsClosed === true && c.startupSettled === true && c.actionsSettled === true && c.handlersSettled === true;
  return report.controlQualified && report.cases.every(c => ["CONTROL_PASSED", "DRAINED"].includes(c.outcome) && clean(c.cleanup)) ? "success" : "failure";
}

/** One original JSON in [start + 1000 ms, end), without synthesized labels. */
export function projectProbeStep(raw, binding = PREPARED_BINDING) {
  const b = assertPreparedBinding(binding), text = bytes(raw).toString("utf8");
  if (text.includes("\0")) refuse("FRAME_REFUSED");
  const start = Date.parse(b.startedAt) + 1000, end = Date.parse(b.completedAt), pattern = /"scenario"\s*:\s*"browser-active-close-probe"/;
  const candidates = text.split(/\r?\n/).filter(line => { const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,9}Z) /.exec(line); if (!m) return false; const at = Date.parse(m[1]); return Number.isFinite(at) && at >= start && at < end && pattern.test(line); });
  if (!candidates.length) refuse("FRAME_MISSING"); if (candidates.length !== 1) refuse("FRAME_AMBIGUOUS");
  const frame = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,9}Z) (\{.*\})$/.exec(candidates[0]);
  if (!frame || Buffer.byteLength(frame[2]) > 16384) refuse("FRAME_REFUSED");
  let input; try { input = JSON.parse(frame[2]); if (JSON.stringify(input) !== frame[2]) refuse("FRAME_REFUSED"); } catch { refuse("FRAME_REFUSED"); }
  const keys = Reflect.ownKeys(input ?? {});
  if (keys.length === 5 && ["schemaVersion", "scenario", "code", "diagnosticOnly", "applicationAccepted"].every(k => keys.includes(k))) {
    if (input.schemaVersion !== 1 || input.scenario !== "browser-active-close-probe" || input.diagnosticOnly !== true || input.applicationAccepted !== false || !SHORT_CODES.has(input.code)) refuse("REPORT_REFUSED");
    if (b.conclusion !== "failure") refuse("CONCLUSION_REFUSED");
    return Object.freeze({ kind: "short-refusal", report: Object.freeze(input) });
  }
  let report; try { report = validateActiveCloseReport(input); } catch { refuse("REPORT_REFUSED"); }
  if (report.mode !== "native" || report.sourceSha !== b.sourceSha) refuse("REPORT_REFUSED");
  if (fullReportExit(report) !== b.conclusion) refuse("CONCLUSION_REFUSED");
  return Object.freeze({ kind: "full-native", report });
}
function outputNames(b) {
  const prefix = `sc-browser-active-close-probe-${b.sourceSha.slice(0, 7)}-${b.runId}-a1-20261017-`;
  return Object.freeze(Object.fromEntries(["claim", "raw", "status", "report", "summary"].map(k => [k, prefix + k + (k === "raw" ? ".log" : ".json")])));
}

/** Constant gate is first; injected ports do not turn the preparation operative. */
export async function runPreparedCapture(config, ports) {
  gate(); const c = record(config, ["argv"], "ARGUMENTS_REFUSED"), b = parseArguments(c.argv);
  const p = record(ports, ["ensure", "source", "metadata", "logs", "write"]);
  if (Object.values(p).some(value => typeof value !== "function")) refuse("CAPTURE_REFUSED");
  const names = outputNames(b), values = Object.values(names); let raw;
  try {
    await p.ensure(values);
    for (const [path, length, sha] of SOURCE_PINS) {
      const row = record(await p.source(path), ["git", "local"], "SOURCE_REFUSED");
      for (const value of [row.git, row.local]) if (!Buffer.isBuffer(value) || value.length !== length || digest(value) !== sha) refuse("SOURCE_REFUSED");
    }
    const first = validatePreparedMetadata(await p.metadata()), second = validatePreparedMetadata(await p.metadata());
    if (JSON.stringify(first) !== JSON.stringify(second)) refuse("METADATA_REFUSED");
    await p.ensure(values);
    await p.write(names.claim, JSON.stringify({ schemaVersion: 1, sourceSha: b.sourceSha, runId: b.runId, attempt: 1, jobId: b.jobId, stepNumber: b.stepNumber, sourceStepIndex: b.sourceStepIndex, purpose: "once-only-browser-active-close-observation" }) + "\n", WRITE);
    raw = await p.logs({ jobId: b.jobId, timeoutMs: 45000, maxBytes: MAX_BYTES }); bytes(raw);
    const rawSha256 = digest(raw); await p.write(names.raw, raw.toString("utf8"), WRITE);
    // A rerun or metadata change after download vetoes every report projection.
    const third = validatePreparedMetadata(await p.metadata());
    if (JSON.stringify(first) !== JSON.stringify(third)) refuse("METADATA_REFUSED");
    const status = JSON.stringify(third, null, 2) + "\n"; await p.write(names.status, status, WRITE);
    const projection = projectProbeStep(raw), report = JSON.stringify(projection.report, null, 2) + "\n";
    await p.write(names.report, report, WRITE);
    const summary = { schemaVersion: 1, scenario: "browser-active-close-native-observation", sourceSha: b.sourceSha, runId: b.runId, attempt: 1, jobId: b.jobId, stepNumber: b.stepNumber, sourceStepIndex: b.sourceStepIndex, sourceChannel: "original-job-rest-step-window", reportKind: projection.kind, report: projection.report, rawSha256, statusSha256: digest(status), reportSha256: digest(report), diagnosticOnly: true, applicationAccepted: false, automaticIssueAcceptance: false };
    await p.write(names.summary, JSON.stringify(summary, null, 2) + "\n", WRITE); return summary;
  } catch (error) { refuse(safeCode(error)); }
  finally { if (!types.isProxy(raw) && Buffer.isBuffer(raw)) raw.fill(0); }
}

function call(program, args, limit) { try { return execFileSync(program, args, { cwd: MAIN, shell: false, windowsHide: true, timeout: 30000, maxBuffer: limit, stdio: ["ignore", "pipe", "pipe"] }); } catch { refuse(program === "gh" ? "GH_READ_REFUSED" : "GIT_READ_REFUSED"); } }
async function publicFile(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || await realpath(path) !== path) refuse("SOURCE_REFUSED");
  return readFile(path);
}
async function nativePorts() {
  const b = gate(), names = Object.values(outputNames(b));
  if (process.platform !== "win32" || !process.env.GH_TOKEN || process.env.GH_HOST !== "github.com") refuse("CAPTURE_REFUSED");
  for (const [path, size, sha] of HELPER_PINS) { const value = await publicFile(resolve(dirname(fileURLToPath(import.meta.url)), path)); if (value.length !== size || digest(value) !== sha) refuse("SOURCE_REFUSED"); }
  const { fetchOriginalJobLogs } = await import(pathToFileURL(resolve(MAIN, "work/fetch-original-ci-job-20261016.mjs")).href);
  const { createPrivateCaptureOutput } = await import(pathToFileURL(resolve(ROOT, "../Segundo-Cerebro-review-pr39/work/capture-private-output-20261013.mjs")).href);
  const output = await createPrivateCaptureOutput({ names, parentRoot: PRIVATE_PARENT, sourceRoots: [ROOT, MAIN], syncRoots: [SYNC_ROOT], systemRoot: SYSTEM_ROOT });
  const api = path => { try { return JSON.parse(call("gh", ["api", "--method", "GET", path], 1048576).toString("utf8")); } catch { refuse("GH_READ_REFUSED"); } };
  return { ports: {
    ensure: values => output.ensure(values),
    source: async path => ({ git: call("git", ["show", b.sourceSha + ":" + path], 1048576), local: await publicFile(resolve(MAIN, path)) }),
    metadata: async () => ({ run: api(`repos/${REPOSITORY}/actions/runs/${b.runId}`), attempt: api(`repos/${REPOSITORY}/actions/runs/${b.runId}/attempts/1`), jobs: api(`repos/${REPOSITORY}/actions/runs/${b.runId}/attempts/1/jobs`) }),
    logs: options => fetchOriginalJobLogs(options.jobId, process.env.GH_TOKEN, { timeoutMs: options.timeoutMs, maxBytes: options.maxBytes }),
    write: (name, content, options) => output.write(name, content, options),
  }, dispose: () => output.dispose() };
}
export async function main(argv = process.argv.slice(2), output = value => process.stdout.write(JSON.stringify(value) + "\n")) {
  if (!types.isProxy(argv) && Array.isArray(argv) && Object.getOwnPropertyDescriptor(argv, "length")?.value === 1 && Object.getOwnPropertyDescriptor(argv, "0")?.value === "--help") { output({ schemaVersion: 1, scenario: "browser-active-close-native-observation", code: "NO_CAPTURE" }); return 0; }
  let native;
  try { parseArguments(argv); native = await nativePorts(); output(await runPreparedCapture({ argv }, native.ports)); return 0; }
  catch (error) { output({ schemaVersion: 1, scenario: "browser-active-close-native-observation", captureStatus: "refused", code: safeCode(error), diagnosticOnly: true, applicationAccepted: false }); return 1; }
  finally { if (native) await native.dispose(); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
