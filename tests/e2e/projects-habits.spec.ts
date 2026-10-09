import { expect, test, type Page } from "@playwright/test";

async function createProject(page: Page, name: string) {
  await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Novo projeto", exact: true });
  await expect(editor.getByLabel("Nome do projeto", { exact: true })).toBeFocused();
  await editor.getByLabel("Nome do projeto", { exact: true }).fill(name);
  await editor.getByRole("button", { name: "Criar projeto", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

for (const width of [390, 1440]) {
  test(`projeto preserva captura ao desvincular, excluir e restaurar em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/projetos");
    await createProject(page, "Jornada de projeto");
    const projectUrl = page.url();
    const captures = page.locator(".project-section").filter({ has: page.getByRole("heading", { name: "Capturas", exact: true }) });
    await captures.getByRole("button", { name: "Criar aqui", exact: true }).click();
    const create = page.getByRole("dialog", { name: "Criar captura neste projeto", exact: true });
    await create.getByLabel("Nome da captura", { exact: true }).fill("Captura preservada");
    await create.getByRole("button", { name: "Criar aqui", exact: true }).click();
    await expect(create).toBeHidden();
    const linked = captures.getByRole("link", { name: "Captura preservada", exact: true });
    await expect(linked).toBeVisible();
    const sourceUrl = await linked.getAttribute("href");
    await captures.getByRole("button", { name: "Desvincular Captura preservada", exact: true }).click();
    await expect(linked).toHaveCount(0);
    await captures.getByRole("button", { name: "Vincular existente", exact: true }).click();
    const link = page.getByRole("dialog", { name: "Vincular captura neste projeto", exact: true });
    await link.getByLabel("Item para vincular", { exact: true }).selectOption({ label: "Captura preservada" });
    await link.getByRole("button", { name: "Vincular item", exact: true }).click();
    await expect(linked).toHaveAttribute("href", sourceUrl!);
    await page.getByRole("button", { name: "Excluir projeto", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Excluir projeto?", exact: true });
    await expect(confirmation).toContainText("Os itens e seus vínculos serão preservados");
    await confirmation.getByRole("button", { name: "Mover projeto para a lixeira", exact: true }).click();
    await expect(confirmation).toBeHidden();
    await page.getByRole("link", { name: "Lixeira de projetos", exact: true }).click();
    await page.getByRole("button", { name: "Restaurar Jornada de projeto", exact: true }).click();
    await page.locator(".project-card").filter({ has: page.getByRole("heading", { name: "Jornada de projeto", exact: true }) }).click();
    await expect(page).toHaveURL(projectUrl);
    await expect(captures.getByRole("link", { name: "Captura preservada", exact: true })).toHaveAttribute("href", sourceUrl!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("projeto permite criar caderno e pasta no mesmo contexto", async ({ page }) => {
  await page.goto("/projetos");
  await createProject(page, "Conteúdo do projeto");
  for (const [sectionName, kind, fieldName, name] of [["Cadernos", "caderno", "Nome do caderno", "Caderno do projeto"], ["Pastas", "pasta", "Nome da pasta", "Pasta do projeto"]] as const) {
    const section = page.locator(".project-section").filter({ has: page.getByRole("heading", { name: sectionName, exact: true }) });
    await section.getByRole("button", { name: "Criar aqui", exact: true }).click();
    const editor = page.getByRole("dialog", { name: `Criar ${kind} neste projeto`, exact: true });
    await editor.getByLabel(fieldName, { exact: true }).fill(name!);
    await editor.getByRole("button", { name: "Criar aqui", exact: true }).click();
    await expect(section.getByRole("link", { name, exact: true })).toBeVisible();
  }
});

test("cancelar e editar projeto devolve o foco e conserva campos", async ({ page }) => {
  await page.goto("/projetos");
  const trigger = page.getByRole("button", { name: "Novo projeto", exact: true });
  await trigger.click();
  await page.getByRole("dialog", { name: "Novo projeto", exact: true }).getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(trigger).toBeFocused();
  await createProject(page, "Antes da edição");
  const edit = page.getByRole("button", { name: "Editar projeto", exact: true });
  await edit.click();
  const editor = page.getByRole("dialog", { name: "Editar projeto", exact: true });
  await expect(editor.getByLabel("Nome do projeto", { exact: true })).toHaveValue("Antes da edição");
  await editor.getByLabel("Nome do projeto", { exact: true }).fill("Depois da edição");
  await editor.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Depois da edição", exact: true })).toBeVisible();
  await expect(edit).toBeFocused();
});

for (const [cadence, name] of [["daily", "Diário da jornada"], ["weekdays", "Dias da jornada"], ["weekly_target", "Meta da jornada"]] as const) {
  test(`hábito ${cadence} cria, edita e restaura sem perder a marcação passada`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/habitos");
    const trigger = page.getByRole("button", { name: "Novo hábito", exact: true });
    await trigger.click();
    const editor = page.getByRole("dialog", { name: "Novo hábito", exact: true });
    await expect(editor.getByLabel("Nome do hábito", { exact: true })).toBeFocused();
    await editor.getByLabel("Nome do hábito", { exact: true }).fill(name);
    await editor.getByLabel("Cadência do hábito", { exact: true }).selectOption(cadence);
    if (cadence === "weekly_target") await editor.getByLabel("Vezes por semana", { exact: true }).fill("2");
    await editor.getByLabel("Início do hábito", { exact: true }).fill("2026-01-01");
    await editor.getByRole("button", { name: "Criar hábito", exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.getByLabel("Hábito do histórico", { exact: true }).selectOption({ label: name });
    await page.getByRole("button", { name: "Registrar dia", exact: true }).click();
    const mark = page.getByRole("dialog", { name: "Registrar dia", exact: true });
    await mark.getByLabel("Hábito", { exact: true }).selectOption({ label: name });
    await mark.getByLabel("Dia do hábito", { exact: true }).fill("2026-09-22");
    await mark.getByRole("button", { name: "Salvar marcação", exact: true }).click();
    await expect(mark).toBeHidden();
    await expect(page.getByRole("img", { name: new RegExp(`${name}: 1 dias registrados`) })).toBeVisible();
    await page.getByRole("button", { name: `Editar hábito ${name}`, exact: true }).click();
    const edit = page.getByRole("dialog", { name: "Editar hábito", exact: true });
    await expect(edit.getByLabel("Início do hábito", { exact: true })).toBeDisabled();
    await edit.getByLabel("Nome do hábito", { exact: true }).fill(name + " editado");
    await edit.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    await page.getByRole("button", { name: `Arquivar hábito ${name} editado`, exact: true }).click();
    await page.getByText("Hábitos arquivados", { exact: true }).click();
    await page.getByRole("button", { name: `Restaurar ${name} editado`, exact: true }).click();
    await page.getByLabel("Hábito do histórico", { exact: true }).selectOption({ label: name + " editado" });
    await expect(page.getByRole("img", { name: new RegExp(`${name} editado: 1 dias registrados`) })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("pausa geral e por hábito bloqueiam marcação; remover pausa recalcula o dia", async ({ page }) => {
  await page.goto("/habitos");
  for (const label of ["Todos os hábitos", "Meditar 10 min"]) {
    await page.getByRole("button", { name: "Registrar pausa", exact: true }).click();
    const pause = page.getByRole("dialog", { name: "Registrar pausa", exact: true });
    await pause.getByLabel("Hábito", { exact: true }).selectOption({ label });
    await pause.getByLabel("Início da pausa", { exact: true }).fill("2026-09-23");
    await pause.getByLabel("Fim da pausa", { exact: true }).fill("2026-09-23");
    await pause.getByRole("button", { name: "Salvar pausa", exact: true }).click();
    await expect(pause).toBeHidden();
    await expect(page.getByRole("button", { name: "Marcar Meditar 10 min", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Remover pausa de 2026-09-23", exact: true }).click();
    await expect(page.getByRole("button", { name: "Marcar Meditar 10 min", exact: true })).toBeEnabled();
  }
});
