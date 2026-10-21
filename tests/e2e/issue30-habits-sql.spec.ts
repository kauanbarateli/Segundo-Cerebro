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
import { contrastRatio } from "../../design-system/validate.mjs";
import { createHabitSqlFixture, habitOwner, habitForeign, habitForeignSession, loadHabitProduct, shiftCivil, type HabitProduct, type HabitSqlFixture } from "./helpers/issue30-habits-sql";
import type { HabitoDoUsuario, MarcacaoHabito, PausaDoUsuario } from "../../src/core/contracts/modules";

const origin = "https://issue30-habits-sql.test";
let product: HabitProduct, browserBundle: string, styles: string;
const originalTimezone = process.env.TZ;
test.use({ timezoneId: "UTC" });
const componentCss = ["src/components/ui/button.css", "src/components/ui/field.css", "src/components/ui/card.css", "src/components/ui/dialog.css",
  "src/components/ui/toast.css", "src/components/layout/related-panel.css", "src/components/layout/private-image.css", "src/components/layout/habit-frequency-fields.css", "src/components/features/habitos/habits.css"];

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
    if (request.isNavigationRequest() && request.method() === "GET" && url.pathname === "/habitos" && (!url.search || url.searchParams.size === 1 && url.searchParams.has("habit"))) {
      await route.fulfill({ contentType: "text/html", body: '<html lang="pt-BR"><body><div id="issue30-habits-fixture"></div></body></html>' }); return;
    }
    trace.unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  return trace;
}
async function start(page: Page, reload = false, habitId?: string, unavailable = false) {
  if (reload) await page.reload(); else await page.goto(origin + "/habitos" + (habitId ? "?habit=" + encodeURIComponent(habitId) : ""));
  await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: browserBundle });
  await page.evaluate(userId => {
    const start = (globalThis as unknown as { __startIssue30HabitsFixture(userId: string): void }).__startIssue30HabitsFixture;
    start(userId);
  }, habitOwner);
  await expect(page.getByRole("heading", { name: unavailable ? "Hábito indisponível" : "Desempenho", exact: true })).toBeVisible();
  if (!unavailable) await page.getByText("Histórico e pausas", { exact: true }).click();
}
// Layout Codex: each habit is a row of the weekly grid (its name is the row header).
function row(page: Page, name: string) { return page.locator(".habits-week tbody tr").filter({ has: page.getByText(name, { exact: true }) }); }
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

test("SPEC08 frequência e filtro preservam registros, recibos e histórico após recarregar", async ({ page }) => {
  const fixture = await createHabitSqlFixture(product);
  try {
    const habit = await fixture.habit("Frequência preservada SQL", shiftCivil(fixture.today, -2));
    const second = await fixture.habit("Outro hábito SQL", fixture.today, 1);
    await fixture.seedHistory(habit, [shiftCivil(fixture.today, -2), fixture.today]);
    const beforeDates = await dates(fixture, habit.id), trace = await attach(page, fixture); await start(page);
    await page.getByLabel("Filtrar hábitos", { exact: true }).selectOption(habit.id);
    await expect(row(page, second.name)).toHaveCount(0);
    const menu = page.getByLabel("Ações de " + habit.name, { exact: true });
    await menu.focus(); await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Editar hábito " + habit.name, exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Editar hábito", exact: true });
    await expect(editor.getByLabel("Início do hábito", { exact: true })).toBeDisabled();
    await editor.getByLabel("Frequência", { exact: true }).selectOption("weekly_target");
    await editor.getByLabel("Quantas vezes por semana?", { exact: true }).fill("1");
    await editor.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(editor).toBeHidden();
    const saved = (await fixture.db.query<{ payload: HabitoDoUsuario }>("select payload from public.habits where user_id=$1 and id=$2", [habitOwner, habit.id])).rows[0]!.payload;
    expect(saved.frequency_history).toMatchObject({ version: 1, baseline_origin: "created_frequency", changes: [expect.objectContaining({ effective_from: habit.started_on, schedule_kind: "daily" }), expect.objectContaining({ effective_from: fixture.today, schedule_kind: "weekly_target", weekly_target: 1 })] });
    expect(await dates(fixture, habit.id)).toEqual(beforeDates);
    const update = trace.writes.find(write => write.command === "habit.update")!;
    expect((await fixture.db.query("select result from app_private.command_receipts where user_id=$1 and command='habit.update' and client_id=$2", [habitOwner, update.clientId])).rows).toEqual([{ result: saved }]);
    expect((await fixture.db.query("select before,after from public.domain_events where user_id=$1 and entity_id=$2 and action='updated'", [habitOwner, habit.id])).rows).toEqual([{ before: habit, after: saved }]);
    await page.getByText("Frequências e melhores sequências", { exact: true }).click();
    await expect(page.getByRole("list", { name: "Frequências conhecidas", exact: true }).locator("li")).toHaveCount(2);
    await page.getByRole("button", { name: "Semana", exact: true }).click();
    await expect(page.getByLabel("Data da semana", { exact: true })).toHaveValue(fixture.today);
    await page.getByRole("button", { name: "Mês", exact: true }).click();
    await page.getByText("Ver registros por dia", { exact: true }).click();
    const monthFrom = fixture.today.slice(0, 7) + "-01", realInMonth = beforeDates.filter(day => day >= monthFrom).length;
    await expect(page.locator(".habits-chart-heading p")).toHaveText(realInMonth + (realInMonth === 1 ? " registro" : " registros"));
    await start(page, true); await page.getByLabel("Filtrar hábitos", { exact: true }).selectOption(habit.id);
    await expect(row(page, habit.name)).toContainText("1 vez por semana"); expect(await dates(fixture, habit.id)).toEqual(beforeDates);
    expect(trace.writes).toHaveLength(1); expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await fixture.db.close(); }
});

