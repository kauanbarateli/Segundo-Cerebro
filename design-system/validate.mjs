import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderTokensCss, tokensDirectory } from "./generate.mjs";

export { renderTokensCss } from "./generate.mjs";
export const backgrounds = ["canvas", "surface", "surface-muted", "surface-hover"];
export const textColors = ["ink", "ink-muted", "ink-subtle", "success-ink", "danger-ink", "warning-ink", "info-ink", "work-ink", "personal-ink", "fin-ink"];
const semantics = ["success", "danger", "warning", "info", "work", "personal", "fin"];
const categories = ["stone", "indigo", "ciano", "teal", "oliva", "terracota", "rosa", "violeta"];
const colors = [...backgrounds, ...textColors, ...semantics, ...categories.map((name) => `cat-${name}`), "line", "line-strong", "accent", "accent-ink", "surface-inverse", "ink-inverse", "inverse-muted", "disabled", "disabled-bg", "glass-fallback"];
const roles = ["display", "h2", "h3", "corpo-forte", "corpo", "dado", "legenda", "micro", "campo", "editor"];
const hex = /^#[\da-f]{6}$/i;
// CSS named colors, including grey aliases and rebeccapurple. No runtime dependency.
const namedColors = new Set(`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(" "));

function meetsPixelFloor(value, minimum) {
  // These accessibility floors must be resolved literal px, not an unresolved expression.
  if (typeof value !== "string" || !/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value)) return false;
  const pixels = Number(value.slice(0, -2));
  return Number.isFinite(pixels) && pixels >= minimum;
}

function channels(value) {
  if (!hex.test(value)) throw new Error(`Cor inválida: ${value}; esperado #rrggbb.`);
  return value.slice(1).match(/../g).map((channel) => parseInt(channel, 16));
}

