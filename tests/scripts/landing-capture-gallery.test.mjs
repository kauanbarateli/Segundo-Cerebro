import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { runInNewContext } from "node:vm";
import {
  assertGalleryRecords, assertGalleryTarget, captureFile, decideCaptureRequest, galleryExifDescription,
  galleryFiles, galleryMembers, galleryReadyInPage, galleryScenes, initializeGalleryPrefetchPolicy,
  initializeProjectPrefetchPolicy, parseCaptureOptions, projectFiles,
} from "../../scripts/landing/capture-policy.mjs";
import {
  assertCaptureInterface, assertGalleryExif, assertGalleryGeometry, assertGalleryReceipt, assertGalleryStage, captureInvocation,
} from "../../scripts/landing/capture-project-ci.mjs";
import { galleryEntrypointAction } from "../../scripts/landing/capture-gallery-ci.mjs";

const base = "http://127.0.0.1:3110";
const source = { sha: "a".repeat(40), tree: "b".repeat(40), generatorSha256: "c".repeat(64), policySha256: "d".repeat(64) };
const expectedFiles = [
  "calendario-lista.webp", "calendario-lista-celular.webp", "tarefas-kanban.webp", "tarefas-kanban-celular.webp",
  "calendario-lista-escuro.webp", "calendario-lista-celular-escuro.webp", "tarefas-kanban-escuro.webp", "tarefas-kanban-celular-escuro.webp",
];
const makeRecords = () => expectedFiles.map((file, index) => {
  const mobile = index % 2 === 1, scene = galleryScenes[Math.floor(index / 2) % 2];
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, density = mobile ? 3 : 2;
  return { file, sidecar: file + ".json", scene: scene.scene, route: scene.route, theme: index < 4 ? "light" : "dark", viewport, density,
    clip: { x: 0, y: 0, ...viewport }, pixels: { width: viewport.width * density, height: viewport.height * density },
    bytes: 123, sidecarBytes: 321, sha256: "e".repeat(64), sidecarSha256: "f".repeat(64) };
});
const makeReceipt = () => ({ version: 1, scene: "galeria", mode: "demo", source: { ...source },
  claims: { hostedValidated: false, productionValidated: false },
  requestPolicy: { scope: "browser-capture", observed: 12, refused: 0, serviceWorkers: "block", webSockets: "deny", methods: ["GET"], origin: base }, records: makeRecords() });
function dom(scene, change = {}) {
  const button = { textContent: scene === "calendario-lista" ? "Lista" : "Kanban", getAttribute: () => change.pressed ?? "true" };
  const columns = ["A fazer", "Em andamento", "Concluídas"].map(textContent => ({ querySelector: () => ({ textContent }) }));
  const list = { querySelector: selector => selector === "h3" ? { textContent: "Próximos eventos" } : { value: change.date ?? "2026-09-23" }, querySelectorAll: () => Array(change.events ?? 3).fill({}) };
  const board = { scrollLeft: change.scrollLeft ?? 0, querySelectorAll: selector => selector === ".kanban-column" ? columns.slice(0, change.columns ?? 3) : Array(change.cards ?? 6).fill({}) };
  const document = { fonts: { status: change.fonts ?? "loaded" }, images: change.images ?? [], querySelector(selector) {
    if (selector === "[role='alert']") return change.alert ? {} : null;
    if (selector.startsWith(".calendar-skeleton")) return change.loading ? {} : null;
    if (selector === ".shell-demo-label") return { textContent: change.demo ?? "Demonstração" };
    if (selector.startsWith("[aria-label=")) return change.noGroup ? null : { querySelectorAll: () => [button] };
    if (selector === ".calendar-list-view") return change.noList ? null : list;
    if (selector.startsWith(".tasks-board-view")) return change.noBoard ? null : board;
    throw Error("UNEXPECTED_SELECTOR");
  } };
  return document;
}
const ready = (scene, change) => runInNewContext(`(${galleryReadyInPage.toString()})(${JSON.stringify(scene)})`, { document: dom(scene, change) }, { timeout: 1000 });

