/** EXTERNAL DRAFT tests. Written, not executed. No hosted target or release qualification.
 * The report extractor below validates protocol shape only, never a CURRENT27
 * source/count. Source-derived clean CURRENT27 must match the exact closed count.
 */
import { readFile } from "node:fs/promises";
import { afterEach, expect, it, vi } from "vitest";
import { createLocalCanonicalSql, createHistorical026CanonicalSql } from "../helpers/local-canonical-sql";
import { createFinanceMvpPromotionCandidateSql, type FinanceMvpPromotionDatabase } from "../helpers/finance-mvp-promotion-candidate-sql";
import { compileFinanceMvpPromotionCandidate, readFinanceMvpPromotionSources } from "../helpers/finance-mvp-promotion-candidate-source";

type Deviation = { check: string; object: string };
type Observation = { version: 1; ok: boolean; checks: number; deviations: Deviation[] };
const cataloguePath = new URL("../../supabase/tests/release-catalog.sql", import.meta.url);
const historicalPath = new URL("../fixtures/schema-release-026/release-catalog.sql", import.meta.url);
const expectedCurrent27Checks = 2512;
const eventObject = "public.domain_events.domain_events_entity_type_check";
afterEach(() => vi.unstubAllGlobals());
function noNetwork() { vi.stubGlobal("fetch", () => { throw new Error("No network in catalogue draft controls."); }); }
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid catalogue observation.");
  return value as Record<string, unknown>;
}
function observation(value: unknown): Observation {
  const row = record(value);
  if (Object.keys(row).sort().join(",") !== "checks,deviations,ok,version" || row.version !== 1 || typeof row.ok !== "boolean"
    || typeof row.checks !== "number" || !Number.isSafeInteger(row.checks) || row.checks < 1 || !Array.isArray(row.deviations)) throw new Error("Invalid catalogue observation.");
  const deviations = row.deviations.map(value => {
    const entry = record(value);
    if (Object.keys(entry).sort().join(",") !== "check,object" || typeof entry.check !== "string" || typeof entry.object !== "string") throw new Error("Invalid catalogue observation.");
    return { check: entry.check, object: entry.object };
  });
  return { version: 1, ok: row.ok, checks: row.checks, deviations };
}
async function observe(db: FinanceMvpPromotionDatabase, source?: string): Promise<Observation> {
  const results = await db.exec(source ?? await readFile(cataloguePath, "utf8"));
  const outputs: unknown[] = [];
  for (const result of results) for (const row of result.rows) if (Object.hasOwn(row, "jsonb_build_object")) outputs.push(row.jsonb_build_object);
  if (outputs.length !== 1) throw new Error("Catalogue must emit exactly one metadata row.");
  return observation(outputs[0]);
}
function specific(value: Observation, check: string, object: string) {
  expect(value.ok).toBe(false);
  expect(value.deviations).toContainEqual({ check, object });
}
async function candidate(work: (db: FinanceMvpPromotionDatabase) => Promise<void>) {
  noNetwork(); const { db } = await createFinanceMvpPromotionCandidateSql();
  try { await work(db); } finally { await db.close(); }
}
async function mutate(sql: string, check: string, object: string) {
  await candidate(async db => { await db.exec(sql); specific(await observe(db), check, object); });
}
function sameOid(before: string, after: string) { if (before !== after) throw new Error("UPGRADE_OID_CHANGED"); }

it("Source-derived CURRENT27 catalogue agrees on fresh CURRENT27 and historical026 upgrade", async () => {
  await candidate(async db => {
    expect(await observe(db)).toEqual({ version: 1, ok: true, checks: expectedCurrent27Checks, deviations: [] });
  });
  noNetwork(); const fresh = await createLocalCanonicalSql();
  try {
    expect(await observe(fresh)).toEqual({ version: 1, ok: true, checks: expectedCurrent27Checks, deviations: [] });
  } finally { await fresh.close(); }
  // This is a disposable known-source control, never acceptance of a hosted target.
}, 120_000);

