import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../../package.json',import.meta.url)),ts=require('typescript');
const source=async path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');
const data=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
const moduleURL=code=>{const r=compile(code);assert.equal((r.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);return data(r.outputText);};
const contract=await source('src/core/feedback/barrier-contract.ts'),contractUrl=moduleURL(contract);
const {parseBarrierResult,parseBarrierCommand}=await import(contractUrl);
const client='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',feedback='90000000-0000-4000-8000-000000000001',owner='ABCDEFGHIJKLMNOP';
const actor={userId:'user-a',sessionId:'session-a',mustChangePassword:false};

test('receipts require exact closed shape and requested client ID',()=>{
 assert.deepEqual(parseBarrierResult({status:'submitted',clientId:client,feedbackId:feedback},client),{status:'submitted',clientId:client,feedbackId:feedback});
 for(const value of [null,{status:'unknown',clientId:other},{status:'submitted',clientId:client,feedbackId:feedback,extra:true},{status:'submitted',clientId:client},{status:'cancelled',clientId:other}])assert.equal(parseBarrierResult(value,client),null);
 assert.deepEqual(parseBarrierCommand({action:'cancel',clientId:client}),{action:'cancel',clientId:client});
 for(const value of [{action:'cancel',clientId:client,text:'private'},{action:'status',clientId:'bad'},{action:'submit',clientId:client}])assert.equal(parseBarrierCommand(value),null);
});

test('service gate blocks before port, actor derives exclusively from server',async()=>{
 const service=await import(moduleURL(await source('src/lib/feedback/reconciliation-service.ts')));
 let calls=0;const command={action:'status',clientId:client};
 await assert.rejects(service.runReconciliation({ready:()=>false,perform:()=>{calls++;}},actor,command));assert.equal(calls,0);
 await assert.rejects(service.runReconciliation({ready:()=>true,perform:()=>{calls++;}},{...actor,mustChangePassword:true},command));assert.equal(calls,0);
 const result=await service.runReconciliation({ready:()=>true,perform:(who,c)=>{calls++;assert.equal(who,actor);assert.deepEqual(c,command);return {status:'unknown',clientId:client};}},actor,command);
 assert.equal(result.status,'unknown');assert.equal(calls,1);
});

function replace(code,needle,value){assert.equal(code.split(needle).length,2,needle);return code.replace(needle,JSON.stringify(value));}
async function gateway(enabled){
 let code=compile(await source('src/adapters/db/feedback-gateway.ts')).outputText;
 code=replace(code,'"server-only"',data('export {};'));
 code=replace(code,'"../../lib/environment/application-destination"',data('export const authDeploymentAllowed=()=>true;'));
 code=replace(code,'"../../lib/auth/database-origin-server"',data('export const isTrustedHostedDatabaseOrigin=()=>true;'));
 code=replace(code,'"../../core/feedback/submission"',data('export const FEEDBACK_CATEGORIES=["suggestion","complaint","problem","improvement","other"];'));
 code=replace(code,'"../../core/feedback/barrier-contract"',contractUrl);
 code=replace(code,'"../../lib/feedback/reconciliation-gate"',data(`export const feedbackReconciliationReady=()=>${enabled};`));
 return import(data(code));
}
const config={supabaseUrl:'https://invalid.example',secretKey:'synthetic',mode:'supabase'};
test('gateway gate refuses submit and reconciliation without fetch',async()=>{
 const api=await gateway(false);let calls=0;const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('should not fetch');};
 try{await assert.rejects(api.feedbackBarrierRpc(config,actor,{action:'cancel',clientId:client}),e=>e.code==='UNAVAILABLE');await assert.rejects(api.feedbackRpc(config,actor,{clientId:client,category:'other',text:'private content'}),e=>e.code==='UNAVAILABLE');assert.equal(calls,0);}finally{globalThis.fetch=old;}
});
test('hypothetical gateway sends actor and client only for status, rejects malformed receipts',async()=>{
 const api=await gateway(true),old=globalThis.fetch;let body;
 globalThis.fetch=async(_url,options)=>{body=JSON.parse(options.body);return Response.json({status:'cancelled',clientId:client});};
 try{
  assert.equal((await api.feedbackBarrierRpc(config,actor,{action:'cancel',clientId:client})).status,'cancelled');
  assert.deepEqual(body,{p_user:actor.userId,p_session:actor.sessionId,p_client:client});
  globalThis.fetch=async()=>Response.json({status:'cancelled',clientId:other});
  await assert.rejects(api.feedbackBarrierRpc(config,actor,{action:'cancel',clientId:client}),e=>e.code==='COMMIT_UNKNOWN');
  globalThis.fetch=async()=>{throw Error('timeout');};
  await assert.rejects(api.feedbackBarrierRpc(config,actor,{action:'cancel',clientId:client}),e=>e.code==='COMMIT_UNKNOWN');
  await assert.rejects(api.feedbackBarrierRpc(config,actor,{action:'status',clientId:client}),e=>e.code==='UNAVAILABLE');
 }finally{globalThis.fetch=old;}
});

