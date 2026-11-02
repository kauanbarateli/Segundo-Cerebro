import { expect, test, type Page } from "@playwright/test";

/**
 * doc21 — dock desktop opt-in. Each test names the N-criteria it covers. The
 * demo needs no account; the preference is browser-local (no POST, no migration).
 */
const KEY = "segundo-cerebro-desktop-navigation-v1";
const SIDEBAR_KEY = "segundo-cerebro-sidebar";

const dock = (page: Page) => page.locator("nav.desktop-dock");
const rail = (page: Page) => page.getByRole("complementary", { name: "Trilho de navegação", exact: true });
const dockLink = (page: Page, name: string) => dock(page).getByRole("link", { name, exact: true });

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

async function applyNavigation(page: Page, option: "Menu lateral" | "Dock inferior", status = "Navegação atualizada neste navegador.") {
  if (!new URL(page.url()).pathname.startsWith("/configuracoes")) await page.goto("/configuracoes#aparencia");
  const group = page.getByRole("group", { name: "Navegação no computador" });
  await group.getByRole("radio", { name: new RegExp(option) }).check();
  await group.getByRole("button", { name: "Aplicar navegação" }).click();
  await expect(group.getByRole("status").filter({ hasText: status })).toBeVisible();
}

async function expectDock(page: Page) {
  await expect(dock(page)).toBeVisible();
  await expect(rail(page)).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-desktop-navigation", "dock");
}

async function expectSidebar(page: Page) {
  await expect(rail(page)).toBeVisible();
  await expect(dock(page)).toBeHidden();
}

const tipOpacity = (page: Page, index: number) => dock(page).locator("[data-dock-item]").nth(index).locator(".desktop-dock__tip").evaluate((element) => Number(getComputedStyle(element).opacity));

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
}

