import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test(`atalhos mobile preservam a ordem do protótipo e alvos em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "Navegação no celular", exact: true });
    await expect(navigation.getByRole("link")).toHaveText(["Início", "Tarefas", "Capturar", "Agenda"]);
    const capture = navigation.getByRole("link", { name: "Capturar", exact: true });
    await expect(capture).toHaveClass(/shell-bottom-capture/);
    for (const control of await navigation.locator("a,button").all()) {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await capture.focus(); await expect(capture).toBeFocused();
    await expect(page.locator(".home-skeleton")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath(`doc18-demo-inicio-${width}-light.png`), fullPage: true, animations: "disabled" });
    await capture.press("Enter"); await expect(page).toHaveURL(/\/capturar$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("Projetos conclui e reabre a mesma tarefa, sem duplicar, e cria no contexto", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/projetos?project=project-sc-v2");
  const tasks = page.locator(".project-section").filter({ has: page.getByRole("heading", { name: "Tarefas", exact: true }) });
  const rows = tasks.locator(".project-task-row"), row = rows.first(), toggle = row.getByRole("button");
  await expect(toggle).toBeEnabled();
  const count = await rows.count(), initial = await toggle.getAttribute("aria-pressed"), href = await row.getByRole("link").getAttribute("href");
  await toggle.click(); await expect(toggle).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");
  await expect(rows).toHaveCount(count); await expect(row.getByRole("link")).toHaveAttribute("href", href!);
  await toggle.click(); await expect(toggle).toHaveAttribute("aria-pressed", initial!); await expect(rows).toHaveCount(count);
  await expect(page.getByRole("heading", { name: "Pastas", exact: true })).toHaveCount(0);
  const create = tasks.getByRole("link", { name: "Adicionar tarefa", exact: true });
  await expect(create).toHaveAttribute("href", "/tarefas?new=1&project=project-sc-v2");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath("doc18-demo-projeto-1440-light.png"), fullPage: true, animations: "disabled" });
  await create.click();
  const editor = page.getByRole("dialog", { name: "Nova tarefa", exact: true });
  await expect(editor).toBeVisible(); await expect(editor.getByLabel("Projeto", { exact: true })).toHaveValue("project-sc-v2");
  await page.screenshot({ path: info.outputPath("doc18-demo-tarefa-contextual-1440-light.png"), fullPage: true, animations: "disabled" });
});

test("Configurações e Ajuda preservam os limites do modo demonstrativo", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/configuracoes");
  await expect(page.getByLabel("Funcionalidade de demonstração", { exact: true }).getByRole("option", { name: "Drive", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Módulo para testar leitura", { exact: true }).getByRole("option", { name: "Drive", exact: true })).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath("doc18-demo-configuracoes-390-light.png"), fullPage: true, animations: "disabled" });
  await page.goto("/ajuda");
  await expect(page.getByRole("heading", { name: "Uma demonstração para explorar", exact: true })).toBeVisible();
  await expect(page.getByText(/Este modo usa exemplos/)).toBeVisible();
  await expect(page.getByText(/dados dos módulos são exemplos temporários/)).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("doc18-demo-ajuda-390-light.png"), fullPage: true, animations: "disabled" });
});
