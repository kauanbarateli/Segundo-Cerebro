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
function fixture(fetcher:typeof fetch,storageFailure?:'write'|'readback'){
 const h:PrivacyHooks={states:[],refs:[],memos:[],effects:[],pending:[],stateIndex:0,refIndex:0,memoIndex:0,effectIndex:0};let raw:string|null=null;
 vi.stubGlobal('fetch',fetcher);vi.stubGlobal('window',new EventTarget());
 const doc=new EventTarget() as EventTarget&{visibilityState:string};doc.visibilityState='visible';vi.stubGlobal('document',doc);
 vi.stubGlobal('sessionStorage',{getItem:()=>{if(storageFailure==='readback'&&raw!==null)throw Error('readback');return raw;},setItem:(_k:string,v:string)=>{raw=v;if(storageFailure==='write')throw Error('write');}});
 vi.stubGlobal('crypto',{randomUUID:()=>client});
 return {render(){seam.hooks=h;beginPrivacyRender(h);const tree=FeedbackWorkspace({userId:user,supportEmail:'fixture@example.invalid',ownerBinding:'ABCDEFGHIJKLMNOP'});flushPrivacyEffects(h);return tree;},raw:()=>raw,unmount(){for(const effect of h.effects)effect.cleanup?.();}};
}
const click=(tree:ReactNode,label:string)=>(find(tree,n=>n.type==='button'&&n.props.children===label)!.props.onClick as ()=>void)();
const change=(tree:ReactNode,value:string)=>(find(tree,n=>n.props.id==='feedback-text')!.props.onChange as (e:unknown)=>void)({target:{value}});
const submit=(tree:ReactNode)=>(find(tree,n=>n.type==='form')!.props.onSubmit as (e:unknown)=>Promise<void>)({preventDefault(){}});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
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
it('mantém histórico oculto quando uma resposta GET antiga chega após troca de conta',async()=>{
 const item={id:feedback,category:'suggestion',text:'HISTORICO_PRIVADO_A',status:'received',createdAt:'2026-10-31T12:00:00Z'};
 const page={ok:true,result:{items:[item],next:{before:item.createdAt,id:feedback}}};let reads=0,finish!:(r:Response)=>void;
 const slow=new Promise<Response>(resolve=>{finish=resolve;});
 const app=fixture(async()=>{reads++;return reads===1?json(200,page):reads===2?slow:json(409,{code:'SESSION_CHANGED'});});
 app.render();await settle();let tree=app.render();expect(rendered(tree)).toContain('HISTORICO_PRIVADO_A');
 click(tree,'Carregar mais');window.dispatchEvent(new Event('focus'));await settle();tree=app.render();expect(rendered(tree)).toContain('Confirme sua conta');
 finish(json(200,page));await settle();tree=app.render();expect(rendered(tree)).not.toContain('HISTORICO_PRIVADO_A');app.unmount();
});
it('remove histórico ao receber 403',async()=>{
 let reads=0;const item={id:feedback,category:'suggestion',text:'HISTORICO_PRIVADO_A',status:'received',createdAt:'2026-10-31T12:00:00Z'};
 const page={ok:true,result:{items:[item],next:{before:item.createdAt,id:feedback}}};
 const app=fixture(async()=>++reads===1?json(200,page):new Response(null,{status:403}));
 app.render();await settle();let tree=app.render();expect(rendered(tree)).toContain('HISTORICO_PRIVADO_A');click(tree,'Carregar mais');await settle();tree=app.render();
 expect(rendered(tree)).toContain('Confirme sua conta');expect(rendered(tree)).not.toContain('HISTORICO_PRIVADO_A');app.unmount();
});
it('impede dois envios síncronos para a mesma tentativa',async()=>{
 let writes=0,finish!:(r:Response)=>void;const slow=new Promise<Response>(resolve=>{finish=resolve;});
 const app=fixture(async (_url,options)=>{if(options?.method==='POST'){writes++;return slow;}return json(200,{ok:true,result:{items:[],next:null}});});
 app.render();await settle();let tree=app.render();change(tree,'Mensagem com duplo clique');tree=app.render();const first=submit(tree),second=submit(tree);await settle();expect(writes).toBe(1);
 finish(json(200,{ok:true,result:{status:'submitted',clientId:client,feedbackId:feedback}}));await Promise.all([first,second]);expect(rendered(app.render())).toContain('Mensagem recebida.');app.unmount();
});
it('após conflito preserva o texto e não identifica como confirmado o envio anterior',async()=>{
 const app=fixture(async (url,options)=>{if(options?.method!=='POST')return json(200,{ok:true,result:{items:[],next:null}});if(String(url)==='/api/feedback')return json(409,{ok:false,code:'CONFLICT'});return json(200,{ok:true,result:{status:'submitted',clientId:client,feedbackId:feedback}});});
 app.render();await settle();let tree=app.render();change(tree,'Texto que entrou em conflito');tree=app.render();await submit(tree);tree=app.render();expect(rendered(tree)).toContain('Não foi possível conciliar');
 click(tree,'Verificar novamente');await settle();tree=app.render();expect(rendered(tree)).toContain('Texto que entrou em conflito');expect(rendered(tree)).not.toContain('Mensagem recebida.');expect(rendered(tree)).toContain('Não foi possível confirmar o texto atual');app.unmount();
});
it.each([null,{ok:false},{ok:true,result:{status:'submitted',clientId:client}},{ok:true,result:{status:'submitted',clientId:'invalid',feedbackId:feedback}}])('resposta 200 inválida mantém tentativa não confirmada %#',async body=>{
 const app=fixture(async (_url,options)=>options?.method==='POST'?json(200,body):json(200,{ok:true,result:{items:[],next:null}}));
 app.render();await settle();let tree=app.render();change(tree,'Texto aguardando confirmação');tree=app.render();await submit(tree);tree=app.render();
 expect(rendered(tree)).toContain('Não foi possível confirmar o envio.');expect(rendered(tree)).not.toContain('Mensagem recebida.');expect(app.raw()).toContain(client);app.unmount();
});
it('recupera após falha de verificação sem apagar o marcador',async()=>{
 let checks=0;const app=fixture(async (_url,options)=>{if(options?.method!=='POST')return json(200,{ok:true,result:{items:[],next:null}});checks++;if(checks===1)throw Error('lost');if(checks===2)throw Error('offline');return json(200,{ok:true,result:{status:'cancelled',clientId:client}});});
 app.render();await settle();let tree=app.render();change(tree,'Mensagem para recuperar');tree=app.render();await submit(tree);tree=app.render();click(tree,'Verificar novamente');await settle();tree=app.render();expect(rendered(tree)).toContain('Não foi possível verificar a tentativa.');expect(app.raw()).toContain(client);
 click(tree,'Verificar novamente');await settle();tree=app.render();expect(rendered(tree)).toContain('Esta tentativa foi encerrada.');expect(rendered(tree)).toContain('Mensagem para recuperar');app.unmount();
});
it('indisponibilidade 503 na reconciliação preserva identidade, texto e marcador',async()=>{
 const app=fixture(async (url,options)=>{if(options?.method!=='POST')return json(200,{ok:true,result:{items:[],next:null}});if(String(url)==='/api/feedback')throw Error('lost');return json(503,{ok:false,code:'UNAVAILABLE'});});
 app.render();await settle();let tree=app.render();change(tree,'Rascunho privado para recuperar');tree=app.render();await submit(tree);tree=app.render();click(tree,'Verificar novamente');await settle();tree=app.render();
 expect(rendered(tree)).toContain('Não foi possível verificar a tentativa.');expect(rendered(tree)).toContain('Rascunho privado para recuperar');expect(rendered(tree)).not.toContain('Confirme sua conta');expect(app.raw()).toContain(client);app.unmount();
});
it('timeout do POST não confirma nem inicia segundo POST ao verificar o estado',async()=>{
 const controllers:AbortController[]=[];vi.spyOn(AbortSignal,'timeout').mockImplementation(()=>{const controller=new AbortController();controllers.push(controller);return controller.signal;});let posts=0,checks=0;
 const app=fixture(async (url,options)=>{if(options?.method!=='POST')return json(200,{ok:true,result:{items:[],next:null}});if(String(url)==='/api/feedback'){posts++;return new Promise<Response>((_resolve,reject)=>options.signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));}checks++;return json(200,{ok:true,result:{status:'cancelled',clientId:client}});});
 app.render();await settle();let tree=app.render();change(tree,'Texto privado sujeito a timeout');tree=app.render();const pending=submit(tree);controllers.at(-1)!.abort();await pending;tree=app.render();
 expect(rendered(tree)).toContain('Não foi possível confirmar o envio.');expect(rendered(tree)).not.toContain('Mensagem recebida.');click(tree,'Cancelar tentativa anterior');await settle();tree=app.render();
 expect(posts).toBe(1);expect(checks).toBe(1);expect(rendered(tree)).toContain('Texto privado sujeito a timeout');expect(app.raw()).toContain(client);app.unmount();
});
it('uma leitura autenticada inválida não reabre histórico privado',async()=>{
 const item={id:feedback,category:'suggestion',text:'HISTORICO_PRIVADO_A',status:'received',createdAt:'2026-10-31T12:00:00Z'};
 const pages=[{ok:true,result:{items:[item],next:null}},{ok:false,result:{items:[],next:null}},{ok:true,result:{items:[{...item,createdAt:'inválida'}],next:null}},{ok:true,result:{items:[item],next:{id:'inválido',before:item.createdAt}}},{ok:true,result:{items:[item],next:null}}];let read=0;
 const app=fixture(async()=>json(200,pages[read++]));app.render();await settle();expect(rendered(app.render())).toContain('HISTORICO_PRIVADO_A');
 window.dispatchEvent(new Event('focus'));await settle();let tree=app.render();
 for(let i=0;i<3;i++){expect(rendered(tree)).toContain('Confirme sua conta');expect(rendered(tree)).not.toContain('HISTORICO_PRIVADO_A');click(tree,'Verificar sessão');await settle();tree=app.render();}
 expect(rendered(tree)).toContain('HISTORICO_PRIVADO_A');app.unmount();
});
it('timeout do GET mantém a tela fechada e permite verificar a sessão novamente',async()=>{
 const controllers:AbortController[]=[];vi.spyOn(AbortSignal,'timeout').mockImplementation(()=>{const controller=new AbortController();controllers.push(controller);return controller.signal;});
 const item={id:feedback,category:'suggestion',text:'HISTORICO_PRIVADO_A',status:'received',createdAt:'2026-10-31T12:00:00Z'};let reads=0;
 const page={ok:true,result:{items:[item],next:null}};
 const app=fixture(async (_url,options)=>{reads++;if(reads!==2)return json(200,page);return new Promise<Response>((_resolve,reject)=>options!.signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));});
 app.render();await settle();expect(rendered(app.render())).toContain('HISTORICO_PRIVADO_A');window.dispatchEvent(new Event('focus'));
 let tree=app.render();expect(rendered(tree)).not.toContain('HISTORICO_PRIVADO_A');controllers.at(-1)!.abort();await settle();tree=app.render();
 expect(rendered(tree)).toContain('Confirme sua conta');expect(rendered(tree)).toContain('Não foi possível verificar agora.');expect(rendered(tree)).not.toContain('HISTORICO_PRIVADO_A');
 click(tree,'Verificar sessão');await settle();tree=app.render();expect(rendered(tree)).toContain('HISTORICO_PRIVADO_A');app.unmount();
});
it.each([401,403])('resposta %i sem corpo no envio fecha identidade e preserva marcador',async status=>{
 const app=fixture(async (_url,options)=>options?.method==='POST'?new Response(null,{status}):json(200,{ok:true,result:{items:[],next:null}}));
 app.render();await settle();let tree=app.render();change(tree,'Mensagem privada no envio');tree=app.render();await submit(tree);tree=app.render();
 expect(rendered(tree)).toContain('Confirme sua conta');expect(rendered(tree)).not.toContain('Mensagem privada no envio');expect(app.raw()).toContain(client);app.unmount();
});
it.each([401,403])('resposta %i sem corpo na reconciliação fecha identidade e preserva marcador',async status=>{
 const app=fixture(async (url,options)=>{if(options?.method!=='POST')return json(200,{ok:true,result:{items:[],next:null}});if(String(url)==='/api/feedback')throw Error('lost');return new Response(null,{status});});
 app.render();await settle();let tree=app.render();change(tree,'Mensagem privada aguardando estado');tree=app.render();await submit(tree);tree=app.render();click(tree,'Verificar novamente');await settle();tree=app.render();
 expect(rendered(tree)).toContain('Confirme sua conta');expect(rendered(tree)).not.toContain('Mensagem privada aguardando estado');expect(app.raw()).toContain(client);app.unmount();
});


