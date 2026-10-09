import { expect, test } from "@playwright/test";
import { contrastRatio } from "../../design-system/validate.mjs";

test("diálogo aninhado mantém modalidade, Escape fecha só o topo e restaura foco", async ({ page }) => {
  await page.goto("/design-system");
  const trigger = page.getByRole("button", { name: "Abrir diálogo", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Editar exemplo", exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  const field = dialog.getByRole("textbox", { name: "Título do exemplo", exact: true });
  await field.fill("Texto preservado durante a confirmação");
  const nestedTrigger = dialog.getByRole("button", { name: "Abrir confirmação aninhada" });
  await nestedTrigger.click();
  const nested = page.getByRole("dialog", { name: "Descartar alterações?", exact: true });
  await expect(nested.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press(index < 4 ? "Tab" : "Shift+Tab");
    expect(await nested.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(nested).not.toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(nestedTrigger).toBeFocused();
  await expect(field).toHaveValue("Texto preservado durante a confirmação");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("gesto iniciado no conteúdo não fecha diálogo; clique completo no fundo fecha", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByRole("button", { name: "Abrir diálogo", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Editar exemplo", exact: true });
  const field = dialog.getByRole("textbox", { name: "Título do exemplo", exact: true });
  await field.fill("Selecionar e arrastar não descarta");
  const fieldBox = await field.boundingBox();
  expect(fieldBox).not.toBeNull();
  await page.mouse.move(fieldBox!.x + 12, fieldBox!.y + 12);
  await page.mouse.down();
  await page.mouse.move(2, 2);
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await expect(field).toHaveValue("Selecionar e arrastar não descarta");
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
});

test("confirmação destrutiva inicia em Cancelar e confirma a ação explícita", async ({ page }) => {
  await page.goto("/design-system");
  const trigger = page.getByRole("button", { name: "Confirmar remoção", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Remover exemplo?", exact: true });
  await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Remover", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Exemplo removido." })).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("ajuda dentro do diálogo fica acessível e consome Escape antes de fechar a superfície", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByRole("button", { name: "Abrir diálogo", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Editar exemplo", exact: true });
  const help = dialog.getByRole("button", { name: "Ajuda no diálogo", exact: true });
  await help.focus();
  const tooltip = page.getByRole("tooltip", { name: "Ajuda sobre este exemplo", exact: true });
  await expect(tooltip).toBeVisible();
  await expect(help).toHaveAccessibleDescription("Ajuda sobre este exemplo");
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).not.toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(help).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("drawer conserva o formulário ao trocar desktop por tela cheia mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/design-system");
  await page.getByRole("button", { name: "Abrir drawer", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Detalhes do exemplo", exact: true });
  const field = drawer.getByRole("textbox", { name: "Descrição do exemplo", exact: true });
  await field.fill("O mesmo formulário nos dois tamanhos");
  const desktopBox = await drawer.boundingBox();
  expect(desktopBox?.width).toBe(560);
  expect(desktopBox?.x).toBe(720);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(field).toHaveValue("O mesmo formulário nos dois tamanhos");
  const mobileBox = await drawer.boundingBox();
  expect(mobileBox).toMatchObject({ x: 0, y: 0, width: 320, height: 568 });
  expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await drawer.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Abrir painel inferior", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Ações do exemplo", exact: true });
  const box = await sheet.boundingBox();
  expect(box?.height).toBeLessThanOrEqual(536);
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(568);
  expect(await sheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
});

test("toast temporário pausa com ponteiro e foco sem perder o tempo restante", async ({ page }) => {
  await page.clock.install();
  await page.goto("/design-system");
  await page.getByRole("button", { name: "Mostrar aviso temporário", exact: true }).click();
  const notice = page.locator(".ui-toast").filter({ hasText: "Alteração de exemplo registrada." });
  const dismiss = notice.getByRole("button", { name: "Dispensar aviso: Alteração de exemplo registrada.", exact: true });
  await notice.hover();
  await page.clock.runFor(1500);
  await expect(notice).toBeVisible();
  await dismiss.focus();
  await page.mouse.move(1, 1);
  await page.clock.runFor(1500);
  await expect(notice).toBeVisible();
  await page.getByRole("button", { name: "Mostrar aviso temporário", exact: true }).focus();
  await page.clock.runFor(1300);
  await expect(notice).toHaveCount(0);
});

test("avisos rápidos preservam Desfazer e limitam confirmações temporárias", async ({ page }) => {
  await page.clock.install();
  await page.goto("/design-system");
  await page.getByRole("button", { name: "Mostrar aviso com Desfazer", exact: true }).click();
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Mostrar aviso temporário", exact: true }).click();
  await expect(page.locator(".ui-toast")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Desfazer", exact: true })).toBeVisible();
  await page.clock.runFor(3500);
  await expect(page.locator(".ui-toast")).toHaveCount(1);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Arquivamento desfeito." })).toBeVisible();
});

test("toast com ação permanece, permite desfazer e dispensa com movimento reduzido", async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system");
  const trigger = page.getByRole("button", { name: "Mostrar aviso com Desfazer", exact: true });
  await trigger.click();
  const notice = page.locator(".ui-toast").filter({ hasText: "Exemplo arquivado." });
  await page.clock.runFor(15000);
  await expect(notice).toBeVisible();
  await expect(notice.getByRole("status")).toHaveAttribute("aria-live", "polite");
  await notice.getByRole("button", { name: "Desfazer", exact: true }).click();
  await page.clock.runFor(10);
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Arquivamento desfeito." })).toBeVisible();
  await trigger.click();
  await notice.getByRole("button", { name: "Dispensar aviso: Exemplo arquivado.", exact: true }).click();
  await page.clock.runFor(10);
  await expect(notice).toHaveCount(0);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`superfícies têm contraste e alvos nos dois temas: ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Abrir diálogo", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Editar exemplo", exact: true });
    await dialog.screenshot({ path: `test-results/dialog-${colorScheme}.png` });
    const pairs = await dialog.evaluate((element) => {
      const hex = (value: string) => "#" + (value.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0")).join("");
      const background = hex(getComputedStyle(element).backgroundColor);
      return [element, ...element.querySelectorAll(".ui-dialog__description")].map((target) => ({ foreground: hex(getComputedStyle(target).color), background }));
    });
    for (const pair of pairs) expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
    for (const button of await dialog.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Mostrar aviso com Desfazer", exact: true }).click();
    const notice = page.locator(".ui-toast").filter({ hasText: "Exemplo arquivado." });
    const pair = await notice.evaluate((element) => {
      const hex = (value: string) => "#" + (value.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0")).join("");
      const style = getComputedStyle(element);
      return { foreground: hex(style.color), background: hex(style.backgroundColor) };
    });
    expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
    for (const button of await notice.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await notice.screenshot({ path: `test-results/toast-${colorScheme}.png` });
  });
}
