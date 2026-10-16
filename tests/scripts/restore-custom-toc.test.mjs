import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inspect } from "node:util";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { planManagedRestore } from "../../scripts/operations/restore-managed-plan.mjs";
import * as tocModule from "../../scripts/operations/restore-custom-toc.mjs";

// Public artificial wire vectors only: no original archive/profile, IO port,
// child, native PostgreSQL executable, network, SQL execution or DATA decoding.
const { extractCustomArchiveToc, customArchiveTocFacts, discardCustomArchiveToc, CUSTOM_TOC_ERROR_CODES } = tocModule;
const canary = "PRIVATE_BINARY_TOC_CANARY", BIG_ID = 0x01020304, FIELD = 4 * 1024 * 1024;
const hash = bytes => createHash("sha256").update(bytes).digest("hex"), code = suffix => "RESTORE_CUSTOM_TOC_" + suffix;
const read = value => value === null ? null : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(value);
const reject = (fn, suffix) => assert.throws(fn, error => {
  assert.equal(error instanceof BackupError, true); assert.equal(error.code, code(suffix)); assert.equal(error.message, code(suffix));
  assert.equal(CUSTOM_TOC_ERROR_CODES.includes(error.code), true); assert.equal(Object.hasOwn(error, "cause"), false);
  for (const value of [error.stack, JSON.stringify(error), inspect(error)]) assert.equal(value.includes(canary), false);
  return true;
});

// Hand-authored byte anchors independent of the fixture's record writer:
// header date integers are sign + LE magnitude: 23/42/15/16/9/126/0.
// The final strings are postgres / 17.6 / 18.4, not fixture SQL or identities.
const HEADER = Buffer.from("5047444d5001100004080101" +
  "0017000000002a000000000f00000000100000000009000000007e0000000000000000" +
  "0008000000706f737467726573000400000031372e36000400000031382e34", "hex");
// One complete ENCODING TOC record: ID18, OIDs0/0, section2, exact 30-byte
// UTF8 SET, NULL statements/namespace/owner, false, NULL deps, NO_DATA/offset0.
const ENCODING_RECORD = Buffer.from(
  "00120000000000000000" + "000100000030000100000030" +
  "0008000000454e434f44494e470008000000454e434f44494e47" +
  "0002000000001e00000053455420636c69656e745f656e636f64696e67203d202755544638273b0a" +
  "01010000000101000000010100000001010000000101000000" +
  "00000000000101000000000500000066616c73650101000000030000000000000000", "hex");
