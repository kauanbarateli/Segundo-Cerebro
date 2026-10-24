/** Disposable WASM factory; pure source compiler retains the reviewed API. */
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalCanonicalSql } from "./local-canonical-sql";
import { compileFinanceSeriesCandidate, readFinanceSeriesCandidateSources } from "./finance-series-candidate-source";
export { FINANCE_SERIES_REVIEW, compileFinanceSeriesCandidate, readFinanceSeriesCandidateSources } from "./finance-series-candidate-source";

const root = fileURLToPath(new URL("../../", import.meta.url));
export async function createFinanceSeriesCandidateSql() {
  const files = (await readdir(resolve(root, "supabase/migrations"))).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
  if (files.length !== 25 || files.at(-1) !== "20261022042501_spec08_capture_knowledge_promotion.sql") throw new Error("Review the canonical001–025 boundary before installing this in-memory candidate.");
  const candidate = compileFinanceSeriesCandidate(await readFinanceSeriesCandidateSources());
  const db = await createLocalCanonicalSql();
  try { await db.exec(candidate); return db; } catch (error) { await db.close(); throw error; }
}
