import "server-only";
import { createPrivilegedClient } from "../../lib/auth/clients";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import type { Database, Json } from "../../lib/supabase/database.generated";
import { createRoutineGateway, type RoutineOperation, type RoutineRpc } from "./projects-habits-gateway";

export function routineGatewayForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, operation: RoutineOperation) {
  if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
  const client = createPrivilegedClient(config);
  const rpc: RoutineRpc = async (name, args) => {
    switch (name) {
      case "projects_habits_snapshot":
        return await client.rpc(name, {
          p_user: args.p_user, p_session: args.p_session, p_operation: args.p_operation,
        } satisfies Database["public"]["Functions"]["projects_habits_snapshot"]["Args"]);
      case "projects_habits_commit":
        if (args.p_request === undefined) throw new AuthGuardError("unavailable");
        return await client.rpc(name, {
          p_user: args.p_user, p_session: args.p_session, p_operation: args.p_operation,
          p_request: args.p_request as Json,
        } satisfies Database["public"]["Functions"]["projects_habits_commit"]["Args"]);
      case "projects_habits_receipt":
        if (typeof args.p_command !== "string" || typeof args.p_client_id !== "string") throw new AuthGuardError("unavailable");
        return await client.rpc(name, {
          p_user: args.p_user, p_session: args.p_session, p_operation: args.p_operation,
          p_command: args.p_command, p_client_id: args.p_client_id,
        } satisfies Database["public"]["Functions"]["projects_habits_receipt"]["Args"]);
    }
    throw new AuthGuardError("unavailable");
  };
  return createRoutineGateway(actor.userId, actor.sessionId, operation, rpc);
}
