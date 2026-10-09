import "server-only";
import { createPrivilegedClient } from "../../lib/auth/clients";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import { createRoutineGateway, type RoutineOperation, type RoutineRpc } from "./projects-habits-gateway";

/** Planned RPC contract; remote generated types are deferred to manual installation. */
export function routineGatewayForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, operation: RoutineOperation) {
  if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
  const client = createPrivilegedClient(config), rpc: RoutineRpc = (name, args) => (client.rpc as unknown as RoutineRpc)(name, args);
  return createRoutineGateway(actor.userId, actor.sessionId, operation, rpc);
}
