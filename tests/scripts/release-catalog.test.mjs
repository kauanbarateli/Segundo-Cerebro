import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createCatalogueFixture } from "./helpers/catalogue-fixture.mjs";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { assertReleaseReport } from "../../scripts/operations/release-checks.mjs";
import { readCurrent27CanonicalMigrations } from "../helpers/canonical-release-source.mjs";

const REVIEWED_RELEASE_CHECKS = 2512;
const exactGate = report => report.version === 1 && report.ok === true && report.checks === REVIEWED_RELEASE_CHECKS && report.deviations.length === 0;
const CLEANUP_MIGRATION = "20261009231338_file_cleanup_fairness.sql";
const CLEANUP_SHA256 = "90ab173a9f3c18b63370d4cab5589ec8dc7a11784286a0a30d001b8ff952faee";
const DEVIATION = { check: "reviewed_cleanup_definition", object: "app_private.file_cleanup_candidates()" };

test("readonly catalogue binds023–025 function contracts, physical metadata and image retainers", async () => {
 const db = await createLocalCanonicalSql();
 try {
  const source = await readFile(new URL("../../supabase/tests/release-catalog.sql", import.meta.url), "utf8");
  const report = async () => assertReleaseReport((await db.exec(source)).flatMap(r => r.rows).map(r => r.jsonb_build_object).find(v => v?.version === 1));
  const baseline = await report(); assert.equal(baseline.ok, true); assert.deepEqual(baseline.deviations, []); assert.equal(baseline.checks, REVIEWED_RELEASE_CHECKS); assert.equal(exactGate(baseline), true); assert.equal(exactGate(assertReleaseReport({ ...baseline, checks: 1720 })), false, "HIST026 count cannot satisfy the CURRENT27 release gate");
  // CURRENT27 count2512 is Source-derived from the reviewed catalogueV4.
  // A database observation or HIST026 count1720 cannot repin this expectation.
  const reviewed = async () => { const v = await report(); assert.equal(v.checks, baseline.checks); assert.equal(v.ok, true); assert.deepEqual(v.deviations, []); };
  const rejected = async (check, object) => {
   const v = await report(); assert.equal(v.checks, baseline.checks); assert.equal(v.ok, false);
   assert.ok(v.deviations.some(row => row.check === check && row.object === object), "the altered contract itself must be refused");
   if (check === "finance_card_projector_trigger" && object === "public.fin_accounts.finance_project") {
    assert.ok(v.deviations.some(row => row.check === "finance27_legacy_projection_trigger" && row.object === "public.fin_accounts"), "CURRENT27 must also refuse the same weakened projector");
   }
  };
  const definitionOf = async signature => (await db.query("select pg_get_functiondef($1::regprocedure) definition", [signature])).rows[0].definition;
  const change = async (mutation, restore, check, object) => {
   try { await db.exec(mutation); await rejected(check, object); }
   finally { await db.exec(restore); }
   await reviewed();
  };
  for (const [signature, from, to] of [
   ["app_private.calendar_attendee_pair_valid(jsonb)", "jsonb_array_length(p->'attendees')>200", "jsonb_array_length(p->'attendees')>201"],
   ["app_private.capture_e4_validate_document(jsonb)", "entry.total>10000", "entry.total>10001"],
   ["app_private.capture_e4_metadata(jsonb)", "jsonb_array_length(v)>6", "jsonb_array_length(v)>7"],
   ["app_private.capture_e4_image_holder(uuid,uuid,uuid,boolean)", "and f.purged_at is null", "and true"],
   ["app_private.capture_e4_previous_image_referenced(uuid,uuid)", "select exists", "select false and exists"],
   ["app_private.finance_card_metadata_guard()", "target.currency is distinct from new.payload->>'currency'", "false"],
   ["app_private.knowledge_image_read_metadata(uuid,uuid,uuid,uuid)", "if not app_private.capture_e4_image_holder(p_user,p_file,p_page,true)", "if false"],
   ["app_private.knowledge_commit(uuid,uuid,text,jsonb)", "perform app_private.capture_e4_knowledge_transition(p_user,p_operation,p_request);", "null;"],
   ["app_private.knowledge_document_text(jsonb,integer)", "if kind in ('wikiLink','captureLink') then", "if kind='wikiLink' then"],
  ]) {
   const definition = await definitionOf(signature), weakened = definition.replace(from, to); assert.notEqual(weakened, definition);
   await change(weakened, definition, "spec_evolution_function", signature);
  }
  for (const [signature, alteration] of [
   ["app_private.calendar_attendee_pair_valid(jsonb)", "stable"],
   ["app_private.capture_e4_validate_document(jsonb)", "security definer"],
   ["app_private.capture_e4_metadata(jsonb)", "strict"],
   ["app_private.capture_e4_promoted_document(jsonb,jsonb,jsonb)", "parallel safe"],
   ["app_private.capture_e4_promoted_node(jsonb,jsonb,jsonb,jsonb,integer)", "set work_mem='8MB'"],
  ]) await change("alter function " + signature + " " + alteration, await definitionOf(signature), "spec_evolution_function", signature);
  const holder = "app_private.capture_e4_image_holder(uuid,uuid,uuid,boolean)", holderDefinition = await definitionOf(holder);
  const widerDefault = holderDefinition.replace(/\bDEFAULT false\b/, "DEFAULT true"); assert.notEqual(widerDefault, holderDefinition);
  const body = (await db.query("select prosrc from pg_proc where oid=$1::regprocedure", [holder])).rows[0].prosrc;
  try {
   await db.exec(widerDefault);
   assert.equal((await db.query("select prosrc from pg_proc where oid=$1::regprocedure", [holder])).rows[0].prosrc, body, "a DEFAULT change does not change prosrc");
   await rejected("spec_evolution_function", holder);
  } finally { await db.exec(holderDefinition); }
  await reviewed();
  const pure = "app_private.calendar_attendee_pair_valid(jsonb)", pureDefinition = await definitionOf(pure);
  await change("create role spec08_catalogue_owner nologin;alter function " + pure + " owner to spec08_catalogue_owner", "alter function " + pure + " owner to postgres;drop role spec08_catalogue_owner", "spec_evolution_function", pure);
  await change("create role spec08_catalogue_extra nologin;grant execute on function " + pure + " to spec08_catalogue_extra", "revoke execute on function " + pure + " from spec08_catalogue_extra;drop role spec08_catalogue_extra", "spec_evolution_function", pure);
  await change("grant execute on function public.knowledge_image_read_metadata(uuid,uuid,uuid,uuid) to authenticated", "revoke execute on function public.knowledge_image_read_metadata(uuid,uuid,uuid,uuid) from authenticated", "spec_evolution_function", "public.knowledge_image_read_metadata(uuid,uuid,uuid,uuid)");
  // CRLF is the sole normalization allowed; it is a positive control.
  try { await db.exec(pureDefinition.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n")); await reviewed(); }
  finally { await db.exec(pureDefinition); }
  await reviewed();
  await change("alter table public.calendar_events alter column attendees set default '[]'::jsonb", "alter table public.calendar_events alter column attendees drop default", "calendar_attendee_columns", "public.calendar_events");
  await change("alter table public.calendar_events alter column attendees_omitted set not null", "alter table public.calendar_events alter column attendees_omitted drop not null", "calendar_attendee_columns", "public.calendar_events");
  await change("alter table app_private.google_calendar_cursors alter column attendees_version set default 1", "alter table app_private.google_calendar_cursors alter column attendees_version set default 0", "calendar_attendee_cursor", "app_private.google_calendar_cursors.attendees_version");
  const constraintChange = async (relation, name, replacement, check) => {
   const definition = (await db.query("select pg_get_constraintdef(oid) definition from pg_constraint where conrelid=$1::regclass and conname=$2", [relation, name])).rows[0].definition;
   const prefix = "alter table " + relation + " drop constraint " + name + ";alter table " + relation + " add constraint " + name + " ";
   await change(prefix + replacement, prefix + definition, check, relation + "." + name);
  };
  await constraintChange("public.calendar_events", "calendar_events_attendees_check", "check(attendees is null or jsonb_typeof(attendees)='array')", "calendar_attendee_check");
  await constraintChange("app_private.google_calendar_cursors", "google_calendar_cursors_attendees_version_check", "check(attendees_version in (0,1,2))", "calendar_attendee_cursor_check");
  await constraintChange("public.user_preferences", "user_preferences_default_calendar_view_check", "check(default_calendar_view in ('day','week','month','list','agenda'))", "calendar_list_preference");
  await change("alter table public.fin_accounts drop column last_four;alter table public.fin_accounts add column last_four text generated always as (payload->>'name') stored", "alter table public.fin_accounts drop column last_four;alter table public.fin_accounts add column last_four text generated always as (payload->>'last_four') stored", "finance_card_generated_columns", "public.fin_accounts");
  await constraintChange("public.fin_accounts", "fin_accounts_default_payment_owner_fk", "foreign key(user_id,default_payment_account_id) references public.fin_accounts(user_id,id) deferrable initially immediate", "finance_card_owner_fk");
  await change("alter table public.fin_accounts disable trigger zz_fin_accounts_card_metadata_guard", "alter table public.fin_accounts enable trigger zz_fin_accounts_card_metadata_guard", "finance_card_guard_trigger", "public.fin_accounts.zz_fin_accounts_card_metadata_guard");
  const guardDefinition = (await db.query("select pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='public.fin_accounts'::regclass and tgname='zz_fin_accounts_card_metadata_guard'")).rows[0].definition;
  await change("drop trigger zz_fin_accounts_card_metadata_guard on public.fin_accounts;create trigger zz_fin_accounts_card_metadata_guard before update on public.fin_accounts for each row execute function app_private.finance_card_metadata_guard()", "drop trigger zz_fin_accounts_card_metadata_guard on public.fin_accounts;" + guardDefinition, "finance_card_guard_trigger", "public.fin_accounts.zz_fin_accounts_card_metadata_guard");
  // UPDATE OF keeps tgtype23 but misses the real UPDATE SET payload writer.
  for (const [name, signature, check] of [
   ["zz_fin_accounts_card_metadata_guard", "app_private.finance_card_metadata_guard()", "finance_card_guard_trigger"],
   ["finance_project", "app_private.finance_project()", "finance_card_projector_trigger"],
  ]) {
   const definition = (await db.query("select pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='public.fin_accounts'::regclass and tgname=$1", [name])).rows[0].definition;
   const drop = "drop trigger " + name + " on public.fin_accounts;";
   await change(drop + "create trigger " + name + " before insert or update of name on public.fin_accounts for each row execute function " + signature, drop + definition, check, "public.fin_accounts." + name);
  }
  await change("alter table public.fin_accounts disable trigger finance_project", "alter table public.fin_accounts enable trigger finance_project", "finance_card_projector_trigger", "public.fin_accounts.finance_project");
  const residues = (await db.query("select (select count(*) from auth.users)::integer users,(select count(*) from public.domain_events)::integer events,(select count(*) from app_private.command_receipts)::integer receipts,(select count(*) from public.calendar_events)::integer calendars,(select count(*) from public.fin_accounts)::integer accounts")).rows;
  assert.deepEqual(residues, [{ users: 0, events: 0, receipts: 0, calendars: 0, accounts: 0 }]);
 } finally { await db.close(); }
});

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
   assert.equal(value.checks, REVIEWED_RELEASE_CHECKS);
   assert.deepEqual(value.deviations, [DEVIATION]);
  }
  function assertReviewed(value) {
   assert.equal(value.ok, true);
   assert.equal(value.checks, REVIEWED_RELEASE_CHECKS);
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
  const reviewed = async () => { const value = await report(); assert.equal(value.ok, true); assert.equal(value.checks, REVIEWED_RELEASE_CHECKS); assert.deepEqual(value.deviations, []); };
  const rejected = async (check, object) => { const value = await report(); assert.equal(value.ok, false); assert.equal(value.checks, REVIEWED_RELEASE_CHECKS); assert.deepEqual(value.deviations, [{ check, object }]); };
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

test("readonly catalogue binds Capture document bodies, private authority, trigger topology and physical capacities", async () => {
 const db = await createLocalCanonicalSql();
 try {
  const source = await readFile(new URL("../../supabase/tests/release-catalog.sql", import.meta.url), "utf8");
  const report = async () => assertReleaseReport((await db.exec(source)).flatMap(r => r.rows).map(r => r.jsonb_build_object).find(v => v?.version === 1));
  const baseline = await report(); assert.equal(baseline.ok, true); assert.deepEqual(baseline.deviations, []); assert.equal(baseline.checks, REVIEWED_RELEASE_CHECKS); assert.equal(exactGate(baseline), true); assert.equal(exactGate(assertReleaseReport({ ...baseline, checks: 1720 })), false, "HIST026 count cannot satisfy the CURRENT27 release gate");
  // CURRENT27 count2512 remains the independently reviewed Source expectation,
  // not an observed baseline count or a historical026 alias.
  const reviewed = async () => { const v = await report(); assert.equal(v.checks, baseline.checks); assert.equal(v.ok, true); assert.deepEqual(v.deviations, []); };
  const rejected = async (check, object) => { const v = await report(); assert.equal(v.checks, baseline.checks); assert.equal(v.ok, false); assert.deepEqual(v.deviations, [{ check, object }]); };
  for (const [signature, from, to] of [
   ["app_private.capture_task_timestamp(jsonb,boolean)", "if p_nullable and p_value='null'::jsonb", "if p_value='null'::jsonb"],
   ["app_private.capture_task_validate_payload_v1(text,jsonb)", "or octet_length(p::text)>1048576", "or octet_length(p::text)>2097152"],
   ["app_private.capture_document_validate(jsonb)", "if p->'content' is distinct from to_jsonb(expected_cache)", "if false and p->'content' is distinct from to_jsonb(expected_cache)"],
   ["app_private.capture_document_event_pair_allowed(uuid,uuid,text,uuid,text,text,timestamp with time zone,jsonb,jsonb,jsonb)", "if next_version<>previous_version", "if false and next_version<>previous_version"],
   ["app_private.capture_document_commit_transition(text,jsonb,jsonb)", "jsonb_array_length(p_changes)<>1", "jsonb_array_length(p_changes)<0"],
  ]) {
   const definition = (await db.query("select pg_get_functiondef($1::regprocedure) definition", [signature])).rows[0].definition;
   const weakened = definition.replace(from, to); assert.notEqual(weakened, definition);
   await db.exec(weakened); await rejected("capture_document_function", signature);
   await db.exec(definition); await reviewed();
   await db.exec(definition.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n")); await reviewed(); await db.exec(definition);
  }
  const timestampSignature = "app_private.capture_task_timestamp(jsonb,boolean)";
  const timestamp = (await db.query("select pg_get_functiondef($1::regprocedure) definition,prosrc from pg_proc where oid=$1::regprocedure", [timestampSignature])).rows[0];
  const nullableDefault = timestamp.definition.replace(/\bDEFAULT false\b/, "DEFAULT true"); assert.notEqual(nullableDefault, timestamp.definition);
  await db.exec(nullableDefault);
  const changedDefault = (await db.query("select prosrc,pronargdefaults,pg_get_expr(proargdefaults,0) defaults from pg_proc where oid=$1::regprocedure", [timestampSignature])).rows[0];
  assert.equal(changedDefault.prosrc, timestamp.prosrc, "DEFAULT drift is invisible to the reviewed body hash");
  assert.equal(changedDefault.pronargdefaults, 1); assert.equal(changedDefault.defaults, "true");
  await rejected("capture_document_function", timestampSignature);
  await db.exec(timestamp.definition); await reviewed();
  await db.exec("alter function app_private.capture_task_validate_payload_v1(text,jsonb) stable");
  await rejected("capture_document_function", "app_private.capture_task_validate_payload_v1(text,jsonb)");
  await db.exec("alter function app_private.capture_task_validate_payload_v1(text,jsonb) immutable"); await reviewed();
  const signature = "app_private.capture_document_event_state(jsonb)";
  await db.exec("alter function " + signature + " stable"); await rejected("capture_document_function", signature);
  await db.exec("alter function " + signature + " immutable"); await reviewed();
  await db.exec("alter function " + signature + " security definer"); await rejected("capture_document_function", signature);
  await db.exec("alter function " + signature + " security invoker"); await reviewed();
  await db.exec("alter function " + signature + " set work_mem='8MB'"); await rejected("capture_document_function", signature);
  await db.exec("alter function " + signature + " reset work_mem"); await reviewed();
  await db.exec("create role capture_document_owner nologin;alter function " + signature + " owner to capture_document_owner"); await rejected("capture_document_function", signature);
  await db.exec("alter function " + signature + " owner to postgres;drop role capture_document_owner"); await reviewed();
  await db.exec("grant execute on function " + signature + " to service_role");
  const exposed = await report(); assert.equal(exposed.ok, false); assert.equal(exposed.checks, baseline.checks);
  assert.deepEqual(exposed.deviations, [
   { check: "capture_document_function", object: signature },
   { check: "service_function_allowlist", object: "app_private." + signature },
  ]);
  await db.exec("revoke execute on function " + signature + " from service_role"); await reviewed();
  await db.exec("alter function app_private.capture_document_trim(text) rename to capture_document_trim_missing");
  await rejected("capture_document_function", "app_private.capture_document_trim(text)");
  await db.exec("alter function app_private.capture_document_trim_missing(text) rename to capture_document_trim"); await reviewed();
  const trigger = (await db.query("select pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='public.captures'::regclass and tgname='capture_document_row'")).rows[0].definition;
  await db.exec("alter table public.captures disable trigger capture_document_row"); await rejected("capture_document_trigger", "public.captures.capture_document_row");
  await db.exec("alter table public.captures enable trigger capture_document_row"); await reviewed();
  await db.exec("drop trigger capture_document_row on public.captures;create trigger capture_document_row before update on public.captures for each row execute function app_private.capture_document_row()");
  await rejected("capture_document_trigger", "public.captures.capture_document_row");
  await db.exec("drop trigger capture_document_row on public.captures;" + trigger); await reviewed();
  await db.exec("alter table app_private.command_receipts alter column request drop not null");
  await rejected("capture_document_receipt_columns", "app_private.command_receipts");
  await db.exec("alter table app_private.command_receipts alter column request set not null"); await reviewed();
  for (const [relation, query, check, object, replacement] of [
   ["public.domain_events", "select conname name,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.domain_events'::regclass and contype='c' and strpos(pg_get_expr(conbin,conrelid),'capture_document_event_pair_allowed(')>0", "capture_document_event_capacity", "public.domain_events", "check(coalesce(octet_length(before::text),0)+coalesce(octet_length(after::text),0)<=2097152)"],
   ["app_private.command_receipts", "select conname name,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='app_private.command_receipts'::regclass and conname='command_receipts_check'", "capture_document_receipt_capacity", "app_private.command_receipts.command_receipts_check", "check(octet_length(request::text)<=2097152 and octet_length(result::text)<=1048576)"],
  ]) {
   const rows = (await db.query(query)).rows; assert.equal(rows.length, 1);
   const quote = '"' + rows[0].name.replaceAll('"', '""') + '"';
   await db.exec("alter table " + relation + " drop constraint " + quote + ";alter table " + relation + " add constraint " + quote + " " + replacement);
   await rejected(check, object);
   await db.exec("alter table " + relation + " drop constraint " + quote + ";alter table " + relation + " add constraint " + quote + " " + rows[0].definition); await reviewed();
  }
 } finally { await db.close(); }
});

test("readonly catalogue binds018's two complete bodies and the immediate/deferred INSERT trigger topology",async()=>{
 const db=await createLocalCanonicalSql();try{
  const source=await readFile(new URL("../../supabase/tests/release-catalog.sql",import.meta.url),"utf8");
  const report=async()=>assertReleaseReport((await db.exec(source)).flatMap(r=>r.rows).map(r=>r.jsonb_build_object).find(v=>v?.version===1));
  const reviewed=async()=>{const v=await report();assert.equal(v.ok,true);assert.equal(v.checks,REVIEWED_RELEASE_CHECKS);assert.deepEqual(v.deviations,[]);};
  const rejected=async(check,object)=>{const v=await report();assert.equal(v.ok,false);assert.equal(v.checks,REVIEWED_RELEASE_CHECKS);assert.deepEqual(v.deviations,[{check,object}]);};
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
  const migrations=await readCurrent27CanonicalMigrations();
  const db=await createCatalogueFixture();try{
   assert.equal(migrations.length,27);
   for(const row of migrations)await db.exec(row.source.toString("utf8"));return db;
  }catch(error){await db.close();throw error;}
 }];
 for(const create of creators){const db=await create();try{
  const source=await readFile(new URL("../../supabase/tests/release-catalog.sql",import.meta.url),"utf8");
  const value=assertReleaseReport((await db.exec(source)).flatMap(r=>r.rows).map(r=>r.jsonb_build_object).find(v=>v?.version===1));
  assert.equal(value.checks,REVIEWED_RELEASE_CHECKS);assert.equal(value.ok,true);assert.deepEqual(value.deviations,[]);
  await db.exec(await readFile(new URL("../../supabase/tests/own-sessions.sql",import.meta.url),"utf8"));
  assert.deepEqual((await db.query("select (select count(*)::int from auth.users) users,(select count(*)::int from auth.sessions) sessions,(select count(*)::int from public.domain_events) events,(select count(*)::int from app_private.command_receipts) receipts,(select count(*)::int from app_private.rate_limits) limits")).rows,[{users:0,sessions:0,events:0,receipts:0,limits:0}]);
  assert.equal((await db.query("select current_user role")).rows[0].role,"postgres");
 }finally{await db.close();}}
});

test("canonical catalogue rejects body, configuration, browser overload, official Auth type and direct privilege drift",async()=>{
 const db=await createLocalCanonicalSql();try{
  const source=await readFile(new URL("../../supabase/tests/release-catalog.sql",import.meta.url),"utf8");
  const report=async()=>assertReleaseReport((await db.exec(source)).flatMap(r=>r.rows).map(r=>r.jsonb_build_object).find(v=>v?.version===1));
  const reviewed=async()=>{const v=await report();assert.equal(v.ok,true);assert.equal(v.checks,REVIEWED_RELEASE_CHECKS);assert.deepEqual(v.deviations,[]);};
  const rejected=async(check,object)=>{const v=await report();assert.equal(v.ok,false);assert.equal(v.checks,REVIEWED_RELEASE_CHECKS);assert.deepEqual(v.deviations,[{check,object}]);};
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
  const overload=await report();assert.equal(overload.checks,REVIEWED_RELEASE_CHECKS+4);assert.equal(overload.ok,false);assert.deepEqual(overload.deviations,[{check:"browser_function_allowlist",object:"public.my_sessions(text)"}]);await db.exec("drop function public.my_sessions(text)");await reviewed();
  await db.exec("alter table auth.sessions alter column refreshed_at type timestamp with time zone using refreshed_at at time zone 'UTC'");await rejected("own_sessions_auth_types","auth.sessions");await db.exec("alter table auth.sessions alter column refreshed_at type timestamp without time zone using refreshed_at at time zone 'UTC'");
  await db.exec("alter table auth.sessions alter column refreshed_at set not null");await rejected("own_sessions_auth_types","auth.sessions");await db.exec("alter table auth.sessions alter column refreshed_at drop not null");
  for(const grant of["grant select on auth.sessions to authenticated","grant select(id) on auth.sessions to anon"]){await db.exec(grant);await rejected("own_sessions_direct_closed","auth.sessions");await db.exec("revoke all on auth.sessions from authenticated,anon;revoke select(id) on auth.sessions from authenticated,anon");await reviewed();}
  await db.exec("alter table auth.sessions disable row level security");await rejected("own_sessions_direct_closed","auth.sessions");await db.exec("alter table auth.sessions enable row level security");await reviewed();
 }finally{await db.close();}
});
