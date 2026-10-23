/** Public CLI-generated SOURCE candidate only. No release/hosted certificate.
 * Import/help are inert. Only an opt-in disposable Linux GitHub runner may run.
 * No fixture users, seed, browser, linked project, env file or remote database. */
import { constants as FLAGS } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "node:net";
import ts from "typescript";
import { CLI_VERSION, requireCiRunner, assertTempDescendant, assertNoEnvironmentFiles, decodeLocalStatus, localPsqlEnvironment, runBoundedProcess, DATABASE_PREFLIGHT, assertDatabasePreflight, LOCAL_INFRASTRUCTURE_FIXTURE } from "./auth-local-ci.mjs";
import { renderFoundationConfig, FOUNDATION_INSTANCE_SQL, acceptFoundationInstance, FOUNDATION_EMPTY_LEDGER_SQL, acceptFoundationEmptyLedger, foundationMarkerSql, foundationLedgerSql, assertFoundationLedgerNoOp, decodeFoundationJson, closedFoundationValue, foundationTypesInspection, validateFoundationTypesDiagnostic } from "./foundation-local-ci.mjs";
import { DATABASE_TYPES_MAX_BYTES } from "../operations/check-database-types.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const PUBLIC_TYPES_BRANCH = "refs/heads/codex/redesign-parallel-20261022";
export const PUBLIC_TYPES_OUTPUT = "sc-public-types-candidate";
const SHA = /^[a-f0-9]{40}$/, HASH = /^[a-f0-9]{64}$/, PATH = /^[A-Za-z0-9_@()./-]+$/;
const CODES = Object.freeze(["ENVIRONMENT_REFUSED", "SOURCE_REFUSED", "CLI_REFUSED", "PROCESS_UNCONFIRMED", "NATIVE_REFUSED", "LEDGER_REFUSED", "TYPES_REFUSED", "TEARDOWN_UNCONFIRMED", "EXPORT_REFUSED"]);
const hash = value => createHash("sha256").update(value).digest("hex");
function fail(code) { const e = new Error(CODES.includes(code) ? code : "ENVIRONMENT_REFUSED"); e.name = "PublicTypesCandidateFailure"; e.stack = e.name + ": " + e.message; throw e; }

