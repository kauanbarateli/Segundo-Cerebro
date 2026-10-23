import '../fixtures/public-windows-pg18/public-pg18-stdin-probe.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { LOCAL, isLocalNodePath, validateLocalRuntime, localPaths, publicPgEnvironment, validateLocalManifest, isMissingEntry, localBatchDisposition, localRefusal } from '../fixtures/public-windows-pg18/local-pg18-stdin-probe.mjs';
import { BINDING, LIMITS, PG_MANIFEST_PURPOSE, PG_MANIFEST_PROVENANCE, runPublicBatch } from '../fixtures/public-windows-pg18/public-pg18-stdin-probe.mjs';

// Synthetic QA only. The original QA reads its public manifest fixture; no PE, network or private data.
const runtime = () => ({ platform: 'win32', arch: 'x64', version: BINDING.nodeVersion,
  execPath: LOCAL.nodePath, systemRoot: LOCAL.systemRoot, githubActions: '', nodeOptions: '', nodePath: '' });
const paths = () => ({ parent: 'C:\\Users\\public-test\\AppData\\Local\\Temp',
  root: 'C:\\Users\\public-test\\AppData\\Local\\Temp\\sc-local-pg18-' + 'a'.repeat(32) });
const manifest = () => ({ purpose: PG_MANIFEST_PURPOSE, provenance: PG_MANIFEST_PROVENANCE, executed: false,
  observedUtc: '2026-10-22T13:38:13.113Z', files: [
    { name: 'pg_restore.exe', bytes: BINDING.pgBytes, sha256: BINDING.pgSha256, fileVersion: '18.4', productVersion: '18.4' },
    ...Array.from({ length: 29 }, (_, index) => ({ name: 'public-' + index + '.dll', bytes: 1, sha256: 'a'.repeat(64), fileVersion: null, productVersion: null }))] });
function clock() {
  let time = 0, next = 1; const timers = new Map();
  return { now: () => time, set(fn, ms) { const key = next++; timers.set(key, { fn, at: time + ms }); return key; },
    clear(key) { timers.delete(key); }, advance(ms) { time += ms; for (const [key, timer] of [...timers]) if (timer.at <= time) { timers.delete(key); timer.fn(); } } };
}
function fakeChild(action) {
  const child = new EventEmitter(); const actions = [];
  for (const key of ['stdin', 'stdout', 'stderr']) {
    child[key] = new EventEmitter(); child[key].destroy = () => { actions.push(key + ':destroy'); child[key].emit('close'); };
  }
  child.kill = () => { actions.push('kill'); return true; }; child.unref = () => actions.push('unref');
  child.stdin.end = (bytes, callback) => { queueMicrotask(() => { child.emit('spawn'); action(child, callback, bytes.length); }); };
  return { child, actions };
}
function originalTerminals(child, callback, error = null, exitCode = 0) {
  callback(error); if (error === null) child.stdin.emit('finish');
  child.stdout.emit('end'); child.stdout.emit('close'); child.stderr.emit('end'); child.stderr.emit('close');
  child.emit('exit', exitCode, null); child.emit('close', exitCode, null); child.stdin.emit('close');
}
async function batchWith(actions) {
  const time = clock(), children = [], received = []; let index = 0;
  const batch = await runPublicBatch('PUBLIC_SYNTHETIC_NOT_AN_EXECUTABLE', { cwd: paths().root, env: publicPgEnvironment() }, {
    clock: time, spawn(...args) {
      const step = actions[index++]; if (!step) throw Error('UNEXPECTED_SECOND_SPAWN');
      const fake = fakeChild((child, callback, length) => { received.push({ args, length }); step(child, callback, time); });
      children.push(fake); return fake.child;
    }
  });
  return { batch, children, received };
}

test('local origin keeps the existing pins and grants neither runner, ZIP nor restore authority', () => {
  assert.equal(LOCAL.baseSha, '0259d0cd78acc6286cf2c452c6d4cec7b330b05d');
  assert.equal(LOCAL.baseTree, 'ff47deeef569277008fe01d114760529d48d4955');
  assert.equal(LOCAL.controllerSha256, '38c2410896c7e2874cc5b739f2c01f7ac562c6af53a3502d198037f25f69d3b9');
  assert.equal(LIMITS.caseMs, 45000); assert.equal(LIMITS.batchMs, 90000);
  assert.equal(validateLocalRuntime(runtime()), true);
});

