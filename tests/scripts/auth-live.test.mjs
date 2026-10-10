import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { AUTH_LIVE_ACK, PROJECT_REF, fixtureManifest, isOwnedFixture, planFixtures, requireOptIn, runAuthLive, validateLiveEnvironment } from '../../scripts/verification/auth-live.mjs';

const CONFIG = { url: `https://${PROJECT_REF}.supabase.co`, publishable: 'sb_publishable_offline_fixture', secret: 'sb_secret_offline_fixture', rateSecret: 'r'.repeat(32) };
const success = data => ({ data, error: null });
const missing = () => ({ data: { user: null }, error: { code: 'user_not_found', status: 404 } });
const denied = () => ({ data: null, error: { code: '42501' } });

function fakeSDK(options = {}) {
  const users = new Map(), sessions = new Map(), calls = [], deleted = [], created = [], sdkOptions = [];
  const pendingCreates = new Map();
  let manifest;
  function createClient(url, key, config) {
    assert.equal(url, CONFIG.url);
    sdkOptions.push(config);
    const privileged = key === CONFIG.secret;
    let current;
    const staleToken = config.global.headers?.Authorization?.replace('Bearer ', '');
    const client = {
      auth: {
        admin: {
          async getUserById(id) {
            calls.push(['get', id]);
            if (options.collision && created.length === 0) return success({ user: { id, email: 'existing@example.invalid' } });
            return users.has(id) ? success({ user: users.get(id) }) : missing();
          },
          async createUser(attributes) {
            assert.equal(privileged, true);
            assert.equal(attributes.role, 'authenticated');
            assert.equal(attributes.email_confirm, true);
            assert.match(attributes.email, /^sc-auth-[a-f0-9]{32}-[ab]@example\.invalid$/);
            assert.ok(manifest.fixtures.some(fixture => fixture.id === attributes.id));
            calls.push(['create', attributes.id]);
            if (options.pendingCreate) {
              pendingCreates.set(attributes.id, { ...attributes, app_metadata: { ...attributes.app_metadata } });
              return { data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'provider-private-error-canary' } };
            }
            if (options.rejectedCreateStatus) return { data: { user: null }, error: { name: options.rejectedCreateName ?? (options.rejectedCreateStatus === 422 ? 'AuthWeakPasswordError' : 'AuthApiError'), status: options.rejectedCreateStatus, code: 'weak_password', message: 'provider-private-error-canary' } };
            users.set(attributes.id, { ...attributes, app_metadata: { ...attributes.app_metadata } });
            created.push(attributes.id);
            if (options.lostCreateResponse) throw new Error('password-and-key-secret-canary');
            return success({ user: users.get(attributes.id) });
          },
          async deleteUser(id, soft) {
            assert.equal(privileged, true);
            assert.equal(soft, false);
            calls.push(['delete', id]);
            if (options.failFirstDelete && id === created[0]) throw new Error('provider-private-error-canary');
            users.delete(id);
            deleted.push(id);
            return success({ user: null });
          },
        },
        async signInWithPassword({ email, password }) {
          current = [...users.values()].find(user => user.email === email && user.password === password);
          assert.ok(current);
          const token = `private-token-${current.id}`;
          sessions.set(token, { user: current, active: true });
          calls.push(['login', current.id]);
          return success({ user: current, session: { access_token: token } });
        },
        async getUser() { return success({ user: current }); },
        async getClaims() { return success({ claims: { sub: current.id, role: 'authenticated', session_id: 'a340b16b-868e-49c3-9b24-14b503c55dbb', exp: Math.floor(Date.now() / 1000) + 3600 } }); },
        async signOut({ scope }) {
          assert.equal(scope, 'global');
          calls.push(['logout', current.id]);
          for (const session of sessions.values()) if (session.user.id === current.id) session.active = false;
          current = undefined;
          return success(null);
        },
      },
      async rpc(name) {
        assert.equal(name, 'my_access_state');
        if (!current || staleToken) return denied();
        return success({ user_id: current.id, role: 'user', must_change_password: false });
      },
      from(table) {
        assert.ok(['profiles', 'user_roles'].includes(table));
        return {
          select(column) {
            assert.equal(column, 'user_id');
            return { async eq(field, id) {
              assert.equal(field, 'user_id');
              if (privileged) return success(users.has(id) ? [{ user_id: id }] : []);
              if (staleToken) { assert.equal(sessions.get(staleToken).active, false); return success([]); }
              if (!current) return denied();
              return success(current.id === id ? [{ user_id: id }] : []);
            } };
          },
          update(patch) {
            assert.deepEqual(patch, { role: 'master' });
            return { async eq(field, id) { assert.equal(field, 'user_id'); assert.equal(id, current.id); return denied(); } };
          },
        };
      },
    };
    return client;
  }
  return { users, sessions, calls, deleted, created, sdkOptions,
    commitPendingCreates() { for (const [id, user] of pendingCreates) { users.set(id, user); created.push(id); calls.push(['late-create', id]); } pendingCreates.clear(); },
    dependencies: { createClient, loadConfiguration: async () => CONFIG, saveManifest: async value => { manifest = structuredClone(value); return `work/auth-live/${value.run_id}.json`; } },
  };
}

