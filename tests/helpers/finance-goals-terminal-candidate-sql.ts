/** Disposable 001–026 -> Budget -> Series -> Goals -> terminal M1 only.
 * No env/URL/secret/native process/remote installation or source-pin rewrite. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createFinanceGoals026CandidateSql } from "./finance-026-candidate-sql";

export const FINANCE_GOALS_TERMINAL_REVIEW = Object.freeze({
  file: "proposals/finance-goals-terminal/01-dispositions-and-fence.sql",
  sha256: "d1bcb2213d69ad4135fb6cce171868b5a70f6447027b5548511c5cf26c7b5f1b",
});
export function compileFinanceGoalsTerminalCandidate(raw: string) {
  const source = raw.replaceAll("\r\n", "\n");
  if (createHash("sha256").update(source).digest("hex") !== FINANCE_GOALS_TERMINAL_REVIEW.sha256) throw new Error("Terminal candidate differs from reviewed bytes.");
  const lines = source.split("\n"), draft = lines.filter(line => line.startsWith("do $draft_only$ begin raise exception 'DRAFT_ONLY:"));
  if (draft.length !== 1 || !draft[0]!.endsWith(";end $draft_only$;") || lines.filter(line => line === "begin;").length !== 1 || lines.filter(line => line === "rollback;").length !== 1 || lines.some(line => line === "commit;")) throw new Error("Terminal inert boundaries changed.");
  const body = lines.filter(line => line !== draft[0] && line !== "begin;" && line !== "rollback;").join("\n");
  if (body.includes("$draft_only$") || body.includes("DRAFT_ONLY:")) throw new Error("Terminal unreviewed inert boundary.");
  return "begin;\n" + body + "\ncommit;\n";
}
export function readFinanceGoalsTerminalCandidateSource() { return readFile(fileURLToPath(new URL("../../" + FINANCE_GOALS_TERMINAL_REVIEW.file, import.meta.url)), "utf8"); }
export async function createFinanceGoalsTerminalCandidateSql() {
  // Validate every terminal byte BEFORE constructing any disposable database.
  const sql = compileFinanceGoalsTerminalCandidate(await readFinanceGoalsTerminalCandidateSource()), db = await createFinanceGoals026CandidateSql();
  try { await db.exec(sql); return db; } catch (error) { await db.close(); throw error; }
}
