// Real Next/Auth/browser in the dedicated Linux job. No Locator -> expect:
// installed Frame.expect can snapshot the whole body on a failing matcher.
import { test, expect, type BrowserContext, type CDPSession, type Page, type Response as BrowserResponse } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
// Shared JavaScript lifecycle has no declaration file; its result is checked
// as unknown at the caller boundary below, rather than trusted by a type cast.
// @ts-expect-error Existing reviewed JS lifecycle, unchanged by this delivery.
import { runBoundedProcess, localPsqlEnvironment } from "../../scripts/verification/auth-local-ci.mjs";
import { sessionFromCookies } from "./support";
import { ADMIN_BROWSER_APP, ADMIN_BROWSER_PAGES, ADMIN_BROWSER_PROBES, acceptAdminBrowserRequest, acceptsAdminBrowserDenial, acceptAdminOwnSessionsView, acceptsAdminOwnSessionsChanged, adminBrowserEnvironment, adminBrowserRefuse, closedBrowserOperation, createAdminBrowserHarness, isAdminCanonicalHmrGet, classifyAdminBrowserHttpRequest, adminBrowserHttpPendingCode, isAdminBrowserReadCancellationRequest, isAdminBrowserParkableAuthRead, adminBrowserPreParkPending, adminBrowserPageReleaseCode, adminBrowserPendingCode, waitForAdminBrowserIoQuiet, waitForAdminBrowserHttpQuiet, type AdminBrowserOwner, type AdminOwnSessionsView } from "./admin-browser-support.mjs";
import { validateAdminBrowserCase, isAdminAuthActionRequest, acceptAdminAuthActionResponse, runAdminAuthCheckpoint } from "./admin-browser-contract.mjs";

process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
test.describe.configure({ mode: "serial" });
test.use({ trace: "off", screenshot: "off", video: "off", acceptDownloads: false, serviceWorkers: "block" });
const guard = closedBrowserOperation;
const same = (a:unknown,b:unknown) => JSON.stringify(a) === JSON.stringify(b);

