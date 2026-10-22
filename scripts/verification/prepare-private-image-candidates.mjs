/** GitHub-only preparation of PUBLIC SOURCE candidates. Never a release gate,
 * hosted connection, official type generator or automatic baseline update. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSqlEditor, planSqlEditor } from "../build-sql-editor.mjs";
import { createLocalCanonicalSql } from "../../tests/helpers/local-canonical-sql.ts";
import { ADMIN_LOCAL_SOURCE_PATHS } from "../../tests/e2e-auth-local/admin-native-backend-local-ci-contract.mjs";
import { deriveAdminBrowserSourcePaths } from "./admin-browser-local-ci.mjs";
import { deriveRecoverySourcePaths } from "./auth-recovery-local-ci.mjs";
import { deriveDriveSourcePaths } from "./drive-browser-local-ci.mjs";
import { deriveFoundationSources } from "./foundation-local-ci.mjs";
import { AVATAR_SOURCE_PATHS } from "./avatar-storage-local-ci.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const IMAGE_MIGRATION = "supabase/migrations/20261021045700_spec08_private_entity_images.sql";
const IMAGE_SHA = "385dff57a2d81fe8b7ba92f6bc95d16d25ee09f7c85106fa5f40711a03dedde2";
const HABIT_MIGRATION = "supabase/migrations/20261021144650_spec08_habit_frequency_history.sql";
const HABIT_SHA = "90156cf1069e2934b38160099156086ac4d60d0e349932d96565b35d3312083e";
const CAPTURE_MIGRATION = "supabase/migrations/20261021171416_spec08_capture_document_write.sql";
const CAPTURE_SHA = "431e7521306951d403aba861541805b350cf30523d0e52b7634825852f961b38";
const MIGRATIONS = 25;
const BASELINE_MIGRATIONS = 22;
// Canonical JSON of installation[0..21] at reviewed base53b8 (ASCII entries,
// original field order). Source bytes AND generated copies must still match.
const BASELINE_INSTALLATION_BYTES = 5947;
const BASELINE_INSTALLATION_SHA = "7d5e0b77e303d28341f2c2b87cb9033de68751c8c2417ede4f805eef07eab939";
const CANDIDATE_BRANCH = "refs/heads/codex/redesign-parallel-20261022";
// Reviewed integration slots remain pinned. Root supplies reviewed names
// reserved with UTC under the no-runtime constraint, and their source hashes.
// No CLI execution is attested here; no draft is auto-imported.
const NEW_MIGRATION_PINS = Object.freeze([
  Object.freeze({ position: 23, source: "supabase/migrations/20261022042432_spec08_calendar_participants.sql", bytes: 46113, sha256: "b7a0a3f893e1cf5ac5f95c3fe36d46a234fa372c24104df9af9535f350326b8c" }),
  Object.freeze({ position: 24, source: "supabase/migrations/20261022042500_spec08_finance_card_metadata.sql", bytes: 8565, sha256: "8406c90596d1b5679827f3aa61b3fd229f7c17bee5d4f9ae46753bfd3fddd51c" }),
  Object.freeze({ position: 25, source: "supabase/migrations/20261022042501_spec08_capture_knowledge_promotion.sql", bytes: 44115, sha256: "c4d50e79c8abc231b0f9d634c5c585eecf5635df75161c73fd9db1c5cb40b39f" }),
]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
let candidateStage = "environment";

/** Schema metadata from the EMPTY disposable database only. Bodies and default
 * expressions are hashed inside PostgreSQL, never selected as output text. */
