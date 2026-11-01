import { createHmac, timingSafeEqual } from "node:crypto";

/** Only the trusted confirmation channel can issue this after verifying OTP. */
export type SignupCheckpoint = Readonly<{ userId: string; sessionId: string; intentId: string; issuedAt: number; expiresAt: number; passwordConfirmed: boolean }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE = 10 * 60 * 1000;
const DOMAIN = "signup-confirmation-checkpoint:v1";
function valid(value: SignupCheckpoint, now: number): boolean {
  return !!value && typeof value === "object" && Object.keys(value).sort().join(",") === "expiresAt,intentId,issuedAt,passwordConfirmed,sessionId,userId" && typeof value.passwordConfirmed === "boolean" &&
    typeof value.userId === "string" && typeof value.sessionId === "string" && typeof value.intentId === "string" && UUID.test(value.userId) && UUID.test(value.sessionId) && UUID.test(value.intentId) && Number.isSafeInteger(now) &&
    Number.isSafeInteger(value.issuedAt) && Number.isSafeInteger(value.expiresAt) && value.issuedAt <= now && value.issuedAt >= 0 &&
    value.expiresAt > now && value.expiresAt - value.issuedAt <= MAX_AGE;
}
function mac(body: string, secret: string): Buffer { return createHmac("sha256", secret).update(`${DOMAIN}.${body}`).digest(); }
export function signSignupCheckpoint(value: SignupCheckpoint, secret: string, now: number): string {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32 || !valid(value, now)) throw new Error("Invalid signup checkpoint.");
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}
export function verifySignupCheckpoint(token: string | undefined, secret: string, now: number): SignupCheckpoint | null {
  if (typeof token !== "string" || token.length > 2048 || typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1] || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  try {
    const expected = mac(parts[0], secret), provided = Buffer.from(parts[1], "base64url");
    if (provided.length !== expected.length || provided.toString("base64url") !== parts[1] || !timingSafeEqual(provided, expected)) return null;
    const value: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return value && typeof value === "object" && valid(value as SignupCheckpoint, now) ? value as SignupCheckpoint : null;
  } catch { return null; }
}
