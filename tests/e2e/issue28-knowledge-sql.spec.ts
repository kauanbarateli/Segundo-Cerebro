/** Real TipTap/providers/adapter -> explicit public HTTP seam -> Core/Store/
 * Gateway/canonical disposable SQL. Auth catalogue, HTTP and Next navigation/
 * Link/dynamic loader/CSS are declared seams. No Next handler, runtime factory,
 * SDK/Auth/hosted service, layout, device or other three issue28 criteria claim.
 * Chromium execution is Linux CI only, never a local Windows browser service.
 */
import { expect, test, type Page, type Route } from "@playwright/test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import type { KnowledgeRpc } from "../../src/adapters/db/knowledge-gateway";
import type { Pagina, ComandoConhecimento } from "../../src/core/conhecimento";

type Product = typeof import("./fixtures/issue28-knowledge-sql.entry");
const origin = "https://issue28-knowledge-sql.test", now = "2030-01-10T02:30:00.000Z";
const owner = "58000000-0000-4000-8000-000000000001", session = "58000000-0000-4000-8000-000000000002";
const foreign = "58000000-0000-4000-8000-000000000003", foreignSession = "58000000-0000-4000-8000-000000000004";
const sourceTitle = "Origem SQL", targetTitle = "Destino novo SQL", renamedTitle = "Destino renomeado SQL";
let product: Product, browserBundle: string;

test.beforeAll(async () => {
  const nodeBuild = await rolldown({ input: resolve("tests/e2e/fixtures/issue28-knowledge-sql.entry.ts"), platform: "node", tsconfig: false,
    resolve: { conditionNames: ["react-server", "node", "import", "default"] } });
  try {
    const generated = await nodeBuild.generate({ format: "es", codeSplitting: false });
    if (generated.output.length !== 1 || generated.output[0]?.type !== "chunk" || generated.output[0].imports.length || generated.output[0].dynamicImports.length) throw new Error("Standalone knowledge product bundle is required.");
    product = await import("data:text/javascript;base64," + Buffer.from(generated.output[0].code).toString("base64")) as Product;
    expect(Object.keys(product).sort()).toEqual(["AuthGuardError", "ErroDeDominio", "conhecimentoDTO", "createKnowledgeGateway", "createKnowledgeStore", "decodeKnowledgeCommand", "executarConhecimento", "leituraPagina", "leituraRelacionados"]);
  } finally { await nodeBuild.close(); }
  const navigation = resolve("tests/e2e/fixtures/issue28-knowledge-browser.tsx").replaceAll("\\", "/");
  const browserBuild = await rolldown({ input: navigation, platform: "browser", tsconfig: false,
    resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "issue28-next-and-css-seams", resolveId(source) {
      if (source.endsWith(".css")) return "\0issue28-css";
      if (source === "next/link") return "\0issue28-link";
      if (source === "next/dynamic") return "\0issue28-dynamic";
    }, load(id) {
      if (id === "\0issue28-css") return "export {};";
      if (id === "\0issue28-link") return `export { NavigationLink as default } from ${JSON.stringify(navigation)};`;
      // Replace only Next's loading boundary; the imported TipTap module is real.
      if (id === "\0issue28-dynamic") return "import { createElement, lazy, Suspense } from 'react'; export default function dynamic(loader, options = {}) { const Component = lazy(loader); return function Dynamic(props) { return createElement(Suspense, { fallback: options.loading ? createElement(options.loading) : null }, createElement(Component, props)); }; }";
    } }],
  });
  try {
    const generated = await browserBuild.generate({ format: "iife", codeSplitting: false, name: "Issue28KnowledgeFixture" });
    const chunk = generated.output[0];
    // Rolldown records the inlined editor's self chunk in dynamicImports even
    // though its loader is Promise.resolve() and needs no module HTTP request.
    if (generated.output.length !== 1 || chunk?.type !== "chunk" || chunk.imports.length || chunk.dynamicImports.some(name => name !== chunk.fileName) || /\bimport\s*\(/.test(chunk.code)) throw new Error("Standalone knowledge browser bundle is required.");
    browserBundle = chunk.code;
  } finally { await browserBuild.close(); }
});

