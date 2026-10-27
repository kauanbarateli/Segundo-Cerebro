import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";

// Run against the default APP_MODE=demo server, without Supabase credentials.
// The available-form fixture below proves local validation/rejection only, never successful authentication.
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
      const themeGroup = page.getByRole("group", { name: "Tema", exact: true });
      await expect(themeGroup.getByRole("radio")).toHaveCount(3);
      for (const name of ["Claro", "Escuro", "Sistema"]) await expect(themeGroup.getByRole("radio", { name, exact: true })).toBeVisible();
      await expect(themeGroup.getByRole("radio", { name: theme === "dark" ? "Escuro" : "Claro", exact: true })).toBeChecked();
      const sizes = await page.locator(".auth-topbar a, .auth-intro a:visible, .auth-links a, .auth-form button, .auth-footer a, .auth-theme input").evaluateAll((elements) => elements.map((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
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
  await page.addInitScript(() => localStorage.setItem("segundo-cerebro-theme", "system"));
  await page.goto("/recuperar-senha");
  const skip = page.getByRole("link", { name: "Pular para o formulário", exact: true });
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Segundo Cérebro — conhecer o aplicativo", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "Sistema", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: "Escuro", exact: true })).toBeFocused();
  await expect(page.getByRole("radio", { name: "Escuro", exact: true })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "Segundo Cérebro — conhecer o aplicativo", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Voltar para entrar", exact: true })).toBeFocused();
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

// A finite React presentation fixture. It imports the actual AuthForm, replaces
// server Actions only, and never establishes a session or contacts a backend.
let availableSignInBundle: string | undefined;
async function signInFixtureBundle() {
  if (availableSignInBundle) return availableSignInBundle;
  const entry = resolve("tests/e2e/fixtures/auth-sign-in-acknowledgement.tsx").replaceAll("\\", "/");
  const builder = await rolldown({ input: entry, platform: "browser", tsconfig: false,
    resolve: { alias: { "@/lib/auth/actions": entry, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "finite-auth-sign-in-presentation-port", resolveId(source) {
      if (source.endsWith(".css")) return "\0auth-acknowledgement-css";
      if (source === "next/link") return "\0auth-acknowledgement-link";
    }, load(id) {
      if (id === "\0auth-acknowledgement-css") return "export {};";
      if (id === "\0auth-acknowledgement-link") return "export { AuthFixtureLink as default } from " + JSON.stringify(entry) + ";";
    } }],
  });
  try {
    const generated = await builder.generate({ format: "iife", codeSplitting: false }), chunk = generated.output[0];
    if (generated.output.length !== 1 || chunk?.type !== "chunk" || chunk.imports.length || chunk.dynamicImports.length) throw new Error("Closed Auth presentation fixture required.");
    availableSignInBundle = chunk.code;
    return availableSignInBundle;
  } finally { await builder.close(); }
}

test("ciência obrigatória impede envio e permanece marcada após recusa sintética", async ({ page }) => {
  const unexpected: string[] = [];
  await page.route("**/*", async route => {
    const request = route.request();
    if (request.method() === "GET" && request.isNavigationRequest() && request.url() === "https://auth-acknowledgement.test/entrar") {
      await route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="pt-BR"><body><main id="auth-acknowledgement"></main></body></html>' }); return;
    }
    unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  await page.goto("https://auth-acknowledgement.test/entrar");
  await page.addScriptTag({ content: await signInFixtureBundle() });
  await page.evaluate(() => (globalThis as unknown as { __startAuthAcknowledgement(): void }).__startAuthAcknowledgement());
  const form = page.locator("form.auth-form"), email = form.getByRole("textbox", { name: "E-mail", exact: true });
  const acknowledgement = form.getByRole("checkbox", { name: "Li os Termos de Serviço e a Política de Privacidade.", exact: true });
  const calls = () => page.evaluate(() => (globalThis as unknown as { __authAcknowledgementCalls(): number }).__authAcknowledgementCalls());
  await expect(acknowledgement).toBeVisible();
  await expect(acknowledgement).not.toBeChecked();
  await expect(acknowledgement).toHaveAttribute("required", "");
  await email.fill("synthetic-auth@example.invalid");
  await form.getByLabel("Senha", { exact: true }).fill("Synthetic-only-123!");
  for (const [name, href] of [["Ler os Termos de Serviço (abre em nova aba)", "/termos-de-servico"], ["Ler a Política de Privacidade (abre em nova aba)", "/privacidade"]]) {
    const link = form.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /(?:^|\s)noopener(?:\s|$)/);
    expect(await link.evaluate(node => node.closest("label") === null)).toBe(true);
  }
  await form.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(acknowledgement).toBeFocused();
  expect(await calls()).toBe(0);
  await page.keyboard.press("Space");
  await expect(acknowledgement).toBeChecked();
  await form.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Recusa sintética de autenticação.");
  expect(await calls()).toBe(1);
  await expect(email).toHaveValue("synthetic-auth@example.invalid");
  await expect(acknowledgement).toBeChecked();
  expect(unexpected).toEqual([]);
});
