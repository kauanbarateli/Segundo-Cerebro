import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createCatalogueFixture } from "./helpers/catalogue-fixture.mjs";
import { assertReleaseReport } from "../../scripts/operations/release-checks.mjs";

const CLEANUP_MIGRATION = "20261009231338_file_cleanup_fairness.sql";
const CLEANUP_SHA256 = "57c5cd0cf62b5992b186850cef9690cb3fb10ef3e29180e8c1e0933a59a71d50";
const DEVIATION = { check: "reviewed_cleanup_definition", object: "app_private.file_cleanup_candidates()" };

test("readonly release catalogue requires the complete reviewed cleanup body, accepting only CRLF/LF transport changes", async () => {
 const db = await createCatalogueFixture();
 try {
  const files = (await readdir(new URL("../../supabase/migrations/", import.meta.url)))
   .filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
  assert.ok(files.includes(CLEANUP_MIGRATION));
  for (const file of files.filter(name => name < CLEANUP_MIGRATION)) {
   await db.exec(await readFile(new URL("../../supabase/migrations/" + file, import.meta.url), "utf8"));
  }
  const catalogue = await readFile(new URL("../../supabase/tests/release-catalog.sql", import.meta.url), "utf8");
  async function report() {
   const rows = (await db.exec(catalogue)).flatMap(result => result.rows);
   const value = rows.map(row => row.jsonb_build_object).find(item => item?.version === 1);
   return assertReleaseReport(value);
  }
  function assertStale(value) {
   assert.equal(value.ok, false);
   assert.equal(value.checks, 1243);
   assert.deepEqual(value.deviations, [DEVIATION]);
  }
  function assertReviewed(value) {
   assert.equal(value.ok, true);
   assert.equal(value.checks, 1243);
   assert.deepEqual(value.deviations, []);
  }

  // Same signatures/grants/policies and old ORDER BY passed the former checker.
  assertStale(await report());
  const migration = await readFile(new URL("../../supabase/migrations/" + CLEANUP_MIGRATION, import.meta.url), "utf8");
  await db.exec(migration);
  assertReviewed(await report());
  const { rows } = await db.query("select prosrc,encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex') as hash from pg_proc where oid='app_private.file_cleanup_candidates()'::regprocedure");
  assert.equal(rows[0].hash, CLEANUP_SHA256);
  assert.equal(createHash("sha256").update(rows[0].prosrc.replaceAll("\r\n", "\n"), "utf8").digest("hex"), CLEANUP_SHA256);
  const { rows: builtin } = await db.query("select n.nspname,not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') as independent from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid='pg_catalog.sha256(bytea)'::regprocedure");
  assert.deepEqual(builtin, [{ nspname: "pg_catalog", independent: true }]);

  const start = migration.indexOf("create or replace function app_private.file_cleanup_candidates()");
  assert.ok(start > 0);
  const definition = migration.slice(start, migration.lastIndexOf("commit;")).trimEnd();
  const lf = definition.replaceAll("\r\n", "\n");
  await db.exec(lf);assertReviewed(await report());
  await db.exec(lf.replaceAll("\n", "\r\n"));assertReviewed(await report());

  // Keep the approved ORDER BY but weaken a race recheck: a substring guard
  // would pass. The complete body must fail without changing public contracts.
  const weakened = lf.replace(" or reservation.lease_until>now() then continue;end if;", " then continue;end if;");
  assert.notEqual(weakened, lf);
  await db.exec(weakened);assertStale(await report());
  const commentChanged = lf.replace("declare candidate record;", "-- modified body comment\ndeclare candidate record;");
  assert.notEqual(commentChanged, lf);
  await db.exec(commentChanged);assertStale(await report());
  const leadingSpaceChanged = lf.replace("as $$\n", () => "as $$ \n");
  assert.notEqual(leadingSpaceChanged, lf);
  await db.exec(leadingSpaceChanged);assertStale(await report());
  await db.exec(definition);assertReviewed(await report());

  const { rows: residues } = await db.query("select (select count(*) from auth.users)::integer as users,(select count(*) from app_private.upload_reservations)::integer as reservations,(select count(*) from public.drive_files)::integer as files,(select count(*) from public.domain_events)::integer as events");
  assert.deepEqual(residues, [{ users: 0, reservations: 0, files: 0, events: 0 }]);
 } finally { await db.close(); }
});
