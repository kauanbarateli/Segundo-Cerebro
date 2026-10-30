import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import {
  assertOgCaptureCompletion, assertOgSourceRelationship, assertOgStageMembers,
  captureInvocation, ogOutputMapping, validateOgInputRepository,
} from "../../scripts/landing/capture-project-ci.mjs";
import { ogEntrypointAction } from "../../scripts/landing/capture-og-ci.mjs";
import { entryFiles, entryReceipt, entryScenes } from "../../scripts/landing/capture-policy.mjs";

const assetDirectory = "src/components/features/conheca/telas/";
const receiptFile = "docs/implementation/evidence/landing-entry-capture.json";
const proofFile = "docs/implementation/evidence/doc18-landing-entry-qualification-20261026.json";
const codeFiles = ["scripts/landing/capturar-telas.mjs", "scripts/landing/capture-policy.mjs", "scripts/landing/capture-og-contract.mjs"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const environment = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_NO_REPLACE_OBJECTS: "1", GIT_TERMINAL_PROMPT: "0" };
for (const key of ["SystemRoot", "TEMP", "TMP"]) if (process.env[key]) environment[key] = process.env[key];
const git = (directory, ...args) => execFileSync("git", ["-c", "safe.directory=" + directory, "-c", "gc.auto=0", "-c", "core.autocrlf=false", "-c", "core.fsmonitor=false", "-c", "protocol.allow=never", "-c", "user.name=Public fixture", "-c", "user.email=fixture@example.invalid", "-C", directory, ...args], { env: environment, timeout: 10000, maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8").trim();
async function put(directory, file, bytes) { await mkdir(dirname(join(directory, file)), { recursive: true }); await writeFile(join(directory, file), bytes); }
async function commit(directory) { git(directory, "add", "--all"); git(directory, "commit", "--quiet", "--no-gpg-sign", "-m", "Public synthetic fixture"); }
async function sourceOf(directory) {
  return { sha: git(directory, "rev-parse", "HEAD"), tree: git(directory, "rev-parse", "HEAD^{tree}"),
    generatorSha256: hash(await readFile(join(directory, codeFiles[0]))), policySha256: hash(await readFile(join(directory, codeFiles[1]))) };
}

// These are public synthetic admission fixtures, never qualification of a real
// capture. Every Source/tree/dependency digest comes from this finite Git repo.
async function writeEvidence(directory, captured, contractDigest) {
  const members = [], records = [];
  for (const [index, file] of entryFiles().entries()) {
    const mobile = index % 2 === 1, scene = entryScenes[Math.floor(index / 2) % 2], theme = index < 4 ? "light" : "dark";
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, density = mobile ? 3 : 2;
    const clip = { x: 0, y: 0, ...viewport }, pixels = { width: viewport.width * density, height: viewport.height * density };
    const bitmap = Buffer.from("PUBLIC SYNTHETIC RASTER FIXTURE: " + file);
    const sidecar = json({ prompt: "Public synthetic fixture only", createdAt: "2026-10-26T12:00:00.000Z",
      capture: { version: 1, source: { ...captured }, mode: "demo", route: scene.route, state: scene.state, scene: scene.scene, theme, viewport, density, clip, pixels, sha256: hash(bitmap) } });
    await put(directory, assetDirectory + file, bitmap); await put(directory, assetDirectory + file + ".json", sidecar);
    members.push({ name: file, bytes: bitmap.length, sha256: hash(bitmap) }, { name: file + ".json", bytes: sidecar.length, sha256: hash(sidecar) });
    records.push({ file, sidecar: file + ".json", scene: scene.scene, route: scene.route, theme, viewport, density, clip, pixels,
      bytes: bitmap.length, sidecarBytes: sidecar.length, sha256: hash(bitmap), sidecarSha256: hash(sidecar) });
  }
  const receipt = { version: 1, scene: "entrada", mode: "demo", source: { ...captured }, claims: { hostedValidated: false, productionValidated: false },
    requestPolicy: { scope: "browser-capture", observed: 12, refused: 0, serviceWorkers: "block", webSockets: "deny", methods: ["GET"], origin: "http://127.0.0.1:3110" }, records };
  const receiptBytes = json(receipt); await put(directory, receiptFile, receiptBytes);
  members.push({ name: entryReceipt, bytes: receiptBytes.length, sha256: hash(receiptBytes) }); members.sort((a, b) => a.name.localeCompare(b.name));
  const artifactName = "landing-entry-" + captured.sha + "-" + captured.tree;
  const captureReport = { schemaVersion: 1, scenario: "landing-entry-capture-ci", status: "passed", code: "PASSED", source: { ...captured }, outputs: 17, receiptSha256: hash(receiptBytes),
    scope: { verified: true, appMode: "demo", bind: "127.0.0.1", port: 3110, ssrDemoConfirmed: true },
    owned: ["next", "capture"].map((role, index) => ({ role, pid: 42 + index, closed: true, diagnosticCodes: [], pageErrorDiagnostic: null, requestFailedDiagnostic: null })),
    codePins: { ogContractSha256: contractDigest }, portReleased: true, hostedValidated: false, productionValidated: false };
  const proof = { fixtureOnly: true, qualification: { schemaVersion: 1, scenario: "downloaded-landing-entry-qualification", qualified: true, source: { ...captured },
    run: { repository: "kauanbarateli/Segundo-Cerebro", workflowPath: ".github/workflows/ci.yml", id: 101, attempt: 1, artifactId: 102, artifactName },
    receiptSha256: hash(receiptBytes), members, claims: { metadataAuthority: "root-reviewed-github-metadata-and-supervisor-report", githubMetadataFetched: false, visualValidated: false, hostedValidated: false, productionValidated: false } },
    githubRunMetadata: { version: 1, repository: "kauanbarateli/Segundo-Cerebro", workflowPath: ".github/workflows/ci.yml", event: "push", branch: "codex/mvp-goals-terminal-20261023",
      headSha: captured.sha, headTree: captured.tree, runId: 101, runAttempt: 1, status: "completed", conclusion: "success",
      artifact: { id: 102, name: artifactName, runId: 101, runAttempt: 1, expired: false }, captureReport } };
  await put(directory, proofFile, json(proof));
  return { receipt, proof };
}

async function fixture(work) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "sc-og-supervisor-")));
  try {
    git(directory, "init", "--quiet");
    for (const file of codeFiles) await put(directory, file, Buffer.from("// Public dependency fixture: " + file + "\n"));
    await commit(directory);
    const captured = await sourceOf(directory), contractDigest = hash(await readFile(join(directory, codeFiles[2])));
    const data = await writeEvidence(directory, captured, contractDigest); await commit(directory);
    await work({ directory, captured, contractDigest, data, source: () => sourceOf(directory),
      save: async () => { await put(directory, receiptFile, json(data.receipt)); await put(directory, proofFile, json(data.proof)); await commit(directory); },
      rewrite: async next => { const rewritten = await writeEvidence(directory, next, contractDigest); await commit(directory); return rewritten; } });
  } finally {
    // Only the one mkdtemp directory created above may be removed recursively.
    assert.equal(dirname(directory), await realpath(tmpdir())); assert(basename(directory).startsWith("sc-og-supervisor-"));
    await rm(directory, { recursive: true, force: false });
  }
}

