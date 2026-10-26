import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import sharp from "sharp";
import { entryExifDescription, entryFiles, entryReceipt, entryScenes, galleryExifDescription, galleryFiles, galleryReceipt, galleryScenes } from "../../scripts/landing/capture-policy.mjs";
import { galleryQualificationCli, parseGalleryQualificationArgs, qualifyDownloadedEntry, qualifyDownloadedGallery } from "../../scripts/landing/qualify-downloaded-gallery.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const files = ["scripts/landing/capturar-telas.mjs", "scripts/landing/capture-policy.mjs", "scripts/landing/capture-project-ci.mjs", "scripts/landing/capture-og-contract.mjs"];
let temporary, repository, source, codePins, images, entryImages;

function git(args) {
  return execFileSync("git", ["-c", "core.autocrlf=false", "-c", "core.hooksPath=" + join(temporary, "no-hooks"), "-c", "commit.gpgSign=false", "-C", repository, ...args], { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] }).trim();
}
before(async () => {
  temporary = await mkdtemp(join(await realpath(tmpdir()), "gallery-qualifier-"));
  repository = join(temporary, "source-repository");
  await mkdir(join(repository, "scripts/landing"), { recursive: true });
  for (const file of files) await copyFile(join(ROOT, file), join(repository, file));
  git(["init", "--quiet"]);
  git(["add", "--", ...files]);
  git(["-c", "user.name=Gallery qualifier test", "-c", "user.email=qualifier-test@example.invalid", "commit", "--quiet", "--no-verify", "-m", "Fixture: captured source blobs"]);
  source = { sha: git(["rev-parse", "HEAD"]), tree: git(["rev-parse", "HEAD^{tree}"]), generatorSha256: hash(await readFile(join(repository, files[0]))), policySha256: hash(await readFile(join(repository, files[1]))) };
  codePins = { ogContractSha256: hash(await readFile(join(repository, files[3]))) };
  images = await Promise.all(galleryFiles().map(async (_, index) => {
    const scene = galleryScenes[Math.floor(index / 2) % 2], mobile = index % 2 === 1, theme = index < 4 ? "light" : "dark", density = mobile ? 3 : 2;
    return sharp({ create: { width: 32 * density, height: 24 * density, channels: 3, background: "#385c72" } }).webp().withExif({ IFD0: { ImageDescription: galleryExifDescription(scene.scene, theme, mobile, source.sha) } }).toBuffer();
  }));
  entryImages = await Promise.all(entryFiles().map(async (_, index) => {
    const scene = entryScenes[Math.floor(index / 2) % 2], mobile = index % 2 === 1, theme = index < 4 ? "light" : "dark", density = mobile ? 3 : 2;
    return sharp({ create: { width: 32 * density, height: 24 * density, channels: 3, background: "#385c72" } }).webp().withExif({ IFD0: { ImageDescription: entryExifDescription(scene.scene, theme, mobile, source.sha) } }).toBuffer();
  }));
});
after(async () => {
  if (!temporary) return;
  const parent = await realpath(tmpdir()), target = resolve(temporary), part = relative(parent, target);
  assert.ok(part.startsWith("gallery-qualifier-") && !part.includes(sep) && dirname(target) === parent, "cleanup is limited to this test's own temporary directory");
  await rm(target, { recursive: true, force: false });
});

