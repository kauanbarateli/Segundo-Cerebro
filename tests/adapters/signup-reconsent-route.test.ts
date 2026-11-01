import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {signSignupReconsent,signupReconsentFormTag} from "../../src/lib/auth/signup-reconsent-checkpoint";
const fake=vi.hoisted(()=>({enabled:vi.fn(),rpc:vi.fn(),write:vi.fn(),getAll:vi.fn(),set:vi.fn()}));
const userId="10000000-0000-4000-8000-000000000001",sessionId="20000000-0000-4000-8000-000000000001",intentId="30000000-0000-4000-8000-000000000001";
const config={mode:"supabase",appOrigin:"https://app.example.invalid",stateSecret:"s".repeat(32)};
vi.mock("server-only",()=>({}));
vi.mock("next/headers",()=>({cookies:async()=>({getAll:fake.getAll,set:fake.set})}));
vi.mock("@/lib/auth/config",()=>({readAuthConfiguration:()=>config}));
vi.mock("@/lib/auth/signup-http",()=>({signupSameBrowserEnabled:fake.enabled,signupRpc:fake.rpc}));
vi.mock("@/lib/auth/signup-completion-runtime",()=>({createSignupCompletionPorts:()=>({now:Date.now,readVerifiedIdentity:async()=>({userId,sessionId,email:"p@example.invalid"}),subjectHash:()=>"a".repeat(64),limit:async()=>({allowed:true})})}));
vi.mock("@/lib/auth/signup-confirmation-runtime",()=>({createSignupConfirmationPorts:()=>({putCheckpoint:fake.write})}));
import {LEGAL_DOCUMENTS} from "../../src/lib/legal/documents";
import {POST} from "../../src/app/auth/revisar-cadastro/route";
let reviewTag="",proofExpiry=0;
const body=()=>new URLSearchParams({acceptedLegal:"yes",termsVersion:LEGAL_DOCUMENTS.termos.version,privacyVersion:LEGAL_DOCUMENTS.privacidade.version,reviewTag}).toString();
const request=(origin=config.appOrigin,b=body())=>new NextRequest("https://app.example.invalid/auth/revisar-cadastro",{method:"POST",headers:{origin,"content-type":"application/x-www-form-urlencoded"},body:b});
describe("canal de revisão de cadastro",()=>{
 beforeEach(()=>{vi.clearAllMocks();fake.enabled.mockReturnValue(true);fake.rpc.mockResolvedValue({status:"renewed",originPending:false});fake.write.mockResolvedValue(undefined);const now=Date.now(),checkpoint={userId,sessionId,intentId,issuedAt:now,expiresAt:now+600000,passwordConfirmed:false,originPending:true};proofExpiry=checkpoint.expiresAt;const token=signSignupReconsent({checkpoint,terms:LEGAL_DOCUMENTS.termos.version,privacy:LEGAL_DOCUMENTS.privacidade.version},config.stateSecret,now);reviewTag=signupReconsentFormTag(token,config.stateSecret);fake.getAll.mockReturnValue([{name:"sc-flow-signup-reconsent",value:token}]);});
 it("exige consentimento e confirma o descarte opcional ao banco",async()=>{
  const res=await POST(request());expect(res.headers.get("location")).toBe("https://app.example.invalid/cadastro/definir-senha");
  expect(fake.rpc).toHaveBeenCalledWith(config,"signup_browser_renew",expect.objectContaining({p_user:userId,p_session:sessionId,p_intent:intentId,p_keep_origin:false,p_proof_expires_at:new Date(proofExpiry).toISOString()}));expect(fake.write).toHaveBeenCalledWith(expect.objectContaining({originPending:false}));
 });
 it("recusa origem externa e mantém a guarda fechada",async()=>{
  expect((await POST(request("https://other.invalid"))).status).toBe(403);expect(fake.rpc).not.toHaveBeenCalled();fake.enabled.mockReturnValue(false);expect((await POST(request())).status).toBe(503);
 });
 it("resultado ambíguo não prossegue nem repete comando",async()=>{
  fake.rpc.mockRejectedValueOnce(Error("timeout"));const res=await POST(request());expect(res.headers.get("location")).toContain("status=unknown");expect(fake.rpc).toHaveBeenCalledOnce();expect(fake.write).not.toHaveBeenCalled();
 });
 it("não aceita prazo fornecido pelo formulário",async()=>{
  const res=await POST(request(config.appOrigin,`${body()}&p_proof_expires_at=2099-01-01T00%3A00%3A00.000Z`));
  expect(res.headers.get("location")).toContain("status=invalid");expect(fake.rpc).not.toHaveBeenCalled();
 });
 it("recusa formulário de outra aba antes de modificar a intenção",async()=>{
  reviewTag="a".repeat(64);const res=await POST(request());expect(res.headers.get("location")).toContain("status=invalid");expect(fake.rpc).not.toHaveBeenCalled();
 });
});
