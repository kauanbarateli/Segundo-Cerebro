// SDK installed, SQL/HTTP doubles in RAM. No Next, PG17 or browser is started.
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID}from"node:crypto";
import {EventEmitter}from"node:events";
import {createLocalCanonicalSql}from"../helpers/local-canonical-sql.ts";
import {DRIVE_APP,DRIVE_API,DRIVE_MAX_BYTES,DRIVE_QUOTA_BYTES,createDriveState,createDriveIo,runDriveAuthPostStage,classifyDriveAuthRequestFailure,recordDriveAuthRequestFailure,classifyDriveAuthResponseHeaders,observeDriveAuthMainDocument,createDriveAuthPageObservation,driveEmptyAuthDecision,isDriveAuthRedirectResponse,inspectDriveBrowserTextResponse,driveEnvironment,acceptDriveBrowserRequest,isDriveBrowserReadCancellationRequest,driveInspectionSql,acceptDriveSql,createDriveHarness}from"../e2e-auth-local/drive-browser-support.mjs";
import {DRIVE_STAGES,DRIVE_PASS_COUNTS,DRIVE_LIMITS,DRIVE_AUTH_POST_CODES,DRIVE_AUTH_FORM_CODES,DRIVE_TEXT_RESPONSE_CODES,DRIVE_QUIESCENCE_CODES,blankDriveCase,validateDriveCase,closedDriveValue}from"../e2e-auth-local/drive-browser-contract.mjs";
const ctx={namespace:"sc-admin-native-"+"a".repeat(32),sourceSha:"b".repeat(40),systemIdentifier:"1234567890123456789",projectId:"sc-auth-ci-"+"c".repeat(24),publishableKey:"sb_publishable_"+"d".repeat(32),secretKey:"sb_secret_"+"e".repeat(32),reportPath:"/tmp/runner/sc-drive-browser-owned/drive-browser-case-report.json"};
const env={CI:"true",GITHUB_ACTIONS:"true",SC_AUTH_LOCAL_CI_RUN:"1",SC_FILES_LOCAL_CI_RUN:"1",SC_DRIVE_BROWSER_RUN:"1",NODE_ENV:"development",APP_MODE:"supabase",APP_URL:DRIVE_APP,SUPABASE_URL:DRIVE_API,DRIVE_MAX_FILE_BYTES:String(DRIVE_MAX_BYTES),DRIVE_QUOTA_BYTES:String(DRIVE_QUOTA_BYTES),SC_DRIVE_BROWSER_NAMESPACE:ctx.namespace,GITHUB_SHA:ctx.sourceSha,SC_DRIVE_BROWSER_SYSTEM:ctx.systemIdentifier,SC_DRIVE_BROWSER_PROJECT:ctx.projectId,SUPABASE_PUBLISHABLE_KEY:ctx.publishableKey,SUPABASE_SECRET_KEY:ctx.secretKey,AUTH_STATE_SECRET:"f".repeat(40),AUTH_RATE_LIMIT_SECRET:"g".repeat(40),ADMIN_COMMAND_SECRET:"h".repeat(40),SC_DRIVE_BROWSER_REPORT:ctx.reportPath,RUNNER_TEMP:"/tmp/runner"};
const proof=()=>({provenance:{namespace:ctx.namespace,sourceSha:ctx.sourceSha,systemIdentifier:ctx.systemIdentifier,database:"postgres",currentUser:"postgres",serverVersion:170011,markerRows:1,allMarkers:1},users:[],sessions:[],refreshUsers:[],roles:[],moderation:[],profiles:[],preferences:[],folders:[],files:[],uploads:[],objects:[],usageBytes:0,events:[],receipts:[],otherRows:0});
const authFailureObservation=(patch={})=>({resourceType:"document",responseStatus:null,pageUrl:DRIVE_APP+"/entrar?returnTo=%2Fdrive",redirectedFrom:false,redirectedTo:false,closeAttempted:false,routeAbortAttempted:false,actionRedirect:"unavailable",contentType:"unavailable",documentAfterResponse:"unavailable",pageClosedAfterResponse:null,pageCrashedAfterResponse:null,mainFrameAfterResponse:"unavailable",...patch});

test("the first factual Auth failure projects only finite observed metadata and cannot certify a redirect or PASS",()=>{
 for(const[resourceType,resource]of[["document","document"],["fetch","fetch"],["xhr","xhr"],["websocket-private-canary","other"]])for(const[responseStatus,status]of[[null,"none"],[200,"200"],[303,"303"],[503,"other"]])for(const[pageUrl,location]of[[DRIVE_APP+"/entrar","login"],[DRIVE_APP+"/entrar?returnTo=%2Fdrive","login"],[DRIVE_APP+"/drive","drive"],["https://foreign.invalid/private-canary?token=secret","other"]]){
  const state=createDriveState();state.count("loginPosts");recordDriveAuthRequestFailure(state,"net::ERR_ABORTED",()=>authFailureObservation({resourceType,responseStatus,pageUrl,redirectedFrom:true,redirectedTo:true}));
  const result=state.finish(0,0);assert.deepEqual(result.authPostFailure,{resourceType:resource,observedResponseStatus:status,location,redirectedFrom:true,redirectedTo:true,closeAttempted:false,routeAbortAttempted:false,actionRedirect:"unavailable",contentType:"unavailable",documentAfterResponse:"unavailable",pageClosedAfterResponse:null,pageCrashedAfterResponse:null,mainFrameAfterResponse:"unavailable"});assert.equal(result.code,"AUTH_POST_ABORTED");assert.equal(result.writeOutcomeUncertain,true);assert.equal(result.status,"failed");assert.equal(JSON.stringify(result).includes("private-canary"),false);assert.throws(()=>validateDriveCase({...result,status:"passed",code:"PASSED"}));
 }
 for(const[key,value]of[["closeAttempted",true],["routeAbortAttempted",true]]){const state=createDriveState();state.count("loginPosts");recordDriveAuthRequestFailure(state,"net::ERR_FAILED",()=>authFailureObservation({[key]:value}));assert.equal(state.finish(0,0).authPostFailure[key],true);}
});

