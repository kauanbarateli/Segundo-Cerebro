import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1280]) {
  test("cascas de conteúdo sem transbordo em " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [route, title] of [["/calendario", "Calendário"], ["/habitos", "Hábitos"], ["/conhecimento", "Conhecimento"], ["/projetos", "Projetos"]]) {
      await page.goto(route!);
      await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
      await expect(page.locator('[data-access="allowed"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: "test-results/t012-" + route!.slice(1) + "-" + width + ".png", fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test("calendário navega mês/lista e abre o mesmo evento do Início", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calendario?view=month&date=2026-09-23");
  await expect(page.locator(".calendar-month-list")).toBeVisible();
  await expect(page.locator(".calendar-month")).toBeHidden();
  await page.locator(".calendar-month-list").getByRole("button", { name: /15:00 Reunião Central VOE/ }).click();
  const detail = page.getByRole("dialog", { name: "Reunião Central VOE", exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("2026-09-23 às 15:00")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await page.getByRole("button", { name: "Próximo período", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-10-01/);
  await page.reload();
  await expect(page.getByLabel("Data do calendário")).toHaveValue("2026-10-01");
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(page.getByRole("region", { name: "Grade semanal com rolagem interna" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [390, 1280]) {
  test("calendário conserva dias, dia inteiro e horas ao rolar em " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ["day", "week"]) {
      await page.goto("/calendario?view=" + view + "&date=2026-09-23");
      const region = page.getByRole("region", { name: view === "week" ? "Grade semanal com rolagem interna" : "Grade do dia com rolagem interna" });
      await expect(region).toBeVisible();
      await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBe(480);
      await region.scrollIntoViewIfNeeded();
      await region.evaluate((element) => { element.scrollTop = 720; element.scrollLeft = 300; });
      const geometry = await region.evaluate((element) => {
        const viewport = element.getBoundingClientRect();
        const top = viewport.top + element.clientTop, left = viewport.left + element.clientLeft;
        const right = left + element.clientWidth;
        const hours = element.querySelector(".calendar-hours")!;
        const headings = Array.from(element.querySelectorAll(".calendar-time-day .calendar-day-label"));
        const heading = headings.find((item) => {
          const rect = item.getBoundingClientRect();
          return rect.left >= left + 64 && rect.right <= right + 1;
        })!;
        const band = heading?.nextElementSibling;
        const hour = Array.from(hours.querySelectorAll("span")).find((item) => item.textContent === "12:00")!;
        const exposed = (item: Element | null | undefined) => {
          if (!item) return false;
          const rect = item.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return hit !== null && item.contains(hit);
        };
        return {
          headerOffset: heading ? heading.getBoundingClientRect().top - top : null,
          allDayOffset: band ? band.getBoundingClientRect().top - top : null,
          hoursOffset: hours.getBoundingClientRect().left - left,
          headerExposed: exposed(heading), allDayExposed: exposed(band), hourExposed: exposed(hour),
          scrollX: element.scrollLeft, scrollY: element.scrollTop,
          timelineHeight: element.querySelector(".calendar-timeline")!.getBoundingClientRect().height,
        };
      });
      expect(geometry.headerOffset).toBeCloseTo(0, 0);
      expect(geometry.allDayOffset).toBeCloseTo(60, 0);
      expect(geometry.hoursOffset).toBeCloseTo(0, 0);
      expect(geometry.headerExposed && geometry.allDayExposed && geometry.hourExposed).toBe(true);
      expect(geometry.scrollY).toBe(720);
      if (view === "week") expect(geometry.scrollX).toBeGreaterThan(0);
      expect(geometry.timelineHeight).toBe(1440);
    }
  });
}

test("hábitos permite marcação passada e pausa pelo Núcleo", async ({ page }) => {
  await page.goto("/habitos");
  await page.getByRole("button", { name: "Registrar dia", exact: true }).click();
  const mark = page.getByRole("dialog", { name: "Registrar dia", exact: true });
  await mark.getByLabel("Hábito", { exact: true }).selectOption("habit-meditacao");
  await mark.getByLabel("Dia do hábito", { exact: true }).fill("2026-09-21");
  await mark.getByLabel("Marcação", { exact: true }).selectOption("clear");
  await mark.getByRole("button", { name: "Salvar marcação", exact: true }).click();
  await expect(mark).toBeHidden();
  await expect(page.getByRole("progressbar", { name: "Semana dos hábitos" })).toHaveAttribute("aria-valuenow", "50");
  await page.getByRole("button", { name: "Registrar pausa", exact: true }).click();
  const pause = page.getByRole("dialog", { name: "Registrar pausa", exact: true });
  await pause.getByLabel("Hábito", { exact: true }).selectOption("habit-academia");
  await pause.getByLabel("Início da pausa", { exact: true }).fill("2026-09-23");
  await pause.getByLabel("Fim da pausa", { exact: true }).fill("2026-09-30");
  await pause.getByLabel("Motivo", { exact: true }).fill("Pausa do exemplo");
  await pause.getByRole("button", { name: "Salvar pausa", exact: true }).click();
  await expect(pause).toBeHidden();
  await expect(page.getByRole("main").locator("p").filter({ hasText: /^Pausa do exemplo$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar Academia", exact: true })).toBeDisabled();
});

test("conhecimento lê a mesma nota organizada com Capturar vetado", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("segundo-cerebro-demo-navigation-v1", JSON.stringify({ version: 1, entitlements: { capturar: false }, preferences: {}, isAdmin: false })));
  await page.goto("/conhecimento?note=architecture");
  await expect(page.getByRole("heading", { name: "Decisões de arquitetura", exact: true })).toBeVisible();
  await expect(page.locator(".knowledge-copy")).toContainText("Dinheiro em centavos inteiros");
  await expect(page.getByRole("link", { name: "Editar em Capturar" })).toHaveCount(0);
  await page.locator(".knowledge-copy").getByRole("link", { name: "Visão do produto", exact: true }).click();
  await expect(page).toHaveURL(/note=vision/);
  await expect(page.getByRole("heading", { name: "Visão do produto", exact: true })).toBeVisible();
});

test("renomear a nota em Capturar aparece no leitor Conhecimento", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/conhecimento?note=architecture");
  await page.getByRole("link", { name: "Editar em Capturar" }).click();
  await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue("Decisões de arquitetura");
  await page.getByLabel("Título da nota", { exact: true }).fill("Arquitetura compartilhada");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
  await page.getByRole("navigation", { name: "Navegação principal", exact: true }).getByRole("link", { name: "Conhecimento", exact: true }).click();
  await page.getByRole("region", { name: "Notas encontradas" }).getByRole("link", { name: "Arquitetura compartilhada", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Arquitetura compartilhada", exact: true })).toBeVisible();
});

test("projetos deriva tarefas do mesmo universo e omite módulo vetado", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("segundo-cerebro-demo-navigation-v1", JSON.stringify({ version: 1, entitlements: { drive: false }, preferences: {}, isAdmin: false })));
  await page.goto("/projetos?project=project-sc-v2");
  await expect(page.getByRole("heading", { name: "Segundo Cérebro V2", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Tarefas do projeto" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("progressbar", { name: "Tarefas do projeto" })).toHaveAttribute("aria-valuemax", "3");
  await expect(page.getByRole("heading", { name: "Pastas", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: /Revisar plano de milestones do V2/ }).click();
  await expect(page).toHaveURL(/task=task-milestones/);
  await expect(page.getByRole("dialog", { name: "Editar tarefa", exact: true })).toBeVisible();
});

test("IDs ausentes mostram mensagem própria", async ({ page }) => {
  await page.goto("/conhecimento?note=ausente");
  await expect(page.getByRole("heading", { name: "Nota não encontrada" })).toBeVisible();
  await page.goto("/projetos?project=ausente");
  await expect(page.getByRole("heading", { name: "Projeto não encontrado" })).toBeVisible();
  await page.goto("/calendario?event=ausente");
  await expect(page.getByRole("heading", { name: "Compromisso não encontrado" })).toBeVisible();
});

for (const [key, label, loaded] of [
  ["agenda", "Calendário", "setembro de 2026"],
  ["habits", "Hábitos", "Hoje"],
  ["knowledge", "Conhecimento", "Financeiro fundido"],
  ["projects", "Projetos", "Segundo Cérebro V2"],
] as const) {
  test(label + " mostra erro real do reader e recupera por retry", async ({ page }) => {
    await page.goto("/configuracoes");
    await page.getByLabel("Módulo para testar leitura", { exact: true }).selectOption(key);
    await page.getByRole("button", { name: "Simular falha na próxima leitura", exact: true }).click();
    await page.getByRole("link", { name: "Abrir " + label, exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Não foi possível carregar estes dados");
    await page.getByRole("button", { name: "Tentar de novo", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: loaded, exact: true })).toBeVisible();
  });
}

test("cenário vazio do adapter preserva orientação própria em cada casca", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/configuracoes");
  await page.getByLabel("Cenário de dados", { exact: true }).selectOption("empty");
  await page.getByRole("button", { name: "Carregar cenário", exact: true }).click();
  await expect(page.getByText("Cenário sem registros carregado.", { exact: true })).toBeVisible();
  for (const [label, empty] of [
    ["Calendário", "Nenhum compromisso neste período"],
    ["Hábitos", "Sua rotina começa com um hábito"],
    ["Conhecimento", "Nenhuma nota organizada ainda."],
    ["Projetos", "Nenhum projeto por aqui"],
  ]) {
    await page.getByRole("navigation", { name: "Navegação principal", exact: true }).getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByText(empty!, { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  }
});
