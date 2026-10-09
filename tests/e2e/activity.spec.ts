import { expect, test } from "@playwright/test";

for (const width of [320, 1280]) {
  test(`Atividade demo não consulta produção em ${width}px`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", request => { if (new URL(request.url()).pathname === "/api/activity") requests.push(request.method()); });
    await page.setViewportSize({ width, height: 900 }); await page.goto("/atividade");
    await expect(page.getByRole("heading", { level: 1, name: "Atividade", exact: true })).toBeVisible();
    await expect(page.locator(".shell-context")).toContainText("Atividade");
    await expect(page.getByRole("heading", { name: "A atividade real aparece na sua conta", exact: true })).toBeVisible();
    await expect(page.getByText("Esta é uma demonstração. Nenhum registro de produção é consultado aqui.", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Registros de atividade" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Voltar ao Início", exact: true }).click();
    await expect(page).toHaveURL("/"); expect(requests).toEqual([]);
  });
}
