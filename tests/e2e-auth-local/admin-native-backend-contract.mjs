// Closed protocol metadata. Pure validation never establishes native Auth,
// SQL, namespace or browser provenance; an own Linux CI envelope is required.
export const ADMIN_NATIVE_MANIFEST = Object.freeze([
  "tests/e2e-auth-local/admin-native-backend.entry.ts",
  "tests/e2e-auth-local/admin-native-backend-case.mjs",
  "tests/e2e-auth-local/admin-native-backend-case.d.mts",
  "tests/e2e-auth-local/admin-native-backend-contract.mjs",
  "tests/e2e-auth-local/admin-native-backend-contract.d.mts",
  "tests/scripts/admin-native-backend-case.test.mjs",
  "tests/scripts/admin-native-backend-contract.test.mjs",
  "tests/scripts/admin-native-backend.types.mts",
]);
export const ADMIN_NATIVE_CASES = Object.freeze(["BLOCK_OLD_JWT", "SELF_AND_LAST_MASTER", "CREATE_FORCED"]);
export const ADMIN_NATIVE_STAGES = Object.freeze({
  BLOCK_OLD_JWT: Object.freeze(["BASELINE", "FENCE", "TERMINAL", "REPLAY", "CONFLICT", "PUBLIC_DENIAL", "MASTER_RETAINED", "SQL_FINAL"]),
  SELF_AND_LAST_MASTER: Object.freeze(["BASELINE", "SELF_REFUSALS", "SECOND_MASTER", "DEMOTION", "LAST_MASTER", "SQL_FINAL"]),
  CREATE_FORCED: Object.freeze(["BASELINE", "FENCE", "CREATED_FENCE", "COMPLETE", "REPLAY", "CONFLICT", "FORCED_LOGIN", "SQL_FINAL"]),
});
export const ADMIN_NATIVE_CHECKS = Object.freeze({
  BLOCK_OLD_JWT: Object.freeze(["identitiesBound", "fenceBeforeAuth", "blockedAndRevoked", "replayWithoutEffect", "alteredIntentRefused", "oldJwtCannotReactivate", "actorStillUsable", "exactSqlMetadata"]),
  SELF_AND_LAST_MASTER: Object.freeze(["identitiesBound", "selfMutationsRefused", "secondMasterUsable", "demotionComplete", "lastMasterPreserved", "exactSqlMetadata"]),
  CREATE_FORCED: Object.freeze(["identitiesBound", "reservationBeforeCreate", "createdBannedAndForced", "creationComplete", "replayWithoutEffect", "alteredIntentRefused", "forcedSessionDenied", "exactSqlMetadata"]),
});
export const ADMIN_NATIVE_FAILURE_CODES = Object.freeze(["SETUP_REFUSED", "GRAPH_REFUSED", "STATE_REFUSED", "TOKEN_LIFETIME_REFUSED", "CALL_LIMIT_REFUSED", "TRANSPORT_REFUSED", "TRANSPORT_FAILED", "DEADLINE_EXCEEDED", "RESPONSE_REFUSED", "OWNERSHIP_REFUSED", "SQL_REFUSED", "AUTH_NOT_PROVEN", "PERSISTENCE_NOT_PROVEN", "SAGA_NOT_TERMINAL", "CLEANUP_NOT_PROVEN", "WRITE_OUTCOME_UNCERTAIN"]);
export const ADMIN_NATIVE_LIMITS = Object.freeze({ requests: 48, cleanupRequests: 16, responseBytes: 1048576, timeoutMs: 15000, sourceBytes: 1048576 });
// Fresh block8/create12/role2 Admin RPCs are derived from the original ports.
// Replay and changed commitment each add2 Admin RPCs, never an Auth effect.
// Counts exclude SDK fixture creation/initial login and SQL bootstrap. The
// create10 event delta includes real provisioning4 + creation fence1, separate
// from its audit/authentication4 and final moderation1; no absolute total.
export const ADMIN_NATIVE_PASS_COUNTS = Object.freeze({
  BLOCK_OLD_JWT: Object.freeze({ requests: 24, adminRpcRequests: 12, otherRpcRequests: 5, authReadRequests: 3, authMutationRequests: 1, authLoginRequests: 0, publicRequests: 3, coreCommands: 3, coreSafetyChecks: 0, sqlInspections: 7, authEffects: 1, operations: 1, auditEntries: 4, receipts: 1, events: 6 }),
  SELF_AND_LAST_MASTER: Object.freeze({ requests: 16, adminRpcRequests: 10, otherRpcRequests: 4, authReadRequests: 2, authMutationRequests: 0, authLoginRequests: 0, publicRequests: 0, coreCommands: 5, coreSafetyChecks: 1, sqlInspections: 8, authEffects: 0, operations: 2, auditEntries: 2, receipts: 2, events: 4 }),
  CREATE_FORCED: Object.freeze({ requests: 28, adminRpcRequests: 16, otherRpcRequests: 4, authReadRequests: 5, authMutationRequests: 2, authLoginRequests: 1, publicRequests: 0, coreCommands: 3, coreSafetyChecks: 0, sqlInspections: 8, authEffects: 2, operations: 1, auditEntries: 4, receipts: 1, events: 10 }),
});
export const ADMIN_NATIVE_CLEANUP_STAGES = Object.freeze({
  BLOCK_OLD_JWT: Object.freeze(["INVENTORY", "REVOKE", "DELETE_A", "ABSENT_A", "DELETE_B", "ABSENT_B", "RETAINED_SQL"]),
  SELF_AND_LAST_MASTER: Object.freeze(["INVENTORY", "REVOKE", "DELETE_A", "ABSENT_A", "DELETE_B", "ABSENT_B", "RETAINED_SQL"]),
  CREATE_FORCED: Object.freeze(["INVENTORY", "REVOKE", "DELETE_A", "ABSENT_A", "DELETE_B", "ABSENT_B", "DELETE_C", "ABSENT_C", "RETAINED_SQL"]),
});
export const ADMIN_NATIVE_CLEANUP_COUNTS = Object.freeze({
  BLOCK_OLD_JWT: Object.freeze({ requests: 7, authReadRequests: 2, revokeRequests: 1, deleteRequests: 2, absenceReads: 2, removedUsers: 2, sqlInspections: 3, retainedOperations: 1, retainedAuditEntries: 4, receiptsRemaining: 0 }),
  SELF_AND_LAST_MASTER: Object.freeze({ requests: 8, authReadRequests: 2, revokeRequests: 2, deleteRequests: 2, absenceReads: 2, removedUsers: 2, sqlInspections: 3, retainedOperations: 2, retainedAuditEntries: 2, receiptsRemaining: 0 }),
  CREATE_FORCED: Object.freeze({ requests: 12, authReadRequests: 3, revokeRequests: 3, deleteRequests: 3, absenceReads: 3, removedUsers: 3, sqlInspections: 3, retainedOperations: 1, retainedAuditEntries: 4, receiptsRemaining: 0 }),
});
export const ADMIN_NATIVE_SQL_QUERIES = Object.freeze(["BASELINE", "FENCE", "CREATED_FENCE", "TERMINAL", "UNCHANGED", "SECOND_MASTER", "DEMOTION", "ASSERT_LAST_MASTER", "FORCED_SESSION", "FINAL", "CLEANUP_INVENTORY", "CLEANUP_REVOKED", "CLEANUP_RETAINED"]);
export const ADMIN_NATIVE_REPORT_KEYS = Object.freeze(["schemaVersion", "scenario", "provenance", "case", "sourceSha", "sourceHashes", "status", "code", "failurePoint", "stages", "counts", "checks", "terminalKnown", "writeOutcomeUncertain"]);
export const ADMIN_NATIVE_CLEANUP_KEYS = Object.freeze(["schemaVersion", "scenario", "provenance", "case", "sourceSha", "status", "code", "failurePoint", "stages", "counts", "terminalKnown", "exactInventory", "accountsAbsent", "receiptsAbsent", "retainedAdminMetadataExact", "writeOutcomeUncertain"]);
export const ADMIN_NATIVE_PACKET_KEYS = Object.freeze(["schemaVersion", "scenario", "provenance", "sourceSha", "status", "code", "cases", "writeOutcomeUncertain"]);
const LOWER = {
  BLOCK_OLD_JWT: { requests: [5, 10, 14, 16, 18, 22, 24, 24], adminRpcRequests: [0, 5, 8, 10, 12, 12, 12, 12], otherRpcRequests: [3, 3, 3, 3, 3, 4, 5, 5], authReadRequests: [2, 2, 2, 2, 2, 2, 3, 3], authMutationRequests: [0, 0, 1, 1, 1, 1, 1, 1], authLoginRequests: [0, 0, 0, 0, 0, 0, 0, 0], publicRequests: [0, 0, 0, 0, 0, 3, 3, 3], coreCommands: [0, 1, 1, 2, 3, 3, 3, 3], coreSafetyChecks: [0, 0, 0, 0, 0, 0, 0, 0], authEffects: [0, 0, 1, 1, 1, 1, 1, 1], sqlInspections: [1, 2, 3, 4, 5, 6, 6, 7] },
  SELF_AND_LAST_MASTER: { requests: [4, 10, 13, 16, 16, 16], adminRpcRequests: [0, 6, 8, 10, 10, 10], otherRpcRequests: [2, 2, 3, 4, 4, 4], authReadRequests: [2, 2, 2, 2, 2, 2], authMutationRequests: [0, 0, 0, 0, 0, 0], authLoginRequests: [0, 0, 0, 0, 0, 0], publicRequests: [0, 0, 0, 0, 0, 0], coreCommands: [0, 3, 4, 5, 5, 5], coreSafetyChecks: [0, 0, 0, 0, 1, 1], authEffects: [0, 0, 0, 0, 0, 0], sqlInspections: [1, 4, 5, 6, 7, 8] },
  CREATE_FORCED: { requests: [4, 10, 11, 20, 22, 24, 28, 28], adminRpcRequests: [0, 5, 5, 12, 14, 16, 16, 16], otherRpcRequests: [2, 2, 2, 2, 2, 2, 4, 4], authReadRequests: [2, 3, 3, 4, 4, 4, 5, 5], authMutationRequests: [0, 0, 1, 2, 2, 2, 2, 2], authLoginRequests: [0, 0, 0, 0, 0, 0, 1, 1], publicRequests: [0, 0, 0, 0, 0, 0, 0, 0], coreCommands: [0, 1, 1, 1, 2, 3, 3, 3], coreSafetyChecks: [0, 0, 0, 0, 0, 0, 0, 0], authEffects: [0, 0, 1, 2, 2, 2, 2, 2], sqlInspections: [1, 2, 3, 4, 5, 6, 7, 8] },
};
const CLEANUP_LOWER = { BLOCK_OLD_JWT: [2, 3, 4, 5, 6, 7, 7], SELF_AND_LAST_MASTER: [2, 4, 5, 6, 7, 8, 8], CREATE_FORCED: [3, 6, 7, 8, 9, 10, 11, 12, 12] };
const SHA = /^[a-f0-9]{40}$/, HASH = /^[a-f0-9]{64}$/;
const refuse = () => { throw new Error("ADMIN_NATIVE_PACKET_REFUSED"); };
const freeze = value => { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
// Read one descriptor snapshot, recursively, before any semantic validation.
// No later read or spread touches the original object. In particular a Proxy
// get trap cannot change a validated value between checking and projection.
function snapshot(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 4096 || depth > 16) refuse();
  if (value === null || typeof value !== "object") return value;
  const isArray = Array.isArray(value), prototype = Object.getPrototypeOf(value);
  if (prototype !== (isArray ? Array.prototype : Object.prototype)) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), projected = isArray ? [] : {};
  if (keys.length > 128 || keys.some(key => typeof key !== "string")) refuse();
  if (isArray && (!descriptors.length || !Object.hasOwn(descriptors.length, "value") || !Number.isSafeInteger(descriptors.length.value) || descriptors.length.value > 128)) refuse();
  for (const name of keys) {
    const descriptor = descriptors[name]; if (!Object.hasOwn(descriptor, "value")) refuse();
    if (isArray && name === "length") continue;
    Object.defineProperty(projected, name, { value: snapshot(descriptor.value, depth + 1, budget), enumerable: descriptor.enumerable, configurable: true, writable: true });
  }
  if (isArray) projected.length = descriptors.length.value;
  return projected;
}
function exact(value, names) {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== names.length || keys.some(key => typeof key !== "string" || !names.includes(key)) || names.some(name => !Object.hasOwn(descriptors, name) || !Object.hasOwn(descriptors[name], "value") || !descriptors[name].enumerable)) refuse();
}
function array(value, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== value.length + 1 || keys.some(key => typeof key !== "string" || key !== "length" && !/^(0|[1-9][0-9]*)$/.test(key))) refuse();
  for (let index = 0; index < value.length; index++) if (!descriptors[index] || !Object.hasOwn(descriptors[index], "value") || !descriptors[index].enumerable) refuse();
}
function steps(value, names) {
  array(value, names.length); return value.map((stage, index) => { exact(stage, ["name", "passed"]); if (stage.name !== names[index] || typeof stage.passed !== "boolean" || !stage.passed && index !== value.length - 1) refuse(); return { name: stage.name, passed: stage.passed }; });
}
function source(value) {
  array(value, ADMIN_NATIVE_MANIFEST.length); if (value.length !== ADMIN_NATIVE_MANIFEST.length) refuse();
  return value.map((row, index) => { exact(row, ["path", "sha256", "bytes"]); if (row.path !== ADMIN_NATIVE_MANIFEST[index] || typeof row.sha256 !== "string" || !HASH.test(row.sha256) || !Number.isSafeInteger(row.bytes) || row.bytes < 1 || row.bytes > ADMIN_NATIVE_LIMITS.sourceBytes) refuse(); return { path: row.path, sha256: row.sha256, bytes: row.bytes }; });
}
function base(value, scenario) {
  if (value.schemaVersion !== 1 || value.scenario !== scenario || value.provenance !== "protocol-only" || !ADMIN_NATIVE_CASES.includes(value.case) || typeof value.sourceSha !== "string" || !SHA.test(value.sourceSha) || !["passed", "failed"].includes(value.status) || typeof value.terminalKnown !== "boolean" || typeof value.writeOutcomeUncertain !== "boolean") refuse();
}
function failure(value, stages, names) {
  if (!ADMIN_NATIVE_FAILURE_CODES.includes(value.code) || !["PREREQUISITE", ...names].includes(value.failurePoint) || value.code === "WRITE_OUTCOME_UNCERTAIN" && !value.writeOutcomeUncertain) refuse();
  if (value.failurePoint === "PREREQUISITE" ? stages.length !== 0 : stages.at(-1)?.name !== value.failurePoint || stages.at(-1)?.passed !== false) refuse();
}
function pipeline(value) {
  exact(value, ADMIN_NATIVE_REPORT_KEYS); base(value, "admin-native-backend"); const maximum = ADMIN_NATIVE_PASS_COUNTS[value.case];
  exact(value.counts, Object.keys(maximum)); exact(value.checks, ADMIN_NATIVE_CHECKS[value.case]); const manifests = source(value.sourceHashes), stages = steps(value.stages, ADMIN_NATIVE_STAGES[value.case]), completed = stages.filter(stage => stage.passed).length;
  for (const [key, count] of Object.entries(value.counts)) { const cap = key === "requests" ? ADMIN_NATIVE_LIMITS.requests : maximum[key] + (key === "adminRpcRequests" ? 1 : 0); if (!Number.isSafeInteger(count) || count < 0 || count > cap) refuse(); }
  const counts = value.counts;
  if (counts.requests !== counts.adminRpcRequests + counts.otherRpcRequests + counts.authReadRequests + counts.authMutationRequests + counts.authLoginRequests + counts.publicRequests || counts.authEffects > counts.authMutationRequests) refuse();
  ADMIN_NATIVE_CHECKS[value.case].forEach((key, index) => { if (value.checks[key] !== (stages[index]?.passed === true)) refuse(); });
  if (completed) for (const [key, minima] of Object.entries(LOWER[value.case])) if (counts[key] < minima[completed - 1]) refuse();
  const final = stages.at(-1)?.name === "SQL_FINAL" && stages.at(-1).passed;
  for (const key of ["operations", "auditEntries", "receipts", "events"]) if (counts[key] !== (final ? maximum[key] : 0)) refuse();
  const terminalStage = value.case === "BLOCK_OLD_JWT" ? "TERMINAL" : value.case === "SELF_AND_LAST_MASTER" ? "DEMOTION" : "COMPLETE";
  if (value.terminalKnown && !stages.some(stage => stage.name === terminalStage && stage.passed)) refuse();
  if (value.failurePoint === "PREREQUISITE" && (Object.values(counts).some(count => count !== 0) || value.terminalKnown)) refuse();
  if (value.status === "passed") { if (value.code !== "PASSED" || value.failurePoint !== null || value.writeOutcomeUncertain || !value.terminalKnown || completed !== ADMIN_NATIVE_STAGES[value.case].length || Object.entries(maximum).some(([key, count]) => counts[key] !== count)) refuse(); }
  else failure(value, stages, ADMIN_NATIVE_STAGES[value.case]);
  return freeze({ ...value, sourceHashes: manifests, stages, counts: { ...counts }, checks: { ...value.checks } });
}
function cleanup(value) {
  exact(value, ADMIN_NATIVE_CLEANUP_KEYS); base(value, "admin-native-backend-cleanup"); const maximum = ADMIN_NATIVE_CLEANUP_COUNTS[value.case]; exact(value.counts, Object.keys(maximum));
  const stages = steps(value.stages, ADMIN_NATIVE_CLEANUP_STAGES[value.case]), completed = stages.filter(stage => stage.passed).length, counts = value.counts;
  for (const [key, count] of Object.entries(counts)) { const cap = key === "requests" ? ADMIN_NATIVE_LIMITS.cleanupRequests : maximum[key]; if (!Number.isSafeInteger(count) || count < 0 || count > cap) refuse(); }
  if (counts.requests !== counts.authReadRequests + counts.revokeRequests + counts.deleteRequests + counts.absenceReads || counts.removedUsers !== stages.filter(stage => stage.passed && stage.name.startsWith("ABSENT_")).length) refuse();
  if (completed && counts.requests < CLEANUP_LOWER[value.case][completed - 1]) refuse();
  if (completed && (counts.authReadRequests < maximum.authReadRequests || counts.sqlInspections < (completed > 1 ? 2 : 1)) || stages[1]?.passed && counts.revokeRequests < maximum.revokeRequests || counts.deleteRequests < stages.filter(stage => stage.passed && stage.name.startsWith("DELETE_")).length || counts.absenceReads < counts.removedUsers) refuse();
  if (!stages[0]?.passed && ["revokeRequests", "deleteRequests", "absenceReads", "removedUsers"].some(key => counts[key] !== 0) || !stages[1]?.passed && ["deleteRequests", "absenceReads", "removedUsers"].some(key => counts[key] !== 0)) refuse();
  for (const [key, prefix] of [["deleteRequests", "DELETE_"], ["absenceReads", "ABSENT_"]]) if (counts[key] > stages.filter(stage => stage.name.startsWith(prefix)).length) refuse();
  const final = stages.at(-1)?.name === "RETAINED_SQL" && stages.at(-1).passed;
  for (const key of ["retainedOperations", "retainedAuditEntries", "receiptsRemaining"]) if (counts[key] !== (final ? maximum[key] : 0)) refuse();
  // Unknown may first arise during this cleanup's logout/DELETE. Preserve the
  // failed prefix instead of refusing its factual metadata. Cross-report
  // validation below prevents starting cleanup after pipeline unknown.
  if (stages.length > 1 && !value.terminalKnown) refuse();
  for (const key of ["exactInventory", "accountsAbsent", "receiptsAbsent", "retainedAdminMetadataExact"]) if (typeof value[key] !== "boolean" || value[key] !== (value.status === "passed")) refuse();
  if (value.status === "passed") { if (value.code !== "PASSED" || value.failurePoint !== null || !value.terminalKnown || value.writeOutcomeUncertain || completed !== ADMIN_NATIVE_CLEANUP_STAGES[value.case].length || Object.entries(maximum).some(([key, count]) => counts[key] !== count)) refuse(); }
  else { failure(value, stages, ADMIN_NATIVE_CLEANUP_STAGES[value.case]); if (value.failurePoint === "PREREQUISITE" && Object.values(counts).some(count => count !== 0)) refuse(); }
  return freeze({ ...value, stages, counts: { ...counts } });
}
export function validateAdminNativeReport(value) { try { return pipeline(snapshot(value)); } catch { refuse(); } }
export function validateAdminNativeCleanup(value) { try { return cleanup(snapshot(value)); } catch { refuse(); } }
function assemble(value) {
  exact(value, ["sourceSha", "cases", "writeOutcomeUncertain"]); if (typeof value.sourceSha !== "string" || !SHA.test(value.sourceSha) || typeof value.writeOutcomeUncertain !== "boolean") refuse(); array(value.cases, 3); if (value.cases.length !== 3) refuse();
  let stopped = false, unknown = value.writeOutcomeUncertain, code = "PASSED", manifests = null;
  const cases = value.cases.map((entry, index) => {
    exact(entry, ["case", "report", "cleanup", "namespaceCleanup"]); if (entry.case !== ADMIN_NATIVE_CASES[index] || !["not-run", "confirmed", "failed"].includes(entry.namespaceCleanup)) refuse();
    const report = entry.report === null ? null : pipeline(entry.report), cleaned = entry.cleanup === null ? null : cleanup(entry.cleanup);
    if (stopped && (report !== null || cleaned !== null || entry.namespaceCleanup !== "not-run") || report === null && (cleaned !== null || entry.namespaceCleanup !== "not-run")) refuse();
    if (report && (report.case !== entry.case || report.sourceSha !== value.sourceSha) || cleaned && (cleaned.case !== entry.case || cleaned.sourceSha !== value.sourceSha)) refuse();
    if (report) { if (manifests && JSON.stringify(manifests) !== JSON.stringify(report.sourceHashes)) refuse(); manifests = report.sourceHashes; }
    if (cleaned && cleaned.stages.length > 0 && (!report?.terminalKnown || report.writeOutcomeUncertain)) refuse();
    unknown ||= report?.writeOutcomeUncertain === true || cleaned?.writeOutcomeUncertain === true;
    const complete = report?.status === "passed" && cleaned?.status === "passed" && entry.namespaceCleanup === "confirmed";
    if (!complete && !stopped) { stopped = true; code = report?.status === "failed" ? "CASE_FAILED" : cleaned?.status === "failed" ? "CLEANUP_FAILED" : entry.namespaceCleanup === "failed" ? "NAMESPACE_FAILED" : "DEPENDENCY_NOT_RUN"; }
    return { case: entry.case, report, cleanup: cleaned, namespaceCleanup: entry.namespaceCleanup };
  });
  // A later namespace's unknown outcome cannot erase the factual cleanup of
  // an earlier independent namespace. Its own cleanup remains forbidden above.
  if (unknown && code === "PASSED") code = "WRITE_OUTCOME_UNCERTAIN";
  return freeze({ schemaVersion: 1, scenario: "admin-native-backend", provenance: "protocol-only", sourceSha: value.sourceSha, status: code === "PASSED" ? "passed" : code === "DEPENDENCY_NOT_RUN" ? "not-run" : "failed", code, cases, writeOutcomeUncertain: unknown });
}
export function assembleAdminNativePacket(value) { try { return assemble(snapshot(value)); } catch { refuse(); } }
export function validateAdminNativePacket(input) { try { const value = snapshot(input); exact(value, ADMIN_NATIVE_PACKET_KEYS); const projected = assemble({ sourceSha: value.sourceSha, cases: value.cases, writeOutcomeUncertain: value.writeOutcomeUncertain }); if (value.schemaVersion !== 1 || value.scenario !== projected.scenario || value.provenance !== "protocol-only" || value.status !== projected.status || value.code !== projected.code || value.writeOutcomeUncertain !== projected.writeOutcomeUncertain) refuse(); return projected; } catch { refuse(); } }
