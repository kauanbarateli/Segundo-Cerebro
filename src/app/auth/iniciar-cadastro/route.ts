import { NextResponse, type NextRequest } from "next/server";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { sameOrigin } from "@/lib/auth/policy";
import { signupRedirect } from "@/lib/auth/signup-channel";
import { readSignupBrowserCookie } from "@/lib/auth/signup-browser-secret";
import { readSignupForm } from "@/lib/auth/signup-form-body";
import { signupEnabled } from "@/lib/auth/signup-http";
import { createSameBrowserStartPorts } from "@/lib/auth/signup-same-browser-runtime";
import { startSameBrowserSignup } from "@/lib/auth/signup-same-browser-start";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";
import { SIGNUP_UTM_FIELDS } from "@/core/acquisition/signup-origin";

export const dynamic = "force-dynamic";
const fields = ["email", "password", "acceptedLegal", "termsVersion", "privacyVersion", "consentedOrigin", ...SIGNUP_UTM_FIELDS] as const;
type SignupStatus = "sent" | "wait" | "invalid" | "unavailable" | "uncertain";
function resultResponse(request: NextRequest, config: Parameters<typeof signupRedirect>[0], status: SignupStatus) {
  if (request.headers.get("accept") !== "application/json") return signupRedirect(config, `/cadastro?status=${status}`);
  return NextResponse.json({ status }, { headers: { ...noStoreHeaders(), "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
export async function POST(request: NextRequest) {
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase" || !signupEnabled(config)) return new NextResponse(null, { status: 503, headers: noStoreHeaders() });
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) return new NextResponse(null, { status: 403, headers: noStoreHeaders() });
    const form = await readSignupForm(request, fields);
    if (!form) return resultResponse(request, config, "invalid");
    const all=request.cookies.getAll(), browser=readSignupBrowserCookie(request.headers.get("cookie"));
    if(browser.status!=="ready") return resultResponse(request,config,"unavailable");
    const result = await startSameBrowserSignup(createSameBrowserStartPorts(config,all,request.headers.get("cookie")), { email: form.email, password: form.password, acceptedLegal: form.acceptedLegal === "yes", termsVersion: form.termsVersion, privacyVersion: form.privacyVersion }, browser.value, { terms: LEGAL_DOCUMENTS.termos.version, privacy: LEGAL_DOCUMENTS.privacidade.version }, { consented: form.consentedOrigin === "yes", candidate: form });
    const status = result.status === "accepted" ? "sent" : result.status === "rate-limited" ? "wait" : result.status;
    return resultResponse(request, config, status);
  } catch { return new NextResponse(null, { status: 503, headers: noStoreHeaders() }); }
}