async function fixture(kind = "gallery") {
  assert.ok(kind === "gallery" || kind === "entry");
  const isEntry = kind === "entry", memberFiles = isEntry ? entryFiles() : galleryFiles(), scenes = isEntry ? entryScenes : galleryScenes, bitmaps = isEntry ? entryImages : images;
  const directory = await mkdtemp(join(temporary, "batch-")), records = [];
  for (const [index, file] of memberFiles.entries()) {
    const scene = scenes[Math.floor(index / 2) % 2], mobile = index % 2 === 1, density = mobile ? 3 : 2;
    const common = { scene: scene.scene, theme: index < 4 ? "light" : "dark", viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, density, clip: { x: 0, y: 0, width: 32, height: 24 }, pixels: { width: 32 * density, height: 24 * density }, route: scene.route };
    const bitmap = bitmaps[index], side = json({ prompt: "Real demo fixture, no conceptual imagery.", createdAt: "2026-10-26T00:04:00.000Z", capture: { version: 1, source, mode: "demo", state: scene.state, ...common, sha256: hash(bitmap) } });
    await writeFile(join(directory, file), bitmap);
    await writeFile(join(directory, `${file}.json`), side);
    records.push({ file, sha256: hash(bitmap), bytes: bitmap.length, sidecar: `${file}.json`, sidecarSha256: hash(side), sidecarBytes: side.length, ...common });
  }
  const receipt = { version: 1, scene: isEntry ? "entrada" : "galeria", mode: "demo", source, claims: { hostedValidated: false, productionValidated: false }, requestPolicy: { scope: "browser-capture", observed: 42, refused: 0, serviceWorkers: "block", webSockets: "deny", methods: ["GET"], origin: "http://127.0.0.1:3110" }, records };
  const raw = json(receipt);
  await writeFile(join(directory, isEntry ? entryReceipt : galleryReceipt), raw);
  const runMetadata = {
    version: 1, repository: "kauanbarateli/Segundo-Cerebro", workflowPath: ".github/workflows/ci.yml", event: "push", branch: "codex/mvp-goals-terminal-20261023", headSha: source.sha, headTree: source.tree,
    runId: 123456, runAttempt: 2, status: "completed", conclusion: "success", startedAt: "2026-10-26T00:00:00.000Z", completedAt: "2026-10-26T00:10:00.000Z",
    artifact: { id: 987654, name: `landing-${kind}-${source.sha}-${source.tree}`, runId: 123456, runAttempt: 2, expired: false, createdAt: "2026-10-26T00:07:00.000Z" },
    captureReport: { schemaVersion: 1, scenario: `landing-${kind}-capture-ci`, status: "passed", code: "PASSED", source, codePins: { ...codePins }, outputs: 17, receiptSha256: hash(raw), portReleased: true, hostedValidated: false, productionValidated: false, scope: { verified: true, appMode: "demo", bind: "127.0.0.1", port: 3110, ssrDemoConfirmed: true }, owned: ["next", "capture"].map(role => ({ role, closed: true, diagnosticCodes: [], pageErrorDiagnostic: null, requestFailedDiagnostic: null })) },
  };
  return { directory, sourceSha: source.sha, sourceTree: source.tree, repository, runMetadata, receipt };
}
async function reanchor(fixture) {
  const raw = json(fixture.receipt);
  await writeFile(join(fixture.directory, fixture.receipt.scene === "entrada" ? entryReceipt : galleryReceipt), raw);
  fixture.runMetadata.captureReport.receiptSha256 = hash(raw);
}
async function changeSidecar(fixture, change) {
  const record = fixture.receipt.records[0], file = join(fixture.directory, record.sidecar), sidecar = JSON.parse(await readFile(file, "utf8"));
  change(sidecar);
  const raw = json(sidecar);
  await writeFile(file, raw);
  record.sidecarSha256 = hash(raw); record.sidecarBytes = raw.length;
  await reanchor(fixture);
}
const refuses = (work, code) => assert.rejects(work, error => error.code === code, code);
async function batchSnapshot(directory) {
  const snapshot = [];
  for (const name of (await readdir(directory)).sort()) {
    const file = join(directory, name), stat = await lstat(file);
    snapshot.push({ name, size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, digest: hash(await readFile(file)) });
  }
  return snapshot;
}

