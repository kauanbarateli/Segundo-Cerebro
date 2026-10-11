// Real Next/Auth/browser in the dedicated Linux job. No Locator -> expect:
// installed Frame.expect can snapshot the whole body on a failing matcher.
import { test, expect, type BrowserContext, type Page, type Response as BrowserResponse } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
// Shared JavaScript lifecycle has no declaration file; its result is checked
// as unknown at the caller boundary below, rather than trusted by a type cast.
// @ts-expect-error Existing reviewed JS lifecycle, unchanged by this delivery.
import { runBoundedProcess, localPsqlEnvironment } from "../../scripts/verification/auth-local-ci.mjs";
import { sessionFromCookies } from "./support";
import { ADMIN_BROWSER_APP, ADMIN_BROWSER_PAGES, ADMIN_BROWSER_PROBES, acceptAdminBrowserRequest, acceptsAdminBrowserDenial, adminBrowserEnvironment, adminBrowserRefuse, closedBrowserOperation, createAdminBrowserHarness, type AdminBrowserOwner } from "./admin-browser-support.mjs";
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
    let pendingSql = 0, pendingUi = 0, contextsClosed = false;
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
    const uiOperations = new Set<Promise<unknown>>(), liveRequests = new Set<object>();
    const observedAuthPosts = new WeakMap<BrowserContext,Map<string,number>>();
    const authPosts = (c:BrowserContext,path:string) => observedAuthPosts.get(c)?.get(path) ?? 0;
    const harness = await createAdminBrowserHarness(context, { query: input => sql(input,true), write: async input => { try { await sql(input,false); } catch { harness.state.unknown(); adminBrowserRefuse("SQL_REFUSED"); } }, cleanupAllowed: () => contextsClosed && !pendingUi && !pendingSql && !uiOperations.size && !liveRequests.size });
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
      c.on("request", request => { liveRequests.add(request); try { state.count("browserRequests"); const u = new URL(request.url()); if (!acceptAdminBrowserRequest(request.url(),request.method())) state.fail("REQUEST_REFUSED"); if (isAdminAuthActionRequest(request.url(),request.method())) { const counts=observedAuthPosts.get(c) ?? new Map<string,number>(); counts.set(u.pathname,(counts.get(u.pathname) ?? 0)+1); observedAuthPosts.set(c,counts); state.count(u.pathname === "/entrar" ? "loginPosts" : "passwordPosts"); } } catch { state.fail("REQUEST_REFUSED"); } });
      c.on("requestfinished",request=>liveRequests.delete(request));
      c.on("requestfailed", request => { liveRequests.delete(request); try { if (isAdminAuthActionRequest(request.url(),request.method())) { state.unknown(); state.fail("TRANSPORT_FAILED"); } } catch { state.fail("REQUEST_REFUSED"); } });
      c.on("response",response=>{try { const request=response.request(); if (!acceptAdminBrowserRequest(response.url(),request.method()) || response.url()!==request.url()) state.fail("REQUEST_REFUSED"); } catch { state.fail("REQUEST_REFUSED"); }});
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
    const closeContexts = async () => { for (const c of contexts) await guard(() => c.close()); await Promise.allSettled([...uiOperations]); contextsClosed = uiOperations.size===0&&liveRequests.size===0; if(!contextsClosed) adminBrowserRefuse("PROCESS_UNCONFIRMED"); };
    try {
      await harness.ordinaryFixture(); if (kind === "BLOCK_LIVE_BROWSER") await harness.ordinaryFixture(); state.stage("fixtures");
      const a = await makeContext(); await login(a,harness.owners[0]!,harness.owners[0]!.password,"user");
      if (kind === "BLOCK_LIVE_BROWSER") {
        const b1 = await makeContext(), b2 = await makeContext(), target = harness.owners[1]!;
        const s1 = await login(b1,target,target.password,"user"), s2 = await login(b2,target,target.password,"user");
        if (!s1 || !s2 || s1.sessionId === s2.sessionId) adminBrowserRefuse("AUTH_NOT_PROVEN"); state.stage("browser-bound");
        await harness.bootstrap(); state.stage("master-bound"); await harness.runAdmin();
        const terminal = await harness.inspect("ACCESS_DENIED");
        await safe(() => b1.page.locator('a.shell-inline-link[href="/configuracoes"]').click({timeout:20000}));
        await destination(b1.page,"/entrar?notice=session-required"); await visible(b1.page,"form.auth-form");
        await goto(b2.page,"/trocar-senha"); await destination(b2.page,"/entrar?notice=session-required"); await visible(b2.page,"form.auth-form");
        await harness.deniedToken(s1); await harness.deniedToken(s2);
        await httpProbe(b1.c,"/api/capture-tasks?query=captures","GET",null,target.id,401);
        await httpProbe(b2.c,"/api/capture-tasks?query=captures","GET",null,target.id,401);
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
      }
      await goto(a.page,"/ajuda"); await visible(a.page,".shell-help"); const aOwner = harness.owners[0]!, aHint = await hint(a.c,aOwner);
      if (aHint.sessionId !== aOwner.current?.sessionId) adminBrowserRefuse("AUTH_NOT_PROVEN"); await harness.verifySession(aOwner,aHint,"master"); state.stage("actor-intact");
      await closeContexts(); await harness.cleanup(); state.stage("contexts-closed");
    } catch (error) { state.fail(error instanceof Error ? error.message : "BROWSER_REFUSED"); }
    finally {
      if (!contextsClosed) { try { await closeContexts(); } catch { state.fail("PROCESS_UNCONFIRMED"); } }
      await harness.dispose(); const meta = harness.metadata();
      const report = validateAdminBrowserCase(state.finish(meta.pendingRequests + pendingUi + uiOperations.size + liveRequests.size,meta.pendingInspections + pendingSql));
      await guard(() => writeFile(context.reportPath,JSON.stringify(report),{flag:"wx",mode:0o600}),"REPORT_REFUSED");
      if (report.status !== "passed") adminBrowserRefuse(report.code);
    }
  });
}
