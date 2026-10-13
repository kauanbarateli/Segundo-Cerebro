import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BackupError } from "./backup-format.mjs";
import { queryPostgres } from "./postgres-process.mjs";
import { restoreConfiguration } from "./restore-target.mjs";

export const MANAGED_CAPABILITIES_TIMEOUT_MS = 15000;
// Catalogue capabilities only. Never reads managed rows, changes role or
// replication mode, opens an archive or qualifies the complete restore.
export const MANAGED_CAPABILITIES_SQL = `begin transaction isolation level repeatable read read only;
set local statement_timeout = '10s';
set local lock_timeout = '3s';
set local search_path = pg_catalog;
with actor as (
 select current_setting('server_version_num')::integer as server_version_num,
        current_user = session_user as same_actor,
        coalesce((select rolsuper from pg_roles where rolname = current_user), false) as is_superuser,
        coalesce((select rolbypassrls from pg_roles where rolname = current_user), false) as is_bypass_rls,
        has_parameter_privilege(current_user, 'session_replication_role', 'SET') as can_set_replication_role
), managed_schemas as (
 select n.oid, n.nspname,
        pg_has_role(n.nspowner, 'USAGE') as owner_immediate,
        pg_has_role(n.nspowner, 'SET') as owner_set,
        has_schema_privilege(n.oid, 'USAGE') as schema_usage
 from pg_namespace n where n.nspname in ('auth', 'storage')
), managed_tables as (
 select c.oid, n.nspname, c.relname,
        pg_has_role(c.relowner, 'USAGE') as owner_immediate,
        pg_has_role(c.relowner, 'SET') as owner_set,
        has_table_privilege(c.oid, 'SELECT') as table_select,
        has_table_privilege(c.oid, 'INSERT') as table_insert,
        has_table_privilege(c.oid, 'TRIGGER') as table_trigger,
        c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
        row_security_active(c.oid) as rls_active
 from pg_class c join managed_schemas n on n.oid = c.relnamespace
 where c.relkind in ('r', 'p')
), schema_counts as (
 select count(*) as total,
        count(*) filter (where owner_immediate) as owner_immediate,
        count(*) filter (where owner_set) as owner_set,
        count(*) filter (where schema_usage) as schema_usage from managed_schemas
), table_counts as (
 select count(*) as total,
        count(*) filter (where owner_immediate) as owner_immediate,
        count(*) filter (where owner_set) as owner_set,
        count(*) filter (where table_select) as table_select,
        count(*) filter (where table_insert) as table_insert,
        count(*) filter (where rls_enabled) as rls_enabled,
        count(*) filter (where rls_forced) as rls_forced,
        count(*) filter (where rls_active) as rls_active,
        count(*) filter (where rls_enabled and not rls_active) as rls_enabled_inactive from managed_tables
), auth_users as (
 select coalesce(bool_or(true), false) as present,
        coalesce(bool_or(table_trigger), false) as trigger_available,
        coalesce(bool_or(owner_immediate), false) as owner_immediate,
        coalesce(bool_or(owner_set), false) as owner_set
 from managed_tables where nspname = 'auth' and relname = 'users'
), auth_triggers as (
 select count(*) as present from pg_trigger t join managed_tables m on m.oid = t.tgrelid
 where m.nspname = 'auth' and m.relname = 'users' and not t.tgisinternal
       and t.tgname in ('second_brain_identity_created', 'second_brain_admin_creation_final')
), storage_policy_tables as (
 select * from managed_tables where nspname = 'storage' and relname in ('objects', 'buckets')
), storage_counts as (
 select count(*) as total,
        count(*) filter (where owner_immediate) as owner_immediate,
        count(*) filter (where owner_set) as owner_set from storage_policy_tables
), storage_policies as (
 select count(*) as present from pg_policy p join storage_policy_tables m on m.oid = p.polrelid
 where (m.relname = 'objects' and p.polname = 'second_brain_private_objects')
    or (m.relname = 'buckets' and p.polname = 'second_brain_private_buckets')
)
select jsonb_build_object(
 'version', 1, 'serverVersionNum', a.server_version_num, 'sameActor', a.same_actor,
 'isSuperuser', a.is_superuser, 'isBypassRls', a.is_bypass_rls,
 'canSetSessionReplicationRole', a.can_set_replication_role,
 'schemas', s.total, 'schemaOwnerImmediate', s.owner_immediate, 'schemaOwnerSet', s.owner_set, 'schemaUsage', s.schema_usage,
 'tables', t.total, 'tableOwnerImmediate', t.owner_immediate, 'tableOwnerSet', t.owner_set,
 'tableSelect', t.table_select, 'tableInsert', t.table_insert,
 'tableRlsEnabled', t.rls_enabled, 'tableRlsForced', t.rls_forced,
 'tableRlsActive', t.rls_active, 'tableRlsEnabledInactive', t.rls_enabled_inactive,
 'authUsersPresent', u.present, 'authUsersTrigger', u.trigger_available,
 'authUsersOwnerImmediate', u.owner_immediate, 'authUsersOwnerSet', u.owner_set,
 'authCustomTriggersPresent', g.present,
 'storagePolicyTables', p.total, 'storagePolicyOwnerImmediate', p.owner_immediate,
 'storagePolicyOwnerSet', p.owner_set, 'storageCustomPoliciesPresent', q.present
) from actor a cross join schema_counts s cross join table_counts t
 cross join auth_users u cross join auth_triggers g cross join storage_counts p cross join storage_policies q;
rollback;`;

