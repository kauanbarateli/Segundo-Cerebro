/** Browser/React interaction only. Auth, HTTP and persistence are synthetic;
 * no Supabase, real account, database, hosted environment or delivery claim.
 * Context routing blocks unexpected HTTP(S), not process-wide network or WebSockets. */
import { expect, test, type BrowserContext, type CDPSession, type Page, type Request } from "@playwright/test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";

const origin = "https://feedback-session.test";
const owner = "10000000-0000-4000-8000-000000000001";
const id = "20000000-0000-4000-8000-000000000001";
const historyText = "HISTORICO_PRIVADO_SINTETICO_A", draftText = "RASCUNHO_PRIVADO_SINTETICO_A";
type Payload = { category: string; text: string; clientId: string };
const item = { id, category: "suggestion", text: historyText, status: "received", createdAt: "2026-10-31T12:00:00Z" };
const history = { ok: true, result: { items: [item], next: null } };
const ack = (body: Payload) => ({ ok: true, result: { status: "submitted", clientId: body.clientId, feedbackId: id } });
let bundle: string;
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({}, info) => {
  // The headed diagnostic must not silently run a headless project.
  if (process.env.FRONT_B_FOCUS_EXPECT_HEADED === "1") expect(info.project.use.headless).toBe(false);
  if (process.env.FRONT_B_FOCUS_EXPECT_NEW_HEADLESS === "1") {
    expect(info.project.use.headless).toBe(true);
    expect(info.project.use.channel).toBe("chromium");
  }
});

