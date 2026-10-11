// Pure protocol preparation only: canonical SQL/PGlite PG18 and explicit
// synthetic GoTrue/HTTP/claims doubles. No Next, browser, stack or native PASS.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { resolve,join } from "node:path";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { ADMIN_BROWSER_APP, ADMIN_BROWSER_API, ADMIN_BROWSER_PAGES, ADMIN_BROWSER_PROBES, ADMIN_BROWSER_INSPECTION_ORDER, adminBrowserEnvironment, adminBrowserRefuse, closedBrowserOperation, acceptAdminBrowserRequest, acceptsAdminBrowserDenial, acceptAdminOwnSessions, acceptAdminOwnSessionsView, acceptsAdminOwnSessionsChanged, adminBrowserInspectionInput, acceptAdminBrowserProof, adminBrowserBootstrapInput, createAdminBrowserState, createAdminBrowserTransport, createAdminBrowserNextTransport, createAdminBrowserHarness, isAdminCanonicalHmrGet, classifyAdminBrowserHttpRequest, adminBrowserHttpPendingCode, isAdminBrowserReadCancellationRequest, isAdminBrowserParkableAuthRead, isAdminBrowserParkableAssetRead, adminBrowserPreParkPending, adminBrowserPreParkReadPending, adminBrowserPageReleaseCode, adminBrowserPendingCode, waitForAdminBrowserIoQuiet, waitForAdminBrowserHttpQuiet } from "../e2e-auth-local/admin-browser-support.mjs";
import { ADMIN_BROWSER_CASES, ADMIN_BROWSER_STAGES, ADMIN_BROWSER_PASS_COUNTS, ADMIN_BROWSER_LIMITS, ADMIN_HTTP_PENDING_CLASSES, ADMIN_HTTP_PENDING_CODES, blankAdminBrowserCase, validateAdminBrowserCase, closedAdminBrowserValue } from "../e2e-auth-local/admin-browser-contract.mjs";

const namespace="sc-admin-native-"+"a".repeat(32), sourceSha="b".repeat(40), systemIdentifier="7250000000000000001", projectId="sc-auth-ci-"+"c".repeat(24);
const context=kind=>({case:kind,namespace,sourceSha,systemIdentifier,projectId,publishableKey:"sb_publishable_synthetic_test_only",secretKey:"sb_secret_synthetic_test_only",commitmentSecret:"synthetic-exclusive-admin-commitment-32-characters",reportPath:"/tmp/sc-admin-browser-test/admin-browser-case-report.json"});
const tempRoot=resolve(process.env.TEMP??"/tmp");
const env=kind=>({CI:"true",GITHUB_ACTIONS:"true",SC_ADMIN_BROWSER_RUN:"1",APP_MODE:"supabase",NODE_ENV:"development",APP_URL:ADMIN_BROWSER_APP,SUPABASE_URL:ADMIN_BROWSER_API,SC_ADMIN_BROWSER_CASE:kind,SC_ADMIN_BROWSER_NAMESPACE:namespace,GITHUB_SHA:sourceSha,SC_ADMIN_BROWSER_PROJECT:projectId,SC_ADMIN_BROWSER_SYSTEM:systemIdentifier,SUPABASE_PUBLISHABLE_KEY:context(kind).publishableKey,SUPABASE_SECRET_KEY:context(kind).secretKey,AUTH_STATE_SECRET:"synthetic-auth-state-exclusive-32-characters",AUTH_RATE_LIMIT_SECRET:"synthetic-rate-limit-exclusive-32-characters",ADMIN_COMMAND_SECRET:context(kind).commitmentSecret,SC_ADMIN_BROWSER_REPORT:join(tempRoot,"sc-admin-browser-test","admin-browser-case-report.json"),RUNNER_TEMP:tempRoot});
const noBody=value=>value===undefined;

test("own-session RPC projection binds the exact SQL owner/SID inventory and never returns identifiers or expiry",()=>{
  const a=randomUUID(),b=randomUUID(),s1=randomUUID(),s2=randomUUID(),foreign=randomUUID(),when="2026-10-11T13:00:00+00:00";
  const inventory=[{id:s1,user_id:b},{id:s2,user_id:b},{id:foreign,user_id:a}];
  const row=(id,current)=>({id,is_current:current,created_at:when,refreshed_at:null,not_after:null});
  const input={sessions:[row(s1,true),row(s2,false)],has_more:false};
  const expected={sessions:[{isCurrent:true,createdAt:when,refreshedAt:null},{isCurrent:false,createdAt:when,refreshedAt:null}],hasMore:false};
  assert.deepEqual(acceptAdminOwnSessions(input,b,s1,inventory),expected);
  const other={sessions:[row(s2,true),row(s1,false)],has_more:false};assert.equal(acceptAdminOwnSessions(other,b,s2,inventory).sessions[0].isCurrent,true);
  for(const mutate of[v=>v.sessions[1].id=foreign,v=>v.sessions.pop(),v=>v.sessions[1].id=s1,v=>v.sessions[0].is_current=false,v=>v.sessions[1].is_current=true,v=>v.sessions.reverse(),v=>v.has_more=true,v=>v.sessions[0].created_at="PRIVATE",v=>v.sessions[0].device="PRIVATE",v=>v.sessions[0].not_after="PRIVATE"]){const bad=structuredClone(input);mutate(bad);assert.throws(()=>acceptAdminOwnSessions(bad,b,s1,inventory));}
  assert.throws(()=>acceptAdminOwnSessions(input,a,s1,inventory));assert.throws(()=>acceptAdminOwnSessions(input,b,randomUUID(),inventory));
  let getters=0;const hidden=Object.defineProperty({...input},"sessions",{enumerable:true,get(){getters++;throw Error("PRIVATE");}});assert.throws(()=>acceptAdminOwnSessions(hidden,b,s1,inventory));assert.equal(getters,0);
  assert.equal(JSON.stringify(expected).includes(s1),false);assert.equal(Object.hasOwn(expected.sessions[0],"notAfter"),false);
});

test("own-session API projection is closed and the foreign expected-owner fence accepts only its exact409 denial",()=>{
  const expected={sessions:[{isCurrent:true,createdAt:null,refreshedAt:"2026-10-11T13:00:00Z"}],hasMore:false};
  assert.deepEqual(acceptAdminOwnSessionsView(expected,expected),expected);
  for(const mutate of[v=>v.sessions[0].id=randomUUID(),v=>v.sessions[0].notAfter=null,v=>v.sessions[0].isCurrent=false,v=>v.sessions[0].refreshedAt=null,v=>v.hasMore=true,v=>v.sessions.push({...v.sessions[0]})]){const bad=structuredClone(expected);mutate(bad);assert.throws(()=>acceptAdminOwnSessionsView(bad,expected));}
  for(const bad of[{sessions:[],hasMore:false},{...expected,owner:"PRIVATE"},{sessions:[{isCurrent:true,createdAt:"PRIVATE",refreshedAt:null}],hasMore:false}])assert.throws(()=>acceptAdminOwnSessionsView(bad,bad));
  const denial={ok:false,code:"SESSION_CHANGED",message:"Sua sessão mudou. Entre novamente."};assert.equal(acceptsAdminOwnSessionsChanged(409,denial),true);
  for(const [status,value]of[[200,denial],[401,denial],[409,{...denial,ok:true}],[409,{...denial,code:"FORBIDDEN"}],[409,{...denial,owner:randomUUID()}],[409,{...denial,message:"PRIVATE"}]])assert.equal(acceptsAdminOwnSessionsChanged(status,value),false);
});

