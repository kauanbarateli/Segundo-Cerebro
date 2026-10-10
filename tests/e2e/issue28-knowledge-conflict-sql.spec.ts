/** Two independent browser contexts -> real providers/TipTap/journal/client ->
 * declared Auth/public HTTP seam -> Core/Store/Gateway/canonical disposable SQL.
 * A logical stale page version is rejected by the real Core before commit, not
 * a fabricated HTTP409 or a multi-connection PostgreSQL concurrency claim.
 * Next handlers/runtime/SDK/Auth/hosted services/CSS/device are not exercised.
 */
import { expect, test, type Browser, type Page, type Route } from "@playwright/test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import type { KnowledgeRpc } from "../../src/adapters/db/knowledge-gateway";
import type { ComandoConhecimento, DocumentoPagina, Pagina } from "../../src/core/conhecimento";

type Product = typeof import("./fixtures/issue28-knowledge-sql.entry");
type Update = Extract<ComandoConhecimento, { command: "knowledge.page.update" }>;
const origin = "https://issue28-knowledge-conflict-sql.test", now = "2030-01-10T02:30:00.000Z";
const owner = "59000000-0000-4000-8000-000000000001";
const sessions = { A: "59000000-0000-4000-8000-000000000002", B: "59000000-0000-4000-8000-000000000003" };
const foreign = "59000000-0000-4000-8000-000000000004", foreignSession = "59000000-0000-4000-8000-000000000005";
const initialTitle = "Página SQL em disputa", aTitle = "Rascunho da sessão A", bTitle = "Versão da sessão B";
const aText = "Texto local A ainda não salvo.", bText = "Texto B salvo por outra sessão.";
const continuedTitle = "Continuação após adotar B", continuedText = "Nova edição A sobre a versão salva B.";
const documentOf = (text: string): DocumentoPagina => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
let product: Product, browserBundle: string;
test.describe.configure({ retries: 0 });
test.beforeAll(async () => {
  if (process.platform !== "linux") throw new Error("Knowledge conflict browser acceptance requires the Linux CI; local QA uses no Chromium.");
  const nodeBuild = await rolldown({ input: resolve("tests/e2e/fixtures/issue28-knowledge-sql.entry.ts"), platform: "node", tsconfig: false,
    resolve: { conditionNames: ["react-server", "node", "import", "default"] } });
  try {
    const generated = await nodeBuild.generate({ format: "es", codeSplitting: false });
    const chunk = generated.output[0];
    if (generated.output.length !== 1 || chunk?.type !== "chunk" || chunk.imports.length || chunk.dynamicImports.length) throw new Error("Standalone knowledge product bundle is required.");
    product = await import("data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64")) as Product;
    expect(Object.keys(product).sort()).toEqual(["AuthGuardError", "ErroDeDominio", "conhecimentoDTO", "createKnowledgeGateway", "createKnowledgeStore", "decodeKnowledgeCommand", "executarConhecimento", "leituraPagina", "leituraRelacionados"]);
  } finally { await nodeBuild.close(); }
  // Reuse the frozen fixture unchanged: its provider, TipTap and journal are real.
  const navigation = resolve("tests/e2e/fixtures/issue28-knowledge-browser.tsx").replaceAll("\\", "/");
  const browserBuild = await rolldown({ input: navigation, platform: "browser", tsconfig: false,
    resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "issue28-conflict-next-and-css-seams", resolveId(source) {
      if (source.endsWith(".css")) return "\0issue28-conflict-css";
      if (source === "next/link") return "\0issue28-conflict-link";
      if (source === "next/dynamic") return "\0issue28-conflict-dynamic";
    }, load(id) {
      if (id === "\0issue28-conflict-css") return "export {};";
      if (id === "\0issue28-conflict-link") return `export { NavigationLink as default } from ${JSON.stringify(navigation)};`;
      if (id === "\0issue28-conflict-dynamic") return "import { createElement, lazy, Suspense } from 'react'; export default function dynamic(loader, options = {}) { const Component = lazy(loader); return function Dynamic(props) { return createElement(Suspense, { fallback: options.loading ? createElement(options.loading) : null }, createElement(Component, props)); }; }";
    } }],
  });
  try {
    const generated = await browserBuild.generate({ format: "iife", codeSplitting: false, name: "Issue28KnowledgeConflictFixture" });
    const chunk = generated.output[0];
    // The real editor is inlined: metadata self-chunk is allowed, runtime import is not.
    if (generated.output.length !== 1 || chunk?.type !== "chunk" || chunk.imports.length || chunk.dynamicImports.some(name => name !== chunk.fileName) || /\bimport\s*\(/.test(chunk.code)) throw new Error("Standalone knowledge browser bundle is required.");
    browserBundle = chunk.code;
  } finally { await browserBuild.close(); }
});

