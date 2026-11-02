import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type Purpose = "signup" | "continuation";
type LinkProof = Readonly<{ purpose: Purpose; token: string; nonce: string; issuedAt: number; expiresAt: number }>;
const MAX_AGE = 10 * 60 * 1000, NONCE = /^[A-Za-z0-9_-]{43}$/, TOKEN = /^[A-Za-z0-9_-]{32,256}$/;
const mac = (body: string, secret: string) => createHmac("sha256", secret).update(`signup-email-link:v1.${body}`).digest();
function valid(proof: LinkProof, purpose: Purpose, now: number): boolean {
  return (purpose === "signup" || purpose === "continuation") && !!proof && typeof proof === "object" && Object.keys(proof).sort().join(",") === "expiresAt,issuedAt,nonce,purpose,token" && proof.purpose === purpose && typeof proof.token === "string" && TOKEN.test(proof.token) && typeof proof.nonce === "string" && NONCE.test(proof.nonce) && Number.isSafeInteger(now) && Number.isSafeInteger(proof.issuedAt) && Number.isSafeInteger(proof.expiresAt) && proof.issuedAt >= 0 && proof.issuedAt <= now && proof.expiresAt > now && proof.expiresAt - proof.issuedAt <= MAX_AGE;
}
export function createSignupEmailLink(purpose: Purpose, token: string, secret: string, now: number): { cookie: string; nonce: string } {
  const proof: LinkProof = { purpose, token, nonce: randomBytes(32).toString("base64url"), issuedAt: now, expiresAt: now + MAX_AGE };
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32 || !valid(proof, purpose, now)) throw new Error("Invalid signup link.");
  const body = Buffer.from(JSON.stringify(proof)).toString("base64url");
  return { cookie: `${body}.${mac(body, secret).toString("base64url")}`, nonce: proof.nonce };
}
export function readSignupEmailLink(cookie: string | undefined, purpose: Purpose, secret: string, now: number): LinkProof | null {
  if (typeof cookie !== "string" || cookie.length > 2048 || typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) return null;
  const parts = cookie.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1] || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  try {
    const expected = mac(parts[0], secret), provided = Buffer.from(parts[1], "base64url");
    if (provided.length !== expected.length || provided.toString("base64url") !== parts[1] || !timingSafeEqual(provided, expected)) return null;
    const proof: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return proof && typeof proof === "object" && valid(proof as LinkProof, purpose, now) ? proof as LinkProof : null;
  } catch { return null; }
}
