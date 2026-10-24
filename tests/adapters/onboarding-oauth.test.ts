import { describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { classifyOnboardingFlow, fenceOnboardingCalendarConnect, onboardingContinuationRequest, prepareOnboardingContinuation, signOnboardingContinuation, takeOnboardingContinuation, verifyOnboardingContinuation } from "../../src/adapters/db/onboarding-oauth";
import type { CalendarRepository } from "../../src/core/calendario";
import type { OnboardingRpc } from "../../src/adapters/db/onboarding-protocol";
const id=(n:number)=>`29000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const now=Date.parse("2026-10-23T12:00:00.000Z"),secret="onboarding-public-test-signing-key-distinct";
const value={version:1 as const,flowId:id(1),ownerId:id(2),sessionId:id(3),roundId:id(4),generation:id(5),expiresAt:now+600_000};
const binding={flowId:value.flowId,ownerId:value.ownerId,sessionId:value.sessionId};
describe("onboarding continuation, separate purpose and server-side one-time reservation",()=>{
 it("accepts a closed purpose instead of a return URL",()=>{expect(onboardingContinuationRequest({kind:"onboarding",round_id:id(4)})).toEqual({roundId:id(4)});expect(onboardingContinuationRequest(undefined)).toBeNull();});
 it.each([{kind:"onboarding",round_id:id(4),return_to:"https://outside.invalid"},{kind:"calendar",round_id:id(4)},{kind:"onboarding",round_id:"title"},null])("rejects expanded or invalid continuation input %#",input=>expect(()=>onboardingContinuationRequest(input)).toThrow());
 it("binds the round, owner, session and actual verified Google flow",()=>{const cookie=signOnboardingContinuation(value,secret,now);expect(verifyOnboardingContinuation(cookie,secret,binding,now)).toEqual(value);expect(cookie).not.toContain(secret);});
 it.each(["flowId","ownerId","sessionId"] as const)("refuses a different %s",field=>expect(verifyOnboardingContinuation(signOnboardingContinuation(value,secret,now),secret,{...binding,[field]:id(9)},now)).toBeNull());
 it("rejects expiry, an extended lifetime, tampering and a different signing key",()=>{
  const cookie=signOnboardingContinuation(value,secret,now);expect(verifyOnboardingContinuation(cookie,secret,binding,value.expiresAt)).toBeNull();
  expect(()=>signOnboardingContinuation({...value,expiresAt:now+600_001},secret,now)).toThrow();
  expect(verifyOnboardingContinuation(cookie+"x",secret,binding,now)).toBeNull();expect(verifyOnboardingContinuation(cookie,secret+"other",binding,now)).toBeNull();
 });
 it("only signs the generation and expiry returned by a real bound reservation",async()=>{
  const rpc:OnboardingRpc=vi.fn(async()=>({roundId:value.roundId,generation:value.generation,expiresAt:new Date(value.expiresAt).toISOString()}));
  const cookie=await prepareOnboardingContinuation(rpc,{roundId:value.roundId,...binding},secret,now);expect(verifyOnboardingContinuation(cookie,secret,binding,now)).toEqual(value);
 });
 it.each([null,{roundId:id(8),generation:value.generation,expiresAt:new Date(value.expiresAt).toISOString()},{roundId:value.roundId,generation:id(8),expiresAt:new Date(value.expiresAt).toISOString()}])("does not resume on missing/consumed/changed database reservation %#",async result=>{const rpc:OnboardingRpc=async()=>result;expect(await takeOnboardingContinuation(rpc,value)).toBe(false);});
 it.each([null,{}, {kind:"direct",returnUrl:"https://outside.invalid"},{kind:"unknown"}])("fails closed on ambiguous direct-versus-onboarding classification %#",async result=>{await expect(classifyOnboardingFlow(async()=>result,id(1))).rejects.toThrow();});
 it("database classification is independent of a missing cookie",async()=>{
  expect(verifyOnboardingContinuation(undefined,secret,binding,now)).toBeNull();expect(await classifyOnboardingFlow(async()=>({kind:"onboarding"}),id(1))).toBe("onboarding");
 });
 it("retains all cookie claims in the one-time database take",async()=>{
  const rpc:OnboardingRpc=vi.fn(async()=>null);await takeOnboardingContinuation(rpc,value);
  expect(rpc).toHaveBeenCalledWith("oauth_take",{flowId:value.flowId,roundId:value.roundId,generation:value.generation,expiresAt:new Date(value.expiresAt).toISOString()},true);
 });
 it("uses the atomic final fence after provider waits and never calls an unguarded connect",async()=>{
  const original=vi.fn(),rpc:OnboardingRpc=vi.fn(async()=>{throw new Error("generation changed during provider wait");});
  const repo={connect:original} as unknown as CalendarRepository,input={flow_id:value.flowId,account_id:id(6)} as Parameters<CalendarRepository["connect"]>[0];
  await expect(fenceOnboardingCalendarConnect(repo,rpc,value).connect(input)).rejects.toThrow();expect(original).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith("oauth_connect",{flowId:value.flowId,roundId:value.roundId,generation:value.generation,calendarConnect:input},true);
 });
 it("cannot route another Google flow through a valid continuation",async()=>{
  const rpc:OnboardingRpc=vi.fn(async()=>({})),repo={connect:vi.fn()} as unknown as CalendarRepository;
  await expect(fenceOnboardingCalendarConnect(repo,rpc,value).connect({flow_id:id(9)} as Parameters<CalendarRepository["connect"]>[0])).rejects.toThrow();expect(rpc).not.toHaveBeenCalled();
 });
});
