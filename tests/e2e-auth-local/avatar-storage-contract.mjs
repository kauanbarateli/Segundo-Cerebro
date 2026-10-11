// Closed Avatar projection only. This module performs no IO or source lookup.
export const AVATAR_STAGES = Object.freeze(["FIXTURES", "BASELINE", "SIGNED_UPLOAD", "FINALIZE", "SIGNED_READ", "ISOLATION", "PROFILE_SET", "PROFILE_REMOVE", "OBJECT_CLEANUP", "AUTH_CLEANUP", "FINAL_SQL"]);
export const AVATAR_CODES = Object.freeze(["PASSED", "SETUP_REFUSED", "SOURCE_REFUSED", "OWNERSHIP_REFUSED", "TRANSPORT_REFUSED", "RESPONSE_REFUSED", "MEDIA_NOT_PROVEN", "SQL_NOT_PROVEN", "CLEANUP_NOT_PROVEN", "DEADLINE_EXCEEDED", "WRITE_OUTCOME_UNCERTAIN", "CASE_FAILED"]);
export const AVATAR_LIMITS = Object.freeze({ caseMs: 360000, ioMs: 15000, responseBytes: 1048576, requests: 88, inspections: 16 });
// SDK setup/revoke/delete16; domain RPC13; Data API own/foreign2;
// Storage8 pipeline +4 exact cleanup; SQL4 domain +2 objects +1 Auth final.
export const AVATAR_PASS_COUNTS = Object.freeze({ authRequests: 16, rpcRequests: 13, publicRequests: 2, storageRequests: 12, sqlInspections: 7, fixtureCreated: 2, fixtureDeleted: 2, sessionsVerified: 2, objectsCreated: 2, objectsRemoved: 2, events: 3, receipts: 3 });
export const AVATAR_LIMITATIONS = Object.freeze(["hostedSupabase", "nextHandlers", "browserUpload", "originalPersonalFactories", "cleanupCron", "automaticIssueAcceptance"]);
const ownObject = (input, keys) => {
  if (!input || typeof input !== "object" || Object.getPrototypeOf(input) !== Object.prototype) throw new Error("AVATAR_REPORT_REFUSED");
  const descriptors = Object.getOwnPropertyDescriptors(input), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(name => typeof name !== "string" || !keys.includes(name)) || keys.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], "value"))) throw new Error("AVATAR_REPORT_REFUSED");
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
};
const refuse = () => { throw new Error("AVATAR_REPORT_REFUSED"); };
export function validateAvatarStorageReport(input) {
  const value = ownObject(input, ["schemaVersion", "scenario", "status", "code", "failurePoint", "stages", "counts", "measurements", "writeOutcomeUncertain", "pendingRequests", "pendingInspections", "deadlineRefused", "limitations"]);
  if (value.schemaVersion !== 1 || value.scenario !== "avatar-storage-local-case" || !["passed", "failed"].includes(value.status) || !AVATAR_CODES.includes(value.code) || ![null, ...AVATAR_STAGES].includes(value.failurePoint)) refuse();
  const stages = ownObject(value.stages, AVATAR_STAGES);
  if (Object.values(stages).some(flag => typeof flag !== "boolean")) refuse();
  const counts = ownObject(value.counts, Object.keys(AVATAR_PASS_COUNTS));
  if (Object.values(counts).some(count => !Number.isSafeInteger(count) || count < 0) || counts.authRequests + counts.rpcRequests + counts.publicRequests + counts.storageRequests > AVATAR_LIMITS.requests || counts.sqlInspections > AVATAR_LIMITS.inspections || counts.fixtureDeleted > counts.fixtureCreated || counts.objectsRemoved > counts.objectsCreated || counts.fixtureCreated > 2 || counts.sessionsVerified > 2 || counts.objectsCreated > 2 || counts.events > 3 || counts.receipts > 3) refuse();
  const measurements = ownObject(value.measurements, ["sourceBytes", "finalBytes", "sourceWidth", "sourceHeight", "finalWidth", "finalHeight"]);
  if (Object.values(measurements).some(measure => !Number.isSafeInteger(measure) || measure < 0) || measurements.sourceBytes > 8388608 || measurements.finalBytes > 8388608) refuse();
  const limitations = ownObject(value.limitations, AVATAR_LIMITATIONS);
  if (Object.values(limitations).some(flag => flag !== false) || typeof value.writeOutcomeUncertain !== "boolean" || typeof value.deadlineRefused !== "boolean" || !Number.isSafeInteger(value.pendingRequests) || value.pendingRequests < 0 || !Number.isSafeInteger(value.pendingInspections) || value.pendingInspections < 0) refuse();
  if (value.status === "passed") {
    if (value.code !== "PASSED" || value.failurePoint !== null || value.writeOutcomeUncertain || value.deadlineRefused || value.pendingRequests || value.pendingInspections || Object.values(stages).some(flag => !flag) || Object.keys(counts).some(key => counts[key] !== AVATAR_PASS_COUNTS[key]) || measurements.sourceBytes < 1 || measurements.finalBytes < 1 || measurements.sourceWidth !== 800 || measurements.sourceHeight !== 600 || measurements.finalWidth !== 512 || measurements.finalHeight !== 512) refuse();
  } else if (value.code === "PASSED" || value.failurePoint === null) refuse();
  return Object.freeze({ ...value, stages: Object.freeze(stages), counts: Object.freeze(counts), measurements: Object.freeze(measurements), limitations: Object.freeze(limitations) });
}
