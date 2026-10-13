import { expect, test, type Page, type Request } from "@playwright/test";
import { THEME_STORAGE_KEY } from "../../src/lib/theme";

const capitulos = ["anotar", "hoje", "dinheiro", "aquilo", "ritmo", "senha"] as const;

async function abrirDemonstracao(page: Page, baseURL: string | undefined, width: number, height: number, semFontes = false) {
  if (!baseURL) throw new Error("O teste precisa de uma origem local configurada.");
  const origem = new URL(baseURL);
  expect(["localhost", "127.0.0.1"]).toContain(origem.hostname);
  expect(origem.protocol).toBe("http:");
  let recusados = 0;
  let fontesRecusadas = 0;
  await page.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origem.origin || request.method() !== "GET" || url.pathname.startsWith("/api/")) {
      recusados += 1;
      return route.abort();
    }
    if (semFontes && url.pathname.endsWith(".woff2")) {
      fontesRecusadas += 1;
      return route.abort();
    }
    return route.continue();
  });
  await page.setViewportSize({ width, height });
  const response = await page.goto("/conheca");
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".conheca-capitulo")).toHaveCount(capitulos.length);
  return () => {
    expect(recusados).toBe(0);
    if (semFontes) expect(fontesRecusadas).toBeGreaterThan(0);
  };
}

async function percurso(page: Page, id: string) {
  return page.evaluate((id) => {
    const capitulo = document.getElementById(id)!;
    const grade = capitulo.querySelector<HTMLElement>(".conheca-capitulo__grade")!;
    const texto = capitulo.querySelector<HTMLElement>(".conheca-capitulo__texto")!;
    const palco = capitulo.querySelector<HTMLElement>(".conheca-capitulo__palco")!;
    const root = document.querySelector<HTMLElement>(".conheca")!;
    return {
      inicio: grade.getBoundingClientRect().top + window.scrollY + parseFloat(getComputedStyle(grade).paddingTop),
      fixo: parseFloat(getComputedStyle(texto).top),
      subida: parseFloat(getComputedStyle(palco).paddingTop),
      pausa: parseFloat(getComputedStyle(palco, "::after").height),
      margem: parseFloat(getComputedStyle(root).getPropertyValue("--space-8")),
    };
  }, id);
}

async function medirPercurso(page: Page, id: string, geometria: Awaited<ReturnType<typeof percurso>>, extra: number) {
  return page.evaluate(async ({ id, geometria, extra }) => {
    window.scrollTo({ top: geometria.inicio - geometria.fixo + extra, behavior: "instant" });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const capitulo = document.getElementById(id)!;
    const texto = capitulo.querySelector<HTMLElement>(".conheca-capitulo__texto")!;
    const tela = capitulo.querySelector<HTMLElement>(".conheca-capitulo__tela")!;
    const ultimo = capitulo.querySelector<HTMLElement>(".conheca-fatos li:last-child")!;
    const transform = getComputedStyle(tela).transform;
    return {
      pergunta: texto.getBoundingClientRect().top,
      textoAltura: texto.getBoundingClientRect().height,
      tela: tela.getBoundingClientRect().top,
      telaAltura: tela.getBoundingClientRect().height,
      ultimoTopo: ultimo.getBoundingClientRect().top,
      ultimoFim: ultimo.getBoundingClientRect().bottom,
      cabecalhoFim: document.querySelector(".conheca-cabecalho")!.getBoundingClientRect().bottom,
      escala: transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a,
      animacao: getComputedStyle(tela).animationName,
    };
  }, { id, geometria, extra });
}

