import { NextResponse } from "next/server";
import { ErroDeDominio } from "@/core/contracts";
import { calendarServices } from "@/adapters/db/google-calendar-runtime";
import { GOOGLE_FLOW_COOKIE, GOOGLE_CALLBACK_PATH, newGoogleFlow, googleAuthorizationUrl } from "@/adapters/db/google-calendar-security";
import { calendarBody, calendarExpected, calendarFailure, calendarHeaders, calendarIdentity, calendarOrigin } from "@/adapters/db/google-calendar-http";
import { readAuthConfiguration } from "@/lib/auth/config";
import { AuthGuardError } from "@/lib/auth/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
 const headers = calendarHeaders(); try { const actor = await calendarIdentity(headers); calendarExpected(request, actor); const auth = readAuthConfiguration(); if (auth.mode !== "supabase") throw new AuthGuardError("demo"); calendarOrigin(request, auth.appOrigin); const input = await calendarBody(request);
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !["client_id", "account_id"].includes(key))) throw new ErroDeDominio("VALIDATION", "Operação inválida."); const value = input as Record<string, unknown>; if (typeof value.client_id !== "string" || !value.client_id.trim() || value.client_id.length > 200 || (value.account_id !== undefined && (typeof value.account_id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.account_id)))) throw new ErroDeDominio("VALIDATION", "Conta Google inválida.");
  const { repo, config } = calendarServices(auth, actor); await repo.requireAccess(); const flow = newGoogleFlow(config, actor.userId, actor.sessionId, Date.now()), reservation = await repo.beginFlow(flow.flowId, flow.digest, new Date(flow.expiresAt).toISOString(), value.account_id as string | undefined ?? null);
  const response = NextResponse.json({ ok: true, authorization_url: googleAuthorizationUrl(config, flow.state, flow.verifier) }, { headers }); response.cookies.set(GOOGLE_FLOW_COOKIE, flow.cookie(reservation.account_id), { path: GOOGLE_CALLBACK_PATH, httpOnly: true, secure: config.secureCookies, sameSite: "lax", maxAge: 600 }); return response;
 } catch (error) { return calendarFailure(error, headers); }
}
