// Gera as telas reais usadas em /conheca a partir do modo demonstração.
//
// Pré-requisito: o app em modo demo servido localmente, sem variáveis de
// ambiente, por exemplo `npm run build` seguido de
// `npm run start -- --hostname 127.0.0.1 --port 3110`.
// Uso: node scripts/landing/capturar-telas.mjs [--base http://127.0.0.1:3110] [--og]
// Com --og, gera apenas a imagem de compartilhamento a partir da /conheca já construída.
//
// Cada cena sai em WebP nos temas claro e escuro (sufixo -escuro), na largura do
// computador em densidade 2 e na do celular (sufixo -celular) em densidade 3,
// como num telefone atual, com a origem gravada no EXIF e num registro lateral. Nada aqui acessa serviços externos; os dados
// nascem e morrem na sessão de demonstração.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "src/components/features/conheca/telas");
const baseArgument = process.argv.indexOf("--base");
const base = baseArgument > 0 ? process.argv[baseArgument + 1] : "http://127.0.0.1:3110";
const computador = { width: 1440, height: 900 };
const celular = { width: 390, height: 844 };

// Drive saiu do MVP (D-032) e Integrações ainda é um aviso; o veto simulado da
// própria demonstração retira os dois da navegação, como faria um Entitlement.
const navigationPolicy = JSON.stringify({ version: 1, entitlements: { drive: false, integracoes: false }, preferences: {}, isAdmin: false });

// Os exemplos da demonstração citam marcas, clientes e jargão de desenvolvimento.
// A página pública troca apenas esses nomes; interface, valores e comportamento
// continuam os do app. A ordem importa: frases completas antes de trechos.
const neutralNames = [
  ["Revisar plano de milestones do V2", "Revisar checklist da mudança"],
  ["Enviar proposta Central T15", "Enviar proposta ao Estúdio Aurora"],
  ["Pagar fatura do cartão Nubank", "Pagar fatura do cartão"],
  ["Estudar RLS de moderação", "Estudar para a certificação"],
  ["Escrever spec do T-001", "Escrever relatório do trimestre"],
  ["Responder rodada 2", "Responder orçamento da transportadora"],
  ["Comprar ração do Canto", "Comprar ração do gato"],
  ["Reunião Central VOE", "Reunião com o Estúdio Aurora"],
  ["Daily Maestri", "Alinhamento da equipe"],
  ["Review plano V2", "Revisão da mudança"],
  ["Sprint M0", "Semana de entregas"],
  ["Decisões de arquitetura", "Paleta de cores"],
  ["Visão do produto", "Plano de estudos"],
  ["Financeiro fundido", "Metas do semestre"],
  ["Atalho de captura pelo relógio?", "Viagem de fim de ano?"],
  ["Livro: A Philosophy of Software Design", "Livro indicado pela Ana"],
  ["Operação e acompanhamento da Central.", "Projeto de identidade visual para um cliente."],
  ["Um lugar para capturar, conectar e organizar o dia.", "Caixas, contratos e prazos da mudança."],
  ["Segundo Cérebro V2", "Mudança de casa"],
  ["Central VOE", "Estúdio Aurora"],
  ["Maestri", "Trabalho"],
  ["Nubank", "Cartão de crédito"],
  ["Itaú", "Conta corrente"],
];

async function neutralize(page) {
  await page.evaluate((pairs) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      let text = node.nodeValue ?? "";
      for (const [from, to] of pairs) text = text.split(from).join(to);
      if (text !== node.nodeValue) node.nodeValue = text;
    }
    // A foto ilustrativa da demonstração não tem origem documentada para uso
    // público; a captura mostra o mesmo estado de uma conta sem foto.
    for (const image of document.querySelectorAll("header img")) {
      const holder = image.parentElement;
      if (!holder) continue;
      holder.innerHTML = "<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/></svg>";
    }
  }, neutralNames);
}

