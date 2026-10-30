import { expect, test, type Page, type Request } from "@playwright/test";
import { THEME_STORAGE_KEY } from "../../src/lib/theme";

const capitulos = ["captura", "agenda", "projetos"] as const;

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

/** Complemento V2: o painel alternado também precisa caber no piso do Edge. */
async function conferirKanbanParado(page: Page, screenshotPath: string) {
  const tabs = page.getByRole("tablist", { name: "Prévia de Projetos e Kanban", exact: true });
  const kanban = tabs.getByRole("tab", { name: "Kanban", exact: true });
  await kanban.focus(); await kanban.press("Enter");
  await expect(kanban).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#conheca-preview-projetos-panel")).toBeHidden();
  const painel = page.getByRole("tabpanel", { name: "Kanban", exact: true });
  await expect(painel).toBeVisible(); await expect(page.getByRole("tabpanel")).toHaveCount(1);
  const imagem = painel.locator("img:visible");
  await expect(imagem).toHaveCount(1);
  await expect.poll(() => imagem.evaluate(element => { const img = element as HTMLImageElement; return img.complete && img.naturalWidth > 0; })).toBe(true);
  expect(await imagem.evaluate(element => decodeURIComponent((element as HTMLImageElement).currentSrc))).toContain("tarefas-kanban");
  const geometria = await percurso(page, "projetos");
  const parada = await medirPercurso(page, "projetos", geometria, geometria.subida + geometria.pausa / 2);
  expect(Math.abs(parada.tela - parada.pergunta)).toBeLessThan(1);
  expect(parada.pergunta).toBeGreaterThan(parada.cabecalhoFim);
  expect(parada.telaAltura).toBeLessThanOrEqual(600 - geometria.fixo - geometria.margem + 1);
  await expect(imagem).toBeInViewport({ ratio: 1 });
  for (const tab of await tabs.getByRole("tab").all()) {
    const box = await tab.boundingBox();
    expect(box).not.toBeNull(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(tab).toBeInViewport({ ratio: 1 });
  }
  await expect(kanban).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await page.screenshot({ path: screenshotPath });
}

test.describe("apresentação pública /conheca", () => {
  test("estrutura, metadados, âncoras e destinos públicos aprovados sem checkout", async ({ page }) => {
    const response = await page.goto("/conheca");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("Segundo Cérebro · Capture agora, encontre depois");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Capture agora.");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Segundo Cérebro · Capture agora, encontre depois");
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/conheca$/);

    const indice = page.getByRole("navigation", { name: "Conheça os recursos" });
    const perguntas = indice.getByRole("link");
    await expect(perguntas).toHaveCount(3);
    for (const link of await perguntas.all()) {
      const destino = await link.getAttribute("href");
      expect(destino).toMatch(/^#[a-z]+$/);
      expect(capitulos.map(id => "#" + id)).toContain(destino);
      await expect(page.locator(`article${destino}`).getByRole("heading", { level: 3 })).toHaveCount(1);
    }

    // D-065/D-077: login existente, legais e Configurações são destinos internos aprovados.
    // O checkout continua planejado, sem destino comercial ou formulário.
    const destinos = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(destinos.length).toBeGreaterThan(0);
    expect(destinos.filter((href) => !href.startsWith("#"))).toEqual(["/entrar", "/privacidade", "/termos-de-servico", "/configuracoes"]);
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

  test("uma conta existente pode chegar ao login pelo teclado sem abrir inscrição", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/conheca");
    const entrar = page.getByRole("link", { name: "Já tem uma conta? Entrar", exact: true });
    await entrar.scrollIntoViewIfNeeded();
    await expect(entrar).toHaveAttribute("href", "/entrar");
    const tamanho = await entrar.boundingBox();
    expect(tamanho?.height).toBeGreaterThanOrEqual(44);
    await entrar.focus();
    await expect(entrar).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByRole("heading", { name: "Entrar", exact: true })).toBeVisible();
    await expect(page.locator("form")).toHaveCount(1);
  });

  for (const width of [320, 390]) {
    test(`o quadro mobile pede a variante de imagem para a largura real em ${width}px`, async ({ browser, baseURL }) => {
      const contexto = await browser.newContext({ baseURL, viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: "light" });
      try {
        const pagina = await contexto.newPage();
        const conferirOrigem = await abrirDemonstracao(pagina, baseURL, width, 900);
        const imagem = pagina.locator(".conheca-hero__tela img:visible");
        await expect.poll(() => imagem.evaluate((item) => (item as HTMLImageElement).complete && (item as HTMLImageElement).naturalWidth > 0)).toBe(true);
        const medida = await imagem.evaluate((item) => {
          const img = item as HTMLImageElement;
          const fonte = [...img.parentElement!.querySelectorAll("source")].find((source) => !source.media || window.matchMedia(source.media).matches);
          const candidatos = (fonte?.srcset ?? img.srcset).split(",").map((valor) => Number(valor.trim().match(/\s(\d+)w$/)?.[1])).filter((valor) => Number.isFinite(valor) && valor > 0).sort((a, b) => a - b);
          // The existing sizes contract follows the CSS border-box width.
          // clientWidth excludes the frame's borders; the transformed rect also
          // includes the preserved hero scale. Neither is that source size.
          const estilo = getComputedStyle(img);
          const largura = img.offsetWidth;
          const pixels = largura * window.devicePixelRatio;
          return {
            largura,
            larguraConteudo: img.clientWidth,
            bordas: Number.parseFloat(estilo.borderLeftWidth) + Number.parseFloat(estilo.borderRightWidth),
            larguraVisual: img.getBoundingClientRect().width,
            candidatos: candidatos.length,
            esperada: candidatos.find((valor) => valor >= pixels) ?? candidatos.at(-1),
            requisitada: Number(new URL(img.currentSrc).searchParams.get("w")),
          };
        });
        expect(medida.largura).toBe(Math.min(width - 40, 340));
        expect(Math.abs(medida.larguraConteudo + medida.bordas - medida.largura)).toBeLessThanOrEqual(0.5);
        expect(medida.larguraVisual).toBeGreaterThan(0);
        expect(medida.larguraVisual).toBeLessThanOrEqual(medida.largura + 0.5);
        expect(medida.candidatos).toBeGreaterThan(0);
        expect(medida.requisitada).toBe(medida.esperada);
        conferirOrigem();
      } finally {
        await contexto.close();
      }
    });
  }

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
    await secoes.getByRole("link", { name: "Recursos" }).click();
    await expect(page).toHaveURL(/#recursos$/);
    await expect(secoes.getByRole("link", { name: "Recursos" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Uma ideia não precisa ficar só na cabeça.", exact: true })).toBeInViewport();
  });

  test("teclado no celular alcança a primeira seção e retorna com Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/conheca");
    const abrir = page.getByRole("button", { name: "Abrir seções" });
    const perguntas = page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name: "Recursos", exact: true });

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
        return exibidas.length === 4 && exibidas.every((imagem) => (imagem as HTMLImageElement).complete && (imagem as HTMLImageElement).naturalWidth > 0);
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
    await expect(page.getByRole("heading", { name: "Do plano ao próximo passo." })).toBeAttached();
  });

  test("a pergunta fica parada enquanto a tela sobe até ela", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/conheca");
    const medir = (deslocamento: number) => page.evaluate((extra) => {
      const capitulo = document.getElementById("captura")!;
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

  test("sem JavaScript a apresentação mantém hero e prévia de Projetos legíveis no celular", async ({ browser, baseURL }, info) => {
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
      await pagina.getByRole("navigation", { name: "Conheça os recursos" }).locator('a[href="#projetos"]').click();
      await expect(pagina).toHaveURL(/\/conheca#projetos$/);
      await expect(pagina.locator("#projetos h3")).toBeInViewport();
      const projetos = pagina.getByRole("tab", { name: "Projetos", exact: true });
      await expect(projetos).toHaveAttribute("aria-selected", "true");
      const painel = pagina.getByRole("tabpanel", { name: "Projetos", exact: true });
      await expect(painel).toBeVisible(); await expect(pagina.locator("#conheca-preview-kanban-panel")).toBeHidden();
      const projeto = painel.locator("img:visible");
      await expect(projeto).toHaveCount(1); await projeto.scrollIntoViewIfNeeded();
      await expect.poll(() => projeto.evaluate(element => { const img = element as HTMLImageElement; return img.complete && img.naturalWidth > 0; })).toBe(true);
      expect(await projeto.evaluate(element => decodeURIComponent((element as HTMLImageElement).currentSrc))).toContain("projeto-celular-escuro");
      await expect(projeto).not.toHaveAttribute("alt", "");
      await expect(projeto).toBeInViewport();
      await pagina.screenshot({ path: info.outputPath("doc18-landing-v2-sem-js-projetos-390-dark.png") });
      expect(await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    } finally {
      await contexto.close();
    }
  });

  test.describe("coreografia responsiva", () => {
    test.use({ serviceWorkers: "block" });

    for (const width of [1024, 1440]) {
      for (const height of [600, 650, 700, 900]) {
        test(`coreografia dos três capítulos em ${width}x${height}`, async ({ page, baseURL }, info) => {
          await page.emulateMedia({ reducedMotion: "no-preference" });
          const conferirOrigem = await abrirDemonstracao(page, baseURL, width, height);
          await conferirCoreografia(page, height, true);
          if (width === 1024 && height === 600) await conferirKanbanParado(page, info.outputPath("doc18-landing-v2-kanban-1024x600-normal.png"));
          conferirOrigem();
        });
      }
    }

    for (const [width, height] of [[1024, 599], [1440, 599], [320, 600]] as const) {
      test(`fluxo livre dos três capítulos em ${width}x${height}`, async ({ page, baseURL }) => {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        const conferirOrigem = await abrirDemonstracao(page, baseURL, width, height);
        await conferirFluxoLivre(page);
        conferirOrigem();
      });
    }

    for (const [width, height] of [[1440, 600], [1440, 900], [1024, 600]] as const) {
      test(`movimento reduzido dos três capítulos em ${width}x${height}`, async ({ page, baseURL }, info) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const conferirOrigem = await abrirDemonstracao(page, baseURL, width, height);
        await conferirCoreografia(page, height, false);
        if (width === 1024) await conferirKanbanParado(page, info.outputPath("doc18-landing-v2-kanban-1024x600-reduced.png"));
        conferirOrigem();
      });
    }

    for (const width of [1440, 1024]) test(`fallback real da fonte mantém os três últimos fatos alcançáveis em ${width}x600`, async ({ page, baseURL }, info) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const conferirOrigem = await abrirDemonstracao(page, baseURL, width, 600, true);
      expect(await page.evaluate(() => Array.from(document.fonts).some((fonte) => fonte.family === "GeistSans" && fonte.status === "error"))).toBe(true);
      await conferirCoreografia(page, 600, true, false);
      if (width === 1024) await conferirKanbanParado(page, info.outputPath("doc18-landing-v2-kanban-1024x600-font-fallback.png"));
      conferirOrigem();
    });

    test("fallback e texto ampliado conservam o último fato após liberar o sticky em 1440x600", async ({ page, baseURL }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const conferirOrigem = await abrirDemonstracao(page, baseURL, 1440, 600, true);
      // A ampliação só no DOM do teste força texto alto sem depender de uma
      // fonte instalada no sistema nem modificar o CSS servido.
      await page.locator(".conheca-capitulo__texto .conheca-paragrafo, .conheca-capitulo__texto .conheca-fatos li").evaluateAll((itens) => {
        for (const item of itens) {
          (item as HTMLElement).style.fontSize = "28px";
          (item as HTMLElement).style.lineHeight = "56px";
        }
      });
      const altura = await page.locator("#captura .conheca-capitulo__texto").evaluate((item) => item.getBoundingClientRect().height);
      const geometria = await percurso(page, "captura");
      expect(altura).toBeGreaterThan(600 - geometria.fixo);
      await conferirCoreografia(page, 600, true, false);
      conferirOrigem();
    });
  });
});

