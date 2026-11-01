import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_DEMO_POLICY, DEMO_ACCESS_STORAGE_KEY, serializeDemoPolicy } from "../../src/lib/navigation/demo-state";
import { SIDEBAR_STORAGE_KEY } from "../../src/lib/navigation/sidebar-preference";

// Layout Codex (issue #46) behaviour of the real demo Calendar and Integrações.
// The demo clock and agenda come from the provider (today: 23/09/2026, São Paulo).
const query = (page: Page) => Object.fromEntries(new URL(page.url()).searchParams);
const days = (page: Page, selector: string) => page.locator(selector).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-day")));
test.use({ viewport: { width: 1440, height: 1000 } });

test("Lista única: sem seletor de vistas, paginação, mês a mês, Hoje e URL sem `view`", async ({ page }) => {
  await page.goto("/calendario?date=2026-09-10");
  for (const name of ["Dia", "Semana", "Mês", "Lista"]) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Visão do calendário", exact: true })).toHaveCount(0);
  const list = page.getByRole("region", { name: "Próximos eventos" });
  await expect(list).toBeVisible();
  expect(await days(page, ".calendar-list-event")).toEqual(["2026-09-23", "2026-09-23", "2026-09-23", "2026-09-24", "2026-09-24"]);
  await page.getByRole("button", { name: "Próxima página de compromissos" }).click();
  expect(await days(page, ".calendar-list-event")).toEqual(["2026-09-25", "2026-09-26"]);
  await expect(page.locator(".calendar-period h2")).toHaveText("setembro");
  await page.getByRole("button", { name: "Próximo período" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-10-01" });
  await expect(page.getByRole("heading", { name: "Nenhum compromisso neste período" })).toBeVisible();
  await expect(list.locator(".calendar-list-event")).toHaveCount(0);
  await page.getByRole("button", { name: "Período anterior" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-01" });
  await page.getByRole("button", { name: "Período anterior" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-08-01" });
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23" });
  await expect(list).toBeVisible();
});

for (const view of ["day", "week", "month", "list", "qualquer"]) test(`URL legada view=${view} abre a lista no mesmo contexto e remove o parâmetro`, async ({ page }) => {
  await page.goto(`/calendario?view=${view}&date=2026-09-23&event=event-voe`);
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23", event: "event-voe" });
  await expect(page.getByRole("region", { name: "Próximos eventos" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Reunião Central VOE", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Semana", exact: true })).toHaveCount(0);
  // The old preference never reactivates a removed view on a clean URL.
  await page.goto("/calendario");
  await expect(page.getByRole("region", { name: "Próximos eventos" })).toBeVisible();
  expect(Object.keys(query(page))).not.toContain("view");
});

test("virada dezembro→janeiro na lista", async ({ page }) => {
  await page.goto("/calendario?date=2026-12-15");
  await page.getByRole("button", { name: "Próximo período" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2027-01-01" });
  await expect(page.locator(".calendar-period h2")).toHaveText("janeiro");
  await expect(page.locator(".calendar-period-title p")).toHaveText("2027");
  await page.getByRole("button", { name: "Período anterior" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-12-01" });
});

test("mini calendário seleciona a data sem reativar vista removida; fontes filtram sem perder o período", async ({ page }) => {
  await page.goto("/calendario?date=2026-09-23");
  const list = page.getByRole("region", { name: "Próximos eventos" });
  await page.getByRole("button", { name: /^Selecionar 28 de setembro/ }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-28" });
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23" });
  const dentist = list.getByRole("button", { name: /^Dentista,/ });
  await expect(dentist).toHaveCount(1);
  const personal = page.getByRole("checkbox", { name: "Pessoal de exemplo", exact: true });
  await personal.click();
  await expect(personal).toHaveAttribute("aria-checked", "false");
  await expect(dentist).toHaveCount(0);
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23" });
  await page.getByRole("checkbox", { name: "Trabalho de exemplo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Todos os calendários estão ocultos" })).toBeVisible();
  await expect(list.locator(".calendar-list-event")).toHaveCount(0);
  await page.getByRole("button", { name: "Revisar calendários", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Meus calendários", exact: true })).toBeFocused();
  await personal.click();
  await expect(dentist).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Todos os calendários estão ocultos" })).toHaveCount(0);
});

test("detalhe por teclado devolve o foco ao evento da lista", async ({ page }) => {
  await page.goto("/calendario?date=2026-09-23");
  const voe = page.getByRole("region", { name: "Próximos eventos" }).getByRole("button", { name: /^Reunião Central VOE,/ });
  await voe.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Reunião Central VOE", exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23", event: "event-voe" });
  await expect(dialog).toContainText("quarta-feira, 23 de setembro");
  await expect(dialog).toContainText("15:00 – 16:00 · horário de São Paulo");
  await expect(dialog).toContainText("Agenda de exemplo · Trabalho de exemplo");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(voe).toBeFocused();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23" });
});

test("troca de período usa animação CSS interrompível, sem WAAPI nem bloqueio", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/calendario?date=2026-09-23");
  const stage = page.locator(".calendar-motion");
  await expect(stage).not.toHaveAttribute("data-shift");
  const next = page.getByRole("button", { name: "Próximo período" });
  await next.click(); await next.click(); await next.click();
  await expect.poll(() => query(page).date).toBe("2026-12-01");
  await expect(stage).toHaveAttribute("data-shift", "next");
  const animations = await page.evaluate(() => document.getAnimations().map(animation => animation.constructor.name));
  expect(animations.every(name => name === "CSSAnimation" || name === "CSSTransition")).toBe(true);
  expect(await stage.evaluate(element => getComputedStyle(element).animationName)).toBe("calendar-shift-next-b");
  await page.getByRole("button", { name: "Período anterior" }).click();
  await expect(stage).toHaveAttribute("data-shift", "previous");
  expect(await stage.evaluate(element => getComputedStyle(element).animationName)).toBe("calendar-shift-previous-a");
});

test("lateral oculta pelo contêiner (≤900px) mesmo com viewport largo: botão revela data e fontes", async ({ page }) => {
  await page.setViewportSize({ width: 1150, height: 900 });
  await page.addInitScript(key => localStorage.setItem(key, "expanded"), SIDEBAR_STORAGE_KEY);
  await page.goto("/calendario?date=2026-09-23");
  const trigger = page.getByRole("button", { name: "Calendários", exact: true });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Meus calendários", exact: true })).toBeHidden();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("checkbox", { name: "Trabalho de exemplo", exact: true })).toBeVisible();
  // At this container width the mini calendar is replaced by the list's own date control.
  await page.locator(".calendar-list-date-control button").click();
  await page.getByLabel("Data inicial da lista").fill("2026-09-30");
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-30" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Integrações: demonstração honesta, mesmo estado do Calendário e link de volta", async ({ page }) => {
  await page.goto("/integracoes");
  await expect(page.getByRole("heading", { level: 1, name: "Integrações" })).toBeVisible();
  await expect(page.getByText("Demonstração sem contas externas", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conectar Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Desconectar" })).toHaveCount(0);
  await expect(page.locator(".calendar-demo-sources li")).toHaveText(["Trabalho de exemplo", "Pessoal de exemplo"]);
  await page.getByRole("link", { name: "Abrir calendário" }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await expect(page.getByRole("link", { name: /^Google Calendar/ })).toHaveAttribute("href", "/integracoes");
});

test("Integrações sem o Calendário liberado explica e não mostra a agenda", async ({ page }) => {
  await page.addInitScript(({ key, policy }) => sessionStorage.setItem(key, policy), { key: DEMO_ACCESS_STORAGE_KEY, policy: serializeDemoPolicy({ ...DEFAULT_DEMO_POLICY, entitlements: { calendario: false } }) });
  await page.goto("/integracoes");
  await expect(page.getByRole("heading", { name: "Calendário indisponível para esta conta", exact: true })).toBeVisible();
  await expect(page.getByText("Trabalho de exemplo")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Abrir calendário" })).toHaveCount(0);
});

// A06 composition on the actual demo application and existing commands (read-only: no calendar writes).
for (const [width, theme] of [[320, "light"], [390, "dark"], [1440, "light"]] as const) {
  test(`lista do calendário legível por teclado, sem overflow e sem escrita em ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const writes: string[] = [];
    page.on("request", request => { if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/calendar")) writes.push(request.method()); });
    await page.goto("/calendario?date=2026-09-23");
    const list = page.getByRole("region", { name: "Próximos eventos" });
    await expect(list).toBeVisible();
    await expect(list.locator(".calendar-list-event")).toHaveCount(5);
    const first = list.getByRole("button", { name: /^Reunião Central VOE,/ });
    for (const box of await list.locator(".calendar-list-event").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
    await first.focus(); await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Reunião Central VOE", exact: true });
    await expect(dialog).toBeVisible(); await expect(dialog).toContainText("15:00 – 16:00 · horário de São Paulo");
    await expect(dialog.getByRole("button", { name: /Criar|Editar|Cancelar evento/ })).toHaveCount(0);
    await page.keyboard.press("Escape"); await expect(first).toBeFocused();
    const next = page.getByRole("button", { name: "Próxima página de compromissos" });
    await next.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Próximos eventos", exact: true })).toBeFocused();
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`calendar-list-${width}-${theme}.png`), fullPage: true });
  });
}
