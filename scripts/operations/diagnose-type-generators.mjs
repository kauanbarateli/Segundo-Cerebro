/** Offline diagnostic only. The raw comparator remains the release decision. */
import ts from "typescript";
import { compareDatabaseTypeSources } from "./check-database-types.mjs";

const members = node => new Map((node?.members ?? []).filter(ts.isPropertySignature).map(member => [member.name.getText().replace(/^['"]|['"]$/g, ""), member]));
function schema(source) {
  const tree = ts.createSourceFile("types.ts", source, ts.ScriptTarget.Latest, true);
  const database = tree.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === "Database");
  return members(members(database?.type).get("public")?.type);
}
const compactType = node => node?.type?.getText().replace(/\s+/g, "").replace(/\((string|number|boolean)\)\[\]/g, "$1[]") ?? "";
const GENERATED_OUTPUT = new Map([["text", "string|null"], ["uuid", "string|null"], ["integer", "number|null"], ["bigint", "number|null"], ["boolean", "boolean|null"], ["tsvector", "unknown"]]);

/**
 * Catalog rows are operator-supplied observations, not verified provenance.
 * No projected match establishes TypeScript assignability or release readiness.
 */
export function diagnoseTypeGenerators(baseline, snapshot, columns) {
  const raw = compareDatabaseTypeSources(baseline, snapshot, true);
  if (!["SNAPSHOT_MATCH", "SNAPSHOT_DIFFER"].includes(raw.code) || !Array.isArray(columns) || columns.length > 1000) throw new Error("DIAGNOSTIC_INPUT_REFUSED");
  const catalog = new Map();
  for (const row of columns) {
    if (!row || typeof row.relation !== "string" || typeof row.column_name !== "string" || typeof row.sql_type !== "string" || typeof row.sql_not_null !== "boolean" || typeof row.generated !== "string") throw new Error("DIAGNOSTIC_INPUT_REFUSED");
    const key = `${row.relation}.${row.column_name}`;
    if (catalog.has(key)) throw new Error("DIAGNOSTIC_INPUT_REFUSED");
    catalog.set(key, row);
  }
  const before = schema(baseline), after = schema(snapshot), edits = [], counts = { computed: 0, json: 0, generated: 0, noArgs: 0 };
  const replace = (node, value) => edits.push([node.getStart(), node.end, value]);
  for (const section of ["Tables", "Views"]) {
    for (const [name, oldRelation] of members(before.get(section)?.type)) {
      const newRelation = members(after.get(section)?.type).get(name);
      if (!newRelation) continue;
      const oldParts = members(oldRelation.type), newParts = members(newRelation.type);
      const computed = oldParts.get("ComputedFields");
      if (computed && !newParts.has("ComputedFields") && compactType(computed) === "never") { replace(computed, ""); counts.computed++; }
      for (const operation of ["Row", "Insert", "Update"]) {
        const oldFields = members(oldParts.get(operation)?.type), newFields = members(newParts.get(operation)?.type);
        for (const [field, oldField] of oldFields) {
          const newField = newFields.get(field), metadata = catalog.get(`${name}.${field}`);
          if (!newField || !!oldField.questionToken !== !!newField.questionToken || !metadata) continue;
          const previous = compactType(oldField), next = compactType(newField);
          if (metadata.sql_type === "jsonb" && metadata.sql_not_null && previous === "NonNullable<Json>" && next === "Json") counts.json++;
          else if (metadata.generated === "s" && !metadata.sql_not_null && operation !== "Row" && previous === "never" && GENERATED_OUTPUT.get(metadata.sql_type) === next) counts.generated++;
          else continue;
          replace(oldField.type, newField.type.getText());
        }
      }
    }
  }
  for (const [name, oldFunction] of members(before.get("Functions")?.type)) {
    const newFunction = members(after.get("Functions")?.type).get(name);
    const oldArgs = members(oldFunction.type).get("Args"), newArgs = members(newFunction?.type).get("Args");
    if (compactType(oldArgs) === "Record<PropertyKey,never>" && compactType(newArgs) === "never") { replace(oldArgs.type, "never"); counts.noArgs++; }
  }
  let projected = baseline;
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) projected = projected.slice(0, start) + replacement + projected.slice(end);
  return { raw, counts, afterKnownGeneratorChanges: compareDatabaseTypeSources(projected, snapshot, true), provenanceVerified: false, compatibilityProved: false };
}
