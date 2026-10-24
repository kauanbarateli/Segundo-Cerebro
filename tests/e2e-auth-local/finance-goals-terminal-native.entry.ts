/** Closed Node-test entry. No factory, WASM, Next/UI or hosted composition. */
export { executeGoalCommand, decodeGoalCommandResult } from "../../src/core/financeiro/goals/goal-use-cases";
export { decodeGoalCommand } from "../../src/core/financeiro/goals/goal-validation";
export { createFinanceGoalsGateway } from "../../src/adapters/db/finance-goals-gateway";
export { createFinanceGoalsStore } from "../../src/adapters/db/finance-goals-store";
export { captureGoalTerminalAttempt, goalTerminalRpcRequest, decodeGoalTerminalReply } from "../../src/adapters/db/finance-goals-terminal-canonical";
export { createClient } from "@supabase/supabase-js";
export { FINANCE_026_CANONICAL_REVIEW, assertFinance026Sources, readFinance026Sources } from "../helpers/finance-026-candidate-source";
export { FINANCE_BUDGET_REVIEW, compileReviewedFinanceBudgetSql, readReviewedFinanceBudgetSources } from "../helpers/finance-budget-candidate-source";
export { FINANCE_SERIES_REVIEW, compileFinanceSeriesCandidate, readFinanceSeriesCandidateSources } from "../helpers/finance-series-candidate-source";
export { FINANCE_GOALS_REVIEW, compileFinanceGoalsCandidate, readFinanceGoalsCandidateSources } from "../helpers/finance-goals-candidate-source";
export { FINANCE_GOALS_TERMINAL_REVIEW, compileFinanceGoalsTerminalCandidate, readFinanceGoalsTerminalCandidateSource } from "../helpers/finance-goals-terminal-candidate-source";
