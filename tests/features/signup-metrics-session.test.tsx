import { afterEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beginPrivacyRender, flushPrivacyEffects, privacyHookMocks, type PrivacyHooks } from "../helpers/privacy-hooks";
const seam=vi.hoisted(()=>({hooks:null as unknown as PrivacyHooks}));
vi.mock("react",async original=>({...await original<typeof import("react")>(),
 useState:(...args:Parameters<ReturnType<typeof privacyHookMocks>["useState"]>)=>privacyHookMocks(seam.hooks).useState(...args),
 useRef:(...args:Parameters<ReturnType<typeof privacyHookMocks>["useRef"]>)=>privacyHookMocks(seam.hooks).useRef(...args),
 useCallback:(...args:Parameters<ReturnType<typeof privacyHookMocks>["useCallback"]>)=>privacyHookMocks(seam.hooks).useCallback(...args),
 useEffect:(...args:Parameters<ReturnType<typeof privacyHookMocks>["useEffect"]>)=>privacyHookMocks(seam.hooks).useEffect(...args),
}));
vi.mock("@/components/ui/field",()=>({Field:"metrics-field"}));
vi.mock("@/components/ui/button",()=>({Button:"metrics-button"}));
import { SignupMetricsWorkspace } from "../../src/components/features/metricas/signup-metrics-workspace";
const owner="10000000-0000-4000-8000-000000000001",secret="ORIGEM_PRIVADA_SINTETICA";
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json"}});
const valid=(path:string)=>{const params=new URL(path,"https://example.invalid").searchParams,q=Object.fromEntries(params),rows=[{kind:"value",value:secret,count:5},{kind:"other",value:null,count:2}];return {ok:true,result:{...q,totalPublic:7,stock:{total:7,legacy:0,admin:0,public:7,unclassified:0},series:[{period:q.start,count:7}],distributions:Object.fromEntries(["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].map(key=>[key,rows]))}};};
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function find(node:ReactNode,predicate:(element:ReactElement<Record<string,unknown>>)=>boolean):ReactElement<Record<string,unknown>>|undefined{for(const child of Children.toArray(node)){if(!isValidElement<Record<string,unknown>>(child))continue;if(predicate(child))return child;const found=find(child.props.children as ReactNode,predicate);if(found)return found;}}
const text=(tree:ReactNode)=>JSON.stringify(tree,(_key,value)=>typeof value==="function"?undefined:value);
function fixture(fetcher:typeof fetch){
 const h:PrivacyHooks={states:[],refs:[],memos:[],effects:[],pending:[],stateIndex:0,refIndex:0,memoIndex:0,effectIndex:0};vi.stubGlobal("fetch",fetcher);vi.stubGlobal("window",new EventTarget());const doc=new EventTarget() as EventTarget & {visibilityState:string};doc.visibilityState="visible";vi.stubGlobal("document",doc);
 return{render(){seam.hooks=h;beginPrivacyRender(h);const tree=SignupMetricsWorkspace({userId:owner});flushPrivacyEffects(h);return tree;},unmount(){for(const effect of h.effects)effect.cleanup?.();}};
}
const click=(tree:ReactNode,label:string)=>(find(tree,node=>node.type==="metrics-button"&&node.props.children===label)!.props.onClick as ()=>void)();
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe("métricas: sessão Master",()=>{
 it("oculta dados na volta, recusa B, ignora resposta atrasada de A e retoma filtro aprovado",async()=>{
  let finish!:(response:Response)=>void;const slow=new Promise<Response>(resolve=>{finish=resolve;});let mode:"A"|"slow"|"B"="A";const requests:{path:string;owner:unknown}[]=[];
  const app=fixture(async (path,init)=>{const url=String(path);requests.push({path:url,owner:(init?.headers as Record<string,string>)["x-expected-user-id"]});if(mode==="slow")return slow;if(mode==="B")return new Response(null,{status:403});return json(200,valid(url));});
  app.render();await settle();let tree=app.render();expect(text(tree)).toContain(secret);
  (find(tree,n=>n.props.label==="De")!.props.onChange as (event:unknown)=>void)({target:{value:"2026-01-01"}});tree=app.render();(find(tree,n=>n.props.label==="Até")!.props.onChange as (event:unknown)=>void)({target:{value:"2026-01-31"}});tree=app.render();
  (find(tree,n=>n.type==="form")!.props.onSubmit as (event:unknown)=>void)({preventDefault(){}});await settle();app.render();const requested=requests.at(-1)!.path;
  mode="slow";window.dispatchEvent(new Event("focus"));tree=app.render();expect(text(tree)).not.toContain(secret);
  mode="B";window.dispatchEvent(new Event("focus"));await settle();tree=app.render();expect(text(tree)).toContain("Confirme sua conta");finish(json(200,valid(requested)));await settle();tree=app.render();expect(text(tree)).not.toContain(secret);
  click(tree,"Verificar sessão");await settle();tree=app.render();expect(text(tree)).toContain("Confirme sua conta");mode="A";click(tree,"Verificar sessão");await settle();tree=app.render();expect(text(tree)).toContain(secret);expect(requests.at(-1)!.path).toBe(requested);expect(requests.every(row=>row.owner===owner)).toBe(true);app.unmount();
 });
 it.each([401,403,409])("fecha a superfície ao receber %s sem corpo",async status=>{
  let calls=0;const app=fixture(async path=>++calls===1?json(200,valid(String(path))):new Response(null,{status}));app.render();await settle();let tree=app.render();expect(text(tree)).toContain(secret);window.dispatchEvent(new Event("focus"));await settle();tree=app.render();expect(text(tree)).toContain("Confirme sua conta");expect(text(tree)).not.toContain(secret);app.unmount();
 });
 it("não reabre com envelope ok falso e permite nova verificação",async()=>{
  let calls=0;const app=fixture(async path=>{calls++;return calls===2?json(200,{...valid(String(path)),ok:false}):json(200,valid(String(path)));});app.render();await settle();app.render();window.dispatchEvent(new Event("focus"));await settle();const tree=app.render();expect(text(tree)).toContain("Confirme sua conta");expect(text(tree)).not.toContain(secret);click(tree,"Verificar sessão");await settle();expect(text(app.render())).toContain(secret);app.unmount();
 });
 it("mantém fechamento após timeout e permite nova tentativa",async()=>{
  const controllers:AbortController[]=[];vi.spyOn(AbortSignal,"timeout").mockImplementation(()=>{const c=new AbortController();controllers.push(c);return c.signal;});let calls=0;
  const app=fixture(async (path,init)=>{calls++;if(calls!==2)return json(200,valid(String(path)));return new Promise<Response>((_resolve,reject)=>init!.signal!.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError")),{once:true}));});
  app.render();await settle();app.render();window.dispatchEvent(new Event("focus"));const tree=app.render();expect(text(tree)).not.toContain(secret);controllers.at(-1)!.abort();await settle();const retryTree=app.render();expect(text(retryTree)).toContain("Não foi possível verificar agora");click(retryTree,"Verificar sessão");await settle();expect(text(app.render())).toContain(secret);app.unmount();
 });
 it("valida e aplica filtro editado no retry e mantém o mesmo período após foco",async()=>{
  const requests:string[]=[];let calls=0;const app=fixture(async path=>{const url=String(path);requests.push(url);return ++calls===1?json(503,{ok:false}):json(200,valid(url));});
  app.render();await settle();let tree=app.render();
  (find(tree,n=>n.props.label==="De")!.props.onChange as (event:unknown)=>void)({target:{value:"2026-01-01"}});tree=app.render();(find(tree,n=>n.props.label==="Até")!.props.onChange as (event:unknown)=>void)({target:{value:"2026-01-31"}});tree=app.render();
  click(tree,"Tentar novamente");await settle();tree=app.render();expect(text(tree)).toContain(secret);const requested=requests.at(-1)!;expect(requested).toContain("2026-01-01");
  window.dispatchEvent(new Event("focus"));await settle();tree=app.render();expect(requests.at(-1)).toBe(requested);expect(find(tree,n=>n.props.label==="De")!.props.value).toBe("2026-01-01");app.unmount();
 });
});
