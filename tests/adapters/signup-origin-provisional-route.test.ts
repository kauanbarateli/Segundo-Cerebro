import {beforeEach,expect,it,vi} from "vitest";
import {SIGNUP_CONTEXT_COOKIE,signSignupContext,signupProvisionalCookie} from "../../src/lib/auth/signup-provisional";
vi.mock("server-only",()=>({}));
const fake=vi.hoisted(()=>({getAll:vi.fn(),set:vi.fn(),client:vi.fn(),rpc:vi.fn(),enabled:vi.fn()}));
const userId="10000000-0000-4000-8000-000000000001",sessionId="20000000-0000-4000-8000-000000000001",scope="q".repeat(43),config={mode:"supabase",appOrigin:"https://app.example.invalid",stateSecret:"s".repeat(32),secureCookies:true};
vi.mock("next/headers",()=>({cookies:async()=>({getAll:fake.getAll,set:fake.set})}));
vi.mock("@/lib/auth/config",()=>({readAuthConfiguration:()=>config}));
vi.mock("@/lib/auth/clients",()=>({createRequestClient:fake.client}));
vi.mock("@/lib/auth/signup-http",()=>({signupFenceDeployed:fake.enabled,signupFenceRpc:fake.rpc}));
import {POST} from "../../src/app/api/signup-origin-pending/route";
beforeEach(()=>{vi.clearAllMocks();fake.enabled.mockReturnValue(true);fake.rpc.mockResolvedValue({status:"withdrawn"});fake.client.mockReturnValue({auth:{getUser:async()=>({data:{user:{id:userId,email_confirmed_at:"2026-01-01",is_anonymous:false}},error:null}),getClaims:async()=>({data:{claims:{sub:userId,session_id:sessionId}},error:null})}});fake.getAll.mockReturnValue([{name:"sc-auth.0",value:"main"},{name:SIGNUP_CONTEXT_COOKIE,value:signSignupContext({scope,userId,sessionId},config.stateSecret)}]);});
it("retira origem pelo ator provisório sem tocar a sessão principal",async()=>{
 const req=new Request("https://app.example.invalid/api/signup-origin-pending",{method:"POST",headers:{origin:config.appOrigin,"content-type":"application/json","x-expected-user-id":userId},body:"{}"});
 const res=await POST(req);expect(res.status).toBe(200);expect(fake.client).toHaveBeenCalledWith(config,expect.anything(),true,expect.anything(),signupProvisionalCookie(scope));
 expect(fake.rpc).toHaveBeenCalledWith(config,"signup_fence_withdraw",{p_user:userId,p_session:sessionId});expect(fake.set).not.toHaveBeenCalled();
});
