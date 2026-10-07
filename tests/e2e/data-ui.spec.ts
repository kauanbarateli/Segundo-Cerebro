import { expect, test, type Page } from "@playwright/test";

async function expectSameRows(page: Page, expected: string[]) {
  const tableRows = page.locator(".ui-data-table tbody tr[data-row-id]");
  const cards = page.locator(".ui-data-table__cards > li[data-row-id]");
  const rowIds = async (locator: typeof tableRows) => locator.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-row-id")));
  await expect(tableRows).toHaveCount(expected.length);
  await expect(cards).toHaveCount(expected.length);
  expect(await rowIds(tableRows)).toEqual(expected);
  expect(await rowIds(cards)).toEqual(expected);
}

test("desktop e mobile preservam a mesma coleção após ordenar, paginar e filtrar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/design-system");
  const table = page.getByRole("table", { name: "Tarefas de exemplo" });
  await expect(table).toBeVisible();
  await expectSameRows(page, ["a", "b", "c"]);
  await page.getByRole("combobox", { name: "Ordenar por", exact: true }).selectOption("order");
  await page.getByRole("button", { name: "Usar ordem decrescente" }).click();
  await expectSameRows(page, ["f", "e", "d"]);
  await expect(table.getByRole("columnheader", { name: /Ordem/ })).toHaveAttribute("aria-sort", "descending");
  await page.getByRole("button", { name: "Próxima página", exact: true }).click();
  await expectSameRows(page, ["c", "b", "a"]);
  await page.getByRole("searchbox", { name: "Filtrar exemplos" }).fill("concluida");
  await expectSameRows(page, ["f", "d", "b"]);
  await expect(page.getByText("1–3 de 3 registros", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 780 });
  await expect(page.getByRole("list", { name: "Tarefas de exemplo" })).toBeVisible();
  await expect(table).toBeHidden();
  await expectSameRows(page, ["f", "d", "b"]);
  await page.getByRole("button", { name: "Usar ordem crescente" }).click();
  await expectSameRows(page, ["b", "d", "f"]);
  await page.getByRole("searchbox", { name: "Filtrar exemplos" }).fill("sem resultado");
  await expect(page.getByText("Nenhum resultado para este filtro. Tente outro termo.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Próxima página", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Limpar filtro", exact: true }).click();
  await expectSameRows(page, ["a", "b", "c"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("switch funciona com Espaço e Enter, preserva nome e bloqueia estados indisponíveis", async ({ page }) => {
  await page.goto("/design-system");
  const toggle = page.getByRole("switch", { name: "Mostrar tarefas concluídas", exact: true });
  await expect(toggle).toBeChecked();
  await toggle.focus();
  await toggle.press("Space");
  await expect(toggle).not.toBeChecked();
  await expectSameRows(page, ["a", "c", "e"]);
  await toggle.press("Enter");
  await expect(toggle).toBeChecked();
  await expectSameRows(page, ["a", "b", "c"]);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveCSS("outline-style", "solid");
  expect(await toggle.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  const box = await toggle.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("switch", { name: "Opção indisponível" })).toBeDisabled();
  const loading = page.getByRole("switch", { name: "Salvando preferência de exemplo" });
  await expect(loading).toBeDisabled();
  await expect(loading).toHaveAttribute("aria-busy", "true");
});

test("tooltip descreve o acionador por foco e hover, permanece sob o ponteiro e Esc dispensa", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/design-system");
  const trigger = page.getByRole("button", { name: "Ajuda sobre os dados", exact: true });
  await trigger.focus();
  await expect(trigger).toHaveAccessibleDescription("Exemplo de ajuda contextual");
  await expect(page.getByRole("tooltip")).toBeVisible();
  const box = await page.getByRole("tooltip").boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.press("Tab");
  await expect(trigger).not.toBeFocused();
  await expect(trigger).not.toHaveAttribute("aria-describedby");
  await page.mouse.move(0, 0);
  await trigger.hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await tooltip.hover();
  // Pointer transfer must survive the 120ms leave bridge, not merely mount once.
  await page.waitForTimeout(150);
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
});

test("progresso, gráfico, recolhimento e navegação informam seu estado", async ({ page }) => {
  await page.goto("/design-system");
  const progress = page.getByRole("progressbar", { name: "Organização de exemplo" });
  await expect(progress).toHaveAttribute("aria-valuemin", "0");
  await expect(progress).toHaveAttribute("aria-valuemax", "5");
  await expect(progress).toHaveAttribute("aria-valuenow", "3");
  await expect(progress).toHaveAttribute("aria-valuetext", "3 de 5 exemplos organizados");
  const chart = page.getByRole("figure", { name: "Atividade de exemplo" });
  await expect(chart).toHaveAccessibleDescription(/.+/);
  const details = page.getByRole("button", { name: "Detalhes da amostra", exact: true });
  await expect(details).toHaveAttribute("aria-expanded", "false");
  const controlled = await details.getAttribute("aria-controls");
  expect(controlled).toBeTruthy();
  const content = page.locator(`[id="${controlled}"]`);
  await expect(content).toBeHidden();
  await details.press("Enter");
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await expect(content).toBeVisible();
  await details.press("Space");
  await expect(content).toBeHidden();
  const navigation = page.getByRole("navigation", { name: "Navegação da demonstração", exact: true });
  await expect(navigation.locator("a[aria-current='location']")).toHaveCount(1);
  await expect(navigation.locator("a[aria-current='location']")).toHaveAttribute("href", "#dados-interativos");
});

test("tabela comunica carregamento, vazio e erro com recuperação", async ({ page }) => {
  await page.goto("/design-system");
  const state = page.getByRole("combobox", { name: "Estado da demonstração de dados", exact: true });
  const table = page.getByRole("region", { name: "Tarefas de exemplo", exact: true });
  await state.selectOption("loading");
  await expect(table).toHaveAttribute("aria-busy", "true");
  await expect(table.getByRole("status")).toHaveText("Carregando registros…");
  await expect(table.getByRole("searchbox")).toBeDisabled();
  await state.selectOption("empty");
  await expect(table.getByText("Nenhum registro disponível.")).toBeVisible();
  await expect(table.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  await state.selectOption("error");
  await expect(table.getByRole("alert")).toContainText("Não foi possível carregar os exemplos.");
  await table.getByRole("button", { name: "Tentar novamente" }).click();
  await expectSameRows(page, ["a", "b", "c"]);
  await expect(state).toHaveValue("ready");
});
