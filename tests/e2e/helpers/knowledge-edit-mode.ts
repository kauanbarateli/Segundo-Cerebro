import { expect, type Page } from "@playwright/test";

/** The real reading-to-editing action is part of every editing acceptance. */
export async function beginKnowledgeEdit(page: Page) {
  const editor = page.getByRole("textbox", { name: "Conteúdo da página", exact: true });
  const enter = page.getByRole("button", { name: /^(Editar página|Retomar edição)$/ });
  await expect(editor.or(enter)).toBeVisible();
  if (await enter.isVisible()) await enter.click();
  await expect(editor).toBeVisible();
  // Notebook, parent page and links live in the on-demand "Configurações da nota" panel.
  const settings = page.getByRole("button", { name: "Configurações da nota", exact: true });
  if ((await settings.getAttribute("aria-expanded")) === "false") await settings.click();
}
