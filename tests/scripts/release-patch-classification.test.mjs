import test from "node:test";
import assert from "node:assert/strict";
import { classifyOnboardingPatch } from "../../scripts/operations/release-checks.mjs";

test("diagnóstico só reconhece o único desvio PT409 com prova exata", () => {
  const report = { version: 1, ok: false, checks: 2512, deviations: [{ check: "onboarding_function", object: "public.onboarding_call(uuid,uuid,text,jsonb)" }] };
  const patch = { check: "onboarding_conflict_patch_pt409", ok: true };
  assert.equal(classifyOnboardingPatch(report, patch), true);
  assert.equal(classifyOnboardingPatch({ ...report, checks: 2511 }, patch), false);
  assert.equal(classifyOnboardingPatch({ ...report, deviations: [...report.deviations, { check: "other", object: "other" }] }, patch), false);
  assert.equal(classifyOnboardingPatch(report, { ...patch, ok: false }), false);
  assert.throws(() => classifyOnboardingPatch(report, { ...patch, extra: true }));
});
