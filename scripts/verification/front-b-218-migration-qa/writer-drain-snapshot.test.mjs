import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sql=await readFile(new URL('./writer-drain-snapshot.readonly.sql.txt',import.meta.url),'utf8');
test('diagnóstico permanece somente leitura e qualifica cron, ACLs e conjunto de triggers',()=>{
 assert.equal(createHash('sha256').update(sql).digest('hex'),'9d62ed425008a801b77e1dfc0211d498252ee84f5119b097739b9dc182cab601');
 assert.match(sql,/BEGIN TRANSACTION READ ONLY;/);assert.match(sql,/ROLLBACK;\s*$/);
 assert.doesNotMatch(sql,/\b(?:pg_cancel_backend|pg_terminate_backend|cron\.schedule|cron\.unschedule|cron\.alter_job)\s*\(|\bLOCK\s+TABLE\b/i);
 assert.match(sql,/expected_onboarding_job/);assert.match(sql,/unfinished_cron_runs/);assert.match(sql,/net_queue_visible/);
 assert.match(sql,/function_mismatches/);assert.match(sql,/aclexplode/);assert.match(sql,/trigger_set_sha/);assert.equal((sql.match(/'app_private\.[a-z_]+\([^']*\)','[a-f0-9]{64}',(?:true|false)/g)||[]).length,12);
});
