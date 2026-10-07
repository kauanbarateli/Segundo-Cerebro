import { expect, test, type Locator, type Page } from "@playwright/test";

async function openTasks(page: Page) {
  await page.goto("/tarefas");
  await expect(page.getByRole("button", { name: "Nova tarefa", exact: true })).toBeVisible();
}
function taskRow(page: Page, width: number, title: string): Locator {
  return page.locator(width < 768 ? ".ui-data-table__cards > li" : ".ui-data-table tbody > tr").filter({ hasText: title });
}
async function fillTask(page: Page, title: string) {
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nova tarefa", exact: true });
  await form.getByLabel("Título", { exact: true }).fill(title);
  await form.getByLabel("Descrição", { exact: true }).fill("Preparar conteúdo e conferir a organização.");
  await form.getByLabel("Categoria", { exact: true }).selectOption({ index: 1 });
  await form.getByLabel("Projeto", { exact: true }).selectOption({ index: 1 });
  await form.getByLabel("Estado", { exact: true }).selectOption("done");
  await form.getByLabel("Prioridade", { exact: true }).selectOption("urgent");
  await form.getByLabel("Prazo", { exact: true }).fill("2026-10-14T14:30");
  await form.getByLabel("Início planejado", { exact: true }).fill("2026-10-14T13:00");
  await form.getByLabel("Término planejado", { exact: true }).fill("2026-10-14T14:00");
  await form.getByLabel("Estimativa em minutos", { exact: true }).fill("60");
  await form.getByText("Organização e origem", { exact: true }).click();
  await form.getByLabel("Ordem no quadro", { exact: true }).fill("2.5");
  await expect(form.getByText("Origem: entrada manual.", { exact: true })).toBeVisible();
  return form;
}

