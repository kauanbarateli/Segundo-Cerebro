import { expect, test } from "@playwright/test";
// Prepared only. No server/browser/real OAuth run is claimed by T025 offline evidence.
for (const width of [390, 1440]) {
 test(`Calendar demo remains honest and readable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const calls: string[] = []; page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/calendar")) calls.push(request.url()); });
  await page.goto("/calendario?date=2026-09-25&view=month"); await expect(page.locator(".calendar-note").getByText("Agenda de exemplo · horários de São Paulo. Nenhuma conta externa conectada.", { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Conectar Google" })).toHaveCount(0); expect(calls).toEqual([]);
  // Layout Codex: up to 680px the week reads as an agenda; the grid stays on wider screens.
  await page.getByRole("button", { name: "Semana", exact: true }).click(); await expect(page.getByRole("region", { name: width <= 680 ? "Agenda da semana em lista" : "Grade semanal com rolagem interna" })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Integrações shows the same honest demo state: no Google request, no OAuth control.
  await page.goto("/integracoes"); await expect(page.getByText("Nenhuma conta conectada nesta demonstração", { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Conectar Google" })).toHaveCount(0); expect(calls).toEqual([]);
 });
}
// Connected manual checklist is in docs/implementation/t025-calendario-google.md:
// two accounts + replay/owner switch, 410/full reset, selection/Home/reminders,
// three-day all-day/exclusive end, link/create capture, disconnect uncertainty and Admin metadata.
