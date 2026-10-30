import { expect, test } from "@playwright/test";
import { MVP_WORKSPACE_ROUTES as WORKSPACE_ROUTES } from "../../src/lib/navigation/routes";

for (const width of [320, 768, 1280]) {
  test(`todas as rotas são navegáveis e sem transbordo em ${width}px`, async ({ page }) => {
    // A single test traverses every module, including the lazy editor and Vault.
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/configuracoes");
    await page.getByRole("combobox", { name: "Privilégio Admin da demonstração" }).selectOption("enabled");

    for (const route of WORKSPACE_ROUTES) {
      // Layout Codex: phones (≤600px) open the same sidebar as a modal menu.
      let destination = width <= 600
        ? page.getByRole("navigation", { name: "Navegação no celular", exact: true }).getByRole("link", { name: route.label, exact: true })
        : page.getByRole("complementary", { name: "Trilho de navegação", exact: true }).getByRole("link", { name: route.label, exact: true });
      if (width <= 600 && await destination.count() === 0) {
        await page.getByRole("button", { name: "Mais módulos e conta" }).click();
        destination = page.getByRole("dialog", { name: "Menu de navegação", exact: true }).getByRole("link", { name: route.label, exact: true });
      }
      await destination.click();
      await expect(page).toHaveURL(new RegExp(`${route.href === "/" ? "/" : route.href}$`));
      await expect(page.getByRole("heading", { name: route.label, level: 1, exact: true })).toBeVisible();
      await expect(page).toHaveTitle(`${route.label} · Segundo Cérebro`);
      await expect(page.locator(".home-skeleton, .tasks-skeleton, .capture-loading")).toHaveCount(0);
      const overflow = await page.evaluate(() => ({
        viewport: innerWidth,
        page: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll("body *")].filter((element) => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return style.display !== "none" && bounds.width > 0 && bounds.right > innerWidth + 1 && style.position !== "fixed";
        }).map((element) => `${element.tagName}.${element.className}`).slice(0, 8),
      }));
      expect(overflow.page, `${route.href}: ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(width);
    }
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/shell-${width}.png`, fullPage: true });
  });
}

test("recolher devolve exatamente 156px ao conteúdo, persiste e não remonta a página", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/capturar");
  const measure = () => page.locator(".shell-workspace").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, width: box.width };
  });
  const rail = page.getByRole("complementary", { name: "Trilho de navegação", exact: true });
  const expanded = await measure();
  expect(expanded.x).toBe(232);
  await expect(rail).toHaveCSS("width", "232px");
  // Unsaved text survives the presentation change: the main tree is not remounted.
  const draft = page.getByRole("main").getByRole("textbox").first();
  await draft.fill("Rascunho que não pode sumir");
  const toggle = page.getByRole("button", { name: "Recolher navegação" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(page.getByRole("button", { name: "Expandir navegação" })).toHaveAttribute("aria-expanded", "false");
  await expect.poll(measure).toEqual({ x: 76, width: expanded.width + 156 });
  await expect(rail).toHaveCSS("width", "76px");
  await expect(draft).toHaveValue("Rascunho que não pode sumir");
  // Collapsed links keep their names and gain a visible tooltip on keyboard focus.
  const tasks = rail.getByRole("link", { name: "Tarefas", exact: true });
  await tasks.focus();
  await expect(page.getByRole("tooltip")).toHaveText("Tarefas");
  await expect(tasks).toHaveAttribute("aria-describedby", "shell-nav-tip");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.reload();
  await expect(rail).toHaveCSS("width", "76px");
  await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
  await page.getByRole("button", { name: "Expandir navegação" }).click();
  await expect.poll(measure).toEqual(expanded);
});