const booleanFields = ["sameActor", "isSuperuser", "isBypassRls", "canSetSessionReplicationRole", "authUsersPresent", "authUsersTrigger", "authUsersOwnerImmediate", "authUsersOwnerSet"];
const countFields = ["schemas", "schemaOwnerImmediate", "schemaOwnerSet", "schemaUsage", "tables", "tableOwnerImmediate", "tableOwnerSet", "tableSelect", "tableInsert", "tableRlsEnabled", "tableRlsForced", "tableRlsActive", "tableRlsEnabledInactive", "authCustomTriggersPresent", "storagePolicyTables", "storagePolicyOwnerImmediate", "storagePolicyOwnerSet", "storageCustomPoliciesPresent"];
const fields = ["version", "serverVersionNum", ...booleanFields, ...countFields];
const fail = code => { throw new BackupError(code); };

/** Copied scalar projection only. SET membership never becomes immediate
 * ownership; accessors, symbols and inherited fields cannot reach output. */
export function validateManagedCapabilities(report) {
  const invalid = () => fail("RESTORE_MANAGED_CAPABILITIES_REPORT_INVALID");
  if (report === null || typeof report !== "object" || Array.isArray(report)) invalid();
  let descriptors, keys;
  try { descriptors = Object.getOwnPropertyDescriptors(report); keys = Reflect.ownKeys(descriptors); } catch { invalid(); }
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) invalid();
  const data = Object.create(null);
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) invalid();
    data[field] = descriptor.value;
  }
  if (data.version !== 1 || !Number.isSafeInteger(data.serverVersionNum) || data.serverVersionNum < 160000 || data.serverVersionNum > 999999) invalid();
  for (const field of booleanFields) if (typeof data[field] !== "boolean") invalid();
  for (const field of countFields) if (!Number.isSafeInteger(data[field]) || data[field] < 0 || data[field] > 100000) invalid();
  if (data.schemas > 2 || data.schemaOwnerImmediate > data.schemas || data.schemaOwnerSet > data.schemas || data.schemaUsage > data.schemas || data.schemas === 0 && data.tables !== 0) invalid();
  for (const field of ["tableOwnerImmediate", "tableOwnerSet", "tableSelect", "tableInsert", "tableRlsEnabled", "tableRlsForced", "tableRlsActive", "tableRlsEnabledInactive"]) if (data[field] > data.tables) invalid();
  if (data.tableRlsActive > data.tableRlsEnabled || data.tableRlsActive + data.tableRlsEnabledInactive !== data.tableRlsEnabled) invalid();
  if (data.authCustomTriggersPresent > 2 || data.storagePolicyTables > 2 || data.storagePolicyOwnerImmediate > data.storagePolicyTables || data.storagePolicyOwnerSet > data.storagePolicyTables || data.storageCustomPoliciesPresent > data.storagePolicyTables) invalid();
  if (!data.authUsersPresent && (data.authUsersTrigger || data.authUsersOwnerImmediate || data.authUsersOwnerSet || data.authCustomTriggersPresent !== 0)) invalid();
  if (data.tables < Number(data.authUsersPresent) + data.storagePolicyTables) invalid();
  if ((data.authUsersPresent || data.storagePolicyTables > 0) && data.schemas === 0 || data.authUsersPresent && data.storagePolicyTables > 0 && data.schemas !== 2) invalid();
  if (data.tableOwnerImmediate < Number(data.authUsersOwnerImmediate) + data.storagePolicyOwnerImmediate || data.tableOwnerSet < Number(data.authUsersOwnerSet) + data.storagePolicyOwnerSet) invalid();
  if ((data.isSuperuser || data.isBypassRls) && data.tableRlsActive !== 0) invalid();
  if (data.isSuperuser && (!data.canSetSessionReplicationRole || data.schemaOwnerImmediate !== data.schemas || data.schemaOwnerSet !== data.schemas || data.schemaUsage !== data.schemas || data.tableOwnerImmediate !== data.tables || data.tableOwnerSet !== data.tables || data.tableSelect !== data.tables || data.tableInsert !== data.tables || data.authUsersPresent && (!data.authUsersTrigger || !data.authUsersOwnerImmediate || !data.authUsersOwnerSet) || data.storagePolicyOwnerImmediate !== data.storagePolicyTables || data.storagePolicyOwnerSet !== data.storagePolicyTables)) invalid();
  return Object.freeze(data);
}

