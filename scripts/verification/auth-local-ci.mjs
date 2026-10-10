/** Opt-in disposable Linux CI only. No credential-file loading or hosted target. */
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EVENT_PACKET_FILE, IDENTITY_RLS_PACKET_FILE, validateEventsPacket, validateIdentityAuthReport, validateIdentityRlsPacket } from "../../tests/e2e-auth-local/identity-data-api-contract.mjs";
import { CAPTURE_TASK_PACKET_FILE, validateCaptureTaskPacket } from "../../tests/e2e-auth-local/capture-task-persistence-contract.mjs";

export const CLI_VERSION = "2.120.0";
export const APP_URL = "http://127.0.0.1:3117";
export const API_URL = "http://127.0.0.1:54321";
// Official MCR v1.63.0-noble linux/amd64 manifest, verified without pulling.
export const BROWSER_IMAGE = "mcr.microsoft.com/playwright:v1.63.0-noble@sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7";
export const BROWSER_IMAGE_ID = "sha256:2c1f4e0fd6450f43ddb46d60c2a6df30855a8588e165b1f2559fb0eda8d7ff35";
export const BROWSER_LABEL = "com.segundo-cerebro.auth-local-ci.run";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MIGRATION_COUNT = 17;
export const PHASES = Object.freeze(["environment", "sources", "ports", "private-directories", "cli-help", "stack-start", "local-status", "database-preflight", "local-infrastructure", "migrations", "catalogue", "schema-reload", "browser", "browser-report", "between-cases", "complete"]);
const REPORT_NAME = "auth-local-ci-report.json";
const MAX_REPORT_BYTES = 16384;
const PROJECT_PATTERN = /^sc-auth-ci-[a-f0-9]{24}$/;
export const BROWSER_STAGES = Object.freeze(["fixtures-created", "login-a1", "login-a2", "login-b", "protected-a1", "protected-a2", "protected-b", "distinct-a-sessions", "logout-global-a", "old-a-denied", "b-intact", "fixture-cleanup"]);
export const BROWSER_CODES = Object.freeze(["PASSED", "ENVIRONMENT_REFUSED", "FIXTURE_CREATE_FAILED", "LOGIN_FAILED", "PROTECTED_SESSION_FAILED", "SESSION_ISOLATION_FAILED", "LOGOUT_FAILED", "OLD_SESSION_ACCEPTED", "OTHER_ACCOUNT_CHANGED", "CLEANUP_UNCONFIRMED", "REPORT_WRITE_FAILED", "ACCEPTANCE_FAILED"]);
export const BROWSER_FAILURE_POINTS = Object.freeze(["FIXTURE_CREATE", "BROWSER_CONTEXT_CREATE", "LOGIN_DOCUMENT", "LOGIN_FORM", "LOGIN_FIELDS", "LOGIN_SUBMIT_NAVIGATION", "LOGIN_DESTINATION", "SESSION_COOKIE_POLICY", "SESSION_COOKIE_HINT", "SESSION_USER_VERIFICATION", "SESSION_ACCESS_STATE", "SESSION_SCRIPT_COOKIE_ISOLATION", "SESSION_NETWORK_ISOLATION", "PROTECTED_PAGE", "DISTINCT_SESSIONS", "LOGOUT_DOCUMENT", "LOGOUT_SUBMIT_NAVIGATION", "LOGOUT_RESPONSE_POLICY", "LOGOUT_STATUS", "LOGOUT_LOCATION", "LOGOUT_PRIVATE_CACHE", "LOGOUT_NO_STORE_CACHE", "LOGOUT_CSP", "LOGOUT_NOSNIFF", "LOGOUT_STORAGE_CLEARANCE", "LOGOUT_COOKIE_CLEARANCE", "OLD_A_TOKEN_LIFETIME", "OLD_A_ACCESS_STATE", "OLD_A_PAGE_GUARD", "OTHER_B_SESSION_INTACT", "FIXTURE_CLEANUP"]);
export const BROWSER_CLEANUP_FAILURE_POINTS = Object.freeze(["OUTCOME_UNCERTAIN", "CONTEXT_CLOSE", "FIXTURE_PRECHECK", "SESSION_REVOCATION", "FIXTURE_DELETE_ACK", "FIXTURE_ABSENCE"]);
const CHECKS = ["loginA1", "loginA2", "loginB", "protectedA1", "protectedA2", "protectedB", "distinctASessions", "logoutGlobalA", "oldADenied", "bIntact", "cleanupConfirmed"];
export const BROWSER_SCENARIOS = Object.freeze(["logout", "identity-data-api", "password-change"]);
const SCENARIO_FILES = Object.freeze({ logout: "tests/e2e-auth-local/auth-local.spec.ts", "identity-data-api": "tests/e2e-auth-local/identity-data-api-local.spec.ts", "password-change": "tests/e2e-auth-local/auth-password-local.spec.ts" });
export const PASSWORD_STAGES = Object.freeze(["fixtures-created", "login-a1", "login-a2", "login-b", "protected-a1", "protected-a2", "protected-b", "distinct-a-sessions", "password-change-terminal", "old-a-denied", "b-intact", "old-password-denied", "new-password-login", "new-a-protected", "fixture-cleanup"]);
export const PASSWORD_CHECKS = Object.freeze(["loginA1", "loginA2", "loginB", "protectedA1", "protectedA2", "protectedB", "distinctASessions", "passwordTerminalNotice", "checkpointCookiesCleared", "authCookiesCleared", "oldADenied", "bIntact", "oldPasswordDeniedWithoutSession", "newPasswordLogin", "newSessionDistinct", "newAProtected", "cleanupRevokedNewA", "cleanupRevokedB", "cleanupConfirmed"]);
export const PASSWORD_CODES = Object.freeze([...BROWSER_CODES, "PASSWORD_CHANGE_FAILED", "OLD_PASSWORD_ACCEPTED", "NEW_PASSWORD_LOGIN_FAILED"]);
export const PASSWORD_FAILURE_POINTS = Object.freeze([...BROWSER_FAILURE_POINTS, "PASSWORD_FORM", "PASSWORD_FIELDS", "PASSWORD_SUBMIT_NAVIGATION", "PASSWORD_TERMINAL_NOTICE", "PASSWORD_CHECKPOINT_CLEARANCE", "PASSWORD_AUTH_COOKIE_CLEARANCE", "OLD_PASSWORD_SUBMIT_COMPLETION", "OLD_PASSWORD_GENERIC_REFUSAL", "OLD_PASSWORD_COOKIE_CLEARANCE", "LOGIN_RESPONSE_WAIT", "LOGIN_URL_WAIT", "LOGIN_SUBMIT_CLICK", "LOGIN_POST_STATUS", "LOGIN_POST_COMPLETION", "POST_REQUEST_FAILED", "POST_COMPLETION_TIMEOUT", "POST_REQUEST_ABORTED"]);
const PASSWORD_COUNT_LIMITS = Object.freeze({ fixtureCreated: 2, fixtureDeleted: 2, browserContexts: 3, appLoginPostsA: 4, appLoginPostsB: 1, passwordChangePosts: 1, credentialAttemptsA: 5 });
const CASE_FAILURES = Object.freeze(["COMMAND_FAILED", "COMMAND_UNAVAILABLE", "COMMAND_TIMEOUT", "COMMAND_OUTPUT_LIMIT", "COMMAND_GROUP_UNCONFIRMED", "AUTH_LOCAL_CI_FAILED", "BROWSER_NAMESPACE_REFUSED", "BROWSER_NAMESPACE_NOT_EMPTY", "BROWSER_NAMESPACE_EXIT_FAILED", "BROWSER_NAMESPACE_CLEANUP_UNCONFIRMED", "BROWSER_NAMESPACE_OUTCOME_UNCONFIRMED", "BROWSER_REPORT_REFUSED", "BROWSER_ACCEPTANCE_FAILED", "RUNNER_PATH_REFUSED", "ENVIRONMENT_REFUSED", "LOCAL_AUTH_USERS_REFUSED", "LOCAL_CAPTURE_TASK_FIXTURES_REFUSED"]);
const STATUS_KEYS = new Set(["API_URL", "REST_URL", "GRAPHQL_URL", "STORAGE_S3_URL", "MCP_URL", "FUNCTIONS_URL", "DB_URL", "STUDIO_URL", "INBUCKET_URL", "MAILPIT_URL", "PUBLISHABLE_KEY", "SECRET_KEY", "JWT_SECRET", "ANON_KEY", "SERVICE_ROLE_KEY", "S3_PROTOCOL_ACCESS_KEY_ID", "S3_PROTOCOL_ACCESS_KEY_SECRET", "S3_PROTOCOL_REGION"]);
const FOREIGN_ENV = /^(?:SUPABASE_|AUTH_.*SECRET|PG[A-Z_]*|DATABASE_URL$|APP_MODE$|APP_URL$|NODE_ENV$|SC_VERIFY_|SC_BACKUP_|SC_RELEASE_|SC_AUTH_LIVE_|DOCKER_|CONTAINER_HOST$|VERCEL|NETLIFY|CF_PAGES|GOOGLE_|SENTRY_|OPENAI_|AWS_|AZURE_)/;
class AuthLocalCiError extends Error {
  constructor(code) { super(code); this.name = "AuthLocalCiError"; this.code = code; }
}
const fail = code => { throw new AuthLocalCiError(code); };
async function inPhase(phase, task) {
  try { return await task(); } catch (error) {
    const safe = error instanceof AuthLocalCiError ? error : new AuthLocalCiError("AUTH_LOCAL_CI_FAILED");
    safe.phase = phase; throw safe;
  }
}
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const modernPublishable = value => typeof value === "string" && /^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(value);
const modernSecret = value => typeof value === "string" && /^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(value);

