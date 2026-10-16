import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inspect } from "node:util";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { planManagedRestore } from "../../scripts/operations/restore-managed-plan.mjs";
import { extractCustomArchiveToc, customArchiveTocFacts, discardCustomArchiveToc } from "../../scripts/operations/restore-custom-toc.mjs";
import * as historyModule from "../../scripts/operations/restore-migration-history.mjs";

// Independent public synthetic wire vectors. No subprocess, SQL execution,
// archive/profile, service, credential, environment or IO port is involved.
const { migrationHistoryCopySelection, extractMigrationHistory, migrationHistoryFacts, discardMigrationHistory, migrationHistoryDiagnostic, MIGRATION_HISTORY_ERROR_CODES, MIGRATION_HISTORY_DIAGNOSTIC_RULES } = historyModule;
const canary = "PRIVATE_HISTORY_CANARY", cap = 4 * 1024 * 1024;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const code = suffix => "RESTORE_MIGRATION_HISTORY_" + suffix;
const reject = (fn, suffix, readDiagnostic = migrationHistoryDiagnostic) => assert.throws(fn, error => {
  assert.equal(error instanceof BackupError, true); assert.equal(error.code, code(suffix)); assert.equal(error.message, code(suffix));
  assert.equal(MIGRATION_HISTORY_ERROR_CODES.includes(error.code), true); assert.equal(Object.hasOwn(error, "cause"), false);
  const diagnostic = readDiagnostic(error);
  assert.deepEqual(Object.keys(diagnostic), ["version", "phase", "rule"]); assert.equal(diagnostic.version, 1); assert.equal(Object.isFrozen(diagnostic), true);
  assert.equal(Object.hasOwn(MIGRATION_HISTORY_DIAGNOSTIC_RULES, diagnostic.phase), true);
  assert.equal(MIGRATION_HISTORY_DIAGNOSTIC_RULES[diagnostic.phase].includes(diagnostic.rule), true);
  for (const value of [JSON.stringify(diagnostic), inspect(diagnostic)]) assert.equal(value.includes(canary), false);
  for (const value of [error.stack, JSON.stringify(error), inspect(error)]) assert.equal(value.includes(canary), false);
  return true;
});
const PREAMBLE = "--\n-- PostgreSQL database dump\n--\n\n\\restrict SCBaselineV1\n\n" +
  "-- Dumped from database version 17.6\n-- Dumped by pg_dump version 18.4\n\n" +
  "SET statement_timeout = 0;\nSET lock_timeout = 0;\nSET idle_in_transaction_session_timeout = 0;\nSET transaction_timeout = 0;\n" +
  "SET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSELECT pg_catalog.set_config('search_path', '', false);\n" +
  "SET check_function_bodies = false;\nSET xmloption = content;\nSET client_min_messages = warning;\nSET row_security = off;\n\n";
const AUTH_COMMENT = "--\n-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin\n--\n\n";
const STORAGE_COMMENT = "--\n-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin\n--\n\n";
const AUTH_COPY = "COPY auth.schema_migrations (version) FROM stdin;\n";
const STORAGE_COPY = "COPY storage.migrations (id, name, hash, executed_at) FROM stdin;\n";
const EPILOGUE = "--\n-- PostgreSQL database dump complete\n--\n\n\\unrestrict SCBaselineV1\n\n";
const STORAGE_ROW = "3\tcreate_buckets\t0123456789abcdef0123456789abcdef01234567\t\\N\n";
function script(options = {}) {
  const auth = (options.authComment ?? AUTH_COMMENT) + (options.authCopy ?? AUTH_COPY) + (options.auth ?? "20240101\n20240202\n") + "\\.\n\n\n";
  const storage = (options.storageComment ?? STORAGE_COMMENT) + (options.storageCopy ?? STORAGE_COPY) + (options.storage ?? STORAGE_ROW) + "\\.\n\n\n";
  return Buffer.from((options.preamble ?? PREAMBLE) + (options.reverse ? storage + auth : auth + storage) + (options.epilogue ?? EPILOGUE));
}

// Hand-authored PGDMP 1.16-0/int4/off8/CUSTOM/GZIP header and a record writer
// independent of the B3 parser. This complete graph satisfies the existing
// genuine planner; histories have deliberately different IDs (not comments).
const HEADER = Buffer.from("5047444d5001100004080101" +
  "0017000000002a000000000f00000000100000000009000000007e0000000000000000" +
  "0008000000706f737467726573000400000031372e36000400000031382e34", "hex");
