/**
 * Opt-in operator verification. Default/--prepare produces SQL only.
 * --execute requires an installed psql, personal SC_VERIFY_* environment and ACK.
 * No .env/credential-file loading, Auth fixtures, schema changes or SDK dependency.
 * Direct PostgreSQL or Session Pooler: https://supabase.com/docs/guides/database/psql
 * Evidence needs distinct overlapping backend PIDs, not merely concurrent HTTP.
 */
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROJECT_REF = 'rishenjoikgmfubmnfiu';
export const EXECUTION_ACK = `${PROJECT_REF}:login-rate-limit-only`;
const WORKERS = 6;
const SAFE_ERROR = 'VERIFICATION_FAILED';
class VerificationError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new VerificationError(code); };

export function createPlan() {
  const key = createHash('sha256').update('sc-concurrency:').update(randomBytes(32)).digest('hex');
  const runId = key.slice(0, 24);
  const names = Array.from({ length: WORKERS }, (_, i) => `sc.verify.${runId}.${i + 1}`);
  const preflight = `begin read only;
set local statement_timeout='10s';
select jsonb_build_object('owner',current_user,'database',current_database(),
 'version',current_setting('server_version_num')::integer,
 'key_absent',not exists(select 1 from app_private.rate_limits where scope='login' and subject_hash='${key}'),
 'rpc_granted',has_function_privilege('service_role','public.consume_rate_limit(text,text,uuid,uuid)','EXECUTE'));
rollback;`;
  const workers = names.map((name, i) => ({ id: i + 1, sql: `begin;
set local application_name='${name}';
set local statement_timeout='20s';
set local lock_timeout='15s';
set local idle_in_transaction_session_timeout='5s';
set local role service_role;
with entered as materialized (
 select clock_timestamp() as entered_at,pg_backend_pid() as backend_pid
), attempted as materialized (
 select entered.*,public.consume_rate_limit('login','${key}',null,null) as result from entered
), decided as materialized (
 select attempted.*,clock_timestamp() as decided_at from attempted
), held as materialized (
 select decided.*,pg_sleep(1) as observation_delay from decided
)
select jsonb_build_object('worker',${i + 1},'subject_hash','${key}','executed_as',current_user,
 'backend_pid',backend_pid,'entered_at',entered_at,'decided_at',decided_at,
 'finished_at',clock_timestamp(),'result',result) from held;
commit;` }));
  const assertion = `begin read only;
set local statement_timeout='10s';
select jsonb_build_object('rows',count(*),'hits',coalesce(max(cardinality(hits)),0),
 'pre_auth',coalesce(bool_and(user_id is null),false),
 'one_window',coalesce(bool_and((select max(h)-min(h)<interval '55 seconds' from unnest(hits) h)),false))
from app_private.rate_limits where scope='login' and subject_hash='${key}';
rollback;`;
  const cleanup = `begin;
set local statement_timeout='10s';
set local lock_timeout='5s';
do $$ begin
 if current_user<>'postgres' then raise exception 'Owner required.'; end if;
 perform pg_stat_clear_snapshot();
 if exists(select 1 from pg_stat_activity where application_name=any(array[${names.map(name => `'${name}'`).join(',')}])
  and pid<>pg_backend_pid() and (state<>'idle' or xact_start is not null)) then
  raise exception 'Worker still active; defer scoped cleanup.';
 end if;
 if exists(select 1 from app_private.rate_limits where scope='login' and subject_hash='${key}' and user_id is not null) then
  raise exception 'Unexpected owner; cleanup refused.';
 end if;
end $$;
with removed as (delete from app_private.rate_limits where scope='login' and subject_hash='${key}' and user_id is null returning subject_hash)
select jsonb_build_object('deleted',count(*)) from removed;
commit;`;
  const verifyCleanup = `begin read only;
set local statement_timeout='10s';
select jsonb_build_object('absent',not exists(select 1 from app_private.rate_limits where scope='login' and subject_hash='${key}'));
rollback;`;
  return { project: PROJECT_REF, subject_hash: key, preflight, workers, assertion, cleanup, verifyCleanup,
    limitations: ['No Auth user/session is created or used.', 'Does not verify command replay: that requires a separately authorized persisted test identity.', 'A successful limiter result without backend overlap is inconclusive.'] };
}

