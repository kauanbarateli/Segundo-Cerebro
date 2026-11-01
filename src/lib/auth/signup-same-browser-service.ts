import "server-only";
import { validEmail } from "./policy";

/** Draft only. Callers must enforce same-origin, CSRF, token/IP limits and no logging. */
export interface SameBrowserSignupPorts {
  /** Refuse to replace any existing authenticated browser session. */
  canBegin(): boolean;
  /** Domain-separated HMAC of a random, server-issued HttpOnly cookie. */
  browserHash(secret: string): string;
  /** Returns a live intent only when its Auth INSERT actually bound it. */
  findAttempt(hash: string): Promise<{ intentId: string } | null>;
  /** One-time email proof followed by verified getUser and getClaims. */
  verifyEmailProof(token: string): Promise<{ userId: string; sessionId: string; email: string } | null>;
  subjectHash(email: string): string;
  /** Atomic admission validates user, session, moderation, intent, legal and consent. */
  admit(input: { userId: string; sessionId: string; intentId: string; subjectHash: string; browserHash: string; terms: string; privacy: string; acceptOrigin: boolean; originVersion: string }): Promise<unknown>;
  clearProvisionalSession(): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
/** Same-browser channel only. No provider password update occurs in this flow. */
export async function confirmSameBrowserSignup(ports: SameBrowserSignupPorts, input: { browserSecret: unknown; token: unknown; terms: unknown; privacy: unknown; acceptOrigin: unknown }, current: { terms: string; privacy: string; originVersion: string }): Promise<{ status: "completed" | "other-browser" | "unavailable" }> {
  if (typeof input.browserSecret !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(input.browserSecret)) return { status: "other-browser" };
  if (typeof input.token !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(input.token) || typeof input.terms !== "string" || !input.terms || typeof input.privacy !== "string" || !input.privacy || typeof input.acceptOrigin !== "boolean" || !current.terms || !current.privacy || !current.originVersion || input.terms !== current.terms || input.privacy !== current.privacy) return { status: "unavailable" };
  let started = false;
  try {
    if (!ports.canBegin()) return { status: "unavailable" };
    const browserHash = ports.browserHash(input.browserSecret);
    if (!HASH.test(browserHash)) return { status: "unavailable" };
    // Check before OTP so opening a link on another device never consumes it.
    const attempt = await ports.findAttempt(browserHash);
    if (!attempt || !UUID.test(attempt.intentId)) return { status: "other-browser" };
    started = true;
    const identity = await ports.verifyEmailProof(input.token);
    if (!identity || !UUID.test(identity.userId) || !UUID.test(identity.sessionId) || typeof identity.email !== "string" || /[\u0000-\u001f\u007f-\u009f<>]/u.test(identity.email)) throw Error("unavailable");
    const email = identity.email.trim().toLowerCase();
    if (!validEmail(email)) throw Error("unavailable");
    const subjectHash = ports.subjectHash(email);
    if (!HASH.test(subjectHash)) throw Error("unavailable");
    const result = await ports.admit({ userId: identity.userId, sessionId: identity.sessionId, intentId: attempt.intentId, subjectHash, browserHash, terms: current.terms, privacy: current.privacy, acceptOrigin: input.acceptOrigin, originVersion: current.originVersion });
    if (result !== true) throw Error("unavailable");
    return { status: "completed" };
  } catch {
    if (started) { try { await ports.clearProvisionalSession(); } catch { /* fail closed */ } }
    return { status: "unavailable" };
  }
}
