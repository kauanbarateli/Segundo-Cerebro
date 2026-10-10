#!/usr/bin/env node
import { constants as fsFlags } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, isAbsolute, parse, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export const DATABASE_TYPES_PROJECT = "rishenjoikgmfubmnfiu";
export const DATABASE_TYPES_BASELINE = fileURLToPath(new URL("../../src/lib/supabase/database.generated.ts", import.meta.url));
export const DATABASE_TYPES_MAX_BYTES = 2 * 1024 * 1024;
const MAX_NODES = 50000, MAX_DEPTH = 100, MAX_NORMALIZATION_BYTES = 16 * 1024 * 1024;
const SECTIONS = ["Tables", "Views", "Functions", "Enums", "CompositeTypes"];
const UTILITIES = new Set(["Array", "ReadonlyArray", "Omit", "Pick", "Extract", "Exclude", "Record", "Partial", "Required", "Readonly", "NonNullable"]);
const KEYWORDS = new Set([ts.SyntaxKind.StringKeyword, ts.SyntaxKind.NumberKeyword, ts.SyntaxKind.BooleanKeyword, ts.SyntaxKind.AnyKeyword, ts.SyntaxKind.UnknownKeyword, ts.SyntaxKind.NeverKeyword, ts.SyntaxKind.ObjectKeyword, ts.SyntaxKind.VoidKeyword, ts.SyntaxKind.UndefinedKeyword, ts.SyntaxKind.BigIntKeyword]);
class ComparisonError extends Error { constructor(code) { super(code); this.code = code; } }
function fail(code) { throw new ComparisonError(code); }
function closed(code, summary = null) { return { ok: code === "SNAPSHOT_MATCH", operation: "database_types_compare", code, offline: true, scope: "public", provenance_verified: false, freshness_verified: false, summary }; }
function name(node) { if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text; return fail("UNSUPPORTED_INPUT"); }
function exportedOnly(node) { if (node.modifiers?.some(modifier => modifier.kind !== ts.SyntaxKind.ExportKeyword)) fail("UNSUPPORTED_INPUT"); }
function exported(node) { return !!node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword); }
function properties(node) {
  if (!ts.isTypeLiteralNode(node)) fail("UNSUPPORTED_INPUT");
  const values = new Map();
  for (const member of node.members) {
    if (!ts.isPropertySignature(member) || !member.type || member.questionToken || member.modifiers?.length) fail("UNSUPPORTED_INPUT");
    const key = name(member.name); if (values.has(key)) fail("UNSUPPORTED_INPUT"); values.set(key, member.type);
  }
  return values;
}
function section(node) {
  if (ts.isMappedTypeNode(node) && node.typeParameter.constraint?.kind === ts.SyntaxKind.NeverKeyword && node.type?.kind === ts.SyntaxKind.NeverKeyword && !node.nameType && !node.questionToken && !node.readonlyToken && !node.members?.length && !node.typeParameter.default) return new Map();
  return properties(node);
}
function boundedTokens(source) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source, () => fail("SYNTAX_INVALID"));
  let tokens = 0, depth = 0;
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (++tokens > MAX_NODES) fail("AST_LIMIT_EXCEEDED");
    if ([ts.SyntaxKind.OpenBraceToken, ts.SyntaxKind.OpenBracketToken, ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.LessThanToken].includes(token)) depth++;
    if ([ts.SyntaxKind.CloseBraceToken, ts.SyntaxKind.CloseBracketToken, ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.GreaterThanToken].includes(token)) depth = Math.max(0, depth - 1);
    if (token === ts.SyntaxKind.GreaterThanGreaterThanToken) depth = Math.max(0, depth - 2);
    if (token === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken) depth = Math.max(0, depth - 3);
    if (depth > MAX_DEPTH) fail("AST_LIMIT_EXCEEDED");
  }
}
function contractShape(key, type) {
  if (key === "Tables" || key === "Views") {
    const fields = properties(type), required = key === "Tables" ? ["Row", "Insert", "Update", "Relationships"] : ["Row", "Relationships"];
    if (required.some(field => !fields.has(field)) || [...fields.keys()].some(field => !["Row", "Insert", "Update", "Relationships"].includes(field)) || ["Row", "Insert", "Update"].some(field => fields.has(field) && !ts.isTypeLiteralNode(fields.get(field))) || !ts.isTupleTypeNode(fields.get("Relationships"))) fail("UNSUPPORTED_INPUT");
  }
  if (key === "Functions") {
    for (const branch of ts.isUnionTypeNode(type) ? type.types : [type]) {
      const fields = properties(branch);
      if (!fields.has("Args") || !fields.has("Returns") || [...fields.keys()].some(field => !["Args", "Returns", "SetofOptions"].includes(field))) fail("UNSUPPORTED_INPUT");
    }
  }
}

