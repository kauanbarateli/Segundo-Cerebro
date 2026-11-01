import { validEmail, validNewPassword } from "./policy";

type LegalVersions = Readonly<{ terms: string; privacy: string }>;
export type SignupRequest = Readonly<{ email: string; password: string; termsVersion: string; privacyVersion: string }>;
export type SignupValidation = { ok: true; value: SignupRequest } | { ok: false; reason: "input" | "email" | "password" | "legal" };
const FIELDS = ["email", "password", "acceptedLegal", "termsVersion", "privacyVersion"] as const;

/**
 * Validates only the basic fields. The caller must bound the body, enforce
 * origin/rate limits and never log the returned credentials. UTM consent has
 * a separate contract and must never be inferred from legal acceptance.
 */
export function validateSignupRequest(input: unknown, current: LegalVersions): SignupValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, reason: "input" };
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Object.keys(descriptors).length !== FIELDS.length || FIELDS.some(field => !(field in descriptors) || !("value" in descriptors[field]!))) return { ok: false, reason: "input" };
  const { email, password, acceptedLegal, termsVersion, privacyVersion } = Object.fromEntries(FIELDS.map(field => [field, descriptors[field]!.value]));
  if (typeof email !== "string" || email.length > 512 || /[\u0000-\u001f\u007f-\u009f<>]/u.test(email) || !validEmail(email.trim().toLowerCase())) return { ok: false, reason: "email" };
  if (typeof password !== "string" || password.length > 4096 || !validNewPassword(password)) return { ok: false, reason: "password" };
  if (acceptedLegal !== true || typeof termsVersion !== "string" || typeof privacyVersion !== "string" || !current.terms || !current.privacy || termsVersion !== current.terms || privacyVersion !== current.privacy) return { ok: false, reason: "legal" };
  return { ok: true, value: { email: email.trim().toLowerCase(), password, termsVersion, privacyVersion } };
}
