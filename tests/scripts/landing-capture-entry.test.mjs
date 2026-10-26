import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import {
  assertEntryRecords, assertEntryTarget, captureFile, decideCaptureRequest, entryExifDescription,
  entryFiles, entryMembers, entryPhoneClip, entryReadyInPage, entryReceipt, entryScenes,
  firstCaptureDiagnostic, galleryFiles, galleryMembers, initializeEntryPrefetchPolicy,
  initializeProjectPrefetchPolicy, parseCaptureOptions, projectFiles,
} from "../../scripts/landing/capture-policy.mjs";

const base = "http://127.0.0.1:3110";
const files = [
  "inicio.webp", "inicio-celular.webp", "capturar.webp", "capturar-celular.webp",
  "inicio-escuro.webp", "inicio-celular-escuro.webp", "capturar-escuro.webp", "capturar-celular-escuro.webp",
];
const records = () => files.map((file, index) => {
  const scene = entryScenes[Math.floor(index / 2) % 2];
  return { file, sidecar: `${file}.json`, scene: scene.scene, route: scene.route,
    theme: index < 4 ? "light" : "dark", sha256: "a".repeat(64), sidecarSha256: "b".repeat(64) };
});
function dom(scene, change = {}) {
  const editor = { hidden: change.hidden ?? false,
    querySelector(selector) {
      if (selector === "input.capture-title") return { value: change.title ?? "Reforma da sala" };
      if (selector === "textarea.capture-body") return { value: change.body ?? "Trocar a luminária e pintar a parede da janela.\n\nUma nota pública de demonstração." };
      throw Error("UNEXPECTED_SELECTOR");
    },
    querySelectorAll(selector) {
      if (selector.startsWith("[aria-label='Notas vinculadas']")) return Array(change.links ?? 1).fill({});
      if (selector === ".capture-compose-head button") return [{ textContent: change.save ?? "Salvar nota", disabled: change.disabled ?? false }];
      throw Error("UNEXPECTED_SELECTOR");
    },
  };
  return { fonts: { status: change.fonts ?? "loaded" }, images: change.images ?? [],
    querySelector(selector) {
      if (selector === "[role='alert']") return change.alert ? {} : null;
      if (selector.startsWith(".home-skeleton")) return change.loading ? {} : null;
      if (selector === ".shell-demo-label") return { textContent: change.demo ?? "Demonstração" };
      if (selector === ".home-view") return change.noHome ? null : { getAttribute: () => change.access ?? "allowed" };
      if (selector === ".home-focus h2") return { textContent: change.focus ?? "Revisar checklist da mudança" };
      if (selector === "#home-rhythm-title") return { textContent: change.rhythm ?? "Seu ritmo hoje" };
      if (selector === "#home-projects-title") return { textContent: change.projectsTitle ?? "Seus projetos" };
      if (selector === ".capture-feature") return change.noFeature ? null : { getAttribute: () => change.mobileEditor ?? "true" };
      if (selector === "section.capture-editor") return change.noEditor ? null : editor;
      throw Error("UNEXPECTED_SELECTOR");
    },
    querySelectorAll(selector) {
      if (selector === ".home-project") return Array(change.projects ?? 3).fill({});
      throw Error("UNEXPECTED_SELECTOR");
    },
  };
}
const ready = (scene, change) => runInNewContext(`(${entryReadyInPage.toString()})(${JSON.stringify(scene)})`, { document: dom(scene, change) }, { timeout: 1000 });

test("Entrada is one finite mode, preserving Gallery17, Project9 and legacy all", () => {
  assert.deepEqual(parseCaptureOptions(["--only", "entrada"]), { mode: "entrada", base });
  assert.equal(parseCaptureOptions([]).mode, "all");
  assert.equal(parseCaptureOptions(["--og"]).mode, "og");
  assert.equal(galleryMembers().length, 17);
  assert.equal(galleryFiles().length, 8);
  assert.equal(projectFiles().length * 2 + 1, 9);
  for (const args of [["--only", "inicio"], ["--only", "captura"], ["--only", "entrada", "--og"], ["--only", "entrada", "--output", "other"], ["--only", "entrada", "--only", "entrada"]]) assert.throws(() => parseCaptureOptions(args));
});

