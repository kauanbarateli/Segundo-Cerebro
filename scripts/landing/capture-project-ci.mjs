// External CI proposal. Not executed locally; no service starts merely by import.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer, createConnection } from "node:net";
import { get } from "node:http";
import { lstat, readFile, readdir, realpath, mkdtemp, rm } from "node:fs/promises";
import { dirname, resolve, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { projectFiles, projectReceipt, projectRoute, assertProjectRecords } from "./capture-policy.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = "http://127.0.0.1:3110", PORT = 3110;
const fixedDirectory = "src/components/features/conheca/telas/";
const fixedImages = ["projeto.webp", "projeto-celular.webp", "projeto-escuro.webp", "projeto-celular-escuro.webp"].map(name => fixedDirectory + name);
const outputs = Object.freeze(fixedImages.flatMap(file => [file, file + ".json"]).concat("docs/implementation/evidence/landing-project-capture.json"));
const codeFiles = ["scripts/landing/capturar-telas.mjs", "scripts/landing/capture-policy.mjs"];
const SHA = /^[a-f0-9]{40}$/u, HEX = /^[a-f0-9]{64}$/u;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === keys.slice().sort().join("|");
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
class Refusal extends Error { constructor(code) { super(code); this.code = code; } }
const need = (value, code) => { if (!value) throw new Refusal(code); };
let interrupted = false, home, expected, startedAt, scopeVerified = false, ssrVerified = false, abortPendingSsr = null;
const owned = [];
const onSignal = () => { interrupted = true; abortPendingSsr?.(); };
function git(args) {
  return execFileSync("git", ["-c", "safe.directory=" + ROOT, "-c", "gc.auto=0", ...args], {
    cwd: ROOT, env: { PATH: process.env.PATH, HOME: home, LANG: "C.UTF-8", LC_ALL: "C.UTF-8", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
    encoding: "utf8", timeout: 10000, maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
  });
}
async function canonical(path, limit) {
  const full = resolve(ROOT, path), part = relative(ROOT, full);
  need(part && !part.startsWith(".." + sep) && !part.startsWith("/") && await realpath(full) === full, "CAPTURE_FILE_PATH");
  const stat = await lstat(full);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= limit, "CAPTURE_FILE_SHAPE");
  return readFile(full);
}
export function assertCaptureInterface({ route, receipt, files }) {
  need(route === "/projetos?project=project-sc-v2" && receipt === "docs/implementation/evidence/landing-project-capture.json" && same(files, fixedImages), "CAPTURE_INTERFACE");
}
export function assertCaptureEnvironment(environment, platform, version, argumentCount) {
  const allowed = new Set(["PATH", "LANG", "LC_ALL", "TZ", "CI", "GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "GITHUB_REF", "GITHUB_REPOSITORY", "GITHUB_SHA", "GITHUB_WORKSPACE", "RUNNER_TEMP", "RUNNER_OS", "RUNNER_ENVIRONMENT", "APP_MODE", "NEXT_TELEMETRY_DISABLED", "PLAYWRIGHT_BROWSERS_PATH"]);
  need(Object.keys(environment).every(key => allowed.has(key)), "CAPTURE_ENV_ALLOWLIST");
  need(platform === "linux" && /^24\./u.test(version) && argumentCount === 2, "CAPTURE_SCOPE");
  need(environment.CI === "true" && environment.GITHUB_ACTIONS === "true" && environment.RUNNER_ENVIRONMENT === "github-hosted" && environment.RUNNER_OS === "Linux", "CAPTURE_SCOPE");
  need(environment.GITHUB_EVENT_NAME === "push" && environment.GITHUB_REF === "refs/heads/codex/mvp-goals-terminal-20261023" && environment.GITHUB_REPOSITORY === "kauanbarateli/Segundo-Cerebro", "CAPTURE_SCOPE");
  need(environment.APP_MODE === "demo" && environment.NEXT_TELEMETRY_DISABLED === "1" && environment.PLAYWRIGHT_BROWSERS_PATH === "/ms-playwright" && SHA.test(environment.GITHUB_SHA ?? ""), "CAPTURE_ENV");
  need(environment.LANG === "C.UTF-8" && environment.LC_ALL === "C.UTF-8" && environment.TZ === "America/Sao_Paulo" && ["PATH", "GITHUB_WORKSPACE", "RUNNER_TEMP"].every(key => typeof environment[key] === "string" && environment[key].length > 0), "CAPTURE_ENV");
}
async function scope() {
  assertCaptureInterface({ route: projectRoute, receipt: projectReceipt, files: projectFiles() });
  assertCaptureEnvironment(process.env, process.platform, process.versions.node, process.argv.length);
  need(await realpath(ROOT) === ROOT && await realpath(process.env.GITHUB_WORKSPACE ?? "") === ROOT, "CAPTURE_ROOT");
  const entries = await readdir(ROOT);
  need(!entries.some(name => /^\.env(?:\.|$)/u.test(name) && name !== ".env.example"), "CAPTURE_PRIVATE_ENV_FILE");
  const temp = await realpath(process.env.RUNNER_TEMP ?? "");
  need((await lstat(temp)).isDirectory(), "CAPTURE_TEMP");
  home = await mkdtemp(join(temp, "landing-project-capture-"));
  expected = { sha: git(["rev-parse", "HEAD"]).trim(), tree: git(["rev-parse", "HEAD^{tree}"]).trim() };
  need(SHA.test(expected.sha) && SHA.test(expected.tree) && expected.sha === process.env.GITHUB_SHA, "CAPTURE_SOURCE");
  need(git(["status", "--porcelain=v1", "--untracked-files=all"]).trim() === "", "CAPTURE_DIRTY_SOURCE");
  expected.generatorSha256 = hash(await canonical(codeFiles[0], 256 * 1024));
  expected.policySha256 = hash(await canonical(codeFiles[1], 128 * 1024));
  await canonical(".next/BUILD_ID", 4096);
  await canonical("node_modules/next/dist/bin/next", 1024 * 1024);
  startedAt = Date.now();
}
function childEnv(browser = false) {
  const env = { PATH: process.env.PATH, HOME: home, TMPDIR: home, TMP: home, TEMP: home, LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "America/Sao_Paulo", NODE_ENV: "production", APP_MODE: "demo", APP_URL: BASE, NEXT_TELEMETRY_DISABLED: "1", CI: "true", GITHUB_SHA: expected.sha, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
  if (browser) env.PLAYWRIGHT_BROWSERS_PATH = "/ms-playwright";
  return env;
}
export function assertOwnedMember(identity, row, leader = false) {
  need(identity && Number.isSafeInteger(identity.pid) && identity.pid > 1 && typeof identity.start === "bigint" && identity.group === identity.pid && identity.session === identity.pid, "CAPTURE_OWNER_UNPROVEN");
  need(row && Number.isSafeInteger(row.pid) && row.pid > 1 && typeof row.start === "bigint" && row.group === identity.pid && row.session === identity.pid && row.start >= identity.start, "CAPTURE_OWNER_UNPROVEN");
  if (leader) need(row.pid === identity.pid && row.start === identity.start, "CAPTURE_OWNER_CHANGED");
}

async function statPid(pid) {
  try {
    const raw = await readFile("/proc/" + pid + "/stat", "utf8"), at = raw.lastIndexOf(") ");
    need(at > 0, "CAPTURE_PROC");
    const parts = raw.slice(at + 2).trim().split(/\s+/u);
    return { pid: Number(pid), state: parts[0], group: Number(parts[2]), session: Number(parts[3]), start: BigInt(parts[19]) };
  } catch (error) { if (error.code === "ENOENT" || error.code === "ESRCH") return null; throw error; }
}
async function groupMembers(processState) {
  const rows = [], current = await statPid(processState.pid);
  if (current && processState.identity) assertOwnedMember(processState.identity, current, true);
  for (const name of await readdir("/proc")) {
    if (!/^[1-9][0-9]*$/u.test(name)) continue;
    const row = await statPid(name);
    if (row?.group !== processState.pid || row.state === "Z" || row.state === "X") continue;
    assertOwnedMember(processState.identity, row);
    rows.push(row.pid);
  }
  return rows;
}
async function launch(role, args, browser) {
  const child = spawn(process.execPath, args, { cwd: ROOT, env: childEnv(browser), detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const state = { role, child, pid: child.pid, identity: null, done: false, code: null, fault: null, bytes: 0, tail: "", closedCodes: new Set(), cleanupConfirmed: false };
  owned.push(state);
  child.once("error", () => { state.fault = "CAPTURE_SPAWN"; state.done = true; });
  child.once("close", (code) => { state.done = true; state.code = code; });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", bytes => {
    state.bytes += bytes.length;
    if (state.bytes > 512 * 1024) state.fault = "CAPTURE_OUTPUT_LIMIT";
    const text = state.tail + bytes.toString("utf8");
    for (const match of text.matchAll(/\b(?:CAPTURE_[A-Z_]{1,60}|EADDRINUSE|EACCES|ENOENT)\b/gu)) if (state.closedCodes.size < 8) state.closedCodes.add(match[0]);
    state.tail = text.slice(-128);
  });
  need(Number.isSafeInteger(state.pid) && state.pid > 1, "CAPTURE_SPAWN");
  state.identity = await statPid(state.pid);
  assertOwnedMember(state.identity, state.identity, true);
  return state;
}
function alive(state) { need(!interrupted && !state.done && !state.fault, state.fault ?? "CAPTURE_PROCESS_EXIT"); }
async function closeOwned(state) {
  if (!state?.pid) return false;
  for (const [signal, milliseconds] of [["SIGTERM", 5000], ["SIGKILL", 3000]]) {
    const members = await groupMembers(state);
    if (!members.length && state.done) { state.cleanupConfirmed = true; return true; }
    if (members.length) { try { process.kill(-state.pid, signal); } catch (error) { if (error.code !== "ESRCH") throw error; } }
    const end = Date.now() + milliseconds;
    while (Date.now() < end) {
      if (!(await groupMembers(state)).length && state.done) { state.cleanupConfirmed = true; return true; }
      await delay(50);
    }
  }
  return false;
}
async function freePort() {
  const server = createServer();
  await new Promise((accept, reject) => { server.once("error", reject); server.listen({ host: "127.0.0.1", port: PORT, exclusive: true }, accept); });
  await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept()));
}
async function portOpen() {
  return new Promise(accept => {
    const socket = createConnection({ host: "127.0.0.1", port: PORT });
    let done = false;
    const settle = value => { if (done) return; done = true; socket.destroy(); accept(value); };
    socket.setTimeout(500, () => settle(false)); socket.once("error", () => settle(false)); socket.once("connect", () => settle(true));
  });
}
async function serverReady(server) {
  const end = Date.now() + 45000;
  while (Date.now() < end) { alive(server); if (await portOpen()) return; await delay(100); }
  throw new Refusal("CAPTURE_READY_TIMEOUT");
}
async function ssrDemo() {
  const html = await new Promise((accept, reject) => {
    const chunks = []; let count = 0, settled = false, request, response, timer;
    const abort = () => settle(new Refusal("CAPTURE_INTERRUPTED"));
    function settle(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (abortPendingSsr === abort) abortPendingSsr = null;
      response?.destroy(); request?.destroy();
      if (error) reject(error); else accept(value);
    }
    abortPendingSsr = abort;
    timer = setTimeout(() => settle(new Refusal("CAPTURE_SSR_TIMEOUT")), 10000);
    if (interrupted) { abort(); return; }
    try {
      request = get(BASE + projectRoute, { headers: { Accept: "text/html" } }, incoming => {
        response = incoming;
        incoming.once("error", () => settle(new Refusal("CAPTURE_SSR_RESPONSE")));
        incoming.once("aborted", () => { if (!incoming.complete) settle(new Refusal("CAPTURE_SSR_ABORTED")); });
        incoming.once("close", () => { if (!incoming.complete) settle(new Refusal("CAPTURE_SSR_INCOMPLETE")); });
        if (settled) { incoming.destroy(); return; }
        if (incoming.statusCode !== 200 || !/^text\/html\b/u.test(incoming.headers["content-type"] ?? "")) { settle(new Refusal("CAPTURE_SSR_STATUS")); return; }
        incoming.on("data", chunk => {
          if (settled) return;
          count += chunk.length;
          if (count > 4 * 1024 * 1024) settle(new Refusal("CAPTURE_SSR_LIMIT")); else chunks.push(chunk);
        });
        incoming.once("end", () => {
          if (!incoming.complete) { settle(new Refusal("CAPTURE_SSR_INCOMPLETE")); return; }
          settle(null, Buffer.concat(chunks).toString("utf8"));
        });
      });
      request.once("error", () => settle(new Refusal("CAPTURE_SSR_REQUEST")));
      request.once("close", () => { if (!response || !response.complete) settle(new Refusal("CAPTURE_SSR_INCOMPLETE")); });
    } catch { settle(new Refusal("CAPTURE_SSR_REQUEST")); }
  });
  need(html.includes('<span class="shell-demo-label">Demonstração</span>'), "CAPTURE_SSR_DEMO");
}

async function captureDone(capture, server) {
  const end = Date.now() + 180000;
  while (Date.now() < end) {
    alive(server); need(!interrupted && !capture.fault, capture.fault ?? "CAPTURE_INTERRUPTED");
    if (capture.done) { need(capture.code === 0, "CAPTURE_CLI_EXIT"); return; }
    await delay(50);
  }
  throw new Refusal("CAPTURE_CLI_TIMEOUT");
}
const sourceKeys = ["sha", "tree", "generatorSha256", "policySha256"];
const recordKeys = ["file", "sha256", "bytes", "sidecar", "sidecarSha256", "sidecarBytes", "theme", "viewport", "density", "clip", "pixels", "route"];
function sourceMatches(value) { return exact(value, sourceKeys) && sourceKeys.every(key => value[key] === expected[key]); }
export function assertGeometry(record, index) {
  const mobile = index % 2 === 1, viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  need(record.theme === (index < 2 ? "light" : "dark") && same(record.viewport, viewport) && record.density === (mobile ? 3 : 2) && record.route === projectRoute, "CAPTURE_VARIANT");
  need(exact(record.clip, ["x", "y", "width", "height"]) && Object.values(record.clip).every(Number.isFinite) && record.clip.x >= 0 && record.clip.y >= 0 && record.clip.width > 0 && record.clip.height > 0 && record.clip.width <= 2000 && record.clip.height <= 4000, "CAPTURE_CLIP");
  need(exact(record.pixels, ["width", "height"]) && Object.values(record.pixels).every(value => Number.isSafeInteger(value) && value > 0 && value <= 12000), "CAPTURE_PIXELS");
}
async function validateOutputs() {
  const raw = await canonical(projectReceipt, 256 * 1024), receipt = JSON.parse(raw.toString("utf8"));
  need(exact(receipt, ["version", "scene", "mode", "source", "claims", "requestPolicy", "records"]) && receipt.version === 1 && receipt.scene === "projeto" && receipt.mode === "demo" && sourceMatches(receipt.source), "CAPTURE_RECEIPT");
  need(exact(receipt.claims, ["hostedValidated", "productionValidated"]) && receipt.claims.hostedValidated === false && receipt.claims.productionValidated === false, "CAPTURE_CLAIMS");
  const policy = receipt.requestPolicy;
  need(exact(policy, ["scope", "observed", "refused", "serviceWorkers", "webSockets", "methods", "origin"]) && policy.scope === "browser-capture" && Number.isSafeInteger(policy.observed) && policy.observed > 0 && policy.refused === 0 && policy.serviceWorkers === "block" && policy.webSockets === "deny" && same(policy.methods, ["GET"]) && policy.origin === BASE, "CAPTURE_REQUEST_POLICY");
  assertProjectRecords(receipt.records);
  for (const [index, record] of receipt.records.entries()) {
    need(exact(record, recordKeys), "CAPTURE_RECORD"); assertGeometry(record, index);
    const bitmap = await canonical(record.file, 8 * 1024 * 1024), side = await canonical(record.sidecar, 128 * 1024);
    need(bitmap.length === record.bytes && hash(bitmap) === record.sha256 && side.length === record.sidecarBytes && hash(side) === record.sidecarSha256 && HEX.test(record.sha256) && HEX.test(record.sidecarSha256), "CAPTURE_DIGEST");
    need(bitmap.subarray(0, 4).toString("ascii") === "RIFF" && bitmap.subarray(8, 12).toString("ascii") === "WEBP", "CAPTURE_WEBP");
    const metadata = JSON.parse(side.toString("utf8")), capture = metadata.capture;
    need(exact(metadata, ["prompt", "createdAt", "capture"]) && typeof metadata.prompt === "string" && metadata.prompt.length > 0 && metadata.prompt.length <= 4096, "CAPTURE_SIDECAR");
    need(typeof metadata.createdAt === "string" && Number.isFinite(Date.parse(metadata.createdAt)) && Date.parse(metadata.createdAt) >= startedAt - 1000 && Date.parse(metadata.createdAt) <= Date.now() + 5000, "CAPTURE_TIMESTAMP");
    need(exact(capture, ["version", "source", "mode", "route", "state", "theme", "viewport", "density", "clip", "pixels", "sha256"]) && capture.version === 1 && sourceMatches(capture.source) && capture.mode === "demo" && capture.state === "project-detail-demo-neutralized" && capture.sha256 === record.sha256, "CAPTURE_SIDECAR_STATE");
    for (const key of ["route", "theme", "viewport", "density", "clip", "pixels"]) need(same(capture[key], record[key]), "CAPTURE_SIDECAR_MATCH");
  }
  need(git(["rev-parse", "HEAD"]).trim() === expected.sha && git(["rev-parse", "HEAD^{tree}"]).trim() === expected.tree, "CAPTURE_SOURCE_CHANGED");
  need(hash(await canonical(codeFiles[0], 256 * 1024)) === expected.generatorSha256 && hash(await canonical(codeFiles[1], 128 * 1024)) === expected.policySha256, "CAPTURE_CODE_CHANGED");
  const dirty = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]).split("\0").filter(Boolean);
  need(dirty.every(entry => entry.length > 3 && !/[RCU]/u.test(entry.slice(0, 2)) && outputs.includes(entry.slice(3))), "CAPTURE_OUTPUT_ALLOWLIST");
  return { sha256: hash(raw), observed: policy.observed };
}
function checkContract() {
  let checks = 0;
  const pass = fn => { fn(); checks++; };
  const deny = fn => { assert.throws(fn, error => error instanceof Refusal); checks++; };
  const input = { route: "/projetos?project=project-sc-v2", receipt: "docs/implementation/evidence/landing-project-capture.json", files: fixedImages.slice() };
  pass(() => assertCaptureInterface(input));
  deny(() => assertCaptureInterface({ ...input, files: input.files.concat("src/components/features/conheca/telas/inicio.webp") }));
  deny(() => assertCaptureInterface({ ...input, files: [input.files[0], input.files[0], ...input.files.slice(2)] }));
  deny(() => assertCaptureInterface({ ...input, route: "/api/projetos" }));
  deny(() => assertCaptureInterface({ ...input, receipt: "work/other.json" }));
  const environment = { PATH: "/usr/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "America/Sao_Paulo", CI: "true", GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/codex/mvp-goals-terminal-20261023", GITHUB_REPOSITORY: "kauanbarateli/Segundo-Cerebro", GITHUB_SHA: "a".repeat(40), GITHUB_WORKSPACE: "/fixture/repo", RUNNER_TEMP: "/fixture/temp", RUNNER_OS: "Linux", RUNNER_ENVIRONMENT: "github-hosted", APP_MODE: "demo", NEXT_TELEMETRY_DISABLED: "1", PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright" };
  pass(() => assertCaptureEnvironment(environment, "linux", "24.0.0", 2));
  for (const key of ["SUPABASE_URL", "GITHUB_TOKEN", "AWS_SECRET_ACCESS_KEY", "NODE_OPTIONS"]) deny(() => assertCaptureEnvironment({ ...environment, [key]: "fixture" }, "linux", "24.0.0", 2));
  for (const changed of [{ APP_MODE: "supabase" }, { GITHUB_EVENT_NAME: "pull_request" }, { GITHUB_EVENT_NAME: "workflow_dispatch" }, { GITHUB_REF: "refs/heads/main" }, { GITHUB_REPOSITORY: "other/repo" }, { GITHUB_SHA: "A".repeat(40) }, { RUNNER_ENVIRONMENT: "self-hosted" }, { NEXT_TELEMETRY_DISABLED: "0" }]) deny(() => assertCaptureEnvironment({ ...environment, ...changed }, "linux", "24.0.0", 2));
  deny(() => assertCaptureEnvironment(environment, "win32", "24.0.0", 2));
  deny(() => assertCaptureEnvironment(environment, "linux", "23.0.0", 2));
  deny(() => assertCaptureEnvironment(environment, "linux", "24.0.0", 3));
  const owner = { pid: 42, group: 42, session: 42, start: 200n }, member = { pid: 43, group: 42, session: 42, start: 201n };
  pass(() => assertOwnedMember(owner, owner, true));
  pass(() => assertOwnedMember(owner, member));
  deny(() => assertOwnedMember(owner, { ...owner, start: 201n }, true));
  deny(() => assertOwnedMember(owner, { ...member, session: 99 }));
  deny(() => assertOwnedMember(owner, { ...member, group: 99 }));
  deny(() => assertOwnedMember(owner, { ...member, start: 199n }));
  deny(() => assertOwnedMember(null, member));
  const record = { theme: "light", viewport: { height: 900, width: 1440 }, density: 2, route: projectRoute, clip: { x: 0, y: 0, width: 1440, height: 900 }, pixels: { width: 2880, height: 1800 } };
  pass(() => assertGeometry(record, 0));
  deny(() => assertGeometry({ ...record, density: 3 }, 0));
  deny(() => assertGeometry({ ...record, clip: { ...record.clip, x: -1 } }, 0));
  deny(() => assertGeometry({ ...record, clip: { ...record.clip, height: NaN } }, 0));
  deny(() => assertGeometry({ ...record, pixels: { width: 0, height: 1800 } }, 0));
  process.stdout.write(JSON.stringify({ schemaVersion: 1, scenario: "landing-project-capture-ci-pure", code: "PASSED", checks, runtimeCertified: false, filesystemAccess: false, networkAccess: false, processesStarted: false }) + "\n");
}

async function main() {
let failure = null, result = null, portReleased = false;
process.on("SIGTERM", onSignal); process.on("SIGINT", onSignal);
try {
  await scope(); scopeVerified = true; need(!interrupted, "CAPTURE_INTERRUPTED"); await freePort();
  const server = await launch("next", [resolve(ROOT, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(PORT)], false);
  await serverReady(server); await ssrDemo(); ssrVerified = true; alive(server);
  const capture = await launch("capture", [resolve(ROOT, codeFiles[0]), "--only", "projeto", "--base", BASE], true);
  await captureDone(capture, server); alive(server);
} catch (error) { failure = error instanceof Refusal ? error.code : "CAPTURE_OPERATION_REFUSED"; }
finally {
  for (const state of owned.slice().reverse()) {
    try { if (!await closeOwned(state)) failure ??= "CAPTURE_CLEANUP_UNCONFIRMED"; } catch { failure ??= "CAPTURE_CLEANUP_UNCONFIRMED"; }
  }
  if (owned.length) { portReleased = !await portOpen(); if (!portReleased) failure ??= "CAPTURE_PORT_STILL_OPEN"; }
  if (!failure && !interrupted) { try { result = await validateOutputs(); } catch (error) { failure = error instanceof Refusal ? error.code : "CAPTURE_OUTPUT_REFUSED"; } }
  if (home) { try { await rm(home, { recursive: true, force: false }); } catch { failure ??= "CAPTURE_HOME_CLEANUP"; } }
  process.off("SIGTERM", onSignal); process.off("SIGINT", onSignal);
}
if (interrupted) failure ??= "CAPTURE_INTERRUPTED";
const report = { schemaVersion: 1, scenario: "landing-project-capture-ci", status: failure ? "failed" : "passed", code: failure ?? "PASSED", source: expected ?? null, scope: { verified: scopeVerified, appMode: scopeVerified ? "demo" : null, bind: "127.0.0.1", port: PORT, ssrDemoConfirmed: ssrVerified }, outputs: result && !failure ? outputs.length : 0, receiptSha256: result?.sha256 ?? null, owned: owned.map(state => ({ role: state.role, pid: state.pid ?? null, closed: state.cleanupConfirmed, diagnosticCodes: [...state.closedCodes] })), portReleased, hostedValidated: false, productionValidated: false };
process.stdout.write(JSON.stringify(report) + "\n");
process.exitCode = failure ? 1 : 0;

}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === "--check-contract") checkContract();
  else await main();
}