for (const kind of ["BLOCK_LIVE_BROWSER", "FIRST_FORCED_BROWSER"] as const) {
  test(kind, async ({ browser }) => {
    const context = adminBrowserEnvironment(process.env);
    if (context.case !== kind) adminBrowserRefuse("ENVIRONMENT_REFUSED");
    let pendingSql = 0, pendingUi = 0, contextsClosed = false, contextsCloseAttempted = false, parkingPages = false;
    const contexts: BrowserContext[] = [];
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
    const uiOperations = new Set<Promise<unknown>>(), liveRequests = new Map<object,{kind:"hmrGet"|"otherHttp";httpClass:ReturnType<typeof classifyAdminBrowserHttpRequest>;responseSeen:boolean;parkableAuthRead:boolean}>(), nonReadRequests = new Set<object>();
    const pendingBrowserIo = () => ({ ui:uiOperations.size, hmrGet:[...liveRequests.values()].filter(entry=>entry.kind==="hmrGet").length, otherHttp:[...liveRequests.values()].filter(entry=>entry.kind==="otherHttp").length });
    const pendingBrowserPreParkIo=()=>adminBrowserPreParkPending({...pendingBrowserIo(),parkableAuthRead:[...liveRequests.values()].filter(entry=>entry.kind==="otherHttp"&&entry.parkableAuthRead).length});
    const pendingHttpCode=()=>adminBrowserHttpPendingCode([...liveRequests.values()].filter(entry=>entry.kind==="otherHttp").map(({httpClass,responseSeen})=>({httpClass,responseSeen})));
    const observedAuthPosts = new WeakMap<BrowserContext,Map<string,number>>();
    const authPosts = (c:BrowserContext,path:string) => observedAuthPosts.get(c)?.get(path) ?? 0;
    const harness = await createAdminBrowserHarness(context, { query: input => sql(input,true), write: async input => { try { await sql(input,false); } catch { harness.state.unknown(); adminBrowserRefuse("SQL_REFUSED"); } }, cleanupAllowed: () => contextsClosed && !pendingUi && !pendingSql && !uiOperations.size && !liveRequests.size && !nonReadRequests.size });
    const state = harness.state;
    // Keep each actual action/response promise owned until settlement, including
    // the other branch of a failed form submission. Only closed errors escape.
    const safe = async <T>(operation:()=>Promise<T>,code="BROWSER_REFUSED"):Promise<T> => {
      state.active(); const owned=guard(operation,code).finally(()=>uiOperations.delete(owned)); uiOperations.add(owned);
      try { const value=await owned; state.active(); return value; } catch { adminBrowserRefuse(code); }
    };
    // poll sees only a primitive; evaluation/action exceptions lose provider,
    // DOM, cookie and argument details before reaching Playwright assertions.
    const truth = async (read:()=>Promise<boolean>) => { await safe(() => expect.poll(async () => { try { state.active(); return await read() === true; } catch { return false; } }, { timeout: 20000, intervals: [50,100,250] }).toBe(true)); };
    const visible = (page:Page, selector:string) => truth(() => page.locator(selector).evaluateAll(nodes => nodes.length === 1 && nodes[0] instanceof HTMLElement && !!nodes[0].getClientRects().length));
    const destination = (page:Page, path:string) => truth(async () => page.url() === ADMIN_BROWSER_APP + path);
    const goto = async (page:Page,path:string) => safe(async () => { state.active(); pendingUi++; try { await page.goto(ADMIN_BROWSER_APP + path, { waitUntil: "domcontentloaded", timeout:30000 }); state.active(); } finally { pendingUi--; } });
    const makeContext = async () => {
      state.count("contexts"); const c = await safe(() => browser.newContext({ baseURL:ADMIN_BROWSER_APP, acceptDownloads:false, serviceWorkers:"block" })); contexts.push(c);
      await safe(() => c.route("**/*", async route => {
        try { state.active(); if (!acceptAdminBrowserRequest(route.request().url(), route.request().method())) { state.fail("REQUEST_REFUSED"); await route.abort(); return; } await route.continue(); } catch { state.fail("REQUEST_REFUSED"); await route.abort().catch(() => {}); }
      }));
      c.on("request", request => { liveRequests.set(request,{kind:"otherHttp",httpClass:"OTHER",responseSeen:false,parkableAuthRead:false}); try { if(!isAdminBrowserReadCancellationRequest(request.url(),request.method())){nonReadRequests.add(request);if(parkingPages){state.unknown();state.fail("WRITE_OUTCOME_UNCERTAIN");}} state.count("browserRequests"); const u = new URL(request.url()),allowed=acceptAdminBrowserRequest(request.url(),request.method()); liveRequests.set(request,{kind:isAdminCanonicalHmrGet(request.url(),request.method())?"hmrGet":"otherHttp",httpClass:classifyAdminBrowserHttpRequest(request.url(),request.method(),allowed&&request.method()==="GET"?request.resourceType():"other",allowed),responseSeen:false,parkableAuthRead:isAdminBrowserParkableAuthRead(request.url(),request.method(),allowed)}); if (!allowed) state.fail("REQUEST_REFUSED"); if (isAdminAuthActionRequest(request.url(),request.method())) { const counts=observedAuthPosts.get(c) ?? new Map<string,number>(); counts.set(u.pathname,(counts.get(u.pathname) ?? 0)+1); observedAuthPosts.set(c,counts); state.count(u.pathname === "/entrar" ? "loginPosts" : "passwordPosts"); } } catch { state.fail("REQUEST_REFUSED"); } });
      c.on("requestfinished",request=>{liveRequests.delete(request);nonReadRequests.delete(request);});
      c.on("requestfailed", request => { liveRequests.delete(request);nonReadRequests.delete(request); try { if (isAdminAuthActionRequest(request.url(),request.method())) { state.unknown(); state.fail("TRANSPORT_FAILED"); } } catch { state.fail("REQUEST_REFUSED"); } });
      c.on("response",response=>{try { const request=response.request(),observed=liveRequests.get(request);if(observed)liveRequests.set(request,{...observed,responseSeen:true}); if (!acceptAdminBrowserRequest(response.url(),request.method()) || response.url()!==request.url()) state.fail("REQUEST_REFUSED"); } catch { state.fail("REQUEST_REFUSED"); }});
      const page = await safe(() => c.newPage());
      page.on("download", () => state.fail("BROWSER_REFUSED"));
      page.on("popup", () => state.fail("BROWSER_REFUSED"));
      return { c, page };
    };
    const post = async (page:Page,path:string, action:()=>Promise<void>):Promise<BrowserResponse> => safe(async () => {
      pendingUi++; let response:BrowserResponse;
      const before=authPosts(page.context(),path), observed=()=>authPosts(page.context(),path)>before;
      try { const results = await Promise.allSettled([safe(()=>page.waitForResponse(r => {try{return new URL(r.url()).pathname===path&&isAdminAuthActionRequest(r.url(),r.request().method());}catch{return false;}}, { timeout:20000 })),safe(action)]); if(results[0].status!=="fulfilled"||results[1].status!=="fulfilled") adminBrowserRefuse("TRANSPORT_FAILED"); response = results[0].value; if (!acceptAdminAuthActionResponse(response.url(),response.request().method(),response.status()) || await safe(()=>response.finished()) !== null) adminBrowserRefuse("TRANSPORT_FAILED"); state.active(); return response; }
      catch { if(observed()) state.unknown(); adminBrowserRefuse("TRANSPORT_FAILED"); } finally { pendingUi--; }
    });
    const hint = async (c:BrowserContext, owner:AdminBrowserOwner) => {
      const cookies = await safe(() => c.cookies(ADMIN_BROWSER_APP)); const auth = cookies.filter(k => k.name === "sc-auth" || /^sc-auth\.[0-9]+$/.test(k.name));
      if (!auth.length || auth.some(k => !k.httpOnly || k.sameSite !== "Lax" || k.path !== "/")) adminBrowserRefuse("AUTH_NOT_PROVEN");
      return safe(async () => sessionFromCookies(auth, owner.id));
    };
    const login = async (actor:{c:BrowserContext;page:Page},owner:AdminBrowserOwner,password:string, expected:"user"|"forced"|"denied") => {
      const checkpoint=runAdminAuthCheckpoint, before=authPosts(actor.c,"/entrar"), observed=()=>authPosts(actor.c,"/entrar")>before;
      await checkpoint(state,"AUTH_DOCUMENT_REFUSED",()=>goto(actor.page,"/entrar?returnTo=%2Fajuda"));
      await checkpoint(state,"AUTH_FORM_REFUSED",async()=>{ await visible(actor.page,"form.auth-form"); await safe(() => actor.page.locator('input[name="email"]').fill(owner.email)); await safe(() => actor.page.locator('input[name="password"]').fill(password)); });
      await checkpoint(state,"AUTH_POST_REFUSED",()=>post(actor.page,"/entrar", () => actor.page.locator('form.auth-form button[type="submit"]').click({ timeout:20000 })),observed);
      if (expected === "denied") {
        await checkpoint(state,"AUTH_READY_REFUSED",()=>visible(actor.page,'.auth-feedback[role="alert"]'),observed);
        await checkpoint(state,"AUTH_SESSION_REFUSED",async()=>{ if ((await safe(() => actor.c.cookies(ADMIN_BROWSER_APP))).some(k => /^sc-auth(?:\.|$)/.test(k.name))) adminBrowserRefuse("AUTH_NOT_PROVEN"); },observed);
        return null;
      }
      await checkpoint(state,"AUTH_DESTINATION_REFUSED",()=>destination(actor.page, expected === "forced" ? "/trocar-senha" : "/ajuda"),observed);
      await checkpoint(state,"AUTH_READY_REFUSED",()=>visible(actor.page, expected === "forced" ? "form.auth-form" : ".shell-help"),observed);
      const session = await checkpoint(state,"AUTH_SESSION_REFUSED",async()=>{ const session=await harness.verifySession(owner, await hint(actor.c,owner), expected); if (await safe(() => actor.page.evaluate(() => document.cookie.split(";").some(k => /^\s*sc-auth(?:\.|=)/.test(k))))) adminBrowserRefuse("AUTH_NOT_PROVEN"); return session; },observed);
      return session;
    };
    const httpProbe = async (c:BrowserContext,path:string,method:string,body:Readonly<Record<string,unknown>>|null,id:string,status:number) => safe(async () => {
      state.active(); pendingUi++;
      try { const r = await harness.nextIo.request({path,method,body,userId:id,cookies:await safe(()=>c.cookies(ADMIN_BROWSER_APP))});
        const bytes=r.bytes;try { if (r.status !== status || !r.cacheControl?.includes("no-store") || !r.contentType?.includes("application/json") || !acceptsAdminBrowserDenial(path,status,JSON.parse(bytes.toString("utf8")))) adminBrowserRefuse("AUTH_NOT_PROVEN"); } finally { bytes.fill(0); }
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
      const received=safe(()=>actor.page.waitForResponse(r=>r.url()===ADMIN_BROWSER_APP+"/api/settings/sessions"&&r.request().method()==="GET",{timeout:20000}));
      const action=reload?()=>actor.page.locator("#sessoes .own-sessions-toolbar button").click({timeout:20000}):()=>goto(actor.page,"/configuracoes");
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
      const stopSessions=new Set<CDPSession>();let deadlineMs:number|null=null,previousAt=0;
      const releaseBarrier=()=>{state.active();const m=harness.metadata(),code=adminBrowserPageReleaseCode({ui:pendingUi+uiOperations.size,sdk:m.pendingRequests,sql:pendingSql+m.pendingInspections,nonRead:nonReadRequests.size,unknown:state.value.writeOutcomeUncertain});if(code){if(code==="WRITE_OUTCOME_UNCERTAIN")state.unknown();state.fail(code);adminBrowserRefuse(code);}};
      const remaining=()=>{releaseBarrier();const at=performance.now();if(deadlineMs===null||!Number.isFinite(at)||at<previousAt||at>=deadlineMs)adminBrowserRefuse("PROCESS_UNCONFIRMED");previousAt=at;return Math.max(1,Math.floor(deadlineMs-at));};
      // The manual session does not replace Playwright's network observers.
      // Its detach remains owned even after a prior refusal; no retry is made.
      const detachStopSession=async(session:CDPSession)=>{const owned=guard(()=>session.detach(),"PROCESS_UNCONFIRMED").finally(()=>uiOperations.delete(owned));uiOperations.add(owned);try{await owned;}finally{stopSessions.delete(session);}};
      try {
        if(state.value.stages.at(-1)?.stage!=="actor-intact"||state.value.stages.at(-1)?.passed!==true)adminBrowserRefuse("PROCESS_UNCONFIRMED");
        releaseBarrier();parkingPages=true;
        previousAt=performance.now();if(!Number.isFinite(previousAt))adminBrowserRefuse("PROCESS_UNCONFIRMED");deadlineMs=previousAt+15000;
        failure=await waitForAdminBrowserHttpQuiet(pendingBrowserPreParkIo,{deadlineMs});if(failure==="QUIESCENCE_HTTP_PENDING")failure=pendingHttpCode();if(failure){state.fail(failure);adminBrowserRefuse(failure);}releaseBarrier();
        const pages=contexts.flatMap(c=>c.pages());
        for(const page of pages){remaining();const session=await safe(async()=>{const attached=await page.context().newCDPSession(page);stopSessions.add(attached);return attached;},"PROCESS_UNCONFIRMED");remaining();await safe(()=>session.send("Page.stopLoading"),"PROCESS_UNCONFIRMED");remaining();}
        for(const page of pages){const timeout=remaining();await safe(()=>page.goto("about:blank",{waitUntil:"domcontentloaded",timeout}),"PROCESS_UNCONFIRMED");remaining();}
        // stopLoading and blank ACKs are not terminal network events. Observe
        // full zero before disposing any Page or primary Chromium session.
        failure=await waitForAdminBrowserIoQuiet(pendingBrowserIo,{deadlineMs});if(failure==="QUIESCENCE_HTTP_PENDING")failure=pendingHttpCode();if(failure)state.fail(failure);
        if(failure)adminBrowserRefuse(failure);remaining();
        for(const session of stopSessions){remaining();await detachStopSession(session);remaining();}
        for(const page of pages){remaining();await safe(()=>page.close({runBeforeUnload:false}),"PROCESS_UNCONFIRMED");remaining();}
        releaseBarrier();quietBeforeClose=true;
      }
      catch { quietBeforeClose=false;failure??="PROCESS_UNCONFIRMED";state.fail(failure); }
      finally { contextsCloseAttempted=true; try{for(const session of stopSessions){try{await detachStopSession(session);}catch{closeConfirmed=false;failure??="PROCESS_UNCONFIRMED";state.fail("PROCESS_UNCONFIRMED");}}for(const c of contexts) { try { await guard(()=>c.close()); } catch { closeConfirmed=false; failure??="PROCESS_UNCONFIRMED"; state.fail("PROCESS_UNCONFIRMED"); } }}finally{parkingPages=false;} }
      await Promise.allSettled([...uiOperations]);
      if(deadlineMs!==null){const at=performance.now();if(!Number.isFinite(at)||at<previousAt||at>=deadlineMs){quietBeforeClose=false;failure??="PROCESS_UNCONFIRMED";state.fail("PROCESS_UNCONFIRMED");}}
      let afterClose=adminBrowserPendingCode(pendingBrowserIo());if(afterClose==="QUIESCENCE_HTTP_PENDING")afterClose=pendingHttpCode(); if(afterClose){failure??=afterClose;state.fail(afterClose);}
      contextsClosed=quietBeforeClose&&closeConfirmed&&afterClose===null&&uiOperations.size===0&&liveRequests.size===0&&nonReadRequests.size===0&&!pendingUi&&!pendingSql&&!state.value.writeOutcomeUncertain;
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
        await safe(() => b1.page.locator('a.shell-inline-link[href="/configuracoes"]').click({timeout:20000}));
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
      await harness.dispose(); const meta = harness.metadata();
      const report = validateAdminBrowserCase(state.finish(meta.pendingRequests + pendingUi + uiOperations.size + liveRequests.size,meta.pendingInspections + pendingSql));
      await guard(() => writeFile(context.reportPath,JSON.stringify(report),{flag:"wx",mode:0o600}),"REPORT_REFUSED");
      if (report.status !== "passed") adminBrowserRefuse(report.code);
    }
  });
}
