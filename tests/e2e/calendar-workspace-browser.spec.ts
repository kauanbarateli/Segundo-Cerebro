/** Original Calendar page composition (WorkspacePage -> Suspense ->
 * CalendarWorkspace) with the real access/application providers, connected
 * client, command journal and shell's original pending-send feedback, mounted
 * in Chromium. Only the Next routing
 * boundary and the HTTP answers are synthetic: /api/calendar keeps one
 * selected calendar cursor and applies the Core window rules. No Google,
 * OAuth, Supabase, Auth, persisted provider or Next server is exercised. */
import assert from "node:assert/strict";
import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { defaultWindow, unionWindow, validWindow, type CalendarEvent, type CalendarSnapshot, type CalendarSyncRun, type CalendarWindow } from "../../src/core/calendario";
import { instanteDe } from "../../src/core/tempo";
import type { AccessPolicy } from "../../src/core/access/resolve-access";
import { describeVisualFailures, inspectVisualGuards } from "./helpers/visual-guards";
import { journalBrowser } from "../features/helpers/journal-browser";

const origin = "https://calendar-workspace.test";
const owner = "68000000-0000-4000-8000-000000000001", account = "68000000-0000-4000-8000-000000000002", source = "68000000-0000-4000-8000-000000000003";
const retreatId = "68000000-0000-4000-8000-000000000011", lateId = "68000000-0000-4000-8000-000000000012", augustId = "68000000-0000-4000-8000-000000000013";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Saturday 10/10/2026, 12:00 in São Paulo. The browser runs in Tokyo, so a
// day derived from the browser zone instead of the app zone would diverge.
const now = "2026-10-10T15:00:00.000Z", today = "2026-10-10";
const policy: AccessPolicy = { isAdmin: false, entitlements: { conhecimento: false }, preferences: {} };
const event = (id: string, title: string, starts_at: string, ends_at: string, all_day: boolean): CalendarEvent => ({
  id, user_id: owner, account_id: account, calendar_id: source, title, starts_at, ends_at, location: null, linked_capture_id: null, habit_id: null, all_day, html_link: null, reminder_minutes: null,
});
const events: readonly CalendarEvent[] = [
  // All-day 9, 10 and 11/10 in São Paulo; Google's end date (12/10) is exclusive.
  event(retreatId, "Retiro de três dias", "2026-10-09T03:00:00.000Z", "2026-10-12T03:00:00.000Z", true),
  // 22:00 on 07/10 in São Paulo; already 08/10 in UTC and in the browser zone.
  event(lateId, "Revisão noturna", "2026-10-08T01:00:00.000Z", "2026-10-08T02:00:00.000Z", false),
  // Before the initial cursor window: only a sync that extends it returns this row.
  event(augustId, "Planejamento de agosto", "2026-08-20T13:00:00.000Z", "2026-08-20T14:00:00.000Z", false),
];