test('storage marker contains no content; unknown/wrong owner stay blocked',async()=>{
 const domain=await import(moduleURL(await source('src/core/feedback/reconciliation.ts')));
 let raw=null;const store={getItem:()=>raw,setItem:(_k,v)=>{raw=v;},removeItem:()=>{raw=null;}};
 assert.deepEqual(domain.prepareMarker(store,{version:1,clientId:client,ownerBinding:owner}),{status:'ready',clientId:client});
 assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['clientId','ownerBinding','version']);assert(!raw.includes('private content'));
 assert.equal(domain.inspectMarker(store,'OtherOwnerBinding').status,'different-owner');
 assert.equal(domain.reconcile(store,owner,{status:'unknown',clientId:client}).status,'unknown');assert.notEqual(raw,null);
 assert.equal(domain.reconcile(store,owner,{status:'cancelled',clientId:client}).status,'cancelled');assert.notEqual(raw,null);
 const deny={getItem:()=>null,setItem:()=>{throw Error('denied');},removeItem:()=>{}};
 assert.equal(domain.prepareMarker(deny,{version:1,clientId:client,ownerBinding:owner}).status,'blocked');
});

test('conflict followed by submitted status preserves draft and marker; reload makes no content claim',async()=>{
 const domain=await import(moduleURL(await source('src/core/feedback/reconciliation.ts')));
 let raw=null,text='Mensagem B que ainda não foi confirmada';
 const store={getItem:()=>raw,setItem:(_k,v)=>{raw=v;},removeItem:()=>{raw=null;}};
 assert.equal(domain.prepareMarker(store,{version:1,clientId:client,ownerBinding:owner}).status,'ready');
 // Simulate a 409 CONFLICT: another payload A already used this key.
 const conflict={status:409,code:'CONFLICT'};assert.equal(conflict.code,'CONFLICT');
 const submitted=parseBarrierResult({status:'submitted',clientId:client,feedbackId:feedback},client);
 assert.equal(submitted.status,'submitted');
 const choice=domain.recoveryDisposition(submitted.status,true,true);
 assert.equal(choice,'preserve-draft');
 if(choice==='resolve-terminal') { domain.reconcile(store,owner,submitted);text=''; }
 assert.equal(text,'Mensagem B que ainda não foi confirmada');assert.notEqual(raw,null);
 // Reload loses draft contents: a generic previous-submission status can be resolved,
 // but there is no basis to assert which text was committed.
 assert.equal(domain.recoveryDisposition(submitted.status,false,false),'resolve-terminal');
 assert.equal(domain.reconcile(store,owner,submitted).status,'submitted');assert.notEqual(raw,null);
 assert.equal(domain.recoveryDisposition('cancelled',true,true),'preserve-draft');
 assert.equal(domain.recoveryDisposition('cancelled',true,false),'resolve-terminal');
 assert.equal(domain.recoveryDisposition('submitted',true,false),'preserve-draft');
 const ui=await source('src/components/features/feedback/feedback-workspace.tsx');
 assert.match(ui,/recoveryDisposition\(result.status,intent.current!==null,intent.current\?\.conflicted===true\)==='preserve-draft'/);
 assert.match(ui,/Um envio anterior foi registrado\. Confira o histórico\./);
 assert.match(ui,/Texto atual \(não confirmado\)/);
});