test("OG invocation and wrapper admit only the finite mode and exact argument shapes", () => {
  assert.deepEqual(captureInvocation("og"), { mode: "og", args: ["--og", "--base", "http://127.0.0.1:3110"], routes: ["/"], outputCount: 3 });
  assert.equal(ogEntrypointAction([]), "capture"); assert.equal(ogEntrypointAction(["--check-contract"]), "contract");
  for (const value of [undefined, "all", "OG", "../og", { mode: "og" }]) assert.throws(() => captureInvocation(value));
  for (const args of [null, {}, ["--og"], ["--only", "og"], ["--base", "https://foreign.invalid"], ["--check-contract", "extra"]]) assert.throws(() => ogEntrypointAction(args));
});

test("three basenames map explicitly to exactly the existing repository files", () => {
  assert.deepEqual(ogOutputMapping().map(({ file, member }) => ({ file, member })), [
    { file: "src/app/conheca/opengraph-image.png", member: "opengraph-image.png" },
    { file: "src/app/conheca/opengraph-image.png.json", member: "opengraph-image.png.json" },
    { file: "src/app/conheca/opengraph-image.alt.txt", member: "opengraph-image.alt.txt" },
  ]);
  assert(Object.isFrozen(ogOutputMapping()) && ogOutputMapping().every(Object.isFrozen));
  const names = ogOutputMapping().map(value => value.member); assertOgStageMembers(names.toReversed());
  for (const changed of [names.slice(1), [...names, "receipt.json"], [...names, names[0]], names.map((value, index) => index ? value : "../opengraph-image.png"), null]) assert.throws(() => assertOgStageMembers(changed));
});