test("unavailable or nonclosed Auth observations stay null without invoking private getters or fabricating booleans",()=>{
 let reads=0;const getter=Object.defineProperty(authFailureObservation(),"pageUrl",{enumerable:true,get(){reads++;throw Error("PRIVATE");}}),privateFailure=Object.defineProperty({},"message",{get(){reads++;throw Error("PRIVATE");}});
 const malformed=[getter,{...authFailureObservation(),private:"PRIVATE"},{...authFailureObservation(),responseStatus:undefined},{...authFailureObservation(),responseStatus:99},{...authFailureObservation(),responseStatus:600},{...authFailureObservation(),responseStatus:"303"},{...authFailureObservation(),redirectedFrom:null},{...authFailureObservation(),closeAttempted:1},{...authFailureObservation(),resourceType:new String("fetch")},{...authFailureObservation(),pageUrl:"x".repeat(4097)},{...authFailureObservation(),actionRedirect:"/drive;push"},{...authFailureObservation(),contentType:"text/x-component"},{...authFailureObservation(),contentType:undefined},{...authFailureObservation(),documentAfterResponse:true},{...authFailureObservation(),documentAfterResponse:"/drive?token=PRIVATE"}];
 for(const value of malformed){const state=createDriveState();state.count("loginPosts");recordDriveAuthRequestFailure(state,privateFailure,()=>value);const result=state.finish(0,0);assert.equal(result.authPostFailure,null);assert.equal(result.code,"AUTH_POST_REQUEST_FAILED");assert.equal(result.writeOutcomeUncertain,true);}
 const state=createDriveState();state.count("loginPosts");recordDriveAuthRequestFailure(state,"net::ERR_ABORTED",()=>{throw privateFailure;});assert.equal(state.finish(0,0).authPostFailure,null);assert.equal(reads,0);
});

test("a late Auth requestfailed cannot replace an earlier deadline or response failure or observe its private metadata",()=>{
 for(const first of["DEADLINE_EXCEEDED","AUTH_POST_RESPONSE_REFUSED","AUTH_POST_FINISH_REFUSED","REQUEST_REFUSED","BROWSER_REFUSED"]){const state=createDriveState();state.count("loginPosts");state.fail(first);let observed=0;recordDriveAuthRequestFailure(state,"net::ERR_ABORTED",()=>{observed++;return authFailureObservation();});const result=state.finish(0,0);assert.equal(result.code,first);assert.equal(result.authPostFailure,null);assert.equal(result.writeOutcomeUncertain,true);assert.equal(observed,0);}
});

test("later factual Auth failures neither replace the first snapshot nor backfill an unavailable first snapshot",()=>{
 for(const unavailable of[false,true]){const state=createDriveState();state.count("loginPosts");let observed=0;recordDriveAuthRequestFailure(state,"net::ERR_ABORTED",()=>{observed++;if(unavailable)throw Error("PRIVATE");return authFailureObservation();});const first=structuredClone(state.value.authPostFailure);for(const failure of["net::ERR_ABORTED","net::ERR_FAILED"]){recordDriveAuthRequestFailure(state,failure,()=>{observed++;return authFailureObservation({responseStatus:303,pageUrl:DRIVE_APP+"/drive",closeAttempted:true,actionRedirect:"drive-push",contentType:"rsc"});});}const result=state.finish(0,0);assert.equal(observed,1);assert.deepEqual(result.authPostFailure,first);assert.equal(result.code,"AUTH_POST_ABORTED");assert.equal(result.writeOutcomeUncertain,true);}
});
test("response header diagnosis contains only finite primitive enums and never coerces or retains raw header values",()=>{
 const actionRows=[[undefined,"none"],["/drive;push","drive-push"],["/drive;replace","drive-replace"],["/drive;push;extra","other"],["/drive?token=PRIVATE_CANARY;push","other"],["https://foreign.invalid/drive;push","other"],[null,"unavailable"],["x".repeat(1025),"unavailable"]];
 const typeRows=[[undefined,"none"],["text/x-component","rsc"],["Text/X-Component; charset=utf-8","rsc"],["text/html;charset=utf-8","html"],["text/plain","plain"],["application/json","other"],["text/x-component-private-canary","other"],["text/html; private=PRIVATE_CANARY","html"],[null,"unavailable"],["text/plain;"+"x".repeat(1025),"unavailable"]];
 for(const[actionRedirect,action]of actionRows)for(const[contentType,type]of typeRows){const result=classifyDriveAuthResponseHeaders(actionRedirect,contentType);assert.deepEqual(result,{actionRedirect:action,contentType:type});assert.equal(Object.isFrozen(result),true);assert.equal(JSON.stringify(result).includes("PRIVATE_CANARY"),false);}
 let reads=0;const privateValue={toString(){reads++;throw Error("PRIVATE");},valueOf(){reads++;throw Error("PRIVATE");},get value(){reads++;throw Error("PRIVATE");}};
 for(const value of[privateValue,new String("/drive;push"),true,303,Symbol("PRIVATE")])assert.deepEqual(classifyDriveAuthResponseHeaders(value,value),{actionRedirect:"unavailable",contentType:"unavailable"});assert.equal(reads,0);
});

