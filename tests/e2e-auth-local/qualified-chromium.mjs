/** Fixed, qualified Linux test browser. Import performs no I/O or launch. */
import { constants } from "node:fs";
import { lstat, realpath, open, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { browserProcessEnvironment } from "./browser-process-environment.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const MIB = 1048576;
export const QUALIFIED_CHROMIUM = Object.freeze({ version: "157.0.8103.6", sha256: "ec4e78d65a5382c2b50aaf28c6a655a624973b3d3c711a2a4ae34369fd9a3444", executableBytes: 305061192, archiveSha256: "7802b25411aa5b8aa387cc733a45df6eed1aea8cc046fd4e2dec64d5918b1853", archiveBytes: 202676171, driverVersion: "1.63.0", qualificationRun: 39221217191, harnessSha256: "2b904e3d226b08fc39e7287eb8f96575e10ec1e95de51a5e64461df0188056a5" });
const refuse = () => { throw new Error("QUALIFIED_CHROMIUM_REFUSED"); };
const dataRecord = (value, keys) => { if (!value || Object.getPrototypeOf(value) !== Object.prototype) refuse(); const d = Object.getOwnPropertyDescriptors(value); if (Reflect.ownKeys(d).length !== keys.length || Reflect.ownKeys(d).some(k => !keys.includes(k))) refuse(); return Object.fromEntries(keys.map(k => { if (!d[k]?.enumerable || !Object.hasOwn(d[k], "value")) refuse(); return [k, d[k].value]; })); };
export function qualifiedChromiumPaths() {
  const assetsPath = join(ROOT, "work", "qualified-chromium");
  return Object.freeze({ executablePath: join(assetsPath, "chrome-linux64", "chrome"), assetsPath, versionHome: join(assetsPath, "version-home") });
}
export function assertQualifiedBrowserVersion(value) { if (typeof value !== "string" || value !== QUALIFIED_CHROMIUM.version) refuse(); }

/** I/O ports are only for RAM controls; every path and every expected byte is fixed. */
export async function verifyQualifiedChromium(ports) {
  const io = ports === undefined ? { lstat, realpath, open, readFile } : dataRecord(ports, ["lstat", "realpath", "open", "readFile"]);
  if (Object.values(io).some(v => typeof v !== "function")) refuse();
  const paths = qualifiedChromiumPaths(); let file, stream, accepted = false, closed = true;
  try {
    for (const path of [ROOT, join(ROOT, "work"), paths.assetsPath, dirname(paths.executablePath), paths.versionHome]) {
      const st = await io.lstat(path); if (!st.isDirectory() || st.isSymbolicLink() || await io.realpath(path) !== path) refuse();
    }
    const before = await io.lstat(paths.executablePath);
    if (!before.isFile() || before.isSymbolicLink() || before.size !== QUALIFIED_CHROMIUM.executableBytes || !(before.mode & 0o111) || await io.realpath(paths.executablePath) !== paths.executablePath) refuse();
    for (const name of ["playwright", "playwright-core", "@playwright/test"]) {
      const path = join(ROOT, "node_modules", name, "package.json"), raw = await io.readFile(path);
      if (!(raw instanceof Uint8Array) || raw.byteLength > 8192) refuse();
      const value = JSON.parse(Buffer.from(raw).toString("utf8")); if (value.name !== name || value.version !== QUALIFIED_CHROMIUM.driverVersion) refuse();
    }
    file = await io.open(paths.executablePath, constants.O_RDONLY | constants.O_NOFOLLOW); closed = false;
    const bound = await file.stat(); if (!bound.isFile() || bound.size !== before.size || bound.dev !== before.dev || bound.ino !== before.ino) refuse();
    stream = file.createReadStream({ highWaterMark: MIB, autoClose: false }); const hash = createHash("sha256"); let bytes = 0;
    for await (const chunk of stream) { if (!(chunk instanceof Uint8Array) || chunk.byteLength < 1 || chunk.byteLength > MIB) refuse(); bytes += chunk.byteLength; if (bytes > QUALIFIED_CHROMIUM.executableBytes) refuse(); hash.update(chunk); }
    if (bytes !== QUALIFIED_CHROMIUM.executableBytes || hash.digest("hex") !== QUALIFIED_CHROMIUM.sha256) refuse();
    const after = await io.lstat(paths.executablePath); if (!after.isFile() || after.isSymbolicLink() || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || await io.realpath(paths.executablePath) !== paths.executablePath) refuse();
    accepted = true;
  } catch { accepted = false; }
  finally {
    try { stream?.destroy(); } catch { accepted = false; }
    if (file) { try { await file.close(); closed = true; } catch { closed = false; } }
  }
  if (!accepted || !closed) refuse();
  return paths;
}

export function parseQualifiedChromiumRecord(stdout) {
  try {
    if (typeof stdout !== "string" || Buffer.byteLength(stdout) < 2 || Buffer.byteLength(stdout) > 4096) refuse();
    const keys = ["schemaVersion", "scenario", "status", "applicationAccepted", "platform", "arch", "driverVersion", "browserVersion", "executableSha256", "archiveSha256", "qualificationRun", "harnessSha256", "executableBytes", "archiveBytes"];
    const value = dataRecord(JSON.parse(stdout.trim()), keys);
    const tokens = [...stdout.matchAll(/(?:^|[,{])\s*"([^"\\]*)"\s*:/g)].map(m => m[1]);
    if (tokens.length !== keys.length || new Set(tokens).size !== keys.length || tokens.some(k => !keys.includes(k))) refuse();
    if (value.schemaVersion !== 1 || value.scenario !== "qualified-chromium-runtime" || value.status !== "BOUND" || value.applicationAccepted !== false || value.platform !== "linux" || value.arch !== "x64" || value.driverVersion !== QUALIFIED_CHROMIUM.driverVersion || value.browserVersion !== QUALIFIED_CHROMIUM.version || value.executableSha256 !== QUALIFIED_CHROMIUM.sha256 || value.archiveSha256 !== QUALIFIED_CHROMIUM.archiveSha256 || value.qualificationRun !== QUALIFIED_CHROMIUM.qualificationRun || value.harnessSha256 !== QUALIFIED_CHROMIUM.harnessSha256 || value.executableBytes !== QUALIFIED_CHROMIUM.executableBytes || value.archiveBytes !== QUALIFIED_CHROMIUM.archiveBytes) refuse();
    return Object.freeze(value);
  } catch { refuse(); }
}

/** Python owns download/extraction and the original bounded --version command. */
export async function prepareQualifiedChromium(run, environment, ports) {
  try {
    if (typeof run !== "function") refuse();
    const child = browserProcessEnvironment(environment);
    const result = await run("python3", ["scripts/verification/prepare-qualified-chromium.py", "prepare"], 300000, { env: child, maxBytes: 4096 });
    const descriptors = Object.getOwnPropertyDescriptors(result ?? {});
    if (!descriptors.stdout || !Object.hasOwn(descriptors.stdout, "value") || !descriptors.groupConfirmed || !Object.hasOwn(descriptors.groupConfirmed, "value") || descriptors.groupConfirmed.value !== true) refuse();
    const record = parseQualifiedChromiumRecord(descriptors.stdout.value);
    await verifyQualifiedChromium(ports);
    return record;
  } catch { refuse(); }
}
