// Pure contract only: importing this module does not read files, start a process,
// open a browser or authorize a capture. The owned CI supervisor supplies bytes.
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

const image = "src/app/conheca/opengraph-image.png";
const sourceKeys = ["sha", "tree", "generatorSha256", "policySha256"];
const sha = /^[a-f0-9]{40}$/u, digest = /^[a-f0-9]{64}$/u;
const need = (condition, code) => { if (!condition) throw new Error(code); };
const exact = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const same = (value, expected) => exact(value, Object.keys(expected))
  && Object.keys(expected).every(key => value[key] === expected[key]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

export const ogOriginPrompt = "Origem: captura real da primeira dobra de /conheca, tema claro. Gerada por scripts/landing/capturar-telas.mjs --og.";
export const ogAltText = "Segundo Cérebro: capture agora, encontre depois. Notas, tarefas, agenda, hábitos, finanças e senhas num só lugar.";

export function ogMembers() {
  return Object.freeze([image, `${image}.json`, "src/app/conheca/opengraph-image.alt.txt"]);
}

export function ogInputFiles() {
  return Object.freeze(["light", "dark"].flatMap(theme => ["inicio", "capturar"].flatMap(scene =>
    [scene, `${scene}-celular`].map(name => `src/components/features/conheca/telas/${name}${theme === "dark" ? "-escuro" : ""}.webp`))));
}

// This checks a closed literal inventory, not qualification or authenticated
// origin. The supervisor must independently compare Git bytes and receipts.
export function assertOgInputHashes(records) {
  const files = ogInputFiles();
  need(Array.isArray(records) && records.length === files.length && records.every((record, index) =>
    exact(record, ["file", "sha256"]) && record.file === files[index] && digest.test(record.sha256 ?? "")), "CAPTURE_OG_INPUTS");
}

export function ogExifDescription(sourceSha) {
  need(typeof sourceSha === "string" && sha.test(sourceSha), "CAPTURE_OG_SOURCE");
  return `Segundo Cerebro | real demo capture | /conheca | light | public-first-fold | Source ${sourceSha}`;
}

// Passed directly to page.waitForFunction. Keep every dependency inside this
// function so serialization cannot accidentally rely on the Node module scope.
export function ogReadyInPage() {
  if (location.pathname !== "/conheca" || location.search || location.hash || document.fonts.status !== "loaded") return false;
  const chapters = ["captura", "agenda", "projetos"];
  const observed = [...document.querySelectorAll("#recursos > article.conheca-capitulo")];
  const anchors = [...document.querySelectorAll(".conheca-indice ol a")];
  if (observed.length !== 3 || anchors.length !== 3 || chapters.some((id, index) =>
    observed[index].id !== id || anchors[index].getAttribute("href") !== `#${id}`
    || document.querySelectorAll(`[id="${id}"]`).length !== 1)) return false;
  const headings = document.querySelectorAll(".conheca-hero h1");
  if (headings.length !== 1 || !headings[0].textContent.trim()) return false;
  const visible = [...document.querySelectorAll(".conheca-hero__tela .conheca-tela__imagem")].filter(element => {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0 || bounds.bottom <= 0 || bounds.top >= innerHeight
      || bounds.right <= 0 || bounds.left >= innerWidth) return false;
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    }
    return true;
  });
  return visible.length === 1 && visible[0].complete && visible[0].naturalWidth > 0 && visible[0].naturalHeight > 0;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function assertExif(bytes, description) {
  need(bytes.length >= 14 && bytes.length <= 64 * 1024, "CAPTURE_OG_EXIF");
  const order = bytes.subarray(0, 2).toString("ascii");
  need(order === "II" || order === "MM", "CAPTURE_OG_EXIF");
  const short = offset => order === "II" ? bytes.readUInt16LE(offset) : bytes.readUInt16BE(offset);
  const long = offset => order === "II" ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset);
  need(short(2) === 42, "CAPTURE_OG_EXIF");
  const first = long(4);
  need(first >= 8 && first + 2 <= bytes.length, "CAPTURE_OG_EXIF");
  const count = short(first);
  need(count <= 64 && first + 2 + count * 12 + 4 <= bytes.length, "CAPTURE_OG_EXIF");
  let found = 0;
  for (let index = 0; index < count; index++) {
    const offset = first + 2 + index * 12;
    if (short(offset) !== 0x010e) continue;
    const length = long(offset + 4), start = length <= 4 ? offset + 8 : long(offset + 8);
    need(++found === 1 && short(offset + 2) === 2 && length > 0 && length <= 1024
      && start >= 8 && start + length <= bytes.length
      && bytes.subarray(start, start + length).equals(Buffer.from(`${description}\0`, "ascii")), "CAPTURE_OG_EXIF");
  }
  need(found === 1, "CAPTURE_OG_EXIF");
}