test("qualifies exact Gallery17 against Git Source and independent CI receipt anchor without modifying the batch", async () => {
  const input = await fixture(), before = await batchSnapshot(input.directory), report = await qualifyDownloadedGallery(input);
  assert.equal(report.qualified, true);
  assert.deepEqual(report.source, source);
  assert.equal(report.members.length, 17);
  assert.deepEqual(report.codePins, codePins);
  assert.equal(report.receiptSha256, input.runMetadata.captureReport.receiptSha256);
  assert.deepEqual(report.window, { startedAt: input.runMetadata.startedAt, completedAt: input.runMetadata.completedAt, firstCaptureAt: "2026-10-26T00:04:00.000Z", lastCaptureAt: "2026-10-26T00:04:00.000Z" });
  assert.deepEqual(report.claims, { metadataAuthority: "root-reviewed-github-metadata-and-supervisor-report", githubMetadataFetched: false, visualValidated: false, hostedValidated: false, productionValidated: false });
  assert.deepEqual(await batchSnapshot(input.directory), before);
  assert.ok(!JSON.stringify(report).includes("Real demo fixture"));
});

for (const [name, change, code] of [
  ["invalid Source SHA", input => { input.sourceSha = "main"; }, "GALLERY_SOURCE"],
  ["Source tree not belonging to the commit", input => { input.sourceTree = "a".repeat(40); }, "GALLERY_SOURCE"],
  ["unknown Source commit", input => { input.sourceSha = "a".repeat(40); }, "GALLERY_GIT_SOURCE"],
  ["untrusted repository", input => { input.runMetadata.repository = "another/repository"; }, "GALLERY_RUN_METADATA"],
  ["PR event instead of supervised push", input => { input.runMetadata.event = "pull_request"; }, "GALLERY_RUN_METADATA"],
  ["different capture branch", input => { input.runMetadata.branch = "main"; }, "GALLERY_RUN_METADATA"],
  ["failed complete workflow", input => { input.runMetadata.conclusion = "failure"; }, "GALLERY_RUN_METADATA"],
  ["incomplete workflow", input => { input.runMetadata.status = "in_progress"; }, "GALLERY_RUN_METADATA"],
  ["run Source differs from requested Source", input => { input.runMetadata.headSha = "b".repeat(40); }, "GALLERY_RUN_METADATA"],
  ["artifact for another run", input => { input.runMetadata.artifact.runId++; }, "GALLERY_ARTIFACT_METADATA"],
  ["artifact for another attempt", input => { input.runMetadata.artifact.runAttempt++; }, "GALLERY_ARTIFACT_METADATA"],
  ["misnamed artifact", input => { input.runMetadata.artifact.name += "-forged"; }, "GALLERY_ARTIFACT_METADATA"],
  ["expired artifact", input => { input.runMetadata.artifact.expired = true; }, "GALLERY_ARTIFACT_METADATA"],
  ["missing independent receipt anchor", input => { delete input.runMetadata.captureReport.receiptSha256; }, "GALLERY_CAPTURE_REPORT"],
  ["failed child cleanup", input => { input.runMetadata.captureReport.owned[0].closed = false; }, "GALLERY_CAPTURE_REPORT"],
  ["recorded page diagnostic", input => { input.runMetadata.captureReport.owned[1].pageErrorDiagnostic = "CAPTURE_PAGE_ERROR"; }, "GALLERY_CAPTURE_REPORT"],
  ["incompatible captured generator hash", input => { input.runMetadata.captureReport.source = { ...source, generatorSha256: "b".repeat(64) }; }, "GALLERY_CAPTURE_REPORT"],
  ["missing independently pinned OG contract", input => { delete input.runMetadata.captureReport.codePins; }, "GALLERY_CAPTURE_REPORT"],
  ["OG contract pin not belonging to the Git Source", input => { input.runMetadata.captureReport.codePins.ogContractSha256 = "b".repeat(64); }, "GALLERY_CAPTURE_REPORT"],
  ["undeclared supervisor code pin", input => { input.runMetadata.captureReport.codePins.unexpected = undefined; }, "GALLERY_CAPTURE_REPORT"],
  ["run end before start", input => { input.runMetadata.completedAt = "2026-10-25T23:59:00Z"; }, "GALLERY_RUN_TIME"],
  ["impossible date", input => { input.runMetadata.startedAt = "2026-02-30T00:00:00Z"; }, "GALLERY_RUN_TIME"],
  ["artifact after run", input => { input.runMetadata.artifact.createdAt = "2026-10-26T00:11:00Z"; }, "GALLERY_RUN_TIME"],
]) test(`rejects ${name}`, async () => { const input = await fixture(); change(input); await refuses(() => qualifyDownloadedGallery(input), code); });

