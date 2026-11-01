/** Browser/React interaction only. Auth, HTTP and persistence are synthetic;
 * no Supabase, real account, database, hosted environment or delivery claim.
 * Context routing blocks unexpected HTTP(S), not process-wide network or WebSockets. */
import { expect, test, type Page, type Request } from "@playwright/test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";

const origin = "https://feedback-session.test";
const owner = "10000000-0000-4000-8000-000000000001";
const id = "20000000-0000-4000-8000-000000000001";
const historyText = "HISTORICO_PRIVADO_SINTETICO_A", draftText = "RASCUNHO_PRIVADO_SINTETICO_A";
type Payload = { category: string; text: string; clientId: string };
const item = { id, category: "suggestion", text: historyText, status: "received", createdAt: "2026-10-31T12:00:00Z" };
const history = { ok: true, result: { items: [item], next: null } };
const ack = (body: Payload) => ({ ok: true, result: { ...item, category: body.category, text: body.text.normalize("NFC").trim() } });
let bundle: string;
test.use({ serviceWorkers: "block" });

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
async function mount(page: Page, mode: Mode) {
  const trace = { unexpected: [] as string[], errors: [] as string[], reads: [] as string[], posts: [] as Payload[], heldReads: 0, abortedRoutes: 0 };
  let actor: "A" | "B" = "A", releasePost: (() => void) | undefined;
  let releaseRead: (() => void) | undefined, holdNextA = false, readMode: ReadMode = "valid";
  let firstPost: Request | undefined, settleRoute: ((value: "fulfilled" | "rejected") => void) | undefined, settleTerminal: ((value: "finished" | "failed") => void) | undefined;
  const postBarrier = new Promise<void>(resolveBarrier => { releasePost = resolveBarrier; });
  const readBarrier = new Promise<void>(resolveBarrier => { releaseRead = resolveBarrier; });
  const heldPostDone = new Promise<"fulfilled" | "rejected">(resolveDone => { settleRoute = resolveDone; });
  const firstPostTerminal = new Promise<"finished" | "failed">(resolveDone => { settleTerminal = resolveDone; });
  const replies = ["empty", "ok-false", "mismatch-text", "mismatch-category", "invalid-id", "invalid-date", "invalid-status", "malformed", "valid"] as const;
  page.on("pageerror", error => trace.errors.push(error.message));
  page.on("requestfinished", request => { if (request === firstPost) settleTerminal?.("finished"); });
  page.on("requestfailed", request => { if (request === firstPost) settleTerminal?.("failed"); });
  await page.context().route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store" }, body: JSON.stringify(value) });
    if (request.method() === "GET" && request.isNavigationRequest() && url.pathname === "/" && !url.search) {
      await route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="feedback-session"></main></body></html>' }); return;
    }
    if (url.pathname !== "/api/feedback" || url.search || request.headers()["x-expected-user-id"] !== owner) { trace.unexpected.push("UNEXPECTED_REQUEST"); await route.abort(); return; }
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
      if (postIndex === 1) await postBarrier;
      if (mode === "timeout-post" && postIndex === 1) {
        try { await json(ack(payload)); settleRoute?.("fulfilled"); }
        catch { trace.abortedRoutes++; settleRoute?.("rejected"); }
        return;
      }
      await json(ack(payload)); return;
    }
    const kind = replies[postIndex - 1];
    if (!kind) { trace.unexpected.push("TOO_MANY_POSTS"); await route.abort(); return; }
    if (kind === "empty") { await route.fulfill({ status: 200, contentType: "application/json", body: "" }); return; }
    if (kind === "malformed") { await route.fulfill({ status: 200, contentType: "application/json", body: "{malformed" }); return; }
    const result = ack(payload).result;
    if (kind === "ok-false") { await json({ ok: false, result }); return; }
    const altered = kind === "mismatch-text" ? { ...result, text: "outra mensagem" }
      : kind === "mismatch-category" ? { ...result, category: "other" }
      : kind === "invalid-id" ? { ...result, id: "invalid" }
      : kind === "invalid-date" ? { ...result, createdAt: "invalid" }
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

