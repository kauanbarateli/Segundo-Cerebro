/** Positive Home/Knowledge composition with the real connected reader/client.
 * HTTP/Auth/routing are synthetic; no SQL, hosted or destination-reader claim. */
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import type { Caderno, ConhecimentoDTO, Pagina } from "../../src/core/conhecimento";
import { createDemoFixture } from "../../src/lib/demo/fixtures";
import { emptyHomeImage, isHomeImageRead } from "./helpers/home-image-read";

const origin = "https://home-recent-pages.test", now = "2026-10-26T15:00:00.000Z";
const owner = "77000000-0000-4000-8000-000000000001", foreign = "77000000-0000-4000-8000-000000000002";
const id = (suffix: number) => "77000000-0000-4000-8000-" + String(suffix).padStart(12, "0");
let bundle: string, styles: string;
test.beforeAll(async () => {
  const navigation = resolve("tests/e2e/fixtures/home-preferences-navigation.tsx").replaceAll("\\", "/");
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/home-recent-pages-browser.tsx"), platform: "browser", tsconfig: false,
    resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "home-recent-routing-and-css", resolveId(source) {
      if (source.endsWith(".css")) return "\0home-recent-css";
      if (source === "next/link") return "\0home-recent-link";
    }, load(name) {
      if (name === "\0home-recent-css") return "export {};";
      if (name === "\0home-recent-link") return `export { NavigationLink as default } from ${JSON.stringify(navigation)};`;
    } }],
  });
  try {
    const generated = await build.generate({ format: "iife", codeSplitting: false }), chunk = generated.output[0];
    if (generated.output.length !== 1 || !chunk || chunk.type !== "chunk" || chunk.imports.length || chunk.dynamicImports.some(value => value !== chunk.fileName)) throw new Error("Standalone Home recent bundle is required.");
    bundle = chunk.code;
  } finally { await build.close(); }
  const paths = ["design-system/tokens/tokens.css", "src/components/ui/aliases.css", "src/components/ui/utilities.css", "src/components/ui/button.css", "src/components/ui/card.css", "src/components/ui/badge.css", "src/components/ui/data-display.css", "src/components/features/inicio/home.css"];
  styles = (await Promise.all(paths.map(path => readFile(path, "utf8")))).join("\n");
  const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2");
  styles += `\n@font-face{font-family:Geist;src:url(data:font/woff2;base64,${font.toString("base64")});font-weight:100 900}:root{--font-geist-sans:Geist}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:var(--type-corpo-forte)/1.6 var(--font-family)}main{max-width:1184px;margin-inline:auto;padding:16px}main>button{min-height:44px}main>output{display:block}`;
});

