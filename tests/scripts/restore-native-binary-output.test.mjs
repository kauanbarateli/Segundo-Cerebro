// All child/pipe events are RAM fixtures. No PowerShell, PostgreSQL or socket.
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { startNativeBinaryOutput, awaitNativeBinaryOutputReady, nativeBinaryOutputPath, nativeBinaryOutputCheck, finishNativeBinaryOutput, nativeBinaryOutputFacts, copyNativeBinaryOutput, discardNativeBinaryOutput, nativeBinaryOutputDiagnostic, main, NATIVE_BINARY_OUTPUT_HELPER, NATIVE_BINARY_OUTPUT_HELPER_SHA256, NATIVE_BINARY_OUTPUT_EXECUTABLE_PIN, NATIVE_BINARY_OUTPUT_LIMITS } from "../../scripts/operations/restore-native-binary-output.mjs";

const prefix = "RESTORE_NATIVE_BINARY_OUTPUT_", digest = value => createHash("sha256").update(value).digest("hex");
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); promise.catch(() => {}); return { promise, resolve, reject }; };
const rejects = (operation, code) => assert.rejects(operation, error => error.code === prefix + code && error.message === prefix + code);
const refuses = (operation, code) => assert.throws(operation, error => error.code === prefix + code && error.message === prefix + code);
const config = () => ({ systemRoot: "C:\\WINDOWS", powerShellExecutable: "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", helperSha256: NATIVE_BINARY_OUTPUT_HELPER_SHA256, environment: { SystemRoot: "C:\\WINDOWS", PATH: "C:\\WINDOWS\\System32" } });
const canary = Buffer.from("--\nCOPY public.synthetic FROM stdin;\nline\\r\\n\t\\N\n\\.\nPRIVATE_RAM_ONLY\r\n\0\xff", "latin1");

function fixture(options = {}) {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  const launched = deferred(), timeout = deferred(), calls = [], references = [];
  let expired = false, remaining = 45000, kills = 0, scopeClosed = 0;
  child.kill = () => { kills++; if (options.killFakesClose) child.emit("close", 0, null); return true; };
  const scope = {
    check() { if (expired) throw new Error("PRIVATE_SCOPE_CANARY"); },
    remaining() { if (expired) throw new Error("PRIVATE_SCOPE_CANARY"); return remaining; },
    race(promise) { return Promise.race([promise, timeout.promise]); },
    close() { scopeClosed++; },
  };
  const ports = {
    async attestExecutable(path) { calls.push({ kind: "attest", path }); if (options.attestation) return options.attestation(); return { ...NATIVE_BINARY_OUTPUT_EXECUTABLE_PIN }; },
    randomBytes(length) { calls.push({ kind: "random", length }); return options.random ?? Buffer.alloc(32, 19); },
    spawn(executable, args, settings) { calls.push({ kind: "spawn", executable, args, settings }); launched.resolve(); if (options.spawnThrow) throw options.spawnThrow; return child; },
  };
  const lease = startNativeBinaryOutput(config(), scope, ports);
  const send = (stream, value) => { const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value); references.push(bytes); child[stream].emit("data", bytes); return bytes; };
  return {
    lease, child, scope, ports, calls, references,
    async started() { await launched.promise; child.emit("spawn"); },
    async ready({ claim = true } = {}) { await this.started(); send("stderr", "SC_BINARY_PIPE_READY_V1\n"); await awaitNativeBinaryOutputReady(lease); return claim ? nativeBinaryOutputPath(lease) : null; },
    send,
    finishEvents(data = canary, changes = {}) {
      const value = Buffer.from(data), sha256 = changes.sha256 ?? digest(value), count = changes.count ?? value.length;
      if (!changes.noData) send("stdout", value);
      if (!changes.noComplete) send("stderr", `SC_BINARY_PIPE_COMPLETE_V1:${count}:${sha256}\n`);
      if (!changes.noStdoutEnd) child.stdout.emit("end");
      if (!changes.noStderrEnd) child.stderr.emit("end");
      if (!changes.noExit) child.emit("exit", changes.exit ?? 0, changes.signal ?? null);
      if (!changes.noClose) child.emit("close", changes.close ?? 0, changes.signal ?? null);
    },
    expire() { expired = true; timeout.reject(new Error("PRIVATE_SCOPE_CANARY")); },
    setRemaining(value) { remaining = value; },
    get kills() { return kills; }, get scopeClosed() { return scopeClosed; },
  };
}