test.beforeAll(async () => {
  const build = await rolldown({
    input: resolve("tests/e2e/fixtures/feedback-session-browser.tsx"), platform: "browser", tsconfig: false,
    resolve: { alias: { "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "feedback-session-local-css", resolveId(source) { if (source.endsWith(".css")) return "\0feedback-session-css"; }, load(id) { if (id === "\0feedback-session-css") return "export {};"; } }],
  });
  try {
    const generated = await build.generate({ format: "iife", codeSplitting: false }), chunk = generated.output[0];
    if (generated.output.length !== 1 || chunk?.type !== "chunk" || chunk.imports.length || chunk.dynamicImports.length) throw new Error("Closed feedback browser bundle required.");
    bundle = chunk.code;
  } finally { await build.close(); }
});

type Mode = "pending" | "invalid-200" | "delayed-get" | "invalid-get" | "timeout-post";
type ReadMode = "valid" | "ok-false" | "invalid-date" | "invalid-cursor";
type InvalidReply = "empty" | "ok-false" | "wrong-client" | "missing-feedback" | "invalid-id" | "extra-field" | "invalid-status" | "malformed";
async function mount(page: Page, mode: Mode, invalidReply: InvalidReply = "empty") {
  const trace = { unexpected: [] as string[], errors: [] as string[], reads: [] as string[], posts: [] as Payload[], checks: [] as {action:string;clientId:string}[], heldReads: 0, abortedRoutes: 0 };
  let actor: "A" | "B" = "A", releasePost: (() => void) | undefined;
  let releaseRead: (() => void) | undefined, holdNextA = false, readMode: ReadMode = "valid";
  let firstPost: Request | undefined, settleRoute: ((value: "fulfilled" | "rejected") => void) | undefined, settleTerminal: ((value: "finished" | "failed") => void) | undefined;
  const postBarrier = new Promise<void>(resolveBarrier => { releasePost = resolveBarrier; });
  const readBarrier = new Promise<void>(resolveBarrier => { releaseRead = resolveBarrier; });
  const heldPostDone = new Promise<"fulfilled" | "rejected">(resolveDone => { settleRoute = resolveDone; });
  const firstPostTerminal = new Promise<"finished" | "failed">(resolveDone => { settleTerminal = resolveDone; });
  page.on("pageerror", error => trace.errors.push(error.message));
  page.on("requestfinished", request => { if (request === firstPost) settleTerminal?.("finished"); });
  page.on("requestfailed", request => { if (request === firstPost) settleTerminal?.("failed"); });
  // Diagnostic only: no DOM, URL, account ID, message or network payload is recorded.
  await page.addInitScript(() => {
    const samples: { event: string; target: string; visibility: string; focused: boolean; trusted: boolean }[] = [];
    const record = (event: Event) => { if (samples.length < 100) samples.push({ event: event.type, target: event.target === window ? "window" : event.target === document ? "document" : "element", visibility: document.visibilityState, focused: document.hasFocus(), trusted: event.isTrusted }); };
    window.addEventListener("focus", record, true); window.addEventListener("blur", record, true);
    document.addEventListener("visibilitychange", record, true);
    Object.assign(globalThis, { __feedbackFocusEvidence: samples });
    // Observe settlement of the original fetch promise without changing it,
    // reading/cloning its body, or persisting input or response contents.
    const postDelivery = { started: false, resolved: 0, rejected: 0 };
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const promise = nativeFetch(input, init);
      if (!postDelivery.started && input === "/api/feedback" && init?.method === "POST") {
        postDelivery.started = true;
        void promise.then(() => { postDelivery.resolved++; }, () => { postDelivery.rejected++; });
      }
      return promise;
    };
    Object.assign(globalThis, { __feedbackPostDelivery: postDelivery });
  });
  await page.context().route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store" }, body: JSON.stringify(value) });
    if (request.method() === "GET" && request.isNavigationRequest() && url.pathname === "/" && !url.search) {
      await route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="feedback-session"></main></body></html>' }); return;
    }
    if (request.method() === "GET" && request.isNavigationRequest() && url.pathname === "/focus-control" && !url.search) {
      await route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="pt-BR"><head><link rel="icon" href="data:,"></head><body><button type="button">Aba de controle</button></body></html>' }); return;
    }
    if (!["/api/feedback", "/api/feedback/reconciliation"].includes(url.pathname) || url.search || request.headers()["x-expected-user-id"] !== owner) { trace.unexpected.push("UNEXPECTED_REQUEST"); await route.abort(); return; }
    if (url.pathname === "/api/feedback/reconciliation") {
      if (request.method() !== "POST" || actor !== "A" || !request.postData()) { trace.unexpected.push("UNEXPECTED_CHECK"); await route.abort(); return; }
      let check: {action:string;clientId:string};
      try { check=JSON.parse(request.postData()!) as typeof check; } catch { trace.unexpected.push("BAD_CHECK"); await route.abort(); return; }
      if(Object.keys(check).sort().join(",")!=="action,clientId" || !["status","cancel"].includes(check.action) || check.clientId!==trace.posts[0]?.clientId){trace.unexpected.push("BAD_CHECK");await route.abort();return;}
      trace.checks.push(check);
      const status=check.action==='cancel'?'cancelled':mode==='pending'?'submitted':'unknown';
      await json({ok:true,result:status==='submitted'?{status,clientId:check.clientId,feedbackId:id}:{status,clientId:check.clientId}});return;
    }
    if (request.method() === "GET") {
      trace.reads.push(actor);
      if (actor === "B") { await json({ ok: false, code: "SESSION_CHANGED" }, 409); return; }
      if (mode === "delayed-get" && holdNextA) { holdNextA = false; trace.heldReads++; await readBarrier; await json(history); return; }
      if (mode === "invalid-get" && readMode === "ok-false") { await json({ ok: false, result: { items: [], next: null } }); return; }
      if (mode === "invalid-get" && readMode === "invalid-date") { await json({ ok: true, result: { items: [{ ...item, createdAt: "invalid" }], next: null } }); return; }
      if (mode === "invalid-get" && readMode === "invalid-cursor") { await json({ ok: true, result: { items: [item], next: { before: item.createdAt, id: "invalid" } } }); return; }
      await json(history); return;
    }
    if (request.method() !== "POST" || actor !== "A" || !request.postData()) { trace.unexpected.push("UNEXPECTED_WRITE"); await route.abort(); return; }
    let payload: Payload;
    try { payload = JSON.parse(request.postData()!) as Payload; }
    catch { trace.unexpected.push("BAD_REQUEST"); await route.abort(); return; }
    if (Object.keys(payload).sort().join(",") !== "category,clientId,text" || typeof payload.clientId !== "string" || typeof payload.text !== "string" || typeof payload.category !== "string") { trace.unexpected.push("BAD_PAYLOAD"); await route.abort(); return; }
    trace.posts.push(payload);
    const postIndex = trace.posts.length;
    if (postIndex === 1) firstPost = request;
    if (mode === "pending" || mode === "timeout-post") {
      if (postIndex === 1) {
        await postBarrier;
        try { await json(ack(payload)); settleRoute?.("fulfilled"); }
        catch { trace.abortedRoutes++; settleRoute?.("rejected"); }
        return;
      }
      await json(ack(payload)); return;
    }
    const kind = invalidReply;
    if (postIndex!==1) { trace.unexpected.push("TOO_MANY_POSTS"); await route.abort(); return; }
    if (kind === "empty") { await route.fulfill({ status: 200, contentType: "application/json", body: "" }); return; }
    if (kind === "malformed") { await route.fulfill({ status: 200, contentType: "application/json", body: "{malformed" }); return; }
    const result = ack(payload).result;
    if (kind === "ok-false") { await json({ ok: false, result }); return; }
    const altered = kind === "wrong-client" ? { ...result, clientId: "invalid" }
      : kind === "missing-feedback" ? { status: "submitted", clientId: payload.clientId }
      : kind === "invalid-id" ? { ...result, feedbackId: "invalid" }
      : kind === "extra-field" ? { ...result, text: "não deve ser aceito" }
      : kind === "invalid-status" ? { ...result, status: "other" } : result;
    await json({ ok: true, result: altered });
  });
  await page.goto(origin + "/"); await page.addScriptTag({ content: bundle });
  await page.evaluate(userId => (globalThis as unknown as { __startFeedbackSession(userId: string): void }).__startFeedbackSession(userId), owner);
  await expect(page.getByText(historyText, { exact: true })).toBeVisible();
  return {
    trace,
    setActor(value: "A" | "B") { actor = value; },
    setReadMode(value: ReadMode) { readMode = value; },
    holdNextRead() { holdNextA = true; },
    release() { if (!releasePost) throw new Error("POST barrier missing"); releasePost(); },
    releaseRead() { if (!releaseRead) throw new Error("GET barrier missing"); releaseRead(); },
    heldPostDone: () => heldPostDone,
    firstPostTerminal: () => firstPostTerminal,
  };
}