test("derives generator hash from commit blobs, never the changed worktree or self-described batch", async () => {
  const input = await fixture(), path = join(repository, files[0]), previous = await readFile(path);
  try {
    await writeFile(path, "throw new Error('must never execute');\n");
    assert.equal((await qualifyDownloadedGallery(input)).source.generatorSha256, source.generatorSha256);
  } finally { await writeFile(path, previous); }
  input.receipt.source = { ...source, generatorSha256: "c".repeat(64) };
  await reanchor(input);
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_RECEIPT");
});

test("derives the separate OG code pin from its Source blob, preserving the four-field Source", async () => {
  const input = await fixture(), path = join(repository, files[3]), previous = await readFile(path);
  try {
    await writeFile(path, "throw new Error('worktree must never execute');\n");
    const report = await qualifyDownloadedGallery(input);
    assert.deepEqual(report.codePins, codePins);
    assert.deepEqual(Object.keys(report.source).sort(), ["generatorSha256", "policySha256", "sha", "tree"]);
  } finally { await writeFile(path, previous); }
});

test("qualifies exact Entrada17 through the fixed read-only export without granting visual acceptance", async () => {
  const input = await fixture("entry"), before = await batchSnapshot(input.directory), report = await qualifyDownloadedEntry(input);
  assert.equal(report.qualified, true);
  assert.equal(report.scenario, "downloaded-landing-entry-qualification");
  assert.equal(report.members.length, 17);
  assert.deepEqual(report.source, source);
  assert.deepEqual(report.codePins, codePins);
  assert.equal(report.run.artifactName, `landing-entry-${source.sha}-${source.tree}`);
  assert.equal(report.claims.visualValidated, false);
  assert.equal(report.claims.hostedValidated, false);
  assert.equal(report.claims.productionValidated, false);
  assert.deepEqual(await batchSnapshot(input.directory), before);
});

test("does not confuse Gallery and Entrada independent metadata or member contracts", async () => {
  const gallery = await fixture(), entry = await fixture("entry");
  await refuses(() => qualifyDownloadedEntry(gallery), "GALLERY_ARTIFACT_METADATA");
  await refuses(() => qualifyDownloadedGallery(entry), "GALLERY_ARTIFACT_METADATA");
  entry.runMetadata.captureReport.scenario = "landing-gallery-capture-ci";
  await refuses(() => qualifyDownloadedEntry(entry), "GALLERY_CAPTURE_REPORT");
});

test("rejects a Gallery filename substituted into an Entrada17 batch", async () => {
  const input = await fixture("entry"), original = join(input.directory, input.receipt.records[0].file);
  await copyFile(original, join(input.directory, galleryFiles()[0])); await rm(original);
  await refuses(() => qualifyDownloadedEntry(input), "GALLERY_MEMBERS");
});

test("rejects an Entrada17 OG code pin not anchored to the requested Source", async () => {
  const input = await fixture("entry"); input.runMetadata.captureReport.codePins.ogContractSha256 = "e".repeat(64);
  await refuses(() => qualifyDownloadedEntry(input), "GALLERY_CAPTURE_REPORT");
});

test("does not admit an Entrada17 self-rehashed receipt without its independent anchor", async () => {
  const input = await fixture("entry"); input.receipt.requestPolicy.observed++;
  await writeFile(join(input.directory, entryReceipt), json(input.receipt));
  await refuses(() => qualifyDownloadedEntry(input), "GALLERY_RECEIPT_ANCHOR");
});

test("keeps Entrada17 capture times inside the independently supplied run window", async () => {
  const input = await fixture("entry"); await changeSidecar(input, side => { side.createdAt = "2026-10-26T00:11:00.000Z"; });
  await refuses(() => qualifyDownloadedEntry(input), "GALLERY_TIMESTAMP");
});

