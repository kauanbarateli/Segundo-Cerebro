/** Preparatory data contract only. No runner, native origin or acceptance authority. */
import { GOAL_NATIVE_CODES, GOAL_NATIVE_PHASES, nativeData, nativeRecord, nativeRefuse } from "./finance-goals-terminal-native-contract.mjs";

export const GOAL_IMAGES_NATIVE_SUITE = "images-terminal-v1";
export const GOAL_IMAGES_NATIVE_IMPLEMENTATION = "CONTRACT_AND_ISSUER_ONLY";
export const GOAL_IMAGES_NATIVE_CASES = Object.freeze([
  "I1_CREATE_BIND_FIRST", "I2_CREATE_CLEANUP_FIRST", "I3_UPDATE_BIND_FIRST", "I4_UPDATE_CLEANUP_FIRST",
  "I5_HOLDERS", "I6_IMAGE_COMMIT_FIRST", "I7_IMAGE_SETTLE_FIRST", "I8_NEGATIVES_ROLLBACK",
]);
const common = Object.freeze(["instanceBound", "actorsBound", "distinctBackends", "originalGraph", "sourcePins", "catalogueBound", "imagesInstalled", "terminalInstalled", "fullMaterial", "totalsExact", "otherOwnerUnchanged", "quiescent", "fixtureAbsent"]);
const extra = {
  I1_CREATE_BIND_FIRST: ["barrierObserved", "winnerCommitted", "imageProtectedAfterRecheck", "ackHolderRechecked"],
  I2_CREATE_CLEANUP_FIRST: ["barrierObserved", "winnerCommitted", "imageRefusalExact", "rollbackExact"],
  I3_UPDATE_BIND_FIRST: ["barrierObserved", "winnerCommitted", "referenceSuccessorExact", "ackHolderRechecked"],
  I4_UPDATE_CLEANUP_FIRST: ["barrierObserved", "winnerCommitted", "imageRefusalExact", "rollbackExact"],
  I5_HOLDERS: ["allHolderKinds", "archivedGoalProtected", "selectionRechecked", "ackHolderRechecked", "previousHolderChainPreserved"],
  I6_IMAGE_COMMIT_FIRST: ["barrierObserved", "winnerCommitted", "receiptFirst", "replayAfterRebind", "noExtraBinding"],
  I7_IMAGE_SETTLE_FIRST: ["barrierObserved", "winnerCommitted", "namespaceFence", "historicalGuardStrong", "noLateBinding"],
  I8_NEGATIVES_ROLLBACK: ["ownerDenied", "sessionDenied", "purposeDenied", "grantsClosed", "rollbackPostProjection"],
};
export const GOAL_IMAGES_NATIVE_CHECKS = Object.freeze(Object.fromEntries(GOAL_IMAGES_NATIVE_CASES.map(kind => [kind, Object.freeze([...common, ...extra[kind]])])));
export const GOAL_IMAGES_NATIVE_COUNTS = Object.freeze(["receipts", "dispositions", "financialEffects", "financialEvents", "terminalEvents", "quotaDelta", "imageReferences", "cleanupAcks", "holders", "sessions"]);
export const GOAL_IMAGES_NATIVE_LIMITATIONS = Object.freeze(["hostedAccepted", "browserAccepted", "imagesAccepted", "restoreAccepted", "productionEnabled"]);
const SHA40 = /^[a-f0-9]{40}$/, SHA64 = /^[a-f0-9]{64}$/, NODE24 = /^24\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const flags = keys => Object.fromEntries(keys.map(key => [key, false]));
function bools(value, keys) {
  const copy = nativeRecord(value, keys, "MATERIAL_REFUSED");
  if (keys.some(key => typeof copy[key] !== "boolean")) nativeRefuse("MATERIAL_REFUSED");
  return Object.freeze(copy);
}
function sources(value, known) {
  if (!Array.isArray(value) || value.length > 512 || (known ? value.length < 1 : value.length !== 0)) nativeRefuse("SOURCE_REFUSED");
  let previous = "";
  return Object.freeze(value.map(row => {
    const v = nativeRecord(row, ["path", "sha256", "bytes"], "SOURCE_REFUSED");
    if (typeof v.path !== "string" || !/^[a-zA-Z0-9_./@-]+$/.test(v.path) || v.path.includes("..") || v.path.startsWith("/") || v.path <= previous || typeof v.sha256 !== "string" || !SHA64.test(v.sha256) || !Number.isSafeInteger(v.bytes) || v.bytes < 0 || v.bytes > 2097152) nativeRefuse("SOURCE_REFUSED");
    previous = v.path; return Object.freeze(v);
  }));
}
/** Exact failed/not-run report until the native oracles and count matrix exist.
 * Intentionally cannot accept PASSED, even a fully populated synthetic object. */
