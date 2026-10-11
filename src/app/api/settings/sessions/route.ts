import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ownSessionsForRequest } from "@/adapters/db/own-sessions-runtime";
import { OwnSessionsReadError, ownSessionId } from "@/core/configuracoes/own-sessions";
import type { AuthCookieJar } from "@/lib/auth/clients";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { assertFeature, sameOrigin } from "@/lib/auth/policy";
import { createAuthServices } from "@/lib/auth/runtime";
import { AuthGuardError } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class InvalidRead extends Error {}
function originalRequestUrl(request: Request): string {
  // NextRequest.url normalizes loopback hosts. The Web Request getter retains
  // the original absolute URL, including a bare query marker, for this guard.
  const getter = Object.getOwnPropertyDescriptor(Request.prototype, "url")?.get;
  if (!getter) throw new InvalidRead();
  let value: unknown;
  try { value = getter.call(request); } catch { throw new InvalidRead(); }
  if (typeof value !== "string") throw new InvalidRead();
  return value;
}

export async function GET(request: Request) {
  const responseHeaders = new Headers();
  const reply = (value: unknown, status = 200) => {
    // Refresh callbacks may alter headers; privacy is reapplied on every outcome.
    for (const [name, value] of Object.entries(noStoreHeaders())) responseHeaders.set(name, value);
    responseHeaders.set("X-Content-Type-Options", "nosniff"); responseHeaders.set("Vary", "Cookie");
    return NextResponse.json(value, { status, headers: responseHeaders });
  };
  try {
    const config = readAuthConfiguration();
    if (config.mode !== "supabase") throw new AuthGuardError("unavailable");
    if (request.method !== "GET" || originalRequestUrl(request) !== config.appOrigin + "/api/settings/sessions" || request.body !== null) throw new InvalidRead();
    const origin = request.headers.get("origin"), site = request.headers.get("sec-fetch-site");
    if (origin !== null && !sameOrigin(origin, config.appOrigin) || site !== null && !["same-origin", "none"].includes(site)) throw new AuthGuardError("forbidden");
    const expected = request.headers.get("x-expected-user-id");
    if (!ownSessionId(expected)) throw new InvalidRead();
    const cookieStore = await cookies();
    const jar: AuthCookieJar = { getAll: () => cookieStore.getAll(), set: (name, value, options) => { cookieStore.set(name, value, options); } };
    const identity = await createAuthServices(config, jar, true, responseHeaders).gateway.readIdentity();
    if (!identity) throw new AuthGuardError("unauthenticated");
    assertFeature(identity, "configuracoes");
    if (expected !== identity.userId) throw new OwnSessionsReadError("SESSION_CHANGED");
    return reply(await ownSessionsForRequest(config, identity, jar, responseHeaders).read());
  } catch (error) {
    const code = error instanceof InvalidRead ? "VALIDATION" : error instanceof OwnSessionsReadError ? error.code : error instanceof AuthGuardError && error.code === "unauthenticated" ? "UNAUTHENTICATED" : error instanceof AuthGuardError && error.code === "forbidden" ? "FORBIDDEN" : "UNAVAILABLE";
    const status = code === "VALIDATION" ? 400 : code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : code === "SESSION_CHANGED" ? 409 : 503;
    const message = status === 401 ? "Entre novamente para consultar suas sessões." : status === 409 ? "Sua sessão mudou. Entre novamente." : status === 403 ? "As sessões não estão disponíveis para esta conta." : status === 400 ? "Atualize a página para confirmar sua conta." : "Não foi possível carregar suas sessões. Tente novamente.";
    return reply({ ok: false, code, message }, status);
  }
}