function clean(trace: Awaited<ReturnType<typeof mount>>["trace"]) { expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]); }

type FocusEventSample = { event: string; target: string; visibility: string; focused: boolean; trusted: boolean };
const focusSessions = new WeakMap<Page, CDPSession>();
async function evidence(page: Page): Promise<FocusEventSample[]> {
  return page.evaluate(() => (globalThis as unknown as { __feedbackFocusEvidence: FocusEventSample[] }).__feedbackFocusEvidence);
}
async function awaitLoss(page: Page, from: number): Promise<number> {
  await expect.poll(async () => (await evidence(page)).slice(from).some(sample => sample.trusted && (
    (sample.event === "blur" && sample.target === "window") ||
    (sample.event === "visibilitychange" && sample.target === "document" && sample.visibility === "hidden")
  ))).toBe(true);
  return (await evidence(page)).length;
}
async function disablePlaywrightFocusEmulation(context: BrowserContext, page: Page) {
  // Playwright enables this CDP override on each Chromium page. Disable it
  // rather than synthesizing focus/visibility events, then assert real events.
  // A missing/failed CDP command must fail the test, never skip this safeguard.
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  focusSessions.set(page, session);
}
async function controlPage(context: BrowserContext, page: Page): Promise<{ other: Page; checkpoint: number }> {
  await disablePlaywrightFocusEmulation(context, page);
  await page.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hasFocus() && document.visibilityState === "visible")).toBe(true);
  const before = (await evidence(page)).length;
  const other = await context.newPage();
  await other.goto(origin + "/focus-control");
  await disablePlaywrightFocusEmulation(context, other);
  await focusControl(other);
  return { other, checkpoint: await awaitLoss(page, before) };
}
async function focusControl(other: Page) {
  await other.bringToFront();
  await other.getByRole("button", { name: "Aba de controle" }).click();
  await expect.poll(() => other.evaluate(() => document.hasFocus())).toBe(true);
}
async function enterControl(other: Page, page: Page): Promise<number> {
  const before = (await evidence(page)).length;
  await focusControl(other);
  return awaitLoss(page, before);
}
async function returnToFeedback(page: Page, from: number) {
  await page.bringToFront();
  // Do not synthesize focus or visibility events: require actual browser focus.
  await expect.poll(() => page.evaluate(() => document.hasFocus() && document.visibilityState === "visible")).toBe(true);
  await expect.poll(async () => (await evidence(page)).slice(from).some(sample => sample.trusted && (
    (sample.event === "focus" && sample.target === "window" && sample.visibility === "visible") ||
    (sample.event === "visibilitychange" && sample.target === "document" && sample.visibility === "visible")
  ))).toBe(true);
}

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const evidence = await page.evaluate(() => ({
    visibility: document.visibilityState,
    focused: document.hasFocus(),
    events: (globalThis as unknown as { __feedbackFocusEvidence?: unknown }).__feedbackFocusEvidence ?? [],
  })).catch(() => ({ unavailable: true }));
  await info.attach("feedback-focus-evidence", { contentType: "application/json", body: Buffer.from(JSON.stringify(evidence)) });
});

