import { createHash } from "node:crypto";
import { types } from "node:util";
import { BackupError } from "./backup-format.mjs";
import { compareManagedMigrationHistory } from "./restore-managed-plan.mjs";

// Synchronous semantic comparison only. Binding fields are correlations, never
// native provenance, coverage, emptiness, actor privilege or mint authority.
const apply = Reflect.apply, uncurry = fn => (self, ...args) => apply(fn, self, args);
const ownDescriptor = Object.getOwnPropertyDescriptor, ownKeys = Reflect.ownKeys;
const isArray = Array.isArray, { isProxy, isSharedArrayBuffer } = types;
const freeze = Object.freeze, safeInteger = Number.isSafeInteger, hasOwn = Object.hasOwn;
const Bytes = Uint8Array, View = DataView, typed = Object.getPrototypeOf(Bytes.prototype);
const intrinsic = name => uncurry(ownDescriptor(typed, name).get);
const tagOf = intrinsic(Symbol.toStringTag), lengthOf = intrinsic("byteLength");
const bufferOf = intrinsic("buffer"), offsetOf = intrinsic("byteOffset");
const newHash = createHash, hashPrototype = Object.getPrototypeOf(createHash("sha256"));
const updateHash = uncurry(hashPrototype.update), finishHash = uncurry(hashPrototype.digest);
const charCode = uncurry(String.prototype.charCodeAt);
const ownErrors = new WeakSet(), ownsError = uncurry(WeakSet.prototype.has), addError = uncurry(WeakSet.prototype.add);

export const MANAGED_BASELINE_ERROR_CODES = freeze([
  "RESTORE_MANAGED_BASELINE_INPUT_INVALID", "RESTORE_MANAGED_BASELINE_LIMIT_EXCEEDED", "RESTORE_MANAGED_BASELINE_GRAPH_INVALID",
]);
export const MANAGED_BASELINE_REASONS = freeze([
  "identity_set_mismatch", "dependency_scope_unsupported", "dependency_vector_mismatch", "section_mismatch", "dumper_mismatch",
  "definition_mismatch", "drop_statement_mismatch", "copy_statement_mismatch", "owner_mismatch", "tablespace_mismatch",
  "table_access_method_mismatch", "relation_kind_mismatch", "with_oids_mismatch", "auth_history_mismatch", "storage_history_mismatch",
]);
export const MANAGED_BASELINE_LIMITS = freeze({ databaseBytes: 64 * 1024 * 1024, tocBytes: 32 * 1024 * 1024, fieldBytes: 4 * 1024 * 1024, records: 10000, dependencies: 100000, historyBytes: 4 * 1024 * 1024, historyRows: 10000 });
const fail = suffix => { const error = new BackupError("RESTORE_MANAGED_BASELINE_" + suffix); addError(ownErrors, error); throw error; };
const invalid = () => fail("INPUT_INVALID"), limit = () => fail("LIMIT_EXCEEDED"), graph = () => fail("GRAPH_INVALID");
const fields = ["ordinal", "dumpId", "hadDumper", "catalogClassOid", "catalogObjectOid", "kind", "tag", "namespace", "sectionCode", "definition", "dropStatement", "copyStatement", "tablespace", "tableAccessMethod", "relationKind", "owner", "withOids", "dependencies", "customDataState", "customDataOffset"];
const byteFields = ["tag", "namespace", "definition", "dropStatement", "copyStatement", "tablespace", "tableAccessMethod", "owner", "withOids"];
const kinds = new Set(["DATABASE", "DATABASE PROPERTIES", "ACL", "COMMENT", "CONSTRAINT", "DEFAULT", "DEFAULT ACL", "ENCODING", "FK CONSTRAINT", "FUNCTION", "INDEX", "POLICY", "ROW SECURITY", "SCHEMA", "SEARCHPATH", "SEQUENCE", "SEQUENCE OWNED BY", "SEQUENCE SET", "STDSTRINGS", "TABLE", "TABLE DATA", "TRIGGER", "TYPE", "VIEW"]);
const relationKinds = new Set([0, 73, 83, 99, 102, 105, 109, 112, 114, 116, 118]);
const semanticFields = [
  ["sectionCode", "section_mismatch"], ["hadDumper", "dumper_mismatch"], ["definition", "definition_mismatch"],
  ["dropStatement", "drop_statement_mismatch"], ["copyStatement", "copy_statement_mismatch"], ["owner", "owner_mismatch"],
  ["tablespace", "tablespace_mismatch"], ["tableAccessMethod", "table_access_method_mismatch"],
  ["relationKind", "relation_kind_mismatch"], ["withOids", "with_oids_mismatch"],
];