const integer = value => { const bytes = Buffer.alloc(5); bytes[0] = value < 0 ? 1 : 0; bytes.writeUInt32LE(Math.abs(value), 1); return bytes; };
const string = value => value === null ? integer(-1) : (() => { const bytes = typeof value === "string" ? Buffer.from(value) : value; return Buffer.concat([integer(bytes.length), bytes]); })();
function original(options = {}) {
  const rows = [
    [18,"ENCODING","-","ENCODING","",[]], [19,"STDSTRINGS","-","STDSTRINGS","",[]], [20,"SEARCHPATH","-","SEARCHPATH","",[]],
    [1,"SCHEMA","-","auth","supabase_auth_admin",[]], [2,"SCHEMA","-","storage","supabase_storage_admin",[]], [3,"SCHEMA","-","app_private","postgres",[]],
    [4,"TABLE","auth","users","supabase_auth_admin",[1]], [5,"TABLE","storage","objects","supabase_storage_admin",[2]], [6,"TABLE","storage","buckets","supabase_storage_admin",[2]],
    [7,"FUNCTION","app_private","on_auth_user_created()","postgres",[3]], [8,"FUNCTION","app_private","check_admin_auth_creation_final()","postgres",[3,4]],
    [9,"TABLE DATA","auth","users","supabase_auth_admin",[4]], [10,"TABLE DATA","storage","objects","supabase_storage_admin",[5]], [11,"TABLE DATA","storage","buckets","supabase_storage_admin",[6]],
    [12,"TABLE","public","profiles","postgres",[4]], [13,"TABLE DATA","public","profiles","postgres",[12]],
    [14,"TRIGGER","auth","users second_brain_identity_created","postgres",[4,7]], [15,"TRIGGER","auth","users second_brain_admin_creation_final","postgres",[4,8]],
    [16,"POLICY","storage","objects second_brain_private_objects","supabase_storage_admin",[5]], [17,"POLICY","storage","buckets second_brain_private_buckets","supabase_storage_admin",[6]],
    [21,"TABLE","auth","schema_migrations","supabase_auth_admin",[1]], [22,"TABLE DATA","auth","schema_migrations","supabase_auth_admin",[21]],
    [23,"TABLE","storage","migrations","supabase_storage_admin",[2]], [24,"TABLE DATA","storage","migrations","supabase_storage_admin",[23]],
  ].map(([id,kind,schema,tag,owner,dependencies]) => ({ id,kind,schema,tag,owner,dependencies }));
  if (options.reverse) { const index = rows.findIndex(row => row.id === 22); rows.push(...rows.splice(index, 1)); }
  if (options.extra) rows.push({id:25,kind:"TABLE DATA",schema:"auth",tag:"extra_history",owner:"supabase_auth_admin",dependencies:[4]});
  const overrides = options.overrides ?? {};
  const native = rows.map(row => ({...row,...overrides[row.id]}));
  const toc = ";     TOC Entries: " + rows.length + "\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n" +
    native.map(row => `${row.id}; 0 0 ${row.kind} ${row.schema} ${row.tag} ${row.owner}\n` + (row.dependencies.length ? ";\tdepends on: " + row.dependencies.join(" ") + "\n" : "")).join("");
  const parts = [HEADER, integer(rows.length)];
  for (const row of native) {
    const data = row.kind === "TABLE DATA", override = overrides[row.id] ?? {};
    const definition = row.id === 18 ? "SET client_encoding = 'UTF8';\n" : row.id === 19 ? "SET standard_conforming_strings = 'on';\n" : row.id === 20 ? "SELECT pg_catalog.set_config('search_path', '', false);\n" : null;
    const fields = {tag:row.tag,kind:row.kind,namespace:row.schema === "-" ? null : row.schema,definition,dropStatement:null,
      copyStatement:data ? row.id === 22 ? AUTH_COPY : row.id === 24 ? STORAGE_COPY : "COPY public.synthetic (value) FROM stdin;\n" : null,
      tablespace:null,tableAccessMethod:null,relationKind:row.kind === "TABLE" ? 114 : 0,sectionCode:data ? 3 : ["TRIGGER","POLICY"].includes(row.kind) ? 4 : ["COMMENT","ACL"].includes(row.kind) ? 1 : 2,owner:row.owner,withOids:"false",...override};
    parts.push(integer(row.id),integer(data ? 1 : 0),string("0"),string("0"),string(fields.tag),string(fields.kind),integer(fields.sectionCode));
    for (const key of ["definition","dropStatement","copyStatement","namespace","tablespace","tableAccessMethod"]) parts.push(string(fields[key]));
    parts.push(integer(fields.relationKind),string(fields.owner),string(fields.withOids));
    for (const dependency of row.dependencies) parts.push(string(String(dependency)));
    parts.push(integer(-1),Buffer.from([data ? 1 : 3]),Buffer.alloc(8));
  }
  parts.push(Buffer.from([0xff,0xfe,0x00,0x80]));
  const database = Buffer.concat(parts), plan = planManagedRestore(toc,{archiveSha256:"a".repeat(64),databaseSha256:hash(database),databaseBytes:database.length});
  const handle = extractCustomArchiveToc(plan,database); return {handle,database,toc,plan,facts:customArchiveTocFacts(handle)};
}
function extracted(options = {}, sourceOptions = {}) {
  const source = original(sourceOptions), stdout = script(options), handle = extractMigrationHistory(source.handle,stdout);
  return {source,stdout,handle,facts:migrationHistoryFacts(handle)};
}
function refuseScript(value, suffix = "FORMAT_UNSUPPORTED", source = original()) { reject(() => extractMigrationHistory(source.handle,value),suffix); discardCustomArchiveToc(source.handle); }
function diagnosed(fn, suffix, phase, rule) {
  let failure;
  try { fn(); } catch (error) { failure = error; }
  assert.notEqual(failure, undefined); reject(() => { throw failure; }, suffix);
  assert.deepEqual(migrationHistoryDiagnostic(failure), { version: 1, phase, rule }); return failure;
}

