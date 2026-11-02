// Test-only fixture. No remote service, environment-selected root or migration promotion.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSqlEditor } from "../../../scripts/build-sql-editor.mjs";
import { CURRENT27_CANONICAL_REVIEW } from "../../helpers/canonical-release-source.mjs";
import { FRONT_B_30_DRAFT_REVIEW, readHistorical027FromReviewedFrontB, readReviewedFrontBChain } from "../../helpers/canonical-front-b-source.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const candidateNames = Object.freeze([
  "20261101020254_public_admission_gate.sql",
  "20261101030000_signup_metrics.sql",
  "20261101013633_feedback_requests.sql",
]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

async function checkDirectory(path, parent) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(path) !== path || dirname(path) !== parent) throw Error("FIXTURE_CLEANUP_REFUSED");
}

async function removeKnownFile(path, parent) {
  let stat;
  try { stat = await lstat(path); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || dirname(path) !== parent || await realpath(path) !== path) throw Error("FIXTURE_CLEANUP_REFUSED");
  await unlink(path);
}

async function clean(root, parent) {
  await checkDirectory(root, parent);
  if (!basename(root).startsWith("sc-sequence-30-")) throw Error("FIXTURE_CLEANUP_REFUSED");
  const supabase = join(root, "supabase"), migrations = join(supabase, "migrations"), editor = join(supabase, "sql-editor"), installation = join(editor, "installation");
  const layout = [
    [root, new Set(["supabase"])],
    [supabase, new Set(["migrations", "sql-editor"])],
    [migrations, new Set(FRONT_B_30_DRAFT_REVIEW.map(row => row.file))],
    [editor, new Set(["installation", "manifest.json", "README.md"])],
    [installation, new Set(FRONT_B_30_DRAFT_REVIEW.map((row, i) => `${String(i + 1).padStart(3, "0")}_${row.file}`))],
  ];
  // Validate the entire finite tree before removing anything; missing paths are
  // permitted for partial setup, unknown entries or links refuse cleanup.
  const existing = new Set([root]);
  for (const [directory, allowed] of layout) {
    if (directory !== root) {
      try { await checkDirectory(directory, dirname(directory)); existing.add(directory); }
      catch (error) { if (error.code === "ENOENT") continue; throw error; }
    }
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!allowed.has(entry.name) || entry.isSymbolicLink() || !(entry.isFile() || entry.isDirectory())) throw Error("FIXTURE_CLEANUP_REFUSED");
      const path = join(directory, entry.name);
      if (await realpath(path) !== path) throw Error("FIXTURE_CLEANUP_REFUSED");
      const expectedDirectory = [supabase, migrations, editor, installation].includes(path);
      if (entry.isDirectory() !== expectedDirectory) throw Error("FIXTURE_CLEANUP_REFUSED");
    }
  }
  if (existing.has(installation)) for (const row of FRONT_B_30_DRAFT_REVIEW.map((v, i) => `${String(i + 1).padStart(3, "0")}_${v.file}`)) await removeKnownFile(join(installation, row), installation);
  if (existing.has(editor)) for (const name of ["manifest.json", "README.md"]) await removeKnownFile(join(editor, name), editor);
  if (existing.has(migrations)) for (const row of FRONT_B_30_DRAFT_REVIEW) await removeKnownFile(join(migrations, row.file), migrations);
  for (const directory of [installation, editor, migrations, supabase, root]) if (existing.has(directory)) await rmdir(directory);
}

/** Calls run with an internally constructed, completely qualified draft tree. */
export async function withStagedFrontB30(t, run) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, "sc-sequence-30-"));
  t.after(() => clean(root, parent));
  await checkDirectory(root, parent);
  const existing = await readHistorical027FromReviewedFrontB(repository);
  assert.equal(existing.length, 27);
  await mkdir(join(root, "supabase"));
  await mkdir(join(root, "supabase", "migrations"));
  for (const [i, expected] of CURRENT27_CANONICAL_REVIEW.entries()) {
    assert.equal(existing[i].file, expected.file);
    await writeFile(join(root, "supabase", "migrations", expected.file), existing[i].source, { flag: "wx" });
  }
  for (const [i, name] of candidateNames.entries()) {
    const expected = FRONT_B_30_DRAFT_REVIEW[27 + i];
    const bytes = await readFile(new URL(`../../../supabase/operations/candidates/${name}`, import.meta.url));
    assert.equal(bytes.length, expected.bytes);
    assert.equal(digest(bytes), expected.sha256);
    await writeFile(join(root, "supabase", "migrations", expected.file), bytes, { flag: "wx" });
  }
  assert.equal(buildSqlEditor({ root }).migrations, 30);
  const reviewed = await readReviewedFrontBChain(root);
  assert.equal(reviewed.state, "draft_30");
  assert.equal(reviewed.sources.length, 30);
  await run(root);
}
