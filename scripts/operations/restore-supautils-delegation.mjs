import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BackupError } from "./backup-format.mjs";
import { queryPostgres } from "./postgres-process.mjs";
import { restoreConfiguration } from "./restore-target.mjs";

export const SUPAUTILS_DELEGATION_TIMEOUT_MS = 15000;
// Factual configuration and a reversible local SET probe only. Not a policy
// CREATE test, a hook-version certificate, or authorization for a restore.
// Source: supabase/supautils src/{privileged_role,policy_grants,utils}.c.
// Custom result GUC is LOCAL; no relation, function or policy is created.
export const SUPAUTILS_DELEGATION_SQL = `begin transaction isolation level repeatable read read only;
set local statement_timeout = '10s';
set local lock_timeout = '3s';
set local search_path = pg_catalog;
do $second_brain_delegation$
declare
  actor text := current_user;
  initial_mode text := current_setting('session_replication_role');
  privileged_registered boolean;
  policy_registered boolean;
  privileged_role text;
  allowed_configs text;
  policy_config json;
  privileged boolean := false;
  allowed boolean := false;
  objects_granted boolean := false;
  buckets_granted boolean := false;
  replica_observed boolean := false;
  origin_observed boolean := false;
  denied boolean := false;
  config_format_supported boolean := false;
  token text;
  entry record;
  relation json;
  configured_oid oid;
  target_objects oid := to_regclass('storage.objects');
  target_buckets oid := to_regclass('storage.buckets');
begin
  if current_setting('server_encoding') <> 'UTF8' then
    raise sqlstate '22023';
  end if;
  select count(*) = 2 into privileged_registered
    from pg_settings where name in ('supautils.privileged_role', 'supautils.privileged_role_allowed_configs')
      and context = 'sighup' and vartype = 'string';
  select count(*) = 1 into policy_registered
    from pg_settings where name = 'supautils.policy_grants' and context = 'sighup' and vartype = 'string';
  if privileged_registered then
    privileged_role := current_setting('supautils.privileged_role', true);
    select coalesce(bool_or(pg_has_role(r.oid, 'USAGE')), false) into privileged
      from pg_roles r where r.rolname = privileged_role;
    allowed_configs := coalesce(current_setting('supautils.privileged_role_allowed_configs', true), '');
    -- A qualified ASCII subset of SplitIdentifierString only. Unsupported
    -- quoting/escapes/long identifiers leave configuration unknown; they never
    -- suppress or invalidate the independent live SET/readback probe.
    config_format_supported := allowed_configs ~ '^[[:space:]]*("[A-Za-z0-9_.*]+"|[A-Za-z0-9_.*]+)([[:space:]]*,[[:space:]]*("[A-Za-z0-9_.*]+"|[A-Za-z0-9_.*]+))*[[:space:]]*$';
    config_format_supported := config_format_supported and translate(regexp_replace(allowed_configs, '[A-Za-z0-9_.*",]', '', 'g'), ' ' || chr(9) || chr(10) || chr(13) || chr(12), '') = '';
    if config_format_supported then
      for token in select btrim(value, ' ' || chr(9) || chr(10) || chr(13) || chr(12))
        from unnest(string_to_array(allowed_configs, ',')) as value loop
        if left(token, 1) = '"' then
          token := substr(token, 2, length(token) - 2);
        else
          token := translate(token, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz');
        end if;
        if length(token) > 63 then config_format_supported := false; end if;
        allowed := allowed or token = 'session_replication_role'
          or (length(token) between 2 and 63 and right(token, 1) = '*' and left('session_replication_role', length(token) - 1) = left(token, length(token) - 1));
      end loop;
    end if;
  end if;
  if policy_registered then
    policy_config := nullif(current_setting('supautils.policy_grants', true), '')::json;
    if policy_config is not null then
      if json_typeof(policy_config) <> 'object' then raise sqlstate '22023'; end if;
      -- JSON rather than JSONB preserves repeated role keys. Supautils visits
      -- every matching exact role key; membership does not substitute a key.
      for entry in select key, value from json_each(policy_config) loop
        if json_typeof(entry.value) <> 'array' then raise sqlstate '22023'; end if;
        for relation in select value from json_array_elements(entry.value) loop
          if json_typeof(relation) <> 'string' then raise sqlstate '22023'; end if;
          if entry.key = actor then
            configured_oid := to_regclass(relation #>> '{}');
            objects_granted := objects_granted or coalesce(configured_oid = target_objects, false);
            buckets_granted := buckets_granted or coalesce(configured_oid = target_buckets, false);
          end if;
        end loop;
      end loop;
    end if;
  end if;
  if initial_mode = 'origin' then
    begin
      -- VariableSetStmt reaches ProcessUtility; set_config() is deliberately
      -- not used to request replication mode through Supautils.
      execute 'SET LOCAL session_replication_role = replica';
      replica_observed := current_setting('session_replication_role') = 'replica';
      execute 'SET LOCAL session_replication_role = origin';
      origin_observed := current_setting('session_replication_role') = 'origin';
    exception when insufficient_privilege then
      -- Only 42501 is factual denial. The subtransaction rolls local GUC
      -- changes back; other SQLSTATEs abort and are sanitized by the runner.
      denied := true;
    end;
  end if;
  perform set_config('second_brain_operator.supautils_report', jsonb_build_object(
    'version', 1,
    'sameActor', current_user = session_user and current_user = actor,
    'readOnly', current_setting('transaction_read_only') = 'on',
    'privilegedSettingsRegistered', privileged_registered,
    'policySettingsRegistered', policy_registered,
    'currentRolePrivileged', privileged,
    'replicationConfigFormatSupported', config_format_supported,
    'replicationDelegationConfigured', privileged_registered and privileged and config_format_supported and allowed,
    'objectsPolicyDelegationConfigured', policy_registered and objects_granted,
    'bucketsPolicyDelegationConfigured', policy_registered and buckets_granted,
    'replicationInitiallyOrigin', initial_mode = 'origin',
    'replicationReplicaObserved', replica_observed,
    'replicationOriginObserved', origin_observed,
    'replicationDenied', denied,
    'replicationRestored', current_setting('session_replication_role') = initial_mode
  )::text, true);
end
$second_brain_delegation$;
select current_setting('second_brain_operator.supautils_report')::jsonb as report;
rollback;`;

