import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { BINDING, LIMITS, PG_MANIFEST_SHA256, PG_MANIFEST_PURPOSE, PG_MANIFEST_PROVENANCE, errorCode, runPublicCase, runPublicBatch, syntheticInput, validatePgManifest } from './public-pg18-stdin-probe.mjs';

// Synthetic QA exercises the original public controller, NOT a native proof.
const environment = { cwd: 'C:\\public-owned', env: { SystemRoot: 'C:\\Windows', PATH: 'C:\\public-owned\\bin;C:\\Windows\\System32' } };
function clock() {
  let time = 0, next = 1; const timers = new Map(), delays = [];
  return { now: () => time, set(fn, ms) { const key = next++; timers.set(key, { fn, at: time + ms }); delays.push(ms); return key; },
    clear(key) { timers.delete(key); }, advance(ms) { time += ms; for (const [key, timer] of [...timers]) if (timer.at <= time) { timers.delete(key); timer.fn(); } }, delays };
}
function fixture(action) {
  const child = new EventEmitter(), calls = [], operations = [], inputCopies = [];
  for (const key of ['stdin', 'stdout', 'stderr']) {
    child[key] = new EventEmitter(); child[key].destroy = () => { operations.push(key + ':destroy'); child[key].emit('close'); };
  }
  child.kill = signal => { operations.push('kill:' + signal); return true; };
  child.unref = () => operations.push('unref');
  child.stdin.end = (input, callback) => { inputCopies.push(Buffer.from(input)); queueMicrotask(() => { child.emit('spawn'); action(child, callback); }); };
  return { child, calls, operations, inputCopies, spawn(executable, args, options) { calls.push({ executable, args, options }); return child; } };
}
function natural(child, callback, code = null) {
  callback(code); if (code === null) child.stdin.emit('finish'); child.stdout.emit('data', Buffer.from('PUBLIC TOC\r\n'));
  child.stdout.emit('end'); child.stdout.emit('close'); child.stderr.emit('end'); child.stderr.emit('close');
  child.emit('exit', 0, null); child.emit('close', 0, null); child.stdin.emit('close');
}
const manifest = () => ({ purpose: PG_MANIFEST_PURPOSE, provenance: PG_MANIFEST_PROVENANCE, executed: false,
  observedUtc: '2026-10-22T13:38:13.113Z', files: [
    { name: 'pg_restore.exe', bytes: BINDING.pgBytes, sha256: BINDING.pgSha256, fileVersion: '18.4', productVersion: '18.4' },
    { name: 'public-runtime.dll', bytes: 10, sha256: 'a'.repeat(64), fileVersion: null, productVersion: null }] });

