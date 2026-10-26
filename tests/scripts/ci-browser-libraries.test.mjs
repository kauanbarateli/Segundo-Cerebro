import assert from "node:assert/strict";
import test from "node:test";
import { CI_BROWSER_IMAGE } from "../../scripts/verification/check-ci-browser-runtime.mjs";
import { ciBrowserLibrariesCli, ciBrowserLibrariesFailure, inspectCiBrowserLdd, runCiBrowserLdd, verifyCiBrowserLibraries } from "../../scripts/verification/check-ci-browser-libraries.mjs";

const paths = ["/ms-playwright/chromium-1243/chrome-linux64/chrome", "/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell"];
const output = text => ({ stdout: Buffer.from(text), stderr: Buffer.alloc(0) });
const validText = "\tlinux-vdso.so.1 (0x00007ffc12345000)\n\tlibnss3.so => /lib/x86_64-linux-gnu/libnss3.so (0x00007f1234567000)\n\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f1234568000)\n\t/lib64/ld-linux-x86-64.so.2 (0x00007f1234569000)\n";
function runtime() {
  return {
    schemaVersion: 1, scenario: "ci-browser-runtime", status: "BOUND", applicationAccepted: false,
    sourceSha: "a".repeat(40), declaredImage: CI_BROWSER_IMAGE, platform: "linux", arch: "x64", nodeMajor: 24, driverVersion: "1.63.0", browserVersion: "153.0.8010.12",
    cacheFiles: ["chromium", "chromium-headless-shell", "ffmpeg"].map((name, index) => ({
      name, revision: index < 2 ? "1243" : "1011", relativePath: index < 2 ? paths[index].slice("/ms-playwright/".length) : "ffmpeg-1011/ffmpeg-linux",
      version: index < 2 ? "153.0.8010.12" : null, bytes: 1000 + index, sha256: String(index + 1).repeat(64),
    })),
  };
}
const refuses = (work, code) => assert.rejects(work, error => error.code === code, code);
function fixture() {
  const calls = [], snapshots = [runtime(), runtime()]; let checks = 0;
  return { calls, snapshots, get checks() { return checks; }, ports: { runtime: async () => { calls.push("runtime"); return snapshots[checks++]; }, inspect: async path => { calls.push(path); return output(validText); } } };
}

test("binds exact Source/image/binary hashes before and after only the two fixed ldd inspections", async () => {
  const input = fixture(), report = await verifyCiBrowserLibraries(input.ports);
  assert.deepEqual(input.calls, ["runtime", ...paths, "runtime"]);
  assert.deepEqual(report, { schemaVersion: 1, scenario: "ci-browser-libraries", status: "BOUND", sourceBound: true, executables: 2, libraries: 4, runtimeChecks: 2, applicationAccepted: false });
  assert.ok(Object.isFrozen(report));
  assert.doesNotMatch(JSON.stringify(report), /libnss|libc\.so|ms-playwright|0x00007/u);
});

test("runtime refusal prevents every ldd call and exposes no underlying diagnostic", async () => {
  const input = fixture(); input.ports.runtime = async () => { throw Object.assign(new Error("PRIVATE_NATIVE_DIAGNOSTIC"), { code: "VERSION_REFUSED" }); };
  await refuses(() => verifyCiBrowserLibraries(input.ports), "RUNTIME_REFUSED");
  assert.deepEqual(input.calls, []);
});

test("foreign paths, versions or environments are refused even through test ports", async () => {
  for (const change of [snapshot => { snapshot.cacheFiles[0].relativePath = "../other/chrome"; }, snapshot => { snapshot.declaredImage += "-other"; },
    snapshot => { snapshot.platform = "win32"; }, snapshot => { snapshot.driverVersion = "1.64.0"; }, snapshot => { snapshot.cacheFiles[1].sha256 = "z".repeat(64); }]) {
    const input = fixture(); change(input.snapshots[0]);
    await refuses(() => verifyCiBrowserLibraries(input.ports), "RUNTIME_REFUSED");
    assert.deepEqual(input.calls, ["runtime"]);
  }
});

test("changed Source or executable bytes after ldd invalidate the result", async () => {
  for (const change of [snapshot => { snapshot.sourceSha = "b".repeat(40); }, snapshot => { snapshot.cacheFiles[0].sha256 = "4".repeat(64); }, snapshot => { snapshot.cacheFiles[1].bytes++; }]) {
    const input = fixture(); change(input.snapshots[1]);
    await refuses(() => verifyCiBrowserLibraries(input.ports), "SOURCE_CHANGED");
    assert.equal(input.checks, 2);
  }
});

