import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';

// PUBLIC DIAGNOSTIC ONLY. Import is inert. No backup/restore module is imported.
export const BINDING = Object.freeze({ nodeVersion: 'v24.19.0', nodeBytes: 92825416,
  nodeSha256: '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237',
  pgVersion: '18.4', pgBytes: 379392,
  pgSha256: 'e07bdb23f2d2a7e4d2db7a50386cd43049f4216540fa18e2faf79b80ab43ac18' });
// Raw Root-supplied PUBLIC metadata, not an official EDB ZIP signature/hash.
export const PG_MANIFEST_SHA256 = '4898ebc2a3390ef2d2d9627c30fccc919186fd9c9e1b1280c763be5c089be1f0';
export const PG_MANIFEST_PURPOSE = 'Observed public PostgreSQL 18 local executable and bin DLL byte pins; no private data inspected';
export const PG_MANIFEST_PROVENANCE = 'Local public PostgreSQL installation; does not attest a signature or digest of the complete EDB distribution';
export const LIMITS = Object.freeze({ caseMs: 45000, batchMs: 90000, tailBytes: 8388608,
  outputBytes: 65536, events: 64, manifestBytes: 65536, reportBytes: 65536 });
const HEADER_HEX = '5047444d5001100004080101' +
  '0017000000002a000000000f00000000100000000009000000007e0000000000000000' +
  '0008000000706f737467726573000400000031372e36000400000031382e34';
const ownRecord = value => {
  if (!value || typeof value !== 'object' || types.isProxy(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const out = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') return null;
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (!field || !('value' in field) || !field.enumerable) return null;
    out[key] = field.value;
  }
  return out;
};
const exact = (value, keys) => value && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const sha = value => createHash('sha256').update(value).digest('hex');
const refused = () => { throw new Error('PUBLIC_PROBE_REFUSED'); };

export function validatePgManifest(value) {
  const row = ownRecord(value);
  if (!exact(row, ['purpose', 'observedUtc', 'provenance', 'executed', 'files']) || row.executed !== false ||
      row.purpose !== PG_MANIFEST_PURPOSE || row.provenance !== PG_MANIFEST_PROVENANCE ||
      typeof row.observedUtc !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,7}Z$/.test(row.observedUtc) ||
      !Array.isArray(row.files) || types.isProxy(row.files) || row.files.length < 2 || row.files.length > 256) return null;
  const names = new Set(), files = []; let total = 0;
  for (let index = 0; index < row.files.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(row.files, String(index));
    const file = descriptor && 'value' in descriptor ? ownRecord(descriptor.value) : null;
    if (!exact(file, ['name', 'bytes', 'sha256', 'fileVersion', 'productVersion']) || typeof file.name !== 'string' ||
        !/^(?:pg_restore\.exe|[A-Za-z0-9][A-Za-z0-9_.-]{0,100}\.dll)$/.test(file.name) ||
        names.has(file.name.toLowerCase()) || !Number.isSafeInteger(file.bytes) || file.bytes < 1 ||
        file.bytes > 67108864 || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256) ||
        ![file.fileVersion, file.productVersion].every(version => version === null || typeof version === 'string' && /^[0-9., ]{1,40}$/.test(version))) return null;
    names.add(file.name.toLowerCase()); total += file.bytes;
    if (file.name === 'pg_restore.exe' && (file.fileVersion !== BINDING.pgVersion || file.productVersion !== BINDING.pgVersion)) return null;
    files.push(Object.freeze({ name: file.name, bytes: file.bytes, sha256: file.sha256 }));
  }
  if (Reflect.ownKeys(row.files).length !== row.files.length + 1 || total > 268435456) return null;
  const executable = files.find(file => file.name === 'pg_restore.exe');
  if (!executable || executable.bytes !== BINDING.pgBytes || executable.sha256 !== BINDING.pgSha256) return null;
  return Object.freeze({ schemaVersion: 1, purpose: row.purpose, postgresVersion: BINDING.pgVersion, files: Object.freeze(files) });
}

