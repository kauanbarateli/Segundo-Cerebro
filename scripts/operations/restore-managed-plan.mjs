import { createHash } from "node:crypto";
import { BackupError } from "./backup-format.mjs";

const plans = new WeakMap(), authorizations = new WeakMap(), unsupportedToc = new WeakMap(), invalidTocPlan = new WeakMap();
const fail = code => { throw new BackupError(code); };
const digest = value => createHash("sha256").update(value).digest("hex");
const sha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const descriptions = ["SEQUENCE OWNED BY", "MATERIALIZED VIEW DATA", "MATERIALIZED VIEW", "DOMAIN CONSTRAINT", "FK CONSTRAINT", "DEFAULT ACL", "TABLE ATTACH", "INDEX ATTACH", "TABLE DATA", "SEQUENCE SET", "ROW SECURITY", "SHELL TYPE", "SECURITY LABEL", "DATABASE PROPERTIES", "DATABASE", "SCHEMA", "TABLE", "SEQUENCE", "DEFAULT", "TYPE", "DOMAIN", "FUNCTION", "PROCEDURE", "AGGREGATE", "CONSTRAINT", "INDEX", "TRIGGER", "POLICY", "RULE", "ACL", "COMMENT", "VIEW", "COLLATION", "ENCODING", "STDSTRINGS", "SEARCHPATH"];
const diagnosticReasons = ["unknown_descriptor", "tail_grammar", "scope_classification"];
const diagnosticScopes = ["app", "managed", "global", "other", "unparsed"];
const diagnosticTails = ["not_parsed", "missing_fields", "empty_tag", "forbidden_tag_character", "valid"];
const planDiagnosticReasons = Object.freeze({
  input_shape: "RESTORE_TOC_INVALID", integer_shape: "RESTORE_TOC_INVALID", integer_range: "RESTORE_TOC_INVALID",
  dependency_without_entry: "RESTORE_TOC_INVALID", dependency_comment_repeated: "RESTORE_TOC_INVALID", dependency_comment_shape: "RESTORE_TOC_INVALID",
  count_header_repeated: "RESTORE_TOC_INVALID", format_header_repeated: "RESTORE_TOC_INVALID", producer_header_repeated: "RESTORE_TOC_INVALID",
  entry_before_selected: "RESTORE_TOC_INVALID", entry_shape: "RESTORE_TOC_INVALID", entry_id_repeated: "RESTORE_TOC_INVALID",
  format_header_invalid: "RESTORE_TOC_INVALID", producer_header_invalid: "RESTORE_TOC_INVALID", count_header_invalid: "RESTORE_TOC_INVALID", entry_count_mismatch: "RESTORE_TOC_INVALID", verbose_dependencies_missing: "RESTORE_TOC_INVALID",
  dependency_self: "RESTORE_TOC_DEPENDENCY_INVALID", dependency_missing: "RESTORE_TOC_DEPENDENCY_INVALID",
  database_metadata_repeated: "RESTORE_TOC_INVALID", database_metadata_orphan: "RESTORE_TOC_DEPENDENCY_INVALID", database_owner_mismatch: "RESTORE_TOC_DEPENDENCY_INVALID", database_dependency_shape: "RESTORE_TOC_DEPENDENCY_INVALID",
  customization_repeated: "RESTORE_MANAGED_CUSTOM_INVALID", customization_missing: "RESTORE_MANAGED_CUSTOM_INVALID", auth_user_data_missing: "RESTORE_MANAGED_CUSTOM_INVALID",
  core_depends_on_delayed_customization: "RESTORE_TOC_DEPENDENCY_INVALID", customization_dependency_not_completed: "RESTORE_TOC_DEPENDENCY_INVALID",
});
// Diagnostic enum only: PG18 pg_dump.c literal .description strings, plus
// the existing descriptors emitted through variables. No parser support is
// added. REL_18_STABLE pg_dump.c SHA256 a43819375cb6c59f351d74e20b25c721165a58b28a729bc82bcec309d3a54a1b.
const inventoryKinds = [...new Set([...descriptions, "ACCESS METHOD", "BLOB METADATA", "BLOBS", "CAST", "CONVERSION", "DATABASE", "DATABASE PROPERTIES", "EVENT TRIGGER", "EXTENSION", "FOREIGN DATA WRAPPER", "OPERATOR", "OPERATOR CLASS", "OPERATOR FAMILY", "PROCEDURAL LANGUAGE", "PUBLICATION", "PUBLICATION TABLE", "PUBLICATION TABLES IN SCHEMA", "SERVER", "STATISTICS", "STATISTICS DATA", "SUBSCRIPTION", "SUBSCRIPTION TABLE", "TEXT SEARCH CONFIGURATION", "TEXT SEARCH DICTIONARY", "TEXT SEARCH PARSER", "TEXT SEARCH TEMPLATE", "TRANSFORM", "USER MAPPING", "pg_largeobject"])].sort();
const inventoryPrefixes = [...inventoryKinds].sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
const scopeCategory = schema => schema === undefined ? "unparsed" : schema === "-" ? "global" : ["public", "app_private"].includes(schema) ? "app" : ["auth", "storage"].includes(schema) ? "managed" : "other";
function refuseUnsupported(reason, knownKind, scope, tailShape) {
  const error = new BackupError("RESTORE_TOC_UNSUPPORTED");
  unsupportedToc.set(error, Object.freeze({ reason, knownKind, scopeCategory: scope, tailShape }));
  throw error;
}
function refusePlan(code, reason, knownKind = null, scope = "unparsed") {
  const error = new BackupError(code);
  if (Object.hasOwn(planDiagnosticReasons, reason) && planDiagnosticReasons[reason] === code && (knownKind === null || descriptions.includes(knownKind)) && diagnosticScopes.includes(scope)) invalidTocPlan.set(error, Object.freeze({ version: 1, reason, knownKind, scopeCategory: scope }));
  throw error;
}
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