async function ready(page) {
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForFunction(() => !document.querySelector(".home-skeleton, .tasks-skeleton, .capture-loading, .vault-skeleton"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

// Avisos de confirmação e foco de campo são estados de transição, não a tela.
async function settle(page) {
  const dismiss = page.getByRole("button", { name: /^Dispensar aviso/ });
  for (let attempt = 0; attempt < 8 && await dismiss.count(); attempt++) await dismiss.first().click();
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.waitForTimeout(600);
}

// Registro lateral lido por `impeccable embed-prompt --scan`; o EXIF guarda o mesmo texto.
async function provenance(file, origin) {
  await writeFile(`${file}.json`, `${JSON.stringify({ prompt: origin, createdAt: new Date().toISOString() }, null, 2)}\n`);
}

// Recorte em coordenadas da página: a união dos elementos que respondem à pergunta.
async function around(page, locators, margin = 12) {
  const boxes = [];
  for (const locator of locators) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("Elemento da captura não encontrado.");
    boxes.push(box);
  }
  const left = Math.max(0, Math.min(...boxes.map((box) => box.x)) - margin);
  const top = Math.max(0, Math.min(...boxes.map((box) => box.y)) - margin);
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + margin;
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) + margin;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const card = (page, heading) => page.getByRole("heading", { name: heading, exact: true })
  .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ui-card ') or contains(concat(' ', normalize-space(@class), ' '), ' finance-card ')][1]");

// O contexto nasce em densidade 2 e o Playwright normaliza as capturas a ela. A tela
// do celular sai em densidade 3 direto pelo protocolo do Chrome, só durante a captura.
async function emDensidade3(page, clip) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: celular.width, height: celular.height, deviceScaleFactor: 3, mobile: false });
    await page.waitForTimeout(400);
    const rolagem = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const area = clip ?? { x: 0, y: 0, width: celular.width, height: celular.height };
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { x: area.x + rolagem.x, y: area.y + rolagem.y, width: area.width, height: area.height, scale: 1 },
    });
    return Buffer.from(data, "base64");
  } finally {
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await cdp.detach();
    // Sem a sessão, a página volta ao tamanho da janela e o Playwright não reaplica
    // um tamanho que já considera vigente; mudar e voltar restaura a emulação dele.
    const tamanho = page.viewportSize();
    await page.setViewportSize({ width: tamanho.width + 1, height: tamanho.height });
    await page.setViewportSize(tamanho);
  }
}

/** A tela do celular vai do topo do cabeçalho à base da barra inferior, sem o que rola por trás deles. */
async function phone(page, scrollTo) {
  await page.setViewportSize(celular);
  await page.waitForTimeout(300);
  if (scrollTo) {
    const box = await scrollTo.boundingBox();
    if (!box) throw new Error("Elemento da tela de celular não encontrado.");
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), Math.max(0, box.y - 112));
    await page.waitForTimeout(300);
    // O que já rolou para trás do cabeçalho flutuante aparecia em fragmentos nas
    // bordas dele. Fica invisível sem sair do lugar: a tela para no cartão.
    await scrollTo.evaluate((alvo) => {
      const cartao = alvo.closest(".ui-card, .finance-card, section, article") ?? alvo;
      const limite = cartao.getBoundingClientRect().top;
      const conteudo = document.querySelector("main") ?? document.body;
      for (const elemento of conteudo.querySelectorAll("*")) {
        if (elemento.contains(cartao) || cartao.contains(elemento) || elemento.closest("header.shell-header, nav")) continue;
        const caixa = elemento.getBoundingClientRect();
        if (caixa.height > 0 && caixa.bottom <= limite + 1) elemento.style.visibility = "hidden";
      }
    });
  }
  const header = await page.locator("header.shell-header").boundingBox();
  const bottom = await page.getByRole("navigation", { name: "Navegação no celular", exact: true }).boundingBox();
  if (!header || !bottom) throw new Error("Moldura do celular não encontrada.");
  return { x: 0, y: header.y, width: celular.width, height: bottom.y + bottom.height - header.y };
}

function sessionFor(browser, scheme) {
  return async () => {
    const context = await browser.newContext({
      viewport: computador, deviceScaleFactor: 2, colorScheme: scheme,
      reducedMotion: "reduce", locale: "pt-BR", timezoneId: "America/Sao_Paulo", acceptDownloads: true,
    });
    await context.addInitScript((policy) => sessionStorage.setItem("segundo-cerebro-demo-navigation-v1", policy), navigationPolicy);
    return context;
  };
}