let bundle: string, styles: string;
test.use({ timezoneId: "Asia/Tokyo", locale: "pt-BR", trace: "off", video: "off" });
test.describe.configure({ retries: 0 });
test.beforeAll(async () => {
  const fixture = resolve("tests/e2e/fixtures/calendar-workspace-browser.tsx").replaceAll("\\", "/"), discovered = new Set<string>();
  const build = await rolldown({ input: fixture, platform: "browser", tsconfig: false, resolve: { alias: { "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "calendar-next-css-boundaries", resolveId(id, importer) {
      if (id.endsWith(".css")) {
        assert.ok(importer && id.startsWith("."));
        const path = resolve(dirname(importer), id), within = relative(resolve("src"), path);
        assert.ok(!within.startsWith("..") && !within.includes(":")); discovered.add(path); return "\0calendar-css";
      }
      if (id === "next/navigation") return resolve(fixture);
      if (id === "next/link") return "\0calendar-link";
      if (id.startsWith("next/")) throw new Error("Unexpected Next boundary in the Calendar fixture: " + id);
      return null;
    }, load(id) {
      if (id === "\0calendar-css") return "export {};";
      if (id === "\0calendar-link") return "export { NavigationLink as default } from " + JSON.stringify(fixture) + ";";
      return null;
    } }] });
  try {
    const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "CalendarWorkspaceFixture" });
    assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.ok(!/\bimport\s*\(/.test(chunk.code));
    assert.ok(Object.keys(chunk.modules).some(path => path.replaceAll("\\", "/").endsWith("src/components/features/calendario/calendar-workspace.tsx")));
    assert.ok(Object.keys(chunk.modules).some(path => path.replaceAll("\\", "/").endsWith("src/lib/demo/connected-application.ts")));
    bundle = chunk.code;
  } finally { await build.close(); }
  assert.ok([...discovered].some(path => path.endsWith("calendar.css")));
  const global = resolve("src/app/globals.css");
  styles = (await postcss([tailwind()]).process(await readFile(global, "utf8"), { from: global })).css + "\n" + (await Promise.all([...discovered].sort().map(path => readFile(path, "utf8")))).join("\n");
  const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2");
  styles += "\n@font-face{font-family:CalendarGeist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:CalendarGeist}.calendar-fixture{max-width:1184px;margin-inline:auto;padding:24px 16px 72px}";
  assert.ok(!/@import\s/.test(styles));
  for (const match of styles.matchAll(/url\(([^)]*)\)/g)) assert.match(match[1]!.replaceAll(/["']/g, "").trim(), /^data:/);
});

type Sync = { clientId: string; requested: CalendarWindow; before: CalendarWindow | null; after: CalendarWindow | null; refused: boolean; readsBefore: number };
type Disconnect = { clientId: string; accountId: string; status: 200 | 503; readsBefore: number };
type Trace = { documents: number; reads: { window: CalendarWindow | null; ids: string[] }[]; syncs: Sync[]; disconnects: Disconnect[]; captures: number; unexpected: string[]; errors: string[] };
const overlapping = (window: CalendarWindow) => {
  const start = Date.parse(instanteDe(window.start_day)!), end = Date.parse(instanteDe(window.end_day)!);
  return events.filter(row => Date.parse(row.starts_at) < end && Date.parse(row.ends_at) > start);
};
// Mirrors the SQL snapshot: stored rows of the selected calendar ordered by
// starts_at,id, no window filter; rows exist only after a sync fetched them.
// The window is the cursor's, null before the first sync of that calendar.
async function attach(page: Page, options: { theme: "light" | "dark"; refuseSync?: boolean; pendingDisconnect?: boolean; initiallyPending?: boolean; initialWindow?: CalendarWindow | null }) {
  const initial = options.initialWindow === undefined ? defaultWindow(today) : options.initialWindow;
  const state = { window: initial, stored: new Set((initial ? overlapping(initial) : []).map(row => row.id)), runs: [] as CalendarSyncRun[], syncedAt: initial ? "2026-10-10T12:00:00.000Z" : null as string | null, accountStatus: (options.initiallyPending ? "revocation_pending" : "connected") as "connected" | "revocation_pending" | null };
  const trace: Trace = { documents: 0, reads: [], syncs: [], disconnects: [], captures: 0, unexpected: [], errors: [] };
  page.on("pageerror", error => trace.errors.push(error.message));
  // Chromium logs the declared HTTP failures as resource errors; nothing else is tolerated.
  page.on("console", message => { if (message.type() === "error" && !(options.refuseSync && message.text().includes("status of 429")) && !(options.pendingDisconnect && message.text().includes("status of 503"))) trace.errors.push(message.text()); });
  const snapshot = (): CalendarSnapshot => {
    return {
      items: state.accountStatus === "connected" ? events.filter(row => state.stored.has(row.id)).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id)) : [],
      calendars: state.accountStatus === "connected" ? [{ id: source, user_id: owner, account_id: account, name: "Agenda sintética", color_key: "calendar", selected: true }] : [],
      accounts: state.accountStatus ? [{ id: account, user_id: owner, email: "agenda@example.invalid", scopes: [], status: state.accountStatus, last_synced_at: state.syncedAt }] : [],
      sync_runs: state.runs, window: state.window, preferences: { default_calendar_view: "month", meeting_reminders_enabled: true, meeting_reminder_minutes: 10 },
    };
  };
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url()), headers = request.headers();
    if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", ...extra }, body: JSON.stringify(body) });
    if (request.isNavigationRequest() && request.method() === "GET" && url.pathname === "/calendario") {
      trace.documents++;
      await route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="pt-BR" data-theme="${options.theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Calendário</title></head><body><div id="calendar-workspace"></div></body></html>` });
      return;
    }
    const owned = headers["x-expected-user-id"] === owner;
    if (url.pathname === "/api/calendar" && !url.search && owned && request.method() === "GET" && request.postData() === null) {
      const value = snapshot(); trace.reads.push({ window: value.window, ids: value.items.map(row => row.id) }); await json(value); return;
    }
    if (url.pathname === "/api/calendar" && !url.search && owned && request.method() === "POST" && headers.origin === origin && headers["content-type"] === "application/json") {
      const body: unknown = request.postDataJSON();
      if (options.pendingDisconnect && body && typeof body === "object" && Object.keys(body).sort().join() === "command,input" && "command" in body && body.command === "calendar.disconnect" && "input" in body) {
        const input = body.input;
        assert.ok(input && typeof input === "object" && Object.keys(input).sort().join() === "account_id,client_id" && "account_id" in input && input.account_id === account && "client_id" in input && typeof input.client_id === "string" && uuid.test(input.client_id));
        // Only public HTTP answers are synthetic. The initial fence hides rows
        // before a provider failure maps to 503; no provider/SQL ACK is inferred.
        if (state.accountStatus === "connected") {
          state.accountStatus = "revocation_pending"; state.stored.clear(); state.window = null;
          trace.disconnects.push({ clientId: input.client_id, accountId: account, status: 503, readsBefore: trace.reads.length });
          await json({ ok: false, code: "UNAVAILABLE", message: "Não foi possível confirmar a agenda. Tente novamente; a configuração da integração pode precisar de revisão." }, 503); return;
        }
        assert.equal(state.accountStatus, "revocation_pending");
        if (trace.disconnects.length) assert.equal(input.client_id, trace.disconnects[0]!.clientId);
        state.accountStatus = null;
        trace.disconnects.push({ clientId: input.client_id, accountId: account, status: 200, readsBefore: trace.reads.length });
        await json({ ok: true, result: snapshot() }); return;
      }
      const input = body && typeof body === "object" && "command" in body && body.command === "calendar.sync" && "input" in body && Object.keys(body).length === 2 ? body.input : null;
      if (input && typeof input === "object" && Object.keys(input).sort().join() === "client_id,end_day,start_day" && "client_id" in input && typeof input.client_id === "string" && uuid.test(input.client_id) && "start_day" in input && "end_day" in input) {
        const requested = { start_day: String(input.start_day), end_day: String(input.end_day) };
        if (validWindow(requested)) {
          const before = state.window;
          if (options.refuseSync) {
            trace.syncs.push({ clientId: input.client_id, requested, before, after: null, refused: true, readsBefore: trace.reads.length });
            // Same status/body/header as calendarFailure for a provider quota refusal.
            await json({ ok: false, code: "RATE_LIMITED", message: "Aguarde antes de sincronizar novamente." }, 429, { "Retry-After": "60" }); return;
          }
          for (const row of overlapping(requested)) state.stored.add(row.id);
          state.window = unionWindow(state.window, requested); state.syncedAt = now;
          state.runs = [{ id: "68000000-0000-4000-8000-0000000001" + String(trace.syncs.length).padStart(2, "0"), user_id: owner, account_id: null, channel: "web", status: "complete", calendar_count: 1, event_count: snapshot().items.length, started_at: now, finished_at: now }, ...state.runs];
          trace.syncs.push({ clientId: input.client_id, requested, before, after: state.window, refused: false, readsBefore: trace.reads.length });
          await json({ ok: true, result: snapshot() }); return;
        }
      }
    }
    if (url.pathname === "/api/capture-tasks" && url.search === "?query=captures" && owned && request.method() === "GET") { trace.captures++; await json({ items: [], categories: [], projects: [] }); return; }
    trace.unexpected.push(request.method() + " " + url.pathname + url.search); await route.abort();
  });
  return trace;
}
type FixtureGlobal = { __calendarWorkspaceFixture: { start(user: string, policy: AccessPolicy): void; replaced(): string[] }; __calendarDocument?: string };
async function mount(page: Page, path: string) {
  await page.clock.setFixedTime(new Date(now));
  await page.goto(origin + path);
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: bundle });
  const marker = await page.evaluate(() => { const value = crypto.randomUUID(); (globalThis as unknown as FixtureGlobal).__calendarDocument = value; return value; });
  await page.evaluate(({ user, access }) => (globalThis as unknown as FixtureGlobal).__calendarWorkspaceFixture.start(user, access), { user: owner, access: policy });
  await expect(page.locator('.calendar-workspace[data-access="allowed"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return marker;
}
// Lets React commit and flush passive effects; a sync effect sets busy synchronously.
async function settled(page: Page) {
  await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 50)))));
  await expect(page.getByRole("button", { name: "Sincronizar período", exact: true })).toBeEnabled();
}
const query = (page: Page) => Object.fromEntries(new URL(page.url()).searchParams);
// Layout Codex: all-day bars span the covered day columns (one continuous bar), so a day
// lists the bars that overlap its column; timed buttons read as "time|title".
const timelineDays = (page: Page) => page.locator(".calendar-time-day").evaluateAll(sections => {
  const bars = [...document.querySelectorAll(".calendar-all-day-event")].map(bar => ({ rect: bar.getBoundingClientRect(), title: bar.querySelector("strong")?.textContent ?? "" }));
  return sections.map(section => {
    const column = section.getBoundingClientRect();
    return {
      day: section.getAttribute("data-day") ?? "",
      allDay: bars.filter(bar => bar.rect.left < column.right - 1 && bar.rect.right > column.left + 1).map(bar => bar.title),
      timed: [...section.querySelectorAll(".calendar-timeline .calendar-event")].map(node => (node.querySelector(".calendar-event-time")?.textContent ?? "") + "|" + (node.querySelector("strong")?.textContent ?? "")),
    };
  });
});
const monthDays = (page: Page) => page.locator(".calendar-month-day").evaluateAll(sections => sections.map(section => ({
  day: section.querySelector("h3 button")?.getAttribute("aria-label") ?? "",
  outside: section.hasAttribute("data-outside"),
  events: [...section.querySelectorAll(".calendar-event strong")].map(node => node.textContent ?? ""),
})));
const titlesIn = (days: { events: string[] }[], title: string) => days.flatMap((value, index) => value.events.includes(title) ? [index] : []);

