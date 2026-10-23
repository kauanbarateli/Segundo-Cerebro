import "server-only";
import { AuthGuardError } from "../../lib/auth/types";

/** Enabled only after supervised schema and consumer acceptance; absence stays off. */
export function financeSeriesAvailable(environment: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return environment.FINANCE_SERIES_V2_ENABLED === "true";
}
export function requireFinanceSeriesAvailable(): void { if (!financeSeriesAvailable()) throw new AuthGuardError("unavailable"); }
