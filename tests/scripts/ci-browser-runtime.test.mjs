import test from "node:test";
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, posix, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { CI_BROWSER_IMAGE, runCiBrowserVersion, verifyCiBrowserRuntime } from "../../scripts/verification/check-ci-browser-runtime.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CACHE = "/ms-playwright";
const FULL = CACHE + "/chromium-1243/chrome-linux64/chrome";
const SHELL = CACHE + "/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const FFMPEG = CACHE + "/ffmpeg-1011/ffmpeg-linux";
const DOCKER_INFO = CACHE + "/.docker-info";
const SDK = join(ROOT, "node_modules", "playwright-core", "browsers.json");
const VERSION = "153.0.8010.12";
const sourceSha = "a".repeat(40);
const encoded = value => Buffer.from(JSON.stringify(value));
const versionResult = value => ({ stdout: Buffer.from(value), stderr: Buffer.alloc(0) });

function fixture() {
  const files = new Map(), directories = new Set([ROOT, CACHE, join(ROOT, "node_modules"), join(ROOT, "node_modules", "@playwright")]);
  const symlinks = new Set(), aliases = new Map(), events = [], versions = new Map();
  let serial = 1, closeRefused = false;
  const put = (path, bytes, mode = 0o100600) => { files.set(path, { bytes, mode, dev: 1, ino: serial++ }); };
  const putJson = (path, value) => put(path, encoded(value));
  putJson(DOCKER_INFO, { driverVersion: "1.63.0", dockerImageName: "mcr.microsoft.com/playwright:v1.63.0-noble" });
  for (const name of ["playwright", "playwright-core", "@playwright/test"]) {
    const parent = join(ROOT, "node_modules", name); directories.add(parent);
    putJson(join(parent, "package.json"), { name, version: "1.63.0", harmlessPackageMetadata: true });
  }
  putJson(SDK, { browsers: [
    { name: "chromium", revision: "1243", browserVersion: VERSION, installByDefault: true },
    { name: "chromium-headless-shell", revision: "1243", browserVersion: VERSION, installByDefault: true },
    { name: "ffmpeg", revision: "1011", installByDefault: true },
  ] });
  for (const path of [FULL, SHELL, FFMPEG]) {
    const cacheDirectory = posix.join(CACHE, path.slice(CACHE.length + 1).split("/")[0]);
    directories.add(cacheDirectory); directories.add(posix.dirname(path));
    put(posix.join(cacheDirectory, "INSTALLATION_COMPLETE"), Buffer.alloc(0));
    put(path, Buffer.from("synthetic-runtime-fixture:" + path), 0o100755);
    if (path !== FFMPEG) versions.set(path, versionResult("Google Chrome for Testing " + VERSION + "\n"));
  }
  const stat = (path, entry = files.get(path)) => {
    const exists = directories.has(path) || entry !== undefined || symlinks.has(path);
    if (!exists) throw Object.assign(new Error("unexported missing fixture"), { code: "ENOENT" });
    return { isDirectory: () => directories.has(path), isFile: () => entry !== undefined, isSymbolicLink: () => symlinks.has(path),
      size: entry?.bytes.length ?? 0, mode: entry?.mode ?? 0o40700, dev: entry?.dev ?? 1, ino: entry?.ino ?? 1 };
  };
  const ports = {
    environment: { CI: "true", GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "kauanbarateli/Segundo-Cerebro", GITHUB_SHA: sourceSha,
      GITHUB_WORKSPACE: ROOT, PLAYWRIGHT_BROWSERS_PATH: CACHE },
    runtime: { platform: "linux", arch: "x64", nodeVersion: "24.22.0" },
    io: {
      lstat: async path => { events.push(["lstat", path]); return stat(path); },
      realpath: async path => aliases.get(path) ?? path,
      readFile: async path => { events.push(["read", path]); return files.get(path).bytes; },
      open: async (path, flags) => {
        events.push(["open", path, flags]); const entry = files.get(path);
        return { stat: async () => stat(path, entry), createReadStream: () => Readable.from([entry.bytes]),
          close: async () => { events.push(["close", path]); if (closeRefused) throw new Error("private-close-error"); } };
      },
    },
    version: async path => { events.push(["version", path]); return versions.get(path); },
  };
  return { ports, files, directories, symlinks, aliases, events, versions, put, putJson, refuseClose: () => { closeRefused = true; } };
}

const refuses = async (value, code) => assert.rejects(() => verifyCiBrowserRuntime(value.ports), error => {
  assert.equal(error.message, "CI browser runtime refused.");
  if (code !== undefined) assert.equal(error.code, code);
  assert.match(error.code, /^(?:ENVIRONMENT|PATH|SDK|IMAGE|CACHE|BINARY|VERSION_COMMAND|VERSION|RUNTIME)_REFUSED$/);
  return true;
});