test("entry scenes and files close exactly eight variants and seventeen flat members", () => {
  assert.deepEqual(entryScenes.map(({ scene, route, state, fileStem }) => [scene, route, state, fileStem]), [
    ["inicio", "/", "home-demo-neutralized", "inicio"],
    ["captura", "/capturar?capture=new", "capture-editor-demo-neutralized", "capturar"],
  ]);
  assert.deepEqual(entryFiles(), files);
  assert.equal(entryReceipt, "landing-entry-capture.json");
  assert.deepEqual(entryMembers(), files.flatMap(file => [file, `${file}.json`]).concat(entryReceipt));
  assert.equal(new Set(entryMembers()).size, 17);
  assert.equal(entryMembers().every(file => !file.includes("/") && !file.includes("\\")), true);
  assert.equal(Object.isFrozen(entryScenes) && entryScenes.every(Object.isFrozen) && Object.isFrozen(entryFiles()), true);
});

test("entry file paths refuse retired scenes, traversal, unknown themes and cross-mode names", () => {
  assert.equal(captureFile("entrada", "capturar-celular", "dark"), "capturar-celular-escuro.webp");
  for (const name of ["inicio-celular-dia", "captura", "projeto", "tarefas-kanban", "../inicio", "inicio/../inicio", "inicio-escuro"]) assert.throws(() => captureFile("entrada", name, "light"));
  for (const theme of ["system", "LIGHT", "", null]) assert.throws(() => captureFile("entrada", "inicio", theme));
  assert.throws(() => captureFile("galeria", "capturar", "light"));
  assert.throws(() => captureFile("projeto", "inicio", "light"));
});

test("entry target requires exact local route and explicit new-note query", () => {
  for (const scene of entryScenes) assert.equal(assertEntryTarget(base + scene.route, base, scene.scene), scene);
  for (const url of [base + "/capturar", base + "/capturar?capture=new&x=1", base + "/capturar?new=1", base + "/capturar?capture=new#x", "http://localhost:3110/capturar?capture=new", base + "/api/capturar"]) assert.throws(() => assertEntryTarget(url, base, "captura"));
  for (const url of [base, base + "/?x=1", base + "/#inicio"]) assert.throws(() => assertEntryTarget(url, base, "inicio"));
  assert.throws(() => assertEntryTarget(base + "/", base, "unknown"));
});

test("entry EXIF carries finite scene/theme/mobile and exact Source without accepting arbitrary text", () => {
  assert.equal(entryExifDescription("captura", "dark", true, "c".repeat(40)), `Segundo Cerebro | real demo capture | captura | dark | mobile | Source ${"c".repeat(40)}`);
  for (const args of [["unknown", "light", false, "c".repeat(40)], ["inicio", "system", false, "c".repeat(40)], ["inicio", "light", 1, "c".repeat(40)], ["inicio", "light", false, "C".repeat(40)], ["inicio", "light", false, "private text"]]) assert.throws(() => entryExifDescription(...args));
});

test("entry record admission rejects missing, duplicate, extra and reordered variants", () => {
  assertEntryRecords(records());
  for (const list of [records().slice(1), [...records(), records()[0]], records().toReversed(), records().map((value, index) => index === 1 ? records()[0] : value)]) assert.throws(() => assertEntryRecords(list));
  for (const change of [{ file: "../inicio.webp" }, { sidecar: "other.json" }, { scene: "capturar" }, { route: "/capturar" }, { theme: "system" }, { sha256: "A".repeat(64) }, { sidecarSha256: "private text" }]) {
    const list = records(); list[2] = { ...list[2], ...change }; assert.throws(() => assertEntryRecords(list));
  }
});

