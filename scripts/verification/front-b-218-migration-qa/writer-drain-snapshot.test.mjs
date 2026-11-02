import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sql=await readFile(new URL('./writer-drain-snapshot.readonly.sql.txt',import.meta.url),'utf8');
test('diagnóstico permanece somente leitura e qualifica cron, ACLs e conjunto de triggers',()=>{
 assert.equal(createHash('sha256').update(sql).digest('hex'),'fda860fa3089c2a6705abc42fad8e201b47a3a5b2d1be9f1625f8cbae6775168');
 assert.match(sql,/BEGIN TRANSACTION READ ONLY;/);assert.match(sql,/ROLLBACK;\s*$/);
 assert.doesNotMatch(sql,/\b(?:pg_cancel_backend|pg_terminate_backend|cron\.schedule|cron\.unschedule|cron\.alter_job)\s*\(|\bLOCK\s+TABLE\b/i);
 assert.match(sql,/expected_onboarding_job/);assert.match(sql,/unfinished_cron_runs/);assert.match(sql,/net_queue_visible/);
 assert.match(sql,/jobname ILIKE 'sc-signup-%'/);assert.match(sql,/FROM cron\.job_run_details WHERE end_time IS NULL\) AS unfinished_cron_runs/);
 assert.match(sql,/mode IN \('RowExclusiveLock','ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock'\)/);
 assert.match(sql,/function_mismatches/);assert.match(sql,/aclexplode/);assert.match(sql,/trigger_set_sha/);assert.equal((sql.match(/'app_private\.[a-z_]+\([^']*\)','[a-f0-9]{64}',(?:true|false)/g)||[]).length,12);
});