test("Gallery is a finite optional mode; all/og and Project paths remain closed", () => {
  assert.deepEqual(parseCaptureOptions([]), { mode: "all", base });
  assert.deepEqual(parseCaptureOptions(["--og"]), { mode: "og", base });
  assert.deepEqual(parseCaptureOptions(["--only", "galeria"]), { mode: "galeria", base });
  assert.equal(projectFiles().length, 4);
  assert.equal(projectFiles().flatMap(file => [file, file + ".json"]).length + 1, 9);
  assert.throws(() => captureFile("projeto", "calendario-lista", "light"));
  assert.throws(() => captureFile("all", "tarefas-kanban", "dark"));
  for (const args of [["--only", "calendario-lista"], ["--only", "galeria", "--og"], ["--only", "galeria", "--output", "/tmp"]]) assert.throws(() => parseCaptureOptions(args));
});

test("eight exact Gallery WebPs and seventeen unique members are independent of Project9", () => {
  assert.deepEqual(galleryFiles(), expectedFiles);
  assert.equal(galleryMembers().length, 17);
  assert.equal(new Set(galleryMembers()).size, 17);
  assert.equal(galleryMembers().at(-1), "landing-gallery-capture.json");
  assert.equal(captureFile("galeria", "tarefas-kanban-celular", "dark"), "tarefas-kanban-celular-escuro.webp");
  for (const name of ["projeto", "../tarefas-kanban", "tarefas-kanban-escuro", "calendario"]) assert.throws(() => captureFile("galeria", name, "light"));
});

test("real scene admission rejects extra query, fragment, foreign origin and unsupported Kanban query", () => {
  for (const scene of galleryScenes) assert.equal(assertGalleryTarget(base + scene.route, base, scene.scene), scene);
  for (const url of [base + "/tarefas?view=kanban", base + "/tarefas#x", "http://localhost:3110/tarefas", base + "/api/tarefas"]) assert.throws(() => assertGalleryTarget(url, base, "tarefas-kanban"));
  assert.throws(() => assertGalleryTarget(base + galleryScenes[0].route + "&x=1", base, "calendario-lista"));
  assert.throws(() => assertGalleryTarget(base + "/tarefas", base, "other"));
});

test("Gallery reuses the actual bounded prefetch initializer, preserving zero getter reads", () => {
  assert.equal(initializeGalleryPrefetchPolicy, initializeProjectPrefetchPolicy);
  const context = { location: { origin: base } };
  runInNewContext(`globalThis.reads=0;Object.defineProperty(globalThis,'IntersectionObserver',{configurable:true,get(){reads++;throw Error('CANARY')}});(${initializeGalleryPrefetchPolicy.toString()})({expectedOrigin:${JSON.stringify(base)}})`, context, { timeout: 1000 });
  assert.equal(context.reads, 0);
  assert.equal("IntersectionObserver" in context, false);
});

test("serialized real Calendar predicate requires fixed demo date, pressed Lista and populated list", () => {
  assert.equal(ready("calendario-lista"), true);
  for (const change of [{ date: "2026-10-25" }, { events: 0 }, { pressed: "false" }, { noList: true }, { noGroup: true }]) assert.equal(ready("calendario-lista", change), false);
});

test("serialized real Kanban predicate requires three columns/cards and original mobile scroll", () => {
  assert.equal(ready("tarefas-kanban"), true);
  for (const change of [{ columns: 2 }, { cards: 0 }, { scrollLeft: 10 }, { noBoard: true }, { pressed: "false" }]) assert.equal(ready("tarefas-kanban", change), false);
});

test("readiness refuses errors and transient UI without accepting later recovery as earlier pixels", () => {
  for (const scene of ["calendario-lista", "tarefas-kanban"]) {
    assert.throws(() => ready(scene, { alert: true }), /CAPTURE_GALLERY_ERROR/u);
    for (const change of [{ loading: true }, { demo: "Conectado" }, { fonts: "loading" }, { images: [{ complete: false, naturalWidth: 0 }] }, { images: [{ complete: true, naturalWidth: 0 }] }]) assert.equal(ready(scene, change), false);
    assert.equal(ready(scene, { images: [{ complete: true, naturalWidth: 64 }] }), true);
  }
  assert.throws(() => ready("unknown"), /CAPTURE_GALLERY_TARGET/u);
});

test("record admission rejects missing/extra/duplicate or reordered scene and theme", () => {
  assertGalleryRecords(makeRecords());
  for (const mutate of [rows => rows.pop(), rows => rows.push(rows[0]), rows => { rows[1] = rows[0]; }, rows => { rows.reverse(); }, rows => { rows[0].scene = "tarefas-kanban"; }, rows => { rows[0].theme = "dark"; }, rows => { rows[0].route = "/tarefas"; }, rows => { rows[0].sha256 = "x"; }]) {
    const rows = makeRecords(); mutate(rows); assert.throws(() => assertGalleryRecords(rows));
  }
});

