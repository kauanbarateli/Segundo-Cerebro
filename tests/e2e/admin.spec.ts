import { expect, test } from "@playwright/test";

// Prepared only. Default demo proves honest unavailability, never real administration.
for (const width of [320, 1280]) {
 test(`Admin demo does not invent accounts or query privileged API at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const adminRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/admin") adminRequests.push(request.url()); });
  await page.goto("/admin"); await expect(page.getByRole("heading", { name: "Admin", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acesso indisponível nesta demonstração" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar usuário", exact: true })).toHaveCount(0); expect(adminRequests).toEqual([]);
 });
 test(`simulated privilege still cannot create a real account at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const adminRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/admin") adminRequests.push(request.url()); });
  await page.goto("/configuracoes"); await page.getByLabel("Privilégio Admin da demonstração", { exact: true }).selectOption("enabled");
  await page.goto("/admin"); await expect(page.getByRole("heading", { name: "Admin precisa de uma conta conectada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar usuário", exact: true })).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0); expect(adminRequests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 });
}
