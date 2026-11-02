import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {renderDeleteCascade} from './render-delete-cascade-draft.mjs';
const source=await readFile(new URL('./fresh-feedback-production.DRAFT.guarded.sql.txt',import.meta.url));
const candidate=await readFile(new URL('./fresh-feedback-delete-cascade.DRAFT.guarded.sql.txt',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('changes only the barrier owner FK and retains guarded bytes',()=>{
 assert.deepEqual(renderDeleteCascade(source),candidate);
 assert.equal(hash(candidate),'8081d72004ac2884a34f5a93a93f051ea737cd118a9eb8d92be3340a8215f1e8');
 const sql=candidate.toString();
 assert.ok(sql.includes('CREATE TABLE app_private.feedback_barriers_draft (\n user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,'));
 assert.ok(sql.includes('PERFORM 1 FROM auth.users WHERE id=p_user FOR SHARE;'));
 assert.ok(sql.includes("RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'"));
 assert.ok(sql.includes("RAISE EXCEPTION 'DOMAIN_EVENT_CONTRACT_NOT_QUALIFIED'"));
});
test('rejects drift of source bytes',()=>assert.throws(()=>renderDeleteCascade(Buffer.concat([source,Buffer.from(' ')])),/FEEDBACK_SOURCE_REFUSED/));
