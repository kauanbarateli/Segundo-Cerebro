/** Canonical SQL -> original Settings runtime/SDK -> public HTTP/Auth seam ->
 * original Settings/Shell/providers. Account head presentation, Next nav/image/
 * static asset/dynamic/CSS are seams. No Next, GoTrue, hosted data, avatar,
 * password, visual audit or Windows browser/service acceptance is implied. */
import assert from "node:assert/strict";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import type { AccountSettings, SettingsCommand } from "../../src/core/configuracoes";
import type { AccessPolicy, FeatureKey } from "../../src/core/access/resolve-access";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";
type Product = typeof import("./fixtures/issue34-settings-sql.entry");
export const settingsOwner = "67000000-0000-4000-8000-000000000001", settingsSession = "67000000-0000-4000-8000-000000000002";
const foreign = "67000000-0000-4000-8000-000000000003", foreignSession = "67000000-0000-4000-8000-000000000004";
const origin = "https://issue34-settings-sql.test", api = "https://rishenjoikgmfubmnfiu.supabase.co", uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: origin, supabaseUrl: api, publishableKey: "sb_publishable_SYNTHETIC", secretKey: "sb_secret_SYNTHETIC", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
let product: Product, bundle: string, styles: string;
test.use({ timezoneId: "UTC", colorScheme: "light", trace: "off", video: "off", screenshot: "off" }); test.describe.configure({ retries: 0 });
export async function loadSettingsProduct(): Promise<Product> {
  const modules = new Set<string>();
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/issue34-settings-sql.entry.ts"), platform: "node", tsconfig: false, resolve: { conditionNames: ["react-server", "node", "import", "default"] }, plugins: [{ name: "settings-product-inventory", async moduleParsed(info) {
    assert.equal(await realpath(info.id), info.id); assert.equal(info.dynamicallyImportedIds.length, 0); const path = relative(resolve("."), info.id).replaceAll("\\", "/"); assert.ok(!path.startsWith("..") && !path.includes(":")); modules.add(path);
  } }] });
  try { const { output } = await build.generate({ format: "es", codeSplitting: false }); assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.dynamicImports, []); assert.ok(chunk.imports.every(name => name.startsWith("node:")));
    assert.ok(modules.has("src/adapters/db/settings-runtime.ts") && modules.has("src/core/configuracoes/index.ts") && modules.has("node_modules/@supabase/supabase-js/dist/index.mjs") && modules.has("node_modules/server-only/empty.js"));
    const p = await import("data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64")) as Product;
    assert.deepEqual(Object.keys(p).sort(), ["THEME_INIT_SCRIPT", "applySettings", "createClient", "decodeSettingsCommand", "settingsForRequest", "settingsPreferences", "validAccountSettings"]); return p;
  } finally { await build.close(); }
}
// Explicit controls -> layout -> domain; discovery checks the actual closure.
const cssPaths = ["src/components/ui/brand.css", "src/components/ui/button.css", "src/components/ui/card.css", "src/components/ui/data-display.css", "src/components/ui/dialog.css", "src/components/ui/field.css", "src/components/ui/switch.css", "src/components/ui/toast.css", "src/components/layout/workspace-shell.css", "src/components/layout/command-palette.css", "src/components/layout/connected-command-feedback.css", "src/components/pwa/pwa.css", "src/components/features/configuracoes/settings.css"];
export async function buildSettingsBrowser() {
  const navigation = resolve("tests/e2e/fixtures/issue34-settings-browser.tsx").replaceAll("\\", "/"), discovered = new Set<string>();
  const build = await rolldown({ input: navigation, platform: "browser", tsconfig: false, resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } }, onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "settings-next-css-boundaries", resolveId(source, importer) {
      if (source.endsWith(".css")) { assert.ok(importer && source.startsWith(".")); const path = resolve(dirname(importer), source), within = relative(resolve("src"), path); assert.ok(!within.startsWith("..") && !within.includes(":")); discovered.add(path); return "\0settings-css"; }
      if (source === "next/link") return "\0settings-link"; if (source === "next/dynamic") return "\0settings-dynamic"; if (source === "next/image") return "\0settings-unused-image";
      if (source.endsWith("illustrative-avatar.jpg")) { assert.equal(source, "./illustrative-avatar.jpg"); assert.equal(importer, resolve("src/components/layout/workspace-shell.tsx")); return "\0settings-unused-avatar"; }
    }, load(id) {
      if (id === "\0settings-css") return "export {};";
      if (id === "\0settings-link") return "export { NavigationLink as default } from " + JSON.stringify(navigation) + ";";
      if (id === "\0settings-dynamic") return "import {createElement,lazy,Suspense} from 'react';export default function dynamic(loader,options={}){const Component=lazy(loader);return function Dynamic(props){return createElement(Suspense,{fallback:options.loading?createElement(options.loading):null},createElement(Component,props));};}";
      if (id === "\0settings-unused-image") return "export default function UnusedNextImage(){throw new Error('Connected fixture must not mount illustrative Next Image.')}";
      if (id === "\0settings-unused-avatar") return "export default null;";
    } }] });
  try { const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "Issue34SettingsFixture" }); assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.ok(chunk.dynamicImports.every(name => name === chunk.fileName)); assert.ok(!/\bimport\s*\(/.test(chunk.code)); assert.deepEqual([...discovered].sort(), cssPaths.map(path => resolve(path)).sort());
    const global = resolve("src/app/globals.css"); let css = (await postcss([tailwind()]).process(await readFile(global, "utf8"), { from: global })).css + "\n" + (await Promise.all(cssPaths.map(path => readFile(path, "utf8")))).join("\n");
    const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"); css += "\n@font-face{font-family:Issue34Geist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:Issue34Geist}";
    assert.ok(!/@import\s/.test(css)); for (const match of css.matchAll(/url\(([^)]*)\)/g)) assert.match(match[1]!.replaceAll(/["']/g, "").trim(), /^data:/); return { code: chunk.code, css, modules: Object.keys(chunk.modules) };
  } finally { await build.close(); }
}
test.beforeAll(async () => { if (process.platform !== "linux") throw new Error("Settings browser execution requires Linux CI."); product = await loadSettingsProduct(); const built = await buildSettingsBrowser(); bundle = built.code; styles = built.css; });
type Row = Record<string, unknown>;
const queries = {
  users: "select to_jsonb(t) as row from auth.users t order by id", sessions: "select to_jsonb(t) as row from auth.sessions t order by id", profiles: "select to_jsonb(t) as row from public.profiles t order by user_id", preferences: "select to_jsonb(t) as row from public.user_preferences t order by user_id", modules: "select to_jsonb(t) as row from public.user_modules t order by user_id,module_key", roles: "select to_jsonb(t) as row from public.user_roles t order by user_id", moderation: "select to_jsonb(t) as row from public.user_moderation t order by user_id", entitlements: "select to_jsonb(t) as row from public.user_entitlements t order by user_id,feature_key",
  events: "select to_jsonb(t) as row from public.domain_events t order by id", receipts: "select to_jsonb(t) as row from app_private.command_receipts t order by user_id,command,client_id", limits: "select to_jsonb(t) as row from app_private.rate_limits t order by scope,subject_hash", captureRevision: "select to_jsonb(t) as row from app_private.capture_task_revisions t order by user_id", routineRevision: "select to_jsonb(t) as row from app_private.projects_habits_revisions t order by user_id",
  captures: "select to_jsonb(t) as row from public.captures t order by id", tasks: "select to_jsonb(t) as row from public.tasks t order by id", pages: "select to_jsonb(t) as row from public.knowledge_pages t order by id", projects: "select to_jsonb(t) as row from public.projects t order by id", transactions: "select to_jsonb(t) as row from public.fin_transactions t order by id",
};
type Ledger = Record<keyof typeof queries, Row[]>;
type Event = { id: string; user_id: string; entity_type: string; entity_id: string; action: string; canal: string; occurred_at: string; before: Row | null; after: Row };
export async function createSettingsFixture(p: Product) {
  const db = await createLocalCanonicalSql();
  try {
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','settings-owner@example.invalid'),($2,'authenticated','authenticated','settings-foreign@example.invalid')", [settingsOwner, foreign]); await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)", [settingsSession, settingsOwner, foreignSession, foreign]);
    assert.deepEqual((await db.query("select role from public.user_roles order by user_id")).rows, [{ role: "user" }, { role: "user" }]);
    // Declared initial entitlement seed, mirrored from SQL in presentation.
    await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'calendario',false),($2,'calendario',false)", [settingsOwner, foreign]);
    const sdkCalls: { name: "settings_snapshot" | "settings_commit"; actor: string; session: string; sqlCode: string | null; sqlTimestamp: string | null }[] = [];
    let queue = Promise.resolve(), active = false, closed = false;
    const paired = (actor: string, sid: string) => assert.ok(actor === settingsOwner && sid === settingsSession || actor === foreign && sid === foreignSession);
    async function withSdk<T>(actor: string, sid: string, work: () => Promise<T>): Promise<T> {
      paired(actor, sid); assert.equal(closed, false); const previous = queue; let release!: () => void; queue = new Promise<void>(done => { release = done; }); await previous; assert.equal(active, false); active = true; const original = globalThis.fetch;
      const transport: typeof fetch = async (input, options) => {
        const request = new Request(input, options), url = new URL(request.url); assert.equal(url.origin, api); assert.equal(url.search, ""); assert.equal(url.hash, ""); assert.equal(request.method, "POST"); assert.equal(options?.cache, "no-store"); assert.equal(request.headers.get("apikey"), config.secretKey); assert.equal(request.headers.get("authorization"), "Bearer " + config.secretKey);
        const name = url.pathname === "/rest/v1/rpc/settings_snapshot" ? "settings_snapshot" : url.pathname === "/rest/v1/rpc/settings_commit" ? "settings_commit" : null; assert.ok(name); const body = await request.text(); assert.ok(Buffer.byteLength(body) <= 16384);
        const args: unknown = JSON.parse(body); assert.ok(args && typeof args === "object" && !Array.isArray(args)); assert.deepEqual(Object.keys(args).sort(), (name === "settings_commit" ? ["p_user", "p_session", "p_request"] : ["p_user", "p_session"]).sort()); assert.ok("p_user" in args && "p_session" in args); assert.equal(args.p_user, actor); assert.equal(args.p_session, sid);
        let sqlTimestamp: string | null = null;
        try {
          const data = await db.transaction(async tx => { await tx.exec("set local role service_role"); sqlTimestamp = (await tx.query<{ at: string }>("select to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') as at")).rows[0]!.at;
            const rows = name === "settings_commit" && "p_request" in args ? (await tx.query<{ data: unknown }>("select public.settings_commit($1::uuid,$2::uuid,$3::jsonb) as data", [actor, sid, JSON.stringify(args.p_request)])).rows : (await tx.query<{ data: unknown }>("select public.settings_snapshot($1::uuid,$2::uuid) as data", [actor, sid])).rows; assert.equal(rows.length, 1); return rows[0]!.data;
          }); sdkCalls.push({ name, actor, session: sid, sqlCode: null, sqlTimestamp }); return Response.json(data);
        } catch (error) {
          const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : null;
          if (!code || !["22023", "23514", "23505", "42501", "PT429"].includes(code)) throw new Error("SETTINGS_SQL_UNEXPECTED"); sdkCalls.push({ name, actor, session: sid, sqlCode: code, sqlTimestamp }); return Response.json({ code, message: "Disposable SQL refused this request.", details: null, hint: null }, { status: 400 });
        }
      };
      // Installed SDK/runtime use the closed transport; never delegate network.
      globalThis.fetch = transport;
      try { return await work(); } finally { globalThis.fetch = original; active = false; release(); }
    }
    const identity = (actor: string, sid: string): AuthenticatedIdentity => ({ userId: actor, sessionId: sid, role: "user", mustChangePassword: false, entitlements: { calendario: false } });
    async function load(actor = settingsOwner, sid = settingsSession) { return withSdk(actor, sid, () => p.settingsForRequest(config, identity(actor, sid)).load()); }
    async function command(value: unknown, actor = settingsOwner, sid = settingsSession) { return withSdk(actor, sid, () => p.applySettings(p.settingsForRequest(config, identity(actor, sid)), value)); }
    async function rawCommit(value: unknown, actor = settingsOwner, sid = settingsSession) { return withSdk(actor, sid, async () => {
      const client = p.createClient(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) } });
      return client.rpc("settings_commit", { p_user: actor, p_session: sid, p_request: value });
    }); }
    async function ledger(): Promise<Ledger> { const result = {} as Ledger; for (const [key, sql] of Object.entries(queries)) result[key as keyof Ledger] = (await db.query<{ row: Row }>(sql)).rows.map(row => row.row); return result; }
    async function oracle(actor = settingsOwner): Promise<AccountSettings> {
      const profile = (await db.query<{ display_name: string | null; email: string | null; avatar_file_id: string | null }>("select p.display_name,u.email,p.avatar_file_id from public.profiles p join auth.users u on u.id=p.user_id where p.user_id=$1", [actor])).rows[0]!;
      const preferences = (await db.query<AccountSettings["preferences"]>("select theme,default_calendar_view,values_hidden,meeting_reminders_enabled,meeting_reminder_minutes from public.user_preferences where user_id=$1", [actor])).rows[0]!;
      const modules = (await db.query<AccountSettings["modules"][number]>("select module_key,visible,sort_order from public.user_modules where user_id=$1 order by sort_order,module_key", [actor])).rows; return { user_id: actor, profile, preferences, modules };
    }
    async function policy(actor = settingsOwner): Promise<AccessPolicy> { const data = await load(actor, actor === settingsOwner ? settingsSession : foreignSession); assert.deepEqual(data, await oracle(actor)); const entitlements = (await db.query<{ feature_key: FeatureKey; allowed: boolean }>("select feature_key,allowed from public.user_entitlements where user_id=$1 order by feature_key", [actor])).rows; return { isAdmin: false, entitlements: Object.fromEntries(entitlements.map(row => [row.feature_key, row.allowed])), preferences: p.settingsPreferences(data) }; }
    async function close() { await queue; assert.equal(active, false); closed = true; await db.close(); }
    return { p, db, sdkCalls, load, command, rawCommit, ledger, oracle, policy, close };
  } catch (error) { await db.close(); throw error; }
}
type Fixture = Awaited<ReturnType<typeof createSettingsFixture>>;
type Write = { request: SettingsCommand; result: AccountSettings; before: Ledger; after: Ledger; events: Event[]; sqlTimestamp: string };
async function eventRows(f: Fixture) { return (await f.db.query<Event>("select id,user_id,entity_type,entity_id,action,canal,occurred_at::text,before,after from public.domain_events where user_id=$1 order by id", [settingsOwner])).rows; }
async function attach(page: Page, f: Fixture) {
  const trace = { writes: [] as Write[], reads: 0, documents: 0, agendaQueries: 0, searchQueries: 0, unexpected: [] as string[], errors: [] as string[] }; page.on("pageerror", () => trace.errors.push("BROWSER_ERROR"));
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url()); if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    if (url.pathname === "/api/calendar") trace.agendaQueries++; if (url.pathname === "/api/search") trace.searchQueries++;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" }, body: JSON.stringify(body) });
    if (url.pathname === "/api/settings" && !url.search && req.headers()["x-expected-user-id"] === settingsOwner) {
      try {
        if (req.method() === "GET") { const value = await f.load(); assert.ok(f.p.validAccountSettings(value, settingsOwner)); assert.deepEqual(value, await f.oracle()); trace.reads++; await json(value); return; }
        if (req.method() === "POST" && req.headers().origin === origin && req.headers()["content-type"] === "application/json" && Buffer.byteLength(req.postData() ?? "") <= 16384) {
          const request = f.p.decodeSettingsCommand(req.postDataJSON()); assert.match(request.input.client_id, uuid); const before = await f.ledger(), oldIds = new Set((await eventRows(f)).map(row => row.id)), index = f.sdkCalls.length;
          const result = await f.command(request); assert.deepEqual(result, await f.oracle()); const calls = f.sdkCalls.slice(index); assert.equal(calls.length, 1); const sqlTimestamp = calls[0]!.sqlTimestamp; assert.ok(sqlTimestamp && calls[0]!.name === "settings_commit" && calls[0]!.sqlCode === null);
          trace.writes.push({ request, result, before, after: await f.ledger(), events: (await eventRows(f)).filter(row => !oldIds.has(row.id)), sqlTimestamp }); await json({ ok: true, result }); return;
        }
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : null;
        if (code && ["VALIDATION", "CONFLICT", "forbidden", "unauthenticated", "unavailable"].includes(code)) { await json({ ok: false, code: code.toUpperCase(), message: "Operação de configurações recusada." }, code === "CONFLICT" ? 409 : code === "VALIDATION" ? 400 : 403); return; }
        trace.unexpected.push("UNEXPECTED_BACKEND_FAILURE"); await route.abort(); return;
      }
    }
    if (req.method() === "GET" && req.isNavigationRequest() && url.pathname === "/configuracoes" && !url.search) {
      const value = await f.load(); assert.ok(f.p.validAccountSettings(value, settingsOwner)); assert.deepEqual(value, await f.oracle()); trace.documents++;
      // Declared SSR/accountPresentation seam: freshly read account attribute,
      // never a copied DOM/storage value and never a Next layout claim.
      await route.fulfill({ contentType: "text/html", body: '<html lang="pt-BR" data-account-theme="' + value.preferences.theme + '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff"></head><body><div id="issue34-settings-sql"></div></body></html>' }); return;
    }
    trace.unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  }); return trace;
}
async function mount(page: Page, f: Fixture, reload = false) {
  if (reload) await page.reload(); else await page.goto(origin + "/configuracoes");
  const initialStorage = await page.evaluate(() => localStorage.getItem("segundo-cerebro-theme"));
  await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: f.p.THEME_INIT_SCRIPT });
  const policy = await f.policy(), settings = await f.oracle(); await page.addScriptTag({ content: bundle }); await page.evaluate(({ actor, access, hidden }) => (globalThis as unknown as { __startIssue34SettingsSql(user: string, policy: AccessPolicy, hidden: boolean): void }).__startIssue34SettingsSql(actor, access, hidden), { actor: settingsOwner, access: policy, hidden: settings.preferences.values_hidden });
  await expect(page.locator('[data-application-mode="connected"]')).toBeVisible(); await expect(page.locator('.settings-workspace[data-access="allowed"]')).toBeVisible(); await expect(page.getByLabel("Tema da conta", { exact: true })).toHaveValue(settings.preferences.theme); return { initialStorage };
}
type Trace = Awaited<ReturnType<typeof attach>>;
async function save(page: Page, trace: Trace, label: string, count: number) { await page.getByRole("button", { name: label, exact: true }).click(); await expect.poll(() => trace.writes.length).toBe(count); await expect(page.getByText("Configurações salvas na sua conta.", { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: label, exact: true })).toBeEnabled(); }
async function verify(f: Fixture, traces: Trace[], baseline: Ledger) {
  const writes = traces.flatMap(trace => trace.writes), after = await f.ledger(); expect(after.receipts).toHaveLength(baseline.receipts.length + writes.length); expect(after.events).toHaveLength(baseline.events.length + writes.reduce((sum, write) => sum + write.events.length, 0)); expect(after.events.filter(row => baseline.events.some(old => old.id === row.id))).toEqual(baseline.events);
  for (const write of writes) {
    expect((await f.db.query("select request,result from app_private.command_receipts where user_id=$1 and command=$2 and client_id=$3", [settingsOwner, write.request.command, write.request.input.client_id])).rows).toEqual([{ request: write.request, result: write.result }]);
    const table = write.request.command === "settings.profile.update" ? "profiles" : write.request.command === "settings.preferences.update" ? "preferences" : "modules", entity = table === "profiles" ? "profile" : table === "preferences" ? "preference" : "module_preference";
    const rows = write.request.command === "settings.modules.update" ? write.request.input.modules.map(item => write.after.modules.find(row => row.user_id === settingsOwner && row.module_key === item.module_key)!) : write.after[table].filter(row => row.user_id === settingsOwner);
    expect(write.events).toHaveLength(rows.length);
    for (const row of rows) { const before = write.before[table].find(old => old.user_id === settingsOwner && (table !== "modules" || old.module_key === row.module_key)) ?? null;
      expect(write.events.filter(event => event.entity_type === entity && (table !== "modules" || event.after.module_key === row.module_key))).toEqual([expect.objectContaining({ user_id: settingsOwner, entity_type: entity, entity_id: settingsOwner, action: before ? "updated" : "created", canal: "web", before, after: row })]);
    }
    // SQL owns these timestamps; no synthetic browser clock is imposed.
    for (const event of write.events) expect(new Date(event.occurred_at).toISOString()).toBe(new Date(write.sqlTimestamp).toISOString());
  }
  for (const key of Object.keys(baseline) as (keyof Ledger)[]) {
    if (!["profiles", "preferences", "modules", "events", "receipts", "limits"].includes(key)) expect(after[key]).toEqual(baseline[key]);
    else expect(after[key].filter(row => row.user_id === foreign)).toEqual(baseline[key].filter(row => row.user_id === foreign));
  }
  for (const trace of traces) { expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]); expect(trace.agendaQueries).toBe(0); expect(trace.searchQueries).toBe(0); expect(trace.reads).toBeGreaterThan(0); }
}
async function newSurface(browser: Browser, f: Fixture, contexts: BrowserContext[], width: number) { const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: "light", timezoneId: "UTC" }); contexts.push(context); const page = await context.newPage(), trace = await attach(page, f); return { page, trace, context }; }
const expectedLabels = ["Início", "Capturar", "Tarefas", "Conhecimento", "Drive", "Projetos", "Hábitos", "Financeiro", "Cofre", "Configurações", "Integrações"];
const expectedKeys = ["inicio", "capturar", "tarefas", "conhecimento", "drive", "projetos", "habitos", "financeiro", "cofre", "configuracoes", "integracoes"] as const;