test("CI image preflight binds both exact browser modes and FFmpeg without claiming application acceptance", async () => {
  const value = fixture(), report = await verifyCiBrowserRuntime(value.ports);
  assert.equal(report.status, "BOUND"); assert.equal(report.applicationAccepted, false);
  assert.equal(report.sourceSha, sourceSha); assert.equal(report.declaredImage, CI_BROWSER_IMAGE);
  assert.equal(report.driverVersion, "1.63.0"); assert.equal(report.browserVersion, VERSION);
  assert.deepEqual(report.cacheFiles.map(row => [row.name, row.revision, row.version]), [
    ["chromium", "1243", VERSION], ["chromium-headless-shell", "1243", VERSION], ["ffmpeg", "1011", null],
  ]);
  for (const [index, path] of [FULL, SHELL, FFMPEG].entries()) {
    assert.equal(report.cacheFiles[index].bytes, value.files.get(path).bytes.length);
    assert.equal(report.cacheFiles[index].sha256, createHash("sha256").update(value.files.get(path).bytes).digest("hex"));
  }
  assert.deepEqual(value.events.filter(row => row[0] === "version").map(row => row[1]), [FULL, SHELL]);
  assert.equal(value.events.filter(row => row[0] === "open").length, 6);
  assert.equal(value.events.filter(row => row[0] === "close").length, 6);
  assert.ok(value.events.filter(row => row[0] === "open").every(row => row[2] === (constants.O_RDONLY | constants.O_NOFOLLOW)));
});

test("CI environment and runtime refusals happen before filesystem access or version processes", async () => {
  const changes = [
    ["CI", "false"], ["GITHUB_ACTIONS", "false"], ["GITHUB_REPOSITORY", "contasvoedigital/other"],
    ["GITHUB_SHA", "not-a-commit"], ["GITHUB_WORKSPACE", ROOT + "/other"], ["PLAYWRIGHT_BROWSERS_PATH", "/tmp/browser"],
    ["NODE_TLS_REJECT_UNAUTHORIZED", "0"], ["PLAYWRIGHT_DOWNLOAD_HOST", "https://unexpected.invalid"],
    ["PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST", "https://unexpected.invalid"], ["PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS", "1"],
  ];
  for (const [key, entry] of changes) {
    const value = fixture(); value.ports.environment[key] = entry; await refuses(value, "ENVIRONMENT_REFUSED"); assert.equal(value.events.length, 0);
  }
  for (const [key, entry] of [["platform", "win32"], ["arch", "arm64"], ["nodeVersion", "22.20.0"]]) {
    const value = fixture(); value.ports.runtime[key] = entry; await refuses(value, "ENVIRONMENT_REFUSED"); assert.equal(value.events.length, 0);
  }
  const value = fixture(); value.ports.environment = null; await refuses(value, "ENVIRONMENT_REFUSED"); assert.equal(value.events.length, 0);
});

test("CI environment accessors are refused without invoking their getter", async () => {
  const value = fixture(); let invoked = false;
  Object.defineProperty(value.ports.environment, "CI", { get() { invoked = true; throw new Error("private getter"); } });
  await refuses(value, "ENVIRONMENT_REFUSED"); assert.equal(invoked, false); assert.equal(value.events.length, 0);
});

test("official Docker metadata requires precisely its two published fields and exact driver/image", async () => {
  for (const image of [
    { driverVersion: "1.64.0", dockerImageName: "mcr.microsoft.com/playwright:v1.63.0-noble" },
    { driverVersion: "1.63.0", dockerImageName: "mcr.microsoft.com/playwright:v1.63.0-jammy" },
    { driverVersion: "1.63.0", dockerImageName: "mcr.microsoft.com/playwright:v1.63.0-noble", fabricatedImageId: "extra" },
    { driverVersion: "1.63.0" }, null,
  ]) { const value = fixture(); value.putJson(DOCKER_INFO, image); await refuses(value, "IMAGE_REFUSED"); assert.equal(value.events.some(row => row[0] === "version"), false); }
});

test("malformed oversized or invalid UTF8 metadata cannot qualify an image or SDK", async () => {
  for (const [path, code] of [[DOCKER_INFO, "IMAGE_REFUSED"], [SDK, "SDK_REFUSED"]]) {
    for (const bytes of [Buffer.from("{incomplete"), Buffer.from([0xff, 0xff]), Buffer.alloc(65537, 0x20)]) {
      const value = fixture(); value.put(path, bytes); await refuses(value, code);
      assert.equal(value.events.some(row => row[0] === "version"), false);
    }
  }
});

