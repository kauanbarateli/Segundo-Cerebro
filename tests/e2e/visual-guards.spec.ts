import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { WORKSPACE_ROUTES } from "../../src/lib/navigation/routes";
import { DEFAULT_DEMO_POLICY, DEMO_ACCESS_STORAGE_KEY, serializeDemoPolicy } from "../../src/lib/navigation/demo-state";
import { describeVisualFailures, inspectVisualGuards, type VisualReport } from "./helpers/visual-guards";

const routes = [...new Set([...WORKSPACE_ROUTES.map((route) => route.href), "/ajuda", "/sair", "/design-system", "/offline", "/compartilhar"])];

async function ready(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Preparando a demonstração…", { exact: true })).toHaveCount(0);
  await expect(page.locator(".home-skeleton, .tasks-skeleton, .capture-loading")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

function check(report: VisualReport) {
  expect.soft(report.overflow, describeVisualFailures(report, "overflow")).toEqual([]);
  expect.soft(report.targets, describeVisualFailures(report, "targets")).toEqual([]);
  expect.soft(report.fields, describeVisualFailures(report, "fields")).toEqual([]);
}

async function attach(testInfo: TestInfo, reports: VisualReport[]) {
  await testInfo.attach("visual-guards.json", { body: JSON.stringify(reports, null, 2), contentType: "application/json" });
}

for (const width of [320, 390, 768]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`três portões visuais em todas as rotas: ${width}px, ${colorScheme}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      // Explicit fixture privilege covers the Admin surface as well as its route.
      await page.addInitScript(({ key, policy }) => sessionStorage.setItem(key, policy), {
        key: DEMO_ACCESS_STORAGE_KEY, policy: serializeDemoPolicy({ ...DEFAULT_DEMO_POLICY, isAdmin: true }),
      });
      const reports: VisualReport[] = [];
      try {
        for (const route of routes) {
          await test.step(route, async () => {
            const response = await page.goto(route);
            expect(response?.status(), route).toBe(200);
            await ready(page);
            const report = await inspectVisualGuards(page);
            reports.push(report);
            check(report);
          });
        }
        expect(reports).toHaveLength(routes.length);
        expect(reports.reduce((sum, report) => sum + report.inspectedTargets, 0)).toBeGreaterThan(0);
        expect(reports.reduce((sum, report) => sum + report.inspectedFields, 0)).toBeGreaterThan(0);
      } finally {
        await attach(testInfo, reports);
      }
    });
  }
}

for (const width of [320, 768]) {
  test(`portões incluem busca, perfil, Mais e superfícies abertas em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const reports: VisualReport[] = [];
    try {
      await page.goto("/");
      await ready(page);
      await page.getByRole("button", { name: "Buscar módulos", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Buscar módulos", exact: true })).toBeVisible();
      reports.push(await inspectVisualGuards(page));
      check(reports.at(-1)!);
      await page.keyboard.press("Escape");
      if (width < 768) {
        await page.getByRole("button", { name: "Mais módulos e conta" }).click();
        await expect(page.getByRole("dialog", { name: "Mais módulos", exact: true })).toBeVisible();
        reports.push(await inspectVisualGuards(page));
        check(reports.at(-1)!);
        await page.keyboard.press("Escape");
      }
      await page.getByRole("button", { name: "Abrir perfil de demonstração" }).click();
      await expect(page.locator("#shell-profile")).toBeVisible();
      reports.push(await inspectVisualGuards(page));
      check(reports.at(-1)!);
      await page.keyboard.press("Escape");

      await page.goto("/design-system");
      await ready(page);
      for (const [button, title] of [["Abrir diálogo", "Editar exemplo"], ["Abrir drawer", "Detalhes do exemplo"], ["Abrir painel inferior", "Ações do exemplo"]]) {
        await page.getByRole("button", { name: button, exact: true }).click();
        await expect(page.getByRole("dialog", { name: title, exact: true })).toBeVisible();
        reports.push(await inspectVisualGuards(page));
        check(reports.at(-1)!);
        await page.keyboard.press("Escape");
      }
    } finally {
      await attach(testInfo, reports);
    }
  });
}

test("transbordo plantado somente no DOM identifica o seletor culpado", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.setContent('<style>body { margin: 0; padding: 16px } * { box-sizing: border-box } .scroll { width: 100px; overflow-x: auto } .inner { width: 600px; height: 24px }</style><main><h1>Controle do detector</h1><div class="scroll"><div class="inner">Rolagem interna permitida</div></div></main>');
  expect((await inspectVisualGuards(page)).overflow).toEqual([]);
  await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.id = "visual-overflow-probe";
    probe.style.cssText = "width: calc(100vw + 48px); height: 24px";
    document.querySelector("main")!.append(probe);
  });
  const report = await inspectVisualGuards(page);
  expect(report.documentWidth).toBeGreaterThan(report.viewportWidth);
  expect(report.overflow).toEqual(expect.arrayContaining([expect.objectContaining({ selector: "#visual-overflow-probe" })]));
  expect(describeVisualFailures(report, "overflow")).toContain("#visual-overflow-probe");
  await page.evaluate(() => document.querySelector("#visual-overflow-probe")!.remove());
  expect((await inspectVisualGuards(page)).overflow).toEqual([]);
});

test("portões detectam alvo pequeno e campo pequeno, aceitando pseudo-alvo real", async ({ page }) => {
  await page.setContent(`<style>
    body { margin: 32px } button { padding: 0; border: 0; width: 32px; height: 32px; margin-right: 24px }
    #expanded { position: relative } #expanded::before { content: ""; position: absolute; width: 44px; height: 44px; left: 50%; top: 50%; transform: translate(-50%, -50%) }
    #small-field { display: block; margin-top: 24px; height: 44px; width: 180px; font-size: 15px }
    #hidden-control { display: none }
  </style><button id="small-target">Pequeno</button><button id="expanded">Ampliado</button><button id="hidden-control">Oculto</button><dialog><button id="closed-dialog-control">Fechado</button></dialog><input id="small-field" aria-label="Campo pequeno">`);
  const report = await inspectVisualGuards(page);
  expect(report.targets.map((item) => item.selector)).toEqual(["#small-target"]);
  expect(report.fields).toEqual([expect.objectContaining({ selector: "#small-field", fontSize: 15 })]);
  expect(report.inspectedTargets).toBe(3);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#small-target")!.style.cssText = "width: 44px; height: 44px";
    document.querySelector<HTMLElement>("#small-field")!.style.fontSize = "16px";
  });
  const fixed = await inspectVisualGuards(page);
  expect(fixed.targets).toEqual([]);
  expect(fixed.fields).toEqual([]);
});

test("pseudo-alvo recortado e overflow global não mascaram falhas", async ({ page }) => {
  await page.setContent(`<style>
    body { margin: 32px; overflow-x: hidden } .clip { width: 32px; height: 32px; overflow: hidden }
    button { position: relative; width: 32px; height: 32px; padding: 0; border: 0 }
    button::before { content: ""; position: absolute; width: 44px; height: 44px; top: 50%; left: 50%; transform: translate(-50%, -50%) }
  </style><div class="clip"><button id="clipped-target">Recortado</button></div>`);
  const report = await inspectVisualGuards(page);
  expect(report.targets).toEqual([expect.objectContaining({ selector: "#clipped-target", width: 32, height: 32 })]);
  expect(report.overflow).toEqual(expect.arrayContaining([expect.objectContaining({ selector: "html > body", reason: "overflow-x global esconde possíveis regressões" })]));
});
