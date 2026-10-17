// Evidências do layout Codex (issue #46) sobre um build de demonstração local.
// Pré-requisito: APP_MODE=demo npm run build && APP_MODE=demo npx next start --hostname 127.0.0.1 --port 3300
// Uso: node docs/implementation/layout-codex-ds21/capturar-evidencias.mjs [--base http://127.0.0.1:3300] [--out <pasta>] [--chromium <executável>]
// Gera capturas WebP comparáveis ao snapshot (1440×1000, 900, 390 e 320) e medidas
// renderizadas: contraste de texto no fundo efetivo, alvos, campos, zoom 200%,
// movimento reduzido e transbordo. Somente dados fictícios da demonstração.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const option = (name, fallback) => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : fallback; };
const base = option("--base", "http://127.0.0.1:3300");
const out = path.resolve(option("--out", path.join(root, "docs/implementation/layout-codex-ds21/capturas/aplicacao")));
const executablePath = option("--chromium", undefined);
const screens = [
  ["inicio", "/"], ["capturar", "/capturar"], ["tarefas", "/tarefas"], ["calendario", "/calendario"],
  ["conhecimento", "/conhecimento"], ["projetos", "/projetos"], ["habitos", "/habitos"], ["financeiro", "/financeiro"],
  ["cofre", "/cofre"], ["atividade", "/atividade"], ["integracoes", "/integracoes"], ["configuracoes", "/configuracoes"],
];

async function open(browser, { width, height, theme, sidebar, url, reducedMotion = "reduce", zoom = 1 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: zoom, colorScheme: theme, reducedMotion, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
  await context.addInitScript(([t, s]) => { try { localStorage.setItem("segundo-cerebro-theme", t); if (s) localStorage.setItem("segundo-cerebro-sidebar", s); } catch { /* demo */ } }, [theme, sidebar ?? null]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.allSettled(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity)).map((a) => a.finished)));
  return { context, page, errors };
}

async function webp(page, file, fullPage = true) {
  const png = await page.screenshot({ fullPage, animations: "disabled", caret: "hide" });
  await sharp(png).webp({ quality: 82 }).toFile(file);
}

