/** Actual disclosure component, public examples, no credentials or backend. */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { expect, test, type Page } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });
let bundle: string;
const origin = "https://vault-detail-visibility.invalid";
test.beforeAll(async () => {
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/vault-detail-visibility.tsx"), platform: "browser", tsconfig: false,
    resolve: { alias: { "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "vault-detail-no-backend", resolveId(source) {
      assert.ok(source !== "server-only" && !source.startsWith("@supabase/") && !source.startsWith("node:") && !source.includes("/adapters/"));
      if (source.endsWith(".css")) { assert.equal(source, "./button.css"); return "\0vault-detail-css"; }
    }, load(id) { if (id === "\0vault-detail-css") return "export {};"; } }],
  });
  try { const result = await build.generate({ format: "iife", codeSplitting: false }); assert.equal(result.output.length, 1); const chunk = result.output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); bundle = chunk.code; }
  finally { await build.close(); }
});
async function mount(page: Page) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    assert.equal(url.origin + url.pathname, origin + "/isolated"); assert.equal(route.request().method(), "GET");
    return route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="pt-BR"><body><div id="vault-detail-fixture"></div></body></html>' });
  });
  await page.goto(origin + "/isolated"); await page.addScriptTag({ content: bundle });
  await expect(page.getByRole("button", { name: "Revelar senha de Item 1", exact: true })).toBeVisible();
}
async function reveal(page: Page) { await page.getByRole("button", { name: /^Revelar senha de Item/ }).click(); await expect(page.getByText(/Exemplo público [AB]/)).toBeVisible(); }
async function masked(page: Page) { await expect(page.getByText(/Exemplo público [AB]/)).toHaveCount(0); }

test("starts masked and keyboard disclosure does not write storage or copy", async ({ page }) => {
  await mount(page); await masked(page);
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText() { throw Error("Disclosure must not copy"); } }, configurable: true }); });
  const button = page.getByRole("button", { name: "Revelar senha de Item 1", exact: true }); await button.focus(); await page.keyboard.press("Enter");
  await expect(page.getByText("Exemplo público A", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ocultar senha de Item 1", exact: true })).toBeFocused();
  await page.keyboard.press("Enter"); await masked(page);
  expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))).toEqual({ local: [], session: [] });
});
for (const action of ["Trocar item", "Trocar identidade", "Revogar acesso"] as const) test(`disclosure is not retained after ${action}`, async ({ page }) => {
  await mount(page); await reveal(page); await page.getByRole("button", { name: action, exact: true }).click(); await masked(page);
  if (action === "Trocar item") { await page.getByRole("button", { name: action, exact: true }).click(); await masked(page); }
  if (action === "Revogar acesso") { await page.getByRole("button", { name: "Autorizar acesso", exact: true }).click(); await masked(page); }
});
test("blur and hidden tab conceal without automatically revealing on return", async ({ page }) => {
  await mount(page); await reveal(page); await page.evaluate(() => window.dispatchEvent(new Event("blur"))); await masked(page);
  await reveal(page);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await masked(page);
  await page.getByRole("button", { name: "Revelar senha de Item 1", exact: true }).click(); await masked(page);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await masked(page); await reveal(page);
});