/** Only an original refusal has diagnostics. Never inspect error fields,
 * getters or a caller-supplied diagnostic. No TOC tokens/names are retained. */
export function managedTocUnsupportedDiagnostic(error) {
  const facts = unsupportedToc.get(error);
  if (!facts) return null;
  try {
    const data = closed(facts, ["reason", "knownKind", "scopeCategory", "tailShape"], "RESTORE_TOC_UNSUPPORTED");
    if (!diagnosticReasons.includes(data.reason) || data.knownKind !== null && !descriptions.includes(data.knownKind) || !diagnosticScopes.includes(data.scopeCategory) || !diagnosticTails.includes(data.tailShape)) return null;
    return Object.freeze(data);
  } catch { return null; }
}

/** Only the original parser/planner refusal supplies these closed facts.
 * Caller error properties, getters, proxies and forged codes are not read. */
export function managedTocPlanDiagnostic(error) {
  const facts = invalidTocPlan.get(error);
  if (!facts) return null;
  try {
    const data = closed(facts, ["version", "reason", "knownKind", "scopeCategory"], "RESTORE_TOC_INVALID");
    if (data.version !== 1 || !Object.hasOwn(planDiagnosticReasons, data.reason) || data.knownKind !== null && !descriptions.includes(data.knownKind) || !diagnosticScopes.includes(data.scopeCategory)) return null;
    return Object.freeze(data);
  } catch { return null; }
}

/** Bounded public-class inventory only. It neither parses SQL nor qualifies a
 * plan, IDs/dependencies or authority. Unknown tokens are never retained. */
