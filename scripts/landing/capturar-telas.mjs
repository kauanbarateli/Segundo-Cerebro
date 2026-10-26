// Gera as telas reais usadas em /conheca a partir do modo demonstração.
//
// Pré-requisito: checkout limpo, APP_MODE=demo e o app servido localmente,
// sem variáveis privadas, por exemplo `npm run build` seguido de
// `npm run start -- --hostname 127.0.0.1 --port 3110`.
// Uso: APP_MODE=demo node scripts/landing/capturar-telas.mjs [--base http://127.0.0.1:3110] [--only projeto|galeria|entrada | --og]
// Entrada/Galeria e --og saem somente no HOME temporário supervisionado da CI.
// --og captura a primeira dobra de /conheca já construída, após atualizar Entrada.
//
// Cada cena sai em WebP nos temas claro e escuro (sufixo -escuro), na largura do
// computador em densidade 2 e na do celular (sufixo -celular) em densidade 3,
// como num telefone atual, com a origem gravada no EXIF e num registro lateral.
// O navegador só aceita GET no servidor loopback, sem API, WebSocket ou Service Worker.
// O processo que fornece o app deve ser demo, isolado e sem segredos; o CLI não inicia esse servidor.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { captureSdkPageErrorDiagnostic, pageErrorDiagnosticLine, publicNextChunk } from "./capture-pageerror-diagnostic.mjs";
import { captureSdkRequestFailedDiagnostic, requestFailedDiagnosticLine } from "./capture-requestfailed-diagnostic.mjs";
import {
  advanceCapturePageGate, assertCaptureSource, assertProjectRecords, assertProjectTarget, captureFile,
  captureHealthAfter, decideCaptureRequest, firstCaptureDiagnostic, initializeCaptureServiceWorkerPolicy, initializeDemoNavigationPolicy, initializeProjectPrefetchPolicy, parseCaptureOptions, projectPrefetchPolicyAbsent, projectReceipt, projectRoute,
  assertGalleryRecords, assertGalleryTarget, galleryExifDescription, galleryReadyInPage, galleryReceipt, galleryScenes, initializeGalleryPrefetchPolicy,
  assertEntryRecords, assertEntryTarget, entryExifDescription, entryPhoneClip, entryReadyInPage, entryReceipt, entryScenes, initializeEntryPrefetchPolicy,
} from "./capture-policy.mjs";
import { ogAltText, ogExifDescription, ogOriginPrompt, ogReadyInPage } from "./capture-og-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "src/components/features/conheca/telas");
const options = parseCaptureOptions(process.argv.slice(2));
const galleryOutput = options.mode === "galeria" ? path.join(process.env.HOME ?? "", "landing-gallery") : null;
const entryOutput = options.mode === "entrada" ? path.join(process.env.HOME ?? "", "landing-entry") : null;
const ogOutput = options.mode === "og" ? path.join(process.env.HOME ?? "", "landing-og") : null;
const isolatedOutput = galleryOutput ?? entryOutput ?? ogOutput;
const base = options.base;
const computador = { width: 1440, height: 900 };
const celular = { width: 390, height: 844 };
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const git = (...args) => execFileSync("git", ["-c", `safe.directory=${root}`, "-c", "gc.auto=0", ...args], {
  cwd: root, encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
}).trim();
const source = Object.freeze({
  ...assertCaptureSource({
    sha: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"),
    expectedSha: process.env.GITHUB_SHA, clean: git("status", "--porcelain=v1", "--untracked-files=normal") === "",
    mode: process.env.APP_MODE,
  }),
  generatorSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  policySha256: sha256(await readFile(new URL("./capture-policy.mjs", import.meta.url))),
});
const requestPolicy = {
  scope: "browser-capture", observed: 0, refused: 0, serviceWorkers: "block", webSockets: "deny",
  methods: ["GET"], origin: base,
};
const pageErrorModuleSha256 = sha256(await readFile(new URL("./capture-pageerror-diagnostic.mjs", import.meta.url)));
const requestFailedModuleSha256 = sha256(await readFile(new URL("./capture-requestfailed-diagnostic.mjs", import.meta.url)));
const ogModuleSha256 = sha256(await readFile(new URL("./capture-og-contract.mjs", import.meta.url)));
const records = [];
let ogSummary = null;
const contextStates = new WeakMap();
const extraPageClosures = [];
let captureFailures = 0;
let capturePhase = "opening";
let firstFatalDiagnostic = null;

