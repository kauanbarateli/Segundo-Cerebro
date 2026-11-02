import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fake=vi.hoisted(()=>({enabled:vi.fn(),request:vi.fn()}));
const config={mode:"supabase" as const,appOrigin:"https://app.example.invalid"};
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/config",()=>({readAuthConfiguration:()=>config}));
vi.mock("@/lib/auth/signup-http",()=>({signupEnabled:fake.enabled}));
vi.mock("@/lib/auth/signup-runtime",()=>({createSignupRequestPorts:()=>({})}));
vi.mock("@/lib/auth/signup-service",()=>({requestPublicSignup:fake.request}));
import {POST} from "../../src/app/auth/iniciar-cadastro/route";
const form={email:"pessoa@example.invalid",password:"senha-sintetica-123",acceptedLegal:"yes",termsVersion:"v1",privacyVersion:"v2",consentedOrigin:"yes",utm_source:"busca"};
const request=(accept?:string,body=new URLSearchParams(form).toString())=>new NextRequest("https://app.example.invalid/auth/iniciar-cadastro",{method:"POST",headers:{origin:config.appOrigin,"content-type":"application/x-www-form-urlencoded",...(accept?{accept}:{})},body});
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
});