/** Reports are exclusively written in the owned case directory. Bound the read
 * itself as well as the stat, and never serialize an IO or JSON error. */
async function closedReportFile(path) {
  let handle;
  const bytes = Buffer.alloc(MAX_REPORT_BYTES + 1);
  try {
    const initial = await lstat(path);
    if (!initial.isFile() || initial.isSymbolicLink() || initial.size > MAX_REPORT_BYTES || await realpath(path) !== path) fail("BROWSER_REPORT_REFUSED");
    handle = await open(path, fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > MAX_REPORT_BYTES) fail("BROWSER_REPORT_REFUSED");
    let used = 0;
    while (used < bytes.length) {
      const read = await handle.read(bytes, used, bytes.length - used, used);
      if (read.bytesRead === 0) break;
      used += read.bytesRead;
    }
    if (used > MAX_REPORT_BYTES) fail("BROWSER_REPORT_REFUSED");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, used)));
  } catch { fail("BROWSER_REPORT_REFUSED"); }
  finally { bytes.fill(0); if (handle) { try { await handle.close(); } catch { fail("BROWSER_REPORT_REFUSED"); } } }
}

export function assertTempDescendant(parent, child) {
  if (typeof parent !== "string" || typeof child !== "string" || !isAbsolute(parent) || !isAbsolute(child) || parent.includes("\0") || child.includes("\0")) fail("RUNNER_PATH_REFUSED");
  const delta = relative(resolve(parent), resolve(child));
  if (!delta || delta === ".." || delta.startsWith(`..${sep}`) || isAbsolute(delta)) fail("RUNNER_PATH_REFUSED");
  return resolve(child);
}

export function requireCiRunner(environment, platform = process.platform) {
  if (platform !== "linux" || environment.GITHUB_ACTIONS !== "true" || environment.CI !== "true" || environment.SC_AUTH_LOCAL_CI_RUN !== "1") fail("CI_OPT_IN_REQUIRED");
  if (typeof environment.RUNNER_TEMP !== "string" || !isAbsolute(environment.RUNNER_TEMP)) fail("RUNNER_PATH_REFUSED");
  if (Object.entries(environment).some(([name, value]) => FOREIGN_ENV.test(name) && value !== undefined && value !== "")) fail("FOREIGN_ENVIRONMENT_REFUSED");
  return { runnerTemp: resolve(environment.RUNNER_TEMP) };
}

/** Shared pure guard for the dedicated browser suite; returns no key material. */
export function validateAuthLocalChildEnvironment(environment) {
  if (environment.GITHUB_ACTIONS !== "true" || environment.CI !== "true" || environment.SC_AUTH_LOCAL_CI_RUN !== "1" || environment.APP_MODE !== "supabase" || environment.NODE_ENV !== "development") fail("ENVIRONMENT_REFUSED");
  if (environment.APP_URL !== APP_URL || environment.SUPABASE_URL !== API_URL || !modernPublishable(environment.SUPABASE_PUBLISHABLE_KEY) || !modernSecret(environment.SUPABASE_SECRET_KEY)) fail("ENVIRONMENT_REFUSED");
  const secrets = [environment.AUTH_RATE_LIMIT_SECRET, environment.AUTH_STATE_SECRET, environment.SUPABASE_SECRET_KEY];
  if (secrets.some(value => typeof value !== "string" || Buffer.byteLength(value) < 32 || value.includes("\0")) || new Set(secrets).size !== 3) fail("ENVIRONMENT_REFUSED");
  const reportPath = assertTempDescendant(environment.RUNNER_TEMP, environment.SC_AUTH_LOCAL_CI_REPORT_PATH);
  if (basename(reportPath) !== REPORT_NAME || !/^sc-auth-local-ci-[A-Za-z0-9]+$/.test(basename(dirname(reportPath)))) fail("RUNNER_PATH_REFUSED");
  return { appUrl: APP_URL, supabaseUrl: API_URL, reportPath };
}

/** `status -o json` raw map from CLI 2.120.0, not --output-format's envelope. */
export function decodeLocalStatus(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > 65536) fail("LOCAL_STATUS_REFUSED");
  let value; try { value = JSON.parse(text); } catch { fail("LOCAL_STATUS_REFUSED"); }
  if (!object(value) || Object.keys(value).some(key => !STATUS_KEYS.has(key)) || Object.values(value).some(item => typeof item !== "string" || item.includes("\0"))) fail("LOCAL_STATUS_REFUSED");
  if (value.API_URL !== API_URL || !modernPublishable(value.PUBLISHABLE_KEY) || !modernSecret(value.SECRET_KEY)) fail("LOCAL_STATUS_REFUSED");
  for (const [key, text] of Object.entries(value)) {
    if (!key.endsWith("_URL") || key === "DB_URL") continue;
    let url; try { url = new URL(text); } catch { fail("LOCAL_STATUS_REFUSED"); }
    const port = key === "STUDIO_URL" ? "54323" : ["INBUCKET_URL", "MAILPIT_URL"].includes(key) ? "54324" : "54321";
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port !== port || url.username || url.password || url.search || url.hash) fail("LOCAL_STATUS_REFUSED");
  }
  let db; try { db = new URL(value.DB_URL); } catch { fail("LOCAL_STATUS_REFUSED"); }
  if (!["postgres:", "postgresql:"].includes(db.protocol) || db.hostname !== "127.0.0.1" || db.port !== "54322" || db.username !== "postgres" || db.pathname !== "/postgres" || !db.password || db.search || db.hash) fail("LOCAL_STATUS_REFUSED");
  let password; try { password = decodeURIComponent(db.password); } catch { fail("LOCAL_STATUS_REFUSED"); }
  if (!password || password.includes("\0") || Buffer.byteLength(password) > 256) fail("LOCAL_STATUS_REFUSED");
  const config = { apiUrl: API_URL, databaseLocal: true };
  // Accidental metadata serialization cannot emit credentials/status payload.
  Object.defineProperties(config, { password: { value: password }, publishable: { value: value.PUBLISHABLE_KEY }, secret: { value: value.SECRET_KEY } });
  return config;
}

