import "server-only";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { AuthCookieJar } from "./clients";
import { readAuthConfiguration } from "./config";
import { AUTH_COOKIE_NAME, noStoreHeaders, secureCookieOptions } from "./cookie-policy";
import { sameOrigin } from "./policy";
import { SIGNUP_OTP_COOKIE, SIGNUP_CONTINUATION_COOKIE, signupRedirect } from "./signup-channel";
import { createSignupConfirmationPorts } from "./signup-confirmation-runtime";
import { verifySignupConfirmation } from "./signup-confirmation-service";
import { signupEnabled } from "./signup-http";
import { readSignupForm } from "./signup-form-body";
import { createSignupEmailLink, readSignupEmailLink } from "./signup-email-link";
import { LEGAL_DOCUMENTS } from "../legal/documents";

type Purpose = "signup" | "continuation";
const tokenPattern = /^[A-Za-z0-9_-]{32,256}$/;
const cookieName = (purpose: Purpose) => purpose === "signup" ? SIGNUP_OTP_COOKIE : SIGNUP_CONTINUATION_COOKIE;
const confirmPage = (purpose: Purpose, nonce: string, session = false) => `/cadastro/confirmar?flow=${purpose}&nonce=${nonce}${session ? "&status=session" : ""}`;
const isAuthCookie = (name: string) => name === AUTH_COOKIE_NAME || name.startsWith(`${AUTH_COOKIE_NAME}.`) || name.startsWith(`${AUTH_COOKIE_NAME}-`);

/** GET transfers the token into an HttpOnly cookie; never verifies or admits. */
export async function openSignupEmailLink(request: NextRequest, purpose: Purpose) {
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase" || !signupEnabled(config)) return new NextResponse(null, { status: 503, headers: noStoreHeaders() });
    const tokens = request.nextUrl.searchParams.getAll("token_hash");
    if (tokens.length !== 1 || !tokenPattern.test(tokens[0]!)) return signupRedirect(config, "/cadastro?status=invalid-link");
    const proof = createSignupEmailLink(purpose, tokens[0]!, config.stateSecret, Date.now());
    const response = signupRedirect(config, confirmPage(purpose, proof.nonce));
    response.cookies.set(cookieName(purpose), proof.cookie, secureCookieOptions(config.secureCookies, { maxAge: 600 }));
    return response;
  } catch { return new NextResponse(null, { status: 503, headers: noStoreHeaders() }); }
}

/** POST chooses the OTP type from the fixed route, never from a query or form. */
export async function submitSignupEmailLink(request: NextRequest, purpose: Purpose) {
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase" || !signupEnabled(config)) return new NextResponse(null, { status: 503, headers: noStoreHeaders() });
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) return new NextResponse(null, { status: 403, headers: noStoreHeaders() });
    const form = await readSignupForm(request, ["nonce"]);
    if (!form || typeof form.nonce !== "string") return signupRedirect(config, "/cadastro?status=invalid-link");
    const store = await cookies(), all = store.getAll();
    const matches = all.filter(cookie => cookie.name === cookieName(purpose));
    const proof = readSignupEmailLink(matches.length === 1 ? matches[0]?.value : undefined, purpose, config.stateSecret, Date.now());
    if (!proof || form.nonce !== proof.nonce) return signupRedirect(config, "/cadastro?status=invalid-link");
    if (all.some(cookie => isAuthCookie(cookie.name) && cookie.value !== "")) return signupRedirect(config, confirmPage(purpose, proof.nonce, true));
    const jar: AuthCookieJar = { getAll: () => store.getAll(), set: (name, value, options) => { store.set(name, value, options); } };
    const headers = new Headers(noStoreHeaders());
    const result = await verifySignupConfirmation(createSignupConfirmationPorts(config, jar, headers, purpose), proof.token, { terms: LEGAL_DOCUMENTS.termos.version, privacy: LEGAL_DOCUMENTS.privacidade.version });
    store.set(cookieName(purpose), "", secureCookieOptions(config.secureCookies, { maxAge: 0 }));
    const response = signupRedirect(config, result.status === "ready" ? "/cadastro/definir-senha" : "/cadastro?status=invalid-link");
    for (const [name, value] of headers) response.headers.set(name, value);
    return response;
  } catch { return new NextResponse(null, { status: 503, headers: noStoreHeaders() }); }
}
