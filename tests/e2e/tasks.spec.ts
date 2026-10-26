import { expect, test, type Locator, type Page } from "@playwright/test";

async function openTasks(page: Page) {
  await page.goto("/tarefas");
  await expect(page.getByRole("button", { name: "Nova tarefa", exact: true })).toBeVisible();
}
function taskRow(page: Page, width: number, title: string): Locator {
  return page.locator(width < 768 ? ".ui-data-table__cards > li" : ".ui-data-table tbody > tr").filter({ hasText: title });
}
test("criação contextual aceita somente projeto presente na coleção autorizada", async ({ page }) => {
  await openTasks(page);
  const projectId = await page.getByLabel("Filtrar projeto", { exact: true }).locator("option").nth(2).getAttribute("value");
  expect(projectId).toBeTruthy();
  await page.goto(`/tarefas?new=1&project=${encodeURIComponent(projectId!)}`);
  const editor = page.getByRole("dialog", { name: "Nova tarefa", exact: true });
  await expect(editor.getByLabel("Projeto", { exact: true })).toHaveValue(projectId!);
  await page.goto("/tarefas?new=1&project=00000000-0000-4000-8000-000000000099");
  await expect(editor.getByLabel("Projeto", { exact: true })).toHaveValue("");
  await expect(editor.getByLabel("Projeto", { exact: true }).locator('option[value="00000000-0000-4000-8000-000000000099"]')).toHaveCount(0);
});
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
    await page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Abertas", exact: true }).click();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: `Ações de ${title}`, exact: true }).click();
    await page.getByRole("dialog", { name: "Ações da tarefa" }).getByRole("button", { name: "Concluir tarefa", exact: true }).click();
    await page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Concluídas", exact: true }).click();
    await row.getByRole("button", { name: `Ações de ${title}`, exact: true }).click();
    await page.getByRole("dialog", { name: "Ações da tarefa" }).getByRole("button", { name: "Arquivar tarefa", exact: true }).click();
    await page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Arquivo", exact: true }).click();
    await row.getByRole("button", { name: `Ações de ${title}`, exact: true }).click();
    await page.getByRole("dialog", { name: "Ações da tarefa" }).getByRole("button", { name: "Excluir tarefa", exact: true }).click();
    await page.getByRole("dialog", { name: "Mover tarefa para a lixeira?" }).getByRole("button", { name: "Mover para a lixeira", exact: true }).click();
    await page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Lixeira", exact: true }).click();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: `Ações de ${title}`, exact: true }).click();
    await page.getByRole("dialog", { name: "Ações da tarefa" }).getByRole("button", { name: "Restaurar tarefa", exact: true }).click();
    await expect(page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Arquivo", exact: true })).toHaveAttribute("aria-pressed", "true");
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

test("tarefas distingue vazio de filtro e lista vazia e mantém o array ao trocar layout", async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openTasks(page);
  const desktopIds = await page.locator(".ui-data-table tbody tr").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-id")));
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.locator(".ui-data-table__cards > li").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-id")))).toEqual(desktopIds);
  await page.getByLabel("Buscar tarefas", { exact: true }).fill("sem correspondência de exemplo 17856");
  await expect(page.getByText("Nenhum resultado para este filtro. Tente outro termo.", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("doc18-tarefas-sem-resultados-320-light.png"), fullPage: true });
  await page.getByRole("button", { name: "Limpar filtro", exact: true }).click();
  await page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Lixeira", exact: true }).click();
  await expect(page.getByText("A lixeira está vazia.", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("doc18-tarefas-lixeira-vazia-320-light.png"), fullPage: true });
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
    await expect(page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Concluídas", exact: true })).toHaveAttribute("aria-pressed", "true");
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
  await expect(page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Hoje", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/tarefas?view=hoje&status=open");
  await expect(page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Hoje", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/tarefas?task=registro-indisponivel");
  await expect(page.getByRole("region", { name: "Gestão de tarefas", exact: true }).getByRole("alert")).toHaveText("Esta tarefa não está disponível nesta sessão.");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

for (const width of [320, 390]) for (const theme of ["light", "dark"] as const) {
  test(`barra de tarefas mantém seis abas alcançáveis sem alargar a página em ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await openTasks(page);
    const tabs = page.getByRole("group", { name: "Mostrar tarefas", exact: true });
    const actionBounds = await page.locator(".tasks-display-actions .ui-button").evaluateAll(buttons => buttons.map(button => {
      const bounds = button.getBoundingClientRect();
      return { centerY: Math.round(bounds.top + bounds.height / 2), width: bounds.width, height: bounds.height, right: bounds.right };
    }));
    expect(actionBounds).toHaveLength(3);
    expect(new Set(actionBounds.map(bounds => bounds.centerY)).size).toBe(1);
    for (const bounds of actionBounds) {
      expect(bounds.width).toBeGreaterThanOrEqual(44); expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.right).toBeLessThanOrEqual(width);
    }
    const actionsBox = await page.locator(".tasks-display-actions").boundingBox(), tabsBox = await tabs.boundingBox();
    expect(actionsBox).not.toBeNull(); expect(tabsBox).not.toBeNull();
    expect(tabsBox!.y + tabsBox!.height).toBeLessThanOrEqual(actionsBox!.y);
    const sortControl = page.locator(".tasks-sort-controls");
    await expect(sortControl.getByLabel("Ordenar por", { exact: true })).toBeVisible();
    const direction = sortControl.getByRole("button", { name: "Usar ordem decrescente", exact: true });
    const directionBounds = await direction.boundingBox(), sortBounds = await sortControl.boundingBox();
    expect(directionBounds).not.toBeNull(); expect(sortBounds).not.toBeNull();
    expect(directionBounds!.width).toBeGreaterThanOrEqual(44); expect(directionBounds!.height).toBeGreaterThanOrEqual(44);
    expect(directionBounds!.x + directionBounds!.width).toBeLessThanOrEqual(sortBounds!.x + sortBounds!.width);
    await direction.click();
    await expect(sortControl.getByRole("button", { name: "Usar ordem crescente", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Usar ordem crescente", exact: true }).click();
    const buttons = await tabs.getByRole("button").all();
    expect(buttons).toHaveLength(6);
    await buttons[0]!.focus();
    const pageScrollY = await page.evaluate(() => window.scrollY);
    for (const button of buttons) {
      await expect(button).toBeFocused();
      await expect(button).toBeInViewport({ ratio: 1 });
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThanOrEqual(44); expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      const scrollport = await tabs.evaluate(element => { const bounds = element.getBoundingClientRect(), left = bounds.left + element.clientLeft; return { left, right: left + element.clientWidth }; });
      expect(bounds!.x).toBeGreaterThanOrEqual(scrollport.left); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(scrollport.right);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollY);
      await button.press("Tab");
    }
    for (const button of await page.locator(".tasks-display-actions .ui-button").all()) {
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
  });
}

for (const width of [320, 1440]) {
  test(`Kanban compartilha filtros, criação completa e movimento acessível em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: width === 1440 ? "dark" : "light", reducedMotion: "reduce" });
    await openTasks(page);
    await page.screenshot({ path: info.outputPath(`doc18-tarefas-lista-${width}-${width === 1440 ? "dark" : "light"}.png`), fullPage: true });
    await page.getByRole("button", { name: "Kanban", exact: true }).click();
    const actions = await page.locator(".tasks-display-actions .ui-button").evaluateAll(buttons => buttons.map(button => {
      const bounds = button.getBoundingClientRect(), label = button.querySelector(".ui-button__label")!;
      const text = document.createTreeWalker(label, NodeFilter.SHOW_TEXT), lines = new Set<number>();
      for (let node = text.nextNode(); node; node = text.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        for (const rect of range.getClientRects()) lines.add(Math.round(rect.top));
      }
      return { width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right, lines: lines.size };
    }));
    expect(actions).toHaveLength(3);
    for (const action of actions) {
      expect(action.width).toBeGreaterThanOrEqual(44); expect(action.height).toBeGreaterThanOrEqual(44);
      expect(action.left).toBeGreaterThanOrEqual(0); expect(action.right).toBeLessThanOrEqual(width);
      expect(action.lines).toBe(1);
    }
    const board = page.getByRole("region", { name: "Quadro de tarefas", exact: true });
    const prefix = `Kanban café ${width}`;
    for (const [status, label] of [["todo", "A fazer"], ["in_progress", "Em andamento"], ["done", "Concluídas"]] as const) {
      await board.getByRole("button", { name: `Nova tarefa em ${label}`, exact: true }).click();
      const form = page.getByRole("dialog", { name: "Nova tarefa", exact: true });
      await expect(form.getByLabel("Estado", { exact: true })).toHaveValue(status);
      await form.getByLabel("Título", { exact: true }).fill(`${prefix} ${status}`);
      await form.getByLabel("Descrição", { exact: true }).fill("Descrição completa da coluna, preservada ao mover.");
      await form.getByLabel("Categoria", { exact: true }).selectOption({ index: 1 });
      await form.getByLabel("Projeto", { exact: true }).selectOption({ index: 1 });
      await form.getByLabel("Prioridade", { exact: true }).selectOption("high");
      await form.getByLabel("Prazo", { exact: true }).fill("2026-10-14T14:30");
      await form.getByLabel("Estimativa em minutos", { exact: true }).fill("45");
      await form.getByRole("button", { name: "Criar tarefa", exact: true }).click();
      await expect(form).toBeHidden();
    }
    await page.getByLabel("Buscar tarefas", { exact: true }).fill(`kanban cafe ${width}`);
    await page.getByLabel("Filtrar projeto", { exact: true }).selectOption({ index: 2 });
    await page.locator(".tasks-extra-filters > summary").click();
    await page.getByLabel("Filtrar categoria", { exact: true }).selectOption({ index: 2 });
    await page.getByLabel("Filtrar prioridade", { exact: true }).selectOption("high");
    await expect(board.locator(".kanban-card")).toHaveCount(3);
    for (const count of await board.locator(".kanban-count").all()) await expect(count).toHaveText("1");
    const ids = await board.locator(".kanban-card").evaluateAll(cards => cards.map(card => card.getAttribute("data-task-id")).sort());
    await page.screenshot({ path: info.outputPath(`doc18-tarefas-filtros-kanban-${width}-${width === 1440 ? "dark" : "light"}.png`), fullPage: true });
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await expect(page.getByLabel("Buscar tarefas", { exact: true })).toHaveValue(`kanban cafe ${width}`);
    expect(await page.locator(".ui-data-table tbody tr").evaluateAll(rows => rows.map(row => row.getAttribute("data-row-id")).sort())).toEqual(ids);
    await page.screenshot({ path: info.outputPath(`doc18-tarefas-lista-filtrada-${width}-${width === 1440 ? "dark" : "light"}.png`), fullPage: true });
    await page.getByRole("button", { name: "Kanban", exact: true }).click();
    await expect(page.getByLabel("Filtrar prioridade", { exact: true })).toHaveValue("high");
    const status = page.getByLabel(`Estado de ${prefix} todo`, { exact: true });
    await status.focus();
    await status.press("ArrowDown");
    await status.press("Enter");
    await expect(status).toHaveValue("in_progress");
    await expect(status).toBeFocused();
    await expect(board.locator('[data-status="in_progress"] .kanban-count')).toHaveText("2");
    if (width === 1440) {
      await board.locator(".kanban-card").filter({ hasText: `${prefix} todo` }).locator(".kanban-drag-handle").dragTo(board.locator('[data-status="done"]'));
      await expect(status).toHaveValue("done");
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect(status).toBeFocused();
    }
    const card = board.locator(".kanban-card").filter({ hasText: `${prefix} todo` });
    await card.getByRole("button", { name: `${prefix} todo`, exact: true }).click();
    const editing = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
    await expect(editing.getByLabel("Descrição", { exact: true })).toHaveValue("Descrição completa da coluna, preservada ao mover.");
    await expect(editing.getByLabel("Prazo", { exact: true })).toHaveValue("2026-10-14T14:30");
    await expect(editing.getByLabel("Estimativa em minutos", { exact: true })).toHaveValue("45");
    await editing.getByRole("button", { name: "Cancelar", exact: true }).click();
    for (const heading of await board.getByRole("heading", { level: 2 }).all()) {
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    if (width === 320) expect(await board.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    expect(await board.evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0s");
    await page.mouse.move(0, 0);
    await expect(page.getByRole("region", { name: "Avisos", exact: true }).locator(".ui-toast")).toHaveCount(0, { timeout: 6_500 });
    await board.evaluate(element => element.scrollTo({ left: 0, behavior: "instant" }));
    await expect.poll(() => board.evaluate(element => element.scrollLeft)).toBe(0);
    await page.screenshot({ path: `test-results/t048-kanban-${width}.png`, fullPage: true });
    await page.reload();
    await expect(page.getByRole("button", { name: "Kanban", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
}

test("arquivo e lixeira usam uma coluna sem arraste e preservam restauração e deep links", async ({ page }) => {
  await page.goto("/tarefas?task=task-milestones");
  await page.getByRole("dialog", { name: "Editar tarefa", exact: true }).getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Todas", exact: true }).click();
  await page.getByRole("button", { name: "Kanban", exact: true }).click();
  const board = page.getByRole("region", { name: "Quadro de tarefas", exact: true });
  const card = board.locator('[data-task-id="task-milestones"]');
  await card.getByRole("combobox").selectOption("archived");
  await page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Arquivo", exact: true }).click();
  await expect(board.locator(".kanban-column")).toHaveCount(1);
  await expect(board.locator("[draggable]")).toHaveCount(0);
  await card.getByRole("combobox").selectOption("todo");
  await expect(board.getByRole("heading", { name: "Arquivadas", exact: true })).toBeFocused();
  await page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Todas", exact: true }).click();
  await card.getByRole("button", { name: /Ações de/ }).click();
  await page.getByRole("dialog", { name: "Ações da tarefa", exact: true }).getByRole("button", { name: "Excluir tarefa", exact: true }).click();
  await page.getByRole("dialog", { name: "Mover tarefa para a lixeira?", exact: true }).getByRole("button", { name: "Mover para a lixeira", exact: true }).click();
  await page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Lixeira", exact: true }).click();
  await expect(board.locator(".kanban-column")).toHaveCount(1);
  await expect(board.locator("[draggable], .kanban-status-select")).toHaveCount(0);
  await card.getByRole("button", { name: "Restaurar tarefa", exact: true }).click();
  await expect(page.getByRole("group", { name: "Mostrar tarefas", exact: true }).getByRole("button", { name: "Abertas", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByRole("combobox")).toHaveValue("todo");
  await expect(card.getByRole("combobox")).toBeFocused();
});
