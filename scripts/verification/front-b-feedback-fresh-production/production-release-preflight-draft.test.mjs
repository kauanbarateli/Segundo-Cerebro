import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

test('production preflight remains guarded, bounded and ends in rollback', async () => {
 const sql=await readFile(new URL('./production-release-preflight.DRAFT.guarded.sql.txt',import.meta.url),'utf8');
 const manual="DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: feedback release not qualified or authorized'; END $manual_guard$;";
 const pt409="DO $pt409_guard$ BEGIN RAISE EXCEPTION 'STOP: PT409 preservation not yet qualified'; END $pt409_guard$;";
 assert.equal(sql.split(manual).length,2); assert.equal(sql.split(pt409).length,2);
 assert.ok(sql.indexOf(manual)<sql.indexOf('LOCK TABLE')); assert.ok(sql.indexOf(pt409)<sql.indexOf('LOCK TABLE'));
 const verifier=await readFile(new URL('../../../supabase/operations/verify-onboarding-conflict-code.sql',import.meta.url),'utf8');
 const begin="select\n    p.prokind = 'f'";
 const end="where p.oid = to_regprocedure('public.onboarding_call(uuid,uuid,text,jsonb)')";
 const predicate=text=>{const a=text.indexOf(begin), b=text.indexOf(end,a);assert.ok(a>=0 && b>a);return text.slice(a,b+end.length);};
 assert.equal(predicate(sql),predicate(verifier));
 assert.ok(sql.indexOf('SET LOCAL search_path = pg_catalog, public;')<sql.indexOf('DO $pt409_snapshot$'));
 assert.ok(sql.indexOf('DO $pt409_snapshot$')>sql.indexOf('LOCK TABLE'));
 assert.match(sql,/count\(\*\) FROM supabase_migrations\.schema_migrations\) <> 5/);
 for(const value of ['20261007151834','20261007151850','20261007151904','20261007210519','20261007223710',
  '68e8122cedd4c6062b4c9ee9630fcdbba36a5e079ce31c9ded480ca23fa2f478',
  'd996b99e2bc3f327a1780582cdfd44cdce482c572eb765b1fb0004eff7a5092d',
  'f59ebde8976e8b6d0f68dcc9676336f29c648de86cb3d47f92c26d9fdcd19c85',
  '803504cb5f1c0ab40e7334eea9dc43e263ef54c04669c9ca7c0f76ba212280d3']) assert.ok(sql.includes(value));
 assert.match(sql,/LOCK TABLE public\.domain_events IN ACCESS EXCLUSIVE MODE;/);
 assert.match(sql,/ROLLBACK;\s*$/);
 assert.doesNotMatch(sql,/\b(?:CREATE|ALTER|DROP|DELETE|UPDATE|INSERT|TRUNCATE)\b/i);
});