// Exact reviewed canonical files, not SQL-Editor copies or an application ledger.
// Root must reconcile a changed pin explicitly before another candidate run.
export const PUBLIC_TYPES_MIGRATIONS = Object.freeze([
  {"path":"supabase/migrations/20261007151834_identity_foundation.sql","bytes":30586,"sha256":"7a5bc2b2b7f1fc953159ab31820ec734a5e0d9554ce92ca952465ddfc0fdddfc"},
  {"path":"supabase/migrations/20261007151850_auth_password_completion.sql","bytes":3206,"sha256":"18bdc83e45aa2169ba8404feebeb77c236d9cadc6792470de3b8f5745b091d30"},
  {"path":"supabase/migrations/20261007151904_restrict_rls_event_trigger_execution.sql","bytes":1942,"sha256":"64a2838cd0ee18a422e28d889e8d9bc5c045204e913aec050628620083baca07"},
  {"path":"supabase/migrations/20261007210519_capture_task_transactions.sql","bytes":47922,"sha256":"0645892ba82c4e13a391020aea4abfaeaa05a81283056adbc9954747b066b859"},
  {"path":"supabase/migrations/20261007223710_activity_page.sql","bytes":6089,"sha256":"565d2912e36142b1694e8728ce665d8bf92321466193bdab6621dd2256940a2c"},
  {"path":"supabase/migrations/20261009144343_financial_transactions.sql","bytes":40343,"sha256":"af3f102412f78e83f5f612666761c8b65b07239ee72bbf3ea81c56f9dd1c3557"},
  {"path":"supabase/migrations/20261009144350_knowledge_pages_links.sql","bytes":44911,"sha256":"a9da2bb78314f2eb2b0f773fa5b200496b8a963e5103a25ebe13198e0fa37b2c"},
  {"path":"supabase/migrations/20261009150122_identity_admin_settings.sql","bytes":26458,"sha256":"461708ac47abb50465bd71bd5a70f76fadba7dee599d6f114a82f8c22aee7862"},
  {"path":"supabase/migrations/20261009151557_account_preferences.sql","bytes":8757,"sha256":"d183f660303227d21ceb11dd84a676d3ebeefb233d3a76802b2d0b380c58806c"},
  {"path":"supabase/migrations/20261009152200_projects_habits.sql","bytes":40073,"sha256":"c57c54245926c66b5cbe87baaceee101d8d0d9cc0b0537c22040d6d423d3abe6"},
  {"path":"supabase/migrations/20261009152822_private_storage_drive.sql","bytes":41845,"sha256":"a1a66fcd601d46e905f6db5a890a4799d9b3409b3331bb832e6e74301184f8b9"},
  {"path":"supabase/migrations/20261009154609_global_search_activity.sql","bytes":13627,"sha256":"b91f2acbf62794811bd906e2592fb86b48205d5366e1446e6de7c9bfbd3a58e7"},
  {"path":"supabase/migrations/20261009160151_encrypted_vault.sql","bytes":22103,"sha256":"3f1af61dbe5954e2e5354441e47e411463eb6314f0ae7471edfbc8cae7aa35ff"},
  {"path":"supabase/migrations/20261009160158_google_calendar.sql","bytes":50471,"sha256":"621bc732a818da2627e245a1614264b5e3a70b8f330510d1fae06bef524ed0e3"},
  {"path":"supabase/migrations/20261009231338_file_cleanup_fairness.sql","bytes":3522,"sha256":"f71c6bb9debb24f032bb64824420693c9be6b4ab566f54d51dac6cdb658f897a"},
  {"path":"supabase/migrations/20261010010955_close_public_sequence_defaults.sql","bytes":1842,"sha256":"add5b17ee8af3162ed893d1ac955c4fe5229707b7807d43a58b8c9124dc8e381"},
  {"path":"supabase/migrations/20261010044217_finance_monthly_plan.sql","bytes":1533,"sha256":"a45052833425a647a193e8d3588257fa6cb392aa12ef39b34f89b57e06d882bf"},
  {"path":"supabase/migrations/20261011071500_admin_auth_creation_order.sql","bytes":4717,"sha256":"91d91aa94883f803139f30c250fc92322de31cc6c29df293462eac8e459c4a99"},
  {"path":"supabase/migrations/20261011113751_own_sessions.sql","bytes":4115,"sha256":"0cab745bbb315ca700921db9addc13e113fb450eb08095fc37ec1e8ada1aae57"},
  {"path":"supabase/migrations/20261021045700_spec08_private_entity_images.sql","bytes":17601,"sha256":"385dff57a2d81fe8b7ba92f6bc95d16d25ee09f7c85106fa5f40711a03dedde2"},
  {"path":"supabase/migrations/20261021144650_spec08_habit_frequency_history.sql","bytes":23511,"sha256":"90156cf1069e2934b38160099156086ac4d60d0e349932d96565b35d3312083e"},
  {"path":"supabase/migrations/20261021171416_spec08_capture_document_write.sql","bytes":32167,"sha256":"431e7521306951d403aba861541805b350cf30523d0e52b7634825852f961b38"},
  {"path":"supabase/migrations/20261022042432_spec08_calendar_participants.sql","bytes":46113,"sha256":"b7a0a3f893e1cf5ac5f95c3fe36d46a234fa372c24104df9af9535f350326b8c"},
  {"path":"supabase/migrations/20261022042500_spec08_finance_card_metadata.sql","bytes":8565,"sha256":"8406c90596d1b5679827f3aa61b3fd229f7c17bee5d4f9ae46753bfd3fddd51c"},
  {"path":"supabase/migrations/20261022042501_spec08_capture_knowledge_promotion.sql","bytes":44266,"sha256":"40b1366a110de7ac614387af3930a2332f2603f7d50af7a7a0037d7da9115b07"},
  {"path":"supabase/migrations/20261023061901_onboarding_foundation.sql","bytes":77585,"sha256":"e62727f4aa3a2f56948bf3a3c2f4ec24b1a8278ac3bef07591424b1ba422e697"},
].map(row => Object.freeze(row)));