test("closed nominal API retains exact original IDs, bytes, rows and source references without subprocess authority", () => {
  assert.deepEqual(Object.keys(historyModule).sort(),["MIGRATION_HISTORY_DIAGNOSTIC_RULES","MIGRATION_HISTORY_ERROR_CODES","discardMigrationHistory","extractMigrationHistory","migrationHistoryCopySelection","migrationHistoryDiagnostic","migrationHistoryFacts"]);
  assert.equal(MIGRATION_HISTORY_ERROR_CODES.length,9); assert.equal(Object.isFrozen(MIGRATION_HISTORY_ERROR_CODES),true);
  const {source,stdout,handle,facts} = extracted();
  assert.deepEqual(migrationHistoryCopySelection(source.handle),[22,24]); assert.equal(Object.isFrozen(migrationHistoryCopySelection(source.handle)),true);
  assert.deepEqual(handle,{}); assert.equal(Object.isFrozen(handle),true); assert.equal(JSON.stringify(handle),"{}");
  assert.equal(migrationHistoryFacts(handle),facts); assert.equal(facts.binding,source.facts.binding); assert.equal(facts.stdoutSha256,hash(stdout)); assert.equal(facts.stdoutBytes,stdout.length);
  assert.deepEqual(facts.history,{auth:[{version:"20240101"},{version:"20240202"}],storage:[{id:3,name:"create_buckets",hash:"0123456789abcdef0123456789abcdef01234567",executed_at:null}]});
  assert.equal(Object.isFrozen(facts.history.auth[0]),true); assert.equal(Object.isFrozen(facts.blocks[1].rows),true);
  assert.equal(facts.blocks[0].sourceRecord,source.facts.records.find(row=>row.dumpId===22)); assert.equal(facts.blocks[1].sourceRecord,source.facts.records.find(row=>row.dumpId===24));
  assert.deepEqual(facts.blocks[1].columns,["id","name","hash","executed_at"]);
  for (const block of facts.blocks) {
    assert.deepEqual(Buffer.from(facts.sourceBytes.subarray(block.header.start,block.header.start+block.header.length)),Buffer.from(block.sourceRecord.copyStatement));
    assert.equal(Buffer.from(facts.sourceBytes.subarray(block.terminator.start,block.terminator.start+block.terminator.length)).toString(),"\\.\n");
  }
  assert.notEqual(facts.sourceBytes.buffer,stdout.buffer); assert.notEqual(facts.sourceBytes.buffer,source.facts.records[0].definition.buffer);
  assert.equal(facts.sourceBytes.buffer.byteLength,stdout.length); assert.equal(discardMigrationHistory(handle),true); assert.equal(discardCustomArchiveToc(source.handle),true);
});

test("retains physical order rather than sorting histories or borrowing caller bytes; total discard wipes only owned raw bytes", () => {
  const context = extracted({auth:"b\na\n",storage:STORAGE_ROW+"1\tolder\tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\t2026-10-16 10:00:00\n"});
  assert.deepEqual(context.facts.history.auth.map(row=>row.version),["b","a"]); assert.deepEqual(context.facts.history.storage.map(row=>row.id),[3,1]);
  const before = Buffer.from(context.facts.sourceBytes); context.stdout.fill(0); assert.deepEqual(Buffer.from(context.facts.sourceBytes),before);
  const own = context.facts.sourceBytes, savedVersion = context.facts.history.auth[0].version;
  assert.equal(discardMigrationHistory(context.handle),true); assert.equal(own.every(byte=>byte===0),true); assert.equal(savedVersion,"b");
  assert.equal(discardMigrationHistory(context.handle),false); reject(()=>migrationHistoryFacts(context.handle),"DISCARDED");
  assert.equal(customArchiveTocFacts(context.source.handle),context.source.facts); discardCustomArchiveToc(context.source.handle);
});

test("forged handles, Proxy/getters, SharedArrayBuffer, non-byte types and detached inputs refuse without traps", () => {
  const source = original(), raw = script(); let traps = 0;
  const revoked = Proxy.revocable({},{}); revoked.revoke();
  const proxy = new Proxy({}, {get(){traps++;throw Error(canary);},ownKeys(){traps++;throw Error(canary);}});
  for (const fake of [null,undefined,{},structuredClone(source.handle),Object.create(source.handle),proxy,revoked.proxy]) {
    reject(()=>migrationHistoryCopySelection(fake),"TOC_REQUIRED"); reject(()=>extractMigrationHistory(fake,raw),"TOC_REQUIRED");
    reject(()=>migrationHistoryFacts(fake),"REQUIRED"); assert.equal(discardMigrationHistory(fake),false);
  }
  const fake = {get byteLength(){traps++;throw Error(canary);},get buffer(){traps++;throw Error(canary);},get [Symbol.toStringTag](){traps++;throw Error(canary);}};
  const wrapped = new Proxy(raw,{get(){traps++;throw Error(canary);},getPrototypeOf(){traps++;throw Error(canary);}});
  const detached = Uint8Array.from(raw); structuredClone(detached,{transfer:[detached.buffer]});
  for (const input of [undefined,null,[],raw.toString(),raw.buffer,new DataView(raw.buffer),new Int8Array(raw.length),new Uint8ClampedArray(raw),fake,wrapped,revoked.proxy,new Uint8Array(new SharedArrayBuffer(raw.length)),detached]) reject(()=>extractMigrationHistory(source.handle,input),"INPUT_INVALID");
  const genuine = Uint8Array.from(raw);
  for (const name of ["byteLength","byteOffset","buffer"]) Object.defineProperty(genuine,name,{get(){traps++;throw Error(canary);}});
  Object.defineProperty(genuine,Symbol.toStringTag,{get(){traps++;throw Error(canary);}});
  genuine.set = () => {traps++;throw Error(canary);};
  const handle = extractMigrationHistory(source.handle,genuine); assert.equal(traps,0); discardMigrationHistory(handle); discardCustomArchiveToc(source.handle);
});

