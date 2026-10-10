/** Real Habits UI/provider/client -> explicit bound public HTTP seam -> actual
 * Core/Gateway/Store and all canonical migrations in disposable SQL. Auth
 * catalogue/routing are fixtures; no Next handler, SDK, GoTrue, production,
 * physical device or visual-comparison acceptance is claimed. Linux CI only. */
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { createHabitSqlFixture, habitOwner, habitForeign, habitForeignSession, loadHabitProduct, shiftCivil, type HabitProduct, type HabitSqlFixture } from "./helpers/issue30-habits-sql";
import type { MarcacaoHabito, PausaDoUsuario } from "../../src/core/contracts/modules";

const origin = "https://issue30-habits-sql.test";
let product: HabitProduct, browserBundle: string, styles: string;
const originalTimezone = process.env.TZ;
test.use({ timezoneId: "UTC" });
const componentCss = ["src/components/ui/button.css", "src/components/ui/field.css", "src/components/ui/card.css", "src/components/ui/dialog.css",
  "src/components/ui/data-display.css", "src/components/ui/toast.css", "src/components/layout/related-panel.css", "src/components/features/habitos/habits.css"];

test.beforeAll(async () => {
  process.env.TZ = "UTC";
  expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  product = await loadHabitProduct();
  const navigation = resolve("tests/e2e/fixtures/issue30-habits-navigation.tsx").replaceAll("\\", "/"), importedCss = new Set<string>();
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/issue30-habits-browser.tsx"), platform: "browser", tsconfig: false,
    resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "issue30-routing-and-canonical-css", resolveId(source, importer) {
      if (source.endsWith(".css")) {
        if (!importer || !source.startsWith(".")) throw new Error("Only canonical relative CSS is allowed.");
        importedCss.add(resolve(dirname(importer), source)); return "\0issue30-css";
      }
      if (source === "next/link") return "\0issue30-link";
    }, load(id) {
      if (id === "\0issue30-css") return "export {};";
      if (id === "\0issue30-link") return `export { NavigationLink as default } from ${JSON.stringify(navigation)};`;
    } }],
  });
  try {
    const { output } = await build.generate({ format: "iife", codeSplitting: false });
    if (output.length !== 1 || output[0]?.type !== "chunk" || output[0].imports.length || output[0].dynamicImports.length) throw new Error("Standalone Habits browser bundle is required.");
    browserBundle = output[0].code;
  } finally { await build.close(); }
  expect([...importedCss].sort()).toEqual(componentCss.map(path => resolve(path)).sort());
  const globalPath = resolve("src/app/globals.css");
  styles = (await postcss([tailwind()]).process(await readFile(globalPath, "utf8"), { from: globalPath })).css + "\n" + (await Promise.all(componentCss.map(path => readFile(path, "utf8")))).join("\n");
  const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2");
  styles += `\n@font-face {font-family:Issue30Geist;src:url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");font-style:normal;font-weight:100 900} :root {--font-geist-sans:Issue30Geist}`;
  expect(styles).not.toMatch(/@import\s/);
  for (const match of styles.matchAll(/url\(([^)]*)\)/g)) expect(match[1]!.replaceAll(/["']/g, "").trim()).toMatch(/^data:/);
});
test.afterAll(() => { if (originalTimezone === undefined) delete process.env.TZ; else process.env.TZ = originalTimezone; });

async function attach(page: Page, fixture: HabitSqlFixture) {
  const trace = { reads: 0, writes: [] as { command: string; clientId: string; result: unknown }[], unexpected: [] as string[], errors: [] as string[] };
  page.on("pageerror", error => trace.errors.push(error.message));
  await page.clock.setFixedTime(new Date(fixture.now));
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    if (url.pathname === "/api/projects-habits") {
      if (request.headers()["x-expected-user-id"] !== habitOwner) { trace.unexpected.push("UNBOUND_OWNER"); await route.abort(); return; }
      const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0" }, body: JSON.stringify(body) });
      if (request.method() === "GET" && url.searchParams.size === 1 && url.searchParams.get("domain") === "habits") {
        const state = await fixture.gateway("read.habits").snapshot(); trace.reads++;
        // Same DTO projection as GET; this is explicitly not the Next handler.
        await json({ items: state.habits, entries: state.entries, pauses: state.pauses }); return;
      }
      if (request.method() === "POST" && !url.search && request.headers().origin === origin && request.headers()["content-type"] === "application/json") {
        const command = product.decodeRoutineRequest(request.postDataJSON());
        if (!command.command.startsWith("habit.")) { trace.unexpected.push("FOREIGN_COMMAND"); await route.abort(); return; }
        const result = await fixture.command(command);
        trace.writes.push({ command: command.command, clientId: command.input.client_id, result });
        await json({ ok: true, result }); return;
      }
      trace.unexpected.push("UNEXPECTED_API_REQUEST"); await route.abort(); return;
    }
    if (request.isNavigationRequest() && request.method() === "GET" && url.pathname === "/habitos" && !url.search) {
      await route.fulfill({ contentType: "text/html", body: '<html lang="pt-BR"><body><div id="issue30-habits-fixture"></div></body></html>' }); return;
    }
    trace.unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  return trace;
}
async function start(page: Page, reload = false) {
  if (reload) await page.reload(); else await page.goto(origin + "/habitos");
  await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: browserBundle });
  await page.evaluate(userId => {
    const start = (globalThis as unknown as { __startIssue30HabitsFixture(userId: string): void }).__startIssue30HabitsFixture;
    start(userId);
  }, habitOwner);
  await expect(page.getByRole("heading", { name: "Hoje", exact: true })).toBeVisible();
}
function row(page: Page, name: string) { return page.locator(".habits-today li").filter({ has: page.getByText(name, { exact: true }) }); }
async function dates(fixture: HabitSqlFixture, habitId: string) {
  return (await fixture.db.query<{ day: string }>("select to_char(done_on,'YYYY-MM-DD') as day from public.habit_entries where user_id=$1 and habit_id=$2 order by done_on", [habitOwner, habitId])).rows.map(value => value.day);
}
async function verifyWrites(fixture: HabitSqlFixture, writes: Awaited<ReturnType<typeof attach>>["writes"]) {
  // Independent SQL, not the presentation DTO, is the acknowledgement oracle.
  for (const write of writes) {
    const receipts = (await fixture.db.query<{ result: unknown }>("select result from app_private.command_receipts where user_id=$1 and command=$2 and client_id=$3", [habitOwner, write.command, write.clientId])).rows;
    expect(receipts).toEqual([{ result: write.result }]);
    if (write.command === "habit.mark") {
      const entry = write.result as MarcacaoHabito;
      const persisted = (await fixture.db.query<{ payload: MarcacaoHabito }>("select payload from public.habit_entries where user_id=$1 and id=$2", [habitOwner, entry.id])).rows;
      expect(persisted).toEqual([{ payload: entry }]);
      const events = (await fixture.db.query("select entity_type,action,canal,before,after from public.domain_events where user_id=$1 and entity_id=$2", [habitOwner, entry.id])).rows;
      expect(events).toEqual([{ entity_type: "habit_entry", action: "created", canal: "web", before: null, after: entry }]);
    } else if (write.command === "habit.pause.create") {
      const pause = write.result as PausaDoUsuario;
      const events = (await fixture.db.query<{ entity_type: string; action: string; canal: string; before: unknown; after: unknown }>("select entity_type,action,canal,before,after from public.domain_events where user_id=$1 and entity_id=$2 order by occurred_at,id", [habitOwner, pause.id])).rows;
      expect(events.filter(event => event.action === "created")).toEqual([{ entity_type: "habit_pause", action: "created", canal: "web", before: null, after: pause }]);
    }
  }
}