async function functionFingerprints(db) {
  const rows = (await db.query(`select jsonb_build_object(
    'schema',n.nspname,'name',p.proname,'identityArguments',pg_get_function_identity_arguments(p.oid),
    'resultType',pg_get_function_result(p.oid),'language',l.lanname,'volatility',p.provolatile,
    'strict',p.proisstrict,'definer',p.prosecdef,'parallel',p.proparallel,'owner',pg_get_userbyid(p.proowner),
    'argumentTypes',to_jsonb(array(select format_type(t,null) from unnest(p.proargtypes::oid[]) t)),
    'argumentNames',to_jsonb(p.proargnames),'argumentModes',to_jsonb(p.proargmodes),
    'defaultArgumentCount',p.pronargdefaults,'defaultsSha256',case when p.proargdefaults is null then null else encode(sha256(convert_to(pg_get_expr(p.proargdefaults,0),'UTF8')),'hex') end,
    'configuration',to_jsonb(coalesce(p.proconfig,'{}'::text[])),
    'privileges',coalesce((select jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantor,a.grantee,a.privilege_type,a.is_grantable) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),'[]'::jsonb),
    'bodyBytes',octet_length(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),
    'bodySha256',encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),
    'definitionBytes',octet_length(convert_to(replace(pg_get_functiondef(p.oid),E'\\r\\n',E'\\n'),'UTF8')),
    'definitionSha256',encode(sha256(convert_to(replace(pg_get_functiondef(p.oid),E'\\r\\n',E'\\n'),'UTF8')),'hex')
  ) as fingerprint
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname in ('public','app_private') and p.prokind='f'
   and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
  order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)`)).rows;
  assert.ok(rows.length > 0 && rows.length <= 1024);
  const keys = ["schema", "name", "identityArguments", "resultType", "language", "volatility", "strict", "definer", "parallel", "owner", "argumentTypes", "argumentNames", "argumentModes", "defaultArgumentCount", "defaultsSha256", "configuration", "privileges", "bodyBytes", "bodySha256", "definitionBytes", "definitionSha256"];
  const text = (value, max) => typeof value === "string" && value.length <= max && /^[\x20-\x7e]*$/.test(value);
  const list = (value, max, item) => Array.isArray(value) && value.length <= max && value.every(item);
  const names = new Set(), fingerprints = [];
  for (const row of rows) {
    assert.deepEqual(Object.keys(row), ["fingerprint"]);
    const v = row.fingerprint;
    assert.ok(v && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key)));
    assert.ok(["public", "app_private"].includes(v.schema));
    assert.match(v.name, /^[A-Za-z_][A-Za-z0-9_]{0,127}$/);
    assert.ok(text(v.identityArguments, 4096) && text(v.resultType, 4096) && text(v.owner, 128));
    assert.ok(["sql", "plpgsql", "internal", "c"].includes(v.language) && ["i", "s", "v"].includes(v.volatility) && ["s", "r", "u"].includes(v.parallel));
    assert.equal(typeof v.strict, "boolean"); assert.equal(typeof v.definer, "boolean");
    assert.ok(list(v.argumentTypes, 128, value => text(value, 1024)));
    assert.ok(v.argumentNames === null || list(v.argumentNames, 128, value => text(value, 128)));
    assert.ok(v.argumentModes === null || list(v.argumentModes, 128, value => ["i", "o", "b", "v", "t"].includes(value)));
    assert.ok(Number.isSafeInteger(v.defaultArgumentCount) && v.defaultArgumentCount >= 0 && v.defaultArgumentCount <= v.argumentTypes.length);
    if (v.defaultArgumentCount === 0) assert.equal(v.defaultsSha256, null); else assert.match(v.defaultsSha256, /^[a-f0-9]{64}$/);
    assert.ok(list(v.configuration, 16, value => text(value, 512)));
    assert.ok(list(v.privileges, 64, value => value && Object.keys(value).sort().join(",") === "grantable,grantee,grantor,privilege" && text(value.grantor, 128) && text(value.grantee, 128) && value.privilege === "EXECUTE" && typeof value.grantable === "boolean"));
    for (const field of ["bodyBytes", "definitionBytes"]) assert.ok(Number.isSafeInteger(v[field]) && v[field] >= 0 && v[field] <= 2097152);
    for (const field of ["bodySha256", "definitionSha256"]) assert.match(v[field], /^[a-f0-9]{64}$/);
    const identity = v.schema + "." + v.name + "(" + v.identityArguments + ")";
    assert.ok(!names.has(identity)); names.add(identity); fingerprints.push(v);
  }
  return fingerprints;
}

