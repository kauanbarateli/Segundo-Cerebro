// Pure disposable-CI metadata contract. No IO, transport or run provenance.
export const CAPTURE_TASK_PACKET_FILE = "auth-local-ci-capture-task-report.json";
export const CAPTURE_TASK_PACKET_KEYS = Object.freeze(["schemaVersion", "scenario", "status", "code", "report", "writeOutcomeUncertain"]);
export const CAPTURE_TASK_PACKET_CODES = Object.freeze(["PASSED", "CAPTURE_TASK_FAILED", "DEPENDENCY_NOT_RUN", "WRITE_OUTCOME_UNCERTAIN"]);
export const CAPTURE_TASK_REPORT_KEYS = Object.freeze(["schemaVersion", "scenario", "status", "code", "failurePoint", "stages", "counts", "checks", "writeOutcomeUncertain"]);
export const CAPTURE_TASK_STAGES = Object.freeze(["BASELINE", "CREATE", "UPDATE", "CONVERT", "CORE_REPLAY", "RPC_REPLAY", "TASK_DELETE", "TASK_RESTORE", "CAPTURE_DELETE", "CAPTURE_RESTORE", "FINAL"]);
export const CAPTURE_TASK_CHECKS = Object.freeze(["freshOwnBaseline", "createPersisted", "updatePersisted", "conversionLinked", "coreReplayUnchanged", "rpcReplayUnchanged", "taskTrashPreserved", "taskRestored", "captureTrashPreserved", "captureRestored", "publicOwnAndForeign", "eventsAndReceiptsAtomic"]);
export const CAPTURE_TASK_COUNT_LIMITS = Object.freeze({ requests: 64, rpcRequests: 64, publicRequests: 64, coreCommands: 8, commitAttempts: 9, committedReplies: 7, replayedReplies: 2, events: 8, receipts: 7 });
export const CAPTURE_TASK_PASS_COUNTS = Object.freeze({ requests: 45, rpcRequests: 29, publicRequests: 16, coreCommands: 8, commitAttempts: 9, committedReplies: 7, replayedReplies: 2, events: 8, receipts: 7 });
export const CAPTURE_TASK_FAILURE_CODES = Object.freeze(["SETUP_REFUSED", "GRAPH_REFUSED", "STATE_REFUSED", "RESPONSE_REFUSED", "DEADLINE_EXCEEDED", "TRANSPORT_FAILED", "OWNERSHIP_REFUSED", "SNAPSHOT_CHANGED", "DOMAIN_REFUSED", "COMMIT_UNCONFIRMED", "REPLAY_NOT_PROVEN", "EVENT_NOT_PROVEN", "TOKEN_LIFETIME_REFUSED", "CALL_LIMIT_REFUSED"]);
export const CAPTURE_TASK_FAILURE_POINTS = Object.freeze([...CAPTURE_TASK_STAGES, "PREREQUISITE"]);

const refuse = () => { throw new Error("CAPTURE_TASK_PACKET_REFUSED"); };
const freeze = value => { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
function exact(value, keys) {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key)) ||
      keys.some(key => !Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable)) refuse();
}
function dataArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > CAPTURE_TASK_STAGES.length) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== value.length + 1 || keys.some(key => typeof key !== "string" || key !== "length" && !/^(0|[1-9]\d*)$/.test(key))) refuse();
  for (let index = 0; index < value.length; index++) {
    const item = descriptors[index];
    if (!item || !Object.hasOwn(item, "value") || !item.enumerable) refuse();
  }
}
const LOWER = Object.freeze({
  requests: [3, 7, 11, 18, 21, 24, 28, 32, 36, 40, 45],
  rpcRequests: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 29],
  publicRequests: [2, 3, 4, 8, 8, 8, 9, 10, 11, 12, 16],
  coreCommands: [0, 1, 2, 3, 4, 4, 5, 6, 7, 8, 8],
  commitAttempts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9],
  committedReplies: [0, 1, 2, 3, 3, 3, 4, 5, 6, 7, 7],
  replayedReplies: [0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2],
});
const CHECK_STAGES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10];

