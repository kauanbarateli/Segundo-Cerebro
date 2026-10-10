/** Native caller composition. All credentials/fixtures stay in this Node RAM.
 * Tests may inject HTTP/image doubles; they never establish service provenance.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createCaptureImageStorageAcceptance } from "./capture-image-storage-support.mjs";
import { assembleCaptureImageStoragePacket } from "./capture-image-storage-contract.mjs";
import { STORAGE_LOCAL_CASE_CHECKS, validateStorageLocalCaseReport } from "./capture-image-storage-local-ci-contract.mjs";
const API = "http://127.0.0.1:54321", APP = "http://127.0.0.1:3117";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const STORAGE_NATIVE_AUTH_LIMITS = Object.freeze({ requests: 24, bytes: 1048576, timeoutMs: 15000 });
const fail = code => { throw new Error(code); };
export function validateNativeCaseSetup(context, options) {
  if (!context || context.ci !== true || context.githubActions !== true || context.localAuthRun !== true || context.appUrl !== APP || context.supabaseUrl !== API || typeof context.publishableKey !== "string" || !/^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(context.publishableKey) || typeof context.serverSecretKey !== "string" || !/^sb_secret_[A-Za-z0-9_-]{8,256}$/.test(context.serverSecretKey) || !options || typeof options.transport !== "function" || typeof options.inspectSql !== "function" || typeof options.inspectObjects !== "function" || typeof options.registerActors !== "function" || typeof options.cleanupAllowed !== "function" || options.createAcceptance !== undefined && typeof options.createAcceptance !== "function" || Object.hasOwn(options, "observeResponse") && typeof Object.getOwnPropertyDescriptor(options, "observeResponse")?.value !== "function") fail("SETUP_REFUSED");
}
function sessionHint(token, owner) {
  if (typeof token !== "string" || token.length > 16384 || token.split(".").length !== 3) fail("SESSION_REFUSED");
  let claims; try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); } catch { fail("SESSION_REFUSED"); }
  if (claims.sub !== owner || claims.role !== "authenticated" || !UUID.test(claims.session_id) || !Number.isSafeInteger(claims.exp) || claims.exp * 1000 <= Date.now() + 120000) fail("SESSION_REFUSED");
  return { accessToken: token, sessionId: claims.session_id, expiresAt: claims.exp * 1000 };
}
const matches = (user, fixture) => !!user && user.id === fixture.id && user.email === fixture.email && user.role === "authenticated" && user.is_anonymous === false && user.app_metadata?.sc_capture_image_ci_marker === fixture.marker;

export async function runCaptureImageLocalCase(context, options) {
  validateNativeCaseSetup(context, options);
  const report = { schemaVersion: 2, scenario: "capture-image-storage-local-case", status: "failed", code: "CASE_FAILED", phase: "prerequisite", cleanupFailurePoint: null, counts: { authRequests: 0, fixtureCreated: 0, fixtureDeleted: 0, sessionsVerified: 0 }, checks: Object.fromEntries(STORAGE_LOCAL_CASE_CHECKS.map(k=>[k,false])), captureImage: null, writeOutcomeUncertain: false };
  const make = () => ({ id: randomUUID(), email: `image-local-${randomBytes(16).toString("hex")}@example.invalid`, password: randomBytes(24).toString("base64url") + "-Aa1!", marker: randomBytes(32).toString("hex"), created: false, session: null, sessionVerified: false });
  const a = make(), b = make(), fixtures = [a,b], tokens = new Set(), logoutAcks = new Set(), ownedAuth = new Set();
  let pendingAuth = 0, authDeadline = false;
  let pendingWrite = false, unknown = false, image, pipeline = null, cleanup = null, failed = false, failurePhase = null;
  const retain = (code, phase) => { failed = true; if (failurePhase === null) { report.code = code; failurePhase = phase; } };
  const authFetch = async (input, init) => {
    if (authDeadline) fail("CASE_FAILED");
    let url; try { url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url); } catch { fail("SETUP_REFUSED"); }
    const method = (init?.method ?? "GET").toUpperCase(), headers = new Headers(init?.headers), owner = fixtures.find(f=>url.pathname === "/auth/v1/admin/users/" + f.id);
    const allowed = url.pathname === "/auth/v1/admin/users" && method === "POST" && !url.search || owner && ["GET","DELETE"].includes(method) && !url.search || url.pathname === "/auth/v1/token" && method === "POST" && url.search === "?grant_type=password" || url.pathname === "/auth/v1/user" && method === "GET" && !url.search || url.pathname === "/auth/v1/logout" && method === "POST" && url.search === "?scope=global" || url.pathname === "/rest/v1/rpc/my_access_state" && method === "POST" && !url.search;
    const apikey = headers.get("apikey"), authorization = headers.get("authorization");
    if (url.origin !== API || url.username || url.password || url.hash || !allowed || ![context.serverSecretKey,context.publishableKey].includes(apikey) || !["Bearer " + context.serverSecretKey,"Bearer " + context.publishableKey,...[...tokens].map(t=>"Bearer " + t)].includes(authorization) || report.counts.authRequests >= STORAGE_NATIVE_AUTH_LIMITS.requests) fail("SETUP_REFUSED");
    if (url.pathname.includes("/admin/") && (apikey !== context.serverSecretKey || authorization !== "Bearer " + context.serverSecretKey) || ["/auth/v1/user","/auth/v1/logout","/rest/v1/rpc/my_access_state"].includes(url.pathname) && !tokens.has(authorization?.slice(7))) fail("SESSION_REFUSED");
    let body; if (init?.body !== undefined) { if (typeof init.body !== "string" || Buffer.byteLength(init.body) > STORAGE_NATIVE_AUTH_LIMITS.bytes) fail("SETUP_REFUSED"); try { body = JSON.parse(init.body); } catch { fail("SETUP_REFUSED"); } }
    if (url.pathname === "/auth/v1/admin/users" && !fixtures.some(f=>body?.id===f.id && body.email===f.email && body.password===f.password && body.email_confirm===true && body.app_metadata?.sc_capture_image_ci_marker===f.marker)) fail("SETUP_REFUSED");
    if (url.pathname === "/auth/v1/token" && !fixtures.some(f=>body?.email===f.email && body.password===f.password) || method === "DELETE" && body?.should_soft_delete !== false) fail("SETUP_REFUSED");
    report.counts.authRequests++;
    const controller = new AbortController(); let reader, timer, settled = false;
    const deadline = performance.now() + STORAGE_NATIVE_AUTH_LIMITS.timeoutMs;
    const check = () => { if (settled || controller.signal.aborted || performance.now() >= deadline) fail("CASE_FAILED"); };
    pendingAuth++;
    const owned = (async()=>{
      check(); const response = await options.transport(url.href,{...init,method,redirect:"error",cache:"no-store",credentials:"omit",signal:controller.signal}); check();
      if (!(response instanceof Response) || response.redirected) fail("CASE_FAILED");
      const pieces=[];let bytes=0;
      try {
        if(response.body){reader=response.body.getReader();for(;;){check();const part=await reader.read();check();if(part.done)break;bytes+=part.value.byteLength;if(bytes>STORAGE_NATIVE_AUTH_LIMITS.bytes)fail("CASE_FAILED");pieces.push(part.value);}}
        const output=new Uint8Array(bytes);let offset=0;for(const part of pieces){output.set(part,offset);offset+=part.byteLength;}
        check();if(url.pathname==="/auth/v1/logout"&&response.status===204)logoutAcks.add(authorization.slice(7));
        return new Response(response.body ? output : null,{status:response.status,headers:response.headers});
      } finally {for(const part of pieces)part.fill(0);}
    })().finally(()=>{pendingAuth--;ownedAuth.delete(owned);});ownedAuth.add(owned);
    try {return await Promise.race([owned,new Promise((_,reject)=>{timer=setTimeout(()=>{authDeadline=true;controller.abort();reject(new Error("CASE_FAILED"));},STORAGE_NATIVE_AUTH_LIMITS.timeoutMs);})]);}
    catch { fail("CASE_FAILED"); }
    finally {settled=true;clearTimeout(timer);controller.abort();if(reader)void reader.cancel().catch(()=>{});}
  };
  const client = (key, token) => createClient(API,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},db:{retry:false},global:{fetch:authFetch,...(token?{headers:{Authorization:"Bearer "+token}}:{})}});
  const admin = client(context.serverSecretKey);
  try {
    report.phase="fixture-create";
    for(const fixture of fixtures){pendingWrite=true;const result=await admin.auth.admin.createUser({id:fixture.id,email:fixture.email,password:fixture.password,email_confirm:true,app_metadata:{sc_capture_image_ci_marker:fixture.marker}});if(result.error||!matches(result.data.user,fixture))fail("FIXTURE_CREATE_FAILED");fixture.created=true;report.counts.fixtureCreated++;pendingWrite=false;}
    report.checks.fixturesBound=true;
    for(const fixture of fixtures){
      report.phase="login";pendingWrite=true;const login=await client(context.publishableKey).auth.signInWithPassword({email:fixture.email,password:fixture.password});if(login.error||!matches(login.data.user,fixture)||!login.data.session)fail("LOGIN_FAILED");const hint=sessionHint(login.data.session.access_token,fixture.id);tokens.add(hint.accessToken);fixture.session=hint;pendingWrite=false;
      report.phase="session-verification";const verified=await admin.auth.getUser(hint.accessToken);if(verified.error||!matches(verified.data.user,fixture))fail("SESSION_REFUSED");fixture.sessionVerified=true;report.counts.sessionsVerified++;
      report.phase="ordinary-access";const state=await client(context.publishableKey,hint.accessToken).rpc("my_access_state");const value=state.data;if(state.error||!value||value.user_id!==fixture.id||value.role!=="user"||value.must_change_password!==false||!value.entitlements||typeof value.entitlements!=="object"||Array.isArray(value.entitlements)||Object.keys(value.entitlements).length)fail("ORDINARY_ACCESS_REFUSED");
    }
    report.checks.sessionsVerified=report.checks.ordinaryAccessVerified=true;
    if(a.session.sessionId===b.session.sessionId)fail("SESSION_REFUSED");report.checks.distinctSessions=true;
    await options.registerActors(Object.freeze({a:Object.freeze({id:a.id,sessionId:a.session.sessionId,marker:a.marker}),b:Object.freeze({id:b.id,sessionId:b.session.sessionId,marker:b.marker})}));
    report.phase="image-construction";
    image=await (options.createAcceptance??createCaptureImageStorageAcceptance)({runtime:{ci:true,githubActions:true,localAuthRun:true,appUrl:APP,supabaseUrl:API},publishableKey:context.publishableKey,serverSecretKey:context.serverSecretKey,a:{id:a.id,...a.session},b:{id:b.id,...b.session}},{transport:options.transport,inspectSql:options.inspectSql,inspectObjects:options.inspectObjects,...(Object.hasOwn(options,"observeResponse")?{observeResponse:options.observeResponse}:{})});
    report.phase="image-pipeline";pipeline=await image.run();unknown||=image.metadata().writeOutcomeUncertain;if(pipeline.status!=="passed")fail("IMAGE_PIPELINE_FAILED");
  } catch(error) { unknown||=pendingWrite;retain(["FIXTURE_CREATE_FAILED","LOGIN_FAILED","SESSION_REFUSED","ORDINARY_ACCESS_REFUSED","IMAGE_PIPELINE_FAILED"].includes(error?.message)?error.message:report.phase==="image-construction"?"IMAGE_CONSTRUCTION_FAILED":"CASE_FAILED",report.phase); }
  finally {
    if(image&&options.cleanupAllowed()===true&&!pendingAuth&&!authDeadline){
      try{report.phase="object-cleanup";unknown||=image.metadata().writeOutcomeUncertain;cleanup=await image.cleanupObjects();unknown||=image.metadata().writeOutcomeUncertain;report.captureImage=assembleCaptureImageStoragePacket({pipeline,cleanup,writeOutcomeUncertain:unknown});report.checks.objectCleanupConfirmed=cleanup.status==="passed"&&!unknown;if(!report.captureImage.authDeletionAllowed)retain("OBJECT_CLEANUP_FAILED",report.phase);}
      catch{unknown||=image.metadata().writeOutcomeUncertain;retain("OBJECT_CLEANUP_FAILED","object-cleanup");}
    }else if(image){unknown=true;report.captureImage=assembleCaptureImageStoragePacket({pipeline,cleanup:null,writeOutcomeUncertain:true});retain("OBJECT_CLEANUP_FAILED","object-cleanup");}
    const mayDelete=!unknown && !pendingAuth && !authDeadline && options.cleanupAllowed()===true && (!image || report.captureImage?.authDeletionAllowed===true);
    if(mayDelete){for(const fixture of fixtures.filter(f=>f.created)){
      try{
        report.phase="auth-precheck";const existing=await admin.auth.admin.getUserById(fixture.id);if(existing.error||!matches(existing.data.user,fixture))fail("AUTH_CLEANUP_UNCONFIRMED");
        if(fixture.session&&fixture.sessionVerified){report.phase="auth-revoke";pendingWrite=true;const revoked=await admin.auth.admin.signOut(fixture.session.accessToken,"global");if(revoked.error||!logoutAcks.has(fixture.session.accessToken))fail("AUTH_CLEANUP_UNCONFIRMED");pendingWrite=false;}
        report.phase="auth-delete";pendingWrite=true;const removed=await admin.auth.admin.deleteUser(fixture.id,false);if(removed.error||!matches(removed.data.user,fixture))fail("AUTH_CLEANUP_UNCONFIRMED");pendingWrite=false;
        report.phase="auth-absence";const absent=await admin.auth.admin.getUserById(fixture.id);if(absent.data.user||absent.error?.status!==404||absent.error?.code!=="user_not_found")fail("AUTH_CLEANUP_UNCONFIRMED");report.counts.fixtureDeleted++;
      }catch{unknown||=pendingWrite;report.cleanupFailurePoint??=report.phase;retain("AUTH_CLEANUP_UNCONFIRMED",report.phase);break;}
    }}else retain(unknown?"WRITE_OUTCOME_UNCERTAIN":"OBJECT_CLEANUP_FAILED",report.phase);
    report.checks.authCleanupConfirmed=!unknown&&report.counts.fixtureCreated===report.counts.fixtureDeleted;
    if(!report.checks.authCleanupConfirmed)retain("AUTH_CLEANUP_UNCONFIRMED",report.phase);
    if(ownedAuth.size){let timer;try{await Promise.race([Promise.allSettled([...ownedAuth]),new Promise(resolve=>{timer=setTimeout(resolve,2000);})]);}finally{clearTimeout(timer);}}
    if(image){unknown||=image.metadata().writeOutcomeUncertain;await image.settle();image.dispose();unknown||=image.metadata().writeOutcomeUncertain;}
    report.writeOutcomeUncertain=unknown;report.phase=failurePhase??"complete";report.status=failed?"failed":"passed";if(!failed)report.code="PASSED";
    for(const fixture of fixtures){fixture.password="";fixture.email="";fixture.marker="";fixture.session=null;}tokens.clear();
  }
  return validateStorageLocalCaseReport(report);
}
