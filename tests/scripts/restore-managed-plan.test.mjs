import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { planManagedRestore, managedRestoreRequirements, planManagedTargetBaseline, managedTargetBaselineRequirements, authorizeManagedRestore, claimManagedRestore, compareManagedMigrationHistory, managedTocUnsupportedDiagnostic, managedTocPlanDiagnostic, diagnosticInventory } from "../../scripts/operations/restore-managed-plan.mjs";
import { BackupError } from "../../scripts/operations/backup-format.mjs";

const digest = value => createHash("sha256").update(value).digest("hex");
const database = Buffer.from("PGDMP_FAKE_DATABASE_ONLY_RAM"), binding = { archiveSha256: "a".repeat(64), databaseSha256: digest(database), databaseBytes: database.length };
// Artificial PrintTOCSummary PG18 output, including its actual verbose
// dependency comment syntax. No original archive or native executable is read.
const rows = [
  [1, "ENCODING", "-", "ENCODING", "", []], [2, "STDSTRINGS", "-", "STDSTRINGS", "", []], [3, "SEARCHPATH", "-", "SEARCHPATH", "", []],
  [4, "SCHEMA", "-", "public", "pg_database_owner", []], [5, "ACL", "-", "SCHEMA public", "pg_database_owner", [4]], [6, "COMMENT", "-", "SCHEMA public", "pg_database_owner", [4]],
  [7, "SCHEMA", "-", "app_private", "postgres", []], [8, "SCHEMA", "-", "auth", "supabase_auth_admin", []], [9, "SCHEMA", "-", "storage", "supabase_storage_admin", []],
  [10, "TABLE", "auth", "users", "supabase_auth_admin", [8]], [11, "TABLE", "storage", "objects", "supabase_storage_admin", [9]], [12, "TABLE", "storage", "buckets", "supabase_storage_admin", [9]],
  [13, "FUNCTION", "app_private", "on_auth_user_created()", "postgres", [7]], [14, "FUNCTION", "app_private", "check_admin_auth_creation_final()", "postgres", [7, 10]],
  [15, "TABLE", "public", "profiles", "postgres", [4, 10]], [16, "FK CONSTRAINT", "public", "profiles profiles_user_id_fkey", "postgres", [15, 10]], [17, "ACL", "public", "TABLE profiles", "postgres", [15]], [18, "DEFAULT ACL", "public", "DEFAULT PRIVILEGES FOR TABLES", "postgres", [4]],
  [19, "TABLE DATA", "auth", "users", "supabase_auth_admin", [10]], [20, "TABLE DATA", "public", "profiles", "postgres", [15]], [21, "TABLE DATA", "storage", "objects", "supabase_storage_admin", [11]], [22, "TABLE DATA", "storage", "buckets", "supabase_storage_admin", [12]],
  [23, "SEQUENCE", "auth", "refresh_tokens_id_seq", "supabase_auth_admin", [8]], [24, "SEQUENCE SET", "auth", "refresh_tokens_id_seq", "supabase_auth_admin", [23]],
  [25, "TRIGGER", "auth", "users second_brain_identity_created", "postgres", [10, 13]], [26, "TRIGGER", "auth", "users second_brain_admin_creation_final", "postgres", [10, 14]],
  [27, "POLICY", "storage", "objects second_brain_private_objects", "supabase_storage_admin", [11]], [28, "POLICY", "storage", "buckets second_brain_private_buckets", "supabase_storage_admin", [12]],
];
const toc = (selected = rows) => ";\n; Archive created at artificial RAM fixture\n;     dbname: postgres\n;     TOC Entries: " + selected.length + "\n;     Compression: gzip\n;     Dump Version: 1.16-0\n;     Format: CUSTOM\n;     Integer: 4 bytes\n;     Offset: 8 bytes\n;     Dumped from database version: 17.11\n;     Dumped by pg_dump version: 18.4\n;\n;\n; Selected TOC Entries:\n;\n" + selected.map(([id, type, schema, tag, owner, dependencies]) => `${id}; 0 0 ${type} ${schema} ${tag} ${owner}\n` + (dependencies.length ? ";\tdepends on: " + dependencies.join(" ") + "\n" : "")).join("");
const scopes = { identityTrigger: ["auth", "users", "CREATE TRIGGER"], adminTrigger: ["auth", "users", "CREATE CONSTRAINT TRIGGER"], objectsPolicy: ["storage", "objects", "CREATE POLICY"], bucketsPolicy: ["storage", "buckets", "CREATE POLICY"] };
const roles = (mode = "setRole") => Object.fromEntries(Object.entries(scopes).map(([key, [schema, table, operation]]) => [key, { mode, actor: "postgres", schema, table, operation, canCreate: true, ...(mode === "setRole" ? { role: key.includes("Policy") ? "supabase_storage_admin" : "supabase_auth_admin", canSetRole: true } : {}) }]));
const replica = () => ({ actor: "postgres", setLocalObserved: true, readback: "replica", rollbackObserved: true });
const history = () => ({ auth: [{ version: "20260101000000" }, { version: "20260201000000" }], storage: [{ id: 0, name: "create-migrations-table", hash: "a".repeat(40), executed_at: "2026-10-12 12:00:00" }, { id: 1, name: "initialmigration", hash: "b".repeat(40), executed_at: null }] });
const evidence = plan => ({ ...binding, tocSha256: managedRestoreRequirements(plan).tocSha256, nativeSqlControlQualified: true, actor: "postgres", sameActor: true, allTargetsEmpty: true, baselineMatchesArchive: true, baselineOwnerAclMatchesArchive: true, appOwnerAclCanBeRestored: true, dataCopyCanUseOperator: true, replicaCanUseOperator: replica(), referencesCanBeVerified: true, managedMigrationHistories: { archive: history(), target: history() }, customRoles: roles() });
const refusal = (fn, code) => assert.throws(fn, error => error.code === code);
const postgresMetadata = [
  [29, "DATABASE", "-", "postgres", "postgres", []],
  [30, "DATABASE PROPERTIES", "-", "postgres", "postgres", []],
  [31, "COMMENT", "-", "DATABASE postgres", "postgres", [29]],
  [32, "ACL", "-", "DATABASE postgres", "postgres", [29]],
];

test("source restore plans and required project customizations do not become target baseline handles", () => {
  const plan = planManagedRestore(toc(), binding);
  refusal(() => managedTargetBaselineRequirements(plan), "RESTORE_MANAGED_TARGET_BASELINE_REQUIRED");
  const targetBinding = { projectRef: "t".repeat(20), databaseName: "postgres", nativeDumpSha256: digest(database), nativeDumpBytes: database.length };
  refusal(() => planManagedTargetBaseline(toc(), targetBinding), "RESTORE_MANAGED_TARGET_SCOPE_UNSUPPORTED");
  const withoutCustom = rows.filter(row => ![25, 26, 27, 28].includes(row[0]));
  refusal(() => planManagedRestore(toc(withoutCustom), binding), "RESTORE_MANAGED_CUSTOM_INVALID");
  assert.deepEqual(Object.keys(plan), ["version", "selectedEntries", "preservedEntries", "segments"]);
});

