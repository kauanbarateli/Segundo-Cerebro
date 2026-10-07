import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createPrivilegedClient, createRequestClient, type AuthCookieJar } from "./clients";
import { readAuthConfiguration, type SupabaseAuthConfig } from "./config";
import { FLOW_COOKIE_NAMES, isOwnedAuthCookie, secureCookieOptions } from "./cookie-policy";
import { signFlow, subjectHash, verifyFlow } from "./flow-state";
import { parseAccessState } from "./policy";
import type { AuthServices } from "./ports";
import { AuthGuardError } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createAuthServices(config: SupabaseAuthConfig, jar: AuthCookieJar, writable = true, responseHeaders?: Headers): AuthServices {
  const client = createRequestClient(config, jar, writable, responseHeaders);
  // Privileged client is lazy: ordinary guards never instantiate a service client.
  const privileged = () => createPrivilegedClient(config);
  const unavailable = () => { throw new AuthGuardError("unavailable"); };
  return {
    appOrigin: config.appOrigin, stateSecret: config.stateSecret, now: Date.now, randomId: randomUUID,
    flows: {
      get(kind) { return verifyFlow(jar.getAll().find((cookie) => cookie.name === FLOW_COOKIE_NAMES[kind])?.value, config.stateSecret, Date.now()); },
      put(flow) { if (!writable) throw new AuthGuardError("unavailable"); jar.set(FLOW_COOKIE_NAMES[flow.kind], signFlow(flow, config.stateSecret), secureCookieOptions(config.secureCookies, { maxAge: Math.max(0, Math.ceil((flow.expiresAt - Date.now()) / 1000)) })); },
      clear(kind) { if (!writable) throw new AuthGuardError("unavailable"); jar.set(FLOW_COOKIE_NAMES[kind], "", secureCookieOptions(config.secureCookies, { maxAge: 0 })); },
      clearSessionCookies() { if (!writable) throw new AuthGuardError("unavailable"); for (const { name } of jar.getAll()) if (isOwnedAuthCookie(name)) jar.set(name, "", secureCookieOptions(config.secureCookies, { maxAge: 0 })); },
    },
    gateway: {
      async readIdentity() {
        const { data: verified, error: userError } = await client.auth.getUser();
        if (userError) { if (userError.status === 400 || userError.status === 401 || userError.status === 403 || userError.name === "AuthSessionMissingError") return null; return unavailable(); }
        if (!verified.user || verified.user.is_anonymous) return null;
        const { data: signed, error: claimsError } = await client.auth.getClaims();
        const sessionId = signed?.claims.session_id;
        if (claimsError || signed?.claims.sub !== verified.user.id || typeof sessionId !== "string" || !UUID.test(sessionId)) return unavailable();
        const { data, error } = await client.rpc("my_access_state");
        if (error) { if (error.code === "42501") return null; return unavailable(); }
        return parseAccessState(data, verified.user.id, sessionId, verified.user.email);
      },
      async signIn(email, password) { const { error } = await client.auth.signInWithPassword({ email, password }); return !error; },
      async requestRecovery(email, redirectTo) { const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo }); if (error) unavailable(); },
      async exchangeCode(code, flowId) { const { error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined); return !error; },
      async updatePassword(password, currentPassword) { const { error } = await client.auth.updateUser({ password, ...(currentPassword ? { current_password: currentPassword } : {}) }); return !error; },
      async signOut(scope) { const { error } = await client.auth.signOut({ scope }); return !error; },
      async completePasswordChange(identity, clientId) {
        const { error } = await privileged().rpc("complete_password_change", { p_user: identity.userId, p_session: identity.sessionId, p_client_id: clientId });
        if (error) unavailable();
      },
    },
    async limit(kind, subject, identity) {
      const { data, error } = await privileged().rpc("consume_rate_limit", {
        p_scope: kind === "password" ? "identity_write" : "login",
        p_subject_hash: subjectHash(config.rateLimitSecret, kind, subject),
        p_user: identity?.userId ?? null, p_session: identity?.sessionId ?? null,
      });
      if (error || !data || typeof data !== "object" || typeof data.allowed !== "boolean" || !Number.isFinite(data.retry_after_ms) || data.retry_after_ms < 0) return unavailable();
      return { allowed: data.allowed as boolean, retryAfterSeconds: Math.max(1, Math.ceil(data.retry_after_ms / 1000)) };
    },
  };
}
export async function requestAuthServices(writable = false, responseHeaders?: Headers): Promise<AuthServices> {
  const config = readAuthConfiguration();
  if (config.mode === "demo") throw new AuthGuardError("demo");
  const jar = await cookies();
  return createAuthServices(config, { getAll: () => jar.getAll(), set: (name, value, options) => { jar.set(name, value, options); } }, writable, responseHeaders);
}
