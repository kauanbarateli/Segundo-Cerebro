import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { decodeSettingsCommand, type AccountSettings } from "../../src/core/configuracoes";
import { createDemoFixture } from "../../src/lib/demo/fixtures";

const origin = "https://home-preferences-fixture.test";
const owner = "10000000-0000-4000-8000-000000000001";
const taskTitle = "Tarefa da conta sintética";
let bundle: string;
test.beforeAll(async () => {
  const navigation = resolve("tests/e2e/fixtures/home-preferences-navigation.tsx").replaceAll("\\", "/");
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/home-preferences-browser.tsx"), platform: "browser", tsconfig: false,
    resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } },
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "home-preferences-routing-and-css", resolveId(source) {
      if (source.endsWith(".css")) return "\0home-preferences-css";
      if (source === "next/link") return "\0home-preferences-link";
    }, load(id) {
      if (id === "\0home-preferences-css") return "export {};";
      if (id === "\0home-preferences-link") return `export { NavigationLink as default } from ${JSON.stringify(navigation)};`;
    } }],
  });
  try {
    const generated = await build.generate({ format: "iife", codeSplitting: false });
    const chunk = generated.output.find(output => output.type === "chunk");
    if (!chunk || chunk.type !== "chunk") throw new Error("Home preferences browser bundle is missing.");
    bundle = chunk.code;
  } finally { await build.close(); }
});

async function start(page: Page) {
  await page.addScriptTag({ content: bundle });
  await page.evaluate(async userId => (globalThis as unknown as { __startHomePreferencesFixture(userId: string): Promise<void> }).__startHomePreferencesFixture(userId), owner);
  await expect(page.getByRole("heading", { name: "Início", exact: true })).toBeVisible();
  await expect(page.getByText("Caixa de entrada em dia. Capture a próxima ideia quando ela chegar.", { exact: true })).toBeVisible();
}

test("preferência da conta oculta Tarefas no Início sem consultar o adapter conectado", async ({ page }) => {
  // Real React/providers/Home/Settings/connected adapter; synthetic HTTP only.
  const settings: AccountSettings = { user_id: owner,
    profile: { display_name: "Pessoa sintética", email: "home@example.invalid", avatar_file_id: null },
    preferences: { theme: "system", default_calendar_view: "month", values_hidden: true, meeting_reminders_enabled: false, meeting_reminder_minutes: 10 },
    modules: [
      { module_key: "tarefas", visible: false, sort_order: 20 },
      ...(["projetos", "habitos", "financeiro", "calendario"] as const).map((module_key, index) => ({ module_key, visible: false, sort_order: 30 + index * 10 })),
    ],
  };
  const task = { ...createDemoFixture(new Date().toISOString(), owner).initial.task![0]!, title: taskTitle, status: "in_progress" as const, due_at: null };
  const reads: { path: string; expectedUser: string | undefined }[] = [];
  const writes: string[] = [], unexpected: string[] = [], pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/api/settings") {
      if (request.method() === "GET") { reads.push({ path: url.pathname, expectedUser: request.headers()["x-expected-user-id"] }); await json(settings); return; }
      const command = decodeSettingsCommand(request.postDataJSON());
      expect(command.command).toBe("settings.modules.update");
      if (command.command !== "settings.modules.update") throw new Error("Unexpected settings command.");
      expect(request.headers()["x-expected-user-id"]).toBe(owner);
      settings.modules = command.input.modules;
      writes.push(command.command); await json({ ok: true, result: settings }); return;
    }
    if (url.pathname === "/api/capture-tasks" && request.method() === "GET") {
      const query = url.searchParams.get("query");
      if (query !== "captures" && query !== "tasks") { unexpected.push("UNKNOWN_QUERY"); await route.abort(); return; }
      reads.push({ path: url.pathname + url.search, expectedUser: request.headers()["x-expected-user-id"] });
      await json({ items: query === "tasks" ? [task] : [], categories: [], projects: [] }); return;
    }
    if (request.isNavigationRequest()) { await route.fulfill({ status: 200, contentType: "text/html", body: '<html lang="pt-BR"><body><div id="home-preferences-fixture"></div></body></html>' }); return; }
    unexpected.push("UNEXPECTED_REQUEST"); await route.abort();
  });
  const taskReads = () => reads.filter(read => read.path === "/api/capture-tasks?query=tasks").length;
  const policy = page.getByLabel("Política de Tarefas", { exact: true });
  const refresh = async (count: number) => {
    await page.getByRole("button", { name: "Atualizar leituras observadas", exact: true }).click();
    await expect(page.getByLabel("Atualizações concluídas", { exact: true })).toHaveText(String(count));
  };
  const saveVisibility = async (visible: boolean) => {
    await page.getByRole("navigation", { name: "Rotas do teste" }).getByRole("link", { name: "Configurações", exact: true }).click();
    const toggle = page.getByRole("switch", { name: "Tarefas", exact: true });
    await expect(toggle).toHaveAttribute("aria-checked", String(!visible));
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", String(visible));
    await page.getByRole("button", { name: "Salvar módulos", exact: true }).click();
    await expect(page.getByText("Configurações salvas na sua conta.", { exact: true })).toBeVisible();
    await expect(policy).toHaveText(JSON.stringify({ allowed: true, visible }));
    await page.getByRole("navigation", { name: "Rotas do teste" }).getByRole("link", { name: "Início", exact: true }).click();
  };

  await page.goto(origin + "/"); await start(page);
  await expect(policy).toHaveText('{"allowed":true,"visible":false}');
  await expect(page.getByRole("region", { name: "Tarefas de hoje", exact: true })).toHaveCount(0);
  expect(taskReads()).toBe(0);
  await refresh(1); expect(taskReads()).toBe(0);

  await saveVisibility(true);
  await expect(page.getByRole("region", { name: "Em foco", exact: true }).getByRole("heading", { name: taskTitle, exact: true })).toBeVisible();
  expect(taskReads()).toBe(1);
  await refresh(2); expect(taskReads()).toBe(2);

  await saveVisibility(false);
  await expect(page.getByRole("region", { name: "Em foco", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Tarefas de hoje", exact: true })).toHaveCount(0);
  await refresh(3); expect(taskReads()).toBe(2);
  await page.reload(); await start(page);
  await expect(policy).toHaveText('{"allowed":true,"visible":false}');
  await refresh(1); expect(taskReads()).toBe(2);
  expect(writes).toEqual(["settings.modules.update", "settings.modules.update"]);
  expect(reads.every(read => read.expectedUser === owner)).toBe(true);
  expect(unexpected).toEqual([]); expect(pageErrors).toEqual([]);
});