const errorCodes = new Set(["INVALID_ARGUMENTS", "RESTORE_MANAGED_CAPABILITIES_REPORT_INVALID", "ISOLATED_RESTORE_TARGET_REQUIRED", "ISOLATED_STORAGE_CONFIGURATION_REQUIRED", "RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED", "PERSONAL_POSTGRES_CONFIGURATION_REQUIRED", "PSQL_UNAVAILABLE", "PSQL_FAILED", "PSQL_TIMEOUT", "PSQL_OUTPUT_LIMIT", "PSQL_INVALID_REPORT"]);
function closedError(error) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    if (error instanceof BackupError && descriptor && Object.hasOwn(descriptor, "value") && errorCodes.has(descriptor.value)) return descriptor.value;
  } catch { /* Never replace a closed error with arbitrary exception text. */ }
  return "MANAGED_CAPABILITIES_UNAVAILABLE";
}

export async function runManagedCapabilities(argv, env, output = value => process.stdout.write(JSON.stringify(value) + "\n"), dependencies = {}) {
  try {
    if (!Array.isArray(argv)) fail("INVALID_ARGUMENTS");
    if (argv.length === 0 || argv.length === 1 && argv[0] === "--help") {
      output({ version: 1, readonly: true, countsOnly: true, archiveRead: false, remoteMutation: false });
      return 0;
    }
    if (argv.length !== 1 || argv[0] !== "check") fail("INVALID_ARGUMENTS");
    const config = restoreConfiguration(env);
    const query = dependencies.query ?? ((request, options) => queryPostgres(config.psql, config.pg, request, dependencies.spawn, options));
    const report = validateManagedCapabilities(await query({ sql: MANAGED_CAPABILITIES_SQL }, { timeoutMs: MANAGED_CAPABILITIES_TIMEOUT_MS }));
    output(report);
    return 0;
  } catch (error) {
    output({ ok: false, error: closedError(error) });
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runManagedCapabilities(process.argv.slice(2), process.env);
