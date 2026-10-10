import "server-only";
import { createClient } from "@supabase/supabase-js";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import type { Database, Json } from "../../lib/supabase/database.generated";
import { createFinanceGateway, type FinanceOperation, type FinanceRpc } from "./finance-gateway";

export function financeGatewayForRequest(config: SupabaseAuthConfig, identity: AuthenticatedIdentity, operation: FinanceOperation) {
  if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
  const client = createClient<Database>(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) } });
  const rpc: FinanceRpc = async (name, args) => {
    const { p_user, p_session, p_operation } = args;
    switch (name) {
      case "finance_snapshot": return client.rpc(name, { p_user, p_session, p_operation } satisfies Database["public"]["Functions"]["finance_snapshot"]["Args"]);
      case "finance_revision": return client.rpc(name, { p_user, p_session, p_operation } satisfies Database["public"]["Functions"]["finance_revision"]["Args"]);
      case "finance_receipt": {
        const { p_command, p_client_id } = args;
        if (typeof p_command !== "string" || typeof p_client_id !== "string") throw new AuthGuardError("unavailable");
        return client.rpc(name, { p_user, p_session, p_operation, p_command, p_client_id } satisfies Database["public"]["Functions"]["finance_receipt"]["Args"]);
      }
      case "finance_commit": return client.rpc(name, { p_user, p_session, p_operation, p_request: args.p_request as Json } satisfies Database["public"]["Functions"]["finance_commit"]["Args"]);
      case "transfer": return client.rpc(name, { p_user, p_session, p_operation, p_request: args.p_request as Json } satisfies Database["public"]["Functions"]["transfer"]["Args"]);
      case "pay_statement": return client.rpc(name, { p_user, p_session, p_operation, p_request: args.p_request as Json } satisfies Database["public"]["Functions"]["pay_statement"]["Args"]);
      case "create_series": return client.rpc(name, { p_user, p_session, p_operation, p_request: args.p_request as Json } satisfies Database["public"]["Functions"]["create_series"]["Args"]);
      case "close_account": return client.rpc(name, { p_user, p_session, p_operation, p_request: args.p_request as Json } satisfies Database["public"]["Functions"]["close_account"]["Args"]);
    }
  };
  return createFinanceGateway(identity.userId, identity.sessionId, operation, rpc);
}