test("import/help are inert with process/file/network ports forbidden", async () => {
  const original = { spawn: childProcess.spawn, readFile: fs.readFile, lstat: fs.lstat, realpath: fs.realpath, fetch: globalThis.fetch };
  let attempts = 0; const forbidden = () => { attempts++; throw new Error("NATIVE_FORBIDDEN"); };
  try {
    childProcess.spawn = forbidden; for (const key of ["readFile", "lstat", "realpath"]) fs[key] = forbidden;
    globalThis.fetch = forbidden; syncBuiltinESMExports();
    const inert = await import("../../scripts/operations/restore-native-binary-output.mjs?ram-inert"), output = [];
    assert.equal(inert.main(["--help"], value => output.push(value)), 0); assert.deepEqual(output, [{ operation: "native_binary_output", executed: false, code: "NO_SERVICE_STARTED" }]); assert.equal(attempts, 0);
  } finally { childProcess.spawn = original.spawn; for (const key of ["readFile", "lstat", "realpath"]) fs[key] = original[key]; globalThis.fetch = original.fetch; syncBuiltinESMExports(); }
});

test("the API-only CLI never offers execution", () => {
  const output = []; assert.equal(main(["--execute"], value => output.push(value)), 1); assert.equal(output[0].executed, false); assert.equal(output[0].code, "API_ONLY");
});

test("helper hash and constant security/binary primitives are fixed", () => {
  assert.equal(digest(NATIVE_BINARY_OUTPUT_HELPER), NATIVE_BINARY_OUTPUT_HELPER_SHA256);
  for (const text of ["[IO.Pipes.PipeSecurity]::new()", "$security.SetAccessRuleProtection($true,$false)", "$security.SetOwner($sid)", "'S-1-5-2'", "[Security.AccessControl.AccessControlType]::Deny", "[Security.AccessControl.AccessControlType]::Allow", "$rules.Count -ne 2", "$rule.IsInherited", "$rule.PipeAccessRights -ne [IO.Pipes.PipeAccessRights]::FullControl", "$seenAllow -ne 1 -or $seenDeny -ne 1", "[IO.Pipes.PipeDirection]::In,1,[IO.Pipes.PipeTransmissionMode]::Byte,[IO.Pipes.PipeOptions]::Asynchronous", "[IO.HandleInheritability]::None", "$pipe.GetAccessControl()", "[Console]::OpenStandardOutput()", "$output.WriteAsync($buffer,0,$count)", "$sha.TransformBlock", "$watch.ElapsedMilliseconds", "SC_BINARY_PIPE_COMPLETE_V1:"]) assert.equal(NATIVE_BINARY_OUTPUT_HELPER.includes(text), true, text);
  for (const text of ["Add-Type", "DllImport", "StreamWriter", "Write-Output", "Write-Host", "WriteAllBytes", "WriteAllText", "Set-Content", "_setmode", "ExecutionPolicy", "Get-Content", "WaitForConnectionAsync("]) assert.equal(NATIVE_BINARY_OUTPUT_HELPER.includes(text), false, text);
});

