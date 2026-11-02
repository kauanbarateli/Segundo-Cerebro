import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { renderConsolidated } from './render-consolidated-install-draft.mjs';
const read=name=>readFile(new URL(name,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('pinned sources compose exactly with four fatal guards and one transaction',async()=>{
 const candidate=await read('fresh-feedback-delete-cascade.DRAFT.guarded.sql.txt');
 const preflight=await read('production-release-preflight.DRAFT.guarded.sql.txt');
 const result=renderConsolidated(candidate,preflight), checked=await read('consolidated-feedback-install.DRAFT.guarded.sql.txt');
 assert.deepEqual(result,checked);
 const sql=result.toString('utf8'),lock='LOCK TABLE public.domain_events IN ACCESS EXCLUSIVE MODE;';
 for(const tag of ['$scratch_guard$','$event_contract_guard$','$manual_guard$','$pt409_guard$']){
  assert.equal(sql.split('DO '+tag).length,2); assert.ok(sql.indexOf('DO '+tag)<sql.indexOf(lock));
 }
 assert.equal(sql.split('BEGIN;').length,2);assert.equal(sql.split('COMMIT;').length,2);
 assert.equal(sql.split(lock).length,2);
 assert.ok(sql.indexOf('DO $pt409_snapshot$')>sql.indexOf(lock));
 assert.ok(sql.indexOf('DO $production_snapshot$')>sql.indexOf(lock));
 assert.ok(sql.indexOf('DO $production_snapshot$')<sql.indexOf('create table app_private.feedback_requests'));
 for(const input of [candidate,preflight]){const drift=Buffer.from(input);drift[0]^=1;
  assert.throws(()=>input===candidate?renderConsolidated(drift,preflight):renderConsolidated(candidate,drift),/FEEDBACK_CONSOLIDATION_REFUSED/);
 }
 assert.match(sha(checked),/^[0-9a-f]{64}$/);
});