export function validateAuthLocalReport(value) {
  if (!exact(value, ["schemaVersion", "status", "code", "failurePoint", "cleanupFailurePoint", "stages", "counts", "checks", "cleanupConfirmed"]) || value.schemaVersion !== 1 || !["passed", "failed"].includes(value.status) || !BROWSER_CODES.includes(value.code)) fail("BROWSER_REPORT_REFUSED");
  if (value.status === "passed" ? value.failurePoint !== null : !BROWSER_FAILURE_POINTS.includes(value.failurePoint)) fail("BROWSER_REPORT_REFUSED");
  if (!exact(value.counts, ["fixtureCreated", "fixtureDeleted", "browserContexts"]) || !integer(value.counts.fixtureCreated, 2) || !integer(value.counts.fixtureDeleted, 2) || !integer(value.counts.browserContexts, 3) || value.counts.fixtureDeleted > value.counts.fixtureCreated) fail("BROWSER_REPORT_REFUSED");
  if (!exact(value.checks, CHECKS) || CHECKS.some(key => typeof value.checks[key] !== "boolean") || typeof value.cleanupConfirmed !== "boolean" || value.cleanupConfirmed !== value.checks.cleanupConfirmed || (value.cleanupConfirmed && value.counts.fixtureCreated !== value.counts.fixtureDeleted)) fail("BROWSER_REPORT_REFUSED");
  if (value.cleanupConfirmed ? value.cleanupFailurePoint !== null : !BROWSER_CLEANUP_FAILURE_POINTS.includes(value.cleanupFailurePoint)) fail("BROWSER_REPORT_REFUSED");
  if (!Array.isArray(value.stages) || value.stages.length > BROWSER_STAGES.length) fail("BROWSER_REPORT_REFUSED");
  let previous = -1;
  for (const stage of value.stages) {
    if (!exact(stage, ["name", "passed"]) || typeof stage.passed !== "boolean") fail("BROWSER_REPORT_REFUSED");
    const index = BROWSER_STAGES.indexOf(stage.name);
    if (index <= previous) fail("BROWSER_REPORT_REFUSED"); previous = index;
  }
  const passed = value.status === "passed";
  if (passed !== (value.code === "PASSED") || (passed && (value.stages.length !== BROWSER_STAGES.length || value.stages.some(stage => !stage.passed) || CHECKS.some(key => !value.checks[key]) || value.counts.fixtureCreated !== 2 || value.counts.fixtureDeleted !== 2 || value.counts.browserContexts !== 3))) fail("BROWSER_REPORT_REFUSED");
  return structuredClone(value);
}

/** A valid report cannot promote a failed/unconfirmed browser process to PASS. */
export function evaluateBrowserRun(processFailure, value) {
  const browser = validateAuthLocalReport(value);
  if (processFailure !== undefined) {
    if (!["COMMAND_FAILED", "COMMAND_UNAVAILABLE", "COMMAND_TIMEOUT", "COMMAND_OUTPUT_LIMIT", "COMMAND_GROUP_UNCONFIRMED", "AUTH_LOCAL_CI_FAILED", "BROWSER_NAMESPACE_REFUSED", "BROWSER_NAMESPACE_NOT_EMPTY", "BROWSER_NAMESPACE_EXIT_FAILED", "BROWSER_NAMESPACE_CLEANUP_UNCONFIRMED", "BROWSER_NAMESPACE_OUTCOME_UNCONFIRMED"].includes(processFailure)) fail("BROWSER_REPORT_REFUSED");
    return { accepted: false, code: processFailure, phase: "browser", browser };
  }
  if (browser.status !== "passed" || !browser.cleanupConfirmed) return { accepted: false, code: "BROWSER_ACCEPTANCE_FAILED", phase: "browser-report", browser };
  return { accepted: true, code: "PASSED", phase: "complete", browser };
}

/** The expected scenario comes from the runner, never from the report body. */
export function browserScenarioFile(scenario) {
  if (!BROWSER_SCENARIOS.includes(scenario)) fail("BROWSER_SCENARIO_REFUSED");
  return SCENARIO_FILES[scenario];
}
/** The case selects fixed files and validators; no report value can select IO. */
export async function readBrowserCaseReports(scenario, reportPath) {
  browserScenarioFile(scenario);
  if (typeof reportPath !== "string" || !isAbsolute(reportPath) || resolve(reportPath) !== reportPath || basename(reportPath) !== REPORT_NAME || !/^sc-auth-local-ci-[A-Za-z0-9]+$/.test(basename(dirname(reportPath)))) fail("RUNNER_PATH_REFUSED");
  const values = { report: null, ...(scenario === "identity-data-api" ? { identityRls: null, events: null, captureTask: null } : {}), failure: null };
  const selected = scenario === "identity-data-api"
    ? [["report", REPORT_NAME, validateIdentityAuthReport], ["identityRls", IDENTITY_RLS_PACKET_FILE, validateIdentityRlsPacket], ["events", EVENT_PACKET_FILE, validateEventsPacket], ["captureTask", CAPTURE_TASK_PACKET_FILE, validateCaptureTaskPacket]]
    : [["report", REPORT_NAME, scenario === "logout" ? validateAuthLocalReport : validatePasswordReport]];
  for (const [key, name, validator] of selected) {
    try { values[key] = validator(await closedReportFile(join(dirname(reportPath), name))); }
    catch { values.failure = "BROWSER_REPORT_REFUSED"; }
  }
  return immutable(values);
}
export function validatePasswordReport(value) {
  if (!exact(value, ["schemaVersion", "scenario", "status", "code", "failurePoint", "cleanupFailurePoint", "stages", "counts", "checks", "cleanupConfirmed"]) || value.schemaVersion !== 2 || value.scenario !== "password-change" || !["passed", "failed"].includes(value.status) || !PASSWORD_CODES.includes(value.code)) fail("BROWSER_REPORT_REFUSED");
  if (value.status === "passed" ? value.failurePoint !== null : !PASSWORD_FAILURE_POINTS.includes(value.failurePoint)) fail("BROWSER_REPORT_REFUSED");
  if (!exact(value.counts, Object.keys(PASSWORD_COUNT_LIMITS)) || Object.entries(PASSWORD_COUNT_LIMITS).some(([key, limit]) => !integer(value.counts[key], limit)) || value.counts.fixtureDeleted > value.counts.fixtureCreated) fail("BROWSER_REPORT_REFUSED");
  if (!exact(value.checks, PASSWORD_CHECKS) || PASSWORD_CHECKS.some(key => typeof value.checks[key] !== "boolean") || typeof value.cleanupConfirmed !== "boolean" || value.cleanupConfirmed !== value.checks.cleanupConfirmed || (value.cleanupConfirmed && value.counts.fixtureCreated !== value.counts.fixtureDeleted)) fail("BROWSER_REPORT_REFUSED");
  if (value.cleanupConfirmed ? value.cleanupFailurePoint !== null : !BROWSER_CLEANUP_FAILURE_POINTS.includes(value.cleanupFailurePoint)) fail("BROWSER_REPORT_REFUSED");
  if (!Array.isArray(value.stages) || value.stages.length > PASSWORD_STAGES.length) fail("BROWSER_REPORT_REFUSED");
  let previous = -1;
  for (const stage of value.stages) {
    if (!exact(stage, ["name", "passed"]) || typeof stage.passed !== "boolean") fail("BROWSER_REPORT_REFUSED");
    const index = PASSWORD_STAGES.indexOf(stage.name);
    if (index <= previous) fail("BROWSER_REPORT_REFUSED"); previous = index;
  }
  const passed = value.status === "passed";
  if (passed !== (value.code === "PASSED") || (passed && (value.stages.length !== PASSWORD_STAGES.length || value.stages.some(stage => !stage.passed) || PASSWORD_CHECKS.some(key => !value.checks[key]) || Object.entries(PASSWORD_COUNT_LIMITS).some(([key, count]) => value.counts[key] !== count)))) fail("BROWSER_REPORT_REFUSED");
  return structuredClone(value);
}
function immutable(value) {
  if (value && typeof value === "object") { for (const item of Object.values(value)) immutable(item); Object.freeze(value); }
  return value;
}
function namespaceReport(value) {
  const stages = ["namespace-preflight", "image-pull", "namespace-create", "namespace-inspect", "namespace-start", "namespace-exit-check", "namespace-complete"];
  const cleanup = ["not-started", "namespace-inspect", "namespace-stop", "namespace-remove", "namespace-verify", "namespace-clean"];
  if (!exact(value, ["stage", "cleanupStage", "groupConfirmed", "cleanupConfirmed", "creationConfirmed", "unknownOutcome", "failure"]) || !stages.includes(value.stage) || !cleanup.includes(value.cleanupStage) || ["groupConfirmed", "cleanupConfirmed", "creationConfirmed", "unknownOutcome"].some(key => typeof value[key] !== "boolean") || (value.failure !== null && !CASE_FAILURES.includes(value.failure)) || (value.cleanupConfirmed && value.unknownOutcome)) fail("BROWSER_REPORT_REFUSED");
  return structuredClone(value);
}
function identityProjection(validator, value) {
  try { return validator(value); } catch { fail("BROWSER_REPORT_REFUSED"); }
}
export function evaluateBrowserCase(scenario, input) {
  browserScenarioFile(scenario);
  const identity = scenario === "identity-data-api";
  if (!exact(input, ["report", "namespace", "failure", ...(identity ? ["identityRls", "events", "captureTask", "captureTaskFixturesAbsent"] : [])]) || (input.failure !== null && !CASE_FAILURES.includes(input.failure)) || identity && typeof input.captureTaskFixturesAbsent !== "boolean") fail("BROWSER_REPORT_REFUSED");
  const report = input.report === null ? null : scenario === "logout" ? validateAuthLocalReport(input.report) : identity ? identityProjection(validateIdentityAuthReport, input.report) : validatePasswordReport(input.report);
  const identityRls = identity && input.identityRls !== null ? identityProjection(validateIdentityRlsPacket, input.identityRls) : null;
  const events = identity && input.events !== null ? identityProjection(validateEventsPacket, input.events) : null;
  const captureTask = identity && input.captureTask !== null ? identityProjection(validateCaptureTaskPacket, input.captureTask) : null;
  const namespace = input.namespace === null ? null : namespaceReport(input.namespace);
  const natural = namespace?.stage === "namespace-complete" && namespace.failure === null && namespace.creationConfirmed && namespace.groupConfirmed && namespace.cleanupConfirmed && !namespace.unknownOutcome;
  const componentsPassed = !identity || (identityRls?.status === "passed" && !identityRls.writeOutcomeUncertain && events?.status === "passed" && !events.writeOutcomeUncertain && captureTask?.status === "passed" && !captureTask.writeOutcomeUncertain && input.captureTaskFixturesAbsent);
  const accepted = input.failure === null && natural === true && report?.status === "passed" && report.cleanupConfirmed && componentsPassed;
  const code = accepted ? "PASSED" : input.failure ?? namespace?.failure ?? (!report ? "BROWSER_REPORT_REFUSED" : !natural ? "BROWSER_NAMESPACE_CLEANUP_UNCONFIRMED" : "BROWSER_ACCEPTANCE_FAILED");
  return immutable({ scenario, status: accepted ? "passed" : "failed", code, report, namespace, ...(identity ? { identityRls, events, captureTask, captureTaskFixturesAbsent: input.captureTaskFixturesAbsent } : {}) });
}
const identityCaseComponents = scenario => scenario === "identity-data-api" ? { identityRls: null, events: null, captureTask: null, captureTaskFixturesAbsent: false } : {};
const notRunCase = scenario => immutable({ scenario, status: "not-run", code: "NOT_RUN", report: null, namespace: null, ...identityCaseComponents(scenario) });
const betweenCaseChecks = () => BROWSER_SCENARIOS.slice(0, -1).map((after, index) => ({ after, before: BROWSER_SCENARIOS[index + 1], confirmed: false }));
function caseFailureCode(error) { return error instanceof AuthLocalCiError && CASE_FAILURES.includes(error.code) ? error.code : "AUTH_LOCAL_CI_FAILED"; }
/** Same sequence is used by CI and tests; callbacks do not change its gates. */
export async function runAuthCaseSequence({ runCase, checkAuthUsersEmpty }) {
  if (typeof runCase !== "function" || typeof checkAuthUsersEmpty !== "function") fail("BROWSER_SCENARIO_REFUSED");
  const cases = BROWSER_SCENARIOS.map(notRunCase);
  const authUsersEmptyBetweenCases = betweenCaseChecks();
  for (const [index, scenario] of BROWSER_SCENARIOS.entries()) {
    try { cases[index] = evaluateBrowserCase(scenario, await runCase(scenario)); }
    catch (error) { cases[index] = immutable({ scenario, status: "failed", code: caseFailureCode(error), report: null, namespace: null, ...identityCaseComponents(scenario) }); }
    if (cases[index].status !== "passed") return immutable({ accepted: false, code: cases[index].code, phase: "browser", cases, authUsersEmptyBetweenCases });
    if (index < BROWSER_SCENARIOS.length - 1) {
      try { if (await checkAuthUsersEmpty() !== true) fail("BROWSER_REPORT_REFUSED"); authUsersEmptyBetweenCases[index].confirmed = true; }
      catch (error) { return immutable({ accepted: false, code: caseFailureCode(error), phase: "between-cases", cases, authUsersEmptyBetweenCases }); }
    }
  }
  return immutable({ accepted: true, code: "PASSED", phase: "complete", cases, authUsersEmptyBetweenCases });
}

