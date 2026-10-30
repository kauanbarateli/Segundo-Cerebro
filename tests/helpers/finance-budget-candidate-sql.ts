/** Disposable factory; source review/compilation is shared without a WASM import. */
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalCanonicalSql } from "./local-canonical-sql";
import { compileReviewedFinanceBudgetSql, readReviewedFinanceBudgetSources } from "./finance-budget-candidate-source";
export { FINANCE_BUDGET_REVIEW, compileReviewedFinanceBudgetSql, readReviewedFinanceBudgetSources } from "./finance-budget-candidate-source";
export type { FinanceBudgetCandidateSql } from "./finance-budget-candidate-source";

const root = fileURLToPath(new URL("../../", import.meta.url));
const lastCanonical = "20261022042501_spec08_capture_knowledge_promotion.sql";
export async function createFinanceBudgetCandidateSql() {
  const source = await readReviewedFinanceBudgetSources();
  const candidate = compileReviewedFinanceBudgetSql(source.patch, source.assertions);
  const migrations = (await readdir(resolve(root, "supabase/migrations"))).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
  if (migrations.length !== 25 || migrations.at(-1) !== lastCanonical) {
    throw new Error("Finance candidate requires the unchanged canonical001–025 boundary; later migrations need independent review.");
  }
  const db = await createLocalCanonicalSql();
  try {
    await db.exec(candidate.patch);
    return { db, assertions: candidate.assertions };
  } catch (error) { await db.close(); throw error; }
}