test('requires explicit personal acknowledgement and rejects automation before reading configuration', async () => {
  let reads = 0;
  const dependencies = { loadConfiguration: async () => { reads++; return CONFIG; } };
  await assert.rejects(runAuthLive({ environment: {} }, dependencies), /EXPLICIT_PERSONAL_ACK_REQUIRED/);
  for (const name of ['CI', 'GITHUB_ACTIONS', 'VERCEL', 'NETLIFY', 'CF_PAGES', 'JENKINS_URL', 'BUILD_BUILDID']) {
    await assert.rejects(runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: { [name]: 'true' } }, dependencies), /AUTOMATED_ENVIRONMENT_FORBIDDEN/);
  }
  assert.equal(reads, 0);
  requireOptIn(AUTH_LIVE_ACK, { CI: 'false' });
});

test('configuration is literal, complete and restricted to the personal project even in demo', async () => {
  const environment = { APP_MODE: 'demo', APP_URL: 'http://localhost:3000', SUPABASE_URL: CONFIG.url,
    SUPABASE_PUBLISHABLE_KEY: CONFIG.publishable, SUPABASE_SECRET_KEY: CONFIG.secret,
    AUTH_RATE_LIMIT_SECRET: CONFIG.rateSecret, AUTH_STATE_SECRET: 's'.repeat(32) };
  assert.deepEqual(await validateLiveEnvironment(environment), CONFIG);
  for (const override of [{ SUPABASE_URL: 'https://another.supabase.co' }, { SUPABASE_SECRET_KEY: '' }, { AUTH_STATE_SECRET: '$OTHER_SECRET' }]) {
    await assert.rejects(validateLiveEnvironment({ ...environment, ...override }), /PERSONAL_AUTH_CONFIGURATION_REQUIRED|LITERAL_ENV_VALUES_REQUIRED/);
  }
});

test('manifest contains only synthetic identities and exact application login HMACs', () => {
  const plan = planFixtures(CONFIG.rateSecret), other = planFixtures(CONFIG.rateSecret);
  const manifest = fixtureManifest(plan);
  assert.notEqual(plan.runId, other.runId);
  assert.equal(new Set([...plan.fixtures, ...other.fixtures].map(value => value.id)).size, 4);
  assert.deepEqual(Object.keys(manifest).sort(), ['fixtures', 'project', 'run_id']);
  for (const fixture of plan.fixtures) {
    assert.ok(Buffer.byteLength(fixture.password) >= 40 && Buffer.byteLength(fixture.password) <= 72);
    assert.equal(fixture.login_subject_hash, createHmac('sha256', CONFIG.rateSecret).update(JSON.stringify(['login', fixture.email])).digest('hex'));
    assert.equal(JSON.stringify(manifest).includes(fixture.password), false);
    assert.deepEqual(Object.keys(manifest.fixtures.find(value => value.id === fixture.id)).sort(), ['email', 'id', 'login_subject_hash']);
    assert.equal(isOwnedFixture({ ...fixture, app_metadata: { sc_auth_live_run: plan.runId, sc_auth_live_slot: fixture.slot } }, fixture, plan.runId), true);
    assert.equal(isOwnedFixture({ ...fixture, user_metadata: { sc_auth_live_run: plan.runId, sc_auth_live_slot: fixture.slot } }, fixture, plan.runId), false);
  }
});