test("calendário montado: Dia/Semana/Mês, evento de três dias e expansão da janela sem reload", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const trace = await attach(page, { theme: "light" });
  const marker = await mount(page, "/calendario?date=2026-10-10&view=week");
  const sync = page.getByRole("button", { name: "Sincronizar período", exact: true });
  await expect.poll(() => trace.reads.length).toBeGreaterThanOrEqual(1);
  expect(trace.reads[0]).toEqual({ window: { start_day: "2026-08-26", end_day: "2027-04-08" }, ids: [lateId, retreatId] });
  // Layout Codex heading: the module h1 with its approved subtitle.
  await expect(page.locator(".shell-page-heading h1")).toHaveText("Calendário");

  // Week 05–11/10: inside the cursor window, so no sync is requested.
  await expect(page.getByRole("button", { name: "Semana", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Grade semanal com rolagem interna" })).toBeVisible();
  // The week title names the visible range (layout Codex: year and ISO week below it);
  // pt-BR only capitalizes its first letter.
  const period = page.locator(".calendar-period h2");
  await expect(period).toHaveText("5–11 de outubro");
  await expect(page.locator(".calendar-period-title p")).toHaveText("2026 · Semana 41");
  expect(await period.evaluate(node => [getComputedStyle(node).textTransform, getComputedStyle(node, "::first-letter").textTransform])).toEqual(["none", "uppercase"]);
  await settled(page); expect(trace.syncs).toEqual([]);
  // Settings names the calendar section #lembretes ("Calendário e lembretes").
  await expect(page.getByRole("link", { name: "Preferências da agenda", exact: true })).toHaveAttribute("href", "/configuracoes#lembretes");
  let week = await timelineDays(page);
  expect(week.map(value => value.day)).toEqual([5, 6, 7, 8, 9, 10, 11].map(day => "2026-10-" + String(day).padStart(2, "0")));
  expect(week.flatMap((value, index) => value.allDay.includes("Retiro de três dias") ? [index] : [])).toEqual([4, 5, 6]);
  await expect(page.locator(".calendar-all-day-event")).toHaveCount(1);
  expect(week.flatMap((value, index) => value.timed.some(text => text.includes("Revisão noturna")) ? [index] : [])).toEqual([2]);
  expect(week[2]!.timed).toEqual(["22:00 – 23:00|Revisão noturna"]);

  // Next week starts on 12/10, the exclusive end of the all-day event.
  await page.getByRole("button", { name: "Próximo período" }).click();
  expect(query(page)).toEqual({ date: "2026-10-17", view: "week" });
  await expect(period).toHaveText("12–18 de outubro");
  week = await timelineDays(page);
  expect(week[0]!.day).toBe("2026-10-12");
  expect(week.some(value => value.allDay.length || value.timed.length)).toBe(false);
  await expect(page.getByRole("heading", { name: "Nenhum compromisso neste período" })).toBeVisible();
  await settled(page); expect(trace.syncs).toEqual([]);

  // Day view through the real controls: 07 (São Paulo evening), 08 empty, 09–11 all-day, 12 empty.
  await page.getByRole("button", { name: "Período anterior" }).click();
  await page.getByRole("button", { name: "Dia", exact: true }).click();
  expect(query(page)).toEqual({ date: "2026-10-10", view: "day" });
  await expect(page.getByRole("region", { name: "Grade do dia com rolagem interna" })).toBeVisible();
  const expectations: [string, string, string[], string[]][] = [["2026-10-07", "quarta-feira, 7 de outubro", [], ["22:00 – 23:00|Revisão noturna"]], ["2026-10-08", "quinta-feira, 8 de outubro", [], []],
    ["2026-10-09", "sexta-feira, 9 de outubro", ["Retiro de três dias"], []], ["2026-10-10", "sábado, 10 de outubro", ["Retiro de três dias"], []],
    ["2026-10-11", "domingo, 11 de outubro", ["Retiro de três dias"], []], ["2026-10-12", "segunda-feira, 12 de outubro", [], []]];
  for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Período anterior" }).click();
  for (const [index, [date, heading, allDay, timed]] of expectations.entries()) {
    if (index) await page.getByRole("button", { name: "Próximo período" }).click();
    expect(query(page)).toEqual({ date, view: "day" });
    await expect(page.locator(".calendar-period h2")).toHaveText(heading);
    const [single] = await timelineDays(page);
    expect({ date, allDay: single!.allDay, timed: single!.timed }).toEqual({ date, allDay, timed });
    await expect(page.getByRole("heading", { name: "Nenhum compromisso neste período" })).toHaveCount(allDay.length || timed.length ? 0 : 1);
  }
  await settled(page); expect(trace.syncs).toEqual([]);

  // Month view: the grid keeps 9–11 and leaves the exclusive 12 empty.
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await page.getByRole("button", { name: "Mês", exact: true }).click();
  expect(query(page)).toEqual({ date: today, view: "month" });
  await expect(page.getByLabel("Mês em grade")).toBeVisible();
  await expect(page.locator(".calendar-period h2")).toHaveText("outubro");
  await expect(page.locator(".calendar-period-title p")).toHaveText("2026");
  let month = await monthDays(page);
  expect(month).toHaveLength(42);
  expect(titlesIn(month, "Retiro de três dias").map(index => month[index]!.day)).toEqual(["sexta-feira, 9 de outubro", "sábado, 10 de outubro", "domingo, 11 de outubro"]);
  expect(titlesIn(month, "Revisão noturna").map(index => month[index]!.day)).toEqual(["quarta-feira, 7 de outubro"]);
  await settled(page); expect(trace.syncs).toEqual([]);

  // The all-day detail names the exclusive end and closes back to the same control.
  const retreat = page.locator(".calendar-month-day").filter({ has: page.getByRole("button", { name: "sábado, 10 de outubro", exact: true }) }).getByRole("button", { name: /Retiro de três dias/ });
  await retreat.click();
  expect(query(page)).toEqual({ date: today, view: "month", event: retreatId });
  const detail = page.getByRole("dialog", { name: "Retiro de três dias" });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Compromisso Google · somente leitura");
  // Layout Codex detail: the last included day, then Google's exclusive end explained.
  await expect(detail).toContainText("sexta-feira, 9 de outubro até domingo, 11 de outubro");
  await expect(detail).toContainText("Dia inteiro · 3 dias");
  await expect(detail).toContainText("O Google registra o término em 12 de outubro, exclusivo");
  await expect(detail).toContainText("Google Calendar · agenda@example.invalid");
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  expect(query(page)).toEqual({ date: today, view: "month" });
  await expect(retreat).toBeFocused();

  // September (31/08–11/10) still fits the cursor window that starts on 26/08.
  await page.getByRole("button", { name: "Período anterior" }).click();
  expect(query(page)).toEqual({ date: "2026-09-01", view: "month" });
  await expect(page.locator(".calendar-period h2")).toHaveText("setembro");
  await settled(page); expect(trace.syncs).toEqual([]);
  const readsBeforeExpansion = trace.reads.length;
  expect(trace.reads.every(read => !read.ids.includes(augustId))).toBe(true);

  // August's grid starts on 27/07: exactly one sync, then a refreshed snapshot.
  await page.getByRole("button", { name: "Período anterior" }).click();
  expect(query(page)).toEqual({ date: "2026-08-01", view: "month" });
  await expect.poll(() => trace.syncs.length).toBe(1);
  expect(trace.syncs[0]).toEqual({ clientId: expect.stringMatching(uuid), requested: { start_day: "2026-07-27", end_day: "2026-09-07" }, before: { start_day: "2026-08-26", end_day: "2027-04-08" }, after: { start_day: "2026-07-27", end_day: "2027-04-08" }, refused: false, readsBefore: readsBeforeExpansion });
  await expect(page.locator(".calendar-feedback[role=status]")).toHaveText("Agenda atualizada.");
  await expect(sync).toBeEnabled();
  month = await monthDays(page);
  expect(titlesIn(month, "Planejamento de agosto").map(index => month[index]!.day)).toEqual(["quinta-feira, 20 de agosto"]);
  const refreshed = trace.reads.slice(trace.syncs[0]!.readsBefore);
  expect(refreshed.length).toBeGreaterThan(0);
  expect(refreshed.every(read => read.window?.start_day === "2026-07-27" && read.ids.includes(augustId))).toBe(true);

  // The extended window covers both months: navigating within it does not resync.
  await page.getByRole("button", { name: "Próximo período" }).click();
  await settled(page);
  await page.getByRole("button", { name: "Período anterior" }).click();
  await settled(page);
  expect(trace.syncs).toHaveLength(1);

  // Same document and history entry: router.replace only, no reload or redirect.
  expect(trace.documents).toBe(1);
  expect(await page.evaluate(() => (globalThis as unknown as FixtureGlobal).__calendarDocument)).toBe(marker);
  const replaced = await page.evaluate(() => (globalThis as unknown as FixtureGlobal).__calendarWorkspaceFixture.replaced());
  expect(replaced.at(-1)).toBe("/calendario?date=2026-08-01&view=month");
  expect(replaced.every(href => href.startsWith("/calendario?"))).toBe(true);
  expect(trace.unexpected).toEqual([]);
  expect(trace.errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("calendar-workspace-august-1440-light.png"), fullPage: true });
  const evidence = info.outputPath("calendar-workspace-trace.json");
  await writeFile(evidence, JSON.stringify({ now, timezoneId: "Asia/Tokyo", documents: trace.documents, reads: trace.reads, syncs: trace.syncs, captureReads: trace.captures, replaced, unexpected: trace.unexpected }, null, 2));
  await info.attach("calendar-workspace-trace.json", { path: evidence, contentType: "application/json" });
});

test("calendário montado a 390px: lista mensal, troca por teclado e guardas visuais", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const trace = await attach(page, { theme: "dark" });
  await mount(page, "/calendario?date=2026-10-10&view=month");
  await expect(page.getByLabel("Mês em grade")).toBeHidden();
  const list = page.getByLabel("Mês em lista");
  await expect(list).toBeVisible();
  // Layout Codex agenda: only days with appointments, each event named in full.
  const cards = await list.locator(".calendar-agenda-day").evaluateAll(nodes => nodes.map(node => ({
    day: node.querySelector(".calendar-sr-only")?.textContent ?? "", events: [...node.querySelectorAll(".calendar-event")].map(button => button.getAttribute("aria-label") ?? ""),
  })));
  expect(cards).toEqual([
    { day: "quarta-feira, 7 de outubro", events: ["Revisão noturna, 22:00 – 23:00, Agenda sintética"] },
    { day: "sexta-feira, 9 de outubro", events: ["Retiro de três dias, Dia inteiro, Agenda sintética"] },
    { day: "sábado, 10 de outubro (hoje)", events: ["Retiro de três dias, Dia inteiro, Agenda sintética"] },
    { day: "domingo, 11 de outubro", events: ["Retiro de três dias, Dia inteiro, Agenda sintética"] },
  ]);
  // Layout Codex toolbar: the title leads; previous/next became named 44px icon buttons
  // sharing one row with Hoje (formerly text buttons "Anterior"/"Próximo").
  const row = await page.locator(".calendar-period").evaluate(node => [node.querySelector(".calendar-period-title")!, ...node.querySelectorAll("button")].map(child => ({ text: child.getAttribute("aria-label") ?? child.textContent, top: Math.round(child.getBoundingClientRect().top), left: Math.round(child.getBoundingClientRect().left), width: child.getBoundingClientRect().width, height: child.getBoundingClientRect().height })));
  expect(row.map(item => item.text)).toEqual(["outubro2026", "Período anterior", "Próximo período", "Hoje"]);
  expect(row[0]!.left).toBeLessThan(row[1]!.left);
  expect(new Set(row.slice(1).map(item => item.top)).size).toBe(1);
  for (const control of row.slice(1)) { expect(control.width).toBeGreaterThanOrEqual(44); expect(control.height).toBeGreaterThanOrEqual(44); }
  const reports = [await inspectVisualGuards(page)];
  await page.screenshot({ path: info.outputPath("calendar-workspace-month-390-dark.png"), fullPage: true });

  // Keyboard reaches the real view controls; Enter switches without pointer input.
  // Layout Codex: up to 680px every view reads as an agenda of its period.
  for (const [label, region, view] of [["Semana", "Agenda da semana em lista", "week"], ["Dia", "Agenda do dia em lista", "day"], ["Lista", "Mês em lista", "list"]] as const) {
    const button = page.getByRole("button", { name: label, exact: true });
    await button.focus(); await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toBeFocused();
    expect(query(page)).toEqual({ date: today, view });
    await expect(page.getByRole("region", { name: region })).toBeVisible();
    reports.push(await inspectVisualGuards(page));
    await page.screenshot({ path: info.outputPath(`calendar-workspace-${view}-390-dark.png`), fullPage: true });
  }
  for (const report of reports) {
    expect(report.documentWidth, describeVisualFailures(report, "overflow")).toBeLessThanOrEqual(report.viewportWidth);
    expect(report.overflow, describeVisualFailures(report, "overflow")).toEqual([]);
    expect(report.targets, describeVisualFailures(report, "targets")).toEqual([]);
    expect(report.fields, describeVisualFailures(report, "fields")).toEqual([]);
  }
  await settled(page);
  expect(trace.syncs).toEqual([]);
  expect(trace.documents).toBe(1);
  expect(trace.unexpected).toEqual([]);
  expect(trace.errors).toEqual([]);
});

