import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { OnboardingPortError } from "../../core/onboarding/types";
import { onboardingRecord, type OnboardingRpc } from "./onboarding-protocol";
import type { CalendarRepository } from "../../core/calendario";

export const ONBOARDING_GOOGLE_COOKIE = "sc-onboarding-calendar";
const purpose = "second-brain:onboarding-calendar:v1";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
interface Continuation { version: 1; flowId: string; ownerId: string; sessionId: string; roundId: string; generation: string; expiresAt: number }
export function onboardingContinuationRequest(value: unknown): { roundId: string } | null {
  if (value === undefined) return null;
  if (!onboardingRecord(value) || Object.keys(value).length !== 2 || value.kind !== "onboarding" || !uuid(value.round_id)) throw new OnboardingPortError("CONFLICT");
  return { roundId: value.round_id };
}
function valid(value: unknown, now: number): value is Continuation {
  return onboardingRecord(value) && Object.keys(value).length === 7 && value.version === 1 &&
    [value.flowId, value.ownerId, value.sessionId, value.roundId, value.generation].every(uuid) &&
    Number.isSafeInteger(value.expiresAt) && Number(value.expiresAt) > now && Number(value.expiresAt) <= now + 600_000;
}
function mac(secret: string, body: string) { return createHmac("sha256", secret).update(purpose + ":" + body).digest(); }
export function signOnboardingContinuation(value: Continuation, secret: string, now: number): string {
  if (Buffer.byteLength(secret) < 32 || !valid(value, now)) throw new OnboardingPortError("UNAVAILABLE");
  const body = Buffer.from(JSON.stringify(value)).toString("base64url"); return body + "." + mac(secret, body).toString("base64url");
}
export function verifyOnboardingContinuation(cookie: string | undefined, secret: string, binding: { flowId: string; ownerId: string; sessionId: string }, now: number): Continuation | null {
  if (!cookie || cookie.length > 2048 || Buffer.byteLength(secret) < 32) return null;
  const [body, signature, extra] = cookie.split(".");
  if (!body || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
  const expected = mac(secret, body), actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return valid(value, now) && value.flowId === binding.flowId && value.ownerId === binding.ownerId && value.sessionId === binding.sessionId ? value : null;
  } catch { return null; }
}
export async function prepareOnboardingContinuation(rpc: OnboardingRpc, input: { roundId: string; flowId: string; ownerId: string; sessionId: string }, secret: string, now: number) {
  const value = await rpc("oauth_bind", { roundId: input.roundId, flowId: input.flowId }, true);
  if (!onboardingRecord(value) || value.roundId !== input.roundId || !uuid(value.generation) || typeof value.expiresAt !== "string") throw new OnboardingPortError("UNAVAILABLE");
  return signOnboardingContinuation({ version: 1, ...input, generation: value.generation, expiresAt: Date.parse(value.expiresAt) }, secret, now);
}
export async function takeOnboardingContinuation(rpc: OnboardingRpc, continuation: Continuation): Promise<boolean> {
  const result = await rpc("oauth_take", { flowId: continuation.flowId,roundId:continuation.roundId,generation:continuation.generation,expiresAt:new Date(continuation.expiresAt).toISOString() }, true);
  return onboardingRecord(result) && result.roundId === continuation.roundId && result.generation === continuation.generation &&
    typeof result.expiresAt === "string" && Date.parse(result.expiresAt) === continuation.expiresAt;
}
/** This database classification is mandatory even when the continuation cookie
 * is missing/invalid. A bound flow must never fall back to the direct calendar. */
export async function classifyOnboardingFlow(rpc:OnboardingRpc,flowId:string):Promise<"direct"|"onboarding"> {
  const result=await rpc("oauth_classify",{flowId},false);
  if(!onboardingRecord(result)||Object.keys(result).length!==1||!["direct","onboarding"].includes(String(result.kind)))throw new OnboardingPortError("UNAVAILABLE");
  return result.kind as "direct"|"onboarding";
}
/** Provider waits occur outside the database; the final connect must recheck the
 * generation/deadline inside the same transaction as the existing Calendar SQL. */
export function fenceOnboardingCalendarConnect(repo:CalendarRepository,rpc:OnboardingRpc,continuation:Continuation):CalendarRepository {
  return {...repo,connect:async input=>{
    if(input.flow_id!==continuation.flowId)throw new OnboardingPortError("FORBIDDEN");
    const result=await rpc("oauth_connect",{flowId:continuation.flowId,roundId:continuation.roundId,generation:continuation.generation,calendarConnect:input},true);
    if(!onboardingRecord(result)||Object.keys(result).length!==0)throw new OnboardingPortError("COMMIT_UNKNOWN");
  }};
}
