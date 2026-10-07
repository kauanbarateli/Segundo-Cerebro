// Edge/server boundary: this module is only imported by Next middleware.
// It deliberately avoids node:crypto and the Node-only action/runtime modules.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readAuthConfiguration } from "./config";
import { AUTH_COOKIE_NAME, noStoreHeaders, secureCookieOptions } from "./cookie-policy";

export async function updateSessionMiddleware(request: NextRequest, requestHeaders: Headers): Promise<NextResponse> {
  let config: ReturnType<typeof readAuthConfiguration>;
  try { config = readAuthConfiguration(); } catch { return new NextResponse("Autenticação indisponível neste ambiente.", { status: 503, headers: noStoreHeaders() }); }
  if (config.mode === "demo") return NextResponse.next({ request: { headers: requestHeaders } });
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const client = createServerClient(config.supabaseUrl, config.publishableKey, {
    auth: { flowType: "pkce", autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) },
    cookieOptions: { name: AUTH_COOKIE_NAME, ...secureCookieOptions(config.secureCookies) },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, cacheHeaders) {
        const previousCookies = response.cookies.getAll(), previousHeaders = new Headers(response.headers);
        for (const { name, value } of values) request.cookies.set(name, value);
        requestHeaders.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const cookie of previousCookies) response.cookies.set(cookie);
        previousHeaders.forEach((value, name) => { if (!name.startsWith("x-middleware-") && name !== "set-cookie") response.headers.set(name, value); });
        for (const { name, value, options } of values) response.cookies.set(name, value, secureCookieOptions(config.secureCookies, options));
        for (const [name, value] of Object.entries(cacheHeaders)) response.headers.set(name, value);
      },
    },
  });
  try { await client.auth.getUser(); } catch {
    // Keep mutations produced by refresh, while refusing to render private content.
    const unavailable = new NextResponse("Autenticação temporariamente indisponível.", { status: 503, headers: noStoreHeaders() });
    for (const cookie of response.cookies.getAll()) unavailable.cookies.set(cookie);
    return unavailable;
  }
  for (const [name, value] of Object.entries(noStoreHeaders())) response.headers.set(name, value);
  return response;
}
