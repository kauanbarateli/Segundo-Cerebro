import { expect, test } from "@playwright/test";

// Run against the default APP_MODE=demo server, without Supabase credentials.
// These tests prove unavailable UI behavior, never successful authentication.
const forms = [
  ["/entrar", "Entrar"], ["/recuperar-senha", "Recuperar senha"],
  ["/redefinir-senha", "Definir nova senha"], ["/trocar-senha", "Trocar senha"],
] as const;

for (const width of [320, 390, 768, 1280]) {
  test("auth indisponível mantém formulário legível em " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const theme = width === 390 ? "dark" : "light";
    await page.addInitScript((value) => localStorage.setItem("segundo-cerebro-theme", value), theme);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [route, title] of forms) {
      await page.goto(route);
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
      await expect(main.getByRole("alert")).toContainText("Autenticação indisponível neste ambiente");
      await expect(main.getByRole("alert")).toContainText("Não informe sua senha aqui.");
      for (const input of await main.locator("input:not([type=hidden])").all()) {
        await expect(input).toBeDisabled();
        expect(await input.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
      }
      await expect(main.locator('button[type="submit"]')).toBeDisabled();
      const sizes = await page.locator(".auth-links a, .auth-form button, .auth-footer select").evaluateAll((elements) => elements.map((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
      expect(sizes.every(({ width: controlWidth, height }) => controlWidth >= 44 && height >= 44)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390 || width === 1280) await page.screenshot({ path: `test-results/auth-${route.slice(1)}-${width}-${theme}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test("links de recuperação preservam a navegação sem simular entrada", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => { if (/supabase\.(co|com)|supabase\.in/.test(new URL(request.url()).hostname)) external.push(request.url()); });
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Esqueci a senha", exact: true }).click();
  await expect(page).toHaveURL(/\/recuperar-senha$/);
  await expect(page.getByRole("main").getByRole("button", { name: "Enviar link de recuperação", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Voltar para entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole("main").getByText(/O cadastro é fechado/)).toBeVisible();
  expect(external).toEqual([]);
});

test("campos mantêm autofill e ocultação de senha nativos", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Mostrar senha", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.goto("/redefinir-senha");
  for (const label of ["Nova senha", "Confirmar nova senha"]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute("autocomplete", "new-password");
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute("type", "password");
  }
  await expect(page.getByLabel("Senha atual", { exact: true })).toHaveCount(0);
});

test("teclado alcança formulário, retorno e tema mesmo indisponível", async ({ page }) => {
  await page.goto("/recuperar-senha");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o formulário" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Voltar para entrar", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Tema", { exact: true })).toBeFocused();
  await page.getByLabel("Tema", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("URL não cria sucesso de autenticação nem reflete texto arbitrário", async ({ page }) => {
  await page.goto("/entrar?notice=password-updated&returnTo=https%3A%2F%2Fexample.invalid");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Autenticação indisponível");
  await expect(page.getByText("Senha atualizada. Entre novamente com sua nova senha.", { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/entrar\?/);
  await page.goto("/entrar?notice=texto-nao-confiavel");
  await expect(page.getByRole("main")).not.toContainText("texto-nao-confiavel");
});

test("rotas auth não substituem nem autenticam a demonstração existente", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Início", level: 1, exact: true })).toBeVisible();
  await page.goto("/entrar");
  await expect(page.getByRole("main").getByRole("button", { name: "Entrar", exact: true })).toBeDisabled();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Início", level: 1, exact: true })).toBeVisible();
});
