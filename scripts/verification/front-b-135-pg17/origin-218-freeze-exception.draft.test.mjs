import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { origin218FreezePlan, observeOrigin218Freeze } from './origin-218-freeze-exception.draft.mjs';
const freeze=await readFile(new URL('./persistent-freeze.quarantine.guarded.sql.txt',import.meta.url));
const candidate=await readFile(new URL('./withdrawal-v2.guarded.sql.txt',import.meta.url));
const ctx={nonce:'1'.repeat(32),systemIdentifier:'1234567890123456',user:'10000000-0000-4000-8000-000000000001',session:'20000000-0000-4000-8000-000000000001'};
test('accepts only pinned sources and emits a fully isolated transaction plan',()=>{
 const p=origin218FreezePlan(ctx,freeze,candidate,'commit');
 assert.match(p.cutter,/access exclusive mode/); assert.match(p.writer,/set local role service_role/);
 assert.match(p.waiting(111,222),/pg_blocking_pids\(222\)/); assert.match(p.waiting(111,222),/RowShareLock/);
 assert.match(p.cutover,/disable trigger sc_cutover_freeze_038f/); assert.match(p.cutover,/enable always trigger sc_cutover_freeze_038f/);
 assert.match(p.cutover,/signup_origin_withdraw_v2/); assert.match(p.cutover,/commit;select json_build_object/);
 assert.match(p.verify,/tgenabled='A'/); assert.match(p.setup,/OFFLINE_INSTANCE_REFUSED/);
 assert.throws(()=>origin218FreezePlan({...ctx,nonce:'bad'},freeze,candidate,'commit'));
 assert.throws(()=>origin218FreezePlan(ctx,freeze,Buffer.concat([candidate,Buffer.from(' ')]),'commit'));
 assert.throws(()=>p.waiting(111,111));
});
function mock(mode,opts={}){
 const traces=[],a=[{kind:'cutter',pid:101},{kind:'locked'},{kind:`cutover-${mode}`}],b=[{kind:'writer',pid:202},{kind:'old-result',result:{blocked:true}},{kind:'writer-done'}];
 const sessions=[a,b].map(queue=>({async send(sql){traces.push(sql);},async read(){return queue.shift();},async close(){return !opts.closeFails;}}));let index=0;
 return {traces,ports:{async open(){return sessions[index++];},async pause(){},async query(sql){traces.push(sql);if(sql.includes("'kind','waiting'"))return {kind:'waiting',blocked:!opts.neverWait};if(sql.includes("'kind','verify'"))return {kind:'verify',v2:mode==='commit',freeze:true};return {kind:'setup'};}}};
}
for(const mode of ['commit','rollback'])test(`requires observed waiting and retained freeze after ${mode}`,async()=>{
 const f=mock(mode);const result=await observeOrigin218Freeze(f.ports,ctx,freeze,candidate,mode);
 assert.equal(result.scenario,`origin-218-freeze-${mode}-pg17`);assert.equal(result.acceptance,false);assert.equal(result.hostedCertified,false);
 assert.ok(f.traces.some(sql=>sql.includes('pg_blocking_pids')));assert.ok(f.traces.some(sql=>sql.includes(`${mode};select json_build_object`)));
});
test('fails closed when a blocked writer is not observed',async()=>{const f=mock('commit',{neverWait:true});await assert.rejects(observeOrigin218Freeze(f.ports,ctx,freeze,candidate,'commit'),/ORIGIN_218_FREEZE_REFUSED/);});
test('fails closed when a session cannot close',async()=>{const f=mock('rollback',{closeFails:true});await assert.rejects(observeOrigin218Freeze(f.ports,ctx,freeze,candidate,'rollback'),/ORIGIN_218_FREEZE_REFUSED/);});
