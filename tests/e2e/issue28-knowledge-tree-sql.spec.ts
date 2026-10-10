/** Original Knowledge/Capture UI, TipTap, providers, Core/Store/Gateway and
 * canonical disposable SQL. Auth catalogue, HTTP, Next navigation/dynamic/CSS
 * are explicit seams. This proves the stored graph and current selectors, not
 * recursive ARIA/drag UI, Next handlers, SDK, hosted services or visual parity.
 * Browser execution is Linux CI only. Pure preparation never runs callbacks.
 */
import assert from "node:assert/strict";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import type { KnowledgeRpc } from "../../src/adapters/db/knowledge-gateway";
import type { CaptureTaskOperation, CaptureTaskRpc } from "../../src/adapters/db/capture-task-gateway";
import type { Captura } from "../../src/core/capturas";
import type { Caderno, Pagina, DocumentoPagina, ComandoConhecimento } from "../../src/core/conhecimento";

type Product = typeof import("./fixtures/issue28-knowledge-tree-sql.entry");
export const treeOwner = "66000000-0000-4000-8000-000000000001", treeSession = "66000000-0000-4000-8000-000000000002";
const foreign = "66000000-0000-4000-8000-000000000003", foreignSession = "66000000-0000-4000-8000-000000000004";
const origin = "https://issue28-knowledge-tree-sql.test", uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let product: Product, bundle: string, styles: string;
test.use({ timezoneId: "UTC", trace: "off", video: "off", screenshot: "off" }); test.describe.configure({ retries: 0 });
export async function loadKnowledgeTreeProduct(): Promise<Product> {
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/issue28-knowledge-tree-sql.entry.ts"), platform: "node", tsconfig: false, resolve: { conditionNames: ["react-server", "node", "import", "default"] } });
  try { const { output } = await build.generate({ format: "es", codeSplitting: false }); assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.deepEqual(chunk.dynamicImports, []);
    const p = await import("data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64")) as Product;
    assert.deepEqual(Object.keys(p).sort(), ["AuthGuardError", "ErroDeDominio", "conhecimentoDTO", "createCaptureTaskGateway", "createCaptureTaskStore", "createKnowledgeGateway", "createKnowledgeStore", "decodeCaptureTaskRequest", "decodeKnowledgeCommand", "executarConhecimento", "executeCaptureTaskCommand", "leituraPagina", "leituraRelacionados"]); return p;
  } finally { await build.close(); }
}
// Explicit decomposition: generic controls -> layout -> domain. Discovery
// checks the exact closure; alphabetical discovery is never cascade authority.
const cssPaths = ["src/components/ui/button.css", "src/components/ui/card.css", "src/components/ui/data-display.css", "src/components/ui/dialog.css", "src/components/ui/field.css", "src/components/ui/toast.css", "src/components/layout/related-panel.css", "src/components/features/capturar/capture.css", "src/components/features/conhecimento/knowledge.css"];
export async function buildKnowledgeTreeBrowser() {
  const navigation = resolve("tests/e2e/fixtures/issue28-knowledge-tree-browser.tsx").replaceAll("\\", "/"), discovered = new Set<string>();
  const build = await rolldown({ input: navigation, platform: "browser", tsconfig: false, resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); }, plugins: [{ name: "knowledge-tree-next-css-boundaries", resolveId(source, importer) {
      if (source.endsWith(".css")) { assert.ok(importer && source.startsWith(".")); const path = resolve(dirname(importer), source), within = relative(resolve("src"), path); assert.ok(!within.startsWith("..") && !within.includes(":")); discovered.add(path); return "\0tree-css"; }
      if (source === "next/link") return "\0tree-link"; if (source === "next/dynamic") return "\0tree-dynamic";
    }, load(id) {
      if (id === "\0tree-css") return "export {};";
      if (id === "\0tree-link") return "export { NavigationLink as default } from " + JSON.stringify(navigation) + ";";
      if (id === "\0tree-dynamic") return "import {createElement,lazy,Suspense} from 'react';export default function dynamic(loader,options={}){const Component=lazy(loader);return function Dynamic(props){return createElement(Suspense,{fallback:options.loading?createElement(options.loading):null},createElement(Component,props));};}";
    } }] });
  try { const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "Issue28KnowledgeTreeFixture" }); assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.ok(chunk.dynamicImports.every(name => name === chunk.fileName)); assert.ok(!/\bimport\s*\(/.test(chunk.code)); assert.deepEqual([...discovered].sort(), cssPaths.map(path => resolve(path)).sort());
    const global = resolve("src/app/globals.css"); let css = (await postcss([tailwind()]).process(await readFile(global, "utf8"), { from: global })).css + "\n" + (await Promise.all(cssPaths.map(path => readFile(path, "utf8")))).join("\n");
    const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"); css += "\n@font-face{font-family:Issue28TreeGeist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:Issue28TreeGeist}";
    assert.ok(!/@import\s/.test(css)); for (const match of css.matchAll(/url\(([^)]*)\)/g)) assert.match(match[1]!.replaceAll(/["']/g, "").trim(), /^data:/); return { code: chunk.code, css, modules: Object.keys(chunk.modules) };
  } finally { await build.close(); }
}
test.beforeAll(async () => { if (process.platform !== "linux") throw new Error("Knowledge tree browser execution requires Linux CI."); product = await loadKnowledgeTreeProduct(); const built = await buildKnowledgeTreeBrowser(); bundle = built.code; styles = built.css; });

const knowledgeSql: Record<Parameters<KnowledgeRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  knowledge_snapshot: { sql: "select public.knowledge_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] }, knowledge_commit: { sql: "select public.knowledge_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] }, knowledge_receipt: { sql: "select public.knowledge_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
};
const captureSql: Record<Parameters<CaptureTaskRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  capture_task_snapshot: { sql: "select public.capture_task_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] }, capture_task_revision: { sql: "select public.capture_task_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] }, capture_task_commit: { sql: "select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] }, capture_task_receipt: { sql: "select public.capture_task_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
};
type Row = Record<string, unknown>;
const ledgerSql = {
  users: "select to_jsonb(t) as row from auth.users t order by id", sessions: "select to_jsonb(t) as row from auth.sessions t order by id", roles: "select to_jsonb(t) as row from public.user_roles t order by user_id", moderation: "select to_jsonb(t) as row from public.user_moderation t order by user_id", entitlements: "select to_jsonb(t) as row from public.user_entitlements t order by user_id,feature_key",
  notebooks: "select to_jsonb(t) as row from public.knowledge_notebooks t order by id", pages: "select to_jsonb(t) as row from public.knowledge_pages t order by id", refs: "select to_jsonb(t) as row from public.page_refs t order by id", links: "select to_jsonb(t) as row from public.links t order by id", captures: "select to_jsonb(t) as row from public.captures t order by id", tasks: "select to_jsonb(t) as row from public.tasks t order by id",
  events: "select to_jsonb(t) as row from public.domain_events t order by id", receipts: "select to_jsonb(t) as row from app_private.command_receipts t order by user_id,command,client_id", revision: "select to_jsonb(t) as row from app_private.capture_task_revisions t order by user_id", routineRevision: "select to_jsonb(t) as row from app_private.projects_habits_revisions t order by user_id", limits: "select to_jsonb(t) as row from app_private.rate_limits t order by scope,subject_hash",
};
type Physical = "knowledge_notebooks" | "knowledge_pages" | "captures";
const physical = new Set<Physical>(["knowledge_notebooks", "knowledge_pages", "captures"]);
export function treeText(text: string): DocumentoPagina { return { type: "doc", content: text.split("\n").map(line => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })) }; }
export async function createKnowledgeTreeFixture(p: Product) {
  const db = await createLocalCanonicalSql();
  try {
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','knowledge-tree-owner@example.invalid'),($2,'authenticated','authenticated','knowledge-tree-foreign@example.invalid')", [treeOwner, foreign]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)", [treeSession, treeOwner, foreignSession, foreign]);
    assert.deepEqual((await db.query("select role from public.user_roles order by user_id")).rows, [{ role: "user" }, { role: "user" }]);
    for (const actor of [treeOwner, foreign]) for (const feature of ["calendario", "financeiro", "habitos", "cofre"]) await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,$2,false)", [actor, feature]);
    const now = (await db.query<{ now: string }>(`select to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as now`)).rows[0]!.now;
    let sequence = 20; const deps = { clock: { now: () => now }, ids: { next: () => "66000000-0000-4000-8000-" + String(sequence++).padStart(12, "0") } };
    const calls: { name: string; operation: string; actor: string }[] = [];
    const bind = (actor: string, sid: string) => assert.ok(actor === treeOwner && sid === treeSession || actor === foreign && sid === foreignSession);
    async function rpc(sql: string, values: unknown[]) { return db.transaction(async tx => { await tx.exec("set local role service_role"); const { rows } = await tx.query<{ data: unknown }>(sql, values); assert.equal(rows.length, 1); return rows[0]!.data; }); }
    function knowledgeGateway(operation: string, actor = treeOwner, sid = treeSession) {
      bind(actor, sid); const transport: KnowledgeRpc = async (name, args) => { const spec = knowledgeSql[name]; assert.equal(args.p_user, actor); assert.equal(args.p_session, sid); assert.equal(args.p_operation, operation); assert.deepEqual(Object.keys(args).sort(), ["p_user", "p_session", "p_operation", ...spec.extra].sort()); calls.push({ name, operation, actor });
        try { return { data: await rpc(spec.sql, [actor, sid, operation, ...spec.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]), error: null }; } catch (error) { if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") throw error; return { data: null, error: { code: error.code } }; } };
      return p.createKnowledgeGateway(actor, sid, operation, transport);
    }
    function captureGateway(operation: CaptureTaskOperation, actor = treeOwner, sid = treeSession) {
      bind(actor, sid); const transport: CaptureTaskRpc = async (name, args) => { const spec = captureSql[name]; assert.equal(args.p_user, actor); assert.equal(args.p_session, sid); assert.equal(args.p_operation, operation); assert.deepEqual(Object.keys(args).sort(), ["p_user", "p_session", "p_operation", ...spec.extra].sort()); calls.push({ name, operation, actor });
        try { return { data: await rpc(spec.sql, [actor, sid, operation, ...spec.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]), error: null }; } catch (error) { if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") throw error; return { data: null, error: { code: error.code } }; } };
      return p.createCaptureTaskGateway(actor, sid, operation, transport);
    }
    async function command(value: unknown, actor = treeOwner, sid = treeSession) { const request = p.decodeKnowledgeCommand(value); return p.executarConhecimento(p.createKnowledgeStore(knowledgeGateway(request.command, actor, sid)), deps, { user_id: actor, canal: "web" }, request); }
    async function payload<T>(table: Physical, id: string, actor = treeOwner): Promise<T> { assert.ok(physical.has(table)); const { rows } = await db.query<{ payload: T }>(`select payload from public.${table} where user_id=$1 and id=$2`, [actor, id]); assert.equal(rows.length, 1); return rows[0]!.payload; }
    async function payloads<T>(table: Physical, actor = treeOwner): Promise<T[]> { assert.ok(physical.has(table)); return (await db.query<{ payload: T }>(`select payload from public.${table} where user_id=$1 order by id`, [actor])).rows.map(row => row.payload); }
    async function notebook(name: string, actor = treeOwner, sid = treeSession) { const result = await command({ command: "knowledge.notebook.create", input: { name, client_id: "setup-book-" + name } }, actor, sid) as Caderno; assert.deepEqual(await payload("knowledge_notebooks", result.id, actor), result); return result; }
    async function page(book: Caderno, title: string, parent: Pagina | null = null, text = "Texto de " + title, actor = treeOwner, sid = treeSession) { const result = await command({ command: "knowledge.page.create", input: { notebook_id: book.id, parent_id: parent?.id ?? null, title, document: treeText(text), client_id: "setup-page-" + book.id + "-" + title } }, actor, sid) as Pagina; assert.deepEqual(await payload("knowledge_pages", result.id, actor), result); return result; }
    async function capture(title: string, content: string, actor = treeOwner, sid = treeSession) { const request = p.decodeCaptureTaskRequest({ command: "capture.create", input: { title, content, type: "note", category_id: null, project_id: null, client_id: "setup-capture-" + title } }); const result = await p.executeCaptureTaskCommand(p.createCaptureTaskStore(captureGateway(request.command, actor, sid)), deps, { user_id: actor, canal: "web" }, request) as Captura; assert.deepEqual(await payload("captures", result.id, actor), result); return result; }
    async function link(from: Pagina, to: Captura, actor = treeOwner, sid = treeSession) { return command({ command: "knowledge.link.create", input: { from_type: "page", from_id: from.id, to_type: "capture", to_id: to.id, client_id: "setup-link-" + from.id } }, actor, sid); }
    async function ledger() { const result = {} as Record<keyof typeof ledgerSql, Row[]>; for (const [key, sql] of Object.entries(ledgerSql)) result[key as keyof typeof result] = (await db.query<{ row: Row }>(sql)).rows.map(row => row.row); return result; }
    const otherBook = await notebook("FOREIGN_NOTEBOOK_SENTINEL", foreign, foreignSession), otherPage = await page(otherBook, "FOREIGN_PAGE_SENTINEL", null, "FOREIGN_BODY_SENTINEL", foreign, foreignSession), otherCapture = await capture("FOREIGN_CAPTURE_SENTINEL", "FOREIGN_CAPTURE_BODY_SENTINEL", foreign, foreignSession);
    await link(otherPage, otherCapture, foreign, foreignSession); await page(otherBook, "FOREIGN_REF_SENTINEL", null, "[[FOREIGN_PAGE_SENTINEL]]", foreign, foreignSession);
    return { db, now, p, calls, command, knowledgeGateway, captureGateway, notebook, page, capture, link, payload, payloads, ledger, otherBook, otherPage };
  } catch (error) { await db.close(); throw error; }
}
type Fixture = Awaited<ReturnType<typeof createKnowledgeTreeFixture>>;
type Ledger = Awaited<ReturnType<Fixture["ledger"]>>;
export async function createTreeBranch(f: Fixture, label: string, book?: Caderno) {
  const notebook = book ?? await f.notebook("Caderno " + label), parent = await f.page(notebook, label + " Pai"), child = await f.page(notebook, label + " Filho", parent), grandchild = await f.page(notebook, label + " Neto", child);
  const capture = await f.capture(label + " Captura", "Vínculo do ramo " + label), outside = await f.page(notebook, label + " Fonte", null, "Referência [[" + child.title + "]]"); await f.link(grandchild, capture);
  const refs = (await f.db.query<{ page_id: string; target_id: string }>("select page_id,target_id from public.page_refs where user_id=$1 and page_id=$2", [treeOwner, outside.id])).rows; assert.deepEqual(refs, [{ page_id: outside.id, target_id: child.id }]);
  return { notebook, parent, child, grandchild, outside, capture };
}
const sorted = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
type Event = { id: string; user_id: string; entity_type: string; entity_id: string; action: string; canal: string; occurred_at: string; before: unknown; after: unknown };
async function events(f: Fixture) { return (await f.db.query<Event>("select id,user_id,entity_type,entity_id,action,canal,occurred_at::text,before,after from public.domain_events where user_id=$1 order by id", [treeOwner])).rows; }
async function entities(f: Fixture) { return [...(await f.payloads<Caderno>("knowledge_notebooks")).map(row => ({ type: "knowledge_notebook", row })), ...(await f.payloads<Pagina>("knowledge_pages")).map(row => ({ type: "knowledge_page", row })), ...(await f.payloads<Captura>("captures")).map(row => ({ type: "capture", row }))]; }
type Write = { request: ComandoConhecimento; result: unknown; before: Awaited<ReturnType<typeof entities>>; after: Awaited<ReturnType<typeof entities>>; events: Event[] };
const navKeys: Record<string, readonly string[]> = { "/capturar": ["capture"], "/conhecimento": ["notebook", "note", "view", "q", "origin"] };
const commands = new Set<ComandoConhecimento["command"]>(["knowledge.page.promote-capture", "knowledge.page.update", "knowledge.page.delete", "knowledge.page.restore", "knowledge.notebook.delete", "knowledge.notebook.restore"]);
async function attach(page: Page, f: Fixture) {
  const trace = { writes: [] as Write[], refused: [] as { command: string; code: string }[], reads: [] as string[], unexpected: [] as string[], errors: [] as string[] }; page.on("pageerror", () => trace.errors.push("BROWSER_ERROR")); await page.clock.install({ time: new Date(f.now) });
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url()); if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" }, body: JSON.stringify(body) });
    if (["/api/knowledge", "/api/capture-tasks"].includes(url.pathname)) {
      if (req.headers()["x-expected-user-id"] !== treeOwner) { trace.unexpected.push("UNBOUND_ACTOR"); await route.abort(); return; }
      let decoded: ComandoConhecimento | null = null;
      try {
        if (req.method() === "GET") {
          trace.reads.push(url.pathname + url.search);
          if (url.pathname === "/api/knowledge") {
            const state = await f.knowledgeGateway("read.knowledge").snapshot(); assert.deepEqual(sorted(state.notebooks), await f.payloads<Caderno>("knowledge_notebooks")); assert.deepEqual(sorted(state.pages), await f.payloads<Pagina>("knowledge_pages"));
            const pageId = url.searchParams.get("page"), type = url.searchParams.get("related_type"), id = url.searchParams.get("related_id");
            if (!url.search) { await json(f.p.conhecimentoDTO(state)); return; }
            if (url.searchParams.size === 1 && pageId && uuid.test(pageId)) { await json(f.p.leituraPagina(state, pageId)); return; }
            if (url.searchParams.size === 2 && type === "capture" && id && uuid.test(id)) { await json(f.p.leituraRelacionados(state, "capture", id)); return; }
          }
          if (url.pathname === "/api/capture-tasks" && url.search === "?query=captures") {
            const { snapshot, projectsVisible } = await f.captureGateway("read.captures").presentation(); assert.deepEqual(sorted(snapshot.captures), await f.payloads<Captura>("captures"));
            const promoted = (await f.db.query<{ origin_capture_id: string }>("select origin_capture_id from public.knowledge_pages where user_id=$1 and origin_capture_id is not null order by origin_capture_id", [treeOwner])).rows.map(row => row.origin_capture_id);
            assert.deepEqual([...(snapshot.readonlyCaptureIds ?? [])].sort(), promoted); await json({ items: snapshot.captures, categories: snapshot.categories, projects: projectsVisible ? snapshot.projects.filter(row => !row.deleted_at) : [], ...(snapshot.readonlyCaptureIds !== undefined ? { readonlyCaptureIds: snapshot.readonlyCaptureIds } : {}) }); return;
          }
        }
        if (url.pathname === "/api/knowledge" && req.method() === "POST" && !url.search && req.headers().origin === origin && req.headers()["content-type"] === "application/json" && Buffer.byteLength(req.postData() ?? "") <= 262144) {
          decoded = f.p.decodeKnowledgeCommand(req.postDataJSON()); assert.ok(commands.has(decoded.command)); const before = await entities(f), old = new Set((await events(f)).map(row => row.id));
          const result = await f.command(decoded); trace.writes.push({ request: decoded, result, before, after: await entities(f), events: (await events(f)).filter(row => !old.has(row.id)) }); await json({ ok: true, result }); return;
        }
      } catch (error) {
        if (error instanceof f.p.ErroDeDominio) { if (decoded) trace.refused.push({ command: decoded.command, code: error.code }); await json({ code: error.code, message: "Operação SQL recusada." }, error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400); return; }
        if (error instanceof f.p.AuthGuardError) { if (decoded) trace.refused.push({ command: decoded.command, code: error.code.toUpperCase() }); await json({ code: error.code.toUpperCase(), message: "Contexto SQL recusado." }, 403); return; }
        trace.unexpected.push("UNEXPECTED_BACKEND_FAILURE"); await route.abort(); return;
      }
      trace.unexpected.push("UNEXPECTED_API_REQUEST"); await route.abort(); return;
    }
    const allowed = navKeys[url.pathname]; if (req.method() === "GET" && req.isNavigationRequest() && allowed && !url.hash && [...url.searchParams.keys()].every(key => allowed.includes(key))) { await route.fulfill({ contentType: "text/html", body: '<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="issue28-knowledge-tree-sql"></div></body></html>' }); return; }
    trace.unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  }); return trace;
}
async function mount(page: Page, path?: string) { if (path === undefined) await page.reload(); else await page.goto(origin + path); await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: bundle }); await page.evaluate(actor => (globalThis as unknown as { __startIssue28KnowledgeTreeSql(user: string): void }).__startIssue28KnowledgeTreeSql(actor), treeOwner); await expect(page.locator("main")).toHaveAttribute("data-application-mode", "connected"); }
const reader = (page: Page) => page.locator(".knowledge-reader");
const related = (page: Page, name: string) => page.locator(".knowledge-backlinks").filter({ has: page.getByRole("heading", { name, exact: true }) });
async function openPage(page: Page, value: Pagina, readonly = false) { await mount(page, "/conhecimento?note=" + value.id + (readonly ? "&view=trash" : "")); if (readonly) await expect(reader(page).getByRole("heading", { name: value.title, exact: true })).toBeVisible(); else { await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(value.title); await expect(page.getByRole("textbox", { name: "Conteúdo da página", exact: true })).toBeVisible(); } }
async function verify(f: Fixture, page: Page, trace: Awaited<ReturnType<typeof attach>>, baseline: Ledger, intervening = { commands: 0, events: 0 }) {
  for (const write of trace.writes) {
    const receipts = (await f.db.query("select result from app_private.command_receipts where user_id=$1 and command=$2 and client_id=$3", [treeOwner, write.request.command, write.request.input.client_id])).rows; expect(receipts).toEqual([{ result: write.result }]);
    const changes = write.after.filter(next => JSON.stringify(next.row) !== JSON.stringify(write.before.find(old => old.type === next.type && old.row.id === next.row.id)?.row)); expect(write.events).toHaveLength(changes.length);
    for (const change of changes) { const before = write.before.find(old => old.type === change.type && old.row.id === change.row.id)?.row ?? null; const action = before === null ? "created" : change.type === "capture" ? "status_changed" : write.request.command.endsWith(".delete") ? "deleted" : write.request.command.endsWith(".restore") ? "restored" : "updated";
      expect(write.events.filter(event => event.entity_type === change.type && event.entity_id === change.row.id)).toEqual([expect.objectContaining({ user_id: treeOwner, entity_type: change.type, entity_id: change.row.id, action, canal: "web", before, after: change.row })]);
    }
    for (const event of write.events) expect(new Date(event.occurred_at).toISOString()).toBe(f.now);
  }
  const after = await f.ledger();
  expect(after.receipts).toHaveLength(baseline.receipts.length + trace.writes.length + intervening.commands);
  expect(after.events).toHaveLength(baseline.events.length + trace.writes.reduce((sum, write) => sum + write.events.length, 0) + intervening.events);
  expect(after.events.filter(row => baseline.events.some(old => old.id === row.id))).toEqual(baseline.events);
  for (const key of Object.keys(baseline) as (keyof Ledger)[]) {
    if (["users", "sessions", "roles", "moderation", "entitlements"].includes(key)) expect(after[key]).toEqual(baseline[key]); else expect(after[key].filter(row => row.user_id === foreign)).toEqual(baseline[key].filter(row => row.user_id === foreign));
  }
  expect(after.refs).toEqual(baseline.refs); expect(after.links).toEqual(baseline.links); expect(after.tasks).toEqual(baseline.tasks);
  await expect(page.locator("main")).not.toContainText(/FOREIGN_(NOTEBOOK|PAGE|BODY|CAPTURE|REF)_SENTINEL/); expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
}