test.describe("desktop 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const [label, value] of [["sem chave", null], ["maiúsculas", "DOCK"], ["JSON", '{"mode":"dock"}'], ["vazio", ""], ["lixo", "true"]] as const) {
    test(`N01: ${label} pinta a lateral, nunca a dock`, async ({ page }) => {
      const errors = collectErrors(page);
      if (value !== null) await page.addInitScript(([key, raw]) => { localStorage.setItem(key, raw); }, [KEY, value] as const);
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-desktop-navigation", "sidebar");
      await expectSidebar(page);
      expect(errors).toEqual([]);
    });
  }

  test("N01: storage inacessível no script inicial não quebra a página", async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("blocked", "SecurityError"); } }); });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-desktop-navigation", "sidebar");
    await expectSidebar(page);
    expect(errors.filter((message) => !/blocked|SecurityError/.test(message))).toEqual([]);
  });

  test("N02/N03: rádio é rascunho; Aplicar troca, recarregar preserva e voltar devolve a lateral recolhida", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Recolher navegação" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
    const sidebarChoice = await page.evaluate((key) => localStorage.getItem(key), SIDEBAR_KEY);

    await page.goto("/configuracoes#aparencia");
    const group = page.getByRole("group", { name: "Navegação no computador" });
    await expect(group.getByRole("radio", { name: /Menu lateral/ })).toBeChecked();
    await expect(group.getByRole("button", { name: "Aplicar navegação" })).toHaveAttribute("aria-disabled", "true");
    await group.getByRole("radio", { name: /Dock inferior/ }).check();
    // N03: selecting only edits the draft.
    await expectSidebar(page);
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
    await group.getByRole("button", { name: "Aplicar navegação" }).click();
    await expectDock(page);
    // N02: the collapse toggle is a sidebar control; it never selects the dock.
    await expect(page.getByRole("button", { name: /Recolher navegação|Expandir navegação/ })).toBeHidden();
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("dock");
    expect(await page.evaluate((key) => localStorage.getItem(key), SIDEBAR_KEY)).toBe(sidebarChoice);

    await page.reload();
    await expectDock(page);
    await page.goto("/tarefas");
    await expectDock(page);
    await expect(dockLink(page, "Tarefas")).toHaveAttribute("aria-current", "page");

    await applyNavigation(page, "Menu lateral");
    await expectSidebar(page);
    await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
    await expect(page.getByRole("button", { name: "Expandir navegação" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("N04: storage bloqueado aplica só nesta visita e avisa; recarregar volta ao padrão", async ({ page }) => {
    await page.addInitScript((key) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(name: string, value: string) { if (name === key) throw new DOMException("quota", "QuotaExceededError"); return original.call(this, name, value); };
    }, KEY);
    await page.goto("/configuracoes#aparencia");
    await applyNavigation(page, "Dock inferior", "Aplicado nesta visita. O navegador não permitiu salvar a preferência.");
    await expectDock(page);
    await dockLink(page, "Tarefas").click();
    await expect(page).toHaveURL(/\/tarefas$/);
    await expectDock(page);
    await page.reload();
    await expectSidebar(page);
  });

  test("N05: aplicar não faz POST, não mexe em URL/hash, tema nem rolagem", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (request) => { if (request.method() !== "GET" && request.method() !== "HEAD") posts.push(`${request.method()} ${request.url()}`); });
    await page.goto("/configuracoes?origem=teste#aparencia");
    const theme = await page.locator("html").getAttribute("data-theme");
    await page.getByRole("group", { name: "Navegação no computador" }).scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    await applyNavigation(page, "Dock inferior");
    await expectDock(page);
    expect(page.url()).toMatch(/\/configuracoes\?origem=teste#aparencia$/);
    expect(await page.locator("html").getAttribute("data-theme")).toBe(theme);
    expect(Math.abs(await page.evaluate(() => scrollY) - scroll)).toBeLessThanOrEqual(2);
    expect(posts).toEqual([]);
  });

  test("N06: outra aba acompanha; rascunho local sobrevive à mudança remota; sair preserva só a apresentação", async ({ page, context }) => {
    await page.goto("/configuracoes");
    await page.getByRole("combobox", { name: "Privilégio Admin da demonstração" }).selectOption("enabled");
    const other = await context.newPage();
    await other.goto("/configuracoes#aparencia");
    const otherGroup = other.getByRole("group", { name: "Navegação no computador" });
    // An explicit unapplied choice: the person picked Dock, then went back to "Menu lateral".
    await otherGroup.getByRole("radio", { name: /Dock inferior/ }).check();
    await otherGroup.getByRole("radio", { name: /Menu lateral/ }).check();

    await applyNavigation(page, "Dock inferior");
    await expectDock(other);
    // The other tab had an explicit unapplied choice: it is kept, with a notice.
    await expect(otherGroup.getByRole("radio", { name: /Menu lateral/ })).toBeChecked();
    await expect(otherGroup.getByText("A navegação mudou em outra aba. Sua seleção continua aqui até você aplicar.")).toBeVisible();
    await otherGroup.getByRole("button", { name: "Aplicar navegação" }).click();
    await expectSidebar(other);
    await expectSidebar(page);

    await applyNavigation(page, "Dock inferior");
    await expectDock(other);
    await other.close();
    await expect(dockLink(page, "Admin")).toBeVisible();
    await page.getByRole("button", { name: "Abrir perfil de demonstração" }).click();
    await page.getByRole("link", { name: "Sair da demonstração" }).click();
    await page.goto("/");
    await expectDock(page);
    await expect(dockLink(page, "Admin")).toHaveCount(0);
  });

  test("N09: teclado, dica no foco, Escape, sem armadilha nem landmark duplicado", async ({ page }) => {
    await page.goto("/configuracoes#aparencia");
    await applyNavigation(page, "Dock inferior");
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Navegação principal", exact: true })).toHaveCount(1);
    // Keyboard focus (focus-visible) shows the name; Escape hides it without moving focus.
    await dock(page).locator("[data-dock-item]").nth(1).focus();
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => tipOpacity(page, 0)).toBe(1);
    await page.keyboard.press("Escape");
    await expect.poll(() => tipOpacity(page, 0)).toBe(0);
    expect(await page.evaluate(() => document.activeElement?.matches(".desktop-dock [data-dock-item]"))).toBe(true);
    await page.keyboard.press("Tab");
    await expect.poll(() => tipOpacity(page, 1)).toBe(1);
    // Tab leaves the dock after its last control and Shift+Tab comes back: no focus trap.
    await dock(page).locator("[data-dock-item]").last().focus();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".desktop-dock")))).toBe(false);
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => document.activeElement === [...document.querySelectorAll(".desktop-dock [data-dock-item]")].at(-1))).toBe(true);
    // Enter follows a real link.
    await dockLink(page, "Calendário").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/calendario$/);
    await expect(dockLink(page, "Calendário")).toHaveAttribute("aria-current", "page");
    await expect(dockLink(page, "Calendário")).toHaveAttribute("href", "/calendario");
  });

  test("N09: movimento reduzido não amplia; hover amplia e o tamanho volta ao repouso", async ({ page }) => {
    await page.goto("/configuracoes#aparencia");
    await applyNavigation(page, "Dock inferior");
    await page.goto("/");
    const item = dockLink(page, "Tarefas");
    const tile = item.locator(".desktop-dock__tile");
    await item.hover();
    await expect.poll(async () => (await tile.boundingBox())?.width ?? 0).toBeGreaterThan(54);
    await page.mouse.move(720, 200);
    await expect.poll(async () => Math.round((await tile.boundingBox())?.width ?? 0)).toBe(44);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await item.hover();
    await page.waitForTimeout(300);
    expect(Math.round((await tile.boundingBox())?.width ?? 0)).toBe(44);
  });

  test("N10: busca, Ctrl+K, conta, perfil, ajuda, Configurações e Sair continuam alcançáveis", async ({ page }) => {
    await page.goto("/configuracoes#aparencia");
    await applyNavigation(page, "Dock inferior");
    await page.goto("/tarefas");
    await page.getByRole("button", { name: "Buscar informações" }).click();
    await expect(page.getByRole("dialog", { name: "Buscar" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Buscar" })).toBeHidden();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Buscar" })).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(dockLink(page, "Configurações")).toBeVisible();
    await expect(dockLink(page, "Integrações")).toBeVisible();
    const account = page.getByRole("button", { name: "Abrir perfil de demonstração" });
    await expect(account).toHaveCount(1);
    await account.click();
    const popover = page.locator("#shell-profile");
    await expect(popover).toBeVisible();
    for (const name of ["Meu perfil", "Configurações", "Sair da demonstração"]) await expect(popover.getByRole("link", { name, exact: true })).toBeVisible();
    const box = await popover.boundingBox(), viewport = page.viewportSize()!;
    expect(box && box.x >= 0 && box.x + box.width <= viewport.width && box.y >= 0).toBe(true);
    // Every link in the account menu points somewhere real (no dead flags).
    for (const href of await popover.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href")))) expect(href).toMatch(/^(\/|mailto:)/);
    await popover.getByRole("link", { name: "Meu perfil", exact: true }).click();
    await expect(page).toHaveURL(/\/configuracoes#perfil$/);
    await expect(popover).toBeHidden();
  });

  test("N11: Admin só com privilégio; vetar/ocultar segue a mesma política da lateral", async ({ page }) => {
    await page.goto("/configuracoes#aparencia");
    await applyNavigation(page, "Dock inferior");
    await expect(dockLink(page, "Admin")).toHaveCount(0);
    await page.getByRole("combobox", { name: "Privilégio Admin da demonstração" }).selectOption("enabled");
    await expect(dockLink(page, "Admin")).toBeVisible();
    const order = await dock(page).locator("a[data-dock-item], .desktop-dock__overflow a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    await applyNavigation(page, "Menu lateral");
    const sidebarOrder = await rail(page).locator(".shell-nav-link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    // Same destinations in the same order; the sidebar footer adds Help, which the dock keeps in the account menu.
    expect(sidebarOrder.filter((href) => order.includes(href))).toEqual(order.filter((href) => sidebarOrder.includes(href)));
    expect(order.every((href) => sidebarOrder.includes(href) || href === "/metricas")).toBe(true);
  });

  test("N13: contraste medido em claro e escuro; ativo não depende só da cor", async ({ page }) => {
    await page.goto("/configuracoes#aparencia");
    await applyNavigation(page, "Dock inferior");
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((value) => localStorage.setItem("segundo-cerebro-theme", value), theme);
      await page.goto("/tarefas");
      await dockLink(page, "Projetos").focus();
      await page.keyboard.press("Shift+Tab");
      await page.waitForFunction(() => { const tip = document.querySelector("[data-dock-item]:focus-visible .desktop-dock__tip"); return Boolean(tip) && getComputedStyle(tip!).opacity === "1"; });
      const ratios = await page.evaluate(() => {
        const rgb = (color: string) => { const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1; const context = canvas.getContext("2d")!; context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)]; };
        const luminance = (color: string) => { const [r, g, b] = rgb(color).map((value) => { const channel = value / 255; return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
        const ratio = (a: string, b: string) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high! + 0.05) / (low! + 0.05); };
        const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
        const tip = style("[data-dock-item]:focus-visible .desktop-dock__tip");
        const active = document.querySelector("[data-dock-item][aria-current='page'] .desktop-dock__tile")!;
        const idle = document.querySelector("[data-dock-item]:not([aria-current]) .desktop-dock__tile")!;
        return {
          tip: ratio(tip.color, tip.backgroundColor),
          activeIcon: ratio(getComputedStyle(active).color, getComputedStyle(active).backgroundColor),
          idleIcon: ratio(getComputedStyle(idle).color, getComputedStyle(idle).backgroundColor),
          tipOpacity: Number(tip.opacity),
          marker: (() => { const after = getComputedStyle(active.closest("[data-dock-item]")!, "::after"); return after.content !== "none" && parseFloat(after.width) > 0 && parseFloat(after.height) > 0; })(),
        };
      });
      expect(ratios.tip, theme).toBeGreaterThanOrEqual(4.5);
      expect(ratios.activeIcon, theme).toBeGreaterThanOrEqual(3);
      expect(ratios.idleIcon, theme).toBeGreaterThanOrEqual(3);
      expect(ratios.tipOpacity, theme).toBe(1);
      expect(ratios.marker, theme).toBe(true);
      await page.screenshot({ path: `test-results/dock-${theme}-1440.png` });
    }
  });

  test("N14: primeira pintura já é dock, sem erro de hidratação; JS falho mantém links navegáveis", async ({ page, browser }) => {
    const errors = collectErrors(page);
    await page.addInitScript((key) => {
      localStorage.setItem(key, "dock");
      document.addEventListener("DOMContentLoaded", () => {
        const dockElement = document.querySelector(".desktop-dock"), railElement = document.querySelector(".shell-sidebar");
        (window as unknown as { firstPaint: unknown }).firstPaint = {
          attribute: document.documentElement.getAttribute("data-desktop-navigation"),
          dock: dockElement ? getComputedStyle(dockElement).display : "missing",
          rail: railElement ? getComputedStyle(railElement).visibility : "missing",
        };
      });
    }, KEY);
    await page.goto("/tarefas?filtro=hoje#lista");
    expect(await page.evaluate(() => (window as unknown as { firstPaint: unknown }).firstPaint)).toEqual({ attribute: "dock", dock: "flex", rail: "hidden" });
    await expectDock(page);
    // Loading never moves focus: the skip link stays the first Tab stop.
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
    expect(page.url()).toMatch(/\/tarefas\?filtro=hoje#lista$/);
    expect(errors).toEqual([]);

    const broken = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      await broken.addInitScript((key) => localStorage.setItem(key, "dock"), KEY);
      await broken.route("**/_next/static/chunks/**", (route) => route.abort());
      const tab = await broken.newPage();
      await tab.goto("/");
      await expect(tab.locator("nav.desktop-dock")).toBeVisible();
      await tab.locator("nav.desktop-dock").getByRole("link", { name: "Tarefas", exact: true }).click();
      await expect(tab).toHaveURL(/\/tarefas$/);
    } finally { await broken.close(); }
  });

  test("N15: busca e captura ficam acima da dock com foco contido", async ({ page }) => {
    await page.goto("/configuracoes#aparencia");
    await applyNavigation(page, "Dock inferior");
    await page.goto("/");
    const center = await dock(page).evaluate((element) => { const box = element.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; });
    for (const open of [() => page.keyboard.press("Control+k"), () => page.getByRole("button", { name: "Capturar", exact: true }).click()]) {
      await open();
      const dialog = page.getByRole("dialog").last();
      await expect(dialog).toBeVisible();
      expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".desktop-dock")), center)).toBe(false);
      for (let index = 0; index < 8; index++) await page.keyboard.press("Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog, [role=dialog]")))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("N16: última ação do conteúdo fica acima da dock", async ({ page }) => {
    await page.goto("/configuracoes#aparencia");
    await applyNavigation(page, "Dock inferior");
    for (const path of ["/configuracoes", "/tarefas", "/projetos"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Lazy sections can still grow the page: scroll to the end and measure until it settles.
      await expect.poll(() => page.evaluate(() => {
        scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
        const dockTop = document.querySelector(".desktop-dock")!.getBoundingClientRect().top;
        const controls = [...document.querySelectorAll("main a, main button, main input, main select, main textarea, .shell-footer")].filter((element) => element.getBoundingClientRect().height > 0);
        return dockTop - Math.max(...controls.map((element) => element.getBoundingClientRect().bottom));
      }), { message: path }).toBeGreaterThanOrEqual(0);
    }
  });
});

