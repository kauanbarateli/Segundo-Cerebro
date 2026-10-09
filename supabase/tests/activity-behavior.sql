-- T016 behaviour assertions; prepared for supervised execution, NOT run here.
-- Only random synthetic identities are touched. Existing data is never assumed empty.
-- Do not change ROLLBACK to COMMIT. No fixtures persist; no SQL in CI/build.
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
select set_config('t016.user_a',gen_random_uuid()::text,true),set_config('t016.user_b',gen_random_uuid()::text,true),
  set_config('t016.session_a',gen_random_uuid()::text,true),set_config('t016.session_b',gen_random_uuid()::text,true),
  set_config('t016.changed',gen_random_uuid()::text,true),set_config('t016.fallback',gen_random_uuid()::text,true),
  set_config('t016.technical',gen_random_uuid()::text,true);
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'T016: %',message; end if; end $$;
create function pg_temp.expect_error(command text,expected_state text) returns void language plpgsql security invoker as $$
declare actual text; begin
  begin execute command;
  exception when others then get stacked diagnostics actual=returned_sqlstate;
    if actual<>expected_state then raise exception 'Expected %, got %',expected_state,actual; end if; return;
  end;
  raise exception 'Expected SQLSTATE %, command succeeded',expected_state;
end $$;
create function pg_temp.capture(p_user uuid,p_id uuid) returns jsonb language sql as $$
  select jsonb_build_object('id',p_id,'user_id',p_user,'client_id',p_id::text,'type','note','title','Capture title','content','PRIVATE_CONTENT_CANARY',
    'category_id',null,'project_id',null,'status','inbox','converted_task_id',null,'captured_at','2026-10-07T09:00:00.000Z',
    'organized_at',null,'archived_at',null,'deleted_at',null,'created_at','2026-10-07T09:00:00.000Z','updated_at','2026-10-07T09:00:00.000Z');
$$;
create function pg_temp.task(p_user uuid,p_id uuid) returns jsonb language sql as $$
  select jsonb_build_object('id',p_id,'user_id',p_user,'client_id',p_id::text,'title','Task title','description','PRIVATE_DESCRIPTION_CANARY',
    'category_id',null,'project_id',null,'status','todo','priority','medium','due_at',null,'scheduled_start_at',null,'scheduled_end_at',null,
    'all_day',false,'estimated_minutes',null,'board_position',null,'source','manual','origin_capture_id',null,'completed_at',null,
    'archived_at',null,'deleted_at',null,'created_at','2026-10-07T09:00:00.000Z','updated_at','2026-10-07T09:00:00.000Z');
