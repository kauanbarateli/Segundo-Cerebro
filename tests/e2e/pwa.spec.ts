import { expect, test } from "@playwright/test";

test("manifest e ícones passam a verificação de instalabilidade do Chromium", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Segundo Cérebro");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await context.newCDPSession(page);
  await expect.poll(async () => (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors).toEqual([]);
  await cdp.detach();
});

test("service worker mantém apenas shell público e serve orientação em navegação sem rede", async ({ page, context }) => {
  await page.goto("/tarefas");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const urls = await page.evaluate(async () => {
    const names = await caches.keys();
    return (await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname)))).flat();
  });
  expect(urls).toContain("/offline");
  expect(urls).toContain("/icons/icon-192.png");
  expect(urls).toContain("/icons/maskable-512.png");
  expect(urls).toContain("/splash/1170x2532-dark.png");
  expect(urls.some((url) => url.startsWith("/_next/static/"))).toBe(true);
  expect(urls.every((url) => url === "/offline" || url.startsWith("/_next/static/") || url.startsWith("/icons/") || url.startsWith("/splash/"))).toBe(true);
  expect(urls).not.toContain("/tarefas");
  await context.setOffline(true);
  await page.goto("/conhecimento");
  await expect(page.getByRole("heading", { name: "Vamos retomar quando houver conexão" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar conectar novamente" })).toBeVisible();
  const family = await page.locator("body").evaluate((element) => getComputedStyle(element).fontFamily);
  expect(family).toContain("Geist");
  await page.screenshot({ path: "test-results/pwa-offline.png", fullPage: true });
  await context.setOffline(false);
  await page.getByRole("button", { name: "Tentar conectar novamente" }).click();
  await expect(page.getByRole("heading", { name: "Início", level: 1, exact: true })).toBeVisible();
});

test("share target informa limite sem persistir ou refletir o conteúdo compartilhado", async ({ request, page }) => {
  const response = await request.post("/compartilhar/receber", { multipart: { text: "conteudo-privado-de-teste", url: "https://example.com/privado" }, maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(new URL(response.headers().location!).pathname).toBe("/compartilhar");
  await page.goto("/compartilhar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Compartilhar para cá está em preparação");
  await expect(page.getByText(/ainda não foi salvo/)).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("conteudo-privado-de-teste");
});

test("convite de instalação permanece nas configurações e mantém evento recebido no Início", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Início", level: 1 })).toBeVisible();
  // The browser's real installability is tested above. This event probes deferred UX.
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: () => Promise.resolve(), userChoice: Promise.resolve({ outcome: "dismissed" }) });
    window.dispatchEvent(event);
  });
  await expect(page.getByRole("button", { name: "Instalar Segundo Cérebro" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Navegação principal", exact: true }).getByRole("link", { name: "Configurações", exact: true }).click();
  const install = page.getByRole("button", { name: "Instalar Segundo Cérebro" });
  await install.click();
  await expect(page.getByRole("status").filter({ hasText: "Você pode instalar mais tarde pelo menu do navegador." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Segundo Cérebro no seu dispositivo" })).toBeVisible();
});