async function conferirCoreografia(page: Page, height: number, movimento: boolean, textoInteiroParado = true) {
  const suporta = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
  for (const id of capitulos) {
    const capitulo = page.locator(`article#${id}`);
    const posicoes = await capitulo.locator(".conheca-capitulo__texto, .conheca-capitulo__tela").evaluateAll((lista) => lista.map((item) => getComputedStyle(item).position));
    expect(posicoes, id).toEqual(["sticky", "sticky"]);
    const geometria = await percurso(page, id);
    expect(Number.isFinite(geometria.fixo), id).toBe(true);
    expect(geometria.subida, id).toBeCloseTo(height * 0.56, 1);
    expect(geometria.pausa, id).toBeCloseTo(height * 0.16, 1);

    const inicio = await medirPercurso(page, id, geometria, 20);
    const imagem = capitulo.locator("img:visible");
    await expect(imagem).toHaveCount(1);
    await expect.poll(() => imagem.evaluate((item) => (item as HTMLImageElement).complete && (item as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const meio = await medirPercurso(page, id, geometria, geometria.subida / 2);
    const juntas = await medirPercurso(page, id, geometria, geometria.subida + geometria.pausa / 2);
    expect(Math.abs(meio.pergunta - inicio.pergunta), id).toBeLessThan(1);
    expect(inicio.tela - meio.tela, id).toBeCloseTo(geometria.subida / 2 - 20, 0);
    expect(meio.tela, id).toBeGreaterThan(meio.pergunta);
    expect(Math.abs(juntas.tela - juntas.pergunta), id).toBeLessThan(1);
    expect(juntas.pergunta, id).toBeGreaterThan(juntas.cabecalhoFim);
    expect(juntas.telaAltura, id).toBeLessThanOrEqual(height - geometria.fixo - geometria.margem + 1);
    await expect(imagem).toBeInViewport({ ratio: 1 });
    if (textoInteiroParado) {
      expect(juntas.textoAltura, id).toBeLessThanOrEqual(height - geometria.fixo);
      expect(juntas.ultimoFim, id).toBeLessThanOrEqual(height);
      await expect(capitulo.locator(".conheca-fatos li").last()).toBeInViewport({ ratio: 1 });
    }
    if (movimento && suporta) {
      expect(inicio.animacao, id).toBe("conheca-abrir");
      expect(inicio.escala, id).toBeGreaterThanOrEqual(0.94);
      expect(meio.escala, id).toBeGreaterThan(inicio.escala + 0.015);
      expect(juntas.escala, id).toBeGreaterThan(meio.escala + 0.015);
      expect(juntas.escala, id).toBeCloseTo(1, 3);
    } else {
      expect([inicio.animacao, meio.animacao, juntas.animacao], id).toEqual(["none", "none", "none"]);
      expect([inicio.escala, meio.escala, juntas.escala], id).toEqual([1, 1, 1]);
    }

    // Fontes de fallback podem exceder a janela parada. A liberação deve
    // conservar o último fato inteiro alcançável, sem corte no contêiner.
    const excesso = Math.max(0, juntas.textoAltura - (height - geometria.fixo));
    const depois = await medirPercurso(page, id, geometria, geometria.subida + geometria.pausa + excesso + 40);
    expect(Math.abs(depois.tela - depois.pergunta), id).toBeLessThan(1);
    expect(depois.pergunta, id).toBeLessThan(juntas.pergunta);
    expect(depois.ultimoTopo, id).toBeGreaterThan(depois.cabecalhoFim);
    expect(depois.ultimoFim, id).toBeLessThanOrEqual(height);
    await expect(capitulo.locator(".conheca-fatos li").last()).toBeInViewport({ ratio: 1 });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
}

async function conferirFluxoLivre(page: Page) {
  for (const id of capitulos) {
    const capitulo = page.locator(`article#${id}`);
    const estilos = await capitulo.locator(".conheca-capitulo__texto, .conheca-capitulo__tela").evaluateAll((lista) => lista.map((item) => ({ posicao: getComputedStyle(item).position, animacao: getComputedStyle(item).animationName })));
    expect(estilos, id).toEqual([{ posicao: "static", animacao: "none" }, { posicao: "static", animacao: "none" }]);
    const ultimo = capitulo.locator(".conheca-fatos li").last();
    await ultimo.evaluate((item) => item.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect(ultimo).toBeInViewport({ ratio: 1 });
    const imagem = capitulo.locator("img:visible");
    await expect(imagem).toHaveCount(1);
    await imagem.scrollIntoViewIfNeeded();
    await expect.poll(() => imagem.evaluate((item) => (item as HTMLImageElement).complete && (item as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const fimVisivel = await imagem.evaluate(async (item) => {
      window.scrollTo({ top: item.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 32, behavior: "instant" });
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const fim = item.getBoundingClientRect().bottom;
      return fim <= window.innerHeight && fim > document.querySelector(".conheca-cabecalho")!.getBoundingClientRect().bottom;
    });
    expect(fimVisivel, id).toBe(true);
    await expect(imagem).toBeInViewport();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
}

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

  test("teclado no celular alcança a primeira seção e retorna com Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/conheca");
    const abrir = page.getByRole("button", { name: "Abrir seções" });
    const perguntas = page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name: "Perguntas", exact: true });

    await abrir.focus();
    await expect(abrir).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Fechar seções" })).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(perguntas).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(abrir).toBeFocused();
    await expect(abrir).toHaveAttribute("aria-expanded", "false");
    await expect(perguntas).toBeHidden();
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

  test("tema salvo prioriza a hero visível e evita baixar a variante clara oculta", async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("O teste precisa de uma origem local configurada.");
    const origem = new URL(baseURL);
    expect(["localhost", "127.0.0.1"]).toContain(origem.hostname);
    expect(origem.protocol).toBe("http:");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript((chave) => localStorage.setItem(chave, "dark"), THEME_STORAGE_KEY);

    let downloadsClaros = 0;
    let downloadsEscuros = 0;
    const observarImagem = (request: Request) => {
      const url = new URL(request.url());
      if (url.origin !== origem.origin || url.pathname !== "/_next/image") return;
      const fonte = url.searchParams.get("url");
      if (!fonte || !fonte.startsWith("/_next/static/media/")) return;
      const arquivo = new URL(fonte, origem).pathname.split("/").at(-1) ?? "";
      if (/^inicio\.[^/]+\.webp$/.test(arquivo)) downloadsClaros += 1;
      if (/^inicio-escuro\.[^/]+\.webp$/.test(arquivo)) downloadsEscuros += 1;
    };
    page.on("request", observarImagem);

    try {
      const response = await page.goto("/conheca");
      expect(response?.status()).toBe(200);
      const imagens = page.locator(".conheca-hero__tela img");
      const medir = () => imagens.evaluateAll((lista) => lista.map((elemento) => {
        const imagem = elemento as HTMLImageElement;
        const url = imagem.currentSrc ? new URL(imagem.currentSrc) : null;
        const fonte = url?.searchParams.get("url") ?? url?.pathname ?? "";
        return {
          visivel: imagem.checkVisibility(),
          escura: /\/inicio-escuro\.[^/]+\.webp$/.test(fonte),
          carregada: imagem.complete && imagem.naturalWidth > 0,
          loading: imagem.loading,
          prioridade: imagem.fetchPriority,
        };
      }));
      await expect.poll(async () => {
        const visiveis = (await medir()).filter((imagem) => imagem.visivel);
        return visiveis.length === 1 && visiveis.every((imagem) => imagem.escura && imagem.carregada);
      }).toBe(true);
      // Confere o estado carregado após dois frames, sem rolar ou pedir outras imagens.
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const medidas = await medir();
      const visiveis = medidas.filter((imagem) => imagem.visivel);
      const ocultas = medidas.filter((imagem) => !imagem.visivel);
      expect(visiveis).toHaveLength(1);
      expect(visiveis[0]).toMatchObject({ escura: true, carregada: true, loading: "eager", prioridade: "high" });
      expect(ocultas.length).toBeGreaterThan(0);
      expect(ocultas.every((imagem) => imagem.loading === "lazy" && imagem.prioridade === "auto")).toBe(true);
      expect(downloadsEscuros).toBeGreaterThan(0);
      expect(downloadsClaros).toBe(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    } finally {
      page.off("request", observarImagem);
    }
  });

  test("sem JavaScript a apresentação mantém a hero escura no celular", async ({ browser, baseURL }) => {
    if (!baseURL) throw new Error("O teste precisa de uma origem local configurada.");
    const origem = new URL(baseURL);
    expect(["localhost", "127.0.0.1"]).toContain(origem.hostname);
    expect(origem.protocol).toBe("http:");
    const contexto = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      colorScheme: "dark",
      viewport: { width: 390, height: 844 },
    });

    try {
      const pagina = await contexto.newPage();
      const response = await pagina.goto("/conheca");
      expect(response?.status()).toBe(200);
      await expect(pagina).toHaveTitle("Segundo Cérebro · Capture agora, encontre depois");
      const hero = pagina.locator(".conheca-hero__tela img:visible");
      await expect(hero).toHaveCount(1);
      await expect(hero).toBeVisible();
      await expect.poll(() => hero.evaluate((elemento) => {
        const imagem = elemento as HTMLImageElement;
        const url = imagem.currentSrc ? new URL(imagem.currentSrc) : null;
        const fonte = url?.searchParams.get("url") ?? url?.pathname ?? "";
        return {
          celularEscuro: /\/inicio-celular-escuro\.[^/]+\.webp$/.test(fonte),
          carregada: imagem.complete && imagem.naturalWidth > 0,
        };
      })).toEqual({ celularEscuro: true, carregada: true });
      expect(await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    } finally {
      await contexto.close();
    }
  });

  test.describe("coreografia responsiva", () => {
    test.use({ serviceWorkers: "block" });

    for (const width of [1024, 1440]) {
      for (const height of [600, 650, 700, 900]) {
        test(`coreografia dos seis capítulos em ${width}x${height}`, async ({ page, baseURL }) => {
          await page.emulateMedia({ reducedMotion: "no-preference" });
          const conferirOrigem = await abrirDemonstracao(page, baseURL, width, height);
          await conferirCoreografia(page, height, true);
          conferirOrigem();
        });
      }
    }

    for (const [width, height] of [[1024, 599], [1440, 599], [320, 600]] as const) {
      test(`fluxo livre dos seis capítulos em ${width}x${height}`, async ({ page, baseURL }) => {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        const conferirOrigem = await abrirDemonstracao(page, baseURL, width, height);
        await conferirFluxoLivre(page);
        conferirOrigem();
      });
    }

    for (const height of [600, 900]) {
      test(`movimento reduzido dos seis capítulos em 1440x${height}`, async ({ page, baseURL }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const conferirOrigem = await abrirDemonstracao(page, baseURL, 1440, height);
        await conferirCoreografia(page, height, false);
        conferirOrigem();
      });
    }

    test("fallback real da fonte mantém os seis últimos fatos alcançáveis em 1440x600", async ({ page, baseURL }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const conferirOrigem = await abrirDemonstracao(page, baseURL, 1440, 600, true);
      expect(await page.evaluate(() => Array.from(document.fonts).some((fonte) => fonte.family === "GeistSans" && fonte.status === "error"))).toBe(true);
      await conferirCoreografia(page, 600, true, false);
      conferirOrigem();
    });

    test("fallback e texto ampliado conservam o último fato após liberar o sticky em 1440x600", async ({ page, baseURL }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const conferirOrigem = await abrirDemonstracao(page, baseURL, 1440, 600, true);
      // A ampliação só no DOM do teste força texto alto sem depender de uma
      // fonte instalada no sistema nem modificar o CSS servido.
      await page.locator(".conheca-capitulo__texto .conheca-paragrafo, .conheca-capitulo__texto .conheca-fatos li").evaluateAll((itens) => {
        for (const item of itens) {
          (item as HTMLElement).style.fontSize = "18px";
          (item as HTMLElement).style.lineHeight = "32px";
        }
      });
      const ritmo = await page.locator("#ritmo .conheca-capitulo__texto").evaluate((item) => item.getBoundingClientRect().height);
      const geometria = await percurso(page, "ritmo");
      expect(ritmo).toBeGreaterThan(600 - geometria.fixo);
      await conferirCoreografia(page, 600, true, false);
      conferirOrigem();
    });
  });
});
