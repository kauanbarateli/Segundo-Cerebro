// SDK installed, SQL/HTTP doubles in RAM. No Next, PG17 or browser is started.
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID}from"node:crypto";
import {createLocalCanonicalSql}from"../helpers/local-canonical-sql.ts";
import {DRIVE_APP,DRIVE_API,DRIVE_MAX_BYTES,DRIVE_QUOTA_BYTES,createDriveState,createDriveIo,runDriveAuthPostStage,classifyDriveAuthRequestFailure,driveEnvironment,acceptDriveBrowserRequest,driveInspectionSql,acceptDriveSql,createDriveHarness}from"../e2e-auth-local/drive-browser-support.mjs";
import {DRIVE_STAGES,DRIVE_PASS_COUNTS,DRIVE_LIMITS,DRIVE_AUTH_POST_CODES,blankDriveCase,validateDriveCase,closedDriveValue}from"../e2e-auth-local/drive-browser-contract.mjs";
const ctx={namespace:"sc-admin-native-"+"a".repeat(32),sourceSha:"b".repeat(40),systemIdentifier:"1234567890123456789",projectId:"sc-auth-ci-"+"c".repeat(24),publishableKey:"sb_publishable_"+"d".repeat(32),secretKey:"sb_secret_"+"e".repeat(32),reportPath:"/tmp/runner/sc-drive-browser-owned/drive-browser-case-report.json"};
const env={CI:"true",GITHUB_ACTIONS:"true",SC_AUTH_LOCAL_CI_RUN:"1",SC_FILES_LOCAL_CI_RUN:"1",SC_DRIVE_BROWSER_RUN:"1",NODE_ENV:"development",APP_MODE:"supabase",APP_URL:DRIVE_APP,SUPABASE_URL:DRIVE_API,DRIVE_MAX_FILE_BYTES:String(DRIVE_MAX_BYTES),DRIVE_QUOTA_BYTES:String(DRIVE_QUOTA_BYTES),SC_DRIVE_BROWSER_NAMESPACE:ctx.namespace,GITHUB_SHA:ctx.sourceSha,SC_DRIVE_BROWSER_SYSTEM:ctx.systemIdentifier,SC_DRIVE_BROWSER_PROJECT:ctx.projectId,SUPABASE_PUBLISHABLE_KEY:ctx.publishableKey,SUPABASE_SECRET_KEY:ctx.secretKey,AUTH_STATE_SECRET:"f".repeat(40),AUTH_RATE_LIMIT_SECRET:"g".repeat(40),ADMIN_COMMAND_SECRET:"h".repeat(40),SC_DRIVE_BROWSER_REPORT:ctx.reportPath,RUNNER_TEMP:"/tmp/runner"};
const proof=()=>({provenance:{namespace:ctx.namespace,sourceSha:ctx.sourceSha,systemIdentifier:ctx.systemIdentifier,database:"postgres",currentUser:"postgres",serverVersion:170011,markerRows:1,allMarkers:1},users:[],sessions:[],refreshUsers:[],roles:[],moderation:[],profiles:[],preferences:[],folders:[],files:[],uploads:[],objects:[],usageBytes:0,events:[],receipts:[],otherRows:0});
test("sterile local dual opt-in rejects Windows, hosted origins, mixed secrets and unbounded report paths",()=>{assert.deepEqual(driveEnvironment(env,"linux"),ctx);for(const patch of[{SC_FILES_LOCAL_CI_RUN:"0"},{SC_AUTH_LOCAL_CI_RUN:"0"},{SC_DRIVE_BROWSER_RUN:"0"},{SUPABASE_URL:"https://foreign.supabase.co"},{APP_URL:"http://localhost:3117"},{DRIVE_MAX_FILE_BYTES:"4097"},{DRIVE_QUOTA_BYTES:"1"},{AUTH_RATE_LIMIT_SECRET:env.AUTH_STATE_SECRET},{NEXT_PUBLIC_KEY:"synthetic"},{GITHUB_TOKEN:"synthetic"},{SC_DRIVE_BROWSER_REPORT:"/tmp/outside.json"}])assert.throws(()=>driveEnvironment({...env,...patch},"linux"),{message:"ENVIRONMENT_REFUSED"});assert.throws(()=>driveEnvironment(env,"win32"));});
test("closed report refuses getters, unknown stages, unsupported claims and premature PASS",()=>{let got=0;assert.throws(()=>closedDriveValue({get private(){got++;return"CANARY";}}));assert.equal(got,0);for(const v of[[,,],new Date(),Object.create(null),{[Symbol("private")]:true}])assert.throws(()=>closedDriveValue(v));const state=createDriveState();state.stage("fixture");assert.throws(()=>state.stage("server-rejections"));state.unknown();state.fail("DRIVE_NOT_PROVEN");const result=state.finish(0,0);assert.equal(result.status,"failed");assert.equal(result.writeOutcomeUncertain,true);assert.throws(()=>validateDriveCase({...result,status:"passed",code:"PASSED"}));assert.throws(()=>validateDriveCase({...result,password:"PRIVATE_CANARY"}));});
test("finite stage order and counts preserve first failure across deadline and teardown",()=>{let now=0;const state=createDriveState({now:()=>now,caseMs:10});state.fail("DRIVE_NOT_PROVEN");now=20;assert.equal(state.finish(0,0).code,"DRIVE_NOT_PROVEN");const passed=createDriveState();for(const stage of DRIVE_STAGES)passed.stage(stage);for(const[k,n]of Object.entries(DRIVE_PASS_COUNTS))for(let i=0;i<n;i++)passed.count(k);for(const k of["ownedSdkRequests","nextProbeRequests","sqlInspections","browserRequests"])passed.count(k);assert.equal(passed.finish(0,0).status,"passed");const limited=createDriveState();for(let i=0;i<DRIVE_LIMITS.downloads;i++)limited.count("downloads");assert.throws(()=>limited.count("downloads"),{message:"REQUEST_REFUSED"});});
test("browser gate accepts only fixed Next routes and owned Storage capabilities",()=>{const id=randomUUID(),upload=randomUUID(),put=DRIVE_API+"/storage/v1/object/upload/sign/second-brain-staging/"+id+"/"+upload+"?token="+"t".repeat(32),get=DRIVE_API+"/storage/v1/object/sign/second-brain-files/"+id+"/"+upload+"?token="+"t".repeat(32);assert.equal(acceptDriveBrowserRequest(put,"PUT",id),true);assert.equal(acceptDriveBrowserRequest(get+"&download=documento.pdf","GET",id),true);assert.equal(acceptDriveBrowserRequest(DRIVE_APP+"/drive?folder="+upload+"&file="+randomUUID(),"GET",id),true);assert.equal(acceptDriveBrowserRequest(DRIVE_APP+"/api/knowledge?related_type=file&related_id="+upload,"GET",id),true);for(const[url,method]of[[put,"POST"],[put.replace(id,randomUUID()),"PUT"],[put+"&extra=1","PUT"],[put.replace("127.0.0.1","localhost"),"PUT"],[get.replace("second-brain-files","foreign-bucket"),"GET"],[DRIVE_APP+"/api/admin","POST"],[DRIVE_APP+"/drive?folder="+upload+"&folder="+upload,"GET"],[DRIVE_APP+"/_next/static/%2e%2e/private","GET"],[DRIVE_API+"/auth/v1/user","GET"]])assert.equal(acceptDriveBrowserRequest(url,method,id),false);});
test("fixed read-only SQL refuses provenance, foreign owners, unsafe paths and getters",()=>{const sql=driveInspectionSql(ctx);assert.match(sql,/begin read only/);assert.match(sql,/rollback;/);assert.doesNotMatch(sql,/encrypted_password|access_token|jsonb_agg\(token\)|select \*/);const base=proof();assert.equal(acceptDriveSql(base,ctx,null).usageBytes,0);for(const change of[v=>v.provenance.markerRows=0,v=>v.provenance.systemIdentifier="foreign",v=>v.otherRows=1,v=>v.sessions.push({id:randomUUID(),user_id:randomUUID()}),v=>v.profiles.push(randomUUID())]){const p=proof();change(p);assert.throws(()=>acceptDriveSql(p,ctx,null));}let getter=0;assert.throws(()=>acceptDriveSql({...base,get files(){getter++;return[];}},ctx,null));assert.equal(getter,0);assert.throws(()=>driveInspectionSql({...ctx,namespace:"';"}));});
test("fixed inspector executes against18 canonical migrations/PGlite with explicit synthetic provenance, ordinary Auth row and final cascade",async()=>{
 const db=await createLocalCanonicalSql(),owner={id:randomUUID(),email:"drive-pure-"+randomUUID()+"@example.invalid",password:"unused"};try{
  await db.exec("create table app_private.sc_admin_ci_marker(namespace text,source_sha text,system_identifier text,project_id text)");await db.query("insert into app_private.sc_admin_ci_marker values($1,$2,$3,$4)",[ctx.namespace,ctx.sourceSha,ctx.systemIdentifier,ctx.projectId]);
  const inspect=async()=>{const input=driveInspectionSql(ctx),vars=Object.fromEntries([...input.matchAll(/^\\set ([a-z_]+) ([a-z0-9-]+)$/gm)].map(m=>[m[1],m[2]]));
   // Actual PGlite is PG18; system identifier/version are explicit RAM seams.
   const sql=input.replace(/^\\set .*\n/gm,"").replace(/:'([a-z_]+)'/g,(_,key)=>"'"+vars[key]+"'").replace("(select system_identifier::text from pg_control_system())","'"+ctx.systemIdentifier+"'").replace("current_setting('server_version_num')::integer","170011");
   const result=await db.exec(sql),value=result.flatMap(r=>r.rows).find(r=>Object.hasOwn(r,"jsonb_build_object"))?.jsonb_build_object;return acceptDriveSql(JSON.parse(JSON.stringify(value)),ctx,owner);};
  assert.equal((await inspect()).users.length,0);
  await db.transaction(async tx=>{await tx.query("insert into auth.users(id,aud,role,email,raw_app_meta_data) values($1,'authenticated','authenticated',$2,$3::jsonb)",[owner.id,owner.email,JSON.stringify({provider:"email",providers:["email"]})]);await tx.query("update auth.users set raw_app_meta_data=raw_app_meta_data||$2::jsonb where id=$1",[owner.id,JSON.stringify({sc_drive_fixture:ctx.namespace})]);});
  const active=await inspect();assert.equal(active.users.length,1);assert.equal(active.roles.length,1);assert.equal(active.roles[0].role,"user");assert.equal(active.profiles.length,1);assert.equal(active.preferences.length,1);assert.equal(active.usageBytes,0);
  await db.query("delete from auth.users where id=$1",[owner.id]);const final=await inspect();assert.equal(final.users.length+final.roles.length+final.profiles.length+final.preferences.length,0);
 }finally{await db.close();}
});
test("IO counts actual body settlement, prohibits external redirects/credentials and preserves pending after timeout",async()=>{let finish;const response=new Promise(r=>finish=r),state=createDriveState(),io=createDriveIo(state,()=>response,{requestMs:5}),spec={mode:"cap",url:DRIVE_API+"/owned",method:"PUT",write:true};await assert.rejects(io.request(spec,()=>io.transport(spec.url,{method:"PUT"})),{message:"DEADLINE_EXCEEDED"});assert.equal(io.metadata().pending,1);assert.equal(state.value.writeOutcomeUncertain,true);finish(new Response("{}"));await io.settle();assert.equal(io.metadata().pending,0);assert.equal(state.value.code,"DEADLINE_EXCEEDED");io.close();for(const headers of[{Cookie:"private"},{Authorization:"Bearer private"},{apikey:"private"}]){const own=createDriveIo(createDriveState(),async()=>new Response("{}"));await assert.rejects(own.request(spec,()=>own.transport(spec.url,{method:"PUT",headers})));own.close();}const foreign=createDriveIo(createDriveState(),async()=>new Response("{}"));await assert.rejects(foreign.request({...spec,url:"https://foreign.invalid/owned"},async()=>null));foreign.close();});
test("response streams are bounded before SDK ACK and a post-mutation wrong HTTP status latches unknown",async()=>{for(const http of[201,204]){const state=createDriveState(),io=createDriveIo(state,async()=>http===204?new Response(null,{status:http}):Response.json([],{status:http})),spec={mode:"sdk",url:DRIVE_API+"/storage/v1/object/second-brain-files",method:"DELETE",write:true,key:ctx.secretKey,token:ctx.secretKey,checkResponse:status=>{if(status!==200)throw Error("RESPONSE_REFUSED");}};await assert.rejects(io.request(spec,()=>io.transport(spec.url,{method:"DELETE",headers:{apikey:ctx.secretKey,authorization:"Bearer "+ctx.secretKey}})));assert.equal(state.value.writeOutcomeUncertain,true);assert.equal(io.metadata().pending,0);await assert.rejects(io.request(spec,async()=>null));io.close();}const state=createDriveState(),io=createDriveIo(state,async()=>new Response(Buffer.alloc(DRIVE_LIMITS.responseBytes+1))),spec={mode:"cap",url:DRIVE_API+"/owned",method:"GET",write:false};await assert.rejects(io.request(spec,()=>io.transport(spec.url)));assert.equal(io.metadata().pending,0);io.close();});
async function fixture({storageStatus=200,storageMalformed=false,authDeleteStatus=200,foreignAck=false,cleanupAllowed=true}={}){
 let p=proof(),user=null,deleted=false;const calls=[];
 const transport=async(url,init)=>{const u=new URL(url),path=u.pathname;calls.push({method:init.method,path});
  if(path==="/auth/v1/admin/users"&&init.method==="POST"){const body=JSON.parse(init.body);user={...body,role:"authenticated",is_anonymous:false};p.users=[{id:user.id,email:user.email,metadata:user.app_metadata,anonymous:false,deleted:null}];p.roles=[{user_id:user.id,role:"user"}];p.moderation=[{user_id:user.id,status:"active",must_change_password:false}];p.profiles=p.preferences=[user.id];return Response.json(user);}
  if(path==="/auth/v1/user")return Response.json(user);
  if(path==="/rest/v1/rpc/my_access_state")return Response.json({user_id:user.id,role:"user",must_change_password:false,entitlements:{}});
  if(path==="/storage/v1/object/second-brain-staging"||path==="/storage/v1/object/second-brain-files"){const bucket=path.split("/").at(-1),body=JSON.parse(init.body),rows=p.objects.filter(o=>o.bucket_id===bucket);assert.deepEqual(body.prefixes,rows.map(o=>o.name));p.objects=p.objects.filter(o=>o.bucket_id!==bucket);return storageStatus===204?new Response(null,{status:204}):Response.json(storageMalformed?[{id:randomUUID(),name:"foreign"}]:rows.map(({id,name})=>({id,name})),{status:storageStatus});}
  if(path.startsWith("/storage/v1/object/"))return Response.json({statusCode:"404",code:"NoSuchKey",error:"not_found",message:"Owned missing"},{status:400});
  if(path==="/auth/v1/logout"){assert.equal(u.search,"?scope=global");p.sessions=[];p.refreshUsers=[];return new Response(null,{status:204});}
  if(path.startsWith("/auth/v1/admin/users/")&&init.method==="DELETE"){assert.equal(p.objects.length,0);assert.equal(p.sessions.length,0);deleted=true;p=proof();return authDeleteStatus===204?new Response(null,{status:204}):Response.json(foreignAck?{id:randomUUID(),email:"foreign@example.invalid",role:"authenticated",is_anonymous:false,app_metadata:{sc_drive_fixture:"foreign"}}:{},{status:authDeleteStatus});}
  if(path.startsWith("/auth/v1/admin/users/")&&init.method==="GET")return deleted?Response.json({code:"user_not_found",msg:"Owned missing"},{status:404,headers:{"x-supabase-api-version":"2024-01-01"}}):Response.json(user);throw Error("UNEXPECTED_FIXED_TEST_REQUEST");};
 const h=await createDriveHarness(ctx,{query:async()=>structuredClone(p),cleanupAllowed:()=>cleanupAllowed,transport});const owner=await h.fixture();
 for(let i=0;i<2;i++){const sid=randomUUID(),exp=Math.floor(Date.now()/1000)+3600,token=[Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),Buffer.from(JSON.stringify({sub:owner.id,session_id:sid,role:"authenticated",exp})).toString("base64url"),Buffer.from("synthetic").toString("base64url")].join(".");p.sessions.push({id:sid,user_id:owner.id});p.refreshUsers.push(owner.id);await h.verifySession({sessionId:sid,accessToken:token,expiresAt:exp*1000});}
 const folders=Array.from({length:3},(_,i)=>({id:randomUUID(),user_id:owner.id,name:"folder"+i,parent_id:null,deleted_at:null,deletion_batch_id:null}));p.folders=folders;
 p.uploads=Array.from({length:4},(_,i)=>{const id=randomUUID(),path=owner.id+"/"+id;return{id,user_id:owner.id,name:"file"+i,folder_id:null,status:i<2?"finalized":"reserved",staging_path:path,final_path:path,max_bytes:DRIVE_MAX_BYTES,quota_bytes:DRIVE_QUOTA_BYTES,file_id:i<2?id:null,lease_id:null,lease_until:null};});
 p.files=p.uploads.slice(0,2).map(u=>({id:u.id,user_id:owner.id,name:u.name,folder_id:null,mime:"text/plain",bytes:10,sha256:"a".repeat(64),storage_path:u.final_path,deleted_at:null,deletion_batch_id:null,purged_at:null,kind:"drive"}));p.usageBytes=20;
 p.objects=[...p.uploads.map(u=>({id:randomUUID(),bucket_id:"second-brain-staging",name:u.staging_path})),...p.files.map(f=>({id:randomUUID(),bucket_id:"second-brain-files",name:f.storage_path}))];
 for(const stage of DRIVE_STAGES.slice(0,10))h.state.stage(stage);return{h,calls};
}
test("installed original SDK proves exact Storage200 IDs -> SQLempty -> six NoSuchKey, then Auth204 -> revoked SQL ->200 ACK ->404 -> final SQL",async()=>{const{h,calls}=await fixture();try{await h.cleanup();assert.equal(h.state.value.counts.storageDeletes,2);assert.equal(h.state.value.counts.storageAbsenceReads,6);assert.equal(h.state.value.counts.authRevocations,1);assert.equal(h.state.value.counts.authDeletes,1);assert.equal(h.state.value.counts.authAbsenceReads,1);assert.equal(h.state.value.stages.at(-1),"final-sql");assert.equal(h.state.value.writeOutcomeUncertain,false);assert.deepEqual(calls.slice(-3).map(c=>[c.method,c.path.startsWith("/auth/v1/admin/users/")?"/auth/v1/admin/users/OWNED":c.path]),[["POST","/auth/v1/logout"],["DELETE","/auth/v1/admin/users/OWNED"],["GET","/auth/v1/admin/users/OWNED"]]);}finally{await h.dispose();}});
for(const options of[{storageStatus:201},{storageStatus:204},{storageMalformed:true}])test("uncertain Storage DELETE blocks absence, second deletion and Auth cleanup: "+JSON.stringify(options),async()=>{const{h,calls}=await fixture(options);try{await assert.rejects(h.cleanup());assert.equal(h.state.value.writeOutcomeUncertain,true);assert.equal(h.state.value.counts.storageDeletes,0);assert.equal(h.state.value.counts.storageAbsenceReads,0);assert.equal(h.state.value.counts.authDeletes,0);assert.equal(calls.filter(c=>c.method==="DELETE").length,1);await assert.rejects(h.cleanup());}finally{await h.dispose();}});
for(const options of[{authDeleteStatus:204},{foreignAck:true}])test("uncertain Auth hard-delete ACK cannot advance GETabsence or finalSQL: "+JSON.stringify(options),async()=>{const{h}=await fixture(options);try{await assert.rejects(h.cleanup());assert.equal(h.state.value.writeOutcomeUncertain,true);assert.equal(h.state.value.counts.authDeletes,0);assert.equal(h.state.value.counts.authAbsenceReads,0);assert.equal(h.state.value.stages.includes("final-sql"),false);}finally{await h.dispose();}});
test("cleanup refuses an open browser/SQL lifecycle before any storage/Auth delete",async()=>{const{h,calls}=await fixture({cleanupAllowed:false});try{await assert.rejects(h.cleanup(),{message:"CLEANUP_NOT_PROVEN"});assert.equal(calls.some(c=>c.method==="DELETE"),false);}finally{await h.dispose();}});
test("fresh inactive report remains closed NOT_RUN, not promoted by infrastructure cleanup",()=>{assert.equal(validateDriveCase(blankDriveCase()).status,"not-run");});