$$;
-- Fixture events obey the already applied T015 event shape/lifecycle trigger.
-- Atomic command writes themselves are covered by capture-task-behavior.sql.
create function pg_temp.add_event(p_id uuid,p_user uuid,p_kind text,p_time timestamptz,p_before jsonb,p_after jsonb,p_canal text default 'web') returns void language sql as $$
  insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after,capture_task_payload)
    values(p_id,p_user,p_kind,(p_after->>'id')::uuid,case when p_before is null then 'created' else 'updated' end,p_canal,p_time,p_before,p_after,
      jsonb_build_object('id',p_id,'user_id',p_user,'entity_type',p_kind,'entity_id',p_after->>'id',
        'action',case when p_before is null then 'created' else 'updated' end,'canal',p_canal,
        'occurred_at',to_char(p_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'before',p_before,'after',p_after));
$$;
create function pg_temp.page(p_limit integer default 20,p_before_time timestamptz default null,p_before_id uuid default null) returns jsonb language sql security invoker as $$
  select public.activity_page(current_setting('t016.user_a')::uuid,current_setting('t016.session_a')::uuid,p_limit,p_before_time,p_before_id);
$$;
do $$ declare s text; begin
  perform pg_temp.assert_true(current_user='postgres','owner required');
  select nspname into s from pg_namespace where oid=pg_my_temp_schema();
  execute format('grant usage on schema %I to anon,authenticated,service_role',s);
  execute format('grant execute on all functions in schema %I to anon,authenticated,service_role',s);
end $$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
  (current_setting('t016.user_a')::uuid,'authenticated','authenticated','t016-'||current_setting('t016.user_a')||'@example.invalid',false,now(),now()),
  (current_setting('t016.user_b')::uuid,'authenticated','authenticated','t016-'||current_setting('t016.user_b')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
  (current_setting('t016.session_a')::uuid,current_setting('t016.user_a')::uuid,now(),now()),
  (current_setting('t016.session_b')::uuid,current_setting('t016.user_b')::uuid,now(),now());
set local role service_role;
select pg_temp.assert_true(jsonb_array_length(pg_temp.page(50)->'items')>0 and not exists(select 1 from jsonb_array_elements(pg_temp.page(50)->'items') i where i->>'user_id'<>current_setting('t016.user_a') or i ?| array['before','after','capture_task_payload']),'new account exposes only its provision metadata in expanded history');
reset role;
-- Isolate the original capture/task keyset regression from the new identity events.
-- These are random rollback-only fixture identities, never existing users.
delete from public.domain_events where user_id in (current_setting('t016.user_a')::uuid,current_setting('t016.user_b')::uuid);

do $$ declare i integer; u uuid:=current_setting('t016.user_a')::uuid; row jsonb; b jsonb; kind text; begin
  for i in 1..53 loop
    kind:=case when i%2=0 then 'task' else 'capture' end;
    row:=case kind when 'task' then pg_temp.task(u,gen_random_uuid()) else pg_temp.capture(u,gen_random_uuid()) end;
    perform pg_temp.add_event(gen_random_uuid(),u,kind,'2026-10-07T10:00:00.123456Z'::timestamptz+((i/3)::text||' seconds')::interval,
      null,row,case i%3 when 0 then 'cron' when 1 then 'web' else 'api' end);
  end loop;
  b:=pg_temp.capture(u,gen_random_uuid());
  row:=b||jsonb_build_object('title',repeat('T',200),'content','PRIVATE_CHANGED_CANARY','updated_at','2026-10-07T11:00:00Z');
  perform pg_temp.add_event(current_setting('t016.changed')::uuid,u,'capture','2026-10-07T11:00:00.123457Z',b,row);
  row:=b||'{"title":null}'::jsonb;
  perform pg_temp.add_event(current_setting('t016.fallback')::uuid,u,'capture','2026-10-07T11:00:00.123456Z',b,row);
  row:=b||'{"updated_at":"2026-10-07T10:59:00Z"}'::jsonb;
  perform pg_temp.add_event(current_setting('t016.technical')::uuid,u,'capture','2026-10-07T10:59:00Z',b,row);
  u:=current_setting('t016.user_b')::uuid;
  perform pg_temp.add_event(gen_random_uuid(),u,'task','2026-10-07T12:00:00Z',null,pg_temp.task(u,gen_random_uuid())||'{"title":"FOREIGN_TITLE_CANARY"}'::jsonb);
end $$;
select set_config('t016.revision',(select revision::text from app_private.capture_task_revisions where user_id=current_setting('t016.user_a')::uuid),true);
select set_config('t016.expected',(select jsonb_agg(id order by occurred_at desc,id desc)::text from public.domain_events
  where user_id=current_setting('t016.user_a')::uuid and entity_type in ('capture','task')),true);
select set_config('t016.foreign_cursor',(select jsonb_build_object('id',id,'occurred_at',occurred_at)::text from public.domain_events
  where user_id=current_setting('t016.user_b')::uuid and entity_type='task'),true);

set local role service_role;
do $$ declare p jsonb; c jsonb; ids jsonb:='[]'; item jsonb; n integer:=0; begin
  p:=public.activity_page(current_setting('t016.user_a')::uuid,current_setting('t016.session_a')::uuid);
  perform pg_temp.assert_true(jsonb_array_length(p->'items')=20 and p->'next_cursor'<>'null'::jsonb,'default20 and lookahead');
  perform pg_temp.assert_true(jsonb_array_length(pg_temp.page(50)->'items')=50,'maximum50');
  perform pg_temp.assert_true(p->'items'->0->>'id'=current_setting('t016.changed') and p->'items'->0->>'occurred_at'='2026-10-07T11:00:00.123457Z','latest microsecond timestamp');
  perform pg_temp.assert_true(p->'items'->0->'changed_fields'='["title","content"]'::jsonb and char_length(p->'items'->0->>'title')=200,'exact allowed diff and full200 title');
  perform pg_temp.assert_true(p->'items'->1->>'title'='Capture title','null after-title falls back to before-title');
  perform pg_temp.assert_true(p->'items'->2->'changed_fields'='[]'::jsonb,'technical timestamp omitted');
  p:=pg_temp.page(1); c:=p->'next_cursor';
  perform pg_temp.assert_true(c->>'occurred_at'='2026-10-07T11:00:00.123457Z','cursor never loses microseconds');
  p:=pg_temp.page(1,(c->>'occurred_at')::timestamptz,(c->>'id')::uuid);
  perform pg_temp.assert_true(p->'items'->0->>'id'=current_setting('t016.fallback'),'adjacent microseconds are not skipped');
  c:=null;
  loop
    p:=pg_temp.page(7,(c->>'occurred_at')::timestamptz,(c->>'id')::uuid); n:=n+1;
    perform pg_temp.assert_true(n<=8,'pagination terminates');
    perform pg_temp.assert_true(p-array['items','next_cursor']='{}'::jsonb,'page exact keys');
    for item in select value from jsonb_array_elements(p->'items') loop
      perform pg_temp.assert_true(item ?& array['id','user_id','entity_type','entity_id','action','canal','occurred_at','title','changed_fields']
        and item-array['id','user_id','entity_type','entity_id','action','canal','occurred_at','title','changed_fields']='{}'::jsonb,'item metadata keys only');
      perform pg_temp.assert_true(item->>'user_id'=current_setting('t016.user_a'),'all events owned');
      perform pg_temp.assert_true(item->>'occurred_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$','UTC6 timestamp');
      ids:=ids||jsonb_build_array(item->'id');
    end loop;
    perform pg_temp.assert_true(p::text not like '%CANARY%','private/foreign payloads absent');
    c:=p->'next_cursor'; exit when c='null'::jsonb;
  end loop;
  perform pg_temp.assert_true(ids=current_setting('t016.expected')::jsonb and jsonb_array_length(ids)=56,'all own events once in timestamp/UUID order, including equal timestamps');
  p:=pg_temp.page(50,'0001-01-01T00:00:00Z',gen_random_uuid());
  perform pg_temp.assert_true(p='{"items":[],"next_cursor":null}'::jsonb,'cursor beyond end has honest empty page');
  c:=current_setting('t016.foreign_cursor')::jsonb;
  p:=pg_temp.page(50,(c->>'occurred_at')::timestamptz,(c->>'id')::uuid);
  perform pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(p->'items') i where i->>'user_id'<>current_setting('t016.user_a'))
    and p::text not like '%FOREIGN_TITLE_CANARY%','foreign cursor is only a position and cannot reveal another owner');
