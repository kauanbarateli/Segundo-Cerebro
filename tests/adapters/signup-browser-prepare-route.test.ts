import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const fake=vi.hoisted(()=>({enabled:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/config",()=>({readAuthConfiguration:()=>({mode:"supabase",secureCookies:true,appOrigin:"https://app.example.invalid",stateSecret:"s".repeat(32)})}));
vi.mock("@/lib/auth/signup-http",()=>({signupSameBrowserEnabled:fake.enabled}));
vi.mock("@/lib/auth/signup-same-browser-runtime",()=>({hasAuthCookie:(all:{name:string;value:string}[])=>all.some(v=>v.name.startsWith("sc-auth")&&v.value!==""),hasAuthCookieHeader:(header:string|null)=>/(?:^|;\s*)sc-auth(?:[.\-][^=;]*)?=[^;]+/.test(header??"")}));
import {POST} from "../../src/app/auth/preparar-cadastro/route";
const request=(cookie="",site="same-origin",origin="https://app.example.invalid")=>new NextRequest("https://app.example.invalid/auth/preparar-cadastro",{method:"POST",headers:{origin,"sec-fetch-site":site,...(cookie?{cookie}:{})}});
describe("provisão do vínculo no navegador",()=>{
 beforeEach(()=>{fake.enabled.mockReturnValue(true);});
 it("cria e rotaciona o cookie com segurança a cada nova tentativa",async()=>{
  const first=await POST(request());expect(first.status).toBe(200);
  const cookie=first.cookies.get("sc-signup-browser");expect(cookie).toMatchObject({httpOnly:true,secure:true,sameSite:"lax",maxAge:1800});expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect((await first.json()).attempt).toMatch(/^[a-f0-9]{64}$/);
  const second=await POST(request(`sc-signup-browser=${cookie?.value}`));expect(second.status).toBe(200);expect(second.cookies.get("sc-signup-browser")?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);expect(second.cookies.get("sc-signup-browser")?.value).not.toBe(cookie?.value);
 });
 it("recusa sessão existente, cookie inválido e requisição entre origens",async()=>{
  expect((await POST(request("sc-auth.0=session"))).status).toBe(409);
  expect((await POST(request("sc-auth.0=session; sc-auth.0="))).status).toBe(409);
  expect((await POST(request("sc-signup-browser=invalid"))).status).toBe(409);
  expect((await POST(request(`sc-signup-browser=${"a".repeat(43)}; sc-signup-browser=${"b".repeat(43)}`))).status).toBe(409);
  expect((await POST(request("","cross-site"))).status).toBe(403);
  expect((await POST(request("","same-origin","https://other.invalid"))).status).toBe(403);
  fake.enabled.mockReturnValue(false);expect((await POST(request())).status).toBe(503);
 });
});
