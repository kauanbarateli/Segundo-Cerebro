import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import type { KnowledgeFixtureOptions, KnowledgeFixtureState } from "./fixtures/knowledge-workspace-context";
let bundle: string, styles: string;
test.beforeAll(async () => {
  const fixtureContext = resolve("tests/e2e/fixtures/knowledge-workspace-context.tsx").replaceAll("\\", "/");
  const bundler = await rolldown({ input: resolve("tests/e2e/fixtures/knowledge-workspace-browser.tsx"), platform: "browser", tsconfig: false,
    resolve: { alias: { "@/lib/demo/demo-provider": fixtureContext, "next/navigation": fixtureContext, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); }, plugins: [{
      name: "knowledge-synthetic-channel",
      resolveId(source) { if (source.endsWith(".css")) return "\0knowledge-css"; if (source === "next/link" || source === "next/dynamic") return "\0" + source; },
      load(id) {
        if (id === "\0knowledge-css") return "export {};";
        if (id === "\0next/link") return `export { NavigationLink as default } from ${JSON.stringify(fixtureContext)};`;
        if (id === "\0next/dynamic") return `import { createElement, lazy, Suspense } from 'react'; export default function dynamic(loader, options = {}) { const Component = lazy(loader); return function Dynamic(props) { return createElement(Suspense, { fallback: options.loading ? createElement(options.loading) : null }, createElement(Component, props)); }; }`;
      },
    }] });
  try { const generated = await bundler.generate({ format: "iife", codeSplitting: false }); const chunk = generated.output.find(output => output.type === "chunk"); if (!chunk || chunk.type !== "chunk") throw new Error("Knowledge browser fixture unavailable."); bundle = chunk.code; }
  finally { await bundler.close(); }
  styles = (await Promise.all(["design-system/tokens/tokens.css", "src/components/ui/utilities.css", "src/components/ui/button.css", "src/components/ui/field.css", "src/components/ui/card.css", "src/components/ui/dialog.css", "src/components/features/conhecimento/knowledge.css"].map(path => readFile(path, "utf8")))).join("\n");
  const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2");
  styles += `\n@font-face { font-family:Geist; src:url(data:font/woff2;base64,${font.toString("base64")}) format("woff2"); font-style:normal; font-weight:100 900; } :root { --font-geist-sans:Geist; } * { box-sizing:border-box; } body { margin:0; background:var(--canvas); color:var(--ink); font:var(--type-corpo-forte)/1.6 var(--font-family); } main { padding:16px; max-width:1184px; margin-inline:auto; } h1 { margin:0 0 16px; font-size:var(--type-h2); } main > nav { display:flex; gap:16px; margin-bottom:16px; } main > nav a { min-height:44px; display:inline-flex; align-items:center; color:var(--ink); }`;
});
type Fixture = { state(): KnowledgeFixtureState; remoteUpdate(id: string, title: string, text: string): Promise<unknown> };
async function mount(page: Page, theme: "light" | "dark", options: KnowledgeFixtureOptions = {}) {
  // HTTPS is intercepted locally: WebCrypto is real, and no remote server is used.
  await page.route("https://knowledge-fixture.test/**", route => route.fulfill({ status: 200, contentType: "text/html", body: `<html lang="pt-BR" data-theme="${theme}"><head><style>${styles}</style></head><body><div id="knowledge-fixture"></div></body></html>` }));
  await page.goto("https://knowledge-fixture.test/conhecimento"); await page.addScriptTag({ content: bundle });
  await page.evaluate(options => (globalThis as unknown as { __startKnowledgeFixture(options: KnowledgeFixtureOptions): void }).__startKnowledgeFixture(options), options);
  await expect(page.getByRole("button", { name: "Novo caderno", exact: true })).toBeVisible();
}
const state = (page: Page) => page.evaluate(() => (globalThis as unknown as { __knowledgeFixture: Fixture }).__knowledgeFixture.state());

