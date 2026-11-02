import { validEmail, validNewPassword } from "./policy";
import type { SignupCheckpoint } from "./signup-checkpoint";
import { SIGNUP_ORIGIN_CONSENT_VERSION } from "../../core/acquisition/signup-origin";

type PendingIdentity = { userId: string; sessionId: string; email: string };
type Intent = { intentId: string; termsVersion: string; privacyVersion: string; state: "bound" | "consumed"; originPending: boolean };
export type CompletionFence = Readonly<{ userId:string; sessionId:string; intentId:string; subjectHash:string; requestId:string; generation:string }>;
export type ReservationInput = Readonly<Omit<CompletionFence,"generation"> & { terms:string; privacy:string; acceptOrigin:boolean; originVersion:string|null }>;
export type CurrentVersions = Readonly<{ terms:string; privacy:string; originVersion:string }>;
export interface SignupCompletionPorts {
  /** Hard-disabled until SQL, Admin and provider gates are reviewed. */
  reservationEnabled(): boolean;
  now(): number;
  readCheckpoint(): SignupCheckpoint | null;
  readVerifiedIdentity(): Promise<PendingIdentity | null>;
  subjectHash(email: string): string;
  limit(userId: string): Promise<{ allowed: boolean }>;
  findBoundIntent(userId: string, sessionId: string, hash: string): Promise<Intent | null>;
  newRequestId(): string;
  /** Includes legal/origin snapshot and the atomic discard when origin is refused. */
  reserveCompletion(input: ReservationInput): Promise<unknown>;
  /** Only a new, committed CAS grants one external call. */
  startCompletion(fence: CompletionFence): Promise<unknown>;
  updatePassword(password: string): Promise<"updated" | "rejected" | "unknown">;
  markUncertain(fence: CompletionFence): Promise<void>;
  /** Must verify server-side provider outcome and atomically record proof and ack. */
  acknowledgePassword(fence: CompletionFence): Promise<unknown>;
  /** Must atomically admit and mark complete; never calls Auth. */
  finishCompletion(fence: CompletionFence, versions: CurrentVersions): Promise<unknown>;
  /** Server-bound and committed monotonic withdrawal, including competing attempts. */
  withdrawCurrent(userId:string,sessionId:string): Promise<unknown>;
  /** Verified read-only confirmation independent of the retained subject hash. */
  confirmFinished(userId:string,sessionId:string,intentId:string): Promise<unknown>;
  clearCheckpoint(): Promise<void>;
}
export type SignupCompletionResult = { status: "completed" | "invalid" | "password-invalid" | "rate-limited" | "needs-verification" | "pending-reconciliation" | "unavailable" };
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pending=():SignupCompletionResult=>({status:"pending-reconciliation"});
function reservation(value:unknown,requestId:string):{status:"acquired"|"acknowledged";requestId:string;generation:string}|null {
  if (!value || typeof value!=="object" || Array.isArray(value)) return null;
  const result=value as Record<string,unknown>;
  if (Object.keys(result).sort().join(",")!=="generation,requestId,status" || (result.status!=="acquired" && result.status!=="acknowledged") || typeof result.requestId!=="string" || !UUID.test(result.requestId) || (result.status==="acquired" && result.requestId!==requestId) || typeof result.generation!=="string" || !UUID.test(result.generation)) return null;
  return {status:result.status,requestId:result.requestId,generation:result.generation};
}

