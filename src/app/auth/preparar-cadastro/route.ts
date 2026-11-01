import { NextResponse, type NextRequest } from "next/server";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders, secureCookieOptions } from "@/lib/auth/cookie-policy";
import { signupSameBrowserEnabled } from "@/lib/auth/signup-http";
import { SIGNUP_BROWSER_COOKIE } from "@/lib/auth/signup-channel";
import { newSignupBrowserSecret, readSignupBrowserCookie } from "@/lib/auth/signup-browser-secret";
import { hasAuthCookie, hasAuthCookieHeader } from "@/lib/auth/signup-same-browser-runtime";

export const dynamic="force-dynamic";
/** A new submission receives a new secret; older intents remain recoverable by OTP + password. */
export async function GET(request:NextRequest) {
 try {
  const config=readAuthConfiguration();
  if(config.mode!=="supabase" || !signupSameBrowserEnabled(config)) return new NextResponse(null,{status:503,headers:noStoreHeaders()});
  if(request.headers.get("sec-fetch-site")!=="same-origin") return new NextResponse(null,{status:403,headers:noStoreHeaders()});
  const all=request.cookies.getAll(), browser=readSignupBrowserCookie(request.headers.get("cookie"));
  if(hasAuthCookie(all) || hasAuthCookieHeader(request.headers.get("cookie")) || browser.status==="invalid") return new NextResponse(null,{status:409,headers:noStoreHeaders()});
  const response=NextResponse.json({ok:true},{headers:noStoreHeaders()});
  response.cookies.set(SIGNUP_BROWSER_COOKIE,newSignupBrowserSecret(),secureCookieOptions(config.secureCookies,{maxAge:1800}));
  return response;
 } catch {return new NextResponse(null,{status:503,headers:noStoreHeaders()});}
}
