// Real Next/Auth/browser in the dedicated Linux job. No Locator -> expect:
// installed Frame.expect can snapshot the whole body on a failing matcher.
import { test, expect, type BrowserContext, type CDPSession, type Page, type Request as BrowserRequest, type Response as BrowserResponse } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
// Shared JavaScript lifecycle has no declaration file; its result is checked
// as unknown at the caller boundary below, rather than trusted by a type cast.
// @ts-expect-error Existing reviewed JS lifecycle, unchanged by this delivery.
import { runBoundedProcess, localPsqlEnvironment } from "../../scripts/verification/auth-local-ci.mjs";
import { sessionFromCookies } from "./support";
import { prepareAuthEffectObservation, createAuthEffectLedger, type AuthEffectObservation, type AuthEffectReceipt } from "./auth-effect-outcome.mjs";
import { ADMIN_BROWSER_APP, ADMIN_BROWSER_PAGES, ADMIN_BROWSER_PROBES, acceptAdminBrowserRequest, acceptsAdminBrowserDenial, acceptAdminOwnSessionsView, acceptsAdminOwnSessionsChanged, adminBrowserEnvironment, adminBrowserRefuse, closedBrowserOperation, createAdminBrowserHarness, createBrowserRequestOriginTracker, createBrowserProtocolObserver, isAdminCanonicalHmrGet, classifyAdminBrowserHttpRequest, adminBrowserHttpPendingCode, isAdminBrowserReadCancellationRequest, isAdminBrowserParkableAuthRead, adminBrowserPageReleaseCode, adminBrowserPendingCode, waitForAdminBrowserIoQuiet, waitForAdminBrowserHttpQuiet, type AdminBrowserOwner, type AdminOwnSessionsView } from "./admin-browser-support.mjs";
import { validateAdminBrowserCase, isAdminAuthActionRequest, acceptAdminAuthActionResponse, runAdminAuthCheckpoint, ADMIN_BROWSER_STAGES, ADMIN_HTTP_PENDING_CODES, type AdminQuiescenceDetail, type AdminAuthPostFailure, type AdminHttpProbeFailure } from "./admin-browser-contract.mjs";
import { prepareWorkerNextStop } from "./admin-browser-support.mjs";
// @ts-expect-error Reviewed inert JS fence helper has no declaration file.
import { createQuiescenceFence } from "../../scripts/verification/browser-quiescence-fence-probe.mjs";

process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
test.describe.configure({ mode: "serial" });
test.use({ trace: "off", screenshot: "off", video: "off", acceptDownloads: false, serviceWorkers: "block" });
const guard = closedBrowserOperation;
const same = (a:unknown,b:unknown) => JSON.stringify(a) === JSON.stringify(b);

