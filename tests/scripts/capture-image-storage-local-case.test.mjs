// Real SDK with closed HTTP doubles; image execution is an explicit seam here.
// The producer's separate canonical SQL/Sharp controls cover its composition.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runCaptureImageLocalCase, validateNativeCaseSetup } from "../e2e-auth-local/capture-image-storage-local-case.mjs";
import { CAPTURE_IMAGE_STAGES, CAPTURE_IMAGE_CHECKS, CAPTURE_IMAGE_PASS_COUNTS, CAPTURE_IMAGE_CLEANUP_STAGES, CAPTURE_IMAGE_CLEANUP_PASS_COUNTS } from "../e2e-auth-local/capture-image-storage-support.mjs";
const ctx={ci:true,githubActions:true,localAuthRun:true,appUrl:"http://127.0.0.1:3117",supabaseUrl:"http://127.0.0.1:54321",publishableKey:"sb_publishable_synthetic_local_abcdefgh",serverSecretKey:"sb_secret_fake_only_for_test"};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","x-supabase-api-version":"2024-01-01"}});
const pipeline=()=>({schemaVersion: 2,scenario:"capture-image-storage",status:"passed",code:"PASSED",failurePoint:null,stages:CAPTURE_IMAGE_STAGES.map(name=>({name,passed:true})),counts:{...CAPTURE_IMAGE_PASS_COUNTS},checks:Object.fromEntries(CAPTURE_IMAGE_CHECKS.map(k=>[k,true])),measurements:{sourceBytes:1021,finalBytes:287,sourceWidth:60,sourceHeight:40,finalWidth:40,finalHeight:60},writeOutcomeUncertain:false});
const cleaned=()=>({schemaVersion: 2,scenario:"capture-image-storage-cleanup",status:"passed",code:"PASSED",failurePoint:null,stages:CAPTURE_IMAGE_CLEANUP_STAGES.map(name=>({name,passed:true})),counts:{...CAPTURE_IMAGE_CLEANUP_PASS_COUNTS},exactInventory:true,objectsAbsent:true,authDeletionAllowed:true,writeOutcomeUncertain:false});
function harness(mode){
  const users=new Map(),tokens=new Map(),requests=[],order=[];let verified,imageCalls=0,cleanupCalls=0,allowed=true;
  const transport=async(url,init)=>{
    const target=new URL(url),headers=new Headers(init.headers),body=init.body?JSON.parse(init.body):undefined;
    assert.equal(target.origin,ctx.supabaseUrl);assert.equal(init.redirect,"error");assert.equal(init.credentials,"omit");assert.equal(init.cache,"no-store");assert.equal(init.signal instanceof AbortSignal,true);
    requests.push({path:target.pathname,method:init.method});order.push(init.method+" "+target.pathname);
    if(target.pathname==="/auth/v1/admin/users"&&init.method==="POST"){
      const user={id:body.id,email:body.email,role:"authenticated",is_anonymous:false,app_metadata:body.app_metadata,user_metadata:{},aud:"authenticated",created_at:new Date().toISOString()};users.set(user.id,{user,password:body.password});return json(user);
    }
    if(target.pathname==="/auth/v1/token"){
      const entry=[...users.values()].find(x=>x.user.email===body.email);assert.equal(entry.password,body.password);const claims={sub:mode==="wrong-subject"?randomUUID():entry.user.id,role:"authenticated",session_id:randomUUID(),exp:Math.floor(Date.now()/1000)+3600};const token=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic';tokens.set(token,entry.user);
      return json({access_token:token,refresh_token:"synthetic-refresh",token_type:"bearer",expires_in:3600,user:entry.user});
    }
    if(target.pathname==="/auth/v1/user")return json(tokens.get(headers.get("authorization").slice(7)));
    if(target.pathname==="/rest/v1/rpc/my_access_state"){const user=tokens.get(headers.get("authorization").slice(7));return json({user_id:user.id,role:mode==="master"?"master":"user",must_change_password:false,entitlements:{}});}
    if(target.pathname==="/auth/v1/logout")return new Response(null,{status:204});
    const id=target.pathname.slice('/auth/v1/admin/users/'.length),entry=users.get(id);
    if(init.method==="GET")return entry?json(entry.user):json({message:"User not found",code:"user_not_found"},404);
    if(init.method==="DELETE"){assert.ok(entry);assert.equal(body.should_soft_delete,false);users.delete(id);return mode==="bad-delete"||mode==="bad-delete-second"&&requests.filter(r=>r.method==="DELETE").length===2?json({...entry.user,id:randomUUID()}):json(entry.user);}
    throw new Error("UNEXPECTED_FAKE_AUTH_REQUEST");
  };
  const createAcceptance=async(context,options)=>{
    imageCalls++;assert.equal(context.b.id,verified.b.id);assert.equal(context.b.sessionId,verified.b.sessionId);assert.equal(context.a.id,verified.a.id);
    let unknown=mode==="image-unknown",disposed=false;
    return {
      async run(){order.push("image-run");await options.inspectSql({ownerId:context.b.id,uploadId:randomUUID(),captureId:randomUUID()});if(mode==="group-unknown")allowed=false;
        if(!unknown)return pipeline();const r=pipeline();r.status="failed";r.code="WRITE_OUTCOME_UNCERTAIN";r.failurePoint="PREREQUISITE";r.stages=[];r.counts=Object.fromEntries(Object.keys(r.counts).map(k=>[k,0]));r.checks=Object.fromEntries(Object.keys(r.checks).map(k=>[k,false]));r.measurements=Object.fromEntries(Object.keys(r.measurements).map(k=>[k,0]));r.writeOutcomeUncertain=true;return r;
      },
      async cleanupObjects(){cleanupCalls++;order.push("objects-cleanup");if(!unknown)return cleaned();return {...cleaned(),status:"failed",code:"WRITE_OUTCOME_UNCERTAIN",failurePoint:"PREREQUISITE",stages:[],counts:{requests:0,removeRequests:0,absenceReads:0,removedObjects:0,sqlInspections:0},exactInventory:false,objectsAbsent:false,authDeletionAllowed:false,writeOutcomeUncertain:true};},
      async settle(){return true;},metadata(){return {state:disposed?"disposed":"prepared",pipelinePassed:!unknown,objectsCleanupConfirmed:cleanupCalls>0&&!unknown,writeOutcomeUncertain:unknown,authDeletionAllowed:cleanupCalls>0&&!unknown,pendingRequests:0,pendingInspections:0,deadlineRefused:false,moduleCount:27};},dispose(){disposed=true;unknown||=mode==="image-unknown";},
    };
  };
  return {users,requests,order,options:{transport,inspectSql:async ids=>{assert.equal(ids.ownerId,verified.b.id);return {};},inspectObjects:async()=>({buckets:[],objects:[]}),registerActors:actors=>{assert.equal(users.get(actors.a.id).user.app_metadata.sc_capture_image_ci_marker,actors.a.marker);assert.equal(users.get(actors.b.id).user.app_metadata.sc_capture_image_ci_marker,actors.b.marker);verified=actors;},cleanupAllowed:()=>allowed,createAcceptance},counts:()=>({imageCalls,cleanupCalls})};
}
test("native case requires finite IO, actor registration and external cleanup gate before any HTTP",()=>{
  const h=harness();for(const field of ["transport","inspectSql","inspectObjects","registerActors","cleanupAllowed"]){const opts={...h.options};delete opts[field];assert.throws(()=>validateNativeCaseSetup(ctx,opts),{message:"SETUP_REFUSED"});}
  assert.throws(()=>validateNativeCaseSetup({...ctx,supabaseUrl:"https://foreign.test"},h.options),{message:"SETUP_REFUSED"});assert.equal(h.requests.length,0);
});
test("two ordinary SDK logins precede image proof and exact object cleanup precedes every Auth deletion",async()=>{
  const h=harness(),report=await runCaptureImageLocalCase(ctx,h.options);assert.equal(report.status,"passed");assert.deepEqual(report.counts,{authRequests:16,fixtureCreated:2,fixtureDeleted:2,sessionsVerified:2});assert.equal(h.users.size,0);assert.equal(report.captureImage.pipeline.counts.requests,27);assert.ok(h.order.findIndex(x=>x.startsWith("DELETE "))>h.order.indexOf("objects-cleanup"));assert.deepEqual(h.counts(),{imageCalls:1,cleanupCalls:1});assert.equal(Object.isFrozen(report.captureImage),true);assert.equal(Object.hasOwn(report,"nativeVerified"),false);
});
test("a master access DTO is refused before the image factory, with only owned Auth fixture cleanup",async()=>{
  const h=harness("master"),report=await runCaptureImageLocalCase(ctx,h.options);assert.equal(report.status,"failed");assert.equal(report.code,"ORDINARY_ACCESS_REFUSED");assert.equal(report.captureImage,null);assert.equal(h.counts().imageCalls,0);assert.equal(report.checks.ordinaryAccessVerified,false);assert.equal(report.checks.authCleanupConfirmed,true);assert.equal(h.users.size,0);
});
test("a mismatched session subject keeps the login write unknown and never deletes an Auth fixture",async()=>{
  const h=harness("wrong-subject"),report=await runCaptureImageLocalCase(ctx,h.options);assert.equal(report.status,"failed");assert.equal(report.writeOutcomeUncertain,true);assert.equal(report.counts.fixtureDeleted,0);assert.equal(h.requests.some(r=>r.method==="DELETE"),false);assert.equal(h.counts().imageCalls,0);
});
test("uncertain image pipeline cannot be rescued by namespace or receipt and denies all Auth cleanup",async()=>{
  const h=harness("image-unknown"),report=await runCaptureImageLocalCase(ctx,h.options);assert.equal(report.status,"failed");assert.equal(report.writeOutcomeUncertain,true);assert.equal(report.captureImage.authDeletionAllowed,false);assert.equal(report.captureImage.cleanup.counts.requests,0);assert.equal(report.counts.fixtureDeleted,0);assert.equal(h.requests.some(r=>r.method==="DELETE"),false);
});
test("an unconfirmed external process group blocks object cleanup and all Auth deletion",async()=>{
  const h=harness("group-unknown"),report=await runCaptureImageLocalCase(ctx,h.options);assert.equal(report.status,"failed");assert.equal(report.writeOutcomeUncertain,true);assert.equal(h.counts().cleanupCalls,0);assert.equal(h.requests.some(r=>r.method==="DELETE"),false);assert.equal(report.captureImage.authDeletionAllowed,false);
});
test("wrong Auth delete acknowledgement preserves its unknown outcome and never continues to the other account",async()=>{
  const h=harness("bad-delete"),report=await runCaptureImageLocalCase(ctx,h.options);assert.equal(report.status,"failed");assert.equal(report.cleanupFailurePoint,"auth-delete");assert.equal(report.writeOutcomeUncertain,true);assert.equal(report.counts.fixtureDeleted,0);assert.equal(h.requests.filter(r=>r.method==="DELETE").length,1);assert.equal(report.checks.objectCleanupConfirmed,true);assert.equal(report.checks.authCleanupConfirmed,false);
});
test("an unknown second deletion preserves the first confirmed cleanup without certifying Auth empty",async()=>{
  const h=harness("bad-delete-second"),report=await runCaptureImageLocalCase(ctx,h.options);assert.equal(report.status,"failed");assert.equal(report.writeOutcomeUncertain,true);assert.equal(report.counts.fixtureDeleted,1);assert.equal(report.cleanupFailurePoint,"auth-delete");assert.equal(report.checks.authCleanupConfirmed,false);assert.equal(h.requests.filter(r=>r.method==="DELETE").length,2);assert.equal(h.requests.filter(r=>r.method==="GET"&&r.path.startsWith('/auth/v1/admin/users/')).length,3);
});