test("own-session browser and Next permits allow only the fixed read, preserving cookie ownership and independent counters",async()=>{
  const path="/api/settings/sessions",owner=randomUUID();assert.equal(acceptAdminBrowserRequest(ADMIN_BROWSER_APP+path,"GET"),true);
  for(const[url,method]of[[ADMIN_BROWSER_APP+path+"?","GET"],[ADMIN_BROWSER_APP+path+"?user_id="+owner,"GET"],[ADMIN_BROWSER_APP+path+"#","GET"],[ADMIN_BROWSER_APP+path,"POST"],["http://localhost:3117"+path,"GET"],["https://foreign.invalid"+path,"GET"]])assert.equal(acceptAdminBrowserRequest(url,method),false);
  let calls=0;const state=createAdminBrowserState("FIRST_FORCED_BROWSER"),io=createAdminBrowserNextTransport(state,async(url,init)=>{
    calls++;assert.equal(url,ADMIN_BROWSER_APP+path);assert.equal(init.method,"GET");assert.equal(init.body,undefined);assert.equal(init.headers["X-Expected-User-ID"],owner);assert.equal(init.headers.Cookie,"sc-auth=synthetic-cookie");assert.equal(init.headers.apikey,undefined);assert.equal(init.headers.Authorization,undefined);assert.equal(init.credentials,"omit");return Response.json({sessions:[{isCurrent:true,createdAt:null,refreshedAt:null}],hasMore:false});
  });
  const request={path,method:"GET",body:null,userId:owner,cookies:[{name:"sc-auth",value:"synthetic-cookie"}]};
  for(const patch of[{path:path+"?user_id="+owner},{method:"POST",body:{}},{body:{}},{cookies:[{name:"sc-auth",value:"x; owner=foreign"}]}])await assert.rejects(io.request({...request,...patch}));
  assert.equal(calls,0);const received=await io.request(request);received.bytes.fill(0);assert.equal(calls,1);assert.equal(io.metadata().pending,0);assert.equal(state.value.counts.nextProbeRequests,1);assert.equal(state.value.counts.ownedSdkRequests,0);assert.equal(state.value.counts.ownSessionsRpc,0);io.close();
});
test("pending HTTP classification depends on existing permission and observed GET resource metadata, never query contents",()=>{
  for(const[path,type,kind]of[["/_next/static/chunk.js?v=1791705600000","script","ASSET"],["/ajuda?_rsc=finite","fetch","FETCH"],["/ajuda","xhr","FETCH"],["/api/calendar","fetch","API"],["/ajuda","document","DOCUMENT"],["/entrar?returnTo=%2Fajuda","document","AUTH"],["/ajuda","eventsource","OTHER"]]){
    const url=ADMIN_BROWSER_APP+path,allowed=acceptAdminBrowserRequest(url,"GET");assert.equal(allowed,true);assert.equal(classifyAdminBrowserHttpRequest(url,"GET",type,allowed),kind);
  }
  assert.equal(classifyAdminBrowserHttpRequest(ADMIN_BROWSER_APP+"/ajuda?_rsc=first","GET","fetch",true),classifyAdminBrowserHttpRequest(ADMIN_BROWSER_APP+"/ajuda?_rsc=PRIVATE_CANARY","GET","fetch",true));
  for(const[url,method,type,allowed]of[[ADMIN_BROWSER_APP+"/api/calendar","POST","fetch",true],[ADMIN_BROWSER_APP+"/api/calendar","GET","fetch",false],["https://foreign.invalid/ajuda","GET","document",true],["not a URL","GET","document",true],[ADMIN_BROWSER_APP+"/ajuda","GET","fetch","true"]])assert.equal(classifyAdminBrowserHttpRequest(url,method,type,allowed),"OTHER");
  let invoked=0;const privateValue={toString(){invoked++;throw Error("PRIVATE_CANARY");}};assert.equal(classifyAdminBrowserHttpRequest(privateValue,"GET","fetch",true),"OTHER");assert.equal(classifyAdminBrowserHttpRequest(ADMIN_BROWSER_APP+"/ajuda","GET",privateValue,true),"OTHER");assert.equal(invoked,0);
});
test("HTTP timeout diagnostics contain only twelve observed class/response codes or mixed, rejecting private/accessor snapshots",()=>{
  assert.equal(ADMIN_HTTP_PENDING_CODES.length,13);
  for(const httpClass of ADMIN_HTTP_PENDING_CLASSES)for(const responseSeen of[false,true]){const code=adminBrowserHttpPendingCode([{httpClass,responseSeen},{httpClass,responseSeen}]);assert.equal(code,`QUIESCENCE_HTTP_${httpClass}_${responseSeen?"RESPONSE":"NO_RESPONSE"}_PENDING`);assert.equal(ADMIN_HTTP_PENDING_CODES.includes(code),true);}
  for(const rows of[[{httpClass:"FETCH",responseSeen:false},{httpClass:"ASSET",responseSeen:false}],[{httpClass:"ASSET",responseSeen:true},{httpClass:"ASSET",responseSeen:false}]])assert.equal(adminBrowserHttpPendingCode(rows),"QUIESCENCE_HTTP_DETAILS_MIXED_PENDING");
  assert.equal(adminBrowserHttpPendingCode([]),"QUIESCENCE_HTTP_PENDING");
  let getters=0;for(const rows of[[{httpClass:"PRIVATE_CANARY",responseSeen:false}],[{httpClass:"FETCH",responseSeen:1}],[{httpClass:"FETCH",responseSeen:false,url:"PRIVATE_CANARY"}],[Object.defineProperty({httpClass:"FETCH"},"responseSeen",{enumerable:true,get(){getters++;throw Error("PRIVATE_CANARY");}})],Array.from({length:1025},()=>({httpClass:"FETCH",responseSeen:false}))])assert.throws(()=>adminBrowserHttpPendingCode(rows));assert.equal(getters,0);
});
test("response-phase diagnostics never replace first failure, uncertainty or a timed-out request after its late terminal event",()=>{
  const failed=createAdminBrowserState("BLOCK_LIVE_BROWSER");failed.fail("AUTH_NOT_PROVEN");failed.unknown();failed.fail(adminBrowserHttpPendingCode([{httpClass:"FETCH",responseSeen:true}]));const original=failed.finish(1,0);assert.equal(original.code,"AUTH_NOT_PROVEN");assert.equal(original.writeOutcomeUncertain,true);assert.equal(original.pendingRequests,1);
  for(const code of ADMIN_HTTP_PENDING_CODES){const state=createAdminBrowserState("BLOCK_LIVE_BROWSER");state.fail(code);const late=state.finish(0,0);assert.equal(late.status,"failed");assert.equal(late.code,code);assert.throws(()=>validateAdminBrowserCase({...late,status:"passed"}));}
  assert.equal(adminBrowserPendingCode({ui:1,hmrGet:0,otherHttp:1}),"QUIESCENCE_MIXED_PENDING");assert.equal(adminBrowserPendingCode({ui:0,hmrGet:1,otherHttp:0}),"QUIESCENCE_HMR_GET_PENDING");
});
test("page release may interrupt only exact declared GET reads and never auth verification, logout or writes",()=>{
  for(const path of["/ajuda","/ajuda?_rsc=finite","/api/calendar","/_next/webpack-hmr","/_next/static/chunk.js?v=1791705600000"])assert.equal(isAdminBrowserReadCancellationRequest(ADMIN_BROWSER_APP+path,"GET"),true);
  for(const[url,method]of[[ADMIN_BROWSER_APP+"/entrar?returnTo=%2Fajuda","POST"],[ADMIN_BROWSER_APP+"/api/monitoring","POST"],[ADMIN_BROWSER_APP+"/sair","GET"],[ADMIN_BROWSER_APP+"/auth/callback?state=private","GET"],[ADMIN_BROWSER_API+"/auth/v1/verify?token=private","GET"],[ADMIN_BROWSER_APP+"/auth/v1/verify","GET"],[ADMIN_BROWSER_APP+"/ajuda#","GET"],[ADMIN_BROWSER_APP+"/ajuda?","GET"],["http://user@127.0.0.1:3117/ajuda","GET"],["https://foreign.invalid/ajuda","GET"],[ADMIN_BROWSER_APP+"/ajuda","get"]])assert.equal(isAdminBrowserReadCancellationRequest(url,method),false);
  let got=0;assert.equal(isAdminBrowserReadCancellationRequest({toString(){got++;return ADMIN_BROWSER_APP+"/ajuda";}},"GET"),false);assert.equal(got,0);
});
test("release barriers preserve live SDK/SQL/UI operations, unsafe requests and prior uncertainty",async()=>{
  const settled={ui:0,sdk:0,sql:0,nonRead:0,unknown:false};assert.equal(adminBrowserPageReleaseCode(settled),null);
  for(const[patch,code]of[[{ui:1},"QUIESCENCE_UI_PENDING"],[{sdk:1},"PROCESS_UNCONFIRMED"],[{sql:1},"PROCESS_UNCONFIRMED"],[{nonRead:1},"WRITE_OUTCOME_UNCERTAIN"],[{unknown:true},"WRITE_OUTCOME_UNCERTAIN"]])assert.equal(adminBrowserPageReleaseCode({...settled,...patch}),code);
  let finish;const owners=new Set(),operation=new Promise(resolve=>{finish=resolve;}),owned=operation.finally(()=>owners.delete(owned));owners.add(owned);let released=0;
  if(adminBrowserPageReleaseCode({...settled,sdk:owners.size})===null)released++;
  assert.equal(released,0);assert.equal(owners.size,1);finish();await owned;
  if(adminBrowserPageReleaseCode({...settled,sdk:owners.size})===null)released++;
  assert.equal(released,1);assert.equal(owners.size,0);
  let getters=0;for(const input of[{...settled,ui:-1},{...settled,sdk:0.5},{...settled,unknown:"false"},{...settled,url:"PRIVATE"},Object.defineProperty({...settled},"nonRead",{enumerable:true,get(){getters++;throw Error("PRIVATE");}})])assert.throws(()=>adminBrowserPageReleaseCode(input));assert.equal(getters,0);
});
test("synthetic navigation ACK cannot replace actual request terminal events while listeners stay active",async()=>{
  const events=new EventEmitter(),reads=new Set(["owned-read"]),operations=new Set();let finishedNavigation,contextsOpen=true,now=0;
  events.on("requestfailed",id=>{assert.equal(contextsOpen,true);reads.delete(id);});
  const navigation=new Promise(resolve=>{finishedNavigation=resolve;}),owned=navigation.finally(()=>operations.delete(owned));operations.add(owned);
  assert.equal(adminBrowserPageReleaseCode({ui:operations.size,sdk:0,sql:0,nonRead:0,unknown:false}),"QUIESCENCE_UI_PENDING");
  finishedNavigation();await owned;assert.equal(operations.size,0);assert.equal(reads.size,1);
  const result=await waitForAdminBrowserIoQuiet(()=>({ui:operations.size,hmrGet:0,otherHttp:reads.size}),{timeoutMs:100,now:()=>now,pause:async ms=>{now+=ms;events.emit("requestfailed","owned-read");}});
  assert.equal(result,null);assert.equal(reads.size,0);contextsOpen=false;
});
test("release refusal and late terminal events never clear first failure or restore cleanup authority",async()=>{
  const state=createAdminBrowserState("BLOCK_LIVE_BROWSER"),requests=new Set(["owned-non-read"]),events=new EventEmitter();events.on("requestfinished",id=>requests.delete(id));state.fail("AUTH_NOT_PROVEN");state.unknown();
  const code=adminBrowserPageReleaseCode({ui:0,sdk:0,sql:0,nonRead:requests.size,unknown:state.value.writeOutcomeUncertain});state.fail(code);assert.equal(requests.size,1);events.emit("requestfinished","owned-non-read");
  const report=state.finish(requests.size,0);assert.equal(report.code,"AUTH_NOT_PROVEN");assert.equal(report.writeOutcomeUncertain,true);assert.equal(report.status,"failed");assert.throws(()=>validateAdminBrowserCase({...report,status:"passed",code:"PASSED"}));
});

test("HTTP drain waits for actual asset terminal events and keeps exact HMR registered for the full check",async()=>{
  const events=new EventEmitter(),requests=new Map([["asset","otherHttp"],["hmr","hmrGet"]]);let now=0,contextsOpen=true,parks=0;
  events.on("requestfinished",id=>{assert.equal(contextsOpen,true);requests.delete(id);});events.on("requestfailed",id=>{assert.equal(contextsOpen,true);requests.delete(id);});
  const read=()=>({ui:0,hmrGet:[...requests.values()].filter(k=>k==="hmrGet").length,otherHttp:[...requests.values()].filter(k=>k==="otherHttp").length});
  const deadlineMs=100;
  assert.equal(await waitForAdminBrowserHttpQuiet(read,{deadlineMs,timeoutMs:100,now:()=>now,pause:async ms=>{assert.equal(parks,0);assert.equal(requests.has("asset"),true);now+=ms;events.emit("requestfinished","asset");}}),null);
  assert.equal(requests.size,1);assert.equal(requests.has("hmr"),true);assert.equal(adminBrowserPendingCode(read()),"QUIESCENCE_HMR_GET_PENDING");
  parks++;now+=10;
  assert.equal(await waitForAdminBrowserIoQuiet(read,{deadlineMs,timeoutMs:100,now:()=>now,pause:async ms=>{now+=ms;events.emit("requestfailed","hmr");}}),null);
  assert.equal(requests.size,0);assert.equal(now,60);contextsOpen=false;
});