export function renderLocalConfig(template, projectId) {
  if (!PROJECT_PATTERN.test(projectId) || typeof template !== "string" || template.split('project_id = "SC_AUTH_LOCAL_CI_PROJECT"').length !== 2 || /\benv\s*\(|\[remotes|supabase\.co|seed\.sql|schemas\s*=\s*\[[^\]]*app_private/.test(template)) fail("LOCAL_CONFIG_REFUSED");
  const settings = [["api", "port = 54321"], ["api", 'schemas = ["public"]'], ["db", "port = 54322"], ["db", "major_version = 17"], ["db.migrations", "enabled = false"], ["db.migrations", "schema_paths = []"], ["db.seed", "enabled = false"], ["db.seed", "sql_paths = []"], ["auth", "enabled = true"], ["auth", `site_url = "${APP_URL}"`], ["auth", "enable_signup = false"], ["auth", "enable_anonymous_sign_ins = false"], ["auth.email", "enable_signup = true"]];
  for (const [section, setting] of settings) {
    const parts = template.replaceAll("\r\n", "\n").split(`\n[${section}]\n`);
    if (parts.length !== 2 || !parts[1].split(/\n\[/, 1)[0].split("\n").includes(setting)) fail("LOCAL_CONFIG_REFUSED");
  }
  return template.replace('project_id = "SC_AUTH_LOCAL_CI_PROJECT"', `project_id = "${projectId}"`);
}

async function canonicalFile(root, path) {
  const absolute = assertTempDescendant(root, resolve(root, path));
  const stat = await lstat(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || await realpath(absolute) !== absolute) fail("SOURCE_FILE_REFUSED");
  return readFile(absolute);
}

export async function loadCanonicalMigrations(root = ROOT) {
  let manifest; try { manifest = JSON.parse(await canonicalFile(root, "supabase/sql-editor/manifest.json")); } catch { fail("MIGRATION_MANIFEST_REFUSED"); }
  if (manifest.formatVersion !== 1 || manifest.hashAlgorithm !== "sha256" || !Array.isArray(manifest.installation) || manifest.installation.length !== MIGRATION_COUNT) fail("MIGRATION_MANIFEST_REFUSED");
  const files = (await readdir(resolve(root, "supabase/migrations"))).filter(name => name.endsWith(".sql")).sort();
  const plan = [];
  for (const [index, row] of manifest.installation.entries()) {
    if (!object(row) || row.order !== index + 1 || !/^\d{14}$/.test(row.version) || typeof row.source !== "string" || !new RegExp(`^supabase/migrations/${row.version}_[a-z0-9_]+\\.sql$`).test(row.source) || !/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.bytes) || row.bytes < 1 || typeof row.file !== "string" || !new RegExp(`^installation/${String(row.order).padStart(3, "0")}_${row.version}_[a-z0-9_]+\\.sql$`).test(row.file) || files[index] !== basename(row.source)) fail("MIGRATION_MANIFEST_REFUSED");
    const source = await canonicalFile(root, row.source), copy = await canonicalFile(root, `supabase/sql-editor/${row.file}`);
    if (source.length !== row.bytes || createHash("sha256").update(source).digest("hex") !== row.sha256 || !source.equals(copy)) fail("MIGRATION_INTEGRITY_FAILED");
    plan.push({ source });
  }
  if (files.length !== plan.length) fail("MIGRATION_MANIFEST_REFUSED");
  return plan;
}

export async function assertNoEnvironmentFiles(root = ROOT) {
  if ((await readdir(root)).some(name => name.startsWith(".env") && name !== ".env.example")) fail("ENVIRONMENT_FILE_REFUSED");
}

function baseEnvironment(environment, home) {
  const child = Object.fromEntries(["PATH", "LANG", "LC_ALL", "TZ"].filter(key => typeof environment[key] === "string").map(key => [key, environment[key]]));
  return { ...child, HOME: home, XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: join(home, ".cache"), CI: "true", GITHUB_ACTIONS: "true", RUNNER_TEMP: environment.RUNNER_TEMP, SC_AUTH_LOCAL_CI_RUN: "1", NEXT_TELEMETRY_DISABLED: "1", NO_COLOR: "1" };
}

export function createBrowserEnvironment(environment, home, runRoot, local) {
  const reportPath = join(assertTempDescendant(environment.RUNNER_TEMP, runRoot), REPORT_NAME);
  const child = { ...baseEnvironment(environment, home), PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright", NODE_ENV: "development", APP_MODE: "supabase", APP_URL, SUPABASE_URL: API_URL, SUPABASE_PUBLISHABLE_KEY: local.publishable, SUPABASE_SECRET_KEY: local.secret, AUTH_STATE_SECRET: randomBytes(48).toString("base64url"), AUTH_RATE_LIMIT_SECRET: randomBytes(48).toString("base64url"), SC_AUTH_LOCAL_CI_REPORT_PATH: reportPath };
  validateAuthLocalChildEnvironment(child);
  return child;
}

export function localPsqlEnvironment(environment, home, local) {
  return { ...baseEnvironment(environment, home), PGHOST: "127.0.0.1", PGPORT: "54322", PGUSER: "postgres", PGDATABASE: "postgres", PGPASSWORD: local.password, PGSSLMODE: "disable", PGCONNECT_TIMEOUT: "8", PGCLIENTENCODING: "UTF8", PGAPPNAME: "sc.auth.local.ci", PGOPTIONS: "-c statement_timeout=60000 -c lock_timeout=5000" };
}

/** Only this private container owns Next/Chromium, including detached PGIDs.
 * Name/label are registered before creation; neither enters public reports.
 */
export function createBrowserContainerPlan(root, runRoot, runnerTemp, uid, gid, scenario = "logout") {
  browserScenarioFile(scenario);
  assertTempDescendant(runnerTemp, runRoot);
  if (!isAbsolute(root) || [root, runRoot].some(path => path.includes(",") || path.includes("\0")) || !integer(uid, 65535) || uid === 0 || !integer(gid, 65535) || gid === 0) fail("BROWSER_NAMESPACE_REFUSED");
  return Object.freeze({ root, runRoot, uid, gid, scenario, name: `sc-auth-browser-${randomBytes(12).toString("hex")}`, label: randomBytes(12).toString("hex") });
}
function assertBrowserPlan(plan) {
  if (!exact(plan, ["root", "runRoot", "uid", "gid", "scenario", "name", "label"]) || !/^sc-auth-browser-[a-f0-9]{24}$/.test(plan.name) || !/^[a-f0-9]{24}$/.test(plan.label) || !isAbsolute(plan.root) || !isAbsolute(plan.runRoot) || [plan.root, plan.runRoot].some(path => path.includes(",") || path.includes("\0")) || !integer(plan.uid, 65535) || plan.uid === 0 || !integer(plan.gid, 65535) || plan.gid === 0) fail("BROWSER_NAMESPACE_REFUSED");
  browserScenarioFile(plan.scenario);
}
export function browserContainerArguments(plan, environment) {
  assertBrowserPlan(plan);
  const config = validateAuthLocalChildEnvironment(environment);
  if (dirname(config.reportPath) !== plan.runRoot || environment.HOME !== join(plan.runRoot, "home") || environment.PLAYWRIGHT_BROWSERS_PATH !== "/ms-playwright") fail("BROWSER_NAMESPACE_REFUSED");
  const names = Object.keys(environment);
  const allowed = new Set(["PATH", "LANG", "LC_ALL", "TZ", "HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "CI", "GITHUB_ACTIONS", "RUNNER_TEMP", "SC_AUTH_LOCAL_CI_RUN", "NEXT_TELEMETRY_DISABLED", "NO_COLOR", "PLAYWRIGHT_BROWSERS_PATH", "NODE_ENV", "APP_MODE", "APP_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "AUTH_STATE_SECRET", "AUTH_RATE_LIMIT_SECRET", "SC_AUTH_LOCAL_CI_REPORT_PATH"]);
  if (names.some(name => !allowed.has(name) || typeof environment[name] !== "string" || environment[name].includes("\0"))) fail("BROWSER_NAMESPACE_REFUSED");
  return ["create", "--name", plan.name, "--label", `${BROWSER_LABEL}=${plan.label}`, "--platform", "linux/amd64", "--network", "host", "--ipc", "private", "--shm-size", "512m", "--init", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--log-driver", "none", "--restart", "no", "--user", `${plan.uid}:${plan.gid}`, "--workdir", plan.root, "--mount", `type=bind,source=${plan.root},target=${plan.root}`, "--mount", `type=bind,source=${plan.runRoot},target=${plan.runRoot}`, ...names.flatMap(name => ["--env", name]), "--entrypoint", "/usr/bin/node", BROWSER_IMAGE, join(plan.root, "node_modules/@playwright/test/cli.js"), "test", browserScenarioFile(plan.scenario), "--config=playwright.auth-local.config.ts"];
}

// A projection only: never docker inspect's full JSON, Config.Env or State.Error.
export const BROWSER_INSPECT_FORMAT = `{"id":{{json .Id}},"name":{{json .Name}},"label":{{json (index .Config.Labels "${BROWSER_LABEL}")}},"image":{{json .Config.Image}},"imageId":{{json .Image}},"state":{{json .State.Status}},"running":{{json .State.Running}},"exitCode":{{json .State.ExitCode}},"pidMode":{{json .HostConfig.PidMode}},"ipcMode":{{json .HostConfig.IpcMode}},"networkMode":{{json .HostConfig.NetworkMode}},"privileged":{{json .HostConfig.Privileged}},"init":{{json .HostConfig.Init}},"user":{{json .Config.User}},"logType":{{json .HostConfig.LogConfig.Type}},"capDrop":{{json .HostConfig.CapDrop}},"securityOpt":{{json .HostConfig.SecurityOpt}},"shmSize":{{json .HostConfig.ShmSize}},"restartPolicy":{{json .HostConfig.RestartPolicy.Name}}}`;
export function validateBrowserContainer(value, plan, expectedId) {
  assertBrowserPlan(plan);
  if (!exact(value, ["id", "name", "label", "image", "imageId", "state", "running", "exitCode", "pidMode", "ipcMode", "networkMode", "privileged", "init", "user", "logType", "capDrop", "securityOpt", "shmSize", "restartPolicy"]) || !/^[a-f0-9]{64}$/.test(value.id) || (expectedId !== undefined && value.id !== expectedId) || value.name !== `/${plan.name}` || value.label !== plan.label || value.image !== BROWSER_IMAGE || value.imageId !== BROWSER_IMAGE_ID || !["created", "running", "exited", "dead"].includes(value.state) || value.running !== (value.state === "running") || !integer(value.exitCode, 255) || value.pidMode !== "" || value.ipcMode !== "private" || value.networkMode !== "host" || value.privileged !== false || value.init !== true || value.user !== `${plan.uid}:${plan.gid}` || value.logType !== "none" || JSON.stringify(value.capDrop) !== '["ALL"]' || !Array.isArray(value.securityOpt) || value.securityOpt.length !== 1 || !["no-new-privileges:true", "no-new-privileges"].includes(value.securityOpt[0]) || value.shmSize !== 536870912 || value.restartPolicy !== "no") fail("BROWSER_NAMESPACE_REFUSED");
  return { id: value.id, running: value.running, state: value.state, exitCode: value.exitCode };
}
async function browserInventory(plan, run) {
  const rows = await Promise.all([`label=${BROWSER_LABEL}=${plan.label}`, `name=^/${plan.name}$`].map(filter => run("docker", ["ps", "--all", "--quiet", "--no-trunc", "--filter", filter], 15000)));
  return rows.every(row => row.stdout.trim() === "");
}
async function inspectBrowser(plan, id, run) {
  const row = await run("docker", ["inspect", "--type", "container", "--format", BROWSER_INSPECT_FORMAT, id ?? plan.name], 15000);
  return validateBrowserContainer(oneJson(row.stdout), plan, id);
}
function browserFailure(error) {
  const allowed = ["COMMAND_FAILED", "COMMAND_UNAVAILABLE", "COMMAND_TIMEOUT", "COMMAND_OUTPUT_LIMIT", "COMMAND_GROUP_UNCONFIRMED", "BROWSER_NAMESPACE_REFUSED", "BROWSER_NAMESPACE_NOT_EMPTY", "BROWSER_NAMESPACE_EXIT_FAILED", "AUTH_LOCAL_CI_FAILED"];
  return error instanceof AuthLocalCiError && allowed.includes(error.code) ? error.code : "AUTH_LOCAL_CI_FAILED";
}
export async function runBrowserNamespace({ plan, environment, run }) {
  const args = browserContainerArguments(plan, environment);
  let createAttempted = false, preflightEmpty = false, creationConfirmed = false, id, unknownOutcome = false, groupConfirmed = false, cleanupConfirmed = false, failure, stage = "namespace-preflight", cleanupStage = "not-started";
  try {
    if (!await browserInventory(plan, run)) fail("BROWSER_NAMESPACE_NOT_EMPTY");
    preflightEmpty = true;
    stage = "image-pull";
    await run("docker", ["pull", "--platform", "linux/amd64", BROWSER_IMAGE], 300000, { capture: false });
    stage = "namespace-create";
    createAttempted = true;
    let created;
    try { created = await run("docker", args, 30000, { env: environment }); }
    catch (error) { unknownOutcome = true; throw error; }
    id = created.stdout.trim();
    if (!/^[a-f0-9]{64}$/.test(id)) { unknownOutcome = true; fail("BROWSER_NAMESPACE_REFUSED"); }
    stage = "namespace-inspect";
    const createdState = await inspectBrowser(plan, id, run);
    if (createdState.state !== "created" || createdState.running) fail("BROWSER_NAMESPACE_REFUSED");
    creationConfirmed = true;
    stage = "namespace-start";
    try {
      const result = await run("docker", ["start", "--attach", id], 300000, { capture: false }); groupConfirmed = result.groupConfirmed === true;
      if (!groupConfirmed) { unknownOutcome = true; fail("COMMAND_GROUP_UNCONFIRMED"); }
    }
    catch (error) { groupConfirmed = error.groupConfirmed === true; if (browserFailure(error) !== "COMMAND_FAILED") unknownOutcome = true; throw error; }
    stage = "namespace-exit-check";
    const completedState = await inspectBrowser(plan, id, run);
    if (completedState.state !== "exited" || completedState.running || completedState.exitCode !== 0) fail("BROWSER_NAMESPACE_EXIT_FAILED");
    stage = "namespace-complete";
  } catch (error) { failure = browserFailure(error); }
  finally {
    if (!createAttempted) cleanupConfirmed = preflightEmpty;
    else {
      try {
        cleanupStage = "namespace-inspect";
        if (await browserInventory(plan, run)) {
          // A lost create reply may still commit later. Immediate empty is not proof.
          cleanupConfirmed = false;
        } else {
          let known = await inspectBrowser(plan, id && /^[a-f0-9]{64}$/.test(id) ? id : undefined, run);
          id = known.id;
          if (known.running) { cleanupStage = "namespace-stop"; await run("docker", ["stop", "--time", "10", id], 30000, { capture: false }); }
          cleanupStage = "namespace-inspect";
          known = await inspectBrowser(plan, id, run);
          cleanupStage = "namespace-remove";
          await run("docker", ["rm", "--force", id], 30000, { capture: false });
          cleanupStage = "namespace-verify";
          cleanupConfirmed = await browserInventory(plan, run) && creationConfirmed && !unknownOutcome;
        }
      } catch { cleanupConfirmed = false; }
    }
    if (cleanupConfirmed) cleanupStage = "namespace-clean";
  }
  if (!cleanupConfirmed) failure ??= unknownOutcome ? "BROWSER_NAMESPACE_OUTCOME_UNCONFIRMED" : "BROWSER_NAMESPACE_CLEANUP_UNCONFIRMED";
  return { stage, cleanupStage, groupConfirmed, cleanupConfirmed, creationConfirmed, unknownOutcome, failure: failure ?? null };
}

async function terminateCommandGroup(child) {
  if (!Number.isSafeInteger(child.pid) || child.pid < 2) return false;
  try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error.code === "ESRCH") return true; return false; }
  for (let count = 0; count < 20; count++) {
    try { process.kill(-child.pid, 0); } catch (error) { return error.code === "ESRCH"; }
    await new Promise(resolveTimer => setTimeout(resolveTimer, 50));
  }
  return false;
}

/** No shell, inherited credentials, raw stderr or unbounded buffering. */
export function runBoundedProcess(command, args, options, dependencies = {}) {
  const spawnProcess = dependencies.spawnProcess ?? spawn;
  const terminateGroup = dependencies.terminateGroup ?? terminateCommandGroup;
  return new Promise((resolveProcess, rejectProcess) => {
    let child, output = "", bytes = 0, reason, settled = false, timer, closeTimer;
    const finish = async code => {
      if (settled) return; settled = true; clearTimeout(timer); clearTimeout(closeTimer);
      const groupConfirmed = child ? await terminateGroup(child) : false;
      if (reason || code !== 0 || !groupConfirmed) {
        const error = new AuthLocalCiError(reason ?? (!groupConfirmed ? "COMMAND_GROUP_UNCONFIRMED" : "COMMAND_FAILED"));
        error.groupConfirmed = groupConfirmed; rejectProcess(error);
      } else resolveProcess({ stdout: output, groupConfirmed: true });
    };
    const abort = code => {
      if (settled || reason) return; reason = code;
      void terminateGroup(child).catch(() => false);
      closeTimer = setTimeout(() => void finish(null), 1500);
    };
    if (!Array.isArray(args) || !Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 600000 || !Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1 || options.maxBytes > 2097152) { rejectProcess(new AuthLocalCiError("PROCESS_OPTIONS_REFUSED")); return; }
    try {
      child = spawnProcess(command, args, { cwd: options.cwd, env: options.env, shell: false, detached: true, stdio: ["pipe", "pipe", "pipe"] });
      const collect = (chunk, stdout) => {
        if (reason || settled) return;
        const nextBytes = bytes + Buffer.byteLength(chunk);
        if (nextBytes > options.maxBytes) { abort("COMMAND_OUTPUT_LIMIT"); return; }
        bytes = nextBytes;
        if (stdout && options.capture !== false) output += chunk.toString("utf8");
      };
      child.stdout.on("data", chunk => collect(chunk, true));
      child.stderr.on("data", chunk => collect(chunk, false));
      child.stdin.on("error", () => {});
      child.on("error", () => { reason = "COMMAND_UNAVAILABLE"; void finish(null); });
      child.on("close", code => void finish(code));
      timer = setTimeout(() => abort("COMMAND_TIMEOUT"), options.timeoutMs);
      child.stdin.end(options.input ?? "");
    } catch { reason = "COMMAND_UNAVAILABLE"; void finish(null); }
  });
}

async function freePort(port) {
  await new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once("error", () => rejectPort(new AuthLocalCiError("LOCAL_PORT_IN_USE")));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => server.close(error => error ? rejectPort(new AuthLocalCiError("LOCAL_PORT_IN_USE")) : resolvePort()));
  });
}

