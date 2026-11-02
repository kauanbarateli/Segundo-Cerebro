import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ledgerVisibilityPlan,observeLedgerVisibility} from './ledger-visibility-probe.draft.mjs';

const bytes = await readFile(new URL('./ledger-visibility-probe.fail.sql.txt', import.meta.url));
test('each synthetic fixture checks the exact SQL bytes and its distinct error', async () => {
  for (const [kind, state] of [['absent','P2181'],['visible','P2182'],['duplicate','P2183']]) {
    const plan = ledgerVisibilityPlan(bytes,kind);
    assert.ok(plan.run.includes(bytes.toString('utf8')));
    assert.ok(plan.run.includes(`actual_state IS DISTINCT FROM '${state}'`));
    const calls=[];
    const observed=await observeLedgerVisibility({exec:async s=>calls.push(s)},bytes,kind);
    assert.deepEqual(calls,[plan.setup,plan.run]);
    assert.equal(observed.scenario,`ledger-visibility-${kind}-pg17`);
    assert.equal(observed.hostedCertified,false);
  }
});
test('refuses modified SQL, unknown case and missing guarded executor',async()=>{
  assert.throws(()=>ledgerVisibilityPlan(Buffer.concat([bytes,Buffer.from(' ')]),'absent'));
  assert.throws(()=>ledgerVisibilityPlan(bytes,'other'));
  await assert.rejects(()=>observeLedgerVisibility({},bytes,'absent'));
});
