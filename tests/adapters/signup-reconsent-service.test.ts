import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {renewSignupConsent,type SignupReconsentPorts} from "../../src/lib/auth/signup-reconsent-service";
import {signSignupReconsent,verifySignupReconsent} from "../../src/lib/auth/signup-reconsent-checkpoint";
import {signSignupCheckpoint} from "../../src/lib/auth/signup-checkpoint";
const userId="10000000-0000-4000-8000-000000000001",sessionId="20000000-0000-4000-8000-000000000001",intentId="30000000-0000-4000-8000-000000000001";
const checkpoint={userId,sessionId,intentId,issuedAt:1000,expiresAt:601000,passwordConfirmed:false,originPending:true};
const legal={terms:"v1",privacy:"v2",originVersion:"origin-v1"};
const input={acceptedLegal:true,termsVersion:"v1",privacyVersion:"v2",acceptedOrigin:false};
function setup(){return {enabled:()=>true,now:()=>2000,readCheckpoint:()=>({checkpoint,terms:legal.terms,privacy:legal.privacy}),readVerifiedIdentity:vi.fn(async()=>({userId,sessionId,email:"person@example.invalid"})),subjectHash:()=>"a".repeat(64),limit:vi.fn(async()=>({allowed:true})),renew:vi.fn(async()=>({status:"renewed",originPending:false})),writeCheckpoint:vi.fn(async()=>{})} satisfies SignupReconsentPorts;}
describe("revisão explícita após novo OTP",()=>{
 it("descarta origem não escolhida e preserva prazo da prova",async()=>{
  const p=setup();expect(await renewSignupConsent(p,input,legal)).toEqual({status:"renewed"});
  expect(p.renew).toHaveBeenCalledWith(expect.objectContaining({userId,sessionId,intentId,keepOrigin:false,proofExpiresAt:new Date(checkpoint.expiresAt).toISOString()}));
  expect(p.writeCheckpoint).toHaveBeenCalledWith({...checkpoint,originPending:false});
 });
 it("permite manter apenas origem já consentida e explicitamente confirmada",async()=>{
  const p=setup();p.renew.mockResolvedValueOnce({status:"renewed",originPending:true});
  expect(await renewSignupConsent(p,{...input,acceptedOrigin:true},legal)).toEqual({status:"renewed"});expect(p.renew).toHaveBeenCalledWith(expect.objectContaining({keepOrigin:true}));
 });
 it("recusa termos desatualizados, identidade trocada e OTP vencido antes de escrever",async()=>{
  const p=setup();expect(await renewSignupConsent(p,{...input,termsVersion:"old"},legal)).toEqual({status:"invalid"});expect(p.renew).not.toHaveBeenCalled();
  p.readVerifiedIdentity.mockResolvedValueOnce({userId,sessionId:"20000000-0000-4000-8000-000000000002",email:"person@example.invalid"});
  expect(await renewSignupConsent(p,input,legal)).toEqual({status:"needs-verification"});expect(p.renew).not.toHaveBeenCalled();
  const expired={...p,now:()=>checkpoint.expiresAt};expect(await renewSignupConsent(expired,input,legal)).toEqual({status:"needs-verification"});expect(p.renew).not.toHaveBeenCalled();
 });
 it("não inicia a renovação quando o OTP vence durante a verificação assíncrona",async()=>{
  const p=setup(),clock=vi.fn().mockReturnValueOnce(2000).mockReturnValueOnce(checkpoint.expiresAt);
  expect(await renewSignupConsent({...p,now:clock},input,legal)).toEqual({status:"needs-verification"});
  expect(p.limit).toHaveBeenCalledOnce();expect(p.renew).not.toHaveBeenCalled();expect(p.writeCheckpoint).not.toHaveBeenCalled();
 });
 it("recusa relógio inválido ou retrocedido antes da renovação",async()=>{
  for(const later of [Number.NaN,1999]){
   const p=setup(),clock=vi.fn().mockReturnValueOnce(2000).mockReturnValueOnce(later);
   expect(await renewSignupConsent({...p,now:clock},input,legal)).toEqual({status:"needs-verification"});
   expect(p.renew).not.toHaveBeenCalled();
  }
 });
 it("não informa sucesso com resultado ou checkpoint incerto",async()=>{
  const p=setup();p.renew.mockRejectedValueOnce(Error("timeout"));expect(await renewSignupConsent(p,input,legal)).toEqual({status:"unknown"});expect(p.writeCheckpoint).not.toHaveBeenCalled();
  p.writeCheckpoint.mockRejectedValueOnce(Error("cookie failure"));expect(await renewSignupConsent(p,input,legal)).toEqual({status:"unknown"});
 });
 it("prova de revisão é distinta do checkpoint comum, autenticada e expira",()=>{
  const key="s".repeat(32),token=signSignupReconsent({checkpoint,terms:"v1",privacy:"v2"},key,2000);
  expect(verifySignupReconsent(token,key,2000)).toEqual({checkpoint,terms:"v1",privacy:"v2"});
  expect(verifySignupReconsent(signSignupCheckpoint(checkpoint,key,2000),key,2000)).toBeNull();
  expect(verifySignupReconsent(`${token}x`,key,2000)).toBeNull();expect(verifySignupReconsent(token,key,checkpoint.expiresAt)).toBeNull();
  expect(()=>signSignupReconsent({checkpoint:{...checkpoint,passwordConfirmed:true},terms:"v1",privacy:"v2"},key,2000)).toThrow();
 });
});
