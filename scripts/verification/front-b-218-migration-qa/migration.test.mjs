import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const migration = await readFile(new URL('./20261102034519_front_b_origin_withdrawal_v2.sql.txt', import.meta.url), 'utf8');
const candidate = await readFile(new URL('../front-b-218-withdrawal-v2/guarded.sql.txt', import.meta.url), 'utf8');
const hard = "DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: migration is not qualified or authorized'; END $manual_guard$;";
const barrier = "DO $cutover_guard$ BEGIN RAISE EXCEPTION 'STOP: writer quarantine and drainage are not qualified'; END $cutover_guard$;";
test('a migration conserva as travas e o conteúdo normalizado da candidata', async () => {
 assert.equal(migration.split(hard).length, 2); assert.equal(migration.split(barrier).length, 2);
 assert.equal((await readdir(new URL('../../../supabase/migrations/', import.meta.url))).includes('20261102034519_front_b_origin_withdrawal_v2.sql'), false);
 const actual = migration.slice(migration.indexOf('-- Distinct'), migration.lastIndexOf('COMMIT;')).trim();
 const expected = candidate.slice(candidate.indexOf('-- Distinct'), candidate.lastIndexOf('COMMIT;')).trim();
 assert.equal(actual.replace(/\r\n/g,'\n'), expected.replace(/\r\n/g,'\n'));
 assert.match(migration,/public\.onboarding_call\(uuid, uuid, text, jsonb\)/);
 assert.match(migration,/20261101235120/); assert.match(migration,/pg_get_functiondef/); assert.match(migration,/pg_get_constraintdef/);
});
test('a trava incondicional aborta antes de qualquer alteração', async () => {
 const db = new PGlite(); try {
  await assert.rejects(db.exec(migration),/STOP: migration is not qualified or authorized/);
  await db.exec('ROLLBACK'); const result = await db.query("SELECT to_regprocedure('public.signup_origin_withdraw_v2(uuid,uuid,uuid)') AS routine");
  assert.equal(result.rows[0].routine,null);
 } finally { await db.close(); }
});
test('sem a trava em memória, catálogo não qualificado permanece recusado', async () => {
 const db = new PGlite(); try {
  await assert.rejects(db.exec(migration.replace(hard,'')),/STOP: (executor or PostgreSQL version differs|ledger unavailable|ledger differs from reviewed QA snapshot)/);
  await db.exec('ROLLBACK');
 } finally { await db.close(); }
});
