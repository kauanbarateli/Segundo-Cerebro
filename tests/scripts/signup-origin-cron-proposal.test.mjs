import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCatalogueFixture} from './helpers/catalogue-fixture.mjs';

test('proposta cron é inerte e recusa colisão sem alterar outros jobs', {timeout:60000},async()=>{
 const db=await createCatalogueFixture();
 try {
  await db.exec(`create schema cron; create schema app_private;
   create table cron.job(jobid bigint generated always as identity, jobname text, schedule text, command text, username text default current_user, database text default current_database(), active boolean default true);
   create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid $$;
   create function cron.alter_job(job_id bigint, schedule text default null, command text default null, database text default null, username text default null, active boolean default null) returns void language sql as $$ update cron.job j set active=coalesce($6,j.active) where jobid=$1 $$;
   create function app_private.signup_prune() returns jsonb language sql as $$ select '{}'::jsonb $$;`);
  const source=await readFile(new URL('../../proposals/signup-origin-cron-registration.sql',import.meta.url),'utf8');
  await assert.rejects(db.exec(source),/DRAFT_ONLY/); await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int as n from cron.job')).rows[0].n,0);
  const enabledForFixture=source.replace(/^do \$draft_only\$.*$/m,'').replace(/^rollback;$/m,'commit;');
  assert.notEqual(enabledForFixture,source);
  await db.exec(enabledForFixture); await db.exec(enabledForFixture);
  const jobs=(await db.query('select jobname,schedule,active from cron.job')).rows;
  assert.deepEqual(jobs,[{jobname:'sc-signup-origin-retention-v1',schedule:'*/5 * * * *',active:false}]);
  await db.exec("update cron.job set command='unrelated command' where jobname='sc-signup-origin-retention-v1'");
  await assert.rejects(db.exec(enabledForFixture),error=>error.code==='23514'); await db.exec('rollback');
  assert.equal((await db.query('select command from cron.job')).rows[0].command,'unrelated command');
  await db.exec("update cron.job set command='SET statement_timeout = ''20s''; SET lock_timeout = ''250ms''; SELECT app_private.signup_prune();',active=true");
  await assert.rejects(db.exec(enabledForFixture),error=>error.code==='23514'); await db.exec('rollback');
  assert.equal((await db.query('select active from cron.job')).rows[0].active,true);
 } finally {await db.close();}
});
