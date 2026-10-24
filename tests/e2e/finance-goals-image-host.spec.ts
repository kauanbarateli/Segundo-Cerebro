/** Actual GoalsPanel channel + concrete binder/client/journals/coordinator.
 * Synthetic owned transports; no Provider, authenticated route or hosted proof. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { contrastRatio } from "../../design-system/validate.mjs";
import type { GoalImageHostFixtureOptions } from "./helpers/finance-goals-image-host-fixture";
import { describeVisualFailures, inspectVisualGuards } from "./helpers/visual-guards";

const origin = "https://goal-image-host.invalid", png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMICAj4DwAD1AHw410Q2gAAAABJRU5ErkJggg==", "base64");
let bundle: string, css: string; const requests = new WeakMap<Page, string[]>();
test.beforeAll(async () => {
  const paths = ["src/components/ui/button.css", "src/components/ui/field.css", "src/components/ui/dialog.css", "src/components/layout/private-image.css", "src/components/features/financeiro/goals/goals.css", "src/components/features/financeiro/goals/goal-image-picker.css"], absolute = paths.map(path => resolve(path)), found = new Set<string>();
  const build = await rolldown({ input: resolve("tests/e2e/helpers/finance-goals-image-host-fixture.tsx"), platform: "browser", tsconfig: false, resolve: { alias: { "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } }, onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); }, plugins: [{ name: "goals-image-host-boundary", resolveId(source, importer) {
    assert.ok(source !== "server-only" && !source.startsWith("@supabase/") && !source.startsWith("node:") && !source.includes("/adapters/"), "Server infrastructure entered isolated host");
    if (source.endsWith(".css")) { assert.ok(importer); const path = source.startsWith("@/") ? resolve("src", source.slice(2)) : resolve(dirname(importer), source); assert.ok(absolute.includes(path), "Undeclared stylesheet"); found.add(path); return "\0goal-image-host-css"; }
  }, load(id) { if (id === "\0goal-image-host-css") return "export {};"; } }] });
  try { const result = await build.generate({ format: "iife", codeSplitting: false }); assert.equal(result.output.length, 1); const chunk = result.output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.deepEqual([...found].sort(), [...absolute].sort()); bundle = chunk.code; } finally { await build.close(); }
  const globals = resolve("src/app/globals.css"); css = (await postcss([tailwind()]).process(await readFile(globals, "utf8"), { from: globals })).css + "\n" + (await Promise.all(paths.map(path => readFile(path, "utf8")))).join("\n");
  const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"); css += "\n@font-face{font-family:GoalsImageHostGeist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:GoalsImageHostGeist}";
});
test.afterEach(async ({ page }) => { expect(requests.get(page) ?? [], "No undeclared real request").toEqual([]); });
async function mount(page: Page, options: GoalImageHostFixtureOptions = {}, theme = "light") {
  const unexpected: string[] = []; requests.set(page, unexpected);
  await page.route("**/*", route => { const request = route.request(), url = new URL(request.url()); if (url.origin === origin && url.pathname === "/isolated" && request.method() === "GET") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="pt-BR" data-theme="${theme}"><body><div id="goal-image-host-root"></div></body></html>` }); unexpected.push(request.method() + " " + url.pathname); return route.fulfill({ status: 403, body: "Undeclared isolated request" }); });
  await page.goto(origin + "/isolated"); await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle }); await page.evaluate(input => window.__mountGoalImageHost(input), options);
  await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeEnabled();
}
const state = (page: Page) => page.evaluate(() => window.__goalImageHostState()), trace = (page: Page) => page.evaluate(() => window.__goalImageHostTrace());
async function openNew(page: Page) { await page.getByRole("button", { name: "Nova meta financeira", exact: true }).click(); await expect(page.getByRole("dialog")).toBeVisible(); await expect(page.getByLabel("Nome da meta", { exact: true })).toBeEnabled(); }
async function fill(page: Page) { await page.getByLabel("Nome da meta", { exact: true }).fill("Meta sintética do host"); await page.getByLabel("Quanto quer guardar?", { exact: true }).fill("100,00"); }
async function visual(page: Page) { const report = await inspectVisualGuards(page); for (const gate of ["overflow", "targets", "fields"] as const) expect(report[gate], describeVisualFailures(report, gate)).toEqual([]); }
const photoIO = (rows: Awaited<ReturnType<typeof trace>>) => rows.filter(row => ["reserve", "put", "observe", "finalize"].includes(row.kind));
async function assertTextContrast(page: Page, width: number, theme: string, info: TestInfo) {
  const dialog = page.getByRole("dialog"), recovery = dialog.getByRole("region", { name: "Recuperar envio original", exact: true });
  const status = recovery.getByRole("status"), back = recovery.getByRole("button", { name: "Voltar à edição atual", exact: true });
  await expect(dialog).toHaveCount(1); await expect(recovery).toHaveCount(1); await expect(back).toBeEnabled();
  await expect(status).toHaveText("O envio será consultado somente por sua ação.");
  await expect.poll(() => dialog.evaluate(element => element.getAnimations({ subtree: true }).every(animation => animation.playState === "finished" || animation.playState === "idle"))).toBe(true);
  const samples = [
    { name: "dialog-title", locator: dialog.getByRole("heading", { level: 2, name: "Nova meta financeira", exact: true }) },
    { name: "recovery-strong", locator: recovery.locator("p > strong") },
    { name: "recovery-explanation", locator: recovery.getByText("Você pode concluir somente aquele envio e depois voltar à meta atual. Nenhuma foto será vinculada aqui; a troca e a revisão financeira exigem ações separadas.", { exact: true }) },
    { name: "recovery-status", locator: status },
    { name: "active-return-button", locator: back.locator(".ui-button__label") },
  ];
  const pairs: { name: string; foreground: string; background: string; ratio: number }[] = [];
  for (const sample of samples) {
    await expect(sample.locator).toHaveCount(1); await expect(sample.locator).toBeVisible();
    const pair = await sample.locator.evaluate(element => {
      const color = (value: string) => {
        const match = /^rgb(a?)\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/.exec(value);
        if (!match || Boolean(match[1]) !== (match[5] !== undefined)) throw Error("TEXT_CONTRAST_COLOR_UNSUPPORTED");
        const channels = [Number(match[2]), Number(match[3]), Number(match[4])];
        if (channels.some(channel => channel > 255)) throw Error("TEXT_CONTRAST_COLOR_UNSUPPORTED");
        return { channels, alpha: match[5] === undefined ? 1 : Number(match[5]) };
      };
      const foreground = color(getComputedStyle(element).color);
      if (foreground.alpha !== 1) throw Error("TEXT_CONTRAST_FOREGROUND_NOT_OPAQUE");
      let background: ReturnType<typeof color> | null = null, opacity = 1;
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(style.opacity) || style.filter !== "none" || style.mixBlendMode !== "normal") throw Error("TEXT_CONTRAST_COMPOSITION_UNSUPPORTED");
        opacity *= Number(style.opacity);
        if (background) continue;
        if (style.backgroundImage !== "none") throw Error("TEXT_CONTRAST_BACKGROUND_UNSUPPORTED");
        const candidate = color(style.backgroundColor);
        if (candidate.alpha !== 0 && candidate.alpha !== 1) throw Error("TEXT_CONTRAST_BACKGROUND_NOT_OPAQUE");
        if (candidate.alpha === 1) background = candidate;
      }
      if (opacity !== 1 || !background) throw Error("TEXT_CONTRAST_OPAQUE_CHAIN_REQUIRED");
      const hex = (channels: readonly number[]) => "#" + channels.map(channel => channel.toString(16).padStart(2, "0")).join("");
      return { foreground: hex(foreground.channels), background: hex(background.channels) };
    });
    pairs.push({ name: sample.name, ...pair, ratio: contrastRatio(pair.foreground, pair.background) });
  }
  await info.attach(`goals-image-host-text-contrast-${width}-${theme}.json`, { body: Buffer.from(JSON.stringify({ version: 1, width, theme, threshold: 4.5, pairs }) + "\n"), contentType: "application/json" });
  for (const pair of pairs) expect(pair.ratio, pair.name + " textual contrast").toBeGreaterThanOrEqual(4.5);
}

