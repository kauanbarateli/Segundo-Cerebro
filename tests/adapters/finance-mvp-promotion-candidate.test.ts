/** Written candidate gates only. No hosted Auth/Storage, native race or release
 * acceptance is inferred from a disposable SQL-in-WASM execution. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { afterEach, expect, it, vi } from "vitest";
import { compileFinanceMvpPromotionCandidate, FINANCE_MVP_PROMOTION_ORDER, readFinanceMvpPromotionSources, type FinanceMvpPromotionSources } from "../helpers/finance-mvp-promotion-candidate-source";
import { createFinanceMvpPromotionCandidateSql, type FinanceMvpPromotionDatabase } from "../helpers/finance-mvp-promotion-candidate-sql";
import { compileReviewedFinanceBudgetSql } from "../helpers/finance-budget-candidate-source";
import { compileFinanceSeriesCandidate } from "../helpers/finance-series-candidate-source";
import { compileFinanceGoalsCandidate } from "../helpers/finance-goals-candidate-source";
import { compileFinanceGoalsImagesCandidate } from "../helpers/finance-goals-images-candidate-source";
import { compileFinanceGoalsTerminalCandidate } from "../helpers/finance-goals-terminal-candidate-source";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";

// Count actual constructor entry, without replacing the declarative loader.
vi.mock("../helpers/local-canonical-sql", async importOriginal => {
  const actual = await importOriginal<typeof import("../helpers/local-canonical-sql")>();
  return { ...actual, createLocalCanonicalSql: vi.fn(actual.createLocalCanonicalSql) };
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const forbidNetwork = () => vi.stubGlobal("fetch", () => { throw new Error("No network in the inert promotion candidate."); });
const close = "\ncommit;\n";

it("mechanically preserves compiled bodies, thirteen source gates and Budget assertions in the exact order", async () => {
  const sources = await readFinanceMvpPromotionSources(), candidate = compileFinanceMvpPromotionCandidate(sources);
  expect(candidate.stages.map(stage => stage.kind)).toEqual(FINANCE_MVP_PROMOTION_ORDER);
  expect(candidate.stages.map(stage => stage.reviews.length)).toEqual([1, 5, 5, 1, 1]);
  expect(candidate.companionCount).toBe(13); expect(candidate.canonicalCount).toBe(26);
  const budget = compileReviewedFinanceBudgetSql(sources.budget.patch, sources.budget.assertions);
  const budgetStage = candidate.stages[0]!;
  expect(budgetStage.body.replace("-- BEGIN PROPOSED MIGRATION BODY.\n", "-- BEGIN PROPOSED MIGRATION BODY.\nbegin;\n") + "commit;\n").toBe(budget.patch);
  const compiledGroups = [compileFinanceSeriesCandidate(sources.series), compileFinanceGoalsCandidate(sources.goals), compileFinanceGoalsImagesCandidate(sources.images), compileFinanceGoalsTerminalCandidate(sources.terminal)];
  for (const [index, original] of compiledGroups.entries()) expect("begin;\n" + candidate.stages[index + 1]!.body + close).toBe(original);
  expect(candidate.sql).toBe("begin;\n" + candidate.stages.map(stage => stage.body).join("\n\n") + close);
  expect(candidate.budgetAssertions).toBe(budget.assertions);
  expect(candidate.budgetAssertions).toContain("rollback;");
  expect(candidate.sql).not.toContain("DRAFT_NOT_AUTHORIZED_FOR_APPLICATION");
  expect(candidate.sql).not.toContain("$draft_only$");
  expect(vi.mocked(createLocalCanonicalSql)).not.toHaveBeenCalled();
});

it("refuses every altered companion, altered assertion and canonical drift before entering the DB constructor", async () => {
  const sources = await readFinanceMvpPromotionSources();
  const changes: FinanceMvpPromotionSources[] = [
    { ...sources, budget: { ...sources.budget, patch: sources.budget.patch + "\n-- altered" } },
    ...sources.series.map((_, selected) => ({ ...sources, series: sources.series.map((value, index) => value + (index === selected ? "\n-- altered" : "")) })),
    ...sources.goals.map((_, selected) => ({ ...sources, goals: sources.goals.map((value, index) => value + (index === selected ? "\n-- altered" : "")) })),
    { ...sources, images: sources.images + "\n-- altered" },
    { ...sources, terminal: sources.terminal + "\n-- altered" },
    { ...sources, budget: { ...sources.budget, assertions: sources.budget.assertions + "\n-- altered" } },
    { ...sources, canonical: sources.canonical.slice(0, -1) },
    { ...sources, canonical: sources.canonical.map((row, index) => index === 25 ? { ...row, source: row.source + "\n-- altered" } : row) },
  ];
  expect(changes).toHaveLength(16);
  for (const changed of changes) await expect(createFinanceMvpPromotionCandidateSql(changed)).rejects.toThrow();
  await expect(createFinanceMvpPromotionCandidateSql({ ...sources, series: [...sources.series].reverse() })).rejects.toThrow();
  await expect(createFinanceMvpPromotionCandidateSql({ ...sources, goals: sources.goals.slice(0, -1) })).rejects.toThrow();
  expect(vi.mocked(createLocalCanonicalSql)).not.toHaveBeenCalled();
});

// Synthetic catalogue definitions, not an expected release catalogue. OIDs are
// checked separately inside one upgrade; no cross-engine OID equivalence claim.
async function definitions(db: FinanceMvpPromotionDatabase): Promise<unknown> {
  const result = await db.query<{ catalog: unknown }>(`select jsonb_build_object(
    'relations',coalesce((select jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner),c.relacl::text) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind in ('r','p','v','m','S')), '[]'::jsonb),
    'columns',coalesce((select jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) order by n.nspname,c.relname,a.attnum)
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where n.nspname in ('public','app_private') and a.attnum>0 and not a.attisdropped), '[]'::jsonb),
    'constraints',coalesce((select jsonb_agg(jsonb_build_array(n.nspname,c.relname,k.conname,k.contype,k.condeferrable,k.condeferred,pg_get_constraintdef(k.oid,true)) order by n.nspname,c.relname,k.conname)
      from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and k.contype<>'n'), '[]'::jsonb),
    'functions',coalesce((select jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),p.proacl::text) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prokind<>'a'), '[]'::jsonb),
    'triggers',coalesce((select jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,t.tgenabled,t.tgtype,pg_get_triggerdef(t.oid,true)) order by n.nspname,c.relname,t.tgname)
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and not t.tgisinternal), '[]'::jsonb),
    'indexes',coalesce((select jsonb_agg(jsonb_build_array(schemaname,tablename,indexname,indexdef) order by schemaname,tablename,indexname) from pg_indexes where schemaname in ('public','app_private')), '[]'::jsonb),
    'policies',coalesce((select jsonb_agg(jsonb_build_array(schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check) order by schemaname,tablename,policyname) from pg_policies where schemaname in ('public','app_private')), '[]'::jsonb),
    'default_acl',coalesce((select jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype,d.defaclacl::text) order by pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype)
      from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace), '[]'::jsonb)
  ) catalog`);
  const row = result.rows[0]; if (!row) throw new Error("Missing synthetic catalogue."); return row.catalog;
}
async function bindings(db: FinanceMvpPromotionDatabase): Promise<unknown> {
  const result = await db.query<{ bindings: unknown }>(`select coalesce(jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.oid::text,pg_get_userbyid(p.proowner),p.proacl::text,p.prosecdef,p.proconfig) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb) bindings from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private')`);
  const row = result.rows[0]; if (!row) throw new Error("Missing synthetic function bindings."); return row.bindings;
}
async function executorBinding(db: FinanceMvpPromotionDatabase) {
  const rows = (await db.query<{ oid: number; owner: string; acl: string | null; definer: boolean; config: string[] | null }>(`select p.oid::int oid,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef definer,p.proconfig config from pg_proc p where p.oid='app_private.fg_commit(uuid,uuid,text,jsonb)'::regprocedure`)).rows;
  const row = rows[0]; if (!row) throw new Error("Missing Goals executor identity."); return row;
}
const identifier = (name: string) => '"' + name.replaceAll('"', '""') + '"';
async function material(db: FinanceMvpPromotionDatabase): Promise<Record<string, unknown[]>> {
  const tables = (await db.query<{ schema_name: string; table_name: string }>(`select n.nspname schema_name,c.relname table_name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private','auth','storage') and c.relkind in ('r','p') order by n.nspname,c.relname`)).rows;
  const rows: Record<string, unknown[]> = {};
  for (const table of tables) rows[table.schema_name + "." + table.table_name] = (await db.query(`select to_jsonb(t) value from ${identifier(table.schema_name)}.${identifier(table.table_name)} t order by to_jsonb(t)::text`)).rows;
  return rows;
}
function assertNoInstallData(before: Record<string, unknown[]>, after: Record<string, unknown[]>) {
  for (const [table, rows] of Object.entries(after)) expect(rows, table).toEqual(Object.hasOwn(before, table) ? before[table] : []);
  for (const table of Object.keys(before)) expect(Object.hasOwn(after, table), table).toBe(true);
}
async function baselineCatalogue(db: FinanceMvpPromotionDatabase) {
  const sql = await readFile(new URL("../../supabase/tests/release-catalog.sql", import.meta.url), "utf8");
  const rows = (await db.exec(sql)).flatMap(result => result.rows);
  expect(rows).toEqual([{ jsonb_build_object: { version: 1, ok: true, checks: 1720, deviations: [] } }]);
}
async function imageAndTerminalShape(db: FinanceMvpPromotionDatabase) {
  const rows = (await db.query(`select
    (select count(*)::int from pg_trigger where tgrelid='app_private.finance_goals'::regclass and tgname='goal_project' and tgfoid='app_private.fg_project()'::regprocedure and tgenabled='O' and tgtype=31 and not tgisinternal) original_projection,
    (select count(*)::int from pg_trigger where tgrelid='app_private.finance_goals'::regclass and tgname='goal_z_image_binding' and tgfoid='app_private.fgi_project()'::regprocedure and tgenabled='O' and tgtype=23 and not tgisinternal) image_binding,
    (select count(*)::int from pg_constraint where conrelid='app_private.finance_goals'::regclass and conname='finance_goals_image_owner_fk' and contype='f' and condeferrable and condeferred) owner_fk,
    position('finance_goals' in (select prosrc from pg_proc where oid='app_private.entity_image_referenced(uuid,uuid)'::regprocedure))>0 goals_are_holders,
    to_regprocedure('public.finance_goal_attempt_status(uuid,uuid,jsonb)') is not null terminal_status,
    to_regprocedure('public.finance_goal_attempt_settle(uuid,uuid,jsonb)') is not null terminal_settle,
    not exists(select 1 from pg_proc p where p.pronamespace='app_private'::regnamespace and p.proname in ('fg_image','fgi_project','fgi_previous_image_referenced','fg_terminal_previous_commit','fgt_request','fgt_status_locked') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))) private_helpers_closed`)).rows;
  expect(rows).toEqual([{ original_projection: 1, image_binding: 1, owner_fk: 1, goals_are_holders: true, terminal_status: true, terminal_settle: true, private_helpers_closed: true }]);
}


/** Diagnostic from a known disposable Source, never an observed hosted baseline.
 * The existing fresh engine already computed this schema before any user fixture.
 * No extra engine, data query, mutation, target, credential or release grant. */