test("SPEC08 link arquivado consulta somente seu histórico e link alheio não escolhe outro hábito", async ({ page }) => {
  const fixture = await createHabitSqlFixture(product);
  try {
    const habit = await fixture.habit("Arquivado SQL", shiftCivil(fixture.today, -1));
    await fixture.seedHistory(habit, [shiftCivil(fixture.today, -1)]);
    await fixture.command({ command: "habit.archive", input: { id: habit.id, client_id: "archive-link" } });
    const foreign = await fixture.habit("FOREIGN_HABIT_LINK", fixture.today, 0, habitForeign, habitForeignSession);
    const trace = await attach(page, fixture); await start(page, false, habit.id);
    await expect(page.getByLabel("Filtrar hábitos", { exact: true })).toHaveValue(habit.id);
    await expect(page.getByRole("button", { name: "Registrar dia", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Registrar pausa", exact: true })).toBeDisabled();
    await expect(page.getByRole("img", { name: new RegExp(habit.name + ": 1 dias registrados") })).toBeVisible();
    await page.getByRole("button", { name: "Restaurar " + habit.name, exact: true }).click();
    await expect(page.getByLabel("Filtrar hábitos", { exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Ver ativos", exact: true }).click();
    await expect(row(page, habit.name)).toBeVisible();
    const before = await fixture.ledger();
    await start(page, false, foreign.id, true);
    await expect(page.locator("main")).not.toContainText("FOREIGN_HABIT_LINK");
    await expect(page.locator(".habits-week")).toHaveCount(0); expect(await fixture.ledger()).toEqual(before);
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  } finally { await fixture.db.close(); }
});

test("SPEC08 Hábitos: matriz de temas, 320–1440px, teclado e tabela do gráfico", async ({ page }, testInfo) => {
  const fixture = await createHabitSqlFixture(product);
  try {
    const habit = await fixture.habit("Prática com nome longo que preserva leitura, frequência e ações", shiftCivil(fixture.today, -6));
    await fixture.seedHistory(habit, [shiftCivil(fixture.today, -2), fixture.today]);
    const trace = await attach(page, fixture);
    await page.goto(origin + "/habitos");
    for (const theme of ["light", "dark", "system"] as const) {
      await page.evaluate(value => localStorage.setItem("segundo-cerebro-theme", value), theme);
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      await start(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme === "light" ? "light" : "dark");
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const target = page.getByRole("button", { name: "Desmarcar " + habit.name, exact: true }), box = await target.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
        const emptyBars = await page.locator('.habits-bar-track > span[style*="block-size: 0%"]')
          .evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
        expect(emptyBars.length).toBeGreaterThan(0);
        expect(emptyBars.every(height => height === 0)).toBe(true);
        const pairs = await page.locator(".habits-panel h2, .habits-chart-heading p, .habits-score > span, .habits-practice strong, .habits-practice > div > span").evaluateAll(elements => elements.map(element => {
          const hex = (value: string) => "#" + (value.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map(part => Number(part).toString(16).padStart(2, "0")).join("");
          let parent: Element | null = element, background = "";
          while (parent) { background = getComputedStyle(parent).backgroundColor; if (background !== "rgba(0, 0, 0, 0)" && background !== "transparent") break; parent = parent.parentElement; }
          return { foreground: hex(getComputedStyle(element).color), background: hex(background) };
        }));
        for (const pair of pairs) expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
        await testInfo.attach("habitos-" + theme + "-" + width, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      }
    }
    const disclosure = page.getByText("Ver registros por dia", { exact: true });
    await disclosure.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("table", { name: "Registros do período", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Novo hábito", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Novo hábito", exact: true });
    await dialog.getByLabel("Frequência", { exact: true }).selectOption("weekdays");
    for (const field of await dialog.locator(".field__control").all()) expect(await field.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    for (const button of await dialog.getByRole("button").all()) { const box = await button.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44); }
    await page.keyboard.press("Escape"); await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Novo hábito", exact: true })).toBeFocused();
    expect(trace.writes).toEqual([]); expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
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
    await expect(page.locator(".habits-clock")).toHaveText("Hoje em São Paulo · " + fixture.today.split("-").reverse().join("/"));
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
