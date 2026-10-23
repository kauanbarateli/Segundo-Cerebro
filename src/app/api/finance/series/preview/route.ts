import { NextResponse } from "next/server";
import { assinatura, ErroDeDominio } from "@/core/contracts/base";
import { diaCivilDe } from "@/core/tempo";
import type { FinanceSeriesPreview } from "@/core/financeiro/series/series-preview-types";
import { decodeFinanceSeriesCommand } from "@/core/financeiro/series/series-validation";
import { financeSeriesGatewayForRequest } from "@/adapters/db/finance-series-runtime";
import { requireFinanceSeriesAvailable } from "@/adapters/db/finance-series-availability";
import { parseSeriesResult, seriesUuid } from "@/adapters/db/finance-series-protocol";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { AuthGuardError } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class SessionChanged extends Error {}
async function body(request: Request): Promise<unknown> {
  const reader = request.body?.getReader(); if (!reader) throw new ErroDeDominio("VALIDATION", "Informe a intenção para revisar.");
  const parts: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > 64 * 1024) { await reader.cancel(); throw new ErroDeDominio("VALIDATION", "A revisão excede o tamanho permitido."); } parts.push(next.value); }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts))); } catch { throw new ErroDeDominio("VALIDATION", "Intenção de revisão inválida."); }
  } finally { reader.releaseLock(); }
}
export async function POST(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
  try {
    const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) throw new AuthGuardError("forbidden");
    if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ErroDeDominio("VALIDATION", "Envie uma intenção JSON.");
    const actor = await (await requestAuthServices(true, headers)).gateway.readIdentity();
    if (!actor) throw new AuthGuardError("unauthenticated"); if (actor.mustChangePassword) throw new AuthGuardError("forbidden"); assertFeature(actor, "financeiro");
    const owner = request.headers.get("x-expected-user-id"); if (!seriesUuid(owner)) throw new ErroDeDominio("VALIDATION", "Recarregue a página para confirmar sua conta."); if (owner !== actor.userId) throw new SessionChanged();
    requireFinanceSeriesAvailable(); const intent = decodeFinanceSeriesCommand(await body(request));
    const snapshot = await financeSeriesGatewayForRequest(config, actor, intent.command).snapshot(intent);
    const binding = { version: 2 as const, command: intent.command, client_id: intent.input.client_id }; let result: FinanceSeriesPreview;
    if (snapshot.receipt !== null) {
      if (snapshot.receipt.fingerprint !== assinatura(intent.input)) throw new ErroDeDominio("CONFLICT", "Esta tentativa já foi usada com outro conteúdo.");
      // This is a known original result, never a fresh review or a new intention.
      result = { ...binding, kind: "confirmed", result: parseSeriesResult(snapshot.receipt.result, actor.userId) };
    } else {
      const series = snapshot.series[0] ?? null;
      if (intent.command !== "finance.recurring.create" && series === null) throw new ErroDeDominio("NOT_FOUND", "Esta série não está disponível.");
      const requested_series = intent.command === "finance.recurring.create" ? null : intent.input.expected_revision, observed_series = series?.revision ?? null;
      result = { ...binding, kind: "review", today: diaCivilDe(new Date().toISOString()), consistency: snapshot.finance_revision === intent.input.expected_finance_revision && requested_series === observed_series ? "same" : "changed",
        revisions: { requested_finance: intent.input.expected_finance_revision, observed_finance: snapshot.finance_revision, requested_series, observed_series },
        data: { series, occurrences: snapshot.occurrences, transactions: snapshot.transactions, accounts: snapshot.accounts, categories: snapshot.categories, tags: snapshot.tags } };
    }
    return NextResponse.json({ ok: true, result }, { headers });
  } catch (error) {
    let status = 503, code = "UNAVAILABLE", message = "Não foi possível preparar a revisão. Nenhuma confirmação foi feita por esta consulta.";
    if (error instanceof SessionChanged) { status = 409; code = "SESSION_CHANGED"; message = "A conta mudou em outra aba. Recarregue a página."; }
    else if (error instanceof AuthGuardError) { status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503; code = status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "UNAVAILABLE"; }
    else if (error instanceof ErroDeDominio && ["VALIDATION", "CONFLICT", "NOT_FOUND"].includes(error.code)) { code = error.code; message = error.message; status = code === "CONFLICT" ? 409 : code === "NOT_FOUND" ? 404 : 400; }
    else if (error instanceof RangeError) { status = 400; code = "VALIDATION"; message = "Revise as datas e os valores da intenção."; }
    return NextResponse.json({ ok: false, code, message }, { status, headers });
  }
}
