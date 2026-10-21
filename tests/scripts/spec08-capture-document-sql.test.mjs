import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";

function sqlErrorLocation(error, name) {
  const diagnostic = { schemaVersion: 1, scenario: "capture-document-sql-error-location", sql_file: name,
    code: null, status: "missing", locations: [] };
  try {
    if (error === null || !["object", "function"].includes(typeof error)) return diagnostic;
    const code = Object.getOwnPropertyDescriptor(error, "code");
    if (code && Object.hasOwn(code, "value") && typeof code.value === "string"
      && code.value.length === 5 && /^[0-9A-Z]{5}$/.test(code.value)) diagnostic.code = code.value;
    const where = Object.getOwnPropertyDescriptor(error, "where");
    if (where === undefined) return diagnostic;
    if (!Object.hasOwn(where, "value") || typeof where.value !== "string" || where.value.length > 16384) {
      diagnostic.status = "refused"; return diagnostic;
    }
    // Only closed function labels and line numbers leave this parser. SQL,
    // context, signatures and the original `where` string are never emitted.
    for (const line of where.value.split(/\r?\n/)) {
      const inline = /^PL\/pgSQL function inline_code_block line ([0-9]+) at [^\r\n]*$/.exec(line);
      const helper = /^PL\/pgSQL function (?:pg_temp(?:_[0-9]+)?\.)?(assert_document|document_error|receipt_physical_probe|document_commit|document_batch)\([^\r\n)]{0,512}\) line ([0-9]+) at [^\r\n]*$/.exec(line);
      if (!inline && !helper) continue;
      const bodyLine = Number(inline ? inline[1] : helper[2]);
      if (!Number.isSafeInteger(bodyLine) || bodyLine < 1 || bodyLine > 99999 || diagnostic.locations.length >= 16) {
        diagnostic.status = "refused"; diagnostic.locations = []; return diagnostic;
      }
      diagnostic.locations.push({ scope: inline ? "inline_code_block" : helper[1], line: bodyLine });
    }
    diagnostic.status = diagnostic.locations.length === 0 ? "missing" : "located";
  } catch {
    diagnostic.status = "refused"; diagnostic.locations = [];
  }
  return diagnostic;
}