export const DATABASE_PREFLIGHT = `begin read only;
select jsonb_build_object('owner',current_user,'database',current_database(),'version',current_setting('server_version_num')::integer,
 'auth_empty',not exists(select 1 from auth.users),'schema_empty',to_regnamespace('app_private') is null,
 'application_empty',not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m')),
 'infrastructure_ready',exists(select 1 from pg_proc p join pg_event_trigger e on e.evtfoid=p.oid where p.oid=to_regprocedure('public.rls_auto_enable()') and p.prorettype='event_trigger'::regtype and p.prosecdef and pg_get_userbyid(p.proowner)='postgres' and p.proconfig @> array['search_path=pg_catalog'] and e.evtname='ensure_rls' and e.evtenabled='O' and e.evtevent='ddl_command_end' and pg_get_userbyid(e.evtowner)='postgres' and e.evttags @> array['CREATE TABLE','CREATE TABLE AS','SELECT INTO'] and cardinality(e.evttags)=3));
rollback;`;
export function assertDatabasePreflight(value, requireInfrastructure = true) {
  if (!exact(value, ["owner", "database", "version", "auth_empty", "schema_empty", "application_empty", "infrastructure_ready"]) || value.owner !== "postgres" || value.database !== "postgres" || !Number.isSafeInteger(value.version) || value.version < 170000 || value.version >= 180000 || value.auth_empty !== true || value.schema_empty !== true || value.application_empty !== true || typeof value.infrastructure_ready !== "boolean") fail("LOCAL_DATABASE_REFUSED");
  if (requireInfrastructure && value.infrastructure_ready !== true) fail("INFRASTRUCTURE_CONTRACT_MISSING");
}
/** Only Auth users are checked between cases; app/rate rows are not asserted empty. */
export const AUTH_USERS_BETWEEN_CASES = `begin read only;
select jsonb_build_object('owner',current_user,'database',current_database(),'version',current_setting('server_version_num')::integer,'auth_empty',not exists(select 1 from auth.users));
rollback;`;
export function assertAuthUsersEmpty(value) {
  if (!exact(value, ["owner", "database", "version", "auth_empty"]) || value.owner !== "postgres" || value.database !== "postgres" || !integer(value.version, 179999) || value.version < 170000 || value.auth_empty !== true) fail("LOCAL_AUTH_USERS_REFUSED");
}
/** Only the fresh disposable stack, after confirmed SDK cleanup and namespace
 * completion. These ten relations cover the exercised capture/task fixture.
 * This is separate from Auth absence and never rescues an uncertain write. */
