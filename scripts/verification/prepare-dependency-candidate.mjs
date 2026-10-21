// GitHub-only preparation. These files are a candidate, never an acceptance or import.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REGISTRY = "https://registry.npmjs.org";
const TARGET = "4.1.12";
const SOURCE_HASHES = Object.freeze({
  "package.json": "3059287dd0f9bfeba6d1e627d7daba7543d7dd1bb25e017ff282c586577e08ba",
  "package-lock.json": "f35dd10194b2b7c3ead7f79b811638f9f36b4c92ea4ce041c4b0e8e94468c38a",
});
const INSTALL = ["install", "--package-lock-only", "--ignore-scripts", "--save-dev", "--save-exact", "vitest@4.1.12", "--registry=https://registry.npmjs.org", "--no-audit", "--no-fund"];
const AUDIT_KEYS = ["info", "low", "moderate", "high", "critical", "total"];
const CODES = new Set(["ENVIRONMENT_REFUSED", "SOURCE_REFUSED", "NPM_VERSION_REFUSED", "NPM_INSTALL_REFUSED", "NPM_AUDIT_REFUSED", "AUDIT_NOT_ZERO", "PACKAGE_DELTA_REFUSED", "LOCK_DELTA_REFUSED", "PROCESS_REFUSED", "PROCESS_TIMEOUT", "PROCESS_OUTPUT_LIMIT", "CLEANUP_REFUSED", "EXPORT_REFUSED"]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = code => { throw Object.assign(new Error("Dependency candidate refused."), { code }); };
const inside = (parent, path) => { const part = relative(parent, path); return part !== "" && part !== ".." && !part.startsWith(".." + sep) && !isAbsolute(part); };

async function absent(path, code) {
  try { await lstat(path); } catch (error) { if (error.code === "ENOENT") return; fail(code); }
  fail(code);
}
async function bytesAt(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > 16777216) fail("SOURCE_REFUSED");
  return readFile(path);
}
async function sourceUnchanged(original) {
  for (const [name, bytes] of Object.entries(original)) if (!(await bytesAt(join(ROOT, name))).equals(bytes)) fail("SOURCE_REFUSED");
}

// No shell, inherited credentials/configuration, script execution or npm output in logs.
function npmRun(args, cwd, env, timeoutMs) {
  return new Promise((accept, reject) => {
    const child = spawn(join(dirname(process.execPath), "npm"), args, { cwd, env, shell: false, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let code = null, count = 0, chunks = [], killTimer;
    const stop = reason => {
      if (code !== null) return;
      code = reason;
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* Still require the close event. */ }
      killTimer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* close remains authoritative. */ } }, 2000);
    };
    const timer = setTimeout(() => stop("PROCESS_TIMEOUT"), timeoutMs);
    const consume = (chunk, keep) => {
      count += chunk.length;
      if (count > 8388608) { chunks = []; stop("PROCESS_OUTPUT_LIMIT"); }
      else if (keep && code === null) chunks.push(chunk);
    };
    child.stdout.on("data", chunk => consume(chunk, true));
    child.stderr.on("data", chunk => consume(chunk, false));
    child.once("error", () => { code ??= "PROCESS_REFUSED"; });
    child.once("close", (status, signal) => {
      clearTimeout(timer); clearTimeout(killTimer);
      if (code !== null || signal !== null || !Number.isSafeInteger(status)) { reject(Object.assign(new Error("Process refused."), { code: code ?? "PROCESS_REFUSED" })); return; }
      accept({ status, stdout: Buffer.concat(chunks).toString("utf8") });
    });
  });
}

