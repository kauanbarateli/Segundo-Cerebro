import { ErroDeDominio } from "../../../core/contracts/base";
import { ConnectedApplicationError } from "../../../lib/demo/connected-application";

/** Match the channel's receipt rules. After uncertainty, a later HTTP refusal
 * does not disprove the original commit; VALIDATION has exact-receipt proof. */
export function isDefiniteProjectTaskRefusal(error: unknown, previouslyUncertain: boolean): boolean {
  if (error instanceof ConnectedApplicationError) {
    return error.code === "VALIDATION" || !previouslyUncertain && !error.outcomeUnknown &&
      ["FORBIDDEN", "NOT_FOUND", "UNAUTHENTICATED", "RATE_LIMITED", "CONFLICT"].includes(error.code);
  }
  return error instanceof ErroDeDominio && !previouslyUncertain &&
    ["VALIDATION", "NOT_FOUND", "CONFLICT"].includes(error.code);
}
