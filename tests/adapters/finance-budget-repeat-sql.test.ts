/** Actual canonical PostgreSQL-in-WASM SQL; no mocked commit, hosted API,
 * native PostgreSQL process, service credential or migration application. */
import { afterEach, expect, it, vi } from "vitest";
import { compileReviewedFinanceBudgetSql, createFinanceBudgetCandidateSql, readReviewedFinanceBudgetSources } from "../helpers/finance-budget-candidate-sql";

afterEach(() => { vi.unstubAllGlobals(); });

it("refuses edited/unreviewed candidates instead of bypassing a draft or repinning the existing function", async () => {
  const source = await readReviewedFinanceBudgetSources();
  expect(() => compileReviewedFinanceBudgetSql(source.patch.replace("eac90c8853a494ff7c9ccfb5d7ac4663dfdede42733d0c5d3715019573cc245c", "0".repeat(64)), source.assertions)).toThrow("reviewed V2 bytes");
  expect(() => compileReviewedFinanceBudgetSql(source.patch.replace("raise exception", "-- raise exception"), source.assertions)).toThrow("reviewed V2 bytes");
  expect(() => compileReviewedFinanceBudgetSql(source.patch + "\ncommit;\n", source.assertions)).toThrow("reviewed V2 bytes");
  expect(() => compileReviewedFinanceBudgetSql(source.patch, source.assertions.replace("'T053_OTHER_CATEGORY_BEFORE_NO_EFFECT'", "'REMOVED_GUARD'"))).toThrow("reviewed V2 bytes");
});

it("V2 SQL commits12 budgets/events with one receipt and proves replay, BEFORE attacks and late rollback, then leaves no fixture data", async () => {
  vi.stubGlobal("fetch", () => { throw new Error("Finance SQL acceptance permits only installed local WASM and file bytes."); });
  const { db, assertions } = await createFinanceBudgetCandidateSql();
  try {
    // The independently reviewed SQL asserts the12 actual effects, exact paired
    // events/receipt, replay/stale, coherent category/month BEFORE attacks, and
    // rollback after11 rows and after all12 rows+events before the receipt.
    await db.exec(assertions);
    const state = await db.query<{
      users: number; sessions: number; profiles: number; roles: number;
      budgets: number; categories: number; transactions: number;
      events: number; receipts: number; revisions: number;
      temporaryFunctions: number; fixtureTriggers: number;
    }>(`select
      (select count(*)::integer from auth.users) as users,
      (select count(*)::integer from auth.sessions) as sessions,
      (select count(*)::integer from public.profiles) as profiles,
      (select count(*)::integer from public.user_roles) as roles,
      (select count(*)::integer from public.fin_budgets) as budgets,
      (select count(*)::integer from public.fin_categories) as categories,
      (select count(*)::integer from public.fin_transactions) as transactions,
      (select count(*)::integer from public.domain_events) as events,
      (select count(*)::integer from app_private.command_receipts) as receipts,
      (select count(*)::integer from app_private.finance_revisions) as revisions,
      (select count(*)::integer from pg_proc where pronamespace=pg_my_temp_schema() and proname like 'e7_%') as "temporaryFunctions",
      (select count(*)::integer from pg_trigger where tgname like 't053_%') as "fixtureTriggers"`);
    expect(state.rows).toEqual([{
      users: 0, sessions: 0, profiles: 0, roles: 0, budgets: 0, categories: 0,
      transactions: 0, events: 0, receipts: 0, revisions: 0,
      temporaryFunctions: 0, fixtureTriggers: 0,
    }]);
    const permissions = await db.query<{ owner: string; definer: boolean; configuration: string[]; service: boolean; anon: boolean; authenticated: boolean }>(`select
      pg_get_userbyid(p.proowner) as owner,p.prosecdef as definer,p.proconfig as configuration,
      has_function_privilege('service_role','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE') as service,
      has_function_privilege('anon','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE') as anon,
      has_function_privilege('authenticated','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE') as authenticated
      from pg_proc p where p.oid='app_private.finance_commit(uuid,uuid,text,jsonb)'::regprocedure`);
    expect(permissions.rows).toEqual([{ owner: "postgres", definer: true, configuration: ['search_path=""'], service: true, anon: false, authenticated: false }]);
  } finally { await db.close(); }
}, 180_000);