test("every getter revalidates the original TOC; discard or mutation invalidates history and wipes its store", () => {
  for (const mutate of [source=>discardCustomArchiveToc(source.handle),source=>{source.facts.records[0].definition[0]^=1;}]) {
    const context = extracted(), own = context.facts.sourceBytes; mutate(context.source);
    reject(()=>migrationHistoryFacts(context.handle),"BINDING_INVALID"); assert.equal(own.every(byte=>byte===0),true);
    reject(()=>migrationHistoryFacts(context.handle),"DISCARDED"); assert.equal(discardMigrationHistory(context.handle),false);
  }
  const source = original(); source.facts.records[0].definition[0]^=1; reject(()=>extractMigrationHistory(source.handle,script()),"TOC_REQUIRED");
});

test("own byte drift and transfer refuse without accepting a copied facts object or erasing external copies", () => {
  const changed = extracted(), bytes = changed.facts.sourceBytes, clone = Uint8Array.from(bytes); bytes[0]^=1;
  reject(()=>migrationHistoryFacts(changed.handle),"BINDING_INVALID"); assert.equal(bytes.every(byte=>byte===0),true); assert.equal(clone[0],45);
  reject(()=>migrationHistoryFacts(structuredClone(changed.handle)),"REQUIRED"); discardCustomArchiveToc(changed.source.handle);
  const transferred = extracted(), moved = structuredClone(transferred.facts.sourceBytes,{transfer:[transferred.facts.sourceBytes.buffer]});
  reject(()=>migrationHistoryFacts(transferred.handle),"DISCARDED"); assert.equal(moved[0],45); assert.equal(discardMigrationHistory(transferred.handle),false); discardCustomArchiveToc(transferred.source.handle);
});

test("NULL is recognized before escape decoding; escaped NULL and SQL/meta-looking strings remain ordinary data", () => {
  const context = extracted({auth:"\\\\N\n-- not a comment\n\\\\unrestrict SCBaselineV1\nCOPY evil FROM stdin;\n",storage:STORAGE_ROW+"4\tliteral_null\tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\t\\\\N\n"});
  assert.deepEqual(context.facts.history.auth.map(row=>row.version),["\\N","-- not a comment","\\unrestrict SCBaselineV1","COPY evil FROM stdin;"]);
  assert.equal(context.facts.history.storage[0].executed_at,null); assert.equal(context.facts.history.storage[1].executed_at,"\\N");
  discardMigrationHistory(context.handle); discardCustomArchiveToc(context.source.handle);
  refuseScript(script({auth:"\\N\n"}),"INVALID");
});

test("COPY text decodes octal/hex, unknown escapes, escaped delimiters, UTF8 and doubled slash-dot byte-exactly", () => {
  const context = extracted({auth:"\\101\\x42\\q\\xZ\\t\\b\\f\\n\\r\\v\\\\.\n\\303\\251\n\\xc3\\xa9suffix\n"});
  assert.deepEqual(context.facts.history.auth.map(row=>row.version),["ABqxZ\t\b\f\n\r\v\\.","é","ésuffix"]);
  discardMigrationHistory(context.handle); discardCustomArchiveToc(context.source.handle);
  for (const payload of ["\\400\n","\\000\n","\\x00\n","\\777\n","\\xc0\\xaf\n","\\xed\\xa0\\x80\n","\\xf4\\x90\\x80\\x80\n","\\xe2\\x82\n","x\\.\n","\\.suffix\n"]) refuseScript(script({auth:payload}),"INVALID");
  refuseScript(Buffer.concat([Buffer.from(PREAMBLE+AUTH_COMMENT+AUTH_COPY),Buffer.from([0xff,10]),Buffer.from("\\.\n\n\n"+STORAGE_COMMENT+STORAGE_COPY+STORAGE_ROW+"\\.\n\n\n"+EPILOGUE)]),"INVALID");
});

