import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { AuthCookieJar } from "@/lib/auth/clients";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { sameOrigin } from "@/lib/auth/policy";
import { signupRedirect } from "@/lib/auth/signup-channel";
import { createSignupCompletionPorts } from "@/lib/auth/signup-completion-runtime";
import { completePublicSignup } from "@/lib/auth/signup-completion-service";
import { readSignupForm } from "@/lib/auth/signup-form-body";
import { signupEnabled } from "@/lib/auth/signup-http";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

export const dynamic = "force-dynamic";
const fields = ["password", "acceptedLegal", "termsVersion", "privacyVersion"] as const;
export async function POST(request: NextRequest) {
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase" || !signupEnabled(config)) return new NextResponse(null, { status: 503, headers: noStoreHeaders() });
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) return new NextResponse(null, { status: 403, headers: noStoreHeaders() });
    const form = await readSignupForm(request, fields);
    if (!form) return signupRedirect(config, "/cadastro/definir-senha?status=invalid");
    const store = await cookies(), jar: AuthCookieJar = { getAll: () => store.getAll(), set: (name, value, options) => { store.set(name, value, options); } };
    const headers = new Headers(noStoreHeaders());
    const result = await completePublicSignup(createSignupCompletionPorts(config, jar, headers), { password: form.password, acceptedLegal: form.acceptedLegal === "yes", termsVersion: form.termsVersion, privacyVersion: form.privacyVersion }, { terms: LEGAL_DOCUMENTS.termos.version, privacy: LEGAL_DOCUMENTS.privacidade.version });
    const destination = result.status === "completed" ? "/onboarding" : result.status === "needs-verification" ? "/cadastro?status=repeat" : `/cadastro/definir-senha?status=${result.status}`;
    const response = signupRedirect(config, destination);
    for (const [name, value] of headers) response.headers.set(name, value);
    return response;
  } catch { return new NextResponse(null, { status: 503, headers: noStoreHeaders() }); }
}
