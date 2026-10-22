import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, constants } from "node:fs";
import { chmod, copyFile, lstat, mkdtemp, realpath, rmdir, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, win32 } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { types } from "node:util";
import { BackupError, readBackup } from "./backup-format.mjs";
import { encryptionSettings, PERSONAL_REF, safeBackupDirectory } from "./backup-config.mjs";
import { restoreConfiguration } from "./restore-target.mjs";
import { diagnosticInventory, managedTocPlanDiagnostic, managedTocUnsupportedDiagnostic, planManagedRestore, planManagedTargetBaseline, planManagedTargetInspection, managedTargetInspectionRequirements } from "./restore-managed-plan.mjs";
import { observeCustomArchiveHeader, CUSTOM_HEADER_ERROR_CODES } from "./restore-custom-header.mjs";
import { extractCustomArchiveToc, extractCustomTargetToc, customArchiveTocFacts, discardCustomArchiveToc, extractCustomTargetInspectionToc, customTargetInspectionTocFacts, discardCustomTargetInspectionToc, CUSTOM_TOC_ERROR_CODES } from "./restore-custom-toc.mjs";
import { migrationHistoryFacts, inspectionMigrationHistoryFacts } from "./restore-migration-history.mjs";
import { readNativeMigrationHistory, nativeMigrationHistoryFacts, nativeMigrationHistoryDiagnostic, discardNativeMigrationHistory, readNativeInspectionMigrationHistory, nativeInspectionMigrationHistoryFacts, discardNativeInspectionMigrationHistory, NATIVE_HISTORY_ERROR_CODES } from "./restore-migration-history-native.mjs";
import { readNativeTargetSnapshot, nativeTargetSnapshotFacts, copyNativeTargetSnapshot, discardNativeTargetSnapshot, nativeTargetSnapshotDiagnostic, TARGET_SNAPSHOT_NATIVE_ERROR_CODES } from "./restore-target-snapshot-native.mjs";
import { observeInspectedManagedBaseline, INSPECTED_BASELINE_ERROR_CODES } from "./restore-inspected-baseline.mjs";

