import { test } from "node:test";
import assert from "node:assert/strict";
import { authBundleFindings } from "../../scripts/check-client-auth.mjs";

test("permits public form results and rejects SDK/credential signatures without returning secrets", () => {
  assert.deepEqual(authBundleFindings('const message="Senha atualizada";const field="password";'), []);
  for (const [source, finding] of [
    ['const key="sb_secret_fake_only_for_test"', "privileged-key"],
    ["process.env.AUTH_STATE_SECRET", "server-environment"],
    ["class SupabaseAuthClient {}", "auth-sdk"],
    ['{"refresh_token":"fake"}', "auth-token-storage"],
    ['"eyJabcdefghijklmno.abcdefghijklmno.abcdefghijklmno"', "literal-jwt"],
  ]) assert.deepEqual(authBundleFindings(source), [finding]);
});