test("refuses captured policy semantics different from the imported pure validators", async () => {
  const input = await fixture(), previous = await readFile(join(repository, files[1]));
  try {
    await writeFile(join(repository, files[1]), Buffer.concat([previous, Buffer.from("\n// changed semantics\n")]));
    git(["add", "--", files[1]]);
    git(["-c", "user.name=Gallery qualifier test", "-c", "user.email=qualifier-test@example.invalid", "commit", "--quiet", "--no-verify", "-m", "Fixture: changed policy"]);
    input.sourceSha = git(["rev-parse", "HEAD"]); input.sourceTree = git(["rev-parse", "HEAD^{tree}"]);
    await refuses(() => qualifyDownloadedGallery(input), "GALLERY_POLICY_VERSION");
  } finally { await writeFile(join(repository, files[1]), previous); }
});

for (const [name, mutate] of [
  ["missing receipt", input => rm(join(input.directory, galleryReceipt))],
  ["extra member", input => writeFile(join(input.directory, "unexpected.json"), "{}")],
  ["missing image", input => rm(join(input.directory, input.receipt.records[0].file))],
]) test(`rejects ${name}`, async () => { const input = await fixture(); await mutate(input); await refuses(() => qualifyDownloadedGallery(input), "GALLERY_MEMBERS"); });

test("refuses a directory in place of a member", async () => {
  const input = await fixture(), file = join(input.directory, input.receipt.records[0].file);
  await rm(file); await mkdir(file);
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_FILE_SHAPE");
});
test("refuses a hard-linked member when the operating system permits creating one", async t => {
  const input = await fixture(), file = join(input.directory, input.receipt.records[0].file), outside = join(temporary, "linked-image.webp");
  try { await link(file, outside); } catch (error) { if (["EPERM", "EACCES"].includes(error.code)) return t.skip("OS does not permit this process to create hardlinks"); throw error; }
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_FILE_SHAPE");
});
test("refuses a symlink member when the operating system permits creating one", async t => {
  const input = await fixture(), file = join(input.directory, input.receipt.records[0].file), outside = join(temporary, "symbolic-image.webp");
  await copyFile(file, outside); await rm(file);
  try { await symlink(outside, file, "file"); } catch (error) { if (["EPERM", "EACCES"].includes(error.code)) return t.skip("OS does not permit this process to create file symlinks"); throw error; }
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_FILE_SHAPE");
});
test("refuses a symlink/junction batch directory when the operating system permits creating one", async t => {
  const input = await fixture(), path = join(temporary, "junction-batch");
  try { await symlink(input.directory, path, process.platform === "win32" ? "junction" : "dir"); } catch (error) { if (["EPERM", "EACCES"].includes(error.code)) return t.skip("OS does not permit this process to create directory links"); throw error; }
  input.directory = path;
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_DIRECTORY");
});

test("refuses path traversal inside a receipt even with an independently updated anchor", async () => {
  const input = await fixture(); input.receipt.records[0].file = "../outside.webp"; await reanchor(input);
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_RECEIPT");
});
test("refuses a changed bitmap without trusting its sidecar", async () => {
  const input = await fixture(); await writeFile(join(input.directory, input.receipt.records[0].file), "tampered bitmap");
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_DIGEST");
});
test("refuses a changed sidecar", async () => {
  const input = await fixture(); await writeFile(join(input.directory, input.receipt.records[0].sidecar), "{}");
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_DIGEST");
});
test("does not accept self-rehashed receipt and files as their own authority", async () => {
  const input = await fixture(); input.receipt.requestPolicy.observed++;
  await writeFile(join(input.directory, galleryReceipt), json(input.receipt));
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_RECEIPT_ANCHOR");
});
for (const at of ["2026-10-25T23:59:00.000Z", "2026-10-26T00:11:00.000Z", "2026-10-26T00:08:00.000Z", "2026-02-30T00:01:00Z"]) test(`refuses capture time outside the trusted run/artifact window: ${at}`, async () => {
  const input = await fixture(); await changeSidecar(input, side => { side.createdAt = at; });
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_TIMESTAMP");
});
for (const [name, mutate] of [
  ["wrong state", side => { side.capture.state = "different-state"; }],
  ["unexpected schema field", side => { side.capture.private = "must-not-pass"; }],
  ["different Source", side => { side.capture.source = { ...source, sha: "d".repeat(40) }; }],
]) test(`refuses sidecar ${name}`, async () => { const input = await fixture(); await changeSidecar(input, mutate); await refuses(() => qualifyDownloadedGallery(input), "GALLERY_SIDECAR"); });

