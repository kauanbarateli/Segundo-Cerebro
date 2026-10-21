import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";

// Prepared for the GitHub runner. One disposable canonical DB, one SQL file at
// a time; no hosted Supabase, service, credential or local execution is implied.
test("SPEC08 Capture documents: canonical catalogue, writes, receipts and event capacity", async t => {
  const db = await createLocalCanonicalSql();
  try {
    for (const name of ["capture-document-catalog.sql", "capture-document-behavior.sql", "capture-document-event-capacity.sql"]) {
      const keys = ["document_compact_bytes", "document_jsonb_bytes", "cache_utf16", "cache_jsonb_bytes", "metadata_base_bytes", "payload1_bytes", "payload2_bytes", "residual_fields_structure_bytes", "upgrade_pair_bytes", "resave_pair_bytes", "upgrade_envelope_bytes", "resave_envelope_bytes", "event_envelope_bytes", "upgrade_receipt_request_bytes", "receipt_request_bytes", "upgrade_result_bytes", "result_bytes"];
      const snapshots = new Map(), lifecycle = new Map(); let metrics = null, refused = false;
      const bounded = value => Number.isSafeInteger(value) && value > 0 && value <= 8388608;
      function onNotice(notice) {
        // Never retain/log the Notice object, SQL text, detail, where or an
        // arbitrary message. Only these fixed numeric messages can leave SQL.
        const message = notice?.message;
        if (typeof message !== "string") return;
        const prefix = "Capture event capacity metrics: ";
        if (message.startsWith(prefix)) {
          if (metrics !== null || message.length > 4096) { refused = true; return; }
          try {
            const value = JSON.parse(message.slice(prefix.length));
            if (!value || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key) || !bounded(value[key]))) { refused = true; return; }
            metrics = Object.fromEntries(keys.map(key => [key, value[key]]));
          } catch { refused = true; }
        } else if (message.startsWith("Capture snapshot after ")) {
          const match = /^Capture snapshot after (resave|metadata|continuation) bytes: ([1-9][0-9]{0,6})$/.exec(message);
          if (!match || snapshots.has(match[1]) || !bounded(Number(match[2]))) { refused = true; return; }
          snapshots.set(match[1], Number(match[2]));
        } else if (message.startsWith("Capture lifecycle step ")) {
          const match = /^Capture lifecycle step ([1-4]) snapshot bytes: ([1-9][0-9]{0,6})$/.exec(message);
          if (!match || lifecycle.has(Number(match[1])) || !bounded(Number(match[2]))) { refused = true; return; }
          lifecycle.set(Number(match[1]), Number(match[2]));
        }
      }
      const source = await readFile(new URL("../../supabase/tests/" + name, import.meta.url), "utf8");
      await db.exec(source, name === "capture-document-event-capacity.sql" ? { onNotice } : undefined);
      const { rows } = await db.query("select (select count(*)::integer from auth.users) users,(select count(*)::integer from public.captures) captures,(select count(*)::integer from public.domain_events) events,(select count(*)::integer from app_private.command_receipts) receipts");
      assert.deepEqual(rows, [{ users: 0, captures: 0, events: 0, receipts: 0 }], name + " must roll back every synthetic row");
      if (name === "capture-document-event-capacity.sql") {
        assert.equal(refused, false, "capacity notices must remain in the closed numeric schema");
        assert.notEqual(metrics, null, "SQL must emit its observed capacity metrics");
        assert.equal(snapshots.size, 3); assert.equal(lifecycle.size, 4);
        assert.equal(metrics.document_compact_bytes, 524288);
        assert.ok(metrics.resave_pair_bytes > 1048576 && metrics.resave_pair_bytes <= 2097152);
        t.diagnostic(JSON.stringify({ schemaVersion: 1, scenario: "spec08-capture-event-capacity", metrics, snapshots: Object.fromEntries(snapshots), lifecycle: [1, 2, 3, 4].map(step => ({ step, snapshot_bytes: lifecycle.get(step) })) }));
      }
    }
  } finally { await db.close(); }
});
