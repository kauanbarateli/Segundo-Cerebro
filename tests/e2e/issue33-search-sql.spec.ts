/** Canonical SQL → original search factory/SDK → explicit HTTP/Auth seam →
 * real connected shell/palette/three readers. No personal network, Next GET,
 * GoTrue/PostgREST, Storage objects, hosted SLA or browser run on Windows. */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import type { CaptureTaskOperation, CaptureTaskRpc } from "../../src/adapters/db/capture-task-gateway";
import type { RoutineOperation, RoutineRpc } from "../../src/adapters/db/projects-habits-gateway";
import type { KnowledgeRpc } from "../../src/adapters/db/knowledge-gateway";
import type { FinanceOperation, FinanceRpc } from "../../src/adapters/db/finance-gateway";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { SearchResult } from "../../src/core/busca";
import type { Captura } from "../../src/core/capturas";
import type { Tarefa } from "../../src/core/tarefas";
import type { Projeto } from "../../src/core/contracts/modules";
import type { Pagina, Caderno } from "../../src/core/conhecimento";
import type { ContaFinanceira, LancamentoFinanceiro } from "../../src/core/financeiro";
import type { HabitoDoUsuario } from "../../src/core/contracts/modules";
type Product = typeof import("./fixtures/issue33-search-sql.entry");
const origin = "https://issue33-search-fixture.test", api = "https://rishenjoikgmfubmnfiu.supabase.co";
const owner = "66000000-0000-4000-8000-000000000001", session = "66000000-0000-4000-8000-000000000002";
const foreign = "66000000-0000-4000-8000-000000000003", foreignSession = "66000000-0000-4000-8000-000000000004";
const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: origin, supabaseUrl: api, publishableKey: "sb_publishable_fake_only_for_test", secretKey: "sb_secret_fake_only_for_test", rateLimitSecret: "synthetic-search-rate-closure-32-chars", stateSecret: "synthetic-search-state-closure-32-chars", secureCookies: true };
let product: Product, browserBundle: string, styles: string;
const componentCss = [
  "src/components/ui/button.css", "src/components/ui/card.css", "src/components/ui/field.css", "src/components/ui/dialog.css", "src/components/ui/badge.css", "src/components/ui/data-table.css", "src/components/ui/toast.css", "src/components/ui/switch.css", "src/components/ui/data-display.css", "src/components/ui/brand.css",
  "src/components/layout/workspace-shell.css", "src/components/layout/command-palette.css", "src/components/layout/connected-command-feedback.css", "src/components/layout/related-panel.css",
  "src/components/features/capturar/capture.css", "src/components/features/tarefas/tasks.css", "src/components/features/projetos/projects.css",
];
export async function loadSearchProduct(): Promise<Product> {
  const modules = new Set<string>();
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/issue33-search-sql.entry.ts"), platform: "node", tsconfig: false,
    resolve: { conditionNames: ["react-server", "node", "import", "default"] }, plugins: [{ name: "search-product-inventory", async moduleParsed(info) {
      assert.equal(await realpath(info.id), info.id); assert.equal(info.dynamicallyImportedIds.length, 0);
      const path = relative(resolve("."), info.id).replaceAll("\\", "/"); assert.ok(!path.startsWith("..") && !path.includes(":")); modules.add(path);
    } }] });
  try {
    const { output } = await build.generate({ format: "es", codeSplitting: false }); assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.dynamicImports, []);
    // SDK dependencies are genuine installed packages. Only Node builtins may
    // remain external; the factory transport below never delegates network IO.
    assert.ok(chunk.imports.every(name => name.startsWith("node:"))); assert.ok(modules.has("src/adapters/db/search-runtime.ts")); assert.ok(modules.has("node_modules/server-only/empty.js"));
    const p = await import("data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64")) as Product;
    assert.deepEqual(Object.keys(p).sort(), ["searchForRequest", "search", "searchTerm", "validSearchResults", "createCaptureTaskGateway", "createCaptureTaskStore", "decodeCaptureTaskRequest", "executeCaptureTaskCommand", "createRoutineGateway", "createRoutineStore", "decodeRoutineRequest", "executeRoutineCommand", "createKnowledgeGateway", "createKnowledgeStore", "decodeKnowledgeCommand", "executarConhecimento", "conhecimentoDTO", "leituraRelacionados", "documentoDeTexto", "createFinanceGateway", "createFinanceStore", "decodeFinanceRequest", "executeFinanceCommand"].sort());
    return p;
  } finally { await build.close(); }
}
export async function buildSearchBrowser() {
  const navigation = resolve("tests/e2e/fixtures/issue33-search-browser.tsx").replaceAll("\\", "/"), css = new Set<string>();
  const build = await rolldown({ input: navigation, platform: "browser", tsconfig: false, resolve: { alias: { "@": resolve("src"), "next/navigation": navigation } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } }, onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "search-next-and-css-seams", resolveId(source, importer) {
      if (source.endsWith(".css")) { assert.ok(importer && source.startsWith(".")); const path = resolve(dirname(importer), source); assert.ok(!relative(resolve("src"), path).startsWith("..")); css.add(path); return "\0search-css"; }
      if (source === "next/link") return "\0search-link";
      if (source === "next/image") return "\0search-unused-image";
      if (source.endsWith("illustrative-avatar.jpg")) { assert.equal(source, "./illustrative-avatar.jpg"); assert.equal(importer, resolve("src/components/layout/workspace-shell.tsx")); return "\0search-unused-avatar"; }
    }, load(id) {
      if (id === "\0search-css") return "export {};";
      if (id === "\0search-link") return "export { NavigationLink as default } from " + JSON.stringify(navigation) + ";";
      if (id === "\0search-unused-image") return "export default function UnusedNextImage(){throw new Error('Connected fixture must not mount illustrative Next Image.')}";
      if (id === "\0search-unused-avatar") return "export default null;";
    } }] });
  let code: string;
  try { const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "Issue33SearchFixture" }); assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.deepEqual(chunk.dynamicImports, []); code = chunk.code; } finally { await build.close(); }
  assert.deepEqual([...css].sort(), componentCss.map(path => resolve(path)).sort());
  const globalPath = resolve("src/app/globals.css"); let sheet = (await postcss([tailwind()]).process(await readFile(globalPath, "utf8"), { from: globalPath })).css + "\n" + (await Promise.all(componentCss.map(path => readFile(path, "utf8")))).join("\n");
  const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"); sheet += "\n@font-face{font-family:Issue33Geist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:Issue33Geist}";
  assert.ok(!/@import\s/.test(sheet)); for (const match of sheet.matchAll(/url\(([^)]*)\)/g)) assert.match(match[1]!.replaceAll(/["']/g, "").trim(), /^data:/);
  return { code, sheet, cssFiles: componentCss.length };
}
test.describe.configure({ mode: "default", retries: 0 });
test.use({ timezoneId: "UTC" });
test.beforeAll(async () => { if (process.platform !== "linux") throw new Error("Search Chromium belongs to Linux CI."); product = await loadSearchProduct(); const result = await buildSearchBrowser(); browserBundle = result.code; styles = result.sheet; });

const signatures = {
  capture_task_snapshot: { sql: "select public.capture_task_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] }, capture_task_revision: { sql: "select public.capture_task_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] }, capture_task_receipt: { sql: "select public.capture_task_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] }, capture_task_commit: { sql: "select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  projects_habits_snapshot: { sql: "select public.projects_habits_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] }, projects_habits_receipt: { sql: "select public.projects_habits_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] }, projects_habits_commit: { sql: "select public.projects_habits_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  knowledge_snapshot: { sql: "select public.knowledge_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] }, knowledge_receipt: { sql: "select public.knowledge_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] }, knowledge_commit: { sql: "select public.knowledge_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  finance_snapshot: { sql: "select public.finance_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] }, finance_revision: { sql: "select public.finance_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] }, finance_receipt: { sql: "select public.finance_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] }, finance_commit: { sql: "select public.finance_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
} satisfies Record<string, { sql: string; extra: string[] }>;
export async function createSearchFixture(p: Product) {
  const db = await createLocalCanonicalSql();
  try {
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','search-owner@example.invalid'),($2,'authenticated','authenticated','search-foreign@example.invalid')", [owner, foreign]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)", [session, owner, foreignSession, foreign]);
    assert.deepEqual((await db.query("select role from public.user_roles order by user_id")).rows, [{ role: "user" }, { role: "user" }]);
    const { today, now } = (await db.query<{ today: string; now: string }>("select to_char(current_timestamp at time zone 'America/Sao_Paulo','YYYY-MM-DD') as today,to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as now")).rows[0]!;
    let sequence = 20; const nextId = () => "66000000-0000-4000-8000-" + String(sequence++).padStart(12, "0"), deps = { ids: { next: nextId }, clock: { now: () => now } };
    const calls: { name: string; actor: string; operation: string; status: string }[] = [], sdkCalls: { actor: string; sid: string; term: string; requests: number; sqlCode: string | null; items: SearchResult[] }[] = [];
    async function rpc(name: keyof typeof signatures, args: unknown, actor: string, sid: string, operation: string) {
      assert.ok(actor === owner && sid === session || actor === foreign && sid === foreignSession); const a = args as Record<string, unknown>, sig = signatures[name]; assert.ok(sig);
      assert.deepEqual(Object.keys(a).sort(), ["p_user", "p_session", "p_operation", ...sig.extra].sort()); assert.equal(a.p_user, actor); assert.equal(a.p_session, sid); assert.equal(a.p_operation, operation);
      try { const result = await db.transaction(async tx => { await tx.exec("set local role service_role"); return tx.query<{ data: unknown }>(sig.sql, [actor, sid, operation, ...sig.extra.map(key => key === "p_request" ? JSON.stringify(a[key]) : a[key])]); }); calls.push({ name, actor, operation, status: "ok" }); return { data: result.rows[0]!.data, error: null }; }
      catch (error) { const code = (error as { code?: unknown }).code; if (typeof code !== "string") throw error; calls.push({ name, actor, operation, status: code }); return { data: null, error: { code } }; }
    }
    function captureGateway(operation: CaptureTaskOperation, actor = owner, sid = session) { const transport: CaptureTaskRpc = (name, args) => rpc(name, args, actor, sid, operation); return p.createCaptureTaskGateway(actor, sid, operation, transport); }
    function routineGateway(operation: RoutineOperation, actor = owner, sid = session) { const transport: RoutineRpc = (name, args) => rpc(name, args, actor, sid, operation); return p.createRoutineGateway(actor, sid, operation, transport); }
    function knowledgeGateway(operation = "read.knowledge", actor = owner, sid = session) { const transport: KnowledgeRpc = (name, args) => rpc(name, args, actor, sid, operation); return p.createKnowledgeGateway(actor, sid, operation, transport); }
    function financeGateway(operation: FinanceOperation, actor = owner, sid = session) { const transport: FinanceRpc = (name, args) => { assert.ok(Object.hasOwn(signatures, name)); return rpc(name as keyof typeof signatures, args, actor, sid, operation); }; return p.createFinanceGateway(actor, sid, operation, transport); }
    async function command(value: unknown, actor = owner, sid = session) {
      assert.ok(value && typeof value === "object" && "command" in value && typeof value.command === "string"); const name = value.command;
      if (name.startsWith("capture.") || name.startsWith("task.")) { const r = p.decodeCaptureTaskRequest(value); return p.executeCaptureTaskCommand(p.createCaptureTaskStore(captureGateway(r.command, actor, sid), { maxAttempts: 1 }), deps, { user_id: actor, canal: "web" }, r); }
      if (name.startsWith("project.") || name.startsWith("habit.")) { const r = p.decodeRoutineRequest(value); return p.executeRoutineCommand(p.createRoutineStore(routineGateway(r.command, actor, sid)), deps, { user_id: actor, canal: "web" }, r); }
      if (name.startsWith("knowledge.")) { const r = p.decodeKnowledgeCommand(value); return p.executarConhecimento(p.createKnowledgeStore(knowledgeGateway(r.command, actor, sid)), deps, { user_id: actor, canal: "web" }, r); }
      assert.ok(name.startsWith("finance.")); const r = p.decodeFinanceRequest(value); return p.executeFinanceCommand(p.createFinanceStore(financeGateway(r.command, actor, sid)), deps, { user_id: actor, canal: "web" }, r);
    }
    let fetchQueue = Promise.resolve(), fetchActive = false, disposed = false;
    async function runSearch(term: unknown, actor = owner, sid = session) {
      assert.ok(!disposed && [owner, foreign].includes(actor) && [session, foreignSession].includes(sid));
      const previous = fetchQueue; let release!: () => void; fetchQueue = new Promise<void>(done => { release = done; }); await previous;
      const original = globalThis.fetch; assert.equal(fetchActive, false); fetchActive = true; let pending = 0, sqlCode: string | null = null, transports = 0;
      const closedFetch: typeof fetch = async (input, init) => {
        assert.ok(fetchActive && !disposed); const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url); assert.equal(url.origin, api); assert.equal(url.pathname, "/rest/v1/rpc/global_search"); assert.equal(url.search, ""); assert.equal(url.hash, ""); assert.equal(url.username, ""); assert.equal(url.password, ""); assert.equal(init?.method, "POST"); assert.equal(init?.cache, "no-store"); assert.equal(transports++, 0);
        const headers = new Headers(init?.headers); assert.equal(headers.get("apikey"), config.secretKey); assert.equal(headers.get("authorization"), "Bearer " + config.secretKey); assert.match(headers.get("content-type") ?? "", /^application\/json/); assert.ok(typeof init?.body === "string" && Buffer.byteLength(init.body) <= 1024); const args = JSON.parse(init.body) as Record<string, unknown>; assert.deepEqual(Object.keys(args).sort(), ["p_user", "p_session", "p_term"].sort()); assert.equal(args.p_user, actor); assert.equal(args.p_session, sid); assert.equal(args.p_term, typeof term === "string" ? term.trim() : term);
        pending++; try { const result = await db.transaction(async tx => { await tx.exec("set local role service_role"); return tx.query<{ data: unknown }>("select public.global_search($1::uuid,$2::uuid,$3::text) as data", [actor, sid, args.p_term]); }); return Response.json(result.rows[0]!.data); }
        catch (error) { const code = (error as { code?: unknown }).code; if (typeof code !== "string") throw error; sqlCode = code; return Response.json({ code, message: "SQL query refused.", details: null, hint: null }, { status: code === "42501" ? 403 : 400 }); }
        finally { pending--; }
      };
      globalThis.fetch = closedFetch;
      try { const items = await p.search(p.searchForRequest(config, { userId: actor, sessionId: sid, role: "user", mustChangePassword: false, entitlements: {} }), term); sdkCalls.push({ actor, sid, term: String(term), requests: transports, sqlCode, items: structuredClone(items) }); return items; }
      catch (error) { sdkCalls.push({ actor, sid, term: String(term), requests: transports, sqlCode, items: [] }); throw error; }
      finally { assert.equal(pending, 0); assert.equal(globalThis.fetch, closedFetch); globalThis.fetch = original; fetchActive = false; release(); }
    }
    async function seed(actor = owner, sid = session) {
      const prefix = actor === owner ? "Árvore" : "Árvore FOREIGN_SEARCH_SENTINEL";
      const project = await command({ command: "project.create", input: { name: prefix + " projeto", description: "Descrição SQL do contexto", color_key: "work", position: 0, client_id: "project-" + actor } }, actor, sid) as Projeto;
      const capture = await command({ command: "capture.create", input: { title: prefix + " captura", content: "Texto real da captura sem metadados privados de outros módulos", type: "note", category_id: null, project_id: project.id, client_id: "capture-" + actor } }, actor, sid) as Captura;
      const task = await command({ command: "task.create", input: { title: prefix + " tarefa", description: "Descrição SQL da tarefa", category_id: null, project_id: project.id, status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null, board_position: null, client_id: "task-" + actor } }, actor, sid) as Tarefa;
      const book = await command({ command: "knowledge.notebook.create", input: { name: "Caderno SQL", project_id: project.id, client_id: "book-" + actor } }, actor, sid) as Caderno;
      const page = await command({ command: "knowledge.page.create", input: { notebook_id: book.id, title: prefix + " página", client_id: "page-" + actor } }, actor, sid) as Pagina;
      await command({ command: "knowledge.page.update", input: { id: page.id, title: page.title, notebook_id: book.id, parent_id: null, document: p.documentoDeTexto("PRIVATE_PAGE_BODY_CANARY"), expected_version: 1, client_id: "page-content-" + actor } }, actor, sid);
      const account = await command({ command: "finance.account.create", input: { name: "Conta SQL", kind: "checking", institution: null, opening_balance_cents: 0, color_key: "fin-1", credit_limit_cents: null, statement_closing_day: null, payment_due_day: null, client_id: "account-" + actor } }, actor, sid) as ContaFinanceira;
      const transaction = await command({ command: "finance.transaction.create", input: { account_id: account.id, category_id: null, kind: "expense", amount_cents: 987654, paid_cents: 987654, description: prefix + " PRIVATE_FINANCE_TITLE_CANARY", payee: null, occurred_on: today, status: "confirmed", due_date: null, notes: "PRIVATE_FINANCE_NOTES_CANARY", tag_ids: [], client_id: "transaction-" + actor } }, actor, sid) as LancamentoFinanceiro;
      const habit = await command({ command: "habit.create", input: { name: prefix + " hábito", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: today, color_key: "neutral", icon_key: null, position: 0, client_id: "habit-" + actor } }, actor, sid) as HabitoDoUsuario;
      // Metadata fixture, not a Core upload, object or file-created event.
      const file = { id: nextId(), user_id: actor, kind: "drive", folder_id: null, name: prefix + " arquivo.txt", mime: "text/plain", bytes: 16, sha256: "a".repeat(64), width: null, height: null, starred: false, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now, modified_at: now };
      await db.query("insert into public.drive_files(id,user_id,payload,storage_path) values($1,$2,$3::jsonb,$4)", [file.id, actor, JSON.stringify(file), actor + "/" + file.id]);
      return { project, capture, task, page, transaction, habit, file };
    }
    async function ledger() {
      const queries = {
        captures: "select to_jsonb(t) as row from public.captures t order by id", tasks: "select to_jsonb(t) as row from public.tasks t order by id", projects: "select to_jsonb(t) as row from public.projects t order by id", habits: "select to_jsonb(t) as row from public.habits t order by id", pages: "select to_jsonb(t) as row from public.knowledge_pages t order by id", notebooks: "select to_jsonb(t) as row from public.knowledge_notebooks t order by id", files: "select to_jsonb(t) as row from public.drive_files t order by id", accounts: "select to_jsonb(t) as row from public.fin_accounts t order by id", transactions: "select to_jsonb(t) as row from public.fin_transactions t order by id", refs: "select to_jsonb(t) as row from public.page_refs t order by id", links: "select to_jsonb(t) as row from public.links t order by id", events: "select to_jsonb(t) as row from public.domain_events t order by id", receipts: "select to_jsonb(t) as row from app_private.command_receipts t order by user_id,command,client_id", captureRevisions: "select to_jsonb(t) as row from app_private.capture_task_revisions t order by user_id", routineRevisions: "select to_jsonb(t) as row from app_private.projects_habits_revisions t order by user_id", financeRevisions: "select to_jsonb(t) as row from app_private.finance_revisions t order by user_id", limits: "select to_jsonb(t) as row from app_private.rate_limits t order by scope,subject_hash", entitlements: "select to_jsonb(t) as row from public.user_entitlements t order by user_id,feature_key", auth: "select to_jsonb(t) as row from auth.users t order by id", sessions: "select to_jsonb(t) as row from auth.sessions t order by id",
      }; const result: Record<string, Record<string, unknown>[]> = {}; for (const [name, sql] of Object.entries(queries)) result[name] = (await db.query<{ row: Record<string, unknown> }>(sql)).rows.map(row => row.row); return result;
    }
    return { db, now, today, calls, sdkCalls, nextId, captureGateway, routineGateway, knowledgeGateway, command, runSearch, seed, ledger, async dispose() { await fetchQueue; assert.equal(fetchActive, false); disposed = true; await db.close(); } };
  } catch (error) { await db.close(); throw error; }
}
type Fixture = Awaited<ReturnType<typeof createSearchFixture>>;
type Seed = Awaited<ReturnType<Fixture["seed"]>>;
type Row = Record<string, unknown>;
type Write = { command: string; clientId: string; result: Row; events: Row[]; receipt: Row };
async function attach(page: Page, f: Fixture) {
  const trace = { writes: [] as Write[], searches: [] as { term: string; items: SearchResult[]; status: number }[], unexpected: [] as string[], errors: [] as string[] };
  const pending = new Set<Promise<void>>(); page.on("pageerror", error => trace.errors.push(error.message)); await page.clock.install({ time: new Date(f.now) });
  async function respond(route: Route) {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0" }, body: JSON.stringify(value) });
    if (request.isNavigationRequest() && ["/tarefas", "/capturar", "/projetos"].includes(url.pathname) && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "text/html", body: '<html lang="pt-BR"><head><style>' + styles + '</style></head><body><div id="issue33-search-sql"></div></body></html>' }); return;
    }
    if (!url.pathname.startsWith("/api/") || request.headers()["x-expected-user-id"] !== owner) { trace.unexpected.push("UNBOUND_REQUEST"); await route.abort(); return; }
    try {
      if (url.pathname === "/api/search" && request.method() === "GET" && url.searchParams.size === 1 && url.searchParams.has("q")) {
        const term = url.searchParams.get("q")!;
        try { const items = await f.runSearch(term); trace.searches.push({ term, items, status: 200 }); await json({ items }); }
        catch (error) { const code = (error as { code?: unknown }).code; assert.equal(code, "forbidden"); trace.searches.push({ term, items: [], status: 403 }); await json({ code: "FORBIDDEN", message: "Busca indisponível nesta sessão." }, 403); } return;
      }
      if (url.pathname === "/api/capture-tasks") {
        if (request.method() === "GET" && url.searchParams.size === 1) {
          const query = url.searchParams.get("query"); assert.ok(query === "captures" || query === "tasks"); const { snapshot, projectsVisible } = await f.captureGateway(query === "captures" ? "read.captures" : "read.tasks").presentation();
          await json({ items: query === "captures" ? snapshot.captures : snapshot.tasks, categories: snapshot.categories, projects: projectsVisible ? snapshot.projects.filter(row => !row.deleted_at) : [], ...(query === "captures" && snapshot.readonlyCaptureIds !== undefined ? { readonlyCaptureIds: snapshot.readonlyCaptureIds } : {}) }); return;
        }
        if (request.method() === "POST" && !url.search) {
          assert.equal(request.headers().origin, origin); assert.match(request.headers()["content-type"] ?? "", /^application\/json(?:;|$)/); const body = request.postData(); assert.ok(typeof body === "string" && Buffer.byteLength(body) <= 256 * 1024);
          const decoded = product.decodeCaptureTaskRequest(JSON.parse(body)); assert.ok(decoded.command === "capture.create" || decoded.command === "task.create");
          const before = (await f.db.query<{ row: Row }>("select to_jsonb(e) as row from public.domain_events e order by id")).rows.map(row => row.row);
          const result = await f.command(decoded) as Row;
          const all = (await f.db.query<{ row: Row }>("select to_jsonb(e) as row from public.domain_events e order by id")).rows.map(row => row.row), events = all.filter(row => !before.some(old => old.id === row.id));
          assert.deepEqual(all.filter(row => before.some(old => old.id === row.id)), before);
          const receipts = await f.db.query<{ row: Row }>("select to_jsonb(r) as row from app_private.command_receipts r where user_id=$1 and command=$2 and client_id=$3", [owner, decoded.command, decoded.input.client_id]); assert.equal(receipts.rows.length, 1);
          trace.writes.push({ command: decoded.command, clientId: decoded.input.client_id, result, events, receipt: receipts.rows[0]!.row }); await json({ ok: true, result }); return;
        }
      }
      if (url.pathname === "/api/projects-habits" && request.method() === "GET" && url.searchParams.size === 1 && url.searchParams.get("domain") === "projects") { const snapshot = await f.routineGateway("read.projects").snapshot(); await json({ items: snapshot.projects, containers: snapshot.containers }); return; }
      if (url.pathname === "/api/knowledge" && request.method() === "GET") {
        const snapshot = await f.knowledgeGateway().snapshot();
        if (!url.search) { await json(product.conhecimentoDTO(snapshot)); return; }
        assert.equal(url.searchParams.size, 2); const type = url.searchParams.get("related_type"), id = url.searchParams.get("related_id"); assert.ok(type === "capture" || type === "task" || type === "project"); assert.ok(id && /^[a-f0-9-]{36}$/.test(id)); await json(product.leituraRelacionados(snapshot, type, id)); return;
      }
      trace.unexpected.push("UNKNOWN_API_REQUEST"); await route.abort();
    } catch { trace.unexpected.push("API_FAILURE"); await json({ code: "UNAVAILABLE", message: "A consulta da prova não foi concluída." }, 503); }
  }
  await page.route("**/*", route => { const promise = respond(route); pending.add(promise); return promise.finally(() => pending.delete(promise)); });
  return { ...trace, async close() { await page.close(); await Promise.allSettled([...pending]); } };
}
type Trace = Awaited<ReturnType<typeof attach>>;
async function start(page: Page, path = "/tarefas") {
  await page.goto(origin + path); await page.addScriptTag({ content: browserBundle });
  await page.evaluate(userId => (globalThis as unknown as { __startIssue33SearchSql(userId: string): void }).__startIssue33SearchSql(userId), owner);
  await expect(page.locator('[data-application-mode="connected"]')).toBeVisible(); expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe("UTC");
}
async function reload(page: Page) { const path = new URL(page.url()).pathname + new URL(page.url()).search; await start(page, path); }
const palette = (page: Page) => page.getByRole("dialog", { name: "Buscar", exact: true });
async function open(page: Page, term: string) {
  await page.getByRole("button", { name: "Buscar informações", exact: true }).click(); const dialog = palette(page); await expect(dialog).toBeVisible(); const field = dialog.getByRole("combobox"); await expect(field).toBeFocused(); await field.fill(term);
  await expect(dialog.locator(".shell-search-count")).not.toHaveText("Buscando…"); return dialog;
}
function foreignLedger(value: Record<string, Row[]>) { return Object.fromEntries(Object.entries(value).map(([name, rows]) => [name, rows.filter(row => row.user_id === foreign || row.id === foreign)])); }
function traceClean(trace: Trace) { expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]); }
async function reader(page: Page, kind: "capture" | "task" | "project") {
  const f = await createSearchFixture(product); let trace: Trace | undefined;
  try {
    const a = await f.seed(); await f.seed(foreign, foreignSession); const baseline = await f.ledger(); trace = await attach(page, f); await start(page);
    const row = a[kind], title = kind === "project" ? a.project.name : kind === "capture" ? a.capture.title! : a.task.title;
    const dialog = await open(page, title); await expect(dialog.getByRole("option", { name: title, exact: true })).toBeVisible(); await dialog.getByRole("option", { name: title, exact: true }).click();
    expect(new URL(page.url()).searchParams.get(kind)).toBe(row.id); await expect(dialog).toBeHidden();
    const verify = async () => {
      if (kind === "capture") { await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue(a.capture.title!); await expect(page.getByLabel("Sua anotação", { exact: true })).toHaveValue(a.capture.content!); }
      else if (kind === "task") { const editor = page.getByRole("dialog", { name: "Editar tarefa", exact: true }); await expect(editor).toBeVisible(); await expect(editor.getByLabel("Título", { exact: true })).toHaveValue(a.task.title); await expect(editor.getByLabel("Descrição", { exact: true })).toHaveValue(a.task.description!); await expect(editor.getByLabel("Estado", { exact: true })).toHaveValue(a.task.status); }
      else { await expect(page.locator(".project-heading").getByRole("heading", { name: a.project.name, exact: true })).toBeVisible(); await expect(page.locator(".project-heading > p")).toHaveText(a.project.description!); await expect(page.locator(".projects-workspace").getByRole("link", { name: a.capture.title!, exact: true })).toBeVisible(); }
    };
    await verify(); await reload(page); await verify();
    const table = kind === "capture" ? "captures" : kind === "task" ? "tasks" : "projects"; const stored = (await f.db.query<{ payload: unknown }>(`select payload from public.${table} where user_id=$1 and id=$2`, [owner, row.id])).rows;
    expect(stored).toEqual([{ payload: row }]); expect(await f.ledger()).toEqual(baseline); expect(trace.writes).toEqual([]); expect(JSON.stringify(trace.searches)).not.toContain("FOREIGN_SEARCH_SENTINEL"); traceClean(trace);
  } finally { if (trace) await trace.close(); await f.dispose(); }
}
test("Busca SQL/SDK abre a Captura própria no reader e conserva o UUID após reload", async ({ page }) => { await reader(page, "capture"); });
test("Busca SQL/SDK abre a Tarefa própria com seus campos e conserva o UUID após reload", async ({ page }) => { await reader(page, "task"); });
test("Busca SQL/SDK abre o Projeto próprio e seus contêineres após reload", async ({ page }) => { await reader(page, "project"); });

