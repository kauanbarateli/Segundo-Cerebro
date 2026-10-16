import { spawn as nativeSpawn } from "node:child_process";
import { createHash, randomBytes as nativeRandomBytes } from "node:crypto";
import { readFile, lstat, realpath } from "node:fs/promises";
import { win32, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { types } from "node:util";
import { BackupError } from "./backup-format.mjs";

// Explicit API only. Import/help never reads an executable, environment or pipe.
const leases = new WeakMap(), receipts = new WeakMap(), errors = new WeakMap();
const Bytes = Uint8Array, typed = Object.getPrototypeOf(Bytes.prototype);
const lengthOf = Function.call.bind(Object.getOwnPropertyDescriptor(typed, "byteLength").get);
const backingOf = Function.call.bind(Object.getOwnPropertyDescriptor(typed, "buffer").get);
const setBytes = Function.call.bind(typed.set), fillBytes = Function.call.bind(typed.fill);
const hash = value => createHash("sha256").update(value).digest("hex");
const READY = "SC_BINARY_PIPE_READY_V1", REFUSED = "SC_BINARY_PIPE_REFUSED_V1";
export const NATIVE_BINARY_OUTPUT_LIMITS = Object.freeze({ timeoutMs: 45000, stdoutBytes: 20 * 1024 * 1024, stderrBytes: 1024, chunks: 4096, copies: 1 });
export const NATIVE_BINARY_OUTPUT_EXECUTABLE_PIN = Object.freeze({ bytes: 495616, sha256: "60c9b29843624dd8af6b6a7b26147753be6aeef65098b9a503cc50850afe410f" });
export const NATIVE_BINARY_OUTPUT_ERROR_CODES = Object.freeze(["INPUT_INVALID", "RUNTIME_REFUSED", "SOURCE_REFUSED", "SPAWN_FAILED", "HELPER_REFUSED", "PROTOCOL_REFUSED", "TRANSPORT_FAILED", "OUTPUT_LIMIT", "INTEGRITY_FAILED", "TIMEOUT", "NOT_READY", "PATH_CLAIMED", "REQUIRED", "COPY_CLAIMED", "DISCARDED"].map(suffix => "RESTORE_NATIVE_BINARY_OUTPUT_" + suffix));

// Framework 4.5 compatible: APM connect, Task ReadAsync/WriteAsync, no Add-Type,
// P/Invoke, inherited text stdout, SQL decoder, temporary SQL or new executable.
export const NATIVE_BINARY_OUTPUT_HELPER = `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$pipe=$null;$output=$null;$control=$null;$buffer=$null;$sha=$null;$waitHandle=$null;$digestBytes=$null;$exitCode=1
$watch=[Diagnostics.Stopwatch]::StartNew()
function Remaining {
 $remaining=$budget-$watch.ElapsedMilliseconds
 if($remaining -lt 1 -or $remaining -gt 45000){throw 'REFUSED'}
 return [int]$remaining
}
function Send-Control([string]$line){
 $message=[Text.Encoding]::ASCII.GetBytes($line+"\n")
 try{
  $sent=$control.WriteAsync($message,0,$message.Length)
  if(-not $sent.Wait((Remaining))){throw 'REFUSED'}
  [void]$sent.GetAwaiter().GetResult()
 }finally{[void][Array]::Clear($message,0,$message.Length)}
}
try{
 if($PSVersionTable.PSVersion.Major -ne 5 -or [Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'REFUSED'}
 $name=$env:SC_BINARY_PIPE_NAME
 $budgetText=$env:SC_BINARY_PIPE_BUDGET_MS
 if($name -cnotmatch '^sc-binary-v1-[a-f0-9]{64}$' -or $budgetText -cnotmatch '^[1-9][0-9]{0,4}$'){throw 'REFUSED'}
 $budget=[int]$budgetText
 if($budget -gt 45000){throw 'REFUSED'}
 $control=[Console]::OpenStandardError()
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $network=[Security.Principal.SecurityIdentifier]::new('S-1-5-2')
 $security=[IO.Pipes.PipeSecurity]::new()
 [void]$security.SetAccessRuleProtection($true,$false)
 [void]$security.SetOwner($sid)
 $deny=[IO.Pipes.PipeAccessRule]::new($network,[IO.Pipes.PipeAccessRights]::FullControl,[Security.AccessControl.AccessControlType]::Deny)
 $allow=[IO.Pipes.PipeAccessRule]::new($sid,[IO.Pipes.PipeAccessRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow)
 [void]$security.AddAccessRule($deny);[void]$security.AddAccessRule($allow)
 $pipe=[IO.Pipes.NamedPipeServerStream]::new($name,[IO.Pipes.PipeDirection]::In,1,[IO.Pipes.PipeTransmissionMode]::Byte,[IO.Pipes.PipeOptions]::Asynchronous,65536,0,$security,[IO.HandleInheritability]::None)
 $verified=$pipe.GetAccessControl()
 if(-not $verified.AreAccessRulesProtected -or $verified.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid.Value -or -not $pipe.IsAsync -or $pipe.TransmissionMode -ne [IO.Pipes.PipeTransmissionMode]::Byte){throw 'REFUSED'}
 $rules=@($verified.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if($rules.Count -ne 2){throw 'REFUSED'}
 $seenAllow=0;$seenDeny=0
 foreach($rule in $rules){
  if($rule.IsInherited -or $rule.PipeAccessRights -ne [IO.Pipes.PipeAccessRights]::FullControl){throw 'REFUSED'}
  $ruleSid=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
  if($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Deny -and $ruleSid -ceq 'S-1-5-2'){$seenDeny++}
  elseif($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and $ruleSid -ceq $sid.Value){$seenAllow++}
  else{throw 'REFUSED'}
 }
 if($seenAllow -ne 1 -or $seenDeny -ne 1){throw 'REFUSED'}
 $output=[Console]::OpenStandardOutput()
 $buffer=[byte[]]::new(65536);$sha=[Security.Cryptography.SHA256]::Create();$total=0L
 [void](Send-Control 'SC_BINARY_PIPE_READY_V1')
 $connection=$pipe.BeginWaitForConnection($null,$null)
 $waitHandle=$connection.AsyncWaitHandle
 if(-not $waitHandle.WaitOne((Remaining))){throw 'REFUSED'}
 [void]$pipe.EndWaitForConnection($connection)
 [void]$waitHandle.Dispose();$waitHandle=$null
 while($true){
  $read=$pipe.ReadAsync($buffer,0,$buffer.Length)
  if(-not $read.Wait((Remaining))){throw 'REFUSED'}
  $count=$read.GetAwaiter().GetResult()
  if($count -eq 0){break}
  if($count -lt 0 -or $total+$count -gt 20971520){throw 'REFUSED'}
  [void]$sha.TransformBlock($buffer,0,$count,$buffer,0)
  $written=$output.WriteAsync($buffer,0,$count)
  if(-not $written.Wait((Remaining))){throw 'REFUSED'}
  [void]$written.GetAwaiter().GetResult()
  $total+=$count
  [void][Array]::Clear($buffer,0,$buffer.Length)
 }
 if($total -lt 1){throw 'REFUSED'}
 [void]$sha.TransformFinalBlock([byte[]]::new(0),0,0)
 $digestBytes=$sha.Hash
 $digest=[BitConverter]::ToString($digestBytes).Replace('-','').ToLowerInvariant()
 [void](Remaining);[void]$output.Flush();[void](Remaining)
 [void](Send-Control ('SC_BINARY_PIPE_COMPLETE_V1:'+$total.ToString([Globalization.CultureInfo]::InvariantCulture)+':'+$digest))
 $exitCode=0
}catch{
 try{if($null -ne $control){[void](Send-Control 'SC_BINARY_PIPE_REFUSED_V1')}}catch{}
}finally{
 if($null -ne $buffer){[void][Array]::Clear($buffer,0,$buffer.Length)}
 if($null -ne $digestBytes){[void][Array]::Clear($digestBytes,0,$digestBytes.Length)}
 foreach($owned in @($waitHandle,$pipe,$sha,$output,$control)){if($null -ne $owned){try{[void]$owned.Dispose()}catch{$exitCode=1}}}
}
exit $exitCode
`;
export const NATIVE_BINARY_OUTPUT_HELPER_SHA256 = hash(NATIVE_BINARY_OUTPUT_HELPER);

function failure(suffix) { return new BackupError("RESTORE_NATIVE_BINARY_OUTPUT_" + suffix); }
const fail = suffix => { throw failure(suffix); };
function closed(value, keys) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail("INPUT_INVALID");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || Reflect.ownKeys(descriptors).some(key => !keys.includes(key))) fail("INPUT_INVALID");
  const result = {};
  for (const key of keys) { const d = descriptors[key]; if (!d?.enumerable || !Object.hasOwn(d, "value")) fail("INPUT_INVALID"); result[key] = d.value; }
  return result;
}
const safeWindowsPath = value => typeof value === "string" && win32.isAbsolute(value) && /^[A-Za-z]:\\/.test(value) && !/[\r\n\0~]/.test(value) && win32.normalize(value) === value;
function configuration(options) {
  const c = closed(options, ["systemRoot", "powerShellExecutable", "helperSha256", "environment"]);
  if (!safeWindowsPath(c.systemRoot) || !safeWindowsPath(c.powerShellExecutable) || c.powerShellExecutable.toLowerCase() !== win32.join(c.systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe").toLowerCase() || c.helperSha256 !== NATIVE_BINARY_OUTPUT_HELPER_SHA256) fail("SOURCE_REFUSED");
  const environment = c.environment;
  if (!environment || types.isProxy(environment) || Object.getPrototypeOf(environment) !== Object.prototype) fail("INPUT_INVALID");
  const env = {}, descriptors = Object.getOwnPropertyDescriptors(environment);
  for (const key of Reflect.ownKeys(descriptors)) {
    const d = descriptors[key];
    if (!["SystemRoot", "PATH", "TEMP", "TMP"].includes(key) || !d?.enumerable || !Object.hasOwn(d, "value") || typeof d.value !== "string" || d.value.length > 4096 || /[\r\n\0]/.test(d.value)) fail("INPUT_INVALID");
    if ((key === "TEMP" || key === "TMP") && !safeWindowsPath(d.value)) fail("INPUT_INVALID");
    env[key] = d.value;
  }
  if (typeof env.SystemRoot !== "string" || env.SystemRoot.toLowerCase() !== c.systemRoot.toLowerCase() || typeof env.PATH !== "string" || env.PATH.toLowerCase() !== win32.join(c.systemRoot, "System32").toLowerCase()) fail("INPUT_INVALID");
  c.environment = Object.freeze(env); return Object.freeze(c);
}
function inheritedScope(scope) {
  const methods = closed(scope, ["check", "remaining", "race", "close"]);
  if (Object.values(methods).some(value => typeof value !== "function")) fail("INPUT_INVALID");
  return {
    check() { Reflect.apply(methods.check, scope, []); },
    remaining() { const value = Reflect.apply(methods.remaining, scope, []); if (!Number.isSafeInteger(value) || value < 1 || value > NATIVE_BINARY_OUTPUT_LIMITS.timeoutMs) throw failure("TIMEOUT"); return value; },
    race(promise) { return Reflect.apply(methods.race, scope, [promise]); },
  };
}
function byteLength(value) {
  if (!value || types.isProxy(value) || !types.isUint8Array(value) || types.isSharedArrayBuffer(backingOf(value))) fail("PROTOCOL_REFUSED");
  try { new DataView(backingOf(value), 0, 0); return lengthOf(value); } catch { fail("PROTOCOL_REFUSED"); }
}
const wipe = value => { if (value) try { fillBytes(value, 0); } catch { /* Detached owned stores are outside the zeroing guarantee. */ } };
const wipeIncoming = value => { try { if (value && !types.isProxy(value) && types.isUint8Array(value) && !types.isSharedArrayBuffer(backingOf(value))) wipe(value); } catch { /* Refused/detached provider stores are not owned. */ } };
function latch(state, suffix) {
  if (state.first) return state.first;
  state.first = failure(suffix);
  errors.set(state.first, Object.freeze({ version: 1, transportMode: state.mode, phase: state.discarded ? "discarded" : state.finished ? "retained" : state.ready ? "collect" : "startup", readyObserved: state.ready, completeObserved: state.complete, helperSpawnObserved: state.spawned, helperStdoutEofObserved: state.stdoutEnd, helperStderrEofObserved: state.stderrEnd, helperExit: state.exited ? state.exitZero ? "zero" : "nonzero" : "not_observed", helperClose: state.closed ? state.closeZero ? "zero" : "nonzero" : "not_observed", stdoutBytes: state.total, stderrBytes: state.controlLength }));
  for (const chunk of state.chunks) wipe(chunk); state.chunks.length = 0;
  wipe(state.retained); for (const copy of state.copies) wipe(copy); wipe(state.control);
  state.readyDeferred.reject(state.first); state.doneDeferred.reject(state.first);
  if (state.child && !state.closed && !state.cancelRequested) { state.cancelRequested = true; try { state.child.kill("SIGKILL"); } catch { /* Cancellation request never proves closure. */ } }
  return state.first;
}
function guard(state) {
  if (state.first) throw state.first;
  try { state.scope.check(); state.scope.remaining(); } catch { throw latch(state, "TIMEOUT"); }
  if (state.first) throw state.first;
}
function deferred() { let resolvePromise, rejectPromise; const promise = new Promise((yes, no) => { resolvePromise = yes; rejectPromise = no; }); promise.catch(() => {}); return { promise, resolve: resolvePromise, reject: rejectPromise }; }
function leaseState(handle) { const state = leases.get(handle); if (!state) fail("REQUIRED"); return state; }
function receiptState(handle) { const state = receipts.get(handle); if (!state) fail("REQUIRED"); return state; }
function maybeDone(state) {
  if (state.first || !state.closed) return;
  if (!state.spawned || !state.ready || !state.pathClaimed || !state.complete || !state.stdoutEnd || !state.stderrEnd || !state.exited || !state.exitZero || !state.closeZero || state.lineStart !== state.controlLength || state.total < 1) { latch(state, "PROTOCOL_REFUSED"); return; }
  if (state.completeBytes !== state.total) { latch(state, "INTEGRITY_FAILED"); return; }
  state.doneDeferred.resolve();
}
function controlLine(state, line) {
  if (line === REFUSED) { latch(state, "HELPER_REFUSED"); return; }
  if (line === READY) {
    if (!state.spawned || state.ready || state.exited || state.closed) { latch(state, "PROTOCOL_REFUSED"); return; }
    state.ready = true; state.readyDeferred.resolve(); return;
  }
  const match = /^SC_BINARY_PIPE_COMPLETE_V1:([1-9][0-9]{0,7}):([a-f0-9]{64})$/.exec(line);
  if (!match || !state.ready || state.complete || Number(match[1]) > NATIVE_BINARY_OUTPUT_LIMITS.stdoutBytes) { latch(state, "PROTOCOL_REFUSED"); return; }
  state.complete = true; state.completeBytes = Number(match[1]); state.completeHash = match[2];
}
function attach(state, child) {
  state.child = child;
  if (!child || types.isProxy(child) || typeof child.on !== "function" || typeof child.kill !== "function" || !child.stdout || !child.stderr || typeof child.stdout.on !== "function" || typeof child.stderr.on !== "function") throw latch(state, "SPAWN_FAILED");
  const fault = suffix => latch(state, suffix);
  child.on("error", () => fault("TRANSPORT_FAILED"));
  child.on("spawn", () => { if (state.spawned || state.exited || state.closed) fault("PROTOCOL_REFUSED"); else state.spawned = true; });
  child.on("exit", (code, signal) => { if (state.exited || state.closed || !state.spawned) { fault("PROTOCOL_REFUSED"); return; } state.exited = true; state.exitZero = code === 0 && signal === null; if (!state.exitZero) fault("TRANSPORT_FAILED"); });
  child.on("close", (code, signal) => { if (state.closed || !state.exited) { fault("PROTOCOL_REFUSED"); return; } state.closed = true; state.closeZero = code === 0 && signal === null; if (!state.closeZero) fault("TRANSPORT_FAILED"); maybeDone(state); });
  child.stdout.on("error", () => fault("TRANSPORT_FAILED")); child.stderr.on("error", () => fault("TRANSPORT_FAILED"));
  child.stdout.on("close", () => { if (state.stdoutClose) fault("PROTOCOL_REFUSED"); else { state.stdoutClose = true; if (!state.stdoutEnd) fault("TRANSPORT_FAILED"); } });
  child.stderr.on("close", () => { if (state.stderrClose) fault("PROTOCOL_REFUSED"); else { state.stderrClose = true; if (!state.stderrEnd) fault("TRANSPORT_FAILED"); } });
  child.stdout.on("end", () => { if (state.stdoutEnd || !state.spawned) { fault("PROTOCOL_REFUSED"); return; } state.stdoutEnd = true; });
  child.stderr.on("end", () => { if (state.stderrEnd || !state.spawned) { fault("PROTOCOL_REFUSED"); return; } state.stderrEnd = true; if (state.lineStart !== state.controlLength) fault("PROTOCOL_REFUSED"); });
  child.stdout.on("data", chunk => {
    try {
      if (state.first) return;
      guard(state); if (!state.ready || state.stdoutEnd || state.closed) throw failure("PROTOCOL_REFUSED");
      const length = byteLength(chunk); if (!length || state.total + length > NATIVE_BINARY_OUTPUT_LIMITS.stdoutBytes || state.chunks.length >= NATIVE_BINARY_OUTPUT_LIMITS.chunks) { fault("OUTPUT_LIMIT"); return; }
      const copy = new Bytes(length); setBytes(copy, chunk); state.chunks.push(copy); state.total += length;
    } catch { fault("PROTOCOL_REFUSED"); }
    finally { wipeIncoming(chunk); }
  });
  child.stderr.on("data", chunk => {
    try {
      if (state.first) return;
      guard(state); if (state.stderrEnd || state.closed) throw failure("PROTOCOL_REFUSED");
      const length = byteLength(chunk); if (!length || state.controlLength + length > NATIVE_BINARY_OUTPUT_LIMITS.stderrBytes) { fault("OUTPUT_LIMIT"); return; }
      setBytes(state.control, chunk, state.controlLength); const end = state.controlLength + length; state.controlLength = end;
      for (; state.scanned < end; state.scanned++) {
        const byte = state.control[state.scanned];
        if (byte === 10) { const line = Buffer.from(state.control.slice(state.lineStart, state.scanned)).toString("ascii"); state.lineStart = state.scanned + 1; controlLine(state, line); if (state.first) return; }
        else if (!(byte >= 48 && byte <= 57 || byte >= 65 && byte <= 90 || byte >= 97 && byte <= 102 || byte === 95 || byte === 58)) { fault("PROTOCOL_REFUSED"); return; }
      }
    } catch { fault("PROTOCOL_REFUSED"); }
    finally { wipeIncoming(chunk); }
  });
}
async function attestExecutable(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || (await realpath(path)).toLowerCase() !== path.toLowerCase() || info.size !== NATIVE_BINARY_OUTPUT_EXECUTABLE_PIN.bytes) fail("SOURCE_REFUSED");
  const value = await readFile(path);
  try { return { bytes: value.length, sha256: hash(value) }; } finally { wipe(value); }
}

/** A lease exists before asynchronous executable checks/startup, so discard owns late work. */
export function startNativeBinaryOutput(options, scope, injectedPorts) {
  const config = configuration(options), inherited = inheritedScope(scope), synthetic = injectedPorts !== undefined;
  if (!synthetic && (process.platform !== "win32" || process.arch !== "x64" || process.version !== "v24.19.0")) fail("RUNTIME_REFUSED");
  const ports = synthetic ? closed(injectedPorts, ["spawn", "randomBytes", "attestExecutable"]) : { spawn: nativeSpawn, randomBytes: nativeRandomBytes, attestExecutable };
  if (Object.values(ports).some(value => typeof value !== "function")) fail("INPUT_INVALID");
  const state = { mode: synthetic ? "synthetic" : "native", scope: inherited, first: null, child: null, discarded: false, cancelRequested: false, spawned: false, ready: false, pathClaimed: false, complete: false, completeBytes: null, completeHash: null, stdoutEnd: false, stderrEnd: false, stdoutClose: false, stderrClose: false, exited: false, exitZero: false, closed: false, closeZero: false, finished: false, total: 0, chunks: [], retained: null, copies: new Set(), control: new Bytes(NATIVE_BINARY_OUTPUT_LIMITS.stderrBytes), controlLength: 0, scanned: 0, lineStart: 0, readyDeferred: deferred(), doneDeferred: deferred(), pipePath: null, receipt: null };
  const lease = Object.freeze(Object.create(null)); leases.set(lease, state);
  void (async () => {
    try {
      guard(state);
      let pin;
      try { pin = closed(await inherited.race(Promise.resolve().then(() => ports.attestExecutable(config.powerShellExecutable))), ["bytes", "sha256"]); }
      catch { guard(state); throw latch(state, "SOURCE_REFUSED"); }
      guard(state); if (pin.bytes !== NATIVE_BINARY_OUTPUT_EXECUTABLE_PIN.bytes || pin.sha256 !== NATIVE_BINARY_OUTPUT_EXECUTABLE_PIN.sha256) throw latch(state, "SOURCE_REFUSED");
      let name;
      try { const random = ports.randomBytes(32); if (byteLength(random) !== 32) throw failure("SOURCE_REFUSED"); const copy = new Bytes(32); setBytes(copy, random); name = "sc-binary-v1-" + Buffer.from(copy).toString("hex"); wipe(copy); }
      catch { guard(state); throw latch(state, "SOURCE_REFUSED"); }
      state.pipePath = "\\\\.\\pipe\\" + name;
      guard(state);
      const env = { ...config.environment, SC_BINARY_PIPE_NAME: name, SC_BINARY_PIPE_BUDGET_MS: String(inherited.remaining()) };
      attach(state, ports.spawn(config.powerShellExecutable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(NATIVE_BINARY_OUTPUT_HELPER, "utf16le").toString("base64")], { env, stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true }));
      guard(state);
    } catch { if (!state.first) latch(state, "SPAWN_FAILED"); }
  })();
  return lease;
}
export function nativeBinaryOutputCheck(lease) { guard(leaseState(lease)); }
export async function awaitNativeBinaryOutputReady(lease) {
  const state = leaseState(lease); guard(state);
  try { await state.scope.race(state.readyDeferred.promise); } catch { if (!state.first) latch(state, "TIMEOUT"); }
  guard(state); if (!state.ready || state.exited || state.closed) throw latch(state, "NOT_READY"); return lease;
}
export function nativeBinaryOutputPath(lease) {
  const state = leaseState(lease); guard(state);
  if (!state.ready || state.exited || state.closed) fail("NOT_READY");
  if (state.pathClaimed) fail("PATH_CLAIMED"); state.pathClaimed = true; return state.pipePath;
}
export async function finishNativeBinaryOutput(lease) {
  const state = leaseState(lease); guard(state);
  try { await state.scope.race(state.doneDeferred.promise); } catch { if (!state.first) latch(state, "TIMEOUT"); }
  guard(state); maybeDone(state); guard(state);
  if (!state.retained) {
    const retained = new Bytes(state.total); let at = 0;
    for (const chunk of state.chunks) { setBytes(retained, chunk, at); at += lengthOf(chunk); wipe(chunk); }
    state.chunks.length = 0; state.retained = retained;
    if (at !== state.completeBytes || hash(retained) !== state.completeHash) throw latch(state, "INTEGRITY_FAILED");
    state.finished = true;
  }
  guard(state);
  if (!state.receipt) { state.receipt = Object.freeze(Object.create(null)); receipts.set(state.receipt, state); }
  return state.receipt;
}
export function nativeBinaryOutputFacts(receipt) {
  const state = receiptState(receipt); guard(state);
  if (!state.finished) fail("REQUIRED");
  return Object.freeze({ version: 1, transportMode: state.mode, stdoutBytes: state.total, stderrBytes: state.controlLength, readyObserved: true, completeObserved: true, helperSpawnObserved: true, helperStdoutEofObserved: true, helperStderrEofObserved: true, helperExit: "zero", helperClose: "zero", helperIntegrity: true });
}
export function copyNativeBinaryOutput(receipt) {
  const state = receiptState(receipt); guard(state);
  if (!state.finished || !state.retained) fail("REQUIRED");
  if (state.copies.size >= NATIVE_BINARY_OUTPUT_LIMITS.copies) fail("COPY_CLAIMED");
  const copy = new Bytes(state.total); setBytes(copy, state.retained); state.copies.add(copy); return copy;
}
export function discardNativeBinaryOutput(handle) {
  const state = leases.get(handle) ?? receipts.get(handle); if (!state || state.discarded) return;
  state.discarded = true; latch(state, "DISCARDED");
}
/** Nominal first-refusal metadata; never provider message/cause, pipe name or SQL. */
export function nativeBinaryOutputDiagnostic(error) { return errors.get(error) ?? null; }
export function main(argv = process.argv.slice(2), output = value => process.stdout.write(JSON.stringify(value) + "\n")) { const help = Array.isArray(argv) && argv.length === 1 && argv[0] === "--help"; output({ operation: "native_binary_output", executed: false, code: help ? "NO_SERVICE_STARTED" : "API_ONLY" }); return help ? 0 : 1; }
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = main();
