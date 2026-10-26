import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
let bundle: string;
test.beforeAll(async () => {
  const entry = resolve("tests/e2e/fixtures/command-feedback-lifetime.tsx").replaceAll("\\", "/");
  const builder = await rolldown({ input: entry, platform: "browser", tsconfig: false,
    resolve: { alias: { "@/lib/demo/demo-provider": entry, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "finite-feedback-presentation-port", resolveId(source) {
      if (source.endsWith(".css")) return "\0feedback-css";
      if (source === "next/link") return "\0feedback-link";
    }, load(id) {
      if (id === "\0feedback-css") return "export {};";
      if (id === "\0feedback-link") return "export { FeedbackNavigationLink as default } from " + JSON.stringify(entry) + ";";
    } }],
  });
  try { const generated = await builder.generate({ format: "iife", codeSplitting: false }); const chunk = generated.output[0];
    if (generated.output.length !== 1 || chunk?.type !== "chunk" || chunk.imports.length || chunk.dynamicImports.length) throw new Error("Closed feedback fixture required.");
    bundle = chunk.code;
  } finally { await builder.close(); }
});
type StateName = "idle" | "confirmed" | "rejected" | "unknown" | "journal-error" | "session-changed";
async function select(page: Page, name: StateName) {
  await page.evaluate(value => (globalThis as unknown as { __feedbackLifetime: { select(name: StateName): void } }).__feedbackLifetime.select(value), name);
}
async function counts(page: Page) {
  return page.evaluate(() => (globalThis as unknown as { __feedbackLifetime: { counts(): { mounts: number; unmounts: number; sequence: number; calls: { retry: number; initialize: number } } } }).__feedbackLifetime.counts());
}
async function mount(page: Page, mode: "connected" | "demo") {
  const unexpected: string[] = [];
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.isNavigationRequest() && url.href === "https://feedback-lifetime.test/probe") {
      await route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="pt-BR"><body><div id="feedback-lifetime"></div></body></html>' }); return;
    }
    unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  await page.goto("https://feedback-lifetime.test/probe"); await page.addScriptTag({ content: bundle });
  await page.evaluate(value => (globalThis as unknown as { __startFeedbackLifetime(mode: "connected" | "demo"): void }).__startFeedbackLifetime(value), mode);
  await expect(page.getByLabel("Rascunho do editor-probe", { exact: true })).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ mounts: 1, unmounts: 0, sequence: 1, calls: { retry: 0, initialize: 0 } });
  return unexpected;
}
test("avisos preservam a instância React e o rascunho, revogação remove o conteúdo", async ({ page }) => {
  const unexpected = await mount(page, "connected"), draft = page.getByLabel("Rascunho do editor-probe", { exact: true });
  await draft.fill("RASCUNHO_SINTETICO_PRESERVADO");
  const retained = await draft.elementHandle(); expect(retained).not.toBeNull();
  const banner = page.getByRole("region", { name: "Confirmação de envio", exact: true });
  for (const state of ["confirmed", "idle", "rejected", "unknown", "journal-error", "idle"] as const) {
    await select(page, state);
    if (state === "idle") await expect(banner).toHaveCount(0); else await expect(banner).toBeVisible();
    expect(await retained!.evaluate(node => node.isConnected), state).toBe(true);
    await expect(draft).toHaveValue("RASCUNHO_SINTETICO_PRESERVADO");
    await expect.poll(() => counts(page)).toEqual({ mounts: 1, unmounts: 0, sequence: 1, calls: { retry: 0, initialize: 0 } });
    if (state === "unknown") {
      await expect(banner.getByRole("button", { name: "Confirmar envio", exact: true })).toBeVisible();
      await expect(banner.getByRole("button", { name: "Dispensar aviso", exact: true })).toHaveCount(0);
    }
  }
  await select(page, "confirmed"); await banner.getByRole("button", { name: "Dispensar aviso", exact: true }).click();
  await expect(banner).toHaveCount(0); expect(await retained!.evaluate(node => node.isConnected)).toBe(true); await expect(draft).toHaveValue("RASCUNHO_SINTETICO_PRESERVADO");
  await select(page, "session-changed"); await expect(banner.getByRole("alert")).toContainText("A conta foi alterada");
  await expect(draft).toHaveCount(0); expect(await retained!.evaluate(node => node.isConnected)).toBe(false);
  await expect.poll(() => counts(page)).toEqual({ mounts: 1, unmounts: 1, sequence: 1, calls: { retry: 0, initialize: 0 } });
  expect(await page.content()).not.toContain("RASCUNHO_SINTETICO_PRESERVADO"); expect(unexpected).toEqual([]);
});
test("demo e idle conservam o mesmo slot sem banner ou envio automático", async ({ page }) => {
  const unexpected = await mount(page, "demo"), draft = page.getByLabel("Rascunho do editor-probe", { exact: true });
  await draft.fill("RASCUNHO_DEMO_SINTETICO");
  const retained = await draft.elementHandle(); expect(retained).not.toBeNull();
  for (const state of ["confirmed", "unknown", "idle", "rejected"] as const) {
    await select(page, state); await expect(page.getByRole("region", { name: "Confirmação de envio", exact: true })).toHaveCount(0);
    expect(await retained!.evaluate(node => node.isConnected)).toBe(true); await expect(draft).toHaveValue("RASCUNHO_DEMO_SINTETICO");
    await expect.poll(() => counts(page)).toEqual({ mounts: 1, unmounts: 0, sequence: 1, calls: { retry: 0, initialize: 0 } });
  }
  expect(unexpected).toEqual([]);
});
