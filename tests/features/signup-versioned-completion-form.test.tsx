import { afterEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beginPrivacyRender, flushPrivacyEffects, privacyHookMocks, type PrivacyHooks } from "../helpers/privacy-hooks";
const seam=vi.hoisted(()=>({hooks:null as unknown as PrivacyHooks}));
vi.mock("react",async original=>({...await original<typeof import("react")>(),useState:(...a:Parameters<ReturnType<typeof privacyHookMocks>["useState"]>)=>privacyHookMocks(seam.hooks).useState(...a),useEffect:(...a:Parameters<ReturnType<typeof privacyHookMocks>["useEffect"]>)=>privacyHookMocks(seam.hooks).useEffect(...a)}));
vi.mock("@/components/ui/button",()=>({Button:"action-button"}));
vi.mock("@/components/features/auth/signup-fields",()=>({SignupLegal:"signup-legal",SignupOriginConfirmation:"origin-confirmation",SignupPassword:"signup-password"}));
import { SignupVersionedCompletionForm } from "../../src/components/features/auth/signup-versioned-completion-form";
const userId="10000000-0000-4000-8000-000000000001",revision="60000000-0000-4000-8000-000000000001";
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{"content-type":"application/json"}});
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function find(node:ReactNode,predicate:(element:ReactElement<Record<string,unknown>>)=>boolean):ReactElement<Record<string,unknown>>|undefined{
 for(const child of Children.toArray(node)){if(!isValidElement<Record<string,unknown>>(child))continue;if(predicate(child))return child;const found=find(child.props.children as ReactNode,predicate);if(found)return found;}
}
function fixture(fetcher:typeof fetch){
 const hooks:PrivacyHooks={states:[],refs:[],memos:[],effects:[],pending:[],stateIndex:0,refIndex:0,memoIndex:0,effectIndex:0};vi.stubGlobal("fetch",fetcher);vi.stubGlobal("window",{setTimeout,clearTimeout});
 return {render(){seam.hooks=hooks;beginPrivacyRender(hooks);const tree=SignupVersionedCompletionForm({userId,passwordConfirmed:false,termsVersion:"t",privacyVersion:"p"});flushPrivacyEffects(hooks);return tree;},unmount(){for(const effect of hooks.effects)effect.cleanup?.();}};
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe("revisão exibida no cadastro",()=>{
 it("bloqueia formulário até leitura validada e envia apenas revisão opaca",async()=>{
  const calls:RequestInit[]=[];const app=fixture(async(_url,init)=>{calls.push(init!);return json({ok:true,result:{status:"active",revision}});});
  let tree=app.render();expect(find(tree,e=>e.type==="form")).toBeUndefined();expect(find(tree,e=>e.type==="noscript")).toBeDefined();await settle();tree=app.render();
  expect(find(tree,e=>e.type==="input"&&e.props.name==="originRevision")?.props.value).toBe(revision);expect(find(tree,e=>e.type==="origin-confirmation")).toBeDefined();expect(calls[0].headers).toEqual({"x-expected-user-id":userId});app.unmount();
 });
 it("estado ausente não oferece consentimento e resultado inválido não mostra formulário",async()=>{
  for(const result of [{status:"absent",revision:null},{status:"active",revision:"invalid"}]){const app=fixture(async()=>json({ok:true,result}));app.render();await settle();const tree=app.render();
   if(result.status==="absent"){expect(find(tree,e=>e.type==="input"&&e.props.name==="originRevision")?.props.value).toBe("absent");expect(find(tree,e=>e.type==="origin-confirmation")).toBeUndefined();}
   else expect(find(tree,e=>e.type==="form")).toBeUndefined();app.unmount();}
 });
});
