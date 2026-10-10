/** B historical Memory / P historical connected UI+client with current SQL /
 * C current UI+client+SQL, same full fixture rows, font/browser/time/themes.
 * No source fallback, hosted Auth/SDK/RSC, screenshot golden update or
 * percentage threshold. Raw artifacts and every measured difference require
 * independent review before the original visual compound can be accepted.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { digest, buildVisualBundle, currentVisualRef, createVisualData, loadVisualProduct, visualBackendManifest, visualBrowserExecutable, measureVisualPort, compareVisualPort,
  VISUAL_NOW, VISUAL_ORIGIN, VISUAL_OWNER, type VisualBundle, type VisualTree, type VisualMeasurements } from "./helpers/issue22-visual-port";
import { inspectVisualGuards, describeVisualFailures } from "./helpers/visual-guards";
import type { DemoQueries, QueryState } from "../../src/lib/demo/types";
import type { VisualFixtureData } from "./fixtures/issue22-visual-port-browser";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ channel: "chromium" });
const trees = ["B", "P", "C"] as const;
const viewports = [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }] as const;
const themes = ["light", "dark"] as const, scenes = ["capture", "tasks", "drawer"] as const;
type Scene = typeof scenes[number];
type Fixture = Awaited<ReturnType<typeof createVisualData>>;
interface ApplicationInspection {
  userId: string; mode: string; today: string; tasks: QueryState<DemoQueries["tasks"]>; captures: QueryState<DemoQueries["captures"]>;
}
const declaredDifferences = [
  { source: "src/components/layout/workspace-shell.tsx", selectors: [".shell-demo-label", ".shell-status", ".shell-profile", ".shell-search"],
    reason: "B example-account copy becomes P/C persisted-account copy; later search is information-wide. Full Chrome remains visible." },
  { source: "src/components/features/capturar/capture-view.tsx", selectors: [".capture-mode", ".capture-location", ".capture-hint", ".capture-lifecycle", ".capture-library"],
    reason: "Session/account copy, early P image limitation and later C private-upload hint; early connected organize action is restricted. Library example affordance remains B-only." },
  { source: "src/components/features/tarefas/tasks-workspace.tsx", selectors: [".tasks-toolbar .tasks-note"],
    reason: "Example-day/session copy becomes actual civil-day/account copy; full records, dates and status stay common." },
  { source: "src/components/features/tarefas/task-editor.tsx", selectors: [".tasks-form", ".ui-dialog__footer"],
    reason: "P preserves status on update and uncertain sends; no write/uncertain state is exercised by these idle scenes." },
] as const;
const copyMatrix = {
  ".shell-demo-label": { B: "Conta conectada · dados de exemplo", P: "Conta conectada", C: "Conta conectada" },
  ".shell-status": { B: "Conta conectada · Os dados dos módulos são exemplos e não são salvos na sua conta.",
    P: "Capturar e Tarefas são salvos na sua conta. As demais áreas ainda usam exemplos.", C: "Seus registros são salvos na sua conta." },
  ".capture-mode small": { B: "Demonstração · notas na sessão", P: "Notas salvas na sua conta", C: "Notas salvas na sua conta" },
  ".capture-location [role=status]": { B: "Salva nesta sessão", P: "Salva na sua conta", C: "Salva na sua conta" },
  ".tasks-toolbar > div > .tasks-note": { B: "Dia de exemplo: 23/09/2026. Alterações valem nesta sessão.",
    P: "Hoje: 23/09/2026. Tarefas salvas na sua conta.", C: "Hoje: 23/09/2026. Tarefas salvas na sua conta." },
} as const;
let current: string, bundles: Record<VisualTree, VisualBundle>;
test.beforeAll(async () => {
  if (process.platform !== "linux") throw new Error("VISUAL_BROWSER_EXECUTION_REQUIRES_LINUX");
  current = currentVisualRef();
  // Dependent builds run sequentially: each owns its strict ref inventory.
  bundles = { B: await buildVisualBundle("B", current), P: await buildVisualBundle("P", current), C: await buildVisualBundle("C", current) };
  expect(bundles.B.manifest.fontSha256).toBe(bundles.P.manifest.fontSha256);
  expect(bundles.B.manifest.fontSha256).toBe(bundles.C.manifest.fontSha256);
  expect(bundles.B.manifest.versions).toEqual(bundles.C.manifest.versions);
});
async function attach(context: BrowserContext, fixture: Fixture, tree: VisualTree) {
  const trace = { queries: [] as ("tasks" | "captures")[], unexpected: [] as string[], pageErrors: [] as string[] };
  context.on("page", page => page.on("pageerror", error => trace.pageErrors.push(error.message)));
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== VISUAL_ORIGIN) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    if (url.pathname === "/api/capture-tasks") {
      const query = url.searchParams.get("query");
      if (tree === "B" || request.method() !== "GET" || url.searchParams.size !== 1 || !["tasks", "captures"].includes(query ?? "")
        || request.headers()["x-expected-user-id"] !== VISUAL_OWNER) { trace.unexpected.push("UNBOUND_QUERY"); await route.abort(); return; }
      const key = query as "tasks" | "captures";
      const { snapshot, projectsVisible } = await fixture.gateway(key === "tasks" ? "read.tasks" : "read.captures").presentation();
      expect(projectsVisible).toBe(true);
      const dto = { items: key === "tasks" ? snapshot.tasks : snapshot.captures, categories: snapshot.categories,
        projects: snapshot.projects.filter(project => !project.deleted_at),
        ...(key === "captures" && snapshot.readonlyCaptureIds !== undefined ? { readonlyCaptureIds: snapshot.readonlyCaptureIds } : {}) };
      // Independent table queries, not the snapshot producer, are the DTO oracle.
      const independent = (await fixture.independent())[key];
      expect(dto.items).toEqual(independent.items); expect(dto.categories).toEqual(independent.categories); expect(dto.projects).toEqual(independent.projects);
      if ("readonlyCaptureIds" in dto) expect(dto.readonlyCaptureIds).toEqual([]);
      trace.queries.push(key);
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "Cache-Control": "private, no-store" }, body: JSON.stringify(dto) }); return;
    }
    if (request.isNavigationRequest() && request.method() === "GET" && ["/capturar", "/tarefas"].includes(url.pathname)
      && [...url.searchParams.keys()].every(key => key === "capture")) {
      await route.fulfill({ status: 200, contentType: "text/html", body: '<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color"></head><body><div id="issue22-visual-root"></div></body></html>' }); return;
    }
    trace.unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  return trace;
}
async function inspectApplication(page: Page) {
  return page.evaluate(async () => {
    const fixture = globalThis as unknown as { __loadIssue22VisualQueries(): Promise<void>; __inspectIssue22Visual(): ApplicationInspection };
    await fixture.__loadIssue22VisualQueries();
    return fixture.__inspectIssue22Visual();
  });
}
async function start(page: Page, fixture: Fixture, tree: VisualTree, scene: Scene, theme: typeof themes[number]) {
  await page.clock.setFixedTime(new Date(VISUAL_NOW));
  await page.goto(VISUAL_ORIGIN + (scene === "capture" ? "/capturar?capture=" + fixture.selectedNote.id : "/tarefas"));
  await page.evaluate(theme => { localStorage.setItem("segundo-cerebro-theme", theme); localStorage.setItem("segundo-cerebro:demo:values-hidden:v1", "0");
    document.documentElement.setAttribute("data-theme", theme); document.documentElement.style.colorScheme = theme; }, theme);
  await page.addStyleTag({ content: bundles[tree].css }); await page.addScriptTag({ content: bundles[tree].code });
  await page.evaluate(data => (globalThis as unknown as { __startIssue22Visual(data: VisualFixtureData): void }).__startIssue22Visual(data),
    { userId: VISUAL_OWNER, now: VISUAL_NOW, initial: fixture.data.initial, connected: tree !== "B" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { level: 1, name: scene === "capture" ? "Capturar" : "Tarefas", exact: true })).toBeVisible();
  const actual = await inspectApplication(page);
  expect(actual.userId).toBe(VISUAL_OWNER); expect(actual.today).toBe("2026-09-23"); expect(actual.mode).toBe(tree === "B" ? "demo" : "connected");
  for (const key of ["tasks", "captures"] as const) {
    expect(actual[key].status).toBe("ready"); expect(actual[key].error).toBeNull();
    const data = actual[key].data!; expect(Object.keys(data).sort()).toEqual(["categories", "items", "projects", ...("readonlyCaptureIds" in data ? ["readonlyCaptureIds"] : [])].sort());
    expect(data.items).toEqual(fixture.data[key].items); expect(data.categories).toEqual(fixture.data[key].categories); expect(data.projects).toEqual(fixture.data[key].projects);
    if ("readonlyCaptureIds" in data) expect(data.readonlyCaptureIds).toEqual([]);
  }
  await page.evaluate(async () => { await document.fonts.load("16px Issue22VisualGeist"); await document.fonts.ready; });
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  for (const [selector, values] of Object.entries(copyMatrix)) if (!selector.startsWith(".capture-") && !selector.startsWith(".tasks-")) {
    await expect(page.locator(selector)).toHaveText(values[tree]);
  }
  await expect(page.locator(".shell-search")).toHaveAttribute("aria-label", tree === "C" ? "Buscar informações" : "Buscar módulos");
  await expect(page.locator(".shell-rail-footer a[aria-label='Atividade']")).toHaveCount(tree === "C" ? 1 : 0);
  if (scene === "capture") {
    await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue(fixture.selectedNote.title!);
    await expect(page.getByLabel("Sua anotação", { exact: true })).toHaveValue(fixture.selectedNote.content!);
    await expect(page.getByRole("navigation", { name: "Notas salvas", exact: true }).getByRole("button")).toHaveCount(6);
    const expectedTitles = fixture.data.captures.items.filter(note => !note.deleted_at && note.status !== "archived")
      .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at) || a.id.localeCompare(b.id)).map(note => note.title);
    expect(await page.locator(".capture-row strong").allTextContents()).toEqual(expectedTitles);
    await expect(page.locator(".capture-row[aria-current='true'] strong")).toHaveText(fixture.selectedNote.title!);
    await expect(page.locator(".capture-mode small")).toHaveText(copyMatrix[".capture-mode small"][tree]);
    await expect(page.locator(".capture-location [role=status]")).toHaveText(copyMatrix[".capture-location [role=status]"][tree]);
    await page.getByLabel("Sua anotação", { exact: true }).focus();
  } else {
    await expect(page.getByLabel("Mostrar tarefas", { exact: true })).toHaveValue("active");
    await expect(page.locator(".tasks-summary")).toHaveText("5 abertas · 1 atrasada · 2 concluídas");
    await expect(page.locator(".tasks-toolbar > div > .tasks-note")).toHaveText(copyMatrix[".tasks-toolbar > div > .tasks-note"][tree]);
    for (const task of fixture.data.tasks.items.filter(task => !task.deleted_at && !["done", "archived"].includes(task.status))) {
      await expect(page.getByRole("button", { name: task.title, exact: true })).toBeVisible();
    }
    const originTask = fixture.data.tasks.items.find(task => task.origin_capture_id)!;
    await expect(page.getByRole("link", { name: "Abrir origem", exact: true })).toHaveAttribute("href", "/capturar?capture=" + originTask.origin_capture_id);
    if (scene === "drawer") {
      await page.getByLabel("Mostrar tarefas", { exact: true }).selectOption("done");
      await page.getByRole("button", { name: fixture.completedTask.title, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
      await expect(dialog).toBeVisible(); await expect(dialog.getByLabel("Título", { exact: true })).toHaveValue(fixture.completedTask.title);
      await expect(dialog.getByLabel("Título", { exact: true })).toBeFocused();
      await expect(dialog.getByLabel("Estado", { exact: true })).toHaveValue("done");
      await expect(dialog.getByLabel("Prioridade", { exact: true })).toHaveValue(fixture.completedTask.priority);
      await expect(dialog.getByLabel("Descrição", { exact: true })).toHaveValue(fixture.completedTask.description!);
      await expect(dialog.getByLabel("Categoria", { exact: true })).toHaveValue(fixture.completedTask.category_id!);
      await expect(dialog.getByLabel("Projeto", { exact: true })).toHaveValue(fixture.completedTask.project_id!);
      await expect(dialog.getByLabel("Prazo", { exact: true })).toHaveValue("2026-09-23");
      await expect(dialog.getByLabel("Início planejado", { exact: true })).toHaveValue("");
      await expect(dialog.getByLabel("Término planejado", { exact: true })).toHaveValue("");
      await expect(dialog.getByLabel("Estimativa em minutos", { exact: true })).toHaveValue("");
      await expect(dialog.getByRole("switch", { name: "Dia inteiro", exact: true })).toBeChecked();
      await dialog.getByText("Organização e origem", { exact: true }).click();
      await expect(dialog.getByLabel("Ordem no quadro", { exact: true })).toHaveValue(String(fixture.completedTask.board_position));
      await expect(dialog.getByText("Origem: entrada manual.", { exact: true })).toBeVisible();
      // Opening the real details consistently exposes every Task field in all
      // three trees; it is part of this scene, not a hidden screenshot mask.
      await dialog.getByLabel("Título", { exact: true }).focus();
      await expect(dialog.getByLabel("Título", { exact: true })).toBeFocused();
      // A real Tab must stay inside the native modal. Escape/return focus are
      // exercised after its raw scene, without writing or mutating the fixture.
      await page.keyboard.press("Tab"); expect(await page.evaluate(() => !!document.activeElement?.closest("dialog:modal"))).toBe(true);
      await dialog.getByLabel("Título", { exact: true }).focus();
    } else await page.getByLabel("Mostrar tarefas", { exact: true }).focus();
  }
  await page.evaluate(() => { window.scrollTo(0, 0); const body = document.querySelector(".ui-dialog__body"); if (body) body.scrollTop = 0; });
}

test("porte visual histórico de Capturar e Tarefas preserva contratos comuns; 36 cenas brutas exigem revisão", async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  const product = await loadVisualProduct(), backend = await visualBackendManifest(product, current);
  const browserExecutable = await visualBrowserExecutable(browser.browserType().executablePath());
  const fixture = await createVisualData(product), baseline = await fixture.ledger();
  const commitsBefore = fixture.calls.filter(call => call.name === "capture_task_commit").length;
  const results: { scene: Scene; viewport: string; theme: typeof themes[number]; tree: VisualTree; measurements: VisualMeasurements; screenshot: string; dom: string }[] = [];
  const comparisons: { scene: Scene; viewport: string; theme: string; from: VisualTree; to: VisualTree; comparison: ReturnType<typeof compareVisualPort> }[] = [];
  const guardFailures: { scene: Scene; viewport: string; theme: string; tree: VisualTree; gate: string; finding: unknown }[] = [];
  const writeArtifact = async (name: string, bytes: string | Buffer, type: string) => {
    const path = testInfo.outputPath(name); await writeFile(path, bytes); await testInfo.attach(name, { path, contentType: type });
    return { name, sha256: digest(bytes), bytes: Buffer.byteLength(bytes) };
  };
  const artifacts: Awaited<ReturnType<typeof writeArtifact>>[] = [];
  try {
    for (const viewport of viewports) for (const theme of themes) for (const scene of scenes) {
      const group = new Map<VisualTree, VisualMeasurements>();
      for (const tree of trees) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1,
          timezoneId: "UTC", locale: "pt-BR", colorScheme: theme, reducedMotion: "reduce" });
        try {
          const trace = await attach(context, fixture, tree), page = await context.newPage();
          await start(page, fixture, tree, scene, theme);
          const guards = await inspectVisualGuards(page);
          for (const gate of ["overflow", "targets", "fields"] as const) if (guards[gate].length) guardFailures.push({
            scene, viewport: viewport.name, theme, tree, gate, finding: describeVisualFailures(guards, gate) });
          const measurements = await measureVisualPort(page);
          expect(measurements.duplicateIds).toEqual([]); expect(measurements.brokenAssociations).toEqual([]);
          expect(measurements.theme).toBe(theme); expect(measurements.tokens["--target"]).toBe("44px");
          expect(measurements.tokens["--font-family"]).toContain("Issue22VisualGeist");
          expect(measurements.elements.some(item => item.styles.fontFamily?.includes("Issue22VisualGeist"))).toBe(true);
          // Test-only detector negative. No product CSS/source is changed,
          // and the original inline style is restored before the raw image.
          const anchor = page.locator(scene === "capture" ? ".capture-title" : scene === "drawer" ? ".tasks-form .field__control" : ".tasks-filters .field__control").first();
          const savedStyle = await anchor.getAttribute("style");
          await anchor.evaluate(element => { element.style.width = "20px"; element.style.fontSize = "12px"; element.style.marginLeft = "3px"; });
          expect(compareVisualPort(measurements, await measureVisualPort(page)).violations.length).toBeGreaterThan(0);
          const negativeGuards = await inspectVisualGuards(page);
          expect(negativeGuards.fields.length).toBeGreaterThan(guards.fields.length);
          await anchor.evaluate((element, value) => { if (value === null) element.removeAttribute("style"); else element.setAttribute("style", value); }, savedStyle);
          expect(await measureVisualPort(page)).toEqual(measurements);
          const stem = [scene, viewport.name, theme, tree].join("-");
          const screenshot = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
          artifacts.push(await writeArtifact(stem + ".png", screenshot, "image/png"));
          const dom = await page.locator("body").evaluate(element => element.outerHTML);
          expect(Buffer.byteLength(dom)).toBeLessThan(2 * 1024 * 1024);
          artifacts.push(await writeArtifact(stem + ".html", dom, "text/html"));
          const report = { measurements, guards, trace };
          artifacts.push(await writeArtifact(stem + ".json", JSON.stringify(report, null, 2) + "\n", "application/json"));
          group.set(tree, measurements); results.push({ scene, viewport: viewport.name, theme, tree, measurements, screenshot: stem + ".png", dom: stem + ".html" });
          if (scene === "drawer") {
            await page.keyboard.press("Escape"); await expect(page.getByRole("dialog", { name: "Editar tarefa", exact: true })).toHaveCount(0);
            await expect(page.getByRole("button", { name: fixture.completedTask.title, exact: true })).toBeFocused();
          }
          expect(trace.unexpected).toEqual([]); expect(trace.pageErrors).toEqual([]);
          if (tree === "B") expect(trace.queries).toEqual([]); else expect(new Set(trace.queries)).toEqual(new Set(["captures", "tasks"]));
        } finally { await context.close(); }
      }
      for (const [from, to] of [["B", "P"], ["P", "C"]] as const) {
        const comparison = compareVisualPort(group.get(from)!, group.get(to)!);
        comparisons.push({ scene, viewport: viewport.name, theme, from, to, comparison });
      }
    }
    expect(results).toHaveLength(36); expect(comparisons).toHaveLength(24);
    expect(guardFailures, JSON.stringify(guardFailures, null, 2)).toEqual([]);
    expect(comparisons.flatMap(value => value.comparison.violations), JSON.stringify(comparisons.filter(value => value.comparison.violations.length), null, 2)).toEqual([]);
    expect(await fixture.ledger()).toEqual(baseline);
    expect(fixture.calls.filter(call => call.name === "capture_task_commit")).toHaveLength(commitsBefore);
  } finally {
    // Persist collected raw evidence even when a later scene/contract fails;
    // status is not promoted to visual acceptance merely by successful writes.
    const evidence = { schemaVersion: 1, scenario: "historical-visual-port", visualAcceptance: "INDEPENDENT_REVIEW_REQUIRED",
      currentRef: current, browser: browser.version(), browserExecutable, backend, timezone: "UTC", clock: VISUAL_NOW, dpr: 1,
      renderer: "Chromium Linux CI; no historical Next/RSC/Auth/backend claim", bundles: trees.map(tree => bundles[tree].manifest),
      policyVetoes: ["conhecimento", "calendario"], declaredDifferences, copyMatrix, screenshots: results.length, comparisons, guardFailures,
      artifacts, fixtureRowSha256: digest(JSON.stringify(fixture.data)), queryEquality: "complete entity/reference rows; readonlyCaptureIds must be empty",
      limits: ["P uses current Core/SQL behind its historical connected client", "no upload/EXIF/native Supabase/hosted/physical-device acceptance",
        "copy/flow differences remain unapproved until independent inspection", "no currentMemory control substituted for B/P historical provenance"] };
    const path = testInfo.outputPath("visual-port-manifest.json"); await writeFile(path, JSON.stringify(evidence, null, 2) + "\n");
    await testInfo.attach("visual-port-manifest", { path, contentType: "application/json" }); await fixture.db.close();
  }
});
