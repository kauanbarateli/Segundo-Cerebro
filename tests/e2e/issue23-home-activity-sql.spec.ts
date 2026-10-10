/** SQL/Core/Gateways → explicit public-HTTP seam → real connected frontend.
 * Auth catalogue and routing/CSS/HTTP are fixtures. This is not the Next GET,
 * Auth, SDK, GoTrue/PostgREST, production, layout or hosted-persistence proof.
 * Chromium execution belongs to Linux CI, never a local Windows service.
 */
import { expect, test, type Page, type Route } from "@playwright/test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import type { CaptureTaskOperation, CaptureTaskRpc } from "../../src/adapters/db/capture-task-gateway";
import type { ActivityRpc } from "../../src/adapters/db/activity-gateway";
import type { ActivityPage, ActivityQuery } from "../../src/core/activity";
import type { Captura } from "../../src/core/capturas";
import type { Tarefa } from "../../src/core/tarefas";

type Product = typeof import("./fixtures/issue23-sql-server.entry");
const origin = "https://issue23-sql-fixture.test", now = "2030-01-10T02:30:00.000Z";
const owner = "45000000-0000-4000-8000-000000000001", session = "45000000-0000-4000-8000-000000000002";
const foreign = "45000000-0000-4000-8000-000000000003", foreignSession = "45000000-0000-4000-8000-000000000004";
let product: Product, browserBundle: string;
const originalTimezone = process.env.TZ;
test.use({ timezoneId: "UTC" });
test.beforeAll(async () => {
  process.env.TZ = "UTC";
  expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  const nodeBuild = await rolldown({ input: resolve("tests/e2e/fixtures/issue23-sql-server.entry.ts"), platform: "node", tsconfig: false,
    resolve: { conditionNames: ["react-server", "node", "import", "default"] } });
  try {
    const generated = await nodeBuild.generate({ format: "es", codeSplitting: false });
    if (generated.output.length !== 1 || generated.output[0]?.type !== "chunk" || generated.output[0].imports.length || generated.output[0].dynamicImports.length) throw new Error("Standalone product Node bundle is required.");
    product = await import("data:text/javascript;base64," + Buffer.from(generated.output[0].code).toString("base64")) as Product;
    expect(Object.keys(product).sort()).toEqual(["activityQuery", "createActivityGateway", "createCaptureTaskGateway", "createCaptureTaskStore", "decodeCaptureTaskRequest", "executeCaptureTaskCommand"]);
  } finally { await nodeBuild.close(); }
  const navigation = resolve("tests/e2e/fixtures/home-preferences-navigation.tsx").replaceAll("\\", "/");
  const browserBuild = await rolldown({ input: resolve("tests/e2e/fixtures/issue23-home-activity-browser.tsx"), platform: "browser", tsconfig: false,
    resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "issue23-navigation-and-css", resolveId(source) {
      if (source.endsWith(".css")) return "\0issue23-css";
      if (source === "next/link") return "\0issue23-link";
    }, load(id) {
      if (id === "\0issue23-css") return "export {};";
      if (id === "\0issue23-link") return `export { NavigationLink as default } from ${JSON.stringify(navigation)};`;
    } }],
  });
  try {
    const generated = await browserBuild.generate({ format: "iife", codeSplitting: false });
    const chunk = generated.output.find(output => output.type === "chunk");
    if (!chunk || chunk.type !== "chunk") throw new Error("Issue23 browser bundle is missing.");
    browserBundle = chunk.code;
  } finally { await browserBuild.close(); }
});
test.afterAll(() => { if (originalTimezone === undefined) delete process.env.TZ; else process.env.TZ = originalTimezone; });

