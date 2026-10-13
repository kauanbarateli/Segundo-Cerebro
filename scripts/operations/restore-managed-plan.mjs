import { createHash } from "node:crypto";
import { BackupError } from "./backup-format.mjs";

const plans = new WeakMap(), authorizations = new WeakMap();
const fail = code => { throw new BackupError(code); };
const digest = value => createHash("sha256").update(value).digest("hex");
const sha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const descriptions = ["SEQUENCE OWNED BY", "MATERIALIZED VIEW DATA", "MATERIALIZED VIEW", "DOMAIN CONSTRAINT", "FK CONSTRAINT", "DEFAULT ACL", "TABLE ATTACH", "INDEX ATTACH", "TABLE DATA", "SEQUENCE SET", "ROW SECURITY", "SHELL TYPE", "SECURITY LABEL", "SCHEMA", "TABLE", "SEQUENCE", "DEFAULT", "TYPE", "DOMAIN", "FUNCTION", "PROCEDURE", "AGGREGATE", "CONSTRAINT", "INDEX", "TRIGGER", "POLICY", "RULE", "ACL", "COMMENT", "VIEW", "COLLATION", "ENCODING", "STDSTRINGS", "SEARCHPATH"];
const custom = [
  { key: "identityTrigger", description: "TRIGGER", schema: "auth", table: "users", operation: "CREATE TRIGGER", tag: "users second_brain_identity_created" },
  { key: "adminTrigger", description: "TRIGGER", schema: "auth", table: "users", operation: "CREATE CONSTRAINT TRIGGER", tag: "users second_brain_admin_creation_final" },
  { key: "objectsPolicy", description: "POLICY", schema: "storage", table: "objects", operation: "CREATE POLICY", tag: "objects second_brain_private_objects" },
  { key: "bucketsPolicy", description: "POLICY", schema: "storage", table: "buckets", operation: "CREATE POLICY", tag: "buckets second_brain_private_buckets" },
];
function closed(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  let descriptors;
  try { descriptors = Object.getOwnPropertyDescriptors(value); } catch { fail(code); }
  const own = Reflect.ownKeys(descriptors);
  if (own.length !== keys.length || own.some(key => !keys.includes(key))) fail(code);
  const snapshot = {};
  for (const key of keys) {
    if (!descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], "value")) fail(code);
    snapshot[key] = descriptors[key].value;
  }
  return snapshot;
}
function migrationRows(value) {
  const invalid = "RESTORE_MANAGED_MIGRATION_HISTORY_INVALID";
  if (!Array.isArray(value)) fail(invalid);
  let descriptors;
  try { descriptors = Object.getOwnPropertyDescriptors(value); } catch { fail(invalid); }
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < 0 || Reflect.ownKeys(descriptors).length !== length + 1) fail(invalid);
  const result = [];
  for (let i = 0; i < length; i++) {
    const descriptor = descriptors[String(i)];
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) fail(invalid);
    result.push(descriptor.value);
  }
  return result;
}
function migrationSignature(history) {
  const invalid = "RESTORE_MANAGED_MIGRATION_HISTORY_INVALID", data = closed(history, ["auth", "storage"], invalid);
  const versions = migrationRows(data.auth).map(value => {
    const row = closed(value, ["version"], invalid);
    if (typeof row.version !== "string" || !row.version || row.version.includes("\0")) fail(invalid);
    return row.version;
  });
  if (new Set(versions).size !== versions.length) fail(invalid);
  const ids = new Set(), names = new Set();
  const storage = migrationRows(data.storage).map(value => {
    const row = closed(value, ["id", "name", "hash", "executed_at"], invalid);
    if (!Number.isSafeInteger(row.id) || row.id < 0 || typeof row.name !== "string" || !row.name || row.name.includes("\0") || typeof row.hash !== "string" || !/^[a-fA-F0-9]{40}$/.test(row.hash) || row.executed_at !== null && typeof row.executed_at !== "string") fail(invalid);
    if (ids.has(row.id) || names.has(row.name)) fail(invalid);
    ids.add(row.id); names.add(row.name);
    return { id: row.id, name: row.name, hash: row.hash };
  });
  return JSON.stringify({ auth: versions.sort(), storage: storage.sort((a, b) => a.id - b.id) });
}

/**
 * Private complete history inputs from the SAME authenticated snapshot and
 * target. Auth stores version identities, not SQL-body hashes. Storage stores
 * id/name/hash. Compare those byte-exact, order independent. Ignore ONLY
 * storage.migrations.executed_at (execution time, never a version identity).
 * Unknown columns/shapes refuse instead of broad timestamp stripping. This
 * does not compare service images or DDL: the separate archive baseline facts
 * remain mandatory. No SQL/rows are read or emitted by this pure helper.
 * Official schemas: supabase/auth migrations/00_init_auth_schema.up.sql;
 * supabase/storage migrations/tenant/0002-storage-schema.sql.
 */
