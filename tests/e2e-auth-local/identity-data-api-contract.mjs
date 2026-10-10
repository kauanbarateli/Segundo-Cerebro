// Pure disposable-CI metadata contract: no IO, credentials or transport.
export const AUTH_IDENTITY_REPORT_FILE = "auth-local-ci-report.json";
export const AUTH_IDENTITY_REPORT_KEYS = Object.freeze(["schemaVersion", "scenario", "status", "code", "failurePoint", "cleanupFailurePoint", "stages", "counts", "checks", "cleanupConfirmed"]);
export const AUTH_IDENTITY_STAGES = Object.freeze([
  "fixtures-created", "login-a1", "login-a2", "login-b", "protected-a1", "protected-a2", "protected-b", "distinct-a-sessions",
  "logout-global-a", "old-a-denied", "b-intact", "fixture-cleanup",
]);
export const AUTH_IDENTITY_CHECKS = Object.freeze(["loginA1", "loginA2", "loginB", "protectedA1", "protectedA2", "protectedB", "distinctASessions", "logoutGlobalA", "oldADenied", "bIntact", "cleanupConfirmed"]);
export const AUTH_IDENTITY_COUNT_LIMITS = Object.freeze({ fixtureCreated: 2, fixtureDeleted: 2, browserContexts: 3 });
export const AUTH_IDENTITY_CODES = Object.freeze(["PASSED", "ENVIRONMENT_REFUSED", "FIXTURE_CREATE_FAILED", "LOGIN_FAILED", "PROTECTED_SESSION_FAILED", "SESSION_ISOLATION_FAILED", "LOGOUT_FAILED", "OLD_SESSION_ACCEPTED", "OTHER_ACCOUNT_CHANGED", "CLEANUP_UNCONFIRMED", "REPORT_WRITE_FAILED", "ACCEPTANCE_FAILED"]);
export const AUTH_IDENTITY_FAILURE_POINTS = Object.freeze([
  "FIXTURE_CREATE", "BROWSER_CONTEXT_CREATE", "LOGIN_DOCUMENT", "LOGIN_FORM", "LOGIN_FIELDS", "LOGIN_SUBMIT_NAVIGATION", "LOGIN_DESTINATION",
  "SESSION_COOKIE_POLICY", "SESSION_COOKIE_HINT", "SESSION_USER_VERIFICATION", "SESSION_ACCESS_STATE", "SESSION_SCRIPT_COOKIE_ISOLATION", "SESSION_NETWORK_ISOLATION",
  "PROTECTED_PAGE", "DISTINCT_SESSIONS", "LOGOUT_DOCUMENT", "LOGOUT_SUBMIT_NAVIGATION", "LOGOUT_RESPONSE_POLICY", "LOGOUT_STATUS", "LOGOUT_LOCATION",
  "LOGOUT_PRIVATE_CACHE", "LOGOUT_NO_STORE_CACHE", "LOGOUT_CSP", "LOGOUT_NOSNIFF", "LOGOUT_STORAGE_CLEARANCE", "LOGOUT_COOKIE_CLEARANCE",
  "OLD_A_TOKEN_LIFETIME", "OLD_A_ACCESS_STATE", "OLD_A_PAGE_GUARD", "OTHER_B_SESSION_INTACT", "FIXTURE_CLEANUP",
  "IDENTITY_RLS_BEFORE", "EVENT_APPEND_ONLY", "IDENTITY_RLS_AFTER",
]);
export const AUTH_IDENTITY_CLEANUP_FAILURE_POINTS = Object.freeze(["OUTCOME_UNCERTAIN", "CONTEXT_CLOSE", "FIXTURE_PRECHECK", "SESSION_REVOCATION", "FIXTURE_DELETE_ACK", "FIXTURE_ABSENCE"]);

