// Test-owned bounded channel; no product factories or RPC bodies are replaced.
import {randomBytes,randomUUID,createHash} from "node:crypto";
import {performance} from "node:perf_hooks";
import {resolve,relative,isAbsolute,dirname,basename} from "node:path";
import {loadAdminNativeBackend,acceptsAdminNativeDeleteAcknowledgement} from "./admin-native-backend-case.mjs";
import {acceptsAvatarStorageAbsence} from "./avatar-storage-local-case.mjs";
import {DRIVE_CODES,DRIVE_STAGES,DRIVE_LIMITS,DRIVE_AUTH_ACTION_REDIRECT_VALUES,DRIVE_AUTH_CONTENT_TYPE_VALUES,blankDriveCase,validateDriveCase,closedDriveValue,driveRefuse,isDriveAuthActionRequest} from "./drive-browser-contract.mjs";
export {driveRefuse};
export const DRIVE_APP="http://127.0.0.1:3117",DRIVE_API="http://127.0.0.1:54321";
export const DRIVE_MAX_BYTES=4096,DRIVE_QUOTA_BYTES=32768;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const NS=/^sc-admin-native-[a-f0-9]{32}$/;
const stable=v=>JSON.stringify(v,(_,child)=>child&&typeof child==="object"&&!Array.isArray(child)?Object.fromEntries(Object.keys(child).sort().map(k=>[k,child[k]])):child);
export const sameDriveValue=(a,b)=>stable(a)===stable(b);
export const driveHash=bytes=>createHash("sha256").update(bytes).digest("hex");
export async function closedDriveOperation(fn,code="BROWSER_REFUSED"){try{return await fn();}catch{driveRefuse(code);}}
// Chromium's factual failure code is classified by whole-string equality only.
// A cancellation still refuses the POST; no provider error is serialized.
export function classifyDriveAuthRequestFailure(value){
  if(value==="net::ERR_ABORTED")return"AUTH_POST_ABORTED";
  if(value==="net::ERR_CONNECTION_RESET")return"AUTH_POST_CONNECTION_RESET";
  if(value==="net::ERR_CONNECTION_REFUSED")return"AUTH_POST_CONNECTION_REFUSED";
  if(value==="net::ERR_FAILED")return"AUTH_POST_NETWORK_FAILED";
  return"AUTH_POST_REQUEST_FAILED";
}
// Header observations diagnose the response event only, never session authority.
// Inputs are selected primitive values; objects/coercion and raw output are refused.
export function classifyDriveAuthResponseHeaders(actionRedirect,contentType){
  const available=value=>typeof value==="string"&&value.length<=1024;
  const action=actionRedirect===undefined?"none":!available(actionRedirect)?"unavailable":actionRedirect==="/drive;push"?"drive-push":actionRedirect==="/drive;replace"?"drive-replace":"other";
  const type=contentType===undefined?"none":!available(contentType)?"unavailable":/^text\/x-component(?:;|$)/i.test(contentType)?"rsc":/^text\/html(?:;|$)/i.test(contentType)?"html":/^text\/plain(?:;|$)/i.test(contentType)?"plain":"other";
  return Object.freeze({actionRedirect:action,contentType:type});
}
// Snapshot only the event that establishes the sticky Auth transport failure.
// Missing synchronous observations stay null; late failures cannot backfill it.
export function recordDriveAuthRequestFailure(state,failureText,observe){
  const code=classifyDriveAuthRequestFailure(failureText),before=state.value.code;
  state.unknown();state.fail(code);
  if(before===code||state.value.code!==code||state.value.authPostFailure!==null)return;
  try{
    const v=closedDriveValue(observe()),keys=["resourceType","responseStatus","pageUrl","redirectedFrom","redirectedTo","closeAttempted","routeAbortAttempted","actionRedirect","contentType"];
    if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k))||typeof v.resourceType!=="string"||v.resourceType.length>64||typeof v.pageUrl!=="string"||v.pageUrl.length>4096||v.responseStatus!==null&&(!Number.isInteger(v.responseStatus)||v.responseStatus<100||v.responseStatus>599)||keys.slice(3,7).some(k=>typeof v[k]!=="boolean")||!DRIVE_AUTH_ACTION_REDIRECT_VALUES.includes(v.actionRedirect)||!DRIVE_AUTH_CONTENT_TYPE_VALUES.includes(v.contentType))return;
    state.value.authPostFailure={resourceType:["document","fetch","xhr"].includes(v.resourceType)?v.resourceType:"other",observedResponseStatus:v.responseStatus===null?"none":v.responseStatus===200?"200":v.responseStatus===303?"303":"other",location:[DRIVE_APP+"/entrar",DRIVE_APP+"/entrar?returnTo=%2Fdrive"].includes(v.pageUrl)?"login":v.pageUrl===DRIVE_APP+"/drive"?"drive":"other",redirectedFrom:v.redirectedFrom,redirectedTo:v.redirectedTo,closeAttempted:v.closeAttempted,routeAbortAttempted:v.routeAbortAttempted,actionRedirect:v.actionRedirect,contentType:v.contentType};
  }catch{/* No diagnostic is fabricated when an observation is unavailable. */}
}
export function driveEmptyAuthDecision(value,revealed){
  if(typeof revealed!=="boolean"||!["hidden","shown","unready"].includes(value))driveRefuse("REPORT_REFUSED");
  if(value==="unready")return"wait";
  return value===(revealed?"shown":"hidden")?"done":revealed?"show":"hide";
}
export function isDriveAuthRedirectResponse(url,method,status,location,actionRedirect){
  if(!isDriveAuthActionRequest(url,method)||status!==303)return false;
  return location===undefined&&["/drive;push","/drive;replace"].includes(actionRedirect)||actionRedirect===undefined&&location==="/drive";
}
// Playwright1.63 internalBody refuses300–399. Next15 can send a textual303
// ServerAction Flight; only this reviewed Auth destination is body-ineligible.
// node_modules/playwright-core/lib/coreBundle.js internalBody; Next action-handler.
export async function inspectDriveBrowserTextResponse(state,ownedOperations,response,hasCanary,timers={}){
  let p,set,clear;try{
    const names=["url","method","status","headers","finished","body"],d=Object.getOwnPropertyDescriptors(response),td=Object.getOwnPropertyDescriptors(timers);
    if(Object.getPrototypeOf(response)!==Object.prototype||Reflect.ownKeys(d).length!==names.length||names.some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],"value"))||Object.getPrototypeOf(timers)!==Object.prototype||Reflect.ownKeys(td).some(k=>typeof k!=="string"||!["setTimer","clearTimer"].includes(k)||!td[k].enumerable||!Object.hasOwn(td[k],"value")))driveRefuse("REPORT_REFUSED");
    p=Object.fromEntries(names.map(k=>[k,d[k].value]));set=td.setTimer?td.setTimer.value:setTimeout;clear=td.clearTimer?td.clearTimer.value:clearTimeout;
    if(!(ownedOperations instanceof Set)||typeof p.url!=="string"||typeof p.method!=="string"||!Number.isInteger(p.status)||p.status<100||p.status>599||[p.headers,p.finished,p.body,hasCanary,set,clear].some(v=>typeof v!=="function"))driveRefuse("REPORT_REFUSED");
  }catch{driveRefuse("REPORT_REFUSED");}
  state.active();let timer,expired=false;
  const pending=Promise.resolve().then(async()=>{
    let bytes;try{
      const headers=closedDriveValue(await p.headers());
      if(!headers||typeof headers!=="object"||Array.isArray(headers)||Object.values(headers).some(v=>typeof v!=="string"))driveRefuse("TEXT_BODY_READ_REFUSED");
      if(hasCanary(JSON.stringify(headers))!==false){state.fail("RESPONSE_REFUSED");driveRefuse("RESPONSE_REFUSED");}
      state.active();
      if(p.status===303&&isDriveAuthActionRequest(p.url,p.method)){
        if(!isDriveAuthRedirectResponse(p.url,p.method,p.status,headers.location,headers["x-action-redirect"])){state.fail("AUTH_REDIRECT_HEADER_REFUSED");driveRefuse("AUTH_REDIRECT_HEADER_REFUSED");}
        let finished;try{finished=await p.finished();}catch{state.fail("AUTH_POST_FINISH_REFUSED");driveRefuse("AUTH_POST_FINISH_REFUSED");}
        if(finished!==null){state.fail("AUTH_POST_FINISH_REFUSED");driveRefuse("AUTH_POST_FINISH_REFUSED");}
        return;
      }
      bytes=await p.body();
      if(!Buffer.isBuffer(bytes))driveRefuse("TEXT_BODY_READ_REFUSED");
      if(expired)driveRefuse("TEXT_BODY_DEADLINE_REFUSED");
      if(bytes.length>16777216||hasCanary(bytes.toString("utf8"))!==false){state.fail("RESPONSE_REFUSED");driveRefuse("RESPONSE_REFUSED");}
    }catch{state.fail("TEXT_BODY_READ_REFUSED");driveRefuse(state.value.code);}
    finally{if(Buffer.isBuffer(bytes))bytes.fill(0);}
  }),owned=pending.finally(()=>ownedOperations.delete(owned));ownedOperations.add(owned);
  try{await Promise.race([owned,new Promise((_,reject)=>{timer=set(()=>{expired=true;state.fail("TEXT_BODY_DEADLINE_REFUSED");reject(new Error("TEXT_BODY_DEADLINE_REFUSED"));},15000);})]);state.active();}
  catch{state.fail("TEXT_BODY_READ_REFUSED");driveRefuse(state.value.code);}
  finally{if(timer!==undefined)try{clear(timer);}catch{state.fail("TEXT_BODY_READ_REFUSED");driveRefuse(state.value.code);}}
}
// A deadline does not settle the Playwright operation or release cleanup.
export async function runDriveAuthPostStage(state,ownedOperations,code,operation,postObserved=()=>false,timers={}){
  const deadlines={AUTH_POST_RESPONSE_REFUSED:20000,AUTH_POST_CLICK_REFUSED:20000,AUTH_POST_FINISH_REFUSED:15000};
  if(typeof code!=="string"||!Object.hasOwn(deadlines,code))driveRefuse("REPORT_REFUSED");
  let timer,clear;
  try{
    const d=Object.getOwnPropertyDescriptors(timers),keys=Reflect.ownKeys(d);
    if(Object.getPrototypeOf(timers)!==Object.prototype||keys.some(k=>typeof k!=="string"||!["setTimer","clearTimer"].includes(k)||!d[k].enumerable||!Object.hasOwn(d[k],"value")))driveRefuse("REPORT_REFUSED");
    const set=d.setTimer?d.setTimer.value:setTimeout;clear=d.clearTimer?d.clearTimer.value:clearTimeout;
    if(!(ownedOperations instanceof Set)||typeof operation!=="function"||typeof postObserved!=="function"||typeof set!=="function"||typeof clear!=="function")driveRefuse("REPORT_REFUSED");
    state.active();
    const pending=Promise.resolve().then(operation),owned=pending.finally(()=>ownedOperations.delete(owned));ownedOperations.add(owned);
    const deadline=new Promise((_,reject)=>{timer=set(()=>{const e=new Error(code);e.stack=code;reject(e);},deadlines[code]);});
    const value=await Promise.race([owned,deadline]);clear(timer);timer=undefined;state.active();return value;
  }catch{
    try{if(timer!==undefined&&clear)clear(timer);}catch{/* private timer error */}
    let observed=false;try{observed=postObserved()===true;}catch{/* no factual POST proof */}
    if(observed)state.unknown();state.fail(code);driveRefuse(code);
  }
}
export function driveEnvironment(env,platform=process.platform){
  if(platform!=="linux"||env.CI!=="true"||env.GITHUB_ACTIONS!=="true"||env.SC_AUTH_LOCAL_CI_RUN!=="1"||env.SC_FILES_LOCAL_CI_RUN!=="1"||env.SC_DRIVE_BROWSER_RUN!=="1"||env.NODE_ENV!=="development"||env.APP_MODE!=="supabase"||env.APP_URL!==DRIVE_APP||env.SUPABASE_URL!==DRIVE_API||env.DRIVE_MAX_FILE_BYTES!==String(DRIVE_MAX_BYTES)||env.DRIVE_QUOTA_BYTES!==String(DRIVE_QUOTA_BYTES)||!NS.test(env.SC_DRIVE_BROWSER_NAMESPACE)||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA)||!/^sc-auth-ci-[a-f0-9]{24}$/.test(env.SC_DRIVE_BROWSER_PROJECT)||!/^[0-9]{16,20}$/.test(env.SC_DRIVE_BROWSER_SYSTEM)||!/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(env.SUPABASE_PUBLISHABLE_KEY)||!/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(env.SUPABASE_SECRET_KEY)||[env.AUTH_STATE_SECRET,env.AUTH_RATE_LIMIT_SECRET,env.ADMIN_COMMAND_SECRET].some(s=>typeof s!=="string"||Buffer.byteLength(s)<32)||new Set([env.AUTH_STATE_SECRET,env.AUTH_RATE_LIMIT_SECRET,env.ADMIN_COMMAND_SECRET,env.SUPABASE_SECRET_KEY]).size!==4||Object.keys(env).some(k=>/^(?:NEXT_PUBLIC_|GOOGLE_|SENTRY_|VERCEL_|GH_TOKEN$|GITHUB_TOKEN$|SUPABASE_ACCESS_TOKEN$|SUPABASE_DB_PASSWORD$|DATABASE_URL$)/.test(k)))driveRefuse("ENVIRONMENT_REFUSED");
  const path=env.SC_DRIVE_BROWSER_REPORT,parent=env.RUNNER_TEMP;if(!path||!parent||!isAbsolute(path)||!isAbsolute(parent)||relative(parent,path).startsWith("..")||dirname(path)===resolve(parent)||basename(path)!=="drive-browser-case-report.json")driveRefuse("ENVIRONMENT_REFUSED");
  return Object.freeze({namespace:env.SC_DRIVE_BROWSER_NAMESPACE,sourceSha:env.GITHUB_SHA,systemIdentifier:env.SC_DRIVE_BROWSER_SYSTEM,projectId:env.SC_DRIVE_BROWSER_PROJECT,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,secretKey:env.SUPABASE_SECRET_KEY,reportPath:path});
}
export function acceptDriveBrowserRequest(value,method,ownerId){try{const u=new URL(value);if(u.username||u.password||u.hash||value!==u.href)return false;
  if(u.origin===DRIVE_API){if(!UUID.test(ownerId))return false;const put=new RegExp("^/storage/v1/object/upload/sign/second-brain-staging/"+ownerId+"/[a-f0-9-]{36}$"),get=new RegExp("^/storage/v1/object/sign/second-brain-files/"+ownerId+"/[a-f0-9-]{36}$");return(method==="PUT"&&put.test(u.pathname)||method==="GET"&&get.test(u.pathname))&&[...u.searchParams].length===(method==="PUT"?1:1+(u.searchParams.has("download")?1:0))&&/^[A-Za-z0-9_.-]{16,8192}$/.test(u.searchParams.get("token")??"")&&(!u.searchParams.has("download")||method==="GET"&&u.searchParams.get("download").length<=200);}
  if(u.origin!==DRIVE_APP||!["GET","POST"].includes(method))return false;
  if(method==="POST")return u.pathname==="/entrar"&&["","?returnTo=%2Fdrive"].includes(u.search)||["/api/files","/api/files/uploads","/api/monitoring"].includes(u.pathname)&&!u.search;
  // Next15.5.27 development emits one Date.now() asset version parameter.
  if(u.pathname.startsWith("/_next/static/")&&/^\/_next\/static\/[A-Za-z0-9_@%\[\]()./-]+$/.test(u.pathname)&&!decodeURIComponent(u.pathname).includes("..")&&!/%(?:2f|5c|00)/i.test(u.pathname)&&(!u.search||/^\?v=\d{13}$/.test(u.search)))return true;
  if(["/_next/webpack-hmr","/favicon.ico","/api/calendar","/api/files"].includes(u.pathname))return!u.search;
  if(u.pathname==="/api/files/read")return UUID.test(u.searchParams.get("id"))&&u.searchParams.get("user")===ownerId&&u.searchParams.get("download")==="1"&&[...u.searchParams].length===3;
  if(u.pathname==="/api/knowledge")return u.searchParams.get("related_type")==="file"&&UUID.test(u.searchParams.get("related_id"))&&[...u.searchParams].length===2;
  if(!["/drive","/entrar","/design-system"].includes(u.pathname))return false;
  return new Set([...u.searchParams.keys()]).size===[...u.searchParams].length&&[...u.searchParams].every(([k,v])=>k==="_rsc"&&/^[A-Za-z0-9_-]{1,100}$/.test(v)||k==="returnTo"&&v==="/drive"||u.pathname==="/drive"&&(k==="folder"||k==="file")&&UUID.test(v)||u.pathname==="/drive"&&k==="view"&&v==="trash"||k==="notice"&&v==="session-required");
}catch{return false;}}
export function isDriveBrowserReadCancellationRequest(value,method,ownerId){
  if(typeof value!=="string"||method!=="GET"||ownerId!==undefined&&typeof ownerId!=="string"||!acceptDriveBrowserRequest(value,method,ownerId))return false;
  try{const u=new URL(value);return value===u.href&&value===u.origin+u.pathname+u.search&&!["/sair","/auth/callback","/auth/v1/verify"].includes(u.pathname);}catch{return false;}
}
export function createDriveState({now=()=>performance.now(),caseMs=DRIVE_LIMITS.caseMs}={}){if(typeof now!=="function"||!Number.isSafeInteger(caseMs)||caseMs<1||caseMs>DRIVE_LIMITS.caseMs)driveRefuse("ENVIRONMENT_REFUSED");const value=structuredClone(blankDriveCase()),start=now();let failed=false,closed=false;value.status="failed";value.code="BROWSER_REFUSED";
  const fail=code=>{if(!failed){failed=true;value.code=DRIVE_CODES.includes(code)&&!["PASSED","NOT_RUN"].includes(code)?code:"BROWSER_REFUSED";}};
  const active=()=>{if(now()-start>=caseMs)fail("DEADLINE_EXCEEDED");if(failed||closed)driveRefuse(value.code);};
  return Object.freeze({value,active,fail,unknown:()=>{value.writeOutcomeUncertain=true;},count(key){active();if(!Object.hasOwn(value.counts,key)||value.counts[key]>=DRIVE_LIMITS[key]){fail("REQUEST_REFUSED");driveRefuse("REQUEST_REFUSED");}value.counts[key]++;},stage(stage){active();if(DRIVE_STAGES[value.stages.length]!==stage)driveRefuse("REPORT_REFUSED");value.stages.push(stage);},finish(requests,inspections){if(now()-start>=caseMs)fail("DEADLINE_EXCEEDED");closed=true;value.pendingRequests=requests;value.pendingInspections=inspections;if(!failed&&!value.writeOutcomeUncertain&&!requests&&!inspections&&value.stages.length===DRIVE_STAGES.length){value.status="passed";value.code="PASSED";}return validateDriveCase(value);}});
}
export function createDriveIo(state,nativeFetch=fetch,{requestMs=DRIVE_LIMITS.requestMs}={}){
  if(typeof nativeFetch!=="function"||!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>DRIVE_LIMITS.requestMs)driveRefuse("ENVIRONMENT_REFUSED");let permit=null,closed=false;const pending=new Set(),controllers=new Set();
  const transport=async(input,init={})=>{state.active();const spec=permit;permit=null;const url=typeof input==="string"?input:input instanceof URL?input.href:input?.url,h=new Headers(init.headers);if(closed||!spec||url!==spec.url||(init.method??"GET").toUpperCase()!==spec.method)driveRefuse("REQUEST_REFUSED");
    if(spec.mode==="sdk"?(h.has("cookie")||h.get("apikey")!==spec.key||h.get("authorization")!=="Bearer "+spec.token):spec.mode==="cap"?(h.has("cookie")||h.has("apikey")||h.has("authorization")):(h.has("apikey")||h.has("authorization")||h.get("cookie")!==spec.cookie||h.get("x-expected-user-id")!==spec.ownerId||h.get("origin")!==DRIVE_APP))driveRefuse("REQUEST_REFUSED");
    if(spec.body!==undefined){let b;try{b=JSON.parse(init.body);}catch{driveRefuse("REQUEST_REFUSED");}if(!sameDriveValue(b,spec.body))driveRefuse("REQUEST_REFUSED");}if(spec.checkBody)await spec.checkBody(init.body,h);
    state.count(spec.mode==="next"?"nextProbeRequests":"ownedSdkRequests");const c=new AbortController();controllers.add(c);let expired=false,timer;
    const owned=(async()=>{const r=await nativeFetch(url,{...init,redirect:"error",credentials:"omit",cache:"no-store",signal:c.signal});if(!(r instanceof Response)||r.redirected||r.url&&r.url!==url)driveRefuse("RESPONSE_REFUSED");let reader,n=0;const chunks=[];try{if(r.body){reader=r.body.getReader();for(;;){const p=await reader.read();if(p.done)break;n+=p.value.byteLength;if(n>DRIVE_LIMITS.responseBytes)driveRefuse("RESPONSE_REFUSED");chunks.push(p.value);}}const bytes=Buffer.concat(chunks,n);try{state.active();if(expired)driveRefuse("DEADLINE_EXCEEDED");if(spec.checkResponse)spec.checkResponse(r.status,bytes,r.headers);return new Response(r.body?bytes:null,{status:r.status,headers:r.headers});}finally{bytes.fill(0);}}finally{chunks.forEach(b=>b.fill(0));await reader?.cancel().catch(()=>{});}})().catch(()=>{if(spec.write)state.unknown();state.fail(expired?"DEADLINE_EXCEEDED":"TRANSPORT_FAILED");driveRefuse(expired?"DEADLINE_EXCEEDED":"TRANSPORT_FAILED");}).finally(()=>{pending.delete(owned);controllers.delete(c);});pending.add(owned);
    try{return await Promise.race([owned,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;c.abort();if(spec.write)state.unknown();state.fail("DEADLINE_EXCEEDED");reject(new Error("DEADLINE_EXCEEDED"));},requestMs);})]);}finally{clearTimeout(timer);}
  };
  return Object.freeze({transport,async request(spec,operation){state.active();let u;try{u=new URL(spec.url);}catch{driveRefuse("REQUEST_REFUSED");}if(closed||permit||pending.size||typeof operation!=="function"||!spec||typeof spec.write!=="boolean"||!["sdk","cap","next"].includes(spec.mode)||!["GET","POST","PUT","DELETE"].includes(spec.method)||u.username||u.password||u.hash||u.origin!==(spec.mode==="next"?DRIVE_APP:DRIVE_API))driveRefuse("REQUEST_REFUSED");permit=spec;try{const r=await operation();if(permit)driveRefuse("REQUEST_REFUSED");state.active();return r;}catch(e){if(spec.write&&!(e instanceof Error&&DRIVE_CODES.includes(e.message)))state.unknown();throw e;}finally{permit=null;}},metadata:()=>({pending:pending.size,permitted:permit!==null}),async settle(){let timer;try{await Promise.race([Promise.allSettled([...pending]),new Promise(r=>{timer=setTimeout(r,2000);})]);return!pending.size;}finally{clearTimeout(timer);}},close(){closed=true;permit=null;for(const c of controllers)c.abort();}});
}
/** One fixed READ ONLY inventory; every identity remains private in memory. */
export function driveInspectionSql(ctx){if(!NS.test(ctx.namespace)||!/^[a-f0-9]{40}$/.test(ctx.sourceSha)||!/^[0-9]{16,20}$/.test(ctx.systemIdentifier)||!/^sc-auth-ci-[a-f0-9]{24}$/.test(ctx.projectId))driveRefuse("SQL_REFUSED");return `\\set sc_ns ${ctx.namespace}\n\\set sc_sha ${ctx.sourceSha}\n\\set sc_system ${ctx.systemIdentifier}\n\\set sc_project ${ctx.projectId}\nbegin read only;set local statement_timeout='10s';set local lock_timeout='2s';
select jsonb_build_object(
'provenance',jsonb_build_object('namespace',:'sc_ns','sourceSha',:'sc_sha','systemIdentifier',(select system_identifier::text from pg_control_system()),'database',current_database(),'currentUser',current_user,'serverVersion',current_setting('server_version_num')::integer,'markerRows',(select count(*) from app_private.sc_admin_ci_marker where namespace=:'sc_ns' and source_sha=:'sc_sha' and system_identifier=:'sc_system' and project_id=:'sc_project'),'allMarkers',(select count(*) from app_private.sc_admin_ci_marker)),
'users',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'metadata',raw_app_meta_data,'anonymous',is_anonymous,'deleted',deleted_at) order by id),'[]'::jsonb) from auth.users),
'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id) order by id),'[]'::jsonb) from auth.sessions),
'refreshUsers',(select coalesce(jsonb_agg(user_id order by id),'[]'::jsonb) from auth.refresh_tokens),
'roles',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'role',role)),'[]'::jsonb) from public.user_roles),
'moderation',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'status',status,'must_change_password',must_change_password)),'[]'::jsonb) from public.user_moderation),
'profiles',(select coalesce(jsonb_agg(user_id),'[]'::jsonb) from public.profiles),'preferences',(select coalesce(jsonb_agg(user_id),'[]'::jsonb) from public.user_preferences),
'folders',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'name',name,'parent_id',parent_id,'deleted_at',deleted_at,'deletion_batch_id',deletion_batch_id) order by id),'[]'::jsonb) from public.drive_folders),
'files',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'name',name,'folder_id',folder_id,'mime',mime,'bytes',bytes,'sha256',sha256,'storage_path',storage_path,'deleted_at',deleted_at,'deletion_batch_id',deletion_batch_id,'purged_at',purged_at,'kind',kind) order by id),'[]'::jsonb) from public.drive_files),
'uploads',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'name',name,'folder_id',folder_id,'status',status,'staging_path',staging_path,'final_path',final_path,'max_bytes',max_bytes,'quota_bytes',quota_bytes,'file_id',file_id,'lease_id',lease_id,'lease_until',lease_until) order by id),'[]'::jsonb) from app_private.upload_reservations),
'objects',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket_id',bucket_id,'name',name) order by bucket_id,name),'[]'::jsonb) from storage.objects),
'usageBytes',(select coalesce(sum(bytes),0) from public.drive_files where purged_at is null),
'events',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'entity_type',entity_type,'action',action) order by occurred_at),'[]'::jsonb) from public.domain_events),
'receipts',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'command',command) order by created_at),'[]'::jsonb) from app_private.command_receipts),
'otherRows',(select count(*) from (select 1 from public.captures union all select 1 from public.tasks union all select 1 from public.knowledge_pages union all select 1 from public.projects union all select 1 from public.habits union all select 1 from public.fin_transactions union all select 1 from public.vault_items union all select 1 from public.capture_file_links union all select 1 from public.admin_audit_events union all select 1 from app_private.admin_operations) r));rollback;`;}
export function acceptDriveSql(input,ctx,owner){const v=closedDriveValue(input),keys=["provenance","users","sessions","refreshUsers","roles","moderation","profiles","preferences","folders","files","uploads","objects","usageBytes","events","receipts","otherRows"],p=v?.provenance;if(!v||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k))||!p||Object.keys(p).length!==8||p.namespace!==ctx.namespace||p.sourceSha!==ctx.sourceSha||p.systemIdentifier!==ctx.systemIdentifier||p.database!=="postgres"||p.currentUser!=="postgres"||!Number.isInteger(p.serverVersion)||p.serverVersion<170000||p.serverVersion>=180000||p.markerRows!==1||p.allMarkers!==1||v.otherRows!==0||!Number.isSafeInteger(v.usageBytes)||v.usageBytes<0)driveRefuse("SQL_REFUSED");for(const k of keys.filter(k=>!["provenance","usageBytes","otherRows"].includes(k)))if(!Array.isArray(v[k])||v[k].length>64)driveRefuse("SQL_REFUSED");
  const owns=id=>owner&&id===owner.id;if(v.users.length>1||v.users.some(u=>!owns(u.id)||u.email!==owner.email||u.metadata?.sc_drive_fixture!==ctx.namespace||u.anonymous!==false||u.deleted!==null)||v.sessions.some(s=>!owns(s.user_id)||!UUID.test(s.id))||v.refreshUsers.some(id=>!owns(id))||["roles","moderation","folders","files","uploads","events","receipts"].some(k=>v[k].some(r=>!owns(r.user_id)))||["profiles","preferences"].some(k=>v[k].some(id=>!owns(id)))||v.roles.some(r=>r.role!=="user")||v.moderation.some(r=>r.status!=="active"||r.must_change_password!==false))driveRefuse("OWNERSHIP_REFUSED");
  for(const k of["folders","files","uploads","objects","sessions"])if(new Set(v[k].map(r=>r.id)).size!==v[k].length||v[k].some(r=>!UUID.test(r.id)))driveRefuse("OWNERSHIP_REFUSED");
  if(v.files.some(f=>f.kind!=="drive"||f.storage_path!==owner.id+"/"+f.id||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.bytes>DRIVE_MAX_BYTES||!/^[a-f0-9]{64}$/.test(f.sha256)||f.purged_at!==null)||v.uploads.some(r=>r.staging_path!==owner.id+"/"+r.id||r.final_path!==r.staging_path||r.max_bytes!==DRIVE_MAX_BYTES||r.quota_bytes!==DRIVE_QUOTA_BYTES||!["reserved","finalized"].includes(r.status)||r.lease_id!==null||r.lease_until!==null)||v.objects.some(o=>!["second-brain-staging","second-brain-files"].includes(o.bucket_id)||!v.uploads.some(r=>r.staging_path===o.name))||v.usageBytes!==v.files.reduce((sum,f)=>sum+f.bytes,0))driveRefuse("SQL_REFUSED");return v;
}
export async function createDriveHarness(ctx,options){if(!NS.test(ctx.namespace)||!/^[a-f0-9]{40}$/.test(ctx.sourceSha)||["query","cleanupAllowed"].some(k=>typeof Object.getOwnPropertyDescriptor(options??{},k)?.value!=="function")||options.transport!==undefined&&typeof Object.getOwnPropertyDescriptor(options,"transport")?.value!=="function")driveRefuse("ENVIRONMENT_REFUSED");
  const {product}=await loadAdminNativeBackend(),state=createDriveState(),io=createDriveIo(state,options.transport??fetch),settings={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},db:{retry:false},global:{fetch:io.transport}},server=product.createClient(DRIVE_API,ctx.secretKey,settings),sessions=[];let owner=null,pendingSql=0,fixtureKnown=false,inventory=null;const inspections=new Set();
  const slot=(path,method,write=false,key=ctx.secretKey,token=key)=>({mode:"sdk",url:DRIVE_API+path,method,key,token,write});
  const status=(expected,check)=> (actual,bytes,headers)=>{if(actual!==expected)driveRefuse("RESPONSE_REFUSED");if(check){let value;try{value=JSON.parse(bytes.toString("utf8"));}catch{driveRefuse("RESPONSE_REFUSED");}if(!check(value,headers))driveRefuse("RESPONSE_REFUSED");}};
  const matches=u=>u&&u.id===owner.id&&u.email===owner.email&&u.role==="authenticated"&&u.is_anonymous===false&&u.app_metadata?.sc_drive_fixture===ctx.namespace;
  const inspect=async()=>{state.active();if(pendingSql)driveRefuse("SQL_REFUSED");state.count("sqlInspections");pendingSql++;let timer;const owned=Promise.resolve().then(()=>options.query(driveInspectionSql(ctx))).finally(()=>{pendingSql--;inspections.delete(owned);});inspections.add(owned);try{const p=await Promise.race([owned,new Promise((_,reject)=>{timer=setTimeout(()=>{state.fail("DEADLINE_EXCEEDED");reject(new Error("DEADLINE_EXCEEDED"));},DRIVE_LIMITS.requestMs);})]);state.active();return acceptDriveSql(p,ctx,owner);}catch(e){state.fail(e instanceof Error?e.message:"SQL_REFUSED");driveRefuse(e instanceof Error?e.message:"SQL_REFUSED");}finally{clearTimeout(timer);}};
  const fixture=async()=>{if(owner)driveRefuse("OWNERSHIP_REFUSED");owner={id:randomUUID(),email:"drive-browser-"+randomBytes(16).toString("hex")+"@example.invalid",password:randomBytes(24).toString("base64url")+"-Aa1!"};const before=await inspect();if(before.users.length||before.files.length||before.folders.length||before.uploads.length||before.objects.length||before.sessions.length||before.roles.length||before.events.length||before.receipts.length)driveRefuse("OWNERSHIP_REFUSED");const input={id:owner.id,email:owner.email,password:owner.password,email_confirm:true,app_metadata:{sc_drive_fixture:ctx.namespace}},spec={...slot("/auth/v1/admin/users","POST",true),body:input,checkResponse:status(200)};const r=await io.request(spec,()=>server.auth.admin.createUser(input));if(r.error||!matches(r.data.user)){state.unknown();driveRefuse("AUTH_NOT_PROVEN");}fixtureKnown=true;state.count("fixturesCreated");return owner;};
  const verifySession=async hint=>{if(!fixtureKnown||!UUID.test(hint.sessionId)||hint.expiresAt<=Date.now()+60000||typeof hint.accessToken!=="string"||sessions.some(s=>s.sessionId===hint.sessionId))driveRefuse("AUTH_NOT_PROVEN");const client=product.createClient(DRIVE_API,ctx.publishableKey,{...settings,global:{fetch:io.transport,headers:{Authorization:"Bearer "+hint.accessToken}}}),get={...slot("/auth/v1/user","GET",false,ctx.publishableKey,hint.accessToken),checkResponse:status(200)};const r=await io.request(get,()=>client.auth.getUser(hint.accessToken));if(r.error||!matches(r.data.user))driveRefuse("AUTH_NOT_PROVEN");const access=await io.request({...slot("/rest/v1/rpc/my_access_state","POST",false,ctx.publishableKey,hint.accessToken),body:{},checkResponse:status(200)},()=>client.rpc("my_access_state"));if(access.error||!sameDriveValue(access.data,{user_id:owner.id,role:"user",must_change_password:false,entitlements:{}}))driveRefuse("AUTH_NOT_PROVEN");const p=await inspect();if(!p.sessions.some(s=>s.id===hint.sessionId&&s.user_id===owner.id)||p.users.length!==1||p.profiles.length!==1||p.preferences.length!==1)driveRefuse("AUTH_NOT_PROVEN");sessions.push({...hint});return hint;};
  const nextJson=async(path,body,cookies,expected=200)=>{if(!fixtureKnown||!["/api/files","/api/files/uploads"].includes(path)||!Array.isArray(cookies)||cookies.length>32||cookies.some(c=>!/^sc-auth(?:\.[0-9]+)?$/.test(c.name)||typeof c.value!=="string"||!/^[\x21-\x2b\x2d-\x3a\x3c-\x7e]{1,16384}$/.test(c.value)))driveRefuse("REQUEST_REFUSED");const cookie=cookies.map(c=>c.name+"="+c.value).join("; "),spec={mode:"next",url:DRIVE_APP+path,method:"POST",write:true,cookie,ownerId:owner.id,body,checkResponse:status(expected,v=>expected===400?v?.ok===false&&v.code==="VALIDATION":path==="/api/files"?v?.ok===true:UUID.test(v?.id))};const response=await io.request(spec,()=>io.transport(spec.url,{method:"POST",headers:{Cookie:cookie,Origin:DRIVE_APP,"X-Expected-User-ID":owner.id,"Content-Type":"application/json"},body:JSON.stringify(body)}));return closedDriveOperation(()=>response.json(),"RESPONSE_REFUSED");};
  const oversize=async cookies=>{const bytes=Buffer.alloc(DRIVE_MAX_BYTES+1,65);try{const clientId=randomUUID(),r=await nextJson("/api/files/uploads",{kind:"drive",name:"oversize.txt",folder_id:null,client_id:clientId},cookies);if(typeof r.upload_url!=="string"||typeof r.token!=="string"||!UUID.test(r.id)||!acceptDriveBrowserRequest(r.upload_url,"PUT",owner.id))driveRefuse("RESPONSE_REFUSED");const url=new URL(r.upload_url);if(url.searchParams.get("token")!==r.token||url.pathname!=="/storage/v1/object/upload/sign/second-brain-staging/"+owner.id+"/"+r.id)driveRefuse("OWNERSHIP_REFUSED");const form=new FormData();form.append("cacheControl","0");form.append("",new Blob([bytes],{type:"text/plain"}),"oversize.txt");const spec={mode:"cap",url:url.href,method:"PUT",write:true,checkResponse:status(200)};await io.request(spec,()=>io.transport(spec.url,{method:"PUT",headers:{"x-upsert":"false"},body:form}));await nextJson("/api/files",{command:"file.upload.finalize",input:{upload_id:r.id,client_id:clientId}},cookies,400);const p=await inspect();if(p.files.length!==2||!p.uploads.some(x=>x.id===r.id&&x.status==="reserved"&&x.file_id===null)||p.objects.filter(o=>o.name===owner.id+"/"+r.id).length!==1)driveRefuse("DRIVE_NOT_PROVEN");state.count("serverOversize");}finally{bytes.fill(0);}};
  const cleanup=async()=>{state.active();if(!fixtureKnown||sessions.length!==2||!options.cleanupAllowed()||io.metadata().pending||pendingSql||state.value.writeOutcomeUncertain||state.value.stages.at(-1)!=="contexts-closed")driveRefuse("CLEANUP_NOT_PROVEN");inventory=await inspect();if(inventory.files.length!==2||inventory.folders.length!==3||inventory.uploads.length!==4||inventory.objects.length!==6||inventory.sessions.length!==2||sessions.some(s=>!inventory.sessions.some(row=>row.id===s.sessionId)))driveRefuse("CLEANUP_NOT_PROVEN");
    for(const bucket of["second-brain-staging","second-brain-files"]){const objects=inventory.objects.filter(o=>o.bucket_id===bucket),paths=objects.map(o=>o.name),spec={...slot("/storage/v1/object/"+bucket,"DELETE",true),body:{prefixes:paths},checkResponse:status(200,v=>Array.isArray(v)&&v.length===objects.length&&new Set(v.map(o=>o.id)).size===objects.length&&v.every(o=>objects.some(x=>x.id===o.id&&x.name===o.name&&(o.bucket_id===undefined||o.bucket_id===bucket))))};const reply=await io.request(spec,()=>server.storage.from(bucket).remove(paths));if(reply.error||!Array.isArray(reply.data)||reply.data.length!==objects.length){state.unknown();driveRefuse("CLEANUP_NOT_PROVEN");}state.count("storageDeletes");const p=await inspect();if(p.objects.some(o=>o.bucket_id===bucket))driveRefuse("CLEANUP_NOT_PROVEN");for(const object of objects){const absent={...slot("/storage/v1/object/"+bucket+"/"+object.name,"GET"),checkResponse:(httpStatus,bytes)=>{let body;try{body=JSON.parse(bytes.toString("utf8"));}catch{driveRefuse("CLEANUP_NOT_PROVEN");}if(!acceptsAvatarStorageAbsence(httpStatus,body,true))driveRefuse("CLEANUP_NOT_PROVEN");}};const read=await io.request(absent,()=>server.storage.from(bucket).download(object.name));if(read.data!==null||read.error?.code!=="NoSuchKey"||![400,404].includes(read.error.status))driveRefuse("CLEANUP_NOT_PROVEN");state.count("storageAbsenceReads");}}
    state.stage("storage-absent");const current=sessions.at(-1),revoke={...slot("/auth/v1/logout?scope=global","POST",true,ctx.secretKey,current.accessToken),checkResponse:status(204)};const signed=await io.request(revoke,()=>server.auth.admin.signOut(current.accessToken,"global"));if(signed.error){state.unknown();driveRefuse("CLEANUP_NOT_PROVEN");}state.count("authRevocations");const revoked=await inspect();if(revoked.sessions.length||revoked.refreshUsers.length)driveRefuse("CLEANUP_NOT_PROVEN");state.stage("auth-revoked");const del={...slot("/auth/v1/admin/users/"+owner.id,"DELETE",true),body:{should_soft_delete:false},checkResponse:status(200)};const removed=await io.request(del,()=>server.auth.admin.deleteUser(owner.id));if(removed.error||!acceptsAdminNativeDeleteAcknowledgement(removed,matches)){state.unknown();driveRefuse("CLEANUP_NOT_PROVEN");}state.count("authDeletes");const absent={...slot("/auth/v1/admin/users/"+owner.id,"GET"),checkResponse:status(404,v=>v?.code==="user_not_found")};const read=await io.request(absent,()=>server.auth.admin.getUserById(owner.id));if(read.data.user!==null||read.error?.code!=="user_not_found"||read.error.status!==404)driveRefuse("CLEANUP_NOT_PROVEN");state.count("authAbsenceReads");state.stage("auth-absent");const final=await inspect();if(["users","sessions","refreshUsers","roles","moderation","profiles","preferences","files","folders","uploads","objects","events","receipts"].some(k=>final[k].length)||final.usageBytes)driveRefuse("CLEANUP_NOT_PROVEN");state.stage("final-sql");};
  return Object.freeze({state,fixture,verifySession,inspect,nextJson,oversize,cleanup,get owner(){return owner;},metadata:()=>({pendingRequests:io.metadata().pending,pendingInspections:pendingSql}),async dispose(){await io.settle();let timer;try{await Promise.race([Promise.allSettled([...inspections]),new Promise(r=>{timer=setTimeout(r,2000);})]);}finally{clearTimeout(timer);io.close();if(owner)owner.password="";for(const s of sessions)s.accessToken="";}}});
}
