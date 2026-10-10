import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { DATABASE_TYPES_BASELINE, DATABASE_TYPES_MAX_BYTES, DATABASE_TYPES_PROJECT, compareDatabaseTypeSources, readDatabaseTypesFile, runDatabaseTypesCli } from "../../scripts/operations/check-database-types.mjs";

const canary = "PRIVATE_TYPES_CANARY_NEVER_PRINT";
const source = `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Database = {
 __InternalSupabase: { PostgrestVersion: "14.18" }
 public: {
  Tables: { records: {
   Row: { id: string; label: string | null }
   Insert: { id?: string; label?: string | null }
   Update: { id?: string; label?: string | null }
   Relationships: [{ foreignKeyName: "records_fk"; columns: ["id"]; isOneToOne: false; referencedRelation: "records"; referencedColumns: ["id"] }]
  } }
  Views: { labels: { Row: { label: string | null }; Relationships: [] } }
  Functions: { find_record: { Args: { p_id: string; p_limit?: number }; Returns: Json } }
  Enums: { status: "open" | "done" }
  CompositeTypes: { point: { x: number; y: number } }
 }
}
type Without = Omit<Database, "__InternalSupabase">
export type Rows<Name extends keyof Without["public"]["Tables"] = "records"> = Without["public"]["Tables"][Name] extends { Row: infer R } ? R : never
export const Constants = { public: { Enums: { status: ["open", "done"] } } } as const
`;
function closed(report) {
  assert.deepEqual(Object.keys(report).sort(), ["code", "freshness_verified", "offline", "ok", "operation", "provenance_verified", "scope", "summary"]);
  assert.equal(report.offline, true); assert.equal(report.provenance_verified, false); assert.equal(report.freshness_verified, false);
  assert.equal(JSON.stringify(report).includes(canary), false);
}
function difference(next, section, field = "changed") {
  const report = compareDatabaseTypeSources(source, next); closed(report);
  assert.equal(report.code, "SNAPSHOT_DIFFER"); assert.equal(report.ok, false);
  if (section) assert.equal(report.summary[section][field], 1);
  return report;
}
async function directory(t) {
  const prefix = join(tmpdir(), "second-brain-types-"); const root = await mkdtemp(prefix);
  t.after(async () => { assert.equal(resolve(root).startsWith(resolve(prefix)), true); await rm(root, { recursive: true, force: true }); });
  return root;
}
function args(path) { return ["check", "--snapshot", path, "--project-ref", DATABASE_TYPES_PROJECT, "--schema", "public"]; }

test("comparison ignores comments, formatting, CRLF, quoted names, member and union order", () => {
  const printed = ts.createPrinter({ newLine: ts.NewLineKind.CarriageReturnLineFeed }).printFile(ts.createSourceFile("types.ts", source, ts.ScriptTarget.Latest));
  const next = "\ufeff// " + canary + "\r\n" + printed.replace("id: string;\r\n                label: string | null;", '"label": null | string;\r\n                "id": string;').replace("string | number | boolean | null", "null | boolean | number | string");
  const report = compareDatabaseTypeSources(source, next); closed(report); assert.equal(report.code, "SNAPSHOT_MATCH"); assert.equal(report.summary.differences, 0);
  const reordered = source.replace("Row: { id: string; label: string | null }", 'Row: { "label": (null | string); "id": string }');
  assert.equal(compareDatabaseTypeSources(source, reordered).code, "SNAPSHOT_MATCH");
  assert.equal(compareDatabaseTypeSources(source, source.replace("string | number | boolean | null", "(string | (number | boolean)) | null")).code, "SNAPSHOT_MATCH");
});

test("columns retain type, optionality, readonly, nullability, insert and update contracts", () => {
  for (const [before, after] of [
    ["Row: { id: string;", "Row: { id: number;"], ["label: string | null", "label: string"],
    ["Row: { id: string;", "Row: { readonly id: string;"], ["Insert: { id?: string;", "Insert: { id: string;"],
    ["Update: { id?: string;", "Update: { id?: number;"], ["Row: { id: string;", "Row: { added: boolean; id: string;"],
  ]) difference(source.replace(before, after), "tables");
});

