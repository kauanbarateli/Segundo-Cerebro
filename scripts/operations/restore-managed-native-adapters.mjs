import { spawn as nativeSpawn } from "node:child_process";
import * as nativeFs from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { dirname, isAbsolute, join } from "node:path";
import { BackupError } from "./backup-format.mjs";
import { safeBackupDirectory } from "./backup-config.mjs";
import { MANAGED_VALIDATION_SQL } from "./restore-managed-validation-sql.mjs";

const fail = code => { throw new BackupError(code); };
const LIST_INVALID = "RESTORE_MANAGED_LIST_INVALID", VALIDATION_FAILED = "RESTORE_MANAGED_VALIDATION_FAILED";
const digest = value => createHash("sha256").update(value).digest("hex");
export const PRIVATE_TOC_ACL_HELPER = "$ErrorActionPreference='Stop'\ntry {\n $target=$env:SC_MANAGED_LIST_TARGET\n $root=$env:SC_MANAGED_PRIVATE_ROOT\n $mode=$env:SC_MANAGED_LIST_MODE\n $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User\n if(-not $target -or -not $root -or $mode -notin @('SecureDirectory','VerifyFile')){throw 'REFUSED'}\n $item=Get-Item -LiteralPath $target -Force\n if(-not $item.FullName.Equals([IO.Path]::GetFullPath($target),[StringComparison]::OrdinalIgnoreCase)){throw 'REFUSED'}\n $ancestor=$item\n while($ancestor){\n  if(($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'REFUSED'}\n  if($ancestor -is [IO.FileInfo]){$ancestor=$ancestor.Directory}else{$ancestor=$ancestor.Parent}\n }\n $allowed=@($sid.Value,'S-1-5-18','S-1-5-32-544')\n foreach($rule in (Get-Acl -LiteralPath $root).Access){\n  if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed){throw 'REFUSED'}\n }\n if($mode -eq 'SecureDirectory'){\n  if($item -isnot [IO.DirectoryInfo]){throw 'REFUSED'}\n  $acl=[Security.AccessControl.DirectorySecurity]::new()\n  $acl.SetAccessRuleProtection($true,$false)\n  $acl.SetOwner($sid)\n  $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')\n  $acl.AddAccessRule($rule)\n  Set-Acl -LiteralPath $target -AclObject $acl\n }elseif($item -isnot [IO.FileInfo]){throw 'REFUSED'}\n $verified=Get-Acl -LiteralPath $target\n if($verified.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value){throw 'REFUSED'}\n $rules=@($verified.Access)\n if($rules.Count -ne 1 -or $rules[0].AccessControlType -ne 'Allow' -or $rules[0].IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or ($rules[0].FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl){throw 'REFUSED'}\n if($mode -eq 'SecureDirectory' -and -not $verified.AreAccessRulesProtected){throw 'REFUSED'}\n [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)\n [Console]::WriteLine('{\"ok\":true}')\n exit 0\n}catch{\n [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)\n [Console]::WriteLine('{\"ok\":false}')\n exit 1\n}\n";
export const PRIVATE_TOC_ACL_HELPER_SHA256 = digest(PRIVATE_TOC_ACL_HELPER);
export const MANAGED_ADAPTER_DEADLINE_MS = 45000;

function closed(value, fields, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  let descriptors;
  try { descriptors = Object.getOwnPropertyDescriptors(value); } catch { fail(code); }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) fail(code);
  const result = Object.create(null);
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) fail(code);
    result[field] = descriptor.value;
  }
  return result;
}

export function validateManagedValidation(value) {
  const data = closed(value, ["version", "sameActor", "replicationOrigin", "catalogueOk", "catalogueChecks", "catalogueDeviations", "foreignKeysChecked", "foreignKeyViolations"], VALIDATION_FAILED);
  if (data.version !== 1) fail(VALIDATION_FAILED);
  for (const key of ["sameActor", "replicationOrigin", "catalogueOk"]) if (typeof data[key] !== "boolean") fail(VALIDATION_FAILED);
  for (const key of ["catalogueChecks", "catalogueDeviations", "foreignKeysChecked", "foreignKeyViolations"]) if (!Number.isSafeInteger(data[key]) || data[key] < 0 || data[key] > 1000000) fail(VALIDATION_FAILED);
  if (data.catalogueChecks === 0 || data.catalogueDeviations > data.catalogueChecks || data.foreignKeyViolations > data.foreignKeysChecked || data.catalogueOk !== (data.catalogueDeviations === 0)) fail(VALIDATION_FAILED);
  return Object.freeze(data);
}

