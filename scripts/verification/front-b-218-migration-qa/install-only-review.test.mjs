import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const dir=new URL('./',import.meta.url);
const original=await readFile(new URL('quarantine-218-qa-snapshot.guarded.sql.txt',dir));
const copy=await readFile(new URL('quarantine-218-install-qa.reviewable.sql.txt',dir));
const sha=b=>createHash('sha256').update(b).digest('hex');
test('cópia executável deriva somente da origem pinada e das duas guardas',()=>{
 assert.equal(sha(original),'4046e7fdd3074f1cbb5fff5be37f7ae2b3c51c3d7b3c6aca06b79dab26a4550b');
 assert.equal(sha(copy),'fab48cfdf12630643623e4e1d58251b3bcc35bc7c6c0f57d7d93e415514ddb00');
 let s=original.toString('utf8');
 for(const guard of ["DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: quarantine is not qualified or authorized'; END $manual_guard$;\n","DO $external_guard$ BEGIN RAISE EXCEPTION 'STOP: destination, writers and Auth not proven'; END $external_guard$;\n"]){assert.equal(s.split(guard).length,2);s=s.replace(guard,'');}
 s=s.replace('-- GUARDED QA proposal only. Not an executable migration.','-- EXECUTABLE REVIEW COPY: QA ONLY. DO NOT RUN WITHOUT APPROVAL AND RUNBOOK.');
 assert.equal(s,copy.toString('utf8'));
 assert.match(s,/LOCK TABLE app_private\.signup_settings,app_private\.signup_intents,app_private\.signup_origins IN ACCESS EXCLUSIVE MODE/);
 assert.match(s,/signup_completion_fences_draft/);
 assert.match(s,/DO \$catalog_guard\$/);
 assert.match(s,/ENABLE ALWAYS TRIGGER/g);
});
