import { createHash } from 'node:crypto';
import { lstat, realpath, open, mkdir, unlink, rmdir, writeFile } from 'node:fs/promises';
import { win32, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';
import { BINDING, PG_MANIFEST_SHA256, validatePgManifest, runPublicBatch } from './public-pg18-stdin-probe.mjs';

// Import is inert. This local diagnostic never imports a backup/restore module.
export const LOCAL = Object.freeze({ baseSha: '0259d0cd78acc6286cf2c452c6d4cec7b330b05d',
  baseTree: 'ff47deeef569277008fe01d114760529d48d4955', nodePath: 'C:\\Program Files\\nodejs\\node.exe',
  binPath: 'C:\\Program Files\\PostgreSQL\\18\\bin', systemRoot: 'C:\\Windows',
  controllerBytes: 19070, controllerSha256: '38c2410896c7e2874cc5b739f2c01f7ac562c6af53a3502d198037f25f69d3b9',
  manifestBytes: 7136, reportBytes: 65536 });
const purpose = 'LOCAL_WINDOWS_PG18_PUBLIC_STDIN_DIAGNOSTIC_NOT_RESTORE';
const phases = new Set(['runtime', 'paths', 'sources', 'pins', 'ownership', 'native', 'cleanup', 'output']);
const codes = new Set(['LOCAL_RUNTIME_REFUSED', 'LOCAL_PATH_REFUSED', 'LOCAL_SOURCE_REFUSED', 'LOCAL_PIN_REFUSED',
  'LOCAL_OWNERSHIP_REFUSED', 'LOCAL_NATIVE_REFUSED', 'LOCAL_NATIVE_INCONCLUSIVE', 'LOCAL_CLEANUP_REFUSED', 'LOCAL_OUTPUT_REFUSED']);
class LocalRefusal extends Error { constructor(code) { super(code); this.code = code; } }
const refuse = code => { throw new LocalRefusal(code); };
const own = value => {
  if (!value || typeof value !== 'object' || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const row = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
    row[key] = descriptor.value;
  }
  return row;
};
const exact = (row, keys) => row && Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key));
const samePath = (a, b) => a.toLowerCase() === b.toLowerCase();

export function validateLocalRuntime(value) {
  const row = own(value);
  if (!exact(row, ['platform', 'arch', 'version', 'execPath', 'systemRoot', 'githubActions', 'nodeOptions', 'nodePath']) ||
      row.platform !== 'win32' || row.arch !== 'x64' || row.version !== BINDING.nodeVersion ||
      typeof row.execPath !== 'string' || !samePath(row.execPath, LOCAL.nodePath) || row.systemRoot !== LOCAL.systemRoot ||
      row.githubActions !== '' || row.nodeOptions !== '' || row.nodePath !== '') return false;
  return true;
}

export function localPaths(value) {
  const row = own(value);
  if (!exact(row, ['parent', 'root']) || typeof row.parent !== 'string' || typeof row.root !== 'string') return null;
  for (const path of [row.parent, row.root]) {
    if (!/^C:\\[^\r\n\0]*$/.test(path) || path.includes('/') || path.slice(2).includes(':') ||
        /(?:^|\\)\.{1,2}(?:\\|$)/.test(path) || !samePath(win32.normalize(path), path)) return null;
  }
  if (!samePath(win32.dirname(row.root), row.parent) || !/^sc-local-pg18-[a-f0-9]{32}$/.test(win32.basename(row.root))) return null;
  return Object.freeze({ parent: row.parent, root: row.root, report: row.root + '.json', marker: win32.join(row.root, 'public-owned-marker.json') });
}

export function publicPgEnvironment() {
  return Object.freeze({ SystemRoot: LOCAL.systemRoot, PATH: LOCAL.binPath + ';' + win32.join(LOCAL.systemRoot, 'System32') });
}

export function validateLocalManifest(value) {
  const row = own(value);
  if (!row || types.isProxy(row.files) || !Array.isArray(row.files)) return null;
  const manifest = validatePgManifest(value);
  return manifest && manifest.files.length === 30 ? manifest : null;
}

export function isMissingEntry(error) {
  if (!error || typeof error !== 'object' || types.isProxy(error)) return false;
  const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
  return Boolean(descriptor && 'value' in descriptor && descriptor.value === 'ENOENT');
}

