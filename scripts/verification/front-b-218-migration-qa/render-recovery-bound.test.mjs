import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderBoundRecovery} from './render-recovery-bound.mjs';

const source=await readFile(new URL('./cancel-quarantine-218-ledger-bound.guarded.sql.txt',import.meta.url));
test('substitui somente declarações e mantém guardas fatais',()=>{
 const version='20261102000001',name='synthetic_only';
 const result=renderBoundRecovery(source,version,name);let expected=source.toString();
 expected=expected.replace("actual_quarantine_version constant text := '__QA_QUARANTINE_VERSION_PENDING__';",()=>`actual_quarantine_version constant text := '${version}';`);
 expected=expected.replace("actual_quarantine_name constant text := '__QA_QUARANTINE_NAME_PENDING__';",()=>`actual_quarantine_name constant text := '${name}';`);
 assert.equal(result.sql.toString(),expected);assert.equal(result.guarded,true);assert.match(result.sha256,/^[a-f0-9]{64}$/);
 assert.match(expected,/DO \$manual_guard\$ BEGIN RAISE EXCEPTION/);assert.match(expected,/DO \$external_guard\$ BEGIN RAISE EXCEPTION/);
 assert.match(expected,/actual_quarantine_name = '__QA_QUARANTINE_NAME_PENDING__'/);
});
test('recusa fonte modificada, versões não plausíveis ou nome inseguro',()=>{
 for(const version of ['20261101235120','20261302235959','20260230000000','20261102999999','',null,'20261102000001;'])assert.throws(()=>renderBoundRecovery(source,version,'synthetic_only'));
 for(const name of ['',"qa'; drop schema public;--",'CAPS','x'.repeat(64),null])assert.throws(()=>renderBoundRecovery(source,'20261102000001',name));
 assert.throws(()=>renderBoundRecovery(Buffer.concat([source,Buffer.from(' ')]),'20261102000001','synthetic_only'));
});
