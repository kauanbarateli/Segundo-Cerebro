import assert from "node:assert/strict";
import test from "node:test";
import { resolve, join } from "node:path";
import { readFile } from "node:fs/promises";
import { entryScenes, entryFiles } from "../../scripts/landing/capture-policy.mjs";
import { assertEntryReceipt, assertEntryStage, assertGalleryReceipt, captureInvocation } from "../../scripts/landing/capture-project-ci.mjs";
import { entryEntrypointAction } from "../../scripts/landing/capture-entry-ci.mjs";

const base = "http://127.0.0.1:3110";
const source = { sha: "a".repeat(40), tree: "b".repeat(40), generatorSha256: "c".repeat(64), policySha256: "d".repeat(64) };
function receipt() {
  return { version: 1, scene: "entrada", mode: "demo", source: { ...source },
    claims: { hostedValidated: false, productionValidated: false },
    requestPolicy: { scope: "browser-capture", observed: 24, refused: 0, serviceWorkers: "block", webSockets: "deny", methods: ["GET"], origin: base },
    records: entryFiles().map((file, index) => {
      const scene = entryScenes[Math.floor(index / 2) % 2], mobile = index % 2 === 1;
      const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, density = mobile ? 3 : 2;
      return { file, sidecar: file + ".json", scene: scene.scene, route: scene.route,
        sha256: "e".repeat(64), sidecarSha256: "f".repeat(64), bytes: 123, sidecarBytes: 456,
        theme: index < 4 ? "light" : "dark", viewport, density, clip: { x: 0, y: 0, ...viewport },
        pixels: { width: viewport.width * density, height: viewport.height * density } };
    }) };
}

test("entry supervisor admits only its eight ordered variants and cannot impersonate Gallery", () => {
  assertEntryReceipt(receipt(), source);
  assert.throws(() => assertGalleryReceipt(receipt(), source));
  for (const mutate of [value => value.records.pop(), value => value.records.reverse(),
    value => { value.records[2].route = "/capturar"; }, value => { value.records[0].file = "projeto.webp"; },
    value => { value.records[0].pixels.width = 1440; }, value => { value.records[1].clip.y = -1; },
    value => { value.source.sha = "0".repeat(40); }, value => { value.records[0].extra = true; }]) {
    const value = receipt(); mutate(value); assert.throws(() => assertEntryReceipt(value, source));
  }
});

test("entry rejects connected claims, failed health and non-GET/private requests", () => {
  for (const mutate of [value => { value.mode = "supabase"; }, value => { value.claims.hostedValidated = true; },
    value => { value.claims.productionValidated = true; }, value => { value.requestPolicy.refused = 1; },
    value => { value.requestPolicy.origin = "https://private.invalid"; }, value => { value.requestPolicy.methods.push("POST"); },
    value => { value.requestPolicy.serviceWorkers = "allow"; }, value => { value.requestPolicy.webSockets = "allow"; }]) {
    const value = receipt(); mutate(value); assert.throws(() => assertEntryReceipt(value, source));
  }
});

test("entry stage cannot target Gallery, arbitrary paths or another Source", () => {
  const parent = resolve("entry-stage-fixture"), stage = join(parent, `landing-entry-${source.sha}-${source.tree}`);
  assertEntryStage(parent, stage, source);
  for (const path of [join(parent, `landing-gallery-${source.sha}-${source.tree}`), join(parent, "nested", "entry"), resolve(parent, "..", "outside")]) {
    assert.throws(() => assertEntryStage(parent, path, source));
  }
  assert.throws(() => assertEntryStage(parent, stage, { ...source, tree: "f".repeat(40) }));
});

test("entry wrapper exposes no route, output or secret option", () => {
  assert.equal(entryEntrypointAction([]), "capture");
  assert.equal(entryEntrypointAction(["--check-contract"]), "contract");
  assert.deepEqual(captureInvocation("entrada"), { mode: "entrada", args: ["--only", "entrada", "--base", base], routes: ["/", "/capturar?capture=new"], outputCount: 17 });
  for (const args of [null, ["--only", "all"], ["--output", "/tmp"], ["--check-contract", "--check-contract"]]) assert.throws(() => entryEntrypointAction(args));
});

test("entry CI keeps the root-only scope and uploads one qualified directory before Project dirties its own output paths", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const start = workflow.indexOf("id: landing_entry"), end = workflow.indexOf("id: landing_projects");
  assert.ok(start > 0 && end > start);
  const step = workflow.slice(start, end);
  assert.match(step, /github\.event_name == 'push'/u);
  assert.match(step, /github\.ref == 'refs\/heads\/codex\/mvp-goals-terminal-20261023'/u);
  assert.match(step, /env -i PATH=/u);
  assert.match(step, /node scripts\/landing\/capture-entry-ci\.mjs/u);
  assert.match(step, /^          path: \$\{\{ runner.temp \}\}\/landing-entry-\$\{\{ github.sha \}\}-\$\{\{ steps.landing_entry.outputs.source_tree \}\}\/$/mu);
  assert.doesNotMatch(step, /^          path: [|>]/mu);
  assert.match(step, /if-no-files-found: error/u);
});
