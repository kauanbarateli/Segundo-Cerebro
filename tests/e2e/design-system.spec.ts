import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`fundamentos visuais em ${width}px, ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto("/design-system");
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: "Fundamentos visuais" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", colorScheme);
      for (const name of ["Superfícies e tintas", "Cores semânticas", "Tipografia", "Raios"]) {
        await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
      }
      const control = page.getByRole("combobox", { name: "Tema" });
      const metrics = await control.evaluate((element) => ({ size: parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height }));
      expect(metrics.size).toBeGreaterThanOrEqual(16);
      expect(metrics.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const numbers = page.getByText("R$ 1.234,56 · 07/10/2026");
      await expect(numbers).toHaveCSS("font-variant-numeric", "tabular-nums");
      expect(errors).toEqual([]);
      await page.screenshot({ path: `test-results/design-system-${width}-${colorScheme}.png`, fullPage: true });
    });
  }
}

test("a ajuda mantém acesso aos fundamentos visuais a partir do início", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("complementary", { name: "Trilho de navegação", exact: true }).getByRole("link", { name: "Ajuda", exact: true }).click();
  await expect(page).toHaveURL(/\/ajuda$/);
  await page.getByRole("link", { name: "Fundamentos visuais" }).click();
  await expect(page).toHaveURL(/\/design-system$/);
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page).toHaveURL(/\/$/);
});
