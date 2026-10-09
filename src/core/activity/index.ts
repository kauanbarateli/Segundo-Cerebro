import { instanteValido, type Canal } from "../contracts/base";
import type { AcaoEvento } from "../contracts/modules";

export const ACTIVITY_FIELDS = {
  capture: ["title", "content", "type", "status", "category_id", "project_id", "converted_task_id", "organized_at", "archived_at", "deleted_at", "linked_capture_ids", "attachments"],
  task: ["title", "description", "status", "priority", "category_id", "project_id", "due_at", "scheduled_start_at", "scheduled_end_at", "all_day", "estimated_minutes", "board_position", "origin_capture_id", "completed_at", "archived_at", "deleted_at"],
} as const;
export interface ActivityCursor { occurred_at: string; id: string }
/** Presentation only. No owner, before/after, contents, attachment metadata or receipt. */
export interface ActivityItem extends ActivityCursor {
  entity_type: "capture" | "task"; entity_id: string; action: AcaoEvento; canal: Canal;
  title: string | null; changed_fields: string[];
}
export interface ActivityPage { items: ActivityItem[]; next_cursor: ActivityCursor | null }
export interface ActivityQuery { limit: number; cursor: ActivityCursor | null }
export const activityId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export const activityTime = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value) && instanteValido(value) &&
  Date.parse(value) >= Date.parse("0001-01-01T00:00:00Z") && Date.parse(value) < Date.parse("+010000-01-01T00:00:00Z");
export function validActivityCursor(value: unknown): value is ActivityCursor {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 2 &&
    "id" in value && "occurred_at" in value && activityId(value.id) && activityTime(value.occurred_at);
}
/** Keep PostgreSQL microseconds intact; Date alone cannot compare these cursors. */
function microseconds(value: string): bigint {
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? "";
  return BigInt(Date.parse(value.replace(/\.\d+/, ""))) * 1000n + BigInt(fraction.padEnd(6, "0"));
}
export function compareActivityPosition(a: ActivityCursor, b: ActivityCursor): number {
  const left = microseconds(a.occurred_at), right = microseconds(b.occurred_at);
  return left < right ? -1 : left > right ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
export function validActivityItem(value: unknown): value is ActivityItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const keys = ["id", "occurred_at", "entity_type", "entity_id", "action", "canal", "title", "changed_fields"];
  if (Object.keys(row).length !== keys.length || Object.keys(row).some(key => !keys.includes(key)) ||
      !activityId(row.id) || !activityId(row.entity_id) || !activityTime(row.occurred_at) ||
      (row.entity_type !== "capture" && row.entity_type !== "task") ||
      !["created", "updated", "deleted", "restored", "status_changed"].includes(String(row.action)) ||
      !["web", "api", "cron"].includes(String(row.canal)) ||
      !(row.title === null || typeof row.title === "string" && row.title.length <= 200) ||
      !Array.isArray(row.changed_fields)) return false;
  const fields: readonly string[] = ACTIVITY_FIELDS[row.entity_type];
  return row.changed_fields.every(field => typeof field === "string" && fields.includes(field)) && new Set(row.changed_fields).size === row.changed_fields.length;
}
/** Shared fail-closed check on a projected page, including keyset consistency. */
export function validActivityPage(value: unknown, query: ActivityQuery): value is ActivityPage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const page = value as Record<string, unknown>;
  if (Object.keys(page).length !== 2 || !Array.isArray(page.items) || page.items.length > query.limit ||
      !page.items.every(validActivityItem) || !(page.next_cursor === null || validActivityCursor(page.next_cursor))) return false;
  const items = page.items as ActivityItem[];
  if (new Set(items.map(item => item.id)).size !== items.length || items.some((item, index) => {
    const previous = index === 0 ? query.cursor : items[index - 1];
    return previous && compareActivityPosition(item, previous) >= 0;
  })) return false;
  const last = items.at(-1);
  return page.next_cursor === null || !!last && items.length === query.limit &&
    page.next_cursor.id === last.id && page.next_cursor.occurred_at === last.occurred_at;
}
