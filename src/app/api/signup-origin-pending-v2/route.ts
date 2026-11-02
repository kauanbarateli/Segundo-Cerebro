import { cookies } from "next/headers";
import type { AuthCookieJar } from "@/lib/auth/clients";
import { createRequestClient } from "@/lib/auth/clients";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { originWithdrawalV2Enabled } from "@/lib/auth/origin-withdrawal-v2-gate";
import { sameOrigin } from "@/lib/auth/policy";
import { signupFenceDeployed, signupOriginV2Rpc } from "@/lib/auth/signup-http";
import { readVerifiedActor } from "@/lib/auth/signup-origin-pending-actor";
import { pendingOriginV2 } from "@/lib/auth/signup-origin-pending-v2-handler";
import { readSignupContext, signupProvisionalCookie } from "@/lib/auth/signup-provisional";

export const dynamic = "force-dynamic";
async function handler(request: Request): Promise<Response> {
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase" || !originWithdrawalV2Enabled() || !signupFenceDeployed(config)) return new Response(null, { status: 503, headers: noStoreHeaders() });
    const store = await cookies(), jar: AuthCookieJar = { getAll: () => store.getAll(), set: (name, value, options) => { store.set(name, value, options); } };
    const propagated = new Headers(noStoreHeaders()), context = readSignupContext(jar, config.stateSecret);
    const result = await pendingOriginV2(request, {
      allowedOrigin: origin => sameOrigin(origin, config.appOrigin),
      verifiedActor: async () => {
        if (!context) return null;
        const client = createRequestClient(config, jar, true, propagated, signupProvisionalCookie(context.scope));
        const actor = await readVerifiedActor(client.auth);
        return actor && actor.userId === context.userId && actor.sessionId === context.sessionId ? actor : null;
      },
      status: actor => signupOriginV2Rpc(config, "signup_origin_status_v2", { p_user: actor.userId, p_session: actor.sessionId }),
      withdraw: (actor, revision) => signupOriginV2Rpc(config, "signup_origin_withdraw_v2", { p_user: actor.userId, p_session: actor.sessionId, p_revision: revision }),
    });
    for (const [key, value] of propagated) result.headers.set(key, value);
    return result;
  } catch { return new Response(null, { status: 503, headers: noStoreHeaders() }); }
}
export const GET = (request: Request) => handler(request);
export const POST = (request: Request) => handler(request);