async function assertPlain(fs, path, directory) {
  const value = await fs.lstat(path);
  if (value.isSymbolicLink() || (directory ? !value.isDirectory() : !value.isFile())) fail(LIST_INVALID);
  return value;
}
const sameIdentity = (left, right) => left.dev === right.dev && left.ino === right.ino;
async function assertAncestors(fs, path) {
  let current = path;
  while (true) {
    await assertPlain(fs, current, true);
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

/** Fixed local PowerShell ACL proof. Only the owned path is changed, using the
 * current WindowsIdentity SID. No caller-supplied SID/script/command is used.
 * stdout is a closed boolean; credentials never enter env/argv or stderr.
 */
async function proveAcl({ path, mode, root, options, spawn, signal, remaining }) {
  let child, timer, resolveClose, rejectClose, text = "", ended = false;
  const pending = new Promise((resolve, reject) => { resolveClose = resolve; rejectClose = reject; });
  pending.catch(() => {});
  const refused = () => rejectClose(new BackupError(LIST_INVALID));
  const abort = () => { try { child?.kill(); } catch { /* local best effort */ } refused(); };
  const close = code => {
    if (code !== 0 || !ended) return refused();
    try {
      const data = closed(JSON.parse(text), ["ok"], LIST_INVALID);
      if (data.ok !== true) return refused();
      resolveClose();
    } catch { refused(); }
  };
  const data = chunk => {
    if (!(chunk instanceof Uint8Array) || text.length + chunk.byteLength > 128 || [...chunk].some(byte => byte > 127)) return refused();
    text += Buffer.from(chunk).toString("ascii");
  };
  const end = () => { ended = true; };
  try {
    if (signal.aborted) fail(LIST_INVALID);
    child = spawn(options.powerShellExecutable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(PRIVATE_TOC_ACL_HELPER, "utf16le").toString("base64")], { env: { SystemRoot: options.systemRoot, SC_MANAGED_LIST_TARGET: path, SC_MANAGED_PRIVATE_ROOT: root, SC_MANAGED_LIST_MODE: mode }, stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true });
    if (!child?.on || !child.stdout?.on) fail(LIST_INVALID);
    child.on("error", refused); child.on("close", close); child.stdout.on("data", data); child.stdout.on("end", end); child.stdout.on("error", refused);
    child.stderr?.on("error", refused); child.stderr?.resume();
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(abort, Math.min(remaining(), 10000));
    await pending;
  } catch { abort(); fail(LIST_INVALID); }
  finally {
    clearTimeout(timer); signal.removeEventListener("abort", abort);
    child?.removeListener?.("error", refused); child?.removeListener?.("close", close); child?.stdout?.removeListener?.("data", data); child?.stdout?.removeListener?.("end", end); child?.stdout?.removeListener?.("error", refused); child?.stderr?.removeListener?.("error", refused);
    // Delayed native errors after listener disposal are never unhandled.
    child?.on?.("error", () => {}); child?.stdout?.on?.("error", () => {}); child?.stderr?.on?.("error", () => {});
  }
}

/** Same consumer only. Echo nonce frames command output; no new psql, file,
 * connection or queryPostgres call exists here. Never reads stderr or reports
 * an unexpected output line. The stream's own COMMIT observer stays attached.
 */
export async function checkManagedBeforeCommit({ write, consumer }, { nonce, timeoutMs = 45000, onReport = () => {} } = {}) {
  if (typeof write !== "function" || !consumer?.on || !consumer.stdout?.on || typeof nonce !== "string" || !/^[a-f0-9]{32}$/.test(nonce) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 45000) fail(VALIDATION_FAILED);
  const begin = "SC_MANAGED_BEGIN:" + nonce, finish = "SC_MANAGED_END:" + nonce;
  let timer, started = false, finished = false, report = null, line = "", discardLine = false, bytes = 0, firstFailure = null;
  let resolveDone, rejectDone, rejectFatal;
  const pending = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; }); pending.catch(() => {});
  // A completed output frame cannot settle the independent write promise.
  // Keep failures live until BOTH original operations finish, without masking
  // a later timeout/consumer failure behind an already-resolved frame.
  const fatal = new Promise((_resolve, reject) => { rejectFatal = reject; }); fatal.catch(() => {});
  const refused = () => {
    if (firstFailure) return;
    firstFailure = new BackupError(VALIDATION_FAILED);
    rejectFatal(firstFailure); rejectDone(firstFailure);
  };
  const observe = row => {
    if (firstFailure) return;
    if (!started) { if (row === begin) started = true; return; }
    if (row === finish) {
      if (!report || finished) return refused();
      try { onReport(report); } catch { return refused(); }
      finished = true;
      resolveDone(report.sameActor && report.replicationOrigin && report.catalogueOk && report.foreignKeyViolations === 0);
      return;
    }
    if (row === "SET" || row === "DO") return;
    if (row === begin || report) return refused();
    try { report = validateManagedValidation(JSON.parse(row)); } catch { refused(); }
  };
  const data = chunk => {
    if (firstFailure) return;
    if (!(chunk instanceof Uint8Array)) return refused();
    bytes += chunk.byteLength;
    if (bytes > 1048576) return refused();
    for (const byte of chunk) {
      if (byte === 10) {
        if (!discardLine) observe(line.replace(/\r$/, ""));
        else if (started) refused();
        line = ""; discardLine = false;
      } else if (!discardLine) {
        if (byte > 127 || line.length >= 4096) { line = ""; discardLine = true; }
        else line += String.fromCharCode(byte);
      }
    }
  };
  const ended = () => refused();
  try {
    consumer.stdout.on("data", data); consumer.stdout.on("error", refused); consumer.stdout.on("end", ended); consumer.stdout.on("close", ended); consumer.on("error", refused); consumer.on("close", ended);
    timer = setTimeout(refused, timeoutMs);
    // Constant SQL with only a bounded ASCII nonce in separate psql echo lines.
    // Listener is active before the first write can produce any native output.
    const writing = Promise.resolve().then(() => write("\\echo " + begin + "\n" + MANAGED_VALIDATION_SQL + "\\echo " + finish + "\n"));
    writing.catch(refused);
    return (await Promise.race([Promise.all([pending, writing]), fatal]))[0];
  } catch { fail(VALIDATION_FAILED); }
  finally {
    clearTimeout(timer);
    consumer.stdout.removeListener("data", data); consumer.stdout.removeListener("error", refused); consumer.stdout.removeListener("end", ended); consumer.stdout.removeListener("close", ended); consumer.removeListener("error", refused); consumer.removeListener("close", ended);
  }
}

