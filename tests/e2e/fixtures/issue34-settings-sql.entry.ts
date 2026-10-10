// Original runtime/SDK, Core validator and head script. No personal config IO.
export { applySettings, decodeSettingsCommand, validAccountSettings, settingsPreferences } from "../../../src/core/configuracoes";
export { settingsForRequest } from "../../../src/adapters/db/settings-runtime";
export { createClient } from "@supabase/supabase-js";
export { THEME_INIT_SCRIPT } from "../../../src/lib/theme";