test("refuses EXIF unrelated to the captured Source even if trusted hashes were reissued", async () => {
  const input = await fixture(), record = input.receipt.records[0], bitmap = await sharp(images[0]).withExif({ IFD0: { ImageDescription: "Unrelated image" } }).webp().toBuffer();
  await writeFile(join(input.directory, record.file), bitmap); record.sha256 = hash(bitmap); record.bytes = bitmap.length;
  await changeSidecar(input, side => { side.capture.sha256 = record.sha256; });
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_EXIF");
});
test("checks actual WebP dimensions instead of trusting matching receipt/sidecar geometry", async () => {
  const input = await fixture(), record = input.receipt.records[0]; record.clip.width++; record.pixels.width += record.density;
  await changeSidecar(input, side => { side.capture.clip = record.clip; side.capture.pixels = record.pixels; });
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_IMAGE");
});
test("rejects invalid declared geometry", async () => {
  const input = await fixture(); input.receipt.records[0].density = 3; await reanchor(input);
  await refuses(() => qualifyDownloadedGallery(input), "GALLERY_RECEIPT");
});

test("CLI requires explicit trusted metadata and emits only a sanitized qualification summary without writing files", async () => {
  const input = await fixture(), path = join(temporary, "cli-metadata.json"), before = await batchSnapshot(input.directory);
  await writeFile(path, json(input.runMetadata));
  const outsideBefore = (await readdir(temporary)).sort();
  let output = "";
  await galleryQualificationCli(["--directory", input.directory, "--source-sha", source.sha, "--source-tree", source.tree, "--run-metadata", path, "--repository", repository], { write: value => { output += value; } });
  const summary = JSON.parse(output);
  assert.equal(summary.ok, true); assert.equal(summary.members, 17); assert.equal(summary.reportWritten, false); assert.equal(summary.visualValidated, false);
  assert.ok(!output.includes(temporary) && !output.includes("Real demo fixture"));
  assert.deepEqual(await batchSnapshot(input.directory), before);
  assert.deepEqual((await readdir(temporary)).sort(), outsideBefore);
  const inside = join(input.directory, "metadata.json");
  await refuses(() => galleryQualificationCli(["--directory", input.directory, "--source-sha", source.sha, "--source-tree", source.tree, "--run-metadata", inside, "--repository", repository]), "GALLERY_RUN_METADATA");
});
test("CLI parser rejects ambiguous or missing flags and exposes offline help", async () => {
  for (const args of [[], ["--help", "extra"], ["--directory", "/tmp/a", "--directory", "/tmp/b"], ["--token", "secret"], ["--report", "/tmp/report.json"], ["--directory"]]) assert.throws(() => parseGalleryQualificationArgs(args), { code: "GALLERY_USAGE" });
  let output = ""; await galleryQualificationCli(["--help"], { write: value => { output += value; } });
  assert.match(output, /independent final supervisor JSON/u); assert.match(output, /No network, extraction, capture or writes/u); assert.doesNotMatch(output, /--report/u);
});
test("executable failures do not disclose a path or untrusted values", () => {
  const marker = "PRIVATE_CANARY_SHOULD_NOT_APPEAR";
  let result;
  try { execFileSync(process.execPath, [join(ROOT, "scripts/landing/qualify-downloaded-gallery.mjs"), "--token", marker], { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] }); assert.fail("invalid CLI must fail"); }
  catch (error) { assert.equal(error.status, 1); result = error.stdout; assert.equal(error.stderr, ""); }
  assert.deepEqual(JSON.parse(result), { ok: false, code: "GALLERY_USAGE", visualValidated: false }); assert.ok(!result.includes(marker));
});
