import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recoveryLedgerPlan,observeRecoveryLedger} from './recovery-ledger-bound.draft.mjs';
const read=n=>readFile(new URL('./'+n,import.meta.url));
const inputs={recovery:await read('recovery-ledger-bound.guarded.sql.txt'),install:await read('install-only.reviewable.sql.txt'),quarantine:await read('origin-218-quarantine.guarded.sql.txt'),cutover:await read('origin-218-full-cutover.guarded.sql.txt'),freeze:await read('persistent-freeze.quarantine.guarded.sql.txt'),candidate:await read('withdrawal-v2.guarded.sql.txt'),foundation:await read('../front-b-135-draft/admission-feedback-metrics-atomic.sql.txt')};
const ctx={nonce:'a'.repeat(32),systemIdentifier:'1234567890123456789',user:'10000000-0000-4000-8000-000000000001',session:'20000000-0000-4000-8000-000000000001'};
test('derives only from pinned bytes with synthetic ledger values',()=>{
 const p=recoveryLedgerPlan(ctx,inputs);assert.match(p.recovery,/actual_quarantine_version constant text := '20261102000001'/);assert.match(p.recovery,/actual_quarantine_name constant text := 'synthetic_only'/);assert.ok(p.seedStatement.includes(inputs.install.toString('utf8')));assert.doesNotMatch(p.recovery,/DO \$manual_guard\$/);assert.doesNotMatch(p.recovery,/DO \$external_guard\$/);assert.match(p.recovery,/DO \$ledger_guard\$/);
 assert.throws(()=>recoveryLedgerPlan(ctx,{...inputs,recovery:Buffer.concat([inputs.recovery,Buffer.from(' ')])}));assert.throws(()=>recoveryLedgerPlan(ctx,{...inputs,install:Buffer.concat([inputs.install,Buffer.from(' ')])}));
});
test('demands freeze before recovery and absence after',async()=>{
 const base={quarantine:true,cutover:false,freeze:true,triggers:true,v2:false};let calls=[];const states=[base,{intents:0,origins:0,fences:0},{...base,freeze:false,triggers:false}];const result=await observeRecoveryLedger({exec:async sql=>calls.push(sql),query:async()=>states.shift()},ctx,inputs);assert.equal(result.scenario,'recovery-ledger-bound-pg17');assert.equal(calls.length,4);
 await assert.rejects(()=>observeRecoveryLedger({exec:async()=>{},query:async()=>({...base,freeze:false})},ctx,inputs));
 const nonempty=[base,{intents:1,origins:0,fences:0}];await assert.rejects(()=>observeRecoveryLedger({exec:async()=>{},query:async()=>nonempty.shift()},ctx,inputs));
});
test('diagnostic is phase-only and suppresses arbitrary failure text',async()=>{
 const messages=[];const previous=process.stderr.write;process.stderr.write=function(value){messages.push(String(value));return true;};
 try{
  await assert.rejects(()=>observeRecoveryLedger({exec:async()=>{throw Object.assign(new Error('secret sql'),{code:'untrusted secret'});},query:async()=>null},ctx,inputs));
  assert.deepEqual(messages.map(JSON.parse),[{code:'RECOVERY_LEDGER_BOUND_REFUSED',phase:'seed',reason:'OTHER'}]);
 }finally{process.stderr.write=previous;}
});
test('recovery fixture excludes the race seed that creates an intent',async()=>{
 const runner=await readFile(new URL('./runner.mjs',import.meta.url),'utf8');
 const raceSeed=await readFile(new URL('./same-browser-seed.sql',import.meta.url),'utf8');
 assert.match(raceSeed,/insert into app_private\.signup_intents/i);
 assert.ok(runner.includes("['recovery-ledger-bound','observed-ledger-cutover','four-table-lifecycle'].includes(kind)?[sameBrowser.fixture,sameBrowser.foundation,sameBrowser.composition]:[sameBrowser.fixture,sameBrowser.foundation,sameBrowser.composition,sameBrowser.seed]"));
});
