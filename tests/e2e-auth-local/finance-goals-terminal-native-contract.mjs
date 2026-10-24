/** Closed observations for a disposable CI gate. Importing starts no process. */
import { types } from "node:util";

export const GOAL_NATIVE_COMMANDS = Object.freeze(["CREATE", "CONTRIBUTE", "RELEASE"]);
export const GOAL_NATIVE_ORDERS = Object.freeze(["COMMIT_FIRST", "SETTLE_FIRST", "OLD_EXECUTOR", "TWO_SETTLES"]);
export const GOAL_NATIVE_CASES = Object.freeze(GOAL_NATIVE_COMMANDS.flatMap(command => GOAL_NATIVE_ORDERS.map(order => `${command}_${order}`)));
export const GOAL_NATIVE_LIMITS = Object.freeze({ actionMs: 15000, sessionMs: 120000, frameBytes: 1048576, sessionBytes: 4194304, inputBytes: 1048576, stderrBytes: 65536, sessions: 4, barrierMs: 5000, pollMs: 25 });
export const GOAL_NATIVE_CODES = Object.freeze(["PASSED", "NOT_RUN", "ENVIRONMENT_REFUSED", "SOURCE_REFUSED", "GRAPH_REFUSED", "PORT_REFUSED", "INSTANCE_REFUSED", "CATALOGUE_REFUSED", "AUTH_REFUSED", "SQL_REFUSED", "SESSION_REFUSED", "FRAME_REFUSED", "OUTPUT_LIMIT", "ACTION_TIMEOUT", "SESSION_TIMEOUT", "ABORTED", "PROCESS_REFUSED", "GROUP_UNCONFIRMED", "BARRIER_REFUSED", "MATERIAL_REFUSED", "WRITE_OUTCOME_UNCERTAIN", "CLEANUP_UNCONFIRMED"]);
export const GOAL_NATIVE_PHASES = Object.freeze(["not-run", "environment", "sources", "stack", "canonical", "companions", "auth", "baseline", "planning", "winner", "blocked", "release", "oracle", "cleanup", "complete"]);
export const GOAL_NATIVE_CHECKS = Object.freeze(["instanceBound", "actorsBound", "distinctBackends", "originalGraph", "sourcePins", "barrierObserved", "winnerCommitted", "loserKnown", "receiptExclusive", "eventBijection", "fullFinancialRows", "totalsExact", "otherOwnerUnchanged", "sameIntentReplay", "strongReceiptGuard", "quiescent", "fixtureAbsent"]);
export const GOAL_NATIVE_LIMITATIONS = Object.freeze(["hostedAccepted", "browserAccepted", "imagesAccepted", "restoreAccepted", "productionEnabled"]);
const HEX40 = /^[a-f0-9]{40}$/, HEX64 = /^[a-f0-9]{64}$/;
const NODE_VERSION = /^24\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;

export class GoalNativeError extends Error {
  constructor(code, detail = null) {
    super(GOAL_NATIVE_CODES.includes(code) ? code : "SESSION_REFUSED");
    this.name = "GoalNativeError"; this.code = this.message;
    this.detail = detail === null ? null : Object.freeze({ ...detail });
  }
}
export function nativeRefuse(code) { throw new GoalNativeError(code); }
/** The repository selects major 24; the evidence records the stable full runtime.
 * Primitive strings only. No process, filesystem or coercion occurs here. */
