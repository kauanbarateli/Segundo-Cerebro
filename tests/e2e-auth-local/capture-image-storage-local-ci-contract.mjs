// Standalone closed projection. Protocol counters are not service provenance.
import { validateCaptureImageStoragePacket } from "./capture-image-storage-contract.mjs";

export const STORAGE_LOCAL_CASE_PHASES = Object.freeze(["prerequisite", "fixture-create", "login", "session-verification", "ordinary-access", "image-construction", "image-pipeline", "object-cleanup", "auth-precheck", "auth-revoke", "auth-delete", "auth-absence", "complete"]);
export const STORAGE_LOCAL_CASE_CODES = Object.freeze(["PASSED", "SETUP_REFUSED", "FIXTURE_CREATE_FAILED", "LOGIN_FAILED", "SESSION_REFUSED", "ORDINARY_ACCESS_REFUSED", "IMAGE_CONSTRUCTION_FAILED", "IMAGE_PIPELINE_FAILED", "OBJECT_CLEANUP_FAILED", "AUTH_CLEANUP_UNCONFIRMED", "WRITE_OUTCOME_UNCERTAIN", "CASE_FAILED"]);
export const STORAGE_LOCAL_CASE_CHECKS = Object.freeze(["fixturesBound", "sessionsVerified", "ordinaryAccessVerified", "distinctSessions", "objectCleanupConfirmed", "authCleanupConfirmed"]);
export const STORAGE_LOCAL_CI_PHASES = Object.freeze(["environment", "sources", "ports", "private-directories", "cli-help", "stack-start", "local-status", "database-preflight", "local-infrastructure", "migrations", "catalogue", "schema-reload", "native-case", "domain-absence", "complete"]);
export const STORAGE_LOCAL_CI_CODES = Object.freeze(["PASSED", "CI_OPT_IN_REQUIRED", "ENVIRONMENT_REFUSED", "SOURCE_REFUSED", "LOCAL_PORT_IN_USE", "PROJECT_NOT_EMPTY", "COMMAND_FAILED", "COMMAND_UNAVAILABLE", "COMMAND_TIMEOUT", "COMMAND_OUTPUT_LIMIT", "COMMAND_GROUP_UNCONFIRMED", "CLI_VERSION_REFUSED", "CLI_HELP_REFUSED", "LOCAL_NAMESPACE_REFUSED", "LOCAL_DATABASE_REFUSED", "LOCAL_CATALOGUE_FAILED", "LOCAL_SQL_REFUSED", "CASE_FAILED", "DOMAIN_ABSENCE_REFUSED", "STACK_CLEANUP_UNCONFIRMED", "DIRECTORY_CLEANUP_UNCONFIRMED", "STORAGE_LOCAL_CI_FAILED"]);
export const STORAGE_LOCAL_CI_CHECKS = Object.freeze(["localEnvironment", "sourcesConfirmed", "ownedNamespace", "pg17", "instanceIdentityConfirmed", "servicesNative", "fixedSqlConfirmed", "domainAbsent", "storageMetadataAbsent", "authUsersAbsent", "executionNatural", "ownedNamespaceCleanup", "stackCleanupConfirmed", "privateDirectoriesRemoved"]);
export const STORAGE_LOCAL_SDK_VERSIONS = Object.freeze({ "@supabase/supabase-js": "2.117.2", "@supabase/storage-js": "2.117.2", "@supabase/auth-js": "2.117.2" });
const CASE_KEYS = ["schemaVersion", "scenario", "status", "code", "phase", "cleanupFailurePoint", "counts", "checks", "captureImage", "writeOutcomeUncertain"];
const CI_KEYS = ["schemaVersion", "scenario", "status", "code", "phase", "cleanupStage", "cliVersion", "sourceSha", "sourceHashes", "sdkVersions", "migrations", "migrationsApplied", "catalogueChecks", "checks", "caseReport", "writeOutcomeUncertain"];
const COUNT_LIMITS = { authRequests: 24, fixtureCreated: 2, fixtureDeleted: 2, sessionsVerified: 2 };
const PASSED_COUNTS = { authRequests: 16, fixtureCreated: 2, fixtureDeleted: 2, sessionsVerified: 2 };
const CLEANUP_PHASES = ["auth-precheck", "auth-revoke", "auth-delete", "auth-absence"];
const refuse = () => { throw new Error("STORAGE_LOCAL_REPORT_REFUSED"); };
const integer = (v, max) => Number.isSafeInteger(v) && v >= 0 && v <= max;
const freeze = v => { if (v && typeof v === "object") { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; };
function exact(v, keys) {
  if (!v || typeof v !== "object" || Object.getPrototypeOf(v) !== Object.prototype) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(v), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(k => typeof k !== "string" || !keys.includes(k)) || keys.some(k => !Object.hasOwn(descriptors[k] ?? {}, "value") || !descriptors[k].enumerable)) refuse();
}
function checks(v, keys) { exact(v, keys); if (keys.some(k => typeof v[k] !== "boolean")) refuse(); return Object.fromEntries(keys.map(k => [k, v[k]])); }
function sourceRows(v) {
  if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype || v.length > 100) refuse();
  const descriptors=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(descriptors);
  if(keys.length!==v.length+1||keys.some(k=>typeof k!=="string"||k!=="length"&&!/^(0|[1-9][0-9]*)$/.test(k)))refuse();
  const rows=[];for(let i=0;i<v.length;i++){const descriptor=descriptors[i];if(!descriptor||!Object.hasOwn(descriptor,"value")||!descriptor.enumerable)refuse();rows.push(descriptor.value);}return rows;
}
function caseReport(v) {
  exact(v, CASE_KEYS); exact(v.counts, Object.keys(COUNT_LIMITS));
  if (v.schemaVersion !== 1 || v.scenario !== "capture-image-storage-local-case" || !["passed", "failed"].includes(v.status) || !STORAGE_LOCAL_CASE_CODES.includes(v.code) || !STORAGE_LOCAL_CASE_PHASES.includes(v.phase) || typeof v.writeOutcomeUncertain !== "boolean" || v.cleanupFailurePoint !== null && !CLEANUP_PHASES.includes(v.cleanupFailurePoint)) refuse();
  const projectedChecks = checks(v.checks, STORAGE_LOCAL_CASE_CHECKS);
  if (Object.entries(COUNT_LIMITS).some(([k, max]) => !integer(v.counts[k], max)) || v.counts.fixtureDeleted > v.counts.fixtureCreated || v.counts.sessionsVerified > v.counts.fixtureCreated) refuse();
  const captureImage = v.captureImage === null ? null : validateCaptureImageStoragePacket(v.captureImage);
  if (captureImage?.writeOutcomeUncertain && !v.writeOutcomeUncertain || v.code === "WRITE_OUTCOME_UNCERTAIN" && !v.writeOutcomeUncertain || v.writeOutcomeUncertain && v.checks.authCleanupConfirmed) refuse();
  if (v.checks.objectCleanupConfirmed !== (captureImage?.cleanup?.status === "passed" && !captureImage.writeOutcomeUncertain) || v.checks.authCleanupConfirmed && (v.counts.fixtureDeleted !== v.counts.fixtureCreated || v.cleanupFailurePoint !== null)) refuse();
  if (v.status === "passed") {
    if (v.code !== "PASSED" || v.phase !== "complete" || v.cleanupFailurePoint !== null || v.writeOutcomeUncertain || !captureImage || captureImage.status !== "passed" || !captureImage.authDeletionAllowed || STORAGE_LOCAL_CASE_CHECKS.some(k => !v.checks[k]) || Object.entries(PASSED_COUNTS).some(([k,n]) => v.counts[k] !== n)) refuse();
  } else if (v.code === "PASSED") refuse();
  return freeze({ schemaVersion: 1, scenario: v.scenario, status: v.status, code: v.code, phase: v.phase, cleanupFailurePoint: v.cleanupFailurePoint, counts: { ...v.counts }, checks: projectedChecks, captureImage, writeOutcomeUncertain: v.writeOutcomeUncertain });
}
export function validateStorageLocalCaseReport(value) { try { return caseReport(value); } catch { refuse(); } }
function report(v) {
  exact(v, CI_KEYS);
  if (v.schemaVersion !== 1 || v.scenario !== "capture-image-storage-local-ci" || !["passed", "failed"].includes(v.status) || !STORAGE_LOCAL_CI_CODES.includes(v.code) || !STORAGE_LOCAL_CI_PHASES.includes(v.phase) || !["not-started", "stop-own-project", "verify-own-project", "private-directories", "directories-retained", "complete"].includes(v.cleanupStage) || v.cliVersion !== "2.120.0" || v.sourceSha !== null && !/^[a-f0-9]{40}$/.test(v.sourceSha) || !integer(v.migrations,17) || !integer(v.migrationsApplied,v.migrations) || !integer(v.catalogueChecks,10000) || typeof v.writeOutcomeUncertain !== "boolean") refuse();
  const projectedChecks = checks(v.checks, STORAGE_LOCAL_CI_CHECKS);
  exact(v.sdkVersions,Object.keys(STORAGE_LOCAL_SDK_VERSIONS));
  if (Object.entries(STORAGE_LOCAL_SDK_VERSIONS).some(([k, version]) => v.sdkVersions[k] !== version)) refuse();
  const sourceHashes = sourceRows(v.sourceHashes).map(row => { exact(row,["path","sha256","bytes"]); if (typeof row.path !== "string" || !/^(?:src|tests|scripts|supabase)\/[A-Za-z0-9_./-]+$|^package-lock\.json$/.test(row.path) || row.path.split("/").includes("..") || !/^[a-f0-9]{64}$/.test(row.sha256) || !integer(row.bytes,2*1024*1024) || row.bytes===0) refuse(); return { ...row }; });
  if (new Set(sourceHashes.map(row=>row.path)).size !== sourceHashes.length) refuse();
  const inner = v.caseReport === null ? null : caseReport(v.caseReport);
  if (inner?.writeOutcomeUncertain && !v.writeOutcomeUncertain || v.writeOutcomeUncertain && (v.checks.domainAbsent || v.checks.authUsersAbsent || v.checks.storageMetadataAbsent)) refuse();
  if (v.status === "passed") {
    if (v.code !== "PASSED" || v.phase !== "complete" || v.cleanupStage !== "complete" || v.writeOutcomeUncertain || !v.sourceSha || sourceHashes.length < 40 || !sourceHashes.some(row=>row.path==='package-lock.json') || v.migrations !== 17 || v.migrationsApplied !== 17 || v.catalogueChecks !== 1246 || !inner || inner.status !== "passed" || STORAGE_LOCAL_CI_CHECKS.some(k=>!v.checks[k])) refuse();
  } else if (v.code === "PASSED") refuse();
  return freeze({ schemaVersion: 1, scenario: v.scenario, status: v.status, code: v.code, phase: v.phase, cleanupStage: v.cleanupStage, cliVersion: v.cliVersion, sourceSha: v.sourceSha, sourceHashes, sdkVersions: { ...v.sdkVersions }, migrations: v.migrations, migrationsApplied: v.migrationsApplied, catalogueChecks: v.catalogueChecks, checks: projectedChecks, caseReport: inner, writeOutcomeUncertain: v.writeOutcomeUncertain });
}
export function validateStorageLocalCiReport(value) { try { return report(value); } catch { refuse(); } }
