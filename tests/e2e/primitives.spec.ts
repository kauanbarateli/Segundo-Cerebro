import { expect, test } from "@playwright/test";
import { contrastRatio } from "../../design-system/validate.mjs";

test("loading preserva o rótulo e impede envio duplicado", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/design-system");
  const save = page.getByRole("button", { name: "Salvar exemplo", exact: true });
  await save.click();
  await expect(save).toBeDisabled();
  await expect(save).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Envios iniciados: 1", { exact: true })).toBeVisible();
  await page.locator("section[aria-labelledby='primitivos']").screenshot({ path: "test-results/primitives-mobile-loading.png" });
  await page.getByRole("button", { name: "Concluir simulação", exact: true }).click();
  await expect(save).toBeEnabled();
  await expect(page.getByRole("status").filter({ hasText: "Exemplo salvo." })).toBeVisible();
});

test("campo associa instrução e erro, valida e recebe foco", async ({ page }) => {
  await page.goto("/design-system");
  const title = page.getByRole("textbox", { name: "Nome da nota", exact: true });
  await expect(title).toHaveAccessibleDescription("Use um nome que ajude a reencontrar a ideia.");
  await page.getByRole("button", { name: "Validar exemplo" }).click();
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveAccessibleDescription("Use um nome que ajude a reencontrar a ideia. Dê um nome à nota para continuar.");
  await title.fill("Uma ideia para retomar");
  await page.getByRole("textbox", { name: "Resumo", exact: true }).fill("Contexto de demonstração.");
  await page.getByRole("combobox", { name: "Destino" }).selectOption("conhecimento");
  await page.getByRole("button", { name: "Validar exemplo" }).click();
  await expect(title).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("status").filter({ hasText: "Campos validados. Nenhum dado foi enviado." })).toBeVisible();
  await expect(page.getByLabel("Campo desabilitado", { exact: true })).toBeDisabled();
  const loading = page.getByLabel("Campo em carregamento", { exact: true });
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(loading).not.toBeEditable();
  await expect(loading).toHaveValue("Conteúdo preservado");
  await expect(page.getByLabel("Somente leitura", { exact: true })).not.toBeEditable();
});

test("pílula informa seleção e catálogo preserva os 47 ícones", async ({ page }) => {
  await page.goto("/design-system");
  const pill = page.getByRole("button", { name: "Filtrar trabalho" });
  await expect(pill).toHaveAttribute("aria-pressed", "false");
  await pill.click();
  await expect(pill).toHaveAttribute("aria-pressed", "true");
  await pill.press("Space");
  await expect(pill).toHaveAttribute("aria-pressed", "false");
  await page.getByText("Ver os 47 ícones do projeto", { exact: true }).click();
  await expect(page.locator(".icon-specimens li")).toHaveCount(47);
  for (const icon of await page.locator(".icon-specimens svg").all()) {
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(icon).toHaveAttribute("stroke-width", "1.75");
  }
  await expect(page.getByRole("img", { name: "Segundo Cérebro", exact: true })).toHaveCount(1);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`controles têm alvos, estados e contraste em ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/design-system");
    const samples = page.locator("section[aria-labelledby='primitivos']");
    const controls = samples.locator(".ui-button, .field__control");
    for (const control of await controls.all()) {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    for (const field of await samples.locator(".field__control").all()) {
      expect(await field.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    }
    const foregrounds = samples.locator(".ui-button:not(:disabled), .ui-button[data-loading], .ui-badge, .ui-card, .field__label, .field__hint, .field__error, .field__loading");
    for (const element of await foregrounds.all()) {
      for (const hover of [false, true]) {
        if (hover) await element.hover();
        const pair = await element.evaluate((element) => {
          const rgbToHex = (value: string) => "#" + (value.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0")).join("");
          let ancestor: Element | null = element;
          let background = "";
          while (ancestor) {
            background = getComputedStyle(ancestor).backgroundColor;
            if (background !== "rgba(0, 0, 0, 0)" && background !== "transparent") break;
            ancestor = ancestor.parentElement;
          }
          return { foreground: rgbToHex(getComputedStyle(element).color), background: rgbToHex(background) };
        });
        expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
      }
    }
    const primary = page.getByRole("button", { name: "Primário", exact: true });
    await page.keyboard.press("Tab");
    await primary.focus();
    expect(await primary.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    await expect(primary).toHaveCSS("outline-style", "solid");
    expect(await primary.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
    await primary.hover();
    await page.mouse.down();
    await expect(primary).not.toHaveCSS("transform", "none");
    await page.mouse.up();
    await page.locator("section[aria-labelledby='primitivos']").screenshot({ path: `test-results/primitives-${colorScheme}.png` });
  });
}

test("movimento reduzido remove giro, pressão animada e conclui saída de toast", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system");
  const save = page.getByRole("button", { name: "Salvar exemplo", exact: true });
  await save.click();
  await expect(save.locator("svg")).toHaveCSS("animation-name", "none");
  const primary = page.getByRole("button", { name: "Primário", exact: true });
  await primary.hover();
  await page.mouse.down();
  await expect(primary).toHaveCSS("transform", "none");
  await page.mouse.up();
  // Exercise the shared exit utility without requiring the future T-006 Toast.
  const sample = page.getByText("Envios iniciados: 1", { exact: true });
  await sample.evaluate((element) => element.classList.add("toast-out"));
  await expect(sample).toHaveCSS("visibility", "hidden");
});