export function validateGoalNativeNodeVersion(selection, runtime) {
  if (typeof selection !== "string" || selection.length > 64 || selection.trim() !== "24" || typeof runtime !== "string" || runtime.length > 32 || runtime.trim() !== runtime || !NODE_VERSION.test(runtime)) nativeRefuse("ENVIRONMENT_REFUSED");
  return runtime;
}
export function nativeRecord(value, keys, code = "SESSION_REFUSED") {
  if (!value || typeof value !== "object" || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) nativeRefuse(code);
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key))) nativeRefuse(code);
  const entries = [];
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) nativeRefuse(code);
    entries.push([key, descriptor.value]);
  }
  return Object.fromEntries(entries);
}
/** Bounded, descriptor-only data snapshot; never call JSON hooks or accessors. */
export function nativeData(value, depth = 0, budget = { properties: 0 }) {
  if (depth > 16) nativeRefuse("SQL_REFUSED");
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") { if (!Number.isSafeInteger(value)) nativeRefuse("SQL_REFUSED"); return value; }
  if (!value || typeof value !== "object" || types.isProxy(value)) nativeRefuse("SQL_REFUSED");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || value.length > 512 || Reflect.ownKeys(descriptors).length !== value.length + 1) nativeRefuse("SQL_REFUSED");
    const copy = [];
    for (let index = 0; index < value.length; index++) { const descriptor = descriptors[index]; if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value") || ++budget.properties > 4096) nativeRefuse("SQL_REFUSED"); copy.push(nativeData(descriptor.value, depth + 1, budget)); }
    return copy;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) nativeRefuse("SQL_REFUSED");
  const entries = [];
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (typeof key !== "string" || !descriptor?.enumerable || !Object.hasOwn(descriptor, "value") || ++budget.properties > 4096) nativeRefuse("SQL_REFUSED");
    entries.push([key, nativeData(descriptor.value, depth + 1, budget)]);
  }
  return Object.fromEntries(entries);
}
const bools = (value, keys) => {
  const copy = nativeRecord(value, keys, "MATERIAL_REFUSED");
  if (keys.some(key => typeof copy[key] !== "boolean")) nativeRefuse("MATERIAL_REFUSED");
  return Object.freeze(copy);
};
function sourceRows(value, known) {
  if (!Array.isArray(value) || types.isProxy(value) || value.length > 512 || known && value.length < 1 || !known && value.length !== 0) nativeRefuse("SOURCE_REFUSED");
  let previous = "";
  return Object.freeze(value.map(row => {
    const copy = nativeRecord(row, ["path", "sha256", "bytes"], "SOURCE_REFUSED");
    if (typeof copy.path !== "string" || !/^[a-zA-Z0-9_./@-]+$/.test(copy.path) || copy.path.includes("..") || copy.path.startsWith("/") || copy.path <= previous || !HEX64.test(copy.sha256) || !Number.isSafeInteger(copy.bytes) || copy.bytes < 0 || copy.bytes > 2097152) nativeRefuse("SOURCE_REFUSED");
    previous = copy.path; return Object.freeze(copy);
  }));
}
/** Data validation is not evidence of native origin; the runner supplies it only after real observations. */
export function validateGoalNativeReport(value) {
  const v = nativeRecord(nativeData(value), ["version", "scenario", "sourceSha", "sourceTree", "nodeVersion", "cliVersion", "serverVersion", "status", "code", "phase", "sources", "dependencies", "cases", "writeOutcomeUncertain", "pending", "cleanup", "limitations"], "MATERIAL_REFUSED");
  const sourcesKnown = HEX40.test(v.sourceSha) && HEX40.test(v.sourceTree), runtimeKnown = typeof v.nodeVersion === "string" && v.nodeVersion.length <= 32 && v.nodeVersion.trim() === v.nodeVersion && NODE_VERSION.test(v.nodeVersion), instanceKnown = Number.isSafeInteger(v.serverVersion) && v.serverVersion >= 170000 && v.serverVersion < 180000;
  if (v.version !== 2 || v.scenario !== "finance-goals-terminal-native-ci" || !sourcesKnown && (v.sourceSha !== null || v.sourceTree !== null) || !runtimeKnown && v.nodeVersion !== null || sourcesKnown && !runtimeKnown || v.cliVersion !== "2.120.0" || !instanceKnown && v.serverVersion !== null || !["passed", "failed"].includes(v.status) || !GOAL_NATIVE_CODES.includes(v.code) || !GOAL_NATIVE_PHASES.includes(v.phase) || typeof v.writeOutcomeUncertain !== "boolean") nativeRefuse("MATERIAL_REFUSED");
  const pending = nativeRecord(v.pending, ["commands", "http", "backends"], "MATERIAL_REFUSED");
  if (Object.values(pending).some(n => !Number.isSafeInteger(n) || n < 0 || n > 128)) nativeRefuse("MATERIAL_REFUSED");
  const cleanup = bools(v.cleanup, ["groups", "backends", "stack", "temp"]), limitations = bools(v.limitations, GOAL_NATIVE_LIMITATIONS);
  if (Object.values(limitations).some(Boolean) || !Array.isArray(v.cases) || types.isProxy(v.cases) || v.cases.length !== GOAL_NATIVE_CASES.length) nativeRefuse("MATERIAL_REFUSED");
  let stopped = false;
  const cases = v.cases.map((row, index) => {
    const c = nativeRecord(row, ["case", "status", "code", "phase", "checks", "counts", "unknown"], "MATERIAL_REFUSED");
    if (c.case !== GOAL_NATIVE_CASES[index] || !["passed", "failed", "not-run"].includes(c.status) || !GOAL_NATIVE_CODES.includes(c.code) || !GOAL_NATIVE_PHASES.includes(c.phase) || typeof c.unknown !== "boolean" || stopped && c.status !== "not-run" || c.status !== "not-run" && (!sourcesKnown || !runtimeKnown || !instanceKnown)) nativeRefuse("MATERIAL_REFUSED");
    const checks = bools(c.checks, GOAL_NATIVE_CHECKS), counts = nativeRecord(c.counts, ["receipts", "dispositions", "terminalEvents", "financialEffects", "financialEvents", "quotaDelta", "sessions"], "MATERIAL_REFUSED");
    if (Object.values(counts).some(n => !Number.isSafeInteger(n) || n < 0 || n > 32)) nativeRefuse("MATERIAL_REFUSED");
    if (c.status === "passed") {
      if (c.code !== "PASSED" || c.phase !== "complete" || c.unknown || GOAL_NATIVE_CHECKS.filter(key => key !== "strongReceiptGuard").some(key => !checks[key]) || checks.strongReceiptGuard !== c.case.endsWith("_OLD_EXECUTOR") || counts.sessions < 3 || counts.sessions > GOAL_NATIVE_LIMITS.sessions) nativeRefuse("MATERIAL_REFUSED");
      const commitFirst = c.case.endsWith("_COMMIT_FIRST");
      if (counts.receipts !== (commitFirst ? 1 : 0) || counts.dispositions !== (commitFirst ? 0 : 1) || counts.terminalEvents !== counts.dispositions || counts.financialEffects !== (commitFirst ? 1 : 0) || counts.financialEvents !== counts.financialEffects || counts.quotaDelta !== 1) nativeRefuse("MATERIAL_REFUSED");
    } else {
      if (c.code === "PASSED" || c.phase === "complete") nativeRefuse("MATERIAL_REFUSED");
      if (c.status === "not-run" && (c.code !== "NOT_RUN" || c.phase !== "not-run" || c.unknown || Object.values(checks).some(Boolean) || Object.values(counts).some(Boolean))) nativeRefuse("MATERIAL_REFUSED");
      stopped = true;
    }
    return Object.freeze({ ...c, checks, counts: Object.freeze(counts) });
  });
  const passed = sourcesKnown && runtimeKnown && instanceKnown && !stopped && !v.writeOutcomeUncertain && Object.values(pending).every(n => n === 0) && Object.values(cleanup).every(Boolean);
  if (v.status === "passed" && (!passed || v.code !== "PASSED" || v.phase !== "complete") || v.status === "failed" && (v.code === "PASSED" || v.phase === "complete")) nativeRefuse("MATERIAL_REFUSED");
  if (cases.some(c => c.unknown) && !v.writeOutcomeUncertain || Object.values(pending).some(Boolean) && Object.values(cleanup).some(Boolean)) nativeRefuse("MATERIAL_REFUSED");
  return Object.freeze({ ...v, sources: sourceRows(v.sources, sourcesKnown), dependencies: sourceRows(v.dependencies, sourcesKnown), cases: Object.freeze(cases), pending: Object.freeze(pending), cleanup, limitations });
}
export function newGoalNativeReport() {
  const flags = (keys, value) => Object.fromEntries(keys.map(key => [key, value]));
  return { version: 2, scenario: "finance-goals-terminal-native-ci", sourceSha: null, sourceTree: null, nodeVersion: null, cliVersion: "2.120.0", serverVersion: null, status: "failed", code: "NOT_RUN", phase: "environment", sources: [], dependencies: [], cases: GOAL_NATIVE_CASES.map(kind => ({ case: kind, status: "not-run", code: "NOT_RUN", phase: "not-run", checks: flags(GOAL_NATIVE_CHECKS, false), counts: flags(["receipts", "dispositions", "terminalEvents", "financialEffects", "financialEvents", "quotaDelta", "sessions"], 0), unknown: false })), writeOutcomeUncertain: false, pending: { commands: 0, http: 0, backends: 0 }, cleanup: flags(["groups", "backends", "stack", "temp"], false), limitations: flags(GOAL_NATIVE_LIMITATIONS, false) };
}