test("one absolute quiet deadline is shared across HTTP drain and parking without a renewed HMR wait",async()=>{
  const requests=new Set(["asset","hmr"]);let now=0,postWait=0;
  const read=()=>({ui:0,hmrGet:Number(requests.has("hmr")),otherHttp:Number(requests.has("asset"))}),deadlineMs=100;
  assert.equal(await waitForAdminBrowserHttpQuiet(read,{deadlineMs,timeoutMs:100,now:()=>now,pause:async ms=>{now+=ms;requests.delete("asset");}}),null);
  assert.equal(now,25);now+=50;
  assert.equal(await waitForAdminBrowserIoQuiet(read,{deadlineMs,timeoutMs:100,now:()=>now,pause:async ms=>{postWait+=ms;now+=ms;}}),"QUIESCENCE_HMR_GET_PENDING");
  assert.equal(postWait,25);assert.equal(now,deadlineMs);assert.equal(requests.has("hmr"),true);
});

test("HTTP timeout prevents parking and its late terminal event never restores PASS or clears the first diagnostic",async()=>{
  const requests=new Set(["asset"]),events=new EventEmitter(),state=createAdminBrowserState("BLOCK_LIVE_BROWSER");let now=0,parks=0;
  events.on("requestfailed",id=>requests.delete(id));
  const failure=await waitForAdminBrowserHttpQuiet(()=>({ui:0,hmrGet:0,otherHttp:requests.size}),{deadlineMs:30,timeoutMs:30,now:()=>now,pause:async ms=>{now+=ms;}});
  if(failure===null)parks++;else state.fail(adminBrowserHttpPendingCode([{httpClass:"ASSET",responseSeen:false}]));
  assert.equal(failure,"QUIESCENCE_HTTP_PENDING");assert.equal(parks,0);assert.equal(requests.size,1);assert.equal(state.value.writeOutcomeUncertain,false);
  events.emit("requestfailed","asset");const result=state.finish(requests.size,0);assert.equal(result.code,"QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING");assert.equal(result.status,"failed");assert.throws(()=>validateAdminBrowserCase({...result,status:"passed",code:"PASSED"}));
});

test("HTTP projection validates even excluded HMR and refuses private or renewed deadline options",async()=>{
  let getters=0,reads=0,pauses=0;
  const read=()=>{reads++;return{ui:0,hmrGet:1,otherHttp:1};};
  for(const deadlineMs of[Infinity,NaN,15001,"100",false,undefined])await assert.rejects(waitForAdminBrowserHttpQuiet(read,{deadlineMs,now:()=>0}),{message:"PROCESS_UNCONFIRMED"});assert.equal(reads,0);
  await assert.rejects(waitForAdminBrowserHttpQuiet(read,Object.defineProperty({now:()=>0},"deadlineMs",{enumerable:true,get(){getters++;throw Error("PRIVATE");}})),{message:"PROCESS_UNCONFIRMED"});
  for(const snapshot of[{ui:0,hmrGet:-1,otherHttp:0},{ui:0,hmrGet:1025,otherHttp:0},Object.defineProperty({ui:0,otherHttp:0},"hmrGet",{enumerable:true,get(){getters++;throw Error("PRIVATE");}})])await assert.rejects(waitForAdminBrowserHttpQuiet(()=>snapshot),{message:"PROCESS_UNCONFIRMED"});assert.equal(getters,0);
  const candidate=ADMIN_BROWSER_APP+"/_next/webpack-hmr?foreign=1";assert.equal(isAdminCanonicalHmrGet(candidate,"GET"),false);
  assert.equal(await waitForAdminBrowserHttpQuiet(()=>({ui:0,hmrGet:0,otherHttp:1}),{deadlineMs:0,now:()=>1,pause:async()=>{pauses++;}}),"QUIESCENCE_HTTP_PENDING");assert.equal(pauses,0);
});

test("a new non-read operation during HTTP drain keeps unknown even after its terminal event and blocks parking",async()=>{
  const state=createAdminBrowserState("BLOCK_LIVE_BROWSER"),requests=new Set(["asset"]),nonRead=new Set(),events=new EventEmitter();let now=0,parks=0;
  events.on("request",id=>{requests.add(id);nonRead.add(id);state.unknown();});events.on("requestfinished",id=>{requests.delete(id);nonRead.delete(id);});
  assert.equal(await waitForAdminBrowserHttpQuiet(()=>({ui:0,hmrGet:0,otherHttp:requests.size}),{deadlineMs:100,timeoutMs:100,now:()=>now,pause:async ms=>{now+=ms;events.emit("request","write");events.emit("requestfinished","asset");events.emit("requestfinished","write");}}),null);
  assert.equal(requests.size,0);assert.equal(nonRead.size,0);
  const barrier=adminBrowserPageReleaseCode({ui:0,sdk:0,sql:0,nonRead:nonRead.size,unknown:state.value.writeOutcomeUncertain});if(barrier===null)parks++;else state.fail(barrier);
  assert.equal(barrier,"WRITE_OUTCOME_UNCERTAIN");assert.equal(parks,0);assert.equal(state.finish(0,0).writeOutcomeUncertain,true);assert.equal(state.value.status,"failed");
});
test("pre-parking Auth permit composes the existing canonical read gate for exactly two authorized GET documents",()=>{
  for(const path of["/entrar","/entrar?returnTo=%2Fajuda","/entrar?notice=session-required&_rsc=finite","/trocar-senha","/trocar-senha?_rsc=finite"]){
    const url=ADMIN_BROWSER_APP+path;assert.equal(isAdminBrowserParkableAuthRead(url,"GET",acceptAdminBrowserRequest(url,"GET")),true);
  }
  for(const[url,method,authorized]of[
    [ADMIN_BROWSER_APP+"/entrar","POST",true],[ADMIN_BROWSER_APP+"/trocar-senha","POST",true],
    [ADMIN_BROWSER_APP+"/sair","GET",true],[ADMIN_BROWSER_APP+"/auth/callback?state=private","GET",true],
    [ADMIN_BROWSER_API+"/auth/v1/verify?token=private","GET",true],[ADMIN_BROWSER_API+"/auth/v1/user","GET",true],
    [ADMIN_BROWSER_APP+"/ajuda","GET",true],[ADMIN_BROWSER_APP+"/api/calendar","GET",true],
    [ADMIN_BROWSER_APP+"/entrar?private=1","GET",true],[ADMIN_BROWSER_APP+"/entrar?_rsc=a&_rsc=b","GET",true],
    [ADMIN_BROWSER_APP+"/entrar?returnTo=https%3A%2F%2Fforeign.invalid","GET",true],
    [ADMIN_BROWSER_APP+"/entrar?","GET",true],[ADMIN_BROWSER_APP+"/entrar#","GET",true],
    ["http://user@127.0.0.1:3117/entrar","GET",true],["https://foreign.invalid/entrar","GET",true],
    [ADMIN_BROWSER_APP+"/entrar","GET",false],[ADMIN_BROWSER_APP+"/entrar","GET","true"],
    [ADMIN_BROWSER_APP+"/entrar","get",true],
  ])assert.equal(isAdminBrowserParkableAuthRead(url,method,authorized),false);
  let reads=0;assert.equal(isAdminBrowserParkableAuthRead({toString(){reads++;return ADMIN_BROWSER_APP+"/entrar";}},"GET",true),false);assert.equal(reads,0);
});

test("a parkable Auth read stays registered after pre-drain and full quiet requires its actual terminal event",async()=>{
  const events=new EventEmitter(),requests=new Map([["auth",{kind:"otherHttp",parkableAuthRead:isAdminBrowserParkableAuthRead(ADMIN_BROWSER_APP+"/entrar?_rsc=finite","GET",true)}],["hmr",{kind:"hmrGet",parkableAuthRead:false}]]);
  events.on("requestfinished",id=>requests.delete(id));events.on("requestfailed",id=>requests.delete(id));
  let now=0;
  const full=()=>({ui:0,hmrGet:[...requests.values()].filter(r=>r.kind==="hmrGet").length,otherHttp:[...requests.values()].filter(r=>r.kind==="otherHttp").length});
  const pre=()=>adminBrowserPreParkPending({...full(),parkableAuthRead:[...requests.values()].filter(r=>r.kind==="otherHttp"&&r.parkableAuthRead).length});
  assert.equal(await waitForAdminBrowserHttpQuiet(pre,{deadlineMs:100,timeoutMs:100,now:()=>now}),null);
  assert.equal(requests.size,2);assert.equal(adminBrowserPendingCode(full()),"QUIESCENCE_MIXED_PENDING");
  assert.equal(await waitForAdminBrowserIoQuiet(full,{deadlineMs:100,timeoutMs:100,now:()=>now,pause:async ms=>{now+=ms;}}),"QUIESCENCE_MIXED_PENDING");assert.equal(requests.size,2);
  const state=createAdminBrowserState("BLOCK_LIVE_BROWSER");state.fail("QUIESCENCE_MIXED_PENDING");
  events.emit("requestfinished","auth");assert.equal(requests.size,1);events.emit("requestfailed","hmr");assert.equal(requests.size,0);
  assert.equal(await waitForAdminBrowserIoQuiet(full,{deadlineMs:100,timeoutMs:100,now:()=>now}),null);
  const result=state.finish(0,0);assert.equal(result.code,"QUIESCENCE_MIXED_PENDING");assert.equal(result.status,"failed");
});