export const IDENTITY_RLS_PACKET_FILE = "auth-local-ci-identity-rls-report.json";
export const IDENTITY_RLS_PACKET_KEYS = Object.freeze(["schemaVersion", "scenario", "status", "code", "failurePhase", "before", "after", "writeOutcomeUncertain"]);
export const IDENTITY_RLS_PACKET_STATUSES = Object.freeze(["passed", "failed", "not-run"]);
export const IDENTITY_RLS_PACKET_CODES = Object.freeze(["PASSED", "BEFORE_FAILED", "AFTER_FAILED", "DEPENDENCY_NOT_RUN", "AFTER_NOT_RUN", "WRITE_OUTCOME_UNCERTAIN"]);
export const IDENTITY_RLS_PHASE_KEYS = Object.freeze(["schemaVersion", "scenario", "status", "code", "failurePoint", "counts", "checks", "writeOutcomeUncertain"]);
export const IDENTITY_RLS_PHASE_FAILURE_CODES = Object.freeze(["SETUP_REFUSED", "STATE_REFUSED", "RESPONSE_REFUSED", "DEADLINE_EXCEEDED", "TRANSPORT_FAILED", "OWNERSHIP_REFUSED", "SQL_REFUSAL_NOT_PROVEN", "SNAPSHOT_CHANGED", "ACCESS_STATE_REFUSED", "TOKEN_LIFETIME_REFUSED"]);
export const IDENTITY_RLS_COUNT_KEYS = Object.freeze(["requests", "directWriteAttempts", "sqlRefusals"]);
export const IDENTITY_RLS_BEFORE_CHECKS = Object.freeze(["ownA", "foreignA", "ownB", "foreignB", "anonClosed", "moderationUnreadable", "moderationUnwritable", "profileUnwritable", "ownSnapshotsPreserved", "ordinaryAccessPreserved"]);
export const IDENTITY_RLS_AFTER_CHECKS = Object.freeze(["oldAUnexpired", "oldAOwnHidden", "oldARpcDenied", "bOwnUnchanged", "bOrdinaryAccessIntact"]);
export const IDENTITY_RLS_BEFORE_POINTS = Object.freeze(["OWN_A", "FOREIGN_A", "OWN_B", "FOREIGN_B", "ANON_PROFILES", "MODERATION_READ", "MODERATION_WRITE", "PROFILE_WRITE", "REREAD_A", "REREAD_B", "ACCESS_A", "ACCESS_B", "PREREQUISITE"]);
export const IDENTITY_RLS_AFTER_POINTS = Object.freeze(["OLD_A_LIFETIME", "OLD_A_PROFILES", "OLD_A_RPC", "B_PROFILES", "B_RPC", "PREREQUISITE"]);
export const IDENTITY_RLS_BEFORE_COUNTS = Object.freeze({ requests: 12, directWriteAttempts: 2, sqlRefusals: 4 });
export const IDENTITY_RLS_AFTER_COUNTS = Object.freeze({ requests: 4, directWriteAttempts: 0, sqlRefusals: 1 });
const REFUSED = "IDENTITY_RLS_PACKET_REFUSED";
const refuse = () => { throw new Error(REFUSED); };

function exact(value, expected) {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), found = Reflect.ownKeys(descriptors);
  if (found.length !== expected.length || found.some(key => typeof key !== "string" || !expected.includes(key)) ||
      expected.some(key => !Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable)) refuse();
}

const freeze = value => {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
};