test('SDK checks precede the browser callback; exact fixtures are cleaned and output is redacted', async () => {
  const fake = fakeSDK(), passwords = [], observed = [];
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {}, onStatus: entry => observed.push(entry),
    onFixtures: async ({ fixtures, clients }) => {
      assert.equal(fake.calls.filter(([kind]) => kind === 'logout').length, 2);
      assert.equal(clients.length, 2);
      for (const fixture of fixtures) passwords.push(fixture.password);
      fixtures[0].id = 'untrusted-callback-id';
      return 'private-callback-return-canary';
    },
  }, fake.dependencies);
  assert.equal(report.status, 'passed');
  assert.equal(report.cleanup, 'confirmed');
  assert.deepEqual(report.create_outcomes, fake.created.map(id => ({ id, outcome: 'confirmed' })));
  assert.equal(fake.users.size, 0);
  assert.deepEqual(fake.deleted, fake.created);
  assert.equal(observed.length, report.steps.length);
  const output = JSON.stringify(report);
  for (const value of [...passwords, CONFIG.secret, CONFIG.publishable, CONFIG.rateSecret, 'private-token-', 'private-callback-return-canary', 'untrusted-callback-id']) assert.equal(output.includes(value), false);
  assert.equal(report.steps.filter(step => step.label.includes('old-jwt')).length, 4);
  assert.equal(report.login_limiter_cleanup, 'verify-and-remove-exact-manifest-hashes-via-authorized-sql');
  for (const options of fake.sdkOptions) assert.deepEqual([options.auth.persistSession, options.auth.autoRefreshToken, options.auth.detectSessionInUrl, options.auth.debug], [false, false, false, false]);
});

test('callback errors never leak data or skip cleanup, even if status observer throws', async () => {
  const fake = fakeSDK();
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {}, onStatus() { throw new Error('private-observer-canary'); },
    onFixtures() { throw Object.assign(new Error('private-callback-canary'), { code: 'private-code-canary' }); } }, fake.dependencies);
  assert.equal(report.status, 'failed');
  assert.equal(report.cleanup, 'confirmed');
  assert.equal(fake.users.size, 0);
  assert.equal(report.steps.find(step => step.label === 'application.callback').code, 'PROVIDER_OR_CALLBACK_FAILED');
  assert.equal(JSON.stringify(report).includes('canary'), false);
});

test('without a cleanup guard the default SDK run keeps its original 28 steps', async () => {
  const fake = fakeSDK();
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {} }, fake.dependencies);
  assert.equal(report.status, 'passed');
  assert.equal(report.cleanup, 'confirmed');
  assert.equal(report.steps.length, 28);
  assert.equal(report.steps.some(step => step.label.endsWith('.guard')), false);
  assert.deepEqual(fake.deleted, fake.created);
});

test('a blocked resource cleanup guard preserves the first Auth fixture and still cleans the second', async () => {
  const fake = fakeSDK(), guarded = [];
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {},
    beforeFixtureCleanup: async context => { guarded.push(context.fixture_id); return context.slot === 'b'; },
  }, fake.dependencies);
  assert.equal(report.status, 'failed');
  assert.equal(report.cleanup, 'unconfirmed');
  assert.deepEqual(guarded, fake.created);
  assert.equal(fake.users.has(fake.created[0]), true);
  assert.equal(fake.users.has(fake.created[1]), false);
  assert.deepEqual(fake.deleted, [fake.created[1]]);
  assert.equal(fake.calls.filter(([kind, id]) => kind === 'get' && id === fake.created[0]).length, 1);
  assert.deepEqual(report.steps.find(step => step.label === 'cleanup.a.guard'), { label: 'cleanup.a.guard', status: 'failed', code: 'FIXTURE_CLEANUP_GUARD_BLOCKED' });
  assert.equal(report.steps.some(step => ['cleanup.a.owned-fixture', 'cleanup.a.absence-confirmed'].includes(step.label)), false);
  assert.equal(report.steps.find(step => step.label === 'cleanup.b.absence-confirmed').status, 'passed');
});

test('the resource cleanup guard requires exactly true, never a truthy or missing acknowledgement', async () => {
  for (const value of [undefined, null, 1, 'true', { confirmed: true }]) {
    const fake = fakeSDK();
    const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {},
      beforeFixtureCleanup: context => context.slot === 'a' ? value : true,
    }, fake.dependencies);
    assert.equal(report.cleanup, 'unconfirmed');
    assert.equal(fake.users.has(fake.created[0]), true);
    assert.deepEqual(fake.deleted, [fake.created[1]]);
    assert.equal(report.steps.find(step => step.label === 'cleanup.a.guard').code, 'FIXTURE_CLEANUP_GUARD_BLOCKED');
  }
});