function record(value, keys) {
  if (isProxy(value) || value === null || typeof value !== "object" || isArray(value)) invalid();
  const names = ownKeys(value); if (names.length !== keys.length) invalid();
  for (const key of names) if (typeof key !== "string" || !keys.includes(key)) invalid();
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = ownDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !hasOwn(descriptor, "value")) invalid();
    result[key] = descriptor.value;
  }
  return result;
}
function array(value, maximum, consume) {
  if (isProxy(value) || !isArray(value)) invalid();
  const descriptor = ownDescriptor(value, "length"), length = descriptor?.value;
  if (!descriptor || !hasOwn(descriptor, "value") || !safeInteger(length) || length < 0) invalid();
  if (length > maximum) limit();
  // Length and its cumulative quota are checked before enumerating indices.
  consume(length);
  const names = ownKeys(value); if (names.length !== length + 1) invalid();
  const result = [];
  for (let index = 0; index < length; index++) {
    const item = ownDescriptor(value, String(index));
    if (!item || !item.enumerable || !hasOwn(item, "value")) invalid();
    result.push(item.value);
  }
  return result;
}
function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!safeInteger(value) || value < minimum || value > maximum) invalid();
}
function bytes(value, state) {
  if (value === null) return null;
  if (isProxy(value) || value === null || typeof value !== "object") invalid();
  let length, buffer, offset;
  try {
    if (tagOf(value) !== "Uint8Array") invalid();
    buffer = bufferOf(value); if (isSharedArrayBuffer(buffer)) invalid();
    new View(buffer, 0, 0); // A detached empty view must not become a valid empty string.
    length = lengthOf(value); offset = offsetOf(value);
  } catch { invalid(); }
  if (length > MANAGED_BASELINE_LIMITS.fieldBytes) limit();
  if (state.tocBytes + length > MANAGED_BASELINE_LIMITS.tocBytes) limit();
  state.tocBytes += length;
  // Dedicated *view*, not a copy: no caller methods, shadows, iteration or
  // species. The nonshared backing store stays borrowed only for this call.
  return new Bytes(buffer, offset, length);
}
function byteEqual(left, right) {
  if (left === null || right === null) return left === right;
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index++) if (left[index] !== right[index]) return false;
  return true;
}
function ascii(bytes, text) {
  if (bytes === null || bytes.byteLength !== text.length) return false;
  for (let index = 0; index < text.length; index++) if (bytes[index] !== charCode(text, index)) return false;
  return true;
}
function stringBytes(value, state, nonempty = false, noNul = false) {
  if (typeof value !== "string" || nonempty && value.length === 0) invalid();
  if (value.length > MANAGED_BASELINE_LIMITS.historyBytes - state.historyBytes) limit();
  let length = 0;
  for (let index = 0; index < value.length; index++) {
    const code = charCode(value, index);
    if (noNul && code === 0) invalid();
    if (code < 0x80) length++;
    else if (code < 0x800) length += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = charCode(value, ++index); if (!(next >= 0xdc00 && next <= 0xdfff)) invalid(); length += 4;
    } else if (code >= 0xdc00 && code <= 0xdfff) invalid();
    else length += 3;
    if (length > MANAGED_BASELINE_LIMITS.historyBytes - state.historyBytes) limit();
  }
  state.historyBytes += length;
  return value;
}
function histories(value, state) {
  const input = record(value, ["auth", "storage"]), consume = length => { if (state.historyRows + length > MANAGED_BASELINE_LIMITS.historyRows) limit(); state.historyRows += length; };
  const auth = array(input.auth, MANAGED_BASELINE_LIMITS.historyRows, consume), storage = array(input.storage, MANAGED_BASELINE_LIMITS.historyRows, consume);
  const versions = new Set(), ids = new Set(), names = new Set(), result = { auth: [], storage: [] };
  for (const value of auth) {
    const row = record(value, ["version"]); stringBytes(row.version, state, true, true);
    if (versions.has(row.version)) invalid(); versions.add(row.version); result.auth.push({ version: row.version });
  }
  for (const value of storage) {
    const row = record(value, ["id", "name", "hash", "executed_at"]); integer(row.id);
    stringBytes(row.name, state, true, true); stringBytes(row.hash, state);
    if (!/^[a-fA-F0-9]{40}$/.test(row.hash) || ids.has(row.id) || names.has(row.name)) invalid();
    if (row.executed_at !== null) stringBytes(row.executed_at, state);
    ids.add(row.id); names.add(row.name); result.storage.push({ id: row.id, name: row.name, hash: row.hash, executed_at: row.executed_at });
  }
  return result;
}
function binding(value, side) {
  const keys = side === "archive" ? ["side", "archiveSha256", "databaseSha256", "databaseBytes", "tocSha256"] : ["side", "projectRef", "databaseName", "nativeDumpSha256", "nativeDumpBytes", "tocSha256"];
  const input = record(value, keys); if (input.side !== side) invalid();
  const byteLength = side === "archive" ? input.databaseBytes : input.nativeDumpBytes; integer(byteLength, 1);
  if (byteLength > MANAGED_BASELINE_LIMITS.databaseBytes) limit();
  for (const key of side === "archive" ? ["archiveSha256", "databaseSha256", "tocSha256"] : ["nativeDumpSha256", "tocSha256"]) if (typeof input[key] !== "string" || !/^[a-f0-9]{64}$/.test(input[key])) invalid();
  if (side === "target" && (typeof input.projectRef !== "string" || !/^[a-z0-9]{20}$/.test(input.projectRef) || input.databaseName !== "postgres")) invalid();
}
function identityEqual(left, right) {
  return left.kind === right.kind && byteEqual(left.tag, right.tag) && byteEqual(left.namespace, right.namespace) && (left.kind !== "DEFAULT ACL" || byteEqual(left.owner, right.owner));
}
function identityKey(row) {
  const hash = newHash("sha256"); updateHash(hash, row.kind + ":");
  const parts = [row.tag, row.namespace]; if (row.kind === "DEFAULT ACL") parts.push(row.owner);
  for (const part of parts) {
    updateHash(hash, part === null ? "N;" : "B" + part.byteLength + ":");
    if (part !== null) updateHash(hash, part);
  }
  return finishHash(hash, "hex");
}
function input(value, side) {
  const outer = record(value, ["version", "binding", "preserved", "histories"]); if (outer.version !== 1) invalid(); binding(outer.binding, side);
  const state = { tocBytes: 0, dependencies: 0, historyBytes: 0, historyRows: 0 };
  const rows = array(outer.preserved, MANAGED_BASELINE_LIMITS.records, () => {}), result = [], byId = new Map();
  for (const value of rows) {
    const row = record(value, fields);
    integer(row.ordinal); integer(row.dumpId, 1); integer(row.catalogClassOid, 0, 4294967295); integer(row.catalogObjectOid, 0, 4294967295);
    if (typeof row.hadDumper !== "boolean" || !kinds.has(row.kind) || ![1, 2, 3, 4].includes(row.sectionCode) || !relationKinds.has(row.relationKind) || ![1, 2, 3].includes(row.customDataState) || typeof row.customDataOffset !== "bigint" || row.customDataOffset < 0n || row.customDataOffset > 18446744073709551615n) invalid();
    if (byId.has(row.dumpId)) graph();
    for (const key of byteFields) row[key] = bytes(row[key], state);
    row.dependencies = array(row.dependencies, MANAGED_BASELINE_LIMITS.dependencies, length => { if (state.dependencies + length > MANAGED_BASELINE_LIMITS.dependencies) limit(); state.dependencies += length; });
    for (const dependency of row.dependencies) { if (!safeInteger(dependency)) invalid(); if (dependency < 1 || dependency === row.dumpId) graph(); }
    if (row.kind === "TABLE DATA" && !(ascii(row.namespace, "auth") && ascii(row.tag, "schema_migrations") || ascii(row.namespace, "storage") && ascii(row.tag, "migrations"))) invalid();
    byId.set(row.dumpId, row); result.push(row);
  }
  const history = histories(outer.histories, state), buckets = new Map();
  for (const row of result) {
    const key = identityKey(row), bucket = buckets.get(key) ?? [];
    // Hash is only an acceleration bucket; original full identity bytes decide.
    for (const previous of bucket) if (identityEqual(previous, row)) graph();
    bucket.push(row); buckets.set(key, bucket);
  }
  return { rows: result, byId, buckets, history };
}

