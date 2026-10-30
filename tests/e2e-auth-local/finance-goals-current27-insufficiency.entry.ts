/** Minimum real Core/adapter graph plus the existing official local actor SDK. */
export { assinatura } from "../../src/core/contracts/base";
export { executeGoalCommand, decodeGoalCommandResult } from "../../src/core/financeiro/goals/goal-use-cases";
export { decodeGoalCommand } from "../../src/core/financeiro/goals/goal-validation";
export { createFinanceGoalsGateway } from "../../src/adapters/db/finance-goals-gateway";
export { createFinanceGoalsStore } from "../../src/adapters/db/finance-goals-store";
export { createClient } from "@supabase/supabase-js";
