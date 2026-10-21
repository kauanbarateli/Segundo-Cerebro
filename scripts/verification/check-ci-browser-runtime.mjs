/** Read-only GitHub preflight. Browser installation and application acceptance are separate gates. */
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CACHE = "/ms-playwright";
const DRIVER = "1.63.0";
const VERSION = "153.0.8010.12";
const IMAGE_NAME = "mcr.microsoft.com/playwright:v1.63.0-noble";
export const CI_BROWSER_IMAGE = IMAGE_NAME + "@sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7";
const MIB = 1048576;
const EXECUTABLES = Object.freeze([
  Object.freeze({ name: "chromium", revision: "1243", relative: "chromium-1243/chrome-linux64/chrome", maxBytes: 350 * MIB }),
  Object.freeze({ name: "chromium-headless-shell", revision: "1243", relative: "chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell", maxBytes: 350 * MIB }),
  Object.freeze({ name: "ffmpeg", revision: "1011", relative: "ffmpeg-1011/ffmpeg-linux", maxBytes: 64 * MIB }),
]);
const CODES = new Set(["ENVIRONMENT_REFUSED", "PATH_REFUSED", "SDK_REFUSED", "IMAGE_REFUSED", "CACHE_REFUSED", "BINARY_REFUSED", "VERSION_COMMAND_REFUSED", "VERSION_REFUSED", "RUNTIME_REFUSED"]);
const VERSION_COMPONENTS = new Set(["full", "headless"]);
const VERSION_REASONS = new Set(["type", "utf8", "stderr", "format", "mismatch"]);
const refuse = (code, versionDiagnostic) => { throw Object.assign(new Error("CI browser runtime refused."), { code, ...(versionDiagnostic === undefined ? {} : { versionDiagnostic }) }); };
const data = (value, key, code) => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) return undefined;
  if (!Object.hasOwn(descriptor, "value")) refuse(code);
  return descriptor.value;
};
const closed = (value, keys, code) => {
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) refuse(code);
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) refuse(code);
  return Object.fromEntries(keys.map(key => [key, data(value, key, code)]));
};

function environmentBinding(environment, runtime) {
  if (environment === null || typeof environment !== "object") refuse("ENVIRONMENT_REFUSED");
  const read = key => data(environment, key, "ENVIRONMENT_REFUSED");
  if (runtime.platform !== "linux" || runtime.arch !== "x64" || !/^24\.\d+\.\d+$/.test(runtime.nodeVersion)
    || read("CI") !== "true" || read("GITHUB_ACTIONS") !== "true" || read("GITHUB_REPOSITORY") !== "kauanbarateli/Segundo-Cerebro"
    || !/^[a-f0-9]{40}$/.test(read("GITHUB_SHA") ?? "") || read("GITHUB_WORKSPACE") !== ROOT
    || read("PLAYWRIGHT_BROWSERS_PATH") !== CACHE) refuse("ENVIRONMENT_REFUSED");
  for (const key of ["PLAYWRIGHT_DOWNLOAD_HOST", "PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST", "PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS", "NODE_TLS_REJECT_UNAUTHORIZED"]) {
    if (read(key) !== undefined) refuse("ENVIRONMENT_REFUSED");
  }
  return read("GITHUB_SHA");
}

async function directory(path, io) {
  const info = await io.lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || await io.realpath(path) !== path) refuse("PATH_REFUSED");
}

async function regular(path, io, maxBytes, code) {
  const info = await io.lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 0 || info.size > maxBytes || await io.realpath(path) !== path) refuse(code);
  return info;
}

async function json(path, io, code) {
  await regular(path, io, 65536, code);
  const bytes = await io.readFile(path);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 2 || bytes.byteLength > 65536) refuse(code);
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { refuse(code); }
}

