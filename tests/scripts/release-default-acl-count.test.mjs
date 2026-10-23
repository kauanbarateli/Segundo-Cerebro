/** Semantic count normalization; SQL-in-WASM only, no services or credentials. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { assertReleaseReport } from "../../scripts/operations/release-checks.mjs";

const catalogueUrl = new URL("../../supabase/tests/release-catalog.sql", import.meta.url);
const diagnosticUrl = new URL("../../supabase/tests/release-default-acl-observation.sql", import.meta.url);
const normalizedCount = "count(*) filter(where not (check_name='default_acl_closed' and ok is true and object_name in(select object_name from redundant_owner_default_acl)))";
function predicate(source) {
 const start = " select 'public.'||d.defaclobjtype::text from pg_default_acl d";
 assert.equal(source.split(start).length, 2, "exactly one reviewed SELECT predicate");
 const begin = source.indexOf(start), end = source.indexOf("\n),", begin);
 assert.ok(end > begin); return source.slice(begin, end);
}
const exactGate = report => report.version === 1 && report.ok === true && report.checks === 1720 && report.deviations.length === 0;

test("only the closed nonempty owner-only postgres/public.r,f,S classes normalize COUNT, never checks/deviations", async () => {
 const source = await readFile(catalogueUrl, "utf8"), diagnostic = await readFile(diagnosticUrl, "utf8"), select = predicate(source);
 assert.equal(predicate(diagnostic), select, "diagnostic and release use one exact predicate contract");
 assert.match(source, /begin transaction read only;/); assert.match(source, /rollback;\s*$/);
 assert.match(diagnostic, /begin transaction read only;/); assert.match(diagnostic, /rollback;\s*$/);
 assert.equal(source.split(normalizedCount).length, 2);
 assert.match(source, /'ok',bool_and\(ok is true\)/);
 assert.match(source, /'deviations',coalesce\(jsonb_agg\([\s\S]*filter\(where ok is distinct from true\)/);
 // Pure catalogue-predicate controls. No system-catalog UPDATE is used to
 // fabricate a different grantor/owner, and no duplicate implementation exists.
 const db = await createLocalCanonicalSql();
 try {
  await db.exec("create role catalogue_count_other nologin");
  const run = async ({ scope = "'public'::regnamespace", kind = "r", owner = "'postgres'::regrole", grantee = "'postgres'::regrole", grantor = "'postgres'::regrole", empty = false } = {}) => {
   const acl = empty ? "array[]::aclitem[]" : "array[makeaclitem(" + grantee + "::oid," + grantor + "::oid,'SELECT',false)]";
   const from = "from (select " + owner + "::oid defaclrole," + scope + "::oid defaclnamespace,'" + kind + "'::\"char\" defaclobjtype," + acl + " defaclacl) d";
   return (await db.query("select * from (" + select.replace("from pg_default_acl d", from) + ") tested(object_name)")).rows;
  };
  for (const kind of ["r", "f", "S"]) assert.deepEqual(await run({ kind }), [{ object_name: "public." + kind }]);
  for (const input of [
   { empty: true }, { scope: "'app_private'::regnamespace" }, { scope: "0" }, { kind: "T" }, { kind: "n" },
   { owner: "'catalogue_count_other'::regrole" }, { grantor: "'catalogue_count_other'::regrole" },
   { grantee: "0" }, { grantee: "'anon'::regrole" }, { grantee: "'authenticated'::regrole" }, { grantee: "'service_role'::regrole" }, { grantee: "'catalogue_count_other'::regrole" },
  ]) assert.deepEqual(await run(input), [], "unknown or invalid class must never be normalized");
 } finally { await db.close(); }
});

test("three native-style owner defaults retain1720; every API grant remains a deviation and unknown classes keep their count", async () => {
 const source = await readFile(catalogueUrl, "utf8"), diagnostic = await readFile(diagnosticUrl, "utf8");
 assert.equal(source.split(normalizedCount).length, 2); const rawSource = source.replace(normalizedCount, "count(*)");
 const db = await createLocalCanonicalSql();
 try {
  const report = async (sql = source) => {
   const values = (await db.exec(sql)).flatMap(result => result.rows).map(row => row.jsonb_build_object).filter(value => value?.version === 1);
   assert.equal(values.length, 1); return assertReleaseReport(values[0]);
  };
  const baseline = await report(); assert.equal(exactGate(baseline), true);
  const reviewed = async () => { const value = await report(); assert.deepEqual(value, baseline); assert.equal(exactGate(value), true); };
  for (const kind of ["tables", "functions", "sequences"]) await db.exec("alter default privileges for role postgres in schema public grant all on " + kind + " to postgres");
  await reviewed(); assert.equal((await report(rawSource)).checks, baseline.checks + 3, "all three actual rows/checks are still present");
  for (const [kind, key] of [["tables", "r"], ["functions", "f"], ["sequences", "S"]]) {
   for (const role of ["public", "anon", "authenticated", "service_role"]) {
    try {
     await db.exec("alter default privileges for role postgres in schema public grant all on " + kind + " to " + role);
     const bad = await report(); assert.equal(bad.ok, false); assert.equal(exactGate(bad), false); assert.equal(bad.checks, baseline.checks + 1, "invalid row must count again");
     assert.ok(bad.deviations.some(item => item.check === "default_acl_closed" && item.object === "public." + key));
    } finally { await db.exec("alter default privileges for role postgres in schema public revoke all on " + kind + " from " + role); }
    await reviewed();
   }
  }
  await db.exec("create role catalogue_count_other nologin");
  try {
   await db.exec("alter default privileges for role postgres in schema public grant select on tables to catalogue_count_other");
   const unknown = await report(); assert.equal(unknown.ok, true, "a harmless unknown grantee is not falsely relabeled an API grant"); assert.equal(unknown.checks, baseline.checks + 1); assert.equal(exactGate(unknown), false, "unknown classes fail the unchanged strict gate");
   const diagnostics = (await db.exec(diagnostic)).flatMap(result => result.rows).map(row => row.jsonb_build_object).filter(value => value?.scenario === "release-default-acl-observation");
   assert.equal(diagnostics.length, 1); assert.deepEqual(Object.keys(diagnostics[0]).sort(), ["rows", "scenario", "version"]); assert.equal(diagnostics[0].version, 1);
   assert.equal(new Set(diagnostics[0].rows.map(row => row.scope + "." + row.kind)).size, diagnostics[0].rows.length);
   for (const row of diagnostics[0].rows) {
    assert.deepEqual(Object.keys(row).sort(), ["aclSha256", "entryCount", "forbiddenEntryCount", "foreignGranteeCount", "foreignGrantorCount", "kind", "normalizationCandidate", "scope"]);
    assert.match(row.aclSha256, /^[a-f0-9]{64}$/); assert.ok(["global", "public", "app_private"].includes(row.scope)); assert.ok(["r", "f", "S", "T", "n"].includes(row.kind));
    for (const key of ["entryCount", "forbiddenEntryCount", "foreignGranteeCount", "foreignGrantorCount"]) assert.ok(Number.isSafeInteger(row[key]) && row[key] >= 0);
    assert.equal(typeof row.normalizationCandidate, "boolean");
   }
   const changed = diagnostics[0].rows.find(row => row.scope === "public" && row.kind === "r");
   assert.equal(changed.normalizationCandidate, false); assert.equal(changed.foreignGranteeCount, 1);
   assert.equal(JSON.stringify(diagnostics[0]).includes("catalogue_count_other"), false, "no arbitrary principal name in observation");
  } finally {
   await db.exec("alter default privileges for role postgres in schema public revoke all on tables from catalogue_count_other;drop role catalogue_count_other");
  }
  await reviewed();
  for (const [grant, restore] of [
   ["alter default privileges for role postgres in schema public grant usage on types to postgres", "alter default privileges for role postgres in schema public revoke all on types from postgres"],
   ["alter default privileges for role postgres in schema app_private grant execute on functions to postgres", "alter default privileges for role postgres in schema app_private revoke all on functions from postgres"],
  ]) {
   try { await db.exec(grant); const unknown = await report(); assert.equal(unknown.checks, baseline.checks + 1); assert.equal(exactGate(unknown), false); }
   finally { await db.exec(restore); }
   await reviewed();
  }
  const residue = (await db.query("select (select count(*)::int from auth.users) users,(select count(*)::int from public.domain_events) events,(select count(*)::int from app_private.command_receipts) receipts")).rows;
  assert.deepEqual(residue, [{ users: 0, events: 0, receipts: 0 }]);
 } finally { await db.close(); }
});
