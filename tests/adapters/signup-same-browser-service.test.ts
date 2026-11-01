import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { confirmSameBrowserSignup, type SameBrowserSignupPorts } from "../../src/lib/auth/signup-same-browser-service";
import { newSignupBrowserSecret, signupBrowserSecretHash } from "../../src/lib/auth/signup-browser-secret";
import { startSameBrowserSignup, type SameBrowserStartPorts } from "../../src/lib/auth/signup-same-browser-start";

const userId="10000000-0000-4000-8000-000000000001",sessionId="20000000-0000-4000-8000-000000000001",intentId="30000000-0000-4000-8000-000000000001";
const secret="a".repeat(43), token="b".repeat(48), hash="c".repeat(64);
const current={terms:"terms-v1",privacy:"privacy-v1",originVersion:"utm-v1"};
const input={browserSecret:secret,token,terms:current.terms,privacy:current.privacy};
function setup() {
 const ports={canBegin:vi.fn(()=>true),browserHash:vi.fn(()=>hash),findAttempt:vi.fn(async()=>({intentId,originPending:true})),limitToken:vi.fn(async()=>({allowed:true})),verifyEmailProof:vi.fn(async()=>({userId,sessionId,email:"person@example.invalid"})),subjectHash:vi.fn(()=>hash),admit:vi.fn(async()=>true),clearProvisionalSession:vi.fn(async()=>{})};
 return ports satisfies SameBrowserSignupPorts;
}
describe("same-browser signup candidate",()=>{
 it("requires verified email proof and browser-bound attempt before admission",async()=>{
  const ports=setup(); expect(await confirmSameBrowserSignup(ports,input,current)).toEqual({status:"completed"});
  const find=ports.findAttempt.mock.invocationCallOrder[0],otp=ports.verifyEmailProof.mock.invocationCallOrder[0],admit=ports.admit.mock.invocationCallOrder[0];
  if(find===undefined || otp===undefined || admit===undefined) throw Error("Missing required step");
  expect(find).toBeLessThan(otp);expect(otp).toBeLessThan(admit);
  expect(ports.admit).toHaveBeenCalledWith({userId,sessionId,intentId,subjectHash:hash,browserHash:hash,terms:current.terms,privacy:current.privacy,acceptOrigin:true,originVersion:current.originVersion});
 });
 it("does not consume OTP on another browser or a non-bound attempt",async()=>{
  const ports=setup();expect(await confirmSameBrowserSignup(ports,{...input,browserSecret:undefined},current)).toEqual({status:"other-browser"});
  ports.findAttempt.mockResolvedValueOnce(null as never);
  expect(await confirmSameBrowserSignup(ports,input,current)).toEqual({status:"other-browser"});
  expect(ports.verifyEmailProof).not.toHaveBeenCalled();expect(ports.admit).not.toHaveBeenCalled();
 });
 it("rejects changed legal versions without consuming OTP",async()=>{
  const ports=setup();expect(await confirmSameBrowserSignup(ports,{...input,terms:"old"},current)).toEqual({status:"unavailable"});expect(ports.verifyEmailProof).not.toHaveBeenCalled();
 });
 it("preserves an existing browser session and does not consume OTP",async()=>{
  const ports=setup();ports.canBegin.mockReturnValue(false);
  expect(await confirmSameBrowserSignup(ports,input,current)).toEqual({status:"unavailable"});
  expect(ports.verifyEmailProof).not.toHaveBeenCalled();expect(ports.clearProvisionalSession).not.toHaveBeenCalled();
 });
 it("fails closed and clears a provisional session when provider or admission fails",async()=>{
  const ports=setup();ports.admit.mockResolvedValueOnce(false);
  expect(await confirmSameBrowserSignup(ports,input,current)).toEqual({status:"unavailable"});expect(ports.clearProvisionalSession).toHaveBeenCalledOnce();
  const invalid=setup();invalid.verifyEmailProof.mockResolvedValueOnce(null as never);
  expect(await confirmSameBrowserSignup(invalid,input,current)).toEqual({status:"unavailable"});expect(invalid.admit).not.toHaveBeenCalled();expect(invalid.clearProvisionalSession).toHaveBeenCalledOnce();
 });
 it("creates unrelated 256-bit secrets and domain-separated digests",()=>{
  const a=newSignupBrowserSecret(),b=newSignupBrowserSecret(),key="k".repeat(32);
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);expect(a).not.toBe(b);expect(signupBrowserSecretHash(a,key)).toMatch(/^[a-f0-9]{64}$/);
  expect(signupBrowserSecretHash(a,key)).not.toBe(signupBrowserSecretHash(b,key));expect(()=>signupBrowserSecretHash(a,"short")).toThrow();
 });
});

describe("same-browser signup start",()=>{
 function startPorts() {
  return {canBegin:vi.fn(()=>true),now:()=>1_000_000,randomPointer:()=>"p".repeat(43),bindingHash:()=>"d".repeat(64),browserHash:()=>hash,subjectHash:()=>"e".repeat(64),limit:vi.fn(async()=>({allowed:true})),prepare:vi.fn(async()=>{}),signup:vi.fn(async()=>{})} satisfies SameBrowserStartPorts;
 }
 const form={email:"person@example.invalid",password:"Example-Password-193!",acceptedLegal:true,termsVersion:current.terms,privacyVersion:current.privacy};
 it("requires a pre-provisioned browser cookie and prepares before a single Auth call",async()=>{
  const ports=startPorts();expect(await startSameBrowserSignup(ports,form,undefined,current)).toEqual({status:"unavailable"});
  expect(ports.signup).not.toHaveBeenCalled();expect(await startSameBrowserSignup(ports,form,secret,current)).toEqual({status:"accepted"});
  expect(ports.prepare).toHaveBeenCalledWith(expect.objectContaining({browserHash:hash,origin:null,originVersion:null}));
  const prepared=ports.prepare.mock.invocationCallOrder[0],signup=ports.signup.mock.invocationCallOrder[0];
  if(prepared===undefined || signup===undefined) throw Error("Missing required step");expect(prepared).toBeLessThan(signup);
 });
 it("does not infer creation from a failed or timed-out Auth call",async()=>{
  const ports=startPorts();ports.signup.mockRejectedValueOnce(Error("uncertain"));
  expect(await startSameBrowserSignup(ports,form,secret,current)).toEqual({status:"accepted"});expect(ports.signup).toHaveBeenCalledOnce();
 });
 it("does not start signup while another user is signed in",async()=>{
  const ports=startPorts();ports.canBegin.mockReturnValue(false);
  expect(await startSameBrowserSignup(ports,form,secret,current)).toEqual({status:"unavailable"});expect(ports.prepare).not.toHaveBeenCalled();expect(ports.signup).not.toHaveBeenCalled();
 });
 it("distinguishes a known pre-intent refusal from a potentially committed preparation",async()=>{
  const before=startPorts();before.limit.mockRejectedValueOnce(Error("unavailable"));
  expect(await startSameBrowserSignup(before,form,secret,current)).toEqual({status:"unavailable"});expect(before.prepare).not.toHaveBeenCalled();
  const after=startPorts();after.prepare.mockRejectedValueOnce(Error("timeout"));
  expect(await startSameBrowserSignup(after,form,secret,current)).toEqual({status:"uncertain"});expect(after.signup).not.toHaveBeenCalled();
 });
});