export function validateGoalImagesNativeReport(input) {
  const v = nativeRecord(nativeData(input), ["version", "scenario", "suite", "sourceSha", "sourceTree", "nodeVersion", "cliVersion", "serverVersion", "status", "code", "phase", "sources", "dependencies", "cases", "writeOutcomeUncertain", "pending", "cleanup", "limitations"], "MATERIAL_REFUSED");
  const known = typeof v.sourceSha === "string" && SHA40.test(v.sourceSha) && typeof v.sourceTree === "string" && SHA40.test(v.sourceTree);
  const runtime = typeof v.nodeVersion === "string" && v.nodeVersion.length <= 32 && NODE24.test(v.nodeVersion);
  const instance = Number.isSafeInteger(v.serverVersion) && v.serverVersion >= 170000 && v.serverVersion < 180000;
  if (v.version !== 1 || v.scenario !== "finance-goals-images-terminal-native-ci" || v.suite !== GOAL_IMAGES_NATIVE_SUITE || (!known && (v.sourceSha !== null || v.sourceTree !== null)) || (!runtime && v.nodeVersion !== null) || (known && !runtime) || (!instance && v.serverVersion !== null) || v.cliVersion !== "2.120.0" || v.status !== "failed" || !GOAL_NATIVE_CODES.includes(v.code) || v.code === "PASSED" || !GOAL_NATIVE_PHASES.includes(v.phase) || v.phase === "complete" || typeof v.writeOutcomeUncertain !== "boolean") nativeRefuse("MATERIAL_REFUSED");
  const pending = nativeRecord(v.pending, ["commands", "http", "backends"], "MATERIAL_REFUSED");
  if (Object.values(pending).some(n => !Number.isSafeInteger(n) || n < 0 || n > 128)) nativeRefuse("MATERIAL_REFUSED");
  const cleanup = bools(v.cleanup, ["groups", "backends", "stack", "temp"]), limitations = bools(v.limitations, GOAL_IMAGES_NATIVE_LIMITATIONS);
  if (Object.values(limitations).some(Boolean) || !Array.isArray(v.cases) || v.cases.length !== GOAL_IMAGES_NATIVE_CASES.length) nativeRefuse("MATERIAL_REFUSED");
  let stopped = false;
  const cases = v.cases.map((row, index) => {
    const c = nativeRecord(row, ["case", "status", "code", "phase", "checks", "counts", "unknown"], "MATERIAL_REFUSED");
    if (c.case !== GOAL_IMAGES_NATIVE_CASES[index] || !["failed", "not-run"].includes(c.status) || !GOAL_NATIVE_CODES.includes(c.code) || c.code === "PASSED" || !GOAL_NATIVE_PHASES.includes(c.phase) || c.phase === "complete" || typeof c.unknown !== "boolean" || (stopped && c.status !== "not-run") || (c.status !== "not-run" && (!known || !runtime || !instance))) nativeRefuse("MATERIAL_REFUSED");
    const checks = bools(c.checks, GOAL_IMAGES_NATIVE_CHECKS[c.case]), counts = nativeRecord(c.counts, GOAL_IMAGES_NATIVE_COUNTS, "MATERIAL_REFUSED");
    if (Object.values(counts).some(n => !Number.isSafeInteger(n) || n < 0 || n > 128) || counts.sessions > 4) nativeRefuse("MATERIAL_REFUSED");
    if (c.status === "not-run" && (c.code !== "NOT_RUN" || c.phase !== "not-run" || c.unknown || Object.values(checks).some(Boolean) || Object.values(counts).some(Boolean))) nativeRefuse("MATERIAL_REFUSED");
    if (c.status === "failed") stopped = true;
    return Object.freeze({ ...c, checks, counts: Object.freeze(counts) });
  });
  if ((cases.some(c => c.unknown) && !v.writeOutcomeUncertain) || (Object.values(pending).some(Boolean) && Object.values(cleanup).some(Boolean))) nativeRefuse("MATERIAL_REFUSED");
  return Object.freeze({ ...v, sources: sources(v.sources, known), dependencies: sources(v.dependencies, known), cases: Object.freeze(cases), pending: Object.freeze(pending), cleanup, limitations });
}
export function newGoalImagesNativeReport() {
  return { version: 1, scenario: "finance-goals-images-terminal-native-ci", suite: GOAL_IMAGES_NATIVE_SUITE, sourceSha: null, sourceTree: null, nodeVersion: null, cliVersion: "2.120.0", serverVersion: null, status: "failed", code: "NOT_RUN", phase: "environment", sources: [], dependencies: [], cases: GOAL_IMAGES_NATIVE_CASES.map(kind => ({ case: kind, status: "not-run", code: "NOT_RUN", phase: "not-run", checks: flags(GOAL_IMAGES_NATIVE_CHECKS[kind]), counts: Object.fromEntries(GOAL_IMAGES_NATIVE_COUNTS.map(key => [key, 0])), unknown: false })), writeOutcomeUncertain: false, pending: { commands: 0, http: 0, backends: 0 }, cleanup: flags(["groups", "backends", "stack", "temp"]), limitations: flags(GOAL_IMAGES_NATIVE_LIMITATIONS) };
}
