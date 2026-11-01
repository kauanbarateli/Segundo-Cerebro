import "server-only";
import { createPrivilegedClient, createRequestClient, type AuthCookieJar } from "./clients";
import type { SupabaseAuthConfig } from "./config";
import { AUTH_COOKIE_NAME, secureCookieOptions } from "./cookie-policy";
import { subjectHash } from "./flow-state";
import { signSignupCheckpoint } from "./signup-checkpoint";
import { signupEnabled, signupRpc, signupUnavailable } from "./signup-http";
import type { SignupConfirmationPorts } from "./signup-confirmation-service";

export const SIGNUP_CHECKPOINT_COOKIE = "sc-flow-signup-confirmation";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const authCookie = (name: string) => name === AUTH_COOKIE_NAME || name.startsWith(`${AUTH_COOKIE_NAME}.`) || name.startsWith(`${AUTH_COOKIE_NAME}-`);

/** No route invokes this candidate until the confirmation and QA gates pass. */
export function createSignupConfirmationPorts(config: SupabaseAuthConfig, jar: AuthCookieJar, responseHeaders?: Headers): SignupConfirmationPorts {
  let client: ReturnType<typeof createRequestClient> | undefined;
  return {
    now: Date.now,
    canBegin: () => signupEnabled(config) && !jar.getAll().some(cookie => authCookie(cookie.name) && cookie.value !== ""),
    async limitToken(tokenHash) {
      if (!signupEnabled(config)) return signupUnavailable();
      const { data, error } = await createPrivilegedClient(config).rpc("consume_rate_limit", { p_scope: "login", p_subject_hash: subjectHash(config.rateLimitSecret, "signup-confirmation", tokenHash) });
      if (error || !data || typeof data !== "object" || Array.isArray(data) || typeof data.allowed !== "boolean") return signupUnavailable();
      return { allowed: data.allowed };
    },
    async verifySignupToken(tokenHash) {
      if (!signupEnabled(config) || jar.getAll().some(cookie => authCookie(cookie.name) && cookie.value !== "")) return null;
      client = createRequestClient(config, jar, true, responseHeaders);
      const { error } = await client.auth.verifyOtp({ type: "signup", token_hash: tokenHash });
      if (error) return null;
      const { data: verified, error: userError } = await client.auth.getUser();
      if (userError || !verified.user || verified.user.is_anonymous || !verified.user.email || !verified.user.email_confirmed_at) return null;
      const { data: signed, error: claimsError } = await client.auth.getClaims();
      const sessionId = signed?.claims.session_id;
      if (claimsError || signed?.claims.sub !== verified.user.id || typeof sessionId !== "string" || !UUID.test(sessionId)) return null;
      return { userId: verified.user.id, sessionId, email: verified.user.email };
    },
    subjectHash: email => subjectHash(config.rateLimitSecret, "signup-request", email),
    async findBoundIntent(userId, sessionId, hash) {
      const result = await signupRpc(config, "signup_find_bound_intent", { p_user: userId, p_session: sessionId, p_subject_hash: hash });
      if (result === null) return null;
      if (!result || typeof result !== "object" || Array.isArray(result) || Object.keys(result).sort().join(",") !== "intentId,privacyVersion,termsVersion") return signupUnavailable();
      const value = result as Record<string, unknown>;
      if (typeof value.intentId !== "string" || !UUID.test(value.intentId) || typeof value.termsVersion !== "string" || value.termsVersion.length > 100 || typeof value.privacyVersion !== "string" || value.privacyVersion.length > 100) return signupUnavailable();
      return { intentId: value.intentId, termsVersion: value.termsVersion, privacyVersion: value.privacyVersion };
    },
    async putCheckpoint(value) {
      if (!signupEnabled(config)) return signupUnavailable();
      const now = Date.now(), token = signSignupCheckpoint(value, config.stateSecret, now);
      jar.set(SIGNUP_CHECKPOINT_COOKIE, token, secureCookieOptions(config.secureCookies, { maxAge: Math.ceil((value.expiresAt - now) / 1000) }));
    },
    async clearProvisionalSession() {
      try { if (client) await client.auth.signOut({ scope: "local" }); }
      finally {
        const expired = secureCookieOptions(config.secureCookies, { maxAge: 0 });
        for (const name of new Set([AUTH_COOKIE_NAME, SIGNUP_CHECKPOINT_COOKIE, ...jar.getAll().filter(cookie => authCookie(cookie.name)).map(cookie => cookie.name)])) jar.set(name, "", expired);
      }
    },
  };
}