async function recordSourceCompilerCatalogue(db: FinanceMvpPromotionDatabase, catalogue: unknown, sql: string) {
  if (process.env.GITHUB_ACTIONS !== "true") return;
  const timezone = process.env.TZ;
  if (timezone !== "UTC" && timezone !== "America/Sao_Paulo") throw new Error("Source catalogue timezone is not a declared CI case.");
  const sqlBytes = Buffer.byteLength(sql, "utf8"), sqlSha256 = createHash("sha256").update(sql).digest("hex");
  expect(sqlBytes).toBe(158010);
  expect(sqlSha256).toBe("f96d7a62b9337b9688c34ac471dd9fd326318e12d859817c263bb1ccf46d072a");
  const reviewed = await readFinanceMvpPromotionSources(), candidate = compileFinanceMvpPromotionCandidate(reviewed);
  expect(candidate.sql).toBe(sql);
  const engine = (await db.query<{
    version: string; server_version_num: number; search_path: string; effective_schemas: string[];
    function_defaults: { signature: string; found: boolean; argument_names: string[] | null; default_count: number | null; defaults: string | null }[];
    constraint_deparse: unknown[]; index_predicates: unknown[];
  }>(`
with wanted(signature) as (values
 ('app_private.fsv2_object(jsonb,text[],text[])'),
 ('app_private.fsv2_text(jsonb,integer,boolean)'),
 ('app_private.fsv2_aggregate(uuid,uuid,jsonb)'),
 ('app_private.fg_object(jsonb,text[],text[])'),
 ('app_private.fg_cents(numeric,numeric)'),
 ('app_private.fg_number(jsonb,numeric)'),
 ('app_private.fg_reserved(uuid,uuid,uuid)')
), wanted_relations(name) as (values
 ('app_private.finance_series'),('app_private.finance_series_occurrences'),
 ('app_private.finance_series_permits'),('app_private.finance_goals'),
 ('app_private.finance_goal_reservations'),('app_private.finance_goal_releases'),
 ('app_private.finance_goal_highlights'),('app_private.finance_goal_dispositions')
)
select pg_catalog.version() as version,
 pg_catalog.current_setting('server_version_num')::integer as server_version_num,
 pg_catalog.current_setting('search_path') as search_path,
 pg_catalog.current_schemas(true) as effective_schemas,
 coalesce((
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'signature',w.signature,'found',p.oid is not null,
   'argument_names',p.proargnames,'default_count',p.pronargdefaults,
   'defaults',pg_catalog.pg_get_expr(p.proargdefaults,0)
  ) order by w.signature)
  from wanted w left join pg_catalog.pg_proc p
   on p.oid=pg_catalog.to_regprocedure(w.signature)
 ),'[]'::jsonb) as function_defaults,
 coalesce((
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'relation',n.nspname||'.'||r.relname,'name',k.conname,'type',k.contype,
   'definition',pg_catalog.pg_get_constraintdef(k.oid),
   'pretty_definition',pg_catalog.pg_get_constraintdef(k.oid,true),
   'expression',pg_catalog.pg_get_expr(k.conbin,k.conrelid),
   'deferrable',k.condeferrable,'initially_deferred',k.condeferred,
   'validated',k.convalidated,'local',k.conislocal,'no_inherit',k.connoinherit,
   'inheritance_count',k.coninhcount,
   'constraint_triggers',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'name',t.tgname,'function',t.tgfoid::pg_catalog.regprocedure::text,
     'type',t.tgtype,'enabled',t.tgenabled,
     'deferrable',t.tgdeferrable,'initially_deferred',t.tginitdeferred
    ) order by t.tgname)
    from pg_catalog.pg_trigger t where t.tgconstraint=k.oid
   ),'[]'::jsonb)
  ) order by n.nspname,r.relname,k.conname)
  from pg_catalog.pg_constraint k
  join pg_catalog.pg_class r on r.oid=k.conrelid
  join pg_catalog.pg_namespace n on n.oid=r.relnamespace
  where (k.conrelid in (select pg_catalog.to_regclass(name) from wanted_relations) and k.contype<>'n')
   or (k.conrelid=pg_catalog.to_regclass('public.domain_events') and k.conname='domain_events_entity_type_check')
 ),'[]'::jsonb) as constraint_deparse,
 coalesce((
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'index',n.nspname||'.'||r.relname,
   'definition',pg_catalog.pg_get_indexdef(i.indexrelid),
   'predicate',pg_catalog.pg_get_expr(i.indpred,i.indrelid)
  ) order by n.nspname,r.relname)
  from pg_catalog.pg_index i
  join pg_catalog.pg_class r on r.oid=i.indexrelid
  join pg_catalog.pg_namespace n on n.oid=r.relnamespace
  where i.indexrelid=pg_catalog.to_regclass('app_private.finance_goals_owner_image')
 ),'[]'::jsonb) as index_predicates;
  `)).rows;
  expect(engine).toHaveLength(1);
  expect(engine[0]!.function_defaults).toHaveLength(7);
  expect(engine[0]!.function_defaults.every(row => row.found)).toBe(true);
  expect(engine[0]!.function_defaults.reduce((total, row) => total + (row.default_count ?? 0), 0)).toBe(8);
  const payload = {
    version: 1,
    kind: "disposable-source-compiler-catalogue",
    timezone,
    nodeVersion: process.versions.node,
    engine: engine[0],
    source: {
      proposedFilename: "20261024130000_finance_mvp_vertical.sql",
      bytes: sqlBytes, sha256: sqlSha256,
      canonical: reviewed.canonical.map(row => ({ file: row.file, bytes: Buffer.byteLength(row.source, "utf8"), sha256: createHash("sha256").update(row.source).digest("hex") })),
      companions: candidate.stages.flatMap(stage => stage.reviews),
    },
    catalogue,
    authority: { expectedBaseline: false, canonicalInstalled: false, hostedAccepted: false, restoreAccepted: false, mergeAllowed: false, productionDeployAllowed: false },
  };
  const bytes = Buffer.from(JSON.stringify(payload, null, 2) + "\n", "utf8");
  if (bytes.length > 5 * 1024 * 1024) throw new Error("Source catalogue diagnostic exceeds its finite limit.");
  const directory = new URL("../../work/ci-source-catalogues/finance027/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(timezone === "UTC" ? "UTC.json" : "America_Sao_Paulo.json", directory), bytes, { flag: "wx" });
}

it("matches fresh-candidate definitions on a 026 upgrade, preserves executor OID/ACL and creates no business data", async () => {
  forbidNetwork();
  const fresh = await createFinanceMvpPromotionCandidateSql(); let expected: unknown;
  try { await imageAndTerminalShape(fresh.db); expected = await definitions(fresh.db); await recordSourceCompilerCatalogue(fresh.db, expected, fresh.candidate.sql); }
  finally { await fresh.db.close(); }
  const sources = await readFinanceMvpPromotionSources(), candidate = compileFinanceMvpPromotionCandidate(sources), db = await createLocalCanonicalSql();
  try {
    await baselineCatalogue(db);
    // Explicit local Auth fixture proves installation preserves pre-existing
    // material; it is not a hosted identity, seed runner or financial mutation.
    await db.exec(`insert into auth.users(id,aud,role,email) values('00000000-0000-4000-8000-000000000901','authenticated','authenticated','promotion-fixture@example.invalid');`);
    const before = await material(db);
    await db.exec("begin;\n" + candidate.stages.slice(0, 3).map(stage => stage.body).join("\n\n"));
    const original = await executorBinding(db);
    await db.exec(candidate.stages[3]!.body); await db.exec(candidate.stages[4]!.body);
    expect(await executorBinding(db)).toEqual(original); // Same live transaction, not two-engine OID coincidence.
    await db.exec("commit;");
    expect(await definitions(db)).toEqual(expected);
    await imageAndTerminalShape(db); assertNoInstallData(before, await material(db));
  } finally { await db.close(); }
}, 180_000);

it("rolls every stage back on a late error before the only COMMIT, preserving 026 catalogue/OIDs/ACL/material", async () => {
  forbidNetwork();
  const candidate = compileFinanceMvpPromotionCandidate(await readFinanceMvpPromotionSources()), db = await createLocalCanonicalSql();
  try {
    await baselineCatalogue(db);
    await db.exec(`insert into auth.users(id,aud,role,email) values('00000000-0000-4000-8000-000000000902','authenticated','authenticated','rollback-fixture@example.invalid');`);
    const before = { definitions: await definitions(db), bindings: await bindings(db), material: await material(db) };
    expect(candidate.sql.endsWith(close)).toBe(true);
    const failure = candidate.sql.slice(0, -close.length) + "\ndo $promotion_failure$ begin raise exception 'MVP_PROMOTION_LATE_FAILURE' using errcode='23514'; end $promotion_failure$;" + close;
    await expect(db.exec(failure)).rejects.toMatchObject({ code: "23514", message: "MVP_PROMOTION_LATE_FAILURE" });
    await db.exec("rollback;");
    expect({ definitions: await definitions(db), bindings: await bindings(db), material: await material(db) }).toEqual(before);
    await baselineCatalogue(db);
  } finally { await db.close(); }
}, 180_000);

it("keeps reviewed Budget assertions separate and rolls all their fixtures back after the complete union", async () => {
  forbidNetwork(); const { db, candidate } = await createFinanceMvpPromotionCandidateSql();
  try {
    const before = await material(db), catalogue = await definitions(db), identities = await bindings(db);
    await db.exec(candidate.budgetAssertions);
    expect(await material(db)).toEqual(before); expect(await definitions(db)).toEqual(catalogue); expect(await bindings(db)).toEqual(identities);
    expect((await db.query(`select (select count(*)::int from pg_proc where pronamespace=pg_my_temp_schema() and proname like 'e7_%') temporary_functions,(select count(*)::int from pg_trigger where tgname like 't053_%') fixture_triggers`)).rows).toEqual([{ temporary_functions: 0, fixture_triggers: 0 }]);
  } finally { await db.close(); }
}, 180_000);
