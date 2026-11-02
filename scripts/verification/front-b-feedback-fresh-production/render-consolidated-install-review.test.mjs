import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {renderReview} from './render-consolidated-install-review.mjs';
const read=name=>readFile(new URL(name,import.meta.url));
test('review copy removes exactly four fatal guards and refuses source drift',async()=>{
 const original=await read('consolidated-feedback-install.DRAFT.guarded.sql.txt');
 const review=await read('consolidated-feedback-install.production-review.sql.txt');
 assert.deepEqual(renderReview(original),review);
 let expected=original.toString('utf8');
 for(const guard of ["DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;\n", "DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: feedback release not qualified or authorized'; END $manual_guard$;\n", "DO $pt409_guard$ BEGIN RAISE EXCEPTION 'STOP: PT409 preservation not yet qualified'; END $pt409_guard$;\n", "DO $event_contract_guard$ BEGIN RAISE EXCEPTION 'DOMAIN_EVENT_CONTRACT_NOT_QUALIFIED'; END $event_contract_guard$;\n"]){assert.equal(expected.split(guard).length,2);expected=expected.replace(guard,()=> '');}
 assert.deepEqual(Buffer.from(expected),review);
 assert.match(expected,/DO \$pt409_snapshot\$/);assert.match(expected,/DO \$production_snapshot\$/);
 assert.match(expected,/LOCK TABLE public\.domain_events IN ACCESS EXCLUSIVE MODE/);assert.match(expected,/COMMIT;\s*$/);
 const corrupt=Buffer.from(original);corrupt[0]^=1;assert.throws(()=>renderReview(corrupt),/REVIEW_SOURCE_REFUSED/);
});