const INPUT_KEYS = ["PATH", "HOME", "LANG", "LC_ALL", "TZ", "CI", "GITHUB_ACTIONS", "RUNNER_TEMP", "GITHUB_SHA", "GITHUB_REF", "GITHUB_EVENT_NAME", "GITHUB_OUTPUT", "SC_AUTH_LOCAL_CI_RUN", "SC_PUBLIC_TYPES_CANDIDATE"];
export function validatePublicTypesEnvironment(input, platform = process.platform) {
  try {
    const d = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(d);
    if (keys.some(k => typeof k !== "string" || !INPUT_KEYS.includes(k) || !Object.hasOwn(d[k], "value") || typeof d[k].value !== "string" || d[k].value.includes("\0"))) fail("ENVIRONMENT_REFUSED");
    const env = Object.fromEntries(keys.map(k => [k, d[k].value]));
    if (env.SC_PUBLIC_TYPES_CANDIDATE !== "1" || !SHA.test(env.GITHUB_SHA) || env.GITHUB_REF !== PUBLIC_TYPES_BRANCH || !["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME) || !env.PATH || !env.HOME || !env.GITHUB_OUTPUT) fail("ENVIRONMENT_REFUSED");
    const { runnerTemp } = requireCiRunner(env, platform);
    if (resolve(env.RUNNER_TEMP) !== env.RUNNER_TEMP || resolve(env.GITHUB_OUTPUT) !== env.GITHUB_OUTPUT || resolve(env.HOME) !== env.HOME) fail("ENVIRONMENT_REFUSED");
    const commands = join(runnerTemp, "_runner_file_commands");
    if (dirname(env.GITHUB_OUTPUT) !== commands || !/^set_output_[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(basename(env.GITHUB_OUTPUT))) fail("ENVIRONMENT_REFUSED");
    return Object.freeze({ environment: Object.freeze(env), runnerTemp });
  } catch { fail("ENVIRONMENT_REFUSED"); }
}

/** Preserve CLI/git stdout bytes, including UTF8 split across chunks. An ACK or
 * process close is not stdout EOF. The shared process owner still proves exit. */
export function createPublicTypesByteCapture(limit = DATABASE_TYPES_MAX_BYTES) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > DATABASE_TYPES_MAX_BYTES) fail("PROCESS_UNCONFIRMED");
  let stream, ended = false, refused = false, bytes = 0; const chunks = [];
  const observer = {
    start(child) { if (stream || !child?.stdout || typeof child.stdout.on !== "function") { refused = true; return false; } stream = child.stdout; return true; },
    data(chunk, original) { if (!stream || refused || ended || original !== stream || !Buffer.isBuffer(chunk) || bytes + chunk.length > limit) { refused = true; return false; } bytes += chunk.length; chunks.push(Buffer.from(chunk)); return true; },
    end(original) { if (refused || ended || original !== stream || stream?.readableEnded !== true) { refused = true; return false; } ended = true; return true; },
  };
  return Object.freeze({ observer, take() { if (refused || !ended) fail("PROCESS_UNCONFIRMED"); return Buffer.concat(chunks, bytes); } });
}

async function canonical(root, path) {
  if (!PATH.test(path) || path.includes("..") || path.startsWith("/") || path.startsWith("node_modules/")) fail("SOURCE_REFUSED");
  const file = assertTempDescendant(root, resolve(root, path)), stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size < 1 || stat.size > DATABASE_TYPES_MAX_BYTES || await realpath(file) !== file) fail("SOURCE_REFUSED");
  const bytes = await readFile(file); if (bytes.length !== stat.size) fail("SOURCE_REFUSED"); return bytes;
}
export function verifyPublicTypesMigrationRows(rows) {
  try {
    if (!Array.isArray(rows) || Object.getPrototypeOf(rows) !== Array.prototype || PUBLIC_TYPES_MIGRATIONS.length !== 26) fail("SOURCE_REFUSED");
    const d = Object.getOwnPropertyDescriptors(rows);
    if (!Object.hasOwn(d.length ?? {}, "value") || d.length.value !== 26 || Reflect.ownKeys(d).length !== 27 || Array.from({ length: 26 }, (_, i) => String(i)).some(k => !d[k] || !Object.hasOwn(d[k], "value"))) fail("SOURCE_REFUSED");
    const verified = [];
    for (let i = 0; i < 26; i++) {
      const r = d[i].value, p = PUBLIC_TYPES_MIGRATIONS[i], fields = Object.getOwnPropertyDescriptors(r ?? {});
      if (![null, Object.prototype].includes(Object.getPrototypeOf(r)) || Reflect.ownKeys(fields).length !== 2 || ["path", "source"].some(k => !fields[k]?.enumerable || !Object.hasOwn(fields[k], "value")) || fields.path.value !== p.path || !Buffer.isBuffer(fields.source.value) || fields.source.value.length !== p.bytes || hash(fields.source.value) !== p.sha256) fail("SOURCE_REFUSED");
      verified.push(Object.freeze({ path: p.path, source: Buffer.from(fields.source.value) }));
    }
    return Object.freeze(verified);
  } catch { fail("SOURCE_REFUSED"); }
}
export async function readPublicTypesMigrations(root = ROOT) {
  const names = (await readdir(join(root, "supabase/migrations"))).filter(name => name.endsWith(".sql")).sort();
  if (names.length !== 26 || names.some((n, i) => n !== basename(PUBLIC_TYPES_MIGRATIONS[i].path))) fail("SOURCE_REFUSED");
  return verifyPublicTypesMigrationRows(await Promise.all(PUBLIC_TYPES_MIGRATIONS.map(async p => ({ path: p.path, source: await canonical(root, p.path) }))));
}
export async function copyPublicTypesMigrations(rows, directory, ownedRoot, io = { writeFile, lstat, realpath }) {
  rows = verifyPublicTypesMigrationRows(rows); // Snapshot all26 pins before any write.
  assertTempDescendant(ownedRoot, directory); const s = await io.lstat(directory);
  if (!s.isDirectory() || s.isSymbolicLink() || await io.realpath(directory) !== directory) fail("SOURCE_REFUSED");
  for (const row of rows) await io.writeFile(join(directory, basename(row.path)), row.source, { flag: "wx", mode: 0o600 });
}