export const INSPECTION_LIMITS = Object.freeze({ timeoutMs: 45000, aclTimeoutMs: 15000, databaseBytes: 64 * 1024 * 1024, archiveBytes: 1024 * 1024 * 1024, tocBytes: 4 * 1024 * 1024, aclBytes: 1024 });
// Fixed helper secures ONLY the new exclusive empty owned directory. The
// ciphertext file is verify-only; no parent/source ACL or caller SID is changed.
// Only that owned path goes through env; no SQL/PG values/encryption key does.
export const PRIVATE_PATH_ACL_SCRIPT = String.raw`$ErrorActionPreference='Stop'
try {
 $kind=$env:SC_INSPECT_ACL_KIND
 if($kind -notin @('directory','file')){throw 'REFUSED'}
 $candidate=Get-Item -LiteralPath $env:SC_INSPECT_ACL_PATH -Force
 if(($kind -eq 'directory') -ne $candidate.PSIsContainer){throw 'REFUSED'}
 if(-not $candidate.FullName.Equals([IO.Path]::GetFullPath($env:SC_INSPECT_ACL_PATH),[StringComparison]::OrdinalIgnoreCase)){throw 'REFUSED'}
 $ancestor=$candidate
 while($ancestor){if(($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'REFUSED'};if($ancestor -is [IO.FileInfo]){$ancestor=$ancestor.Directory}else{$ancestor=$ancestor.Parent}}
 $currentSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $acl=Get-Acl -LiteralPath $candidate.FullName
 if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $currentSid.Value){throw 'REFUSED'}
 if($kind -eq 'directory'){
  $entries=[IO.Directory]::EnumerateFileSystemEntries($candidate.FullName).GetEnumerator()
  try{if($entries.MoveNext()){throw 'REFUSED'}}finally{$entries.Dispose()}
  $protected=[Security.AccessControl.DirectorySecurity]::new()
  $protected.SetAccessRuleProtection($true,$false)
  $protected.SetOwner($currentSid)
  $rule=[Security.AccessControl.FileSystemAccessRule]::new($currentSid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
  $protected.AddAccessRule($rule)
  Set-Acl -LiteralPath $candidate.FullName -AclObject $protected
 }
 $verified=Get-Acl -LiteralPath $candidate.FullName
 if($verified.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $currentSid.Value){throw 'REFUSED'}
 $rules=@($verified.Access)
 if($rules.Count -ne 1 -or $rules[0].AccessControlType -ne 'Allow' -or $rules[0].IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -ne $currentSid.Value -or ($rules[0].FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl){throw 'REFUSED'}
 if($kind -eq 'directory' -and (-not $verified.AreAccessRulesProtected -or $rules[0].InheritanceFlags -ne ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit) -or $rules[0].PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None)){throw 'REFUSED'}
 [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
 Write-Output '{"private":true}'
} catch { Write-Output '{"private":false}';exit 1 }`;
const fail = code => { throw new BackupError(code); };
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino && a.birthtimeMs === b.birthtimeMs;
const discard = () => {};
const stoppedChildren = new WeakSet();
const inspectionFailures = new WeakMap();
const targetInspectionFailures = new WeakMap();
const combinedInspectionFailures = new WeakMap();
const sourceTocObservers = new WeakMap();
const sourceTocOwners = new WeakMap();
const sourceTocFailures = new WeakMap();
const errorCodes = new Set(["INVALID_ARGUMENTS", "BACKUP_KEY_REQUIRED", "BACKUP_KEY_MUST_BE_INDEPENDENT", "ISOLATED_RESTORE_TARGET_REQUIRED", "ISOLATED_STORAGE_CONFIGURATION_REQUIRED", "RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED", "PERSONAL_POSTGRES_CONFIGURATION_REQUIRED", "UNSAFE_BACKUP_DESTINATION", "BACKUP_IDENTITY_MISMATCH", "BACKUP_AUTHENTICATION_FAILED", "INVALID_BACKUP", "INVALID_HEADER", "INVALID_FRAME", "INVALID_ORDER", "INVALID_ENTRY", "ENTRY_HASH_MISMATCH", "MANIFEST_MISMATCH", "TRAILING_DATA", "TRUNCATED_BACKUP", "MISSING_MANIFEST", "INCOMPLETE_BACKUP", "INSPECTION_PATH_REFUSED", "INSPECTION_PRIVATE_PATH_REFUSED", "INSPECTION_TIMEOUT", "INSPECTION_LIMIT", "INSPECTION_NATIVE_FAILED", "INSPECTION_NATIVE_UNAVAILABLE", "INSPECTION_INPUT_FAILED", "INSPECTION_TOC_INVALID", "INSPECTION_SNAPSHOT_CHANGED", "INSPECTION_CLEANUP_FAILED", "RESTORE_MANAGED_DATABASE_INVALID", "RESTORE_MANAGED_BINDING_INVALID", "RESTORE_TOC_INVALID", "RESTORE_TOC_UNSUPPORTED", "RESTORE_TOC_DEPENDENCY_INVALID", "RESTORE_MANAGED_CUSTOM_INVALID"]);
function closedError(error) {
  try { const value = Object.getOwnPropertyDescriptor(error, "code"); if (error instanceof BackupError && value && Object.hasOwn(value, "value") && (errorCodes.has(value.value) || CUSTOM_HEADER_ERROR_CODES.includes(value.value) || CUSTOM_TOC_ERROR_CODES.includes(value.value) || NATIVE_HISTORY_ERROR_CODES.includes(value.value) || TARGET_SNAPSHOT_NATIVE_ERROR_CODES.includes(value.value) || INSPECTED_BASELINE_ERROR_CODES.includes(value.value))) return value.value; } catch { /* Never read provider text/getters. */ }
  return "INSPECTION_UNAVAILABLE";
}
for (const code of ["RESTORE_MANAGED_TARGET_BINDING_INVALID", "RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED", "RESTORE_MANAGED_TARGET_BASELINE_INVALID", "RESTORE_MANAGED_TARGET_INSPECTION_REQUIRED", "RESTORE_MANAGED_TARGET_INSPECTION_UNSUPPORTED"]) errorCodes.add(code);
// Passive facts from the ORIGINAL SourceTOC child only. No observer fact is
// consumed by a qualifier, deadline, first-failure latch or cleanup decision.
function sourceTocObserver() {
  let sequence = 0, overflow = false, sealed = false, firstError = null, lastError = null, firstRefusal = null, finalCleanup = null;
  const events = Object.fromEntries(["spawnRequested", "spawn", "spawnThrow", "stdinEndRequested", "stdinCallback", "stdinFinish", "stdinError", "stdinEndThrow", "childError", "stdoutError", "stderrError", "stdoutEOF", "stdoutClose", "stderrEOF", "stderrClose", "exit", "close", "stdinDestroyRequested", "stdoutDestroyRequested", "stderrDestroyRequested", "killRequested", "unrefRequested"].map(name => [name, null]));
  const codeOf = error => {
    try {
      if (!error || (typeof error !== "object" && typeof error !== "function") || types.isProxy(error)) return "unavailable";
      const descriptor = Object.getOwnPropertyDescriptor(error, "code");
      if (!descriptor || !Object.hasOwn(descriptor, "value") || typeof descriptor.value !== "string") return "unavailable";
      return ["EPIPE", "ERR_STREAM_DESTROYED", "EOF"].includes(descriptor.value) ? descriptor.value : "other";
    } catch { return "unavailable"; }
  };
  const next = () => { if (sequence < 64) return ++sequence; overflow = true; return 64; };
  const snapshot = () => Object.freeze({ sequence, overflow, firstError, lastError, events: Object.freeze({ ...events }) });
  const record = (name, extra = null) => {
    if (sealed || !Object.hasOwn(events, name)) return;
    const observed = Object.freeze({ sequence: next(), ...extra });
    events[name] ??= observed;
    return observed;
  };
  const error = (name, value) => {
    if (sealed) return;
    const code = codeOf(value), observed = record(name, { code });
    if (observed) { lastError = Object.freeze({ origin: name, code, sequence: observed.sequence }); firstError ??= lastError; }
  };
  const refuse = code => { if (!sealed && !firstRefusal) firstRefusal = Object.freeze({ code, state: snapshot() }); };
  return Object.freeze({
    event: name => { record(name); },
    error,
    callback: value => { if (sealed) return; const code = value ? codeOf(value) : "none", observed = record("stdinCallback", { outcome: value ? "error" : "ok", code }); if (value && observed) { lastError = Object.freeze({ origin: "stdinCallback", code, sequence: observed.sequence }); firstError ??= lastError; } },
    terminal: (name, code, signal) => { record(name, { code: typeof code === "number" && Number.isInteger(code) ? code === 0 ? "zero" : "nonzero" : "unavailable", signal: signal === null || signal === undefined ? "none" : ["SIGKILL", "SIGTERM", "SIGINT"].includes(signal) ? signal : "other" }); },
    refuse,
    refusedError: value => {
      // Only our exact nominal error may supply an authoritative refusal code.
      // Provider proxies/prototypes are not traversed for passive metadata.
      let code = "INSPECTION_UNAVAILABLE";
      try { if (value && typeof value === "object" && !types.isProxy(value) && Object.getPrototypeOf(value) === BackupError.prototype) code = closedError(value); } catch { /* Closed absence only. */ }
      refuse(code);
    },
    finalize: () => { if (!sealed) { finalCleanup = snapshot(); sealed = true; } },
    facts: () => Object.freeze({ version: 1, observer: "source_toc_original", firstRefusal, finalCleanup }),
  });
}
function stop(child) {
  if (!child || typeof child !== "object" || stoppedChildren.has(child)) return;
  stoppedChildren.add(child);
  const observer = sourceTocObservers.get(child);
  for (const [name, stream] of [["stdin", child?.stdin], ["stdout", child?.stdout], ["stderr", child?.stderr]]) try { observer?.event(name + "DestroyRequested"); stream?.destroy?.(); } catch { /* Cancellation is only a local request. */ }
  try { observer?.event("killRequested"); child?.kill?.("SIGKILL"); } catch { /* No process termination is inferred. */ }
  try { observer?.event("unrefRequested"); child?.unref?.(); } catch { /* First failure remains authoritative. */ }
}
function context(timeoutMs, originalFailure = () => null) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > INSPECTION_LIMITS.timeoutMs) fail("INVALID_ARGUMENTS");
  const deadline = performance.now() + timeoutMs; let expired = false, timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(new BackupError("INSPECTION_TIMEOUT")); }, timeoutMs); }); timeout.catch(discard);
  return { check() { const failure = originalFailure(); if (failure) throw failure; if (expired || performance.now() >= deadline) fail("INSPECTION_TIMEOUT"); }, remaining() { this.check(); return Math.max(1, Math.ceil(deadline - performance.now())); }, race(value) { return Promise.race([value, timeout]); }, close() { clearTimeout(timer); expired = true; } };
}
function osEnvironment(env) {
  const selected = {};
  for (const name of ["PATH", "SystemRoot", "TEMP", "TMP"]) if (typeof env[name] === "string") selected[name] = env[name];
  return selected;
}
async function ancestorInfo(path, stat = lstat) {
  let ancestor = resolve(path), result;
  while (true) {
    const info = await stat(ancestor);
    if (info.isSymbolicLink()) fail("INSPECTION_PATH_REFUSED");
    result ??= info;
    const parent = resolve(ancestor, ".."); if (parent === ancestor) break; ancestor = parent;
  }
  return result;
}
async function regularPath(path, directory = false) {
  if (!isAbsolute(path) || path.startsWith("\\\\") || path.includes("~")) fail("INSPECTION_PATH_REFUSED");
  const result = await ancestorInfo(path);
  if (directory ? !result.isDirectory() : !result.isFile()) fail("INSPECTION_PATH_REFUSED");
  return result;
}
/** Only the DEFAULT OS temp may be an 8.3 alias. Inspect every original
 * ancestor BEFORE realpath, then every canonical ancestor and directory ID.
 * No explicit archive/temporaryRoot path is passed through this exception.
 * Function seams below are for RAM filesystem controls; import stays inert. */