function phase(value, kind) {
  if (value === null) return null;
  const before = kind === "before", checkNames = before ? IDENTITY_RLS_BEFORE_CHECKS : IDENTITY_RLS_AFTER_CHECKS;
  const points = before ? IDENTITY_RLS_BEFORE_POINTS : IDENTITY_RLS_AFTER_POINTS;
  const limits = before ? IDENTITY_RLS_BEFORE_COUNTS : IDENTITY_RLS_AFTER_COUNTS;
  exact(value, IDENTITY_RLS_PHASE_KEYS); exact(value.counts, IDENTITY_RLS_COUNT_KEYS); exact(value.checks, checkNames);
  if (value.schemaVersion !== 1 || value.scenario !== (before ? "identity-rls-before" : "identity-rls-after") ||
      !["passed", "failed"].includes(value.status) || typeof value.writeOutcomeUncertain !== "boolean") refuse();
  for (const key of IDENTITY_RLS_COUNT_KEYS) {
    if (!Number.isSafeInteger(value.counts[key]) || value.counts[key] < 0 || value.counts[key] > limits[key]) refuse();
  }
  if (value.counts.directWriteAttempts > value.counts.requests || value.counts.sqlRefusals > value.counts.requests) refuse();
  let interrupted = false;
  for (const name of checkNames) {
    if (typeof value.checks[name] !== "boolean" || interrupted && value.checks[name]) refuse();
    if (!value.checks[name]) interrupted = true;
  }
  // Lower bounds prevent successful checkpoints borrowed from another phase or
  // from Auth booleans. Counts are attempts, not proof of provider execution.
  const requestMinimum = before ? [1, 2, 3, 4, 5, 6, 7, 8, 10, 12] : [0, 1, 2, 3, 4];
  const writeMinimum = before ? [0, 0, 0, 0, 0, 0, 1, 2, 2, 2] : [0, 0, 0, 0, 0];
  const refusalMinimum = before ? [0, 0, 0, 0, 1, 2, 3, 4, 4, 4] : [0, 0, 1, 1, 1];
  checkNames.forEach((name, index) => {
    if (value.checks[name] && (value.counts.requests < requestMinimum[index] ||
        value.counts.directWriteAttempts < writeMinimum[index] || value.counts.sqlRefusals < refusalMinimum[index])) refuse();
  });
  if (value.status === "passed") {
    if (value.code !== "PASSED" || value.failurePoint !== null || interrupted || value.writeOutcomeUncertain ||
        IDENTITY_RLS_COUNT_KEYS.some(key => value.counts[key] !== limits[key])) refuse();
  } else if (!IDENTITY_RLS_PHASE_FAILURE_CODES.includes(value.code) || !points.includes(value.failurePoint)) refuse();
  return {
    schemaVersion: 1, scenario: value.scenario, status: value.status, code: value.code, failurePoint: value.failurePoint,
    counts: Object.fromEntries(IDENTITY_RLS_COUNT_KEYS.map(key => [key, value.counts[key]])),
    checks: Object.fromEntries(checkNames.map(key => [key, value.checks[key]])), writeOutcomeUncertain: value.writeOutcomeUncertain,
  };
}

function assemble(value) {
  exact(value, ["before", "after", "writeOutcomeUncertain"]);
  if (typeof value.writeOutcomeUncertain !== "boolean") refuse();
  const before = phase(value.before, "before"), after = phase(value.after, "after");
  if (after !== null && before?.status !== "passed") refuse();
  const uncertain = value.writeOutcomeUncertain || before?.writeOutcomeUncertain === true || after?.writeOutcomeUncertain === true;
  let status, code, failurePhase = null;
  if (before?.status === "failed") { status = "failed"; code = "BEFORE_FAILED"; failurePhase = "before"; }
  else if (after?.status === "failed") { status = "failed"; code = "AFTER_FAILED"; failurePhase = "after"; }
  else if (uncertain) { status = "failed"; code = "WRITE_OUTCOME_UNCERTAIN"; }
  else if (before === null) { status = "not-run"; code = "DEPENDENCY_NOT_RUN"; }
  else if (after === null) { status = "not-run"; code = "AFTER_NOT_RUN"; }
  else { status = "passed"; code = "PASSED"; }
  return freeze({ schemaVersion: 1, scenario: "identity-data-api", status, code, failurePhase, before, after, writeOutcomeUncertain: uncertain });
}

/** Explicit nulls preserve unexecuted phases after an Auth prerequisite fails.
 * The caller's sticky bit is required and ORed with both phase bits. */
export function assembleIdentityRlsPacket(value) {
  try { return assemble(value); } catch { refuse(); }
}

/** Pure closed projection; rejects unknown fields and inconsistent sequencing.
 * This validates metadata, not the provenance of a CI run or RLS by itself. */