/** Full-field byte comparison of the two independently validated inputs. Does
 * not retain a byte view, consume a capability, renew a deadline or authorize
 * any native action. Root must prove complete coverage/provenance separately. */
export function compareManagedBaseline(archive, target) {
  try {
    const left = input(archive, "archive"), right = input(target, "target"), reasons = new Set(), pairs = [], mapping = new Map();
    if (left.rows.length !== right.rows.length) reasons.add("identity_set_mismatch");
    for (const row of left.rows) {
      const bucket = right.buckets.get(identityKey(row)) ?? []; let partner = null;
      for (const candidate of bucket) if (identityEqual(row, candidate)) { partner = candidate; break; }
      if (!partner) reasons.add("identity_set_mismatch");
      else { pairs.push([row, partner]); mapping.set(row.dumpId, partner.dumpId); }
    }
    for (const side of [left, right]) for (const row of side.rows) for (const id of row.dependencies) if (!side.byId.has(id)) reasons.add("dependency_scope_unsupported");
    for (const [source, destination] of pairs) {
      if (!byteEqual(source.namespace, destination.namespace)) reasons.add("identity_set_mismatch");
      for (const [field, reason] of semanticFields) {
        if (byteFields.includes(field) ? !byteEqual(source[field], destination[field]) : source[field] !== destination[field]) reasons.add(reason);
      }
      if (source.dependencies.length !== destination.dependencies.length) reasons.add("dependency_vector_mismatch");
      for (let index = 0; index < Math.min(source.dependencies.length, destination.dependencies.length); index++) {
        const origin = source.dependencies[index], targetId = destination.dependencies[index];
        if (left.byId.has(origin) && right.byId.has(targetId) && mapping.get(origin) !== targetId) reasons.add("dependency_vector_mismatch");
      }
    }
    if (!compareManagedMigrationHistory({ auth: left.history.auth, storage: [] }, { auth: right.history.auth, storage: [] })) reasons.add("auth_history_mismatch");
    if (!compareManagedMigrationHistory({ auth: [], storage: left.history.storage }, { auth: [], storage: right.history.storage })) reasons.add("storage_history_mismatch");
    const ordered = freeze(MANAGED_BASELINE_REASONS.filter(reason => reasons.has(reason)));
    return freeze({ version: 1, matches: ordered.length === 0, reasons: ordered });
  } catch (error) {
    if (ownsError(ownErrors, error)) throw error;
    // Only our own three literal refusals escape; never provider/input errors.
    invalid();
  }
}
