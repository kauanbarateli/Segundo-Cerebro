import { NextResponse } from "next/server";
import { onboardingForRequest } from "@/adapters/db/onboarding-runtime";
import { decodeOnboardingCommand, OnboardingValidationError } from "@/core/onboarding/validation";
import { OnboardingPortError } from "@/core/onboarding/types";
import { readAuthConfiguration } from "@/lib/auth/config";
import { requestAuthServices } from "@/lib/auth/runtime";
import { sameOrigin, assertFeature } from "@/lib/auth/policy";
import { AuthGuardError } from "@/lib/auth/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = () => new Headers({ "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" });
class SessionChanged extends Error {}
async function services(request: Request, headers: Headers, write: boolean) {
  const config = readAuthConfiguration(); if (config.mode !== "supabase") throw new AuthGuardError("demo");
  const identity = await (await requestAuthServices(true, headers)).gateway.readIdentity();
  if (!identity) throw new AuthGuardError("unauthenticated");
  if (identity.mustChangePassword) throw new AuthGuardError("forbidden");
  const expected = request.headers.get("x-expected-user-id"); if (!expected || expected !== identity.userId) throw new SessionChanged();
  assertFeature(identity, "configuracoes");
  if (write && (!sameOrigin(request.headers.get("origin"), config.appOrigin) || request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")) throw new AuthGuardError("forbidden");
  return onboardingForRequest(config, identity);
}
function failure(error: unknown, headers: Headers) {
  let status = 503, code = "UNAVAILABLE";
  if (error instanceof SessionChanged) { status = 409; code = "SESSION_CHANGED"; }
  else if (error instanceof AuthGuardError) { status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : 503; code = error.code.toUpperCase(); }
  else if (error instanceof OnboardingValidationError) { status = 400; code = "VALIDATION"; }
  else if (error instanceof OnboardingPortError) { code = error.code; status = code === "FORBIDDEN" ? 403 : code === "CONFLICT" ? 409 : 503; }
  return NextResponse.json({ ok: false, code, message: status === 409 ? "A configuração ou a conta mudou. Recarregue antes de continuar." : status === 400 ? "Revise as escolhas da configuração." : "Não foi possível confirmar esta operação." }, { status, headers });
}
async function body(request: Request): Promise<unknown> {
  const reader = request.body?.getReader(); if (!reader) throw new OnboardingPortError("CONFLICT");
  let bytes = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 96 * 1024) { await reader.cancel(); throw new OnboardingPortError("CONFLICT"); } chunks.push(part.value); }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); } catch { throw new OnboardingPortError("CONFLICT"); }
  } finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
  const headers = privateHeaders();
  try {
    const port = await services(request, headers, false), params = new URL(request.url).searchParams;
    const kind = params.get("choices");
    if (kind !== null) {
      if (!["projects", "notebooks"].includes(kind) || params.getAll("choices").length !== 1 || params.getAll("q").length > 1 || params.getAll("cursor").length > 1 ||
          (params.get("q")?.length ?? 0) > 120 || (params.get("cursor")?.length ?? 0) > 2048) throw new OnboardingPortError("CONFLICT");
      return NextResponse.json({ ok: true, result: await port.choices({ kind: kind as "projects" | "notebooks", query: params.get("q") ?? "", cursor: params.get("cursor") }) }, { headers });
    }
    return NextResponse.json({ ok: true, result: await port.load() }, { headers });
  } catch (error) { return failure(error, headers); }
}
export async function POST(request: Request) {
  const headers = privateHeaders();
  try {
    const port = await services(request, headers, true), requestCommand = decodeOnboardingCommand(await body(request));
    let result;
    switch (requestCommand.command) {
      case "onboarding.start": result = await port.start(requestCommand.input); break;
      case "onboarding.save": result = await port.save(requestCommand.input); break;
      case "onboarding.pause": result = await port.pause(requestCommand.input); break;
      case "onboarding.confirm": result = await port.confirm(requestCommand.input); break;
      case "onboarding.advance": result = await port.advance(requestCommand.input); break;
      case "onboarding.amend": result = await port.amend(requestCommand.input); break;
    }
    return NextResponse.json({ ok: true, result }, { headers });
  } catch (error) { return failure(error, headers); }
}
