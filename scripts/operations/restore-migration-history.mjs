import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { types } from "node:util";
import { BackupError } from "./backup-format.mjs";
import { customArchiveTocFacts } from "./restore-custom-toc.mjs";
import { compareManagedMigrationHistory } from "./restore-managed-plan.mjs";

// Bounded script profile of PostgreSQL REL_18_4, not a general SQL/COPY parser.
// pg_backup_archiver.c: RestoreArchive/_doSetFixedOutputState/_printTocEntry
// SHA256 F8C83F07D574428B7A064B9FBC509A1FE3B3D10E962EF7B07B462DA35664677F
// pg_dump.c: dumpTableData/dumpTableData_copy/dumpSearchPath
// SHA256 73A7EE753841346C81FEE87BDCD095BCEFBA7D3CE7B7BEB2A0ED461D76CD27A6
// src/backend/commands/copyfromparse.c: CopyReadLineText/CopyReadAttributesText
// SHA256 46B9B2499D35617BF5573AC8A25E1D34340D0E2E4FC5270F1C5977D4B7C6DD84
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup_archiver.c
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_dump.c
// https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/backend/commands/copyfromparse.c
const apply = Reflect.apply, uncurry = fn => (self, ...args) => apply(fn, self, args);
const Bytes = Uint8Array, Store = ArrayBuffer, View = DataView, Decoder = TextDecoder, Encoder = TextEncoder;
const typed = Object.getPrototypeOf(Bytes.prototype), getter = key => uncurry(Object.getOwnPropertyDescriptor(typed, key).get);
const tagOf = getter(Symbol.toStringTag), lengthOf = getter("byteLength"), bufferOf = getter("buffer"), offsetOf = getter("byteOffset");
const setBytes = uncurry(typed.set), fillBytes = uncurry(typed.fill);
const mapGet = uncurry(WeakMap.prototype.get), mapSet = uncurry(WeakMap.prototype.set), setAdd = uncurry(WeakSet.prototype.add), setHas = uncurry(WeakSet.prototype.has);
const newHash = createHash, hashPrototype = Object.getPrototypeOf(createHash("sha256")), hashUpdate = uncurry(hashPrototype.update), hashDigest = uncurry(hashPrototype.digest);
const decode = uncurry(Decoder.prototype.decode), decoder = new Decoder("utf-8", { fatal: true, ignoreBOM: true });
const encode = uncurry(Encoder.prototype.encode), encoder = new Encoder();
const utf8Length = Buffer.byteLength;
const { isProxy, isSharedArrayBuffer } = types, freeze = Object.freeze;
const extracted = new WeakMap(), ownErrors = new WeakSet();
const RAW_LIMIT = 20 * 1024 * 1024, STRING_LIMIT = 4 * 1024 * 1024, ROW_LIMIT = 10000, ENVELOPE_LIMIT = 64 * 1024, COPY_LIMIT = 1024;
const key = "SCBaselineV1";
export const MIGRATION_HISTORY_ERROR_CODES = freeze(["RESTORE_MIGRATION_HISTORY_INPUT_INVALID", "RESTORE_MIGRATION_HISTORY_TOC_REQUIRED", "RESTORE_MIGRATION_HISTORY_BINDING_INVALID", "RESTORE_MIGRATION_HISTORY_FORMAT_UNSUPPORTED", "RESTORE_MIGRATION_HISTORY_TRUNCATED", "RESTORE_MIGRATION_HISTORY_LIMIT_EXCEEDED", "RESTORE_MIGRATION_HISTORY_INVALID", "RESTORE_MIGRATION_HISTORY_REQUIRED", "RESTORE_MIGRATION_HISTORY_DISCARDED"]);
const fail = suffix => { const error = new BackupError("RESTORE_MIGRATION_HISTORY_" + suffix); setAdd(ownErrors, error); throw error; };
const digest = bytes => hashDigest(hashUpdate(newHash("sha256"), bytes), "hex");
const view = (bytes, start, length) => new Bytes(bufferOf(bytes), offsetOf(bytes) + start, length);
const span = (start, length) => freeze({ start, length });
const wipe = bytes => { if (bytes) try { fillBytes(bytes, 0); } catch { /* A transferred backing store is outside the wipe guarantee. */ } };
function inputLength(bytes) {
  if (isProxy(bytes) || !bytes || typeof bytes !== "object") fail("INPUT_INVALID");
  try {
    if (tagOf(bytes) !== "Uint8Array" || isSharedArrayBuffer(bufferOf(bytes))) fail("INPUT_INVALID");
    new View(bufferOf(bytes), 0, 0); return lengthOf(bytes);
  } catch { fail("INPUT_INVALID"); }
}
function originalToc(handle) { try { return customArchiveTocFacts(handle); } catch { fail("TOC_REQUIRED"); } }
function sameToc(handle, facts) { try { if (customArchiveTocFacts(handle) !== facts) fail("BINDING_INVALID"); } catch { fail("BINDING_INVALID"); } }
function text(bytes, limit = ENVELOPE_LIMIT) {
  if (bytes === null) fail("FORMAT_UNSUPPORTED");
  if (lengthOf(bytes) > limit) fail("LIMIT_EXCEEDED");
  return decode(decoder, bytes);
}
// This lexer accepts only identifiers and the punctuation needed by these two
// native COPY headers. No expressions, comments, options, CSV or BINARY mode.
function copyColumns(statement, schema, table, wanted) {
  const value = text(statement, COPY_LIMIT); let at = 0;
  const take = fixed => { if (value.slice(at, at + fixed.length) !== fixed) fail("FORMAT_UNSUPPORTED"); at += fixed.length; };
  const spaces = () => { if (value[at] !== " " && value[at] !== "\t") fail("FORMAT_UNSUPPORTED"); while (value[at] === " " || value[at] === "\t") at++; };
  const identifier = () => {
    let result = "";
    if (value[at] === '"') {
      at++;
      while (at < value.length) {
        const ch = value[at++];
        if (ch === '"') { if (value[at] === '"') { result += '"'; at++; } else return result; }
        else { if (ch === "\n" || ch === "\r" || ch === "\0") fail("FORMAT_UNSUPPORTED"); result += ch; }
      }
      fail("FORMAT_UNSUPPORTED");
    }
    const start = at; if (!/[A-Za-z_]/.test(value[at] ?? "")) fail("FORMAT_UNSUPPORTED"); at++;
    while (at < value.length && /[A-Za-z0-9_$]/.test(value[at])) at++;
    return value.slice(start, at).toLowerCase();
  };
  take("COPY"); spaces(); if (identifier() !== schema) fail("FORMAT_UNSUPPORTED"); take("."); if (identifier() !== table) fail("FORMAT_UNSUPPORTED"); spaces(); take("(");
  const columns = [];
  while (true) {
    columns.push(identifier()); if (columns.length > wanted.length) fail("FORMAT_UNSUPPORTED");
    if (value[at] !== ",") break; at++; spaces();
  }
  take(")"); spaces(); take("FROM"); spaces(); take("stdin;\n");
  if (at !== value.length || columns.length !== wanted.length || new Set(columns).size !== wanted.length || wanted.some(column => !columns.includes(column))) fail("FORMAT_UNSUPPORTED");
  return freeze(columns);
}
function searchPathDefinition(bytes, standardStrings) {
  const value = text(bytes); const prefix = "SELECT pg_catalog.set_config('search_path', ";
  if (!value.startsWith(prefix)) fail("FORMAT_UNSUPPORTED"); let at = prefix.length, escaped = !standardStrings;
  if (value[at] === "E") { escaped = true; at++; }
  if (value[at++] !== "'") fail("FORMAT_UNSUPPORTED");
  while (at < value.length) {
    const char = value[at++];
    if (char === "\\" && escaped) { if (at === value.length) fail("FORMAT_UNSUPPORTED"); at++; }
    else if (char === "'") {
      if (value[at] === "'") at++;
      else { if (value.slice(at) !== ", false);\n") fail("FORMAT_UNSUPPORTED"); return; }
    }
  }
  fail("FORMAT_UNSUPPORTED");
}
function profile(facts) {
  const special = kind => { const rows = facts.records.filter(row => row.kind === kind); if (rows.length !== 1) fail("FORMAT_UNSUPPORTED"); return rows[0]; };
  if (facts.encoding !== "UTF8") fail("FORMAT_UNSUPPORTED");
  const strings = text(special("STDSTRINGS").definition);
  if (strings !== "SET standard_conforming_strings = 'on';\n" && strings !== "SET standard_conforming_strings = 'off';\n") fail("FORMAT_UNSUPPORTED");
  const standardStrings = strings === "SET standard_conforming_strings = 'on';\n", search = special("SEARCHPATH").definition;
  searchPathDefinition(search, standardStrings);
  const rows = facts.preserved.filter(row => row.kind === "TABLE DATA");
  if (rows.length !== 2) fail("FORMAT_UNSUPPORTED");
  const found = new Set(), selected = rows.map(row => {
    const schema = text(row.namespace, COPY_LIMIT), table = text(row.tag, COPY_LIMIT);
    const kind = schema === "auth" && table === "schema_migrations" ? "auth" : schema === "storage" && table === "migrations" ? "storage" : null;
    if (!kind || found.has(kind) || !row.hadDumper || row.sectionCode !== 3 || row.tablespace !== null || row.tableAccessMethod !== null || row.relationKind !== 0 || row.definition !== null && lengthOf(row.definition) !== 0) fail("FORMAT_UNSUPPORTED");
    found.add(kind);
    const columns = copyColumns(row.copyStatement, schema, table, kind === "auth" ? ["version"] : ["id", "name", "hash", "executed_at"]);
    return { row, kind, schema, table, columns };
  });
  selected.sort((a, b) => a.row.ordinal - b.row.ordinal);
  return { standardStrings, search, selected };
}

