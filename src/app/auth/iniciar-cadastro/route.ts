import { NextResponse, type NextRequest } from "next/server";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { sameOrigin } from "@/lib/auth/policy";
import { signupRedirect } from "@/lib/auth/signup-channel";
import { readSignupForm } from "@/lib/auth/signup-form-body";
import { signupEnabled } from "@/lib/auth/signup-http";
import { createSignupRequestPorts } from "@/lib/auth/signup-runtime";
import { requestPublicSignup } from "@/lib/auth/signup-service";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

export const dynamic = "force-dynamic";
const fields = ["email", "password", "acceptedLegal", "termsVersion", "privacyVersion"] as const;
export async function POST(request: NextRequest) {
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase" || !signupEnabled(config)) return new NextResponse(null, { status: 503, headers: noStoreHeaders() });
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) return new NextResponse(null, { status: 403, headers: noStoreHeaders() });
    const form = await readSignupForm(request, fields);
    if (!form) return signupRedirect(config, "/cadastro?status=invalid");
    const result = await requestPublicSignup(createSignupRequestPorts(config), { email: form.email, password: form.password, acceptedLegal: form.acceptedLegal === "yes", termsVersion: form.termsVersion, privacyVersion: form.privacyVersion }, { terms: LEGAL_DOCUMENTS.termos.version, privacy: LEGAL_DOCUMENTS.privacidade.version });
    const status = result.status === "accepted" ? "sent" : result.status === "rate-limited" ? "wait" : result.status === "invalid" ? "invalid" : "unavailable";
    return signupRedirect(config, `/cadastro?status=${status}`);
  } catch { return new NextResponse(null, { status: 503, headers: noStoreHeaders() }); }
}