test('local preflight rejects every CI identity, different runtime and injected Node configuration', () => {
  for (const [key, value] of [['platform', 'linux'], ['arch', 'arm64'], ['version', 'v24.20.0'],
    ['execPath', 'C:\\untrusted\\node.exe'], ['systemRoot', 'D:\\Windows'], ['githubActions', 'true'],
    ['githubActions', 'false'], ['nodeOptions', '--require=PRIVATE_CANARY'], ['nodePath', 'PRIVATE_CANARY']]) {
    assert.equal(validateLocalRuntime({ ...runtime(), [key]: value }), false, key);
  }
  assert.equal(validateLocalRuntime({ ...runtime(), extra: 'PRIVATE_CANARY' }), false);
  const inherited = Object.create(runtime()); assert.equal(validateLocalRuntime(inherited), false);
});

test('an explicitly selected local Node path remains bound to the same runtime and byte pins', () => {
  const selected = 'C:\\Users\\public-test\\codex-runtime\\node.exe';
  assert.equal(isLocalNodePath(selected), true);
  assert.equal(validateLocalRuntime({ ...runtime(), execPath: selected }), false);
  assert.equal(validateLocalRuntime({ ...runtime(), execPath: selected }, selected), true);
  assert.equal(validateLocalRuntime({ ...runtime(), execPath: selected, version: 'v25.9.0' }, selected), false);
  assert.equal(validateLocalRuntime({ ...runtime(), execPath: selected, githubActions: 'true' }, selected), false);
  for (const invalid of [null, {}, 'relative\\node.exe', 'D:\\Windows\\node.exe', '\\\\server\\node.exe',
    'C:\\runtime\\..\\node.exe', selected + ':ads', selected + '\n', selected.replaceAll('\\', '/'), 'C:\\runtime\\other.exe']) {
    assert.equal(isLocalNodePath(invalid), false);
    assert.equal(validateLocalRuntime(runtime(), invalid), false);
  }
  assert.equal(LOCAL.nodePath, 'C:\\Program Files\\nodejs\\node.exe');
  assert.equal(BINDING.nodeVersion, 'v24.19.0');
  assert.equal(BINDING.nodeSha256, '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237');
});

test('local preflight does not run Proxy/accessor coercion canaries', () => {
  let reads = 0; const canary = () => { reads += 1; throw Error('PRIVATE_CANARY'); };
  assert.equal(validateLocalRuntime(new Proxy({}, { getPrototypeOf: canary, ownKeys: canary })), false);
  assert.equal(validateLocalRuntime(Object.defineProperty(runtime(), 'execPath', { enumerable: true, get: canary })), false);
  assert.equal(validateLocalRuntime({ ...runtime(), execPath: { toString: canary } }), false);
  assert.equal(reads, 0);
});

test('public cwd has a new local identity, sibling JSON and a marker, not a GitHub ZIP binding', () => {
  const result = localPaths(paths());
  assert.equal(result.root, paths().root); assert.equal(result.parent, paths().parent);
  assert.equal(result.report, paths().root + '.json');
  assert.equal(result.marker, paths().root + '\\public-owned-marker.json');
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Object.keys(result).sort(), ['marker', 'parent', 'report', 'root']);
});

test('local paths reject traversal, UNC, alternate streams, aliases and other ownership roots', () => {
  for (const root of ['relative', '\\\\server\\share\\sc-local-pg18-' + 'a'.repeat(32),
    paths().root.replace('C:', 'D:'), paths().root + ':ads', paths().root + '\n',
    paths().parent + '\\..\\sc-local-pg18-' + 'a'.repeat(32), paths().root.replace('sc-local-pg18-', 'sc-public-pg18-'),
    paths().root.replace('a'.repeat(32), 'a'.repeat(31)), paths().root + '\\child', paths().root.replaceAll('\\', '/')]) {
    assert.equal(localPaths({ ...paths(), root }), null);
  }
  assert.equal(localPaths({ ...paths(), parent: 'C:\\different-parent' }), null);
  assert.equal(localPaths({ ...paths(), extra: true }), null);
});