export const CAPTURE_TASK_FIXTURES_AFTER_CASE = `begin read only;
set local statement_timeout='10s';
select jsonb_build_object('owner',current_user,'database',current_database(),'version',current_setting('server_version_num')::integer,
 'auth_empty',not exists(select 1 from auth.users),
 'checked_tables',10,
 'domain_empty',not exists(
  select 1 from public.captures union all select 1 from public.tasks
  union all select 1 from public.categories union all select 1 from public.projects
  union all select 1 from public.capture_links union all select 1 from public.capture_file_links
  union all select 1 from public.links union all select 1 from public.domain_events
  union all select 1 from app_private.command_receipts union all select 1 from app_private.capture_task_revisions));
rollback;`;
export function assertCaptureTaskFixturesAbsent(value) {
  if (!exact(value, ["owner", "database", "version", "auth_empty", "checked_tables", "domain_empty"]) ||
      value.owner !== "postgres" || value.database !== "postgres" || !integer(value.version, 179999) ||
      value.version < 170000 || value.auth_empty !== true || value.checked_tables !== 10 ||
      value.domain_empty !== true) fail("LOCAL_CAPTURE_TASK_FIXTURES_REFUSED");
}
/** CI infrastructure fixture only. Real CLI Auth/Storage schemas remain intact.
 * This models the reviewed event-trigger contract, not the cloud helper's body.
 * No replacement, Auth stub, bootstrap, persisted probe or remote application.
 */
