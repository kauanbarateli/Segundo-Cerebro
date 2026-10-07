import { NextResponse, type NextRequest } from "next/server";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { sameOrigin } from "@/lib/auth/policy";
import { requestAuthServices } from "@/lib/auth/runtime";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const responseHeaders = new Headers(noStoreHeaders());
  let destination = "/entrar?notice=signed-out";
  try {
    const config = readAuthConfiguration();
    if (config.mode === "demo") return new NextResponse(null, { status: 303, headers: { ...Object.fromEntries(responseHeaders), Location: "/sair" } });
    if (!sameOrigin(request.headers.get("origin"), config.appOrigin)) return new NextResponse("Origem não permitida.", { status: 403, headers: responseHeaders });
    const services = await requestAuthServices(true, responseHeaders);
    try { if (!await services.gateway.signOut("global")) destination = "/entrar?notice=logout-incomplete"; }
    catch { destination = "/entrar?notice=logout-incomplete"; }
    finally { services.flows.clearSessionCookies(); }
  } catch { return new NextResponse("Autenticação indisponível neste ambiente.", { status: 503, headers: responseHeaders }); }
  responseHeaders.set("Clear-Site-Data", '"cache", "storage"');
  return new NextResponse(null, { status: 303, headers: { ...Object.fromEntries(responseHeaders), Location: destination } });
}
