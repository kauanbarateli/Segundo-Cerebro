import { createHash } from "node:crypto";
import { types } from "node:util";
import { BackupError } from "./backup-format.mjs";
import { managedRestoreRequirements, managedTargetBaselineRequirements, managedTargetInspectionRequirements } from "./restore-managed-plan.mjs";
import { observeCustomArchiveHeader } from "./restore-custom-header.mjs";

// PostgreSQL 18.4 / REL_18_4, public source bytes qualified on 2026-10-16:
// src/bin/pg_dump/pg_backup_archiver.c, ReadHead/ReadInt/ReadStr/ReadToc/WriteToc
// F8C83F07D574428B7A064B9FBC509A1FE3B3D10E962EF7B07B462DA35664677F
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup_archiver.c
// src/bin/pg_dump/pg_backup_custom.c, _ReadExtraToc/_WriteExtraToc
// CAEE43B923FB541C57D57389B984D8655B70995B9509BC1BED02ACDB96A51CD8
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup_custom.c
// src/bin/pg_dump/pg_backup_archiver.h, version and offset states
// 253739F017924A76423612EE6CC5DDC2AD8C9F1D065CE5C26B3FD587018185AE
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup_archiver.h
// src/bin/pg_dump/pg_backup.h, archive format and sections
// F3D383BDA0FF07E42A6CB4B0F83391C2DAAF723F14E3C78B60BA44F262233D29
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup.h
// src/include/common/compression.h, on-disk compression enum
// 3CB358926020425E0680D0D70E74D209099C69F56A5ADEFA2AF39B6186AD3789
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/include/common/compression.h
// src/include/catalog/pg_class.h, RELKIND bytes
// 4C086F9F3EACC8E46490649397FA75A3693DD6E699C26270C95EC46649DA0557
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/include/catalog/pg_class.h
// src/bin/pg_dump/dumputils.c, sanitize_line: NULL (not empty) gets its sentinel
// 89BA3FA5EA891CB24B93DFD05D2B94E9D9BB28B3A8CDE42CC396CA99C747A823
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/dumputils.c
// src/bin/pg_dump/pg_dump.c, dumpEncoding and the 24 supported ArchiveOpts
// 73A7EE753841346C81FEE87BDCD095BCEFBA7D3CE7B7BEB2A0ED461D76CD27A6
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_dump.c
// src/bin/pg_dump/pg_dump_sort.c, postponed FUNCTION definitions; only MATVIEW
// (outside this class set) can postpone a table definition, never TABLE/VIEW
// 6FBB907CA73DCB411206A5449E7F1E77B4FED61F4D3A90C8DD535DF5B29E90FC
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_dump_sort.c