/** Parse only. No compiler host, imports, transpilation or execution of input. */
function inspect(source) {
  if (typeof source !== "string" || Buffer.byteLength(source, "utf8") > DATABASE_TYPES_MAX_BYTES) fail("SOURCE_LIMIT_EXCEEDED");
  boundedTokens(source);
  let file;
  try { file = ts.createSourceFile("snapshot.ts", source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS); } catch { return fail("SYNTAX_INVALID"); }
  if (file.parseDiagnostics.length) fail("SYNTAX_INVALID");
  if (file.referencedFiles.length || file.typeReferenceDirectives.length || file.libReferenceDirectives.length || file.statements.length > 32) fail("UNSUPPORTED_INPUT");
  const aliases = new Map(); let constants = null;
  for (const statement of file.statements) {
    exportedOnly(statement);
    if (ts.isTypeAliasDeclaration(statement)) {
      const key = name(statement.name); if (aliases.has(key) || key === "Constants") fail("UNSUPPORTED_INPUT"); aliases.set(key, statement);
    } else if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const && statement.declarationList.declarations.length === 1) {
      const declaration = statement.declarationList.declarations[0];
      if (!exported(statement) || constants || name(declaration.name) !== "Constants" || declaration.type || !declaration.initializer || !ts.isAsExpression(declaration.initializer) || !ts.isTypeReferenceNode(declaration.initializer.type) || name(declaration.initializer.type.typeName) !== "const" || declaration.initializer.type.typeArguments?.length) fail("UNSUPPORTED_INPUT");
      constants = declaration.initializer.expression;
    } else fail("UNSUPPORTED_INPUT");
  }
  if (!aliases.has("Database") || !aliases.has("Json") || !exported(aliases.get("Database")) || !exported(aliases.get("Json")) || aliases.get("Database").typeParameters?.length || aliases.get("Json").typeParameters?.length) fail("UNSUPPORTED_INPUT");
  const root = properties(aliases.get("Database").type);
  if (!root.has("public") || [...root.keys()].some(key => !["public", "__InternalSupabase"].includes(key))) fail("SCOPE_NOT_PUBLIC");
  const schema = properties(root.get("public"));
  if (schema.size !== SECTIONS.length || SECTIONS.some(key => !schema.has(key))) fail("UNSUPPORTED_INPUT");
  let visited = 0, normalizedBytes = 0;
  function visit(depth) { if (++visited > MAX_NODES || depth > MAX_DEPTH) fail("AST_LIMIT_EXCEEDED"); }
  function encode(value) {
    const encoded = JSON.stringify(value); normalizedBytes += Buffer.byteLength(encoded, "utf8");
    if (normalizedBytes > MAX_NORMALIZATION_BYTES) fail("AST_LIMIT_EXCEEDED");
    return encoded;
  }
  function ordered(values, unique = false) {
    const entries = values.map(value => [encode(value), value]);
    entries.sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
    return entries.filter((entry, index) => !unique || !index || entry[0] !== entries[index - 1][0]).map(entry => entry[1]);
  }
  function parameter(node, allowed, depth) {
    visit(depth);
    if (node.modifiers?.length) fail("UNSUPPORTED_INPUT");
    return [name(node.name), node.constraint ? canonical(node.constraint, allowed, depth + 1) : null, node.default ? canonical(node.default, allowed, depth + 1) : null];
  }
  function literal(node, depth) {
    visit(depth);
    if (ts.isStringLiteral(node)) return ["string", node.text];
    if (ts.isNumericLiteral(node)) return ["number", node.text];
    if ([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return ["literal", node.kind];
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return ["number", "-" + node.operand.text];
    return fail("UNSUPPORTED_INPUT");
  }
  function canonical(node, allowed, depth = 0) {
    visit(depth);
    if (KEYWORDS.has(node.kind)) return ["keyword", node.kind];
    if (ts.isParenthesizedTypeNode(node)) return canonical(node.type, allowed, depth + 1);
    if (ts.isLiteralTypeNode(node)) return literal(node.literal, depth + 1);
    if (ts.isTypeReferenceNode(node)) {
      if (!ts.isIdentifier(node.typeName) || !allowed.has(node.typeName.text)) fail("UNSUPPORTED_INPUT");
      return ["reference", node.typeName.text, (node.typeArguments ?? []).map(type => canonical(type, allowed, depth + 1))];
    }
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      const kind = ts.isUnionTypeNode(node) ? "union" : "intersection", members = node.types.map(type => canonical(type, allowed, depth + 1));
      return [kind, ordered(members.flatMap(member => member[0] === kind ? member[1] : [member]), true)];
    }
    if (ts.isArrayTypeNode(node)) return ["array", canonical(node.elementType, allowed, depth + 1)];
    if (ts.isTupleTypeNode(node)) return ["tuple", node.elements.map(element => canonical(element, allowed, depth + 1))];
    if (ts.isOptionalTypeNode(node) || ts.isRestTypeNode(node)) return [ts.isOptionalTypeNode(node) ? "optional" : "rest", canonical(node.type, allowed, depth + 1)];
    if (ts.isNamedTupleMember(node)) return ["tuple_member", !!node.questionToken, !!node.dotDotDotToken, canonical(node.type, allowed, depth + 1)];
    if (ts.isTypeOperatorNode(node)) return ["operator", node.operator, canonical(node.type, allowed, depth + 1)];
    if (ts.isIndexedAccessTypeNode(node)) return ["indexed", canonical(node.objectType, allowed, depth + 1), canonical(node.indexType, allowed, depth + 1)];
    if (ts.isConditionalTypeNode(node)) return ["conditional", ...[node.checkType, node.extendsType, node.trueType, node.falseType].map(type => canonical(type, allowed, depth + 1))];
    if (ts.isInferTypeNode(node)) return ["infer", parameter(node.typeParameter, allowed, depth + 1)];
    if (ts.isMappedTypeNode(node)) {
      if (node.members?.length || !node.typeParameter.constraint || node.typeParameter.default || !node.type) fail("UNSUPPORTED_INPUT");
      return ["mapped", node.readonlyToken?.kind ?? null, node.questionToken?.kind ?? null, parameter(node.typeParameter, allowed, depth + 1), node.nameType ? canonical(node.nameType, allowed, depth + 1) : null, canonical(node.type, allowed, depth + 1)];
    }
    if (ts.isTypeLiteralNode(node)) {
      const keys = new Set(), members = [];
      for (const member of node.members) {
        visit(depth + 1);
        if (ts.isPropertySignature(member) && member.type && !member.initializer && !member.modifiers?.some(modifier => modifier.kind !== ts.SyntaxKind.ReadonlyKeyword)) {
          const key = name(member.name); if (keys.has(key)) fail("UNSUPPORTED_INPUT"); keys.add(key);
          members.push(["property", key, !!member.questionToken, !!member.modifiers?.length, canonical(member.type, allowed, depth + 1)]);
        } else if (ts.isIndexSignatureDeclaration(member) && member.parameters.length === 1 && member.type && !member.modifiers?.some(modifier => modifier.kind !== ts.SyntaxKind.ReadonlyKeyword)) {
          const input = member.parameters[0]; if (!ts.isIdentifier(input.name) || !input.type || input.initializer || input.questionToken || input.dotDotDotToken || input.modifiers?.length) fail("UNSUPPORTED_INPUT");
          members.push(["index", !!member.modifiers?.length, canonical(input.type, allowed, depth + 1), canonical(member.type, allowed, depth + 1)]);
        } else fail("UNSUPPORTED_INPUT");
      }
      return ["object", ordered(members)];
    }
    return fail("UNSUPPORTED_INPUT");
  }
  function constant(node, depth = 0) {
    visit(depth);
    if (ts.isArrayLiteralExpression(node)) return ["array", node.elements.map(element => constant(element, depth + 1))];
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set(), entries = [];
      for (const member of node.properties) {
        if (!ts.isPropertyAssignment(member) || member.modifiers?.length) fail("UNSUPPORTED_INPUT");
        const key = name(member.name); if (keys.has(key)) fail("UNSUPPORTED_INPUT"); keys.add(key); entries.push([key, constant(member.initializer, depth + 1)]);
      }
      return ["object", ordered(entries)];
    }
    return literal(node, depth + 1);
  }
  const normalizedAliases = new Map();
  for (const [key, alias] of aliases) {
    const allowed = new Set([...aliases.keys(), ...UTILITIES]);
    function bindings(node, depth = 0) { visit(depth); if (ts.isTypeParameterDeclaration(node)) allowed.add(name(node.name)); ts.forEachChild(node, child => bindings(child, depth + 1)); }
    bindings(alias);
    const params = alias.typeParameters ?? [];
    if (params.length > 16 || new Set(params.map(param => name(param.name))).size !== params.length) fail("UNSUPPORTED_INPUT");
    normalizedAliases.set(key, encode([exported(alias), params.map(param => parameter(param, allowed, 0)), canonical(alias.type, allowed)]));
  }
  const allowed = new Set([...aliases.keys(), ...UTILITIES]), maps = new Map();
  for (const key of SECTIONS) {
    const members = section(schema.get(key)), normalized = new Map();
    for (const [memberName, type] of members) { contractShape(key, type); normalized.set(memberName, encode(canonical(type, allowed))); }
    maps.set(key, normalized);
  }
  const constantsValue = constants ? encode(constant(constants)) : null;
  normalizedAliases.delete("Database");
  const json = normalizedAliases.get("Json"); normalizedAliases.delete("Json");
  return { maps, aliases: normalizedAliases, json, constants: constantsValue };
}
function changes(before, after) {
  return { added: [...after.keys()].filter(key => !before.has(key)).length, removed: [...before.keys()].filter(key => !after.has(key)).length, changed: [...before.keys()].filter(key => after.has(key) && before.get(key) !== after.get(key)).length };
}
export function compareDatabaseTypeSources(baseline, snapshot) {
  try {
    const before = inspect(baseline), after = inspect(snapshot), summary = {};
    for (const [key, label] of [["Tables", "tables"], ["Views", "views"], ["Functions", "rpcs"], ["Enums", "enums"], ["CompositeTypes", "composites"]]) {
      const oldValues = before.maps.get(key), newValues = after.maps.get(key);
      summary[label] = { baseline: oldValues.size, snapshot: newValues.size, ...changes(oldValues, newValues) };
    }
    summary.aliases = changes(before.aliases, after.aliases); summary.json_changed = before.json !== after.json; summary.constants_changed = before.constants !== after.constants;
    summary.differences = Object.values(summary).reduce((sum, value) => sum + (typeof value === "boolean" ? Number(value) : value.added + value.removed + value.changed), 0);
    return closed(summary.differences ? "SNAPSHOT_DIFFER" : "SNAPSHOT_MATCH", summary);
  } catch (error) { return closed(error instanceof ComparisonError ? error.code : "INPUT_INVALID"); }
}