test("private requirements retain both original uint32 catalogue OIDs for native-to-binary cross-check without exposing them in the public plan", () => {
  const text = toc().replace("10; 0 0 TABLE auth users", "10; 1259 42000 TABLE auth users").replace("15; 0 0 TABLE public profiles", "15; 1259 4294967295 TABLE public profiles");
  const plan = planManagedRestore(text, binding), requirements = managedRestoreRequirements(plan);
  const preserved = requirements.preserved.find(row => row.id === 10), selected = requirements.selected.find(row => row.id === 15);
  assert.equal(preserved.catalogClassOid, 1259); assert.equal(preserved.catalogObjectOid, 42000);
  assert.equal(selected.catalogClassOid, 1259); assert.equal(selected.catalogObjectOid, 4294967295);
  assert.equal(Object.isFrozen(preserved), true); assert.equal(Object.isFrozen(selected), true);
  assert.throws(() => { preserved.catalogObjectOid = 1; }, TypeError);
  assert.equal(requirements.tocSha256, digest(text));
  assert.deepEqual(Object.keys(plan), ["version", "selectedEntries", "preservedEntries", "segments"]);
  assert.equal(JSON.stringify(plan).includes("1259"), false); assert.equal(JSON.stringify(plan).includes("42000"), false);
  const execution = claimManagedRestore(plan, authorizeManagedRestore(plan, evidence(plan)));
  assert.equal(execution.segments[0].list.includes("15; 1259 4294967295 TABLE public profiles"), true);
});

test("every existing parser/dependency/custom veto preserves its code and supplies an original closed reason without private tokens", () => {
  const expected = (reason, knownKind = null, scopeCategory = "unparsed") => ({ version: 1, reason, knownKind, scopeCategory });
  const invalid = "RESTORE_TOC_INVALID", dependency = "RESTORE_TOC_DEPENDENCY_INVALID", custom = "RESTORE_MANAGED_CUSTOM_INVALID";
  const text = toc(), dbRows = [...rows, ...postgresMetadata];
  const cases = [
    [null, invalid, expected("input_shape")],
    [text.replace("TOC Entries: 28", "TOC Entries: PRIVATE_CANARY"), invalid, expected("integer_shape")],
    [text.replace("28; 0 0 POLICY", "9007199254740992; 0 0 POLICY"), invalid, expected("integer_range")],
    [";\tdepends on: 1\n" + text, invalid, expected("dependency_without_entry")],
    [text.replace(";\tdepends on: 4\n", ";\tdepends on: 4\n;\tdepends on: 4\n"), invalid, expected("dependency_comment_repeated", "ACL", "global")],
    [text.replace(";\tdepends on: 4\n", ";\tdepends on: 4_PRIVATE_CANARY\n"), invalid, expected("dependency_comment_shape", "ACL", "global")],
    [";     TOC Entries: 28\n" + text, invalid, expected("count_header_repeated")],
    [";     Format: CUSTOM\n" + text, invalid, expected("format_header_repeated")],
    [";     Dumped by pg_dump version: 18.4\n" + text, invalid, expected("producer_header_repeated")],
    [text.replace("; Selected TOC Entries:\n", ""), invalid, expected("entry_before_selected")],
    [text.replace("1; 0 0 ENCODING", "PRIVATE_CANARY ENCODING"), invalid, expected("entry_shape")],
    [text.replace("28; 0 0 POLICY", "27; 0 0 POLICY"), invalid, expected("entry_id_repeated")],
    [text.replace("Format: CUSTOM", "Format: PRIVATE_CANARY"), invalid, expected("format_header_invalid")],
    [text.replace("version: 18.4", "version: PRIVATE_CANARY"), invalid, expected("producer_header_invalid")],
    [text.replace(";     TOC Entries: 28\n", ""), invalid, expected("count_header_invalid")],
    [text.replace("TOC Entries: 28", "TOC Entries: 27"), invalid, expected("entry_count_mismatch")],
    [text.replace(/^;\tdepends on:.*\n/gm, ""), invalid, expected("verbose_dependencies_missing")],
    [text.replace(";\tdepends on: 4\n", ";\tdepends on: 5\n"), dependency, expected("dependency_self", "ACL", "global")],
    [text.replace(";\tdepends on: 4\n", ";\tdepends on: 999\n"), dependency, expected("dependency_missing", "ACL", "global")],
    [toc([...dbRows, [33, ...postgresMetadata[0].slice(1)]]), invalid, expected("database_metadata_repeated", "DATABASE", "global")],
    [toc([...rows, postgresMetadata[1]]), dependency, expected("database_metadata_orphan")],
    [toc(dbRows.map(row => row[0] === 30 ? [...row.slice(0, 4), "private_owner_canary", row[5]] : row)), dependency, expected("database_owner_mismatch", "DATABASE PROPERTIES", "global")],
    [toc(dbRows.map(row => row[0] === 30 ? [...row.slice(0, 5), [29]] : row)), dependency, expected("database_dependency_shape", "DATABASE PROPERTIES", "global")],
    [toc([...rows, [29, ...rows.find(row => row[0] === 25).slice(1)]]), custom, expected("customization_repeated", "TRIGGER", "managed")],
    [toc(rows.filter(row => row[0] !== 25)), custom, expected("customization_missing")],
    [toc(rows.filter(row => row[0] !== 19)), custom, expected("auth_user_data_missing")],
    [toc(rows.map(row => row[0] === 15 ? [...row.slice(0, 5), [4, 10, 25]] : row)), dependency, expected("core_depends_on_delayed_customization", "TABLE", "app")],
    [toc(rows.map(row => row[0] === 25 ? [...row.slice(0, 5), [10, 13, 27]] : row)), dependency, expected("customization_dependency_not_completed", "TRIGGER", "managed")],
  ];
  assert.equal(cases.length, 28);
  for (const [value, code, diagnostic] of cases) {
    let original;
    assert.throws(() => planManagedRestore(value, binding), error => { original = error; return error instanceof BackupError && error.code === code; }, diagnostic.reason);
    assert.deepEqual(managedTocPlanDiagnostic(original), diagnostic); assert.equal(Object.isFrozen(managedTocPlanDiagnostic(original)), true);
    assert.equal(Object.hasOwn(original, "tocPlanDiagnostic"), false); assert.equal(managedTocUnsupportedDiagnostic(original), null);
    const result = JSON.stringify(managedTocPlanDiagnostic(original));
    for (const secret of ["PRIVATE_CANARY", "private_owner_canary", '"postgres"', '"auth"', '"storage"', "999", "28;", "CREATE", "SELECT"]) assert.equal(result.includes(secret), false, diagnostic.reason);
    assert.throws(() => { managedTocPlanDiagnostic(original).reason = "PRIVATE_CANARY"; }, TypeError);
  }
  // Keep the first original bad edge, not a later preferred diagnosis.
  let first;
  assert.throws(() => planManagedRestore(text.replace(";\tdepends on: 4\n", ";\tdepends on: 999 5\n"), binding), error => { first = error; return error.code === dependency; });
  assert.equal(managedTocPlanDiagnostic(first).reason, "dependency_missing");
});
test("plan diagnostics never trust forged errors/proxies/getters, unrelated refusals or caller-owned fields", () => {
  let reads = 0; const forged = new BackupError("RESTORE_TOC_INVALID");
  for (const key of ["code", "message", "tocPlanDiagnostic", "version", "reason", "knownKind", "scopeCategory"]) Object.defineProperty(forged, key, { enumerable: true, configurable: true, get() { reads++; throw Error("PRIVATE_CANARY"); } });
  const proxy = new Proxy(forged, { get() { reads++; throw Error("PRIVATE_CANARY"); }, ownKeys() { reads++; throw Error("PRIVATE_CANARY"); } });
  for (const value of [null, undefined, 1, "PRIVATE_CANARY", forged, proxy, { version: 1, reason: "entry_shape", knownKind: null, scopeCategory: "unparsed" }]) assert.equal(managedTocPlanDiagnostic(value), null);
  let unsupported, bindingError;
  assert.throws(() => planManagedRestore(toc([...rows, [29, "UNKNOWN_PRIVATE_CANARY", "-", "private_name", "private_owner", []]]), binding), error => { unsupported = error; return error.code === "RESTORE_TOC_UNSUPPORTED"; });
  assert.throws(() => planManagedRestore(toc(), { ...binding, databaseBytes: 0 }), error => { bindingError = error; return error.code === "RESTORE_MANAGED_BINDING_INVALID"; });
  for (const value of [unsupported, bindingError, planManagedRestore(toc(), binding)]) assert.equal(managedTocPlanDiagnostic(value), null);
  assert.equal(reads, 0);
});

