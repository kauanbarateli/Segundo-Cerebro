/** GUI/client/journal + original Argon2 Worker/WebCrypto -> bound Core/Gateway
 * -> canonical disposable SQL. Auth/HTTP/Next/worker URL/CSS/download/file picker
 * are explicit seams. Secrets and kits remain RAM-only, including failures.
 * No SDK/Next/CSP/hosted/hardware/backup or whole-heap-erasure claim.
 */
import assert from "node:assert/strict";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import type { VaultOperationName, VaultRpc } from "../../src/adapters/db/vault-gateway";
import type { VaultInput } from "../../src/core/cofre/types";
import type { VaultPrivateApi, VaultRamPacket } from "./fixtures/issue31-vault-browser";

type Product = typeof import("./fixtures/issue31-vault-sql.entry");
const origin = "https://issue31-vault-sql.test", workerPath = "/vault-argon2-worker.js";
const owner = "63000000-0000-4000-8000-000000000001", firstSid = "63000000-0000-4000-8000-000000000002", secondSid = "63000000-0000-4000-8000-000000000005";
const foreign = "63000000-0000-4000-8000-000000000003", foreignSid = "63000000-0000-4000-8000-000000000004";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const cssFiles = ["src/components/ui/button.css", "src/components/ui/card.css", "src/components/ui/field.css", "src/components/ui/dialog.css", "src/components/ui/toast.css", "src/components/features/cofre/vault.css"];
let product: Product, browserCode: string, workerCode: string, styles: string;
let workerProvenance: { originalSha256: string; transformedSha256: string; expressionOnly: boolean; workerSha256: string };
test.use({ trace: "off", video: "off", screenshot: "off", acceptDownloads: false, timezoneId: "UTC" });
test.describe.configure({ retries: 0, mode: "default" });

