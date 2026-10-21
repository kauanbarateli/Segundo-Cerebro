// RAM-only port controls. No Next, browser, database, credentials or network.
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {precompileRecoveryAuth,RECOVERY_NEW_PATHS} from "../../scripts/verification/auth-recovery-local-ci.mjs";
const APP="http://127.0.0.1:3117",paths=["/recuperar-senha","/redefinir-senha"],redirect="/recuperar-senha?notice=recovery-invalid";
const ticks=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
function reply(path,options={}){
 let controller,cancels=0,sourceCancels=0,releases=0,reads=0;const stream=new ReadableStream({start(c){controller=c;if(!options.open){if(options.chunk!==undefined)c.enqueue(options.chunk);c.close();}},cancel(){sourceCancels++;return options.cancel?.();}}),getReader=stream.getReader.bind(stream);
 stream.getReader=()=>{const original=getReader();return{read:()=>{reads++;return options.read?options.read(original):original.read();},cancel:()=>{cancels++;return original.cancel();},releaseLock:()=>{releases++;return options.release?options.release(original):original.releaseLock();}};};
 const response=new Response(stream,{status:options.status??(path===paths[0]?200:307),headers:{"content-type":"text/html; charset=utf-8",...(path===paths[1]?{location:redirect}:{}),...options.headers}});Object.defineProperty(response,"url",{value:options.url??APP+path});if(options.redirected!==undefined)Object.defineProperty(response,"redirected",{value:options.redirected});
 return{response,controller,stream,counts:()=>({cancels:Math.max(cancels,sourceCancels),releases,reads})};
}
function ports(overrides={}){
 let at=0;const pending=new Set(),calls=[],state={failed:false,closed:false},signals=[];const next={metadata:()=>({...state})};
 const nativeFetch=async(url,options)=>{const path=paths[calls.length];assert.equal(url,APP+path);assert.deepEqual(Object.keys(options).sort(),["cache","credentials","headers","method","redirect","signal"]);assert.deepEqual(options.headers,{Accept:"text/html"});assert.equal(options.method,"GET");assert.equal(options.redirect,"manual");assert.equal(options.credentials,"omit");assert.equal(options.cache,"no-store");assert.equal(options.signal instanceof AbortSignal,true);signals.push(options.signal);calls.push({url,options});return overrides.fetch?overrides.fetch(path,options,calls.length):reply(path).response;};
 return{next,pending,calls,state,signals,settings:{nativeFetch,now:()=>at,pending},setNow:value=>{at=value;}};
}
test("Recovery precompile owns two anonymous literal GETs sequentially through EOF and reader release",async()=>{
 const first=reply(paths[0],{open:true}),second=reply(paths[1]),f=ports({fetch:path=>path===paths[0]?first.response:second.response});let settled=false;
 const work=precompileRecoveryAuth(f.next,f.settings).then(value=>{settled=true;return value;});await ticks();assert.equal(f.calls.length,1);assert.equal(settled,false);assert.ok(f.pending.size>0);first.controller.close();assert.equal(await work,true);assert.equal(f.calls.length,2);assert.equal(f.signals[0],f.signals[1]);assert.equal(f.signals[0].aborted,true);assert.equal(f.pending.size,0);assert.equal(first.counts().cancels,0);assert.equal(first.counts().releases,1);assert.equal(second.counts().releases,1);
});
test("Recovery precompile rejects status, origin, redirect, cookie and content-type deviations without fetching another target",async()=>{
 for(const options of[{status:201},{status:307},{status:503},{url:APP+paths[0]+"?"},{url:"http://localhost:3117"+paths[0]},{url:"https://example.invalid"+paths[0]},{redirected:true},{headers:{location:redirect}},{headers:{"set-cookie":"PRIVATE_CANARY"}},{headers:{"content-type":"application/json"}}]){
  const r=reply(paths[0],options),f=ports({fetch:()=>r.response});assert.equal(await precompileRecoveryAuth(f.next,f.settings),false);assert.equal(f.calls.length,1);assert.equal(r.counts().cancels,1);assert.equal(r.counts().releases,1);assert.equal(f.pending.size,0);
 }
 for(const options of[{status:200},{status:303},{status:308},{headers:{location:"https://example.invalid"+redirect}},{headers:{location:APP+redirect}},{headers:{location:redirect+"&extra=1"}},{headers:{location:"/recuperar-senha?notice=session-required"}},{headers:{location:""}},{headers:{"set-cookie":"PRIVATE_CANARY"}}]){
  const second=reply(paths[1],options),f=ports({fetch:path=>path===paths[0]?reply(path).response:second.response});assert.equal(await precompileRecoveryAuth(f.next,f.settings),false);assert.equal(f.calls.length,2);assert.equal(second.counts().cancels,1);assert.equal(f.pending.size,0);
 }
});
test("Recovery precompile needs natural byte EOF within the existing2MiB limit and never reads private provider errors",async()=>{
 for(const size of[2097152,2097153]){const r=reply(paths[0],{chunk:new Uint8Array(size)}),f=ports({fetch:path=>path===paths[0]?r.response:reply(path).response});assert.equal(await precompileRecoveryAuth(f.next,f.settings),size===2097152);assert.equal(r.counts().cancels,size===2097152?0:1);assert.equal(f.pending.size,0);}
 for(const mode of["non-byte","stream-error","fetch-error","release-error"]){let reads=0;const privateError=Object.defineProperties({},{message:{get(){reads++;throw Error("PRIVATE_CANARY");}}}),r=reply(paths[0],{open:mode==="stream-error",chunk:mode==="non-byte"?"PRIVATE_CANARY":undefined,release:mode==="release-error"?()=>{throw privateError;}:undefined});const f=ports({fetch:async()=>{if(mode==="fetch-error")throw privateError;if(mode==="stream-error")queueMicrotask(()=>r.controller.error(privateError));return r.response;}});assert.equal(await precompileRecoveryAuth(f.next,f.settings),false);assert.equal(reads,0);assert.equal(f.calls.length,1);assert.equal(f.pending.size,0);}
});
test("Recovery precompile has one absolute30s budget and never renews it for the second GET",async t=>{
 t.mock.timers.enable({apis:["setTimeout"]});const first=Promise.withResolvers(),second=Promise.withResolvers(),f=ports({fetch:(_path,_options,count)=>count===1?first.promise:second.promise});let settled=false;
 const work=precompileRecoveryAuth(f.next,f.settings).then(value=>{settled=true;return value;});await ticks();f.setNow(29000);t.mock.timers.tick(29000);first.resolve(reply(paths[0]).response);await ticks();assert.equal(f.calls.length,2);f.setNow(29999);t.mock.timers.tick(999);await ticks();assert.equal(settled,false);f.setNow(30000);t.mock.timers.tick(1);assert.equal(await work,false);assert.equal(f.signals.every(signal=>signal.aborted),true);assert.ok(f.pending.size>0);second.resolve(reply(paths[1]).response);await ticks();assert.equal(f.pending.size,0);
});
test("Recovery precompile timeout cannot turn a late fetch or pending cancel into quiet ownership",async t=>{
 t.mock.timers.enable({apis:["setTimeout"]});
 const response=Promise.withResolvers(),cancel=Promise.withResolvers(),r=reply(paths[0],{open:true,cancel:()=>cancel.promise}),f=ports({fetch:()=>response.promise});const work=precompileRecoveryAuth(f.next,f.settings);await ticks();f.setNow(30000);t.mock.timers.tick(30000);assert.equal(await work,false);assert.equal(f.pending.size,1);response.resolve(r.response);await ticks();assert.equal(r.counts().cancels,1);assert.equal(f.pending.size,1);cancel.resolve();await ticks();assert.equal(f.pending.size,0);assert.equal(f.calls.length,1);
 const cleanup=Promise.withResolvers(),invalid=reply(paths[0],{status:503,open:true,cancel:()=>cleanup.promise}),g=ports({fetch:()=>invalid.response});const failed=precompileRecoveryAuth(g.next,g.settings);await ticks();assert.ok(g.pending.size>0);g.setNow(30000);t.mock.timers.tick(30000);assert.equal(await failed,false);assert.ok(g.pending.size>0);cleanup.resolve();await ticks();assert.equal(g.pending.size,0);assert.equal(invalid.counts().releases,1);
});
test("Recovery precompile deadline includes reader release and does not retry an unsettled release",async t=>{
 t.mock.timers.enable({apis:["setTimeout"]});const release=Promise.withResolvers(),r=reply(paths[0],{release:()=>release.promise}),f=ports({fetch:()=>r.response});let settled=false;
 const work=precompileRecoveryAuth(f.next,f.settings).then(value=>{settled=true;return value;});await ticks();assert.equal(r.counts().releases,1);assert.equal(settled,false);f.setNow(30000);t.mock.timers.tick(30000);assert.equal(await work,false);assert.equal(f.calls.length,1);assert.equal(r.counts().releases,1);assert.ok(f.pending.size>0);release.resolve();await ticks();assert.equal(f.pending.size,0);
});
test("Recovery precompile refuses non-monotonic clocks, dead Next, private option accessors and late Next failure",async()=>{
 for(const at of[NaN,Infinity,-1]){const f=ports({fetch:path=>{f.setNow(at);return reply(path).response;}});assert.equal(await precompileRecoveryAuth(f.next,f.settings),false);assert.equal(f.calls.length,1);assert.equal(f.pending.size,0);}
 for(const field of["failed","closed"]){const f=ports();f.state[field]=true;assert.equal(await precompileRecoveryAuth(f.next,f.settings),false);assert.equal(f.calls.length,0);}
 const f=ports({fetch:path=>reply(path,{release:original=>{original.releaseLock();f.state.failed=true;}}).response});assert.equal(await precompileRecoveryAuth(f.next,f.settings),false);assert.equal(f.calls.length,1);
 let reads=0;const g=ports(),options=Object.defineProperty({pending:g.pending},"nativeFetch",{get(){reads++;throw Error("PRIVATE_CANARY");}});assert.equal(await precompileRecoveryAuth(g.next,options),false);assert.equal(reads,0);assert.equal(g.calls.length,0);
});
test("Recovery source wires precompile after original login readiness and before worker with the same lifecycle pending Set",async()=>{
 const source=await readFile(new URL("../../scripts/verification/auth-recovery-local-ci.mjs",import.meta.url),"utf8"),ast=ts.createSourceFile("recovery-ci.mjs",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),gates=[],workers=[],startup=[];
 const visit=node=>{if(ts.isIfStatement(node)&&node.expression.getText(ast).includes("await precompileRecoveryAuth(next,{pending})"))gates.push(node);if(ts.isCallExpression(node)&&node.expression.getText(ast)==="drainAdminBrowserNextReadiness")startup.push(node);if(ts.isCallExpression(node)&&node.expression.getText(ast)==="run"&&node.arguments[1]?.getText(ast).includes('"playwright.auth-recovery-local.config.ts"'))workers.push(node);ts.forEachChild(node,visit);};visit(ast);assert.equal(gates.length,1);assert.equal(workers.length,1);assert.equal(startup.length,1);assert.ok(startup[0].pos<gates[0].pos&&gates[0].end<workers[0].pos);assert.equal(RECOVERY_NEW_PATHS.includes("tests/scripts/recovery-precompile.test.mjs"),true);
 const gate=new Function("ports",`return(async()=>{const {next,pending,precompileRecoveryAuth,fail,worker}=ports;${gates[0].getText(ast)}worker();})()`);
 for(const mode of["false","failed","closed","ok"]){let workers=0;const pending=new Set(),state={failed:mode==="failed",closed:mode==="closed"};const work=gate({next:{metadata:()=>({...state})},pending,precompileRecoveryAuth:async(_next,options)=>{assert.equal(options.pending,pending);return mode!=="false";},fail:()=>{throw Error("PROCESS_UNCONFIRMED");},worker:()=>{workers++;}});if(mode==="ok")await work;else await assert.rejects(work,{message:"PROCESS_UNCONFIRMED"});assert.equal(workers,mode==="ok"?1:0);}
});
