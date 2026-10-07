import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1280]) {
  test(`a página inicial abre sem credenciais em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Segundo Cérebro/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Em foco", exact: true }).getByRole("heading", { name: "Revisar plano de milestones do V2" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Semana dos hábitos" })).toHaveAttribute("aria-valuenow", "67");
    await expect(page.getByRole("region", { name: "Pulso financeiro" }).getByText("+R$ 4.752,40")).toBeVisible();
    const visibleRows = page.getByRole("region", { name: "Tarefas de hoje" }).getByRole("listitem").filter({ visible: true });
    await expect(visibleRows).toHaveCount(width < 640 ? 3 : 4);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
  });
}

test("o teclado alcança o conteúdo pelo primeiro link", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: /pular para|ir para/i });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("o início oferece caminhos reais e alvos de toque de 44px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Capturar", exact: true })).toHaveAttribute("href", "/capturar");
  await expect(main.getByRole("link", { name: "Abrir tarefa", exact: true })).toHaveAttribute("href", "/tarefas?task=task-milestones");
  await expect(main.getByRole("progressbar", { name: "Notas organizadas" })).toHaveAttribute("aria-valuetext", "4 de 7");
  for (const link of await main.getByRole("link").filter({ visible: true }).all()) {
    const bounds = await link.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  }
  for (const button of await main.getByRole("button").filter({ visible: true }).all()) {
    const bounds = await button.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  }
  // The five essential blocks end within the agreed 2.5 mobile viewports.
  const finance = await page.getByRole("region", { name: "Pulso financeiro" }).boundingBox();
  expect(finance!.y + finance!.height).toBeLessThanOrEqual(844 * 2.5);
});

test("respeita tema escuro e movimento reduzido do sistema", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByRole("progressbar", { name: "Semana dos hábitos" })).toHaveAttribute("aria-valuenow", "67");
  const lightBackground = await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const darkBackground = await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);
  expect(darkBackground).not.toBe(lightBackground);
  for (const link of await page.getByRole("main").getByRole("link").all()) {
    const motion = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      return { transition: style.transitionDuration, animation: style.animationName };
    });
    expect(motion).toEqual({ transition: "0s", animation: "none" });
  }
  await page.screenshot({ path: "test-results/home-dark.png", fullPage: true });
});

test("concluir e reabrir preserva foco e atualiza contadores sem recarregar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const focus = page.getByRole("region", { name: "Em foco", exact: true });
  await expect(page.locator(".home-summary")).toContainText("5 tarefas abertas");
  await focus.getByRole("button", { name: "Concluir agora", exact: true }).click();
  await expect(focus.getByRole("button", { name: "Reabrir tarefa", exact: true })).toBeEnabled();
  await expect(page.locator(".home-summary")).toContainText("4 tarefas abertas");
  const stats = page.locator(".home-stats");
  await expect(stats.locator("div").filter({ hasText: "Concluídas na semana" }).locator("dd")).toHaveText("3");
  await focus.getByRole("button", { name: "Reabrir tarefa", exact: true }).click();
  await expect(focus.getByRole("button", { name: "Concluir agora", exact: true })).toBeEnabled();
  await expect(page.locator(".home-summary")).toContainText("5 tarefas abertas");
  await expect(stats.locator("div").filter({ hasText: "Concluídas na semana" }).locator("dd")).toHaveText("2");
  await focus.getByRole("link", { name: "Abrir tarefa" }).click();
  await expect(page).toHaveURL(/\/tarefas\?task=task-milestones$/);
  await expect(page.getByRole("heading", { name: "Tarefas", level: 1, exact: true })).toBeVisible();
});

test("marcar hábito deriva a meta semanal e desfazer restaura o resumo", async ({ page }) => {
  await page.goto("/");
  const habits = page.getByRole("region", { name: "Hábitos de hoje" });
  const progress = habits.getByRole("progressbar", { name: "Semana dos hábitos" });
  await expect(progress).toHaveAttribute("aria-valuenow", "67");
  await habits.getByRole("button", { name: "Marcar Academia como feito", exact: true }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "83");
  await expect(habits.getByText("3 de 3 nesta semana")).toBeVisible();
  await habits.getByRole("button", { name: "Desmarcar Academia", exact: true }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "67");
  await expect(habits.getByText("2 de 3 nesta semana")).toBeVisible();
});

test("preferência e entitlement retiram seus blocos e contadores do Início", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("segundo-cerebro-demo-navigation-v1", JSON.stringify({
    version: 1, entitlements: { financeiro: false }, preferences: { tarefas: { visible: false, order: 1 }, habitos: { visible: false, order: 2 } }, isAdmin: false,
  })));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Agenda de hoje" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Caixa de entrada" })).toBeVisible();
  for (const title of ["Em foco", "Tarefas de hoje", "Hábitos de hoje", "Pulso financeiro"]) {
    await expect(page.getByRole("region", { name: title, exact: true })).toHaveCount(0);
  }
  await expect(page.locator(".home-summary")).not.toContainText("tarefas");
  await expect(page.locator(".home-stats")).not.toContainText("Tarefas abertas");
  await expect(page.locator(".home-stats")).not.toContainText("Concluídas na semana");
  // A preference hides shortcuts while the module's direct route stays allowed.
  await page.goto("/tarefas");
  await expect(page.locator('[data-access="allowed"]')).toBeVisible();
  await page.goto("/financeiro");
  await expect(page.locator('[data-access="denied"]')).toBeVisible();
});

test("todos os blocos ocultos oferecem uma escolha clara de módulos", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("segundo-cerebro-demo-navigation-v1", JSON.stringify({
    version: 1, entitlements: {}, preferences: Object.fromEntries(["tarefas", "capturar", "habitos", "financeiro", "calendario"].map((key, order) => [key, { visible: false, order }])), isAdmin: false,
  })));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Escolha o que faz parte do seu dia" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Escolher módulos" })).toHaveAttribute("href", "/configuracoes");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.locator(".home-stats")).toHaveCount(0);
});