const signatures: Record<Parameters<KnowledgeRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  knowledge_snapshot: { sql: "select public.knowledge_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  knowledge_commit: { sql: "select public.knowledge_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  knowledge_receipt: { sql: "select public.knowledge_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
};
type Commit = { userId: string; sessionId: string; operation: string; request: unknown; reply: unknown };
async function dataFixture() {
  const db = await createLocalCanonicalSql(), commits: Commit[] = [];
  try {
  await db.query("insert into auth.users(id,aud,role,email) values ($1,'authenticated','authenticated','issue28-conflict@example.invalid'),($2,'authenticated','authenticated','issue28-conflict-foreign@example.invalid')", [owner, foreign]);
  await db.query("insert into auth.sessions(id,user_id) values ($1,$2),($3,$2),($4,$5)", [sessions.A, owner, sessions.B, foreignSession, foreign]);
  let sequence = 20;
  const deps = { clock: { now: () => now }, ids: { next: () => `59000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } };
  function gateway(operation: string, actor: string, sid: string) {
    const rpc: KnowledgeRpc = async (name, args) => {
      expect(args.p_user).toBe(actor); expect(args.p_session).toBe(sid); expect(args.p_operation).toBe(operation);
      const signature = signatures[name];
      expect(Object.keys(args).sort()).toEqual(["p_user", "p_session", "p_operation", ...signature.extra].sort());
      const binding = (await db.query<{ user_id: string }>("select user_id from auth.sessions where id=$1", [sid])).rows;
      expect(binding).toEqual([{ user_id: actor }]);
      try {
        const result = await db.transaction(async tx => {
          await tx.exec("set local role service_role");
          return tx.query<{ data: unknown }>(signature.sql, [args.p_user, args.p_session, args.p_operation, ...signature.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]);
        });
        const data = result.rows[0]!.data;
        if (name === "knowledge_commit") commits.push({ userId: actor, sessionId: sid, operation, request: structuredClone(args.p_request), reply: structuredClone(data) });
        return { data, error: null };
      } catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") throw error;
        throw new Error("Unexpected SQLSTATE in the conflict fixture: " + error.code);
      }
    };
    return product.createKnowledgeGateway(actor, sid, operation, rpc);
  }
  async function command(value: unknown, actor = owner, sid = sessions.A) {
    const decoded = product.decodeKnowledgeCommand(value);
    return product.executarConhecimento(product.createKnowledgeStore(gateway(decoded.command, actor, sid)), deps, { user_id: actor, canal: "web" }, decoded);
  }
  await command({ command: "knowledge.notebook.create", input: { name: "Caderno de conflito SQL", client_id: "setup-book" } });
  const books = (await db.query<{ id: string }>("select id from public.knowledge_notebooks where user_id=$1", [owner])).rows;
  expect(books).toHaveLength(1);
  await command({ command: "knowledge.page.create", input: { notebook_id: books[0]!.id, title: initialTitle, client_id: "setup-page" } });
  await command({ command: "knowledge.notebook.create", input: { name: "FOREIGN_CONFLICT_BOOK_SENTINEL", client_id: "foreign-book" } }, foreign, foreignSession);
  const foreignBooks = (await db.query<{ id: string }>("select id from public.knowledge_notebooks where user_id=$1", [foreign])).rows;
  expect(foreignBooks).toHaveLength(1);
  await command({ command: "knowledge.page.create", input: { notebook_id: foreignBooks[0]!.id, title: "FOREIGN_CONFLICT_PAGE_SENTINEL", client_id: "foreign-page" } }, foreign, foreignSession);
  const pages = (await db.query<{ payload: Pagina }>("select payload from public.knowledge_pages where user_id=$1", [owner])).rows;
  expect(pages).toHaveLength(1); expect(pages[0]!.payload.version).toBe(1);
  return { db, commits, gateway, command, initial: pages[0]!.payload };
  } catch (error) { await db.close(); throw error; }
}
type Fixture = Awaited<ReturnType<typeof dataFixture>>;
const ledgerQueries = {
  users: "select to_jsonb(t) as row from auth.users t order by id", sessions: "select to_jsonb(t) as row from auth.sessions t order by id",
  notebooks: "select to_jsonb(t) as row from public.knowledge_notebooks t order by id", pages: "select to_jsonb(t) as row from public.knowledge_pages t order by id",
  refs: "select to_jsonb(t) as row from public.page_refs t order by id", links: "select to_jsonb(t) as row from public.links t order by id",
  captures: "select to_jsonb(t) as row from public.captures t order by id", tasks: "select to_jsonb(t) as row from public.tasks t order by id",
  events: "select to_jsonb(t) as row from public.domain_events t order by id", receipts: "select to_jsonb(t) as row from app_private.command_receipts t order by user_id,command,client_id",
  revisions: "select to_jsonb(t) as row from app_private.capture_task_revisions t order by user_id", limits: "select to_jsonb(t) as row from app_private.rate_limits t order by scope,subject_hash",
};
type Row = Record<string, unknown>;
type Ledger = Record<keyof typeof ledgerQueries, Row[]>;
async function ledger(fixture: Fixture): Promise<Ledger> {
  const result = {} as Ledger;
  for (const [key, query] of Object.entries(ledgerQueries)) result[key as keyof Ledger] = (await fixture.db.query<{ row: Row }>(query)).rows.map(value => value.row);
  return result;
}
async function storedPage(fixture: Fixture) {
  const rows = (await fixture.db.query<{ payload: Pagina }>("select payload from public.knowledge_pages where user_id=$1 and id=$2", [owner, fixture.initial.id])).rows;
  expect(rows).toHaveLength(1); return rows[0]!.payload;
}
function expectSingleUpdate(before: Ledger, after: Ledger, oldPage: Pagina, newPage: Pagina, clientId: string) {
  const previousIds = new Set(before.events.map(row => row.id));
  expect(after.events.filter(row => previousIds.has(row.id))).toEqual(before.events);
  const addedEvents = after.events.filter(row => !previousIds.has(row.id));
  expect(addedEvents).toEqual([expect.objectContaining({ user_id: owner, entity_id: oldPage.id, entity_type: "knowledge_page", action: "updated", canal: "web", before: oldPage, after: newPage })]);
  expect(typeof addedEvents[0]!.occurred_at).toBe("string"); expect(new Date(addedEvents[0]!.occurred_at as string).toISOString()).toBe(now);
  const newReceipts = after.receipts.filter(row => !before.receipts.some(old => old.user_id === row.user_id && old.command === row.command && old.client_id === row.client_id));
  expect(newReceipts).toEqual([expect.objectContaining({ user_id: owner, command: "knowledge.page.update", client_id: clientId, result: newPage })]);
  expect(after.receipts.filter(row => !newReceipts.includes(row))).toEqual(before.receipts);
  for (const key of ["users", "sessions", "notebooks", "refs", "links", "captures", "tasks"] as const) expect(after[key]).toEqual(before[key]);
  expect(after.pages.filter(row => row.id !== oldPage.id)).toEqual(before.pages.filter(row => row.id !== oldPage.id));
  const changedPages = after.pages.filter(row => row.id === oldPage.id);
  expect(changedPages).toEqual([expect.objectContaining({ user_id: owner, payload: newPage, title: newPage.title, normalized_title: newPage.normalized_title, document: newPage.document, content_text: newPage.content_text, version: newPage.version })]);
  expect(after.pages.filter(row => row.user_id === foreign)).toEqual(before.pages.filter(row => row.user_id === foreign));
  expect(after.events.filter(row => row.user_id === foreign)).toEqual(before.events.filter(row => row.user_id === foreign));
  expect(after.receipts.filter(row => row.user_id === foreign)).toEqual(before.receipts.filter(row => row.user_id === foreign));
  expect(after.revisions.filter(row => row.user_id === foreign)).toEqual(before.revisions.filter(row => row.user_id === foreign));
  expect(after.limits.filter(row => row.user_id === foreign)).toEqual(before.limits.filter(row => row.user_id === foreign));
}
type Attempt = { request: Update; outcome: "confirmed" | "conflict"; result?: unknown };
async function attach(page: Page, fixture: Fixture, side: keyof typeof sessions) {
  const sid = sessions[side], reads: { query: string; version: number | null }[] = [], attempts: Attempt[] = [], unexpected: string[] = [], errors: string[] = [];
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
        if (url.searchParams.size && (url.searchParams.size !== 1 || id !== fixture.initial.id)) { unexpected.push("UNKNOWN_QUERY"); await route.abort(); return; }
        const snapshot = await fixture.gateway("read.knowledge", owner, sid).snapshot();
        const own = snapshot.pages.find(value => value.id === fixture.initial.id);
        expect(own).toBeDefined(); reads.push({ query: url.search, version: own!.version });
        await json(id ? product.leituraPagina(snapshot, id) : product.conhecimentoDTO(snapshot)); return;
      }
      if (url.search || request.headers.get("Origin") !== origin || !request.headers.get("Content-Type")?.startsWith("application/json")) { unexpected.push("INVALID_WRITE_CHANNEL"); await route.abort(); return; }
      const body = await request.text();
      if (Buffer.byteLength(body) > 65_536) { unexpected.push("UNBOUNDED_BODY"); await route.abort(); return; }
      const decoded = product.decodeKnowledgeCommand(JSON.parse(body));
      if (decoded.command !== "knowledge.page.update" || decoded.input.id !== fixture.initial.id) { unexpected.push("UNEXPECTED_COMMAND"); await route.abort(); return; }
      try {
        const result = await fixture.command(decoded, owner, sid); attempts.push({ request: decoded, outcome: "confirmed", result }); await json({ ok: true, result });
      } catch (error) {
        if (error instanceof product.ErroDeDominio && error.code === "CONFLICT") {
          attempts.push({ request: decoded, outcome: "conflict" }); await json({ code: error.code, message: error.message }, 409); return;
        }
        unexpected.push("UNEXPECTED_WRITE_FAILURE"); await route.abort();
      }
      return;
    }
    if (request.method === "GET" && browserRequest.isNavigationRequest() && url.pathname === "/conhecimento" && url.searchParams.size === 1 && url.searchParams.get("note") === fixture.initial.id) {
      await route.fulfill({ status: 200, contentType: "text/html", body: '<html lang="pt-BR"><body><div id="issue28-knowledge-sql"></div></body></html>' }); return;
    }
    unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  return { side, sid, reads, attempts, unexpected, errors };
}
type Trace = Awaited<ReturnType<typeof attach>>;
type Settlement = { command: string; clientId: string; status: "confirmed" | "rejected"; entityId: string | null };
async function journal(page: Page) {
  return page.evaluate(userId => {
    const base = `segundo-cerebro:commands:v1:${userId}:`;
    const raw = localStorage.getItem(base + "epoch"), gate = raw ? JSON.parse(raw) : null;
    const settledRaw = localStorage.getItem(base + "settled"), settled = settledRaw ? JSON.parse(settledRaw) : null;
    if (gate && (gate.version !== 1 || gate.userId !== userId || typeof gate.epoch !== "string")) throw new Error("Invalid own journal gate.");
    if (settled && (settled.version !== 1 || settled.userId !== userId || settled.epoch !== gate?.epoch || !Array.isArray(settled.items))) throw new Error("Invalid own journal settlements.");
    const settlements = (settled?.items ?? []).map((item: { version: number; userId: string; epoch: string; command: string; clientId: string; status: string; entityId: string | null }) => {
      if (item.version !== 1 || item.userId !== userId || item.epoch !== gate?.epoch || item.command !== "knowledge.page.update" || typeof item.clientId !== "string" || !["confirmed", "rejected"].includes(item.status) || !(item.entityId === null || typeof item.entityId === "string")) throw new Error("Invalid bounded journal settlement.");
      return { command: item.command, clientId: item.clientId, status: item.status as "confirmed" | "rejected", entityId: item.entityId };
    });
    return { epoch: gate?.epoch as string | undefined ?? null, entries: Object.keys(localStorage).filter(key => key.startsWith(base + "entry:")).length, settlements };
  }, owner);
}
async function mount(page: Page) {
  await page.addScriptTag({ content: browserBundle });
  await page.evaluate(userId => (globalThis as unknown as { __startIssue28KnowledgeSql(userId: string): void }).__startIssue28KnowledgeSql(userId), owner);
  await expect(page.locator("main")).toHaveAttribute("data-application-mode", "connected");
  await expect(page.getByRole("textbox", { name: "Conteúdo da página", exact: true })).toBeVisible();
  await expect.poll(async () => (await journal(page)).epoch).not.toBeNull();
}
async function contexts(browser: Browser, fixture: Fixture) {
  const first = await browser.newContext({ timezoneId: "UTC" });
  let second: Awaited<ReturnType<Browser["newContext"]>> | undefined;
  try {
    second = await browser.newContext({ timezoneId: "UTC" });
    const A = await first.newPage(), B = await second.newPage();
    const traces = { A: await attach(A, fixture, "A"), B: await attach(B, fixture, "B") };
    await A.goto(`${origin}/conhecimento?note=${fixture.initial.id}`); await mount(A);
    await B.goto(`${origin}/conhecimento?note=${fixture.initial.id}`); await mount(B);
    const aJournal = await journal(A), bJournal = await journal(B);
    expect(aJournal.entries).toBe(0); expect(bJournal.entries).toBe(0); expect(aJournal.settlements).toEqual([]); expect(bJournal.settlements).toEqual([]);
    expect(aJournal.epoch).not.toBe(bJournal.epoch); expect(traces.A.sid).not.toBe(traces.B.sid);
    return { A, B, traces, epochs: { A: aJournal.epoch, B: bJournal.epoch }, close: async () => { try { await second!.close(); } finally { await first.close(); } } };
  } catch (error) { await second?.close(); await first.close(); throw error; }
}
async function expectPage(page: Page, title: string, text: string) {
  await expect(page.getByLabel("Título da página", { exact: true })).toHaveValue(title);
  await expect(page.getByRole("textbox", { name: "Conteúdo da página", exact: true })).toHaveText(text);
}
async function edit(page: Page, title: string, text: string) {
  await page.getByLabel("Título da página", { exact: true }).fill(title);
  await page.getByRole("textbox", { name: "Conteúdo da página", exact: true }).fill(text);
}
function attempt(trace: Trace, index: number, expectedVersion: number, title: string, text: string, outcome: Attempt["outcome"]) {
  const value = trace.attempts[index]; expect(value).toBeDefined();
  expect(value!.outcome).toBe(outcome);
  expect(value!.request.input).toEqual({ id: value!.request.input.id, title, document: documentOf(text), expected_version: expectedVersion, notebook_id: value!.request.input.notebook_id, parent_id: null, client_id: value!.request.input.client_id });
  expect(value!.request.input.client_id).toMatch(/^[0-9a-f-]{36}$/i); return value!;
}

for (const choice of ["saved", "draft"] as const) test(choice === "saved"
  ? "conflito SQL entre duas sessões conserva a versão salva e a próxima edição usa sua versão real"
  : "conflito SQL entre duas sessões conserva o rascunho escolhido sobre a versão atual", async ({ browser }) => {
  test.setTimeout(90_000);
  const fixture = await dataFixture();
  let screens: Awaited<ReturnType<typeof contexts>> | undefined;
  try {
    const baseline = await ledger(fixture), setupCommits = fixture.commits.length;
    screens = await contexts(browser, fixture);
    const { A, B, traces, epochs } = screens;
    await expectPage(A, initialTitle, ""); await expectPage(B, initialTitle, "");
    expect(traces.A.reads[0]?.version).toBe(1); expect(traces.B.reads[0]?.version).toBe(1);
    await edit(A, aTitle, aText); await edit(B, bTitle, bText);
    await expectPage(A, aTitle, aText); await expectPage(B, bTitle, bText);
    await B.getByRole("button", { name: "Salvar página", exact: true }).click();
    await expect(B.getByText("Página salva.", { exact: true })).toBeVisible();
    await expect(B.getByRole("button", { name: "Salvar página", exact: true })).toBeDisabled();
    expect(traces.B.attempts).toHaveLength(1);
    const bAttempt = attempt(traces.B, 0, 1, bTitle, bText, "confirmed");
    const v2 = { ...fixture.initial, title: bTitle, normalized_title: "versao da sessao b", document: documentOf(bText), content_text: bText, version: 2 };
    expect(await storedPage(fixture)).toEqual(v2); expect(bAttempt.result).toEqual(v2);
    const afterB = await ledger(fixture);
    expectSingleUpdate(baseline, afterB, fixture.initial, v2, bAttempt.request.input.client_id);
    expect(fixture.commits).toHaveLength(setupCommits + 1);
    expect(fixture.commits.at(-1)).toMatchObject({ userId: owner, sessionId: sessions.B, operation: "knowledge.page.update", reply: { status: "committed", result: v2 } });
    await expectPage(A, aTitle, aText); // B's save cannot silently adopt over A's draft.
    await A.getByRole("button", { name: "Salvar página", exact: true }).click();
    const conflict = A.getByRole("region", { name: "Conflito de edição", exact: true });
    await expect(conflict.getByRole("heading", { name: "Há uma versão mais recente", exact: true })).toBeVisible();
    await expectPage(A, aTitle, aText);
    await expect(conflict).toContainText(`A versão salva tem o título “${bTitle}”`);
    await conflict.getByText("Ver o texto salvo", { exact: true }).click();
    await expect(conflict.locator(".knowledge-copy")).toHaveText(bText);
    await expect(conflict.getByRole("button", { name: "Usar a versão salva", exact: true })).toBeEnabled();
    await expect(conflict.getByRole("button", { name: "Salvar meu rascunho sobre a atual", exact: true })).toBeEnabled();
    await expect(A.getByRole("button", { name: "Confirmar o mesmo envio", exact: true })).toHaveCount(0);
    expect(traces.A.attempts).toHaveLength(1);
    const stale = attempt(traces.A, 0, 1, aTitle, aText, "conflict");
    expect(traces.A.reads.some(read => read.query === `?page=${fixture.initial.id}` && read.version === 2)).toBe(true);
    expect(await ledger(fixture)).toEqual(afterB); expect(fixture.commits).toHaveLength(setupCommits + 1);
    expect(afterB.receipts.some(row => row.user_id === owner && row.command === "knowledge.page.update" && row.client_id === stale.request.input.client_id)).toBe(false);
    const rejected: Settlement = { command: "knowledge.page.update", clientId: stale.request.input.client_id, status: "rejected", entityId: null };
    const confirmedB: Settlement = { command: "knowledge.page.update", clientId: bAttempt.request.input.client_id, status: "confirmed", entityId: fixture.initial.id };
    await expect.poll(() => journal(A)).toEqual({ epoch: epochs.A, entries: 0, settlements: [rejected] });
    await expect.poll(() => journal(B)).toEqual({ epoch: epochs.B, entries: 0, settlements: [confirmedB] });

    if (choice === "saved") {
      await conflict.getByRole("button", { name: "Usar a versão salva", exact: true }).click();
      await expect(conflict).toHaveCount(0);
      await expectPage(A, bTitle, bText);
      await expect(A.locator(".knowledge-editor-heading").getByRole("status")).toHaveText("Salva");
      await expect(A.getByRole("button", { name: "Salvar página", exact: true })).toBeDisabled();
      await A.getByLabel("Título da página", { exact: true }).focus(); await A.getByLabel("Título da página", { exact: true }).press("Tab");
      await expectPage(A, bTitle, bText);
      expect(traces.A.attempts).toHaveLength(1); expect(await ledger(fixture)).toEqual(afterB);
      expect(fixture.commits).toHaveLength(setupCommits + 1);
      await expect.poll(() => journal(A)).toEqual({ epoch: epochs.A, entries: 0, settlements: [rejected] });
      // No refresh/remount/snapshot patch: the next genuine edit must use v2.
      await edit(A, continuedTitle, continuedText);
    }
    else await conflict.getByRole("button", { name: "Salvar meu rascunho sobre a atual", exact: true }).click();
    if (choice === "saved") await A.getByRole("button", { name: "Salvar página", exact: true }).click();
    await expect(A.getByText("Página salva.", { exact: true })).toBeVisible();
    await expect(conflict).toHaveCount(0);
    await expect(A.getByRole("button", { name: "Salvar página", exact: true })).toBeDisabled();
    expect(traces.A.attempts).toHaveLength(2);
    const finalTitle = choice === "saved" ? continuedTitle : aTitle, finalText = choice === "saved" ? continuedText : aText;
    const aAttempt = attempt(traces.A, 1, 2, finalTitle, finalText, "confirmed");
    expect(new Set([stale.request.input.client_id, bAttempt.request.input.client_id, aAttempt.request.input.client_id]).size).toBe(3);
    const v3 = { ...v2, title: finalTitle, normalized_title: choice === "saved" ? "continuacao apos adotar b" : "rascunho da sessao a", document: documentOf(finalText), content_text: finalText, version: 3 };
    expect(await storedPage(fixture)).toEqual(v3); expect(aAttempt.result).toEqual(v3);
    const afterA = await ledger(fixture);
    expectSingleUpdate(afterB, afterA, v2, v3, aAttempt.request.input.client_id);
    expect(afterA.events).toHaveLength(baseline.events.length + 2); expect(afterA.receipts).toHaveLength(baseline.receipts.length + 2);
    expect(afterA.receipts.some(row => row.user_id === owner && row.command === "knowledge.page.update" && row.client_id === stale.request.input.client_id)).toBe(false);
    expect(fixture.commits).toHaveLength(setupCommits + 2);
    expect(fixture.commits.at(-1)).toMatchObject({ userId: owner, sessionId: sessions.A, operation: "knowledge.page.update", reply: { status: "committed", result: v3 } });
    const confirmedA: Settlement = { command: "knowledge.page.update", clientId: aAttempt.request.input.client_id, status: "confirmed", entityId: fixture.initial.id };
    await expect.poll(() => journal(A)).toEqual({ epoch: epochs.A, entries: 0, settlements: [rejected, confirmedA] });
    await expect.poll(() => journal(B)).toEqual({ epoch: epochs.B, entries: 0, settlements: [confirmedB] });
    await expectPage(A, finalTitle, finalText);
    // Reload only AFTER the explicit choice and its ledger/version oracles.
    for (const side of ["A", "B"] as const) {
      const screen = side === "A" ? A : B, trace = traces[side], readsBefore = trace.reads.length;
      await screen.reload(); await mount(screen); await expectPage(screen, finalTitle, finalText);
      expect(trace.reads.length).toBeGreaterThan(readsBefore); expect(trace.reads.at(-1)?.version).toBe(3);
      await expect(screen.locator("main")).not.toContainText(/FOREIGN_CONFLICT_(BOOK|PAGE)_SENTINEL/);
      expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
    }
    expect(await ledger(fixture)).toEqual(afterA); expect(fixture.commits).toHaveLength(setupCommits + 2);
  } finally { try { await screens?.close(); } finally { await fixture.db.close(); } }
});
