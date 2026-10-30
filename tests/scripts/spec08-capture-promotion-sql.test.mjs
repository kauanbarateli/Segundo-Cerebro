import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";

// Only the canonical loader applies migrations; these independent assertions
// roll back every synthetic record. This is not a hosted Storage acceptance.
test("SPEC08 E4: canonical rich creation, promotion, ownership, holders and rollback", async () => {
  const sql = await readFile(new URL("../../supabase/tests/capture-promotion.sql", import.meta.url), "utf8");
  assert.ok(!sql.includes("DRAFT_NOT_AUTHORIZED_FOR_APPLICATION"));
  assert.match(sql, /rollback;\s*$/i);
  const db = await createLocalCanonicalSql();
  try { await db.exec(sql); } finally { await db.close(); }
});
