import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildSqlEditor } from "../../scripts/build-sql-editor.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryParent = path.join(repo, "work", "sql-editor-tests");

function fixture(t) {
  mkdirSync(temporaryParent, { recursive: true });
  const root = mkdtempSync(path.join(temporaryParent, "case-"));
  t.after(() => {
    // Cleanup only the exact test directory allocated above, within ignored work/.
    assert.equal(path.dirname(root), temporaryParent);
    assert.match(path.basename(root), /^case-/);
    rmSync(root, { recursive: true, force: true });
  });
  for (const directory of ["migrations", "tests", "manual"]) mkdirSync(path.join(root, "supabase", directory), { recursive: true });
  writeFileSync(path.join(root, "supabase/tests/identity.sql"), "begin;\nselect 1;\nrollback;\n");
  writeFileSync(path.join(root, "supabase/manual/bootstrap-master.sql"), "begin;\nselect 'manual only';\nrollback;\n");
  return root;
}

function migration(root, name, content) {
  writeFileSync(path.join(root, "supabase/migrations", name), content);
}

function packageSnapshot(root) {
  const directory = path.join(root, "supabase/sql-editor");
  return Object.fromEntries(["manifest.json", "README.md", ...readdirSync(path.join(directory, "installation")).map((name) => `installation/${name}`)]
    .map((name) => [name, readFileSync(path.join(directory, name)).toString("hex")]));
}

test("orders versions independent of creation order, preserves bytes and excludes manual SQL", (t) => {
  const root = fixture(t);
  const early = Buffer.from("begin;\nselect 'á; -- conteúdo';\ncommit;\n");
  const late = Buffer.from("begin;\nselect $$begin; commit;$$;\ncommit;\n");
  migration(root, "20261009000000_auth.sql", late);
  migration(root, "20261007082811_identity.sql", early);
  buildSqlEditor({ root });
  const manifest = JSON.parse(readFileSync(path.join(root, "supabase/sql-editor/manifest.json"), "utf8"));
  assert.deepEqual(manifest.installation.map(({ version }) => version), ["20261007082811", "20261009000000"]);
  assert.deepEqual(manifest.separate.map(({ purpose }) => purpose), ["validation", "manual"]);
  assert.equal(manifest.installation.length, 2);
  for (const [index, expected] of [early, late].entries()) {
    const record = manifest.installation[index];
    assert.deepEqual(readFileSync(path.join(root, "supabase/sql-editor", record.file)), expected);
    assert.equal(record.sha256, createHash("sha256").update(expected).digest("hex"));
    assert.equal(record.bytes, expected.length);
  }
  const original = packageSnapshot(root);
  buildSqlEditor({ root });
  assert.deepEqual(packageSnapshot(root), original);
  buildSqlEditor({ root, check: true });
});

test("check detects canonical drift without modifying output, then generation includes appended migrations", (t) => {
  const root = fixture(t);
  migration(root, "20261007082811_identity.sql", "begin;\nselect 1;\ncommit;\n");
  buildSqlEditor({ root });
  const original = packageSnapshot(root);
  migration(root, "20261007082811_identity.sql", "begin;\nselect 2;\ncommit;\n");
  assert.throws(() => buildSqlEditor({ root, check: true }), /Drift: installation/);
  assert.deepEqual(packageSnapshot(root), original);
  migration(root, "20261009000000_auth.sql", "begin;\nselect 3;\ncommit;\n");
  buildSqlEditor({ root });
  buildSqlEditor({ root, check: true });
  const manifest = JSON.parse(readFileSync(path.join(root, "supabase/sql-editor/manifest.json"), "utf8"));
  assert.equal(manifest.installation[1].version, "20261009000000");
});

test("check rejects changed copies, forged manifest, missing files and unexpected executable SQL", (t) => {
  const root = fixture(t);
  migration(root, "20261007082811_identity.sql", "begin;\nselect 1;\ncommit;\n");
  buildSqlEditor({ root });
  const directory = path.join(root, "supabase/sql-editor");
  writeFileSync(path.join(directory, "installation/001_20261007082811_identity.sql"), "select 'tampered';\n");
  assert.throws(() => buildSqlEditor({ root, check: true }), /Drift: installation/);
  buildSqlEditor({ root });
  writeFileSync(path.join(directory, "manifest.json"), "{}\n");
  assert.throws(() => buildSqlEditor({ root, check: true }), /Drift: manifest.json/);
  buildSqlEditor({ root });
  rmSync(path.join(directory, "installation/001_20261007082811_identity.sql"));
  assert.throws(() => buildSqlEditor({ root, check: true }), /Missing generated file/);
  buildSqlEditor({ root });
  writeFileSync(path.join(directory, "installation/999_unreviewed.sql"), "select 42;\n");
  assert.throws(() => buildSqlEditor({ root, check: true }), /Unexpected generated file/);
  assert.throws(() => buildSqlEditor({ root }), /require manual review/);
  assert.equal(readFileSync(path.join(directory, "installation/999_unreviewed.sql"), "utf8"), "select 42;\n");
});

test("manifest tracks separated scripts and refuses a bootstrap that would commit", (t) => {
  const root = fixture(t);
  migration(root, "20261007082811_identity.sql", "begin;\nselect 1;\ncommit;\n");
  buildSqlEditor({ root });
  writeFileSync(path.join(root, "supabase/tests/identity.sql"), "begin;\nselect 2;\nrollback;\n");
  assert.throws(() => buildSqlEditor({ root, check: true }), /Drift: manifest.json/);
  writeFileSync(path.join(root, "supabase/manual/bootstrap-master.sql"), "begin;\nselect 'manual only';\ncommit;\n");
  assert.throws(() => buildSqlEditor({ root }), /must end with explicit ROLLBACK/);
});

test("rejects ambiguous migration versions and malformed filenames before generating", (t) => {
  const root = fixture(t);
  migration(root, "20261007082811_identity.sql", "begin; commit;\n");
  migration(root, "20261007082811_duplicate.sql", "begin; commit;\n");
  assert.throws(() => buildSqlEditor({ root }), /Duplicate migration version/);
  rmSync(path.join(root, "supabase/migrations/20261007082811_duplicate.sql"));
  migration(root, "auth.sql", "begin; commit;\n");
  assert.throws(() => buildSqlEditor({ root }), /Invalid canonical migration/);
});
