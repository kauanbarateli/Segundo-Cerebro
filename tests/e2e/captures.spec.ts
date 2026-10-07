import { expect, test } from "@playwright/test";
import sharp from "sharp";

test("capturar, converter e abrir origem usa a mesma sessão", async ({ page }) => {
  await page.goto("/capturar");
  await page.getByLabel("Título da nota", { exact: true }).fill("Ideia do teste de captura");
  await page.getByLabel("Sua anotação", { exact: true }).fill("Contexto mantido ao criar uma tarefa.");
  await page.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await expect(page).toHaveURL(/\/capturar\?capture=/);
  const captureUrl = page.url();
  await expect(page.getByRole("navigation", { name: "Notas salvas", exact: true }).getByRole("button", { name: /Ideia do teste de captura/ })).toBeVisible();
  await page.getByRole("button", { name: "Virar tarefa", exact: true }).click();
  await expect(page.getByRole("link", { name: "Abrir tarefa criada", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Abrir tarefa criada", exact: true }).click();
  await expect(page).toHaveURL(/\/tarefas\?task=/);
  await expect(page.getByRole("dialog", { name: "Editar tarefa", exact: true }).getByLabel("Título", { exact: true })).toHaveValue("Ideia do teste de captura");
  await page.getByText("Organização e origem", { exact: true }).click();
  await page.getByRole("link", { name: "Abrir captura de origem", exact: true }).first().click();
  await expect(page).toHaveURL(captureUrl);
  await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue("Ideia do teste de captura");
  await expect(page.getByRole("button", { name: "Virar tarefa", exact: true })).toHaveCount(0);
});

test("wiki, vínculo explícito e renomeação preservam referências", async ({ page }) => {
  await page.goto("/capturar?capture=accountant");
  await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue("Ligar pro contador até sexta");
  await page.getByRole("button", { name: "Vincular nota", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Vincular a outra nota" });
  await dialog.getByRole("searchbox", { name: "Buscar nota para vincular" }).fill("visao");
  await dialog.getByRole("button", { name: "Visão do produto", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Sua anotação", { exact: true }).fill("Confirmar [[Decisões de arquitetura]] e [[Ainda não existe]].");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
  await expect(page.getByText("Ainda não encontrada: Ainda não existe.", { exact: false })).toBeVisible();
  await page.getByRole("navigation", { name: "Notas salvas", exact: true }).getByRole("button", { name: /^Decisões de arquitetura/ }).click();
  await expect(page).toHaveURL(/\/capturar\?capture=architecture$/);
  await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue("Decisões de arquitetura");
  await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
  await page.getByLabel("Título da nota", { exact: true }).fill("Arquitetura revisada no teste");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
  await expect(page.getByRole("navigation", { name: "Notas salvas", exact: true }).getByRole("button", { name: /^Arquitetura revisada no teste/ })).toBeVisible();
  await page.getByRole("navigation", { name: "Notas salvas", exact: true }).getByRole("button", { name: /^Ligar pro contador/ }).click();
  await expect(page).toHaveURL(/\/capturar\?capture=accountant$/);
  await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue("Ligar pro contador até sexta");
  await expect(page.getByLabel("Sua anotação", { exact: true })).toHaveValue("Confirmar [[Arquitetura revisada no teste]] e [[Ainda não existe]].");
  await expect(page.getByRole("button", { name: "Visão do produto", exact: true })).toBeVisible();
});

test("arquivo e restauração mantêm nota e oferecem desfazer reversível", async ({ page }) => {
  await page.goto("/capturar?capture=watch");
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restaurar nota", exact: true })).toBeVisible();
  await page.getByRole("group", { name: "Filtrar notas" }).getByRole("button", { name: "Arquivo", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Notas salvas", exact: true }).getByRole("button", { name: /^Atalho de captura pelo relógio/ })).toBeVisible();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Virar tarefa", exact: true })).toBeVisible();
  await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue("Atalho de captura pelo relógio?");
});

test("rascunho sobrevive a refresh e logout limpa inclusive flush pendente", async ({ page }) => {
  await page.goto("/capturar");
  await page.getByLabel("Título da nota", { exact: true }).fill("Rascunho antes do refresh");
  await page.getByLabel("Sua anotação", { exact: true }).fill("Ainda não é uma nota salva.");
  await expect(page.getByRole("status").filter({ hasText: "Rascunho salvo neste navegador" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue("Rascunho antes do refresh");
  await expect(page.getByLabel("Sua anotação", { exact: true })).toHaveValue("Ainda não é uma nota salva.");
  await page.getByLabel("Sua anotação", { exact: true }).fill("Último input antes de sair.");
  await page.getByRole("complementary", { name: "Trilho de navegação", exact: true }).getByRole("link", { name: "Sair da demonstração", exact: true }).click();
  await expect(page).toHaveURL(/\/sair$/);
  await page.getByRole("link", { name: "Voltar à demonstração", exact: true }).click();
  await page.getByRole("navigation", { name: "Navegação principal", exact: true }).getByRole("link", { name: "Capturar", exact: true }).click();
  await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue("");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("segundo-cerebro:captures:drafts:v1:")).map((key) => localStorage.getItem(key)).join(""))).not.toContain("Último input");
});

test("escolher, colar e arrastar imagens reencoda pixels sem EXIF", async ({ page }) => {
  // Observe the exact Blob used for a preview without making a new fetch(blob:)
  // request. CSP deliberately restricts connect-src to the application origin.
  await page.addInitScript(() => {
    const original = URL.createObjectURL;
    const captured = new Map<string, Blob>();
    (window as typeof window & { capturedImageBlobs: Map<string, Blob> }).capturedImageBlobs = captured;
    URL.createObjectURL = (value) => {
      const url = original(value);
      if (value instanceof Blob) captured.set(url, value);
      return url;
    };
  });
  const source = await sharp({ create: { width: 24, height: 12, channels: 3, background: { r: 30, g: 90, b: 120 } } }).jpeg().withExif({ IFD0: { ImageDescription: "T009_EXIF_SENTINEL" } }).toBuffer();
  expect(source.includes(Buffer.from("T009_EXIF_SENTINEL"))).toBe(true);
  await page.goto("/capturar");
  await page.getByLabel("Título da nota", { exact: true }).fill("Imagens do teste");
  await page.getByLabel("Escolher imagens", { exact: true }).setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: source });
  const previews = page.getByRole("img", { name: /^Prévia de Captura/ });
  await expect(previews).toHaveCount(1);
  const output = await previews.first().evaluate(async (element) => {
    const blob = (window as typeof window & { capturedImageBlobs: Map<string, Blob> }).capturedImageBlobs.get((element as HTMLImageElement).src);
    if (!blob) throw new Error("Blob da prévia não foi observado.");
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  expect(Buffer.from(output).includes(Buffer.from("T009_EXIF_SENTINEL"))).toBe(false);
  expect(Buffer.from(output).includes(Buffer.from("Exif\0\0"))).toBe(false);
  for (const method of ["paste", "drop"] as const) {
    await expect(page.getByRole("button", { name: "Anexar imagem", exact: true })).toBeEnabled();
    await page.getByLabel("Sua anotação", { exact: true }).evaluate((element, payload) => {
      const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(payload.bytes)], "foto.jpg", { type: "image/jpeg" }));
      const event = payload.method === "paste" ? new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }) : new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    }, { bytes: Array.from(source), method });
    await expect(previews).toHaveCount(method === "paste" ? 2 : 3);
    await expect(page.getByRole("button", { name: "Anexar imagem", exact: true })).toBeEnabled();
  }
  await page.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await expect(page).toHaveURL(/capture=/);
  await expect(previews).toHaveCount(3);
  await page.getByLabel("Escolher imagens", { exact: true }).setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("SVG não é aceito");
});

for (const width of [320, 390, 1280]) test(`editor e primeira imagem alcançáveis em ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/capturar?capture=architecture");
  const attach = page.getByRole("button", { name: "Anexar imagem", exact: true });
  await expect(attach).toBeVisible();
  const rect = await attach.boundingBox(); expect(rect?.width).toBeGreaterThanOrEqual(44); expect(rect?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("button", { name: "Organizar e definir tipo", exact: true })).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