export async function defaultInspectionTemporaryRoot(dependencies = {}) {
  const source = (dependencies.tmpdir ?? tmpdir)(), stat = dependencies.lstat ?? lstat;
  if (typeof source !== "string" || !isAbsolute(source) || source.startsWith("\\\\")) fail("INSPECTION_PATH_REFUSED");
  const original = await ancestorInfo(source, stat);
  if (!original.isDirectory()) fail("INSPECTION_PATH_REFUSED");
  const canonical = await (dependencies.realpath ?? realpath)(source);
  if (typeof canonical !== "string" || !isAbsolute(canonical) || canonical.startsWith("\\\\") || canonical.includes("~")) fail("INSPECTION_PATH_REFUSED");
  const resolved = await ancestorInfo(canonical, stat);
  if (!resolved.isDirectory() || !sameFile(original, resolved)) fail("INSPECTION_SNAPSHOT_CHANGED");
  return canonical;
}
/** Native stdout must end AND child must close0. exit0/pipe close alone never
 * qualify. The input EPIPE exception applies ONLY to this TOC-only command,
 * after the whole source was authenticated; no SQL producer is involved. */
async function collectNative(child, scope, limit, database = null, originalRefusal = discard, observer = null) {
  const chunks = []; let bytes = 0, ended = false, inputError = null, successful = false;
  let rejectFailure, resolveClose;
  const failed = new Promise((_, reject) => { rejectFailure = reject; }); failed.catch(discard);
  const closed = new Promise(resolve => { resolveClose = resolve; });
  const refuse = code => { const error = new BackupError(code); observer?.refuse(code); originalRefusal(error); rejectFailure(error); };
  let timer;
  try {
    if (!child || typeof child.on !== "function" || !child.stdout?.[Symbol.asyncIterator]) fail("INSPECTION_NATIVE_UNAVAILABLE");
    child.on("error", error => { observer?.error("childError", error); refuse("INSPECTION_NATIVE_UNAVAILABLE"); });
    child.on("exit", (code, signal) => { observer?.terminal("exit", code, signal); if (code !== 0) refuse("INSPECTION_NATIVE_FAILED"); });
    child.on("close", (code, signal) => { observer?.terminal("close", code, signal); if (code !== 0) refuse("INSPECTION_NATIVE_FAILED"); resolveClose(code); });
    child.stdout.on("error", error => { observer?.error("stdoutError", error); refuse("INSPECTION_NATIVE_FAILED"); });
    child.stdout.on("end", () => { observer?.event("stdoutEOF"); ended = true; });
    child.stdout.on("close", () => { observer?.event("stdoutClose"); if (!ended) refuse("INSPECTION_NATIVE_FAILED"); });
    child.stderr?.on("error", error => { observer?.error("stderrError", error); refuse("INSPECTION_NATIVE_FAILED"); });
    if (observer) { child.stderr?.on("end", () => observer.event("stderrEOF")); child.stderr?.on("close", () => observer.event("stderrClose")); }
    child.stderr?.resume();
    if (database) {
      if (!child.stdin?.end) fail("INSPECTION_NATIVE_UNAVAILABLE");
      child.stdin.on("error", error => { observer?.error("stdinError", error); inputError = error?.code; if (inputError !== "EPIPE") refuse("INSPECTION_INPUT_FAILED"); });
      if (observer) child.stdin.on("finish", () => observer.event("stdinFinish"));
      observer?.event("stdinEndRequested");
      try { child.stdin.end(database, error => { observer?.callback(error); if (error) { inputError = error.code; if (inputError !== "EPIPE") refuse("INSPECTION_INPUT_FAILED"); } }); }
      catch (error) { observer?.error("stdinEndThrow", error); throw error; }
    }
    const collected = (async () => {
      for await (const value of child.stdout) {
        scope.check(); if (!(value instanceof Uint8Array)) fail("INSPECTION_TOC_INVALID");
        bytes += value.byteLength; if (bytes > limit) { value.fill(0); fail("INSPECTION_LIMIT"); } chunks.push(Buffer.from(value)); value.fill(0);
      }
      if (!ended) fail("INSPECTION_NATIVE_FAILED");
    })(); collected.catch(discard);
    // ACL children use a shorter deadline inside the same absolute budget.
    const nativeTimeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new BackupError("INSPECTION_TIMEOUT")), scope.remaining()); }); nativeTimeout.catch(discard);
    await Promise.race([Promise.all([collected, closed]), failed, nativeTimeout]); scope.check();
    if (inputError && inputError !== "EPIPE") fail("INSPECTION_INPUT_FAILED");
    const output = Buffer.concat(chunks, bytes); successful = true;
    // TOC-only pg_restore may not consume the data tail. Real EOF+close0 above,
    // never an ACK, allow discarding ONLY this owned input after qualification.
    if (database) { observer?.event("stdinDestroyRequested"); child.stdin.destroy(); }
    return output;
  } catch (error) { observer?.refusedError(error); throw error; }
  finally { clearTimeout(timer); if (!successful) stop(child); for (const chunk of chunks) chunk.fill(0); }
}
async function privatePath(path, directory, lease, env, scope, dependencies) {
  const current = await regularPath(path, directory); if (!sameFile(lease, current)) fail("INSPECTION_SNAPSHOT_CHANGED"); scope.check();
  if (process.platform !== "win32") {
    if (current.uid !== process.getuid() || (current.mode & 0o777) !== (directory ? 0o700 : 0o600)) fail("INSPECTION_PRIVATE_PATH_REFUSED"); return;
  }
  if (!win32.isAbsolute(env.SystemRoot ?? "")) fail("INSPECTION_PRIVATE_PATH_REFUSED");
  const settings = { env: { ...osEnvironment(env), SC_INSPECT_ACL_PATH: path, SC_INSPECT_ACL_KIND: directory ? "directory" : "file" }, stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true };
  const child = (dependencies.spawnAcl ?? spawn)(win32.join(env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(PRIVATE_PATH_ACL_SCRIPT, "utf16le").toString("base64")], settings);
  const aclScope = context(Math.min(INSPECTION_LIMITS.aclTimeoutMs, scope.remaining())); let output;
  try {
    output = await scope.race(collectNative(child, aclScope, INSPECTION_LIMITS.aclBytes));
    let value; try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(output)); } catch { fail("INSPECTION_PRIVATE_PATH_REFUSED"); }
    const descriptors = Object.getOwnPropertyDescriptors(value ?? {});
    if (Reflect.ownKeys(descriptors).length !== 1 || !descriptors.private?.enumerable || !Object.hasOwn(descriptors.private, "value") || descriptors.private.value !== true) fail("INSPECTION_PRIVATE_PATH_REFUSED");
    if (!sameFile(lease, await regularPath(path, directory))) fail("INSPECTION_SNAPSHOT_CHANGED");
  } finally { if (!output) stop(child); output?.fill(0); aclScope.close(); }
}
async function cipherHash(path, scope) {
  const stream = createReadStream(path), hash = createHash("sha256"); let bytes = 0;
  try { for await (const chunk of stream) { scope.check(); bytes += chunk.byteLength; if (bytes > INSPECTION_LIMITS.archiveBytes) fail("INSPECTION_LIMIT"); hash.update(chunk); chunk.fill(0); } scope.check(); return hash.digest("hex"); } finally { stream.destroy(); }
}
async function cleanupOwned(directory, directoryLease, snapshot, snapshotLease) {
  if (!directory) return;
  if (!sameFile(directoryLease, await regularPath(directory, true))) fail("INSPECTION_CLEANUP_FAILED");
  if (snapshotLease) { if (!sameFile(snapshotLease, await regularPath(snapshot))) fail("INSPECTION_CLEANUP_FAILED"); await unlink(snapshot); }
  // Never recursive deletion. A changed inode or any unexpected file refuses.
  await rmdir(directory);
}