export function syntheticInput(name) {
  if (!['empty-toc-83', 'empty-toc-83-tail-8m'].includes(name)) refused();
  const prefix = Buffer.concat([Buffer.from(HEADER_HEX, 'hex'), Buffer.alloc(5)]);
  if (prefix.length !== 83) refused();
  return name === 'empty-toc-83' ? prefix : Buffer.concat([prefix, Buffer.alloc(LIMITS.tailBytes)]);
}

export function errorCode(error) {
  if (error === null || error === undefined) return 'none';
  if (typeof error !== 'object' || types.isProxy(error)) return 'unavailable';
  const code = Object.getOwnPropertyDescriptor(error, 'code');
  if (!code || !('value' in code) || typeof code.value !== 'string') return 'unavailable';
  return ['EOF', 'EPIPE', 'ERR_STREAM_DESTROYED'].includes(code.value) ? code.value : 'other';
}

const terminalCode = value => Number.isInteger(value) && value >= -65536 && value <= 255 ? value : null;
const signalCode = value => value === null ? 'none' : ['SIGKILL', 'SIGTERM', 'SIGINT'].includes(value) ? value : 'other';
const systemClock = Object.freeze({ now: () => performance.now(), set: (fn, ms) => setTimeout(fn, ms), clear: timer => clearTimeout(timer) });

