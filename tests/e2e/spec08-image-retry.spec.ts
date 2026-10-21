import { expect, test, type Page } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Original React editors + connected application/journal, synthetic HTTP seams.
// Not an Auth/Storage service, SQL integration, screenshot or commercial proof.
test.describe.configure({ mode: "serial" });
const user = "10000000-0000-4000-8000-000000000001", upload = "10000000-0000-4000-8000-000000000002", project = "10000000-0000-4000-8000-000000000003";
const origin = "http://127.0.0.1:3100", storage = "http://127.0.0.1:54321", path = `/storage/v1/object/upload/sign/second-brain-staging/${user}/${upload}`;
const cssPaths = ["src/components/ui/button.css", "src/components/ui/dialog.css", "src/components/ui/field.css", "src/components/layout/private-image.css"];
let bundle = "", styles = "";
test.beforeAll(async () => {
  if (process.platform !== "linux" || !process.env.CI) throw new Error("Image retry browser fixture requires Linux GitHub CI.");
  const entry = resolve("tests/e2e/fixtures/spec08-image-retry-browser.tsx"), discovered = new Set<string>();
  const build = await rolldown({ input: entry, platform: "browser", tsconfig: false, resolve: { alias: { "@": resolve("src"), "next/navigation": entry } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "image-retry-css-boundary", resolveId(source, importer) {
      if (source.endsWith(".css")) { assert.ok(importer && source.startsWith(".")); const file = resolve(dirname(importer), source); assert.ok(!relative(resolve("src"), file).startsWith("..")); discovered.add(file); return "\0image-retry-css"; }
    }, load(id) { if (id === "\0image-retry-css") return "export {};"; } }] });
  try {
    const { output } = await build.generate({ format: "iife", codeSplitting: false }); assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.deepEqual(chunk.dynamicImports, []); bundle = chunk.code;
    assert.deepEqual([...discovered].sort(), cssPaths.map(p => resolve(p)).sort());
    const global = resolve("src/app/globals.css"); styles = (await postcss([tailwind()]).process(await readFile(global, "utf8"), { from: global })).css + "\n" + (await Promise.all(cssPaths.map(p => readFile(p, "utf8")))).join("\n");
    const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"); styles += "\n@font-face{font-family:Spec08Geist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:Spec08Geist}";
    assert.ok(!/@import\s/.test(styles)); for (const match of styles.matchAll(/url\(([^)]*)\)/g)) assert.match(match[1]!.replaceAll(/["']/g, "").trim(), /^data:/);
  } finally { await build.close(); }
});
type Failure = "reserve" | "put-stored" | "put-missing" | "finalize" | "binding" | "project";
async function fixture(page: Page, editor: "entity" | "project", failure: Failure) {
  let failed = false, stored = false, finalized = false, bound = false, projectSaved = false;
  const trace = { reserves: [] as string[], puts: 0, observes: 0, finalize: [] as string[], binding: [] as string[], projects: [] as string[], refused: [] as string[], effects: { file: 0, binding: 0, project: 0 } };
  const purpose = editor === "project" ? "project_cover" : "home_focus_image", now = "2026-10-21T00:00:00Z";
  const file = { id: upload, user_id: user, kind: purpose, folder_id: null, name: "imagem.png", mime: "image/png", bytes: 68, sha256: "a".repeat(64), width: 1, height: 1, starred: false, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now, modified_at: now };
  const row = { id: project, user_id: user, name: "Projeto de prova", description: null, color_key: "work", position: 0, deleted_at: null, created_at: now, updated_at: now };
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method(), json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.origin === origin && url.pathname === "/__spec08-image-retry" && method === "GET") { await route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="pt-BR" data-theme="light"><head><link rel="icon" href="data:,"><style>${styles}</style></head><body><div id="spec08-image-retry"></div></body></html>` }); return; }
    if (url.origin === storage && url.pathname === path && url.search === "?token=synthetic-only") {
      const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "PUT", "Access-Control-Allow-Headers": "x-upsert,content-type" };
      if (method === "OPTIONS") { await route.fulfill({ status: 204, headers }); return; }
      if (method === "PUT") { trace.puts++; assert.equal(req.headers()["x-upsert"], "false"); assert.equal(req.headers()["authorization"], undefined); assert.equal(req.headers()["cookie"], undefined);
        if (!failed && (failure === "put-stored" || failure === "put-missing")) { failed = true; stored = failure === "put-stored"; await route.abort("failed"); return; }
        assert.equal(stored, false, "No second PUT may overwrite an already observed object."); stored = true; await route.fulfill({ status: 200, headers, body: "{}" }); return;
      }
    }
    if (url.origin === origin && method === "POST" && url.pathname === "/api/files/uploads") {
      trace.reserves.push(req.postData()!); const input = req.postDataJSON(); assert.deepEqual(Object.keys(input).sort(), ["client_id", "folder_id", "kind", "name"]); assert.equal(input.kind, purpose); assert.equal(input.name, "imagem.png"); assert.equal(req.headers()["x-expected-user-id"], user);
      if (!failed && failure === "reserve") { failed = true; await route.abort("failed"); return; }
      await json({ id: upload, upload_url: storage + path + "?token=synthetic-only", token: "synthetic-only", expires_at: new Date(Date.now() + 120_000).toISOString() }); return;
    }
    if (url.origin === origin && method === "GET" && url.pathname === "/api/files/uploads/observe") {
      trace.observes++; assert.equal(url.searchParams.get("upload"), upload); assert.equal(url.searchParams.get("purpose"), purpose); assert.equal(url.searchParams.get("client_id"), JSON.parse(trace.reserves[0]!).client_id);
      await json({ version: 1, user_id: user, upload_id: upload, purpose, state: finalized ? "final" : stored ? "staging" : "missing-observed", file: finalized ? file : null }); return;
    }
    if (url.origin === origin && method === "POST" && url.pathname === "/api/files") {
      const value = req.postDataJSON();
      if (value.command === "file.upload.finalize") {
        trace.finalize.push(req.postData()!); assert.equal(stored, true); assert.equal(value.input.upload_id, upload); assert.equal(value.input.client_id, JSON.parse(trace.reserves[0]!).client_id);
        if (!finalized) { finalized = true; trace.effects.file++; }
        if (!failed && failure === "finalize") { failed = true; await route.abort("failed"); return; }
        await json({ ok: true, result: file }); return;
      }
      if (value.command === "file.entity-image.set") {
        trace.binding.push(req.postData()!); assert.equal(finalized, true); assert.equal(value.input.expected_file_id, null); assert.equal(value.input.file_id, upload); assert.equal(value.input.purpose, purpose);
        if (editor === "project") assert.equal(projectSaved, true);
        if (!bound) { bound = true; trace.effects.binding++; }
        if (!failed && failure === "binding") { failed = true; await route.abort("failed"); return; }
        await json({ ok: true, result: { version: 1, user_id: user, id: editor === "project" ? project : user, purpose, file_id: upload } }); return;
      }
    }
    if (url.origin === origin && method === "POST" && url.pathname === "/api/projects-habits" && editor === "project") {
      trace.projects.push(req.postData()!); const value = req.postDataJSON(); assert.equal(value.command, "project.create"); assert.equal(value.input.name, row.name);
      if (!projectSaved) { projectSaved = true; trace.effects.project++; }
      if (!failed && failure === "project") { failed = true; await route.abort("failed"); return; }
      await json({ ok: true, result: row }); return;
    }
    trace.refused.push(method + " " + url.origin + url.pathname); await route.abort("blockedbyclient");
  });
  await page.goto(origin + "/__spec08-image-retry"); await page.addScriptTag({ content: bundle });
  await page.evaluate(value => { const start = (window as unknown as { __startSpec08ImageRetry(editor: string): void }).__startSpec08ImageRetry; start(value); }, editor);
  return trace;
}
for (const editor of ["entity", "project"] as const) for (const failure of ["reserve", "put-stored", "put-missing", "finalize", "binding", ...(editor === "project" ? ["project" as const] : [])] as const) {
  test(`${editor}: ${failure} preserves the mounted attempt and original journal inputs`, async ({ page }) => {
    const trace = await fixture(page, editor, failure); await page.getByRole("button", { name: "Abrir editor" }).click();
    const dialog = page.getByRole("dialog"); if (editor === "project") await dialog.getByLabel("Nome do projeto", { exact: true }).fill("Projeto de prova");
    const picker = dialog.getByLabel(editor === "project" ? "Escolher capa" : "Imagem opcional", { exact: true });
    await picker.setInputFiles({ name: "imagem.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") });
    await dialog.getByRole("button", { name: editor === "project" ? "Criar projeto" : "Salvar imagem", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible(); await expect(picker).toBeDisabled(); await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeDisabled(); await expect(dialog.getByRole("button", { name: "Fechar", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Desfazer escolha", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Tentar o mesmo envio", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Resultado", { exact: true })).toHaveText(editor === "project" ? project : upload);
    expect(trace.refused).toEqual([]); expect(new Set(trace.reserves).size).toBe(1); expect(trace.puts).toBe(failure === "put-missing" ? 2 : 1);
    expect(trace.observes).toBe(failure.startsWith("put-") ? 1 : 0); expect(trace.effects).toEqual({ file: 1, binding: 1, project: editor === "project" ? 1 : 0 });
    expect(new Set(trace.finalize).size).toBe(1); expect(new Set(trace.binding).size).toBe(1);
    if (editor === "project") { expect(new Set(trace.projects).size).toBe(1); expect(trace.projects).toHaveLength(failure === "project" ? 2 : 1); }
  });
}
for (const editor of ["entity", "project"] as const) test(`${editor}: cancel and reopen before sending has no reservation or journal effect`, async ({ page }) => {
  const trace = await fixture(page, editor, "reserve"), trigger = page.getByRole("button", { name: "Abrir editor" });
  await trigger.click(); await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await expect(page.getByRole("dialog")).toBeVisible();
  expect(trace.reserves).toEqual([]); expect(trace.puts).toBe(0); expect(trace.finalize).toEqual([]); expect(trace.binding).toEqual([]); expect(trace.projects).toEqual([]); expect(trace.refused).toEqual([]);
});