export function diagnosticInventory(tocText) {
  if (typeof tocText !== "string" || !tocText || tocText.length > 4 * 1024 * 1024 || /[^\x09\x0a\x0d\x20-\x7e]/.test(tocText)) return null;
  let selected = false, selectedCount = 0, countHeaders = 0, formatHeaders = 0, producerHeaders = 0, dumpEntries = null, formatOk = false, producerOk = false, unselectedRow = false;
  let countObserved = 0, unknownClassCount = 0, malformedRowCount = 0;
  const classes = new Map();
  const validNumber = (text, maximum) => /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) && Number(text) <= maximum;
  for (const line of tocText.replaceAll("\r\n", "\n").split("\n")) {
    if (line.startsWith(";") || line === "") {
      if (line.startsWith(";     TOC Entries: ")) {
        countHeaders++; const value = line.slice(";     TOC Entries: ".length);
        dumpEntries = countHeaders === 1 && validNumber(value, 2147483647) && Number(value) > 0 ? Number(value) : null;
      } else if (line.startsWith(";     Format: ")) { formatHeaders++; formatOk = formatHeaders === 1 && line === ";     Format: CUSTOM"; }
      else if (line.startsWith(";     Dumped by pg_dump version: ")) { producerHeaders++; producerOk = producerHeaders === 1 && /^18\.\d+(?:[ .].*)?$/.test(line.slice(";     Dumped by pg_dump version: ".length)); }
      else if (line === "; Selected TOC Entries:") { selected = true; selectedCount++; }
      continue;
    }
    if (!selected) { unselectedRow = true; continue; }
    countObserved++;
    const match = /^([1-9]\d*); (\d+) (\d+) (.*)$/.exec(line);
    if (!match || !validNumber(match[1], 2147483647) || !validNumber(match[2], 4294967295) || !validNumber(match[3], 4294967295)) { malformedRowCount++; continue; }
    const kind = inventoryPrefixes.find(value => match[4].startsWith(value + " "));
    if (!kind) { unknownClassCount++; continue; }
    const tail = /^([a-z_][a-z0-9_]*|-) (.*) ([a-z_][a-z0-9_]*|)$/.exec(match[4].slice(kind.length + 1));
    const shape = !tail ? "missing_fields" : !tail[2] ? "empty_tag" : /[;"\\]/.test(tail[2]) ? "forbidden_tag_character" : "valid";
    if (shape !== "valid") malformedRowCount++;
    const category = scopeCategory(tail?.[1]);
    if (!classes.has(kind)) classes.set(kind, { count: 0, scopes: new Map(), tails: new Map() });
    const entry = classes.get(kind); entry.count++;
    entry.scopes.set(category, (entry.scopes.get(category) ?? 0) + 1);
    entry.tails.set(shape, (entry.tails.get(shape) ?? 0) + 1);
  }
  const entries = inventoryKinds.filter(kind => classes.has(kind)).map(kind => {
    const entry = classes.get(kind);
    return Object.freeze({ kind, count: entry.count,
      scopes: Object.freeze(diagnosticScopes.filter(category => entry.scopes.has(category)).map(category => Object.freeze({ category, count: entry.scopes.get(category) }))),
      tails: Object.freeze(diagnosticTails.filter(shape => entry.tails.has(shape)).map(shape => Object.freeze({ shape, count: entry.tails.get(shape) }))),
    });
  });
  const result = Object.freeze({ version: 1, headersValid: !unselectedRow && selectedCount === 1 && countHeaders === 1 && formatHeaders === 1 && producerHeaders === 1 && formatOk && producerOk && dumpEntries !== null && dumpEntries === countObserved,
    dumpEntries, countObserved, unknownClassCount, malformedRowCount, classes: Object.freeze(entries) });
  // Reserve 4 KiB for the fixed error envelope. Diagnostics cannot expand it
  // beyond 64 KiB or replace the original planner refusal.
  return Buffer.byteLength(JSON.stringify(result)) <= 60 * 1024 ? result : null;
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
  if (!/^\d+$/.test(text)) refusePlan("RESTORE_TOC_INVALID", "integer_shape");
  const result = Number(text);
  if (!Number.isSafeInteger(result) || result < 0 || result > maximum) refusePlan("RESTORE_TOC_INVALID", "integer_range");
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
  if (typeof text !== "string" || !text || /[^\x09\x0a\x0d\x20-\x7e]/.test(text)) refusePlan("RESTORE_TOC_INVALID", "input_shape");
  const rows = [], ids = new Set(); let previous = null, count = null, format = null, producer = null, selected = false, verboseDependencies = false;
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    if (/^;\tdepends on:/.test(line)) {
      if (!previous) refusePlan("RESTORE_TOC_INVALID", "dependency_without_entry");
      if (previous.dependencies !== null) refusePlan("RESTORE_TOC_INVALID", "dependency_comment_repeated", previous.description, scopeCategory(previous.schema));
      if (!/^;\tdepends on:(?: [1-9]\d*)+$/.test(line)) refusePlan("RESTORE_TOC_INVALID", "dependency_comment_shape", previous.description, scopeCategory(previous.schema));
      previous.dependencies = line.slice(";\tdepends on:".length).trim().split(" ").map(value => integer(value));
      verboseDependencies = true;
      // PG18 retains repeated dependencies. Preserve every occurrence/order;
      // entry IDs and each dependency's range/existence/self checks stay intact.
      continue;
    }
    if (line.startsWith(";") || line === "") {
      if (/^;     TOC Entries: /.test(line)) {
        if (count !== null) refusePlan("RESTORE_TOC_INVALID", "count_header_repeated");
        count = integer(line.slice(";     TOC Entries: ".length));
      } else if (/^;     Format: /.test(line)) {
        if (format !== null) refusePlan("RESTORE_TOC_INVALID", "format_header_repeated");
        format = line.slice(";     Format: ".length);
      } else if (/^;     Dumped by pg_dump version: /.test(line)) {
        if (producer !== null) refusePlan("RESTORE_TOC_INVALID", "producer_header_repeated");
        producer = line.slice(";     Dumped by pg_dump version: ".length);
      } else if (line === "; Selected TOC Entries:") selected = true;
      else if (line.includes("depends on:")) refusePlan("RESTORE_TOC_INVALID", "dependency_comment_shape");
      continue;
    }
    const match = /^([1-9]\d*); (\d+) (\d+) (.*)$/.exec(line);
    if (!selected) refusePlan("RESTORE_TOC_INVALID", "entry_before_selected");
    if (!match) refusePlan("RESTORE_TOC_INVALID", "entry_shape");
    const id = integer(match[1]), catalogClass = integer(match[2], 4294967295), catalogOid = integer(match[3], 4294967295);
    if (ids.has(id)) refusePlan("RESTORE_TOC_INVALID", "entry_id_repeated");
    ids.add(id);
    const description = descriptions.find(value => match[4].startsWith(value + " "));
    if (!description) refuseUnsupported("unknown_descriptor", null, "unparsed", "not_parsed");
    const tail = /^([a-z_][a-z0-9_]*|-) (.*) ([a-z_][a-z0-9_]*|)$/.exec(match[4].slice(description.length + 1));
    if (!tail || !tail[2] || /[;"\\]/.test(tail[2])) refuseUnsupported("tail_grammar", description, scopeCategory(tail?.[1]), !tail ? "missing_fields" : !tail[2] ? "empty_tag" : "forbidden_tag_character");
    previous = { id, catalogClass, catalogOid, description, schema: tail[1], tag: tail[2], owner: tail[3], line, dependencies: null };
    rows.push(previous);
  }
  if (format !== "CUSTOM") refusePlan("RESTORE_TOC_INVALID", "format_header_invalid");
  if (!/^18\.\d+(?:[ .].*)?$/.test(producer ?? "")) refusePlan("RESTORE_TOC_INVALID", "producer_header_invalid");
  if (!count) refusePlan("RESTORE_TOC_INVALID", "count_header_invalid");
  if (count !== rows.length) refusePlan("RESTORE_TOC_INVALID", "entry_count_mismatch");
  if (!verboseDependencies) refusePlan("RESTORE_TOC_INVALID", "verbose_dependencies_missing");
  for (const row of rows) {
    row.dependencies ??= [];
    // Keep original dependency order and the original first bad edge.
    for (const id of row.dependencies) {
      if (id === row.id) refusePlan("RESTORE_TOC_DEPENDENCY_INVALID", "dependency_self", row.description, scopeCategory(row.schema));
      if (!ids.has(id)) refusePlan("RESTORE_TOC_DEPENDENCY_INVALID", "dependency_missing", row.description, scopeCategory(row.schema));
    }
  }
  return rows;
}

/** Pure preparation; passing this function never authorizes a connection. */
export function planManagedRestore(tocText, binding) {
  const bound = closed(binding, ["archiveSha256", "databaseSha256", "databaseBytes"], "RESTORE_MANAGED_BINDING_INVALID");
  if (!sha256(bound.archiveSha256) || !sha256(bound.databaseSha256) || !Number.isSafeInteger(bound.databaseBytes) || bound.databaseBytes <= 0) fail("RESTORE_MANAGED_BINDING_INVALID");
  const rows = parseVerboseToc(tocText), core = [], preserved = [], customRows = new Map(), databaseMetadata = new Map();
  for (const row of rows) {
    // PG18 dumpDatabase uses datname for these two entries and DATABASE
    // qdatname for its ACL/comment. Both configured databases are postgres.
    // Preserve their COMPLETE definitions, properties, owner and ACL for the
    // future native baseline comparator; NEVER select/replay CREATE/DROP/ALTER
    // DATABASE or substitute the same name/count for archive equality.
    if (["DATABASE", "DATABASE PROPERTIES"].includes(row.description) || row.schema === "-" && ["ACL", "COMMENT"].includes(row.description) && row.tag === "DATABASE postgres") {
      if (row.schema !== "-" || !row.owner || row.tag !== (["ACL", "COMMENT"].includes(row.description) ? "DATABASE postgres" : "postgres")) refuseUnsupported("scope_classification", row.description, scopeCategory(row.schema), "valid");
      if (databaseMetadata.has(row.description)) refusePlan("RESTORE_TOC_INVALID", "database_metadata_repeated", row.description, scopeCategory(row.schema));
      databaseMetadata.set(row.description, row); preserved.push(row); continue;
    }
    const customization = custom.find(value => value.description === row.description && value.schema === row.schema && value.tag === row.tag);
    if (customization) {
      if (customRows.has(customization.key)) refusePlan("RESTORE_MANAGED_CUSTOM_INVALID", "customization_repeated", row.description, scopeCategory(row.schema));
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
    else refuseUnsupported("scope_classification", row.description, scopeCategory(row.schema), "valid");
  }
  // PG18 emits DATABASE/PROPERTIES with no recorded dependencies: the latter
  // supplies .deps but not .nDeps. ACL/comment alone record the DATABASE edge.
  // Do not invent that absent edge or accept one to an unrelated object.
  const databaseRow = databaseMetadata.get("DATABASE");
  if (databaseMetadata.size && !databaseRow) refusePlan("RESTORE_TOC_DEPENDENCY_INVALID", "database_metadata_orphan");
  for (const row of databaseMetadata.values()) {
    const dependsOnDatabase = ["ACL", "COMMENT"].includes(row.description);
    if (row.owner !== databaseRow.owner) refusePlan("RESTORE_TOC_DEPENDENCY_INVALID", "database_owner_mismatch", row.description, scopeCategory(row.schema));
    if (row.dependencies.length !== (dependsOnDatabase ? 1 : 0) || dependsOnDatabase && row.dependencies[0] !== databaseRow.id) refusePlan("RESTORE_TOC_DEPENDENCY_INVALID", "database_dependency_shape", row.description, scopeCategory(row.schema));
  }
  if (customRows.size !== custom.length) refusePlan("RESTORE_MANAGED_CUSTOM_INVALID", "customization_missing");
  if (!core.some(row => row.schema === "auth" && row.description === "TABLE DATA" && row.tag === "users")) refusePlan("RESTORE_MANAGED_CUSTOM_INVALID", "auth_user_data_missing");
  // Core retains native TOC order. Custom DDL follows core, in original order.
  // A core dependency on delayed custom DDL would change native ordering.
  const delayed = new Set([...customRows.values()].map(row => row.id));
  for (const row of core) if (row.dependencies.some(id => delayed.has(id))) refusePlan("RESTORE_TOC_DEPENDENCY_INVALID", "core_depends_on_delayed_customization", row.description, scopeCategory(row.schema));
  const later = [...customRows.entries()].sort((a, b) => rows.indexOf(a[1]) - rows.indexOf(b[1]));
  const completed = new Set([...core, ...preserved].map(row => row.id));
  for (const [, row] of later) {
    if (row.dependencies.some(id => !completed.has(id))) refusePlan("RESTORE_TOC_DEPENDENCY_INVALID", "customization_dependency_not_completed", row.description, scopeCategory(row.schema));
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
  const facts = closed(evidence, ["archiveSha256", "databaseSha256", "databaseBytes", "tocSha256", "nativeSqlControlQualified", "actor", "sameActor", "allTargetsEmpty", "baselineMatchesArchive", "baselineOwnerAclMatchesArchive", "appOwnerAclCanBeRestored", "dataCopyCanUseOperator", "replicaCanUseOperator", "referencesCanBeVerified", "managedMigrationHistories", "customRoles"], "RESTORE_MANAGED_QUALIFICATION_INVALID");
  for (const key of ["archiveSha256", "databaseSha256", "databaseBytes", "tocSha256"]) if (facts[key] !== details[key]) fail("RESTORE_MANAGED_BINDING_INVALID");
  for (const key of ["nativeSqlControlQualified", "sameActor", "allTargetsEmpty", "baselineMatchesArchive", "baselineOwnerAclMatchesArchive", "appOwnerAclCanBeRestored", "dataCopyCanUseOperator", "referencesCanBeVerified"]) if (facts[key] !== true) fail("RESTORE_MANAGED_PREREQUISITES_REQUIRED");
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
  const metadata = row => Object.freeze({ id: row.id, catalogClassOid: row.catalogClass, catalogObjectOid: row.catalogOid, description: row.description, schema: row.schema, tag: row.tag, owner: row.owner, dependencies: Object.freeze([...row.dependencies]) });
  return Object.freeze({ archiveSha256: details.archiveSha256, databaseSha256: details.databaseSha256, databaseBytes: details.databaseBytes, tocSha256: details.tocSha256, preserved: Object.freeze(details.preserved.map(metadata)), selected: Object.freeze([...details.core, ...details.custom.map(([, row]) => row)].map(metadata)) });
}