test("exec wrapper pins executable, args, shell=false, bounded buffers/deadline and a minimal environment", async () => {
  let called = 0;
  for (const path of paths) await runCiBrowserLdd(path, (command, args, options, callback) => {
    called++; assert.equal(command, "/usr/bin/ldd"); assert.deepEqual(args, [path]);
    assert.deepEqual(options, { shell: false, encoding: "buffer", timeout: 10000, maxBuffer: 65536, killSignal: "SIGKILL", env: { PATH: "/usr/bin:/bin", HOME: "/tmp", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" } });
    callback(null, Buffer.from(validText), Buffer.alloc(0));
  });
  assert.equal(called, 2);
  for (const path of ["/usr/bin/chromium", paths[0] + ";echo", "/ms-playwright/ffmpeg-1011/ffmpeg-linux"]) {
    assert.throws(() => runCiBrowserLdd(path, () => { called++; }), { code: "COMMAND_REFUSED" });
  }
  assert.equal(called, 2);
});

test("nonzero exit, timeout or native execution error cannot be accepted or printed", async () => {
  for (const error of [Object.assign(new Error("PRIVATE_STDERR"), { code: 1 }), Object.assign(new Error("PRIVATE_TIMEOUT"), { killed: true }), new Error("ENOENT_PRIVATE")]) {
    await refuses(() => runCiBrowserLdd(paths[0], (_command, _args, _options, callback) => callback(error, Buffer.from(validText), Buffer.from("PRIVATE_STDERR"))), "LDD_COMMAND_REFUSED");
    assert.doesNotMatch(JSON.stringify(ciBrowserLibrariesFailure(error)), /PRIVATE/u);
  }
});

test("missing libraries fail closed even if every other loader and line is valid", () => {
  const text = validText.replace("libnss3.so => /lib/x86_64-linux-gnu/libnss3.so (0x00007f1234567000)", "libnss3.so => not found");
  assert.throws(() => inspectCiBrowserLdd(output(text)), { code: "MISSING_LIBRARY" });
});

test("stderr, malformed UTF-8, oversized/empty/ANSI output are rejected without raw diagnostics", () => {
  assert.throws(() => inspectCiBrowserLdd({ stdout: Buffer.from(validText), stderr: Buffer.from("PRIVATE_WARNING") }), { code: "LDD_STDERR_REFUSED" });
  for (const stdout of [Buffer.alloc(0), Buffer.alloc(65537), Buffer.from([0xc3, 0x28]), Buffer.from(validText.replace("libc.so", "\u001b[31mlibc.so")), Buffer.from(validText + "\n")]) {
    assert.throws(() => inspectCiBrowserLdd({ stdout, stderr: Buffer.alloc(0) }), { code: "LDD_OUTPUT_REFUSED" });
  }
});

test("static binaries, absent/foreign/duplicate loaders and unrelated formats cannot pass", () => {
  for (const text of ["\tstatically linked\n", "\tnot a dynamic executable\n", validText.replace("\t/lib64/ld-linux-x86-64.so.2 (0x00007f1234569000)\n", ""),
    validText.replace("/lib64/ld-linux-x86-64.so.2", "/tmp/ld-linux-x86-64.so.2"), validText + "\t/lib64/ld-linux-x86-64.so.2 (0x00007f1234569000)\n",
    validText.replace("libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6", "libc.so.6 => /lib/x86_64-linux-gnu/../libc.so.6")]) {
    assert.throws(() => inspectCiBrowserLdd(output(text)), error => ["LOADER_REFUSED", "LDD_OUTPUT_REFUSED"].includes(error.code));
  }
});

test("the valid explicit loader alias is accepted; repeated or invented library records are not", () => {
  const alias = validText.replace("/lib64/ld-linux-x86-64.so.2 (0x00007f1234569000)", "ld-linux-x86-64.so.2 => /usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2 (0x00007f1234569000)");
  assert.deepEqual(inspectCiBrowserLdd(output(alias)), { libraries: 2, loaders: 1, vdso: 1 });
  for (const text of [validText + "\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f1234568000)\n", validText.replace("libc.so.6 =>", "other.so.6 =>"), validText.replace("linux-vdso.so.1", "linux-gate.so.1")]) {
    assert.throws(() => inspectCiBrowserLdd(output(text)), error => ["LOADER_REFUSED", "LDD_OUTPUT_REFUSED"].includes(error.code));
  }
});

test("test ports and native records reject extra keys/accessors without invoking them", async () => {
  let calls = 0; const input = fixture();
  await refuses(() => verifyCiBrowserLibraries({ ...input.ports, command: "/tmp/custom" }), "PORTS_REFUSED");
  await refuses(() => verifyCiBrowserLibraries({ inspect: input.ports.inspect, get runtime() { calls++; return input.ports.runtime; } }), "PORTS_REFUSED");
  assert.throws(() => inspectCiBrowserLdd({ stderr: Buffer.alloc(0), get stdout() { calls++; return Buffer.from(validText); } }), { code: "LDD_OUTPUT_REFUSED" });
  assert.equal(calls, 0);
});

test("CLI has no operator flags and prints only the bounded report", async () => {
  const input = fixture(); let printed = "";
  await ciBrowserLibrariesCli([], { write: value => { printed += value; } }, input.ports);
  assert.equal(JSON.parse(printed).status, "BOUND");
  assert.doesNotMatch(printed, /ms-playwright|libnss|0x00007/u);
  for (const args of [["--help"], ["--path", paths[0]], ["--skip"], ""]) {
    await refuses(() => ciBrowserLibrariesCli(args, { write: () => assert.fail("must not print") }, input.ports), "USAGE_REFUSED");
  }
});

test("failure projection only copies known own enum codes, never getters or messages", () => {
  let invoked = false;
  const hostile = { message: "PRIVATE", get code() { invoked = true; return "MISSING_LIBRARY"; } };
  for (const error of [hostile, { code: "PRIVATE", stdout: validText }, null]) {
    assert.deepEqual(ciBrowserLibrariesFailure(error), { schemaVersion: 1, scenario: "ci-browser-libraries", status: "REFUSED", code: "RUNTIME_REFUSED", applicationAccepted: false });
  }
  assert.equal(invoked, false);
  assert.equal(ciBrowserLibrariesFailure({ code: "MISSING_LIBRARY", message: "PRIVATE" }).code, "MISSING_LIBRARY");
});
