import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {createHmac} from "node:crypto";
import {createServerClient} from "@supabase/ssr";
import {createRequestClient} from "../../src/lib/auth/clients";
import type {SupabaseAuthConfig} from "../../src/lib/auth/config";
vi.mock("../../src/lib/environment/application-destination",()=>({authDeploymentAllowed:()=>true}));
import {signupProvisionalCookie,signSignupContext,verifySignupContext,SIGNUP_CONTEXT_SECONDS} from "../../src/lib/auth/signup-provisional";

/** SDK storage and transport are local simulations; no hosted Auth is contacted. */
it("não apaga a sessão principal nem outra tentativa quando a resposta antiga chega depois",async()=>{
 const cookies=new Map<string,string>(),pendingWrites:{name:string;value:string;maxAge?:number}[]=[];let deferA=false;
 let release:()=>void=()=>{throw Error("logout not started")},started:()=>void=()=>{};const waiting=new Promise<void>(resolve=>{started=resolve;});
 const ids={main:"10000000-0000-4000-8000-000000000001",a:"10000000-0000-4000-8000-000000000002",b:"10000000-0000-4000-8000-000000000003"};
 const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const fetcher=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);
  if(url.includes("/verify")){const body=JSON.parse(String(init?.body)) as {token_hash:keyof typeof ids};const id=ids[body.token_hash];if(!id)return new Response(null,{status:400});const now=Math.floor(Date.now()/1000),jwt=`${enc({alg:"HS256"})}.${enc({sub:id,session_id:id,exp:now+3600})}.sig`;return Response.json({access_token:jwt,refresh_token:`refresh-${id}`,expires_in:3600,expires_at:now+3600,token_type:"bearer",user:{id,aud:"authenticated",role:"authenticated",email:"x@example.invalid",app_metadata:{},user_metadata:{},created_at:"2020-01-01T00:00:00Z"}});}
  if(url.includes("/logout")){if(deferA){started();await new Promise<void>(resolve=>{release=resolve;});}return new Response(null,{status:204});}
  throw Error("unexpected request");
 };
 const make=(name:string)=>createServerClient("https://supabase.invalid","public-example-key",{cookieOptions:{name,httpOnly:true,path:"/",sameSite:"lax"},global:{fetch:fetcher},auth:{flowType:"pkce",autoRefreshToken:false,detectSessionInUrl:false},cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll(values){for(const {name,value,options} of values){const change={name,value,maxAge:options.maxAge};if(deferA)pendingWrites.push(change);else if(options.maxAge===0)cookies.delete(name);else cookies.set(name,value);}}}});
 const main=make("sc-auth"),scopeA="a".repeat(43),scopeB="b".repeat(43),a=make(signupProvisionalCookie(scopeA));
 expect((await main.auth.verifyOtp({type:"signup",token_hash:"main"})).error).toBeNull();
 expect((await a.auth.verifyOtp({type:"signup",token_hash:"a"})).error).toBeNull();
 const initialMain=[...cookies].filter(([key])=>key==="sc-auth"||key.startsWith("sc-auth."));expect(initialMain.length).toBeGreaterThan(0);
 deferA=true;const cleanup=a.auth.signOut({scope:"local"});await waiting;
 // The other tab writes while A's provider request is still in flight.
 deferA=false;const b=make(signupProvisionalCookie(scopeB));expect((await b.auth.verifyOtp({type:"signup",token_hash:"b"})).error).toBeNull();
 const beforeB=[...cookies].filter(([key])=>key.startsWith(signupProvisionalCookie(scopeB)));expect(beforeB.length).toBeGreaterThan(0);
 deferA=true;release();expect((await cleanup).error).toBeNull();
 expect(pendingWrites.length).toBeGreaterThan(0);for(const change of pendingWrites){expect(change.name.startsWith(signupProvisionalCookie(scopeA))).toBe(true);if(change.maxAge===0)cookies.delete(change.name);else cookies.set(change.name,change.value);}
 expect([...cookies].filter(([key])=>key==="sc-auth"||key.startsWith("sc-auth."))).toEqual(initialMain);
 expect([...cookies].filter(([key])=>key.startsWith(signupProvisionalCookie(scopeB)))).toEqual(beforeB);
});
describe("contexto provisório",()=>{
 it("rejeita replay expirado, relógio anterior e prazo adulterado mesmo com assinatura",()=>{
  const key="s".repeat(32),now=2_000_000,v={scope:"a".repeat(43),userId:"10000000-0000-4000-8000-000000000001",sessionId:"20000000-0000-4000-8000-000000000001"},token=signSignupContext(v,key,now);
  expect(verifySignupContext(token,key,now+600_001)).toMatchObject(v);
  expect(verifySignupContext(token,key,now-1)).toBeNull();
  expect(verifySignupContext(token,key,now+SIGNUP_CONTEXT_SECONDS*1000)).toBeNull();
  expect(verifySignupContext(token,key,now+SIGNUP_CONTEXT_SECONDS*1000+1)).toBeNull();
  const body=Buffer.from(JSON.stringify({...v,issuedAt:now,expiresAt:now+(SIGNUP_CONTEXT_SECONDS+1)*1000})).toString("base64url"),mac=createHmac("sha256",key).update(`signup-provisional-context:v1.${body}`).digest("base64url");
  expect(verifySignupContext(`${body}.${mac}`,key,now)).toBeNull();
 });
 it("não depende do checkpoint de OTP e rejeita adulteração",()=>{const key="s".repeat(32),v={scope:"a".repeat(43),userId:"10000000-0000-4000-8000-000000000001",sessionId:"20000000-0000-4000-8000-000000000001"},token=signSignupContext(v,key);expect(verifySignupContext(token,key)).toMatchObject(v);expect(verifySignupContext(token+"x",key)).toBeNull();});
});