async function capturarTema(browser, scheme) {
  const sufixo = scheme === "dark" ? "-escuro" : "";
  const tema = scheme === "dark" ? "tema escuro" : "tema claro";
  const open = sessionFor(browser, scheme);

  // Recortes de cartão usam coordenadas da página (rolagem no topo); os do celular, da janela.
  async function save(page, name, description, clip, { celular: telefone = false } = {}) {
    const png = telefone ? await emDensidade3(page, clip) : await page.screenshot(clip ? { clip, fullPage: true } : {});
    const file = path.join(output, `${name}${sufixo}.webp`);
    await sharp(png)
      .webp({ quality: 86, effort: 6 })
      .withExif({ IFD0: { ImageDescription: `Segundo Cérebro, captura real do modo demonstração: ${description}, ${tema}. Gerada por scripts/landing/capturar-telas.mjs.` } })
      .toFile(file);
    await provenance(file, `Origem: captura real do Segundo Cérebro em modo demonstração, ${description}, ${tema}. Gerada por scripts/landing/capturar-telas.mjs.`);
    console.log(path.basename(file));
  }

  {
    const context = await open();
    const page = await context.newPage();
    await page.goto(base + "/");
    await ready(page);
    await neutralize(page);
    await save(page, "inicio", "Início com foco, tarefas, agenda e hábitos do dia");
    await save(page, "inicio-celular", "Início no celular", await phone(page), { celular: true });
    await save(page, "inicio-celular-dia", "Início no celular com a agenda e os hábitos de hoje",
      await phone(page, page.getByRole("heading", { name: "Agenda de hoje", exact: true })), { celular: true });

    await page.setViewportSize(computador);
    await page.goto(base + "/financeiro");
    await ready(page);
    await neutralize(page);
    await save(page, "financeiro", "Financeiro com as despesas do mês por categoria",
      await around(page, [card(page, "Despesas por categoria")]));
    await save(page, "financeiro-celular", "Financeiro no celular com as despesas do mês por categoria",
      await phone(page, page.getByRole("heading", { name: "Despesas por categoria", exact: true })), { celular: true });

    await page.setViewportSize(computador);
    await page.goto(base + "/habitos");
    await ready(page);
    await neutralize(page);
    await save(page, "habitos", "Hábitos do dia com as sequências",
      await around(page, [card(page, "Hoje")]));
    await save(page, "habitos-celular", "Hábitos do dia no celular",
      await phone(page, page.getByRole("heading", { name: "Hoje", exact: true })), { celular: true });

    await page.setViewportSize(computador);
    await page.goto(base + "/projetos?project=project-sc-v2");
    await ready(page);
    await neutralize(page);
    await save(page, "projeto", "projeto reunindo tarefas, capturas e cadernos");
    await save(page, "projeto-celular", "projeto no celular com o progresso e as tarefas", await phone(page), { celular: true });

    // Escrever e vincular de verdade: o estado vem das ações do próprio editor.
    await page.setViewportSize({ width: computador.width, height: 1240 });
    await page.goto(base + "/capturar");
    await ready(page);
    await page.getByLabel("Título da nota", { exact: true }).fill("Reforma da sala");
    await page.getByLabel("Sua anotação", { exact: true }).fill("Trocar a luminária e pintar a parede da janela.\n\nPedir orçamento ao marceneiro até sexta e conferir a paleta antes de comprar a tinta.\n\nMedidas da parede: 3,20 m × 2,60 m. Rodapé novo na mesma cor da porta.");
    await page.getByRole("button", { name: "Vincular nota", exact: true }).click();
    const linker = page.getByRole("dialog");
    await linker.getByLabel("Buscar nota para vincular", { exact: true }).fill("arquitetura");
    await linker.getByRole("button").filter({ hasText: "Decisões de arquitetura" }).first().click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await settle(page);
    await neutralize(page);
    await save(page, "capturar", "editor de Capturar com uma nota em escrita e um vínculo",
      await around(page, [page.locator("section.capture-editor")]));
    await save(page, "capturar-celular", "Capturar no celular com uma nota em escrita",
      await phone(page, page.getByLabel("Título da nota", { exact: true })), { celular: true });
    await context.close();
  }
  {
    // A busca encontra itens criados nesta mesma visita, em módulos diferentes.
    const context = await open();
    const page = await context.newPage();
    await page.goto(base + "/capturar");
    await ready(page);
    await page.getByLabel("Título da nota", { exact: true }).fill("Reforma da sala");
    await page.getByLabel("Sua anotação", { exact: true }).fill("Trocar a luminária e pintar a parede da janela.");
    await page.getByRole("button", { name: "Salvar nota", exact: true }).click();
    await page.getByText("1 conexão", { exact: false }).or(page.getByText("Reforma da sala").nth(1)).first().waitFor();
    await page.keyboard.press("Control+K");
    let palette = page.getByRole("dialog", { name: "Buscar", exact: true });
    await palette.getByRole("option", { name: "Nova tarefa", exact: true }).click();
    const task = page.getByRole("dialog", { name: "Nova tarefa", exact: true });
    await task.getByLabel("Título", { exact: true }).fill("Comprar luminária da sala");
    await task.getByRole("button", { name: "Criar tarefa", exact: true }).click();
    await task.waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Projetos", exact: true }).first().click();
    await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
    const project = page.getByRole("dialog", { name: "Novo projeto", exact: true });
    await project.getByLabel("Nome do projeto", { exact: true }).fill("Reforma da sala");
    await project.getByRole("button", { name: "Criar projeto", exact: true }).click();
    await project.waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Início", exact: true }).first().click();
    await ready(page);
    await settle(page);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const search = async () => {
      await page.keyboard.press("Control+K");
      palette = page.getByRole("dialog", { name: "Buscar", exact: true });
      await palette.getByRole("combobox").or(palette.getByRole("searchbox")).or(palette.getByRole("textbox")).first().fill("sala");
      await palette.getByText("Tarefas", { exact: true }).first().waitFor();
      await page.waitForTimeout(400);
      await neutralize(page);
    };
    await search();
    // O assunto é o diálogo; o recorte segue a caixa dele, sem fragmentos ao redor.
    await save(page, "busca", "busca com resultados de capturas, tarefas e projetos", await around(page, [palette], 0));
    await page.keyboard.press("Escape");
    await palette.waitFor({ state: "hidden" });
    await page.setViewportSize(celular);
    await page.waitForTimeout(300);
    await search();
    await save(page, "busca-celular", "busca no celular com resultados de capturas, tarefas e projetos", undefined, { celular: true });
    await context.close();
  }
  {
    // Cofre real em memória: senha de teste, kit em duas metades e itens cifrados.
    const context = await open();
    const page = await context.newPage();
    const downloads = await mkdtemp(path.join(tmpdir(), "conheca-kit-"));
    try {
      await page.goto(base + "/cofre");
      await ready(page);
      const demoSecret = "fixture-demonstracao-landing-2026";
      await page.getByLabel("Senha mestra", { exact: true }).fill(demoSecret);
      await page.getByLabel("Confirmar senha mestra", { exact: true }).fill(demoSecret);
      await page.getByRole("checkbox").click();
      await page.getByRole("button", { name: "Preparar Cofre e kit", exact: true }).click();
      const halves = [];
      for (const half of ["A", "B"]) {
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Baixar metade " + half, exact: true }).click();
        const file = path.join(downloads, `kit-${half}.txt`);
        await (await download).saveAs(file);
        halves.push(file);
      }
      await page.getByLabel("Arquivo da metade A", { exact: true }).setInputFiles(halves[0]);
      await page.getByLabel("Arquivo da metade B", { exact: true }).setInputFiles(halves[1]);
      await page.getByRole("button", { name: "Provar kit e criar Cofre", exact: true }).click();
      await page.getByRole("heading", { name: "Cofre desbloqueado" }).waitFor({ timeout: 60_000 });
      const items = [
        ["login", "Banco · conta corrente", "pessoa@exemplo.invalid"],
        ["login", "Wi-Fi de casa", "rede-casa"],
        ["note", "Documentos do apartamento", null],
      ];
      for (const [kind, title, user] of items) {
        await page.getByRole("button", { name: "Novo item", exact: true }).click();
        const editor = page.getByRole("dialog");
        if (kind === "note") await editor.getByLabel("Tipo do item", { exact: true }).selectOption({ label: "Nota segura" });
        await editor.getByLabel("Título do item", { exact: true }).fill(title);
        if (kind === "login") {
          await editor.getByLabel("Usuário do login", { exact: true }).fill(user);
          await editor.getByLabel("Senha do item", { exact: true }).fill(`demo-${title.length}-item-fixture`);
        } else {
          await editor.getByLabel("Nota privada", { exact: true }).fill("Matrícula e escritura na pasta azul.");
        }
        await editor.getByRole("button", { name: "Salvar item cifrado", exact: true }).click();
        await editor.waitFor({ state: "hidden" });
      }
      await settle(page);
      await neutralize(page);
      await save(page, "cofre", "Cofre desbloqueado com itens cifrados no navegador",
        await around(page, [card(page, "Cofre desbloqueado")]));
      await save(page, "cofre-celular", "Cofre desbloqueado no celular",
        await phone(page, page.getByRole("heading", { name: "Cofre desbloqueado" })), { celular: true });
    } finally {
      await rm(downloads, { recursive: true, force: true });
      await context.close();
    }
  }
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  if (process.argv.includes("--og")) {
    // A primeira dobra real da apresentação vira a imagem de compartilhamento.
    const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce", locale: "pt-BR" });
    const page = await context.newPage();
    await page.goto(base + "/conheca");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const destino = path.join(root, "src/app/conheca");
    await sharp(await page.screenshot())
      .resize(1200, 630)
      .png({ compressionLevel: 9 })
      .withExif({ IFD0: { ImageDescription: "Segundo Cérebro, captura real da primeira dobra de /conheca. Gerada por scripts/landing/capturar-telas.mjs --og." } })
      .toFile(path.join(destino, "opengraph-image.png"));
    await provenance(path.join(destino, "opengraph-image.png"), "Origem: captura real da primeira dobra de /conheca, tema claro. Gerada por scripts/landing/capturar-telas.mjs --og.");
    await writeFile(path.join(destino, "opengraph-image.alt.txt"), "Segundo Cérebro: capture agora, encontre depois. Notas, tarefas, agenda, hábitos, finanças e senhas num só lugar.");
    console.log("opengraph-image.png");
    await context.close();
  } else {
    await capturarTema(browser, "light");
    await capturarTema(browser, "dark");
  }
} finally {
  await browser.close();
}
