import { NextResponse } from "next/server";
import { activityId } from "@/core/activity";
import { activityQuery } from "@/adapters/db/activity-query";
import { ErroDeDominio } from "@/core/contracts";
import { activityGatewayForRequest } from "@/adapters/db/activity-runtime";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { AuthGuardError } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class SessionChanged extends Error {}
export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase") throw new AuthGuardError("demo");
    const origin = request.headers.get("origin");
    if (origin !== null && !sameOrigin(origin, config.appOrigin) || request.headers.get("sec-fetch-site") === "cross-site") throw new AuthGuardError("forbidden");
    const identity = await (await requestAuthServices(true, headers)).gateway.readIdentity();
    if (!identity) throw new AuthGuardError("unauthenticated");
    assertFeature(identity, "inicio");
    const expected = request.headers.get("x-expected-user-id");
    if (!activityId(expected)) throw new ErroDeDominio("VALIDATION", "Recarregue a página para confirmar sua conta.");
    if (expected !== identity.userId) throw new SessionChanged();
    if (identity.entitlements?.capturar === false && identity.entitlements.tarefas === false) throw new AuthGuardError("forbidden");
    const query = activityQuery(new URL(request.url).searchParams);
    const page = await activityGatewayForRequest(config, identity).page(query);
    return NextResponse.json(page, { headers });
  } catch (error) {
    const code = error instanceof SessionChanged ? "SESSION_CHANGED" : error instanceof ErroDeDominio ? "VALIDATION" : error instanceof AuthGuardError ? error.code.toUpperCase() : "UNAVAILABLE";
    const status = code === "SESSION_CHANGED" ? 409 : code === "VALIDATION" ? 400 : code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : 503;
    const message = status === 409 ? "A conta mudou em outra aba. Recarregue a página para continuar." : status === 401 ? "Entre novamente para consultar sua atividade." : status === 403 ? "A atividade não está disponível para esta conta." : status === 400 ? "Esta página de atividade é inválida. Volte aos registros recentes." : "Não foi possível carregar a atividade. Tente novamente.";
    return NextResponse.json({ ok: false, code, message }, { status, headers });
  }
}
