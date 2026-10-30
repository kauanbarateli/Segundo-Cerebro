import { expect, test } from "@playwright/test";

test("links legados de Drive oferecem contexto sem reabrir operações ou ler arquivos", async ({ page }) => {
  const reads: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/files") reads.push(request.method()); });
  for (const path of ["/drive", "/drive?folder=projects", "/drive?file=legacy"]) {
    await page.goto(path); const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Arquivos", exact: true })).toBeVisible();
    await expect(main.getByText(/Seus arquivos existentes permanecem preservados/)).toBeVisible();
    await expect(main.getByRole("button")).toHaveCount(0);
    await expect(main.locator('input[type="file"]')).toHaveCount(0);
    await expect(main.getByRole("searchbox")).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Voltar ao Início", exact: true })).toHaveAttribute("href", "/");
    await expect(page.locator('.shell-nav-link[href="/drive"]')).toHaveCount(0);
  }
  expect(reads).toEqual([]);
});

test("Cofre inicia com proteção real e consentimento de irrecuperabilidade", async ({ page }) => {
  await page.goto("/cofre"); const main = page.getByRole("main");
  await expect(main.getByText(/Demonstração com criptografia real/)).toBeVisible();
  await expect(main.getByLabel("Senha mestra", { exact: true })).toBeEditable();
  await expect(main.getByRole("checkbox", { name: /perder a senha mestra e o kit/ })).toHaveAttribute("aria-checked", "false");
  await expect(main.getByRole("button", { name: "Preparar Cofre e kit", exact: true })).toBeVisible();
  await expect(main.getByText(/O servidor não pode recuperá-los/)).toBeVisible();
});

test("Configurações conserva controles, tema e chips com destino ativo", async ({ page }) => {
  await page.goto("/configuracoes"); const main = page.getByRole("main");
  await expect(main.getByText("Pessoa de exemplo", { exact: true })).toBeVisible();
  await main.getByRole("navigation", { name: "Nesta página" }).getByRole("link", { name: "Aparência", exact: true }).click();
  await expect(page).toHaveURL(/#aparencia$/);
  await expect(main.getByRole("navigation", { name: "Nesta página" }).getByRole("link", { name: "Aparência", exact: true })).toHaveAttribute("aria-current", "location");
  // Layout Codex: Aparência uses the three theme models (native radios) instead of a select.
  await main.getByRole("radio", { name: "Escuro", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(main.getByLabel("Funcionalidade de demonstração", { exact: true }).getByRole("option", { name: "Drive", exact: true })).toHaveCount(0);
  await main.getByLabel("Funcionalidade de demonstração", { exact: true }).selectOption("tarefas");
  await main.getByLabel("Entitlement simulado", { exact: true }).selectOption("denied");
  await expect(main.getByLabel("Módulo para testar leitura", { exact: true }).getByRole("option", { name: "Drive", exact: true })).toHaveCount(0);
  await expect(main.getByLabel("Cenário de dados", { exact: true })).toBeEnabled();
});

for (const [key, route, heading] of [["settings", "/configuracoes", "Perfil"]] as const) {
  test(`erro real de ${key} é recuperável pela mesma leitura`, async ({ page }) => {
    await page.goto("/configuracoes");
    await page.getByLabel("Módulo para testar leitura", { exact: true }).selectOption(key);
    await page.getByRole("button", { name: "Simular falha na próxima leitura", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(route + "$"));
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(main.getByRole("alert")).toContainText("Não foi possível carregar");
    await main.getByRole("button", { name: "Tentar de novo", exact: true }).click();
    await expect(main.getByRole("alert")).toHaveCount(0);
    if (key === "settings") await expect(main.getByText("Pessoa de exemplo", { exact: true })).toBeVisible();
  });
}

test("cenário vazio vem da fonte e preserva acesso às preferências", async ({ page }) => {
  await page.goto("/configuracoes");
  await page.getByLabel("Cenário de dados", { exact: true }).selectOption("empty");
  await page.getByRole("button", { name: "Carregar cenário", exact: true }).click();
  await expect(page.getByText("Nenhum perfil de exemplo neste cenário.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Módulo para testar leitura", { exact: true }).getByRole("option", { name: "Drive", exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Claro", exact: true })).toBeEnabled();
});

for (const width of [320, 390, 1280]) test(`Drive, Cofre e Configurações cabem em ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ["/drive", "/cofre", "/configuracoes"]) {
    await page.goto(route);
    await expect(page.getByRole("main").locator('[data-access="allowed"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