test("pending Auth headers retain the request and deny cleanup even after a late ACK",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const h=harness(),original=h.options.transport;let release,entered;
  const waiting=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  h.options.transport=async(url,init)=>{entered();await waiting;return original(url,init);};const running=runCaptureImageLocalCase(ctx,h.options);await started;t.mock.timers.tick(15001);await new Promise(setImmediate);t.mock.timers.tick(2001);const report=await running;
  assert.equal(report.status,"failed");assert.equal(report.writeOutcomeUncertain,true);assert.equal(report.counts.authRequests,1);assert.equal(report.counts.fixtureDeleted,0);assert.equal(h.requests.length,0);assert.equal(h.counts().imageCalls,0);release();await new Promise(setImmediate);assert.equal(h.requests.length,1);assert.equal(h.requests.some(row=>row.method==="DELETE"||row.path==="/auth/v1/logout"),false);assert.equal(report.counts.fixtureCreated,0);t.mock.timers.reset();
});
test("failed Auth body cannot become a verified fixture or permit logout and deletion",async()=>{
  const h=harness(),original=h.options.transport;h.options.transport=async(url,init)=>{await original(url,init);return new Response(new ReadableStream({start(controller){controller.error(new Error("SYNTHETIC_BODY_FAILED"));}}),{status:200,headers:{"content-type":"application/json"}});};
  const report=await runCaptureImageLocalCase(ctx,h.options);assert.equal(report.status,"failed");assert.equal(report.writeOutcomeUncertain,true);assert.equal(report.counts.authRequests,1);assert.equal(report.counts.fixtureCreated,0);assert.equal(h.users.size,1);assert.equal(h.requests.length,1);assert.equal(h.requests.some(row=>row.method==="DELETE"||row.path==="/auth/v1/logout"),false);assert.equal(h.counts().imageCalls,0);
});
