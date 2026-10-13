import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { planManagedRestore, managedRestoreRequirements, authorizeManagedRestore, claimManagedRestore, compareManagedMigrationHistory } from "../../scripts/operations/restore-managed-plan.mjs";

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
const evidence = plan => ({ ...binding, tocSha256: managedRestoreRequirements(plan).tocSha256, archiveAuthenticated: true, nativeSqlControlQualified: true, actor: "postgres", sameActor: true, allTargetsEmpty: true, baselineMatchesArchive: true, baselineOwnerAclMatchesArchive: true, appOwnerAclCanBeRestored: true, dataCopyCanUseOperator: true, replicaCanUseOperator: replica(), referencesCanBeVerified: true, managedMigrationHistories: { archive: history(), target: history() }, customRoles: roles() });
const refusal = (fn, code) => assert.throws(fn, error => error.code === code);

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
test("actual verbose dependency syntax requires known distinct positive IDs and preserves delayed custom ordering", () => {
  for (const replacement of ["; depends on: 8", ";\tdepends on: 0", ";\tdepends on: 8 8", ";\tdepends on: 8x"]) refusal(() => planManagedRestore(toc().replace(";\tdepends on: 8", replacement), binding), "RESTORE_TOC_INVALID");
  refusal(() => planManagedRestore(toc().replace(";\tdepends on: 8\n", ";\tdepends on: 999\n"), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
  const dependent = rows.map(row => row[0] === 15 ? [...row.slice(0, 5), [4, 10, 25]] : row);
  refusal(() => planManagedRestore(toc(dependent), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
  const lateDependency = rows.map(row => row[0] === 25 ? [...row.slice(0, 5), [10, 13, 27]] : row);
  refusal(() => planManagedRestore(toc(lateDependency), binding), "RESTORE_TOC_DEPENDENCY_INVALID");
});
test("duplicate/truncated/unsafe IDs and headers refuse without treating visible counts as a catalog proof", () => {
  for (const text of [toc().replace("28;", "27;"), toc().replace("28;", "9007199254740992;"), toc().replace("28;", "2147483648;"), toc().replace("28; 0 0", "28; 4294967296 0"), toc().replace("Entries: 28", "Entries: 27"), toc().replace(";     Format: CUSTOM", ";     Format: CUSTOM\n;     Format: CUSTOM"), toc().replace("; Selected TOC Entries:\n", "")]) refusal(() => planManagedRestore(text, binding), "RESTORE_TOC_INVALID");
  refusal(() => planManagedRestore(toc().replace(/^;\tdepends on:.*\n/gm, ""), binding), "RESTORE_TOC_INVALID");
});
test("role SET/COPY/RLS/replica/custom owner/ACL and archive baseline premises are all required independently", () => {
  const plan = planManagedRestore(toc(), binding);
  for (const key of ["archiveAuthenticated", "nativeSqlControlQualified", "sameActor", "allTargetsEmpty", "baselineMatchesArchive", "baselineOwnerAclMatchesArchive", "appOwnerAclCanBeRestored", "dataCopyCanUseOperator", "referencesCanBeVerified"]) refusal(() => authorizeManagedRestore(plan, { ...evidence(plan), [key]: false }), "RESTORE_MANAGED_PREREQUISITES_REQUIRED");
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
