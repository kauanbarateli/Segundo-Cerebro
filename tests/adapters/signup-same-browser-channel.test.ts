import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {createSignupEmailLink} from "../../src/lib/auth/signup-email-link";
import {signupBrowserSecretHash} from "../../src/lib/auth/signup-browser-secret";
const fake=vi.hoisted(()=>({rpc:vi.fn(),getAll:vi.fn(),set:vi.fn(),verify:vi.fn(),clear:vi.fn(),purpose:vi.fn(),continueVerified:vi.fn()}));
const config={mode:"supabase" as const,appOrigin:"https://app.example.invalid",stateSecret:"s".repeat(32),rateLimitSecret:"r".repeat(32),secureCookies:true};
const userId="10000000-0000-4000-8000-000000000001",sessionId="20000000-0000-4000-8000-000000000001",intentId="30000000-0000-4000-8000-000000000001",secret="a".repeat(43),token="b".repeat(64);
vi.mock("server-only",()=>({}));
vi.mock("next/headers",()=>({cookies:async()=>({getAll:fake.getAll,set:fake.set})}));
vi.mock("@/lib/auth/config",()=>({readAuthConfiguration:()=>config}));
vi.mock("@/lib/auth/signup-http",()=>({signupEnabled:()=>true,signupRpc:fake.rpc,signupUnavailable:()=>{throw Error("unavailable");}}));
vi.mock("@/lib/auth/signup-runtime",()=>({createSignupRequestPorts:()=>({})}));
vi.mock("@/lib/auth/signup-confirmation-runtime",()=>({createSignupConfirmationPorts:(_config:unknown,_jar:unknown,_headers:unknown,purpose:string)=>{fake.purpose(purpose);return {canBegin:()=>true,limitToken:async()=>({allowed:true}),verifyEmailProof:fake.verify,subjectHash:()=>"c".repeat(64),clearProvisionalSession:fake.clear};}}));
vi.mock("@/lib/auth/signup-confirmation-service",()=>({verifySignupConfirmation:async()=>({status:"ready"}),continueVerifiedSignup:fake.continueVerified}));
import {submitSignupEmailLink} from "../../src/lib/auth/signup-confirmation-channel";
const post=(purpose:string,nonce:string,cookie=`sc-signup-browser=${secret}`)=>new NextRequest(`https://app.example.invalid/auth/${purpose==="signup"?"confirmar-cadastro":"continuar-cadastro"}`,{method:"POST",headers:{origin:config.appOrigin,"content-type":"application/x-www-form-urlencoded",...(cookie?{cookie}:{})},body:`nonce=${nonce}`});
describe("canal de confirmação ligado à tentativa",()=>{
 beforeEach(()=>{vi.clearAllMocks();fake.verify.mockResolvedValue({userId,sessionId,email:"person@example.invalid"});fake.clear.mockResolvedValue(undefined);fake.continueVerified.mockResolvedValue({status:"ready"});fake.rpc.mockImplementation(async(_config,name)=>name==="signup_browser_find"?{intentId,userId,originPending:true}:name==="signup_browser_admit"?true:null);});
 it.each(["signup","continuation"] as const)("confirma %s com OTP e hash do navegador",async purpose=>{
  const proof=createSignupEmailLink(purpose,token,config.stateSecret,Date.now());
  fake.getAll.mockReturnValue([{name:purpose==="signup"?"sc-signup-otp":"sc-signup-continuation-otp",value:proof.cookie},{name:"sc-signup-browser",value:secret}]);
  const response=await submitSignupEmailLink(post(purpose,proof.nonce),purpose);
  expect(response.headers.get("location")).toBe("https://app.example.invalid/onboarding");expect(fake.purpose).toHaveBeenCalledWith(purpose);expect(fake.verify).toHaveBeenCalledWith(token);
  expect(response.cookies.get("sc-signup-browser")).toBeUndefined();
  expect(fake.rpc).toHaveBeenCalledWith(config,"signup_browser_admit",expect.objectContaining({p_user:userId,p_session:sessionId,p_intent:intentId,p_browser:signupBrowserSecretHash(secret,config.stateSecret)}));
 });
 it("resposta tardia de A não apaga o cookie de uma tentativa B mais recente",async()=>{
  const proof=createSignupEmailLink("signup",token,config.stateSecret,Date.now());fake.getAll.mockReturnValue([{name:"sc-signup-otp",value:proof.cookie}]);
  let finish:(value:boolean)=>void=()=>{throw Error("not started")};let markStarted:()=>void=()=>{};
  const started=new Promise<void>(resolve=>{markStarted=resolve;});
  fake.rpc.mockImplementation(async(_config,name)=>{if(name==="signup_browser_find")return {intentId,userId,originPending:true};if(name==="signup_browser_admit"){markStarted();return new Promise<boolean>(resolve=>{finish=resolve;});}return null;});
  const a=submitSignupEmailLink(post("signup",proof.nonce),"signup");await started;
  let browserCookie="z".repeat(43);finish(true);const response=await a;
  expect(response.headers.get("location")).toBe("https://app.example.invalid/onboarding");
  const mutation=response.cookies.get("sc-signup-browser");
  if(mutation) browserCookie=mutation.value;
  expect(mutation).toBeUndefined();expect(browserCookie).toBe("z".repeat(43));
 });
 it("outro navegador usa canal que exige definição posterior de senha",async()=>{
  const proof=createSignupEmailLink("signup",token,config.stateSecret,Date.now());fake.getAll.mockReturnValue([{name:"sc-signup-otp",value:proof.cookie}]);
  const response=await submitSignupEmailLink(post("signup",proof.nonce,""),"signup");
  expect(response.headers.get("location")).toContain("/cadastro/definir-senha");expect(fake.verify).not.toHaveBeenCalled();expect(fake.rpc).not.toHaveBeenCalled();
 });
 it("vínculo expirado também usa o fluxo de senha escolhida após OTP",async()=>{
  const proof=createSignupEmailLink("signup",token,config.stateSecret,Date.now());fake.getAll.mockReturnValue([{name:"sc-signup-otp",value:proof.cookie}]);fake.rpc.mockResolvedValueOnce(null);
  const response=await submitSignupEmailLink(post("signup",proof.nonce),"signup");
  expect(response.headers.get("location")).toContain("/cadastro/definir-senha");expect(fake.verify).not.toHaveBeenCalled();
 });
 it("retorno ambíguo de admissão não libera o acesso",async()=>{
  const proof=createSignupEmailLink("continuation",token,config.stateSecret,Date.now());fake.getAll.mockReturnValue([{name:"sc-signup-continuation-otp",value:proof.cookie},{name:"sc-signup-browser",value:secret}]);
  fake.rpc.mockImplementation(async(_config,name)=>{if(name==="signup_browser_admit") throw Error("timeout");return {intentId,userId,originPending:true};});
  const response=await submitSignupEmailLink(post("continuation",proof.nonce),"continuation");
  expect(response.headers.get("location")).toContain("status=repeat");expect(response.cookies.get("sc-signup-browser")).toBeUndefined();expect(fake.clear).toHaveBeenCalledOnce();
 });
 it("após rotação, link anterior recupera pelo OTP já validado e exige nova senha",async()=>{
  const proof=createSignupEmailLink("signup",token,config.stateSecret,Date.now());fake.getAll.mockReturnValue([{name:"sc-signup-otp",value:proof.cookie}]);
  const priorUser="10000000-0000-4000-8000-000000000002";fake.verify.mockResolvedValueOnce({userId:priorUser,sessionId,email:"older@example.invalid"});
  const response=await submitSignupEmailLink(post("signup",proof.nonce),"signup");
  expect(response.headers.get("location")).toContain("/cadastro/definir-senha");expect(fake.verify).toHaveBeenCalledOnce();expect(fake.continueVerified).toHaveBeenCalledOnce();expect(fake.rpc.mock.calls.some(call=>call[1]==="signup_browser_admit")).toBe(false);
 });
 it("recusa cookies duplicados sem verificar OTP",async()=>{
  const proof=createSignupEmailLink("signup",token,config.stateSecret,Date.now());fake.getAll.mockReturnValue([{name:"sc-signup-otp",value:proof.cookie}]);
  const response=await submitSignupEmailLink(post("signup",proof.nonce,`sc-signup-browser=${secret}; sc-signup-browser=${"c".repeat(43)}`),"signup");
  expect(response.headers.get("location")).toContain("status=repeat");expect(fake.verify).not.toHaveBeenCalled();expect(fake.rpc).not.toHaveBeenCalled();
 });
});
