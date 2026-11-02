import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const {PGlite}=createRequire(import.meta.url)('@electric-sql/pglite');
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const [quarantine,cancel,original,baseline]=await Promise.all(['./quarantine-218-qa-snapshot.guarded.sql.txt','./cancel-quarantine-218.guarded.sql.txt','./quarantine-218.guarded.sql.txt','./20261102034519_front_b_origin_withdrawal_v2.sql.txt'].map(read));
const hash=s=>createHash('sha256').update(s).digest('hex');
const section=(s,start,end)=>{assert.equal(s.split(start).length,2);assert.equal(s.split(end).length,2);return s.slice(s.indexOf(start),s.indexOf(end)+end.length);};
test('quarentena conserva guards e copia catálogo e barreira de fontes fixadas',()=>{
 assert.equal(hash(quarantine),'4046e7fdd3074f1cbb5fff5be37f7ae2b3c51c3d7b3c6aca06b79dab26a4550b');
 assert.equal(hash(original),'3079f81cb88ca090286e8b664c5102361e3986c6639309514094277bfe21a58d');
 assert.equal(hash(baseline),'937058950b18de043dd7c97de55e0f37d0ae45ab328c3a2fd40c90bb3a3a7081');
 assert.equal(section(quarantine,'DO $catalog_guard$','END $catalog_guard$;'),section(baseline,'DO $catalog_guard$','END $catalog_guard$;'));
 assert.equal(section(quarantine,'do $freeze_check$','end $freeze_check$;'),section(original,'do $freeze_check$','end $freeze_check$;'));
 assert.match(quarantine,/STOP: quarantine is not qualified or authorized/);assert.match(quarantine,/STOP: destination, writers and Auth not proven/);
 assert.match(quarantine,/STOP: QA nonempty/);assert.match(quarantine,/STOP: cron baseline differs/);assert.match(quarantine,/LOCK TABLE app_private.signup_settings,app_private.signup_intents,app_private.signup_origins IN ACCESS EXCLUSIVE MODE/);
});
test('cancelamento exige revisão de ledger e recusa corte v2',()=>{
 assert.equal(hash(cancel),'3b9eb0edcdf9c89cfd387b22382d98a53a4d0eecad961dc0b2d613d6b0dd06ca');
 assert.match(cancel,/STOP: cancellation not qualified or authorized/);assert.match(cancel,/STOP: writers and safe recovery not proven/);assert.match(cancel,/STOP: actual quarantine ledger version not observed or reviewed/);
 assert.match(cancel,/to_regprocedure\('public.signup_origin_withdraw_v2/);assert.match(cancel,/to_regprocedure\('public.signup_fence_reserve_origin_v2/);
 assert.match(cancel,/to_regprocedure\('public.signup_fence_finish_origin_v2/);assert.match(cancel,/origin_revision_snapshot_set/);
 assert.equal(section(cancel,'do $freeze_check$','end $freeze_check$;'),section(original,'do $freeze_check$','end $freeze_check$;'));
 assert.ok(cancel.indexOf('end $freeze_check$;')<cancel.indexOf('DROP TRIGGER'));assert.match(cancel,/STOP: barrier removal incomplete/);
});
test('execução direta é sempre recusada antes de criar ou remover barreira',async()=>{
 const db=new PGlite();try{for(const [sql,error] of [[quarantine,/STOP: quarantine is not qualified or authorized/],[cancel,/STOP: cancellation not qualified or authorized/]]){await assert.rejects(db.exec(sql),error);await db.exec('ROLLBACK');const r=await db.query("SELECT to_regnamespace('app_private') AS private_schema");assert.equal(r.rows[0].private_schema,null);}}finally{await db.close();}
});