test("native PG18 postgres database entries remain entirely preserved and cannot enter any of the five replay segments", () => {
  const original = planManagedRestore(toc(), binding), originalRequirements = managedRestoreRequirements(original);
  const selected = [...rows.slice(0, 3), ...postgresMetadata, ...rows.slice(3)], plan = planManagedRestore(toc(selected), binding), requirements = managedRestoreRequirements(plan);
  assert.deepEqual(plan, { version: 1, selectedEntries: 19, preservedEntries: 13, segments: 5 });
  assert.deepEqual(requirements.selected, originalRequirements.selected);
  assert.deepEqual(requirements.preserved.slice(0, 4), postgresMetadata.map(([id, description, schema, tag, owner, dependencies]) => ({ id, catalogClassOid: 0, catalogObjectOid: 0, description, schema, tag, owner, dependencies })));
  assert.deepEqual(requirements.preserved.slice(4), originalRequirements.preserved);
  assert.equal(requirements.tocSha256, digest(toc(selected)));
  assert.throws(() => { requirements.preserved[0].owner = "another_owner"; }, TypeError);
  refusal(() => claimManagedRestore(plan, {}), "RESTORE_MANAGED_AUTHORIZATION_REQUIRED");
  // Only synthetic facts exercise the existing private authorization contract;
  // this fixture cannot qualify a real baseline, owner, ACL or property value.
  for (const mode of ["setRole", "currentActor"]) {
    const beforePlan = planManagedRestore(toc(), binding), afterPlan = planManagedRestore(toc(selected), binding);
    const beforeFacts = evidence(beforePlan), afterFacts = evidence(afterPlan); beforeFacts.customRoles = roles(mode); afterFacts.customRoles = roles(mode);
    const before = claimManagedRestore(beforePlan, authorizeManagedRestore(beforePlan, beforeFacts)), after = claimManagedRestore(afterPlan, authorizeManagedRestore(afterPlan, afterFacts));
    assert.deepEqual(after.segments, before.segments); assert.equal(after.segments.length, 5);
    const replay = after.segments.map(segment => segment.list).join("");
    for (const kind of ["DATABASE postgres", "DATABASE PROPERTIES", "COMMENT - DATABASE", "ACL - DATABASE"]) assert.equal(replay.includes(kind), false);
    assert.equal(replay.includes("TABLE DATA auth users"), true); assert.equal(replay.includes("TABLE DATA storage objects"), true); assert.equal(replay.includes("TABLE DATA storage buckets"), true);
  }
});
test("database metadata is restricted to global postgres and exact native DATABASE postgres ACL/comment tags", () => {
  for (const row of [
    [29, "DATABASE", "-", "another_database", "postgres", []], [29, "DATABASE PROPERTIES", "-", "another_database", "postgres", []],
    [29, "DATABASE", "public", "postgres", "postgres", []], [29, "DATABASE PROPERTIES", "auth", "postgres", "postgres", []],
    [29, "DATABASE", "-", "postgres", "", []], [29, "DATABASE", "-", "DATABASE postgres", "postgres", []],
    [29, "ACL", "-", "postgres", "postgres", []], [29, "COMMENT", "-", "postgres", "postgres", []],
    [29, "ACL", "-", "DATABASE another_database", "postgres", []], [29, "COMMENT", "-", "DATABASE another_database", "postgres", []],
    [29, "ACL", "-", "SCHEMA another_schema", "postgres", []], [29, "COMMENT", "-", "TABLE postgres", "postgres", []],
    [29, "DEFAULT ACL", "-", "DATABASE postgres", "postgres", []], [29, "SECURITY LABEL", "-", "DATABASE postgres", "postgres", []],
  ]) refusal(() => planManagedRestore(toc([...rows, row]), binding), "RESTORE_TOC_UNSUPPORTED");
});
test("duplicate or orphan postgres metadata cannot borrow unrelated dependencies or hide inconsistent owners", () => {
  for (const row of postgresMetadata) refusal(() => planManagedRestore(toc([...rows, ...postgresMetadata, [33, ...row.slice(1)]]), binding), "RESTORE_TOC_INVALID");
  for (const row of postgresMetadata.slice(1)) {
    refusal(() => planManagedRestore(toc([...rows, [...row.slice(0, 5), [3]]]), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
    for (const dependencies of row[1] === "DATABASE PROPERTIES" ? [[29], [3], [29, 3]] : [[], [3], [29, 3]]) {
      const changed = postgresMetadata.map(metadata => metadata === row ? [...metadata.slice(0, 5), dependencies] : metadata);
      refusal(() => planManagedRestore(toc([...rows, ...changed]), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
    }
    const changedOwner = postgresMetadata.map(metadata => metadata === row ? [...metadata.slice(0, 4), "another_owner", metadata[5]] : metadata);
    refusal(() => planManagedRestore(toc([...rows, ...changedOwner]), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
  }
  const falseDatabaseEdge = postgresMetadata.map(row => row[1] === "DATABASE" ? [...row.slice(0, 5), [3]] : row);
  refusal(() => planManagedRestore(toc([...rows, ...falseDatabaseEdge]), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
  const changedIds = postgresMetadata.map(metadata => metadata[0] === 32 ? [31, ...metadata.slice(1)] : metadata);
  refusal(() => planManagedRestore(toc([...rows, ...changedIds]), binding), "RESTORE_TOC_INVALID");
});
test("preserving database rows keeps every baseline and owner-ACL premise mandatory without introducing an external override", () => {
  const plan = planManagedRestore(toc([...rows, ...postgresMetadata]), binding);
  for (const key of ["baselineMatchesArchive", "baselineOwnerAclMatchesArchive", "nativeSqlControlQualified", "allTargetsEmpty"]) refusal(() => authorizeManagedRestore(plan, { ...evidence(plan), [key]: false }), "RESTORE_MANAGED_PREREQUISITES_REQUIRED");
  refusal(() => authorizeManagedRestore(plan, { ...evidence(plan), databaseNameMatches: true }), "RESTORE_MANAGED_QUALIFICATION_INVALID");
  const changed = postgresMetadata.map(row => [...row.slice(0, 4), "another_owner", row[5]]);
  const otherPlan = planManagedRestore(toc([...rows, ...changed]), binding), facts = evidence(plan);
  refusal(() => authorizeManagedRestore(otherPlan, facts), "RESTORE_MANAGED_BINDING_INVALID");
  // The exact native definitions/properties/ACLs are a future A2/native
  // comparator input, never inferred from these counts or a matching name.
  assert.notEqual(managedRestoreRequirements(otherPlan).tocSha256, managedRestoreRequirements(plan).tocSha256);
});

// Public PG18 pg_dump.c literal descriptions, plus the pre-existing parser
// descriptors emitted through variables. This fixture never reads an archive.
const fixedInventoryKinds = ["ACCESS METHOD", "ACL", "AGGREGATE", "BLOB METADATA", "BLOBS", "CAST", "COLLATION", "COMMENT", "CONSTRAINT", "CONVERSION", "DATABASE", "DATABASE PROPERTIES", "DEFAULT", "DEFAULT ACL", "DOMAIN", "DOMAIN CONSTRAINT", "ENCODING", "EVENT TRIGGER", "EXTENSION", "FK CONSTRAINT", "FOREIGN DATA WRAPPER", "FUNCTION", "INDEX", "INDEX ATTACH", "MATERIALIZED VIEW", "MATERIALIZED VIEW DATA", "OPERATOR", "OPERATOR CLASS", "OPERATOR FAMILY", "POLICY", "PROCEDURAL LANGUAGE", "PROCEDURE", "PUBLICATION", "PUBLICATION TABLE", "PUBLICATION TABLES IN SCHEMA", "ROW SECURITY", "RULE", "SCHEMA", "SEARCHPATH", "SECURITY LABEL", "SEQUENCE", "SEQUENCE OWNED BY", "SEQUENCE SET", "SERVER", "SHELL TYPE", "STATISTICS", "STATISTICS DATA", "STDSTRINGS", "SUBSCRIPTION", "SUBSCRIPTION TABLE", "TABLE", "TABLE ATTACH", "TABLE DATA", "TEXT SEARCH CONFIGURATION", "TEXT SEARCH DICTIONARY", "TEXT SEARCH PARSER", "TEXT SEARCH TEMPLATE", "TRANSFORM", "TRIGGER", "TYPE", "USER MAPPING", "VIEW", "pg_largeobject"];
const inventoryFields = ["version", "headersValid", "dumpEntries", "countObserved", "unknownClassCount", "malformedRowCount", "classes"];
function assertInventoryClosed(value) {
  assert.deepEqual(Object.keys(value), inventoryFields); assert.equal(Object.isFrozen(value), true); assert.equal(Object.isFrozen(value.classes), true);
  assert.equal(value.version, 1); assert.equal(typeof value.headersValid, "boolean");
  for (const field of ["countObserved", "unknownClassCount", "malformedRowCount"]) assert.equal(Number.isSafeInteger(value[field]) && value[field] >= 0, true);
  assert.equal(value.dumpEntries === null || Number.isSafeInteger(value.dumpEntries) && value.dumpEntries > 0, true);
  assert.equal(Buffer.byteLength(JSON.stringify(value)) <= 60 * 1024, true);
  for (const entry of value.classes) {
    assert.deepEqual(Object.keys(entry), ["kind", "count", "scopes", "tails"]); assert.equal(Object.isFrozen(entry), true); assert.equal(fixedInventoryKinds.includes(entry.kind), true);
    assert.equal(Number.isSafeInteger(entry.count) && entry.count > 0, true);
    for (const [key, field, allowed] of [["scopes", "category", ["app", "managed", "global", "other", "unparsed"]], ["tails", "shape", ["not_parsed", "missing_fields", "empty_tag", "forbidden_tag_character", "valid"]]]) {
      assert.equal(Object.isFrozen(entry[key]), true); assert.equal(entry[key].reduce((sum, row) => sum + row.count, 0), entry.count);
      for (const row of entry[key]) { assert.deepEqual(Object.keys(row), [field, "count"]); assert.equal(Object.isFrozen(row), true); assert.equal(allowed.includes(row[field]), true); assert.equal(Number.isSafeInteger(row.count) && row.count > 0, true); }
    }
  }
}
test("diagnostic inventory is fixed to public PG18 classes in stable order and never makes additional descriptors executable", () => {
  const selected = fixedInventoryKinds.map((kind, index) => [index + 1, kind, "public", "PRIVATE_NAME_CANARY", "private_owner_canary", []]);
  const text = toc(selected), value = diagnosticInventory(text);
  assertInventoryClosed(value); assert.equal(value.headersValid, true); assert.equal(value.dumpEntries, fixedInventoryKinds.length);
  assert.equal(value.countObserved, fixedInventoryKinds.length); assert.equal(value.unknownClassCount, 0); assert.equal(value.malformedRowCount, 0);
  assert.deepEqual(value.classes.map(entry => entry.kind), fixedInventoryKinds);
  assert.equal(value.classes.every(entry => entry.count === 1 && entry.scopes[0].category === "app" && entry.tails[0].shape === "valid"), true);
  assert.equal(JSON.stringify(value).includes("CANARY"), false); assert.equal(JSON.stringify(value).includes("private_owner"), false);
  assert.deepEqual(diagnosticInventory(toc(selected.toReversed())), value);
  refusal(() => planManagedRestore(text, binding), "RESTORE_TOC_UNSUPPORTED");
  for (const kind of ["EXTENSION", "DATABASE PROPERTIES", "STATISTICS DATA", "BLOB METADATA", "pg_largeobject"]) refusal(() => planManagedRestore(toc([...rows, [29, kind, "-", "PRIVATE_NAME_CANARY", "postgres", []]]), binding), "RESTORE_TOC_UNSUPPORTED");
});
test("diagnostic inventory folds scopes and malformed tails into enums and counts without retaining private tokens", () => {
  const canary = "PRIVATE_SQL_OWNER_PATH_CANARY";
  const selected = [[1, "TABLE", "public", canary, "private_owner", []], [2, "TABLE", "auth", canary, "private_owner", []], [3, "TABLE", "-", canary, "private_owner", []], [4, "TABLE", "private_schema_canary", canary, "private_owner", []], [5, "TABLE", "bad.schema", canary, "private_owner", []], [6, "TABLE", "public", "", "private_owner", []], [7, "TABLE", "public", '"' + canary + '"', "private_owner", []], [8, "UNKNOWN_" + canary, "public", canary, "private_owner", []]];
  const value = diagnosticInventory(toc(selected)); assertInventoryClosed(value);
  assert.deepEqual(value, { version: 1, headersValid: true, dumpEntries: 8, countObserved: 8, unknownClassCount: 1, malformedRowCount: 3, classes: [{ kind: "TABLE", count: 7, scopes: [{ category: "app", count: 3 }, { category: "managed", count: 1 }, { category: "global", count: 1 }, { category: "other", count: 1 }, { category: "unparsed", count: 1 }], tails: [{ shape: "missing_fields", count: 1 }, { shape: "empty_tag", count: 1 }, { shape: "forbidden_tag_character", count: 1 }, { shape: "valid", count: 4 }] }] });
  for (const token of [canary, "private_owner", "private_schema_canary", "bad.schema", "UNKNOWN_"]) assert.equal(JSON.stringify(value).includes(token), false);
  assert.throws(() => { value.classes[0].scopes[0].count = 9; }, TypeError);
});
test("inventory size, ASCII and input-type guards refuse without getters or coercion; complete bounded input is retained only as counts", () => {
  let getters = 0; const object = { get toString() { getters++; throw Error("PRIVATE_CANARY"); } };
  const proxy = new Proxy(object, { get() { getters++; throw Error("PRIVATE_CANARY"); }, ownKeys() { getters++; throw Error("PRIVATE_CANARY"); } });
  for (const input of [null, undefined, 1, object, proxy, "", "\0", "é", Buffer.from(toc()), " ".repeat(4 * 1024 * 1024 + 1)]) assert.equal(diagnosticInventory(input), null);
  assert.equal(getters, 0);
  const text = toc(), bounded = text + ";" + "a".repeat(4 * 1024 * 1024 - text.length - 1), value = diagnosticInventory(bounded);
  assertInventoryClosed(value); assert.equal(value.countObserved, rows.length); assert.equal(value.headersValid, true);
});
test("inventory headers are narrowly checked and malformed rows or unknown classes cannot be treated as authority", () => {
  for (const alter of [text => text.replace("TOC Entries: 28", "TOC Entries: 27"), text => text.replace("TOC Entries: 28", "TOC Entries: 9007199254740992"), text => text.replace("TOC Entries: 28", "TOC Entries: 0"), text => text.replace(";     Format: CUSTOM", ";     Format: DIRECTORY"), text => text.replace("version: 18.4", "version: 17.11"), text => text.replace("; Selected TOC Entries:", ""), text => text + "; Selected TOC Entries:\n", text => ";     Format: CUSTOM\n" + text, text => ";     TOC Entries: 28\n" + text, text => ";     Dumped by pg_dump version: 18.4\n" + text, text => "1; 0 0 TABLE private_schema_canary private_name private_owner\n" + text]) {
    const value = diagnosticInventory(alter(toc())); assertInventoryClosed(value); assert.equal(value.headersValid, false);
  }
  const malformed = diagnosticInventory(toc().replace("28; 0 0 POLICY", "9007199254740992; 0 0 POLICY"));
  assertInventoryClosed(malformed); assert.equal(malformed.headersValid, true); assert.equal(malformed.malformedRowCount, 1); assert.equal(malformed.countObserved, rows.length);
  const duplicates = toc().replace("28; 0 0 POLICY", "27; 0 0 POLICY");
  assert.equal(diagnosticInventory(duplicates).headersValid, true); refusal(() => planManagedRestore(duplicates, binding), "RESTORE_TOC_INVALID");
  const dependencies = toc().replace(";\tdepends on: 8\n", ";\tdepends on: 999\n");
  assert.equal(diagnosticInventory(dependencies).headersValid, true); refusal(() => planManagedRestore(dependencies, binding), "RESTORE_TOC_DEPENDENCY_INVALID");
});

test("PG18 verbose selection preserves managed DDL/public schema and explicitly includes original app security and four customizations", () => {
  const text = toc(), plan = planManagedRestore(text, binding), requirements = managedRestoreRequirements(plan);
  assert.deepEqual(plan, { version: 1, selectedEntries: 19, preservedEntries: 9, segments: 5 });
  assert.deepEqual(requirements.preserved.map(row => row.id), [4, 5, 6, 8, 9, 10, 11, 12, 23]);
  assert.equal(requirements.selected.some(row => row.description === "ACL" && row.schema === "public"), true);
  assert.equal(requirements.selected.some(row => row.description === "DEFAULT ACL"), true);
  assert.equal(requirements.selected.some(row => row.description === "SEQUENCE SET" && row.schema === "auth"), true);
  assert.equal(requirements.tocSha256, digest(text));
  const execution = claimManagedRestore(plan, authorizeManagedRestore(plan, evidence(plan)));
  assert.equal(execution.segments[0].role, null);
  assert.deepEqual(execution.segments.slice(1).map(segment => segment.role), ["supabase_auth_admin", "supabase_auth_admin", "supabase_storage_admin", "supabase_storage_admin"]);
  assert.equal(execution.segments.map(segment => segment.list).join("").includes("TABLE auth users"), false);
  assert.equal(execution.segments[0].list.includes("TABLE DATA auth users"), true);
  assert.equal(execution.segments[0].list.includes("FK CONSTRAINT public profiles"), true);
});
test("no data-only/global schema exclusion can silently lose a custom trigger or policy", () => {
  for (const id of [25, 26, 27, 28]) refusal(() => planManagedRestore(toc(rows.filter(row => row[0] !== id)), binding), "RESTORE_MANAGED_CUSTOM_INVALID");
  refusal(() => planManagedRestore(toc(rows.filter(row => row[0] !== 19)), binding), "RESTORE_MANAGED_CUSTOM_INVALID");
  const duplicate = [...rows, [29, "POLICY", "storage", "objects second_brain_private_objects", "supabase_storage_admin", [11]]];
  refusal(() => planManagedRestore(toc(duplicate), binding), "RESTORE_MANAGED_CUSTOM_INVALID");
});
test("auth.schema_migrations and storage.migrations DATA are explicit baseline preservation, not user DATA or a generic table-name exclusion", () => {
  const text = toc([...rows, [29, "TABLE DATA", "auth", "schema_migrations", "supabase_auth_admin", [8]], [30, "TABLE DATA", "storage", "migrations", "supabase_storage_admin", [9]], [31, "TABLE DATA", "auth", "other_user_data", "supabase_auth_admin", [8]]]);
  const plan = planManagedRestore(text, binding), requirements = managedRestoreRequirements(plan);
  assert.deepEqual(requirements.preserved.slice(-2).map(row => [row.id, row.schema, row.tag]), [[29, "auth", "schema_migrations"], [30, "storage", "migrations"]]);
  assert.equal(requirements.selected.some(row => row.id === 31), true);
  const execution = claimManagedRestore(plan, authorizeManagedRestore(plan, evidence(plan)));
  const selected = execution.segments.map(segment => segment.list).join("");
  assert.equal(selected.includes("TABLE DATA auth schema_migrations"), false); assert.equal(selected.includes("TABLE DATA storage migrations"), false);
  assert.equal(selected.includes("TABLE DATA auth users"), true); assert.equal(selected.includes("TABLE DATA auth other_user_data"), true);
});
test("snapshot/target migration versions, identities and hashes must match; only declared Storage execution timestamps are ignored", () => {
  const archive = history(), target = history(); target.auth.reverse(); target.storage.reverse(); target.storage[1].executed_at = "2026-10-13 19:00:00";
  assert.equal(compareManagedMigrationHistory(archive, target), true);
  const plan = planManagedRestore(toc(), binding);
  for (const alter of [data => { data.auth[0].version = "DIFFERENT_VERSION"; }, data => { data.storage[0].id = 7; }, data => { data.storage[0].name = "DIFFERENT_IDENTITY"; }, data => { data.storage[0].hash = "c".repeat(40); }, data => { data.auth.pop(); }]) {
    const changed = history(); alter(changed); assert.equal(compareManagedMigrationHistory(archive, changed), false);
    const facts = evidence(plan); facts.managedMigrationHistories.target = changed;
    refusal(() => authorizeManagedRestore(plan, facts), "RESTORE_MANAGED_PREREQUISITES_REQUIRED");
  }
  let getters = 0; const badGetter = history(); Object.defineProperty(badGetter.storage[0], "executed_at", { enumerable: true, get() { getters++; return "SAME_TIMESTAMP"; } });
  const unknownColumn = history(); unknownColumn.storage[0].created_at = "SAME_TIMESTAMP";
  const duplicate = history(); duplicate.auth.push({ ...duplicate.auth[0] });
  const missing = history(); missing.storage[0].hash = null;
  for (const bad of [badGetter, unknownColumn, duplicate, missing]) refusal(() => compareManagedMigrationHistory(archive, bad), "RESTORE_MANAGED_MIGRATION_HISTORY_INVALID");
  assert.equal(getters, 0);
});
test("app_private schema owner/ACL/comment stay explicit and managed/public metadata preservation still requires archive equality", () => {
  const text = toc([...rows, [29, "ACL", "-", "SCHEMA app_private", "postgres", [7]], [30, "COMMENT", "-", "SCHEMA app_private", "postgres", [7]]]);
  const plan = planManagedRestore(text, binding), requirements = managedRestoreRequirements(plan);
  assert.deepEqual(requirements.selected.slice(-6).map(row => row.id), [29, 30, 25, 26, 27, 28]);
  refusal(() => authorizeManagedRestore(plan, { ...evidence(plan), baselineOwnerAclMatchesArchive: false }), "RESTORE_MANAGED_PREREQUISITES_REQUIRED");
});
test("unknown TOC kinds, out-of-scope schema, lossy quoted names and native producer mismatch refuse", () => {
  for (const row of [[29, "BLOB", "-", "123", "postgres", []], [29, "TABLE", "outside", "external", "postgres", []], [29, "TABLE", "public", '"ambiguous name"', "postgres", []]]) refusal(() => planManagedRestore(toc([...rows, row]), binding), "RESTORE_TOC_UNSUPPORTED");
  refusal(() => planManagedRestore(toc().replace("version: 18.4", "version: 17.11"), binding), "RESTORE_TOC_INVALID");
});
test("the same three unsupported vetoes produce only closed enums, never synthetic private TOC names, owners or IDs", () => {
  const canary = "PRIVATE_CANARY_SQL_OWNER_PATH";
  const cases = [
    [[29, "UNKNOWN_" + canary, "-", canary, "private_owner_canary", []], { reason: "unknown_descriptor", knownKind: null, scopeCategory: "unparsed", tailShape: "not_parsed" }],
    [[29, "TABLE", "private.schema", canary, "private_owner_canary", []], { reason: "tail_grammar", knownKind: "TABLE", scopeCategory: "unparsed", tailShape: "missing_fields" }],
    [[29, "TABLE", "public", "", "private_owner_canary", []], { reason: "tail_grammar", knownKind: "TABLE", scopeCategory: "app", tailShape: "empty_tag" }],
    [[29, "TABLE", "public", '"' + canary + '"', "private_owner_canary", []], { reason: "tail_grammar", knownKind: "TABLE", scopeCategory: "app", tailShape: "forbidden_tag_character" }],
    [[29, "TABLE", "private_scope_canary", canary, "private_owner_canary", []], { reason: "scope_classification", knownKind: "TABLE", scopeCategory: "other", tailShape: "valid" }],
    [[29, "SCHEMA", "-", "private_scope_canary", "private_owner_canary", []], { reason: "scope_classification", knownKind: "SCHEMA", scopeCategory: "global", tailShape: "valid" }],
  ];
  for (const [row, expected] of cases) {
    let original;
    assert.throws(() => planManagedRestore(toc([...rows, row]), binding), error => { original = error; return error instanceof BackupError && error.code === "RESTORE_TOC_UNSUPPORTED"; });
    const diagnostic = managedTocUnsupportedDiagnostic(original);
    assert.deepEqual(diagnostic, expected); assert.equal(Object.isFrozen(diagnostic), true);
    assert.equal(Object.hasOwn(original, "tocDiagnostic"), false);
    const text = JSON.stringify(diagnostic);
    for (const secret of [canary, "private_owner_canary", "private_scope_canary", "private.schema", "29;"]) assert.equal(text.includes(secret), false);
    assert.throws(() => { diagnostic.reason = canary; }, TypeError);
    assert.deepEqual(managedTocUnsupportedDiagnostic(original), expected);
  }
});
test("unsupported diagnostics require the original WeakMap identity; forged errors/proxies/getters or other refusals supply no fields", () => {
  let reads = 0; const forged = new BackupError("RESTORE_TOC_UNSUPPORTED");
  for (const key of ["code", "message", "reason", "knownKind", "scopeCategory", "tailShape", "tocDiagnostic"]) Object.defineProperty(forged, key, { enumerable: true, configurable: true, get() { reads++; throw Error("PRIVATE_CANARY"); } });
  const proxy = new Proxy(forged, { get() { reads++; throw Error("PRIVATE_CANARY"); }, ownKeys() { reads++; throw Error("PRIVATE_CANARY"); } });
  for (const value of [undefined, null, 0, "PRIVATE_CANARY", forged, proxy, { reason: "scope_classification", knownKind: "TABLE", scopeCategory: "other", tailShape: "valid" }]) assert.equal(managedTocUnsupportedDiagnostic(value), null);
  let unrelated;
  assert.throws(() => planManagedRestore(toc().replace("version: 18.4", "version: 17.11"), binding), error => { unrelated = error; return error.code === "RESTORE_TOC_INVALID"; });
  assert.equal(managedTocUnsupportedDiagnostic(unrelated), null); assert.equal(reads, 0);
  const plan = planManagedRestore(toc(), binding);
  assert.equal(managedTocUnsupportedDiagnostic(plan), null);
  assert.deepEqual(plan, { version: 1, selectedEntries: 19, preservedEntries: 9, segments: 5 });
});
test("actual verbose dependency syntax requires known positive IDs and preserves delayed custom ordering", () => {
  for (const replacement of ["; depends on: 8", ";\tdepends on: 0", ";\tdepends on: 8x"]) refusal(() => planManagedRestore(toc().replace(";\tdepends on: 8", replacement), binding), "RESTORE_TOC_INVALID");
  refusal(() => planManagedRestore(toc().replace(";\tdepends on: 8\n", ";\tdepends on: 999\n"), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
  const dependent = rows.map(row => row[0] === 15 ? [...row.slice(0, 5), [4, 10, 25]] : row);
  refusal(() => planManagedRestore(toc(dependent), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
  const lateDependency = rows.map(row => row[0] === 25 ? [...row.slice(0, 5), [10, 13, 27]] : row);
  refusal(() => planManagedRestore(toc(lateDependency), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
});
test("native repeated dependencies retain multiplicity, order and original TOC binding while five replay segments stay unchanged", () => {
  const repeated = rows.map(row => row[0] === 10 ? [...row.slice(0, 5), [8, 8]] : row[0] === 15 ? [...row.slice(0, 5), [10, 4, 10, 4]] : row[0] === 25 ? [...row.slice(0, 5), [13, 10, 13]] : row);
  const text = toc(repeated), plan = planManagedRestore(text, binding), requirements = managedRestoreRequirements(plan);
  assert.deepEqual(plan, { version: 1, selectedEntries: 19, preservedEntries: 9, segments: 5 });
  assert.deepEqual(requirements.preserved.find(row => row.id === 10).dependencies, [8, 8]);
  assert.deepEqual(requirements.selected.find(row => row.id === 15).dependencies, [10, 4, 10, 4]);
  assert.deepEqual(requirements.selected.find(row => row.id === 25).dependencies, [13, 10, 13]);
  assert.equal(requirements.tocSha256, digest(text)); assert.notEqual(requirements.tocSha256, digest(toc()));
  for (const key of ["archiveSha256", "databaseSha256", "databaseBytes"]) assert.equal(requirements[key], binding[key]);
  const metadata = requirements.selected.find(row => row.id === 15); assert.equal(Object.isFrozen(metadata.dependencies), true);
  assert.throws(() => { metadata.dependencies[0] = 4; }, TypeError);
  const original = planManagedRestore(toc(), binding);
  const before = claimManagedRestore(original, authorizeManagedRestore(original, evidence(original))), after = claimManagedRestore(plan, authorizeManagedRestore(plan, evidence(plan)));
  // Existing execution lists contain the original native entry lines; verbose
  // dependency comments stay in the hash-bound private metadata, unmodified.
  assert.deepEqual(after.segments, before.segments);
  const uniqueFacts = evidence(original), anotherRepeatedPlan = planManagedRestore(text, binding);
  refusal(() => authorizeManagedRestore(anotherRepeatedPlan, uniqueFacts), "RESTORE_MANAGED_BINDING_INVALID");
});
test("repeated dependency occurrences cannot hide invalid IDs, self/missing edges or a forbidden delayed customization", () => {
  for (const dependencies of [[8, 0, 8], [8, -1, 8], [8, "8_PRIVATE_CANARY", 8], [8, 2147483648, 8]]) refusal(() => planManagedRestore(toc(rows.map(row => row[0] === 10 ? [...row.slice(0, 5), dependencies] : row)), binding), "RESTORE_TOC_INVALID");
  for (const dependencies of [[8, 999, 8], [8, 10, 8]]) refusal(() => planManagedRestore(toc(rows.map(row => row[0] === 10 ? [...row.slice(0, 5), dependencies] : row)), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
  refusal(() => planManagedRestore(toc(rows.map(row => row[0] === 15 ? [...row.slice(0, 5), [4, 25, 25]] : row)), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
  refusal(() => planManagedRestore(toc(rows.map(row => row[0] === 25 ? [...row.slice(0, 5), [10, 27, 27]] : row)), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
  // Entry identity remains unique, even when its dependency list is repeated.
  refusal(() => planManagedRestore(toc([...rows, [10, "TABLE", "auth", "users_duplicate", "supabase_auth_admin", [8, 8]]]), binding), "RESTORE_TOC_INVALID");
});
test("duplicate/truncated/unsafe IDs and headers refuse without treating visible counts as a catalog proof", () => {
  for (const text of [toc().replace("28;", "27;"), toc().replace("28;", "9007199254740992;"), toc().replace("28;", "2147483648;"), toc().replace("28; 0 0", "28; 4294967296 0"), toc().replace("Entries: 28", "Entries: 27"), toc().replace(";     Format: CUSTOM", ";     Format: CUSTOM\n;     Format: CUSTOM"), toc().replace("; Selected TOC Entries:\n", "")]) refusal(() => planManagedRestore(text, binding), "RESTORE_TOC_INVALID");
  refusal(() => planManagedRestore(toc().replace(/^;\tdepends on:.*\n/gm, ""), binding), "RESTORE_TOC_INVALID");
});
test("role SET/COPY/RLS/replica/custom owner/ACL and archive baseline premises are all required independently", () => {
  const plan = planManagedRestore(toc(), binding);
  for (const key of ["nativeSqlControlQualified", "sameActor", "allTargetsEmpty", "baselineMatchesArchive", "baselineOwnerAclMatchesArchive", "appOwnerAclCanBeRestored", "dataCopyCanUseOperator", "referencesCanBeVerified"]) refusal(() => authorizeManagedRestore(plan, { ...evidence(plan), [key]: false }), "RESTORE_MANAGED_PREREQUISITES_REQUIRED");
  refusal(() => authorizeManagedRestore(plan, { ...evidence(plan), replicaCanUseOperator: false }), "RESTORE_MANAGED_QUALIFICATION_INVALID");
  for (const key of Object.keys(roles())) for (const field of ["canSetRole", "canCreate"]) { const facts = evidence(plan); facts.customRoles[key][field] = false; refusal(() => authorizeManagedRestore(plan, facts), "RESTORE_MANAGED_PREREQUISITES_REQUIRED"); }
  const divergentPlan = planManagedRestore(toc(rows.map(row => row[0] === 12 ? [...row.slice(0, 4), "another_storage_owner", row[5]] : row)), binding);
  const divergentOwners = evidence(divergentPlan); divergentOwners.customRoles.bucketsPolicy.role = "another_storage_owner";
  const execution = claimManagedRestore(divergentPlan, authorizeManagedRestore(divergentPlan, divergentOwners));
  assert.equal(execution.segments[3].role, "supabase_storage_admin"); assert.equal(execution.segments[4].role, "another_storage_owner");
});
test("closed descriptor-only qualification rejects getters/extras/identity drift and one token cannot authorize another plan or retry", () => {
  const plan = planManagedRestore(toc(), binding); let getters = 0;
  const facts = evidence(plan); Object.defineProperty(facts, "sameActor", { enumerable: true, get() { getters++; return true; } });
  refusal(() => authorizeManagedRestore(plan, facts), "RESTORE_MANAGED_QUALIFICATION_INVALID"); assert.equal(getters, 0);
  refusal(() => authorizeManagedRestore(plan, { ...evidence(plan), secret: "PRIVATE_CANARY" }), "RESTORE_MANAGED_QUALIFICATION_INVALID");
  refusal(() => authorizeManagedRestore(plan, { ...evidence(plan), archiveAuthenticated: true }), "RESTORE_MANAGED_QUALIFICATION_INVALID");
  for (const key of ["archiveSha256", "databaseSha256", "tocSha256", "databaseBytes"]) refusal(() => authorizeManagedRestore(plan, { ...evidence(plan), [key]: key === "databaseBytes" ? database.length + 1 : "b".repeat(64) }), "RESTORE_MANAGED_BINDING_INVALID");
  const authorization = authorizeManagedRestore(plan, evidence(plan)), other = planManagedRestore(toc(), binding);
  refusal(() => claimManagedRestore(other, authorization), "RESTORE_MANAGED_AUTHORIZATION_REQUIRED");
  claimManagedRestore(plan, authorization);
  refusal(() => claimManagedRestore(plan, authorization), "RESTORE_MANAGED_AUTHORIZATION_REQUIRED");
});

test("exact current-actor delegation and independently qualified SET-owner modes can coexist without borrowing ownership", () => {
  const plan = planManagedRestore(toc(), binding), delegated = evidence(plan); delegated.customRoles = roles("currentActor");
  const direct = claimManagedRestore(plan, authorizeManagedRestore(plan, delegated));
  assert.deepEqual(direct.segments.map(segment => [segment.role, segment.custom]), [[null, false], [null, true], [null, true], [null, true], [null, true]]);
  const mixed = evidence(plan); mixed.customRoles.objectsPolicy = roles("currentActor").objectsPolicy;
  const execution = claimManagedRestore(plan, authorizeManagedRestore(plan, mixed));
  assert.deepEqual(execution.segments.slice(1).map(segment => segment.role), ["supabase_auth_admin", "supabase_auth_admin", null, "supabase_storage_admin"]);
  const wrongOwner = evidence(plan); wrongOwner.customRoles.bucketsPolicy.role = "some_other_owner";
  refusal(() => authorizeManagedRestore(plan, wrongOwner), "RESTORE_MANAGED_PREREQUISITES_REQUIRED");
});
test("delegation cannot cross actor, auth.users/objects/buckets or exact CREATE TRIGGER/CONSTRAINT TRIGGER/POLICY operations; counts supply no authority", () => {
  const plan = planManagedRestore(toc(), binding);
  for (const [target, borrowed] of [["identityTrigger", "objectsPolicy"], ["objectsPolicy", "bucketsPolicy"], ["bucketsPolicy", "objectsPolicy"], ["adminTrigger", "identityTrigger"]]) {
    const facts = evidence(plan); facts.customRoles = roles("currentActor"); facts.customRoles[target] = { ...facts.customRoles[borrowed] };
    refusal(() => authorizeManagedRestore(plan, facts), "RESTORE_MANAGED_PREREQUISITES_REQUIRED");
  }
  for (const mode of ["currentActor", "setRole"]) for (const [key, value] of [["actor", "another_operator"], ["schema", "public"], ["table", "users"], ["operation", "CREATE TRIGGER"], ["canCreate", false]]) {
    const facts = evidence(plan); facts.customRoles = roles(mode); facts.customRoles.objectsPolicy[key] = value;
    refusal(() => authorizeManagedRestore(plan, facts), "RESTORE_MANAGED_PREREQUISITES_REQUIRED");
  }
  const aggregate = evidence(plan); aggregate.customRoles = { qualifiedPolicies: 2, qualifiedTriggers: 2, tablesAvailable: 35 };
  refusal(() => authorizeManagedRestore(plan, aggregate), "RESTORE_MANAGED_QUALIFICATION_INVALID");
});
test("replica requires same-actor factual SET LOCAL/readback/ROLLBACK and new authority descriptors remain closed without getter reads", () => {
  const plan = planManagedRestore(toc(), binding);
  for (const [key, value] of [["actor", "another_operator"], ["setLocalObserved", false], ["readback", "origin"], ["rollbackObserved", false]]) {
    const facts = evidence(plan); facts.replicaCanUseOperator[key] = value;
    refusal(() => authorizeManagedRestore(plan, facts), "RESTORE_MANAGED_PREREQUISITES_REQUIRED");
  }
  for (const value of [true, false, { parameterAcl: true }, { ...replica(), parameterAcl: true }]) refusal(() => authorizeManagedRestore(plan, { ...evidence(plan), replicaCanUseOperator: value }), "RESTORE_MANAGED_QUALIFICATION_INVALID");
  let getters = 0;
  for (const field of ["mode", "actor", "canCreate"]) {
    const facts = evidence(plan); facts.customRoles = roles("currentActor");
    Object.defineProperty(facts.customRoles.objectsPolicy, field, { enumerable: true, get() { getters++; return true; } });
    refusal(() => authorizeManagedRestore(plan, facts), "RESTORE_MANAGED_QUALIFICATION_INVALID");
  }
  const facts = evidence(plan); Object.defineProperty(facts.replicaCanUseOperator, "readback", { enumerable: true, get() { getters++; return "replica"; } });
  refusal(() => authorizeManagedRestore(plan, facts), "RESTORE_MANAGED_QUALIFICATION_INVALID"); assert.equal(getters, 0);
  const excess = evidence(plan); excess.customRoles = roles("currentActor"); excess.customRoles.objectsPolicy.canSetRole = true;
  refusal(() => authorizeManagedRestore(plan, excess), "RESTORE_MANAGED_QUALIFICATION_INVALID");
  const unknown = evidence(plan); unknown.customRoles.objectsPolicy.mode = "anyOwner";
  refusal(() => authorizeManagedRestore(plan, unknown), "RESTORE_MANAGED_QUALIFICATION_INVALID");
});
