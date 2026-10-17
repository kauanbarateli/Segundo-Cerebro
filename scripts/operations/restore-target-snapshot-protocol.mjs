import { createHash } from "node:crypto";
import { types } from "node:util";
import { BackupError } from "./backup-format.mjs";

// Pure wire/SQL contract only. Import and every export perform no IO, spawn,
// connection, environment read, native attestation, snapshot mint or restore.
export const TARGET_SNAPSHOT_PROTOCOL_LIMITS = Object.freeze({ frameBytes: 1024 * 1024, relations: 1000, historyRows: 10000, jsonDepth: 12, jsonTokens: 65536, identifierBytes: 63 });
export const TARGET_SNAPSHOT_PROTOCOL_ERROR_CODES = Object.freeze(["INPUT_INVALID", "FRAME_INVALID", "LIMIT_EXCEEDED", "IDENTITY_REFUSED", "ACTOR_REFUSED", "MODE_REFUSED", "RLS_REFUSED", "SCOPE_REFUSED", "CATALOGUE_REFUSED", "TARGET_NOT_EMPTY", "HISTORY_REQUIRED", "END_REFUSED", "START_REQUIRED"].map(suffix => "RESTORE_TARGET_SNAPSHOT_" + suffix));
const SCHEMAS = Object.freeze(["auth", "storage", "public", "app_private"]);
const START_KEYS = ["version", "kind", "nonce", "snapshotId", "databaseName", "actor", "sessionActor", "readOnly", "isolation", "rowSecurityOff", "rlsBypass", "catalogueComplete", "catalogueCount", "schemas", "relations"];
const RELATION_KEYS = ["oid", "schemaOid", "schema", "name", "kind", "extensionMember", "extensionConfig", "isPartition", "hasInheritance", "rowSecurityActive", "rows"];
const starts = new WeakMap();
const Bytes = Uint8Array, typed = Object.getPrototypeOf(Bytes.prototype);
const byteLength = Function.call.bind(Object.getOwnPropertyDescriptor(typed, "byteLength").get);
const backing = Function.call.bind(Object.getOwnPropertyDescriptor(typed, "buffer").get);
const setBytes = Function.call.bind(typed.set), fillBytes = Function.call.bind(typed.fill);
const fail = suffix => { throw new BackupError("RESTORE_TARGET_SNAPSHOT_" + suffix); };
function nonceValue(value) { if (typeof value !== "string" || !/^[a-f0-9]{32}$/.test(value)) fail("INPUT_INVALID"); return value; }
function record(value, keys) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail("FRAME_INVALID");
  const descriptors = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) fail("FRAME_INVALID");
  for (const key of keys) { const d = descriptors[key]; if (!d?.enumerable || !Object.hasOwn(d, "value")) fail("FRAME_INVALID"); }
  return value;
}
const integer = (value, minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const oid = value => integer(value, 1, 0xffffffff);
function identifier(value) {
  return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= TARGET_SNAPSHOT_PROTOCOL_LIMITS.identifierBytes && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value) && !/[\ud800-\udfff]/u.test(value);
}

