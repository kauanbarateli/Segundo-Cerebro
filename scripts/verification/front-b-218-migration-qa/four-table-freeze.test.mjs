import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),read=n=>readFile(new URL(n,root));
const source=await read('cutover-218-observed-ledger.guarded.sql.txt'),candidate=await read('extend-freeze-four-tables.guarded.sql.txt');
const sha=x=>createHash('sha256').update(x).digest('hex');
test('candidata permanece bloqueada e reutiliza catálogo e barreira revisados',()=>{
 assert.equal(sha(source),'3d00f3b2f81edfff0dcd01b3837a11925ebdcb3ed542ebe8158e2a28e8d0a17c');
 assert.equal(sha(candidate),'eb9cc8f05bb36437689a9c84c6dbd5653845390fc9cabf3f8ad41bf91e636d0e');
 const src=source.toString(),sql=candidate.toString();
 for(const g of ['DO $manual_guard$ BEGIN RAISE EXCEPTION','DO $external_guard$ BEGIN RAISE EXCEPTION'])assert.equal(sql.split(g).length-1,1);
 const block=(s,a,b)=>{assert.equal(s.split(a).length,2);const start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(end>start);return s.slice(start,end+b.length)};
 assert.ok(sql.includes(block(src,'DO $catalog_guard$','END $catalog_guard$;')));
 const start=src.indexOf('do $freeze_check$'),end=src.indexOf('end $freeze_check$;',start);assert.ok(start>=0&&end>start);
 assert.ok(sql.includes(src.slice(start,end+'end $freeze_check$;'.length)));
 assert.ok(sql.indexOf('DO $external_guard$')<sql.indexOf('LOCK TABLE'));
 assert.ok(sql.indexOf('LOCK TABLE')<sql.indexOf('CREATE TRIGGER'));
 assert.match(sql,/LOCK TABLE app_private\.signup_completion_fences_draft,app_private\.signup_intents,app_private\.signup_origins,app_private\.user_admission IN ACCESS EXCLUSIVE MODE/);
 for(const table of ['signup_completion_fences_draft','user_admission']){
  assert.equal(sql.split(`ON app_private.${table} FOR EACH STATEMENT EXECUTE FUNCTION app_private.sc_cutover_freeze_038f();`).length-1,1);
  assert.equal(sql.split(`ALTER TABLE app_private.${table} ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f;`).length-1,1);
  assert.match(sql,new RegExp(`t\\.tgrelid='app_private\\.${table}'::regclass`));
 }
 assert.match(sql,/t\.tgfoid=fn and not t\.tgisinternal\)<>4/);
 assert.match(sql,/EXISTS\(SELECT 1 FROM app_private\.signup_completion_fences_draft\)/);
 assert.doesNotMatch(sql,/\b(?:DELETE FROM|TRUNCATE TABLE|DROP TRIGGER|DROP FUNCTION)\b/i);
 assert.equal(sql.split('COMMIT;').length-1,1);
});
