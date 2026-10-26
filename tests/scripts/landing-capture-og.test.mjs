import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import { deflateSync } from "node:zlib";
import {
  assertOgInputHashes, assertOgOutputs, assertOgPng, ogAltText, ogExifDescription,
  ogInputFiles, ogMembers, ogOriginPrompt, ogReadyInPage,
} from "../../scripts/landing/capture-og-contract.mjs";

const source = Object.freeze({ sha: "a".repeat(40), tree: "b".repeat(40), generatorSha256: "c".repeat(64), policySha256: "d".repeat(64) });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function chunk(type, body) {
  const payload = Buffer.concat([Buffer.from(type, "ascii"), body]);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(body.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}
function tiff(description, order = "II") {
  const text = Buffer.from(`${description}\0`, "ascii"), bytes = Buffer.alloc(26 + text.length);
  bytes.write(order, 0, "ascii");
  const short = (value, offset) => order === "II" ? bytes.writeUInt16LE(value, offset) : bytes.writeUInt16BE(value, offset);
  const long = (value, offset) => order === "II" ? bytes.writeUInt32LE(value, offset) : bytes.writeUInt32BE(value, offset);
  short(42, 2); long(8, 4); short(1, 8); short(0x010e, 10); short(2, 12); long(text.length, 14); long(26, 18);
  text.copy(bytes, 26);
  return bytes;
}
function png({ description = ogExifDescription(source.sha), order = "II", width = 1200, height = 630, exif, idat, extra = [] } = {}) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
    ...(exif ?? [tiff(description, order)]).map(bytes => chunk("eXIf", bytes)),
    chunk("IDAT", idat ?? deflateSync(Buffer.alloc((1 + 1200 * 4) * 630))),
    ...extra, chunk("IEND", Buffer.alloc(0)),
  ]);
}
const bitmap = png();
function outputs() {
  return {
    bitmap, source: { ...source }, alt: ogAltText,
    sidecar: {
      prompt: ogOriginPrompt, createdAt: "2026-10-26T12:00:00.000Z",
      capture: {
        version: 1, source: { ...source }, mode: "demo", route: "/conheca", state: "public-first-fold", theme: "light",
        viewport: { width: 1200, height: 630 }, density: 2, clip: { x: 0, y: 0, width: 1200, height: 630 },
        pixels: { width: 1200, height: 630 }, sha256: hash(bitmap),
      },
    },
  };
}

test("OG has exactly the existing PNG, sidecar and alt members; no extra receipt", () => {
  assert.deepEqual(ogMembers(), ["src/app/conheca/opengraph-image.png", "src/app/conheca/opengraph-image.png.json", "src/app/conheca/opengraph-image.alt.txt"]);
  assert(Object.isFrozen(ogMembers()));
});
test("eight literal input hashes are inventory only, without an approval field", () => {
  const records = ogInputFiles().map(file => ({ file, sha256: "e".repeat(64) }));
  assert.equal(records.length, 8); assert.equal(new Set(records.map(record => record.file)).size, 8);
  assert.doesNotThrow(() => assertOgInputHashes(records));
  for (const changed of [records.slice(1), [...records, records[0]], [...records].reverse(),
    records.map((record, index) => index ? record : { ...record, file: "src/app/conheca/opengraph-image.png" }),
    records.map((record, index) => index ? record : { ...record, sha256: "E".repeat(64) }),
    records.map((record, index) => index ? record : { ...record, qualified: true })]) {
    assert.throws(() => assertOgInputHashes(changed), /CAPTURE_OG_INPUTS/u);
  }
});
test("matching Source and raster hashes accept a real bounded PNG structure in both TIFF byte orders", () => {
  assert.deepEqual(assertOgOutputs(outputs()), { width: 1200, height: 630, sha256: hash(bitmap) });
  assert.equal(assertOgPng(png({ order: "MM" }), source.sha).width, 1200);
});
test("Source must have exactly four valid pinned fields, independent from prior raster Sources", () => {
  for (const changed of [null, { ...source, sha: "A".repeat(40) }, { ...source, tree: "b".repeat(39) },
    { ...source, generatorSha256: "x".repeat(64) }, { ...source, policySha256: "d".repeat(63) }, { ...source, approved: true }]) {
    const input = outputs(); input.source = changed;
    assert.throws(() => assertOgOutputs(input), /CAPTURE_OG_SOURCE/u);
  }
});
for (const [name, change, code] of [
  ["old sidecar without capture", input => { delete input.sidecar.capture; }, "SIDECAR"],
  ["extra hosted claim", input => { input.sidecar.hostedValidated = true; }, "SIDECAR"],
  ["foreign prompt", input => { input.sidecar.prompt += " other"; }, "SIDECAR"],
  ["non-canonical timestamp", input => { input.sidecar.createdAt = "2026-10-26"; }, "SIDECAR"],
  ["impossible timestamp", input => { input.sidecar.createdAt = "2026-02-30T12:00:00.000Z"; }, "SIDECAR"],
  ["Source mismatch", input => { input.sidecar.capture.source.tree = "f".repeat(40); }, "RECORD"],
  ["hash mismatch", input => { input.sidecar.capture.sha256 = "f".repeat(64); }, "RECORD"],
  ["connected claim", input => { input.sidecar.capture.mode = "supabase"; }, "RECORD"],
  ["other route", input => { input.sidecar.capture.route = "/conheca?preview=1"; }, "RECORD"],
  ["other state", input => { input.sidecar.capture.state = "six-chapters"; }, "RECORD"],
  ["dark variant", input => { input.sidecar.capture.theme = "dark"; }, "RECORD"],
  ["unexpected metadata", input => { input.sidecar.capture.hostedValidated = true; }, "RECORD"],
  ["wrong DPR", input => { input.sidecar.capture.density = 1; }, "GEOMETRY"],
  ["wrong viewport", input => { input.sidecar.capture.viewport.width = 1440; }, "GEOMETRY"],
  ["non-finite clip", input => { input.sidecar.capture.clip.x = NaN; }, "GEOMETRY"],
  ["extra viewport field", input => { input.sidecar.capture.viewport.scale = 1; }, "GEOMETRY"],
  ["false final 2x pixels", input => { input.sidecar.capture.pixels = { width: 2400, height: 1260 }; }, "GEOMETRY"],
  ["different alt", input => { input.alt += "\n"; }, "ALT"],
]) test(`OG refuses ${name}`, () => {
  const input = outputs(); change(input);
  assert.throws(() => assertOgOutputs(input), new RegExp(`CAPTURE_OG_${code}`, "u"));
});
test("PNG refuses wrong dimensions, missing/duplicate/foreign EXIF and malformed TIFF", () => {
  const badTiff = tiff(ogExifDescription(source.sha)); badTiff.writeUInt32LE(0xfffffff0, 18);
  for (const invalid of [png({ width: 2400 }), png({ height: 1260 }), png({ exif: [] }),
    png({ exif: [tiff(ogExifDescription(source.sha)), tiff(ogExifDescription(source.sha))] }),
    png({ description: ogExifDescription("f".repeat(40)) }), png({ exif: [badTiff] })]) {
    assert.throws(() => assertOgPng(invalid, source.sha), /CAPTURE_OG_(PIXELS|EXIF|PNG)/u);
  }
});
test("PNG verifies CRC, exact ending, required image data and bounded inflation", () => {
  const corrupt = Buffer.from(bitmap); corrupt[35] ^= 1;
  for (const invalid of [Buffer.from("not png"), bitmap.subarray(0, -1), Buffer.concat([bitmap, Buffer.from("tail")]), corrupt,
    png({ idat: Buffer.from("not deflate") }), png({ idat: deflateSync(Buffer.alloc(10)) }),
    png({ idat: deflateSync(Buffer.alloc((1 + 1200 * 4) * 630 + 1)) }),
    png({ idat: Buffer.concat([deflateSync(Buffer.alloc((1 + 1200 * 4) * 630)), Buffer.from("tail")]) }),
    png({ extra: [chunk("IHDR", Buffer.alloc(13))] })]) {
    assert.throws(() => assertOgPng(invalid, source.sha), /CAPTURE_OG_(PNG|PIXELS)/u);
  }
  const pixels = Buffer.alloc((1 + 1200 * 4) * 630); pixels[0] = 5;
  assert.throws(() => assertOgPng(png({ idat: deflateSync(pixels) }), source.sha), /CAPTURE_OG_PNG/u);
});

