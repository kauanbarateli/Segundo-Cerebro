/** Opt-in temporary Auth fixtures. Never runs at import, in CI, or by default.
 * Configuration comes only from this repo's regular .env.local; no values logged.
 * Docs: /docs/reference/javascript/auth-admin-createuser, auth-admin-deleteuser,
 * auth-getclaims and auth-signout on supabase.com; SDK pinned by the repository.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { diagnoseAuthEnvironment } from '../check-auth-env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const PROJECT_REF = 'rishenjoikgmfubmnfiu';
const ORIGIN = `https://${PROJECT_REF}.supabase.co`;
export const AUTH_LIVE_ACK = `${PROJECT_REF}:temporary-auth-fixtures`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_CODES = new Set(['42501', 'PGRST301', 'invalid_credentials', 'email_not_confirmed', 'user_not_found', 'over_request_rate_limit', 'over_email_send_rate_limit', 'weak_password']);
class AuthLiveError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new AuthLiveError(code); };
const ensure = ok => { if (!ok) fail('ASSERTION_FAILED'); };
const codeOf = error => error instanceof AuthLiveError ? error.code : ALLOWED_CODES.has(error?.code) ? error.code : 'PROVIDER_OR_CALLBACK_FAILED';
const notFound = response => response?.error?.code === 'user_not_found' && response.error.status === 404 && !response.data?.user;

export function requireOptIn(acknowledge, environment) {
  if (['CI', 'GITHUB_ACTIONS', 'VERCEL', 'NETLIFY', 'CF_PAGES', 'JENKINS_URL', 'BUILD_BUILDID'].some(name => environment[name] && environment[name] !== 'false')) fail('AUTOMATED_ENVIRONMENT_FORBIDDEN');
  if (acknowledge !== AUTH_LIVE_ACK) fail('EXPLICIT_PERSONAL_ACK_REQUIRED');
}

export async function validateLiveEnvironment(parsed) {
  if (Object.values(parsed).some(value => typeof value === 'string' && value.includes('$'))) fail('LITERAL_ENV_VALUES_REQUIRED');
  const report = await diagnoseAuthEnvironment(parsed);
  if (!report.ready || parsed.SUPABASE_URL?.trim() !== ORIGIN) fail('PERSONAL_AUTH_CONFIGURATION_REQUIRED');
  return { url: ORIGIN, publishable: parsed.SUPABASE_PUBLISHABLE_KEY.trim(), secret: parsed.SUPABASE_SECRET_KEY.trim(), rateSecret: parsed.AUTH_RATE_LIMIT_SECRET.trim() };
}

async function loadConfiguration() {
  try {
    const filename = join(ROOT, '.env.local');
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) fail('REGULAR_REPOSITORY_ENV_REQUIRED');
    return await validateLiveEnvironment(parseEnv(await readFile(filename, 'utf8')));
  } catch (error) { if (error instanceof AuthLiveError) throw error; fail('LOCAL_CONFIGURATION_UNAVAILABLE'); }
}

export function planFixtures(rateSecret) {
  const runId = randomBytes(16).toString('hex');
  const fixtures = ['a', 'b'].map(slot => {
    const email = `sc-auth-${runId}-${slot}@example.invalid`;
    return { id: randomUUID(), email, slot, password: `Sc9!${randomBytes(32).toString('base64url')}`,
      login_subject_hash: createHmac('sha256', rateSecret).update(JSON.stringify(['login', email])).digest('hex') };
  });
  return { runId, fixtures };
}

export function fixtureManifest(plan) {
  return { project: PROJECT_REF, run_id: plan.runId,
    fixtures: plan.fixtures.map(({ id, email, login_subject_hash }) => ({ id, email, login_subject_hash })) };
}

export function isOwnedFixture(user, fixture, runId) {
  return user?.id === fixture.id && user.email === fixture.email &&
    user.app_metadata?.sc_auth_live_run === runId && user.app_metadata?.sc_auth_live_slot === fixture.slot;
}

async function saveManifest(manifest) {
  const directory = join(ROOT, 'work', 'auth-live');
  await mkdir(directory, { recursive: true });
  const filename = join(directory, `${manifest.run_id}.json`);
  await writeFile(filename, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return relative(ROOT, filename).replaceAll('\\', '/');
}

function sdkFactory(createClient, config) {
  let clientNumber = 0;
  return (privileged = false, token) => createClient(config.url, privileged ? config.secret : config.publishable, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, debug: false,
      storageKey: `sc-auth-live-${randomUUID()}-${++clientNumber}` },
    global: {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      fetch: (input, init = {}) => {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
        if (url.origin !== ORIGIN) fail('UNEXPECTED_NETWORK_TARGET');
        const timeout = AbortSignal.timeout(15000);
        return fetch(input, { ...init, redirect: 'error', cache: 'no-store', signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
      },
    },
  });
}

/**
 * onFixtures({fixtures:[{id,email,password}],clients}) runs AFTER SDK revocation.
 * It may log in through the app/change a fixture password, but must not serialize
 * credentials, tokens, clients, traces or FormData. Return values are discarded.
 * Second argument is dependency injection for offline tests only.
 */