test("cache and metadata symlinks or realpath aliases cannot supply the pinned image runtime", async () => {
  for (const path of [ROOT, CACHE, DOCKER_INFO, posix.dirname(FULL), FULL, SHELL, FFMPEG]) {
    const value = fixture(); value.symlinks.add(path); await refuses(value);
  }
  for (const path of [CACHE, DOCKER_INFO, FULL, SHELL]) {
    const value = fixture(); value.aliases.set(path, path + "-elsewhere"); await refuses(value);
  }
});

test("SDK metadata must match all three installed 1.63 packages", async () => {
  for (const name of ["playwright", "playwright-core", "@playwright/test"]) {
    for (const json of [{ name, version: "1.64.0" }, { name: "other", version: "1.63.0" }]) {
      const value = fixture(); value.putJson(join(ROOT, "node_modules", name, "package.json"), json); await refuses(value, "SDK_REFUSED");
    }
  }
});

test("browser catalogue refuses a missing duplicate changed overridden or nondefault component", async () => {
  for (const mutate of [
    rows => rows.pop(), rows => rows.push({ ...rows[0] }), rows => { rows[0].revision = "1244"; },
    rows => { rows[1].browserVersion = "157.0.8103.6"; }, rows => { rows[2].revision = "1012"; },
    rows => { rows[1].revisionOverrides = {}; }, rows => { rows[0].installByDefault = false; },
  ]) {
    const value = fixture(), catalogue = JSON.parse(value.files.get(SDK).bytes.toString("utf8"));
    mutate(catalogue.browsers); value.putJson(SDK, catalogue); await refuses(value, "SDK_REFUSED");
  }
});

test("missing or nonempty installation markers fail before any download or version fallback", async () => {
  for (const path of [FULL, SHELL, FFMPEG]) {
    const marker = posix.join(CACHE, path.slice(CACHE.length + 1).split("/")[0], "INSTALLATION_COMPLETE");
    const missing = fixture(); missing.files.delete(marker); await refuses(missing);
    const nonempty = fixture(); nonempty.put(marker, Buffer.from("not-a-marker")); await refuses(nonempty, "CACHE_REFUSED");
  }
});

test("executables require ordinary nonempty executable files and stable bytes around version verification", async () => {
  const missing = fixture(); missing.files.delete(SHELL); await refuses(missing);
  const empty = fixture(); empty.put(FULL, Buffer.alloc(0), 0o100755); await refuses(empty, "BINARY_REFUSED");
  const disabled = fixture(); disabled.files.get(SHELL).mode = 0o100600; await refuses(disabled, "BINARY_REFUSED");
  const changed = fixture(); changed.ports.version = async path => { changed.put(path, Buffer.from("changed synthetic binary"), 0o100755); return versionResult("Google Chrome for Testing " + VERSION); };
  await refuses(changed, "BINARY_REFUSED");
  const unclosed = fixture(); unclosed.refuseClose(); await refuses(unclosed, "BINARY_REFUSED");
});

test("version output is bounded closed UTF8 and exact153 for both browser modes", async () => {
  const invalid = [
    versionResult("Google Chrome for Testing 157.0.8103.6\n"), versionResult("Google Chrome for Testing " + VERSION + "\nextra\n"),
    versionResult("unexpected private output " + VERSION), versionResult("x".repeat(4097)),
    { stdout: Buffer.from([0xff]), stderr: Buffer.alloc(0) },
    { stdout: Buffer.from("Google Chrome for Testing " + VERSION), stderr: Buffer.from("private diagnostic") },
    { stdout: Buffer.from("Google Chrome for Testing " + VERSION), stderr: Buffer.alloc(0), extra: true },
  ];
  for (const path of [FULL, SHELL]) for (const result of invalid) { const value = fixture(); value.versions.set(path, result); await refuses(value, "VERSION_REFUSED"); }
  const failed = fixture(); failed.ports.version = async () => { throw new Error("private process stdout"); }; await refuses(failed, "RUNTIME_REFUSED");
});

