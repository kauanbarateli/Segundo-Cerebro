import { createHash } from "node:crypto";
import { planManagedRestore, planManagedTargetInspection } from "../../../scripts/operations/restore-managed-plan.mjs";
import { extractCustomArchiveToc, extractCustomTargetInspectionToc, discardCustomArchiveToc, discardCustomTargetInspectionToc } from "../../../scripts/operations/restore-custom-toc.mjs";
import { extractMigrationHistory, extractInspectionMigrationHistory, discardMigrationHistory, discardInspectionMigrationHistory } from "../../../scripts/operations/restore-migration-history.mjs";

// Public hand-authored wire vectors. Import has no IO and schedules no tests.
const hash=bytes=>createHash("sha256").update(bytes).digest("hex"),integer=value=>{const out=Buffer.alloc(5);out[0]=value<0?1:0;out.writeUInt32LE(Math.abs(value),1);return out;};
const string=value=>value===null?integer(-1):Buffer.concat([integer(Buffer.byteLength(value)),Buffer.from(value)]);
const AUTH="COPY auth.schema_migrations (version) FROM stdin;\n",STORAGE="COPY storage.migrations (id, name, hash, executed_at) FROM stdin;\n";
const HEAD=Buffer.from("5047444d5001100004080101"+"0017000000002a000000000f00000000100000000009000000007e0000000000000000"+"0008000000706f737467726573000400000031372e36000400000031382e34","hex");
const BASE=[
  [1,"ENCODING","-","ENCODING","",[]],[2,"STDSTRINGS","-","STDSTRINGS","",[]],[3,"SEARCHPATH","-","SEARCHPATH","",[]],
  [4,"SCHEMA","-","auth","supabase_auth_admin",[]],[5,"SCHEMA","-","storage","supabase_storage_admin",[]],[6,"SCHEMA","-","app_private","postgres",[]],
  [7,"TABLE","auth","users","supabase_auth_admin",[4]],[8,"TABLE","storage","objects","supabase_storage_admin",[5]],[9,"TABLE","storage","buckets","supabase_storage_admin",[5]],
  [10,"TABLE","auth","schema_migrations","supabase_auth_admin",[4]],[11,"TABLE","storage","migrations","supabase_storage_admin",[5]],
  [12,"TABLE DATA","auth","users","supabase_auth_admin",[7]],[13,"TABLE DATA","auth","schema_migrations","supabase_auth_admin",[10]],[14,"TABLE DATA","storage","migrations","supabase_storage_admin",[11]],
  [15,"TRIGGER","auth","users second_brain_identity_created","postgres",[7]],[16,"TRIGGER","auth","users second_brain_admin_creation_final","postgres",[7]],
  [17,"POLICY","storage","objects second_brain_private_objects","supabase_storage_admin",[8]],[18,"POLICY","storage","buckets second_brain_private_buckets","supabase_storage_admin",[9]],
  [20,"SCHEMA","-","public","postgres",[]],[21,"FUNCTION","public","observed_function(integer, text)","postgres",[20]],
  [22,"ACL","public","FUNCTION observed_function(integer, text)","postgres",[21]],[23,"DEFAULT ACL","public","DEFAULT PRIVILEGES FOR FUNCTIONS","postgres",[20]],
  [24,"TABLE","public","product_note","postgres",[20]],[25,"TABLE DATA","public","product_note","postgres",[24]],
];
const defaults=()=>({auth:[{version:"20240101"}],storage:[{id:0,name:"initial",hash:"a".repeat(40),executed_at:null}]});
const copyValue=value=>value===null?"\\N":String(value).replaceAll("\\","\\\\").replaceAll("\t","\\t").replaceAll("\n","\\n").replaceAll("\r","\\r");
function rowValue(row){
  const data=row.kind==="TABLE DATA";
  return {definition:row.id===1?"SET client_encoding = 'UTF8';\n":row.id===2?"SET standard_conforming_strings = 'on';\n":row.id===3?"SELECT pg_catalog.set_config('search_path', '', false);\n":data?null:"-- PUBLIC_ARTIFICIAL_DEFINITION\n",
    dropStatement:null,copyStatement:row.id===13?AUTH:row.id===14?STORAGE:data?"COPY public.synthetic_opaque (value) FROM stdin;\n":null,tablespace:null,tableAccessMethod:row.kind==="TABLE"?"heap":null,relationKind:row.kind==="TABLE"?114:0,
    sectionCode:data?3:["TRIGGER","POLICY","DEFAULT ACL","INDEX","CONSTRAINT","FK CONSTRAINT","ROW SECURITY"].includes(row.kind)?4:["ACL","COMMENT"].includes(row.kind)?1:row.kind==="SEQUENCE SET"?3:2,...row};
}
function make(side,options,histories,offset){
  const omit=new Set(options.omit??[]),target=side==="target";
  const rows=BASE.filter(([id])=>!omit.has(id)&&(!target||id!==6&&id<15||id>=20&&id<24)).map(([id,kind,schema,tag,owner,dependencies])=>rowValue({id,kind,schema,tag,owner,dependencies:[...dependencies],...options.overrides?.[id]}));
  for(const extra of options.extraRows??[])rows.push(rowValue({id:extra.id,kind:extra.kind,schema:extra.schema,tag:extra.tag,owner:extra.owner??"postgres",dependencies:extra.dependencies??[],...extra}));
  const parts=[HEAD,integer(rows.length)],nativeRows=rows.map(row=>({...row,id:row.id+offset,dependencies:row.dependencies.map(id=>id+offset)}));
  for(const row of nativeRows){
    const data=row.kind==="TABLE DATA";
    parts.push(integer(row.id),integer(data?1:0),string("0"),string("0"),string(row.tag),string(row.kind),integer(row.sectionCode));
    for(const key of["definition","dropStatement","copyStatement"])parts.push(string(row[key]));
    parts.push(string(row.schema==="-"?null:row.schema),string(row.tablespace),string(row.tableAccessMethod),integer(row.relationKind),string(row.owner),string("false"),...row.dependencies.map(id=>string(String(id))),integer(-1),Buffer.from([data?1:3]),Buffer.alloc(8));
  }
  const database=Buffer.concat([...parts,Buffer.from([0xff,0xfe,0x00,0x80])]),toc=";     TOC Entries: "+nativeRows.length+"\n;     Format: CUSTOM\n;     Dumped by pg_dump version: 18.4\n; Selected TOC Entries:\n"+nativeRows.map(row=>`${row.id}; 0 0 ${row.kind} ${row.schema} ${row.tag} ${row.owner}\n`+(row.dependencies.length?";\tdepends on: "+row.dependencies.join(" ")+"\n":"")).join("");
  const plan=target?planManagedTargetInspection(toc,{projectRef:"t".repeat(20),databaseName:"postgres",nativeDumpSha256:hash(database),nativeDumpBytes:database.length}):planManagedRestore(toc,{archiveSha256:"a".repeat(64),databaseSha256:hash(database),databaseBytes:database.length});
  let tocHandle,historyHandle,stdout;
  try{
    tocHandle=target?extractCustomTargetInspectionToc(plan,database):extractCustomArchiveToc(plan,database);
    const preamble="--\n-- PostgreSQL database dump\n--\n\n\\restrict SCBaselineV1\n\n-- Dumped from database version 17.6\n-- Dumped by pg_dump version 18.4\n\nSET statement_timeout = 0;\nSET lock_timeout = 0;\nSET idle_in_transaction_session_timeout = 0;\nSET transaction_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSELECT pg_catalog.set_config('search_path', '', false);\nSET check_function_bodies = false;\nSET xmloption = content;\nSET client_min_messages = warning;\nSET row_security = off;\n\n";
    let script=preamble;
    for(const row of rows.filter(row=>row.kind==="TABLE DATA"&&(row.schema==="auth"&&row.tag==="schema_migrations"||row.schema==="storage"&&row.tag==="migrations"))){
      const kind=row.schema==="auth"?"auth":"storage",columns=kind==="auth"?["version"]:["id","name","hash","executed_at"];
      script+="--\n-- Data for Name: "+row.tag+"; Type: TABLE DATA; Schema: "+row.schema+"; Owner: "+row.owner+"\n--\n\n"+row.copyStatement+histories[kind].map(item=>columns.map(column=>copyValue(item[column])).join("\t")+"\n").join("")+"\\.\n\n\n";
    }
    stdout=Buffer.from(script+"--\n-- PostgreSQL database dump complete\n--\n\n\\unrestrict SCBaselineV1\n\n");
    historyHandle=target?extractInspectionMigrationHistory(tocHandle,stdout):extractMigrationHistory(tocHandle,stdout);
    return {database,toc,stdout,plan,tocHandle,historyHandle,discard(){if(target){discardInspectionMigrationHistory(historyHandle);discardCustomTargetInspectionToc(tocHandle);}else{discardMigrationHistory(historyHandle);discardCustomArchiveToc(tocHandle);}database.fill(0);stdout.fill(0);}};
  }catch(error){if(target){discardInspectionMigrationHistory(historyHandle);discardCustomTargetInspectionToc(tocHandle);}else{discardMigrationHistory(historyHandle);discardCustomArchiveToc(tocHandle);}database.fill(0);stdout?.fill(0);throw error;}
}

/** Reusable public fixture only. Overrides alter artificial list+CUSTOM bytes
 * before nominal extraction; no private store or authority port is exported. */
export function createInspectedBaselineFixture(options={}){
  const source=make("source",options.source??{},options.sourceHistories??defaults(),0);let target;
  try{target=make("target",options.target??{},options.targetHistories??defaults(),options.targetIdOffset??100);}catch(error){source.discard();throw error;}
  return {source,target,handles:Object.freeze([source.plan,source.tocHandle,source.historyHandle,target.tocHandle,target.historyHandle]),discard(){source.discard();target.discard();}};
}
