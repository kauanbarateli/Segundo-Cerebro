/** Disposable WASM factory; source review is independently importable. */
import { createFinanceSeriesCandidateSql } from "./finance-series-candidate-sql";
import { compileFinanceGoalsCandidate, readFinanceGoalsCandidateSources } from "./finance-goals-candidate-source";
export { FINANCE_GOALS_REVIEW, compileFinanceGoalsCandidate, readFinanceGoalsCandidateSources } from "./finance-goals-candidate-source";
export async function createFinanceGoalsCandidateSql() {
  // Exact B2 source/filter/lock composition, never original855cff replacement.
  // Its helper enforces the current reviewed001–025 disposable boundary. Root
  // must explicitly reconcile026 before using a different canonical chain.
  const compiled = compileFinanceGoalsCandidate(await readFinanceGoalsCandidateSources()), db = await createFinanceSeriesCandidateSql();
  try { await db.exec(compiled); return db; } catch (error) { await db.close(); throw error; }
}
