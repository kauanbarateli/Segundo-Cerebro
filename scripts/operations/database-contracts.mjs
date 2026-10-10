import ts from "typescript";
import { compareDatabaseTypeSources } from "./check-database-types.mjs";

// This check is called only by the disposable local migration harness. It has no
// connection/configuration/file loader and never invokes an application RPC.
const fail = code => { throw new Error(code); };
const name = node => ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : fail("LOCAL_TYPES_INVALID");
function members(node) {
  if (!ts.isTypeLiteralNode(node)) fail("LOCAL_TYPES_INVALID");
  return new Map(node.members.map(member => [name(member.name), member]));
}
function sameKeys(actual, expected, code) {
  const a = [...actual].sort(), b = [...expected].sort();
  if (a.length !== b.length || a.some((key, i) => key !== b[i])) fail(code);
}

export function checkPublicDatabaseContracts(source, metadata) {
  if (compareDatabaseTypeSources(source, source).code !== "SNAPSHOT_MATCH") fail("LOCAL_TYPES_INVALID");
  const file = ts.createSourceFile("committed-public.ts", source, ts.ScriptTarget.Latest, true);
  const database = file.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === "Database");
  const schema = members(members(database.type).get("public").type);
  const tables = members(schema.get("Tables").type), views = members(schema.get("Views").type), functions = members(schema.get("Functions").type);
  const relations = metadata.relations;
  sameKeys(tables.keys(), relations.filter(row => row.kind === "table").map(row => row.name), "LOCAL_TABLES_DIFFER");
  sameKeys(views.keys(), relations.filter(row => row.kind === "view").map(row => row.name), "LOCAL_VIEWS_DIFFER");
  let columnCount = 0, argumentCount = 0;
  for (const relation of relations) {
    const declared = (relation.kind === "table" ? tables : views).get(relation.name);
    const row = members(members(declared.type).get("Row").type);
    const columns = metadata.columns.filter(column => column.relation === relation.name);
    sameKeys(row.keys(), columns.map(column => column.name), "LOCAL_COLUMNS_DIFFER");
    columnCount += columns.length;
  }
  sameKeys(functions.keys(), metadata.rpcs.map(row => row.name), "LOCAL_RPCS_DIFFER");
  for (const rpc of metadata.rpcs) {
    // proargnames includes OUT/TABLE positions; pronargs/defaults count inputs.
    // Do not silently interpret those mixed signatures as ordinary IN Args.
    if (rpc.modes !== null) fail("LOCAL_RPC_MODES_REVIEW_REQUIRED");
    if (metadata.rpcs.filter(row => row.name === rpc.name).length !== 1) fail("LOCAL_RPC_OVERLOAD_REVIEW_REQUIRED");
    const type = functions.get(rpc.name).type;
    if (!ts.isTypeLiteralNode(type)) fail("LOCAL_RPC_OVERLOAD_REVIEW_REQUIRED");
    const args = members(type).get("Args").type;
    const declared = args.kind === ts.SyntaxKind.NeverKeyword ? new Map() : members(args);
    sameKeys(declared.keys(), rpc.args.map(arg => arg.name), "LOCAL_RPC_ARGS_DIFFER");
    for (const arg of rpc.args) if (Boolean(declared.get(arg.name).questionToken) !== arg.optional) fail("LOCAL_RPC_DEFAULTS_DIFFER");
    argumentCount += rpc.args.length;
  }
  return { tables: tables.size, views: views.size, rpcs: functions.size, columns: columnCount, arguments: argumentCount };
}

export async function inspectLocalPublicDatabaseContracts(db, source) {
  const { rows: relations } = await db.query(`select c.relname as name, case when c.relkind in ('r','p') then 'table' else 'view' end as kind from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m') order by c.relname`);
  const { rows: columns } = await db.query(`select c.relname as relation, a.attname as name from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m') and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum`);
  const { rows: rpcs } = await db.query(`select p.proname as name, p.proargmodes as modes, coalesce((select jsonb_agg(jsonb_build_object('name',p.proargnames[s.i+1],'optional',s.i>=p.pronargs-p.pronargdefaults) order by s.i) from generate_series(0,p.pronargs-1) s(i)), '[]'::jsonb) as args from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prorettype<>'pg_catalog.event_trigger'::regtype and p.prorettype<>'pg_catalog.trigger'::regtype order by p.proname`);
  return checkPublicDatabaseContracts(source, { relations, columns, rpcs });
}
