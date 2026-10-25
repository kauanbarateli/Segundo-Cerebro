import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { CLI_VERSION, requireCiRunner, assertTempDescendant, assertNoEnvironmentFiles, loadHistorical026Migrations, renderLocalConfig, decodeLocalStatus, localPsqlEnvironment, runBoundedProcess, DATABASE_PREFLIGHT, assertDatabasePreflight, LOCAL_INFRASTRUCTURE_FIXTURE } from "./auth-local-ci.mjs";
import { CURRENT27_CANONICAL_REVIEW, readCurrent27CanonicalMigrations } from "../../tests/helpers/canonical-release-source.mjs";
import { createAdminOwnedTransport, acceptAdminContainer, verifyAdminTslibScope } from "./admin-native-backend-local-ci.mjs";
import { ADMIN_LOCAL_DEPENDENCY_PATHS } from "../../tests/e2e-auth-local/admin-native-backend-local-ci-contract.mjs";
import { CAPTURE_IMAGE_MODULES } from "../../tests/e2e-auth-local/capture-image-storage-support.mjs";
import { AVATAR_BUCKETS, AVATAR_SQL_QUERIES, createAvatarStorageCase } from "../../tests/e2e-auth-local/avatar-storage-local-case.mjs";
import { AVATAR_LIMITATIONS, validateAvatarStorageReport } from "../../tests/e2e-auth-local/avatar-storage-contract.mjs";
import { createAvatarStackDiagnosticRecorder, emitAvatarStackDiagnostic } from "../../tests/e2e-auth-local/avatar-storage-stack-diagnostic.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Reviewed 026 identity and 1720 catalogue checks; native PG17 remains a gate.
// Historical 001–025 identities are preserved; no hosted/release acceptance.
const AVATAR_MIGRATIONS = 26, AVATAR_EXPECTED_CATALOGUE = 1720;
const EMPTY_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { const error = new Error(code); error.stack = "AvatarRunnerFailure: " + code; throw error; };
const closedRecord = (value, keys) => {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return keys.every(key => Object.hasOwn(descriptors, key) && descriptors[key].enumerable && Object.hasOwn(descriptors[key], "value"));
};
const closedRows = value => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 256 || Reflect.ownKeys(value).length !== value.length + 1) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Array.from({ length: value.length }, (_, index) => descriptors[index]).every(descriptor => descriptor?.enumerable && Object.hasOwn(descriptor, "value"));
};
export const AVATAR_NEW_PATHS = Object.freeze(["scripts/verification/avatar-storage-local-ci.mjs", ...["local-case.mjs", "local-case.d.mts", "contract.mjs", "contract.d.mts", "stack-diagnostic.mjs"].map(name => "tests/e2e-auth-local/avatar-storage-" + name), ...["local-case.test.mjs", "local-ci.test.mjs"].map(name => "tests/scripts/avatar-storage-" + name), "tests/scripts/avatar-storage.types.mts", ".github/workflows/avatar-storage-local-ci.yml"]);
// Derived from the actual import traversal, then closed for independent consumers.
const AVATAR_MIGRATION_FILES = ["20261007151834_identity_foundation.sql", "20261007151850_auth_password_completion.sql", "20261007151904_restrict_rls_event_trigger_execution.sql", "20261007210519_capture_task_transactions.sql", "20261007223710_activity_page.sql", "20261009144343_financial_transactions.sql", "20261009144350_knowledge_pages_links.sql", "20261009150122_identity_admin_settings.sql", "20261009151557_account_preferences.sql", "20261009152200_projects_habits.sql", "20261009152822_private_storage_drive.sql", "20261009154609_global_search_activity.sql", "20261009160151_encrypted_vault.sql", "20261009160158_google_calendar.sql", "20261009231338_file_cleanup_fairness.sql", "20261010010955_close_public_sequence_defaults.sql", "20261010044217_finance_monthly_plan.sql", "20261011071500_admin_auth_creation_order.sql", "20261011113751_own_sessions.sql", "20261021045700_spec08_private_entity_images.sql","20261021144650_spec08_habit_frequency_history.sql", "20261021171416_spec08_capture_document_write.sql", "20261022042432_spec08_calendar_participants.sql", "20261022042500_spec08_finance_card_metadata.sql", "20261022042501_spec08_capture_knowledge_promotion.sql", "20261023061901_onboarding_foundation.sql"];
const HISTORICAL026_CATALOGUE = "tests/fixtures/schema-release-026/release-catalog.sql";
const HISTORICAL026_MANIFEST = "tests/fixtures/schema-release-026/manifest.json";
const AVATAR_RELEASE_PATHS = Object.freeze([
  ...CURRENT27_CANONICAL_REVIEW.flatMap((row, index) => ["supabase/migrations/" + row.file, "supabase/sql-editor/installation/" + String(index + 1).padStart(3, "0") + "_" + row.file]),
  "tests/helpers/canonical-release-source.mjs", "tests/helpers/canonical-release-source.d.mts", "scripts/test-local-sql.mjs", HISTORICAL026_CATALOGUE, HISTORICAL026_MANIFEST,
]);
export const AVATAR_SOURCE_PATHS = Object.freeze([...new Set(["tests/e2e-auth-local/qualified-chromium.mjs", "tests/e2e-auth-local/browser-process-environment.mjs", ...AVATAR_NEW_PATHS, ...CAPTURE_IMAGE_MODULES.filter(path => !path.startsWith("node_modules/")), ...AVATAR_RELEASE_PATHS, "scripts/verification/auth-local-ci.mjs", "tests/e2e-auth-local/auth-local-lifecycle-contract.mjs", "scripts/verification/admin-native-backend-local-ci.mjs", ...["admin-native-backend-case.mjs", "admin-native-backend-contract.mjs", "admin-native-backend-local-case.mjs", "admin-native-backend-local-ci-contract.mjs", "capture-image-storage-support.mjs", "capture-task-persistence-support.mjs", "capture-task-persistence-contract.mjs", "identity-data-api-contract.mjs"].map(file => "tests/e2e-auth-local/" + file), "tests/fixtures/supabase-auth-local/config.toml", "supabase/tests/release-catalog.sql", "supabase/sql-editor/manifest.json", "package.json", "package-lock.json", ".nvmrc"])].sort());
export const AVATAR_CI_CHECKS = Object.freeze(["environment", "sources", "ownedNamespace", "pg17", "catalogue", "casePassed", "finalSql", "quiescent", "namespaceRemoved", "directoriesRemoved"]);
export const AVATAR_INSTANCE_SQL = "begin read only;set local statement_timeout='10s';select jsonb_build_object('database',current_database(),'currentUser',current_user,'serverVersion',current_setting('server_version_num')::int,'systemIdentifier',(select system_identifier::text from pg_control_system()));rollback;";
export const AVATAR_BASELINE_SQL = "begin read only;set local statement_timeout='10s';select jsonb_build_object('users',(select count(*) from auth.users),'objects',(select count(*) from storage.objects where bucket_id in('second-brain-staging','second-brain-files')),'privateBuckets',(select count(*)=2 and bool_and(not public) from storage.buckets where id in('second-brain-staging','second-brain-files')));rollback;";
export function requireAvatarCi(environment, platform = process.platform) { if (environment?.SC_AVATAR_STORAGE_LOCAL_CI_RUN !== "1" || !/^[a-f0-9]{40}$/.test(environment.GITHUB_SHA)) fail("ENVIRONMENT_REFUSED"); return requireCiRunner(environment, platform); }
export function decodeAvatarSql(input) { if (typeof input !== "string" || Buffer.byteLength(input) > 1048576) fail("SQL_NOT_PROVEN"); const lines = input.trim().split(/\r?\n/); if (lines.length !== 1) fail("SQL_NOT_PROVEN"); let value; try { value = JSON.parse(lines[0]); } catch { fail("SQL_NOT_PROVEN"); } if (!value || typeof value !== "object" || Array.isArray(value)) fail("SQL_NOT_PROVEN"); return value; }
export function verifyAvatarInstance(value, expected) { if (value?.database !== "postgres" || value.currentUser !== "postgres" || !Number.isSafeInteger(value.serverVersion) || value.serverVersion < 170000 || value.serverVersion >= 180000 || !/^[0-9]{1,32}$/.test(value.systemIdentifier) || expected !== undefined && value.systemIdentifier !== expected) fail("INSTANCE_REFUSED"); return value.systemIdentifier; }
export function validateAvatarActors(value) { if (!value || Object.keys(value).sort().join(",") !== "a,b" || [value.a, value.b].some(actor => !actor || Object.keys(actor).sort().join(",") !== "id,marker,sessionId" || !UUID.test(actor.id) || !UUID.test(actor.sessionId) || !/^[a-f0-9]{64}$/.test(actor.marker)) || new Set([value.a.id, value.b.id, value.a.sessionId, value.b.sessionId]).size !== 4) fail("OWNERSHIP_REFUSED"); return structuredClone(value); }

