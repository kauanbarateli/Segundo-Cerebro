import { expect, test } from "@playwright/test";

test("Drive navega por pasta, mostra metadados e compartilha coleção com a lixeira", async ({ page }) => {
  await page.goto("/drive"); const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Arquivos recentes" })).toBeVisible();
  await main.getByRole("link", { name: /^Projetos 0 arquivos/ }).click();
  await expect(page).toHaveURL(/folder=projects$/);
  await main.getByRole("link", { name: /^SC V2/ }).click();
  await expect(page).toHaveURL(/folder=sc-v2$/);
  await expect(main.getByRole("navigation", { name: "Caminho da pasta" }).getByRole("link", { name: "Projetos", exact: true })).toBeVisible();
  await main.getByRole("searchbox", { name: "Filtrar arquivos" }).fill("logo");
  await main.getByRole("button", { name: "logo-segundo-cerebro.svg", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "logo-segundo-cerebro.svg" });
  await expect(detail).toContainText("8 KB"); await expect(detail).toContainText("Metadados de um arquivo de exemplo");
  await expect(detail.getByRole("button", { name: /Baixar|Excluir|Restaurar/ })).toHaveCount(0);
  await detail.getByRole("button", { name: "Fechar", exact: true }).click();
  await main.getByRole("link", { name: "Lixeira · 1", exact: true }).click();
  await expect(page).toHaveURL(/view=trash$/);
  await expect(main.getByRole("button", { name: "rascunho-antigo.txt", exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "logo-segundo-cerebro.svg", exact: true })).toHaveCount(0);
  await main.getByRole("link", { name: "Voltar aos arquivos", exact: true }).click();
  await expect(main.getByRole("button", { name: "rascunho-antigo.txt", exact: true })).toHaveCount(0);
});

test("Cofre percorre criação e bloqueio sem aceitar nem persistir senha pessoal", async ({ page }) => {
  await page.goto("/cofre"); const main = page.getByRole("main");
  await expect(main.getByText("Maquete de fluxo · sem criptografia. Não guarde segredos reais aqui.", { exact: true })).toBeVisible();
  await expect(main.getByLabel("Senha de demonstração", { exact: true })).toHaveAttribute("readonly", "");
  await main.getByRole("button", { name: "Criar demonstração", exact: true }).click();
  await expect(main.getByRole("alert")).toContainText("Preencha a senha de exemplo");
  await main.getByRole("button", { name: "Preencher senha de exemplo", exact: true }).click();
  await main.getByRole("checkbox", { name: /^Entendi que esta é uma demonstração/ }).click();
  await main.getByRole("button", { name: "Criar demonstração", exact: true }).click();
  await expect(main.getByRole("heading", { name: "Cofre de exemplo bloqueado", exact: true })).toBeFocused();
  await expect(main.getByLabel("Senha de demonstração", { exact: true })).toHaveValue("");
  await main.getByRole("button", { name: "Preencher senha de exemplo", exact: true }).click();
  await main.getByRole("button", { name: "Simular desbloqueio", exact: true }).click();
  await expect(main.getByRole("heading", { name: "Prévia do Cofre", exact: true })).toBeFocused();
  await expect(main.getByRole("button", { name: /Copiar|Revelar/ })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("Exemplo-maquete-2026");
  await main.getByRole("button", { name: "Bloquear prévia", exact: true }).click();
  await expect(main.getByLabel("Senha de demonstração", { exact: true })).toHaveValue("");
});

test("Configurações conserva controles, tema e chips com destino ativo", async ({ page }) => {
  await page.goto("/configuracoes"); const main = page.getByRole("main");
  await expect(main.getByText("Pessoa de exemplo", { exact: true })).toBeVisible();
  await main.getByRole("navigation", { name: "Nesta página" }).getByRole("link", { name: "Aparência", exact: true }).click();
  await expect(page).toHaveURL(/#aparencia$/);
  await expect(main.getByRole("navigation", { name: "Nesta página" }).getByRole("link", { name: "Aparência", exact: true })).toHaveAttribute("aria-current", "location");
  await main.getByLabel("Tema", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await main.getByLabel("Funcionalidade de demonstração", { exact: true }).selectOption("drive");
  await main.getByLabel("Entitlement simulado", { exact: true }).selectOption("denied");
  await expect(main.getByLabel("Módulo para testar leitura", { exact: true }).getByRole("option", { name: "Drive", exact: true })).toHaveCount(0);
  await expect(main.getByLabel("Cenário de dados", { exact: true })).toBeEnabled();
});

for (const [key, route, heading] of [["drive", "/drive", "Não foi possível abrir o Drive"], ["vault", "/cofre", "Não foi possível abrir esta demonstração"], ["settings", "/configuracoes", "Perfil"]] as const) {
  test(`erro real de ${key} é recuperável pela mesma leitura`, async ({ page }) => {
    await page.goto("/configuracoes");
    await page.getByLabel("Módulo para testar leitura", { exact: true }).selectOption(key);
    await page.getByRole("button", { name: "Simular falha na próxima leitura", exact: true }).click();
    if (key !== "settings") await page.getByRole("link", { name: `Abrir ${key === "drive" ? "Drive" : "Cofre"}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(route + "$"));
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(main.getByRole("alert")).toContainText("Não foi possível carregar");
    await main.getByRole("button", { name: "Tentar de novo", exact: true }).click();
    await expect(main.getByRole("alert")).toHaveCount(0);
    if (key === "drive") await expect(main.getByRole("heading", { name: "Arquivos recentes" })).toBeVisible();
    if (key === "vault") await expect(main.getByRole("heading", { name: "Criar cofre de exemplo" })).toBeVisible();
    if (key === "settings") await expect(main.getByText("Pessoa de exemplo", { exact: true })).toBeVisible();
  });
}

test("cenário vazio vem da fonte e preserva acesso às preferências", async ({ page }) => {
  await page.goto("/configuracoes");
  await page.getByLabel("Cenário de dados", { exact: true }).selectOption("empty");
  await page.getByRole("button", { name: "Carregar cenário", exact: true }).click();
  await expect(page.getByText("Nenhum perfil de exemplo neste cenário.", { exact: false })).toBeVisible();
  await page.getByLabel("Módulo para testar leitura", { exact: true }).selectOption("drive");
  await page.getByRole("link", { name: "Abrir Drive", exact: true }).click();
  await expect(page.getByText("Nenhum arquivo neste local.", { exact: true })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Lixeira · 0", exact: true }).click();
  await expect(page.getByText("A lixeira está vazia.", { exact: true })).toBeVisible();
});

for (const width of [320, 390, 1280]) test(`Drive, Cofre e Configurações cabem em ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ["/drive", "/cofre", "/configuracoes"]) {
    await page.goto(route);
    await expect(page.getByRole("main").locator('[data-access="allowed"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
