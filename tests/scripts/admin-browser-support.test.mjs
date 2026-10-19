// Pure protocol preparation only: canonical SQL/PGlite PG18 and explicit
// synthetic GoTrue/HTTP/claims doubles. No Next, browser, stack or native PASS.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { resolve,join } from "node:path";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { ADMIN_BROWSER_APP, ADMIN_BROWSER_API, ADMIN_BROWSER_PAGES, ADMIN_BROWSER_PROBES, ADMIN_BROWSER_INSPECTION_ORDER, adminBrowserEnvironment, adminBrowserRefuse, closedBrowserOperation, acceptAdminBrowserRequest, acceptsAdminBrowserDenial, acceptAdminOwnSessions, acceptAdminOwnSessionsView, acceptsAdminOwnSessionsChanged, adminBrowserInspectionInput, acceptAdminBrowserProof, adminBrowserBootstrapInput, createAdminBrowserState, createAdminBrowserTransport, createAdminBrowserNextTransport, createAdminBrowserHarness, isAdminCanonicalHmrGet, classifyAdminBrowserHttpRequest, adminBrowserHttpPendingCode, isAdminBrowserReadCancellationRequest, isAdminBrowserParkableAuthRead, isAdminBrowserParkableAssetRead, adminBrowserPreParkPending, adminBrowserPreParkReadPending, adminBrowserPageReleaseCode, adminBrowserPendingCode, waitForAdminBrowserIoQuiet, waitForAdminBrowserHttpQuiet, createBrowserRequestOriginTracker, createBrowserProtocolObserver } from "../e2e-auth-local/admin-browser-support.mjs";
import { ADMIN_BROWSER_CASES, ADMIN_BROWSER_STAGES, ADMIN_BROWSER_PASS_COUNTS, ADMIN_BROWSER_LIMITS, ADMIN_HTTP_PENDING_CLASSES, ADMIN_HTTP_PENDING_CODES, blankAdminBrowserCase, validateAdminBrowserCase, closedAdminBrowserValue, acceptsBrowserProtocolObservation, isAdminAuthActionRequest, acceptAdminAuthActionResponse, runAdminAuthCheckpoint } from "../e2e-auth-local/admin-browser-contract.mjs";

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