// Detect duplicates before JSON.parse loses them. Strings are decoded only as
// bounded JSON tokens; this scanner never evaluates JavaScript or SQL.
function uniqueJson(text) {
  let at = 0, tokens = 0;
  const bad = () => fail("FRAME_INVALID");
  const space = () => { while (text[at] === " " || text[at] === "\t") at++; };
  const string = () => {
    const begin = at++;
    while (at < text.length) {
      const code = text.charCodeAt(at++);
      if (code === 34) { try { return JSON.parse(text.slice(begin, at)); } catch { return bad(); } }
      if (code < 32) return bad();
      if (code === 92) {
        const escape = text[at++];
        if (escape === "u") { if (!/^[a-fA-F0-9]{4}$/.test(text.slice(at, at + 4))) return bad(); at += 4; }
        else if (!["\"", "\\", "/", "b", "f", "n", "r", "t"].includes(escape)) return bad();
      }
    }
    return bad();
  };
  const value = depth => {
    if (depth > TARGET_SNAPSHOT_PROTOCOL_LIMITS.jsonDepth || ++tokens > TARGET_SNAPSHOT_PROTOCOL_LIMITS.jsonTokens) fail("LIMIT_EXCEEDED");
    space(); const first = text[at];
    if (first === "{") {
      at++; space(); const keys = new Set(); if (text[at] === "}") { at++; return; }
      while (at < text.length) {
        space(); if (text[at] !== "\"") return bad(); const key = string();
        if (keys.has(key)) return bad(); keys.add(key); space(); if (text[at++] !== ":") return bad(); value(depth + 1); space();
        const separator = text[at++]; if (separator === "}") return; if (separator !== ",") return bad();
      }
      return bad();
    }
    if (first === "[") {
      at++; space(); if (text[at] === "]") { at++; return; }
      while (at < text.length) { value(depth + 1); space(); const separator = text[at++]; if (separator === "]") return; if (separator !== ",") return bad(); }
      return bad();
    }
    if (first === "\"") { string(); return; }
    const literal = /^(?:null|true|false|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(at));
    if (!literal) return bad(); at += literal[0].length;
  };
  value(0); space(); if (at !== text.length) bad();
}
function readFrame(bytes) {
  let copy;
  try {
    if (!bytes || types.isProxy(bytes) || !types.isUint8Array(bytes) || types.isSharedArrayBuffer(backing(bytes))) fail("INPUT_INVALID");
    try { new DataView(backing(bytes), 0, 0); } catch { fail("INPUT_INVALID"); }
    const size = byteLength(bytes); if (size > TARGET_SNAPSHOT_PROTOCOL_LIMITS.frameBytes) fail("LIMIT_EXCEEDED");
    if (!size) fail("FRAME_INVALID"); copy = new Bytes(size); setBytes(copy, bytes);
    if (copy[size - 1] !== 10) fail("FRAME_INVALID");
    const end = size > 1 && copy[size - 2] === 13 ? size - 2 : size - 1;
    for (let i = 0; i < end; i++) if (copy[i] === 10 || copy[i] === 13) fail("FRAME_INVALID");
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(copy.subarray(0, end)); } catch { fail("FRAME_INVALID"); }
    uniqueJson(text);
    let value; try { value = JSON.parse(text); } catch { fail("FRAME_INVALID"); }
    return { value, frameSha256: createHash("sha256").update(copy).digest("hex") };
  } finally { if (copy) fillBytes(copy, 0); }
}
function identity(frame, nonce, kind) {
  if (frame.version !== 1 || frame.kind !== kind || frame.nonce !== nonce || frame.databaseName !== "postgres") fail("IDENTITY_REFUSED");
  if (frame.actor !== "postgres" || frame.sessionActor !== "postgres") fail("ACTOR_REFUSED");
}

/** Root sends only this authored SQL over its own original readonly session.
 * No caller SQL, identifier, role, schema, database or snapshot ID is accepted. */