test("escaped physical LF/CR stay in one logical row with original spans; unescaped CRLF is never normalized", () => {
  const raw = "first\\\nsecond\\\rthird\n", context = extracted({auth:raw});
  assert.equal(context.facts.history.auth[0].version,"first\nsecond\rthird");
  const row = context.facts.blocks[0].rows[0]; assert.equal(row.lastLine,row.firstLine+1);
  assert.equal(Buffer.from(context.facts.sourceBytes.subarray(row.bytes.start,row.bytes.start+row.bytes.length)).toString(),raw.slice(0,-1));
  discardMigrationHistory(context.handle); discardCustomArchiveToc(context.source.handle);
  refuseScript(script({auth:"one\r\n"}),"INVALID"); refuseScript(Buffer.from(script().toString().replaceAll("\n","\r\n")),"FORMAT_UNSUPPORTED");
});

test("column mapping follows the exact original COPY order and original TOC order, including quoted identifiers", () => {
  const reordered = "COPY storage.migrations (executed_at, hash, name, id) FROM stdin;\n", quoted = 'COPY "auth"."schema_migrations" ("version") FROM stdin;\n';
  const context = extracted({storageCopy:reordered,storage:"\\N\t0123456789abcdef0123456789abcdef01234567\treordered\t8\n",authCopy:quoted,reverse:true},{reverse:true,overrides:{22:{copyStatement:quoted},24:{copyStatement:reordered}}});
  assert.deepEqual(migrationHistoryCopySelection(context.source.handle),[24,22]); assert.deepEqual(context.facts.blocks.map(block=>block.kind),["storage","auth"]);
  assert.deepEqual(context.facts.history.storage,[{executed_at:null,hash:"0123456789abcdef0123456789abcdef01234567",name:"reordered",id:8}]);
  discardMigrationHistory(context.handle); discardCustomArchiveToc(context.source.handle);
  refuseScript(script({storageCopy:reordered}),"FORMAT_UNSUPPORTED"); refuseScript(script({reverse:true}),"FORMAT_UNSUPPORTED");
});

test("headers reject options, different tables, direction, duplicate/new/missing columns and non-COPY originals", () => {
  for (const copy of ["COPY auth.schema_migrations (version, extra) FROM stdin;\n","COPY public.schema_migrations (version) FROM stdin;\n","COPY auth.schema_migrations (version) TO stdout;\n","COPY auth.schema_migrations (version) FROM stdin WITH CSV;\n","COPY auth.schema_migrations (version) FROM stdin;\nSELECT 1;\n",null]) {
    const source = original({overrides:{22:{copyStatement:copy}}}); reject(()=>migrationHistoryCopySelection(source.handle),"FORMAT_UNSUPPORTED"); reject(()=>extractMigrationHistory(source.handle,script()),"FORMAT_UNSUPPORTED"); discardCustomArchiveToc(source.handle);
  }
  for (const columns of ["id, name, hash, hash","id, name, hash","id, name, hash, executed_at, extra"]) {
    const source = original({overrides:{24:{copyStatement:"COPY storage.migrations ("+columns+") FROM stdin;\n"}}}); reject(()=>migrationHistoryCopySelection(source.handle),"FORMAT_UNSUPPORTED"); discardCustomArchiveToc(source.handle);
  }
});

test("only the fixed native envelope and matching nominal comments/versions qualify; no foreign metadata or epilogue", () => {
  const base = script().toString();
  for (const value of ["\ufeff"+base,base.replace("\\restrict SCBaselineV1","\\restrict other"),base.replace("SET row_security = off;","SET row_security = on;"),base.replace(AUTH_COMMENT,AUTH_COMMENT+"-- forged extra comment\n"),base.replace("Owner: supabase_auth_admin","Owner: another_owner"),base.replace("-- Dumped from database version 17.6","-- Dumped from database version 17.7"),base.replace(AUTH_COPY,"\\connect postgres\n"+AUTH_COPY),base.replace(AUTH_COPY,"BEGIN;\n"+AUTH_COPY),base.replace("\\unrestrict SCBaselineV1","\\unrestrict other"),base+"SELECT 1;\n",base+"\n",base.replace(AUTH_COMMENT,"-- TOC entry 22 (class 0 OID 0)\n"+AUTH_COMMENT)]) refuseScript(Buffer.from(value));
});

test("both blocks and terminators are complete exactly once; prefixes and unexpected bytes never produce partial facts", () => {
  const base = script().toString();
  for (const value of [base.replace(AUTH_COMMENT+AUTH_COPY+"20240101\n20240202\n\\.\n\n\n",""),base.replace(STORAGE_COMMENT+STORAGE_COPY+STORAGE_ROW+"\\.\n\n\n",""),base.replace(STORAGE_COMMENT,AUTH_COMMENT),base.replace(EPILOGUE,AUTH_COMMENT+AUTH_COPY+"\\.\n\n\n"+EPILOGUE)]) refuseScript(Buffer.from(value));
  for (const length of [0,1,20,PREAMBLE.length,PREAMBLE.length+AUTH_COMMENT.length,base.indexOf("20240101")+5,base.indexOf("\\.\n")+1,base.length-1]) refuseScript(Buffer.from(base.slice(0,length)),"TRUNCATED");
  refuseScript(Buffer.from(PREAMBLE+AUTH_COMMENT+AUTH_COPY+"dangling\\"),"TRUNCATED");
});