export const PUBLIC_TYPES_SOURCE_SEEDS = Object.freeze(["scripts/verification/prepare-public-types-candidate.mjs", "tests/scripts/prepare-public-types-candidate.test.mjs", ".github/workflows/public-types-candidate.yml", "tests/fixtures/supabase-auth-local/config.toml", "src/lib/supabase/database.generated.ts", ".nvmrc", "package.json", "package-lock.json"]);
export async function collectPublicTypesSources(root, sourceSha, run, runBytes) {
  if (!SHA.test(sourceSha) || (await run("git", ["rev-parse", "HEAD"], 15000)).stdout.trim() !== sourceSha) fail("SOURCE_REFUSED");
  const paths = new Set();
  async function visit(path) {
    path = path.replaceAll("\\", "/"); if (paths.has(path)) return;
    if (paths.size >= 512) fail("SOURCE_REFUSED");
    const bytes = await canonical(root, path); paths.add(path);
    if (!/\.(?:mjs|ts|tsx)$/.test(path) || path.endsWith(".d.mts")) return;
    const parsed = ts.createSourceFile(path, bytes.toString("utf8"), ts.ScriptTarget.Latest, true, path.endsWith("tsx") ? ts.ScriptKind.TSX : path.endsWith("mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TS), refs = [];
    if (parsed.parseDiagnostics.length) fail("SOURCE_REFUSED");
    const walk = n => { if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) refs.push(n.moduleSpecifier.text); if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0])) refs.push(n.arguments[0].text); ts.forEachChild(n, walk); }; walk(parsed);
    for (const ref of refs) {
      if (ref.startsWith("node:") || ref === "typescript") continue;
      if (!ref.startsWith(".")) fail("SOURCE_REFUSED");
      const base = relative(root, resolve(root, dirname(path), ref)).replaceAll("\\", "/"), variants = [base, ...[".mjs", ".ts", ".tsx", ".json", "/index.ts", "/index.tsx"].map(x => base + x)];
      if (base.endsWith(".js")) variants.push(base.slice(0, -3) + ".ts");
      let next;
      for (const option of variants) { try { if ((await lstat(assertTempDescendant(root, resolve(root, option)))).isFile()) { next = option; break; } } catch (e) { if (!["ENOENT", "ENOTDIR"].includes(e.code)) fail("SOURCE_REFUSED"); } }
      if (!next) fail("SOURCE_REFUSED"); await visit(next);
    }
  }
  for (const seed of [...PUBLIC_TYPES_SOURCE_SEEDS, ...PUBLIC_TYPES_MIGRATIONS.map(p => p.path)]) await visit(seed);
  const sourceHashes = [];
  for (const path of [...paths].sort()) { const bytes = await canonical(root, path), original = await runBytes("git", ["show", "HEAD:" + path], 15000); if (!bytes.equals(original)) fail("SOURCE_REFUSED"); sourceHashes.push({ path, sha256: hash(bytes), bytes: bytes.length }); }
  const lock = JSON.parse((await canonical(root, "package-lock.json")).toString("utf8")), dir = join(root, "node_modules/typescript"), dependencyHashes = [];
  const installed = JSON.parse(await readFile(join(dir, "package.json"), "utf8")), pin = lock.packages?.["node_modules/typescript"];
  if (installed.name !== "typescript" || installed.version !== pin?.version || !pin.resolved?.startsWith("https://registry.npmjs.org/") || !pin.integrity?.startsWith("sha512-")) fail("SOURCE_REFUSED");
  for (const path of ["node_modules/typescript/package.json", "node_modules/typescript/lib/typescript.js"]) { const full = join(root, path), st = await lstat(full); if (!st.isFile() || st.isSymbolicLink() || await realpath(full) !== full || st.size > 16777216) fail("SOURCE_REFUSED"); const b = await readFile(full); dependencyHashes.push({ path, bytes: b.length, sha256: hash(b) }); }
  return { sourceSha, sourceHashes, dependencyHashes };
}

