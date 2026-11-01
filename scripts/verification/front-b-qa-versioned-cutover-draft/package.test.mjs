import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('versioned review package retains exact guarded source and rollback', async () => {
  const bytes = await readFile(new URL('./v1-cutover.guarded.sql.txt', import.meta.url), 'utf8');
  const source = await readFile(new URL('../front-b-qa-cutover-persistent-freeze-draft/cutover.guarded.sql.txt', import.meta.url), 'utf8');
  assert.equal(bytes, '-- REVIEW PACKAGE v1; NOT A CLI MIGRATION. NEVER APPLY. ALL SOURCE GUARDS AND ROLLBACK RETAINED.\n' + source);
  for (const guard of ['cutover_guard', 'app_barrier_guard', 'drain_guard', 'freeze_guard', 'scratch_guard', 'rollout_block']) assert.ok(bytes.includes(`$${guard}$`));
  assert.match(bytes, /rollback;\s*$/i);
});
test('ledger preflight compares the exact authorized statement and cannot mutate ledger', async () => {
  const sql = await readFile(new URL('./ledger-preflight.readonly.sql.txt', import.meta.url), 'utf8');
  assert.match(sql, /begin transaction read only/i);
  assert.match(sql, /'ledger_028_matches_authorized_statement'/);
  assert.match(sql, /m028_front_b_signup_feedback_metrics_qa/);
  assert.match(sql, /cardinality\(statements\) = 1/);
  assert.match(sql, /array_lower\(statements, 1\) = 1/);
  assert.match(sql, /sha256\(pg_catalog\.convert_to\(statements\[1\], 'UTF8'\)\)/);
  assert.match(sql, /bbb652684f1c526f4601c33b575c8d1cf6338feba34ab9a2d58166646faba4d7/);
  assert.match(sql, /version = '20261101172256'/);
  assert.match(sql, /rollback;\s*$/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete|alter|drop|truncate)\b/i);
});