test("history shape, uniqueness, exact fields, canonical safe id and hash are validated without dropping timestamps", () => {
  for (const options of [{auth:"duplicate\nduplicate\n"},{auth:"\n"},{auth:"one\ttwo\n"},{storage:STORAGE_ROW+STORAGE_ROW},{storage:STORAGE_ROW+"4\tcreate_buckets\tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\t\\N\n"},{storage:"0\t\tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\t\\N\n"},{storage:"3\tname\tbad_hash\t\\N\n"},{storage:"3\tname\tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\t\\N\textra\n"}]) refuseScript(script(options),"INVALID");
  for (const id of ["-1","+1","01","1.0","1e0"," 1","9007199254740992","\\N"]) refuseScript(script({storage:id+"\tname\tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\t\\N\n"}),"INVALID");
  const context = extracted({storage:"9007199254740991\tname\tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\t\n"}); assert.equal(context.facts.history.storage[0].id,Number.MAX_SAFE_INTEGER); assert.equal(context.facts.history.storage[0].executed_at,""); discardMigrationHistory(context.handle); discardCustomArchiveToc(context.source.handle);
});

test("STDSTRINGS off and an original literal SEARCHPATH are qualified without executing or normalizing its content", () => {
  const search = "SELECT pg_catalog.set_config('search_path', E'public, \\'odd\\'', false);\n";
  const preamble = PREAMBLE.replace("standard_conforming_strings = on","standard_conforming_strings = off").replace("SELECT pg_catalog.set_config('search_path', '', false);\n",search).replace("SET row_security", "SET escape_string_warning = off;\nSET row_security");
  const context = extracted({preamble},{overrides:{19:{definition:"SET standard_conforming_strings = 'off';\n"},20:{definition:search}}}); discardMigrationHistory(context.handle); discardCustomArchiveToc(context.source.handle);
  for (const definition of ["SELECT pg_catalog.set_config('search_path', current_setting('search_path'), false);\n","SELECT pg_catalog.set_config('search_path', '', false);\nSELECT 1;\n","SELECT pg_catalog.set_config('search_path', '' || '', false);\n"]) {
    const source = original({overrides:{20:{definition}}}); reject(()=>migrationHistoryCopySelection(source.handle),"FORMAT_UNSUPPORTED"); discardCustomArchiveToc(source.handle);
  }
  const absent = original({overrides:{20:{kind:"COMMENT",tag:"SCHEMA auth"}}}); reject(()=>migrationHistoryCopySelection(absent.handle),"FORMAT_UNSUPPORTED"); discardCustomArchiveToc(absent.handle);
});

test("input, decoded strings, row count, envelope and nominal COPY bounds refuse before exceeding their separate caps", () => {
  const source = original(); reject(()=>extractMigrationHistory(source.handle,new Uint8Array(20*1024*1024+1)),"LIMIT_EXCEEDED");
  refuseScript(script({auth:"a".repeat(cap)+"\n"}),"LIMIT_EXCEEDED");
  refuseScript(script({auth:Array.from({length:10001},(_,i)=>"v"+i+"\n").join(""),storage:""}),"LIMIT_EXCEEDED");
  const longCopy = original({overrides:{22:{copyStatement:"COPY auth.schema_migrations ("+"v".repeat(1024)+") FROM stdin;\n"}}}); reject(()=>migrationHistoryCopySelection(longCopy.handle),"LIMIT_EXCEEDED"); discardCustomArchiveToc(longCopy.handle);
  const hugeOwner = "x".repeat(65537), owner = original({overrides:{22:{owner:hugeOwner}}}); reject(()=>extractMigrationHistory(owner.handle,script()),"LIMIT_EXCEEDED"); discardCustomArchiveToc(owner.handle);
  discardCustomArchiveToc(source.handle);
});

test("10,000 complete rows qualify at the cumulative boundary and empty complete histories remain represented", () => {
  const context = extracted({auth:Array.from({length:10000},(_,i)=>"v"+i+"\n").join(""),storage:""});
  assert.equal(context.facts.history.auth.length,10000); assert.equal(context.facts.history.storage.length,0); assert.equal(context.facts.blocks[1].rows.length,0);
  discardMigrationHistory(context.handle); discardCustomArchiveToc(context.source.handle);
  const empty = extracted({auth:"",storage:""}); assert.deepEqual(empty.facts.history,{auth:[],storage:[]}); discardMigrationHistory(empty.handle); discardCustomArchiveToc(empty.source.handle);
});

test("late synthetic source mutation refuses and wipes both allocated stores without leaking provider text", async () => {
  const source = original(), stdout = script(), OriginalStore = globalThis.ArrayBuffer, stores = [];
  class ProbeStore extends OriginalStore { constructor(length) { super(length); stores.push(this); if (stores.length === 1) stdout[stdout.indexOf("20240101")]^=1; } }
  let fresh; globalThis.ArrayBuffer = ProbeStore;
  try { fresh = await import(new URL("../../scripts/operations/restore-migration-history.mjs?late-synthetic-binding",import.meta.url).href); }
  finally { globalThis.ArrayBuffer = OriginalStore; }
  assert.equal(stores.length,0);
  reject(()=>fresh.extractMigrationHistory(source.handle,stdout),"BINDING_INVALID",fresh.migrationHistoryDiagnostic);
  assert.equal(stores.length,2); for (const store of stores) assert.equal(new Uint8Array(store).every(byte=>byte===0),true);
  discardCustomArchiveToc(source.handle);
});