test("Hábitos preserva 230 dias de sequência além das 182 células e recarrega do SQL", async ({ page }) => {
  const fixture = await createHabitSqlFixture(product);
  try {
    const habit = await fixture.habit("Sequência SQL longa", shiftCivil(fixture.today, -229));
    const history = Array.from({ length: 229 }, (_, index) => shiftCivil(fixture.today, index - 229));
    await fixture.seedHistory(habit, history);
    const foreign = await fixture.habit("FOREIGN_HABIT_SENTINEL", fixture.today, 0, habitForeign, habitForeignSession);
    await fixture.command({ command: "habit.mark", input: { habit_id: foreign.id, done_on: fixture.today, done: true, client_id: "foreign-mark" } }, habitForeign, habitForeignSession);
    const before = await fixture.ledger(), trace = await attach(page, fixture); await start(page);
    await expect(row(page, habit.name)).toContainText("229 dias de sequência");
    await page.getByRole("button", { name: "Marcar " + habit.name, exact: true }).click();
    await expect(row(page, habit.name)).toContainText("230 dias de sequência");
    await expect(page.getByRole("button", { name: "Desmarcar " + habit.name, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".habits-heatmap span")).toHaveCount(182);
    await expect(page.locator('.habits-heatmap span[data-kind="done"]')).toHaveCount(182);
    await expect(page.getByRole("img", { name: new RegExp(habit.name + ": 182 dias registrados") })).toBeVisible();
    expect(await dates(fixture, habit.id)).toEqual([...history, fixture.today]);
    expect(trace.writes).toHaveLength(1); expect(trace.writes[0]!.command).toBe("habit.mark"); await verifyWrites(fixture, trace.writes);
    const after = await fixture.ledger();
    expect(after.events).toHaveLength(before.events.length + 1); expect(after.receipts).toHaveLength(before.receipts.length + 1);
    expect(after.entries.filter(value => (value as { payload: MarcacaoHabito }).payload.user_id === habitForeign)).toEqual(before.entries.filter(value => (value as { payload: MarcacaoHabito }).payload.user_id === habitForeign));
    await start(page, true); await expect(row(page, habit.name)).toContainText("230 dias de sequência");
    await expect(page.locator('.habits-heatmap span[data-kind="done"]')).toHaveCount(182);
    await expect(page.locator("main")).not.toContainText("FOREIGN_HABIT_SENTINEL");
    expect(trace.reads).toBeGreaterThanOrEqual(3); expect(trace.writes).toHaveLength(1);
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await fixture.db.close(); }
});

test("Pausas geral e individual recalculam mapa e sequência sem apagar marcações SQL", async ({ page }) => {
  const fixture = await createHabitSqlFixture(product);
  try {
    const a = await fixture.habit("Hábito A SQL", shiftCivil(fixture.today, -6)), b = await fixture.habit("Hábito B SQL", shiftCivil(fixture.today, -6), 1);
    for (const habit of [a, b]) await fixture.seedHistory(habit, [-6, -5].map(day => shiftCivil(fixture.today, day)));
    const trace = await attach(page, fixture); await start(page);
    async function pause(habitId: string, from: number, to: number, reason: string) {
      await page.getByRole("button", { name: "Registrar pausa", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Registrar pausa", exact: true });
      await dialog.getByLabel("Hábito", { exact: true }).selectOption(habitId);
      await dialog.getByLabel("Início da pausa", { exact: true }).fill(shiftCivil(fixture.today, from));
      await dialog.getByLabel("Fim da pausa", { exact: true }).fill(shiftCivil(fixture.today, to));
      await dialog.getByLabel("Motivo", { exact: true }).fill(reason);
      await dialog.getByRole("button", { name: "Salvar pausa", exact: true }).click(); await expect(dialog).not.toBeVisible();
      await expect(page.locator(".habits-pauses")).toContainText(reason);
    }
    await pause("", -4, -3, "Pausa geral SQL"); await pause(a.id, -2, -1, "Pausa individual SQL");
    for (const habit of [a, b]) { await page.getByRole("button", { name: "Marcar " + habit.name, exact: true }).click(); await expect(page.getByRole("button", { name: "Desmarcar " + habit.name, exact: true })).toBeEnabled(); }
    await expect(row(page, a.name)).toContainText("3 dias de sequência"); await expect(row(page, b.name)).toContainText("1 dia de sequência");
    await expect(page.locator('.habits-heatmap span[data-kind="paused"]')).toHaveCount(4);
    await page.getByLabel("Hábito do histórico", { exact: true }).selectOption(b.id); await expect(page.locator('.habits-heatmap span[data-kind="paused"]')).toHaveCount(2);
    const entries = (await fixture.ledger()).entries;
    expect(await dates(fixture, a.id)).toEqual([-6, -5, 0].map(day => shiftCivil(fixture.today, day)));
    expect(await dates(fixture, b.id)).toEqual([-6, -5, 0].map(day => shiftCivil(fixture.today, day)));
    const pauses = (await fixture.db.query<{ payload: PausaDoUsuario }>("select payload from public.habit_pauses where user_id=$1 order by starts_on", [habitOwner])).rows.map(value => value.payload);
    expect(pauses.map(value => ({ habitId: value.habit_id, starts: value.starts_on, ends: value.ends_on }))).toEqual([
      { habitId: null, starts: shiftCivil(fixture.today, -4), ends: shiftCivil(fixture.today, -3) },
      { habitId: a.id, starts: shiftCivil(fixture.today, -2), ends: shiftCivil(fixture.today, -1) },
    ]);
    await page.getByRole("button", { name: "Remover pausa de " + shiftCivil(fixture.today, -2), exact: true }).click();
    await expect(row(page, a.name)).toContainText("1 dia de sequência");
    await page.getByLabel("Hábito do histórico", { exact: true }).selectOption(a.id); await expect(page.locator('.habits-heatmap span[data-kind="paused"]')).toHaveCount(2);
    await page.getByRole("button", { name: "Remover pausa de " + shiftCivil(fixture.today, -4), exact: true }).click();
    await expect(page.locator('.habits-heatmap span[data-kind="paused"]')).toHaveCount(0);
    expect((await fixture.ledger()).entries).toEqual(entries);
    expect((await fixture.db.query("select id from public.habit_pauses where user_id=$1", [habitOwner])).rows).toEqual([]);
    expect(trace.writes.map(value => value.command)).toEqual(["habit.pause.create", "habit.pause.create", "habit.mark", "habit.mark", "habit.pause.delete", "habit.pause.delete"]);
    await verifyWrites(fixture, trace.writes);
    for (const value of pauses) expect((await fixture.db.query("select canal,before,after from public.domain_events where user_id=$1 and entity_id=$2 and action='deleted'", [habitOwner, value.id])).rows).toEqual([{ canal: "web", before: value, after: null }]);
    await start(page, true); await expect(row(page, a.name)).toContainText("1 dia de sequência"); await expect(row(page, b.name)).toContainText("1 dia de sequência");
    expect((await fixture.ledger()).entries).toEqual(entries); expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await fixture.db.close(); }
});

test("Registrar dia usa São Paulo sob UTC, aceita passado e recusa futuro na tela, Core e SQL", async ({ page }) => {
  const fixture = await createHabitSqlFixture(product);
  try {
    const habit = await fixture.habit("Dia civil SQL", shiftCivil(fixture.today, -2)), tomorrow = shiftCivil(fixture.today, 1);
    expect(fixture.now.slice(0, 10)).toBe(tomorrow);
    const trace = await attach(page, fixture); await start(page);
    await expect(page.locator(".habits-today .habits-caption")).toHaveText("Hoje em São Paulo · " + fixture.today.split("-").reverse().join("/"));
    await page.getByRole("button", { name: "Registrar dia", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar dia", exact: true }), day = dialog.getByLabel("Dia do hábito", { exact: true });
    await expect(day).toHaveValue(fixture.today); await expect(day).toHaveAttribute("max", fixture.today);
    await day.fill(shiftCivil(fixture.today, -1)); await dialog.getByRole("button", { name: "Salvar marcação", exact: true }).click(); await expect(dialog).not.toBeVisible();
    expect(await dates(fixture, habit.id)).toEqual([shiftCivil(fixture.today, -1)]); expect(trace.writes).toHaveLength(1); await verifyWrites(fixture, trace.writes);
    await page.getByRole("button", { name: "Registrar dia", exact: true }).click(); await day.fill(tomorrow);
    expect(await day.evaluate(element => (element as HTMLInputElement).validity.rangeOverflow)).toBe(true);
    await dialog.getByRole("button", { name: "Salvar marcação", exact: true }).click();
    await expect(dialog).toBeVisible(); expect(await day.evaluate(element => element.matches(":invalid"))).toBe(true);
    expect(trace.writes).toHaveLength(1);
    const before = await fixture.ledger(), commits = fixture.calls.filter(value => value.name === "projects_habits_commit").length;
    await expect(fixture.command({ command: "habit.mark", input: { habit_id: habit.id, done_on: tomorrow, done: true, client_id: "future-core" } })).rejects.toMatchObject({ code: "VALIDATION", message: "Não dá para marcar um dia no futuro." });
    expect(fixture.calls.filter(value => value.name === "projects_habits_commit")).toHaveLength(commits); expect(await fixture.ledger()).toEqual(before);
    // Independent canonical trigger refusal, not a fabricated SQL error or a
    // changed DB clock/constraint. The failed statement leaves no persisted row.
    await expect(fixture.db.query("insert into public.habit_entries(payload) values($1::jsonb)", [JSON.stringify(fixture.entry(habit, tomorrow))])).rejects.toMatchObject({ code: "23514", message: "Habit date unavailable." });
    expect(await fixture.ledger()).toEqual(before); expect(trace.writes).toHaveLength(1);
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await fixture.db.close(); }
});
