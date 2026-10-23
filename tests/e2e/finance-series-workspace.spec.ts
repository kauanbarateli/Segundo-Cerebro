/** Synthetic browser acceptance of the real series panel, drawers, HTTP client
 * and durable Web Lock journal. The provider and closed HTTP API are fixtures.
 * These tests do not certify Auth, SQL/RLS, RPC activation or hosted durability. */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { buildFinanceSeriesBrowser } from "./helpers/finance-series-browser";
import { attachFinanceSeriesApi, createFinanceSeriesScenario, financeSeriesOrigin, financeSeriesOtherOwner, financeSeriesOwner } from "./helpers/finance-series-api";
import type { FinanceSeriesFixturePayload } from "./fixtures/finance-series-browser";
import { describeVisualFailures, inspectVisualGuards } from "./helpers/visual-guards";

let bundle: string, styles: string;
type Scenario = ReturnType<typeof createFinanceSeriesScenario>;
interface BrowserControls {
  __startFinanceSeries(payload: FinanceSeriesFixturePayload): void;
  __changeFinanceSeriesOwner(payload: FinanceSeriesFixturePayload): void;
  __logoutFinanceSeries(ownerId: string): void;
  __unmountFinanceSeries(): void;
}
test.beforeAll(async () => { const output = await buildFinanceSeriesBrowser(); bundle = output.code; styles = output.css; });
async function mount(page: Page, api: Scenario, navigate = true, pendingWhenUnavailable = false) {
  if (navigate) await page.goto(financeSeriesOrigin + "/financeiro");
  await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: bundle });
  await page.evaluate(payload => (globalThis as unknown as BrowserControls).__startFinanceSeries(payload), { ownerId: financeSeriesOwner, data: api.financeData });
  await expect(page.getByRole("heading", { name: "Financeiro sintético", exact: true })).toBeVisible();
  if (api.available) await expect(page.getByRole("button", { name: "Atualizar séries", exact: true })).toBeVisible();
  else if ((await pendingBodies(page)).length) await expect(page.getByRole("button", { name: "Conferir disponibilidade", exact: true })).toBeVisible();
  else if (pendingWhenUnavailable) await expect(page.getByText("Confirmação pendente", { exact: true })).toBeVisible();
  else await expect(page.locator(".series-panel")).toHaveCount(0);
  expect(await page.evaluate(() => window.isSecureContext && typeof navigator.locks?.request === "function")).toBe(true);
  await page.evaluate(() => document.fonts.ready);
}
async function pendingBodies(page: Page, ownerId = financeSeriesOwner) {
  return page.evaluate(owner => Object.keys(localStorage).filter(key => key.startsWith(`segundo-cerebro:finance-series:v2:${owner}:pending:`)).sort().map(key => localStorage.getItem(key)!), ownerId);
}
function assertClosed(api: Scenario) {
  expect(api.trace.violations).toEqual([]); expect(api.trace.errors).toEqual([]);
  for (const request of api.trace.requests.filter(item => item.kind !== "navigation")) {
    expect(new URL(request.url).origin).toBe(financeSeriesOrigin); expect(request.path).not.toMatch(/\/rpc\b|\/rest\/v1\b/);
    expect(request.expectedOwner).toBe(request.authenticatedOwner);
  }
}
async function visual(page: Page) {
  const report = await inspectVisualGuards(page);
  for (const gate of ["overflow", "targets", "fields"] as const) expect(report[gate], describeVisualFailures(report, gate)).toEqual([]);
  expect(report.inspectedTargets).toBeGreaterThan(0);
}
async function createForm(page: Page, options: { description?: string; installment?: boolean } = {}) {
  await page.getByRole("button", { name: "Nova série", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Nova série", exact: true });
  await expect(drawer).toBeVisible(); await drawer.getByLabel("Descrição", { exact: true }).fill(options.description ?? "Previsão do navegador");
  if (options.installment) await drawer.getByLabel("Tipo de série", { exact: true }).selectOption("parcelamento");
  await drawer.getByLabel(options.installment ? "Valor total original (R$)" : "Valor de cada ocorrência (R$)", { exact: true }).fill(options.installment ? "100,01" : "100,00");
  await drawer.getByLabel("Conta", { exact: true }).selectOption({ label: "Conta sintética" });
  await drawer.getByLabel("Total de posições", { exact: true }).fill(options.installment ? "3" : "2");
  await drawer.getByLabel("Primeira posição a registrar", { exact: true }).fill(options.installment ? "2" : "1");
  return drawer;
}
async function prepare(drawer: Locator) {
  await drawer.getByRole("button", { name: "Revisar antes de salvar", exact: true }).click();
  await expect(drawer.getByRole("heading", { name: "Prévia da operação", exact: true })).toBeVisible();
}
async function confirm(drawer: Locator) {
  const commit = drawer.getByRole("button", { name: "Confirmar operação", exact: true });
  await expect(commit).toBeDisabled(); await drawer.getByRole("checkbox", { name: "Conferi as datas, os valores e o efeito desta operação.", exact: true }).click();
  await expect(commit).toBeEnabled(); await commit.click();
}
async function manage(page: Page) {
  await page.getByRole("button", { name: "Gerenciar Previsão sintética", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Previsão sintética", exact: true }); await expect(drawer).toBeVisible(); return drawer;
}
async function confirmed(page: Page) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Operação confirmada:" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nova série", exact: true })).toBeEnabled();
}

