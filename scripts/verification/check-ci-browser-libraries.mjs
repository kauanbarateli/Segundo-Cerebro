/** Read-only library check for the exact browser image; never starts a browser. */
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CI_BROWSER_IMAGE, verifyCiBrowserRuntime } from "./check-ci-browser-runtime.mjs";

const MAX_OUTPUT = 65536;
const BINARIES = Object.freeze([
  Object.freeze({ name: "chromium", relativePath: "chromium-1243/chrome-linux64/chrome", bytes: 350 * 1048576 }),
  Object.freeze({ name: "chromium-headless-shell", relativePath: "chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell", bytes: 350 * 1048576 }),
  Object.freeze({ name: "ffmpeg", relativePath: "ffmpeg-1011/ffmpeg-linux", bytes: 64 * 1048576 }),
]);
const EXECUTABLES = Object.freeze(BINARIES.slice(0, 2).map(binary => "/ms-playwright/" + binary.relativePath));
const LOADERS = new Set(["/lib64/ld-linux-x86-64.so.2", "/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2", "/usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2"]);
const CODES = new Set(["USAGE_REFUSED", "PORTS_REFUSED", "RUNTIME_REFUSED", "SOURCE_CHANGED", "COMMAND_REFUSED", "LDD_COMMAND_REFUSED", "LDD_STDERR_REFUSED", "LDD_OUTPUT_REFUSED", "MISSING_LIBRARY", "LOADER_REFUSED"]);
const need = (condition, code) => { if (!condition) throw Object.assign(new Error("CI browser libraries refused."), { code }); };
const own = (value, key, code) => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  need(descriptor && Object.hasOwn(descriptor, "value"), code);
  return descriptor.value;
};
function closed(value, keys, code) {
  need(value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype, code);
  const actual = Reflect.ownKeys(value);
  need(actual.length === keys.length && actual.every(key => keys.includes(key)), code);
  return Object.fromEntries(keys.map(key => [key, own(value, key, code)]));
}
function boundRuntime(value) {
  const runtime = closed(value, ["schemaVersion", "scenario", "status", "applicationAccepted", "sourceSha", "declaredImage", "platform", "arch", "nodeMajor", "driverVersion", "browserVersion", "cacheFiles"], "RUNTIME_REFUSED");
  need(runtime.schemaVersion === 1 && runtime.scenario === "ci-browser-runtime" && runtime.status === "BOUND" && runtime.applicationAccepted === false
    && /^[a-f0-9]{40}$/u.test(runtime.sourceSha ?? "") && runtime.declaredImage === CI_BROWSER_IMAGE && runtime.platform === "linux" && runtime.arch === "x64"
    && runtime.nodeMajor === 24 && runtime.driverVersion === "1.63.0" && runtime.browserVersion === "153.0.8010.12"
    && Array.isArray(runtime.cacheFiles) && runtime.cacheFiles.length === BINARIES.length, "RUNTIME_REFUSED");
  runtime.cacheFiles = runtime.cacheFiles.map((raw, index) => {
    const record = closed(raw, ["name", "revision", "relativePath", "version", "bytes", "sha256"], "RUNTIME_REFUSED"), expected = BINARIES[index];
    need(record.name === expected.name && record.relativePath === expected.relativePath && record.revision === (index < 2 ? "1243" : "1011")
      && record.version === (index < 2 ? runtime.browserVersion : null) && Number.isSafeInteger(record.bytes) && record.bytes > 0 && record.bytes <= expected.bytes
      && /^[a-f0-9]{64}$/u.test(record.sha256 ?? ""), "RUNTIME_REFUSED");
    return record;
  });
  return runtime;
}