/** Explicit inspection only; original format authenticates the entire footer
 * and Storage records too. No target query, storage HTTP or restore exists.
 * Plaintext DB and native TOC stay in owned RAM. Temp files are ciphertext only.
 * The bounded timeout is failure; cancellation never certifies child shutdown.
 */
async function inspectManagedBackupCore(archive, env, dependencies, observation, shared = null) {
  let stage = null, authComplete = false, listStarted = false, inventory = null, scope, nativeListFailure = null, tocObserver = null;
  const chunks = [];
  let directory, directoryLease, snapshot, snapshotLease, database, toc, key, pendingRead, listChild, customTocHandle, historyReceipt, plan, listFinished = false, failed = false;
  // Only the private combined caller supplies this owner. Public wrappers and
  // dependencies cannot inject a resource owner, consumer or retained handle.
  if (shared) shared.source = { originalFailure: () => nativeListFailure };
  const sanitizedFailure = error => {
    const code = closedError(error), sanitized = new BackupError(code);
    if (tocObserver) { if (stage === "native_toc") tocObserver.refuse(code); sourceTocFailures.set(sanitized, tocObserver); }
    inspectionFailures.set(sanitized, Object.freeze({ stage, authComplete, listStarted, tocDiagnostic: managedTocUnsupportedDiagnostic(error), tocPlanDiagnostic: managedTocPlanDiagnostic(error), inventory, nativeHistoryDiagnostic: nativeMigrationHistoryDiagnostic(error) }));
    return sanitized;
  };
  try {
    // Identity/target/key guards run before ANY archive or private temp access.
    const settings = encryptionSettings(env), config = restoreConfiguration(env);
    if (typeof archive !== "string" || !isAbsolute(archive)) fail("INVALID_ARGUMENTS");
    scope = shared?.scope ?? context(dependencies.timeoutMs ?? INSPECTION_LIMITS.timeoutMs, () => nativeListFailure);
    stage = "archive_path";
    const original = await scope.race(regularPath(archive)); scope.check(); if (original.size > INSPECTION_LIMITS.archiveBytes) fail("INSPECTION_LIMIT");
    stage = "temporary_path";
    const temporaryPath = dependencies.temporaryRoot === undefined ? await scope.race(defaultInspectionTemporaryRoot()) : dependencies.temporaryRoot;
    const temporary = await scope.race(safeBackupDirectory(temporaryPath, { forbiddenRoots: [env.SC_BACKUP_APP_SERVING_ROOT, env.SC_BACKUP_WORK_ROOT].filter(Boolean), syncRoots: [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].filter(Boolean) }));
    directory = await scope.race(mkdtemp(join(temporary, "sc-inspect-cipher-"))); directoryLease = await regularPath(directory, true); await chmod(directory, 0o700);
    stage = "directory_acl";
    await privatePath(directory, true, directoryLease, env, scope, dependencies);
    stage = "copy_ciphertext";
    snapshot = join(directory, "snapshot.scbackup"); await scope.race(copyFile(archive, snapshot, constants.COPYFILE_EXCL)); snapshotLease = await regularPath(snapshot); await chmod(snapshot, 0o600);
    stage = "ciphertext_acl";
    await privatePath(snapshot, false, snapshotLease, env, scope, dependencies);
    stage = "cipher_authentication";
    const archiveSha256 = await scope.race(cipherHash(snapshot, scope)); let databaseSummary, databaseEntries = 0, bytes = 0;
    key = Buffer.from(settings.key, "base64");
    pendingRead = readBackup(snapshot, key, {
      header(header) { scope.check(); if (header.project_ref !== PERSONAL_REF || header.key_id !== settings.keyId) fail("BACKUP_IDENTITY_MISMATCH"); },
      begin(metadata) { scope.check(); if (metadata.kind === "database") databaseEntries++; },
      chunk(value, metadata) { scope.check(); if (metadata.kind !== "database") return; bytes += value.byteLength; if (bytes > INSPECTION_LIMITS.databaseBytes) fail("INSPECTION_LIMIT"); chunks.push(Buffer.from(value)); },
      end(summary, metadata) { scope.check(); if (metadata.kind === "database") databaseSummary = summary; },
    }); pendingRead.catch(discard);
    // Native work cannot start until ALL records, footer, manifest and EOF pass.
    await scope.race(pendingRead); authComplete = true; scope.check();
    if (archiveSha256 !== await scope.race(cipherHash(snapshot, scope)) || !sameFile(snapshotLease, await regularPath(snapshot))) fail("INSPECTION_SNAPSHOT_CHANGED");
    database = Buffer.concat(chunks, bytes); for (const chunk of chunks) chunk.fill(0); chunks.length = 0;
    if (databaseEntries !== 1 || database.subarray(0, 5).toString("ascii") !== "PGDMP" || databaseSummary?.size !== bytes || databaseSummary?.digest !== digest(database)) fail("RESTORE_MANAGED_DATABASE_INVALID");
    stage = "native_toc";
    tocObserver = sourceTocObserver(); tocObserver.event("spawnRequested");
    if (shared) sourceTocOwners.set(shared.source, tocObserver);
    try {
      listChild = (dependencies.spawnList ?? spawn)(config.pgRestore, ["--list", "--verbose"], { env: osEnvironment(env), stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true });
      if (listChild && typeof listChild === "object") sourceTocObservers.set(listChild, tocObserver);
      // The Node-owned spawn event is actual creation, not merely a request or
      // progress callback supplied by a caller. No PID or child output is read.
      listChild?.once?.("spawn", () => { tocObserver.event("spawn"); listStarted = true; });
    } catch (error) { tocObserver.error("spawnThrow", error); fail("INSPECTION_NATIVE_UNAVAILABLE"); }
    toc = await scope.race(collectNative(listChild, scope, INSPECTION_LIMITS.tocBytes, database, error => { nativeListFailure ??= error; }, tocObserver)); listFinished = true; scope.check();
    stage = "plan";
    let text; try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(toc); } catch { fail("INSPECTION_TOC_INVALID"); }
    inventory = diagnosticInventory(text); scope.check();
    plan = planManagedRestore(text, { archiveSha256, databaseSha256: databaseSummary.digest, databaseBytes: bytes }); scope.check();
    if (observation === "format") {
      // Explicit new diagnostic only. The SAME bytes have passed full archive
      // authentication, ciphertext recheck, native EOF/close0 and planning.
      // No snapshot mint, target connection or binary TOC parser is enabled.
      stage = "custom_header";
      const format = observeCustomArchiveHeader(database); scope.check();
      return Object.freeze({ plan, format });
    }
    if (observation === "toc" || observation === "history" || observation === "combined") {
      // Same fully authenticated bytes and successful native plan. This new
      // diagnostic extracts only HEADER+TOC, cross-checks all list-visible
      // fields, and exposes aggregate counts. The history branch explicitly
      // reads only its two selected COPYs; neither branch can mint or import.
      stage = "custom_toc";
      customTocHandle = extractCustomArchiveToc(plan, database);
      const facts = customArchiveTocFacts(customTocHandle); scope.check();
      const result = { plan, format: facts.format, customToc: Object.freeze({ entries: facts.records.length, preservedEntries: facts.preserved.length, encoding: facts.encoding, tocBytes: facts.tocEndOffset }) };
      if (observation === "history" || observation === "combined") {
        // Explicit read-only native DATA extraction, only after full AEAD,
        // original native list EOF/close0, plan and binary TOC cross-check.
        // The reader borrows THIS deadline and its list stays under THIS new
        // protected directory. No target, SQL client, mint or import exists.
        stage = "native_history";
        historyReceipt = await readNativeMigrationHistory({ tocHandle: customTocHandle, database, nativeTocText: text, pgRestore: config.pgRestore, environment: osEnvironment(env), listOptions: {
          privateRoot: directory, powerShellExecutable: join(env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), systemRoot: env.SystemRoot,
          forbiddenRoots: [env.SC_BACKUP_APP_SERVING_ROOT, env.SC_BACKUP_WORK_ROOT].filter(Boolean), syncRoots: [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].filter(Boolean),
        } }, scope, dependencies.nativeHistoryPorts);
        const native = nativeMigrationHistoryFacts(historyReceipt), history = migrationHistoryFacts(native.historyHandle);
        scope.check();
        result.migrationHistory = Object.freeze({ authRows: history.history.auth.length, storageRows: history.history.storage.length, stdoutBytes: native.nativeFacts.stdoutBytes, inputTerminal: native.nativeFacts.inputTerminal, transportMode: native.nativeFacts.mode });
      }
      return Object.freeze(result);
    }
    return plan;
  } catch (error) { failed = true; throw sanitizedFailure(nativeListFailure ?? error); }
  finally {
    if (shared) {
      // Transfer cleanup responsibility without exporting plaintext/handles.
      // This executes on every return AND refusal, retaining partial resources.
      Object.assign(shared.source, { directory, directoryLease, snapshot, snapshotLease, database, toc, key, pendingRead, listChild, customTocHandle, historyReceipt, plan, chunks, listFinished });
    } else {
    stage = "cleanup";
    let cleanupError = null;
    // Keep the nominal handles and native first-failure guard live across our
    // own asynchronous cleanup. A late original child error must still veto
    // a result assembled earlier. Failure cannot renew the original budget.
    if (failed) scope?.close();
    if (!listFinished) stop(listChild); key?.fill(0); database?.fill(0); toc?.fill(0); for (const chunk of chunks) chunk.fill(0);
    // A late local read is still owned and guarded by the expired scope. It can
    // neither append plaintext nor start a child. Cleanup waits for its handle,
    // without replacing a first refusal or claiming cancellation completed.
    if (pendingRead) await pendingRead.catch(discard);
    try { await cleanupOwned(directory, directoryLease, snapshot, snapshotLease); } catch { cleanupError = new BackupError("INSPECTION_CLEANUP_FAILED"); }
    let completionError = null;
    if (!failed) {
      completionError = nativeListFailure;
      try { if (historyReceipt) nativeMigrationHistoryFacts(historyReceipt); } catch (error) { completionError ??= error; }
      if (!completionError) completionError = cleanupError;
      if (!completionError) try { scope?.check(); } catch (error) { completionError = error; }
    }
    try { discardNativeMigrationHistory(historyReceipt); } catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    try { discardCustomArchiveToc(customTocHandle); } catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    scope?.close();
    tocObserver?.finalize();
    if (!failed && completionError) throw sanitizedFailure(completionError);
    }
  }
}
export function inspectManagedBackup(archive, env, dependencies = {}) {
  return inspectManagedBackupCore(archive, env, dependencies, null);
}
export function inspectManagedBackupFormat(archive, env, dependencies = {}) {
  return inspectManagedBackupCore(archive, env, dependencies, "format");
}
export function inspectManagedBackupToc(archive, env, dependencies = {}) {
  return inspectManagedBackupCore(archive, env, dependencies, "toc");
}
export function inspectManagedBackupHistory(archive, env, dependencies = {}) {
  return inspectManagedBackupCore(archive, env, dependencies, "history");
}
/** Target-only diagnostic. No source archive/key/HTTP/import/mint. One target
 * dump, observed empty in its own exported snapshot, feeds B4/B2/B3 in RAM.
 * Handles are discarded here; public counts cannot later authorize restore. */
