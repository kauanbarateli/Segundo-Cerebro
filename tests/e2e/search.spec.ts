import { expect, test } from "@playwright/test";
for (const row of [
  { query: "decisoes de arquitetura", title: "Decisões de arquitetura", group: "Capturas", path: /\/capturar\?capture=architecture/, field: "Título da nota" },
  { query: "estudar rls de moderacao", title: "Estudar RLS de moderação", group: "Tarefas", path: /\/tarefas\?task=task-rls/, field: "Título" },
  { query: "segundo cerebro v2", title: "Segundo Cérebro V2", group: "Projetos", path: /\/projetos\?project=project-sc-v2/ },
]) test("busca abre o registro certo em " + row.group, async ({ page }) => {
  await page.goto("/"); await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Buscar", exact: true });
  await dialog.getByRole("combobox").fill(row.query);
  const group = dialog.locator("section").filter({ has: page.getByRole("heading", { name: row.group, exact: true }) });
  await group.getByRole("option", { name: row.title, exact: true }).click();
  await expect(page).toHaveURL(row.path);
  if (row.field) await expect(page.getByLabel(row.field, { exact: true })).toHaveValue(row.title);
  else await expect(page.getByRole("heading", { name: row.title, exact: true })).toBeVisible();
});
test("atalho nova tarefa pode ser usado de novo após fechar", async ({ page }) => {
  await page.goto("/tarefas");
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Buscar", exact: true });
    await dialog.getByRole("combobox").fill("nova tarefa");
    await dialog.getByRole("option", { name: "Nova tarefa", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Nova tarefa", exact: true });
    await expect(editor).toBeVisible(); await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(editor).toBeHidden();
  }
});