end $$;

-- Invalid parameters are explicit failures; a forged position never widens owner.
select pg_temp.expect_error('select pg_temp.page(0)','22023');
select pg_temp.expect_error('select pg_temp.page(51)','22023');
select pg_temp.expect_error('select pg_temp.page(null)','22023');
select pg_temp.expect_error('select pg_temp.page(20,now(),null)','22023');
select pg_temp.expect_error('select pg_temp.page(20,null,gen_random_uuid())','22023');
select pg_temp.expect_error('select pg_temp.page(20,''infinity'',gen_random_uuid())','22023');
select pg_temp.expect_error('select pg_temp.page(20,''0001-01-01 BC'',gen_random_uuid())','22023');
select pg_temp.expect_error(format('select public.activity_page(%L::uuid,%L::uuid)',current_setting('t016.user_b'),current_setting('t016.session_a')),'42501');
select pg_temp.expect_error(format('select public.activity_page(%L::uuid,%L::uuid)',current_setting('t016.user_a'),gen_random_uuid()),'42501');
reset role;
select pg_temp.assert_true((select revision::text=current_setting('t016.revision') from app_private.capture_task_revisions where user_id=current_setting('t016.user_a')::uuid),'reads never change revision');
select pg_temp.assert_true(not exists(select 1 from app_private.command_receipts where user_id=current_setting('t016.user_a')::uuid),'reads never issue write receipts');