for (const kind of ["BLOCK_LIVE_BROWSER", "FIRST_FORCED_BROWSER"] as const) {
  test(kind, async ({ browser }, testInfo) => {
    const context = adminBrowserEnvironment(process.env);
    if (context.case !== kind) adminBrowserRefuse("ENVIRONMENT_REFUSED");
    let pendingSql = 0, pendingUi = 0, contextsClosed = false, contextsCloseAttempted = false, parkingPages = false, routeSealed = false, routeVeto = false;
    const routeOperations = new Set<Promise<unknown>>(), routeFences = new Set<ReturnType<typeof createQuiescenceFence>>();
    const contexts: BrowserContext[] = [];
    type AuthScope={page:Page;operation:"login-help"|"login-forced";observation:AuthEffectObservation;receipt:AuthEffectReceipt|null;failedRequest:BrowserRequest|null;failure:AdminAuthPostFailure|null};
    const authEffects=new WeakMap<BrowserContext,AuthScope>(),pendingAuthEffects=new Set<AuthScope>();
    const pg = localPsqlEnvironment(process.env, process.env.HOME!, { password: process.env.SC_ADMIN_BROWSER_PG_PASSWORD! });
    const sql = async (input:string, read:boolean) => {
      pendingSql++;
      try {
        const r = await guard(() => runBoundedProcess("psql", ["--no-psqlrc", "--no-password", "--quiet", ...(read ? ["--tuples-only", "--no-align"] : []), "--set", "ON_ERROR_STOP=1", "--file=-"], { cwd: process.cwd(), env: pg, input, timeoutMs: 15000, maxBytes: 1048576, capture: read }), "SQL_REFUSED");
        if (!r || typeof r !== "object" || !("groupConfirmed" in r) || r.groupConfirmed !== true || !("stdout" in r) || typeof r.stdout !== "string") adminBrowserRefuse("PROCESS_UNCONFIRMED");
        if (!read) return null;
        const lines = r.stdout.trim().split(/\r?\n/); if (lines.length !== 1) adminBrowserRefuse("SQL_REFUSED");
        try { return JSON.parse(lines[0]!); } catch { adminBrowserRefuse("SQL_REFUSED"); }
      } finally { pendingSql--; }
    };
    type ReadObservation = {pathClass:AdminQuiescenceDetail["pathClass"];resource:AdminQuiescenceDetail["resource"];frame:AdminQuiescenceDetail["frame"];page:Page|null};
    const unavailableRead=():ReadObservation=>({pathClass:"unavailable",resource:"unavailable",frame:"unavailable",page:null});
    const uiOperations = new Set<Promise<unknown>>(), liveRequests = new Map<object,{kind:"hmrGet"|"otherHttp";httpClass:ReturnType<typeof classifyAdminBrowserHttpRequest>;responseSeen:boolean;parkableAuthRead:boolean;observation:ReadObservation}>(), nonReadRequests = new Set<object>();
    const pendingBrowserIo = () => ({ ui:uiOperations.size+routeOperations.size, hmrGet:[...liveRequests.values()].filter(entry=>entry.kind==="hmrGet").length, otherHttp:[...liveRequests.values()].filter(entry=>entry.kind==="otherHttp").length });
    const pendingHttpCode=()=>adminBrowserHttpPendingCode([...liveRequests.values()].filter(entry=>entry.kind==="otherHttp").map(({httpClass,responseSeen})=>({httpClass,responseSeen})));
    const observedAuthPosts = new WeakMap<BrowserContext,Map<string,number>>();
    const authPosts = (c:BrowserContext,path:string) => observedAuthPosts.get(c)?.get(path) ?? 0;
    const harness = await createAdminBrowserHarness(context, { query: input => sql(input,true), write: async input => { try { await sql(input,false); } catch { harness.state.unknown(); adminBrowserRefuse("SQL_REFUSED"); } }, cleanupAllowed: () => contextsClosed && !routeVeto && !routeOperations.size && !pendingUi && !pendingSql && !uiOperations.size && !liveRequests.size && !nonReadRequests.size && !pendingAuthEffects.size });
    const state = harness.state;
    const nextStop = await prepareWorkerNextStop({ env:process.env, caseName:kind, testInfo, pending:liveRequests, readGate:()=>{state.active();const m=harness.metadata();return {stagePassed:state.value.stages.at(-1)?.stage==="actor-intact"&&state.value.stages.at(-1)?.passed===true,ui:pendingUi+uiOperations.size+routeOperations.size,sdk:m.pendingRequests,sql:pendingSql+m.pendingInspections,nonRead:nonReadRequests.size,unknown:state.value.writeOutcomeUncertain||pendingAuthEffects.size>0};} });
    const requestOrigins = createBrowserRequestOriginTracker(ADMIN_BROWSER_STAGES[kind]), protocolObserver=createBrowserProtocolObserver({fetchCommands:true});
    // Keep each actual action/response promise owned until settlement, including
    // the other branch of a failed form submission. Only closed errors escape.
    const safe = async <T>(operation:()=>Promise<T>,code="BROWSER_REFUSED"):Promise<T> => {
      state.active(); const owned=guard(operation,code).finally(()=>uiOperations.delete(owned)); uiOperations.add(owned);
      try { const value=await owned; state.active(); return value; } catch { adminBrowserRefuse(code); }
    };
    // poll sees only a primitive; evaluation/action exceptions lose provider,
    // DOM, cookie and argument details before reaching Playwright assertions.
    const truth = async (read:()=>Promise<boolean>) => { await safe(() => expect.poll(async () => { try { state.active(); return await read() === true; } catch { return false; } }, { timeout: 20000, intervals: [50,100,250] }).toBe(true)); };
    // Transient readiness only: keep every original Request and route promise.
    // Response waiters may already be armed, so they are not pending read IO.
    // Canonical HMR stays recorded for the separate, unchanged final drain.
    const finiteReads = async () => {
      state.active(); const started=performance.now(); let previous=started;
      if (!Number.isFinite(started)) { state.fail("PROCESS_UNCONFIRMED"); adminBrowserRefuse("PROCESS_UNCONFIRMED"); }
      const read = () => {
        state.active();
        const at=performance.now(); if (!Number.isFinite(at) || at<previous) { state.fail("PROCESS_UNCONFIRMED"); adminBrowserRefuse("PROCESS_UNCONFIRMED"); } previous=at;
        if (state.value.writeOutcomeUncertain || nonReadRequests.size) { state.unknown(); state.fail("WRITE_OUTCOME_UNCERTAIN"); adminBrowserRefuse("WRITE_OUTCOME_UNCERTAIN"); }
        return { ui:routeOperations.size, hmrGet:[...liveRequests.values()].filter(row=>row.kind==="hmrGet").length, otherHttp:[...liveRequests.values()].filter(row=>row.kind==="otherHttp").length };
      };
      try {
        const waiting = await waitForAdminBrowserHttpQuiet(read, { timeoutMs:15000, deadlineMs:started+15000 });
        const failure = waiting ?? adminBrowserPendingCode({ ...read(), hmrGet:0 });
        if (failure) { const code=failure==="QUIESCENCE_HTTP_PENDING"?pendingHttpCode():failure; state.fail(code); adminBrowserRefuse(code); }
        const at=performance.now(); if (!Number.isFinite(at) || at<previous || at>=started+15000) { state.fail("PROCESS_UNCONFIRMED"); adminBrowserRefuse("PROCESS_UNCONFIRMED"); }
        state.active();
      } catch { state.active(); adminBrowserRefuse("PROCESS_UNCONFIRMED"); }
    };
    const visible = async (page:Page, selector:string) => { await truth(() => page.locator(selector).evaluateAll(nodes => nodes.length === 1 && nodes[0] instanceof HTMLElement && !!nodes[0].getClientRects().length)); await finiteReads(); };
    const destination = async (page:Page, path:string) => { await truth(async () => page.url() === ADMIN_BROWSER_APP + path); await finiteReads(); };
    const goto = async (page:Page,path:string) => { await finiteReads(); await safe(async () => { state.active(); pendingUi++; try { await page.goto(ADMIN_BROWSER_APP + path, { waitUntil: "load", timeout:30000 }); state.active(); } finally { pendingUi--; } }); await finiteReads(); };
    const makeContext = async () => {
      state.count("contexts"); const c = await safe(() => browser.newContext({ baseURL:ADMIN_BROWSER_APP, acceptDownloads:false, serviceWorkers:"block" })); contexts.push(c);
      const authPostRequests=new WeakMap<BrowserRequest,Pick<AdminAuthPostFailure,"operation"|"resource">>(),authPostResponses=new WeakMap<BrowserRequest,Pick<AdminAuthPostFailure,"response"|"contentType">>(),authAbortEligibility=new WeakMap<BrowserRequest,boolean>();
      const postFailureSnapshot=(request:BrowserRequest,failureText:unknown):AdminAuthPostFailure=>Object.freeze({... (authPostRequests.get(request)??{operation:"other",resource:"unavailable"}),failure:failureText===undefined?"unavailable":failureText==="net::ERR_ABORTED"?"aborted":failureText==="net::ERR_FAILED"?"failed":"other",... (authPostResponses.get(request)??{response:"unobserved",contentType:"unobserved"})});
      const fence=createQuiescenceFence({allowed:(request:BrowserRequest)=>{const allowed=acceptAdminBrowserRequest(request.url(),request.method());if(parkingPages&&(!allowed||!isAdminBrowserReadCancellationRequest(request.url(),request.method()))){state.unknown();state.fail("WRITE_OUTCOME_UNCERTAIN");}return allowed;},readCancellation:(request:BrowserRequest)=>isAdminBrowserReadCancellationRequest(request.url(),request.method()),onRefusal:()=>state.fail("REQUEST_REFUSED")});
      routeFences.add(fence);
      await safe(() => c.route("**/*", route => {
        const owned=Promise.resolve().then(async()=>{
        if(parkingPages)return fence.handle({request:()=>route.request(),async abort(){const ack=requestOrigins.routeStarted(route.request(),"abort");await route.abort();ack();},async continue(){const ack=requestOrigins.routeStarted(route.request(),"continue");await route.continue();ack();}});
        try { state.active(); if (!acceptAdminBrowserRequest(route.request().url(), route.request().method())) { state.fail("REQUEST_REFUSED"); const ack=requestOrigins.routeStarted(route.request(),"abort"); await route.abort(); ack(); return; } const ack=requestOrigins.routeStarted(route.request(),"continue"); await route.continue(); ack(); } catch { state.fail("REQUEST_REFUSED"); try{const ack=requestOrigins.routeStarted(route.request(),"abort");await route.abort();ack();}catch{/* A refused route promise is not an ACK. */} }
        }).finally(()=>routeOperations.delete(owned));
        routeOperations.add(owned);if(routeSealed){routeVeto=true;state.fail("QUIESCENCE_UI_PENDING");}return owned;
      }));
      // Presentation only: existing authorization supplies the read decision.
      // Frame/resource observations do not authorize cancellation or retain URLs.
      const observeRead=(request:BrowserRequest,allowed:boolean,method:string,path:string,httpClass:ReturnType<typeof classifyAdminBrowserHttpRequest>,resource:string):ReadObservation=>{
        const observation=unavailableRead();if(!allowed||method!=="GET")return observation;
        observation.pathClass=path==="/entrar"?"login":path==="/trocar-senha"?"password-change":httpClass==="AUTH"?"other-auth":"other-authorized";
        observation.resource=resource==="document"||resource==="fetch"||resource==="xhr"?resource:"other";
        try{const frame=request.frame(),page=frame.page();if(page.context()===c){observation.page=page;observation.frame=frame===page.mainFrame()?"main":"child";}}catch{/* No factual frame observation. */}
        return observation;
      };
      c.on("request", request => { if(routeSealed){routeVeto=true;state.fail("QUIESCENCE_HTTP_PENDING");}requestOrigins.request(request,state.value.stages.at(-1)?.stage??null); liveRequests.set(request,{kind:"otherHttp",httpClass:"OTHER",responseSeen:false,parkableAuthRead:false,observation:unavailableRead()}); try { if(!isAdminBrowserReadCancellationRequest(request.url(),request.method())){nonReadRequests.add(request);if(parkingPages){state.unknown();state.fail("WRITE_OUTCOME_UNCERTAIN");}} state.count("browserRequests"); const u = new URL(request.url()),method=request.method(),allowed=acceptAdminBrowserRequest(request.url(),method),resource=allowed&&method==="GET"?request.resourceType():"other",httpClass=classifyAdminBrowserHttpRequest(request.url(),method,resource,allowed); const observation=observeRead(request,allowed,method,u.pathname,httpClass,resource);protocolObserver.request(request,observation.page);liveRequests.set(request,{kind:isAdminCanonicalHmrGet(request.url(),request.method())?"hmrGet":"otherHttp",httpClass,responseSeen:false,parkableAuthRead:isAdminBrowserParkableAuthRead(request.url(),request.method(),allowed),observation}); const tracked=liveRequests.get(request);if(allowed&&tracked)nextStop.capture(request,tracked,{method,url:request.url()}); if (!allowed) state.fail("REQUEST_REFUSED"); if (isAdminAuthActionRequest(request.url(),request.method())) { if(allowed&&!authPostRequests.has(request)){let postResource:AdminAuthPostFailure["resource"]="unavailable";try{const raw=request.resourceType();postResource=raw==="document"||raw==="fetch"||raw==="xhr"?raw:typeof raw==="string"?"other":"unavailable";}catch{/* No resource value is inferred. */}authPostRequests.set(request,Object.freeze({operation:u.pathname==="/entrar"?"login":u.pathname==="/trocar-senha"?"password":"other",resource:postResource}));} const counts=observedAuthPosts.get(c) ?? new Map<string,number>(); counts.set(u.pathname,(counts.get(u.pathname) ?? 0)+1); observedAuthPosts.set(c,counts); state.count(u.pathname === "/entrar" ? "loginPosts" : "passwordPosts"); } } catch { state.fail("REQUEST_REFUSED"); } });
      c.on("requestfinished",request=>{protocolObserver.terminal(request,"finished");liveRequests.delete(request);nonReadRequests.delete(request);});
      c.on("requestfailed", request => { protocolObserver.terminal(request,"failed");liveRequests.delete(request);nonReadRequests.delete(request); try { if (isAdminAuthActionRequest(request.url(),request.method())) { let failureText:unknown;try{failureText=request.failure()?.errorText;}catch{/* No provider error is retained. */}const scope=authEffects.get(c);let candidate=!!scope&&!scope.receipt&&!scope.failedRequest&&scope.observation.owns(request)&&authAbortEligibility.get(request)===true&&failureText==="net::ERR_ABORTED"&&request.frame()===scope.page.mainFrame()&&request.frame().page()===scope.page&&!state.value.writeOutcomeUncertain;if(candidate)try{state.active();}catch{candidate=false;}if(candidate&&scope){scope.failedRequest=request;scope.failure=postFailureSnapshot(request,failureText);}else{const beforeCode=state.value.code;state.unknown();state.fail("TRANSPORT_FAILED");if(beforeCode!=="TRANSPORT_FAILED"&&state.value.code==="TRANSPORT_FAILED"&&state.value.authPostFailure==null)state.value.authPostFailure=postFailureSnapshot(request,failureText);} } } catch { state.unknown();state.fail("REQUEST_REFUSED"); } });
      c.on("response",response=>{try { const request=response.request(),observed=liveRequests.get(request);if(observed)liveRequests.set(request,{...observed,responseSeen:true});if(observed)nextStop.replace(request,observed,liveRequests.get(request));const accepted=acceptAdminBrowserRequest(response.url(),request.method())&&response.url()===request.url();if(!accepted)state.fail("REQUEST_REFUSED");if(accepted&&observed&&authPostRequests.has(request)&&!authPostResponses.has(request)){let contentType:AdminAuthPostFailure["contentType"]="other";try{const type=response.headers()["content-type"];if(typeof type==="string")contentType=/^text\/x-component(?:\s*;|$)/i.test(type)?"flight":/^text\/html(?:\s*;|$)/i.test(type)?"html":"other";}catch{/* Metadata only, never a header value or body. */}let responseClass:AdminAuthPostFailure["response"]="other",eligible=false;try{const status=response.status();responseClass=status===200?"200":status===303?"303":"other";}catch{/* No provider error is retained. */}try{const scope=authEffects.get(c),headers=response.headers();eligible=!!scope&&scope.observation.owns(request)&&responseClass==="303"&&headers.location===undefined&&headers["x-action-redirect"]===(scope.operation==="login-forced"?"/trocar-senha;push":"/ajuda;push");}catch{/* Unavailable headers cannot qualify an aborted candidate. */}authPostResponses.set(request,Object.freeze({response:responseClass,contentType}));authAbortEligibility.set(request,eligible);} } catch { state.fail("REQUEST_REFUSED"); }});
      const page = await safe(() => c.newPage());protocolObserver.observePage(page);
      page.on("download", () => state.fail("BROWSER_REFUSED"));
      page.on("popup", () => state.fail("BROWSER_REFUSED"));
      return { c, page };
    };
    const post = async (page:Page,path:string, action:()=>Promise<void>):Promise<BrowserResponse> => { const effect=authEffects.get(page.context());if(effect){state.active();if(state.value.writeOutcomeUncertain||nonReadRequests.size){state.unknown();state.fail("WRITE_OUTCOME_UNCERTAIN");adminBrowserRefuse("WRITE_OUTCOME_UNCERTAIN");}const pending=adminBrowserPendingCode({...pendingBrowserIo(),hmrGet:0});if(pending){const code=pending==="QUIESCENCE_HTTP_PENDING"?pendingHttpCode():pending;state.fail(code);adminBrowserRefuse(code);}}else await finiteReads(); const before=authPosts(page.context(),path), observed=()=>authPosts(page.context(),path)>before; const result=await safe(async () => {
      pendingUi++; let response:BrowserResponse;
      let matchedRequest:BrowserRequest|null=null;
      try { if(effect){
        if(effect.page!==page||path!=="/entrar"||effect.receipt)adminBrowserRefuse("TRANSPORT_FAILED");
        const results=await Promise.allSettled([safe(()=>page.waitForResponse(r=>{try{if(matchedRequest!==null||new URL(r.url()).pathname!==path||!isAdminAuthActionRequest(r.url(),r.request().method()))return false;matchedRequest=r.request();return true;}catch{return false;}},{timeout:20000})),safe(action)]);
        if(results[0].status!=="fulfilled"||results[1].status!=="fulfilled")adminBrowserRefuse("TRANSPORT_FAILED");response=results[0].value;
        if(response.request()!==matchedRequest||!acceptAdminAuthActionResponse(response.url(),response.request().method(),response.status()))adminBrowserRefuse("TRANSPORT_FAILED");
        const receipt=await safe(()=>effect.observation.observe(response.request(),response));if(receipt.status!=="observed")adminBrowserRefuse("TRANSPORT_FAILED");effect.receipt=receipt;
        if(receipt.transport==="finished"&&await safe(()=>response.finished())!==null)adminBrowserRefuse("TRANSPORT_FAILED");state.active();return response;
      }const results = await Promise.allSettled([
        safe(()=>page.waitForEvent("requestfinished",{predicate:request=>matchedRequest!==null&&request===matchedRequest,timeout:20000})),
        safe(()=>page.waitForResponse(r => {try{if(matchedRequest!==null||new URL(r.url()).pathname!==path||!isAdminAuthActionRequest(r.url(),r.request().method()))return false;matchedRequest=r.request();return true;}catch{return false;}}, { timeout:20000 })),
        safe(action)
      ]); if(results[0].status!=="fulfilled"||results[1].status!=="fulfilled"||results[2].status!=="fulfilled") adminBrowserRefuse("TRANSPORT_FAILED"); response = results[1].value; if (results[0].value!==matchedRequest||response.request()!==matchedRequest||!acceptAdminAuthActionResponse(response.url(),response.request().method(),response.status()) || await safe(()=>response.finished()) !== null) adminBrowserRefuse("TRANSPORT_FAILED"); state.active(); return response; }
      catch { if(observed()) state.unknown(); adminBrowserRefuse("TRANSPORT_FAILED"); } finally { pendingUi--; }
    }); await runAdminAuthCheckpoint(state,"AUTH_POST_REFUSED",finiteReads,observed); return result; };
    const hint = async (c:BrowserContext, owner:AdminBrowserOwner) => {
      const cookies = await safe(() => c.cookies(ADMIN_BROWSER_APP)); const auth = cookies.filter(k => k.name === "sc-auth" || /^sc-auth\.[0-9]+$/.test(k.name));
      if (!auth.length || auth.some(k => !k.httpOnly || k.sameSite !== "Lax" || k.path !== "/")) adminBrowserRefuse("AUTH_NOT_PROVEN");
      return safe(async () => sessionFromCookies(auth, owner.id));
    };
    const login = async (actor:{c:BrowserContext;page:Page},owner:AdminBrowserOwner,password:string, expected:"user"|"forced"|"denied"):Promise<Awaited<ReturnType<typeof harness.verifySession>>|null> => {
      const checkpoint=runAdminAuthCheckpoint, before=authPosts(actor.c,"/entrar"), observed=()=>authPosts(actor.c,"/entrar")>before;
      await checkpoint(state,"AUTH_DOCUMENT_REFUSED",()=>goto(actor.page,"/entrar?returnTo=%2Fajuda"));
      await checkpoint(state,"AUTH_FORM_REFUSED",async()=>{ await visible(actor.page,"form.auth-form"); await safe(() => actor.page.locator('input[name="email"]').fill(owner.email)); await safe(() => actor.page.locator('input[name="password"]').fill(password)); });
      if (expected === "denied") {
        await checkpoint(state,"AUTH_POST_REFUSED",()=>post(actor.page,"/entrar", () => actor.page.locator('form.auth-form button[type="submit"]').click({ timeout:20000 })),observed);
        await checkpoint(state,"AUTH_READY_REFUSED",()=>visible(actor.page,'.auth-feedback[role="alert"]'),observed);
        await checkpoint(state,"AUTH_SESSION_REFUSED",async()=>{ if ((await safe(() => actor.c.cookies(ADMIN_BROWSER_APP))).some(k => /^sc-auth(?:\.|$)/.test(k.name))) adminBrowserRefuse("AUTH_NOT_PROVEN"); },observed);
        return null;
      }
      await finiteReads();const knownSids=new Set(harness.sessions.map(session=>session.sessionId));
      const operation=expected==="forced"?"login-forced":"login-help",observation=await safe(()=>prepareAuthEffectObservation({page:actor.page,operation,prerequisite:async()=>!(await safe(()=>actor.c.cookies(ADMIN_BROWSER_APP))).some(cookie=>/^sc-auth(?:[.-]|$)/.test(cookie.name)||/^sc-flow-(?:request|recovery|password)$/.test(cookie.name))})),ledger=createAuthEffectLedger();
      const scope:AuthScope={page:actor.page,operation,observation,receipt:null,failedRequest:null,failure:null};
      if(authEffects.has(actor.c)||ledger.begin(operation).status!=="armed"){observation.dispose();state.unknown();adminBrowserRefuse("AUTH_NOT_PROVEN");}
      authEffects.set(actor.c,scope);pendingAuthEffects.add(scope);
      try{
        await checkpoint(state,"AUTH_POST_REFUSED",()=>post(actor.page,"/entrar",()=>actor.page.locator('form.auth-form button[type="submit"]').click({timeout:20000})),observed);
        if(!scope.receipt)adminBrowserRefuse("AUTH_NOT_PROVEN");let verified:Awaited<ReturnType<typeof harness.verifySession>>|null=null;
        const oracles={
          destination:async()=>{await checkpoint(state,"AUTH_DESTINATION_REFUSED",()=>destination(actor.page,expected==="forced"?"/trocar-senha":"/ajuda"),observed);await checkpoint(state,"AUTH_READY_REFUSED",()=>visible(actor.page,expected==="forced"?"form.auth-form":".shell-help"),observed);return true;},
          newSessionIdentityAndAccess:async()=>{await checkpoint(state,"AUTH_SESSION_REFUSED",async()=>{const candidate=await hint(actor.c,owner);if(knownSids.has(candidate.sessionId))adminBrowserRefuse("AUTH_NOT_PROVEN");if(await safe(()=>actor.page.evaluate(()=>document.cookie.split(";").some(k=>/^\s*sc-auth(?:\.|=)/.test(k)))))adminBrowserRefuse("AUTH_NOT_PROVEN");verified=await harness.verifySession(owner,candidate,expected);},observed);return true;},
          protectedSameSession:async()=>{if(!verified)return false;const prior=verified;await finiteReads();const response=await safe(()=>actor.page.reload({waitUntil:"load",timeout:30000}));if(!response||response.status()!==200||!(response.headers()["cache-control"]??"").includes("no-store"))return false;await destination(actor.page,expected==="forced"?"/trocar-senha":"/ajuda");await visible(actor.page,expected==="forced"?"form.auth-form":".shell-help");const current=await hint(actor.c,owner);return current.sessionId===prior.sessionId&&current.accessToken===prior.accessToken;}
        };
        const known=expected==="forced"?await ledger.confirmForcedLogin(scope.receipt,{...oracles,deniedModule:async()=>{state.count("apiProbes");await httpProbe(actor.c,"/api/projects-habits?domain=projects","GET",null,owner.id,403);return true;}}):await ledger.confirmHelpLogin(scope.receipt,oracles);
        if(known.status!=="known"||known.operation!==operation||!ledger.cleanupMayProceed(state.value.writeOutcomeUncertain))adminBrowserRefuse("AUTH_NOT_PROVEN");state.active();pendingAuthEffects.delete(scope);return verified;
      }catch{state.unknown();const prior=state.value.code;state.fail(scope.failedRequest?"TRANSPORT_FAILED":"AUTH_NOT_PROVEN");if(scope.failedRequest&&prior!=="TRANSPORT_FAILED"&&state.value.code==="TRANSPORT_FAILED"&&state.value.authPostFailure==null)state.value.authPostFailure=scope.failure;adminBrowserRefuse(state.value.code);}
      finally{observation.dispose();ledger.dispose();authEffects.delete(actor.c);}
    };
    const httpProbe = async (c:BrowserContext,path:string,method:string,body:Readonly<Record<string,unknown>>|null,id:string,status:number) => safe(async () => {
      state.active(); pendingUi++;
      try { let cookies:Awaited<ReturnType<BrowserContext["cookies"]>>;try{cookies=await safe(()=>c.cookies(ADMIN_BROWSER_APP));}catch{const before=state.value.code;state.fail("REQUEST_REFUSED");if(before!=="REQUEST_REFUSED"&&state.value.code==="REQUEST_REFUSED"&&state.value.nextProbeRefusal==null)state.value.nextProbeRefusal="cookies-unavailable";adminBrowserRefuse("REQUEST_REFUSED");}const r = await harness.nextIo.request({path,method,body,userId:id,cookies});
        const bytes=r.bytes;try {
          const operation:AdminHttpProbeFailure["operation"]=method==="GET"&&path==="/api/capture-tasks?query=captures"?"capture-read":method==="GET"&&path==="/api/capture-tasks?query=tasks"?"tasks-read":method==="GET"&&path==="/api/settings"?"settings-read":method==="POST"&&path==="/api/settings"?"settings-write":method==="GET"&&path==="/api/projects-habits?domain=projects"?"projects-read":"other";
          const responseStatus:AdminHttpProbeFailure["status"]=r.status===200?"200":r.status===401?"401":r.status===403?"403":r.status===409?"409":r.status===429?"429":r.status===500?"500":r.status===503?"503":"other",cache:AdminHttpProbeFailure["cache"]=r.cacheControl?.includes("no-store")?"no-store":"other",contentType:AdminHttpProbeFailure["contentType"]=r.contentType?.includes("application/json")?"json":/^text\/html(?:\s*;|$)/i.test(r.contentType??"")?"html":"other";let json:AdminHttpProbeFailure["json"]="not-read";
          const refuse=()=>{const before=state.value.code;state.fail("AUTH_NOT_PROVEN");if(before!=="AUTH_NOT_PROVEN"&&state.value.code==="AUTH_NOT_PROVEN"&&state.value.httpProbeFailure==null)state.value.httpProbeFailure=Object.freeze({operation,status:responseStatus,cache,contentType,json});adminBrowserRefuse("AUTH_NOT_PROVEN");};
          if(r.status!==status||!r.cacheControl?.includes("no-store")||!r.contentType?.includes("application/json"))refuse();let value:unknown;try{value=JSON.parse(bytes.toString("utf8"));}catch{json="invalid";refuse();}if(!acceptsAdminBrowserDenial(path,status,value)){json="refused";refuse();}
        } finally { bytes.fill(0); }
      } finally { pendingUi--; }
    });
    const ownApi = async (c:BrowserContext,ownerId:string,expected:AdminOwnSessionsView|null) => safe(async()=>{
      const r=await harness.nextIo.request({path:"/api/settings/sessions",method:"GET",body:null,userId:ownerId,cookies:await safe(()=>c.cookies(ADMIN_BROWSER_APP))});
      try{
        if(r.bytes.length>65536||!r.cacheControl?.includes("no-store")||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(r.contentType??""))adminBrowserRefuse("AUTH_NOT_PROVEN");
        const value:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(r.bytes));
        if(expected){if(r.status!==200)adminBrowserRefuse("AUTH_NOT_PROVEN");acceptAdminOwnSessionsView(value,expected);}
        else if(!acceptsAdminOwnSessionsChanged(r.status,value))adminBrowserRefuse("AUTH_NOT_PROVEN");
      }finally{r.bytes.fill(0);}
    });
    const ownView = async (actor:{c:BrowserContext;page:Page},owner:AdminBrowserOwner,expected:AdminOwnSessionsView,reload=false) => {
      await finiteReads();
      const received=safe(()=>actor.page.waitForResponse(r=>r.url()===ADMIN_BROWSER_APP+"/api/settings/sessions"&&r.request().method()==="GET",{timeout:20000}));
      const action=reload?async()=>{await finiteReads();await actor.page.locator("#sessoes .own-sessions-toolbar button").click({timeout:20000});}:()=>goto(actor.page,"/configuracoes");
      const settled=await Promise.allSettled([received,safe(action)]);
      if(settled[0].status!=="fulfilled"||settled[1].status!=="fulfilled")adminBrowserRefuse("AUTH_NOT_PROVEN");
      const response=settled[0].value;
      await safe(async()=>{
        if(response.status()!==200||await response.finished()!==null||!(await response.headerValue("cache-control"))?.includes("no-store")||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(await response.headerValue("content-type")??"")||await response.request().headerValue("x-expected-user-id")!==owner.id)adminBrowserRefuse("AUTH_NOT_PROVEN");
      });
      await destination(actor.page,"/configuracoes");
      await truth(()=>actor.page.locator("#sessoes").evaluateAll((nodes,view)=>{
        if(nodes.length!==1||!(nodes[0] instanceof HTMLElement)||!nodes[0].getClientRects().length)return false;
        const section=nodes[0],lists=section.querySelectorAll('ul[aria-label="Sessões cadastradas"]');
        if(lists.length!==1||section.querySelector('[role="alert"], [aria-busy="true"]')||section.querySelectorAll('a[href="/trocar-senha"]').length!==1)return false;
        const privatePattern=/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|access_token|refresh_token|session_id|not_after|sb_secret_/i;
        if(privatePattern.test(section.textContent??"")||[section,...section.querySelectorAll("*")].some(n=>n.getAttributeNames().some(a=>privatePattern.test(n.getAttribute(a)??""))))return false;
        const rows=lists[0]!.querySelectorAll("li"),buttons=section.querySelectorAll(".own-sessions-toolbar button");
        if(rows.length!==view.sessions.length||buttons.length!==1||buttons[0]?.textContent!=="Atualizar sessões"||buttons[0] instanceof HTMLButtonElement&&buttons[0].disabled)return false;
        return [...rows].every((row,i)=>{const data=view.sessions[i]!,labels=row.querySelectorAll("strong"),terms=row.querySelectorAll("dt"),values=row.querySelectorAll("dd");
          if(labels.length!==1||labels[0]?.textContent!==(data.isCurrent?"Esta sessão":"Outra sessão")||terms.length!==2||terms[0]?.textContent!=="Criada em"||terms[1]?.textContent!=="Última renovação"||values.length!==2)return false;
          return [data.createdAt,data.refreshedAt].every((value,j)=>value===null?values[j]?.textContent===(j===0?"Data indisponível":"Renovação não informada"):values[j]?.querySelectorAll("time").length===1&&values[j]?.querySelector("time")?.getAttribute("datetime")===value);
        });
      },expected));
      state.count("ownSessionsViews");if(reload)state.count("ownSessionsReloads");
    };
    const closeContexts = async () => {
      let quietBeforeClose=false, closeConfirmed=true, failure:string|null=null;
      const stopSessions=new Set<CDPSession>(),stopAckPages=new WeakSet<Page>(),stopAckRequests=new WeakSet<object>(),enumeratedPages=new WeakSet<Page>();let deadlineMs:number|null=null,previousAt=0,detailObserved=false;
      const failQuiescence=(code:string,phase:AdminQuiescenceDetail["phase"])=>{
        const first=!detailObserved&&(code==="QUIESCENCE_HTTP_PENDING"||ADMIN_HTTP_PENDING_CODES.some(value=>value===code));let snapshot:AdminQuiescenceDetail|null=null;
        const stopDiagnostic=first?nextStop.snapshot():null;
        if(first){detailObserved=true;try{const observations=[...liveRequests.entries()].filter(([,row])=>row.kind==="otherHttp").map(([request,row])=>({...row.observation,request}));if(observations.length){
          const merge=<T extends string>(values:readonly T[]):T|"mixed"=>values.every(value=>value===values[0])?values[0]!:"mixed";
          snapshot=Object.freeze({phase,pathClass:merge(observations.map(row=>row.pathClass)),resource:merge(observations.map(row=>row.resource)),frame:merge(observations.map(row=>row.frame)),stopAck:merge(observations.map(row=>row.page===null?"unobserved":!enumeratedPages.has(row.page)?"not-enumerated":stopAckPages.has(row.page)&&stopAckRequests.has(row.request)?"owned-page":"unobserved")),...requestOrigins.snapshot(observations.map(row=>row.request)),protocol:protocolObserver.snapshot(observations.map(row=>row.request))});
        }}catch{/* Missing observation is null, never fabricated or backfilled. */}}
        state.fail(code);if(first&&state.value.code===code){state.value.quiescenceDetail=snapshot;state.value.nextStopDiagnostic=stopDiagnostic;}
      };
      const releaseBarrier=()=>{state.active();const m=harness.metadata(),code=adminBrowserPageReleaseCode({ui:pendingUi+uiOperations.size,sdk:m.pendingRequests,sql:pendingSql+m.pendingInspections,nonRead:nonReadRequests.size,unknown:state.value.writeOutcomeUncertain||pendingAuthEffects.size>0});if(code){if(code==="WRITE_OUTCOME_UNCERTAIN")state.unknown();state.fail(code);adminBrowserRefuse(code);}};
      const remaining=()=>{releaseBarrier();if(routeSealed){const pending=adminBrowserPendingCode(pendingBrowserIo());if(pending){state.fail(pending);adminBrowserRefuse(pending);}}const at=performance.now();if(deadlineMs===null||!Number.isFinite(at)||at<previousAt||at>=deadlineMs)adminBrowserRefuse("PROCESS_UNCONFIRMED");previousAt=at;return Math.max(1,Math.floor(deadlineMs-at));};
      // The manual session does not replace Playwright's network observers.
      // Its detach remains owned even after a prior refusal; no retry is made.
      const detachStopSession=async(session:CDPSession)=>{const owned=guard(()=>session.detach(),"PROCESS_UNCONFIRMED").finally(()=>uiOperations.delete(owned));uiOperations.add(owned);try{await owned;}finally{stopSessions.delete(session);}};
      try {
        if(state.value.stages.at(-1)?.stage!=="actor-intact"||state.value.stages.at(-1)?.passed!==true)adminBrowserRefuse("PROCESS_UNCONFIRMED");
        releaseBarrier();parkingPages=true;for(const fence of routeFences)fence.arm();
        previousAt=performance.now();if(!Number.isFinite(previousAt))adminBrowserRefuse("PROCESS_UNCONFIRMED");deadlineMs=previousAt+15000;
        // Keep the context online and the original route installed. The fence
        // only narrows the existing read authority after every effect is known.
        const pages=contexts.flatMap(c=>c.pages());for(const page of pages)enumeratedPages.add(page);
        for(const page of pages){remaining();const session=await safe(async()=>{const attached=await page.context().newCDPSession(page);stopSessions.add(attached);return attached;},"PROCESS_UNCONFIRMED");remaining();const present=[...liveRequests.entries()].filter(([,row])=>row.observation.page===page).map(([request])=>request);await safe(()=>session.send("Page.stopLoading"),"PROCESS_UNCONFIRMED");stopAckPages.add(page);for(const request of present)stopAckRequests.add(request);remaining();}
        // Keep the write barrier while leaving the document. Stop or navigation
        // ACKs do not replace the full terminal-event check below.
        for(const page of pages){const timeout=remaining();await safe(()=>page.goto("about:blank",{waitUntil:"domcontentloaded",timeout}),"PROCESS_UNCONFIRMED");remaining();}
        // Do not remove the guard before the original requests AND all handler
        // promises settle. Context disposal owns its eventual removal.
        // stopLoading and blank ACKs are not terminal network events. Observe
        // full zero before disposing any Page or primary Chromium session.
        if(nextStop.request(deadlineMs,previousAt)==="REFUSED")adminBrowserRefuse("PROCESS_UNCONFIRMED");
        failure=await waitForAdminBrowserIoQuiet(pendingBrowserIo,{deadlineMs});if(failure==="QUIESCENCE_HTTP_PENDING")failure=pendingHttpCode();if(failure)failQuiescence(failure,"after-blank");
        if(failure)adminBrowserRefuse(failure);remaining();routeSealed=true;remaining();
        for(const session of stopSessions){remaining();await detachStopSession(session);remaining();}
        for(const page of pages){remaining();await safe(()=>page.close({runBeforeUnload:false}),"PROCESS_UNCONFIRMED");remaining();}
        releaseBarrier();quietBeforeClose=true;
      }
      catch { quietBeforeClose=false;failure??="PROCESS_UNCONFIRMED";state.fail(failure); }
      finally { contextsCloseAttempted=true; try{for(const session of stopSessions){try{await detachStopSession(session);}catch{closeConfirmed=false;failure??="PROCESS_UNCONFIRMED";state.fail("PROCESS_UNCONFIRMED");}}for(const c of contexts) { try { await guard(()=>c.close()); } catch { closeConfirmed=false; failure??="PROCESS_UNCONFIRMED"; state.fail("PROCESS_UNCONFIRMED"); } }}finally{parkingPages=false;} }
      await Promise.allSettled([...uiOperations]);
      if(deadlineMs!==null){const at=performance.now();if(!Number.isFinite(at)||at<previousAt||at>=deadlineMs){quietBeforeClose=false;failure??="PROCESS_UNCONFIRMED";state.fail("PROCESS_UNCONFIRMED");}}
      let afterClose=adminBrowserPendingCode(pendingBrowserIo());if(afterClose==="QUIESCENCE_HTTP_PENDING")afterClose=pendingHttpCode(); if(afterClose){failure??=afterClose;failQuiescence(afterClose,"after-close");}
      contextsClosed=quietBeforeClose&&closeConfirmed&&afterClose===null&&!routeVeto&&routeOperations.size===0&&uiOperations.size===0&&liveRequests.size===0&&nonReadRequests.size===0&&!pendingUi&&!pendingSql&&!state.value.writeOutcomeUncertain&&!pendingAuthEffects.size;
      if(!contextsClosed)adminBrowserRefuse(failure??"PROCESS_UNCONFIRMED");
    };
    try {
      await harness.ordinaryFixture(); if (kind === "BLOCK_LIVE_BROWSER") await harness.ordinaryFixture(); state.stage("fixtures");
      const a = await makeContext(); await login(a,harness.owners[0]!,harness.owners[0]!.password,"user");
      if (kind === "BLOCK_LIVE_BROWSER") {
        const b1 = await makeContext(), b2 = await makeContext(), target = harness.owners[1]!;
        const s1 = await login(b1,target,target.password,"user"), s2 = await login(b2,target,target.password,"user");
        if (!s1 || !s2 || s1.sessionId === s2.sessionId) adminBrowserRefuse("AUTH_NOT_PROVEN"); state.stage("browser-bound");
        await harness.bootstrap(); state.stage("master-bound");
        for(const [actor,session] of [[b1,s1],[b2,s2]] as const){const view=await harness.ownSessions(session);await ownApi(actor.c,target.id,view);await ownView(actor,target,view);await goto(actor.page,"/ajuda");await visible(actor.page,".shell-help");}state.stage("own-sessions-bound");
        await harness.runAdmin();
        const terminal = await harness.inspect("ACCESS_DENIED");
        await finiteReads(); await safe(() => b1.page.locator('a.shell-inline-link[href="/configuracoes"]').click({timeout:20000}));
        await destination(b1.page,"/entrar?notice=session-required"); await visible(b1.page,"form.auth-form");
        await goto(b2.page,"/trocar-senha"); await destination(b2.page,"/entrar?notice=session-required"); await visible(b2.page,"form.auth-form");
        await harness.deniedToken(s1); await harness.deniedToken(s2);
        await httpProbe(b1.c,"/api/capture-tasks?query=captures","GET",null,target.id,401);
        await httpProbe(b2.c,"/api/capture-tasks?query=captures","GET",null,target.id,401);
        for(const actor of[b1,b2]){state.count("apiProbes");await httpProbe(actor.c,"/api/settings/sessions","GET",null,target.id,401);}
        const unchanged = await harness.inspect("UNCHANGED"); if (!same(terminal,unchanged)) adminBrowserRefuse("SAGA_NOT_PROVEN"); state.stage("live-sessions-denied");
      } else {
        state.stage("browser-bound"); await harness.bootstrap(); state.stage("master-bound");
        const target = await harness.runAdmin(), c = await makeContext();
        const old = await login(c,target,target.password,"forced"); if (!old) adminBrowserRefuse("AUTH_NOT_PROVEN");
        const before = await harness.inspect("ACCESS_DENIED"); if (!before.sessions.some(s => s.id === old.sessionId && s.user_id === target.id)) adminBrowserRefuse("AUTH_NOT_PROVEN"); state.stage("forced-login");
        for (const path of ADMIN_BROWSER_PAGES) { state.count("pageProbes"); await goto(c.page,path); await destination(c.page,"/trocar-senha"); await visible(c.page,"form.auth-form"); }
        // Original RSC guard: inspect only a bounded closed redirect predicate.
        await safe(async () => { const r = await harness.nextIo.request({path:"/ajuda?_rsc=adminbrowser",method:"GET",body:null,userId:target.id,cookies:await safe(()=>c.c.cookies(ADMIN_BROWSER_APP))}); try { const redirected = [303,307,308].includes(r.status) && r.location === "/trocar-senha" || r.status === 200 && r.bytes.toString("utf8").includes("NEXT_REDIRECT;replace;/trocar-senha;"); if (!redirected) adminBrowserRefuse("AUTH_NOT_PROVEN"); } finally { r.bytes.fill(0); } }); state.stage("pages-denied");
        for (const probe of ADMIN_BROWSER_PROBES) { state.count("apiProbes"); await httpProbe(c.c,probe.path,probe.method,probe.body,target.id,403); }
        await safe(async () => { const r = await harness.nextIo.request({path:"/api/calendar/oauth/callback?error=access_denied",method:"GET",body:null,userId:target.id,cookies:await safe(()=>c.c.cookies(ADMIN_BROWSER_APP))}); try { if (r.status !== 303 || r.location !== ADMIN_BROWSER_APP + "/calendario?notice=connection-failed") adminBrowserRefuse("AUTH_NOT_PROVEN"); } finally { r.bytes.fill(0); } });
        await safe(async () => { const r = await harness.nextIo.request({path:"/api/monitoring",method:"POST",body:{},userId:target.id,cookies:await safe(()=>c.c.cookies(ADMIN_BROWSER_APP))}); try { if (r.status !== 204 || r.bytes.length) adminBrowserRefuse("AUTH_NOT_PROVEN"); } finally { r.bytes.fill(0); } });
        if (!same(before,await harness.inspect("UNCHANGED"))) adminBrowserRefuse("SAGA_NOT_PROVEN"); state.stage("apis-denied");
        await goto(c.page,"/trocar-senha"); const nextPassword = randomBytes(24).toString("base64url") + "-Aa1!";
        await visible(c.page,"form.auth-form");
        await safe(() => c.page.locator('input[name="currentPassword"]').fill(target.password));
        await safe(() => c.page.locator('input[name="password"]').fill(nextPassword));
        await safe(() => c.page.locator('input[name="confirmPassword"]').fill(nextPassword));
        await post(c.page,"/trocar-senha", () => c.page.locator('form.auth-form button[type="submit"]').click({timeout:20000}));
        await destination(c.page,"/entrar?notice=password-updated"); await visible(c.page,'.auth-feedback[role="status"]');
        if ((await safe(() => c.c.cookies(ADMIN_BROWSER_APP))).some(k => /^sc-auth(?:\.|$)/.test(k.name) || /^sc-flow-(?:request|recovery|password)$/.test(k.name))) adminBrowserRefuse("AUTH_NOT_PROVEN");
        const reauthSid = await harness.passwordProof(target,old); state.stage("password-terminal");
        await login(c,target,target.password,"denied"); const fresh = await login(c,target,nextPassword,"user");
        if (!fresh || fresh.sessionId === old.sessionId || fresh.sessionId === reauthSid || harness.sessions.slice(0,-1).some(s => s.sessionId === fresh.sessionId)) adminBrowserRefuse("AUTH_NOT_PROVEN");
        const after = await harness.inspect("CREDENTIALS_CHANGED"); if (after.sessions.filter(s => s.user_id === target.id).length !== 1 || !after.sessions.some(s => s.id === fresh.sessionId)) adminBrowserRefuse("AUTH_NOT_PROVEN"); state.stage("credentials-changed");
        const own=await harness.ownSessions(fresh);await ownApi(c.c,target.id,own);await ownView(c,target,own);await ownView(c,target,own,true);
        const master=harness.owners[0]!;if(!master.current)adminBrowserRefuse("AUTH_NOT_PROVEN");const masterOwn=await harness.ownSessions(master.current);
        await ownApi(a.c,master.id,masterOwn);await ownView(a,master,masterOwn);await ownApi(c.c,master.id,null);state.stage("own-sessions-bound");
      }
      await goto(a.page,"/ajuda"); await visible(a.page,".shell-help"); const aOwner = harness.owners[0]!, aHint = await hint(a.c,aOwner);
      if (aHint.sessionId !== aOwner.current?.sessionId) adminBrowserRefuse("AUTH_NOT_PROVEN"); await harness.verifySession(aOwner,aHint,"master"); state.stage("actor-intact");
      await closeContexts(); await harness.cleanup(); state.stage("contexts-closed");
    } catch (error) { state.fail(error instanceof Error ? error.message : "BROWSER_REFUSED"); }
    finally {
      if (!contextsClosed && !contextsCloseAttempted) { try { await closeContexts(); } catch { state.fail("PROCESS_UNCONFIRMED"); } }
      protocolObserver.dispose();await harness.dispose(); const meta = harness.metadata();
      const report = validateAdminBrowserCase(state.finish(meta.pendingRequests + pendingUi + uiOperations.size + routeOperations.size + liveRequests.size + pendingAuthEffects.size,meta.pendingInspections + pendingSql));
      await guard(() => writeFile(context.reportPath,JSON.stringify(report),{flag:"wx",mode:0o600}),"REPORT_REFUSED");
      if (report.status !== "passed") adminBrowserRefuse(report.code);
    }
  });
}
