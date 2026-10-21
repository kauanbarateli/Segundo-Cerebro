import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createCatalogueFixture } from "./helpers/catalogue-fixture.mjs";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { assertReleaseReport } from "../../scripts/operations/release-checks.mjs";

const CLEANUP_MIGRATION = "20261009231338_file_cleanup_fairness.sql";
const CLEANUP_SHA256 = "90ab173a9f3c18b63370d4cab5589ec8dc7a11784286a0a30d001b8ff952faee";
const DEVIATION = { check: "reviewed_cleanup_definition", object: "app_private.file_cleanup_candidates()" };

test("readonly release catalogue requires the complete reviewed cleanup body, accepting only CRLF/LF transport changes", async () => {
 const db = await createLocalCanonicalSql();
 try {
  // Capture the complete current001–020 definition once. Restore the function,
  // never rerun020's additive table/trigger DDL in this drift fixture.
  const definition = (await db.query("select pg_get_functiondef('app_private.file_cleanup_candidates()'::regprocedure) as definition")).rows[0].definition;
  const catalogue = await readFile(new URL("../../supabase/tests/release-catalog.sql", import.meta.url), "utf8");
  async function report() {
   const rows = (await db.exec(catalogue)).flatMap(result => result.rows);
   const value = rows.map(row => row.jsonb_build_object).find(item => item?.version === 1);
   return assertReleaseReport(value);
  }
  function assertStale(value) {
   assert.equal(value.ok, false);
   assert.equal(value.checks, 1350);
   assert.deepEqual(value.deviations, [DEVIATION]);
  }
  function assertReviewed(value) {
   assert.equal(value.ok, true);
   assert.equal(value.checks, 1350);
   assert.deepEqual(value.deviations, []);
  }

  assertReviewed(await report());
  //015 alone has the same signature/grants but misses020's live image links.
  const migration = await readFile(new URL("../../supabase/migrations/" + CLEANUP_MIGRATION, import.meta.url), "utf8");
  const start = migration.indexOf("create or replace function app_private.file_cleanup_candidates()");
  assert.ok(start > 0);
  const legacy = migration.slice(start, migration.lastIndexOf("commit;")).trimEnd();
  await db.exec(legacy);assertStale(await report());
  await db.exec(definition);
  assertReviewed(await report());
  const { rows } = await db.query("select prosrc,encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex') as hash from pg_proc where oid='app_private.file_cleanup_candidates()'::regprocedure");
  assert.equal(rows[0].hash, CLEANUP_SHA256);
  assert.equal(createHash("sha256").update(rows[0].prosrc.replaceAll("\r\n", "\n"), "utf8").digest("hex"), CLEANUP_SHA256);
  const { rows: builtin } = await db.query("select n.nspname,not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') as independent from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid='pg_catalog.sha256(bytea)'::regprocedure");
  assert.deepEqual(builtin, [{ nspname: "pg_catalog", independent: true }]);

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
  const leadingSpaceChanged = lf.replace("AS $function$\n", () => "AS $function$ \n");
  assert.notEqual(leadingSpaceChanged, lf);
  await db.exec(leadingSpaceChanged);assertStale(await report());
  await db.exec(definition);assertReviewed(await report());

  const { rows: residues } = await db.query("select (select count(*) from auth.users)::integer as users,(select count(*) from app_private.upload_reservations)::integer as reservations,(select count(*) from public.drive_files)::integer as files,(select count(*) from public.domain_events)::integer as events");
  assert.deepEqual(residues, [{ users: 0, reservations: 0, files: 0, events: 0 }]);
 } finally { await db.close(); }
});

test("readonly catalogue rejects Habit image column, owner FK and history helper drift", async () => {
 const db = await createLocalCanonicalSql();
 try {
  const source = await readFile(new URL("../../supabase/tests/release-catalog.sql", import.meta.url), "utf8");
  const report = async () => assertReleaseReport((await db.exec(source)).flatMap(r => r.rows).map(r => r.jsonb_build_object).find(v => v?.version === 1));
  const reviewed = async () => { const value = await report(); assert.equal(value.ok, true); assert.equal(value.checks, 1350); assert.deepEqual(value.deviations, []); };
  const rejected = async (check, object) => { const value = await report(); assert.equal(value.ok, false); assert.equal(value.checks, 1350); assert.deepEqual(value.deviations, [{ check, object }]); };
  await reviewed();
  await db.exec("alter table public.habits alter column image_file_id set not null");
  await rejected("habit_image_column", "public.habits.image_file_id");
  await db.exec("alter table public.habits alter column image_file_id drop not null"); await reviewed();
  const fk = (await db.query("select pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.habits'::regclass and conname='habits_image_owner_fk'")).rows[0].definition;
  await db.exec("alter table public.habits drop constraint habits_image_owner_fk");
  await rejected("habit_image_owner_fk", "public.habits.habits_image_owner_fk");
  await db.exec("alter table public.habits add constraint habits_image_owner_fk " + fk); await reviewed();
  await db.exec("alter function app_private.habit_frequency_state(jsonb) stable");
  await rejected("habit_history_helpers", "app_private.habit_frequency");
  await db.exec("alter function app_private.habit_frequency_state(jsonb) immutable"); await reviewed();
 } finally { await db.close(); }
});