async function executableDigest(path, io, maxBytes) {
  const before = await regular(path, io, maxBytes, "BINARY_REFUSED");
  if (before.size < 1 || !(before.mode & 0o111)) refuse("BINARY_REFUSED");
  let file, stream, accepted = false, result;
  try {
    file = await io.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const bound = await file.stat();
    if (!bound.isFile() || bound.dev !== before.dev || bound.ino !== before.ino || bound.size !== before.size) refuse("BINARY_REFUSED");
    const hash = createHash("sha256"); let bytes = 0;
    stream = file.createReadStream({ highWaterMark: MIB, autoClose: false });
    for await (const chunk of stream) {
      if (!(chunk instanceof Uint8Array) || chunk.byteLength < 1 || chunk.byteLength > MIB) refuse("BINARY_REFUSED");
      bytes += chunk.byteLength;
      if (bytes > maxBytes || bytes > before.size) refuse("BINARY_REFUSED");
      hash.update(chunk);
    }
    const after = await regular(path, io, maxBytes, "BINARY_REFUSED");
    if (bytes !== before.size || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mode !== before.mode) refuse("BINARY_REFUSED");
    result = Object.freeze({ bytes, sha256: hash.digest("hex") }); accepted = true;
  } finally {
    stream?.destroy();
    if (file) { try { await file.close(); } catch { accepted = false; } }
  }
  if (!accepted) refuse("BINARY_REFUSED");
  return result;
}

