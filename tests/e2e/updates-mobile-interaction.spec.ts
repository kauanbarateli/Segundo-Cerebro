/** Real board and CSS, synthetic editorial content and fulfilled navigation.
 * Does not validate authentication, Next routing, hosted data or process-wide network. */
import { expect, test, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { assertInlineBrowserChunk } from "./helpers/inline-browser-chunk.mjs";

const origin = "https://updates-mobile.test";
let script: string, css: string;
test.use({ serviceWorkers: "block", trace: "off", video: "off" });

test.beforeAll(async () => {
  const build = await rolldown({
    input: resolve("tests/e2e/fixtures/updates-mobile-interaction.tsx"), platform: "browser", tsconfig: false,
    resolve: { alias: { "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "updates-mobile-css", resolveId(source) { if (source.endsWith(".css")) return "\0updates-mobile-css"; }, load(id) { if (id === "\0updates-mobile-css") return "export {};"; } }],
  });
  try {
    const generated = await build.generate({ format: "iife", codeSplitting: false }), chunk = generated.output[0];
    if (generated.output.length !== 1 || chunk?.type !== "chunk") throw new Error("Standalone synthetic board required.");
    assertInlineBrowserChunk(chunk); script = chunk.code;
  } finally { await build.close(); }
  css = (await Promise.all([
    readFile("design-system/tokens/tokens.css", "utf8"), readFile("src/components/ui/aliases.css", "utf8"),
    readFile("src/components/ui/field.css", "utf8"), readFile("src/components/features/atualizacoes/updates.css", "utf8"),
  ])).join("\n");
});

async function serve(context: BrowserContext, theme: "light" | "dark") {
  const blocked: string[] = [];
  await context.routeWebSocket("**/*", (socket) => { blocked.push("UNEXPECTED_WEBSOCKET"); socket.close(); });
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET" || !request.isNavigationRequest() || url.origin !== origin || url.search || !["/", "/inicio"].includes(url.pathname)) {
      blocked.push("UNEXPECTED_REQUEST"); await route.abort(); return;
    }
    if (url.pathname === "/inicio") {
      await route.fulfill({ contentType: "text/html", body: "<!doctype html><html lang='pt-BR'><head><link rel='icon' href='data:,'></head><body><h1>Destino sintético</h1></body></html>" }); return;
    }
    await route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><main id="updates-mobile-test"></main></body></html>` });
  });
  return blocked;
}

for (const width of [320, 390]) for (const theme of ["light", "dark"] as const) {
  test(`quadro móvel ${width}px ${theme}: filtro, estados vazios e entrega pelo teclado`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 844 });
    const blocked = await serve(context, theme), errors: string[] = [];
    page.on("pageerror", () => errors.push("PAGE_ERROR"));
    await page.goto(origin + "/"); await page.addScriptTag({ content: script });
    const filter = page.getByRole("combobox", { name: "Etapa" });
    await expect(filter).toBeVisible(); await expect(filter).toHaveValue("all");
    await expect(page.locator("#updates-planned")).toBeVisible();
    await expect(page.locator("#updates-testing")).toBeVisible();
    await expect(page.locator('section[aria-labelledby="updates-planned"] .updates-item h3')).toHaveText(["Planejamento inicial", "Planejamento posterior"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    await page.keyboard.press("Tab"); await expect(filter).toBeFocused();
    const outline = await filter.evaluate((element) => ({ style: getComputedStyle(element).outlineStyle, width: parseFloat(getComputedStyle(element).outlineWidth) }));
    expect(outline.style).not.toBe("none"); expect(outline.width).toBeGreaterThanOrEqual(2);
    for (const [value, heading] of [["planned", "planned"], ["analysis", "analysis"], ["progress", "progress"], ["testing", "testing"], ["released", "released"]] as const) {
      await page.keyboard.press("ArrowDown"); await expect(filter).toHaveValue(value);
      for (const name of ["planned", "analysis", "progress", "testing", "released"]) {
        if (name === heading) await expect(page.locator(`#updates-${name}`)).toBeVisible();
        else await expect(page.locator(`#updates-${name}`)).toBeHidden();
      }
      if (value === "testing") await expect(page.getByText("Nenhuma atualização nesta etapa.", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    }
    const evidence = page.getByRole("link", { name: "Ver entrega: Entrega sintética" });
    await expect(evidence).toHaveAttribute("href", "/inicio");
    await page.keyboard.press("Tab"); await expect(evidence).toBeFocused(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(origin + "/inicio"); await expect(page.getByRole("heading", { name: "Destino sintético" })).toBeVisible();
    expect(blocked).toEqual([]); expect(errors).toEqual([]);
  });
}


test("mudança de largura preserva o foco e restaura todas as etapas", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const blocked = await serve(context, "light"), errors: string[] = [];
  page.on("pageerror", () => errors.push("PAGE_ERROR"));
  await page.goto(origin + "/"); await page.addScriptTag({ content: script });
  const filter = page.getByRole("combobox", { name: "Etapa" });
  await expect(filter).toBeVisible();
  await filter.selectOption("planned");
  await expect(page.locator("#updates-released")).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 844 });
  await expect(page.locator("#updates-released")).toBeVisible();
  await expect(page.locator("#updates-stage")).toHaveValue("all");
  const evidence = page.getByRole("link", { name: "Ver entrega: Entrega sintética" });
  await page.keyboard.press("Tab"); await expect(evidence).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(filter).toHaveValue("all");
  await expect(evidence).toBeVisible(); await expect(evidence).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(origin + "/inicio");
  expect(blocked).toEqual([]); expect(errors).toEqual([]);
});