export async function loadVaultProduct(): Promise<Product> {
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/issue31-vault-sql.entry.ts"), platform: "node", tsconfig: false,
    resolve: { conditionNames: ["react-server", "node", "import", "default"] } });
  try {
    const { output } = await build.generate({ format: "es", codeSplitting: false });
    assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk");
    assert.deepEqual(chunk.imports, []); assert.deepEqual(chunk.dynamicImports, []);
    const actual = await import("data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64")) as Product;
    assert.deepEqual(Object.keys(actual).sort(), ["createVaultGateway", "decodeVaultInput", "executeVaultCommand"]);
    return actual;
  } finally { await build.close(); }
}
export async function buildVaultBrowser() {
  const entry = resolve("tests/e2e/fixtures/issue31-vault-browser.tsx").replaceAll("\\", "/"), css = new Set<string>();
  const argonPath = resolve("src/adapters/crypto/argon2.ts").replaceAll("\\", "/"), original = await readFile(argonPath, "utf8");
  const expression = 'new URL("./argon2.worker.ts", import.meta.url)', substituted = 'new URL("' + workerPath + '", globalThis.location.origin)';
  assert.equal(original.split(expression).length, 2);
  const transformed = original.replace(expression, substituted); assert.equal(transformed.replace(substituted, expression), original);
  let transformations = 0;
  const build = await rolldown({ input: entry, platform: "browser", tsconfig: false,
    resolve: { alias: { "next/navigation": entry, "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "vault-explicit-worker-url-css-next", transform(code, id) {
      if (id.replaceAll("\\", "/") === argonPath) { assert.equal(code, original); transformations++; return { code: transformed }; }
    }, resolveId(source, importer) {
      if (source.endsWith(".css")) {
        assert.ok(importer && source.startsWith(".")); const path = resolve(dirname(importer), source), within = relative(resolve("src"), path);
        assert.ok(!within.startsWith("..") && !within.includes(":")); css.add(path); return "\0vault-css";
      }
      if (source === "next/link") return "\0vault-next-link";
    }, load(id) {
      if (id === "\0vault-css") return "export {};";
      if (id === "\0vault-next-link") return 'export default function(){throw new Error("VAULT_LINK_REFUSED")}';
    } }],
  });
  let code: string;
  try {
    const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "Issue31Vault" });
    assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.deepEqual(chunk.dynamicImports, []);
    assert.ok(!/\bimport\s*\(/.test(chunk.code)); code = chunk.code;
  } finally { await build.close(); }
  assert.equal(transformations, 1); assert.deepEqual([...css].sort(), cssFiles.map(path => resolve(path)).sort());
  const workerBuild = await rolldown({ input: resolve("src/adapters/crypto/argon2.worker.ts"), platform: "browser", tsconfig: false });
  let worker: string;
  try {
    const { output } = await workerBuild.generate({ format: "es", codeSplitting: false }); assert.equal(output.length, 1);
    const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.deepEqual(chunk.dynamicImports, []);
    assert.ok(!/\bimport\s*\(/.test(chunk.code)); worker = chunk.code;
  } finally { await workerBuild.close(); }
  const globalPath = resolve("src/app/globals.css"), font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2");
  const cssText = (await postcss([tailwind()]).process(await readFile(globalPath, "utf8"), { from: globalPath })).css + "\n" + (await Promise.all(cssFiles.map(path => readFile(path, "utf8")))).join("\n") +
    "\n@font-face{font-family:Issue31Geist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:Issue31Geist}";
  assert.ok(!/@import\s/.test(cssText)); for (const match of cssText.matchAll(/url\(([^)]*)\)/g)) assert.match(match[1]!.replaceAll(/["']/g, "").trim(), /^data:/);
  return { code, worker, css: cssText, provenance: { originalSha256: digest(original), transformedSha256: digest(transformed), expressionOnly: transformed.replace(substituted, expression) === original, workerSha256: digest(worker) } };
}
test.beforeAll(async () => {
  if (process.platform !== "linux") throw new Error("Vault browser execution requires Linux CI; Windows QA runs no Chromium.");
  product = await loadVaultProduct(); const built = await buildVaultBrowser(); browserCode = built.code; workerCode = built.worker; styles = built.css; workerProvenance = built.provenance;
});

const ledgerSql = {
  keys: "select to_jsonb(t) as row from public.vault_master_keys t order by user_id",
  items: "select to_jsonb(t) as row from public.vault_items t order by id",
  events: "select to_jsonb(t) as row from public.domain_events t order by id",
  receipts: "select to_jsonb(t) as row from app_private.command_receipts t order by user_id,command,client_id",
  revisions: "select to_jsonb(t) as row from app_private.vault_revisions t order by user_id",
  limits: "select to_jsonb(t) as row from app_private.rate_limits t order by scope,subject_hash",
  users: "select to_jsonb(t) as row from auth.users t order by id", sessions: "select to_jsonb(t) as row from auth.sessions t order by id",
};
type Row = Record<string, unknown>;
export async function createVaultSqlFixture(p: Product) {
  const db = await createLocalCanonicalSql();
  try {
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','vault-gui-owner@example.invalid'),($2,'authenticated','authenticated','vault-gui-foreign@example.invalid')", [owner, foreign]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$2),($4,$5)", [firstSid, owner, secondSid, foreignSid, foreign]);
    assert.deepEqual((await db.query("select role from public.user_roles order by user_id")).rows, [{ role: "user" }, { role: "user" }]);
    const now = (await db.query<{ stamp: string }>("select to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as stamp")).rows[0]!.stamp;
    assert.ok(Number.isFinite(Date.parse(now))); let sequence = 20;
    const wire: unknown[] = [], calls: { name: string; operation: VaultOperationName; actor: string; status: string | null }[] = [];
    const signatures = { vault_snapshot: "select public.vault_snapshot($1::uuid,$2::uuid,$3::text) as data", vault_receipt: "select public.vault_receipt($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", vault_commit: "select public.vault_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data" };
    function gateway(operation: VaultOperationName, sid = firstSid, actor = owner) {
      const rpc: VaultRpc = async (name, args) => {
        assert.equal(args.p_user, actor); assert.equal(args.p_session, sid); assert.equal(args.p_operation, operation);
        assert.deepEqual(Object.keys(args).sort(), ["p_user", "p_session", "p_operation", ...(name === "vault_snapshot" ? [] : ["p_request"])].sort());
        assert.ok(calls.length < 200); wire.push(structuredClone({ name, args }));
        try {
          const rows = await db.transaction(async tx => { await tx.exec("set local role service_role"); return tx.query<{ data: unknown }>(signatures[name], [actor, sid, operation, ...(name === "vault_snapshot" ? [] : [JSON.stringify(args.p_request)])]); });
          assert.equal(rows.rows.length, 1); calls.push({ name, operation, actor, status: null }); return { data: rows.rows[0]!.data, error: null };
        } catch (error) { const code = (error as { code?: unknown }).code; if (typeof code !== "string") throw error; calls.push({ name, operation, actor, status: code }); return { data: null, error: { code } }; }
      };
      return p.createVaultGateway(actor, sid, operation, rpc);
    }
    async function command(value: unknown, sid = firstSid) { const request = p.decodeVaultInput(value); return p.executeVaultCommand(gateway(request.command, sid), { clock: { now: () => now }, ids: { next: () => "63000000-0000-4000-8000-" + String(sequence++).padStart(12, "0") } }, { user_id: owner, canal: "web" }, request); }
    async function ledger() { const rows = {} as Record<keyof typeof ledgerSql, Row[]>; for (const [key, sql] of Object.entries(ledgerSql)) rows[key as keyof typeof rows] = (await db.query<{ row: Row }>(sql)).rows.map(value => value.row); return rows; }
    return { db, now, wire, calls, gateway, command, ledger };
  } catch (error) { await db.close(); throw error; }
}
type Fixture = Awaited<ReturnType<typeof createVaultSqlFixture>>;
type Ledger = Awaited<ReturnType<Fixture["ledger"]>>;
type Trace = { writes: { request: VaultInput; result: { id: string; revision: string } }[]; reads: number; workers: number; unexpected: number; errors: number; publicBodies: unknown[] };
const privateContexts = new Set<BrowserContext>();
let privateJourneyRunning = false;
async function privateJourney(run: () => Promise<void>) {
  if (privateJourneyRunning || privateContexts.size) throw new Error("VAULT_PRIVATE_JOURNEY_REFUSED");
  // Playwright's default error-context ariaSnapshot is independent of the
  // trace/video/screenshot settings above. Disable only its DOM copy while
  // secrets may exist, and restore the worker environment after all contexts
  // have closed. A failed close retains this guard and refuses another case.
  const previous = process.env.PLAYWRIGHT_NO_COPY_PROMPT;
  process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1"; privateJourneyRunning = true;
  try { await run(); }
  finally {
    privateJourneyRunning = false;
    if (privateContexts.size) { process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1"; throw new Error("VAULT_CONTEXT_CLEANUP_UNCONFIRMED"); }
    if (previous === undefined) delete process.env.PLAYWRIGHT_NO_COPY_PROMPT; else process.env.PLAYWRIGHT_NO_COPY_PROMPT = previous;
  }
}
async function closeContext(context: BrowserContext) { await context.close(); privateContexts.delete(context); }
async function closeResources(f: Fixture, pages: Page[], contexts: BrowserContext[]) {
  await Promise.allSettled(pages.map(disposePage));
  const results = await Promise.allSettled(contexts.map(closeContext));
  const database = await Promise.allSettled([f.db.close()]);
  if (results.some(result => result.status === "rejected") || database[0]?.status !== "fulfilled") throw new Error("VAULT_CONTEXT_CLEANUP_UNCONFIRMED");
}
// Never pass a Locator to expect: Frame.expect embeds a whole-body ariaSnapshot
// on failure even when NO_COPY_PROMPT/trace/video/screenshot are all disabled.
// These native DOM reads return only closed booleans/counts. Refused observations
// remain a distinct sentinel, so they cannot satisfy a negative expectation.
async function observation(read: () => Promise<boolean | number>, expected: boolean | number) {
  await expect.poll(async () => { try { return await read(); } catch { return "VAULT_OBSERVATION_REFUSED"; } }).toBe(expected);
}
async function visible(locator: Locator) {
  await observation(() => locator.evaluateAll(nodes => nodes.length === 1 && nodes[0]!.checkVisibility({ checkVisibilityCSS: true }) && nodes[0]!.getBoundingClientRect().width > 0 && nodes[0]!.getBoundingClientRect().height > 0), true);
}
async function hidden(locator: Locator) {
  await observation(() => locator.evaluateAll(nodes => nodes.length === 0 || nodes.length === 1 && (!nodes[0]!.checkVisibility({ checkVisibilityCSS: true }) || nodes[0]!.getBoundingClientRect().width === 0 || nodes[0]!.getBoundingClientRect().height === 0)), true);
}
async function count(locator: Locator, expected: number) { await observation(() => locator.evaluateAll(nodes => nodes.length), expected); }
async function attribute(locator: Locator, name: string, expected: string) { await observation(() => locator.evaluateAll((nodes, value) => nodes.length === 1 && nodes[0]!.getAttribute(value.name) === value.expected, { name, expected }), true); }
async function contains(locator: Locator, expected: string | RegExp) {
  const value = expected instanceof RegExp ? { text: null, source: expected.source, flags: expected.flags } : { text: expected, source: null, flags: "" };
  await observation(() => locator.evaluateAll((nodes, value) => nodes.length === 1 && (value.text !== null ? (nodes[0]!.textContent ?? "").includes(value.text) : new RegExp(value.source!, value.flags).test(nodes[0]!.textContent ?? "")), value), true);
}
const ram = (page: Page) => page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.kitReady());
async function privatePassword(page: Page, label: string, slot: "master" | "next" | "recovered") { expect(await page.evaluate(([label, slot]) => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.fillPassword(label!, slot as "master" | "next" | "recovered"), [label, slot])).toBe(true); }
async function privateItem(page: Page, modified = false) { expect(await page.evaluate(value => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.fillItem(value), modified)).toBe(true); }
async function privateKit(page: Page, mode: "valid" | "corrupt" = "valid") { expect(await page.evaluate(value => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.loadKit(value), mode)).toBe(true); }
async function privateStorage(page: Page) { expect(await page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.storageClean())).toBe(true); }
async function attach(context: BrowserContext, f: Fixture, sid: string) {
  const trace: Trace = { writes: [], reads: 0, workers: 0, unexpected: 0, errors: 0, publicBodies: [] };
  context.on("page", page => { page.on("pageerror", () => { trace.errors++; }); });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { trace.unexpected++; await route.abort(); return; }
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }, body: JSON.stringify(body) });
    if (url.pathname === workerPath && request.method() === "GET" && !url.search) { trace.workers++; await route.fulfill({ contentType: "application/javascript", body: workerCode }); return; }
    if (url.pathname === "/api/vault" && !url.search && request.headers()["x-expected-user-id"] === owner) {
      try {
        if (request.method() === "GET") { trace.reads++; await json(await f.gateway("read.vault", sid).snapshot()); return; }
        if (request.method() === "POST" && request.headers().origin === origin && request.headers()["content-type"] === "application/json") {
          assert.ok(Buffer.byteLength(request.postData() ?? "") <= 128 * 1024); const decoded = product.decodeVaultInput(request.postDataJSON());
          trace.publicBodies.push(structuredClone(decoded)); const result = await f.command(decoded, sid); trace.writes.push({ request: decoded, result }); await json({ ok: true, result }); return;
        }
      } catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "forbidden") { await json({ code: "FORBIDDEN", message: "Acesso indisponível." }, 403); return; } trace.unexpected++; await route.abort(); return; }
    }
    if (request.method() === "GET" && request.isNavigationRequest() && ["/cofre", "/blank"].includes(url.pathname) && !url.search) { await route.fulfill({ contentType: "text/html", body: '<html lang="pt-BR"><body><div id="issue31-vault"></div></body></html>' }); return; }
    trace.unexpected++; await route.abort();
  });
  return trace;
}
async function contextFor(browser: Browser, f: Fixture, sid: string) {
  const context = await browser.newContext({ acceptDownloads: false, timezoneId: "UTC" });
  privateContexts.add(context);
  try { await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin }); return { context, trace: await attach(context, f, sid) }; }
  catch (error) { await closeContext(context); throw error; }
}
async function start(page: Page, transferred?: VaultRamPacket) {
  await page.goto(origin + "/cofre"); await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: browserCode });
  await page.evaluate(value => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.start(value.userId, value.transferred), { userId: owner, transferred });
  await attribute(page.locator("main"), "data-application-mode", "connected");
}
async function createViaGui(page: Page, f: Fixture, trace: Trace, negative = false) {
  await visible(page.getByRole("heading", { name: "Criar Cofre", exact: true }));
  await privatePassword(page, "Senha mestra", "master"); await privatePassword(page, "Confirmar senha mestra", "master");
  await page.getByRole("checkbox").click(); await page.getByRole("button", { name: "Preparar Cofre e kit", exact: true }).click();
  await visible(page.getByRole("heading", { name: "Guardar e provar o kit de recuperação", exact: true }));
  await page.getByRole("button", { name: "Baixar metade A", exact: true }).click(); await page.getByRole("button", { name: "Baixar metade B", exact: true }).click();
  await expect.poll(() => ram(page)).toEqual({ halves: 2, failed: false });
  if (negative) { const before = await f.ledger(); await privateKit(page, "corrupt"); await page.getByRole("button", { name: "Provar kit e criar Cofre", exact: true }).click(); await contains(page.getByRole("alert"), /kit|metade/i); expect(await f.ledger()).toEqual(before); expect(trace.writes).toHaveLength(0); }
  await privateKit(page); await page.getByRole("button", { name: "Provar kit e criar Cofre", exact: true }).click();
  await visible(page.getByRole("heading", { name: "Cofre desbloqueado", exact: true }));
  await visible(page.getByRole("status").filter({ hasText: "O kit recuperou a chave original byte a byte" }));
}
async function newItem(page: Page) { await page.getByRole("button", { name: "Novo item", exact: true }).click(); await privateItem(page); await page.getByRole("button", { name: "Salvar item cifrado", exact: true }).click(); await hidden(page.getByRole("dialog")); }
async function unlocked(page: Page, slot: "master" | "next" | "recovered" = "master") { await privatePassword(page, "Senha mestra", slot); await page.getByRole("button", { name: "Desbloquear Cofre", exact: true }).click(); await visible(page.getByRole("heading", { name: "Cofre desbloqueado", exact: true })); }
async function serverProof(f: Fixture, traces: Trace[], markers: string[], baseline: Ledger) {
  const after = await f.ledger(), serialized = JSON.stringify({ wire: f.wire, ledger: after, bodies: traces.flatMap(trace => trace.publicBodies) });
  expect(markers.filter(Boolean).every(marker => !serialized.includes(marker))).toBe(true);
  const writes = traces.flatMap(trace => trace.writes), freshEvents = after.events.filter(row => !baseline.events.some(old => old.id === row.id));
  expect(freshEvents).toHaveLength(writes.length); expect(after.receipts.filter(row => String(row.command).startsWith("vault."))).toHaveLength(writes.length);
  for (const event of freshEvents) { expect(event.user_id === owner && event.entity_type === "vault_metadata" && event.canal === "web" && event.before === null).toBe(true); expect(Object.keys(event.after as Row).sort()).toEqual(["id", "user_id", "operation", "version", "occurred_at"].sort()); }
  for (const write of writes) { const receipt = after.receipts.filter(row => row.user_id === owner && row.command === write.request.command && row.client_id === write.request.input.client_id); expect(receipt).toHaveLength(1); expect(receipt[0]!.result).toEqual(write.result); expect(Object.keys(receipt[0]!.request as Row)).toEqual(["digest"]); }
  expect(after.users).toEqual(baseline.users); expect(after.sessions).toEqual(baseline.sessions);
  const saved = await f.ledger(); await expect(f.gateway("read.vault", foreignSid).snapshot()).rejects.toMatchObject({ code: "forbidden" }); expect(f.calls.at(-1)?.status).toBe("42501");
  expect(await f.gateway("read.vault", foreignSid, foreign).snapshot()).toEqual({ revision: "0", header: null, items: [] }); expect(await f.ledger()).toEqual(saved);
  for (const trace of traces) { expect(trace.unexpected).toBe(0); expect(trace.errors).toBe(0); expect(trace.workers).toBeGreaterThan(0); }
  expect(workerProvenance.expressionOnly).toBe(true);
}

