import "server-only";
import type { AuthCookieJar } from "./clients";
import type { SupabaseAuthConfig } from "./config";
import { AUTH_COOKIE_NAME } from "./cookie-policy";
import { signupBrowserSecretHash } from "./signup-browser-secret";
import { createSignupRequestPorts } from "./signup-runtime";
import { createSignupConfirmationPorts } from "./signup-confirmation-runtime";
import { signupRpc, signupUnavailable } from "./signup-http";
import type { SameBrowserStartPorts } from "./signup-same-browser-start";
import type { SameBrowserSignupPorts } from "./signup-same-browser-service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const hasAuthCookie=(cookies:{name:string;value:string}[])=>cookies.some(({name,value})=>value!=="" && (name===AUTH_COOKIE_NAME || name.startsWith(`${AUTH_COOKIE_NAME}.`) || name.startsWith(`${AUTH_COOKIE_NAME}-`)));

export function createSameBrowserStartPorts(config:SupabaseAuthConfig, cookies:{name:string;value:string}[]):SameBrowserStartPorts {
 const base=createSignupRequestPorts(config);
 return {
  ...base,canBegin:()=>!hasAuthCookie(cookies),browserHash:secret=>signupBrowserSecretHash(secret,config.stateSecret),
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
  async findAttempt(hash) {const value=await signupRpc(config,"signup_browser_find",{p_browser:hash});if(value===null)return null;if(typeof value!=="string" || !UUID.test(value))return signupUnavailable();return {intentId:value};},
  async admit(value) {return signupRpc(config,"signup_browser_admit",{p_user:value.userId,p_session:value.sessionId,p_intent:value.intentId,p_subject:value.subjectHash,p_browser:value.browserHash,p_terms:value.terms,p_privacy:value.privacy,p_accept_origin:value.acceptOrigin,p_origin_version:value.originVersion});},
 };
}
