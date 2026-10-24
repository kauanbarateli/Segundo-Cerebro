/** Pure Source controls for the external CURRENT27 catalogue draft.
 * No SQL evaluation, DB, factory, SDK, environment or release acceptance.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
const root = new URL("../../", import.meta.url);
const source = await readFile(new URL("supabase/tests/release-catalog.sql", root), "utf8");
const historical = await readFile(new URL("tests/fixtures/schema-release-026/release-catalog.sql", root));
const sha = value => createHash("sha256").update(value).digest("hex");
const tag = "$finance27$", first = source.indexOf(tag), last = source.indexOf(tag, first + tag.length);
assert.ok(first >= 0 && last > first && source.indexOf(tag, last + tag.length) === -1);
const data = JSON.parse(source.slice(first + tag.length, last));

test("historical026 remains the exact inert82143-byte reference", () => {
  assert.equal(historical.length, 82143);
  assert.equal(sha(historical), "4557741f008d48ea60ad8a3e2d5a41667630543c3bf2ab0682ec2b33ad97e297");
});
test("CURRENT27 SQL is the reviewed Source-derived byte contract", () => {
  assert.equal(sha(source), "19b5f158dfd2003fa89285df99f4ab2e0287ee411b07b9a6b0bc7e6fb82f6e9e");
  assert.deepEqual(Object.keys(data).sort(), ["columnDefaults", "constraints", "eventPredicate", "functionDefaults", "functions", "indexPredicate", "indexes", "relations", "rpc", "triggers"]);
  assert.equal(data.functions.length, 102); assert.equal(new Set(data.functions.map(value => value.signature)).size, 102);
  assert.equal(data.relations.length, 8); assert.equal(data.indexes.length, 8);
  assert.equal(data.triggers.length, 19); assert.equal(data.rpc.length, 12);
});
test("protocol1 readonly wrapper and historical normalized count formula remain byte-exact", () => {
  assert.ok(source.includes("begin transaction read only;\nset local statement_timeout='30s';\nset local lock_timeout='5s';"));
  assert.ok(source.includes("set local search_path=pg_catalog,public;"));
  const tail = text => text.slice(text.lastIndexOf("\nselect jsonb_build_object('version',1"));
  assert.equal(tail(source), tail(historical.toString("utf8")));
  assert.ok(tail(source).endsWith(" from checks;\nrollback;\n"));
  assert.equal(tail(source).includes("expectedRelease"), false);
});
test("service mappings preserve invokerSeries versus definerGoals and M1", () => {
  const service = data.functions.filter(value => value.service && value.signature.startsWith("app_private.")).map(value => value.signature).sort();
  assert.deepEqual(service, [
    "app_private.finance_commit(uuid,uuid,text,jsonb)", "app_private.finance_snapshot(uuid,uuid,text)",
    "app_private.fsv2_commit(uuid,uuid,text,jsonb)", "app_private.fsv2_detail(uuid,uuid,uuid)",
    "app_private.fsv2_page(uuid,uuid,uuid,integer)", "app_private.fsv2_snapshot(uuid,uuid,jsonb)",
  ]);
  assert.equal(data.rpc.filter(value => !value.publicSecurityDefiner).length, 4);
  assert.ok(source.includes("r.e->>'privateSignature'"));
  assert.ok(source.includes("e.signature not in ('public.finance_series_snapshot"));
});
test("forty-eight Source constraints include an explicit linked constraint trigger", () => {
  const counts = Object.fromEntries(["p", "u", "f", "c", "t"].map(type => [type, data.constraints.filter(value => value.type === type).length]));
  assert.deepEqual(counts, { p: 8, u: 9, f: 15, c: 15, t: 1 });
  assert.equal(new Set(data.constraints.map(value => value.relation + "." + value.name)).size, 48);
  const constraint = data.constraints.find(value => value.type === "t");
  assert.equal(constraint.name, "finance_series_permit_zero");
  assert.equal(constraint.relation, "app_private.finance_series_permits");
  assert.equal(constraint.definition, "TRIGGER DEFERRABLE INITIALLY DEFERRED");
  assert.equal(constraint.expression, null); assert.equal(constraint.deferrable, true);
  assert.equal(constraint.initiallyDeferred, true);
  assert.ok(source.includes("join pg_trigger t on t.tgconstraint=c.oid"));
  assert.ok(source.includes("and 1=(select count(*) from pg_trigger linked where linked.tgconstraint=c.oid)"));
  assert.ok(source.includes("and c.contype<>'n'"));
  assert.equal(source.includes("c.contype not in ('n','t')"), false);
});
test("exact defaults, CHECK expressions and partial index replace every pending gate", () => {
  assert.equal(data.columnDefaults.length, 3); assert.equal(data.functionDefaults.length, 7);
  assert.ok(data.constraints.filter(value => value.type === "c").every(value => value.definition === "CHECK (" + value.expression + ")"));
  assert.equal(data.eventPredicate.groups.flat().length, 40);
  assert.equal(data.eventPredicate.definition, "CHECK (" + data.eventPredicate.expression + ")");
  assert.equal(data.indexPredicate.expression, "(image_file_id IS NOT NULL)");
  assert.equal(source.includes("finance27_deparse_pending"), false);
  const exact = source.slice(source.indexOf(" union all select 'finance27_constraint_definition'"));
  assert.equal(exact.includes("regexp_replace"), false);
  assert.equal(exact.includes("replace("), false);
  assert.ok(exact.includes("pg_get_constraintdef(c.oid,false)=e->>'definition'"));
  assert.ok(exact.includes("pg_get_expr(c.conbin,c.conrelid,false) is not distinct from e->>'expression'"));
});
test("DELETE31, image23, event5 and permit21 preserve the distinct Source triggers", () => {
  const project = data.triggers.filter(value => value.name === "goal_project");
  assert.equal(project.length, 4); assert.ok(project.every(value => value.tgtype === 31));
  assert.equal(data.triggers.find(value => value.name === "goal_z_image_binding").tgtype, 23);
  assert.equal(data.triggers.find(value => value.name === "finance_series_permit_zero").tgtype, 21);
  assert.equal(data.triggers.find(value => value.name === "goal_terminal_event").tgtype, 5);
});
test("engine17 and18 are intended; exact strings never accept alternate deparse", () => {
  assert.ok(source.includes("current_setting('server_version_num')::integer/10000 in (17,18)"));
  assert.equal(source.includes("current_setting('server_version_num')::integer/10000=18"), false);
  assert.equal(data.functionDefaults.find(value => value.signature === "app_private.fg_reserved(uuid,uuid,uuid)").expression, "NULL::uuid, NULL::uuid");
  assert.equal(data.columnDefaults.find(value => value.column === "closed_at").expression, "date_trunc('milliseconds'::text, clock_timestamp())");
});

test("constraint_set cardinality has the complete exact comparison before conjunctions", () => {
  const begin = " union all select 'finance27_constraint_set',e->>'name',\n";
  const end = "  and (select count(*) from pg_constraint c where c.conrelid=to_regclass(e->>'name') and c.contype='c')";
  const expected = " union all select 'finance27_constraint_set',e->>'name',\n"
    + "  (select count(*) from pg_constraint c where c.conrelid=to_regclass(e->>'name') and c.contype<>'n') =\n"
    + "   jsonb_array_length(e->'constraints') +\n"
    + "   (select count(*) from finance27_constraint x where x.e->>'relation'=finance27_relation.e->>'name' and x.e->>'type'='t')\n";
  const start = source.indexOf(begin), stop = source.indexOf(end, start);
  assert.ok(start >= 0 && stop > start);
  assert.equal(source.slice(start, stop), expected);
  assert.equal(source.includes("\n+  and "), false);
  assert.equal(source.includes("and c.contype<>'n')+"), false);
});

test("trigger_set correlates to the outer relation and refuses the unqualified regression", () => {
  const start = source.indexOf(" union all select 'finance27_trigger_set'");
  const stop = source.indexOf(" union all select 'finance27_legacy_projection_trigger'", start);
  assert.ok(start >= 0 && stop > start);
  const section = source.slice(start, stop);
  const qualified = "(select count(*) from finance27_trigger x where x.e->>'relation'=finance27_relation.e->>'name')";
  const unqualified = "(select count(*) from finance27_trigger x where x.e->>'relation'=e->>'name')";
  const requireOuterRelation = text => {
    assert.equal(text.includes(qualified), true);
    assert.equal(text.includes(unqualified), false);
  };
  requireOuterRelation(section);
  assert.throws(() => requireOuterRelation(section.replace(qualified, unqualified)));
  assert.deepEqual(data.relations.map(relation => data.triggers.filter(trigger => trigger.relation === relation.name).length), [2, 2, 1, 3, 2, 2, 2, 2]);
  assert.equal(data.triggers.filter(trigger => trigger.relation === trigger.name).length, 0);
  // The clean fresh/upgrade SQL tests still require actual ok=true/2512/[].
});