test("settings mount and session reads require canonical GET without widening write or owner selection authority",()=>{
  const owner=randomUUID();
  for(const path of["/api/settings","/api/settings/sessions"]){
    const url=ADMIN_BROWSER_APP+path;
    assert.equal(acceptAdminBrowserRequest(url,"GET"),true);
    assert.equal(isAdminBrowserReadCancellationRequest(url,"GET"),true);
    for(const [candidate,method]of[
      [url,"POST"],[url,"PUT"],[url,"DELETE"],
      [url+"?","GET"],[url+"#","GET"],[url+"?user_id="+owner,"GET"],
      [url+"?session_id="+owner,"GET"],[url+"?_rsc=abc123","GET"],
      [url+"/","GET"],[ADMIN_BROWSER_APP+"/api/./"+path.slice(5),"GET"],
      [url.replace("/settings","/%73ettings"),"GET"],
      ["http://localhost:3117"+path,"GET"],["https://127.0.0.1:3117"+path,"GET"],
      ["http://user:pass@127.0.0.1:3117"+path,"GET"],["https://foreign.invalid"+path,"GET"]
    ]){
      assert.equal(acceptAdminBrowserRequest(candidate,method),false);
      assert.equal(isAdminBrowserReadCancellationRequest(candidate,method),false);
    }
  }
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
// HTTP doubles only: a Next source compatibility control, not an observed cookie
// or native cause. Only the literal dev cookie may be ignored by this channel.
test("Next HMR cookie is validated but never forwarded, preserving Auth/flow bytes and owner at probe32",async()=>{
  const owner=randomUUID(),state=createAdminBrowserState("FIRST_FORCED_BROWSER",{now:()=>0});
  for(let i=0;i<31;i++)state.count("nextProbeRequests");
  const auth=[{name:"sc-auth.0",value:"synthetic-chunk-0"},{name:"sc-auth.1",value:"synthetic-chunk-1"},
    {name:"sc-flow-request",value:"synthetic-request"},{name:"sc-flow-recovery",value:"synthetic-recovery"},{name:"sc-flow-password",value:"synthetic-password"}];
  const cookies=[auth[0],{name:"__next_hmr_refresh_hash__",value:"deadbeef"},...auth.slice(1)],before=structuredClone(cookies);let calls=0;
  const io=createAdminBrowserNextTransport(state,async(url,init)=>{
    calls++;assert.equal(url,ADMIN_BROWSER_APP+"/api/settings/sessions");assert.equal(init.method,"GET");assert.equal(init.body,undefined);
    assert.equal(init.headers.Origin,ADMIN_BROWSER_APP);assert.equal(init.headers["X-Expected-User-ID"],owner);
    assert.equal(init.headers.Cookie,"sc-auth.0=synthetic-chunk-0; sc-auth.1=synthetic-chunk-1; sc-flow-request=synthetic-request; sc-flow-recovery=synthetic-recovery; sc-flow-password=synthetic-password");
    assert.equal(init.headers.apikey,undefined);assert.equal(init.headers.Authorization,undefined);assert.equal(init.redirect,"manual");assert.equal(init.credentials,"omit");assert.equal(init.cache,"no-store");
    return Response.json({sessions:[{isCurrent:true,createdAt:null,refreshedAt:null}],hasMore:false});
  });
  const result=await io.request({path:"/api/settings/sessions",method:"GET",body:null,userId:owner,cookies});result.bytes.fill(0);
  assert.equal(calls,1);assert.equal(state.value.counts.nextProbeRequests,32);assert.equal(state.value.counts.ownedSdkRequests,0);assert.equal(state.value.counts.browserRequests,0);
  assert.equal(state.value.writeOutcomeUncertain,false);assert.equal(io.metadata().pending,0);assert.deepEqual(cookies,before);io.close();
});

test("Next HMR cookie cannot hide foreign names, duplicate rows, malformed values or the original32-row boundary",async()=>{
  const owner=randomUUID(),state=createAdminBrowserState("FIRST_FORCED_BROWSER",{now:()=>0});let calls=0;
  const io=createAdminBrowserNextTransport(state,async()=>{calls++;return Response.json({});});
  const auth={name:"sc-auth",value:"synthetic-auth"},hmr={name:"__next_hmr_refresh_hash__",value:"deadbeef"};
  const request={path:"/api/settings/sessions",method:"GET",body:null,userId:owner,cookies:[]};
  for(const cookies of[
    [auth,hmr,{name:"foreign_cookie",value:"x"}],
    ...["__next_hmr_refresh_hash___","__NEXT_HMR_REFRESH_HASH__","prefix__next_hmr_refresh_hash__","__next_hmr_refresh_hash__.0"].map(name=>[auth,{name,value:"deadbeef"}]),
    [auth,hmr,{...hmr}],[auth,{...auth},hmr],
    ...["", "x; injected=yes", "x,y", "x\n", "x".repeat(16385),null,1,{}].map(value=>[auth,{...hmr,value}]),
    [auth,null,hmr],[auth,{name:null,value:"x"},hmr],
    [...Array.from({length:32},(_,i)=>({name:"sc-auth."+i,value:"x"})),hmr],
  ])await assert.rejects(io.request({...request,cookies}),{message:"REQUEST_REFUSED"});
  assert.equal(calls,0);assert.equal(state.value.counts.nextProbeRequests,0);assert.equal(io.metadata().pending,0);
  const boundary=[...Array.from({length:31},(_,i)=>({name:"sc-auth."+i,value:"x"})),hmr];
  const result=await io.request({...request,cookies:boundary});result.bytes.fill(0);assert.equal(calls,1);assert.equal(state.value.counts.nextProbeRequests,1);assert.equal(io.metadata().pending,0);io.close();
});

test("Next HMR cookie does not bypass owner/method/body guards, sticky failure or the existing deadline",async()=>{
  const request={path:"/api/settings/sessions",method:"GET",body:null,userId:randomUUID(),cookies:[{name:"sc-auth",value:"synthetic-auth"},{name:"__next_hmr_refresh_hash__",value:"deadbeef"}]};
  const state=createAdminBrowserState("FIRST_FORCED_BROWSER",{now:()=>0});let calls=0;
  const io=createAdminBrowserNextTransport(state,async()=>{calls++;return Response.json({});});
  for(const patch of[{userId:"foreign"},{method:"POST",body:{}},{body:{}},{path:"/api/settings/sessions?user_id="+request.userId}])await assert.rejects(io.request({...request,...patch}),{message:"REQUEST_REFUSED"});
  state.unknown();state.fail("AUTH_NOT_PROVEN");await assert.rejects(io.request(request),{message:"AUTH_NOT_PROVEN"});
  assert.equal(state.value.code,"AUTH_NOT_PROVEN");assert.equal(state.value.writeOutcomeUncertain,true);assert.equal(calls,0);assert.equal(state.value.counts.nextProbeRequests,0);io.close();
  let now=0;const expired=createAdminBrowserState("FIRST_FORCED_BROWSER",{now:()=>now,deadlineMs:10}),late=createAdminBrowserNextTransport(expired,async()=>{calls++;return Response.json({});});
  now=10;await assert.rejects(late.request(request),{message:"DEADLINE_EXCEEDED"});assert.equal(expired.value.counts.nextProbeRequests,0);assert.equal(expired.value.writeOutcomeUncertain,false);assert.equal(calls,0);assert.equal(late.metadata().pending,0);late.close();
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
test("Admin case deadline preserves the first failure, uncertainty and cleanup veto after expiry",()=>{
  for(const kind of ADMIN_BROWSER_CASES)for(const first of["TRANSPORT_FAILED","QUIESCENCE_HTTP_PENDING"]){
    let now=0;const state=createAdminBrowserState(kind,{now:()=>now,deadlineMs:15000});state.stage("fixtures");state.fail(first);state.unknown();
    now=15000;assert.throws(()=>state.active(),{message:first});state.fail("PROCESS_UNCONFIRMED");now=15001;
    const report=state.finish(1,0);assert.equal(report.code,first);assert.equal(report.status,"failed");assert.equal(report.pendingRequests,1);assert.equal(report.writeOutcomeUncertain,true);assert.equal(report.counts.deleted,0);assert.equal(report.counts.cleanupHttp,0);assert.equal(report.stages.length,1);
  }
});
test("Admin case deadline still fails at the exact boundary and cannot promote late terminal settlement",()=>{
  let now=0;const state=createAdminBrowserState("BLOCK_LIVE_BROWSER",{now:()=>now,deadlineMs:15000});state.stage("fixtures");
  now=14999;state.active();now=15000;assert.throws(()=>state.active(),{message:"DEADLINE_EXCEEDED"});state.fail("TRANSPORT_FAILED");
  const report=state.finish(0,0);assert.equal(report.code,"DEADLINE_EXCEEDED");assert.equal(report.status,"failed");assert.equal(report.pendingRequests,0);assert.equal(report.counts.deleted,0);assert.equal(report.counts.cleanupHttp,0);
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

// Controlled CRSession/dispatcher ports, not an executed browser or Chrome order.
function protocolPorts({intercepted=true}={}){
  const session=new EventEmitter(),managerMap=new Map(),server={},serverPage={},implementations=new WeakMap(),live=new Map();let commandCalls=0,privateReads=0;
  session.send=()=>{commandCalls++;throw Error("NO_COMMAND_AUTHORITY");};
  const connection={toImpl:client=>implementations.get(client)},page={_connection:connection,_guid:"owned-page"},request={_connection:connection,_guid:"owned-request"};
  const manager={_page:serverPage,_requestIdToRequest:managerMap,_sessions:new Map([[session,{session}]])};serverPage.delegate={_networkManager:manager};implementations.set(page,serverPage);implementations.set(request,server);
  const observer=createBrowserProtocolObserver(),key="opaque-test-network-id";
  const entry=()=>({_requestId:key,session,request:server});
  const publish=()=>{managerMap.set(key,entry());live.set(request,true);observer.request(request,page);};
  session.on("Network.requestWillBeSent",()=>{if(!intercepted)publish();});session.on("Fetch.requestPaused",publish);
  for(const [name,kind] of [["Network.loadingFinished","finished"],["Network.loadingFailed","failed"]])session.on(name,()=>{if(managerMap.has(key)){managerMap.delete(key);observer.terminal(request,kind);live.delete(request);}});
  assert.equal(observer.observePage(page),true);
  const event=(kind)=>{const value=kind==="pause"?{networkId:key}:{requestId:key};for(const field of["request","response","headers","errorText","url","timestamp"])Object.defineProperty(value,field,{get(){privateReads++;throw Error("PRIVATE_CANARY");}});return value;};
  const names={will:"Network.requestWillBeSent",pause:"Fetch.requestPaused",finished:"Network.loadingFinished",failed:"Network.loadingFailed"};
  return{observer,session,managerMap,manager,server,serverPage,implementations,connection,page,request,live,key,event,emit:kind=>session.emit(names[kind],event(kind)),privateReads:()=>privateReads,commandCalls:()=>commandCalls};
}
test("protocol observation exact identity distinguishes normal and terminal-before-construction order without finishing orphan IO",()=>{
  for(const kinds of [["will","pause","finished"],["will","finished","pause"],["will","pause","failed"]]){
    const f=protocolPorts();for(const kind of kinds)f.emit(kind);
    const orphan=kinds[1]==="finished",snapshot=f.observer.snapshot([f.request]);
    assert.deepEqual(snapshot,{identity:"exact-server-request",order:orphan?"terminal-before-pause":"pause-before-terminal",terminal:kinds.at(-1)==="failed"?"failed":"finished",publicTerminal:orphan?"not-observed":kinds.at(-1)==="failed"?"failed":"finished",managerEntry:orphan?"same-request":"absent",sessionRegistered:"registered"});
    assert.equal(f.live.size,orphan?1:0);assert.equal(f.managerMap.size,orphan?1:0);assert.equal(f.commandCalls()+f.privateReads(),0);assert.equal(Object.isFrozen(snapshot),true);f.observer.dispose();
  }
  const f=protocolPorts({intercepted:false});f.emit("will");f.emit("finished");assert.equal(f.observer.snapshot([f.request]).order,"no-pause-observed");f.observer.dispose();
});
// The original observer is exercised with RAM ports, not an executed browser.
// PW 1.63 queues client events with setImmediate (coreBundle64020). Its manager
// map is shared by CRSessions, while each entry belongs to exactly one session.
async function queuedProtocolFallback({foreignFirst=null,entryMode="owned"}={}){
  const ownSession=new EventEmitter(),foreignSession=new EventEmitter();let commandCalls=0,privateReads=0;
  for(const session of[ownSession,foreignSession])session.send=()=>{commandCalls++;throw Error("NO_COMMAND_AUTHORITY");};
  const implementations=new WeakMap(),serverRequest={},serverPage={},connection={toImpl:client=>implementations.get(client)},page={_connection:connection,_guid:"synthetic-owned-page"},request={_connection:connection,_guid:"synthetic-owned-request"};
  const entry={request:serverRequest,session:entryMode==="unmatched"?new EventEmitter():ownSession,_requestId:"synthetic-network-key"};
  for(const field of["url","headers","response","body"])Object.defineProperty(entry,field,{get(){privateReads++;throw Error("PRIVATE_CANARY");}});
  if(entryMode==="accessor")Object.defineProperty(entry,"session",{get(){privateReads++;throw Error("PRIVATE_CANARY");}});
  const managerMap=new Map([[entry._requestId,entry]]);
  if(entryMode==="duplicate")managerMap.set("synthetic-second-key",{request:serverRequest,session:ownSession,_requestId:"synthetic-second-key"});
  const entries=[...managerMap.values()],sessionOrder=foreignFirst===null?[ownSession]:foreignFirst?[foreignSession,ownSession]:[ownSession,foreignSession],manager={_page:serverPage,_requestIdToRequest:managerMap,_sessions:new Map(sessionOrder.map(session=>[session,{session}]))};
  serverPage.delegate={_networkManager:manager};implementations.set(page,serverPage);implementations.set(request,serverRequest);
  const observer=createBrowserProtocolObserver(),clientEvents=new EventEmitter(),live=new Set();assert.equal(observer.observePage(page),true);
  clientEvents.on("request",value=>{live.add(value);observer.request(value,page);});
  clientEvents.on("requestfinished",value=>{observer.terminal(value,"finished");live.delete(value);});
  clientEvents.on("requestfailed",value=>{observer.terminal(value,"failed");live.delete(value);});
  await new Promise(resolve=>setImmediate(()=>{clientEvents.emit("request",request);resolve();}));
  return{observer,request,live,managerMap,entries,sideEffects:()=>commandCalls+privateReads};
}
function assertQueuedProtocolHasNoAuthority(f){assert.equal(f.live.size,1);assert.equal(f.managerMap.size,f.entries.length);assert.equal([...f.managerMap.values()].every((entry,index)=>entry===f.entries[index]),true);assert.equal(f.sideEffects(),0);}
for(const [name,foreignFirst] of[["single session",null],["foreign session first",true],["foreign session last",false]]){
  test("protocol fallback queued delivery selects the exact entry session: "+name,async()=>{
    const f=await queuedProtocolFallback({foreignFirst});try{const snapshot=f.observer.snapshot([f.request]);assertQueuedProtocolHasNoAuthority(f);assert.deepEqual(snapshot,{identity:"exact-server-request",order:"unavailable",terminal:"not-observed",publicTerminal:"not-observed",managerEntry:"same-request",sessionRegistered:"registered"});assert.equal(Object.isFrozen(snapshot),true);}finally{f.observer.dispose();}
  });
}
for(const entryMode of["unmatched","duplicate","accessor"]){
  test("protocol fallback queued delivery refuses "+entryMode+" session provenance without terminal authority",async()=>{
    for(const foreignFirst of[true,false]){const f=await queuedProtocolFallback({foreignFirst,entryMode});try{assertQueuedProtocolHasNoAuthority(f);assert.deepEqual(f.observer.snapshot([f.request]),{identity:"unavailable",order:"unavailable",terminal:"unavailable",publicTerminal:"unavailable",managerEntry:"unavailable",sessionRegistered:"unavailable"});}finally{f.observer.dispose();}}
  });
}

test("protocol membership observes same, absent and replaced manager entries without terminating public IO",()=>{
  const f=protocolPorts();f.emit("will");f.emit("pause");const original=f.managerMap.get(f.key),first=f.observer.snapshot([f.request]);
  assert.equal(first.managerEntry,"same-request");assert.equal(first.sessionRegistered,"registered");
  f.managerMap.delete(f.key);assert.equal(f.observer.snapshot([f.request]).managerEntry,"absent");assert.equal(f.live.size,1);
  const replacement={_requestId:f.key,session:f.session,request:{}};f.managerMap.set(f.key,replacement);
  assert.equal(f.observer.snapshot([f.request]).managerEntry,"other-request");assert.equal(f.managerMap.get(f.key),replacement);assert.equal(f.live.size,1);
  f.managerMap.set(f.key,original);assert.equal(f.observer.snapshot([f.request]).managerEntry,"same-request");
  assert.equal(first.managerEntry,"same-request");assert.equal(first.terminal,"not-observed");assert.equal(first.publicTerminal,"not-observed");
  f.emit("finished");assert.equal(f.live.size,0);assert.equal(f.observer.snapshot([f.request]).managerEntry,"absent");assert.equal(f.commandCalls()+f.privateReads(),0);f.observer.dispose();
});
test("protocol membership records removed sessions without promoting an ACK or finishing a request",()=>{
  const f=protocolPorts();f.emit("will");f.emit("pause");const before=f.observer.snapshot([f.request]),entry=f.managerMap.get(f.key);
  f.manager._sessions.delete(f.session);const after=f.observer.snapshot([f.request]);
  assert.equal(after.sessionRegistered,"removed");assert.equal(after.managerEntry,"same-request");assert.equal(after.terminal,"not-observed");assert.equal(after.publicTerminal,"not-observed");
  assert.equal(f.manager._sessions.size,0);assert.equal(f.managerMap.get(f.key),entry);assert.equal(f.live.size,1);assert.equal(before.sessionRegistered,"registered");assert.equal(Object.isFrozen(after),true);assert.equal(f.commandCalls()+f.privateReads(),0);f.observer.dispose();
});
test("protocol membership refuses accessors and changed session maps without invoking provider getters",()=>{
  let reads=0;
  for(const field of["request","_requestId","session"]){const f=protocolPorts();f.emit("will");f.emit("pause");const entry=f.managerMap.get(f.key);Object.defineProperty(entry,field,{get(){reads++;throw Error("PRIVATE_CANARY");}});
    const snapshot=f.observer.snapshot([f.request]);assert.equal(snapshot.managerEntry,"unavailable");assert.equal(snapshot.identity,"exact-server-request");assert.equal(f.live.size,1);assert.equal(f.managerMap.get(f.key),entry);assert.equal(f.commandCalls()+f.privateReads(),0);f.observer.dispose();}
  for(const value of[undefined,null,42]){const f=protocolPorts();f.emit("will");f.emit("pause");f.managerMap.set(f.key,value);assert.equal(f.observer.snapshot([f.request]).managerEntry,"unavailable");assert.equal(f.managerMap.has(f.key),true);assert.equal(f.live.size,1);assert.equal(f.commandCalls()+f.privateReads(),0);f.observer.dispose();}
  for(const altered of["accessor","replacement"]){const f=protocolPorts();f.emit("will");f.emit("pause");if(altered==="accessor")Object.defineProperty(f.manager,"_sessions",{get(){reads++;throw Error("PRIVATE_CANARY");}});else f.manager._sessions=new Map([[f.session,{session:f.session}]]);
    assert.equal(f.observer.snapshot([f.request]).sessionRegistered,"unavailable");assert.equal(f.live.size,1);assert.equal(f.commandCalls()+f.privateReads(),0);f.observer.dispose();}
  assert.equal(reads,0);
});
test("protocol membership aggregates unknown requests and exports only closed immutable enums",()=>{
  const f=protocolPorts();f.emit("will");f.emit("pause");const mixed=f.observer.snapshot([f.request,{}]);
  assert.equal(mixed.managerEntry,"mixed");assert.equal(mixed.sessionRegistered,"mixed");assert.equal(mixed.terminal,"mixed");assert.equal(Object.isFrozen(mixed),true);
  assert.equal(acceptsBrowserProtocolObservation(mixed),true);assert.deepEqual(Object.keys(mixed).sort(),["identity","managerEntry","order","publicTerminal","sessionRegistered","terminal"].sort());
  const encoded=JSON.stringify(mixed);assert.equal(encoded.includes(f.key)||encoded.includes(f.request._guid)||encoded.includes("PRIVATE"),false);assert.equal(f.live.size,1);assert.equal(f.commandCalls()+f.privateReads(),0);f.observer.dispose();
});
test("protocol membership closed contract preserves legacy four fields and refuses partial pairs, getters and authority labels",()=>{
  const f=protocolPorts();f.emit("will");f.emit("pause");const protocol=f.observer.snapshot([f.request]);
  const legacy={...protocol};delete legacy.managerEntry;delete legacy.sessionRegistered;assert.equal(acceptsBrowserProtocolObservation(legacy),true);
  for(const managerEntry of["same-request","absent","other-request","unavailable","mixed"])for(const sessionRegistered of["registered","removed","unavailable","mixed"])assert.equal(acceptsBrowserProtocolObservation({...protocol,managerEntry,sessionRegistered}),true);
  let reads=0;for(const field of["managerEntry","sessionRegistered"]){const incomplete={...protocol};delete incomplete[field];assert.equal(acceptsBrowserProtocolObservation(incomplete),false);assert.equal(acceptsBrowserProtocolObservation(Object.defineProperty({...protocol},field,{enumerable:true,get(){reads++;throw Error("PRIVATE_CANARY");}})),false);}
  for(const change of[{managerEntry:"EOF"},{sessionRegistered:"ACK"},{managerEntry:null},{sessionRegistered:true},{url:"PRIVATE"}])assert.equal(acceptsBrowserProtocolObservation({...protocol,...change}),false);
  assert.equal(reads,0);assert.equal(f.live.size,1);assert.equal(f.commandCalls()+f.privateReads(),0);f.observer.dispose();
});
test("protocol observation never correlates a foreign connection or missing bridge by matching identifiers",()=>{
  const f=protocolPorts();f.emit("will");f.emit("pause");
  const foreign={_connection:{toImpl:()=>f.server},_guid:f.request._guid};f.observer.request(foreign,f.page);assert.equal(f.observer.snapshot([foreign]).identity,"unavailable");
  const unmapped={_connection:f.connection,_guid:"missing"};f.observer.request(unmapped,f.page);assert.equal(f.observer.snapshot([unmapped]).identity,"unavailable");
  assert.equal(f.observer.observePage({}),false);assert.equal(f.observer.observePage(null),false);assert.equal(f.commandCalls()+f.privateReads(),0);f.observer.dispose();
});
test("protocol observation duplicate IDs and inconsistent map identity remain unavailable without provider fallback",()=>{
  for(const mode of["will","pause","finished","entry"]){const f=protocolPorts();f.emit("will");f.emit("pause");if(mode==="entry"){f.managerMap.set(f.key,{_requestId:f.key,session:f.session,request:{}});f.emit("will");}else{f.emit(mode);f.emit(mode);}assert.equal(f.observer.snapshot([f.request]).identity,"unavailable");assert.ok(f.observer.metadata().ambiguities>0);f.observer.dispose();}
});
test("protocol observation corrupt providers and accessors produce unavailable without private reads",()=>{
  let reads=0;const page=Object.defineProperty({},"_connection",{get(){reads++;throw Error("PRIVATE");}}),observer=createBrowserProtocolObserver();assert.equal(observer.observePage(page),false);assert.equal(reads,0);observer.dispose();
  const wrong=protocolPorts(),missing=createBrowserProtocolObserver();wrong.serverPage._delegate=wrong.serverPage.delegate;delete wrong.serverPage.delegate;assert.equal(missing.observePage(wrong.page),false);assert.equal(missing.metadata().disposed,false);assert.equal(wrong.commandCalls(),0);missing.dispose();wrong.observer.dispose();
  const f=protocolPorts();f.emit("will");f.emit("pause");f.session.emit("Network.loadingFinished",Object.defineProperty({},"requestId",{get(){reads++;throw Error("PRIVATE");}}));assert.equal(f.observer.snapshot([f.request]).identity,"unavailable");assert.equal(reads+f.privateReads(),0);f.observer.dispose();
});
test("protocol observation removes only its listeners, preserves frozen snapshots and ignores late events",()=>{
  const f=protocolPorts();f.emit("will");f.emit("pause");const snapshot=f.observer.snapshot([f.request]);assert.equal(snapshot.terminal,"not-observed");const before=f.session.listenerCount("Network.loadingFinished");f.observer.dispose();f.observer.dispose();assert.equal(f.session.listenerCount("Network.loadingFinished"),before-1);
  f.emit("finished");assert.equal(f.live.size,0);assert.equal(snapshot.terminal,"not-observed");assert.equal(snapshot.publicTerminal,"not-observed");assert.equal(f.observer.snapshot([f.request]).identity,"unavailable");assert.equal(f.commandCalls(),0);
});
test("protocol observation finite bounds, sparse input and aggregation export only closed enums",()=>{
  const f=protocolPorts();f.emit("will");f.emit("pause");assert.equal(f.observer.snapshot([]),null);assert.equal(f.observer.snapshot(Array(1)).identity,"unavailable");const unknown={};assert.equal(f.observer.snapshot([f.request,unknown]).identity,"mixed");
  for(let i=0;i<=4096;i++)f.session.emit("Network.requestWillBeSent",{requestId:"opaque-"+i});assert.equal(f.observer.metadata().bounded,true);assert.equal(f.observer.snapshot([f.request]).identity,"unavailable");
  const encoded=JSON.stringify(f.observer.snapshot([f.request]));assert.equal(encoded.includes(f.key)||encoded.includes(f.request._guid)||encoded.includes("PRIVATE"),false);f.observer.dispose();
  let reads=0;for(const count of[32,33]){const fixture=protocolPorts(),observer=createBrowserProtocolObserver();fixture.observer.dispose();fixture.manager._sessions=new Map(Array.from({length:count},()=>{const session=new EventEmitter();return[session,{session}];}));Object.defineProperty(fixture.manager._sessions,"size",{get(){reads++;throw Error("PRIVATE");}});assert.equal(observer.observePage(fixture.page),count===32);assert.equal(observer.metadata().bounded,count===33);observer.dispose();}assert.equal(reads,0);
  const incompatible=protocolPorts(),observer=createBrowserProtocolObserver();incompatible.observer.dispose();incompatible.manager._sessions=new Proxy(new Map(),{get(){reads++;throw Error("PRIVATE");}});assert.equal(observer.observePage(incompatible.page),false);assert.equal(reads,0);observer.dispose();
  const many=protocolPorts();for(let i=0;i<4097;i++)many.managerMap.set("opaque-many-"+i,{});many.observer.request(many.request,many.page);assert.equal(many.observer.metadata().bounded,true);assert.equal(many.observer.snapshot([many.request]).identity,"unavailable");many.observer.dispose();
});
test("protocol observation closed contract rejects payloads, getters and non-enum values without changing legacy metadata",()=>{
  const f=protocolPorts();f.emit("will");f.emit("finished");f.emit("pause");const protocol=f.observer.snapshot([f.request]);assert.equal(acceptsBrowserProtocolObservation(protocol),true);assert.equal(acceptsBrowserProtocolObservation(null),true);
  let reads=0;assert.equal(acceptsBrowserProtocolObservation(Object.defineProperty({...protocol},"terminal",{enumerable:true,get(){reads++;throw Error("PRIVATE");}})),false);assert.equal(reads,0);
  for(const value of [{...protocol,networkId:"private"},{...protocol,identity:"url-match"},{...protocol,order:"early"},{...protocol,terminal:"EOF"},{...protocol,publicTerminal:"ACK"}])assert.equal(acceptsBrowserProtocolObservation(value),false);
  const detail={phase:"after-blank",pathClass:"other-authorized",resource:"other",frame:"main",stopAck:"owned-page",introducedStage:"fixtures",routeOutcome:"continue-ack"},base={...blankAdminBrowserCase("BLOCK_LIVE_BROWSER"),status:"failed",code:"QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING",pendingRequests:1,quiescenceDetail:detail};
  assert.deepEqual(validateAdminBrowserCase(base).quiescenceDetail,detail);const next=validateAdminBrowserCase({...base,quiescenceDetail:{...detail,protocol}});assert.equal(next.status,"failed");assert.equal(next.pendingRequests,1);assert.equal(next.counts.cleanupHttp,0);assert.deepEqual(next.quiescenceDetail.protocol,protocol);
  assert.throws(()=>validateAdminBrowserCase({...base,code:"BROWSER_REFUSED",quiescenceDetail:{...detail,protocol}}),{message:"REPORT_REFUSED"});f.observer.dispose();
});
async function installedRouteImpl(){
  const source=await readFile(new URL("../../node_modules/playwright-core/lib/coreBundle.js",import.meta.url),"utf8"),ast=ts.createSourceFile("installed-core.js",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let caught,route;
  const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==="catchDisallowedErrors")caught=node.getText(ast);if(ts.isBinaryExpression(node)&&node.left.getText(ast)==="RouteImpl"&&ts.isClassExpression(node.right))route=node.right.getText(ast);ts.forEachChild(node,visit);};visit(ast);assert.ok(caught&&route);
  const catcher=new Function("isProtocolError","return ("+caught+");")(error=>error.protocol===true);
  return new Function("catchDisallowedErrors","removeCookieHeader","assert","errorReasons","return ("+route+");")(catcher,headers=>headers,assert,{failed:"Failed"});
}
function fetchCommandPorts({result="resolved",foreignFirst=false,sendAccessor=false}={}){
  const session=new EventEmitter(),foreign=new EventEmitter(),implementations=new WeakMap(),server={},serverPage={},managerMap=new Map(),sessionMap=new Map((foreignFirst?[foreign,session]:[session,foreign]).map(value=>[value,{session:value}]));
  const connection={toImpl:client=>implementations.get(client)},page={_connection:connection,_guid:"synthetic-fetch-page"},request={_connection:connection,_guid:"synthetic-fetch-request"},key="synthetic-network",interception="synthetic-fetch";
  const manager={_page:serverPage,_requestIdToRequest:managerMap,_sessions:sessionMap},route={_session:session,_interceptionId:interception},entry={request:server,session,_requestId:key,_originalRequestRoute:route};serverPage.delegate={_networkManager:manager};implementations.set(page,serverPage);implementations.set(request,server);
  let calls=0,privateReads=0,settle,lastArgs;const failure=Object.assign(Error("synthetic provider detail"),{protocol:true}),response=Object.defineProperty({},"headers",{get(){privateReads++;throw Error("PRIVATE_CANARY");}}),pending=new Promise((resolve,reject)=>{settle=()=>result==="rejected"?reject(failure):resolve(response);});
  const originalSend=function(...args){assert.equal(this,session);calls++;lastArgs=args;assert.ok(["Fetch.continueRequest","Fetch.failRequest"].includes(args[0]));assert.equal(args[1].requestId,interception);return pending;};
  session.send=originalSend;foreign.send=()=>Promise.resolve();if(sendAccessor)Object.defineProperty(session,"send",{get(){privateReads++;throw Error("PRIVATE_CANARY");},configurable:true});
  const observer=createBrowserProtocolObserver({fetchCommands:true});assert.equal(observer.observePage(page),true);managerMap.set(key,entry);session.emit("Network.requestWillBeSent",{requestId:key});session.emit("Fetch.requestPaused",{networkId:key,requestId:interception});observer.request(request,page);
  const live=new Set([request]);for(const kind of["finished","failed"])session.on("public-"+kind,value=>{observer.terminal(value,kind);live.delete(value);});
  return{observer,session,foreign,manager,managerMap,sessionMap,page,request,key,interception,route,entry,implementations,originalSend,pending,settle,failure,response,live,calls:()=>calls,lastArgs:()=>lastArgs,privateReads:()=>privateReads};
}
test("Fetch command opt-in preserves original this, args, Promise, result and rejection without terminal authority",async()=>{
  for(const result of["resolved","rejected"]){const f=fetchCommandPorts({result}),params={requestId:f.interception};for(const name of["url","headers","body"])Object.defineProperty(params,name,{get(){throw Error("PRIVATE_CANARY");}});
    const marker={},sent=f.session.send("Fetch.continueRequest",params,marker);assert.equal(sent,f.pending);assert.equal(f.lastArgs()[1],params);assert.equal(f.lastArgs()[2],marker);assert.equal(f.lastArgs().length,3);assert.equal(f.calls(),1);assert.equal(f.observer.snapshot([f.request]).fetchOutcome,"pending");assert.equal(f.live.size,1);
    f.settle();if(result==="resolved")assert.equal(await sent,f.response);else await assert.rejects(sent,error=>error===f.failure);
    const snapshot=f.observer.snapshot([f.request]);assert.equal(snapshot.fetchCommand,"continue");assert.equal(snapshot.fetchOutcome,result);assert.equal(snapshot.terminal,"not-observed");assert.equal(snapshot.publicTerminal,"not-observed");assert.equal(f.live.size,1);assert.equal(f.privateReads(),0);assert.equal(f.managerMap.get(f.key),f.entry);
    f.session.emit("public-finished",f.request);assert.equal(f.live.size,0);assert.equal(snapshot.publicTerminal,"not-observed");f.observer.dispose();assert.equal(f.session.send,f.originalSend);
  }
});
test("Fetch original installed RouteImpl can ACK a rejected command while exact request stays registered",async()=>{
  const Route=await installedRouteImpl();for(const mode of["continue","abort"]){const f=fetchCommandPorts({result:"rejected"}),origins=createBrowserRequestOriginTracker(["fixture"]);origins.request(f.request,"fixture");const ack=origins.routeStarted(f.request,mode),route=new Route(f.session,f.interception),running=mode==="continue"?route.continue({}):route.abort();
    assert.equal(f.observer.snapshot([f.request]).fetchOutcome,"pending");f.settle();await running;ack();const snapshot=f.observer.snapshot([f.request]);assert.equal(snapshot.fetchCommand,mode);assert.equal(snapshot.fetchOutcome,"rejected");assert.equal(origins.snapshot([f.request]).routeOutcome,mode+"-ack");assert.equal(snapshot.managerEntry,"same-request");assert.equal(snapshot.sessionRegistered,"registered");assert.equal(snapshot.publicTerminal,"not-observed");assert.equal(f.live.size,1);assert.equal(f.calls(),1);assert.equal(f.privateReads(),0);f.observer.dispose();
  }
});
test("Fetch provenance needs exact route session and interception with registered membership; foreign IDs cannot grant outcomes",async()=>{
  for(const mode of["session","interception","removed","route-accessor","send-accessor","duplicate"]){const f=fetchCommandPorts({foreignFirst:true,sendAccessor:mode==="send-accessor"});
    if(mode==="session")f.route._session=f.foreign;if(mode==="interception")f.route._interceptionId="synthetic-foreign";if(mode==="removed")f.sessionMap.delete(f.session);if(mode==="route-accessor")Object.defineProperty(f.entry,"_originalRequestRoute",{get(){throw Error("PRIVATE_CANARY");}});
    if(mode==="duplicate"){const a=f.session.send("Fetch.continueRequest",{requestId:f.interception}),b=f.session.send("Fetch.continueRequest",{requestId:f.interception});assert.equal(a,b);f.settle();await a;}
    const snapshot=f.observer.snapshot([f.request]);assert.equal(snapshot.fetchOutcome,"unavailable");assert.equal(snapshot.fetchCommand,"unavailable");assert.equal(f.live.size,1);assert.equal(f.privateReads(),0);f.observer.dispose();
  }
  const f=fetchCommandPorts();f.foreign.send("Fetch.continueRequest",{requestId:f.interception});await Promise.resolve();assert.equal(f.observer.snapshot([f.request]).fetchOutcome,"unobserved");assert.equal(f.calls(),0);f.observer.dispose();
});
test("Fetch observation restores inherited/own descriptors and never overwrites a later provider change",()=>{
  const inherited=fetchCommandPorts();inherited.observer.dispose();const own=Object.getOwnPropertyDescriptor(inherited.session,"send");delete inherited.session.send;const prototype=Object.create(Object.getPrototypeOf(inherited.session));Object.defineProperty(prototype,"send",own);Object.setPrototypeOf(inherited.session,prototype);
  const observer=createBrowserProtocolObserver({fetchCommands:true});assert.equal(observer.observePage(inherited.page),true);assert.equal(Object.hasOwn(inherited.session,"send"),true);observer.dispose();assert.equal(Object.hasOwn(inherited.session,"send"),false);assert.equal(inherited.session.send,own.value);
  const changed=fetchCommandPorts(),replacement=()=>Promise.resolve();changed.session.send=replacement;changed.observer.dispose();assert.equal(changed.session.send,replacement);
});
test("Fetch observer preserves a synchronous thrown value without exporting private IDs",()=>{
  const f=fetchCommandPorts();f.observer.dispose();const thrown=Object.defineProperty({},"message",{get(){throw Error("PRIVATE_CANARY");}});f.session.send=()=>{throw thrown;};const observer=createBrowserProtocolObserver({fetchCommands:true});assert.equal(observer.observePage(f.page),true);f.session.emit("Network.requestWillBeSent",{requestId:f.key});f.session.emit("Fetch.requestPaused",{networkId:f.key,requestId:f.interception});observer.request(f.request,f.page);
  assert.throws(()=>f.session.send("Fetch.failRequest",{requestId:f.interception}),error=>error===thrown);assert.equal(observer.snapshot([f.request]).fetchOutcome,"rejected");assert.equal(JSON.stringify(observer.snapshot([f.request])).includes("synthetic-"),false);observer.dispose();
});
test("Fetch observation never invokes parameter getters while forwarding the exact original call",async()=>{
  const f=fetchCommandPorts();f.observer.dispose();let reads=0,calls=0;const params=Object.defineProperty({},"requestId",{get(){reads++;throw Error("PRIVATE_CANARY");}}),result=Promise.resolve();f.session.send=function(method,args){assert.equal(this,f.session);assert.equal(method,"Fetch.continueRequest");assert.equal(args,params);calls++;return result;};
  const observer=createBrowserProtocolObserver({fetchCommands:true});assert.equal(observer.observePage(f.page),true);f.session.emit("Network.requestWillBeSent",{requestId:f.key});f.session.emit("Fetch.requestPaused",{networkId:f.key,requestId:f.interception});observer.request(f.request,f.page);assert.equal(f.session.send("Fetch.continueRequest",params),result);await result;assert.equal(reads,0);assert.equal(calls,1);assert.equal(observer.snapshot([f.request]).fetchOutcome,"unavailable");assert.equal(f.live.size,1);observer.dispose();
});
test("Fetch repeated interception identity across distinct ServerRequests remains unavailable",()=>{
  const f=fetchCommandPorts(),second={_connection:f.request._connection,_guid:"synthetic-second-client"},server={};f.implementations.set(second,server);f.managerMap.set("synthetic-second-network",{_requestId:"synthetic-second-network",session:f.session,request:server,_originalRequestRoute:{_session:f.session,_interceptionId:f.interception}});
  f.session.emit("Network.requestWillBeSent",{requestId:"synthetic-second-network"});f.session.emit("Fetch.requestPaused",{networkId:"synthetic-second-network",requestId:f.interception});f.observer.request(second,f.page);
  for(const request of[f.request,second])assert.equal(f.observer.snapshot([request]).fetchOutcome,"unavailable");assert.equal(f.calls(),0);assert.equal(f.managerMap.size,2);assert.equal(f.live.size,1);f.observer.dispose();
});
test("Fetch finite command bounds keep every original call and request while making diagnosis unavailable",async()=>{
  for(const mode of["keys","attempts"]){const f=fetchCommandPorts();f.observer.dispose();let calls=0;const result=Promise.resolve();f.session.send=()=>{calls++;return result;};const observer=createBrowserProtocolObserver({fetchCommands:true});assert.equal(observer.observePage(f.page),true);f.session.emit("Network.requestWillBeSent",{requestId:f.key});f.session.emit("Fetch.requestPaused",{networkId:f.key,requestId:f.interception});observer.request(f.request,f.page);
    const count=mode==="keys"?4097:8193;for(let i=0;i<count;i++)assert.equal(f.session.send("Fetch.continueRequest",{requestId:mode==="keys"?"ram-key-"+i:f.interception}),result);await result;
    assert.equal(calls,count);assert.equal(observer.metadata().bounded,true);assert.equal(observer.snapshot([f.request]).fetchOutcome,"unavailable");assert.equal(f.managerMap.get(f.key),f.entry);assert.equal(f.live.size,1);observer.dispose();
  }
});
test("Fetch late command settlement cannot replace a frozen first failure or grant cleanup",async()=>{
  const f=fetchCommandPorts(),state=createAdminBrowserState("BLOCK_LIVE_BROWSER"),sent=f.session.send("Fetch.continueRequest",{requestId:f.interception}),snapshot=f.observer.snapshot([f.request]);state.fail("QUIESCENCE_HTTP_PENDING");state.unknown();f.settle();await sent;state.fail("PROCESS_UNCONFIRMED");
  assert.equal(snapshot.fetchOutcome,"pending");assert.equal(f.observer.snapshot([f.request]).fetchOutcome,"resolved");f.session.emit("public-finished",f.request);const report=state.finish(f.live.size,0);assert.equal(report.pendingRequests,0);assert.equal(report.status,"failed");assert.equal(report.code,"QUIESCENCE_HTTP_PENDING");assert.equal(report.writeOutcomeUncertain,true);assert.equal(report.counts.cleanupHttp,0);assert.equal(report.counts.deleted,0);f.observer.dispose();
});
test("Fetch contract accepts exact four/six/eight fields and refuses partial pairs, getters and terminal labels",()=>{
  const f=fetchCommandPorts(),snapshot=f.observer.snapshot([f.request]);assert.equal(acceptsBrowserProtocolObservation(snapshot),true);const six={...snapshot};delete six.fetchCommand;delete six.fetchOutcome;assert.equal(acceptsBrowserProtocolObservation(six),true);const four={...six};delete four.managerEntry;delete four.sessionRegistered;assert.equal(acceptsBrowserProtocolObservation(four),true);
  for(const field of["fetchCommand","fetchOutcome"]){const partial={...snapshot};delete partial[field];assert.equal(acceptsBrowserProtocolObservation(partial),false);assert.equal(acceptsBrowserProtocolObservation(Object.defineProperty({...snapshot},field,{enumerable:true,get(){throw Error("PRIVATE_CANARY");}})),false);}
  for(const extra of[{fetchOutcome:"EOF"},{fetchOutcome:"ACK"},{fetchCommand:"synthetic-id"},{url:"PRIVATE"}])assert.equal(acceptsBrowserProtocolObservation({...snapshot,...extra}),false);
  const legacy=protocolPorts();legacy.emit("will");legacy.emit("pause");assert.equal(Object.hasOwn(legacy.observer.snapshot([legacy.request]),"fetchOutcome"),false);legacy.observer.dispose();f.observer.dispose();
});
test("request origin observations retain the first event stage and route ACK never removes real IO",async()=>{
 const origins=createBrowserRequestOriginTracker(ADMIN_BROWSER_STAGES.BLOCK_LIVE_BROWSER);let reads=0;
 const request=Object.defineProperties({},{url:{get(){reads++;throw Error("PRIVATE");}},headers:{get(){reads++;throw Error("PRIVATE");}}}),live=new Map([[request,{responseSeen:false}]]);
 origins.request(request,"fixtures");origins.request(request,"actor-intact");
 assert.deepEqual(origins.snapshot([request]),{introducedStage:"fixtures",routeOutcome:"unobserved"});
 const ack=origins.routeStarted(request,"continue");assert.equal(origins.snapshot([request]).routeOutcome,"pending");
 await Promise.resolve();ack();ack();assert.deepEqual(origins.snapshot([request]),{introducedStage:"fixtures",routeOutcome:"continue-ack"});assert.equal(live.size,1);assert.equal(reads,0);
});
test("request origin refused routing stays pending and stale ACK never overwrites a later attempt",async()=>{
 const origins=createBrowserRequestOriginTracker(["fixtures"]),request={};origins.request(request,"fixtures");
 const oldAck=origins.routeStarted(request,"continue");await assert.rejects(Promise.reject(Object.create(null)));assert.equal(origins.snapshot([request]).routeOutcome,"pending");
 const abortAck=origins.routeStarted(request,"abort");oldAck();assert.equal(origins.snapshot([request]).routeOutcome,"pending");abortAck();oldAck();assert.equal(origins.snapshot([request]).routeOutcome,"abort-ack");
});
test("request origin aggregation distinguishes mixed, unavailable and unobserved without backfilling frozen snapshots",()=>{
 const origins=createBrowserRequestOriginTracker(["fixtures","actor-intact"]),a={},b={},foreign={};
 assert.deepEqual(origins.snapshot([]),{introducedStage:"unavailable",routeOutcome:"unobserved"});origins.request(a,null);const frozen=origins.snapshot([a]);origins.routeStarted(a,"continue")();assert.deepEqual(frozen,{introducedStage:"unavailable",routeOutcome:"unobserved"});
 origins.request(b,"actor-intact");assert.deepEqual(origins.snapshot([a,b]),{introducedStage:"mixed",routeOutcome:"mixed"});assert.deepEqual(origins.snapshot([foreign]),{introducedStage:"unavailable",routeOutcome:"unobserved"});
 const early={};origins.routeStarted(early,"continue")();assert.deepEqual(origins.snapshot([early]),{introducedStage:"unavailable",routeOutcome:"continue-ack"});origins.request(early,"fixtures");assert.equal(origins.snapshot([early]).introducedStage,"fixtures");
});
test("request origin metadata rejects getters, sparse or unbounded inputs and invalid enums without reading private values",()=>{
 let reads=0;const privateStage=Object.defineProperty(["fixtures"],"0",{enumerable:true,get(){reads++;throw Error("PRIVATE");}});
 assert.throws(()=>createBrowserRequestOriginTracker(privateStage),{message:"REPORT_REFUSED"});
 for(const stages of[[],["fixtures","fixtures"],["mixed"],["unavailable"],["https://private.invalid"]])assert.throws(()=>createBrowserRequestOriginTracker(stages),{message:"PROCESS_UNCONFIRMED"});
 const origins=createBrowserRequestOriginTracker(["fixtures"]),request={};assert.throws(()=>origins.request(request,"PRIVATE"),{message:"PROCESS_UNCONFIRMED"});assert.throws(()=>origins.routeStarted(request,"PRIVATE"),{message:"PROCESS_UNCONFIRMED"});
 const keys=Object.defineProperty([request],"0",{enumerable:true,get(){reads++;throw Error("PRIVATE");}});for(const v of[keys,Array(1),Array.from({length:1025},()=>request),Object.assign([request],{url:"PRIVATE"})])assert.throws(()=>origins.snapshot(v),{message:"PROCESS_UNCONFIRMED"});assert.equal(reads,0);
});

// Execute only the original transient gate and original terminal callbacks.
// No spec initializer, browser, HTTP, SQL or synthetic deletion by the gate.
let finiteReadSource;
async function originalFiniteReads(){
 finiteReadSource??=(async()=>{
  const source=await readFile(new URL("../e2e-auth-local/admin-browser-local.spec.ts",import.meta.url),"utf8"),ast=ts.createSourceFile("admin.spec.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),gates=[],terminals=new Map();
  const visit=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==="finiteReads")gates.push(node.initializer.getText(ast));if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==="on"&&ts.isStringLiteral(node.arguments[0])&&["requestfinished","requestfailed"].includes(node.arguments[0].text)){assert.equal(terminals.has(node.arguments[0].text),false);terminals.set(node.arguments[0].text,node.arguments[1].getText(ast));}ts.forEachChild(node,visit);};visit(ast);assert.equal(gates.length,1);assert.equal(terminals.size,2);
  const body=`const {state,nonReadRequests,liveRequests,routeOperations,uiOperations,performance,waitForAdminBrowserHttpQuiet,pendingHttpCode,adminBrowserPendingCode,adminBrowserRefuse,protocolObserver,isAdminAuthActionRequest}=ports;const finiteReads=${gates[0]};return {finiteReads,finished:${terminals.get("requestfinished")},failed:${terminals.get("requestfailed")}};`;
  return new Function("ports",ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText);
 })();return finiteReadSource;
}
async function finiteReadFixture({onPause=()=>{},afterWait=()=>{}}={}){
 let clock=0,pauses=0;const state=createAdminBrowserState("BLOCK_LIVE_BROWSER",{now:()=>clock}),liveRequests=new Map(),nonReadRequests=new Set(),routeOperations=new Set(),uiOperations=new Set(),events=new EventEmitter(),snapshots=[],terminals=[];
 const ports={state,liveRequests,nonReadRequests,routeOperations,uiOperations,performance:{now:()=>clock},adminBrowserPendingCode,adminBrowserRefuse,isAdminAuthActionRequest,protocolObserver:{terminal:(request,kind)=>terminals.push({request,kind})},pendingHttpCode:()=>adminBrowserHttpPendingCode([...liveRequests.values()].filter(row=>row.kind==="otherHttp").map(({httpClass,responseSeen})=>({httpClass,responseSeen}))),waitForAdminBrowserHttpQuiet:async(read,options)=>{const result=await waitForAdminBrowserHttpQuiet(()=>{const snapshot=read();snapshots.push(snapshot);return snapshot;},{...options,now:()=>clock,pause:async ms=>{clock+=ms;await onPause(++pauses,{events,liveRequests,nonReadRequests,routeOperations});}});afterWait({liveRequests,nonReadRequests,routeOperations,setClock:value=>{clock=value;}});return result;}};
 const bound=(await originalFiniteReads())(ports);events.on("requestfinished",bound.finished);events.on("requestfailed",bound.failed);
 return{...bound,...ports,events,snapshots,terminals,clock:()=>clock,pauses:()=>pauses,request:(kind="otherHttp")=>{const request={url:()=>ADMIN_BROWSER_APP+"/_next/static/chunks/synthetic.js",method:()=>"GET"};liveRequests.set(request,{kind,httpClass:"ASSET",responseSeen:false});return request;}};
}
test("Admin transient finite reads require original terminals; response and route ACK do not drain a Request",async()=>{
 let request;const f=await finiteReadFixture({onPause:async count=>{assert.equal(f.liveRequests.has(request),true);if(count===1)f.liveRequests.get(request).responseSeen=true;if(count===2)f.events.emit("requestfinished",request);}});request=f.request();
 // An already-armed response waiter is intentionally outside the read gate.
 const armedResponseWaiter=new Promise(()=>{});f.uiOperations.add(armedResponseWaiter);
 await f.finiteReads();assert.equal(f.pauses(),2);assert.equal(f.liveRequests.size,0);assert.deepEqual(f.terminals,[{request,kind:"finished"}]);assert.equal(f.state.value.counts.cleanupHttp,0);assert.equal(f.state.value.writeOutcomeUncertain,false);
});
test("Admin transient finite reads retain original route promises through settlement after a failed GET terminal",async()=>{
 let request,settle;const route=new Promise(resolve=>{settle=resolve;});const f=await finiteReadFixture({onPause:async count=>{if(count===1)f.events.emit("requestfailed",request);if(count===2){assert.equal(f.routeOperations.size,1);settle();await owned;}}});request=f.request();const owned=route.finally(()=>f.routeOperations.delete(owned));f.routeOperations.add(owned);
 await f.finiteReads();assert.equal(f.pauses(),2);assert.equal(f.routeOperations.size,0);assert.equal(f.liveRequests.size,0);assert.deepEqual(f.terminals,[{request,kind:"failed"}]);assert.equal(f.state.value.writeOutcomeUncertain,false);
});
test("Admin transient finite reads refuse in-flight writes and unknown effects without removing requests",async()=>{
 for(const mode of["write","unknown"]){const f=await finiteReadFixture(),request=f.request();if(mode==="write")f.nonReadRequests.add(request);else f.state.unknown();await assert.rejects(f.finiteReads(),{message:"WRITE_OUTCOME_UNCERTAIN"});assert.equal(f.liveRequests.has(request),true);assert.equal(f.pauses(),0);assert.equal(f.state.value.writeOutcomeUncertain,true);assert.equal(f.state.value.counts.cleanupHttp,0);}
 const prior=await finiteReadFixture();prior.state.fail("SAGA_NOT_PROVEN");await assert.rejects(prior.finiteReads(),{message:"SAGA_NOT_PROVEN"});assert.equal(prior.pauses(),0);assert.equal(prior.state.value.writeOutcomeUncertain,false);
});
test("Admin transient finite reads preserve exact HMR tracking and time out original HTTP at the unchanged15s bound",async()=>{
 const hmr=await finiteReadFixture(),stream=hmr.request("hmrGet");await hmr.finiteReads();assert.equal(hmr.liveRequests.has(stream),true);assert.equal(hmr.pauses(),0);assert.equal(hmr.terminals.length,0);
 const pending=await finiteReadFixture(),request=pending.request();await assert.rejects(pending.finiteReads(),{message:"QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING"});assert.equal(pending.clock(),15000);assert.equal(pending.liveRequests.has(request),true);assert.equal(pending.terminals.length,0);assert.equal(pending.state.value.counts.cleanupHttp,0);
});
test("Admin transient finite reads reject new original reads or route handlers arriving after the monitor settles",async()=>{
 for(const mode of["request","route"]){let request;const f=await finiteReadFixture({afterWait:()=>{if(mode==="request")request=f.request();else f.routeOperations.add(new Promise(()=>{}));}});await assert.rejects(f.finiteReads(),{message:mode==="request"?"QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING":"QUIESCENCE_UI_PENDING"});assert.equal(f.terminals.length,0);assert.equal(f.state.value.counts.cleanupHttp,0);if(mode==="request")assert.equal(f.liveRequests.has(request),true);else assert.equal(f.routeOperations.size,1);}
});
test("Admin transient finite reads reject zero arriving exactly at15s, regressing clocks and invalid final clock values",async()=>{
 let request;const late=await finiteReadFixture({onPause:count=>{if(count===600)late.events.emit("requestfinished",request);}});request=late.request();await assert.rejects(late.finiteReads(),{message:"PROCESS_UNCONFIRMED"});assert.equal(late.clock(),15000);assert.equal(late.terminals.length,1);assert.equal(late.liveRequests.size,0);assert.equal(late.state.value.counts.cleanupHttp,0);
 for(const [at,code]of[[-1,"PROCESS_UNCONFIRMED"],[NaN,"PROCESS_UNCONFIRMED"],[Infinity,"DEADLINE_EXCEEDED"],[15000,"PROCESS_UNCONFIRMED"]]){const f=await finiteReadFixture({afterWait:({setClock})=>setClock(at)});await assert.rejects(f.finiteReads(),{message:code});assert.equal(f.state.value.counts.cleanupHttp,0);}
});
test("Admin transient finite reads wire load readiness before transitions while final cleanup keeps its original deadline",async()=>{
 const source=await readFile(new URL("../e2e-auth-local/admin-browser-local.spec.ts",import.meta.url),"utf8"),ast=ts.createSourceFile("admin.spec.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),declarations=new Map();
 const visit=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&["goto","post","destination","visible","ownView","closeContexts","finiteReads"].includes(node.name.text)){assert.equal(declarations.has(node.name.text),false);declarations.set(node.name.text,node.initializer.getText(ast));}ts.forEachChild(node,visit);};visit(ast);
 for(const name of["goto","post","destination","visible"])assert.match(declarations.get(name),/await finiteReads\(\)/);
 assert.match(declarations.get("goto"),/waitUntil: "load", timeout:30000/);assert.match(declarations.get("goto"),/^async.*await finiteReads\(\); await safe/);assert.match(declarations.get("post"),/^async.*await finiteReads\(\); const before=authPosts\(page\.context\(\),path\), observed=\(\)=>authPosts\(page\.context\(\),path\)>before; const result=await safe/);assert.match(declarations.get("post"),/await runAdminAuthCheckpoint\(state,"AUTH_POST_REFUSED",finiteReads,observed\); return result/);
 assert.match(declarations.get("ownView"),/^async[^]*?\{\s*await finiteReads\(\);\s*const received=safe/);
 assert.doesNotMatch(declarations.get("finiteReads"),/uiOperations|networkidle|\.clear\(|\.delete\(|\.close\(|\.abort\(|contextsClosed\s*=/);assert.match(declarations.get("finiteReads"),/ui:routeOperations\.size/);assert.match(declarations.get("finiteReads"),/timeoutMs:15000/);
 assert.match(declarations.get("closeContexts"),/deadlineMs=previousAt\+15000/);assert.match(declarations.get("closeContexts"),/waitUntil:"domcontentloaded",timeout/);assert.doesNotMatch(declarations.get("closeContexts"),/finiteReads/);
 assert.match(source,/const action=reload\?async\(\)=>\{await finiteReads\(\);await actor\.page\.locator/);assert.match(source,/await finiteReads\(\); await safe\(\(\) => b1\.page\.locator/);
});

// Execute the original context registration and its original callbacks only.
// Ports are RAM doubles; no browser, provider, HTTP or SQL is instantiated.
async function adminPostDiagnosticFixture(kind="BLOCK_LIVE_BROWSER"){
 const source=await readFile(new URL("../e2e-auth-local/admin-browser-local.spec.ts",import.meta.url),"utf8"),ast=ts.createSourceFile("admin.spec.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),found=new Map();
 const visit=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&["safe","unavailableRead","makeContext"].includes(node.name.text)){assert.equal(found.has(node.name.text),false);found.set(node.name.text,node.initializer.getText(ast));}ts.forEachChild(node,visit);};visit(ast);assert.equal(found.size,3);
 const c=new EventEmitter(),page=new EventEmitter(),frame={page:()=>page};Object.assign(page,{context:()=>c,mainFrame:()=>frame});Object.assign(c,{route:async()=>{},newPage:async()=>page});
 const state=createAdminBrowserState(kind,{now:()=>0}),liveRequests=new Map(),nonReadRequests=new Set(),uiOperations=new Set();
 const ports={state,contexts:[],liveRequests,nonReadRequests,uiOperations,routeOperations:new Set(),routeFences:new Set(),browser:{newContext:async()=>c},guard:closedBrowserOperation,ADMIN_BROWSER_APP,adminBrowserRefuse,acceptAdminBrowserRequest,isAdminBrowserReadCancellationRequest,isAdminCanonicalHmrGet,classifyAdminBrowserHttpRequest,isAdminBrowserParkableAuthRead,isAdminAuthActionRequest,observedAuthPosts:new WeakMap(),requestOrigins:createBrowserRequestOriginTracker(ADMIN_BROWSER_STAGES[kind]),protocolObserver:{request(){},terminal(){},observePage:()=>true},nextStop:{capture:()=>false,replace:()=>false},createQuiescenceFence:()=>({handle:()=>assert.fail("No route operation in this RAM fixture"),arm(){}})};
 const body=`const {state,contexts,liveRequests,nonReadRequests,uiOperations,routeOperations,routeFences,browser,guard,ADMIN_BROWSER_APP,adminBrowserRefuse,acceptAdminBrowserRequest,isAdminBrowserReadCancellationRequest,isAdminCanonicalHmrGet,classifyAdminBrowserHttpRequest,isAdminBrowserParkableAuthRead,isAdminAuthActionRequest,observedAuthPosts,requestOrigins,protocolObserver,nextStop,createQuiescenceFence}=ports;let parkingPages=false,routeSealed=false,routeVeto=false;const safe=${found.get("safe")};const unavailableRead=${found.get("unavailableRead")};const makeContext=${found.get("makeContext")};return makeContext;`;
 const make=new Function("ports",ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText)(ports);await make();
 return{state,c,page,frame,liveRequests,nonReadRequests,uiOperations,authPosts:(context,path)=>ports.observedAuthPosts.get(context)?.get(path)??0,request:({path="/entrar",resource="fetch",failure="net::ERR_ABORTED"}={})=>({url:()=>ADMIN_BROWSER_APP+path,method:()=>"POST",frame:()=>frame,resourceType:()=>{if(resource==="throws")throw Error("PRIVATE_CANARY");return resource;},failure:()=>{if(failure==="throws")throw Error("PRIVATE_CANARY");return failure===undefined?null:{errorText:failure};}})};
}
const adminPostResponse=(request,{status=200,contentType="text/x-component; charset=utf-8",url=request.url()}={})=>({request:()=>request,url:()=>url,status:()=>status,headers:()=>Object.defineProperty({"content-type":contentType},"set-cookie",{get(){throw Error("PRIVATE_CANARY");}})});
const adminPostDiagnostic=()=>({operation:"login",resource:"fetch",failure:"aborted",response:"200",contentType:"flight"});
test("Admin POST failure diagnostic executes original request identity and accepted response metadata without granting an effect",async()=>{
 for(const [path,operation,status,type,contentType]of[["/entrar","login",200,"text/x-component; charset=utf-8","flight"],["/trocar-senha","password",303,"text/html","html"],["/entrar","login",418,"application/json","other"]]){const f=await adminPostDiagnosticFixture(path==="/trocar-senha"?"FIRST_FORCED_BROWSER":"BLOCK_LIVE_BROWSER"),request=f.request({path});f.c.emit("request",request);f.c.emit("response",adminPostResponse(request,{status,contentType:type}));f.c.emit("requestfailed",request);const report=f.state.finish(f.liveRequests.size,0);assert.deepEqual(report.authPostFailure,{operation,resource:"fetch",failure:"aborted",response:status===200?"200":status===303?"303":"other",contentType});assert.equal(report.status,"failed");assert.equal(report.code,"TRANSPORT_FAILED");assert.equal(report.writeOutcomeUncertain,true);assert.equal(report.counts.cleanupHttp,0);assert.equal(Object.isFrozen(f.state.value.authPostFailure),true);}
});
test("Admin POST failure diagnostic freezes the first failure and first accepted response without late retrofit",async()=>{
 const f=await adminPostDiagnosticFixture(),request=f.request();f.c.emit("request",request);f.c.emit("requestfailed",request);const original=f.state.value.authPostFailure;assert.deepEqual(original,{...adminPostDiagnostic(),response:"unobserved",contentType:"unobserved"});f.c.emit("response",adminPostResponse(request));f.c.emit("requestfailed",request);assert.equal(f.state.value.authPostFailure,original);
 const first=await adminPostDiagnosticFixture(),post=first.request();first.c.emit("request",post);first.c.emit("response",adminPostResponse(post));first.c.emit("response",adminPostResponse(post,{status:303,contentType:"text/html"}));first.c.emit("requestfailed",post);assert.deepEqual(first.state.value.authPostFailure,adminPostDiagnostic());
 for(const code of["SAGA_NOT_PROVEN","TRANSPORT_FAILED"]){const prior=await adminPostDiagnosticFixture(),pending=prior.request();prior.c.emit("request",pending);prior.state.fail(code);prior.c.emit("requestfailed",pending);assert.equal(prior.state.value.authPostFailure,null);assert.equal(prior.state.value.code,code);assert.equal(prior.state.value.writeOutcomeUncertain,true);}
});
test("Admin POST failure diagnostic withholds foreign response identity and exports only closed fallback enums",async()=>{
 const f=await adminPostDiagnosticFixture(),request=f.request(),other=f.request();f.c.emit("request",request);f.c.emit("response",adminPostResponse(other));f.c.emit("requestfailed",request);assert.deepEqual(f.state.value.authPostFailure,{...adminPostDiagnostic(),response:"unobserved",contentType:"unobserved"});
 for(const [resource,failure,expectedResource,expectedFailure]of[["document","net::ERR_FAILED","document","failed"],["xhr","PRIVATE_CANARY","xhr","other"],["throws","throws","unavailable","unavailable"],[123,null,"unavailable","other"]]){const own=await adminPostDiagnosticFixture(),post=own.request({resource,failure});own.c.emit("request",post);own.c.emit("requestfailed",post);assert.deepEqual(own.state.value.authPostFailure,{operation:"login",resource:expectedResource,failure:expectedFailure,response:"unobserved",contentType:"unobserved"});assert.equal(JSON.stringify(own.state.finish(0,0)).includes("PRIVATE_CANARY"),false);}
});
test("Admin POST failure diagnostic metadata exceptions retain closed fallbacks and the original transport failure",async()=>{
 for(const field of["status","headers","both"]){const f=await adminPostDiagnosticFixture(),request=f.request(),response=adminPostResponse(request);if(field!=="headers")response.status=()=>{throw Error("PRIVATE_STATUS_CANARY");};if(field!=="status")response.headers=()=>{throw Error("PRIVATE_HEADER_CANARY");};f.c.emit("request",request);f.c.emit("response",response);f.c.emit("requestfailed",request);const value=f.state.finish(0,0);assert.deepEqual(value.authPostFailure,{...adminPostDiagnostic(),response:field==="headers"?"200":"other",contentType:field==="status"?"flight":"other"});assert.equal(value.code,"TRANSPORT_FAILED");assert.equal(value.writeOutcomeUncertain,true);assert.equal(JSON.stringify(value).includes("CANARY"),false);assert.equal(value.counts.cleanupHttp,0);}
});
test("Admin POST failure report accepts legacy absence and refuses private fields, malformed enums or success contexts",()=>{
 const value={...blankAdminBrowserCase("BLOCK_LIVE_BROWSER"),status:"failed",code:"TRANSPORT_FAILED",writeOutcomeUncertain:true,authPostFailure:adminPostDiagnostic()};assert.deepEqual(validateAdminBrowserCase(value).authPostFailure,adminPostDiagnostic());const legacy={...value};delete legacy.authPostFailure;assert.equal(validateAdminBrowserCase(legacy).authPostFailure,undefined);
 const blank=blankAdminBrowserCase("BLOCK_LIVE_BROWSER"),passed={...blank,status:"passed",code:"PASSED",stages:ADMIN_BROWSER_STAGES.BLOCK_LIVE_BROWSER.map(stage=>({stage,passed:true})),counts:{...blank.counts,...ADMIN_BROWSER_PASS_COUNTS.BLOCK_LIVE_BROWSER,ownedSdkRequests:18,sqlInspections:8,browserRequests:3}};
 assert.equal(validateAdminBrowserCase(passed).status,"passed");assert.equal(validateAdminBrowserCase(blank).status,"not-run");for(const baseline of[passed,blank])assert.throws(()=>validateAdminBrowserCase({...baseline,authPostFailure:adminPostDiagnostic()}),{message:"REPORT_REFUSED"});
 for(const patch of[{code:"BROWSER_REFUSED"},{writeOutcomeUncertain:false}])assert.throws(()=>validateAdminBrowserCase({...value,...patch}),{message:"REPORT_REFUSED"});
 for(const diagnostic of[{...adminPostDiagnostic(),url:"PRIVATE"},{...adminPostDiagnostic(),operation:"recovery"},{...adminPostDiagnostic(),resource:"script"},{...adminPostDiagnostic(),failure:"net::ERR_ABORTED"},{...adminPostDiagnostic(),response:200},{...adminPostDiagnostic(),contentType:"unobserved"},[]])assert.throws(()=>validateAdminBrowserCase({...value,authPostFailure:diagnostic}),{message:"REPORT_REFUSED"});
 let reads=0;const hidden=Object.defineProperty({...adminPostDiagnostic()},"failure",{enumerable:true,get(){reads++;throw Error("PRIVATE");}});assert.throws(()=>validateAdminBrowserCase({...value,authPostFailure:hidden}),{message:"REPORT_REFUSED"});assert.equal(reads,0);
});

async function originalAdminPostFixture({status=200,finishedValue=null,path="/entrar",preflightCode=null,postdrainCode=null}={}){
 const f=await adminPostDiagnosticFixture(path==="/trocar-senha"?"FIRST_FORCED_BROWSER":"BLOCK_LIVE_BROWSER"),source=await readFile(new URL("../e2e-auth-local/admin-browser-local.spec.ts",import.meta.url),"utf8"),ast=ts.createSourceFile("admin.spec.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),found=new Map();
 const visit=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&["safe","post"].includes(node.name.text)){assert.equal(found.has(node.name.text),false);found.set(node.name.text,node.initializer.getText(ast));}ts.forEachChild(node,visit);};visit(ast);assert.equal(found.size,2);
 const order=[];let finishReject,terminalResolve,responseResolve,finishedCalls=0,actionCalls=0,finiteReadCalls=0;const bodyEnd=new Promise(resolve=>{terminalResolve=resolve;}),request=f.request({path}),response=adminPostResponse(request,{status});response.finished=()=>{finishedCalls++;return bodyEnd;};
 Object.assign(f.page,{
  waitForEvent:(event,options)=>{assert.equal(event,"requestfinished");assert.equal(options.timeout,20000);order.push("finished-waiter");return new Promise((resolve,reject)=>{finishReject=reject;const listener=value=>{if(options.predicate(value)){f.c.off(event,listener);resolve(value);}};f.c.on(event,listener);});},
  waitForResponse:(predicate,options)=>{assert.equal(options.timeout,20000);order.push("response-waiter");return new Promise(resolve=>{responseResolve=value=>{if(predicate(value))resolve(value);};f.c.on("response",responseResolve);});}
 });
 const ports={state:f.state,uiOperations:f.uiOperations,guard:closedBrowserOperation,adminBrowserRefuse,isAdminAuthActionRequest,acceptAdminAuthActionResponse,authPosts:f.authPosts,runAdminAuthCheckpoint,finiteReads:async()=>{finiteReadCalls++;const code=finiteReadCalls===1?preflightCode:postdrainCode;if(code!==null){f.state.fail(code);adminBrowserRefuse(code);}f.state.active();}};
 const body=`const {state,uiOperations,guard,adminBrowserRefuse,isAdminAuthActionRequest,acceptAdminAuthActionResponse,authPosts,runAdminAuthCheckpoint,finiteReads}=ports;let pendingUi=0;const safe=${found.get("safe")};const post=${found.get("post")};return {post,pending:()=>pendingUi};`;
 const bound=new Function("ports",ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText)(ports);
 return{...f,...bound,request,response,order,finishedCalls:()=>finishedCalls,actionCalls:()=>actionCalls,finiteReadCalls:()=>finiteReadCalls,run:action=>bound.post(f.page,path,async()=>{order.push("action");actionCalls++;await action();}),start:()=>{f.c.emit("request",request);f.c.emit("response",response);},finish:(value=request)=>{f.c.emit("requestfinished",value);if(value===request)terminalResolve(finishedValue);},timeout:()=>finishReject(Error("SYNTHETIC_FINISH_TIMEOUT"))};
}
test("Admin POST terminal waiter is armed before the action and success needs the same response and original terminal",async()=>{
 const f=await originalAdminPostFixture();const result=await f.run(async()=>{assert.deepEqual(f.order,["finished-waiter","response-waiter","action"]);f.start();assert.equal(f.finishedCalls(),0);f.finish();});assert.equal(result,f.response);assert.equal(f.finishedCalls(),1);assert.equal(f.pending(),0);assert.equal(f.uiOperations.size,0);assert.equal(f.actionCalls(),1);assert.equal(f.state.value.writeOutcomeUncertain,false);assert.equal(f.state.value.authPostFailure,null);
});
test("Admin POST terminal waiter refuses an aborted POST without entering its unbounded Response.finished promise",async()=>{
 // Existing safe() caller wrapping remains unchanged. The state/diagnostic
 // keeps the original TRANSPORT_FAILED even when its thrown wrapper is closed.
 const f=await originalAdminPostFixture();await assert.rejects(f.run(async()=>{f.start();f.c.emit("requestfailed",f.request);f.timeout();}),{message:"BROWSER_REFUSED"});assert.equal(f.finishedCalls(),0);assert.equal(f.pending(),0);assert.equal(f.uiOperations.size,0);assert.equal(f.actionCalls(),1);assert.equal(f.state.value.writeOutcomeUncertain,true);assert.deepEqual(f.state.value.authPostFailure,adminPostDiagnostic());assert.equal(f.state.value.code,"TRANSPORT_FAILED");assert.equal(f.state.value.counts.cleanupHttp,0);
 const frozen=f.state.value.authPostFailure;f.c.emit("requestfailed",f.request);assert.equal(f.state.value.authPostFailure,frozen);assert.equal(f.state.value.code,"TRANSPORT_FAILED");
});
test("Admin POST terminal waiter cannot be satisfied by another Request or by a response and click alone",async()=>{
 for(const otherTerminal of[false,true]){const f=await originalAdminPostFixture();await assert.rejects(f.run(async()=>{f.start();if(otherTerminal)f.finish({});assert.equal(f.finishedCalls(),0);f.timeout();}),{message:"BROWSER_REFUSED"});assert.equal(f.finishedCalls(),0);assert.equal(f.liveRequests.has(f.request),true);assert.equal(f.actionCalls(),1);assert.equal(f.state.value.writeOutcomeUncertain,true);assert.equal(f.state.value.authPostFailure,null);}
});
test("Admin POST terminal waiter failure retains the original action promise until all branches settle",async()=>{
 let release;const actionDone=new Promise(resolve=>{release=resolve;}),f=await originalAdminPostFixture();let settled=false;const pending=f.run(async()=>{f.start();f.timeout();await actionDone;});const refused=assert.rejects(pending,{message:"BROWSER_REFUSED"}).then(()=>{settled=true;});
 for(let i=0;i<6;i++)await Promise.resolve();assert.equal(settled,false);assert.equal(f.pending(),1);assert.ok(f.uiOperations.size>0);assert.equal(f.finishedCalls(),0);release();await refused;assert.equal(f.pending(),0);assert.equal(f.uiOperations.size,0);assert.equal(f.actionCalls(),1);assert.equal(f.state.value.writeOutcomeUncertain,true);
});
test("Admin POST terminal waiter keeps status and Response.finished validation after its exact terminal",async()=>{
 for(const options of[{status:418},{finishedValue:Error("PRIVATE_FINISH_CANARY")}]){const f=await originalAdminPostFixture(options);await assert.rejects(f.run(async()=>{f.start();f.finish();}),{message:"BROWSER_REFUSED"});assert.equal(f.finishedCalls(),options.status===418?0:1);assert.equal(f.actionCalls(),1);assert.equal(f.state.value.writeOutcomeUncertain,true);assert.equal(f.state.value.counts.cleanupHttp,0);assert.equal(JSON.stringify(f.state.value).includes("PRIVATE_FINISH_CANARY"),false);}
});
test("Admin POST terminal waiter preserves unknown effects and first refusal when post-drain fails after the original POST terminal",async()=>{
 const code="QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING";
 for(const path of["/entrar","/trocar-senha"]){const f=await originalAdminPostFixture({path,postdrainCode:code});await assert.rejects(f.run(async()=>{f.start();f.finish();}),{message:"AUTH_POST_REFUSED"});assert.equal(f.finiteReadCalls(),2);assert.equal(f.actionCalls(),1);assert.equal(f.finishedCalls(),1);assert.equal(f.liveRequests.size,0);assert.equal(f.pending(),0);assert.equal(f.uiOperations.size,0);assert.equal(f.state.value.code,code);assert.equal(f.state.value.writeOutcomeUncertain,true);assert.equal(f.state.value.authPostFailure,null);assert.equal(f.state.value.counts.cleanupHttp,0);}
});
test("Admin POST terminal waiter never infers a write when its preflight fails before an action or original POST",async()=>{
 const code="QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING";
 for(const path of["/entrar","/trocar-senha"]){const f=await originalAdminPostFixture({path,preflightCode:code});await assert.rejects(f.run(async()=>assert.fail("No action before preflight succeeds")),{message:code});assert.equal(f.finiteReadCalls(),1);assert.equal(f.actionCalls(),0);assert.equal(f.finishedCalls(),0);assert.deepEqual(f.order,[]);assert.equal(f.liveRequests.size,0);assert.equal(f.pending(),0);assert.equal(f.uiOperations.size,0);assert.equal(f.state.value.counts.browserRequests,0);assert.equal(f.state.value.counts.loginPosts,0);assert.equal(f.state.value.counts.passwordPosts,0);assert.equal(f.state.value.code,code);assert.equal(f.state.value.writeOutcomeUncertain,false);assert.equal(f.state.value.authPostFailure,null);assert.equal(f.state.value.counts.cleanupHttp,0);}
});