it("N01 WRONG_RELEASE_026: current27 draft refuses missing finance relations and functions", async () => {
  noNetwork(); const db = await createHistorical026CanonicalSql();
  try {
    const result = await observe(db);
    specific(result, "finance27_relation", "app_private.finance_goals");
    specific(result, "finance27_function", "app_private.fgt_request(jsonb)");
  } finally { await db.close(); }
}, 60_000);

it("N02 WRONG_RELEASE_027_AS_026: unmodified historical026 catalogue refuses changed holder", async () => {
  await candidate(async db => {
    const result = await observe(db, await readFile(historicalPath, "utf8"));
    specific(result, "spec_evolution_function", "app_private.entity_image_referenced(uuid,uuid)");
  });
}, 60_000);

it("N03 PARTIAL_EACH_STAGE: no Budget/B2/Goals/E1 prefix qualifies without M1", async () => {
  noNetwork(); const sources = await readFinanceMvpPromotionSources(), compiled = compileFinanceMvpPromotionCandidate(sources);
  for (let length = 1; length < compiled.stages.length; length++) {
    const db = await createHistorical026CanonicalSql();
    try {
      await db.exec("begin;\n" + compiled.stages.slice(0, length).map(stage => stage.body).join("\n\n") + "\ncommit;\n");
      specific(await observe(db), "finance27_function", "app_private.fgt_request(jsonb)");
    } finally { await db.close(); }
  }
}, 180_000);

it("N04 OMIT_OR_REORDER_SOURCE: compiler refuses missing and reordered reviewed inputs before DB", async () => {
  const sources = await readFinanceMvpPromotionSources();
  expect(() => compileFinanceMvpPromotionCandidate({ ...sources, series: [...sources.series].reverse() })).toThrow();
  expect(() => compileFinanceMvpPromotionCandidate({ ...sources, goals: sources.goals.slice(0, -1) })).toThrow();
});

it("N05 SOURCE_DRIFT: one altered companion byte is refused by original compiler", async () => {
  const sources = await readFinanceMvpPromotionSources();
  expect(() => compileFinanceMvpPromotionCandidate({ ...sources, images: sources.images + "\n" })).toThrow();
  expect(() => compileFinanceMvpPromotionCandidate({ ...sources, budget: { ...sources.budget, patch: sources.budget.patch + "\n" } })).toThrow();
});

it("N06 BUDGET_BODY: a substituted commit body fails the exact source contract", async () => {
  await mutate("create or replace function app_private.finance_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin return null;end$$;",
    "finance27_function", "app_private.finance_commit(uuid,uuid,text,jsonb)");
}, 60_000);

it("N07 FINANCE_PROJECTION: reverting five-species projection fails the exact snapshot pin", async () => {
  await mutate(String.raw`do $negative$ declare source text;begin
 select prosrc into strict source from pg_proc where oid='app_private.finance_snapshot(uuid,uuid,text)'::regprocedure;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'3bc2076d42fcfe1d140cf24783de5acd679c52d5ddd47db68ba550a96300f3fb' then raise exception 'Negative source differs';end if;
 source:=replace(source,'entity_type in (''finance_account'',''finance_category'',''finance_tag'',''finance_transaction'',''finance_budget'')','entity_type like ''finance_%''');
 execute format('create or replace function app_private.finance_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb language plpgsql security definer set search_path='''' as %L',source);end $negative$;`,
    "finance27_function", "app_private.finance_snapshot(uuid,uuid,text)");
}, 60_000);

it("N08 EVENT_PREDICATE: a broad CHECK fails the exact complete Source predicate", async () => {
  await mutate("alter table public.domain_events drop constraint domain_events_entity_type_check;alter table public.domain_events add constraint domain_events_entity_type_check check(true);",
    "finance27_domain_events_predicate", eventObject);
}, 60_000);

it("N09 TABLE_COLUMN: an extra column is refused", async () => {
  await mutate("alter table app_private.finance_series add column unreviewed text;", "finance27_relation", "app_private.finance_series");
  await mutate("alter table app_private.finance_goal_dispositions alter column version set default 1;",
    "finance27_column_default", "app_private.finance_goal_dispositions.version");
}, 120_000);

