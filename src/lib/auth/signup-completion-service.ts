import { validEmail, validNewPassword } from "./policy";
import type { SignupCheckpoint } from "./signup-checkpoint";

type PendingIdentity = { userId: string; sessionId: string; email: string };
type Intent = { intentId: string; termsVersion: string; privacyVersion: string; state: "bound" | "consumed" };
export interface SignupCompletionPorts {
  now(): number;
  /** Reads and verifies the signed HttpOnly checkpoint; never client-supplied identity. */
  readCheckpoint(): SignupCheckpoint | null;
  readVerifiedIdentity(): Promise<PendingIdentity | null>;
  subjectHash(email: string): string;
  limit(userId: string): Promise<{ allowed: boolean }>;
  findBoundIntent(userId: string, sessionId: string, hash: string): Promise<Intent | null>;
  updatePassword(password: string): Promise<"updated" | "rejected" | "unknown">;
  putCheckpoint(value: SignupCheckpoint): Promise<void>;
  attestPasswordReset(userId: string, sessionId: string, intentId: string, hash: string): Promise<void>;
  complete(userId: string, sessionId: string, intentId: string, hash: string, terms: string, privacy: string): Promise<"admitted" | "already_admitted">;
  clearCheckpoint(): Promise<void>;
}
export type SignupCompletionResult = { status: "completed" | "invalid" | "password-invalid" | "rate-limited" | "needs-verification" | "unavailable" };

/** Explicit POST only. A signed checkpoint is meaningful only with the same verified session. */
export async function completePublicSignup(ports: SignupCompletionPorts, input: { password: unknown; acceptedLegal: unknown; termsVersion: unknown; privacyVersion: unknown }, current: { terms: string; privacy: string }): Promise<SignupCompletionResult> {
  try {
    let checkpoint = ports.readCheckpoint();
    const now = ports.now();
    if (!checkpoint || !Number.isSafeInteger(now) || checkpoint.expiresAt <= now) return { status: "needs-verification" };
    let identity = await ports.readVerifiedIdentity();
    if (!identity || identity.userId !== checkpoint.userId || identity.sessionId !== checkpoint.sessionId || /[\u0000-\u001f\u007f-\u009f<>]/u.test(identity.email)) return { status: "needs-verification" };
    const email = identity.email.trim().toLowerCase();
    if (!validEmail(email)) return { status: "needs-verification" };
    if (!(await ports.limit(identity.userId)).allowed) return { status: "rate-limited" };
    const hash = ports.subjectHash(email);
    if (!/^[a-f0-9]{64}$/.test(hash)) return { status: "unavailable" };
    const intent = await ports.findBoundIntent(identity.userId, identity.sessionId, hash);
    if (!intent || intent.intentId !== checkpoint.intentId) return { status: "needs-verification" };
    // A previous commit may have succeeded even when its response was lost.
    if (intent.state === "consumed") {
      await ports.complete(identity.userId, identity.sessionId, intent.intentId, hash, intent.termsVersion, intent.privacyVersion);
      await ports.clearCheckpoint(); return { status: "completed" };
    }
    if (input.acceptedLegal !== true || input.termsVersion !== current.terms || input.privacyVersion !== current.privacy || intent.termsVersion !== current.terms || intent.privacyVersion !== current.privacy || !current.terms || !current.privacy) return { status: "invalid" };
    if (!checkpoint.passwordConfirmed) {
      if (typeof input.password !== "string" || input.password.length > 4096 || !validNewPassword(input.password)) return { status: "password-invalid" };
      const outcome = await ports.updatePassword(input.password);
      if (outcome === "rejected") return { status: "password-invalid" };
      if (outcome !== "updated") return { status: "needs-verification" };
      const updated = await ports.readVerifiedIdentity();
      if (!updated || updated.userId !== identity.userId || !updated.sessionId || updated.email.trim().toLowerCase() !== email) return { status: "needs-verification" };
      identity = updated;
      checkpoint = { ...checkpoint, sessionId: identity.sessionId, passwordConfirmed: true };
      // Preserve the acknowledged password step for retry before database writes.
      await ports.putCheckpoint(checkpoint);
    }
    await ports.attestPasswordReset(identity.userId, identity.sessionId, intent.intentId, hash);
    await ports.complete(identity.userId, identity.sessionId, intent.intentId, hash, intent.termsVersion, intent.privacyVersion);
    await ports.clearCheckpoint();
    return { status: "completed" };
  } catch { return { status: "unavailable" }; }
}
