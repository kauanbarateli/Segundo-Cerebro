import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ErroDeDominio } from "../../core/contracts/base";
import type { AccountSettings, SettingsCommand, SettingsPort } from "../../core/configuracoes";
import { validAccountSettings, SettingsRateLimitError } from "../../core/configuracoes";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import type { Database, Json } from "../../lib/supabase/database.generated";
/** Contract authored for an unapplied migration. Regenerate after manual validation. */
type PlannedDatabase = Omit<Database, "public"> & { public: Omit<Database["public"], "Functions"> & { Functions: Database["public"]["Functions"] & {
  settings_snapshot: { Args: { p_user: string; p_session: string }; Returns: Json };
  settings_commit: { Args: { p_user: string; p_session: string; p_request: Json }; Returns: Json };
} } };
export function settingsForRequest(config: SupabaseAuthConfig, identity: AuthenticatedIdentity): SettingsPort {
  if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
  const client = createClient<PlannedDatabase>(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
  const args = { p_user: identity.userId, p_session: identity.sessionId };
  function parse(data: unknown, error: { code?: string } | null): AccountSettings {
    if (error?.code === "42501") throw new AuthGuardError("forbidden");
    if (error?.code === "PT429") throw new SettingsRateLimitError();
    if (error?.code === "23505") throw new ErroDeDominio("CONFLICT", "Este envio já foi usado com outro conteúdo.");
    if (error?.code === "22023" || error?.code === "23514") throw new ErroDeDominio("VALIDATION", "Revise suas preferências.");
    if (error || !validAccountSettings(data, identity.userId)) throw new AuthGuardError("unavailable");
    return data;
  }
  return { async load() { const { data, error } = await client.rpc("settings_snapshot", args); return parse(data, error); }, async commit(request: SettingsCommand) { const { data, error } = await client.rpc("settings_commit", { ...args, p_request: request as unknown as Json }); return parse(data, error); } };
}
