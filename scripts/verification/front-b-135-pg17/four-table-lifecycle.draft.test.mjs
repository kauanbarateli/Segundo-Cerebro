import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {fourTableLifecyclePlan,observeFourTableLifecycle} from './four-table-lifecycle.draft.mjs';
const read=n=>readFile(new URL('./'+n,import.meta.url));
const inputs={extension:await read('four-table-freeze.guarded.sql.txt'),restore:await read('four-table-restore.guarded.sql.txt'),observed:await read('cutover-observed-ledger.guarded.sql.txt'),install:await read('install-only.reviewable.sql.txt'),quarantine:await read('origin-218-quarantine.guarded.sql.txt'),cutover:await read('origin-218-full-cutover.guarded.sql.txt'),freeze:await read('persistent-freeze.quarantine.guarded.sql.txt'),candidate:await read('withdrawal-v2.guarded.sql.txt'),foundation:await read('../front-b-135-draft/admission-feedback-metrics-atomic.sql.txt')};
const ctx={nonce:'a'.repeat(32),systemIdentifier:'1234567890123456789',user:'10000000-0000-4000-8000-000000000001',session:'20000000-0000-4000-8000-000000000001'};
test('derives fixture only from exact guarded inputs',()=>{
 const p=fourTableLifecyclePlan(ctx,inputs);assert.match(p.extensionRollback,/ROLLBACK;/);assert.match(p.extension,/COMMIT;/);assert.match(p.restore,/actual_extension_version constant text := '20261102100909'/);assert.ok(p.seedLedger.includes(p.extension));
 for(const table of ['signup_completion_fences_draft','signup_intents','signup_origins','user_admission'])assert.ok(p.frozen.includes(`UPDATE app_private.${table}`));
 for(const k of ['extension','restore'])assert.throws(()=>fourTableLifecyclePlan(ctx,{...inputs,[k]:Buffer.concat([inputs[k],Buffer.from(' ')])}));
});
test('requires rollback/commit/four-to-two observations',async()=>{
 const row=count=>({count,function:true,empty:true}),states=[row(2),row(2),row(4),row(2)];let calls=0;
 const r=await observeFourTableLifecycle({exec:async()=>{calls++},query:async()=>states.shift()},ctx,inputs);assert.equal(r.scenario,'four-table-lifecycle-pg17');assert.equal(calls,8);
 const wrong=[row(2),row(4)];await assert.rejects(()=>observeFourTableLifecycle({exec:async()=>{},query:async()=>wrong.shift()},ctx,inputs));
});