it("limita o Max-Age emitido pelo SDK e preserva exclusão com zero",async()=>{
 const scope="z".repeat(43),name=signupProvisionalCookie(scope),values=new Map<string,string>(),ages:number[]=[];
 const config={mode:"supabase",supabaseUrl:"https://supabase.invalid",publishableKey:"public-example-key",secureCookies:true} as SupabaseAuthConfig;
 const jar={getAll:()=>[...values].map(([name,value])=>({name,value})),set:(name:string,value:string,options:{maxAge?:number})=>{if(name.startsWith("sc-signup-provisional-"))ages.push(options.maxAge??-1);if(options.maxAge===0)values.delete(name);else values.set(name,value);}};
 const now=Math.floor(Date.now()/1000),enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url"),id="10000000-0000-4000-8000-000000000001",jwt=`${enc({alg:"HS256"})}.${enc({sub:id,session_id:id,exp:now+3600})}.sig`;
 vi.stubGlobal("fetch",async(input:RequestInfo|URL)=>{if(String(input).includes("/verify"))return Response.json({access_token:jwt,refresh_token:"refresh-token",expires_in:3600,expires_at:now+3600,token_type:"bearer",user:{id,aud:"authenticated",role:"authenticated",email:"x@example.invalid",app_metadata:{},user_metadata:{},created_at:"2020-01-01T00:00:00Z"}});if(String(input).includes("/logout"))return new Response(null,{status:204});throw Error("unexpected request");});
 try{const client=createRequestClient(config,jar,true,new Headers(),name);expect((await client.auth.verifyOtp({type:"signup",token_hash:"sample"})).error).toBeNull();expect(ages).toContain(SIGNUP_CONTEXT_SECONDS);expect(ages.every(age=>age<=SIGNUP_CONTEXT_SECONDS)).toBe(true);expect((await client.auth.signOut({scope:"local"})).error).toBeNull();expect(ages).toContain(0);}finally{vi.unstubAllGlobals();}
});
it("o SDK pode remover cookie local mesmo quando a saída retorna 5xx",async()=>{
 const scope="k".repeat(43),name=signupProvisionalCookie(scope),values=new Map<string,string>([["sc-auth.0","main-session"]]);
 const config={mode:"supabase",supabaseUrl:"https://supabase.invalid",publishableKey:"public-example-key",secureCookies:true} as SupabaseAuthConfig;
 const jar={getAll:()=>[...values].map(([name,value])=>({name,value})),set:(name:string,value:string,options:{maxAge?:number})=>{if(options.maxAge===0)values.delete(name);else values.set(name,value);}};
 const now=Math.floor(Date.now()/1000),enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url"),id="10000000-0000-4000-8000-000000000001",jwt=`${enc({alg:"HS256"})}.${enc({sub:id,session_id:id,exp:now+3600})}.sig`;
 vi.stubGlobal("fetch",async(input:RequestInfo|URL)=>{if(String(input).includes("/verify"))return Response.json({access_token:jwt,refresh_token:"refresh-token",expires_in:3600,expires_at:now+3600,token_type:"bearer",user:{id,aud:"authenticated",role:"authenticated",email:"x@example.invalid",app_metadata:{},user_metadata:{},created_at:"2020-01-01T00:00:00Z"}});if(String(input).includes("/logout"))return Response.json({message:"unavailable"},{status:500});throw Error("unexpected request");});
 try{const client=createRequestClient(config,jar,true,new Headers(),name);expect((await client.auth.verifyOtp({type:"signup",token_hash:"sample"})).error).toBeNull();expect([...values.keys()].some(key=>key.startsWith(name))).toBe(true);const result=await client.auth.signOut({scope:"local"});expect(result.error).not.toBeNull();expect([...values.keys()].some(key=>key.startsWith(name))).toBe(false);expect(values.get("sc-auth.0")).toBe("main-session");}finally{vi.unstubAllGlobals();}
});