test("cleanup must prove both owned processes closed and the port released", () => {
  const owned = [{ role: "next", closed: true }, { role: "capture", closed: true }];
  assertOgCaptureCompletion({ owned, portReleased: true });
  for (const changed of [{ owned, portReleased: false }, { owned: owned.slice(1), portReleased: true },
    { owned: [...owned, { role: "foreign", closed: true }], portReleased: true },
    { owned: owned.map((value, index) => index ? { ...value, closed: false } : value), portReleased: true },
    { owned: owned.toReversed(), portReleased: true }]) assert.throws(() => assertOgCaptureCompletion(changed), /CAPTURE_OG_CLEANUP/u);
});

test("coherent Git fixture binds the prior Source, all seventeen qualified members and eight hashes", async () => {
  await fixture(async f => {
    const result = await validateOgInputRepository(f.directory, await f.source());
    assert.deepEqual(result.qualificationSource, f.captured); assert.equal(result.images.length, 8);
    assert.equal(new Set(result.images.map(value => value.file)).size, 8);
    for (const value of result.images) assert.equal(value.sha256, hash(await readFile(join(f.directory, value.file))));
  });
});

for (const missing of [proofFile, receiptFile]) test(`missing ${basename(missing)} refuses admission`, async () => {
  await fixture(async f => { await rm(join(f.directory, missing)); await commit(f.directory); await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_INPUT_UNAVAILABLE/u); });
});

test("a proof present only in the worktree cannot authorize OG", async () => {
  await fixture(async f => { git(f.directory, "rm", "--cached", "--", proofFile); git(f.directory, "commit", "--quiet", "--no-gpg-sign", "-m", "Untrack public proof fixture");
    await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_TRACKED_INPUT/u); });
});

test("a changed committed raster or receipt cannot be substituted for the qualified hashes", async () => {
  await fixture(async f => {
    await put(f.directory, assetDirectory + entryFiles()[0], Buffer.from("Changed public fixture")); await commit(f.directory);
    await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_INPUT_DIGEST/u);
  });
  await fixture(async f => {
    f.data.receipt.requestPolicy.observed++; await put(f.directory, receiptFile, json(f.data.receipt)); await commit(f.directory);
    await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_ENTRY_PROOF/u);
  });
});

test("an unstaged change to a sidecar fails the Git blob check", async () => {
  await fixture(async f => { await put(f.directory, assetDirectory + entryFiles()[0] + ".json", Buffer.from("Uncommitted public fixture"));
    await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_TRACKED_INPUT/u); });
});

test("invalid Source length and an incorrect actual captured tree are refused", async () => {
  await fixture(async f => { await f.rewrite({ ...f.captured, sha: f.captured.sha + "0" });
    await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_ENTRY_PROOF/u); });
  await fixture(async f => { await f.rewrite({ ...f.captured, tree: (await f.source()).tree });
    await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_ENTRY_ANCESTRY/u); });
});

test("same Source, newer Source and a nonancestor cannot satisfy the real relationship guard", async () => {
  await fixture(async f => {
    const current = await f.source(); assertOgSourceRelationship(f.captured, current, f.captured.tree, true);
    assert.throws(() => assertOgSourceRelationship(current, current, current.tree, true), /CAPTURE_OG_ENTRY_ANCESTRY/u);
    assert.throws(() => assertOgSourceRelationship(current, f.captured, current.tree, false), /CAPTURE_OG_ENTRY_ANCESTRY/u);
    const detached = git(f.directory, "commit-tree", f.captured.tree, "-m", "Detached public capture source");
    await f.rewrite({ ...f.captured, sha: detached });
    await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_ENTRY_ANCESTRY/u);
  });
});