function rememberCaptureFailure(observation) {
  const first = firstFatalDiagnostic === null;
  firstFatalDiagnostic = firstCaptureDiagnostic(firstFatalDiagnostic, observation, capturePhase);
  // At most three closed codes, once, on failure only. Never output error text.
  if (first) console.error(firstFatalDiagnostic.join("\n"));
}

function rememberOperationFailure(error) {
  rememberCaptureFailure({ kind: "operation", code: error instanceof Error ? error.message : undefined });
}

function refuseCapture(observation) {
  requestPolicy.refused++;
  rememberCaptureFailure(observation);
}

function observeCaptureHealth(observation) {
  const next = captureHealthAfter(captureFailures, observation);
  if (next > captureFailures) rememberCaptureFailure(observation);
  // Keep the receipt schema unchanged: refused also counts fatal capture faults.
  requestPolicy.refused += next - captureFailures;
  captureFailures = next;
}

function assertNoRefusedRequests() {
  if (requestPolicy.refused !== 0 || captureFailures !== 0) throw new Error("CAPTURE_REQUEST_REFUSED");
}

async function guardContext(context) {
  context.setDefaultTimeout(15_000);
  context.setDefaultNavigationTimeout(30_000);
  await context.addInitScript(initializeCaptureServiceWorkerPolicy, { expectedOrigin: base });
  if (options.mode === "projeto") await context.addInitScript(initializeProjectPrefetchPolicy, { expectedOrigin: base });
  if (options.mode === "galeria") await context.addInitScript(initializeGalleryPrefetchPolicy, { expectedOrigin: base });
  if (options.mode === "entrada") await context.addInitScript(initializeEntryPrefetchPolicy, { expectedOrigin: base });
  const state = { phase: "unused", owner: null };
  const publicChunks = new Set();
  contextStates.set(context, state);
  context.on("requestfailed", (request) => {
    const first = firstFatalDiagnostic === null;
    let resourceType = "other";
    try { resourceType = request.resourceType(); } catch { /* Fatal fault still recorded below. */ }
    observeCaptureHealth({ kind: "requestfailed", resourceType });
    // Supplemental only: ABORTED/RSC/prefetch never recover fatal health.
    if (first) console.error(requestFailedDiagnosticLine(captureSdkRequestFailedDiagnostic(request, base)));
  });
  context.on("response", (response) => {
    observeCaptureHealth({ kind: "http", status: response.status() });
    // Inventory only scripts already served by this exact local app. No new I/O.
    if (response.status() === 200 && response.request().method() === "GET" && response.request().resourceType() === "script") {
      const asset = publicNextChunk(response.url(), base);
      if (asset && publicChunks.size < 256) publicChunks.add(asset.path);
    }
  });
  context.on("page", (page) => {
    page.on("pageerror", (error) => {
      const first = firstFatalDiagnostic === null;
      observeCaptureHealth({ kind: "pageerror" });
      // Fatal state is recorded first. Only the first fatal PAGE_ERROR adds detail.
      if (first) console.error(pageErrorDiagnosticLine(captureSdkPageErrorDiagnostic(error, base, [...publicChunks])));
    });
    page.on("crash", () => observeCaptureHealth({ kind: "crash" }));
    if (["projeto", "galeria", "entrada", "og"].includes(options.mode)) page.on("download", async (download) => {
      refuseCapture({ kind: "download" });
      await download.cancel();
    });
    const admission = advanceCapturePageGate(state.phase, "page");
    state.phase = admission.state;
    if (admission.allowed) state.owner = page;
    else {
      observeCaptureHealth({ kind: "unexpectedPage" });
      extraPageClosures.push(page.close({ runBeforeUnload: false }).catch(() => observeCaptureHealth({ kind: "popupClose" })));
    }
  });
  await context.route("**/*", async (route) => {
    requestPolicy.observed++;
    const request = route.request();
    const decision = decideCaptureRequest({ url: request.url(), method: request.method() }, base);
    if (decision.allowed) await route.continue();
    else { refuseCapture({ kind: "policy", code: decision.code }); await route.abort("blockedbyclient"); }
  });
  // Must be registered before any page is opened; no socket is connected to a server.
  await context.routeWebSocket("**/*", async (socket) => {
    requestPolicy.observed++;
    refuseCapture({ kind: "websocket" });
    await socket.close({ code: 1008, reason: "capture-policy" });
  });
}

