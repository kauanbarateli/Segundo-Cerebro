import { expect, type Page } from "@playwright/test";

/** The formatting commands live behind the "Formatação" disclosure; opening it twice is a no-op. */
export async function openFormatting(page: Page) {
  const toggle = page.getByRole("button", { name: "Formatação", exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(page.getByRole("toolbar", { name: "Formatação do texto", exact: true })).toBeVisible();
}
