import "server-only";
import { validateSignupRequest } from "./signup-validation";
import { parseSignupOrigin, SIGNUP_ORIGIN_CONSENT_VERSION, type SignupOrigin } from "../../core/acquisition/signup-origin";

/** Server-only ports. Provision the HttpOnly browser cookie in a prior response. */
export interface SameBrowserStartPorts {
 canBegin():boolean;
 now(): number;
 randomPointer(): string;
 bindingHash(pointer: string): string;
 browserHash(secret: string): string;
 subjectHash(email: string): string;
 limit(subjectHash: string): Promise<{allowed:boolean}>;
 prepare(value: {bindingHash:string;browserHash:string;subjectHash:string;termsVersion:string;privacyVersion:string;expiresAt:number;origin:SignupOrigin|null;originVersion:string|null}): Promise<void>;
 /** One Auth call only; neither an error nor a duplicate proves identity creation. */
 signup(value: {email:string;password:string;pointer:string}): Promise<void>;
}
const HASH=/^[a-f0-9]{64}$/;

/** No secrets, password, OTP or provider response may be logged or persisted here. */
export async function startSameBrowserSignup(ports:SameBrowserStartPorts,input:unknown,browserSecret:unknown,current:{terms:string;privacy:string},originChoice?:{consented:unknown;candidate:unknown}):Promise<{status:"accepted"|"invalid"|"rate-limited"|"unavailable"}> {
 const parsed=validateSignupRequest(input,current);
 if(!parsed.ok) return {status:"invalid"};
 if(typeof browserSecret!=="string" || !/^[A-Za-z0-9_-]{43}$/.test(browserSecret)) return {status:"unavailable"};
 try {
  if(!ports.canBegin()) return {status:"unavailable"};
  const now=ports.now(),pointer=ports.randomPointer();
  if(!Number.isSafeInteger(now) || now<0 || !Number.isSafeInteger(now+30*60*1000) || !/^[A-Za-z0-9_-]{43,128}$/.test(pointer)) return {status:"unavailable"};
  const bindingHash=ports.bindingHash(pointer),browserHash=ports.browserHash(browserSecret),subjectHash=ports.subjectHash(parsed.value.email);
  if(!HASH.test(bindingHash) || !HASH.test(browserHash) || !HASH.test(subjectHash) || bindingHash===browserHash) return {status:"unavailable"};
  if(!(await ports.limit(subjectHash)).allowed) return {status:"rate-limited"};
  const origin=originChoice?.consented===true ? parseSignupOrigin(true,originChoice.candidate) : null;
  await ports.prepare({bindingHash,browserHash,subjectHash,termsVersion:current.terms,privacyVersion:current.privacy,expiresAt:now+30*60*1000,origin,originVersion:origin?SIGNUP_ORIGIN_CONSENT_VERSION:null});
  try { await ports.signup({email:parsed.value.email,password:parsed.value.password,pointer}); } catch { /* neutral response, never infer a new account */ }
  return {status:"accepted"};
 } catch {return {status:"unavailable"};}
}