test("observed Flight redirect headers do not turn an aborted POST into session proof or permit late diagnostic backfill",()=>{
 for(const action of["/drive;push","/drive;replace"]){
  const state=createDriveState();state.count("loginPosts");const metadata=classifyDriveAuthResponseHeaders(action,"text/x-component; charset=utf-8");
  recordDriveAuthRequestFailure(state,"net::ERR_ABORTED",()=>authFailureObservation({resourceType:"fetch",responseStatus:303,...metadata}));
  const first=structuredClone(state.value.authPostFailure);let lateReads=0;
  recordDriveAuthRequestFailure(state,"net::ERR_FAILED",()=>{lateReads++;return authFailureObservation({responseStatus:200,actionRedirect:"none",contentType:"html"});});
  const result=state.finish(0,0);assert.deepEqual(result.authPostFailure,first);assert.equal(result.authPostFailure.contentType,"rsc");assert.equal(result.code,"AUTH_POST_ABORTED");assert.equal(result.writeOutcomeUncertain,true);assert.equal(result.status,"failed");assert.equal(lateReads,0);assert.equal(result.stages.length,0);assert.throws(()=>validateDriveCase({...result,status:"passed",code:"PASSED"}));
 }
 const state=createDriveState();state.count("loginPosts");recordDriveAuthRequestFailure(state,"net::ERR_ABORTED",()=>authFailureObservation());
 const first=structuredClone(state.value.authPostFailure);recordDriveAuthRequestFailure(state,"net::ERR_ABORTED",()=>authFailureObservation({responseStatus:303,...classifyDriveAuthResponseHeaders("/drive;push","text/x-component")}));
 assert.deepEqual(state.finish(0,0).authPostFailure,first);assert.equal(first.actionRedirect,"unavailable");assert.equal(first.contentType,"unavailable");
});

test("sterile local dual opt-in rejects Windows, hosted origins, mixed secrets and unbounded report paths",()=>{assert.deepEqual(driveEnvironment(env,"linux"),ctx);for(const patch of[{SC_FILES_LOCAL_CI_RUN:"0"},{SC_AUTH_LOCAL_CI_RUN:"0"},{SC_DRIVE_BROWSER_RUN:"0"},{SUPABASE_URL:"https://foreign.supabase.co"},{APP_URL:"http://localhost:3117"},{DRIVE_MAX_FILE_BYTES:"4097"},{DRIVE_QUOTA_BYTES:"1"},{AUTH_RATE_LIMIT_SECRET:env.AUTH_STATE_SECRET},{NEXT_PUBLIC_KEY:"synthetic"},{GITHUB_TOKEN:"synthetic"},{SC_DRIVE_BROWSER_REPORT:"/tmp/outside.json"}])assert.throws(()=>driveEnvironment({...env,...patch},"linux"),{message:"ENVIRONMENT_REFUSED"});assert.throws(()=>driveEnvironment(env,"win32"));});
test("closed report refuses getters, unknown stages, unsupported claims and premature PASS",()=>{let got=0;assert.throws(()=>closedDriveValue({get private(){got++;return"CANARY";}}));assert.equal(got,0);for(const v of[[,,],new Date(),Object.create(null),{[Symbol("private")]:true}])assert.throws(()=>closedDriveValue(v));const state=createDriveState();state.stage("fixture");assert.throws(()=>state.stage("server-rejections"));state.unknown();state.fail("DRIVE_NOT_PROVEN");const result=state.finish(0,0);assert.equal(result.status,"failed");assert.equal(result.writeOutcomeUncertain,true);assert.throws(()=>validateDriveCase({...result,status:"passed",code:"PASSED"}));assert.throws(()=>validateDriveCase({...result,password:"PRIVATE_CANARY"}));});
test("finite stage order and counts preserve first failure across deadline and teardown",()=>{let now=0;const state=createDriveState({now:()=>now,caseMs:10});state.fail("DRIVE_NOT_PROVEN");now=20;assert.equal(state.finish(0,0).code,"DRIVE_NOT_PROVEN");const passed=createDriveState();for(const stage of DRIVE_STAGES)passed.stage(stage);for(const[k,n]of Object.entries(DRIVE_PASS_COUNTS))for(let i=0;i<n;i++)passed.count(k);for(const k of["ownedSdkRequests","nextProbeRequests","sqlInspections","browserRequests"])passed.count(k);assert.equal(passed.finish(0,0).status,"passed");const limited=createDriveState();for(let i=0;i<DRIVE_LIMITS.downloads;i++)limited.count("downloads");assert.throws(()=>limited.count("downloads"),{message:"REQUEST_REFUSED"});});
test("browser gate accepts only fixed Next routes and owned Storage capabilities",()=>{const id=randomUUID(),upload=randomUUID(),put=DRIVE_API+"/storage/v1/object/upload/sign/second-brain-staging/"+id+"/"+upload+"?token="+"t".repeat(32),get=DRIVE_API+"/storage/v1/object/sign/second-brain-files/"+id+"/"+upload+"?token="+"t".repeat(32);assert.equal(acceptDriveBrowserRequest(put,"PUT",id),true);assert.equal(acceptDriveBrowserRequest(get+"&download=documento.pdf","GET",id),true);assert.equal(acceptDriveBrowserRequest(DRIVE_APP+"/drive?folder="+upload+"&file="+randomUUID(),"GET",id),true);assert.equal(acceptDriveBrowserRequest(DRIVE_APP+"/api/knowledge?related_type=file&related_id="+upload,"GET",id),true);for(const[url,method]of[[put,"POST"],[put.replace(id,randomUUID()),"PUT"],[put+"&extra=1","PUT"],[put.replace("127.0.0.1","localhost"),"PUT"],[get.replace("second-brain-files","foreign-bucket"),"GET"],[DRIVE_APP+"/api/admin","POST"],[DRIVE_APP+"/drive?folder="+upload+"&folder="+upload,"GET"],[DRIVE_APP+"/_next/static/%2e%2e/private","GET"],[DRIVE_API+"/auth/v1/user","GET"]])assert.equal(acceptDriveBrowserRequest(url,method,id),false);});
test("page release accepts exact Drive GET reads, folders and owned download capabilities without allowing mutations or Auth",()=>{
 const owner=randomUUID(),file=randomUUID(),download=DRIVE_API+"/storage/v1/object/sign/second-brain-files/"+owner+"/"+file+"?token="+"t".repeat(32);
 for(const url of[DRIVE_APP+"/drive",DRIVE_APP+"/drive?folder="+file+"&file="+randomUUID()+"&_rsc=owned",DRIVE_APP+"/drive?view=trash",DRIVE_APP+"/_next/webpack-hmr",DRIVE_APP+"/api/files",DRIVE_APP+"/api/files/read?id="+file+"&user="+owner+"&download=1",download,download+"&download=documento.pdf"])assert.equal(isDriveBrowserReadCancellationRequest(url,"GET",owner),true);
 for(const[url,method,id]of[[DRIVE_APP+"/api/files","POST",owner],[download,"PUT",owner],[download,"GET",randomUUID()],[download+"&extra=1","GET",owner],[DRIVE_APP+"/drive?folder="+file+"&folder="+file,"GET",owner],[DRIVE_APP+"/drive?foreign=1","GET",owner],[DRIVE_APP+"/drive#","GET",owner],[DRIVE_APP+"/drive?","GET",owner],[DRIVE_APP+"/sair","GET",owner],[DRIVE_APP+"/auth/callback?code=synthetic","GET",owner],[DRIVE_API+"/auth/v1/verify?token=synthetic","GET",owner],[DRIVE_APP+"/entrar?returnTo=%2Fdrive","POST",owner],[DRIVE_APP+"/api/calendar/oauth/start","POST",owner],["about:blank","GET",owner],["http://localhost:3117/drive","GET",owner]])assert.equal(isDriveBrowserReadCancellationRequest(url,method,id),false);
 let reads=0;const privateValue={[Symbol.toPrimitive](){reads++;throw Error("PRIVATE");},get href(){reads++;throw Error("PRIVATE");}};
 assert.equal(isDriveBrowserReadCancellationRequest(privateValue,"GET",owner),false);assert.equal(isDriveBrowserReadCancellationRequest(download,"GET",privateValue),false);assert.equal(isDriveBrowserReadCancellationRequest(download,privateValue,owner),false);assert.equal(reads,0);
});
test("quiescence refusal is sticky even when later page/context ACKs leave all counters zero",()=>{
 assert.equal(DRIVE_QUIESCENCE_CODES.length,4);
 for(const code of DRIVE_QUIESCENCE_CODES){const state=createDriveState();state.stage("fixture");state.fail(code);state.fail("PROCESS_UNCONFIRMED");const failed=state.finish(0,0);assert.equal(failed.code,code);assert.equal(failed.pendingRequests,0);assert.equal(validateDriveCase(failed).status,"failed");assert.throws(()=>validateDriveCase({...failed,status:"passed",code:"PASSED"}));}
});
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