test("tema salvo no desktop chega ao contexto móvel novo pela conta e sobrevive ao recarregar", async ({ browser }) => {
  const f = await createSettingsFixture(product), contexts: BrowserContext[] = [];
  try {
    const baseline = await f.ledger(), desktop = await newSurface(browser, f, contexts, 1280); await mount(desktop.page, f); await desktop.page.getByLabel("Tema da conta", { exact: true }).selectOption("dark"); await save(desktop.page, desktop.trace, "Salvar aparência", 1); expect((await f.oracle()).preferences.theme).toBe("dark"); await expect(desktop.page.locator("html")).toHaveAttribute("data-theme", "dark");
    const mobile = await newSurface(browser, f, contexts, 390), initial = await mount(mobile.page, f); expect(initial.initialStorage).toBeNull(); await expect(mobile.page.locator("html")).toHaveAttribute("data-account-theme", "dark"); await expect(mobile.page.locator("html")).toHaveAttribute("data-theme", "dark"); await expect(mobile.page.getByLabel("Tema da conta", { exact: true })).toHaveValue("dark");
    await mount(desktop.page, f, true); await expect(desktop.page.locator("html")).toHaveAttribute("data-theme", "dark"); await desktop.context.close(); await mount(mobile.page, f, true); await expect(mobile.page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(desktop.trace.writes.map(write => write.request.command)).toEqual(["settings.preferences.update"]); expect(mobile.trace.writes).toEqual([]); expect(desktop.trace.writes[0]!.events).toHaveLength(1); await verify(f, [desktop.trace, mobile.trace], baseline);
  } finally { await Promise.allSettled(contexts.map(context => context.close())); await f.close(); }
});

test("ordem e visibilidade salvas mudam trilho e barra; SQL recusa desligar cada módulo essencial", async ({ browser }) => {
  const f = await createSettingsFixture(product), contexts: BrowserContext[] = [];
  try {
    const baseline = await f.ledger(), desktop = await newSurface(browser, f, contexts, 1280); await mount(desktop.page, f); const nav = desktop.page.getByRole("navigation", { name: "Navegação principal", exact: true }); await expect(nav.getByRole("link")).toHaveText(expectedLabels);
    for (const name of ["Início", "Capturar", "Configurações"]) await expect(desktop.page.getByRole("switch", { name, exact: true })).toBeDisabled();
    await desktop.page.getByRole("button", { name: "Subir conhecimento", exact: true }).click(); await save(desktop.page, desktop.trace, "Salvar módulos", 1); const orderedLabels = ["Início", "Capturar", "Conhecimento", "Tarefas", ...expectedLabels.slice(4)], orderedKeys = ["inicio", "capturar", "conhecimento", "tarefas", ...expectedKeys.slice(4)];
    await expect(nav.getByRole("link")).toHaveText(orderedLabels); expect((await f.oracle()).modules).toEqual(orderedKeys.map((module_key, index) => ({ module_key, visible: true, sort_order: index * 10 })));
    await desktop.page.getByRole("switch", { name: "Projetos", exact: true }).click(); await save(desktop.page, desktop.trace, "Salvar módulos", 2); const visible = orderedLabels.filter(label => label !== "Projetos"); await expect(nav.getByRole("link")).toHaveText(visible); expect((await f.oracle()).modules.find(row => row.module_key === "projetos")?.visible).toBe(false); expect(await f.policy()).toMatchObject({ isAdmin: false, entitlements: { calendario: false }, preferences: { projetos: { visible: false, order: 50 } } });
    await mount(desktop.page, f, true); await expect(nav.getByRole("link")).toHaveText(visible); const mobile = await newSurface(browser, f, contexts, 390); await mount(mobile.page, f); const bottom = mobile.page.getByRole("navigation", { name: "Navegação no celular", exact: true }); await expect(bottom.getByRole("link")).toHaveText(visible.slice(0, 4)); await bottom.getByRole("button", { name: "Mais módulos e conta", exact: true }).click(); const more = mobile.page.getByRole("dialog", { name: "Mais módulos", exact: true }); await expect(more.getByRole("navigation", { name: "Mais navegação", exact: true }).getByRole("link").filter({ hasNotText: /Atividade|Ajuda/ })).toHaveText(visible.slice(4)); await expect(more.getByRole("link", { name: "Projetos", exact: true })).toHaveCount(0);
    const beforeRefusal = await f.ledger(); for (const essential of ["inicio", "capturar", "configuracoes"]) {
      // Official SDK -> settings_commit, deliberately bypassing Core decoder.
      const response = await f.rawCommit({ command: "settings.modules.update", input: { client_id: "essential-" + essential, modules: [{ module_key: essential, visible: false, sort_order: 0 }] } }); expect(response.error?.code).toBe("22023"); expect(response.data).toBeNull(); expect(await f.ledger()).toEqual(beforeRefusal);
    }
    const saved = desktop.trace.writes[1]!, beforeReplay = await f.ledger(); expect(await f.command(saved.request)).toEqual(saved.result); expect(await f.ledger()).toEqual(beforeReplay);
    expect(desktop.trace.writes.map(write => write.request.command)).toEqual(["settings.modules.update", "settings.modules.update"]); expect(desktop.trace.writes.map(write => write.events.length)).toEqual([11, 11]); expect(mobile.trace.writes).toEqual([]); await verify(f, [desktop.trace, mobile.trace], baseline);
  } finally { await Promise.allSettled(contexts.map(context => context.close())); await f.close(); }
});

test("perfil e preferências de lembretes persistem pelo SDK SQL sem revogar entitlements nem ler agenda", async ({ page }) => {
  const f = await createSettingsFixture(product);
  try {
    const baseline = await f.ledger(), trace = await attach(page, f); await mount(page, f); await page.getByLabel("Nome", { exact: true }).fill("Nome SQL da conta"); await save(page, trace, "Salvar nome", 1);
    await page.getByLabel("Visão inicial", { exact: true }).selectOption("week"); await page.getByLabel("Antecedência", { exact: true }).selectOption("15"); await page.getByRole("switch", { name: "Lembrar de reuniões no aplicativo", exact: true }).click(); await save(page, trace, "Salvar lembretes", 2);
    const value = await f.oracle(); expect(value.profile).toEqual({ display_name: "Nome SQL da conta", email: "settings-owner@example.invalid", avatar_file_id: null }); expect(value.preferences).toMatchObject({ default_calendar_view: "week", meeting_reminder_minutes: 15, meeting_reminders_enabled: false }); await mount(page, f, true); await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Nome SQL da conta"); await expect(page.getByLabel("Visão inicial", { exact: true })).toHaveValue("week"); await expect(page.getByLabel("Antecedência", { exact: true })).toHaveValue("15"); await expect(page.getByRole("switch", { name: "Lembrar de reuniões no aplicativo", exact: true })).toHaveAttribute("aria-checked", "false");
    expect(trace.writes.map(write => write.request.command)).toEqual(["settings.profile.update", "settings.preferences.update"]); expect(trace.writes.map(write => write.events.length)).toEqual([1, 1]); await verify(f, [trace], baseline);
  } finally { await page.close(); await f.close(); }
});

test("painéis mobile navegam por âncoras e recolhem pelo teclado sem gravações ou consultas de outros módulos", async ({ page }) => {
  const f = await createSettingsFixture(product);
  try {
    await page.setViewportSize({ width: 320, height: 900 }); const baseline = await f.ledger(), trace = await attach(page, f); await mount(page, f); const navigation = page.getByRole("navigation", { name: "Nesta página", exact: true });
    const sections = [{ id: "perfil", link: "Perfil", button: "Perfil" }, { id: "aparencia", link: "Aparência", button: "Aparência" }, { id: "modulos", link: "Módulos", button: "Módulos" }, { id: "lembretes", link: "Lembretes", button: "Calendário e lembretes" }, { id: "dados", link: "Meus dados", button: "Meus dados" }]; await expect(navigation.getByRole("link")).toHaveText(sections.map(section => section.link));
    for (const section of sections) {
      const link = navigation.getByRole("link", { name: section.link, exact: true }); await expect(link).toHaveAttribute("href", "#" + section.id); await link.focus(); await expect(link).toBeFocused(); await link.press("Enter"); await expect(page).toHaveURL(origin + "/configuracoes#" + section.id);
      const panel = page.locator("#" + section.id), button = panel.getByRole("button", { name: section.button, exact: true }); await expect(button).toHaveAttribute("aria-expanded", "true"); const id = await button.getAttribute("aria-controls"); expect(id).toBeTruthy(); const content = panel.locator(".ui-collapsible__content"); await expect(content).toHaveAttribute("id", id!); await expect(content).toBeVisible();
      await button.focus(); await button.press("Space"); await expect(button).toBeFocused(); await expect(button).toHaveAttribute("aria-expanded", "false"); await expect(content).toBeHidden(); await button.press("Enter"); await expect(button).toHaveAttribute("aria-expanded", "true"); await expect(content).toBeVisible();
    }
    expect(trace.writes).toEqual([]); expect(await f.ledger()).toEqual(baseline); await verify(f, [trace], baseline);
  } finally { await page.close(); await f.close(); }
});
