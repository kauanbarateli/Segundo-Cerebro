import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {syntheticPlan} from './consolidated-feedback.draft.mjs';
const read=name=>readFile(new URL(name,import.meta.url));
test('consolidated proposal permits synthetic substitution only after pinning bytes',async()=>{
 const source=await read('consolidated-feedback-install.guarded.sql.txt'), fake={require_actor:'1'.repeat(64),session_active:'2'.repeat(64),append_event:'3'.repeat(64)};
 const {sql,rollback}=syntheticPlan(source,fake);
 assert.ok(sql.includes(fake.require_actor)&&sql.includes(fake.session_active)&&sql.includes(fake.append_event));
 assert.ok(sql.includes('59b03c44483704520a5300bb940111cec5c24694e6668a56b6e6574527ed021a'));
 for(const guard of ['$scratch_guard$','$manual_guard$','$pt409_guard$','$event_contract_guard$'])assert.ok(!sql.includes('DO '+guard));
 assert.ok(sql.trimEnd().endsWith('COMMIT;'));assert.ok(rollback.trimEnd().endsWith('ROLLBACK;'));
 assert.throws(()=>syntheticPlan(source,{...fake,session_active:'invalid'}));
 const drift=Buffer.from(source);drift[0]^=1;assert.throws(()=>syntheticPlan(drift,fake));
});
test('synthetic PT409 fixture carries the exact observed wrapper body',async()=>{
 const addon=(await read('consolidated-feedback-fixture-addon.sql')).toString('utf8');
 const match=addon.match(/CREATE OR REPLACE FUNCTION public\.onboarding_call[\s\S]*?AS \$\$([\s\S]*?)\$\$;/);
 assert.ok(match);const body=match[1].replaceAll('\r\n','\n');
 assert.equal(Buffer.byteLength(body),198);
 assert.equal(createHash('sha256').update(body).digest('hex'),'59b03c44483704520a5300bb940111cec5c24694e6668a56b6e6574527ed021a');
});