test("calendário montado: sincronização recusada não entra em laço e só repete por ação explícita", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const trace = await attach(page, { theme: "light", refuseSync: true });
  // Opening directly on August asks for the period outside the cursor once.
  await mount(page, "/calendario?date=2026-08-15&view=month");
  await expect.poll(() => trace.syncs.length).toBe(1);
  expect(trace.syncs[0]).toMatchObject({ requested: { start_day: "2026-07-27", end_day: "2026-09-07" }, refused: true, after: null });
  await expect(page.locator(".calendar-feedback[role=status]")).toHaveText("Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.");
  await settled(page);
  // The refused period is not requested again while browsing back to it.
  await page.getByRole("button", { name: "Próximo período" }).click();
  await settled(page);
  await page.getByRole("button", { name: "Período anterior" }).click();
  await settled(page);
  expect(trace.syncs).toHaveLength(1);
  const month = await monthDays(page);
  expect(titlesIn(month, "Planejamento de agosto")).toEqual([]);
  // The explicit control remains available and sends a new request.
  await page.getByRole("button", { name: "Sincronizar período", exact: true }).click();
  await expect.poll(() => trace.syncs.length).toBe(2);
  expect(trace.syncs[1]).toMatchObject({ requested: { start_day: "2026-07-27", end_day: "2026-09-07" }, refused: true });
  expect(trace.syncs[1]!.clientId).not.toBe(trace.syncs[0]!.clientId);
  await settled(page);
  expect(trace.documents).toBe(1);
  expect(trace.unexpected).toEqual([]);
  expect(trace.errors).toEqual([]);
});

