--019 assertions for a disposable, empty Auth catalogue only.
-- Owner/postgres + SET ROLE required. No password, token, real account or service.
-- Does not prove GoTrue, HTTP, browser or hosted execution. Everything rolls back.
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
set local app.sessions_user_a='19370000-0000-4000-8000-000000000001';
set local app.sessions_user_b='19370000-0000-4000-8000-000000000002';
set local app.sessions_current_a='19370000-0000-4000-8000-000000000011';
set local app.sessions_current_b='19370000-0000-4000-8000-000000000012';
set local app.sessions_other_a='19370000-0000-4000-8000-000000000013';
set local app.sessions_expired_a='19370000-0000-4000-8000-000000000014';

create function pg_temp.sessions_assert(ok boolean,message text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'Own sessions019: %',message;end if;
end $$;
create function pg_temp.sessions_error(command text,expected_state text) returns void language plpgsql security invoker as $$declare actual text;begin
 begin execute command;exception when others then
  get stacked diagnostics actual=returned_sqlstate;
  if actual<>expected_state then raise exception 'Own sessions019 expected %, received %',expected_state,actual;end if;
  return;
 end;
 raise exception 'Own sessions019 expected rejection';
end $$;
do $$declare temp_schema text;begin
 select nspname into strict temp_schema from pg_namespace where oid=pg_my_temp_schema();
 execute format('grant usage on schema %I to anon,authenticated,service_role',temp_schema);
end $$;
grant execute on function pg_temp.sessions_assert(boolean,text),pg_temp.sessions_error(text,text) to anon,authenticated,service_role;
select pg_temp.sessions_assert(current_user='postgres' and not exists(select 1 from auth.users) and not exists(select 1 from auth.sessions),'requires empty disposable Auth owner catalogue');
select pg_temp.sessions_assert(to_regprocedure('public.my_sessions()') is not null and to_regprocedure('app_private.my_sessions()') is not null,'reviewed019 required');

-- Fixed synthetic identifiers deliberately fail on collision; no overwrite/upsert.
insert into auth.users(id,aud,role,email,is_anonymous,raw_user_meta_data) values
 (current_setting('app.sessions_user_a')::uuid,'authenticated','authenticated','sessions019-a@example.invalid',false,'{"role":"master","private_canary":"NOT_A_SESSION_FIELD"}'),
 (current_setting('app.sessions_user_b')::uuid,'authenticated','authenticated','sessions019-b@example.invalid',false,'{}');
insert into auth.sessions(id,user_id,created_at,refreshed_at,not_after) values
 (current_setting('app.sessions_current_a')::uuid,current_setting('app.sessions_user_a')::uuid,null,null,null),
 (current_setting('app.sessions_current_b')::uuid,current_setting('app.sessions_user_b')::uuid,'2026-01-01T00:00:00Z',null,null),
 (current_setting('app.sessions_other_a')::uuid,current_setting('app.sessions_user_a')::uuid,'2026-10-01T12:00:00Z','2026-10-02 15:30:00',null),
 (current_setting('app.sessions_expired_a')::uuid,current_setting('app.sessions_user_a')::uuid,'2026-09-01T00:00:00Z',null,now()-interval '1 day');
update public.user_roles set role='master' where user_id=current_setting('app.sessions_user_b')::uuid;
select set_config('app.sessions_events',(select count(*)::text from public.domain_events),true);
select set_config('app.sessions_receipts',(select count(*)::text from app_private.command_receipts),true);
select set_config('app.sessions_limits',(select count(*)::text from app_private.rate_limits),true);

set local role anon;
select pg_temp.sessions_error('select public.my_sessions()','42501');
select pg_temp.sessions_error('select app_private.my_sessions()','42501');
reset role;
set local role service_role;
select pg_temp.sessions_error('select public.my_sessions()','42501');
select pg_temp.sessions_error('select app_private.my_sessions()','42501');
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.sessions_user_a'),'session_id',current_setting('app.sessions_current_a'),'role','authenticated','is_anonymous',false)::text,true);
set local timezone='Europe/Berlin';
set local role authenticated;
do $$declare result jsonb;row jsonb;begin
 result:=public.my_sessions();
 perform pg_temp.sessions_assert(result-array['sessions','has_more']='{}'::jsonb and jsonb_array_length(result->'sessions')=3 and result->'has_more'='false'::jsonb,'closed result and own rows only');
 perform pg_temp.sessions_assert(result->'sessions'->0->>'id'=current_setting('app.sessions_current_a') and result->'sessions'->0->'is_current'='true'::jsonb,'current SID first despite nullable creation');
 perform pg_temp.sessions_assert(result->'sessions'->0->'created_at'='null'::jsonb and result->'sessions'->0->'refreshed_at'='null'::jsonb,'nullable timestamps remain null');
 for row in select value from jsonb_array_elements(result->'sessions') loop
  perform pg_temp.sessions_assert(row-array['id','is_current','created_at','refreshed_at','not_after']='{}'::jsonb and (select count(*)=5 from jsonb_object_keys(row)),'exact metadata fields');
  perform pg_temp.sessions_assert(row->>'id'<>current_setting('app.sessions_current_b'),'foreign owner excluded');
  if row->>'id'=current_setting('app.sessions_other_a') then
   perform pg_temp.sessions_assert((row->>'refreshed_at')::timestamptz='2026-10-02T15:30:00Z'::timestamptz,'GoTrue zoneless refresh interpreted as UTC');
  end if;
 end loop;
 perform pg_temp.sessions_assert((select count(*)=1 from jsonb_array_elements(result->'sessions') x where x->'is_current'='true'::jsonb),'single current marker');
 perform pg_temp.sessions_assert(exists(select 1 from jsonb_array_elements(result->'sessions') x where x->>'id'=current_setting('app.sessions_expired_a')),'registered noncurrent expired row is metadata, not validity guarantee');
end $$;
select pg_temp.sessions_error('select id from auth.sessions','42501');
select pg_temp.sessions_error('update auth.sessions set refreshed_at=now()','42501');
select pg_temp.sessions_error('delete from auth.sessions','42501');
-- JWT fields are not caller parameters; malformed/spoofed role or SID fails closed.
do $$declare patch jsonb;base jsonb;begin
 base:=auth.jwt();
 for patch in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_build_object('session_id',null),jsonb_build_object('session_id','not-a-uuid'),
  jsonb_build_object('session_id',current_setting('app.sessions_current_b')),
  jsonb_build_object('session_id','19370000-0000-4000-8000-000000000099'),
  jsonb_build_object('sub',null),jsonb_build_object('sub','not-a-uuid'),
  jsonb_build_object('sub',current_setting('app.sessions_user_b')),
  jsonb_build_object('role','service_role'),jsonb_build_object('role','anon'),jsonb_build_object('role','master'))) loop
  perform set_config('request.jwt.claims',(base||patch)::text,true);
  perform pg_temp.sessions_error('select public.my_sessions()','42501');
 end loop;
 perform set_config('request.jwt.claims',base::text,true);
