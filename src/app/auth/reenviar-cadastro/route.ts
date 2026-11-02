import { NextResponse, type NextRequest } from "next/server";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { sameOrigin } from "@/lib/auth/policy";
import { signupRedirect } from "@/lib/auth/signup-channel";
import { readSignupForm } from "@/lib/auth/signup-form-body";
import { signupEnabled } from "@/lib/auth/signup-http";
import { createSignupResendPorts } from "@/lib/auth/signup-resend-runtime";
import { resendSignupConfirmation } from "@/lib/auth/signup-resend-service";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase" || !signupEnabled(config)) return new NextResponse(null, { status: 503, headers: noStoreHeaders() });
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) return new NextResponse(null, { status: 403, headers: noStoreHeaders() });
    const form = await readSignupForm(request, ["email", "purpose"]);
    if (!form) return signupRedirect(config, "/cadastro/reenviar?status=invalid");
    const result = await resendSignupConfirmation(createSignupResendPorts(config), form.email, form.purpose);
    const status = result.status === "accepted" ? "sent" : result.status === "rate-limited" ? "wait" : result.status;
    return signupRedirect(config, `/cadastro/reenviar?status=${status}`);
  } catch { return new NextResponse(null, { status: 503, headers: noStoreHeaders() }); }
}