// The seam runs THIS controller with public synthetic streams; it confers no
// native qualification. An ACK/error code never substitutes for any terminal.
export async function runPublicCase(name, executable, environment, batchDeadline, ports = {}) {
  const clock = ports.clock ?? systemClock, start = clock.now();
  const deadline = Math.min(batchDeadline, start + LIMITS.caseMs);
  const input = syntheticInput(name), events = [], cleanup = { requested: false, closeObserved: false };
  let child = null, sequence = 0, overflow = false, firstError = null, phase = 'native', timer = null;
  let deadlineExpired = false, quotaExceeded = false, childError = false, unclassifiedErrorSeen = false;
  const facts = { spawn: false, callbackSeen: false, callbackCode: 'unavailable', stdinFinish: false,
    stdinClose: false, stdoutEOF: false, stdoutClose: false, stderrEOF: false, stderrClose: false,
    exitSeen: false, exitCode: null, exitSignal: 'none', closeSeen: false, closeCode: null,
    closeSignal: 'none', stdoutBytes: 0, stderrBytes: 0 };
  let wake;
  const settled = new Promise(resolveSettled => { wake = resolveSettled; });
  const complete = () => facts.spawn && facts.callbackSeen && facts.stdinClose && facts.stdoutEOF && facts.stdoutClose &&
    facts.stderrEOF && facts.stderrClose && facts.exitSeen && facts.closeSeen;
  const record = (event, error = undefined) => {
    sequence = Math.min(sequence + 1, Number.MAX_SAFE_INTEGER);
    const code = error === undefined ? 'none' : errorCode(error);
    if (phase === 'native' && ['other', 'unavailable'].includes(code)) unclassifiedErrorSeen = true;
    if (events.length < LIMITS.events) events.push(Object.freeze({ sequence, phase, event, code })); else overflow = true;
    if (phase === 'native' && error !== undefined && code !== 'none' && firstError === null) firstError = Object.freeze({ sequence, event, code });
  };
  const check = () => { if (complete() || childError) wake(); };
  const listeners = [];
  const on = (emitter, event, callback) => { emitter.on(event, callback); listeners.push([emitter, event, callback]); };
  try {
    if (!Number.isFinite(batchDeadline) || clock.now() >= deadline) { deadlineExpired = true; return snapshot(); }
    timer = clock.set(() => { deadlineExpired = true; record('deadline'); wake(); }, Math.max(1, deadline - clock.now()));
    child = (ports.spawn ?? spawn)(executable, ['--list', '--verbose'], { shell: false, windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'], cwd: environment.cwd, env: environment.env });
    if (!child || typeof child.on !== 'function' || !child.stdin?.end || !child.stdout?.on || !child.stderr?.on) refused();
    on(child, 'spawn', () => { facts.spawn = true; record('spawn'); check(); });
    on(child, 'error', error => { childError = true; record('childError', error); check(); });
    on(child, 'exit', (code, signal) => { facts.exitSeen = true; facts.exitCode = terminalCode(code); facts.exitSignal = signalCode(signal); record('exit'); check(); });
    on(child, 'close', (code, signal) => { facts.closeSeen = true; facts.closeCode = terminalCode(code); facts.closeSignal = signalCode(signal); if (phase === 'cleanup') cleanup.closeObserved = true; record('close'); check(); });
    on(child.stdin, 'error', error => record('stdinError', error));
    on(child.stdin, 'finish', () => { facts.stdinFinish = true; record('stdinFinish'); });
    on(child.stdin, 'close', () => { facts.stdinClose = true; record('stdinClose'); check(); });
    for (const streamName of ['stdout', 'stderr']) {
      on(child[streamName], 'data', value => {
        if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) { quotaExceeded = true; record('outputTypeRefused'); return; }
        const key = streamName + 'Bytes'; facts[key] = Math.min(Number.MAX_SAFE_INTEGER, facts[key] + value.byteLength);
        if (facts[key] > LIMITS.outputBytes && !quotaExceeded) { quotaExceeded = true; record('outputQuota'); }
        // No content retained, decoded or printed.
      });
      on(child[streamName], 'error', error => record(streamName + 'Error', error));
      on(child[streamName], 'end', () => { facts[streamName + 'EOF'] = true; record(streamName + 'EOF'); check(); });
      on(child[streamName], 'close', () => { facts[streamName + 'Close'] = true; record(streamName + 'Close'); check(); });
    }
    record('stdinEndRequested');
    child.stdin.end(input, error => { facts.callbackSeen = true; facts.callbackCode = errorCode(error); record('stdinCallback', error ?? null); check(); });
    await settled;
    if (clock.now() >= deadline) deadlineExpired = true;
  } catch {
    childError = true; record('controllerRefused');
  } finally {
    if (timer !== null) clock.clear(timer);
    if (!complete() || deadlineExpired || childError) {
      phase = 'cleanup'; cleanup.requested = child !== null;
      if (child) for (const key of ['stdin', 'stdout', 'stderr']) { try { child[key]?.destroy?.(); record(key + 'DestroyRequested'); } catch { record('cleanupRefused'); } }
      try { child?.kill?.('SIGKILL'); if (child) record('killRequested'); } catch { record('cleanupRefused'); }
      try { child?.unref?.(); } catch { /* No terminal inferred. */ }
    }
    input.fill(0);
    // Unconfirmed owned children retain error listeners: a late native error
    // must not become an unhandled exception after the closed snapshot.
    // Keep owned error listeners even after a successful snapshot: Writable
    // may emit its original error after invoking an error-bearing callback.
    if (!cleanup.requested) for (const [emitter, event, callback] of listeners) if (event !== 'error') emitter.removeListener(event, callback);
  }
  return snapshot();

  function snapshot() {
    const naturalComplete = complete() && !cleanup.requested && !deadlineExpired && !childError;
    const ownedState = child === null ? 'NOT_STARTED' : naturalComplete ? 'NATURAL_TERMINALS_OBSERVED' :
      cleanup.requested && facts.closeSeen && facts.exitSeen && facts.stdinClose && facts.stdoutClose && facts.stderrClose ?
        'CLEANUP_TERMINALS_OBSERVED' : 'CLEANUP_UNCONFIRMED';
    return Object.freeze({ schemaVersion: 1, case: name, diagnosticOnly: true, privateInspection: false,
      restoreAccepted: false, executed: child !== null, ownedState, inputBytes: input.length, naturalComplete,
      outcome: naturalComplete && !quotaExceeded && !overflow && !unclassifiedErrorSeen &&
        facts.exitCode !== null && facts.closeCode !== null && facts.exitSignal !== 'other' && facts.closeSignal !== 'other' ? 'OBSERVED' : 'INCONCLUSIVE',
      deadlineExpired, quotaExceeded, unclassifiedErrorSeen, eventOverflow: overflow, firstError,
      facts: Object.freeze({ ...facts }), cleanup: Object.freeze({ ...cleanup }), events: Object.freeze([...events]) });
  }
}

export async function runPublicBatch(executable, environment, ports = {}) {
  const clock = ports.clock ?? systemClock, deadline = clock.now() + LIMITS.batchMs;
  const cases = []; let stopped = false;
  for (const name of ['empty-toc-83', 'empty-toc-83-tail-8m']) {
    if (stopped) {
      cases.push(Object.freeze({ schemaVersion: 1, case: name, diagnosticOnly: true, privateInspection: false,
        restoreAccepted: false, executed: false, ownedState: 'NOT_STARTED', outcome: 'NOT_EXECUTED', reason: 'PREVIOUS_CASE_INCONCLUSIVE' }));
      continue;
    }
    const observation = await runPublicCase(name, executable, environment, deadline, ports);
    cases.push(observation);
    // An awaited refusal does not certify EOF/absence of the previous child.
    // Never start another producer after ANY inconclusive observation.
    stopped = observation.outcome !== 'OBSERVED' || observation.ownedState !== 'NATURAL_TERMINALS_OBSERVED';
  }
  return Object.freeze({ schemaVersion: 1, purpose: 'PUBLIC_WINDOWS_PG18_STDIN_DIAGNOSTIC', diagnosticOnly: true,
    privateInspection: false, restoreAccepted: false, executedCases: cases.filter(row => row.executed).length,
    notExecutedCases: cases.filter(row => !row.executed).length,
    unconfirmedOwnedChildren: cases.filter(row => row.ownedState === 'CLEANUP_UNCONFIRMED').length,
    outcome: cases.every(row => row.outcome === 'OBSERVED') ? 'OBSERVED' : 'INCONCLUSIVE', cases: Object.freeze(cases) });
}

async function checkedFile(path, bytes, expectedSha) {
  if (!isAbsolute(path)) refused();
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes) refused();
  const value = await readFile(path);
  const accepted = value.length === bytes && sha(value) === expectedSha; value.fill(0);
  if (!accepted) refused();
}

