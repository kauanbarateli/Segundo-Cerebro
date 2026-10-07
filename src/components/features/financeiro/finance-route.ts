import type { TableSort } from "@/components/ui/table-model";

export const FINANCE_TABS = ["painel", "lancamentos", "contas", "categorias", "orcamentos"] as const;
export type FinanceTab = typeof FINANCE_TABS[number];
export const FINANCE_KINDS = ["all", "income", "expense", "transfer"] as const;
export const FINANCE_STATES = ["all", "planned", "pending", "confirmed", "reconciled", "cancelled", "trash"] as const;
export const FINANCE_SORTS = ["occurred_on", "description", "account", "category", "kind", "status", "amount_cents"] as const;
export interface FinanceRouteState {
  tab: FinanceTab;
  month: string;
  search: string;
  kind: typeof FINANCE_KINDS[number];
  account: string;
  category: string;
  status: typeof FINANCE_STATES[number];
  page: number;
  sort: TableSort | null;
}

function member<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}
function monthValue(value: string | null): value is string {
  return Boolean(value && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value));
}
function shortValue(value: string | null): string { return (value ?? "").trim().slice(0, 200); }

/** Month boundaries are civil values supplied by app.today(), independent of host TZ. */
export function parseFinanceRoute(params: Pick<URLSearchParams, "get">, today: string): FinanceRouteState {
  const fallbackMonth = today.slice(0, 7);
  if (!monthValue(fallbackMonth)) throw new RangeError("Informe o dia atual do aplicativo.");
  const suppliedMonth = params.get("month");
  const suppliedPage = params.get("page");
  const numericPage = suppliedPage && /^\d+$/.test(suppliedPage) ? Number(suppliedPage) : 1;
  return {
    tab: member(params.get("tab"), FINANCE_TABS, "painel"),
    month: `${monthValue(suppliedMonth) ? suppliedMonth : fallbackMonth}-01`,
    search: shortValue(params.get("q")),
    kind: member(params.get("kind"), FINANCE_KINDS, "all"),
    account: shortValue(params.get("account")), category: shortValue(params.get("category")),
    status: member(params.get("status"), FINANCE_STATES, "all"),
    page: Number.isSafeInteger(numericPage) && numericPage > 0 ? numericPage : 1,
    sort: params.get("sort") === "original" ? null : { columnId: member(params.get("sort"), FINANCE_SORTS, "occurred_on"), direction: member(params.get("dir"), ["asc", "desc"], "desc") },
  };
}

/** No values, form contents, or visibility preference are ever serialized. */
export function financeHref(state: FinanceRouteState): string {
  const params = new URLSearchParams({ tab: state.tab, month: state.month.slice(0, 7) });
  if (state.search) params.set("q", state.search);
  if (state.kind !== "all") params.set("kind", state.kind);
  if (state.account) params.set("account", state.account);
  if (state.category) params.set("category", state.category);
  if (state.status !== "all") params.set("status", state.status);
  if (state.page > 1) params.set("page", String(state.page));
  if (!state.sort) params.set("sort", "original");
  else {
    if (state.sort.columnId !== "occurred_on") params.set("sort", state.sort.columnId);
    if (state.sort.direction !== "desc") params.set("dir", state.sort.direction);
  }
  return `/financeiro?${params.toString()}`;
}

export function financeFilterPatch(state: FinanceRouteState, patch: Partial<Omit<FinanceRouteState, "tab" | "page" | "sort">>): FinanceRouteState {
  return { ...state, ...patch, page: 1 };
}
