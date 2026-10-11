import "server-only";
import { OwnSessionsReadError, ownSessionId, projectOwnSessions, type OwnSessionsPort } from "../../core/configuracoes/own-sessions";
import { assertFeature } from "../../lib/auth/policy";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";

export type OwnSessionsRpc = () => Promise<{ data: unknown; error: { code?: string } | null }>;

/** The identity and SID come from the verified server gateway, never request data. */
export function createOwnSessionsGateway(identity: AuthenticatedIdentity, rpc: OwnSessionsRpc): OwnSessionsPort {
  if (!ownSessionId(identity.userId) || !ownSessionId(identity.sessionId)) throw new OwnSessionsReadError("UNAVAILABLE");
  return { async read() {
    assertFeature(identity, "configuracoes");
    let reply: Awaited<ReturnType<OwnSessionsRpc>>;
    try { reply = await rpc(); } catch { throw new OwnSessionsReadError("UNAVAILABLE"); }
    if (reply.error?.code === "42501") throw new AuthGuardError("forbidden");
    if (reply.error) throw new OwnSessionsReadError("UNAVAILABLE");
    return projectOwnSessions(reply.data, identity.sessionId);
  } };
}
