import "server-only";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { AuthCookieJar } from "./clients";
import { readAuthConfiguration } from "./config";
import { AUTH_COOKIE_NAME, noStoreHeaders, secureCookieOptions } from "./cookie-policy";
import { sameOrigin } from "./policy";
import { SIGNUP_OTP_COOKIE, SIGNUP_CONTINUATION_COOKIE, signupRedirect } from "./signup-channel";
import { readSignupBrowserCookie } from "./signup-browser-secret";
import { createSameBrowserConfirmationPorts, hasAuthCookieHeader } from "./signup-same-browser-runtime";
import { confirmSameBrowserSignup } from "./signup-same-browser-service";
import { createSignupConfirmationPorts } from "./signup-confirmation-runtime";
import { verifySignupConfirmation } from "./signup-confirmation-service";
import { signupEnabled } from "./signup-http";
import { readSignupForm } from "./signup-form-body";
import { createSignupEmailLink, readSignupEmailLink } from "./signup-email-link";
import { LEGAL_DOCUMENTS } from "../legal/documents";
import { SIGNUP_ORIGIN_CONSENT_VERSION } from "../../core/acquisition/signup-origin";

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
    if (hasAuthCookieHeader(request.headers.get("cookie")) || all.some(cookie => isAuthCookie(cookie.name) && cookie.value !== "")) return signupRedirect(config, confirmPage(purpose, proof.nonce, true));
    const jar: AuthCookieJar = { getAll: () => store.getAll(), set: (name, value, options) => { store.set(name, value, options); } };
    const headers = new Headers(noStoreHeaders());
    const browser=readSignupBrowserCookie(request.headers.get("cookie"));
    const legal={terms:LEGAL_DOCUMENTS.termos.version,privacy:LEGAL_DOCUMENTS.privacidade.version,originVersion:SIGNUP_ORIGIN_CONSENT_VERSION};
    const passwordFallback=async()=>{
      const fallback=await verifySignupConfirmation(createSignupConfirmationPorts(config,jar,headers,purpose,true),proof.token,legal);
      store.set(cookieName(purpose), "", secureCookieOptions(config.secureCookies, { maxAge: 0 }));
      const response=signupRedirect(config,fallback.status==="ready"?"/cadastro/definir-senha":fallback.status==="reconsent"?"/cadastro/revisar":"/cadastro?status=review");
      for(const [name,value] of headers) response.headers.set(name,value);
      return response;
    };
    // Another device has no original browser secret. Its safe fallback requires
    // a fresh password after OTP and retains the existing fenced Auth workflow.
    if(browser.status==="missing") return passwordFallback();
    if(browser.status==="invalid") return signupRedirect(config,"/cadastro?status=repeat");
    const result = await confirmSameBrowserSignup(createSameBrowserConfirmationPorts(config,jar,headers,purpose),{browserSecret:browser.value,token:proof.token,terms:legal.terms,privacy:legal.privacy},legal);
    // No OTP was consumed when the cookie has no live bound attempt. Reuse the
    // existing password-after-OTP fence; never treat the stale cookie as proof.
    if(result.status==="other-browser") return passwordFallback();
    store.set(cookieName(purpose), "", secureCookieOptions(config.secureCookies, { maxAge: 0 }));
    const response = signupRedirect(config, result.status === "completed" ? "/onboarding" : result.status === "password-required" ? "/cadastro/definir-senha" : result.status==="reconsent" ? "/cadastro/revisar" : "/cadastro?status=repeat");
    // Never overwrite the browser cookie here: another tab may have started a
    // newer attempt after this request captured its cookie. Its TTL is bounded.
    for (const [name, value] of headers) response.headers.set(name, value);
    return response;
  } catch { return new NextResponse(null, { status: 503, headers: noStoreHeaders() }); }
}