export async function inspectManagedTargetBaseline(env, dependencies = {}) {
  return inspectManagedTargetCore(env, dependencies, false);
}
/** Complete target metadata observation. This separate nominal path never
 * creates a preserved/selected baseline, extracts histories or authorizes A2. */
export async function inspectManagedTargetInventory(env, dependencies = {}) {
  return inspectManagedTargetCore(env, dependencies, true);
}
// The mode comes only from the two wrappers above, never env/dependencies/CLI
// data. Both modes share the same original snapshot/list and cleanup guards.
async function inspectManagedTargetCore(env, dependencies, inspectionOnly, shared = null) {
  let scope, stage = "configuration", directory, directoryLease, snapshotReceipt, database, toc, customTocHandle, targetInspectionPlan, historyReceipt, listChild, listFinished = false, failed = false, nativeListFailure = null, targetConnectionRequested = false;
  if (shared) shared.target = { originalFailure: () => nativeListFailure };
  const sanitized = error => {
    const out = new BackupError(closedError(error));
    targetInspectionFailures.set(out, Object.freeze({ stage, targetConnectionRequested, nativeTargetDiagnostic: nativeTargetSnapshotDiagnostic(error), nativeHistoryDiagnostic: nativeMigrationHistoryDiagnostic(error), tocDiagnostic: managedTocUnsupportedDiagnostic(error), tocPlanDiagnostic: managedTocPlanDiagnostic(error) }));
    return out;
  };
  try {
    const config = restoreConfiguration(env);
    scope = shared?.scope ?? context(dependencies.timeoutMs ?? INSPECTION_LIMITS.timeoutMs, () => nativeListFailure);
    stage = "temporary_path";
    const temporaryPath = dependencies.temporaryRoot === undefined ? await scope.race(defaultInspectionTemporaryRoot()) : dependencies.temporaryRoot;
    const temporary = await scope.race(safeBackupDirectory(temporaryPath, { forbiddenRoots: [env.SC_BACKUP_APP_SERVING_ROOT, env.SC_BACKUP_WORK_ROOT].filter(Boolean), syncRoots: [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].filter(Boolean) }));
    directory = await scope.race(mkdtemp(join(temporary, "sc-inspect-target-"))); directoryLease = await regularPath(directory, true); await chmod(directory, 0o700);
    stage = "directory_acl"; await privatePath(directory, true, directoryLease, env, scope, dependencies);
    stage = "target_snapshot"; targetConnectionRequested = true;
    snapshotReceipt = await readNativeTargetSnapshot({ projectRef: config.ref, psql: config.psql, pgDump: join(dirname(config.pgRestore), "pg_dump.exe"), environment: config.pg }, scope, dependencies.targetSnapshotPorts);
    const native = nativeTargetSnapshotFacts(snapshotReceipt); scope.check(); database = copyNativeTargetSnapshot(snapshotReceipt);
    stage = "native_toc";
    try { listChild = (dependencies.spawnList ?? spawn)(config.pgRestore, ["--list", "--verbose"], { env: osEnvironment(env), stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true }); } catch { fail("INSPECTION_NATIVE_UNAVAILABLE"); }
    toc = await scope.race(collectNative(listChild, scope, INSPECTION_LIMITS.tocBytes, database, error => { nativeListFailure ??= error; })); listFinished = true; scope.check();
    stage = "plan";
    let text; try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(toc); } catch { fail("INSPECTION_TOC_INVALID"); }
    const binding = { projectRef: native.projectRef, databaseName: native.databaseName, nativeDumpSha256: native.nativeDumpSha256, nativeDumpBytes: native.nativeDumpBytes };
    if (inspectionOnly) {
      targetInspectionPlan = planManagedTargetInspection(text, binding);
      managedTargetInspectionRequirements(targetInspectionPlan); scope.check();
      stage = "custom_toc";
      customTocHandle = extractCustomTargetInspectionToc(targetInspectionPlan, database);
      const facts = customTargetInspectionTocFacts(customTocHandle), inventory = diagnosticInventory(text);
      nativeTargetSnapshotFacts(snapshotReceipt); scope.check();
      if (!inventory || !inventory.headersValid || inventory.unknownClassCount !== 0 || inventory.malformedRowCount !== 0 || inventory.countObserved !== facts.records.length) fail("INSPECTION_TOC_INVALID");
      return Object.freeze({ format: facts.format, snapshot: native.snapshot, transportMode: native.mode,
        customToc: Object.freeze({ entries: facts.records.length, encoding: facts.encoding, tocBytes: facts.tocEndOffset }), inventory,
        inspectionOnly: true, baselineQualified: false, baselineCompared: false, restoreAccepted: false });
    }
    const plan = planManagedTargetBaseline(text, binding);
    stage = "custom_toc"; customTocHandle = extractCustomTargetToc(plan, database); const facts = customArchiveTocFacts(customTocHandle); scope.check();
    stage = "native_history";
    historyReceipt = await readNativeMigrationHistory({ tocHandle: customTocHandle, database, nativeTocText: text, pgRestore: config.pgRestore, environment: osEnvironment(env), listOptions: {
      privateRoot: directory, powerShellExecutable: join(env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), systemRoot: env.SystemRoot,
      forbiddenRoots: [env.SC_BACKUP_APP_SERVING_ROOT, env.SC_BACKUP_WORK_ROOT].filter(Boolean), syncRoots: [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].filter(Boolean),
    } }, scope, dependencies.nativeHistoryPorts);
    const historyNative = nativeMigrationHistoryFacts(historyReceipt), history = migrationHistoryFacts(historyNative.historyHandle); nativeTargetSnapshotFacts(snapshotReceipt); scope.check();
    if (history.history.auth.length !== native.snapshot.authHistoryRows || history.history.storage.length !== native.snapshot.storageHistoryRows) fail("INSPECTION_SNAPSHOT_CHANGED");
    return Object.freeze({ format: facts.format, snapshot: native.snapshot, transportMode: native.mode, customToc: Object.freeze({ entries: facts.records.length, preservedEntries: facts.preserved.length, encoding: facts.encoding, tocBytes: facts.tocEndOffset }), migrationHistory: Object.freeze({ authRows: history.history.auth.length, storageRows: history.history.storage.length, stdoutBytes: historyNative.nativeFacts.stdoutBytes, inputTerminal: historyNative.nativeFacts.inputTerminal, transportMode: historyNative.nativeFacts.mode }) });
  } catch (error) { failed = true; throw sanitized(nativeListFailure ?? error); }
  finally {
    if (shared) {
      Object.assign(shared.target, { directory, directoryLease, snapshotReceipt, database, toc, customTocHandle, targetInspectionPlan, historyReceipt, listChild, listFinished });
    } else {
    stage = "cleanup";
    if (!listFinished) stop(listChild);
    let completionError = null;
    try { await cleanupOwned(directory, directoryLease); } catch { completionError = new BackupError("INSPECTION_CLEANUP_FAILED"); }
    if (!failed) {
      completionError = nativeListFailure ?? completionError;
      try {
        if (snapshotReceipt) nativeTargetSnapshotFacts(snapshotReceipt);
        if (inspectionOnly && targetInspectionPlan) managedTargetInspectionRequirements(targetInspectionPlan);
        if (inspectionOnly && customTocHandle) customTargetInspectionTocFacts(customTocHandle);
        if (historyReceipt) nativeMigrationHistoryFacts(historyReceipt);
        scope?.check();
      } catch (error) { completionError ??= error; }
    }
    // The borrowed dump remains intact until guards were rechecked across
    // asynchronous cleanup. Wiping it earlier would invalidate its own receipt.
    database?.fill(0); toc?.fill(0);
    if (historyReceipt) try { discardNativeMigrationHistory(historyReceipt); } catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    if (customTocHandle) try { if (inspectionOnly) discardCustomTargetInspectionToc(customTocHandle); else discardCustomArchiveToc(customTocHandle); } catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    if (snapshotReceipt) try { discardNativeTargetSnapshot(snapshotReceipt); } catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    scope?.close();
    if (!failed && completionError) throw sanitized(completionError);
    }
  }
}
/** Compare two live acquisitions in ONE process/deadline. This entry remains
 * read-only and cannot mint A1, authorize a replay or export private handles. */
