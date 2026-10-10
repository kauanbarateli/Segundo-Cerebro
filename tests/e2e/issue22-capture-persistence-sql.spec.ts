/** Real GUI/client/journal -> bound HTTP seam -> Core/Gateway/Store/canonical SQL.
 * Auth/policy/routing are fixtures. RLS originates in an authenticated SELECT
 * probe before snapshot, not the privileged SECURITY DEFINER snapshot itself.
 * No Next handler/SDK/GoTrue/PostgREST, physical-device, hosted, visual-diff or
 * complete-shell/layout claim. Chromium runs only in Linux CI.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import type { CaptureTaskOperation, CaptureTaskRpc } from "../../src/adapters/db/capture-task-gateway";
import type { Captura } from "../../src/core/capturas";

type Product = typeof import("./fixtures/issue23-sql-server.entry");
const origin = "https://issue22-capture-sql.test", now = "2030-01-10T02:30:00.000Z";
const owner = "48000000-0000-4000-8000-000000000001";
const mobileSession = "48000000-0000-4000-8000-000000000002", desktopSession = "48000000-0000-4000-8000-000000000003";
let product: Product, browserBundle: string, styles: string;

const componentCss = ["src/components/ui/button.css", "src/components/ui/field.css", "src/components/ui/card.css", "src/components/ui/dialog.css",
  "src/components/ui/data-display.css", "src/components/ui/toast.css", "src/components/layout/related-panel.css",
  "src/components/features/capturar/capture.css"];
test.beforeAll(async () => {
  const nodeBuild = await rolldown({ input: resolve("tests/e2e/fixtures/issue23-sql-server.entry.ts"), platform: "node", tsconfig: false,
    resolve: { conditionNames: ["react-server", "node", "import", "default"] } });
  try {
    const { output } = await nodeBuild.generate({ format: "es", codeSplitting: false });
    if (output.length !== 1 || output[0]?.type !== "chunk" || output[0].imports.length || output[0].dynamicImports.length) throw new Error("Standalone product Node bundle is required.");
    product = await import("data:text/javascript;base64," + Buffer.from(output[0].code).toString("base64")) as Product;
    expect(Object.keys(product).sort()).toEqual(["activityQuery", "createActivityGateway", "createCaptureTaskGateway", "createCaptureTaskStore", "decodeCaptureTaskRequest", "executeCaptureTaskCommand"]);
  } finally { await nodeBuild.close(); }
  const navigation = resolve("tests/e2e/fixtures/issue22-capture-navigation.tsx").replaceAll("\\", "/");
  const importedCss = new Set<string>();
  const browserBuild = await rolldown({ input: resolve("tests/e2e/fixtures/issue22-capture-persistence-browser.tsx"), platform: "browser", tsconfig: false,
    resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "issue22-navigation-and-canonical-css", resolveId(source, importer) {
      if (source.endsWith(".css")) {
        if (!importer || !source.startsWith(".")) throw new Error("Only canonical relative component CSS is supported.");
        importedCss.add(resolve(dirname(importer), source)); return "\0issue22-css";
      }
      if (source === "next/link") return "\0issue22-link";
    }, load(id) {
      if (id === "\0issue22-css") return "export {};";
      if (id === "\0issue22-link") return `export { NavigationLink as default } from ${JSON.stringify(navigation)};`;
    } }],
  });
  try {
    const { output } = await browserBuild.generate({ format: "iife", codeSplitting: false });
    if (output.length !== 1 || output[0]?.type !== "chunk" || output[0].imports.length || output[0].dynamicImports.length) throw new Error("Standalone capture browser bundle is required.");
    browserBundle = output[0].code;
  } finally { await browserBuild.close(); }
  expect([...importedCss].sort()).toEqual(componentCss.map(path => resolve(path)).sort());
  // Canonical globals (including Tailwind/tokens/utilities) are processed with
  // existing dependencies. Every component CSS import is accounted for above.
  const globalPath = resolve("src/app/globals.css");
  const globalCss = await postcss([tailwind()]).process(await readFile(globalPath, "utf8"), { from: globalPath });
  styles = globalCss.css + "\n" + (await Promise.all(componentCss.map(path => readFile(path, "utf8")))).join("\n");
  const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2");
  styles += `\n@font-face { font-family: Issue22Geist; src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2"); font-style:normal; font-weight:100 900; }
    :root { --font-geist-sans: Issue22Geist; }`;
  expect(styles).not.toMatch(/@import\s/);
  for (const match of styles.matchAll(/url\(([^)]*)\)/g)) expect(match[1]!.replaceAll(/["']/g, "").trim()).toMatch(/^data:/);
});

const signatures: Record<Parameters<CaptureTaskRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  capture_task_snapshot: { sql: "select public.capture_task_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_revision: { sql: "select public.capture_task_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_receipt: { sql: "select public.capture_task_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
  capture_task_commit: { sql: "select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
};
async function dataFixture() {
  const db = await createLocalCanonicalSql();
  try {
    await db.query("insert into auth.users(id,aud,role,email) values ($1,'authenticated','authenticated','issue22-owner@example.invalid')", [owner]);
    await db.query("insert into auth.sessions(id,user_id) values ($1,$3),($2,$3)", [mobileSession, desktopSession, owner]);
  } catch (error) { await db.close(); throw error; }
  let sequence = 20, planted = false;
  const calls: { name: Parameters<CaptureTaskRpc>[0]; operation: CaptureTaskOperation; session: string }[] = [];
  const denials: { code: string; source: "authenticated-capture-select"; session: string }[] = [];
  const deps = { clock: { now: () => now }, ids: { next: () => `48000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } };
  async function probe(sid: string, off = false) {
    expect([mobileSession, desktopSession]).toContain(sid);
    return db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner, session_id: sid })]);
      await tx.exec("set local role authenticated; set local row_security=" + (off ? "off" : "on"));
      return tx.query<{ id: string }>("select id from public.captures where user_id=$1 order by id", [owner]);
    });
  }
  function gateway(operation: CaptureTaskOperation, sid: string) {
    expect([mobileSession, desktopSession]).toContain(sid);
    const rpc: CaptureTaskRpc = async (name, args) => {
      expect(args.p_user).toBe(owner); expect(args.p_session).toBe(sid); expect(args.p_operation).toBe(operation);
      const signature = signatures[name];
      expect(Object.keys(args).sort()).toEqual(["p_user", "p_session", "p_operation", ...signature.extra].sort());
      calls.push({ name, operation, session: sid });
      if (planted && name === "capture_task_snapshot" && operation === "read.captures") {
        // SQL-origin failure injection: a genuine RLS-required SELECT refusal,
        // not missing GRANT, Entitlement veto, synthetic RAISE or fabricated code.
        // The product SECURITY DEFINER snapshot itself is not this RLS probe.
        try { await probe(sid, true); throw new Error("RLS unexpectedly bypassed."); }
        catch (error) {
          expect(error).toMatchObject({ code: "42501", message: 'query would be affected by row-level security policy for table "captures"' });
          const code = (error as { code: string }).code;
          denials.push({ code, source: "authenticated-capture-select", session: sid });
          return { data: null, error: { code } };
        }
      }
      try {
        const result = await db.transaction(async tx => {
          await tx.exec("set local role service_role");
          return tx.query<{ data: unknown }>(signature.sql, [args.p_user, args.p_session, args.p_operation,
            ...signature.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]);
        });
        return { data: result.rows[0]!.data, error: null };
      } catch (error) { const code = (error as { code?: unknown }).code; if (typeof code !== "string") throw error; return { data: null, error: { code } }; }
    };
    return product.createCaptureTaskGateway(owner, sid, operation, rpc);
  }
  async function command(value: unknown, sid: string) {
    const decoded = product.decodeCaptureTaskRequest(value);
    return product.executeCaptureTaskCommand(product.createCaptureTaskStore(gateway(decoded.command, sid), { maxAttempts: 1 }), deps, { user_id: owner, canal: "web" }, decoded);
  }
  async function catalog() {
    const rights = (await db.query(`select has_table_privilege('authenticated','public.captures','select') as readable,
      c.relrowsecurity as rls,r.rolbypassrls,r.rolsuper,p.polname,pg_get_expr(p.polqual,p.polrelid) as policy
      from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_policy p on p.polrelid=c.oid cross join pg_roles r
      where n.nspname='public' and c.relname='captures' and r.rolname='authenticated' order by p.polname`)).rows;
    expect(rights).toHaveLength(1); expect(rights[0]).toMatchObject({ readable: true, rls: true, rolbypassrls: false, rolsuper: false, polname: "own_read" });
    return rights;
  }
  async function ledger() {
    return (await db.query<{ data: unknown }>(`select jsonb_build_object(
      'captures',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.captures x where user_id=$1),
      'tasks',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.tasks x where user_id=$1),
      'events',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.domain_events x where user_id=$1),
      'receipts',(select coalesce(jsonb_agg(to_jsonb(x) order by command,client_id),'[]') from app_private.command_receipts x where user_id=$1),
      'revisions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from app_private.capture_task_revisions x where user_id=$1),
      'limits',(select coalesce(jsonb_agg(to_jsonb(x) order by scope,subject_hash),'[]') from app_private.rate_limits x where user_id=$1)) as data`, [owner])).rows[0]!.data;
  }
  return { db, calls, denials, gateway, command, probe, catalog, ledger, plant(value: boolean) { planted = value; } };
}
type Fixture = Awaited<ReturnType<typeof dataFixture>>;
type Write = { session: string; body: { command: string; input: Record<string, unknown> }; result: unknown };
async function attach(context: BrowserContext, fixture: Fixture, sid: string) {
  expect([mobileSession, desktopSession]).toContain(sid);
  const writes: Write[] = [], unexpected: string[] = [], pageErrors: string[] = [], reads: number[] = [];
  context.on("page", page => page.on("pageerror", error => pageErrors.push(error.message)));
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0" }, body: JSON.stringify(body) });
    if (url.pathname === "/api/capture-tasks") {
      if (request.headers()["x-expected-user-id"] !== owner) { unexpected.push("UNBOUND_REQUEST"); await route.abort(); return; }
      if (request.method() === "GET" && url.searchParams.size === 1 && url.searchParams.get("query") === "captures") {
        const before = fixture.denials.length;
        try {
          const { snapshot, projectsVisible } = await fixture.gateway("read.captures", sid).presentation();
          reads.push(snapshot.captures.length);
          await json({ items: snapshot.captures, categories: snapshot.categories, projects: projectsVisible ? snapshot.projects.filter(project => !project.deleted_at) : [],
            ...(snapshot.readonlyCaptureIds !== undefined ? { readonlyCaptureIds: snapshot.readonlyCaptureIds } : {}) }); return;
        } catch (error) {
          // Explicit HTTP seam derives 403 only from this request's actual SQL
          // probe and the real Gateway's forbidden translation. Other failures
          // cannot be relabelled as RLS or turned into a successful empty list.
          expect(error).toMatchObject({ name: "AuthGuardError", code: "forbidden" });
          expect(fixture.denials.length).toBe(before + 1);
          expect(fixture.denials.at(-1)).toEqual({ code: "42501", source: "authenticated-capture-select", session: sid });
          await json({ ok: false, code: "FORBIDDEN", message: "Esta operação não está disponível para sua conta." }, 403); return;
        }
      }
      if (request.method() === "POST" && !url.search) {
        if (request.headers()["origin"] !== origin || request.headers()["content-type"]?.split(";")[0] !== "application/json") { unexpected.push("INVALID_WRITE_HEADERS"); await route.abort(); return; }
        const body = request.postData();
        if (!body || Buffer.byteLength(body) > 256 * 1024) throw new Error("Write body exceeded this fixture.");
        const value = JSON.parse(body) as Write["body"];
        expect(value.command).toBe("capture.create");
        const result = await fixture.command(value, sid);
        writes.push({ session: sid, body: value, result }); await json({ ok: true, result }); return;
      }
      unexpected.push("UNSUPPORTED_API"); await route.abort(); return;
    }
    if (request.isNavigationRequest() && request.method() === "GET" && url.pathname === "/capturar" && [...url.searchParams.keys()].every(key => key === "capture")) {
      await route.fulfill({ status: 200, contentType: "text/html", body: '<html lang="pt-BR" data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="issue22-capture-fixture"></div></body></html>' }); return;
    }
    unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  return { writes, reads, unexpected, pageErrors };
}
async function start(page: Page, href: string | null = "/capturar") {
  if (href === null) await page.reload(); else await page.goto(origin + href);
  await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: browserBundle });
  await page.evaluate(userId => (globalThis as unknown as { __startIssue22CaptureFixture(userId: string): void }).__startIssue22CaptureFixture(userId), owner);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { level: 1, name: "Capturar", exact: true })).toBeVisible();
}
async function journal(page: Page) {
  return page.evaluate(userId => {
    const prefix = "segundo-cerebro:commands:v1:" + userId + ":";
    const epoch = JSON.parse(localStorage.getItem(prefix + "epoch") ?? "null") as { epoch: string } | null;
    const settled = JSON.parse(localStorage.getItem(prefix + "settled") ?? "null") as { items: { command: string; clientId: string; status: string; entityId: string | null }[] } | null;
    return { epoch: epoch?.epoch ?? null, settlements: settled?.items ?? [], pending: Object.keys(localStorage).filter(key => key.startsWith(prefix + "entry:")) };
  }, owner);
}

test("captura pela tela móvel persiste no SQL e aparece no desktop independente após reload", async ({ browser }) => {
  const fixture = await dataFixture();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: "UTC", reducedMotion: "reduce" });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "UTC", reducedMotion: "reduce" });
  try {
    expect(mobile).not.toBe(desktop);
    const mobileTrace = await attach(mobile, fixture, mobileSession), desktopTrace = await attach(desktop, fixture, desktopSession);
    const mobilePage = await mobile.newPage(), desktopPage = await desktop.newPage();
    await start(desktopPage); await expect(desktopPage.getByRole("heading", { name: "Sua primeira ideia começa aqui", exact: true })).toBeVisible();
    await start(mobilePage);
    await mobilePage.getByLabel("Título da nota", { exact: true }).fill("Nota móvel persistida no SQL");
    await mobilePage.getByLabel("Sua anotação", { exact: true }).fill("Texto escrito no contexto móvel, lido da mesma linha SQL no desktop.");
    await mobilePage.getByRole("button", { name: "Salvar nota", exact: true }).click();
    await expect(mobilePage.getByText("Salva na sua conta", { exact: true })).toBeVisible();
    // A fresh ACK leaves global reconciliation feedback idle. The immutable
    // journal settlement and SQL receipt below prove this send was confirmed.
    await expect(mobilePage.getByLabel("Proteção do envio", { exact: true })).toHaveText("idle");
    expect(mobileTrace.writes).toHaveLength(1); expect(desktopTrace.writes).toEqual([]);
    const write = mobileTrace.writes[0]!;
    expect(write.session).toBe(mobileSession); expect(write.body.command).toBe("capture.create");
    const captures = (await fixture.db.query<{ payload: Captura }>("select payload from public.captures where user_id=$1 order by id", [owner])).rows;
    expect(captures).toHaveLength(1); const saved = captures[0]!.payload;
    expect(saved).toMatchObject({ user_id: owner, title: write.body.input.title, content: write.body.input.content, client_id: write.body.input.client_id });
    expect(saved).toEqual(write.result);
    expect(new URL(mobilePage.url()).searchParams.get("capture")).toBe(saved.id);
    const events = (await fixture.db.query<{ entity_id: string; action: string; canal: string; before: unknown; after: unknown }>("select entity_id,action,canal,before,after from public.domain_events where user_id=$1 and entity_type='capture' order by id", [owner])).rows;
    expect(events).toEqual([{ entity_id: saved.id, action: "created", canal: "web", before: null, after: saved }]);
    const receipts = (await fixture.db.query("select command,client_id,result from app_private.command_receipts where user_id=$1 order by command,client_id", [owner])).rows;
    expect(receipts).toEqual([{ command: "capture.create", client_id: write.body.input.client_id, result: saved }]);
    const mobileJournal = await journal(mobilePage);
    expect(mobileJournal.pending).toEqual([]); expect(mobileJournal.settlements).toHaveLength(1);
    expect(mobileJournal.settlements[0]).toMatchObject({ command: "capture.create", clientId: write.body.input.client_id, status: "confirmed", entityId: saved.id });
    await start(desktopPage, null);
    await desktopPage.getByRole("navigation", { name: "Notas salvas", exact: true }).getByRole("button", { name: /Nota móvel persistida no SQL/ }).click();
    await expect(desktopPage.getByLabel("Título da nota", { exact: true })).toHaveValue(saved.title!);
    await expect(desktopPage.getByLabel("Sua anotação", { exact: true })).toHaveValue(saved.content!);
    expect(new URL(desktopPage.url()).searchParams.get("capture")).toBe(saved.id);
    const desktopJournal = await journal(desktopPage);
    expect(desktopJournal.epoch).toBeTruthy(); expect(desktopJournal.epoch).not.toBe(mobileJournal.epoch);
    expect(desktopJournal.settlements).toEqual([]); expect(desktopJournal.pending).toEqual([]);
    await mobile.close();
    await start(desktopPage, null);
    await expect(desktopPage.getByLabel("Sua anotação", { exact: true })).toHaveValue(saved.content!);
    expect(desktopTrace.writes).toEqual([]); expect(desktopTrace.reads).toContain(1);
    expect(fixture.calls.some(call => call.name === "capture_task_commit" && call.session === mobileSession)).toBe(true);
    expect(fixture.calls.some(call => call.name === "capture_task_snapshot" && call.session === desktopSession)).toBe(true);
    expect(fixture.denials).toEqual([]);
    expect(mobileTrace.unexpected).toEqual([]); expect(desktopTrace.unexpected).toEqual([]);
    expect(mobileTrace.pageErrors).toEqual([]); expect(desktopTrace.pageErrors).toEqual([]);
  } finally { await mobile.close(); await desktop.close(); await fixture.db.close(); }
});

test("recusa SQL de RLS aparece como erro em Capturar e retry recupera a nota sem escrita", async ({ browser }) => {
  const fixture = await dataFixture();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "UTC", reducedMotion: "reduce" });
  try {
    const saved = await fixture.command({ command: "capture.create", input: { client_id: "rls-seed", type: "note", title: "Nota presente antes da recusa RLS", content: "Texto persistido antes da leitura recusada.", category_id: null, project_id: null } }, desktopSession) as Captura;
    const catalog = await fixture.catalog(), baseline = await fixture.ledger();
    expect((await fixture.probe(desktopSession)).rows).toEqual([{ id: saved.id }]);
    const commits = fixture.calls.filter(call => call.name === "capture_task_commit").length;
    const receiptCalls = fixture.calls.filter(call => call.name === "capture_task_receipt").length;
    fixture.plant(true);
    const trace = await attach(context, fixture, desktopSession), page = await context.newPage();
    await start(page);
    const alert = page.getByRole("alert");
    await expect(alert.getByRole("heading", { name: "Não foi possível carregar suas notas", exact: true })).toBeVisible();
    await expect(alert).toContainText("Você não tem acesso a esta operação.");
    await expect(alert.getByRole("button", { name: "Tentar novamente", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Notas salvas", exact: true })).toHaveCount(0);
    await expect(page.getByText(/Sua primeira ideia começa aqui|Nenhuma nota encontrada|Comece por uma nota de exemplo/)).toHaveCount(0);
    expect(fixture.denials.length).toBeGreaterThan(0);
    expect(fixture.denials.every(denial => denial.code === "42501" && denial.source === "authenticated-capture-select" && denial.session === desktopSession)).toBe(true);
    expect(trace.reads).toEqual([]);
    fixture.plant(false);
    await alert.getByRole("button", { name: "Tentar novamente", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("navigation", { name: "Notas salvas", exact: true }).getByRole("button", { name: /Nota presente antes da recusa RLS/ }).click();
    await expect(page.getByLabel("Sua anotação", { exact: true })).toHaveValue(saved.content!);
    expect(new URL(page.url()).searchParams.get("capture")).toBe(saved.id);
    expect((await fixture.probe(desktopSession)).rows).toEqual([{ id: saved.id }]);
    expect(await fixture.catalog()).toEqual(catalog); expect(await fixture.ledger()).toEqual(baseline);
    expect(fixture.calls.filter(call => call.name === "capture_task_commit")).toHaveLength(commits);
    expect(fixture.calls.filter(call => call.name === "capture_task_receipt")).toHaveLength(receiptCalls);
    expect(trace.writes).toEqual([]); expect(trace.reads).toContain(1); expect(trace.unexpected).toEqual([]); expect(trace.pageErrors).toEqual([]);
  } finally { await context.close(); await fixture.db.close(); }
});