async function sevenExpected(f: Fixture, a: Seed) {
  // Independent table columns/fixture IDs, without global_search or its mapper.
  const values = [owner, a.task.id, a.capture.id, a.page.id, a.transaction.id, a.file.id, a.project.id, a.habit.id];
  const rows = (await f.db.query<{ id: string; type: string; title: string }>("select id,type,title from (select id,'task' as type,payload->>'title' as title,0 as position from public.tasks where user_id=$1 and id=$2 union all select id,'capture',payload->>'title',1 from public.captures where user_id=$1 and id=$3 union all select id,'page',title,2 from public.knowledge_pages where user_id=$1 and id=$4 union all select id,'transaction',description,3 from public.fin_transactions where user_id=$1 and id=$5 union all select id,'file',name,4 from public.drive_files where user_id=$1 and id=$6 union all select id,'project',payload->>'name',5 from public.projects where user_id=$1 and id=$7 union all select id,'habit',name,6 from public.habits where user_id=$1 and id=$8) oracle order by position", values)).rows;
  const paths: Record<string, string> = { task: "/tarefas?task=", capture: "/capturar?capture=", page: "/conhecimento?note=", transaction: "/financeiro?transaction=", file: "/drive?file=", project: "/projetos?project=", habit: "/habitos?habit=" };
  return rows.map(row => ({ ...row, rank: 1, href: paths[row.type] + row.id }));
}
test("Busca SQL/SDK conecta sete tipos, acentos/ranking/máscara e distingue vazio de recusa real", async ({ page }) => {
  test.setTimeout(120_000); const f = await createSearchFixture(product); let trace: Trace | undefined;
  try {
    const a = await f.seed(); const b = await f.seed(foreign, foreignSession); const expected = await sevenExpected(f, a), baseline = await f.ledger(); expect(expected).toHaveLength(7);
    expect(await f.runSearch("arvore")).toEqual(expected); expect(await f.runSearch("ÁRVORE")).toEqual(expected); expect(await f.runSearch("arvore")).toEqual(expected);
    expect((await f.runSearch("arvore", foreign, foreignSession)).map(row => row.id)).toEqual([b.task.id, b.capture.id, b.page.id, b.transaction.id, b.file.id, b.project.id, b.habit.id]);
    expect(await f.runSearch("  ")).toEqual([]); expect(f.sdkCalls.at(-1)!.requests).toBe(0);
    await expect(f.runSearch("bad\u0000term")).rejects.toMatchObject({ code: "VALIDATION" }); expect(f.sdkCalls.at(-1)!.requests).toBe(0); await expect(f.runSearch("x".repeat(121))).rejects.toMatchObject({ code: "VALIDATION" }); expect(f.sdkCalls.at(-1)!.requests).toBe(0);
    await expect(f.runSearch("arvore", owner, foreignSession)).rejects.toMatchObject({ code: "forbidden" }); expect(f.sdkCalls.at(-1)!.sqlCode).toBe("42501"); expect(await f.ledger()).toEqual(baseline);
    const rankRows: Captura[] = [];
    for (const [title, content] of [["Ordem", "Texto"], ["Ordem A", "Texto"], ["Ordem A", "Texto"], ["Ordem B", "Texto"], ["Pré ordem", "Texto"], ["Distante", "Ordem texto privado"]]) rankRows.push(await f.command({ command: "capture.create", input: { type: "note", title, content, category_id: null, project_id: null, client_id: "rank-" + rankRows.length } }) as Captura);
    const order = await f.runSearch("ordem"); expect(order.map(row => [row.id, row.rank])).toEqual(rankRows.map((row, index) => [row.id, index === 0 ? 0 : index <= 3 ? 1 : index === 4 ? 2 : 3])); expect(await f.runSearch("ORDEM")).toEqual(order);
    const excluded = await f.command({ command: "capture.create", input: { type: "note", title: "Árvore excluída", content: "Texto", category_id: null, project_id: null, client_id: "trash-seed" } }) as Captura; await f.command({ command: "capture.delete", input: { id: excluded.id, client_id: "trash-delete" } });
    await f.command({ command: "capture.create", input: { type: "note", status: "draft", title: "Árvore rascunho", content: "Texto", category_id: null, project_id: null, client_id: "draft-seed" } }); expect(await f.runSearch("arvore")).toEqual(expected);
    const stable = await f.ledger(); trace = await attach(page, f); await start(page); let dialog = await open(page, "arvore"); await expect(dialog.getByRole("option")).toHaveCount(7); await expect(dialog.locator(".shell-search-count")).toHaveText("7 registros e 0 atalhos disponíveis");
    for (const item of expected) { const option = dialog.getByRole("option", { name: item.type === "transaction" ? "Lançamento financeiro · valores ocultos" : item.title, exact: true }); await expect(option).toHaveAttribute("href", item.href); }
    for (const canary of ["PRIVATE_FINANCE_TITLE_CANARY", "PRIVATE_FINANCE_NOTES_CANARY", "PRIVATE_PAGE_BODY_CANARY", "FOREIGN_SEARCH_SENTINEL", "9.876,54"]) { expect(await dialog.innerText()).not.toContain(canary); expect(await dialog.ariaSnapshot()).not.toContain(canary); }
    expect(JSON.stringify(trace.searches.at(-1)!.items)).not.toMatch(/PRIVATE_PAGE_BODY_CANARY|PRIVATE_FINANCE_NOTES_CANARY|amount_cents|user_id|payload|storage_path/);
    await dialog.getByRole("combobox").fill("zzzz inexistente"); await expect(dialog.getByText("Nenhum resultado. Tente um trecho do título, outro termo ou o nome de um módulo.", { exact: true })).toBeVisible(); await expect(dialog.getByRole("alert")).toHaveCount(0);
    await f.db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'conhecimento',false)", [owner]); await dialog.getByRole("combobox").fill("arvore"); await expect(dialog.getByRole("option")).toHaveCount(6); expect(trace.searches.at(-1)!.items.some(row => row.type === "page")).toBe(false); await f.db.query("delete from public.user_entitlements where user_id=$1 and feature_key='conhecimento'", [owner]);
    await f.db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'inicio',false)", [owner]); await dialog.getByRole("combobox").fill("arvore erro"); await expect(dialog.getByRole("alert")).toHaveText("Não foi possível buscar suas informações. Tente novamente."); await expect(dialog.getByRole("option")).toHaveCount(0); expect(trace.searches.at(-1)!.status).toBe(403); expect(f.sdkCalls.at(-1)!.sqlCode).toBe("42501"); await f.db.query("delete from public.user_entitlements where user_id=$1 and feature_key='inicio'", [owner]);
    await dialog.getByRole("combobox").fill("arvore"); await expect(dialog.getByRole("option")).toHaveCount(7); await expect(dialog.getByRole("alert")).toHaveCount(0); expect(await f.ledger()).toEqual(stable); expect(foreignLedger(await f.ledger())).toEqual(foreignLedger(baseline)); traceClean(trace);
    await dialog.getByRole("button", { name: "Fechar busca", exact: true }).click(); dialog = await open(page, "ordem"); const captureGroup = dialog.locator("section").filter({ has: page.getByRole("heading", { name: "Capturas", exact: true }) }); await expect(captureGroup).toHaveCount(1); await expect.poll(() => captureGroup.getByRole("option").evaluateAll(rows => rows.map(row => row.getAttribute("href")))).toEqual(order.map(row => row.href)); traceClean(trace);
  } finally { if (trace) await trace.close(); await f.dispose(); }
});

