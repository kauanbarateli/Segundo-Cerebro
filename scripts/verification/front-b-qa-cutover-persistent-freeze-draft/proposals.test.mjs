import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{makeProposals}from'./proposals.mjs';
const source=()=>readFile(new URL('../front-b-135-draft/same-browser-composed-v1.guarded.sql.txt',import.meta.url));
test('freeze proposals preserve old guards, validate exact triggers, and never commit',async()=>{
 const proposals=await makeProposals(await source());
 for(const [name,sql]of Object.entries(proposals)){
  assert.equal(await readFile(new URL(`./${name}.guarded.sql.txt`,import.meta.url),'utf8'),sql);
  assert.match(sql,/\$freeze_guard\$ begin raise exception 'FREEZE_DRAIN_AND_QA_AUTHORIZATION_NOT_PROVEN'/);
  assert.match(sql,/\$freeze_check\$/);assert.match(sql,/t\.tgtype=62 and t\.tgenabled='A'/);assert.match(sql,/rollback;\s*$/i);
 }
 const {quarantine,cutover,thaw,cancel}=proposals;
 for(const action of ['INSERT','UPDATE','DELETE','TRUNCATE'])assert.match(quarantine,new RegExp(`\\b${action}\\b`));
 assert.equal((quarantine.match(/ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f/g)||[]).length,2);
 assert.ok(quarantine.indexOf('CREATE TRIGGER')<quarantine.indexOf('revoke execute on function'));
 assert.ok(cutover.indexOf('$freeze_check$')<cutover.indexOf('grant execute on function'));
 for(const guard of ['app_barrier_guard','cutover_guard','drain_guard','scratch_guard','rollout_block'])assert.ok(cutover.includes(`$${guard}$`));
 assert.equal((thaw.match(/DROP TRIGGER sc_cutover_freeze_038f/g)||[]).length,2);
 assert.match(thaw,/THAW_BASELINE_REFUSED/);assert.match(thaw,/exists\(select 1 from app_private\.signup_origins\)/);
 for(const sql of Object.values(proposals)){
  assert.match(sql,/LEDGER_028_OR_PT409_REFUSED/);
  assert.match(sql,/bbb652684f1c526f4601c33b575c8d1cf6338feba34ab9a2d58166646faba4d7/);
  assert.match(sql,/59b03c44483704520a5300bb940111cec5c24694e6668a56b6e6574527ed021a/);
 }
 assert.match(thaw,/CUTOVER_VERSION_AND_FINAL_SQL_DIGEST_NOT_YET_FIXED/);
 assert.match(thaw,/CUTOVER_LEDGER_REFUSED/);assert.match(thaw,/CUTOVER_CATALOG_REFUSED/);
 assert.match(thaw,/3d9f5a4a6279fcf97d6e5f3dba8e88932ab2f9f05f35d7e52e0e09afccc99ebe/);
 assert.match(cancel,/CANCEL_REQUIRES_PROOF_CUTOVER_NEVER_COMMITTED_AND_SEPARATE_REVIEW/);
 assert.ok(cancel.indexOf('CANCEL_CATALOG_REFUSED')<cancel.indexOf('grant execute on function'));
 assert.ok(cancel.indexOf('grant execute on function')<cancel.indexOf('DROP TRIGGER'));
});
test('candidate bytes cannot drift silently',async()=>{const b=await source();b[0]^=1;await assert.rejects(makeProposals(b),{message:'SOURCE_REFUSED'});});