const signatures: Record<Parameters<KnowledgeRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  knowledge_snapshot: { sql: "select public.knowledge_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  knowledge_commit: { sql: "select public.knowledge_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  knowledge_receipt: { sql: "select public.knowledge_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
};
async function dataFixture() {
  const db = await createLocalCanonicalSql();
  await db.query("insert into auth.users(id,aud,role,email) values ($1,'authenticated','authenticated','issue28-owner@example.invalid'),($2,'authenticated','authenticated','issue28-foreign@example.invalid')", [owner, foreign]);
  await db.query("insert into auth.sessions(id,user_id) values ($1,$2),($3,$4)", [session, owner, foreignSession, foreign]);
  let sequence = 20;
  const deps = { clock: { now: () => now }, ids: { next: () => `58000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } };
  function gateway(operation: string, actor = owner, sid = session) {
    const rpc: KnowledgeRpc = async (name, args) => {
      expect(args.p_user).toBe(actor); expect(args.p_session).toBe(sid); expect(args.p_operation).toBe(operation);
      const signature = signatures[name];
      expect(Object.keys(args).sort()).toEqual(["p_user", "p_session", "p_operation", ...signature.extra].sort());
      try {
        const result = await db.transaction(async tx => {
          await tx.exec("set local role service_role");
          return tx.query<{ data: unknown }>(signature.sql, [args.p_user, args.p_session, args.p_operation, ...signature.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]);
        });
        return { data: result.rows[0]!.data, error: null };
      } catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") throw error;
        return { data: null, error: { code: error.code } };
      }
    };
    return product.createKnowledgeGateway(actor, sid, operation, rpc);
  }
  async function command(value: unknown, actor = owner, sid = session) {
    const decoded = product.decodeKnowledgeCommand(value);
    return product.executarConhecimento(product.createKnowledgeStore(gateway(decoded.command, actor, sid)), deps, { user_id: actor, canal: "web" }, decoded);
  }
  await command({ command: "knowledge.notebook.create", input: { name: "Caderno SQL", client_id: "setup-book" } });
  const book = (await db.query<{ id: string }>("select id from public.knowledge_notebooks where user_id=$1 and payload->>'name'='Caderno SQL'", [owner])).rows;
  expect(book).toHaveLength(1);
  await command({ command: "knowledge.page.create", input: { notebook_id: book[0]!.id, title: sourceTitle, client_id: "setup-source" } });
  const source = (await db.query<{ payload: Pagina }>("select payload from public.knowledge_pages where user_id=$1 and title=$2", [owner, sourceTitle])).rows;
  expect(source).toHaveLength(1);
  await command({ command: "knowledge.notebook.create", input: { name: "FOREIGN_NOTEBOOK_SENTINEL", client_id: "foreign-book" } }, foreign, foreignSession);
  const foreignBook = (await db.query<{ id: string }>("select id from public.knowledge_notebooks where user_id=$1", [foreign])).rows;
  expect(foreignBook).toHaveLength(1);
  await command({ command: "knowledge.page.create", input: { notebook_id: foreignBook[0]!.id, title: "FOREIGN_PAGE_SENTINEL", client_id: "foreign-page" } }, foreign, foreignSession);
  return { db, gateway, command, source: source[0]!.payload };
}
type Fixture = Awaited<ReturnType<typeof dataFixture>>;
type Write = { request: ComandoConhecimento; result: unknown };
async function attach(page: Page, fixture: Fixture) {
  const reads: string[] = [], writes: Write[] = [], unexpected: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({ time: new Date(now) });
  await page.route("**/*", async (route: Route) => {
    const browserRequest = route.request(), request = new Request(browserRequest.url(), { method: browserRequest.method(), headers: browserRequest.headers(), ...(browserRequest.method() === "POST" ? { body: browserRequest.postData() } : {}) });
    const url = new URL(request.url);
    if (url.origin !== origin) { unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" }, body: JSON.stringify(body) });
    if (url.pathname === "/api/knowledge") {
      if (request.headers.get("X-Expected-User-ID") !== owner || !["GET", "POST"].includes(request.method)) { unexpected.push("UNBOUND_REQUEST"); await route.abort(); return; }
      if (request.method === "GET") {
        const id = url.searchParams.get("page");
        if (url.searchParams.size && (url.searchParams.size !== 1 || !id || !/^[0-9a-f-]{36}$/i.test(id))) { unexpected.push("UNKNOWN_QUERY"); await route.abort(); return; }
        const snapshot = await fixture.gateway("read.knowledge").snapshot();
        // Declared public-HTTP seam, product projections over actual SQL.
        reads.push(url.pathname + url.search); await json(id ? product.leituraPagina(snapshot, id) : product.conhecimentoDTO(snapshot)); return;
      }
      if (url.search || request.headers.get("Origin") !== origin || !request.headers.get("Content-Type")?.startsWith("application/json")) { unexpected.push("INVALID_WRITE_CHANNEL"); await route.abort(); return; }
      try {
        const body = await request.text(); if (Buffer.byteLength(body) > 65_536) throw new Error("Bounded fixture request required.");
        const decoded = product.decodeKnowledgeCommand(JSON.parse(body));
        if (!["knowledge.page.update", "knowledge.page.resolve-ref"].includes(decoded.command)) { unexpected.push("UNEXPECTED_COMMAND"); await route.abort(); return; }
        const result = await fixture.command(decoded); writes.push({ request: decoded, result }); await json({ ok: true, result });
      } catch (error) {
        if (error instanceof product.ErroDeDominio) { await json({ code: error.code, message: "A operação SQL não foi concluída." }, error.code === "CONFLICT" ? 409 : 400); return; }
        if (error instanceof product.AuthGuardError) { await json({ code: error.code, message: "A operação não foi autorizada." }, 403); return; }
        unexpected.push("UNEXPECTED_WRITE_FAILURE"); await route.abort();
      }
      return;
    }
    if (request.method === "GET" && browserRequest.isNavigationRequest() && url.pathname === "/conhecimento") {
      if (url.searchParams.size !== 1 || !/^[0-9a-f-]{36}$/i.test(url.searchParams.get("note") ?? "")) { unexpected.push("UNKNOWN_DOCUMENT"); await route.abort(); return; }
      await route.fulfill({ status: 200, contentType: "text/html", body: '<html lang="pt-BR"><body><div id="issue28-knowledge-sql"></div></body></html>' }); return;
    }
    unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  return { reads, writes, unexpected, errors };
}
async function mount(page: Page) {
  await page.addScriptTag({ content: browserBundle });
  await page.evaluate(userId => (globalThis as unknown as { __startIssue28KnowledgeSql(userId: string): void }).__startIssue28KnowledgeSql(userId), owner);
  await expect(page.locator("main")).toHaveAttribute("data-application-mode", "connected");
  await expect(page.getByRole("textbox", { name: "Conteúdo da página", exact: true })).toBeVisible();
}
type Event = { id: string; user_id: string; entity_id: string; entity_type: string; action: string; canal: string; before: Pagina | null; after: Pagina | null };
const events = (fixture: Fixture) => fixture.db.query<Event>("select id,user_id,entity_id,entity_type,action,canal,before,after from public.domain_events where user_id=$1 order by id", [owner]).then(result => result.rows);
const receipts = (fixture: Fixture) => fixture.db.query<{ command: string; client_id: string; result: unknown }>("select command,client_id,result from app_private.command_receipts where user_id=$1 order by command,client_id", [owner]).then(result => result.rows);
const refs = (fixture: Fixture) => fixture.db.query<{ id: string; user_id: string; page_id: string; target_id: string; alias: string }>("select id,user_id,page_id,target_id,alias from public.page_refs where user_id=$1 order by id", [owner]).then(result => result.rows);

test("wiki-link criado no editor persiste no SQL, mostra backlink e mantém o destino após renomear e recarregar", async ({ page }) => {
  const fixture = await dataFixture();
  try {
    const baselineEvents = await events(fixture), baselineReceipts = await receipts(fixture);
    const foreignBefore = (await fixture.db.query<{ payload: Pagina }>("select payload from public.knowledge_pages where user_id=$1 order by id", [foreign])).rows;
    const trace = await attach(page, fixture);
    await page.goto(`${origin}/conhecimento?note=${fixture.source.id}`); await mount(page);
    await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(sourceTitle);
    await expect(page.locator("main")).not.toContainText(/FOREIGN_PAGE_SENTINEL|FOREIGN_NOTEBOOK_SENTINEL/);
    const editor = page.getByRole("textbox", { name: "Conteúdo da página", exact: true });
    await editor.fill("Referência SQL para "); await editor.press("End"); await editor.pressSequentially("[[" + targetTitle);
    await page.getByRole("button", { name: `Criar página “${targetTitle}”`, exact: true }).click();
    await expect(page.getByText("Referência conectada.", { exact: true })).toBeVisible();
    const created = (await fixture.db.query<{ payload: Pagina }>("select payload from public.knowledge_pages where user_id=$1 and title=$2", [owner, targetTitle])).rows;
    expect(created).toHaveLength(1); const destination = created[0]!.payload;
    const reference = await refs(fixture);
    expect(reference).toHaveLength(1); expect(reference[0]).toMatchObject({ user_id: owner, page_id: fixture.source.id, target_id: destination.id, alias: targetTitle });
    const links = page.locator(".knowledge-backlinks").filter({ has: page.getByRole("heading", { name: "Referências nesta página", exact: true }) });
    const destinationLink = links.getByRole("link", { name: targetTitle, exact: true });
    await expect(destinationLink).toHaveAttribute("href", `/conhecimento?note=${destination.id}`); await destinationLink.click();
    await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(targetTitle);
    const backlinks = page.locator(".knowledge-backlinks").filter({ has: page.getByRole("heading", { name: "Referências a esta página", exact: true }) });
    await expect(backlinks.getByRole("link", { name: sourceTitle, exact: true })).toHaveAttribute("href", `/conhecimento?note=${fixture.source.id}`);
    expect(trace.writes.map(write => write.request.command)).toEqual(["knowledge.page.update", "knowledge.page.resolve-ref"]);
    const afterCreation = await events(fixture), baselineIds = new Set(baselineEvents.map(event => event.id));
    expect(afterCreation.filter(event => baselineIds.has(event.id))).toEqual(baselineEvents);
    const creationEvents = afterCreation.filter(event => !baselineIds.has(event.id));
    expect(creationEvents).toHaveLength(3); expect(creationEvents.every(event => event.user_id === owner && event.entity_type === "knowledge_page" && event.canal === "web")).toBe(true);
    expect(creationEvents.filter(event => event.entity_id === destination.id)).toEqual([expect.objectContaining({ action: "created", before: null, after: destination })]);
    expect(creationEvents.filter(event => event.entity_id === fixture.source.id).map(event => event.action)).toEqual(["updated", "updated"]);
    const afterCreationReceipts = await receipts(fixture); expect(afterCreationReceipts).toHaveLength(baselineReceipts.length + 2);
    for (const write of trace.writes) expect(afterCreationReceipts.find(receipt => receipt.command === write.request.command && receipt.client_id === write.request.input.client_id)?.result).toEqual(write.result);

    await page.getByLabel("Título da página", { exact: true }).fill(renamedTitle);
    await page.getByRole("button", { name: "Salvar página", exact: true }).click();
    await expect(page.getByText("Página salva.", { exact: true })).toBeVisible();
    const renamed = (await fixture.db.query<{ payload: Pagina }>("select payload from public.knowledge_pages where user_id=$1 and id=$2", [owner, destination.id])).rows;
    expect(renamed).toHaveLength(1); expect(renamed[0]!.payload).toEqual({ ...destination, title: renamedTitle, normalized_title: "destino renomeado sql", version: destination.version + 1 });
    expect(await refs(fixture)).toEqual(reference); // ID-based reference, alias need not be globally rewritten.
    const afterRename = await events(fixture), renameEvents = afterRename.filter(event => !new Set(afterCreation.map(row => row.id)).has(event.id));
    expect(renameEvents).toEqual([expect.objectContaining({ user_id: owner, entity_id: destination.id, entity_type: "knowledge_page", action: "updated", canal: "web", before: destination, after: renamed[0]!.payload })]);
    const finalReceipts = await receipts(fixture); expect(finalReceipts).toHaveLength(baselineReceipts.length + 3);
    expect(trace.writes).toHaveLength(3);
    for (const write of trace.writes) expect(finalReceipts.find(receipt => receipt.command === write.request.command && receipt.client_id === write.request.input.client_id)?.result).toEqual(write.result);
    await backlinks.getByRole("link", { name: sourceTitle, exact: true }).click();
    await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(sourceTitle);
    await expect(links.getByRole("link", { name: renamedTitle, exact: true })).toHaveAttribute("href", `/conhecimento?note=${destination.id}`);
    const readsBeforeReload = trace.reads.length; await page.reload(); await mount(page);
    expect(trace.reads.length).toBeGreaterThan(readsBeforeReload);
    await expect(links.getByRole("link", { name: renamedTitle, exact: true })).toBeVisible();
    await expect(editor.locator(`a[data-wiki="${destination.id}"]`)).toHaveText(targetTitle);
    await links.getByRole("link", { name: renamedTitle, exact: true }).click();
    await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(renamedTitle);
    await expect(backlinks.getByRole("link", { name: sourceTitle, exact: true })).toBeVisible();
    expect((await fixture.db.query<{ payload: Pagina }>("select payload from public.knowledge_pages where user_id=$1 order by id", [foreign])).rows).toEqual(foreignBefore);
    await expect(page.locator("main")).not.toContainText(/FOREIGN_PAGE_SENTINEL|FOREIGN_NOTEBOOK_SENTINEL/);
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await fixture.db.close(); }
});
