import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {compose} from './wrapper-composition.mjs';import {removeScratchGuard} from './feedback-pglite-guard.mjs';
const [barrier,wrappers,combined,legacy]=await Promise.all(['candidate-feedback-barrier.sql.txt','wrappers.sql.txt','candidate-with-wrappers.sql.txt','legacy-synthetic-fixture.sql'].map(p=>readFile(new URL('./'+p,import.meta.url))));
test('proposta deriva dos bytes fixados e mantém a guarda na única transação',()=>{
 const original=Buffer.from(barrier),result=compose(barrier,wrappers),sql=result.toString('utf8');assert(result.equals(combined));assert(barrier.equals(original));assert.equal(sql.split('UNREVIEWED SCRATCH SQL: DO NOT APPLY').length,2);assert.match(sql,/BEGIN;\nDO \$scratch_guard\$/);assert.match(sql,/COMMIT;\n$/);assert.doesNotMatch(removeScratchGuard(sql),/UNREVIEWED SCRATCH SQL: DO NOT APPLY/);
 const fragment=wrappers.toString('utf8');assert.match(fragment,/BEGIN;\nDO \$fragment_guard\$ BEGIN RAISE EXCEPTION 'UNREVIEWED FEEDBACK WRAPPERS: DO NOT APPLY'/);assert.match(fragment,/COMMIT;\n$/);assert.doesNotMatch(sql,/UNREVIEWED FEEDBACK WRAPPERS: DO NOT APPLY/);
 assert.match(legacy.toString('utf8'),/BEGIN;\nDO \$scratch_guard\$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'/);assert.match(legacy.toString('utf8'),/COMMIT;\n$/);
});
test('SQL declara wrappers invoker, revogação e guardas de privilégios',()=>{
 const sql=combined.toString('utf8');for(const op of ['submit','status','cancel']){assert(sql.includes('CREATE FUNCTION public.feedback_barrier_'+op+'('));assert(sql.includes('SELECT app_private.draft_feedback_'+op+'('));}
 assert.equal((wrappers.toString().match(/SECURITY INVOKER SET search_path=''/g)??[]).length,3);assert.match(sql,/REVOKE ALL ON FUNCTION public\.feedback_submit\(uuid,uuid,uuid,text,text\),app_private\.feedback_submit\(uuid,uuid,uuid,text,text\) FROM PUBLIC,anon,authenticated,service_role/);
 for(const check of ['FEEDBACK_ACL_REFUSED','FEEDBACK_LEGACY_ACL_REFUSED','FEEDBACK_DELEGATE_ACL_REFUSED','FEEDBACK_TABLE_ACL_REFUSED'])assert(sql.includes(check));
});
test('fonte ou fragmento adulterado são recusados',()=>{for(const i of [0,1]){const parts=[Buffer.from(barrier),Buffer.from(wrappers)];parts[i][0]^=1;assert.throws(()=>compose(...parts),/FEEDBACK_COMPOSITION_REFUSED/);}});
