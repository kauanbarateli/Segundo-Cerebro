import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const probe = readFileSync(new URL('./probe.fail.sql.txt', import.meta.url), 'utf8');
const inspect = readFileSync(new URL('./inspect.readonly.sql.txt', import.meta.url), 'utf8');
const name = 'sc218_ledger_probe_20261102_5e81f9ab';

// Classificação ilustrativa, não é parser nem prova do contrato de transporte.
function classify(code, message) {
  if (code === 'P2181' && message === 'SC218_PROBE_ROW_NOT_VISIBLE') return 'not-visible';
  if (code === 'P2182' && message === 'SC218_PROBE_ROW_VISIBLE') return 'visible';
  return 'inconclusive';
}

test('sonda usa nome fixo e todos os caminhos terminam em erro', () => {
  assert.equal(probe.split(name).length - 1, 1);
  for (const marker of ['P2181', 'P2182', 'P2183']) assert.ok(probe.includes(`ERRCODE = '${marker}'`));
  assert.match(probe, /IF matching_rows = 0 THEN[\s\S]*ELSIF matching_rows = 1 THEN[\s\S]*ELSE[\s\S]*RAISE EXCEPTION/);
  assert.match(probe, /END;\s*\$probe\$;/);
  assert.doesNotMatch(probe.replace(/^--.*$/gm, ''), /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
});

test('inspeção usa o mesmo nome e não modifica o ledger', () => {
  assert.ok(inspect.includes(name));
  assert.doesNotMatch(inspect.replace(/^--.*$/gm, ''), /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
});

test('somente pares exatos dão resultado observacional', () => {
  assert.equal(classify('P2181', 'SC218_PROBE_ROW_NOT_VISIBLE'), 'not-visible');
  assert.equal(classify('P2182', 'SC218_PROBE_ROW_VISIBLE'), 'visible');
  for (const [code, message] of [['P2183', 'SC218_PROBE_MULTIPLE_ROWS'], ['P2181', 'masked'], ['P2182', 'SC218_PROBE_ROW_NOT_VISIBLE'], ['', ''], [null, null]]) {
    assert.equal(classify(code, message), 'inconclusive');
  }
});
