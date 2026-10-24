/** Disposable SQL-in-WASM companion only; no URL, credentials or hosted runner. */
import { createFinanceGoals026CandidateSql } from "./finance-026-candidate-sql";
import { compileFinanceGoalsImagesCandidate, readFinanceGoalsImagesCandidateSource } from "./finance-goals-images-candidate-source";
export { FINANCE_GOALS_IMAGES_REVIEW, compileFinanceGoalsImagesCandidate, readFinanceGoalsImagesCandidateSource } from "./finance-goals-images-candidate-source";
export async function createFinanceGoalsImagesCandidateSql() {
  // Verify the new companion BEFORE opening WASM. The existing unmodified
  // helper verifies exactly001–026 and composes Budget→Series→Goals in order.
  const compiled = compileFinanceGoalsImagesCandidate(await readFinanceGoalsImagesCandidateSource());
  const db = await createFinanceGoals026CandidateSql();
  try { await db.exec(compiled); return db; } catch (error) { await db.close(); throw error; }
}
