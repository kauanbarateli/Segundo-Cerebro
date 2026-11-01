import type { CompletionFence, CurrentVersions, ReservationInput } from "./signup-completion-service";

/** Draft wire mapping only; never supplies passwords or UTM content. */
type Actor = { p_user:string; p_session:string };
type Scoped = Actor & { p_intent:string; p_subject_hash:string; p_request:string; p_generation:string };
export type FenceArgs = {
  signup_fence_reserve: Omit<Scoped,"p_generation"> & {p_terms:string;p_privacy:string;p_accept_origin:boolean;p_origin_version:string|null};
  signup_fence_start: Scoped;
  signup_fence_uncertain: Scoped;
  signup_fence_ack: Scoped;
  signup_fence_finish: Scoped & {p_current_terms:string;p_current_privacy:string;p_current_origin:string};
  signup_fence_confirm: Actor & {p_intent:string};
  signup_fence_withdraw: Actor;
};
export type FenceTransport=<K extends keyof FenceArgs>(name:K, args:FenceArgs[K])=>Promise<unknown>;
const scope=(f:CompletionFence):Scoped=>({p_user:f.userId,p_session:f.sessionId,p_intent:f.intentId,p_subject_hash:f.subjectHash,p_request:f.requestId,p_generation:f.generation});
export function fencePorts(call:FenceTransport){
 return {
  reserveCompletion(input:ReservationInput){return call("signup_fence_reserve",{p_user:input.userId,p_session:input.sessionId,p_intent:input.intentId,p_subject_hash:input.subjectHash,p_request:input.requestId,p_terms:input.terms,p_privacy:input.privacy,p_accept_origin:input.acceptOrigin,p_origin_version:input.originVersion});},
  startCompletion(fence:CompletionFence){return call("signup_fence_start",scope(fence));},
  async markUncertain(fence:CompletionFence){if(await call("signup_fence_uncertain",scope(fence))!==true)throw Error("Signup unavailable.");},
  acknowledgePassword(fence:CompletionFence){return call("signup_fence_ack",scope(fence));},
  finishCompletion(fence:CompletionFence,v:CurrentVersions){return call("signup_fence_finish",{...scope(fence),p_current_terms:v.terms,p_current_privacy:v.privacy,p_current_origin:v.originVersion});},
  confirmFinished(userId:string,sessionId:string,intentId:string){return call("signup_fence_confirm",{p_user:userId,p_session:sessionId,p_intent:intentId});},
  withdrawCurrent(userId:string,sessionId:string){return call("signup_fence_withdraw",{p_user:userId,p_session:sessionId});}
 };
}
