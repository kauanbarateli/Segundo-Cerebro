import "server-only";
import { AuthGuardError } from "../../lib/auth/types";
import { financeGoalsAvailable } from "./finance-goals-availability";

/** Rollout for new image reservations, including signed-URL renewals. Existing
 * observation/finalization stays available under its own Auth/Entitlement checks.
 * This does not revoke a signed capability already issued with a finite TTL. */
export function financeGoalsImagesAvailable(environment: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return financeGoalsAvailable(environment) && environment.FINANCE_GOALS_IMAGES_V1_ENABLED === "true";
}

export function requireFinanceGoalsImagesAvailable(): void {
  if (!financeGoalsImagesAvailable()) throw new AuthGuardError("unavailable");
}