export function runCiBrowserVersion(executable, execute = execFile) {
  if (!EXECUTABLES.slice(0, 2).some(item => posix.join(CACHE, item.relative) === executable) || typeof execute !== "function") refuse("VERSION_COMMAND_REFUSED");
  return new Promise((accept, reject) => {
    execute(executable, ["--version"], {
      shell: false, encoding: "buffer", timeout: 10000, maxBuffer: 4096, killSignal: "SIGKILL",
      env: { PATH: "/usr/bin:/bin", HOME: "/tmp", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" },
    }, (error, stdout, stderr) => {
      if (error) { reject(Object.assign(new Error("CI browser version command refused."), { code: "VERSION_COMMAND_REFUSED" })); return; }
      accept({ stdout, stderr });
    });
  });
}

const versionByteCount = value => value instanceof Uint8Array && value.byteLength <= 4096 ? value.byteLength : null;
function versionRefused(component, reason, record) {
  refuse("VERSION_REFUSED", Object.freeze({ component, reason, stdoutBytes: versionByteCount(record?.stdout), stderrBytes: versionByteCount(record?.stderr) }));
}

/** Project only fixed enums and bounded counts; never command output or error text. */
export function ciBrowserRuntimeFailure(error) {
  const report = { schemaVersion: 1, scenario: "ci-browser-runtime", status: "REFUSED", code: "RUNTIME_REFUSED", applicationAccepted: false };
  try {
    const code = Object.getOwnPropertyDescriptor(error, "code");
    if (!code || !Object.hasOwn(code, "value") || !CODES.has(code.value)) return Object.freeze(report);
    report.code = code.value;
    if (report.code !== "VERSION_REFUSED") return Object.freeze(report);
    const descriptor = Object.getOwnPropertyDescriptor(error, "versionDiagnostic");
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return Object.freeze(report);
    const value = closed(descriptor.value, ["component", "reason", "stdoutBytes", "stderrBytes"], "VERSION_REFUSED");
    const count = bytes => bytes === null || Number.isSafeInteger(bytes) && bytes >= 0 && bytes <= 4096;
    if (VERSION_COMPONENTS.has(value.component) && VERSION_REASONS.has(value.reason) && count(value.stdoutBytes) && count(value.stderrBytes)) report.versionDiagnostic = Object.freeze(value);
  } catch { /* Malformed diagnostics cannot export arbitrary fields or invoke getters. */ }
  return Object.freeze(report);
}

function browserVersion(result, component) {
  let record;
  try { record = closed(result, ["stdout", "stderr"], "VERSION_REFUSED"); } catch { versionRefused(component, "type"); }
  if (!(record.stdout instanceof Uint8Array) || !(record.stderr instanceof Uint8Array)) versionRefused(component, "type", record);
  if (record.stderr.byteLength !== 0) versionRefused(component, "stderr", record);
  if (record.stdout.byteLength < 1 || record.stdout.byteLength > 4096) versionRefused(component, "format", record);
  let value;
  try { value = new TextDecoder("utf-8", { fatal: true }).decode(record.stdout); } catch { versionRefused(component, "utf8", record); }
  // Chromium's empty channel adds one ASCII space; a complete match still forbids extra lines.
  const match = /^(?:Google Chrome for Testing|Google Chrome|Chromium|Chrome Headless Shell|HeadlessChrome)[ /](\d+\.\d+\.\d+\.\d+) ?(?:\r?\n)?$/.exec(value);
  if (!match || match[0] !== value) versionRefused(component, "format", record);
  if (match[1] !== VERSION) versionRefused(component, "mismatch", record);
  return VERSION;
}

/** Ports serve deterministic tests only; the executable CLI has no arguments or overrides. */
export async function verifyCiBrowserRuntime(ports) {
  try {
    const selected = ports === undefined ? {
      environment: process.env, runtime: { platform: process.platform, arch: process.arch, nodeVersion: process.versions.node },
      io: { lstat, realpath, readFile, open }, version: runCiBrowserVersion,
    } : closed(ports, ["environment", "runtime", "io", "version"], "ENVIRONMENT_REFUSED");
    const runtime = closed(selected.runtime, ["platform", "arch", "nodeVersion"], "ENVIRONMENT_REFUSED");
    const sourceSha = environmentBinding(selected.environment, runtime);
    const io = closed(selected.io, ["lstat", "realpath", "readFile", "open"], "ENVIRONMENT_REFUSED");
    if (Object.values(io).some(value => typeof value !== "function") || typeof selected.version !== "function") refuse("ENVIRONMENT_REFUSED");
    await directory(ROOT, io); await directory(CACHE, io); await directory(join(ROOT, "node_modules"), io);
    const image = closed(await json(posix.join(CACHE, ".docker-info"), io, "IMAGE_REFUSED"), ["driverVersion", "dockerImageName"], "IMAGE_REFUSED");
    if (image.driverVersion !== DRIVER || image.dockerImageName !== IMAGE_NAME) refuse("IMAGE_REFUSED");
    for (const name of ["playwright", "playwright-core", "@playwright/test"]) {
      if (name.startsWith("@")) await directory(join(ROOT, "node_modules", "@playwright"), io);
      const parent = join(ROOT, "node_modules", name); await directory(parent, io);
      const sdk = await json(join(parent, "package.json"), io, "SDK_REFUSED");
      if (sdk?.name !== name || sdk?.version !== DRIVER) refuse("SDK_REFUSED");
    }
    const catalogue = await json(join(ROOT, "node_modules", "playwright-core", "browsers.json"), io, "SDK_REFUSED");
    if (!Array.isArray(catalogue?.browsers)) refuse("SDK_REFUSED");
    const files = [];
    for (const executable of EXECUTABLES) {
      const matches = catalogue.browsers.filter(row => row?.name === executable.name);
      if (matches.length !== 1 || matches[0].revision !== executable.revision || matches[0].installByDefault !== true
        || matches[0].revisionOverrides !== undefined || (executable.name !== "ffmpeg" && matches[0].browserVersion !== VERSION)) refuse("SDK_REFUSED");
      const path = posix.join(CACHE, executable.relative), parent = posix.join(CACHE, executable.relative.split("/")[0]);
      await directory(parent, io);
      if (posix.dirname(path) !== parent) await directory(posix.dirname(path), io);
      await regular(posix.join(parent, "INSTALLATION_COMPLETE"), io, 0, "CACHE_REFUSED");
      const before = await executableDigest(path, io, executable.maxBytes);
      const version = executable.name === "ffmpeg" ? null : browserVersion(await selected.version(path), executable.name === "chromium" ? "full" : "headless");
      const after = await executableDigest(path, io, executable.maxBytes);
      if (before.bytes !== after.bytes || before.sha256 !== after.sha256) refuse("BINARY_REFUSED");
      files.push(Object.freeze({ name: executable.name, revision: executable.revision, relativePath: executable.relative, version, ...after }));
    }
    return Object.freeze({ schemaVersion: 1, scenario: "ci-browser-runtime", status: "BOUND", applicationAccepted: false,
      sourceSha, declaredImage: CI_BROWSER_IMAGE, platform: "linux", arch: "x64", nodeMajor: 24, driverVersion: DRIVER, browserVersion: VERSION,
      cacheFiles: Object.freeze(files) });
  } catch (error) { const failure = ciBrowserRuntimeFailure(error); refuse(failure.code, failure.versionDiagnostic); }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) refuse("ENVIRONMENT_REFUSED");
    process.stdout.write(JSON.stringify(await verifyCiBrowserRuntime()) + "\n");
  } catch (error) {
    process.stdout.write(JSON.stringify(ciBrowserRuntimeFailure(error)) + "\n");
    process.exitCode = 1;
  }
}
