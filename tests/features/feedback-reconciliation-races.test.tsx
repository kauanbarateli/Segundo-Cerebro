import {afterEach,expect,it,vi} from 'vitest';
import {Children,isValidElement,type ReactElement,type ReactNode} from 'react';
import {beginPrivacyRender,flushPrivacyEffects,privacyHookMocks,type PrivacyHooks} from '../helpers/privacy-hooks';
const seam=vi.hoisted(()=>({hooks:null as unknown as PrivacyHooks}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),
 useState:(...args:Parameters<ReturnType<typeof privacyHookMocks>['useState']>)=>privacyHookMocks(seam.hooks).useState(...args),
 useRef:(...args:Parameters<ReturnType<typeof privacyHookMocks>['useRef']>)=>privacyHookMocks(seam.hooks).useRef(...args),
 useCallback:(...args:Parameters<ReturnType<typeof privacyHookMocks>['useCallback']>)=>privacyHookMocks(seam.hooks).useCallback(...args),
 useEffect:(...args:Parameters<ReturnType<typeof privacyHookMocks>['useEffect']>)=>privacyHookMocks(seam.hooks).useEffect(...args),
}));
vi.mock('@/components/ui/field',()=>({Field:'feedback-field'}));
import {FeedbackWorkspace} from '../../src/components/features/feedback/feedback-workspace';
const user='10000000-0000-4000-8000-000000000001',client='20000000-0000-4000-8000-000000000001',feedback='90000000-0000-4000-8000-000000000001';
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
function find(node:ReactNode,predicate:(el:ReactElement<Record<string,unknown>>)=>boolean):ReactElement<Record<string,unknown>>|undefined{
 for(const child of Children.toArray(node)){if(!isValidElement<Record<string,unknown>>(child))continue;if(predicate(child))return child;const nested=find(child.props.children as ReactNode,predicate);if(nested)return nested;}
}
const rendered=(node:ReactNode)=>JSON.stringify(node,(_k,v)=>typeof v==='function'?undefined:v);
function fixture(fetcher:typeof fetch,storageFailure?:'write'|'readback',ownerBinding:string|null='ABCDEFGHIJKLMNOP'){
 const h:PrivacyHooks={states:[],refs:[],memos:[],effects:[],pending:[],stateIndex:0,refIndex:0,memoIndex:0,effectIndex:0};let raw:string|null=null,storageReads=0,storageWrites=0;
 vi.stubGlobal('fetch',fetcher);vi.stubGlobal('window',new EventTarget());
 const doc=new EventTarget() as EventTarget&{visibilityState:string};doc.visibilityState='visible';vi.stubGlobal('document',doc);
 vi.stubGlobal('sessionStorage',{getItem:()=>{storageReads++;if(storageFailure==='readback'&&raw!==null)throw Error('readback');return raw;},setItem:(_k:string,v:string)=>{storageWrites++;raw=v;if(storageFailure==='write')throw Error('write');}});
 vi.stubGlobal('crypto',{randomUUID:()=>client});
 return {render(){seam.hooks=h;beginPrivacyRender(h);const tree=FeedbackWorkspace({userId:user,supportEmail:'fixture@example.invalid',ownerBinding});flushPrivacyEffects(h);return tree;},raw:()=>raw,storageCounts:()=>({reads:storageReads,writes:storageWrites}),unmount(){for(const effect of h.effects)effect.cleanup?.();}};
}
const click=(tree:ReactNode,label:string)=>(find(tree,n=>n.type==='button'&&n.props.children===label)!.props.onClick as ()=>void)();
const change=(tree:ReactNode,value:string)=>(find(tree,n=>n.props.id==='feedback-text')!.props.onChange as (e:unknown)=>void)({target:{value}});
const submit=(tree:ReactNode)=>(find(tree,n=>n.type==='form')!.props.onSubmit as (e:unknown)=>Promise<void>)({preventDefault(){}});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('com ownerBinding nulo, a montagem simulada lê histórico sem acessar storage ou abrir formulário',async()=>{
 const app=fixture(async()=>json(200,{ok:true,result:{items:[],next:null}}),undefined,null);
 app.render();await settle();const tree=app.render();
 expect(rendered(tree)).toContain('O envio está temporariamente indisponível');expect(find(tree,n=>n.type==='form')).toBeUndefined();
 expect(app.storageCounts()).toEqual({reads:0,writes:0});app.unmount();
});
it.each(['reject','resolve','json-reject'] as const)('ignora %s do POST antigo depois de A → B → A, inclusive durante uma nova verificação',async mode=>{
 let rejectOld!:(e:Error)=>void,resolveOld!:(r:Response)=>void,resolveNew!:(r:Response)=>void,rejectBody!:(e:Error)=>void;
 const old=new Promise<Response>((resolve,reject)=>{resolveOld=resolve;rejectOld=reject;});
 const lateBody=new Promise<unknown>((_resolve,reject)=>{rejectBody=reject;});
 const newer=new Promise<Response>(resolve=>{resolveNew=resolve;});let reads=0,statusCalls=0;
 const app=fixture(async (url,options)=>{
  if(options?.method==='POST'&&String(url)==='/api/feedback')return mode==='json-reject'?({status:409,ok:false,json:()=>lateBody} as Response):old;
  if(options?.method==='POST'){statusCalls++;return newer;}
  reads++;return reads===2?json(409,{code:'SESSION_CHANGED'}):json(200,{ok:true,result:{items:[],next:null}});
 });
 app.render();await settle();let tree=app.render();change(tree,'Mensagem privada para revisão');tree=app.render();const post=submit(tree);await settle();
 window.dispatchEvent(new Event('focus'));await settle();tree=app.render();expect(rendered(tree)).toContain('Confirme sua conta');
 click(tree,'Verificar sessão');await settle();tree=app.render();expect(rendered(tree)).toContain('Estamos verificando seu envio anterior.');
 click(tree,'Verificar novamente');await settle();tree=app.render();expect(statusCalls).toBe(1);
 expect(find(tree,n=>n.type==='button'&&n.props.children==='Verificar novamente')!.props.disabled).toBe(true);
 if(mode==='reject')rejectOld(Error('old network failure'));else if(mode==='json-reject')rejectBody(Error('old malformed body'));else resolveOld(json(200,{ok:true,result:{status:'submitted',clientId:client,feedbackId:feedback}}));
 await post;await settle();tree=app.render();expect(rendered(tree)).not.toContain('Mensagem recebida.');expect(rendered(tree)).not.toContain('Não foi possível confirmar o envio.');
 expect(find(tree,n=>n.type==='button'&&n.props.children==='Verificar novamente')!.props.disabled).toBe(true);
 resolveNew(json(200,{ok:true,result:{status:'cancelled',clientId:client}}));await settle();tree=app.render();
 expect(rendered(tree)).toContain('Esta tentativa foi encerrada.');expect(rendered(tree)).toContain('Mensagem privada para revisão');expect(app.raw()).toContain(client);app.unmount();
});
it.each(['write','readback'] as const)('permite copiar rascunho após falha %s e o oculta ao trocar a conta',async mode=>{
 let reads=0,posts=0;
 const app=fixture(async (_url,options)=>{if(options?.method==='POST'){posts++;throw Error('must not submit');}reads++;return reads===1?json(200,{ok:true,result:{items:[],next:null}}):json(409,{code:'SESSION_CHANGED'});},mode);
 app.render();await settle();let tree=app.render();change(tree,'Texto privado preservado para cópia');tree=app.render();await submit(tree);tree=app.render();
 expect(posts).toBe(0);expect(app.raw()).toContain(client);expect(rendered(tree)).toContain('Texto privado preservado para cópia');
 expect(find(tree,n=>n.props.label==='Texto para copiar (envio não confirmado)')!.props.readOnly).toBe(true);
 window.dispatchEvent(new Event('focus'));tree=app.render();expect(rendered(tree)).not.toContain('Texto privado preservado para cópia');
 await settle();tree=app.render();expect(rendered(tree)).toContain('Confirme sua conta');expect(rendered(tree)).not.toContain('Texto privado preservado para cópia');app.unmount();
});