for (const width of [320, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`prévia Projetos/Kanban tem tabs, foco e painel único em ${width}px ${theme}`, async ({ page, baseURL }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const conferirOrigem = await abrirDemonstracao(page, baseURL, width, 900);
    const tabs = page.getByRole("tablist", { name: "Prévia de Projetos e Kanban" });
    const projetos = tabs.getByRole("tab", { name: "Projetos", exact: true }), kanban = tabs.getByRole("tab", { name: "Kanban", exact: true });
    const painelProjetos = page.locator("#conheca-preview-projetos-panel"), painelKanban = page.locator("#conheca-preview-kanban-panel");
    const url = page.url();
    // Só prepara as imagens lazy dos mesmos três capítulos, sem novo percurso funcional.
    for (const id of capitulos) {
      const imagem = page.locator(`article#${id} img:visible`);
      await imagem.scrollIntoViewIfNeeded();
      await expect.poll(() => imagem.evaluate(element => { const img = element as HTMLImageElement; return img.complete && img.naturalWidth > 0; })).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`doc18-landing-v2-pagina-${width}-${theme}.png`), fullPage: true });
    await tabs.scrollIntoViewIfNeeded();
    await expect(projetos).toHaveAttribute("aria-selected", "true"); await expect(kanban).toHaveAttribute("tabindex", "-1");
    await expect(painelProjetos).toBeVisible(); await expect(painelKanban).toBeHidden();
    await projetos.focus(); await page.keyboard.press("ArrowRight");
    await expect(kanban).toBeFocused(); await expect(kanban).toHaveAttribute("aria-selected", "true");
    await expect(projetos).toHaveAttribute("aria-selected", "false"); await expect(painelProjetos).toBeHidden(); await expect(painelKanban).toBeVisible();
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    await page.keyboard.press("Tab"); await expect(painelKanban).toBeFocused();
    const imagem = painelKanban.locator("img:visible");
    await expect(imagem).toHaveCount(1);
    await expect.poll(() => imagem.evaluate(element => { const img = element as HTMLImageElement; return img.complete && img.naturalWidth > 0; })).toBe(true);
    const fonte = await imagem.evaluate(element => decodeURIComponent((element as HTMLImageElement).currentSrc));
    expect(fonte).toContain(width < 768 ? "tarefas-kanban-celular" : "tarefas-kanban");
    if (theme === "dark") expect(fonte).toContain("escuro"); else expect(fonte).not.toContain("escuro");
    await page.screenshot({ path: info.outputPath(`doc18-landing-v2-kanban-${width}-${theme}.png`), fullPage: true });
    await kanban.focus(); await page.keyboard.press("Home"); await expect(projetos).toBeFocused();
    await page.keyboard.press("End"); await expect(kanban).toBeFocused();
    await page.keyboard.press("ArrowRight"); await expect(projetos).toBeFocused();
    await page.keyboard.press("ArrowLeft"); await expect(kanban).toBeFocused();
    await projetos.click(); await expect(painelProjetos).toBeVisible(); await expect(painelKanban).toBeHidden();
    for (const tab of [projetos, kanban]) { const box = await tab.boundingBox(); expect(box?.width).toBeGreaterThanOrEqual(44); expect(box?.height).toBeGreaterThanOrEqual(44); }
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    conferirOrigem();
  });
}

test("os três atalhos da abertura chegam aos capítulos sem abrir rotas do app", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/conheca");
  const indice = page.getByRole("navigation", { name: "Conheça os recursos" });
  for (const id of capitulos) {
    const link = indice.locator(`a[href="#${id}"]`); await link.focus(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp("/conheca#" + id + "$"));
    await expect(page.locator(`article#${id} h3`)).toBeInViewport();
  }
  await expect(page.locator("form")).toHaveCount(0);
});
