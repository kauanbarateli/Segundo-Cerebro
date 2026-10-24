/** Pure file fixtures only. These controls require the reviewed 027 to be
 * promoted in the checkout; they do not load WASM, SDKs or a SQL engine.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CURRENT27_CANONICAL_REVIEW, readCurrent27CanonicalMigrations, readHistorical026CanonicalMigrations } from "../helpers/canonical-release-source.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const bothRefuse = async directory => {
  await assert.rejects(readCurrent27CanonicalMigrations(directory));
  await assert.rejects(readHistorical026CanonicalMigrations(directory));
};
async function fixture(t) {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await realpath(await mkdtemp(join(temporaryRoot, "sc-canonical-release-")));
  assert.equal(dirname(directory), temporaryRoot);
  assert.match(basename(directory), /^sc-canonical-release-[A-Za-z0-9]+$/);
  t.after(async () => {
    assert.equal(await realpath(directory), directory);
    assert.equal(dirname(directory), temporaryRoot);
    assert.match(basename(directory), /^sc-canonical-release-[A-Za-z0-9]+$/);
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(join(directory, "supabase/migrations"), { recursive: true });
  await mkdir(join(directory, "supabase/sql-editor/installation"), { recursive: true });
  const installation = [];
  for (const [index, expected] of CURRENT27_CANONICAL_REVIEW.entries()) {
    const source = `supabase/migrations/${expected.file}`, file = `installation/${String(index + 1).padStart(3, "0")}_${expected.file}`;
    const bytes = await readFile(join(root, source));
    await writeFile(join(directory, source), bytes);
    await writeFile(join(directory, "supabase/sql-editor", file), bytes);
    installation.push({ order: index + 1, version: expected.file.slice(0, 14), source, file, bytes: expected.bytes, sha256: expected.sha256 });
  }
  const manifest = { formatVersion: 1, hashAlgorithm: "sha256", installation };
  await writeFile(join(directory, "supabase/sql-editor/manifest.json"), JSON.stringify(manifest));
  return { directory, manifest };
}

test("CURRENT27 and HIST026 validate one complete chain and return distinct named plans", async t => {
  const { directory } = await fixture(t);
  const current = await readCurrent27CanonicalMigrations(directory), historical = await readHistorical026CanonicalMigrations(directory);
  assert.equal(current.length, 27); assert.equal(historical.length, 26);
  assert.deepEqual(current.map(row => row.file), CURRENT27_CANONICAL_REVIEW.map(row => row.file));
  assert.deepEqual(historical.map(row => row.file), CURRENT27_CANONICAL_REVIEW.slice(0, 26).map(row => row.file));
  assert.equal(current[26].source.length, 158010);
  assert.equal(createHash("sha256").update(current[26].source).digest("hex"), "f96d7a62b9337b9688c34ac471dd9fd326318e12d859817c263bb1ccf46d072a");
});

test("a missing 027 is refused by both plans, including the historical selector", async t => {
  const { directory, manifest } = await fixture(t);
  await unlink(join(directory, manifest.installation[26].source)); await bothRefuse(directory);
});

test("unknown migration and copy extras are refused by both plans", async t => {
  for (const path of ["supabase/migrations/20990101000000_unreviewed.sql", "supabase/sql-editor/installation/028_20990101000000_unreviewed.sql"]) {
    const { directory } = await fixture(t); await writeFile(join(directory, path), "-- unreviewed\n"); await bothRefuse(directory);
  }
});

test("one altered byte in 027 or an old prefix source is refused", async t => {
  for (const index of [0, 25, 26]) {
    const { directory, manifest } = await fixture(t), row = manifest.installation[index];
    const bytes = await readFile(join(directory, row.source)); bytes[bytes.length - 1] ^= 1;
    await writeFile(join(directory, row.source), bytes); await bothRefuse(directory);
  }
});

test("changing source, copy and manifest together cannot repin the reviewed chain", async t => {
  for (const index of [25, 26]) {
    const { directory, manifest } = await fixture(t), row = manifest.installation[index];
    const bytes = Buffer.concat([await readFile(join(directory, row.source)), Buffer.from(" ")]);
    await writeFile(join(directory, row.source), bytes); await writeFile(join(directory, "supabase/sql-editor", row.file), bytes);
    row.bytes = bytes.length; row.sha256 = createHash("sha256").update(bytes).digest("hex");
    await writeFile(join(directory, "supabase/sql-editor/manifest.json"), JSON.stringify(manifest)); await bothRefuse(directory);
  }
});

test("026-only, duplicate and swapped manifest entries cannot masquerade as CURRENT27", async t => {
  for (const mutation of [rows => rows.slice(0, 26), rows => rows.map((row, index) => index === 26 ? rows[25] : row), rows => [rows[1], rows[0], ...rows.slice(2)]]) {
    const { directory, manifest } = await fixture(t); manifest.installation = mutation(manifest.installation);
    await writeFile(join(directory, "supabase/sql-editor/manifest.json"), JSON.stringify(manifest)); await bothRefuse(directory);
  }
});
