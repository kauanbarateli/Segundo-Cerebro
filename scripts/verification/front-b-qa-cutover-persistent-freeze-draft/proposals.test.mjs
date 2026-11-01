import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{makeProposals}from'./proposals.mjs';
const source=()=>readFile(new URL('../front-b-135-draft/same-browser-composed-v1.guarded.sql.txt',import.meta.url));
test('freeze proposals preserve old guards, validate exact triggers, and never commit',async()=>{
 const proposals=await makeProposals(await source());
 for(const [name,sql]of Object.entries(proposals)){
  assert.equal(await readFile(new URL(`./${name}.guarded.sql.txt`,import.meta.url),'utf8'),sql);
  assert.match(sql,/\$freeze_guard\$ begin raise exception 'FREEZE_DRAIN_AND_QA_AUTHORIZATION_NOT_PROVEN'/);
  assert.match(sql,/\$freeze_check\$/);assert.match(sql,/t\.tgtype=62 and t\.tgenabled='A'/);assert.match(sql,/rollback;\s*$/i);
 }
 const {quarantine,cutover,thaw}=proposals;
 for(const action of ['INSERT','UPDATE','DELETE','TRUNCATE'])assert.match(quarantine,new RegExp(`\\b${action}\\b`));
 assert.equal((quarantine.match(/ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f/g)||[]).length,2);
 assert.ok(quarantine.indexOf('CREATE TRIGGER')<quarantine.indexOf('revoke execute on function'));
 assert.ok(cutover.indexOf('$freeze_check$')<cutover.indexOf('grant execute on function'));
 for(const guard of ['app_barrier_guard','cutover_guard','drain_guard','scratch_guard','rollout_block'])assert.ok(cutover.includes(`$${guard}$`));
 assert.equal((thaw.match(/DROP TRIGGER sc_cutover_freeze_038f/g)||[]).length,2);
 assert.match(thaw,/THAW_BASELINE_REFUSED/);assert.match(thaw,/exists\(select 1 from app_private\.signup_origins\)/);
});
test('candidate bytes cannot drift silently',async()=>{const b=await source();b[0]^=1;await assert.rejects(makeProposals(b),{message:'SOURCE_REFUSED'});});