function report(value) {
  exact(value, CAPTURE_TASK_REPORT_KEYS); exact(value.counts, Object.keys(CAPTURE_TASK_COUNT_LIMITS)); exact(value.checks, CAPTURE_TASK_CHECKS);
  if (value.schemaVersion !== 1 || value.scenario !== "capture-task-persistence" || !["passed", "failed"].includes(value.status) || typeof value.writeOutcomeUncertain !== "boolean") refuse();
  const counts = value.counts;
  for (const [key, maximum] of Object.entries(CAPTURE_TASK_COUNT_LIMITS)) {
    if (!Number.isSafeInteger(counts[key]) || counts[key] < 0 || counts[key] > maximum) refuse();
  }
  if (counts.requests !== counts.rpcRequests + counts.publicRequests || counts.commitAttempts > counts.rpcRequests ||
      counts.committedReplies + counts.replayedReplies > counts.commitAttempts) refuse();
  dataArray(value.stages);
  const stages = value.stages.map((stage, index) => {
    exact(stage, ["name", "passed"]);
    if (stage.name !== CAPTURE_TASK_STAGES[index] || typeof stage.passed !== "boolean" || !stage.passed && index !== value.stages.length - 1) refuse();
    return { name: stage.name, passed: stage.passed };
  });
  const completed = stages.filter(stage => stage.passed).length;
  if (completed) {
    for (const [key, minimums] of Object.entries(LOWER)) if (counts[key] < minimums[completed - 1]) refuse();
  }
  CAPTURE_TASK_CHECKS.forEach((key, index) => {
    if (typeof value.checks[key] !== "boolean" || value.checks[key] !== (stages[CHECK_STAGES[index]]?.passed === true)) refuse();
  });
  const final = stages[10]?.passed === true;
  if (counts.events !== (final ? 8 : 0) || counts.receipts !== (final ? 7 : 0)) refuse();
  const passed = value.status === "passed";
  if (passed) {
    if (value.code !== "PASSED" || value.failurePoint !== null || value.writeOutcomeUncertain || completed !== CAPTURE_TASK_STAGES.length ||
        Object.entries(CAPTURE_TASK_PASS_COUNTS).some(([key, count]) => counts[key] !== count)) refuse();
  } else if (!CAPTURE_TASK_FAILURE_CODES.includes(value.code) || !CAPTURE_TASK_FAILURE_POINTS.includes(value.failurePoint) ||
      (value.failurePoint === "PREREQUISITE" ? stages.length !== 0 || value.code !== "STATE_REFUSED" : stages.at(-1)?.name !== value.failurePoint || stages.at(-1)?.passed !== false)) refuse();
  return freeze({ schemaVersion: 1, scenario: "capture-task-persistence", status: value.status, code: value.code, failurePoint: value.failurePoint, stages,
    counts: Object.fromEntries(Object.keys(CAPTURE_TASK_COUNT_LIMITS).map(key => [key, counts[key]])),
    checks: Object.fromEntries(CAPTURE_TASK_CHECKS.map(key => [key, value.checks[key]])), writeOutcomeUncertain: value.writeOutcomeUncertain });
}

/** Closed metadata only; matching values do not establish native execution. */
export function validateCaptureTaskPersistenceReport(value) {
  try { return report(value); } catch { refuse(); }
}
function assemble(value) {
  exact(value, ["report", "writeOutcomeUncertain"]);
  if (typeof value.writeOutcomeUncertain !== "boolean") refuse();
  const projected = value.report === null ? null : report(value.report);
  const uncertain = value.writeOutcomeUncertain || projected?.writeOutcomeUncertain === true;
  const code = projected?.status === "failed" ? "CAPTURE_TASK_FAILED" : uncertain ? "WRITE_OUTCOME_UNCERTAIN" : projected === null ? "DEPENDENCY_NOT_RUN" : "PASSED";
  return freeze({ schemaVersion: 1, scenario: "identity-data-api", status: code === "PASSED" ? "passed" : code === "DEPENDENCY_NOT_RUN" ? "not-run" : "failed", code, report: projected, writeOutcomeUncertain: uncertain });
}
/** Required null preserves an unexecuted dependency. Caller uncertainty is ORed. */
export function assembleCaptureTaskPacket(value) {
  try { return assemble(value); } catch { refuse(); }
}
export function validateCaptureTaskPacket(value) {
  try {
    exact(value, CAPTURE_TASK_PACKET_KEYS);
    if (value.schemaVersion !== 1 || value.scenario !== "identity-data-api" || !["passed", "failed", "not-run"].includes(value.status) || !CAPTURE_TASK_PACKET_CODES.includes(value.code)) refuse();
    const projected = assemble({ report: value.report, writeOutcomeUncertain: value.writeOutcomeUncertain });
    if (value.status !== projected.status || value.code !== projected.code || value.writeOutcomeUncertain !== projected.writeOutcomeUncertain) refuse();
    return projected;
  } catch { refuse(); }
}
