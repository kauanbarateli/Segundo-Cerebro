import { NextResponse } from "next/server";
import type { SupabaseAuthConfig } from "./config";
import { noStoreHeaders } from "./cookie-policy";

export const SIGNUP_OTP_COOKIE = "sc-signup-otp";
export const SIGNUP_CONTINUATION_COOKIE = "sc-signup-continuation-otp";
/** Only trusted, fixed relative destinations should be passed by server routes. */
export function signupRedirect(config: SupabaseAuthConfig, destination: string): NextResponse {
  if (!destination.startsWith("/") || destination.startsWith("//") || destination.includes("\\")) throw new Error("Invalid signup destination.");
  const url = new URL(destination, config.appOrigin);
  if (url.origin !== config.appOrigin) throw new Error("Invalid signup destination.");
  const response = NextResponse.redirect(url, 303);
  for (const [name, value] of Object.entries(noStoreHeaders())) response.headers.set(name, value);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
