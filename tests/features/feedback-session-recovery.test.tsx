import { afterEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beginPrivacyRender, flushPrivacyEffects, privacyHookMocks, type PrivacyHooks } from "../helpers/privacy-hooks";

const seam = vi.hoisted(() => ({ hooks: null as unknown as PrivacyHooks }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useState"]>) => privacyHookMocks(seam.hooks).useState(...args),
  useRef: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useRef"]>) => privacyHookMocks(seam.hooks).useRef(...args),
  useCallback: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useCallback"]>) => privacyHookMocks(seam.hooks).useCallback(...args),
  useEffect: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useEffect"]>) => privacyHookMocks(seam.hooks).useEffect(...args),
}));
vi.mock("../../src/components/ui/field", () => ({ Field: "feedback-field" }));
import { FeedbackWorkspace } from "../../src/components/features/feedback/feedback-workspace";

const owner="10000000-0000-4000-8000-000000000001", id="20000000-0000-4000-8000-000000000001";
const item={id,category:"suggestion",text:"PRIVATE_A_HISTORY",status:"received",createdAt:"2026-10-31T12:00:00Z"};
const page={ok:true,result:{items:[item],next:{before:item.createdAt,id}}};
const ack=(body:{category:string;text:string})=>({ok:true,result:{...item,category:body.category,text:body.text.normalize("NFC").trim()}});
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json"}});
const settle=async()=>{for(let i=0;i<18;i++)await Promise.resolve();};
function find(node:ReactNode,predicate:(element:ReactElement<Record<string,unknown>>)=>boolean):ReactElement<Record<string,unknown>>|undefined {
 for(const child of Children.toArray(node)){if(!isValidElement<Record<string,unknown>>(child))continue;if(predicate(child))return child;const value=find(child.props.children as ReactNode,predicate);if(value)return value;}
}
function fixture(fetcher:typeof fetch){
 const h:PrivacyHooks={states:[],refs:[],memos:[],effects:[],pending:[],stateIndex:0,refIndex:0,memoIndex:0,effectIndex:0};
 vi.stubGlobal("fetch",fetcher);
 vi.stubGlobal("window",new EventTarget());
 const documentStub=new EventTarget() as EventTarget & {visibilityState:string};documentStub.visibilityState="visible";vi.stubGlobal("document",documentStub);
 return {
  render(){seam.hooks=h;beginPrivacyRender(h);const tree=FeedbackWorkspace({userId:owner,supportEmail:"suporte@example.invalid"});flushPrivacyEffects(h);return tree;},
  unmount(){for(const effect of h.effects)effect.cleanup?.();},
 };
}
const text=(node:ReactNode)=>JSON.stringify(node,(_key,value)=>typeof value==="function"?undefined:value);
const submit=(tree:ReactNode)=>(find(tree,node=>node.type==="form")!.props.onSubmit as (event:unknown)=>Promise<void>)({preventDefault(){}});
const change=(tree:ReactNode,value:string)=>(find(tree,node=>node.props.id==="feedback-text")!.props.onChange as (event:unknown)=>void)({target:{value}});
const click=(tree:ReactNode,label:string)=>(find(tree,node=>node.type==="button"&&node.props.children===label)!.props.onClick as ()=>void)();
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe("feedback: sessão e intenção incerta",()=>{
 it("mantém o mesmo envio após timeout e sessão revogada, sem exibir texto até confirmar a mesma conta",async()=>{
  const sent:{category:string;text:string;clientId:string}[]=[];let post=0,reads=0;
  const app=fixture(async (_url,options)=>{
   if(options?.method==="POST") {sent.push(JSON.parse(String(options.body)));post++;if(post===1)throw Error("lost after commit");if(post===2)return new Response(null,{status:401});return json(200,ack(sent.at(-1)!));}
   reads++;return reads===2?json(409,{code:"SESSION_CHANGED"}):json(200,page);
  });
  app.render();await settle();let tree=app.render();change(tree,"Mensagem privada de exemplo");tree=app.render();
  await submit(tree);tree=app.render();expect(text(tree)).toContain("Verificar envio");
  await submit(tree);tree=app.render();expect(text(tree)).toContain("Confirme sua conta");expect(text(tree)).not.toContain("PRIVATE_A_HISTORY");expect(text(tree)).not.toContain("Mensagem privada de exemplo");
  click(tree,"Verificar sessão");await settle();tree=app.render();expect(text(tree)).toContain("Confirme sua conta");expect(text(tree)).not.toContain("Mensagem privada de exemplo");expect(sent).toHaveLength(2);
  click(tree,"Verificar sessão");await settle();tree=app.render();expect(text(tree)).toContain("Verificar envio");
  await submit(tree);expect(sent).toHaveLength(3);expect(sent[1]).toEqual(sent[0]);expect(sent[2]).toEqual(sent[0]);expect(text(app.render())).toContain("Mensagem recebida");app.unmount();
 });
 it("oculta histórico em troca de conta e impede retorno tardio de uma página antiga",async()=>{
  let finish!:(response:Response)=>void;const slow=new Promise<Response>(resolve=>{finish=resolve;});let reads=0;
  const app=fixture(async (_url,options)=>{if(options?.method==="POST")return json(409,{code:"SESSION_CHANGED"});reads++;return reads===1?json(200,page):slow;});
  app.render();await settle();let tree=app.render();expect(text(tree)).toContain("PRIVATE_A_HISTORY");
  click(tree,"Carregar mais");tree=app.render();change(tree,"Outro texto privado");tree=app.render();await submit(tree);tree=app.render();expect(text(tree)).toContain("Confirme sua conta");
  finish(json(200,page));await settle();tree=app.render();expect(text(tree)).not.toContain("PRIVATE_A_HISTORY");expect(text(tree)).not.toContain("Outro texto privado");app.unmount();
 });
 it("remove histórico anterior quando a leitura retorna 403 sem corpo",async()=>{
  let reads=0;const app=fixture(async()=>++reads===1?json(200,page):new Response(null,{status:403}));
  app.render();await settle();let tree=app.render();expect(text(tree)).toContain("PRIVATE_A_HISTORY");
  click(tree,"Carregar mais");await settle();tree=app.render();expect(text(tree)).toContain("Confirme sua conta");expect(text(tree)).not.toContain("PRIVATE_A_HISTORY");app.unmount();
 });
 it("não inicia duas requisições com ativações síncronas",async()=>{
  let finish!:(response:Response)=>void;const slow=new Promise<Response>(resolve=>{finish=resolve;});let writes=0;
  const app=fixture(async (_url,options)=>{if(options?.method==="POST"){writes++;return slow;}return json(200,page);});
  app.render();await settle();let tree=app.render();change(tree,"Mensagem para testar duplo clique");tree=app.render();
  const first=submit(tree),second=submit(tree);await settle();expect(writes).toBe(1);finish(json(200,ack({category:"suggestion",text:"Mensagem para testar duplo clique"})));await Promise.all([first,second]);app.unmount();
 });
 it("não descarta intenção incerta diante de CONFLICT e não muda seu conteúdo nem UUID",async()=>{
  const sent:unknown[]=[];let writes=0;
  const app=fixture(async (_url,options)=>{if(options?.method!=="POST")return json(200,page);sent.push(JSON.parse(String(options.body)));writes++;if(writes===1)throw Error("unknown");return json(409,{code:"CONFLICT"});});
  app.render();await settle();let tree=app.render();change(tree,"Conflito de envio incerto");tree=app.render();await submit(tree);tree=app.render();await submit(tree);tree=app.render();
  expect(text(tree)).toContain("Não foi possível conciliar");expect(find(tree,node=>node.props.id==="feedback-text")!.props.disabled).toBe(true);expect(sent[1]).toEqual(sent[0]);app.unmount();
 });
 it("mantém intenção em cada 200 inválido e confirma somente conteúdo normalizado correspondente",async()=>{
  type Body={category:string;text:string;clientId:string};const sent:Body[]=[];
  const replies:((body:Body)=>Response)[]=[
   ()=>new Response(null,{status:200}),()=>json(200,{ok:false,result:item}),
   body=>json(200,{ok:true,result:{...ack(body).result,text:"outra mensagem"}}),
   body=>json(200,{ok:true,result:{...ack(body).result,category:"other"}}),
   body=>json(200,{ok:true,result:{...ack(body).result,id:"invalid"}}),
   body=>json(200,{ok:true,result:{...ack(body).result,createdAt:"invalid"}}),
   body=>json(200,{ok:true,result:{...ack(body).result,status:"other"}}),
   ()=>new Response("{malformed",{status:200}),body=>json(200,ack(body)),
  ];
  const app=fixture(async (_url,options)=>{if(options?.method!=="POST")return json(200,page);const body=JSON.parse(String(options.body)) as Body;sent.push(body);return replies[sent.length-1]!(body);});
  app.render();await settle();let tree=app.render();change(tree,"  Sugesta\u0303o de teste com acento  ");tree=app.render();
  for(let i=0;i<replies.length;i++){await submit(tree);tree=app.render();if(i<replies.length-1){expect(text(tree)).toContain("Verificar envio");expect(text(tree)).not.toContain("Mensagem recebida");}}
  expect(text(tree)).toContain("Mensagem recebida");for(const body of sent)expect(body).toEqual(sent[0]);app.unmount();
 });
 it("oculta ao recuperar foco e não revela histórico quando a conta em outra aba mudou",async()=>{
  let reads=0;const app=fixture(async()=>++reads===1?json(200,page):json(409,{code:"SESSION_CHANGED"}));
  app.render();await settle();let tree=app.render();expect(text(tree)).toContain("PRIVATE_A_HISTORY");
  window.dispatchEvent(new Event("focus"));tree=app.render();expect(text(tree)).not.toContain("PRIVATE_A_HISTORY");await settle();tree=app.render();expect(text(tree)).toContain("Confirme sua conta");expect(text(tree)).not.toContain("PRIVATE_A_HISTORY");app.unmount();
 });
 it("não reabre após GET ok falso, data inválida ou cursor inválido; exige envelope válido",async()=>{
  const pages=[page,{ok:false,result:{items:[],next:null}},{ok:true,result:{items:[{...item,createdAt:"invalid"}],next:null}},{ok:true,result:{items:[item],next:{id:"invalid",before:item.createdAt}}},page];let index=0;
  const app=fixture(async()=>json(200,pages[index++]));app.render();await settle();app.render();window.dispatchEvent(new Event("focus"));await settle();let tree=app.render();
  for(let i=0;i<3;i++){expect(text(tree)).toContain("Confirme sua conta");expect(text(tree)).not.toContain("PRIVATE_A_HISTORY");click(tree,"Verificar sessão");await settle();tree=app.render();}
  expect(text(tree)).toContain("PRIVATE_A_HISTORY");app.unmount();
 });
 it("trata timeout de POST como incerto e reutiliza a tentativa, ignorando resposta tardia",async()=>{
  const controllers:AbortController[]=[];vi.spyOn(AbortSignal,"timeout").mockImplementation(()=>{const controller=new AbortController();controllers.push(controller);return controller.signal;});
  type Body={category:string;text:string;clientId:string};const sent:Body[]=[];let finish!:(response:Response)=>void;
  const app=fixture(async (_url,options)=>{if(options?.method!=="POST")return json(200,page);const body=JSON.parse(String(options.body)) as Body;sent.push(body);if(sent.length>1)return json(200,ack(body));return new Promise<Response>((resolve,reject)=>{finish=resolve;options.signal!.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError")),{once:true});});});
  app.render();await settle();let tree=app.render();change(tree,"Mensagem no tempo limite");tree=app.render();const pending=submit(tree);controllers.at(-1)!.abort();await pending;tree=app.render();expect(text(tree)).toContain("Verificar envio");
  finish(json(200,ack(sent[0]!)));await settle();tree=app.render();expect(text(tree)).not.toContain("Mensagem recebida");await submit(tree);expect(sent[1]).toEqual(sent[0]);app.unmount();
 });
 it("permite nova verificação após timeout da leitura de sessão",async()=>{
  const controllers:AbortController[]=[];vi.spyOn(AbortSignal,"timeout").mockImplementation(()=>{const controller=new AbortController();controllers.push(controller);return controller.signal;});let reads=0;
  const app=fixture(async (_url,options)=>{reads++;if(reads!==2)return json(200,page);return new Promise<Response>((_resolve,reject)=>options!.signal!.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError")),{once:true}));});
  app.render();await settle();app.render();window.dispatchEvent(new Event("focus"));let tree=app.render();expect(text(tree)).not.toContain("PRIVATE_A_HISTORY");controllers.at(-1)!.abort();await settle();tree=app.render();expect(text(tree)).toContain("Não foi possível verificar agora");click(tree,"Verificar sessão");await settle();expect(text(app.render())).toContain("PRIVATE_A_HISTORY");app.unmount();
 });
});