export async function inspectManagedCombinedBaseline(archive, env, dependencies = {}) {
  const shared = { source: null, target: null, scope: null };
  let stage = "configuration", failed = false, targetHistoryReceipt, firstObserved = null, scopeClosed = false;
  const closeScope = () => { if (!scopeClosed && shared.scope) { scopeClosed = true; shared.scope.close(); } };
  const originalFailure = () => {
    // These closures read latches only. Receipt getters call scope.check and
    // must never run inside this callback (that would recursively check scope).
    firstObserved ??= shared.source?.originalFailure() ?? shared.target?.originalFailure() ?? null;
    return firstObserved;
  };
  const sanitized = (error, contextError = error) => {
    const out = new BackupError(closedError(error));
    const tocObserver = sourceTocFailures.get(contextError) ?? sourceTocFailures.get(error) ?? sourceTocOwners.get(shared.source);
    if (tocObserver) sourceTocFailures.set(out, tocObserver);
    combinedInspectionFailures.set(out, Object.freeze({ stage,
      // The first original refusal keeps code priority. Its core's sanitized
      // envelope owns the nominal phase context; replacing it with the raw
      // latch would lose that WeakMap entry. Never read caller error fields.
      sourceDiagnostic: inspectionFailures.get(contextError) ?? inspectionFailures.get(error) ?? null,
      targetDiagnostic: targetInspectionFailures.get(contextError) ?? targetInspectionFailures.get(error) ?? null,
      nativeHistoryDiagnostic: nativeMigrationHistoryDiagnostic(error) ?? nativeMigrationHistoryDiagnostic(contextError) }));
    return out;
  };
  const assertAllLive = () => {
    shared.scope.check();
    const source = shared.source, target = shared.target;
    if (source?.customTocHandle) customArchiveTocFacts(source.customTocHandle);
    if (source?.historyReceipt) nativeMigrationHistoryFacts(source.historyReceipt);
    if (target?.snapshotReceipt) nativeTargetSnapshotFacts(target.snapshotReceipt);
    if (target?.targetInspectionPlan) managedTargetInspectionRequirements(target.targetInspectionPlan);
    if (target?.customTocHandle) customTargetInspectionTocFacts(target.customTocHandle);
    if (targetHistoryReceipt) nativeInspectionMigrationHistoryFacts(targetHistoryReceipt);
    shared.scope.check();
  };
  try {
    shared.scope = context(dependencies.timeoutMs ?? INSPECTION_LIMITS.timeoutMs, originalFailure);
    stage = "source";
    // Full AEAD/footer/EOF and original source extraction precede ANY target
    // connection. The private owner prevents either core's normal discard.
    const sourceResult = await inspectManagedBackupCore(archive, env, dependencies, "combined", shared);
    assertAllLive();
    stage = "target";
    const targetResult = await inspectManagedTargetCore(env, dependencies, true, shared);
    assertAllLive();
    const config = restoreConfiguration(env), target = shared.target;
    stage = "target_history";
    const nativeTocText = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(target.toc);
    targetHistoryReceipt = await readNativeInspectionMigrationHistory({ tocHandle: target.customTocHandle, database: target.database, nativeTocText,
      pgRestore: config.pgRestore, environment: osEnvironment(env), listOptions: {
        privateRoot: target.directory, powerShellExecutable: join(env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), systemRoot: env.SystemRoot,
        forbiddenRoots: [env.SC_BACKUP_APP_SERVING_ROOT, env.SC_BACKUP_WORK_ROOT].filter(Boolean), syncRoots: [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].filter(Boolean),
      } }, shared.scope, dependencies.nativeInspectionHistoryPorts);
    assertAllLive();
    const sourceHistory = nativeMigrationHistoryFacts(shared.source.historyReceipt), targetHistory = nativeInspectionMigrationHistoryFacts(targetHistoryReceipt);
    const targetFacts = inspectionMigrationHistoryFacts(targetHistory.historyHandle);
    const targetNative = nativeTargetSnapshotFacts(target.snapshotReceipt);
    if (targetFacts.history.auth.length !== targetNative.snapshot.authHistoryRows || targetFacts.history.storage.length !== targetNative.snapshot.storageHistoryRows) fail("INSPECTION_SNAPSHOT_CHANGED");
    stage = "comparison";
    const comparison = observeInspectedManagedBaseline(shared.source.plan, shared.source.customTocHandle, sourceHistory.historyHandle, target.customTocHandle, targetHistory.historyHandle);
    assertAllLive();
    // Any supplied testing/configuration seam is conservatively synthetic.
    const native = Reflect.ownKeys(dependencies).length === 0 && sourceHistory.nativeFacts.mode === "native" && targetNative.mode === "native" && targetHistory.nativeFacts.mode === "native";
    return Object.freeze({ authenticatedSource: true, transportMode: native ? "native" : "synthetic",
      source: Object.freeze({ format: sourceResult.format, customToc: sourceResult.customToc, migrationHistory: sourceResult.migrationHistory }),
      target: Object.freeze({ format: targetResult.format, customToc: targetResult.customToc, snapshot: targetResult.snapshot,
        migrationHistory: Object.freeze({ authRows: targetFacts.history.auth.length, storageRows: targetFacts.history.storage.length, stdoutBytes: targetHistory.nativeFacts.stdoutBytes, inputTerminal: targetHistory.nativeFacts.inputTerminal, transportMode: targetHistory.nativeFacts.mode }) }),
      comparison, comparisonCompleted: true, targetQueried: native, inspectionOnly: true, baselineQualified: false, baselineCompared: true, remoteMutation: false, restoreAccepted: false });
  } catch (error) { failed = true; throw sanitized(originalFailure() ?? error, error); }
  finally {
    stage = "cleanup";
    let completionError = null;
    if (failed) closeScope();
    const source = shared.source, target = shared.target;
    for (const part of [source, target]) if (part && !part.listFinished) stop(part.listChild);
    // Source read may still own local cipher IO after timeout. Closing scope
    // prevents it from adding plaintext or starting native work; await its EOF.
    if (source?.pendingRead) await source.pendingRead.catch(discard);
    for (const part of [source, target]) if (part) {
      try { await cleanupOwned(part.directory, part.directoryLease, part.snapshot, part.snapshotLease); }
      catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    }
    if (!failed) {
      completionError = originalFailure() ?? completionError;
      try { assertAllLive(); } catch (error) { completionError ??= error; }
    }
    // All async cleanup guards run while the borrowed dump copies are intact.
    // No partial comparison is emitted if any of those checks refused.
    try { if (targetHistoryReceipt) discardNativeInspectionMigrationHistory(targetHistoryReceipt); } catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    try { if (source?.historyReceipt) discardNativeMigrationHistory(source.historyReceipt); } catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    try { if (source?.customTocHandle) discardCustomArchiveToc(source.customTocHandle); } catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    try { if (target?.customTocHandle) discardCustomTargetInspectionToc(target.customTocHandle); } catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    try { if (target?.snapshotReceipt) discardNativeTargetSnapshot(target.snapshotReceipt); } catch { completionError ??= new BackupError("INSPECTION_CLEANUP_FAILED"); }
    source?.key?.fill(0); source?.database?.fill(0); source?.toc?.fill(0); for (const chunk of source?.chunks ?? []) chunk.fill(0);
    target?.database?.fill(0); target?.toc?.fill(0);
    closeScope();
    sourceTocOwners.get(source)?.finalize();
    if (!failed && completionError) throw sanitized(completionError);
  }
}

