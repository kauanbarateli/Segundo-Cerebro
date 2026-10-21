import test from "node:test";
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { QUALIFIED_CHROMIUM as PIN, qualifiedChromiumPaths, assertQualifiedBrowserVersion, parseQualifiedChromiumRecord, verifyQualifiedChromium, prepareQualifiedChromium } from "../e2e-auth-local/qualified-chromium.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const paths = qualifiedChromiumPaths();
const refused = e => e?.message === "QUALIFIED_CHROMIUM_REFUSED";
const record = () => ({ schemaVersion: 1, scenario: "qualified-chromium-runtime", status: "BOUND", applicationAccepted: false, platform: "linux", arch: "x64", driverVersion: PIN.driverVersion, browserVersion: PIN.version, executableSha256: PIN.sha256, archiveSha256: PIN.archiveSha256, qualificationRun: PIN.qualificationRun, harnessSha256: PIN.harnessSha256, executableBytes: PIN.executableBytes, archiveBytes: PIN.archiveBytes });

test("qualified browser has one fixed descendant path and literal runtime version", () => {
  assert.deepEqual(paths, { executablePath: join(ROOT, "work/qualified-chromium/chrome-linux64/chrome"), assetsPath: join(ROOT, "work/qualified-chromium"), versionHome: join(ROOT, "work/qualified-chromium/version-home") });
  assert.equal(Object.isFrozen(paths), true); assert.equal(Object.isFrozen(PIN), true);
  assertQualifiedBrowserVersion("157.0.8103.6");
  for (const value of ["153.0.8010.12", "157.0.8103.6 ", undefined, { toString() { throw Error("private-canary"); } }]) assert.throws(() => assertQualifiedBrowserVersion(value), refused);
});
test("runtime record is a distinct closed binding rather than application acceptance", () => {
  const result = parseQualifiedChromiumRecord(`${JSON.stringify(record())}\n`);
  assert.deepEqual(result, record()); assert.equal(Object.isFrozen(result), true); assert.equal(result.applicationAccepted, false);
  for (const [key, value] of Object.entries(record())) {
    const bad = { ...record(), [key]: typeof value === "number" ? value + 1 : typeof value === "boolean" ? !value : "private-canary" };
    assert.throws(() => parseQualifiedChromiumRecord(JSON.stringify(bad)), refused);
    const missing = record(); delete missing[key]; assert.throws(() => parseQualifiedChromiumRecord(JSON.stringify(missing)), refused);
  }
});
test("runtime parser refuses duplicate/escaped/extra keys, extra output, and non-string accessors without coercion", () => {
  const text = JSON.stringify(record());
  for (const raw of [text.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'), text.replace('"status"', '"sta\\u0074us"'), JSON.stringify({ ...record(), secret: "private-canary" }), `${text}\n${text}`, `private-canary${text}`, " ", "x".repeat(4097), Object.defineProperty({}, "toString", { get() { throw Error("private-canary"); } })]) assert.throws(() => parseQualifiedChromiumRecord(raw), refused);
});

function ioFixture(options = {}) {
  const calls = { open: 0, close: 0, chunks: 0, destroy: 0, paths: [], reads: [] };
  const regular = { size: PIN.executableBytes, dev: 1, ino: 2, mode: 0o755, isFile: () => true, isSymbolicLink: () => false };
  const directory = { isDirectory: () => true, isSymbolicLink: () => false };
  const stream = {
    async *[Symbol.asyncIterator]() { for (const chunk of options.chunks ?? [Buffer.from("short")]) { calls.chunks++; yield chunk; } },
    destroy() { calls.destroy++; },
  };
  const io = {
    async lstat(path) { calls.paths.push(path); return path === paths.executablePath ? { ...regular, ...options.file } : { ...directory, ...options.directory }; },
    async realpath(path) { return options.alias ? `${path}-alias` : path; },
    async readFile(path) { calls.reads.push(path); const name = path.slice(join(ROOT, "node_modules").length + 1).replace(/[\\/]package\.json$/, "").replaceAll("\\", "/"); return Buffer.from(JSON.stringify({ name, version: options.driverVersion ?? PIN.driverVersion })); },
    async open(path, flags) {
      calls.open++; assert.equal(path, paths.executablePath); assert.equal(flags, constants.O_RDONLY | constants.O_NOFOLLOW);
      return { async stat() { return { ...regular, ...options.bound }; }, createReadStream(settings) { assert.deepEqual(settings, { highWaterMark: 1048576, autoClose: false }); return stream; }, async close() { calls.close++; if (options.closeFailure) throw Error("private-canary"); } };
    },
  };
  return { io, calls };
}
test("canonical directories, executable permissions/size, and unchanged driver are required before opening", async () => {
  for (const options of [{ alias: true }, { directory: { isSymbolicLink: () => true } }, { file: { isSymbolicLink: () => true } }, { file: { size: PIN.executableBytes - 1 } }, { file: { mode: 0o644 } }, { driverVersion: "1.64.1" }]) {
    const { io, calls } = ioFixture(options); await assert.rejects(verifyQualifiedChromium(io), refused); assert.equal(calls.open, 0);
  }
});
test("open descriptor identity, short EOF, oversized chunks, and close failure all refuse with owned handle closed", async () => {
  for (const options of [{ bound: { ino: 3 } }, {}, { chunks: [Buffer.alloc(1048577)] }, { closeFailure: true }]) {
    const { io, calls } = ioFixture(options); await assert.rejects(verifyQualifiedChromium(io), refused); assert.equal(calls.open, 1); assert.equal(calls.close, 1);
    assert.equal(calls.paths.every(path => path.startsWith(ROOT)), true);
  }
});
test("wrong full-length digest remains refused with streaming chunks of at most one MiB", async () => {
  const block = Buffer.alloc(1048576); const chunks = [];
  for (let left = PIN.executableBytes; left > 0; left -= block.length) chunks.push(left < block.length ? block.subarray(0, left) : block);
  const { io, calls } = ioFixture({ chunks }); await assert.rejects(verifyQualifiedChromium(io), refused);
  assert.equal(calls.chunks, Math.ceil(PIN.executableBytes / block.length)); assert.equal(calls.close, 1); assert.equal(calls.destroy, 1);
});
test("I/O port records refuse extra paths and getters before performing I/O", async () => {
  let touched = 0; const { io } = ioFixture();
  for (const ports of [{ ...io, executablePath: "/private-canary" }, Object.defineProperty({ ...io }, "lstat", { enumerable: true, get() { touched++; return io.lstat; } })]) await assert.rejects(verifyQualifiedChromium(ports), refused);
  assert.equal(touched, 0);
});
test("preparation invokes only the fixed Python entry point with bounded OS-only environment, never a fallback browser", async () => {
  let captured; const { io, calls } = ioFixture();
  const environment = { PATH: "unit-path", HOME: "/unit-home", SUPABASE_SECRET_KEY: "private-canary", DEBUG: "private-canary", SC_BROWSER_PATH: "/private-canary" };
  await assert.rejects(prepareQualifiedChromium(async (...args) => { captured = args; return { stdout: JSON.stringify(record()), groupConfirmed: true }; }, environment, io), refused);
  assert.deepEqual(captured, ["python3", ["scripts/verification/prepare-qualified-chromium.py", "prepare"], 300000, { env: { PATH: "unit-path", HOME: "/unit-home" }, maxBytes: 4096 }]);
  assert.equal(calls.open, 1); assert.equal(calls.close, 1);
});
test("uncertain process group, malformed binding, and accessor output prevent any binary read", async () => {
  for (const result of [{ stdout: JSON.stringify(record()), groupConfirmed: false }, { stdout: "private-canary", groupConfirmed: true }, Object.defineProperty({ groupConfirmed: true }, "stdout", { get() { throw Error("private-canary"); } })]) {
    const { io, calls } = ioFixture(); await assert.rejects(prepareQualifiedChromium(async () => result, {}, io), refused); assert.equal(calls.paths.length, 0); assert.equal(calls.open, 0);
  }
});
