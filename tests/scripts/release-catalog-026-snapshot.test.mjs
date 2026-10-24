/** Inert historical integrity only. This is NOT a current release gate or
 * TargetBaseline. It reads exactly 26 named references, never enumerates the
 * migration directory, imports a factory or executes the catalogue as SQL.
 * A future 027/extra file needs a separate qualified full-chain reader. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const manifestPath = "tests/fixtures/schema-release-026/manifest.json";
const MANIFEST_SHA256 = "88f036a9a41bcc1528fde8c320e43374f3edb25e1083eb485082b01a142839e2";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

function exactKeys(value, keys) {
  assert.ok(value && Object.getPrototypeOf(value) === Object.prototype);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}
function historicalRows(rows) {
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, 26);
  let previous = "";
  for (const row of rows) {
    exactKeys(row, ["file", "version", "bytes", "sha256"]);
    assert.equal(typeof row.file, "string");
    assert.match(row.file, /^\d{14}_[a-z0-9_]+\.sql$/);
    assert.equal(row.version, row.file.slice(0, 14));
    assert.ok(row.version > previous);
    assert.ok(Number.isSafeInteger(row.bytes) && row.bytes > 0 && row.bytes <= 2 * 1024 * 1024);
    assert.equal(typeof row.sha256, "string");
    assert.match(row.sha256, /^[a-f0-9]{64}$/);
    previous = row.version;
  }
}
function pinnedManifest(raw) {
  assert.ok(Buffer.isBuffer(raw));
  assert.equal(digest(raw), MANIFEST_SHA256, "Historical manifest bytes changed");
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  exactKeys(value, ["version", "kind", "notice", "baseCommit", "baseTree", "derivedPinSet", "catalogue", "migrationCount", "migrations", "scope", "limitations"]);
  assert.equal(value.version, 1);
  assert.equal(value.kind, "INERT_HISTORICAL_001_026_REFERENCE");
  assert.equal(value.migrationCount, 26);
  assert.match(value.baseCommit, /^[a-f0-9]{40}$/);
  assert.match(value.baseTree, /^[a-f0-9]{40}$/);
  assert.deepEqual(value.scope, { referenceOnly: true, currentReleaseValidated: false, directoryInventoryValidated: false, targetBaseline: false, installedRelease: false, sqlExecuted: false, factoryConsumptionEnabled: false });
  historicalRows(value.migrations);
  return value;
}
function referenceBytes(row, raw) {
  assert.ok(Buffer.isBuffer(raw));
  assert.equal(raw.length, row.bytes, "Historical length changed");
  assert.equal(digest(raw), row.sha256, "Historical digest changed");
}
async function snapshot() {
  const raw = await readFile(new URL(manifestPath, root));
  return { raw, value: pinnedManifest(raw) };
}

test("026 manifest is a pinned historical reference without current-release or target authority", async t => {
  t.diagnostic("Node " + process.versions.node + "; historical bytes only; sqlExecuted=false");
  const { value } = await snapshot();
  assert.match(value.notice, /not the current release/);
  assert.equal(value.catalogue.path, "tests/fixtures/schema-release-026/release-catalog.sql");
  assert.equal(value.catalogue.reportVersion, 1);
  assert.equal(value.catalogue.expectedChecks, 1720);
  assert.equal(value.derivedPinSet.path, "tests/helpers/finance-026-candidate-source.ts");
});

test("catalogue snapshot retains exact reviewed bytes without reading or executing the current catalogue", async () => {
  const { value } = await snapshot();
  referenceBytes(value.catalogue, await readFile(new URL(value.catalogue.path, root)));
});

test("only the 26 explicitly named historical references retain their reviewed bytes", async () => {
  const { value } = await snapshot();
  // No readdir, migration glob or current-release assertion: this check alone
  // says nothing about additional files in a future checkout.
  for (const row of value.migrations) {
    referenceBytes(row, await readFile(new URL("supabase/migrations/" + row.file, root)));
  }
});

test("catalogue BOM, CRLF conversion, truncation and extra byte remain drift, never normalization", async () => {
  const { value } = await snapshot();
  const original = await readFile(new URL(value.catalogue.path, root));
  const changed = [Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), original]), Buffer.from(original.toString("utf8").replaceAll("\n", "\r\n")), original.subarray(0, original.length - 1), Buffer.concat([original, Buffer.from("\n")])];
  for (const raw of changed) assert.throws(() => referenceBytes(value.catalogue, raw));
  referenceBytes(value.catalogue, original);
});

test("a changed same-length migration cannot hide behind its name or byte count", async () => {
  const { value } = await snapshot();
  const row = value.migrations.at(-1), original = await readFile(new URL("supabase/migrations/" + row.file, root)), changed = Buffer.from(original);
  changed[0] ^= 1;
  assert.equal(changed.length, original.length);
  assert.throws(() => referenceBytes(row, changed));
  referenceBytes(row, original);
});

test("historical reference metadata cannot silently declare 27, reorder, duplicate or relocate a row", async () => {
  const { value } = await snapshot();
  for (const mutate of [
    rows => rows.push({ ...rows.at(-1), file: "20261024000000_unreviewed.sql", version: "20261024000000" }),
    rows => { [rows[0], rows[1]] = [rows[1], rows[0]]; },
    rows => { rows[1] = { ...rows[0] }; },
    rows => { rows[0].file = "../unreviewed.sql"; },
    rows => { rows[0].version = "20261024000000"; },
    rows => { rows[0].extra = true; },
  ]) {
    const rows = structuredClone(value.migrations);
    mutate(rows);
    assert.throws(() => historicalRows(rows));
  }
});

test("manifest byte or authority edits require explicit review of this immutable snapshot", async () => {
  const { raw, value } = await snapshot();
  const edited = structuredClone(value);
  edited.scope.currentReleaseValidated = true;
  assert.throws(() => pinnedManifest(Buffer.from(JSON.stringify(edited))));
  assert.throws(() => pinnedManifest(Buffer.concat([raw, Buffer.from("\n")])));
  pinnedManifest(raw);
});
