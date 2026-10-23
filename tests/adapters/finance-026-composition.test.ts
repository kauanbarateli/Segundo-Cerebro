/** Public disposable composition only; no hosted migration, user or credential. */
import { afterEach, expect, it, vi } from "vitest";
import { assertFinance026Sources, createFinance026CandidateSql, FINANCE_026_CANONICAL_REVIEW, readFinance026Sources } from "../helpers/finance-026-candidate-sql";
import { createFinanceBudgetCandidateSql } from "../helpers/finance-budget-candidate-sql";
import { createFinanceSeriesCandidateSql } from "../helpers/finance-series-candidate-sql";
import { createFinanceGoalsCandidateSql } from "../helpers/finance-goals-candidate-sql";

afterEach(() => vi.unstubAllGlobals());
it("binds every canonical source and refuses later, missing, reordered and modified migrations", async () => {
  const rows = await readFinance026Sources();
  expect(rows).toHaveLength(26);
  expect(FINANCE_026_CANONICAL_REVIEW.at(-1)).toMatchObject({ file: "20261023061901_onboarding_foundation.sql", sha256: "e62727f4aa3a2f56948bf3a3c2f4ec24b1a8278ac3bef07591424b1ba422e697" });
  expect(() => assertFinance026Sources(rows.slice(0, -1))).toThrow("chain differs");
  expect(() => assertFinance026Sources([...rows, { file: "20261024000000_unreviewed.sql", source: "select 1;" }])).toThrow("chain differs");
  const reordered = [...rows]; [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
  expect(() => assertFinance026Sources(reordered)).toThrow("source differs");
  for (const index of [0, 5, 23, 25]) {
    const changed = [...rows]; changed[index] = { ...changed[index]!, source: changed[index]!.source + "\n-- changed" };
    expect(() => assertFinance026Sources(changed)).toThrow("source differs");
  }
});
it("preserves the closed historical 001–025 helpers instead of silently expanding them", async () => {
  vi.stubGlobal("fetch", () => { throw new Error("HTTP is forbidden in disposable composition."); });
  await expect(createFinanceBudgetCandidateSql()).rejects.toThrow("canonical001–025");
  await expect(createFinanceSeriesCandidateSql()).rejects.toThrow("canonical001–025");
  await expect(createFinanceGoalsCandidateSql()).rejects.toThrow("canonical001–025");
});
it("composes budget then B2 then Goals on026 without replacing onboarding or relaxing private grants", async () => {
  vi.stubGlobal("fetch", () => { throw new Error("No HTTP or hosted SQL fallback."); });
  const { db, assertions } = await createFinance026CandidateSql("complete");
  try {
    const catalog = (await db.query(`select
      to_regprocedure('public.onboarding_call(uuid,uuid,text,jsonb)') is not null as onboarding,
      position('onboarding_reserved_guard' in (select prosrc from pg_proc where oid='app_private.projects_habits_commit(uuid,uuid,text,jsonb)'::regprocedure))>0 as onboarding_guard,
      position('T053_INVALID_BUDGET_REPEAT' in (select prosrc from pg_proc where oid='app_private.finance_commit(uuid,uuid,text,jsonb)'::regprocedure))>0 as budget,
      encode(sha256(convert_to((select prosrc from pg_proc where oid='app_private.finance_snapshot(uuid,uuid,text)'::regprocedure),'UTF8')),'hex') as snapshot,
      exists(select 1 from pg_trigger where tgrelid='public.fin_transactions'::regclass and tgname='finance_series_guard' and not tgisinternal) as series_guard,
      exists(select 1 from pg_trigger where tgrelid='public.fin_accounts'::regclass and tgname='finance_reserved_balance_guard' and not tgisinternal) as reservation_guard,
      not exists(select 1 from pg_class c where c.relnamespace='app_private'::regnamespace and c.relname in ('finance_series','finance_series_occurrences','finance_series_permits','finance_goals','finance_goal_reservations','finance_goal_releases','finance_goal_highlights') and (not c.relrowsecurity or has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) as private_tables_closed`)).rows;
    expect(catalog).toEqual([{ onboarding: true, onboarding_guard: true, budget: true, snapshot: "3bc2076d42fcfe1d140cf24783de5acd679c52d5ddd47db68ba550a96300f3fb", series_guard: true, reservation_guard: true, private_tables_closed: true }]);
    expect(assertions).not.toBeNull();
    const state = async () => (await db.query(`select
      (select count(*)::int from auth.users) as users,
      (select count(*)::int from auth.sessions) as sessions,
      (select count(*)::int from public.profiles) as profiles,
      (select count(*)::int from public.fin_budgets) as budgets,
      (select count(*)::int from public.fin_categories) as categories,
      (select count(*)::int from public.fin_transactions) as ledger,
      (select count(*)::int from public.domain_events) as events,
      (select count(*)::int from app_private.command_receipts) as receipts,
      (select count(*)::int from app_private.finance_revisions) as revisions,
      (select count(*)::int from app_private.finance_series) as series,
      (select count(*)::int from app_private.finance_series_permits) as permits,
      (select count(*)::int from app_private.finance_goals) as goals,
      (select count(*)::int from app_private.finance_goal_reservations) as reservations,
      (select count(*)::int from app_private.finance_goal_releases) as releases,
      (select count(*)::int from app_private.onboarding_entries) as onboarding_entries,
      (select count(*)::int from pg_proc where pronamespace=pg_my_temp_schema() and proname like 'e7_%') as temporary_functions,
      (select count(*)::int from pg_trigger where tgname like 't053_%') as fixture_triggers`)).rows;
    const before = await state(); expect(Object.values(before[0]!).every(value => value === 0)).toBe(true);
    if (assertions === null) throw new Error("Missing budget assertions.");
    await db.exec(assertions);
    expect(await state()).toEqual(before);
  } finally { await db.close(); }
}, 180_000);
