import { NextResponse } from "next/server";
import { calendarAdminRuns } from "@/adapters/db/google-calendar-runtime";
import { calendarExpected, calendarFailure, calendarHeaders, calendarIdentity } from "@/adapters/db/google-calendar-http";
import { readAuthConfiguration } from "@/lib/auth/config";
import { AuthGuardError } from "@/lib/auth/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { const headers = calendarHeaders(); try { const actor = await calendarIdentity(headers, true); calendarExpected(request, actor); const auth = readAuthConfiguration(); if (auth.mode !== "supabase") throw new AuthGuardError("demo"); return NextResponse.json({ runs: await calendarAdminRuns(auth, actor) }, { headers }); } catch (error) { return calendarFailure(error, headers); } }
