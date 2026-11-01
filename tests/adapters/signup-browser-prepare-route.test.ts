import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const fake=vi.hoisted(()=>({enabled:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/config",()=>({readAuthConfiguration:()=>({mode:"supabase",secureCookies:true})}));
vi.mock("@/lib/auth/signup-http",()=>({signupEnabled:fake.enabled}));
vi.mock("@/lib/auth/signup-same-browser-runtime",()=>({hasAuthCookie:(all:{name:string;value:string}[])=>all.some(v=>v.name.startsWith("sc-auth")&&v.value!==""),hasAuthCookieHeader:(header:string|null)=>/(?:^|;\s*)sc-auth(?:[.\-][^=;]*)?=[^;]+/.test(header??"")}));
import {GET} from "../../src/app/auth/preparar-cadastro/route";
const request=(cookie="",site="same-origin")=>new NextRequest("https://app.example.invalid/auth/preparar-cadastro",{headers:{"sec-fetch-site":site,...(cookie?{cookie}:{})}});
describe("provisão do vínculo no navegador",()=>{
 beforeEach(()=>{fake.enabled.mockReturnValue(true);});
 it("cria cookie seguro e preserva o segredo de uma tentativa existente",async()=>{
  const first=await GET(request());expect(first.status).toBe(200);
  const cookie=first.cookies.get("sc-signup-browser");expect(cookie).toMatchObject({httpOnly:true,secure:true,sameSite:"lax",maxAge:1800});expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const second=await GET(request(`sc-signup-browser=${cookie?.value}`));expect(second.status).toBe(200);expect(second.cookies.get("sc-signup-browser")).toBeUndefined();
 });
 it("recusa sessão existente, cookie inválido e requisição entre origens",async()=>{
  expect((await GET(request("sc-auth.0=session"))).status).toBe(409);
  expect((await GET(request("sc-auth.0=session; sc-auth.0="))).status).toBe(409);
  expect((await GET(request("sc-signup-browser=invalid"))).status).toBe(409);
  expect((await GET(request(`sc-signup-browser=${"a".repeat(43)}; sc-signup-browser=${"b".repeat(43)}`))).status).toBe(409);
  expect((await GET(request("","cross-site"))).status).toBe(403);
  fake.enabled.mockReturnValue(false);expect((await GET(request())).status).toBe(503);
 });
});