test('local path canaries and inherited records are rejected without reading getters', () => {
  let reads = 0; const canary = () => { reads += 1; throw Error('PRIVATE_CANARY'); };
  assert.equal(localPaths(new Proxy({}, { ownKeys: canary })), null);
  assert.equal(localPaths(Object.defineProperty(paths(), 'parent', { enumerable: true, get: canary })), null);
  assert.equal(localPaths(Object.create(paths())), null); assert.equal(reads, 0);
});

test('the PG child receives only explicit SystemRoot and a restricted public PATH', () => {
  const env = publicPgEnvironment();
  assert.deepEqual(env, { SystemRoot: 'C:\\Windows', PATH: 'C:\\Program Files\\PostgreSQL\\18\\bin;C:\\Windows\\System32' });
  assert.equal(Object.isFrozen(env), true);
  for (const forbidden of ['PGPASSWORD', 'PGHOST', 'PGUSER', 'SUPABASE_SECRET_KEY', 'NODE_OPTIONS', 'NODE_PATH', 'GITHUB_ACTIONS', 'SC_LOCAL_PROBE_ROOT']) {
    assert.equal(Object.hasOwn(env, forbidden), false, forbidden);
  }
});

test('local selection requires precisely30 valid original-manifest entries and unchanged executable identity', () => {
  assert.equal(validateLocalManifest(manifest()).files.length, 30);
  for (const alter of [row => { row.files.pop(); }, row => { row.files.push({ ...row.files[1], name: 'extra.dll' }); },
    row => { row.files[0].sha256 = 'b'.repeat(64); }, row => { row.files[1].name = '..\\private.dll'; },
    row => { row.executed = true; }, row => { row.provenance = 'OFFICIAL_EDB_SIGNATURE'; }, row => { row.files[1].bytes = 67108865; }]) {
    const value = manifest(); alter(value); assert.equal(validateLocalManifest(value), null);
  }
  let reads = 0;
  assert.equal(validateLocalManifest(new Proxy({}, { ownKeys() { reads += 1; throw Error('PRIVATE_CANARY'); } })), null);
  const revoked = Proxy.revocable([], {}); revoked.revoke();
  assert.equal(validateLocalManifest({ ...manifest(), files: revoked.proxy }), null);
  assert.equal(reads, 0);
});

test('cleanup absence recognizes only an original own ENOENT, never access or IO failure', () => {
  assert.equal(isMissingEntry(Object.assign(Error('PUBLIC'), { code: 'ENOENT' })), true);
  for (const code of ['EACCES', 'EPERM', 'EIO', 'ENOTDIR', 'EBUSY', 'ENOENT_CANARY']) assert.equal(isMissingEntry({ code }), false);
  assert.equal(isMissingEntry(Object.create({ code: 'ENOENT' })), false);
  assert.equal(isMissingEntry({ errno: -2 }), false);
});

test('cleanup cannot coerce error strings or invoke error-code accessors', () => {
  let reads = 0; const canary = () => { reads += 1; throw Error('PRIVATE_CANARY'); };
  assert.equal(isMissingEntry(new Proxy({}, { getOwnPropertyDescriptor: canary })), false);
  assert.equal(isMissingEntry(Object.defineProperty({}, 'code', { get: canary })), false);
  assert.equal(isMissingEntry({ code: { toString: canary } }), false); assert.equal(reads, 0);
});

test('original controller still uses precisely two public inputs and preserves natural EOF facts', async () => {
  const result = await batchWith([
    (child, callback) => originalTerminals(child, callback, { code: 'EOF', message: 'PRIVATE_CANARY' }),
    (child, callback) => originalTerminals(child, callback)
  ]);
  assert.deepEqual(result.received.map(row => row.length), [83, 83 + 8388608]);
  assert.deepEqual(result.received[0].args[1], ['--list', '--verbose']);
  assert.deepEqual(result.received[0].args[2].env, publicPgEnvironment());
  assert.equal(result.batch.cases[0].firstError.code, 'EOF');
  assert.equal(result.batch.cases[0].facts.stdinFinish, false);
  assert.equal(result.batch.cases[0].naturalComplete, true);
  assert.equal(result.batch.restoreAccepted, false);
  assert.deepEqual(localBatchDisposition(result.batch), { observed: true, cleanupAllowed: true, unconfirmedOwnedChildren: 0 });
  assert.equal(JSON.stringify(result.batch).includes('PRIVATE_CANARY'), false);
  assert.deepEqual(result.children.flatMap(row => row.actions), []);
});

