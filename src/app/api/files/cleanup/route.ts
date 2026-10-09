import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { readAuthConfiguration } from "@/lib/auth/config";
import { fileHeaders, filesFailure } from "@/adapters/db/files-http";
import { cleanupFiles } from "@/adapters/db/files-runtime";
import { AuthGuardError } from "@/lib/auth/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers = fileHeaders();
  try {
    const configured = process.env.CRON_SECRET;
    if (!configured || new TextEncoder().encode(configured).length < 32) throw new AuthGuardError("unavailable");
    const authorization = request.headers.get("authorization") ?? "";
    if (authorization.length > 1024) throw new AuthGuardError("forbidden");
    const expected = Buffer.from(`Bearer ${configured}`), provided = Buffer.from(authorization);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new AuthGuardError("forbidden");
    const config = readAuthConfiguration();
    if (config.mode !== "supabase") throw new AuthGuardError("demo");
    const result = await cleanupFiles(config);
    return NextResponse.json(result, { status: result.failed > 0 ? 503 : 200, headers });
  } catch (error) { return filesFailure(error, headers); }
}

export const GET = POST;
