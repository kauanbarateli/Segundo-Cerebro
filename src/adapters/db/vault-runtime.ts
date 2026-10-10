import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../lib/supabase/database.generated";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import { createVaultGateway, type VaultOperationName, type VaultRpc } from "./vault-gateway";
export function vaultGatewayForRequest(config: SupabaseAuthConfig, identity: AuthenticatedIdentity, operation: VaultOperationName) {
 if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
 const client = createClient<Database>(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) } });
 const rpc: VaultRpc = async (name, args) => {
  const { p_user, p_session, p_operation } = args;
  switch (name) {
   case "vault_snapshot": return client.rpc(name, { p_user, p_session, p_operation } satisfies Database["public"]["Functions"]["vault_snapshot"]["Args"]);
   case "vault_receipt": return client.rpc(name, { p_user, p_session, p_operation, p_request: args.p_request as Json } satisfies Database["public"]["Functions"]["vault_receipt"]["Args"]);
   case "vault_commit": return client.rpc(name, { p_user, p_session, p_operation, p_request: args.p_request as Json } satisfies Database["public"]["Functions"]["vault_commit"]["Args"]);
  }
 };
 return createVaultGateway(identity.userId, identity.sessionId, operation, rpc);
}
