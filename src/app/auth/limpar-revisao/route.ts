import {cookies} from "next/headers";
import {NextResponse,type NextRequest} from "next/server";
import {createRequestClient,type AuthCookieJar} from "@/lib/auth/clients";
import {readAuthConfiguration} from "@/lib/auth/config";
import {noStoreHeaders,secureCookieOptions} from "@/lib/auth/cookie-policy";
import {sameOrigin} from "@/lib/auth/policy";
import {signupRedirect} from "@/lib/auth/signup-channel";
import {signupSameBrowserEnabled} from "@/lib/auth/signup-http";
import {readSignupForm} from "@/lib/auth/signup-form-body";
import {createSignupCompletionPorts} from "@/lib/auth/signup-completion-runtime";
import {matchesSignupReconsentFormTag} from "@/lib/auth/signup-reconsent-checkpoint";
import {SIGNUP_CONTEXT_COOKIE,verifySignupContext,signupProvisionalCookie,isProvisionalCookie} from "@/lib/auth/signup-provisional";

export const dynamic="force-dynamic";
/** Explicit sign-out affects only the OTP-proven provisional namespace. */
export async function POST(request:NextRequest){
 try {
  const config=readAuthConfiguration();if(config.mode!=="supabase"||!signupSameBrowserEnabled(config))return new NextResponse(null,{status:503,headers:noStoreHeaders()});
  if(!sameOrigin(request.headers.get("origin"),config.appOrigin))return new NextResponse(null,{status:403,headers:noStoreHeaders()});
  const form=await readSignupForm(request,["reviewTag"]);if(!form)return signupRedirect(config,"/cadastro/revisar?status=unknown");
  const store=await cookies(),jar:AuthCookieJar={getAll:()=>store.getAll(),set:(name,value,options)=>{store.set(name,value,options);}};
  const values=jar.getAll().filter(cookie=>cookie.name===SIGNUP_CONTEXT_COOKIE),token=values.length===1?values[0]?.value:undefined;
  const context=verifySignupContext(token,config.stateSecret);
  if(!token||!context||!matchesSignupReconsentFormTag(token,config.stateSecret,form.reviewTag))return signupRedirect(config,"/cadastro/revisar?status=unknown");
  const headers=new Headers(noStoreHeaders()),actor=await createSignupCompletionPorts(config,jar,headers).readVerifiedIdentity();
  if(!actor||actor.userId!==context.userId||actor.sessionId!==context.sessionId)return signupRedirect(config,"/cadastro/revisar?status=unknown");
  const {error}=await createRequestClient(config,jar,true,headers,signupProvisionalCookie(context.scope)).auth.signOut({scope:"local"});
  if(error)return signupRedirect(config,"/cadastro/revisar?status=unknown");
  const expired=secureCookieOptions(config.secureCookies,{maxAge:0});
  for(const name of new Set([signupProvisionalCookie(context.scope),...jar.getAll().filter(cookie=>isProvisionalCookie(cookie.name,context.scope)).map(cookie=>cookie.name)]))jar.set(name,"",expired);
  const response=signupRedirect(config,"/cadastro/reenviar");for(const [name,value] of headers)response.headers.set(name,value);return response;
 }catch{return new NextResponse(null,{status:503,headers:noStoreHeaders()});}
}
