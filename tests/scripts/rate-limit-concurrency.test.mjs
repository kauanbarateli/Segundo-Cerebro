import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import test from 'node:test';
import { assertEvidence, connectionConfig, createPlan, executePlan, EXECUTION_ACK, main, PROJECT_REF, psqlTransport } from '../../scripts/verification/rate-limit-concurrency.mjs';

const syntheticSecret = 'SYNTHETIC-DO-NOT-PRINT';
const goodEnv = () => ({ SC_VERIFY_ACK: EXECUTION_ACK, SC_VERIFY_PSQL_BIN: path.resolve('psql.exe'),
  SC_VERIFY_PGHOST: `db.${PROJECT_REF}.supabase.co`, SC_VERIFY_PGPORT: '5432', SC_VERIFY_PGUSER: 'postgres',
  SC_VERIFY_PGDATABASE: 'postgres', SC_VERIFY_PGPASSWORD: syntheticSecret, SC_VERIFY_PGSSLROOTCERT: path.resolve('public-ca.crt') });
const preflight = { owner: 'postgres', database: 'postgres', version: 170011, key_absent: true, rpc_granted: true };
const databaseAssertion = { rows: 1, hits: 5, pre_auth: true, one_window: true };
const time = ms => new Date(Date.UTC(2026, 9, 7, 12) + ms).toISOString();
function evidence(plan, serial = false) {
  return plan.workers.map((worker, index) => ({ worker: worker.id, subject_hash: plan.subject_hash,
    executed_as: 'service_role', backend_pid: 100 + index,
    entered_at: time(serial ? index * 2000 : 0), decided_at: time(serial ? index * 2000 + 500 : index * 1000 + 100),
    finished_at: time(serial ? index * 2000 + 1000 : (index + 1) * 1000 + 100),
    result: { allowed: index < 5, remaining: index < 5 ? 4 - index : 0, retry_after_ms: index < 5 ? 0 : 55000 },
    unexpected_secret: syntheticSecret }));
}
function fakeRun(plan, overrides = {}) {
  const calls = [];
  const rows = evidence(plan);
  const query = async sql => {
    calls.push(sql);
    if (sql === plan.preflight) return overrides.preflight ?? preflight;
    if (sql === plan.assertion) return overrides.assertion ?? databaseAssertion;
    if (sql === plan.cleanup) { if (overrides.cleanupError) throw Error(syntheticSecret); return { deleted: 1 }; }
    if (sql === plan.verifyCleanup) return { absent: true };
    const worker = plan.workers.find(item => item.sql === sql);
    if (worker) return overrides.rows?.[worker.id - 1] ?? rows[worker.id - 1];
    throw Error('Unexpected query');
  };
  return { query, calls };
}

test('default preparation never reads configuration or connects, and creates fresh scoped keys', async () => {
  const outputs = [];
  const inaccessibleEnv = new Proxy({}, { get() { throw Error('Environment must not be accessed'); } });
  assert.equal(await main([], inaccessibleEnv, value => outputs.push(JSON.parse(value))), 0);
  const first = outputs[0];
  const second = createPlan();
  assert.notEqual(first.subject_hash, second.subject_hash);
  assert.match(first.subject_hash, /^[a-f0-9]{64}$/);
  assert.equal(first.workers.length, 6);
  assert.equal(first.project, PROJECT_REF);
  const allSql = [first.preflight, ...first.workers.map(worker => worker.sql), first.assertion, first.cleanup, first.verifyCleanup].join('\n');
  assert.doesNotMatch(allSql, /auth\.(users|sessions)|create (table|function)|bootstrap|truncate|\bseed\b/i);
  assert.match(first.cleanup, new RegExp(`scope='login' and subject_hash='${first.subject_hash}' and user_id is null`));
  assert.match(first.cleanup, /pg_stat_activity/);
  assert.match(first.workers[0].sql, /idle_in_transaction_session_timeout='5s'/);
});

