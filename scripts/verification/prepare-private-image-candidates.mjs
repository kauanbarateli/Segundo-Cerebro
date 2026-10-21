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
const CAPTURE_SHA = "4ce6eb6a7b0162365cae610564447bacb6d0904f18cef8be50a369f073bef877";
const MIGRATIONS = 22; // Calendar's reserved migration is not in this candidate.
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
let candidateStage = "environment";

async function main() {
  assert.equal(process.platform, "linux");
  assert.equal(process.env.CI, "true");
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.SC_IMAGE_CANDIDATES, "1");
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
  assert.ok([20, 21, MIGRATIONS].includes(prior.installation.length));
  for (const entry of prior.installation.slice(0, 20)) {
    const bytes = await readFile(join(ROOT, entry.source));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(hash(bytes), entry.sha256);
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
    metadata = { formatVersion: 1, purpose: "CANDIDATE_ONLY_NOT_ACCEPTANCE", sourceSha: process.env.GITHUB_SHA,
      imageMigration: { path: IMAGE_MIGRATION, sha256: IMAGE_SHA },
      habitMigration: { path: HABIT_MIGRATION, sha256: HABIT_SHA },
      captureMigration: { path: CAPTURE_MIGRATION, sha256: CAPTURE_SHA }, migrations: MIGRATIONS,
      engine: "PGLITE_DISPOSABLE_NOT_NATIVE_PG17", hostedAccess: false, officialTypesGenerated: false,
      policyDigest: policy[0].digest, cleanupBodySha256: cleanup[0].digest,
      observedCatalogChecks: catalog.checks, observedCatalogOk: catalog.ok, deviations: catalog.deviations, sourcePaths, files };
  } finally { await db.close(); }
  candidateStage = "metadata";
  await writeFile(join(output, "candidate-metadata.json"), JSON.stringify(metadata, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify({ status: "CANDIDATES_PREPARED", sourceSha: process.env.GITHUB_SHA, acceptance: false, files: files.length }) + "\n");
  assert.ok(process.env.GITHUB_OUTPUT);
  await writeFile(process.env.GITHUB_OUTPUT, "candidates_ready=true\n", { flag: "a" });
}

try { await main(); } catch { process.stderr.write(JSON.stringify({ code: "PRIVATE_IMAGE_CANDIDATES_REFUSED", stage: candidateStage }) + "\n"); process.exitCode = 1; }
