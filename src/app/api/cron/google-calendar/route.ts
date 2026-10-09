import { NextResponse } from "next/server";
import { defaultWindow, synchronizeCalendars } from "@/core/calendario";
import { calendarJobs, calendarServices } from "@/adapters/db/google-calendar-runtime";
import { validCalendarCron } from "@/adapters/db/google-calendar-security";
import { calendarHeaders } from "@/adapters/db/google-calendar-http";
import { readAuthConfiguration } from "@/lib/auth/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 const headers = calendarHeaders(); if (!validCalendarCron(process.env.GOOGLE_CALENDAR_CRON_SECRET ?? null, request.headers.get("authorization"))) return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403, headers });
 try { const auth = readAuthConfiguration(); if (auth.mode !== "supabase") throw new Error("Unavailable"); const jobs = await calendarJobs(auth), now = new Date().toISOString(), window = defaultWindow(now); let complete = 0, failed = 0;
  for (const job of jobs) { try { const { repo, provider, cipher } = calendarServices(auth, { userId: job.user_id, sessionId: null }, true); await synchronizeCalendars(repo, provider, cipher, window, now, "cron:" + now.slice(0, 10) + ":" + job.account_id, job.account_id); complete++; } catch { failed++; } }
  return NextResponse.json({ ok: failed === 0, complete, failed }, { status: failed ? 503 : 200, headers });
 } catch { return NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503, headers }); }
}
export const POST = GET;