export function validateIdentityRlsPacket(value) {
  try {
    exact(value, IDENTITY_RLS_PACKET_KEYS);
    if (value.schemaVersion !== 1 || value.scenario !== "identity-data-api" || !IDENTITY_RLS_PACKET_STATUSES.includes(value.status) ||
        !IDENTITY_RLS_PACKET_CODES.includes(value.code) || ![null, "before", "after"].includes(value.failurePhase)) refuse();
    const projected = assemble({ before: value.before, after: value.after, writeOutcomeUncertain: value.writeOutcomeUncertain });
    if (value.status !== projected.status || value.code !== projected.code || value.failurePhase !== projected.failurePhase ||
        value.writeOutcomeUncertain !== projected.writeOutcomeUncertain) refuse();
    return projected;
  } catch { refuse(); }
}

function dataArray(value, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== value.length + 1 || keys.some(key => typeof key !== "string" || key !== "length" && !/^(0|[1-9]\d*)$/.test(key))) refuse();
  for (let index = 0; index < value.length; index++) {
    const entry = descriptors[index];
    if (!entry || !Object.hasOwn(entry, "value") || !entry.enumerable) refuse();
  }
}

/** Auth is an independent component; this does not certify either auxiliary. */
export function validateIdentityAuthReport(value) {
  try {
    exact(value, AUTH_IDENTITY_REPORT_KEYS);
    exact(value.counts, Object.keys(AUTH_IDENTITY_COUNT_LIMITS)); exact(value.checks, AUTH_IDENTITY_CHECKS);
    if (value.schemaVersion !== 3 || value.scenario !== "identity-data-api" || !["passed", "failed"].includes(value.status) ||
        !AUTH_IDENTITY_CODES.includes(value.code) || typeof value.cleanupConfirmed !== "boolean") refuse();
    for (const [key, limit] of Object.entries(AUTH_IDENTITY_COUNT_LIMITS)) {
      if (!Number.isSafeInteger(value.counts[key]) || value.counts[key] < 0 || value.counts[key] > limit) refuse();
    }
    if (value.counts.fixtureDeleted > value.counts.fixtureCreated || AUTH_IDENTITY_CHECKS.some(key => typeof value.checks[key] !== "boolean") ||
        value.checks.cleanupConfirmed !== value.cleanupConfirmed || value.cleanupConfirmed && value.counts.fixtureDeleted !== value.counts.fixtureCreated) refuse();
    if (value.cleanupConfirmed ? value.cleanupFailurePoint !== null : !AUTH_IDENTITY_CLEANUP_FAILURE_POINTS.includes(value.cleanupFailurePoint)) refuse();
    const passed = value.status === "passed";
    if (passed ? value.failurePoint !== null : !AUTH_IDENTITY_FAILURE_POINTS.includes(value.failurePoint)) refuse();
    dataArray(value.stages, AUTH_IDENTITY_STAGES.length);
    let previous = -1;
    const stages = value.stages.map(stage => {
      exact(stage, ["name", "passed"]);
      const index = AUTH_IDENTITY_STAGES.indexOf(stage.name);
      if (typeof stage.passed !== "boolean" || index <= previous) refuse();
      previous = index; return { name: stage.name, passed: stage.passed };
    });
    if (passed !== (value.code === "PASSED") || passed && (!value.cleanupConfirmed || stages.length !== AUTH_IDENTITY_STAGES.length ||
        stages.some(stage => !stage.passed) || AUTH_IDENTITY_CHECKS.some(key => !value.checks[key]) ||
        Object.entries(AUTH_IDENTITY_COUNT_LIMITS).some(([key, limit]) => value.counts[key] !== limit))) refuse();
    return freeze({ schemaVersion: 3, scenario: "identity-data-api", status: value.status, code: value.code,
      failurePoint: value.failurePoint, cleanupFailurePoint: value.cleanupFailurePoint, stages,
      counts: Object.fromEntries(Object.keys(AUTH_IDENTITY_COUNT_LIMITS).map(key => [key, value.counts[key]])),
      checks: Object.fromEntries(AUTH_IDENTITY_CHECKS.map(key => [key, value.checks[key]])), cleanupConfirmed: value.cleanupConfirmed });
  } catch { throw new Error("IDENTITY_AUTH_REPORT_REFUSED"); }
}