const apply = Reflect.apply, uncurry = fn => (self, ...args) => apply(fn, self, args);
const Bytes = Uint8Array, Store = ArrayBuffer, View = DataView, Decoder = TextDecoder;
const typedArray = Object.getPrototypeOf(Bytes.prototype), getter = name => uncurry(Object.getOwnPropertyDescriptor(typedArray, name).get);
const tagOf = getter(Symbol.toStringTag), lengthOf = getter("byteLength"), offsetOf = getter("byteOffset"), bufferOf = getter("buffer");
const copyInto = uncurry(typedArray.set), fillWith = uncurry(typedArray.fill);
const mapGet = uncurry(WeakMap.prototype.get), mapSet = uncurry(WeakMap.prototype.set), setHas = uncurry(WeakSet.prototype.has), setAdd = uncurry(WeakSet.prototype.add);
const newHash = createHash, hashPrototype = Object.getPrototypeOf(createHash("sha256")), hashUpdate = uncurry(hashPrototype.update), hashDigest = uncurry(hashPrototype.digest);
const decode = uncurry(Decoder.prototype.decode), decoder = new Decoder("utf-8", { fatal: true, ignoreBOM: true });
const { isProxy, isSharedArrayBuffer } = types, freeze = Object.freeze;
const ownErrors = new WeakSet(), extracted = new WeakMap(), targetInspectionTocs = new WeakMap();
const DB_LIMIT = 64 * 1024 * 1024, TOC_LIMIT = 32 * 1024 * 1024, FIELD_LIMIT = 4 * 1024 * 1024, ENTRY_LIMIT = 10000, EDGE_LIMIT = 100000;
const kinds = new Set(["DATABASE", "DATABASE PROPERTIES", "ACL", "COMMENT", "CONSTRAINT", "DEFAULT", "DEFAULT ACL", "ENCODING", "FK CONSTRAINT", "FUNCTION", "INDEX", "POLICY", "ROW SECURITY", "SCHEMA", "SEARCHPATH", "SEQUENCE", "SEQUENCE OWNED BY", "SEQUENCE SET", "STDSTRINGS", "TABLE", "TABLE DATA", "TRIGGER", "TYPE", "VIEW"]);
const relationKinds = new Set([0, 73, 83, 99, 102, 105, 109, 112, 114, 116, 118]);
const producerSections = new Map([
  ["DATABASE", [2]], ["DATABASE PROPERTIES", [2]], ["ACL", [1]], ["COMMENT", [1]],
  ["CONSTRAINT", [4]], ["DEFAULT", [2]], ["DEFAULT ACL", [4]], ["ENCODING", [2]],
  ["FK CONSTRAINT", [4]], ["FUNCTION", [2, 4]], ["INDEX", [4]], ["POLICY", [4]],
  ["ROW SECURITY", [4]], ["SCHEMA", [2]], ["SEARCHPATH", [2]], ["SEQUENCE", [2]],
  ["SEQUENCE OWNED BY", [2]], ["SEQUENCE SET", [3]], ["STDSTRINGS", [2]],
  ["TABLE", [2]], ["TABLE DATA", [3]], ["TRIGGER", [4]], ["TYPE", [2]], ["VIEW", [2]],
]);
const stringFields = ["tag", "namespace", "definition", "dropStatement", "copyStatement", "tablespace", "tableAccessMethod", "owner", "withOids"];
export const CUSTOM_TOC_ERROR_CODES = freeze(["RESTORE_CUSTOM_TOC_INPUT_INVALID", "RESTORE_CUSTOM_TOC_PLAN_REQUIRED", "RESTORE_CUSTOM_TOC_TARGET_REQUIRED", "RESTORE_CUSTOM_TOC_INSPECTION_REQUIRED", "RESTORE_CUSTOM_TOC_BINDING_INVALID", "RESTORE_CUSTOM_TOC_FORMAT_UNSUPPORTED", "RESTORE_CUSTOM_TOC_TRUNCATED", "RESTORE_CUSTOM_TOC_LIMIT_EXCEEDED", "RESTORE_CUSTOM_TOC_INVALID", "RESTORE_CUSTOM_TOC_PLAN_MISMATCH", "RESTORE_CUSTOM_TOC_REQUIRED", "RESTORE_CUSTOM_TOC_DISCARDED"]);
const fail = suffix => { const error = new BackupError("RESTORE_CUSTOM_TOC_" + suffix); setAdd(ownErrors, error); throw error; };
const digest = value => hashDigest(hashUpdate(newHash("sha256"), value), "hex");
const spanView = (database, span) => span === null ? null : new Bytes(bufferOf(database), offsetOf(database) + span.start, span.length);
const text = (database, span) => span === null ? null : decode(decoder, spanView(database, span));
function asciiEqual(database, span, value) {
  if (span === null || span.length !== value.length) return false;
  for (let index = 0; index < value.length; index++) if (database[span.start + index] !== value.charCodeAt(index)) return false;
  return true;
}
function inputLength(database) {
  if (isProxy(database) || !database || typeof database !== "object") fail("INPUT_INVALID");
  try {
    if (tagOf(database) !== "Uint8Array" || isSharedArrayBuffer(bufferOf(database))) fail("INPUT_INVALID");
    new View(bufferOf(database), 0, 0); // detach check without constructor/species
    return lengthOf(database);
  } catch { fail("INPUT_INVALID"); }
}
function wipe(store) { if (store) try { fillWith(store, 0); } catch { /* A transferred-out store is outside the wipe guarantee. */ } }