test('an inconclusive first producer is not followed by another spawn or a cleanup claim', async () => {
  const result = await batchWith([(child, callback, time) => { callback({ code: 'EOF' }); time.advance(45000); }]);
  assert.equal(result.children.length, 1); assert.equal(result.batch.cases[0].firstError.code, 'EOF');
  assert.equal(result.batch.cases[1].outcome, 'NOT_EXECUTED');
  assert.equal(result.batch.cases[1].reason, 'PREVIOUS_CASE_INCONCLUSIVE');
  assert.deepEqual(localBatchDisposition(result.batch), { observed: false, cleanupAllowed: false, unconfirmedOwnedChildren: 1 });
  assert.ok(result.children[0].actions.includes('kill'));
  assert.equal(result.batch.cases[0].facts.stdoutEOF, false);
});

test('exit1 can be a complete diagnostic but never a successful local observation', async () => {
  const result = await batchWith([
    (child, callback) => originalTerminals(child, callback, null, 1),
    (child, callback) => originalTerminals(child, callback)
  ]);
  assert.equal(result.batch.outcome, 'OBSERVED');
  assert.deepEqual(localBatchDisposition(result.batch), { observed: false, cleanupAllowed: true, unconfirmedOwnedChildren: 0 });
});

test('an unknown original error remains inconclusive even with natural zero exit terminals', async () => {
  const result = await batchWith([(child, callback) => originalTerminals(child, callback, { code: 'UNREVIEWED_CODE', message: 'PRIVATE_CANARY' })]);
  assert.equal(result.batch.cases[0].firstError.code, 'other'); assert.equal(result.batch.cases[0].naturalComplete, true);
  assert.equal(result.batch.cases[1].outcome, 'NOT_EXECUTED');
  assert.deepEqual(localBatchDisposition(result.batch), { observed: false, cleanupAllowed: true, unconfirmedOwnedChildren: 0 });
});

test('contradictory counts or fabricated authority never become an accepted batch', async () => {
  const { batch } = await batchWith([(child, callback) => originalTerminals(child, callback), (child, callback) => originalTerminals(child, callback)]);
  for (const alter of [row => { row.restoreAccepted = true; }, row => { row.privateInspection = true; },
    row => { row.executedCases = 1; }, row => { row.notExecutedCases = 1; }, row => { row.unconfirmedOwnedChildren = 1; },
    row => { row.outcome = 'INCONCLUSIVE'; }, row => { row.extra = 'PRIVATE_CANARY'; }, row => { row.cases = [row.cases[0], , row.cases[1]]; }]) {
    const row = { ...batch, cases: [...batch.cases] }; alter(row); assert.equal(localBatchDisposition(row), null);
  }
});

test('batch projection refuses accessors, proxies, holes and unclosed source facts', async () => {
  const { batch } = await batchWith([(child, callback) => originalTerminals(child, callback), (child, callback) => originalTerminals(child, callback)]);
  let reads = 0; const canary = () => { reads += 1; throw Error('PRIVATE_CANARY'); };
  assert.equal(localBatchDisposition(new Proxy({}, { ownKeys: canary })), null);
  assert.equal(localBatchDisposition({ ...batch, cases: new Proxy([], { get: canary }) }), null);
  const revoked = Proxy.revocable([], {}); revoked.revoke();
  assert.equal(localBatchDisposition({ ...batch, cases: revoked.proxy }), null);
  assert.equal(localBatchDisposition({ ...batch, cases: [Object.defineProperty({}, 'facts', { enumerable: true, get: canary }), batch.cases[1]] }), null);
  assert.equal(reads, 0);
});

test('failure receipt preserves fixed reasons and never serializes messages or supplied objects', () => {
  assert.deepEqual(localRefusal('native', 'LOCAL_NATIVE_INCONCLUSIVE'), { phase: 'native', code: 'LOCAL_NATIVE_INCONCLUSIVE' });
  const canary = { toString() { throw Error('PRIVATE_CANARY'); } };
  assert.deepEqual(localRefusal(canary, canary), { phase: 'runtime', code: 'LOCAL_RUNTIME_REFUSED' });
  assert.equal(JSON.stringify(localRefusal('PRIVATE_CANARY', 'PRIVATE_CANARY')).includes('PRIVATE_CANARY'), false);
});