it("N10 CONSTRAINT: changing the owner+file FK delete action is refused", async () => {
  await mutate("alter table app_private.finance_goals drop constraint finance_goals_image_owner_fk;alter table app_private.finance_goals add constraint finance_goals_image_owner_fk foreign key(user_id,image_file_id) references public.drive_files(user_id,id) on delete cascade deferrable initially deferred;",
    "finance27_constraint_set", "app_private.finance_goals");
  await mutate("drop trigger finance_series_permit_zero on app_private.finance_series_permits;",
    "finance27_constraint_definition", "app_private.finance_series_permits.finance_series_permit_zero");
  await mutate("drop trigger finance_series_permit_zero on app_private.finance_series_permits;create constraint trigger finance_series_permit_zero after insert or update on app_private.finance_series_permits deferrable initially immediate for each row execute function app_private.fsv2_permit_zero();",
    "finance27_constraint_definition", "app_private.finance_series_permits.finance_series_permit_zero");
}, 180_000);

it("N11 INDEX: missing global unique occurrence guard is refused", async () => {
  await mutate("drop index app_private.finance_series_transaction_guard;", "finance27_explicit_index", "finance_series_transaction_guard");
  await mutate("drop index app_private.finance_goals_owner_image;create index finance_goals_owner_image on app_private.finance_goals(user_id,image_file_id) where image_file_id is not null and user_id is not null;",
    "finance27_index_predicate", "app_private.finance_goals_owner_image");
}, 120_000);

it("N12 TRIGGER_DELETE: reducing goal_project31 to23 is refused", async () => {
  await mutate("drop trigger goal_project on app_private.finance_goals;create trigger goal_project before insert or update on app_private.finance_goals for each row execute function app_private.fg_project();",
    "finance27_trigger", "app_private.finance_goals.goal_project");
  await mutate("drop trigger finance_series_permit_zero on app_private.finance_series_permits;create trigger finance_series_permit_zero after insert or update on app_private.finance_series_permits for each row execute function app_private.fsv2_permit_zero();",
    "finance27_constraint_trigger_link", "app_private.finance_series_permits.finance_series_permit_zero");
  await candidate(async db => {
    // A second legal constraint trigger has its own pg_constraint row.
    await db.exec("create constraint trigger unreviewed_permit_zero after insert or update on app_private.finance_series_permits deferrable initially deferred for each row execute function app_private.fsv2_permit_zero();");
    const result = await observe(db);
    specific(result, "finance27_constraint_set", "app_private.finance_series_permits");
    specific(result, "finance27_trigger_set", "app_private.finance_series_permits");
  });
}, 120_000);

it("N13 RLS_OR_POLICY: disabled RLS and extra policy are independently refused", async () => {
  await mutate("alter table app_private.finance_goals disable row level security;", "finance27_relation", "app_private.finance_goals");
  await mutate("create policy unreviewed on app_private.finance_goals for select using(true);", "finance27_relation", "app_private.finance_goals");
}, 120_000);

it("N14 TABLE_COLUMN_GRANT: service table access remains closed", async () => {
  await mutate("grant select on app_private.finance_goals to service_role;", "service_table_closed", "app_private.finance_goals");
}, 60_000);

it("N15 PUBLIC_RPC: changing invoker authority is refused", async () => {
  await mutate("alter function public.finance_series_snapshot(uuid,uuid,jsonb) security definer;", "finance27_function", "public.finance_series_snapshot(uuid,uuid,jsonb)");
}, 60_000);

it("N16 PRIVATE_MAPPING: a fabricated same-name helper is refused even with owner-only ACL", async () => {
  await mutate("create function app_private.finance_series_fake() returns integer language sql set search_path='' as $$select 1$$;revoke all on function app_private.finance_series_fake() from public,anon,authenticated,service_role;",
    "finance27_helper_namespace_closed", "app_private.finance_series_fake()");
}, 60_000);

