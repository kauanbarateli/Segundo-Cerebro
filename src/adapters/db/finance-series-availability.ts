import "server-only";
import { AuthGuardError } from "../../lib/auth/types";

export type FinanceSeriesSchemaState = "legacy_only" | "classified";
/** This rollout declaration never infers legacy from a failed RPC. After the
 * first accepted installation, keep classified even when ENABLED is false. */
export function financeSeriesSchemaState(environment: Readonly<Record<string, string | undefined>> = process.env): FinanceSeriesSchemaState {
  const value = environment.FINANCE_SERIES_V2_SCHEMA_STATE;
  if (value === undefined || value === "legacy_only") return "legacy_only";
  if (value === "classified") return value;
  throw new AuthGuardError("unavailable");
}
/** Enabled only after supervised schema and consumer acceptance; absence stays off. */
export function financeSeriesAvailable(environment: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return financeSeriesSchemaState(environment) === "classified" && environment.FINANCE_SERIES_V2_ENABLED === "true";
}
export function requireFinanceSeriesAvailable(): void { if (!financeSeriesAvailable()) throw new AuthGuardError("unavailable"); }