test("empty Auth control decisions require closed factual states without coercion or credential inspection",()=>{
 for(const[state,revealed,result]of[["hidden",false,"done"],["hidden",true,"show"],["shown",false,"hide"],["shown",true,"done"],["unready",false,"wait"],["unready",true,"wait"]])assert.equal(driveEmptyAuthDecision(state,revealed),result);
 let reads=0;const privateState={get value(){reads++;throw Error("PRIVATE");},toString(){reads++;throw Error("PRIVATE");},[Symbol.toPrimitive](){reads++;throw Error("PRIVATE");}};
 for(const state of[privateState,null,undefined,"hidden ","password",true,new String("hidden")])assert.throws(()=>driveEmptyAuthDecision(state,true),{message:"REPORT_REFUSED"});
 for(const target of[privateState,null,undefined,0,"true",new Boolean(true)])assert.throws(()=>driveEmptyAuthDecision("hidden",target),{message:"REPORT_REFUSED"});
 assert.equal(reads,0);
});

test("a lost empty reveal click cannot certify hydration and an observed transition prevents an extra toggle",()=>{
 // State/action oracle only in RAM; no native browser or hydration claim.
 let observed="hidden",showClicks=0;const actions=[],observations=[];
 const step=target=>{observations.push(observed);const action=driveEmptyAuthDecision(observed,target);actions.push(action);if(action==="show"&&++showClicks===2)observed="shown";if(action==="hide")observed="hidden";observations.push(observed);return driveEmptyAuthDecision(observed,target)==="done";};
 assert.equal(step(true),false);assert.equal(observed,"hidden");
 assert.equal(step(true),true);assert.equal(observed,"shown");
 assert.equal(step(true),true);assert.equal(showClicks,2);
 assert.equal(step(false),true);assert.equal(observed,"hidden");
 assert.deepEqual(actions,["show","show","done","hide"]);assert.deepEqual(observations,["hidden","hidden","hidden","shown","shown","shown","shown","hidden"]);
 observed="unready";assert.equal(step(true),false);assert.equal(showClicks,2);assert.equal(actions.at(-1),"wait");
});