export function compareManagedMigrationHistory(archive, target) {
  return migrationSignature(archive) === migrationSignature(target);
}
function integer(text, maximum = 2147483647) {
  if (!/^\d+$/.test(text)) fail("RESTORE_TOC_INVALID");
  const result = Number(text);
  if (!Number.isSafeInteger(result) || result < 0 || result > maximum) fail("RESTORE_TOC_INVALID");
  return result;
}

/**
 * Bounded PG18 verbose-list grammar, not an SQL parser or a generic name parser.
 * PrintTOCSummary prints "%d; %u %u %s %s %s %s\n", then, when present,
 * ";\tdepends on:" plus integer dump IDs. Source: REL_18_STABLE,
 * src/bin/pg_dump/pg_backup_archiver.c:1290-1309. sanitize_line does not quote
 * names; names/owners outside this unambiguous project grammar are refused.
 */
function parseVerboseToc(text) {
  if (typeof text !== "string" || !text || /[^\x09\x0a\x0d\x20-\x7e]/.test(text)) fail("RESTORE_TOC_INVALID");
  const rows = [], ids = new Set(); let previous = null, count = null, format = null, producer = null, selected = false, verboseDependencies = false;
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    if (/^;\tdepends on:/.test(line)) {
      if (!previous || previous.dependencies !== null || !/^;\tdepends on:(?: [1-9]\d*)+$/.test(line)) fail("RESTORE_TOC_INVALID");
      previous.dependencies = line.slice(";\tdepends on:".length).trim().split(" ").map(value => integer(value));
      verboseDependencies = true;
      if (new Set(previous.dependencies).size !== previous.dependencies.length) fail("RESTORE_TOC_INVALID");
      continue;
    }
    if (line.startsWith(";") || line === "") {
      if (/^;     TOC Entries: /.test(line)) {
        if (count !== null) fail("RESTORE_TOC_INVALID");
        count = integer(line.slice(";     TOC Entries: ".length));
      } else if (/^;     Format: /.test(line)) {
        if (format !== null) fail("RESTORE_TOC_INVALID");
        format = line.slice(";     Format: ".length);
      } else if (/^;     Dumped by pg_dump version: /.test(line)) {
        if (producer !== null) fail("RESTORE_TOC_INVALID");
        producer = line.slice(";     Dumped by pg_dump version: ".length);
      } else if (line === "; Selected TOC Entries:") selected = true;
      else if (line.includes("depends on:")) fail("RESTORE_TOC_INVALID");
      continue;
    }
    const match = /^([1-9]\d*); (\d+) (\d+) (.*)$/.exec(line);
    if (!selected || !match) fail("RESTORE_TOC_INVALID");
    const id = integer(match[1]), catalogClass = integer(match[2], 4294967295), catalogOid = integer(match[3], 4294967295);
    if (ids.has(id)) fail("RESTORE_TOC_INVALID");
    ids.add(id);
    const description = descriptions.find(value => match[4].startsWith(value + " "));
    if (!description) fail("RESTORE_TOC_UNSUPPORTED");
    const tail = /^([a-z_][a-z0-9_]*|-) (.*) ([a-z_][a-z0-9_]*|)$/.exec(match[4].slice(description.length + 1));
    if (!tail || !tail[2] || /[;"\\]/.test(tail[2])) fail("RESTORE_TOC_UNSUPPORTED");
    previous = { id, catalogClass, catalogOid, description, schema: tail[1], tag: tail[2], owner: tail[3], line, dependencies: null };
    rows.push(previous);
  }
  if (format !== "CUSTOM" || !/^18\.\d+(?:[ .].*)?$/.test(producer ?? "") || !count || count !== rows.length || !verboseDependencies) fail("RESTORE_TOC_INVALID");
  for (const row of rows) {
    row.dependencies ??= [];
    if (row.dependencies.some(id => id === row.id || !ids.has(id))) fail("RESTORE_TOC_DEPENDENCY_INVALID");
  }
  return rows;
}

/** Pure preparation; passing this function never authorizes a connection. */
export function planManagedRestore(tocText, binding) {
  const bound = closed(binding, ["archiveSha256", "databaseSha256", "databaseBytes"], "RESTORE_MANAGED_BINDING_INVALID");
  if (!sha256(bound.archiveSha256) || !sha256(bound.databaseSha256) || !Number.isSafeInteger(bound.databaseBytes) || bound.databaseBytes <= 0) fail("RESTORE_MANAGED_BINDING_INVALID");
  const rows = parseVerboseToc(tocText), core = [], preserved = [], customRows = new Map();
  for (const row of rows) {
    const customization = custom.find(value => value.description === row.description && value.schema === row.schema && value.tag === row.tag);
    if (customization) {
      if (customRows.has(customization.key)) fail("RESTORE_MANAGED_CUSTOM_INVALID");
      customRows.set(customization.key, row); continue;
    }
    if (row.schema === "public" || row.schema === "app_private" || (row.schema === "-" && (row.description === "SCHEMA" && row.tag === "app_private" || ["ACL", "COMMENT"].includes(row.description) && /^(?:SCHEMA )?app_private$/.test(row.tag))) || (row.schema === "-" && ["ENCODING", "STDSTRINGS", "SEARCHPATH"].includes(row.description))) core.push(row);
    else if (["auth", "storage"].includes(row.schema)) {
      // Platform migration history belongs to the qualified baseline. Replaying
      // it as user data could collide with or rewrite service migration state.
      if (row.description === "TABLE DATA" && (row.schema === "auth" && row.tag === "schema_migrations" || row.schema === "storage" && row.tag === "migrations")) preserved.push(row);
      else if (["TABLE DATA", "SEQUENCE SET"].includes(row.description)) core.push(row);
      else preserved.push(row);
    } else if (row.schema === "-" && (["SCHEMA"].includes(row.description) && ["auth", "storage", "public"].includes(row.tag) || ["ACL", "COMMENT"].includes(row.description) && /^(?:SCHEMA )?(?:auth|storage|public)$/.test(row.tag))) preserved.push(row);
    else fail("RESTORE_TOC_UNSUPPORTED");
  }
  if (customRows.size !== custom.length || !core.some(row => row.schema === "auth" && row.description === "TABLE DATA" && row.tag === "users")) fail("RESTORE_MANAGED_CUSTOM_INVALID");
  // Core retains native TOC order. Custom DDL follows core, in original order.
  // A core dependency on delayed custom DDL would change native ordering.
  const delayed = new Set([...customRows.values()].map(row => row.id));
  if (core.some(row => row.dependencies.some(id => delayed.has(id)))) fail("RESTORE_TOC_DEPENDENCY_INVALID");
  const later = [...customRows.entries()].sort((a, b) => rows.indexOf(a[1]) - rows.indexOf(b[1]));
  const completed = new Set([...core, ...preserved].map(row => row.id));
  for (const [, row] of later) {
    if (row.dependencies.some(id => !completed.has(id))) fail("RESTORE_TOC_DEPENDENCY_INVALID");
    completed.add(row.id);
  }
  const plan = Object.freeze({ version: 1, selectedEntries: core.length + later.length, preservedEntries: preserved.length, segments: 1 + later.length });
  plans.set(plan, { ...bound, tocSha256: digest(tocText), core, preserved, custom: later });
  return plan;
}

/**
 * The future fixed-query/catalog adapter must establish these facts against
 * this archive snapshot. This validates/binds facts; it does not discover or
 * certify them. No CLI/callsite exists yet. QA supplies explicitly fake facts.
 * Current-actor delegation qualifies the exact operation/table, not all DDL or
 * table ownership. SET ROLE instead requires the exact preserved table owner.
 * Replica permission is a SET LOCAL/readback/ROLLBACK observation, not an ACL
 * count: managed extensions can delegate it without a parameter ACL grant.
 */
export function authorizeManagedRestore(plan, evidence) {
  const details = plans.get(plan);
  if (!details) fail("RESTORE_MANAGED_PLAN_REQUIRED");
  const facts = closed(evidence, ["archiveSha256", "databaseSha256", "databaseBytes", "tocSha256", "archiveAuthenticated", "nativeSqlControlQualified", "actor", "sameActor", "allTargetsEmpty", "baselineMatchesArchive", "baselineOwnerAclMatchesArchive", "appOwnerAclCanBeRestored", "dataCopyCanUseOperator", "replicaCanUseOperator", "referencesCanBeVerified", "managedMigrationHistories", "customRoles"], "RESTORE_MANAGED_QUALIFICATION_INVALID");
  for (const key of ["archiveSha256", "databaseSha256", "databaseBytes", "tocSha256"]) if (facts[key] !== details[key]) fail("RESTORE_MANAGED_BINDING_INVALID");
  for (const key of ["archiveAuthenticated", "nativeSqlControlQualified", "sameActor", "allTargetsEmpty", "baselineMatchesArchive", "baselineOwnerAclMatchesArchive", "appOwnerAclCanBeRestored", "dataCopyCanUseOperator", "referencesCanBeVerified"]) if (facts[key] !== true) fail("RESTORE_MANAGED_PREREQUISITES_REQUIRED");
  if (typeof facts.actor !== "string" || !/^[a-z_][a-z0-9_]*$/.test(facts.actor)) fail("RESTORE_MANAGED_QUALIFICATION_INVALID");
  const replica = closed(facts.replicaCanUseOperator, ["actor", "setLocalObserved", "readback", "rollbackObserved"], "RESTORE_MANAGED_QUALIFICATION_INVALID");
  if (replica.actor !== facts.actor || replica.setLocalObserved !== true || replica.readback !== "replica" || replica.rollbackObserved !== true) fail("RESTORE_MANAGED_PREREQUISITES_REQUIRED");
  const histories = closed(facts.managedMigrationHistories, ["archive", "target"], "RESTORE_MANAGED_MIGRATION_HISTORY_INVALID");
  if (!compareManagedMigrationHistory(histories.archive, histories.target)) fail("RESTORE_MANAGED_PREREQUISITES_REQUIRED");
  const roles = closed(facts.customRoles, custom.map(value => value.key), "RESTORE_MANAGED_QUALIFICATION_INVALID");
  const qualifiedRoles = {};
  for (const { key, schema, table, operation } of custom) {
    let descriptors;
    try { descriptors = Object.getOwnPropertyDescriptors(roles[key] ?? {}); } catch { fail("RESTORE_MANAGED_QUALIFICATION_INVALID"); }
    const mode = descriptors.mode;
    if (!mode?.enumerable || !Object.hasOwn(mode, "value") || !["currentActor", "setRole"].includes(mode.value)) fail("RESTORE_MANAGED_QUALIFICATION_INVALID");
    const keys = ["mode", "actor", "schema", "table", "operation", "canCreate"];
    if (mode.value === "setRole") keys.push("role", "canSetRole");
    const authority = closed(roles[key], keys, "RESTORE_MANAGED_QUALIFICATION_INVALID");
    if (authority.actor !== facts.actor || authority.schema !== schema || authority.table !== table || authority.operation !== operation || authority.canCreate !== true) fail("RESTORE_MANAGED_PREREQUISITES_REQUIRED");
    const owners = details.preserved.filter(row => row.description === "TABLE" && row.schema === schema && row.tag === table);
    if (owners.length !== 1) fail("RESTORE_MANAGED_PREREQUISITES_REQUIRED");
    if (authority.mode === "currentActor") qualifiedRoles[key] = null;
    else {
      if (typeof authority.role !== "string" || !/^[a-z_][a-z0-9_]*$/.test(authority.role) || authority.role !== owners[0].owner || authority.canSetRole !== true) fail("RESTORE_MANAGED_PREREQUISITES_REQUIRED");
      qualifiedRoles[key] = authority.role;
    }
  }
  const authorization = Object.freeze({});
  authorizations.set(authorization, { plan, roles: qualifiedRoles, claimed: false });
  return authorization;
}

/** Internal execution preparation: opaque authorization is single-use. */
export function claimManagedRestore(plan, authorization) {
  const details = plans.get(plan), qualified = authorizations.get(authorization);
  if (!details || !qualified || qualified.plan !== plan || qualified.claimed) fail("RESTORE_MANAGED_AUTHORIZATION_REQUIRED");
  qualified.claimed = true;
  const list = rows => rows.map(row => row.line + "\n").join("");
  return { archiveSha256: details.archiveSha256, databaseSha256: details.databaseSha256, databaseBytes: details.databaseBytes, tocSha256: details.tocSha256, segments: [
    { list: list(details.core), role: null, custom: false },
    ...details.custom.map(([key, row]) => ({ list: list([row]), role: qualified.roles[key], custom: true })),
  ] };
}

/** Private metadata for the future catalog qualifier, never a public report. */
export function managedRestoreRequirements(plan) {
  const details = plans.get(plan);
  if (!details) fail("RESTORE_MANAGED_PLAN_REQUIRED");
  const metadata = row => Object.freeze({ id: row.id, description: row.description, schema: row.schema, tag: row.tag, owner: row.owner, dependencies: Object.freeze([...row.dependencies]) });
  return Object.freeze({ archiveSha256: details.archiveSha256, databaseSha256: details.databaseSha256, databaseBytes: details.databaseBytes, tocSha256: details.tocSha256, preserved: Object.freeze(details.preserved.map(metadata)), selected: Object.freeze([...details.core, ...details.custom.map(([, row]) => row)].map(metadata)) });
}