test('import fixes public selected-file metadata without executing a binary or granting restore authority', () => {
  assert.equal(PG_MANIFEST_SHA256, '4898ebc2a3390ef2d2d9627c30fccc919186fd9c9e1b1280c763be5c089be1f0'); assert.equal(BINDING.nodeVersion, 'v24.19.0');
  assert.equal(BINDING.nodeSha256, '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237');
});
test('actual Root public metadata stays byte-pinned and passes the same original validator', async () => {
  const bytes = await readFile(new URL('./pg18-public-manifest.json', import.meta.url));
  assert.equal(bytes.length, 7136); assert.equal(createHash('sha256').update(bytes).digest('hex'), PG_MANIFEST_SHA256);
  const value = validatePgManifest(JSON.parse(bytes.toString('utf8')));
  assert.equal(value.files.length, 30); assert.equal(value.postgresVersion, '18.4'); bytes.fill(0);
});
test('public inputs preserve the literal83B TOC and add only8MiB zero tail', () => {
  const small = syntheticInput('empty-toc-83'), large = syntheticInput('empty-toc-83-tail-8m');
  assert.equal(small.length, 83); assert.equal(small.subarray(0, 5).toString('ascii'), 'PGDMP');
  assert.deepEqual(small.subarray(78), Buffer.alloc(5)); assert.equal(large.length, 83 + 8388608);
  assert.deepEqual(large.subarray(0, 83), small); assert.equal(large.subarray(83).some(value => value !== 0), false);
  assert.throws(() => syntheticInput('private-archive')); small.fill(0); large.fill(0);
});
test('selected manifest rejects drift, unknown versions, paths, aliases and missing DLL closure', () => {
  assert.equal(validatePgManifest(manifest()).files.length, 2);
  for (const alter of [row => { row.files[0].productVersion = '18.6'; }, row => { row.extra = true; },
    row => { row.executed = true; }, row => { row.provenance = 'OFFICIAL_ZIP_SIGNATURE'; },
    row => { row.files[0].sha256 = 'b'.repeat(64); }, row => { row.files[0].bytes += 1; },
    row => { row.files[1].name = '../private.dll'; }, row => { row.files[1].name = 'secret.exe'; },
    row => { row.files.push({ ...row.files[1], name: 'PUBLIC-RUNTIME.DLL' }); }, row => { row.files.pop(); },
    row => { row.files[1].bytes = 0; }, row => { row.files[1].sha256 = 'A'.repeat(64); },
    row => { row.files = [row.files[0], , row.files[1]]; }, row => { row.files.extra = 'CANARY'; }]) {
    const value = manifest(); alter(value); assert.equal(validatePgManifest(value), null);
  }
});
test('error and manifest projections never execute Proxy/accessor/inherited canaries', () => {
  let reads = 0; const canary = () => { reads += 1; throw Error('PRIVATE_CANARY'); };
  assert.equal(errorCode(new Proxy({}, { get: canary, getOwnPropertyDescriptor: canary })), 'unavailable');
  assert.equal(errorCode(Object.create({ code: 'EOF' })), 'unavailable');
  assert.equal(errorCode(Object.defineProperty({}, 'code', { get: canary })), 'unavailable');
  assert.equal(errorCode({ code: 'PRIVATE_CODE', message: 'PRIVATE_CANARY' }), 'other');
  assert.equal(errorCode({ code: 'EOF' }), 'EOF'); assert.equal(errorCode({ code: 'EPIPE' }), 'EPIPE');
  const value = manifest(); value.files[1] = new Proxy({}, { getPrototypeOf: canary });
  assert.equal(validatePgManifest(value), null); assert.equal(reads, 0);
});
test('original public controller observes callbackEOF and natural terminals without accepting restore or killing', async () => {
  const ports = fixture((child, callback) => natural(child, callback, { code: 'EOF', message: 'PRIVATE_CANARY' }));
  const report = await runPublicCase('empty-toc-83-tail-8m', 'C:\\public-owned\\bin\\pg_restore.exe', environment, 90000, { ...ports, clock: clock() });
  assert.equal(report.outcome, 'OBSERVED'); assert.equal(report.restoreAccepted, false); assert.equal(report.privateInspection, false);
  assert.equal(report.firstError.code, 'EOF'); assert.equal(report.facts.callbackSeen, true);
  assert.equal(report.facts.stdinFinish, false); assert.equal(report.facts.stdinClose, true);
  assert.equal(report.facts.stdoutEOF, true); assert.equal(report.facts.stderrEOF, true);
  assert.equal(report.facts.exitCode, 0); assert.equal(report.facts.closeCode, 0); assert.equal(report.cleanup.requested, false);
  assert.deepEqual(ports.operations, []); assert.equal(JSON.stringify(report).includes('PRIVATE_CANARY'), false);
  assert.deepEqual(ports.calls[0], { executable: 'C:\\public-owned\\bin\\pg_restore.exe', args: ['--list', '--verbose'],
    options: { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], cwd: environment.cwd, env: environment.env } });
  assert.equal(ports.inputCopies[0].length, 83 + LIMITS.tailBytes); ports.inputCopies[0].fill(0);
});
test('snapshot waits for original stdin.close and retains an error queued after child.close', async () => {
  const ports = fixture((child, callback) => {
    callback(null); child.stdout.emit('end'); child.stdout.emit('close'); child.stderr.emit('end'); child.stderr.emit('close');
    child.emit('exit', 0, null); child.emit('close', 0, null);
    queueMicrotask(() => { child.stdin.emit('error', { code: 'EOF', message: 'CANARY' }); child.stdin.emit('close'); });
  });
  const report = await runPublicCase('empty-toc-83', 'public.exe', environment, 90000, { ...ports, clock: clock() });
  assert.equal(report.outcome, 'OBSERVED'); assert.equal(report.facts.stdinClose, true);
  assert.equal(report.firstError.code, 'EOF'); assert.equal(report.firstError.event, 'stdinError');
  assert.equal(report.ownedState, 'NATURAL_TERMINALS_OBSERVED'); assert.equal(report.cleanup.requested, false);
  const close = report.events.find(row => row.event === 'close'), error = report.events.find(row => row.event === 'stdinError');
  const inputClose = report.events.find(row => row.event === 'stdinClose');
  assert.ok(close.sequence < error.sequence && error.sequence < inputClose.sequence); assert.equal(report.restoreAccepted, false);
  assert.equal(JSON.stringify(report).includes('CANARY'), false); ports.inputCopies[0].fill(0);
});
test('missing ANY original stdio.close refuses within the same45s, with no extra wait', async () => {
  for (const missing of ['stdin', 'stdout', 'stderr']) {
    const time = clock(), ports = fixture((child, callback) => {
      callback(null); child.stdout.emit('end'); child.stderr.emit('end');
      for (const key of ['stdin', 'stdout', 'stderr']) if (key !== missing) child[key].emit('close');
      child.emit('exit', 0, null); child.emit('close', 0, null);
    });
    let finished = false;
    const pending = runPublicCase('empty-toc-83', 'public.exe', environment, 90000, { ...ports, clock: time }).then(report => { finished = true; return report; });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.equal(finished, false, 'a missing original close cannot produce a snapshot before the deadline');
    time.advance(45000); const report = await pending;
    assert.equal(report.outcome, 'INCONCLUSIVE'); assert.equal(report.deadlineExpired, true);
    assert.equal(report.naturalComplete, false); assert.equal(report.cleanup.requested, true);
    assert.deepEqual(time.delays, [45000]); assert.equal(report.restoreAccepted, false); ports.inputCopies[0].fill(0);
  }
});
test('EOF error.code cannot manufacture stdoutEOF, exit or close; same absolute deadline governs cleanup', async () => {
  const time = clock(), ports = fixture((child, callback) => { callback({ code: 'EOF' }); time.advance(1000); });
  const report = await runPublicCase('empty-toc-83', 'public.exe', environment, 1000, { ...ports, clock: time });
  assert.equal(report.outcome, 'INCONCLUSIVE'); assert.equal(report.deadlineExpired, true);
  assert.equal(report.facts.stdoutEOF, false); assert.equal(report.facts.exitSeen, false); assert.equal(report.facts.closeSeen, false);
  assert.equal(report.cleanup.requested, true); assert.equal(report.cleanup.closeObserved, false); assert.deepEqual(time.delays, [1000]);
  assert.equal(report.firstError.code, 'EOF'); assert.equal(report.restoreAccepted, false);
  assert.ok(ports.operations.includes('kill:SIGKILL')); ports.inputCopies[0].fill(0);
});
test('unclassified native error remains inconclusive despite original end and exit/close0', async () => {
  const ports = fixture((child, callback) => natural(child, callback, { code: 'UNREVIEWED_CODE', message: 'CANARY' }));
  const report = await runPublicCase('empty-toc-83', 'public.exe', environment, 90000, { ...ports, clock: clock() });
  assert.equal(report.naturalComplete, true); assert.equal(report.outcome, 'INCONCLUSIVE');
  assert.equal(report.unclassifiedErrorSeen, true); assert.equal(report.firstError.code, 'other');
  assert.equal(report.cleanup.requested, false); assert.equal(report.restoreAccepted, false); ports.inputCopies[0].fill(0);
});
test('exit and close without stdoutEOF remain incomplete, never inferred from stream destruction', async () => {
  const time = clock(), ports = fixture((child, callback) => { callback(null); child.stderr.emit('end'); child.emit('exit', 0, null); child.emit('close', 0, null); time.advance(45000); });
  const report = await runPublicCase('empty-toc-83', 'public.exe', environment, 90000, { ...ports, clock: time });
  assert.equal(report.facts.stdoutEOF, false); assert.equal(report.outcome, 'INCONCLUSIVE');
  assert.equal(report.cleanup.requested, true); assert.equal(report.restoreAccepted, false); ports.inputCopies[0].fill(0);
});
test('first native error survives cleanup errors without private text or a fabricated terminal', async () => {
  const time = clock(), ports = fixture((child, callback) => { callback({ code: 'EPIPE' }); child.stdin.destroy = () => child.stdin.emit('error', { code: 'ERR_STREAM_DESTROYED', stack: 'CANARY' }); time.advance(45000); });
  const report = await runPublicCase('empty-toc-83', 'public.exe', environment, 90000, { ...ports, clock: time });
  assert.equal(report.firstError.code, 'EPIPE'); assert.ok(report.events.some(row => row.phase === 'cleanup' && row.code === 'ERR_STREAM_DESTROYED'));
  assert.equal(report.facts.closeSeen, false); assert.equal(JSON.stringify(report).includes('CANARY'), false); ports.inputCopies[0].fill(0);
});
test('output quota and bounded event overflow veto completion while streams still drain', async () => {
  const ports = fixture((child, callback) => { child.stdout.emit('data', Buffer.alloc(65537)); for (let n = 0; n < 100; n += 1) child.stdin.emit('error', { code: 'EOF' }); natural(child, callback); });
  const report = await runPublicCase('empty-toc-83', 'public.exe', environment, 90000, { ...ports, clock: clock() });
  assert.equal(report.naturalComplete, true); assert.equal(report.outcome, 'INCONCLUSIVE'); assert.equal(report.quotaExceeded, true);
  assert.equal(report.eventOverflow, true); assert.equal(report.events.length, 64); assert.equal(report.facts.stdoutEOF, true);
  assert.ok(Buffer.byteLength(JSON.stringify(report)) < 65536); ports.inputCopies[0].fill(0);
});
test('batch runs precisely two public cases sequentially and never renews its global90s deadline', async () => {
  const time = clock(); let active = 0, peak = 0, spawns = 0;
  const spawnPort = (...args) => {
    spawns += 1; active += 1; peak = Math.max(peak, active);
    const ports = fixture((child, callback) => { time.advance(spawns === 1 ? 44000 : 46000); natural(child, callback); active -= 1; });
    return ports.spawn(...args);
  };
  const report = await runPublicBatch('public.exe', environment, { spawn: spawnPort, clock: time });
  assert.equal(peak, 1); assert.equal(spawns, 2); assert.equal(report.cases[0].outcome, 'OBSERVED');
  assert.equal(report.cases[1].deadlineExpired, true); assert.equal(report.outcome, 'INCONCLUSIVE'); assert.equal(report.restoreAccepted, false);
  assert.deepEqual(report.cases.map(row => row.inputBytes), [83, 8388691]);
});
test('batch never starts its second producer after timeout and kill without original close', async () => {
  const time = clock(); let spawns = 0;
  const ports = fixture((child, callback) => { callback({ code: 'EOF' }); time.advance(45000); });
  const report = await runPublicBatch('public.exe', environment, { clock: time, spawn(...args) { spawns += 1; return ports.spawn(...args); } });
  assert.equal(spawns, 1); assert.equal(report.executedCases, 1); assert.equal(report.notExecutedCases, 1);
  assert.equal(report.unconfirmedOwnedChildren, 1); assert.equal(report.cases[0].ownedState, 'CLEANUP_UNCONFIRMED');
  assert.equal(report.cases[0].facts.closeSeen, false); assert.ok(ports.operations.includes('kill:SIGKILL'));
  assert.deepEqual(report.cases[1], { schemaVersion: 1, case: 'empty-toc-83-tail-8m', diagnosticOnly: true,
    privateInspection: false, restoreAccepted: false, executed: false, ownedState: 'NOT_STARTED',
    outcome: 'NOT_EXECUTED', reason: 'PREVIOUS_CASE_INCONCLUSIVE' });
  assert.equal(Object.hasOwn(report.cases[1], 'facts'), false); assert.deepEqual(time.delays, [45000]); ports.inputCopies[0].fill(0);
});
test('batch starts its next producer only after ALL natural terminals and closes of the first', async () => {
  const time = clock(); let spawns = 0, precedingClosed = true;
  const spawnPort = (...args) => {
    assert.equal(precedingClosed, true); precedingClosed = false; spawns += 1;
    const ports = fixture((child, callback) => { natural(child, callback, { code: 'EOF' }); precedingClosed = true; });
    return ports.spawn(...args);
  };
  const report = await runPublicBatch('public.exe', environment, { clock: time, spawn: spawnPort });
  assert.equal(spawns, 2); assert.equal(report.outcome, 'OBSERVED'); assert.equal(report.executedCases, 2);
  assert.equal(report.notExecutedCases, 0); assert.equal(report.unconfirmedOwnedChildren, 0); assert.equal(report.restoreAccepted, false);
  for (const row of report.cases) assert.equal(row.ownedState, 'NATURAL_TERMINALS_OBSERVED');
});
