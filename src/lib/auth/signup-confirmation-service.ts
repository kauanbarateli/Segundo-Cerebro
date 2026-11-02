import type { SignupCheckpoint } from "./signup-checkpoint";
import type { SignupReconsentCheckpoint } from "./signup-reconsent-checkpoint";
import { validEmail } from "./policy";

export interface SignupConfirmationPorts {
  now(): number;
  /** Do not overwrite an existing authenticated browser session. */
  canBegin(): boolean;
  /** Limits by a server HMAC; must be supplemented by provider/edge limits. */
  limitToken(tokenHash: string): Promise<{ allowed: boolean }>;
  /** Verifies a purpose-bound OTP, then independently verifies user and session with Auth. */
  verifyEmailProof(tokenHash: string): Promise<{ userId: string; sessionId: string; email: string } | null>;
  subjectHash(email: string): string;
  findBoundIntent(userId: string, sessionId: string, subjectHash: string): Promise<{ intentId: string; termsVersion: string; privacyVersion: string; state: "bound" | "consumed"; originPending: boolean } | null>;
  /** Only after this request has successfully verified a signup OTP. */
  recoverVerifiedIntent(userId: string, sessionId: string, subjectHash: string, terms: string, privacy: string): Promise<{ intentId: string; termsVersion: string; privacyVersion: string; state: "bound" | "consumed"; originPending: boolean }>;
  /** Strict fallback only, after OTP; never creates or changes an intent. */
  inspectReconsent?(userId:string,sessionId:string,subjectHash:string,terms:string,privacy:string):Promise<{intentId:string;originPending:boolean}|null>;
  putReconsentCheckpoint?(value:SignupReconsentCheckpoint):Promise<void>;
  /** Signs the checkpoint and sets a secure, HttpOnly cookie; never exposes it to the UI. */
  putCheckpoint(value: SignupCheckpoint): Promise<void>;
  /** Clear any provisional Auth cookies and checkpoint on failure. */
  clearProvisionalSession(): Promise<void>;
}
export type SignupConfirmationResult = { status: "ready" | "reconsent" | "invalid" | "rate-limited" | "unavailable" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only a trusted caller that has just verified a purpose-bound OTP may call this. */
export async function continueVerifiedSignup(ports: SignupConfirmationPorts, identity: {userId:string;sessionId:string;email:string}, legal: {terms:string;privacy:string}): Promise<SignupConfirmationResult> {
    if (!UUID.test(identity.userId) || !UUID.test(identity.sessionId) || typeof identity.email !== "string" || /[\u0000-\u001f\u007f-\u009f<>]/u.test(identity.email)) return { status: "invalid" };
    const email = identity.email.trim().toLowerCase();
    if (!validEmail(email)) return { status: "invalid" };
    const hash = ports.subjectHash(email);
    if (!/^[a-f0-9]{64}$/.test(hash)) return { status: "unavailable" };
    const existing = await ports.findBoundIntent(identity.userId, identity.sessionId, hash);
    if (!legal.terms || !legal.privacy) return { status: "invalid" };
    if (existing && existing.state !== "bound") return { status: "invalid" };
    let intent;
    try { intent = await ports.recoverVerifiedIntent(identity.userId, identity.sessionId, hash, legal.terms, legal.privacy); }
    catch (error) {
      if(!ports.inspectReconsent || !ports.putReconsentCheckpoint) throw error;
      const pending=await ports.inspectReconsent(identity.userId,identity.sessionId,hash,legal.terms,legal.privacy);
      if(!pending || !UUID.test(pending.intentId) || typeof pending.originPending!=="boolean") return {status:"unavailable"};
      const now=ports.now();if(!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(now+600_000)) return {status:"unavailable"};
      await ports.putReconsentCheckpoint({checkpoint:{userId:identity.userId,sessionId:identity.sessionId,intentId:pending.intentId,issuedAt:now,expiresAt:now+600_000,passwordConfirmed:false,originPending:pending.originPending},terms:legal.terms,privacy:legal.privacy});
      return {status:"reconsent"};
    }
    if (!intent || intent.state !== "bound" || !UUID.test(intent.intentId) || intent.termsVersion !== legal.terms || intent.privacyVersion !== legal.privacy) return { status: "invalid" };
    const now = ports.now();
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + 600_000)) return { status: "unavailable" };
    await ports.putCheckpoint({ userId: identity.userId, sessionId: identity.sessionId, intentId: intent.intentId, issuedAt: now, expiresAt: now + 600_000, passwordConfirmed: false, originPending: intent.originPending });
    return { status: "ready" };
}

/** Invoke only on an explicit same-origin POST, never while rendering a GET. */
export async function verifySignupConfirmation(ports: SignupConfirmationPorts, tokenHash: unknown, legal: { terms: string; privacy: string }): Promise<SignupConfirmationResult> {
  if (typeof tokenHash !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(tokenHash)) return { status: "invalid" };
  let verificationStarted = false;
  const perform = async (): Promise<SignupConfirmationResult> => { try {
    if (!ports.canBegin()) return { status: "unavailable" };
    if (!(await ports.limitToken(tokenHash)).allowed) return { status: "rate-limited" };
    verificationStarted = true;
    const identity = await ports.verifyEmailProof(tokenHash);
    if (!identity) return { status: "invalid" };
    return await continueVerifiedSignup(ports,identity,legal);
  } catch { return { status: "unavailable" }; }
  };
  const result = await perform();
  if (verificationStarted && result.status !== "ready" && result.status !== "reconsent") {
    try { await ports.clearProvisionalSession(); } catch { return { status: "unavailable" }; }
  }
  return result;
}
