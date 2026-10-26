import { expect, test, type Page } from "@playwright/test";

const workspace = (page: Page) => page.getByRole("region", { name: "Gestão financeira", exact: true });
async function open(page: Page) {
  await page.goto("/financeiro?tab=painel&month=2026-09");
  await expect(workspace(page).getByRole("button", { name: "Ocultar valores", exact: true })).toBeVisible();
}

for (const width of [320, 390]) test(`Doc18: quatro abas principais e gestão secundária preservam URLs e teclado em ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  await open(page);
  const navigation = page.getByRole("navigation", { name: "Seções financeiras", exact: true });
  await expect(navigation.locator(".finance-tabs").getByRole("link")).toHaveText(["Visão geral", "Lançamentos", "Cartões", "Planejamento"]);
  const planning = navigation.getByRole("link", { name: "Planejamento", exact: true });
  await planning.focus(); await expect(planning).toBeFocused(); await expect(planning).toBeInViewport({ ratio: 1 });
  const toolbar = await navigation.locator(".finance-tabs-toolbar").boundingBox();
  expect(toolbar!.x).toBeGreaterThanOrEqual(0); expect(toolbar!.x + toolbar!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  const cards = navigation.getByRole("link", { name: "Cartões", exact: true });
  await cards.focus(); await cards.press("Enter");
  await expect(cards).toHaveAttribute("aria-current", "page");
  expect(new URL(page.url()).searchParams.get("tab")).toBe("cartoes");
  expect(new URL(page.url()).searchParams.get("month")).toBe("2026-09");
  await expect(page.getByRole("region", { name: "Meus cartões", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`financeiro-cartoes-${width}.png`), fullPage: true });
  await page.reload();
  await expect(navigation.getByRole("link", { name: "Cartões", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Gerenciar contas", exact: true }).click();
  await expect(navigation.getByRole("link", { name: "Contas", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Contas e cartões", exact: true })).toBeVisible();
  await navigation.getByRole("link", { name: "Categorias", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Categorias financeiras", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Doc18: seis colunas visíveis preservam busca por categoria e ordenação legada", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/financeiro?tab=lancamentos&month=2026-09&sort=category");
  const ledger = page.getByRole("region", { name: "Lista de lançamentos", exact: true });
  await expect(ledger.getByRole("columnheader")).toHaveText(["Lançamento", "Data", "Conta", "Estado", "Valor", "Ações"]);
  await expect(ledger.getByLabel("Ordenar por", { exact: true })).toHaveValue("category");
  const toolbar = ledger.locator(".ui-data-table__controls");
  await expect(toolbar.getByLabel("Buscar lançamentos", { exact: true })).toBeVisible();
  await expect(toolbar.getByRole("group", { name: "Filtros financeiros", exact: true })).toBeVisible();
  await expect(toolbar.getByLabel("Filtrar tipo", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("financeiro-lancamentos-1440.png"), fullPage: true });
  await ledger.getByLabel("Buscar lançamentos", { exact: true }).fill("alimentacao");
  const row = ledger.locator(".ui-data-table__desktop tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row.locator("td").first()).toContainText("Alimentação");
  const ids = await row.evaluateAll(rows => rows.map(row => row.getAttribute("data-row-id")));
  await page.setViewportSize({ width: 390, height: 844 });
  const cards = ledger.locator(".ui-data-table__cards > li");
  await expect(cards).toHaveCount(1);
  expect(await cards.evaluateAll(rows => rows.map(row => row.getAttribute("data-row-id")))).toEqual(ids);
  await expect(cards.first()).toContainText("Alimentação");
  expect(new URL(page.url()).searchParams.get("sort")).toBe("category");
  await page.screenshot({ path: testInfo.outputPath("financeiro-lancamentos-filtrados-390.png"), fullPage: true });
});

test("E6: entrada rápida exige revisão e não decide pagamento pela pessoa", async ({ page }) => {
  await open(page);
  const quick = page.getByRole("form", { name: "Preparar lançamento", exact: true });
  await quick.getByLabel("Descrição rápida", { exact: true }).fill("Compra a revisar");
  await quick.getByLabel("Valor rápido (R$)", { exact: true }).fill("123,45");
  await quick.getByLabel("Conta do lançamento rápido", { exact: true }).selectOption({ label: "Itaú" });
  await quick.getByRole("button", { name: "Revisar lançamento", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Novo lançamento", exact: true });
  await expect(dialog.getByLabel("Descrição", { exact: true })).toHaveValue("Compra a revisar");
  await expect(dialog.getByLabel("Valor (R$)", { exact: true })).toHaveValue("123,45");
  await expect(dialog.getByLabel("Já pago (R$)", { exact: true })).toHaveValue("0,00");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(quick.getByLabel("Descrição rápida", { exact: true })).toHaveValue("Compra a revisar");
  await expect(quick.getByRole("button", { name: "Revisar lançamento", exact: true })).toBeFocused();
  await workspace(page).getByRole("button", { name: "Ocultar valores", exact: true }).click();
  await expect(quick).toHaveCount(0);
  await expect(workspace(page).getByLabel("Valor rápido (R$)", { exact: true })).toHaveCount(0);
});

test("E6: cartão, drawer por teclado e conta sugerida sem pagamento automático", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole("button", { name: "Adicionar cartão", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Adicionar cartão", exact: true });
  await dialog.getByLabel("Nome da conta", { exact: true }).fill("Cartão do ensaio E6");
  await dialog.getByLabel("Limite do cartão (R$)", { exact: true }).fill("1.000,00");
  await dialog.getByLabel("Dia de fechamento", { exact: true }).fill("20");
  await dialog.getByLabel("Dia de vencimento", { exact: true }).fill("5");
  await dialog.getByLabel("Últimos quatro dígitos", { exact: true }).fill("0042");
  const preview = dialog.getByLabel("Prévia do cartão", { exact: true });
  await expect(preview).toContainText("Cartão do ensaio E6"); await expect(preview).toContainText("Final 0042");
  const beforeColor = await preview.evaluate(element => getComputedStyle(element).backgroundColor);
  await dialog.getByLabel("Cor", { exact: true }).selectOption("fin-2");
  await expect(preview).toHaveClass(/finance-color--fin-2/);
  expect(await preview.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(beforeColor);
  await expect(dialog.getByLabel("Instituição", { exact: true })).not.toBeVisible();
  await dialog.getByText("Opções da conta do cartão", { exact: true }).click();
  await expect(dialog.getByLabel("Tipo de conta", { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("Instituição", { exact: true })).toBeVisible();
  await dialog.getByText("Opções da conta do cartão", { exact: true }).click();
  await dialog.getByLabel("Conta sugerida para pagar a fatura", { exact: true }).selectOption({ label: "Itaú" });
  await dialog.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(dialog).toBeHidden();
  const trigger = page.getByRole("button", { name: "Detalhes do cartão Cartão do ensaio E6", exact: true });
  await trigger.click();
  dialog = page.getByRole("dialog", { name: "Cartão do ensaio E6", exact: true });
  const invoice = dialog.getByRole("tab", { name: "Fatura", exact: true });
  await invoice.focus(); await page.keyboard.press("End");
  await expect(dialog.getByRole("tab", { name: "Configurações", exact: true })).toBeFocused();
  await expect(dialog.getByRole("tabpanel")).toContainText("0042");
  await page.keyboard.press("Home");
  await expect(invoice).toBeFocused();
  await dialog.getByRole("button", { name: "Pagar fatura", exact: true }).click();
  const payment = page.getByRole("dialog", { name: "Pagar fatura", exact: true });
  await expect(payment.getByLabel("Conta para pagar a fatura", { exact: true })).toHaveValue("account-itau");
  await expect(payment.getByRole("button", { name: "Registrar pagamento", exact: true })).toBeVisible();
  await payment.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click(); await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("E6: máscara do cartão cobre Fatura, Compras e Configurações inclusive atributos acessíveis", async ({ page }) => {
  await open(page);
  await page.getByRole("navigation", { name: "Seções financeiras", exact: true }).getByRole("link", { name: "Contas", exact: true }).click();
  await page.getByRole("button", { name: "Editar conta Nubank", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Editar conta", exact: true });
  await editor.getByLabel("Últimos quatro dígitos", { exact: true }).fill("0042");
  await editor.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.getByRole("navigation", { name: "Seções financeiras", exact: true }).getByRole("link", { name: "Visão geral", exact: true }).click();
  await page.getByRole("button", { name: "Detalhes do cartão Nubank", exact: true }).click();
  let drawer = page.getByRole("dialog", { name: "Nubank", exact: true });
  await expect(drawer).toContainText("Final 0042");
  await drawer.getByRole("tab", { name: "Compras", exact: true }).click();
  // The original populated fixture proves this is not an empty-purchases pass.
  await expect(drawer).toContainText("Alimentação do mês");
  await expect(drawer).toContainText("1.234,10");
  await page.keyboard.press("Escape");
  await workspace(page).getByRole("button", { name: "Ocultar valores", exact: true }).click();
  await page.getByRole("button", { name: "Detalhes do cartão Nubank", exact: true }).click();
  drawer = page.getByRole("dialog", { name: "Nubank", exact: true });
  for (const name of ["Fatura", "Compras", "Configurações"]) {
    await drawer.getByRole("tab", { name, exact: true }).click();
    await expect(drawer.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
    const values = await drawer.locator(".finance-money").allTextContents();
    expect(values.length).toBeGreaterThan(0);
    expect(values.every(value => value === "R$ ••••")).toBe(true);
    const exposed = await drawer.evaluate(element => ({
      text: element.textContent ?? "",
      attributes: [element, ...element.querySelectorAll("*")].flatMap(node => Array.from(node.attributes)
        .filter(attribute => /^(?:aria-|data-)|^(?:title|value)$/.test(attribute.name))
        .map(attribute => attribute.value)).join(" "),
    }));
    for (const output of [exposed.text, exposed.attributes]) {
      expect(output).not.toMatch(/0042|123410|1\.234,10|800000|8\.000,00|R\$\s*[\d]/);
    }
    await expect(drawer).toContainText("Final oculto");
    await expect(drawer.locator("[aria-valuenow], svg[data-value], input[type='number']")).toHaveCount(0);
  }
});

for (const theme of ["light", "dark"] as const) {
  test("Doc18: detalhe sem cor explícita conserva fundo opaco e contraste em " + theme, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await open(page);
    await page.getByLabel("Tema", { exact: true }).selectOption(theme);
    await page.getByRole("button", { name: "Detalhes do cartão Nubank", exact: true }).click();
    const face = page.getByRole("dialog", { name: "Nubank", exact: true }).getByLabel("Identificação do cartão", { exact: true });
    await expect(face).toBeVisible();
    await expect(face).not.toHaveClass(/finance-color--/);
    const colors = await face.evaluate(element => {
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1;
      const context = canvas.getContext("2d"); if (!context) throw new Error("COLOR_READER_UNAVAILABLE");
      const rgba = (value: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return Array.from(context.getImageData(0, 0, 1, 1).data); };
      const background = rgba(style.backgroundColor), foreground = rgba(style.color);
      const luminance = (color: number[]) => color.slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
      const values = [luminance(background), luminance(foreground)].sort((a, b) => b - a);
      return { colorToken: style.getPropertyValue("--finance-color").trim(), background, foreground, contrast: (values[0]! + 0.05) / (values[1]! + 0.05) };
    });
    expect(colors.colorToken).toBe("");
    expect(colors.background[3]).toBe(255); expect(colors.foreground[3]).toBe(255);
    expect(colors.contrast).toBeGreaterThanOrEqual(4.5);
    await expect(face).toContainText("Nubank");
    await page.screenshot({ path: testInfo.outputPath(`financeiro-cartao-detalhe-sem-cor-${theme}-390.png`), fullPage: true });
  });
}

for (const theme of ["light", "dark"] as const) for (const width of [320, 390, 768, 1024, 1440]) {
  test("E6: composição " + theme + " em " + width + "px", async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
    await open(page);
    await page.getByLabel("Tema", { exact: true }).selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const main = workspace(page).locator(".finance-dashboard-main"), side = workspace(page).locator(".finance-dashboard-side");
    expect(await main.evaluate((element) => Boolean(element.compareDocumentPosition(element.nextElementSibling!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await expect(side.getByRole("region", { name: "Meus cartões", exact: true })).toBeVisible();
    await expect(main.locator(".finance-recent tbody tr")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const label of ["Descrição rápida", "Valor rápido (R$)", "Conta do lançamento rápido"]) {
      const field = workspace(page).getByLabel(label, { exact: true });
      expect(await field.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
      const box = await field.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const controls = workspace(page).locator(".finance-quick-entry button, .finance-card-link");
    for (let i = 0; i < await controls.count(); i++) {
      const box = await controls.nth(i).boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await testInfo.attach("financeiro-e6-" + theme + "-" + width, { body: await page.screenshot({ path: testInfo.outputPath(`financeiro-e6-${theme}-${width}.png`), fullPage: true }), contentType: "image/png" });
  });
}