/** Fixed read-only projection; only proven UUIDs, SHA/system ID and marker hex
 * become psql variables. No caller SQL or personal data is accepted. */
export function avatarInspectionInput(context, actors, uploadId) {
  validateAvatarActors(actors);
  if (!UUID.test(uploadId) || [actors.a.id, actors.b.id, actors.a.sessionId, actors.b.sessionId].includes(uploadId) || !/^[a-f0-9]{40}$/.test(context.sourceSha) || !/^sc-avatar-native-[a-f0-9]{32}$/.test(context.namespace) || !/^[0-9]{1,32}$/.test(context.systemIdentifier)) fail("SQL_NOT_PROVEN");
  const variables = { sc_a: actors.a.id, sc_b: actors.b.id, sc_sa: actors.a.sessionId, sc_sb: actors.b.sessionId, sc_ma: actors.a.marker, sc_mb: actors.b.marker, sc_upload: uploadId, sc_system: context.systemIdentifier };
  const prefix = Object.entries(variables).map(([key, value]) => "\\set " + key + " '" + value + "'\n").join("");
  return prefix + `begin read only;set local statement_timeout='10s';set local lock_timeout='2s';
with owners(id,session,marker,ordinal) as(values(:'sc_a'::uuid,:'sc_sa'::uuid,:'sc_ma'::text,1),(:'sc_b'::uuid,:'sc_sb'::uuid,:'sc_mb'::text,2))
select jsonb_build_object(
 'instance',jsonb_build_object('database',current_database(),'currentUser',current_user,'serverVersion',current_setting('server_version_num')::int,'systemIdentifier',(select system_identifier::text from pg_control_system())),
 'bound',(select count(*)=2 and bool_and(u.role='authenticated' and not u.is_anonymous and u.raw_app_meta_data->>'sc_avatar_ci_marker'=o.marker and s.user_id=o.id) from owners o join auth.users u on u.id=o.id join auth.sessions s on s.id=o.session),
 'privateBuckets',(select count(*)=2 and bool_and(not public) from storage.buckets where id in('second-brain-staging','second-brain-files')),
 'profiles',(select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'avatar_file_id',p.avatar_file_id,'avatar_url',p.avatar_url) order by o.ordinal),'[]') from owners o join public.profiles p on p.user_id=o.id),
 'ledger',(select jsonb_agg(jsonb_build_object('events',(select count(*) from public.domain_events e where e.user_id=o.id),'receipts',(select count(*) from app_private.command_receipts r where r.user_id=o.id)) order by o.ordinal) from owners o),
 'files',(select coalesce(jsonb_agg(f.payload order by f.id),'[]') from public.drive_files f where f.user_id in(:'sc_a'::uuid,:'sc_b'::uuid)),
 'file',(select f.payload from public.drive_files f where f.user_id=:'sc_b'::uuid and f.id=:'sc_upload'::uuid and f.purged_at is null),
 'reservations',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'file_id',r.file_id) order by r.id),'[]') from app_private.upload_reservations r where r.user_id in(:'sc_a'::uuid,:'sc_b'::uuid)),
 'objects',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket_id',bucket_id,'name',name) order by bucket_id,id),'[]') from storage.objects where bucket_id in('second-brain-staging','second-brain-files') and name=:'sc_b'||'/'||:'sc_upload'),
 'receipts',(select coalesce(jsonb_agg(jsonb_build_object('command',r.command,'result',r.result) order by r.command),'[]') from app_private.command_receipts r where r.user_id=:'sc_b'::uuid),
 'profileEvents',(select coalesce(jsonb_agg(jsonb_build_object('beforeAvatar',e.before->'avatar_file_id','afterAvatar',e.after->'avatar_file_id') order by case when e.after->>'avatar_file_id'=:'sc_upload' then 0 else 1 end),'[]') from public.domain_events e where e.user_id=:'sc_b'::uuid and e.entity_type='profile' and e.action='updated'),
 'absent',not exists(select 1 from auth.users where id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from auth.sessions where user_id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from auth.refresh_tokens where user_id::text in(:'sc_a',:'sc_b')) and not exists(select 1 from public.profiles where user_id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from public.user_preferences where user_id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from public.user_modules where user_id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from public.user_roles where user_id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from public.user_moderation where user_id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from public.user_entitlements where user_id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from public.drive_files where user_id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from app_private.upload_reservations where user_id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from public.domain_events where user_id in(:'sc_a'::uuid,:'sc_b'::uuid)) and not exists(select 1 from app_private.command_receipts where user_id in(:'sc_a'::uuid,:'sc_b'::uuid))
);rollback;`;
}
export function acceptAvatarInspection(value, context, actors, uploadId) {
  verifyAvatarInstance(value?.instance, context.systemIdentifier);
  const keys = ["instance", "bound", "privateBuckets", "profiles", "ledger", "files", "file", "reservations", "objects", "receipts", "profileEvents", "absent"];
  if (!value || Object.keys(value).sort().join(",") !== keys.sort().join(",") || ["bound", "privateBuckets", "absent"].some(key => typeof value[key] !== "boolean") || ["profiles", "ledger", "files", "reservations", "objects", "receipts", "profileEvents"].some(key => !Array.isArray(value[key]) || value[key].length > 128) || value.objects.some(row => !UUID.test(row.id) || !AVATAR_BUCKETS.includes(row.bucket_id) || row.name !== actors.b.id + "/" + uploadId) || value.profiles.some(row => ![actors.a.id, actors.b.id].includes(row.user_id)) || value.ledger.length !== 2 || value.ledger.some(row => !Number.isSafeInteger(row.events) || !Number.isSafeInteger(row.receipts) || row.events < 0 || row.receipts < 0)) fail("SQL_NOT_PROVEN");
  return value;
}