end $$;
reset role;
select pg_temp.sessions_assert((select count(*)::text=current_setting('app.sessions_events') from public.domain_events) and (select count(*)::text=current_setting('app.sessions_receipts') from app_private.command_receipts) and (select count(*)::text=current_setting('app.sessions_limits') from app_private.rate_limits),'read emits no event, receipt or limit row');

-- Even a master account cannot enumerate another account's sessions.
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.sessions_user_b'),'session_id',current_setting('app.sessions_current_b'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare result jsonb;begin
 result:=public.my_sessions();perform pg_temp.sessions_assert(jsonb_array_length(result->'sessions')=1 and result->'sessions'->0->>'id'=current_setting('app.sessions_current_b'),'master is still owner isolated');
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.sessions_user_a'),'session_id',current_setting('app.sessions_current_a'),'role','authenticated')::text,true);

-- Current live Auth and moderation vetoes supersede editable profile metadata.
update public.user_moderation set status='blocked' where user_id=current_setting('app.sessions_user_a')::uuid;
set local role authenticated;select pg_temp.sessions_error('select public.my_sessions()','42501');reset role;
update public.user_moderation set status='active',must_change_password=true where user_id=current_setting('app.sessions_user_a')::uuid;
set local role authenticated;select pg_temp.sessions_error('select public.my_sessions()','42501');reset role;
update public.user_moderation set must_change_password=false where user_id=current_setting('app.sessions_user_a')::uuid;
update auth.users set banned_until=now()+interval '1 hour' where id=current_setting('app.sessions_user_a')::uuid;
set local role authenticated;select pg_temp.sessions_error('select public.my_sessions()','42501');reset role;
update auth.users set banned_until=null,deleted_at=now() where id=current_setting('app.sessions_user_a')::uuid;
set local role authenticated;select pg_temp.sessions_error('select public.my_sessions()','42501');reset role;
update auth.users set deleted_at=null,is_anonymous=true where id=current_setting('app.sessions_user_a')::uuid;
set local role authenticated;select pg_temp.sessions_error('select public.my_sessions()','42501');reset role;
update auth.users set is_anonymous=false where id=current_setting('app.sessions_user_a')::uuid;
delete from public.user_roles where user_id=current_setting('app.sessions_user_a')::uuid;
set local role authenticated;select pg_temp.sessions_error('select public.my_sessions()','42501');reset role;
insert into public.user_roles(user_id,role) values(current_setting('app.sessions_user_a')::uuid,'user');
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('app.sessions_user_a')::uuid,'configuracoes',false);
set local role authenticated;select pg_temp.sessions_error('select public.my_sessions()','42501');reset role;
delete from public.user_entitlements where user_id=current_setting('app.sessions_user_a')::uuid and feature_key='configuracoes';
update auth.sessions set not_after=now()-interval '1 second' where id=current_setting('app.sessions_current_a')::uuid;
set local role authenticated;select pg_temp.sessions_error('select public.my_sessions()','42501');reset role;
delete from auth.sessions where id=current_setting('app.sessions_current_a')::uuid;
set local role authenticated;select pg_temp.sessions_error('select public.my_sessions()','42501');reset role;
insert into auth.sessions(id,user_id,created_at) values(current_setting('app.sessions_current_a')::uuid,current_setting('app.sessions_user_a')::uuid,null);