test("pre-parking projection refuses invalid excluded counts and private snapshots before ignoring anything",()=>{
  const input={ui:0,hmrGet:1,otherHttp:2,parkableAuthRead:1},copy=structuredClone(input);
  assert.deepEqual(adminBrowserPreParkPending(input),{ui:0,hmrGet:0,otherHttp:1});assert.deepEqual(input,copy);
  for(const value of[{...input,parkableAuthRead:3},{...input,parkableAuthRead:-1},{...input,parkableAuthRead:true},{...input,hmrGet:1025},{...input,ui:-1},{...input,url:"PRIVATE"}])assert.throws(()=>adminBrowserPreParkPending(value),{message:"PROCESS_UNCONFIRMED"});
  assert.throws(()=>adminBrowserPreParkPending({...input,parkableAuthRead:0.5}),{message:"REPORT_REFUSED"});
  let reads=0;assert.throws(()=>adminBrowserPreParkPending(Object.defineProperty({ui:0,hmrGet:0,otherHttp:1},"parkableAuthRead",{enumerable:true,get(){reads++;throw Error("PRIVATE");}})),{message:"REPORT_REFUSED"});assert.equal(reads,0);
});

test("a late unsafe operation remains uncertain after settlement even when only a parkable Auth read remains",async()=>{
  const state=createAdminBrowserState("BLOCK_LIVE_BROWSER"),events=new EventEmitter(),requests=new Set(["auth"]),nonRead=new Set();let now=0;
  events.on("request",id=>{requests.add(id);nonRead.add(id);state.unknown();});events.on("requestfinished",id=>{requests.delete(id);nonRead.delete(id);});
  const pre=()=>adminBrowserPreParkPending({ui:0,hmrGet:0,otherHttp:requests.size,parkableAuthRead:Number(requests.has("auth"))});
  // An ordinary owned HTTP keeps the pre-drain active when the write begins.
  requests.add("asset");
  assert.equal(await waitForAdminBrowserHttpQuiet(pre,{deadlineMs:100,timeoutMs:100,now:()=>now,pause:async ms=>{now+=ms;events.emit("request","write");events.emit("requestfinished","asset");events.emit("requestfinished","write");}}),null);
  assert.equal(requests.has("auth"),true);assert.equal(nonRead.size,0);
  const barrier=adminBrowserPageReleaseCode({ui:0,sdk:0,sql:0,nonRead:0,unknown:state.value.writeOutcomeUncertain});assert.equal(barrier,"WRITE_OUTCOME_UNCERTAIN");state.fail(barrier);
  events.emit("requestfinished","auth");const result=state.finish(0,0);assert.equal(result.writeOutcomeUncertain,true);assert.equal(result.code,"WRITE_OUTCOME_UNCERTAIN");assert.equal(result.status,"failed");
});
test("parkable static reads require the existing canonical permit and cannot derive authority from an asset class",()=>{
  for(const path of["/_next/static/chunk.js","/_next/static/css/app.css?v=1791705600000","/_next/static/chunks/app/[id]/page.js","/favicon.ico"]){
    const url=ADMIN_BROWSER_APP+path,authorized=acceptAdminBrowserRequest(url,"GET");
    assert.equal(authorized,true);assert.equal(isAdminBrowserParkableAssetRead(url,"GET",authorized),true);
    assert.equal(isAdminBrowserParkableAuthRead(url,"GET",authorized),false);
  }
  for(const[url,method,authorized]of[
    [ADMIN_BROWSER_APP+"/_next/static/chunk.js","POST",true],
    [ADMIN_BROWSER_APP+"/_next/static/chunk.js","GET",false],
    [ADMIN_BROWSER_APP+"/_next/static/chunk.js","GET","true"],
    [ADMIN_BROWSER_APP+"/_next/static/chunk.js","get",true],
    [ADMIN_BROWSER_APP+"/_next/static/chunk.js?v=1","GET",true],
    [ADMIN_BROWSER_APP+"/_next/static/chunk.js?v=1791705600000&v=1791705600001","GET",true],
    [ADMIN_BROWSER_APP+"/_next/static/chunk.js?_rsc=finite","GET",true],
    [ADMIN_BROWSER_APP+"/_next/static/%2fchunk.js","GET",true],
    [ADMIN_BROWSER_APP+"/_next/static/%5cchunk.js","GET",true],
    [ADMIN_BROWSER_APP+"/_next/static/%00chunk.js","GET",true],
    [ADMIN_BROWSER_APP+"/_next/static/%2e%2e/chunk.js","GET",true],
    [ADMIN_BROWSER_APP+"/_next/static/chunk.js?","GET",true],
    [ADMIN_BROWSER_APP+"/_next/static/chunk.js#","GET",true],
    [ADMIN_BROWSER_APP+"/favicon.ico?v=1791705600000","GET",true],
    [ADMIN_BROWSER_APP+"/_next/webpack-hmr","GET",true],
    [ADMIN_BROWSER_APP+"/entrar","GET",true],
    [ADMIN_BROWSER_APP+"/trocar-senha","GET",true],
    [ADMIN_BROWSER_APP+"/sair","GET",true],
    [ADMIN_BROWSER_APP+"/auth/callback?state=synthetic","GET",true],
    [ADMIN_BROWSER_API+"/auth/v1/verify?token=synthetic","GET",true],
    [ADMIN_BROWSER_APP+"/api/calendar","GET",true],
    [ADMIN_BROWSER_APP+"/ajuda?_rsc=finite","GET",true],
    ["http://localhost:3117/_next/static/chunk.js","GET",true],
    ["http://user@127.0.0.1:3117/_next/static/chunk.js","GET",true],
    ["https://foreign.invalid/_next/static/chunk.js","GET",true],
  ])assert.equal(isAdminBrowserParkableAssetRead(url,method,authorized),false);
  assert.equal(classifyAdminBrowserHttpRequest(ADMIN_BROWSER_APP+"/ajuda","GET","script",true),"ASSET");
  assert.equal(isAdminBrowserParkableAssetRead(ADMIN_BROWSER_APP+"/ajuda","GET",true),false);
  let reads=0;assert.equal(isAdminBrowserParkableAssetRead({toString(){reads++;throw Error("PRIVATE");}},"GET",true),false);assert.equal(reads,0);
});

test("static terminal events remain mandatory after pre-parking and parking ACK alone never releases full quiet",async()=>{
  const events=new EventEmitter(),requests=new Map();
  events.on("request",(id,url)=>requests.set(id,{auth:isAdminBrowserParkableAuthRead(url,"GET",true),asset:isAdminBrowserParkableAssetRead(url,"GET",true)}));
  events.on("requestfinished",id=>requests.delete(id));events.on("requestfailed",id=>requests.delete(id));
  events.emit("request","script",ADMIN_BROWSER_APP+"/_next/static/chunk.js");events.emit("request","icon",ADMIN_BROWSER_APP+"/favicon.ico");events.emit("request","auth",ADMIN_BROWSER_APP+"/entrar");
  const full=()=>({ui:0,hmrGet:0,otherHttp:requests.size}),pre=()=>adminBrowserPreParkReadPending({...full(),parkableAuthRead:[...requests.values()].filter(r=>r.auth).length,parkableAssetRead:[...requests.values()].filter(r=>!r.auth&&r.asset).length});
  let now=0;
  assert.equal(await waitForAdminBrowserHttpQuiet(pre,{deadlineMs:100,timeoutMs:100,now:()=>now}),null);assert.equal(requests.size,3);
  await Promise.resolve(); // A navigation acknowledgement carries no terminal request event.
  assert.equal(adminBrowserPendingCode(full()),"QUIESCENCE_HTTP_PENDING");assert.equal(requests.size,3);
  assert.equal(await waitForAdminBrowserIoQuiet(full,{deadlineMs:100,timeoutMs:100,now:()=>now,pause:async ms=>{now+=ms;events.emit("requestfinished","script");events.emit("requestfailed","icon");events.emit("requestfinished","auth");}}),null);
  assert.equal(requests.size,0);assert.equal(now,25);
  events.emit("request","late",ADMIN_BROWSER_APP+"/_next/static/late.js");const state=createAdminBrowserState("BLOCK_LIVE_BROWSER");
  assert.equal(await waitForAdminBrowserHttpQuiet(pre,{deadlineMs:100,timeoutMs:100,now:()=>now}),null);
  const failure=await waitForAdminBrowserIoQuiet(full,{deadlineMs:100,timeoutMs:100,now:()=>now,pause:async ms=>{now+=ms;}});
  assert.equal(failure,"QUIESCENCE_HTTP_PENDING");state.fail(failure);assert.equal(now,100);assert.equal(requests.size,1);
  events.emit("requestfailed","late");assert.equal(adminBrowserPendingCode(full()),null);assert.equal(state.finish(0,0).code,failure);
});

test("asset/Auth projection refuses overlapping counts and closed-shape violations without changing the original snapshot",()=>{
  const input={ui:0,hmrGet:1,otherHttp:3,parkableAuthRead:1,parkableAssetRead:1},copy=structuredClone(input);
  assert.deepEqual(adminBrowserPreParkReadPending(input),{ui:0,hmrGet:0,otherHttp:1});assert.deepEqual(input,copy);
  assert.deepEqual(adminBrowserPreParkPending({ui:0,hmrGet:1,otherHttp:3,parkableAuthRead:1}),{ui:0,hmrGet:0,otherHttp:2});
  for(const value of[{...input,parkableAssetRead:3},{...input,parkableAssetRead:-1},{...input,parkableAssetRead:true},{...input,parkableAuthRead:4},{...input,hmrGet:1025},{...input,ui:-1},{...input,assetUrl:"PRIVATE"},{ui:0,hmrGet:1,otherHttp:3,parkableAuthRead:1}])assert.throws(()=>adminBrowserPreParkReadPending(value),{message:"PROCESS_UNCONFIRMED"});
  assert.throws(()=>adminBrowserPreParkReadPending({...input,parkableAssetRead:0.5}),{message:"REPORT_REFUSED"});
  let reads=0;assert.throws(()=>adminBrowserPreParkReadPending(Object.defineProperty({ui:0,hmrGet:0,otherHttp:1,parkableAuthRead:0},"parkableAssetRead",{enumerable:true,get(){reads++;throw Error("PRIVATE");}})),{message:"REPORT_REFUSED"});assert.equal(reads,0);
});

