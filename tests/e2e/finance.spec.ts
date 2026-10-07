import { expect, test, type Page } from "@playwright/test";

function section(page: Page) { return page.getByRole("region", { name: "Gestão financeira", exact: true }); }
function visibleRows(page: Page, width: number) { return section(page).locator(width < 768 ? ".ui-data-table__cards > li" : ".ui-data-table tbody > tr"); }
async function tab(page: Page, name: string) { await page.getByRole("navigation", { name: "Seções financeiras", exact: true }).getByRole("link", { name, exact: true }).click(); }
async function openFinance(page: Page, url = "/financeiro") {
  await page.goto(url); await expect(section(page)).toBeVisible();
  await expect(section(page).getByRole("button", { name: "Ocultar valores", exact: true })).toBeVisible();
}

for (const width of [320, 1280]) {
  test(`financeiro: quatro formulários, edição e lixeira em ${width}px`, async ({ page }) => {
    test.setTimeout(90_000); await page.setViewportSize({ width, height: 900 }); await openFinance(page);
    const month = await page.getByLabel("Competência selecionada", { exact: true }).inputValue();
    const accountName = `Conta de viagem ${width}`, categoryName = `Viagem ${width}`, description = `Reserva do hotel ${width}`;
    await tab(page, "Contas"); await page.getByRole("button", { name: "Nova conta", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "Nova conta", exact: true });
    await expect(dialog.getByLabel("Nome da conta", { exact: true })).toBeFocused();
    await dialog.getByLabel("Nome da conta", { exact: true }).fill(accountName);
    await dialog.getByLabel("Instituição", { exact: true }).fill("Exemplo");
    await dialog.getByLabel("Saldo inicial (R$)", { exact: true }).fill("250,00");
    await dialog.getByRole("button", { name: "Criar conta", exact: true }).click();
    await expect(dialog).toBeHidden(); await expect(page.getByRole("region", { name: `Conta ${accountName}`, exact: true })).toContainText("250,00");
    await page.getByRole("button", { name: `Editar conta ${accountName}`, exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Editar conta", exact: true });
    await expect(dialog.getByLabel("Tipo de conta", { exact: true })).toBeDisabled();
    await dialog.getByLabel("Instituição", { exact: true }).fill("Instituição revisada");
    await dialog.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(dialog).toBeHidden();

    await tab(page, "Categorias"); await page.getByRole("button", { name: "Nova categoria", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Nova categoria financeira", exact: true });
    await dialog.getByLabel("Nome da categoria", { exact: true }).fill(categoryName);
    await dialog.getByLabel("Cor", { exact: true }).selectOption("fin-3");
    await dialog.getByRole("button", { name: "Criar categoria", exact: true }).click(); await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: `Editar categoria ${categoryName}`, exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Editar categoria financeira", exact: true });
    await expect(dialog.getByLabel("Natureza da categoria", { exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();

    await tab(page, "Orçamentos"); await page.getByRole("button", { name: "Novo orçamento", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Novo orçamento", exact: true });
    await dialog.getByLabel("Categoria do orçamento", { exact: true }).selectOption({ label: categoryName });
    await dialog.getByLabel("Limite do orçamento (R$)", { exact: true }).fill("100,00");
    await dialog.getByRole("button", { name: "Salvar orçamento", exact: true }).click(); await expect(dialog).toBeHidden();
    await expect(page.getByRole("region", { name: `Orçamento ${categoryName}`, exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Novo lançamento", exact: true });
    await dialog.getByLabel("Descrição", { exact: true }).fill(description);
    await dialog.getByLabel("Valor (R$)", { exact: true }).fill("125,50");
    await dialog.getByLabel("Conta", { exact: true }).selectOption({ label: accountName });
    await dialog.getByLabel("Categoria", { exact: true }).selectOption({ label: categoryName });
    await dialog.getByLabel("Data da movimentação", { exact: true }).fill(`${month}-23`);
    await dialog.getByLabel("Já pago (R$)", { exact: true }).fill("100,00");
    await dialog.getByRole("button", { name: "Criar lançamento", exact: true }).click(); await expect(dialog).toBeHidden();
    await page.getByLabel("Buscar lançamentos", { exact: true }).fill(description);
    const row = visibleRows(page, width).filter({ hasText: description }); await expect(row).toHaveCount(1); await expect(row).toContainText("125,50");
    await row.getByRole("button", { name: `Ações de ${description}`, exact: true }).click();
    await page.getByRole("button", { name: "Editar lançamento", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Editar lançamento", exact: true });
    await expect(dialog.getByLabel("Já pago (R$)", { exact: true })).toHaveValue("100,00");
    await dialog.getByLabel("Descrição", { exact: true }).fill(description + " revisada");
    await dialog.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(dialog).toBeHidden();
    await page.getByLabel("Buscar lançamentos", { exact: true }).fill(description);
    await visibleRows(page, width).filter({ hasText: description }).getByRole("button", { name: `Ações de ${description} revisada`, exact: true }).click();
    await page.getByRole("button", { name: "Excluir lançamento", exact: true }).click();
    await page.getByRole("dialog", { name: "Mover lançamento para a lixeira?", exact: true }).getByRole("button", { name: "Mover para a lixeira", exact: true }).click();
    await expect(visibleRows(page, width).filter({ hasText: description })).toHaveCount(0);
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    await page.getByLabel("Buscar lançamentos", { exact: true }).fill(description);
    await expect(visibleRows(page, width).filter({ hasText: description })).toHaveCount(1);
    await tab(page, "Orçamentos"); await expect(page.getByRole("region", { name: `Orçamento ${categoryName}`, exact: true })).toContainText("limite atingido");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`financeiro: máscara completa e confirmação antes de editar em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await openFinance(page);
    await section(page).getByRole("button", { name: "Ocultar valores", exact: true }).click();
    const sharedUrl = page.url();
    for (const name of ["Painel", "Lançamentos", "Contas", "Categorias", "Orçamentos"]) {
      await tab(page, name);
      const values = await section(page).locator(".finance-money").allTextContents();
      expect(values.length).toBeGreaterThan(0); expect(values.every((value) => value === "R$ ••••")).toBe(true);
      await expect(section(page).locator(".finance-line, .finance-donut, [aria-valuenow]")).toHaveCount(0);
    }
    expect(new URL(sharedUrl).searchParams.has("valuesHidden")).toBe(false);
    await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Exibir valores para editar?", exact: true });
    await expect(confirmation).toBeVisible(); await expect(page.getByLabel("Valor (R$)", { exact: true })).toHaveCount(0);
    await confirmation.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.getByRole("link", { name: "Início", exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole("region", { name: "Pulso financeiro", exact: true })).toContainText("R$ ••••");
    await page.goto("/financeiro"); await expect(section(page).getByRole("button", { name: "Exibir valores", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
    await page.getByRole("button", { name: "Exibir valores e continuar", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Novo lançamento", exact: true }).getByLabel("Descrição", { exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(page.getByRole("dialog", { name: "Novo lançamento", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Novo lançamento", exact: true })).toBeFocused();
  });
}

test("financeiro: URL conserva filtro, busca, ordem e página ao recarregar e trocar layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await openFinance(page, "/financeiro?tab=lancamentos&month=2026-09");
  await page.getByLabel("Ordenar por", { exact: true }).selectOption("description");
  await page.getByRole("button", { name: "Próxima página", exact: true }).click();
  const ids = await visibleRows(page, 1280).evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-id")));
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  await page.reload(); await expect(page.getByRole("button", { name: "Ocultar valores", exact: true })).toBeVisible();
  expect(await visibleRows(page, 1280).evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-id")))).toEqual(ids);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await visibleRows(page, 320).evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-id")))).toEqual(ids);
  await page.getByLabel("Filtrar tipo", { exact: true }).selectOption("expense");
  await page.getByLabel("Filtrar conta", { exact: true }).selectOption({ label: "Nubank" });
  await page.getByLabel("Buscar lançamentos", { exact: true }).fill("alimentacao");
  const url = page.url(); expect(new URL(url).searchParams.get("q")).toBe("alimentacao");
  await expect(visibleRows(page, 320)).toHaveCount(1); await page.reload();
  await expect(page.getByLabel("Buscar lançamentos", { exact: true })).toHaveValue("alimentacao");
  await expect(visibleRows(page, 320)).toHaveCount(1);
  await tab(page, "Painel"); await expect(page.getByRole("region", { name: "Realizado na competência", exact: true })).toContainText("1.234,10");
  await page.goBack(); await expect(page.getByLabel("Buscar lançamentos", { exact: true })).toHaveValue("alimentacao");
});

test("financeiro: coerência do mês, ciclo do cartão e transferências sem edição isolada", async ({ page }) => {
  await openFinance(page);
  const overview = page.getByRole("region", { name: "Realizado na competência", exact: true });
  await expect(overview).toContainText("8.000,00"); await expect(overview).toContainText("3.247,60"); await expect(overview).toContainText("4.752,40");
  await expect(page.getByRole("region", { name: "Faturas a pagar", exact: true })).toContainText("0,00");
  await tab(page, "Contas"); const card = page.getByRole("region", { name: "Conta Nubank", exact: true });
  await expect(card).toContainText("Fecha 28/09/2026"); await expect(card).toContainText("Vence 05/10/2026"); await expect(card.getByText("Aberta", { exact: true })).toBeVisible();
  await expect(card).toContainText("8.000,00"); await expect(card).toContainText("5.587,20");
  await tab(page, "Lançamentos"); await expect(page.getByLabel("Totais realizados do recorte", { exact: true })).toContainText("4.752,40");
  await page.getByLabel("Filtrar tipo", { exact: true }).selectOption("transfer");
  await visibleRows(page, 1280).first().getByRole("button", { name: /Ações de/ }).click();
  const detail = page.getByRole("dialog", { name: "Detalhes do lançamento", exact: true });
  await expect(detail).toContainText("registros vinculados são mantidos juntos");
  await expect(detail.getByRole("button", { name: "Excluir lançamento", exact: true })).toHaveCount(0);
});

test("financeiro: erro de leitura recuperável e vazio real do mesmo adapter", async ({ page }) => {
  await page.goto("/configuracoes"); await page.getByLabel("Módulo para testar leitura", { exact: true }).selectOption("finance");
  await page.getByRole("button", { name: "Simular falha na próxima leitura", exact: true }).click();
  await page.getByRole("link", { name: "Abrir Financeiro", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Não foi possível carregar estes dados");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click(); await expect(section(page)).toBeVisible();
  await page.getByRole("navigation", { name: "Navegação principal", exact: true }).getByRole("link", { name: "Configurações", exact: true }).click();
  await page.getByLabel("Cenário de dados", { exact: true }).selectOption("empty"); await page.getByRole("button", { name: "Carregar cenário", exact: true }).click();
  await page.getByRole("navigation", { name: "Navegação principal", exact: true }).getByRole("link", { name: "Financeiro", exact: true }).click();
  await tab(page, "Lançamentos"); await expect(page.getByText("Ainda não há lançamentos. Crie o primeiro para acompanhar seu dinheiro.", { exact: true })).toBeVisible();
});

test("máscara entre abas só é retirada por uma escolha explícita", async ({ page, context }) => {
  await openFinance(page);
  const other = await context.newPage();
  await openFinance(other);
  // This observer waits for the browser's real cross-document event and a render
  // frame. It is installed before the action, avoiding a listener-registration race.
  await other.evaluate(() => {
    window.addEventListener("storage", (event) => {
      if (event.key !== "segundo-cerebro:demo:values-hidden:v1" && event.key !== null) return;
      const result = event.key === null ? "cleared" : event.newValue === null ? "removed" : event.newValue;
      requestAnimationFrame(() => document.documentElement.setAttribute("data-test-privacy-event", result));
    });
  });
  await section(page).getByRole("button", { name: "Ocultar valores", exact: true }).click();
  await expect(section(other).getByRole("button", { name: "Exibir valores", exact: true })).toBeVisible();
  expect((await section(other).locator(".finance-money").allTextContents()).every((value) => value === "R$ ••••")).toBe(true);

  await page.goto("/sair");
  await expect(other.locator("html")).toHaveAttribute("data-test-privacy-event", "removed");
  await expect(section(other).getByRole("button", { name: "Exibir valores", exact: true })).toBeVisible();
  expect((await section(other).locator(".finance-money").allTextContents()).every((value) => value === "R$ ••••")).toBe(true);

  await openFinance(page);
  await section(page).getByRole("button", { name: "Ocultar valores", exact: true }).click();
  await expect(section(other).getByRole("button", { name: "Exibir valores", exact: true })).toBeVisible();
  await section(page).getByRole("button", { name: "Exibir valores", exact: true }).click();
  await expect(section(other).getByRole("button", { name: "Ocultar valores", exact: true })).toBeVisible();
  await expect(section(other).getByRole("region", { name: "Patrimônio líquido", exact: true })).toContainText("20.404,62");

  await section(page).getByRole("button", { name: "Ocultar valores", exact: true }).click();
  await expect(section(other).getByRole("button", { name: "Exibir valores", exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await expect(other.locator("html")).toHaveAttribute("data-test-privacy-event", "cleared");
  await expect(section(other).getByRole("button", { name: "Exibir valores", exact: true })).toBeVisible();
  expect((await section(other).locator(".finance-money").allTextContents()).every((value) => value === "R$ ••••")).toBe(true);
  await other.close();
});

test("controles de mês mantêm rótulos inteiros e alvos de toque no mobile", async ({ page }) => {
  await openFinance(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const input = await page.getByLabel("Competência selecionada", { exact: true }).boundingBox();
    for (const name of ["Mês anterior", "Próximo mês"]) {
      const button = section(page).getByRole("button", { name, exact: true });
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.y).toBeGreaterThanOrEqual(input!.y + input!.height);
      const text = await button.locator(".ui-button__label").evaluate((label) => {
        const range = document.createRange(); range.selectNodeContents(label);
        const lines = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
        const parent = label.closest("button")!.getBoundingClientRect();
        return { count: lines.length, unclipped: lines.every((line) => line.left >= parent.left && line.right <= parent.right) };
      });
      expect(text).toEqual({ count: 1, unclipped: true });
    }
  }
});
