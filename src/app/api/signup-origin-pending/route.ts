import { cookies } from "next/headers";
import type { AuthCookieJar } from "@/lib/auth/clients";
import {readSignupContext,signupProvisionalCookie} from "@/lib/auth/signup-provisional";
import { createRequestClient } from "@/lib/auth/clients";
import { readAuthConfiguration } from "@/lib/auth/config";
import { noStoreHeaders } from "@/lib/auth/cookie-policy";
import { sameOrigin } from "@/lib/auth/policy";
import { signupFenceDeployed, signupFenceRpc } from "@/lib/auth/signup-http";
import { readVerifiedActor } from "@/lib/auth/signup-origin-pending-actor";
import { withdrawPendingOrigin } from "@/lib/auth/signup-origin-pending-handler";

export const dynamic = "force-dynamic";
export async function POST(request:Request):Promise<Response>{
 try {
  const config=readAuthConfiguration();
  // Candidate intentionally unavailable until the complete release contract is reviewed.
  if(config.mode!=="supabase"||!signupFenceDeployed(config))return new Response(null,{status:503,headers:noStoreHeaders()});
  const store=await cookies(),jar:AuthCookieJar={getAll:()=>store.getAll(),set:(name,value,options)=>{store.set(name,value,options);}};
  const propagated=new Headers(noStoreHeaders()),context=readSignupContext(jar,config.stateSecret);
  const result=await withdrawPendingOrigin(request,{allowedOrigin:origin=>sameOrigin(origin,config.appOrigin),verifiedActor:async()=>{
   if(!context)return null;const client=createRequestClient(config,jar,true,propagated,signupProvisionalCookie(context.scope)),actor=await readVerifiedActor(client.auth);
   return actor&&actor.userId===context.userId&&actor.sessionId===context.sessionId?actor:null;
  },withdraw:actor=>signupFenceRpc(config,"signup_fence_withdraw",{p_user:actor.userId,p_session:actor.sessionId})});
  for(const [key,value] of propagated)result.headers.set(key,value);
  return result;
 }catch{return new Response(null,{status:503,headers:noStoreHeaders()});}
}
