import "server-only";
import { createHmac, randomBytes } from "node:crypto";

/** Server-side only: never expose the key or persist/log the returned secret. */
export function newSignupBrowserSecret(): string { return randomBytes(32).toString("base64url"); }

export function signupBrowserSecretHash(secret: string, key: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret) || typeof key !== "string" || Buffer.byteLength(key, "utf8") < 32) throw Error("Invalid signup browser secret.");
  return createHmac("sha256", key).update("signup-browser:v1\0").update(secret).digest("hex");
}
