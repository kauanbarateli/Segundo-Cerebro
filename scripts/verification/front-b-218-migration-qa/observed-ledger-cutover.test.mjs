import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const dir=new URL('./',import.meta.url);
const base=await readFile(new URL('20261102034519_front_b_origin_withdrawal_v2.freeze.guarded.sql.txt',dir));
const candidate=await readFile(new URL('cutover-218-observed-ledger.guarded.sql.txt',dir));
const sha=x=>createHash('sha256').update(x).digest('hex');
test('derivação altera exclusivamente guarda do ledger e preserva travas',()=>{
 assert.equal(sha(base),'e1d1bf04bb9723a7fa907b5c6a8d24154e87be93f9b993edcf36b8f0acff01aa');
 assert.equal(sha(candidate),'3d00f3b2f81edfff0dcd01b3837a11925ebdcb3ed542ebe8158e2a28e8d0a17c');
 const original=base.toString('utf8'),updated=candidate.toString('utf8');
 const old=" ) OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version>'20261101235120') THEN\n";
 assert.equal(original.split(old).length,2);
 const [prefix,suffix]=original.split(old);assert.ok(updated.startsWith(prefix));assert.ok(updated.endsWith(suffix));
 const block=updated.slice(prefix.length,updated.length-suffix.length);
 assert.match(block,/version='20261102100908' AND name='sc218_quarantine_install_20261102'/);
 assert.match(block,/cardinality\(statements\)=1/);
 assert.match(block,/fab48cfdf12630643623e4e1d58251b3bcc35bc7c6c0f57d7d93e415514ddb00/);
 assert.match(block,/version IS DISTINCT FROM '20261102100908' OR name IS DISTINCT FROM 'sc218_quarantine_install_20261102'/);
 assert.match(block,/name='sc218_ledger_probe_20261102_5e81f9ab'/);
 for(const guard of ['DO $manual_guard$ BEGIN RAISE EXCEPTION','DO $cutover_guard$ BEGIN RAISE EXCEPTION'])assert.equal(updated.split(guard).length-1,1);
 for(const token of ['LOCK TABLE app_private.signup_intents,app_private.signup_origins IN ACCESS EXCLUSIVE MODE;','ALTER TABLE app_private.signup_intents DISABLE TRIGGER sc_cutover_freeze_038f;','ALTER TABLE app_private.signup_origins DISABLE TRIGGER sc_cutover_freeze_038f;','ALTER TABLE app_private.signup_intents ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f;','ALTER TABLE app_private.signup_origins ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f;','COMMIT;'])assert.equal(updated.split(token).length-1,1,token);
});
