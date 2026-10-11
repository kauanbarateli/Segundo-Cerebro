import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createCatalogueFixture } from "./helpers/catalogue-fixture.mjs";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
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
  // This disposable drift fixture deliberately leaves only015's reviewed body
  // stale. Load later canonical dependencies so018 guards do not become an
  // unrelated deviation in this focused cleanup-body test. No hosted SQL runs.
  for (const file of files.filter(name => name > CLEANUP_MIGRATION)) {
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
   assert.equal(value.checks, 1251);
   assert.deepEqual(value.deviations, [DEVIATION]);
  }
  function assertReviewed(value) {
   assert.equal(value.ok, true);
   assert.equal(value.checks, 1251);
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

test("readonly catalogue binds018's two complete bodies and the immediate/deferred INSERT trigger topology",async()=>{
 const db=await createLocalCanonicalSql();try{
  const source=await readFile(new URL("../../supabase/tests/release-catalog.sql",import.meta.url),"utf8");
  const report=async()=>assertReleaseReport((await db.exec(source)).flatMap(r=>r.rows).map(r=>r.jsonb_build_object).find(v=>v?.version===1));
  const reviewed=async()=>{const v=await report();assert.equal(v.ok,true);assert.equal(v.checks,1251);assert.deepEqual(v.deviations,[]);};
  const rejected=async(check,object)=>{const v=await report();assert.equal(v.ok,false);assert.equal(v.checks,1251);assert.deepEqual(v.deviations,[{check,object}]);};
  await reviewed();
  for(const [signature,from,to,check]of[
   ["app_private.on_auth_user_created()","must_change_password=true","must_change_password=false","reviewed_admin_creation_fence"],
   ["app_private.check_admin_auth_creation_final()","and m.must_change_password","and true","reviewed_admin_creation_final"],
  ]){
   const definition=(await db.query("select pg_get_functiondef($1::regprocedure) as definition",[signature])).rows[0].definition;
   const weakened=definition.replace(from,to);assert.notEqual(weakened,definition);await db.exec(weakened);await rejected(check,signature);await db.exec(definition);await reviewed();
  }
  await db.exec("alter table auth.users disable trigger second_brain_identity_created");await rejected("admin_creation_fence_trigger","auth.second_brain_identity_created");await db.exec("alter table auth.users enable trigger second_brain_identity_created");await reviewed();
  await db.exec("drop trigger second_brain_admin_creation_final on auth.users;create constraint trigger second_brain_admin_creation_final after insert on auth.users deferrable initially immediate for each row execute function app_private.check_admin_auth_creation_final()");await rejected("admin_creation_final_trigger","auth.second_brain_admin_creation_final");
  await db.exec("drop trigger second_brain_admin_creation_final on auth.users;create constraint trigger second_brain_admin_creation_final after insert on auth.users deferrable initially deferred for each row execute function app_private.check_admin_auth_creation_final()");await reviewed();
  assert.equal((await db.query("select count(*)::integer as users from auth.users")).rows[0].users,0);
 }finally{await db.close();}
});