const FORMAT = '{"id":{{json .Id}},"name":{{json .Name}},"label":{{json (index .Config.Labels "com.supabase.cli.project")}},"running":{{json .State.Running}},"image":{{json .Image}},"ports":{{json .NetworkSettings.Ports}}}';
const KINDS = ["db", "kong", "auth", "rest", "storage"];
export function validatePublicTypesContainers(input, projectId) {
  try {
    const rows = closedFoundationValue(input); if (!/^sc-auth-ci-[a-f0-9]{24}$/.test(projectId) || !Array.isArray(rows) || rows.length !== 5) fail("NATIVE_REFUSED");
    const ids = new Set();
    return rows.map((r, i) => { const kind = KINDS[i]; if (!r || Object.keys(r).length !== 6 || !["id", "name", "label", "running", "image", "ports"].every(k => Object.hasOwn(r, k)) || r.name !== "/supabase_" + kind + "_" + projectId || r.label !== projectId || r.running !== true || !HASH.test(r.id) || ids.has(r.id) || !/^sha256:[a-f0-9]{64}$/.test(r.image)) fail("NATIVE_REFUSED"); ids.add(r.id);
      if (["db", "kong"].includes(kind)) { const port = kind === "db" ? "5432/tcp" : "8000/tcp", expected = kind === "db" ? "54322" : "54321", bindings = r.ports?.[port]; if (!Array.isArray(bindings) || !bindings.length || bindings.some(p => Object.keys(p).length !== 2 || !["0.0.0.0", "127.0.0.1", "::"].includes(p.HostIp) || p.HostPort !== expected)) fail("NATIVE_REFUSED"); }
      return { kind, image: r.image };
    });
  } catch { fail("NATIVE_REFUSED"); }
}
export function validatePublicTypesLedger(input, context) {
  try {
    const v = closedFoundationValue(input);
    if (!v || Object.keys(v).length !== 4 || v.bound !== true || v.noAuthFixtures !== true || v.systemIdentifier !== context.systemIdentifier || !Array.isArray(v.ledger) || v.ledger.length !== 26) fail("LEDGER_REFUSED");
    for (let i = 0; i < 26; i++) { const row = v.ledger[i], name = basename(PUBLIC_TYPES_MIGRATIONS[i].path); if (!row || Object.keys(row).length !== 4 || row.version !== name.slice(0, 14) || row.name !== name.slice(15, -4) || !Number.isSafeInteger(row.statementCount) || row.statementCount < 1 || !HASH.test(row.statementHash)) fail("LEDGER_REFUSED"); }
    return v;
  } catch { fail("LEDGER_REFUSED"); }
}
export function inspectPublicTypesCandidate(baseline, bytes) {
  try {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > DATABASE_TYPES_MAX_BYTES) fail("TYPES_REFUSED");
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes), inspection = foundationTypesInspection(baseline, source), c = inspection.comparison;
    if (!["SNAPSHOT_MATCH", "SNAPSHOT_DIFFER"].includes(c.code) || c.offline !== true || c.provenance_verified !== false || c.freshness_verified !== false || inspection.generatedBytes !== bytes.length || inspection.generatedSha256 !== hash(bytes)) fail("TYPES_REFUSED");
    return { bytes: bytes.length, sha256: hash(bytes), ast: inspection.diagnostic };
  } catch { fail("TYPES_REFUSED"); }
}

/** Stop/remove only the registered own namespace, and only after its original
 * process groups are quiet. A missing terminal is never repaired by removal. */
export async function teardownPublicTypesCandidate(state, actions) {
  const result = { ioQuiet: state.groupKnown === true && state.pending === 0, namespaceRemoved: !state.startAttempted, directoriesRemoved: !state.rootCreated };
  if (!result.ioQuiet) return result;
  try { if (state.startAttempted) { await actions.stop(); result.namespaceRemoved = await actions.inventory() === true; } if (state.rootCreated && result.namespaceRemoved) { await actions.remove(); result.directoriesRemoved = true; } } catch { /* Keep false; no export is eligible. */ }
  return result;
}

