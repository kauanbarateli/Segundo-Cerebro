import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseTypeGenerators } from "../../scripts/operations/diagnose-type-generators.mjs";

const baseline = `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Database = { public: { Tables: { example: {
 Row: { id: string; payload: NonNullable<Json>; generated: string | null }
 ComputedFields: never
 Insert: { id: string; payload: NonNullable<Json>; generated?: never }
 Update: { id?: string; payload?: NonNullable<Json>; generated?: never }
 Relationships: [] } }; Views: { [_ in never]: never }; Functions: { ping: { Args: Record<PropertyKey, never>; Returns: boolean } }; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } }`;
const snapshot = baseline.replace("ComputedFields: never", "").replaceAll("NonNullable<Json>", "Json").replaceAll("generated?: never", "generated?: string | null").replace("Record<PropertyKey, never>", "never");
const columns = [{ relation: "example", column_name: "payload", sql_type: "jsonb", sql_not_null: true, generated: "" }, { relation: "example", column_name: "generated", sql_type: "text", sql_not_null: false, generated: "s" }];

test("classifica diferenças conhecidas sem alterar resultado bruto ou provar compatibilidade", () => {
  const report = diagnoseTypeGenerators(baseline, snapshot, columns);
  assert.equal(report.raw.code, "SNAPSHOT_DIFFER");
  assert.deepEqual(report.counts, { computed: 1, json: 3, generated: 2, noArgs: 1 });
  assert.equal(report.afterKnownGeneratorChanges.code, "SNAPSHOT_MATCH");
  assert.equal(report.provenanceVerified, false); assert.equal(report.compatibilityProved, false);
});
test("drift adicional ou metadado ausente não vira correspondência", () => {
  assert.equal(diagnoseTypeGenerators(baseline, snapshot.replace("id: string", "id: number"), columns).afterKnownGeneratorChanges.code, "SNAPSHOT_DIFFER");
  assert.equal(diagnoseTypeGenerators(baseline, snapshot.replaceAll("generated?: string | null", "generated?: number | null"), columns).afterKnownGeneratorChanges.code, "SNAPSHOT_DIFFER");
  assert.equal(diagnoseTypeGenerators(baseline, snapshot, []).afterKnownGeneratorChanges.code, "SNAPSHOT_DIFFER");
  assert.throws(() => diagnoseTypeGenerators(baseline, snapshot, [columns[0], columns[0]]), /DIAGNOSTIC_INPUT_REFUSED/);
});
