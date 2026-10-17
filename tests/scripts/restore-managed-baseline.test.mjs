import test from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { compareManagedMigrationHistory } from "../../scripts/operations/restore-managed-plan.mjs";
import * as baseline from "../../scripts/operations/restore-managed-baseline.mjs";

// Public artificial records only: no archive, profile, subprocess, service,
// provider, native receipt, SQL executor, authority port or capability mint.
const { compareManagedBaseline: compare, MANAGED_BASELINE_REASONS: reasons, MANAGED_BASELINE_ERROR_CODES: codes, MANAGED_BASELINE_LIMITS: limits } = baseline;
const canary = "PRIVATE_BASELINE_CANARY", bytes = text => new TextEncoder().encode(text);
const strings = ["tag", "namespace", "definition", "dropStatement", "copyStatement", "tablespace", "tableAccessMethod", "owner", "withOids"];
const allKinds = ["DATABASE", "DATABASE PROPERTIES", "ACL", "COMMENT", "CONSTRAINT", "DEFAULT", "DEFAULT ACL", "ENCODING", "FK CONSTRAINT", "FUNCTION", "INDEX", "POLICY", "ROW SECURITY", "SCHEMA", "SEARCHPATH", "SEQUENCE", "SEQUENCE OWNED BY", "SEQUENCE SET", "STDSTRINGS", "TABLE", "TABLE DATA", "TRIGGER", "TYPE", "VIEW"];
function row(dumpId, kind, namespace, tag, dependencies = [], extra = {}) {
  return { ordinal: dumpId - 1, dumpId, hadDumper: kind === "TABLE DATA", catalogClassOid: 1259, catalogObjectOid: dumpId * 17,
    kind, tag: bytes(tag), namespace: namespace === null ? null : bytes(namespace), sectionCode: kind === "TABLE DATA" ? 3 : 2,
    definition: bytes("-- " + canary + "\n"), dropStatement: null, copyStatement: null, tablespace: null, tableAccessMethod: null,
    relationKind: kind === "TABLE" ? 114 : 0, owner: bytes("synthetic_owner"), withOids: bytes("false"), dependencies,
    customDataState: kind === "TABLE DATA" ? 1 : 3, customDataOffset: 0n, ...extra };
}
function fixture() {
  const preserved = [row(1,"SCHEMA",null,"auth"),row(2,"SCHEMA",null,"storage"),row(3,"TABLE","auth","users",[1]),
    row(4,"FUNCTION","auth","uid()",[1]),row(5,"ACL","auth","TABLE users",[3]),row(6,"TABLE","auth","schema_migrations",[1]),
    row(7,"TABLE DATA","auth","schema_migrations",[6]),row(8,"TABLE","storage","migrations",[2]),row(9,"TABLE DATA","storage","migrations",[8]),
    row(10,"DEFAULT ACL","auth","DEFAULT PRIVILEGES FOR TABLES",[1])];
  preserved[6].copyStatement = bytes("COPY auth.schema_migrations (version) FROM stdin;\n");
  preserved[8].copyStatement = bytes("COPY storage.migrations (id, name, hash, executed_at) FROM stdin;\n");
  const histories = { auth:[{version:"20240101"},{version:"20240202"}], storage:[{id:0,name:"first",hash:"a".repeat(40),executed_at:null},{id:1,name:"second",hash:"b".repeat(40),executed_at:"2026-10-16T00:00:00Z"}] };
  const archive = {version:1,binding:{side:"archive",archiveSha256:"a".repeat(64),databaseSha256:"b".repeat(64),databaseBytes:1048576,tocSha256:"c".repeat(64)},preserved,histories};
  const target = structuredClone(archive); target.binding = {side:"target",projectRef:"t".repeat(20),databaseName:"postgres",nativeDumpSha256:"d".repeat(64),nativeDumpBytes:2097152,tocSha256:"e".repeat(64)};
  for (const record of target.preserved) { record.dumpId += 100; record.ordinal += 1000; record.catalogClassOid += 19; record.catalogObjectOid += 197; record.dependencies = record.dependencies.map(id=>id+100); if(record.hadDumper){record.customDataState=2;record.customDataOffset=123456n;} }
  target.preserved.reverse(); return {archive,target};
}
const targetRow = (pair,id=3) => pair.target.preserved.find(row=>row.dumpId===id+100);
const verdict = (pair, expected=[]) => {const result=compare(pair.archive,pair.target);assert.deepEqual(result,{version:1,matches:expected.length===0,reasons:expected});assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(result.reasons),true);assert.equal(JSON.stringify(result).includes(canary),false);return result;};
const refuse = (fn,suffix) => assert.throws(fn,error=>{const code="RESTORE_MANAGED_BASELINE_"+suffix;assert.equal(error instanceof BackupError,true);assert.equal(error.code,code);assert.equal(error.message,code);assert.equal(codes.includes(error.code),true);assert.equal(Object.hasOwn(error,"cause"),false);for(const text of[JSON.stringify(error),inspect(error),error.stack])assert.equal(text.includes(canary),false);return true;});