/** Fixed command and environment; the execute port exists only for unit tests. */
export function runCiBrowserLdd(executable, execute = execFile) {
  need(EXECUTABLES.includes(executable) && typeof execute === "function", "COMMAND_REFUSED");
  return new Promise((accept, reject) => {
    execute("/usr/bin/ldd", [executable], {
      shell: false, encoding: "buffer", timeout: 10000, maxBuffer: MAX_OUTPUT, killSignal: "SIGKILL",
      env: { PATH: "/usr/bin:/bin", HOME: "/tmp", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" },
    }, (error, stdout, stderr) => {
      if (error) { reject(Object.assign(new Error("CI browser dependency command refused."), { code: "LDD_COMMAND_REFUSED" })); return; }
      accept({ stdout, stderr });
    });
  });
}

/** Strict Noble/x64 ldd grammar; returns counts, never library paths or text. */
export function inspectCiBrowserLdd(value) {
  const result = closed(value, ["stdout", "stderr"], "LDD_OUTPUT_REFUSED");
  need(result.stderr instanceof Uint8Array && result.stderr.byteLength === 0, "LDD_STDERR_REFUSED");
  need(result.stdout instanceof Uint8Array && result.stdout.byteLength > 0 && result.stdout.byteLength <= MAX_OUTPUT, "LDD_OUTPUT_REFUSED");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(result.stdout); } catch { need(false, "LDD_OUTPUT_REFUSED"); }
  need(text.endsWith("\n") && !/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(text), "LDD_OUTPUT_REFUSED");
  const lines = text.slice(0, -1).split("\n");
  need(lines.length >= 3 && lines.length <= 256, "LDD_OUTPUT_REFUSED");
  let vdso = 0, loaders = 0, libraries = 0;
  const names = new Set(), address = "\\(0x[a-f0-9]{16}\\)";
  for (const line of lines) {
    if (/^[ \t]+\S+[ \t]+=>[ \t]+not found[ \t]*$/u.test(line)) need(false, "MISSING_LIBRARY");
    if (new RegExp("^[ \\t]+linux-vdso\\.so\\.1[ \\t]+" + address + "$", "u").test(line)) { need(++vdso === 1, "LDD_OUTPUT_REFUSED"); continue; }
    const loader = new RegExp("^[ \\t]+(/[^ \\t]+)[ \\t]+" + address + "$", "u").exec(line);
    if (loader) { need(LOADERS.has(loader[1]) && ++loaders === 1, "LOADER_REFUSED"); continue; }
    const linked = new RegExp("^[ \\t]+([A-Za-z0-9][A-Za-z0-9_.+-]*\\.so(?:\\.[0-9]+)*)[ \\t]+=>[ \\t]+(/[^ \\t]+)[ \\t]+" + address + "$", "u").exec(line);
    need(linked, "LDD_OUTPUT_REFUSED");
    if (linked[1] === "ld-linux-x86-64.so.2") { need(LOADERS.has(linked[2]) && ++loaders === 1, "LOADER_REFUSED"); continue; }
    need(!names.has(linked[1]) && ["/lib/x86_64-linux-gnu/", "/usr/lib/x86_64-linux-gnu/"].some(prefix => linked[2] === prefix + linked[1]), "LDD_OUTPUT_REFUSED");
    names.add(linked[1]); libraries++;
  }
  need(vdso === 1 && loaders === 1 && libraries > 0, "LOADER_REFUSED");
  return Object.freeze({ libraries, loaders, vdso });
}

/** Test ports cannot be supplied by CLI arguments or environment variables. */
export async function verifyCiBrowserLibraries(ports) {
  const selected = ports === undefined ? { runtime: verifyCiBrowserRuntime, inspect: runCiBrowserLdd } : closed(ports, ["runtime", "inspect"], "PORTS_REFUSED");
  need(typeof selected.runtime === "function" && typeof selected.inspect === "function", "PORTS_REFUSED");
  let before;
  try { before = boundRuntime(await selected.runtime()); } catch { need(false, "RUNTIME_REFUSED"); }
  let libraries = 0;
  for (const executable of EXECUTABLES) libraries += inspectCiBrowserLdd(await selected.inspect(executable)).libraries;
  let after;
  try { after = boundRuntime(await selected.runtime()); } catch { need(false, "RUNTIME_REFUSED"); }
  need(JSON.stringify(before) === JSON.stringify(after), "SOURCE_CHANGED");
  return Object.freeze({ schemaVersion: 1, scenario: "ci-browser-libraries", status: "BOUND", sourceBound: true, executables: EXECUTABLES.length, libraries, runtimeChecks: 2, applicationAccepted: false });
}

export function ciBrowserLibrariesFailure(error) {
  const report = { schemaVersion: 1, scenario: "ci-browser-libraries", status: "REFUSED", code: "RUNTIME_REFUSED", applicationAccepted: false };
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    if (descriptor && Object.hasOwn(descriptor, "value") && CODES.has(descriptor.value)) report.code = descriptor.value;
  } catch { /* No arbitrary diagnostics, getters or native output cross this boundary. */ }
  return Object.freeze(report);
}

export async function ciBrowserLibrariesCli(args, output = process.stdout, ports) {
  need(Array.isArray(args) && args.length === 0, "USAGE_REFUSED");
  output.write(JSON.stringify(await verifyCiBrowserLibraries(ports)) + "\n");
}
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await ciBrowserLibrariesCli(process.argv.slice(2)); }
  catch (error) { process.stdout.write(JSON.stringify(ciBrowserLibrariesFailure(error)) + "\n"); process.exitCode = 1; }
}
