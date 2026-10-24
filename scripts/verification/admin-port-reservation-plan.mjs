/** CI-only fixed-port reservation preparation. Built-ins only; import/help performs no IO. */
import { constants } from "node:fs";
import { readFile, realpath, lstat, open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname, basename, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
/** Pure planning exports never access OS. CLI IO is gated below.
 * Caller-supplied data never constitutes operational authorization. */
const PORTS = Object.freeze([54320, 54321, 54322]);
const INPUT_KEYS = ["runnerEnvironment", "runnerOs", "jobContainerId", "serviceContainerCount", "rangeText", "reservedText"];
const READBACK_KEYS = ["reservedImmediatelyBeforeWrite", "reservedAfterWrite", "rangeAfterWrite"];
const REFUSAL = "ADMIN_PORT_RESERVATION_PLAN_REFUSED";
function refuse() { const error = new Error(REFUSAL); error.code = REFUSAL; throw error; }
function record(value, keys) {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key))) refuse();
  const out = {};
  for (const key of keys) { const d = descriptors[key]; if (!d?.enumerable || !Object.hasOwn(d, "value")) refuse(); out[key] = d.value; }
  return out;
}
function line(value, limit) {
  if (typeof value !== "string" || value.length > limit) refuse();
  return value.endsWith("\n") ? value.slice(0, -1) : value;
}
function port(value) {
  if (!/^(?:0|[1-9][0-9]{0,4})(?![\s\S])/.test(value)) refuse();
  const number = Number(value); if (!Number.isSafeInteger(number) || number > 65535) refuse(); return number;
}
function range(text) {
  const match = /^(0|[1-9][0-9]{0,4})[ \t]+(0|[1-9][0-9]{0,4})(?![\s\S])/.exec(line(text, 32));
  if (!match) refuse(); const lo = port(match[1]), hi = port(match[2]); if (lo < 1 || lo > hi) refuse(); return [lo, hi];
}
function reserved(text) {
  const source = line(text, 393216), bitmap = new Uint8Array(65536);
  if (source === "") return bitmap;
  for (const item of source.split(",")) {
    const ends = item.split("-"); if (ends.length > 2) refuse();
    const lo = port(ends[0]), hi = ends.length === 1 ? lo : port(ends[1]); if (lo > hi) refuse();
    bitmap.fill(1, lo, hi + 1);
  }
  return bitmap;
}
function format(bitmap) {
  const out = [];
  for (let p = 0; p < bitmap.length; p++) {
    if (!bitmap[p]) continue; const lo = p; while (p + 1 < bitmap.length && bitmap[p + 1]) p++;
    out.push(lo === p ? String(lo) : String(lo) + "-" + String(p));
  }
  return out.join(",");
}
function available(bitmap, lo, hi) { let count = 0; for (let p = lo; p <= hi; p++) if (!bitmap[p]) count++; return count; }
function planned(input) {
  const v = record(input, INPUT_KEYS);
  if (v.runnerEnvironment !== "github-hosted" || v.runnerOs !== "Linux" || v.jobContainerId !== "" || v.serviceContainerCount !== 0) refuse();
  const [lo, hi] = range(v.rangeText), before = reserved(v.reservedText), after = before.slice();
  for (const p of PORTS) after[p] = 1;
  const beforeAvailable = available(before, lo, hi), afterAvailable = available(after, lo, hi);
  if (beforeAvailable === 0 || afterAvailable === 0) refuse();
  const beforeText = format(before), afterText = format(after); if (afterText.length > 65536) refuse();
  return Object.freeze({ version: 1, kind: "ADMIN_PORT_RESERVATION_PLAN_ONLY", planningOnly: true, authority: false,
    targetPorts: PORTS, localPortRange: Object.freeze([lo, hi]), reservedBefore: beforeText, reservedAfter: afterText,
    requiresWrite: beforeText !== afterText, ephemeralAvailableBefore: beforeAvailable, ephemeralAvailableAfter: afterAvailable,
    targetPortsInsideRange: PORTS.filter(p => p >= lo && p <= hi).length });
}
export function planAdminPortReservation(input) { try { return planned(input); } catch { refuse(); } }
/** Equality checks over caller-supplied strings only; no live readback is done. */
export function checkAdminPortReservationReadback(input, readback) {
  try {
    const plan = planned(input), v = record(readback, READBACK_KEYS), afterRange = range(v.rangeAfterWrite);
    if (format(reserved(v.reservedImmediatelyBeforeWrite)) !== plan.reservedBefore
      || format(reserved(v.reservedAfterWrite)) !== plan.reservedAfter
      || afterRange[0] !== plan.localPortRange[0] || afterRange[1] !== plan.localPortRange[1]) refuse();
    return Object.freeze({ version: 1, kind: "ADMIN_PORT_RESERVATION_READBACK_MODEL_ONLY", planningOnly: true,
      authority: false, snapshotUnchangedBeforeWrite: true, reservationSetMatches: true, localPortRangeUnchanged: true });
  } catch { refuse(); }
}