// Prepared for the GitHub runner. One disposable canonical DB, one SQL file at
// a time; no hosted Supabase, service, credential or local execution is implied.
test("SPEC08 Capture documents: legacy compatibility, canonical catalogue, writes, receipts and event capacity", async t => {
  // Await each child and close its fresh canonical DB before starting the next.
  // A failed child still fails the parent; it does not hide the later SQL proofs.
  for (const name of ["capture-task-behavior.sql", "capture-document-catalog.sql", "capture-document-behavior.sql", "capture-document-event-capacity.sql"]) {
    await t.test(name, async subtest => {
      const db = await createLocalCanonicalSql();
      try {
        const keys = ["document_compact_bytes", "document_jsonb_bytes", "cache_utf16", "cache_jsonb_bytes", "metadata_base_bytes", "payload1_bytes", "payload2_bytes", "residual_fields_structure_bytes", "upgrade_pair_bytes", "resave_pair_bytes", "upgrade_envelope_bytes", "resave_envelope_bytes", "event_envelope_bytes", "upgrade_receipt_request_bytes", "receipt_request_bytes", "upgrade_result_bytes", "result_bytes"];
        const snapshots = new Map(), lifecycle = new Map(); let metrics = null, refused = false;
        let receiptDiagnostic = null, receiptRefused = false;
        const receiptSizeKeys = ["request_small", "request_large", "result"];
        const receiptConditionKeys = ["small_is_string", "large_is_string", "large_above_1m", "large_within_2m", "result_within_1m", "decoded_is_object", "client_matches", "id_canonical", "roundtrip_equal", "document_equal"];
        const receiptStageKeys = ["decode", "intent", "schema", "projection", "validate", "predicate_small", "predicate_large"];
        const closed = (value, fields) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
        const bounded = value => Number.isSafeInteger(value) && value > 0 && value <= 8388608;
        function onNotice(notice) {
          // Never retain/log the Notice object, SQL text, detail, where or an
          // arbitrary message. Only these fixed numeric messages can leave SQL.
          const message = notice?.message;
          if (typeof message !== "string") return;
          const receiptPrefix = "Capture receipt physical diagnostic: ";
          if (message.startsWith(receiptPrefix)) {
            if (receiptDiagnostic !== null || message.length > 4096) { receiptRefused = true; return; }
            try {
              const value = JSON.parse(message.slice(receiptPrefix.length));
              if (!closed(value, ["schemaVersion", "scenario", "sizes", "preconditions", "stages", "intent_allowed", "predicate_small", "predicate_large"])
                || value.schemaVersion !== 1 || value.scenario !== "capture-document-receipt-diagnostic"
                || !closed(value.sizes, receiptSizeKeys) || receiptSizeKeys.some(key => !Number.isSafeInteger(value.sizes[key]) || value.sizes[key] < 0 || value.sizes[key] > 2097152)
                || !closed(value.preconditions, receiptConditionKeys) || receiptConditionKeys.some(key => typeof value.preconditions[key] !== "boolean")
                || !closed(value.stages, receiptStageKeys) || receiptStageKeys.some(key => typeof value.stages[key] !== "string" || value.stages[key].length !== 5 || !/^[0-9A-Z]{5}$/.test(value.stages[key]))
                || ["intent_allowed", "predicate_small", "predicate_large"].some(key => typeof value[key] !== "boolean")) { receiptRefused = true; return; }
              receiptDiagnostic = { schemaVersion: 1, scenario: "capture-document-receipt-diagnostic",
                sizes: Object.fromEntries(receiptSizeKeys.map(key => [key, value.sizes[key]])),
                preconditions: Object.fromEntries(receiptConditionKeys.map(key => [key, value.preconditions[key]])),
                stages: Object.fromEntries(receiptStageKeys.map(key => [key, value.stages[key]])),
                intent_allowed: value.intent_allowed, predicate_small: value.predicate_small, predicate_large: value.predicate_large };
            } catch { receiptRefused = true; }
            return;
          }
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
        try { await db.exec(source, name === "capture-document-catalog.sql" ? undefined : { onNotice }); }
        catch (error) {
          try { subtest.diagnostic(JSON.stringify(sqlErrorLocation(error, name))); }
          catch { /* Diagnostic failures must not replace the original SQL error. */ }
          throw error;
        }
        finally {
          if (name === "capture-document-behavior.sql") {
            // Emit only the closed diagnostic even when the unchanged physical
            // positive fails. No assertion/catch here may replace its SQL error.
            subtest.diagnostic(JSON.stringify(receiptDiagnostic !== null && !receiptRefused ? receiptDiagnostic :
              { schemaVersion: 1, scenario: "capture-document-receipt-diagnostic", diagnostic_status: receiptRefused ? "rejected" : "missing" }));
          }
        }
        const { rows } = await db.query("select (select count(*)::integer from auth.users) users,(select count(*)::integer from public.captures) captures,(select count(*)::integer from public.domain_events) events,(select count(*)::integer from app_private.command_receipts) receipts");
        assert.deepEqual(rows, [{ users: 0, captures: 0, events: 0, receipts: 0 }], name + " must roll back every synthetic row");
        if (name === "capture-document-behavior.sql") {
          assert.equal(receiptRefused, false, "receipt diagnostic must remain in its closed schema");
          assert.notEqual(receiptDiagnostic, null, "SQL must emit its bounded receipt diagnostic");
        }
        if (name === "capture-document-event-capacity.sql") {
          assert.equal(refused, false, "capacity notices must remain in the closed numeric schema");
          assert.notEqual(metrics, null, "SQL must emit its observed capacity metrics");
          assert.equal(snapshots.size, 3); assert.equal(lifecycle.size, 4);
          assert.equal(metrics.document_compact_bytes, 524288);
          assert.ok(metrics.resave_pair_bytes > 1048576 && metrics.resave_pair_bytes <= 2097152);
          subtest.diagnostic(JSON.stringify({ schemaVersion: 1, scenario: "spec08-capture-event-capacity", metrics, snapshots: Object.fromEntries(snapshots), lifecycle: [1, 2, 3, 4].map(step => ({ step, snapshot_bytes: lifecycle.get(step) })) }));
        }
      } finally { await db.close(); }
    });
  }
});
