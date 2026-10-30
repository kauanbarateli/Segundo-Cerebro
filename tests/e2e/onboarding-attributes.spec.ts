/** Synthetic HTTP presentation tests. Original React consumers/port, no Auth,
 * SDK, SQL, real accounts or hosted acceptance. No retries hide a failed case. */
import { expect, test, type Page } from "@playwright/test";
import { buildAttributesBrowser } from "./helpers/onboarding-attributes-browser";
import { describeVisualFailures, inspectVisualGuards } from "./helpers/visual-guards";
import { contrastRatio } from "../../design-system/validate.mjs";
import type { PersonalFocus, ProjectContext } from "../../src/lib/onboarding-attributes-client";

const origin = "https://attributes.test", owner = "69000000-0000-4000-8000-000000000001", projectId = "69000000-0000-4000-8000-000000000002";
let bundle: string, styles: string;
test.describe.configure({ retries: 0 });
test.use({ trace: "off", video: "off" });
test.beforeAll(async () => { const built = await buildAttributesBrowser(); bundle = built.code; styles = built.css; });
async function attach(page: Page, theme: "light" | "dark", mode: "normal" | "uncertain" | "session" = "normal") {
  const state = { profile: { displayName: "Pessoa de exemplo", focus: "work" as PersonalFocus | null, revision: "profile:1" }, project: { projectId, context: null as ProjectContext | null, revision: "project:1" } };
  const trace = { reads: 0, writes: [] as string[], effects: 0, unexpected: [] as string[], errors: [] as string[], activeOwner: owner,
    denial: null as { status: number; code: string } | null, holdRead: null as Promise<void> | null, holdWrite: null as Promise<void> | null, replies: 0 };
  const receipts = new Map<string, { body: string; result: unknown }>();
  page.on("pageerror", error => trace.errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    const json = async (body: unknown, status = 200) => { await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }); trace.replies++; };
    if (url.origin !== origin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    if (request.isNavigationRequest() && request.method() === "GET" && url.pathname === "/attributes") {
      await route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preferências opcionais</title></head><body><div id="attributes-root"></div></body></html>` }); return;
    }
    if (url.pathname !== "/api/onboarding/attributes" || request.headers()["x-expected-user-id"] !== trace.activeOwner) { trace.unexpected.push("UNDECLARED_REQUEST"); await route.abort(); return; }
    if (request.method() === "GET") {
      trace.reads++;
      const result = url.search === "?kind=profile" ? { ...state.profile } : url.search === "?kind=project&id=" + state.project.projectId ? { ...state.project } : null;
      if (!result) { trace.unexpected.push("UNDECLARED_QUERY"); await route.abort(); return; }
      await trace.holdRead; await json({ ok: true, result });
      return;
    }
    if (request.method() !== "PATCH" || url.search) { trace.unexpected.push("UNDECLARED_METHOD"); await route.abort(); return; }
    const body = request.postData()!, command = JSON.parse(body) as { kind: "profile" | "project"; projectId?: string; clientId: string; expectedRevision: string; patch?: { focus: PersonalFocus | null }; context?: ProjectContext | null };
    expect(request.headers()["content-type"]).toBe("application/json"); expect(request.headers().origin).toBe(origin); trace.writes.push(body);
    if (mode === "session") { await json({ ok: false, code: "SESSION_CHANGED", message: "A conta mudou." }, 409); return; }
    // Guards may refuse a retry before looking up a committed receipt. This
    // cannot retroactively establish the outcome of an earlier lost reply.
    if (trace.denial) { await json({ ok: false, code: trace.denial.code, message: "O envio atual foi recusado." }, trace.denial.status); return; }
    const receipt = receipts.get(command.clientId);
    if (receipt) { expect(body).toBe(receipt.body); await json({ ok: true, result: receipt.result }); return; }
    const current = command.kind === "profile" ? state.profile : state.project;
    if (command.expectedRevision !== current.revision) { await json({ ok: false, code: "CONFLICT", message: "Versão mudou." }, 409); return; }
    if (command.kind === "profile") { state.profile.focus = command.patch!.focus; state.profile.revision = "profile:" + (trace.effects + 2); }
    else { expect(command.projectId).toBe(state.project.projectId); state.project.context = command.context!; state.project.revision = "project:" + (trace.effects + 2); }
    trace.effects++; const result = { ...current }; receipts.set(command.clientId, { body, result });
    await trace.holdWrite;
    if (mode === "uncertain" && trace.writes.length === 1) await route.abort("failed");
    else await json({ ok: true, result });
  });
  return { state, trace };
}
async function mount(page: Page) {
  await page.goto(origin + "/attributes"); await page.addStyleTag({ content: styles }); await page.addScriptTag({ content: bundle });
  await page.evaluate(({ actor, project }) => (globalThis as unknown as { __startAttributes(userId: string, projectId: string): void }).__startAttributes(actor, project), { actor: owner, project: projectId });
  await expect(page.getByRole("heading", { name: "Foco pessoal" })).toBeVisible(); await page.evaluate(() => document.fonts.ready);
}
const profileSection = (page: Page) => page.getByRole("region", { name: "Perfil", exact: true });
const projectSection = (page: Page) => page.getByRole("region", { name: "Projeto", exact: true });

for (const width of [320, 390]) for (const theme of ["light", "dark"] as const) {
  test(`foco e contexto: consulta explícita, teclado, gravação e layout ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const { state, trace } = await attach(page, theme); await mount(page);
    expect(trace.reads).toBe(0); expect(trace.writes).toEqual([]);
    const focus = profileSection(page), context = projectSection(page), focusOpen = focus.getByRole("button", { name: "Consultar ou editar" });
    await focusOpen.focus(); await page.keyboard.press("Enter"); await expect(focus.getByLabel("Seu foco", { exact: true })).toHaveValue("work");
    await context.getByRole("button", { name: "Consultar ou editar" }).click(); await expect(context.getByLabel("Contexto", { exact: true })).toHaveValue("");
    await focus.getByLabel("Seu foco", { exact: true }).selectOption("mixed"); await focus.getByRole("button", { name: "Salvar escolha" }).click();
    await expect(focus.getByRole("status")).toHaveText("Seu foco foi salvo."); expect(state.profile.focus).toBe("mixed"); expect(state.profile.displayName).toBe("Pessoa de exemplo");
    await context.getByLabel("Contexto", { exact: true }).selectOption("study"); await context.getByRole("button", { name: "Salvar escolha" }).click();
    await expect(context.getByRole("status")).toHaveText("O contexto do projeto foi salvo."); expect(state.project.context).toBe("study");
    await context.getByLabel("Contexto", { exact: true }).selectOption(""); await context.getByRole("button", { name: "Salvar escolha" }).click();
    await expect(context.getByRole("status")).toHaveText("O contexto do projeto foi salvo."); expect(state.project.context).toBeNull();
    expect(trace.reads).toBe(2); expect(trace.effects).toBe(3);
    const report = await inspectVisualGuards(page);
    for (const gate of ["overflow", "targets", "fields"] as const) expect(report[gate], describeVisualFailures(report, gate)).toEqual([]);
    const pairs = await page.locator(".attribute-editor__heading p, .attribute-editor h3, .attribute-editor .field__label, .attribute-editor__current").evaluateAll(elements => elements.map(element => {
      const hex = (value: string) => "#" + (value.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map(part => Math.round(Number(part)).toString(16).padStart(2, "0")).join("");
      let ancestor: Element | null = element, background = "";
      while (ancestor) { background = getComputedStyle(ancestor).backgroundColor; if (background !== "rgba(0, 0, 0, 0)" && background !== "transparent") break; ancestor = ancestor.parentElement; }
      return { foreground: hex(getComputedStyle(element).color), background: hex(background) };
    }));
    for (const pair of pairs) expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: info.outputPath(`attributes-${width}-${theme}.png`), fullPage: true });
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  });
}
test("resultado incerto trava a escolha e repete corpo/clientId sem outro efeito", async ({ page }) => {
  const { trace } = await attach(page, "light", "uncertain"); await mount(page); const focus = profileSection(page);
  await focus.getByRole("button", { name: "Consultar ou editar" }).click(); await focus.getByLabel("Seu foco", { exact: true }).selectOption("personal");
  await focus.getByRole("button", { name: "Salvar escolha" }).click(); await expect(focus.getByRole("alert")).toContainText("não foi confirmado");
  await expect(focus.getByLabel("Seu foco", { exact: true })).toBeDisabled(); await expect(focus.getByRole("button", { name: "Recolher" })).toBeDisabled();
  await focus.getByRole("button", { name: "Tentar o mesmo envio" }).click(); await expect(focus.getByRole("status")).toHaveText("Seu foco foi salvo.");
  expect(trace.writes).toHaveLength(2); expect(trace.writes[1]).toBe(trace.writes[0]); expect(trace.effects).toBe(1); expect(trace.unexpected).toEqual([]);
});
for (const [status, code] of [[403, "FORBIDDEN"], [400, "VALIDATION"], [409, "CONFLICT"]] as const) {
  test(`envio incerto continua travado após retry ${status}/${code} e recupera o mesmo recibo`, async ({ page }) => {
    const { trace } = await attach(page, "light", "uncertain"); await mount(page); const focus = profileSection(page);
    await focus.getByRole("button", { name: "Consultar ou editar" }).click(); await focus.getByLabel("Seu foco", { exact: true }).selectOption("personal");
    await focus.getByRole("button", { name: "Salvar escolha" }).click(); await expect(focus.getByRole("alert")).toContainText("não foi confirmado");
    trace.denial = { status, code };
    await focus.getByRole("button", { name: "Tentar o mesmo envio" }).click(); await expect.poll(() => trace.writes.length).toBe(2);
    await expect(focus.getByRole("button", { name: "Tentar o mesmo envio" })).toBeEnabled();
    await expect(focus.getByLabel("Seu foco", { exact: true })).toBeDisabled(); await expect(focus.getByRole("button", { name: "Recolher" })).toBeDisabled();
    await expect(focus.getByRole("button", { name: "Recarregar valor atual" })).toHaveCount(0);
    expect(trace.effects).toBe(1); expect(new Set(trace.writes).size).toBe(1);
    trace.denial = null;
    await focus.getByRole("button", { name: "Tentar o mesmo envio" }).click(); await expect(focus.getByRole("status")).toHaveText("Seu foco foi salvo.");
    expect(trace.writes).toHaveLength(3); expect(new Set(trace.writes).size).toBe(1); expect(trace.effects).toBe(1);
    await expect(focus.getByLabel("Seu foco", { exact: true })).toBeEnabled(); expect(trace.unexpected).toEqual([]);
  });
}
test("conflito preserva rascunho e exige leitura e novo aceite manual", async ({ page }) => {
  const { state, trace } = await attach(page, "dark"); await mount(page); const focus = profileSection(page);
  await focus.getByRole("button", { name: "Consultar ou editar" }).click(); await expect(focus.getByLabel("Seu foco", { exact: true })).toHaveValue("work");
  await focus.getByLabel("Seu foco", { exact: true }).selectOption("mixed"); state.profile = { ...state.profile, focus: "study", revision: "profile:other-tab" };
  await focus.getByRole("button", { name: "Salvar escolha" }).click(); await expect(focus.getByRole("alert")).toContainText("outra tela");
  await expect(focus.getByLabel("Seu foco", { exact: true })).toHaveValue("mixed"); await expect(focus.getByRole("button", { name: "Salvar escolha" })).toBeDisabled();
  await focus.getByRole("button", { name: "Recarregar valor atual" }).click(); await expect(focus.getByRole("status")).toContainText("Sua escolha foi preservada");
  await expect(focus.locator(".attribute-editor__current")).toContainText("Estudos"); await expect(focus.getByLabel("Seu foco", { exact: true })).toHaveValue("mixed");
  expect(trace.writes).toHaveLength(1); await focus.getByRole("button", { name: "Salvar escolha" }).click(); await expect(focus.getByRole("status")).toHaveText("Seu foco foi salvo.");
  expect(JSON.parse(trace.writes[1]!)).toMatchObject({ expectedRevision: "profile:other-tab", patch: { focus: "mixed" } });
  expect(JSON.parse(trace.writes[1]!).clientId).not.toBe(JSON.parse(trace.writes[0]!).clientId); expect(trace.effects).toBe(1);
});
test("mudança de sessão apaga o snapshot e impede reenvio pela conta anterior", async ({ page }) => {
  const { trace } = await attach(page, "light", "session"); await mount(page); const focus = profileSection(page);
  await focus.getByRole("button", { name: "Consultar ou editar" }).click(); await focus.getByLabel("Seu foco", { exact: true }).selectOption("personal");
  await focus.getByRole("button", { name: "Salvar escolha" }).click(); await expect(focus.getByRole("alert")).toContainText("sessão mudou");
  await expect(focus.getByLabel("Seu foco", { exact: true })).toHaveCount(0); await expect(focus.locator(".attribute-editor__current")).toHaveCount(0);
  await expect(focus.getByRole("button", { name: "Recolher" })).toBeDisabled(); expect(trace.writes).toHaveLength(1); expect(trace.effects).toBe(0);
});
for (const phase of ["read", "write"] as const) {
  test(`troca de owner durante ${phase} ignora a resposta antiga e mantém a nova conta editável`, async ({ page }) => {
    const { state, trace } = await attach(page, "dark"); await mount(page); const focus = profileSection(page);
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    if (phase === "read") trace.holdRead = held; else trace.holdWrite = held;
    await focus.getByRole("button", { name: "Consultar ou editar" }).click();
    if (phase === "read") await expect(focus.getByText("Carregando…", { exact: true })).toBeVisible();
    else {
      await focus.getByLabel("Seu foco", { exact: true }).selectOption("personal"); await focus.getByRole("button", { name: "Salvar escolha" }).click();
      await expect.poll(() => trace.writes.length).toBe(1);
    }
    const nextOwner = "69000000-0000-4000-8000-000000000003", nextProject = "69000000-0000-4000-8000-000000000004";
    trace.activeOwner = nextOwner; trace.holdRead = null; trace.holdWrite = null;
    state.profile = { displayName: "Outra pessoa", focus: "study", revision: "profile:B" }; state.project = { projectId: nextProject, context: null, revision: "project:B" };
    await page.evaluate(({ actor, project }) => (globalThis as unknown as { __startAttributes(userId: string, projectId: string): void }).__startAttributes(actor, project), { actor: nextOwner, project: nextProject });
    await expect(focus.getByLabel("Seu foco", { exact: true })).toHaveCount(0);
    await focus.getByRole("button", { name: "Consultar ou editar" }).click(); await expect(focus.getByLabel("Seu foco", { exact: true })).toHaveValue("study");
    release(); await expect.poll(() => trace.replies).toBe(phase === "read" ? 2 : 3);
    await expect(focus.getByLabel("Seu foco", { exact: true })).toHaveValue("study"); await expect(focus.getByLabel("Seu foco", { exact: true })).toBeEnabled();
    await focus.getByLabel("Seu foco", { exact: true }).selectOption("mixed"); await expect(focus.getByRole("button", { name: "Salvar escolha" })).toBeEnabled();
    expect(trace.unexpected).toEqual([]); expect(trace.errors).toEqual([]);
  });
}
