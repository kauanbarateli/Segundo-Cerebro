import {cookies} from "next/headers";
import {NextResponse,type NextRequest} from "next/server";
import {createRequestClient,type AuthCookieJar} from "@/lib/auth/clients";
import {readAuthConfiguration} from "@/lib/auth/config";
import {AUTH_COOKIE_NAME,noStoreHeaders,secureCookieOptions} from "@/lib/auth/cookie-policy";
import {sameOrigin} from "@/lib/auth/policy";
import {signupRedirect} from "@/lib/auth/signup-channel";
import {signupSameBrowserEnabled} from "@/lib/auth/signup-http";
import {readSignupForm} from "@/lib/auth/signup-form-body";
import {createSignupCompletionPorts} from "@/lib/auth/signup-completion-runtime";
import {SIGNUP_CHECKPOINT_COOKIE} from "@/lib/auth/signup-confirmation-runtime";
import {SIGNUP_RECONSENT_COOKIE,verifySignupReconsent,matchesSignupReconsentFormTag} from "@/lib/auth/signup-reconsent-checkpoint";

export const dynamic="force-dynamic";
const authCookie=(name:string)=>name===AUTH_COOKIE_NAME || name.startsWith(`${AUTH_COOKIE_NAME}.`) || name.startsWith(`${AUTH_COOKIE_NAME}-`);
/** User-requested local sign-out, only for the exact OTP-proven session. */
export async function POST(request:NextRequest){
 try {
  const config=readAuthConfiguration();if(config.mode!=="supabase" || !signupSameBrowserEnabled(config))return new NextResponse(null,{status:503,headers:noStoreHeaders()});
  if(!sameOrigin(request.headers.get("origin"),config.appOrigin))return new NextResponse(null,{status:403,headers:noStoreHeaders()});
  const form=await readSignupForm(request,["reviewTag"]);if(!form)return signupRedirect(config,"/cadastro/revisar?status=unknown");
  const store=await cookies(),jar:AuthCookieJar={getAll:()=>store.getAll(),set:(name,value,options)=>{store.set(name,value,options);}};
  const values=jar.getAll().filter(cookie=>cookie.name===SIGNUP_RECONSENT_COOKIE),token=values.length===1?values[0]?.value:undefined;
  const proof=verifySignupReconsent(token,config.stateSecret,Date.now());
  if(!token || !proof || !matchesSignupReconsentFormTag(token,config.stateSecret,form.reviewTag))return signupRedirect(config,"/cadastro/revisar?status=unknown");
  const headers=new Headers(noStoreHeaders()),actor=await createSignupCompletionPorts(config,jar,headers).readVerifiedIdentity();
  if(!actor || actor.userId!==proof.checkpoint.userId || actor.sessionId!==proof.checkpoint.sessionId)return signupRedirect(config,"/cadastro/revisar?status=unknown");
  const {error}=await createRequestClient(config,jar,true,headers).auth.signOut({scope:"local"});
  if(error)return signupRedirect(config,"/cadastro/revisar?status=unknown");
  const expired=secureCookieOptions(config.secureCookies,{maxAge:0});
  for(const name of new Set([AUTH_COOKIE_NAME,SIGNUP_CHECKPOINT_COOKIE,SIGNUP_RECONSENT_COOKIE,...jar.getAll().filter(cookie=>authCookie(cookie.name)).map(cookie=>cookie.name)]))jar.set(name,"",expired);
  const response=signupRedirect(config,"/cadastro/reenviar");for(const [name,value] of headers)response.headers.set(name,value);return response;
 }catch{return new NextResponse(null,{status:503,headers:noStoreHeaders()});}
}
