import { NextResponse } from "next/server";
import { executeCalendarCommand } from "@/core/calendario";
import { calendarServices } from "@/adapters/db/google-calendar-runtime";
import { calendarBody, calendarExpected, calendarFailure, calendarHeaders, calendarIdentity, calendarOrigin } from "@/adapters/db/google-calendar-http";
import { readAuthConfiguration } from "@/lib/auth/config";
import { AuthGuardError } from "@/lib/auth/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 const headers = calendarHeaders(); try { const actor = await calendarIdentity(headers); calendarExpected(request, actor); const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo"); const { repo } = calendarServices(config, actor); await repo.requireAccess(); await repo.quota("api"); return NextResponse.json(await repo.snapshot(), { headers }); } catch (error) { return calendarFailure(error, headers); }
}
export async function POST(request: Request) {
 const headers = calendarHeaders(); try { const actor = await calendarIdentity(headers); calendarExpected(request, actor); const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo"); calendarOrigin(request, config.appOrigin); const value = await calendarBody(request), { repo, provider, cipher } = calendarServices(config, actor); await repo.requireAccess(); await repo.quota("api"); const result = await executeCalendarCommand(repo, provider, cipher, value, new Date().toISOString()); return NextResponse.json({ ok: true, result }, { headers }); } catch (error) { return calendarFailure(error, headers); }
}