export const LOCAL_INFRASTRUCTURE_FIXTURE = `begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
do $guard$
declare f oid:=to_regprocedure('public.rls_auto_enable()'); t oid;
begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or exists(select 1 from auth.users) or to_regnamespace('app_private') is not null
  or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m')) then raise exception 'Disposable empty local database required.'; end if;
 select oid into t from pg_event_trigger where evtname='ensure_rls';
 if (f is null)<>(t is null) then raise exception 'Partial infrastructure contract refused.'; end if;
 if f is null and t is null then
  execute $create$create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $body$
   declare row record; begin
    for row in select c.objid from pg_event_trigger_ddl_commands() c join pg_class r on r.oid=c.objid join pg_namespace n on n.oid=r.relnamespace where c.object_type='table' and n.nspname in ('public','app_private') loop
     execute format('alter table %s enable row level security',row.objid::regclass);
    end loop;
   end $body$$create$;
  execute $create$create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function public.rls_auto_enable()$create$;
 end if;
 if not exists(select 1 from pg_proc p join pg_event_trigger e on e.evtfoid=p.oid where p.oid=to_regprocedure('public.rls_auto_enable()') and p.prorettype='event_trigger'::regtype and p.prosecdef and pg_get_userbyid(p.proowner)='postgres' and p.proconfig @> array['search_path=pg_catalog'] and e.evtname='ensure_rls' and e.evtenabled='O' and e.evtevent='ddl_command_end' and pg_get_userbyid(e.evtowner)='postgres' and e.evttags @> array['CREATE TABLE','CREATE TABLE AS','SELECT INTO'] and cardinality(e.evttags)=3) then raise exception 'Infrastructure contract mismatch.'; end if;
end $guard$;
savepoint exact_rls_probe;
create table public.__sc_auth_local_rls_probe(id integer);
do $proof$ begin if not exists(select 1 from pg_class where oid='public.__sc_auth_local_rls_probe'::regclass and relrowsecurity) then raise exception 'Infrastructure failed the RLS probe.'; end if; end $proof$;
rollback to savepoint exact_rls_probe;
do $proof$ begin if to_regclass('public.__sc_auth_local_rls_probe') is not null then raise exception 'RLS probe cleanup unconfirmed.'; end if; end $proof$;
commit;`;
function oneJson(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) fail("DATABASE_REPORT_REFUSED");
  try { return JSON.parse(lines[0]); } catch { fail("DATABASE_REPORT_REFUSED"); }
}

