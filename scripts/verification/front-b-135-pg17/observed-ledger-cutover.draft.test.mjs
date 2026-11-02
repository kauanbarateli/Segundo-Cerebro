import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {observedLedgerCutoverPlan,observeObservedLedgerCutover} from './observed-ledger-cutover.draft.mjs';
const read=n=>readFile(new URL('./'+n,import.meta.url));
const inputs={observed:await read('cutover-observed-ledger.guarded.sql.txt'),install:await read('install-only.reviewable.sql.txt'),quarantine:await read('origin-218-quarantine.guarded.sql.txt'),cutover:await read('origin-218-full-cutover.guarded.sql.txt'),freeze:await read('persistent-freeze.quarantine.guarded.sql.txt'),candidate:await read('withdrawal-v2.guarded.sql.txt'),foundation:await read('../front-b-135-draft/admission-feedback-metrics-atomic.sql.txt')};
const ctx={nonce:'a'.repeat(32),systemIdentifier:'1234567890123456789',user:'10000000-0000-4000-8000-000000000001',session:'20000000-0000-4000-8000-000000000001'};
test('pins inputs, uses exact ledger guard, and explicitly substitutes catalogue fixture',()=>{
 const p=observedLedgerCutoverPlan(ctx,inputs),source=inputs.observed.toString(),guard=source.slice(source.indexOf('DO $catalog_guard$'),source.indexOf(' PERFORM 1 FROM app_private.signup_settings'))+'END $catalog_guard$;';
 assert.ok(p.cutover.includes(guard));assert.ok(p.reject.includes(guard));assert.match(p.cutover,/DO \$synthetic_catalog\$/);assert.ok(p.seedStatement.includes(inputs.install.toString()));
 assert.throws(()=>observedLedgerCutoverPlan(ctx,{...inputs,observed:Buffer.concat([inputs.observed,Buffer.from(' ')])}));assert.throws(()=>observedLedgerCutoverPlan(ctx,{...inputs,install:Buffer.concat([inputs.install,Buffer.from(' ')])}));
});
test('requires freeze and exact ledger before, and freeze and v2 after',async()=>{
 const before={ledger:true,freeze:true,triggers:true,v2:false},after={...before,v2:true};const states=[before,after];let count=0;
 const r=await observeObservedLedgerCutover({exec:async()=>{count++},query:async()=>states.shift()},ctx,inputs);assert.equal(r.scenario,'observed-ledger-cutover-pg17');assert.equal(count,10);
 await assert.rejects(()=>observeObservedLedgerCutover({exec:async()=>{},query:async()=>({...before,freeze:false})},ctx,inputs));
});