test("table additions/removals are distinct from same-name changes", () => {
  difference(source.replace("Tables: { records:", "Tables: { added: { Row: { id: string }; Insert: { id: string }; Update: { id?: string }; Relationships: [] }; records:"), "tables", "added");
  const next = source.replace(/Tables: \{ records: \{[\s\S]*?\n  \} \}/, "Tables: { [_ in never]: never }");
  difference(next, "tables", "removed");
});

test("RPC argument additions/removals, optionality and returns are checked", () => {
  for (const [before, after] of [
    ["p_id: string; p_limit?: number", "p_id: string; p_limit?: number; p_extra?: boolean"],
    ["p_id: string; p_limit?: number", "p_id: string"], ["p_limit?: number", "p_limit: number"],
    ["p_id: string", "p_id: number"], ["Returns: Json", "Returns: Json | null"], ["Returns: Json", "Returns: { id: string }[]"],
  ]) difference(source.replace(before, after), "rpcs");
  difference(source.replace("Functions: { find_record:", "Functions: { added: { Args: never; Returns: undefined }; find_record:"), "rpcs", "added");
  difference(source.replace(/Functions: \{ find_record:.*\n/, "Functions: { [_ in never]: never }\n"), "rpcs", "removed");
});

test("RPC overload branch order is preserved while parentheses/format and scalar unions normalize", () => {
  const first = '{ Args: { p_mode: "first" }; Returns: "FIRST" }', last = '{ Args: { p_mode: "last" }; Returns: "LAST" }';
  const withOverloads = order => source.replace(/Functions: \{ find_record:.*\n/, "Functions: { probe: " + order + " }\n");
  const original = withOverloads(first + " | " + last), swapped = withOverloads(last + " | " + first);
  // Control: the ordinary union normalization previously used for Functions loses this order.
  assert.equal(compareDatabaseTypeSources(source + "type OrdinaryUnion = " + first + " | " + last, source + "type OrdinaryUnion = " + last + " | " + first).code, "SNAPSHOT_MATCH");
  const report = compareDatabaseTypeSources(original, swapped); closed(report); assert.equal(report.code, "SNAPSHOT_DIFFER"); assert.equal(report.summary.rpcs.changed, 1);
  const formatted = withOverloads("(\n(" + first + ") | (" + last + ")\n)");
  assert.equal(compareDatabaseTypeSources(original, formatted).code, "SNAPSHOT_MATCH");
  const nested = withOverloads("(" + first + " | (" + last + " | { Args: never; Returns: Json }))"), flat = withOverloads(first + " | " + last + " | { Args: never; Returns: Json }");
  assert.equal(compareDatabaseTypeSources(nested, flat).code, "SNAPSHOT_MATCH");
  assert.equal(compareDatabaseTypeSources(original, original.replace('"open" | "done"', '"done" | "open"')).code, "SNAPSHOT_MATCH");
});

test("compiled trusted fixture proves the installed SDK LastOf fallback changes for reversed inline overloads", () => {
  const sdk = fileURLToPath(new URL("../../node_modules/@supabase/supabase-js/src/lib/rest/types/common/rpc.ts", import.meta.url)).replaceAll("\\", "/");
  const path = fileURLToPath(new URL("../../work/database-overload-proof.ts", import.meta.url));
  // Only this static test fixture is typechecked. Operator-provided snapshots remain parse-only.
  const fixture = `import type { GetRpcFunctionFilterBuilderByArgs } from ${JSON.stringify(sdk)};
type Original = { Tables: {}; Views: {}; Functions: { probe:
 { Args: { p_mode: "first" }; Returns: "FIRST" } | { Args: { p_mode: "last" }; Returns: "LAST" } } };
type Reversed = { Tables: {}; Views: {}; Functions: { probe:
 { Args: { p_mode: "last" }; Returns: "LAST" } | { Args: { p_mode: "first" }; Returns: "FIRST" } } };
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type FirstResult = GetRpcFunctionFilterBuilderByArgs<Original, "probe", never>["Result"];
type ReversedResult = GetRpcFunctionFilterBuilderByArgs<Reversed, "probe", never>["Result"];
type OriginalSelectsLast = Assert<Equal<FirstResult, "LAST">>;
type ReversedSelectsFirst = Assert<Equal<ReversedResult, "FIRST">>;
type ResultsDiffer = Assert<Equal<FirstResult, ReversedResult> extends false ? true : false>;
`;
  const options = { noEmit: true, strict: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowImportingTsExtensions: true };
  const host = ts.createCompilerHost(options), getSource = host.getSourceFile.bind(host), exists = host.fileExists.bind(host), read = host.readFile.bind(host);
  host.getSourceFile = (target, language, onError, recreate) => resolve(target) === resolve(path) ? ts.createSourceFile(path, fixture, language, true) : getSource(target, language, onError, recreate);
  host.fileExists = target => resolve(target) === resolve(path) || exists(target);
  host.readFile = target => resolve(target) === resolve(path) ? fixture : read(target);
  const program = ts.createProgram([path], options, host);
  assert.deepEqual(ts.getPreEmitDiagnostics(program).map(diagnostic => diagnostic.code), []); // Never print diagnostic/input content.
});

test("relationship shape and tuple order remain significant", () => {
  for (const [before, after] of [["isOneToOne: false", "isOneToOne: true"], ['columns: ["id"]', 'columns: ["label", "id"]'], ['referencedRelation: "records"', 'referencedRelation: "labels"'], ['referencedColumns: ["id"]', 'referencedColumns: ["label"]']]) difference(source.replace(before, after), "tables");
  const one = source.replace('columns: ["id"]', 'columns: ["id", "label"]');
  assert.equal(compareDatabaseTypeSources(one, one.replace('columns: ["id", "label"]', 'columns: ["label", "id"]')).code, "SNAPSHOT_DIFFER");
});

test("views, enums, composites, Json, helpers and literal Constants are compared", () => {
  difference(source.replace("Views: { labels: { Row: { label: string | null }", "Views: { labels: { Row: { label: number | null }"), "views");
  difference(source.replace('Enums: { status: "open" | "done" }', 'Enums: { status: "open" | "done" | "later" }'), "enums");
  difference(source.replace("point: { x: number; y: number }", "point: { x: number; y: string }"), "composites");
  assert.equal(difference(source.replace("string | number | boolean | null", "string | boolean | null")).summary.json_changed, true);
  assert.equal(difference(source.replace("? R : never", "? R : unknown"), "aliases").summary.aliases.changed, 1);
  assert.equal(difference(source.replace('status: ["open", "done"]', 'status: ["open", "done", "later"]')).summary.constants_changed, true);
  assert.equal(compareDatabaseTypeSources(source, source.replace('PostgrestVersion: "14.18"', 'PostgrestVersion: "14.99"')).code, "SNAPSHOT_MATCH");
});

test("closed input rejects executable statements, imports, references and impure Constants without executing", () => {
  for (const extra of [
    'import type { Foreign } from "' + canary + '";', 'export { Foreign } from "' + canary + '";',
    'export type Foreign = import("' + canary + '").Token;', 'export type Foreign = typeof globalThis;',
    'declare global { interface Window { unsafe: string } }', 'export interface Foreign { id: string }',
    'export function unsafe() { throw new Error("' + canary + '") }', 'throw new Error("' + canary + '");',
    'export const Unsafe = "' + canary + '";', 'export type Foreign = (() => string);',
  ]) { const report = compareDatabaseTypeSources(source, source + extra); closed(report); assert.equal(report.code, "UNSUPPORTED_INPUT"); }
  for (const next of [
    '/// <reference path="' + canary + '" />\n' + source,
    source.replace('status: ["open", "done"]', 'status: (() => { throw new Error("' + canary + '") })()'),
    source.replace('status: ["open", "done"]', 'status: [...external]'),
    source.replace('status: ["open", "done"]', 'get status() { return "' + canary + '" }'),
    source.replace('status: ["open", "done"]', '[external]: "' + canary + '"'),
  ]) { const report = compareDatabaseTypeSources(source, next); closed(report); assert.equal(report.code, "UNSUPPORTED_INPUT"); }
});

test("duplicate aliases, properties, Constants and generic bindings fail closed", () => {
  for (const next of [source + "export type Json = string;", source.replace("Row: { id: string;", "Row: { id: string; id: number;"), source.replace('status: ["open", "done"]', 'status: ["open", "done"], status: ["later"]'), source + "export type Duplicate<X, X> = X;"]) { const report = compareDatabaseTypeSources(source, next); closed(report); assert.equal(report.code, "UNSUPPORTED_INPUT"); }
});

test("public exports cannot be removed silently and helper exports are part of the contract", () => {
  for (const marker of ["export type Json", "export type Database", "export const Constants"]) assert.equal(compareDatabaseTypeSources(source, source.replace(marker, marker.slice(7))).code, "UNSUPPORTED_INPUT");
  difference(source.replace("export type Rows", "type Rows"), "aliases");
});

test("unsupported members on mapped types cannot be silently discarded", () => {
  const next = source + 'export type Extra = { [Key in "a"]: string; extra: number };';
  assert.equal(compareDatabaseTypeSources(source, next).code, "UNSUPPORTED_INPUT");
});

test("required public scope and official structural envelope refuse incomplete or foreign input", () => {
  for (const next of [source.replace("public: {", "foreign: {"), source.replace(" public: {", " foreign: {}; public: {")]) assert.equal(compareDatabaseTypeSources(source, next).code, "SCOPE_NOT_PUBLIC");
  for (const next of [source.replace("export type Json", "export type OtherJson"), source.replace("Returns: Json", "Other: Json"), source.replace("Relationships: []", "Other: []"), source.replace("p_id: string", "p_id: Foreign")]) assert.equal(compareDatabaseTypeSources(source, next).code, "UNSUPPORTED_INPUT");
  const report = compareDatabaseTypeSources(source, source.replace("id: string", "id: ???")); closed(report); assert.equal(report.code, "SYNTAX_INVALID");
});

test("byte, token and nesting budgets reject before unbounded AST parsing", () => {
  assert.equal(compareDatabaseTypeSources(source, " ".repeat(DATABASE_TYPES_MAX_BYTES + 1)).code, "SOURCE_LIMIT_EXCEEDED");
  assert.equal(compareDatabaseTypeSources(source, ";".repeat(50001)).code, "AST_LIMIT_EXCEEDED");
  assert.equal(compareDatabaseTypeSources(source, source + "type Deep = " + "(".repeat(101) + "string" + ")".repeat(101)).code, "AST_LIMIT_EXCEEDED");
});

test("nested canonical subtrees stay structural and normalization work has a cumulative budget", () => {
  const nestedAlias = source + "export type Nested = " + "{ x: ".repeat(28) + "string" + " }".repeat(28);
  assert.equal(compareDatabaseTypeSources(nestedAlias, nestedAlias).code, "SNAPSHOT_MATCH");
  const nestedConstants = source.replace('status: ["open", "done"]', "status: " + "{ x: ".repeat(40) + '"leaf"' + " }".repeat(40));
  assert.equal(compareDatabaseTypeSources(nestedConstants, nestedConstants).code, "SNAPSHOT_MATCH");
  const oversizedNormalization = source + "export type Nested = " + "{ x: ".repeat(27) + JSON.stringify("x".repeat(700000)) + " }".repeat(27);
  const report = compareDatabaseTypeSources(source, oversizedNormalization); closed(report); assert.equal(report.code, "AST_LIMIT_EXCEEDED");
});

test("real committed declarations are parsed and an 001–005 subset detects subsequent MVP contracts", async () => {
  const committed = await readFile(DATABASE_TYPES_BASELINE, "utf8"), file = ts.createSourceFile("types.ts", committed, ts.ScriptTarget.Latest);
  const oldTables = new Set(["capture_links", "captures", "categories", "domain_events", "profiles", "projects", "tasks", "user_entitlements", "user_moderation", "user_modules", "user_preferences", "user_roles"]);
  const oldFunctions = new Set(["activity_page", "bootstrap_master", "capture_task_commit", "capture_task_receipt", "capture_task_revision", "capture_task_snapshot", "complete_password_change", "consume_rate_limit", "my_access_state", "prune_operational_data", "update_identity"]);
  const database = file.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === "Database"), publicNode = database.type.members.find(node => node.name.getText(file) === "public");
  const sections = publicNode.type.members.map(node => {
    const allowed = node.name.getText(file) === "Tables" ? oldTables : node.name.getText(file) === "Functions" ? oldFunctions : null;
    if (!allowed) return node;
    const fields = node.type.members.filter(member => allowed.has(member.name.getText(file).replaceAll('"', "")));
    return ts.factory.updatePropertySignature(node, node.modifiers, node.name, node.questionToken, ts.factory.updateTypeLiteralNode(node.type, fields));
  });
  const nextPublic = ts.factory.updatePropertySignature(publicNode, publicNode.modifiers, publicNode.name, publicNode.questionToken, ts.factory.updateTypeLiteralNode(publicNode.type, sections));
  const oldDatabase = ts.factory.updateTypeAliasDeclaration(database, database.modifiers, database.name, database.typeParameters, ts.factory.updateTypeLiteralNode(database.type, database.type.members.map(node => node === publicNode ? nextPublic : node)));
  const oldFile = ts.factory.updateSourceFile(file, file.statements.map(node => node === database ? oldDatabase : node));
  const oldSnapshot = ts.createPrinter().printFile(oldFile), next = oldSnapshot.replace("Tables: {", "Tables: { fixture_post005: { Row: { id: string }; Insert: { id: string }; Update: { id?: string }; Relationships: [] };").replace("Functions: {", "Functions: { fixture_post005_rpc: { Args: { p_user: string; p_session: string }; Returns: Json };");
  assert.equal(compareDatabaseTypeSources(committed, committed).code, "SNAPSHOT_MATCH");
  const report = compareDatabaseTypeSources(oldSnapshot, next); closed(report); assert.equal(report.code, "SNAPSHOT_DIFFER"); assert.equal(report.summary.tables.baseline, 12); assert.equal(report.summary.tables.added, 1); assert.equal(report.summary.rpcs.added, 1);
  assert.equal(report.freshness_verified, false); // Synthetic additions are never called official/fresh evidence.
});

test("CLI help and all destination/argument guards precede file reads and do not echo input", async () => {
  const root = resolve(tmpdir(), "provided-types.ts"), reports = []; let reads = 0;
  const reader = () => { reads++; throw new Error(canary); };
  assert.equal(await runDatabaseTypesCli([], value => reports.push(value), { readFile: reader }), 0);
  assert.equal(await runDatabaseTypesCli(["--help"], value => reports.push(value), { readFile: reader }), 0);
  for (const argv of [["check", canary], args(root).map(value => value === DATABASE_TYPES_PROJECT ? canary : value), args(root).map(value => value === "public" ? "auth" : value), args("relative.ts"), args("\\\\foreign\\share\\secret.ts"), args(root + ":secret.ts"), args(resolve(tmpdir(), "NUL.ts")), args(DATABASE_TYPES_BASELINE)]) assert.equal(await runDatabaseTypesCli(argv, value => reports.push(value), { readFile: reader }), 1);
  assert.equal(reads, 0); assert.equal(JSON.stringify(reports).includes(canary), false); assert.equal(JSON.stringify(reports).includes(root), false);
});

test("CLI uses only fixed baseline and explicit snapshot, reports drift and closes filesystem failures", async () => {
  const path = resolve(tmpdir(), "provided-types.ts"), seen = [], reports = [];
  const reader = async target => { seen.push(target); return source; };
  assert.equal(await runDatabaseTypesCli(args(path), value => reports.push(value), { readFile: reader }), 0);
  assert.deepEqual(seen, [DATABASE_TYPES_BASELINE, path]); closed(reports[0]);
  assert.equal(await runDatabaseTypesCli(args(path), value => reports.push(value), { readFile: async target => target === path ? source.replace("p_id: string", "p_id: number") : source }), 1); closed(reports[1]); assert.equal(reports[1].code, "SNAPSHOT_DIFFER");
  assert.equal(await runDatabaseTypesCli(args(path), value => reports.push(value), { readFile: async () => { throw new Error(canary); } }), 1); closed(reports[2]); assert.equal(reports[2].code, "FILE_UNAVAILABLE");
});

test("regular local UTF-8 files are bounded, BOM accepted and invalid bytes refused", async t => {
  const root = await directory(t), path = join(root, "snapshot.ts");
  await writeFile(path, "\ufeff" + source); assert.equal(compareDatabaseTypeSources(source, await readDatabaseTypesFile(path)).code, "SNAPSHOT_MATCH");
  const padding = DATABASE_TYPES_MAX_BYTES - Buffer.byteLength(source); await writeFile(path, source + " ".repeat(padding)); assert.equal(Buffer.byteLength(await readDatabaseTypesFile(path)), DATABASE_TYPES_MAX_BYTES);
  await writeFile(path, Buffer.alloc(DATABASE_TYPES_MAX_BYTES + 1)); await assert.rejects(readDatabaseTypesFile(path), error => error.code === "SOURCE_LIMIT_EXCEEDED");
  await writeFile(path, Buffer.from([0xc3, 0x28])); await assert.rejects(readDatabaseTypesFile(path), error => error.code === "UTF8_INVALID");
  await assert.rejects(readDatabaseTypesFile(join(root, "missing.ts")), error => error.code === "FILE_UNAVAILABLE");
  const folder = join(root, "directory.ts"); await mkdir(folder); await assert.rejects(readDatabaseTypesFile(folder), error => error.code === "FILE_INVALID");
});

test("filesystem doubles prove file and ancestor symlinks/junctions are refused before open", async () => {
  const path = resolve(tmpdir(), "provided-types", "snapshot.ts");
  for (const link of [dirname(path), path]) {
    let opened = 0;
    await assert.rejects(readDatabaseTypesFile(path, { lstat: async target => ({ isDirectory: () => true, isFile: () => true, isSymbolicLink: () => target === link, size: 1 }), open: async () => { opened++; throw new Error(canary); } }), error => error.code === "FILE_INVALID");
    assert.equal(opened, 0);
  }
});

test("filesystem doubles refuse replaced/modified files and always close an acquired descriptor", async () => {
  const path = resolve(tmpdir(), "provided-types.ts"), metadata = { dev: 1, ino: 2, size: 1, mtimeMs: 10, isDirectory: () => true, isFile: () => true, isSymbolicLink: () => false };
  for (const mode of ["replaced", "changed", "failed"]) {
    let closed = 0, checks = 0, reads = 0;
    const handle = { stat: async () => { checks++; if (mode === "failed") throw new Error(canary); return { ...metadata, ino: mode === "replaced" ? 3 : 2, mtimeMs: mode === "changed" && checks > 1 ? 20 : 10 }; }, read: async bytes => { if (reads++) return { bytesRead: 0 }; bytes[0] = 32; return { bytesRead: 1 }; }, close: async () => { closed++; } };
    await assert.rejects(readDatabaseTypesFile(path, { lstat: async () => metadata, open: async () => handle }), error => error.code === (mode === "replaced" ? "FILE_INVALID" : mode === "changed" ? "FILE_CHANGED" : "FILE_UNAVAILABLE"));
    assert.equal(closed, 1); if (mode !== "changed") assert.equal(reads, 0);
  }
});