test("calendário montado: conta recém-conectada sem cursor sincroniza o período visível uma vez", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const trace = await attach(page, { theme: "dark", initialWindow: null });
  await mount(page, "/calendario?date=2026-10-10&view=week");
  // window:null means no cursor yet, so even the first visible week is requested.
  await expect.poll(() => trace.syncs.length).toBe(1);
  expect(trace.reads[0]).toEqual({ window: null, ids: [] });
  expect(trace.syncs[0]).toMatchObject({ requested: { start_day: "2026-10-05", end_day: "2026-10-12" }, before: null, after: { start_day: "2026-10-05", end_day: "2026-10-12" }, refused: false });
  await expect(page.locator(".calendar-feedback[role=status]")).toHaveText("Agenda atualizada.");
  await expect(page.getByRole("heading", { name: "Nenhum compromisso neste período" })).toHaveCount(0);
  const refreshed = trace.reads.slice(trace.syncs[0]!.readsBefore);
  expect(refreshed.length).toBeGreaterThan(0);
  expect(refreshed.every(read => JSON.stringify(read) === JSON.stringify({ window: { start_day: "2026-10-05", end_day: "2026-10-12" }, ids: [lateId, retreatId] }))).toBe(true);
  const week = await timelineDays(page);
  expect(week.flatMap((value, index) => value.allDay.includes("Retiro de três dias") ? [index] : [])).toEqual([4, 5, 6]);
  // The next week extends the cursor once; returning stays inside and does not resync.
  await page.getByRole("button", { name: "Próximo período" }).click();
  await expect.poll(() => trace.syncs.length).toBe(2);
  expect(trace.syncs[1]).toMatchObject({ requested: { start_day: "2026-10-12", end_day: "2026-10-19" }, after: { start_day: "2026-10-05", end_day: "2026-10-19" } });
  await settled(page);
  await page.getByRole("button", { name: "Período anterior" }).click();
  await settled(page);
  expect(trace.syncs).toHaveLength(2);
  expect(trace.documents).toBe(1);
  expect(trace.unexpected).toEqual([]);
  expect(trace.errors).toEqual([]);
});