export function beginTargetSnapshotSql(nonce) {
  nonce = nonceValue(nonce);
  return `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;
SET LOCAL row_security = off;
WITH actor AS MATERIALIZED (
 SELECT current_database() AS database_name,current_user::text AS actor,session_user::text AS session_actor,
 current_setting('transaction_read_only') = 'on' AS read_only,
 current_setting('transaction_isolation') AS isolation,current_setting('row_security') = 'off' AS row_security_off,
 coalesce((SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user),false) AS rls_bypass
), schema_names(name,ordinal) AS (VALUES ('auth',1),('storage',2),('public',3),('app_private',4)),
schemas AS MATERIALIZED (
 SELECT s.name,s.ordinal,n.oid FROM schema_names s LEFT JOIN pg_namespace n ON n.nspname = s.name
), catalogue AS MATERIALIZED (
 SELECT c.oid,c.relnamespace AS schema_oid,n.nspname::text AS schema_name,c.relname::text AS name,c.relkind::text AS kind,
 EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e') AS extension_member,
 EXISTS(SELECT 1 FROM pg_extension e WHERE c.oid = ANY(e.extconfig)) AS extension_config,
 c.relispartition AS is_partition,EXISTS(SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid OR i.inhparent = c.oid) AS has_inheritance,
 CASE WHEN c.relkind IN ('r','p') THEN row_security_active(c.oid) ELSE false END AS row_security_active
 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname IN ('auth','storage','public','app_private') ORDER BY c.oid LIMIT 1001
), eligibility AS MATERIALIZED (
 SELECT a.*,count(c.oid) AS catalogue_count,
 a.database_name = 'postgres' AND a.actor = 'postgres' AND a.session_actor = 'postgres' AND a.read_only
 AND a.isolation = 'repeatable read' AND a.row_security_off AND a.rls_bypass
 AND (SELECT count(*) = 3 FROM schemas WHERE name IN ('auth','storage','public') AND oid IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM schemas WHERE name = 'app_private' AND oid IS NOT NULL)
 AND count(c.oid) <= 1000
 AND NOT coalesce(bool_or(c.kind NOT IN ('r','S','v','i','c','t') OR c.extension_config OR c.is_partition OR c.has_inheritance OR c.row_security_active OR (c.kind = 'r' AND c.schema_name IN ('public','app_private') AND NOT c.extension_member)),false)
 AND count(*) FILTER(WHERE c.kind = 'r' AND NOT c.extension_member AND ((c.schema_name = 'auth' AND c.name = 'schema_migrations') OR (c.schema_name = 'storage' AND c.name = 'migrations'))) = 2 AS permitted
 FROM actor a LEFT JOIN catalogue c ON true GROUP BY a.database_name,a.actor,a.session_actor,a.read_only,a.isolation,a.row_security_off,a.rls_bypass
), counted AS MATERIALIZED (
 SELECT c.*,CASE WHEN e.permitted AND c.kind = 'r' THEN
 ((xpath('/table/row/count/text()',query_to_xml(format('SELECT count(*) AS count FROM ONLY %I.%I',c.schema_name,c.name),false,false,'')))[1]::text)::bigint
 ELSE NULL END AS rows
 FROM catalogue c CROSS JOIN eligibility e
), result AS MATERIALIZED (
 SELECT e.*,e.permitted AND NOT EXISTS(SELECT 1 FROM counted c WHERE c.kind = 'r' AND (c.rows IS NULL OR (NOT ((c.schema_name = 'auth' AND c.name = 'schema_migrations') OR (c.schema_name = 'storage' AND c.name = 'migrations')) AND c.rows <> 0))) AS empty_qualified
 FROM eligibility e
)
SELECT jsonb_build_object('version',1,'kind','target-snapshot-start','nonce','${nonce}',
 'snapshotId',CASE WHEN r.empty_qualified THEN pg_export_snapshot() ELSE NULL END,
 'databaseName',r.database_name,'actor',r.actor,'sessionActor',r.session_actor,'readOnly',r.read_only,'isolation',r.isolation,'rowSecurityOff',r.row_security_off,'rlsBypass',r.rls_bypass,
 'catalogueComplete',r.catalogue_count <= 1000,'catalogueCount',r.catalogue_count,
 'schemas',(SELECT jsonb_agg(jsonb_build_object('name',s.name,'oid',s.oid::bigint) ORDER BY s.ordinal) FROM schemas s),
 'relations',CASE WHEN r.catalogue_count <= 1000 THEN coalesce((SELECT jsonb_agg(jsonb_build_object('oid',c.oid::bigint,'schemaOid',c.schema_oid::bigint,'schema',c.schema_name,'name',c.name,'kind',c.kind,'extensionMember',c.extension_member,'extensionConfig',c.extension_config,'isPartition',c.is_partition,'hasInheritance',c.has_inheritance,'rowSecurityActive',c.row_security_active,'rows',c.rows) ORDER BY c.oid) FROM counted c),'[]'::jsonb) ELSE '[]'::jsonb END)
FROM result r;
`;
}

export function endTargetSnapshotSql(nonce) {
  nonce = nonceValue(nonce);
  return `DO $sc_target_snapshot_end$
BEGIN
 IF current_database() <> 'postgres' OR current_user <> 'postgres' OR session_user <> 'postgres'
 OR current_setting('transaction_read_only') <> 'on' OR current_setting('transaction_isolation') <> 'repeatable read' OR current_setting('row_security') <> 'off'
 THEN RAISE EXCEPTION USING ERRCODE = '25006',MESSAGE = 'TARGET_SNAPSHOT_MODE_REFUSED'; END IF;
END;
$sc_target_snapshot_end$;
COMMIT;
SELECT jsonb_build_object('version',1,'kind','target-snapshot-end','nonce','${nonce}','committed',true,'databaseName',current_database(),'actor',current_user::text,'sessionActor',session_user::text);
\\quit
`;
}

