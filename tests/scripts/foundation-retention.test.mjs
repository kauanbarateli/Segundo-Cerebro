// Pure controls and declared transport doubles. No native/hosted acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  RETENTION_CASES, RetentionNativeError, assertRetentionAbsence, assertRetentionBaseline, assertRetentionPostflight,
  blankRetentionReport, frameRetentionNativeStatement, inspectRetentionHealth, inspectRetentionStatement,
  retentionBlockingStatement, retentionData, retentionObserverInput, retentionSqlContext, retentionStatement, validateRetentionReport,
} from '../e2e-auth-local/foundation-retention-contract.mjs';
import { runFoundationRetentionCases } from '../e2e-auth-local/foundation-retention-cases.mjs';

const context = { namespace: 'sc-retention-native-' + 'a'.repeat(32), sourceSha: 'b'.repeat(40), systemIdentifier: '7250000000000000001', projectId: 'sc-auth-ci-' + 'c'.repeat(24) };
const ids = { a: '10000000-0000-4000-8000-000000000001', sa: '10000000-0000-4000-8000-000000000002', b: '10000000-0000-4000-8000-000000000003', sb: '10000000-0000-4000-8000-000000000004' };
const absence = () => ({ users: 0, sessions: 0, refreshTokens: 0, identities: 0, profiles: 0, preferences: 0, modules: 0, roles: 0, moderation: 0, entitlements: 0, events: 0, receipts: 0, rateLimits: 0, focus: 0, entries: 0, rounds: 0, intents: 0, permits: 0, oauth: 0, flows: 0, commands: 0 });
test('context and nested data refuse accessors without invoking them', () => {
  let reads = 0;
  assert.throws(() => retentionSqlContext({ ...context, get sourceSha() { reads++; return 'secret'; } }));
  const array = [0]; Object.defineProperty(array, '0', { enumerable: true, get() { reads++; return 'secret'; } });
  assert.throws(() => retentionData({ nested: array })); assert.equal(reads, 0);
  for (const changed of [{ ...context, namespace: 'remote' }, { ...context, sourceSha: 'B'.repeat(40) }, { ...context, projectId: 'other' }, { ...context, databaseUrl: 'PRIVATE' }]) assert.throws(() => retentionSqlContext(changed));
});
test('seven cases, ticket registry and frame never accept copied shapes or SQL supplied by caller', () => {
  assert.deepEqual(RETENTION_CASES, ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07']);
  const ticket = retentionStatement(context, 'HEALTH');
  for (const fake of [{ ...ticket }, { sql: 'select 1' }, 'select 1', null]) assert.throws(() => inspectRetentionStatement(fake, context));
  assert.throws(() => inspectRetentionStatement(ticket, { ...context, systemIdentifier: '7250000000000000002' }));
  for (const action of ['SQL', 'RPC', 'MIGRATE', 'RESET', 'CRON', 'FETCH', 'DROP', 'DRIVE']) assert.throws(() => retentionStatement(context, action));
  const frame = frameRetentionNativeStatement(ticket, context, 'd'.repeat(32), 1);
  assert.match(frame.input, /SC_RETENTION_NATIVE:[a-f0-9]{32}:1:/u);
  assert.doesNotMatch(frame.input, /@FRAME@|@ACK@/u);
  for (const [nonce, sequence] of [['bad', 1], ['d'.repeat(32), 0], ['d'.repeat(32), 513]]) assert.throws(() => frameRetentionNativeStatement(ticket, context, nonce, sequence));
});
test('actor fixture requires exact ordinary bindings and native instance marker', () => {
  const ticket = retentionStatement(context, 'BIND_ACTORS', { ...ids, caseId: 'R02' });
  const value = inspectRetentionStatement(ticket, context);
  for (const literal of ['sc_ci_foundation.marker', 'pg_control_system()', "role<>'user'", 'sc_retention_native_fixture', 'auth.sessions']) assert.ok(value.sql.includes(literal));
  for (const data of [{ ...ids, caseId: 'R08' }, { ...ids, a: ids.b, caseId: 'R02' }, { ...ids, sql: 'select 1', caseId: 'R02' }]) assert.throws(() => retentionStatement(context, 'BIND_ACTORS', data));
  const prepared = inspectRetentionStatement(retentionStatement(context, 'PREPARE_PROFILE'), context).sql;
  for (const operation of ['start', 'save', 'prepare', 'peek_intent', 'bind_intent']) assert.ok(prepared.includes(`'${operation}'`));
  assert.doesNotMatch(prepared, /insert into app_private\.(?:command_receipts|onboarding_write_permits)/u);
});
test('closed version fixture and lock namespaces preserve102 rounds306 versions and no active-round fiction', () => {
  const sql = inspectRetentionStatement(retentionStatement(context, 'PREPARE_VERSIONS'), context).sql;
  assert.match(sql, /for n in 1\.\.102 loop/u); assert.match(sql, /for version in 1\.\.3 loop/u);
  assert.match(sql, /'complete','summary'/u); assert.match(sql, /version=3/u); assert.match(sql, /'unknown'/u);
  for (const [action, pattern] of [['LOCK_GLOBAL_SWEEP', 'sc-onboarding-retention-v1'], ['LOCK_USER_SHARE_AND_ADVISORY', 'capture-task:'], ['LOCK_AUTH_PARENT_UPDATE', 'for update']]) assert.ok(inspectRetentionStatement(retentionStatement(context, action), context).sql.includes(pattern));
  assert.match(inspectRetentionStatement(retentionBlockingStatement(context, 20, 21), context).sql, /pg_blocking_pids\(20\)=array\[21\]/u);
  const blockedActor = inspectRetentionStatement(retentionStatement(context, 'BLOCK_BOUND_ACTOR'), context).sql;
  assert.match(blockedActor, /current_setting\('sc_retention.case'\)<>'R05'/u);
  assert.match(blockedActor, /where user_id=current_setting\('sc_retention.owner_a'\)::uuid/u);
  assert.throws(() => retentionBlockingStatement(context, 20, 20));
});
test('observer only admits three nominal control actions and wraps its own timeouts', () => {
  for (const action of ['ABSENCE', 'BACKENDS', 'SWEEP']) {
    const sql = retentionObserverInput(retentionStatement(context, action), context);
    assert.match(sql, /^begin/u); assert.match(sql, /statement_timeout='15s'/u); assert.match(sql, /select \(jsonb_build_object/u); assert.doesNotMatch(sql, /@FRAME@|@ACK@/u);
  }
  for (const action of ['PROFILE_COMMIT', 'PREPARE_PROFILE', 'HEALTH']) assert.throws(() => retentionObserverInput(retentionStatement(context, action), context));
  assertRetentionAbsence(absence());
  for (const bad of [{ ...absence(), unknown: 0 }, { ...absence(), users: 1 }, { ...absence(), refreshTokens: 1 }, { ...absence(), events: 1 }, { ...absence(), receipts: 1 }, { foo: 0 }]) assert.throws(() => assertRetentionAbsence(bad));
});
function health(due = 0) {
  return { observedAt: '2026-10-26T12:00:00.000Z', health: { lastStartedAt: '2026-10-26T11:59:59.000Z', lastCompletedAt: '2026-10-26T11:59:59.500Z', lastCode: 'OK', durationMs: 500, visited: 0, cleaned: 0, skipped: 0, failed: 0, dueCount: due, oldestDueAt: due ? '2026-10-26T11:57:59.000Z' : null, expiredPayloadCount: due, residualPermitCount: 0 } };
}
test('native health keeps SLO violation, missing run, payload and permits distinct from clean', () => {
  assert.equal(inspectRetentionHealth(health()).clean, true);
  assert.equal(inspectRetentionHealth(health(102)).oldestLagSeconds, 121);
  assert.equal(inspectRetentionHealth(health(102)).clean, false);
  for (const patch of [{ lastCompletedAt: null }, { lastCode: 'PARTIAL' }, { expiredPayloadCount: 1 }, { residualPermitCount: 1 }, { failed: 1 }]) { const h = health(); Object.assign(h.health, patch); assert.equal(inspectRetentionHealth(h).clean, false); }
  for (const patch of [{ lastCompletedAt: '2026-10-26T12:00:01.000Z' }, { dueCount: -1 }, { dueCount: 1 }, { oldestDueAt: '2026-02-31T00:00:00.000Z' }]) { const h = health(); Object.assign(h.health, patch); assert.throws(() => inspectRetentionHealth(h)); }
  const sql = inspectRetentionStatement(retentionStatement(context, 'HEALTH'), context).sql;
  assert.match(sql, /at time zone 'UTC'/u); assert.match(sql, /MS"Z"/u);
});
test('report cannot promote partial cases, BUSY or cleanup uncertainty to a native package PASS', () => {
  assert.equal(validateRetentionReport(blankRetentionReport()).status, 'failed');
  const complete = blankRetentionReport(); complete.status = 'passed'; complete.code = 'PASSED'; complete.cleanupConfirmed = true;
  for (const row of complete.cases) { row.status = 'passed'; row.code = 'PASSED'; for (const key of Object.keys(row.checks)) row.checks[key] = true; row.sqlState = row.id === 'R02' ? '40001' : null; row.lagViolationObserved = row.id === 'R06'; }
  assert.equal(validateRetentionReport(complete).autonomousRetentionAccepted, false);
  for (const change of [v => { v.cases[1].sqlState = '55P03'; }, v => { v.cases[4].status = 'not-run'; }, v => { v.cleanupConfirmed = false; }, v => { v.writeOutcomeUncertain = true; }, v => { v.hostedValidated = true; }, v => { v.cases[5].lagViolationObserved = false; }]) { const bad = structuredClone(complete); change(bad); assert.throws(() => validateRetentionReport(bad)); }
});
test('baseline and physical payload guards refuse material changes and unsanitized versions', () => {
  assertRetentionBaseline({ profileHash: 'a'.repeat(64), receiptHash: 'b'.repeat(64), receiptCount: 0, profileEvents: 0, foreignHash: 'c'.repeat(64), retentionEvents: 0, retentionEventRounds: 0 });
  const clean = { rounds: 102, versions: 306, expired: 102, payload: 0, drafts: 0, permits: 0, foreignRounds: 0, cursorCleared: true };
  assertRetentionPostflight(clean, 102);
  for (const change of [{ versions: 102 }, { payload: 1 }, { expired: 100 }, { foreignRounds: 1 }, { permits: 1 }]) assert.throws(() => assertRetentionPostflight({ ...clean, ...change }, 102));
});
test('only two exact B expiry events are separated; nontrue or nullable predicates remain in the foreign hash', () => {
  const sql = inspectRetentionStatement(retentionStatement(context, 'BASELINE'), context).sql;
  assert.match(sql, /\) is not true/u); assert.doesNotMatch(sql, /and not\(/u);
  for (const fragment of ["':round:101'", "':round:102'", "e.before is null", "e.after=jsonb_build_object", "'status','expired'", "'revision','1'", "'counts',jsonb_build_object('blocked',1)", "count(distinct e.entity_id)"]) assert.ok(sql.includes(fragment));
  const baseline = { profileHash: 'a'.repeat(64), receiptHash: 'b'.repeat(64), receiptCount: 0, profileEvents: 0, foreignHash: 'c'.repeat(64), retentionEvents: 2, retentionEventRounds: 2 };
  assertRetentionBaseline(baseline); assert.throws(() => assertRetentionBaseline({ ...baseline, retentionEvents: 3 }));
});

// This model proves orchestration/negative controls only. It is intentionally
// synthetic; the only future native provenance is the owned Foundation CI.
function modelPorts({ wrongState = false, wrongFairness = false, hiddenPayload = false, noSloViolation = false, wrongRetentionEvents = false, foreignMutation = false } = {}) {
  let s = null, pendingReject = null; const trace = [];
  const baseline = () => { const expired = s?.rounds === 102 && s?.expired === 102; return { profileHash: (s?.profile ? 'f' : 'a').repeat(64), receiptHash: (s?.profile ? 'e' : 'b').repeat(64), receiptCount: s?.profile ? 1 : 0, profileEvents: s?.profile ? 1 : 0, foreignHash: (expired && foreignMutation ? 'f' : 'c').repeat(64), retentionEvents: expired ? wrongRetentionEvents ? 1 : 2 : 0, retentionEventRounds: expired ? 2 : 0 }; };
  const terminal = refused => ({ code: refused ? 'SQL_REFUSED' : 'PASSED', unknown: false, stdoutEof: true, stderrEof: true, exitCode: refused ? 3 : 0, closeCode: refused ? 3 : 0, exitSignal: null, closeSignal: null, groupAbsent: true, terminalCounts: { stdoutEnd: 1, stderrEnd: 1, exit: 1, close: 1 } });
  const ports = { signal: new AbortController().signal, pause: async () => {},
    async prepareActors(id) { s = { id, rounds: 0, versions: 0, expired: 0, payload: 0, drafts: 0, ticks: 0, cursor: true, profile: false, aLock: false }; trace.push(id); return { a: { id: ids.a, sessionId: ids.sa }, b: { id: ids.b, sessionId: ids.sb } }; },
    async cleanupActors() { s = null; return true; },
    async observer(ticket) { const action = inspectRetentionStatement(ticket, context).action; if (action === 'ABSENCE') return absence(); if (action === 'BACKENDS') return { other: 0 }; return { code: 'OK', visited: 0, cleaned: 0, skipped: 0, failed: 0 }; },
    async openSession(label) {
      let transaction = 'idle', closed = false, refused = false, pending = 0;
      const session = { async request(ticket) {
        const action = inspectRetentionStatement(ticket, context).action; trace.push(label + ':' + action);
        if (action === 'IDENTITY') return { pid: label === 'a' ? 101 : 102, bound: true };
        if (action.startsWith('BEGIN')) { transaction = 'open'; return { ack: 'begin' }; }
        if (action === 'COMMIT' || action === 'ROLLBACK') { transaction = 'idle'; if (label === 'a') s.aLock = false; if (label === 'b' && s.id === 'R02' && pendingReject) { pendingReject(new RetentionNativeError('SQL_REFUSED', { sqlState: wrongState ? '55P03' : '40001', reason: 'SQL_REFUSAL' })); pendingReject = null; } return { ack: action.toLowerCase() }; }
        let value = {};
        if (action === 'PREPARE_PROFILE') { s.rounds = 1; s.versions = s.id === 'R01' ? 0 : 1; s.payload = s.versions; s.drafts = 1; value = s.id === 'R01' ? { roundId: ids.a } : { roundId: ids.a, intentId: ids.b, roundGeneration: ids.sa, intentVersion: 1 }; }
        else if (action === 'PREPARE_VERSIONS') { s.rounds = 102; s.versions = 306; s.payload = 306; s.drafts = 102; value = { rounds: 102, versions: 306 }; }
        else if (action === 'BASELINE') value = baseline();
        else if (action === 'READ_DEADLINE') value = { due: s.id === 'R02' && pendingReject !== null, exact720h: true, deadlineHash: 'd'.repeat(64) };
        else if (action === 'PROFILE_COMMIT' && s.id === 'R02') { pending = 1; return new Promise((_resolve, reject) => { pendingReject = error => { refused = true; closed = true; transaction = 'idle'; pending = 0; reject(error); }; }); }
        else if (action === 'PROFILE_COMMIT') { s.profile = true; value = { id: ids.a, user_id: ids.a }; }
        else if (action === 'PROVE_A_BLOCKED') value = { blocked: true, advisory: true };
        else if (action === 'BLOCK_BOUND_ACTOR') value = { blocked: true };
        else if (['LOCK_GLOBAL_SWEEP', 'LOCK_AUTH_PARENT_UPDATE'].includes(action)) s.aLock = true;
        else if (action === 'SWEEP') {
          if (s.id === 'R04' && s.aLock) value = { code: 'BUSY' };
          else { const n = s.ticks++, visits = s.rounds === 1 ? 1 : s.id === 'R05' ? [100, 2, 0, 100][n] : [100, 2, 0][n]; let cleaned = visits;
            if (s.id === 'R05' && n === 0) cleaned = wrongFairness ? 1 : 0;
            const skipped = visits - cleaned; s.expired += cleaned; s.payload = (s.rounds - s.expired) * (s.rounds === 102 ? 3 : 1); s.drafts = s.rounds - s.expired; s.cursor = visits === 0;
            value = { code: 'OK', visited: visits, cleaned, skipped, failed: 0 }; }
        } else if (action === 'HEALTH') { value = health(s.rounds - s.expired); value.health.expiredPayloadCount = s.rounds - s.expired; if (s.id === 'R06' && noSloViolation) value.health.oldestDueAt = value.health.dueCount ? '2026-10-26T11:59:59.000Z' : null; }
        else if (action === 'POSTFLIGHT') value = { rounds: s.rounds, versions: s.versions, expired: s.expired, payload: hiddenPayload ? 1 : s.payload, drafts: s.drafts, permits: 0, foreignRounds: 0, cursorCleared: s.cursor };
        else if (action === 'BACKENDS') value = { other: 0 };
        else if (action === 'ACL') value = { invoker: true, denied: true };
        return { ack: action, value };
      }, metadata: () => ({ transaction, pending, processPending: !closed, failed: refused ? 'SQL_REFUSED' : null, unknown: false }),
      async finish() { closed = true; return terminal(refused); }, async terminal() { return terminal(refused); }, abort() { closed = true; } };
      return session;
    },
  };
  return { ports, trace };
}
test('declared doubles traverse all seven cases without inventing native or Cron acceptance', async () => {
  const { ports, trace } = modelPorts(), report = await runFoundationRetentionCases(context, ports);
  assert.equal(report.status, 'passed'); assert.equal(report.autonomousRetentionAccepted, false); assert.deepEqual(report.cases.map(row => row.id), RETENTION_CASES);
  assert.equal(report.cases[1].sqlState, '40001'); assert.equal(report.cases[5].lagViolationObserved, true);
  assert.ok(trace.indexOf('a:PROFILE_COMMIT') < trace.indexOf('b:PROVE_A_BLOCKED'));
});
for (const [name, options] of [['55P03 instead of40001', { wrongState: true }], ['locked first page cleaned', { wrongFairness: true }], ['expired inactive payload remains', { hiddenPayload: true }], ['SLO violation missing', { noSloViolation: true }], ['expected expiry event missing', { wrongRetentionEvents: true }], ['unrelated foreign material changed', { foreignMutation: true }]]) test(`case controls refuse ${name}`, async () => {
  const report = await runFoundationRetentionCases(context, modelPorts(options).ports); assert.equal(report.status, 'failed'); assert.notEqual(report.code, 'PASSED');
});

async function authFactoryFixture(change = {}) {
  // Extract only the one private factory from the reviewed proposal, never the
  // operational module/entrypoint. Every HTTP capability is a rejecting double.
  const source = await readFile(new URL('../../scripts/verification/foundation-local-ci.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function retentionActors('), end = source.indexOf('\nconst FORMAT=', start);
  assert.ok(start > 0 && end > start); assert.equal(source.indexOf('function retentionActors(', start + 1), -1);
  const users = new Map(), trace = [], local = { publishable: 'PUBLIC_LOCAL_PUBLISHABLE', secret: 'PUBLIC_LOCAL_SECRET' };
  const tokenUser = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub;
  const factory = runInNewContext('(' + source.slice(start, end) + ')', {
    randomBytes, randomUUID, AbortController, Buffer, setTimeout, clearTimeout,
    fail: code => { throw Error(code); }, fetch: async (url, options) => {
      const target = new URL(url); assert.equal(target.origin, 'http://127.0.0.1:54321');
      assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit'); trace.push([options.method, target.pathname + target.search]);
      let data, status = 200; const body = options.body === undefined ? undefined : JSON.parse(options.body);
      const bearer = options.headers.Authorization.slice(7), admin = target.pathname.startsWith('/auth/v1/admin/users');
      assert.equal(options.headers.apikey, admin ? local.secret : local.publishable);
      if (options.method === 'POST' && target.pathname === '/auth/v1/admin/users') {
        assert.equal(bearer, local.secret); assert.equal(body.email_confirm, true); assert.equal(body.app_metadata.sc_retention_native_fixture, context.namespace);
        data = { ...body, is_anonymous: false, role: 'authenticated' }; users.set(body.id, data);
        if (change.createRefused) { status = 401; data = { error: 'SYNTHETIC_REFUSAL' }; }
      } else if (target.pathname === '/auth/v1/token') {
        data = [...users.values()].find(user => user.email === body.email); assert.ok(data); assert.equal(body.password, data.password);
        const claims = { sub: data.id, session_id: randomUUID(), role: 'authenticated', exp: Math.ceil(Date.now() / 1000) + 3600 };
        data = { user: data, access_token: 'synthetic.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.synthetic' };
      } else if (target.pathname === '/auth/v1/user') data = users.get(tokenUser(bearer));
      else if (target.pathname === '/rest/v1/rpc/my_access_state') data = { user_id: tokenUser(bearer), role: 'user', must_change_password: false, entitlements: {} };
      else if (target.pathname === '/auth/v1/logout') { assert.equal(target.search, '?scope=global'); assert.ok(users.has(tokenUser(bearer))); status = 204; }
      else if (admin) {
        assert.equal(bearer, local.secret); const id = target.pathname.slice('/auth/v1/admin/users/'.length); data = users.get(id);
        if (!data) { status = 404; data = { error: 'user_not_found' }; }
        else if (options.method === 'DELETE') { assert.deepEqual(body, { should_soft_delete: false }); users.delete(id); if (change.deleteMismatch) data = { ...data, id: ids.sa }; if (change.deleteEmpty) data = {}; }
      } else throw Error('UNDECLARED_HTTP');
      return new Response(status === 204 ? null : JSON.stringify(data), { status });
    },
  }, { timeout: 1000 });
  return { fixture: factory(local, context.namespace, new AbortController().signal), trace, users };
}
test('local Auth protocol double uses finite paths, common sessions and exact revocation/delete/absence', async () => {
  const { fixture, trace, users } = await authFactoryFixture(); const actors = await fixture.prepare();
  assert.equal(users.size, 2); assert.notEqual(actors.a.id, actors.b.id); assert.notEqual(actors.a.sessionId, actors.b.sessionId);
  assert.equal(trace.length, 8); assert.equal(await fixture.cleanup(actors), true); assert.equal(trace.length, 16); assert.equal(users.size, 0);
  assert.deepEqual(Object.keys(fixture.metadata()).sort(), ['closed', 'pending', 'unknown']); assert.equal(fixture.metadata().unknown, false);
});
test('local Auth protocol double refuses mismatched cleanup bindings before delete and preserves unknown/refusal', async () => {
  const first = await authFactoryFixture(); const actors = await first.fixture.prepare(); const before = first.trace.length;
  await assert.rejects(first.fixture.cleanup({ ...actors, a: { ...actors.a, id: ids.sa } })); assert.equal(first.trace.length, before); assert.equal(first.users.size, 2);
  const refused = await authFactoryFixture({ createRefused: true }); await assert.rejects(refused.fixture.prepare()); assert.equal(refused.fixture.metadata().unknown, true); assert.equal(refused.trace.length, 1);
  const badDelete = await authFactoryFixture({ deleteMismatch: true }); const bound = await badDelete.fixture.prepare(); await assert.rejects(badDelete.fixture.cleanup(bound)); assert.equal(badDelete.users.size, 1); assert.equal(badDelete.trace.length, 11);
});
test('empty GoTrue200 delete ACK still requires prior marker and subsequent404 rather than certifying absence', async () => {
  const { fixture, trace, users } = await authFactoryFixture({ deleteEmpty: true }); const actors = await fixture.prepare();
  assert.equal(await fixture.cleanup(actors), true); assert.equal(users.size, 0); assert.equal(trace.length, 16);
  for (const actor of [actors.a, actors.b]) assert.ok(trace.some(([method, path]) => method === 'GET' && path === '/auth/v1/admin/users/' + actor.id));
});

// Synthetic streams/timers only; append to the single retention test aggregate.
// No psql, database, filesystem profile, browser, service or native acceptance.
import transportAssert from "node:assert/strict";
import { EventEmitter as TransportEmitter, once as transportOnce } from "node:events";
import { PassThrough as TransportStream } from "node:stream";
import transportTest from "node:test";
import { RETENTION_NATIVE_LIMITS as transportLimits, retentionStatement as transportStatement } from "../e2e-auth-local/foundation-retention-contract.mjs";
import { createRetentionNativeSession, validateRetentionNativeSessionOptions } from "../e2e-auth-local/foundation-retention-session.mjs";

const transportContext = { namespace: "sc-retention-native-" + "a".repeat(32), sourceSha: "b".repeat(40), systemIdentifier: "7250000000000000001", projectId: "sc-auth-ci-" + "d".repeat(24) };
const transportNonce = "c".repeat(32);
function transportOptions(signal = new AbortController().signal, actor = "a") {
  const applicationName = "sc.retention.native." + "a".repeat(32) + "." + actor;
  return { context: transportContext, cwd: "/workspace", signal, applicationName, environment: {
    PATH: "/usr/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", HOME: "/tmp/own/home", XDG_CONFIG_HOME: "/tmp/own/home/.config", XDG_CACHE_HOME: "/tmp/own/home/.cache",
    CI: "true", GITHUB_ACTIONS: "true", RUNNER_TEMP: "/tmp", SC_AUTH_LOCAL_CI_RUN: "1", SC_FOUNDATION_RETENTION_NATIVE_CI_RUN: "1", NO_COLOR: "1",
    PGHOST: "127.0.0.1", PGPORT: "54322", PGUSER: "postgres", PGDATABASE: "postgres", PGPASSWORD: "PUBLIC_SYNTHETIC_LOCAL_ONLY", PGSSLMODE: "disable", PGCONNECT_TIMEOUT: "8", PGCLIENTENCODING: "UTF8", PGAPPNAME: applicationName, PGOPTIONS: "-c statement_timeout=15000 -c lock_timeout=5000",
  } };
}
function transportHarness({ signal, actor = "a", holdWrites = false, group = true } = {}) {
  const child = new TransportEmitter(); child.pid = 42000; child.stdout = new TransportStream(); child.stderr = new TransportStream(); child.stdin = new TransportEmitter();
  const writes = [], callbacks = [], timers = new Set(); let ended = false, groups = 0;
  child.stdin.write = (input, callback) => { writes.push(input); if (holdWrites) callbacks.push(callback); else callback(); return true; };
  child.stdin.end = () => { ended = true; };
  const session = createRetentionNativeSession(transportOptions(signal, actor), {
    platform: "linux", nonce: transportNonce,
    spawnProcess(command, args, config) {
      transportAssert.equal(command, "psql"); transportAssert.equal(config.shell, false); transportAssert.equal(config.detached, true);
      transportAssert(args.includes("--no-psqlrc") && args.includes("--file=-") && args.includes("ON_ERROR_STOP=1") && args.includes("VERBOSITY=verbose"));
      transportAssert.equal(args.some(arg => arg.includes("://")), false); return child;
    },
    terminateGroup: async observed => { transportAssert.equal(observed, child); groups++; return group; },
    setTimer(fn, ms) { const timer = { fn, ms }; timers.add(timer); return timer; }, clearTimer(timer) { timers.delete(timer); },
  });
  const output = (row, sequence = writes.length) => child.stdout.write(`SC_RETENTION_NATIVE:${transportNonce}:${sequence}:` + JSON.stringify(row) + "\n");
  const identity = { ...transportContext, database: "postgres", sessionUser: "postgres", currentUser: "postgres", serverVersion: 170011, pid: actor === "a" ? 51001 : 51002, applicationName: transportOptions(undefined, actor).applicationName, bound: true };
  const identify = async () => { const pending = session.request(transportStatement(transportContext, "IDENTITY")); output(identity); if (holdWrites) callbacks.shift()(); return pending; };
  const endStreams = async (...names) => { const ends = names.map(name => transportOnce(child[name], "end")); for (const name of names) child[name].end(); await Promise.all(ends); };
  const close = async (code = 0) => { await endStreams("stdout", "stderr"); child.emit("exit", code, null); child.emit("close", code, null); return session.terminal(); };
  return { child, session, writes, callbacks, timers, output, identity, identify, close, endStreams,
    fire(ms) { const timer = [...timers].find(value => value.ms === ms); transportAssert(timer); timers.delete(timer); timer.fn(); }, ended: () => ended, groups: () => groups };
}

transportTest("retention transport refuses foreign environments and keeps exactly two application actors", () => {
  for (const actor of ["a", "b"]) transportAssert.equal(validateRetentionNativeSessionOptions(transportOptions(undefined, actor), "linux").environment.PGPORT, "54322");
  for (const change of [o => { o.environment.SUPABASE_SECRET_KEY = "CANARY"; }, o => { o.environment.PGHOST = "remote.supabase.co"; }, o => { o.environment.PGPORT = "5432"; },
    o => { o.environment.SC_FOUNDATION_RETENTION_NATIVE_CI_RUN = "0"; }, o => { o.environment.PGOPTIONS += " -c role=other"; }, o => { o.applicationName += ".observer"; },
    o => { o.environment.PGAPPNAME += ".foreign"; }, o => { o.environment.PGPASSWORD = "line\nbreak"; }]) {
    const options = transportOptions(); change(options); transportAssert.throws(() => validateRetentionNativeSessionOptions(options, "linux"));
  }
  transportAssert.throws(() => validateRetentionNativeSessionOptions(transportOptions(), "win32"));
  const controller = new AbortController(); controller.abort(); transportAssert.throws(() => validateRetentionNativeSessionOptions(transportOptions(controller.signal), "linux"));
});

transportTest("retention identity requires bound marker/project and waits for the original write callback", async () => {
  const h = transportHarness({ holdWrites: true }); let settled = false;
  const pending = h.session.request(transportStatement(transportContext, "IDENTITY")).then(value => { settled = true; return value; });
  h.output(h.identity); await Promise.resolve(); transportAssert.equal(settled, false); h.callbacks.shift()(); await pending;
  const begin = h.session.request(transportStatement(transportContext, "BEGIN_WAITING_COMMIT")); h.output({ ack: "begin", role: "postgres", isolation: "read committed" }); h.callbacks.shift()(); await begin;
  const rollback = h.session.request(transportStatement(transportContext, "ROLLBACK")); h.output({ ack: "rollback" }); h.callbacks.shift()(); await rollback;
  const finishing = h.session.finish(); transportAssert.equal(h.ended(), true); await h.close();
  const result = await finishing; transportAssert.equal(result.code, "PASSED"); transportAssert(result.stdoutEof && result.stderrEof && result.groupAbsent);
  transportAssert.equal(h.groups(), 1); transportAssert.equal(h.timers.size, 0);
});

transportTest("retention does not adopt copied tickets, SQL strings or overlapping statements", async () => {
  const h = transportHarness(), ticket = transportStatement(transportContext, "IDENTITY"), pending = h.session.request(ticket);
  for (const invalid of [ticket, { ...ticket }, "select 1;", { sql: "select 1;" }]) await transportAssert.rejects(h.session.request(invalid));
  h.output(h.identity); await pending;
  await transportAssert.rejects(h.session.request({ ...transportStatement(transportContext, "HEALTH") }));
  const finishing = h.session.finish(); await h.close(); transportAssert.equal((await finishing).code, "PASSED");
});

transportTest("retention marker, project, actor and PostgreSQL identity mismatches fail sticky", async () => {
  for (const patch of [{ bound: false }, { projectId: "sc-auth-ci-" + "e".repeat(24) }, { applicationName: transportOptions(undefined, "b").applicationName }, { serverVersion: 180000 }, { currentUser: "service_role" }]) {
    const h = transportHarness(), pending = h.session.request(transportStatement(transportContext, "IDENTITY")); h.output({ ...h.identity, ...patch });
    await transportAssert.rejects(pending, { code: "INSTANCE_REFUSED" }); await h.close();
    await transportAssert.rejects(h.session.request(transportStatement(transportContext, "HEALTH"))); transportAssert.equal(h.writes.length, 1);
  }
});

transportTest("retention result ACK stays nominal and BUSY data is not converted into a successful health verdict", async () => {
  const h = transportHarness(); await h.identify();
  const pending = h.session.request(transportStatement(transportContext, "HEALTH")); h.output({ ack: "HEALTH", value: { status: "BUSY", synthetic: true } });
  const result = await pending; transportAssert.equal(result.value.status, "BUSY"); transportAssert.equal(Object.hasOwn(result, "passed"), false);
  const finishing = h.session.finish(); await h.close(); await finishing;
  const wrong = transportHarness(); await wrong.identify(); const refused = wrong.session.request(transportStatement(transportContext, "HEALTH")); wrong.output({ ack: "OTHER", value: {} });
  await transportAssert.rejects(refused, { code: "FRAME_REFUSED" }); await wrong.close();
});

transportTest("retention original SQLSTATE40001 and unrelated55P03 remain diagnostic refusals with natural terminal3", async () => {
  for (const sqlState of ["40001", "55P03", "42501"]) {
    const h = transportHarness(); await h.identify(); const pending = h.session.request(transportStatement(transportContext, "HEALTH"));
    h.child.stderr.write(`psql:<stdin>:1: ERROR:  ${sqlState}: PRIVATE_CANARY\nCONTEXT: synthetic private text\n`); const ended = h.close(3);
    await transportAssert.rejects(pending, error => error.code === "SQL_REFUSED" && error.sqlRefusal.sqlState === sqlState && error.sqlRefusal.reason === "SQL_REFUSAL" && !JSON.stringify(error).includes("CANARY"));
    const terminal = await ended; transportAssert.equal(terminal.code, "SQL_REFUSED"); transportAssert.equal(terminal.exitCode, 3); transportAssert.equal(terminal.closeCode, 3);
    transportAssert(terminal.stdoutEof && terminal.stderrEof && terminal.groupAbsent); transportAssert.equal(terminal.unknown, false);
  }
});

transportTest("retention timeout is not cured by a late SQL error or ACK", async () => {
  const h = transportHarness(); await h.identify(); const pending = h.session.request(transportStatement(transportContext, "HEALTH"));
  h.child.stderr.write("psql:<stdin>:1: ERROR:  40001: synthetic private text\n"); h.fire(transportLimits.actionMs);
  await transportAssert.rejects(pending, { code: "ACTION_TIMEOUT" }); h.output({ ack: "HEALTH", value: {} });
  transportAssert.equal((await h.close(3)).code, "ACTION_TIMEOUT"); await transportAssert.rejects(h.session.request(transportStatement(transportContext, "HEALTH")));
});

transportTest("retention missing EOF or unknown process terminal cannot certify a completed session", async () => {
  const h = transportHarness(), pending = h.session.request(transportStatement(transportContext, "IDENTITY")); h.fire(transportLimits.actionMs); await transportAssert.rejects(pending); h.fire(1500);
  const incomplete = await h.session.terminal(); transportAssert.equal(incomplete.stdoutEof, false); transportAssert.equal(incomplete.code, "ACTION_TIMEOUT"); transportAssert.equal(h.session.metadata().processPending, true);
  await h.close(); transportAssert.equal((await h.session.terminal()).stdoutEof, false);
});

transportTest("retention writing followed by lost COMMIT ACK remains unknown instead of a known SQL refusal", async () => {
  for (const action of ["COMMIT", "ROLLBACK"]) {
    const h = transportHarness(); await h.identify();
    const begin = h.session.request(transportStatement(transportContext, "BEGIN")); h.output({ ack: "begin", role: "postgres", isolation: "read committed" }); await begin;
    const write = h.session.request(transportStatement(transportContext, "PROFILE_COMMIT")); h.output({ ack: "PROFILE_COMMIT", value: { synthetic: true } }); await write;
    const ending = h.session.request(transportStatement(transportContext, action)); h.child.stderr.write("psql:<stdin>:1: ERROR:  23514: synthetic ACK failure\n"); const closed = h.close(3);
    await transportAssert.rejects(ending, { code: "WRITE_OUTCOME_UNCERTAIN" }); const terminal = await closed;
    transportAssert.equal(terminal.unknown, true); transportAssert.equal(terminal.sqlRefusal, null);
  }
});

transportTest("retention nonce, extra frame, partial UTF8, abort and unconfirmed group cannot pass", async () => {
  for (const mode of ["nonce", "extra", "utf8", "abort", "group"]) {
    const controller = new AbortController(), h = transportHarness({ signal: controller.signal, group: mode !== "group" });
    const pending = h.session.request(transportStatement(transportContext, "IDENTITY"));
    if (mode === "abort") controller.abort(); else if (mode === "utf8") h.child.stdout.write(Buffer.from([0xff]));
    else if (mode === "nonce") h.child.stdout.write("SC_RETENTION_NATIVE:" + "d".repeat(32) + ":1:{}\n");
    else { h.output(h.identity); if (mode === "extra") h.output(h.identity); }
    await pending.catch(() => {}); const finishing = h.session.finish(); await h.close(); transportAssert.notEqual((await finishing).code, "PASSED", mode);
  }
});

transportTest("retention contradictory terminals and a physical EOF fence the next command", async () => {
  for (const mode of ["exit-duplicate", "close-first", "signal", "stdout-duplicate"]) {
    const h = transportHarness(); await h.identify(); const finishing = h.session.finish(); await h.endStreams("stdout", "stderr");
    if (mode === "close-first") { h.child.emit("close", 0, null); h.child.emit("exit", 0, null); }
    else if (mode === "signal") { h.child.emit("exit", null, "SIGTERM"); h.child.emit("close", null, "SIGTERM"); }
    else { h.child.emit("exit", 0, null); if (mode === "exit-duplicate") h.child.emit("exit", 0, null); if (mode === "stdout-duplicate") h.child.stdout.emit("end"); h.child.emit("close", 0, null); }
    transportAssert.equal((await finishing).code, "PROCESS_REFUSED");
    const count = h.writes.length; await transportAssert.rejects(h.session.request(transportStatement(transportContext, "HEALTH"))); transportAssert.equal(h.writes.length, count);
  }
});
