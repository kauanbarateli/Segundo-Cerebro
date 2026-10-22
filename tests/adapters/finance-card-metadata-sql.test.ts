/** Canonical-chain disposable PostgreSQL; no hosted client, service or secret. */
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";

it("T052 canonical: legacy/null, owner/FK/eligibility, CAS, receipt/event and late rollback", async () => {
  const db = await createLocalCanonicalSql();
  try {
    // The canonical fixture has already applied the numbered chain exactly once.
    // Assertions stay separate and roll back every synthetic row and failure hook.
    await db.exec(await readFile(new URL("../../supabase/tests/finance-card-metadata.sql", import.meta.url), "utf8"));
    // The fixtures and injected failure belong to the rolled-back test only.
    expect((await db.query("select count(*)::int as count from auth.users")).rows).toEqual([{ count: 0 }]);
    expect((await db.query("select count(*)::int as count from public.fin_accounts")).rows).toEqual([{ count: 0 }]);
    expect((await db.query("select count(*)::int as count from pg_trigger where tgname='t052_receipt_failure'")).rows).toEqual([{ count: 0 }]);
  } finally { await db.close(); }
}, 120_000);