test("sem escolha salva, a lateral começa recolhida até 1050px e a escolha manual prevalece", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto("/");
  const rail = page.getByRole("complementary", { name: "Trilho de navegação", exact: true });
  await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
  await expect(rail).toHaveCSS("width", "76px");
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("html")).toHaveAttribute("data-sidebar", "expanded");
  await page.setViewportSize({ width: 900, height: 900 });
  await page.getByRole("button", { name: "Expandir navegação" }).click();
  await expect(rail).toHaveCSS("width", "232px");
  await page.reload();
  await expect(rail).toHaveCSS("width", "232px");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("menu do celular é modal: foco contido, fundo inerte e retorno ao abridor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Abrir navegação" });
  await opener.click();
  const menu = page.getByRole("dialog", { name: "Menu de navegação", exact: true });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("aria-modal", "true");
  const close = menu.getByRole("button", { name: "Fechar navegação" });
  await expect(close).toBeFocused();
  await expect(page.locator(".shell-workspace")).toHaveJSProperty("inert", true);
  await expect(page.getByRole("navigation", { name: "Navegação no celular", exact: true })).toHaveJSProperty("inert", true);
  await page.keyboard.press("Shift+Tab");
  await expect(menu.getByRole("link", { name: "Segundo Cérebro · Início" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(menu.getByRole("button", { name: "Abrir perfil de demonstração" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("link", { name: "Segundo Cérebro · Início" })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".shell-workspace")).toHaveJSProperty("inert", false);
});

test("preferência oculta atalhos, mas preserva rota; veto bloqueia endereço direto", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/configuracoes");
  await page.getByRole("combobox", { name: "Visibilidade na navegação" }).selectOption("hidden");
  await expect(page.getByRole("navigation", { name: "Navegação principal", exact: true }).getByRole("link", { name: "Tarefas", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Abrir Tarefas pelo endereço" }).click();
  await expect(page.locator('[data-access="allowed"]')).toBeVisible();
  await page.goto("/tarefas");
  await expect(page.locator('[data-access="allowed"]')).toBeVisible();
  await page.goto("/configuracoes");
  await expect(page.getByRole("combobox", { name: "Visibilidade na navegação" })).toHaveValue("hidden");
  await page.getByRole("combobox", { name: "Visibilidade na navegação" }).selectOption("visible");
  await page.getByRole("combobox", { name: "Entitlement simulado" }).selectOption("denied");
  await expect(page.getByRole("navigation", { name: "Navegação principal", exact: true }).getByRole("link", { name: "Tarefas", exact: true })).toHaveCount(0);
  await page.goto("/tarefas");
  await expect(page.locator('[data-access="denied"]')).toBeVisible();
  await page.getByRole("link", { name: "Rever opções de demonstração" }).click();
  await page.getByRole("combobox", { name: "Entitlement simulado" }).selectOption("allowed");
  await expect(page.getByRole("navigation", { name: "Navegação principal", exact: true }).getByRole("link", { name: "Tarefas", exact: true })).toBeVisible();
});

test("Admin exige privilégio simulado explícito e Sair o restaura", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.locator('[data-access="denied"]')).toBeVisible();
  await page.getByRole("link", { name: "Rever opções de demonstração" }).click();
  await page.getByRole("combobox", { name: "Privilégio Admin da demonstração" }).selectOption("enabled");
  await page.goto("/admin");
  await expect(page.locator('[data-access="allowed"]')).toBeVisible();
  await page.getByRole("button", { name: "Abrir perfil de demonstração" }).click();
  const profile = page.locator("#shell-profile");
  await expect(profile).toBeVisible();
  await profile.getByRole("link", { name: "Sair da demonstração" }).click();
  await expect(page.getByRole("heading", { name: "Demonstração encerrada" })).toBeVisible();
  await page.getByRole("link", { name: "Voltar à demonstração" }).click();
  await page.goto("/admin");
  await expect(page.locator('[data-access="denied"]')).toBeVisible();
});

test("Mais oferece Ajuda e Sair, fecha com Escape e devolve foco", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Mais módulos e conta" });
  await trigger.click();
  const more = page.getByRole("dialog", { name: "Menu de navegação", exact: true });
  await expect(more.getByRole("link", { name: "Ajuda", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(more).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await more.getByRole("link", { name: "Ajuda", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ajuda", level: 1 })).toBeVisible();
  await trigger.click();
  await more.getByRole("button", { name: "Abrir perfil de demonstração" }).click();
  await page.locator("#shell-profile").getByRole("link", { name: "Sair da demonstração" }).click();
  await expect(page.getByRole("heading", { name: "Demonstração encerrada" })).toBeVisible();
});

test("busca compacta abre com atalho, filtra acentos e navega com teclado", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-access="allowed"]')).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Buscar", exact: true });
  const field = dialog.getByRole("combobox", { name: "Buscar informações e módulos" });
  await expect(field).toBeFocused();
  await field.fill("calendario");
  await expect(dialog.getByRole("status")).toContainText("1 atalho disponível");
  await field.press("Tab");
  await expect(dialog.getByRole("option", { name: "Calendário", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/calendario$/);
  await page.getByRole("button", { name: "Buscar informações", exact: true }).click();
  await field.fill("nenhum módulo corresponde");
  await expect(dialog.getByText(/Nenhum resultado/)).toBeVisible();
  await field.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Buscar informações", exact: true })).toBeFocused();
});

test("skip-link é o primeiro alvo e o trilho segue a ordem visual no teclado", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".shell-brand")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Buscar informações", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const nav = page.getByRole("navigation", { name: "Navegação principal", exact: true });
  await expect(nav.getByRole("link", { name: "Início", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: "Capturar", exact: true })).toBeFocused();
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("armazenamento bloqueado mantém alterações locais e controles funcionais", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Bloqueado", "SecurityError"); } }));
  await page.goto("/configuracoes");
  await page.getByRole("combobox", { name: "Entitlement simulado" }).selectOption("denied");
  await page.getByRole("link", { name: "Abrir Tarefas pelo endereço" }).click();
  await expect(page.locator('[data-access="denied"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-access="allowed"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("tema escuro e movimento reduzido preservam alvos do shell no celular", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  for (const control of await page.locator('.shell-topbar :is(a, button, select), .shell-bottom :is(a, button)').all()) {
    if (!await control.isVisible()) continue;
    const bounds = await control.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator(".shell-top-search")).toHaveCSS("transition-duration", "0s");
  await page.screenshot({ path: "test-results/shell-dark-mobile.png", fullPage: true });
});

test("endereço inexistente fora do workspace mostra 404 em português com tokens e caminho de volta", async ({ page }) => {
  for (const [width, theme] of [[390, "light"], [1280, "dark"]] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width, height: 800 });
    const response = await page.goto("/rota-inexistente");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("Página não encontrada · Segundo Cérebro");
    await expect(page.getByRole("heading", { level: 1, name: "Esta página não existe" })).toBeVisible();
    const back = page.getByRole("link", { name: "Voltar ao Início", exact: true });
    const box = (await back.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe(await page.evaluate(() => { const probe = document.createElement("i"); probe.style.color = "var(--canvas)"; document.body.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; }));
  }
  await page.getByRole("link", { name: "Voltar ao Início", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();
});
