// Dedicated caller envelope. Protocol metadata alone is never native evidence.
import { ADMIN_NATIVE_CASES, ADMIN_NATIVE_MANIFEST, ADMIN_NATIVE_CLEANUP_COUNTS, validateAdminNativeReport, validateAdminNativeCleanup, assembleAdminNativePacket } from "./admin-native-backend-contract.mjs";
import { ADMIN_NATIVE_MODULES } from "./admin-native-backend-case.mjs";
export const ADMIN_LOCAL_CASE_CHECKS = Object.freeze(["ordinaryVerified", "actorsRegistered", "masterBootstrapVerified", "pipelinePassed", "sdkCleanupConfirmed", "retainedSqlConfirmed"]);
export const ADMIN_LOCAL_INFRA_CHECKS = Object.freeze(["ownedNamespace", "pg17", "instanceIdentity", "services", "catalogue", "markerBound", "groupsQuiescent", "namespaceCleanup", "directoriesRemoved"]);
export const ADMIN_LOCAL_PHASES = Object.freeze(["not-run", "environment", "sources", "ports", "private-directories", "cli-help", "stack-start", "local-status", "database-preflight", "local-infrastructure", "migrations", "catalogue", "marker", "schema-reload", "fixture-create", "login", "session-verification", "ordinary-access", "bootstrap", "protocol", "auth-cleanup", "retained-sql", "teardown", "complete"]);
export const ADMIN_LOCAL_CODES = Object.freeze(["PASSED", "NOT_RUN", "ENVIRONMENT_REFUSED", "SOURCE_REFUSED", "PORT_REFUSED", "COMMAND_FAILED", "COMMAND_UNAVAILABLE", "COMMAND_TIMEOUT", "COMMAND_OUTPUT_LIMIT", "COMMAND_GROUP_UNCONFIRMED", "LOCAL_NAMESPACE_REFUSED", "LOCAL_DATABASE_REFUSED", "LOCAL_SQL_REFUSED", "FIXTURE_CREATE_FAILED", "LOGIN_FAILED", "SESSION_REFUSED", "ORDINARY_ACCESS_REFUSED", "BOOTSTRAP_REFUSED", "PROTOCOL_FAILED", "AUTH_CLEANUP_UNCONFIRMED", "RETAINED_SQL_REFUSED", "WRITE_OUTCOME_UNCERTAIN", "TEARDOWN_UNCONFIRMED", "CASE_FAILED"]);
export const ADMIN_LOCAL_LIMITATIONS = Object.freeze(["hostedSupabaseVerified", "originalFactoriesVerified", "nextHandlersVerified", "browserContextsVerified", "forcedFirstEntryGuiVerified", "automaticIssueAcceptance"]);
export const ADMIN_LOCAL_NEW_PATHS = Object.freeze(["scripts/verification/admin-native-backend-local-ci.mjs", "tests/e2e-auth-local/admin-native-backend-local-case.mjs", "tests/e2e-auth-local/admin-native-backend-local-case.d.mts", "tests/e2e-auth-local/admin-native-backend-local-ci-contract.mjs", "tests/e2e-auth-local/admin-native-backend-local-ci-contract.d.mts", "tests/scripts/admin-native-backend-local-ci.test.mjs", "tests/scripts/admin-native-backend-local-case.test.mjs", "tests/scripts/admin-native-backend-local-ci.types.mts", ".github/workflows/admin-native-backend-local-ci.yml"]);
const MIGRATIONS = ["20261007151834_identity_foundation.sql", "20261007151850_auth_password_completion.sql", "20261007151904_restrict_rls_event_trigger_execution.sql", "20261007210519_capture_task_transactions.sql", "20261007223710_activity_page.sql", "20261009144343_financial_transactions.sql", "20261009144350_knowledge_pages_links.sql", "20261009150122_identity_admin_settings.sql", "20261009151557_account_preferences.sql", "20261009152200_projects_habits.sql", "20261009152822_private_storage_drive.sql", "20261009154609_global_search_activity.sql", "20261009160151_encrypted_vault.sql", "20261009160158_google_calendar.sql", "20261009231338_file_cleanup_fairness.sql", "20261010010955_close_public_sequence_defaults.sql", "20261010044217_finance_monthly_plan.sql", "20261011071500_admin_auth_creation_order.sql", "20261011113751_own_sessions.sql", "20261021045700_spec08_private_entity_images.sql", "20261021144650_spec08_habit_frequency_history.sql", "20261021171416_spec08_capture_document_write.sql"];
// Declared union, not a claim about all transitively loaded helper exports.
export const ADMIN_LOCAL_SOURCE_PATHS = Object.freeze([...new Set(["tests/e2e-auth-local/qualified-chromium.mjs","tests/e2e-auth-local/browser-process-environment.mjs","tests/e2e-auth-local/qualified-chromium.d.mts","tests/scripts/qualified-chromium.test.mjs","scripts/verification/prepare-qualified-chromium.py","scripts/verification/chromium-no-store-qualification.mjs","scripts/verification/prepare-chromium-no-store-qualification.py","tests/scripts/prepare_qualified_chromium_test.py",...ADMIN_NATIVE_MANIFEST, ...ADMIN_NATIVE_MODULES.filter(p => !p.startsWith("node_modules/")), ...MIGRATIONS.map(p => "supabase/migrations/" + p), "supabase/sql-editor/manifest.json", "tests/fixtures/supabase-auth-local/config.toml", "package-lock.json", "scripts/verification/auth-local-ci.mjs", "supabase/tests/release-catalog.sql", ...ADMIN_LOCAL_NEW_PATHS])].sort());
export const ADMIN_LOCAL_DEPENDENCY_PATHS = Object.freeze(ADMIN_NATIVE_MODULES.filter(p => p.startsWith("node_modules/")).slice().sort());
export const ADMIN_LOCAL_SDK_VERSIONS = Object.freeze({ "@supabase/supabase-js": "2.117.2", "server-only": "0.0.1" });
const HASH = /^[a-f0-9]{64}$/, SHA = /^[a-f0-9]{40}$/, EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const refuse = () => { throw new Error("ADMIN_LOCAL_REPORT_REFUSED"); };
function snapshot(value, depth = 0, budget = { n: 0 }, chain = new Set()) {
  if (++budget.n > 16384 || depth > 24) refuse();
  if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) || typeof value === "string" && value.length <= 2048) return value;
  if (!value || typeof value !== "object" || chain.has(value)) refuse();
  const array = Array.isArray(value); if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length > 256 || keys.some(k => typeof k !== "string")) refuse();
  chain.add(value);
  try {
    if (array) {
      const size = descriptors.length?.value; if (!Number.isSafeInteger(size) || size > 128 || keys.length !== size + 1) refuse();
      const output = []; for (let i = 0; i < size; i++) { const d = descriptors[String(i)]; if (!d?.enumerable || !Object.hasOwn(d, "value")) refuse(); output.push(snapshot(d.value, depth + 1, budget, chain)); } return output;
    }
    const output = {}; for (const key of keys) { const d = descriptors[key]; if (!d.enumerable || !Object.hasOwn(d, "value")) refuse(); Object.defineProperty(output, key, { value: snapshot(d.value, depth + 1, budget, chain), enumerable: true, writable: true, configurable: true }); } return output;
  } finally { chain.delete(value); }
}
const exact = (value, keys) => { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== keys.slice().sort().join("|")) refuse(); };
const bools = (value, keys) => { exact(value, keys); for (const key of keys) if (typeof value[key] !== "boolean") refuse(); };
const number = (v, max) => { if (!Number.isSafeInteger(v) || v < 0 || v > max) refuse(); };
const stable = v => Array.isArray(v) ? "[" + v.map(stable).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}" : JSON.stringify(v);
function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function rows(value, paths, dependencies = false) {
  if (!Array.isArray(value) || value.length !== paths.length) refuse();
  return value.map((row, i) => { exact(row, ["path", "sha256", "bytes"]); if (row.path !== paths[i] || !HASH.test(row.sha256)) refuse(); number(row.bytes, 2097152); if (dependencies && row.path === "node_modules/server-only/empty.js") { if (row.bytes !== 0 || row.sha256 !== EMPTY) refuse(); } else if (row.bytes === 0) refuse(); return row; });
}
function localCase(v) {
  exact(v, ["schemaVersion", "scenario", "case", "sourceSha", "status", "code", "phase", "counts", "checks", "pipeline", "cleanup", "writeOutcomeUncertain", "pendingRequests", "pendingInspections"]);
  if (v.schemaVersion !== 1 || v.scenario !== "admin-native-backend-local-case" || !ADMIN_NATIVE_CASES.includes(v.case) || !SHA.test(v.sourceSha) || !["passed", "failed"].includes(v.status) || !ADMIN_LOCAL_CODES.includes(v.code) || !ADMIN_LOCAL_PHASES.includes(v.phase) || typeof v.writeOutcomeUncertain !== "boolean") refuse();
  exact(v.counts, ["setupRequests", "fixtureCreated", "sessionsVerified", "fixtureRemoved"]); number(v.counts.setupRequests, 8); number(v.counts.fixtureCreated, 2); number(v.counts.sessionsVerified, 2); number(v.counts.fixtureRemoved, 3); number(v.pendingRequests, 8); number(v.pendingInspections, 1); bools(v.checks, ADMIN_LOCAL_CASE_CHECKS);
  const p = v.pipeline === null ? null : validateAdminNativeReport(v.pipeline), c = v.cleanup === null ? null : validateAdminNativeCleanup(v.cleanup);
  if (p && (p.case !== v.case || p.sourceSha !== v.sourceSha) || c && (!p || c.case !== v.case || c.sourceSha !== v.sourceSha) || p?.writeOutcomeUncertain && c?.stages.length) refuse();
  if (p?.writeOutcomeUncertain && !v.writeOutcomeUncertain || c?.writeOutcomeUncertain && !v.writeOutcomeUncertain || v.code === "WRITE_OUTCOME_UNCERTAIN" && !v.writeOutcomeUncertain) refuse();
  if (v.checks.ordinaryVerified && (v.counts.setupRequests !== 8 || v.counts.fixtureCreated !== 2 || v.counts.sessionsVerified !== 2) || v.checks.actorsRegistered && !v.checks.ordinaryVerified || v.checks.masterBootstrapVerified && !v.checks.actorsRegistered || p && !v.checks.masterBootstrapVerified) refuse();
  if (v.checks.pipelinePassed !== (p?.status === "passed") || v.checks.sdkCleanupConfirmed !== (c?.status === "passed") || v.counts.fixtureRemoved !== (c?.counts.removedUsers ?? 0) || v.checks.retainedSqlConfirmed && !v.checks.sdkCleanupConfirmed) refuse();
  if (c?.stages.length && (!p.terminalKnown || p.writeOutcomeUncertain) || v.checks.sdkCleanupConfirmed && (v.writeOutcomeUncertain || v.pendingRequests || v.pendingInspections)) refuse();
  if (v.status === "passed" ? v.code !== "PASSED" || v.phase !== "complete" || v.writeOutcomeUncertain || v.pendingRequests || v.pendingInspections || ADMIN_LOCAL_CASE_CHECKS.some(k => !v.checks[k]) || v.counts.fixtureRemoved !== ADMIN_NATIVE_CLEANUP_COUNTS[v.case].removedUsers : v.code === "PASSED" || v.code === "NOT_RUN") refuse();
  return { ...v, pipeline: p, cleanup: c };
}
export function validateAdminLocalCaseReport(input) { try { return freeze(localCase(snapshot(input))); } catch { refuse(); } }
function ci(v) {
  exact(v, ["schemaVersion", "scenario", "status", "code", "phase", "sourceSha", "sourceHashes", "dependencyHashes", "sdkVersions", "cliVersion", "checks", "cases", "packet", "limitations", "writeOutcomeUncertain"]);
  if (v.schemaVersion !== 1 || v.scenario !== "admin-native-backend-local-ci" || !["passed", "failed"].includes(v.status) || !ADMIN_LOCAL_CODES.includes(v.code) || !ADMIN_LOCAL_PHASES.includes(v.phase) || v.cliVersion !== "2.120.0" || typeof v.writeOutcomeUncertain !== "boolean") refuse();
  if (v.code === "WRITE_OUTCOME_UNCERTAIN" && !v.writeOutcomeUncertain) refuse();
  exact(v.sdkVersions, Object.keys(ADMIN_LOCAL_SDK_VERSIONS)); for (const key of Object.keys(ADMIN_LOCAL_SDK_VERSIONS)) if (v.sdkVersions[key] !== ADMIN_LOCAL_SDK_VERSIONS[key]) refuse();
  bools(v.checks, ["environment", "sources"]); bools(v.limitations, ADMIN_LOCAL_LIMITATIONS); if (ADMIN_LOCAL_LIMITATIONS.some(k => v.limitations[k])) refuse();
  if (v.sourceSha !== null && !SHA.test(v.sourceSha)) refuse();
  if (v.checks.sources) { if (!SHA.test(v.sourceSha)) refuse(); rows(v.sourceHashes, ADMIN_LOCAL_SOURCE_PATHS); rows(v.dependencyHashes, ADMIN_LOCAL_DEPENDENCY_PATHS, true); } else if (!Array.isArray(v.sourceHashes) || v.sourceHashes.length || !Array.isArray(v.dependencyHashes) || v.dependencyHashes.length) refuse();
  if (!Array.isArray(v.cases) || v.cases.length !== 3) refuse();
  let stopped = false, unknown = v.writeOutcomeUncertain;
  const entries = v.cases.map((e, i) => {
    exact(e, ["case", "status", "code", "phase", "migrationsApplied", "catalogueChecks", "checks", "report", "portFailure", "writeOutcomeUncertain"]); bools(e.checks, ADMIN_LOCAL_INFRA_CHECKS);
    if (e.case !== ADMIN_NATIVE_CASES[i] || !["passed", "failed", "not-run"].includes(e.status) || !ADMIN_LOCAL_CODES.includes(e.code) || !ADMIN_LOCAL_PHASES.includes(e.phase) || typeof e.writeOutcomeUncertain !== "boolean") refuse();
    if (e.code === "WRITE_OUTCOME_UNCERTAIN" && !e.writeOutcomeUncertain) refuse();
    number(e.migrationsApplied, 22); number(e.catalogueChecks, 1428); const r = e.report === null ? null : localCase(e.report);
    if (e.portFailure !== null) {
      exact(e.portFailure, ["port", "operation", "errorClass"]);
      if (![54320, 54321, 54322].includes(e.portFailure.port) || !["listen", "close"].includes(e.portFailure.operation) || !["EADDRINUSE", "EACCES", "other"].includes(e.portFailure.errorClass) || e.status !== "failed" || e.code !== "PORT_REFUSED" || e.phase !== "ports" || r || e.migrationsApplied || e.catalogueChecks || e.writeOutcomeUncertain || e.checks.ownedNamespace) refuse();
    }
    if (r && (r.case !== e.case || r.sourceSha !== v.sourceSha || !v.checks.sources || !e.checks.catalogue || !e.checks.markerBound) || r?.writeOutcomeUncertain && !e.writeOutcomeUncertain) refuse();
    if (r && (r.pendingRequests || r.pendingInspections) && e.checks.groupsQuiescent) refuse();
    unknown ||= e.writeOutcomeUncertain;
    if (e.checks.pg17 && !e.checks.ownedNamespace || e.checks.instanceIdentity && !e.checks.pg17 || e.checks.services && !e.checks.instanceIdentity || e.checks.catalogue && (!e.checks.services || e.migrationsApplied !== 22 || e.catalogueChecks !== 1428) || e.checks.markerBound && !e.checks.catalogue || e.checks.namespaceCleanup && !e.checks.groupsQuiescent || e.checks.directoriesRemoved && !e.checks.namespaceCleanup) refuse();
    if (e.status === "not-run") { if (e.code !== "NOT_RUN" || e.phase !== "not-run" || r || e.migrationsApplied || e.catalogueChecks || e.writeOutcomeUncertain || ADMIN_LOCAL_INFRA_CHECKS.some(k => e.checks[k])) refuse(); }
    else if (stopped || !v.checks.environment || !v.checks.sources) refuse();
    if (e.status === "passed" ? e.code !== "PASSED" || e.phase !== "complete" || r?.status !== "passed" || e.writeOutcomeUncertain || ADMIN_LOCAL_INFRA_CHECKS.some(k => !e.checks[k]) : e.status !== "not-run" && e.code === "PASSED") refuse();
    if (e.status !== "passed") stopped = true;
    return { case: e.case, report: r?.pipeline ?? null, cleanup: r?.cleanup ?? null, namespaceCleanup: r?.pipeline ? e.checks.namespaceCleanup ? "confirmed" : "failed" : "not-run" };
  });
  if (unknown && !v.writeOutcomeUncertain) refuse();
  const packet = v.checks.sources ? assembleAdminNativePacket({ sourceSha: v.sourceSha, cases: entries, writeOutcomeUncertain: v.writeOutcomeUncertain }) : null;
  if (stable(v.packet) !== stable(packet)) refuse();
  if (v.checks.sources) for (const entry of entries) if (entry.report) for (const row of entry.report.sourceHashes) if (!v.sourceHashes.some(r => r.path === row.path && r.sha256 === row.sha256 && r.bytes === row.bytes)) refuse();
  if (v.status === "passed" ? v.code !== "PASSED" || v.phase !== "complete" || !v.checks.environment || !v.checks.sources || v.writeOutcomeUncertain || v.cases.some(e => e.status !== "passed") || packet?.status !== "passed" : v.code === "PASSED" || v.code === "NOT_RUN") refuse();
  return { ...v, packet };
}
export function validateAdminLocalCiReport(input) { try { return freeze(ci(snapshot(input))); } catch { refuse(); } }
