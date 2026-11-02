import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const dir=new URL('./',import.meta.url);
const sql=await readFile(new URL('cutover-218-four-table.DRAFT.guarded.sql.txt',dir),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
test('four-table draft remains blocked and binds no guessed extension',()=>{
 assert.equal(sha(sql),'05af34d5deaf3658cc30ea63d456e032ab71e8c29982142152ed5cd63021709a');
 for(const tag of ['manual_guard','extension_pending_guard','cutover_guard'])assert.match(sql,new RegExp(`DO \\$${tag}\\$ BEGIN RAISE EXCEPTION`));
 for(const pending of ['__FOUR_TABLE_VERSION_PENDING__','__FOUR_TABLE_NAME_PENDING__','__FOUR_TABLE_STATEMENT_SHA256_PENDING__'])assert.ok(sql.includes(pending));
 assert.match(sql,/LOCK TABLE app_private\.signup_completion_fences_draft,app_private\.signup_intents,app_private\.signup_origins,app_private\.user_admission IN ACCESS EXCLUSIVE MODE/);
 assert.equal(sql.split('t.tgfoid=fn and not t.tgisinternal)<>4').length-1,2);
 for(const table of ['signup_intents','signup_origins']){assert.equal(sql.split(`ALTER TABLE app_private.${table} DISABLE TRIGGER`).length-1,1);assert.equal(sql.split(`ALTER TABLE app_private.${table} ENABLE ALWAYS TRIGGER`).length-1,1);}
 for(const table of ['signup_completion_fences_draft','user_admission'])assert.ok(!sql.includes(`ALTER TABLE app_private.${table} DISABLE TRIGGER`));
 assert.match(sql,/EXISTS\(SELECT 1 FROM app_private\.signup_completion_fences_draft\)/);
 assert.equal(sql.split('COMMIT;').length-1,1);
});
test('identity SQL rejects old versions, reused names and malformed hashes',async()=>{
 const {PGlite}=createRequire(import.meta.url)('@electric-sql/pglite');
 const db=new PGlite();
 const start=sql.indexOf('DO $extension_identity_guard$'),end=sql.indexOf('END $extension_identity_guard$;',start);
 assert.ok(start>=0&&end>start);
 const block=sql.slice(start,end+'END $extension_identity_guard$;'.length);
 const render=(v,n,h)=>block.replaceAll('__FOUR_TABLE_VERSION_PENDING__',v).replaceAll('__FOUR_TABLE_NAME_PENDING__',n).replaceAll('__FOUR_TABLE_STATEMENT_SHA256_PENDING__',h);
 const valid=['20261102100909','extension_test','a'.repeat(64)];
 try {
  await db.exec(render(...valid));
  for(const values of [['20261102100908',valid[1],valid[2]],['2026110210090x',valid[1],valid[2]],[valid[0],'sc218_quarantine_install_20261102',valid[2]],[valid[0],'BAD-NAME',valid[2]],[valid[0],valid[1],'f'.repeat(63)],[valid[0],valid[1],'G'.repeat(64)]])await assert.rejects(db.exec(render(...values)),/extension identity not qualified/);
  await assert.rejects(db.exec(block),/extension identity not qualified/);
 } finally {await db.close();}
});
