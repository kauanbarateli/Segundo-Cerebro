import { instanteValido, type Canal } from "../contracts/base";
import type { AcaoEvento } from "../contracts/modules";
import type { FeatureKey } from "../access/resolve-access";

export const ACTIVITY_FIELDS = {
  capture: ["title", "content", "type", "status", "category_id", "project_id", "converted_task_id", "organized_at", "archived_at", "deleted_at", "linked_capture_ids", "attachments"],
  task: ["title", "description", "status", "priority", "category_id", "project_id", "due_at", "scheduled_start_at", "scheduled_end_at", "all_day", "estimated_minutes", "board_position", "origin_capture_id", "completed_at", "archived_at", "deleted_at"],
  finance_account: ["name", "kind", "institution", "opening_balance_cents", "archived_at"],
  finance_category: ["name", "kind", "color_key"], finance_tag: ["name", "color_key"],
  finance_transaction: ["description", "amount_cents", "paid_cents", "status", "account_id", "category_id", "occurred_on", "due_date", "statement_month", "deleted_at", "tag_ids"],
  finance_budget: ["category_id", "month", "limit_cents"],
  knowledge_notebook: ["name", "project_id", "deleted_at"],
  knowledge_page: ["title", "document", "notebook_id", "parent_id", "archived_at", "deleted_at", "version"],
  knowledge_link: ["from_type", "from_id", "to_type", "to_id", "deleted_at"],
  project: ["name", "description", "color_key", "position", "deleted_at"], project_container: ["name", "project_id", "parent_id", "deleted_at"],
  habit: ["name", "schedule_kind", "weekdays", "weekly_target", "started_on", "archived_at"], habit_entry: ["habit_id", "done_on"], habit_pause: ["habit_id", "starts_on", "ends_on", "reason"],
  drive_folder: ["name", "parent_id", "project_id", "deleted_at"], drive_file: ["name", "folder_id", "starred", "deleted_at"],
  profile: ["display_name", "avatar_file_id"], preference: ["theme", "default_calendar_view", "values_hidden", "meeting_reminders_enabled", "meeting_reminder_minutes"], module_preference: ["module_key", "visible", "sort_order"],
  moderation: ["status", "must_change_password"], role: ["role"], entitlement: ["feature_key", "allowed"],
  vault_metadata: ["operation", "version"],
  calendar_account: ["status", "operation"], calendar_source: ["selected"], calendar_event: ["title", "starts_at", "ends_at", "all_day", "linked_capture_id", "deleted_at"], calendar_sync: ["status", "calendar_count", "event_count"],
} as const;
export type ActivityType = keyof typeof ACTIVITY_FIELDS;
export const ACTIVITY_FEATURES: Record<ActivityType, FeatureKey> = {
  capture: "capturar", task: "tarefas", finance_account: "financeiro", finance_category: "financeiro", finance_tag: "financeiro", finance_transaction: "financeiro", finance_budget: "financeiro",
  knowledge_notebook: "conhecimento", knowledge_page: "conhecimento", knowledge_link: "conhecimento", project: "projetos", project_container: "projetos",
  habit: "habitos", habit_entry: "habitos", habit_pause: "habitos", drive_folder: "drive", drive_file: "drive",
  profile: "configuracoes", preference: "configuracoes", module_preference: "configuracoes", moderation: "configuracoes", role: "configuracoes", entitlement: "configuracoes", vault_metadata: "cofre",
  calendar_account: "calendario", calendar_source: "calendario", calendar_event: "calendario", calendar_sync: "calendario",
};
export interface ActivityCursor { occurred_at: string; id: string }
/** Presentation only. No owner, before/after, contents, attachment metadata or receipt. */
export interface ActivityItem extends ActivityCursor {
  entity_type: ActivityType; entity_id: string; action: AcaoEvento; canal: Canal;
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
      typeof row.entity_type !== "string" || !Object.hasOwn(ACTIVITY_FIELDS, row.entity_type) ||
      !["created", "updated", "deleted", "restored", "status_changed"].includes(String(row.action)) ||
      !["web", "api", "cron"].includes(String(row.canal)) ||
      !(row.title === null || typeof row.title === "string" && row.title.length <= 200) ||
      !Array.isArray(row.changed_fields)) return false;
  const fields: readonly string[] = ACTIVITY_FIELDS[row.entity_type as ActivityType];
  if ((row.entity_type === "vault_metadata" || row.entity_type.startsWith("finance_")) && row.title !== null) return false;
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
