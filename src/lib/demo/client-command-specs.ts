/** Public DTO shapes only. Server validators remain authoritative. No credentials. */
const financeTransaction = ["account_id", "category_id", "kind", "amount_cents", "paid_cents", "description", "payee", "occurred_on", "status", "due_date", "notes", "statement_month", "tag_ids"];
const financeAccount = ["name", "kind", "institution", "opening_balance_cents", "color_key", "credit_limit_cents", "statement_closing_day", "payment_due_day"];
const financeCategory = ["name", "kind", "color_key"], financeTag = ["name", "color_key"];
const projectFields = ["name", "description", "color_key", "position"], habitFields = ["name", "schedule_kind", "weekdays", "weekly_target", "started_on", "color_key", "icon_key", "position"];
export const DOMAIN_COMMAND_FIELDS: Record<string, readonly string[]> = {
  "finance.account.create": financeAccount, "finance.account.update": ["id", "patch"], "finance.account.close": ["id"],
  "finance.category.create": financeCategory, "finance.category.update": ["id", "patch"],
  "finance.transaction.create": financeTransaction, "finance.transaction.update": ["id", "patch"],
  "finance.transaction.delete": ["id"], "finance.transaction.restore": ["id"], "finance.transaction.duplicate": ["id", "occurred_on"],
  "finance.transfer.create": ["from_account_id", "to_account_id", "amount_cents", "occurred_on", "description"],
  "finance.statement.pay": ["from_account_id", "card_account_id", "statement_month", "amount_cents", "occurred_on", "interest_rate_percent", "iof_cents"],
  "finance.series.create": ["fields", "serie_tipo", "count"], "finance.series.stop": ["installment_group_id", "from_on"],
  "finance.budget.save": ["category_id", "month", "limit_cents"], "finance.tag.create": financeTag, "finance.tag.update": ["id", "patch"],
  "knowledge.notebook.create": ["name", "project_id"], "knowledge.notebook.update": ["id", "name", "project_id"],
  "knowledge.notebook.delete": ["id"], "knowledge.notebook.restore": ["id"],
  "knowledge.page.create": ["notebook_id", "title", "document", "parent_id"],
  "knowledge.page.update": ["id", "expected_version", "title", "document", "notebook_id", "parent_id"],
  "knowledge.page.delete": ["id"], "knowledge.page.restore": ["id"], "knowledge.page.archive": ["id"], "knowledge.page.unarchive": ["id"],
  "knowledge.page.resolve-ref": ["id", "alias", "notebook_id"], "knowledge.page.promote-capture": ["capture_id", "notebook_id", "parent_id"],
  "knowledge.link.create": ["from_type", "from_id", "to_type", "to_id"], "knowledge.link.delete": ["id"],
  "settings.profile.update": ["display_name"], "settings.preferences.update": ["patch"], "settings.modules.update": ["modules"],
  "project.create": projectFields, "project.update": ["id", "patch"], "project.delete": ["id"], "project.restore": ["id"],
  "project.container.create": ["kind", "name", "project_id", "parent_id"], "project.container.link": ["id", "project_id"], "project.container.unlink": ["id"],
  "habit.create": habitFields, "habit.update": ["id", "patch"], "habit.archive": ["id"], "habit.restore": ["id"],
  "habit.mark": ["habit_id", "done_on", "done"], "habit.pause.create": ["habit_id", "starts_on", "ends_on", "reason"], "habit.pause.delete": ["id"],
  "drive.folder.create": ["name", "parent_id", "project_id"], "drive.folder.update": ["id", "name"],
  "drive.folder.move": ["id", "parent_id"], "drive.folder.delete": ["id"], "drive.folder.restore": ["id"],
  "drive.file.update": ["id", "name"], "drive.file.move": ["id", "folder_id"],
  "drive.file.delete": ["id"], "drive.file.restore": ["id"], "drive.file.star": ["id", "starred"],
  "file.upload.finalize": ["upload_id"], "avatar.set": ["file_id"], "avatar.remove": [],
  "vault.create": ["expected_revision", "master", "recovery", "consent"], "vault.master.rewrap": ["expected_revision", "master"],
  "vault.item.create": ["expected_revision", "id", "version", "envelope"], "vault.item.update": ["expected_revision", "id", "version", "envelope"],
  "vault.item.delete": ["expected_revision", "id"], "vault.item.restore": ["expected_revision", "id"],
  "vault.audit": ["expected_revision", "operation", "item_id"],
  "calendar.select": ["calendar_id", "selected"], "calendar.sync": ["account_id", "start_day", "end_day"],
  "calendar.disconnect": ["account_id"], "calendar.event.link": ["event_id", "capture_id"],
};
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function only(value: Record<string, unknown>, keys: readonly string[]) { return Object.keys(value).every(key => keys.includes(key)); }
function safe(value: unknown, depth = 0): boolean {
  if (depth > 24) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") return value.length <= 128 * 1024;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 2000 && value.every(item => safe(item, depth + 1));
  if (!object(value)) return false;
  return Object.entries(value).every(([key, item]) => !["user_id", "session_id", "access_token", "refresh_token", "password", "secret", "secret_key", "authorization", "cookies", "signed_url", "upload_url"].includes(key.toLowerCase()) && safe(item, depth + 1));
}
export function validDomainCommandInput(command: string, input: unknown): boolean {
  const fields = DOMAIN_COMMAND_FIELDS[command];
  if (!fields || !object(input) || typeof input.client_id !== "string" || !input.client_id.trim() || input.client_id.length > 200 || !only(input, [...fields, "client_id"]) || !safe(input)) return false;
  const financeFields = command.startsWith("finance.account.") ? financeAccount : command.startsWith("finance.category.") ? financeCategory : command.startsWith("finance.tag.") ? financeTag : financeTransaction;
  if (command.startsWith("finance.") && command.endsWith(".update") && (!object(input.patch) || !only(input.patch, financeFields))) return false;
  if (command === "finance.series.create" && (!object(input.fields) || !only(input.fields, financeTransaction))) return false;
  if (command === "settings.preferences.update" && (!object(input.patch) || !only(input.patch, ["theme", "default_calendar_view", "values_hidden", "meeting_reminders_enabled", "meeting_reminder_minutes"]))) return false;
  if (command === "settings.modules.update" && (!Array.isArray(input.modules) || !input.modules.every(row => object(row) && only(row, ["module_key", "visible", "sort_order"])))) return false;
  if ((command === "project.update" || command === "habit.update") && (!object(input.patch) || !only(input.patch, command === "project.update" ? projectFields : habitFields))) return false;
  if (command.startsWith("vault.")) {
    const envelope = (value: unknown) => object(value) && Object.keys(value).length === 2 && only(value, ["iv", "ciphertext"]) && typeof value.iv === "string" && typeof value.ciphertext === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(value.iv) && /^[A-Za-z0-9+/]+={0,2}$/.test(value.ciphertext);
    if (typeof input.expected_revision !== "string" || input.expected_revision.length > 200) return false;
    if (input.envelope !== undefined && !envelope(input.envelope) || input.recovery !== undefined && !envelope(input.recovery)) return false;
    if (input.master !== undefined) {
      if (!object(input.master) || Object.keys(input.master).length !== 2 || !only(input.master, ["kdf", "envelope"]) || !envelope(input.master.envelope) || !object(input.master.kdf)) return false;
      const kdf = input.master.kdf;
      if (Object.keys(kdf).length !== 5 || !only(kdf, ["algorithm", "memory_kib", "iterations", "parallelism", "salt"]) || kdf.algorithm !== "argon2id" || kdf.memory_kib !== 65536 || kdf.iterations !== 3 || kdf.parallelism !== 1 || typeof kdf.salt !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(kdf.salt)) return false;
    }
  }
  return true;
}
