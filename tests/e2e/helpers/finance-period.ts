import { expect, type Page } from "@playwright/test";

export const financePeriodTrigger = (page: Page) => page.getByRole("button", { name: /^Competência selecionada:/ });
export async function readFinancePeriod(page: Page): Promise<string> {
  const month = await financePeriodTrigger(page).getAttribute("data-month");
  expect(month).toMatch(/^(?!0000)\d{4}-(0[1-9]|1[0-2])-01$/);
  return month!.slice(0, 7);
}

/** Exercise the product's controls, including year navigation, in both fixtures. */
export async function selectFinancePeriod(page: Page, month: string) {
  expect(month).toMatch(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/);
  await financePeriodTrigger(page).click();
  const picker = page.getByRole("dialog", { name: "Selecionar período", exact: true });
  await expect(picker).toBeVisible();
  const output = picker.getByLabel("Ano do período", { exact: true }), target = Number(month.slice(0, 4));
  let year = Number(await output.textContent());
  while (year !== target) {
    await picker.getByRole("button", { name: year < target ? "Próximo ano" : "Ano anterior", exact: true }).click();
    year += year < target ? 1 : -1;
    await expect(output).toHaveText(String(year).padStart(4, "0"));
  }
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
  await picker.getByRole("button", { name: label, exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(financePeriodTrigger(page)).toHaveAttribute("data-month", `${month}-01`);
}