/** Explicit POST. This service is not safe to enable without the documented gates. */
export async function completePublicSignup(ports: SignupCompletionPorts, input: { password: unknown; acceptedLegal: unknown; termsVersion: unknown; privacyVersion: unknown; acceptedOrigin?: unknown }, current: { terms: string; privacy: string }): Promise<SignupCompletionResult> {
  try {
    if (!ports.reservationEnabled()) return {status:"unavailable"};
    const checkpoint=ports.readCheckpoint(),now=ports.now();
    if (!checkpoint || !Number.isSafeInteger(now) || checkpoint.expiresAt<=now) return {status:"needs-verification"};
    const identity=await ports.readVerifiedIdentity();
    if (!identity || identity.userId!==checkpoint.userId || identity.sessionId!==checkpoint.sessionId || /[\u0000-\u001f\u007f-\u009f<>]/u.test(identity.email)) return {status:"needs-verification"};
    const email=identity.email.trim().toLowerCase();if (!validEmail(email)) return {status:"needs-verification"};
    // A separate authenticated command fences withdrawal before either completion read.
    // The standalone withdrawal endpoint is still required when the checkpoint has expired.
    if(checkpoint.originPending && input.acceptedOrigin===false) {
      try {
        const result=await ports.withdrawCurrent(identity.userId,identity.sessionId);
        if(!result || typeof result!=="object" || Array.isArray(result) || Object.keys(result).sort().join(",")!=="status" || !["withdrawn","absent"].includes((result as {status:string}).status)) return pending();
      } catch { return pending(); }
    }
    if (!(await ports.limit(identity.userId)).allowed) return {status:"rate-limited"};
    const hash=ports.subjectHash(email);if (!/^[a-f0-9]{64}$/.test(hash)) return {status:"unavailable"};
    let finished:unknown;
    try { finished=await ports.confirmFinished(identity.userId,identity.sessionId,checkpoint.intentId); } catch { return pending(); }
    if(finished===true) {
      await ports.clearCheckpoint();return {status:"completed"};
    }
    if(finished!==false) return pending();
    const intent=await ports.findBoundIntent(identity.userId,identity.sessionId,hash);
    if (!intent || intent.intentId!==checkpoint.intentId) return {status:"needs-verification"};
    if (intent.state==="consumed") {
      return pending();
    }
    if (input.acceptedLegal!==true || input.termsVersion!==current.terms || input.privacyVersion!==current.privacy || intent.termsVersion!==current.terms || intent.privacyVersion!==current.privacy || !current.terms || !current.privacy) return {status:"invalid"};
    // Old cookie evidence is not a durable fence and must never authorize retry.
    if (checkpoint.passwordConfirmed) return pending();
    if (typeof input.password!=="string" || input.password.length>4096 || !validNewPassword(input.password)) return {status:"password-invalid"};
    const acceptOrigin=intent.originPending && checkpoint.originPending && input.acceptedOrigin===true;
    const requestId=ports.newRequestId();if(typeof requestId!=="string" || !UUID.test(requestId)) return {status:"unavailable"};
    const scope={userId:identity.userId,sessionId:identity.sessionId,intentId:intent.intentId,subjectHash:hash,requestId};
    let result:ReturnType<typeof reservation>;
    try {result=reservation(await ports.reserveCompletion({...scope,terms:intent.termsVersion,privacy:intent.privacyVersion,acceptOrigin,originVersion:acceptOrigin?SIGNUP_ORIGIN_CONSENT_VERSION:null}),requestId);} catch {return pending();}
    if(!result)return pending();
    const fence:CompletionFence={...scope,requestId:result.requestId,generation:result.generation};
    // Only a durable acknowledgement for this same session can resume. It
    // already contains proof of the original provider response; never call Auth.
    if(result.status==="acknowledged") {
      try {
        if(await ports.finishCompletion(fence,{terms:current.terms,privacy:current.privacy,originVersion:SIGNUP_ORIGIN_CONSENT_VERSION})!==true)return pending();
        await ports.clearCheckpoint();return {status:"completed"};
      } catch {return pending();}
    }
    try {if(await ports.startCompletion(fence)!==true)return pending();}catch{return pending();}
    const uncertain=async()=>{try{await ports.markUncertain(fence);}catch{/* auth_in_flight remains fenced */}return pending();};
    let outcome:"updated"|"rejected"|"unknown";
    try {outcome=await ports.updatePassword(input.password);}catch{return uncertain();}
    if(outcome!=="updated")return uncertain();
    try {
      const after=await ports.readVerifiedIdentity();
      // Session rotation is unresolved: do not substitute a different session.
      if(!after || after.userId!==identity.userId || after.sessionId!==identity.sessionId || after.email.trim().toLowerCase()!==email)return uncertain();
      if(await ports.acknowledgePassword(fence)!==true)return pending();
      if(await ports.finishCompletion(fence,{terms:current.terms,privacy:current.privacy,originVersion:SIGNUP_ORIGIN_CONSENT_VERSION})!==true)return pending();
      await ports.clearCheckpoint();return {status:"completed"};
    }catch{return pending();}
  }catch{return {status:"unavailable"};}
}
