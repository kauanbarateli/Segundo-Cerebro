import type { SignupCheckpoint } from "./signup-checkpoint";
import { validEmail } from "./policy";

export interface SignupConfirmationPorts {
  now(): number;
  /** Do not overwrite an existing authenticated browser session. */
  canBegin(): boolean;
  /** Limits by a server HMAC; must be supplemented by provider/edge limits. */
  limitToken(tokenHash: string): Promise<{ allowed: boolean }>;
  /** Verifies a signup OTP, then independently verifies user and session with Auth. */
  verifySignupToken(tokenHash: string): Promise<{ userId: string; sessionId: string; email: string } | null>;
  subjectHash(email: string): string;
  findBoundIntent(userId: string, sessionId: string, subjectHash: string): Promise<{ intentId: string; termsVersion: string; privacyVersion: string; state: "bound" | "consumed" } | null>;
  /** Signs the checkpoint and sets a secure, HttpOnly cookie; never exposes it to the UI. */
  putCheckpoint(value: SignupCheckpoint): Promise<void>;
  /** Clear any provisional Auth cookies and checkpoint on failure. */
  clearProvisionalSession(): Promise<void>;
}
export type SignupConfirmationResult = { status: "ready" | "invalid" | "rate-limited" | "unavailable" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Invoke only on an explicit same-origin POST, never while rendering a GET. */
export async function verifySignupConfirmation(ports: SignupConfirmationPorts, tokenHash: unknown, legal: { terms: string; privacy: string }): Promise<SignupConfirmationResult> {
  if (typeof tokenHash !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(tokenHash)) return { status: "invalid" };
  let verificationStarted = false;
  const perform = async (): Promise<SignupConfirmationResult> => { try {
    if (!ports.canBegin()) return { status: "unavailable" };
    if (!(await ports.limitToken(tokenHash)).allowed) return { status: "rate-limited" };
    verificationStarted = true;
    const identity = await ports.verifySignupToken(tokenHash);
    if (!identity || !UUID.test(identity.userId) || !UUID.test(identity.sessionId) || typeof identity.email !== "string" || /[\u0000-\u001f\u007f-\u009f<>]/u.test(identity.email)) return { status: "invalid" };
    const email = identity.email.trim().toLowerCase();
    if (!validEmail(email)) return { status: "invalid" };
    const hash = ports.subjectHash(email);
    if (!/^[a-f0-9]{64}$/.test(hash)) return { status: "unavailable" };
    const intent = await ports.findBoundIntent(identity.userId, identity.sessionId, hash);
    if (!intent || intent.state !== "bound" || !UUID.test(intent.intentId) || !legal.terms || !legal.privacy || intent.termsVersion !== legal.terms || intent.privacyVersion !== legal.privacy) return { status: "invalid" };
    const now = ports.now();
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + 600_000)) return { status: "unavailable" };
    await ports.putCheckpoint({ userId: identity.userId, sessionId: identity.sessionId, intentId: intent.intentId, issuedAt: now, expiresAt: now + 600_000, passwordConfirmed: false });
    return { status: "ready" };
  } catch { return { status: "unavailable" }; }
  };
  const result = await perform();
  if (verificationStarted && result.status !== "ready") {
    try { await ports.clearProvisionalSession(); } catch { return { status: "unavailable" }; }
  }
  return result;
}
