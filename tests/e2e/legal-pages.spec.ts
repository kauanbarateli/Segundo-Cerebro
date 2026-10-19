import { expect, test } from "@playwright/test";

const documents = [
  { path: "/privacidade", title: "Política de privacidade" },
  { path: "/termos-de-servico", title: "Termos de serviço" },
] as const;

test("documentos legais são públicos, legíveis sem JavaScript e navegáveis em 320px", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("O teste requer uma origem local.");
  const origin = new URL(baseURL);
  expect(["127.0.0.1", "localhost"]).toContain(origin.hostname);
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 320, height: 780 }, colorScheme: "dark", reducedMotion: "reduce" });
  const page = await context.newPage();
  const unexpected: string[] = [];
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin.origin || request.method() !== "GET" || url.pathname.startsWith("/api/")) {
      unexpected.push(request.method() + " " + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  try {
    for (const legalDocument of documents) {
      const response = await page.goto(legalDocument.path);
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(legalDocument.path);
      expect(await response!.text()).toContain(legalDocument.title);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(legalDocument.title);
      const index = page.getByRole("navigation", { name: "Nesta página" });
      const anchor = index.getByRole("link").first();
      await anchor.click();
      const hash = new URL(page.url()).hash;
      expect(hash).not.toBe("");
      await expect(page.locator(hash)).toBeInViewport();
      await page.goto(legalDocument.path);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      await expect(page.getByRole("link", { name: "suporte@segundocerebroapp.com.br", exact: true })).toHaveAttribute("href", "mailto:suporte@segundocerebroapp.com.br");
    }
    expect(unexpected).toEqual([]);
  } finally { await context.close(); }
});

test("rodapé da landing e Configurações levam aos mesmos documentos legais", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/conheca");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "Política de privacidade", exact: true }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await page.getByRole("navigation", { name: "Privacidade e termos", exact: true }).getByRole("link", { name: "Termos de serviço", exact: true }).click();
  await expect(page).toHaveURL(/\/termos-de-servico$/);
  await page.getByRole("combobox", { name: "Tema", exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: "Configurações do aplicativo", exact: true }).click();
  const section = page.getByRole("region", { name: "Privacidade e termos", exact: true });
  await expect(section).toBeVisible();
  await expect(section.getByRole("link", { name: "Política de privacidade", exact: true })).toHaveAttribute("href", "/privacidade");
  await section.getByRole("link", { name: "Termos de serviço", exact: true }).click();
  await expect(page).toHaveURL(/\/termos-de-servico$/);
});