async function main() {
  assert.equal(process.platform, "linux");
  assert.equal(process.env.CI, "true");
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.SC_IMAGE_CANDIDATES, "1");
  assert.equal(process.env.GITHUB_REF, CANDIDATE_BRANCH);
  assert.match(process.env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/);
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(), process.env.GITHUB_SHA);
  assert.equal((await readdir(ROOT)).some(name => name.startsWith(".env") && name !== ".env.example"), false);
  assert.equal(Object.keys(process.env).some(name => /^(SUPABASE_|DATABASE_URL$|PGPASSWORD$|ASAAS_|VERCEL_|GOOGLE_|AWS_)/.test(name)), false);
  const runnerTemp = process.env.RUNNER_TEMP;
  assert.ok(runnerTemp && resolve(runnerTemp) === runnerTemp && await realpath(runnerTemp) === runnerTemp);
  const output = join(runnerTemp, "sc-private-image-candidates");
  await mkdir(output, { mode: 0o700 }); // exclusive: never reuse a previous result
  assert.equal((await lstat(output)).isSymbolicLink(), false);
  candidateStage = "migration-integrity";
  assert.equal(hash(await readFile(join(ROOT, IMAGE_MIGRATION))), IMAGE_SHA);
  assert.equal(hash(await readFile(join(ROOT, HABIT_MIGRATION))), HABIT_SHA);
  assert.equal(hash(await readFile(join(ROOT, CAPTURE_MIGRATION))), CAPTURE_SHA);
  const prior = JSON.parse(await readFile(join(ROOT, "supabase/sql-editor/manifest.json"), "utf8"));
  assert.equal(prior.formatVersion, 1);
  assert.equal(prior.hashAlgorithm, "sha256");
  assert.ok([BASELINE_MIGRATIONS, MIGRATIONS].includes(prior.installation.length));
  const baseline = Buffer.from(JSON.stringify(prior.installation.slice(0, BASELINE_MIGRATIONS)));
  assert.equal(baseline.length, BASELINE_INSTALLATION_BYTES); assert.equal(hash(baseline), BASELINE_INSTALLATION_SHA);
  for (const [index, entry] of prior.installation.slice(0, BASELINE_MIGRATIONS).entries()) {
    assert.match(entry.source, /^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/);
    assert.equal(entry.order, index + 1); assert.equal(entry.version, entry.source.split("/").at(-1).slice(0, 14));
    assert.equal(entry.file, "installation/" + String(index + 1).padStart(3, "0") + "_" + entry.source.split("/").at(-1));
    const bytes = await readFile(join(ROOT, entry.source));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(hash(bytes), entry.sha256);
    const generated = await readFile(join(ROOT, "supabase/sql-editor", entry.file));
    assert.equal(generated.length, entry.bytes);
    assert.equal(hash(generated), entry.sha256);
  }
  assert.equal(NEW_MIGRATION_PINS.length, MIGRATIONS - BASELINE_MIGRATIONS);
  let previousSource = prior.installation[BASELINE_MIGRATIONS - 1].source;
  for (const [index, pin] of NEW_MIGRATION_PINS.entries()) {
    assert.equal(pin.position, BASELINE_MIGRATIONS + index + 1);
    assert.match(pin.source, /^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/);
    assert.ok(pin.source > previousSource);
    assert.ok(Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && pin.bytes <= 1048576);
    assert.match(pin.sha256, /^[a-f0-9]{64}$/);
    const bytes = await readFile(join(ROOT, pin.source));
    assert.equal(bytes.length, pin.bytes); assert.equal(hash(bytes), pin.sha256);
    if (prior.installation.length === MIGRATIONS) {
      const entry = prior.installation[pin.position - 1];
      assert.equal(entry.source, pin.source); assert.equal(entry.bytes, pin.bytes); assert.equal(entry.sha256, pin.sha256);
    }
    previousSource = pin.source;
  }

  // The real generator runs only here in the disposable runner. Its worktree
  // output is a candidate artifact, not a commit or a certificate for this SHA.
  candidateStage = "sql-editor";
  buildSqlEditor({ root: ROOT });
  buildSqlEditor({ root: ROOT, check: true });
  const plan = planSqlEditor(ROOT);
  assert.equal(plan.manifest.installation.length, MIGRATIONS);
  // Original AST derivations, without collect/acceptance or assertions about
  // Git identity of the generated candidate files in this runner worktree.
  candidateStage = "source-inventories";
  const union = paths => [...new Set([...ADMIN_LOCAL_SOURCE_PATHS, ...paths])].sort();
  const sourcePaths = {
    nativeAdmin: [...ADMIN_LOCAL_SOURCE_PATHS],
    adminBrowser: union(await deriveAdminBrowserSourcePaths()),
    recovery: union(await deriveRecoverySourcePaths()),
    legacyDrive: union(await deriveDriveSourcePaths()),
    foundation: [...await deriveFoundationSources()],
    avatar: [...AVATAR_SOURCE_PATHS],
  };
  const files = [];
  for (const [path, bytes] of plan.files) {
    assert.match(path, /^(installation\/\d{3}_\d{14}_[a-z0-9_]+\.sql|manifest\.json|README\.md)$/);
    const destination = join(output, "sql-editor", path);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
    files.push({ path: "sql-editor/" + path, bytes: bytes.length, sha256: hash(bytes) });
  }

  let metadata;
  candidateStage = "canonical-sql";
  const db = await createLocalCanonicalSql();
  try {
    await db.exec("set search_path=pg_catalog,public");
    const empty = (await db.query("select (select count(*) from auth.users)::integer users,(select count(*) from storage.objects)::integer objects")).rows[0];
    assert.deepEqual(empty, { users: 0, objects: 0 });
    const policy = (await db.query("select md5(pg_get_expr(polqual,polrelid)) digest from pg_policy where polrelid='public.drive_files'::regclass and polname='files_owner_read'")).rows;
    const cleanup = (await db.query("select encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex') digest from pg_proc where oid='app_private.file_cleanup_candidates()'::regprocedure")).rows;
    assert.equal(policy.length, 1); assert.match(policy[0].digest, /^[a-f0-9]{32}$/);
    assert.equal(cleanup.length, 1); assert.match(cleanup[0].digest, /^[a-f0-9]{64}$/);
    const results = await db.exec(await readFile(join(ROOT, "supabase/tests/release-catalog.sql"), "utf8"));
    const reports = results.flatMap(result => result.rows).map(row => row.jsonb_build_object).filter(value => value?.version === 1);
    assert.equal(reports.length, 1);
    const catalog = reports[0];
    assert.ok(Number.isSafeInteger(catalog.checks) && Array.isArray(catalog.deviations));
    assert.ok(catalog.deviations.length <= 100);
    assert.ok(catalog.deviations.every(row => Object.keys(row).sort().join(",") === "check,object" && typeof row.check === "string" && typeof row.object === "string"));
    const publicFunctions = await functionFingerprints(db);
    metadata = { formatVersion: 1, purpose: "CANDIDATE_ONLY_NOT_ACCEPTANCE", sourceSha: process.env.GITHUB_SHA,
      imageMigration: { path: IMAGE_MIGRATION, sha256: IMAGE_SHA },
      habitMigration: { path: HABIT_MIGRATION, sha256: HABIT_SHA },
      captureMigration: { path: CAPTURE_MIGRATION, sha256: CAPTURE_SHA }, migrations: MIGRATIONS,
      integrationMigrations: NEW_MIGRATION_PINS, baselineMigrationsPreserved: BASELINE_MIGRATIONS,
      engine: "PGLITE_DISPOSABLE_NOT_NATIVE_PG17", hostedAccess: false, officialTypesGenerated: false,
      policyDigest: policy[0].digest, cleanupBodySha256: cleanup[0].digest,
      observedCatalogChecks: catalog.checks, observedCatalogOk: catalog.ok, deviations: catalog.deviations, publicFunctions, sourcePaths, files };
  } finally { await db.close(); }
  candidateStage = "metadata";
  const encodedMetadata = JSON.stringify(metadata, null, 2) + "\n";
  assert.ok(Buffer.byteLength(encodedMetadata) <= 2097152);
  await writeFile(join(output, "candidate-metadata.json"), encodedMetadata, { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify({ status: "CANDIDATES_PREPARED", sourceSha: process.env.GITHUB_SHA, acceptance: false, files: files.length }) + "\n");
  assert.ok(process.env.GITHUB_OUTPUT);
  await writeFile(process.env.GITHUB_OUTPUT, "candidates_ready=true\n", { flag: "a" });
}

try { await main(); } catch { process.stderr.write(JSON.stringify({ code: "PRIVATE_IMAGE_CANDIDATES_REFUSED", stage: candidateStage }) + "\n"); process.exitCode = 1; }
