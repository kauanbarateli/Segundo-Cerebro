/** Disposable WASM factory; native CI imports only the shared source compiler. */
import { createFinanceGoals026CandidateSql } from "./finance-026-candidate-sql";
import { compileFinanceGoalsTerminalCandidate, readFinanceGoalsTerminalCandidateSource } from "./finance-goals-terminal-candidate-source";
export { FINANCE_GOALS_TERMINAL_REVIEW, compileFinanceGoalsTerminalCandidate, readFinanceGoalsTerminalCandidateSource } from "./finance-goals-terminal-candidate-source";
export async function createFinanceGoalsTerminalCandidateSql() {
  // Validate every terminal byte BEFORE constructing any disposable database.
  const sql = compileFinanceGoalsTerminalCandidate(await readFinanceGoalsTerminalCandidateSource()), db = await createFinanceGoals026CandidateSql();
  try { await db.exec(sql); return db; } catch (error) { await db.close(); throw error; }
}