test("outra conta ao retornar à aba oculta dados mesmo com POST anterior pendente e confirmação atrasada", async ({ page, context }) => {
  const fixture = await mount(page, "pending");
  await page.getByLabel("Mensagem", { exact: true }).fill(draftText);
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await expect.poll(() => fixture.trace.posts.length).toBe(1);
  const { other, checkpoint } = await controlPage(context, page);
  fixture.setActor("B"); await returnToFeedback(page, checkpoint);
  await expect.poll(() => fixture.trace.reads.includes("B")).toBe(true);
  await expect(page.getByRole("heading", { name: "Confirme sua conta" })).toBeVisible();
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveCount(0);
  await expect(page.getByText(historyText, { exact: true })).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toContain(draftText);
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __feedbackPostDelivery: { started: boolean; resolved: number; rejected: number } }).__feedbackPostDelivery)).toMatchObject({ started: true, resolved: 0, rejected: 0 });
  fixture.release();
  expect(await fixture.heldPostDone()).toBe("fulfilled");
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __feedbackPostDelivery: { resolved: number; rejected: number } }).__feedbackPostDelivery)).toMatchObject({ resolved: 1, rejected: 0 });
  await expect(page.getByRole("heading", { name: "Confirme sua conta" })).toBeVisible();
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toHaveCount(0);
  const secondLoss = await enterControl(other, page); fixture.setActor("A"); await returnToFeedback(page, secondLoss);
  await expect(page.getByRole("button", { name: "Verificar novamente", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Texto atual (não confirmado)", { exact: true })).toHaveValue(draftText);
  await page.getByRole("button", { name: "Verificar novamente", exact: true }).click();
  await expect(page.getByText("Não foi possível confirmar o texto atual nesta tentativa. Copie-o ou revise antes de criar outra.", { exact: true })).toBeVisible();
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toHaveCount(0);
  expect(fixture.trace.posts).toHaveLength(1);expect(fixture.trace.checks).toHaveLength(1);
  await other.close(); clean(fixture.trace);
});

for(const invalid of ["empty", "ok-false", "wrong-client", "missing-feedback", "invalid-id", "extra-field", "invalid-status", "malformed"] as const) test(`resposta 2xx ${invalid} não confirma nem substitui o marcador`, async ({ page }) => {
  const fixture = await mount(page, "invalid-200", invalid);
  const value = "  Sugesta\u0303o privada sintetica  ";
  await page.getByLabel("Mensagem", { exact: true }).fill(value);
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await expect(page.getByRole("button", { name: "Verificar novamente", exact: true })).toBeEnabled();
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Texto atual (não confirmado)", { exact: true })).toHaveValue(value);
  await page.getByRole("button", { name: "Verificar novamente", exact: true }).click();
  await expect(page.getByText("Não foi possível verificar a tentativa. Tente novamente.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar tentativa anterior", exact: true }).click();
  await expect(page.getByText("Esta tentativa foi encerrada.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Texto atual (não confirmado)", { exact: true })).toHaveValue(value);
  expect(fixture.trace.posts).toHaveLength(1);expect(fixture.trace.checks.map(x=>x.action)).toEqual(["status","cancel"]);
  clean(fixture.trace);
});

test("recarga recupera somente a chave e exige consultar o estado novamente", async ({page})=>{
  const fixture=await mount(page,"pending");
  await page.getByLabel("Mensagem",{exact:true}).fill(draftText);
  await page.getByRole("button",{name:"Enviar mensagem",exact:true}).click();
  await expect.poll(()=>fixture.trace.posts.length).toBe(1);
  const before=await page.evaluate(()=>sessionStorage.getItem('feedback-attempt-v1'));
  expect(before).not.toBeNull();expect(before).not.toContain(draftText);
  expect(Object.keys(JSON.parse(before!)).sort()).toEqual(['clientId','ownerBinding','version']);
  await page.reload();await page.addScriptTag({content:bundle});
  await page.evaluate(userId=>(globalThis as unknown as {__startFeedbackSession(userId:string):void}).__startFeedbackSession(userId),owner);
  await expect(page.getByRole('button',{name:'Verificar novamente',exact:true})).toBeEnabled();
  fixture.release();await fixture.heldPostDone();
  await page.getByRole('button',{name:'Verificar novamente',exact:true}).click();
  await expect(page.getByText('Um envio anterior foi registrado. Confira o histórico.',{exact:true})).toBeVisible();
  await expect(page.getByText('Mensagem recebida.',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>sessionStorage.getItem('feedback-attempt-v1'))).toBe(before);
  expect(fixture.trace.posts).toHaveLength(1);clean(fixture.trace);
});

test("resposta GET antiga de A não reabre histórico depois da troca para B", async ({ page, context }) => {
  const fixture = await mount(page, "delayed-get");
  const { other, checkpoint } = await controlPage(context, page);
  fixture.holdNextRead(); await returnToFeedback(page, checkpoint);
  await expect.poll(() => fixture.trace.heldReads).toBe(1);
  const secondLoss = await enterControl(other, page); fixture.setActor("B"); await returnToFeedback(page, secondLoss);
  await expect.poll(() => fixture.trace.reads.includes("B")).toBe(true);
  await expect(page.getByRole("heading", { name: "Confirme sua conta" })).toBeVisible();
  const stale = page.waitForResponse(response => response.url() === origin + "/api/feedback" && response.request().method() === "GET" && response.status() === 200);
  fixture.releaseRead(); await (await stale).finished();
  await page.evaluate(() => new Promise<void>(resolveFrame => requestAnimationFrame(() => resolveFrame())));
  await expect(page.getByRole("heading", { name: "Confirme sua conta" })).toBeVisible();
  await expect(page.getByText(historyText, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveCount(0);
  await other.close(); clean(fixture.trace);
});

test("GET 200 inválido permanece fechado até que a leitura autenticada seja válida", async ({ page, context }) => {
  const fixture = await mount(page, "invalid-get");
  const { other, checkpoint } = await controlPage(context, page); fixture.setReadMode("ok-false"); await returnToFeedback(page, checkpoint);
  await expect(page.getByRole("heading", { name: "Confirme sua conta" })).toBeVisible();
  await expect(page.getByText("Não foi possível verificar agora. Tente novamente.", { exact: true })).toBeVisible();
  for (const readMode of ["invalid-date", "invalid-cursor"] as const) {
    fixture.setReadMode(readMode);
    const before = fixture.trace.reads.length;
    await page.getByRole("button", { name: "Verificar sessão", exact: true }).click();
    await expect.poll(() => fixture.trace.reads.length).toBeGreaterThan(before);
    await expect(page.getByRole("button", { name: "Verificar sessão", exact: true })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Confirme sua conta" })).toBeVisible();
    await expect(page.getByText(historyText, { exact: true })).toHaveCount(0);
  }
  fixture.setReadMode("valid"); await page.getByRole("button", { name: "Verificar sessão", exact: true }).click();
  await expect(page.getByText(historyText, { exact: true })).toBeVisible();
  await other.close(); clean(fixture.trace);
});

test("timeout real do POST mantém intenção até cancelamento seguro da mesma chave", async ({ page }, info) => {
  test.setTimeout(70_000);
  const fixture = await mount(page, "timeout-post");
  await page.getByLabel("Mensagem", { exact: true }).fill(draftText);
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await expect.poll(() => fixture.trace.posts.length).toBe(1);
  // Production timeout is 30 seconds; no test override or Promise.race.
  await expect(page.getByRole("button", { name: "Verificar novamente", exact: true })).toBeEnabled({ timeout: 40_000 });
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toHaveCount(0);
  fixture.release();
  const [routeOutcome, requestOutcome] = await Promise.all([fixture.heldPostDone(), fixture.firstPostTerminal()]);
  expect(["fulfilled", "rejected"]).toContain(routeOutcome);
  expect(["finished", "failed"]).toContain(requestOutcome);
  await info.attach("timeout-route-observation", { contentType: "application/json", body: Buffer.from(JSON.stringify({ routeOutcome, requestOutcome, remoteCommit: "unknown" })) });
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Verificar novamente", exact: true }).click();
  await expect(page.getByText("Não foi possível verificar a tentativa. Tente novamente.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar tentativa anterior", exact: true }).click();
  await expect(page.getByText("Esta tentativa foi encerrada.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Texto atual (não confirmado)", { exact: true })).toHaveValue(draftText);
  expect(fixture.trace.posts).toHaveLength(1); expect(fixture.trace.checks.map(x=>x.action)).toEqual(["status","cancel"]);
  clean(fixture.trace);
});
