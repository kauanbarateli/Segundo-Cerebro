import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeProposals} from './proposals.mjs';
const source=()=>readFile(new URL('../front-b-135-draft/same-browser-composed-v1.guarded.sql.txt',import.meta.url));
test('both alternative proposals remain inert and require an empty origin table',async()=>{
 const {quarantine,cutover}=await makeProposals(await source());
 assert.equal(await readFile(new URL('./quarantine.guarded.sql.txt',import.meta.url),'utf8'),quarantine);
 assert.equal(await readFile(new URL('./cutover.guarded.sql.txt',import.meta.url),'utf8'),cutover);
 for(const sql of [quarantine,cutover]){
  assert.match(sql,/\$app_barrier_guard\$ begin raise exception 'APPLICATION_BARRIER_AND_DRAIN_NOT_PROVEN'/);
  assert.match(sql,/lock table auth\.users,app_private\.signup_settings,app_private\.user_admission,app_private\.signup_intents,app_private\.signup_origins,app_private\.signup_completion_fences_draft in share row exclusive mode;/);
  assert.doesNotMatch(sql,/lock table cron\.job/i);
  assert.match(sql,/or exists\(select 1 from app_private\.signup_origins\)/);
  assert.match(sql,/or exists\(select 1 from cron\.job/);
  assert.match(sql,/rollback;\s*$/i);
 }
 assert.match(quarantine,/\$quarantine_guard\$/);
 for(const guard of ['cutover_guard','drain_guard','scratch_guard','rollout_block'])assert.ok(cutover.includes(`$${guard}$`));
 assert.ok(cutover.indexOf('grant execute on function')<cutover.indexOf('$scratch_guard$'));
});
test('composition drift is refused without creating output',async()=>{
 const bytes=await source();bytes[bytes.length-1]^=1;
 await assert.rejects(makeProposals(bytes),{message:'SOURCE_REFUSED'});
});