test("finite empty form subphases preserve the first failure without inventing an uncertain POST or PASS",()=>{
 assert.equal(DRIVE_AUTH_FORM_CODES.length,4);assert.equal(new Set(DRIVE_AUTH_FORM_CODES).size,4);
 for(const code of DRIVE_AUTH_FORM_CODES){const state=createDriveState();state.stage("fixture");state.fail(code);state.fail("AUTH_FORM_REFUSED");const result=state.finish(0,0);assert.equal(validateDriveCase(result).code,code);assert.equal(result.counts.loginPosts,0);assert.equal(result.writeOutcomeUncertain,false);assert.throws(()=>validateDriveCase({...result,status:"passed",code:"PASSED"}));state.unknown();assert.equal(state.finish(0,0).writeOutcomeUncertain,true);assert.equal(state.value.code,code);}
});

test("a factual aborted POST retains uncertainty, first failure and refusal after terminal settlement",async()=>{
 for(const value of["net::ERR_ABORTED","net::ERR_CONNECTION_RESET","net::ERR_CONNECTION_REFUSED","net::ERR_FAILED",null]){
  const state=createDriveState();state.stage("fixture");state.unknown();state.fail(classifyDriveAuthRequestFailure(value));
  const code=state.value.code;state.fail("AUTH_POST_FINISH_REFUSED");const failed=state.finish(0,0);assert.equal(failed.code,code);assert.equal(failed.writeOutcomeUncertain,true);assert.equal(failed.pendingRequests,0);assert.equal(validateDriveCase(failed).status,"failed");assert.throws(()=>validateDriveCase({...failed,status:"passed",code:"PASSED"}));
  let called=false;await assert.rejects(runDriveAuthPostStage(state,new Set(),"AUTH_POST_FINISH_REFUSED",async()=>{called=true;return null;}),{message:"AUTH_POST_FINISH_REFUSED"});assert.equal(called,false);assert.equal(state.value.code,code);assert.equal(state.value.writeOutcomeUncertain,true);
 }
});

