import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {cascadePlan} from './fresh-feedback-cascade.draft.mjs';
const sql=await readFile(new URL('./fresh-feedback-cascade.guarded.sql.txt',import.meta.url));
const fixture=await readFile(new URL('./fresh-feedback.fixture.sql',import.meta.url));
const ctx={nonce:'a'.repeat(32),systemIdentifier:'12345678901234567'};
test('both ordering plans retain the cascade candidate and isolate session identities',()=>{
 for(const order of ['submit-first','delete-first']){
  const p=cascadePlan(ctx,sql,fixture,order);
  assert.ok(sql.toString().includes('$scratch_guard$')&&sql.toString().includes('$event_contract_guard$'));
  assert.ok(!p.sql.includes('$scratch_guard$')&&!p.sql.includes('$event_contract_guard$'));
  assert.ok(p.sql.includes('user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE'));
  assert.ok(p.seed.includes('user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE'));
  assert.ok(p.first.includes('sc_front_b_observation.marker')&&p.second.includes('sc_front_b_observation.marker'));
  assert.ok(p.wait(123,456).includes('123=any(pg_blocking_pids(456))'));
 }
});
test('invalid inputs and altered bytes are rejected',()=>{
 assert.throws(()=>cascadePlan({...ctx,nonce:'bad'},sql,fixture,'submit-first'));
 assert.throws(()=>cascadePlan(ctx,Buffer.concat([sql,Buffer.from(' ')]),fixture,'submit-first'));
 assert.throws(()=>cascadePlan(ctx,sql,fixture,'unknown'));
});