async function journal(page: Page) {
  return page.evaluate(userId => {
    const prefix = "segundo-cerebro:commands:v1:" + userId + ":";
    const value = JSON.parse(localStorage.getItem(prefix + "settled") ?? "null") as { items: { command: string; clientId: string; status: string; entityId: string | null }[] } | null;
    return { settlements: value?.items ?? [], pending: Object.keys(localStorage).filter(key => key.startsWith(prefix + "entry:")) };
  }, owner);
}
async function verifyQuickWrites(f: Fixture, trace: Trace, baseline: Awaited<ReturnType<Fixture["ledger"]>>) {
  expect(trace.writes.map(write => write.command)).toEqual(["capture.create", "task.create"]);
  for (const write of trace.writes) {
    expect(write.result.user_id).toBe(owner); expect(write.events).toHaveLength(1);
    expect(write.events[0]).toMatchObject({ user_id: owner, entity_type: write.command === "capture.create" ? "capture" : "task", entity_id: write.result.id, action: "created", canal: "web", before: null, after: write.result });
    expect(Date.parse(String(write.events[0]!.occurred_at))).toBe(Date.parse(f.now));
    expect(write.receipt).toMatchObject({ user_id: owner, command: write.command, client_id: write.clientId, result: write.result });
    const table = write.command === "capture.create" ? "captures" : "tasks", rows = (await f.db.query<{ payload: unknown }>(`select payload from public.${table} where user_id=$1 and id=$2`, [owner, write.result.id])).rows; expect(rows).toEqual([{ payload: write.result }]);
  }
  const after = await f.ledger(); expect(after.events).toHaveLength(baseline.events!.length + 2); expect(after.receipts).toHaveLength(baseline.receipts!.length + 2);
  expect(after.events!.filter(row => baseline.events!.some(old => old.id === row.id))).toEqual(baseline.events);
  expect(after.receipts!.filter(row => baseline.receipts!.some(old => old.user_id === row.user_id && old.command === row.command && old.client_id === row.client_id))).toEqual(baseline.receipts);
  expect(foreignLedger(after)).toEqual(foreignLedger(baseline));
  // The canonical trigger invalidates Projects/Habits once for capture INSERT,
  // while their content and the Finance revision remain unchanged.
  expect(after.routineRevisions).toEqual(baseline.routineRevisions!.map(row => row.user_id === owner ? { ...row, revision: Number(row.revision) + 1 } : row));
  for (const name of ["projects", "habits", "pages", "notebooks", "files", "accounts", "transactions", "refs", "links", "auth", "sessions", "entitlements", "financeRevisions"]) expect(after[name]).toEqual(baseline[name]);
}
test("Paleta conectada navega pelo teclado, devolve foco e ações rápidas emitem Eventos web reais", async ({ page }) => {
  test.setTimeout(120_000); const f = await createSearchFixture(product); let trace: Trace | undefined;
  try {
    const a = await f.seed(); await f.seed(foreign, foreignSession); const baseline = await f.ledger(); trace = await attach(page, f); await start(page);
    const trigger = page.getByRole("button", { name: "Buscar informações", exact: true }); await trigger.focus(); await page.keyboard.press("Control+k"); let dialog = palette(page); await expect(dialog.getByRole("combobox")).toBeFocused();
    await dialog.getByRole("combobox").fill("arvore"); await expect(dialog.getByRole("option")).toHaveCount(7); const field = dialog.getByRole("combobox"); await expect(field).toHaveAttribute("aria-controls", "command-palette-results"); await expect(field).toHaveAttribute("aria-expanded", "true"); await expect(dialog.locator(".shell-search-count")).toHaveText("7 registros e 0 atalhos disponíveis");
    await field.press("ArrowDown"); await expect(field).toHaveAttribute("aria-activedescendant", "command-result-1"); await expect(dialog.getByRole("option", { selected: true })).toHaveAttribute("href", "/capturar?capture=" + a.capture.id);
    await field.press("ArrowUp"); await field.press("ArrowUp"); await expect(field).toHaveAttribute("aria-activedescendant", "command-result-0"); await expect(dialog.getByRole("option", { selected: true })).toHaveAttribute("href", "/tarefas?task=" + a.task.id);
    await field.press("Enter"); await expect(dialog).toBeHidden(); await expect(page.getByRole("dialog", { name: "Editar tarefa", exact: true }).getByLabel("Título", { exact: true })).toHaveValue(a.task.title); expect(new URL(page.url()).searchParams.get("task")).toBe(a.task.id); await page.getByRole("dialog", { name: "Editar tarefa", exact: true }).getByRole("button", { name: "Cancelar", exact: true }).click();
    await trigger.focus(); await page.keyboard.press("Meta+k"); dialog = palette(page); await expect(dialog.getByRole("combobox")).toBeFocused(); await dialog.getByRole("combobox").press("Escape"); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 }); await expect(trigger).toBeVisible(); dialog = await open(page, "Nova captura"); await dialog.getByRole("option", { name: "Nova captura", exact: true }).click(); expect(new URL(page.url()).searchParams.get("capture")).toBe("new"); await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue(""); expect(await f.ledger()).toEqual(baseline);
    await page.getByLabel("Título da nota", { exact: true }).fill("Captura pela ação rápida SQL"); await page.getByLabel("Sua anotação", { exact: true }).fill("Texto criado no formulário original após abrir pela paleta."); await page.getByRole("button", { name: "Salvar nota", exact: true }).click(); await expect(page.getByText("Salva na sua conta", { exact: true })).toBeVisible(); expect(trace.writes).toHaveLength(1);
    dialog = await open(page, "Nova tarefa"); await dialog.getByRole("option", { name: "Nova tarefa", exact: true }).click(); let editor = page.getByRole("dialog", { name: "Nova tarefa", exact: true }); await expect(editor).toBeVisible(); await editor.getByLabel("Título", { exact: true }).fill("Tarefa pela ação rápida SQL"); await editor.getByLabel("Descrição", { exact: true }).fill("Descrição criada pela tela conectada."); await editor.getByRole("button", { name: "Criar tarefa", exact: true }).click(); await expect(editor).toBeHidden(); expect(trace.writes).toHaveLength(2);
    // Repeated same-path action must mount the actual form again; cancel writes
    // nothing and the URI is cleared by the original TaskEditor/History path.
    dialog = await open(page, "Nova tarefa"); await dialog.getByRole("option", { name: "Nova tarefa", exact: true }).click(); editor = page.getByRole("dialog", { name: "Nova tarefa", exact: true }); await expect(editor).toBeVisible(); await expect(editor.getByLabel("Título", { exact: true })).toHaveValue(""); const beforeCancel = await f.ledger(); await editor.getByRole("button", { name: "Cancelar", exact: true }).click(); await expect(editor).toBeHidden(); expect(await f.ledger()).toEqual(beforeCancel);
    await verifyQuickWrites(f, trace, baseline); const protectedSends = await journal(page); expect(protectedSends.pending).toEqual([]); expect(protectedSends.settlements).toHaveLength(2); for (const write of trace.writes) expect(protectedSends.settlements).toContainEqual(expect.objectContaining({ command: write.command, clientId: write.clientId, status: "confirmed", entityId: write.result.id })); traceClean(trace);
  } finally { if (trace) await trace.close(); await f.dispose(); }
});

