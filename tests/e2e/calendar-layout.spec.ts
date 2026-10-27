import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_DEMO_POLICY, DEMO_ACCESS_STORAGE_KEY, serializeDemoPolicy } from "../../src/lib/navigation/demo-state";
import { SIDEBAR_STORAGE_KEY } from "../../src/lib/navigation/sidebar-preference";

// Layout Codex (issue #46) behaviour of the real demo Calendar and Integrações.
// The demo clock and agenda come from the provider (today: 23/09/2026, São Paulo).
const query = (page: Page) => Object.fromEntries(new URL(page.url()).searchParams);
const days = (page: Page, selector: string) => page.locator(selector).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-day")));
test.use({ viewport: { width: 1440, height: 1000 } });

test("Lista na URL: até fim do mês, paginação, mês a mês, Hoje e preferência intacta", async ({ page }) => {
  await page.goto("/calendario?view=list&date=2026-09-10");
  await expect(page.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute("aria-pressed", "true");
  const list = page.getByRole("region", { name: "Próximos eventos" });
  await expect(list).toBeVisible();
  expect(await days(page, ".calendar-list-event")).toEqual(["2026-09-23", "2026-09-23", "2026-09-23", "2026-09-24", "2026-09-24"]);
  await page.getByRole("button", { name: "Próxima página de compromissos" }).click();
  expect(await days(page, ".calendar-list-event")).toEqual(["2026-09-25", "2026-09-26"]);
  await expect(page.locator(".calendar-period h2")).toHaveText("setembro");
  await page.getByRole("button", { name: "Próximo período" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-10-01", view: "list" });
  await expect(page.getByRole("heading", { name: "Nenhum compromisso neste período" })).toBeVisible();
  await expect(list.locator(".calendar-list-event")).toHaveCount(0);
  await page.getByRole("button", { name: "Período anterior" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-01", view: "list" });
  await page.getByRole("button", { name: "Período anterior" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-08-01", view: "list" });
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23", view: "list" });
  await expect(list).toBeVisible();
  // Choosing a URL view does not save preferences. Settings is the explicit write boundary.
  expect(await page.evaluate(() => [...Array(localStorage.length).keys()].map(index => localStorage.getItem(localStorage.key(index)!) ?? "").some(value => value.includes('"list"')))).toBe(false);
  await page.goto("/calendario");
  await expect(page.getByRole("button", { name: "Semana", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("virada dezembro→janeiro na Lista e na Semana", async ({ page }) => {
  await page.goto("/calendario?view=list&date=2026-12-15");
  await page.getByRole("button", { name: "Próximo período" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2027-01-01", view: "list" });
  await expect(page.locator(".calendar-period h2")).toHaveText("janeiro");
  await expect(page.locator(".calendar-period-title p")).toHaveText("2027");
  await page.getByRole("button", { name: "Período anterior" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-12-01", view: "list" });
  await page.goto("/calendario?view=week&date=2026-12-30");
  await expect(page.locator(".calendar-period h2")).toHaveText("28 de dez. – 3 de jan.");
  await expect(page.locator(".calendar-period-title p")).toHaveText("2026–2027 · Semana 53");
  expect(await days(page, ".calendar-time-day")).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  await page.getByRole("button", { name: "Próximo período" }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2027-01-06", view: "week" });
  await expect(page.locator(".calendar-period-title p")).toHaveText("2027 · Semana 1");
});

test("Mês mostra dois compromissos por dia e +N abre o dia completo", async ({ page }) => {
  await page.goto("/calendario?view=month&date=2026-09-23");
  await expect(page.getByRole("region", { name: "Mês em grade" })).toBeVisible();
  await expect(page.locator(".calendar-month-day")).toHaveCount(42);
  const cell = page.locator(".calendar-month-day").filter({ has: page.getByRole("button", { name: "quarta-feira, 23 de setembro", exact: true }) });
  await expect(cell.locator(".calendar-month-event")).toHaveCount(2);
  await cell.getByRole("button", { name: "Ver mais 1 compromisso de quarta-feira, 23 de setembro", exact: true }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23", view: "day" });
  const day = page.getByRole("region", { name: "Agenda do dia", exact: true });
  await expect(day.locator(".calendar-appointment-toggle")).toHaveCount(3);
  await expect(day.getByRole("button", { name: /^Academia, 19:00 – 20:00, Pessoal de exemplo$/ })).toBeVisible();
});

test("cabeçalho abre o dia; semanas da lateral e fontes filtram sem perder o período", async ({ page }) => {
  await page.goto("/calendario?view=week&date=2026-09-23");
  const grid = page.getByRole("region", { name: "Grade semanal com rolagem interna" });
  // One continuous all-day bar 24–26/09 (Google end 27/09 is exclusive).
  const sprint = grid.getByRole("button", { name: "Sprint M0, dia inteiro, 24 de setembro – 26 de setembro, Trabalho de exemplo", exact: true });
  await expect(sprint).toHaveCount(1);
  await page.getByRole("button", { name: "Abrir quinta-feira, 24 de setembro", exact: true }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-24", view: "day" });
  await page.getByRole("button", { name: "Ver semana de 28 de setembro a 4 de outubro", exact: true }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-10-01", view: "week" });
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23", view: "week" });
  const dentist = grid.getByRole("button", { name: /^Dentista,/ });
  await expect(dentist).toHaveCount(1);
  const personal = page.getByRole("checkbox", { name: "Pessoal de exemplo", exact: true });
  await personal.click();
  await expect(personal).toHaveAttribute("aria-checked", "false");
  await expect(dentist).toHaveCount(0);
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23", view: "week" });
  await page.getByRole("checkbox", { name: "Trabalho de exemplo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Todos os calendários estão ocultos" })).toBeVisible();
  await expect(grid.locator(".calendar-event")).toHaveCount(0);
  await page.getByRole("button", { name: "Revisar calendários", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Meus calendários", exact: true })).toBeFocused();
  await personal.click();
  await expect(dentist).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Todos os calendários estão ocultos" })).toHaveCount(0);
});

test("detalhe por teclado devolve o foco; rolagem interna persiste e Hoje a zera", async ({ page }) => {
  await page.goto("/calendario?view=week&date=2026-09-23");
  const grid = page.getByRole("region", { name: "Grade semanal com rolagem interna" });
  const voe = grid.getByRole("button", { name: "Reunião Central VOE, 15:00 – 16:00, Trabalho de exemplo", exact: true });
  await voe.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Reunião Central VOE", exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23", view: "week", event: "event-voe" });
  await expect(dialog).toContainText("quarta-feira, 23 de setembro");
  await expect(dialog).toContainText("15:00 – 16:00 · horário de São Paulo");
  await expect(dialog).toContainText("Agenda de exemplo · Trabalho de exemplo");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(voe).toBeFocused();
  await expect.poll(() => query(page)).toEqual({ date: "2026-09-23", view: "week" });
  await grid.evaluate(element => { element.scrollTop = 300; });
  await page.getByRole("button", { name: "Próximo período" }).click();
  await expect.poll(() => query(page).date).toBe("2026-09-30");
  await expect.poll(() => grid.evaluate(element => element.scrollTop)).toBe(300);
  await page.getByRole("button", { name: "Dia", exact: true }).click();
  await expect(page.getByRole("region", { name: "Agenda do dia", exact: true })).toBeVisible();
  await expect(page.locator(".calendar-large .calendar-appointment-toggle")).toHaveCount(3);
  await page.getByRole("button", { name: "Mês", exact: true }).click();
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect.poll(() => grid.evaluate(element => element.scrollTop)).toBe(300);
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect.poll(() => grid.evaluate(element => element.scrollTop)).toBe(0);
});

test("troca de período usa animação CSS interrompível, sem WAAPI nem bloqueio", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/calendario?view=week&date=2026-09-23");
  const stage = page.locator(".calendar-motion");
  await expect(stage).not.toHaveAttribute("data-shift");
  const next = page.getByRole("button", { name: "Próximo período" });
  await next.click(); await next.click(); await next.click();
  await expect.poll(() => query(page).date).toBe("2026-10-14");
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
  await page.goto("/calendario?view=week&date=2026-09-23");
  const trigger = page.getByRole("button", { name: "Calendários", exact: true });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Meus calendários", exact: true })).toBeHidden();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("checkbox", { name: "Trabalho de exemplo", exact: true })).toBeVisible();
  await expect(page.getByLabel("Data do calendário")).toBeVisible();
  await page.getByLabel("Data do calendário").fill("2026-10-07");
  await expect.poll(() => query(page)).toEqual({ date: "2026-10-07", view: "week" });
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

// Doc17 composition, using the actual demo application and existing commands.
// This is browser coverage for CI, not a claim of OAuth/SQL or device acceptance.
for (const [width, theme] of [[320, "light"], [390, "dark"], [1440, "light"]] as const) {
  test(`agenda linear e seletor civil do protótipo em ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const writes: string[] = [];
    page.on("request", request => { if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/calendar")) writes.push(request.method()); });
    const view = width <= 680 ? "week" : "day";
    await page.goto(`/calendario?date=2026-09-23&view=${view}`);
    const agenda = page.getByRole("region", { name: width <= 680 ? "Agenda do dia selecionado" : "Agenda do dia", exact: true });
    await expect(agenda).toBeVisible();
    await expect(agenda.locator(".calendar-appointment-toggle")).toHaveCount(3);
    const appointment = agenda.getByRole("button", { name: "Reunião Central VOE, 15:00 – 16:00, Trabalho de exemplo", exact: true });
    await appointment.focus(); await page.keyboard.press("Enter");
    await expect(appointment).toHaveAttribute("aria-expanded", "true");
    const details = agenda.getByRole("button", { name: "Ver detalhes", exact: true });
    await expect(details).toBeVisible(); await details.click();
    const dialog = page.getByRole("dialog", { name: "Reunião Central VOE", exact: true });
    await expect(dialog).toBeVisible(); await expect(dialog).toContainText("15:00 – 16:00 · horário de São Paulo");
    await page.keyboard.press("Escape"); await expect(details).toBeFocused();
    await expect(agenda.getByRole("button", { name: "Criar nota", exact: true })).toHaveCount(0);
    if (width <= 680) {
      const strip = page.getByRole("group", { name: "Selecionar dia da semana", exact: true });
      await expect(strip.getByRole("button")).toHaveCount(7);
      const last = strip.getByRole("button").last();
      await last.focus(); await expect(last).toBeInViewport({ ratio: 1 });
      const geometry = await strip.evaluate(element => {
        const rect = element.getBoundingClientRect(), button = element.querySelector("button:last-child")!.getBoundingClientRect();
        return { left: button.left, right: button.right, start: rect.left + element.clientLeft, end: rect.left + element.clientLeft + element.clientWidth, pageX: scrollX };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(geometry.start); expect(geometry.right).toBeLessThanOrEqual(geometry.end); expect(geometry.pageX).toBe(0);
      const nextDay = strip.getByRole("button", { name: "quinta-feira, 24 de setembro, 2 compromissos", exact: true });
      await nextDay.focus(); await page.keyboard.press("Enter");
      await expect(nextDay).toHaveAttribute("aria-pressed", "true");
      expect(query(page)).toEqual({ date: "2026-09-24", view: "week" });
      await expect(agenda.locator(".calendar-appointment-toggle")).toHaveCount(2);
      await expect(agenda.getByRole("button", { name: /^Dentista,/ })).toBeVisible();
      const targets = await strip.getByRole("button").evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
      for (const target of targets) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44); }
      await page.getByRole("button", { name: "Mês", exact: true }).click();
      const month = page.getByRole("group", { name: "Selecionar dia do mês", exact: true });
      await expect(month.getByRole("button")).toHaveCount(42);
      await month.getByRole("button", { name: /^quarta-feira, 23 de setembro,/ }).click();
      expect(query(page)).toEqual({ date: "2026-09-23", view: "month" });
      await expect(agenda.locator(".calendar-appointment-toggle")).toHaveCount(3);
    }
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`calendar-prototype-linear-${width}-${theme}.png`), fullPage: true });
  });
}
