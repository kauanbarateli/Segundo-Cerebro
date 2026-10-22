import { expect, test, type Page } from "@playwright/test";

const workspace = (page: Page) => page.getByRole("region", { name: "Gestão financeira", exact: true });
async function open(page: Page) {
  await page.goto("/financeiro?tab=painel&month=2026-09");
  await expect(workspace(page).getByRole("button", { name: "Ocultar valores", exact: true })).toBeVisible();
}

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
  await page.getByRole("navigation", { name: "Seções financeiras", exact: true }).getByRole("link", { name: "Painel", exact: true }).click();
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

for (const theme of ["light", "dark"] as const) for (const width of [320, 390, 768, 1440]) {
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
    await testInfo.attach("financeiro-e6-" + theme + "-" + width, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });
}
