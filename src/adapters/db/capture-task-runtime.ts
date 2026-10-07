import "server-only";
import { createPrivilegedClient } from "../../lib/auth/clients";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { createCaptureTaskGateway, type CaptureTaskOperation, type CaptureTaskRpc } from "./capture-task-gateway";
import type { Json } from "../../lib/supabase/database.generated";

/** Factory only called after request authentication; credentials stay on server. */
export function captureTaskGatewayForRequest(config: SupabaseAuthConfig, identity: AuthenticatedIdentity, operation: CaptureTaskOperation) {
  if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
  const client = createPrivilegedClient(config);
  const rpc: CaptureTaskRpc = async (name, args) => {
    const context = { p_user: args.p_user, p_session: args.p_session, p_operation: args.p_operation };
    switch (name) {
      case "capture_task_snapshot": return client.rpc("capture_task_snapshot", context);
      case "capture_task_revision": return client.rpc("capture_task_revision", context);
      case "capture_task_receipt": return client.rpc("capture_task_receipt", { ...context, p_command: args.p_command!, p_client_id: args.p_client_id! });
      case "capture_task_commit": return client.rpc("capture_task_commit", { ...context, p_request: args.p_request as unknown as Json });
    }
  };
  return createCaptureTaskGateway(identity.userId, identity.sessionId, operation, rpc);
}