test("promover captura e definir página mãe conserva origem histórica e recupera subpágina do SQL", async ({ page }) => {
  const f = await createKnowledgeTreeFixture(product);
  try {
    const book = await f.notebook("Caderno da promoção"), parent = await f.page(book, "Página mãe da promoção"), capture = await f.capture("Captura da promoção", "Primeira linha SQL\nSegunda linha SQL"), baseline = await f.ledger(), trace = await attach(page, f);
    await mount(page, "/capturar?capture=" + capture.id); await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue(capture.title!); await expect(page.getByLabel("Sua anotação", { exact: true })).toHaveValue(capture.content!);
    await page.getByRole("button", { name: "Guardar em Conhecimento", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Guardar em Conhecimento", exact: true }); await dialog.getByLabel("Caderno de destino", { exact: true }).selectOption(book.id); await dialog.getByRole("button", { name: "Guardar página", exact: true }).click();
    await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(capture.title!); const created = (await f.payloads<Pagina>("knowledge_pages")).filter(row => row.origin_capture_id === capture.id); expect(created).toHaveLength(1); const promoted = created[0]!;
    expect(promoted).toMatchObject({ notebook_id: book.id, parent_id: null, origin_capture_id: capture.id, title: capture.title, document: treeText(capture.content!), content_text: capture.content, version: 1 });
    expect(await f.payload<Captura>("captures", capture.id)).toEqual({ ...capture, status: "archived", archived_at: f.now, organized_at: f.now, updated_at: f.now }); await expect(reader(page).locator(".knowledge-breadcrumb")).toContainText("organizada de uma captura");
    await expect(page.getByRole("textbox", { name: "Conteúdo da página", exact: true })).toHaveText(capture.content!.replaceAll("\n", "")); await page.getByLabel("Página mãe", { exact: true }).selectOption(parent.id); await page.getByRole("button", { name: "Salvar página", exact: true }).click(); await expect(page.getByText("Página salva.", { exact: true })).toBeVisible();
    const child = await f.payload<Pagina>("knowledge_pages", promoted.id); expect(child).toEqual({ ...promoted, parent_id: parent.id, version: 2, updated_at: f.now }); const beforeReload = trace.reads.length; await mount(page); expect(trace.reads.length).toBeGreaterThan(beforeReload); await expect(page.getByLabel("Página mãe", { exact: true })).toHaveValue(parent.id); await expect(page.getByLabel("Caderno da página", { exact: true })).toHaveValue(book.id);
    await mount(page, "/capturar?capture=" + capture.id); await expect(page.getByText("Esta é a origem arquivada da página.", { exact: false })).toBeVisible(); await expect(page.getByLabel("Título da nota", { exact: true })).toBeDisabled(); await expect(page.getByLabel("Sua anotação", { exact: true })).toHaveValue(capture.content!); await expect(page.getByRole("link", { name: "Abrir a página em Conhecimento", exact: true })).toHaveAttribute("href", "/conhecimento?origin=" + capture.id);
    await page.getByRole("link", { name: "Abrir a página em Conhecimento", exact: true }).click(); await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(capture.title!); expect(trace.writes.map(write => write.request.command)).toEqual(["knowledge.page.promote-capture", "knowledge.page.update"]); expect(trace.writes.map(write => write.events.length)).toEqual([2, 1]); expect(trace.refused).toEqual([]); await verify(f, page, trace, baseline);
  } finally { await f.db.close(); }
});

test("mover ramo entre cadernos conserva arestas e recusa ciclo e pai estrangeiro sem commit", async ({ page }) => {
  const f = await createKnowledgeTreeFixture(product);
  try {
    const branch = await createTreeBranch(f, "Movimento"), destination = await f.notebook("Caderno de destino"), baseline = await f.ledger(), trace = await attach(page, f);
    await openPage(page, branch.parent); await page.getByLabel("Caderno da página", { exact: true }).selectOption(destination.id); await expect(page.getByLabel("Página mãe", { exact: true })).toHaveValue(""); await page.getByRole("button", { name: "Salvar página", exact: true }).click(); await expect(page.getByText("Página salva.", { exact: true })).toBeVisible();
    for (const before of [branch.parent, branch.child, branch.grandchild]) expect(await f.payload<Pagina>("knowledge_pages", before.id)).toEqual({ ...before, notebook_id: destination.id, version: before.version + 1, updated_at: f.now });
    expect(await f.payload<Captura>("captures", branch.capture.id)).toEqual(branch.capture); expect((await f.ledger()).refs).toEqual(baseline.refs); expect((await f.ledger()).links).toEqual(baseline.links);
    for (const item of [branch.child, branch.grandchild]) { await openPage(page, item); await expect(page.getByLabel("Caderno da página", { exact: true })).toHaveValue(destination.id); await expect(page.getByLabel("Página mãe", { exact: true })).toHaveValue(item.parent_id!); await expect(page.getByRole("textbox", { name: "Conteúdo da página", exact: true })).toHaveText(item.content_text); }
    const movedParent = await f.payload<Pagina>("knowledge_pages", branch.parent.id); await openPage(page, movedParent); const beforeCycle = await f.ledger(), commits = f.calls.filter(row => row.name === "knowledge_commit").length;
    await page.getByLabel("Página mãe", { exact: true }).selectOption(branch.grandchild.id); await page.getByRole("button", { name: "Salvar página", exact: true }).click(); await expect.poll(() => trace.refused.length).toBe(1); await expect(reader(page).getByRole("alert")).toHaveText("Não foi possível salvar estes campos. Revise os dados e tente novamente."); await expect(page.getByLabel("Página mãe", { exact: true })).toHaveValue(branch.grandchild.id); expect(await f.ledger()).toEqual(beforeCycle); expect(f.calls.filter(row => row.name === "knowledge_commit")).toHaveLength(commits);
    await expect(page.getByLabel("Página mãe", { exact: true }).locator('option[value="' + f.otherPage.id + '"]')).toHaveCount(0);
    await expect(f.command({ command: "knowledge.page.update", input: { id: movedParent.id, title: movedParent.title, document: movedParent.document, expected_version: movedParent.version, notebook_id: f.otherBook.id, parent_id: f.otherPage.id, client_id: "negative-foreign-parent" } })).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(await f.ledger()).toEqual(beforeCycle); expect(f.calls.filter(row => row.name === "knowledge_commit")).toHaveLength(commits);
    await page.getByRole("button", { name: "Descartar rascunho", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Descartar o rascunho?", exact: true }); await dialog.getByRole("button", { name: "Descartar alterações", exact: true }).click(); await expect(page.getByLabel("Página mãe", { exact: true })).toHaveValue(""); await expect(page.getByRole("button", { name: "Salvar página", exact: true })).toBeDisabled();
    expect(trace.writes).toHaveLength(1); expect(trace.writes[0]!.events).toHaveLength(3); expect(trace.refused).toEqual([{ command: "knowledge.page.update", code: "VALIDATION" }]); await verify(f, page, trace, baseline);
  } finally { await f.db.close(); }
});

test("lixeira de subárvore restaura apenas seu lote e conserva parentes, referências e vínculos", async ({ page }) => {
  const f = await createKnowledgeTreeFixture(product);
  try {
    const branch = await createTreeBranch(f, "Subárvore"), previous = await f.page(branch.notebook, "Subárvore já excluída", branch.parent), sibling = await f.page(branch.notebook, "Subárvore irmã"), preDelete = await f.command({ command: "knowledge.page.delete", input: { id: previous.id, client_id: "setup-earlier-delete" } }) as Pagina;
    const baseline = await f.ledger(), trace = await attach(page, f); await openPage(page, branch.parent); await page.getByRole("button", { name: "Mover para lixeira", exact: true }).click(); await expect(page.getByText("Página e descendentes enviados para a lixeira.", { exact: true })).toBeVisible();
    const deleted = await f.payload<Pagina>("knowledge_pages", branch.parent.id); expect(deleted.deletion_batch_id).toMatch(uuid); expect(deleted.deletion_batch_id).not.toBe(preDelete.deletion_batch_id);
    for (const old of [branch.parent, branch.child, branch.grandchild]) expect(await f.payload<Pagina>("knowledge_pages", old.id)).toEqual({ ...old, deleted_at: f.now, deletion_batch_id: deleted.deletion_batch_id, version: old.version + 1, updated_at: f.now });
    expect(await f.payload("knowledge_pages", previous.id)).toEqual(preDelete); expect(await f.payload("knowledge_pages", sibling.id)).toEqual(sibling);
    await page.getByRole("button", { name: "Lixeira", exact: true }).click(); await expect(page).toHaveURL(/view=trash/); await page.locator(".knowledge-results").getByRole("link", { name: branch.parent.title, exact: true }).click(); await expect(reader(page).getByText("Na lixeira", { exact: true })).toBeVisible(); await expect(reader(page).getByRole("textbox", { name: "Conteúdo da página", exact: true })).toHaveCount(0); await expect(reader(page).locator(".knowledge-copy")).toHaveText(branch.parent.content_text);
    await page.getByRole("button", { name: "Restaurar página e descendentes", exact: true }).click(); await expect(page.getByText("Árvore restaurada.", { exact: true })).toBeVisible();
    for (const old of [branch.parent, branch.child, branch.grandchild]) expect(await f.payload<Pagina>("knowledge_pages", old.id)).toEqual({ ...old, version: old.version + 2, updated_at: f.now }); expect(await f.payload("knowledge_pages", previous.id)).toEqual(preDelete); expect(await f.payload("knowledge_pages", sibling.id)).toEqual(sibling);
    await page.getByRole("button", { name: "Todas as páginas", exact: true }).click(); for (const item of [branch.parent, branch.child, branch.grandchild]) { await page.locator(".knowledge-results").getByRole("link", { name: item.title, exact: true }).click(); await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(item.title); await expect(page.getByLabel("Página mãe", { exact: true })).toHaveValue(item.parent_id ?? ""); }
    const readsBefore = trace.reads.length; await mount(page); expect(trace.reads.length).toBeGreaterThan(readsBefore); const captureLink = related(page, "Relacionado").getByRole("link", { name: branch.capture.title!, exact: true }); await expect(captureLink).toHaveAttribute("href", "/capturar?capture=" + branch.capture.id); await captureLink.click(); await expect(page).toHaveURL(origin + "/capturar?capture=" + branch.capture.id); await expect(page.getByLabel("Sua anotação", { exact: true })).toHaveValue(branch.capture.content!);
    await openPage(page, branch.outside); const ref = related(page, "Referências nesta página").getByRole("link", { name: branch.child.title, exact: true }); await expect(ref).toHaveAttribute("href", "/conhecimento?note=" + branch.child.id); await ref.click(); await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(branch.child.title); await expect(related(page, "Referências a esta página").getByRole("link", { name: branch.outside.title, exact: true })).toHaveAttribute("href", "/conhecimento?note=" + branch.outside.id);
    expect(trace.writes.map(write => write.request.command)).toEqual(["knowledge.page.delete", "knowledge.page.restore"]); expect(trace.writes.map(write => write.events.length)).toEqual([3, 3]); expect(trace.refused).toEqual([]); await verify(f, page, trace, baseline);
  } finally { await f.db.close(); }
});

test("restaurar caderno preserva árvore e arquivadas; título ocupado recusa o lote inteiro antes do commit", async ({ page }) => {
  const f = await createKnowledgeTreeFixture(product);
  try {
    const branch = await createTreeBranch(f, "Caderno inteiro"), secondRoot = await f.page(branch.notebook, "Segundo ramo"), archived = await f.page(branch.notebook, "Filha arquivada", secondRoot), previous = await f.page(branch.notebook, "Página de lote anterior", secondRoot);
    const archivedBefore = await f.command({ command: "knowledge.page.archive", input: { id: archived.id, client_id: "setup-archive-child" } }) as Pagina, previousBefore = await f.command({ command: "knowledge.page.delete", input: { id: previous.id, client_id: "setup-previous-page-delete" } }) as Pagina;
    const otherBook = await f.notebook("Caderno da colisão"), baseline = await f.ledger(), trace = await attach(page, f), living = [branch.parent, branch.child, branch.grandchild, branch.outside, secondRoot, archivedBefore];
    await mount(page, "/conhecimento?notebook=" + branch.notebook.id + "&note=" + branch.parent.id); await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(branch.parent.title); await page.getByRole("button", { name: "Mover caderno para lixeira", exact: true }).click(); await expect(page.getByText("Caderno e páginas enviados para a lixeira.", { exact: true })).toBeVisible();
    const deletedBook = await f.payload<Caderno>("knowledge_notebooks", branch.notebook.id); expect(deletedBook).toEqual({ ...branch.notebook, deleted_at: f.now, deletion_batch_id: expect.stringMatching(uuid), updated_at: f.now });
    for (const old of living) expect(await f.payload<Pagina>("knowledge_pages", old.id)).toEqual({ ...old, deleted_at: f.now, deletion_batch_id: deletedBook.deletion_batch_id, version: old.version + 1, updated_at: f.now }); expect(await f.payload("knowledge_pages", previous.id)).toEqual(previousBefore);
    await page.getByRole("button", { name: "Lixeira", exact: true }).click(); await page.locator(".knowledge-results").getByRole("link", { name: branch.child.title, exact: true }).click(); const beforeChild = await f.ledger(), commits = f.calls.filter(row => row.name === "knowledge_commit").length;
    await page.getByRole("button", { name: "Restaurar página e descendentes", exact: true }).click(); await expect.poll(() => trace.refused.length).toBe(1); expect(await f.ledger()).toEqual(beforeChild); expect(f.calls.filter(row => row.name === "knowledge_commit")).toHaveLength(commits); await expect(reader(page).getByText("Na lixeira", { exact: true })).toBeVisible();
    // Explicit intervening Core command, not a GUI restore event or SQL seed.
    const collision = await f.page(otherBook, branch.grandchild.title), beforeCollision = await f.ledger(), beforeCommit = f.calls.filter(row => row.name === "knowledge_commit").length; await page.getByRole("button", { name: "Restaurar caderno", exact: true }).click(); await expect.poll(() => trace.refused.length).toBe(2); expect(await f.ledger()).toEqual(beforeCollision); expect(f.calls.filter(row => row.name === "knowledge_commit")).toHaveLength(beforeCommit);
    expect((await f.payloads<Pagina>("knowledge_pages")).filter(row => row.notebook_id === branch.notebook.id && !row.deleted_at)).toEqual([]); await expect(page.getByRole("button", { name: "Restaurar caderno", exact: true })).toBeEnabled();
    await f.command({ command: "knowledge.page.delete", input: { id: collision.id, client_id: "remove-explicit-title-collision" } }); const beforeRestore = await f.ledger(); await page.getByRole("button", { name: "Restaurar caderno", exact: true }).click(); await expect(page.getByText("Caderno e páginas restaurados.", { exact: true })).toBeVisible();
    expect(await f.payload<Caderno>("knowledge_notebooks", branch.notebook.id)).toEqual(branch.notebook); for (const old of living) expect(await f.payload<Pagina>("knowledge_pages", old.id)).toEqual({ ...old, version: old.version + 2, updated_at: f.now }); expect(await f.payload("knowledge_pages", previous.id)).toEqual(previousBefore); expect((await f.ledger()).refs).toEqual(beforeRestore.refs); expect((await f.ledger()).links).toEqual(beforeRestore.links);
    await expect(page).toHaveURL(/view=trash/); await page.getByRole("button", { name: "Arquivadas", exact: true }).click(); const archivedLink = page.locator(".knowledge-results").getByRole("link", { name: archived.title, exact: true }); await archivedLink.click(); await expect(reader(page).getByText("Arquivada", { exact: true })).toBeVisible(); await expect(reader(page).locator(".knowledge-copy")).toHaveText(archived.content_text); await page.getByRole("button", { name: "Todas as páginas", exact: true }).click(); await expect(page.locator(".knowledge-results").getByRole("link", { name: previous.title, exact: true })).toHaveCount(0); await expect(page.locator(".knowledge-results").getByRole("link", { name: archived.title, exact: true })).toHaveCount(0);
    await openPage(page, branch.grandchild); await expect(page.getByLabel("Página mãe", { exact: true })).toHaveValue(branch.child.id); await mount(page); const captureLink = related(page, "Relacionado").getByRole("link", { name: branch.capture.title!, exact: true }); await expect(captureLink).toHaveAttribute("href", "/capturar?capture=" + branch.capture.id); await captureLink.click(); await expect(page.getByLabel("Sua anotação", { exact: true })).toHaveValue(branch.capture.content!); await openPage(page, branch.outside); await expect(related(page, "Referências nesta página").getByRole("link", { name: branch.child.title, exact: true })).toHaveAttribute("href", "/conhecimento?note=" + branch.child.id);
    expect(trace.writes.map(write => write.request.command)).toEqual(["knowledge.notebook.delete", "knowledge.notebook.restore"]); expect(trace.writes.map(write => write.events.length)).toEqual([7, 7]); expect(trace.refused).toEqual([{ command: "knowledge.page.restore", code: "VALIDATION" }, { command: "knowledge.notebook.restore", code: "VALIDATION" }]); await verify(f, page, trace, baseline, { commands: 2, events: 2 });
  } finally { await f.db.close(); }
});