const integer = value => { const result = Buffer.alloc(5); result[0] = value < 0 ? 1 : 0; result.writeUInt32LE(Math.abs(value), 1); return result; };
const string = value => value === null ? integer(-1) : (() => { const bytes = typeof value === "string" ? Buffer.from(value) : value; return Buffer.concat([integer(bytes.length), bytes]); })();
function fixture(overrides = {}, tail = Buffer.from([0xff, 0xfe, 0x00, 0x80]), additionalRows = []) {
  const rows = [
    [18,"ENCODING","-","ENCODING","",[]], [19,"STDSTRINGS","-","STDSTRINGS","",[]], [20,"SEARCHPATH","-","SEARCHPATH","",[]],
    [1,"SCHEMA","-","auth","supabase_auth_admin",[]], [2,"SCHEMA","-","storage","supabase_storage_admin",[]], [3,"SCHEMA","-","app_private","postgres",[]],
    [4,"TABLE","auth","users","supabase_auth_admin",[1]], [5,"TABLE","storage","objects","supabase_storage_admin",[2]], [6,"TABLE","storage","buckets","supabase_storage_admin",[2]],
    [7,"FUNCTION","app_private","on_auth_user_created()","postgres",[3]], [8,"FUNCTION","app_private","check_admin_auth_creation_final()","postgres",[3,4,3]],
    [9,"TABLE DATA","auth","users","supabase_auth_admin",[4]], [10,"TABLE DATA","storage","objects","supabase_storage_admin",[5]], [11,"TABLE DATA","storage","buckets","supabase_storage_admin",[6]],
    [BIG_ID,"TABLE","public","profiles","postgres",[4]], [13,"TABLE DATA","public","profiles","postgres",[BIG_ID]],
    [14,"TRIGGER","auth","users second_brain_identity_created","postgres",[4,7]], [15,"TRIGGER","auth","users second_brain_admin_creation_final","postgres",[4,8]],
    [16,"POLICY","storage","objects second_brain_private_objects","supabase_storage_admin",[5]], [17,"POLICY","storage","buckets second_brain_private_buckets","supabase_storage_admin",[6]],
  ].map(([id,kind,schema,tag,owner,dependencies]) => ({ id,kind,schema,tag,owner,dependencies,catalogClassOid:kind==="TABLE"?1259:kind==="FUNCTION"?1255:0,catalogObjectOid:id===BIG_ID?0xfedcba98:id*7 })).concat(additionalRows);
  for (const row of rows.slice(0,3)) { row.catalogClassOid=0; row.catalogObjectOid=0; }
  const toc = `;     TOC Entries: ${rows.length}\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n` + rows.map(row => `${row.id}; ${row.catalogClassOid} ${row.catalogObjectOid} ${row.kind} ${row.schema} ${row.tag} ${row.owner}\n` + (row.dependencies.length ? ";\tdepends on: " + row.dependencies.join(" ") + "\n" : "")).join("");
  const parts = [], marks = new Map(); let position = 0;
  const push = bytes => { parts.push(bytes); position += bytes.length; };
  push(HEADER); const countOffset=position; push(integer(rows.length));
  for (const native of rows) {
    const fields = { dumpId:native.id, hadDumper:native.kind==="TABLE DATA"?1:0, catalogClassOid:String(native.catalogClassOid), catalogObjectOid:String(native.catalogObjectOid), tag:native.tag, kind:native.kind,
      sectionCode:native.kind==="TABLE DATA"?3:["TRIGGER","POLICY"].includes(native.kind)?4:2,
      definition:native.id===18?"SET client_encoding = 'UTF8';\n":native.id===19?"SET standard_conforming_strings = 'on';\n":native.id===20?"SELECT pg_catalog.set_config('search_path', '', false);\n":native.id===8?"CREATE FUNCTION fake() RETURNS text LANGUAGE sql AS $$\n-- TOC entry forged\nSELECT 'Olá " + canary + "';\n$$;\n":"-- synthetic definition\n",
      dropStatement:null, copyStatement:native.kind==="TABLE DATA"?"COPY fake_table (value) FROM stdin;\n":null, namespace:native.schema==="-"?null:native.schema,
      tablespace:native.id===1?Buffer.alloc(0):null, tableAccessMethod:native.kind==="TABLE"?"heap":null, relationKind:native.kind==="TABLE"?114:0, owner:native.owner, withOids:"false", dependencies:native.dependencies,
      customDataState:native.kind==="TABLE DATA"?1:3, customDataOffset:0n, ...native.wire, ...overrides[native.id] };
    const mark={start:position}; marks.set(native.id,mark);
    if (native.id===18 && !Object.hasOwn(overrides,18)) { push(ENCODING_RECORD); continue; }
    const numberField=key=>{mark[key]=position;push(integer(fields[key]));};
    const stringField=key=>{mark[key]=position;push(string(fields[key]));};
    numberField("dumpId");numberField("hadDumper");stringField("catalogClassOid");stringField("catalogObjectOid");stringField("tag");stringField("kind");numberField("sectionCode");
    for(const key of ["definition","dropStatement","copyStatement","namespace","tablespace","tableAccessMethod"]) stringField(key);
    numberField("relationKind");stringField("owner");stringField("withOids");mark.dependencies=position;
    for(const dependency of fields.dependencies) push(string(String(dependency)));
    mark.dependencyTerm=position;push(integer(-1));mark.customDataState=position;push(Buffer.from([fields.customDataState]));mark.customDataOffset=position;
    const offset=Buffer.alloc(8);offset.writeBigUInt64LE(fields.customDataOffset);push(offset);
  }
  const tocEndOffset=position;push(tail);
  return { database:Buffer.concat(parts),toc,marks,tocEndOffset,countOffset };
}
const planFor = (context, database=context.database, toc=context.toc, extra={}) => planManagedRestore(toc,{archiveSha256:"a".repeat(64),databaseSha256:hash(database),databaseBytes:database.byteLength,...extra});
const extract = context => { const plan=planFor(context);const handle=extractCustomArchiveToc(plan,context.database);return {plan,handle,facts:customArchiveTocFacts(handle)}; };