test("diagnostic vocabulary and nominal first refusal are frozen, closed and never read provider getters", () => {
  assert.deepEqual(Object.keys(MIGRATION_HISTORY_DIAGNOSTIC_RULES), ["input","profile","preamble","block_comment","copy_header","row","separator","footer","binding"]);
  assert.equal(Object.isFrozen(MIGRATION_HISTORY_DIAGNOSTIC_RULES), true);
  for (const [phase, rules] of Object.entries(MIGRATION_HISTORY_DIAGNOSTIC_RULES)) {
    assert.match(phase, /^[a-z_]+$/); assert.equal(Object.isFrozen(rules), true); assert.equal(new Set(rules).size, rules.length);
    for (const rule of rules) assert.match(rule, /^[a-z_]+$/);
    assert.throws(() => rules.push(canary), TypeError);
  }
  assert.throws(() => { MIGRATION_HISTORY_DIAGNOSTIC_RULES[canary] = []; }, TypeError);
  const source = original();
  const failure = diagnosed(() => extractMigrationHistory(source.handle, script({ auth:canary+"\r\n" })), "INVALID", "row", "line_scan");
  const diagnostic = migrationHistoryDiagnostic(failure); let traps = 0;
  const fake = { get code(){traps++;throw Error(canary);}, get phase(){traps++;throw Error(canary);}, get rule(){traps++;throw Error(canary);}, get diagnostic(){traps++;throw Error(canary);} };
  const proxy = new Proxy(failure, { get(){traps++;throw Error(canary);}, getPrototypeOf(){traps++;throw Error(canary);}, ownKeys(){traps++;throw Error(canary);} });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  const provider = new BackupError(code("FORMAT_UNSUPPORTED"));
  Object.assign(provider, { diagnostic, phase:"row", rule:"line_scan" });
  for (const value of [null,undefined,1,"x",Symbol("x"),{},fake,proxy,revoked.proxy,provider,new Error(code("INVALID")),Object.create(failure),structuredClone(failure),JSON.parse(JSON.stringify(failure)),JSON.parse(JSON.stringify(diagnostic))]) assert.equal(migrationHistoryDiagnostic(value), null);
  Object.defineProperty(failure, "diagnostic", { get(){traps++;throw Error(canary);} });
  Object.defineProperty(failure, "code", { get(){traps++;throw Error(canary);} });
  assert.equal(migrationHistoryDiagnostic(failure), diagnostic); assert.equal(traps, 0);
  assert.throws(() => { diagnostic.phase = canary; }, TypeError);
  diagnosed(() => extractMigrationHistory(source.handle, Buffer.concat([script(),Buffer.from(canary)])), "FORMAT_UNSUPPORTED", "footer", "trailing_bytes");
  const handle = extractMigrationHistory(source.handle, script()); discardMigrationHistory(handle);
  assert.equal(migrationHistoryDiagnostic(failure), diagnostic);
  assert.deepEqual(diagnostic, { version:1, phase:"row", rule:"line_scan" });
  discardCustomArchiveToc(source.handle);
});

test("profile refusals distinguish public nominal rules before stdout without widening COPY or SEARCHPATH", () => {
  const cases = [
    [{22:{copyStatement:null}},"copy_statement"],
    [{22:{copyStatement:"SELECT "+canary+";\n"}},"copy_lexical"],
    [{22:{copyStatement:"COPY public.schema_migrations (version) FROM stdin;\n"}},"copy_schema"],
    [{22:{copyStatement:"COPY auth.other_history (version) FROM stdin;\n"}},"copy_table"],
    [{22:{copyStatement:"COPY auth.schema_migrations (version, extra) FROM stdin;\n"}},"copy_columns"],
    [{22:{copyStatement:"COPY auth.schema_migrations (version) FROM stdin WITH CSV;\n"}},"copy_lexical"],
    [{19:{definition:"SET standard_conforming_strings = 'invalid';\n"}},"standard_strings_definition"],
    [{20:{definition:"SELECT "+canary+";\n"}},"search_path_definition"],
    [{20:{kind:"COMMENT",tag:"SCHEMA auth"}},"search_path_entry"],
    [{22:{tablespace:canary}},"data_tablespace"],
    [{22:{tableAccessMethod:canary}},"data_access_method"],
    [{22:{definition:canary}},"data_definition"],
  ];
  for (const [overrides, rule] of cases) {
    const source = original({overrides});
    const preIo = diagnosed(() => migrationHistoryCopySelection(source.handle), "FORMAT_UNSUPPORTED", "profile", rule);
    const diagnostic = migrationHistoryDiagnostic(preIo);
    diagnosed(() => extractMigrationHistory(source.handle, null), "FORMAT_UNSUPPORTED", "profile", rule);
    assert.equal(migrationHistoryDiagnostic(preIo), diagnostic);
    discardCustomArchiveToc(source.handle);
  }
});

