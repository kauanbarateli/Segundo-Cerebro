import { expect, test } from "@playwright/test";

const LONG = "Projeto com título muito longo que precisa quebrar linhas sem estourar a grade";

for (const [width, theme] of [[1280, "light"], [1100, "dark"], [390, "dark"]] as const) {
  test(`A05: cartões de projeto com título longo e sem capa não quebram a composição em ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/projetos");
    await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Novo projeto", exact: true });
    await editor.getByLabel("Nome do projeto", { exact: true }).fill(LONG);
    await editor.getByRole("button", { name: "Criar projeto", exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByRole("heading", { name: LONG, exact: true }).first()).toBeVisible();
    await page.locator("a.project-back").click();
    const card = page.getByRole("link", { name: new RegExp("^" + LONG.slice(0, 40)) });
    await expect(card).toBeVisible();
    const bounds = await card.evaluate(element => {
      const box = element.getBoundingClientRect(), footer = element.querySelector("footer")!.getBoundingClientRect(), grid = element.parentElement!.getBoundingClientRect();
      return { left: box.left, right: box.right, gridLeft: grid.left, gridRight: grid.right, footerBottom: footer.bottom, bottom: box.bottom, cover: !!element.querySelector(".project-cover") };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(bounds.gridLeft - 1); expect(bounds.right).toBeLessThanOrEqual(bounds.gridRight + 1);
    expect(bounds.footerBottom).toBeLessThanOrEqual(bounds.bottom);
    expect(bounds.cover).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await card.click();
    await expect(page).toHaveURL(/\/projetos\?project=/);
    await expect(page.getByRole("heading", { name: LONG, exact: true }).first()).toBeVisible();
  });
}