function pageFixture() {
  const chapters = ["captura", "agenda", "projetos"].map(id => ({ id }));
  const anchors = chapters.map(chapter => ({ getAttribute: () => `#${chapter.id}` }));
  const hero = {
    complete: true, naturalWidth: 2880, naturalHeight: 1800, parentElement: null,
    getBoundingClientRect: () => ({ top: 400, bottom: 800, left: 0, right: 1120, width: 1120, height: 400 }),
  };
  const state = {
    location: { pathname: "/conheca", search: "", hash: "" }, innerHeight: 630, innerWidth: 1200,
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
    document: { fonts: { status: "loaded" }, querySelectorAll: selector => {
      if (selector === "#recursos > article.conheca-capitulo") return chapters;
      if (selector === ".conheca-indice ol a") return anchors;
      if (selector === ".conheca-hero h1") return [{ textContent: "Capture agora. Encontre depois." }];
      if (selector === ".conheca-hero__tela .conheca-tela__imagem") return [hero];
      return chapters.filter(chapter => selector === `[id="${chapter.id}"]`);
    } },
  };
  return { state, chapters, anchors, hero };
}
const ready = state => vm.runInNewContext(`(${ogReadyInPage.toString()})()`, state, { timeout: 1000 });
test("readiness serializes with no Node closure and accepts the loaded three-chapter landing", () => {
  assert.equal(ready(pageFixture().state), true);
});
for (const [name, change] of [
  ["other route", fixture => { fixture.state.location.pathname = "/"; }],
  ["query", fixture => { fixture.state.location.search = "?preview=1"; }],
  ["fragment", fixture => { fixture.state.location.hash = "#agenda"; }],
  ["fonts pending", fixture => { fixture.state.document.fonts.status = "loading"; }],
  ["old six-chapter index", fixture => { fixture.anchors.push(...fixture.anchors); }],
  ["wrong chapter order", fixture => { fixture.chapters.reverse(); }],
  ["image still loading", fixture => { fixture.hero.complete = false; }],
  ["broken hero", fixture => { fixture.hero.naturalWidth = 0; }],
  ["hidden picture", fixture => { fixture.hero.parentElement = {}; fixture.state.getComputedStyle = element => ({ display: element === fixture.hero ? "block" : "none", visibility: "visible", opacity: "1" }); }],
  ["transparent hero", fixture => { fixture.state.getComputedStyle = () => ({ display: "block", visibility: "visible", opacity: "0" }); }],
  ["hero below first fold", fixture => { fixture.hero.getBoundingClientRect = () => ({ top: 630, bottom: 900, left: 0, right: 1120, width: 1120, height: 270 }); }],
]) test(`readiness refuses ${name}`, () => {
  const fixture = pageFixture(); change(fixture); assert.equal(ready(fixture.state), false);
});
