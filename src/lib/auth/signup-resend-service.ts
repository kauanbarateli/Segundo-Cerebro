import { validEmail } from "./policy";

export interface SignupResendPorts {
  subjectHash(email: string): string;
  limit(hash: string): Promise<{ allowed: boolean }>;
  resend(email: string, purpose: "signup" | "continuation"): Promise<void>;
}
export async function resendSignupConfirmation(ports: SignupResendPorts, value: unknown, purpose: unknown): Promise<{ status: "accepted" | "invalid" | "rate-limited" | "unavailable" }> {
  if (purpose !== "signup" && purpose !== "continuation") return { status: "invalid" };
  if (typeof value !== "string" || value.length > 512 || /[\u0000-\u001f\u007f-\u009f<>]/u.test(value)) return { status: "invalid" };
  const email = value.trim().toLowerCase();
  if (!validEmail(email)) return { status: "invalid" };
  try {
    const hash = ports.subjectHash(email);
    if (!/^[a-f0-9]{64}$/.test(hash)) return { status: "unavailable" };
    if (!(await ports.limit(hash)).allowed) return { status: "rate-limited" };
    // Existing, absent and provider-failed accounts receive the same response.
    try { await ports.resend(email, purpose); } catch { /* neutral response */ }
    return { status: "accepted" };
  } catch { return { status: "unavailable" }; }
}
