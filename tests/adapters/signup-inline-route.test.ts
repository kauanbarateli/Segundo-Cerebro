import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fake=vi.hoisted(()=>({enabled:vi.fn(),request:vi.fn()}));
const config={mode:"supabase" as const,appOrigin:"https://app.example.invalid",stateSecret:"s".repeat(32)};
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/config",()=>({readAuthConfiguration:()=>config}));
vi.mock("@/lib/auth/signup-http",()=>({signupSameBrowserEnabled:fake.enabled}));
vi.mock("@/lib/auth/signup-same-browser-runtime",()=>({createSameBrowserStartPorts:()=>({})}));
vi.mock("@/lib/auth/signup-same-browser-start",()=>({startSameBrowserSignup:fake.request}));
import {POST} from "../../src/app/auth/iniciar-cadastro/route";
import {signupBrowserPostTag} from "../../src/lib/auth/signup-browser-secret";
const form={email:"pessoa@example.invalid",password:"senha-sintetica-123",acceptedLegal:"yes",termsVersion:"v1",privacyVersion:"v2",consentedOrigin:"yes",utm_source:"busca"};
const request=(accept?:string,body=new URLSearchParams(form).toString(),tag=signupBrowserPostTag("x".repeat(43),config.stateSecret))=>new NextRequest("https://app.example.invalid/auth/iniciar-cadastro",{method:"POST",headers:{origin:config.appOrigin,cookie:`sc-signup-browser=${"x".repeat(43)}`,"x-signup-attempt":tag,"content-type":"application/x-www-form-urlencoded",...(accept?{accept}:{})},body});
describe("cadastro interativo sem transporte de origem na resposta",()=>{
 beforeEach(()=>{vi.clearAllMocks();fake.enabled.mockReturnValue(true);fake.request.mockResolvedValue({status:"invalid"});});
 it("devolve status fechado sem refletir email, senha ou UTM",async()=>{
  const res=await POST(request("application/json"));expect(res.status).toBe(200);expect(await res.json()).toEqual({status:"invalid"});
  expect(res.headers.get("cache-control")).toContain("no-store");expect(res.headers.get("referrer-policy")).toBe("no-referrer");expect(res.headers.get("location")).toBeNull();
 });
 it("mantém 303 para submissão tradicional e não altera o bloqueio de parser",async()=>{
  const res=await POST(request());expect(res.status).toBe(303);expect(res.headers.get("location")).toBe("https://app.example.invalid/cadastro?status=invalid");
  const duplicate=await POST(request("application/json","email=a&email=b"));expect(await duplicate.json()).toEqual({status:"invalid"});expect(fake.request).toHaveBeenCalledTimes(1);
 });
 it("nunca confirma ambiguamente falha do serviço",async()=>{
  fake.request.mockResolvedValue({status:"unavailable"});expect(await (await POST(request("application/json"))).json()).toEqual({status:"unavailable"});
 });
 it("recusa preparo de outra aba antes de criar intenção ou chamar Auth",async()=>{
  const stale=signupBrowserPostTag("y".repeat(43),config.stateSecret);
  expect(await (await POST(request("application/json",undefined,stale))).json()).toEqual({status:"unavailable"});
  expect(fake.request).not.toHaveBeenCalled();
 });
});
