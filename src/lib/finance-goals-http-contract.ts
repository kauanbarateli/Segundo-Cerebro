/** Pure wire vocabulary. No SDK, database, UI component, environment or secret. */
import type { GoalCommand } from "@/core/financeiro/goals/goal-types";

export const GOAL_HTTP_PATHS = Object.freeze({
  base: "/api/finance/goals",
  availability: "/api/finance/goals/availability",
  preview: "/api/finance/goals/preview",
  reconcile: "/api/finance/goals/reconcile",
});
export const GOAL_HTTP_LIMITS = Object.freeze({ requestBytes: 64 * 1024, responseBytes: 1024 * 1024, innerDtoBytes: 512 * 1024, pageLimit: 50 });
export const GOAL_HTTP_EXPECTED_OWNER_HEADER = "x-expected-user-id";
export const GOAL_HTTP_QUERY_KEYS = Object.freeze({
  page: Object.freeze(["view", "cursor", "limit", "archived"] as const),
  detail: Object.freeze(["view", "id"] as const),
  reservations: Object.freeze(["view", "id", "cursor_at", "cursor_id", "limit"] as const),
  releases: Object.freeze(["view", "id", "cursor_at", "cursor_id", "limit"] as const),
});
export const GOAL_HTTP_FAILURE_CODES = Object.freeze(["validation", "conflict", "forbidden", "unavailable", "uncertain", "session-changed"] as const);
export interface GoalHttpBinding { readonly version: 1; readonly command: GoalCommand["command"]; readonly client_id: string }
export type GoalHttpFailureCode = typeof GOAL_HTTP_FAILURE_CODES[number];
export interface GoalHttpFailure { readonly ok: false; readonly code: GoalHttpFailureCode; readonly message: string }
export type GoalReadHttpReply<T> = { readonly ok: true; readonly result: T } | GoalHttpFailure;
/** Every success is bound to the decoded request. This DTO is not receipt authority. */
export type GoalCommandHttpReply<T> = { readonly ok: true; readonly binding: GoalHttpBinding; readonly result: T } | GoalHttpFailure;