async function capturePage(context) {
  const state = contextStates.get(context);
  if (!state) throw new Error("CAPTURE_PAGE_GATE");
  state.phase = advanceCapturePageGate(state.phase, "request").state;
  capturePhase = "initial-document";
  const page = await context.newPage();
  if (state.owner !== page) {
    observeCaptureHealth({ kind: "unexpectedPage" });
    await page.close({ runBeforeUnload: false });
    throw new Error("CAPTURE_PAGE_GATE");
  }
  assertNoRefusedRequests();
  return page;
}

async function gotoCapture(page, url) {
  capturePhase = "navigation";
  return page.goto(url);
}

async function closeCaptureContext(context) {
  const previousPhase = capturePhase;
  capturePhase = "closing";
  try {
    return await context.close();
  } catch (error) {
    rememberOperationFailure(error);
    throw error;
  } finally {
    capturePhase = previousPhase;
  }
}

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
  if (capturePhase !== "mobile") capturePhase = "readiness";
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForFunction(() => document.querySelector(".shell-demo-label")?.textContent?.trim() === "Demonstração");
  await page.waitForFunction(() => !document.querySelector(".home-skeleton, .tasks-skeleton, .capture-loading, .vault-skeleton, .project-skeleton"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  assertNoRefusedRequests();
}

function projectReadyInPage() {
  // Source projects-workspace.tsx loads these sections independently of the title.
  if (document.querySelector(".projects-workspace [role='alert'], .project-message [role='alert']")) throw new Error("CAPTURE_PROJECT_ERROR");
  const workspace = document.querySelector(".projects-workspace");
  if (!workspace || document.querySelector(".project-skeleton, .project-section-skeleton")) return false;
  if (!workspace.querySelector("#project-title")?.textContent?.trim()) return false;
  const headings = [...workspace.querySelectorAll(".project-section h3")].map((heading) => heading.textContent?.trim());
  const expected = ["Tarefas", "Capturas", "Cadernos", "Agenda vinculada"];
  return headings.length === expected.length && expected.every((title) => headings.filter((heading) => heading === title).length === 1);
}

async function assertProjectReadyNow(page) {
  assertProjectTarget(page.url(), base);
  if (options.mode === "projeto" && !await page.evaluate(projectPrefetchPolicyAbsent)) throw new Error("CAPTURE_PROJECT_PREFETCH_POLICY");
  if (!await page.evaluate(projectReadyInPage)) throw new Error("CAPTURE_PROJECT_NOT_READY");
  assertNoRefusedRequests();
}

async function readyProject(page) {
  assertProjectTarget(page.url(), base);
  if (options.mode === "projeto" && !await page.evaluate(projectPrefetchPolicyAbsent)) throw new Error("CAPTURE_PROJECT_PREFETCH_POLICY");
  await ready(page);
  await page.waitForFunction(projectReadyInPage);
  await page.locator("#project-title").waitFor({ state: "visible" });
  await assertProjectReadyNow(page);
}

async function assertGalleryReadyNow(page, scene) {
  assertGalleryTarget(page.url(), base, scene);
  if (!await page.evaluate(projectPrefetchPolicyAbsent)) throw new Error("CAPTURE_PROJECT_PREFETCH_POLICY");
  if (!await page.evaluate(galleryReadyInPage, scene)) throw new Error("CAPTURE_GALLERY_NOT_READY");
  assertNoRefusedRequests();
}

async function readyGallery(page, scene) {
  assertGalleryTarget(page.url(), base, scene);
  if (!await page.evaluate(projectPrefetchPolicyAbsent)) throw new Error("CAPTURE_PROJECT_PREFETCH_POLICY");
  await ready(page);
  await page.waitForFunction(galleryReadyInPage, scene);
  await assertGalleryReadyNow(page, scene);
}

async function assertEntryReadyNow(page, scene) {
  assertEntryTarget(page.url(), base, scene);
  if (!await page.evaluate(projectPrefetchPolicyAbsent)) throw new Error("CAPTURE_PROJECT_PREFETCH_POLICY");
  if (!await page.evaluate(entryReadyInPage, scene)) throw new Error("CAPTURE_ENTRY_NOT_READY");
  assertNoRefusedRequests();
}

async function readyEntry(page, scene) {
  assertEntryTarget(page.url(), base, scene);
  if (!await page.evaluate(projectPrefetchPolicyAbsent)) throw new Error("CAPTURE_PROJECT_PREFETCH_POLICY");
  await ready(page);
  await page.waitForFunction(entryReadyInPage, scene);
  await assertEntryReadyNow(page, scene);
}

async function navigateEntry(page, scene) {
  const target = entryScenes.find(value => value.scene === scene);
  if (!target) throw new Error("CAPTURE_ENTRY_TARGET");
  // Start at the list, then let the real button perform the sole new-note
  // navigation. Loading ?capture=new first and clicking the same button issued
  // router.push to that same URL again and could start an unnecessary RSC fetch.
  await gotoCapture(page, base + (scene === "captura" ? "/capturar" : target.route));
  await ready(page);
  if (scene === "captura") {
    await Promise.all([
      page.waitForURL(base + target.route),
      page.getByRole("button", { name: "Nova nota", exact: true }).click(),
    ]);
    await page.locator(".capture-feature[data-mobile-editor='true'] section.capture-editor").waitFor({ state: "visible" });
  }
  assertEntryTarget(page.url(), base, scene);
  assertNoRefusedRequests();
}

// Avisos de confirmação e foco de campo são estados de transição, não a tela.
async function settle(page) {
  const dismiss = page.getByRole("button", { name: /^Dispensar aviso/ });
  for (let attempt = 0; attempt < 8 && await dismiss.count(); attempt++) await dismiss.first().click();
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.waitForTimeout(600);
}

// Registro lateral lido por `impeccable embed-prompt --scan`; o EXIF guarda o mesmo texto.
async function provenance(file, origin, capture) {
  const content = `${JSON.stringify({ prompt: origin, createdAt: new Date().toISOString(), capture }, null, 2)}\n`;
  await writeFile(`${file}.json`, content, isolatedOutput ? { flag: "wx" } : undefined);
  return { sidecarSha256: sha256(content), sidecarBytes: Buffer.byteLength(content) };
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
    const actualClip = { x: area.x + rolagem.x, y: area.y + rolagem.y, width: area.width, height: area.height };
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { ...actualClip, scale: 1 },
    });
    return { png: Buffer.from(data, "base64"), clip: actualClip };
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
  capturePhase = "mobile";
  await page.setViewportSize(celular);
  await page.waitForTimeout(300);
  if (new URL(page.url()).pathname === "/projetos") await readyProject(page);
  if (options.mode === "entrada") await page.evaluate(() => window.scrollTo({ left: 0, top: 0, behavior: "instant" }));
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
        if (elemento.contains(cartao) || cartao.contains(elemento) || elemento.closest("header.shell-topbar, nav")) continue;
        const caixa = elemento.getBoundingClientRect();
        if (caixa.height > 0 && caixa.bottom <= limite + 1) elemento.style.visibility = "hidden";
      }
    });
  }
  const header = await page.locator("header.shell-topbar").boundingBox();
  const bottom = await page.getByRole("navigation", { name: "Navegação no celular", exact: true }).boundingBox();
  if (!header || !bottom) throw new Error("Moldura do celular não encontrada.");
  if (options.mode === "entrada") return entryPhoneClip(header, bottom);
  return { x: 0, y: header.y, width: celular.width, height: bottom.y + bottom.height - header.y };
}