async function executeCli(arguments_) {
  if (arguments_.length !== 5 || arguments_[0] !== '--execute-public-probe' || arguments_[1] !== '--binding' || arguments_[3] !== '--report') refused();
  if (process.platform !== 'win32' || process.arch !== 'x64' || process.version !== BINDING.nodeVersion ||
      process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_OS !== 'Windows' ||
      process.env.GITHUB_REPOSITORY !== 'kauanbarateli/Segundo-Cerebro' || PG_MANIFEST_SHA256 === null ||
      !/^[A-Za-z]:\\Windows$/i.test(process.env.SystemRoot ?? '') || !/^\d{8}\.\d{1,6}\.\d{1,6}$/.test(process.env.ImageVersion ?? '')) refused();
  const bindingPath = resolve(arguments_[2]), reportPath = resolve(arguments_[4]);
  const bindingStat = await lstat(bindingPath);
  if (!bindingStat.isFile() || bindingStat.isSymbolicLink() || bindingStat.size > LIMITS.manifestBytes) refused();
  const binding = ownRecord(JSON.parse(await readFile(bindingPath, 'utf8')));
  if (!exact(binding, ['schemaVersion', 'purpose', 'workRoot', 'nodePath', 'binPath', 'manifestPath', 'manifestSha256', 'zipBytes', 'zipSha256']) ||
      binding.schemaVersion !== 1 || binding.purpose !== 'PUBLIC_PG18_PROVISIONED_SELECTED_FILES' ||
      binding.manifestSha256 !== PG_MANIFEST_SHA256 || !Number.isSafeInteger(binding.zipBytes) || binding.zipBytes < 1 ||
      typeof binding.zipSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(binding.zipSha256)) refused();
  for (const key of ['workRoot', 'nodePath', 'binPath', 'manifestPath']) if (typeof binding[key] !== 'string' || !isAbsolute(binding[key]) || /[\r\n\0]/.test(binding[key])) refused();
  if (resolve(binding.nodePath).toLowerCase() !== resolve(process.execPath).toLowerCase() ||
      reportPath.toLowerCase() !== join(binding.workRoot, 'public-probe-report.json').toLowerCase() ||
      binding.binPath.toLowerCase() !== join(binding.workRoot, 'bin').toLowerCase() ||
      binding.manifestPath.toLowerCase() !== join(dirname(fileURLToPath(import.meta.url)), 'pg18-public-manifest.json').toLowerCase() ||
      bindingPath.toLowerCase() !== join(binding.workRoot, 'public-probe-binding.json').toLowerCase()) refused();
  const manifestStat = await lstat(binding.manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > LIMITS.manifestBytes) refused();
  const manifestBytes = await readFile(binding.manifestPath);
  if (sha(manifestBytes) !== PG_MANIFEST_SHA256) refused();
  const manifest = validatePgManifest(JSON.parse(manifestBytes.toString('utf8'))); manifestBytes.fill(0);
  if (!manifest) refused();
  await checkedFile(process.execPath, BINDING.nodeBytes, BINDING.nodeSha256);
  for (const file of manifest.files) await checkedFile(join(binding.binPath, file.name), file.bytes, file.sha256);
  const executable = join(binding.binPath, 'pg_restore.exe');
  const environment = { cwd: binding.workRoot, env: { SystemRoot: process.env.SystemRoot,
    PATH: binding.binPath + ';' + join(process.env.SystemRoot, 'System32') } };
  const version = spawnSync(executable, ['--version'], { shell: false, windowsHide: true, cwd: environment.cwd,
    env: environment.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000, maxBuffer: 1024 });
  if (version.error || version.status !== 0 || version.signal !== null || !Buffer.isBuffer(version.stdout) ||
      !/^pg_restore \(PostgreSQL\) 18\.4\r?\n$/.test(version.stdout.toString('utf8')) || version.stderr?.length !== 0) refused();
  version.stdout.fill(0); version.stderr.fill(0);
  const observation = await runPublicBatch(executable, environment);
  const report = { ...observation, binding: { nodeVersion: BINDING.nodeVersion, nodeSha256: BINDING.nodeSha256,
    pgVersion: BINDING.pgVersion, pgExeSha256: BINDING.pgSha256, manifestSha256: PG_MANIFEST_SHA256, runnerImageVersion: process.env.ImageVersion,
    selectedFiles: manifest.files.length, zipBytes: binding.zipBytes, zipSha256: binding.zipSha256,
    zipAuthority: 'HTTPS_EDB_SELECTED_FILES_MATCH_PUBLIC_PINS_NOT_VENDOR_ZIP_SIGNATURE' } };
  const output = JSON.stringify(report) + '\n';
  if (Buffer.byteLength(output) > LIMITS.reportBytes) refused();
  await writeFile(reportPath, output, { flag: 'wx', mode: 0o600 });
  process.stdout.write(output);
  return report.outcome === 'OBSERVED' && report.cases.every(row => row.executed && row.facts.exitCode === 0 && row.facts.closeCode === 0 &&
    row.facts.exitSignal === 'none' && row.facts.closeSignal === 'none') ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 2) process.stdout.write('{"schemaVersion":1,"executed":false,"restoreAccepted":false}\n');
  else executeCli(process.argv.slice(2)).then(code => { process.exitCode = code; }, () => {
    process.stdout.write('{"schemaVersion":1,"outcome":"PUBLIC_PROBE_REFUSED","restoreAccepted":false}\n'); process.exitCode = 1;
  });
}
