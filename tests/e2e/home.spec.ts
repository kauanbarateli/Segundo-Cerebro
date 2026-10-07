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

test("o início oferece caminhos reais para captura e fundamentos visuais", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Explorar Capturar" })).toHaveAttribute("href", "/capturar");
  await expect(main.getByRole("link", { name: "Fundamentos visuais" })).toHaveAttribute("href", "/design-system");
  for (const link of await main.getByRole("link").all()) {
    const bounds = await link.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  }
});

test("respeita tema escuro e movimento reduzido do sistema", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/");
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
