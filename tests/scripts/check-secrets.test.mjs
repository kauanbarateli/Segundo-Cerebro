import { test } from "node:test";
import assert from "node:assert/strict";
import { secretFindings } from "../../scripts/check-secrets.mjs";
test("detecta assinaturas sem retornar seus valores; templates são seguros", () => {
  for (const [prefix, length, rule] of [["ghp_", 36, "github-token"], ["github_pat_", 70, "github-token"], ["GOCSPX-", 28, "google-client-secret"], ["sb_secret_", 32, "supabase-secret"], ["AKIA", 16, "aws-access-key"]]) {
    const value = prefix + "A".repeat(length), findings = secretFindings(value);
    assert.deepEqual(findings, [rule]); assert.ok(!JSON.stringify(findings).includes(value));
  }
  const key = ["-----BEGIN OPENSSH", " PRIVATE KEY-----\n", "A".repeat(72)].join("");
  assert.deepEqual(secretFindings(key), ["private-key"]);
  assert.deepEqual(secretFindings("SUPABASE_SECRET_KEY=\nGOOGLE_OAUTH_CLIENT_SECRET=\nsb_secret_fake_only_for_test"), []);
});
test("fixture exemptions are exact and cannot hide a longer valid-format credential", () => {
  for (const prefix of ["fake", "example", "test", "canary", "placeholder"]) {
    const value = "sb_secret_" + prefix + "A".repeat(32);
    assert.deepEqual(secretFindings(value), ["supabase-secret"]);
    assert.ok(!JSON.stringify(secretFindings(value)).includes(value));
  }
  const fixture = "sb_secret_fake_only_for_test";
  assert.deepEqual(secretFindings(fixture), []);
  assert.deepEqual(secretFindings(fixture + "A".repeat(32)), ["supabase-secret"]);
});