/** A parsed frame is a private observation, not native origin or authority. */
export function parseTargetSnapshotStartFrame(bytes, nonce) {
  nonce = nonceValue(nonce);
  const { value: frame, frameSha256 } = readFrame(bytes); record(frame, START_KEYS); identity(frame, nonce, "target-snapshot-start");
  if (frame.readOnly !== true || frame.isolation !== "repeatable read") fail("MODE_REFUSED");
  if (frame.rowSecurityOff !== true || frame.rlsBypass !== true) fail("RLS_REFUSED");
  if (frame.catalogueComplete !== true || !integer(frame.catalogueCount, 0, TARGET_SNAPSHOT_PROTOCOL_LIMITS.relations)) fail("LIMIT_EXCEEDED");
  if (!Array.isArray(frame.schemas) || frame.schemas.length !== 4 || !Array.isArray(frame.relations) || frame.relations.length > TARGET_SNAPSHOT_PROTOCOL_LIMITS.relations) fail("CATALOGUE_REFUSED");
  if (frame.relations.length !== frame.catalogueCount) fail("CATALOGUE_REFUSED");
  const schemaIds = new Map(), schemaOids = new Set();
  for (const [index, schema] of frame.schemas.entries()) {
    record(schema, ["name", "oid"]);
    if (schema.name !== SCHEMAS[index]) fail("CATALOGUE_REFUSED");
    if (schema.name === "app_private") { if (schema.oid !== null) fail("SCOPE_REFUSED"); }
    else { if (!oid(schema.oid) || schemaOids.has(schema.oid)) fail("CATALOGUE_REFUSED"); schemaOids.add(schema.oid); schemaIds.set(schema.name, schema.oid); }
  }
  const ids = new Set(), identities = new Set(), histories = new Map();
  let ordinaryTables = 0, emptyTables = 0, previousOid = 0;
  for (const row of frame.relations) {
    record(row, RELATION_KEYS);
    if (!schemaIds.has(row.schema)) fail("SCOPE_REFUSED");
    if (!oid(row.oid) || row.oid <= previousOid || ids.has(row.oid) || !oid(row.schemaOid) || schemaIds.get(row.schema) !== row.schemaOid || !identifier(row.name)) fail("CATALOGUE_REFUSED");
    previousOid = row.oid; ids.add(row.oid);
    const key = row.schema + "\0" + row.name; if (identities.has(key)) fail("CATALOGUE_REFUSED"); identities.add(key);
    if (["extensionMember", "extensionConfig", "isPartition", "hasInheritance", "rowSecurityActive"].some(key => typeof row[key] !== "boolean")) fail("CATALOGUE_REFUSED");
    if (!["r", "S", "v", "i", "c", "t"].includes(row.kind) || row.extensionConfig || row.isPartition || row.hasInheritance) fail("SCOPE_REFUSED");
    if (row.rowSecurityActive) fail("RLS_REFUSED");
    const history = row.schema === "auth" && row.name === "schema_migrations" ? "auth" : row.schema === "storage" && row.name === "migrations" ? "storage" : null;
    if (history !== null && (row.kind !== "r" || row.extensionMember || histories.has(history))) fail("HISTORY_REQUIRED");
    if (row.kind === "r") {
      ordinaryTables++;
      if (!integer(row.rows, 0, Number.MAX_SAFE_INTEGER)) fail("CATALOGUE_REFUSED");
      if ((row.schema === "public" || row.schema === "app_private") && !row.extensionMember) fail("SCOPE_REFUSED");
      if (history) { if (row.rows > TARGET_SNAPSHOT_PROTOCOL_LIMITS.historyRows) fail("LIMIT_EXCEEDED"); histories.set(history, row.rows); }
      else { if (row.rows !== 0) fail("TARGET_NOT_EMPTY"); emptyTables++; }
    } else if (row.rows !== null) fail("CATALOGUE_REFUSED");
    Object.freeze(row);
  }
  if (histories.size !== 2) fail("HISTORY_REQUIRED");
  if (typeof frame.snapshotId !== "string" || !/^[0-9A-F]{8}-[0-9A-F]{8}-[1-9][0-9]{0,9}$/.test(frame.snapshotId)) fail("FRAME_INVALID");
  const facts = Object.freeze({ version: 1, protocolOnly: true, nativeOrigin: false, readonlySnapshot: true, repeatableRead: true, actorValidated: true, rlsBypass: true, schemas: schemaIds.size, catalogueRelations: frame.catalogueCount, ordinaryTables, emptyDataTables: emptyTables, authHistoryRows: histories.get("auth"), storageHistoryRows: histories.get("storage"), allOtherTableDataEmpty: true, restoreAccepted: false });
  const result = Object.freeze({ snapshotId: frame.snapshotId, facts });
  // Original wire digest remains private correlation, never native provenance.
  starts.set(result, Object.freeze({ facts, frameSha256 }));
  return result;
}
export function parseTargetSnapshotEndFrame(bytes, nonce) {
  nonce = nonceValue(nonce);
  const { value: frame, frameSha256 } = readFrame(bytes);
  record(frame, ["version", "kind", "nonce", "committed", "databaseName", "actor", "sessionActor"]); identity(frame, nonce, "target-snapshot-end");
  if (frame.committed !== true) fail("END_REFUSED");
  return Object.freeze({ ...frame, frameSha256 });
}
export function targetSnapshotPublicFacts(start) {
  const stored = starts.get(start); if (!stored) fail("START_REQUIRED"); return stored.facts;
}
