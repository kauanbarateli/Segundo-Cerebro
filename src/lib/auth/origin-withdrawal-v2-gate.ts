import "server-only";

/** Explicit release gate; no database mutation or fallback is implied. */
export function originWithdrawalV2Enabled(): boolean {
  return process.env.ORIGIN_WITHDRAWAL_V2_ENABLED === "true";
}