test("entry reuses the bounded local-only prefetch policy without evaluating getters", () => {
  assert.equal(initializeEntryPrefetchPolicy, initializeProjectPrefetchPolicy);
  const context = { location: { origin: base } };
  runInNewContext(`globalThis.reads=0;Object.defineProperty(globalThis,'IntersectionObserver',{configurable:true,get(){reads++;throw Error('CANARY')}});(${initializeEntryPrefetchPolicy.toString()})({expectedOrigin:${JSON.stringify(base)}})`, context, { timeout: 1000 });
  assert.equal(context.reads, 0); assert.equal("IntersectionObserver" in context, false);
  for (const origin of ["null", "https://foreign.test"]) {
    const other = { location: { origin }, IntersectionObserver: "untouched" };
    runInNewContext(`(${initializeEntryPrefetchPolicy.toString()})({expectedOrigin:${JSON.stringify(base)}})`, other, { timeout: 1000 });
    assert.equal(other.IntersectionObserver, "untouched");
  }
});

test("entry readiness requires actual focus, rhythm and populated current Home", () => {
  assert.equal(ready("inicio"), true);
  for (const change of [{ noHome: true }, { access: "denied" }, { focus: "" }, { rhythm: "Hoje" }, { projectsTitle: "Projetos antigos" }, { projects: 0 }]) assert.equal(ready("inicio", change), false);
});

test("entry Capture readiness proves real new-note editor, draft values and exactly one link", () => {
  assert.equal(ready("captura"), true);
  for (const change of [{ noFeature: true }, { noEditor: true }, { mobileEditor: "false" }, { hidden: true }, { title: "" }, { body: "" }, { links: 0 }, { links: 2 }, { disabled: true }, { save: "Salvar alterações" }]) assert.equal(ready("captura", change), false);
});

test("entry readiness refuses alerts and transient failures instead of accepting recovered pixels", () => {
  for (const scene of ["inicio", "captura"]) {
    assert.throws(() => ready(scene, { alert: true }), /CAPTURE_ENTRY_ERROR/u);
    for (const change of [{ loading: true }, { fonts: "loading" }, { demo: "Conectado" }, { images: [{ complete: false, naturalWidth: 0 }] }, { images: [{ complete: true, naturalWidth: 0 }] }]) assert.equal(ready(scene, change), false);
    assert.equal(ready(scene, { images: [{ complete: true, naturalWidth: 100 }] }), true);
  }
  assert.throws(() => ready("unknown"), /CAPTURE_ENTRY_TARGET/u);
});

test("mobile clip clamps scrolled static header and bottom navigation to the actual viewport", () => {
  const bottom = { x: 0, y: 784, width: 390, height: 60 };
  assert.deepEqual(entryPhoneClip({ x: 0, y: 0, width: 390, height: 72 }, bottom), { x: 0, y: 0, width: 390, height: 844 });
  assert.deepEqual(entryPhoneClip({ x: 0, y: -120, width: 390, height: 72 }, bottom), { x: 0, y: 0, width: 390, height: 844 });
  assert.deepEqual(entryPhoneClip({ x: 0, y: 4, width: 390, height: 72 }, { ...bottom, height: 90 }), { x: 0, y: 4, width: 390, height: 840 });
  for (const [header, nav] of [[null, bottom], [{ x: 0, y: NaN, width: 390, height: 72 }, bottom], [{ x: 0, y: 900, width: 390, height: 72 }, bottom], [{ x: 0, y: 0, width: 390, height: 72 }, { ...bottom, y: -100 }]]) assert.throws(() => entryPhoneClip(header, nav));
});

test("entry keeps GET-local API and image-proxy refusals unchanged", () => {
  assert.equal(decideCaptureRequest({ url: base + "/capturar?capture=new", method: "GET" }, base).allowed, true);
  for (const request of [{ url: base + "/capturar", method: "POST" }, { url: base + "/api/capture", method: "GET" }, { url: "https://foreign.test/", method: "GET" }, { url: base + "/_next/image?url=https%3A%2F%2Fforeign.test%2Fimage.webp", method: "GET" }]) assert.equal(decideCaptureRequest(request, base).allowed, false);
  for (const code of ["CAPTURE_ENTRY_TARGET", "CAPTURE_ENTRY_NOT_READY", "CAPTURE_ENTRY_EXIF", "CAPTURE_ENTRY_GEOMETRY", "CAPTURE_OG_NOT_READY"]) assert.equal(firstCaptureDiagnostic(null, { kind: "operation", code }, "pixels")[0], code);
});