/** Bounded regular UTF-8 file; never search, import or write the snapshot. */
export async function readDatabaseTypesFile(path, dependencies = {}) {
  let handle;
  try {
    if (!localPath(path)) fail("SNAPSHOT_PATH_INVALID");
    const statFile = dependencies.lstat ?? lstat, openFile = dependencies.open ?? open;
    const parents = []; let parent = dirname(path);
    while (parent !== parse(parent).root) { parents.unshift(parent); parent = dirname(parent); }
    for (const directory of parents) { const info = await statFile(directory); if (!info.isDirectory() || info.isSymbolicLink()) fail("FILE_INVALID"); }
    const info = await statFile(path); if (!info.isFile() || info.isSymbolicLink()) fail("FILE_INVALID");
    if (info.size > DATABASE_TYPES_MAX_BYTES) fail("SOURCE_LIMIT_EXCEEDED");
    handle = await openFile(path, fsFlags.O_RDONLY | (fsFlags.O_NOFOLLOW ?? 0)); const before = await handle.stat();
    if (!before.isFile() || before.dev !== info.dev || before.ino !== info.ino) fail("FILE_INVALID");
    const bytes = Buffer.alloc(DATABASE_TYPES_MAX_BYTES + 1); let length = 0;
    while (length < bytes.length) { const read = await handle.read(bytes, length, bytes.length - length, length); if (!read.bytesRead) break; length += read.bytesRead; }
    if (length > DATABASE_TYPES_MAX_BYTES) fail("SOURCE_LIMIT_EXCEEDED");
    const after = await handle.stat(); if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || length !== after.size) fail("FILE_CHANGED");
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)); } catch { return fail("UTF8_INVALID"); }
  } catch (error) { if (error instanceof ComparisonError) throw error; return fail("FILE_UNAVAILABLE"); }
  finally { try { await handle?.close(); } catch { /* Never expose filesystem diagnostics. */ } }
}
function localPath(path) {
  return typeof path === "string" && isAbsolute(path) && path.endsWith(".ts") && !/^(?:\\\\|\/\/)/.test(path) && !/[\u0000-\u001f\u007f]/.test(path) && !path.slice(/^[A-Za-z]:/.test(path) ? 2 : 0).includes(":") && !path.split(/[\\/]/).some(part => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) && (process.platform !== "win32" || /^[A-Za-z]:[\\/]/.test(path));
}
export async function runDatabaseTypesCli(argv, output, dependencies = {}) {
  const emit = output ?? (value => process.stdout.write(JSON.stringify(value) + "\n"));
  if (argv.length === 0 || (argv.length === 1 && argv[0] === "--help")) { emit({ tool: "offline-database-types-comparator", command: "check --snapshot <absolute.ts> --project-ref " + DATABASE_TYPES_PROJECT + " --schema public", network: false, imports_input: false, proves_origin_or_freshness: false }); return 0; }
  try {
    if (argv.length !== 7 || argv[0] !== "check") fail("INVALID_ARGUMENTS");
    const values = new Map();
    for (let index = 1; index < argv.length; index += 2) { if (!["--snapshot", "--project-ref", "--schema"].includes(argv[index]) || values.has(argv[index])) fail("INVALID_ARGUMENTS"); values.set(argv[index], argv[index + 1]); }
    if (values.get("--project-ref") !== DATABASE_TYPES_PROJECT || values.get("--schema") !== "public") fail("DESTINATION_NOT_PERSONAL_PUBLIC");
    const snapshot = values.get("--snapshot");
    if (!localPath(snapshot)) fail("SNAPSHOT_PATH_INVALID");
    if (resolve(snapshot).toLowerCase() === resolve(DATABASE_TYPES_BASELINE).toLowerCase()) fail("BASELINE_IS_NOT_A_FRESH_SNAPSHOT");
    const read = dependencies.readFile ?? readDatabaseTypesFile;
    const baseline = await read(DATABASE_TYPES_BASELINE), fresh = await read(snapshot);
    const report = compareDatabaseTypeSources(baseline, fresh); emit(report); return report.ok ? 0 : 1;
  } catch (error) { emit(closed(error instanceof ComparisonError ? error.code : "FILE_UNAVAILABLE")); return 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runDatabaseTypesCli(process.argv.slice(2));