function inspectDelta(beforePackage, afterPackage, beforeLock, afterLock) {
  if (!object(beforePackage.devDependencies) || !object(afterPackage.devDependencies)) fail("PACKAGE_DELTA_REFUSED");
  const expectedPackage = structuredClone(beforePackage);
  expectedPackage.devDependencies.vitest = TARGET;
  if (!isDeepStrictEqual(expectedPackage, afterPackage)) fail("PACKAGE_DELTA_REFUSED");
  if (beforeLock.lockfileVersion !== 3 || afterLock.lockfileVersion !== 3 || !object(beforeLock.packages) || !object(afterLock.packages) || !object(beforeLock.packages[""]?.devDependencies)) fail("LOCK_DELTA_REFUSED");
  const expectedRoot = structuredClone(beforeLock.packages[""]);
  expectedRoot.devDependencies.vitest = TARGET;
  const outerBefore = { ...beforeLock }, outerAfter = { ...afterLock };
  delete outerBefore.packages; delete outerAfter.packages;
  if (!isDeepStrictEqual(outerBefore, outerAfter) || !isDeepStrictEqual(expectedRoot, afterLock.packages[""])) fail("LOCK_DELTA_REFUSED");
  for (const name of ["vitest", "@vitest/mocker"]) if (afterLock.packages["node_modules/" + name]?.version !== TARGET) fail("LOCK_DELTA_REFUSED");
  const deltaPackages = [];
  for (const path of [...new Set([...Object.keys(beforeLock.packages), ...Object.keys(afterLock.packages)])].sort()) {
    if (path === "") continue;
    const before = beforeLock.packages[path], after = afterLock.packages[path];
    if (isDeepStrictEqual(before, after)) continue;
    if (!/^(?:node_modules\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)(?:\/node_modules\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)*$/i.test(path)) fail("LOCK_DELTA_REFUSED");
    for (const entry of [before, after]) if (entry !== undefined && (!object(entry) || typeof entry.version !== "string" || !/^[0-9A-Za-z.+-]{1,120}$/.test(entry.version))) fail("LOCK_DELTA_REFUSED");
    if (after !== undefined) {
      if (typeof after.resolved !== "string" || !after.resolved.startsWith(REGISTRY + "/") || typeof after.integrity !== "string" || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(after.integrity)) fail("LOCK_DELTA_REFUSED");
      const url = new URL(after.resolved);
      if (url.origin !== REGISTRY || url.username || url.password || url.search || url.hash) fail("LOCK_DELTA_REFUSED");
    }
    deltaPackages.push({ path, name: path.slice(path.lastIndexOf("node_modules/") + 13), change: before === undefined ? "added" : after === undefined ? "removed" : "changed", from: before?.version ?? null, to: after?.version ?? null });
  }
  if (!deltaPackages.some(row => row.path === "node_modules/vitest") || !deltaPackages.some(row => row.path === "node_modules/@vitest/mocker")) fail("LOCK_DELTA_REFUSED");
  return deltaPackages;
}