test("helper suppresses every non-payload task/method result from the PowerShell success pipeline", () => {
  const resultLines = NATIVE_BINARY_OUTPUT_HELPER.split("\n").map(line => line.trim()).filter(line => line.includes(".GetAwaiter().GetResult()"));
  assert.deepEqual(resultLines, ["[void]$sent.GetAwaiter().GetResult()", "$count=$read.GetAwaiter().GetResult()", "[void]$written.GetAwaiter().GetResult()"]);
  for (const expression of ["$security.SetAccessRuleProtection($true,$false)", "$security.SetOwner($sid)", "$security.AddAccessRule($deny)", "$security.AddAccessRule($allow)", "$pipe.EndWaitForConnection($connection)", "$waitHandle.Dispose()", "$output.Flush()", "$owned.Dispose()", "[Array]::Clear($message,0,$message.Length)", "[Array]::Clear($buffer,0,$buffer.Length)", "[Array]::Clear($digestBytes,0,$digestBytes.Length)"]) assert.equal(NATIVE_BINARY_OUTPUT_HELPER.includes("[void]" + expression), true, expression);
  assert.equal(NATIVE_BINARY_OUTPUT_HELPER.includes("[void](Send-Control 'SC_BINARY_PIPE_READY_V1')"), true);
  assert.equal(NATIVE_BINARY_OUTPUT_HELPER.includes("[void](Send-Control ('SC_BINARY_PIPE_COMPLETE_V1:"), true);
  assert.equal(NATIVE_BINARY_OUTPUT_HELPER.includes("[void](Send-Control 'SC_BINARY_PIPE_REFUSED_V1')"), true);
  for (const forbidden of [/\[Console\]::(?:Write|WriteLine|Out)/, /\b(?:Write-Output|Write-Host|Out-String|Format-Table|Format-List)\b/, /\bStreamWriter\b/]) assert.equal(forbidden.test(NATIVE_BINARY_OUTPUT_HELPER), false);
  assert.equal(NATIVE_BINARY_OUTPUT_HELPER.includes("$output=[Console]::OpenStandardOutput()"), true);
  assert.equal(NATIVE_BINARY_OUTPUT_HELPER.includes("$written=$output.WriteAsync($buffer,0,$count)"), true);
});