test("asset pre-parking cannot normalize a late failed POST or clear its first failure and uncertainty",async()=>{
  const state=createAdminBrowserState("BLOCK_LIVE_BROWSER"),events=new EventEmitter(),requests=new Map(),nonRead=new Set();
  events.on("request",(id,url,method)=>{requests.set(id,{auth:isAdminBrowserParkableAuthRead(url,method,true),asset:isAdminBrowserParkableAssetRead(url,method,true)});if(!isAdminBrowserReadCancellationRequest(url,method)){nonRead.add(id);state.unknown();state.fail("WRITE_OUTCOME_UNCERTAIN");}});
  events.on("requestfailed",(id,method)=>{requests.delete(id);nonRead.delete(id);if(method==="POST"){state.unknown();state.fail("TRANSPORT_FAILED");}});events.on("requestfinished",id=>{requests.delete(id);nonRead.delete(id);});
  const pre=()=>adminBrowserPreParkReadPending({ui:0,hmrGet:0,otherHttp:requests.size,parkableAuthRead:[...requests.values()].filter(r=>r.auth).length,parkableAssetRead:[...requests.values()].filter(r=>!r.auth&&r.asset).length});
  events.emit("request","asset",ADMIN_BROWSER_APP+"/_next/static/chunk.js","GET");assert.equal(adminBrowserPendingCode(pre()),null);
  events.emit("request","write",ADMIN_BROWSER_APP+"/redefinir-senha","POST");assert.equal(adminBrowserPendingCode(pre()),"QUIESCENCE_HTTP_PENDING");assert.equal(nonRead.size,1);
  events.emit("requestfailed","write","POST");assert.equal(nonRead.size,0);assert.equal(adminBrowserPendingCode(pre()),null);assert.equal(requests.size,1);
  assert.equal(adminBrowserPageReleaseCode({ui:0,sdk:0,sql:0,nonRead:0,unknown:state.value.writeOutcomeUncertain}),"WRITE_OUTCOME_UNCERTAIN");
  events.emit("requestfinished","asset");const result=state.finish(0,0);assert.equal(result.code,"WRITE_OUTCOME_UNCERTAIN");assert.equal(result.writeOutcomeUncertain,true);assert.equal(result.status,"failed");
});

