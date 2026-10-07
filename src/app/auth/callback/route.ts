import { NextResponse, type NextRequest } from "next/server";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { requestAuthServices } from "@/lib/auth/runtime";
import { exchangeRecovery } from "@/lib/auth/service";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const responseHeaders = new Headers(noStoreHeaders());
  let destination = "/recuperar-senha?notice=recovery-invalid";
  try {
    const services = await requestAuthServices(true, responseHeaders);
    const params = request.nextUrl.searchParams;
    destination = await exchangeRecovery(services, { code: params.get("code"), state: params.get("state"), flowId: params.get("sb_flow_id") ?? undefined });
  } catch { /* No auth/code/provider diagnostic in redirect or response. */ }
  responseHeaders.set("Referrer-Policy", "no-referrer");
  return new NextResponse(null, { status: 303, headers: { ...Object.fromEntries(responseHeaders), Location: destination } });
}
