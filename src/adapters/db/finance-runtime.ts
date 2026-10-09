import "server-only";
import { createClient } from "@supabase/supabase-js";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import type { Database, Json } from "../../lib/supabase/database.generated";
import { createFinanceGateway, type FinanceOperation, type FinanceRpc, type FinanceRpcName } from "./finance-gateway";

/** Authored contract for the versioned, unapplied migration; not generated database evidence. */
type PlannedFinanceDatabase = Omit<Database, "public"> & { public: Omit<Database["public"], "Functions"> & { Functions: Database["public"]["Functions"] & Record<FinanceRpcName, { Args: { p_user: string; p_session: string; p_operation: string; p_command?: string; p_client_id?: string; p_request?: Json }; Returns: Json }> } };
export function financeGatewayForRequest(config: SupabaseAuthConfig, identity: AuthenticatedIdentity, operation: FinanceOperation) {
  if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
  const client = createClient<PlannedFinanceDatabase>(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) } });
  const rpc: FinanceRpc = async (name, args) => {
    const { p_user, p_session, p_operation } = args;
    if (name === "finance_receipt") return client.rpc(name, { p_user, p_session, p_operation, p_command: args.p_command!, p_client_id: args.p_client_id! });
    if (name === "finance_snapshot" || name === "finance_revision") return client.rpc(name, { p_user, p_session, p_operation });
    return client.rpc(name, { p_user, p_session, p_operation, p_request: args.p_request as Json });
  };
  return createFinanceGateway(identity.userId, identity.sessionId, operation, rpc);
}