const slot=(extra={})=>({url:ADMIN_BROWSER_API+"/auth/v1/user",method:"GET",key:"synthetic-key",token:"synthetic-token",check:noBody,...extra});
const init=extra=>({method:"GET",headers:{apikey:"synthetic-key",Authorization:"Bearer synthetic-token"},...extra});
function fullCase(kind){const r=structuredClone(blankAdminBrowserCase(kind));r.status="passed";r.code="PASSED";r.stages=ADMIN_BROWSER_STAGES[kind].map(stage=>({stage,passed:true}));Object.assign(r.counts,ADMIN_BROWSER_PASS_COUNTS[kind],{browserRequests:100,ownedSdkRequests:100,sqlInspections:ADMIN_BROWSER_INSPECTION_ORDER[kind].length});return r;}
test("HMR pending classification requires the exact observed canonical GET, never a count-based inference",()=>{
  const exact=ADMIN_BROWSER_APP+"/_next/webpack-hmr";assert.equal(isAdminCanonicalHmrGet(exact,"GET"),true);
  for(const url of[exact+"?",exact+"#","http://user@127.0.0.1:3117/_next/webpack-hmr",exact+"?x=1",ADMIN_BROWSER_APP+"/_next/static/chunk.js","http://localhost:3117/_next/webpack-hmr"])assert.equal(isAdminCanonicalHmrGet(url,"GET"),false);
  for(const method of["POST","PUT","get",null])assert.equal(isAdminCanonicalHmrGet(exact,method),false);
});
test("pending diagnostics contain only four codes and reject private/accessor or invalid snapshots",()=>{
  assert.equal(adminBrowserPendingCode({ui:0,hmrGet:0,otherHttp:0}),null);
  for(const[v,code]of[[{ui:1,hmrGet:0,otherHttp:0},"QUIESCENCE_UI_PENDING"],[{ui:0,hmrGet:1,otherHttp:0},"QUIESCENCE_HMR_GET_PENDING"],[{ui:0,hmrGet:0,otherHttp:1},"QUIESCENCE_HTTP_PENDING"],[{ui:1,hmrGet:1,otherHttp:1},"QUIESCENCE_MIXED_PENDING"]])assert.equal(adminBrowserPendingCode(v),code);
  let getters=0;for(const bad of[{ui:-1,hmrGet:0,otherHttp:0},{ui:0.5,hmrGet:0,otherHttp:0},{ui:0,hmrGet:0,otherHttp:1025},{ui:0,hmrGet:0,otherHttp:0,url:"PRIVATE"},Object.defineProperty({ui:0,hmrGet:0},"otherHttp",{enumerable:true,get(){getters++;throw Error("PRIVATE");}})])assert.throws(()=>adminBrowserPendingCode(bad));
  assert.equal(getters,0);
});
test("quiescence waits for actual action and request terminal events while the context remains open",async()=>{
  const events=new EventEmitter(),requests=new Set(["owned-request"]),ui=new Set(["owned-action"]);let now=0,closed=false,polls=0;
  events.on("requestfinished",key=>requests.delete(key));events.on("actionsettled",key=>ui.delete(key));
  const code=await waitForAdminBrowserIoQuiet(()=>({ui:ui.size,hmrGet:0,otherHttp:requests.size}),{timeoutMs:100,now:()=>now,pause:async ms=>{assert.equal(closed,false);now+=ms;if(++polls===1)events.emit("actionsettled","owned-action");else events.emit("requestfinished","owned-request");}});
  assert.equal(code,null);assert.equal(polls,2);closed=true;assert.equal(requests.size,0);assert.equal(ui.size,0);
});
test("timeout preserves actual pending requests and sticky unknown/failure even after later terminal events",async()=>{
  const requests=new Set(["owned-request"]),events=new EventEmitter();events.on("requestfailed",key=>requests.delete(key));let now=0;
  const state=createAdminBrowserState("BLOCK_LIVE_BROWSER");state.unknown();
  const code=await waitForAdminBrowserIoQuiet(()=>({ui:0,hmrGet:0,otherHttp:requests.size}),{timeoutMs:30,now:()=>now,pause:async ms=>{now+=ms;}});
  assert.equal(code,"QUIESCENCE_HTTP_PENDING");assert.equal(requests.size,1);state.fail(code);assert.equal(state.value.writeOutcomeUncertain,true);events.emit("requestfailed","owned-request");state.fail("PROCESS_UNCONFIRMED");
  assert.equal(state.finish(0,0).code,code);assert.equal(state.value.status,"failed");assert.equal(state.value.writeOutcomeUncertain,true);
});
test("a new real request after quiet is still rejected by the independent post-close check",async()=>{
  const requests=new Set(),events=new EventEmitter();events.on("request",key=>requests.add(key));
  const read=()=>({ui:0,hmrGet:0,otherHttp:requests.size});assert.equal(await waitForAdminBrowserIoQuiet(read),null);
  events.emit("request","late-owned-request");assert.equal(adminBrowserPendingCode(read()),"QUIESCENCE_HTTP_PENDING");assert.equal(requests.size,1);
});
test("quiescence rejects bad clocks, oversized waits, option getters and private provider failures with closed errors",async()=>{
  let reads=0,privateReads=0;const privateError=Object.defineProperty({},"message",{get(){privateReads++;throw Error("PRIVATE");}}),read=()=>{reads++;return{ui:1,hmrGet:0,otherHttp:0};};
  await assert.rejects(waitForAdminBrowserIoQuiet(read,{timeoutMs:15001}),{message:"PROCESS_UNCONFIRMED"});assert.equal(reads,0);
  await assert.rejects(waitForAdminBrowserIoQuiet(()=>{throw privateError;}),{message:"PROCESS_UNCONFIRMED"});
  const options=Object.defineProperty({},"now",{enumerable:true,get(){privateReads++;throw privateError;}});await assert.rejects(waitForAdminBrowserIoQuiet(read,options),{message:"PROCESS_UNCONFIRMED"});
  let now=10;await assert.rejects(waitForAdminBrowserIoQuiet(read,{now:()=>now,pause:async()=>{now=9;}}),{message:"PROCESS_UNCONFIRMED"});assert.equal(privateReads,0);
});
test("finite original route catalogue has sixteen pages and twenty-seven APIs, with a separate automatic Calendar GET",()=>{assert.equal(ADMIN_BROWSER_PAGES.length,16);assert.equal(new Set(ADMIN_BROWSER_PAGES).size,16);assert.equal(ADMIN_BROWSER_PROBES.length,27);assert.equal(new Set(ADMIN_BROWSER_PROBES.map(p=>p.method+" "+p.path)).size,27);assert.equal(ADMIN_BROWSER_PROBES.find(p=>p.path==="/api/projects-habits"&&p.method==="POST").body.command,"project.create");});
test("environment requires Linux, both opt-ins, local origins, ownership and distinct Node secrets",()=>{assert.equal(adminBrowserEnvironment(env(ADMIN_BROWSER_CASES[0]),"linux").namespace,namespace);for(const [key,value]of Object.entries({CI:"false",GITHUB_ACTIONS:"false",SC_ADMIN_BROWSER_RUN:"0",APP_URL:"https://foreign.invalid",SUPABASE_URL:"https://rishenjoikgmfubmnfiu.supabase.co",SC_ADMIN_BROWSER_CASE:"OTHER",SC_ADMIN_BROWSER_PROJECT:"foreign",SC_ADMIN_BROWSER_SYSTEM:"1",GITHUB_SHA:"invalid",SUPABASE_SECRET_KEY:"legacy",AUTH_STATE_SECRET:"short",SC_ADMIN_BROWSER_REPORT:"/tmp/admin-browser-case-report.json",GH_TOKEN:"synthetic"})){assert.throws(()=>adminBrowserEnvironment({...env(ADMIN_BROWSER_CASES[0]),[key]:value},"linux"),{message:"ENVIRONMENT_REFUSED"});}assert.throws(()=>adminBrowserEnvironment(env(ADMIN_BROWSER_CASES[0]),"win32"));});
test("request allowlist rejects foreign origins, unknown endpoints and duplicate or capability queries",()=>{for(const [path,method]of [["/ajuda","GET"],["/ajuda?_rsc=abc123","GET"],["/entrar?returnTo=%2Fajuda","GET"],["/entrar?returnTo=%2Fajuda","POST"],["/trocar-senha","POST"],["/_next/static/chunks/app.js","GET"],["/api/calendar","GET"]])assert.equal(acceptAdminBrowserRequest(ADMIN_BROWSER_APP+path,method),true);for(const [url,method]of [["https://foreign.invalid/ajuda","GET"],[ADMIN_BROWSER_APP+"/api/admin","GET"],[ADMIN_BROWSER_APP+"/_next/static/%2e%2e/%2fsecret","GET"],[ADMIN_BROWSER_APP+"/ajuda?_rsc=x&_rsc=y","GET"],[ADMIN_BROWSER_APP+"/entrar?returnTo=https%3A%2F%2Fforeign.invalid","POST"],[ADMIN_BROWSER_APP+"/trocar-senha?capability=secret","POST"],[ADMIN_BROWSER_APP+"/ajuda","DELETE"]])assert.equal(acceptAdminBrowserRequest(url,method),false);});
test("provider/action/DOM errors are replaced by a closed enum without cause, message, ARIA or credentials",async()=>{for(const operation of [async()=>{throw Object.assign(Error("SYNTHETIC_PRIVATE_CANARY"),{matcherResult:{ariaSnapshot:"SYNTHETIC_PRIVATE_CANARY"},cause:Error("SYNTHETIC_PRIVATE_CANARY")});},async()=>{throw "SYNTHETIC_PRIVATE_CANARY";}]){try{await closedBrowserOperation(operation);}catch(e){assert.equal(e.message,"BROWSER_REFUSED");assert.equal(Object.hasOwn(e,"cause"),false);assert.equal(Object.hasOwn(e,"matcherResult"),false);assert.equal(e.stack.includes("CANARY"),false);}}assert.throws(()=>adminBrowserRefuse("SYNTHETIC_PRIVATE_CANARY"),{message:"BROWSER_REFUSED"});});
test("closed report snapshot reads descriptor values once and rejects accessors, hidden fields and symbols",()=>{let reads=0;const r=fullCase(ADMIN_BROWSER_CASES[0]);assert.deepEqual(closedAdminBrowserValue(new Proxy(r,{get(){reads++;throw Error("CANARY");}})),r);assert.equal(reads,0);for(const bad of [Object.defineProperty({...r},"hidden",{value:"CANARY"}),Object.assign({...r},{[Symbol("CANARY")]:1}),Object.defineProperty({...r},"counts",{enumerable:true,get(){reads++;throw Error("CANARY");}})])assert.throws(()=>validateAdminBrowserCase(bad),{message:"REPORT_REFUSED"});assert.equal(reads,0);});
test("native browser case counters, stages and failure projection cannot omit cleanup or pending IO",()=>{for(const kind of ADMIN_BROWSER_CASES){const r=fullCase(kind);assert.deepEqual(validateAdminBrowserCase(r),r);for(const alter of [x=>x.counts.apiProbes++,x=>x.counts.ownedSdkRequests=0,x=>x.counts.cleanupSql=2,x=>x.stages.pop(),x=>x.pendingRequests=1,x=>x.pendingInspections=1,x=>x.writeOutcomeUncertain=true,x=>x.private="CANARY"]){const b=structuredClone(r);alter(b);assert.throws(()=>validateAdminBrowserCase(b),{message:"REPORT_REFUSED"});}}});
test("deadline is sticky even when no active check ran before finish or the injected clock later moves back",()=>{let now=0;const s=createAdminBrowserState(ADMIN_BROWSER_CASES[0],{now:()=>now,deadlineMs:10});now=10;assert.throws(()=>s.active(),{message:"DEADLINE_EXCEEDED"});now=0;assert.throws(()=>s.active(),{message:"DEADLINE_EXCEEDED"});assert.equal(s.finish(0,0).status,"failed");const late=createAdminBrowserState(ADMIN_BROWSER_CASES[0],{now:()=>now,deadlineMs:10});now=11;assert.equal(late.finish(0,0).code,"DEADLINE_EXCEEDED");});
test("request budgets and stage sequence reserve authority before any operation",()=>{const s=createAdminBrowserState(ADMIN_BROWSER_CASES[0]);for(let i=0;i<ADMIN_BROWSER_LIMITS.browserRequests;i++)s.count("browserRequests");assert.throws(()=>s.count("browserRequests"),{message:"REQUEST_REFUSED"});assert.throws(()=>s.count("arbitrary"));assert.throws(()=>s.stage("master-bound"));s.stage("fixtures");s.fail("CANARY");assert.equal(s.finish(0,0).code,"BROWSER_REFUSED");});
test("owned SDK rejects malformed permit, headers, method and body before transport",async()=>{let calls=0;const s=createAdminBrowserState(ADMIN_BROWSER_CASES[0]),t=createAdminBrowserTransport(s,async()=>{calls++;return Response.json({});});assert.throws(()=>t.permit(slot({url:"https://foreign.invalid/user"})));t.permit(slot());await assert.rejects(t.transport(slot().url,init({method:"POST"})),{message:"REQUEST_REFUSED"});assert.equal(calls,0);t.permit(slot({check:()=>false}));await assert.rejects(t.transport(slot().url,init()),{message:"REQUEST_REFUSED"});assert.equal(calls,0);t.close();});
test("response URL is checked before body inspection; write failures remain sticky",async()=>{let readers=0;const r=new Response("CANARY"),getReader=r.body.getReader.bind(r.body);Object.defineProperty(r.body,"getReader",{value:()=>{readers++;return getReader();}});Object.defineProperty(r,"url",{value:ADMIN_BROWSER_API+"/foreign"});const s=createAdminBrowserState(ADMIN_BROWSER_CASES[0]),t=createAdminBrowserTransport(s,async()=>r);t.permit(slot({method:"POST",write:true}));await assert.rejects(t.transport(slot().url,init({method:"POST"})),{message:"TRANSPORT_FAILED"});assert.equal(readers,0);assert.equal(s.value.writeOutcomeUncertain,true);assert.equal(t.metadata().pending,0);assert.equal(s.finish(0,0).status,"failed");});
test("late body retains actual pending slot through settlement and never restores authority",async()=>{let release,now=0;const r=new Response(new ReadableStream({start(c){release=()=>{c.enqueue(new TextEncoder().encode('{}'));c.close();};}}));const s=createAdminBrowserState(ADMIN_BROWSER_CASES[0],{now:()=>now,deadlineMs:10}),t=createAdminBrowserTransport(s,async()=>r);t.permit(slot({method:"POST",write:true}));const request=t.transport(slot().url,init({method:"POST"}));await Promise.resolve();assert.equal(t.metadata().pending,1);now=11;release();await assert.rejects(request);assert.equal(t.metadata().pending,0);assert.equal(s.value.writeOutcomeUncertain,true);assert.equal(s.finish(0,0).status,"failed");});
test("non-JSON/oversize successful writes and lost transport cannot become acknowledgement",async()=>{for(const response of [new Response("CANARY"),new Response("x".repeat(ADMIN_BROWSER_LIMITS.responseBytes+1))]){const s=createAdminBrowserState(ADMIN_BROWSER_CASES[0]),t=createAdminBrowserTransport(s,async()=>response);t.permit(slot({method:"POST",write:true}));await assert.rejects(t.transport(slot().url,init({method:"POST"})));assert.equal(s.value.writeOutcomeUncertain,true);assert.equal(t.metadata().pending,0);}});
test("Next probe channel uses its own closed catalogue, cookie permit and measured counter",async()=>{let calls=0;const state=createAdminBrowserState("FIRST_FORCED_BROWSER"),io=createAdminBrowserNextTransport(state,async(url,init)=>{calls++;assert.equal(url,ADMIN_BROWSER_APP+"/api/settings");assert.equal(init.redirect,"manual");assert.equal(init.headers.Cookie,"sc-auth=synthetic-cookie");return Response.json({ok:false,code:"FORBIDDEN",message:"Synthetic denied."},{status:403});});const request={path:"/api/settings",method:"GET",body:null,userId:randomUUID(),cookies:[{name:"sc-auth",value:"synthetic-cookie"}]};for(const change of [{path:"/api/unknown"},{method:"DELETE"},{cookies:[{name:"sc-auth",value:"bad; injected=yes"}]},{userId:"foreign"},{body:{private:true}}])await assert.rejects(io.request({...request,...change}),{message:"REQUEST_REFUSED"});assert.equal(calls,0);const r=await io.request(request);assert.equal(r.status,403);r.bytes.fill(0);assert.equal(state.value.counts.nextProbeRequests,1);assert.equal(state.value.counts.ownedSdkRequests,0);assert.equal(state.value.counts.browserRequests,0);assert.equal(io.metadata().pending,0);io.close();});
test("Next response URL is bound before body read and late/oversize bodies never release proof early",async()=>{let readers=0;const foreign=new Response("CANARY"),read=foreign.body.getReader.bind(foreign.body);Object.defineProperty(foreign.body,"getReader",{value:()=>{readers++;return read();}});Object.defineProperty(foreign,"url",{value:"https://foreign.invalid"});const input={path:"/api/settings",method:"GET",body:null,cookies:[],userId:randomUUID()},state=createAdminBrowserState("FIRST_FORCED_BROWSER"),io=createAdminBrowserNextTransport(state,async()=>foreign);await assert.rejects(io.request(input));assert.equal(readers,0);assert.equal(io.metadata().pending,0);let release,now=0;const lateState=createAdminBrowserState("FIRST_FORCED_BROWSER",{now:()=>now,deadlineMs:10}),late=createAdminBrowserNextTransport(lateState,async()=>new Response(new ReadableStream({start(c){release=()=>{c.enqueue(new TextEncoder().encode('{}'));c.close();};}})));const promise=late.request({...input,method:"POST",body:{}});await Promise.resolve();assert.equal(late.metadata().pending,1);now=11;release();await assert.rejects(promise);assert.equal(late.metadata().pending,0);assert.equal(lateState.value.writeOutcomeUncertain,true);const oversize=createAdminBrowserNextTransport(createAdminBrowserState("FIRST_FORCED_BROWSER"),async()=>new Response("x".repeat(1048577)));await assert.rejects(oversize.request(input));assert.equal(oversize.metadata().pending,0);});
test("API denial follows the original handler map, including Search403/UNAVAILABLE, never a503 factory error",()=>{assert.equal(acceptsAdminBrowserDenial("/api/settings",403,{ok:false,code:"FORBIDDEN",message:"Synthetic denied."}),true);assert.equal(acceptsAdminBrowserDenial("/api/search?q=prova",403,{code:"UNAVAILABLE",message:"Synthetic denied."}),true);for(const [status,value]of [[503,{ok:false,code:"UNAVAILABLE",message:"Synthetic factory refused."}],[403,{ok:false,code:"VALIDATION",message:"Synthetic denied."}],[403,{ok:true,code:"FORBIDDEN",message:"Synthetic denied."}],[403,{ok:false,code:"FORBIDDEN",message:"Synthetic denied.",private:"CANARY"}]])assert.equal(acceptsAdminBrowserDenial("/api/settings",status,value),false);});
test("fixed metadata inspector binds namespace/source/project and permits no password/token SQL",()=>{const c=context(ADMIN_BROWSER_CASES[0]);const sql=adminBrowserInspectionInput(c,"ACTORS_BOUND");assert.match(sql,/begin read only/);assert.match(sql,/statement_timeout='10s'/);assert.match(sql,/pg_control_system/);assert.match(sql,/rollback;/);assert.doesNotMatch(sql,/encrypted_password|access_token|refresh_token\b|select \*/);for(const change of [{namespace:"foreign"},{sourceSha:"invalid"},{projectId:"foreign"},{systemIdentifier:"1"}])assert.throws(()=>adminBrowserInspectionInput({...c,...change},"ACTORS_BOUND"));assert.throws(()=>adminBrowserInspectionInput(c,"delete private"));});
test("bootstrap has distinct factual one-owner/one-SID and two-owner/three-SID inventories",()=>{const a={id:randomUUID()},b={id:randomUUID()},s=(o)=>({id:o.id,sessionId:randomUUID()});const first=adminBrowserBootstrapInput(context("FIRST_FORCED_BROWSER"),[a],[s(a)]),block=adminBrowserBootstrapInput(context("BLOCK_LIVE_BROWSER"),[a,b],[s(a),s(b),s(b)]);assert.match(first,/count\(\*\) from auth.users\) <> 1/);assert.match(block,/count\(\*\) from auth.sessions\) <> 3/);assert.match(first,/public.bootstrap_master/);assert.doesNotMatch(first,/insert into|update public.user_roles/);assert.throws(()=>adminBrowserBootstrapInput(context("FIRST_FORCED_BROWSER"),[a,b],[s(a),s(b)]));assert.throws(()=>adminBrowserBootstrapInput(context("BLOCK_LIVE_BROWSER"),[a,b],[s(a),s(b)]));});