// A complete class sample from the pinned producer calls, not an expansion of
// the supported planner scope. The database metadata is preserved, never replayed.
const producerRows = [
  [30,"DATABASE","-","postgres",2,0], [31,"DATABASE PROPERTIES","-","postgres",2,0],
  [32,"ACL","public","profiles",1,0], [33,"COMMENT","public","profiles",1,0],
  [34,"CONSTRAINT","public","profiles profiles_pkey",4,0], [35,"DEFAULT","public","profiles id",2,0],
  [36,"DEFAULT ACL","public","DEFAULT PRIVILEGES FOR TABLES",4,0], [37,"FK CONSTRAINT","public","profiles profiles_fkey",4,0],
  [38,"INDEX","public","profiles_extra_idx",4,0], [39,"ROW SECURITY","public","profiles",4,0],
  [40,"SEQUENCE","public","profiles_id_seq",2,0], [41,"SEQUENCE OWNED BY","public","profiles_id_seq",2,0],
  [42,"SEQUENCE SET","public","profiles_id_seq",3,0], [43,"TYPE","public","test_type",2,0], [44,"VIEW","public","test_view",2,118],
].map(([id,kind,schema,tag,sectionCode,relationKind]) => ({id,kind,schema,tag,owner:"postgres",dependencies:schema==="-"?[]:[3],catalogClassOid:0,catalogObjectOid:id*7,wire:{sectionCode,relationKind}}));
const producerFixture = (overrides = {}) => fixture({8:{sectionCode:4},[BIG_ID]:{relationKind:112},...overrides},undefined,producerRows);

