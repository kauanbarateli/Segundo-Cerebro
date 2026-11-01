import "server-only";
import { validEmail } from "./policy";
import type { SignupCheckpoint } from "./signup-checkpoint";
import type { SignupReconsentCheckpoint } from "./signup-reconsent-checkpoint";

type Identity={userId:string;sessionId:string;email:string};
export interface SignupReconsentPorts {
 enabled():boolean;now():number;readCheckpoint():SignupReconsentCheckpoint|null;readVerifiedIdentity():Promise<Identity|null>;
 subjectHash(email:string):string;limit(userId:string):Promise<{allowed:boolean}>;
 writeCheckpoint(value:SignupCheckpoint):Promise<void>;
 renew(value:{userId:string;sessionId:string;intentId:string;subjectHash:string;terms:string;privacy:string;keepOrigin:boolean;originVersion:string}):Promise<unknown>;
}
/** A signed checkpoint is created only after a fresh OTP. No password is sent. */
export async function renewSignupConsent(ports:SignupReconsentPorts,input:{acceptedLegal:unknown;termsVersion:unknown;privacyVersion:unknown;acceptedOrigin:unknown},current:{terms:string;privacy:string;originVersion:string}):Promise<{status:"renewed"|"invalid"|"needs-verification"|"rate-limited"|"unknown"}> {
 try {
  if(!ports.enabled())return {status:"needs-verification"};
  const proof=ports.readCheckpoint(),now=ports.now(),checkpoint=proof?.checkpoint;
  if(!proof || !checkpoint || checkpoint.passwordConfirmed || proof.terms!==current.terms || proof.privacy!==current.privacy || !Number.isSafeInteger(now) || checkpoint.expiresAt<=now)return {status:"needs-verification"};
  const actor=await ports.readVerifiedIdentity();
  if(!actor || actor.userId!==checkpoint.userId || actor.sessionId!==checkpoint.sessionId || /[\u0000-\u001f\u007f-\u009f<>]/u.test(actor.email))return {status:"needs-verification"};
  const email=actor.email.trim().toLowerCase();if(!validEmail(email))return {status:"needs-verification"};
  if(input.acceptedLegal!==true || input.termsVersion!==current.terms || input.privacyVersion!==current.privacy || typeof input.acceptedOrigin!=="boolean" || !current.terms || !current.privacy || !current.originVersion)return {status:"invalid"};
  if(!(await ports.limit(actor.userId)).allowed)return {status:"rate-limited"};
  const hash=ports.subjectHash(email);if(!/^[a-f0-9]{64}$/.test(hash))return {status:"unknown"};
  const result=await ports.renew({userId:actor.userId,sessionId:actor.sessionId,intentId:checkpoint.intentId,subjectHash:hash,terms:current.terms,privacy:current.privacy,keepOrigin:checkpoint.originPending&&input.acceptedOrigin===true,originVersion:current.originVersion});
  if(!result || typeof result!=="object" || Array.isArray(result) || Object.keys(result).sort().join(",")!=="originPending,status" || (result as {status:unknown}).status!=="renewed" || typeof (result as {originPending:unknown}).originPending!=="boolean")return {status:"unknown"};
  // Preserve the original OTP deadline; reflect a concurrent withdrawal.
  await ports.writeCheckpoint({...checkpoint,originPending:(result as {originPending:boolean}).originPending});
  return {status:"renewed"};
 } catch {return {status:"unknown"};}
}
