/** Disposable SQL-in-WASM candidate only. No migration, target or release claim. */
import { createHistorical026CanonicalSql } from "./local-canonical-sql";
import { compileFinanceMvpPromotionCandidate, readFinanceMvpPromotionSources, type FinanceMvpPromotionSources } from "./finance-mvp-promotion-candidate-source";
export type FinanceMvpPromotionDatabase = Awaited<ReturnType<typeof createHistorical026CanonicalSql>>;

/** Optional input is only a public pinned source fixture for pre-DB negatives;
 * it cannot change a source pin, SQL body, canonical version or database target. */
export async function createFinanceMvpPromotionCandidateSql(sources?: FinanceMvpPromotionSources) {
  const candidate = compileFinanceMvpPromotionCandidate(sources ?? await readFinanceMvpPromotionSources());
  const db = await createHistorical026CanonicalSql();
  try {
    await db.exec(candidate.sql);
    return { db, candidate };
  } catch (error) {
    // A multi-statement failure may leave the outer transaction aborted. Close
    // the disposable engine even if rollback itself refuses; never return it.
    try { await db.exec("rollback;"); } catch { /* The original install still fails. */ }
    await db.close();
    throw error;
  }
}
