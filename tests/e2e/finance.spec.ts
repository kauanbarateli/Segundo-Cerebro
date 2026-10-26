import { expect, test, type Page } from "@playwright/test";
import { financePeriodTrigger, readFinancePeriod, selectFinancePeriod } from "./helpers/finance-period";

function section(page: Page) { return page.getByRole("region", { name: "Gestão financeira", exact: true }); }
function visibleRows(page: Page, width: number) { return section(page).locator(width < 768 ? ".ui-data-table__cards > li" : ".ui-data-table tbody > tr"); }
async function tab(page: Page, name: string) { await page.getByRole("navigation", { name: "Seções financeiras", exact: true }).getByRole("link", { name, exact: true }).click(); }
async function openFinance(page: Page, url = "/financeiro") {
  await page.goto(url); await expect(section(page)).toBeVisible();
  await expect(section(page).getByRole("button", { name: "Ocultar valores", exact: true })).toBeVisible();
}

for (const width of [320, 1280]) {
  test(`financeiro: quatro formulários, edição e lixeira em ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000); await page.setViewportSize({ width, height: 900 }); await openFinance(page);
    const month = await readFinancePeriod(page);
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

    await tab(page, "Planejamento"); await page.getByRole("button", { name: "Novo orçamento", exact: true }).click();
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
    await tab(page, "Planejamento"); await expect(page.getByRole("region", { name: `Orçamento ${categoryName}`, exact: true })).toContainText("limite atingido");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`financeiro-planejamento-${width}.png`), fullPage: true });
    await page.screenshot({ path: `test-results/t020-finance-${width}.png`, fullPage: true });
  });

  test(`financeiro: máscara completa e confirmação antes de editar em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await openFinance(page);
    await section(page).getByRole("button", { name: "Ocultar valores", exact: true }).click();
    const sharedUrl = page.url();
    for (const name of ["Visão geral", "Lançamentos", "Cartões", "Contas", "Categorias", "Planejamento"]) {
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

test("SPEC-08: análise mensal acessível, máscara integral e dados sem paginação", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFinance(page, "/financeiro?tab=painel&month=2026-09&page=2");
  const analysis = page.getByRole("region", { name: "Entradas e despesas do mês", exact: true });
  const summary = analysis.locator("summary");
  await expect(analysis.locator("dl")).toContainText("8.000,00");
  await expect(analysis.locator("dl")).toContainText("3.247,60");
  await summary.focus(); await expect(summary).toBeFocused(); await page.keyboard.press("Enter");
  const accumulated = analysis.getByRole("table", { name: "Acumulado de setembro de 2026", exact: true });
  await expect(accumulated.getByRole("row")).toHaveCount(32); // Header + initial bucket + 30 civil days.
  await expect(accumulated.getByRole("row").nth(1)).toContainText("Anteriores desta competência");
  const last = accumulated.getByRole("row").last();
  for (const value of ["30/09/2026", "8.000,00", "3.247,60", "4.752,40"]) await expect(last).toContainText(value);
  for (const theme of ["light", "dark"] as const) {
    await page.getByLabel("Tema", { exact: true }).selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(analysis.locator(".finance-competence-plot")).toHaveCSS("height", "240px");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const scrollRegion = analysis.getByRole("region", { name: "Tabela de valores acumulados", exact: true });
      await scrollRegion.focus(); await expect(scrollRegion).toBeFocused();
      await testInfo.attach(`financeiro-analise-${theme}-${width}`, { body: await analysis.screenshot({ path: testInfo.outputPath(`financeiro-analise-${theme}-${width}.png`) }), contentType: "image/png" });
    }
  }
  await section(page).getByRole("button", { name: "Ocultar valores", exact: true }).click();
  await expect(analysis.locator(".finance-competence-plot, table, details")).toHaveCount(0);
  await expect(analysis.locator("[aria-valuenow], [aria-valuetext], .finance-income")).toHaveCount(0);
  expect(await analysis.locator(".finance-money").allTextContents()).toEqual(["R$ ••••", "R$ ••••", "R$ ••••"]);
  const reveal = analysis.getByRole("button", { name: "Exibir valores da análise", exact: true });
  await reveal.focus(); await page.keyboard.press("Enter");
  await expect(analysis.getByRole("heading", { name: "Entradas e despesas do mês", exact: true })).toBeFocused();
  await expect(analysis.locator(".finance-competence-plot")).toBeVisible();
  await expect(analysis.locator("dl")).toContainText("4.752,40");
  await page.getByText("Análises e compromissos do mês", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Resultado por competência", exact: true })).toBeVisible();
  await analysis.getByRole("button", { name: "Ver lançamentos deste recorte", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("month")).toBe("2026-09");
  expect(new URL(page.url()).searchParams.get("tab")).toBe("lancamentos");
  expect(new URL(page.url()).searchParams.get("page")).not.toBe("2");
});

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
  await tab(page, "Visão geral"); await expect(page.getByRole("region", { name: "Entradas e despesas do mês", exact: true })).toContainText("1.234,10");
  await page.goBack(); await expect(page.getByLabel("Buscar lançamentos", { exact: true })).toHaveValue("alimentacao");
});

test("financeiro: coerência do mês, ciclo do cartão e transferências sem edição isolada", async ({ page }) => {
  await openFinance(page);
  const overview = page.getByRole("region", { name: "Entradas e despesas do mês", exact: true });
  await expect(overview).toContainText("8.000,00"); await expect(overview).toContainText("3.247,60"); await expect(overview).toContainText("4.752,40");
  await page.getByText("Análises e compromissos do mês", { exact: true }).click();
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

test("SPEC-08: período tem alvos de 44px e popup contido nos dois temas e larguras", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFinance(page, "/financeiro?tab=lancamentos&month=2026-09");
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.getByLabel("Tema", { exact: true }).selectOption(theme);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const controls = page.getByRole("group", { name: "Período financeiro", exact: true });
      for (const button of await controls.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await financePeriodTrigger(page).click();
      const picker = page.getByRole("dialog", { name: "Selecionar período", exact: true });
      await expect(picker).toBeVisible();
      await expect(picker.getByRole("group", { name: "Meses de 2026", exact: true }).getByRole("button")).toHaveCount(12);
      for (const button of await picker.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      const bounds = await picker.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(11); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 11);
      expect(bounds!.y).toBeGreaterThanOrEqual(11); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(889);
      const anchor = await financePeriodTrigger(page).boundingBox();
      expect(bounds!.x).toBeCloseTo(Math.max(12, Math.min(anchor!.x + anchor!.width - bounds!.width, width - 12 - bounds!.width)), 0);
      const currentMonth = await picker.getByRole("button", { name: "Mês atual", exact: true }).boundingBox(), cancel = await picker.getByRole("button", { name: "Cancelar", exact: true }).boundingBox();
      expect(currentMonth!.width).toBeCloseTo(bounds!.width - 30, 0); expect(cancel!.y).toBeGreaterThanOrEqual(currentMonth!.y + currentMonth!.height);
      await testInfo.attach(`financeiro-periodo-${theme}-${width}`, { body: await page.screenshot({ path: testInfo.outputPath(`financeiro-periodo-${theme}-${width}.png`) }), contentType: "image/png" });
      await page.keyboard.press("Escape"); await expect(financePeriodTrigger(page)).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  // CSS zoom is a fixture stress case, separate from native browser/assistive acceptance.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await financePeriodTrigger(page).click();
  const picker = page.getByRole("dialog", { name: "Selecionar período", exact: true });
  await expect(picker).toBeVisible();
  const zoomed = await picker.boundingBox();
  expect(zoomed!.x).toBeGreaterThanOrEqual(11); expect(zoomed!.x + zoomed!.width).toBeLessThanOrEqual(1269);
  expect(zoomed!.y).toBeGreaterThanOrEqual(11); expect(zoomed!.y + zoomed!.height).toBeLessThanOrEqual(889);
  await picker.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(financePeriodTrigger(page)).toBeFocused();
  await page.evaluate(() => { document.documentElement.style.removeProperty("zoom"); });
});

test("SPEC-08: teclado, ano transitório, cancelamento e Mês atual preservam o recorte", async ({ page }) => {
  await openFinance(page, "/financeiro?tab=contas&month=2026-09&q=revisao&kind=expense&account=contaA&category=none&status=pending&page=3&sort=amount_cents&dir=asc");
  const initial = page.url(), trigger = financePeriodTrigger(page), picker = page.getByRole("dialog", { name: "Selecionar período", exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  await expect(picker.getByRole("button", { name: "setembro de 2026", exact: true })).toBeFocused();
  await picker.getByRole("button", { name: "Próximo ano", exact: true }).click();
  await expect(picker.getByLabel("Ano do período", { exact: true })).toHaveText("2027"); expect(page.url()).toBe(initial);
  await picker.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(trigger).toBeFocused(); expect(page.url()).toBe(initial);
  await trigger.press("Enter");
  await expect(picker.getByRole("button", { name: "setembro de 2026", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowRight"); await expect(picker.getByRole("button", { name: "outubro de 2026", exact: true })).toBeFocused();
  await page.keyboard.press("Home"); await expect(picker.getByRole("button", { name: "janeiro de 2026", exact: true })).toBeFocused();
  await page.keyboard.press("End"); await expect(picker.getByRole("button", { name: "dezembro de 2026", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowUp"); await expect(picker.getByRole("button", { name: "setembro de 2026", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); expect(page.url()).toBe(initial);
  await selectFinancePeriod(page, "2027-01");
  const changed = new URL(page.url()).searchParams, expected = new URL(initial).searchParams;
  expected.set("month", "2027-01"); expected.delete("page");
  expect([...changed]).toEqual([...expected]); await expect(trigger).toBeFocused();
  await trigger.click(); await page.goBack();
  await expect(picker).toBeHidden(); await expect(trigger).toHaveAttribute("data-month", "2026-09-01");
  await page.goForward(); await expect(trigger).toHaveAttribute("data-month", "2027-01-01");
  await trigger.click(); await picker.getByRole("button", { name: "Mês atual", exact: true }).click();
  await expect(trigger).toHaveAttribute("data-month", "2026-09-01"); await expect(trigger).toBeFocused();
  expected.set("month", "2026-09"); expect([...new URL(page.url()).searchParams]).toEqual([...expected]);
});

test("SPEC-08: seleção de render antigo não sobrescreve navegação síncrona mais recente", async ({ page }) => {
  await openFinance(page, "/financeiro?tab=lancamentos&month=2026-09");
  await financePeriodTrigger(page).click();
  const picker = page.getByRole("dialog", { name: "Selecionar período", exact: true });
  await picker.getByRole("button", { name: "outubro de 2026", exact: true }).evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error("Botão de mês inválido na fixture.");
    window.history.pushState(null, "", "/financeiro?tab=categorias&month=2027-02&q=nova&sort=original");
    button.click(); // Intentionally use the old event closure before React can render.
  });
  await expect(picker).toBeHidden();
  await expect(financePeriodTrigger(page)).toHaveAttribute("data-month", "2027-02-01");
  const params = new URL(page.url()).searchParams;
  expect(params.get("tab")).toBe("categorias"); expect(params.get("q")).toBe("nova"); expect(params.get("sort")).toBe("original");
});

test("SPEC-08: fallback invalida o ano transitório após navegação externa e histórico", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(HTMLElement.prototype, "showPopover", { configurable: true, value: undefined }); });
  await openFinance(page, "/financeiro?tab=contas&month=2026-09");
  expect(await page.evaluate(() => typeof HTMLElement.prototype.showPopover)).toBe("undefined");
  const trigger = financePeriodTrigger(page), picker = page.getByRole("dialog", { name: "Selecionar período", exact: true });
  await trigger.click(); await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Próximo ano", exact: true }).click();
  await expect(picker.getByLabel("Ano do período", { exact: true })).toHaveText("2027");
  await page.evaluate(() => { window.history.pushState(null, "", "/financeiro?tab=contas&month=2028-03&sort=original"); });
  await expect(trigger).toHaveAttribute("data-month", "2028-03-01");
  await expect(picker).toBeHidden(); await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.goBack();
  await expect(trigger).toHaveAttribute("data-month", "2026-09-01");
  await expect(picker).toBeHidden(); await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.goForward();
  await expect(trigger).toHaveAttribute("data-month", "2028-03-01");
  await expect(picker).toBeHidden(); await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.goBack(); await expect(trigger).toHaveAttribute("data-month", "2026-09-01");
  await expect(picker).toBeHidden(); await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(picker.getByLabel("Ano do período", { exact: true })).toHaveText("2026");
  await expect(picker.getByRole("button", { name: "setembro de 2026", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(picker).toBeHidden(); await expect(trigger).toBeFocused();
});

test("SPEC-08: setas de mês e ano respeitam os extremos 0001 e 9999", async ({ page }) => {
  for (const [month, disabledMonth, disabledYear] of [["0001-01", "Mês anterior", "Ano anterior"], ["9999-12", "Próximo mês", "Próximo ano"]] as const) {
    await openFinance(page, `/financeiro?tab=lancamentos&month=${month}`);
    await expect(section(page).getByRole("button", { name: disabledMonth, exact: true })).toBeDisabled();
    await financePeriodTrigger(page).click();
    const picker = page.getByRole("dialog", { name: "Selecionar período", exact: true });
    await expect(picker.getByRole("button", { name: disabledYear, exact: true })).toBeDisabled();
    await expect(picker.getByRole("button", { pressed: true })).toHaveCount(1);
    await picker.getByRole("button", { name: "Mês atual", exact: true }).click();
    await expect(financePeriodTrigger(page)).toHaveAttribute("data-month", "2026-09-01");
  }
});

test("T019: pagamento parcial com encargos na próxima fatura e quitação do saldo", async ({ page }) => {
  await openFinance(page, "/financeiro?tab=contas&month=2026-09");
  const card = page.getByRole("region", { name: "Conta Nubank", exact: true });
  await card.getByRole("button", { name: "Pagar fatura de Nubank", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Pagar fatura", exact: true });
  await expect(dialog.getByLabel("Valor do pagamento (R$)", { exact: true })).toBeFocused();
  await dialog.getByLabel("Valor do pagamento (R$)", { exact: true }).fill("400,00");
  await dialog.getByLabel("Conta para pagar a fatura", { exact: true }).selectOption({ label: "Itaú" });
  await dialog.getByText("Juros e IOF opcionais", { exact: true }).click();
  await dialog.getByLabel("Taxa mensal de juros (%)", { exact: true }).fill("10");
  await dialog.getByLabel("IOF (R$)", { exact: true }).fill("2,05");
  await dialog.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(card.locator(".finance-detail-list > div").filter({ hasText: "Pago na fatura" })).toContainText("400,00");
  await expect(card.locator(".finance-detail-list > div").filter({ hasText: "Em aberto" })).toContainText("2.012,80");
  await section(page).getByRole("button", { name: "Próximo mês", exact: true }).click();
  await expect(card.locator(".finance-detail-list > div").filter({ hasText: "Compras da fatura" })).toContainText("203,33");
  await section(page).getByRole("button", { name: "Mês anterior", exact: true }).click();
  await card.getByRole("button", { name: "Pagar fatura de Nubank", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Pagar fatura", exact: true });
  await dialog.getByRole("button", { name: "Usar valor total em aberto", exact: true }).click();
  await expect(dialog.getByLabel("Valor do pagamento (R$)", { exact: true })).toHaveValue("2012,80");
  await dialog.getByLabel("Conta para pagar a fatura", { exact: true }).selectOption({ label: "Itaú" });
  await dialog.getByRole("button", { name: "Registrar pagamento", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(card.locator(".finance-detail-list > div").filter({ hasText: "Em aberto" })).toContainText("0,00");
});

test("T020: transferência bilateral e arquivamento preservam saldo e histórico da outra conta", async ({ page }) => {
  await openFinance(page);
  await section(page).getByRole("button", { name: "Transferir", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Transferir entre contas", exact: true });
  await dialog.getByLabel("Descrição da transferência", { exact: true }).fill("Reserva conjunta");
  await dialog.getByLabel("Conta de origem", { exact: true }).selectOption({ label: "Itaú" });
  await dialog.getByLabel("Conta de destino", { exact: true }).selectOption({ label: "CDB" });
  await dialog.getByLabel("Valor da transferência (R$)", { exact: true }).fill("100,00");
  await dialog.getByRole("button", { name: "Registrar transferência", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByLabel("Buscar lançamentos", { exact: true }).fill("Reserva conjunta");
  await expect(visibleRows(page, 1280)).toHaveCount(2);
  await expect(page.getByLabel("Totais realizados do recorte", { exact: true })).toContainText("0,00");
  await tab(page, "Contas");
  const cash = page.getByRole("region", { name: "Conta Itaú", exact: true });
  await expect(cash.locator(".finance-kpi")).toContainText("4.217,42");
  await page.getByRole("button", { name: "Arquivar conta CDB", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Arquivar conta", exact: true });
  await expect(dialog).toContainText("as duas pernas das transferências serão preservados");
  await dialog.getByRole("button", { name: "Arquivar conta", exact: true }).click();
  await expect(dialog).toBeHidden(); await expect(page.getByRole("region", { name: "Conta CDB", exact: true })).toHaveCount(0);
  await expect(cash.locator(".finance-kpi")).toContainText("4.217,42");
  await section(page).getByText("Contas arquivadas (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Ver histórico de CDB", exact: true }).click();
  await page.getByLabel("Buscar lançamentos", { exact: true }).fill("Reserva conjunta");
  await expect(visibleRows(page, 1280)).toHaveCount(1);
  await page.getByLabel("Filtrar conta", { exact: true }).selectOption("");
  await expect(visibleRows(page, 1280)).toHaveCount(2);
});

test("T020: doze parcelas conservam o total e encerramento preserva a primeira recorrência", async ({ page }) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 390, height: 900 }); await openFinance(page);
  await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Novo lançamento", exact: true });
  await dialog.getByLabel("Descrição", { exact: true }).fill("Compra em doze vezes");
  await dialog.getByLabel("Conta", { exact: true }).selectOption({ label: "Nubank" });
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("100,01");
  await dialog.getByLabel("Frequência do lançamento", { exact: true }).selectOption("parcelamento");
  await dialog.getByLabel("Número de parcelas", { exact: true }).fill("12");
  await dialog.getByRole("button", { name: "Criar lançamento", exact: true }).click(); await expect(dialog).toBeHidden();
  await page.getByLabel("Buscar lançamentos", { exact: true }).fill("Compra em doze vezes");
  await expect(visibleRows(page, 390)).toHaveCount(1); await expect(visibleRows(page, 390)).toContainText("Parcela 1 de 12"); await expect(visibleRows(page, 390)).toContainText("8,33");
  await selectFinancePeriod(page, "2027-08");
  await expect(visibleRows(page, 390)).toContainText("Parcela 12 de 12"); await expect(visibleRows(page, 390)).toContainText("8,38");
  await selectFinancePeriod(page, "2026-09");
  await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Novo lançamento", exact: true });
  await dialog.getByLabel("Descrição", { exact: true }).fill("Mensalidade finita");
  await dialog.getByLabel("Conta", { exact: true }).selectOption({ label: "Itaú" });
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("50,00");
  await dialog.getByLabel("Frequência do lançamento", { exact: true }).selectOption("recorrencia");
  await dialog.getByLabel("Número de ocorrências", { exact: true }).fill("3");
  await dialog.getByRole("button", { name: "Criar lançamento", exact: true }).click(); await expect(dialog).toBeHidden();
  await page.getByLabel("Buscar lançamentos", { exact: true }).fill("Mensalidade finita");
  await selectFinancePeriod(page, "2026-10");
  await visibleRows(page, 390).getByRole("button", { name: "Ações de Mensalidade finita", exact: true }).click();
  await page.getByRole("button", { name: "Encerrar recorrência", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Encerrar recorrência", exact: true });
  await dialog.getByLabel("Encerrar a partir de", { exact: true }).fill("2026-10-01");
  await dialog.getByRole("button", { name: "Encerrar ocorrências futuras", exact: true }).click(); await expect(dialog).toBeHidden();
  await page.getByLabel("Buscar lançamentos", { exact: true }).fill("Mensalidade finita");
  await expect(visibleRows(page, 390)).toHaveCount(0);
  await selectFinancePeriod(page, "2026-09");
  await expect(visibleRows(page, 390)).toHaveCount(1); await expect(visibleRows(page, 390)).toContainText("Ocorrência 1 de 3");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("T020: cópia avisa sobre duplicidade sob máscara e Desfazer expira em oito segundos", async ({ page }) => {
  await openFinance(page, "/financeiro?tab=lancamentos&month=2026-09");
  await page.getByLabel("Buscar lançamentos", { exact: true }).fill("Recebimento do mês");
  await visibleRows(page, 1280).getByRole("button", { name: /Ações de/ }).click();
  await page.getByRole("button", { name: "Duplicar lançamento", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Duplicar lançamento", exact: true });
  await dialog.getByLabel("Data da cópia", { exact: true }).fill("2026-09-05");
  await dialog.getByRole("button", { name: "Criar cópia", exact: true }).click(); await expect(dialog).toBeHidden();
  await page.getByLabel("Buscar lançamentos", { exact: true }).fill("Recebimento do mês");
  await expect(visibleRows(page, 1280)).toHaveCount(2);
  await expect(visibleRows(page, 1280).getByText("Possível duplicidade", { exact: true })).toHaveCount(2);
  await section(page).getByRole("button", { name: "Ocultar valores", exact: true }).click();
  expect((await visibleRows(page, 1280).locator(".finance-money").allTextContents()).every((value) => value === "R$ ••••")).toBe(true);
  await expect(visibleRows(page, 1280).getByText("Possível duplicidade", { exact: true })).toHaveCount(2);
  await section(page).getByRole("button", { name: "Exibir valores", exact: true }).click();
  await page.clock.install();
  await visibleRows(page, 1280).last().getByRole("button", { name: /Ações de/ }).click();
  await page.getByRole("button", { name: "Excluir lançamento", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Mover lançamento para a lixeira?", exact: true });
  await dialog.getByRole("button", { name: "Mover para a lixeira", exact: true }).click(); await expect(dialog).toBeHidden();
  await page.getByLabel("Buscar lançamentos", { exact: true }).focus();
  await page.mouse.move(0, 0);
  await expect(page.getByRole("button", { name: "Desfazer", exact: true })).toBeVisible();
  await page.clock.runFor(8400); await expect(page.getByRole("button", { name: "Desfazer", exact: true })).toHaveCount(0);
  await page.getByLabel("Filtrar estado", { exact: true }).selectOption("trash");
  await visibleRows(page, 1280).getByRole("button", { name: /Ações de/ }).click();
  await page.getByRole("button", { name: "Restaurar lançamento", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Detalhes do lançamento", exact: true })).toBeHidden();
});