test("outra conta ao retornar à aba oculta dados mesmo com POST anterior pendente e confirmação atrasada", async ({ page, context }) => {
  const fixture = await mount(page, "pending");
  await page.getByLabel("Mensagem", { exact: true }).fill(draftText);
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await expect.poll(() => fixture.trace.posts.length).toBe(1);
  const original = fixture.trace.posts[0]!;
  const other = await context.newPage(); await other.bringToFront();
  fixture.setActor("B"); await page.bringToFront();
  await expect.poll(() => fixture.trace.reads.includes("B")).toBe(true);
  await expect(page.getByRole("heading", { name: "Confirme sua conta" })).toBeVisible();
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveCount(0);
  await expect(page.getByText(historyText, { exact: true })).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toContain(draftText);
  const late = page.waitForResponse(response => response.url() === origin + "/api/feedback" && response.request().method() === "POST");
  fixture.release(); await (await late).finished();
  await page.evaluate(() => new Promise<void>(resolveFrame => requestAnimationFrame(() => resolveFrame())));
  await expect(page.getByRole("heading", { name: "Confirme sua conta" })).toBeVisible();
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toHaveCount(0);
  await other.bringToFront(); fixture.setActor("A"); await page.bringToFront();
  await expect(page.getByRole("button", { name: "Verificar envio", exact: true })).toBeVisible();
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveValue(draftText);
  await page.getByRole("button", { name: "Verificar envio", exact: true }).click();
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toBeVisible();
  expect(fixture.trace.posts).toHaveLength(2); expect(fixture.trace.posts[1]).toEqual(original);
  await other.close(); clean(fixture.trace);
});

test("respostas 2xx incompletas ou divergentes não confirmam e repetem o mesmo UUID", async ({ page }) => {
  const fixture = await mount(page, "invalid-200");
  const value = "  Sugesta\u0303o privada sintetica  ";
  await page.getByLabel("Mensagem", { exact: true }).fill(value);
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  for (let index = 0; index < 8; index++) {
    await expect(page.getByRole("button", { name: "Verificar envio", exact: true })).toBeEnabled();
    await expect(page.getByText("Mensagem recebida.", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Mensagem", { exact: true })).toHaveValue(value);
    await page.getByRole("button", { name: "Verificar envio", exact: true }).click();
  }
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toBeVisible();
  expect(fixture.trace.posts).toHaveLength(9);
  for (const request of fixture.trace.posts) expect(request).toEqual(fixture.trace.posts[0]);
  clean(fixture.trace);
});

test("resposta GET antiga de A não reabre histórico depois da troca para B", async ({ page, context }) => {
  const fixture = await mount(page, "delayed-get");
  const other = await context.newPage(); await other.bringToFront();
  fixture.holdNextRead(); await page.bringToFront();
  await expect.poll(() => fixture.trace.heldReads).toBe(1);
  await other.bringToFront(); fixture.setActor("B"); await page.bringToFront();
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
  const other = await context.newPage(); await other.bringToFront(); fixture.setReadMode("ok-false"); await page.bringToFront();
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

test("timeout real do POST mantém intenção incerta e retry usa a mesma identidade", async ({ page }, info) => {
  test.setTimeout(70_000);
  const fixture = await mount(page, "timeout-post");
  await page.getByLabel("Mensagem", { exact: true }).fill(draftText);
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await expect.poll(() => fixture.trace.posts.length).toBe(1);
  // Production timeout is 30 seconds; no test override or Promise.race.
  await expect(page.getByRole("button", { name: "Verificar envio", exact: true })).toBeEnabled({ timeout: 40_000 });
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toHaveCount(0);
  fixture.release();
  const [routeOutcome, requestOutcome] = await Promise.all([fixture.heldPostDone(), fixture.firstPostTerminal()]);
  expect(["fulfilled", "rejected"]).toContain(routeOutcome);
  expect(["finished", "failed"]).toContain(requestOutcome);
  await info.attach("timeout-route-observation", { contentType: "application/json", body: Buffer.from(JSON.stringify({ routeOutcome, requestOutcome, remoteCommit: "unknown" })) });
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Verificar envio", exact: true }).click();
  await expect(page.getByText("Mensagem recebida.", { exact: true })).toBeVisible();
  expect(fixture.trace.posts).toHaveLength(2); expect(fixture.trace.posts[1]).toEqual(fixture.trace.posts[0]);
  clean(fixture.trace);
});