for (const width of [320, 390]) for (const theme of ["light", "dark"] as const) {
  test(`parcelamento a partir da posição atual, resto, teclado e DS ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const api = await attachFinanceSeriesApi(page, theme); await mount(page, api); await visual(page);
    expect(api.trace.requests.filter(item => item.kind !== "navigation").slice(0, 2).map(item => item.kind)).toEqual(["availability", "page"]);
    const drawer = await createForm(page, { installment: true, description: "Parcelas do navegador" });
    await expect(drawer.getByLabel("Descrição", { exact: true })).toHaveValue("Parcelas do navegador"); await visual(page);
    await drawer.getByRole("button", { name: "Revisar antes de salvar", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(drawer.getByRole("heading", { name: "Prévia da operação", exact: true })).toBeFocused();
    await expect(drawer.getByText("2 de 3", { exact: false })).toBeVisible();
    const planned = drawer.getByRole("list", { name: "Novos lançamentos previstos" }); await expect(planned.locator("li")).toHaveCount(2);
    await expect(planned.locator(".finance-money")).toHaveText([/33,33/, /33,35/]);
    await expect(drawer.getByRole("button", { name: "Confirmar operação", exact: true })).toBeDisabled();
    const checkbox = drawer.getByRole("checkbox"); await checkbox.focus(); await page.keyboard.press("Space"); await expect(checkbox).toHaveAttribute("aria-checked", "true");
    await visual(page); await page.screenshot({ path: info.outputPath(`finance-series-review-${width}-${theme}.png`), fullPage: true });
    await drawer.getByRole("button", { name: "Confirmar operação", exact: true }).focus(); await page.keyboard.press("Enter"); await confirmed(page);
    expect(api.store.state.transactions.map(row => [row.installment_no, row.amount_cents, row.paid_cents, row.status])).toEqual([[2, 3333, 0, "planned"], [3, 3335, 0, "planned"]]);
    expect(api.store.state.occurrences.map(row => row.index)).toEqual([2, 3]); expect(api.commands()).toHaveLength(1); expect(api.store.state.receipts).toHaveLength(1);
    await page.getByRole("button", { name: "Ocultar valores", exact: true }).click();
    await expect(page.locator(".series-panel .finance-money")).not.toContainText(/100,01|33,33|33,35/);
    expect(await page.locator(".series-panel").evaluate(element => element.innerHTML)).not.toMatch(/100,01|33,33|33,35/);
    assertClosed(api);
  });
}

test("disponibilidade desligada não abre UI de escrita nem tenta RPC/esquema", async ({ page }) => {
  const scenario = createFinanceSeriesScenario(); scenario.setAvailable(false); const api = await attachFinanceSeriesApi(page, "light", scenario); await mount(page, api);
  await expect(page.getByRole("button", { name: "Nova série", exact: true })).toHaveCount(0); expect(api.commands()).toEqual([]);
  expect(api.trace.requests.filter(item => item.kind !== "navigation").map(item => item.kind)).toEqual(["availability"]); assertClosed(api);
});

test("editar futuras mostra 100→200 e exige reconferir CAS financeiro e da série antes do aceite", async ({ page }) => {
  const scenario = createFinanceSeriesScenario(); await scenario.seed("common"); const api = await attachFinanceSeriesApi(page, "light", scenario); await mount(page, api);
  const old = structuredClone(api.store.state.transactions), detail = await manage(page); await detail.getByRole("button", { name: "Editar próximas", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Editar próximas ocorrências", exact: true }); await drawer.getByLabel("Valor de cada ocorrência (R$)", { exact: true }).fill("200,00");
  await api.pauseExternally(); await prepare(drawer);
  await expect(drawer.getByText("Os dados mudaram desde a abertura.", { exact: false })).toBeVisible(); await expect(drawer.getByRole("button", { name: "Confirmar operação", exact: true })).toHaveCount(0);
  const change = drawer.locator("details[open] li").first(); await expect(change.locator(".finance-money")).toHaveText([/100,00/, /200,00/]);
  expect(api.commands()).toHaveLength(0); const firstPreview = api.trace.previews[0]!;
  expect(firstPreview.command.input.expected_finance_revision).not.toBe(api.store.state.revision);
  expect(firstPreview.command.command).toBe("finance.recurring.update_future");
  if (firstPreview.command.command !== "finance.recurring.update_future") throw new Error("WRONG_PREVIEW_COMMAND");
  expect(firstPreview.command.input.expected_revision).not.toBe(api.store.state.series[0]!.revision);
  await drawer.getByRole("button", { name: "Revisei os dados; atualizar prévia", exact: true }).click(); await expect(drawer.getByRole("button", { name: "Confirmar operação", exact: true })).toBeDisabled();
  const expectedRevision = api.store.state.revision, expectedSeriesRevision = api.store.state.series[0]!.revision;
  expect(api.trace.previews[1]!.clientId).toBe(firstPreview.clientId); await confirm(drawer); await confirmed(page);
  expect(api.commands()).toHaveLength(1); expect(api.commands()[0]!.command.input.expected_finance_revision).toBe(expectedRevision);
  const committed = api.commands()[0]!.command; if (committed.command !== "finance.recurring.update_future") throw new Error("WRONG_COMMITTED_COMMAND");
  expect(committed.input.expected_revision).toBe(expectedSeriesRevision); expect(committed.input.client_id).toBe(firstPreview.clientId);
  expect(api.store.state.transactions.map(row => row.amount_cents)).toEqual(old.map(() => 20000)); expect(api.store.state.transactions.map(row => row.id)).toEqual(old.map(row => row.id));
  expect(api.store.state.transactions.map(row => row.occurred_on)).toEqual(old.map(row => row.occurred_on)); assertClosed(api);
});

test("conta comum registra parcial e depois total na mesma ocorrência", async ({ page }) => {
  const scenario = createFinanceSeriesScenario(); await scenario.seed("common"); const api = await attachFinanceSeriesApi(page, "dark", scenario); await mount(page, api);
  const id = api.store.state.transactions[0]!.id, count = api.store.state.transactions.length;
  for (const total of [false, true]) {
    const detail = await manage(page); await detail.getByRole("button", { name: "Registrar realização da posição 1", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Registrar realização", exact: true });
    if (total) await drawer.getByRole("button", { name: "Preencher o valor total", exact: true }).click(); else await drawer.getByLabel("Total realizado nesta ocorrência (R$)", { exact: true }).fill("40,00");
    await prepare(drawer); await expect(drawer.getByText("Total realizado escolhido:", { exact: false })).toContainText(total ? "100,00" : "40,00");
    if (!total) {
      await drawer.getByRole("button", { name: "Voltar aos dados", exact: true }).click();
      await expect(drawer.getByLabel("Total realizado nesta ocorrência (R$)", { exact: true })).toBeFocused();
      await expect(drawer.getByLabel("Total realizado nesta ocorrência (R$)", { exact: true })).toHaveValue("40,00"); await prepare(drawer);
    }
    await confirm(drawer); await confirmed(page);
    expect(api.store.state.transactions.find(row => row.id === id)).toMatchObject({ paid_cents: total ? 10000 : 4000, status: "confirmed" }); expect(api.store.state.transactions).toHaveLength(count);
  }
  expect(api.commands().map(item => item.command.command)).toEqual(["finance.recurring.occurrence.update", "finance.recurring.occurrence.update"]); assertClosed(api);
});

test("realizar compra do cartão conserva a fatura e não cria pagamento em conta comum", async ({ page }) => {
  const scenario = createFinanceSeriesScenario(); await scenario.seed("card"); const api = await attachFinanceSeriesApi(page, "light", scenario); await mount(page, api);
  const before = structuredClone(api.store.state.transactions), accounts = structuredClone(api.store.accounts), detail = await manage(page);
  await expect(detail.getByText("Realizar uma compra de cartão não paga sua fatura.", { exact: false })).toBeVisible(); await detail.getByRole("button", { name: "Registrar realização da posição 1", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Registrar realização", exact: true }); await expect(drawer.getByLabel("Total realizado nesta ocorrência (R$)", { exact: true })).toBeDisabled();
  await prepare(drawer); await expect(drawer.getByText("A fatura continuará sendo paga separadamente.", { exact: false })).toBeVisible(); await confirm(drawer); await confirmed(page);
  expect(api.store.state.transactions).toHaveLength(before.length); expect(api.store.state.transactions[0]).toMatchObject({ id: before[0]!.id, account_id: before[0]!.account_id, paid_cents: before[0]!.amount_cents, statement_month: before[0]!.statement_month, status: "confirmed", transfer_group_id: null });
  expect(api.store.accounts).toEqual(accounts); expect(api.commands()).toHaveLength(1); assertClosed(api);
});

test("retomar preserva exclusão manual e parcial e restaura além do horizonte de novas criações", async ({ page }) => {
  const scenario = createFinanceSeriesScenario(); await scenario.seed("paused"); const api = await attachFinanceSeriesApi(page, "dark", scenario); await mount(page, api);
  const before = structuredClone(api.store.state), detail = await manage(page); await detail.getByRole("button", { name: "Retomar série", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Retomar série", exact: true }); await drawer.getByLabel("Preparar até (não inclui esta data)", { exact: true }).fill("2026-11-01");
  await prepare(drawer); await expect(drawer.getByText(/Serão reativadas 4 ocorrências/)).toBeVisible(); await confirm(drawer); await confirmed(page);
  expect(api.store.state.series[0]!.state).toBe("active"); expect(api.store.state.transactions).toHaveLength(before.transactions.length);
  expect(api.store.state.occurrences.slice(0, 2)).toEqual(before.occurrences.slice(0, 2)); expect(api.store.state.transactions.slice(0, 2)).toEqual(before.transactions.slice(0, 2));
  expect(api.store.state.occurrences.slice(2).map(row => row.suppression)).toEqual(["none", "none", "none", "none"]);
  expect(api.store.state.transactions.map(row => [row.id, row.occurred_on])).toEqual(before.transactions.map(row => [row.id, row.occurred_on])); assertClosed(api);
});

test("resposta perdida e reload conservam corpo/UUID; off e 403 não liberam outra intenção", async ({ page }) => {
  const api = await attachFinanceSeriesApi(page, "light"); await mount(page, api); const drawer = await createForm(page); await prepare(drawer); api.loseNextWriteReply(); await confirm(drawer);
  await expect(page.getByText("Confirmação pendente", { exact: true }).first()).toBeVisible(); const original = await pendingBodies(page); expect(original).toHaveLength(1); expect(JSON.parse(original[0]!).status).toBe("unknown");
  const first = api.commands()[0]!, effects = structuredClone(api.store.state.events); expect(api.commands()).toHaveLength(1); expect(api.store.state.transactions).toHaveLength(2);
  await page.reload(); await mount(page, api, false); await expect(page.getByText("Confirmação pendente", { exact: true })).toBeVisible(); expect(api.commands()).toHaveLength(1); expect(await pendingBodies(page)).toEqual(original);
  await expect(page.getByRole("button", { name: "Nova série", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Ocultar valores", exact: true }).click();
  const originalDetails = page.locator(".series-recovery details"); await originalDetails.getByText("Conferir dados do envio original", { exact: true }).click();
  await expect(originalDetails.getByText("Previsão do navegador", { exact: true })).toBeVisible(); await expect(originalDetails.locator(".finance-money")).not.toContainText(/100,00/);
  expect(await originalDetails.evaluate(element => element.innerHTML)).not.toMatch(/100,00/); expect(await originalDetails.evaluate(element => element.innerHTML)).not.toContain(first.clientId);
  expect(await pendingBodies(page)).toEqual(original);
  api.setAvailable(false); await page.getByRole("button", { name: "Reenviar o mesmo conteúdo", exact: true }).click();
  await expect(page.getByText("O resultado ainda não foi confirmado.", { exact: false }).first()).toBeVisible(); expect(api.commands()).toHaveLength(1); expect(await pendingBodies(page)).toEqual(original);
  // A pending retry reports uncertain; only the fresh availability read on
  // reload can establish the disabled state without changing that outcome.
  await page.reload(); await mount(page, api, false, true);
  await expect(page.getByRole("button", { name: "Reenviar o mesmo conteúdo", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Consultar tentativa original", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Conferir disponibilidade", exact: true })).toBeEnabled(); expect(await pendingBodies(page)).toEqual(original); expect(api.commands()).toHaveLength(1);
  api.setAvailable(true); await page.getByRole("button", { name: "Conferir disponibilidade", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reenviar o mesmo conteúdo", exact: true })).toBeEnabled(); expect(await pendingBodies(page)).toEqual(original);
  api.rejectNextWrite("FORBIDDEN"); await page.getByRole("button", { name: "Reenviar o mesmo conteúdo", exact: true }).click(); await expect.poll(() => api.commands().length).toBe(2); await expect(page.getByRole("button", { name: "Reenviar o mesmo conteúdo", exact: true })).toBeEnabled();
  expect(api.commands()[1]!.body).toBe(first.body); expect(api.commands()[1]!.command.input.client_id).toBe(first.command.input.client_id); expect(await pendingBodies(page)).toEqual(original); expect(api.store.state.events).toEqual(effects);
  await page.getByRole("button", { name: "Consultar tentativa original", exact: true }).click(); await expect.poll(() => pendingBodies(page)).toEqual([]); await expect(page.getByRole("button", { name: "Nova série", exact: true })).toBeVisible();
  expect(api.commands()).toHaveLength(2); expect(api.store.state.events).toEqual(effects); expect(api.store.state.receipts).toHaveLength(1); assertClosed(api);
});

test("SESSION_CHANGED fechado remove corpo e bloqueia novos envios no serviço antigo", async ({ page }) => {
  const api = await attachFinanceSeriesApi(page, "light"); await mount(page, api); const drawer = await createForm(page); await prepare(drawer); api.rejectNextWrite("SESSION_CHANGED"); await confirm(drawer);
  await expect(page.getByRole("alert").filter({ hasText: "A sessão mudou" }).first()).toBeVisible(); expect(await pendingBodies(page)).toEqual([]); expect(api.store.state.transactions).toEqual([]);
  await expect(page.getByRole("button", { name: "Nova série", exact: true })).toHaveCount(0); expect(api.commands()).toHaveLength(1); assertClosed(api);
});

for (const resolution of ["success", "error"] as const) {
  test(`troca confirmada de dono cerca resposta antiga ${resolution} sem publicar dados A em B`, async ({ page }) => {
    const api = await attachFinanceSeriesApi(page, "light"); await mount(page, api); const drawer = await createForm(page, { description: "Conteúdo exclusivo do dono A" }); await prepare(drawer);
    const held = api.deferNextWriteReply(); await confirm(drawer); await held.reached; expect(await pendingBodies(page)).toHaveLength(1);
    await api.setSessionOwner(financeSeriesOtherOwner);
    const data = structuredClone(api.financeData); for (const rows of [data.accounts, data.categories, data.tags ?? [], data.transactions]) for (const row of rows) row.user_id = financeSeriesOtherOwner;
    data.transactions = [];
    await page.evaluate(payload => (globalThis as unknown as BrowserControls).__changeFinanceSeriesOwner(payload), { ownerId: financeSeriesOtherOwner, data });
    if (resolution === "success") held.releaseSuccess(); else held.releaseError("UNAVAILABLE"); await held.settled;
    await expect(page.getByRole("button", { name: "Nova série", exact: true })).toBeVisible(); await expect(page.getByText("Nenhuma série gerida ainda.", { exact: false })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Conteúdo exclusivo do dono A"); await expect(page.getByText("Operação confirmada:", { exact: false })).toHaveCount(0);
    expect(await pendingBodies(page, financeSeriesOwner)).toEqual([]); expect(await pendingBodies(page, financeSeriesOtherOwner)).toEqual([]); expect(api.commands()).toHaveLength(1); assertClosed(api);
  });
}

test("unmount comum não apaga a intenção; remontar não faz replay automático", async ({ page }) => {
  const api = await attachFinanceSeriesApi(page, "dark"); await mount(page, api); const drawer = await createForm(page); await prepare(drawer); const held = api.deferNextWriteReply(); await confirm(drawer); await held.reached;
  const original = await pendingBodies(page); await page.evaluate(() => (globalThis as unknown as BrowserControls).__unmountFinanceSeries()); held.releaseSuccess(); await held.settled;
  await page.evaluate(payload => (globalThis as unknown as BrowserControls).__startFinanceSeries(payload), { ownerId: financeSeriesOwner, data: api.financeData });
  await expect(page.getByText("Confirmação pendente", { exact: true })).toBeVisible(); expect(await pendingBodies(page)).toEqual(original); expect(api.commands()).toHaveLength(1); assertClosed(api);
});

test("logout explícito redige o corpo; reentrada exige carregar dados atuais e reconferir", async ({ page }) => {
  const api = await attachFinanceSeriesApi(page, "light"); await mount(page, api); const drawer = await createForm(page, { description: "Corpo privado antes de sair" }); await prepare(drawer);
  const held = api.deferNextWriteReply(); await confirm(drawer); await held.reached; expect(await pendingBodies(page)).toHaveLength(1);
  await page.evaluate(owner => (globalThis as unknown as BrowserControls).__logoutFinanceSeries(owner), financeSeriesOwner);
  await expect(page.getByRole("status").filter({ hasText: "Sessão sintética encerrada" })).toBeVisible();
  held.releaseSuccess(); await held.settled; expect(await pendingBodies(page)).toEqual([]); await expect(page.locator("body")).not.toContainText("Corpo privado antes de sair");
  await page.evaluate(payload => (globalThis as unknown as BrowserControls).__changeFinanceSeriesOwner(payload), { ownerId: financeSeriesOwner, data: api.financeData });
  await expect(page.getByText("Confira seus dados antes de continuar", { exact: true })).toBeVisible();
  const acknowledge = page.getByRole("button", { name: "Conferi os dados atuais", exact: true }); await expect(acknowledge).toBeDisabled();
  await expect(page.getByRole("button", { name: "Nova série", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Carregar dados atuais", exact: true }).click(); await expect(acknowledge).toBeEnabled(); await acknowledge.click();
  await expect(page.getByRole("button", { name: "Nova série", exact: true })).toBeVisible(); expect(api.commands()).toHaveLength(1); expect(api.store.state.transactions).toHaveLength(2); assertClosed(api);
});