function sessionFor(browser, scheme) {
  return async () => {
    const context = await browser.newContext({
      viewport: computador, deviceScaleFactor: 2, colorScheme: scheme,
      reducedMotion: "reduce", locale: "pt-BR", timezoneId: "America/Sao_Paulo",
      acceptDownloads: !["projeto", "galeria", "entrada"].includes(options.mode), serviceWorkers: "block",
    });
    await guardContext(context);
    await context.addInitScript(initializeDemoNavigationPolicy, { expectedOrigin: new URL(base).origin, policy: navigationPolicy });
    return context;
  };
}

async function capturarTema(browser, scheme) {
  capturePhase = "opening";
  const tema = scheme === "dark" ? "tema escuro" : "tema claro";
  const open = sessionFor(browser, scheme);

  // Recortes de cartão usam coordenadas da página (rolagem no topo); os do celular, da janela.
  async function save(page, name, description, clip, { celular: telefone = false, scene = null } = {}) {
    assertNoRefusedRequests();
    const relativeFile = captureFile(options.mode, name, scheme);
    if (name.startsWith("projeto")) await assertProjectReadyNow(page);
    if (options.mode === "galeria") await assertGalleryReadyNow(page, scene);
    if (options.mode === "entrada") await assertEntryReadyNow(page, scene);
    capturePhase = telefone ? "mobile" : "pixels";
    const viewport = page.viewportSize();
    const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const screenshot = telefone ? await emDensidade3(page, clip) : {
      png: await page.screenshot(clip ? { clip, fullPage: true } : {}),
      clip: clip ?? { x: scroll.x, y: scroll.y, ...viewport },
    };
    const actualClip = screenshot.clip;
    // After taking pixels, waiting for a later recovery would mask a transient shot.
    if (name.startsWith("projeto")) await assertProjectReadyNow(page);
    if (options.mode === "galeria") await assertGalleryReadyNow(page, scene);
    if (options.mode === "entrada") await assertEntryReadyNow(page, scene);
    assertNoRefusedRequests();
    const file = path.join(galleryOutput ?? entryOutput ?? root, relativeFile);
    const exifDescription = options.mode === "galeria" ? galleryExifDescription(scene, scheme, telefone, source.sha)
      : options.mode === "entrada" ? entryExifDescription(scene, scheme, telefone, source.sha)
      : `Segundo Cérebro, captura real do modo demonstração: ${description}, ${tema}. Gerada por scripts/landing/capturar-telas.mjs.`;
    const encoder = sharp(screenshot.png)
      .webp({ quality: 86, effort: 6 })
      .withExif({ IFD0: { ImageDescription: exifDescription } });
    const encoded = options.mode === "entrada" ? await encoder.toBuffer({ resolveWithObject: true }) : null;
    const info = encoded ? encoded.info : await encoder.toFile(file);
    if (encoded) await writeFile(file, encoded.data, { flag: "wx" });
    const bitmap = encoded ? encoded.data : await readFile(file);
    if (options.mode === "galeria" || options.mode === "entrada") {
      const metadata = await sharp(bitmap).metadata();
      if (!metadata.exif?.includes(Buffer.from(exifDescription, "ascii"))) throw new Error(options.mode === "entrada" ? "CAPTURE_ENTRY_EXIF" : "CAPTURE_GALLERY_EXIF");
    }
    const url = new URL(page.url());
    const capture = {
      version: 1, source, mode: "demo", route: url.pathname + url.search,
      state: options.mode === "galeria" ? galleryScenes.find(value => value.scene === scene).state
        : options.mode === "entrada" ? entryScenes.find(value => value.scene === scene).state
        : name.startsWith("projeto") ? "project-detail-demo-neutralized" : "demo-neutralized",
      ...(["galeria", "entrada"].includes(options.mode) ? { scene } : {}),
      theme: scheme, viewport, density: telefone ? 3 : 2, clip: actualClip,
      pixels: { width: info.width, height: info.height }, sha256: sha256(bitmap),
    };
    const sidecar = await provenance(file, `Origem: captura real do Segundo Cérebro em modo demonstração, ${description}, ${tema}. Gerada por scripts/landing/capturar-telas.mjs.`, capture);
    if (["projeto", "galeria", "entrada"].includes(options.mode)) records.push({
      ...(["galeria", "entrada"].includes(options.mode) ? { scene } : {}),
      file: relativeFile, sha256: capture.sha256, bytes: bitmap.length,
      sidecar: `${relativeFile}.json`, ...sidecar, theme: scheme, viewport,
      density: capture.density, clip: actualClip, pixels: capture.pixels, route: capture.route,
    });
    console.log(path.basename(file));
  }

  if (options.mode === "entrada") {
    for (const { scene, fileStem } of entryScenes) {
      const context = await open();
      try {
        const page = await capturePage(context);
        await navigateEntry(page, scene);
        if (scene === "captura") {
          await page.getByLabel("Título da nota", { exact: true }).fill("Reforma da sala");
          await page.getByLabel("Sua anotação", { exact: true }).fill("Trocar a luminária e pintar a parede da janela.\n\nPedir orçamento ao marceneiro até sexta e conferir a paleta antes de comprar a tinta.\n\nMedidas da parede: 3,20 m × 2,60 m. Rodapé novo na mesma cor da porta.");
          await page.getByRole("button", { name: "Vincular nota", exact: true }).click();
          const linker = page.getByRole("dialog");
          await linker.getByLabel("Buscar nota para vincular", { exact: true }).fill("arquitetura");
          await linker.getByRole("button").filter({ hasText: "Decisões de arquitetura" }).first().click();
          await linker.waitFor({ state: "hidden" });
        }
        await settle(page);
        await page.evaluate(() => window.scrollTo({ left: 0, top: 0, behavior: "instant" }));
        await readyEntry(page, scene);
        await neutralize(page);
        await save(page, fileStem, scene === "inicio" ? "Início com foco, ritmo e projetos" : "biblioteca e editor de Capturar com nota e vínculo", undefined, { scene });
        // Keep the current document visible after mobile breakpoint changes.
        // No DOM is hidden and the new-note route is owned by the real UI.
        const clip = await phone(page);
        await readyEntry(page, scene);
        await neutralize(page);
        await save(page, `${fileStem}-celular`, scene === "inicio" ? "Início no celular" : "editor de Capturar no celular", clip, { celular: true, scene });
      } catch (error) {
        rememberOperationFailure(error);
        throw error;
      } finally { await closeCaptureContext(context); }
    }
    return;
  }

  if (options.mode === "galeria") {
    for (const { scene, route } of galleryScenes) {
      const context = await open();
      try {
        const page = await capturePage(context);
        await gotoCapture(page, base + route);
        await ready(page);
        if (scene === "tarefas-kanban") {
          await page.getByRole("group", { name: "Visualização de tarefas", exact: true }).getByRole("button", { name: "Kanban", exact: true }).click();
        }
        await readyGallery(page, scene);
        await neutralize(page);
        await save(page, scene, scene === "calendario-lista" ? "calendário em lista" : "tarefas em Kanban", undefined, { scene });
        const clip = await phone(page);
        await readyGallery(page, scene);
        await neutralize(page);
        await save(page, `${scene}-celular`, scene === "calendario-lista" ? "calendário em lista no celular" : "tarefas em Kanban no celular", clip, { celular: true, scene });
      } catch (error) {
        rememberOperationFailure(error);
        throw error;
      } finally { await closeCaptureContext(context); }
    }
    return;
  }

  if (options.mode === "projeto") {
    const context = await open();
    try {
      const page = await capturePage(context);
      await gotoCapture(page, base + projectRoute);
      await readyProject(page);
      await neutralize(page);
      await save(page, "projeto", "projeto reunindo tarefas, capturas e cadernos");
      await save(page, "projeto-celular", "projeto no celular com o progresso e as tarefas", await phone(page), { celular: true });
    } catch (error) {
      rememberOperationFailure(error);
      throw error;
    } finally {
      await closeCaptureContext(context);
    }
    return;
  }

  {
    const context = await open();
    const page = await capturePage(context);
    await gotoCapture(page, base + "/");
    await ready(page);
    await neutralize(page);
    await save(page, "inicio", "Início com foco, tarefas, agenda e hábitos do dia");
    await save(page, "inicio-celular", "Início no celular", await phone(page), { celular: true });
    await save(page, "inicio-celular-dia", "Início no celular com a agenda e os hábitos de hoje",
      await phone(page, page.getByRole("heading", { name: "Agenda de hoje", exact: true })), { celular: true });

    await page.setViewportSize(computador);
    await gotoCapture(page, base + "/financeiro");
    await ready(page);
    await neutralize(page);
    await save(page, "financeiro", "Financeiro com as despesas do mês por categoria",
      await around(page, [card(page, "Despesas por categoria")]));
    await save(page, "financeiro-celular", "Financeiro no celular com as despesas do mês por categoria",
      await phone(page, page.getByRole("heading", { name: "Despesas por categoria", exact: true })), { celular: true });

    await page.setViewportSize(computador);
    await gotoCapture(page, base + "/habitos");
    await ready(page);
    await neutralize(page);
    await save(page, "habitos", "Hábitos do dia com as sequências",
      await around(page, [card(page, "Hoje")]));
    await save(page, "habitos-celular", "Hábitos do dia no celular",
      await phone(page, page.getByRole("heading", { name: "Hoje", exact: true })), { celular: true });

    await page.setViewportSize(computador);
    await gotoCapture(page, base + projectRoute);
    await readyProject(page);
    await neutralize(page);
    await save(page, "projeto", "projeto reunindo tarefas, capturas e cadernos");
    await save(page, "projeto-celular", "projeto no celular com o progresso e as tarefas", await phone(page), { celular: true });

    // Escrever e vincular de verdade: o estado vem das ações do próprio editor.
    await page.setViewportSize({ width: computador.width, height: 1240 });
    await gotoCapture(page, base + "/capturar");
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
    await closeCaptureContext(context);
  }
  {
    // A busca encontra itens criados nesta mesma visita, em módulos diferentes.
    const context = await open();
    const page = await capturePage(context);
    await gotoCapture(page, base + "/capturar");
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
    await closeCaptureContext(context);
  }
  {
    // Cofre real em memória: senha de teste, kit em duas metades e itens cifrados.
    const context = await open();
    const page = await capturePage(context);
    const downloads = await mkdtemp(path.join(tmpdir(), "conheca-kit-"));
    try {
      await gotoCapture(page, base + "/cofre");
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
      await closeCaptureContext(context);
    }
  }
}