test("API is closed and hand-authored wire anchors retain full fields, unsigned OIDs, original order and duplicate dependencies", () => {
  assert.deepEqual(Object.keys(tocModule).sort(),["CUSTOM_TOC_ERROR_CODES","customArchiveTocFacts","discardCustomArchiveToc","extractCustomArchiveToc"]);
  assert.equal(CUSTOM_TOC_ERROR_CODES.length,10);assert.equal(Object.isFrozen(CUSTOM_TOC_ERROR_CODES),true);
  assert.equal(HEADER.length,78);assert.equal(ENCODING_RECORD.length,147);
  const context=fixture(),original=Buffer.from(context.database),{handle,facts}=extract(context);
  assert.deepEqual(handle,{});assert.equal(Object.isFrozen(handle),true);assert.equal(JSON.stringify(handle),"{}");
  assert.equal(customArchiveTocFacts(handle),facts);assert.equal(Object.isFrozen(facts),true);assert.equal(Object.isFrozen(facts.records),true);
  assert.deepEqual(facts.format,{archiveVersion:"1.16-0",intSize:4,offSize:8,format:"CUSTOM",compression:"GZIP"});assert.equal(facts.encoding,"UTF8");
  assert.deepEqual(facts.header.creation,{second:23,minute:42,hour:15,day:16,month:9,year:126,isDst:0});
  assert.equal(read(facts.header.databaseName),"postgres");assert.equal(read(facts.header.remoteVersion),"17.6");assert.equal(read(facts.header.dumpVersion),"18.4");
  assert.equal(facts.tocEndOffset,context.tocEndOffset);assert.deepEqual(facts.records.map(row=>row.dumpId),[18,19,20,1,2,3,4,5,6,7,8,9,10,11,BIG_ID,13,14,15,16,17]);
  assert.deepEqual(facts.preserved.map(row=>row.dumpId),[1,2,4,5,6]);
  assert.equal(facts.records[0].owner,null);assert.equal(read(facts.records[1].owner),"");assert.equal(read(facts.records[0].definition),"SET client_encoding = 'UTF8';\n");
  const byId=new Map(facts.records.map(row=>[row.dumpId,row])),fn=byId.get(8),big=byId.get(BIG_ID);
  assert.equal(big.catalogClassOid,1259);assert.equal(big.catalogObjectOid,0xfedcba98);assert.deepEqual(fn.dependencies,[3,4,3]);assert.equal(Object.isFrozen(fn.dependencies),true);
  assert.equal(read(fn.definition),"CREATE FUNCTION fake() RETURNS text LANGUAGE sql AS $$\n-- TOC entry forged\nSELECT 'Olá "+canary+"';\n$$;\n");
  assert.equal(byId.get(1).tablespace.byteLength,0);assert.equal(byId.get(2).tablespace,null);assert.equal(read(big.tableAccessMethod),"heap");assert.equal(big.relationKind,114);
  assert.equal(fn.definition.buffer,byId.get(4).tag.buffer);assert.notEqual(fn.definition.buffer,context.database.buffer);assert.equal(fn.definition.buffer.byteLength,facts.tocEndOffset);
  assert.deepEqual(context.database,original);assert.equal(discardCustomArchiveToc(handle),true);assert.equal(new Uint8Array(fn.definition.buffer).every(value=>value===0),true);
  assert.deepEqual(context.database,original);assert.equal(discardCustomArchiveToc(handle),false);reject(()=>customArchiveTocFacts(handle),"DISCARDED");
});

test("all 24 producer classes retain coherent section, relkind and dumper without changing native order or selection", () => {
  const context=producerFixture(),{handle,facts}=extract(context);
  try {
    assert.equal(new Set(facts.records.map(row=>row.kind)).size,24);
    assert.deepEqual(facts.records.map(row=>row.dumpId),[18,19,20,1,2,3,4,5,6,7,8,9,10,11,BIG_ID,13,14,15,16,17,...producerRows.map(row=>row.id)]);
    const byId=new Map(facts.records.map(row=>[row.dumpId,row]));
    for(const native of producerRows){const row=byId.get(native.id);assert.equal(row.kind,native.kind);assert.equal(row.sectionCode,native.wire.sectionCode);assert.equal(row.relationKind,native.wire.relationKind);assert.equal(row.hadDumper,false);}
    assert.equal(byId.get(7).sectionCode,2);assert.equal(byId.get(8).sectionCode,4);assert.deepEqual(byId.get(8).dependencies,[3,4,3]);
    assert.equal(byId.get(4).relationKind,114);assert.equal(byId.get(BIG_ID).relationKind,112);assert.equal(byId.get(44).relationKind,118);
    assert.equal(byId.get(38).relationKind,0);assert.equal(byId.get(40).relationKind,0);assert.equal(byId.get(42).hadDumper,false);assert.equal(byId.get(42).customDataState,3);
    assert.equal(facts.records.filter(row=>row.hadDumper).every(row=>row.kind==="TABLE DATA"),true);assert.equal(byId.get(9).hadDumper,true);
    assert.deepEqual(facts.preserved.map(row=>row.dumpId),[1,2,4,5,6,30,31]);
  } finally { discardCustomArchiveToc(handle); }
});

