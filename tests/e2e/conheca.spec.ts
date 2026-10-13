import { expect, test } from "@playwright/test";

test.describe("apresentação pública /conheca", () => {
  test("estrutura, metadados e navegação somente dentro da página", async ({ page }) => {
    const response = await page.goto("/conheca");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("Segundo Cérebro · Capture agora, encontre depois");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Capture agora.");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Segundo Cérebro · Capture agora, encontre depois");
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/conheca$/);

    const indice = page.getByRole("navigation", { name: "Comece por uma pergunta" });
    const perguntas = indice.getByRole("link");
    await expect(perguntas).toHaveCount(6);
    for (const link of await perguntas.all()) {
      const destino = await link.getAttribute("href");
      expect(destino).toMatch(/^#[a-z]+$/);
      await expect(page.locator(`article${destino}`).getByRole("heading", { level: 3 })).toHaveText((await link.textContent()) ?? "");
    }

    // Nenhum destino comercial nesta etapa: âncoras locais, sem formulários.
    const destinos = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(destinos.length).toBeGreaterThan(0);
    expect(destinos.filter((href) => !href.startsWith("#"))).toEqual([]);
    await expect(page.locator("form")).toHaveCount(0);

    for (const imagem of await page.locator("main img").all()) {
      expect((await imagem.getAttribute("alt"))?.length ?? 0).toBeGreaterThan(20);
    }
  });

  test("a ação de acesso informa o estado sem sair da página", async ({ page }) => {
    await page.goto("/conheca");
    const botao = page.getByRole("button", { name: "Quero acesso" });
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    const aviso = page.locator(`[id="${await botao.getAttribute("aria-controls")}"]`);
    await expect(aviso).toHaveAttribute("role", "status");
    await expect(aviso).toHaveText("");
    await botao.click();
    await expect(botao).toHaveAttribute("aria-expanded", "true");
    await expect(aviso).toHaveText(/Ainda não há como pedir acesso/);
    expect(new URL(page.url()).pathname).toBe("/conheca");
    await botao.click();
    await expect(aviso).toHaveText("");
  });

  test("o menu de seções no celular abre, leva à seção e fecha com Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/conheca");
    const secoes = page.getByRole("navigation", { name: "Seções" });
    await expect(secoes.getByRole("link", { name: "Princípios" })).toBeHidden();

    await page.getByRole("button", { name: "Abrir seções" }).click();
    await expect(secoes.getByRole("link", { name: "Princípios" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Abrir seções" })).toBeFocused();
    await expect(secoes.getByRole("link", { name: "Princípios" })).toBeHidden();

    await page.getByRole("button", { name: "Abrir seções" }).click();
    await secoes.getByRole("link", { name: "Conexões" }).click();
    await expect(page).toHaveURL(/#conexoes$/);
    await expect(secoes.getByRole("link", { name: "Conexões" })).toBeHidden();
    await expect(page.getByRole("heading", { name: /Uma informação, vários lugares/ })).toBeInViewport();
  });

  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    test(`sem rolagem horizontal e com telas carregadas em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/conheca");
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((resolve) => setTimeout(resolve, 40)); }
      });
      // Cada cena tem um quadro por tema; só o quadro exibido precisa carregar.
      const imagens = page.locator("main img");
      await expect.poll(async () => imagens.evaluateAll((lista) => {
        const exibidas = lista.filter((imagem) => imagem.checkVisibility());
        return exibidas.length >= 8 && exibidas.every((imagem) => (imagem as HTMLImageElement).complete && (imagem as HTMLImageElement).naturalWidth > 0);
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });
  }

  test("movimento reduzido mantém tudo visível e parado", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/conheca");
    await page.setViewportSize({ width: 1440, height: 900 });
    const animadas = await page.locator(".conheca-capitulo__tela, .conheca-hero__tela").evaluateAll((lista) => lista.map((item) => getComputedStyle(item).animationName));
    expect(animadas.length).toBeGreaterThan(0);
    expect(animadas.every((nome) => nome === "none")).toBe(true);
    await expect(page.getByRole("heading", { name: "Qual era a senha?" })).toBeAttached();
  });

  test("a pergunta fica parada enquanto a tela sobe até ela", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/conheca");
    const medir = (deslocamento: number) => page.evaluate((extra) => {
      const capitulo = document.getElementById("anotar")!;
      const grade = capitulo.querySelector(".conheca-capitulo__grade")!;
      const inicio = grade.getBoundingClientRect().top + window.scrollY + parseFloat(getComputedStyle(grade).paddingTop);
      window.scrollTo({ top: inicio - 104 + extra, behavior: "instant" });
      const pergunta = capitulo.querySelector(".conheca-capitulo__texto")!.getBoundingClientRect().top;
      const tela = capitulo.querySelector(".conheca-capitulo__tela")!.getBoundingClientRect().top;
      return { pergunta: Math.round(pergunta), tela: Math.round(tela) };
    }, deslocamento);

    const parada = await medir(20);
    const subindo = await medir(270);
    expect(subindo.pergunta).toBe(parada.pergunta);
    expect(parada.tela - subindo.tela).toBe(250);
    expect(subindo.tela).toBeGreaterThan(subindo.pergunta);

    // Ao alcançar a pergunta, a tela para ao lado dela até as duas seguirem juntas.
    const juntas = await medir(Math.round(900 * 0.56) + 60);
    expect(juntas.tela).toBe(juntas.pergunta);
    const depois = await medir(Math.round(900 * 0.72) + 300);
    expect(depois.tela).toBe(depois.pergunta);
    expect(depois.pergunta).toBeLessThan(juntas.pergunta);
  });

  test("as telas seguem o tema do aparelho e o tema escolhido no rodapé", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/conheca");
    const exibida = () => page.locator(".conheca-hero__tela img").evaluateAll((lista) => lista.filter((imagem) => imagem.checkVisibility()).map((imagem) => decodeURIComponent((imagem as HTMLImageElement).currentSrc)));
    await expect.poll(exibida).toEqual([expect.stringContaining("inicio-escuro")]);

    const tema = page.getByLabel("Tema");
    await tema.selectOption("light");
    await expect.poll(exibida).toEqual([expect.not.stringContaining("escuro")]);
    await tema.selectOption("dark");
    await expect.poll(exibida).toEqual([expect.stringContaining("inicio-escuro")]);
  });
});
