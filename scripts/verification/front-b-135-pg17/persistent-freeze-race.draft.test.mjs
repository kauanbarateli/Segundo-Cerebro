import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{persistentFreezePlan,observePersistentFreeze,qualifyFreeze}from'./persistent-freeze-race.draft.mjs';
const ctx={nonce:'a'.repeat(32),systemIdentifier:'1234567890123456'},composition='BEGIN;\nselect 1;\nCOMMIT;\n';
const source=()=>readFile(new URL('./persistent-freeze.quarantine.guarded.sql.txt',import.meta.url));
test('plan binds guarded source and refuses drift and unsafe identity',async()=>{
 const bytes=await source(),p=persistentFreezePlan(ctx,composition,bytes);
 assert.match(qualifyFreeze(bytes),/ENABLE ALWAYS TRIGGER/);assert.match(p.first,/OFFLINE_INSTANCE_REFUSED/);assert.match(p.second,/sc_test_legacy_guard/);assert.match(p.waiting(101,102),/pg_blocking_pids/);assert.match(p.cutover,/QA_CUTOVER_PERSISTENT_WRITE_FREEZE/);assert.match(p.verify,/if n<>6/);
 assert.throws(()=>qualifyFreeze(Buffer.concat([bytes,Buffer.from(' ')])));assert.throws(()=>persistentFreezePlan({...ctx,nonce:'bad'},composition,bytes));assert.throws(()=>p.waiting(101,101));
});
test('observer requires actual blocked backend, trigger rejection and no unexpected writes',async()=>{
 const bytes=await source();let readsA=0,readsB=0;const sessions=[{send:async()=>{},read:async()=>++readsA===1?{kind:'first',pid:101}:{kind:'cutover-committed'},close:async()=>true},{send:async()=>{},read:async()=>++readsB===1?{kind:'second-start',pid:102}:{kind:'old-return',result:{guarded:true}},close:async()=>true}];
 const ports={open:async()=>sessions.shift(),pause:async()=>{},query:async sql=>sql.includes("'preflight'")?{kind:'preflight',empty:true}:sql.includes("'setup'")?{kind:'setup'}:sql.includes("'waiting'")?{kind:'waiting',blocked:true}:{kind:'verified',blocked:6,empty:true}};
 assert.equal((await observePersistentFreeze(ports,ctx,composition,bytes)).scenario,'legacy-prune-blocked-by-persistent-freeze-pg17');
});