export function assertOgPng(bitmap, sourceSha) {
  const description = ogExifDescription(sourceSha);
  need(Buffer.isBuffer(bitmap) && bitmap.length >= 57 && bitmap.length <= 8 * 1024 * 1024
    && bitmap.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "CAPTURE_OG_PNG");
  let offset = 8, chunks = 0, exif = 0, data = 0, ended = false, afterData = false, channels = 0;
  const compressed = [];
  while (offset < bitmap.length) {
    need(!ended && ++chunks <= 128 && offset + 12 <= bitmap.length, "CAPTURE_OG_PNG");
    const length = bitmap.readUInt32BE(offset), end = offset + 12 + length;
    need(end <= bitmap.length && length <= 8 * 1024 * 1024, "CAPTURE_OG_PNG");
    const type = bitmap.subarray(offset + 4, offset + 8).toString("ascii"), body = bitmap.subarray(offset + 8, end - 4);
    need(/^[A-Za-z]{4}$/u.test(type) && bitmap.readUInt32BE(end - 4) === crc32(bitmap.subarray(offset + 4, end - 4)), "CAPTURE_OG_PNG");
    if (chunks === 1) {
      need(type === "IHDR" && length === 13 && body.readUInt32BE(0) === 1200 && body.readUInt32BE(4) === 630
        && body[8] === 8 && [2, 6].includes(body[9]) && body[10] === 0 && body[11] === 0 && body[12] === 0, "CAPTURE_OG_PIXELS");
      channels = body[9] === 6 ? 4 : 3;
    } else if (type === "eXIf") {
      need(++exif === 1, "CAPTURE_OG_EXIF"); assertExif(body, description);
    } else if (type === "IDAT") {
      need(!afterData && length > 0, "CAPTURE_OG_PNG"); data++; compressed.push(body);
    } else if (type === "IEND") {
      need(length === 0 && data > 0 && end === bitmap.length, "CAPTURE_OG_PNG"); ended = true;
    } else {
      need(type[0] === type[0].toLowerCase(), "CAPTURE_OG_PNG");
    }
    if (data > 0 && type !== "IDAT") afterData = true;
    offset = end;
  }
  need(ended && exif === 1 && data > 0, "CAPTURE_OG_PNG");
  const stride = 1 + 1200 * channels;
  let decoded;
  try {
    const inflated = inflateSync(Buffer.concat(compressed), { maxOutputLength: stride * 630, info: true });
    need(inflated.engine.bytesWritten === compressed.reduce((total, bytes) => total + bytes.length, 0), "CAPTURE_OG_PNG");
    decoded = inflated.buffer;
  } catch { throw new Error("CAPTURE_OG_PNG"); }
  need(decoded.length === stride * 630, "CAPTURE_OG_PIXELS");
  for (let row = 0; row < 630; row++) need(decoded[row * stride] <= 4, "CAPTURE_OG_PNG");
  return Object.freeze({ width: 1200, height: 630, sha256: hash(bitmap) });
}

export function assertOgOutputs({ bitmap, sidecar, alt, source }) {
  need(exact(source, sourceKeys) && sha.test(source.sha ?? "") && sha.test(source.tree ?? "")
    && digest.test(source.generatorSha256 ?? "") && digest.test(source.policySha256 ?? ""), "CAPTURE_OG_SOURCE");
  const png = assertOgPng(bitmap, source.sha);
  need(exact(sidecar, ["prompt", "createdAt", "capture"]) && sidecar.prompt === ogOriginPrompt
    && typeof sidecar.createdAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(sidecar.createdAt)
    && Number.isFinite(Date.parse(sidecar.createdAt)) && new Date(sidecar.createdAt).toISOString() === sidecar.createdAt, "CAPTURE_OG_SIDECAR");
  const record = sidecar.capture;
  need(exact(record, ["version", "source", "mode", "route", "state", "theme", "viewport", "density", "clip", "pixels", "sha256"])
    && record.version === 1 && record.mode === "demo" && record.route === "/conheca" && record.state === "public-first-fold"
    && record.theme === "light" && same(record.source, source) && record.sha256 === png.sha256, "CAPTURE_OG_RECORD");
  // DPR2 screenshot is deliberately downsampled to the final social PNG size;
  // do not apply the WebP clip*density rule or claim this final PNG is 2x.
  need(record.density === 2 && same(record.viewport, { width: 1200, height: 630 })
    && same(record.clip, { x: 0, y: 0, width: 1200, height: 630 })
    && same(record.pixels, { width: 1200, height: 630 }), "CAPTURE_OG_GEOMETRY");
  need(alt === ogAltText, "CAPTURE_OG_ALT");
  return png;
}