const signatures: Record<Parameters<CaptureTaskRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  capture_task_snapshot: { sql: "select public.capture_task_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_revision: { sql: "select public.capture_task_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_receipt: { sql: "select public.capture_task_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
  capture_task_commit: { sql: "select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
};
async function dataFixture() {
  const db = await createLocalCanonicalSql();
  await db.query("insert into auth.users(id,aud,role,email) values ($1,'authenticated','authenticated','issue23-owner@example.invalid'),($2,'authenticated','authenticated','issue23-foreign@example.invalid')", [owner, foreign]);
  await db.query("insert into auth.sessions(id,user_id) values ($1,$2),($3,$4)", [session, owner, foreignSession, foreign]);
  let sequence = 20;
  const deps = { clock: { now: () => now }, ids: { next: () => `45000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } };
  async function sql(sql: string, values: unknown[]) {
    try {
      const result = await db.transaction(async tx => { await tx.exec("set local role service_role"); return tx.query<{ data: unknown }>(sql, values); });
      return { data: result.rows[0]!.data, error: null };
    } catch (error) { const code = (error as { code?: unknown }).code; if (typeof code !== "string") throw error; return { data: null, error: { code } }; }
  }
  function gateway(operation: CaptureTaskOperation, actor = owner, sid = session) {
    const rpc: CaptureTaskRpc = async (name, args) => {
      expect(args.p_user).toBe(actor); expect(args.p_session).toBe(sid); expect(args.p_operation).toBe(operation);
      const signature = signatures[name];
      expect(Object.keys(args).sort()).toEqual(["p_user", "p_session", "p_operation", ...signature.extra].sort());
      return sql(signature.sql, [args.p_user, args.p_session, args.p_operation, ...signature.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]);
    };
    return product.createCaptureTaskGateway(actor, sid, operation, rpc);
  }
  const activityRpc: ActivityRpc = async args => {
    expect(args.p_user).toBe(owner); expect(args.p_session).toBe(session);
    return sql("select public.activity_page($1::uuid,$2::uuid,$3::integer,$4::timestamptz,$5::uuid) as data", [args.p_user, args.p_session, args.p_limit, args.p_before_time ?? null, args.p_before_id ?? null]);
  };
  const activity = product.createActivityGateway({ userId: owner, sessionId: session, role: "user", mustChangePassword: false, entitlements: {} }, activityRpc);
  async function command(value: unknown, actor = owner, sid = session) {
    const decoded = product.decodeCaptureTaskRequest(value);
    return product.executeCaptureTaskCommand(product.createCaptureTaskStore(gateway(decoded.command, actor, sid), { maxAttempts: 1 }), deps, { user_id: actor, canal: "web" }, decoded);
  }
  const capture = (title: string, clientId: string, status: "draft" | "inbox" = "inbox", actor = owner, sid = session) => command({ command: "capture.create", input: { client_id: clientId, type: "note", title, content: "PRIVATE_ACTIVITY_TEXT", category_id: null, project_id: null, status } }, actor, sid) as Promise<Captura>;
  const task = (title: string, clientId: string, dueAt: string | null, status: "todo" | "done" = "todo") => command({ command: "task.create", input: { client_id: clientId, title, description: null, category_id: null, project_id: null, status, priority: "medium", due_at: dueAt, scheduled_start_at: null, scheduled_end_at: null, all_day: false, estimated_minutes: null, board_position: null } }) as Promise<Tarefa>;
  return { db, gateway, activity, command, capture, task };
}
type Fixture = Awaited<ReturnType<typeof dataFixture>>;
type Reads = { path: string; activity?: { query: ActivityQuery; page: ActivityPage } };
async function attach(page: Page, fixture: Fixture) {
  const reads: Reads[] = [], unexpected: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({ time: new Date(now) });
  await page.route("**/*", async (route: Route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0" }, body: JSON.stringify(body) });
    if (url.pathname === "/api/capture-tasks" || url.pathname === "/api/activity") {
      if (request.method() !== "GET" || request.headers()["x-expected-user-id"] !== owner) { unexpected.push("UNBOUND_REQUEST"); await route.abort(); return; }
      if (url.pathname === "/api/activity") {
        const query = product.activityQuery(url.searchParams), result = await fixture.activity.page(query);
        reads.push({ path: url.pathname + url.search, activity: { query, page: result } }); await json(result); return;
      }
      const query = url.searchParams.get("query");
      if (url.searchParams.size !== 1 || query !== "captures" && query !== "tasks") { unexpected.push("UNKNOWN_QUERY"); await route.abort(); return; }
      // Explicit public-HTTP seam: same presentation fields as the product GET,
      // but no Next handler, Auth cookie verification or SDK is claimed here.
      const { snapshot, projectsVisible } = await fixture.gateway(query === "captures" ? "read.captures" : "read.tasks").presentation();
      reads.push({ path: url.pathname + url.search });
      await json({ items: query === "captures" ? snapshot.captures : snapshot.tasks, categories: snapshot.categories,
        projects: projectsVisible ? snapshot.projects.filter(project => !project.deleted_at) : [],
        ...(query === "captures" && snapshot.readonlyCaptureIds !== undefined ? { readonlyCaptureIds: snapshot.readonlyCaptureIds } : {}) }); return;
    }
    if (request.isNavigationRequest() && ["/", "/atividade"].includes(url.pathname) && !url.search) {
      await route.fulfill({ status: 200, contentType: "text/html", body: '<html lang="pt-BR"><body><div id="issue23-sql-fixture"></div></body></html>' }); return;
    }
    unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  return { reads, unexpected, errors };
}
async function start(page: Page, path: "/" | "/atividade") {
  await page.goto(origin + path); await page.addScriptTag({ content: browserBundle });
  await page.evaluate(userId => (globalThis as unknown as { __startIssue23SqlFixture(userId: string): void }).__startIssue23SqlFixture(userId), owner);
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe("UTC");
  await expect(page.getByRole("heading", { level: 1, name: path === "/" ? "Início" : "Atividade", exact: true })).toBeVisible();
}
const stat = (page: Page, name: string) => page.locator(".home-stats > div").filter({ has: page.getByText(name, { exact: true }) }).locator("dd");

test("Início lê o banco canônico e usa o dia de São Paulo sob UTC, inclusive após refetch", async ({ page }) => {
  const fixture = await dataFixture();
  try {
    const due = await fixture.task("Hoje SQL", "task-today", "2030-01-10T02:20:00.000Z");
    await fixture.task("Amanhã SQL", "task-next-day", "2030-01-10T03:00:00.000Z");
    await fixture.task("Concluída SQL", "task-done", null, "done");
    const inbox = await fixture.capture("Caixa SQL", "capture-inbox");
    const organized = await fixture.capture("Organizada SQL", "capture-organized");
    await fixture.command({ command: "capture.convert", input: { capture_id: organized.id, client_id: "capture-convert" } });
    await fixture.capture("Rascunho SQL", "capture-draft", "draft");
    const archived = await fixture.capture("Arquivada SQL", "capture-archive");
    await fixture.command({ command: "capture.archive", input: { id: archived.id, client_id: "capture-archived" } });
    await fixture.capture("FOREIGN_HOME_SENTINEL", "foreign-home", "inbox", foreign, foreignSession);
    const trace = await attach(page, fixture); await start(page, "/");
    await expect(page.locator(".home-date")).toContainText("9 de janeiro");
    await expect(page.getByRole("region", { name: "Em foco", exact: true }).getByRole("heading", { name: "Hoje SQL", exact: true })).toBeVisible();
    const today = page.getByRole("region", { name: "Tarefas de hoje", exact: true });
    await expect(today.getByRole("listitem")).toHaveCount(2);
    await expect(today.getByText("Hoje SQL", { exact: true })).toBeVisible(); await expect(today.getByText("Concluída SQL", { exact: true })).toBeVisible();
    await expect(today).not.toContainText("Amanhã SQL");
    await expect(stat(page, "Tarefas abertas")).toHaveText("3"); await expect(stat(page, "Concluídas na semana")).toHaveText("1");
    await expect(stat(page, "Capturas por organizar")).toHaveText("1");
    await expect(page.getByRole("region", { name: "Caixa de entrada", exact: true }).getByText("Caixa SQL", { exact: true })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Notas organizadas", exact: true })).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByRole("progressbar", { name: "Notas organizadas", exact: true })).toHaveAttribute("aria-valuemax", "2");
    await expect(page.locator("main")).not.toContainText(/Rascunho SQL|Arquivada SQL|FOREIGN_HOME_SENTINEL/);
    // Independent relational oracle, not the same Home projection under test.
    const counts = (await fixture.db.query<{ open: number; completed: number; inbox: number; total: number }>(`select
      (select count(*)::int from public.tasks where user_id=$1 and deleted_at is null and archived_at is null and payload->>'status' not in ('done','archived')) as open,
      (select count(*)::int from public.tasks where user_id=$1 and payload->>'status'='done' and (payload->>'completed_at')::timestamptz >= '2030-01-07T03:00Z') as completed,
      (select count(*)::int from public.captures where user_id=$1 and deleted_at is null and payload->>'status'='inbox') as inbox,
      (select count(*)::int from public.captures where user_id=$1 and deleted_at is null and payload->>'status' in ('inbox','organized')) as total`, [owner])).rows[0];
    expect(counts).toEqual({ open: 3, completed: 1, inbox: 1, total: 2 });
    await fixture.command({ command: "task.status", input: { id: due.id, client_id: "task-finished", status: "done" } });
    await fixture.command({ command: "capture.update", input: { id: inbox.id, client_id: "inbox-updated", patch: { title: "Caixa SQL atualizada" } } });
    await page.getByRole("button", { name: "Atualizar consultas da prova", exact: true }).click();
    await expect(page.getByLabel("Consultas atualizadas", { exact: true })).toHaveText("1");
    await expect(stat(page, "Tarefas abertas")).toHaveText("2"); await expect(stat(page, "Concluídas na semana")).toHaveText("2");
    await expect(page.getByRole("region", { name: "Caixa de entrada", exact: true }).getByText("Caixa SQL atualizada", { exact: true })).toBeVisible();
    expect(trace.reads.some(read => read.path === "/api/capture-tasks?query=tasks")).toBe(true);
    expect(trace.reads.some(read => read.path === "/api/capture-tasks?query=captures")).toBe(true);
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await fixture.db.close(); }
});

test("Atividade pagina os próprios eventos do SQL, preserva cursor e retorna aos recentes", async ({ page }) => {
  const fixture = await dataFixture();
  try {
    const capture = await fixture.capture("Atividade SQL 00", "activity-origin");
    // Pagination mass only, not an invented exhaustive command-coverage claim:
    // 21 real Core events, equal timestamps and distinct UUIDs, plus unchanged
    // provisioning events. No direct insertion/deletion of domain_events.
    for (let index = 1; index <= 20; index++) await fixture.command({ command: "capture.update", input: { id: capture.id, client_id: `activity-${index}`, patch: { title: `Atividade SQL ${String(index).padStart(2, "0")}` } } });
    await fixture.capture("FOREIGN_ACTIVITY_SENTINEL", "foreign-activity", "inbox", foreign, foreignSession);
    const expected = (await fixture.db.query<{ id: string; occurred_at: string; title: string | null }>(`select id,
      to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as occurred_at,
      coalesce(after->>'title',after->>'name',before->>'title',before->>'name') as title
      from public.domain_events where user_id=$1 order by occurred_at desc,id desc`, [owner])).rows;
    expect(expected).toHaveLength(25);
    const trace = await attach(page, fixture); await start(page, "/atividade");
    const list = page.getByRole("list", { name: "Registros de atividade", exact: true });
    await expect(list.getByRole("listitem")).toHaveCount(20);
    await expect(page.locator(".activity-pagination p")).toHaveText("Página 1 · 20 registros");
    expect(await list.locator(".activity-title").allTextContents()).toEqual(expected.slice(0, 20).map(row => row.title));
    await expect(list.locator("time").first()).toContainText("23:30");
    await expect(page.getByRole("button", { name: "Registros mais recentes", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Registros anteriores", exact: true }).click();
    await expect(page.locator(".activity-pagination p")).toHaveText("Página 2 · 5 registros");
    await expect(list.getByRole("listitem")).toHaveCount(5);
    await expect(list.getByText("Atividade SQL 00", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registros anteriores", exact: true })).toBeDisabled();
    const pages = trace.reads.flatMap(read => read.activity ? [read.activity] : []);
    expect(pages).toHaveLength(2);
    expect(pages.flatMap(read => read.page.items.map(item => item.id))).toEqual(expected.map(row => row.id));
    expect(pages[1]!.query.cursor).toEqual({ id: expected[19]!.id, occurred_at: expected[19]!.occurred_at });
    expect(pages[1]!.query.cursor!.occurred_at).toMatch(/\.\d{6}Z$/);
    expect(JSON.stringify(pages.map(read => read.page))).not.toMatch(/PRIVATE_ACTIVITY_TEXT|FOREIGN_ACTIVITY_SENTINEL|user_id|capture_task_payload|"before"|"after"/);
    await expect(page.locator("main")).not.toContainText(/PRIVATE_ACTIVITY_TEXT|FOREIGN_ACTIVITY_SENTINEL/);
    await page.getByRole("button", { name: "Registros mais recentes", exact: true }).click();
    await expect(page.locator(".activity-pagination p")).toHaveText("Página 1 · 20 registros");
    await expect(list.getByRole("listitem")).toHaveCount(20);
    const revisited = trace.reads.at(-1)!.activity!;
    expect(revisited.query.cursor).toBeNull(); expect(revisited.page.items.map(item => item.id)).toEqual(expected.slice(0, 20).map(row => row.id));
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await fixture.db.close(); }
});