async function collectedMarkers(page: Page) { return page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.markers()); }
async function disposePage(page: Page) { if (!page.isClosed()) await page.evaluate(() => { const api = (globalThis as unknown as { __issue31Vault?: VaultPrivateApi }).__issue31Vault; api?.dispose(); }).catch(() => undefined); }
async function exportProof(page: Page) {
  const proof = await page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.probe());
  expect(proof.imports).toBeGreaterThanOrEqual(3); expect(proof.rejectedExports).toBe(proof.imports); expect(proof.extractableKeys).toBe(0); expect(proof.unexpected).toBe(0);
}

test("Cofre SQL gera/prova kit em RAM, cifra CRUD e recupera kit antigo em contexto limpo", async ({ browser }) => privateJourney(async () => {
  test.setTimeout(180_000);
  const f = await createVaultSqlFixture(product), contexts: BrowserContext[] = [], pages: Page[] = [], markers: string[] = [];
  let transferred: VaultRamPacket | undefined;
  try {
    const baseline = await f.ledger(), first = await contextFor(browser, f, firstSid); contexts.push(first.context);
    const page = await first.context.newPage(); pages.push(page); await start(page); await createViaGui(page, f, first.trace, true); await newItem(page);
    await page.getByRole("button", { name: "Editar Item RAM da jornada", exact: true }).click(); await privateItem(page, true);
    await page.getByRole("button", { name: "Salvar item cifrado", exact: true }).click(); await hidden(page.getByRole("dialog"));
    await page.getByRole("button", { name: "Excluir Item RAM da jornada", exact: true }).click();
    await page.getByRole("dialog", { name: "Excluir item do Cofre?", exact: true }).getByRole("button", { name: "Mover item para a lixeira", exact: true }).click();
    await hidden(page.getByRole("dialog")); await page.getByRole("button", { name: "Lixeira do Cofre", exact: true }).click();
    await page.getByRole("button", { name: "Restaurar Item RAM da jornada", exact: true }).click(); await page.getByRole("button", { name: "Itens ativos", exact: true }).click();
    const beforeChange = await f.gateway("read.vault").snapshot(); expect(beforeChange.items).toHaveLength(1); expect(beforeChange.items[0]!.version).toBe(2); expect(beforeChange.items[0]!.deleted_at).toBeNull();
    await page.getByRole("button", { name: "Trocar senha mestra", exact: true }).click();
    await privatePassword(page, "Senha mestra atual", "master"); await privatePassword(page, "Nova senha mestra", "next"); await privatePassword(page, "Confirmar senha mestra", "next");
    await page.getByRole("button", { name: "Salvar nova proteção", exact: true }).click();
    await visible(page.getByRole("heading", { name: "Cofre bloqueado", exact: true }));
    await visible(page.getByRole("status").filter({ hasText: "O kit antigo continua válido" }));
    const afterChange = await f.gateway("read.vault").snapshot(); expect(afterChange.items).toEqual(beforeChange.items);
    expect(afterChange.header!.master).not.toEqual(beforeChange.header!.master); expect(afterChange.header!.recovery).toEqual(beforeChange.header!.recovery);
    await exportProof(page); await privateStorage(page); markers.push(...await collectedMarkers(page));
    transferred = await page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.packet());
    expect(Object.keys(transferred).sort()).toEqual(["fieldDigests", "kit"]); expect(Object.keys(transferred.kit).sort()).toEqual(["a", "b"]);
    expect(Object.keys(transferred.fieldDigests).sort()).toEqual(["title", "username", "password", "url", "note"].sort());
    expect(Object.values(transferred.fieldDigests).every(value => /^[a-f0-9]{64}$/.test(value))).toBe(true);
    await disposePage(page); await closeContext(first.context); expect(page.isClosed()).toBe(true);

    const clean = await contextFor(browser, f, secondSid); contexts.push(clean.context); const recovered = await clean.context.newPage(); pages.push(recovered);
    await recovered.goto(origin + "/cofre"); expect(await recovered.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0)).toBe(true); expect(await clean.context.cookies()).toEqual([]);
    await start(recovered, transferred); await visible(recovered.getByRole("heading", { name: "Cofre bloqueado", exact: true }));
    await recovered.getByRole("button", { name: "Usar kit de recuperação", exact: true }).click(); await privateKit(recovered);
    await privatePassword(recovered, "Nova senha mestra", "recovered"); await privatePassword(recovered, "Confirmar senha mestra", "recovered");
    await recovered.getByRole("button", { name: "Recuperar e trocar senha", exact: true }).click();
    await visible(recovered.getByRole("heading", { name: "Cofre desbloqueado", exact: true }));
    await visible(recovered.getByRole("status").filter({ hasText: "O kit antigo continua válido" }));
    await recovered.getByRole("button", { name: "Editar Item RAM da jornada", exact: true }).click();
    expect(await recovered.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.fieldsMatch())).toBe(true); await recovered.keyboard.press("Escape");
    const afterRecovery = await f.gateway("read.vault", secondSid).snapshot(); expect(afterRecovery.items).toEqual(beforeChange.items); expect(afterRecovery.header!.recovery).toEqual(beforeChange.header!.recovery); expect(afterRecovery.header!.master).not.toEqual(afterChange.header!.master);
    await exportProof(recovered); await privateStorage(recovered); markers.push(...await collectedMarkers(recovered));
    expect([...first.trace.writes, ...clean.trace.writes].map(write => write.request.command)).toEqual(["vault.create", "vault.item.create", "vault.item.update", "vault.item.delete", "vault.item.restore", "vault.master.rewrap", "vault.master.rewrap"]);
    const catalogue = (await f.db.query<{ rls: boolean; policies: number; jwt_select: boolean }>("select c.relrowsecurity as rls,(select count(*)::int from pg_policy p where p.polrelid=c.oid) as policies,has_table_privilege('authenticated',c.oid,'SELECT') as jwt_select from pg_class c where c.oid='public.vault_master_keys'::regclass")).rows;
    expect(catalogue).toEqual([{ rls: true, policies: 0, jwt_select: false }]);
    const beforeDenied = await f.ledger(); for (const role of ["authenticated", "anon"] as const) await expect(f.db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.query("select payload from public.vault_master_keys"); })).rejects.toMatchObject({ code: "42501" }); expect(await f.ledger()).toEqual(beforeDenied);
    await serverProof(f, [first.trace, clean.trace], markers, baseline);
  } finally { transferred = undefined; markers.length = 0; await closeResources(f, pages, contexts); }
}));