test("calendário montado: revogação pendente oculta a agenda e Confirmar envio retoma a mesma operação", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const trace = await attach(page, { theme: "light", pendingDisconnect: true });
  const marker = await mount(page, "/calendario?date=2026-10-10&view=month");
  // Layout Codex: sources are the "Meus calendários" checkboxes (formerly switches).
  await expect(page.getByRole("checkbox", { name: "Agenda sintética", exact: true })).toBeVisible();
  expect(titlesIn(await monthDays(page), "Retiro de três dias")).toHaveLength(3);
  await settled(page);

  await page.getByRole("button", { name: "Desconectar", exact: true }).click();
  await expect.poll(() => trace.disconnects.length).toBe(1);
  expect(trace.disconnects[0]).toEqual({ clientId: expect.stringMatching(uuid), accountId: account, status: 503, readsBefore: expect.any(Number) });
  const pending = page.getByRole("region", { name: "Confirmação de envio", exact: true });
  await expect(pending).toContainText("Há um envio para confirmar");
  await expect(pending).toContainText("Não foi possível confirmar a operação.");
  await expect(page.locator(".calendar-account-heading")).toContainText("Revogação pendente");
  await expect(page.getByRole("button", { name: "Retomar desconexão", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reconectar", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sincronizar período", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.locator(".calendar-event")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Nenhum compromisso neste período", exact: true })).toBeVisible();
  const fencedReads = trace.reads.slice(trace.disconnects[0]!.readsBefore);
  expect(fencedReads.length).toBeGreaterThan(0);
  expect(fencedReads.every(read => read.window === null && !read.ids.length)).toBe(true);

  // Pending accounts cannot start a window expansion, or replay a disconnect
  // automatically. Recovery uses the shell's actual journal confirmation.
  await page.getByRole("button", { name: "Período anterior", exact: true }).click();
  await page.getByRole("button", { name: "Período anterior", exact: true }).click();
  await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 50)))));
  expect(query(page)).toEqual({ date: "2026-08-01", view: "month" });
  expect(trace.syncs).toEqual([]);
  expect(trace.disconnects).toHaveLength(1);

  await pending.getByRole("button", { name: "Confirmar envio", exact: true }).click();
  await expect.poll(() => trace.disconnects.length).toBe(2);
  expect(trace.disconnects[1]).toEqual({ clientId: trace.disconnects[0]!.clientId, accountId: account, status: 200, readsBefore: expect.any(Number) });
  await expect(pending).toContainText("Envio confirmado");
  await expect(page.locator(".calendar-account")).toHaveCount(0);
  await expect(page.getByText("Nenhuma conta Google conectada. Conecte uma conta para escolher os calendários.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sincronizar período", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Conectar Google", exact: true })).toBeEnabled();
  await expect(page.locator(".calendar-event")).toHaveCount(0);
  await pending.getByRole("button", { name: "Dispensar aviso", exact: true }).click();
  await expect(pending).toHaveCount(0);
  expect(trace.syncs).toEqual([]);
  expect(trace.documents).toBe(1);
  expect(await page.evaluate(() => (globalThis as unknown as FixtureGlobal).__calendarDocument)).toBe(marker);
  expect(trace.unexpected).toEqual([]);
  expect(trace.errors).toEqual([]);
});

