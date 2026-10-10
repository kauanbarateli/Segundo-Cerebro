/** Original Project GUI/providers/client/journal and canonical disposable SQL.
 * HTTP/Auth/navigation/dynamic/CSS are seams. Drive uses a SQL transport port
 * and the real Store/DTO, not filesServicesForRequest, SDK, Storage or Next GET.
 * File bytes are metadata fixtures; no upload, hosted or visual acceptance. */
import assert from "node:assert/strict";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { createHabitSqlFixture, habitOwner as owner, habitSession as session, habitForeign as foreign, habitForeignSession as foreignSession } from "./helpers/issue30-habits-sql";
import type { CaptureTaskOperation, CaptureTaskRpc } from "../../src/adapters/db/capture-task-gateway";
import type { KnowledgeRpc } from "../../src/adapters/db/knowledge-gateway";
import type { DriveGateway } from "../../src/adapters/db/files-store";
import type { Projeto } from "../../src/core/contracts";
import type { ProjectContainer } from "../../src/core/projetos";
import type { Captura } from "../../src/core/capturas";
import type { Tarefa } from "../../src/core/tarefas";
import type { Pagina, ComandoConhecimento, DocumentoPagina, Caderno } from "../../src/core/conhecimento";
import type { Arquivo, SnapshotDrive } from "../../src/core/drive";

