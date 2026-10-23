import { NextResponse } from "next/server";
import { ErroDeDominio } from "@/core/contracts/base";
import { classifyFinanceSeriesGroup } from "@/adapters/db/finance-series-classification";
import { financeGatewayForRequest } from "@/adapters/db/finance-runtime";
import { financeSeriesGatewayForRequest } from "@/adapters/db/finance-series-runtime";
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
    const expected = request.headers.get("x-expected-user-id"); if (!seriesUuid(expected)) throw new ErroDeDominio("VALIDATION", "Recarregue a página para confirmar sua conta."); if (expected !== actor.userId) throw new SessionChanged();
    const params = new URL(request.url).searchParams, groupId = params.get("group_id");
    if ([...params.keys()].length !== 1 || !seriesUuid(groupId)) throw new ErroDeDominio("VALIDATION", "Consulta de grupo inválida.");
    const result = await classifyFinanceSeriesGroup(actor.userId, groupId, {
      legacy: () => financeGatewayForRequest(config, actor, "read.finance").presentation(),
      managed: id => financeSeriesGatewayForRequest(config, actor, "read.finance.series").detail(id),
    });
    return NextResponse.json({ ok: true, result }, { headers });
  } catch (error) {
    const status = error instanceof SessionChanged ? 409 : error instanceof ErroDeDominio ? error.code === "NOT_FOUND" ? 404 : 400 : error instanceof AuthGuardError && error.code === "unauthenticated" ? 401 : error instanceof AuthGuardError && error.code === "forbidden" ? 403 : 503;
    const code = status === 409 ? "SESSION_CHANGED" : status === 404 ? "NOT_FOUND" : status === 400 ? "VALIDATION" : status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "UNAVAILABLE";
    return NextResponse.json({ ok: false, code, message: status === 409 ? "A conta mudou em outra aba. Recarregue a página." : "Não foi possível classificar este grupo para sua conta." }, { status, headers });
  }
}
