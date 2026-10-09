import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rolldown } from "rolldown";

// This isolated synthetic harness renders the production timeline and Drawer.
// It does not exercise Auth/Google/persistence or require any server credentials.
let bundle: string, styles: string;
test.beforeAll(async () => {
  const bundler = await rolldown({ input: resolve("tests/e2e/fixtures/calendar-timeline-browser.tsx"), platform: "browser", tsconfig: false, resolve: { alias: { "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); }, plugins: [{
    name: "calendar-fixture-css", resolveId(source) { if (source.endsWith(".css")) return "\0calendar-fixture-css"; },
    load(id) { if (id === "\0calendar-fixture-css") return "export {};"; },
  }] });
  try {
    const generated = await bundler.generate({ format: "iife" });
    const chunk = generated.output.find(output => output.type === "chunk");
    if (!chunk || chunk.type !== "chunk") throw new Error("Calendar browser fixture unavailable.");
    bundle = chunk.code;
  } finally { await bundler.close(); }
  styles = (await Promise.all([
    "design-system/tokens/tokens.css", "src/components/ui/utilities.css", "src/components/ui/button.css",
    "src/components/ui/dialog.css", "src/components/features/calendario/calendar.css",
  ].map(path => readFile(path, "utf8")))).join("\n");
  const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2");
  styles += `\n@font-face { font-family: Geist; src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2"); font-style:normal; font-weight:100 900; }
    :root { --font-geist-sans: Geist; } * { box-sizing:border-box; } body { margin:0; background:var(--canvas); color:var(--ink); font:var(--type-corpo-forte)/1.6 var(--font-family); }
    main { padding:16px; max-width:1184px; margin-inline:auto; } h1 { margin:0 0 16px; font-size:var(--type-h2); }`;
});

for (const width of [390, 1440]) for (const theme of ["light", "dark"] as const) for (const view of ["day", "week"] as const) {
  test(`calendário: colisões preservam alvo44 e detalhes em ${width}px, ${theme}, ${view}`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    for (const count of [4, 8]) {
      await page.setContent(`<html lang="pt-BR" data-theme="${theme}"><head><style>${styles}</style></head><body><div id="calendar-fixture"></div></body></html>`);
      await page.addScriptTag({ content: bundle });
      expect(errors).toEqual([]);
      await page.evaluate(({ view, count }) => (globalThis as unknown as { __calendarTimelineFixture(options: { view: "day" | "week"; count: number }): void }).__calendarTimelineFixture({ view, count }), { view, count });
      const region = page.getByRole("region", { name: view === "week" ? "Grade semanal com rolagem interna" : "Grade do dia com rolagem interna" });
      await expect(region).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const buttons = region.getByRole("button");
      await expect(buttons).toHaveCount(count);
      const geometry = await region.evaluate(element => ({
        documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
        internalWidth: element.scrollWidth, availableWidth: element.clientWidth,
        targets: Array.from(element.querySelectorAll("button")).map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
        aligned: Array.from(element.querySelectorAll(".calendar-time-day")).every(day => {
          const header = day.querySelector(".calendar-day-label")!.getBoundingClientRect();
          const timeline = day.querySelector(".calendar-timeline")!.getBoundingClientRect();
          return Math.abs(header.left - timeline.left) < 0.01 && Math.abs(header.width - timeline.width) < 0.01;
        }),
      }));
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.aligned).toBe(true);
      if (width === 390 && (view === "week" || count === 8) || view === "week" && count === 8) expect(geometry.internalWidth).toBeGreaterThan(geometry.availableWidth);
      for (const target of geometry.targets) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }
      for (let index = 0; index < count; index++) {
        const button = buttons.nth(index);
        await button.scrollIntoViewIfNeeded();
        await button.click();
        const dialog = page.getByRole("dialog", { name: "Reunião simultânea " + (index + 1), exact: true });
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(button).toBeFocused();
      }
      await page.screenshot({ path: info.outputPath(`calendar-collisions-${count}.png`), fullPage: true });
      const evidence = info.outputPath(`calendar-collisions-${count}.json`);
      await writeFile(evidence, JSON.stringify(geometry, null, 2));
      await info.attach(`calendar-collisions-${count}.json`, { path: evidence, contentType: "application/json" });
    }
    expect(errors).toEqual([]);
  });
}