// Validate UTF8 without creating an immutable JS copy of SQL definitions.
// No normalization, BOM stripping, replacement characters or interior NUL.
function validString(database, start, length) {
  const end = start + length;
  for (let index = start; index < end;) {
    const first = database[index++];
    if (first === 0) fail("INVALID");
    if (first < 0x80) continue;
    let following, low = 0x80, high = 0xbf;
    if (first >= 0xc2 && first <= 0xdf) following = 1;
    else if (first >= 0xe0 && first <= 0xef) { following = 2; if (first === 0xe0) low = 0xa0; if (first === 0xed) high = 0x9f; }
    else if (first >= 0xf0 && first <= 0xf4) { following = 3; if (first === 0xf0) low = 0x90; if (first === 0xf4) high = 0x8f; }
    else fail("INVALID");
    if (index + following > end || database[index] < low || database[index] > high) fail("INVALID");
    index++;
    for (let rest = 1; rest < following; rest++, index++) if (database[index] < 0x80 || database[index] > 0xbf) fail("INVALID");
  }
}
function cursor(database, length) {
  let position = 12; const strings = [];
  const need = size => {
    if (position + size > TOC_LIMIT) fail("LIMIT_EXCEEDED");
    if (position + size > length) fail("TRUNCATED");
  };
  const integer = () => {
    need(5); const sign = database[position++];
    const magnitude = database[position] + database[position + 1] * 256 + database[position + 2] * 65536 + database[position + 3] * 16777216; position += 4;
    if (sign > 1 || sign === 1 && magnitude === 0 || magnitude > (sign ? 2147483648 : 2147483647)) fail("INVALID");
    return sign ? -magnitude : magnitude;
  };
  const string = () => {
    const size = integer(); if (size === -1) return null;
    if (size < 0) fail("INVALID"); if (size > FIELD_LIMIT) fail("LIMIT_EXCEEDED");
    need(size); const result = { start: position, length: size };
    // WriteStr uses strlen: embedded NUL cannot be produced. Retain opaque
    // bytes here; UTF8 is validated only after the ENCODING entry qualifies.
    for (let index = position; index < position + size; index++) if (database[index] === 0) fail("INVALID");
    strings.push(result); position += size; return result;
  };
  const decimal = (span, maximum, positive = false) => {
    if (span === null || span.length < 1 || span.length > 10) fail("INVALID");
    if (span.length > 1 && database[span.start] === 0x30) fail("INVALID");
    let result = 0;
    for (let index = span.start; index < span.start + span.length; index++) {
      const digit = database[index] - 0x30; if (digit < 0 || digit > 9) fail("INVALID");
      result = result * 10 + digit; if (result > maximum) fail("INVALID");
    }
    if (positive && result === 0) fail("INVALID"); return result;
  };
  const offset = () => {
    need(9); const state = database[position++]; if (state < 1 || state > 3) fail("INVALID");
    let value = 0n; for (let byte = 0; byte < 8; byte++) value |= BigInt(database[position++]) << BigInt(byte * 8);
    return { state, value };
  };
  return { integer, string, decimal, offset, position: () => position, strings: () => strings };
}
function knownKind(database, span) {
  for (const kind of kinds) if (asciiEqual(database, span, kind)) return kind;
  fail("INVALID");
}
function presented(database, span, hyphen) {
  if (span === null) return hyphen ? "-" : "";
  return text(database, span).replaceAll("\r", " ").replaceAll("\n", " ");
}
function crossCheck(database, rows, requirements) {
  const expected = new Map();
  for (const row of [...requirements.allNativeFirst, ...requirements.preserved]) {
    if (!Number.isSafeInteger(row.id) || row.id < 1 || expected.has(row.id) || !Number.isSafeInteger(row.catalogClassOid) || row.catalogClassOid < 0 || row.catalogClassOid > 4294967295 || !Number.isSafeInteger(row.catalogObjectOid) || row.catalogObjectOid < 0 || row.catalogObjectOid > 4294967295) fail("PLAN_MISMATCH");
    expected.set(row.id, row);
  }
  if (expected.size !== rows.length) fail("PLAN_MISMATCH");
  for (const row of rows) {
    const wanted = expected.get(row.dumpId);
    if (!wanted || row.catalogClassOid !== wanted.catalogClassOid || row.catalogObjectOid !== wanted.catalogObjectOid || row.kind !== wanted.description || presented(database, row.namespace, true) !== wanted.schema || presented(database, row.tag, false) !== wanted.tag || presented(database, row.owner, false) !== wanted.owner || row.dependencies.length !== wanted.dependencies.length || row.dependencies.some((value, index) => value !== wanted.dependencies[index])) fail("PLAN_MISMATCH");
  }
}

/** Pure, synchronous extraction of HEADER + TOC only; never parses DATA blocks,
 * decompresses, invokes IO/SQL, compares a target, authenticates or mints a
 * restore capability. Only the full-input binding hashes read their bytes.
 * A genuine plan/hash binding does not prove provenance.
 * Root alone must call after full authentication/recheck/planning and retain
 * its own evidence receipt. Every original field is private RAM, not a report.
 */
export function extractCustomArchiveToc(plan, database) {
  let requirements; try { requirements = managedRestoreRequirements(plan); } catch { fail("PLAN_REQUIRED"); }
  const binding = freeze({ side: "archive", archiveSha256: requirements.archiveSha256, databaseSha256: requirements.databaseSha256, databaseBytes: requirements.databaseBytes, tocSha256: requirements.tocSha256 });
  return extractToc(database, { ...requirements, allNativeFirst: requirements.selected }, binding);
}