async function fixture(kind, controls={}){
  const db=await createLocalCanonicalSql(),c=context(kind),tokens=new Map(),requests=[],inspections=[],writes=[];
  await db.exec("create table app_private.sc_admin_ci_marker(namespace text,source_sha text,system_identifier text,project_id text)");
  await db.query("insert into app_private.sc_admin_ci_marker values($1,$2,$3,$4)",[namespace,sourceSha,systemIdentifier,projectId]);
  const rows=async(sql,args=[])=>JSON.parse(JSON.stringify((await db.query(sql,args)).rows));
  const authUser=async id=>(await rows("select id,email,role,is_anonymous,raw_app_meta_data as app_metadata,banned_until,created_at,updated_at from auth.users where id=$1",[id]))[0]??null;
  const denied=(code,status)=>Response.json({code,message:"Synthetic refused.",details:null,hint:null},{status,headers:{"X-Supabase-Api-Version":"2024-01-01"}});
  const signatures={admin_snapshot:["p_actor","p_session"],admin_reserve:["p_actor","p_session","p_intent","p_execution"],admin_operation_guard:["p_actor","p_session","p_operation","p_execution"],admin_transition:["p_actor","p_session","p_operation","p_phase","p_execution","p_release"],admin_complete:["p_actor","p_session","p_operation","p_execution"],my_access_state:[],my_sessions:[]};
  const transport=async(raw,init)=>{
    const u=new URL(raw),body=init.body===undefined?undefined:JSON.parse(init.body),token=new Headers(init.headers).get("authorization")?.slice(7),claims=tokens.get(token);requests.push({method:init.method,path:u.pathname});
    assert.equal(u.origin,ADMIN_BROWSER_API);assert.equal(init.redirect,"error");assert.equal(init.credentials,"omit");assert.equal(init.cache,"no-store");
    if(controls.transport){const r=await controls.transport({u,init,body,db,requests});if(r!==undefined)return r;}
    if(u.pathname==="/auth/v1/admin/users"&&init.method==="POST"){
      // GoTrue2.197 creates the row before applying app_metadata and ban_duration
      // through UPDATEs in the same transaction. The canonical deferred guard
      // must validate that final row, rather than this intermediate INSERT.
      try{await db.transaction(async tx=>{
        await tx.query("insert into auth.users(id,aud,role,email,raw_app_meta_data,banned_until) values($1,'authenticated','authenticated',$2,$3::jsonb,null)",[body.id,body.email,JSON.stringify({provider:"email",providers:["email"]})]);
        const creating=body.app_metadata?.sc_admin_operation!==undefined,mode=creating?controls.creationFinal:null;
        if(mode!=="missing-marker")await tx.query("update auth.users set raw_app_meta_data=raw_app_meta_data||$2::jsonb where id=$1",[body.id,JSON.stringify(mode==="wrong-marker"?{...body.app_metadata,sc_admin_operation:randomUUID()}:body.app_metadata)]);
        if(body.ban_duration!==undefined&&mode!=="missing-ban")await tx.query("update auth.users set banned_until=now()+interval '876000 hours' where id=$1",[body.id]);
      });return Response.json({user:await authUser(body.id)});}catch{return denied("unexpected_failure",500);}
    }
    if(u.pathname.startsWith("/auth/v1/admin/users/")){
      const id=u.pathname.split("/").at(-1),row=await authUser(id);if(!row)return denied("user_not_found",404);
      if(init.method==="DELETE"){await db.query("delete from auth.users where id=$1",[id]);return Response.json({});}
      if(init.method==="PUT"){await db.query("update auth.users set banned_until=case when $2='none' then null else now()+interval '876000 hours' end where id=$1",[id,body.ban_duration]);return Response.json({user:await authUser(id)});}
      return Response.json({user:row});
    }
    if(u.pathname==="/auth/v1/user")return claims?Response.json({user:await authUser(claims.sub)}):denied("bad_jwt",401);
    if(u.pathname==="/auth/v1/logout"){assert.ok(claims);await db.query("delete from auth.refresh_tokens where user_id=$1",[claims.sub]);await db.query("delete from auth.sessions where user_id=$1",[claims.sub]);return new Response(null,{status:204});}
    if(u.pathname.startsWith("/rest/v1/rpc/")){
      const name=u.pathname.split("/").at(-1),keys=signatures[name];assert.ok(keys);assert.deepEqual(Object.keys(body).sort(),keys.slice().sort());
      try{return await db.transaction(async tx=>{await tx.exec("set local role "+(token===c.secretKey?"service_role":"authenticated"));if(token!==c.secretKey){assert.ok(claims);await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);}const casts=keys.map((k,i)=>"$"+(i+1)+"::"+(k==="p_intent"?"jsonb":k==="p_phase"?"text":k==="p_release"?"boolean":"uuid"));const data=(await tx.query("select public."+name+"("+casts.join(",")+") as value",keys.map(k=>k==="p_intent"?JSON.stringify(body[k]):body[k]))).rows[0].value;return Response.json(data);});}catch(e){return denied(e.code??"SYNTHETIC_ERROR",e.code==="42501"?403:400);}
    }
    throw Error("TEST_ENDPOINT_REFUSED");
  };
  const psql=input=>{const vars=Object.fromEntries([...input.matchAll(/^\\set ([a-z_]+) ([a-z0-9-]+)$/gm)].map(m=>[m[1],m[2]]));return input.replace(/^\\set .*\n/gm,"").replace(/:'([a-z_]+)'/g,(_,name)=>"'"+vars[name]+"'");};
  const query=async input=>{
    const match=ADMIN_BROWSER_INSPECTION_ORDER[kind][inspections.length];inspections.push(match);
    // Explicit preparation seam: real PGlite is PG18; these provenance values
    // are synthetic and do not establish native PG17 or pg_control_system.
    const sql=psql(input).replace("(select system_identifier::text from pg_control_system())","'"+systemIdentifier+"'").replace("current_setting('server_version_num')::integer","170000");
    const result=await db.exec(sql),value=result.flatMap(r=>r.rows).find(r=>r.jsonb_build_object)?.jsonb_build_object;if(controls.proof)return controls.proof(value,match);return value;
  };
  const write=async input=>{writes.push(input);await db.exec(psql(input));};
  const h=await createAdminBrowserHarness(c,{transport,query,write,cleanupAllowed:()=>controls.cleanupAllowed!==false});
  const session=async owner=>{const id=randomUUID(),exp=Math.floor(Date.now()/1000)+3600,claims={sub:owner.id,session_id:id,role:"authenticated",exp};const token=Buffer.from('{"alg":"HS256"}').toString("base64url")+"."+Buffer.from(JSON.stringify(claims)).toString("base64url")+"."+Buffer.from("synthetic-signature").toString("base64url");tokens.set(token,claims);await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[id,owner.id]);await db.query("insert into auth.refresh_tokens(user_id,session_id,token) values($1,$2,'synthetic')",[owner.id,id]);return{accessToken:token,sessionId:id,expiresAt:exp*1000};};
  return{db,c,h,session,requests,inspections,writes,authUser};
}
for(const kind of ADMIN_BROWSER_CASES)test("original SDK/Core/SQL composition and exact cleanup — "+kind,async()=>{
  const f=await fixture(kind);try{
    const step=async(label,op)=>{try{return await op();}catch{throw Error("PURE_PREPARATION_"+label+"_GETUSER_"+f.requests.filter(r=>r.path==="/auth/v1/user").length+"_ACCESS_"+f.requests.filter(r=>r.path==="/rest/v1/rpc/my_access_state").length);}};
    const {h}=f,a=await step("CREATE_A",()=>h.ordinaryFixture()),b=kind==="BLOCK_LIVE_BROWSER"?await step("CREATE_B",()=>h.ordinaryFixture()):null;h.state.stage("fixtures");
    await step("VERIFY_A",async()=>h.verifySession(a,await f.session(a),"user"));if(b){await h.verifySession(b,await f.session(b),"user");await h.verifySession(b,await f.session(b),"user");}h.state.stage("browser-bound");await step("BOOTSTRAP",()=>h.bootstrap());h.state.stage("master-bound");if(b){for(const session of h.sessions.filter(s=>s.id===b.id))await h.ownSessions(session);h.state.stage("own-sessions-bound");}const target=await step("ADMIN",()=>h.runAdmin());
    await h.inspect("ACCESS_DENIED");
    if(b){for(const s of h.sessions.filter(s=>s.id===b.id))await h.deniedToken(s);await h.inspect("UNCHANGED");h.state.stage("live-sessions-denied");}
    else{
      const old=await h.verifySession(target,await f.session(target),"forced");h.state.stage("forced-login");h.state.stage("pages-denied");await h.inspect("UNCHANGED");h.state.stage("apis-denied");
      const reauth=await f.session(target);await f.db.query("select app_private.complete_password_change($1::uuid,$2::uuid,$3::text)",[target.id,reauth.sessionId,randomUUID()]);await f.db.query("delete from auth.refresh_tokens where user_id=$1",[target.id]);await f.db.query("delete from auth.sessions where user_id=$1",[target.id]);await h.passwordProof(target,old);h.state.stage("password-terminal");await h.verifySession(target,await f.session(target),"user");await h.inspect("CREDENTIALS_CHANGED");h.state.stage("credentials-changed");await h.ownSessions(target.current);await h.ownSessions(a.current);h.state.stage("own-sessions-bound");
    }
    await h.verifySession(a,a.current,"master");h.state.stage("actor-intact");await h.cleanup();h.state.stage("contexts-closed");const observed=h.state.value.counts,pass=ADMIN_BROWSER_PASS_COUNTS[kind];for(const k of ["fixturesCreated","adminRpc","adminAuth","cleanupHttp","deleted","absenceReads","revocationAcks","alreadyRevoked","cleanupSql"])assert.equal(observed[k],pass[k],k);assert.deepEqual(f.inspections,ADMIN_BROWSER_INSPECTION_ORDER[kind]);assert.equal(h.metadata().inventoryComplete,true);assert.equal((await f.db.query("select count(*)::integer as n from auth.users")).rows[0].n,0);assert.equal((await f.db.query("select count(*)::integer as n from app_private.admin_operations")).rows[0].n,1);
    // Browser counters are deliberately not supplied: this pure test makes no
    // browser/PASS report and cannot certify literal #24-1 or #24-5.
  }finally{await f.h.dispose();await f.db.close();}
});
test("out-of-order SQL is refused before query; foreign metadata never grants bootstrap",async()=>{const f=await fixture("BLOCK_LIVE_BROWSER");try{await assert.rejects(f.h.inspect("CLEANUP_RETAINED"),{message:"SQL_REFUSED"});assert.equal(f.inspections.length,0);const a=await f.h.ordinaryFixture(),b=await f.h.ordinaryFixture();await f.h.verifySession(a,await f.session(a),"user");await f.h.verifySession(b,await f.session(b),"user");await f.h.verifySession(b,await f.session(b),"user");await f.db.query("update auth.users set raw_app_meta_data='{}' where id=$1",[b.id]);await assert.rejects(f.h.bootstrap());assert.equal(f.writes.length,0);}finally{await f.h.dispose();await f.db.close();}});
test("created but not logged/verifiable C prevents all SDK cleanup, including A",async()=>{const f=await fixture("FIRST_FORCED_BROWSER");try{const a=await f.h.ordinaryFixture();f.h.state.stage("fixtures");await f.h.verifySession(a,await f.session(a),"user");f.h.state.stage("browser-bound");await f.h.bootstrap();f.h.state.stage("master-bound");await f.h.runAdmin();const before=f.requests.length;await assert.rejects(f.h.cleanup(),{message:"CLEANUP_NOT_PROVEN"});assert.equal(f.requests.length,before);assert.equal(f.h.state.value.counts.deleted,0);assert.equal(f.h.metadata().inventoryComplete,false);}finally{await f.h.dispose();await f.db.close();}});
for(const mode of ["missing-marker","wrong-marker","missing-ban"])
test("GoTrue final-state rejection keeps creation unknown and prevents all Auth cleanup — "+mode,async()=>{const f=await fixture("FIRST_FORCED_BROWSER",{creationFinal:mode});try{const h=f.h,a=await h.ordinaryFixture();h.state.stage("fixtures");await h.verifySession(a,await f.session(a),"user");h.state.stage("browser-bound");await h.bootstrap();h.state.stage("master-bound");await assert.rejects(h.runAdmin());assert.equal(h.state.value.writeOutcomeUncertain,true);assert.equal((await f.db.query("select count(*)::integer as n from auth.users")).rows[0].n,1);assert.equal((await f.db.query("select count(*)::integer as n from public.profiles")).rows[0].n,1);assert.equal((await f.db.query("select count(*)::integer as n from app_private.admin_operations where phase<>'complete' and active_execution is not null")).rows[0].n,1);const before=f.requests.length;await assert.rejects(h.cleanup(),{message:"CLEANUP_NOT_PROVEN"});assert.equal(f.requests.length,before);assert.equal(h.state.value.counts.deleted,0);assert.equal(f.requests.some(r=>r.method==="DELETE"||r.path==="/auth/v1/logout"),false);}finally{await f.h.dispose();await f.db.close();}});
test("metadata provenance, owner and marker failures are denied independently of SQL enums",()=>{const a={id:randomUUID(),email:"synthetic@example.invalid"},p={provenance:{namespace,sourceSha,systemIdentifier,database:"postgres",currentUser:"postgres",serverVersion:170000,markerRows:[{namespace,sourceSha,systemIdentifier}]},users:[{id:a.id,email:a.email,app_metadata:{sc_admin_native_fixture:namespace},banned_until:null,deleted_at:null,is_anonymous:false}],sessions:[],refreshTokens:[],roles:[],moderation:[],entitlements:[],operations:[],audit:[],receipts:[],events:[],personalRows:0};assert.ok(acceptAdminBrowserProof(p,context("FIRST_FORCED_BROWSER"),[a]));for(const alter of [x=>x.provenance.systemIdentifier="foreign",x=>x.provenance.serverVersion=180000,x=>x.users[0].app_metadata={},x=>x.users[0].id=randomUUID(),x=>x.users[0].email="foreign@example.invalid",x=>x.personalRows=1]){const b=structuredClone(p);alter(b);assert.throws(()=>acceptAdminBrowserProof(b,context("FIRST_FORCED_BROWSER"),[a]));}});
test("invalid harness context or accessor ports are refused before any original graph or side effect",async()=>{let calls=0;const options={query:async()=>{calls++;},write:async()=>{calls++;},cleanupAllowed:()=>true};for(const change of [{projectId:"foreign"},{systemIdentifier:"1"},{secretKey:"legacy"},{commitmentSecret:"short"}])await assert.rejects(createAdminBrowserHarness({...context("FIRST_FORCED_BROWSER"),...change},options),{message:"ENVIRONMENT_REFUSED"});const bad={...options};Object.defineProperty(bad,"query",{get(){calls++;return options.query;}});await assert.rejects(createAdminBrowserHarness(context("FIRST_FORCED_BROWSER"),bad),{message:"ENVIRONMENT_REFUSED"});assert.equal(calls,0);});
async function readyBlockCleanup(controls){const f=await fixture("BLOCK_LIVE_BROWSER",controls),h=f.h;try{const a=await h.ordinaryFixture(),b=await h.ordinaryFixture();h.state.stage("fixtures");await h.verifySession(a,await f.session(a),"user");await h.verifySession(b,await f.session(b),"user");await h.verifySession(b,await f.session(b),"user");h.state.stage("browser-bound");await h.bootstrap();h.state.stage("master-bound");for(const session of h.sessions.filter(s=>s.id===b.id))await h.ownSessions(session);h.state.stage("own-sessions-bound");await h.runAdmin();await h.inspect("ACCESS_DENIED");await h.inspect("UNCHANGED");h.state.stage("live-sessions-denied");h.state.stage("actor-intact");return f;}catch(e){await h.dispose();await f.db.close();throw e;}}
for(const mode of ["logout-false-success","delete-false-success","absence-generic","retained-divergence"])
test("cleanup requires actual status, independent exact404 and retained SQL — "+mode,async()=>{
  const controls={transport:async({u,init})=>{if(mode==="logout-false-success"&&u.pathname==="/auth/v1/logout")return Response.json({});if(mode==="delete-false-success"&&init.method==="DELETE")return Response.json({});},proof:(p,query)=>mode==="retained-divergence"&&query==="CLEANUP_RETAINED"?{...p,audit:[]}:p};
  const f=await readyBlockCleanup(controls);try{if(mode==="absence-generic")controls.transport=async({u,init,db})=>{if(u.pathname.startsWith("/auth/v1/admin/users/")&&init.method==="GET"&&(await db.query("select count(*)::integer as n from auth.users where id=$1",[u.pathname.split("/").at(-1)])).rows[0].n===0)return Response.json({code:"not_found",message:"Synthetic generic404."},{status:404,headers:{"X-Supabase-Api-Version":"2024-01-01"}});};await assert.rejects(f.h.cleanup(),{message:"CLEANUP_NOT_PROVEN"});assert.equal(f.h.state.value.counts.deleted,mode==="retained-divergence"?2:0);if(mode==="logout-false-success")assert.equal(f.h.state.value.writeOutcomeUncertain,true);}finally{await f.h.dispose();await f.db.close();}
});


test("Next development asset version is allowed without admitting arbitrary or encoded queries",()=>{
 const asset=ADMIN_BROWSER_APP+"/_next/static/css/app/layout.css";
 assert.equal(acceptAdminBrowserRequest(asset+"?v=1791705600000","GET"),true);
 for(const query of["?v=1791705600000&v=1791705600001","?v=1791705600000&extra=1","?v=1791705600000&dpl=foreign","?v=%311791705600000","?v=1","?v=-1791705600000","?capability=private"])
  assert.equal(acceptAdminBrowserRequest(asset+query,"GET"),false);
 assert.equal(acceptAdminBrowserRequest(asset+"?v=1791705600000","POST"),false);
});