it("N17 CLONE_OR_FENCE_ACL: service_role cannot invoke the historical terminal executor", async () => {
  await mutate("grant execute on function app_private.fg_terminal_previous_commit(uuid,uuid,text,jsonb) to service_role;",
    "finance27_function", "app_private.fg_terminal_previous_commit(uuid,uuid,text,jsonb)");
}, 60_000);

it("N18 HOLDER_CHAIN: losing the preserved025/023 holder is refused", async () => {
  await mutate("create or replace function app_private.fgi_previous_image_referenced(p_user uuid,p_file uuid) returns boolean language sql stable security definer set search_path='' as $$select false$$;",
    "finance27_function", "app_private.fgi_previous_image_referenced(uuid,uuid)");
}, 60_000);

it("N19 OID_DROP_CREATE: the separate upgrade oracle rejects a new OID even if body/ACL match", async () => {
  await candidate(async db => {
    const before = await db.query<{ oid: string; definition: string }>("select oid::text,pg_get_functiondef(oid) definition from pg_proc where oid='app_private.finance_commit(uuid,uuid,text,jsonb)'::regprocedure");
    const original = before.rows[0]; if (!original) throw new Error("Missing original identity.");
    await db.exec("drop function app_private.finance_commit(uuid,uuid,text,jsonb);");
    await db.exec(original.definition);
    await db.exec("grant execute on function app_private.finance_commit(uuid,uuid,text,jsonb) to service_role;");
    const after = await db.query<{ oid: string }>("select 'app_private.finance_commit(uuid,uuid,text,jsonb)'::regprocedure::oid::text oid");
    const changed = after.rows[0]; if (!changed) throw new Error("Missing changed identity.");
    expect(() => sameOid(original.oid, changed.oid)).toThrow("UPGRADE_OID_CHANGED");
    // A final catalogue alone cannot reconstruct OID history.
  });
}, 60_000);

it("N20 DEFAULT_ACL: an API default EXECUTE grant is refused by unchanged026 checks", async () => {
  await mutate("alter default privileges for role postgres grant execute on functions to anon;", "default_acl_closed", "global.f");
}, 60_000);

it("N21 PARTIAL_INSTALL_FAILURE: a failure before COMMIT restores the exact historical catalogue", async () => {
  noNetwork(); const db = await createHistorical026CanonicalSql();
  try {
    const source = await readFile(historicalPath, "utf8");
    const before = await observe(db, source);
    expect(before.ok).toBe(true); expect(before.checks).toBe(1720); expect(before.deviations).toEqual([]);
    const candidate = compileFinanceMvpPromotionCandidate(await readFinanceMvpPromotionSources());
    const tail = "\ncommit;\n"; expect(candidate.sql.endsWith(tail)).toBe(true);
    await expect(db.exec(candidate.sql.slice(0, -tail.length) + "\nselect 1/0;\ncommit;\n")).rejects.toThrow();
    await db.exec("rollback;");
    expect(await observe(db, source)).toEqual(before);
  } finally { await db.close(); }
}, 60_000);

it("N22 WRONG_OUTPUT_PROTOCOL: extractor refuses changed version, extras, invalid counts", () => {
  // Shape extraction is not the Source reader or a release-count qualifier.
  const valid = { version: 1, ok: false, checks: 1, deviations: [{ check: "finance27_domain_events_predicate", object: eventObject }] };
  for (const bad of [{ ...valid, version: 2 }, { ...valid, expectedRelease: "027" }, { ...valid, checks: null }, { ...valid, checks: 1.5 }]) {
    expect(() => observation(bad)).toThrow("Invalid catalogue observation.");
  }
});

it("DEFAULT_EXPRESSION: changing only a reviewed argument default is refused", async () => {
  await mutate(String.raw`do $negative$ declare original text;changed text;begin
 select pg_get_functiondef('app_private.fg_cents(numeric,numeric)'::regprocedure) into strict original;
 changed:=replace(original,'minimum numeric DEFAULT 0','minimum numeric DEFAULT 1');
 if changed=original then raise exception 'Negative default anchor differs';end if;
 execute changed;end $negative$;`,
    "finance27_function_default", "app_private.fg_cents(numeric,numeric)");
}, 60_000);
