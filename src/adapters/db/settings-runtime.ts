import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ErroDeDominio } from "../../core/contracts/base";
import type { AccountSettings, SettingsCommand, SettingsPort } from "../../core/configuracoes";
import { validAccountSettings, SettingsRateLimitError } from "../../core/configuracoes";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import type { Database } from "../../lib/supabase/database.generated";
export function settingsForRequest(config: SupabaseAuthConfig, identity: AuthenticatedIdentity): SettingsPort {
  if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
  const client = createClient<Database>(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
  const args = { p_user: identity.userId, p_session: identity.sessionId } satisfies Database["public"]["Functions"]["settings_snapshot"]["Args"];
  function parse(data: unknown, error: { code?: string } | null): AccountSettings {
    if (error?.code === "42501") throw new AuthGuardError("forbidden");
    if (error?.code === "PT429") throw new SettingsRateLimitError();
    if (error?.code === "23505") throw new ErroDeDominio("CONFLICT", "Este envio já foi usado com outro conteúdo.");
    if (error?.code === "22023" || error?.code === "23514") throw new ErroDeDominio("VALIDATION", "Revise suas preferências.");
    if (error || !validAccountSettings(data, identity.userId)) throw new AuthGuardError("unavailable");
    return data;
  }
  return { async load() { const { data, error } = await client.rpc("settings_snapshot", args); return parse(data, error); }, async commit(request: SettingsCommand) { const { data, error } = await client.rpc("settings_commit", { ...args, p_request: request } satisfies Database["public"]["Functions"]["settings_commit"]["Args"]); return parse(data, error); } };
}
