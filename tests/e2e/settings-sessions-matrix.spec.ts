/** Connected Settings presentation matrix that runs on any host: the original
 * Shell/Settings/providers bundle of the issue34 fixture, with synthetic HTTP
 * answers for /api/settings and /api/settings/sessions. No PGlite, SQL, Auth,
 * cookies, Supabase or Next server is involved; issue34-settings-sql.spec.ts
 * keeps the SQL/SDK journey. This proves presentation states only. */
import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { buildSettingsBrowser } from "./helpers/settings-browser";
import { describeVisualFailures, inspectVisualGuards, type VisualReport } from "./helpers/visual-guards";
import { THEME_INIT_SCRIPT } from "../../src/lib/theme";
import type { AccessPolicy } from "../../src/core/access/resolve-access";
import type { AccountSettings } from "../../src/core/configuracoes";
import type { OwnSessionsView } from "../../src/core/configuracoes/own-sessions";

const origin = "https://settings-matrix.test", owner = "69000000-0000-4000-8000-000000000001";
// The fixture mounts an ordinary account with Calendar vetoed, so no agenda read starts.
const policy: AccessPolicy = { isAdmin: false, entitlements: { calendario: false }, preferences: {} };
const listed: OwnSessionsView = { sessions: [
  { isCurrent: true, createdAt: "2026-10-11T12:00:00Z", refreshedAt: "2026-10-12T09:30:00Z" },
  { isCurrent: false, createdAt: null, refreshedAt: null },
], hasMore: false };
const truncated: OwnSessionsView = { sessions: Array.from({ length: 100 }, (_, index) => ({ isCurrent: index === 0, createdAt: "2026-10-01T12:00:00Z", refreshedAt: null })), hasMore: true };
let bundle: string, styles: string;
test.use({ timezoneId: "America/Sao_Paulo", locale: "pt-BR", trace: "off", video: "off" });
test.describe.configure({ retries: 0 });
test.beforeAll(async () => { const built = await buildSettingsBrowser(); bundle = built.code; styles = built.css; });