const authResponseUrl=DRIVE_APP+"/entrar?returnTo=%2Fdrive";
test("body-ineligible redirects require the exact Auth303 and one literal reviewed destination header",()=>{
 for(const[location,action]of[[undefined,"/drive;push"],[undefined,"/drive;replace"],["/drive",undefined]])assert.equal(isDriveAuthRedirectResponse(authResponseUrl,"POST",303,location,action),true);
 for(const[url,method,status,location,action]of[[authResponseUrl,"GET",303,undefined,"/drive;push"],[authResponseUrl,"POST",200,undefined,"/drive;push"],[authResponseUrl,"POST",302,"/drive",undefined],[authResponseUrl,"POST",307,"/drive",undefined],[DRIVE_APP+"/api/files","POST",303,"/drive",undefined],[authResponseUrl+"&extra=1","POST",303,"/drive",undefined],[authResponseUrl,"POST",303,undefined,undefined],[authResponseUrl,"POST",303,"/drive","/drive;push"],[authResponseUrl,"POST",303,DRIVE_APP+"/drive",undefined],[authResponseUrl,"POST",303,"/drive?private=1",undefined],[authResponseUrl,"POST",303,undefined,"/drive;push;private"],[authResponseUrl,"POST",303,undefined,"/drive#;push"]])assert.equal(isDriveAuthRedirectResponse(url,method,status,location,action),false);
 let reads=0;const value={get private(){reads++;},toString(){reads++;return"/drive";},[Symbol.toPrimitive](){reads++;return"/drive";}};
 for(const values of[[value,"POST",303,undefined,"/drive;push"],[authResponseUrl,value,303,"/drive",undefined],[authResponseUrl,"POST",value,"/drive",undefined],[authResponseUrl,"POST",303,value,undefined],[authResponseUrl,"POST",303,undefined,value]])assert.equal(isDriveAuthRedirectResponse(...values),false);assert.equal(reads,0);
});
function textResponse(patch={}){return{url:authResponseUrl,method:"POST",status:303,headers:async()=>({"content-type":"text/x-component","x-action-redirect":"/drive;push"}),finished:async()=>null,body:async()=>{throw Error("UNAVAILABLE_FOR_REDIRECT");},...patch};}
test("the actual scanner requires redirect headers and finished ACK without calling the unavailable303 body",async()=>{
 for(const headers of[{"x-action-redirect":"/drive;push"},{"x-action-redirect":"/drive;replace"},{location:"/drive"}]){const calls=[],state=createDriveState(),owned=new Set(),clock=authStageClock();await inspectDriveBrowserTextResponse(state,owned,textResponse({headers:async()=>{calls.push("headers");return headers;},finished:async()=>{calls.push("finished");return null;},body:async()=>{calls.push("body");throw Error("UNAVAILABLE_FOR_REDIRECT");}}),()=>false,clock.timers);assert.deepEqual(calls,["headers","finished"]);assert.equal(owned.size,0);assert.deepEqual(clock.durations,[15000]);assert.equal(state.value.writeOutcomeUncertain,false);}
 for(const headers of[{},{location:"/foreign"},{location:"/drive","x-action-redirect":"/drive;push"},{"x-action-redirect":"/drive;push;extra"}]){const state=createDriveState();let calls=0;await assert.rejects(inspectDriveBrowserTextResponse(state,new Set(),textResponse({headers:async()=>headers,finished:async()=>{calls++;return null;},body:async()=>{calls++;return Buffer.from("unused");}}),()=>false),{message:"AUTH_REDIRECT_HEADER_REFUSED"});assert.equal(state.value.code,"AUTH_REDIRECT_HEADER_REFUSED");assert.equal(calls,0);}
 for(const finished of[async()=>undefined,async()=>Error("PRIVATE"),async()=>{throw{get message(){throw Error("PRIVATE");}};}]){const state=createDriveState();let body=0;await assert.rejects(inspectDriveBrowserTextResponse(state,new Set(),textResponse({finished,body:async()=>{body++;return Buffer.from("unused");}}),()=>false),{message:"AUTH_POST_FINISH_REFUSED"});assert.equal(body,0);assert.equal(state.value.code,"AUTH_POST_FINISH_REFUSED");}
});
test("200 text still reads and wipes bytes while other redirect methods/statuses never inherit the Auth exception",async()=>{
 const bytes=Buffer.from("PUBLIC_TEXT"),calls=[],state=createDriveState();await inspectDriveBrowserTextResponse(state,new Set(),textResponse({status:200,body:async()=>{calls.push("body");return bytes;},finished:async()=>{calls.push("finished");return null;}}),()=>false);assert.deepEqual(calls,["body"]);assert.ok(bytes.every(b=>b===0));
 let reads=0;const privateError={get message(){reads++;throw Error("PRIVATE");},get stack(){reads++;throw Error("PRIVATE");}};
 for(const patch of[{status:302},{status:307},{method:"GET"},{url:DRIVE_APP+"/api/files"}]){let body=0;const failed=createDriveState(),owned=new Set();await assert.rejects(inspectDriveBrowserTextResponse(failed,owned,textResponse({...patch,body:async()=>{body++;throw privateError;}}),()=>false),{message:"TEXT_BODY_READ_REFUSED"});assert.equal(body,1);assert.equal(owned.size,0);assert.equal(failed.value.code,"TEXT_BODY_READ_REFUSED");}
 assert.equal(reads,0);
});
test("headers and200 body canaries refuse before success and bytes are wiped on privacy or size failure",async()=>{
 let body=0,finished=0;const state=createDriveState();await assert.rejects(inspectDriveBrowserTextResponse(state,new Set(),textResponse({headers:async()=>({"x-action-redirect":"/drive;push",private:"PRIVATE_CANARY"}),body:async()=>{body++;return Buffer.from("unused");},finished:async()=>{finished++;return null;}}),text=>text.includes("PRIVATE_CANARY")),{message:"RESPONSE_REFUSED"});assert.equal(body+finished,0);
 for(const bytes of[Buffer.from("PRIVATE_CANARY"),Buffer.alloc(16777217,65)]){const failed=createDriveState();await assert.rejects(inspectDriveBrowserTextResponse(failed,new Set(),textResponse({status:200,body:async()=>bytes}),text=>text.includes("PRIVATE_CANARY")),{message:"RESPONSE_REFUSED"});assert.ok(bytes.every(b=>b===0));assert.equal(JSON.stringify(failed.value).includes("PRIVATE_CANARY"),false);}
});
test("text deadline keeps real pending body ownership until late bytes settle and preserves uncertainty/first failure",async()=>{
 const state=createDriveState(),owned=new Set(),clock=authStageClock(),entered=deferred(),late=deferred();state.unknown();
 const task=inspectDriveBrowserTextResponse(state,owned,textResponse({status:200,body:()=>{entered.resolve();return late.promise;}}),()=>false,clock.timers),rejected=assert.rejects(task,{message:"TEXT_BODY_DEADLINE_REFUSED"});await entered.promise;clock.fire();await rejected;assert.deepEqual(clock.durations,[15000]);assert.equal(owned.size,1);assert.equal(state.value.code,"TEXT_BODY_DEADLINE_REFUSED");assert.equal(state.value.writeOutcomeUncertain,true);
 const bytes=Buffer.from("PRIVATE_LATE_BYTES");late.resolve(bytes);await Promise.allSettled([...owned]);assert.equal(owned.size,0);assert.ok(bytes.every(b=>b===0));assert.equal(state.value.code,"TEXT_BODY_DEADLINE_REFUSED");assert.equal(state.value.writeOutcomeUncertain,true);
});
test("late headers cannot start body/finished after deadline and ports/getters remain closed",async()=>{
 const state=createDriveState(),owned=new Set(),clock=authStageClock(),entered=deferred(),late=deferred();let calls=0;
 const task=inspectDriveBrowserTextResponse(state,owned,textResponse({headers:()=>{entered.resolve();return late.promise;},finished:async()=>{calls++;return null;},body:async()=>{calls++;return Buffer.from("unused");}}),()=>false,clock.timers),rejected=assert.rejects(task,{message:"TEXT_BODY_DEADLINE_REFUSED"});await entered.promise;clock.fire();await rejected;assert.equal(owned.size,1);late.resolve({"x-action-redirect":"/drive;push"});await Promise.allSettled([...owned]);assert.equal(calls,0);assert.equal(owned.size,0);assert.equal(state.value.code,"TEXT_BODY_DEADLINE_REFUSED");
 let reads=0;for(const response of[null,{...textResponse(),get headers(){reads++;return()=>{};}},{...textResponse(),extra:true},Object.create(null)])await assert.rejects(inspectDriveBrowserTextResponse(createDriveState(),new Set(),response,()=>false),{message:"REPORT_REFUSED"});assert.equal(reads,0);
 const sticky=createDriveState();sticky.fail("DRIVE_NOT_PROVEN");sticky.unknown();await assert.rejects(inspectDriveBrowserTextResponse(sticky,new Set(),textResponse({headers:async()=>{calls++;return{};}}),()=>false),{message:"DRIVE_NOT_PROVEN"});assert.equal(calls,0);assert.equal(sticky.value.writeOutcomeUncertain,true);
 assert.equal(DRIVE_TEXT_RESPONSE_CODES.length,3);for(const code of DRIVE_TEXT_RESPONSE_CODES){const failed=createDriveState();failed.fail(code);const r=failed.finish(0,0);assert.equal(validateDriveCase(r).code,code);assert.throws(()=>validateDriveCase({...r,status:"passed",code:"PASSED"}));}
});

