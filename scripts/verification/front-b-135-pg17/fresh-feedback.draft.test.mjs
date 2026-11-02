import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {freshFeedbackPlan} from './fresh-feedback.draft.mjs';
const sql=await readFile(new URL('./fresh-feedback-production.guarded.sql.txt',import.meta.url));
const fixture=await readFile(new URL('./fresh-feedback.fixture.sql',import.meta.url));
test('fresh feedback test strips only fatal guards in memory and retains full catalog guard',()=>{
 const p=freshFeedbackPlan(sql,fixture);const original=sql.toString();
 assert.ok(original.includes('$scratch_guard$')&&original.includes('$event_contract_guard$'));
 assert.ok(!p.sql.includes('$scratch_guard$')&&!p.sql.includes('$event_contract_guard$'));
 assert.ok(p.sql.includes('803504cb5f1c0ab40e7334eea9dc43e263ef54c04669c9ca7c0f76ba212280d3'));
 assert.ok(p.sql.includes('c73df7bd615743224694fa48233fb75e5c28f44e2c9793c8843a207d9d878533'));
 assert.ok(p.sql.includes('LOCK TABLE public.domain_events IN ACCESS EXCLUSIVE MODE;'));
 assert.ok(p.rollback.endsWith('ROLLBACK;\n')&&p.sql.endsWith('COMMIT;\n'));
});
test('reject altered bytes of either source',()=>{
 assert.throws(()=>freshFeedbackPlan(Buffer.concat([sql,Buffer.from(' ')]),fixture));
 assert.throws(()=>freshFeedbackPlan(sql,Buffer.concat([fixture,Buffer.from(' ')])));
});