-- Preference is not Entitlement. Hiding a Home block does not hide explicit history.
insert into public.user_modules(user_id,module_key,visible) values(current_setting('t016.user_a')::uuid,'tarefas',false)
  on conflict(user_id,module_key) do update set visible=false;
select pg_temp.assert_true((select not visible from public.user_modules where user_id=current_setting('t016.user_a')::uuid and module_key='tarefas'),'hidden task preference fixture exists');
set local role service_role;
select pg_temp.assert_true(jsonb_array_length(pg_temp.page()->'items')=20,'preference does not revoke explicit history');
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(pg_temp.page(50)->'items') i where i->>'entity_type'='task'),'hidden source still appears in explicit history');
reset role;
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('t016.user_a')::uuid,'capturar',false);
set local role service_role;
do $$ declare p jsonb:=pg_temp.page(50); begin
  perform pg_temp.assert_true(jsonb_array_length(p->'items')=26 and p->'next_cursor'='null'::jsonb,'capture veto masks all30 captures');
  perform pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(p->'items') i where i->>'entity_type'<>'task'),'only allowed task metadata');
end $$;
reset role;
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('t016.user_a')::uuid,'tarefas',false);
set local role service_role;
select pg_temp.assert_true(pg_temp.page()='{"items":[],"next_cursor":null}'::jsonb,'both source vetoes return empty permitted history');
reset role;
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('t016.user_a')::uuid,'inicio',false);
set local role service_role;
select pg_temp.expect_error('select pg_temp.page()','42501');
reset role;
delete from public.user_entitlements where user_id=current_setting('t016.user_a')::uuid and feature_key in ('inicio','capturar','tarefas');

-- Row-level content permissions remain append-only and independent of service RPC.
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('t016.user_a'),'role','authenticated','session_id',current_setting('t016.session_a'))::text,true);
set local role authenticated;
select pg_temp.expect_error('select pg_temp.page()','42501');
select pg_temp.expect_error('select * from public.domain_events','42501');
select pg_temp.expect_error('select before,after,capture_task_payload from public.domain_events','42501');
select pg_temp.assert_true((select count(*)=56 from public.domain_events where user_id=current_setting('t016.user_a')::uuid),'direct allowed metadata read retains all own capture/task events');
select pg_temp.expect_error('update public.domain_events set canal=''api'' where user_id=current_setting(''t016.user_a'')::uuid','42501');
select pg_temp.expect_error('delete from public.domain_events where user_id=current_setting(''t016.user_a'')::uuid','42501');
select pg_temp.assert_true(not exists(select 1 from public.domain_events where user_id<>current_setting('t016.user_a')::uuid),'direct event reads cannot cross owner');
reset role;
set local role anon;
select pg_temp.expect_error('select pg_temp.page()','42501');
reset role;

-- Current moderation/session state is rechecked on every page, even with a cursor.
update public.user_moderation set must_change_password=true where user_id=current_setting('t016.user_a')::uuid;
set local role service_role;
select pg_temp.expect_error('select pg_temp.page()','42501');
reset role;
update public.user_moderation set must_change_password=false,status='blocked' where user_id=current_setting('t016.user_a')::uuid;
set local role service_role;
select pg_temp.expect_error('select pg_temp.page()','42501');
reset role;
update public.user_moderation set status='active' where user_id=current_setting('t016.user_a')::uuid;
update auth.sessions set not_after=now()-interval '1 second' where id=current_setting('t016.session_a')::uuid;
set local role service_role;
select pg_temp.expect_error('select pg_temp.page()','42501');
reset role;
update auth.sessions set not_after=null where id=current_setting('t016.session_a')::uuid;
delete from auth.sessions where id=current_setting('t016.session_a')::uuid;
set local role service_role;
select pg_temp.expect_error('select pg_temp.page()','42501');
reset role;
rollback;