test("known enum values in impossible producer combinations refuse before extraction can qualify them", () => {
  const samples=[[18,"ENCODING",[2],0],[19,"STDSTRINGS",[2],0],[20,"SEARCHPATH",[2],0],[1,"SCHEMA",[2],0],[4,"TABLE",[2],114],[8,"FUNCTION",[2,4],0],[9,"TABLE DATA",[3],0],[14,"TRIGGER",[4],0],[16,"POLICY",[4],0],...producerRows.map(row=>[row.id,row.kind,[row.wire.sectionCode],row.wire.relationKind])];
  assert.equal(new Set(samples.map(([,kind])=>kind)).size,24);
  for(const [id,kind,sections,relationKind] of samples){
    const wrongSection=[1,2,3,4].find(value=>!sections.includes(value));
    const wrongRelationKind=relationKind===0?114:0;
    const wrongDumper=kind==="TABLE DATA"?{hadDumper:0,customDataState:3}:{hadDumper:1,customDataState:1};
    for(const override of [{sectionCode:wrongSection},{relationKind:wrongRelationKind},wrongDumper]){
      const context=producerFixture({[id]:override});reject(()=>extractCustomArchiveToc(planFor(context),context.database),"INVALID");
    }
  }
  // Valid catalog relkind constants are not automatically the TOC relkind of
  // those classes. Both leave ArchiveOpts.relkind omitted in the C producer.
  for(const [id,relationKind] of [[38,105],[40,83],[4,109],[44,114]]){
    const context=producerFixture({[id]:{relationKind}});reject(()=>extractCustomArchiveToc(planFor(context),context.database),"INVALID");
  }
});

test("only original handles and genuine plans work; type spoofs, getters, Proxy/SAB and detach refuse without traps", () => {
  const context=fixture(),{handle}=extract(context);let traps=0;
  const proxy=new Proxy(handle,{get(){traps++;throw Error(canary);},ownKeys(){traps++;throw Error(canary);}}),revoked=Proxy.revocable({},{});revoked.revoke();
  for(const value of [null,undefined,{},structuredClone(handle),Object.create(handle),proxy,revoked.proxy]){reject(()=>customArchiveTocFacts(value),"REQUIRED");assert.equal(discardCustomArchiveToc(value),false);}
  for(const value of [null,{},structuredClone(planFor(context)),proxy,revoked.proxy])reject(()=>extractCustomArchiveToc(value,context.database),"PLAN_REQUIRED");
  const plan=planFor(context),fake={get byteLength(){traps++;throw Error(canary);},get buffer(){traps++;throw Error(canary);},get [Symbol.toStringTag](){traps++;throw Error(canary);}};
  const wrapped=new Proxy(context.database,{get(){traps++;throw Error(canary);},getPrototypeOf(){traps++;throw Error(canary);}}),shared=new Uint8Array(new SharedArrayBuffer(context.database.length));shared.set(context.database);
  const detached=Uint8Array.from(context.database);structuredClone(detached,{transfer:[detached.buffer]});
  for(const value of [null,undefined,[],[...context.database],canary,context.database.buffer,new DataView(context.database.buffer),new Int8Array(context.database.length),new Uint8ClampedArray(context.database),fake,wrapped,revoked.proxy,shared,detached])reject(()=>extractCustomArchiveToc(plan,value),"INPUT_INVALID");
  assert.equal(traps,0);assert.equal(discardCustomArchiveToc(handle),true);
});

