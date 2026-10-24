/** Disposable SQL-in-WASM companion only; no URL, credentials or hosted runner. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createFinanceGoals026CandidateSql } from "./finance-026-candidate-sql";

export const FINANCE_GOALS_IMAGES_REVIEW = Object.freeze({
  file: "01-binding-and-lifecycle.sql",
  sha256: "0d6ca0db3711d4c4899e794ba52ba34c6ed15e10ae834170ea9a5965efeadec9",
});
export function compileFinanceGoalsImagesCandidate(raw: string) {
  const source = raw.replaceAll("\r\n", "\n");
  if (createHash("sha256").update(source).digest("hex") !== FINANCE_GOALS_IMAGES_REVIEW.sha256) throw new Error("Goal image companion differs from reviewed bytes.");
  const lines = source.split("\n"), draft = lines.filter(line => line.startsWith("do $draft_only$ begin raise exception 'DRAFT_ONLY:"));
  if (draft.length !== 1 || !draft[0]!.endsWith(";end $draft_only$;") || lines.filter(line => line === "begin;").length !== 1 || lines.filter(line => line === "rollback;").length !== 1 || lines.some(line => line === "commit;")) throw new Error("Goal image inert boundaries changed.");
  const body = lines.filter(line => line !== draft[0] && line !== "begin;" && line !== "rollback;").join("\n");
  if (body.includes("$draft_only$") || body.includes("DRAFT_ONLY:")) throw new Error("Unreviewed Goal image boundary.");
  return "begin;\n" + body + "\ncommit;\n";
}
export function readFinanceGoalsImagesCandidateSource() {
  return readFile(fileURLToPath(new URL("../../proposals/finance-goals-images/01-binding-and-lifecycle.sql", import.meta.url)), "utf8");
}
export async function createFinanceGoalsImagesCandidateSql() {
  // Verify the new companion BEFORE opening WASM. The existing unmodified
  // helper verifies exactly001–026 and composes Budget→Series→Goals in order.
  const compiled = compileFinanceGoalsImagesCandidate(await readFinanceGoalsImagesCandidateSource());
  const db = await createFinanceGoals026CandidateSql();
  try { await db.exec(compiled); return db; } catch (error) { await db.close(); throw error; }
}