test("Cofre SQL detecta envelope trocado por AAD e preserva item ilegível com diagnóstico", async ({ browser }) => privateJourney(async () => {
  test.setTimeout(180_000);
  const f = await createVaultSqlFixture(product), contexts: BrowserContext[] = [], pages: Page[] = [];
  let markers: string[] = [];
  try {
    const bound = await contextFor(browser, f, firstSid); contexts.push(bound.context); const page = await bound.context.newPage(); pages.push(page);
    const baseline = await f.ledger(); await start(page); await createViaGui(page, f, bound.trace); await newItem(page); await newItem(page);
    const creates = bound.trace.writes.filter(write => write.request.command === "vault.item.create"); expect(creates).toHaveLength(2);
    const target = creates[0]!.result.id, source = creates[1]!.result.id;
    await page.getByRole("button", { name: "Bloquear Cofre", exact: true }).click(); await visible(page.getByRole("heading", { name: "Cofre bloqueado", exact: true }));
    await expect.poll(() => bound.trace.writes.length).toBe(4); const before = await f.ledger(), snapshot = await f.gateway("read.vault").snapshot();
    const old = snapshot.items.find(item => item.id === target)!, donor = snapshot.items.find(item => item.id === source)!;
    // Declared database tampering, not a UI writer or event-emitting API operation.
    await f.db.query("update public.vault_items set payload=jsonb_set(payload,'{envelope}',$1::jsonb) where user_id=$2 and id=$3", [JSON.stringify(donor.envelope), owner, target]);
    const attacked = await f.ledger();
    expect(attacked.items).toEqual(before.items.map(row => row.id === target ? { ...row, payload: { ...(row.payload as Row), envelope: donor.envelope } } : row));
    expect(attacked.revisions).toEqual(before.revisions.map(row => row.user_id === owner ? { ...row, revision: Number(row.revision) + 1 } : row));
    for (const key of ["keys", "events", "receipts", "limits", "users", "sessions"] as const) expect(attacked[key]).toEqual(before[key]);
    // The actual unlock handler performs refresh() before decryption. No fixture
    // refresh/reload or parent state patch can hide a stale reader.
    await unlocked(page);
    const unreadable = page.locator(".vault-item").filter({ has: page.getByText("Item ilegível", { exact: true }) });
    await count(page.locator(".vault-item"), 2); await count(unreadable, 1);
    await count(page.getByRole("button", { name: "Editar Item RAM da jornada", exact: true }), 1);
    await count(unreadable.getByRole("button", { name: /Editar|Copiar/ }), 0);
    await unreadable.getByText("Diagnosticar item ilegível", { exact: true }).click();
    await contains(unreadable.locator("details[open]"), "Item " + target + ", versão " + old.version);
    await contains(unreadable.locator("details[open]"), "O item foi preservado");
    const afterRead = await f.ledger(); expect(afterRead.items).toEqual(attacked.items); expect(afterRead.keys).toEqual(attacked.keys);
    await expect.poll(() => bound.trace.writes.length).toBe(5);
    expect(bound.trace.writes.map(write => write.request.command)).toEqual(["vault.create", "vault.item.create", "vault.item.create", "vault.audit", "vault.audit"]);
    expect(bound.trace.writes.slice(3).map(write => (write.request.input as { operation: string }).operation)).toEqual(["locked", "unlocked"]);
    markers = await collectedMarkers(page); await privateStorage(page); await exportProof(page); await serverProof(f, [bound.trace], markers, baseline);
  } finally { markers.length = 0; await closeResources(f, pages, contexts); }
}));

