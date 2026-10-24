import { NextResponse } from "next/server";
import { ErroDeDominio } from "@/core/contracts/base";
import { financeSeriesAvailable } from "@/adapters/db/finance-series-availability";
import { seriesUuid } from "@/adapters/db/finance-series-protocol";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature } from "@/lib/auth/policy";
import { AuthGuardError } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class SessionChanged extends Error {}
export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
  try {
    const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
    const actor = await (await requestAuthServices(true, headers)).gateway.readIdentity();
    if (!actor) throw new AuthGuardError("unauthenticated"); if (actor.mustChangePassword) throw new AuthGuardError("forbidden"); assertFeature(actor, "financeiro");
    const owner = request.headers.get("x-expected-user-id"); if (!seriesUuid(owner)) throw new ErroDeDominio("VALIDATION", "Recarregue a página para confirmar sua conta."); if (owner !== actor.userId) throw new SessionChanged();
    if (new URL(request.url).search) throw new ErroDeDominio("VALIDATION", "Consulta de disponibilidade inválida.");
    // No finance-series RPC, schema inspection or fallback request is made here.
    return NextResponse.json({ ok: true, result: { version: 2, available: financeSeriesAvailable() } }, { headers });
  } catch (error) {
    const status = error instanceof SessionChanged ? 409 : error instanceof ErroDeDominio ? 400 : error instanceof AuthGuardError && error.code === "unauthenticated" ? 401 : error instanceof AuthGuardError && error.code === "forbidden" ? 403 : 503;
    const code = status === 409 ? "SESSION_CHANGED" : status === 400 ? "VALIDATION" : status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "UNAVAILABLE";
    return NextResponse.json({ ok: false, code, message: status === 409 ? "A conta mudou em outra aba. Recarregue a página." : "Não foi possível conferir esta opção para sua conta." }, { status, headers });
  }
}