/** Rendered measurements; independent from class names. */
function measure() {
  const parse = (value) => {
    let m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(value);
    if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, m[4] === undefined ? 1 : Number(m[4])];
    m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(value);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
    return null;
  };
  const over = (top, bottom) => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
  const lum = (c) => c.slice(0, 3).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || element.closest("[inert], [hidden], dialog:not([open])")) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      if (node.hasAttribute("popover") && !node.matches(":popover-open")) return false;
    }
    return true;
  };
  const background = (element) => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if (color && color[3] > 0) { layers.push(color); if (color[3] >= 1) break; }
    }
    let result = parse(getComputedStyle(document.body).backgroundColor) ?? [1, 1, 1, 1];
    for (const layer of layers.reverse()) result = over(layer, result);
    return result;
  };
  const text = [], seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const element = walker.currentNode.parentElement;
    if (!element || seen.has(element) || !walker.currentNode.textContent.trim() || !visible(element)) continue;
    if (element.closest("svg, [aria-hidden='true'], .skip-link, :disabled, [aria-disabled='true']")) continue;
    seen.add(element);
    const style = getComputedStyle(element), fg = parse(style.color);
    if (!fg) continue;
    const bg = background(element), value = ratio(over(fg, bg), bg);
    const size = parseFloat(style.fontSize), bold = Number(style.fontWeight) >= 700;
    const floor = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    text.push({ text: walker.currentNode.textContent.trim().slice(0, 40), ratio: Math.round(value * 100) / 100, floor, pass: value >= floor - 0.005 });
  }
  const targets = [...document.querySelectorAll("a[href], button, select, input:not([type=hidden]), [role=button], [role=tab], summary")]
    .filter((element) => visible(element) && !element.closest(".shell-main p a"))
    .map((element) => { const r = element.getBoundingClientRect(); return { name: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 30), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 }; })
    .filter((item) => item.width < 43.99 || item.height < 43.99);
  const fields = [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea, [contenteditable=true]")]
    .filter(visible).map((element) => parseFloat(getComputedStyle(element).fontSize)).filter((size) => size < 16);
  return {
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    textPairs: text.length, textFailures: text.filter((item) => !item.pass).slice(0, 20),
    minimumText: text.length ? Math.min(...text.map((item) => item.ratio)) : null,
    smallTargets: targets.slice(0, 20), smallTargetCount: targets.length, smallFields: fields.length,
  };
}

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const report = { base, generatedAt: new Date().toISOString(), screens: [], zoom200: [], reducedMotion: null, keyboard: null };
await mkdir(out, { recursive: true });
try {
  for (const [name, url] of screens) for (const theme of ["light", "dark"]) {
    const label = theme === "light" ? "claro" : "escuro";
    for (const [variant, width, height, sidebar] of [["expandida", 1440, 1000, "expanded"], ["900", 900, 1000, undefined], ["mobile-390", 390, 844, undefined]]) {
      if (variant !== "expandida" && !["inicio", "calendario", "tarefas", "habitos", "financeiro", "configuracoes"].includes(name)) continue;
      const session = await open(browser, { width, height, theme, sidebar, url });
      const result = await session.page.evaluate(measure);
      await webp(session.page, path.join(out, `${name}-${label}-${variant}.webp`));
      report.screens.push({ name, theme, variant, width, height, ...result, pageErrors: session.errors });
      await session.context.close();
    }
    if (["inicio", "calendario"].includes(name)) {
      const session = await open(browser, { width: 1440, height: 1000, theme, sidebar: "collapsed", url });
      await webp(session.page, path.join(out, `${name}-${label}-recolhida.webp`));
      report.screens.push({ name, theme, variant: "recolhida", width: 1440, height: 1000, ...(await session.page.evaluate(measure)), pageErrors: session.errors });
      await session.context.close();
    }
  }
  for (const [name, url] of [["inicio", "/"], ["menu", "/"]]) {
    const session = await open(browser, { width: 390, height: 844, theme: "light", url });
    if (name === "menu") { await session.page.getByRole("button", { name: "Abrir navegação" }).click(); await session.page.waitForTimeout(250); }
    await webp(session.page, path.join(out, `${name}-claro-mobile-390-viewport.webp`), false);
    await session.context.close();
  }
  for (const [name, url] of screens) {
    // 200% zoom on a 1440px window = 720 CSS px of layout width at 2× density.
    const session = await open(browser, { width: 720, height: 450, theme: "light", url, zoom: 2 });
    report.zoom200.push({ name, overflow: await session.page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)), pageErrors: session.errors });
    if (["inicio", "calendario"].includes(name)) await webp(session.page, path.join(out, `${name}-claro-zoom200.webp`), false);
    await session.context.close();
  }
  {
    const session = await open(browser, { width: 1440, height: 1000, theme: "light", url: "/capturar", reducedMotion: "reduce", sidebar: "expanded" });
    const durations = await session.page.evaluate(() => ({
      shell: getComputedStyle(document.querySelector(".workspace-shell")).transitionDuration,
      sidebar: getComputedStyle(document.querySelector("#shell-sidebar")).transitionDuration,
      dialog: getComputedStyle(document.querySelector(".ui-dialog") ?? document.body).transitionDuration,
    }));
    await session.page.getByRole("button", { name: "Recolher navegação" }).click();
    const collapsedAt = await session.page.evaluate(() => document.querySelector("#shell-sidebar").getBoundingClientRect().width);
    report.reducedMotion = { durations, sidebarWidthImmediatelyAfterToggle: collapsedAt };
    await session.context.close();
  }
  {
    const session = await open(browser, { width: 1440, height: 1000, theme: "light", url: "/", reducedMotion: "no-preference", sidebar: "expanded" });
    const order = [];
    for (let index = 0; index < 8; index += 1) {
      await session.page.keyboard.press("Tab");
      order.push(await session.page.evaluate(() => { const a = document.activeElement; return (a?.getAttribute("aria-label") ?? a?.textContent ?? "").trim().slice(0, 40); }));
    }
    await session.page.keyboard.press("Control+k");
    const searchFocused = await session.page.evaluate(() => document.activeElement?.getAttribute("role"));
    await session.page.keyboard.press("Escape");
    report.keyboard = { firstTabStops: order, ctrlKFocusRole: searchFocused, focusAfterEscape: await session.page.evaluate(() => document.activeElement?.tagName) };
    await session.context.close();
  }
} finally {
  await browser.close();
}
await writeFile(path.join(out, "medidas.json"), JSON.stringify(report, null, 2) + "\n");
const failures = report.screens.filter((item) => item.overflow || item.textFailures.length || item.smallTargetCount || item.smallFields || item.pageErrors.length);
console.log(JSON.stringify({ capturas: report.screens.length, comPendencias: failures.map((item) => `${item.name}-${item.theme}-${item.variant}: overflow ${item.overflow}, texto ${item.textFailures.length}, alvos ${item.smallTargetCount}, campos ${item.smallFields}, erros ${item.pageErrors.length}`), zoom200: report.zoom200.filter((item) => item.overflow), reducedMotion: report.reducedMotion, keyboard: report.keyboard }, null, 2));