test("Cofre SQL usa clipboard nativo30s e auto-lock na GUI por cinco minutos/aba oculta", async ({ browser }) => privateJourney(async () => {
  test.setTimeout(180_000);
  const f = await createVaultSqlFixture(product), contexts: BrowserContext[] = [], pages: Page[] = [];
  let other: Page | undefined;
  let markers: string[] = [];
  try {
    const bound = await contextFor(browser, f, firstSid); contexts.push(bound.context); other = await bound.context.newPage(); pages.push(other); const page = await bound.context.newPage(); pages.push(page);
    await page.clock.install({ time: new Date(f.now) });
    // Decide the stimulus before mounting secrets. A non-native result never
    // silently becomes a natural hiding claim or a substitute for clipboard.
    await other.goto(origin + "/blank"); await page.goto(origin + "/cofre"); await page.bringToFront(); await other.bringToFront();
    const nativeHidden = await page.evaluate(() => document.visibilityState === "hidden"); await page.bringToFront();
    const stimulusKind = nativeHidden ? "native" : "controlled";
    test.info().annotations.push({ type: "vault-visibility-stimulus", description: stimulusKind });
    const baseline = await f.ledger();
    await start(page); await createViaGui(page, f, bound.trace); await newItem(page);
    // This fixed target exceeds the 180s test deadline, so it cannot be in the
    // past when received by the browser. It stays below the 5min idle timeout;
    // the copy and Tab interactions below establish the measured timer starts.
    await page.clock.pauseAt(new Date(Date.parse(f.now) + 180_001));
    await page.getByRole("button", { name: "Copiar senha de Item RAM da jornada", exact: true }).click();
    await visible(page.getByRole("status").filter({ hasText: "A área de transferência será limpa em 30 segundos" }));
    expect(await page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.clipboardMatches())).toBe(true);
    await page.clock.runFor(29_999); expect(await page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.clipboardMatches())).toBe(true);
    await page.clock.runFor(1); expect(await page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.clipboardEmpty())).toBe(true);
    await expect.poll(() => bound.trace.writes.length).toBe(3);
    await page.keyboard.press("Tab"); const beforeIdle = await f.ledger();
    await page.clock.runFor(299_999); await visible(page.getByRole("heading", { name: "Cofre desbloqueado", exact: true }));
    await page.clock.runFor(1); await visible(page.getByRole("heading", { name: "Cofre bloqueado", exact: true }));
    await count(page.locator(".vault-item"), 0); await count(page.getByRole("dialog"), 0); expect(await f.ledger()).toEqual(beforeIdle); await privateStorage(page);
    expect(await page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.domClean())).toBe(true);
    await unlocked(page); await page.getByRole("button", { name: "Copiar senha de Item RAM da jornada", exact: true }).click();
    await expect.poll(() => bound.trace.writes.length).toBe(5); const beforeHidden = await f.ledger();
    if (stimulusKind === "native") {
      await other.bringToFront(); expect(await page.evaluate(() => document.visibilityState === "hidden")).toBe(true);
    } else {
      expect(await page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.controlledHidden())).toEqual({ stimulusKind: "controlled", stateObserved: "hidden", eventObserved: true });
    }
    await visible(page.getByRole("heading", { name: "Cofre bloqueado", exact: true })); await count(page.locator(".vault-item"), 0);
    const focused = stimulusKind === "native" ? other : page;
    await expect.poll(() => focused.evaluate(async () => await navigator.clipboard.readText() === "")).toBe(true);
    expect(await f.ledger()).toEqual(beforeHidden); await privateStorage(page); markers = await collectedMarkers(page); await exportProof(page);
    expect(await page.evaluate(() => (globalThis as unknown as { __issue31Vault: VaultPrivateApi }).__issue31Vault.domClean())).toBe(true);
    expect(bound.trace.writes.map(write => write.request.command)).toEqual(["vault.create", "vault.item.create", "vault.audit", "vault.audit", "vault.audit"]);
    expect(bound.trace.writes.slice(2).map(write => (write.request.input as { operation: string }).operation)).toEqual(["copied", "unlocked", "copied"]);
    await serverProof(f, [bound.trace], markers, baseline);
  } finally {
    markers.length = 0; for (const page of pages) await disposePage(page);
    await other?.bringToFront().catch(() => undefined); await other?.evaluate(async () => { await navigator.clipboard.writeText(""); }).catch(() => undefined);
    await closeResources(f, pages, contexts);
  }
}));
