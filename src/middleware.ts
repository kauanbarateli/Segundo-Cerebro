import { NextResponse, type NextRequest } from "next/server";
import { applySecurityHeaders, contentSecurityPolicy, createNonce } from "./lib/security/csp";
import { updateSessionMiddleware } from "./lib/auth/middleware-session";

export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const https = request.nextUrl.protocol === "https:";
  const policy = await contentSecurityPolicy(nonce, { development: process.env.NODE_ENV === "development", https });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.delete("Content-Security-Policy-Report-Only");
  const publicPage = ["/offline", "/compartilhar", "/compartilhar/receber", "/design-system"].includes(request.nextUrl.pathname);
  const response = publicPage
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : await updateSessionMiddleware(request, requestHeaders);
  applySecurityHeaders(response.headers, policy, https);
  if (request.nextUrl.pathname === "/auth/callback") response.headers.set("Referrer-Policy", "no-referrer");
  // Offline is the sole public document explicitly precached by the service worker.
  // Its HTML and matching CSP travel together; no session refresh runs on that path.
  if (request.nextUrl.pathname !== "/compartilhar/receber") response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Do not skip RSC or prefetched private routes: those requests also need fresh auth.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|splash/|sw.js|swe-worker|manifest.webmanifest).*)"],
};
