import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),read=n=>readFile(new URL(n,root));
const source=await read('extend-freeze-four-tables.guarded.sql.txt'),candidate=await read('extend-freeze-four-tables.qa-review.sql.txt');
const sha=x=>createHash('sha256').update(x).digest('hex');
test('cópia remove somente dois bloqueios e conserva os demais bytes',()=>{
 assert.equal(sha(source),'eb9cc8f05bb36437689a9c84c6dbd5653845390fc9cabf3f8ad41bf91e636d0e');
 assert.equal(sha(candidate),'8664268a00aa7ea43a708e44eca8f14bddca1c68aba3433659afc38cc592e660');
 let expected=source.toString('utf8');for(const g of ["DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: four-table barrier is not qualified or authorized'; END $manual_guard$;\n","DO $external_guard$ BEGIN RAISE EXCEPTION 'STOP: destination, consumers and safe recovery not proven'; END $external_guard$;\n"]){assert.equal(expected.split(g).length,2);expected=expected.replace(g,()=> '');}
 const actual=candidate.toString('utf8');assert.equal(actual,expected);
 assert.match(actual,/LOCK TABLE app_private\.signup_completion_fences_draft,app_private\.signup_intents,app_private\.signup_origins,app_private\.user_admission IN ACCESS EXCLUSIVE MODE/);
 for(const marker of ['DO $catalog_guard$','DO $empty_guard$','<>4','COMMIT;'])assert.ok(actual.includes(marker));
 for(const table of ['signup_completion_fences_draft','user_admission'])assert.equal(actual.split(`ALTER TABLE app_private.${table} ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f;`).length-1,1);
});