for (const width of [320, 1280]) {
  test(`tarefas: formulário completo e todas as ações em ${width}px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    await openTasks(page);
    const title = `Revisão café ${width}`;
    const form = await fillTask(page, title);
    const filterCategories = await page.getByLabel("Filtrar categoria", { exact: true }).locator("option").allTextContents();
    expect(await form.getByLabel("Categoria", { exact: true }).locator("option").allTextContents()).toEqual(filterCategories.slice(1));
    await form.getByRole("switch", { name: "Dia inteiro", exact: true }).click();
    await expect(form.getByLabel("Prazo", { exact: true })).toHaveValue("2026-10-14");
    await form.getByRole("switch", { name: "Dia inteiro", exact: true }).click();
    await expect(form.getByLabel("Prazo", { exact: true })).toHaveValue("2026-10-14T14:30");
    await form.getByRole("button", { name: "Criar tarefa", exact: true }).click();
    await expect(form).toBeHidden();
    await page.getByLabel("Buscar tarefas", { exact: true }).fill(`revisao cafe ${width}`);
    const row = taskRow(page, width, title);
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: title, exact: true }).click();
    const editing = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
    await expect(editing.getByLabel("Estado", { exact: true })).toHaveValue("done");
    await expect(editing.getByLabel("Prazo", { exact: true })).toHaveValue("2026-10-14T14:30");
    await expect(editing.getByLabel("Início planejado", { exact: true })).toHaveValue("2026-10-14T13:00");
    await expect(editing.getByLabel("Término planejado", { exact: true })).toHaveValue("2026-10-14T14:00");
    await expect(editing.getByLabel("Estimativa em minutos", { exact: true })).toHaveValue("60");
    await editing.getByText("Organização e origem", { exact: true }).click();
    await expect(editing.getByLabel("Ordem no quadro", { exact: true })).toHaveValue("2.5");
    await editing.getByLabel("Descrição", { exact: true }).fill("Descrição alterada, tarefa continua concluída.");
    await editing.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    await expect(editing).toBeHidden();
    await expect(row.getByText("Concluída", { exact: true })).toBeVisible();

    await row.getByRole("button", { name: `Ações de ${title}`, exact: true }).click();
    await page.getByRole("dialog", { name: "Ações da tarefa" }).getByRole("button", { name: "Reabrir tarefa", exact: true }).click();
    await page.getByLabel("Mostrar tarefas", { exact: true }).selectOption("active");
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: `Ações de ${title}`, exact: true }).click();
    await page.getByRole("dialog", { name: "Ações da tarefa" }).getByRole("button", { name: "Concluir tarefa", exact: true }).click();
    await page.getByLabel("Mostrar tarefas", { exact: true }).selectOption("done");
    await row.getByRole("button", { name: `Ações de ${title}`, exact: true }).click();
    await page.getByRole("dialog", { name: "Ações da tarefa" }).getByRole("button", { name: "Arquivar tarefa", exact: true }).click();
    await page.getByLabel("Mostrar tarefas", { exact: true }).selectOption("archived");
    await row.getByRole("button", { name: `Ações de ${title}`, exact: true }).click();
    await page.getByRole("dialog", { name: "Ações da tarefa" }).getByRole("button", { name: "Excluir tarefa", exact: true }).click();
    await page.getByRole("dialog", { name: "Mover tarefa para a lixeira?" }).getByRole("button", { name: "Mover para a lixeira", exact: true }).click();
    await page.getByLabel("Mostrar tarefas", { exact: true }).selectOption("trash");
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: `Ações de ${title}`, exact: true }).click();
    await page.getByRole("dialog", { name: "Ações da tarefa" }).getByRole("button", { name: "Restaurar tarefa", exact: true }).click();
    await expect(page.getByLabel("Mostrar tarefas", { exact: true })).toHaveValue("archived");
    await expect(row).toBeVisible();
  });
}

for (const timezoneId of ["UTC", "America/Los_Angeles"]) {
  test.describe(`tarefas em navegador ${timezoneId}`, () => {
    test.use({ timezoneId });
    test("datas e horas voltam no fuso do app", async ({ page }) => {
      await openTasks(page);
      const title = `Horário ${timezoneId}`;
      const form = await fillTask(page, title);
      await form.getByLabel("Prazo", { exact: true }).fill("2026-10-14T00:15");
      await form.getByRole("button", { name: "Criar tarefa", exact: true }).click();
      await expect(form).toBeHidden();
      await page.getByLabel("Buscar tarefas", { exact: true }).fill(title);
      await page.getByRole("button", { name: title, exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Editar tarefa" }).getByLabel("Prazo", { exact: true })).toHaveValue("2026-10-14T00:15");
    });
  });
}

test("tarefas distingue vazio de filtro e lista vazia e mantém o array ao trocar layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openTasks(page);
  const desktopIds = await page.locator(".ui-data-table tbody tr").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-id")));
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.locator(".ui-data-table__cards > li").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-id")))).toEqual(desktopIds);
  await page.getByLabel("Buscar tarefas", { exact: true }).fill("sem correspondência de exemplo 17856");
  await expect(page.getByText("Nenhum resultado para este filtro. Tente outro termo.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtro", exact: true }).click();
  await page.getByLabel("Mostrar tarefas", { exact: true }).selectOption("trash");
  await expect(page.getByText("A lixeira está vazia.", { exact: true })).toBeVisible();
});

for (const width of [320, 1280]) {
  test(`link de tarefa concluída abre, preserva estado e fecha sem loop em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tarefas?task=task-racao");
    const editor = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel("Estado", { exact: true })).toHaveValue("done");
    const title = `${await editor.getByLabel("Título", { exact: true }).inputValue()} revisada`;
    await editor.getByLabel("Título", { exact: true }).fill(title);
    await editor.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByLabel("Mostrar tarefas", { exact: true })).toHaveValue("done");
    await expect(taskRow(page, width, title)).toBeVisible();
    await expect(page.getByRole("region", { name: "Gestão de tarefas", exact: true })).toBeFocused();
    await page.getByLabel("Buscar tarefas", { exact: true }).fill(title);
    await expect(editor).toBeHidden();
    await expect(taskRow(page, width, title).getByText("Concluída", { exact: true })).toBeVisible();
  });
}

test("links de hoje e de registro indisponível mantêm o recorte autorizado", async ({ page }) => {
  await page.goto("/tarefas?view=hoje");
  await expect(page.getByLabel("Prazo das tarefas", { exact: true })).toHaveValue("today");
  await expect(page.getByLabel("Mostrar tarefas", { exact: true })).toHaveValue("active");
  await page.goto("/tarefas?task=registro-indisponivel");
  await expect(page.getByRole("region", { name: "Gestão de tarefas", exact: true }).getByRole("alert")).toHaveText("Esta tarefa não está disponível nesta sessão.");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});