// The original controller, not a caller/JSON report, supplies operational facts.
export function localBatchDisposition(value) {
  const row = own(value);
  if (!exact(row, ['schemaVersion', 'purpose', 'diagnosticOnly', 'privateInspection', 'restoreAccepted', 'executedCases', 'notExecutedCases', 'unconfirmedOwnedChildren', 'outcome', 'cases']) ||
      row.schemaVersion !== 1 || row.purpose !== 'PUBLIC_WINDOWS_PG18_STDIN_DIAGNOSTIC' || row.diagnosticOnly !== true ||
      row.privateInspection !== false || row.restoreAccepted !== false || types.isProxy(row.cases) || !Array.isArray(row.cases)) return null;
  const length = Object.getOwnPropertyDescriptor(row.cases, 'length');
  if (!length || length.value !== 2 || Reflect.ownKeys(row.cases).length !== 3) return null;
  let natural = true, closed = true, allOriginalObserved = true, executed = 0, notExecuted = 0, unknown = 0;
  for (let index = 0; index < 2; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(row.cases, String(index));
    const item = descriptor && 'value' in descriptor ? own(descriptor.value) : null;
    if (!item || item.schemaVersion !== 1 || item.case !== ['empty-toc-83', 'empty-toc-83-tail-8m'][index] ||
        item.diagnosticOnly !== true || item.privateInspection !== false || item.restoreAccepted !== false || typeof item.executed !== 'boolean') return null;
    if (item.executed) executed += 1; else notExecuted += 1;
    if (!['NOT_STARTED', 'NATURAL_TERMINALS_OBSERVED', 'CLEANUP_TERMINALS_OBSERVED', 'CLEANUP_UNCONFIRMED'].includes(item.ownedState)) return null;
    if (item.ownedState === 'CLEANUP_UNCONFIRMED') { unknown += 1; closed = false; }
    if (!item.executed && (item.ownedState !== 'NOT_STARTED' || item.outcome !== 'NOT_EXECUTED')) return null;
    if (item.executed && item.ownedState === 'NOT_STARTED') return null;
    if (item.outcome !== 'OBSERVED') allOriginalObserved = false;
    if (item.outcome !== 'OBSERVED' || item.ownedState !== 'NATURAL_TERMINALS_OBSERVED' || item.naturalComplete !== true) natural = false;
    if (item.executed) {
      const facts = own(item.facts);
      if (!facts || facts.exitCode !== 0 || facts.closeCode !== 0 || facts.exitSignal !== 'none' || facts.closeSignal !== 'none') natural = false;
    }
  }
  if (row.executedCases !== executed || row.notExecutedCases !== notExecuted || row.unconfirmedOwnedChildren !== unknown ||
      !['OBSERVED', 'INCONCLUSIVE'].includes(row.outcome) || (row.outcome === 'OBSERVED') !== allOriginalObserved) return null;
  return Object.freeze({ observed: natural && row.outcome === 'OBSERVED', cleanupAllowed: closed, unconfirmedOwnedChildren: unknown });
}

export function localRefusal(phase, code) {
  return Object.freeze({ phase: phases.has(phase) ? phase : 'runtime', code: codes.has(code) ? code : 'LOCAL_RUNTIME_REFUSED' });
}

async function noReparse(path) {
  if (!win32.isAbsolute(path) || path.includes('/') || /[\r\n\0]/.test(path)) refuse('LOCAL_PATH_REFUSED');
  let current = path;
  while (true) {
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !samePath(await realpath(current), current)) refuse('LOCAL_PATH_REFUSED');
    const parent = win32.dirname(current); if (parent === current) break; current = parent;
  }
}

async function checkedFile(path, expectedBytes, expectedSha) {
  await noReparse(path);
  const handle = await open(path, 'r'), buffer = Buffer.alloc(65536), hash = createHash('sha256');
  let total = 0;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size !== expectedBytes) refuse('LOCAL_PIN_REFUSED');
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null); if (bytesRead === 0) break;
      total += bytesRead; if (total > expectedBytes) refuse('LOCAL_PIN_REFUSED'); hash.update(buffer.subarray(0, bytesRead));
    }
    if (total !== expectedBytes || hash.digest('hex') !== expectedSha) refuse('LOCAL_PIN_REFUSED');
  } finally { buffer.fill(0); await handle.close(); }
}

async function assertAbsent(path) {
  try { await lstat(path); } catch (error) { if (isMissingEntry(error)) return; throw error; }
  refuse('LOCAL_OWNERSHIP_REFUSED');
}