test("Busca canônica mede 50 mil metadados e conserva o orçamento local recomendado de 500 ms", async () => {
  test.setTimeout(120_000); const db = await createLocalCanonicalSql();
  try {
    const source = await readFile("supabase/tests/global-search-performance.sql", "utf8");
    // Whole canonical transaction, its own transient third actor, warmup and
    // three measurements per six terms. No copied function or clock/DDL rewrite.
    const results = await db.exec(source), metrics = results.flatMap(result => result.rows).filter(row => "within_recommended_budget" in row) as { term: string; mean_ms: number | string; max_ms: number | string; item_count: number; budget_ms: number; within_recommended_budget: boolean }[];
    expect(metrics.map(row => row.term).sort()).toEqual(["ação", "planej", "Ação planejamento 50000", "%", "Documento pessoal", "termo inexistente"].sort()); expect(metrics).toHaveLength(6);
    for (const row of metrics) { const mean = Number(row.mean_ms), maximum = Number(row.max_ms); expect(Number.isFinite(mean) && Number.isFinite(maximum)).toBe(true); expect(mean).toBeGreaterThanOrEqual(0); expect(maximum).toBeGreaterThanOrEqual(mean); expect(row.item_count).toBeGreaterThanOrEqual(0); expect(row.item_count).toBeLessThanOrEqual(70); expect(row.budget_ms).toBe(500); expect(row.within_recommended_budget).toBe(maximum <= row.budget_ms); expect(row.within_recommended_budget).toBe(true); }
    expect((await db.query("select count(*)::integer as users from auth.users")).rows).toEqual([{ users: 0 }]); expect((await db.query("select count(*)::integer as files from public.drive_files")).rows).toEqual([{ files: 0 }]);
    // Numeric observation from this run only. Recommended local performance is
    // not a hosted/hardware/client latency SLA and does not include debounce.
    await test.info().attach("search-local-budget", { contentType: "application/json", body: Buffer.from(JSON.stringify({ schemaVersion: 1, scenario: "search-canonical-local-budget", source: "supabase/tests/global-search-performance.sql", ownerRecords: 50000, samplesPerTerm: 3, recommendedBudgetMs: 500, hostedVerified: false, clientLatencyVerified: false, maximumMs: Math.max(...metrics.map(row => Number(row.max_ms))), meanMs: metrics.map(row => Number(row.mean_ms)) })) });
  } finally { await db.close(); }
});
