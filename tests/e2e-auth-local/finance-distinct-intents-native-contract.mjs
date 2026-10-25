/** Closed D3 observations. Importing this module starts no service. */
import { GOAL_NATIVE_CODES, GOAL_NATIVE_PHASES, nativeData, nativeRecord, nativeRefuse } from "./finance-goals-terminal-native-contract.mjs";

export const DISTINCT_NATIVE_CASES = Object.freeze(["CONTRIBUTE_DISTINCT", "RELEASE_DISTINCT", "SERIES_MATERIALIZE_DISTINCT"]);
export const DISTINCT_NATIVE_CHECKS = Object.freeze(["instanceBound", "actorsBound", "distinctBackends", "originalGraph", "sourcePins", "catalogueBound", "intentsDistinct", "barrierObserved", "winnerCommitted", "loserKnown", "oldRowsUnchanged", "eventBijection", "receiptExclusive", "totalsExact", "otherOwnerUnchanged", "ordinalUnique", "serialCoreValidation", "serialSnapshotUnchanged", "quiescent", "fixtureAbsent"]);
export const DISTINCT_NATIVE_COUNTS = Object.freeze(["sessions", "receipts", "dispositions", "financialEffects", "financialEvents", "quotaDelta", "serialControls", "serialRefusals"]);
export const DISTINCT_NATIVE_LIMITATIONS = Object.freeze(["hostedAccepted", "browserAccepted", "imagesAccepted", "restoreAccepted", "productionEnabled", "appHttpAccepted", "canonical027InstallationObserved", "sqlInsufficiencyBranchObserved"]);
export const DISTINCT_PRODUCT_EXPORTS = Object.freeze(["executeFinanceSeriesCommand", "decodeFinanceSeriesCommand", "createFinanceSeriesGateway", "createFinanceSeriesStore", "seriesOccurrenceDay"]);
export const DISTINCT_PRODUCT_SOURCES = Object.freeze([
  "src/adapters/db/finance-series-gateway.ts", "src/adapters/db/finance-series-protocol.ts", "src/adapters/db/finance-series-store.ts",
  ...["series-use-cases", "series-validation", "series-policy", "series-previews", "series-planning", "series-calendar", "series-types", "series-ports", "series-preview-types"].map(name => "src/core/financeiro/series/" + name + ".ts"),
]);
const required = (value, code = "MATERIAL_REFUSED") => { if (!value) nativeRefuse(code); };
const flags = (keys, value) => Object.fromEntries(keys.map(key => [key, value]));
/** These selectors are consumed by the real CLI; no alternate/remote mode exists. */
export function selectFinanceNativeMode(argv) {
  required(Array.isArray(argv) && argv.length === 1 && typeof argv[0] === "string", "ENVIRONMENT_REFUSED");
  const modes = { "--execute": "terminal-v2", "--execute-images-terminal-v1": "images-terminal-v1", "--execute-terminal-distinct-v1": "terminal-distinct-v1" };
  required(Object.hasOwn(modes, argv[0]), "ENVIRONMENT_REFUSED"); return modes[argv[0]];
}
/** Expected catalogue values are selected before any case, never learned from its delta. */
export function validateDistinctNativeCatalogue(value) {
  const v = nativeRecord(value, ["wrappersInvoker", "endUserHelpersDenied", "serviceDefinerEntryPoints", "serviceOtherHelpersDenied", "tablesClosed", "revisionTriggers", "permitTriggers", "guardChain", "seriesReceiptWeight"], "CATALOGUE_REFUSED");
  required(v.wrappersInvoker === 2 && v.endUserHelpersDenied === true && v.serviceDefinerEntryPoints === 4 && v.serviceOtherHelpersDenied === true && v.tablesClosed === true && v.revisionTriggers === 5 && v.permitTriggers === 2 && v.guardChain === true && v.seriesReceiptWeight === 0, "CATALOGUE_REFUSED");
  return Object.freeze({ goal: 1, event: 1, receipt: 0, disposition: 0, series: 1, occurrence: 1, ledger: 1, seriesReceipt: 0 });
}
export function assertDistinctNativeBarrier(value, waiter, winner, settled, withinDeadline) {
  const v = nativeRecord(value, ["ack", "waiter", "winner", "blocked", "advisory", "waitType"], "BARRIER_REFUSED");
  required(Number.isSafeInteger(waiter) && Number.isSafeInteger(winner) && waiter > 1 && winner > 1 && waiter !== winner && v.ack === "blocking" && v.waiter === waiter && v.winner === winner && v.blocked === true && v.advisory === true && v.waitType === "Lock" && settled === false && withinDeadline === true, "BARRIER_REFUSED");
  return true;
}
export function assertDistinctNativeSessionState(action, transaction, role) {
  required(["SERIES_RPC", "DISTINCT_MATERIAL", "DISTINCT_ABSENCE"].includes(action), "SESSION_REFUSED");
  required(action === "SERIES_RPC" ? transaction === "open" && role === "service_role" : role === "postgres", "SESSION_REFUSED"); return true;
}
export function newDistinctNativeReport() {
  return { version: 1, scenario: "finance-distinct-intents-native-ci", sourceSha: null, sourceTree: null, nodeVersion: null, cliVersion: "2.120.0", serverVersion: null, status: "failed", code: "NOT_RUN", phase: "environment", sources: [], dependencies: [], cases: DISTINCT_NATIVE_CASES.map(kind => ({ case: kind, status: "not-run", code: "NOT_RUN", phase: "not-run", checks: flags(DISTINCT_NATIVE_CHECKS, false), counts: flags(DISTINCT_NATIVE_COUNTS, 0), loserGate: "NOT_OBSERVED", businessGuardReached: false, unknown: false })), writeOutcomeUncertain: false, pending: { commands: 0, http: 0, backends: 0 }, cleanup: flags(["groups", "backends", "stack", "temp"], false), limitations: flags(DISTINCT_NATIVE_LIMITATIONS, false) };
}
function sourceRows(rows, known) {
  required(Array.isArray(rows) && rows.length <= 512 && (known ? rows.length > 0 : rows.length === 0)); let previous = "";
  return rows.map(row => { const r = nativeRecord(row, ["path", "sha256", "bytes"], "MATERIAL_REFUSED"); required(typeof r.path === "string" && /^[a-zA-Z0-9_./@-]+$/.test(r.path) && !r.path.includes("..") && !r.path.startsWith("/") && r.path > previous && typeof r.sha256 === "string" && /^[a-f0-9]{64}$/.test(r.sha256) && Number.isSafeInteger(r.bytes) && r.bytes >= 0 && r.bytes <= 2097152); previous = r.path; return Object.freeze(r); });
}
function booleans(value, keys) { const v = nativeRecord(value, keys, "MATERIAL_REFUSED"); required(Object.values(v).every(b => typeof b === "boolean")); return Object.freeze(v); }
export function validateDistinctNativeReport(value) {
  const v = nativeRecord(nativeData(value), ["version", "scenario", "sourceSha", "sourceTree", "nodeVersion", "cliVersion", "serverVersion", "status", "code", "phase", "sources", "dependencies", "cases", "writeOutcomeUncertain", "pending", "cleanup", "limitations"], "MATERIAL_REFUSED");
  const source = typeof v.sourceSha === "string" && /^[a-f0-9]{40}$/.test(v.sourceSha) && typeof v.sourceTree === "string" && /^[a-f0-9]{40}$/.test(v.sourceTree), runtime = typeof v.nodeVersion === "string" && /^24\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/.test(v.nodeVersion) && v.nodeVersion.length <= 32, instance = Number.isSafeInteger(v.serverVersion) && v.serverVersion >= 170000 && v.serverVersion < 180000;
  required(v.version === 1 && v.scenario === "finance-distinct-intents-native-ci" && (source || v.sourceSha === null && v.sourceTree === null) && (runtime || v.nodeVersion === null) && (!source || runtime) && v.cliVersion === "2.120.0" && (instance || v.serverVersion === null) && ["passed", "failed"].includes(v.status) && GOAL_NATIVE_CODES.includes(v.code) && GOAL_NATIVE_PHASES.includes(v.phase) && typeof v.writeOutcomeUncertain === "boolean");
  const pending = nativeRecord(v.pending, ["commands", "http", "backends"], "MATERIAL_REFUSED"), cleanup = booleans(v.cleanup, ["groups", "backends", "stack", "temp"]), limitations = booleans(v.limitations, DISTINCT_NATIVE_LIMITATIONS);
  required(Object.values(pending).every(n => Number.isSafeInteger(n) && n >= 0 && n <= 128) && Object.values(limitations).every(b => b === false) && Array.isArray(v.cases) && v.cases.length === 3);
  let stopped = false;
  const cases = v.cases.map((row, index) => {
    const c = nativeRecord(row, ["case", "status", "code", "phase", "checks", "counts", "loserGate", "businessGuardReached", "unknown"], "MATERIAL_REFUSED"), checks = booleans(c.checks, DISTINCT_NATIVE_CHECKS), counts = nativeRecord(c.counts, DISTINCT_NATIVE_COUNTS, "MATERIAL_REFUSED"), series = index === 2;
    required(c.case === DISTINCT_NATIVE_CASES[index] && ["passed", "failed", "not-run"].includes(c.status) && GOAL_NATIVE_CODES.includes(c.code) && GOAL_NATIVE_PHASES.includes(c.phase) && ["NOT_OBSERVED", "STALE_FINANCE"].includes(c.loserGate) && c.businessGuardReached === false && typeof c.unknown === "boolean" && (!stopped || c.status === "not-run") && (c.status === "not-run" || source && runtime && instance));
    required(Object.values(counts).every(n => Number.isSafeInteger(n) && n >= 0 && n <= 32));
    if (c.status === "passed") {
      required(c.code === "PASSED" && c.phase === "complete" && !c.unknown && c.loserGate === "STALE_FINANCE" && DISTINCT_NATIVE_CHECKS.filter(k => !["ordinalUnique", "serialCoreValidation", "serialSnapshotUnchanged"].includes(k)).every(k => checks[k]) && checks.ordinalUnique === series && checks.serialCoreValidation === !series && checks.serialSnapshotUnchanged === !series);
      required(counts.sessions === 4 && counts.receipts === 1 && counts.dispositions === 0 && counts.financialEffects === (series ? 5 : 1) && counts.financialEvents === counts.financialEffects && counts.quotaDelta === 1 && counts.serialControls === (series ? 0 : 1) && counts.serialRefusals === counts.serialControls);
    } else {
      required(c.code !== "PASSED" && c.phase !== "complete");
      if (c.status === "not-run") required(c.code === "NOT_RUN" && c.phase === "not-run" && c.loserGate === "NOT_OBSERVED" && !c.unknown && Object.values(checks).every(b => b === false) && Object.values(counts).every(n => n === 0));
      stopped = true;
    }
    return Object.freeze({ ...c, checks, counts: Object.freeze(counts) });
  });
  const passed = source && runtime && instance && !stopped && !v.writeOutcomeUncertain && Object.values(pending).every(n => n === 0) && Object.values(cleanup).every(Boolean);
  required(v.status === "passed" ? passed && v.code === "PASSED" && v.phase === "complete" : v.code !== "PASSED" && v.phase !== "complete");
  required((!cases.some(c => c.unknown) || v.writeOutcomeUncertain) && (!Object.values(pending).some(Boolean) || Object.values(cleanup).every(b => b === false)));
  return Object.freeze({ ...v, sources: Object.freeze(sourceRows(v.sources, source)), dependencies: Object.freeze(sourceRows(v.dependencies, source)), cases: Object.freeze(cases), pending: Object.freeze(pending), cleanup, limitations });
}