it('ao falhar próxima página, mantém histórico e repete o mesmo cursor',async()=>{
 const first={id:feedback,category:'suggestion',text:'PRIMEIRA_MENSAGEM',status:'received',createdAt:'2026-10-31T12:00:00Z'};
 const second={...first,id:'a0000000-0000-4000-8000-000000000001',text:'SEGUNDA_MENSAGEM',createdAt:'2026-10-30T12:00:00Z'};
 const urls:string[]=[];
 const app=fixture(async url=>{urls.push(String(url));if(urls.length===1)return json(200,{ok:true,result:{items:[first],next:{before:first.createdAt,id:first.id}}});if(urls.length===2)return json(503,{ok:false});return json(200,{ok:true,result:{items:[second],next:null}});});
 app.render();await settle();let tree=app.render();click(tree,'Carregar mais');await settle();tree=app.render();
 expect(rendered(tree)).toContain('PRIMEIRA_MENSAGEM');expect(rendered(tree)).toContain('Não foi possível carregar suas mensagens.');
 click(tree,'Tentar novamente');await settle();tree=app.render();expect(urls[1]).toBe(urls[2]);expect(urls[1]).toContain('before=');
 expect(rendered(tree)).toContain('PRIMEIRA_MENSAGEM');expect(rendered(tree)).toContain('SEGUNDA_MENSAGEM');app.unmount();
});
it('falha antiga de paginação não reabre nem altera a verificação da identidade',async()=>{
 const first={id:feedback,category:'suggestion',text:'HISTORICO_SENSIVEL_A',status:'received',createdAt:'2026-10-31T12:00:00Z'};
 let reads=0,rejectOld!:(e:Error)=>void;const delayed=new Promise<Response>((_resolve,reject)=>{rejectOld=reject;});
 const app=fixture(async()=>{reads++;if(reads===1)return json(200,{ok:true,result:{items:[first],next:{before:first.createdAt,id:first.id}}});if(reads===2)return delayed;return json(409,{code:'SESSION_CHANGED'});});
 app.render();await settle();let tree=app.render();click(tree,'Carregar mais');window.dispatchEvent(new Event('focus'));await settle();tree=app.render();expect(rendered(tree)).toContain('Confirme sua conta');
 rejectOld(Error('late'));await settle();tree=app.render();expect(rendered(tree)).toContain('Confirme sua conta');expect(rendered(tree)).not.toContain('HISTORICO_SENSIVEL_A');expect(rendered(tree)).not.toContain('Não foi possível carregar suas mensagens.');app.unmount();
});