type Product = typeof import("./fixtures/issue30-projects-sql.entry");
const origin = "https://issue30-projects-sql.test", uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let product: Product, bundle: string, styles: string;
test.use({ timezoneId: "UTC" }); test.describe.configure({ retries: 0 });
const exportsExpected = ["AuthGuardError", "ErroDeDominio", "conhecimentoDTO", "createCaptureTaskGateway", "createCaptureTaskStore", "createDriveStore", "createKnowledgeGateway", "createKnowledgeStore", "createRoutineGateway", "createRoutineStore", "decodeCaptureTaskRequest", "decodeKnowledgeCommand", "decodeRoutineRequest", "driveDTO", "executarConhecimento", "executeCaptureTaskCommand", "executeRoutineCommand", "leituraPagina", "leituraRelacionados"];
export async function loadProjectsProduct(): Promise<Product> {
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/issue30-projects-sql.entry.ts"), platform: "node", tsconfig: false, resolve: { conditionNames: ["react-server", "node", "import", "default"] } });
  try { const { output } = await build.generate({ format: "es", codeSplitting: false }); assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.deepEqual(chunk.dynamicImports, []);
    const p = await import("data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64")) as Product; assert.deepEqual(Object.keys(p).sort(), exportsExpected); return p;
  } finally { await build.close(); }
}
// Fixture cascade is explicit: controls first, layout next, domains last.
// Discovery verifies the exact closure and never chooses its order.
const cssPaths = ["src/components/ui/badge.css", "src/components/ui/button.css", "src/components/ui/card.css", "src/components/ui/data-display.css", "src/components/ui/data-table.css", "src/components/ui/dialog.css", "src/components/ui/field.css", "src/components/ui/switch.css", "src/components/ui/toast.css", "src/components/layout/related-panel.css", "src/components/features/projetos/projects.css", "src/components/features/capturar/capture.css", "src/components/features/conhecimento/knowledge.css", "src/components/features/drive/drive.css", "src/components/features/tarefas/tasks.css"];
export async function buildProjectsBrowser() {
  const navigation = resolve("tests/e2e/fixtures/issue30-projects-browser.tsx").replaceAll("\\", "/"), discovered = new Set<string>();
  const build = await rolldown({ input: navigation, platform: "browser", tsconfig: false, resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "project-next-css-boundaries", resolveId(source, importer) {
      if (source.endsWith(".css")) { assert.ok(importer && source.startsWith(".")); const path = resolve(dirname(importer), source), within = relative(resolve("src"), path); assert.ok(!within.startsWith("..") && !within.includes(":")); discovered.add(path); return "\0project-css"; }
      if (source === "next/link") return "\0project-link"; if (source === "next/dynamic") return "\0project-dynamic";
    }, load(id) {
      if (id === "\0project-css") return "export {};";
      if (id === "\0project-link") return "export { NavigationLink as default } from " + JSON.stringify(navigation) + ";";
      if (id === "\0project-dynamic") return "import {createElement,lazy,Suspense} from 'react';export default function dynamic(loader,options={}){const Component=lazy(loader);return function Dynamic(props){return createElement(Suspense,{fallback:options.loading?createElement(options.loading):null},createElement(Component,props));};}";
    } }] });
  try { const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "Issue30ProjectsFixture" }); assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.ok(chunk.dynamicImports.every(name => name === chunk.fileName)); assert.ok(!/\bimport\s*\(/.test(chunk.code));
    assert.deepEqual([...discovered].sort(), cssPaths.map(path => resolve(path)).sort());
    const global = resolve("src/app/globals.css"); let css = (await postcss([tailwind()]).process(await readFile(global, "utf8"), { from: global })).css + "\n" + (await Promise.all(cssPaths.map(path => readFile(path, "utf8")))).join("\n");
    const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"); css += "\n@font-face{font-family:Issue30Geist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:Issue30Geist}";
    assert.ok(!/@import\s/.test(css)); for (const match of css.matchAll(/url\(([^)]*)\)/g)) assert.match(match[1]!.replaceAll(/["']/g, "").trim(), /^data:/);
    return { code: chunk.code, css, modules: Object.keys(chunk.modules) };
  } finally { await build.close(); }
}
test.beforeAll(async () => { if (process.platform !== "linux") throw new Error("Project browser execution requires Linux CI."); product = await loadProjectsProduct(); const built = await buildProjectsBrowser(); bundle = built.code; styles = built.css; });

const captureSql: Record<Parameters<CaptureTaskRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  capture_task_snapshot: { sql: "select public.capture_task_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] }, capture_task_revision: { sql: "select public.capture_task_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_receipt: { sql: "select public.capture_task_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] }, capture_task_commit: { sql: "select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
};
const knowledgeSql: Record<Parameters<KnowledgeRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  knowledge_snapshot: { sql: "select public.knowledge_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] }, knowledge_receipt: { sql: "select public.knowledge_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] }, knowledge_commit: { sql: "select public.knowledge_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
};
type Row = Record<string, unknown>;
const queries = {
  users: "select to_jsonb(t) as row from auth.users t order by id", sessions: "select to_jsonb(t) as row from auth.sessions t order by id", projects: "select to_jsonb(t) as row from public.projects t order by id",
  captures: "select to_jsonb(t) as row from public.captures t order by id", tasks: "select to_jsonb(t) as row from public.tasks t order by id", notebooks: "select to_jsonb(t) as row from public.knowledge_notebooks t order by id", pages: "select to_jsonb(t) as row from public.knowledge_pages t order by id", refs: "select to_jsonb(t) as row from public.page_refs t order by id", links: "select to_jsonb(t) as row from public.links t order by id", folders: "select to_jsonb(t) as row from public.drive_folders t order by id", files: "select to_jsonb(t) as row from public.drive_files t order by id",
  events: "select to_jsonb(t) as row from public.domain_events t order by id", receipts: "select to_jsonb(t) as row from app_private.command_receipts t order by user_id,command,client_id", routineRevision: "select to_jsonb(t) as row from app_private.projects_habits_revisions t order by user_id", captureRevision: "select to_jsonb(t) as row from app_private.capture_task_revisions t order by user_id", limits: "select to_jsonb(t) as row from app_private.rate_limits t order by scope,subject_hash",
};
type Physical = "projects" | "captures" | "tasks" | "knowledge_notebooks" | "knowledge_pages" | "drive_folders";
const physical = new Set<string>(["projects", "captures", "tasks", "knowledge_notebooks", "knowledge_pages", "drive_folders"]);
export async function createProjectsFixture(p: Product) {
  const f = await createHabitSqlFixture(p), db = f.db;
  try {
    assert.deepEqual((await db.query("select role from public.user_roles order by user_id")).rows, [{ role: "user" }, { role: "user" }]);
    for (const actor of [owner, foreign]) for (const feature of ["calendario", "financeiro", "habitos", "cofre"]) await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,$2,false)", [actor, feature]);
    let seq = 10; const nextId = () => "65000000-0000-4000-8000-" + String(seq++).padStart(12, "0"), deps = { clock: { now: () => f.now }, ids: { next: nextId } };
    const bind = (actor: string, sid: string) => assert.ok(actor === owner && sid === session || actor === foreign && sid === foreignSession);
    async function rpc(sql: string, values: unknown[]) { return db.transaction(async tx => { await tx.exec("set local role service_role"); const result = await tx.query<{ data: unknown }>(sql, values); assert.equal(result.rows.length, 1); return result.rows[0]!.data; }); }
    function captureGateway(operation: CaptureTaskOperation, actor = owner, sid = session) {
      bind(actor, sid); const transport: CaptureTaskRpc = async (name, args) => { const spec = captureSql[name]; assert.equal(args.p_user, actor); assert.equal(args.p_session, sid); assert.equal(args.p_operation, operation); assert.deepEqual(Object.keys(args).sort(), ["p_user", "p_session", "p_operation", ...spec.extra].sort());
        try { return { data: await rpc(spec.sql, [actor, sid, operation, ...spec.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]), error: null }; } catch (error) { if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") throw error; return { data: null, error: { code: error.code } }; } };
      return p.createCaptureTaskGateway(actor, sid, operation, transport);
    }
    function knowledgeGateway(operation: string, actor = owner, sid = session) {
      bind(actor, sid); const transport: KnowledgeRpc = async (name, args) => { const spec = knowledgeSql[name]; assert.equal(args.p_user, actor); assert.equal(args.p_session, sid); assert.equal(args.p_operation, operation); assert.deepEqual(Object.keys(args).sort(), ["p_user", "p_session", "p_operation", ...spec.extra].sort());
        try { return { data: await rpc(spec.sql, [actor, sid, operation, ...spec.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]), error: null }; } catch (error) { if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") throw error; return { data: null, error: { code: error.code } }; } };
      return p.createKnowledgeGateway(actor, sid, operation, transport);
    }
    // A declared read-only SQL transport port, not the runtime/SDK factory.
    // No unexercised write/receipt may fabricate success.
    function driveGateway(actor = owner, sid = session): DriveGateway {
      bind(actor, sid); return { actorId: actor, snapshot: async () => await rpc("select public.drive_snapshot($1::uuid,$2::uuid,$3::text,$4::bigint,$5::bigint) as data", [actor, sid, "read.drive", 65536, 26214400]) as SnapshotDrive,
        commit: async () => { throw new Error("Drive writes are outside this fixture."); }, receipt: async () => { throw new Error("Drive receipts are outside this fixture."); } };
    }
    async function captureCommand(value: unknown, actor = owner, sid = session) { const request = p.decodeCaptureTaskRequest(value); return p.executeCaptureTaskCommand(p.createCaptureTaskStore(captureGateway(request.command, actor, sid)), deps, { user_id: actor, canal: "web" }, request); }
    async function knowledgeCommand(value: unknown, actor = owner, sid = session) { const request = p.decodeKnowledgeCommand(value); return p.executarConhecimento(p.createKnowledgeStore(knowledgeGateway(request.command, actor, sid)), deps, { user_id: actor, canal: "web" }, request); }
    async function payload<T>(table: Physical, id: string, actor = owner): Promise<T> { assert.ok(physical.has(table)); const rows = (await db.query<{ payload: T }>(`select payload from public.${table} where user_id=$1 and id=$2`, [actor, id])).rows; assert.equal(rows.length, 1); return rows[0]!.payload; }
    async function payloads<T>(table: Physical, actor = owner): Promise<T[]> { assert.ok(physical.has(table)); return (await db.query<{ payload: T }>(`select payload from public.${table} where user_id=$1 order by id`, [actor])).rows.map(row => row.payload); }
    async function containers(actor = owner) {
      const result: ProjectContainer[] = []; for (const [kind, table] of [["capture", "captures"], ["notebook", "knowledge_notebooks"], ["folder", "drive_folders"]] as const) {
        const source = await payloads<Row>(table, actor); for (const row of source) result.push({ id: String(row.id), user_id: String(row.user_id), kind, name: kind === "capture" ? typeof row.title === "string" && row.title !== "" ? row.title : "Captura sem título" : String(row.name), project_id: row.project_id as string | null, parent_id: kind === "folder" ? row.parent_id as string | null : null,
          deleted_at: (kind === "capture" ? row.deleted_at ?? row.archived_at : row.deleted_at) as string | null, created_at: String(row.created_at), updated_at: String(row.updated_at) }); }
      return result;
    }
    async function ledger() { const result = {} as Record<keyof typeof queries, Row[]>; for (const [key, sql] of Object.entries(queries)) result[key as keyof typeof result] = (await db.query<{ row: Row }>(sql)).rows.map(row => row.row); return result; }
    async function createProject(name: string, actor = owner, sid = session) { return f.command({ command: "project.create", input: { name, description: "Contexto descartável SQL", color_key: "neutral", position: 0, client_id: "setup-" + name } }, actor, sid) as Promise<Projeto>; }
    async function container(kind: ProjectContainer["kind"], name: string, projectId: string, parentId: string | null = null, actor = owner, sid = session) { return f.command({ command: "project.container.create", input: { kind, name, project_id: projectId, ...(parentId ? { parent_id: parentId } : {}), client_id: "setup-" + name } }, actor, sid) as Promise<ProjectContainer>; }
    async function page(notebook: string, title: string, document: DocumentoPagina, actor = owner, sid = session) { return knowledgeCommand({ command: "knowledge.page.create", input: { notebook_id: notebook, title, document, client_id: "setup-page-" + title } }, actor, sid) as Promise<Pagina>; }
    async function seedFile(folder: ProjectContainer, name: string, actor = owner) {
      // Declared metadata seed only. The canonical trigger validates explicit
      // owner/identity columns against the payload before extracting fields.
      const row: Arquivo = { id: nextId(), user_id: actor, kind: "drive", folder_id: folder.id, name, mime: "text/plain", bytes: 1536, sha256: "a".repeat(64), width: null, height: null, starred: false, deleted_at: null, deletion_batch_id: null, created_at: f.now, updated_at: f.now, modified_at: f.now };
      await db.query("insert into public.drive_files(id,user_id,payload,storage_path) values($1::uuid,$2::uuid,$3::jsonb,$4)", [row.id, actor, JSON.stringify(row), actor + "/" + row.id]); return row;
    }
    const other = await createProject("FOREIGN_PROJECT_SENTINEL", foreign, foreignSession), foreignContainers = [];
    for (const kind of ["capture", "notebook", "folder"] as const) foreignContainers.push(await container(kind, "FOREIGN_" + kind.toUpperCase() + "_SENTINEL", other.id, null, foreign, foreignSession));
    await page(foreignContainers.find(row => row.kind === "notebook")!.id, "FOREIGN_PAGE_SENTINEL", textDocument("FOREIGN_BODY_SENTINEL"), foreign, foreignSession);
    await seedFile(foreignContainers.find(row => row.kind === "folder")!, "FOREIGN_FILE_SENTINEL.txt", foreign);
    return { ...f, product: p, nextId, deps, captureGateway, knowledgeGateway, driveGateway, captureCommand, knowledgeCommand, payload, payloads, containers, ledger, createProject, container, page, seedFile, other };
  } catch (error) { await db.close(); throw error; }
}
function textDocument(text: string): DocumentoPagina { return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }; }
type Fixture = Awaited<ReturnType<typeof createProjectsFixture>>;
type Ledger = Awaited<ReturnType<Fixture["ledger"]>>;
const sorted = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
type Event = { id: string; user_id: string; entity_type: string; entity_id: string; action: string; canal: string; occurred_at: string; before: unknown; after: unknown };
type Write = { command: string; clientId: string; result: unknown; previous: { type: string; row: { id: string } }[]; events: Event[] };
async function previous(f: Fixture) { return [...(await f.payloads<Projeto>("projects")).map(row => ({ type: "project", row })), ...(await f.containers()).map(row => ({ type: "project_container", row })), ...(await f.payloads<Captura>("captures")).map(row => ({ type: "capture", row })), ...(await f.payloads<Tarefa>("tasks")).map(row => ({ type: "task", row }))]; }
const navKeys: Record<string, readonly string[]> = { "/projetos": ["project", "trash"], "/capturar": ["capture"], "/conhecimento": ["notebook", "note", "q", "view", "origin"], "/drive": ["folder", "file", "view"], "/tarefas": ["task"] };
async function attach(page: Page, f: Fixture) {
  const trace = { writes: [] as Write[], reads: [] as string[], unexpected: [] as string[], errors: [] as string[] }; page.on("pageerror", error => trace.errors.push(error.message)); await page.clock.install({ time: new Date(f.now) });
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url()); if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" }, body: JSON.stringify(body) });
    if (["/api/projects-habits", "/api/capture-tasks", "/api/knowledge", "/api/files"].includes(url.pathname)) {
      if (req.headers()["x-expected-user-id"] !== owner) { trace.unexpected.push("UNBOUND_ACTOR"); await route.abort(); return; }
      try {
        if (req.method() === "GET") {
          trace.reads.push(url.pathname + url.search);
          if (url.pathname === "/api/projects-habits" && url.search === "?domain=projects") { const state = await f.gateway("read.projects").snapshot(); assert.deepEqual(sorted(state.projects), await f.payloads<Projeto>("projects")); assert.deepEqual(sorted(state.containers), sorted(await f.containers())); await json({ items: state.projects, containers: state.containers }); return; }
          if (url.pathname === "/api/capture-tasks" && url.searchParams.size === 1 && ["captures", "tasks"].includes(url.searchParams.get("query") ?? "")) {
            const key = url.searchParams.get("query") === "tasks" ? "tasks" : "captures", { snapshot, projectsVisible } = await f.captureGateway(key === "tasks" ? "read.tasks" : "read.captures").presentation(); assert.equal(projectsVisible, true); assert.deepEqual(sorted<Captura | Tarefa>(snapshot[key]), await f.payloads<Captura | Tarefa>(key));
            await json({ items: snapshot[key], categories: snapshot.categories, projects: snapshot.projects.filter(row => !row.deleted_at), ...(key === "captures" && snapshot.readonlyCaptureIds !== undefined ? { readonlyCaptureIds: snapshot.readonlyCaptureIds } : {}) }); return;
          }
          if (url.pathname === "/api/knowledge") {
            const state = await f.knowledgeGateway("read.knowledge").snapshot(); assert.deepEqual(sorted(state.notebooks), await f.payloads<Caderno>("knowledge_notebooks")); assert.deepEqual(sorted(state.pages), await f.payloads<Pagina>("knowledge_pages"));
            const pageId = url.searchParams.get("page"), type = url.searchParams.get("related_type"), id = url.searchParams.get("related_id");
            if (!url.search) { await json(f.product.conhecimentoDTO(state)); return; }
            if (url.searchParams.size === 1 && pageId && uuid.test(pageId)) { await json(f.product.leituraPagina(state, pageId)); return; }
            if (url.searchParams.size === 2 && ["capture", "project", "file", "task"].includes(type ?? "") && id && uuid.test(id)) { await json(f.product.leituraRelacionados(state, type as "capture" | "project" | "file" | "task", id)); return; }
          }
          if (url.pathname === "/api/files" && !url.search) { const state = await f.product.createDriveStore(f.driveGateway()).snapshot(), dto = f.product.driveDTO(state); assert.deepEqual(sorted(dto.folders), await f.payloads("drive_folders"));
            const files = (await f.db.query<{ payload: Arquivo }>("select payload from public.drive_files where user_id=$1 and kind='drive' and purged_at is null order by id", [owner])).rows.map(row => row.payload); assert.deepEqual(sorted(dto.files), files); const sum = (await f.db.query<{ bytes: string }>("select coalesce(sum(bytes),0)::text as bytes from public.drive_files where user_id=$1 and purged_at is null", [owner])).rows[0]!.bytes; assert.equal(dto.usage_bytes, Number(sum)); await json(dto); return; }
        }
        if (req.method() === "POST" && !url.search && req.headers().origin === origin && req.headers()["content-type"] === "application/json" && Buffer.byteLength(req.postData() ?? "") <= 262144) {
          const input = req.postDataJSON(), before = await previous(f), ids = new Set((await f.db.query<{ id: string }>("select id from public.domain_events where user_id=$1", [owner])).rows.map(row => row.id)); let request: { command: string; input: { client_id: string } }, result: unknown;
          if (url.pathname === "/api/projects-habits") { request = f.product.decodeRoutineRequest(input); assert.ok(request.command.startsWith("project.")); result = await f.command(input); }
          else if (url.pathname === "/api/capture-tasks") { request = f.product.decodeCaptureTaskRequest(input); assert.ok(["capture.update", "capture.convert"].includes(request.command)); result = await f.captureCommand(input); }
          else { trace.unexpected.push("UNEXERCISED_WRITE_ROUTE"); await route.abort(); return; }
          const events = (await f.db.query<Event>("select id,user_id,entity_type,entity_id,action,canal,occurred_at::text,before,after from public.domain_events where user_id=$1 order by id", [owner])).rows.filter(row => !ids.has(row.id)); trace.writes.push({ command: request.command, clientId: request.input.client_id, result, previous: before, events }); await json({ ok: true, result }); return;
        }
      } catch (error) { if (error instanceof f.product.ErroDeDominio) { await json({ code: error.code, message: "Operação SQL recusada." }, error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400); return; } if (error instanceof f.product.AuthGuardError) { await json({ code: error.code.toUpperCase(), message: "Contexto SQL recusado." }, 403); return; } trace.unexpected.push("UNEXPECTED_BACKEND_FAILURE"); await route.abort(); return; }
      trace.unexpected.push("UNEXPECTED_API_REQUEST"); await route.abort(); return;
    }
    const allowed = navKeys[url.pathname]; if (req.method() === "GET" && req.isNavigationRequest() && allowed && [...url.searchParams.keys()].every(key => allowed.includes(key))) { await route.fulfill({ contentType: "text/html", body: '<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="issue30-projects-sql"></div></body></html>' }); return; }
    trace.unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  }); return trace;
}
async function mount(page: Page, path?: string) { if (path === undefined) await page.reload(); else await page.goto(origin + path); await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: bundle }); await page.evaluate(actor => (globalThis as unknown as { __startIssue30ProjectsSql(user: string): void }).__startIssue30ProjectsSql(actor), owner); await expect(page.locator("main")).toHaveAttribute("data-application-mode", "connected"); }
const section = (page: Page, name: string) => page.locator(".project-section").filter({ has: page.getByRole("heading", { name, exact: true }) });
const labels = { capture: ["Capturas", "captura", "Nome da captura"], notebook: ["Cadernos", "caderno", "Nome do caderno"], folder: ["Pastas", "pasta", "Nome da pasta"] } as const;
const sources = { capture: "captures", notebook: "knowledge_notebooks", folder: "drive_folders" } as const;
async function createHere(page: Page, f: Fixture, kind: ProjectContainer["kind"], name: string) { const [area, label, field] = labels[kind]; await section(page, area).getByRole("button", { name: "Criar aqui", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Criar " + label + " neste projeto", exact: true }); await dialog.getByLabel(field, { exact: true }).fill(name); await dialog.getByRole("button", { name: "Criar aqui", exact: true }).click(); await expect(dialog).toBeHidden(); const matches = (await f.containers()).filter(row => row.kind === kind && row.name === name); expect(matches).toHaveLength(1); await expect(section(page, area).getByRole("link", { name, exact: true })).toBeVisible(); return matches[0]!; }
async function openContainer(page: Page, row: ProjectContainer) { const [area] = labels[row.kind], target = (row.kind === "capture" ? "/capturar?capture=" : row.kind === "notebook" ? "/conhecimento?notebook=" : "/drive?folder=") + row.id; const link = section(page, area).getByRole("link", { name: row.name, exact: true }); await expect(link).toHaveAttribute("href", target); await link.click(); await expect(page).toHaveURL(origin + target); }
async function verify(f: Fixture, page: Page, trace: Awaited<ReturnType<typeof attach>>, baseline: Ledger) {
  for (const write of trace.writes) {
    const receipts = (await f.db.query("select result from app_private.command_receipts where user_id=$1 and command=$2 and client_id=$3", [owner, write.command, write.clientId])).rows; expect(receipts).toEqual([{ result: write.result }]);
    const converted = write.command === "capture.convert" ? write.result as { captura: Captura; tarefa: Tarefa } : null;
    const rows = converted ? [{ type: "task", row: converted.tarefa, action: "created" }, { type: "capture", row: converted.captura, action: "status_changed" }] : [{ type: write.command.startsWith("project.container.") ? "project_container" : write.command.startsWith("project.") ? "project" : "capture", row: write.result as Projeto | ProjectContainer | Captura, action: write.command.endsWith(".delete") ? "deleted" : write.command.endsWith(".restore") ? "restored" : write.command.endsWith(".create") ? "created" : "updated" }];
    expect(write.events).toHaveLength(rows.length); for (const change of rows) { const found = write.events.filter(row => row.entity_type === change.type && row.entity_id === change.row.id); expect(found).toHaveLength(1); expect(found[0]).toMatchObject({ user_id: owner, entity_type: change.type, entity_id: change.row.id, action: change.action, canal: "web", before: write.previous.find(old => old.type === change.type && old.row.id === change.row.id)?.row ?? null, after: change.row }); expect(new Date(found[0]!.occurred_at).toISOString()).toBe(f.now); }
  }
  const after = await f.ledger(); for (const key of Object.keys(baseline) as (keyof Ledger)[]) {
    if (key === "users" || key === "sessions") expect(after[key]).toEqual(baseline[key]);
    else expect(after[key].filter(row => row.user_id === foreign)).toEqual(baseline[key].filter(row => row.user_id === foreign));
  }
  await expect(page.locator("main")).not.toContainText(/FOREIGN_(PROJECT|CAPTURE|NOTEBOOK|FOLDER|PAGE|FILE|BODY)_SENTINEL/); expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
}

test("Projeto SQL cria, edita e recarrega a mesma identidade própria", async ({ page }) => {
  test.setTimeout(120000); const f = await createProjectsFixture(product); try { const baseline = await f.ledger(), trace = await attach(page, f); await mount(page, "/projetos"); await page.getByRole("button", { name: "Novo projeto", exact: true }).click(); let dialog = page.getByRole("dialog", { name: "Novo projeto", exact: true }); await dialog.getByLabel("Nome do projeto", { exact: true }).fill("Projeto criado SQL"); await dialog.getByLabel("Descrição do projeto", { exact: true }).fill("Descrição inicial SQL"); await dialog.getByRole("button", { name: "Criar projeto", exact: true }).click(); await expect(dialog).toBeHidden();
    const projects = await f.payloads<Projeto>("projects"); expect(projects).toHaveLength(1); const before = projects[0]!; await expect(page).toHaveURL(origin + "/projetos?project=" + before.id); await page.getByRole("button", { name: "Editar projeto", exact: true }).click(); dialog = page.getByRole("dialog", { name: "Editar projeto", exact: true }); await dialog.getByLabel("Nome do projeto", { exact: true }).fill("Projeto revisto SQL"); await dialog.getByLabel("Descrição do projeto", { exact: true }).fill("Descrição revista SQL"); await dialog.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(dialog).toBeHidden(); expect(await f.payload("projects", before.id)).toEqual({ ...before, name: "Projeto revisto SQL", description: "Descrição revista SQL" }); const saved = await f.ledger(); await mount(page); await expect(page.getByRole("heading", { name: "Projeto revisto SQL", exact: true })).toBeVisible(); expect(await f.ledger()).toEqual(saved); expect(trace.writes.map(row => row.command)).toEqual(["project.create", "project.update"]); await verify(f, page, trace, baseline);
  } finally { await f.db.close(); }
});
test("Projeto SQL abre captura criada aqui, salva corpo e preserva origem na conversão", async ({ page }) => {
  test.setTimeout(120000); const f = await createProjectsFixture(product); try { const project = await f.createProject("Contexto da captura SQL"), baseline = await f.ledger(), trace = await attach(page, f); await mount(page, "/projetos?project=" + project.id); const row = await createHere(page, f, "capture", "Captura do projeto SQL"); const before = await f.payload<Captura>("captures", row.id); expect(before.project_id).toBe(project.id); await openContainer(page, row); await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue(row.name); await page.getByLabel("Sua anotação", { exact: true }).fill("Corpo completo da captura SQL\nSegunda linha preservada."); await page.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect.poll(() => f.payload<Captura>("captures", row.id)).toMatchObject({ content: "Corpo completo da captura SQL\nSegunda linha preservada.", project_id: project.id }); await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled(); await mount(page); await expect(page.getByLabel("Sua anotação", { exact: true })).toHaveValue("Corpo completo da captura SQL\nSegunda linha preservada."); await page.getByRole("button", { name: "Virar tarefa", exact: true }).click(); await expect(page.getByRole("link", { name: "Abrir tarefa criada", exact: true })).toBeVisible();
    const saved = await f.payload<Captura>("captures", row.id), tasks = await f.payloads<Tarefa>("tasks"); expect(tasks).toHaveLength(1); expect(tasks[0]).toMatchObject({ id: saved.converted_task_id, user_id: owner, project_id: project.id, origin_capture_id: row.id, title: row.name, description: saved.content }); await mount(page, "/projetos?project=" + project.id); await expect(section(page, "Tarefas").getByRole("link", { name: /Captura do projeto SQL/ })).toHaveAttribute("href", "/tarefas?task=" + tasks[0]!.id); await section(page, "Tarefas").getByRole("link", { name: /Captura do projeto SQL/ }).click(); await expect(page.getByRole("link", { name: "Abrir origem", exact: true })).toHaveAttribute("href", "/capturar?capture=" + row.id); expect(trace.writes.map(value => value.command)).toEqual(["project.container.create", "capture.update", "capture.convert"]); await verify(f, page, trace, baseline);
  } finally { await f.db.close(); }
});
test("Projeto SQL abre caderno criado aqui e sua página real após reload", async ({ page }) => {
  test.setTimeout(120000); const f = await createProjectsFixture(product); try { const project = await f.createProject("Contexto do caderno SQL"), baseline = await f.ledger(), trace = await attach(page, f); await mount(page, "/projetos?project=" + project.id); const row = await createHere(page, f, "notebook", "Caderno do projeto SQL"), document = textDocument("Texto do reader do projeto SQL"); const source = await f.page(row.id, "Página do contexto SQL", document); expect(await f.payload<Caderno>("knowledge_notebooks", row.id)).toMatchObject({ project_id: project.id }); expect(source).toMatchObject({ notebook_id: row.id, document, content_text: "Texto do reader do projeto SQL" }); expect(Object.hasOwn(source, "project_id")).toBe(false); await openContainer(page, row); await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(source.title); await expect(page.getByRole("textbox", { name: "Conteúdo da página", exact: true })).toContainText(source.content_text); await expect(page.getByRole("navigation", { name: "Cadernos de conhecimento", exact: true }).getByRole("button", { name: /Caderno do projeto SQL/ })).toBeVisible(); const saved = await f.ledger(); await mount(page); await expect(page.getByRole("textbox", { name: "Conteúdo da página", exact: true })).toContainText(source.content_text); expect(new URL(page.url()).searchParams.get("notebook")).toBe(row.id); expect(await f.ledger()).toEqual(saved); expect(trace.writes.map(value => value.command)).toEqual(["project.container.create"]); await verify(f, page, trace, baseline);
  } finally { await f.db.close(); }
});
test("Projeto SQL abre pasta criada aqui com filha e metadados de arquivo", async ({ page }) => {
  test.setTimeout(120000); const f = await createProjectsFixture(product); try { const project = await f.createProject("Contexto da pasta SQL"), baseline = await f.ledger(), trace = await attach(page, f); await mount(page, "/projetos?project=" + project.id); const row = await createHere(page, f, "folder", "Pasta do projeto SQL"); await f.container("folder", "Filha preservada SQL", project.id, row.id); const file = await f.seedFile(row, "arquivo-do-projeto.txt"); expect(Object.hasOwn(file, "project_id")).toBe(false); await openContainer(page, row); await expect(page.getByRole("navigation", { name: "Caminho da pasta", exact: true }).getByRole("link", { name: row.name, exact: true })).toHaveAttribute("aria-current", "page"); await expect(page.getByRole("link", { name: /Filha preservada SQL/ })).toBeVisible(); await expect(page.getByRole("button", { name: file.name, exact: true })).toBeVisible(); await expect(page.getByRole("progressbar", { name: "Espaço usado", exact: true })).toHaveAttribute("aria-valuenow", "1536"); const saved = await f.ledger(); await mount(page); await expect(page.getByRole("button", { name: file.name, exact: true })).toBeVisible(); expect(await f.ledger()).toEqual(saved); expect(trace.writes.map(value => value.command)).toEqual(["project.container.create"]); await verify(f, page, trace, baseline);
  } finally { await f.db.close(); }
});
test("Projeto SQL move, desvincula e revincula três fontes sem copiar conteúdo", async ({ page }) => {
  test.setTimeout(120000); const f = await createProjectsFixture(product); try { const project = await f.createProject("Projeto de destino SQL"), from = await f.createProject("Projeto de origem SQL"), rows: ProjectContainer[] = []; for (const kind of ["capture", "notebook", "folder"] as const) rows.push(await f.container(kind, "Fonte preservada " + kind, from.id)); const baseline = await f.ledger(), trace = await attach(page, f); await mount(page, "/projetos?project=" + project.id);
    for (const row of rows) { const [area, label] = labels[row.kind], original = await f.payload<Row>(sources[row.kind], row.id); const link = async () => { await section(page, area).getByRole("button", { name: "Vincular existente", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Vincular " + label + " neste projeto", exact: true }); const values = await dialog.getByLabel("Item para vincular", { exact: true }).locator("option").allTextContents(); expect(values.join(" ")).not.toContain("FOREIGN_"); await dialog.getByLabel("Item para vincular", { exact: true }).selectOption(row.id); await dialog.getByRole("button", { name: "Vincular item", exact: true }).click(); await expect(dialog).toBeHidden(); await expect(section(page, area).getByRole("link", { name: row.name, exact: true })).toBeVisible(); };
      await link(); expect(await f.payload(sources[row.kind], row.id)).toEqual({ ...original, project_id: project.id }); await section(page, area).getByRole("button", { name: "Desvincular " + row.name, exact: true }).click(); await expect(section(page, area).getByRole("link", { name: row.name, exact: true })).toHaveCount(0); expect(await f.payload(sources[row.kind], row.id)).toEqual({ ...original, project_id: null }); await link(); expect(await f.payload(sources[row.kind], row.id)).toEqual({ ...original, project_id: project.id }); expect((await f.payloads<Row>(sources[row.kind])).filter(value => value.id === row.id)).toHaveLength(1);
    }
    const saved = await f.ledger(); await expect(f.command({ command: "project.container.link", input: { id: rows[0]!.id, project_id: f.other.id, client_id: "refused-foreign-link" } })).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(await f.ledger()).toEqual(saved); await mount(page); for (const row of rows) await expect(section(page, labels[row.kind][0]).getByRole("link", { name: row.name, exact: true })).toBeVisible(); expect(await f.ledger()).toEqual(saved); expect(trace.writes.map(value => value.command)).toEqual(Array.from({ length: 3 }, () => ["project.container.link", "project.container.unlink", "project.container.link"]).flat()); await verify(f, page, trace, baseline);
  } finally { await f.db.close(); }
});
test("Projeto SQL excluído preserva quatro fontes, readers e relações e restaura tudo", async ({ page }) => {
  test.setTimeout(150000); const f = await createProjectsFixture(product); try { const project = await f.createProject("Projeto restaurável SQL"), capture = await f.container("capture", "Captura conservada SQL", project.id), notebook = await f.container("notebook", "Caderno conservado SQL", project.id), folder = await f.container("folder", "Pasta conservada SQL", project.id); await f.container("folder", "Filha conservada SQL", project.id, folder.id); const file = await f.seedFile(folder, "arquivo-conservado.txt"), source = await f.page(notebook.id, "Página conservada SQL", textDocument("Documento integral conservado SQL"));
    const target = await f.page(notebook.id, "Alvo conservado SQL", textDocument("Alvo com identidade SQL")); const document: DocumentoPagina = { type: "doc", content: [{ type: "paragraph", content: [{ type: "wikiLink", attrs: { alias: target.title, target_id: target.id } }] }] }; await f.knowledgeCommand({ command: "knowledge.page.update", input: { id: source.id, title: source.title, expected_version: source.version, document, client_id: "setup-ref" } } satisfies ComandoConhecimento); await f.knowledgeCommand({ command: "knowledge.link.create", input: { from_type: "page", from_id: source.id, to_type: "capture", to_id: capture.id, client_id: "setup-link" } });
    await f.captureCommand({ command: "task.create", input: { client_id: "setup-task", title: "Tarefa conservada SQL", description: "Sem cópia no projeto", project_id: project.id, category_id: null, status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null, board_position: null } });
    const baseline = await f.ledger(), trace = await attach(page, f); expect(baseline.refs.filter(value => value.user_id === owner)).toHaveLength(1); expect(baseline.links.filter(value => value.user_id === owner)).toHaveLength(1); await mount(page, "/projetos?project=" + project.id); await page.getByRole("button", { name: "Excluir projeto", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Excluir projeto?", exact: true }); await dialog.getByRole("button", { name: "Mover projeto para a lixeira", exact: true }).click(); await expect(dialog).toBeHidden(); await expect(page).toHaveURL(origin + "/projetos"); await expect(page.getByRole("link", { name: /Projeto restaurável SQL/ })).toHaveCount(0); const deleted = await f.ledger();
    for (const key of ["users", "sessions", "captures", "tasks", "notebooks", "pages", "refs", "links", "folders", "files"] as const) expect(deleted[key]).toEqual(baseline[key]); expect(await f.payload("projects", project.id)).toEqual({ ...project, deleted_at: f.now });
    await mount(page, "/capturar?capture=" + capture.id); await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue(capture.name); await mount(page, "/conhecimento?notebook=" + notebook.id + "&note=" + source.id); await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(source.title); await mount(page, "/drive?folder=" + folder.id); await expect(page.getByRole("button", { name: file.name, exact: true })).toBeVisible(); expect(await f.ledger()).toEqual(deleted);
    await mount(page, "/projetos?trash=1"); await page.getByRole("button", { name: "Restaurar " + project.name, exact: true }).click(); await expect(page).toHaveURL(origin + "/projetos"); await page.getByRole("link", { name: /Projeto restaurável SQL/ }).click(); await expect(page).toHaveURL(origin + "/projetos?project=" + project.id); const restored = await f.ledger(); for (const key of ["users", "sessions", "captures", "tasks", "notebooks", "pages", "refs", "links", "folders", "files"] as const) expect(restored[key]).toEqual(baseline[key]); expect(await f.payload("projects", project.id)).toEqual(project);
    for (const row of [capture, notebook, folder]) { await openContainer(page, row); if (row.kind === "capture") await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue(row.name); else if (row.kind === "notebook") await expect(page.getByRole("navigation", { name: "Cadernos de conhecimento", exact: true }).getByRole("button", { name: /Caderno conservado SQL/ })).toBeVisible(); else await expect(page.getByRole("button", { name: file.name, exact: true })).toBeVisible(); await mount(page, "/projetos?project=" + project.id); }
    expect(await f.ledger()).toEqual(restored); expect(trace.writes.map(value => value.command)).toEqual(["project.delete", "project.restore"]); await verify(f, page, trace, baseline);
  } finally { await f.db.close(); }
});
