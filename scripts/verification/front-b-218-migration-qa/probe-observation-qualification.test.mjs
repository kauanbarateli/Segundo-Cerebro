import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const guarded=await readFile(new URL('./probe-observed-ledger-preflight.guarded.sql.txt',import.meta.url),'utf8');
const candidate=await readFile(new URL('./quarantine-218-qa-snapshot.guarded.sql.txt',import.meta.url));
const probe=await readFile(new URL('../front-b-218-ledger-probe/probe.fail.sql.txt',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('a fotografia é adicional e a quarentena mantém os bytes e bloqueios',()=>{
  assert.equal(sha(candidate),'4046e7fdd3074f1cbb5fff5be37f7ae2b3c51c3d7b3c6aca06b79dab26a4550b');
  assert.equal(sha(probe),'d29322fe522a256c8a669a1936a33735320ccd03e1a6a7bddc297a94dbedfdd9');
  assert.match(candidate.toString(),/DO \$manual_guard\$/);
  assert.match(candidate.toString(),/DO \$external_guard\$/);
});
test('preflight permanece fatal, read-only e exige ledger original sem a sonda',()=>{
  assert.match(guarded,/BEGIN TRANSACTION READ ONLY;/);
  assert.match(guarded,/DO \$manual_guard\$ BEGIN RAISE EXCEPTION/);
  assert.ok(guarded.indexOf('DO $manual_guard$')<guarded.indexOf('DO $ledger_observation$'));
  assert.match(guarded,/WHERE version > '20261101235120'/);
  assert.match(guarded,/name = 'sc218_ledger_probe_20261102_5e81f9ab'/);
  assert.match(guarded,/\)\) <> 4 THEN/);
  assert.match(guarded,/ROLLBACK;/);
  assert.doesNotMatch(guarded.replace(/^--.*$/gm,''),/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
});