/** Only original preserved TABLE DATA IDs, in original TOC ordinal order.
 * Root must bind this selection to the actual native argv/list and full EOF.
 * Neither an ID nor these facts authenticates a subprocess or grants authority.
 */
export function migrationHistoryCopySelection(tocHandle) {
  try { const facts = originalToc(tocHandle), ids = freeze(profile(facts).selected.map(value => value.row.dumpId)); sameToc(tocHandle, facts); return ids; }
  catch (error) { if (setHas(ownErrors, error)) throw error; fail("INVALID"); }
}
function transport(bytes, length) {
  let at = 0, used = 0, line = 1;
  const take = expected => {
    const count = lengthOf(expected); if (used + count > ENVELOPE_LIMIT) fail("LIMIT_EXCEEDED");
    const available = Math.min(count, length - at);
    for (let i = 0; i < available; i++) if (bytes[at + i] !== expected[i]) fail("FORMAT_UNSUPPORTED");
    if (available !== count) fail("TRUNCATED");
    for (let i = 0; i < count; i++) if (bytes[at + i] === 10) line++;
    at += count; used += count;
  };
  const fixed = value => { if (value.length > ENVELOPE_LIMIT || used + utf8Length(value, "utf8") > ENVELOPE_LIMIT) fail("LIMIT_EXCEEDED"); take(encode(encoder, value)); };
  const nextRow = () => {
    const start = at, firstLine = line;
    for (; at < length; at++) {
      const byte = bytes[at];
      if (byte === 13 || byte === 0) fail("INVALID"); // native LF script profile, no CRLF normalization
      if (byte === 10) { const end = at++; line++; return { start, length: end - start, firstLine, lastLine: line - 1, terminator: false }; }
      if (byte === 92) {
        if (at + 1 === length) fail("TRUNCATED"); const next = bytes[++at];
        if (next === 46) {
          if (at - 1 !== start || bytes[at + 1] !== 10) fail("INVALID");
          if (used + 3 > ENVELOPE_LIMIT) fail("LIMIT_EXCEEDED");
          at += 2; line++; used += 3; return { start, length: 3, firstLine, lastLine: line - 1, terminator: true };
        }
        // COPY's line scanner skips the escaped byte, even a physical LF/CR.
        if (next === 10) line++; if (next === 0) fail("INVALID");
      }
    }
    fail("TRUNCATED");
  };
  return { take, fixed, nextRow, position: () => at, used: () => used };
}
const hex = byte => byte >= 48 && byte <= 57 ? byte - 48 : byte >= 65 && byte <= 70 ? byte - 55 : byte >= 97 && byte <= 102 ? byte - 87 : -1;
function fields(bytes, row, scratch, budget) {
  const ends = [], end = row.start + row.length; let begin = row.start;
  for (let at = begin; at < end; at++) {
    if (bytes[at] === 92) at++;
    else if (bytes[at] === 9) { if (ends.length === 4) fail("INVALID"); ends.push(span(begin, at - begin)); begin = at + 1; }
  }
  ends.push(span(begin, end - begin)); if (ends.length > 4) fail("INVALID");
  const values = ends.map(raw => {
    if (raw.length === 2 && bytes[raw.start] === 92 && bytes[raw.start + 1] === 78) return null;
    let count = 0; const finish = raw.start + raw.length;
    for (let at = raw.start; at < finish; at++) {
      let byte = bytes[at];
      if (byte === 92) {
        if (++at === finish) fail("INVALID"); byte = bytes[at];
        if (byte >= 48 && byte <= 55) {
          let value = byte - 48;
          for (let i = 0; i < 2 && at + 1 < finish && bytes[at + 1] >= 48 && bytes[at + 1] <= 55; i++) value = value * 8 + bytes[++at] - 48;
          byte = value & 255;
        } else if (byte === 120 && at + 1 < finish && hex(bytes[at + 1]) >= 0) {
          byte = hex(bytes[++at]); if (at + 1 < finish && hex(bytes[at + 1]) >= 0) byte = byte * 16 + hex(bytes[++at]);
        } else if (byte === 98) byte = 8; else if (byte === 102) byte = 12; else if (byte === 110) byte = 10;
        else if (byte === 114) byte = 13; else if (byte === 116) byte = 9; else if (byte === 118) byte = 11;
      }
      if (byte === 0) fail("INVALID");
      if (budget.strings + count + 1 > STRING_LIMIT || count >= lengthOf(scratch)) fail("LIMIT_EXCEEDED"); scratch[count++] = byte;
    }
    budget.strings += count; const result = decode(decoder, view(scratch, 0, count)); fillBytes(scratch, 0, 0, count); return result;
  });
  return { values, spans: freeze(ends) };
}
function preamble(reader, facts, settings) {
  reader.fixed("--\n-- PostgreSQL database dump\n--\n\n\\restrict " + key + "\n\n");
  for (const [field, label] of [["remoteVersion", "-- Dumped from database version "], ["dumpVersion", "-- Dumped by pg_dump version "]]) {
    if (facts.header[field] !== null) {
      const version = text(facts.header[field]); if (version.includes("\r") || version.includes("\n")) fail("FORMAT_UNSUPPORTED"); reader.fixed(label + version + "\n");
    }
  }
  reader.fixed("\nSET statement_timeout = 0;\nSET lock_timeout = 0;\nSET idle_in_transaction_session_timeout = 0;\nSET transaction_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = " + (settings.standardStrings ? "on" : "off") + ";\n");
  reader.take(settings.search);
  reader.fixed("SET check_function_bodies = false;\nSET xmloption = content;\nSET client_min_messages = warning;\n" + (settings.standardStrings ? "" : "SET escape_string_warning = off;\n") + "SET row_security = off;\n\n");
}
function itemComment(item) {
  const owner = item.row.owner === null ? "-" : text(item.row.owner).replaceAll("\r", " ").replaceAll("\n", " ");
  return "--\n-- Data for Name: " + item.table + "; Type: TABLE DATA; Schema: " + item.schema + "; Owner: " + owner + "\n--\n\n";
}
function invalidate(record) { wipe(record.owned); record.discarded = true; record.owned = null; record.facts = null; record.tocFacts = null; record.tocHandle = null; }