export const EVENT_PACKET_FILE = "auth-local-ci-events-report.json";
export const EVENT_PACKET_KEYS = Object.freeze(["schemaVersion", "scenario", "status", "code", "report", "writeOutcomeUncertain"]);
export const EVENT_PACKET_CODES = Object.freeze(["PASSED", "EVENT_FAILED", "DEPENDENCY_NOT_RUN", "WRITE_OUTCOME_UNCERTAIN"]);
export const EVENT_REPORT_KEYS = Object.freeze(["schemaVersion", "scenario", "status", "code", "failurePoint", "stages", "counts", "checks", "writeOutcomeUncertain"]);
export const EVENT_STAGES = Object.freeze(["A_BASELINE", "B_BASELINE", "EVENT_RPC", "A_DELTA", "B_FOREIGN_BEFORE", "EVENT_UPDATE", "EVENT_AFTER_UPDATE", "EVENT_DELETE", "EVENT_AFTER_DELETE", "A_FINAL", "B_FINAL", "B_FOREIGN_AFTER"]);
export const EVENT_CHECKS = Object.freeze(["ownANonempty", "ownBNonempty", "legitimateEventCreated", "metadataOnly", "updateDenied", "deleteDenied", "eventUnchanged", "bUnchanged", "foreignHidden"]);
export const EVENT_COUNT_LIMITS = Object.freeze({ requests: 12, readRequests: 9, rpcWriteAttempts: 1, directWriteAttempts: 2, sqlRefusals: 2, baselineARecords: 64, baselineBRecords: 64, eventCreated: 1 });
export const EVENT_FAILURE_CODES = Object.freeze(["SETUP_REFUSED", "STATE_REFUSED", "RESPONSE_REFUSED", "DEADLINE_EXCEEDED", "TRANSPORT_FAILED", "OWNERSHIP_REFUSED", "SQL_REFUSAL_NOT_PROVEN", "SNAPSHOT_CHANGED", "EVENT_CREATION_REFUSED", "RPC_ACK_REFUSED", "TOKEN_LIFETIME_REFUSED"]);
export const EVENT_FAILURE_POINTS = Object.freeze([...EVENT_STAGES, "PREREQUISITE"]);

