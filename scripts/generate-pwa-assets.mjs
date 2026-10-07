import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const tokens = JSON.parse(await readFile(new URL("design-system/tokens/tokens.json", root), "utf8"));
const assets = [];
const startupImages = [];
// OBSERVADO: the same historic brand geometry as BrandSymbol, no new artwork.
function symbol(theme) {
  const color = tokens.color[theme];
  return `<rect width="64" height="64" rx="16" fill="${color.accent}"/><path d="M18.5 20C18.5 15.858 21.858 12.5 26 12.5H35C41.627 12.5 47 17.873 47 24.5C47 28.253 45.245 31.791 42.255 34.056L21.5 49.5H47" fill="none" stroke="${color["accent-ink"]}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18.5" cy="20" r="3" fill="${color.accent}" stroke="${color["accent-ink"]}" stroke-width="1.5"/><circle cx="47" cy="49.5" r="3" fill="${color.accent}" stroke="${color["accent-ink"]}" stroke-width="1.5"/>`;
}
async function render(path, width, height, theme, symbolSize, background) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${background}"/><g transform="translate(${(width - symbolSize) / 2} ${(height - symbolSize) / 2}) scale(${symbolSize / 64})">${symbol(theme)}</g></svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const destination = new URL(`public${path}`, root);
  await mkdir(new URL("./", destination), { recursive: true });
  await writeFile(destination, buffer);
  assets.push({ path: `public${path}`, width, height, sha256: createHash("sha256").update(buffer).digest("hex") });
}
for (const size of [192, 512]) {
  await render(`/icons/icon-${size}.png`, size, size, "light", size * .8, tokens.color.light.canvas);
  // RECOMENDADO: whole symbol within the central 80% safe-zone circle.
  await render(`/icons/maskable-${size}.png`, size, size, "light", size * .56, tokens.color.light.accent);
}
await render("/icons/apple-touch-icon.png", 180, 180, "light", 144, tokens.color.light.canvas);

// CSS viewport / DPR classes, not a claim of testing those physical devices.
for (const [cssWidth, cssHeight, ratio] of [[320, 568, 2], [375, 667, 2], [390, 844, 3], [393, 852, 3], [414, 896, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3], [768, 1024, 2], [820, 1180, 2], [1024, 1366, 2]]) {
  for (const theme of ["light", "dark"]) {
    const width = cssWidth * ratio;
    const height = cssHeight * ratio;
    const path = `/splash/${width}x${height}-${theme}.png`;
    await render(path, width, height, theme, 80 * ratio, tokens.color[theme].canvas);
    startupImages.push({ url: path, media: `(device-width: ${cssWidth}px) and (device-height: ${cssHeight}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait) and (prefers-color-scheme: ${theme})` });
  }
}
await writeFile(new URL("design-system/pwa-assets.json", root), JSON.stringify({
  source: "Historic BrandSymbol geometry; colors from tokens.json. Reproduce with npm run pwa:assets.",
  generatedBy: "scripts/generate-pwa-assets.mjs (sharp pinned in package-lock.json)",
  assets, startupImages,
}, null, 2) + "\n");
process.stdout.write(`PWA: ${assets.length} deterministic brand assets generated in ${fileURLToPath(new URL("public/", root))}.\n`);