export async function runManagedInspect(argv, env, output = value => process.stdout.write(JSON.stringify(value) + "\n"), dependencies = {}) {
  let operation = "managed_restore_inspect", observation = null;
  try {
    if (!Array.isArray(argv)) fail("INVALID_ARGUMENTS");
    if (argv[0] === "inspect-baseline") {
      operation = "managed_restore_combined_baseline_inspect";
      if (argv.length !== 2) fail("INVALID_ARGUMENTS");
      const result = await inspectManagedCombinedBaseline(argv[1], env, dependencies);
      output({ ok: true, operation, ...result }); return 0;
    }
    if (argv.length === 1 && ["inspect-target", "inspect-target-inventory"].includes(argv[0])) {
      const inventoryOnly = argv[0] === "inspect-target-inventory";
      operation = inventoryOnly ? "managed_restore_target_inventory_inspect" : "managed_restore_target_baseline_inspect";
      const result = inventoryOnly ? await inspectManagedTargetInventory(env, dependencies) : await inspectManagedTargetBaseline(env, dependencies);
      output({ ok: true, operation, ...result, targetQueried: result.transportMode === "native", remoteMutation: false, baselineCompared: false, restoreAccepted: false }); return 0;
    }
    observation = argv[0] === "inspect-history" ? "history" : argv[0] === "inspect-toc" ? "toc" : argv[0] === "inspect-format" ? "format" : null;
    if (observation) operation = observation === "history" ? "managed_restore_history_inspect" : observation === "toc" ? "managed_restore_toc_inspect" : "managed_restore_format_inspect";
    if (argv.length === 0 || argv.length === 1 && argv[0] === "--help") { output({ operation: "managed_restore_inspect", command: "inspect ABSOLUTE_ARCHIVE", readonly: true, targetQueried: false, restoreAccepted: false }); return 0; }
    if (argv.length !== 2 || !["inspect", "inspect-format", "inspect-toc", "inspect-history"].includes(argv[0])) fail("INVALID_ARGUMENTS");
    const result = await inspectManagedBackupCore(argv[1], env, dependencies, observation), plan = observation ? result.plan : result;
    output({ ok: true, operation, authenticated: true, planSupported: true, selectedEntries: plan.selectedEntries, preservedEntries: plan.preservedEntries, segments: plan.segments, ...(observation ? { format: result.format } : {}), ...(["toc", "history"].includes(observation) ? { customToc: result.customToc } : {}), ...(observation === "history" ? { migrationHistory: result.migrationHistory } : {}), targetQueried: false, remoteMutation: false, restoreAccepted: false }); return 0;
  } catch (error) {
    if (operation === "managed_restore_combined_baseline_inspect") {
      const facts = combinedInspectionFailures.get(error);
      output({ ok: false, operation, error: closedError(error), stage: facts?.stage ?? null, sourceDiagnostic: facts?.sourceDiagnostic ?? null,
        targetDiagnostic: facts?.targetDiagnostic ?? null, nativeHistoryDiagnostic: facts?.nativeHistoryDiagnostic ?? null,
        sourceTocDiagnostic: sourceTocFailures.get(error)?.facts() ?? null,
        comparisonCompleted: false, inspectionOnly: true, baselineQualified: false, baselineCompared: false, remoteMutation: false, restoreAccepted: false }); return 1;
    }
    if (["managed_restore_target_baseline_inspect", "managed_restore_target_inventory_inspect"].includes(operation)) {
      const facts = targetInspectionFailures.get(error);
      output({ ok: false, operation, error: closedError(error), stage: facts?.stage ?? null, targetConnectionRequested: facts?.targetConnectionRequested ?? false, nativeTargetDiagnostic: facts?.nativeTargetDiagnostic ?? null, nativeHistoryDiagnostic: facts?.nativeHistoryDiagnostic ?? null, tocDiagnostic: facts?.tocDiagnostic ?? null, tocPlanDiagnostic: facts?.tocPlanDiagnostic ?? null, ...(operation === "managed_restore_target_inventory_inspect" ? { inspectionOnly: true, baselineQualified: false } : {}), remoteMutation: false, baselineCompared: false, restoreAccepted: false }); return 1;
    }
    const facts = inspectionFailures.get(error);
    output({ ok: false, operation, error: closedError(error), stage: facts?.stage ?? null, authComplete: facts?.authComplete ?? false, listStarted: facts?.listStarted ?? false, tocDiagnostic: facts?.tocDiagnostic ?? null, tocPlanDiagnostic: facts?.tocPlanDiagnostic ?? null, inventory: facts?.inventory ?? null, ...(observation === "history" ? { nativeHistoryDiagnostic: facts?.nativeHistoryDiagnostic ?? null } : {}), targetQueried: false, remoteMutation: false, restoreAccepted: false }); return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runManagedInspect(process.argv.slice(2), process.env);
