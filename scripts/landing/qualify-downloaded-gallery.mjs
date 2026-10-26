// Offline, read-only qualification of an already downloaded Gallery17/Entrada17 directory.
// GitHub metadata and the supervisor report must be obtained/reviewed by Root
// independently of this directory. No capture process or batch content executes.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { devNull } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { assertEntryReceipt, assertGalleryExif, assertGalleryGeometry, assertGalleryReceipt } from "./capture-project-ci.mjs";
import { entryExifDescription, entryMembers, entryReceipt, entryScenes, galleryExifDescription, galleryMembers, galleryReceipt, galleryScenes } from "./capture-policy.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SHA = /^[a-f0-9]{40}$/u, DIGEST = /^[a-f0-9]{64}$/u;
const LIMITS = { image: 8 * 1024 * 1024, sidecar: 128 * 1024, receipt: 256 * 1024, metadata: 128 * 1024 };
const SOURCE_FILES = [
  ["scripts/landing/capturar-telas.mjs", 256 * 1024],
  ["scripts/landing/capture-policy.mjs", 128 * 1024],
  ["scripts/landing/capture-project-ci.mjs", 128 * 1024],
  ["scripts/landing/capture-og-contract.mjs", 64 * 1024],
];
// Callers select one fixed export, never supply validators, filenames or modes.
const CAPTURES = Object.freeze({
  gallery: Object.freeze({ members: galleryMembers, receipt: galleryReceipt, scenes: galleryScenes, exifDescription: galleryExifDescription, assertReceipt: assertGalleryReceipt, artifact: "gallery", captureScenario: "landing-gallery-capture-ci", qualificationScenario: "downloaded-landing-gallery-qualification" }),
  entry: Object.freeze({ members: entryMembers, receipt: entryReceipt, scenes: entryScenes, exifDescription: entryExifDescription, assertReceipt: assertEntryReceipt, artifact: "entry", captureScenario: "landing-entry-capture-ci", qualificationScenario: "downloaded-landing-entry-qualification" }),
});
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const exact = (value, keys) => !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const samePath = (a, b) => process.platform === "win32" ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);
const inside = (parent, child) => { const part = relative(parent, child); return !part || part !== ".." && !part.startsWith(".." + sep) && !isAbsolute(part); };
class GalleryQualificationError extends Error { constructor(code) { super(code); this.code = code; } }
const need = (condition, code) => { if (!condition) throw new GalleryQualificationError(code); };
function checked(work, code) { try { return work(); } catch { throw new GalleryQualificationError(code); } }
function timestamp(value, code) {
  need(typeof value === "string" && /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value), code);
  const time = Date.parse(value); need(Number.isFinite(time), code);
  need(new Date(time).toISOString().slice(0, 19) === value.slice(0, 19), code);
  return time;
}
function identity(stat) { return { dev: stat.dev, ino: stat.ino, size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, nlink: stat.nlink }; }
async function canonicalDirectory(value) {
  need(typeof value === "string" && isAbsolute(value), "GALLERY_DIRECTORY");
  const directory = resolve(value), stat = await lstat(directory);
  need(stat.isDirectory() && !stat.isSymbolicLink() && samePath(await realpath(directory), directory), "GALLERY_DIRECTORY");
  return { directory, identity: identity(stat) };
}
async function readRegular(file, cap) {
  const before = await lstat(file);
  need(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size > 0 && before.size <= cap && samePath(await realpath(file), file), "GALLERY_FILE_SHAPE");
  const expected = identity(before), handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    need(same(identity(await handle.stat()), expected), "GALLERY_FILE_CHANGED");
    // One sentinel byte bounds growth during a read without allocating from it.
    const buffer = Buffer.alloc(before.size + 1); let length = 0;
    while (length < buffer.length) { const result = await handle.read(buffer, length, buffer.length - length, length); if (!result.bytesRead) break; length += result.bytesRead; }
    need(length === before.size && same(identity(await handle.stat()), expected) && same(identity(await lstat(file)), expected), "GALLERY_FILE_CHANGED");
    return { bytes: buffer.subarray(0, length), identity: expected };
  } finally { await handle.close(); }
}
function gitEnvironment() {
  // Git for Windows accepts NUL, but not Node's \\.\nul spelling.
  const env = { LANG: "C.UTF-8", LC_ALL: "C.UTF-8", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : devNull, GIT_NO_REPLACE_OBJECTS: "1", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" };
  for (const key of ["PATH", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP"]) if (process.env[key]) env[key] = process.env[key];
  return env;
}
function git(repository, args, cap = 4096) {
  return checked(() => execFileSync("git", ["-c", "safe.directory=" + repository, "-c", "gc.auto=0", "-c", "core.fsmonitor=false", "-c", "protocol.allow=never", "-C", repository, ...args], {
    env: gitEnvironment(), timeout: 10000, maxBuffer: cap, stdio: ["ignore", "pipe", "ignore"],
  }), "GALLERY_GIT_SOURCE");
}
async function sourceFromGit(repository, sha, tree) {
  need(SHA.test(sha ?? "") && SHA.test(tree ?? ""), "GALLERY_SOURCE");
  const repo = (await canonicalDirectory(repository)).directory;
  need(samePath(git(repo, ["rev-parse", "--show-toplevel"]).toString("utf8").trim(), repo), "GALLERY_GIT_SOURCE");
  need(git(repo, ["rev-parse", "--verify", `${sha}^{commit}`]).toString("ascii").trim() === sha
    && git(repo, ["rev-parse", "--verify", `${sha}^{tree}`]).toString("ascii").trim() === tree, "GALLERY_SOURCE");
  const blobs = [];
  for (const [file, cap] of SOURCE_FILES) {
    const listing = git(repo, ["ls-tree", "-z", sha, "--", file]).toString("utf8");
    need(/^(?:100644|100755) blob [a-f0-9]{40}\t/u.test(listing) && listing.endsWith("\t" + file + "\0"), "GALLERY_GIT_SOURCE");
    const size = Number(git(repo, ["cat-file", "-s", `${sha}:${file}`]).toString("ascii").trim());
    need(Number.isSafeInteger(size) && size > 0 && size <= cap, "GALLERY_GIT_SOURCE");
    const bytes = git(repo, ["cat-file", "blob", `${sha}:${file}`], cap + 1);
    need(bytes.length === size, "GALLERY_GIT_SOURCE"); blobs.push(bytes);
  }
  // Imported validators must have the captured semantics. Read blobs, never
  // execute code from the captured commit or from the downloaded directory.
  for (const index of [1, 2]) {
    const current = await readRegular(join(ROOT, SOURCE_FILES[index][0]), SOURCE_FILES[index][1]);
    need(hash(current.bytes) === hash(blobs[index]), "GALLERY_POLICY_VERSION");
  }
  return { source: { sha, tree, generatorSha256: hash(blobs[0]), policySha256: hash(blobs[1]) }, codePins: { ogContractSha256: hash(blobs[3]) } };
}
function validateRunMetadata(value, source, codePins, kind) {
  need(exact(value, ["version", "repository", "workflowPath", "event", "branch", "headSha", "headTree", "runId", "runAttempt", "status", "conclusion", "startedAt", "completedAt", "artifact", "captureReport"]), "GALLERY_RUN_METADATA");
  need(value.version === 1 && value.repository === "kauanbarateli/Segundo-Cerebro" && value.workflowPath === ".github/workflows/ci.yml"
    && value.event === "push" && value.branch === "codex/mvp-goals-terminal-20261023" && value.headSha === source.sha && value.headTree === source.tree
    && Number.isSafeInteger(value.runId) && value.runId > 0 && Number.isSafeInteger(value.runAttempt) && value.runAttempt > 0
    && value.status === "completed" && value.conclusion === "success", "GALLERY_RUN_METADATA");
  const start = timestamp(value.startedAt, "GALLERY_RUN_TIME"), end = timestamp(value.completedAt, "GALLERY_RUN_TIME");
  need(end >= start, "GALLERY_RUN_TIME");
  const artifact = value.artifact;
  need(exact(artifact, ["id", "name", "runId", "runAttempt", "expired", "createdAt"]) && Number.isSafeInteger(artifact.id) && artifact.id > 0
    && artifact.name === `landing-${kind.artifact}-${source.sha}-${source.tree}` && artifact.runId === value.runId && artifact.runAttempt === value.runAttempt && artifact.expired === false, "GALLERY_ARTIFACT_METADATA");
  const artifactTime = timestamp(artifact.createdAt, "GALLERY_RUN_TIME");
  need(artifactTime >= start - 1000 && artifactTime <= end + 5000, "GALLERY_RUN_TIME");
  const capture = value.captureReport;
  need(capture && capture.schemaVersion === 1 && capture.scenario === kind.captureScenario && capture.status === "passed" && capture.code === "PASSED"
    && same(capture.source, source) && exact(capture.codePins, ["ogContractSha256"]) && same(capture.codePins, codePins) && capture.outputs === 17 && DIGEST.test(capture.receiptSha256 ?? "") && capture.portReleased === true
    && capture.hostedValidated === false && capture.productionValidated === false
    && same(capture.scope, { verified: true, appMode: "demo", bind: "127.0.0.1", port: 3110, ssrDemoConfirmed: true })
    && Array.isArray(capture.owned) && capture.owned.length === 2 && ["next", "capture"].every((role, index) => capture.owned[index]?.role === role && capture.owned[index].closed === true
      && same(capture.owned[index].diagnosticCodes, []) && capture.owned[index].pageErrorDiagnostic === null && capture.owned[index].requestFailedDiagnostic === null), "GALLERY_CAPTURE_REPORT");
  return { start, end, artifactTime, receiptSha256: capture.receiptSha256 };
}

/** Root attests metadata provenance; this function does not contact GitHub. */
export async function qualifyDownloadedGallery({ directory, sourceSha, sourceTree, runMetadata, repository = ROOT }) {
  return qualifyDownloadedRaster({ directory, sourceSha, sourceTree, runMetadata, repository }, CAPTURES.gallery);
}

/** Fixed Entrada17 contract; offline and read-only, with no visual admission. */
export async function qualifyDownloadedEntry({ directory, sourceSha, sourceTree, runMetadata, repository = ROOT }) {
  return qualifyDownloadedRaster({ directory, sourceSha, sourceTree, runMetadata, repository }, CAPTURES.entry);
}

async function qualifyDownloadedRaster({ directory, sourceSha, sourceTree, runMetadata, repository }, kind) {
  const canonical = await canonicalDirectory(directory), batch = canonical.directory;
  const { source, codePins } = await sourceFromGit(repository, sourceSha, sourceTree), window = validateRunMetadata(runMetadata, source, codePins, kind);
  const names = [...kind.members()].sort(), observed = (await readdir(batch)).sort();
  need(same(observed, names), "GALLERY_MEMBERS");
  const files = new Map();
  const read = async (name, cap) => {
    need(names.includes(name) && dirname(join(batch, name)) === batch, "GALLERY_MEMBERS");
    const entry = await readRegular(join(batch, name), cap); files.set(name, { name, bytes: entry.bytes.length, sha256: hash(entry.bytes), identity: entry.identity }); return entry.bytes;
  };
  const raw = await read(kind.receipt, LIMITS.receipt);
  // The independently reviewed CI report anchors the entire receipt. Rehashing
  // a forged receipt and its files cannot create its own admission authority.
  need(hash(raw) === window.receiptSha256, "GALLERY_RECEIPT_ANCHOR");
  const receipt = checked(() => JSON.parse(raw.toString("utf8")), "GALLERY_RECEIPT");
  checked(() => kind.assertReceipt(receipt, source), "GALLERY_RECEIPT");
  const capturedTimes = [];
  for (const [index, record] of receipt.records.entries()) {
    checked(() => assertGalleryGeometry(record, index), "GALLERY_GEOMETRY");
    const bitmap = await read(record.file, LIMITS.image), side = await read(record.sidecar, LIMITS.sidecar);
    need(bitmap.length === record.bytes && hash(bitmap) === record.sha256 && side.length === record.sidecarBytes && hash(side) === record.sidecarSha256, "GALLERY_DIGEST");
    const description = kind.exifDescription(record.scene, record.theme, index % 2 === 1, source.sha);
    checked(() => assertGalleryExif(bitmap, description), "GALLERY_EXIF");
    const metadata = await sharp(bitmap, { limitInputPixels: 12000 * 12000, failOn: "error", animated: false }).metadata().catch(() => { throw new GalleryQualificationError("GALLERY_IMAGE"); });
    need(metadata.format === "webp" && metadata.width === record.pixels.width && metadata.height === record.pixels.height
      && (metadata.pages === undefined || metadata.pages === 1) && metadata.loop === undefined && (metadata.orientation === undefined || metadata.orientation === 1), "GALLERY_IMAGE");
    const sidecar = checked(() => JSON.parse(side.toString("utf8")), "GALLERY_SIDECAR"), capture = sidecar.capture;
    need(exact(sidecar, ["prompt", "createdAt", "capture"]) && typeof sidecar.prompt === "string" && sidecar.prompt.length > 0 && sidecar.prompt.length <= 4096, "GALLERY_SIDECAR");
    const at = timestamp(sidecar.createdAt, "GALLERY_TIMESTAMP");
    need(at >= window.start - 1000 && at <= window.end + 5000 && at <= window.artifactTime + 5000, "GALLERY_TIMESTAMP"); capturedTimes.push(at);
    need(exact(capture, ["version", "source", "mode", "route", "state", "scene", "theme", "viewport", "density", "clip", "pixels", "sha256"])
      && capture.version === 1 && same(capture.source, source) && capture.mode === "demo" && capture.state === kind.scenes.find(scene => scene.scene === record.scene).state && capture.sha256 === record.sha256
      && ["scene", "route", "theme", "viewport", "density", "clip", "pixels"].every(key => same(capture[key], record[key])), "GALLERY_SIDECAR");
  }
  need(same((await readdir(batch)).sort(), names) && same(identity(await lstat(batch)), canonical.identity) && samePath(await realpath(batch), batch), "GALLERY_FILE_CHANGED");
  for (const entry of files.values()) need(same(identity(await lstat(join(batch, entry.name))), entry.identity), "GALLERY_FILE_CHANGED");
  return {
    schemaVersion: 1, scenario: kind.qualificationScenario, qualified: true,
    source, codePins, run: { repository: runMetadata.repository, workflowPath: runMetadata.workflowPath, id: runMetadata.runId, attempt: runMetadata.runAttempt, artifactId: runMetadata.artifact.id, artifactName: runMetadata.artifact.name },
    receiptSha256: window.receiptSha256, members: names.map(name => { const entry = files.get(name); return { name: entry.name, bytes: entry.bytes, sha256: entry.sha256 }; }),
    window: { startedAt: runMetadata.startedAt, completedAt: runMetadata.completedAt, firstCaptureAt: new Date(Math.min(...capturedTimes)).toISOString(), lastCaptureAt: new Date(Math.max(...capturedTimes)).toISOString() },
    claims: { metadataAuthority: "root-reviewed-github-metadata-and-supervisor-report", githubMetadataFetched: false, visualValidated: false, hostedValidated: false, productionValidated: false },
  };
}

export function parseGalleryQualificationArgs(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  const allowed = new Map([["--directory", "directory"], ["--source-sha", "sourceSha"], ["--source-tree", "sourceTree"], ["--run-metadata", "metadataPath"], ["--repository", "repository"]]);
  const options = {};
  for (let index = 0; index < args.length; index += 2) { const key = allowed.get(args[index]); need(key && !Object.hasOwn(options, key) && typeof args[index + 1] === "string" && !args[index + 1].startsWith("--"), "GALLERY_USAGE"); options[key] = args[index + 1]; }
  need(["directory", "sourceSha", "sourceTree", "metadataPath"].every(key => options[key]), "GALLERY_USAGE");
  return options;
}
export async function galleryQualificationCli(args, output = process.stdout) {
  const options = parseGalleryQualificationArgs(args);
  if (options.help) {
    output.write("Usage: node scripts/landing/qualify-downloaded-gallery.mjs --directory ABS --source-sha SHA40 --source-tree TREE40 --run-metadata ABS_JSON [--repository ABS]\nRoot-reviewed metadata: version/repository/workflowPath/event/branch/headSha/headTree/runId/runAttempt/status/conclusion/startedAt/completedAt/artifact{id,name,runId,runAttempt,expired,createdAt}/captureReport (the independent final supervisor JSON, including receiptSha256 and codePins{ogContractSha256}). No network, extraction, capture or writes. CLI emits a sanitized summary; the imported API returns the qualification report without writing it.\n"); return;
  }
  need(isAbsolute(options.metadataPath) && !inside(resolve(options.directory), resolve(options.metadataPath)), "GALLERY_RUN_METADATA");
  const raw = await readRegular(resolve(options.metadataPath), LIMITS.metadata);
  const runMetadata = checked(() => JSON.parse(raw.bytes.toString("utf8")), "GALLERY_RUN_METADATA");
  const report = await qualifyDownloadedGallery({ ...options, runMetadata });
  output.write(JSON.stringify({ ok: true, scenario: report.scenario, source: report.source, runId: report.run.id, runAttempt: report.run.attempt, artifactId: report.run.artifactId, members: report.members.length, receiptSha256: report.receiptSha256, visualValidated: false, reportWritten: false }) + "\n");
}
if (process.argv[1] && samePath(process.argv[1], fileURLToPath(import.meta.url))) {
  try { await galleryQualificationCli(process.argv.slice(2)); }
  catch (error) { process.stdout.write(JSON.stringify({ ok: false, code: error instanceof GalleryQualificationError ? error.code : "GALLERY_QUALIFICATION_FAILED", visualValidated: false }) + "\n"); process.exitCode = 1; }
}
