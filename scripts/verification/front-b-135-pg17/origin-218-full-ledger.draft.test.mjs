import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { origin218LedgerPlan, observeOrigin218Ledger } from './origin-218-full-ledger.draft.mjs';
import { requireSqlBytes } from './offline-contract.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url));
const inputs={quarantine:read('./origin-218-quarantine.guarded.sql.txt'),cutover:read('./origin-218-full-cutover.guarded.sql.txt'),freeze:read('./persistent-freeze.quarantine.guarded.sql.txt'),candidate:read('./withdrawal-v2.guarded.sql.txt'),foundation:read('../front-b-135-draft/admission-feedback-metrics-atomic.sql.txt')};
const ctx={nonce:'1'.repeat(32),systemIdentifier:'1234567890123456',user:'10000000-0000-4000-8000-000000000001',session:'20000000-0000-4000-8000-000000000001'};
test('deriva somente bytes fixados e conserva guardas reais para recusa',()=>{
 const p=origin218LedgerPlan(ctx,inputs);assert.match(p.negative,/DO \$catalog_guard\$/);assert.match(p.negative,/STOP: ledger differs from reviewed QA snapshot/);
 for(const sql of Object.values(p))assert.ok(requireSqlBytes(Buffer.from(sql)));
 assert.match(p.quarantineRollback,/INSERT INTO supabase_migrations[\s\S]*ROLLBACK;/);assert.match(p.quarantineCommit,/INSERT INTO supabase_migrations[\s\S]*COMMIT;/);
 assert.match(p.cutoverRollback,/DO \$synthetic_catalog_guard\$/);assert.doesNotMatch(p.cutoverRollback,/DO \$catalog_guard\$/);assert.match(p.cutoverRollback,/ROLLBACK;/);assert.match(p.cutoverCommit,/COMMIT;/);
 assert.match(p.cutoverCommit,/DISABLE TRIGGER sc_cutover_freeze_038f/);assert.match(p.cutoverCommit,/ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f/);
 for(const key of ['quarantine','cutover','freeze','candidate','foundation'])assert.throws(()=>origin218LedgerPlan(ctx,{...inputs,[key]:Buffer.concat([inputs[key],Buffer.from(' ')])}));
});
for(const kind of ['quarantine','cutover'])test(`exige recibos de estado para rollback e commit: ${kind}`,async()=>{
 const states=kind==='quarantine'?[{kind:'state',quarantine:false,cutover:false,freeze:false,triggers:false,v2:false},{kind:'state',quarantine:true,cutover:false,freeze:true,triggers:true,v2:false}]:[{kind:'state',quarantine:true,cutover:false,freeze:true,triggers:true,v2:false},{kind:'state',quarantine:true,cutover:false,freeze:true,triggers:true,v2:false},{kind:'state',quarantine:true,cutover:true,freeze:true,triggers:true,v2:true}];
 const queries=[],ports={async exec(sql){queries.push(sql);},async query(){return states.shift();}};
 const result=await observeOrigin218Ledger(ports,ctx,inputs,kind);assert.equal(result.acceptance,false);assert.equal(result.hostedCertified,false);assert.equal(result.scenario,`origin-218-full-${kind}-synthetic-ledger-pg17`);if(kind==='cutover')assert.ok(queries.some(s=>s.includes('$original_guard$')));
});
test('recusa estado sem barreira após corte',async()=>{const ports={async exec(){},async query(){return {kind:'state',quarantine:true,cutover:false,freeze:false,triggers:false,v2:false};}};await assert.rejects(observeOrigin218Ledger(ports,ctx,inputs,'cutover'),/ORIGIN_218_LEDGER_REFUSED/);});
