import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { checkPublicDatabaseContracts, inspectLocalPublicDatabaseContracts } from "../../scripts/operations/database-contracts.mjs";
const source = `export type Json = string | null; export type Database = { public: {
 Tables: { records: { Row: { id: string; label: string | null }; Insert: { id: string; label?: string | null }; Update: { id?: string; label?: string | null }; Relationships: [] } };
 Views: { record_summary: { Row: { total: number | null }; Relationships: [] } };
 Functions: { write_record: { Args: { p_id: string; p_label?: string }; Returns: Json }; cleanup: { Args: never; Returns: undefined } };
 Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never };
} }`;
const metadata = () => ({ relations: [{name:"records",kind:"table"},{name:"record_summary",kind:"view"}], columns: [{relation:"records",name:"id"},{relation:"records",name:"label"},{relation:"record_summary",name:"total"}], rpcs: [{name:"write_record",modes:null,args:[{name:"p_id",optional:false},{name:"p_label",optional:true}]},{name:"cleanup",modes:null,args:[]}] });
test("complete public inventory, exact column names, defaulted Args and noarg RPC match", () => {
  assert.deepEqual(checkPublicDatabaseContracts(source, metadata()), { tables:1,views:1,rpcs:2,columns:3,arguments:2 });
});
test("real metadata changes fail independently of a generated snapshot comparing equal to itself", () => {
  for (const [change,code] of [
    [m => m.relations.push({name:"new_table",kind:"table"}),"LOCAL_TABLES_DIFFER"],
    [m => m.relations.splice(1,1),"LOCAL_VIEWS_DIFFER"],
    [m => m.columns[1].name="title","LOCAL_COLUMNS_DIFFER"],
    [m => m.rpcs.pop(),"LOCAL_RPCS_DIFFER"],
    [m => m.rpcs[0].args[0].name="p_record","LOCAL_RPC_ARGS_DIFFER"],
    [m => m.rpcs[0].args[1].optional=false,"LOCAL_RPC_DEFAULTS_DIFFER"],
    [m => m.rpcs.push({...m.rpcs[0]}),"LOCAL_RPCS_DIFFER"],
  ]) { const actual=metadata(); change(actual); assert.throws(() => checkPublicDatabaseContracts(source,actual), { message:code }); }
});
test("unreviewed overload shapes and nonpublic or executable input cannot pass local gate", () => {
  const overload = source.replace("cleanup: { Args: never; Returns: undefined }", "cleanup: { Args: never; Returns: undefined } | { Args: { p_id: string }; Returns: Json }");
  assert.throws(() => checkPublicDatabaseContracts(overload,metadata()), { message:"LOCAL_RPC_OVERLOAD_REVIEW_REQUIRED" });
  for (const invalid of [source.replace("public:","app_private:"), source+"; process.exit(0)"]) assert.throws(() => checkPublicDatabaseContracts(invalid,metadata()), { message:"LOCAL_TYPES_INVALID" });
});
test("local inspector only reads fixed pg_catalog inventory without app RPCs, DDL, rows or credentials", async () => {
  const seen=[], values=metadata(), answers=[values.relations,values.columns,values.rpcs];
  const db={ async query(sql) { seen.push(sql); return {rows:answers.shift()}; } };
  assert.deepEqual(await inspectLocalPublicDatabaseContracts(db,source), { tables:1,views:1,rpcs:2,columns:3,arguments:2 });
  assert.equal(seen.length,3);
  for (const sql of seen) { assert.match(sql,/^select /i); assert.match(sql,/pg_catalog/); assert.match(sql,/n.nspname='public'/); assert.doesNotMatch(sql,/\b(insert|update|delete|create|alter|call)\b/i); }
});
test("actual PostgreSQL OUT-before-IN metadata cannot disguise the input argument as the OUT name", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table public.records(id text primary key,label text); create view public.record_summary as select count(*) as total from public.records;
      create function public.write_record(OUT p_id text, IN p_real_input text, IN p_label text default 'x') returns text language sql as $$ select p_real_input $$;
      create function public.cleanup() returns void language sql as $$ select $$;`);
    const {rows} = await db.query("select proargnames,pronargs,pronargdefaults,proargmodes from pg_catalog.pg_proc where proname='write_record'");
    assert.deepEqual(rows[0].proargnames, ["p_id","p_real_input","p_label"]); assert.equal(rows[0].pronargs,2); assert.deepEqual(rows[0].proargmodes,["o","i","i"]);
    // Control reproduces the old positional projection from actual PG metadata:
    // it treats OUT p_id as required input and the real required input as optional.
    const misleading = source.replace("p_label?: string", "p_real_input?: string"), legacy = metadata();
    legacy.rpcs[0].args = rows[0].proargnames.slice(0,rows[0].pronargs).map((name,i) => ({name,optional:i>=rows[0].pronargs-rows[0].pronargdefaults}));
    assert.deepEqual(checkPublicDatabaseContracts(misleading,legacy), {tables:1,views:1,rpcs:2,columns:3,arguments:2});
    await assert.rejects(inspectLocalPublicDatabaseContracts(db,misleading), {message:"LOCAL_RPC_MODES_REVIEW_REQUIRED"});
    await assert.rejects(inspectLocalPublicDatabaseContracts(db,source), {message:"LOCAL_RPC_MODES_REVIEW_REQUIRED"});
    for (const modes of [["i","o"],["b"],["v"],["t"],undefined]) { const actual=metadata();actual.rpcs[0].modes=modes;assert.throws(() => checkPublicDatabaseContracts(source,actual), {message:"LOCAL_RPC_MODES_REVIEW_REQUIRED"}); }
  } finally { await db.close(); }
});