/** Builds a fresh child environment. Never inherit PGOPTIONS/PGSERVICE/.psqlrc. */
export function connectionConfig(env) {
  if (['CI', 'GITHUB_ACTIONS', 'VERCEL', 'NETLIFY', 'CF_PAGES', 'JENKINS_URL', 'BUILD_BUILDID'].some(key => env[key] && env[key] !== 'false')) fail('AUTOMATED_ENVIRONMENT_FORBIDDEN');
  if (env.SC_VERIFY_ACK !== EXECUTION_ACK) fail('EXPLICIT_PERSONAL_ACK_REQUIRED');
  const host = env.SC_VERIFY_PGHOST;
  const user = env.SC_VERIFY_PGUSER;
  const direct = host === `db.${PROJECT_REF}.supabase.co` && user === 'postgres';
  const sessionPooler = typeof host === 'string' && /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(host) && user === `postgres.${PROJECT_REF}`;
  if (!direct && !sessionPooler) fail('PERSONAL_DATABASE_TARGET_REQUIRED');
  if (env.SC_VERIFY_PGPORT !== '5432' || env.SC_VERIFY_PGDATABASE !== 'postgres') fail('DIRECT_OR_SESSION_POOLER_REQUIRED');
  if (!env.SC_VERIFY_PGPASSWORD || env.SC_VERIFY_PGPASSWORD.includes('\0')) fail('DATABASE_PASSWORD_ENV_REQUIRED');
  if (!env.SC_VERIFY_PSQL_BIN || !path.isAbsolute(env.SC_VERIFY_PSQL_BIN) || !/^psql(?:\.exe)?$/i.test(path.basename(env.SC_VERIFY_PSQL_BIN))) fail('ABSOLUTE_PSQL_BINARY_REQUIRED');
  if (!env.SC_VERIFY_PGSSLROOTCERT || !path.isAbsolute(env.SC_VERIFY_PGSSLROOTCERT)) fail('ABSOLUTE_PUBLIC_CA_CERT_REQUIRED');
  const childEnv = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'SystemDrive', 'WINDIR', 'TEMP', 'TMP', 'LANG'].filter(key => env[key]).map(key => [key, env[key]]));
  Object.assign(childEnv, { PGHOST: host, PGPORT: '5432', PGUSER: user, PGDATABASE: 'postgres',
    PGPASSWORD: env.SC_VERIFY_PGPASSWORD, PGSSLMODE: 'verify-full', PGSSLROOTCERT: env.SC_VERIFY_PGSSLROOTCERT,
    PGCONNECT_TIMEOUT: '8', PGAPPNAME: 'sc.verification', PGCLIENTENCODING: 'UTF8' });
  return { binary: env.SC_VERIFY_PSQL_BIN, env: childEnv };
}