let working = null, exported = false, ready = false, output = null, original = {}, auditCounts = null;
try {
  const environment = process.env;
  if (process.argv.length !== 2 || process.platform !== "linux" || process.versions.node.split(".")[0] !== "24" || environment.GITHUB_ACTIONS !== "true" || environment.SC_DEPENDENCY_CANDIDATE !== "1" || !/^[a-f0-9]{40}$/.test(environment.GITHUB_SHA ?? "") || environment.GITHUB_REF !== "refs/heads/codex/calendar-canonical-origin-20261021" || environment.GITHUB_REPOSITORY !== "kauanbarateli/Segundo-Cerebro") fail("ENVIRONMENT_REFUSED");
  const runnerTemp = environment.RUNNER_TEMP, workspace = environment.GITHUB_WORKSPACE, outputCommand = environment.GITHUB_OUTPUT;
  if (![runnerTemp, workspace, outputCommand].every(path => typeof path === "string" && isAbsolute(path)) || await realpath(runnerTemp) !== resolve(runnerTemp) || await realpath(workspace) !== resolve(ROOT) || resolve(runnerTemp) === resolve(ROOT) || !inside(runnerTemp, outputCommand) || inside(runnerTemp, resolve(ROOT)) || inside(resolve(ROOT), runnerTemp)) fail("ENVIRONMENT_REFUSED");
  const tempInfo = await lstat(runnerTemp), commandInfo = await lstat(outputCommand);
  if (!tempInfo.isDirectory() || tempInfo.isSymbolicLink() || !commandInfo.isFile() || commandInfo.isSymbolicLink() || await realpath(outputCommand) !== resolve(outputCommand)) fail("ENVIRONMENT_REFUSED");
  output = join(runnerTemp, "sc-dependency-candidate");
  await absent(output, "EXPORT_REFUSED");
  for (const [name, expected] of Object.entries(SOURCE_HASHES)) {
    original[name] = await bytesAt(join(ROOT, name));
    if (hash(original[name]) !== expected) fail("SOURCE_REFUSED");
  }
  working = await mkdtemp(join(runnerTemp, "sc-dependency-working-"));
  await chmod(working, 0o700);
  if (!inside(runnerTemp, working) || inside(output, working) || inside(working, output) || await realpath(working) !== working) fail("ENVIRONMENT_REFUSED");
  const project = join(working, "project"), home = join(working, "home"), cache = join(working, "cache");
  for (const path of [project, home, cache]) await mkdir(path, { mode: 0o700 });
  const globalConfig = join(working, "empty-global.npmrc");
  await writeFile(globalConfig, "", { flag: "wx", mode: 0o600 });
  for (const [name, bytes] of Object.entries(original)) await writeFile(join(project, name), bytes, { flag: "wx", mode: 0o600 });
  const childEnvironment = {
    PATH: dirname(process.execPath) + ":/usr/bin:/bin", HOME: home, XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: cache,
    CI: "true", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", NO_COLOR: "1",
    NPM_CONFIG_USERCONFIG: "/dev/null", NPM_CONFIG_GLOBALCONFIG: globalConfig, NPM_CONFIG_REGISTRY: REGISTRY,
    NPM_CONFIG_CACHE: cache, NPM_CONFIG_PREFIX: join(working, "prefix"), NPM_CONFIG_IGNORE_SCRIPTS: "true",
    NPM_CONFIG_FUND: "false", NPM_CONFIG_UPDATE_NOTIFIER: "false", NPM_CONFIG_FETCH_RETRIES: "0", NPM_CONFIG_FETCH_TIMEOUT: "30000",
  };
  const npm = await npmRun(["--version"], project, childEnvironment, 15000);
  const npmVersion = npm.stdout.trim();
  if (npm.status !== 0 || !/^\d+\.\d+\.\d+$/.test(npmVersion)) fail("NPM_VERSION_REFUSED");
  if ((await npmRun(INSTALL, project, childEnvironment, 180000)).status !== 0) fail("NPM_INSTALL_REFUSED");
  if (!isDeepStrictEqual((await readdir(project)).sort(), ["package-lock.json", "package.json"])) fail("NPM_INSTALL_REFUSED");
  const candidates = {};
  for (const name of Object.keys(SOURCE_HASHES)) candidates[name] = await bytesAt(join(project, name));
  const deltaPackages = inspectDelta(JSON.parse(original["package.json"]), JSON.parse(candidates["package.json"]), JSON.parse(original["package-lock.json"]), JSON.parse(candidates["package-lock.json"]));
  const audit = await npmRun(["audit", "--json", "--registry=https://registry.npmjs.org"], project, childEnvironment, 90000);
  const parsedAudit = JSON.parse(audit.stdout), counts = parsedAudit?.metadata?.vulnerabilities;
  if (parsedAudit.auditReportVersion !== 2 || !object(counts) || !isDeepStrictEqual(Object.keys(counts).sort(), [...AUDIT_KEYS].sort()) || AUDIT_KEYS.some(key => !Number.isSafeInteger(counts[key]) || counts[key] < 0)) fail("NPM_AUDIT_REFUSED");
  auditCounts = Object.fromEntries(AUDIT_KEYS.map(key => [key, counts[key]]));
  if (audit.status !== 0 || AUDIT_KEYS.some(key => counts[key] !== 0) || !object(parsedAudit.vulnerabilities) || Object.keys(parsedAudit.vulnerabilities).length !== 0) fail("AUDIT_NOT_ZERO");
  if (!isDeepStrictEqual((await readdir(project)).sort(), ["package-lock.json", "package.json"])) fail("NPM_AUDIT_REFUSED");
  for (const [name, bytes] of Object.entries(candidates)) if (!(await bytesAt(join(project, name))).equals(bytes)) fail("SOURCE_REFUSED");
  await sourceUnchanged(original);
  const metadata = {
    schemaVersion: 1, sourceSha: environment.GITHUB_SHA, purpose: "CANDIDATE_ONLY_NOT_ACCEPTANCE",
    sourceHashes: Object.entries(original).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })),
    files: Object.entries(candidates).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })),
    versions: { node: process.versions.node, npm: npmVersion }, auditCounts, deltaPackages,
  };
  await rm(working, { recursive: true, force: false }); working = null;
  await mkdir(output, { mode: 0o700 }); exported = true;
  for (const [name, bytes] of Object.entries(candidates)) await writeFile(join(output, name), bytes, { flag: "wx", mode: 0o600 });
  await writeFile(join(output, "candidate-metadata.json"), JSON.stringify(metadata, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  await sourceUnchanged(original);
  await appendFile(outputCommand, "ready=true\n"); ready = true;
  console.log(JSON.stringify({ status: "candidate-ready", purpose: "CANDIDATE_ONLY_NOT_ACCEPTANCE", auditCounts }));
} catch (error) {
  let code = CODES.has(error?.code) ? error.code : "PROCESS_REFUSED";
  try {
    if (working !== null) await rm(working, { recursive: true, force: false });
    if (exported && !ready) await rm(output, { recursive: true, force: false });
    if (Object.keys(original).length) await sourceUnchanged(original);
  } catch { code = "CLEANUP_REFUSED"; }
  console.log(JSON.stringify({ status: "failed", code, auditCounts }));
  process.exitCode = 1;
}