const booleanFields = ["sameActor", "readOnly", "privilegedSettingsRegistered", "policySettingsRegistered", "currentRolePrivileged", "replicationConfigFormatSupported", "replicationDelegationConfigured", "objectsPolicyDelegationConfigured", "bucketsPolicyDelegationConfigured", "replicationInitiallyOrigin", "replicationReplicaObserved", "replicationOriginObserved", "replicationDenied", "replicationRestored"];
const fields = ["version", ...booleanFields];
const fail = code => { throw new BackupError(code); };

/** Descriptor-only facts. Configuration true never implies a live hook or
 * successful policy creation, and successful SET never identifies its cause. */
export function validateSupautilsDelegation(report) {
  const invalid = () => fail("RESTORE_SUPAUTILS_DELEGATION_REPORT_INVALID");
  if (report === null || typeof report !== "object" || Array.isArray(report)) invalid();
  let descriptors, keys;
  try { descriptors = Object.getOwnPropertyDescriptors(report); keys = Reflect.ownKeys(descriptors); } catch { invalid(); }
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) invalid();
  const value = Object.create(null);
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) invalid();
    value[field] = descriptor.value;
  }
  if (value.version !== 1) invalid();
  for (const field of booleanFields) if (typeof value[field] !== "boolean") invalid();
  if (value.currentRolePrivileged && !value.privilegedSettingsRegistered ||
      value.replicationConfigFormatSupported && !value.privilegedSettingsRegistered ||
      value.replicationDelegationConfigured && (!value.privilegedSettingsRegistered || !value.currentRolePrivileged || !value.replicationConfigFormatSupported) ||
      (value.objectsPolicyDelegationConfigured || value.bucketsPolicyDelegationConfigured) && !value.policySettingsRegistered) invalid();
  if (value.replicationOriginObserved && !value.replicationReplicaObserved ||
      value.replicationDenied && value.replicationOriginObserved ||
      !value.replicationInitiallyOrigin && (value.replicationReplicaObserved || value.replicationOriginObserved || value.replicationDenied) ||
      value.replicationInitiallyOrigin && !value.replicationDenied && (!value.replicationReplicaObserved || !value.replicationOriginObserved)) invalid();
  // These are properties of the fixed read-only SQL, not an acceptance of a
  // restore. Replica=true/denied=true is possible if origin SET was refused.
  if (!value.readOnly || !value.replicationRestored) invalid();
  return Object.freeze(value);
}

const errorCodes = new Set(["INVALID_ARGUMENTS", "RESTORE_SUPAUTILS_DELEGATION_REPORT_INVALID", "ISOLATED_RESTORE_TARGET_REQUIRED", "ISOLATED_STORAGE_CONFIGURATION_REQUIRED", "RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED", "PERSONAL_POSTGRES_CONFIGURATION_REQUIRED", "PSQL_UNAVAILABLE", "PSQL_FAILED", "PSQL_TIMEOUT", "PSQL_OUTPUT_LIMIT", "PSQL_INVALID_REPORT"]);
function closedError(error) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    if (error instanceof BackupError && descriptor && Object.hasOwn(descriptor, "value") && errorCodes.has(descriptor.value)) return descriptor.value;
  } catch { /* Never expose exception text or evaluate error getters. */ }
  return "SUPAUTILS_DELEGATION_UNAVAILABLE";
}

export async function runSupautilsDelegation(argv, env, output = value => process.stdout.write(JSON.stringify(value) + "\n"), dependencies = {}) {
  try {
    if (!Array.isArray(argv)) fail("INVALID_ARGUMENTS");
    if (argv.length === 0 || argv.length === 1 && argv[0] === "--help") {
      output({ version: 1, readonly: true, localSetProbe: true, rollback: true, archiveRead: false, remoteMutation: false });
      return 0;
    }
    if (argv.length !== 1 || argv[0] !== "check") fail("INVALID_ARGUMENTS");
    const config = restoreConfiguration(env);
    const query = dependencies.query ?? ((request, options) => queryPostgres(config.psql, config.pg, request, dependencies.spawn, options));
    const report = validateSupautilsDelegation(await query({ sql: SUPAUTILS_DELEGATION_SQL }, { timeoutMs: SUPAUTILS_DELEGATION_TIMEOUT_MS }));
    output(report);
    return 0;
  } catch (error) {
    output({ ok: false, error: closedError(error) });
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runSupautilsDelegation(process.argv.slice(2), process.env);