test("A2 is synchronous, has only the closed exports and never confers a native authority",()=>{
  assert.deepEqual(Object.keys(baseline).sort(),["MANAGED_BASELINE_ERROR_CODES","MANAGED_BASELINE_LIMITS","MANAGED_BASELINE_REASONS","compareManagedBaseline"].sort());
  assert.equal(compare.constructor.name,"Function");assert.equal(Object.isFrozen(codes),true);assert.equal(Object.isFrozen(reasons),true);assert.equal(Object.isFrozen(limits),true);assert.equal(codes.length,3);assert.equal(reasons.length,15);
  const pair=fixture(),result=verdict(pair);assert.equal(result instanceof Promise,false);assert.deepEqual(Object.keys(result),["version","matches","reasons"]);assert.throws(()=>result.reasons.push("PRIVATE"),TypeError);
  pair.archive.binding.nativeAuthenticated=true;refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");
});
test("renumbered complete graphs match by bijection despite different order, OIDs, physical offsets and bindings",()=>{
  const pair=fixture(),before=structuredClone(pair);verdict(pair);assert.deepEqual(pair,before);
  for(const value of[0,Number.MAX_SAFE_INTEGER]){for(const row of pair.target.preserved)row.ordinal=value;verdict(pair);}
  for(const row of pair.target.preserved){row.catalogClassOid=4294967295;row.catalogObjectOid=0;row.customDataOffset=18446744073709551615n;row.customDataState=1;}verdict(pair);
});
test("structurally valid empty subsets compare mathematically without proving full coverage",()=>{
  const pair=fixture();pair.archive.preserved=[];pair.target.preserved=[];verdict(pair);
  pair.target.preserved=[row(20,"SCHEMA",null,"extra")];verdict(pair,["identity_set_mismatch"]);
});
for(const kind of allKinds)test("full original fields remain comparable for supported class "+kind,()=>{
  const pair=fixture();if(kind!=="TABLE DATA"){pair.archive.preserved.push(row(50,kind,kind==="SCHEMA"?null:"auth","independent_"+kind));const extra=structuredClone(pair.archive.preserved.at(-1));extra.dumpId=500;extra.catalogObjectOid=999;pair.target.preserved.push(extra);}
  verdict(pair);const changed=kind==="TABLE DATA"?targetRow(pair,7):pair.target.preserved.at(-1);changed.definition=bytes("SELECT '"+canary+"';\n");verdict(pair,["definition_mismatch"]);
});
for(const [field,reason,value]of[
  ["sectionCode","section_mismatch",4],["hadDumper","dumper_mismatch",true],["definition","definition_mismatch",bytes("different definition")],
  ["dropStatement","drop_statement_mismatch",bytes("DROP TABLE only_artificial;")],["copyStatement","copy_statement_mismatch",bytes("COPY synthetic FROM stdin;")],
  ["owner","owner_mismatch",bytes("other_owner")],["tablespace","tablespace_mismatch",bytes("space")],["tableAccessMethod","table_access_method_mismatch",bytes("heap")],
  ["relationKind","relation_kind_mismatch",112],["withOids","with_oids_mismatch",bytes("true")],
])test("one original semantic field changes only its closed reason: "+field,()=>{const pair=fixture();targetRow(pair)[field]=value;verdict(pair,[reason]);});
test("SQL whitespace, comments, CRLF, ACL body and database properties are not normalized",()=>{
  for(const kind of["FUNCTION","ACL","DATABASE","DATABASE PROPERTIES"]){for(const suffix of[" ","\r\n","-- comment\n","\0"]){const pair=fixture(),source=row(50,kind,null,"opaque");pair.archive.preserved.push(source);const target=structuredClone(source);target.dumpId=500;target.definition=bytes("-- "+canary+"\n"+suffix);pair.target.preserved.push(target);verdict(pair,["definition_mismatch"]);}}
});
test("NULL and empty remain different for every ByteString; namespace/tag differences stay closed identity reasons",()=>{
  for(const field of strings){const pair=fixture(),source=pair.archive.preserved.find(row=>row.dumpId===4),target=targetRow(pair,4);source[field]=null;target[field]=new Uint8Array();verdict(pair,[field==="tag"||field==="namespace"?"identity_set_mismatch":{definition:"definition_mismatch",dropStatement:"drop_statement_mismatch",copyStatement:"copy_statement_mismatch",tablespace:"tablespace_mismatch",tableAccessMethod:"table_access_method_mismatch",owner:"owner_mismatch",withOids:"with_oids_mismatch"}[field]]);}
  const pair=fixture();targetRow(pair,1).namespace=new Uint8Array();verdict(pair,["identity_set_mismatch","dependency_vector_mismatch"]);
});
test("global class identities retain full namespace bytes, including two equal tags and NULL versus empty",()=>{
  for(const kind of["SCHEMA","DATABASE","DATABASE PROPERTIES"]){const pair=fixture(),first=row(50,kind,null,"same_global_tag"),second=row(51,kind,"auth","same_global_tag");pair.archive.preserved.push(first,second);pair.target.preserved.push({...structuredClone(first),dumpId:500},{...structuredClone(second),dumpId:501});verdict(pair);pair.target.preserved.at(-2).namespace=new Uint8Array();verdict(pair,["identity_set_mismatch"]);}
});
test("one different byte anywhere in a definition is observed, including offset views and the last byte",()=>{
  for(const at of[0,255,1023]){const pair=fixture(),source=new Uint8Array(1024).fill(65),backing=new Uint8Array(1050).fill(65);pair.archive.preserved[2].definition=source;targetRow(pair).definition=new Uint8Array(backing.buffer,13,1024);verdict(pair);backing[at+13]=66;verdict(pair,["definition_mismatch"]);assert.equal(source[at],65);}
});
test("full class/ns/tag identities prevent missing, extra and FUNCTION-signature aliases",()=>{
  for(const change of[row=>row.tag=bytes("users_other"),row=>row.namespace=bytes("storage"),row=>row.kind="VIEW"]){const pair=fixture();change(targetRow(pair));verdict(pair,["identity_set_mismatch","dependency_vector_mismatch"]);}
  const pair=fixture();targetRow(pair,4).tag=bytes("uid(integer)");verdict(pair,["identity_set_mismatch"]);
});
test("DEFAULT ACL owner belongs to identity, allowing distinct grantors but refusing an ambiguous duplicate",()=>{
  const pair=fixture(),extra=structuredClone(pair.archive.preserved.at(-1));extra.dumpId=50;extra.owner=bytes("another_grantor");pair.archive.preserved.push(extra);const other=structuredClone(extra);other.dumpId=500;other.dependencies=[101];pair.target.preserved.push(other);verdict(pair);
  targetRow(pair,10).owner=bytes("changed_grantor");verdict(pair,["identity_set_mismatch"]);
  const duplicate=fixture();duplicate.archive.preserved.push({...structuredClone(duplicate.archive.preserved.at(-1)),dumpId:500});refuse(()=>compare(duplicate.archive,duplicate.target),"GRAPH_INVALID");
});
test("dependency bijection preserves order and repeated IDs; numeric ID equality is never correspondence",()=>{
  const pair=fixture();pair.archive.preserved[2].dependencies=[1,2,1];targetRow(pair).dependencies=[101,102,101];verdict(pair);
  for(const vector of[[101,101,102],[101,102],[101,102,102]]){targetRow(pair).dependencies=vector;verdict(pair,["dependency_vector_mismatch"]);}
});
test("an external edge remains unsupported even when the same number appears on both sides",()=>{
  const pair=fixture();pair.archive.preserved[2].dependencies=[999];targetRow(pair).dependencies=[999];verdict(pair,["dependency_scope_unsupported"]);
  targetRow(pair).dependencies=[];verdict(pair,["dependency_scope_unsupported","dependency_vector_mismatch"]);
  const extra=fixture();extra.archive.preserved[2].dependencies=[103];targetRow(extra).dependencies=[101];verdict(extra,["dependency_scope_unsupported"]);
});
test("all fifteen unique reasons appear in canonical order with no truncation or private content",()=>{
  const pair=fixture(),target=targetRow(pair);pair.target.preserved.push(row(500,"SCHEMA",null,"extra"));pair.archive.preserved[2].dependencies=[999,1];target.dependencies=[102];
  target.sectionCode=4;target.hadDumper=true;for(const field of["definition","dropStatement","copyStatement","owner","tablespace","tableAccessMethod","withOids"])target[field]=bytes(canary+field);target.relationKind=112;
  pair.target.histories.auth[0].version="changed";pair.target.histories.storage[0].hash="c".repeat(40);verdict(pair,[...reasons]);
});
test("histories reuse the existing helper: order independent, only executed_at ignored, other strings byte-exact",()=>{
  const pair=fixture();pair.target.histories.auth.reverse();pair.target.histories.storage.reverse();pair.target.histories.storage[0].executed_at=null;pair.target.histories.storage[1].executed_at="arbitrary timestamp string";
  assert.equal(compareManagedMigrationHistory(pair.archive.histories,pair.target.histories),true);verdict(pair);
  pair.target.histories.auth[0].version+=" ";verdict(pair,["auth_history_mismatch"]);
  pair.target.histories.storage[0].name+=" ";verdict(pair,["auth_history_mismatch","storage_history_mismatch"]);
  const caseHash=fixture();caseHash.target.histories.storage[0].hash="A".repeat(40);verdict(caseHash,["storage_history_mismatch"]);
});
test("valid divergent histories cannot hide structural refusal in the other side or in a later row",()=>{
  const pair=fixture();pair.archive.histories.auth[0].version="different";targetRow(pair).owner={code:codes[0]};refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");
  const invalid=fixture();invalid.target.histories.storage.push({...invalid.target.histories.storage[0]});refuse(()=>compare(invalid.archive,invalid.target),"INPUT_INVALID");
});
test("only the two approved TABLE DATA identities can be preserved",()=>{
  for(const [namespace,tag]of[["auth","users"],["storage","objects"],["public","schema_migrations"],["auth","migrations"],["storage","schema_migrations"]]){const pair=fixture();pair.archive.preserved.push(row(50,"TABLE DATA",namespace,tag));refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");}
});
test("closed records reject every own extra, symbol, hidden field and accessor without executing it",()=>{
  let reads=0;for(const place of["outer","binding","row","histories","auth","storage"]){for(const attack of["extra","symbol","hidden","getter"]){const pair=fixture(),object={outer:pair.archive,binding:pair.archive.binding,row:pair.archive.preserved[0],histories:pair.archive.histories,auth:pair.archive.histories.auth[0],storage:pair.archive.histories.storage[0]}[place],key=attack==="getter"?Object.keys(object)[0]:attack==="symbol"?Symbol(canary):"extra";
    if(attack==="getter")Object.defineProperty(object,key,{enumerable:true,get(){reads++;throw Error(canary);}});else Object.defineProperty(object,key,{value:canary,enumerable:attack!=="hidden"});refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");}}
  assert.equal(reads,0);
});
test("Proxy including revoked Proxy is refused at every input layer before any trap or getter",()=>{
  let traps=0;for(const revoked of[false,true])for(const place of["outer","binding","preserved","row","dependencies","bytes","histories","auth","authRow","storage","storageRow"]){const pair=fixture(),wrap=value=>{if(revoked){const p=Proxy.revocable(value,{});p.revoke();return p.proxy;}return new Proxy(value,{get(){traps++;throw Error(canary);},ownKeys(){traps++;throw Error(canary);},getOwnPropertyDescriptor(){traps++;throw Error(canary);},getPrototypeOf(){traps++;throw Error(canary);}});};
    if(place==="outer")pair.archive=wrap(pair.archive);else if(place==="binding")pair.archive.binding=wrap(pair.archive.binding);else if(place==="preserved")pair.archive.preserved=wrap(pair.archive.preserved);else if(place==="row")pair.archive.preserved[0]=wrap(pair.archive.preserved[0]);else if(place==="dependencies")pair.archive.preserved[0].dependencies=wrap([]);else if(place==="bytes")pair.archive.preserved[0].tag=wrap(bytes("tag"));else if(place==="histories")pair.archive.histories=wrap(pair.archive.histories);else if(place==="auth")pair.archive.histories.auth=wrap(pair.archive.histories.auth);else if(place==="authRow")pair.archive.histories.auth[0]=wrap(pair.archive.histories.auth[0]);else if(place==="storage")pair.archive.histories.storage=wrap(pair.archive.histories.storage);else pair.archive.histories.storage[0]=wrap(pair.archive.histories.storage[0]);refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");}
  assert.equal(traps,0);
});
test("dense arrays reject holes, hidden indices, symbols, extras and own iteration hooks without calling them",()=>{
  let reads=0;for(const kind of["hole","hidden","extra","symbol","getter","iterator"]){for(const place of["preserved","dependencies","auth","storage"]){const pair=fixture(),array={preserved:pair.archive.preserved,dependencies:pair.archive.preserved[2].dependencies,auth:pair.archive.histories.auth,storage:pair.archive.histories.storage}[place];
    if(kind==="hole")delete array[0];else if(kind==="hidden")Object.defineProperty(array,"0",{enumerable:false});else if(kind==="getter")Object.defineProperty(array,"0",{enumerable:true,get(){reads++;throw Error(canary);}});else Object.defineProperty(array,kind==="symbol"?Symbol(canary):kind==="iterator"?Symbol.iterator:"extra",{value:()=>{reads++;throw Error(canary);}});refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");}}
  assert.equal(reads,0);
});
test("inherited toJSON, valueOf and iterators are never called; null-prototype data records remain valid",()=>{
  const pair=fixture();let reads=0;const poison={toJSON(){reads++;throw Error(canary);},valueOf(){reads++;throw Error(canary);},[Symbol.iterator](){reads++;throw Error(canary);}};
  Object.setPrototypeOf(pair.archive,poison);Object.setPrototypeOf(pair.archive.histories.auth[0],poison);Object.setPrototypeOf(pair.archive.preserved[2].dependencies,poison);Object.setPrototypeOf(pair.target.binding,null);verdict(pair);assert.equal(reads,0);
});
test("ByteString uses captured intrinsics, ignoring caller buffer/length/method/iterator shadows",()=>{
  const pair=fixture();let reads=0;for(const name of["buffer","byteLength","byteOffset","length","set","fill",Symbol.iterator])Object.defineProperty(pair.archive.preserved[2].definition,name,{get(){reads++;throw Error(canary);}});verdict(pair);assert.equal(reads,0);
});
test("ByteString refuses SharedArrayBuffer, detach including empty detach, other views and coercible impostors",()=>{
  for(const value of[new Uint8Array(new SharedArrayBuffer(1)),new DataView(new ArrayBuffer(1)),new Uint16Array(1),[],{},"",{buffer:new ArrayBuffer(1),byteLength:1},Object.create(Uint8Array.prototype)]){const pair=fixture();pair.archive.preserved[2].definition=value;refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");}
  for(const size of[0,1]){const pair=fixture(),buffer=new ArrayBuffer(size),view=new Uint8Array(buffer);structuredClone(buffer,{transfer:[buffer]});pair.archive.preserved[2].definition=view;refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");}
});
test("binding sides and exact correlation fields cannot be swapped or promoted by booleans",()=>{
  for(const change of[p=>[p.archive.binding,p.target.binding]=[p.target.binding,p.archive.binding],p=>p.target.binding.archiveSha256="a".repeat(64),p=>p.archive.binding.databaseSha256="A".repeat(64),p=>p.target.binding.projectRef="T".repeat(20),p=>p.target.binding.databaseName="template1",p=>p.archive.version=2,p=>p.target.binding.nativeDumpBytes=0,p=>p.archive.binding.databaseBytes="1048576"]){const pair=fixture();change(pair);refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");}
  for(const side of["archive","target"]){const pair=fixture();pair[side].binding[side==="archive"?"databaseBytes":"nativeDumpBytes"]=limits.databaseBytes;verdict(pair);pair[side].binding[side==="archive"?"databaseBytes":"nativeDumpBytes"]++;refuse(()=>compare(pair.archive,pair.target),"LIMIT_EXCEEDED");}
});
test("physical metadata validates enums and safe bounds but never acts as semantic equality",()=>{
  for(const [field,value]of[["ordinal",-1],["ordinal",Infinity],["dumpId",0],["catalogClassOid",4294967296],["catalogObjectOid",-1],["sectionCode",0],["sectionCode",5],["hadDumper",1],["kind",canary],["relationKind",1],["customDataState",0],["customDataOffset",0],["customDataOffset",-1n],["customDataOffset",18446744073709551616n]]){const pair=fixture();targetRow(pair)[field]=value;refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");}
});
test("duplicate IDs or ambiguous identities, nonpositive dependencies and self edges use the graph error",()=>{
  for(const change of[p=>p.archive.preserved[1].dumpId=1,p=>p.archive.preserved.push({...structuredClone(p.archive.preserved[0]),dumpId:500}),p=>p.archive.preserved[2].dependencies=[0],p=>p.archive.preserved[2].dependencies=[-1],p=>p.archive.preserved[2].dependencies=[3]]){const pair=fixture();change(pair);refuse(()=>compare(pair.archive,pair.target),"GRAPH_INVALID");}
  for(const value of[NaN,1.1,"1",{},1n]){const pair=fixture();pair.archive.preserved[2].dependencies=[value];refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");}
});
test("history shape, versions, names, IDs and hashes remain strict before calling the old helper",()=>{
  for(const change of[h=>h.auth.push({...h.auth[0]}),h=>h.auth[0].version="",h=>h.auth[0].version="a\0b",h=>h.auth[0].version="\ud800",h=>h.storage[0].id=-1,h=>h.storage[1].id=0,h=>h.storage[1].name="first",h=>h.storage[0].name="",h=>h.storage[0].name="a\0b",h=>h.storage[0].hash="z".repeat(40),h=>h.storage[0].hash="a".repeat(39),h=>h.storage[0].executed_at=0,h=>h.storage[0].extra=canary]){const pair=fixture();change(pair.archive.histories);refuse(()=>compare(pair.archive,pair.target),"INPUT_INVALID");}
});
test("array and database quotas refuse before traversing oversized payload accessors",()=>{
  let reads=0;const pair=fixture(),large=[];large.length=limits.records+1;Object.defineProperty(large,"0",{get(){reads++;throw Error(canary);},enumerable:true});pair.archive.preserved=large;refuse(()=>compare(pair.archive,pair.target),"LIMIT_EXCEEDED");
  const edge=fixture(),edges=[];edges.length=limits.dependencies+1;Object.defineProperty(edges,"0",{get(){reads++;throw Error(canary);},enumerable:true});edge.archive.preserved[2].dependencies=edges;refuse(()=>compare(edge.archive,edge.target),"LIMIT_EXCEEDED");assert.equal(reads,0);
});
test("dependency limit is cumulative with multiplicity, including exactly100000 retained edges",()=>{
  const pair=fixture();pair.archive.preserved=[row(1,"SCHEMA",null,"auth"),row(2,"TABLE","auth","users",Array(limits.dependencies).fill(1))];pair.target.preserved=structuredClone(pair.archive.preserved);verdict(pair);pair.archive.preserved[0].dependencies=[2];refuse(()=>compare(pair.archive,pair.target),"LIMIT_EXCEEDED");
});
test("TOC fields are bounded individually and cumulatively before hashing or copying volumetric identities",()=>{
  const pair=fixture();pair.archive.preserved[0].tag=new Uint8Array(limits.fieldBytes+1);refuse(()=>compare(pair.archive,pair.target),"LIMIT_EXCEEDED");
  const block=new Uint8Array(limits.fieldBytes).fill(65),boundary=fixture(),record=row(1,"SCHEMA",null,"unused");for(const field of strings)record[field]=field==="withOids"?null:block;boundary.archive.preserved=[record];boundary.target.preserved=[{...record,dumpId:101}];verdict(boundary);
  boundary.archive.preserved[0].withOids=new Uint8Array(1);refuse(()=>compare(boundary.archive,boundary.target),"LIMIT_EXCEEDED");
});
test("history row and UTF8 byte quotas are cumulative across both histories, not only UTF16 lengths",()=>{
  const pair=fixture();pair.archive.histories={auth:Array.from({length:limits.historyRows},(_,i)=>({version:String(i)})),storage:[{id:0,name:"x",hash:"a".repeat(40),executed_at:null}]};refuse(()=>compare(pair.archive,pair.target),"LIMIT_EXCEEDED");
  const wide=fixture();wide.archive.histories={auth:[{version:"é".repeat(limits.historyBytes/2+1)}],storage:[]};refuse(()=>compare(wide.archive,wide.target),"LIMIT_EXCEEDED");
  const exact=fixture();exact.archive.histories={auth:[{version:"x".repeat(limits.historyBytes)}],storage:[]};exact.target.histories=exact.archive.histories;verdict(exact);exact.target.histories={auth:[{version:"x".repeat(limits.historyBytes)}],storage:[{id:0,name:"x",hash:"a".repeat(40),executed_at:null}]};refuse(()=>compare(exact.archive,exact.target),"LIMIT_EXCEEDED");
});