const mainDocumentObservation=(patch={})=>({url:DRIVE_APP+"/drive",method:"GET",resourceType:"document",isNavigationRequest:true,isMainFrame:true,authorized:true,...patch});
test("main-document diagnosis arms only after factual response and preserves the first eligible event",()=>{
 let reads=0;assert.equal(observeDriveAuthMainDocument("unavailable",()=>{reads++;return mainDocumentObservation();}),"unavailable");assert.equal(reads,0);
 for(const[url,expected]of[[DRIVE_APP+"/entrar?returnTo=%2Fdrive","login"],[DRIVE_APP+"/drive","drive"],[DRIVE_APP+"/design-system","other"]]){
  const observed=observeDriveAuthMainDocument("none",()=>mainDocumentObservation({url}));assert.equal(observed,expected);assert.equal(observeDriveAuthMainDocument(observed,()=>{throw Error("PRIVATE");}),expected);
 }
 for(const patch of[{method:"POST"},{resourceType:"fetch"},{isNavigationRequest:false},{isMainFrame:false}])assert.equal(observeDriveAuthMainDocument("none",()=>mainDocumentObservation(patch)),"none");
});
test("main-document diagnosis requires existing authorization and canonical local URL without exposing private query",()=>{
 for(const patch of[{authorized:false},{url:"https://foreign.invalid/drive?token=PRIVATE"},{url:DRIVE_APP+"/drive#PRIVATE"},{url:"http://name:PRIVATE@127.0.0.1:3117/drive"},{url:DRIVE_APP+"/drive",authorized:"true"},{url:new String(DRIVE_APP+"/drive")}])assert.equal(observeDriveAuthMainDocument("none",()=>mainDocumentObservation(patch)),"unavailable");
 let reads=0;const getter=Object.defineProperty(mainDocumentObservation(),"url",{enumerable:true,get(){reads++;throw Error("PRIVATE");}});assert.equal(observeDriveAuthMainDocument("none",()=>getter),"unavailable");assert.equal(reads,0);assert.equal(observeDriveAuthMainDocument("none",()=>{throw Error("PRIVATE");}),"unavailable");
 const observed=observeDriveAuthMainDocument("none",()=>mainDocumentObservation({url:DRIVE_APP+"/drive?file=PRIVATE_CANARY"}));assert.equal(observed,"drive");assert.equal(JSON.stringify(observed).includes("PRIVATE"),false);
});
test("document-after-response observation cannot promote aborted Auth or backfill the first snapshot",()=>{
 for(const documentAfterResponse of["none","login","drive","other","unavailable"]){const state=createDriveState();state.count("loginPosts");recordDriveAuthRequestFailure(state,"net::ERR_ABORTED",()=>authFailureObservation({documentAfterResponse}));const first=structuredClone(state.value.authPostFailure);recordDriveAuthRequestFailure(state,"net::ERR_FAILED",()=>authFailureObservation({documentAfterResponse:"drive"}));const result=state.finish(0,0);assert.deepEqual(result.authPostFailure,first);assert.equal(result.authPostFailure.documentAfterResponse,documentAfterResponse);assert.equal(result.status,"failed");assert.equal(result.writeOutcomeUncertain,true);assert.equal(result.code,"AUTH_POST_ABORTED");assert.throws(()=>validateDriveCase({...result,status:"passed",code:"PASSED"}));}
});

const pageObservationRam=()=>{const events=new EventEmitter(),installed=[];const observation=createDriveAuthPageObservation({close:listener=>{installed.push("close");events.on("close",listener);},crash:listener=>{installed.push("crash");events.on("crash",listener);},frameNavigated:listener=>{installed.push("frame");events.on("frame",listener);}});return{events,installed,observation};};
const unavailablePage={pageClosedAfterResponse:null,pageCrashedAfterResponse:null,mainFrameAfterResponse:"unavailable"};

test("Page diagnosis requires complete listeners and one linked factual POST response before absence can be observed",()=>{
 let reads=0;const a=pageObservationRam(),request={};assert.deepEqual(a.installed,["close","crash","frame"]);a.events.emit("frame",()=>{reads++;throw Error("PRIVATE");});assert.equal(reads,0);a.observation.request(request,true);assert.deepEqual(a.observation.snapshot(request),unavailablePage);
 const b=pageObservationRam(),post={};b.observation.request(post,true);b.observation.response(post,true);assert.deepEqual(b.observation.snapshot(post),{pageClosedAfterResponse:false,pageCrashedAfterResponse:false,mainFrameAfterResponse:"none"});
 for(const event of["close","crash"]){const p=pageObservationRam(),q={};p.events.emit(event);p.observation.request(q,true);p.observation.response(q,true);assert.deepEqual(p.observation.snapshot(q),unavailablePage);}
});