/** Target-only nominal entry point. It cannot accept a restore plan, caller
 * metadata or a JSON origin assertion. Root alone must qualify the native dump,
 * authorized project, producer/options/EOF and empty-state observation. No IO,
 * SQL, restore authorization, mint or A2 comparison occurs here.
 */
export function extractCustomTargetToc(target, database) {
  let requirements; try { requirements = managedTargetBaselineRequirements(target); } catch { fail("TARGET_REQUIRED"); }
  return extractToc(database, { databaseSha256: requirements.binding.nativeDumpSha256, databaseBytes: requirements.binding.nativeDumpBytes,
    preserved: requirements.preserved, allNativeFirst: requirements.other }, requirements.binding);
}

/** Inspection has its own nominal plan and output store. No baseline handle,
 * history selector, Source capability or import selection is created. */
export function extractCustomTargetInspectionToc(inspection, database) {
  let requirements; try { requirements = managedTargetInspectionRequirements(inspection); } catch { fail("INSPECTION_REQUIRED"); }
  return extractToc(database, { databaseSha256: requirements.binding.nativeDumpSha256, databaseBytes: requirements.binding.nativeDumpBytes,
    preserved: [], allNativeFirst: requirements.records }, requirements.binding, targetInspectionTocs);
}

// Shared binary reader is private. Each public entry first obtains its own
// nominal requirements; no caller mode flag/callback can bypass a WeakMap.
// The destination is a private module constant fixed by that nominal entry.
function extractToc(database, requirements, binding, destination = extracted) {
  let owned;
  try {
    const length = inputLength(database);
    if (length > DB_LIMIT) fail("LIMIT_EXCEEDED");
    if (length < 12) fail("TRUNCATED");
    if (requirements.databaseBytes !== length || digest(database) !== requirements.databaseSha256) fail("BINDING_INVALID");
    let format; try { format = observeCustomArchiveHeader(database); } catch { if (length < 12) fail("TRUNCATED"); fail("FORMAT_UNSUPPORTED"); }
    if (format.compression !== "GZIP") fail("FORMAT_UNSUPPORTED");
    const source = cursor(database, length), creation = {};
    for (const key of ["second", "minute", "hour", "day", "month", "year", "isDst"]) creation[key] = source.integer();
    const header = { creation: freeze(creation), databaseName: source.string(), remoteVersion: source.string(), dumpVersion: source.string() };
    const count = source.integer(); if (count < 1) fail("INVALID"); if (count > ENTRY_LIMIT) fail("LIMIT_EXCEEDED");
    const rows = [], ids = new Set(); let edges = 0;
    for (let ordinal = 0; ordinal < count; ordinal++) {
      const dumpId = source.integer(), dumper = source.integer();
      if (dumpId < 1 || ids.has(dumpId) || dumper < 0 || dumper > 1) fail("INVALID"); ids.add(dumpId);
      const catalogClassOid = source.decimal(source.string(), 4294967295), catalogObjectOid = source.decimal(source.string(), 4294967295);
      const tag = source.string(), description = source.string(), kind = knownKind(database, description);
      const sectionCode = source.integer(); if (sectionCode < 1 || sectionCode > 4) fail("INVALID");
      const definition = source.string(), dropStatement = source.string(), copyStatement = source.string(), namespace = source.string(), tablespace = source.string(), tableAccessMethod = source.string();
      const relationKind = source.integer(); if (!relationKinds.has(relationKind)) fail("INVALID");
      // ArchiveEntry copies these ArchiveOpts directly. Only dumpTableSchema
      // supplies relkind; INDEX/SEQUENCE and every other supported class use 0.
      const producerRelationKind = kind === "TABLE" ? relationKind === 112 || relationKind === 114 : relationKind === (kind === "VIEW" ? 118 : 0);
      if (!producerSections.get(kind).includes(sectionCode) || !producerRelationKind || (dumper === 1) !== (kind === "TABLE DATA")) fail("INVALID");
      const owner = source.string(), withOids = source.string(); if (!asciiEqual(database, withOids, "false")) fail("INVALID");
      const dependencies = [];
      while (true) {
        const dependency = source.string(); if (dependency === null) break;
        if (++edges > EDGE_LIMIT) fail("LIMIT_EXCEEDED");
        dependencies.push(source.decimal(dependency, 2147483647, true));
      }
      const data = source.offset();
      if (dumper === 0 && (data.state !== 3 || data.value !== 0n) || dumper === 1 && data.state === 3 || data.state === 1 && data.value !== 0n) fail("INVALID");
      rows.push({ ordinal, dumpId, hadDumper: dumper === 1, catalogClassOid, catalogObjectOid, kind, tag, namespace, sectionCode, definition, dropStatement, copyStatement, tablespace, tableAccessMethod, relationKind, owner, withOids, dependencies: freeze(dependencies), customDataState: data.state, customDataOffset: data.value });
    }
    const tocEndOffset = source.position();
    for (const row of rows) {
      for (const id of row.dependencies) if (id === row.dumpId || !ids.has(id)) fail("INVALID");
      if (row.customDataState === 2 && (row.customDataOffset < BigInt(tocEndOffset) || row.customDataOffset >= BigInt(length))) fail("INVALID");
    }
    const encodings = rows.filter(row => row.kind === "ENCODING");
    if (encodings.length !== 1 || !asciiEqual(database, encodings[0].definition, "SET client_encoding = 'UTF8';\n")) fail("FORMAT_UNSUPPORTED");
    // Includes header/OID/dependency/description spans as well as SQL and all
    // returned ByteStrings. No string was decoded while encoding was unknown.
    for (const span of source.strings()) validString(database, span.start, span.length);
    crossCheck(database, rows, requirements);
    // One dedicated store contains only the bounded encoded header+TOC. Every
    // returned ByteString is a view of THIS store, never the caller's database.
    owned = new Bytes(new Store(tocEndOffset)); copyInto(owned, new Bytes(bufferOf(database), offsetOf(database), tocEndOffset));
    if (inputLength(database) !== length || digest(database) !== requirements.databaseSha256) fail("BINDING_INVALID");
    const records = freeze(rows.map(row => {
      const record = { ...row }; for (const key of stringFields) record[key] = spanView(owned, row[key]); return freeze(record);
    }));
    const byId = new Map(records.map(row => [row.dumpId, row]));
    const facts = { version: 1,
      binding,
      format, encoding: "UTF8", header: freeze({ creation: header.creation, databaseName: spanView(owned, header.databaseName), remoteVersion: spanView(owned, header.remoteVersion), dumpVersion: spanView(owned, header.dumpVersion) }),
      tocEndOffset, records };
    if (destination === targetInspectionTocs) { facts.inspectionOnly = true; facts.baselineQualified = false; }
    else facts.preserved = freeze(requirements.preserved.map(row => byId.get(row.id)));
    freeze(facts);
    const handle = destination === targetInspectionTocs ? freeze({ version: 1, inspectionOnly: true, baselineQualified: false }) : freeze({});
    mapSet(destination, handle, { owned, length: tocEndOffset, storeHash: digest(owned), facts, discarded: false }); return handle;
  } catch (error) { wipe(owned); if (setHas(ownErrors, error)) throw error; fail("INVALID"); }
}