try {
if (isolatedOutput) {
  if (!path.isAbsolute(process.env.HOME ?? "") || process.env.CI !== "true" || tmpdir() !== process.env.HOME
    || await realpath(process.env.HOME) !== process.env.HOME) throw new Error("CAPTURE_OUTPUT_SCOPE");
  await mkdir(isolatedOutput, { recursive: false });
} else await mkdir(output, { recursive: true });
const browser = await chromium.launch();
let interrupted = false;
let closing;
const closeBrowser = () => (closing ??= browser.close());
const onInterrupt = () => {
  interrupted = true;
  rememberCaptureFailure({ kind: "interrupted" });
  capturePhase = "closing";
  // Closing the owned browser interrupts pending page operations; finally awaits it.
  void closeBrowser().catch(() => {});
};
process.on("SIGINT", onInterrupt);
process.on("SIGTERM", onInterrupt);
try {
  if (options.mode === "og") {
    // A primeira dobra real da apresentação vira a imagem de compartilhamento.
    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, colorScheme: "light",
      reducedMotion: "reduce", locale: "pt-BR", serviceWorkers: "block", acceptDownloads: false,
    });
    try {
      await guardContext(context);
      const page = await capturePage(context);
      // A página pública não tem o indicador de modo; confira-o antes no shell.
      await gotoCapture(page, base + "/");
      await ready(page);
      await gotoCapture(page, base + "/conheca");
      capturePhase = "readiness";
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo({ left: 0, top: 0, behavior: "instant" }));
      await page.waitForFunction(() => window.scrollX === 0 && window.scrollY === 0);
      await page.waitForFunction(ogReadyInPage);
      await page.waitForTimeout(400);
      if (!await page.evaluate(ogReadyInPage)) throw new Error("CAPTURE_OG_NOT_READY");
      assertNoRefusedRequests();
      const destino = ogOutput;
      const file = path.join(destino, "opengraph-image.png");
      capturePhase = "pixels";
      const { data: bitmap, info } = await sharp(await page.screenshot())
        .resize(1200, 630)
        .png({ compressionLevel: 9 })
        .withExif({ IFD0: { ImageDescription: ogExifDescription(source.sha) } })
        .toBuffer({ resolveWithObject: true });
      if (!await page.evaluate(ogReadyInPage) || !await page.evaluate(() => window.scrollX === 0 && window.scrollY === 0)) throw new Error("CAPTURE_OG_NOT_READY");
      assertNoRefusedRequests();
      await writeFile(file, bitmap, { flag: "wx" });
      const sidecar = await provenance(file, ogOriginPrompt, {
        version: 1, source, mode: "demo", route: "/conheca", state: "public-first-fold",
        theme: "light", viewport: { width: 1200, height: 630 }, density: 2,
        clip: { x: 0, y: 0, width: 1200, height: 630 },
        pixels: { width: info.width, height: info.height }, sha256: sha256(bitmap),
      });
      await writeFile(path.join(destino, "opengraph-image.alt.txt"), ogAltText, { flag: "wx" });
      console.log("opengraph-image.png");
      ogSummary = { ok: true, scene: "og", files: 3, source, imageSha256: sha256(bitmap), sidecarSha256: sidecar.sidecarSha256, altSha256: sha256(ogAltText) };
    } finally {
      await closeCaptureContext(context);
    }
  } else {
    await capturarTema(browser, "light");
    await capturarTema(browser, "dark");
  }
} catch (error) {
  rememberOperationFailure(error);
  throw error;
} finally {
  capturePhase = "closing";
  try {
    await closeBrowser();
  } finally {
    try {
      await Promise.all(extraPageClosures);
    } finally {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onInterrupt);
    }
  }
}
if (interrupted) throw new Error("CAPTURE_INTERRUPTED");
assertNoRefusedRequests();
if (git("rev-parse", "HEAD") !== source.sha || git("rev-parse", "HEAD^{tree}") !== source.tree
  || sha256(await readFile(fileURLToPath(import.meta.url))) !== source.generatorSha256
  || sha256(await readFile(new URL("./capture-policy.mjs", import.meta.url))) !== source.policySha256
  || sha256(await readFile(new URL("./capture-pageerror-diagnostic.mjs", import.meta.url))) !== pageErrorModuleSha256
  || sha256(await readFile(new URL("./capture-requestfailed-diagnostic.mjs", import.meta.url))) !== requestFailedModuleSha256
  || sha256(await readFile(new URL("./capture-og-contract.mjs", import.meta.url))) !== ogModuleSha256) throw new Error("CAPTURE_SOURCE_CHANGED");