test('the awaited guard receives frozen original-plan identifiers without callback secrets or mutations', async () => {
  const fake = fakeSDK(), contexts = [], passwords = [];
  let release, reached;
  const pending = new Promise(resolve => { release = resolve; });
  const guardReached = new Promise(resolve => { reached = resolve; });
  const running = runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {},
    onFixtures({ fixtures }) {
      passwords.push(...fixtures.map(fixture => fixture.password));
      fixtures[0].id = 'untrusted-callback-id';
      fixtures[0].email = 'untrusted@example.invalid';
      fixtures[0].password = 'untrusted-password-canary';
    },
    async beforeFixtureCleanup(context) {
      assert.equal(Object.isFrozen(context), true);
      assert.deepEqual(Object.keys(context).sort(), ['fixture_id', 'run_id', 'slot']);
      assert.throws(() => { context.fixture_id = 'untrusted-guard-id'; }, TypeError);
      contexts.push(context);
      if (context.slot === 'a') { reached(); await pending; }
      return true;
    },
  }, fake.dependencies);
  await guardReached;
  // No Auth lookup, deletion or absence assertion may bypass a pending guard.
  assert.equal(fake.users.size, 2);
  assert.equal(fake.deleted.length, 0);
  assert.equal(fake.calls.filter(([kind]) => kind === 'get').length, 2);
  release();
  const report = await running;
  assert.equal(report.status, 'passed');
  assert.equal(report.cleanup, 'confirmed');
  assert.deepEqual(contexts, fake.created.map((fixture_id, index) => ({ fixture_id, run_id: report.fixture_manifest.run_id, slot: index === 0 ? 'a' : 'b' })));
  assert.deepEqual(fake.deleted, fake.created);
  const output = JSON.stringify({ contexts, report });
  for (const secret of [...passwords, CONFIG.secret, CONFIG.publishable, CONFIG.rateSecret, 'private-token-', 'untrusted-callback-id', 'untrusted-password-canary']) assert.equal(output.includes(secret), false);
});

test('current Auth absence cannot certify external bytes when the cleanup guard blocks', async () => {
  const fake = fakeSDK(), externalObjects = new Set();
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {},
    onFixtures({ fixtures }) {
      externalObjects.add(fixtures[0].id);
      fake.users.delete(fixtures[0].id); // The provider would now return 404.
    },
    beforeFixtureCleanup: context => !externalObjects.has(context.fixture_id),
  }, fake.dependencies);
  assert.equal(fake.users.size, 0);
  assert.equal(externalObjects.has(fake.created[0]), true);
  assert.equal(report.status, 'failed');
  assert.equal(report.cleanup, 'unconfirmed');
  assert.deepEqual(fake.deleted, [fake.created[1]]);
  assert.equal(report.steps.find(step => step.label === 'cleanup.a.guard').code, 'FIXTURE_CLEANUP_GUARD_BLOCKED');
  assert.equal(report.steps.some(step => step.label === 'cleanup.a.absence-confirmed'), false);
  assert.equal(fake.calls.filter(([kind, id]) => kind === 'get' && id === fake.created[0]).length, 1);
});

test('a cleanup guard exception is closed and does not leak provider data or skip the other fixture', async () => {
  const fake = fakeSDK(), observed = [];
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {}, onStatus: value => observed.push(value),
    beforeFixtureCleanup(context) {
      if (context.slot === 'a') throw Object.assign(new Error('guard-password-token-provider-canary'), { code: '42501', data: 'guard-private-payload-canary' });
      return true;
    },
  }, fake.dependencies);
  assert.equal(report.status, 'failed');
  assert.equal(report.cleanup, 'unconfirmed');
  assert.equal(fake.users.has(fake.created[0]), true);
  assert.deepEqual(fake.deleted, [fake.created[1]]);
  assert.deepEqual(report.steps.find(step => step.label === 'cleanup.a.guard'), { label: 'cleanup.a.guard', status: 'failed', code: 'FIXTURE_CLEANUP_GUARD_BLOCKED' });
  assert.equal(JSON.stringify({ report, observed }).includes('canary'), false);
});

test('a lost create response permits scoped cleanup but cannot certify it without a definite create outcome', async () => {
  const fake = fakeSDK({ lostCreateResponse: true });
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {} }, fake.dependencies);
  assert.equal(report.status, 'failed');
  assert.equal(report.cleanup, 'unconfirmed');
  assert.equal(fake.users.size, 0);
  assert.equal(fake.created.length, 1);
  assert.deepEqual(fake.deleted, fake.created);
  assert.deepEqual(report.create_outcomes, [{ id: fake.created[0], outcome: 'unknown' }]);
  assert.equal(report.steps.find(step => step.label === 'cleanup.a.absence-confirmed').code, 'CREATE_OUTCOME_UNKNOWN');
  assert.equal(JSON.stringify(report).includes('canary'), false);
});