async function canonical(path) { const file = assertTempDescendant(ROOT, resolve(ROOT, path)), stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || await realpath(file) !== file) fail("SOURCE_REFUSED"); return readFile(file); }
/** Imports are followed only for local mjs; TS runtime modules come from the
 * reviewed processor's actual Rolldown inventory. Test/type/workflow paths are
 * preparation sources, not claims that those files execute inside the case. */
export async function collectAvatarSources(readRun, sourceSha, migrations) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha) || typeof readRun !== "function") fail("SOURCE_REFUSED");
  const manifest = JSON.parse((await canonical("supabase/sql-editor/manifest.json")).toString("utf8"));
  const current = await readCurrent27CanonicalMigrations(ROOT);
  if (!Array.isArray(migrations) || migrations.length !== AVATAR_MIGRATIONS || current.length !== 27 || manifest.installation?.length !== 27 || AVATAR_MIGRATION_FILES.some((file, index) => current[index].file !== file || !Buffer.isBuffer(migrations[index]?.source) || !migrations[index].source.equals(current[index].source))) fail("SOURCE_REFUSED");
  if (hash(await canonical(HISTORICAL026_MANIFEST)) !== "88f036a9a41bcc1528fde8c320e43374f3edb25e1083eb485082b01a142839e2" || hash(await canonical(HISTORICAL026_CATALOGUE)) !== "4557741f008d48ea60ad8a3e2d5a41667630543c3bf2ab0682ec2b33ad97e297") fail("SOURCE_REFUSED");
  const paths = new Set([...AVATAR_NEW_PATHS, ...CAPTURE_IMAGE_MODULES.filter(path => !path.startsWith("node_modules/")), ...manifest.installation.flatMap(file => [file.source, "supabase/sql-editor/" + file.file]), "tests/helpers/canonical-release-source.mjs", "tests/helpers/canonical-release-source.d.mts", "scripts/test-local-sql.mjs", HISTORICAL026_CATALOGUE, HISTORICAL026_MANIFEST, "tests/fixtures/supabase-auth-local/config.toml", "supabase/tests/release-catalog.sql", "supabase/sql-editor/manifest.json", "package.json", "package-lock.json", ".nvmrc"]);
  const queue = ["scripts/verification/avatar-storage-local-ci.mjs", "tests/e2e-auth-local/avatar-storage-local-case.mjs"], followed = new Set();
  while (queue.length) {
    const path = queue.shift(); if (followed.has(path)) continue; followed.add(path); paths.add(path);
    const text = (await canonical(path)).toString("utf8");
    for (const match of text.matchAll(/\b(?:import|export)\s[^;]*?\bfrom\s*["'](\.[^"']+\.mjs)["']/g)) {
      const target = resolve(ROOT, dirname(path), match[1]); assertTempDescendant(ROOT, target); const relativePath = relative(ROOT, target).replaceAll("\\", "/"); paths.add(relativePath); queue.push(relativePath);
    }
  }
  if (paths.size !== AVATAR_SOURCE_PATHS.length || AVATAR_SOURCE_PATHS.some(path => !paths.has(path))) fail("SOURCE_REFUSED");
  const sourceHashes = [];
  for (const path of [...paths].sort()) { const bytes = await canonical(path); const git = await readRun("git", ["show", sourceSha + ":" + path], 15000); if (!bytes.equals(Buffer.from(git.stdout))) fail("SOURCE_REFUSED"); sourceHashes.push({ path, bytes: bytes.length, sha256: hash(bytes) }); }
  const lock = JSON.parse((await canonical("package-lock.json")).toString("utf8")), dependencyHashes = [];
  for (const path of ADMIN_LOCAL_DEPENDENCY_PATHS) {
    const bytes = await canonical(path); let folder = dirname(resolve(ROOT, path)), verified = false;
    while (relative(ROOT, folder).replaceAll("\\", "/").startsWith("node_modules/")) {
      const key = relative(ROOT, folder).replaceAll("\\", "/");
      let packageBytes;
      try { packageBytes = await canonical(key + "/package.json"); } catch (error) { if (error.code !== "ENOENT") fail("SOURCE_REFUSED"); folder = dirname(folder); continue; }
      const pkg = JSON.parse(packageBytes.toString("utf8")), pinned = lock.packages[key];
      if (key === "node_modules/tslib/modules") { const rootPackage = JSON.parse((await canonical("node_modules/tslib/package.json")).toString("utf8")); verifyAdminTslibScope(key + "/package.json", packageBytes, rootPackage, lock.packages["node_modules/tslib"]); folder = dirname(folder); continue; }
      if (pkg.name !== key.slice("node_modules/".length) || pinned?.version !== pkg.version || !/^https:\/\/registry\.npmjs\.org\//.test(pinned.resolved) || !/^sha512-/.test(pinned.integrity)) fail("SOURCE_REFUSED");
      verified = true; break;
    }
    if (!verified) fail("SOURCE_REFUSED");
    dependencyHashes.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  for (const [name, version] of Object.entries({ "@supabase/supabase-js": "2.117.2", sharp: "0.35.5", "server-only": "0.0.1" })) if (JSON.parse(await readFile(resolve(ROOT, "node_modules", name, "package.json"), "utf8")).version !== version || lock.packages["node_modules/" + name]?.version !== version) fail("SOURCE_REFUSED");
  return { sourceSha, sourceHashes, dependencyHashes };
}
async function freePort(port) { await new Promise((resolvePromise, reject) => { const socket = createServer(); socket.once("error", () => reject(new Error("PORT_REFUSED"))); socket.listen({ host: "127.0.0.1", port, exclusive: true }, () => socket.close(error => error ? reject(error) : resolvePromise())); }); }

export function validateAvatarCiReport(input) {
  const keys = ["schemaVersion", "scenario", "status", "code", "phase", "sourceSha", "sourceHashes", "dependencyHashes", "migrationsApplied", "catalogueChecks", "checks", "caseReport", "limitations", "writeOutcomeUncertain"];
  if (!closedRecord(input, keys) || input.schemaVersion !== 1 || input.scenario !== "avatar-storage-local-ci" || !["passed", "failed"].includes(input.status) || !["PASSED", "ENVIRONMENT_REFUSED", "SOURCE_REFUSED", "PORT_REFUSED", "INSTANCE_REFUSED", "OWNERSHIP_REFUSED", "SQL_NOT_PROVEN", "CASE_FAILED", "TEARDOWN_UNCONFIRMED", "CLI_VERSION_REFUSED", "CLI_HELP_REFUSED"].includes(input.code) || !["environment", "sources", "stack", "database", "case", "teardown", "complete"].includes(input.phase) || input.sourceSha !== null && (typeof input.sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(input.sourceSha)) || !closedRows(input.sourceHashes) || !closedRows(input.dependencyHashes) || !closedRecord(input.checks, AVATAR_CI_CHECKS) || AVATAR_CI_CHECKS.some(key => typeof input.checks[key] !== "boolean") || !closedRecord(input.limitations, AVATAR_LIMITATIONS) || AVATAR_LIMITATIONS.some(key => input.limitations[key] !== false) || typeof input.writeOutcomeUncertain !== "boolean" || !Number.isSafeInteger(input.migrationsApplied) || input.migrationsApplied < 0 || input.migrationsApplied > AVATAR_MIGRATIONS || !Number.isSafeInteger(input.catalogueChecks) || input.catalogueChecks < 0 || input.catalogueChecks > AVATAR_EXPECTED_CATALOGUE || (input.status === "passed") !== (input.code === "PASSED") || (input.status === "passed") !== (input.phase === "complete")) fail("CI_REPORT_REFUSED");
  for (const [rows, dependency] of [[input.sourceHashes, false], [input.dependencyHashes, true]]) {
    if (rows.some(row => !closedRecord(row, ["bytes", "path", "sha256"]))) fail("CI_REPORT_REFUSED");
    if (new Set(rows.map(row => row.path)).size !== rows.length || rows.some(row => typeof row.path !== "string" || !/^(?:node_modules|src|tests|scripts|supabase|\.github)\/[A-Za-z0-9_./@-]+$/.test(row.path) && !["package.json", "package-lock.json", ".nvmrc"].includes(row.path) || row.path.includes("..") || typeof row.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes === 0 && row.path !== "node_modules/server-only/empty.js" || dependency && !ADMIN_LOCAL_DEPENDENCY_PATHS.includes(row.path))) fail("CI_REPORT_REFUSED");
    if (rows.some(row => row.path === "node_modules/server-only/empty.js" && (row.bytes !== 0 || row.sha256 !== EMPTY_SHA))) fail("CI_REPORT_REFUSED");
  }
  if (input.caseReport !== null) validateAvatarStorageReport(input.caseReport);
  if (input.caseReport?.writeOutcomeUncertain && !input.writeOutcomeUncertain || input.caseReport && (input.caseReport.pendingRequests || input.caseReport.pendingInspections) && input.checks.quiescent) fail("CI_REPORT_REFUSED");
  if (input.checks.sources) {
    if (typeof input.sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(input.sourceSha) || input.sourceHashes.length !== AVATAR_SOURCE_PATHS.length || AVATAR_SOURCE_PATHS.some(path => !input.sourceHashes.some(row => row.path === path)) || input.dependencyHashes.length !== ADMIN_LOCAL_DEPENDENCY_PATHS.length) fail("CI_REPORT_REFUSED");
  } else if (input.sourceSha !== null || input.sourceHashes.length || input.dependencyHashes.length || input.caseReport !== null) fail("CI_REPORT_REFUSED");
  if (input.status === "passed" && (input.writeOutcomeUncertain || !/^[a-f0-9]{40}$/.test(input.sourceSha) || input.migrationsApplied !== AVATAR_MIGRATIONS || input.catalogueChecks !== AVATAR_EXPECTED_CATALOGUE || AVATAR_NEW_PATHS.some(path => !input.sourceHashes.some(row => row.path === path)) || input.dependencyHashes.length !== ADMIN_LOCAL_DEPENDENCY_PATHS.length || AVATAR_CI_CHECKS.some(key => !input.checks[key]) || input.caseReport?.status !== "passed")) fail("CI_REPORT_REFUSED");
  return input;
}

export async function runAvatarStorageCi(environment = process.env) {
  const report = { schemaVersion: 1, scenario: "avatar-storage-local-ci", status: "failed", code: "ENVIRONMENT_REFUSED", phase: "environment", sourceSha: null, sourceHashes: [], dependencyHashes: [], migrationsApplied: 0, catalogueChecks: 0, checks: Object.fromEntries(AVATAR_CI_CHECKS.map(key => [key, false])), caseReport: null, limitations: Object.fromEntries(AVATAR_LIMITATIONS.map(key => [key, false])), writeOutcomeUncertain: false };
  const stackDiagnostic = createAvatarStackDiagnosticRecorder(report);
  const processes = new Set(), owned = createAdminOwnedTransport();
  let runRoot, home, project, projectId, local, systemIdentifier, subject, actors, runnerTemp, child, started = false, groupsKnown = true, uncertain = false, firstFailure;
  const retain = code => { firstFailure ??= ["ENVIRONMENT_REFUSED", "SOURCE_REFUSED", "PORT_REFUSED", "INSTANCE_REFUSED", "OWNERSHIP_REFUSED", "SQL_NOT_PROVEN", "CASE_FAILED", "TEARDOWN_UNCONFIRMED", "CLI_VERSION_REFUSED", "CLI_HELP_REFUSED"].includes(code) ? code : "CASE_FAILED"; };
  const run = (program, args, timeoutMs, options = {}, diagnosticBoundary = null) => {
    const task = runBoundedProcess(program, args, { cwd: ROOT, env: child, timeoutMs, maxBytes: 1048576, ...options }).then(value => { if (value.groupConfirmed !== true) { groupsKnown = false; fail("CASE_FAILED"); } return value; }).catch(error => { stackDiagnostic.observe(diagnosticBoundary, error); groupsKnown = false; throw error; }).finally(() => processes.delete(task)); processes.add(task); return task;
  };
  const cli = args => [...args, "--workdir", project];
  const inventory = async () => { for (const command of [["ps", "--all", "--quiet"], ["volume", "ls", "--quiet"], ["network", "ls", "--quiet"]]) if ((await run("docker", [...command, "--filter", "label=com.supabase.cli.project=" + projectId], 15000)).stdout.trim()) return false; return true; };
  try {
    ({ runnerTemp } = requireAvatarCi(environment)); if (await realpath(runnerTemp) !== runnerTemp || !(await lstat(runnerTemp)).isDirectory()) fail("ENVIRONMENT_REFUSED"); await assertNoEnvironmentFiles(ROOT); report.checks.environment = true;
    child = { PATH: environment.PATH, LANG: environment.LANG ?? "C.UTF-8", LC_ALL: environment.LC_ALL ?? "C.UTF-8", TZ: "UTC", NO_COLOR: "1" };
    report.phase = "sources"; const migrations = await loadHistorical026Migrations(ROOT);
    if ((await run("git", ["rev-parse", "HEAD"], 15000)).stdout.trim() !== environment.GITHUB_SHA) fail("SOURCE_REFUSED"); Object.assign(report, await collectAvatarSources(run, environment.GITHUB_SHA, migrations)); report.checks.sources = true;
    for (const port of [54320, 54321, 54322]) await freePort(port);
    runRoot = await mkdtemp(join(runnerTemp, "sc-avatar-ci-")); await chmod(runRoot, 0o700); project = join(runRoot, "project"); home = join(runRoot, "home"); projectId = "sc-auth-ci-" + randomUUID().replaceAll("-", "").slice(0, 24);
    await mkdir(join(project, "supabase"), { recursive: true, mode: 0o700 }); await mkdir(home, { mode: 0o700 });
    await writeFile(join(project, "supabase/config.toml"), renderLocalConfig((await canonical("tests/fixtures/supabase-auth-local/config.toml")).toString("utf8"), projectId), { flag: "wx", mode: 0o600 });
    child = { ...child, HOME: home, XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: join(home, ".cache"), CI: "true", GITHUB_ACTIONS: "true", RUNNER_TEMP: runnerTemp, SC_AUTH_LOCAL_CI_RUN: "1", SC_AVATAR_STORAGE_LOCAL_CI_RUN: "1" };
    if ((await run("supabase", ["--version"], 15000)).stdout.trim() !== CLI_VERSION) fail("CLI_VERSION_REFUSED");
    for (const [command, flags] of [["start", []], ["status", ["--output"]], ["stop", ["--project-id", "--no-backup"]]]) { const help = (await run("supabase", [command, "--help"], 15000)).stdout; if (flags.some(flag => !help.includes(flag))) fail("CLI_HELP_REFUSED"); }
    if (!await inventory()) fail("OWNERSHIP_REFUSED"); report.phase = "stack"; started = true; await run("supabase", cli(["start"]), 600000, { capture: false }, "STACK_START");
    local = decodeLocalStatus((await run("supabase", cli(["status", "-o", "json"]), 30000, {}, "STACK_STATUS")).stdout);
    for (const kind of ["db", "kong", "auth", "rest", "storage"]) { const value = decodeAvatarSql((await run("docker", ["inspect", "--type", "container", "--format", '{"id":{{json .Id}},"name":{{json .Name}},"label":{{json (index .Config.Labels "com.supabase.cli.project")}},"running":{{json .State.Running}},"imageId":{{json .Image}},"ports":{{json .NetworkSettings.Ports}}}', "supabase_" + kind + "_" + projectId], 15000, {}, "STACK_" + kind.toUpperCase() + "_INSPECT")).stdout); acceptAdminContainer(value, projectId, kind); }
    report.checks.ownedNamespace = true;
    const pg = localPsqlEnvironment(environment, home, local);
    const query = async sql => decodeAvatarSql((await run("psql", ["--no-psqlrc", "--no-password", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--file=-"], 12000, { env: pg, input: sql })).stdout);
    const write = async sql => { try { await run("psql", ["--no-psqlrc", "--no-password", "--quiet", "--set", "ON_ERROR_STOP=1", "--file=-"], 60000, { env: pg, input: sql, capture: false }); } catch { uncertain = true; throw new Error("CASE_FAILED"); } };
    report.phase = "database"; assertDatabasePreflight(await query(DATABASE_PREFLIGHT), false); systemIdentifier = verifyAvatarInstance(await query(AVATAR_INSTANCE_SQL)); report.checks.pg17 = true;
    await write(LOCAL_INFRASTRUCTURE_FIXTURE); assertDatabasePreflight(await query(DATABASE_PREFLIGHT));
    for (const migration of migrations) { await write(migration.source); report.migrationsApplied++; }
    const catalogueSource = await canonical(HISTORICAL026_CATALOGUE); if (hash(catalogueSource) !== "4557741f008d48ea60ad8a3e2d5a41667630543c3bf2ab0682ec2b33ad97e297") fail("SOURCE_REFUSED"); const catalogue = await query(catalogueSource.toString("utf8")); if (catalogue.ok !== true || catalogue.version !== 1 || catalogue.checks !== AVATAR_EXPECTED_CATALOGUE || !Array.isArray(catalogue.deviations) || catalogue.deviations.length) fail("SQL_NOT_PROVEN"); report.catalogueChecks = catalogue.checks; report.checks.catalogue = true;
    const pristine = await query(AVATAR_BASELINE_SQL); if (pristine.users !== 0 || pristine.objects !== 0 || pristine.privateBuckets !== true) fail("OWNERSHIP_REFUSED"); await write("notify pgrst, 'reload schema';");
    const context = { ci: true, githubActions: true, localAuthRun: true, localAvatarRun: true, supabaseUrl: "http://127.0.0.1:54321", sourceSha: report.sourceSha, namespace: "sc-avatar-native-" + randomUUID().replaceAll("-", ""), systemIdentifier, publishableKey: local.publishable, serverSecretKey: local.secret };
    const inspect = async (name, request) => { if (!AVATAR_SQL_QUERIES.includes(name) || !actors || JSON.stringify(request.actors) !== JSON.stringify(actors)) fail("SQL_NOT_PROVEN"); return acceptAvatarInspection(await query(avatarInspectionInput(context, actors, request.uploadId)), context, actors, request.uploadId); };
    report.phase = "case"; subject = await createAvatarStorageCase(context, { transport: owned.transport, registerActors(value) { if (actors) fail("OWNERSHIP_REFUSED"); actors = validateAvatarActors(value); }, inspect, cleanupAllowed: () => groupsKnown && !uncertain && processes.size === 0 && owned.metadata().pending === 0 });
    report.caseReport = await subject.run(); uncertain ||= report.caseReport.writeOutcomeUncertain; if (report.caseReport.status !== "passed" || uncertain) fail("CASE_FAILED"); report.checks.casePassed = true;
    const final = await query(AVATAR_BASELINE_SQL); if (final.users || final.objects || !final.privateBuckets) fail("SQL_NOT_PROVEN"); report.checks.finalSql = true;
  } catch (error) { if (report.phase === "case" && !report.caseReport) uncertain = true; retain(error?.message); }
  finally {
    const quiet = await (subject?.settle() ?? true); uncertain ||= subject?.metadata().unknown === true; report.writeOutcomeUncertain = uncertain;
    // Refresh only actual owned pending IO after settlement; uncertainty/deadline
    // stay latched. A historical pending snapshot must not certify quiescence.
    if (report.caseReport && subject) { const state = subject.metadata(); report.caseReport = validateAvatarStorageReport({ ...report.caseReport, pendingRequests: state.pending, pendingInspections: state.pendingInspections, writeOutcomeUncertain: report.caseReport.writeOutcomeUncertain || state.unknown, deadlineRefused: report.caseReport.deadlineRefused || state.deadlineRefused }); }
    const mayStop = quiet && groupsKnown && processes.size === 0 && owned.metadata().pending === 0 && (!subject || subject.metadata().pendingInspections === 0);
    report.checks.quiescent = mayStop;
    if (started && mayStop) { try { report.phase = "teardown"; await run("supabase", cli(["stop", "--project-id", projectId, "--no-backup"]), 120000, { capture: false }); report.checks.namespaceRemoved = await inventory(); if (!report.checks.namespaceRemoved) fail("TEARDOWN_UNCONFIRMED"); } catch { retain("TEARDOWN_UNCONFIRMED"); } }
    if (runRoot && mayStop && (!started || report.checks.namespaceRemoved)) { try { assertTempDescendant(runnerTemp, runRoot); if ((await lstat(runRoot)).isSymbolicLink() || await realpath(runRoot) !== runRoot) fail("ENVIRONMENT_REFUSED"); await rm(runRoot, { recursive: true, force: false }); report.checks.directoriesRemoved = true; } catch { retain("TEARDOWN_UNCONFIRMED"); } }
    if (started && !report.checks.namespaceRemoved || runRoot && !report.checks.directoriesRemoved) retain("TEARDOWN_UNCONFIRMED");
    if (subject && mayStop) subject.dispose(); local = undefined; systemIdentifier = undefined;
  }
  report.status = firstFailure ? "failed" : "passed"; report.code = firstFailure ?? "PASSED"; if (!firstFailure) report.phase = "complete";
  return validateAvatarCiReport(report);
}
export async function main(argv = process.argv.slice(2), environment = process.env, output = value => process.stdout.write(JSON.stringify(value) + "\n")) {
  if (argv.length === 0 || argv.length === 1 && argv[0] === "--help") { output({ schemaVersion: 1, scenario: "avatar-storage-local-ci", code: "NO_SERVICE_STARTED", hostedAccess: false }); return 0; }
  if (argv.length !== 1 || argv[0] !== "--execute") { output({ schemaVersion: 1, scenario: "avatar-storage-local-ci", code: "ARGUMENTS_REFUSED", hostedAccess: false }); return 2; }
  try { const report = await runAvatarStorageCi(environment); emitAvatarStackDiagnostic(report, output); output(report); return report.status === "passed" ? 0 : 1; } catch { output({ schemaVersion: 1, scenario: "avatar-storage-local-ci", code: "REPORT_REFUSED", hostedAccess: false }); return 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