if (options.mode === "og") {
  if (ogSummary === null) throw new Error("CAPTURE_OG_NOT_READY");
  console.log(JSON.stringify(ogSummary));
}
if (options.mode === "projeto") {
  assertProjectRecords(records);
  const receipt = {
    version: 1, scene: "projeto", mode: "demo", source,
    claims: { hostedValidated: false, productionValidated: false }, requestPolicy, records,
  };
  const file = path.join(root, projectReceipt);
  await mkdir(path.dirname(file), { recursive: true });
  assertNoRefusedRequests();
  await writeFile(file, `${JSON.stringify(receipt, null, 2)}\n`);
  assertNoRefusedRequests();
  console.log(JSON.stringify({ ok: true, scene: "projeto", files: records.length, receipt: projectReceipt }));
}
if (options.mode === "galeria") {
  assertGalleryRecords(records);
  const receipt = {
    version: 1, scene: "galeria", mode: "demo", source,
    claims: { hostedValidated: false, productionValidated: false }, requestPolicy, records,
  };
  assertNoRefusedRequests();
  await writeFile(path.join(galleryOutput, galleryReceipt), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  assertNoRefusedRequests();
  console.log(JSON.stringify({ ok: true, scene: "galeria", files: records.length, receipt: galleryReceipt }));
}
if (options.mode === "entrada") {
  assertEntryRecords(records);
  const receipt = {
    version: 1, scene: "entrada", mode: "demo", source,
    claims: { hostedValidated: false, productionValidated: false }, requestPolicy, records,
  };
  const content = `${JSON.stringify(receipt, null, 2)}\n`;
  assertNoRefusedRequests();
  await writeFile(path.join(entryOutput, entryReceipt), content, { flag: "wx" });
  assertNoRefusedRequests();
  console.log(JSON.stringify({ ok: true, scene: "entrada", files: records.length, receipt: entryReceipt, receiptSha256: sha256(content), source }));
}
} catch (error) {
  // Only an exact allowlisted code is retained; provider text/stack is discarded.
  rememberOperationFailure(error);
  process.exitCode = 1;
}