test('a CREATE still pending after all 404 reads may commit later and cleanup remains unconfirmed', async () => {
  const fake = fakeSDK({ pendingCreate: true });
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {} }, fake.dependencies);
  const id = report.fixture_manifest.fixtures[0].id;
  assert.equal(report.status, 'failed');
  assert.equal(report.cleanup, 'unconfirmed');
  assert.deepEqual(report.create_outcomes, [{ id, outcome: 'unknown' }]);
  assert.equal(fake.users.size, 0);
  assert.equal(fake.deleted.length, 0);
  assert.deepEqual(fake.calls, [['get', id], ['create', id], ['get', id], ['get', id]]);
  assert.deepEqual(report.steps.find(step => step.label === 'cleanup.a.absence-confirmed'), { label: 'cleanup.a.absence-confirmed', status: 'failed', code: 'CREATE_OUTCOME_UNKNOWN' });
  // The controlled late commit occurs AFTER the harness has observed absence.
  // The old implementation incorrectly returned cleanup=confirmed at this point.
  fake.commitPendingCreates();
  assert.equal(fake.users.size, 1);
  assert.equal(isOwnedFixture(fake.users.get(id), { ...report.fixture_manifest.fixtures[0], slot: 'a' }, report.fixture_manifest.run_id), true);
  assert.equal(report.cleanup, 'unconfirmed');
  assert.equal(JSON.stringify(report).includes('canary'), false);
});

test('an explicit provider validation rejection can confirm absence without creating or deleting a user', async () => {
  const fake = fakeSDK({ rejectedCreateStatus: 422 });
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {} }, fake.dependencies);
  assert.equal(report.status, 'failed');
  assert.equal(report.cleanup, 'confirmed');
  assert.deepEqual(report.create_outcomes, [{ id: report.fixture_manifest.fixtures[0].id, outcome: 'rejected' }]);
  assert.equal(report.steps.find(step => step.label === 'fixture.a.create').code, 'weak_password');
  assert.equal(fake.created.length, 0);
  assert.equal(fake.deleted.length, 0);
  assert.equal(JSON.stringify(report).includes('canary'), false);
});

test('timeout responses and server errors cannot be mistaken for a definite provider rejection', async () => {
  for (const [status, name] of [[408, 'AuthApiError'], [499, 'AuthApiError'], [500, 'AuthApiError'], [503, 'AuthApiError'], [422, 'AuthUnknownError']]) {
    const fake = fakeSDK({ rejectedCreateStatus: status, rejectedCreateName: name });
    const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {} }, fake.dependencies);
    assert.equal(report.status, 'failed');
    assert.equal(report.cleanup, 'unconfirmed');
    assert.deepEqual(report.create_outcomes, [{ id: report.fixture_manifest.fixtures[0].id, outcome: 'unknown' }]);
    assert.equal(report.steps.find(step => step.label === 'cleanup.a.absence-confirmed').code, 'CREATE_OUTCOME_UNKNOWN');
    assert.equal(JSON.stringify(report).includes('canary'), false);
  }
});

test('preexisting UUID refuses creation and never deletes an existing account', async () => {
  const fake = fakeSDK({ collision: true });
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {} }, fake.dependencies);
  assert.equal(report.status, 'failed');
  assert.equal(fake.created.length, 0);
  assert.equal(fake.deleted.length, 0);
});

test('cleanup refuses mismatched server metadata and continues cleaning the second fixture', async () => {
  const fake = fakeSDK();
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {}, onFixtures: ({ fixtures }) => {
    fake.users.get(fixtures[0].id).app_metadata.sc_auth_live_run = 'some-other-run';
  } }, fake.dependencies);
  assert.equal(report.status, 'failed');
  assert.equal(report.cleanup, 'unconfirmed');
  assert.deepEqual(fake.deleted, [fake.created[1]]);
  assert.equal(report.steps.find(step => step.label === 'cleanup.a.owned-fixture').code, 'FIXTURE_MARKER_MISMATCH');
});

test('cleanup network failure is reported and does not prevent the other fixture cleanup', async () => {
  const fake = fakeSDK({ failFirstDelete: true });
  const report = await runAuthLive({ acknowledge: AUTH_LIVE_ACK, environment: {} }, fake.dependencies);
  assert.equal(report.status, 'failed');
  assert.equal(report.cleanup, 'unconfirmed');
  assert.deepEqual(fake.deleted, [fake.created[1]]);
  assert.equal(JSON.stringify(report).includes('provider-private-error-canary'), false);
});
