import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');

const dir = new URL('./', import.meta.url);
const base = await readFile(new URL('20261102034519_front_b_origin_withdrawal_v2.sql.txt', dir), 'utf8');
const proposal = await readFile(new URL('20261102034519_front_b_origin_withdrawal_v2.freeze.guarded.sql.txt', dir), 'utf8');
const quarantine = await readFile(new URL('quarantine-218.guarded.sql.txt', dir), 'utf8');
const digest = text => createHash('sha256').update(text).digest('hex');
const hard = "DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: migration is not qualified or authorized'; END $manual_guard$;";
const cut = "DO $cutover_guard$ BEGIN RAISE EXCEPTION 'STOP: writer quarantine and drainage are not qualified'; END $cutover_guard$;";
const freezeCheck = /do \$freeze_check\$[\s\S]*?end \$freeze_check\$;/g;

test('a proposta permanece fechada e preserva a candidata e o ledger anterior', () => {
 assert.equal(digest(base),'937058950b18de043dd7c97de55e0f37d0ae45ab328c3a2fd40c90bb3a3a7081');
 assert.equal(proposal.split(hard).length,2); assert.equal(proposal.split(cut).length,2);
 assert.match(proposal,/version>'20261101235120'/);
 const start='-- Distinct, opaque revisions';
 const tail='ALTER TABLE app_private.signup_intents ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f;';
 assert.equal(proposal.slice(proposal.indexOf(start),proposal.indexOf(tail)).trim(),base.slice(base.indexOf(start),base.lastIndexOf('COMMIT;')).trim());
});

test('a quarentena proposta conserva as guardas e verifica a mesma barreira', () => {
 assert.match(quarantine,/STOP: quarantine is not qualified or authorized/);
 assert.match(quarantine,/STOP: destination, writers and Auth not proven/);
 assert.match(quarantine,/LOCK TABLE app_private.signup_settings,app_private.signup_intents,app_private.signup_origins IN ACCESS EXCLUSIVE MODE/);
 assert.deepEqual([...quarantine.matchAll(freezeCheck)].map(x=>x[0]),[[...proposal.matchAll(freezeCheck)][0][0]]);
 assert.ok(quarantine.indexOf('STOP: quarantine is not qualified or authorized')<quarantine.indexOf('CREATE FUNCTION app_private.sc_cutover_freeze_038f'));
});

test('as duas propostas abortam antes de mutações quando executadas diretamente', async () => {
 const db=new PGlite(); try {
  for(const [sql,error] of [[proposal,/STOP: migration is not qualified or authorized/],[quarantine,/STOP: quarantine is not qualified or authorized/]]){
   await assert.rejects(db.exec(sql),error); await db.exec('ROLLBACK');
   const result=await db.query("SELECT to_regprocedure('public.signup_origin_withdraw_v2(uuid,uuid,uuid)') AS v2, to_regprocedure('app_private.sc_cutover_freeze_038f()') AS barrier");
   assert.equal(result.rows[0].v2,null);assert.equal(result.rows[0].barrier,null);
  }
 } finally { await db.close(); }
});

test('hash da barreira e travas de tabelas envolvem a única exceção transacional', () => {
 const checks=[...proposal.matchAll(freezeCheck)].map(x=>x[0]);
 assert.equal(checks.length,2); assert.equal(checks[0],checks[1]);
 assert.match(checks[0],/85efc797c669b1550ffebf9402a28c84a9b48c5a0c0ea46f26981f6beea9269d/);
 assert.match(checks[0],/t\.tgtype=62 and t\.tgenabled='A'/);
 const points=['BEGIN;',hard,'LOCK TABLE app_private.signup_intents,app_private.signup_origins IN ACCESS EXCLUSIVE MODE;',checks[0],cut,'ALTER TABLE app_private.signup_intents DISABLE TRIGGER sc_cutover_freeze_038f;','-- Distinct, opaque revisions','ALTER TABLE app_private.signup_intents ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f;'];
 let previous=-1;for(const point of points){const current=proposal.indexOf(point,previous+1);assert.ok(current>previous,point);previous=current;}
 assert.ok(proposal.lastIndexOf(checks[1])>previous); assert.ok(proposal.lastIndexOf('COMMIT;')>proposal.lastIndexOf(checks[1]));
 for(const table of ['signup_intents','signup_origins'])for(const verb of ['DISABLE','ENABLE ALWAYS'])assert.equal(proposal.split(`ALTER TABLE app_private.${table} ${verb} TRIGGER sc_cutover_freeze_038f;`).length,2);
});