export async function runAuthLive({ acknowledge, environment = process.env, onFixtures, onStatus } = {}, dependencies = {}) {
  requireOptIn(acknowledge, environment);
  const config = await (dependencies.loadConfiguration ?? loadConfiguration)();
  if (config.url !== ORIGIN) fail('PERSONAL_AUTH_CONFIGURATION_REQUIRED');
  const createClient = dependencies.createClient ?? (await import('@supabase/supabase-js')).createClient;
  const makeClient = sdkFactory(createClient, config);
  const plan = planFixtures(config.rateSecret);
  const manifest = fixtureManifest(plan);
  // Known random IDs are persisted before any write: even a lost create response
  // can be reconciled by exact ID + server-owned marker, without listing users.
  const manifestPath = await (dependencies.saveManifest ?? saveManifest)(manifest);
  const admin = makeClient(true);
  const clients = [];
  const attempted = new Set();
  const steps = [];
  let failed = false;
  let cleanupConfirmed = true;
  async function step(label, work) {
    try {
      const value = await work();
      const entry = { label, status: 'passed' };
      steps.push(entry);
      try { onStatus?.(entry); } catch { /* An observer cannot skip cleanup. */ }
      return value;
    } catch (error) {
      const entry = { label, status: 'failed', code: codeOf(error) };
      steps.push(entry);
      try { onStatus?.(entry); } catch { /* Never log raw callback errors. */ }
      throw new AuthLiveError(entry.code);
    }
  }
  const ok = response => { if (response?.error) throw response.error; return response.data; };
  try {
    for (const fixture of plan.fixtures) {
      await step(`fixture.${fixture.slot}.preflight`, async () => ensure(notFound(await admin.auth.admin.getUserById(fixture.id))));
      await step(`fixture.${fixture.slot}.create`, async () => {
        attempted.add(fixture.id);
        const data = ok(await admin.auth.admin.createUser({ id: fixture.id, email: fixture.email, password: fixture.password,
          email_confirm: true, role: 'authenticated', app_metadata: { sc_auth_live_run: plan.runId, sc_auth_live_slot: fixture.slot } }));
        ensure(isOwnedFixture(data?.user, fixture, plan.runId));
      });
    }
    for (const fixture of plan.fixtures) {
      const client = makeClient();
      clients.push(client);
      let token;
      await step(`auth.${fixture.slot}.sign-in`, async () => {
        const data = ok(await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password }));
        ensure(data?.user?.id === fixture.id && typeof data.session?.access_token === 'string');
        token = data.session.access_token;
      });
      await step(`auth.${fixture.slot}.verified-user-claims`, async () => {
        ensure(ok(await client.auth.getUser())?.user?.id === fixture.id);
        const claims = ok(await client.auth.getClaims())?.claims;
        ensure(claims?.sub === fixture.id && claims.role === 'authenticated' && UUID.test(claims.session_id) && claims.exp * 1000 > Date.now() + 60000);
      });
      await step(`auth.${fixture.slot}.access-state`, async () => {
        const data = ok(await client.rpc('my_access_state'));
        ensure(data?.user_id === fixture.id && data.role === 'user' && data.must_change_password === false);
      });
      await step(`rls.${fixture.slot}.own-profile`, async () => {
        const data = ok(await client.from('profiles').select('user_id').eq('user_id', fixture.id));
        ensure(Array.isArray(data) && data.length === 1 && data[0].user_id === fixture.id);
      });
      await step(`rls.${fixture.slot}.other-profile`, async () => {
        const other = plan.fixtures.find(value => value.id !== fixture.id);
        const data = ok(await client.from('profiles').select('user_id').eq('user_id', other.id));
        ensure(Array.isArray(data) && data.length === 0);
      });
      await step(`rls.${fixture.slot}.direct-role-write-denied`, async () => {
        const response = await client.from('user_roles').update({ role: 'master' }).eq('user_id', fixture.id);
        ensure(response.error?.code === '42501');
      });
      await step(`auth.${fixture.slot}.logout-global`, async () => ok(await client.auth.signOut({ scope: 'global' })));
      const stale = makeClient(false, token);
      await step(`auth.${fixture.slot}.old-jwt-rpc-denied`, async () => ensure((await stale.rpc('my_access_state')).error?.code === '42501'));
      await step(`auth.${fixture.slot}.old-jwt-rls-empty`, async () => {
        const data = ok(await stale.from('profiles').select('user_id').eq('user_id', fixture.id));
        ensure(Array.isArray(data) && data.length === 0);
      });
      token = undefined;
    }
    const anonymous = makeClient();
    await step('rls.anonymous.profile-denied', async () => ensure((await anonymous.from('profiles').select('user_id').eq('user_id', plan.fixtures[0].id)).error?.code === '42501'));
    await step('rls.anonymous.access-state-denied', async () => ensure((await anonymous.rpc('my_access_state')).error?.code === '42501'));
    if (onFixtures) await step('application.callback', () => onFixtures({
      fixtures: plan.fixtures.map(({ id, email, password }) => ({ id, email, password })), clients,
    }));
  } catch { failed = true; }
  finally {
    // Never use callback-supplied IDs/emails or enumerate Auth users for cleanup.
    for (const fixture of plan.fixtures.filter(value => attempted.has(value.id))) {
      try {
        await step(`cleanup.${fixture.slot}.owned-fixture`, async () => {
          const response = await admin.auth.admin.getUserById(fixture.id);
          if (notFound(response)) return;
          const data = ok(response);
          if (!isOwnedFixture(data?.user, fixture, plan.runId)) fail('FIXTURE_MARKER_MISMATCH');
          ok(await admin.auth.admin.deleteUser(fixture.id, false));
        });
        await step(`cleanup.${fixture.slot}.absence-confirmed`, async () => {
          ensure(notFound(await admin.auth.admin.getUserById(fixture.id)));
          for (const table of ['profiles', 'user_roles']) {
            const data = ok(await admin.from(table).select('user_id').eq('user_id', fixture.id));
            ensure(Array.isArray(data) && data.length === 0);
          }
        });
      } catch { cleanupConfirmed = false; }
      fixture.password = '';
    }
  }
  return { status: !failed && cleanupConfirmed ? 'passed' : 'failed', project: PROJECT_REF,
    steps, cleanup: cleanupConfirmed ? 'confirmed' : 'unconfirmed', manifest_path: manifestPath,
    fixture_manifest: manifest,
    login_limiter_cleanup: onFixtures ? 'verify-and-remove-exact-manifest-hashes-via-authorized-sql' : 'not-used-by-sdk',
    smtp: 'not-tested', master: 'untouched' };
}

async function cli() {
  if (process.argv.length === 2 || process.argv[2] === '--help') {
    console.log(`No remote work by default. Use --execute and SC_AUTH_LIVE_ACK=${AUTH_LIVE_ACK} only after review. Reads only repository .env.local; creates/deletes two marked synthetic Auth fixtures; no SMTP or personal user access.`);
    return;
  }
  if (process.argv.length !== 3 || process.argv[2] !== '--execute') fail('UNSUPPORTED_ARGUMENTS');
  const result = await runAuthLive({ acknowledge: process.env.SC_AUTH_LIVE_ACK });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'passed' ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  cli().catch(error => { console.error(JSON.stringify({ status: 'failed', code: codeOf(error) })); process.exitCode = 1; });
}
