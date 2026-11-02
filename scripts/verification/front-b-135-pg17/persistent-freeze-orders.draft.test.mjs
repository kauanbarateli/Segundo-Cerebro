import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freezeOrderPlan,observeFreezeOrder} from './persistent-freeze-orders.draft.mjs';
const ctx={nonce:'a'.repeat(32),systemIdentifier:'1234567890123456'},composition='-- verified header\nBEGIN;\nselect 1;\nCOMMIT;\n';
const bytes=readFileSync('scripts/verification/front-b-135-pg17/persistent-freeze.quarantine.guarded.sql.txt');
const old={expiredRemoved:0,consumedScrubbed:0,originsRemoved:0,fencedExamined:0,expiredOriginsCleared:0};
test('plans require the exact frozen proposal and enforce the two lock orders',()=>{
 const p=freezeOrderPlan(ctx,composition,bytes,'reverse');assert.match(p.waiting(101,102,'intent','ShareRowExclusiveLock'),/pg_blocking_pids/);assert.match(p.install,/ENABLE ALWAYS TRIGGER/);assert.match(p.verifyRollback,/to_regprocedure/);assert.throws(()=>freezeOrderPlan(ctx,composition,Buffer.from('bad'),'reverse'));assert.throws(()=>p.waiting(101,101,'intent','RowExclusiveLock'));
});
for(const mode of ['reverse','rollback'])test(`observer requires proven waiting and final state: ${mode}`,async()=>{
 const result={kind:'writer-result',result:old};let wi=0,ci=0;const writer={send:async()=>{},read:async()=>++wi===1?{kind:'writer-start',pid:101}:mode==='reverse'?(wi===2?result:{kind:'writer-committed'}):(wi===2?result:{kind:'writer-committed'}),close:async()=>true};
 const cutter={send:async()=>{},read:async()=>{ci++;if(ci===1)return {kind:'cutter-start',pid:102};if(ci===2)return {kind:'locked'};if(ci===3)return {kind:'installed'};return {kind:mode==='reverse'?'cutover-committed':'rolled-back'};},close:async()=>true};let open=0;
 const ports={open:async()=>++open===1?writer:cutter,pause:async()=>{},query:async sql=>sql.includes("'preflight'")?{kind:'preflight',empty:true}:sql.includes("'waiting'")?{kind:'waiting',blocked:true}:mode==='reverse'?{kind:'verified',blocked:true}:{kind:'verified',absent:true}};
 assert.equal((await observeFreezeOrder(ports,ctx,composition,bytes,mode)).scenario,`persistent-freeze-${mode}-pg17`);
});
