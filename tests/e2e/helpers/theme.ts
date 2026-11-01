import { expect, type Page } from "@playwright/test";

/** One click on the workspace header toggle swaps the resolved theme. */
export const themeToggle = (page: Page) => page.getByRole("button", { name: /^Ativar tema (claro|escuro)$/ });

/** Reach an explicit light/dark theme through the header toggle, whatever the current one is. */
export async function chooseTheme(page: Page, theme: "light" | "dark") {
  const html = page.locator("html");
  if ((await html.getAttribute("data-theme")) !== theme) await themeToggle(page).click();
  await expect(html).toHaveAttribute("data-theme", theme);
}