test('execute needs explicit ACK and refuses CI without reading credentials', () => {
  assert.throws(() => connectionConfig({ ...goodEnv(), SC_VERIFY_ACK: '' }), /EXPLICIT_PERSONAL_ACK_REQUIRED/);
  assert.throws(() => connectionConfig({ CI: 'true' }), /AUTOMATED_ENVIRONMENT_FORBIDDEN/);
  assert.throws(() => connectionConfig({ GITHUB_ACTIONS: 'true' }), /AUTOMATED_ENVIRONMENT_FORBIDDEN/);
});

test('connection only permits personal direct/session endpoints, database and TLS', () => {
  const config = connectionConfig({ ...goodEnv(), PGOPTIONS: '-c dangerous=true', PGSERVICE: 'another-project', SUPABASE_SECRET_KEY: syntheticSecret });
  assert.equal(config.env.PGSSLMODE, 'verify-full');
  assert.equal(config.env.PGCONNECT_TIMEOUT, '8');
  assert.equal(config.env.PGOPTIONS, undefined);
  assert.equal(config.env.PGSERVICE, undefined);
  assert.equal(config.env.SUPABASE_SECRET_KEY, undefined);
  assert.equal(connectionConfig({ ...goodEnv(), SC_VERIFY_PGHOST: 'aws-0-sa-east-1.pooler.supabase.com', SC_VERIFY_PGUSER: `postgres.${PROJECT_REF}` }).env.PGUSER, `postgres.${PROJECT_REF}`);
  for (const patch of [{ SC_VERIFY_PGHOST: 'db.another.supabase.co' }, { SC_VERIFY_PGPORT: '6543' },
    { SC_VERIFY_PGDATABASE: 'another' }, { SC_VERIFY_PGUSER: 'service_role' },
    { SC_VERIFY_PGHOST: 'evil.pooler.supabase.com.invalid' }, { SC_VERIFY_PGSSLROOTCERT: '' },
    { SC_VERIFY_PSQL_BIN: 'psql' }, { SC_VERIFY_PGPASSWORD: '' }]) assert.throws(() => connectionConfig({ ...goodEnv(), ...patch }));
});

test('evidence requires genuine backend overlap and exact limiter outcome', () => {
  const plan = createPlan();
  const rows = evidence(plan);
  const checked = assertEvidence(rows, plan.subject_hash);
  assert.equal(checked.length, 6);
  assert.doesNotMatch(JSON.stringify(checked), new RegExp(syntheticSecret));
  assert.throws(() => assertEvidence(evidence(plan, true), plan.subject_hash), /CONCURRENCY_NOT_DEMONSTRATED/);
  assert.throws(() => assertEvidence(rows.map(row => ({ ...row, backend_pid: 1 })), plan.subject_hash), /CONCURRENCY_NOT_DEMONSTRATED/);
  assert.throws(() => assertEvidence(rows.map(row => ({ ...row, result: { ...row.result, allowed: true } })), plan.subject_hash), /LIMITER_COUNT_FAILED/);
  assert.throws(() => assertEvidence(rows.slice(1), plan.subject_hash), /SIX_DISTINCT_WORKERS_REQUIRED/);
  assert.throws(() => assertEvidence(rows, createPlan().subject_hash), /WRONG_WORKER_SCOPE/);
  assert.throws(() => assertEvidence(rows.map(row => ({ ...row, result: { ...row.result, retry_after_ms: undefined } })), plan.subject_hash), /INVALID_LIMITER_RESPONSE/);
});

test('opens all workers before any settles, then verifies data and cleanup', async () => {
  const plan = createPlan();
  const fake = fakeRun(plan);
  const rows = evidence(plan);
  const releases = [];
  const running = executePlan(sql => {
    const index = plan.workers.findIndex(worker => worker.sql === sql);
    if (index >= 0) return new Promise(resolve => releases.push(() => resolve(rows[index])));
    return fake.query(sql);
  }, plan);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(releases.length, 6);
  assert.deepEqual(fake.calls, [plan.preflight]);
  releases.forEach(release => release());
  const result = await running;
  assert.equal(result.status, 'passed');
  assert.equal(result.cleanup, 'confirmed');
  assert.equal(result.replay, 'not-tested-no-authorized-test-identity');
  assert.deepEqual(fake.calls, [plan.preflight, plan.assertion, plan.cleanup, plan.verifyCleanup]);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(syntheticSecret));
});