function luminance(color) {
  const values = channels(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

export function contrastRatio(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function composite(rgba, background) {
  const match = /^rgba\((\d+),(\d+),(\d+),(0?\.\d+|1)\)$/.exec(rgba);
  if (!match) throw new Error(`Vidro inválido: ${rgba}.`);
  const alpha = Number(match[4]);
  return `#${channels(background).map((base, index) => Math.round(Number(match[index + 1]) * alpha + base * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
}

export function measureContrasts(tokens) {
  const measurements = [];
  for (const theme of ["light", "dark"]) {
    const palette = tokens.color[theme];
    const record = (foreground, background, floor, target = palette[background]) => measurements.push({ theme, foreground, background, floor, ratio: contrastRatio(palette[foreground], target) });
    for (const background of backgrounds) {
      for (const foreground of textColors) record(foreground, background, 4.5);
      for (const category of categories) record(`cat-${category}`, background, 3);
    }
    record("accent-ink", "accent", 4.5);
    record("ink-inverse", "surface-inverse", 4.5);
    record("inverse-muted", "surface-inverse", 4.5);
    // Alpha extrema bound any sRGB backing surface; glass only carries primary ink.
    for (const backdrop of ["#000000", "#ffffff", ...backgrounds.map((name) => palette[name])]) {
      record("ink", `glass over ${backdrop}`, 4.5, composite(palette["glass-surface"], backdrop));
    }
    record("ink", "glass-fallback", 4.5);
  }
  return measurements;
}

/** Validates complete dataset, generated CSS and unrounded WCAG AA ratios. */
export function validateTokens(tokens, css) {
  const failures = [];
  for (const theme of ["light", "dark"]) {
    for (const name of colors) {
      if (!hex.test(tokens.color?.[theme]?.[name] ?? "")) failures.push(`token ausente/inválido: color.${theme}.${name}`);
    }
    for (const name of ["glass-surface", "glass-border"]) {
      try { composite(tokens.color?.[theme]?.[name], "#000000"); } catch { failures.push(`token ausente/inválido: color.${theme}.${name}`); }
    }
  }
  for (const role of roles) {
    const value = tokens.typography?.scale?.[role];
    if (!value?.fontSize || !value?.lineHeight || !value?.fontWeight || !value?.letterSpacing || !["OBSERVADO", "INFERIDO", "RECOMENDADO"].includes(value?.status)) failures.push(`papel tipográfico incompleto: ${role}`);
  }
  for (const role of ["campo", "editor"]) {
    if (!meetsPixelFloor(tokens.typography?.scale?.[role]?.fontSize, 16)) failures.push(`${role}: tamanho inválido ou abaixo do piso de 16px (use px finito)`);
  }
  if (!meetsPixelFloor(tokens.control?.target, 44)) failures.push("alvo: tamanho inválido ou abaixo do piso de 44px (use px finito)");
  for (const [name, expected] of Object.entries({ xs: "4px", sm: "8px", md: "12px", lg: "20px", xl: "28px", "2xl": "36px", full: "9999px" })) {
    if (tokens.radius?.[name] !== expected) failures.push(`raio DS 2.1 inválido: ${name}`);
  }
  if (!tokens.spacing || !tokens.motion || !tokens.zIndex || !tokens.shadow?.light || !tokens.shadow?.dark) failures.push("grupo de tokens estrutural ausente");
  if (failures.length) return { failures, measurements: [] };

  const measurements = measureContrasts(tokens);
  for (const item of measurements) {
    if (item.ratio < item.floor) failures.push(`contraste abaixo de ${item.floor}:1: ${item.theme}.${item.foreground}/${item.background} = ${item.ratio.toFixed(3)}:1`);
  }
  if (css.replace(/\r\n/g, "\n") !== renderTokensCss(tokens)) failures.push("divergência JSON/CSS: execute node design-system/generate.mjs e revise o resultado");
  return { failures, measurements };
}

/** Source guard complements Tailwind's disabled default color/type palettes. */
export function findRawValues(source) {
  const cleaned = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const patterns = [
    /#[\da-f]{3,8}\b/gi,
    /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*(?:[-+.\d]|srgb\b|display-p3\b)/gi,
    /\b(?:text|bg|border|ring|fill|stroke)-(?:black|white|red|blue|green|yellow|orange|purple|pink|gray|slate|zinc|neutral|stone|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose)(?:-\d+)?\b/g,
    /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g,
  ];
  const findings = patterns.flatMap((pattern) => [...cleaned.matchAll(pattern)].map((match) => match[0]));
  // Match color-bearing CSS declarations and React/SVG properties, including shorthand.
  const declaration = /(?<![\w-])(["']?)([a-z-]*color|background[a-z-]*|border[a-z-]*|outline[a-z-]*|box-?shadow|text-?shadow|fill|stroke|column-?rule|text-?decoration)\1\s*[:=]\s*(?:(["'])([\s\S]*?)\3|([^;\n}]*))/gi;
  for (const match of cleaned.matchAll(declaration)) {
    const value = (match[4] ?? match[5]).replace(/url\([^)]*\)/gi, "").replace(/--[\w-]+/g, "");
    for (const word of value.match(/[a-z][a-z-]*/gi) ?? []) {
      if (namedColors.has(word.toLowerCase())) findings.push(`${match[2]}: ${word}`);
    }
  }
  return [...new Set(findings)];
}

async function walk(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}

export async function validateRuntime(projectRoot) {
  const failures = [];
  const manifest = JSON.parse(await readFile(path.join(projectRoot, "design-system/brand-manifest.json"), "utf8"));
  const exceptions = new Map(manifest.assets.map((asset) => [asset.path, asset.sha256]));
  const files = [...await walk(path.join(projectRoot, "src")), ...await walk(path.join(projectRoot, "public"))];
  for (const file of files.filter((file) => /\.(?:css|scss|[cm]?[jt]sx?|svg)$/.test(file))) {
    const name = path.relative(projectRoot, file).split(path.sep).join("/");
    const source = await readFile(file, "utf8");
    if (exceptions.has(name)) {
      const hash = createHash("sha256").update(source.replace(/\r\n/g, "\n")).digest("hex");
      if (hash !== exceptions.get(name)) failures.push(`asset de marca divergiu do manifesto: ${name}`);
      exceptions.delete(name);
      continue;
    }
    for (const value of findRawValues(source)) failures.push(`valor cru fora dos tokens: ${name}: ${value}`);
  }
  for (const name of exceptions.keys()) failures.push(`asset de marca ausente: ${name}`);
  return failures;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const tokens = JSON.parse(await readFile(path.join(tokensDirectory, "tokens.json"), "utf8"));
    const css = await readFile(path.join(tokensDirectory, "tokens.css"), "utf8");
    const result = validateTokens(tokens, css);
    result.failures.push(...await validateRuntime(path.dirname(path.dirname(tokensDirectory))));
    if (result.failures.length) {
      console.error(result.failures.map((failure) => `- ${failure}`).join("\n"));
      process.exitCode = 1;
    } else console.log(`DS 2.1: JSON/CSS coerentes; ${result.measurements.length} pares de contraste aprovados; runtime usa tokens; marca íntegra.`);
  } catch (error) {
    console.error(`Falha no design system: ${error.message}`);
    process.exitCode = 1;
  }
}