/** No CLI: Root supplies bound qualification to the separate managed stream.
 * Production ports always use native fs/spawn and the fixed current-SID helper.
 * The optional ports object is exclusively for hermetic RAM tests.
 */
export async function createManagedRestoreAdapters(options, ports = {}) {
  const selected = closed(options, ["privateRoot", "powerShellExecutable", "systemRoot", "forbiddenRoots", "syncRoots"], LIST_INVALID);
  for (const key of ["privateRoot", "powerShellExecutable", "systemRoot"]) if (typeof selected[key] !== "string" || !isAbsolute(selected[key]) || selected[key].startsWith("\\\\") || /[\r\n\0~]/.test(selected[key])) fail(LIST_INVALID);
  for (const key of ["forbiddenRoots", "syncRoots"]) if (!Array.isArray(selected[key]) || selected[key].some(value => typeof value !== "string" || !isAbsolute(value))) fail(LIST_INVALID);
  const fs = ports.fs ?? nativeFs, spawn = ports.spawn ?? nativeSpawn, random = ports.randomBytes ?? randomBytes;
  let root;
  try { root = await (ports.safeDirectory ?? safeBackupDirectory)(selected.privateRoot, { forbiddenRoots: selected.forbiddenRoots, syncRoots: selected.syncRoots }); } catch { fail(LIST_INVALID); }
  const timeoutMs = ports.timeoutMs ?? MANAGED_ADAPTER_DEADLINE_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MANAGED_ADAPTER_DEADLINE_MS) fail(LIST_INVALID);
  const deadline = performance.now() + timeoutMs;
  const remaining = () => { const value = Math.floor(deadline - performance.now()); if (value < 1) fail(LIST_INVALID); return value; };
  try { await assertAncestors(fs, root); } catch { fail(LIST_INVALID); }
  const directory = join(root, "managed-toc-" + random(16).toString("hex"));
  const owned = new Map(), operations = new Set(), cancel = new AbortController();
  let directoryIdentity, stopped = false, lastReport = null, ownedConsumer = null;
  const active = () => { if (stopped) fail(LIST_INVALID); remaining(); };
  const bounded = async promise => {
    let timer;
    try { return await Promise.race([promise, new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new BackupError(LIST_INVALID)), Math.max(1, Math.floor(deadline - performance.now()))); })]); }
    finally { clearTimeout(timer); }
  };
  const acl = ports.proveAcl ?? ((path, mode) => proveAcl({ path, mode, root, options: selected, spawn, signal: cancel.signal, remaining }));
  try {
    await bounded(fs.mkdir(directory, { recursive: false, mode: 0o700 }));
    directoryIdentity = await bounded(assertPlain(fs, directory, true));
    await bounded(acl(directory, "SecureDirectory"));
    if (!sameIdentity(directoryIdentity, await bounded(assertPlain(fs, directory, true)))) fail(LIST_INVALID);
  } catch {
    try { if (directoryIdentity && sameIdentity(directoryIdentity, await bounded(assertPlain(fs, directory, true)))) await bounded(fs.rmdir(directory)); } catch { /* only the newly owned empty directory */ }
    fail(LIST_INVALID);
  }
  const removeLists = async () => {
    stopped = true; cancel.abort();
    await bounded(Promise.allSettled([...operations]));
    let failure = false, safeDirectory = false;
    try { await bounded(assertAncestors(fs, directory)); safeDirectory = sameIdentity(directoryIdentity, await bounded(assertPlain(fs, directory, true))); }
    catch (error) { if (error?.code !== "ENOENT" || owned.size > 0) failure = true; }
    if (!safeDirectory && owned.size > 0) failure = true;
    for (const [path, record] of owned) {
      try {
        await bounded(record.handle?.close()); record.handle = null;
        if (!safeDirectory) continue;
        if (!record.identity || !sameIdentity(record.identity, await bounded(assertPlain(fs, path, false)))) { failure = true; continue; }
        await bounded(fs.unlink(path)); owned.delete(path);
      } catch { failure = true; }
    }
    try {
      if (safeDirectory) await bounded(fs.rmdir(directory));
    } catch (error) { if (error?.code !== "ENOENT") failure = true; }
    if (failure) fail(LIST_INVALID);
  };
  const materializeList = text => {
    const operation = (async () => {
      let record;
      try {
        active();
        if (typeof text !== "string" || !text || Buffer.byteLength(text) > 1048576 || /[^\x09\x0a\x0d\x20-\x7e]/.test(text)) fail(LIST_INVALID);
        await bounded(assertAncestors(fs, directory)); active();
        if (!sameIdentity(directoryIdentity, await bounded(assertPlain(fs, directory, true)))) fail(LIST_INVALID);
        const path = join(directory, "list-" + random(16).toString("hex") + ".toc");
        if (owned.has(path)) fail(LIST_INVALID);
        record = { handle: null, identity: null }; owned.set(path, record);
        record.handle = await bounded(fs.open(path, "wx", 0o600));
        record.identity = await bounded(record.handle.stat()); active();
        if (!record.identity.isFile() || !sameIdentity(record.identity, await bounded(assertPlain(fs, path, false)))) fail(LIST_INVALID);
        await bounded(acl(path, "VerifyFile")); active();
        await bounded(record.handle.writeFile(text, { encoding: "utf8" })); await bounded(record.handle.sync()); active();
        const actual = await bounded(fs.readFile(path));
        if (digest(actual) !== digest(text) || !sameIdentity(record.identity, await bounded(assertPlain(fs, path, false)))) fail(LIST_INVALID);
        await bounded(record.handle.close()); record.handle = null;
        return { path, sha256: digest(text), private: true };
      } catch {
        try { await bounded(record?.handle?.close()); if (record) record.handle = null; } catch { /* retained for owned cleanup */ }
        fail(LIST_INVALID);
      }
    })();
    operations.add(operation); operation.finally(() => operations.delete(operation)).catch(() => {});
    return operation;
  };
  return {
    materializeList, removeLists,
    spawn(executable, args, settings) {
      active();
      if (settings?.shell !== false || settings?.windowsHide !== true) fail(LIST_INVALID);
      const consumer = Array.isArray(args) && args.includes("--set=ON_ERROR_STOP=1");
      if (consumer && ownedConsumer) fail(VALIDATION_FAILED);
      const child = spawn(executable, args, settings);
      if (consumer) ownedConsumer = child;
      return child;
    },
    async checkBeforeCommit(context) {
      active();
      if (!ownedConsumer || context.consumer !== ownedConsumer) fail(VALIDATION_FAILED);
      return checkManagedBeforeCommit(context, { nonce: random(16).toString("hex"), timeoutMs: remaining(), onReport(value) { lastReport = value; } });
    },
    validationReport() { return lastReport; },
  };
}