test("N07/N08/N12: larguras, redimensionamento e transbordo sem cortar alvos", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/configuracoes");
  await page.getByRole("combobox", { name: "Privilégio Admin da demonstração" }).selectOption("enabled");
  await applyNavigation(page, "Dock inferior");

  for (const width of [320, 390, 600]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole("navigation", { name: "Navegação no celular" })).toBeVisible();
    await expect(dock(page)).toBeHidden();
    expect(await horizontalOverflow(page), `${width}`).toBeLessThanOrEqual(0);
  }
  for (const width of [601, 768, 1050]) {
    await page.setViewportSize({ width, height: 900 });
    await expectSidebar(page);
    expect(await horizontalOverflow(page), `${width}`).toBeLessThanOrEqual(0);
  }
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("dock");

  for (const width of [1051, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin");
    await expectDock(page);
    expect(await horizontalOverflow(page), `${width}`).toBeLessThanOrEqual(0);
    const geometry = await dock(page).evaluate((element) => {
      const box = element.getBoundingClientRect();
      const items = [...element.querySelectorAll<HTMLElement>("[data-dock-item], .desktop-dock__more")].map((item) => item.getBoundingClientRect());
      return { left: box.left, right: box.right, width: innerWidth, rows: new Set(items.map((item) => Math.round(item.top))).size, small: items.filter((item) => item.width < 44 || item.height < 44).length };
    });
    expect(geometry.left, `${width}`).toBeGreaterThanOrEqual(0);
    expect(geometry.right, `${width}`).toBeLessThanOrEqual(geometry.width);
    expect(geometry.rows, `${width}`).toBe(1);
    expect(geometry.small, `${width}`).toBe(0);
    // The current page is marked either on its own item or on "Mais áreas".
    const current = dock(page).locator("[data-dock-item][aria-current='page'], .desktop-dock__more[data-current]");
    await expect(current).toHaveCount(1);
  }

  // N12: the narrowest desktop overflows into "Mais áreas"; nothing is lost.
  await page.setViewportSize({ width: 1051, height: 700 });
  await page.goto("/cofre");
  const more = dock(page).getByRole("button", { name: /Mais áreas/ });
  if (await more.count()) {
    await more.click();
    const list = page.locator(".desktop-dock__overflow");
    await expect(list).toBeVisible();
    const links = await list.getByRole("link").count();
    expect(links).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
  }
  const all = await dock(page).locator("a").evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")))]);
  for (const href of ["/", "/tarefas", "/cofre", "/configuracoes", "/integracoes", "/admin"]) expect(all).toContain(href);

  // N08: focus on a dock item survives a resize back to the sidebar without staying on a hidden element.
  await page.setViewportSize({ width: 1440, height: 900 });
  await dockLink(page, "Tarefas").focus();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expectSidebar(page);
  // Focus follows to the same destination in the variant now shown, never stays on the hidden one.
  await expect(rail(page).getByRole("link", { name: "Tarefas", exact: true })).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectDock(page);
  await expect(dockLink(page, "Tarefas")).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("dock");
});

test("N07: toque sem ponteiro fino nunca ativa a dock", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true });
  try {
    await context.addInitScript((key) => localStorage.setItem(key, "dock"), KEY);
    const page = await context.newPage();
    const fine = await page.evaluate(() => matchMedia("(any-pointer: fine)").matches);
    await page.goto("/");
    if (fine) test.info().annotations.push({ type: "limitação", description: "o emulador manteve any-pointer:fine" });
    else await expect(page.locator("nav.desktop-dock")).toBeHidden();
    await page.goto("/configuracoes#aparencia");
    if (!fine) await expect(page.getByText("A navegação por dock está disponível no computador. Neste dispositivo, o menu atual é mantido.")).toBeVisible();
  } finally { await context.close(); }
});
