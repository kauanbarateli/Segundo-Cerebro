import "server-only";
import { createRequestClient, type AuthCookieJar } from "../../lib/auth/clients";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import type { AuthenticatedIdentity } from "../../lib/auth/types";
import { createOwnSessionsGateway } from "./own-sessions-gateway";

/** Uses the same writable cookie jar as the preceding verified Auth read. */
export function ownSessionsForRequest(config: SupabaseAuthConfig, identity: AuthenticatedIdentity, jar: AuthCookieJar, responseHeaders: Headers) {
  return createOwnSessionsGateway(identity, async () => {
    const client = createRequestClient(config, jar, true, responseHeaders);
    return await client.rpc("my_sessions");
  });
}
