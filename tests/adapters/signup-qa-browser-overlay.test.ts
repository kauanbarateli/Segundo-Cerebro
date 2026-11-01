import {afterEach,describe,expect,it,vi} from "vitest";
import type {SupabaseAuthConfig} from "../../src/lib/auth/config";
vi.mock("server-only",()=>({}));
import {signupEnabled,signupFenceDeployed,signupSameBrowserEnabled} from "../../src/lib/auth/signup-http";
const host="segundo-cerebro-git-qa-cadastro-kauanbarateli.vercel.app",app=`https://${host}`;
const config:SupabaseAuthConfig={mode:"supabase",appOrigin:app,supabaseUrl:"https://twrydxsdemaykgvdlpyd.supabase.co",publishableKey:"sb_publishable_test",secretKey:"sb_secret_test",rateLimitSecret:"r".repeat(32),stateSecret:"s".repeat(32),secureCookies:true};
const env:Record<string,string>={APP_DEPLOYMENT_TARGET:"homologation",APP_MODE:"supabase",APP_URL:app,SUPABASE_URL:config.supabaseUrl,NODE_ENV:"production",VERCEL:"1",VERCEL_ENV:"preview",VERCEL_TARGET_ENV:"preview",VERCEL_PROJECT_ID:"prj_68nPrMlzdTLhvhXF2zWvNK6BFaW2",VERCEL_GIT_PROVIDER:"github",VERCEL_GIT_REPO_OWNER:"kauanbarateli",VERCEL_GIT_REPO_SLUG:"Segundo-Cerebro",VERCEL_GIT_COMMIT_REF:"codex/qa-cadastro-browser-f19a550",VERCEL_BRANCH_URL:host,VERCEL_PROJECT_PRODUCTION_URL:"www.segundocerebroapp.com.br",SC_QA_SIGNUP_BROWSER_EXPERIMENT:"true",PUBLIC_SIGNUP_ENABLED:"true"};
const install=(overrides:Record<string,string|undefined>={})=>{for(const [name,value] of Object.entries({...env,...overrides}))vi.stubEnv(name,value);};
afterEach(()=>vi.unstubAllEnvs());
describe("overlay de ensaio de cadastro exclusivo de QA",()=>{
 it("permite exercício apenas no destino e com as duas flags explícitas",()=>{install();expect(signupFenceDeployed(config)).toBe(true);expect(signupEnabled(config)).toBe(true);expect(signupSameBrowserEnabled(config)).toBe(true);});
 it("recusa produção, projeto, branch, domínio ou contexto diferentes",()=>{
  for(const changes of [{VERCEL_ENV:"production"},{VERCEL_GIT_COMMIT_REF:"main"},{VERCEL_PROJECT_ID:"other"},{APP_DEPLOYMENT_TARGET:"production"},{SUPABASE_URL:"https://rishenjoikgmfubmnfiu.supabase.co"},{VERCEL_BRANCH_URL:"www.segundocerebroapp.com.br"},{APP_URL:"https://wrong.example.invalid"},{VERCEL:undefined},{NODE_ENV:"development"}]){
   install(changes);expect(signupFenceDeployed(config),JSON.stringify(changes)).toBe(false);expect(signupSameBrowserEnabled(config)).toBe(false);vi.unstubAllEnvs();
  }
  install();expect(signupFenceDeployed({...config,supabaseUrl:"https://rishenjoikgmfubmnfiu.supabase.co"})).toBe(false);
 });
 it("fecha o ensaio com qualquer flag desligada",()=>{
  install({SC_QA_SIGNUP_BROWSER_EXPERIMENT:undefined});expect(signupFenceDeployed(config)).toBe(false);vi.unstubAllEnvs();
  install({PUBLIC_SIGNUP_ENABLED:"false"});expect(signupEnabled(config)).toBe(false);expect(signupSameBrowserEnabled(config)).toBe(false);
 });
});