test("Next development asset version is allowed without admitting arbitrary or encoded queries",()=>{
 const asset=DRIVE_APP+"/_next/static/css/app/layout.css";
 assert.equal(acceptDriveBrowserRequest(asset+"?v=1791705600000","GET",randomUUID()),true);
 for(const query of["?v=1791705600000&v=1791705600001","?v=1791705600000&extra=1","?v=1791705600000&dpl=foreign","?v=%311791705600000","?v=1","?v=-1791705600000","?capability=private"])
  assert.equal(acceptDriveBrowserRequest(asset+query,"GET",randomUUID()),false);
 assert.equal(acceptDriveBrowserRequest(asset+"?v=1791705600000","POST",randomUUID()),false);
});

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function authStageClock(){let fire;const durations=[],cleared=[],handle={};return{durations,cleared,fire:()=>fire(),timers:{setTimer(callback,milliseconds){fire=callback;durations.push(milliseconds);return handle;},clearTimer(value){assert.equal(value,handle);cleared.push(value);}}};}
test("Auth POST stages return only after actual settlement and use finite phase deadlines",async()=>{
 for(const[code,milliseconds]of[["AUTH_POST_RESPONSE_REFUSED",20000],["AUTH_POST_CLICK_REFUSED",20000],["AUTH_POST_FINISH_REFUSED",15000]]){
  const state=createDriveState(),owned=new Set(),clock=authStageClock(),value=Symbol("RAM_ONLY");
  assert.equal(await runDriveAuthPostStage(state,owned,code,async()=>value,()=>true,clock.timers),value);
  assert.equal(owned.size,0);assert.deepEqual(clock.durations,[milliseconds]);assert.equal(clock.cleared.length,1);
  assert.equal(state.value.status,"failed");assert.equal(state.value.writeOutcomeUncertain,false);
 }
});
for(const code of["AUTH_POST_RESPONSE_REFUSED","AUTH_POST_CLICK_REFUSED","AUTH_POST_FINISH_REFUSED"])test("Auth deadline retains its underlying operation, failure and uncertainty until real settlement: "+code,async()=>{
 const state=createDriveState(),owned=new Set(),clock=authStageClock(),late=deferred();
 const result=runDriveAuthPostStage(state,owned,code,()=>late.promise,()=>true,clock.timers),refused=assert.rejects(result,{message:code});
 await Promise.resolve();clock.fire();await refused;assert.equal(owned.size,1);assert.equal(clock.cleared.length,1);
 const pending=state.finish(owned.size,0);assert.equal(pending.status,"failed");assert.equal(pending.code,code);assert.equal(pending.pendingRequests,1);assert.equal(pending.writeOutcomeUncertain,true);
 assert.throws(()=>validateDriveCase({...pending,status:"passed",code:"PASSED"}));
 late.resolve(null);await Promise.allSettled([...owned]);assert.equal(owned.size,0);
 assert.equal(state.value.status,"failed");assert.equal(state.value.code,code);assert.equal(state.value.writeOutcomeUncertain,true);
});
test("pre-POST timeout stays known while a late private rejection remains tracked and uninspected",async()=>{
 const state=createDriveState(),owned=new Set(),clock=authStageClock(),late=deferred();let got=0;
 const privateFailure={get message(){got++;return"PRIVATE";},get stack(){got++;return"PRIVATE";}};
 const result=runDriveAuthPostStage(state,owned,"AUTH_POST_CLICK_REFUSED",()=>late.promise,()=>false,clock.timers),refused=assert.rejects(result,{message:"AUTH_POST_CLICK_REFUSED"});
 await Promise.resolve();clock.fire();await refused;assert.equal(owned.size,1);assert.equal(state.value.writeOutcomeUncertain,false);
 late.reject(privateFailure);await Promise.allSettled([...owned]);assert.equal(owned.size,0);assert.equal(got,0);assert.equal(state.value.code,"AUTH_POST_CLICK_REFUSED");
});
test("post-phase rejection closes private errors, requires factual POST and preserves first failure",async()=>{
 let got=0;const privateFailure={get message(){got++;return"PRIVATE";},get stack(){got++;return"PRIVATE";}};
 for(const[observed,uncertain]of[[()=>false,false],[()=>true,true],[()=>{throw privateFailure;},false]]){
  const state=createDriveState(),owned=new Set(),clock=authStageClock();
  await assert.rejects(runDriveAuthPostStage(state,owned,"AUTH_POST_FINISH_REFUSED",async()=>{throw privateFailure;},observed,clock.timers),{message:"AUTH_POST_FINISH_REFUSED"});
  assert.equal(owned.size,0);assert.equal(state.value.writeOutcomeUncertain,uncertain);
 }
 const state=createDriveState(),owned=new Set();state.fail("DRIVE_NOT_PROVEN");state.unknown();let called=false;
 await assert.rejects(runDriveAuthPostStage(state,owned,"AUTH_POST_RESPONSE_REFUSED",async()=>{called=true;},()=>false),{message:"AUTH_POST_RESPONSE_REFUSED"});
 assert.equal(called,false);assert.equal(owned.size,0);assert.equal(state.value.code,"DRIVE_NOT_PROVEN");assert.equal(state.value.writeOutcomeUncertain,true);assert.equal(got,0);
});
test("invalid phase/timer ports refuse without starting an operation or invoking getters",async()=>{
 let got=0,called=0;const operation=async()=>{called++;};
 for(const timers of[{get setTimer(){got++;return()=>{};}},{setTimer:null},{clearTimer:null},{extra:true},Object.create(null),{[Symbol("private")]:true}]){
  const state=createDriveState(),owned=new Set();await assert.rejects(runDriveAuthPostStage(state,owned,"AUTH_POST_RESPONSE_REFUSED",operation,()=>false,timers),{message:"AUTH_POST_RESPONSE_REFUSED"});assert.equal(owned.size,0);assert.equal(state.value.writeOutcomeUncertain,false);
 }
 await assert.rejects(runDriveAuthPostStage(createDriveState(),new Set(),"AUTH_POST_REQUEST_FAILED",operation),{message:"REPORT_REFUSED"});
 assert.equal(called,0);assert.equal(got,0);
});
test("finite POST diagnostics remain failed and cannot certify incomplete or uncertain cleanup",()=>{
 assert.equal(DRIVE_AUTH_POST_CODES.length,8);
 for(const code of DRIVE_AUTH_POST_CODES){const state=createDriveState();state.fail(code);const failed=state.finish(0,0);assert.equal(validateDriveCase(failed).code,code);assert.throws(()=>validateDriveCase({...failed,status:"passed",code:"PASSED"}));}
 const full=blankDriveCase();full.status="passed";full.code="PASSED";full.stages=[...DRIVE_STAGES];Object.assign(full.counts,DRIVE_PASS_COUNTS);for(const k of["ownedSdkRequests","browserRequests","sqlInspections","nextProbeRequests"])full.counts[k]=1;
 assert.equal(validateDriveCase(full).status,"passed");for(const patch of[{pendingRequests:1},{writeOutcomeUncertain:true},{stages:full.stages.slice(0,-1)}])assert.throws(()=>validateDriveCase({...full,...patch}));
});