test("generator Entry branch uses real new-note actions and returns before legacy all", async () => {
  const harness = await readFile(new URL("../../scripts/landing/capturar-telas.mjs", import.meta.url), "utf8");
  const branch = harness.slice(harness.indexOf('  if (options.mode === "entrada") {\n    for (const'), harness.indexOf('  if (options.mode === "galeria") {\n    for (const'));
  assert.match(branch, /await navigateEntry\(page, scene\)/u);
  assert.doesNotMatch(branch, /gotoCapture|name: "Nova nota"/u);
  assert.match(branch, /getByLabel\("Título da nota", \{ exact: true \}\)\.fill\("Reforma da sala"\)/u);
  assert.match(branch, /getByRole\("button", \{ name: "Vincular nota", exact: true \}\)\.click\(\)/u);
  assert.match(branch, /await linker\.waitFor\(\{ state: "hidden" \}\)/u);
  assert.match(branch, /finally \{ await closeCaptureContext\(context\); \}/u);
  assert.match(branch, /return;/u);
  assert.doesNotMatch(branch, /Salvar nota.*click|createTask|runAction|localStorage\.setItem|\.style\.|\/api\//u);
  const save = harness.slice(harness.indexOf("async function save("), harness.indexOf('  if (options.mode === "entrada") {\n    for (const'));
  assert.equal((save.match(/await assertEntryReadyNow\(page, scene\)/gu) ?? []).length, 2);
  assert.match(harness, /await mkdir\(isolatedOutput, \{ recursive: false \}\)/u);
  assert.match(harness, /tmpdir\(\) !== process\.env\.HOME/u);
  assert.match(harness, /await writeFile\(file, encoded\.data, \{ flag: "wx" \}\)/u);
  assert.match(harness, /receiptSha256: sha256\(content\), source/u);
});

async function entryNavigationFixture(change = {}) {
  const harness = await readFile(new URL("../../scripts/landing/capturar-telas.mjs", import.meta.url), "utf8");
  const start = harness.indexOf("async function navigateEntry("), end = harness.indexOf("\n// Avisos de confirmação", start);
  assert.ok(start > 0 && end > start);
  const events = [];
  let href = "about:blank", completeNavigation;
  const page = {
    url: () => href,
    waitForURL(url) {
      events.push(["navigation-listener", url]);
      if (change.fail === "navigation") return Promise.reject(Error("NAVIGATION_FAILED"));
      return new Promise(resolve => { completeNavigation = () => { href = change.finalUrl ?? url; resolve(); }; });
    },
    getByRole(role, options) {
      assert.equal(role, "button"); assert.equal(options.name, "Nova nota"); assert.equal(options.exact, true);
      return { async click() { events.push(["new-note"]); assert.ok(completeNavigation || change.fail === "navigation"); completeNavigation?.(); } };
    },
    locator(selector) {
      assert.equal(selector, ".capture-feature[data-mobile-editor='true'] section.capture-editor");
      return { async waitFor(options) {
        assert.equal(options.state, "visible"); events.push(["editor-visible"]);
        if (change.fail === "editor") throw Error("EDITOR_NOT_READY");
      } };
    },
  };
  const navigate = runInNewContext(`(${harness.slice(start, end).trim()})`, {
    base, entryScenes, assertEntryTarget,
    async gotoCapture(candidate, url) {
      assert.equal(candidate, page); events.push(["document", url]); href = url;
      if (change.fail === "document") throw Error("DOCUMENT_FAILED");
    },
    async ready(candidate) {
      assert.equal(candidate, page); events.push(["shell-ready"]);
      if (change.fail === "shell") throw Error("SHELL_NOT_READY");
    },
    assertNoRefusedRequests() {
      events.push(["health"]);
      if (change.fail === "health") throw Error("CAPTURE_REQUEST_REFUSED");
    },
  }, { timeout: 1000 });
  return { navigate: scene => navigate(page, scene), events };
}

test("Entry opens the Capture list then performs one real canonical navigation before editing", async () => {
  const fixture = await entryNavigationFixture();
  await fixture.navigate("captura");
  assert.deepEqual(fixture.events, [
    ["document", base + "/capturar"], ["shell-ready"],
    ["navigation-listener", base + "/capturar?capture=new"], ["new-note"],
    ["editor-visible"], ["health"],
  ]);
  assert.equal(fixture.events.filter(([kind]) => kind === "new-note").length, 1);
  assert.equal(fixture.events.some(([kind, url]) => kind === "document" && url.includes("?capture=new")), false);
});

test("Entry Home has no synthetic route or new-note transition and refuses unknown scenes", async () => {
  const home = await entryNavigationFixture();
  await home.navigate("inicio");
  assert.deepEqual(home.events, [["document", base + "/"], ["shell-ready"], ["health"]]);
  const unknown = await entryNavigationFixture();
  await assert.rejects(unknown.navigate("other"), /CAPTURE_ENTRY_TARGET/u);
  assert.deepEqual(unknown.events, []);
});

test("Entry navigation propagates document, readiness, navigation and health faults without retry", async () => {
  for (const [fail, code] of [["document", "DOCUMENT_FAILED"], ["shell", "SHELL_NOT_READY"], ["navigation", "NAVIGATION_FAILED"], ["editor", "EDITOR_NOT_READY"], ["health", "CAPTURE_REQUEST_REFUSED"]]) {
    const fixture = await entryNavigationFixture({ fail });
    await assert.rejects(fixture.navigate("captura"), new RegExp(code, "u"));
    assert.equal(fixture.events.filter(([kind]) => kind === "document").length, 1);
    assert.equal(fixture.events.filter(([kind]) => kind === "new-note").length, ["document", "shell"].includes(fail) ? 0 : 1);
    if (fail === "navigation") assert.equal(fixture.events.some(([kind]) => kind === "editor-visible"), false);
    if (fail === "editor") assert.equal(fixture.events.some(([kind]) => kind === "health"), false);
  }
  for (const finalUrl of [base + "/capturar", base + "/capturar?capture=new&extra=1", "https://foreign.test/capturar?capture=new"]) {
    const fixture = await entryNavigationFixture({ finalUrl });
    await assert.rejects(fixture.navigate("captura"), /CAPTURE_ENTRY_TARGET/u);
    assert.equal(fixture.events.some(([kind]) => kind === "health"), false);
  }
});

test("OG is a closed three-member staging capture with current-chapter readiness at both pixel boundaries", async () => {
  const harness = await readFile(new URL("../../scripts/landing/capturar-telas.mjs", import.meta.url), "utf8");
  const branch = harness.slice(harness.indexOf('  if (options.mode === "og") {\n    //'), harness.indexOf('  } else {\n    await capturarTema'));
  assert.equal((branch.match(/page\.evaluate\(ogReadyInPage\)/gu) ?? []).length, 2);
  assert.match(branch, /await page\.waitForFunction\(ogReadyInPage\)/u);
  assert.match(branch, /window\.scrollX === 0 && window\.scrollY === 0/u);
  assert.match(branch, /const destino = ogOutput/u);
  assert.match(branch, /ogExifDescription\(source\.sha\)/u);
  assert.match(branch, /await writeFile\(file, bitmap, \{ flag: "wx" \}\)/u);
  assert.match(branch, /ogAltText, \{ flag: "wx" \}/u);
  assert.doesNotMatch(branch, /path\.join\(root, "src\/app\/conheca"\)|\.toFile\(/u);
  assert.match(harness, /capture-og-contract\.mjs.*!== ogModuleSha256/u);
  assert.ok(harness.indexOf('if (options.mode === "og") {\n  if (ogSummary') > harness.indexOf('throw new Error("CAPTURE_SOURCE_CHANGED")'));
});