export async function runAuthLocalCi(environment = process.env) {
  const { runnerTemp } = requireCiRunner(environment);
  await inPhase("environment", async () => {
    if (await realpath(runnerTemp) !== runnerTemp || !(await lstat(runnerTemp)).isDirectory()) fail("RUNNER_PATH_REFUSED");
    await assertNoEnvironmentFiles();
  });
  const migrations = await inPhase("sources", () => loadCanonicalMigrations());
  const template = await inPhase("sources", async () => (await canonicalFile(ROOT, "tests/fixtures/supabase-auth-local/config.toml")).toString("utf8"));
  await inPhase("ports", async () => { for (const port of [3117, 54320, 54321, 54322]) await freePort(port); });
  const runRoot = await inPhase("private-directories", async () => {
    const path = await mkdtemp(join(runnerTemp, "sc-auth-local-ci-"));
    await chmod(path, 0o700); return path;
  });
  const project = join(runRoot, "project"), home = join(runRoot, "home"), projectId = `sc-auth-ci-${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  await inPhase("private-directories", async () => {
    await mkdir(join(project, "supabase"), { recursive: true, mode: 0o700 });
    await mkdir(home, { mode: 0o700 });
    await writeFile(join(project, "supabase/config.toml"), renderLocalConfig(template, projectId), { flag: "wx", mode: 0o600 });
  });
  const childEnv = baseEnvironment(environment, home);
  const run = (command, args, timeoutMs, options = {}) => runBoundedProcess(command, args, { cwd: ROOT, env: childEnv, timeoutMs, maxBytes: 1048576, ...options });
  const cliArgs = args => ["--workdir", project, ...args];
  let startAttempted = false, stackCleanupConfirmed = false, privateDirectoriesRemoved = false, failure, catalogueChecks = 0, migrationsApplied = 0, phase = "cli-help", cleanupStage = "not-started";
  let sequence = { accepted: false, cases: BROWSER_SCENARIOS.map(notRunCase), authUsersEmptyBetweenCases: betweenCaseChecks() };
  const caseResources = [];
  const inventory = async () => {
    const filter = `label=com.supabase.cli.project=${projectId}`;
    const output = await Promise.all([["ps", "--all", "--quiet"], ["volume", "ls", "--quiet"], ["network", "ls", "--quiet"]].map(args => run("docker", [...args, "--filter", filter], 15000)));
    return output.every(row => row.stdout.trim() === "");
  };
  try {
    if ((await run("supabase", ["--version"], 15000)).stdout.trim() !== CLI_VERSION) fail("CLI_VERSION_REFUSED");
    const help = (await run("supabase", ["--help"], 15000)).stdout;
    if (!["start", "stop", "status", "--workdir"].every(word => help.includes(word))) fail("CLI_HELP_REFUSED");
    for (const [command, required] of [["start", []], ["status", ["--output"]], ["stop", ["--project-id", "--no-backup"]]]) {
      const output = (await run("supabase", [command, "--help"], 15000)).stdout;
      if (required.some(flag => !output.includes(flag))) fail("CLI_HELP_REFUSED");
    }
    if (!await inventory()) fail("PROJECT_NOT_EMPTY");
    startAttempted = true;
    phase = "stack-start";
    await run("supabase", cliArgs(["start"]), 600000, { capture: false });
    phase = "local-status";
    const local = decodeLocalStatus((await run("supabase", cliArgs(["status", "-o", "json"]), 30000)).stdout);
    const pg = localPsqlEnvironment(environment, home, local);
    const query = async sql => oneJson((await run("psql", ["--no-psqlrc", "--no-password", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--file=-"], 60000, { env: pg, input: sql })).stdout);
    phase = "database-preflight";
    assertDatabasePreflight(await query(DATABASE_PREFLIGHT), false);
    phase = "local-infrastructure";
    await run("psql", ["--no-psqlrc", "--no-password", "--quiet", "--set", "ON_ERROR_STOP=1", "--file=-"], 60000, { env: pg, input: LOCAL_INFRASTRUCTURE_FIXTURE, capture: false });
    assertDatabasePreflight(await query(DATABASE_PREFLIGHT));
    phase = "migrations";
    for (const migration of migrations) {
      await run("psql", ["--no-psqlrc", "--no-password", "--quiet", "--set", "ON_ERROR_STOP=1", "--file=-"], 60000, { env: pg, input: migration.source, capture: false });
      migrationsApplied++;
    }
    phase = "catalogue";
    const catalogue = await query((await canonicalFile(ROOT, "supabase/tests/release-catalog.sql")).toString("utf8"));
    if (catalogue?.ok !== true || !integer(catalogue.checks, 10000) || catalogue.checks < 1000 || catalogue.version !== 1 || !Array.isArray(catalogue.deviations) || catalogue.deviations.length !== 0) fail("LOCAL_CATALOGUE_FAILED");
    catalogueChecks = catalogue.checks;
    phase = "schema-reload";
    await run("psql", ["--no-psqlrc", "--no-password", "--quiet", "--set", "ON_ERROR_STOP=1", "--file=-"], 15000, { env: pg, input: "notify pgrst, 'reload schema';", capture: false });
    sequence = await runAuthCaseSequence({
      checkAuthUsersEmpty: async () => {
        phase = "between-cases";
        assertAuthUsersEmpty(await query(AUTH_USERS_BETWEEN_CASES)); return true;
      },
      runCase: async scenario => {
        let report = null, namespace = null, caseFailure = null, identityRls = null, events = null, captureTask = null, captureTaskFixturesAbsent = false;
        try {
          phase = "private-directories";
          const caseRoot = await mkdtemp(join(runnerTemp, "sc-auth-local-ci-"));
          const resource = { root: caseRoot, namespace: null, attempted: false };
          caseResources.push(resource);
          await chmod(caseRoot, 0o700);
          const caseHome = join(caseRoot, "home"); await mkdir(caseHome, { mode: 0o700 });
          const browserEnv = createBrowserEnvironment(environment, caseHome, caseRoot, local);
          const browserPlan = createBrowserContainerPlan(ROOT, caseRoot, runnerTemp, process.getuid(), process.getgid(), scenario);
          phase = "browser";
          resource.attempted = true;
          namespace = await runBrowserNamespace({ plan: browserPlan, environment: browserEnv, run });
          resource.namespace = namespace;
          phase = "browser-report";
          const reportPath = validateAuthLocalChildEnvironment(browserEnv).reportPath;
          const read = await readBrowserCaseReports(scenario, reportPath);
          report = read.report;
          if (scenario === "identity-data-api") { identityRls = read.identityRls; events = read.events; captureTask = read.captureTask; }
          if (read.failure !== null) fail(read.failure);
          if (scenario === "identity-data-api" && report?.status === "passed" && report.cleanupConfirmed &&
              namespace?.stage === "namespace-complete" && namespace.failure === null &&
              namespace.creationConfirmed && namespace.groupConfirmed && namespace.cleanupConfirmed && !namespace.unknownOutcome &&
              identityRls?.status === "passed" && !identityRls.writeOutcomeUncertain &&
              events?.status === "passed" && !events.writeOutcomeUncertain &&
              captureTask?.status === "passed" && !captureTask.writeOutcomeUncertain) {
            assertCaptureTaskFixturesAbsent(await query(CAPTURE_TASK_FIXTURES_AFTER_CASE));
            captureTaskFixturesAbsent = true;
          }
        } catch (error) { caseFailure = caseFailureCode(error); }
        return { report, namespace, failure: caseFailure ?? namespace?.failure ?? null, ...(scenario === "identity-data-api" ? { identityRls, events, captureTask, captureTaskFixturesAbsent } : {}) };
      },
    });
    phase = sequence.phase;
    if (!sequence.accepted) fail(sequence.code);
  } catch (error) { failure = error instanceof AuthLocalCiError ? error.code : "AUTH_LOCAL_CI_FAILED"; }
  finally {
    if (startAttempted) {
      try {
        cleanupStage = "stop-own-project";
        await run("supabase", cliArgs(["stop", "--project-id", projectId, "--no-backup"]), 120000, { capture: false });
        cleanupStage = "verify-own-project";
        stackCleanupConfirmed = await inventory();
      } catch { stackCleanupConfirmed = false; }
    }
    if ((stackCleanupConfirmed || !startAttempted) && caseResources.every(resource => !resource.attempted || resource.namespace?.cleanupConfirmed === true)) {
      try {
        cleanupStage = "private-directories";
        for (const path of [project, home]) {
          assertTempDescendant(runRoot, path);
          if ((await lstat(path)).isSymbolicLink() || await realpath(path) !== path) fail("RUNNER_PATH_REFUSED");
          await rm(path, { recursive: true, force: false });
        }
        for (const resource of caseResources) {
          assertTempDescendant(runnerTemp, resource.root);
          if ((await lstat(resource.root)).isSymbolicLink() || await realpath(resource.root) !== resource.root) fail("RUNNER_PATH_REFUSED");
          await rm(resource.root, { recursive: true, force: false });
        }
        privateDirectoriesRemoved = true;
      } catch { stackCleanupConfirmed = false; failure ??= "PRIVATE_DIRECTORY_CLEANUP_FAILED"; }
    }
    if (stackCleanupConfirmed) cleanupStage = privateDirectoriesRemoved ? "complete" : "private-directories-retained";
  }
  return { schemaVersion: 4, status: !failure && sequence.accepted && stackCleanupConfirmed && privateDirectoriesRemoved ? "passed" : "failed", code: !stackCleanupConfirmed && startAttempted ? "STACK_CLEANUP_UNCONFIRMED" : failure ?? "PASSED", phase, cleanupStage, cliVersion: CLI_VERSION, migrations: migrations.length, migrationsApplied, catalogueChecks, cases: sequence.cases, authUsersEmptyBetweenCases: sequence.authUsersEmptyBetweenCases, stackCleanupConfirmed, privateDirectoriesRemoved };
}

export async function main(argv = process.argv.slice(2), environment = process.env, output = value => process.stdout.write(`${JSON.stringify(value)}\n`)) {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === "--help")) {
    output({ schemaVersion: 1, mode: "help", code: "NO_SERVICE_STARTED", execute: "--execute", requires: "Linux GitHub Actions / CI / SC_AUTH_LOCAL_CI_RUN=1 / isolated RUNNER_TEMP", hostedAccess: false }); return 0;
  }
  if (argv.length !== 1 || argv[0] !== "--execute") { output({ schemaVersion: 1, status: "failed", code: "ARGUMENTS_REFUSED" }); return 1; }
  try { const report = await runAuthLocalCi(environment); output(report); return report.status === "passed" ? 0 : 1; }
  catch (error) { output({ schemaVersion: 1, status: "failed", code: error instanceof AuthLocalCiError ? error.code : "AUTH_LOCAL_CI_FAILED", phase: PHASES.includes(error.phase) ? error.phase : "environment", migrations: MIGRATION_COUNT, migrationsApplied: 0 }); return 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
