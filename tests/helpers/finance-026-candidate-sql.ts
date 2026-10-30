/** Disposable WASM composition. Pure source guards keep the original public API. */
import { createHistorical026CanonicalSql } from "./local-canonical-sql";
import { compileReviewedFinanceBudgetSql, readReviewedFinanceBudgetSources } from "./finance-budget-candidate-source";
import { compileFinanceSeriesCandidate, readFinanceSeriesCandidateSources } from "./finance-series-candidate-source";
import { compileFinanceGoalsCandidate, readFinanceGoalsCandidateSources } from "./finance-goals-candidate-source";
import { readFinance026Sources } from "./finance-026-candidate-source";
export { FINANCE_026_CANONICAL_REVIEW, assertFinance026Sources, readFinance026Sources } from "./finance-026-candidate-source";
type Candidate = "budget" | "series" | "goals" | "complete";
export async function createFinance026CandidateSql(candidate: Candidate) {
  if (!["budget", "series", "goals", "complete"].includes(candidate)) throw new Error("Unknown disposable Finance026 composition.");
  await readFinance026Sources();
  const budget = await readReviewedFinanceBudgetSources();
  const budgetSql = compileReviewedFinanceBudgetSql(budget.patch, budget.assertions);
  const seriesSql = candidate !== "budget" ? compileFinanceSeriesCandidate(await readFinanceSeriesCandidateSources()) : null;
  const goalsSql = candidate === "goals" || candidate === "complete" ? compileFinanceGoalsCandidate(await readFinanceGoalsCandidateSources()) : null;
  // Only the existing declarative loader opens SQL-in-WASM, after all source gates.
  // No rewritten prosrc pin, fallback, hosted schema, reset or seed is introduced.
  const db = await createHistorical026CanonicalSql();
  try {
    await db.exec(budgetSql.patch);
    if (seriesSql) await db.exec(seriesSql);
    if (goalsSql) await db.exec(goalsSql);
    return { db, assertions: budgetSql?.assertions ?? null };
  } catch (error) { await db.close(); throw error; }
}
export async function createFinanceBudget026CandidateSql() {
  const result = await createFinance026CandidateSql("budget");
  if (result.assertions === null) { await result.db.close(); throw new Error("Missing reviewed budget assertions."); }
  return { db: result.db, assertions: result.assertions };
}
export async function createFinanceSeries026CandidateSql() { return (await createFinance026CandidateSql("series")).db; }
export async function createFinanceGoals026CandidateSql() { return (await createFinance026CandidateSql("goals")).db; }

