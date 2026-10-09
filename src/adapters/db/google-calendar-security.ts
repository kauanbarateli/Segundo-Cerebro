import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { assinatura } from "../../core/contracts/base";
import { CALENDAR_SCOPES, type CalendarCipher, type CalendarTokens, type EncryptedCalendarTokens } from "../../core/calendario";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError } from "../../lib/auth/types";
export const GOOGLE_FLOW_COOKIE = "sc-google-calendar-flow";
export const GOOGLE_CALLBACK_PATH = "/api/calendar/oauth/callback";
export interface GoogleCalendarConfig { appOrigin: string; secureCookies: boolean; clientId: string; clientSecret: string; stateSecret: string; tokenKeyId: string; tokenKeys: ReadonlyMap<string, Buffer>; cronSecret: string | null; redirectUri: string }
function unavailable(): never { throw new AuthGuardError("unavailable"); }
const uuid = (v: unknown) => typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function key(value: string | undefined): Buffer { if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return unavailable(); const result = Buffer.from(value, "base64"); if (result.length !== 32 || result.toString("base64") !== value) unavailable(); return result; }
export function readGoogleCalendarConfig(auth: SupabaseAuthConfig, environment: Record<string, string | undefined> = process.env): GoogleCalendarConfig {
 const state = environment.GOOGLE_CALENDAR_STATE_SECRET, keyId = environment.GOOGLE_CALENDAR_TOKEN_KEY_ID, clientId = environment.GOOGLE_OAUTH_CLIENT_ID, clientSecret = environment.GOOGLE_OAUTH_CLIENT_SECRET;
 if (!state || Buffer.byteLength(state) < 32 || [auth.stateSecret, auth.rateLimitSecret, auth.secretKey, environment.ADMIN_COMMAND_SECRET].includes(state) || !keyId || !/^[A-Za-z0-9_-]{1,32}$/.test(keyId) || !clientId || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId) || !clientSecret || clientSecret.length > 256 || /[\s\u0000-\u001f]/.test(clientSecret)) unavailable();
 const active = key(environment.GOOGLE_CALENDAR_TOKEN_KEY), keys = new Map<string, Buffer>([[keyId, active]]);
 if (environment.GOOGLE_CALENDAR_TOKEN_KEYS) { let previous: unknown; try { previous = JSON.parse(environment.GOOGLE_CALENDAR_TOKEN_KEYS); } catch { unavailable(); } if (!object(previous) || Object.keys(previous).length > 5) unavailable(); for (const [id, value] of Object.entries(previous)) { if (!/^[A-Za-z0-9_-]{1,32}$/.test(id) || typeof value !== "string" || id === keyId) unavailable(); keys.set(id, key(value)); } }
 if ([state, auth.stateSecret, auth.rateLimitSecret, auth.secretKey, environment.ADMIN_COMMAND_SECRET].some(secret => secret && (secret === active.toString("base64") || (Buffer.byteLength(secret) === 32 && Buffer.from(secret).equals(active))))) unavailable();
 const cron = environment.GOOGLE_CALENDAR_CRON_SECRET ?? null;
 if (cron && (Buffer.byteLength(cron) < 32 || [state, active.toString("base64"), auth.stateSecret, auth.rateLimitSecret, auth.secretKey, environment.ADMIN_COMMAND_SECRET].includes(cron))) unavailable();
 return { appOrigin: auth.appOrigin, secureCookies: auth.secureCookies, clientId, clientSecret, stateSecret: state, tokenKeyId: keyId, tokenKeys: keys, cronSecret: cron, redirectUri: auth.appOrigin + GOOGLE_CALLBACK_PATH };
}
function aad(owner: string, account: string, credentialVersion: number, envelope: Pick<EncryptedCalendarTokens, "version" | "key_id">) { if (!uuid(owner) || !uuid(account) || !Number.isSafeInteger(credentialVersion) || credentialVersion < 1 || credentialVersion > 2_147_483_647) unavailable(); return Buffer.from(assinatura(["google-calendar-tokens", owner, account, credentialVersion, envelope.version, envelope.key_id])); }
export function calendarTokenCipher(config: GoogleCalendarConfig): CalendarCipher {
 return {
  encrypt(owner, account, credentialVersion, tokens) { const iv = randomBytes(12), envelope = { version: 1 as const, key_id: config.tokenKeyId }; const cipher = createCipheriv("aes-256-gcm", config.tokenKeys.get(config.tokenKeyId) ?? unavailable(), iv); cipher.setAAD(aad(owner, account, credentialVersion, envelope)); const plaintext = Buffer.from(JSON.stringify(tokens)); try { const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]); return { ...envelope, iv: iv.toString("base64"), ciphertext: ciphertext.toString("base64"), tag: cipher.getAuthTag().toString("base64") }; } finally { plaintext.fill(0); } },
  decrypt(owner, account, credentialVersion, envelope) {
   try {
    if (envelope.version !== 1 || Object.keys(envelope).some(field => !["version", "key_id", "iv", "ciphertext", "tag"].includes(field))) unavailable(); const tokenKey = config.tokenKeys.get(envelope.key_id); if (!tokenKey || ![envelope.iv, envelope.ciphertext, envelope.tag].every(value => typeof value === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(value))) unavailable();
    const iv = Buffer.from(envelope.iv, "base64"), tag = Buffer.from(envelope.tag, "base64"), ciphertext = Buffer.from(envelope.ciphertext, "base64"); if (iv.length !== 12 || tag.length !== 16 || ciphertext.length < 2 || ciphertext.length > 32768) unavailable();
    const decipher = createDecipheriv("aes-256-gcm", tokenKey, iv); decipher.setAAD(aad(owner, account, credentialVersion, envelope)); decipher.setAuthTag(tag); const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    try { const value: unknown = JSON.parse(plaintext.toString("utf8")); if (!object(value) || Object.keys(value).some(field => !["access_token", "refresh_token", "expires_at", "scopes"].includes(field)) || typeof value.access_token !== "string" || !value.access_token || typeof value.refresh_token !== "string" || !value.refresh_token || typeof value.expires_at !== "string" || !Number.isFinite(Date.parse(value.expires_at)) || !Array.isArray(value.scopes) || !value.scopes.every(scope => typeof scope === "string")) unavailable(); return value as unknown as CalendarTokens; } finally { plaintext.fill(0); }
   } catch { return unavailable(); }
  },
 };
}
export interface GoogleOAuthCookie { version: 1; flow_id: string; nonce: string; user_id: string; session_id: string; account_id: string; verifier: string; expires_at: number }
function signed(value: unknown, purpose: string, secret: string) { const body = Buffer.from(JSON.stringify(value)).toString("base64url"); return body + "." + createHmac("sha256", secret).update(purpose + ":" + body).digest("base64url"); }
function unsigned(value: string | undefined, purpose: string, secret: string): Record<string, unknown> | null {
 if (!value || value.length > 4096) return null; const [body, mac, extra] = value.split("."); if (!body || !mac || extra || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(mac)) return null;
 const expected = createHmac("sha256", secret).update(purpose + ":" + body).digest(), actual = Buffer.from(mac, "base64url"); if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
 try { const result: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return object(result) ? result : null; } catch { return null; }
}
function ownerBinding(secret: string, userId: string, sessionId: string) { return createHmac("sha256", secret).update(assinatura(["calendar-owner-session", userId, sessionId])).digest("hex"); }
export function newGoogleFlow(config: GoogleCalendarConfig, userId: string, sessionId: string, now: number) {
 const flowId = randomUUID(), nonce = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url"), expiresAt = now + 600_000;
 const state = signed({ version: 1, flow_id: flowId, nonce, binding: ownerBinding(config.stateSecret, userId, sessionId), expires_at: expiresAt }, "calendar-state", config.stateSecret);
 return { flowId, verifier, nonce, expiresAt, state, digest: createHash("sha256").update(state).digest("hex"), cookie(accountId: string) { return signed({ version: 1, flow_id: flowId, nonce, user_id: userId, session_id: sessionId, account_id: accountId, verifier, expires_at: expiresAt } satisfies GoogleOAuthCookie, "calendar-cookie", config.stateSecret); } };
}
export function verifyGoogleFlow(config: GoogleCalendarConfig, state: string | undefined, cookie: string | undefined, userId: string, sessionId: string, now: number): { flow: GoogleOAuthCookie; digest: string } | null {
 const query = unsigned(state, "calendar-state", config.stateSecret), flow = unsigned(cookie, "calendar-cookie", config.stateSecret);
 if (!query || !flow || query.version !== 1 || flow.version !== 1 || Object.keys(query).some(field => !["version", "flow_id", "nonce", "binding", "expires_at"].includes(field)) || Object.keys(flow).some(field => !["version", "flow_id", "nonce", "user_id", "session_id", "account_id", "verifier", "expires_at"].includes(field)) || flow.user_id !== userId || flow.session_id !== sessionId || query.binding !== ownerBinding(config.stateSecret, userId, sessionId) || flow.flow_id !== query.flow_id || !uuid(flow.flow_id) || !uuid(flow.account_id) || flow.nonce !== query.nonce || typeof flow.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(flow.nonce) || typeof flow.verifier !== "string" || !/^[A-Za-z0-9_-]{64}$/.test(flow.verifier) || flow.expires_at !== query.expires_at || !Number.isSafeInteger(flow.expires_at) || (flow.expires_at as number) <= now || (flow.expires_at as number) > now + 600_000 || !state) return null;
 return { flow: flow as unknown as GoogleOAuthCookie, digest: createHash("sha256").update(state).digest("hex") };
}
export function googleAuthorizationUrl(config: GoogleCalendarConfig, state: string, verifier: string) {
 const url = new URL("https://accounts.google.com/o/oauth2/v2/auth"); url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: CALENDAR_SCOPES.join(" "), access_type: "offline", prompt: "consent select_account", include_granted_scopes: "false", state, code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url") }).toString(); return url.href;
}
export function validCalendarCron(secret: string | null, authorization: string | null): boolean { if (!secret || Buffer.byteLength(secret) < 32 || !authorization || authorization.length > 1024) return false; const expected = Buffer.from("Bearer " + secret), actual = Buffer.from(authorization); return expected.length === actual.length && timingSafeEqual(expected, actual); }