test("readonly catalogue binds018's two complete bodies and the immediate/deferred INSERT trigger topology",async()=>{
 const db=await createLocalCanonicalSql();try{
  const source=await readFile(new URL("../../supabase/tests/release-catalog.sql",import.meta.url),"utf8");
  const report=async()=>assertReleaseReport((await db.exec(source)).flatMap(r=>r.rows).map(r=>r.jsonb_build_object).find(v=>v?.version===1));
  const reviewed=async()=>{const v=await report();assert.equal(v.ok,true);assert.equal(v.checks,1350);assert.deepEqual(v.deviations,[]);};
  const rejected=async(check,object)=>{const v=await report();assert.equal(v.ok,false);assert.equal(v.checks,1350);assert.deepEqual(v.deviations,[{check,object}]);};
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

test("019 metadata remains own-session-only, bounded, nullable and read-only with rollback in both Auth fixtures",async()=>{
 const creators=[createLocalCanonicalSql,async()=>{
  const db=await createCatalogueFixture();try{
   const files=(await readdir(new URL("../../supabase/migrations/",import.meta.url))).filter(name=>/^\d{14}_.+\.sql$/.test(name)).sort();
   for(const name of files)await db.exec(await readFile(new URL("../../supabase/migrations/"+name,import.meta.url),"utf8"));return db;
  }catch(error){await db.close();throw error;}
 }];
 for(const create of creators){const db=await create();try{
  const source=await readFile(new URL("../../supabase/tests/release-catalog.sql",import.meta.url),"utf8");
  const value=assertReleaseReport((await db.exec(source)).flatMap(r=>r.rows).map(r=>r.jsonb_build_object).find(v=>v?.version===1));
  assert.equal(value.checks,1350);assert.equal(value.ok,true);assert.deepEqual(value.deviations,[]);
  await db.exec(await readFile(new URL("../../supabase/tests/own-sessions.sql",import.meta.url),"utf8"));
  assert.deepEqual((await db.query("select (select count(*)::int from auth.users) users,(select count(*)::int from auth.sessions) sessions,(select count(*)::int from public.domain_events) events,(select count(*)::int from app_private.command_receipts) receipts,(select count(*)::int from app_private.rate_limits) limits")).rows,[{users:0,sessions:0,events:0,receipts:0,limits:0}]);
  assert.equal((await db.query("select current_user role")).rows[0].role,"postgres");
 }finally{await db.close();}}
});

test("canonical catalogue rejects body, configuration, browser overload, official Auth type and direct privilege drift",async()=>{
 const db=await createLocalCanonicalSql();try{
  const source=await readFile(new URL("../../supabase/tests/release-catalog.sql",import.meta.url),"utf8");
  const report=async()=>assertReleaseReport((await db.exec(source)).flatMap(r=>r.rows).map(r=>r.jsonb_build_object).find(v=>v?.version===1));
  const reviewed=async()=>{const v=await report();assert.equal(v.ok,true);assert.equal(v.checks,1350);assert.deepEqual(v.deviations,[]);};
  const rejected=async(check,object)=>{const v=await report();assert.equal(v.ok,false);assert.equal(v.checks,1350);assert.deepEqual(v.deviations,[{check,object}]);};
  await reviewed();
  for(const[signature,from,to,check]of[
   ["app_private.my_sessions()","where s.user_id=v_user","where true","reviewed_own_sessions_helper"],
   ["public.my_sessions()","current_user<>'authenticated'","false","reviewed_own_sessions_wrapper"],
  ]){
   const definition=(await db.query("select pg_get_functiondef($1::regprocedure) definition",[signature])).rows[0].definition;
   const weakened=definition.replace(from,to);assert.notEqual(weakened,definition);await db.exec(weakened);await rejected(check,signature);
   await db.exec(definition);await reviewed();await db.exec(definition.replaceAll("\r\n","\n").replaceAll("\n","\r\n"));await reviewed();await db.exec(definition);
  }
  await db.exec("alter function app_private.my_sessions() volatile");await rejected("reviewed_own_sessions_helper","app_private.my_sessions()");await db.exec("alter function app_private.my_sessions() stable");
  await db.exec("alter function public.my_sessions() set work_mem='8MB'");await rejected("reviewed_own_sessions_wrapper","public.my_sessions()");await db.exec("alter function public.my_sessions() reset work_mem");await reviewed();
  await db.exec("create function public.my_sessions(p_scope text) returns jsonb language sql stable security invoker set search_path='' as $$select public.my_sessions()$$;grant execute on function public.my_sessions(text) to authenticated");
  // The extra function adds the four anonymous/path/browser/service checks.
  const overload=await report();assert.equal(overload.checks,1354);assert.equal(overload.ok,false);assert.deepEqual(overload.deviations,[{check:"browser_function_allowlist",object:"public.my_sessions(text)"}]);await db.exec("drop function public.my_sessions(text)");await reviewed();
  await db.exec("alter table auth.sessions alter column refreshed_at type timestamp with time zone using refreshed_at at time zone 'UTC'");await rejected("own_sessions_auth_types","auth.sessions");await db.exec("alter table auth.sessions alter column refreshed_at type timestamp without time zone using refreshed_at at time zone 'UTC'");
  await db.exec("alter table auth.sessions alter column refreshed_at set not null");await rejected("own_sessions_auth_types","auth.sessions");await db.exec("alter table auth.sessions alter column refreshed_at drop not null");
  for(const grant of["grant select on auth.sessions to authenticated","grant select(id) on auth.sessions to anon"]){await db.exec(grant);await rejected("own_sessions_direct_closed","auth.sessions");await db.exec("revoke all on auth.sessions from authenticated,anon;revoke select(id) on auth.sessions from authenticated,anon");await reviewed();}
  await db.exec("alter table auth.sessions disable row level security");await rejected("own_sessions_direct_closed","auth.sessions");await db.exec("alter table auth.sessions enable row level security");await reviewed();
 }finally{await db.close();}
});