test("calendário montado: Retomar desconexão confirma a intenção original sem gerar outro UUID", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const trace = await attach(page, { theme: "light", pendingDisconnect: true });
  const marker = await mount(page, "/calendario?date=2026-10-10&view=month");
  await settled(page);
  await page.getByRole("button", { name: "Desconectar", exact: true }).click();
  const retry = page.getByRole("button", { name: "Retomar desconexão", exact: true });
  const pending = page.getByRole("region", { name: "Confirmação de envio", exact: true });
  await expect(retry).toBeEnabled();
  await expect(pending.getByRole("button", { name: "Confirmar envio", exact: true })).toBeEnabled();
  expect(trace.disconnects).toHaveLength(1);
  const original = trace.disconnects[0]!.clientId;
  expect(trace.disconnects[0]!.status).toBe(503);

  // Observe the native generator without replacing its values or the journal.
  // No synthetic UUID is supplied to the product; the probe is removed below.
  type Probe = { calls: string[]; restore(): void };
  type ProbeGlobal = typeof globalThis & { __calendarRetomarUuid?: Probe };
  await page.evaluate(() => {
    const native = crypto.randomUUID, calls: string[] = [];
    (globalThis as ProbeGlobal).__calendarRetomarUuid = { calls, restore() { crypto.randomUUID = native; } };
    crypto.randomUUID = () => { const value = native.call(crypto) as `${string}-${string}-${string}-${string}-${string}`; calls.push(value); return value; };
  });
  try {
    const box = await retry.boundingBox(); expect(box?.width).toBeGreaterThanOrEqual(44); expect(box?.height).toBeGreaterThanOrEqual(44);
    await retry.focus(); await page.keyboard.press("Enter");
    await expect(pending).toContainText("Envio confirmado");
    await expect(page.locator(".calendar-feedback[role=status]")).toHaveText("Agenda atualizada.");
    expect(trace.disconnects.map(row => ({ clientId: row.clientId, status: row.status }))).toEqual([{ clientId: original, status: 503 }, { clientId: original, status: 200 }]);
    expect(await page.evaluate(() => (globalThis as ProbeGlobal).__calendarRetomarUuid!.calls)).toEqual([]);
    await expect(page.locator(".calendar-account")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sincronizar período", exact: true })).toBeDisabled();
    await expect(page.locator(".calendar-event")).toHaveCount(0);
    expect(trace.syncs).toEqual([]);
    expect(trace.documents).toBe(1);
    expect(await page.evaluate(() => (globalThis as unknown as FixtureGlobal).__calendarDocument)).toBe(marker);
    expect(trace.unexpected).toEqual([]);
    expect(trace.errors).toEqual([]);
  } finally {
    await page.evaluate(() => { const value = globalThis as ProbeGlobal; value.__calendarRetomarUuid?.restore(); delete value.__calendarRetomarUuid; });
  }
});

