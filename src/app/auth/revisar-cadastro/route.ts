import {cookies} from "next/headers";
import {NextResponse,type NextRequest} from "next/server";
import type {AuthCookieJar} from "@/lib/auth/clients";
import {readAuthConfiguration} from "@/lib/auth/config";
import {noStoreHeaders} from "@/lib/auth/cookie-policy";
import {sameOrigin} from "@/lib/auth/policy";
import {signupRedirect} from "@/lib/auth/signup-channel";
import {signupSameBrowserEnabled,signupRpc} from "@/lib/auth/signup-http";
import {readSignupForm} from "@/lib/auth/signup-form-body";
import {createSignupCompletionPorts} from "@/lib/auth/signup-completion-runtime";
import {createSignupConfirmationPorts} from "@/lib/auth/signup-confirmation-runtime";
import {SIGNUP_RECONSENT_COOKIE,verifySignupReconsent,matchesSignupReconsentFormTag} from "@/lib/auth/signup-reconsent-checkpoint";
import {renewSignupConsent} from "@/lib/auth/signup-reconsent-service";
import {LEGAL_DOCUMENTS} from "@/lib/legal/documents";
import {SIGNUP_ORIGIN_CONSENT_VERSION} from "@/core/acquisition/signup-origin";

export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 try {
  const config=readAuthConfiguration();if(config.mode!=="supabase" || !signupSameBrowserEnabled(config))return new NextResponse(null,{status:503,headers:noStoreHeaders()});
  if(!sameOrigin(request.headers.get("origin"),config.appOrigin))return new NextResponse(null,{status:403,headers:noStoreHeaders()});
  const form=await readSignupForm(request,["acceptedLegal","termsVersion","privacyVersion","acceptedOrigin","reviewTag"]);
  if(!form)return signupRedirect(config,"/cadastro/revisar?status=invalid");
  const store=await cookies(),jar:AuthCookieJar={getAll:()=>store.getAll(),set:(name,value,options)=>{store.set(name,value,options);}};
  const values=jar.getAll().filter(cookie=>cookie.name===SIGNUP_RECONSENT_COOKIE),token=values.length===1?values[0]?.value:undefined;
  if(!token || !matchesSignupReconsentFormTag(token,config.stateSecret,form.reviewTag))return signupRedirect(config,"/cadastro/revisar?status=invalid");
  const headers=new Headers(noStoreHeaders()),base=createSignupCompletionPorts(config,jar,headers);
  const result=await renewSignupConsent({enabled:()=>signupSameBrowserEnabled(config),now:base.now,readCheckpoint:()=>{const values=jar.getAll().filter(cookie=>cookie.name===SIGNUP_RECONSENT_COOKIE);return values.length===1?verifySignupReconsent(values[0]?.value,config.stateSecret,Date.now()):null;},readVerifiedIdentity:base.readVerifiedIdentity,subjectHash:base.subjectHash,limit:base.limit,
   writeCheckpoint:createSignupConfirmationPorts(config,jar,headers,"continuation",true).putCheckpoint,
   renew:value=>signupRpc(config,"signup_browser_renew",{p_user:value.userId,p_session:value.sessionId,p_intent:value.intentId,p_subject:value.subjectHash,p_terms:value.terms,p_privacy:value.privacy,p_keep_origin:value.keepOrigin,p_origin_version:value.originVersion,p_proof_expires_at:value.proofExpiresAt})},
   {acceptedLegal:form.acceptedLegal==="yes",termsVersion:form.termsVersion,privacyVersion:form.privacyVersion,acceptedOrigin:form.acceptedOrigin==="yes"},
   {terms:LEGAL_DOCUMENTS.termos.version,privacy:LEGAL_DOCUMENTS.privacidade.version,originVersion:SIGNUP_ORIGIN_CONSENT_VERSION});
  const destination=result.status==="renewed"?"/cadastro/definir-senha":result.status==="needs-verification"?"/cadastro/reenviar":`/cadastro/revisar?status=${result.status}`;
  const response=signupRedirect(config,destination);for(const [name,value] of headers)response.headers.set(name,value);return response;
 }catch{return new NextResponse(null,{status:503,headers:noStoreHeaders()});}
}
