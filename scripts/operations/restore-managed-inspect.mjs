import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, constants } from "node:fs";
import { chmod, copyFile, lstat, mkdtemp, realpath, rmdir, unlink } from "node:fs/promises";
import { isAbsolute, join, resolve, win32 } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { BackupError, readBackup } from "./backup-format.mjs";
import { encryptionSettings, PERSONAL_REF, safeBackupDirectory } from "./backup-config.mjs";
import { restoreConfiguration } from "./restore-target.mjs";
import { diagnosticInventory, managedTocPlanDiagnostic, managedTocUnsupportedDiagnostic, planManagedRestore } from "./restore-managed-plan.mjs";
import { observeCustomArchiveHeader, CUSTOM_HEADER_ERROR_CODES } from "./restore-custom-header.mjs";

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
const errorCodes = new Set(["INVALID_ARGUMENTS", "BACKUP_KEY_REQUIRED", "BACKUP_KEY_MUST_BE_INDEPENDENT", "ISOLATED_RESTORE_TARGET_REQUIRED", "ISOLATED_STORAGE_CONFIGURATION_REQUIRED", "RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED", "PERSONAL_POSTGRES_CONFIGURATION_REQUIRED", "UNSAFE_BACKUP_DESTINATION", "BACKUP_IDENTITY_MISMATCH", "BACKUP_AUTHENTICATION_FAILED", "INVALID_BACKUP", "INVALID_HEADER", "INVALID_FRAME", "INVALID_ORDER", "INVALID_ENTRY", "ENTRY_HASH_MISMATCH", "MANIFEST_MISMATCH", "TRAILING_DATA", "TRUNCATED_BACKUP", "MISSING_MANIFEST", "INCOMPLETE_BACKUP", "INSPECTION_PATH_REFUSED", "INSPECTION_PRIVATE_PATH_REFUSED", "INSPECTION_TIMEOUT", "INSPECTION_LIMIT", "INSPECTION_NATIVE_FAILED", "INSPECTION_NATIVE_UNAVAILABLE", "INSPECTION_INPUT_FAILED", "INSPECTION_TOC_INVALID", "INSPECTION_SNAPSHOT_CHANGED", "INSPECTION_CLEANUP_FAILED", "RESTORE_MANAGED_DATABASE_INVALID", "RESTORE_MANAGED_BINDING_INVALID", "RESTORE_TOC_INVALID", "RESTORE_TOC_UNSUPPORTED", "RESTORE_TOC_DEPENDENCY_INVALID", "RESTORE_MANAGED_CUSTOM_INVALID"]);
function closedError(error) {
  try { const value = Object.getOwnPropertyDescriptor(error, "code"); if (error instanceof BackupError && value && Object.hasOwn(value, "value") && (errorCodes.has(value.value) || CUSTOM_HEADER_ERROR_CODES.includes(value.value))) return value.value; } catch { /* Never read provider text/getters. */ }
  return "INSPECTION_UNAVAILABLE";
}
function stop(child) {
  if (!child || typeof child !== "object" || stoppedChildren.has(child)) return;
  stoppedChildren.add(child);
  for (const stream of [child?.stdin, child?.stdout, child?.stderr]) try { stream?.destroy?.(); } catch { /* Cancellation is only a local request. */ }
  try { child?.kill?.("SIGKILL"); } catch { /* No process termination is inferred. */ }
  try { child?.unref?.(); } catch { /* First failure remains authoritative. */ }
}
function context(timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > INSPECTION_LIMITS.timeoutMs) fail("INVALID_ARGUMENTS");
  const deadline = performance.now() + timeoutMs; let expired = false, timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(new BackupError("INSPECTION_TIMEOUT")); }, timeoutMs); }); timeout.catch(discard);
  return { check() { if (expired || performance.now() >= deadline) fail("INSPECTION_TIMEOUT"); }, remaining() { this.check(); return Math.max(1, Math.ceil(deadline - performance.now())); }, race(value) { return Promise.race([value, timeout]); }, close() { clearTimeout(timer); expired = true; } };
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
async function collectNative(child, scope, limit, database = null) {
  const chunks = []; let bytes = 0, ended = false, inputError = null, successful = false;
  let rejectFailure, resolveClose;
  const failed = new Promise((_, reject) => { rejectFailure = reject; }); failed.catch(discard);
  const closed = new Promise(resolve => { resolveClose = resolve; });
  const refuse = code => rejectFailure(new BackupError(code));
  let timer;
  try {
    if (!child || typeof child.on !== "function" || !child.stdout?.[Symbol.asyncIterator]) fail("INSPECTION_NATIVE_UNAVAILABLE");
    child.on("error", () => refuse("INSPECTION_NATIVE_UNAVAILABLE"));
    child.on("exit", code => { if (code !== 0) refuse("INSPECTION_NATIVE_FAILED"); });
    child.on("close", code => { if (code !== 0) refuse("INSPECTION_NATIVE_FAILED"); resolveClose(code); });
    child.stdout.on("error", () => refuse("INSPECTION_NATIVE_FAILED"));
    child.stdout.on("end", () => { ended = true; });
    child.stdout.on("close", () => { if (!ended) refuse("INSPECTION_NATIVE_FAILED"); });
    child.stderr?.on("error", () => refuse("INSPECTION_NATIVE_FAILED")); child.stderr?.resume();
    if (database) {
      if (!child.stdin?.end) fail("INSPECTION_NATIVE_UNAVAILABLE");
      child.stdin.on("error", error => { inputError = error?.code; if (inputError !== "EPIPE") refuse("INSPECTION_INPUT_FAILED"); });
      child.stdin.end(database, error => { if (error) { inputError = error.code; if (inputError !== "EPIPE") refuse("INSPECTION_INPUT_FAILED"); } });
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
    if (database) child.stdin.destroy();
    return output;
  } finally { clearTimeout(timer); if (!successful) stop(child); for (const chunk of chunks) chunk.fill(0); }
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
async function inspectManagedBackupCore(archive, env, dependencies, observeFormat) {
  let stage = null, authComplete = false, listStarted = false, inventory = null, scope;
  const chunks = [];
  let directory, directoryLease, snapshot, snapshotLease, database, toc, key, pendingRead, listChild, listFinished = false, failed = false;
  const sanitizedFailure = error => {
    const sanitized = new BackupError(closedError(error));
    inspectionFailures.set(sanitized, Object.freeze({ stage, authComplete, listStarted, tocDiagnostic: managedTocUnsupportedDiagnostic(error), tocPlanDiagnostic: managedTocPlanDiagnostic(error), inventory }));
    return sanitized;
  };
  try {
    // Identity/target/key guards run before ANY archive or private temp access.
    const settings = encryptionSettings(env), config = restoreConfiguration(env);
    if (typeof archive !== "string" || !isAbsolute(archive)) fail("INVALID_ARGUMENTS");
    scope = context(dependencies.timeoutMs ?? INSPECTION_LIMITS.timeoutMs);
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
    try {
      listChild = (dependencies.spawnList ?? spawn)(config.pgRestore, ["--list", "--verbose"], { env: osEnvironment(env), stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true });
      // The Node-owned spawn event is actual creation, not merely a request or
      // progress callback supplied by a caller. No PID or child output is read.
      listChild?.once?.("spawn", () => { listStarted = true; });
    } catch { fail("INSPECTION_NATIVE_UNAVAILABLE"); }
    toc = await scope.race(collectNative(listChild, scope, INSPECTION_LIMITS.tocBytes, database)); listFinished = true; scope.check();
    stage = "plan";
    let text; try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(toc); } catch { fail("INSPECTION_TOC_INVALID"); }
    inventory = diagnosticInventory(text); scope.check();
    const plan = planManagedRestore(text, { archiveSha256, databaseSha256: databaseSummary.digest, databaseBytes: bytes }); scope.check();
    if (observeFormat) {
      // Explicit new diagnostic only. The SAME bytes have passed full archive
      // authentication, ciphertext recheck, native EOF/close0 and planning.
      // No snapshot mint, target connection or binary TOC parser is enabled.
      stage = "custom_header";
      const format = observeCustomArchiveHeader(database); scope.check();
      return Object.freeze({ plan, format });
    }
    return plan;
  } catch (error) { failed = true; throw sanitizedFailure(error); }
  finally {
    stage = "cleanup";
    scope?.close(); if (!listFinished) stop(listChild); key?.fill(0); database?.fill(0); toc?.fill(0); for (const chunk of chunks) chunk.fill(0);
    // A late local read is still owned and guarded by the expired scope. It can
    // neither append plaintext nor start a child. Cleanup waits for its handle,
    // without replacing a first refusal or claiming cancellation completed.
    if (pendingRead) await pendingRead.catch(discard);
    try { await cleanupOwned(directory, directoryLease, snapshot, snapshotLease); } catch { if (!failed) throw sanitizedFailure(new BackupError("INSPECTION_CLEANUP_FAILED")); }
  }
}
export function inspectManagedBackup(archive, env, dependencies = {}) {
  return inspectManagedBackupCore(archive, env, dependencies, false);
}
export function inspectManagedBackupFormat(archive, env, dependencies = {}) {
  return inspectManagedBackupCore(archive, env, dependencies, true);
}
export async function runManagedInspect(argv, env, output = value => process.stdout.write(JSON.stringify(value) + "\n"), dependencies = {}) {
  let operation = "managed_restore_inspect";
  try {
    if (!Array.isArray(argv)) fail("INVALID_ARGUMENTS");
    const observeFormat = argv[0] === "inspect-format";
    if (observeFormat) operation = "managed_restore_format_inspect";
    if (argv.length === 0 || argv.length === 1 && argv[0] === "--help") { output({ operation: "managed_restore_inspect", command: "inspect ABSOLUTE_ARCHIVE", readonly: true, targetQueried: false, restoreAccepted: false }); return 0; }
    if (argv.length !== 2 || !["inspect", "inspect-format"].includes(argv[0])) fail("INVALID_ARGUMENTS");
    const result = await inspectManagedBackupCore(argv[1], env, dependencies, observeFormat), plan = observeFormat ? result.plan : result;
    output({ ok: true, operation, authenticated: true, planSupported: true, selectedEntries: plan.selectedEntries, preservedEntries: plan.preservedEntries, segments: plan.segments, ...(observeFormat ? { format: result.format } : {}), targetQueried: false, remoteMutation: false, restoreAccepted: false }); return 0;
  } catch (error) {
    const facts = inspectionFailures.get(error);
    output({ ok: false, operation, error: closedError(error), stage: facts?.stage ?? null, authComplete: facts?.authComplete ?? false, listStarted: facts?.listStarted ?? false, tocDiagnostic: facts?.tocDiagnostic ?? null, tocPlanDiagnostic: facts?.tocPlanDiagnostic ?? null, inventory: facts?.inventory ?? null, targetQueried: false, remoteMutation: false, restoreAccepted: false }); return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runManagedInspect(process.argv.slice(2), process.env);
