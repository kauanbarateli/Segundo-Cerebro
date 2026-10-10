/** Financeiro real UI/providers/client/journal -> declared HTTP/Auth seam ->
 * Core/Gateway/Store and canonical disposable SQL. No Next handler/runtime/SDK,
 * GoTrue/PostgREST, hosted persistence, physical phone or full visual acceptance.
 * SQL time is genuine; simulated presentation dates never change the ledger.
 */
import assert from "node:assert/strict";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";
import type { FinanceOperation, FinanceRpc } from "../../src/adapters/db/finance-gateway";
import type { FinanceRequest } from "../../src/adapters/db/finance-commands";
import type { ContaFinanceira, CategoriaFinanceira, LancamentoFinanceiro, CamposLancamentoFinanceiro } from "../../src/core/financeiro";

type Product = typeof import("./fixtures/issue26-27-finance-sql.entry");
const origin = "https://issue26-finance-sql.test";
const owner = "62000000-0000-4000-8000-000000000001", session = "62000000-0000-4000-8000-000000000002";
const foreign = "62000000-0000-4000-8000-000000000003", foreignSession = "62000000-0000-4000-8000-000000000004";
let product: Product, browserBundle: string, styles: string;
// Explicit fixture CSS composition: generic controls, layout, then domain.
// Resolver discovery verifies the closure, never the cascade authority. This
// declared seam is not Next's CSS loader or complete visual acceptance.
const componentCss = ["src/components/ui/badge.css", "src/components/ui/button.css", "src/components/ui/card.css", "src/components/ui/data-display.css",
  "src/components/ui/data-table.css", "src/components/ui/dialog.css", "src/components/ui/field.css", "src/components/ui/toast.css",
  "src/components/layout/related-panel.css", "src/components/features/financeiro/finance.css", "src/components/features/inicio/home.css"];
test.use({ timezoneId: "UTC" });
test.describe.configure({ retries: 0 });

