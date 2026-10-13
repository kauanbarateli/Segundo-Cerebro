// Test-owned Node channel. Original Core/ports/SDK remain byte unchanged.
import { randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { resolve, relative, isAbsolute, basename, dirname } from "node:path";
import { ADMIN_BROWSER_CASES, ADMIN_BROWSER_LIMITS, ADMIN_BROWSER_STAGES, ADMIN_BROWSER_CODES, ADMIN_HTTP_PENDING_CLASSES, ADMIN_HTTP_PENDING_CODES, blankAdminBrowserCase, validateAdminBrowserCase, closedAdminBrowserValue } from "./admin-browser-contract.mjs";
import { loadAdminNativeBackend, acceptsAdminNativeDeleteAcknowledgement } from "./admin-native-backend-case.mjs";
export const ADMIN_BROWSER_APP = "http://127.0.0.1:3117";
export const ADMIN_BROWSER_API = "http://127.0.0.1:54321";
export const ADMIN_BROWSER_PAGES = Object.freeze(["/", "/capturar", "/tarefas", "/calendario", "/conhecimento", "/drive", "/projetos", "/habitos", "/financeiro", "/cofre", "/configuracoes", "/integracoes", "/admin", "/ajuda", "/atividade", "/sair"]);
const fixtureId = "11111111-1111-4111-8111-111111111111";
const probes = [
  ["GET", "/api/capture-tasks?query=captures"], ["GET", "/api/capture-tasks?query=tasks"], ["POST", "/api/capture-tasks"],
  ["GET", "/api/finance"], ["POST", "/api/finance"], ["GET", "/api/knowledge"], ["POST", "/api/knowledge"],
  ["GET", "/api/projects-habits?domain=projects"], ["GET", "/api/projects-habits?domain=habits"], ["POST", "/api/projects-habits", { command: "project.create", input: { name: "Prova isolada", client_id: "admin-browser-denied-project" } }],
  ["GET", "/api/files"], ["POST", "/api/files"], ["POST", "/api/files/uploads"], ["GET", "/api/files/read?id=" + fixtureId],
  ["GET", "/api/vault"], ["POST", "/api/vault"], ["GET", "/api/settings"], ["POST", "/api/settings"], ["GET", "/api/settings/sessions"], ["GET", "/api/activity"],
  ["GET", "/api/calendar"], ["POST", "/api/calendar"], ["GET", "/api/calendar/admin-runs"], ["POST", "/api/calendar/oauth/start"],
  ["GET", "/api/search?q=prova"], ["GET", "/api/admin"], ["POST", "/api/admin"],
];
export const ADMIN_BROWSER_PROBES = Object.freeze(probes.map(([method, path, body]) => Object.freeze({ method, path, body: method === "POST" ? Object.freeze(body ?? {}) : null })));
export const ADMIN_BROWSER_AUTOMATIC = Object.freeze([Object.freeze({ method: "GET", path: "/api/calendar", authority: "ordinary-shell-only" })]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const NS = /^sc-admin-native-[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
export function adminBrowserRefuse(code) { const e = new Error(ADMIN_BROWSER_CODES.includes(code) ? code : "BROWSER_REFUSED"); e.name = "AdminBrowserFailure"; e.stack = e.name + ": " + e.message; throw e; }
export async function closedBrowserOperation(operation, code = "BROWSER_REFUSED") { try { return await operation(); } catch { adminBrowserRefuse(code); } }
// Observation only: route ACK is never a request terminal or cleanup authority.
// Request identity/stage are captured once; snapshots never read provider data
// or mutate the actual IO tracker.
export function createBrowserRequestOriginTracker(allowedStages){
  const stages=closedAdminBrowserValue(allowedStages);
  if(!Array.isArray(stages)||stages.length<1||stages.length>64||new Set(stages).size!==stages.length||stages.some(s=>typeof s!=="string"||!(/^[a-z][a-z0-9-]{0,63}$/).test(s)||["mixed","unavailable"].includes(s)))adminBrowserRefuse("PROCESS_UNCONFIRMED");
  const entries=new WeakMap();
  const entry=request=>{if(!request||typeof request!=="object")adminBrowserRefuse("PROCESS_UNCONFIRMED");let value=entries.get(request);if(!value){value={observed:false,stage:null,outcome:"unobserved",version:0};entries.set(request,value);}return value;};
  return Object.freeze({
    request(request,stage){const value=entry(request);if(stage!==null&&!stages.includes(stage))adminBrowserRefuse("PROCESS_UNCONFIRMED");if(!value.observed){value.observed=true;value.stage=stage;}},
    routeStarted(request,mode){if(!["continue","abort"].includes(mode))adminBrowserRefuse("PROCESS_UNCONFIRMED");const value=entry(request),version=++value.version;value.outcome="pending";let acknowledged=false;return()=>{if(!acknowledged&&value.version===version){acknowledged=true;value.outcome=mode+"-ack";}};},
    snapshot(requests){
      let d;try{if(!Array.isArray(requests)||Object.getPrototypeOf(requests)!==Array.prototype)adminBrowserRefuse("PROCESS_UNCONFIRMED");d=Object.getOwnPropertyDescriptors(requests);}catch{adminBrowserRefuse("PROCESS_UNCONFIRMED");}
      const length=d.length?.value;if(!Number.isSafeInteger(length)||length<0||length>ADMIN_BROWSER_LIMITS.browserRequests||Reflect.ownKeys(d).length!==length+1)adminBrowserRefuse("PROCESS_UNCONFIRMED");
      const observed=[];for(let i=0;i<length;i++){const slot=d[String(i)];if(!slot||!Object.hasOwn(slot,"value")||!slot.enumerable||!slot.value||typeof slot.value!=="object")adminBrowserRefuse("PROCESS_UNCONFIRMED");const value=entries.get(slot.value);observed.push({introducedStage:value?.observed&&value.stage!==null?value.stage:"unavailable",routeOutcome:value?.outcome??"unobserved"});}
      const aggregate=(key,empty)=>{const values=new Set(observed.map(v=>v[key]));return values.size===0?empty:values.size===1?[...values][0]:"mixed";};
      return Object.freeze({introducedStage:aggregate("introducedStage","unavailable"),routeOutcome:aggregate("routeOutcome","unobserved")});
    }
  });
}
// Playwright1.63 identity observation; Fetch opt-in temporarily wraps send while
// preserving the original call/Promise and restoring its descriptor on dispose.
// No extra commands or map/verdict mutations. Opaque identifiers stay in RAM.
export function createBrowserProtocolObserver(options={}){
  const config=closedAdminBrowserValue(options);
  if(!config||Array.isArray(config)||Object.keys(config).some(k=>k!=="fetchCommands")||Object.hasOwn(config,"fetchCommands")&&typeof config.fetchCommands!=="boolean")adminBrowserRefuse("PROCESS_UNCONFIRMED");
  const fetchCommands=config.fetchCommands===true;
  const pages=new WeakMap(),requests=new WeakMap(),servers=new WeakMap(),sessions=new Map(),listeners=[];
  let disposed=false,sequence=0,traceCount=0,commandCount=0,ambiguities=0,bounded=false;
  const mapSize=Object.getOwnPropertyDescriptor(Map.prototype,"size").get;
  const boundedEntries=(map,limit)=>{const size=mapSize.call(map);if(size>limit){bounded=true;throw Error();}return Array.from(Map.prototype.entries.call(map));};
  const absent=()=>Object.freeze({identity:"unavailable",order:"unavailable",terminal:"unavailable",publicTerminal:"unavailable",managerEntry:"unavailable",sessionRegistered:"unavailable",...(fetchCommands?{fetchCommand:"unavailable",fetchOutcome:"unavailable"}:{})});
  const data=(object,key)=>{if(!object||typeof object!=="object"&&typeof object!=="function")throw Error();const d=Object.getOwnPropertyDescriptor(object,key);if(!d||!Object.hasOwn(d,"value"))throw Error();return d.value;};
  const method=(object,key)=>{for(let i=0;object&&i<12;i++,object=Object.getPrototypeOf(object)){const d=Object.getOwnPropertyDescriptor(object,key);if(d){if(!Object.hasOwn(d,"value")||typeof d.value!=="function")throw Error();return d.value;}}throw Error();};
  const object=value=>{if(!value||typeof value!=="object")throw Error();return value;};
  const id=(event,key)=>{const value=data(event,key);if(typeof value!=="string"||value.length<1||value.length>256)throw Error();return value;};
  const mark=trace=>{if(!trace.bad){trace.bad=true;ambiguities++;}};
  // Observe only the original Promise, preserving its identity and rejection.
  // The side branch reads no result/error and never supplies a request terminal.
  const installCommands=port=>{
    try{
      const original=method(port.session,"send"),own=Object.getOwnPropertyDescriptor(port.session,"send");
      if(own&&(!Object.hasOwn(own,"value")||!own.configurable))throw Error();
      const wrapper=function(...args){
        let command=null;
        try{if(!disposed&&!bounded&&this===port.session&&["Fetch.continueRequest","Fetch.failRequest"].includes(args[0])){
          const key=id(args[1],"requestId");if(++commandCount>8192||port.commands.size>=4096&&!port.commands.has(key)){bounded=true;throw Error();}
          command=port.commands.get(key);if(command){command.bad=true;}else{command={kind:args[0]==="Fetch.continueRequest"?"continue":"abort",outcome:"pending",bad:false};port.commands.set(key,command);}
        }}catch{port.commandsAvailable=false;}
        let result;
        try{result=Reflect.apply(original,this,args);}catch(error){if(command&&!disposed)command.outcome="rejected";throw error;}
        if(command){try{Promise.prototype.then.call(result,()=>{if(!disposed)command.outcome="resolved";},()=>{if(!disposed)command.outcome="rejected";});}catch{port.commandsAvailable=false;}}
        return result;
      };
      Object.defineProperty(port.session,"send",{value:wrapper,writable:true,enumerable:own?.enumerable??false,configurable:true});
      port.commandPatch={originalOwn:own,wrapper};port.commandsAvailable=true;
    }catch{port.commandsAvailable=false;}
  };
  const restoreCommands=port=>{const patch=port.commandPatch;if(!patch)return;try{const own=Object.getOwnPropertyDescriptor(port.session,"send");if(own&&Object.hasOwn(own,"value")&&own.value===patch.wrapper){if(patch.originalOwn)Object.defineProperty(port.session,"send",patch.originalOwn);else Reflect.deleteProperty(port.session,"send");}}catch{ambiguities++;}};
  const commandSnapshot=(trace,managerEntry,sessionRegistered)=>{
    try{
      const port=trace.port;if(!port.commandsAvailable||managerEntry!=="same-request"||sessionRegistered!=="registered"||!trace.interception)throw Error();
      const entry=Map.prototype.get.call(port.managerMap,trace.key),route=object(data(entry,"_originalRequestRoute"));
      if(data(route,"_session")!==port.session||data(route,"_interceptionId")!==trace.interception)throw Error();
      const command=port.commands.get(trace.interception);if(!command)return{fetchCommand:"unobserved",fetchOutcome:"unobserved"};if(command.bad)throw Error();
      return{fetchCommand:command.kind,fetchOutcome:command.outcome};
    }catch{return{fetchCommand:"unavailable",fetchOutcome:"unavailable"};}
  };
  const traceFor=(port,key)=>{let trace=port.traces.get(key);if(!trace){if(++traceCount>4096){bounded=true;throw Error();}trace={port,key,will:0,pause:0,end:0,terminal:"not-observed",server:null,bad:false};port.traces.set(key,trace);}return trace;};
  const bind=(port,trace)=>{
    if(data(port.manager,"_requestIdToRequest")!==port.managerMap)throw Error();const entry=Map.prototype.get.call(port.managerMap,trace.key);if(entry===undefined)return;
    const server=object(data(entry,"request"));if(data(entry,"_requestId")!==trace.key||data(entry,"session")!==port.session)throw Error();
    const prior=servers.get(server);if(trace.server&&trace.server!==server||prior&&prior!==trace){mark(trace);if(prior)mark(prior);return;}
    trace.server=server;servers.set(server,trace);
  };
  const observed=(port,kind,event)=>{
    if(disposed||port.bad||bounded)return;
    try{const trace=traceFor(port,id(event,kind==="pause"?"networkId":"requestId")),at=++sequence;
      if(kind==="will"){if(trace.will)mark(trace);else trace.will=at;}
      else if(kind==="pause"){if(trace.pause)mark(trace);else{trace.pause=at;if(fetchCommands)try{trace.interception=id(event,"requestId");const prior=port.interceptions.get(trace.interception);if(prior&&prior!==trace){mark(prior);mark(trace);}else port.interceptions.set(trace.interception,trace);}catch{trace.interception=null;}}}
      else{if(trace.end)mark(trace);else{trace.end=at;trace.terminal=kind;}}
      bind(port,trace);
    }catch{port.bad=true;ambiguities++;}
  };
  const impl=(client,connection)=>{if(data(client,"_connection")!==connection)throw Error();const guid=data(client,"_guid");if(typeof guid!=="string"||guid.length<1||guid.length>256)throw Error();const bridge=data(connection,"toImpl");if(typeof bridge!=="function")throw Error();return object(bridge.call(connection,client));};
  const observePage=page=>{
    if(disposed||!page||typeof page!=="object")return false;if(pages.has(page))return pages.get(page)!==null;
    const added=[],addedPorts=[];
    try{const connection=object(data(page,"_connection")),server=impl(page,connection),manager=object(data(object(data(server,"delegate")),"_networkManager"));if(data(manager,"_page")!==server)throw Error();
      const managerMap=object(data(manager,"_requestIdToRequest")),sessionMap=object(data(manager,"_sessions")),owned=boundedEntries(sessionMap,32);Map.prototype.has.call(managerMap,"");
      if(owned.length<1||owned.length>32||sessions.size+owned.length>64){bounded=true;throw Error();}
      const ports=[];for(const [session,info] of owned){if(data(info,"session")!==session||sessions.has(session))throw Error();const on=method(session,"on"),off=method(session,"off"),port={session,manager,managerMap,sessionMap,connection,traces:new Map(),interceptions:new Map(),commands:new Map(),commandsAvailable:false,commandPatch:null,bad:false};
        if(fetchCommands)installCommands(port);addedPorts.push(port);
        for(const [name,kind] of [["Network.requestWillBeSent","will"],["Fetch.requestPaused","pause"],["Network.loadingFinished","finished"],["Network.loadingFailed","failed"]]){const callback=event=>observed(port,kind,event);on.call(session,name,callback);const registration={session,name,callback,off};added.push(registration);}
        ports.push(port);
      }
      for(const port of ports)sessions.set(port.session,port);listeners.push(...added);pages.set(page,{connection,ports});return true;
    }catch{for(const r of added){try{r.off.call(r.session,r.name,r.callback);}catch{/* Observation unavailable. */}}for(const port of addedPorts)restoreCommands(port);pages.set(page,null);return false;}
  };
  return Object.freeze({observePage,
    request(request,page){
      if(disposed||!request||typeof request!=="object"||requests.has(request))return;
      let record={trace:null,publicTerminal:"not-observed"};requests.set(request,record);
      try{const owned=pages.get(page);if(!owned||bounded)throw Error();const server=impl(request,owned.connection);let trace=servers.get(server);
        if(!trace){for(const port of owned.ports){for(const [key,entry] of boundedEntries(port.managerMap,4096)){if(data(entry,"request")===server&&data(entry,"session")===port.session){const candidate=traceFor(port,key);bind(port,candidate);if(trace&&trace!==candidate){mark(trace);mark(candidate);throw Error();}trace=candidate;}}}}
        if(!trace||!owned.ports.includes(trace.port)||trace.port.connection!==owned.connection)throw Error();record.trace=trace;
      }catch{/* No exact identity bridge: never use URL, timing or method. */}
    },
    terminal(request,kind){if(disposed||!['finished','failed'].includes(kind))return;const record=requests.get(request);if(!record)return;if(record.publicTerminal!=="not-observed"&&record.publicTerminal!==kind)record.publicTerminal="unavailable";else record.publicTerminal=kind;},
    snapshot(input){
      try{if(disposed||bounded||!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype)return absent();const d=Object.getOwnPropertyDescriptors(input),n=d.length?.value;if(!Number.isSafeInteger(n)||n<0||n>ADMIN_BROWSER_LIMITS.browserRequests||Reflect.ownKeys(d).length!==n+1)return absent();if(n===0)return null;
        const rows=[];for(let i=0;i<n;i++){const slot=d[String(i)];if(!slot||!Object.hasOwn(slot,"value")||!slot.enumerable)return absent();const record=requests.get(slot.value),t=record?.trace;if(!t||t.bad||t.port.bad||t.server===null||data(t.port.manager,"_requestIdToRequest")!==t.port.managerMap){rows.push(absent());continue;}
          // Current membership is observation only: neither absence nor an ACK
          // finishes the public request or grants cleanup authority.
          let managerEntry="unavailable",sessionRegistered="unavailable";
          try{const present=Map.prototype.has.call(t.port.managerMap,t.key),entry=Map.prototype.get.call(t.port.managerMap,t.key);managerEntry=!present?"absent":data(entry,"request")===t.server&&data(entry,"_requestId")===t.key&&data(entry,"session")===t.port.session?"same-request":"other-request";}catch{/* Accessors and incompatible entries remain unavailable. */}
          try{if(data(t.port.manager,"_sessions")===t.port.sessionMap)sessionRegistered=Map.prototype.has.call(t.port.sessionMap,t.port.session)?"registered":"removed";}catch{/* Missing session membership is never inferred. */}
          rows.push({identity:"exact-server-request",order:!t.will?"unavailable":!t.end?"no-terminal-observed":!t.pause?"no-pause-observed":t.end<t.pause?"terminal-before-pause":"pause-before-terminal",terminal:t.terminal,publicTerminal:record.publicTerminal,managerEntry,sessionRegistered,...(fetchCommands?commandSnapshot(t,managerEntry,sessionRegistered):{})});
        }
        return Object.freeze(Object.fromEntries(["identity","order","terminal","publicTerminal","managerEntry","sessionRegistered",...(fetchCommands?["fetchCommand","fetchOutcome"]:[])].map(key=>{const values=new Set(rows.map(row=>row[key]));return[key,values.size===1?[...values][0]:"mixed"];})));
      }catch{return absent();}
    },
    metadata(){return Object.freeze({ambiguities,bounded,disposed});},
    dispose(){if(disposed)return;disposed=true;for(const r of listeners){try{r.off.call(r.session,r.name,r.callback);}catch{ambiguities++;}}for(const port of sessions.values())restoreCommands(port);listeners.length=0;sessions.clear();}
  });
}
// Context.close acknowledges Close, not a flush of requestFinished/requestFailed.
// Keep the event source alive while awaiting actual request/action settlement.
export const isAdminCanonicalHmrGet = (url, method) => method === "GET" && url === ADMIN_BROWSER_APP + "/_next/webpack-hmr";
// Presentation diagnosis only. The caller supplies its existing route decision.
// No query, header, cookie or body is read; resourceType is observed metadata.
export function classifyAdminBrowserHttpRequest(url,method,resourceType,authorized){
  if(authorized!==true||typeof url!=="string"||url.length>4096||method!=="GET"||typeof resourceType!=="string")return "OTHER";
  try{
    const u=new URL(url);if(![ADMIN_BROWSER_APP,ADMIN_BROWSER_API].includes(u.origin))return "OTHER";
    if(u.origin===ADMIN_BROWSER_API&&u.pathname.startsWith("/auth/v1/")||u.origin===ADMIN_BROWSER_APP&&["/auth/callback","/entrar","/trocar-senha","/recuperar-senha","/redefinir-senha","/sair"].includes(u.pathname))return "AUTH";
    if(u.origin===ADMIN_BROWSER_APP&&u.pathname.startsWith("/api/"))return "API";
    if(u.origin===ADMIN_BROWSER_APP&&u.pathname.startsWith("/_next/static/")||["stylesheet","script","image","font","media","texttrack","manifest"].includes(resourceType))return "ASSET";
    if(resourceType==="document")return "DOCUMENT";
    if(resourceType==="fetch"||resourceType==="xhr")return "FETCH";
    return "OTHER";
  }catch{return "OTHER";}
}
export function adminBrowserHttpPendingCode(input){
  const rows=closedAdminBrowserValue(input);
  if(!Array.isArray(rows)||rows.length>ADMIN_BROWSER_LIMITS.browserRequests||rows.some(row=>!row||Array.isArray(row)||Object.keys(row).length!==2||!Object.hasOwn(row,"httpClass")||!Object.hasOwn(row,"responseSeen")||!ADMIN_HTTP_PENDING_CLASSES.includes(row.httpClass)||typeof row.responseSeen!=="boolean"))adminBrowserRefuse("PROCESS_UNCONFIRMED");
  // A late terminal event after timeout cannot turn that timeout into success.
  if(rows.length===0)return "QUIESCENCE_HTTP_PENDING";
  if(rows.some(row=>row.httpClass!==rows[0].httpClass||row.responseSeen!==rows[0].responseSeen))return "QUIESCENCE_HTTP_DETAILS_MIXED_PENDING";
  const code=`QUIESCENCE_HTTP_${rows[0].httpClass}_${rows[0].responseSeen?"RESPONSE":"NO_RESPONSE"}_PENDING`;
  if(!ADMIN_HTTP_PENDING_CODES.includes(code))adminBrowserRefuse("PROCESS_UNCONFIRMED");return code;
}
// Only declared read routes may be interrupted after functional assertions.
// Auth callbacks/verification and logout are never cancellation candidates.
export function isAdminBrowserReadCancellationRequest(url,method){
  if(typeof url!=="string"||method!=="GET"||!acceptAdminBrowserRequest(url,method))return false;
  try{const u=new URL(url);return url===u.href&&url===u.origin+u.pathname+u.search&&!["/sair","/auth/callback","/auth/v1/verify"].includes(u.pathname);}catch{return false;}
}
// An existing read permit may park these two documents after assertions.
// This flag never removes the actual request from its owner's tracker.
export function isAdminBrowserParkableAuthRead(url,method,authorized){
  if(authorized!==true||!isAdminBrowserReadCancellationRequest(url,method))return false;
  try{const u=new URL(url);return u.origin===ADMIN_BROWSER_APP&&["/entrar","/trocar-senha"].includes(u.pathname);}catch{return false;}
}
// Static assets use the existing canonical read permit, never resourceType.
// This flag authorizes parking only; terminal events still own the request.
export function isAdminBrowserParkableAssetRead(url,method,authorized){
  if(authorized!==true||!isAdminBrowserReadCancellationRequest(url,method))return false;
  try{const u=new URL(url);return u.origin===ADMIN_BROWSER_APP&&(u.pathname.startsWith("/_next/static/")||u.pathname==="/favicon.ico");}catch{return false;}
}
export function adminBrowserPageReleaseCode(input){
  const v=closedAdminBrowserValue(input),keys=["ui","sdk","sql","nonRead","unknown"];
  if(!v||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k))||typeof v.unknown!=="boolean"||keys.filter(k=>k!=="unknown").some(k=>!Number.isSafeInteger(v[k])||v[k]<0||v[k]>ADMIN_BROWSER_LIMITS.browserRequests))adminBrowserRefuse("PROCESS_UNCONFIRMED");
  if(v.unknown||v.nonRead)return "WRITE_OUTCOME_UNCERTAIN";
  if(v.ui)return "QUIESCENCE_UI_PENDING";
  if(v.sdk||v.sql)return "PROCESS_UNCONFIRMED";
  return null;
}
export function adminBrowserPendingCode(input) {
  const v = closedAdminBrowserValue(input), keys = ["ui", "hmrGet", "otherHttp"];
  if (!v || Object.keys(v).length !== 3 || keys.some(k => !Object.hasOwn(v,k) || !Number.isSafeInteger(v[k]) || v[k] < 0 || v[k] > ADMIN_BROWSER_LIMITS.browserRequests)) adminBrowserRefuse("PROCESS_UNCONFIRMED");
  const present = keys.filter(k => v[k] > 0);
  return present.length > 1 ? "QUIESCENCE_MIXED_PENDING" : present.length === 0 ? null : ({ ui: "QUIESCENCE_UI_PENDING", hmrGet: "QUIESCENCE_HMR_GET_PENDING", otherHttp: "QUIESCENCE_HTTP_PENDING" })[present[0]];
}
// Only a pre-parking view. Full quiescence still reads every original entry.
export function adminBrowserPreParkPending(input){
  const v=closedAdminBrowserValue(input),keys=["ui","hmrGet","otherHttp","parkableAuthRead"];
  if(!v||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))adminBrowserRefuse("PROCESS_UNCONFIRMED");
  adminBrowserPendingCode({ui:v.ui,hmrGet:v.hmrGet,otherHttp:v.otherHttp});
  if(!Number.isSafeInteger(v.parkableAuthRead)||v.parkableAuthRead<0||v.parkableAuthRead>v.otherHttp)adminBrowserRefuse("PROCESS_UNCONFIRMED");
  return{ui:v.ui,hmrGet:0,otherHttp:v.otherHttp-v.parkableAuthRead};
}
// Auth and static reads are disjoint event-derived counts. The original Auth
// projection stays unchanged; full quiescence never uses either exclusion.
export function adminBrowserPreParkReadPending(input){
  const v=closedAdminBrowserValue(input),keys=["ui","hmrGet","otherHttp","parkableAuthRead","parkableAssetRead"];
  if(!v||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))adminBrowserRefuse("PROCESS_UNCONFIRMED");
  const auth=adminBrowserPreParkPending({ui:v.ui,hmrGet:v.hmrGet,otherHttp:v.otherHttp,parkableAuthRead:v.parkableAuthRead});
  if(!Number.isSafeInteger(v.parkableAssetRead)||v.parkableAssetRead<0||v.parkableAssetRead>auth.otherHttp)adminBrowserRefuse("PROCESS_UNCONFIRMED");
  return{...auth,otherHttp:auth.otherHttp-v.parkableAssetRead};
}
export async function waitForAdminBrowserIoQuiet(read, options = {}) {
  try {
    const d = Object.getOwnPropertyDescriptors(options), keys = Reflect.ownKeys(d);
    if (Object.getPrototypeOf(options) !== Object.prototype || keys.some(k => typeof k !== "string" || !["timeoutMs","deadlineMs","now","pause"].includes(k) || !d[k].enumerable || !Object.hasOwn(d[k],"value"))) adminBrowserRefuse("PROCESS_UNCONFIRMED");
    const timeoutMs=d.timeoutMs ? d.timeoutMs.value : 15000, now=d.now ? d.now.value : (()=>performance.now()), pause=d.pause ? d.pause.value : (ms=>new Promise(resolve=>setTimeout(resolve,ms)));
    if (typeof read !== "function" || typeof now !== "function" || typeof pause !== "function" || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) adminBrowserRefuse("PROCESS_UNCONFIRMED");
    const start = now(); let previous = start;
    if (!Number.isFinite(start)) adminBrowserRefuse("PROCESS_UNCONFIRMED");
    const deadline = d.deadlineMs ? d.deadlineMs.value : start + timeoutMs;
    if (!Number.isFinite(deadline) || deadline > start + timeoutMs) adminBrowserRefuse("PROCESS_UNCONFIRMED");
    for (let polls = 0; polls <= 601; polls++) {
      const at = now(); if (!Number.isFinite(at) || at < previous) adminBrowserRefuse("PROCESS_UNCONFIRMED"); previous = at;
      const pending = adminBrowserPendingCode(read());
      if (pending === null) return null;
      const remaining = deadline - at; if (remaining <= 0) return pending;
      await pause(Math.min(25,remaining));
    }
    adminBrowserRefuse("PROCESS_UNCONFIRMED");
  } catch { adminBrowserRefuse("PROCESS_UNCONFIRMED"); }
}
// Only the first drain omits exact classified HMR from its transient snapshot.
// The caller keeps every request recorded and uses the same deadline for full IO.
export async function waitForAdminBrowserHttpQuiet(read, options = {}) {
  if (typeof read !== "function") adminBrowserRefuse("PROCESS_UNCONFIRMED");
  return waitForAdminBrowserIoQuiet(() => {
    const snapshot = closedAdminBrowserValue(read());
    adminBrowserPendingCode(snapshot);
    return { ...snapshot, hmrGet: 0 };
  }, options);
}
export function adminBrowserEnvironment(env, platform = process.platform) {
  if (platform !== "linux" || env.CI !== "true" || env.GITHUB_ACTIONS !== "true" || env.SC_ADMIN_BROWSER_RUN !== "1" || env.APP_MODE !== "supabase" || env.NODE_ENV !== "development" || env.APP_URL !== ADMIN_BROWSER_APP || env.SUPABASE_URL !== ADMIN_BROWSER_API || !ADMIN_BROWSER_CASES.includes(env.SC_ADMIN_BROWSER_CASE) || !NS.test(env.SC_ADMIN_BROWSER_NAMESPACE) || !SHA.test(env.GITHUB_SHA) || !/^sc-auth-ci-[a-f0-9]{24}$/.test(env.SC_ADMIN_BROWSER_PROJECT) || !/^[0-9]{16,20}$/.test(env.SC_ADMIN_BROWSER_SYSTEM) || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(env.SUPABASE_PUBLISHABLE_KEY) || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(env.SUPABASE_SECRET_KEY) || [env.AUTH_STATE_SECRET, env.AUTH_RATE_LIMIT_SECRET, env.ADMIN_COMMAND_SECRET].some(s => typeof s !== "string" || Buffer.byteLength(s) < 32) || new Set([env.AUTH_STATE_SECRET, env.AUTH_RATE_LIMIT_SECRET, env.ADMIN_COMMAND_SECRET, env.SUPABASE_SECRET_KEY]).size !== 4 || Object.keys(env).some(k => /^(?:NEXT_PUBLIC_|GOOGLE_|SENTRY_|VERCEL_|GH_TOKEN$|GITHUB_TOKEN$|SUPABASE_ACCESS_TOKEN$|SUPABASE_DB_PASSWORD$|DATABASE_URL$)/.test(k))) adminBrowserRefuse("ENVIRONMENT_REFUSED");
  const path = env.SC_ADMIN_BROWSER_REPORT, parent = env.RUNNER_TEMP;
  if (!path || !parent || !isAbsolute(path) || !isAbsolute(parent) || relative(parent, path).startsWith("..") || dirname(path) === resolve(parent) || basename(path) !== "admin-browser-case-report.json") adminBrowserRefuse("ENVIRONMENT_REFUSED");
  return Object.freeze({ case: env.SC_ADMIN_BROWSER_CASE, namespace: env.SC_ADMIN_BROWSER_NAMESPACE, sourceSha: env.GITHUB_SHA, projectId: env.SC_ADMIN_BROWSER_PROJECT, systemIdentifier: env.SC_ADMIN_BROWSER_SYSTEM, publishableKey: env.SUPABASE_PUBLISHABLE_KEY, secretKey: env.SUPABASE_SECRET_KEY, commitmentSecret: env.ADMIN_COMMAND_SECRET, reportPath: path });
}
/** Browser request observer consumes no response bodies, cookies or bundles. */
export function acceptAdminBrowserRequest(url, method) {
  try {
    const u = new URL(url); if (u.origin !== ADMIN_BROWSER_APP || u.username || u.password || u.hash || !["GET", "POST"].includes(method)) return false;
    if (method === "POST") return u.pathname === "/entrar" ? u.search === "?returnTo=%2Fajuda" || !u.search : ["/trocar-senha", "/api/monitoring"].includes(u.pathname) && !u.search;
    // Next15.5.27 development adds Date.now() as the sole asset version query.
    if (u.pathname.startsWith("/_next/static/") && /^\/_next\/static\/[A-Za-z0-9_@%\[\]()./-]+$/.test(u.pathname) && !decodeURIComponent(u.pathname).includes("..") && !/%(?:2f|5c|00)/i.test(u.pathname) && (!u.search || /^\?v=\d{13}$/.test(u.search))) return true;
    if (["/_next/webpack-hmr", "/favicon.ico"].includes(u.pathname)) return !u.search;
    if (u.pathname === "/api/calendar") return !u.search;
    if (["/api/settings", "/api/settings/sessions"].includes(u.pathname)) return url===u.origin+u.pathname;
    if (![...ADMIN_BROWSER_PAGES, "/entrar", "/trocar-senha", "/design-system"].includes(u.pathname)) return false;
    return new Set([...u.searchParams.keys()]).size === [...u.searchParams].length && [...u.searchParams].every(([key, value]) => key === "_rsc" && /^[A-Za-z0-9_-]{1,100}$/.test(value) || key === "returnTo" && ADMIN_BROWSER_PAGES.includes(value) || key === "notice" && ["session-required", "password-updated"].includes(value));
  } catch { return false; }
}
const sorted = v => Array.isArray(v) ? "[" + v.map(sorted).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + sorted(v[k])).join(",") + "}" : JSON.stringify(v);
const same = (a, b) => sorted(a) === sorted(b);
export const ADMIN_BROWSER_INSPECTION_ORDER = Object.freeze({
  BLOCK_LIVE_BROWSER: Object.freeze(["ACTORS_BOUND", "MASTER_BOUND", "ADMIN_FENCE", "ADMIN_TERMINAL", "ACCESS_DENIED", "UNCHANGED", "CLEANUP_INVENTORY", "CLEANUP_REVOKED", "CLEANUP_RETAINED"]),
  FIRST_FORCED_BROWSER: Object.freeze(["ACTORS_BOUND", "MASTER_BOUND", "ADMIN_FENCE", "CREATED_FENCE", "ADMIN_TERMINAL", "ACCESS_DENIED", "UNCHANGED", "PASSWORD_COMPLETE", "CREDENTIALS_CHANGED", "CLEANUP_INVENTORY", "CLEANUP_REVOKED", "CLEANUP_RETAINED"]),
});
export const ADMIN_BROWSER_SQL_QUERIES = Object.freeze([...new Set(Object.values(ADMIN_BROWSER_INSPECTION_ORDER).flat())]);
const variables = v => Object.entries(v).map(([k, value]) => `\\set ${k} ${value}`).join("\n") + "\n";
/** READONLY fixed metadata SQL; no password/token columns or arbitrary query. */
export function adminBrowserInspectionInput(context, query) {
  if (!NS.test(context.namespace) || !SHA.test(context.sourceSha) || !/^[0-9]{16,20}$/.test(context.systemIdentifier) || !/^sc-auth-ci-[a-f0-9]{24}$/.test(context.projectId) || !ADMIN_BROWSER_SQL_QUERIES.includes(query)) adminBrowserRefuse("SQL_REFUSED");
  return variables({ sc_ns: context.namespace, sc_sha: context.sourceSha, sc_system: context.systemIdentifier, sc_project: context.projectId }) + `begin read only;set local statement_timeout='10s';set local lock_timeout='2s';
select jsonb_build_object(
'provenance',jsonb_build_object('namespace',:'sc_ns','sourceSha',:'sc_sha','systemIdentifier',(select system_identifier::text from pg_control_system()),'database',current_database(),'currentUser',current_user,'serverVersion',current_setting('server_version_num')::integer,'markerRows',(select coalesce(jsonb_agg(jsonb_build_object('namespace',namespace,'sourceSha',source_sha,'systemIdentifier',system_identifier)),'[]'::jsonb) from app_private.sc_admin_ci_marker where namespace=:'sc_ns' and source_sha=:'sc_sha' and system_identifier=:'sc_system' and project_id=:'sc_project' and (select count(*) from app_private.sc_admin_ci_marker)=1)),
'users',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'app_metadata',raw_app_meta_data,'banned_until',banned_until,'deleted_at',deleted_at,'is_anonymous',is_anonymous) order by id),'[]'::jsonb) from auth.users),
'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id) order by user_id,id),'[]'::jsonb) from auth.sessions),
'refreshTokens',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'session_id',session_id,'revoked',revoked) order by id),'[]'::jsonb) from auth.refresh_tokens),
'roles',(select coalesce(jsonb_agg(to_jsonb(r) order by user_id),'[]'::jsonb) from (select user_id,role from public.user_roles) r),
'moderation',(select coalesce(jsonb_agg(to_jsonb(r) order by user_id),'[]'::jsonb) from (select user_id,status,must_change_password from public.user_moderation) r),
'entitlements',(select coalesce(jsonb_agg(to_jsonb(r) order by user_id,feature_key),'[]'::jsonb) from public.user_entitlements r),
'operations',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at,ctid),'[]'::jsonb) from app_private.admin_operations r),
'audit',(select coalesce(jsonb_agg(to_jsonb(r) order by occurred_at,ctid),'[]'::jsonb) from public.admin_audit_events r),
'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at,command,client_id),'[]'::jsonb) from app_private.command_receipts r),
'events',(select coalesce(jsonb_agg(to_jsonb(r) order by occurred_at,ctid),'[]'::jsonb) from public.domain_events r),
'personalRows',(select count(*) from (select 1 from public.captures union all select 1 from public.tasks union all select 1 from public.knowledge_pages union all select 1 from public.projects union all select 1 from public.habits union all select 1 from public.fin_transactions union all select 1 from public.drive_files union all select 1 from public.vault_items) rows));rollback;`;
}
export function acceptAdminBrowserProof(input, context, owners) {
  const v = closedAdminBrowserValue(input), keys = ["provenance", "users", "sessions", "refreshTokens", "roles", "moderation", "entitlements", "operations", "audit", "receipts", "events", "personalRows"];
  if (!v || Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) adminBrowserRefuse("SQL_REFUSED");
  const p = v.provenance;
  if (!p || Object.keys(p).length !== 7 || p.namespace !== context.namespace || p.sourceSha !== context.sourceSha || p.systemIdentifier !== context.systemIdentifier || p.database !== "postgres" || p.currentUser !== "postgres" || !Number.isInteger(p.serverVersion) || p.serverVersion < 170000 || p.serverVersion >= 180000 || !same(p.markerRows, [{ namespace: context.namespace, sourceSha: context.sourceSha, systemIdentifier: context.systemIdentifier }]) || v.personalRows !== 0) adminBrowserRefuse("SQL_REFUSED");
  for (const k of keys.slice(1, -1)) if (!Array.isArray(v[k]) || v[k].length > 128) adminBrowserRefuse("SQL_REFUSED");
  const ids = owners.map(o => o.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !UUID.test(id)) || new Set(v.users.map(u => u.id)).size !== v.users.length || v.users.some(u => !ids.includes(u.id)) || v.sessions.some(s => !ids.includes(s.user_id) || !UUID.test(s.id)) || ["roles", "moderation", "entitlements", "receipts", "events"].some(k => v[k].some(r => !ids.includes(r.user_id))) || v.refreshTokens.some(r => !ids.includes(r.user_id)) || v.operations.some(r => r.actor_user_id !== ids[0] || !ids.includes(r.target_user_id)) || v.audit.some(r => r.actor_user_id !== ids[0] || !ids.includes(r.target_user_id))) adminBrowserRefuse("OWNERSHIP_REFUSED");
  for (const u of v.users) { const o = owners.find(o => o.id === u.id); if (u.email !== o.email || u.is_anonymous !== false || u.deleted_at !== null || (o.operationId ? u.app_metadata?.sc_admin_operation !== o.operationId : u.app_metadata?.sc_admin_native_fixture !== context.namespace)) adminBrowserRefuse("OWNERSHIP_REFUSED"); }
  return v;
}
export function adminBrowserBootstrapInput(context, owners, sessions) {
  const block = context.case === "BLOCK_LIVE_BROWSER";
  if (!ADMIN_BROWSER_CASES.includes(context.case) || owners.length !== (block ? 2 : 1) || sessions.length !== (block ? 3 : 1) || new Set([...owners.map(o => o.id), ...sessions.map(s => s.sessionId)]).size !== owners.length + sessions.length || owners.some(o => !UUID.test(o.id)) || sessions.some(s => !UUID.test(s.sessionId) || !owners.some(o => o.id === s.id)) || sessions.filter(s => s.id === owners[0].id).length !== 1 || block && sessions.filter(s => s.id === owners[1].id).length !== 2) adminBrowserRefuse("SQL_REFUSED");
  const list = values => values.map(v => `'${v}'::uuid`).join(",");
  // Values are exclusively validated UUIDs/namespace. Credentials never enter SQL.
  return variables({ sc_ns: context.namespace, sc_a: owners[0].id }) + `begin;set local statement_timeout='10s';
do $bound$ begin
if (select count(*) from auth.users) <> ${owners.length} or (select count(*) from auth.sessions) <> ${sessions.length} or exists(select 1 from auth.users where id not in (${list(owners.map(o => o.id))}) or is_anonymous is distinct from false or deleted_at is not null or raw_app_meta_data->>'sc_admin_native_fixture' <> current_setting('sc.admin_browser_namespace')) or exists(select 1 from public.user_roles where role <> 'user') or exists(select 1 from public.user_moderation where status <> 'active' or must_change_password) then raise exception 'Inventory refused.' using errcode='23514';end if;
${sessions.map(s => `if not exists(select 1 from auth.sessions where id='${s.sessionId}'::uuid and user_id='${s.id}'::uuid) then raise exception 'Session refused.' using errcode='23514';end if;`).join("\n")}
end $bound$;
select public.bootstrap_master(:'sc_a');commit;` .replace("do $bound$", "set local sc.admin_browser_namespace=:'sc_ns';\ndo $bound$");
}
export function createAdminBrowserState(kind, { now = () => performance.now(), deadlineMs = ADMIN_BROWSER_LIMITS.caseMs } = {}) {
  if (!ADMIN_BROWSER_CASES.includes(kind) || typeof now !== "function" || !Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > ADMIN_BROWSER_LIMITS.caseMs) adminBrowserRefuse("ENVIRONMENT_REFUSED");
  const value = structuredClone(blankAdminBrowserCase(kind)), started = now(); let closed = false, failed = false;
  value.status = "failed"; value.code = "BROWSER_REFUSED";
  const expired = () => { if (!failed && now() - started >= deadlineMs) { failed = true; value.code = "DEADLINE_EXCEEDED"; } return failed && value.code === "DEADLINE_EXCEEDED"; };
  const active = () => { expired(); if (closed || failed) adminBrowserRefuse(value.code); };
  return Object.freeze({
    active, value,
    count(key) { active(); const max = ADMIN_BROWSER_LIMITS[key] ?? ({ fixturesCreated: 2, contexts: kind === "BLOCK_LIVE_BROWSER" ? 3 : 2, loginPosts: kind === "BLOCK_LIVE_BROWSER" ? 3 : 4, passwordPosts: kind === "BLOCK_LIVE_BROWSER" ? 0 : 1, adminRpc: kind === "BLOCK_LIVE_BROWSER" ? 8 : 12, adminAuth: kind === "BLOCK_LIVE_BROWSER" ? 1 : 4, ownSessionsRpc:2, ownSessionsViews:kind === "BLOCK_LIVE_BROWSER"?2:3, ownSessionsReloads:kind === "BLOCK_LIVE_BROWSER"?0:1, pageProbes: 16, apiProbes:kind === "BLOCK_LIVE_BROWSER"?2:27, nextProbeRequests:kind === "BLOCK_LIVE_BROWSER"?6:33, cleanupHttp: 8, deleted: 2, absenceReads: 2, revocationAcks: 2, alreadyRevoked: 1, cleanupSql: 3 })[key]; if (max === undefined || value.counts[key] >= max) adminBrowserRefuse("REQUEST_REFUSED"); value.counts[key]++; },
    stage(stage) { active(); if (ADMIN_BROWSER_STAGES[kind][value.stages.length] !== stage) adminBrowserRefuse("REPORT_REFUSED"); value.stages.push({ stage, passed: true }); },
    unknown() { value.writeOutcomeUncertain = true; },
    fail(code) { if (!failed) { value.code = ADMIN_BROWSER_CODES.includes(code) && !["PASSED", "NOT_RUN"].includes(code) ? code : "BROWSER_REFUSED"; failed = true; } },
    finish(pendingRequests, pendingInspections) { expired(); closed = true; value.pendingRequests = pendingRequests; value.pendingInspections = pendingInspections; if (!failed && !value.writeOutcomeUncertain && !pendingRequests && !pendingInspections) { value.status = "passed"; value.code = "PASSED"; } return validateAdminBrowserCase(value); },
  });
}
/** Each SDK HTTP operation needs a single exact caller permit before it starts. */
export function createAdminBrowserTransport(state, nativeFetch = fetch) {
  let permit = null, pending = 0, last = null;
  const allowed = new Set(), controllers = new Set();
  const set = slot => { state.active(); if (permit || !slot || typeof slot.url !== "string" || new URL(slot.url).origin !== ADMIN_BROWSER_API || !["GET", "POST", "PUT", "DELETE"].includes(slot.method) || typeof slot.check !== "function") adminBrowserRefuse("REQUEST_REFUSED"); permit = slot; };
  const transport = async (input, init = {}) => {
    state.active(); const slot = permit; permit = null;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url, headers = new Headers(init.headers);
    if (!slot || url !== slot.url || (init.method ?? "GET").toUpperCase() !== slot.method || headers.get("apikey") !== slot.key || headers.get("authorization") !== "Bearer " + slot.token || ![null, "2024-01-01"].includes(headers.get("x-supabase-api-version"))) adminBrowserRefuse("REQUEST_REFUSED");
    try { if (slot.check(init.body) !== true) adminBrowserRefuse("REQUEST_REFUSED"); } catch { adminBrowserRefuse("REQUEST_REFUSED"); }
    state.count("ownedSdkRequests"); if (slot.category) state.count(slot.category);
    const c = new AbortController(); controllers.add(c); pending++; let timer, expired = false;
    const owned = (async () => {
      const response = await nativeFetch(url, { ...init, signal: c.signal, redirect: "error", cache: "no-store", credentials: "omit" });
      if (!(response instanceof Response) || response.redirected || response.url && response.url !== url) adminBrowserRefuse("REQUEST_REFUSED");
      const chunks = []; let n = 0, reader;
      try {
        if (response.body) { reader = response.body.getReader(); for (;;) { const part = await reader.read(); if (part.done) break; n += part.value.byteLength; if (n > ADMIN_BROWSER_LIMITS.responseBytes) adminBrowserRefuse("REQUEST_REFUSED"); chunks.push(part.value); } }
        state.active(); if (expired) adminBrowserRefuse("DEADLINE_EXCEEDED");
        const bytes = Buffer.concat(chunks, n); last = { status: response.status, code: null };
        if (bytes.length) { let json; try { json = JSON.parse(bytes.toString("utf8")); } catch { adminBrowserRefuse("REQUEST_REFUSED"); } last.code = typeof json.code === "string" ? json.code : null; }
        if (slot.write && response.status >= 500) state.unknown();
        return new Response(response.body ? bytes : null, { status: response.status, headers: response.headers });
      } finally { chunks.forEach(b => b.fill(0)); if (reader) await reader.cancel().catch(() => {}); }
    })().finally(() => { pending--; controllers.delete(c); allowed.delete(owned); }); allowed.add(owned);
    try { return await Promise.race([owned, new Promise((_, reject) => { timer = setTimeout(() => { expired = true; c.abort(); if (slot.write) state.unknown(); reject(new Error("DEADLINE_EXCEEDED")); }, ADMIN_BROWSER_LIMITS.requestMs); })]); }
    catch { if (slot.write) state.unknown(); state.fail(expired ? "DEADLINE_EXCEEDED" : "TRANSPORT_FAILED"); adminBrowserRefuse(expired ? "DEADLINE_EXCEEDED" : "TRANSPORT_FAILED"); }
    finally { clearTimeout(timer); c.abort(); }
  };
  return Object.freeze({ permit: set, transport, clearCachedJwksPermit() { if (permit?.method !== "GET" || permit.url !== ADMIN_BROWSER_API + "/auth/v1/.well-known/jwks.json") adminBrowserRefuse("REQUEST_REFUSED"); permit = null; }, metadata: () => ({ pending, permitted: permit !== null, last: last ? { ...last } : null }), async settle() { await Promise.race([Promise.allSettled([...allowed]), new Promise(r => setTimeout(r, 2000))]); return pending === 0; }, close() { for (const c of controllers) c.abort(); permit = null; } });
}
// Separate Node-to-Next channel. This does not measure the browser or the SDK's
// requests, and never asks APIRequestContext to buffer an unbounded response.
export function createAdminBrowserNextTransport(state,nativeFetch=fetch){
  // Next15.5.27 hot-reloader-app.js319 writes this literal dev cookie (name:
  // app-router-headers.js89). It is not Auth; validate it, then never forward it.
  // This source compatibility rule does not claim the cookie was observed in690.
  const pending=new Set(),controllers=new Set(),hmrCookie="__next_hmr_refresh_hash__";let closed=false;
  const request=async({path,method,body,cookies,userId})=>{
    state.active();if(closed||!UUID.test(userId)||!Array.isArray(cookies)||cookies.length>32||cookies.some(c=>!c||typeof c.name!=="string"||typeof c.value!=="string"||!(/^(?:sc-auth(?:\.[0-9]+)?|sc-flow-(?:request|recovery|password))$/.test(c.name)||c.name===hmrCookie)||!/^[\x21-\x2b\x2d-\x3a\x3c-\x7e]{1,16384}$/.test(c.value))||new Set(cookies.map(c=>c.name)).size!==cookies.length)adminBrowserRefuse("REQUEST_REFUSED");
    const known=ADMIN_BROWSER_PROBES.find(p=>p.path===path&&p.method===method),extra=method==="GET"&&["/ajuda?_rsc=adminbrowser","/api/calendar/oauth/callback?error=access_denied"].includes(path)||method==="POST"&&path==="/api/monitoring";
    if(!known&&!extra||known&&!same(body,known.body)||extra&&!same(body,method==="POST"?{}:null))adminBrowserRefuse("REQUEST_REFUSED");
    state.count("nextProbeRequests");const controller=new AbortController();controllers.add(controller);let timer,expired=false;
    const url=ADMIN_BROWSER_APP+path,headers={Origin:ADMIN_BROWSER_APP,"Content-Type":"application/json","X-Expected-User-ID":userId,Cookie:cookies.filter(c=>c.name!==hmrCookie).map(c=>c.name+"="+c.value).join("; "),...(path==="/ajuda?_rsc=adminbrowser"?{RSC:"1"}:{})};
    const owned=(async()=>{const response=await nativeFetch(url,{method,headers,...(body!==null?{body:JSON.stringify(body)}:{}),signal:controller.signal,redirect:"manual",cache:"no-store",credentials:"omit"});if(!(response instanceof Response)||response.redirected||response.url&&response.url!==url)adminBrowserRefuse("REQUEST_REFUSED");const chunks=[];let size=0,reader;try{if(response.body){reader=response.body.getReader();for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>ADMIN_BROWSER_LIMITS.responseBytes)adminBrowserRefuse("REQUEST_REFUSED");chunks.push(next.value);}}state.active();if(expired)adminBrowserRefuse("DEADLINE_EXCEEDED");return{status:response.status,contentType:response.headers.get("content-type"),cacheControl:response.headers.get("cache-control"),location:response.headers.get("location"),bytes:Buffer.concat(chunks,size)};}finally{chunks.forEach(c=>c.fill(0));await reader?.cancel().catch(()=>{});}})().finally(()=>{pending.delete(owned);controllers.delete(controller);});pending.add(owned);
    try{return await Promise.race([owned,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;controller.abort();state.fail("DEADLINE_EXCEEDED");if(method==="POST")state.unknown();reject(Error("DEADLINE_EXCEEDED"));},ADMIN_BROWSER_LIMITS.requestMs);})]);}catch{if(method==="POST")state.unknown();state.fail(expired?"DEADLINE_EXCEEDED":"TRANSPORT_FAILED");adminBrowserRefuse(expired?"DEADLINE_EXCEEDED":"TRANSPORT_FAILED");}finally{clearTimeout(timer);controller.abort();}
  };
  return Object.freeze({request,metadata:()=>({pending:pending.size}),close(){closed=true;for(const c of controllers)c.abort();},async settle(){await Promise.race([Promise.allSettled([...pending]),new Promise(r=>setTimeout(r,2000))]);return pending.size===0;}});
}
export function acceptsAdminBrowserDenial(path,status,input){try{const v=closedAdminBrowserValue(input),search=path==="/api/search?q=prova",keys=search?["code","message"]:["ok","code","message"];return[401,403].includes(status)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))&&(!Object.hasOwn(v,"ok")||v.ok===false)&&typeof v.message==="string"&&v.code===(search?"UNAVAILABLE":status===401?"UNAUTHENTICATED":"FORBIDDEN");}catch{return false;}}
// An independent test oracle: SQL supplies only ownership and the exact SID set.
// Registered dates are compared with API/UI, never called last use or validity.
export function acceptAdminOwnSessions(input,ownerId,currentSid,sqlSessions){
  const value=closedAdminBrowserValue(input),inventory=closedAdminBrowserValue(sqlSessions);
  const exact=(v,keys)=>v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
  const timestamp=v=>v===null||typeof v==="string"&&v.length<=64&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
  if(!UUID.test(ownerId)||!UUID.test(currentSid)||!Array.isArray(inventory)||inventory.length>128||inventory.some(s=>!exact(s,["id","user_id"])||!UUID.test(s.id)||!UUID.test(s.user_id))||new Set(inventory.map(s=>s.id)).size!==inventory.length)adminBrowserRefuse("OWNERSHIP_REFUSED");
  const own=inventory.filter(s=>s.user_id===ownerId);
  if(!own.length||own.length>100||!own.some(s=>s.id===currentSid)||!exact(value,["sessions","has_more"])||value.has_more!==false||!Array.isArray(value.sessions)||value.sessions.length!==own.length)adminBrowserRefuse("AUTH_NOT_PROVEN");
  const seen=new Set(),sessions=[];
  for(const row of value.sessions){
    if(!exact(row,["id","is_current","created_at","refreshed_at","not_after"])||!UUID.test(row.id)||seen.has(row.id)||!own.some(s=>s.id===row.id)||row.is_current!==(row.id===currentSid)||![row.created_at,row.refreshed_at,row.not_after].every(timestamp))adminBrowserRefuse("AUTH_NOT_PROVEN");
    seen.add(row.id);sessions.push({isCurrent:row.is_current,createdAt:row.created_at,refreshedAt:row.refreshed_at});
  }
  if(sessions[0]?.isCurrent!==true)adminBrowserRefuse("AUTH_NOT_PROVEN");
  return Object.freeze({sessions:Object.freeze(sessions.map(Object.freeze)),hasMore:false});
}
export function acceptAdminOwnSessionsView(input,expected){
  const value=closedAdminBrowserValue(input),oracle=closedAdminBrowserValue(expected);
  const exact=(v,keys)=>v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
  if(!exact(oracle,["sessions","hasMore"])||oracle.hasMore!==false||!Array.isArray(oracle.sessions)||!oracle.sessions.length||oracle.sessions.length>100||oracle.sessions.some((row,i)=>!exact(row,["isCurrent","createdAt","refreshedAt"])||row.isCurrent!==(i===0)||![row.createdAt,row.refreshedAt].every(t=>t===null||typeof t==="string"&&t.length<=64&&Number.isFinite(Date.parse(t))))||!same(value,oracle))adminBrowserRefuse("AUTH_NOT_PROVEN");return value;
}
export function acceptsAdminOwnSessionsChanged(status,input){
  try{return status===409&&same(closedAdminBrowserValue(input),{ok:false,code:"SESSION_CHANGED",message:"Sua sessão mudou. Entre novamente."});}catch{return false;}
}
export async function createAdminBrowserHarness(context, options) {
  if (!ADMIN_BROWSER_CASES.includes(context.case) || !NS.test(context.namespace) || !SHA.test(context.sourceSha) || !/^sc-auth-ci-[a-f0-9]{24}$/.test(context.projectId) || !/^[0-9]{16,20}$/.test(context.systemIdentifier) || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(context.publishableKey) || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(context.secretKey) || typeof context.commitmentSecret!=="string" || Buffer.byteLength(context.commitmentSecret)<32 || context.commitmentSecret===context.secretKey || ["query","write","cleanupAllowed"].some(k=>typeof Object.getOwnPropertyDescriptor(options??{},k)?.value!=="function") || options.transport!==undefined&&typeof Object.getOwnPropertyDescriptor(options,"transport")?.value!=="function") adminBrowserRefuse("ENVIRONMENT_REFUSED");
  const { product } = await loadAdminNativeBackend(), state = createAdminBrowserState(context.case), io = createAdminBrowserTransport(state, options.transport ?? fetch),nextIo=createAdminBrowserNextTransport(state);
  const settings = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false }, global: { fetch: io.transport } };
  const server = product.createClient(ADMIN_BROWSER_API, context.secretKey, settings), owners = [], sessions = []; let operation = null, executionId = randomUUID(), terminalKnown = false, inventoryComplete = false, pendingSql = 0, baseline = null, inspectionIndex = 0, lastProof=null;
  const allow = (path, method, key, token, check, write = false, category) => io.permit({ url: ADMIN_BROWSER_API + path, method, key, token, check, write, category });
  const noBody = b => b === undefined;
  const jsonBody = expected => b => typeof b === "string" && sorted(JSON.parse(b)) === sorted(expected);
  const matches = (u, o) => !!u && u.id === o.id && u.email === o.email && u.role === "authenticated" && u.is_anonymous === false && (o.operationId ? u.app_metadata?.sc_admin_operation === o.operationId : u.app_metadata?.sc_admin_native_fixture === context.namespace);
  const inspect = async query => { state.active(); if (pendingSql || ADMIN_BROWSER_INSPECTION_ORDER[context.case][inspectionIndex] !== query) adminBrowserRefuse("SQL_REFUSED"); state.count("sqlInspections"); if (query.startsWith("CLEANUP_")) state.count("cleanupSql"); pendingSql++; try { const p = acceptAdminBrowserProof(await options.query(adminBrowserInspectionInput(context, query)), context, owners); state.active(); inspectionIndex++; lastProof=p; return p; } catch { state.fail("SQL_REFUSED"); adminBrowserRefuse("SQL_REFUSED"); } finally { pendingSql--; } };
  const noSessions = (p, id) => !p.sessions.some(s => s.user_id === id) && !p.refreshTokens.some(s => s.user_id === id);
  const user = (p, id) => p.users.find(u => u.id === id);
  const moderation = (p, id) => p.moderation.find(u => u.user_id === id);
  const ordinaryFixture = async () => {
    const o = { id: randomUUID(), email: "admin-browser-" + randomBytes(16).toString("hex") + "@example.invalid", password: randomBytes(24).toString("base64url") + "-Aa1!" }; owners.push(o);
    const input = { id: o.id, email: o.email, password: o.password, email_confirm: true, app_metadata: { sc_admin_native_fixture: context.namespace } };
    allow("/auth/v1/admin/users", "POST", context.secretKey, context.secretKey, jsonBody(input), true);
    const r = await server.auth.admin.createUser(input); if (r.error || !matches(r.data.user, o)) { state.unknown(); adminBrowserRefuse("AUTH_NOT_PROVEN"); } state.count("fixturesCreated"); return o;
  };
  const client = s => product.createClient(ADMIN_BROWSER_API, context.publishableKey, { ...settings, global: { fetch: io.transport, headers: { Authorization: "Bearer " + s.accessToken } } });
  const verifySession = async (o, hint, expectedRole) => {
    if (!UUID.test(hint.sessionId) || hint.expiresAt <= Date.now() + 60000 || typeof hint.accessToken !== "string") adminBrowserRefuse("AUTH_NOT_PROVEN");
    const s = { ...hint, id: o.id, email: o.email }; const c = client(s);
    allow("/auth/v1/user", "GET", context.publishableKey, s.accessToken, noBody); const r = await c.auth.getUser(s.accessToken); if (r.error || !matches(r.data.user, o)) adminBrowserRefuse("AUTH_NOT_PROVEN");
    // getClaims verifies the original JWT. For asymmetric local keys, its exact
    // JWKS GET is also one owned permit; symmetric fallback reuses getUser.
    const claimsHeader = JSON.parse(Buffer.from(s.accessToken.split(".")[0], "base64url").toString("utf8"));
    allow(claimsHeader.alg === "HS256" ? "/auth/v1/user" : "/auth/v1/.well-known/jwks.json", "GET", context.publishableKey, s.accessToken, noBody);
    const claims = await c.auth.getClaims(s.accessToken); if (claims.error || claims.data?.claims.sub !== o.id || claims.data.claims.session_id !== s.sessionId || claims.data.claims.exp * 1000 <= Date.now() + 60000) adminBrowserRefuse("AUTH_NOT_PROVEN");
    if (io.metadata().permitted) io.clearCachedJwksPermit();
    allow("/rest/v1/rpc/my_access_state", "POST", context.publishableKey, s.accessToken, jsonBody({})); const access = await c.rpc("my_access_state");
    const expected = expectedRole === "forced" ? { user_id: o.id, must_change_password: true } : { user_id: o.id, role: expectedRole, must_change_password: false, entitlements: {} };
    if (access.error || sorted(access.data) !== sorted(expected)) adminBrowserRefuse("AUTH_NOT_PROVEN");
    if (!sessions.some(old => old.sessionId === s.sessionId)) sessions.push(s); o.current = s; return s;
  };
  const bootstrap = async () => { const p = await inspect("ACTORS_BOUND"); if (p.users.length !== owners.length || p.sessions.length !== sessions.length || sessions.some(s => !p.sessions.some(row => row.id === s.sessionId && row.user_id === s.id)) || p.roles.some(r => r.role !== "user") || p.moderation.some(r => r.status !== "active" || r.must_change_password)) adminBrowserRefuse("OWNERSHIP_REFUSED"); pendingSql++;try{await options.write(adminBrowserBootstrapInput(context, owners, sessions));state.active();}catch{state.unknown();state.fail("SQL_REFUSED");adminBrowserRefuse("SQL_REFUSED");}finally{pendingSql--;} const after = await inspect("MASTER_BOUND"); if (after.roles.filter(r => r.role === "master").length !== 1 || after.roles.find(r => r.user_id === owners[0].id)?.role !== "master") adminBrowserRefuse("AUTH_NOT_PROVEN"); baseline = after; };
  const ownSessions = async s => {
    state.active();const phase=ADMIN_BROWSER_INSPECTION_ORDER[context.case][inspectionIndex-1];
    if(!lastProof||phase!==(context.case==="BLOCK_LIVE_BROWSER"?"MASTER_BOUND":"CREDENTIALS_CHANGED")||!sessions.some(known=>known.id===s.id&&known.sessionId===s.sessionId&&known.accessToken===s.accessToken)||s.expiresAt<=Date.now()+60000)adminBrowserRefuse("OWNERSHIP_REFUSED");
    allow("/rest/v1/rpc/my_sessions","POST",context.publishableKey,s.accessToken,jsonBody({}),false,"ownSessionsRpc");
    const reply=await client(s).rpc("my_sessions");
    if(reply.error||io.metadata().last?.status!==200)adminBrowserRefuse("AUTH_NOT_PROVEN");
    return acceptAdminOwnSessions(reply.data,s.id,s.sessionId,lastProof.sessions);
  };
  const runAdmin = async () => {
    const a = owners[0], s = a.current; await verifySession(a, s, "master");
    const actor = { userId: a.id, sessionId: s.sessionId, role: "master", mustChangePassword: false, entitlements: {} };
    const creating = context.case === "FIRST_FORCED_BROWSER", target = creating ? { email: "admin-browser-created-" + randomBytes(16).toString("hex") + "@example.invalid", password: randomBytes(24).toString("base64url") + "-Aa1!" } : owners[1];
    const command = creating ? { command: "admin.user.create", input: { client_id: randomUUID(), email: target.email, temporary_password: target.password } } : { command: "admin.user.block", input: { client_id: randomUUID(), target_user_id: target.id } };
    const commitment = product.adminCommitment({ mode: "supabase" }, { ADMIN_COMMAND_SECRET: context.commitmentSecret });
    const rpc = async (name, args) => {
      if (!["admin_snapshot", "admin_reserve", "admin_operation_guard", "admin_transition", "admin_complete"].includes(name) || args.p_actor !== a.id || args.p_session !== s.sessionId) adminBrowserRefuse("REQUEST_REFUSED");
      allow("/rest/v1/rpc/" + name, "POST", context.secretKey, context.secretKey, jsonBody(args), name !== "admin_snapshot" && name !== "admin_operation_guard", "adminRpc");
      const r = await server.rpc(name, args);
      if (r.error) adminBrowserRefuse("SAGA_NOT_PROVEN");
      if (name === "admin_reserve") {
        operation = r.data; if (!operation || !UUID.test(operation.operation_id) || operation.operation_id === executionId || !UUID.test(operation.target_user_id)) adminBrowserRefuse("SAGA_NOT_PROVEN");
        if (creating) { target.id = operation.target_user_id; target.operationId = operation.operation_id; owners.push(target); }
        const fence = await inspect("ADMIN_FENCE"); const row = fence.operations.find(o => o.operation_id === operation.operation_id);
        if (!row || row.phase !== "reserved" || row.active_execution !== executionId || row.actor_user_id !== a.id || row.target_user_id !== target.id || row.commitment !== commitment(command) || (creating ? user(fence, target.id) !== undefined || moderation(fence, target.id) !== undefined : moderation(fence, target.id)?.status !== "blocked")) adminBrowserRefuse("SAGA_NOT_PROVEN");
        state.stage("admin-fence");
      }
      return r;
    };
    const admin = { async getUserById(id) { if (id !== target.id) adminBrowserRefuse("OWNERSHIP_REFUSED"); allow("/auth/v1/admin/users/" + id, "GET", context.secretKey, context.secretKey, noBody, false, "adminAuth"); const r = await server.auth.admin.getUserById(id); if (creating && io.metadata().last?.status === 404) { if (r.error?.code !== "user_not_found") adminBrowserRefuse("AUTH_NOT_PROVEN"); } else if (r.error || !matches(r.data.user, target)) adminBrowserRefuse("AUTH_NOT_PROVEN"); return r; },
      async createUser(input) { if (!creating || input.id !== target.id || input.email !== target.email || input.password !== target.password || input.app_metadata?.sc_admin_operation !== operation.operation_id) adminBrowserRefuse("OWNERSHIP_REFUSED"); allow("/auth/v1/admin/users", "POST", context.secretKey, context.secretKey, jsonBody(input), true, "adminAuth"); const r = await server.auth.admin.createUser(input); if (r.error || !matches(r.data.user, target)) { state.unknown(); adminBrowserRefuse("AUTH_NOT_PROVEN"); } state.count("fixturesCreated"); const p = await inspect("CREATED_FENCE"); if (!user(p, target.id)?.banned_until || Date.parse(user(p, target.id).banned_until) <= Date.now() || moderation(p, target.id)?.must_change_password !== true || moderation(p, target.id)?.status !== "blocked" || !noSessions(p, target.id)) adminBrowserRefuse("SAGA_NOT_PROVEN"); state.stage("created-fence"); return r; },
      async updateUserById(id, input) { if (id !== target.id || !input.ban_duration) adminBrowserRefuse("OWNERSHIP_REFUSED"); allow("/auth/v1/admin/users/" + id, "PUT", context.secretKey, context.secretKey, jsonBody(input), true, "adminAuth"); const r = await server.auth.admin.updateUserById(id, input); if (r.error || !matches(r.data.user, target)) { state.unknown(); adminBrowserRefuse("AUTH_NOT_PROVEN"); } return r; },
    };
    const port = product.createAdminPort(actor, rpc, executionId), auth = product.createAdminAuthPort(port, { auth: { admin } });
    const result = await product.executeAdminCommand(port, auth, commitment, command);
    const p = await inspect("ADMIN_TERMINAL"), row = p.operations.find(o => o.operation_id === operation.operation_id), m = moderation(p, target.id);
    if (!row || row.phase !== "complete" || row.active_execution !== null || row.client_id !== command.input.client_id || !noSessions(p, target.id) || m?.status !== (creating ? "active" : "blocked") || m.must_change_password !== creating || p.operations.length !== 1 || p.audit.length !== 4 || p.receipts.length !== 1 || p.receipts[0].user_id !== a.id || p.receipts[0].command !== command.command || p.events.length !== baseline.events.length + (creating ? 10 : 6) || !same(p.audit.map(r => r.phase), ["reserved", "auth_applied", "revoked", "complete"]) || result.operation_id !== operation.operation_id) adminBrowserRefuse("SAGA_NOT_PROVEN");
    terminalKnown = true; state.stage("admin-terminal"); return target;
  };
  const deniedToken = async s => { if (s.expiresAt <= Date.now() + 60000) adminBrowserRefuse("AUTH_NOT_PROVEN"); allow("/rest/v1/rpc/my_access_state", "POST", context.publishableKey, s.accessToken, jsonBody({})); const r = await client(s).rpc("my_access_state"); if (!r.error || r.error.code !== "42501") adminBrowserRefuse("AUTH_NOT_PROVEN"); };
  const passwordProof = async (o, priorSession) => { const p = await inspect("PASSWORD_COMPLETE"), receipts = p.receipts.filter(r => r.command === "auth.password_changed"), events = p.events.filter(e => e.user_id === o.id && e.entity_type === "authentication" && e.action === "updated" && e.after?.operation === "password_changed"); if (moderation(p, o.id)?.must_change_password !== false || !noSessions(p, o.id) || events.length !== 1 || !same(events[0].after, { operation: "password_changed", forced: true }) || receipts.length !== 1 || receipts[0].user_id !== o.id || !UUID.test(receipts[0].request?.session_id) || receipts[0].request.session_id === priorSession.sessionId) adminBrowserRefuse("AUTH_NOT_PROVEN"); return receipts[0].request.session_id; };
  const completeInventory = () => { inventoryComplete = terminalKnown && owners.length === 2 && owners.every(o => o.current && sessions.some(s => s.id === o.id && s.sessionId === o.current.sessionId)); };
  const cleanup = async () => {
    completeInventory(); if (!inventoryComplete || state.value.writeOutcomeUncertain || pendingSql || io.metadata().pending || nextIo.metadata().pending || io.metadata().permitted || options.cleanupAllowed?.() !== true) adminBrowserRefuse("CLEANUP_NOT_PROVEN");
    const before = await inspect("CLEANUP_INVENTORY"); if (before.users.length !== 2 || before.operations.some(o => o.phase !== "complete" || o.active_execution !== null)) adminBrowserRefuse("CLEANUP_NOT_PROVEN");
    for (const o of owners) { allow("/auth/v1/admin/users/" + o.id, "GET", context.secretKey, context.secretKey, noBody, false, "cleanupHttp"); const r = await server.auth.admin.getUserById(o.id); if (r.error || !matches(r.data.user, o)) adminBrowserRefuse("CLEANUP_NOT_PROVEN"); }
    state.stage("cleanup-inventory");
    for (const [i, o] of owners.entries()) {
      if (context.case === "BLOCK_LIVE_BROWSER" && i === 1) { if (!noSessions(before, o.id) || !user(before, o.id)?.banned_until || Date.parse(user(before, o.id).banned_until) <= Date.now() || moderation(before, o.id)?.status !== "blocked") adminBrowserRefuse("CLEANUP_NOT_PROVEN"); state.count("alreadyRevoked"); continue; }
      allow("/auth/v1/logout?scope=global", "POST", context.secretKey, o.current.accessToken, noBody, true, "cleanupHttp"); const r = await server.auth.admin.signOut(o.current.accessToken, "global"); if (r.error || io.metadata().last?.status !== 204) { state.unknown(); adminBrowserRefuse("CLEANUP_NOT_PROVEN"); } state.count("revocationAcks");
    }
    const revoked = await inspect("CLEANUP_REVOKED"); if (!owners.every(o => noSessions(revoked, o.id)) || !same(revoked.operations, before.operations) || !same(revoked.audit, before.audit) || !same(revoked.receipts, before.receipts) || !same(revoked.events, before.events)) adminBrowserRefuse("CLEANUP_NOT_PROVEN"); state.stage("cleanup-revoked");
    for (const o of owners) {
      allow("/auth/v1/admin/users/" + o.id, "DELETE", context.secretKey, context.secretKey, jsonBody({ should_soft_delete: false }), true, "cleanupHttp"); const r = await server.auth.admin.deleteUser(o.id, false);
      if (io.metadata().last?.status !== 200 || !acceptsAdminNativeDeleteAcknowledgement(r, row => matches(row, o))) { state.unknown(); adminBrowserRefuse("CLEANUP_NOT_PROVEN"); }
      allow("/auth/v1/admin/users/" + o.id, "GET", context.secretKey, context.secretKey, noBody, false, "cleanupHttp"); const absent = await server.auth.admin.getUserById(o.id);
      if (io.metadata().last?.status !== 404 || absent.error?.code !== "user_not_found" || absent.data.user !== null) adminBrowserRefuse("CLEANUP_NOT_PROVEN"); state.count("absenceReads"); state.count("deleted");
    }
    const retained = await inspect("CLEANUP_RETAINED"); if (["users", "sessions", "refreshTokens", "roles", "moderation", "entitlements", "receipts", "events"].some(k => retained[k].length) || !same(retained.operations, before.operations) || !same(retained.audit, before.audit)) adminBrowserRefuse("CLEANUP_NOT_PROVEN"); state.stage("cleanup-retained");
  };
  return Object.freeze({ state, io, nextIo, owners, sessions, ordinaryFixture, verifySession, bootstrap, ownSessions, runAdmin, inspect, deniedToken, passwordProof, cleanup, metadata: () => ({ pendingRequests: io.metadata().pending+nextIo.metadata().pending, pendingInspections: pendingSql, terminalKnown, inventoryComplete }), async dispose() { io.close();nextIo.close();await Promise.all([io.settle(),nextIo.settle()]); } });
}
