import "server-only";
import { createPrivilegedClient } from "../../lib/auth/clients";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import { createKnowledgeGateway, type KnowledgeRpc } from "./knowledge-gateway";

/** O contrato SQL novo é próprio; tipos remotos serão gerados após aplicação manual. */
export function knowledgeGatewayForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, operation: string) {
  if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
  const client = createPrivilegedClient(config);
  const rpc: KnowledgeRpc = (name, args) => (client.rpc as unknown as KnowledgeRpc)(name, args);
  return createKnowledgeGateway(actor.userId, actor.sessionId, operation, rpc);
}
