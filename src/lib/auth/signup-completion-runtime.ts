import "server-only";
import { randomUUID } from "node:crypto";
import { createPrivilegedClient, createRequestClient, type AuthCookieJar } from "./clients";
import type { SupabaseAuthConfig } from "./config";
import { secureCookieOptions } from "./cookie-policy";
import { subjectHash } from "./flow-state";
import { verifySignupCheckpoint } from "./signup-checkpoint";
import { createSignupConfirmationPorts, SIGNUP_CHECKPOINT_COOKIE } from "./signup-confirmation-runtime";
import { signupEnabled, signupFenceRpc, signupUnavailable } from "./signup-http";
import { fencePorts } from "./signup-fence-wire";
import type { SignupCompletionPorts } from "./signup-completion-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Candidate adapter; the server must enforce POST, same origin and legal consent. */
export function createSignupCompletionPorts(config: SupabaseAuthConfig, jar: AuthCookieJar, responseHeaders?: Headers): SignupCompletionPorts {
  const confirmation = createSignupConfirmationPorts(config, jar, responseHeaders);
  let client: ReturnType<typeof createRequestClient> | undefined;
  const requestClient = () => client ??= createRequestClient(config, jar, true, responseHeaders);
  return {
    // signupEnabled contains an unconditional false release gate in this draft.
    reservationEnabled: () => signupEnabled(config),
    ...fencePorts((name, args) => signupFenceRpc(config, name, args)),
    newRequestId: randomUUID,
    now: Date.now,
    readCheckpoint() {
      if (!signupEnabled(config)) return null;
      const matches = jar.getAll().filter(cookie => cookie.name === SIGNUP_CHECKPOINT_COOKIE);
      return matches.length === 1 ? verifySignupCheckpoint(matches[0]?.value, config.stateSecret, Date.now()) : null;
    },
    async readVerifiedIdentity() {
      if (!signupEnabled(config)) return null;
      const request = requestClient(), { data: verified, error } = await request.auth.getUser();
      if (error || !verified.user || verified.user.is_anonymous || !verified.user.email || !verified.user.email_confirmed_at) return null;
      const { data, error: claimsError } = await request.auth.getClaims();
      const sessionId = data?.claims.session_id;
      if (claimsError || data?.claims.sub !== verified.user.id || typeof sessionId !== "string" || !UUID.test(sessionId) || !UUID.test(verified.user.id)) return null;
      return { userId: verified.user.id, sessionId, email: verified.user.email };
    },
    subjectHash: email => subjectHash(config.rateLimitSecret, "signup-request", email),
    async limit(userId) {
      if (!signupEnabled(config)) return signupUnavailable();
      const { data, error } = await createPrivilegedClient(config).rpc("consume_rate_limit", { p_scope: "login", p_subject_hash: subjectHash(config.rateLimitSecret, "signup-completion", userId) });
      if (error || !data || typeof data !== "object" || Array.isArray(data) || typeof data.allowed !== "boolean") return signupUnavailable();
      return { allowed: data.allowed };
    },
    findBoundIntent: confirmation.findBoundIntent,
    async updatePassword(password) {
      if (!signupEnabled(config)) return "unknown";
      try {
        const { error } = await requestClient().auth.updateUser({ password });
        if (!error) return "updated";
        return error.status === 400 || error.status === 422 ? "rejected" : "unknown";
      } catch { return "unknown"; }
    },
    async clearCheckpoint() { jar.set(SIGNUP_CHECKPOINT_COOKIE, "", secureCookieOptions(config.secureCookies, { maxAge: 0 })); },
  };
}
