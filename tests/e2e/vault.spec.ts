import { expect, test, type Page } from "@playwright/test";
import { rolldown } from "rolldown";
import { resolve } from "node:path";
import type { VaultCipherItem, VaultHeader, VaultMasterWrap } from "../../src/core/cofre/types";
// Recovery halves and unlocked fields are synthetic, but never belong in traces.
test.use({ trace: "off" });
async function createViaUi(page: Page, output: (file: string) => string) {
 await page.goto("/cofre");
 await page.getByLabel("Senha mestra", { exact: true }).fill("UmaSenhaMestraForte2026!");
 await page.getByLabel("Confirmar senha mestra", { exact: true }).fill("UmaSenhaMestraForte2026!");
 await page.getByRole("checkbox").click();
 await page.getByRole("button", { name: "Preparar Cofre e kit", exact: true }).click();
 await expect(page.getByRole("heading", { name: "Guardar e provar o kit de recuperação", exact: true })).toBeVisible();
 const paths: string[] = [];
 for (const half of ["A", "B"]) { const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Baixar metade " + half, exact: true }).click(); const file = output("kit-" + half + ".txt"); await (await download).saveAs(file); paths.push(file); }
 await page.getByLabel("Arquivo da metade A", { exact: true }).setInputFiles(paths[0]!);
 await page.getByLabel("Arquivo da metade B", { exact: true }).setInputFiles(paths[1]!);
 await page.getByRole("button", { name: "Provar kit e criar Cofre", exact: true }).click();
 await expect(page.getByRole("heading", { name: "Cofre desbloqueado", exact: true })).toBeVisible();
 return paths;
}
for (const width of [390, 1280]) test("Cofre gera/prova kit, CRUD cifrado e recupera pela senha nova em " + width + "px", async ({ page }, info) => {
 await page.setViewportSize({ width, height: 900 });
 const paths = await createViaUi(page, file => info.outputPath(file));
 await page.getByRole("button", { name: "Novo item", exact: true }).click();
 const editor = page.getByRole("dialog", { name: "Novo item do Cofre", exact: true });
 await expect(editor.getByLabel("Título do item", { exact: true })).toBeFocused();
 await editor.getByLabel("Título do item", { exact: true }).fill("Login da jornada");
 await editor.getByLabel("Usuário do login", { exact: true }).fill("fixture@example.test");
 await editor.getByLabel("Senha do item", { exact: true }).fill("Segredo-sintetico-canary");
 await editor.getByRole("button", { name: "Salvar item cifrado", exact: true }).click();
 await expect(editor).toBeHidden();
 await expect(page.getByRole("button", { name: "Editar Login da jornada", exact: true })).toBeVisible();
 await page.getByRole("button", { name: "Excluir Login da jornada", exact: true }).click();
 await page.getByRole("dialog", { name: "Excluir item do Cofre?", exact: true }).getByRole("button", { name: "Mover item para a lixeira", exact: true }).click();
 await page.getByRole("button", { name: "Lixeira do Cofre", exact: true }).click();
 await page.getByRole("button", { name: "Restaurar Login da jornada", exact: true }).click();
 await page.getByRole("button", { name: "Itens ativos", exact: true }).click();
 await page.getByRole("button", { name: "Bloquear Cofre", exact: true }).click();
 await expect(page.getByRole("heading", { name: "Cofre bloqueado", exact: true })).toBeVisible();
 await expect(page.getByRole("button", { name: "Editar Login da jornada", exact: true })).toHaveCount(0);
 await page.getByRole("button", { name: "Usar kit de recuperação", exact: true }).click();
 await page.getByLabel("Arquivo da metade A", { exact: true }).setInputFiles(paths[0]!);
 await page.getByLabel("Arquivo da metade B", { exact: true }).setInputFiles(paths[1]!);
 await page.getByLabel("Nova senha mestra", { exact: true }).fill("UmaFraseNovaMestra2027!");
 await page.getByLabel("Confirmar senha mestra", { exact: true }).fill("UmaFraseNovaMestra2027!");
 await page.getByRole("button", { name: "Recuperar e trocar senha", exact: true }).click();
 await expect(page.getByRole("button", { name: "Editar Login da jornada", exact: true })).toBeVisible();
 await page.getByRole("button", { name: "Editar Login da jornada", exact: true }).click();
 await expect(page.getByRole("dialog", { name: "Editar item do Cofre", exact: true }).getByLabel("Senha do item", { exact: true })).toHaveValue("Segredo-sintetico-canary");
 await page.keyboard.press("Escape");
 await page.evaluate(() => window.scrollTo(0, 0));
 await page.screenshot({ path: `test-results/t024-vault-${width}.png`, fullPage: true });
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 const persisted = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
 expect(JSON.stringify(persisted)).not.toContain("Segredo-sintetico-canary");
 expect(JSON.stringify(persisted)).not.toContain("UmaSenhaMestraForte2026");
});

test("cifra e kit reais recuperam em contexto de navegador limpo sem a chave anterior", async ({ browser, baseURL }) => {
 // Isolated crypto harness; production CSP/worker is covered separately by the actual UI journeys.
 const bundler = await rolldown({ input: resolve("tests/e2e/fixtures/vault-crypto-browser.ts"), platform: "browser" });
 const generatedBundle = await bundler.generate({ format: "iife" }); await bundler.close();
 const chunk = generatedBundle.output.find(output => output.type === "chunk"); if (!chunk || chunk.type !== "chunk") throw new Error("Crypto browser fixture unavailable."); const bundle = chunk.code;
 type Fixture = { header: VaultHeader; item: VaultCipherItem; kit: { a: string; b: string }; exportFailed: boolean };
 const first = await browser.newContext({ bypassCSP: true }), firstPage = await first.newPage();
 await firstPage.goto(baseURL!); await firstPage.addScriptTag({ content: bundle });
 const generated = await firstPage.evaluate(async () => (globalThis as unknown as { __vaultCryptoFixture: { create(): Promise<Fixture> } }).__vaultCryptoFixture.create());
 expect(generated.exportFailed).toBe(true); await first.close();
 const clean = await browser.newContext({ bypassCSP: true }), cleanPage = await clean.newPage();
 await cleanPage.goto(baseURL!); await cleanPage.addScriptTag({ content: bundle });
 const recovered = await cleanPage.evaluate(async value => (globalThis as unknown as { __vaultCryptoFixture: { recover(data: Fixture): Promise<{ plain: { note: string }; master: VaultMasterWrap }> } }).__vaultCryptoFixture.recover(value), generated);
 expect(recovered.plain.note).toBe("Segredo sintético limpo"); expect(recovered.master).not.toEqual(generated.header.master); await clean.close();
});

test("Cofre limpa a interface imediatamente ao ocultar a aba", async ({ page }, info) => {
 await createViaUi(page, file => info.outputPath(file));
 await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
 await expect(page.getByRole("heading", { name: "Cofre bloqueado", exact: true })).toBeVisible();
 await expect(page.getByRole("button", { name: "Novo item", exact: true })).toHaveCount(0);
});
