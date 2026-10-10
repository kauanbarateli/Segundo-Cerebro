// Closed metadata projection only. No IO or native/service provenance. This is
// a standalone new packet contract; it does not change Identity schema4/45.
export const CAPTURE_IMAGE_REPORT_KEYS = Object.freeze(["schemaVersion", "scenario", "status", "code", "failurePoint", "stages", "counts", "checks", "measurements", "writeOutcomeUncertain"]);
export const CAPTURE_IMAGE_CLEANUP_KEYS = Object.freeze(["schemaVersion", "scenario", "status", "code", "failurePoint", "stages", "counts", "exactInventory", "objectsAbsent", "authDeletionAllowed", "writeOutcomeUncertain"]);
export const CAPTURE_IMAGE_PACKET_KEYS = Object.freeze(["schemaVersion", "scenario", "status", "code", "pipeline", "cleanup", "writeOutcomeUncertain", "authDeletionAllowed"]);
export const CAPTURE_IMAGE_CONTRACT_STAGES = Object.freeze(["BASELINE", "RESERVE", "SIGNED_PUT", "CLAIM", "MEASURE", "PREPARE", "PUBLISH", "COMPLETE", "DOWNLOAD", "CAPTURE", "PUBLIC_FINAL", "SQL_FINAL"]);
export const CAPTURE_IMAGE_CONTRACT_CHECKS = Object.freeze(["ordinaryOwnBaseline", "reservationBound", "signedPutWithoutCredentials", "leaseBound", "serverBytesMeasured", "originalProcessorUsed", "finalObjectPublished", "finalizedReceiptProven", "finalBytesExifFree", "captureAttachmentAtomic", "publicOwnAndForeign", "sqlAtomicLedger"]);
export const CAPTURE_IMAGE_CONTRACT_CLEANUP_STAGES = Object.freeze(["STAGING_REMOVE", "STAGING_ABSENT", "FINAL_REMOVE", "FINAL_ABSENT"]);
export const CAPTURE_IMAGE_CONTRACT_FAILURE_CODES = Object.freeze(["SETUP_REFUSED", "GRAPH_REFUSED", "STATE_REFUSED", "TOKEN_LIFETIME_REFUSED", "CALL_LIMIT_REFUSED", "TRANSPORT_REFUSED", "TRANSPORT_FAILED", "DEADLINE_EXCEEDED", "RESPONSE_REFUSED", "OWNERSHIP_REFUSED", "SQL_REFUSED", "MEDIA_NOT_PROVEN", "PERSISTENCE_NOT_PROVEN", "COMMIT_UNCONFIRMED", "CLEANUP_NOT_PROVEN", "WRITE_OUTCOME_UNCERTAIN"]);
export const CAPTURE_IMAGE_CONTRACT_PASS_COUNTS = Object.freeze({ requests: 27, rpcRequests: 10, publicRequests: 10, storageRequests: 7, signedPuts: 1, coreCommands: 1, commitAttempts: 1, sqlInspections: 2, events: 2, receipts: 2 });
export const CAPTURE_IMAGE_CONTRACT_CLEANUP_COUNTS = Object.freeze({ requests: 4, removeRequests: 2, absenceReads: 2, removedObjects: 2, sqlInspections: 2 });
const MEASUREMENTS = ["sourceBytes", "finalBytes", "sourceWidth", "sourceHeight", "finalWidth", "finalHeight"];
const LOWER = { requests: [5, 6, 8, 9, 10, 10, 11, 14, 15, 19, 27, 27], rpcRequests: [1, 2, 2, 3, 3, 3, 3, 6, 6, 10, 10, 10], publicRequests: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10, 10], storageRequests: [2, 2, 4, 4, 5, 5, 6, 6, 7, 7, 7, 7], sqlInspections: [1,1,1,1,1,1,1,1,1,1,1,2] };
const refuse = () => { throw new Error("CAPTURE_IMAGE_PACKET_REFUSED"); };
const freeze = value => { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
function exact(value, keys) {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key)) || keys.some(key => !Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable)) refuse();
}
function stages(value, names) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > names.length) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== value.length + 1 || keys.some(key => typeof key !== "string" || key !== "length" && !/^(0|[1-9][0-9]*)$/.test(key))) refuse();
  const projected = [];
  for (let index = 0; index < value.length; index++) { const descriptor = descriptors[index]; if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) refuse(); const stage = descriptor.value; exact(stage, ["name", "passed"]); if (stage.name !== names[index] || typeof stage.passed !== "boolean" || !stage.passed && index !== value.length - 1) refuse(); projected.push({ name: stage.name, passed: stage.passed }); }
  return projected;
}
function failure(value, steps, names) {
  if (!CAPTURE_IMAGE_CONTRACT_FAILURE_CODES.includes(value.code) || typeof value.writeOutcomeUncertain !== "boolean" || !["PREREQUISITE", ...names].includes(value.failurePoint)) refuse();
  if (["WRITE_OUTCOME_UNCERTAIN", "COMMIT_UNCONFIRMED"].includes(value.code) && value.writeOutcomeUncertain !== true) refuse();
  if (value.failurePoint === "PREREQUISITE" ? steps.length !== 0 : steps.at(-1)?.name !== value.failurePoint || steps.at(-1)?.passed !== false) refuse();
}
function report(value) {
  exact(value, CAPTURE_IMAGE_REPORT_KEYS); exact(value.counts, Object.keys(CAPTURE_IMAGE_CONTRACT_PASS_COUNTS)); exact(value.checks, CAPTURE_IMAGE_CONTRACT_CHECKS); exact(value.measurements, MEASUREMENTS);
  if (value.schemaVersion !== 2 || value.scenario !== "capture-image-storage" || !["passed", "failed"].includes(value.status)) refuse();
  const counts = value.counts;
  for (const [key, maximum] of Object.entries(CAPTURE_IMAGE_CONTRACT_PASS_COUNTS)) if (!Number.isSafeInteger(counts[key]) || counts[key] < 0 || counts[key] > (key.endsWith("Requests") || key === "requests" ? 48 : maximum)) refuse();
  if (counts.requests !== counts.rpcRequests + counts.publicRequests + counts.storageRequests || counts.commitAttempts > counts.rpcRequests || counts.signedPuts > counts.storageRequests) refuse();
  const steps = stages(value.stages, CAPTURE_IMAGE_CONTRACT_STAGES), completed = steps.filter(stage => stage.passed).length;
  if (completed) for (const [key, lower] of Object.entries(LOWER)) if (counts[key] < lower[completed - 1]) refuse();
  CAPTURE_IMAGE_CONTRACT_CHECKS.forEach((key, index) => { if (value.checks[key] !== (steps[index]?.passed === true)) refuse(); });
  const final = steps[11]?.passed === true;
  if (counts.events !== (final ? 2 : 0) || counts.receipts !== (final ? 2 : 0) || counts.sqlInspections > (steps.length === 0 ? 0 : steps.length < 12 ? 1 : 2) || final && counts.sqlInspections !== 2 || counts.coreCommands !== (steps.length > 9 ? 1 : 0) || counts.commitAttempts !== (steps[9]?.passed ? 1 : counts.commitAttempts)) refuse();
  for (const key of MEASUREMENTS) if (!Number.isSafeInteger(value.measurements[key]) || value.measurements[key] < 0 || value.measurements[key] > 1_048_576) refuse();
  const measured = steps[4]?.passed === true, prepared = steps[5]?.passed === true;
  if (measured ? value.measurements.sourceBytes <= 0 || value.measurements.sourceWidth !== 60 || value.measurements.sourceHeight !== 40 : MEASUREMENTS.slice(0, 1).concat(["sourceWidth", "sourceHeight"]).some(key => value.measurements[key] !== 0)) refuse();
  if (prepared ? value.measurements.finalBytes <= 0 || value.measurements.finalWidth !== 40 || value.measurements.finalHeight !== 60 : ["finalBytes", "finalWidth", "finalHeight"].some(key => value.measurements[key] !== 0)) refuse();
  if (value.status === "passed") { if (value.code !== "PASSED" || value.failurePoint !== null || value.writeOutcomeUncertain !== false || completed !== CAPTURE_IMAGE_CONTRACT_STAGES.length || Object.entries(CAPTURE_IMAGE_CONTRACT_PASS_COUNTS).some(([key, count]) => counts[key] !== count)) refuse(); }
  else failure(value, steps, CAPTURE_IMAGE_CONTRACT_STAGES);
  return freeze({ schemaVersion: 2, scenario: value.scenario, status: value.status, code: value.code, failurePoint: value.failurePoint, stages: steps, counts: Object.fromEntries(Object.keys(CAPTURE_IMAGE_CONTRACT_PASS_COUNTS).map(key => [key, counts[key]])), checks: Object.fromEntries(CAPTURE_IMAGE_CONTRACT_CHECKS.map(key => [key, value.checks[key]])), measurements: Object.fromEntries(MEASUREMENTS.map(key => [key, value.measurements[key]])), writeOutcomeUncertain: value.writeOutcomeUncertain });
}
function cleanup(value) {
  exact(value, CAPTURE_IMAGE_CLEANUP_KEYS); exact(value.counts, Object.keys(CAPTURE_IMAGE_CONTRACT_CLEANUP_COUNTS));
  if (value.schemaVersion !== 2 || value.scenario !== "capture-image-storage-cleanup" || !["passed", "failed"].includes(value.status) || ["exactInventory", "objectsAbsent", "authDeletionAllowed", "writeOutcomeUncertain"].some(key => typeof value[key] !== "boolean")) refuse();
  for (const [key, maximum] of Object.entries(CAPTURE_IMAGE_CONTRACT_CLEANUP_COUNTS)) if (!Number.isSafeInteger(value.counts[key]) || value.counts[key] < 0 || value.counts[key] > maximum) refuse();
  if (value.counts.requests !== value.counts.removeRequests + value.counts.absenceReads || value.counts.removedObjects > value.counts.removeRequests) refuse();
  const steps = stages(value.stages, CAPTURE_IMAGE_CONTRACT_CLEANUP_STAGES), completed = steps.filter(stage => stage.passed).length;
  if (value.counts.requests < completed || value.counts.removeRequests < Math.ceil(completed / 2) || value.counts.absenceReads < Math.floor(completed / 2)) refuse();
  if (value.counts.removeRequests > Math.ceil(steps.length/2) || value.counts.absenceReads > Math.floor(steps.length/2) || value.counts.removedObjects > steps.filter(step=>step.passed&&step.name.endsWith("REMOVE")).length || value.counts.absenceReads > value.counts.sqlInspections || value.counts.sqlInspections > Math.floor(steps.length/2) || completed && value.counts.sqlInspections < [0,1,1,2][completed-1]) refuse();
  const passed = value.status === "passed";
  if (["exactInventory", "objectsAbsent", "authDeletionAllowed"].some(key => value[key] !== passed)) refuse();
  if (passed) { if (value.code !== "PASSED" || value.failurePoint !== null || value.writeOutcomeUncertain || completed !== 4 || value.counts.requests !== 4 || value.counts.removeRequests !== 2 || value.counts.absenceReads !== 2 || value.counts.sqlInspections !== 2) refuse(); }
  else { failure(value, steps, CAPTURE_IMAGE_CONTRACT_CLEANUP_STAGES); if (value.failurePoint === "PREREQUISITE" && (value.code !== (value.writeOutcomeUncertain ? "WRITE_OUTCOME_UNCERTAIN" : "CLEANUP_NOT_PROVEN") || Object.values(value.counts).some(count => count !== 0))) refuse(); }
  return freeze({ schemaVersion: 2, scenario: value.scenario, status: value.status, code: value.code, failurePoint: value.failurePoint, stages: steps, counts: Object.fromEntries(Object.keys(CAPTURE_IMAGE_CONTRACT_CLEANUP_COUNTS).map(key => [key, value.counts[key]])), exactInventory: value.exactInventory, objectsAbsent: value.objectsAbsent, authDeletionAllowed: value.authDeletionAllowed, writeOutcomeUncertain: value.writeOutcomeUncertain });
}
export function validateCaptureImageStorageReport(value) { try { return report(value); } catch { refuse(); } }
export function validateCaptureImageCleanupReport(value) { try { return cleanup(value); } catch { refuse(); } }
function assemble(value) {
  exact(value, ["pipeline", "cleanup", "writeOutcomeUncertain"]); if (typeof value.writeOutcomeUncertain !== "boolean") refuse();
  const pipeline = value.pipeline === null ? null : report(value.pipeline), cleaned = value.cleanup === null ? null : cleanup(value.cleanup);
  if (pipeline === null && cleaned !== null || pipeline?.writeOutcomeUncertain && cleaned?.status === "passed") refuse();
  const uncertain = value.writeOutcomeUncertain || pipeline?.writeOutcomeUncertain === true || cleaned?.writeOutcomeUncertain === true;
  const code = pipeline?.status === "failed" ? "PIPELINE_FAILED" : cleaned?.status === "failed" ? "CLEANUP_FAILED" : uncertain ? "WRITE_OUTCOME_UNCERTAIN" : pipeline === null || cleaned === null ? "DEPENDENCY_NOT_RUN" : "PASSED";
  if (code === "PASSED" && cleaned.counts.removedObjects !== 2) refuse();
  return freeze({ schemaVersion: 2, scenario: "capture-image-storage", status: code === "PASSED" ? "passed" : code === "DEPENDENCY_NOT_RUN" ? "not-run" : "failed", code, pipeline, cleanup: cleaned, writeOutcomeUncertain: uncertain, authDeletionAllowed: cleaned?.status === "passed" && !uncertain });
}
export function assembleCaptureImageStoragePacket(value) { try { return assemble(value); } catch { refuse(); } }
export function validateCaptureImageStoragePacket(value) {
  try { exact(value, CAPTURE_IMAGE_PACKET_KEYS); if (value.schemaVersion !== 2 || value.scenario !== "capture-image-storage") refuse(); const projected = assemble({ pipeline: value.pipeline, cleanup: value.cleanup, writeOutcomeUncertain: value.writeOutcomeUncertain }); if (value.status !== projected.status || value.code !== projected.code || value.authDeletionAllowed !== projected.authDeletionAllowed || value.writeOutcomeUncertain !== projected.writeOutcomeUncertain) refuse(); return projected; } catch { refuse(); }
}