/** Pure synchronous extraction of exactly two histories. Does not read DATA
 * from the archive, start pg_restore, connect, execute SQL, compare a target or
 * mint a restore capability. Root owns complete native provenance and EOF.
 * Byte spans and rows are PRIVATE RAM, never a diagnostic/public report.
 */
export function extractMigrationHistory(tocHandle, stdoutBytes) {
  let owned, scratch;
  try {
    const tocFacts = originalToc(tocHandle), settings = profile(tocFacts), length = inputLength(stdoutBytes);
    if (length > RAW_LIMIT) fail("LIMIT_EXCEEDED"); if (length === 0) fail("TRUNCATED");
    const sourceHash = digest(stdoutBytes);
    owned = new Bytes(new Store(length)); setBytes(owned, stdoutBytes);
    scratch = new Bytes(new Store(Math.min(length, STRING_LIMIT)));
    const reader = transport(owned, length), history = { auth: [], storage: [] }, blocks = [], budget = { strings: 0, rows: 0 };
    preamble(reader, tocFacts, settings);
    for (const item of settings.selected) {
      reader.fixed(itemComment(item)); const headerStart = reader.position(); reader.take(item.row.copyStatement);
      const payloadStart = reader.position(), rows = []; let terminator;
      while (true) {
        const row = reader.nextRow(); if (row.terminator) { terminator = row; break; }
        if (++budget.rows > ROW_LIMIT) fail("LIMIT_EXCEEDED");
        const result = fields(owned, row, scratch, budget);
        if (result.values.length !== item.columns.length) fail("INVALID");
        const data = {};
        for (let i = 0; i < item.columns.length; i++) data[item.columns[i]] = result.values[i];
        if (item.kind === "storage") {
          // Native integer output is decimal, without signs/whitespace/exponents.
          if (typeof data.id !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(data.id)) fail("INVALID");
          data.id = Number(data.id); if (!Number.isSafeInteger(data.id)) fail("INVALID");
        }
        history[item.kind].push(freeze(data));
        rows.push(freeze({ bytes: span(row.start, row.length), firstLine: row.firstLine, lastLine: row.lastLine, fields: result.spans }));
      }
      blocks.push(freeze({ sourceRecord: item.row, dumpId: item.row.dumpId, ordinal: item.row.ordinal, kind: item.kind, columns: item.columns,
        header: span(headerStart, lengthOf(item.row.copyStatement)), payload: span(payloadStart, terminator.start - payloadStart), terminator: span(terminator.start, terminator.length), rows: freeze(rows) }));
      reader.fixed("\n\n"); // pg_dump's stored end marker is backslash-dot + three LF
    }
    reader.fixed("--\n-- PostgreSQL database dump complete\n--\n\n\\unrestrict " + key + "\n\n");
    if (reader.position() !== length) fail("FORMAT_UNSUPPORTED");
    try { if (!compareManagedMigrationHistory(history, history)) fail("INVALID"); } catch { fail("INVALID"); }
    freeze(history.auth); freeze(history.storage); freeze(history);
    // No await/caller code between original handle recheck, digest and commit.
    sameToc(tocHandle, tocFacts);
    if (inputLength(stdoutBytes) !== length || digest(stdoutBytes) !== sourceHash || digest(owned) !== sourceHash) fail("BINDING_INVALID");
    const facts = freeze({ version: 1, binding: tocFacts.binding, stdoutSha256: sourceHash, stdoutBytes: length, envelopeBytes: reader.used(), decodedBytes: budget.strings,
      sourceBytes: owned, history, blocks: freeze(blocks) });
    const handle = freeze({}); mapSet(extracted, handle, { owned, length, storeHash: sourceHash, tocHandle, tocFacts, facts, discarded: false }); return handle;
  } catch (error) { wipe(owned); if (setHas(ownErrors, error)) throw error; fail("INVALID"); }
  finally { wipe(scratch); }
}

/** Every access revalidates BOTH original TOC identity/integrity and own raw
 * bytes. Prior strings/copies/transfers cannot be erased by discarding a handle.
 */
export function migrationHistoryFacts(handle) {
  const record = mapGet(extracted, handle); if (!record) fail("REQUIRED"); if (record.discarded) fail("DISCARDED");
  try { sameToc(record.tocHandle, record.tocFacts); } catch { invalidate(record); fail("BINDING_INVALID"); }
  try { new View(bufferOf(record.owned), 0, 0); if (lengthOf(record.owned) !== record.length) fail("DISCARDED"); }
  catch { invalidate(record); fail("DISCARDED"); }
  let intact = false; try { intact = digest(record.owned) === record.storeHash; } catch { /* Closed refusal only. */ }
  if (!intact) { invalidate(record); fail("BINDING_INVALID"); }
  return record.facts;
}
/** Total/idempotent for arbitrary handles. Wipes only this owned source store;
 * never wipes the caller's stdout/TOC or an external clone/transferred store.
 */
export function discardMigrationHistory(handle) {
  const record = mapGet(extracted, handle); if (!record || record.discarded) return false;
  const intact = lengthOf(record.owned) === record.length; invalidate(record); return intact;
}
