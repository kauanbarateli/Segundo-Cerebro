import { expect, test } from "@playwright/test";

// DS 2.1 canvas values: doc 14 and the approved prototype, not DS 1.0.
const LIGHT_CANVAS = "rgb(245, 245, 242)";
const DARK_CANVAS = "rgb(13, 13, 12)";

test("a barra do navegador acompanha a escolha explícita, independente do SO", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const selector = page.getByRole("combobox", { name: "Tema", exact: true });
  await selector.selectOption("dark");
  const themeColor = page.locator('meta[name="theme-color"]');
  await expect(themeColor).toHaveCount(1);
  await expect(themeColor).toHaveAttribute("content", "#0d0d0c");
  await expect(themeColor).not.toHaveAttribute("media");
  await page.getByRole("complementary", { name: "Trilho de navegação", exact: true }).getByRole("link", { name: "Ajuda", exact: true }).click();
  await expect(page).toHaveURL(/\/ajuda$/);
  await page.getByRole("link", { name: "Fundamentos visuais", exact: true }).click();
  await expect(page).toHaveURL(/\/design-system$/);
  await expect(themeColor).toHaveAttribute("content", "#0d0d0c");
  await page.emulateMedia({ colorScheme: "dark" });
  await selector.selectOption("light");
  await expect(themeColor).toHaveAttribute("content", "#f5f5f2");
  await selector.selectOption("system");
  await expect(themeColor).toHaveAttribute("content", "#0d0d0c");
});

test("a escolha de tema persiste depois de recarregar a página", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const selector = page.getByRole("combobox", { name: "Tema", exact: true });
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_CANVAS);
  await selector.selectOption("dark");
  await expect(page.locator("body")).toHaveCSS("background-color", DARK_CANVAS);
  await page.reload();
  await expect(selector).toHaveValue("dark");
  await expect(page.locator("body")).toHaveCSS("background-color", DARK_CANVAS);
  await selector.selectOption("light");
  await page.reload();
  await expect(selector).toHaveValue("light");
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_CANVAS);
});

test("Sistema acompanha mudanças do SO enquanto a página permanece aberta", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/design-system");
  const selector = page.getByRole("combobox", { name: "Tema", exact: true });
  await expect(selector).toHaveValue("system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS("background-color", DARK_CANVAS);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_CANVAS);
});

test("escolha explícita ignora o SO até voltar para Sistema", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const selector = page.getByRole("combobox", { name: "Tema", exact: true });
  await selector.selectOption("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_CANVAS);
  await selector.selectOption("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("body")).toHaveCSS("background-color", DARK_CANVAS);
  await selector.selectOption("system");
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_CANVAS);
  await page.reload();
  await expect(selector).toHaveValue("system");
});

for (const saved of [null, "light", "dark", "system", "inválido"]) {
  test(`resolve preferência ${saved ?? "ausente"} no head sem depender da hidratação`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript((preference) => {
      if (preference !== null) localStorage.setItem("segundo-cerebro-theme", preference);
    }, saved);
    // No React bundle runs: the assertion cannot pass thanks to a later effect.
    await page.route("**/_next/**/*.js*", (route) => route.abort());
    await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(await page.locator("html").getAttribute("data-theme")).toBe(saved === "light" ? "light" : "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", saved === "light" ? LIGHT_CANVAS : DARK_CANVAS);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", saved === "light" ? "#f5f5f2" : "#0d0d0c");
  });
}

test("a preferência se propaga entre abas e sua remoção volta ao sistema", async ({ context, page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const secondPage = await context.newPage();
  await secondPage.emulateMedia({ colorScheme: "light" });
  await secondPage.goto("/design-system");
  const firstSelector = page.getByRole("combobox", { name: "Tema", exact: true });
  const secondSelector = secondPage.getByRole("combobox", { name: "Tema", exact: true });
  await firstSelector.selectOption("dark");
  await expect(secondSelector).toHaveValue("dark");
  await expect(secondPage.locator("body")).toHaveCSS("background-color", DARK_CANVAS);
  await secondSelector.selectOption("light");
  await expect(firstSelector).toHaveValue("light");
  await firstSelector.selectOption("dark");
  await expect(secondSelector).toHaveValue("dark");
  await page.evaluate(() => localStorage.removeItem("segundo-cerebro-theme"));
  await expect(secondSelector).toHaveValue("system");
  await expect(secondPage.locator("body")).toHaveCSS("background-color", LIGHT_CANVAS);
});

test("armazenamento indisponível mantém a página e a troca de tema funcionando", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Armazenamento bloqueado", "SecurityError"); },
    });
  });
  await page.goto("/");
  const selector = page.getByRole("combobox", { name: "Tema", exact: true });
  await expect(page.locator("body")).toHaveCSS("background-color", DARK_CANVAS);
  await selector.selectOption("light");
  await expect(selector).toHaveValue("light");
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_CANVAS);
  await page.reload();
  await expect(selector).toHaveValue("system");
  await expect(page.locator("body")).toHaveCSS("background-color", DARK_CANVAS);
  expect(errors).toEqual([]);
});

test("a preferência salva hidrata sem divergência de marcação", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("segundo-cerebro-theme", "dark"));
  await page.goto("/design-system");
  await expect(page.getByRole("combobox", { name: "Tema", exact: true })).toHaveValue("dark");
  await expect(page.locator("body")).toHaveCSS("background-color", DARK_CANVAS);
  expect(errors).toEqual([]);
});