function book(suffix: number, name: string, actor = owner): Caderno {
  return { id: id(suffix), user_id: actor, name, project_id: null, position: suffix, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now };
}
function page(suffix: number, notebook: Caderno, title: string, updatedAt: string, actor = notebook.user_id): Pagina {
  const text = "PRIVATE_BODY_FIXTURE";
  return { id: id(suffix), user_id: actor, notebook_id: notebook.id, parent_id: null, origin_capture_id: null, title, normalized_title: title.toLowerCase(),
    document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }, content_text: text,
    version: 1, position: suffix, archived_at: null, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: updatedAt };
}
function dataset() {
  const study = book(100, "Estudos sintéticos"), work = book(101, "Trabalho sintético"), deleted = { ...book(102, "Caderno excluído"), deleted_at: now }, other = book(103, "FOREIGN_BOOK_SENTINEL", foreign);
  const a = page(201, study, "Página A primeiro empate", "2026-10-25T02:30:00.000Z"), b = page(202, work, "Página B segundo empate", a.updated_at), c = page(203, study, "Página C anterior", "2026-10-23T19:00:00.000Z");
  const rows = [page(204, study, "Página D além do limite", "2026-10-22T12:00:00.000Z"), { ...page(205, study, "Página arquivada", now), archived_at: now }, b,
    { ...page(206, study, "Página excluída", now), deleted_at: now }, page(207, deleted, "Página de caderno excluído", now), c, page(208, other, "FOREIGN_PAGE_SENTINEL", now), a];
  return { books: [study, work, deleted, other], pages: rows, expected: [a, b, c], expectedBooks: [study, work, study] };
}
type Mode = "data" | "empty" | "failure" | "foreign-page" | "foreign-book";
async function mount(browserPage: Page, { visible = true, mode = "data", theme = "light" }: { visible?: boolean; mode?: Mode; theme?: "light" | "dark" } = {}) {
  const data = dataset(), trace = { knowledge: [] as { expectedUser: string | undefined; status: number }[], unexpected: [] as string[], errors: [] as string[], writes: 0 };
  let phase: Mode = mode;
  browserPage.on("pageerror", error => trace.errors.push(error.message));
  await browserPage.clock.install({ time: new Date(now) });
  const capture = { ...createDemoFixture(now, owner).initial.capture![0]!, title: "CAPTURE_IS_NOT_A_KNOWLEDGE_PAGE", status: "inbox" as const, organized_at: null };
  await browserPage.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store" }, body: JSON.stringify(value) });
    if (request.method() !== "GET" || request.postData() !== null) { trace.writes++; trace.unexpected.push("UNEXPECTED_WRITE"); await route.abort(); return; }
    if (request.isNavigationRequest() && url.pathname === "/" && !url.search && !url.hash) {
      await route.fulfill({ contentType: "text/html", body: `<html lang="pt-BR" data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body><div id="home-recent-pages"></div></body></html>` }); return;
    }
    if (request.headers()["x-expected-user-id"] !== owner) { trace.unexpected.push("UNBOUND_ACTOR"); await route.abort(); return; }
    if (isHomeImageRead(request, origin, owner)) { await json(emptyHomeImage(owner)); return; }
    if (url.pathname === "/api/capture-tasks" && url.search === "?query=captures") { await json({ items: [capture], categories: [], projects: [] }); return; }
    if (url.pathname === "/api/knowledge" && !url.search) {
      trace.knowledge.push({ expectedUser: request.headers()["x-expected-user-id"], status: phase === "failure" ? 503 : 200 });
      if (phase === "failure") { await json({ code: "UNAVAILABLE" }, 503); return; }
      // Declared server transport projection, never a claimed SQL/RLS proof.
      const value: ConhecimentoDTO = { revision: "fixture-1", notebooks: phase === "empty" ? [] : data.books.filter(row => row.user_id === owner), pages: phase === "empty" ? [] : data.pages.filter(row => row.user_id === owner), refs: [], links: [], targets: [] };
      if (phase === "foreign-page") value.pages.push(data.pages.find(row => row.user_id === foreign)!);
      if (phase === "foreign-book") value.notebooks.push(data.books.find(row => row.user_id === foreign)!);
      await json(value); return;
    }
    trace.unexpected.push("UNEXPECTED_READ"); await route.abort();
  });
  await browserPage.goto(origin + "/"); await browserPage.addScriptTag({ content: bundle });
  await browserPage.evaluate(({ owner, visible }) => (globalThis as unknown as { __startHomeRecentPages(userId: string, visible: boolean): void }).__startHomeRecentPages(owner, visible), { owner, visible });
  await expect(browserPage.locator("main")).toHaveAttribute("data-application-mode", "connected");
  return { data, trace, setMode(value: Mode) { phase = value; } };
}
const recent = (page: Page) => page.getByRole("region", { name: "Continue de onde parou", exact: true });
function clean(trace: Awaited<ReturnType<typeof mount>>["trace"]) {
  expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]); expect(trace.writes).toBe(0);
  expect(trace.knowledge.every(read => read.expectedUser === owner)).toBe(true);
}