type Answer = { status: 200; view: OwnSessionsView } | { status: 401 | 503 };
function gate() { let open!: () => void; const promise = new Promise<void>(done => { open = done; }); return { promise, open }; }
async function attach(page: Page, theme: "light" | "dark", answers: { hold?: Promise<void>; answer: Answer }[]) {
  const settings: AccountSettings = { user_id: owner, profile: { display_name: "Pessoa de exemplo", email: "pessoa@example.invalid", avatar_file_id: null },
    preferences: { theme, default_calendar_view: "month", values_hidden: false, meeting_reminders_enabled: true, meeting_reminder_minutes: 10 }, modules: [] };
  const trace = { documents: 0, settingsReads: 0, sessionsReads: 0, unexpected: [] as string[], errors: [] as string[] };
  page.on("pageerror", error => trace.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && !/status of (401|503)/.test(message.text())) trace.errors.push(message.text()); });
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url()), owned = request.headers()["x-expected-user-id"] === owner;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Cache-Control": "private, no-store, max-age=0" }, body: JSON.stringify(body) });
    if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    if (request.isNavigationRequest() && request.method() === "GET" && url.pathname === "/configuracoes" && !url.search) {
      trace.documents++;
      await route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="pt-BR" data-account-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff"><title>Configurações</title></head><body><div id="issue34-settings-sql"></div></body></html>` });
      return;
    }
    if (url.pathname === "/api/settings" && !url.search && request.method() === "GET" && owned) { trace.settingsReads++; await json(settings); return; }
    if (url.pathname === "/api/settings/sessions" && !url.search && request.method() === "GET" && request.postData() === null && owned) {
      const next = answers[trace.sessionsReads++];
      if (!next) { trace.unexpected.push("EXTRA_SESSIONS_READ"); await route.abort(); return; }
      await next.hold;
      if (next.answer.status === 200) await json(next.answer.view); else await json({ code: next.answer.status === 401 ? "UNAUTHENTICATED" : "UNAVAILABLE" }, next.answer.status);
      return;
    }
    trace.unexpected.push(request.method() + " " + url.pathname + url.search); await route.abort();
  });
  return trace;
}
async function mount(page: Page) {
  await page.goto(origin + "/configuracoes");
  await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: THEME_INIT_SCRIPT }); await page.addScriptTag({ content: bundle });
  await page.evaluate(({ actor, access }) => (globalThis as unknown as { __startIssue34SettingsSql(user: string, policy: AccessPolicy, hidden: boolean): void }).__startIssue34SettingsSql(actor, access, false), { actor: owner, access: policy });
  await expect(page.locator('[data-application-mode="connected"]')).toBeVisible();
  await expect(page.locator('.settings-workspace[data-access="allowed"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const clean = (report: VisualReport) => {
  expect(report.overflow, describeVisualFailures(report, "overflow")).toEqual([]);
  expect(report.targets, describeVisualFailures(report, "targets")).toEqual([]);
  expect(report.fields, describeVisualFailures(report, "fields")).toEqual([]);
  expect(report.documentWidth, describeVisualFailures(report, "overflow")).toBeLessThanOrEqual(report.viewportWidth);
};
const focused = (page: Page) => page.evaluate(() => { const node = document.activeElement; return node && node !== document.body ? (node.getAttribute("aria-label") ?? node.textContent ?? node.tagName).trim() : "BODY"; });

for (const width of [320, 390, 768, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`configurações conectadas: sessões carregando, falha e nova tentativa em ${width}px, ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const first = gate(), second = gate();
    const trace = await attach(page, theme, [{ hold: first.promise, answer: { status: 503 } }, { hold: second.promise, answer: { status: 200, view: listed } }]);
    await mount(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const sessions = page.locator("#sessoes"), content = sessions.locator(".own-sessions-content");
    const reports: Record<string, VisualReport> = {};

    // Loading: announced, busy, refresh disabled, skeleton hidden from assistive tech.
    await expect(sessions.getByRole("status")).toHaveText("Carregando suas sessões…");
    await expect(content).toHaveAttribute("aria-busy", "true");
    await expect(sessions.getByRole("button", { name: "Atualizar sessões", exact: true })).toBeDisabled();
    await expect(sessions.locator(".own-sessions-skeleton")).toHaveAttribute("aria-hidden", "true");
    await expect(sessions.locator(".ui-collapsible__chevron")).toHaveCSS("transition-property", "none");
    await sessions.scrollIntoViewIfNeeded();
    reports.loading = await inspectVisualGuards(page);
    await sessions.screenshot({ path: info.outputPath(`sessions-loading-${width}-${theme}.png`) });

    // Failure: an alert with a recovery control; no dates or identifiers.
    first.open();
    await expect(sessions.getByRole("alert")).toHaveText("Não foi possível carregar suas sessões. Tente novamente.");
    const retry = sessions.getByRole("button", { name: "Tentar novamente", exact: true });
    await expect(retry).toBeEnabled();
    await expect(content).not.toHaveAttribute("aria-busy", "true");
    await expect(sessions.getByText("Esta sessão", { exact: true })).toHaveCount(0);
    reports.failure = await inspectVisualGuards(page);
    await sessions.screenshot({ path: info.outputPath(`sessions-failure-${width}-${theme}.png`) });

    // Keyboard retry reads again; focus stays visible on a real control.
    await retry.focus();
    const outline = await retry.evaluate(node => ({ style: getComputedStyle(node).outlineStyle, width: Number.parseFloat(getComputedStyle(node).outlineWidth) }));
    expect(outline.style).not.toBe("none"); expect(outline.width).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("Enter");
    await expect(sessions.getByRole("status")).toHaveText("Carregando suas sessões…");
    const focusWhileLoading = await focused(page);
    second.open();
    const list = sessions.getByRole("list", { name: "Sessões cadastradas" });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    const rows = await list.getByRole("listitem").evaluateAll(items => items.map(item => ({
      title: item.querySelector("strong")?.textContent, terms: [...item.querySelectorAll("dt")].map(node => node.textContent),
      values: [...item.querySelectorAll("dd")].map(node => node.textContent), times: [...item.querySelectorAll("time")].map(node => node.getAttribute("datetime")),
    })));
    expect(rows).toEqual([
      { title: "Esta sessão", terms: ["Criada em", "Última renovação"], values: ["11 de out. de 2026, 09:00", "12 de out. de 2026, 06:30"], times: ["2026-10-11T12:00:00Z", "2026-10-12T09:30:00Z"] },
      { title: "Outra sessão", terms: ["Criada em", "Última renovação"], values: ["Data indisponível", "Renovação não informada"], times: [] },
    ]);
    await expect(sessions.getByRole("button", { name: "Atualizar sessões", exact: true })).toBeEnabled();
    // Disabling the control while reading drops focus; it returns once the read settles.
    await expect(sessions.getByRole("button", { name: "Atualizar sessões", exact: true })).toBeFocused();
    const focusAfterList = await focused(page);
    expect(await sessions.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    reports.list = await inspectVisualGuards(page);
    await sessions.screenshot({ path: info.outputPath(`sessions-list-${width}-${theme}.png`) });
    await page.screenshot({ path: info.outputPath(`settings-${width}-${theme}.png`), fullPage: true });

    for (const report of Object.values(reports)) clean(report);
    expect(trace).toEqual({ documents: 1, settingsReads: 1, sessionsReads: 2, unexpected: [], errors: [] });
    const evidence = info.outputPath("settings-sessions-matrix.json");
    await writeFile(evidence, JSON.stringify({ width, theme, reducedMotion: "reduce", timezoneId: "America/Sao_Paulo", focusWhileLoading, focusAfterList, reports, trace }, null, 2));
    await info.attach("settings-sessions-matrix.json", { path: evidence, contentType: "application/json" });
  });
}

test("configurações conectadas: cem sessões indicam truncamento sem transbordar a 320px", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const trace = await attach(page, "dark", [{ answer: { status: 200, view: truncated } }]);
  await mount(page);
  const sessions = page.locator("#sessoes");
  const list = sessions.getByRole("list", { name: "Sessões cadastradas" });
  await expect(list.getByRole("listitem")).toHaveCount(100);
  await expect(list.getByText("Esta sessão", { exact: true })).toHaveCount(1);
  await expect(list.getByRole("listitem").first().locator("strong")).toHaveText("Esta sessão");
  await expect(sessions.getByRole("status")).toHaveText("Mostrando 100 sessões, incluindo esta sessão. Há outras sessões cadastradas.");
  expect(await sessions.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  clean(await inspectVisualGuards(page));
  await sessions.screenshot({ path: info.outputPath("sessions-truncated-320-dark.png") });
  expect(trace).toEqual({ documents: 1, settingsReads: 1, sessionsReads: 1, unexpected: [], errors: [] });
});

test("configurações conectadas: sessão trocada oferece entrar novamente, sem nova tentativa automática", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const trace = await attach(page, "light", [{ answer: { status: 401 } }]);
  await mount(page);
  const sessions = page.locator("#sessoes");
  await expect(sessions.getByRole("alert")).toHaveText("Sua sessão mudou. Entre novamente para consultar suas sessões.");
  const link = sessions.getByRole("link", { name: "Entrar novamente", exact: true });
  await expect(link).toHaveAttribute("href", "/entrar?notice=session-required");
  await expect(sessions.getByRole("button", { name: "Tentar novamente", exact: true })).toHaveCount(0);
  await expect(sessions.getByText("Esta sessão", { exact: true })).toHaveCount(0);
  const box = await link.boundingBox(); expect(box?.width).toBeGreaterThanOrEqual(44); expect(box?.height).toBeGreaterThanOrEqual(44);
  // Reorder controls are named with the visible module label, never an internal key.
  const order = page.locator("#modulos").getByRole("button", { name: /^(Subir|Descer) / });
  await expect(page.locator("#modulos").getByRole("button", { name: "Subir Conhecimento", exact: true })).toBeVisible();
  const names = await order.evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label") ?? ""));
  expect(names.length).toBeGreaterThan(0);
  expect(names.filter(name => !/^(Subir|Descer) \p{Lu}/u.test(name))).toEqual([]);
  clean(await inspectVisualGuards(page));
  await page.evaluate(() => new Promise<void>(done => setTimeout(done, 300)));
  expect(trace).toEqual({ documents: 1, settingsReads: 1, sessionsReads: 1, unexpected: [], errors: [] });
});