const OBSERVED_KEYS = ["reservedText", "rangeText"];
export function checkAdminPortReservationBeforeApply(input, observed) {
  try {
    const plan = planned(input), v = record(observed, OBSERVED_KEYS), currentRange = range(v.rangeText);
    if (format(reserved(v.reservedText)) !== plan.reservedBefore || currentRange[0] !== plan.localPortRange[0] || currentRange[1] !== plan.localPortRange[1]) refuse();
    return Object.freeze({ planningOnly: true, authority: false, snapshotMatches: true });
  } catch { refuse(); }
}
export function checkAdminPortReservationAfterApply(input, observed) {
  try {
    const plan = planned(input), v = record(observed, OBSERVED_KEYS), currentRange = range(v.rangeText);
    if (format(reserved(v.reservedText)) !== plan.reservedAfter || currentRange[0] !== plan.localPortRange[0] || currentRange[1] !== plan.localPortRange[1]) refuse();
    return Object.freeze({ planningOnly: true, authority: false, reservationSetMatches: true });
  } catch { refuse(); }
}
function count(bitmap) { let n = 0; for (const bit of bitmap) n += bit; return n; }
export function adminPortPolicyDiagnostic(input, stage, eventSourceSha) {
  try {
    if (!["planned", "readback-confirmed"].includes(stage) || typeof eventSourceSha !== "string" || !/^[a-f0-9]{40}(?![\s\S])/.test(eventSourceSha)) refuse();
    const plan = planned(input), before = reserved(plan.reservedBefore), after = reserved(plan.reservedAfter);
    return Object.freeze({ schemaVersion: 1, scenario: "admin-fixed-port-policy", stage, eventSourceSha,
      rangeStart: plan.localPortRange[0], rangeEnd: plan.localPortRange[1],
      reservedBeforeCount: count(before), plannedReservedCount: count(after),
      reservedBeforeSha256: createHash("sha256").update(plan.reservedBefore).digest("hex"),
      plannedReservedSha256: createHash("sha256").update(plan.reservedAfter).digest("hex"),
      targetReservedBeforeCount: PORTS.filter(p => before[p]).length, targetReservedAfterCount: 3,
      ephemeralAvailableBefore: plan.ephemeralAvailableBefore, ephemeralAvailableAfter: plan.ephemeralAvailableAfter,
      requiresWrite: plan.requiresWrite, kernelReadbackConfirmed: stage === "readback-confirmed",
      originalCauseKnown: false, nativeCasesCertified: false });
  } catch { refuse(); }
}
export function validateAdminPortPolicyContext(environment, platform = process.platform) {
  if (!environment || platform !== "linux" || environment.CI !== "true" || environment.GITHUB_ACTIONS !== "true"
    || environment.SC_ADMIN_PORT_POLICY_RUN !== "1" || environment.SC_POLICY_RUNNER_ENVIRONMENT !== "github-hosted"
    || environment.SC_POLICY_RUNNER_OS !== "Linux" || environment.SC_POLICY_JOB_CONTAINER_ID !== ""
    || typeof environment.SC_POLICY_JOB_SERVICES_JSON !== "string" || environment.SC_POLICY_JOB_SERVICES_JSON.length > 65536 || typeof environment.GITHUB_SHA !== "string"
    || !/^[a-f0-9]{40}(?![\s\S])/.test(environment.GITHUB_SHA) || typeof environment.RUNNER_TEMP !== "string"
    || !isAbsolute(environment.RUNNER_TEMP)) refuse();
  let services; try { services = JSON.parse(environment.SC_POLICY_JOB_SERVICES_JSON); } catch { refuse(); }
  if (services !== null && services !== "" && (typeof services !== "object" || Array.isArray(services) || Object.keys(services).length !== 0)) refuse();
  return Object.freeze({ eventSourceSha: environment.GITHUB_SHA, runnerTemp: resolve(environment.RUNNER_TEMP) });
}
const KERNEL_RANGE = "/proc/sys/net/ipv4/ip_local_port_range", KERNEL_RESERVED = "/proc/sys/net/ipv4/ip_local_reserved_ports";
const SNAPSHOT_LIMIT = 1048576;
async function kernelSnapshot(environment) {
  const observed = await Promise.all([readFile(KERNEL_RANGE), readFile(KERNEL_RESERVED)]);
  if (observed[0].length > 32 || observed[1].length > 393216) refuse();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const input = { runnerEnvironment: environment.SC_POLICY_RUNNER_ENVIRONMENT, runnerOs: environment.SC_POLICY_RUNNER_OS,
    jobContainerId: environment.SC_POLICY_JOB_CONTAINER_ID, serviceContainerCount: 0,
    rangeText: decoder.decode(observed[0]), reservedText: decoder.decode(observed[1]) };
  planned(input); return input;
}
async function snapshotFile(path, context, writable = false) {
  if (typeof path !== "string" || !isAbsolute(path) || path.includes("\0")) refuse();
  const normalized = resolve(path);
  if (dirname(normalized) !== context.runnerTemp || !/^sc-admin-port-policy\.[A-Za-z0-9]{6}(?![\s\S])/.test(basename(normalized))
    || await realpath(context.runnerTemp) !== context.runnerTemp || await realpath(normalized) !== normalized) refuse();
  const initial = await lstat(normalized);
  if (!initial.isFile() || initial.isSymbolicLink() || initial.nlink !== 1 || (initial.mode & 0o777) !== 0o600
    || typeof process.getuid !== "function" || process.getuid() === 0 || initial.uid !== process.getuid()
    || initial.size < 0 || initial.size > SNAPSHOT_LIMIT) refuse();
  const handle = await open(normalized, (writable ? constants.O_WRONLY : constants.O_RDONLY) | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.ino !== initial.ino || opened.dev !== initial.dev || opened.nlink !== 1
      || (opened.mode & 0o777) !== 0o600 || opened.uid !== process.getuid()) refuse();
    return handle;
  } catch { await handle.close(); refuse(); }
}
async function saveSnapshot(path, context, input) {
  const payload = Buffer.from(JSON.stringify({ version: 1, kind: "ADMIN_PORT_POLICY_PRIVATE_SNAPSHOT", eventSourceSha: context.eventSourceSha, input }) + "\n");
  if (payload.length > SNAPSHOT_LIMIT) refuse();
  const handle = await snapshotFile(path, context, true);
  try { await handle.truncate(0); await handle.writeFile(payload); await handle.sync(); } finally { payload.fill(0); await handle.close(); }
}
async function loadSnapshot(path, context) {
  const handle = await snapshotFile(path, context), buffer = Buffer.alloc(SNAPSHOT_LIMIT + 1);
  try {
    const result = await handle.read(buffer, 0, buffer.length, 0); if (result.bytesRead < 1 || result.bytesRead > SNAPSHOT_LIMIT) refuse();
    const v = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, result.bytesRead))), ["version", "kind", "eventSourceSha", "input"]);
    if (v.version !== 1 || v.kind !== "ADMIN_PORT_POLICY_PRIVATE_SNAPSHOT" || v.eventSourceSha !== context.eventSourceSha) refuse();
    planned(v.input); return v.input;
  } finally { buffer.fill(0); await handle.close(); }
}
/** No sysctl write or child process exists here. Bash owns the one fixed-key write. */
export async function main(argv = process.argv.slice(2), environment = process.env, output = value => process.stdout.write(JSON.stringify(value) + "\n")) {
  if (!argv.length || argv.length === 1 && argv[0] === "--help") {
    output({ schemaVersion: 1, scenario: "admin-fixed-port-policy", code: "NO_POLICY_APPLIED" }); return 0;
  }
  try {
    if (argv.length === 1 && argv[0] === "--check-scope") {
      validateAdminPortPolicyContext(environment);
      output({ schemaVersion: 1, scenario: "admin-fixed-port-policy", code: "SCOPE_VERIFIED" }); return 0;
    }
    if (argv.length !== 2 || !["--snapshot", "--check-before-apply", "--check-readback"].includes(argv[0])) refuse();
    const context = validateAdminPortPolicyContext(environment);
    if (argv[0] === "--snapshot") {
      const input = await kernelSnapshot(environment); await saveSnapshot(argv[1], context, input);
      output(adminPortPolicyDiagnostic(input, "planned", context.eventSourceSha)); return 0;
    }
    const input = await loadSnapshot(argv[1], context), current = await kernelSnapshot(environment);
    const observed = { reservedText: current.reservedText, rangeText: current.rangeText };
    if (argv[0] === "--check-before-apply") {
      checkAdminPortReservationBeforeApply(input, observed);
      const plan = planned(input); process.stdout.write((plan.requiresWrite ? plan.reservedAfter : "NO_WRITE") + "\n"); return 0;
    }
    checkAdminPortReservationAfterApply(input, observed);
    output(adminPortPolicyDiagnostic(input, "readback-confirmed", context.eventSourceSha)); return 0;
  } catch { output({ schemaVersion: 1, scenario: "admin-fixed-port-policy", code: "POLICY_REFUSED" }); return 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