test("historical generator/policy/OG-contract digests must match their actual captured Git blobs", async () => {
  for (const key of ["generatorSha256", "policySha256"]) await fixture(async f => {
    await f.rewrite({ ...f.captured, [key]: "f".repeat(64) });
    await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_ENTRY_DEPENDENCY/u);
  });
  await fixture(async f => { f.data.proof.githubRunMetadata.captureReport.codePins.ogContractSha256 = "f".repeat(64); await f.save();
    await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_ENTRY_DEPENDENCY/u); });
});

test("extra qualified members and an unconfirmed historical cleanup are refused", async () => {
  await fixture(async f => { f.data.proof.qualification.members.push({ name: "extra.txt", bytes: 1, sha256: "f".repeat(64) }); await f.save();
    await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_ENTRY_MEMBERS/u); });
  for (const change of [capture => { capture.owned[1].closed = false; }, capture => { capture.portReleased = false; }, capture => { capture.status = "failed"; }]) await fixture(async f => {
    change(f.data.proof.githubRunMetadata.captureReport); await f.save(); await assert.rejects(validateOgInputRepository(f.directory, await f.source()), /CAPTURE_OG_ENTRY_PROOF/u);
  });
});

test("workflow remains exact Root push with both committed proof files and a single OG directory before Project", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const start = workflow.indexOf("      - name: Capturar somente OG3 após Entrada qualificada incorporada");
  const end = workflow.indexOf("      - name: Recapturar somente os quatro assets demo de Projetos");
  assert(start >= 0 && end > start); const section = workflow.slice(start, end);
  assert.match(section, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/codex\/mvp-goals-terminal-20261023'/u);
  assert.match(section, /hashFiles\('docs\/implementation\/evidence\/landing-entry-capture\.json'\) != '' && hashFiles\('docs\/implementation\/evidence\/doc18-landing-entry-qualification-20261026\.json'\) != ''/u);
  assert.equal((section.match(/path: /gu) ?? []).length, 1);
  assert.match(section, /path: \$\{\{ runner\.temp \}\}\/landing-og-/u);
  assert.match(section, /env -i PATH=/u); assert.match(section, /include-hidden-files: false/u);
  assert.doesNotMatch(section, /secrets\.|SUPABASE|Production|deploy|--all|--only og/u);
});

function assertOgFullHistoryCheckout(workflow) {
  const matches = [...workflow.matchAll(/^      - uses: actions\/checkout@v7\r?$/gmu)];
  assert.equal(matches.length, 1, "one existing checkout must provide the ancestry history");
  const start = matches[0].index;
  const end = workflow.indexOf("\n      - ", start + 1);
  assert(end > start);
  const checkout = workflow.slice(start, end);
  assert.match(checkout, /^        with:\r?\n          fetch-depth: 0\r?$/mu);
  const capture = workflow.indexOf("      - name: Capturar somente OG3 após Entrada qualificada incorporada");
  assert(capture > end, "checkout history must precede the OG supervisor");
  return checkout;
}
test("OG ancestry history is supplied by the existing full checkout, never a shallow or later checkout", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const checkout = assertOgFullHistoryCheckout(workflow);
  for (const replacement of ["", "          fetch-depth: 1", "          fetch-depth: 2", "          # fetch-depth: 0"]) {
    assert.throws(() => assertOgFullHistoryCheckout(workflow.replace("          fetch-depth: 0", replacement)));
  }
  const noCheckout = workflow.replace(checkout, "");
  assert.throws(() => assertOgFullHistoryCheckout(noCheckout));
  const late = noCheckout.replace("      - name: Capturar somente OG3 após Entrada qualificada incorporada",
    "      - name: Capturar somente OG3 após Entrada qualificada incorporada\n" + checkout);
  assert.throws(() => assertOgFullHistoryCheckout(late));
  assert.match(workflow, /node scripts\/verification\/check-ci-browser-libraries\.mjs/u);
  assert.doesNotMatch(workflow, /playwright\/cli\.js install-deps/u);
});
