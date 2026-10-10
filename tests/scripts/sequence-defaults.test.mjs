import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createCatalogueFixture } from "./helpers/catalogue-fixture.mjs";
import { assertReleaseReport } from "../../scripts/operations/release-checks.mjs";

const MIGRATION = "20261010010955_close_public_sequence_defaults.sql";
const source = path => readFile(new URL("../../" + path, import.meta.url), "utf8");

test("016 closes the legacy public sequence default without changing existing ACLs, other schemas or owners", async () => {
 const db = await createCatalogueFixture();
 try {
  const files = (await readdir(new URL("../../supabase/migrations/", import.meta.url)))
   .filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
  assert.ok(files.includes(MIGRATION));
  for (const file of files.filter(name => name < MIGRATION)) await db.exec(await source("supabase/migrations/" + file));
  const catalogue = await source("supabase/tests/release-catalog.sql");
  const assertion = await source("supabase/tests/sequence-defaults.sql");
  async function report() {
   const rows = (await db.exec(catalogue)).flatMap(value => value.rows);
   return assertReleaseReport(rows.map(row => row.jsonb_build_object).find(value => value?.version === 1));
  }
  const baseline = await report();assert.equal(baseline.ok, true);
  // Match the hosted finding: each of these four grantees has all three
  // sequence privileges (12 ACL entries); postgres is deliberately retained.
  await db.exec(`
   alter default privileges for role postgres in schema public grant all on sequences to postgres,anon,authenticated,service_role;
   create role t016_other_owner nologin;
   grant usage,create on schema public to t016_other_owner;
   alter default privileges for role t016_other_owner in schema public grant all on sequences to anon,authenticated,service_role;
   create sequence public.t016_existing_sequence_probe;
   grant all on sequence public.t016_existing_sequence_probe to public;
   create sequence auth.t016_existing_auth_probe;
   create sequence storage.t016_existing_storage_probe;
   grant all on sequence auth.t016_existing_auth_probe,storage.t016_existing_storage_probe to service_role;
   alter default privileges for role postgres in schema auth grant all on sequences to service_role;
   alter default privileges for role postgres in schema storage grant all on sequences to service_role;
   set role t016_other_owner;
   create sequence public.t016_other_owner_before;
   reset role;
  `);
  const stale = await report();
  assert.equal(stale.ok, false);
  assert.deepEqual(stale.deviations, [{ check: "default_acl_closed", object: "public.S" }]);
  assert.equal(stale.checks, baseline.checks + 1);
  const { rows: aclCount } = await db.query("select count(*)::integer as entries from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a where d.defaclrole='postgres'::regrole and d.defaclnamespace='public'::regnamespace and d.defaclobjtype='S'");
  assert.deepEqual(aclCount, [{ entries: 12 }]);
  await assert.rejects(db.exec(assertion), /future sequence closes anon/);
  await db.exec("rollback");
  assert.equal((await db.query("select to_regclass('public.t016_future_sequence_probe') is null as gone")).rows[0].gone, true);

  async function scope() {
   const { rows } = await db.query(`
    select jsonb_build_object(
     'other_defaults',(select coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',coalesce(n.nspname,'global'),'kind',d.defaclobjtype,'acl',d.defaclacl::text) order by d.defaclrole,d.defaclnamespace,d.defaclobjtype),'[]'::jsonb)
      from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
      where not(d.defaclrole='postgres'::regrole and d.defaclnamespace='public'::regnamespace and d.defaclobjtype='S')),
     'existing_sequences',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text) order by n.nspname,c.relname),'[]'::jsonb)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='S' and n.nspname in ('public','auth','storage')),
     'schemas',(select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text) order by nspname) from pg_namespace where nspname in ('public','app_private','auth','storage'))
    ) as scope;
   `);
   return rows[0].scope;
  }
  const before = await scope();
  const migration = await source("supabase/migrations/" + MIGRATION);
  await db.exec(migration);
  assert.deepEqual(await scope(), before);
  const reviewed = await report();
  assert.equal(reviewed.ok, true);assert.equal(reviewed.checks, stale.checks);assert.deepEqual(reviewed.deviations, []);
  const { rows: ownerAcl } = await db.query("select pg_get_userbyid(a.grantee) as grantee,a.privilege_type from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a where d.defaclrole='postgres'::regrole and d.defaclnamespace='public'::regnamespace and d.defaclobjtype='S' order by a.privilege_type");
  assert.deepEqual(ownerAcl, ["SELECT", "UPDATE", "USAGE"].map(privilege_type => ({ grantee: "postgres", privilege_type })));
  await db.exec(assertion);
  assert.equal((await db.query("select to_regclass('public.t016_future_sequence_probe') is null as gone")).rows[0].gone, true);
  assert.deepEqual(await scope(), before);

  // A future object by another creator or in a managed schema keeps the
  // unrelated fixture's explicitly granted defaults. 016 is not global.
  await db.exec(`
   begin;
   set local role t016_other_owner;create sequence public.t016_other_owner_after;reset role;
   create sequence auth.t016_future_auth_probe;create sequence storage.t016_future_storage_probe;
  `);
  for (const role of ["anon", "authenticated", "service_role"]) {
   assert.equal((await db.query("select has_sequence_privilege($1,'public.t016_other_owner_after','USAGE,SELECT,UPDATE') as allowed", [role])).rows[0].allowed, true);
  }
  for (const sequence of ["auth.t016_future_auth_probe", "storage.t016_future_storage_probe"]) {
   assert.equal((await db.query("select has_sequence_privilege('service_role',$1,'USAGE,SELECT,UPDATE') as allowed", [sequence])).rows[0].allowed, true);
  }
  await db.exec("rollback");assert.deepEqual(await scope(), before);

  // A schema REVOKE cannot subtract an unexpected global GRANT. The migration
  // must reject that separate drift, leaving every scope unchanged on rollback.
  await db.exec("alter default privileges for role postgres grant usage on sequences to anon");
  const globalBefore = await scope();
  await assert.rejects(db.exec(migration), /review global defaults separately/);
  await db.exec("rollback");assert.deepEqual(await scope(), globalBefore);
  await db.exec("alter default privileges for role postgres revoke usage on sequences from anon");
  assert.deepEqual(await scope(), before);assert.equal((await report()).ok, true);
  const { rows: residues } = await db.query("select (select count(*) from auth.users)::integer as users,(select count(*) from app_private.upload_reservations)::integer as reservations,(select count(*) from public.drive_files)::integer as files,(select count(*) from public.domain_events)::integer as events");
  assert.deepEqual(residues, [{ users: 0, reservations: 0, files: 0, events: 0 }]);
 } finally { await db.close(); }
});
