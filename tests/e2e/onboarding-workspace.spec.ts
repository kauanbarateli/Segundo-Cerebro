/** Real nine-screen presentation with a closed synthetic HTTP server. This
 * does not certify Auth, SQL, Google, hosted persistence or mobile devices. */
import { expect, test, type Page } from "@playwright/test";
import { buildOnboardingWorkspaceBrowser } from "./helpers/onboarding-workspace-browser";
import { attachOnboardingApi, emptyOnboardingSnapshot, onboardingOrigin, onboardingOtherOwner, onboardingOwner, partialOnboardingSnapshot } from "./helpers/onboarding-workspace-api";
import { describeVisualFailures, inspectVisualGuards } from "./helpers/visual-guards";
import { contrastRatio } from "../../design-system/validate.mjs";

let bundle: string, styles: string;
test.describe.configure({ retries: 0 });
test.use({ trace: "off", video: "off" });
test.beforeAll(async () => { const result = await buildOnboardingWorkspaceBrowser(); bundle = result.code; styles = result.css; });
const titles = ["Sua vida, com mais clareza.", "Como podemos chamar você?", "Traga sua agenda.", "Comece com um hábito.", "Dê nome a um plano.", "Escolha o próximo passo.", "Um lugar para suas ideias.", "Explore no seu tempo.", "Vamos começar?"];
async function mount(page: Page, ownerId = onboardingOwner, navigate = true) {
  if (navigate) await page.goto(onboardingOrigin + "/onboarding");
  await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: bundle });
  await page.evaluate(actor => (globalThis as unknown as { __startOnboarding(ownerId: string): void }).__startOnboarding(actor), ownerId);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Vamos com calma.");
  await expect(page.locator("main[aria-busy=true]")).toHaveCount(0); await page.evaluate(() => document.fonts.ready);
}
async function title(page: Page, name: string) { await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible(); }
async function next(page: Page, expected: string, skip = true) { await page.getByRole("button", { name: skip ? "Pular" : "Continuar", exact: true }).click(); await title(page, expected); }
async function start(page: Page) { await page.getByRole("button", { name: "Começar", exact: true }).click(); await title(page, titles[1]!); }
async function skipToSummary(page: Page) { await start(page); for (const heading of titles.slice(2)) await next(page, heading); }
async function assertVisual(page: Page) {
  const report = await inspectVisualGuards(page);
  for (const gate of ["overflow", "targets", "fields"] as const) expect(report[gate], describeVisualFailures(report, gate)).toEqual([]);
  const pairs = await page.locator(".ob-heading h1, .ob-heading p, .ob-meta:visible, .field__label:visible").evaluateAll(elements => elements.map(element => {
    const hex = (value: string) => "#" + (value.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map(part => Math.round(Number(part)).toString(16).padStart(2, "0")).join("");
    let ancestor: Element | null = element, background = "";
    while (ancestor) { background = getComputedStyle(ancestor).backgroundColor; if (background !== "rgba(0, 0, 0, 0)" && background !== "transparent") break; ancestor = ancestor.parentElement; }
    return { foreground: hex(getComputedStyle(element).color), background: hex(background) };
  }));
  for (const pair of pairs) expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
}

for (const width of [320, 390]) for (const theme of ["light", "dark"] as const) {
  test(`nove telas: pular tudo, teclado, temas e movimento reduzido ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const api = await attachOnboardingApi(page, theme); await mount(page); await title(page, titles[0]!); await assertVisual(page);
    await expect(page.getByRole("complementary")).toHaveCount(0);
    await page.getByRole("button", { name: "Começar", exact: true }).focus(); await page.keyboard.press("Enter"); await title(page, titles[1]!);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    for (const heading of titles.slice(2)) { await assertVisual(page); await next(page, heading); }
    await assertVisual(page); expect(api.trace.effects).toEqual([]);
    await page.getByRole("button", { name: "Preparar meu espaço", exact: true }).click(); await title(page, "Seu espaço está pronto.");
    await expect(page.getByText("Você pode configurar tudo pelo painel, no seu tempo.", { exact: true })).toBeVisible();
    expect(api.snapshot.round?.receipts).toEqual([]); expect(api.trace.effects).toEqual([]); expect(api.commands("onboarding.confirm")).toHaveLength(1);
    await page.screenshot({ path: info.outputPath(`onboarding-empty-${width}-${theme}.png`), fullPage: true });
    expect(api.trace.unexpected).toEqual([]); expect(api.trace.errors).toEqual([]);
  });
}

test("fazer depois na boas-vindas reconhece a oferta sem criar registros dos módulos", async ({ page }) => {
  const initial = emptyOnboardingSnapshot();
  initial.eligibility = { kind: "new_explicit", canStart: true, offerPending: true, reason: null };
  const api = await attachOnboardingApi(page, "light", initial); await mount(page);
  await title(page, titles[0]!);
  await page.getByRole("button", { name: "Fazer depois", exact: true }).click();
  await expect.poll(() => api.snapshot.round?.status).toBe("paused");
  expect(api.snapshot.eligibility.offerPending).toBe(false);
  expect(api.commands("onboarding.start")).toHaveLength(1);
  expect(api.commands("onboarding.pause")).toHaveLength(1);
  expect(api.commands("onboarding.confirm")).toHaveLength(0);
  expect(api.trace.effects).toEqual([]);
  expect(api.snapshot.round?.draft).toEqual({ profile: {}, habits: [], projects: [], tasks: [], notes: null });
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __onboardingNavigations: string[] }).__onboardingNavigations)).toEqual(["/"]);
  await page.reload(); await mount(page, onboardingOwner, false);
  await title(page, titles[1]!);
  expect(api.commands("onboarding.start")).toHaveLength(1);
  expect(api.trace.unexpected).toEqual([]); expect(api.trace.errors).toEqual([]);
});

test("configuração completa preserva vínculos explícitos e cria cada intenção uma vez", async ({ page }) => {
  const api = await attachOnboardingApi(page, "light"); await mount(page); await start(page);
  await page.getByLabel("Seu nome", { exact: true }).fill("Pessoa organizada"); await page.getByText("Definir meu foco", { exact: true }).click(); await page.getByRole("button", { name: "Estudos", exact: true }).click();
  await next(page, titles[2]!, false); await next(page, titles[3]!);
  await page.getByLabel("Seu primeiro hábito", { exact: true }).fill("Ler quinze minutos"); await page.getByRole("button", { name: "Adicionar hábito", exact: true }).click(); await next(page, titles[4]!, false);
  await page.getByLabel("Nome do projeto", { exact: true }).fill("Estudar fotografia"); await page.getByText("Definir contexto", { exact: true }).click(); await page.getByLabel("Contexto (opcional)", { exact: true }).selectOption("study"); await page.getByRole("button", { name: "Adicionar projeto", exact: true }).click(); await next(page, titles[5]!, false);
  await page.getByLabel("Sua próxima tarefa", { exact: true }).fill("Separar material"); await page.getByText("Vincular e definir prazo", { exact: true }).click(); await page.getByLabel("Projeto", { exact: true }).selectOption({ label: "Estudar fotografia" }); await page.getByRole("button", { name: "Adicionar tarefa", exact: true }).click(); await next(page, titles[6]!, false);
  await page.getByLabel("Nome do caderno", { exact: true }).fill("Meu aprendizado"); await page.getByText("Escrever uma primeira nota", { exact: true }).click(); await page.getByLabel("Título da nota", { exact: true }).fill("Primeira ideia"); await page.getByLabel("Sua ideia", { exact: true }).fill("Aprender observando."); await page.getByLabel("Projeto", { exact: true }).selectOption({ label: "Estudar fotografia" });
  await next(page, titles[7]!, false); await expect(page.getByRole("textbox")).toHaveCount(0); await next(page, titles[8]!, false);
  expect(api.trace.effects).toEqual([]); const draft = structuredClone(api.snapshot.round!.draft!);
  expect(draft.tasks[0]!.project).toEqual({ kind: "draft", key: draft.projects[0]!.key }); expect(draft.notes!.page!.project).toEqual({ kind: "draft", key: draft.projects[0]!.key });
  await page.getByRole("button", { name: "Preparar meu espaço", exact: true }).click(); await title(page, "Seu espaço está pronto.");
  expect(api.snapshot.round!.receipts.map(item => item.kind)).toEqual(["profile", "habit", "project", "task", "notebook", "page", "link"]); expect(api.trace.effects).toHaveLength(7); expect(new Set(api.trace.effects).size).toBe(7); expect(api.commands("onboarding.advance")).toHaveLength(7);
  await page.reload(); await mount(page, onboardingOwner, false); await title(page, "Seu espaço está pronto."); expect(api.trace.effects).toHaveLength(7); expect(api.commands("onboarding.confirm")).toHaveLength(1);
  expect(api.trace.unexpected).toEqual([]); expect(api.trace.errors).toEqual([]);
});

test("rascunho incompleto sobrevive a pausa, recarga e volta sem criar registros", async ({ page }) => {
  const api = await attachOnboardingApi(page, "dark"); await mount(page); await start(page); await page.getByLabel("Seu nome", { exact: true }).fill("Nome em rascunho");
  await next(page, titles[2]!); await next(page, titles[3]!); await page.getByLabel("Seu primeiro hábito", { exact: true }).fill(" ");
  await page.getByRole("button", { name: "Fazer depois", exact: true }).click();
  await expect.poll(() => api.snapshot.round?.status).toBe("paused"); expect(api.trace.effects).toEqual([]); const key = api.snapshot.round!.draft!.habits[0]!.key;
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __onboardingNavigations: string[] }).__onboardingNavigations)).toEqual(["/"]);
  await page.reload(); await mount(page, onboardingOwner, false); await title(page, titles[3]!);
  await expect(page.getByRole("button", { name: "Editar hábito:", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar hábito:", exact: true }).click(); await page.getByLabel("Seu primeiro hábito", { exact: true }).fill("Ler uma página");
  await page.getByRole("button", { name: "Continuar", exact: true }).click(); await title(page, titles[4]!); expect(api.snapshot.round!.draft!.habits[0]!.key).toBe(key); expect(api.snapshot.round!.draft!.profile.displayName).toBe("Nome em rascunho"); expect(api.trace.effects).toEqual([]);
  expect(api.trace.unexpected).toEqual([]); expect(api.trace.errors).toEqual([]);
});

test("validação final conserva campos vazios e não confirma intenção inválida", async ({ page }) => {
  const api = await attachOnboardingApi(page, "light"); await mount(page); await start(page); await next(page, titles[2]!); await next(page, titles[3]!);
  await page.getByLabel("Seu primeiro hábito", { exact: true }).fill(" "); for (const heading of titles.slice(4)) await next(page, heading);
  await page.getByRole("button", { name: "Preparar meu espaço", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("Complete os campos indicados");
  expect(api.commands("onboarding.confirm")).toHaveLength(0); expect(api.trace.effects).toEqual([]); expect(api.snapshot.round!.draft!.habits).toHaveLength(1);
  await page.getByRole("button", { name: "Revisar etapa", exact: true }).click(); await title(page, titles[3]!); expect(api.trace.unexpected).toEqual([]);
});

test("duplo clique durante confirmação mantém uma única execução", async ({ page }) => {
  const api = await attachOnboardingApi(page, "light"); await mount(page); await skipToSummary(page);
  let release!: () => void; api.trace.holdCommand = { command: "onboarding.confirm", wait: new Promise<void>(resolve => { release = resolve; }) };
  await page.getByRole("button", { name: "Preparar meu espaço", exact: true }).evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
  await expect.poll(() => api.commands("onboarding.confirm").length).toBe(1); await expect(page.getByRole("button", { name: "Preparar meu espaço", exact: true })).toBeDisabled(); release(); await title(page, "Seu espaço está pronto.");
  expect(api.commands("onboarding.confirm")).toHaveLength(1); expect(api.trace.effects).toEqual([]); expect(api.trace.errors).toEqual([]);
});

test("confirmação com resposta perdida exige consulta antes de avançar, sem reconfirmar", async ({ page }) => {
  const api = await attachOnboardingApi(page, "light", emptyOnboardingSnapshot(), { lose: "onboarding.confirm" }); await mount(page); await start(page); await page.getByLabel("Seu nome", { exact: true }).fill("Nome preparado"); for (const heading of titles.slice(2)) await next(page, heading);
  await page.getByRole("button", { name: "Preparar meu espaço", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("Não conseguimos confirmar o resultado"); expect(api.commands("onboarding.advance")).toHaveLength(0);
  await page.getByRole("button", { name: "Conferir estado salvo", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Versão salva carregada." })).toBeVisible();
  await page.getByRole("button", { name: "Verificar e continuar", exact: true }).click(); await title(page, "Seu espaço está pronto."); expect(api.commands("onboarding.confirm")).toHaveLength(1); expect(api.trace.effects).toHaveLength(1); expect(api.trace.unexpected).toEqual([]);
});

test("recuperação omite dependentes somente por aceite explícito e preserva confirmados", async ({ page }) => {
  const api = await attachOnboardingApi(page, "dark", partialOnboardingSnapshot()); await mount(page); const confirmed = structuredClone(api.snapshot.round!.receipts[0]);
  const project = page.locator(".ob-recovery-item").filter({ has: page.getByRole("heading", { name: "Projeto", exact: true }) });
  await expect(project.getByRole("button", { name: "Deixar de criar este item", exact: true })).toBeDisabled(); await project.getByRole("checkbox").check(); await project.getByRole("button", { name: "Deixar de criar este item", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "A alteração foi conferida." })).toBeVisible(); expect(api.snapshot.round!.receipts[0]).toEqual(confirmed); expect(api.snapshot.round!.receipts.slice(1).map(item => item.status)).toEqual(["omitted", "omitted"]); expect(api.trace.effects).toEqual([]);
  await expect(page.getByRole("region", { name: "Resultados da preparação" })).toContainText("Deixado de fora · nenhum registro criado"); await page.getByRole("button", { name: "Verificar e continuar", exact: true }).click(); await title(page, "Seu espaço está pronto."); expect(api.trace.effects).toEqual([]); expect(api.trace.unexpected).toEqual([]);
});

for (const [status, code] of [[403, "FORBIDDEN"], [409, "CONFLICT"]] as const) {
  test(`emenda incerta continua bloqueada após ${status}, consulta e repete corpo original`, async ({ page }) => {
    const api = await attachOnboardingApi(page, "light", partialOnboardingSnapshot(), { lose: "onboarding.amend" }); await mount(page);
    const project = page.locator(".ob-recovery-item").filter({ has: page.getByRole("heading", { name: "Projeto", exact: true }) });
    await project.getByRole("button", { name: "Revisar esta escolha", exact: true }).click(); await project.getByLabel("Nome proposto", { exact: true }).fill("Plano corrigido"); await project.getByRole("button", { name: "Conferir e substituir esta escolha", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Não conseguimos confirmar o resultado"); api.trace.amendDenial = { status, code };
    await page.getByRole("button", { name: "Conferir a mesma alteração", exact: true }).click(); await expect.poll(() => api.commands("onboarding.amend").length).toBe(2);
    await expect(page.getByRole("button", { name: "Conferir a mesma alteração", exact: true })).toBeEnabled(); await expect(page.getByRole("button", { name: "Verificar e continuar", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Conferir estado salvo", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("A resposta da alteração anterior ainda precisa ser confirmada");
    api.trace.amendDenial = null; await page.getByRole("button", { name: "Conferir a mesma alteração", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "A alteração foi conferida." })).toBeVisible();
    expect(api.commands("onboarding.amend")).toHaveLength(3); expect(new Set(api.commands("onboarding.amend").map(item => item.body)).size).toBe(1); expect(api.commands("onboarding.advance")).toHaveLength(0); expect(api.trace.effects).toEqual([]); expect(api.trace.unexpected).toEqual([]);
  });
}

test("revisão de perfil conserva proposta e CAS durante consulta; nova intenção remonta o editor", async ({ page }) => {
  const initial = partialOnboardingSnapshot(), original = initial.round!.receipts[0]!;
  initial.round!.receipts = [{ ...original, status: "failed", entityId: null, reason: "conflict" }];
  initial.recovery = [{ intentId: original.intentId, itemKey: original.itemKey, kind: "profile", status: "failed", choice: { kind: "profile", patch: { displayName: "Proposta original" }, expectedProfileRevision: "profile:1" }, canReplace: true, canOmit: true, dependentIntentIds: [] }];
  const api = await attachOnboardingApi(page, "light", initial); await mount(page);
  const editor = page.locator(".ob-recovery-item"); await editor.getByRole("button", { name: "Revisar esta escolha", exact: true }).click(); await editor.getByLabel("Nome proposto", { exact: true }).fill("Proposta local preservada");
  api.snapshot.profile = { displayName: "Nome de outra aba", focus: "work", revision: "profile:2" }; api.snapshot.round!.revision = "10";
  await editor.getByRole("button", { name: "Consultar dados atuais", exact: true }).click(); await expect(editor.getByText(/Dados consultados da conta: Nome de outra aba/)).toBeVisible();
  await expect(editor.getByLabel("Nome proposto", { exact: true })).toHaveValue("Proposta local preservada"); await expect(editor.getByRole("button", { name: "Usar a versão consultada como base", exact: true })).toBeEnabled(); expect(api.commands("onboarding.amend")).toHaveLength(0);
  await editor.getByRole("button", { name: "Usar a versão consultada como base", exact: true }).click(); await editor.getByRole("button", { name: "Conferir e substituir esta escolha", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "A alteração foi conferida." })).toBeVisible();
  expect(api.commands("onboarding.amend")[0]!.command.input).toMatchObject({ expectedRevision: "10", change: { kind: "replace", value: { kind: "profile", patch: { displayName: "Proposta local preservada" }, expectedProfileRevision: "profile:2" } } });
  expect(api.snapshot.round!.receipts[0]!.intentId).not.toBe(original.intentId); expect(api.snapshot.recovery[0]!.intentId).toBe(api.snapshot.round!.receipts[0]!.intentId);
  await expect(editor.getByLabel("Nome proposto", { exact: true })).toHaveCount(0);
  await editor.getByRole("button", { name: "Revisar esta escolha", exact: true }).click(); await expect(editor.getByLabel("Nome proposto", { exact: true })).toHaveValue("Proposta local preservada"); expect(api.trace.effects).toEqual([]); expect(api.trace.unexpected).toEqual([]); expect(api.trace.errors).toEqual([]);
});

for (const phase of ["read", "write"] as const) {
  test(`troca de owner durante ${phase} não revela nem aplica a resposta anterior`, async ({ page }) => {
    const api = await attachOnboardingApi(page, "light"); let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    if (phase === "read") api.trace.holdRead = held;
    await page.goto(onboardingOrigin + "/onboarding"); await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: bundle }); await page.evaluate(actor => (globalThis as unknown as { __startOnboarding(ownerId: string): void }).__startOnboarding(actor), onboardingOwner);
    if (phase === "read") await expect.poll(() => api.trace.reads).toBeGreaterThan(0);
    else { await title(page, titles[0]!); await start(page); await page.getByLabel("Seu nome", { exact: true }).fill("Nome da conta anterior"); api.trace.holdCommand = { command: "onboarding.save", wait: held }; await page.getByRole("button", { name: "Continuar", exact: true }).click(); await expect.poll(() => api.commands("onboarding.save").length).toBeGreaterThan(0); }
    api.trace.holdRead = null; api.trace.holdCommand = null; api.snapshot = emptyOnboardingSnapshot(onboardingOtherOwner);
    await page.evaluate(actor => (globalThis as unknown as { __startOnboarding(ownerId: string): void }).__startOnboarding(actor), onboardingOtherOwner); await title(page, titles[0]!);
    const beforeRelease = api.trace.replies; release(); await expect.poll(() => api.trace.replies).toBeGreaterThan(beforeRelease);
    await expect(page.getByText("Nome da conta anterior", { exact: true })).toHaveCount(0); await expect(page.getByRole("button", { name: "Começar", exact: true })).toBeEnabled(); await start(page); await expect(page.getByLabel("Seu nome", { exact: true })).toHaveValue("");
    expect(api.trace.unexpected).toEqual([]); expect(api.trace.errors).toEqual([]);
  });
}

test("OAuth simulado conserva rodada, retoma calendário e respeita duas contas somente leitura", async ({ page }) => {
  const api = await attachOnboardingApi(page, "light"); await mount(page); await start(page); await next(page, titles[2]!); const round = api.snapshot.round!.id;
  await page.getByRole("button", { name: "Conectar Google Calendar", exact: true }).click(); await expect(page.getByRole("heading", { name: "Provedor simulado, sem conexão real" })).toBeVisible(); expect(api.trace.oauthNavigations).toBe(1);
  api.snapshot.calendar = { status: "ready", canConnect: false, accounts: [{ id: "72000000-0000-4000-8000-000000000031", email: "conta1@example.test", status: "connected" }, { id: "72000000-0000-4000-8000-000000000032", email: "conta2@example.test", status: "connected" }], sources: [{ id: "72000000-0000-4000-8000-000000000033", accountId: "72000000-0000-4000-8000-000000000031", name: "Agenda de exemplo", selected: false }] };
  await mount(page); await title(page, titles[2]!); expect(api.snapshot.round!.id).toBe(round); await expect(page.getByText("Duas contas conectadas.", { exact: false })).toBeVisible(); await expect(page.getByRole("button", { name: "Conectar outra conta", exact: true })).toHaveCount(0);
  await page.getByText("Escolher calendários", { exact: true }).click(); await page.getByRole("checkbox", { name: /Agenda de exemplo/ }).click(); await expect(page.getByRole("checkbox", { name: /Agenda de exemplo/ })).toHaveAttribute("aria-checked", "true");
  expect(api.trace.calendarSelections).toHaveLength(1); expect(api.trace.effects).toEqual([]); expect(api.trace.unexpected).toEqual([]); expect(api.trace.errors).toEqual([]);
});

test("recusa OAuth preserva o rascunho e permite conferir e seguir sem conectar", async ({ page }) => {
  const api = await attachOnboardingApi(page, "dark", emptyOnboardingSnapshot(), { oauth: "refuse" }); await mount(page); await start(page); await page.getByLabel("Seu nome", { exact: true }).fill("Nome preservado"); await next(page, titles[2]!);
  await page.getByRole("button", { name: "Conectar Google Calendar", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("Este percurso está indisponível"); expect(api.trace.oauthNavigations).toBe(0);
  await page.getByRole("button", { name: "Conferir estado salvo", exact: true }).click(); await next(page, titles[3]!); expect(api.snapshot.round!.draft!.profile.displayName).toBe("Nome preservado"); expect(api.trace.effects).toEqual([]); expect(api.trace.unexpected).toEqual([]);
});

test("troca de tema usa a preferência existente, com pedido explícito separado do domínio", async ({ page }) => {
  const api = await attachOnboardingApi(page, "light"); await mount(page); await page.getByLabel("Tema", { exact: true }).selectOption("dark"); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => api.trace.themeWrites.length).toBe(1); expect(api.trace.themeWrites[0]).toMatchObject({ command: "settings.preferences.update", input: { patch: { theme: "dark" } } }); expect(api.trace.commands).toEqual([]); expect(api.trace.effects).toEqual([]); expect(api.trace.unexpected).toEqual([]);
});
