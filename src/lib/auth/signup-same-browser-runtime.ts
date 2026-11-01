import "server-only";
import type { AuthCookieJar } from "./clients";
import type { SupabaseAuthConfig } from "./config";
import { AUTH_COOKIE_NAME } from "./cookie-policy";
import { signupBrowserSecretHash } from "./signup-browser-secret";
import { createSignupRequestPorts } from "./signup-runtime";
import { createSignupConfirmationPorts } from "./signup-confirmation-runtime";
import { continueVerifiedSignup } from "./signup-confirmation-service";
import { signupRpc, signupUnavailable } from "./signup-http";
import type { SameBrowserStartPorts } from "./signup-same-browser-start";
import type { SameBrowserSignupPorts } from "./signup-same-browser-service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const hasAuthCookie=(cookies:{name:string;value:string}[])=>cookies.some(({name,value})=>value!=="" && (name===AUTH_COOKIE_NAME || name.startsWith(`${AUTH_COOKIE_NAME}.`) || name.startsWith(`${AUTH_COOKIE_NAME}-`)));
export const hasAuthCookieHeader=(header:string|null)=>hasAuthCookie((header??"").split(";").map(part=>{const index=part.indexOf("=");return index<0?{name:part.trim(),value:""}:{name:part.slice(0,index).trim(),value:part.slice(index+1)};}));

export function createSameBrowserStartPorts(config:SupabaseAuthConfig, cookies:{name:string;value:string}[],cookieHeader:string|null):SameBrowserStartPorts {
 const base=createSignupRequestPorts(config);
 return {
  ...base,canBegin:()=>!hasAuthCookie(cookies)&&!hasAuthCookieHeader(cookieHeader),browserHash:secret=>signupBrowserSecretHash(secret,config.stateSecret),
  async prepare(value) {
   const id=await signupRpc(config,"signup_browser_prepare",{p_binding:value.bindingHash,p_browser:value.browserHash,p_subject:value.subjectHash,p_terms:value.termsVersion,p_privacy:value.privacyVersion,p_expires:new Date(value.expiresAt).toISOString(),p_origin:value.origin,p_origin_version:value.originVersion});
   if(typeof id!=="string" || !UUID.test(id)) return signupUnavailable();
  },
 };
}

export function createSameBrowserConfirmationPorts(config:SupabaseAuthConfig,jar:AuthCookieJar,headers:Headers,purpose:"signup"|"continuation"):SameBrowserSignupPorts {
 const base=createSignupConfirmationPorts(config,jar,headers,purpose);
 return {
  canBegin:base.canBegin,browserHash:secret=>signupBrowserSecretHash(secret,config.stateSecret),limitToken:base.limitToken,
  verifyEmailProof:base.verifyEmailProof,subjectHash:base.subjectHash,clearProvisionalSession:base.clearProvisionalSession,
  async findAttempt(hash) {const value=await signupRpc(config,"signup_browser_find",{p_browser:hash});if(value===null)return null;if(!value || typeof value!=="object" || Array.isArray(value) || Object.keys(value).sort().join(",")!=="intentId,originPending,userId")return signupUnavailable();const data=value as Record<string,unknown>;if(typeof data.intentId!=="string" || !UUID.test(data.intentId) || typeof data.userId!=="string" || !UUID.test(data.userId) || typeof data.originPending!=="boolean")return signupUnavailable();return {intentId:data.intentId,userId:data.userId,originPending:data.originPending};},
  async continueVerified(identity,legal){return (await continueVerifiedSignup(base,identity,legal)).status==="ready";},
  async admit(value) {return signupRpc(config,"signup_browser_admit",{p_user:value.userId,p_session:value.sessionId,p_intent:value.intentId,p_subject:value.subjectHash,p_browser:value.browserHash,p_terms:value.terms,p_privacy:value.privacy,p_accept_origin:value.acceptOrigin,p_origin_version:value.originVersion});},
 };
}
