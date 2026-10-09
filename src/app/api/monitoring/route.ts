import { NextResponse } from "next/server";
import { MONITOR_AREAS, type MonitorArea } from "@/core/observabilidade";
import { reportBoundary } from "@/adapters/observability/sentry";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { sameOrigin } from "@/lib/auth/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store, max-age=0" });
  // Monitoring never exposes Auth/provider errors or prevents recovery.
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase" || !sameOrigin(request.headers.get("origin"), config.appOrigin) || request.headers.get("content-type")?.split(";")[0] !== "application/json") return new NextResponse(null, { status: 204, headers });
    const auth = await requestAuthServices(true, headers), actor = await auth.gateway.readIdentity();
    if (!actor || actor.mustChangePassword) return new NextResponse(null, { status: 204, headers });
    const reader = request.body?.getReader(); if (!reader) return new NextResponse(null, { status: 204, headers });
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 256) { await reader.cancel(); return new NextResponse(null, { status: 204, headers }); } chunks.push(next.value); } } finally { reader.releaseLock(); }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (value && typeof value === "object" && Object.keys(value).length === 1 && "area" in value && MONITOR_AREAS.includes(value.area as MonitorArea)) {
      // Reuse the account limiter; the payload never carries an IP or user ID.
      const permit = await auth.limit("password", actor.userId, actor);
      if (permit.allowed) await reportBoundary(value.area as MonitorArea);
    }
  } catch { /* Safe generic recovery continues without telemetry. */ }
  return new NextResponse(null, { status: 204, headers });
}
