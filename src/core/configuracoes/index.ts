import { exigir } from "../contracts/base";
import { FEATURE_KEYS, type FeatureKey, type FeaturePreferences } from "../access/resolve-access";

export interface AccountSettings {
  user_id: string;
  profile: { display_name: string | null; email: string | null; avatar_file_id: string | null };
  preferences: { theme: "system" | "light" | "dark"; default_calendar_view: "day" | "week" | "month"; values_hidden: boolean; meeting_reminders_enabled: boolean; meeting_reminder_minutes: number };
  modules: { module_key: FeatureKey; visible: boolean; sort_order: number }[];
}
export type SettingsCommand =
  | { command: "settings.profile.update"; input: { client_id: string; display_name: string } }
  | { command: "settings.preferences.update"; input: { client_id: string; patch: Partial<AccountSettings["preferences"]> } }
  | { command: "settings.modules.update"; input: { client_id: string; modules: AccountSettings["modules"] } };
export interface SettingsPort { load(): Promise<AccountSettings>; commit(request: SettingsCommand): Promise<AccountSettings> }
export class SettingsRateLimitError extends Error { constructor() { super("Muitas alterações em pouco tempo. Aguarde um minuto."); this.name = "SettingsRateLimitError"; } }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function validAccountSettings(value: unknown, userId: string): value is AccountSettings {
  const exact = (row: Record<string, unknown>, fields: string[]) => Object.keys(row).length === fields.length && Object.keys(row).every(key => fields.includes(key));
  if (!object(value) || !exact(value, ["user_id", "profile", "preferences", "modules"]) || value.user_id !== userId ||
    !object(value.profile) || !exact(value.profile, ["display_name", "email", "avatar_file_id"]) ||
    !object(value.preferences) || !exact(value.preferences, ["theme", "default_calendar_view", "values_hidden", "meeting_reminders_enabled", "meeting_reminder_minutes"]) || !Array.isArray(value.modules)) return false;
  const profile = value.profile, prefs = value.preferences;
  if (!(profile.display_name === null || typeof profile.display_name === "string" && profile.display_name.length <= 120) ||
    !(profile.email === null || typeof profile.email === "string" && profile.email.length <= 320) ||
    !(profile.avatar_file_id === null || typeof profile.avatar_file_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.avatar_file_id)) ||
    !["system", "light", "dark"].includes(String(prefs.theme)) || !["day", "week", "month"].includes(String(prefs.default_calendar_view)) ||
    typeof prefs.values_hidden !== "boolean" || typeof prefs.meeting_reminders_enabled !== "boolean" || ![5, 10, 15, 30].includes(Number(prefs.meeting_reminder_minutes)) || typeof prefs.meeting_reminder_minutes !== "number") return false;
  // No saved overrides means the catalog's default visibility and order.
  // An empty read snapshot is valid even though a write must change a module.
  if (value.modules.length === 0) return true;
  try { decodeSettingsCommand({ command: "settings.modules.update", input: { client_id: "read-validation", modules: value.modules } }); }
  catch { return false; }
  return true;
}
function only(row: Record<string, unknown>, fields: string[]) { exigir(Object.keys(row).every(key => fields.includes(key)), "Campos não permitidos."); }
export function decodeSettingsCommand(value: unknown): SettingsCommand {
  exigir(object(value) && object(value.input), "Operação inválida."); only(value, ["command", "input"]);
  const input = value.input; exigir(typeof input.client_id === "string" && input.client_id.trim() && input.client_id.length <= 200, "Informe o identificador do envio.");
  if (value.command === "settings.profile.update") { only(input, ["client_id", "display_name"]); exigir(typeof input.display_name === "string" && input.display_name.trim().length >= 1 && input.display_name.trim().length <= 120, "Informe seu nome, com até 120 caracteres."); }
  else if (value.command === "settings.preferences.update") {
    only(input, ["client_id", "patch"]); exigir(object(input.patch) && Object.keys(input.patch).length > 0, "Informe suas preferências.");
    const patch = input.patch; only(patch, ["theme", "default_calendar_view", "values_hidden", "meeting_reminders_enabled", "meeting_reminder_minutes"]);
    if (patch.theme !== undefined) exigir(["system", "light", "dark"].includes(String(patch.theme)), "Tema inválido.");
    if (patch.default_calendar_view !== undefined) exigir(["day", "week", "month"].includes(String(patch.default_calendar_view)), "Visão de calendário inválida.");
    for (const key of ["values_hidden", "meeting_reminders_enabled"]) if (patch[key] !== undefined) exigir(typeof patch[key] === "boolean", "Preferência inválida.");
    if (patch.meeting_reminder_minutes !== undefined) exigir(Number.isInteger(patch.meeting_reminder_minutes) && [5, 10, 15, 30].includes(Number(patch.meeting_reminder_minutes)), "Escolha 5, 10, 15 ou 30 minutos.");
  } else if (value.command === "settings.modules.update") {
    only(input, ["client_id", "modules"]); exigir(Array.isArray(input.modules) && input.modules.length > 0 && input.modules.length <= FEATURE_KEYS.length, "Informe os módulos.");
    const seen = new Set<string>();
    for (const row of input.modules) {
      exigir(object(row), "Módulo inválido."); only(row, ["module_key", "visible", "sort_order"]);
      exigir(typeof row.module_key === "string" && FEATURE_KEYS.includes(row.module_key as FeatureKey) && !seen.has(row.module_key), "Módulo inválido ou repetido."); seen.add(row.module_key);
      exigir(typeof row.visible === "boolean" && Number.isInteger(row.sort_order) && Number(row.sort_order) >= 0 && Number(row.sort_order) <= 1000, "Ordem ou visibilidade inválida.");
      exigir(row.visible || !["inicio", "capturar", "configuracoes"].includes(row.module_key), "Início, Capturar e Configurações permanecem visíveis.");
    }
  } else exigir(false, "Comando inválido.");
  return structuredClone(value) as SettingsCommand;
}
export function applySettings(port: SettingsPort, value: unknown) { return port.commit(decodeSettingsCommand(value)); }
export function settingsPreferences(settings: AccountSettings): FeaturePreferences {
  return Object.fromEntries(settings.modules.map(row => [row.module_key, { visible: row.visible, order: row.sort_order }]));
}