test("cross-check covers every ID, class, namespace, tag, owner, OID and complete ordered dependency vector, including preserved rows", () => {
  for(const override of [{kind:"VIEW",relationKind:118},{namespace:"public"},{tag:"different"},{owner:"another_owner"},{catalogClassOid:"1258"},{catalogObjectOid:"999"},{dependencies:[1,1]}]){
    const context=fixture({4:override});reject(()=>extractCustomArchiveToc(planFor(context),context.database),"PLAN_MISMATCH");
  }
  // ID19 has no inbound references. Renaming it keeps the binary graph valid
  // and therefore reaches the intended mismatch against the genuine plan.
  const id=fixture({19:{dumpId:99}});reject(()=>extractCustomArchiveToc(planFor(id),id.database),"PLAN_MISMATCH");
  const order=fixture({8:{dependencies:[3,3,4]}});reject(()=>extractCustomArchiveToc(planFor(order),order.database),"PLAN_MISMATCH");
  const missing=fixture({8:{dependencies:[3,4]}});reject(()=>extractCustomArchiveToc(planFor(missing),missing.database),"PLAN_MISMATCH");
  const original=fixture(),different=Buffer.from(original.database);different[different.length-1]^=1;
  reject(()=>extractCustomArchiveToc(planFor(original),different),"BINDING_INVALID");
  reject(()=>extractCustomArchiveToc(planFor(original,original.database,original.toc,{databaseBytes:original.database.length+1}),original.database),"BINDING_INVALID");
});

test("offset source views and genuine subclasses ignore caller getters, iterators and backing-store species", () => {
  const context=fixture(),plan=planFor(context);let calls=0;
  class CallerBytes extends Uint8Array {
    get byteLength(){calls++;throw Error(canary);}get byteOffset(){calls++;throw Error(canary);}get buffer(){calls++;throw Error(canary);}get [Symbol.toStringTag](){calls++;throw Error(canary);}
  }
  const store=new ArrayBuffer(context.database.length+29),view=new CallerBytes(store,17,context.database.length);Uint8Array.prototype.set.call(view,context.database);
  for(const name of ["constructor",Symbol.iterator,"toJSON","valueOf"])Object.defineProperty(view,name,{get(){calls++;throw Error(canary);}});
  for(const name of ["constructor","byteLength"])Object.defineProperty(store,name,{get(){calls++;throw Error(canary);}});
  const handle=extractCustomArchiveToc(plan,view),facts=customArchiveTocFacts(handle);assert.equal(facts.records.length,20);assert.equal(read(facts.records[0].definition),"SET client_encoding = 'UTF8';\n");
  assert.equal(calls,0);assert.equal(discardCustomArchiveToc(handle),true);
});

test("only the qualified format and exact UTF8 state qualify; strings preserve NULL/empty without guessing sentinel or encoding", () => {
  for(const [offset,value] of [[0,0],[5,2],[6,15],[7,1],[8,8],[9,4],[10,3],[11,0],[11,2],[11,3],[11,255]]){
    const context=fixture();context.database[offset]=value;reject(()=>extractCustomArchiveToc(planFor(context),context.database),"FORMAT_UNSUPPORTED");
  }
  const encoding=fixture({18:{definition:"SET client_encoding = 'LATIN1';\n"}});reject(()=>extractCustomArchiveToc(planFor(encoding),encoding.database),"FORMAT_UNSUPPORTED");
  const deferred=fixture({18:{definition:"SET client_encoding = 'LATIN1';\n"},4:{definition:Buffer.from([0xff,0xfe])}});
  // Move ENCODING's original whole wire record after invalid SQL bytes. The
  // format veto must precede UTF8 validation/decoding, regardless of TOC order.
  const begin=deferred.marks.get(18).start,end=deferred.marks.get(19).start;
  deferred.database=Buffer.concat([deferred.database.subarray(0,begin),deferred.database.subarray(end,deferred.tocEndOffset),deferred.database.subarray(begin,end),deferred.database.subarray(deferred.tocEndOffset)]);
  reject(()=>extractCustomArchiveToc(planFor(deferred),deferred.database),"FORMAT_UNSUPPORTED");
  const emptyNamespace=fixture({4:{namespace:""}});reject(()=>extractCustomArchiveToc(planFor(emptyNamespace),emptyNamespace.database),"PLAN_MISMATCH");
  const sanitized=fixture({14:{tag:"users\nsecond_brain_identity_created"}}),{handle,facts}=extract(sanitized);
  assert.equal(read(facts.records.find(row=>row.dumpId===14).tag),"users\nsecond_brain_identity_created");discardCustomArchiveToc(handle);
});

