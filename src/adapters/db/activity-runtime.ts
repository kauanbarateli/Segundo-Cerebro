import "server-only";
import { isTrustedHostedDatabaseOrigin } from "../../lib/auth/database-origin-server";
import { createPrivilegedClient } from "../../lib/auth/clients";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import { createActivityGateway } from "./activity-gateway";

/** Called only after the channel authenticated the request and checked its owner. */
export function activityGatewayForRequest(config: SupabaseAuthConfig, identity: AuthenticatedIdentity) {
  if (!isTrustedHostedDatabaseOrigin(config)) throw new AuthGuardError("unavailable");
  const client = createPrivilegedClient(config);
  return createActivityGateway(identity, async args => await client.rpc("activity_page", args));
}