export function validatePublicTypesMetadata(input, bytes) {
  try {
    const r = closedFoundationValue(input), keys = ["formatVersion", "purpose", "acceptance", "hostedCertified", "catalogueCertified", "localOnly", "sourceSha", "sourceHashes", "dependencyHashes", "cliVersion", "postgresVersion", "migrations", "ledger", "containers", "noOpSecondApply", "types", "infrastructure"];
    if (!r || Object.keys(r).length !== keys.length || keys.some(k => !Object.hasOwn(r, k)) || r.formatVersion !== 1 || r.purpose !== "PUBLIC_TYPES_PREPARATION_NOT_RELEASE" || r.acceptance !== false || r.hostedCertified !== false || r.catalogueCertified !== false || r.localOnly !== true || !SHA.test(r.sourceSha) || r.cliVersion !== CLI_VERSION || !Number.isInteger(r.postgresVersion) || r.postgresVersion < 170000 || r.postgresVersion >= 180000 || r.noOpSecondApply !== true) fail("EXPORT_REFUSED");
    const rows = r.sourceHashes; if (!Array.isArray(rows) || rows.length < 26 || rows.length > 512 || new Set(rows.map(v => v.path)).size !== rows.length || rows.some(v => Object.keys(v).length !== 3 || !PATH.test(v.path) || v.path.includes("..") || v.path.startsWith("/") || v.path.startsWith("node_modules/") || !HASH.test(v.sha256) || !Number.isSafeInteger(v.bytes) || v.bytes < 1 || v.bytes > DATABASE_TYPES_MAX_BYTES)) fail("EXPORT_REFUSED");
    if ([...PUBLIC_TYPES_SOURCE_SEEDS, "scripts/verification/auth-local-ci.mjs", "scripts/verification/foundation-local-ci.mjs", "scripts/operations/check-database-types.mjs"].some(path => !rows.some(r => r.path === path))) fail("EXPORT_REFUSED");
    if (!Array.isArray(r.migrations) || r.migrations.length !== 26 || r.migrations.some((p, i) => JSON.stringify(p) !== JSON.stringify(PUBLIC_TYPES_MIGRATIONS[i]) || !rows.some(s => s.path === p.path && s.bytes === p.bytes && s.sha256 === p.sha256))) fail("EXPORT_REFUSED");
    if (!Array.isArray(r.dependencyHashes) || r.dependencyHashes.length !== 2 || r.dependencyHashes.some((p, i) => Object.keys(p).length !== 3 || p.path !== ["node_modules/typescript/package.json", "node_modules/typescript/lib/typescript.js"][i] || !HASH.test(p.sha256) || !Number.isSafeInteger(p.bytes) || p.bytes < 1 || p.bytes > 16777216)) fail("EXPORT_REFUSED");
    if (!r.ledger || !/^[0-9]{16,20}$/.test(r.ledger.systemIdentifier)) fail("EXPORT_REFUSED"); validatePublicTypesLedger(r.ledger, { systemIdentifier: r.ledger.systemIdentifier });
    if (!Array.isArray(r.containers) || r.containers.length !== 5 || r.containers.some((c, i) => Object.keys(c).length !== 2 || c.kind !== KINDS[i] || !/^sha256:[a-f0-9]{64}$/.test(c.image))) fail("EXPORT_REFUSED");
    if (!r.infrastructure || Object.keys(r.infrastructure).length !== 3 || ["ioQuiet", "namespaceRemoved", "directoriesRemoved"].some(k => r.infrastructure[k] !== true)) fail("EXPORT_REFUSED");
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > DATABASE_TYPES_MAX_BYTES || !r.types || Object.keys(r.types).length !== 3 || r.types.bytes !== bytes.length || r.types.sha256 !== hash(bytes) || !["SNAPSHOT_MATCH", "SNAPSHOT_DIFFER"].includes(r.types.ast?.code)) fail("EXPORT_REFUSED");
    validateFoundationTypesDiagnostic(r.types.ast);
    // A candidate diagnostic cannot acquire a release or hosted provenance flag.
    const checked = inspectPublicTypesCandidate(new TextDecoder("utf-8", { fatal: true }).decode(bytes), bytes); if (checked.ast.code !== "SNAPSHOT_MATCH") fail("EXPORT_REFUSED");
    return r;
  } catch { fail("EXPORT_REFUSED"); }
}
export async function writePublicTypesCandidate(runnerTemp, githubOutput, metadata, types) {
  let typeHandle, metaHandle, outputHandle;
  try {
    const r = validatePublicTypesMetadata(metadata, types), commands = join(runnerTemp, "_runner_file_commands"), directory = join(runnerTemp, PUBLIC_TYPES_OUTPUT);
    if (resolve(runnerTemp) !== runnerTemp || resolve(githubOutput) !== githubOutput || dirname(githubOutput) !== commands || !/^set_output_[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(basename(githubOutput))) fail("EXPORT_REFUSED");
    assertTempDescendant(runnerTemp, commands); assertTempDescendant(runnerTemp, directory);
    for (const path of [runnerTemp, commands]) { const s = await lstat(path); if (!s.isDirectory() || s.isSymbolicLink() || await realpath(path) !== path) fail("EXPORT_REFUSED"); }
    const before = await lstat(githubOutput); if (!before.isFile() || before.isSymbolicLink() || before.size !== 0 || before.nlink !== 1 || await realpath(githubOutput) !== githubOutput) fail("EXPORT_REFUSED");
    outputHandle = await open(githubOutput, FLAGS.O_WRONLY | FLAGS.O_APPEND | FLAGS.O_NOFOLLOW); const bound = await outputHandle.stat(); if (bound.dev !== before.dev || bound.ino !== before.ino || bound.size !== 0) fail("EXPORT_REFUSED");
    await mkdir(directory, { mode: 0o700 }); const ds = await lstat(directory); if (!ds.isDirectory() || ds.isSymbolicLink() || await realpath(directory) !== directory || process.platform === "linux" && (ds.mode & 0o777) !== 0o700) fail("EXPORT_REFUSED");
    for (const [name, bytes] of [["types.ts", types], ["metadata.json", Buffer.from(JSON.stringify(r, null, 2) + "\n")]]) {
      const path = join(directory, name), handle = await open(path, FLAGS.O_RDWR | FLAGS.O_CREAT | FLAGS.O_EXCL | FLAGS.O_NOFOLLOW, 0o600); if (name === "types.ts") typeHandle = handle; else metaHandle = handle;
      await handle.writeFile(bytes); await handle.sync(); const st = await handle.stat(); if (!st.isFile() || st.nlink !== 1 || st.size !== bytes.length || process.platform === "linux" && (st.mode & 0o777) !== 0o600) fail("EXPORT_REFUSED");
      const observed = Buffer.alloc(bytes.length); let offset = 0; while (offset < observed.length) { const read = await handle.read(observed, offset, observed.length - offset, offset); if (!read.bytesRead) fail("EXPORT_REFUSED"); offset += read.bytesRead; }
      const final = await lstat(path); if (!observed.equals(bytes) || !final.isFile() || final.isSymbolicLink() || final.dev !== st.dev || final.ino !== st.ino || final.size !== st.size || await realpath(path) !== path) fail("EXPORT_REFUSED"); await handle.close(); if (name === "types.ts") typeHandle = null; else metaHandle = null;
    }
    const finalOutput = await lstat(githubOutput); if (finalOutput.isSymbolicLink() || finalOutput.dev !== bound.dev || finalOutput.ino !== bound.ino || finalOutput.size !== 0) fail("EXPORT_REFUSED");
    await outputHandle.writeFile("public_types_candidate_ready=true\n"); await outputHandle.close(); outputHandle = null; return true;
  } catch { return false; }
  finally { for (const h of [typeHandle, metaHandle, outputHandle]) if (h) try { await h.close(); } catch { /* No ready flag for partial bytes. */ } }
}

async function freePort(port) { await new Promise((yes, no) => { const s = createServer(); s.once("error", () => no(Error("ENVIRONMENT_REFUSED"))); s.listen({ host: "127.0.0.1", port, exclusive: true }, () => s.close(e => e ? no(Error("ENVIRONMENT_REFUSED")) : yes())); }); }
export async function preparePublicTypesCandidate(input = process.env, dependencies = {}) {
  const { environment: env, runnerTemp } = validatePublicTypesEnvironment(input), os = { PATH: env.PATH, HOME: runnerTemp, LANG: env.LANG ?? "C.UTF-8", LC_ALL: env.LC_ALL ?? "C.UTF-8", TZ: "UTC", NO_COLOR: "1", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0" };
  let root, home, project, child = os, startAttempted = false, groupKnown = true, originalCode = null, facts, ledger, containers, postgresVersion, candidate, noOpSecondApply = false;
  const pending = new Set(), processRunner = dependencies.run ?? runBoundedProcess, projectId = "sc-auth-ci-" + randomBytes(12).toString("hex"), namespace = "sc-foundation-" + randomBytes(16).toString("hex");
  const run = async (command, args, timeout, extra = {}) => { const p = processRunner(command, args, { cwd: ROOT, env: child, timeoutMs: timeout, maxBytes: 131072, ...extra }); pending.add(p); try { const r = await p; if (r?.groupConfirmed !== true) { groupKnown = false; fail("PROCESS_UNCONFIRMED"); } return r; } catch (e) { if (e?.groupConfirmed !== true) groupKnown = false; fail("PROCESS_UNCONFIRMED"); } finally { pending.delete(p); } };
  const runBytes = async (command, args, timeout) => { const capture = createPublicTypesByteCapture(); await run(command, args, timeout, { maxBytes: DATABASE_TYPES_MAX_BYTES, capture: false, stdoutObserver: capture.observer }); return capture.take(); };
  const cli = args => ["--workdir", project, ...args], inventory = async () => { for (const args of [["ps", "--all", "--quiet"], ["volume", "ls", "--quiet"], ["network", "ls", "--quiet"]]) if ((await run("docker", [...args, "--filter", "label=com.supabase.cli.project=" + projectId], 15000)).stdout.trim()) return false; return true; };
  let infrastructure;
  try {
    if (await realpath(runnerTemp) !== runnerTemp) fail("ENVIRONMENT_REFUSED"); await assertNoEnvironmentFiles(ROOT);
    const migrations = await readPublicTypesMigrations(); facts = await collectPublicTypesSources(ROOT, env.GITHUB_SHA, run, runBytes);
    for (const port of [54320, 54321, 54322]) await freePort(port);
    root = await mkdtemp(join(runnerTemp, "sc-public-types-preparation-")); await chmod(root, 0o700); home = join(root, "home"); project = join(root, "project"); await mkdir(home, { mode: 0o700 }); await mkdir(join(project, "supabase/migrations"), { recursive: true, mode: 0o700 });
    child = { ...os, HOME: home, XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: join(home, ".cache") };
    await writeFile(join(project, "supabase/config.toml"), renderFoundationConfig((await canonical(ROOT, "tests/fixtures/supabase-auth-local/config.toml")).toString("utf8"), projectId), { flag: "wx", mode: 0o600 });
    if ((await run("supabase", ["--version"], 15000)).stdout.trim() !== CLI_VERSION) fail("CLI_REFUSED"); if (!await inventory()) fail("NATIVE_REFUSED");
    startAttempted = true; await run("supabase", cli(["start"]), 600000, { capture: false });
    const local = decodeLocalStatus((await run("supabase", cli(["status", "-o", "json"]), 30000)).stdout), pg = localPsqlEnvironment(env, home, local);
    const query = async input => decodeFoundationJson((await run("psql", ["--no-psqlrc", "--no-password", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--file=-"], 60000, { env: pg, input })).stdout);
    const write = input => run("psql", ["--no-psqlrc", "--no-password", "--quiet", "--set", "ON_ERROR_STOP=1", "--file=-"], 60000, { env: pg, input, capture: false });
    const instance = await query(FOUNDATION_INSTANCE_SQL), systemIdentifier = acceptFoundationInstance(instance), context = { namespace, sourceSha: env.GITHUB_SHA, projectId, systemIdentifier }; postgresVersion = instance.version;
    const rawContainers = []; for (const kind of KINDS) rawContainers.push(decodeFoundationJson((await run("docker", ["inspect", "--format", FORMAT, "supabase_" + kind + "_" + projectId], 15000)).stdout)); containers = validatePublicTypesContainers(rawContainers, projectId);
    assertDatabasePreflight(await query(DATABASE_PREFLIGHT), false); await write(LOCAL_INFRASTRUCTURE_FIXTURE); assertDatabasePreflight(await query(DATABASE_PREFLIGHT)); acceptFoundationEmptyLedger(await query(FOUNDATION_EMPTY_LEDGER_SQL), context);
    await copyPublicTypesMigrations(migrations, join(project, "supabase/migrations"), root);
    const verifyCopy = async () => { const names = (await readdir(join(project, "supabase/migrations"))).sort(); if (names.length !== 26 || names.some((n, i) => n !== basename(migrations[i].path))) fail("SOURCE_REFUSED"); for (const row of migrations) { const p = join(project, "supabase/migrations", basename(row.path)), s = await lstat(p); if (!s.isFile() || s.isSymbolicLink() || await realpath(p) !== p || !(await readFile(p)).equals(row.source)) fail("SOURCE_REFUSED"); } };
    await verifyCopy(); await run("supabase", cli(["migration", "up", "--local"]), 180000, { capture: false }); await write(foundationMarkerSql(context)); const first = validatePublicTypesLedger(await query(foundationLedgerSql(context)), context);
    await verifyCopy(); await run("supabase", cli(["migration", "up", "--local"]), 60000, { capture: false }); ledger = validatePublicTypesLedger(await query(foundationLedgerSql(context)), context); assertFoundationLedgerNoOp(first, ledger); noOpSecondApply = true;
    const bytes = await runBytes("supabase", cli(["gen", "types", "--local", "--lang", "typescript", "--schema", "public"]), 120000), baseline = (await canonical(ROOT, "src/lib/supabase/database.generated.ts")).toString("utf8"); candidate = { bytes, types: inspectPublicTypesCandidate(baseline, bytes) };
  } catch (e) { originalCode = CODES.includes(e?.message) ? e.message : "NATIVE_REFUSED"; }
  finally {
    infrastructure = await teardownPublicTypesCandidate({ groupKnown, pending: pending.size, startAttempted, rootCreated: !!root }, {
      stop: () => run("supabase", cli(["stop", "--project-id", projectId, "--no-backup"]), 120000, { capture: false }), inventory,
      remove: async () => { assertTempDescendant(runnerTemp, root); const s = await lstat(root); if (!s.isDirectory() || s.isSymbolicLink() || await realpath(root) !== root) fail("TEARDOWN_UNCONFIRMED"); await rm(root, { recursive: true, force: false }); },
    });
  }
  if (Object.values(infrastructure).some(v => v !== true)) fail("TEARDOWN_UNCONFIRMED"); if (originalCode) fail(originalCode);
  const metadata = { formatVersion: 1, purpose: "PUBLIC_TYPES_PREPARATION_NOT_RELEASE", acceptance: false, hostedCertified: false, catalogueCertified: false, localOnly: true, ...facts, cliVersion: CLI_VERSION, postgresVersion, migrations: PUBLIC_TYPES_MIGRATIONS, ledger, containers, noOpSecondApply, types: candidate.types, infrastructure };
  if (!await writePublicTypesCandidate(runnerTemp, env.GITHUB_OUTPUT, metadata, candidate.bytes)) fail("EXPORT_REFUSED"); return { status: "PUBLIC_TYPES_CANDIDATE_PREPARED", acceptance: false, sourceSha: env.GITHUB_SHA, migrations: 26, bytes: candidate.types.bytes, sha256: candidate.types.sha256, ast: candidate.types.ast.code };
}
export async function main(argv = process.argv.slice(2), env = process.env, output = value => process.stdout.write(JSON.stringify(value) + "\n"), execute = preparePublicTypesCandidate) {
  if (!argv.length || argv.length === 1 && argv[0] === "--help") { output({ code: "NO_SERVICE_STARTED", acceptance: false }); return 0; }
  if (argv.length !== 1 || argv[0] !== "--execute") { output({ code: "ENVIRONMENT_REFUSED", acceptance: false }); return 1; }
  try { output(await execute(env)); return 0; } catch (e) { output({ code: CODES.includes(e?.message) ? e.message : "NATIVE_REFUSED", acceptance: false }); return 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
