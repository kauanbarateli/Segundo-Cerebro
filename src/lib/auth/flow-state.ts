import { createHmac, timingSafeEqual } from "node:crypto";

export type AuthFlow =
  | { kind: "recovery-request"; nonce: string; subject: string; expiresAt: number }
  | { kind: "recovery-session"; userId: string; sessionId: string; expiresAt: number }
  | { kind: "password-updated"; userId: string; sessionId: string; clientId: string; expiresAt: number };
export function subjectHash(secret: string, kind: string, subject: string): string {
  return createHmac("sha256", secret).update(JSON.stringify([kind, subject])).digest("hex");
}
export function signFlow(flow: AuthFlow, secret: string): string {
  const body = Buffer.from(JSON.stringify(flow)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export function verifyFlow(value: string | undefined, secret: string, now: number): AuthFlow | null {
  if (!value || value.length > 2048) return null;
  const parts = value.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1] || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const expected = createHmac("sha256", secret).update(parts[0]).digest();
  const actual = Buffer.from(parts[1], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const flow = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as Record<string, unknown>;
    if (!Number.isSafeInteger(flow.expiresAt) || (flow.expiresAt as number) <= now || (flow.expiresAt as number) > now + 3_600_000) return null;
    if (flow.kind === "recovery-request" && typeof flow.nonce === "string" && flow.nonce.length >= 32 && typeof flow.subject === "string" && /^[a-f0-9]{64}$/.test(flow.subject)) return flow as unknown as AuthFlow;
    if ((flow.kind === "recovery-session" || flow.kind === "password-updated") && typeof flow.userId === "string" && typeof flow.sessionId === "string" &&
        (flow.kind !== "password-updated" || typeof flow.clientId === "string")) return flow as unknown as AuthFlow;
  } catch { /* Invalid signed payload fails closed. */ }
  return null;
}