test("the real panel opens one J2 only by editing and reuses A's same-scope editorKey", async ({ page }) => {
  await mount(page, { phase: "prepared", sameTarget: true }); const before = await state(page); expect(before.journals).toBe(0); await openNew(page); await page.getByRole("button", { name: "Consultar envio da foto", exact: true }).click();
  expect((await state(page)).upload).toEqual(before.upload); await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeFocused(); await openNew(page); await page.getByRole("button", { name: "Consultar envio da foto", exact: true }).click();
  const after = await state(page); expect(after.journals).toBe(1); expect(after.upload.attempt?.scope.editorKey).toBe("original-editor-A"); expect(after.upload).toEqual(before.upload); expect(photoIO(await trace(page))).toEqual([]); expect((await trace(page)).filter(row => row.kind === "financial-id")).toEqual([]);
});
test("foreign prepared A has explicit original-file recovery and never prepares the target", async ({ page }) => {
  await mount(page, { phase: "prepared" }); const before = await state(page); await openNew(page); await fill(page); const source = page.getByRole("region", { name: "Recuperar envio original" });
  await source.getByRole("button", { name: "Consultar fonte original", exact: true }).click(); await expect(page.getByLabel("Nome da meta")).toBeDisabled(); await source.getByRole("button", { name: "Retomar envio original", exact: true }).click(); await expect(source.getByRole("status")).toContainText("Escolha novamente");
  await source.getByLabel("Arquivo original do envio").setInputFiles({ name: "original.png", mimeType: "image/png", buffer: Buffer.from([2]) }); await expect(source.getByRole("alert")).toBeVisible(); expect((await state(page)).upload).toEqual(before.upload);
  await source.getByLabel("Arquivo original do envio").setInputFiles({ name: "original.png", mimeType: "image/png", buffer: png }); await source.getByRole("button", { name: "Retomar envio original", exact: true }).click(); await expect(source.getByRole("status")).toContainText("O envio original foi concluído");
  const after = await state(page), calls = await trace(page); expect(after.upload.attempt?.scope).toEqual(before.upload.attempt?.scope); expect(after.upload.attempt?.uploadClientId).toBe(before.upload.attempt?.uploadClientId); expect(after.upload.attempt?.phase).toBe("ready-unbound"); expect(calls.filter(row => ["preview", "financial-id", "execute"].includes(row.kind))).toEqual([]); expect(calls.filter(row => row.kind === "reserve")).toHaveLength(1);
  await source.getByRole("button", { name: "Voltar à edição atual", exact: true }).click(); await expect(page.getByLabel("Nome da meta")).toHaveValue("Meta sintética do host"); await expect(page.getByLabel("Nome da meta")).toBeEnabled();
});
test("flag false holds early A while explicit G0 reviews without a new photo or UUID", async ({ page }) => {
  await mount(page, { phase: "prepared", imagesEnabled: false }); const before = await state(page); await openNew(page); await fill(page); await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Consultar envio da foto", exact: true }).click(); await page.getByRole("button", { name: "Continuar sem nova foto", exact: true }).click(); await expect(page.getByRole("region", { name: "Revisar operação" })).toBeVisible();
  expect((await state(page)).upload).toEqual(before.upload); expect(photoIO(await trace(page))).toEqual([]); expect((await trace(page)).filter(row => row.kind === "execute")).toEqual([]); await page.getByRole("region", { name: "Revisar operação" }).getByRole("button", { name: "Criar meta", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await state(page); expect(after.saved?.image_file_id).toBeNull(); expect(after.upload).toEqual(before.upload); expect((await trace(page)).filter(row => row.kind === "financial-id")).toHaveLength(1); expect(photoIO(await trace(page))).toEqual([]);
});
test("flag false permits only the existing finalization path and still needs financial review", async ({ page }) => {
  await mount(page, { phase: "finalizing", imagesEnabled: false }); await openNew(page); const source = page.getByRole("region", { name: "Recuperar envio original" }); await source.getByRole("button", { name: "Consultar fonte original" }).click(); await source.getByRole("button", { name: "Retomar envio original" }).click(); await expect(source.getByRole("status")).toContainText("concluído");
  const calls = await trace(page); expect(photoIO(calls).map(row => row.kind)).toEqual(["finalize"]); expect(calls.filter(row => ["preview", "execute", "financial-id"].includes(row.kind))).toEqual([]);
});
test("a local journal refusal keeps the editor gated and never falls back to the legacy form", async ({ page }) => {
  await mount(page, { phase: "prepared", failJournal: true }); const before = await state(page); await page.getByRole("button", { name: "Nova meta financeira", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("registros foram preservados"); await expect(page.getByLabel("Nome da meta")).toHaveCount(0); await expect(page.getByRole("button", { name: "Revisar nova meta" })).toHaveCount(0); expect((await state(page)).upload).toEqual(before.upload); expect(photoIO(await trace(page))).toEqual([]);
});
test("privacy removes source and picker, remount preserves A and requires a new human preparation", async ({ page }) => {
  await mount(page, { phase: "prepared" }); const before = await state(page); await openNew(page);
  expect(await page.evaluate(() => { try { Reflect.apply(window.__setGoalsHostHidden, window, ["true"]); return false; } catch { return true; } })).toBe(true); await expect(page.getByLabel("Nome da meta")).toBeEnabled();
  await page.evaluate(() => window.__setGoalsHostHidden(true)); await expect(page.getByRole("dialog")).toBeVisible(); await expect(page.getByRole("region", { name: "Recuperar envio original" })).toHaveCount(0); await expect(page.locator('input[type="file"]')).toHaveCount(0); await expect(page.getByText("Arquivo original: original.png.", { exact: false })).toHaveCount(0);
  await page.evaluate(() => window.__setGoalsHostHidden(false)); await expect(page.getByRole("dialog")).toBeVisible(); await expect(page.getByRole("button", { name: "Conferir envio da foto", exact: true })).toBeVisible(); expect((await state(page)).upload).toEqual(before.upload); await page.getByRole("button", { name: "Conferir envio da foto", exact: true }).click(); await expect(page.getByLabel("Nome da meta")).toBeEnabled(); await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Desmontar painel" }).click(); await page.getByRole("button", { name: "Reabrir painel" }).click(); await openNew(page); expect((await state(page)).upload).toEqual(before.upload); expect(photoIO(await trace(page))).toEqual([]);
});
test("selected photo uses the actual channel and a separate explicit financial confirmation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 }); await mount(page, {}, "dark"); await openNew(page); await fill(page); await page.getByLabel("Imagem da meta (opcional)", { exact: true }).and(page.locator('input[type="file"]')).setInputFiles({ name: "new.png", mimeType: "image/png", buffer: png }); await page.getByRole("button", { name: "Revisar nova meta", exact: true }).click(); await expect(page.getByRole("region", { name: "Revisar operação" })).toBeVisible(); const calls = await trace(page); expect(calls.filter(row => row.kind === "execute")).toEqual([]); expect(calls.filter(row => row.kind === "finalize")).toHaveLength(1); expect(calls.filter(row => row.kind === "financial-id")).toHaveLength(1);
  await page.getByRole("region", { name: "Revisar operação" }).getByRole("button", { name: "Criar meta", exact: true }).scrollIntoViewIfNeeded(); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("goals-image-host-review-390-dark.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("region", { name: "Revisar operação" }).getByRole("button", { name: "Criar meta", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0); expect((await state(page)).saved?.image_file_id).toBe((await state(page)).upload.attempt?.uploadId); expect((await trace(page)).filter(row => row.kind === "execute")).toHaveLength(1);
});
for (const width of [320, 390, 768]) for (const theme of ["light", "dark"]) test(`source recovery remains private, keyboard usable and bounded at ${width}/${theme}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page, { phase: "prepared" }, theme); await openNew(page); await page.evaluate(() => document.fonts.ready); await visual(page); await assertTextContrast(page, width, theme, testInfo); await page.screenshot({ path: testInfo.outputPath(`goals-image-host-${width}-${theme}.png`), fullPage: true, animations: "disabled" }); await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Nova meta financeira", exact: true })).toBeFocused(); expect(photoIO(await trace(page))).toEqual([]);
});
