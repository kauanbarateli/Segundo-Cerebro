import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../lib/supabase/database.generated";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import { createVaultGateway, type VaultOperationName, type VaultRpc, type VaultRpcName } from "./vault-gateway";
/** Authored API for the versioned migration, not a claim of generated/applied schema. */
type PlannedVaultDatabase = Omit<Database, "public"> & { public: Omit<Database["public"], "Functions"> & { Functions: Database["public"]["Functions"] & Record<VaultRpcName, { Args: { p_user: string; p_session: string; p_operation: string; p_request?: Json }; Returns: Json }> } };
export function vaultGatewayForRequest(config: SupabaseAuthConfig, identity: AuthenticatedIdentity, operation: VaultOperationName) {
 if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
 const client = createClient<PlannedVaultDatabase>(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) } });
 const rpc: VaultRpc = async (name, args) => await client.rpc(name, { p_user: args.p_user, p_session: args.p_session, p_operation: args.p_operation, ...(args.p_request ? { p_request: args.p_request as Json } : {}) });
 return createVaultGateway(identity.userId, identity.sessionId, operation, rpc);
}
