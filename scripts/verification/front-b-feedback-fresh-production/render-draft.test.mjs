import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {render} from './render-draft.mjs';

const source=await readFile(new URL('../../../supabase/operations/candidates/feedback-reconciliation-fresh.guarded.sql.txt',import.meta.url));
const candidate=await readFile(new URL('./fresh-feedback-production.DRAFT.guarded.sql.txt',import.meta.url));
const hash=v=>createHash('sha256').update(v).digest('hex');
test('draft is reproducible from the pinned source and remains blocked',()=>{
 assert.deepEqual(render(source),candidate);
 assert.equal(hash(candidate),'25f765a5743512ad16aa3100e1959c9d74c7dee03726156da2af56e478c1ded2');
 const sql=candidate.toString();
 const scratch=sql.indexOf("RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'");
 const event=sql.indexOf("RAISE EXCEPTION 'DOMAIN_EVENT_CONTRACT_NOT_QUALIFIED'");
 const lock=sql.indexOf('LOCK TABLE public.domain_events IN ACCESS EXCLUSIVE MODE;');
 const alter=sql.indexOf('alter table public.domain_events drop constraint');
 assert.ok(scratch>0&&event>scratch&&lock>event&&alter>lock);
 assert.ok(sql.includes('803504cb5f1c0ab40e7334eea9dc43e263ef54c04669c9ca7c0f76ba212280d3'));
 assert.ok(sql.includes('c73df7bd615743224694fa48233fb75e5c28f44e2c9793c8843a207d9d878533'));
 for (const required of ['c.convalidated IS DISTINCT FROM true','c.condeferrable IS DISTINCT FROM false','c.condeferred IS DISTINCT FROM false','c.connoinherit IS DISTINCT FROM false',"r.relkind='r'",'r.relrowsecurity',"pg_catalog.pg_get_userbyid(r.relowner)='postgres'"]) assert.ok(sql.includes(required));
 assert.ok(sql.includes('FEEDBACK_EXISTING_FUNCTION_REFUSED'));
 assert.ok(sql.includes('FEEDBACK_TABLE_ACL_REFUSED'));
});
test('modified or invalid source is rejected',()=>{
 assert.throws(()=>render(Buffer.concat([source,Buffer.from(' ')])),/FEEDBACK_SOURCE_HASH_MISMATCH/);
 assert.throws(()=>render('not bytes'),/FEEDBACK_SOURCE_HASH_MISMATCH/);
});
