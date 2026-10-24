/** Isolated React + injected RAM port only. No hosted/HTTP/Auth/SQL/durable-journal certification. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test, type Page } from "@playwright/test";
import type { GoalsFixtureOptions } from "./helpers/finance-goals-fixture";
import { describeVisualFailures, inspectVisualGuards } from "./helpers/visual-guards";

let bundle: string, css: string, landscape: Buffer;
const origin = "https://finance-goals.invalid";
const imageId = "77777777-7777-4777-8777-777777777777";
const unexpectedRequests = new WeakMap<Page, { method: string; path: string }[]>();
test.afterEach(async ({ page }) => { expect(unexpectedRequests.get(page) ?? [], "The isolated surface must not make undeclared requests").toEqual([]); });
test.beforeAll(async () => {
  const cssPaths = ["src/components/ui/button.css", "src/components/ui/field.css", "src/components/ui/dialog.css", "src/components/layout/private-image.css", "src/components/features/financeiro/goals/goals.css"], absolute = cssPaths.map(path => resolve(path)), found = new Set<string>();
  const build = await rolldown({ input: resolve("tests/e2e/helpers/finance-goals-fixture.tsx"), platform: "browser", tsconfig: false, resolve: { alias: { "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "goals-isolated-css-boundary", resolveId(source, importer) {
      assert.ok(!source.startsWith("@supabase/") && source !== "server-only" && !source.startsWith("node:") && !source.includes("/adapters/"), "Server infrastructure reached isolated UI");
      if (source.endsWith(".css")) { assert.ok(importer); const path = source.startsWith("@/") ? resolve("src", source.slice(2)) : resolve(dirname(importer), source); assert.ok(absolute.includes(path), "Undeclared stylesheet"); found.add(path); return "\0goals-css"; }
    }, load(id) { if (id === "\0goals-css") return "export {};"; } }] });
  try { const result = await build.generate({ format: "iife", codeSplitting: false }); assert.equal(result.output.length, 1); const chunk = result.output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.deepEqual([...found].sort(), [...absolute].sort()); bundle = chunk.code; } finally { await build.close(); }
  const globals = resolve("src/app/globals.css"); css = (await postcss([tailwind()]).process(await readFile(globals, "utf8"), { from: globals })).css + "\n" + (await Promise.all(cssPaths.map(path => readFile(path, "utf8")))).join("\n");
  const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"); css += "\n@font-face{font-family:GoalsFixtureGeist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:GoalsFixtureGeist}";
  landscape = await readFile("docs/planejamento/17-evolucao-prototipo/prototipo/assets/covers/focus-landscape.png");
});
async function mount(page: Page, options: GoalsFixtureOptions = {}, theme = "light", imageOutcome: "ready" | "forbidden" | "corrupt" = "ready") {
  const unexpected: { method: string; path: string }[] = []; unexpectedRequests.set(page, unexpected);
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin && url.pathname === "/api/files/read") {
      const own = request.method() === "GET" && url.searchParams.size === 2 && url.searchParams.get("id") === imageId && url.searchParams.get("user") === (options.ownerId ?? "11111111-1111-4111-8111-111111111111");
      if (!own) unexpected.push({ method: request.method(), path: url.pathname });
      if (!own || imageOutcome === "forbidden") return route.fulfill({ status: 403, contentType: "text/plain", body: "Unavailable", headers: { "Cache-Control": "no-store" } });
      return route.fulfill({ status: 200, contentType: "image/png", body: imageOutcome === "corrupt" ? Buffer.from("CORRUPT_PUBLIC_FIXTURE") : landscape, headers: { "Cache-Control": "no-store" } });
    }
    if (url.origin === origin && url.pathname === "/isolated" && request.method() === "GET") return route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><html lang="pt-BR" data-theme="${theme}"><body><div id="goals-root"></div></body></html>` });
    unexpected.push({ method: request.method(), path: url.pathname });
    return route.fulfill({ status: 403, contentType: "text/plain", body: "UNDECLARED_PUBLIC_FIXTURE_REQUEST" });
  });
  await page.goto(origin + "/isolated"); await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle }); await page.evaluate(input => window.__mountGoals(input), options);
  await expect(page.getByRole("heading", { name: "Metas financeiras", exact: true })).toBeVisible(); if (options.mode !== "unavailable") await expect(page.getByRole("button", { name: "Atualizar metas", exact: true })).toBeVisible();
}
async function openNew(page: Page) { await page.getByRole("button", { name: "Nova meta financeira", exact: true }).click(); await expect(page.getByRole("dialog")).toBeVisible(); }
async function fillNew(page: Page) { await page.getByLabel("Nome da meta", { exact: true }).fill("Reserva da viagem"); await page.getByLabel("Quanto quer guardar?", { exact: true }).fill("1000,00"); await page.getByRole("button", { name: "Revisar nova meta", exact: true }).click(); }
async function trace(page: Page) { return page.evaluate(() => window.__goalsTrace); }
async function visual(page: Page) { const report = await inspectVisualGuards(page); for (const gate of ["overflow", "targets", "fields"] as const) expect(report[gate], describeVisualFailures(report, gate)).toEqual([]); }

test("host refresh holds the channel exclusion before reading Goals or allowing a newer resolution", async ({ page }) => {
  await mount(page, { empty: true, pending: true, mode: "no-receipt", hostRefresh: "hold-first" });
  const initial = await page.evaluate(() => window.__goalsSnapshot()), initialPages = (await trace(page)).filter(row => row.method === "page").length;
  await page.getByRole("button", { name: "Atualizar metas", exact: true }).click();
  await expect.poll(async () => (await trace(page)).filter(row => row.method === "host-refresh").length).toBe(1);
  await expect(page.getByRole("button", { name: "Consultar tentativa", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Encerrar esta tentativa", exact: true })).toBeDisabled();
  expect((await trace(page)).filter(row => row.method === "page")).toHaveLength(initialPages);
  await page.evaluate(() => window.__releaseGoalsHostRefresh());
  await expect(page.getByRole("button", { name: "Atualizar metas", exact: true })).toBeEnabled();
  expect((await trace(page)).filter(row => row.method === "page")).toHaveLength(initialPages + 1);
  expect(await page.evaluate(() => window.__goalsSnapshot())).toEqual(initial);
  expect((await trace(page)).filter(row => ["execute", "stage", "attempt-status", "attempt-settle", "acknowledge"].includes(row.method))).toEqual([]);
});

test("host refresh failure keeps reconfirmation blocked until a complete explicit reload succeeds", async ({ page }) => {
  await mount(page, { empty: true, pending: true, mode: "no-receipt", hostRefresh: "fail-twice" });
  const initialPages = (await trace(page)).filter(row => row.method === "page").length;
  await page.getByRole("button", { name: "Encerrar esta tentativa", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar encerramento", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Não foi possível atualizar a tela");
  const acknowledge = page.getByRole("button", { name: "Conferi os dados atuais", exact: true });
  await expect(acknowledge).toBeDisabled();
  await page.getByRole("button", { name: "Atualizar metas", exact: true }).click();
  await expect.poll(async () => (await trace(page)).filter(row => row.method === "host-refresh").length).toBe(2);
  await expect(acknowledge).toBeDisabled();
  expect((await trace(page)).filter(row => row.method === "page")).toHaveLength(initialPages);
  expect((await trace(page)).filter(row => row.method === "acknowledge")).toEqual([]);
  await page.getByRole("button", { name: "Atualizar metas", exact: true }).click();
  await expect(acknowledge).toBeEnabled();
  expect((await trace(page)).filter(row => row.method === "host-refresh")).toHaveLength(3);
  expect((await trace(page)).filter(row => row.method === "page")).toHaveLength(initialPages + 1);
  expect((await trace(page)).filter(row => row.method === "acknowledge")).toEqual([]);
  await acknowledge.click(); await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeEnabled();
  expect((await trace(page)).filter(row => row.method === "execute")).toEqual([]);
});

for (const width of [320, 390, 1440]) for (const theme of ["light", "dark"]) test(`Metas isolated ${width}px ${theme}: composition, fields and keyboard`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page, {}, theme); await visual(page);
  await page.evaluate(() => document.fonts.ready);
  // Public synthetic fixtures only: retain actual PNGs for prototype review.
  // These captures do not certify the hosted workspace, Auth or persistence.
  await page.screenshot({ path: testInfo.outputPath(`goals-list-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
  const trigger = page.getByRole("button", { name: "Nova meta financeira", exact: true }); await trigger.click();
  await expect(page.getByLabel("Nome da meta", { exact: true })).toBeVisible(); await visual(page);
  await page.screenshot({ path: testInfo.outputPath(`goals-editor-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Adicionar valor", exact: true }).click(); await expect(page.getByRole("dialog")).toBeVisible(); await visual(page);
  await page.screenshot({ path: testInfo.outputPath(`goals-detail-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adicionar valor", exact: true })).toBeFocused();
  expect((await trace(page)).filter(row => ["prepare", "execute"].includes(row.method))).toHaveLength(0);
});
for (const width of [320, 390, 1440]) for (const theme of ["light", "dark"]) test(`Metas public image ${width}px ${theme}: prototype cover and detail columns`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page, { image: true }, theme); await page.evaluate(() => document.fonts.ready);
  const cover = page.getByRole("button", { name: "Abrir meta Viagem dos sonhos", exact: true });
  await expect(cover.locator("img")).toBeVisible(); await expect.poll(() => cover.locator("img").evaluate(node => node instanceof HTMLImageElement ? node.naturalWidth : 0)).toBeGreaterThan(0);
  await visual(page); await page.screenshot({ path: testInfo.outputPath(`goals-image-card-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
  await cover.click(); const detail = page.locator(".fg-detail"), image = detail.locator(".fg-detail-image img");
  await expect(image).toBeVisible(); await expect.poll(() => image.evaluate(node => node instanceof HTMLImageElement ? node.naturalWidth : 0)).toBeGreaterThan(0); await visual(page);
  await expect(detail.locator(".fg-deadline")).toHaveText("Até 1 de jul. de 2027");
  const geometry = await detail.evaluate(node => {
    const image = node.querySelector(".fg-detail-image")!.getBoundingClientRect(), content = node.querySelector(".fg-detail-content")!.getBoundingClientRect();
    return { imageRight: image.right, imageBottom: image.bottom, contentLeft: content.left, contentTop: content.top };
  });
  if (width > 600) expect(geometry.imageRight).toBeLessThanOrEqual(geometry.contentLeft); else expect(geometry.imageBottom).toBeLessThanOrEqual(geometry.contentTop);
  await page.screenshot({ path: testInfo.outputPath(`goals-image-detail-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
  const cancel = page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true });
  await cancel.focus(); await expect(cancel).toBeFocused(); await expect(cancel).toBeInViewport(); await cancel.click(); await expect(cover).toBeFocused();
  expect((await trace(page)).filter(row => ["prepare", "execute"].includes(row.method))).toHaveLength(0);
});
for (const outcome of ["forbidden", "corrupt"] as const) test(`image ${outcome} collapses without deleting its saved reference or writing`, async ({ page }) => {
  await mount(page, { image: true }, "dark", outcome);
  await expect(page.locator(".fg-cover")).toBeHidden(); await expect(page.locator(".fg-card img")).toHaveCount(0);
  await page.getByRole("button", { name: "Adicionar valor", exact: true }).click(); await expect(page.getByRole("dialog").getByRole("heading", { name: "Viagem dos sonhos", exact: true })).toBeVisible();
  await expect(page.locator(".fg-detail img")).toHaveCount(0); await expect(page.locator(".fg-detail-content")).toBeVisible(); await visual(page);
  const collapsed = await page.locator(".fg-detail").evaluate(node => {
    const detail = node.getBoundingClientRect(), content = node.querySelector(".fg-detail-content")!.getBoundingClientRect();
    return { left: Math.abs(detail.left - content.left), width: Math.abs(detail.width - content.width) };
  });
  expect(collapsed.left).toBeLessThanOrEqual(1); expect(collapsed.width).toBeLessThanOrEqual(1);
  const snapshot = await page.evaluate(() => window.__goalsSnapshot()) as { goals: { image_file_id: string | null }[] };
  expect(snapshot.goals[0]!.image_file_id).toBe(imageId); expect((await trace(page)).filter(row => ["prepare", "execute"].includes(row.method))).toHaveLength(0);
});
for (const theme of ["light", "dark"]) test(`compact featured image ${theme} preserves the prototype edge and explicit highlight`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 }); await mount(page, { compact: true, image: true, featured: true }, theme);
  const cover = page.getByRole("button", { name: "Abrir meta Viagem dos sonhos", exact: true });
  await expect(cover.locator("img")).toBeVisible(); await expect.poll(() => cover.locator("img").evaluate(node => node instanceof HTMLImageElement ? node.naturalWidth : 0)).toBeGreaterThan(0);
  const geometry = await page.locator(".fg-featured").evaluate(node => {
    const surface = node.getBoundingClientRect(), cover = node.querySelector(".fg-cover")!.getBoundingClientRect(), body = node.querySelector(".fg-card-body")!;
    return { left: Math.abs(surface.left - cover.left), right: Math.abs(surface.right - cover.right), paddingLeft: parseFloat(getComputedStyle(body).paddingLeft) };
  });
  expect(geometry.left).toBeLessThanOrEqual(1); expect(geometry.right).toBeLessThanOrEqual(1); expect(geometry.paddingLeft).toBe(16); await visual(page);
  await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: testInfo.outputPath(`goals-image-featured-390-${theme}.png`), fullPage: true, animations: "disabled" });
  expect((await trace(page)).filter(row => ["prepare", "execute"].includes(row.method))).toHaveLength(0);
});
test("mask removes progress, percentages and monetary inputs until explicit reveal", async ({ page }) => { await mount(page, { hidden: true }); await expect(page.locator(".fg-surface progress")).toHaveCount(0); await expect(page.locator(".fg-surface")).not.toContainText("40%"); await expect(page.locator(".fg-surface")).toContainText("R$ ••••"); await openNew(page); await expect(page.getByLabel("Quanto quer guardar?", { exact: true })).toHaveCount(0); await page.getByRole("dialog").getByRole("button", { name: "Exibir valores", exact: true }).click(); await expect(page.getByLabel("Quanto quer guardar?", { exact: true })).toBeVisible(); expect((await trace(page)).filter(row => row.method === "execute")).toEqual([]); });
test("empty and unavailable are distinct and neither writes domain data", async ({ page }) => { await mount(page, { empty: true }); await expect(page.getByRole("button", { name: "Criar primeira meta", exact: true })).toBeVisible(); expect((await trace(page)).filter(row => row.method === "execute")).toHaveLength(0); });
test("unavailable keeps an honest message and no fake goal", async ({ page }) => { await mount(page, { mode: "unavailable" }); await expect(page.getByText("Metas financeiras não estão disponíveis nesta sessão.")).toBeVisible(); await expect(page.locator(".fg-card")).toHaveCount(0); expect((await trace(page)).some(row => row.method === "page")).toBe(false); });
test("review precedes durable seam stage and one explicit confirmation", async ({ page }) => { await mount(page, { empty: true }); await openNew(page); await fillNew(page); expect((await trace(page)).filter(row => row.method === "execute")).toHaveLength(0); await page.getByRole("button", { name: "Criar meta", exact: true }).click(); await expect(page.getByText(/Operação confirmada/)).toBeVisible(); const calls = await trace(page), stage = calls.findIndex(row => row.method === "stage"), execute = calls.findIndex(row => row.method === "execute"); expect(stage).toBeGreaterThan(-1); expect(execute).toBeGreaterThan(stage); expect(calls[stage]!.clientId).toBe(calls[execute]!.clientId); await page.getByRole("button", { name: "Atualizar metas", exact: true }).click(); await expect(page.getByRole("button", { name: "Reserva da viagem", exact: true })).toBeVisible(); });
test("invalid fields preserve the draft without prepare or execute", async ({ page }) => { await mount(page); await openNew(page); await page.getByLabel("Nome da meta", { exact: true }).fill("Texto preservado"); await page.getByLabel("Quanto quer guardar?", { exact: true }).fill("1,005"); await page.getByRole("button", { name: "Revisar nova meta", exact: true }).click(); await expect(page.getByRole("alert")).toBeVisible(); await expect(page.getByLabel("Nome da meta", { exact: true })).toHaveValue("Texto preservado"); expect((await trace(page)).filter(row => ["prepare", "execute"].includes(row.method))).toHaveLength(0); });
test("quota refuses dispatch and preserves inputs", async ({ page }) => { await mount(page, { empty: true, mode: "quota" }); await openNew(page); await fillNew(page); await page.getByRole("button", { name: "Criar meta", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("nenhum envio"); await expect(page.getByLabel("Nome da meta", { exact: true })).toHaveValue("Reserva da viagem"); expect((await trace(page)).filter(row => row.method === "execute")).toHaveLength(0); });
test("lost response reconciles the same UUID with no second execute", async ({ page }) => { await mount(page, { empty: true, mode: "lost-response" }); await openNew(page); await fillNew(page); await page.getByRole("button", { name: "Criar meta", exact: true }).click(); await page.getByRole("button", { name: "Consultar tentativa", exact: true }).click(); await expect(page.getByText(/Operação confirmada/)).toBeVisible(); const calls = await trace(page), writes = calls.filter(row => row.method === "execute"), reads = calls.filter(row => row.method === "reconcile"); expect(writes).toHaveLength(1); expect(reads).toHaveLength(1); expect(reads[0]!.clientId).toBe(writes[0]!.clientId); });
test("no receipt remains uncertain and blocks a different UUID", async ({ page }) => { await mount(page, { empty: true, mode: "no-receipt" }); await openNew(page); await fillNew(page); await page.getByRole("button", { name: "Criar meta", exact: true }).click(); await page.getByRole("button", { name: "Consultar tentativa", exact: true }).click(); await expect(page.getByRole("button", { name: "Consultar tentativa", exact: true })).toBeVisible(); await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeDisabled(); expect((await trace(page)).filter(row => row.method === "prepare")).toHaveLength(1); expect((await trace(page)).filter(row => row.method === "execute")).toHaveLength(1); });
test("contribution excludes card and history offers explicit partial release", async ({ page }) => { await mount(page); await page.getByRole("button", { name: "Adicionar valor", exact: true }).click(); await expect(page.getByLabel("Conta de origem")).not.toContainText("Cartão não elegível"); await page.getByText("Histórico e outras ações", { exact: true }).click(); await page.getByRole("button", { name: "Ver aportes e liberações", exact: true }).click(); await page.getByRole("button", { name: /Liberar valor do aporte/ }).click(); await page.getByLabel("Valor a liberar", { exact: true }).fill("50,00"); await page.getByRole("button", { name: "Revisar liberação", exact: true }).click(); expect((await trace(page)).filter(row => row.method === "execute")).toHaveLength(0); await page.getByRole("button", { name: "Liberar valor", exact: true }).click(); await expect(page.getByText(/Operação confirmada/)).toBeVisible(); });
test("identity replacement removes A form and unresolved body from fixture B", async ({ page }) => { await mount(page, { empty: true, mode: "no-receipt" }); await openNew(page); await fillNew(page); await page.getByRole("button", { name: "Criar meta", exact: true }).click(); await page.evaluate(() => window.__changeGoalsOwner({ ownerId: "22222222-2222-4222-8222-222222222222", empty: true })); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(page.getByRole("button", { name: "Criar primeira meta", exact: true })).toBeVisible(); await expect(page.locator("body")).not.toContainText("Reserva da viagem"); expect((await trace(page)).filter(row => row.method === "execute" && row.owner !== "11111111-1111-4111-8111-111111111111")).toHaveLength(0); });
test("after-contribution preview is labelled, masked and has zero domain writes", async ({ page }) => { await mount(page); await page.getByRole("button", { name: "Adicionar valor", exact: true }).click(); await page.getByLabel("Valor", { exact: true }).fill("50,00"); await page.getByLabel("Conta de origem", { exact: true }).selectOption("33333333-3333-4333-8333-333333333333"); await page.getByRole("button", { name: "Revisar aporte", exact: true }).click(); const projection = page.locator(".fg-after-contribution"); await expect(projection).toContainText("Após o aporte:"); await expect(projection).toContainText("2.450,00"); await expect(projection).toContainText("a reconferir pelo servidor"); expect((await trace(page)).filter(row => row.method === "execute")).toHaveLength(0); await page.evaluate(() => window.__setGoalsHidden(true)); await expect(projection).toContainText("R$ ••••"); await expect(projection).not.toContainText("2.450,00"); await expect(projection).not.toContainText("%"); await expect(page.getByRole("dialog").locator("progress")).toHaveCount(0); await expect(page.getByRole("dialog").getByLabel("Valor", { exact: true })).toHaveCount(0); expect((await trace(page)).filter(row => row.method === "execute")).toHaveLength(0); });
test("explicit editor Cancel restores focus without preparing or sending a command", async ({ page }) => { await mount(page); const trigger = page.getByRole("button", { name: "Nova meta financeira", exact: true }); await openNew(page); await page.getByLabel("Nome da meta", { exact: true }).fill("Draft que será descartado"); await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(trigger).toBeFocused(); expect((await trace(page)).filter(row => ["prepare", "execute"].includes(row.method))).toHaveLength(0); });

for (const width of [320, 390]) for (const theme of ["light", "dark"]) test(`terminal confirmation ${width}px ${theme} is inline, masked and cancellable without dispatch`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(page, { empty: true, pending: true, terminal: "normal", hidden: true }, theme);
  const before = await page.evaluate(() => window.__goalsSnapshot()), trigger = page.getByRole("button", { name: "Encerrar esta tentativa", exact: true });
  expect((await trace(page)).filter(row => row.method.startsWith("attempt-") || row.method === "execute")).toHaveLength(0);
  await trigger.click(); const title = page.getByRole("heading", { name: "Encerrar esta tentativa?", exact: true });
  await expect(title).toBeFocused(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/Isso não desfaz valores já registrados\./)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Reserva da viagem"); await visual(page); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath(`goals-terminal-confirmation-${width}-${theme}.png`), fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Voltar", exact: true }).click(); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.__goalsSnapshot())).toEqual(before);
  expect((await trace(page)).filter(row => row.method.startsWith("attempt-") || row.method === "execute")).toHaveLength(0);
});

test("terminal status alone remains uncertain without clearing or settling the pending original", async ({ page }) => {
  await mount(page, { empty: true, pending: true, terminal: "normal" }); const before = await page.evaluate(() => window.__goalsSnapshot());
  await page.getByRole("button", { name: "Consultar tentativa", exact: true }).click(); await expect(page.getByRole("alert")).toBeVisible();
  expect(await page.evaluate(() => window.__goalsSnapshot())).toEqual(before);
  await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeDisabled();
  const calls = await trace(page); expect(calls.filter(row => row.method === "attempt-status")).toHaveLength(1);
  expect(calls.filter(row => ["attempt-settle", "execute", "reconcile", "prepare"].includes(row.method))).toHaveLength(0);
});

test("explicit terminal settlement closes once, keeps financial data intact and requires refresh plus human review", async ({ page }) => {
  await mount(page, { empty: true, pending: true, terminal: "normal" });
  await page.getByRole("button", { name: "Encerrar esta tentativa", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar encerramento", exact: true }).evaluate(node => { if (!(node instanceof HTMLButtonElement)) throw Error("Expected confirmation button"); node.click(); node.click(); });
  const status = page.getByRole("status").filter({ hasText: /^Tentativa encerrada\./ }); await expect(status).toBeVisible(); await expect(status).toBeFocused();
  await expect(page.locator("body")).not.toContainText("Operação confirmada.");
  expect(await page.evaluate(() => window.__goalsSnapshot())).toMatchObject({ goals: [], reservations: [], releases: [], journal: { pending: null, reconfirmRequired: true }, terminalDispositions: [{ client_id: "88888888-8888-4888-8888-888888888888" }] });
  await expect(page.getByRole("button", { name: "Conferi os dados atuais", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Atualizar metas", exact: true }).click();
  await page.getByRole("button", { name: "Conferi os dados atuais", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Metas financeiras", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeEnabled();
  const calls = await trace(page); expect(calls.filter(row => row.method === "attempt-settle")).toHaveLength(1);
  expect(calls.filter(row => ["execute", "prepare", "reconcile"].includes(row.method))).toHaveLength(0);
});

test("terminal settlement recognizes an already completed command without reversal or a second execute", async ({ page }) => {
  await mount(page, { empty: true, mode: "lost-response", terminal: "normal" }); await openNew(page); await fillNew(page);
  await page.getByRole("button", { name: "Criar meta", exact: true }).click();
  await page.getByRole("button", { name: "Encerrar esta tentativa", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar encerramento", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^O resultado desta tentativa foi confirmado\./ })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Tentativa encerrada.");
  const calls = await trace(page), executed = calls.filter(row => row.method === "execute"), settled = calls.filter(row => row.method === "attempt-settle");
  expect(executed).toHaveLength(1); expect(settled).toHaveLength(1); expect(settled[0]!.clientId).toBe(executed[0]!.clientId);
  expect(await page.evaluate(() => window.__goalsSnapshot())).toMatchObject({ goals: [{ name: "Reserva da viagem" }], reservations: [], releases: [], terminalDispositions: [], journal: { pending: null, reconfirmRequired: true } });
});

test("a lost terminal response is recovered by a new explicit status, without another settlement", async ({ page }) => {
  await mount(page, { empty: true, pending: true, terminal: "lost-response" });
  await page.getByRole("button", { name: "Encerrar esta tentativa", exact: true }).click(); await page.getByRole("button", { name: "Confirmar encerramento", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible(); await expect(page.getByRole("heading", { name: "Encerrar esta tentativa?", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Voltar", exact: true }).click(); await page.getByRole("button", { name: "Consultar tentativa", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Tentativa encerrada\./ })).toBeVisible();
  const calls = await trace(page); expect(calls.filter(row => row.method === "attempt-settle")).toHaveLength(1); expect(calls.filter(row => row.method === "attempt-status")).toHaveLength(1);
  expect(calls.filter(row => row.method === "execute")).toHaveLength(0);
});

test("terminal failure preserves confirmation and pending body, without unlocking another command", async ({ page }) => {
  await mount(page, { empty: true, pending: true, terminal: "fail" }); const before = await page.evaluate(() => window.__goalsSnapshot());
  await page.getByRole("button", { name: "Encerrar esta tentativa", exact: true }).click(); await page.getByRole("button", { name: "Confirmar encerramento", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible(); await expect(page.getByRole("button", { name: "Confirmar encerramento", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.__goalsSnapshot())).toEqual(before); expect((await trace(page)).filter(row => row.method === "attempt-settle")).toHaveLength(1);
  expect((await trace(page)).filter(row => row.method === "execute")).toHaveLength(0);
});

test("new-operation flag off keeps recovery controls and owner replacement removes confirmation", async ({ page }) => {
  await mount(page, { empty: true, pending: true, terminal: "normal", mode: "unavailable" });
  await page.getByRole("button", { name: "Encerrar esta tentativa", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Encerrar esta tentativa?", exact: true })).toBeFocused();
  await page.evaluate(() => window.__changeGoalsOwner({ ownerId: "22222222-2222-4222-8222-222222222222", empty: true, terminal: "normal" }));
  await expect(page.getByRole("button", { name: "Confirmar encerramento", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeEnabled();
  expect((await trace(page)).filter(row => row.method === "attempt-settle" || row.method === "execute")).toHaveLength(0);
});

test("new-operation flag off permits terminal closure without exposing new financial operations", async ({ page }) => {
  await mount(page, { empty: true, pending: true, terminal: "normal", mode: "unavailable" });
  await page.getByRole("button", { name: "Encerrar esta tentativa", exact: true }).click(); await page.getByRole("button", { name: "Confirmar encerramento", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Tentativa encerrada\./ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeDisabled();
  expect((await trace(page)).filter(row => row.method === "attempt-settle")).toHaveLength(1);
  expect((await trace(page)).filter(row => ["execute", "prepare", "page"].includes(row.method))).toHaveLength(0);
});