for (const width of [390, 1280]) for (const theme of ["light", "dark"] as const) {
  test(`Conhecimento: TipTap cria wiki-link e backlink em ${width}px ${theme}`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" }); await mount(page, theme);
    const editor = page.getByRole("textbox", { name: "Conteúdo da página", exact: true }); await expect(editor).toBeVisible();
    await editor.fill("Referência para "); await editor.press("End"); await editor.pressSequentially("[[Destino novo");
    await page.getByRole("button", { name: "Criar página “Destino novo”", exact: true }).click();
    await expect(page.getByText("Referência conectada.", { exact: true })).toBeVisible();
    const reference = page.locator(".knowledge-backlinks").filter({ has: page.getByRole("heading", { name: "Referências nesta página", exact: true }) }).getByRole("link", { name: "Destino novo", exact: true });
    await reference.click(); await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue("Destino novo");
    const backlinks = page.locator(".knowledge-backlinks").filter({ has: page.getByRole("heading", { name: "Referências a esta página", exact: true }) });
    await expect(backlinks.getByRole("link", { name: "Origem", exact: true })).toBeVisible();
    const result = await state(page); const target = result.pages.find(row => row.title === "Destino novo")!; expect(result.refs.some(ref => ref.target_id === target.id)).toBe(true);
    expect(result.writes.map(write => write.command)).toContain("knowledge.page.resolve-ref"); expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath("knowledge-wiki-backlink.png"), fullPage: true });
  });
}
for (const onlyDeleted of [false, true]) test(`Conhecimento: CTA inicial cria caderno/página com TipTap real (somente excluídos=${onlyDeleted})`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await mount(page, "light", { empty: true, onlyDeleted });
  const first = page.getByRole("button", { name: "Criar primeiro caderno", exact: true }); await expect(first).toBeEnabled(); await first.click();
  const notebook = page.getByRole("dialog", { name: "Novo caderno", exact: true }); await notebook.getByLabel("Nome do caderno", { exact: true }).fill("Primeiro caderno"); await notebook.getByRole("button", { name: "Salvar caderno", exact: true }).click(); await expect(notebook).toBeHidden();
  await page.getByRole("button", { name: "Criar primeira página", exact: true }).click(); const modal = page.getByRole("dialog", { name: "Nova página", exact: true });
  await modal.getByLabel("Título da página", { exact: true }).fill("Primeira página"); await modal.getByRole("button", { name: "Criar página", exact: true }).click(); await expect(modal).toBeHidden();
  await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue("Primeira página"); await expect(page.getByRole("textbox", { name: "Conteúdo da página", exact: true })).toBeVisible();
});
test("Conhecimento: conflito remoto mantém TipTap/rascunho até a escolha explícita", async ({ page }) => {
  await mount(page, "light"); const title = page.getByLabel("Título da página", { exact: true }), editor = page.getByRole("textbox", { name: "Conteúdo da página", exact: true });
  await title.fill("Meu rascunho"); await editor.fill("Texto ainda não salvo"); const original = (await state(page)).pages[0]!;
  await page.evaluate(async id => (globalThis as unknown as { __knowledgeFixture: Fixture }).__knowledgeFixture.remoteUpdate(id, "Outra sessão", "Texto remoto"), original.id);
  await page.getByRole("button", { name: "Salvar página", exact: true }).click(); await expect(page.getByRole("heading", { name: "Há uma versão mais recente", exact: true })).toBeVisible();
  await expect(title).toHaveValue("Meu rascunho"); await expect(editor).toContainText("Texto ainda não salvo"); expect((await state(page)).pages[0]?.title).toBe("Outra sessão");
  await page.getByRole("button", { name: "Salvar meu rascunho sobre a atual", exact: true }).click(); await expect(page.getByRole("button", { name: "Salvar página", exact: true })).toBeDisabled();
  expect((await state(page)).pages[0]).toMatchObject({ title: "Meu rascunho", content_text: "Texto ainda não salvo", version: 3 });
});
test("Conhecimento: shell/Voltar conserva TipTap e descarte exige confirmação", async ({ page }) => {
  await mount(page, "dark"); const title = page.getByLabel("Título da página", { exact: true }), editor = page.getByRole("textbox", { name: "Conteúdo da página", exact: true });
  await title.fill("Rascunho de navegação"); await editor.fill("Conteúdo retido somente em memória"); await page.getByRole("link", { name: "Outro módulo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Outro módulo", exact: true })).toBeVisible(); await page.goBack(); await expect(title).toHaveValue("Rascunho de navegação"); await expect(editor).toContainText("Conteúdo retido somente em memória");
  await page.getByRole("button", { name: "Descartar rascunho", exact: true }).click(); const modal = page.getByRole("dialog", { name: "Descartar o rascunho?", exact: true }); await modal.getByRole("button", { name: "Cancelar", exact: true }).click(); await expect(title).toHaveValue("Rascunho de navegação");
  await page.getByRole("button", { name: "Descartar rascunho", exact: true }).click(); await modal.getByRole("button", { name: "Descartar alterações", exact: true }).click(); await expect(title).toHaveValue("Origem"); await expect(editor).toContainText("Texto inicial");
  expect((await state(page)).writes).toHaveLength(0); const persisted = await page.evaluate(() => ({ ...localStorage, ...sessionStorage })); expect(JSON.stringify(persisted)).not.toContain("Conteúdo retido somente em memória");
});
