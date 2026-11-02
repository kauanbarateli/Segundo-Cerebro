import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('./',import.meta.url);
const original=await readFile(new URL('cancel-quarantine-218.guarded.sql.txt',root));
const candidate=await readFile(new URL('cancel-quarantine-218-ledger-bound.guarded.sql.txt',root));
const install=await readFile(new URL('quarantine-218-install-qa.reviewable.sql.txt',root));
const digest=x=>createHash('sha256').update(x).digest('hex');
test('recuperação bloqueada preserva origem e fixa bytes para revisão',()=>{
 assert.equal(digest(original),'3b9eb0edcdf9c89cfd387b22382d98a53a4d0eecad961dc0b2d613d6b0dd06ca');
 assert.equal(digest(install),'fab48cfdf12630643623e4e1d58251b3bcc35bc7c6c0f57d7d93e415514ddb00');
 assert.equal(digest(candidate),'c89ac6bde8f3aba4d9be5dfb0b5bb4c8c71654c456436b0fa10ce40683644578');
 const s=candidate.toString('utf8');
 assert.match(s,/DO \$manual_guard\$ BEGIN RAISE EXCEPTION/);
 assert.match(s,/DO \$external_guard\$ BEGIN RAISE EXCEPTION/);
 assert.match(s,/actual_quarantine_version constant text := '__QA_QUARANTINE_VERSION_PENDING__'/);
 assert.match(s,/actual_quarantine_name constant text := '__QA_QUARANTINE_NAME_PENDING__'/);
 assert.ok(s.indexOf('LOCK TABLE')<s.indexOf('DO $ledger_guard$'));
 assert.ok(s.indexOf('DO $ledger_guard$')<s.indexOf('DROP TRIGGER'));
 assert.match(s,/version IS DISTINCT FROM actual_quarantine_version OR name IS DISTINCT FROM actual_quarantine_name/);
 assert.match(s,/cardinality\(statements\)=1/);
 for (const token of ['signup_completion_fences_draft','origin_revision_snapshot_set','PERSISTENT_FREEZE_NOT_PROVEN','DROP TRIGGER','DROP FUNCTION','COMMIT;']) assert.ok(s.includes(token));
 assert.doesNotMatch(s,/\b(?:DELETE FROM|TRUNCATE TABLE|UPDATE supabase_migrations|DELETE FROM supabase_migrations)\b/i);
});