test("calendário montado: Retomar desconexão não confirma outro comando restaurado no journal", async ({ page }) => {
  const browser = journalBrowser(), journal = browser.tab().journal(owner);
  await journal.open();
  await journal.exclusive(async () => { journal.stage("task.status", { id: "68000000-0000-4000-8000-000000000099", client_id: "unrelated-pending-task", status: "done" }); });
  const persisted = [...browser.data];
  // Data is serialized by the ORIGINAL journal, then restored by its browser
  // implementation. It is an explicit storage seam, never a second journal.
  await page.addInitScript(entries => { for (const [key, value] of entries) localStorage.setItem(key, value); }, persisted);
  const trace = await attach(page, { theme: "dark", pendingDisconnect: true, initiallyPending: true, initialWindow: null });
  const marker = await mount(page, "/calendario?date=2026-10-10&view=month");
  const pending = page.getByRole("region", { name: "Confirmação de envio", exact: true });
  await expect(pending).toContainText("Há um envio para confirmar");
  const retry = page.getByRole("button", { name: "Retomar desconexão", exact: true });
  await expect(retry).toBeEnabled(); await retry.click();
  await expect(page.locator(".calendar-feedback[role=status]")).toHaveText("Confirme o envio pendente antes de salvar outra alteração.");
  await expect(retry).toBeEnabled();
  expect(trace.disconnects).toEqual([]); expect(trace.syncs).toEqual([]);
  for (const [key, value] of persisted) expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(value);
  await expect(pending.getByRole("button", { name: "Confirmar envio", exact: true })).toBeEnabled();
  await expect(page.locator(".calendar-account-heading")).toContainText("Revogação pendente");
  await expect(page.locator(".calendar-event")).toHaveCount(0);
  expect(trace.documents).toBe(1);
  expect(await page.evaluate(() => (globalThis as unknown as FixtureGlobal).__calendarDocument)).toBe(marker);
  expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
});

test("calendário montado: Retomar sem journal pendente inicia apenas a desconexão da conta exibida", async ({ page }) => {
  const trace = await attach(page, { theme: "light", pendingDisconnect: true, initiallyPending: true, initialWindow: null });
  await mount(page, "/calendario?date=2026-10-10&view=month");
  await expect(page.getByRole("region", { name: "Confirmação de envio", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Retomar desconexão", exact: true }).click();
  await expect(page.locator(".calendar-feedback[role=status]")).toHaveText("Agenda atualizada.");
  expect(trace.disconnects).toEqual([{ clientId: expect.stringMatching(uuid), accountId: account, status: 200, readsBefore: expect.any(Number) }]);
  await expect(page.locator(".calendar-account")).toHaveCount(0);
  expect(trace.syncs).toEqual([]); expect(trace.documents).toBe(1);
  expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
});