test("actual receipt checker accepts only demo Source4 and conservative claims", () => {
  assertGalleryReceipt(makeReceipt(), source);
  for (const mutate of [value => { value.extra = true; }, value => { value.source.sha = "0".repeat(40); }, value => { value.source.extra = true; }, value => { value.mode = "connected"; }, value => { value.claims.hostedValidated = true; }, value => { value.claims.productionValidated = true; }, value => { value.records[0].extra = true; }]) {
    const value = makeReceipt(); mutate(value); assert.throws(() => assertGalleryReceipt(value, source));
  }
});

test("receipt never admits API/WS/SW, ignored failures, private origin or a non-GET method", () => {
  for (const change of [{ refused: 1 }, { observed: 0 }, { serviceWorkers: "allow" }, { webSockets: "allow" }, { methods: ["GET", "POST"] }, { origin: "https://private.invalid" }, { authorization: "CANARY" }]) {
    const value = makeReceipt(); Object.assign(value.requestPolicy, change); assert.throws(() => assertGalleryReceipt(value, source));
  }
  for (const url of [base + "/api/x", base + "/%61pi/x", "https://outside.invalid/image"]) assert.equal(decideCaptureRequest({ method: "GET", url }, base).allowed, false);
});

test("geometry binds actual viewport/density/clip/pixels to the eight variants", () => {
  const rows = makeRecords(); rows.forEach(assertGalleryGeometry);
  for (const change of [{ density: 1 }, { theme: "dark" }, { viewport: { width: 390, height: 844 } }, { clip: { x: -1, y: 0, width: 1, height: 1 } }, { pixels: { width: 1440, height: 900 } }]) assert.throws(() => assertGalleryGeometry({ ...rows[0], ...change }, 0));
  assert.throws(() => assertGalleryGeometry(rows[0], 8));
});

function webp(description, extra = []) {
  const payload = Buffer.from(description, "ascii"), header = Buffer.alloc(8);
  header.write("EXIF"); header.writeUInt32LE(payload.length, 4);
  const chunks = Buffer.concat([header, payload, ...(payload.length % 2 ? [Buffer.alloc(1)] : []), ...extra]);
  const riff = Buffer.alloc(12); riff.write("RIFF"); riff.writeUInt32LE(chunks.length + 4, 4); riff.write("WEBP", 8);
  return Buffer.concat([riff, chunks]);
}

test("real WebP chunk reader requires exactly one bounded EXIF matching scene/theme/Source", () => {
  const description = galleryExifDescription("calendario-lista", "light", false, source.sha), bitmap = webp(description);
  assertGalleryExif(bitmap, description);
  assert.throws(() => assertGalleryExif(bitmap, galleryExifDescription("tarefas-kanban", "light", false, source.sha)));
  assert.throws(() => assertGalleryExif(bitmap.subarray(0, bitmap.length - 1), description));
  assert.throws(() => assertGalleryExif(webp(description, [bitmap.subarray(12)]), description));
  const corrupt = Buffer.from(bitmap); corrupt.writeUInt32LE(0xffffffff, 16); assert.throws(() => assertGalleryExif(corrupt, description));
});

test("EXIF description cannot carry arbitrary scene, credential text or malformed Source", () => {
  for (const args of [["other", "light", false, source.sha], ["calendario-lista", "private", false, source.sha], ["calendario-lista", "light", "yes", source.sha], ["calendario-lista", "light", false, source.sha + "\n"]]) assert.throws(() => galleryExifDescription(...args));
});

test("stage admission is Source-derived and a direct child of the canonical parent", () => {
  const parent = resolve("fixture-runner-temp"), stage = join(parent, `landing-gallery-${source.sha}-${source.tree}`);
  assertGalleryStage(parent, stage, source);
  for (const changed of [join(parent, "other"), join(parent, "nested", stage.slice(stage.lastIndexOf("/") + 1)), resolve(parent, "..", "outside")]) assert.throws(() => assertGalleryStage(parent, changed, source));
  assert.throws(() => assertGalleryStage(parent, stage, { ...source, sha: source.sha + "\n" }));
});