test("each fixed envelope phase distinguishes mismatch from genuine truncation without recording bytes", () => {
  const source = original(), base = script().toString();
  const cases = [
    [base.replace("\\restrict SCBaselineV1","\\restrict other"),"preamble","banner_restrict"],
    [base.replace("-- Dumped from database version 17.6","-- Dumped from database version 17.7"),"preamble","database_version"],
    [base.replace("-- Dumped by pg_dump version 18.4","-- Dumped by pg_dump version 18.5"),"preamble","producer_version"],
    [base.replace("SET statement_timeout = 0;","SET statement_timeout = 1;"),"preamble","settings_head"],
    [base.replace("set_config('search_path', '', false)","set_config('search_path', 'other', false)"),"preamble","search_path"],
    [base.replace("SET row_security = off;","SET row_security = on;"),"preamble","settings_tail"],
    [base.replace("Owner: supabase_auth_admin","Owner: other_owner"),"block_comment","exact_comment"],
    [base.replace(AUTH_COPY,"COPY auth.schema_migrations (other) FROM stdin;\n"),"copy_header","exact_original"],
    [base.replace("\\.\n\n\n","\\.\nX\n"),"separator","exact_separator"],
    [base.replace("\\unrestrict SCBaselineV1","\\unrestrict other"),"footer","exact_footer"],
    [base+canary,"footer","trailing_bytes"],
  ];
  for (const [bytes, phase, rule] of cases) diagnosed(() => extractMigrationHistory(source.handle, Buffer.from(bytes)), "FORMAT_UNSUPPORTED", phase, rule);
  for (const [bytes, phase, rule] of [
    [base.slice(0,1),"preamble","banner_restrict"],
    [PREAMBLE+AUTH_COMMENT.slice(0,8),"block_comment","exact_comment"],
    [PREAMBLE+AUTH_COMMENT+AUTH_COPY.slice(0,8),"copy_header","exact_original"],
    [base.slice(0,base.length-1),"footer","exact_footer"],
  ]) diagnosed(() => extractMigrationHistory(source.handle, Buffer.from(bytes)), "TRUNCATED", phase, rule);
  discardCustomArchiveToc(source.handle);
});

test("row and binding diagnostics retain only public rules for invalid text, semantics and getters", () => {
  const source = original();
  diagnosed(() => extractMigrationHistory(null, script()), "TOC_REQUIRED", "input", "toc_required");
  diagnosed(() => extractMigrationHistory(source.handle, null), "INPUT_INVALID", "input", "stdout_type");
  diagnosed(() => extractMigrationHistory(source.handle, new Uint8Array(0)), "TRUNCATED", "input", "stdout_nonempty");
  diagnosed(() => extractMigrationHistory(source.handle, new Uint8Array(20*1024*1024+1)), "LIMIT_EXCEEDED", "input", "stdout_size");
  for (const [options, rule] of [
    [{auth:canary+"\r\n"},"line_scan"],
    [{auth:"\\x00\n"},"field_escape"],
    [{auth:"\\xc0\\xaf\n"},"field_decode"],
    [{auth:"one\ttwo\n"},"field_count"],
    [{storage:"3\tname\tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\t\\N\textra\n"},"field_split"],
    [{storage:"+1\tname\tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\t\\N\n"},"storage_id_decimal"],
    [{storage:"9007199254740992\tname\tAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\t\\N\n"},"storage_id_safe"],
    [{auth:"duplicate\nduplicate\n"},"history_shape"],
  ]) diagnosed(() => extractMigrationHistory(source.handle, script(options)), "INVALID", "row", rule);
  diagnosed(() => migrationHistoryFacts({}), "REQUIRED", "binding", "handle_required");
  const handle = extractMigrationHistory(source.handle,script()), facts = migrationHistoryFacts(handle);
  facts.sourceBytes[0]^=1;
  diagnosed(() => migrationHistoryFacts(handle), "BINDING_INVALID", "binding", "retained_digest");
  diagnosed(() => migrationHistoryFacts(handle), "DISCARDED", "binding", "handle_discarded");
  const next = extractMigrationHistory(source.handle,script()); discardCustomArchiveToc(source.handle);
  diagnosed(() => migrationHistoryFacts(next), "BINDING_INVALID", "binding", "toc_identity");
});

test("a separately imported B3 instance cannot promote another instance's errors to nominal diagnostics", async () => {
  const fresh = await import(new URL("../../scripts/operations/restore-migration-history.mjs?separate-diagnostic-map",import.meta.url).href);
  const own = diagnosed(() => migrationHistoryCopySelection({}), "TOC_REQUIRED", "input", "toc_required");
  assert.equal(fresh.migrationHistoryDiagnostic(own), null);
  let other; try { fresh.migrationHistoryCopySelection({}); } catch(error) { other = error; }
  reject(() => { throw other; }, "TOC_REQUIRED", fresh.migrationHistoryDiagnostic);
  assert.equal(migrationHistoryDiagnostic(other), null);
  assert.deepEqual(fresh.migrationHistoryDiagnostic(other), {version:1,phase:"input",rule:"toc_required"});
});