test("signs, canonical decimals, NUL, UTF8, flags, IDs and dependency graph refuse independently of valid binding", () => {
  for(const override of [{dumpId:3},{dumpId:0},{hadDumper:2},{kind:"UNKNOWN_"+canary},{sectionCode:0},{relationKind:255},{catalogObjectOid:"4294967296"},{catalogObjectOid:"01"},{catalogClassOid:"-1"},{dependencies:[0]},{dependencies:[4]},{dependencies:[999]},{withOids:"true"},{withOids:null},{definition:Buffer.from([0xc0,0xaf])},{definition:Buffer.from([0xed,0xa0,0x80])},{definition:Buffer.from([0xf4,0x90,0x80,0x80])},{definition:Buffer.from([0xe2,0x82])},{definition:"before\0"+canary}]){
    const context=fixture({4:override});reject(()=>extractCustomArchiveToc(planFor(context),context.database),"INVALID");
  }
  for(const mutation of [bytes=>{bytes[12]=2;},bytes=>{bytes.fill(0,12,17);bytes[12]=1;},bytes=>{bytes[12]=0;bytes.writeUInt32LE(0x80000000,13);},bytes=>{bytes[12]=1;bytes.writeUInt32LE(0xffffffff,13);}]){
    const context=fixture();mutation(context.database);reject(()=>extractCustomArchiveToc(planFor(context),context.database),"INVALID");
  }
  const negative=fixture();integer(-2).copy(negative.database,negative.marks.get(4).definition);reject(()=>extractCustomArchiveToc(planFor(negative),negative.database),"INVALID");
});

test("offset states obey the pinned custom writer; known positions start at or after TOC and remain inside the archive", () => {
  const valid=fixture();valid.database[valid.marks.get(9).customDataState]=2;valid.database.writeBigUInt64LE(BigInt(valid.tocEndOffset),valid.marks.get(9).customDataOffset);
  const {handle,facts}=extract(valid);assert.equal(facts.records.find(row=>row.dumpId===9).customDataOffset,BigInt(valid.tocEndOffset));discardCustomArchiveToc(handle);
  for(const override of [{customDataState:0},{customDataState:4},{customDataState:3},{customDataOffset:1n},{customDataState:2,customDataOffset:0n},{customDataState:2,customDataOffset:0xffffffffffffffffn}]){
    const context=fixture({9:override});reject(()=>extractCustomArchiveToc(planFor(context),context.database),"INVALID");
  }
  const end=fixture();end.database[end.marks.get(9).customDataState]=2;end.database.writeBigUInt64LE(BigInt(end.database.length),end.marks.get(9).customDataOffset);reject(()=>extractCustomArchiveToc(planFor(end),end.database),"INVALID");
  const noDumper=fixture({4:{customDataState:2,customDataOffset:999999n}});reject(()=>extractCustomArchiveToc(planFor(noDumper),noDumper.database),"INVALID");
});

test("truncation is checked at binary boundaries; bytes after the TOC are hash-bound but never interpreted as DATA", () => {
  const original=fixture();
  for(const length of [0,5,11,12,16,47,55,77,78,82,83,100,original.marks.get(4).definition+2,original.marks.get(9).customDataOffset+3,original.tocEndOffset-1]){
    const database=original.database.subarray(0,length);reject(()=>extractCustomArchiveToc(planFor(original,length===0?original.database:database),database),"TRUNCATED");
  }
  const arbitrary=fixture({},Buffer.from("not gzip\0\\.\nCOMMIT;\n"+canary+"\xff")),{handle,facts}=extract(arbitrary);
  assert.equal(facts.tocEndOffset,arbitrary.tocEndOffset);assert.equal(facts.records.some(row=>read(row.copyStatement)?.includes(canary)),false);discardCustomArchiveToc(handle);
});