-- A 101-row bounded probe gives100 rows including current and factual has_more.
insert into auth.sessions(id,user_id,created_at) select md5('sessions019-synthetic-'||i::text)::uuid,current_setting('app.sessions_user_a')::uuid,'2026-10-01T00:00:00Z'::timestamptz from generate_series(1,98) i;
set local role authenticated;
do $$declare result jsonb;begin
 result:=public.my_sessions();perform pg_temp.sessions_assert(jsonb_array_length(result->'sessions')=100 and result->'has_more'='true'::jsonb and result->'sessions'->0->>'id'=current_setting('app.sessions_current_a'),'bounded list, current first, has_more true');
end $$;
reset role;
delete from auth.sessions where id=md5('sessions019-synthetic-98')::uuid;
set local role authenticated;
do $$declare result jsonb;begin
 result:=public.my_sessions();perform pg_temp.sessions_assert(jsonb_array_length(result->'sessions')=100 and result->'has_more'='false'::jsonb,'exact100 has_more false');
end $$;
reset role;
-- The query is also executable in read-only mode; fixture setup stays rolled back.
set local transaction_read_only=on;
set local role authenticated;
do $$begin perform public.my_sessions();end $$;
reset role;
-- Keep read-only through the final checks and ROLLBACK; never return to writes.
select pg_temp.sessions_assert((select count(*)::text=current_setting('app.sessions_events') from public.domain_events) and (select count(*)::text=current_setting('app.sessions_receipts') from app_private.command_receipts) and (select count(*)::text=current_setting('app.sessions_limits') from app_private.rate_limits),'reads did not change operational metadata');
rollback;
