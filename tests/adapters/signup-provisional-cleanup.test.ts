import {beforeEach,expect,it,vi} from "vitest";
import type {AuthCookieJar} from "../../src/lib/auth/clients";
import type {SupabaseAuthConfig} from "../../src/lib/auth/config";
import {signupProvisionalCookie} from "../../src/lib/auth/signup-provisional";
vi.mock("server-only",()=>({}));
const fake=vi.hoisted(()=>({signOut:vi.fn(),client:vi.fn()}));
vi.mock("@/lib/auth/clients",()=>({createRequestClient:fake.client}));
import {discardAdmittedProvisionalSession} from "../../src/lib/auth/signup-provisional-cleanup";
const config={mode:"supabase",secureCookies:true} as SupabaseAuthConfig,scope="a".repeat(43),other="b".repeat(43);
beforeEach(()=>{vi.clearAllMocks();fake.client.mockReturnValue({auth:{signOut:fake.signOut}});});
it.each(["success","error","timeout"])("após admissão limpa apenas o namespace próprio em %s",async mode=>{
 if(mode==="success")fake.signOut.mockResolvedValue({error:null});else if(mode==="error")fake.signOut.mockResolvedValue({error:{message:"unavailable"}});else fake.signOut.mockRejectedValue(Error("timeout"));
 const set=vi.fn(),jar:AuthCookieJar={getAll:()=>[{name:"sc-auth.0",value:"main"},{name:signupProvisionalCookie(scope)+".0",value:"a"},{name:signupProvisionalCookie(other)+".0",value:"b"}],set};
 await discardAdmittedProvisionalSession(config,jar,new Headers(),scope);
 expect(fake.client).toHaveBeenCalledWith(config,jar,true,expect.any(Headers),signupProvisionalCookie(scope),3000);expect(fake.signOut).toHaveBeenCalledWith({scope:"local"});
 expect(set).toHaveBeenCalledWith(signupProvisionalCookie(scope)+".0","",expect.objectContaining({maxAge:0}));
 expect(set.mock.calls.some(call=>String(call[0]).startsWith("sc-auth")||String(call[0]).startsWith(signupProvisionalCookie(other)))).toBe(false);
});

it("falhas de enumeração ou escrita local não revertem o resultado da admissão",async()=>{
 fake.signOut.mockRejectedValue(Error("timeout"));
 const set=vi.fn(()=>{throw Error("cookies unavailable");}),jar:AuthCookieJar={getAll:()=>{throw Error("cookies unavailable");},set};
 await expect(discardAdmittedProvisionalSession(config,jar,new Headers(),scope)).resolves.toBeUndefined();
 expect(set).toHaveBeenCalledWith(signupProvisionalCookie(scope),"",expect.objectContaining({maxAge:0}));
});