for (const width of [390, 1440]) test(`páginas recentes usam cliente real, caderno, data SP, destino e limite de três em ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: width === 1440 ? "dark" : "light", reducedMotion: "reduce" });
  const { data, trace } = await mount(page, { theme: width === 1440 ? "dark" : "light" }), region = recent(page);
  const rows = region.locator(".home-recent-list > li"); await expect(rows).toHaveCount(3);
  expect(trace.knowledge.length).toBeGreaterThan(0);
  await expect(rows.locator("strong")).toHaveText(data.expected.map(row => row.title));
  for (const [index, source] of data.expected.entries()) {
    await expect(rows.nth(index).getByRole("link")).toHaveAttribute("href", "/conhecimento?note=" + source.id);
    await expect(rows.nth(index).locator("small")).toHaveText(data.expectedBooks[index]!.name + " · atualizada em " + (index === 2 ? "23 de out." : "24 de out."));
  }
  await expect(region.getByRole("link", { name: "Todas as páginas", exact: true })).toHaveAttribute("href", "/conhecimento");
  expect(await region.innerText()).not.toMatch(/FOREIGN_|PRIVATE_BODY_FIXTURE|CAPTURE_IS_NOT_A_KNOWLEDGE_PAGE|Página D além|Página arquivada|Página excluída|Caderno excluído/);
  await region.screenshot({ path: info.outputPath(`doc18-home-paginas-recentes-${width}-${width === 1440 ? "dark" : "light"}.png`) });
  const reads = trace.knowledge.length;
  await page.getByRole("button", { name: "Atualizar leitores reais", exact: true }).click(); await expect(page.getByLabel("Atualizações concluídas", { exact: true })).toHaveText("1");
  expect(trace.knowledge).toHaveLength(reads + 1); await expect(rows.locator("strong")).toHaveText(data.expected.map(row => row.title)); clean(trace);
});
test("Conhecimento oculto não monta a seção nem consulta seu endpoint, inclusive ao atualizar", async ({ page }) => {
  const { trace } = await mount(page, { visible: false });
  await expect(page.getByLabel("Acesso ao Conhecimento", { exact: true })).toHaveText('{"allowed":true,"visible":false}');
  await expect(page.getByText("CAPTURE_IS_NOT_A_KNOWLEDGE_PAGE", { exact: true })).toBeVisible();
  await expect(recent(page)).toHaveCount(0); expect(trace.knowledge).toHaveLength(0);
  await page.getByRole("button", { name: "Atualizar leitores reais", exact: true }).click(); await expect(page.getByLabel("Atualizações concluídas", { exact: true })).toHaveText("1");
  await expect(recent(page)).toHaveCount(0); expect(trace.knowledge).toHaveLength(0); clean(trace);
});
test("coleção vazia real não cai no legado de Capturar nem mostra falha", async ({ page }) => {
  const { trace } = await mount(page, { mode: "empty" }), region = recent(page);
  await expect(region.getByText("Suas páginas mais recentemente atualizadas aparecerão aqui.", { exact: true })).toBeVisible();
  await expect(region.getByRole("alert")).toHaveCount(0); await expect(region.locator(".home-note")).toHaveCount(0);
  expect(await region.innerText()).not.toContain("CAPTURE_IS_NOT_A_KNOWLEDGE_PAGE"); expect(trace.knowledge.length).toBeGreaterThan(0); clean(trace);
});
test("falha do leitor é distinta de vazio e retry usa a mesma conta para recuperar as páginas", async ({ page }) => {
  const fixture = await mount(page, { mode: "failure" }), region = recent(page);
  await expect(region.getByRole("alert")).toBeVisible(); await expect(region.getByText("Suas páginas mais recentemente atualizadas aparecerão aqui.", { exact: true })).toHaveCount(0);
  await expect(region.locator(".home-note")).toHaveCount(0); const before = fixture.trace.knowledge.length;
  expect(fixture.trace.knowledge.every(read => read.status === 503)).toBe(true);
  fixture.setMode("data"); await region.getByRole("button", { name: "Tentar novamente: páginas recentes", exact: true }).click();
  await expect(region.locator(".home-note")).toHaveCount(3); await expect(region.getByRole("alert")).toHaveCount(0);
  expect(fixture.trace.knowledge).toHaveLength(before + 1); expect(fixture.trace.knowledge.at(-1)!.status).toBe(200); clean(fixture.trace);
});
for (const mode of ["foreign-page", "foreign-book"] as const) test(`cliente real recusa ${mode} sem renderizar metadados alheios`, async ({ page }) => {
  const { trace } = await mount(page, { mode });
  await expect(page.getByLabel("Estado do cliente real", { exact: true })).toHaveText("session-changed");
  await expect(page.getByLabel("Mensagem do cliente real", { exact: true })).toHaveText("A conta deste navegador mudou. Recarregue a página para continuar na conta atual.");
  await expect(page.locator(".home-note")).toHaveCount(0); await expect(page.locator("main")).not.toContainText(/FOREIGN_|PRIVATE_BODY_FIXTURE/);
  expect(trace.knowledge.length).toBeGreaterThan(0); clean(trace);
});