/** Never expose stderr, subprocess errors, configuration or credential values. */
export function psqlTransport(config, spawnProcess = spawn) {
  return sql => new Promise((resolve, reject) => {
    let child;
    let output = '';
    let closed = false;
    let oversized = false;
    let expired = false;
    let timer;
    const finish = error => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      if (error) reject(new VerificationError(error));
      else {
        try {
          const lines = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          if (lines.length !== 1) fail('UNEXPECTED_DATABASE_OUTPUT');
          const value = JSON.parse(lines[0]);
          if (!value || typeof value !== 'object' || Array.isArray(value)) fail('UNEXPECTED_DATABASE_OUTPUT');
          resolve(value);
        } catch { reject(new VerificationError('UNEXPECTED_DATABASE_OUTPUT')); }
      }
    };
    try {
      child = spawnProcess(config.binary, ['--no-psqlrc', '--no-password', '--quiet', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1', '--file=-'],
        { env: config.env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => { output += chunk; if (output.length > 65536) { oversized = true; child.kill('SIGKILL'); } });
      child.stderr.on('data', () => {});
      child.on('error', () => finish('PSQL_PROCESS_UNAVAILABLE'));
      child.on('close', code => finish(expired ? 'PSQL_TIMEOUT' : oversized ? 'UNEXPECTED_DATABASE_OUTPUT' : code === 0 ? null : 'PSQL_QUERY_FAILED'));
      child.stdin.on('error', () => {});
      timer = setTimeout(() => { expired = true; child.kill('SIGKILL'); }, 45000);
      child.stdin.end(sql);
    } catch { finish('PSQL_PROCESS_UNAVAILABLE'); }
  });
}

export function assertEvidence(rows, subject) {
  if (!Array.isArray(rows) || rows.length !== WORKERS || JSON.stringify(rows.map(row => row.worker).sort()) !== '[1,2,3,4,5,6]') fail('SIX_DISTINCT_WORKERS_REQUIRED');
  for (const row of rows) {
    if (row.subject_hash !== subject || row.executed_as !== 'service_role') fail('WRONG_WORKER_SCOPE');
    if (!Number.isSafeInteger(row.backend_pid) || row.backend_pid < 1) fail('INVALID_BACKEND_PID');
    const times = [row.entered_at, row.decided_at, row.finished_at].map(Date.parse);
    if (times.some(value => !Number.isFinite(value)) || times[0] > times[1] || times[1] > times[2]) fail('INVALID_TIMING_EVIDENCE');
    if (typeof row.result?.allowed !== 'boolean' || !Number.isSafeInteger(row.result.remaining) || !Number.isSafeInteger(row.result.retry_after_ms)) fail('INVALID_LIMITER_RESPONSE');
  }
  const allowed = rows.filter(row => row.result.allowed);
  const denied = rows.filter(row => !row.result.allowed);
  if (allowed.length !== 5 || denied.length !== 1 || JSON.stringify(allowed.map(row => row.result.remaining).sort()) !== '[0,1,2,3,4]') fail('LIMITER_COUNT_FAILED');
  if (allowed.some(row => row.result.retry_after_ms !== 0) || denied[0].result.remaining !== 0 || denied[0].result.retry_after_ms <= 0 || denied[0].result.retry_after_ms > 60000) fail('LIMITER_RETRY_FAILED');
  if (Math.max(...rows.map(row => Date.parse(row.finished_at))) - Math.min(...rows.map(row => Date.parse(row.entered_at))) >= 55000) fail('OBSERVATION_WINDOW_EXCEEDED');
  if (!rows.some(a => rows.some(b => a.backend_pid !== b.backend_pid && Date.parse(a.entered_at) < Date.parse(b.finished_at) && Date.parse(b.entered_at) < Date.parse(a.finished_at)))) fail('CONCURRENCY_NOT_DEMONSTRATED');
  // Allowlist: never echo unexpected provider columns or tokens even on success.
  return rows.map(row => ({ worker: row.worker, backend_pid: row.backend_pid,
    entered_at: new Date(row.entered_at).toISOString(), decided_at: new Date(row.decided_at).toISOString(), finished_at: new Date(row.finished_at).toISOString(),
    allowed: row.result.allowed, remaining: row.result.remaining, retry_after_ms: row.result.retry_after_ms }));
}

export async function executePlan(runQuery, plan = createPlan()) {
  let workersStarted = false;
  let evidence;
  let reason;
  let cleanup = 'not-needed';
  try {
    const check = await runQuery(plan.preflight);
    if (check.owner !== 'postgres' || check.database !== 'postgres' || check.version < 170000 || check.version >= 180000 || !Number.isSafeInteger(check.version) || check.key_absent !== true || check.rpc_granted !== true) fail('PREFLIGHT_FAILED');
    workersStarted = true;
    const results = await Promise.allSettled(plan.workers.map(worker => Promise.resolve().then(() => runQuery(worker.sql))));
    if (results.some(result => result.status !== 'fulfilled')) fail('WORKER_FAILED');
    evidence = assertEvidence(results.map(result => result.value), plan.subject_hash);
    const assertion = await runQuery(plan.assertion);
    if (assertion.rows !== 1 || assertion.hits !== 5 || assertion.pre_auth !== true || assertion.one_window !== true) fail('DATABASE_ASSERTION_FAILED');
  } catch (error) { reason = error instanceof VerificationError ? error.code : SAFE_ERROR; }
  finally {
    if (workersStarted) {
      try {
        const deleted = await runQuery(plan.cleanup);
        if (deleted.deleted !== 0 && deleted.deleted !== 1) fail('CLEANUP_FAILED');
        if ((await runQuery(plan.verifyCleanup)).absent !== true) fail('CLEANUP_FAILED');
        cleanup = 'confirmed';
      } catch { cleanup = 'unconfirmed'; }
    }
  }
  return { project: PROJECT_REF, subject_hash: plan.subject_hash,
    status: !reason && cleanup === 'confirmed' ? 'passed' : 'failed',
    reason: reason ?? (cleanup === 'confirmed' ? null : 'CLEANUP_FAILED'), cleanup,
    ...(evidence ? { evidence } : {}),
    ...(cleanup === 'unconfirmed' ? { scoped_cleanup_sql: plan.cleanup, verify_cleanup_sql: plan.verifyCleanup } : {}),
    replay: 'not-tested-no-authorized-test-identity' };
}

export async function main(args, env, output = console.log) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--prepare')) {
    output(JSON.stringify(createPlan(), null, 2));
    return 0;
  }
  if (args.length === 1 && args[0] === '--help') {
    output('Default/--prepare: SQL only. --execute: opt-in personal login limiter only; requires SC_VERIFY_ACK, SC_VERIFY_PSQL_BIN, SC_VERIFY_PGHOST, SC_VERIFY_PGPORT=5432, SC_VERIFY_PGUSER, SC_VERIFY_PGDATABASE=postgres, SC_VERIFY_PGPASSWORD and SC_VERIFY_PGSSLROOTCERT. No .env loaded. SSL verify-full. Not for CI. No Auth fixtures/replay.');
    return 0;
  }
  if (args.length !== 1 || args[0] !== '--execute') fail('UNSUPPORTED_ARGUMENTS');
  const result = await executePlan(psqlTransport(connectionConfig(env)));
  output(JSON.stringify(result, null, 2));
  return result.status === 'passed' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = await main(process.argv.slice(2), process.env); }
  catch (error) {
    console.error(JSON.stringify({ status: 'failed', reason: error instanceof VerificationError ? error.code : SAFE_ERROR }));
    process.exitCode = 1;
  }
}