test('candidate surfaces keep server hard gate and do not call old writer',async()=>{
 const gate=await source('src/lib/feedback/reconciliation-gate.ts'),route=await source('src/app/api/feedback/route.ts'),control=await source('src/app/api/feedback/reconciliation/route.ts'),ui=await source('src/components/features/feedback/feedback-workspace.tsx'),gatewaySource=await source('src/adapters/db/feedback-gateway.ts');
 assert.match(gate,/return false/);assert.match(route,/write && !feedbackReconciliationReady\(\)/);assert.match(control,/!feedbackReconciliationReady\(\)/);
 assert.match(control,/x-expected-user-id/);assert.match(control,/sameOrigin/);assert.match(control,/2048/);
 assert.match(ui,/prepareMarker\(sessionStorage/);assert.match(ui,/inspectMarker\(sessionStorage/);assert.match(ui,/reconcile\(sessionStorage/);
 assert(!gatewaySource.includes('/rpc/feedback_submit'));
});

test('reconciliation route enforces gate, origin and identity with synthetic Next/Auth',async()=>{
 const serviceUrl=moduleURL(await source('src/lib/feedback/reconciliation-service.ts'));
 async function route(enabled){
  let code=compile(await source('src/app/api/feedback/reconciliation/route.ts')).outputText;
  for(const [needle,stub] of [
    ['"next/server"',data('export const NextResponse={json:(body,init)=>Response.json(body,init)};')],
    ['"@/adapters/db/feedback-gateway"',data('export class FeedbackGatewayError extends Error{constructor(code){super(code);this.code=code}};export async function feedbackBarrierRpc(config,actor,command){globalThis.__feedbackRecorded={actor,command};if(globalThis.__feedbackForbidden)throw new FeedbackGatewayError("FORBIDDEN");return {status:"unknown",clientId:command.clientId};}')],
    ['"@/core/feedback/barrier-contract"',contractUrl],
    ['"@/lib/auth/config"',data('export const readAuthConfiguration=()=>({mode:"supabase",appOrigin:"https://app.example"});')],
    ['"@/lib/auth/policy"',data('export const sameOrigin=(value,expected)=>value===expected;')],
    ['"@/lib/auth/runtime"',data('export async function requestAuthServices(){return {gateway:{readIdentity:async()=>globalThis.__feedbackActor}};}')],
    ['"@/lib/auth/types"',data('export class AuthGuardError extends Error{constructor(code){super(code);this.code=code}}')],
    ['"@/lib/feedback/reconciliation-gate"',data(`export const feedbackReconciliationReady=()=>${enabled};`)],
    ['"@/lib/feedback/reconciliation-service"',serviceUrl],
  ]) { const literal=code.includes(needle)?needle:needle.replaceAll('"',"'");code=replace(code,literal,stub); }
  return import(data(code));
 }
 const request=(origin,expected,body={action:'status',clientId:client})=>new Request('https://app.example/api/feedback/reconciliation',{method:'POST',headers:{origin,'Content-Type':'application/json','x-expected-user-id':expected},body:JSON.stringify(body)});
 try{
  globalThis.__feedbackActor=actor;globalThis.__feedbackRecorded=null;
  assert.equal((await (await route(false)).POST(request('https://app.example',actor.userId))).status,503);assert.equal(globalThis.__feedbackRecorded,null);
  const enabled=await route(true);
  assert.equal((await enabled.POST(request('https://evil.example',actor.userId))).status,403);
  assert.equal((await enabled.POST(request('https://app.example','user-b'))).status,409);
  assert.equal((await enabled.POST(request('https://app.example',actor.userId,{action:'status',clientId:client,text:'private'}))).status,400);
  const response=await enabled.POST(request('https://app.example',actor.userId));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.deepEqual(globalThis.__feedbackRecorded,{actor,command:{action:'status',clientId:client}});
  globalThis.__feedbackForbidden=true;
  assert.equal((await enabled.POST(request('https://app.example',actor.userId))).status,403);
  globalThis.__feedbackForbidden=false;
  globalThis.__feedbackActor={...actor,userId:'user-b'};globalThis.__feedbackRecorded=null;
  assert.equal((await enabled.POST(request('https://app.example',actor.userId))).status,409);assert.equal(globalThis.__feedbackRecorded,null);
 }finally{delete globalThis.__feedbackActor;delete globalThis.__feedbackRecorded;delete globalThis.__feedbackForbidden;}
});