export async function loadFinanceProduct(): Promise<Product> {
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/issue26-27-finance-sql.entry.ts"), platform: "node", tsconfig: false,
    resolve: { conditionNames: ["react-server", "node", "import", "default"] } });
  try {
    const { output } = await build.generate({ format: "es", codeSplitting: false });
    assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk");
    assert.deepEqual(chunk.imports, []); assert.deepEqual(chunk.dynamicImports, []);
    const exports = await import("data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64")) as Product;
    assert.deepEqual(Object.keys(exports).sort(), ["createFinanceGateway", "createFinanceStore", "decodeFinanceRequest", "executeFinanceCommand"]);
    return exports;
  } finally { await build.close(); }
}
test.beforeAll(async () => {
  if (process.platform !== "linux") throw new Error("Finance browser execution requires Linux CI; Windows QA runs no Chromium.");
  product = await loadFinanceProduct();
  const navigation = resolve("tests/e2e/fixtures/issue26-27-finance-browser.tsx").replaceAll("\\", "/");
  const importedCss = new Set<string>();
  const build = await rolldown({ input: navigation, platform: "browser", tsconfig: false,
    resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "finance-next-and-css-boundaries", resolveId(source, importer) {
      if (source.endsWith(".css")) {
        if (!importer || !source.startsWith(".")) throw new Error("Only canonical relative CSS is supported.");
        const path = resolve(dirname(importer), source), within = relative(resolve("src"), path);
        if (within.startsWith("..") || within.includes(":")) throw new Error("CSS escaped the product.");
        importedCss.add(path); return "\0finance-css";
      }
      if (source === "next/link") return "\0finance-link";
    }, load(id) {
      if (id === "\0finance-css") return "export {};";
      if (id === "\0finance-link") return "export { NavigationLink as default } from " + JSON.stringify(navigation) + ";";
    } }],
  });
  try {
    const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "Issue26FinanceFixture" });
    assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk");
    assert.deepEqual(chunk.imports, []); assert.deepEqual(chunk.dynamicImports, []); assert.ok(!/\bimport\s*\(/.test(chunk.code));
    browserBundle = chunk.code;
  } finally { await build.close(); }
  assert.deepEqual([...importedCss].sort(), componentCss.map(path => resolve(path)).sort());
  const globalPath = resolve("src/app/globals.css");
  styles = (await postcss([tailwind()]).process(await readFile(globalPath, "utf8"), { from: globalPath })).css +
    "\n" + (await Promise.all(componentCss.map(path => readFile(path, "utf8")))).join("\n");
  const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2");
  styles += "\n@font-face{font-family:Issue26Geist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:Issue26Geist}";
  assert.ok(!/@import\s/.test(styles));
  for (const match of styles.matchAll(/url\(([^)]*)\)/g)) assert.match(match[1]!.replaceAll(/["']/g, "").trim(), /^data:/);
});

const signatures: Record<Parameters<FinanceRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  finance_snapshot: { sql: "select public.finance_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  finance_revision: { sql: "select public.finance_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  finance_receipt: { sql: "select public.finance_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
  finance_commit: { sql: "select public.finance_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  transfer: { sql: "select public.transfer($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  pay_statement: { sql: "select public.pay_statement($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  create_series: { sql: "select public.create_series($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  close_account: { sql: "select public.close_account($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
};
const shiftDay = (day: string, offset: number) => new Date(Date.parse(day + "T12:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
function shiftMonth(day: string, offset: number) {
  const date = new Date(day + "T12:00:00Z"), d = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + offset);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(d, last)); return date.toISOString().slice(0, 10);
}
const monthDay = (month: string, day: number) => month.slice(0, 7) + "-" + String(day).padStart(2, "0");
const display = (cents: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
type Row = Record<string, unknown>;
const ledgerQueries = {
  accounts: "select to_jsonb(t) as row from public.fin_accounts t order by id",
  categories: "select to_jsonb(t) as row from public.fin_categories t order by id",
  tags: "select to_jsonb(t) as row from public.fin_tags t order by id",
  transactions: "select to_jsonb(t) as row from public.fin_transactions t order by id",
  transactionTags: "select to_jsonb(t) as row from public.fin_transaction_tags t order by user_id,transaction_id,tag_id",
  budgets: "select to_jsonb(t) as row from public.fin_budgets t order by id",
  events: "select to_jsonb(t) as row from public.domain_events t where entity_type like 'finance_%' order by id",
  receipts: "select to_jsonb(t) as row from app_private.command_receipts t where command like 'finance.%' order by user_id,command,client_id",
  revisions: "select to_jsonb(t) as row from app_private.finance_revisions t order by user_id",
  limits: "select to_jsonb(t) as row from app_private.rate_limits t order by scope,subject_hash",
};
export async function createFinanceSqlFixture(p: Product) {
  const db = await createLocalCanonicalSql();
  try {
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','finance-owner@example.invalid'),($2,'authenticated','authenticated','finance-foreign@example.invalid')", [owner, foreign]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)", [session, owner, foreignSession, foreign]);
    await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'conhecimento',false),($2,'conhecimento',false)", [owner, foreign]);
    assert.deepEqual((await db.query("select role from public.user_roles order by user_id")).rows, [{ role: "user" }, { role: "user" }]);
    const time = (await db.query<{ today: string; sqlTime: string }>("select to_char(current_timestamp at time zone 'America/Sao_Paulo','YYYY-MM-DD') as today, current_timestamp::text as \"sqlTime\"")).rows[0]!;
    assert.match(time.today, /^\d{4}-\d{2}-\d{2}$/); assert.ok(Number.isFinite(Date.parse(time.sqlTime)));
    // Tomorrow in UTC remains SQL's current civil day in São Paulo.
    const today = time.today, now = shiftDay(today, 1) + "T02:30:00.000Z", month = today.slice(0, 7) + "-01";
    let sequence = 20;
    const nextId = () => "62000000-0000-4000-8000-" + String(sequence++).padStart(12, "0");
    const deps = { clock: { now: () => now }, ids: { next: nextId } };
    const calls: { name: Parameters<FinanceRpc>[0]; actor: string; operation: FinanceOperation; status: unknown }[] = [];
    function gateway(operation: FinanceOperation, actor = owner, sid = session) {
      const rpc: FinanceRpc = async (name, args) => {
        const signature = signatures[name];
        assert.equal(args.p_user, actor); assert.equal(args.p_session, sid); assert.equal(args.p_operation, operation);
        assert.deepEqual(Object.keys(args).sort(), ["p_user", "p_session", "p_operation", ...signature.extra].sort());
        try {
          const result = await db.transaction(async tx => {
            await tx.exec("set local role service_role");
            return tx.query<{ data: unknown }>(signature.sql, [actor, sid, operation, ...signature.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]);
          });
          assert.equal(result.rows.length, 1); const data = result.rows[0]!.data;
          calls.push({ name, actor, operation, status: data && typeof data === "object" && "status" in data ? data.status : null });
          return { data, error: null };
        } catch (error) {
          if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") throw error;
          calls.push({ name, actor, operation, status: error.code }); return { data: null, error: { code: error.code } };
        }
      };
      return p.createFinanceGateway(actor, sid, operation, rpc);
    }
    async function command(value: unknown, actor = owner, sid = session) {
      const request = p.decodeFinanceRequest(value);
      return p.executeFinanceCommand(p.createFinanceStore(gateway(request.command, actor, sid)), deps, { user_id: actor, canal: "web" }, request);
    }
    async function account(name: string, opening = 0, card = false, actor = owner, sid = session) {
      return command({ command: "finance.account.create", input: { client_id: "setup-" + name, name, kind: card ? "credit_card" : "checking", institution: null,
        opening_balance_cents: opening, color_key: "fin-1", credit_limit_cents: card ? 500000 : null, statement_closing_day: card ? 20 : null, payment_due_day: card ? 25 : null } }, actor, sid) as Promise<ContaFinanceira>;
    }
    async function category(name: string) {
      return command({ command: "finance.category.create", input: { client_id: "category-" + name, name, kind: "expense", color_key: "fin-2" } }) as Promise<CategoriaFinanceira>;
    }
    async function transaction(account: ContaFinanceira, description: string, amount: number, patch: Partial<CamposLancamentoFinanceiro> = {}, actor = owner, sid = session) {
      return command({ command: "finance.transaction.create", input: { client_id: "seed-" + description, account_id: account.id, category_id: null, kind: "expense",
        amount_cents: amount, paid_cents: amount, description, payee: null, occurred_on: today, status: "confirmed", due_date: null, notes: null, tag_ids: [], ...patch } }, actor, sid) as Promise<LancamentoFinanceiro>;
    }
    async function ledger() {
      const result = {} as Record<keyof typeof ledgerQueries, Row[]>;
      for (const [key, sql] of Object.entries(ledgerQueries)) result[key as keyof typeof result] = (await db.query<{ row: Row }>(sql)).rows.map(value => value.row);
      return result;
    }
    async function persisted(id: string) {
      const rows = (await db.query<{ payload: LancamentoFinanceiro }>("select payload from public.fin_transactions where user_id=$1 and id=$2", [owner, id])).rows;
      assert.equal(rows.length, 1); return rows[0]!.payload;
    }
    async function balances() {
      return db.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner, role: "authenticated", session_id: session })]);
        await tx.exec("set local role authenticated");
        return (await tx.query<{ account_id: string; balance: string }>("select account_id,balance_cents::text as balance from public.fin_account_balances order by account_id")).rows;
      });
    }
    const other = await account("FOREIGN_FINANCE_SENTINEL", 990000, false, foreign, foreignSession);
    await transaction(other, "FOREIGN_FINANCE_TRANSACTION", 77777, {}, foreign, foreignSession);
    return { db, now, today, month, calls, nextId, gateway, command, account, category, transaction, ledger, persisted, balances, other };
  } catch (error) { await db.close(); throw error; }
}
type Fixture = Awaited<ReturnType<typeof createFinanceSqlFixture>>;
type Ledger = Awaited<ReturnType<Fixture["ledger"]>>;
type WriteEvent = { id: string; user_id: string; entity_type: string; entity_id: string; action: string; canal: string; before: unknown; after: unknown };
type Write = { request: FinanceRequest; result: unknown; events: WriteEvent[]; before: { id: string; payload: unknown }[] };
async function attach(page: Page, fixture: Fixture) {
  const trace = { reads: 0, writes: [] as Write[], unexpected: [] as string[], errors: [] as string[] };
  page.on("pageerror", error => trace.errors.push(error.message));
  await page.clock.install({ time: new Date(fixture.now) });
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json",
      headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }, body: JSON.stringify(body) });
    if (url.pathname === "/api/finance") {
      if (url.search || request.headers()["x-expected-user-id"] !== owner) { trace.unexpected.push("UNBOUND_REQUEST"); await route.abort(); return; }
      try {
        if (request.method() === "GET") { const data = await fixture.gateway("read.finance").presentation(); trace.reads++; await json(data); return; }
        if (request.method() === "POST" && request.headers().origin === origin && request.headers()["content-type"] === "application/json") {
          if (Buffer.byteLength(request.postData() ?? "") > 256 * 1024) throw new Error("Bounded JSON required.");
          const decoded = product.decodeFinanceRequest(request.postDataJSON());
          const priorIds = new Set((await fixture.db.query<{ id: string }>("select id from public.domain_events where user_id=$1 and entity_type like 'finance_%'", [owner])).rows.map(row => row.id));
          const before = (await fixture.db.query<{ id: string; payload: unknown }>("select id,payload from public.fin_accounts where user_id=$1 union all select id,payload from public.fin_transactions where user_id=$1", [owner])).rows;
          const result = await fixture.command(decoded);
          const events = (await fixture.db.query<WriteEvent>("select id,user_id,entity_type,entity_id,action,canal,before,after from public.domain_events where user_id=$1 and entity_type like 'finance_%' order by id", [owner])).rows.filter(row => !priorIds.has(row.id));
          trace.writes.push({ request: decoded, result, events, before }); await json({ ok: true, result }); return;
        }
      } catch (error) {
        // These are actual Gateway/Core refusals, never fabricated SQL success.
        if (error && typeof error === "object" && "code" in error && error.code === "forbidden") { await json({ code: "FORBIDDEN", message: "Operação indisponível." }, 403); return; }
        trace.unexpected.push("UNEXPECTED_BACKEND_FAILURE"); await route.abort(); return;
      }
      trace.unexpected.push("UNEXPECTED_API_REQUEST"); await route.abort(); return;
    }
    const allowedKeys = new Set(["tab", "month", "q", "kind", "account", "category", "status", "page", "sort", "dir"]);
    if (request.method() === "GET" && request.isNavigationRequest() && ["/", "/financeiro"].includes(url.pathname) &&
      (url.pathname === "/financeiro" || !url.search) && [...url.searchParams.keys()].every(key => allowedKeys.has(key))) {
      await route.fulfill({ contentType: "text/html", body: '<html lang="pt-BR"><body><div id="issue26-finance-sql"></div></body></html>' }); return;
    }
    trace.unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  return trace;
}
async function start(page: Page, path?: string) {
  if (path === undefined) await page.reload(); else await page.goto(origin + path);
  await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: browserBundle });
  await page.evaluate(userId => (globalThis as unknown as { __startIssue26FinanceSql(userId: string): void }).__startIssue26FinanceSql(userId), owner);
  await expect(page.locator("main")).toHaveAttribute("data-application-mode", "connected");
}
function region(page: Page) { return page.getByRole("region", { name: "Gestão financeira", exact: true }); }
async function reveal(page: Page) {
  await expect(region(page).getByRole("button", { name: "Exibir valores", exact: true })).toBeVisible();
  await region(page).getByRole("button", { name: "Exibir valores", exact: true }).click();
  await expect(region(page).getByRole("button", { name: "Ocultar valores", exact: true })).toBeVisible();
}
async function tab(page: Page, name: string) { await page.getByRole("navigation", { name: "Seções financeiras", exact: true }).getByRole("link", { name, exact: true }).click(); }
function rows(page: Page) { return region(page).locator(".ui-data-table tbody > tr"); }
async function search(page: Page, text: string) { await page.getByLabel("Buscar lançamentos", { exact: true }).fill(text); }
async function actions(page: Page, description: string) { await rows(page).filter({ hasText: description }).getByRole("button", { name: "Ações de " + description, exact: true }).click(); }
const amount = (card: Locator, label: string) => card.locator(".finance-detail-list > div").filter({ has: card.page().getByText(label, { exact: true }) }).locator("dd");
async function ownOnly(fixture: Fixture, page: Page, before: Ledger) {
  const after = await fixture.ledger();
  for (const key of Object.keys(before) as (keyof Ledger)[]) expect(after[key].filter(row => row.user_id === foreign)).toEqual(before[key].filter(row => row.user_id === foreign));
  await expect(page.locator("main")).not.toContainText(/FOREIGN_FINANCE_(SENTINEL|TRANSACTION)/);
  const snapshot = await fixture.gateway("read.finance").presentation();
  for (const collection of Object.values(snapshot)) expect(collection.every(row => row.user_id === owner)).toBe(true);
}
async function verifyWrites(fixture: Fixture, writes: Write[]) {
  for (const write of writes) {
    const receipt = (await fixture.db.query("select result from app_private.command_receipts where user_id=$1 and command=$2 and client_id=$3",
      [owner, write.request.command, write.request.input.client_id])).rows;
    expect(receipt).toEqual([{ result: write.result }]);
    const result = write.result as { id?: string; transactions?: LancamentoFinanceiro[]; charges?: LancamentoFinanceiro | null };
    const changed = result.transactions ? [...result.transactions, ...(result.charges ? [result.charges] : [])] : [write.result as ContaFinanceira | LancamentoFinanceiro];
    expect(write.events).toHaveLength(changed.length);
    const type = write.request.command === "finance.account.close" ? "finance_account" : "finance_transaction";
    const action = write.request.command.endsWith(".delete") || write.request.command === "finance.series.stop" ? "deleted" :
      write.request.command.endsWith(".restore") ? "restored" : write.request.command.endsWith(".update") || write.request.command === "finance.account.close" ? "updated" : "created";
    for (const row of changed) {
      const events = write.events.filter(event => event.entity_id === row.id);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ id: events[0]!.id, user_id: owner, entity_type: type, entity_id: row.id, action, canal: "web",
        before: write.before.find(old => old.id === row.id)?.payload ?? null, after: row });
      const sql = type === "finance_account" ? "select payload from public.fin_accounts where user_id=$1 and id=$2" : "select payload from public.fin_transactions where user_id=$1 and id=$2";
      // Later commands may update the row; each event above retains its exact
      // before/after while the current persisted identity must still exist.
      expect((await fixture.db.query(sql, [owner, row.id])).rows).toHaveLength(1);
    }
  }
}

