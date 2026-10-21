import type { FinanceRouteState } from "./finance-route";

function requireMonth(month: string) {
  if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])-01$/.test(month)) throw new RangeError("Informe uma competência válida.");
}

/** Civil arithmetic with explicit ends; never normalizes year 0000 or 10000. */
export function adjacentFinanceMonth(month: string, direction: -1 | 1): string | null {
  requireMonth(month);
  const index = (Number(month.slice(0, 4)) - 1) * 12 + Number(month.slice(5, 7)) - 1 + direction;
  if (index < 0 || index >= 9999 * 12) return null;
  return `${String(Math.floor(index / 12) + 1).padStart(4, "0")}-${String(index % 12 + 1).padStart(2, "0")}-01`;
}

/** Only the confirmed competence and pagination change; all filters survive. */
export function financePeriodChange(state: FinanceRouteState, month: string): FinanceRouteState {
  requireMonth(month);
  return { ...state, month, page: 1 };
}
