import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createRequestClient, type AuthCookieJar } from "@/lib/auth/clients";
import { readAuthConfiguration } from "@/lib/auth/config";
import { AUTH_COOKIE_NAME, noStoreHeaders, secureCookieOptions } from "@/lib/auth/cookie-policy";
import { sameOrigin } from "@/lib/auth/policy";
import { signupRedirect, SIGNUP_CONTINUATION_COOKIE, SIGNUP_OTP_COOKIE } from "@/lib/auth/signup-channel";
import { readSignupEmailLink } from "@/lib/auth/signup-email-link";
import { SIGNUP_CHECKPOINT_COOKIE } from "@/lib/auth/signup-confirmation-runtime";
import { readSignupForm } from "@/lib/auth/signup-form-body";
import { signupEnabled } from "@/lib/auth/signup-http";

export const dynamic = "force-dynamic";
const authCookie = (name: string) => name === AUTH_COOKIE_NAME || name.startsWith(`${AUTH_COOKIE_NAME}.`) || name.startsWith(`${AUTH_COOKIE_NAME}-`);
export async function POST(request: NextRequest) {
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase" || !signupEnabled(config)) return new NextResponse(null, { status: 503, headers: noStoreHeaders() });
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) return new NextResponse(null, { status: 403, headers: noStoreHeaders() });
    const form = await readSignupForm(request, ["flow", "nonce"]);
    if (!form || (form.flow !== "signup" && form.flow !== "continuation")) return signupRedirect(config, "/cadastro?status=invalid-link");
    const store = await cookies(), all = store.getAll(), matches = all.filter(cookie => cookie.name === (form.flow === "signup" ? SIGNUP_OTP_COOKIE : SIGNUP_CONTINUATION_COOKIE));
    const proof = readSignupEmailLink(matches.length === 1 ? matches[0]?.value : undefined, form.flow, config.stateSecret, Date.now());
    if (!proof || form.nonce !== proof.nonce) return signupRedirect(config, "/cadastro?status=invalid-link");
    const jar: AuthCookieJar = { getAll: () => store.getAll(), set: (name, value, options) => { store.set(name, value, options); } };
    const headers = new Headers(noStoreHeaders()), client = createRequestClient(config, jar, true, headers);
    try { await client.auth.signOut({ scope: "local" }); } catch { /* Local cookies are cleared below. */ }
    const expired = secureCookieOptions(config.secureCookies, { maxAge: 0 });
    for (const name of new Set([AUTH_COOKIE_NAME, SIGNUP_CHECKPOINT_COOKIE, ...jar.getAll().filter(cookie => authCookie(cookie.name)).map(cookie => cookie.name)])) jar.set(name, "", expired);
    const response = signupRedirect(config, `/cadastro/confirmar?flow=${form.flow}&nonce=${proof.nonce}`);
    for (const [name, value] of headers) response.headers.set(name, value);
    return response;
  } catch { return new NextResponse(null, { status: 503, headers: noStoreHeaders() }); }
}
