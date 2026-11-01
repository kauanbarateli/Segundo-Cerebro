import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('counts distinct affected users and excludes the cohorts rejected by the admission guard', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create schema app_private;
      create table auth.users (id int primary key,email_confirmed_at timestamptz,is_anonymous boolean not null default false,deleted_at timestamptz,banned_until timestamptz);
      create table auth.sessions (user_id int not null,not_after timestamptz);
      create table public.user_moderation (user_id int,status text,must_change_password boolean);
      create table app_private.admin_operations (target_user_id int,command text,phase text);
      insert into auth.users(id) select n from generate_series(1,10) n;
      insert into auth.sessions(user_id) select n from generate_series(1,10) n;
      insert into auth.sessions(user_id) values(1);
      insert into public.user_moderation select n,'active',false from generate_series(1,10) n;
      update auth.users set email_confirmed_at=now() where id=2;
      update auth.users set is_anonymous=true where id=3;
      update auth.users set deleted_at=now() where id=4;
      update auth.users set banned_until=now()+interval '1 day' where id=5;
      update auth.sessions set not_after=now()-interval '1 day' where user_id=6;
      update public.user_moderation set status='blocked' where user_id=7;
      update public.user_moderation set must_change_password=true where user_id=8;
      insert into app_private.admin_operations values(9,'admin.user.create','complete'),(10,'admin.user.create','reserved');`);
    const sql=await readFile(new URL('../../supabase/operations/inspect-front-b-legacy-cohort.sql',import.meta.url),'utf8');
    const result=await db.query(sql);
    assert.deepEqual(result.rows,[{contas_nao_confirmadas_ativas:2}]);
    await db.exec('update auth.users set email_confirmed_at=now() where id in (1,10)');
    assert.deepEqual((await db.query(sql)).rows,[{contas_nao_confirmadas_ativas:0}]);
  } finally { await db.close(); }
});