test("the actual supervisor keeps Project and Gallery separate from other closed modes", () => {
  assert.deepEqual(captureInvocation("projeto"), { mode: "projeto", args: ["--only", "projeto", "--base", base], routes: ["/projetos?project=project-sc-v2"], outputCount: 9 });
  assert.deepEqual(captureInvocation("galeria"), { mode: "galeria", args: ["--only", "galeria", "--base", base], routes: ["/calendario?view=list&date=2026-09-23", "/tarefas"], outputCount: 17 });
  for (const mode of [undefined, "all", "og", "../projeto", { mode: "galeria" }]) assert.throws(() => captureInvocation(mode));
  assertCaptureInterface({ route: "/projetos?project=project-sc-v2", receipt: "docs/implementation/evidence/landing-project-capture.json", files: projectFiles() });
});

test("thin entrypoint takes no scene/output option and its import starts no service", () => {
  assert.equal(galleryEntrypointAction([]), "capture");
  assert.equal(galleryEntrypointAction(["--check-contract"]), "contract");
  for (const args of [["--only", "galeria"], ["--output", "/tmp"], ["--check-contract", "--check-contract"], null]) assert.throws(() => galleryEntrypointAction(args));
});

test("real callsites use the same supervisor/cleanup and readiness at both pixel boundaries", async () => {
  const read = path => readFile(new URL("../../" + path, import.meta.url), "utf8");
  const [entry, supervisor, harness, workflow] = await Promise.all([read("scripts/landing/capture-gallery-ci.mjs"), read("scripts/landing/capture-project-ci.mjs"), read("scripts/landing/capturar-telas.mjs"), read(".github/workflows/ci.yml")]);
  assert.match(entry, /import \{ checkGalleryContract, runGalleryCapture \} from "\.\/capture-project-ci\.mjs"/u);
  assert.match(entry, /else await runGalleryCapture\(\)/u);
  assert.match(supervisor, /await main\("galeria"\)/u);
  assert.match(supervisor, /const invocation = captureInvocation\(mode\)/u);
  assert.match(supervisor, /\[resolve\(ROOT, codeFiles\[0\]\), \.\.\.invocation\.args\]/u);
  assert.equal((supervisor.match(/async function launch\(/gu) ?? []).length, 1);
  assert.equal((supervisor.match(/async function closeOwned\(/gu) ?? []).length, 1);
  assert.match(supervisor, /await copyFile\(join\(directory, name\), join\(stage, name\), constants\.COPYFILE_EXCL\)/u);
  const save = harness.slice(harness.indexOf("async function save("), harness.indexOf('  if (options.mode === "galeria") {\n    for (const'));
  assert.equal((save.match(/await assertGalleryReadyNow\(page, scene\)/gu) ?? []).length, 2);
  const branch = harness.slice(harness.indexOf('  if (options.mode === "galeria") {\n    for (const'), harness.indexOf('  if (options.mode === "projeto") {\n    const context'));
  assert.match(branch, /getByRole\("button", \{ name: "Kanban", exact: true \}\)\.click\(\)/u);
  assert.match(branch, /return;/u);
  assert.doesNotMatch(branch, /createTask|runAction|dragTo|\.fill\(|\/api\//u);
  assert.ok(workflow.indexOf("id: landing_gallery") < workflow.indexOf("id: landing_projects"));
  const galleryStep = workflow.slice(workflow.indexOf("id: landing_gallery"), workflow.indexOf("      - name: Recapturar somente as oito variantes demo de Início e Capturar"));
  assert.match(galleryStep, /github\.event_name == 'push'/u);
  assert.match(galleryStep, /github\.ref == 'refs\/heads\/codex\/mvp-goals-terminal-20261023'/u);
  // A multiline absolute INPUT_PATH is translated only at its leading host
  // prefix in the job container; it previously uploaded just the first file.
  // Upload the one Source-derived directory already closed to Gallery17.
  assert.match(galleryStep, /^          path: \$\{\{ runner.temp \}\}\/landing-gallery-\$\{\{ github.sha \}\}-\$\{\{ steps.landing_gallery.outputs.source_tree \}\}\/$/mu);
  assert.doesNotMatch(galleryStep, /^          path: [|>]/mu);
  assert.match(supervisor, /const members = isEntry \? entryMembers\(\) : galleryMembers\(\)/u);
  assert.match(supervisor, /same\(\(await readdir\(stage\)\).sort\(\), \[\.\.\.members\].sort\(\)\)/u);
  assert.match(galleryStep, /if-no-files-found: error/u);
});