async function executeLocal(arguments_) {
  let phase = 'runtime', firstRefusal = null, batch = null, disposition = null, names = null;
  let owned = false, markerCreated = false, nativeStarted = false;
  let sourcePinsVerified = false, nodePinVerified = false, verifiedSelectedFiles = 0, wrapperObservedSha256 = null;
  let cleanup = { attempted: false, ownedRootRemoved: false, absenceConfirmed: false, blockedByUnconfirmedChild: false, failure: null };
  const marker = '{"purpose":"LOCAL_PUBLIC_PG18_OWNED_EMPTY_CWD","privateData":false}\n';
  try {
    if (arguments_.length !== 1 || arguments_[0] !== '--execute-local-public-probe' || !validateLocalRuntime({
      platform: process.platform, arch: process.arch, version: process.version, execPath: process.execPath,
      systemRoot: process.env.SystemRoot ?? '', githubActions: process.env.GITHUB_ACTIONS ?? '',
      nodeOptions: process.env.NODE_OPTIONS ?? '', nodePath: process.env.NODE_PATH ?? '' })) refuse('LOCAL_RUNTIME_REFUSED');
    const environmentKeys = Object.keys(process.env).map(key => key.toLowerCase()).sort();
    if (environmentKeys.join('|') !== ['path', 'sc_local_probe_parent', 'sc_local_probe_root', 'systemroot'].join('|')) refuse('LOCAL_RUNTIME_REFUSED');
    phase = 'paths'; names = localPaths({ parent: process.env.SC_LOCAL_PROBE_PARENT, root: process.env.SC_LOCAL_PROBE_ROOT });
    if (!names) refuse('LOCAL_PATH_REFUSED'); await noReparse(names.parent); await assertAbsent(names.root); await assertAbsent(names.report);
    phase = 'sources';
    const controller = fileURLToPath(new URL('./public-pg18-stdin-probe.mjs', import.meta.url));
    const manifestPath = fileURLToPath(new URL('./pg18-public-manifest.json', import.meta.url));
    await checkedFile(controller, LOCAL.controllerBytes, LOCAL.controllerSha256);
    await checkedFile(manifestPath, LOCAL.manifestBytes, PG_MANIFEST_SHA256);
    sourcePinsVerified = true;
    const selfPath = fileURLToPath(import.meta.url); await noReparse(selfPath);
    const selfHandle = await open(selfPath, 'r'); let selfBytes;
    try {
      if ((await selfHandle.stat()).size > LOCAL.reportBytes) refuse('LOCAL_SOURCE_REFUSED');
      selfBytes = await selfHandle.readFile(); wrapperObservedSha256 = createHash('sha256').update(selfBytes).digest('hex');
    } finally { if (selfBytes) selfBytes.fill(0); await selfHandle.close(); }
    const manifestHandle = await open(manifestPath, 'r'); let manifestBytes;
    try { manifestBytes = await manifestHandle.readFile(); } finally { await manifestHandle.close(); }
    let manifest;
    try {
      if (manifestBytes.length !== LOCAL.manifestBytes || createHash('sha256').update(manifestBytes).digest('hex') !== PG_MANIFEST_SHA256) refuse('LOCAL_SOURCE_REFUSED');
      manifest = validateLocalManifest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)));
    }
    finally { manifestBytes.fill(0); }
    if (!manifest || manifest.files.length !== 30) refuse('LOCAL_SOURCE_REFUSED');
    phase = 'pins'; await checkedFile(process.execPath, BINDING.nodeBytes, BINDING.nodeSha256); nodePinVerified = true;
    for (const file of manifest.files) { await checkedFile(win32.join(LOCAL.binPath, file.name), file.bytes, file.sha256); verifiedSelectedFiles += 1; }
    phase = 'ownership'; await mkdir(names.root); owned = true; await noReparse(names.root);
    await writeFile(names.marker, marker, { flag: 'wx', mode: 0o600 }); markerCreated = true;
    phase = 'native'; nativeStarted = true;
    batch = await runPublicBatch(win32.join(LOCAL.binPath, 'pg_restore.exe'), { cwd: names.root, env: publicPgEnvironment() });
    disposition = localBatchDisposition(batch);
    if (!disposition) refuse('LOCAL_NATIVE_REFUSED');
    if (!disposition.observed) refuse('LOCAL_NATIVE_INCONCLUSIVE');
  } catch (error) {
    firstRefusal = localRefusal(phase, error instanceof LocalRefusal ? error.code : ({
      runtime: 'LOCAL_RUNTIME_REFUSED', paths: 'LOCAL_PATH_REFUSED', sources: 'LOCAL_SOURCE_REFUSED', pins: 'LOCAL_PIN_REFUSED',
      ownership: 'LOCAL_OWNERSHIP_REFUSED', native: 'LOCAL_NATIVE_REFUSED' })[phase]);
  } finally {
    if (owned) {
      if (nativeStarted && (!disposition || !disposition.cleanupAllowed)) {
        cleanup = { ...cleanup, blockedByUnconfirmedChild: true, failure: 'LOCAL_CLEANUP_REFUSED' };
      } else {
        cleanup.attempted = true;
        try {
          await noReparse(names.root);
          if (markerCreated) {
            await checkedFile(names.marker, Buffer.byteLength(marker), createHash('sha256').update(marker).digest('hex'));
            await unlink(names.marker);
          }
          // rmdir is intentionally NON-recursive. Unexpected files survive a refusal.
          await rmdir(names.root); cleanup.ownedRootRemoved = true; await assertAbsent(names.root); cleanup.absenceConfirmed = true;
        } catch { cleanup.failure = 'LOCAL_CLEANUP_REFUSED'; }
      }
      if (cleanup.failure && firstRefusal === null) firstRefusal = localRefusal('cleanup', 'LOCAL_CLEANUP_REFUSED');
    }
  }
  const report = { schemaVersion: 1, purpose, diagnosticOnly: true, privateInspection: false, restoreAccepted: false,
    status: firstRefusal === null ? 'OBSERVED' : 'REFUSED', firstRefusal,
    binding: { origin: 'LOCAL_INSTALLED_PUBLIC_BYTE_PINS_NOT_EDB_ZIP_OR_GITHUB_RUNNER', baseSha: LOCAL.baseSha, baseTree: LOCAL.baseTree,
      controllerSha256: LOCAL.controllerSha256, manifestSha256: PG_MANIFEST_SHA256, sourcePinsVerified, wrapperObservedSha256,
      nodePinVerified, nodeVersion: BINDING.nodeVersion,
      nodeSha256: BINDING.nodeSha256, pgVersion: BINDING.pgVersion, pgExeSha256: BINDING.pgSha256,
      expectedSelectedFiles: 30, verifiedSelectedFiles, zipAuthenticated: false, runnerAttested: false, restoreAuthority: false }, batch, cleanup };
  let output = JSON.stringify(report) + '\n';
  if (Buffer.byteLength(output) > LOCAL.reportBytes) {
    if (firstRefusal === null) firstRefusal = localRefusal('output', 'LOCAL_OUTPUT_REFUSED');
    output = JSON.stringify({ schemaVersion: 1, purpose, status: 'REFUSED', firstRefusal,
      outputRefused: true, diagnosticOnly: true, privateInspection: false, restoreAccepted: false, cleanup }) + '\n';
  }
  if (names) {
    try { await noReparse(names.parent); await writeFile(names.report, output, { flag: 'wx', mode: 0o600 }); }
    catch {
      const failure = { ...report, status: 'REFUSED', firstRefusal: firstRefusal ?? localRefusal('output', 'LOCAL_OUTPUT_REFUSED'), outputRefused: true };
      const failureOutput = JSON.stringify(failure) + '\n';
      process.stdout.write(Buffer.byteLength(failureOutput) <= LOCAL.reportBytes ? failureOutput : JSON.stringify({
        schemaVersion: 1, purpose, status: 'REFUSED', firstRefusal: failure.firstRefusal, outputRefused: true,
        diagnosticOnly: true, privateInspection: false, restoreAccepted: false, cleanup }) + '\n'); return 1;
    }
  }
  process.stdout.write(output);
  return firstRefusal === null && owned && cleanup.absenceConfirmed && !cleanup.failure ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 2) process.stdout.write('{"schemaVersion":1,"executed":false,"restoreAccepted":false}\n');
  else executeLocal(process.argv.slice(2)).then(code => { process.exitCode = code; }, () => {
    process.stdout.write('{"schemaVersion":1,"purpose":"LOCAL_WINDOWS_PG18_PUBLIC_STDIN_DIAGNOSTIC_NOT_RESTORE","status":"REFUSED","restoreAccepted":false}\n'); process.exitCode = 1;
  });
}
