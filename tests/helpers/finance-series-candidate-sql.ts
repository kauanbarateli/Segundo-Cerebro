/** In-memory reviewed candidate only; never a migration/deploy runner. */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalCanonicalSql } from "./local-canonical-sql";

const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = "proposals/finance-series-v2";
export const FINANCE_SERIES_REVIEW = Object.freeze([
  { file: "01-foundation.sql", sha256: "7697758efff8adc40c3b18986080aa1d486c4e547d3c5e04d6e8a61d4b9b8a3f" },
  { file: "02-read-models.sql", sha256: "ef7ade08c5e1f280909ad66ca32bf6ced37fe01039d18abc8dfd5cc3dfd136b1" },
  { file: "03-expected-effects.sql", sha256: "76f6d27987e05923d1c0c64bd59eb0d71650dea4f9e34faa8a1b75df4421d319" },
  { file: "04-commit.sql", sha256: "25c0ad4853b17ee2725a91b5f433bcb9990a892eab94c0939a4caf788eda03ba" },
  { file: "05-guards-and-v1-compat.sql", sha256: "6d49b5ef464f2bc5122da66623e5ea6bd0cf8a67392754cc6636aa2a24ca09b2" },
]);
const normalize = (source: string) => source.replaceAll("\r\n", "\n");
const digest = (source: string) => createHash("sha256").update(source).digest("hex");
export function compileFinanceSeriesCandidate(sources: readonly string[]) {
  if (sources.length !== FINANCE_SERIES_REVIEW.length) throw new Error("Missing reviewed series companion.");
  const bodies = sources.map((raw, index) => {
    const source = normalize(raw), review = FINANCE_SERIES_REVIEW[index]!;
    if (digest(source) !== review.sha256) throw new Error("Finance series candidate differs from reviewed bytes: " + review.file);
    const lines = source.split("\n"), draft = lines.filter(line => line.startsWith("do $draft_only$ begin raise exception 'DRAFT_ONLY:"));
    if (draft.length !== 1 || !draft[0]!.endsWith(";end $draft_only$;") || lines.filter(line => line === "begin;").length !== 1 || lines.filter(line => line === "rollback;").length !== 1 || lines.some(line => line === "commit;")) throw new Error("Series inert candidate boundaries changed.");
    const result = lines.filter(line => line !== draft[0] && line !== "begin;" && line !== "rollback;").join("\n");
    if (result.includes("$draft_only$") || result.includes("DRAFT_ONLY:")) throw new Error("Unreviewed draft boundary.");
    return result;
  });
  return "begin;\n" + bodies.join("\n\n") + "\ncommit;\n";
}
export async function readFinanceSeriesCandidateSources() { return Promise.all(FINANCE_SERIES_REVIEW.map(review => readFile(resolve(root, directory, review.file), "utf8"))); }
export async function createFinanceSeriesCandidateSql() {
  const files = (await readdir(resolve(root, "supabase/migrations"))).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
  if (files.length !== 25 || files.at(-1) !== "20261022042501_spec08_capture_knowledge_promotion.sql") throw new Error("Review the canonical001–025 boundary before installing this in-memory candidate.");
  const candidate = compileFinanceSeriesCandidate(await readFinanceSeriesCandidateSources());
  const db = await createLocalCanonicalSql();
  try { await db.exec(candidate); return db; } catch (error) { await db.close(); throw error; }
}
