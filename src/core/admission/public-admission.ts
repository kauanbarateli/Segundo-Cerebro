/**
 * Decision over evidence already verified by trusted server adapters.
 * This is not an authentication, session, database or Storage gate.
 * Do not construct this evidence from request JSON or editable Auth metadata.
 */
export type AdmissionEvidence = Readonly<{
  now: number;
  signupEnabled: boolean;
  identity: Readonly<{ userId: string; sessionId: string; emailVerified: boolean; sessionValid: boolean; moderation: "allowed" | "blocked" }> | null;
  admission: Readonly<{ userId: string; origin: "legacy" | "admin" | "public"; state: "pending" | "admitted" }> | null;
  intent: Readonly<{ id: string; userId: string; state: "pending" | "consumed"; expiresAt: number }> | null;
  legal: Readonly<{ accepted: boolean; termsVersion: string; privacyVersion: string }> | null;
  currentLegal: Readonly<{ termsVersion: string; privacyVersion: string }>;
  passwordProof: Readonly<{ userId: string; sessionId: string; method: "controlled-fresh-signup" | "reset-after-confirmation"; valid: boolean }> | null;
}>;

export type AdmissionDecision =
  | { kind: "unchanged" }
  | { kind: "admit"; userId: string; intentId: string; termsVersion: string; privacyVersion: string }
  | { kind: "deny"; reason: "identity" | "moderation" | "disabled" | "intent" | "legal" | "password-proof" };

/** An `admit` result is a plan only; a transaction must recheck every fact. */
export function decidePublicAdmission(evidence: AdmissionEvidence): AdmissionDecision {
  const { identity, admission, intent, legal, currentLegal, passwordProof } = evidence;
  if (!identity || !identity.userId || !identity.sessionId || identity.sessionValid !== true || identity.emailVerified !== true) return { kind: "deny", reason: "identity" };
  if (identity.moderation !== "allowed") return { kind: "deny", reason: "moderation" };
  // Preserve all already admitted identities and do not rewrite legacy/Admin state.
  if (admission && admission.userId === identity.userId && (admission.state === "admitted" || admission.origin !== "public")) return { kind: "unchanged" };
  if (!evidence.signupEnabled) return { kind: "deny", reason: "disabled" };
  if (!Number.isSafeInteger(evidence.now) || !intent || !intent.id || intent.userId !== identity.userId || intent.state !== "pending" || !Number.isSafeInteger(intent.expiresAt) || intent.expiresAt <= evidence.now || (admission && (admission.userId !== identity.userId || admission.origin !== "public" || admission.state !== "pending"))) return { kind: "deny", reason: "intent" };
  if (!legal || legal.accepted !== true || !currentLegal.termsVersion || !currentLegal.privacyVersion || legal.termsVersion !== currentLegal.termsVersion || legal.privacyVersion !== currentLegal.privacyVersion) return { kind: "deny", reason: "legal" };
  if (!passwordProof || passwordProof.valid !== true || passwordProof.userId !== identity.userId || passwordProof.sessionId !== identity.sessionId || !["controlled-fresh-signup", "reset-after-confirmation"].includes(passwordProof.method)) return { kind: "deny", reason: "password-proof" };
  return { kind: "admit", userId: identity.userId, intentId: intent.id, termsVersion: legal.termsVersion, privacyVersion: legal.privacyVersion };
}
