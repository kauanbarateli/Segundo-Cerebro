import "server-only";
import { AuthGuardError } from "../../lib/auth/types";

/** A rollout decision, never a deduction from an absent or failed RPC. */
export function financeGoalsAvailable(environment: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return environment.FINANCE_GOALS_V1_ENABLED === "true";
}
export function requireFinanceGoalsAvailable(): void {
  if (!financeGoalsAvailable()) throw new AuthGuardError("unavailable");
}
