import { validateSignupRequest } from "./signup-validation";
import { parseSignupOrigin, SIGNUP_ORIGIN_CONSENT_VERSION, type SignupOrigin } from "../../core/acquisition/signup-origin";

/** Ports are server-only. Never log inputs, provider responses or exceptions. */
export interface SignupRequestPorts {
  now(): number;
  /** A cryptographically random pointer generated on the server. */
  randomPointer(): string;
  bindingHash(pointer: string): string;
  /** Domain-separated server HMAC of the normalized email. */
  subjectHash(email: string): string;
  limit(subjectHash: string): Promise<{ allowed: boolean }>;
  createIntent(value: { bindingHash: string; subjectHash: string; termsVersion: string; privacyVersion: string; expiresAt: number; origin: SignupOrigin | null; originVersion: string | null }): Promise<void>;
  /** Must use the fixed server-controlled confirmation destination and never persist a session. */
  signup(value: { email: string; password: string; pointer: string }): Promise<void>;
}
export type SignupRequestResult = { status: "accepted" | "unavailable" | "rate-limited" } | { status: "invalid"; field: "input" | "email" | "password" | "legal" };

/**
 * Prepares one attempt; neither the provider response nor matching email is
 * evidence of a newly created user or authority to grant access. The Auth INSERT
 * and a separate verification/proof workflow establish the binding and admission.
 */
export async function requestPublicSignup(ports: SignupRequestPorts, input: unknown, legal: { terms: string; privacy: string }, originChoice?: { consented: unknown; candidate: unknown }): Promise<SignupRequestResult> {
  const parsed = validateSignupRequest(input, legal);
  if (!parsed.ok) return { status: "invalid", field: parsed.reason };
  try {
    const now = ports.now(), pointer = ports.randomPointer();
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + 30 * 60 * 1000) || typeof pointer !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(pointer)) return { status: "unavailable" };
    const bindingHash = ports.bindingHash(pointer), subjectHash = ports.subjectHash(parsed.value.email);
    if (!/^[a-f0-9]{64}$/.test(bindingHash) || !/^[a-f0-9]{64}$/.test(subjectHash)) return { status: "unavailable" };
    if (!(await ports.limit(subjectHash)).allowed) return { status: "rate-limited" };
    const origin = originChoice?.consented === true ? parseSignupOrigin(true, originChoice.candidate) : null;
    await ports.createIntent({ bindingHash, subjectHash, termsVersion: parsed.value.termsVersion, privacyVersion: parsed.value.privacyVersion, expiresAt: now + 30 * 60 * 1000, origin, originVersion: origin ? SIGNUP_ORIGIN_CONSENT_VERSION : null });
    // A provider timeout or duplicate must never bind an existing account or
    // reveal whether an email exists. The intent expires if no INSERT binds it.
    try { await ports.signup({ email: parsed.value.email, password: parsed.value.password, pointer }); } catch { /* neutral response */ }
    return { status: "accepted" };
  } catch { return { status: "unavailable" }; }
}