function eventReport(value) {
  if (value === null) return null;
  exact(value, EVENT_REPORT_KEYS); exact(value.counts, Object.keys(EVENT_COUNT_LIMITS)); exact(value.checks, EVENT_CHECKS);
  if (value.schemaVersion !== 1 || value.scenario !== "events-append-only" || !["passed", "failed"].includes(value.status) || typeof value.writeOutcomeUncertain !== "boolean") refuse();
  for (const [key, limit] of Object.entries(EVENT_COUNT_LIMITS)) {
    if (!Number.isSafeInteger(value.counts[key]) || value.counts[key] < 0 || value.counts[key] > limit) refuse();
  }
  const counts = value.counts;
  if (counts.requests !== counts.readRequests + counts.rpcWriteAttempts + counts.directWriteAttempts || counts.sqlRefusals > counts.directWriteAttempts) refuse();
  dataArray(value.stages, EVENT_STAGES.length);
  const stages = value.stages.map((stage, index) => {
    exact(stage, ["name", "passed"]);
    if (stage.name !== EVENT_STAGES[index] || typeof stage.passed !== "boolean" || !stage.passed && index !== value.stages.length - 1) refuse();
    return { name: stage.name, passed: stage.passed };
  });
  const completed = stages.filter(stage => stage.passed).length;
  const attempted = stages.length;
  // Each operation is finite. A failed lifetime check can occur before dispatch;
  // attempt counters never assert that a provider executed the operation.
  if (counts.requests < completed || counts.requests > attempted) refuse();
  const methods = ["GET", "GET", "POST", "GET", "GET", "PATCH", "GET", "DELETE", "GET", "GET", "GET", "GET"];
  for (const [key, predicate] of [["readRequests", method => method === "GET"], ["rpcWriteAttempts", method => method === "POST"], ["directWriteAttempts", method => ["PATCH", "DELETE"].includes(method)]]) {
    if (counts[key] < methods.slice(0, completed).filter(predicate).length || counts[key] > methods.slice(0, attempted).filter(predicate).length) refuse();
  }
  const checkStages = [0, 1, 3, 3, 5, 7, 9, 10, 11];
  EVENT_CHECKS.forEach((key, index) => {
    if (typeof value.checks[key] !== "boolean" || value.checks[key] !== (stages[checkStages[index]]?.passed === true)) refuse();
  });
  if (value.checks.ownANonempty ? counts.baselineARecords < 1 : counts.baselineARecords !== 0) refuse();
  if (value.checks.ownBNonempty ? counts.baselineBRecords < 1 : counts.baselineBRecords !== 0) refuse();
  if (counts.eventCreated !== (value.checks.legitimateEventCreated ? 1 : 0) || counts.sqlRefusals !== Number(value.checks.updateDenied) + Number(value.checks.deleteDenied)) refuse();
  const passed = value.status === "passed";
  if (passed) {
    if (value.code !== "PASSED" || value.failurePoint !== null || value.writeOutcomeUncertain || completed !== EVENT_STAGES.length ||
        counts.requests !== 12 || counts.readRequests !== 9 || counts.rpcWriteAttempts !== 1 || counts.directWriteAttempts !== 2 || counts.sqlRefusals !== 2 ||
        counts.baselineARecords > 63 || EVENT_CHECKS.some(key => !value.checks[key])) refuse();
  } else if (!EVENT_FAILURE_CODES.includes(value.code) || !EVENT_FAILURE_POINTS.includes(value.failurePoint) ||
      (value.failurePoint === "PREREQUISITE" ? stages.length !== 0 || value.code !== "STATE_REFUSED" : stages.at(-1)?.name !== value.failurePoint || stages.at(-1)?.passed !== false)) refuse();
  return { schemaVersion: 1, scenario: "events-append-only", status: value.status, code: value.code, failurePoint: value.failurePoint, stages,
    counts: Object.fromEntries(Object.keys(EVENT_COUNT_LIMITS).map(key => [key, counts[key]])),
    checks: Object.fromEntries(EVENT_CHECKS.map(key => [key, value.checks[key]])), writeOutcomeUncertain: value.writeOutcomeUncertain };
}

function assembleEvents(value) {
  exact(value, ["report", "writeOutcomeUncertain"]);
  if (typeof value.writeOutcomeUncertain !== "boolean") refuse();
  const report = eventReport(value.report), uncertain = value.writeOutcomeUncertain || report?.writeOutcomeUncertain === true;
  const code = report?.status === "failed" ? "EVENT_FAILED" : uncertain ? "WRITE_OUTCOME_UNCERTAIN" : report === null ? "DEPENDENCY_NOT_RUN" : "PASSED";
  const status = code === "PASSED" ? "passed" : code === "DEPENDENCY_NOT_RUN" ? "not-run" : "failed";
  return freeze({ schemaVersion: 1, scenario: "identity-data-api", status, code, report, writeOutcomeUncertain: uncertain });
}

/** Required null means unexecuted; a sticky write bit cannot be masked by Auth. */
export function assembleEventsPacket(value) {
  try { return assembleEvents(value); } catch { throw new Error("EVENT_PACKET_REFUSED"); }
}
export function validateEventsPacket(value) {
  try {
    exact(value, EVENT_PACKET_KEYS);
    if (value.schemaVersion !== 1 || value.scenario !== "identity-data-api" || !IDENTITY_RLS_PACKET_STATUSES.includes(value.status) || !EVENT_PACKET_CODES.includes(value.code)) refuse();
    const projected = assembleEvents({ report: value.report, writeOutcomeUncertain: value.writeOutcomeUncertain });
    if (projected.status !== value.status || projected.code !== value.code || projected.writeOutcomeUncertain !== value.writeOutcomeUncertain) refuse();
    return projected;
  } catch { throw new Error("EVENT_PACKET_REFUSED"); }
}