test("CDP POST failure classification requires whole code equality and never inspects private objects",()=>{
 const entries=[["net::ERR_ABORTED","AUTH_POST_ABORTED"],["net::ERR_CONNECTION_RESET","AUTH_POST_CONNECTION_RESET"],["net::ERR_CONNECTION_REFUSED","AUTH_POST_CONNECTION_REFUSED"],["net::ERR_FAILED","AUTH_POST_NETWORK_FAILED"]];
 for(const[text,code]of entries){assert.equal(classifyDriveAuthRequestFailure(text),code);for(const value of[text+" PRIVATE",text+"\n",text.toLowerCase()," "+text])assert.equal(classifyDriveAuthRequestFailure(value),"AUTH_POST_REQUEST_FAILED");}
 let got=0;const privateError={get message(){got++;throw Error("PRIVATE");},get errorText(){got++;throw Error("PRIVATE");},toString(){got++;throw Error("PRIVATE");},[Symbol.toPrimitive](){got++;throw Error("PRIVATE");}};
 for(const value of[privateError,new String("net::ERR_ABORTED"),null,undefined,303,true])assert.equal(classifyDriveAuthRequestFailure(value),"AUTH_POST_REQUEST_FAILED");
 assert.equal(got,0);
});

test("a factual aborted POST retains uncertainty, first failure and refusal after terminal settlement",async()=>{
 for(const value of["net::ERR_ABORTED","net::ERR_CONNECTION_RESET","net::ERR_CONNECTION_REFUSED","net::ERR_FAILED",null]){
  const state=createDriveState();state.stage("fixture");state.unknown();state.fail(classifyDriveAuthRequestFailure(value));
  const code=state.value.code;state.fail("AUTH_POST_FINISH_REFUSED");const failed=state.finish(0,0);assert.equal(failed.code,code);assert.equal(failed.writeOutcomeUncertain,true);assert.equal(failed.pendingRequests,0);assert.equal(validateDriveCase(failed).status,"failed");assert.throws(()=>validateDriveCase({...failed,status:"passed",code:"PASSED"}));
  let called=false;await assert.rejects(runDriveAuthPostStage(state,new Set(),"AUTH_POST_FINISH_REFUSED",async()=>{called=true;return null;}),{message:"AUTH_POST_FINISH_REFUSED"});assert.equal(called,false);assert.equal(state.value.code,code);assert.equal(state.value.writeOutcomeUncertain,true);
 }
});