test("version command fixes executable args deadline byte limit kill signal and sterile environment", async () => {
  let invocation;
  const output = await runCiBrowserVersion(FULL, (path, args, options, callback) => {
    invocation = { path, args, options }; callback(null, Buffer.from("Google Chrome for Testing " + VERSION), Buffer.alloc(0));
  });
  assert.equal(invocation.path, FULL); assert.deepEqual(invocation.args, ["--version"]);
  assert.equal(invocation.options.shell, false); assert.equal(invocation.options.timeout, 10000);
  assert.equal(invocation.options.maxBuffer, 4096); assert.equal(invocation.options.killSignal, "SIGKILL");
  assert.deepEqual(invocation.options.env, { PATH: "/usr/bin:/bin", HOME: "/tmp", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" });
  assert.ok(output.stdout instanceof Uint8Array);
  assert.throws(() => runCiBrowserVersion("/tmp/other-executable"), error => error.code === "VERSION_COMMAND_REFUSED");
});

test("version subprocess failures stay closed and cannot export command stderr or timeout details", async () => {
  for (const code of ["ETIMEDOUT", "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", "ENOENT"]) {
    await assert.rejects(() => runCiBrowserVersion(SHELL, (path, args, options, callback) => {
      callback(Object.assign(new Error("private executable details"), { code }), Buffer.from("private stdout"), Buffer.from("private stderr"));
    }), error => error.code === "VERSION_COMMAND_REFUSED" && error.message === "CI browser version command refused.");
  }
});

test("workflow keeps original gates and pins both browser modes without an executable download command", async () => {
  const yaml = await readFile(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  assert.ok(yaml.includes("image: " + CI_BROWSER_IMAGE)); assert.match(yaml, /options: --ipc=host/);
  assert.match(yaml, /shell: bash/); assert.match(yaml, /PLAYWRIGHT_BROWSERS_PATH: \/ms-playwright/);
  assert.match(yaml, /python3 python3-venv/); assert.match(yaml, /node-version-file: \.nvmrc/);
  assert.match(yaml, /node scripts\/verification\/check-ci-browser-runtime\.mjs/);
  assert.match(yaml, /node node_modules\/playwright\/cli\.js install-deps chromium/);
  assert.doesNotMatch(yaml, /playwright(?:\/cli\.js)? install --|NODE_TLS_REJECT_UNAUTHORIZED|PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS|--only-shell|--no-shell/);
  for (const gate of ["npm audit", "npm run test:local-sql", "npm run typecheck", "npm run lint", "npm run test:timezones", "tests/scripts/*.test.mjs", "npm run check:layers", "npm run check:design-system", "npm run check:impeccable", "npm run build", "npm run check:client-auth", "npm run test:e2e"]) assert.ok(yaml.includes(gate), gate);
});

test("container Git trusts only its exact checkout before the historical baseline fetch", async () => {
  const yaml = (await readFile(join(ROOT, ".github/workflows/ci.yml"), "utf8")).replaceAll("\r\n", "\n");
  const checkout = "      - uses: actions/checkout@v7\n";
  const scopedTrust = "      - name: Confiar somente no checkout efêmero do job\n"
    + "        run: git config --global --add safe.directory \"$GITHUB_WORKSPACE\"\n";
  const baseline = "      - name: Baseline visual — dois commits históricos fixados\n";
  const assertScopedTrust = source => {
    assert.equal(source.split("safe.directory").length - 1, 1);
    assert.ok(source.includes(checkout + scopedTrust + baseline));
  };
  assertScopedTrust(yaml);
  assert.throws(() => assertScopedTrust(yaml.replace(scopedTrust, scopedTrust.replace('"$GITHUB_WORKSPACE"', '"*"'))));
  assert.throws(() => assertScopedTrust(yaml.replace(scopedTrust, scopedTrust.replace('"$GITHUB_WORKSPACE"', '"/__w/*"'))));
  assert.throws(() => assertScopedTrust(yaml.replace(scopedTrust, "")));
  assert.throws(() => assertScopedTrust(yaml.replace(scopedTrust, scopedTrust + '        # git config --global --add safe.directory "*"\n')));
});

test("native Admin and Recovery install only libraries while their qualified157 launch binding stays explicit", async () => {
  for (const name of ["admin-browser", "auth-recovery"]) {
    const yaml = await readFile(join(ROOT, ".github/workflows/" + name + "-local-ci.yml"), "utf8");
    assert.match(yaml, /node node_modules\/playwright\/cli\.js install-deps chromium/);
    assert.doesNotMatch(yaml, /playwright\/cli\.js install --/); assert.match(yaml, /cancel-in-progress: false/);
    const config = await readFile(join(ROOT, "playwright." + name + "-local.config.ts"), "utf8");
    assert.match(config, /await verifyQualifiedChromium\(\)/); assert.match(config, /executablePath:qualifiedChromium\.executablePath/);
  }
  const auth = await readFile(join(ROOT, ".github/workflows/auth-local-ci.yml"), "utf8");
  assert.doesNotMatch(auth, /playwright\/cli\.js install/);
});
