import { NextRequest, NextResponse } from "next/server";
import { finishCalendarConnection } from "@/core/calendario";
import { calendarServices } from "@/adapters/db/google-calendar-runtime";
import { GOOGLE_FLOW_COOKIE, GOOGLE_CALLBACK_PATH, verifyGoogleFlow } from "@/adapters/db/google-calendar-security";
import { calendarHeaders, calendarIdentity } from "@/adapters/db/google-calendar-http";
import { readAuthConfiguration } from "@/lib/auth/config";
import { AuthGuardError } from "@/lib/auth/types";
import { onboardingRpcForRequest } from "@/adapters/db/onboarding-gateway";
import { ONBOARDING_GOOGLE_COOKIE, classifyOnboardingFlow, fenceOnboardingCalendarConnect, takeOnboardingContinuation, verifyOnboardingContinuation } from "@/adapters/db/onboarding-oauth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
 const headers = calendarHeaders(); let origin: string | null = null, secure = true, notice = "connection-failed", onboarding = false;
 try { const actor = await calendarIdentity(headers); const auth = readAuthConfiguration(); if (auth.mode !== "supabase") throw new AuthGuardError("demo"); origin = auth.appOrigin; secure = auth.secureCookies; const { repo, provider, cipher, config } = calendarServices(auth, actor), params = new URL(request.url).searchParams;
  const verified = verifyGoogleFlow(config, params.get("state") ?? undefined, request.cookies.get(GOOGLE_FLOW_COOKIE)?.value, actor.userId, actor.sessionId, Date.now()); if (!verified || params.getAll("state").length !== 1 || params.getAll("code").length > 1 || params.getAll("error").length > 1) throw new AuthGuardError("forbidden");
  const rpc=onboardingRpcForRequest(auth,actor);onboarding=(await classifyOnboardingFlow(rpc,verified.flow.flow_id))==="onboarding";
  let continuation:ReturnType<typeof verifyOnboardingContinuation>=null;
  if(onboarding) {
   continuation = verifyOnboardingContinuation(request.cookies.get(ONBOARDING_GOOGLE_COOKIE)?.value, config.stateSecret, { flowId: verified.flow.flow_id, ownerId: actor.userId, sessionId: actor.sessionId }, Date.now());
   if(!continuation||!await takeOnboardingContinuation(rpc,continuation)) {
    await repo.failFlow(verified.flow.flow_id);throw new AuthGuardError("forbidden");
   }
  }
  await repo.requireAccess(); if (params.has("error")) { await repo.consumeFlow(verified.flow.flow_id, verified.digest); await repo.failFlow(verified.flow.flow_id); notice = "consent-denied"; } else { const code = params.get("code"); if (!code || code.length > 8192 || /[\u0000-\u001f]/.test(code)) throw new AuthGuardError("forbidden"); await finishCalendarConnection(continuation?fenceOnboardingCalendarConnect(repo,rpc,continuation):repo, provider, cipher, { flow_id: verified.flow.flow_id, digest: verified.digest, code, verifier: verified.flow.verifier }); notice = "connected"; }
 } catch { /* No provider code, state, token, identity or error is reflected into the redirect. */ }
 if (!origin) { try { const auth = readAuthConfiguration(); if (auth.mode === "supabase") { origin = auth.appOrigin; secure = auth.secureCookies; } } catch { /* Configuration remains fail-closed. */ } }
 if (!origin) return NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503, headers });
 const response = NextResponse.redirect(new URL((onboarding ? "/onboarding" : "/calendario") + "?notice=" + notice, origin), { status: 303, headers }); response.cookies.set(GOOGLE_FLOW_COOKIE, "", { path: GOOGLE_CALLBACK_PATH, httpOnly: true, secure, sameSite: "lax", maxAge: 0 });
 response.cookies.set(ONBOARDING_GOOGLE_COOKIE, "", { path: GOOGLE_CALLBACK_PATH, httpOnly: true, secure, sameSite: "lax", maxAge: 0 }); return response;
}