test('serial transport is inconclusive and still cleans only its key', async () => {
  const plan = createPlan();
  const fake = fakeRun(plan, { rows: evidence(plan, true) });
  const result = await executePlan(fake.query, plan);
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'CONCURRENCY_NOT_DEMONSTRATED');
  assert.equal(result.cleanup, 'confirmed');
  assert.ok(!fake.calls.includes(plan.assertion));
  assert.deepEqual(fake.calls.slice(-2), [plan.cleanup, plan.verifyCleanup]);
});

test('waits for all workers even after synchronous transport failure before cleanup', async () => {
  const plan = createPlan();
  const fake = fakeRun(plan);
  const releases = [];
  const running = executePlan(sql => {
    const worker = plan.workers.find(item => item.sql === sql);
    if (worker?.id === 1) throw Error(syntheticSecret);
    if (worker) return new Promise(resolve => releases.push(() => resolve(evidence(plan)[worker.id - 1])));
    return fake.query(sql);
  }, plan);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(releases.length, 5);
  assert.ok(!fake.calls.includes(plan.cleanup));
  releases.forEach(release => release());
  const result = await running;
  assert.equal(result.reason, 'WORKER_FAILED');
  assert.equal(result.cleanup, 'confirmed');
  assert.doesNotMatch(JSON.stringify(result), new RegExp(syntheticSecret));
});

test('preflight collision never deletes an existing key', async () => {
  const plan = createPlan();
  const fake = fakeRun(plan, { preflight: { ...preflight, key_absent: false } });
  const result = await executePlan(fake.query, plan);
  assert.equal(result.reason, 'PREFLIGHT_FAILED');
  assert.equal(result.cleanup, 'not-needed');
  assert.deepEqual(fake.calls, [plan.preflight]);
});

test('database assertion failure still cleans; unconfirmed cleanup never reports pass', async () => {
  const plan = createPlan();
  const badCount = fakeRun(plan, { assertion: { ...databaseAssertion, hits: 6 } });
  assert.equal((await executePlan(badCount.query, plan)).reason, 'DATABASE_ASSERTION_FAILED');
  assert.ok(badCount.calls.includes(plan.verifyCleanup));
  const failedCleanup = fakeRun(plan, { cleanupError: true });
  const result = await executePlan(failedCleanup.query, plan);
  assert.equal(result.status, 'failed');
  assert.equal(result.cleanup, 'unconfirmed');
  assert.equal(result.scoped_cleanup_sql, plan.cleanup);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(syntheticSecret));
});

test('psql transport uses stdin, no shell/credential arguments, and suppresses raw errors', async () => {
  let child;
  let parameters;
  const fakeSpawn = (...args) => {
    parameters = args;
    child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = () => true;
    return child;
  };
  const transport = psqlTransport(connectionConfig(goodEnv()), fakeSpawn);
  const pending = transport('SELECT synthetic_only;');
  assert.equal(parameters[2].shell, false);
  assert.equal(parameters[2].windowsHide, true);
  assert.doesNotMatch(JSON.stringify(parameters[1]), new RegExp(syntheticSecret));
  assert.ok(parameters[1].includes('--no-psqlrc'));
  assert.ok(parameters[1].includes('--no-password'));
  assert.equal(child.stdin.read().toString(), 'SELECT synthetic_only;');
  child.stderr.write(syntheticSecret);
  child.emit('close', 1);
  await assert.rejects(pending, error => error.message === 'PSQL_QUERY_FAILED');
  const success = transport('SELECT synthetic_only;');
  child.stdout.write('{"owner":"postgres"}\n');
  child.emit('close', 0);
  assert.deepEqual(await success, { owner: 'postgres' });
});
