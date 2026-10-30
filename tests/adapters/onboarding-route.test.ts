import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const state=vi.hoisted(()=>({identity:null as unknown,load:vi.fn(),start:vi.fn(),rpc:vi.fn()}));
vi.mock("../../src/lib/auth/config",()=>({readAuthConfiguration:()=>({mode:"supabase",appOrigin:"https://app.example.invalid"})}));
vi.mock("../../src/lib/auth/runtime",()=>({requestAuthServices:async()=>({gateway:{readIdentity:async()=>state.identity}})}));
vi.mock("../../src/adapters/db/onboarding-runtime",()=>({onboardingForRequest:()=>({load:state.load,start:state.start})}));
vi.mock("../../src/adapters/db/onboarding-gateway",()=>({onboardingRpcForRequest:()=>state.rpc}));
import { GET,POST } from "../../src/app/api/onboarding/route";
import { GET as attributesGET,PATCH } from "../../src/app/api/onboarding/attributes/route";
const owner="2b000000-0000-4000-8000-000000000001",other="2b000000-0000-4000-8000-000000000002";
function request(path="/api/onboarding",method="GET",body?:string,origin="https://app.example.invalid",expected=owner){return new Request("https://app.example.invalid"+path,{method,headers:{"X-Expected-User-ID":expected,Origin:origin,"Content-Type":"application/json"},...(body===undefined?{}:{body})});}
beforeEach(()=>{vi.clearAllMocks();state.identity={userId:owner,sessionId:other,mustChangePassword:false,role:"user",entitlements:{}};});
describe("onboarding HTTP gates precede the privileged adapter",()=>{
 it("refuses unauthenticated reads without invoking the store",async()=>{state.identity=null;const response=await GET(request());expect(response.status).toBe(401);expect(state.load).not.toHaveBeenCalled();expect(response.headers.get("cache-control")).toContain("no-store");});
 it("rejects a stale owner after switching accounts",async()=>{const response=await GET(request("/api/onboarding","GET",undefined,undefined,other));expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:"SESSION_CHANGED"});expect(state.load).not.toHaveBeenCalled();});
 it("does not start or save with an external Origin",async()=>{const response=await POST(request("/api/onboarding","POST",JSON.stringify({command:"onboarding.start",input:{clientId:other}}),"https://outside.invalid"));expect(response.status).toBe(403);expect(state.start).not.toHaveBeenCalled();});
 it("rejects a caller-supplied module command list",async()=>{const response=await POST(request("/api/onboarding","POST",JSON.stringify({command:"onboarding.confirm",input:{roundId:other,clientId:other,expectedRevision:"0",plan:[{command:"task.delete"}]}})));expect(response.status).toBe(400);expect(state.start).not.toHaveBeenCalled();});
 it("requires password change before returning any draft",async()=>{state.identity={userId:owner,sessionId:other,mustChangePassword:true,role:"user",entitlements:{}};expect((await GET(request())).status).toBe(403);expect(state.load).not.toHaveBeenCalled();});
 it("bounds the streamed body before issuing a domain command",async()=>{const response=await POST(request("/api/onboarding","POST",JSON.stringify({padding:"x".repeat(100_000)})));expect(response.status).toBeGreaterThanOrEqual(400);expect(state.start).not.toHaveBeenCalled();});
});
describe("attributes have independent target/permission and closed response checks",()=>{
 it("requires the current project entitlement before reading its context",async()=>{state.identity={userId:owner,sessionId:other,mustChangePassword:false,role:"user",entitlements:{projetos:false}};expect((await attributesGET(request("/api/onboarding/attributes?kind=project&id="+other))).status).toBe(403);expect(state.rpc).not.toHaveBeenCalled();});
 it("denies unknown query parameters before reading attributes",async()=>{expect((await attributesGET(request("/api/onboarding/attributes?kind=profile&ownerId="+other))).status).toBe(400);expect(state.rpc).not.toHaveBeenCalled();});
 it("denies changing a role through the profile endpoint",async()=>{expect((await PATCH(request("/api/onboarding/attributes","PATCH",JSON.stringify({kind:"profile",clientId:"save",expectedRevision:"r",patch:{role:"master"}})))).status).toBe(400);expect(state.rpc).not.toHaveBeenCalled();});
 it("cannot reserve a coordinator identity through ordinary attributes",async()=>{expect((await PATCH(request("/api/onboarding/attributes","PATCH",JSON.stringify({kind:"profile",clientId:"onb:reserved",expectedRevision:"r",patch:{focus:"work"}})))).status).toBe(400);expect(state.rpc).not.toHaveBeenCalled();});
 it("does not emit another project's attributes as a successful response",async()=>{state.rpc.mockResolvedValueOnce({projectId:owner,context:"work",revision:"r"});const response=await attributesGET(request("/api/onboarding/attributes?kind=project&id="+other));expect(response.status).toBeGreaterThanOrEqual(400);expect((await response.json()).ok).toBe(false);});
});