test("startup uses only the pinned PS5, fixed encoded helper and reduced environment", async () => {
  const f = fixture(); await f.ready(); const spawn = f.calls.find(c => c.kind === "spawn");
  assert.equal(spawn.executable, config().powerShellExecutable); assert.deepEqual(spawn.args.slice(0, 4), ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand"]); assert.equal(Buffer.from(spawn.args[4], "base64").toString("utf16le"), NATIVE_BINARY_OUTPUT_HELPER);
  assert.deepEqual(Object.keys(spawn.settings.env).sort(), ["PATH", "SC_BINARY_PIPE_BUDGET_MS", "SC_BINARY_PIPE_NAME", "SystemRoot"].sort());
  assert.match(spawn.settings.env.SC_BINARY_PIPE_NAME, /^sc-binary-v1-[a-f0-9]{64}$/); assert.equal(spawn.settings.env.SC_BINARY_PIPE_BUDGET_MS, "45000"); assert.deepEqual(spawn.settings.stdio, ["ignore", "pipe", "pipe"]); assert.equal(spawn.settings.shell, false); assert.equal(spawn.settings.windowsHide, true); discardNativeBinaryOutput(f.lease);
});

test("ready allows one private path but is not a completed receipt", async () => {
  const f = fixture(); refuses(() => nativeBinaryOutputPath(f.lease), "NOT_READY"); const path = await f.ready();
  assert.match(path, /^\\\\\.\\pipe\\sc-binary-v1-[a-f0-9]{64}$/); refuses(() => nativeBinaryOutputPath(f.lease), "PATH_CLAIMED"); refuses(() => nativeBinaryOutputFacts(f.lease), "REQUIRED");
  let settled = false; const pending = finishNativeBinaryOutput(f.lease); pending.then(() => { settled = true; }, () => { settled = true; }); await Promise.resolve(); await Promise.resolve(); assert.equal(settled, false); f.expire(); await rejects(() => pending, "TIMEOUT"); assert.equal(f.kills, 1); assert.equal(f.scopeClosed, 0);
});

test("the complete helper receipt preserves every byte and injected ports remain synthetic", async () => {
  const f = fixture(); await f.ready(); f.finishEvents(); const receipt = await finishNativeBinaryOutput(f.lease), facts = nativeBinaryOutputFacts(receipt), copy = copyNativeBinaryOutput(receipt);
  assert.deepEqual(Buffer.from(copy), canary); assert.equal(facts.transportMode, "synthetic"); assert.equal(facts.helperIntegrity, true); assert.equal(facts.helperStdoutEofObserved, true); assert.equal(facts.helperStderrEofObserved, true); assert.equal(facts.helperExit, "zero"); assert.equal(facts.helperClose, "zero"); assert.equal(facts.stdoutBytes, canary.length);
  assert.equal(JSON.stringify(facts).includes("PRIVATE_RAM_ONLY"), false); assert.equal(JSON.stringify(facts).includes("sc-binary"), false); assert.equal(Object.isFrozen(receipt), true); assert.equal(Object.getPrototypeOf(receipt), null); assert.equal(Reflect.ownKeys(receipt).length, 0); assert.equal(f.references.every(bytes => bytes.every(byte => byte === 0)), true);
  refuses(() => copyNativeBinaryOutput(receipt), "COPY_CLAIMED"); assert.equal(await finishNativeBinaryOutput(f.lease), receipt); discardNativeBinaryOutput(receipt); assert.equal(copy.every(byte => byte === 0), true); refuses(() => nativeBinaryOutputFacts(receipt), "DISCARDED"); assert.equal(f.kills, 0);
});

test("no individual helper terminal or ready/complete ACK substitutes the other original terminals", async () => {
  for (const missing of ["noStdoutEnd", "noStderrEnd", "noExit", "noComplete"]) {
    const f = fixture(); await f.ready(); f.finishEvents(canary, { [missing]: true }); await rejects(() => finishNativeBinaryOutput(f.lease), "PROTOCOL_REFUSED"); discardNativeBinaryOutput(f.lease);
  }
  const f = fixture(); await f.ready(); f.finishEvents(canary, { noClose: true }); const pending = finishNativeBinaryOutput(f.lease); f.expire(); await rejects(() => pending, "TIMEOUT");
});

test("wrong helper exit/close or signal refuses transport", async () => {
  for (const changes of [{ exit: 1 }, { close: 1 }, { signal: "SIGTERM" }]) { const f = fixture(); await f.ready(); f.finishEvents(canary, changes); await rejects(() => finishNativeBinaryOutput(f.lease), "TRANSPORT_FAILED"); }
});

test("byte count and digest independently reject silently truncated or corrupted output", async () => {
  for (const changes of [{ count: canary.length + 1 }, { sha256: "f".repeat(64) }]) { const f = fixture(); await f.ready(); f.finishEvents(canary, changes); await rejects(() => finishNativeBinaryOutput(f.lease), "INTEGRITY_FAILED"); }
});

test("the control grammar rejects unknown, duplicate, BOM, CRLF and partial metadata", async () => {
  for (const control of ["PRIVATE_PROVIDER_ERROR\n", "\ufeffSC_BINARY_PIPE_READY_V1\n", "SC_BINARY_PIPE_READY_V1\r\n", "SC_BINARY_PIPE_READY_V1\nSC_BINARY_PIPE_READY_V1\n", "SC_BINARY_PIPE_COMPLETE_V1:1:" + "f".repeat(64) + "\n"]) {
    const f = fixture(); await f.started(); f.send("stderr", control); await rejects(() => awaitNativeBinaryOutputReady(f.lease), "PROTOCOL_REFUSED");
  }
  const f = fixture(); await f.ready(); f.send("stderr", "SC_BINARY_PIPE_COMPLETE_V1:1:"); f.child.stderr.emit("end"); await rejects(() => finishNativeBinaryOutput(f.lease), "PROTOCOL_REFUSED");
});

test("fragmented metadata and independent stdout/stderr ordering retain raw bytes", async () => {
  const f = fixture(); await f.started(); for (const part of ["SC_BINARY_", "PIPE_READY", "_V1\n"]) f.send("stderr", part); await awaitNativeBinaryOutputReady(f.lease); nativeBinaryOutputPath(f.lease);
  const data = Buffer.from(canary), hash = digest(data); f.send("stderr", `SC_BINARY_PIPE_COMPLETE_V1:${data.length}:${hash}\n`);
  f.send("stdout", Buffer.from(data.subarray(0, 7))); f.send("stdout", Buffer.from(data.subarray(7))); f.child.stderr.emit("end"); f.child.stdout.emit("end"); f.child.emit("exit", 0, null); f.child.emit("close", 0, null);
  const receipt = await finishNativeBinaryOutput(f.lease), copy = copyNativeBinaryOutput(receipt); assert.deepEqual(Buffer.from(copy), data); discardNativeBinaryOutput(receipt);
});

test("stdout before original ready, data after EOF and empty output are refused", async () => {
  const early = fixture(); await early.started(); const raw = early.send("stdout", Buffer.from(canary)); await rejects(() => awaitNativeBinaryOutputReady(early.lease), "PROTOCOL_REFUSED"); assert.equal(raw.every(byte => byte === 0), true);
  const late = fixture(); await late.ready(); late.child.stdout.emit("end"); late.send("stdout", Buffer.from(canary)); await rejects(() => finishNativeBinaryOutput(late.lease), "PROTOCOL_REFUSED");
  const empty = fixture(); await empty.ready(); empty.send("stderr", "SC_BINARY_PIPE_COMPLETE_V1:0:" + digest(Buffer.alloc(0)) + "\n"); await rejects(() => finishNativeBinaryOutput(empty.lease), "PROTOCOL_REFUSED");
});

test("limits bound output and control metadata before retention", async () => {
  const f = fixture(); await f.ready(); const oversized = Buffer.alloc(NATIVE_BINARY_OUTPUT_LIMITS.stdoutBytes + 1, 65); f.send("stdout", oversized); await rejects(() => finishNativeBinaryOutput(f.lease), "OUTPUT_LIMIT"); assert.equal(oversized.every(byte => byte === 0), true);
  const g = fixture(); await g.started(); g.send("stderr", Buffer.alloc(1025, 65)); await rejects(() => awaitNativeBinaryOutputReady(g.lease), "OUTPUT_LIMIT");
});

test("late original helper errors veto retained receipts and zero returned copies", async () => {
  for (const channel of ["child", "stdout", "stderr"]) {
    const f = fixture(); await f.ready(); f.finishEvents(); const receipt = await finishNativeBinaryOutput(f.lease), copy = copyNativeBinaryOutput(receipt);
    (channel === "child" ? f.child : f.child[channel]).emit("error", new Error("PRIVATE_LATE_PROVIDER_CANARY"));
    refuses(() => nativeBinaryOutputCheck(f.lease), "TRANSPORT_FAILED"); refuses(() => nativeBinaryOutputFacts(receipt), "TRANSPORT_FAILED"); assert.equal(copy.every(byte => byte === 0), true);
  }
});

test("late duplicate end/process close/stream close events veto a retained receipt", async () => {
  for (const emit of [f => f.child.stdout.emit("end"), f => f.child.stderr.emit("end"), f => f.child.emit("close", 0, null), f => { f.child.stdout.emit("close"); f.child.stdout.emit("close"); }, f => { f.child.stderr.emit("close"); f.child.stderr.emit("close"); }]) {
    const f = fixture(); await f.ready(); f.finishEvents(); const receipt = await finishNativeBinaryOutput(f.lease); emit(f); refuses(() => nativeBinaryOutputFacts(receipt), "PROTOCOL_REFUSED");
  }
});

test("stream close without original EOF is not an EOF receipt", async () => {
  const f = fixture(); await f.ready(); f.child.stdout.emit("close"); await rejects(() => finishNativeBinaryOutput(f.lease), "TRANSPORT_FAILED");
});

test("discard is idempotent, wipes original late chunks and never converts kill into EOF", async () => {
  const f = fixture({ killFakesClose: true }); await f.ready(); discardNativeBinaryOutput(f.lease); discardNativeBinaryOutput(f.lease); assert.equal(f.kills, 1);
  const late = f.send("stdout", Buffer.from(canary)), meta = f.send("stderr", "SC_BINARY_PIPE_READY_V1\n"); assert.equal(late.every(byte => byte === 0), true); assert.equal(meta.every(byte => byte === 0), true); await rejects(() => finishNativeBinaryOutput(f.lease), "DISCARDED");
  discardNativeBinaryOutput({}); refuses(() => nativeBinaryOutputFacts({}), "REQUIRED");
});

test("cloned/proxied leases, receipts and caller metadata never acquire nominal authority", async () => {
  const f = fixture(); await f.ready(); f.finishEvents(); const receipt = await finishNativeBinaryOutput(f.lease);
  for (const clone of [{}, { ...receipt }, new Proxy(receipt, {}), { transportMode: "native" }]) refuses(() => nativeBinaryOutputFacts(clone), "REQUIRED");
  refuses(() => nativeBinaryOutputCheck(new Proxy(f.lease, {})), "REQUIRED"); assert.equal(nativeBinaryOutputDiagnostic({ code: prefix + "PROTOCOL_REFUSED" }), null); discardNativeBinaryOutput(receipt);
});

test("provider text/accessors/proxies are never inspected or forwarded on errors", async () => {
  let touches = 0; const poison = new Proxy({}, { get() { touches++; throw Error("PRIVATE_CANARY"); }, getPrototypeOf() { touches++; throw Error("PRIVATE_CANARY"); } });
  const f = fixture(); await f.ready(); f.child.emit("error", poison);
  let captured; try { await finishNativeBinaryOutput(f.lease); } catch (error) { captured = error; }
  assert.equal(captured.code, prefix + "TRANSPORT_FAILED"); assert.equal(touches, 0); const diagnostic = nativeBinaryOutputDiagnostic(captured); assert.equal(diagnostic.transportMode, "synthetic"); assert.equal(JSON.stringify(diagnostic).includes("PRIVATE_CANARY"), false); assert.equal(JSON.stringify(diagnostic).includes("sc-binary"), false);
});

test("byte proxies/shared stores are refused without invoking getters or overwriting unowned shared bytes", async () => {
  let touches = 0; const f = fixture(); await f.ready(); const proxy = new Proxy(Buffer.from("fixture"), { get() { touches++; throw Error("PRIVATE_CANARY"); } }); f.child.stdout.emit("data", proxy); await rejects(() => finishNativeBinaryOutput(f.lease), "PROTOCOL_REFUSED"); assert.equal(touches, 0);
  const shared = new Uint8Array(new SharedArrayBuffer(4)); shared.fill(77); const g = fixture(); await g.ready(); g.child.stdout.emit("data", shared); await rejects(() => finishNativeBinaryOutput(g.lease), "PROTOCOL_REFUSED"); assert.equal(shared.every(byte => byte === 77), true);
});

test("same inherited scope is checked before/after ready, completion and retained use without closing it", async () => {
  const f = fixture(); f.setRemaining(32123); await f.ready(); assert.equal(f.calls.find(c => c.kind === "spawn").settings.env.SC_BINARY_PIPE_BUDGET_MS, "32123"); f.finishEvents(); const receipt = await finishNativeBinaryOutput(f.lease), copy = copyNativeBinaryOutput(receipt); f.expire(); refuses(() => nativeBinaryOutputFacts(receipt), "TIMEOUT"); assert.equal(copy.every(byte => byte === 0), true); assert.equal(f.scopeClosed, 0);
});

test("discard before delayed attestation owns startup and prevents a late helper spawn", async () => {
  const attestation = deferred(), f = fixture({ attestation: () => attestation.promise }); discardNativeBinaryOutput(f.lease); attestation.resolve({ ...NATIVE_BINARY_OUTPUT_EXECUTABLE_PIN }); await Promise.resolve(); await Promise.resolve(); await rejects(() => awaitNativeBinaryOutputReady(f.lease), "DISCARDED"); assert.equal(f.calls.some(c => c.kind === "spawn"), false);
});

test("configuration rejects wider executables, helper sources and environments before process creation", () => {
  const scope = { check() {}, remaining() { return 45000; }, race(p) { return p; }, close() {} }, ports = { spawn() { throw Error("FORBIDDEN"); }, randomBytes() { throw Error("FORBIDDEN"); }, attestExecutable() { throw Error("FORBIDDEN"); } };
  for (const changed of [{ powerShellExecutable: "C:\\other.exe" }, { helperSha256: "f".repeat(64) }, { systemRoot: "relative" }]) refuses(() => startNativeBinaryOutput({ ...config(), ...changed }, scope, ports), "SOURCE_REFUSED");
  for (const key of ["PGPASSWORD", "SUPABASE_SECRET_KEY", "GH_TOKEN", "NODE_OPTIONS", "SC_BINARY_PIPE_NAME"]) refuses(() => startNativeBinaryOutput({ ...config(), environment: { ...config().environment, [key]: "PRIVATE_CANARY" } }, scope, ports), "INPUT_INVALID");
  let touches = 0; const accessor = config(); Object.defineProperty(accessor, "helperSha256", { enumerable: true, get() { touches++; return NATIVE_BINARY_OUTPUT_HELPER_SHA256; } }); refuses(() => startNativeBinaryOutput(accessor, scope, ports), "INPUT_INVALID"); assert.equal(touches, 0);
});

test("failed public executable pin produces a closed source refusal before spawn", async () => {
  const f = fixture({ attestation: () => ({ bytes: 1, sha256: "f".repeat(64) }) }); await rejects(() => awaitNativeBinaryOutputReady(f.lease), "SOURCE_REFUSED"); assert.equal(f.calls.some(c => c.kind === "spawn"), false);
});