/** Non-consuming private facts. A clone/JSON object is never an extraction. */
export function customArchiveTocFacts(handle) {
  return tocFacts(handle, extracted, "REQUIRED");
}
export function customTargetInspectionTocFacts(handle) {
  return tocFacts(handle, targetInspectionTocs, "INSPECTION_REQUIRED");
}
function tocFacts(handle, origin, required) {
  const record = mapGet(origin, handle); if (!record) fail(required); if (record.discarded) fail("DISCARDED");
  try { new View(bufferOf(record.owned), 0, 0); if (lengthOf(record.owned) !== record.length) fail("DISCARDED"); }
  catch { wipe(record.owned); record.discarded = true; record.owned = null; record.facts = null; fail("DISCARDED"); }
  let unchanged = false; try { unchanged = digest(record.owned) === record.storeHash; } catch { /* No native provider text escapes. */ }
  if (!unchanged) { wipe(record.owned); record.discarded = true; record.owned = null; record.facts = null; fail("BINDING_INVALID"); }
  return record.facts;
}

/** Total/idempotent: wipe before invalidating. Does not erase a clone or a
 * backing store previously transferred out by external code (Root does neither).
 */
export function discardCustomArchiveToc(handle) {
  return discardToc(handle, extracted);
}
export function discardCustomTargetInspectionToc(handle) {
  return discardToc(handle, targetInspectionTocs);
}
function discardToc(handle, origin) {
  const record = mapGet(origin, handle); if (!record || record.discarded) return false;
  const intact = lengthOf(record.owned) === record.length; wipe(record.owned);
  record.discarded = true; record.owned = null; record.facts = null; return intact;
}
