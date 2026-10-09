import { NextResponse } from "next/server";
import { search, searchTerm } from "@/core/busca";
import { ErroDeDominio } from "@/core/contracts/base";
import { searchForRequest } from "@/adapters/db/search-runtime";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { AuthGuardError } from "@/lib/auth/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
  try {
    const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
    if (request.headers.get("sec-fetch-site") === "cross-site" || request.headers.has("origin") && !sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden");
    const actor = await (await requestAuthServices(true, headers)).gateway.readIdentity(); if (!actor) throw new AuthGuardError("unauthenticated"); if (actor.mustChangePassword) throw new AuthGuardError("forbidden"); assertFeature(actor, "inicio");
    if (request.headers.get("x-expected-user-id") !== actor.userId) return NextResponse.json({ code: "SESSION_CHANGED" }, { status: 409, headers });
    const params = new URL(request.url).searchParams; if ([...params.keys()].some(key => key !== "q") || params.getAll("q").length > 1) throw new ErroDeDominio("VALIDATION", "Consulta inválida.");
    const term = searchTerm(params.get("q") ?? "");
    return NextResponse.json({ items: term ? await search(searchForRequest(config, actor), term) : [] }, { headers });
  } catch (error) { const status = error instanceof ErroDeDominio ? 400 : error instanceof AuthGuardError ? error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503 : 503; return NextResponse.json({ code: status === 400 ? "VALIDATION" : "UNAVAILABLE", message: "Não foi possível buscar. Revise o termo ou tente novamente." }, { status, headers }); }
}
