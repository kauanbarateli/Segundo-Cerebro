import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const trigger = (page: Page) => page.getByRole("banner").getByRole("button", { name: "Capturar", exact: true });
const modal = (page: Page) => page.getByRole("dialog", { name: "Capturar uma nota", exact: true });
const quickKeys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter(key => key.includes(":quick-draft:")));
const image = () => sharp({ create: { width: 24, height: 12, channels: 3, background: { r: 30, g: 90, b: 120 } } }).jpeg().toBuffer();

test("A04: abre sem mudar a URL, devolve o foco e não grava ao apenas abrir/fechar", async ({ page }) => {
  await page.goto("/tarefas");
  const url = page.url();
  await trigger(page).click();
  await expect(modal(page)).toBeVisible();
  await expect(modal(page).getByLabel("Título da nota", { exact: true })).toBeFocused();
  expect(page.url()).toBe(url);
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();
  expect(await quickKeys(page)).toEqual([]);
  await expect(page.getByText("Nota capturada.", { exact: true })).toHaveCount(0);
  // The sidebar keeps the full Capturar page.
  await expect(page.getByRole("navigation").getByRole("link", { name: "Capturar", exact: true }).first()).toHaveAttribute("href", "/capturar");
});

test("A04: salva com imagem, confirma, abre a nota criada e limpa o rascunho", async ({ page }) => {
  await page.goto("/calendario");
  await trigger(page).click();
  const dialog = modal(page);
  await dialog.getByLabel("Título da nota", { exact: true }).fill("Captura rápida A04");
  await dialog.getByLabel("Sua anotação", { exact: true }).fill("Texto da captura rápida.");
  await dialog.getByLabel("Escolher imagens", { exact: true }).setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: await image() });
  await expect(dialog.getByRole("img", { name: /^Prévia de / })).toHaveCount(1);
  await dialog.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(page.url()).toContain("/calendario");
  await expect(page.getByText("Nota capturada.", { exact: true })).toBeVisible();
  expect(await quickKeys(page)).toEqual([]);
  await page.getByRole("button", { name: "Abrir nota", exact: true }).click();
  await expect(page).toHaveURL(/\/capturar\?capture=/);
  await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue("Captura rápida A04");
});

test("A04: fechar com conteúdo preserva o rascunho separado e o descarte é explícito", async ({ page }) => {
  await page.goto("/tarefas");
  await trigger(page).click();
  await modal(page).getByLabel("Título da nota", { exact: true }).fill("Rascunho rápido");
  await modal(page).getByLabel("Sua anotação", { exact: true }).fill("corpo");
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  const keys = await quickKeys(page);
  expect(keys).toHaveLength(1);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes(":captures:drafts:")))).toEqual([]);
  await page.reload();
  await trigger(page).click();
  await expect(modal(page).getByLabel("Título da nota", { exact: true })).toHaveValue("Rascunho rápido");
  await expect(modal(page).getByText("Rascunho recuperado deste navegador.", { exact: true })).toBeVisible();
  await modal(page).getByRole("button", { name: "Descartar rascunho", exact: true }).click();
  await page.getByRole("dialog", { name: "Descartar o rascunho?", exact: true }).getByRole("button", { name: "Descartar rascunho", exact: true }).click();
  await expect(modal(page)).toBeHidden();
  expect(await quickKeys(page)).toEqual([]);
});

test("A04: título vazio mantém o modal e o texto; mais de seis imagens é recusado", async ({ page }) => {
  await page.goto("/tarefas");
  await trigger(page).click();
  const dialog = modal(page);
  await dialog.getByLabel("Sua anotação", { exact: true }).fill("sem título");
  await dialog.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await expect(dialog.getByText("Dê um título à nota para conseguir encontrá-la depois.", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Título da nota", { exact: true })).toBeFocused();
  await expect(dialog.getByLabel("Sua anotação", { exact: true })).toHaveValue("sem título");
  const buffer = await image();
  await dialog.getByLabel("Escolher imagens", { exact: true }).setInputFiles(Array.from({ length: 7 }, (_, index) => ({ name: `f${index}.jpg`, mimeType: "image/jpeg", buffer })));
  await expect(dialog.getByText("Cada nota aceita até seis imagens. Remova uma imagem ou escolha menos arquivos.", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("img", { name: /^Prévia de / })).toHaveCount(0);
});

for (const theme of ["light", "dark"] as const) test(`A04: celular 390px, alvo ≥44px e sem rolagem horizontal (${theme})`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto("/tarefas");
  const box = await trigger(page).boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  await trigger(page).click();
  await expect(modal(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const control of await modal(page).locator("input:visible, textarea:visible").all()) expect(await control.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
});

test("A04: troca/saída de conta fecha o modal e remove o rascunho do dono anterior", async ({ page }) => {
  await page.goto("/tarefas");
  await trigger(page).click();
  await modal(page).getByLabel("Título da nota", { exact: true }).fill("Segredo do dono anterior");
  await page.keyboard.press("Escape");
  expect(await quickKeys(page)).toHaveLength(1);
  await trigger(page).click();
  await expect(modal(page).getByLabel("Título da nota", { exact: true })).toHaveValue("Segredo do dono anterior");
  const owner = await page.evaluate(() => Object.keys(localStorage).find(key => key.includes(":quick-draft:"))!.split(":quick-draft:v1:")[1]!);
  await page.evaluate(userId => window.dispatchEvent(new CustomEvent("segundo-cerebro:demo-logout", { detail: { userId } })), decodeURIComponent(owner));
  await expect(modal(page)).toBeHidden();
  expect(await quickKeys(page)).toEqual([]);
});