test("Financeiro SQL deriva cinco estados, paga parcialmente e corrige órfão após reload", async ({ page }) => {
  test.setTimeout(120_000);
  const f = await createFinanceSqlFixture(product);
  try {
    const cash = await f.account("Caixa SQL", 100000), card = await f.account("Cartão SQL", 0, true), orphanCard = await f.account("Cartão histórico SQL", 0, true);
    const purchase = await f.transaction(card, "Compra SQL", 20000, { occurred_on: monthDay(f.month, 10), statement_month: f.month });
    // A declared historical metadata fixture: canonical trigger/constraints remain
    // active, but this legacy NULL assignment was not created by today's writer.
    const orphan: LancamentoFinanceiro = { ...purchase, id: f.nextId(), account_id: orphanCard.id, description: "Órfão SQL", amount_cents: 4000, paid_cents: 4000,
      occurred_on: monthDay(shiftMonth(f.month, -1), 5), statement_month: null };
    await f.db.query("insert into public.fin_transactions(payload) values($1::jsonb)", [JSON.stringify(orphan)]);
    expect((await f.db.query("select amount_cents::text as amount,is_paid,statement_month from public.fin_transactions where id=$1", [orphan.id])).rows).toEqual([{ amount: "4000", is_paid: true, statement_month: null }]);
    const baseline = await f.ledger(), trace = await attach(page, f), path = "/financeiro?tab=contas&month=" + f.month.slice(0, 7);
    for (const [day, label] of [[1, "Aberta"], [20, "Fechada"], [26, "Vencida"]] as const) {
      await page.clock.setFixedTime(new Date(monthDay(f.month, day) + "T15:00:00.000Z"));
      await start(page, path); await reveal(page);
      const regionCard = page.getByRole("region", { name: "Conta Cartão SQL", exact: true });
      await expect(regionCard.getByText(label, { exact: true })).toBeVisible();
      await expect(amount(regionCard, "Em aberto")).toContainText("200,00");
      expect(await f.ledger()).toEqual(baseline);
    }
    expect(trace.writes).toEqual([]);
    await page.clock.setFixedTime(new Date(monthDay(f.month, 21) + "T15:00:00.000Z"));
    await start(page, path); await reveal(page);
    const cardRegion = page.getByRole("region", { name: "Conta Cartão SQL", exact: true });
    await cardRegion.getByRole("button", { name: "Pagar fatura de Cartão SQL", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "Pagar fatura", exact: true });
    await dialog.getByLabel("Valor do pagamento (R$)", { exact: true }).fill("50,00");
    await dialog.getByLabel("Conta para pagar a fatura", { exact: true }).selectOption(cash.id);
    await dialog.getByLabel("Data do pagamento", { exact: true }).fill(monthDay(f.month, 21));
    await dialog.getByText("Juros e IOF opcionais", { exact: true }).click();
    await dialog.getByLabel("Taxa mensal de juros (%)", { exact: true }).fill("10");
    await dialog.getByLabel("IOF (R$)", { exact: true }).fill("2,05");
    await dialog.getByRole("button", { name: "Registrar pagamento", exact: true }).click(); await expect(dialog).toBeHidden();
    await expect(cardRegion.getByText("Parcialmente paga", { exact: true })).toBeVisible();
    await expect(amount(cardRegion, "Pago na fatura")).toContainText("50,00"); await expect(amount(cardRegion, "Em aberto")).toContainText("150,00");
    expect(trace.writes).toHaveLength(1); expect(trace.writes[0]!.request.command).toBe("finance.statement.pay");
    const payments = (await f.db.query<{ payload: LancamentoFinanceiro }>("select payload from public.fin_transactions where user_id=$1 and transfer_group_id is not null order by kind", [owner])).rows.map(row => row.payload);
    expect(payments).toHaveLength(2); expect(payments.map(row => [row.kind, row.amount_cents, row.paid_cents])).toEqual([["expense", 5000, 5000], ["income", 5000, 5000]]);
    expect(payments[0]!.transfer_group_id).toBe(payments[1]!.transfer_group_id);
    const charges = (await f.db.query<{ payload: LancamentoFinanceiro }>("select payload from public.fin_transactions where user_id=$1 and description='Juros e IOF da fatura'", [owner])).rows.map(row => row.payload);
    expect(charges).toHaveLength(1); expect(charges[0]).toMatchObject({ account_id: card.id, amount_cents: 1705, paid_cents: 1705, statement_month: shiftMonth(f.month, 1), transfer_group_id: null });
    expect((await f.balances()).map(row => [row.account_id, Number(row.balance)]).sort()).toEqual([[cash.id, 95000], [card.id, -16705], [orphanCard.id, -4000]].sort());
    // View is authenticated/RLS; this independent sum reads installed columns.
    const sum = (await f.db.query<{ balance: string }>("select (a.opening_balance_cents+coalesce(sum(case when t.kind='income' then 1 else -1 end * case when a.kind='credit_card' then t.amount_cents else t.paid_cents end),0))::text as balance from public.fin_accounts a left join public.fin_transactions t on t.user_id=a.user_id and t.account_id=a.id and t.deleted_at is null and t.status in ('confirmed','reconciled') where a.user_id=$1 and a.id=$2 group by a.id", [owner, card.id])).rows;
    expect(sum).toEqual([{ balance: "-16705" }]);
    await start(page); await reveal(page); await expect(amount(cardRegion, "Em aberto")).toContainText("150,00");
    await page.getByLabel("Competência selecionada", { exact: true }).fill(shiftMonth(f.month, 1).slice(0, 7));
    await expect(amount(cardRegion, "Compras da fatura")).toContainText("17,05");
    await page.getByLabel("Competência selecionada", { exact: true }).fill(f.month.slice(0, 7));
    await cardRegion.getByRole("button", { name: "Pagar fatura de Cartão SQL", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Pagar fatura", exact: true });
    await dialog.getByRole("button", { name: "Usar valor total em aberto", exact: true }).click();
    await expect(dialog.getByLabel("Valor do pagamento (R$)", { exact: true })).toHaveValue("150,00");
    await dialog.getByLabel("Conta para pagar a fatura", { exact: true }).selectOption(cash.id);
    await dialog.getByRole("button", { name: "Registrar pagamento", exact: true }).click(); await expect(dialog).toBeHidden();
    await expect(cardRegion.getByText("Paga", { exact: true })).toBeVisible(); await expect(amount(cardRegion, "Em aberto")).toContainText("0,00");
    expect((await f.balances()).map(row => [row.account_id, Number(row.balance)]).sort()).toEqual([[cash.id, 80000], [card.id, -1705], [orphanCard.id, -4000]].sort());
    await region(page).getByText("Definir competência dos lançamentos de cartão (1)", { exact: true }).click();
    await page.getByRole("button", { name: "Definir competência de Órfão SQL", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Definir competência da fatura", exact: true });
    const orphanMonth = shiftMonth(f.month, -1);
    await dialog.getByLabel("Competência da fatura", { exact: true }).fill(orphanMonth.slice(0, 7));
    await dialog.getByRole("button", { name: "Salvar competência", exact: true }).click(); await expect(dialog).toBeHidden();
    expect(await f.persisted(orphan.id)).toEqual({ ...orphan, statement_month: orphanMonth });
    await start(page); await reveal(page); await expect(page.getByText("Definir competência dos lançamentos de cartão (1)", { exact: true })).toHaveCount(0);
    const finished = await f.ledger();
    await expect(f.gateway("read.finance", owner, foreignSession).snapshot()).rejects.toMatchObject({ code: "forbidden" });
    expect(f.calls.at(-1)?.status).toBe("42501"); expect(await f.ledger()).toEqual(finished);
    await verifyWrites(f, trace.writes); await ownOnly(f, page, baseline);
    expect(trace.writes.map(write => write.request.command)).toEqual(["finance.statement.pay", "finance.statement.pay", "finance.transaction.update"]);
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await f.db.close(); }
});

test("Financeiro SQL transfere, arquiva preservando histórico e rateia/encerra séries reais", async ({ page }) => {
  test.setTimeout(120_000);
  const f = await createFinanceSqlFixture(product);
  try {
    const cash = await f.account("Caixa SQL", 100000), reserve = await f.account("Reserva SQL", 200000), card = await f.account("Cartão SQL", 0, true);
    const baseline = await f.ledger(), trace = await attach(page, f);
    await start(page, "/financeiro?month=" + f.month.slice(0, 7)); await reveal(page);
    await region(page).getByRole("button", { name: "Transferir", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "Transferir entre contas", exact: true });
    await dialog.getByLabel("Descrição da transferência", { exact: true }).fill("Transferência SQL");
    await dialog.getByLabel("Conta de origem", { exact: true }).selectOption(cash.id); await dialog.getByLabel("Conta de destino", { exact: true }).selectOption(reserve.id);
    await dialog.getByLabel("Valor da transferência (R$)", { exact: true }).fill("50,00");
    await dialog.getByRole("button", { name: "Registrar transferência", exact: true }).click(); await expect(dialog).toBeHidden();
    await search(page, "Transferência SQL"); await expect(rows(page)).toHaveCount(2);
    const legs = (await f.db.query<{ payload: LancamentoFinanceiro }>("select payload from public.fin_transactions where user_id=$1 order by id", [owner])).rows.map(row => row.payload);
    expect(legs).toHaveLength(2); expect(legs.map(row => row.amount_cents)).toEqual([5000, 5000]); expect(legs[0]!.transfer_group_id).toBe(legs[1]!.transfer_group_id);
    await expect(page.getByLabel("Totais realizados do recorte", { exact: true })).toContainText("0,00");
    expect((await f.balances()).map(row => [row.account_id, Number(row.balance)]).sort()).toEqual([[cash.id, 95000], [reserve.id, 205000], [card.id, 0]].sort());
    await tab(page, "Contas"); await page.getByRole("button", { name: "Arquivar conta Reserva SQL", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Arquivar conta", exact: true });
    await dialog.getByRole("button", { name: "Arquivar conta", exact: true }).click(); await expect(dialog).toBeHidden();
    await expect(page.getByRole("region", { name: "Conta Reserva SQL", exact: true })).toHaveCount(0);
    expect((await f.db.query<{ payload: LancamentoFinanceiro }>("select payload from public.fin_transactions where user_id=$1 order by id", [owner])).rows.map(row => row.payload)).toEqual(legs);
    expect((await f.balances()).map(row => [row.account_id, Number(row.balance)]).sort()).toEqual([[cash.id, 95000], [reserve.id, 205000], [card.id, 0]].sort());
    await expect(page.getByRole("region", { name: "Conta Caixa SQL", exact: true }).locator(".finance-kpi")).toContainText("950,00");
    const afterArchive = await f.ledger();
    await start(page); await reveal(page); expect(await f.ledger()).toEqual(afterArchive);
    await page.getByText("Contas arquivadas (1)", { exact: true }).click(); await page.getByRole("button", { name: "Ver histórico de Reserva SQL", exact: true }).click();
    await search(page, "Transferência SQL"); await expect(rows(page)).toHaveCount(1);
    await page.getByLabel("Filtrar conta", { exact: true }).selectOption(""); await expect(rows(page)).toHaveCount(2);
    await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Novo lançamento", exact: true });
    await dialog.getByLabel("Descrição", { exact: true }).fill("Doze parcelas SQL"); await dialog.getByLabel("Valor (R$)", { exact: true }).fill("100,01");
    await dialog.getByLabel("Conta", { exact: true }).selectOption(card.id);
    await dialog.getByLabel("Data da movimentação", { exact: true }).fill(monthDay(f.month, 10));
    await dialog.getByLabel("Frequência do lançamento", { exact: true }).selectOption("parcelamento");
    await dialog.getByLabel("Número de parcelas", { exact: true }).fill("12");
    await dialog.getByText("Vencimento e detalhes", { exact: true }).click(); await dialog.getByLabel("Competência da fatura", { exact: true }).fill(f.month.slice(0, 7));
    await dialog.getByRole("button", { name: "Criar lançamento", exact: true }).click(); await expect(dialog).toBeHidden();
    const parts = (await f.db.query<{ amount: string; paid: string; is_paid: boolean; no: number; statement: string; group_id: string }>("select amount_cents::text as amount,paid_cents::text as paid,is_paid,installment_no as no,to_char(statement_month,'YYYY-MM-DD') as statement,installment_group_id as group_id from public.fin_transactions where user_id=$1 and description='Doze parcelas SQL' order by installment_no", [owner])).rows;
    expect(parts).toHaveLength(12); expect(parts.map(row => Number(row.amount))).toEqual([...Array<number>(11).fill(833), 838]);
    expect(parts.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(10001); expect(new Set(parts.map(row => row.group_id)).size).toBe(1);
    expect(parts.map(row => row.no)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(parts.map(row => row.statement)).toEqual(Array.from({ length: 12 }, (_, i) => shiftMonth(f.month, i)));
    expect(parts.every(row => row.is_paid && row.amount === row.paid)).toBe(true);
    await search(page, "Doze parcelas SQL"); await expect(rows(page)).toContainText("Parcela 1 de 12"); await expect(rows(page)).toContainText("8,33");
    await page.getByLabel("Competência selecionada", { exact: true }).fill(shiftMonth(f.month, 11).slice(0, 7));
    await expect(rows(page)).toContainText("Parcela 12 de 12"); await expect(rows(page)).toContainText("8,38");
    await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Novo lançamento", exact: true });
    await dialog.getByLabel("Descrição", { exact: true }).fill("Recorrência SQL"); await dialog.getByLabel("Valor (R$)", { exact: true }).fill("50,00");
    await dialog.getByLabel("Conta", { exact: true }).selectOption(cash.id);
    await dialog.getByLabel("Data da movimentação", { exact: true }).fill(shiftMonth(f.month, -1));
    await dialog.getByLabel("Frequência do lançamento", { exact: true }).selectOption("recorrencia");
    await dialog.getByLabel("Número de ocorrências", { exact: true }).fill("4"); await dialog.getByLabel("Já pago (R$)", { exact: true }).fill("50,00");
    await dialog.getByRole("button", { name: "Criar lançamento", exact: true }).click(); await expect(dialog).toBeHidden();
    const series = (await f.db.query<{ payload: LancamentoFinanceiro }>("select payload from public.fin_transactions where user_id=$1 and description='Recorrência SQL' order by installment_no", [owner])).rows.map(row => row.payload);
    expect(series).toHaveLength(4); expect(series[0]!.paid_cents).toBe(5000); expect(series.slice(1).every(row => row.paid_cents === 0 && row.status === "planned")).toBe(true);
    // Explicit metadata history: no GUI writer for paying one linked occurrence
    // is claimed. This independently exercises preservation of a future payment.
    const paidFuture = { ...series[3]!, paid_cents: 5000, status: "confirmed" as const };
    await f.db.query("update public.fin_transactions set payload=$1::jsonb where user_id=$2 and id=$3", [JSON.stringify(paidFuture), owner, paidFuture.id]);
    const beforeStop = await f.ledger();
    const cutoff = (await f.db.query<{ day: string }>("select to_char(current_timestamp at time zone 'America/Sao_Paulo','YYYY-MM-DD') as day")).rows[0]!.day;
    expect(cutoff).toBe(f.today);
    const eligible = (await f.db.query<{ id: string }>("select id from public.fin_transactions where user_id=$1 and installment_group_id=$2 and deleted_at is null and occurred_on >= $3::date and paid_cents=0 order by id", [owner, series[0]!.installment_group_id, cutoff])).rows.map(row => row.id);
    expect(eligible.length).toBeGreaterThan(0);
    await start(page, "/financeiro?tab=lancamentos&month=" + shiftMonth(f.month, 1).slice(0, 7)); await reveal(page);
    await search(page, "Recorrência SQL"); await actions(page, "Recorrência SQL");
    await page.getByRole("button", { name: "Encerrar recorrência", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Encerrar recorrência", exact: true });
    await dialog.getByLabel("Encerrar a partir de", { exact: true }).fill(cutoff);
    await dialog.getByRole("button", { name: "Encerrar ocorrências futuras", exact: true }).click(); await expect(dialog).toBeHidden();
    const afterSeries = (await f.db.query<{ payload: LancamentoFinanceiro }>("select payload from public.fin_transactions where user_id=$1 and description='Recorrência SQL' order by installment_no", [owner])).rows.map(row => row.payload);
    for (const row of afterSeries) {
      const prior = beforeStop.transactions.find(value => value.id === row.id)!.payload as LancamentoFinanceiro;
      expect(row).toEqual(eligible.includes(row.id) ? { ...prior, deleted_at: f.now, updated_at: f.now } : prior);
    }
    expect(afterSeries[0]).toEqual(series[0]); expect(afterSeries[3]).toEqual(paidFuture);
    await start(page); await reveal(page); await search(page, "Recorrência SQL"); await expect(rows(page)).toHaveCount(0);
    await page.getByLabel("Competência selecionada", { exact: true }).fill(shiftMonth(f.month, -1).slice(0, 7)); await expect(rows(page)).toHaveCount(1);
    await verifyWrites(f, trace.writes); await ownOnly(f, page, baseline);
    expect(trace.writes.map(write => write.request.command)).toEqual(["finance.transfer.create", "finance.account.close", "finance.series.create", "finance.series.create", "finance.series.stop"]);
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await f.db.close(); }
});

async function metrics(locator: Locator, income: number, expense: number, balance: number) {
  for (const [label, value] of [["Entradas", income], ["Saídas", expense], ["Resultado", balance]] as const) {
    await expect(locator.locator("div").filter({ has: locator.page().getByText(label, { exact: true }) }).locator("dd")).toContainText(display(value));
  }
}
test("Financeiro SQL mantém URL/coerência, avisa duplicidade sob máscara e Desfazer real em oito segundos", async ({ page }) => {
  test.setTimeout(120_000);
  const f = await createFinanceSqlFixture(product);
  try {
    const cash = await f.account("Caixa SQL", 100000), card = await f.account("Cartão SQL", 0, true), category = await f.category("Despesas SQL");
    const tagged = await f.command({ command: "finance.tag.create", input: { client_id: "setup-tag", name: "Etiqueta SQL", color_key: "fin-2" } }) as { id: string };
    for (let i = 0; i < 7; i++) await f.transaction(cash, "Recorte SQL " + String.fromCharCode(65 + i), 1000 + i, { category_id: category.id });
    await f.transaction(cash, "Entrada SQL", 20000, { kind: "income" });
    await f.transaction(cash, "Estorno SQL", 300, { kind: "income", category_id: category.id });
    await f.transaction(card, "Cartão mensal SQL", 2500, { category_id: category.id, statement_month: f.month });
    const original = await f.transaction(cash, "Cópia SQL", 12550, { category_id: category.id, tag_ids: [tagged.id], notes: "Conteúdo preservado SQL", payee: "Destino SQL" });
    for (const [state, amount] of [["planned", 900], ["pending", 800], ["cancelled", 700]] as const) await f.transaction(cash, state + " SQL", amount, { status: state, paid_cents: 0 });
    const trash = await f.transaction(cash, "Lixeira SQL", 600);
    await f.command({ command: "finance.transaction.delete", input: { id: trash.id, client_id: "setup-trash" } });
    await f.transaction(cash, "Outro mês SQL", 111, { occurred_on: shiftMonth(f.today, -1) });
    const baseline = await f.ledger(), trace = await attach(page, f);
    // A real SQL entitlement refusal, with real error/retry UI. Only this fixture
    // metadata changes; the financial ledger remains the baseline.
    await f.db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'financeiro',false)", [owner]);
    await start(page, "/financeiro?tab=lancamentos&month=" + f.month.slice(0, 7));
    await expect(page.getByRole("heading", { name: "Não foi possível carregar o financeiro", exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("Você não tem acesso");
    expect(await f.ledger()).toEqual(baseline); expect(f.calls.at(-1)?.status).toBe("42501");
    await f.db.query("delete from public.user_entitlements where user_id=$1 and feature_key='financeiro'", [owner]);
    await page.getByRole("button", { name: "Tentar novamente", exact: true }).click(); await reveal(page);
    await search(page, "Cópia SQL"); await actions(page, "Cópia SQL");
    await page.getByRole("button", { name: "Duplicar lançamento", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Duplicar lançamento", exact: true });
    await dialog.getByLabel("Data da cópia", { exact: true }).fill(f.today); await dialog.getByRole("button", { name: "Criar cópia", exact: true }).click(); await expect(dialog).toBeHidden();
    await search(page, "Cópia SQL"); await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).getByText("Possível duplicidade", { exact: true })).toHaveCount(2);
    const copy = trace.writes[0]!.result as LancamentoFinanceiro;
    expect(copy.id).not.toBe(original.id); expect(copy).toEqual({ ...original, id: copy.id });
    await region(page).locator('[data-row-id="' + original.id + '"]:visible').getByRole("button", { name: "Ações de Cópia SQL", exact: true }).click();
    await page.getByRole("button", { name: "Editar lançamento", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Editar lançamento", exact: true });
    await expect(editor.getByRole("status").filter({ hasText: "Há um lançamento semelhante" })).toBeVisible();
    await editor.getByText("Vencimento e detalhes", { exact: true }).click();
    await editor.getByLabel("Observações", { exact: true }).fill("Comentário revisto SQL");
    await expect(editor.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
    await editor.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(editor).toBeHidden();
    expect(await f.persisted(original.id)).toEqual({ ...original, notes: "Comentário revisto SQL" });
    await search(page, "Cópia SQL"); await expect(rows(page)).toHaveCount(2);
    await region(page).getByRole("button", { name: "Ocultar valores", exact: true }).click();
    for (const name of ["Painel", "Lançamentos", "Contas", "Categorias", "Orçamentos"]) {
      await tab(page, name);
      const visible = await region(page).locator(".finance-money").allTextContents();
      expect(visible.length).toBeGreaterThan(0); expect(visible.every(value => value === "R$ ••••")).toBe(true);
      await expect(region(page).locator(".finance-line,.finance-donut,[aria-valuenow],[aria-valuetext]")).toHaveCount(0);
    }
    expect(await page.evaluate(() => localStorage.getItem("segundo-cerebro:demo:values-hidden:v1"))).toBe("1");
    expect(new URL(page.url()).searchParams.has("valuesHidden")).toBe(false);
    await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Exibir valores para editar?", exact: true })).toBeVisible();
    await expect(page.getByLabel("Valor (R$)", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.getByRole("navigation", { name: "Rotas da prova financeira", exact: true }).getByRole("link", { name: "Início", exact: true }).click();
    await expect(page.getByRole("region", { name: "Pulso financeiro", exact: true })).toContainText("R$ ••••");
    await page.getByRole("navigation", { name: "Rotas da prova financeira", exact: true }).getByRole("link", { name: "Financeiro", exact: true }).click();
    await region(page).getByRole("button", { name: "Exibir valores", exact: true }).click(); await tab(page, "Lançamentos"); await search(page, "Cópia SQL");
    const beforeDelete = await f.persisted(copy.id);
    async function removeCopy() {
      // ID comes from the independently persisted copy, never ambiguous text order.
      await region(page).locator('[data-row-id="' + copy.id + '"]:visible').getByRole("button", { name: "Ações de Cópia SQL", exact: true }).click();
      await page.getByRole("button", { name: "Excluir lançamento", exact: true }).click();
      const confirmation = page.getByRole("dialog", { name: "Mover lançamento para a lixeira?", exact: true });
      await confirmation.getByRole("button", { name: "Mover para a lixeira", exact: true }).click(); await expect(confirmation).toBeHidden();
    }
    await removeCopy(); await expect(rows(page)).toHaveCount(1);
    expect(await f.persisted(copy.id)).toEqual({ ...beforeDelete, deleted_at: f.now });
    await search(page, "Cópia SQL"); await page.getByLabel("Buscar lançamentos", { exact: true }).focus(); await page.mouse.move(0, 0);
    await page.clock.runFor(7000); await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    await expect(page.getByText("Lançamento restaurado.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Buscar lançamentos", { exact: true })).toHaveValue("");
    expect(new URL(page.url()).searchParams.has("q")).toBe(false);
    await search(page, "Cópia SQL");
    await expect(rows(page)).toHaveCount(2); expect(await f.persisted(copy.id)).toEqual(beforeDelete);
    const deletedRestored = (await f.db.query<{ action: string; before: unknown; after: unknown }>("select action,before,after from public.domain_events where user_id=$1 and entity_id=$2 and action in ('deleted','restored') order by case action when 'deleted' then 1 else 2 end", [owner, copy.id])).rows;
    expect(deletedRestored).toEqual([{ action: "deleted", before: beforeDelete, after: { ...beforeDelete, deleted_at: f.now } }, { action: "restored", before: { ...beforeDelete, deleted_at: f.now }, after: beforeDelete }]);
    await page.clock.runFor(300); await removeCopy(); await expect(rows(page)).toHaveCount(1);
    await page.getByLabel("Buscar lançamentos", { exact: true }).focus(); await page.mouse.move(0, 0);
    await page.clock.runFor(8400); await expect(page.getByRole("button", { name: "Desfazer", exact: true })).toHaveCount(0);
    expect((await f.persisted(copy.id)).deleted_at).toBe(f.now);
    await page.getByLabel("Filtrar estado", { exact: true }).selectOption("trash"); await actions(page, "Cópia SQL");
    await page.getByRole("button", { name: "Restaurar lançamento", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Detalhes do lançamento", exact: true })).toBeHidden(); expect(await f.persisted(copy.id)).toEqual(beforeDelete);
    await page.getByLabel("Filtrar tipo", { exact: true }).selectOption("expense"); await page.getByLabel("Filtrar conta", { exact: true }).selectOption(cash.id);
    await page.getByLabel("Filtrar categoria", { exact: true }).selectOption(category.id); await page.getByLabel("Filtrar estado", { exact: true }).selectOption("confirmed");
    await search(page, "recorte"); await page.getByLabel("Ordenar por", { exact: true }).selectOption("description");
    await page.getByRole("button", { name: "Próxima página", exact: true }).click();
    const oracle = (await f.db.query<{ id: string; amount: string }>("select id,amount_cents::text as amount from public.fin_transactions where user_id=$1 and account_id=$2 and category_id=$3 and deleted_at is null and status='confirmed' and kind='expense' and transfer_group_id is null and date_trunc('month',occurred_on)::date=$4::date and description ilike '%recorte%' order by description,id", [owner, cash.id, category.id, f.month])).rows;
    expect(oracle).toHaveLength(7); expect(oracle.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(7021);
    const expectedIds = oracle.slice(5).map(row => row.id);
    const ids = () => rows(page).evaluateAll(values => values.map(value => value.getAttribute("data-row-id")));
    await expect.poll(ids).toEqual(expectedIds);
    const url = page.url(); expect(Object.fromEntries(new URL(url).searchParams)).toMatchObject({ q: "recorte", kind: "expense", account: cash.id, category: category.id, status: "confirmed", page: "2", sort: "description", dir: "asc" });
    await metrics(page.getByLabel("Totais realizados do recorte", { exact: true }), 0, 7021, -7021);
    await start(page); await reveal(page); expect(page.url()).toBe(url); await expect.poll(ids).toEqual(expectedIds);
    await expect(page.getByLabel("Buscar lançamentos", { exact: true })).toHaveValue("recorte");
    await metrics(page.getByLabel("Totais realizados do recorte", { exact: true }), 0, 7021, -7021);
    await tab(page, "Painel"); await metrics(page.getByRole("region", { name: "Realizado na competência", exact: true }).locator("dl"), 0, 7021, -7021);
    // The common Home slice is CURRENT MONTH + ALL rows, not arbitrary URL filters.
    await start(page, "/financeiro?tab=lancamentos&month=" + f.month.slice(0, 7)); await reveal(page);
    const total = (await f.db.query<{ income: string; expense: string }>("select coalesce(sum(t.amount_cents) filter(where t.kind='income'),0)::text as income,coalesce(sum(t.amount_cents) filter(where t.kind='expense'),0)::text as expense from public.fin_transactions t join public.fin_accounts a on a.user_id=t.user_id and a.id=t.account_id where t.user_id=$1 and t.deleted_at is null and t.status in ('confirmed','reconciled') and t.transfer_group_id is null and case when a.kind='credit_card' then t.statement_month else date_trunc('month',t.occurred_on)::date end=$2::date", [owner, f.month])).rows[0]!;
    expect(total).toEqual({ income: "20300", expense: "34621" });
    await metrics(page.getByLabel("Totais realizados do recorte", { exact: true }), 20300, 34621, -14321);
    await tab(page, "Painel"); await metrics(page.getByRole("region", { name: "Realizado na competência", exact: true }).locator("dl"), 20300, 34621, -14321);
    await page.getByRole("navigation", { name: "Rotas da prova financeira", exact: true }).getByRole("link", { name: "Início", exact: true }).click();
    const pulse = page.getByRole("region", { name: "Pulso financeiro", exact: true });
    for (const [label, cents] of [["Resultado do mês", -14321], ["Entradas", 20300], ["Saídas", 34621]] as const) await expect(pulse.locator(".home-money > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd")).toContainText(display(cents));
    const finished = await f.ledger();
    await expect(f.command({ command: "finance.transaction.create", input: { client_id: "foreign-reference", account_id: f.other.id, category_id: null, kind: "expense", amount_cents: 100, paid_cents: 100, description: "Rejected foreign reference", payee: null, occurred_on: f.today, status: "confirmed", due_date: null, notes: null } })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await f.ledger()).toEqual(finished);
    await verifyWrites(f, trace.writes); await ownOnly(f, page, baseline);
    expect(trace.writes.map(write => write.request.command)).toEqual(["finance.transaction.duplicate", "finance.transaction.update", "finance.transaction.delete", "finance.transaction.restore", "finance.transaction.delete", "finance.transaction.restore"]);
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await f.db.close(); }
});
