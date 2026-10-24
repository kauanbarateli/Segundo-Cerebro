import test from "node:test";
import assert from "node:assert/strict";
import { assertReleaseReport } from "../../scripts/operations/release-checks.mjs";

const legacyDeviation = { check: "finance_card_projector_trigger", object: "public.fin_accounts.finance_project" };
const finance27Deviation = { check: "finance27_legacy_projection_trigger", object: "public.fin_accounts" };
const SOURCE_FINANCE27_CHECKS = [
  "finance27_all_indexes", "finance27_column_default", "finance27_constraint_definition",
  "finance27_constraint_set", "finance27_constraint_trigger_link", "finance27_domain_events_predicate",
  "finance27_explicit_index", "finance27_function", "finance27_function_default",
  "finance27_helper_namespace_closed", "finance27_index_predicate", "finance27_legacy_projection_trigger",
  "finance27_public_private_mapping", "finance27_relation", "finance27_supported_engine",
  "finance27_trigger", "finance27_trigger_set",
];
const failedReport = deviations => ({ version: 1, ok: false, checks: 2512, deviations });
const reviewedReport = () => ({ version: 1, ok: true, checks: 2512, deviations: [] });
const refused = value => assert.throws(() => assertReleaseReport(value), { code: "INVALID_CATALOGUE_REPORT" });

test("release report accepts CURRENT27 trigger drift metadata while preserving its failed status", () => {
  const value = failedReport([legacyDeviation, finance27Deviation]);
  assert.equal(assertReleaseReport(value), value);
  assert.equal(value.ok, false);
  assert.equal(value.checks, 2512);
  assert.deepEqual(value.deviations, [legacyDeviation, finance27Deviation]);
  const reviewed = reviewedReport();
  assert.equal(assertReleaseReport(reviewed), reviewed);
});

test("release report keeps legacy check names and only adds the finance27 namespace", () => {
  assert.equal(SOURCE_FINANCE27_CHECKS.length, 17);
  for (const check of ["a", "_", "a".repeat(60), "finance27_a", "finance27_" + "a".repeat(50), ...SOURCE_FINANCE27_CHECKS]) {
    const value = failedReport([{ ...legacyDeviation, check }]);
    assert.equal(assertReleaseReport(value), value);
  }
  for (const check of ["", "a".repeat(61), "finance27_", "finance27_" + "a".repeat(51), "finance26_function", "finance28_function", "finance2_function", "check1", "finance27_function2"]) {
    refused(failedReport([{ ...legacyDeviation, check }]));
  }
});

test("release report refuses uppercase, punctuation, control characters and nontext check names", () => {
  for (const check of ["Finance27_function", "finance27_Function", "FINANCE_FUNCTION", "finance27_function.extra", "finance27_function-name", "finance27_function name", "finance27_function\n", "finance27_function\r", "finance27_function\t", "finance27_function\0", "finance27_função", null, 27]) {
    refused(failedReport([{ ...legacyDeviation, check }]));
  }
  for (const name of ["finance_card_projector_trigger", "finance27_legacy_projection_trigger"]) {
    for (const suffix of ["\n", "\r", "\u2028", "\u2029"]) {
      refused(failedReport([{ ...legacyDeviation, check: name + suffix }]));
    }
  }
});

test("release report preserves the exact report and deviation shapes", () => {
  const valid = failedReport([finance27Deviation]);
  for (const value of [null, {}, { ...valid, extra: true }, { ...valid, version: 2 }, { ...valid, version: "1" }, { ...valid, deviations: {} }, { ...valid, deviations: null }, { ...valid, deviations: [null] }, { ...valid, deviations: [{ ...finance27Deviation, extra: true }] }, { ...valid, deviations: [{ check: finance27Deviation.check }] }, { ...valid, deviations: [{ object: finance27Deviation.object }] }]) {
    refused(value);
  }
  for (const key of ["version", "ok", "checks", "deviations"]) {
    const missing = { ...valid };
    delete missing[key];
    refused(missing);
  }
});

test("release report preserves ok consistency with the deviation list", () => {
  refused({ ...failedReport([finance27Deviation]), ok: true });
  refused({ ...reviewedReport(), ok: false });
  refused({ ...reviewedReport(), ok: 1 });
  refused({ ...reviewedReport(), ok: "true" });
});

test("release report preserves check count and deviation count bounds", () => {
  for (const checks of [1, 1720, 2512, 100000]) {
    const value = { ...reviewedReport(), checks };
    assert.equal(assertReleaseReport(value), value);
  }
  for (const checks of [0, -1, 100001, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "2512", null]) {
    refused({ ...reviewedReport(), checks });
  }
  const bounded = failedReport(Array(10000).fill(finance27Deviation));
  assert.equal(assertReleaseReport(bounded), bounded);
  refused(failedReport(Array(10001).fill(finance27Deviation)));
});

test("release report preserves object length, text and control character bounds", () => {
  const bounded = failedReport([{ ...finance27Deviation, object: "a".repeat(300) }]);
  assert.equal(assertReleaseReport(bounded), bounded);
  for (const object of ["a".repeat(301), "public.fin_accounts\n", "public.fin_accounts\r", "public.fin_accounts\t", "public.fin_accounts\0", "public.fin_accounts\x1f", null, 27]) {
    refused(failedReport([{ ...finance27Deviation, object }]));
  }
});