test("entry, field, edge and aggregate TOC bounds refuse before retaining an owned plaintext store", () => {
  const count=fixture();integer(10001).copy(count.database,count.countOffset);reject(()=>extractCustomArchiveToc(planFor(count),count.database),"LIMIT_EXCEEDED");
  const field=fixture();integer(FIELD+1).copy(field.database,field.marks.get(4).definition);reject(()=>extractCustomArchiveToc(planFor(field),field.database),"LIMIT_EXCEEDED");
  const edge=fixture(),one=Buffer.from("000100000033","hex"),repeated=Buffer.alloc(one.length*100001);
  for(let index=0;index<100001;index++)one.copy(repeated,index*one.length);
  const boundary=edge.marks.get(8).dependencyTerm;edge.database=Buffer.concat([edge.database.subarray(0,boundary),repeated,edge.database.subarray(boundary)]);
  reject(()=>extractCustomArchiveToc(planFor(edge),edge.database),"LIMIT_EXCEEDED");
  const block=Buffer.alloc(FIELD,0x61),aggregate=fixture({1:{definition:block,dropStatement:block,copyStatement:block,namespace:block,tablespace:block,tableAccessMethod:block,owner:block},2:{definition:block}});
  reject(()=>extractCustomArchiveToc(planFor(aggregate),aggregate.database),"LIMIT_EXCEEDED");
  const maximum=new Uint8Array(64*1024*1024+1),bound=fixture();
  // The length veto precedes hashing: no 64 MiB warm-up or payload fill.
  reject(()=>extractCustomArchiveToc(planFor(bound,bound.database,bound.toc,{databaseBytes:maximum.length}),maximum),"LIMIT_EXCEEDED");
});

test("late binding refusal wipes the sole owned store, and caller mutations after success cannot change retained ByteStrings", async () => {
  const context=fixture(),plan=planFor(context),OriginalStore=globalThis.ArrayBuffer,stores=[];
  // Test-only constructor captured before a fresh import, not a production
  // seam. It changes synthetic source bytes exactly at the final allocation.
  class ProbeStore extends OriginalStore { constructor(length){super(length);stores.push(this);context.database[20]^=1;} }
  let fresh;globalThis.ArrayBuffer=ProbeStore;
  try{fresh=await import(new URL("../../scripts/operations/restore-custom-toc.mjs?wipe-synthetic",import.meta.url).href);}
  finally{globalThis.ArrayBuffer=OriginalStore;}
  reject(()=>fresh.extractCustomArchiveToc(plan,context.database),"BINDING_INVALID");assert.equal(stores.length,1);assert.equal(stores[0].byteLength,context.tocEndOffset);assert.equal(new Uint8Array(stores[0]).every(value=>value===0),true);
  const other=fixture(),{handle,facts}=extract(other),definition=facts.records.find(row=>row.dumpId===8).definition,original=Uint8Array.from(definition);
  other.database.fill(0);assert.deepEqual(definition,original);assert.equal(discardCustomArchiveToc(handle),true);assert.equal(definition.every(value=>value===0),true);
});

test("every facts read revalidates the owned bytes; mutation through a retained view refuses, wipes and invalidates the handle", () => {
  const context=fixture(),{handle,facts}=extract(context),definition=facts.records.find(row=>row.dumpId===8).definition;
  definition[0]^=1;reject(()=>customArchiveTocFacts(handle),"BINDING_INVALID");
  assert.equal(new Uint8Array(definition.buffer).every(value=>value===0),true);reject(()=>customArchiveTocFacts(handle),"DISCARDED");assert.equal(discardCustomArchiveToc(handle),false);
  const detached=extract(fixture()),view=detached.facts.records[0].definition;structuredClone(view,{transfer:[view.buffer]});
  reject(()=>customArchiveTocFacts(detached.handle),"DISCARDED");assert.equal(discardCustomArchiveToc(detached.handle),false);
});