test("Page close/crash events after the owned response remain factual and immutable after the first Auth failure",()=>{
 for(const event of["close","crash"]){const p=pageObservationRam(),request={},state=createDriveState();state.count("loginPosts");p.observation.request(request,true);p.observation.response(request,true);p.events.emit(event);
 recordDriveAuthRequestFailure(state,"net::ERR_ABORTED",()=>authFailureObservation({...p.observation.snapshot(request)}));const first=state.value.authPostFailure;assert.equal(Object.isFrozen(first),true);assert.equal(first.pageClosedAfterResponse,event==="close");assert.equal(first.pageCrashedAfterResponse,event==="crash");assert.equal(first.mainFrameAfterResponse,"none");
 p.events.emit("close");p.events.emit("crash");p.events.emit("frame",()=>({isMainFrame:true,url:DRIVE_APP+"/drive"}));let lateReads=0;recordDriveAuthRequestFailure(state,"net::ERR_FAILED",()=>{lateReads++;return authFailureObservation({...p.observation.snapshot(request)});});assert.equal(lateReads,0);assert.deepEqual(state.value.authPostFailure,first);assert.deepEqual(p.observation.snapshot(request),{pageClosedAfterResponse:first.pageClosedAfterResponse,pageCrashedAfterResponse:first.pageCrashedAfterResponse,mainFrameAfterResponse:first.mainFrameAfterResponse});
 const result=state.finish(0,0);assert.equal(result.code,"AUTH_POST_ABORTED");assert.equal(result.writeOutcomeUncertain,true);assert.equal(result.stages.length,0);assert.throws(()=>validateDriveCase({...result,status:"passed",code:"PASSED"}));}
});

test("Page main-frame events classify the first navigation independently of document requests without retaining URL/query",()=>{
 for(const[url,expected]of[[DRIVE_APP+"/entrar?returnTo=%2Fdrive","login"],[DRIVE_APP+"/drive?private=PRIVATE_CANARY#x","drive"],[DRIVE_APP+"/design-system","other"],["about:blank","other"]]){const p=pageObservationRam(),request={};p.observation.request(request,true);p.observation.response(request,true);p.events.emit("frame",()=>({isMainFrame:false,url:DRIVE_APP+"/drive"}));p.events.emit("frame",()=>({isMainFrame:true,url}));p.events.emit("frame",()=>({isMainFrame:true,url:DRIVE_APP+"/entrar"}));const value=p.observation.snapshot(request);assert.equal(value.mainFrameAfterResponse,expected);assert.equal(value.pageClosedAfterResponse,false);assert.equal(JSON.stringify(value).includes("PRIVATE"),false);assert.equal(Object.isFrozen(value),true);}
});

test("Page incomplete attachment, lost identity and multiple Auth posts cannot fabricate false or none",()=>{
 let getterReads=0;const partial={close:()=>{},crash:()=>{},frameNavigated:()=>{throw {get message(){getterReads++;throw Error("PRIVATE");}};}},getter={close:()=>{},crash:()=>{},frameNavigated:()=>{}};Object.defineProperty(getter,"close",{enumerable:true,get(){getterReads++;throw Error("PRIVATE");}});
 for(const install of[null,partial,getter,{close:()=>{},crash:()=>{}}]){const p=createDriveAuthPageObservation(install),request={};p.request(request,true);p.response(request,true);assert.deepEqual(p.snapshot(request),unavailablePage);}
 for(const change of[(p,r)=>p.request(r,false),(p,r)=>{p.request(r,true);p.response(r,false);},(p,r)=>{p.request(r,true);p.response({},true);},(p,r)=>{p.request(r,true);p.request({},true);},(p,r)=>{p.request(r,true);p.response(r,true);p.response({},false);}]){const p=pageObservationRam(),request={};change(p.observation,request);p.observation.response(request,true);assert.deepEqual(p.observation.snapshot(request),unavailablePage);}
 assert.equal(getterReads,0);
});

test("Page event observation read failures become permanently unavailable without private getters or later backfill",()=>{
 let reads=0;const getter={isMainFrame:true};Object.defineProperty(getter,"url",{enumerable:true,get(){reads++;throw Error("PRIVATE");}});
 for(const read of[()=>getter,()=>{throw {get message(){reads++;throw Error("PRIVATE");}};},()=>({isMainFrame:true,url:new String(DRIVE_APP+"/drive")}),()=>({isMainFrame:"true",url:DRIVE_APP+"/drive"}),()=>({isMainFrame:true,url:"http://name:PRIVATE@127.0.0.1:3117/drive"}),()=>({isMainFrame:true,url:DRIVE_APP+"/drive",extra:true})]){const p=pageObservationRam(),request={};p.observation.request(request,true);p.observation.response(request,true);p.events.emit("frame",read);p.events.emit("close");p.events.emit("frame",()=>({isMainFrame:true,url:DRIVE_APP+"/drive"}));assert.deepEqual(p.observation.snapshot(request),unavailablePage);}
 assert.equal(reads,0);
});

test("Page diagnostic activity cannot replace an earlier transport/deadline refusal or establish session/cleanup authority",()=>{
 for(const code of["DEADLINE_EXCEEDED","AUTH_POST_RESPONSE_REFUSED","REQUEST_REFUSED"]){const p=pageObservationRam(),request={},state=createDriveState();state.count("loginPosts");p.observation.request(request,true);p.observation.response(request,true);p.events.emit("frame",()=>({isMainFrame:true,url:DRIVE_APP+"/drive"}));state.fail(code);let snapshots=0;recordDriveAuthRequestFailure(state,"net::ERR_ABORTED",()=>{snapshots++;return authFailureObservation({...p.observation.snapshot(request)});});assert.equal(snapshots,0);const value=state.finish(0,0);assert.equal(value.authPostFailure,null);assert.equal(value.code,code);assert.equal(value.writeOutcomeUncertain,true);assert.equal(value.counts.authDeletes,0);assert.equal(value.stages.length,0);}
});
