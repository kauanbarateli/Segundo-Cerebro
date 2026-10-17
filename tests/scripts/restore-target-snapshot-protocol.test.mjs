import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  beginTargetSnapshotSql, endTargetSnapshotSql,
  parseTargetSnapshotStartFrame, parseTargetSnapshotEndFrame, targetSnapshotPublicFacts,
  TARGET_SNAPSHOT_PROTOCOL_LIMITS, TARGET_SNAPSHOT_PROTOCOL_ERROR_CODES,
} from "../../scripts/operations/restore-target-snapshot-protocol.mjs";

// Artificial RAM metadata only. No SQL engine, connection, filesystem fixture,
// executable, environment, profile, archive, native receipt or restore is used.
const nonce = "0123456789abcdef0123456789abcdef", CANARY = "PRIVATE_SNAPSHOT_CANARY";
const row = (oid, schema, name, kind = "r", rows = 0, extensionMember = false) => ({ oid, schemaOid: schema === "auth" ? 10 : schema === "storage" ? 20 : 30, schema, name, kind, extensionMember, extensionConfig: false, isPartition: false, hasInheritance: false, rowSecurityActive: false, rows });
const frame = () => ({ version: 1, kind: "target-snapshot-start", nonce, snapshotId: "00000003-0000001B-1", databaseName: "postgres", actor: "postgres", sessionActor: "postgres", readOnly: true, isolation: "repeatable read", rowSecurityOff: true, rlsBypass: true, catalogueComplete: true, catalogueCount: 5, schemas: [{ name: "auth", oid: 10 }, { name: "storage", oid: 20 }, { name: "public", oid: 30 }, { name: "app_private", oid: null }], relations: [row(100, "auth", "schema_migrations", "r", 82), row(101, "auth", "users"), row(102, "storage", "migrations", "r", 73), row(103, "storage", "objects"), row(104, "storage", "migrations_pkey", "i", null)] });
const end = () => ({ version: 1, kind: "target-snapshot-end", nonce, committed: true, databaseName: "postgres", actor: "postgres", sessionActor: "postgres" });
const encode = value => Buffer.from(JSON.stringify(value) + "\n");
const parse = value => parseTargetSnapshotStartFrame(encode(value), nonce);
function rejects(operation, suffix) {
  assert.throws(operation, error => {
    assert.equal(error.code, "RESTORE_TARGET_SNAPSHOT_" + suffix);
    assert.equal(error.message, error.code); assert.equal(Object.hasOwn(error, "cause"), false);
    assert.equal(JSON.stringify(error).includes(CANARY), false); assert.equal(error.stack.includes(CANARY), false);
    return true;
  });
}
test("public limits and authored commands are inert, closed and nonce bound", async () => {
  assert.equal(Object.isFrozen(TARGET_SNAPSHOT_PROTOCOL_LIMITS), true); assert.equal(Object.isFrozen(TARGET_SNAPSHOT_PROTOCOL_ERROR_CODES), true);
  const source = await readFile(new URL("../../scripts/operations/restore-target-snapshot-protocol.mjs", import.meta.url), "utf8");
  for (const forbidden of ["node:fs", "node:child_process", "process.env", "fetch(", "pg_dump", "new Function", "eval("]) assert.equal(source.includes(forbidden), false);
  const sql = beginTargetSnapshotSql(nonce), closing = endTargetSnapshotSql(nonce);
  assert.match(sql, /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
  assert.ok(sql.includes("SET LOCAL row_security = off;")); assert.ok(sql.includes("SET LOCAL search_path = pg_catalog;"));
  assert.ok(sql.includes("a.actor = 'postgres' AND a.session_actor = 'postgres'")); assert.ok(sql.includes("rolsuper OR rolbypassrls"));
  assert.ok(sql.includes("query_to_xml(format('SELECT count(*) AS count FROM ONLY %I.%I',c.schema_name,c.name),false,false,'')"));
  assert.ok(sql.includes("CASE WHEN e.permitted AND c.kind = 'r'")); assert.ok(sql.includes("LIMIT 1001"));
  assert.ok(sql.includes("CASE WHEN r.empty_qualified THEN pg_export_snapshot() ELSE NULL END"));
  assert.equal(/SELECT \*|SELECT [\w.]+ FROM (?:auth|storage)\./i.test(sql), false);
  assert.ok(closing.includes("current_setting('transaction_read_only') <> 'on'")); assert.ok(closing.includes("END;\n$sc_target_snapshot_end$;\nCOMMIT;\n"));
  assert.ok(closing.endsWith("\\quit\n")); assert.equal(closing.includes("\\u0005"), false);
  assert.equal((sql.match(new RegExp(nonce, "g")) ?? []).length, 1); assert.equal((closing.match(new RegExp(nonce, "g")) ?? []).length, 1);
  for (const changed of ["", nonce.toUpperCase(), "a".repeat(31), "a".repeat(33), nonce + "'; SELECT " + CANARY, null, {}, 3, Symbol()]) {
    rejects(() => beginTargetSnapshotSql(changed), "INPUT_INVALID"); rejects(() => endTargetSnapshotSql(changed), "INPUT_INVALID");
  }
});
test("valid start releases catalogue into immutable count-only public facts without altering input", () => {
  const bytes = encode(frame()), before = Buffer.from(bytes), start = parseTargetSnapshotStartFrame(bytes, nonce), facts = targetSnapshotPublicFacts(start);
  assert.deepEqual(bytes, before); assert.equal(start.snapshotId, frame().snapshotId);
  assert.deepEqual(Object.keys(start), ["snapshotId", "facts"]); assert.equal(start.facts, facts); assert.equal(Object.isFrozen(start), true);
  assert.deepEqual(facts, { version: 1, protocolOnly: true, nativeOrigin: false, readonlySnapshot: true, repeatableRead: true, actorValidated: true, rlsBypass: true, schemas: 3, catalogueRelations: 5, ordinaryTables: 4, emptyDataTables: 2, authHistoryRows: 82, storageHistoryRows: 73, allOtherTableDataEmpty: true, restoreAccepted: false });
  assert.equal(Object.isFrozen(facts), true); assert.equal(Object.values(facts).every(value => typeof value === "number" || typeof value === "boolean"), true);
  for (const field of ["nonce", "snapshotId", "relations", "schemas", "frameSha256", "actor"]) if (field !== "schemas") assert.equal(Object.hasOwn(facts, field), false);
  rejects(() => targetSnapshotPublicFacts(structuredClone(start)), "START_REQUIRED"); rejects(() => targetSnapshotPublicFacts({}), "START_REQUIRED");
});
test("native CRLF frame is accepted as framing only without modifying the wire bytes", () => {
  const bytes = Buffer.from(JSON.stringify(frame()) + "\r\n"), result = parseTargetSnapshotStartFrame(bytes, nonce);
  assert.deepEqual(result, parse(frame())); assert.equal(bytes.at(-2), 13); assert.equal(bytes.at(-1), 10);
});
test("the parser refuses root and nested extras, omitted fields and unknown shapes", () => {
  for (const mutate of [f => { f.extra = CANARY; }, f => { delete f.actor; }, f => { f.schemas[0].extra = CANARY; }, f => { f.relations[0].extra = CANARY; }, f => { delete f.relations[0].rows; }]) { const f = frame(); mutate(f); rejects(() => parse(f), "FRAME_INVALID"); }
  for (const f of [null, [], 1, true, CANARY]) rejects(() => parse(f), "FRAME_INVALID");
});
test("duplicate JSON keys are rejected before lossy parsing, including escaped and nested keys", () => {
  const source = JSON.stringify(frame());
  for (const value of [source.replace('"version":1', '"version":1,"version":1'), source.replace('"nonce":', '"no\\u006ece":"' + nonce + '","nonce":'), source.replace('"oid":100', '"oid":100,"oid":100'), source.replace('"name":"auth"', '"name":"auth","name":"auth"')]) rejects(() => parseTargetSnapshotStartFrame(Buffer.from(value + "\n"), nonce), "FRAME_INVALID");
});
test("single complete strict UTF8 JSON line is required and errors never expose canaries", () => {
  const bytes = encode(frame());
  for (const candidate of [bytes.subarray(0, bytes.length - 1), Buffer.concat([bytes, bytes]), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]), Buffer.from(JSON.stringify(frame()) + "\r"), Buffer.from("{\"" + CANARY + "\":}\n"), Buffer.from("{} trailing " + CANARY + "\n"), Buffer.from("{}\n\n"), Buffer.from([0xc0, 0xaf, 10]), Buffer.alloc(0)]) rejects(() => parseTargetSnapshotStartFrame(candidate, nonce), "FRAME_INVALID");
});
test("size, token and depth caps apply before unbounded parsing or copying", () => {
  rejects(() => parseTargetSnapshotStartFrame(new Uint8Array(TARGET_SNAPSHOT_PROTOCOL_LIMITS.frameBytes + 1), nonce), "LIMIT_EXCEEDED");
  rejects(() => parseTargetSnapshotStartFrame(Buffer.from("[".repeat(14) + "0" + "]".repeat(14) + "\n"), nonce), "LIMIT_EXCEEDED");
  rejects(() => parseTargetSnapshotStartFrame(Buffer.from("[" + "0,".repeat(TARGET_SNAPSHOT_PROTOCOL_LIMITS.jsonTokens) + "0]\n"), nonce), "LIMIT_EXCEEDED");
});
test("input proxies, revoked proxies, SharedArrayBuffer, detach and nonbytes are refused without getter reads", () => {
  let traps = 0; const poison = new Proxy({}, { get() { traps++; throw Error(CANARY); }, getPrototypeOf() { traps++; throw Error(CANARY); } });
  const revoked = Proxy.revocable(new Uint8Array(1), {}); revoked.revoke();
  const detached = new Uint8Array(1); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  for (const candidate of [poison, revoked.proxy, new Uint8Array(new SharedArrayBuffer(2)), detached, {}, [], null, "{}"]) rejects(() => parseTargetSnapshotStartFrame(candidate, nonce), "INPUT_INVALID");
  assert.equal(traps, 0);
});
test("nonce, frame version, kind, database and actor identity are exact", () => {
  for (const [key, value] of [["nonce", "a".repeat(32)], ["version", 2], ["kind", "target-snapshot-end"], ["databaseName", "other"]]) { const f = frame(); f[key] = value; rejects(() => parse(f), "IDENTITY_REFUSED"); }
  for (const key of ["actor", "sessionActor"]) { const f = frame(); f[key] = "other"; rejects(() => parse(f), "ACTOR_REFUSED"); }
  rejects(() => parseTargetSnapshotStartFrame(encode(frame()), nonce + "a"), "INPUT_INVALID");
});
test("readonly, repeatable read, row_security off and bypass proof are individually mandatory", () => {
  for (const [key, value] of [["readOnly", false], ["isolation", "read committed"], ["readOnly", 1]]) { const f = frame(); f[key] = value; rejects(() => parse(f), "MODE_REFUSED"); }
  for (const [key, value] of [["rowSecurityOff", false], ["rlsBypass", false], ["rlsBypass", "true"]]) { const f = frame(); f[key] = value; rejects(() => parse(f), "RLS_REFUSED"); }
});
test("four-schema census fixes order, identities and absence of app_private", () => {
  for (const mutate of [f => f.schemas.reverse(), f => { f.schemas[1].oid = 10; }, f => { f.schemas[0].oid = null; }, f => f.schemas.pop(), f => { f.schemas[0].name = "AUTH"; }]) { const f = frame(); mutate(f); rejects(() => parse(f), "CATALOGUE_REFUSED"); }
  const f = frame(); f.schemas[3].oid = 40; rejects(() => parse(f), "SCOPE_REFUSED");
});
test("catalogue completeness, count and relation cap cannot be supplied as approximate facts", () => {
  for (const value of [false, null, 1]) { const f = frame(); f.catalogueComplete = value; rejects(() => parse(f), "LIMIT_EXCEEDED"); }
  for (const value of [-1, 0.5, 1001, Number.MAX_SAFE_INTEGER + 1]) { const f = frame(); f.catalogueCount = value; rejects(() => parse(f), "LIMIT_EXCEEDED"); }
  const f = frame(); f.catalogueCount--; rejects(() => parse(f), "CATALOGUE_REFUSED");
  const tooMany = frame(); tooMany.relations = Array.from({ length: 1001 }, (_, i) => row(100 + i, "auth", "table_" + i)); rejects(() => parse(tooMany), "CATALOGUE_REFUSED");
});
test("catalogue OIDs, namespace links, ordering and identities remain unique", () => {
  for (const mutate of [f => { f.relations[1].oid = 100; }, f => { f.relations[1].oid = 99; }, f => { f.relations[0].oid = 0; }, f => { f.relations[0].schemaOid = 20; }, f => { f.relations[1].name = "schema_migrations"; }, f => { f.relations[1].oid = 0x100000000; }]) { const f = frame(); mutate(f); rejects(() => parse(f), "CATALOGUE_REFUSED"); }
  const f = frame(); f.relations[1].schema = "foreign"; rejects(() => parse(f), "SCOPE_REFUSED");
});
test("catalogue identifiers are bounded UTF8 and quoted names remain metadata", () => {
  for (const value of ["", "a".repeat(64), "é".repeat(32), "with\nnewline", "a\0b", "a\ud800", null, 1]) { const f = frame(); f.relations[1].name = value; rejects(() => parse(f), "CATALOGUE_REFUSED"); }
  const f = frame(); f.relations[1].name = 'quoted "name; SELECT ' + CANARY; const parsed = parse(f); assert.equal(parsed.facts.allOtherTableDataEmpty, true); assert.equal(Object.hasOwn(parsed, "relations"), false);
  // Names remain data; only server-side format(%I) handles catalogue identifiers.
});
test("foreign, materialized, partitioned, inheritance and unknown relations are refused", () => {
  for (const kind of ["f", "m", "p", "I", "z", "", null]) { const f = frame(); f.relations[1].kind = kind; rejects(() => parse(f), "SCOPE_REFUSED"); }
  for (const key of ["isPartition", "hasInheritance", "extensionConfig"]) { const f = frame(); f.relations[1][key] = true; rejects(() => parse(f), "SCOPE_REFUSED"); }
  const f = frame(); f.relations[1].rowSecurityActive = true; rejects(() => parse(f), "RLS_REFUSED");
});
test("extension configuration and nonboolean metadata cannot disappear from the census", () => {
  for (const key of ["extensionMember", "extensionConfig", "isPartition", "hasInheritance", "rowSecurityActive"]) { const f = frame(); f.relations[0][key] = 0; rejects(() => parse(f), "CATALOGUE_REFUSED"); }
  const f = frame(); f.relations[4].extensionConfig = true; rejects(() => parse(f), "SCOPE_REFUSED");
});
test("every ordinary nonhistory table is checked, including extension members", () => {
  for (const [index, extensionMember] of [[1, false], [1, true], [3, false], [3, true]]) { const f = frame(); f.relations[index].extensionMember = extensionMember; f.relations[index].rows = 1; rejects(() => parse(f), "TARGET_NOT_EMPTY"); }
  const f = frame(); f.relations[1].rows = 0; f.relations[3].rows = 0; assert.equal(targetSnapshotPublicFacts(parse(f)).emptyDataTables, 2);
});
test("public application tables are refused even when zero, while extension members still require zero", () => {
  const f = frame(); f.relations.push(row(105, "public", "app_table")); f.catalogueCount++; rejects(() => parse(f), "SCOPE_REFUSED");
  f.relations.at(-1).extensionMember = true; assert.equal(targetSnapshotPublicFacts(parse(f)).emptyDataTables, 3);
  f.relations.at(-1).rows = 1; rejects(() => parse(f), "TARGET_NOT_EMPTY");
});
test("row counts are safe exact integers and metadata-only relations have null", () => {
  for (const value of [null, false, "0", -1, 0.1, Number.MAX_SAFE_INTEGER + 1]) { const f = frame(); f.relations[1].rows = value; rejects(() => parse(f), "CATALOGUE_REFUSED"); }
  for (const value of [0, "0", false]) { const f = frame(); f.relations[4].rows = value; rejects(() => parse(f), "CATALOGUE_REFUSED"); }
});
test("both migration histories are obligatory ordinary nonextension tables, without duplicates", () => {
  for (const index of [0, 2]) { const f = frame(); f.relations.splice(index, 1); f.catalogueCount--; rejects(() => parse(f), "HISTORY_REQUIRED"); }
  for (const kind of ["v", "S", "i"]) { const f = frame(); f.relations[0].kind = kind; f.relations[0].rows = null; rejects(() => parse(f), "HISTORY_REQUIRED"); }
  const f = frame(); f.relations[0].extensionMember = true; rejects(() => parse(f), "HISTORY_REQUIRED");
});
test("history rows may be zero but cannot exceed the shared parser limit", () => {
  const f = frame(); f.relations[0].rows = 0; f.relations[2].rows = 10000; assert.equal(targetSnapshotPublicFacts(parse(f)).storageHistoryRows, 10000);
  f.relations[2].rows = 10001; rejects(() => parse(f), "LIMIT_EXCEEDED");
});
test("snapshot IDs use the native bounded grammar and are never a project identity", () => {
  for (const value of [null, "", "00000003-0000001b-1", "3-1B-1", "00000003-0000001B-0", "00000003-0000001B-1\n", "postgres;" + CANARY]) { const f = frame(); f.snapshotId = value; rejects(() => parse(f), "FRAME_INVALID"); }
});
test("end frame binds the same nonce and is an ACK only, never a native completion receipt", () => {
  const bytes = encode(end()), result = parseTargetSnapshotEndFrame(bytes, nonce);
  assert.equal(Object.isFrozen(result), true); assert.equal(result.committed, true); assert.equal(result.frameSha256, createHash("sha256").update(bytes).digest("hex"));
  rejects(() => targetSnapshotPublicFacts(result), "START_REQUIRED");
  for (const mutate of [f => { f.nonce = "f".repeat(32); }, f => { f.kind = "target-snapshot-start"; }]) { const f = end(); mutate(f); rejects(() => parseTargetSnapshotEndFrame(encode(f), nonce), "IDENTITY_REFUSED"); }
  const wrongActor = end(); wrongActor.actor = "other"; rejects(() => parseTargetSnapshotEndFrame(encode(wrongActor), nonce), "ACTOR_REFUSED");
  const f = end(); f.committed = false; rejects(() => parseTargetSnapshotEndFrame(encode(f), nonce), "END_REFUSED");
  const extra = end(); extra.extra = CANARY; rejects(() => parseTargetSnapshotEndFrame(encode(extra), nonce), "FRAME_INVALID");
  rejects(() => parseTargetSnapshotEndFrame(encode(frame()), nonce), "FRAME_INVALID");
});
